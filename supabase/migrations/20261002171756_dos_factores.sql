-- Optional MFA: only accounts with a verified factor require an AAL2 session.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- Keep only the session proof, never the password or the original link token.
ALTER TABLE public.invitaciones_admin
  ADD COLUMN IF NOT EXISTS sesion_enlace_id uuid,
  ADD COLUMN IF NOT EXISTS enlace_verificado_en timestamptz;

DO $migration$
DECLARE tabla text;
BEGIN
  -- Plain Postgres test installations do not have Supabase Auth's factor table.
  IF to_regclass('auth.mfa_factors') IS NULL THEN RETURN; END IF;

  CREATE OR REPLACE FUNCTION privado.segundo_factor_verificado()
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $fn$
    SELECT auth.uid() IS NOT NULL AND (
      coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'aal',
        nullif(current_setting('request.jwt.claim.aal', true), ''), '') = 'aal2'
      OR NOT EXISTS (SELECT 1 FROM auth.mfa_factors f
        WHERE f.user_id = auth.uid() AND f.status = 'verified')
    );
  $fn$;
  REVOKE ALL ON FUNCTION privado.segundo_factor_verificado() FROM PUBLIC, anon;
  GRANT EXECUTE ON FUNCTION privado.segundo_factor_verificado() TO authenticated, service_role;

  -- This existing gate also protects SECURITY DEFINER RPCs and self-scoped reads.
  CREATE OR REPLACE FUNCTION privado.sesion_administracion_actual()
  RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $fn$
  DECLARE sesion text;
  BEGIN
    IF privado.segundo_factor_verificado() IS NOT TRUE THEN RETURN false; END IF;
    sesion := coalesce(
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'session_id',
      nullif(current_setting('request.jwt.claim.session_id', true), '')
    );
    IF sesion IS NULL OR sesion !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN RETURN false; END IF;
    RETURN public.sesion_administracion_vigente(auth.uid(), sesion::uuid);
  EXCEPTION WHEN invalid_text_representation THEN RETURN false;
  END;
  $fn$;
  REVOKE ALL ON FUNCTION privado.sesion_administracion_actual() FROM PUBLIC, anon;
  GRANT EXECUTE ON FUNCTION privado.sesion_administracion_actual() TO authenticated, service_role;

  -- A false permission flag alone still leaks metadata from this definer RPC.
  CREATE OR REPLACE FUNCTION privado.mi_acceso_consulta()
  RETURNS TABLE (usuario_id integer, puede_consultar boolean, aprobadas integer,
    pendientes integer, rechazadas integer, ultima_aprobacion_en timestamptz, vence_en timestamptz, motivo text)
  LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $fn$
  BEGIN
    IF privado.sesion_administracion_actual() IS NOT TRUE THEN RETURN; END IF;
    RETURN QUERY SELECT a.*
    FROM public.accesos_consulta(ARRAY(SELECT u.id FROM public.usuarios u WHERE u.auth_user_id = auth.uid())) a;
  END;
  $fn$;

  -- Restrictive policies intersect existing ownership and permission checks.
  -- Live factors prevent stale AAL1 tokens and direct REST calls bypassing MFA.
  FOR tabla IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND c.relrowsecurity
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS segundo_factor_requerido ON public.%I', tabla);
    EXECUTE format('CREATE POLICY segundo_factor_requerido ON public.%I AS RESTRICTIVE FOR ALL TO authenticated
      USING ((SELECT privado.segundo_factor_verificado())) WITH CHECK ((SELECT privado.segundo_factor_verificado()))', tabla);
  END LOOP;
END;
$migration$;

NOTIFY pgrst, 'reload schema';
COMMIT;
