-- Moderación automática: evidencia privada y publicación atómica solo desde el servidor.
-- Las respuestas de IA nunca cambian por sí solas el estado de una reseña.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE SCHEMA IF NOT EXISTS privado;

-- Una fecha puede tener otra descarga corregida: la prueba identifica también el hash inmutable.
ALTER TABLE public.verificaciones_cedula ADD COLUMN IF NOT EXISTS version_padron text;
ALTER TABLE public.verificaciones_cedula DROP CONSTRAINT IF EXISTS verificaciones_cedula_version_padron;
ALTER TABLE public.verificaciones_cedula ADD CONSTRAINT verificaciones_cedula_version_padron CHECK (
  version_padron IS NULL OR (version_padron ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}-[a-f0-9]{16}$'
    AND left(version_padron, 10) = fecha_padron::text)
);

DROP FUNCTION IF EXISTS public.guardar_verificacion_cedula(text, date, text);
CREATE OR REPLACE FUNCTION public.guardar_verificacion_cedula(
  p_identificacion text, p_fecha_padron date, p_nombre_tse text, p_version_padron text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $$
BEGIN
  IF p_version_padron IS NOT NULL THEN
    PERFORM 1 FROM public.padron_tse t WHERE t.id = 1
      AND t.version = p_version_padron AND t.fecha_padron = p_fecha_padron FOR SHARE;
    IF NOT FOUND THEN RETURN; END IF;
  END IF;
  INSERT INTO public.verificaciones_cedula AS actual
    (identificacion, estado, fecha_padron, nombre_tse, version_padron)
  VALUES (p_identificacion, CASE WHEN p_nombre_tse IS NULL THEN 'no_encontrada' ELSE 'encontrada' END,
    p_fecha_padron, p_nombre_tse, p_version_padron)
  ON CONFLICT (identificacion) DO UPDATE SET estado = excluded.estado,
    fecha_padron = excluded.fecha_padron, nombre_tse = excluded.nombre_tse,
    version_padron = excluded.version_padron, consultado_en = clock_timestamp()
  WHERE (p_version_padron IS NOT NULL OR actual.version_padron IS NULL)
    AND actual.fecha_padron <= excluded.fecha_padron;
END;
$$;
REVOKE ALL ON FUNCTION public.guardar_verificacion_cedula(text, date, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guardar_verificacion_cedula(text, date, text, text) TO service_role;

CREATE TABLE IF NOT EXISTS privado.intentos_moderacion_resenas (
  resena_id integer NOT NULL REFERENCES public.resenas(id) ON DELETE CASCADE,
  version integer NOT NULL CHECK (version > 0),
  autor_id integer NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  solicitada_en timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (resena_id, version)
);
CREATE INDEX IF NOT EXISTS idx_intentos_moderacion_autor ON privado.intentos_moderacion_resenas(autor_id, solicitada_en);
CREATE INDEX IF NOT EXISTS idx_intentos_moderacion_fecha ON privado.intentos_moderacion_resenas(solicitada_en);
ALTER TABLE privado.intentos_moderacion_resenas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE privado.intentos_moderacion_resenas FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA privado TO service_role;
GRANT SELECT, INSERT, DELETE ON TABLE privado.intentos_moderacion_resenas TO service_role;

CREATE OR REPLACE FUNCTION public.consumir_cupo_moderacion_resena(p_id bigint, p_version integer)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $$
DECLARE autor integer; ahora timestamptz;
BEGIN
  SELECT r.autor_id INTO autor FROM public.resenas r JOIN public.usuarios u ON u.id = r.autor_id
    WHERE r.id = p_id AND r.version = p_version AND r.estado = 'borrador' AND u.activo FOR SHARE OF r, u;
  IF NOT FOUND THEN RETURN false; END IF;
  -- Un único cerrojo evita que solicitudes simultáneas excedan cualquier límite.
  PERFORM pg_advisory_xact_lock(hashtextextended('laprotectora/moderacion-ai/v1', 0));
  ahora := clock_timestamp();
  DELETE FROM privado.intentos_moderacion_resenas i WHERE i.solicitada_en <= ahora - interval '30 days';
  IF EXISTS(SELECT 1 FROM privado.intentos_moderacion_resenas i WHERE i.resena_id = p_id AND i.version = p_version)
    OR EXISTS(SELECT 1 FROM privado.moderacion_automatica_resenas a WHERE a.resena_id = p_id AND a.version_evaluada = p_version)
    OR (SELECT count(*) FROM privado.intentos_moderacion_resenas i WHERE i.autor_id = autor AND i.solicitada_en > ahora - interval '10 minutes') >= 5
    OR (SELECT count(*) FROM privado.intentos_moderacion_resenas i WHERE i.autor_id = autor AND i.solicitada_en > ahora - interval '24 hours') >= 20
    OR (SELECT count(*) FROM privado.intentos_moderacion_resenas i WHERE i.solicitada_en > ahora - interval '1 minute') >= 10
    OR (SELECT count(*) FROM privado.intentos_moderacion_resenas i WHERE i.solicitada_en > ahora - interval '24 hours') >= 200 THEN RETURN false; END IF;
  INSERT INTO privado.intentos_moderacion_resenas(resena_id, version, autor_id, solicitada_en)
    VALUES(p_id, p_version, autor, ahora) ON CONFLICT DO NOTHING;
  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.consumir_cupo_moderacion_resena(bigint, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consumir_cupo_moderacion_resena(bigint, integer) TO service_role;

CREATE TABLE IF NOT EXISTS privado.moderacion_automatica_resenas (
  resena_id integer NOT NULL REFERENCES public.resenas(id) ON DELETE CASCADE,
  version_evaluada integer NOT NULL CHECK (version_evaluada > 0),
  version_resultante integer NOT NULL CHECK (version_resultante > 0),
  contenido_sha256 text NOT NULL CHECK (contenido_sha256 ~ '^[a-f0-9]{64}$'),
  decision text NOT NULL CHECK (decision IN ('aprobada', 'revision', 'obsoleta')),
  motivo text NOT NULL CHECK (motivo ~ '^[a-z][a-z0-9_]{0,79}$'),
  modelo text CHECK (modelo IS NULL OR length(btrim(modelo)) BETWEEN 1 AND 200),
  politica text NOT NULL CHECK (politica = 'resenas-v1'),
  categorias text[] NOT NULL DEFAULT '{}' CHECK (cardinality(categorias) <= 8 AND categorias <@ ARRAY[
    'sexual_explicito', 'sexual_menores', 'violencia_grafica', 'odio_o_amenazas',
    'datos_personales', 'instrucciones', 'fuera_de_contexto', 'incierto']::text[]),
  fecha_padron date,
  version_padron text,
  evaluada_en timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (decision <> 'aprobada' OR (motivo = 'contenido_seguro' AND modelo IS NOT NULL AND modelo = 'openai/gpt-oss-120b'
    AND cardinality(categorias) = 0 AND fecha_padron IS NOT NULL AND version_resultante = version_evaluada + 1)),
  PRIMARY KEY (resena_id, version_evaluada)
);
ALTER TABLE privado.moderacion_automatica_resenas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE privado.moderacion_automatica_resenas FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA privado TO service_role;
GRANT SELECT, INSERT ON TABLE privado.moderacion_automatica_resenas TO service_role;

CREATE OR REPLACE FUNCTION privado.cedula_nacional_moderacion(p_texto text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE SECURITY INVOKER SET search_path = pg_catalog AS $$
  SELECT CASE WHEN btrim(p_texto) ~ '^[0-9[:space:]-]+$'
    AND regexp_replace(btrim(p_texto), '[[:space:]-]', '', 'g') ~ '^[1-9][0-9]{8}$'
    THEN regexp_replace(btrim(p_texto), '[[:space:]-]', '', 'g') END;
$$;
CREATE OR REPLACE FUNCTION privado.nombre_moderacion(p_texto text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE SECURITY INVOKER SET search_path = pg_catalog AS $$
  SELECT trim(regexp_replace(translate(lower(normalize(coalesce(p_texto, ''), NFKC)),
    'áéíóúüñ', 'aeiouun'), '[^[:alnum:]]+', ' ', 'g'));
$$;

CREATE OR REPLACE FUNCTION public.resolver_moderacion_automatica_resena(
  p_id bigint, p_version integer, p_comentario text, p_detalle_dano text,
  p_autor_cedula text, p_persona_cedula text, p_resultado jsonb
)
RETURNS TABLE (publicada boolean, motivo text, version integer)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $$
DECLARE
  actual public.resenas%ROWTYPE;
  autor public.usuarios%ROWTYPE;
  persona public.personas%ROWTYPE;
  anterior privado.moderacion_automatica_resenas%ROWTYPE;
  prueba_autor public.verificaciones_cedula%ROWTYPE;
  prueba_persona public.verificaciones_cedula%ROWTYPE;
  padron public.padron_tse%ROWTYPE;
  cedula_autor text;
  cedula_persona text;
  resultado_valido boolean := false;
  resultado_motivo text := 'resultado_invalido';
  resultado_modelo text;
  resultado_categorias text[] := '{}';
  decision_final text := 'revision';
  version_final integer;
BEGIN
  -- La fila permanece bloqueada hasta que evidencia y publicación se confirman juntas.
  SELECT r.* INTO actual FROM public.resenas r WHERE r.id = p_id FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT false, 'resena_no_disponible'::text, NULL::integer; RETURN; END IF;
  IF p_version IS NULL OR p_version < 1 THEN
    RETURN QUERY SELECT false, 'resena_obsoleta'::text, actual.version; RETURN;
  END IF;
  SELECT h.* INTO anterior FROM privado.moderacion_automatica_resenas h
    WHERE h.resena_id = actual.id AND h.version_evaluada = p_version;
  IF FOUND THEN
    -- Reintentos y respuestas concurrentes no generan otra versión ni otro aviso.
    IF anterior.decision = 'aprobada' AND actual.estado = 'publicada'
      AND actual.version = anterior.version_resultante
      AND actual.comentario IS NOT DISTINCT FROM p_comentario
      AND actual.detalle_dano IS NOT DISTINCT FROM p_detalle_dano THEN
      RETURN QUERY SELECT true, anterior.motivo, actual.version;
    ELSE
      RETURN QUERY SELECT false, CASE WHEN actual.version = p_version THEN anterior.motivo
        ELSE 'resena_obsoleta' END, actual.version;
    END IF;
    RETURN;
  END IF;

  -- Se registra únicamente un vocabulario acotado, nunca el prompt ni texto del modelo.
  IF jsonb_typeof(p_resultado) = 'object'
    AND p_resultado->>'decision' IN ('segura', 'revision')
    AND p_resultado->>'motivo' ~ '^[a-z][a-z0-9_]{0,79}$'
    AND p_resultado->>'politica' = 'resenas-v1'
    AND (p_resultado->'modelo' = 'null'::jsonb OR
      (jsonb_typeof(p_resultado->'modelo') = 'string' AND length(btrim(p_resultado->>'modelo')) BETWEEN 1 AND 200))
    AND jsonb_typeof(p_resultado->'categorias') = 'array' THEN
    IF jsonb_array_length(p_resultado->'categorias') <= 8 AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_resultado->'categorias') c
      WHERE jsonb_typeof(c) <> 'string' OR c #>> '{}' NOT IN (
        'sexual_explicito', 'sexual_menores', 'violencia_grafica', 'odio_o_amenazas',
        'datos_personales', 'instrucciones', 'fuera_de_contexto', 'incierto')
    ) AND (SELECT count(DISTINCT c) FROM jsonb_array_elements_text(p_resultado->'categorias') c)
      = jsonb_array_length(p_resultado->'categorias') THEN
      resultado_valido := true;
      resultado_motivo := p_resultado->>'motivo';
      resultado_modelo := nullif(btrim(p_resultado->>'modelo'), '');
      SELECT coalesce(array_agg(c), '{}'::text[]) INTO resultado_categorias
        FROM jsonb_array_elements_text(p_resultado->'categorias') c;
    END IF;
  END IF;

  IF actual.version <> p_version OR actual.estado <> 'borrador'
    OR actual.comentario IS DISTINCT FROM p_comentario OR actual.detalle_dano IS DISTINCT FROM p_detalle_dano THEN
    resultado_motivo := 'resena_obsoleta';
    decision_final := 'obsoleta';
  ELSE
    -- La cédula o el nombre de una ficha pueden cambiar sin actualizar esta reseña.
    SELECT u.* INTO autor FROM public.usuarios u WHERE u.id = actual.autor_id FOR SHARE;
    SELECT p.* INTO persona FROM public.personas p WHERE p.id = actual.persona_id FOR SHARE;
    cedula_autor := privado.cedula_nacional_moderacion(autor.identificacion);
    cedula_persona := privado.cedula_nacional_moderacion(persona.identificacion);
    IF NOT coalesce(autor.activo, false) THEN resultado_motivo := 'autor_inactivo';
    ELSIF cedula_autor IS DISTINCT FROM p_autor_cedula OR cedula_persona IS DISTINCT FROM p_persona_cedula THEN
      resultado_motivo := 'identidad_cambio';
    ELSIF actual.comentario IS NULL OR length(btrim(actual.comentario)) NOT BETWEEN 30 AND 5000
      OR length(coalesce(actual.detalle_dano, '')) > 5000 THEN
      resultado_motivo := 'contenido_invalido';
    ELSIF resultado_valido AND p_resultado->>'decision' = 'segura'
      AND resultado_motivo = 'contenido_seguro' AND resultado_modelo = 'openai/gpt-oss-120b'
      AND cardinality(resultado_categorias) = 0 THEN
      SELECT t.* INTO padron FROM public.padron_tse t WHERE t.id = 1 FOR SHARE;
      SELECT v.* INTO prueba_autor FROM public.verificaciones_cedula v WHERE v.identificacion = cedula_autor FOR SHARE;
      SELECT v.* INTO prueba_persona FROM public.verificaciones_cedula v WHERE v.identificacion = cedula_persona FOR SHARE;
      IF padron.fecha_padron IS NULL OR clock_timestamp() < (padron.fecha_padron::timestamp AT TIME ZONE 'UTC')
        OR clock_timestamp() - (padron.fecha_padron::timestamp AT TIME ZONE 'UTC') > interval '62 days' THEN
        resultado_motivo := 'padron_desactualizado';
      ELSIF cedula_autor IS NULL OR cedula_persona IS NULL
        OR prueba_autor.estado IS DISTINCT FROM 'encontrada' OR prueba_persona.estado IS DISTINCT FROM 'encontrada'
        OR prueba_autor.fecha_padron IS DISTINCT FROM padron.fecha_padron
        OR prueba_persona.fecha_padron IS DISTINCT FROM padron.fecha_padron
        OR prueba_autor.version_padron IS DISTINCT FROM padron.version
        OR prueba_persona.version_padron IS DISTINCT FROM padron.version THEN
        resultado_motivo := 'cedula_no_verificada';
      ELSIF privado.nombre_moderacion(concat_ws(' ', persona.nombre, persona.nombre2, persona.apellido1, persona.apellido2))
        IS DISTINCT FROM privado.nombre_moderacion(prueba_persona.nombre_tse) THEN
        resultado_motivo := 'nombre_inquilino_no_coincide';
      ELSE
        decision_final := 'aprobada';
      END IF;
    ELSIF resultado_valido AND p_resultado->>'decision' = 'segura' THEN
      resultado_motivo := 'resultado_invalido';
    END IF;
  END IF;

  version_final := actual.version;
  IF decision_final = 'aprobada' THEN
    -- Triggers existentes: historial, primera aprobación, crédito, activación y correo.
    -- No se afirma que los hechos relatados estén verificados.
    UPDATE public.resenas r SET estado = 'publicada', permite_correccion = false,
      actualizado_en = clock_timestamp() WHERE r.id = actual.id RETURNING r.version INTO version_final;
  END IF;
  INSERT INTO privado.moderacion_automatica_resenas
    (resena_id, version_evaluada, version_resultante, contenido_sha256, decision, motivo, modelo, politica, categorias, fecha_padron, version_padron)
  VALUES (actual.id, p_version, version_final,
    encode(sha256(convert_to(jsonb_build_array(p_comentario, p_detalle_dano)::text, 'UTF8')), 'hex'),
    decision_final, resultado_motivo, resultado_modelo, 'resenas-v1', resultado_categorias, padron.fecha_padron, padron.version);
  RETURN QUERY SELECT decision_final = 'aprobada', resultado_motivo, version_final;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_moderacion_automatica_resenas(p_admin_id integer, p_resena_ids integer[])
RETURNS TABLE (
  resena_id integer, version_evaluada integer, version_resultante integer, decision text,
  motivo text, modelo text, politica text, categorias text[], evaluada_en timestamptz
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = pg_catalog AS $$
  SELECT h.resena_id, h.version_evaluada, h.version_resultante, h.decision,
    h.motivo, h.modelo, h.politica, h.categorias, h.evaluada_en
  FROM public.usuarios u
  JOIN public.resenas r ON r.id = ANY(p_resena_ids[1:20])
  CROSS JOIN LATERAL (
    SELECT a.* FROM privado.moderacion_automatica_resenas a WHERE a.resena_id = r.id
      ORDER BY a.version_evaluada DESC LIMIT 1
  ) h
  WHERE u.id = p_admin_id AND u.rol = 'admin' AND u.activo;
$$;

REVOKE ALL ON FUNCTION privado.cedula_nacional_moderacion(text), privado.nombre_moderacion(text),
  public.resolver_moderacion_automatica_resena(bigint, integer, text, text, text, text, jsonb),
  public.admin_moderacion_automatica_resenas(integer, integer[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION privado.cedula_nacional_moderacion(text), privado.nombre_moderacion(text),
  public.resolver_moderacion_automatica_resena(bigint, integer, text, text, text, text, jsonb),
  public.admin_moderacion_automatica_resenas(integer, integer[]) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
