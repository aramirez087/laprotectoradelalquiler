BEGIN;

-- No new extension or changes to the stored identity. Search-only normalization.
CREATE OR REPLACE FUNCTION public.normalizar_nombre_busqueda(p_texto text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE SECURITY INVOKER SET search_path = pg_catalog AS $$
  SELECT trim(regexp_replace(translate(lower(normalize(coalesce(p_texto,''), NFKC)),
    'áéíóúüñ','aeiouun'), '[^[:alnum:]]+', ' ', 'g'));
$$;
CREATE OR REPLACE FUNCTION public.normalizar_documento_busqueda(p_texto text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE SECURITY INVOKER SET search_path = pg_catalog AS $$
  SELECT lower(regexp_replace(normalize(coalesce(p_texto,''), NFKC), '[[:space:].-]+', '', 'g'));
$$;

CREATE INDEX IF NOT EXISTS idx_personas_nombre_busqueda ON public.personas USING gin (
  to_tsvector('simple'::regconfig, public.normalizar_nombre_busqueda(
    nombre || ' ' || coalesce(nombre2,'') || ' ' || apellido1 || ' ' || coalesce(apellido2,''))));
CREATE INDEX IF NOT EXISTS idx_personas_documento_busqueda ON public.personas (
  public.normalizar_documento_busqueda(identificacion) text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_resenas_publicadas_persona ON public.resenas (persona_id, creado_en DESC) WHERE estado='publicada';

CREATE OR REPLACE FUNCTION public.buscar_fichas_relevantes(p_usuario_id integer, p_q text DEFAULT '', p_pagina integer DEFAULT 1)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = pg_catalog SET plan_cache_mode = force_custom_plan AS $$
DECLARE consulta text := trim(normalize(coalesce(p_q,''), NFKC));
  tipo text := 'nombre'; documento text; palabras text[]; prefijos tsquery; exactas tsquery; resultado jsonb;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.accesos_consulta(ARRAY[p_usuario_id]) WHERE puede_consultar) THEN
    RAISE EXCEPTION 'Consulta no autorizada' USING ERRCODE='42501'; END IF;
  IF p_pagina IS NULL OR p_pagina<1 OR p_pagina>100000 OR length(consulta)>150 THEN
    RAISE EXCEPTION 'Búsqueda inválida' USING ERRCODE='22023'; END IF;
  IF consulta='' THEN tipo := 'listado';
  ELSIF consulta ~ '^[0-9[:space:].-]+$' OR consulta ~* '^[a-z]{1,4}[[:space:].-]*[0-9][a-z0-9[:space:].-]*$' THEN
    tipo := 'documento'; documento := public.normalizar_documento_busqueda(consulta);
    IF length(documento)<4 THEN RETURN jsonb_build_object('total',0,'fichas','[]'::jsonb); END IF;
  ELSE
    consulta := public.normalizar_nombre_busqueda(consulta);
    SELECT array_agg(p) INTO palabras FROM unnest(string_to_array(consulta,' ')) p WHERE length(p)>=2;
    IF coalesce(array_length(palabras,1),0) NOT BETWEEN 1 AND 12 THEN
      RETURN jsonb_build_object('total',0,'fichas','[]'::jsonb); END IF;
    SELECT to_tsquery('simple',string_agg(quote_literal(p)||':*',' & ')),
      to_tsquery('simple',string_agg(quote_literal(p),' & ')) INTO prefijos,exactas FROM unnest(palabras) p;
  END IF;

  WITH candidatas AS MATERIALIZED (
    SELECT p.id,p.identificacion,p.nombre,p.nombre2,p.apellido1,p.apellido2,p.foto_url,
      CASE WHEN tipo='listado' THEN NULL
        WHEN tipo='documento' AND public.normalizar_documento_busqueda(p.identificacion)=documento THEN 'documento_exacto'
        WHEN tipo='documento' THEN 'documento_parcial'
        WHEN public.normalizar_nombre_busqueda(p.nombre||' '||coalesce(p.nombre2,'')||' '||p.apellido1||' '||coalesce(p.apellido2,''))=consulta THEN 'nombre_completo'
        WHEN to_tsvector('simple',public.normalizar_nombre_busqueda(p.nombre||' '||coalesce(p.nombre2,'')||' '||p.apellido1||' '||coalesce(p.apellido2,''))) @@ exactas THEN 'palabras_completas'
        ELSE 'nombre_parcial' END AS coincidencia,
      public.normalizar_nombre_busqueda(p.apellido1||' '||coalesce(p.apellido2,'')||' '||p.nombre||' '||coalesce(p.nombre2,'')) AS orden,
      CASE WHEN tipo='nombre' THEN cardinality(string_to_array(public.normalizar_nombre_busqueda(p.nombre||' '||coalesce(p.nombre2,'')||' '||p.apellido1||' '||coalesce(p.apellido2,'')),' ')) ELSE 0 END AS longitud_nombre
    FROM public.personas p
    WHERE EXISTS(SELECT 1 FROM public.resenas r WHERE r.persona_id=p.id AND r.estado='publicada')
      AND (tipo='listado'
        OR (tipo='documento' AND public.normalizar_documento_busqueda(p.identificacion) LIKE documento||'%')
        OR (tipo='nombre' AND to_tsvector('simple',public.normalizar_nombre_busqueda(p.nombre||' '||coalesce(p.nombre2,'')||' '||p.apellido1||' '||coalesce(p.apellido2,''))) @@ prefijos))
  ), pagina AS (
    SELECT c.* FROM candidatas c ORDER BY CASE c.coincidencia
      WHEN 'documento_exacto' THEN 0 WHEN 'nombre_completo' THEN 0
      WHEN 'palabras_completas' THEN 1 ELSE 2 END, c.longitud_nombre,c.orden,c.id
    LIMIT 20 OFFSET (p_pagina::bigint-1)*20
  )
  SELECT jsonb_build_object('total',(SELECT count(*) FROM candidatas),
    'fichas',coalesce((SELECT jsonb_agg(jsonb_build_object(
      'persona',jsonb_build_object('id',s.id,'identificacion',s.identificacion,'nombre',s.nombre,'nombre2',s.nombre2,
        'apellido1',s.apellido1,'apellido2',s.apellido2,'foto_url',s.foto_url),
      'coincidencia',s.coincidencia,'resenas',r.cantidad,'ultima',r.ultima)
      ORDER BY CASE s.coincidencia WHEN 'documento_exacto' THEN 0 WHEN 'nombre_completo' THEN 0 WHEN 'palabras_completas' THEN 1 ELSE 2 END,s.longitud_nombre,s.orden,s.id)
      FROM pagina s CROSS JOIN LATERAL (
        SELECT count(*) AS cantidad,max(creado_en) AS ultima FROM public.resenas WHERE persona_id=s.id AND estado='publicada'
      ) r),'[]'::jsonb)) INTO resultado;
  RETURN resultado;
END;
$$;

-- Only outcome receipts; no query, document, person ID, URL or review content.
CREATE TABLE IF NOT EXISTS privado.resultados_busqueda (
  id uuid PRIMARY KEY,
  usuario_id integer NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  iniciada_en timestamptz NOT NULL,
  tipo text NOT NULL CHECK(tipo IN ('nombre','documento')),
  con_resultados boolean NOT NULL,
  abrio_ficha boolean NOT NULL DEFAULT false CHECK(NOT abrio_ficha OR con_resultados)
);
CREATE INDEX IF NOT EXISTS idx_resultados_busqueda_fecha ON privado.resultados_busqueda(iniciada_en,usuario_id);
ALTER TABLE privado.resultados_busqueda ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE privado.resultados_busqueda FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE privado.resultados_busqueda TO service_role;

CREATE TABLE IF NOT EXISTS privado.busqueda_config (
  id boolean PRIMARY KEY DEFAULT true CHECK(id), iniciada_en timestamptz NOT NULL DEFAULT clock_timestamp()
);
INSERT INTO privado.busqueda_config(id) VALUES(true) ON CONFLICT DO NOTHING;
ALTER TABLE privado.busqueda_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE privado.busqueda_config FROM PUBLIC,anon,authenticated;
GRANT SELECT ON TABLE privado.busqueda_config TO service_role;

CREATE OR REPLACE FUNCTION public.registrar_resultado_busqueda(p_usuario_id integer,p_id uuid,p_iniciada_en timestamptz,
  p_tipo text,p_con_resultados boolean,p_abrio_ficha boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN
  IF p_id IS NULL OR p_iniciada_en IS NULL OR p_iniciada_en>clock_timestamp()+interval '5 seconds'
    OR p_iniciada_en<clock_timestamp()-interval '30 minutes' OR p_tipo IS NULL OR p_tipo NOT IN ('nombre','documento')
    OR p_con_resultados IS NULL OR p_abrio_ficha IS NULL OR (p_abrio_ficha AND NOT p_con_resultados) THEN
    RAISE EXCEPTION 'Resultado inválido' USING ERRCODE='22023'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.usuarios WHERE id=p_usuario_id AND activo AND rol IN ('propietario','agencia'))
    OR NOT EXISTS(SELECT 1 FROM public.accesos_consulta(ARRAY[p_usuario_id]) WHERE puede_consultar) THEN
    RAISE EXCEPTION 'Consulta no autorizada' USING ERRCODE='42501'; END IF;
  INSERT INTO privado.resultados_busqueda(id,usuario_id,iniciada_en,tipo,con_resultados,abrio_ficha)
    VALUES(p_id,p_usuario_id,p_iniciada_en,p_tipo,p_con_resultados,p_abrio_ficha)
    ON CONFLICT(id) DO UPDATE SET abrio_ficha=privado.resultados_busqueda.abrio_ficha OR EXCLUDED.abrio_ficha
      WHERE privado.resultados_busqueda.usuario_id=EXCLUDED.usuario_id
        AND privado.resultados_busqueda.iniciada_en=EXCLUDED.iniciada_en
        AND privado.resultados_busqueda.tipo=EXCLUDED.tipo AND privado.resultados_busqueda.con_resultados=EXCLUDED.con_resultados;
  DELETE FROM privado.resultados_busqueda WHERE iniciada_en<clock_timestamp()-interval '90 days';
END;
$$;

CREATE OR REPLACE FUNCTION public.resumen_resultados_busqueda(p_admin_id integer,p_dias integer DEFAULT 7)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE hasta timestamptz := date_trunc('day',clock_timestamp() AT TIME ZONE 'America/Costa_Rica') AT TIME ZONE 'America/Costa_Rica';
  desde timestamptz; resultado jsonb;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.usuarios WHERE id=p_admin_id AND activo AND rol='admin') THEN
    RAISE EXCEPTION 'Administración no autorizada' USING ERRCODE='42501'; END IF;
  IF p_dias IS NULL OR p_dias NOT IN (7,28) THEN RAISE EXCEPTION 'Período inválido' USING ERRCODE='22023'; END IF;
  desde := hasta - make_interval(days=>p_dias);
  DELETE FROM privado.resultados_busqueda WHERE iniciada_en<clock_timestamp()-interval '90 days';
  WITH eventos AS MATERIALIZED (
    SELECT * FROM privado.resultados_busqueda WHERE iniciada_en>=desde AND iniciada_en<hasta
  ), miembros AS (
    SELECT usuario_id,bool_or(abrio_ficha) AS abrio,
      count(DISTINCT (iniciada_en AT TIME ZONE 'America/Costa_Rica')::date)>1 AS regreso
    FROM eventos GROUP BY usuario_id
  )
  SELECT jsonb_build_object('busquedas',count(*),'sin_resultados',count(*) FILTER(WHERE NOT con_resultados),
    'con_resultados',count(*) FILTER(WHERE con_resultados),'con_apertura',count(*) FILTER(WHERE abrio_ficha),
    'miembros',(SELECT count(*) FROM miembros),'miembros_con_apertura',(SELECT count(*) FROM miembros WHERE abrio),
    'miembros_recurrentes',(SELECT count(*) FROM miembros WHERE regreso),
    'documentos',count(*) FILTER(WHERE tipo='documento'),'nombres',count(*) FILTER(WHERE tipo='nombre'),
    'desde',desde,'hasta',hasta,'iniciada_en',(SELECT iniciada_en FROM privado.busqueda_config WHERE id))
  INTO resultado FROM eventos;
  RETURN resultado;
END;
$$;

-- Reuse the existing five-minute cleanup worker so retention holds without traffic.
CREATE OR REPLACE FUNCTION public.limpiar_datos_activacion()
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $$
BEGIN
  UPDATE privado.borradores_resena SET datos=NULL,version=gen_random_uuid()
    WHERE datos IS NOT NULL AND actualizado_en<=clock_timestamp()-interval '30 days';
  DELETE FROM privado.avisos_moderacion WHERE estado IN ('enviada','omitida') AND creado_en<clock_timestamp()-interval '30 days';
  DELETE FROM privado.resultados_busqueda WHERE iniciada_en<clock_timestamp()-interval '90 days';
END;
$$;
REVOKE ALL ON FUNCTION public.limpiar_datos_activacion() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.limpiar_datos_activacion() TO service_role;

REVOKE ALL ON FUNCTION public.normalizar_nombre_busqueda(text),public.normalizar_documento_busqueda(text),
  public.buscar_fichas_relevantes(integer,text,integer),
  public.registrar_resultado_busqueda(integer,uuid,timestamptz,text,boolean,boolean),
  public.resumen_resultados_busqueda(integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.normalizar_nombre_busqueda(text),public.normalizar_documento_busqueda(text),
  public.buscar_fichas_relevantes(integer,text,integer),
  public.registrar_resultado_busqueda(integer,uuid,timestamptz,text,boolean,boolean),
  public.resumen_resultados_busqueda(integer,integer) TO service_role;

COMMIT;
