-- Acceso temporal: aplicar antes de desplegar la aplicación. Conserva los datos.
-- La aprobación inicial es inmutable; editar o volver a publicar no renueva acceso.
BEGIN;

ALTER TABLE public.resenas ADD COLUMN IF NOT EXISTS primera_aprobacion_en timestamptz;

-- No hay historial de aprobaciones anterior: conservar la antigüedad conocida.
UPDATE public.resenas
SET primera_aprobacion_en = creado_en
WHERE estado = 'publicada' AND primera_aprobacion_en IS NULL;

CREATE SCHEMA IF NOT EXISTS privado;
REVOKE ALL ON SCHEMA privado FROM PUBLIC;

CREATE OR REPLACE FUNCTION privado.registrar_primera_aprobacion()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.primera_aprobacion_en := CASE WHEN NEW.estado = 'publicada' THEN
      CASE WHEN NEW.fuente = 'legacy' THEN least(NEW.creado_en, now()) ELSE now() END
    ELSE NULL END;
  ELSE
    NEW.primera_aprobacion_en := OLD.primera_aprobacion_en;
    IF OLD.primera_aprobacion_en IS NULL AND NEW.estado = 'publicada' THEN
      NEW.primera_aprobacion_en := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION privado.registrar_primera_aprobacion() FROM PUBLIC;
DROP TRIGGER IF EXISTS trg_resenas_primera_aprobacion ON public.resenas;
CREATE TRIGGER trg_resenas_primera_aprobacion
  BEFORE INSERT OR UPDATE ON public.resenas
  FOR EACH ROW EXECUTE FUNCTION privado.registrar_primera_aprobacion();

