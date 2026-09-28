-- Edición y eliminación atómicas, accesibles solo al servidor (service_role).
-- La identidad del administrador viene de la sesión validada en lib/admin.ts.
BEGIN;

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

  IF p_nombre IS NULL OR length(btrim(p_nombre)) < 2 OR p_apellido1 IS NULL OR length(btrim(p_apellido1)) < 2
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

CREATE OR REPLACE FUNCTION public.admin_eliminar_resena(p_admin_id integer, p_id integer)
RETURNS TABLE (persona_id integer, autor_email text, autor_nombre text)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
BEGIN
  PERFORM 1 FROM public.usuarios u WHERE u.id = p_admin_id AND u.rol = 'admin' AND u.activo FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No puede administrar reseñas con esta cuenta.'; END IF;

  RETURN QUERY DELETE FROM public.resenas r USING public.usuarios u
    WHERE r.id = p_id AND u.id = r.autor_id
    RETURNING r.persona_id, u.email, u.nombre;
  IF NOT FOUND THEN RAISE EXCEPTION 'No encontramos esa reseña.'; END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_editar_resena(integer, integer, text, text, text, text, text, text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_eliminar_resena(integer, integer) FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION public.admin_editar_resena(integer, integer, text, text, text, text, text, text, boolean) FROM anon;
    REVOKE ALL ON FUNCTION public.admin_eliminar_resena(integer, integer) FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON FUNCTION public.admin_editar_resena(integer, integer, text, text, text, text, text, text, boolean) FROM authenticated;
    REVOKE ALL ON FUNCTION public.admin_eliminar_resena(integer, integer) FROM authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.admin_editar_resena(integer, integer, text, text, text, text, text, text, boolean) TO service_role;
    GRANT EXECUTE ON FUNCTION public.admin_eliminar_resena(integer, integer) TO service_role;
  END IF;
END;
$$;
NOTIFY pgrst, 'reload schema';
COMMIT;
