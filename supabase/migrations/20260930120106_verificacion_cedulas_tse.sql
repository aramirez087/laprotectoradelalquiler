-- Manifiesto del índice privado del TSE. Los millones de nombres viven en Storage.
BEGIN;
CREATE TABLE IF NOT EXISTS public.padron_tse (
  id smallint PRIMARY KEY CHECK (id = 1),
  version text NOT NULL CHECK (version ~ '^\d{4}-\d{2}-\d{2}-[a-f0-9]{16}$'),
  fecha_padron date NOT NULL,
  prefijos text[] NOT NULL,
  registros integer NOT NULL CHECK (registros >= 3000000),
  sha256 text NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.padron_tse ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.limites_consulta_padron (
  clave text PRIMARY KEY CHECK (clave ~ '^[a-f0-9]{64}$'),
  ventana timestamptz NOT NULL,
  consultas integer NOT NULL
);
ALTER TABLE public.limites_consulta_padron ENABLE ROW LEVEL SECURITY;

-- El padrón incluye nombres y apellidos legales de una sola letra.
CREATE OR REPLACE FUNCTION public.admin_editar_resena(
  p_admin_id integer, p_id integer, p_identificacion text,
  p_nombre text, p_nombre2 text, p_apellido1 text, p_apellido2 text,
  p_comentario text, p_anonima boolean
)
RETURNS TABLE (
  persona_id integer, persona_anterior_id integer, movida boolean,
  autor_email text, autor_nombre text
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  actual record;
  documento text := regexp_replace(btrim(p_identificacion), '\s+', '', 'g');
  digitos text := regexp_replace(documento, '[^0-9]', '', 'g');
  destino integer;
  otras boolean;
BEGIN
  PERFORM 1 FROM public.usuarios u WHERE u.id = p_admin_id AND u.rol = 'admin' AND u.activo FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No puede administrar reseñas con esta cuenta.'; END IF;

  SELECT r.persona_id, p.identificacion, u.email, u.nombre AS autor_nombre
    INTO actual
    FROM public.resenas r
    JOIN public.personas p ON p.id = r.persona_id
    JOIN public.usuarios u ON u.id = r.autor_id
    WHERE r.id = p_id
    FOR UPDATE OF r, p;
  IF NOT FOUND THEN RAISE EXCEPTION 'No encontramos esa reseña.'; END IF;

  -- Los documentos legacy se conservan al corregir otros campos.
  IF documento IS NULL OR (documento <> regexp_replace(btrim(actual.identificacion), '\s+', '', 'g')
      AND length(digitos) NOT BETWEEN 6 AND 12) THEN
    RAISE EXCEPTION 'Escriba un documento de 6 a 12 dígitos; puede incluir guiones.';
  END IF;

  IF p_nombre IS NULL OR length(btrim(p_nombre)) < 1 OR p_apellido1 IS NULL OR length(btrim(p_apellido1)) < 1
      OR p_comentario IS NULL OR length(btrim(p_comentario)) NOT BETWEEN 1 AND 5000 THEN
    RAISE EXCEPTION 'Revise los campos indicados.';
  END IF;

  destino := actual.persona_id;
  IF documento = regexp_replace(btrim(actual.identificacion), '\s+', '', 'g')
      OR (length(digitos) BETWEEN 6 AND 12 AND digitos = regexp_replace(actual.identificacion, '[^0-9]', '', 'g')) THEN
    -- Al conservar la identidad solo se corrigen sus datos.
    UPDATE public.personas p SET identificacion = documento, nombre = btrim(p_nombre),
      nombre2 = nullif(btrim(p_nombre2), ''), apellido1 = btrim(p_apellido1),
      apellido2 = nullif(btrim(p_apellido2), ''), actualizado_en = now()
      WHERE p.id = destino;
  ELSE
    SELECT p.id INTO destino FROM public.personas p
      WHERE p.identificacion = documento OR regexp_replace(p.identificacion, '[^0-9]', '', 'g') = digitos
      ORDER BY (p.identificacion = documento) DESC, p.id
      LIMIT 1 FOR UPDATE;
    IF destino IS NULL THEN
      SELECT EXISTS(SELECT 1 FROM public.resenas r WHERE r.persona_id = actual.persona_id AND r.id <> p_id) INTO otras;
      IF otras THEN
        INSERT INTO public.personas (identificacion, nombre, nombre2, apellido1, apellido2)
          VALUES (documento, btrim(p_nombre), nullif(btrim(p_nombre2), ''), btrim(p_apellido1), nullif(btrim(p_apellido2), ''))
          ON CONFLICT (identificacion) DO NOTHING
          RETURNING id INTO destino;
        IF destino IS NULL THEN
          SELECT p.id INTO destino FROM public.personas p WHERE p.identificacion = documento FOR UPDATE;
        END IF;
      ELSE
        destino := actual.persona_id;
        UPDATE public.personas p SET identificacion = documento, nombre = btrim(p_nombre),
          nombre2 = nullif(btrim(p_nombre2), ''), apellido1 = btrim(p_apellido1),
          apellido2 = nullif(btrim(p_apellido2), ''), actualizado_en = now()
          WHERE p.id = destino;
      END IF;
    END IF;
  END IF;

  UPDATE public.resenas r SET persona_id = destino, comentario = btrim(p_comentario),
    anonima = coalesce(p_anonima, false), actualizado_en = now() WHERE r.id = p_id;
  RETURN QUERY SELECT destino, actual.persona_id, destino <> actual.persona_id, actual.email, actual.autor_nombre;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_editar_resena(integer, integer, text, text, text, text, text, text, boolean) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.publicar_padron_tse(
  p_version text, p_fecha date, p_prefijos text[], p_registros integer, p_sha256 text
) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS $$
BEGIN
  IF p_fecha > current_date OR cardinality(p_prefijos) < 1
    OR EXISTS (SELECT FROM unnest(p_prefijos) p WHERE p !~ '^[1-9]\d{2}$')
    OR p_version <> p_fecha::text || '-' || left(p_sha256, 16) THEN
    RAISE EXCEPTION 'Manifiesto del padrón inválido.';
  END IF;
  INSERT INTO public.padron_tse AS actual (id, version, fecha_padron, prefijos, registros, sha256)
  VALUES (1, p_version, p_fecha, p_prefijos, p_registros, p_sha256)
  ON CONFLICT (id) DO UPDATE SET version = excluded.version, fecha_padron = excluded.fecha_padron,
    prefijos = excluded.prefijos, registros = excluded.registros, sha256 = excluded.sha256, actualizado_en = now()
  WHERE actual.fecha_padron <= excluded.fecha_padron;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.consumir_consulta_padron(p_clave text) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS $$
DECLARE cantidad integer;
BEGIN
  DELETE FROM public.limites_consulta_padron WHERE ventana < now() - interval '20 minutes';
  INSERT INTO public.limites_consulta_padron AS l (clave, ventana, consultas)
  VALUES (p_clave, now(), 1)
  ON CONFLICT (clave) DO UPDATE SET
    ventana = CASE WHEN l.ventana <= now() - interval '10 minutes' THEN now() ELSE l.ventana END,
    consultas = CASE WHEN l.ventana <= now() - interval '10 minutes' THEN 1 ELSE least(l.consultas + 1, 31) END
  RETURNING consultas INTO cantidad;
  RETURN cantidad <= 30;
END;
$$;

REVOKE ALL ON FUNCTION public.consumir_consulta_padron(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.publicar_padron_tse(text, date, text[], integer, text) FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON public.padron_tse, public.limites_consulta_padron FROM anon;
    REVOKE ALL ON FUNCTION public.admin_editar_resena(integer, integer, text, text, text, text, text, text, boolean) FROM anon;
    REVOKE ALL ON FUNCTION public.consumir_consulta_padron(text) FROM anon;
    REVOKE ALL ON FUNCTION public.publicar_padron_tse(text, date, text[], integer, text) FROM anon;
  END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON public.padron_tse, public.limites_consulta_padron FROM authenticated;
    REVOKE ALL ON FUNCTION public.admin_editar_resena(integer, integer, text, text, text, text, text, text, boolean) FROM authenticated;
    REVOKE ALL ON FUNCTION public.consumir_consulta_padron(text) FROM authenticated;
    REVOKE ALL ON FUNCTION public.publicar_padron_tse(text, date, text[], integer, text) FROM authenticated;
  END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.padron_tse, public.limites_consulta_padron TO service_role;
    GRANT EXECUTE ON FUNCTION public.admin_editar_resena(integer, integer, text, text, text, text, text, text, boolean) TO service_role;
    GRANT EXECUTE ON FUNCTION public.consumir_consulta_padron(text) TO service_role;
    GRANT EXECUTE ON FUNCTION public.publicar_padron_tse(text, date, text[], integer, text) TO service_role;
  END IF;
END;
$$;
COMMIT;