-- Incluye los estados pendientes/rechazados sin descargar reseñas ni depender
-- del límite de filas de PostgREST. Un solo cálculo para servidor, UI y RLS.
CREATE OR REPLACE FUNCTION public.accesos_consulta(p_usuario_ids integer[])
RETURNS TABLE (
  usuario_id integer, puede_consultar boolean, aprobadas integer,
  pendientes integer, rechazadas integer, ultima_aprobacion_en timestamptz,
  vence_en timestamptz, motivo text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog
SET timezone = 'UTC'
AS $$
  SELECT u.id,
    u.activo AND (u.rol = 'admin' OR coalesce(v.vence > now(), false)),
    r.aprobadas, r.pendientes, r.rechazadas, r.ultima,
    CASE WHEN u.rol = 'admin' THEN NULL ELSE v.vence END,
    CASE
      WHEN NOT u.activo THEN 'inactiva'
      WHEN u.rol = 'admin' THEN 'administracion'
      WHEN v.vence > now() THEN 'vigente'
      WHEN r.aprobadas > 0 THEN 'vencida'
      WHEN r.pendientes > 0 THEN 'revision'
      WHEN r.rechazadas > 0 THEN 'rechazada'
      ELSE 'ninguna'
    END
  FROM public.usuarios u
  CROSS JOIN LATERAL (
    SELECT count(*) FILTER (WHERE estado = 'publicada')::integer AS aprobadas,
      count(*) FILTER (WHERE estado = 'borrador')::integer AS pendientes,
      count(*) FILTER (WHERE estado = 'oculta')::integer AS rechazadas,
      max(primera_aprobacion_en) FILTER (WHERE estado = 'publicada') AS ultima
    FROM public.resenas WHERE autor_id = u.id
  ) r
  CROSS JOIN LATERAL (
    SELECT r.ultima + CASE
      WHEN r.aprobadas = 1 THEN interval '1 month'
      WHEN r.aprobadas BETWEEN 2 AND 3 THEN interval '6 months'
      WHEN r.aprobadas > 3 THEN interval '1 year'
    END AS vence
  ) v
  WHERE u.id = ANY(p_usuario_ids);
$$;
REVOKE ALL ON FUNCTION public.accesos_consulta(integer[]) FROM PUBLIC;

-- Permite instalar el esquema en Postgres de pruebas, sin Supabase Auth.
DO $migration$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON SCHEMA privado FROM anon;
    REVOKE ALL ON FUNCTION public.accesos_consulta(integer[]) FROM anon;
    REVOKE ALL ON FUNCTION privado.registrar_primera_aprobacion() FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT USAGE ON SCHEMA privado TO authenticated;
    REVOKE ALL ON FUNCTION public.accesos_consulta(integer[]) FROM authenticated;
    REVOKE ALL ON FUNCTION privado.registrar_primera_aprobacion() FROM authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.accesos_consulta(integer[]) TO service_role;
  END IF;
  IF to_regprocedure('auth.uid()') IS NULL THEN RETURN; END IF;

  -- SECURITY DEFINER solo aquí: resuelve la identidad de la sesión y evita la
  -- recursión RLS. No acepta un ID que pueda elegir quien llama.
  CREATE OR REPLACE FUNCTION privado.mi_acceso_consulta()
  RETURNS TABLE (
    usuario_id integer, puede_consultar boolean, aprobadas integer,
    pendientes integer, rechazadas integer, ultima_aprobacion_en timestamptz,
    vence_en timestamptz, motivo text
  )
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = pg_catalog
  AS $fn$
    SELECT a.* FROM public.accesos_consulta(ARRAY(
      SELECT id FROM public.usuarios WHERE auth_user_id = auth.uid()
    )) a;
  $fn$;

  CREATE OR REPLACE FUNCTION public.mi_acceso_consulta()
  RETURNS TABLE (
    usuario_id integer, puede_consultar boolean, aprobadas integer,
    pendientes integer, rechazadas integer, ultima_aprobacion_en timestamptz,
    vence_en timestamptz, motivo text
  )
  LANGUAGE sql STABLE SECURITY INVOKER
  SET search_path = pg_catalog
  AS $fn$ SELECT * FROM privado.mi_acceso_consulta(); $fn$;

  CREATE OR REPLACE FUNCTION privado.puede_leer_registro()
  RETURNS boolean
  LANGUAGE sql STABLE SECURITY INVOKER
  SET search_path = pg_catalog
  AS $fn$
    SELECT coalesce((SELECT puede_consultar FROM privado.mi_acceso_consulta()), false);
  $fn$;

  REVOKE ALL ON FUNCTION privado.mi_acceso_consulta() FROM PUBLIC, anon, authenticated;
  REVOKE ALL ON FUNCTION public.mi_acceso_consulta() FROM PUBLIC, anon, authenticated;
  REVOKE ALL ON FUNCTION privado.puede_leer_registro() FROM PUBLIC, anon, authenticated;
  GRANT EXECUTE ON FUNCTION privado.mi_acceso_consulta(), public.mi_acceso_consulta(), privado.puede_leer_registro() TO authenticated;

  -- Actualiza también instalaciones anteriores al traslado al esquema privado.
  ALTER POLICY personas_lectura ON public.personas USING ((SELECT privado.puede_leer_registro()));
  ALTER POLICY resenas_lectura ON public.resenas
    USING (estado = 'publicada' AND (SELECT privado.puede_leer_registro()));
  -- auth_user_id es una columna privada: las políticas de escritura obtienen
  -- la identidad mediante la función de sesión, sin abrir esa columna.
  ALTER POLICY resenas_escritura ON public.resenas WITH CHECK (
    autor_id = (SELECT usuario_id FROM privado.mi_acceso_consulta() WHERE motivo <> 'inactiva')
    AND (estado = 'borrador' OR (SELECT motivo FROM privado.mi_acceso_consulta()) = 'administracion')
  );
  ALTER POLICY denuncias_escritura ON public.denuncias WITH CHECK (
    (SELECT privado.puede_leer_registro())
    AND denunciante_id = (SELECT usuario_id FROM privado.mi_acceso_consulta())
  );
  GRANT USAGE ON SEQUENCE public.resenas_id_seq, public.denuncias_id_seq TO authenticated;
END;
$migration$;

NOTIFY pgrst, 'reload schema';
COMMIT;
