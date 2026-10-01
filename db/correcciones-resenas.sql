-- Correcciones autorizadas por moderación. Conserva una sola reseña por autor
-- e inquilino, su primera aprobación y todas las versiones desde esta migración.
BEGIN;

ALTER TABLE public.resenas
  ADD COLUMN IF NOT EXISTS permite_correccion boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
ALTER TABLE public.resenas DROP CONSTRAINT IF EXISTS resenas_correccion_autorizada;
ALTER TABLE public.resenas ADD CONSTRAINT resenas_correccion_autorizada CHECK (
  NOT permite_correccion OR (estado = 'oculta' AND length(btrim(coalesce(detalle_verificacion, ''))) > 0)
);

CREATE SCHEMA IF NOT EXISTS privado;
REVOKE ALL ON SCHEMA privado FROM PUBLIC;
CREATE TABLE IF NOT EXISTS privado.historial_resenas (
  resena_id integer NOT NULL REFERENCES public.resenas(id) ON DELETE CASCADE,
  version integer NOT NULL,
  persona_id integer NOT NULL,
  comentario text,
  anonima boolean NOT NULL,
  estado text NOT NULL,
  detalle_verificacion text,
  permite_correccion boolean NOT NULL,
  guardado_en timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (resena_id, version)
);
ALTER TABLE privado.historial_resenas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE privado.historial_resenas FROM PUBLIC;

CREATE OR REPLACE FUNCTION privado.archivar_version_resena()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
BEGIN
  INSERT INTO privado.historial_resenas
    (resena_id, version, persona_id, comentario, anonima, estado, detalle_verificacion, permite_correccion)
  VALUES (OLD.id, OLD.version, OLD.persona_id, OLD.comentario, OLD.anonima,
    OLD.estado, OLD.detalle_verificacion, OLD.permite_correccion);
  NEW.version := OLD.version + 1;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION privado.archivar_version_resena() FROM PUBLIC;
DROP TRIGGER IF EXISTS trg_resenas_historial ON public.resenas;
CREATE TRIGGER trg_resenas_historial BEFORE UPDATE ON public.resenas
  FOR EACH ROW EXECUTE FUNCTION privado.archivar_version_resena();

-- Solo el servidor llama estas funciones, después de validar la sesión.
-- La identidad del actor siempre viene de la sesión, nunca del formulario.
CREATE OR REPLACE FUNCTION public.corregir_resena(
  p_autor_id integer, p_id integer, p_version integer, p_comentario text, p_anonima boolean
)
RETURNS TABLE (persona_id integer)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
DECLARE actual public.resenas%ROWTYPE;
BEGIN
  PERFORM 1 FROM public.usuarios u WHERE u.id = p_autor_id AND u.activo FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Su cuenta está inactiva y no puede reenviar reseñas.'; END IF;
  SELECT r.* INTO actual FROM public.resenas r
    WHERE r.id = p_id AND r.autor_id = p_autor_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No encontramos esa reseña en su cuenta.'; END IF;
  IF p_version IS NULL OR actual.version <> p_version THEN
    RAISE EXCEPTION 'La reseña cambió desde que la abrió. Vuelva a su perfil y revise su estado.';
  END IF;
  IF actual.estado <> 'oculta' OR NOT actual.permite_correccion THEN
    RAISE EXCEPTION 'Esta reseña no admite correcciones. Revise su estado en el perfil.';
  END IF;
  IF p_comentario IS NULL OR length(btrim(p_comentario)) NOT BETWEEN 30 AND 5000 OR p_anonima IS NULL THEN
    RAISE EXCEPTION 'Revise el relato: debe tener entre 30 y 5000 caracteres.';
  END IF;
  IF btrim(p_comentario) = btrim(coalesce(actual.comentario, '')) AND p_anonima = actual.anonima THEN
    RAISE EXCEPTION 'Corrija el relato o la opción de anonimato antes de reenviar.';
  END IF;
  UPDATE public.resenas r SET comentario = btrim(p_comentario), anonima = p_anonima,
    estado = 'borrador', permite_correccion = false, verificada = false
    WHERE r.id = actual.id;
  -- No cambia persona, autor, fecha de creación ni primera aprobación.
  RETURN QUERY SELECT actual.persona_id;
