-- Acceso temporal: aplicar antes de desplegar la aplicación. Conserva los datos.
-- La primera aprobación por autor e inquilino suma 3 meses al saldo vigente,
-- con un máximo de 12 meses desde esa aprobación. Repetir inquilino no suma tiempo.
BEGIN;

ALTER TABLE public.resenas ADD COLUMN IF NOT EXISTS primera_aprobacion_en timestamptz;

-- No hay historial de aprobaciones anterior: conservar la antigüedad conocida.
UPDATE public.resenas
SET primera_aprobacion_en = creado_en
WHERE estado = 'publicada' AND primera_aprobacion_en IS NULL;

CREATE INDEX IF NOT EXISTS idx_resenas_acceso_autor
  ON public.resenas (autor_id, primera_aprobacion_en, id)
  WHERE estado = 'publicada';

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

-- Un recibo inmutable por primera aprobación. Conservamos el recibo al borrar
-- la reseña para que volver a reseñar al mismo inquilino no reinicie su recompensa.
-- No lleva FK a resenas/personas por ese motivo; borrar la cuenta sí lo elimina.
CREATE TABLE IF NOT EXISTS privado.aportes_consulta (
  resena_id integer PRIMARY KEY,
  autor_id integer NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  persona_id integer NOT NULL,
  tipo text NOT NULL,
  fecha_inicio_alquiler date,
  aprobada_en timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_aportes_consulta_autor
  ON privado.aportes_consulta (autor_id, persona_id, tipo, fecha_inicio_alquiler);
ALTER TABLE privado.aportes_consulta ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE privado.aportes_consulta FROM PUBLIC;

INSERT INTO privado.aportes_consulta
  (resena_id, autor_id, persona_id, tipo, fecha_inicio_alquiler, aprobada_en)
SELECT id, autor_id, persona_id, tipo, fecha_inicio_alquiler, primera_aprobacion_en
FROM public.resenas
WHERE primera_aprobacion_en IS NOT NULL
ON CONFLICT (resena_id) DO NOTHING;

CREATE OR REPLACE FUNCTION privado.registrar_aporte_consulta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  -- Solo se invoca por una escritura autorizada en resenas. No acepta IDs
  -- externos ni permite al cliente escribir en el historial de recompensas.
  IF NEW.primera_aprobacion_en IS NOT NULL THEN
    INSERT INTO privado.aportes_consulta
      (resena_id, autor_id, persona_id, tipo, fecha_inicio_alquiler, aprobada_en)
    VALUES (NEW.id, NEW.autor_id, NEW.persona_id, NEW.tipo,
      NEW.fecha_inicio_alquiler, NEW.primera_aprobacion_en)
    ON CONFLICT (resena_id) DO NOTHING;
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION privado.registrar_aporte_consulta() FROM PUBLIC;
DROP TRIGGER IF EXISTS trg_resenas_aporte_consulta ON public.resenas;
CREATE TRIGGER trg_resenas_aporte_consulta
  AFTER INSERT OR UPDATE ON public.resenas
  FOR EACH ROW EXECUTE FUNCTION privado.registrar_aporte_consulta();

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
  WITH RECURSIVE experiencias AS (
    -- Un aporte es autor + persona, sin distinguir fechas ni tipos de reseña.
    -- Se aplica también al historial: las fechas registradas se conservan.
    -- La primera aprobación incluye recibos borrados/ocultos para no premiar reenvíos.
    SELECT a.autor_id, a.persona_id,
      min(a.aprobada_en) AS aprobada_en, min(a.resena_id) AS orden
    FROM privado.aportes_consulta a
    LEFT JOIN public.resenas r ON r.id = a.resena_id AND r.autor_id = a.autor_id
    WHERE a.autor_id = ANY(p_usuario_ids)
    GROUP BY a.autor_id, a.persona_id
    HAVING bool_or(r.estado = 'publicada')
  ), resenas_ordenadas AS (
    SELECT autor_id, aprobada_en,
      row_number() OVER (
        PARTITION BY autor_id
        ORDER BY aprobada_en, orden
      ) AS paso
    FROM experiencias
  ), vigencias AS (
    SELECT autor_id, paso, aprobada_en,
      aprobada_en + interval '3 months' AS vence
    FROM resenas_ordenadas
    WHERE paso = 1
    UNION ALL
    SELECT siguiente.autor_id, siguiente.paso, siguiente.aprobada_en,
      least(
        greatest(anterior.vence, siguiente.aprobada_en) + interval '3 months',
        siguiente.aprobada_en + interval '12 months'
      ) AS vence
    FROM vigencias anterior
    JOIN resenas_ordenadas siguiente
      ON siguiente.autor_id = anterior.autor_id
     AND siguiente.paso = anterior.paso + 1
  ), premios AS (
    SELECT autor_id, count(*)::integer AS aprobadas,
      max(aprobada_en) AS ultima, max(vence) AS vence
    FROM vigencias
    GROUP BY autor_id
  ), otros_estados AS (
    SELECT r.autor_id,
      count(*) FILTER (WHERE r.estado = 'borrador')::integer AS pendientes,
      count(*) FILTER (WHERE r.estado = 'oculta')::integer AS rechazadas
    FROM public.resenas r
    WHERE r.autor_id = ANY(p_usuario_ids)
    GROUP BY r.autor_id
  )
  SELECT u.id,
    u.activo AND (u.rol = 'admin' OR coalesce(p.vence > now(), false)),
    coalesce(p.aprobadas, 0), coalesce(e.pendientes, 0),
    coalesce(e.rechazadas, 0), p.ultima,
    CASE WHEN u.rol = 'admin' THEN NULL ELSE p.vence END,
    CASE
      WHEN NOT u.activo THEN 'inactiva'
      WHEN u.rol = 'admin' THEN 'administracion'
      WHEN p.vence > now() THEN 'vigente'
      WHEN coalesce(p.aprobadas, 0) > 0 THEN 'vencida'
      WHEN coalesce(e.pendientes, 0) > 0 THEN 'revision'
      WHEN coalesce(e.rechazadas, 0) > 0 THEN 'rechazada'
      ELSE 'ninguna'
    END
  FROM public.usuarios u
  LEFT JOIN premios p ON p.autor_id = u.id
  LEFT JOIN otros_estados e ON e.autor_id = u.id
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
    REVOKE ALL ON FUNCTION privado.registrar_aporte_consulta() FROM anon;
    REVOKE ALL ON TABLE privado.aportes_consulta FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT USAGE ON SCHEMA privado TO authenticated;
    REVOKE ALL ON FUNCTION public.accesos_consulta(integer[]) FROM authenticated;
    REVOKE ALL ON FUNCTION privado.registrar_primera_aprobacion() FROM authenticated;
    REVOKE ALL ON FUNCTION privado.registrar_aporte_consulta() FROM authenticated;
    REVOKE ALL ON TABLE privado.aportes_consulta FROM authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.accesos_consulta(integer[]) TO service_role;
    GRANT USAGE ON SCHEMA privado TO service_role;
    GRANT SELECT ON TABLE privado.aportes_consulta TO service_role;
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
  ALTER POLICY denuncias_lectura ON public.denuncias
    USING (denunciante_id = (SELECT usuario_id FROM privado.mi_acceso_consulta()));
  GRANT USAGE ON SEQUENCE public.resenas_id_seq, public.denuncias_id_seq TO authenticated;
END;
$migration$;

NOTIFY pgrst, 'reload schema';
COMMIT;
