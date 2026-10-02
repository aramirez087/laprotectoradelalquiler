-- Las sesiones revocadas no adquieren acceso al vincular o elevar una cuenta existente.
BEGIN;

CREATE OR REPLACE FUNCTION public.sesion_administracion_vigente(p_auth_user_id uuid, p_session_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
  IF p_auth_user_id IS NULL OR p_session_id IS NULL OR to_regclass('auth.sessions') IS NULL THEN
    RETURN false;
  END IF;
  RETURN EXISTS (SELECT 1 FROM auth.sessions s WHERE s.id = p_session_id AND s.user_id = p_auth_user_id);
END;
$$;
REVOKE ALL ON FUNCTION public.sesion_administracion_vigente(uuid, uuid) FROM PUBLIC;

DO $migration$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.sesion_administracion_vigente(uuid, uuid) TO service_role;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION public.sesion_administracion_vigente(uuid, uuid) FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON FUNCTION public.sesion_administracion_vigente(uuid, uuid) FROM authenticated;
  END IF;
  IF to_regprocedure('auth.uid()') IS NULL THEN RETURN; END IF;
  CREATE OR REPLACE FUNCTION privado.sesion_administracion_actual()
  RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $fn$
  DECLARE sesion text;
  BEGIN
    -- Keep MFA enforcement when this older maintenance migration is reapplied.
    IF to_regprocedure('privado.segundo_factor_verificado()') IS NOT NULL THEN
      IF privado.segundo_factor_verificado() IS NOT TRUE THEN RETURN false; END IF;
    END IF;
    sesion := coalesce(
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'session_id',
      nullif(current_setting('request.jwt.claim.session_id', true), '')
    );
    IF sesion IS NULL OR sesion !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN RETURN false; END IF;
    RETURN public.sesion_administracion_vigente(auth.uid(), sesion::uuid);
  EXCEPTION WHEN invalid_text_representation THEN RETURN false;
  END;
  $fn$;

  CREATE OR REPLACE FUNCTION public.mi_sesion_administracion_vigente()
  RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = pg_catalog
  AS $fn$ SELECT privado.sesion_administracion_actual(); $fn$;

  CREATE OR REPLACE FUNCTION privado.sesion_activa()
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog
  AS $fn$
    SELECT EXISTS (SELECT 1 FROM public.usuarios u WHERE u.auth_user_id = auth.uid() AND u.activo)
      AND privado.sesion_administracion_actual();
  $fn$;

  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'usuarios' AND policyname = 'usuarios_lectura') THEN
    ALTER POLICY usuarios_lectura ON public.usuarios USING (
      auth_user_id = auth.uid() AND (SELECT privado.sesion_administracion_actual())
    );
  END IF;

  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'denuncias' AND policyname = 'denuncias_lectura') THEN
    ALTER POLICY denuncias_lectura ON public.denuncias USING (
      denunciante_id = (SELECT usuario_id FROM privado.mi_acceso_consulta())
      AND (SELECT privado.sesion_administracion_actual())
    );
  END IF;

  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'resenas' AND policyname = 'resenas_escritura') THEN
    ALTER POLICY resenas_escritura ON public.resenas WITH CHECK (
      autor_id = (SELECT usuario_id FROM privado.mi_acceso_consulta() WHERE motivo NOT IN ('inactiva', 'error'))
      AND (estado = 'borrador' OR (SELECT motivo FROM privado.mi_acceso_consulta()) = 'administracion')
    );
  END IF;

  CREATE OR REPLACE FUNCTION privado.mi_acceso_consulta()
  RETURNS TABLE (usuario_id integer, puede_consultar boolean, aprobadas integer,
    pendientes integer, rechazadas integer, ultima_aprobacion_en timestamptz, vence_en timestamptz, motivo text)
  LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $fn$
  BEGIN
    -- RLS does not apply inside this function: do not expose even the counters.
    IF privado.sesion_administracion_actual() IS NOT TRUE THEN RETURN; END IF;
    RETURN QUERY SELECT a.*
    FROM public.accesos_consulta(ARRAY(SELECT u.id FROM public.usuarios u WHERE u.auth_user_id = auth.uid())) a;
  END;
  $fn$;

  REVOKE ALL ON FUNCTION privado.sesion_administracion_actual(), public.mi_sesion_administracion_vigente() FROM PUBLIC;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION public.sesion_administracion_vigente(uuid, uuid), privado.sesion_administracion_actual(), public.mi_sesion_administracion_vigente() FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON FUNCTION public.sesion_administracion_vigente(uuid, uuid) FROM authenticated;
    GRANT EXECUTE ON FUNCTION privado.sesion_administracion_actual(), public.mi_sesion_administracion_vigente() TO authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION privado.sesion_administracion_actual(), public.mi_sesion_administracion_vigente() TO service_role;
  END IF;
END;
$migration$;

NOTIFY pgrst, 'reload schema';
COMMIT;