END;
$$;

-- El bloqueo y la comparación evitan sobrescribir una corrección recién enviada
-- con el contenido de un formulario administrativo antiguo.
CREATE OR REPLACE FUNCTION public.admin_editar_resena_versionada(
  p_admin_id integer, p_id integer, p_identificacion text,
  p_nombre text, p_nombre2 text, p_apellido1 text, p_apellido2 text,
  p_comentario text, p_anonima boolean, p_version integer
)
RETURNS TABLE (
  persona_id integer, persona_anterior_id integer, movida boolean,
  autor_email text, autor_nombre text
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
DECLARE actual integer;
BEGIN
  PERFORM 1 FROM public.usuarios u WHERE u.id = p_admin_id AND u.rol = 'admin' AND u.activo FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No puede administrar reseñas con esta cuenta.'; END IF;
  SELECT r.version INTO actual FROM public.resenas r WHERE r.id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No encontramos esa reseña.'; END IF;
  IF p_version IS NULL OR actual <> p_version THEN
    RAISE EXCEPTION 'La reseña cambió desde que la abrió. Actualice la página y revise los cambios.';
  END IF;
  RETURN QUERY SELECT * FROM public.admin_editar_resena(p_admin_id, p_id, p_identificacion,
    p_nombre, p_nombre2, p_apellido1, p_apellido2, p_comentario, p_anonima);
END;
$$;

CREATE OR REPLACE FUNCTION public.historial_resenas(p_usuario_id integer, p_resena_ids integer[])
RETURNS TABLE (
  resena_id integer, version integer, comentario text, anonima boolean, estado text,
  detalle_verificacion text, permite_correccion boolean, guardado_en timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
  SELECT h.resena_id, h.version, h.comentario, h.anonima, h.estado,
    h.detalle_verificacion, h.permite_correccion, h.guardado_en
  FROM public.usuarios u
  JOIN public.resenas r ON (u.rol = 'admin' OR r.autor_id = u.id)
  CROSS JOIN LATERAL (
    SELECT v.* FROM privado.historial_resenas v WHERE v.resena_id = r.id
      ORDER BY v.version DESC LIMIT 10
  ) h
  WHERE u.id = p_usuario_id AND u.activo
    AND r.id = ANY(p_resena_ids[1:20])
  ORDER BY h.resena_id, h.version DESC;
$$;

REVOKE ALL ON FUNCTION public.corregir_resena(integer, integer, integer, text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_editar_resena_versionada(integer, integer, text, text, text, text, text, text, boolean, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.historial_resenas(integer, integer[]) FROM PUBLIC;
DO $$
DECLARE rol text;
BEGIN
  FOREACH rol IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = rol) THEN
      EXECUTE format('REVOKE ALL ON TABLE privado.historial_resenas FROM %I', rol);
      EXECUTE format('REVOKE ALL ON FUNCTION privado.archivar_version_resena() FROM %I', rol);
      EXECUTE format('REVOKE ALL ON FUNCTION public.corregir_resena(integer, integer, integer, text, boolean) FROM %I', rol);
      EXECUTE format('REVOKE ALL ON FUNCTION public.admin_editar_resena_versionada(integer, integer, text, text, text, text, text, text, boolean, integer) FROM %I', rol);
      EXECUTE format('REVOKE ALL ON FUNCTION public.historial_resenas(integer, integer[]) FROM %I', rol);
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT USAGE ON SCHEMA privado TO service_role;
    GRANT SELECT, INSERT ON TABLE privado.historial_resenas TO service_role;
    GRANT EXECUTE ON FUNCTION public.corregir_resena(integer, integer, integer, text, boolean) TO service_role;
    GRANT EXECUTE ON FUNCTION public.admin_editar_resena_versionada(integer, integer, text, text, text, text, text, text, boolean, integer) TO service_role;
    GRANT EXECUTE ON FUNCTION public.historial_resenas(integer, integer[]) TO service_role;
  END IF;
END;
$$;
NOTIFY pgrst, 'reload schema';
COMMIT;
