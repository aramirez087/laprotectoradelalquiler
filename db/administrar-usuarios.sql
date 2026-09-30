-- Migración aditiva: cambios de cuentas atómicos y trazables. Conserva los datos.
BEGIN;

CREATE SCHEMA IF NOT EXISTS privado;
REVOKE ALL ON SCHEMA privado FROM PUBLIC;

CREATE TABLE IF NOT EXISTS privado.administracion_usuarios_historial (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id integer REFERENCES public.usuarios(id) ON DELETE SET NULL,
  usuario_id integer REFERENCES public.usuarios(id) ON DELETE SET NULL,
  actor_nombre text NOT NULL,
  usuario_nombre text NOT NULL,
  accion text NOT NULL CHECK (length(trim(accion)) BETWEEN 1 AND 80),
  antes jsonb,
  despues jsonb,
  creado_en timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS idx_administracion_usuarios_historial_usuario
  ON privado.administracion_usuarios_historial(usuario_id, creado_en DESC, id DESC);
ALTER TABLE privado.administracion_usuarios_historial ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE privado.administracion_usuarios_historial FROM PUBLIC;
REVOKE ALL ON SEQUENCE privado.administracion_usuarios_historial_id_seq FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.admin_actualizar_usuario(
  p_admin_id integer, p_id integer, p_rol text, p_activo boolean,
  p_version_esperada timestamptz
)
RETURNS TABLE(id integer, nombre text, actualizado_en timestamptz)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $$
DECLARE
  actor public.usuarios%ROWTYPE;
  objetivo public.usuarios%ROWTYPE;
  nueva_version timestamptz;
BEGIN
  -- Toda mutación de permisos y aceptación de invitaciones comparte este bloqueo.
  PERFORM pg_advisory_xact_lock(hashtextextended('administracion_usuarios', 0));
  SELECT u.* INTO actor FROM public.usuarios u
    WHERE u.id = p_admin_id AND u.rol = 'admin' AND u.activo FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No puede administrar usuarios con esta cuenta.'; END IF;
  SELECT u.* INTO objetivo FROM public.usuarios u WHERE u.id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No encontramos esa cuenta.'; END IF;
  IF p_version_esperada IS NULL OR objetivo.actualizado_en IS DISTINCT FROM p_version_esperada THEN
    RAISE EXCEPTION 'Esta cuenta cambió desde que la abrió. Actualice la página y revise los cambios.';
  END IF;
  IF p_rol IS NULL OR p_rol NOT IN ('admin', 'propietario', 'agencia', 'inquilino') OR p_activo IS NULL THEN
    RAISE EXCEPTION 'Revise los permisos de la cuenta.';
  END IF;
  IF p_rol = 'inquilino' AND objetivo.rol <> 'inquilino' THEN
    RAISE EXCEPTION 'El rol histórico de inquilino solo puede conservarse en cuentas existentes.';
  END IF;
  IF p_rol = 'admin' AND objetivo.rol <> 'admin' THEN
    RAISE EXCEPTION 'Para conceder administración, envíe una invitación de acceso.';
  END IF;
  IF p_id = p_admin_id AND (p_rol <> 'admin' OR NOT p_activo) THEN
    RAISE EXCEPTION 'No puede quitarse el acceso de administración.';
  END IF;
  IF objetivo.rol = 'admin' AND objetivo.activo AND (p_rol <> 'admin' OR NOT p_activo)
    AND NOT EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id <> p_id AND u.rol = 'admin' AND u.activo)
  THEN
    RAISE EXCEPTION 'Debe quedar al menos una cuenta de administración activa.';
  END IF;
  IF objetivo.rol = p_rol AND objetivo.activo = p_activo THEN
    RETURN QUERY SELECT objetivo.id, objetivo.nombre, objetivo.actualizado_en;
    RETURN;
  END IF;

  nueva_version := greatest(clock_timestamp(), objetivo.actualizado_en + interval '1 microsecond');
  UPDATE public.usuarios u SET rol = p_rol, activo = p_activo, actualizado_en = nueva_version
    WHERE u.id = p_id;
  INSERT INTO privado.administracion_usuarios_historial
    (actor_id, usuario_id, actor_nombre, usuario_nombre, accion, antes, despues)
  VALUES (actor.id, objetivo.id, actor.nombre, objetivo.nombre, 'permisos',
    jsonb_build_object('rol', objetivo.rol, 'activo', objetivo.activo),
    jsonb_build_object('rol', p_rol, 'activo', p_activo));
  RETURN QUERY SELECT objetivo.id, objetivo.nombre, nueva_version;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_actualizar_perfil_usuario(
  p_admin_id integer, p_id integer, p_nombre text, p_identificacion text,
  p_telefono text, p_version_esperada timestamptz
)
RETURNS TABLE(id integer, nombre text, actualizado_en timestamptz)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $$
DECLARE
  actor public.usuarios%ROWTYPE;
  objetivo public.usuarios%ROWTYPE;
  nombre_nuevo text := btrim(p_nombre);
  identificacion_nueva text := nullif(btrim(p_identificacion), '');
  telefono_nuevo text := nullif(btrim(p_telefono), '');
  nueva_version timestamptz;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('administracion_usuarios', 0));
  SELECT u.* INTO actor FROM public.usuarios u
    WHERE u.id = p_admin_id AND u.rol = 'admin' AND u.activo FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No puede administrar usuarios con esta cuenta.'; END IF;
  SELECT u.* INTO objetivo FROM public.usuarios u WHERE u.id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No encontramos esa cuenta.'; END IF;
  IF p_version_esperada IS NULL OR objetivo.actualizado_en IS DISTINCT FROM p_version_esperada THEN
    RAISE EXCEPTION 'Esta cuenta cambió desde que la abrió. Actualice la página y revise los cambios.';
  END IF;
  IF nombre_nuevo IS NULL OR char_length(nombre_nuevo) NOT BETWEEN 3 AND 150
    OR char_length(telefono_nuevo) > 30
  THEN
    RAISE EXCEPTION 'Revise el nombre y el teléfono de la cuenta.';
  END IF;
  -- Los documentos históricos pueden conservarse sin inventar un documento nuevo.
  IF identificacion_nueva IS DISTINCT FROM objetivo.identificacion AND identificacion_nueva IS NOT NULL THEN
    IF identificacion_nueva !~ '^[0-9 -]+$'
      OR regexp_replace(identificacion_nueva, '[^0-9]', '', 'g') !~ '^[0-9]{6,12}$'
    THEN
      RAISE EXCEPTION 'Escriba una cédula de 6 a 12 dígitos, o deje el campo vacío.';
    END IF;
    identificacion_nueva := regexp_replace(identificacion_nueva, '[^0-9]', '', 'g');
    IF EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id <> p_id
      AND regexp_replace(coalesce(u.identificacion, ''), '[^0-9]', '', 'g') = identificacion_nueva)
    THEN
      RAISE EXCEPTION 'Esa cédula ya pertenece a otra cuenta.';
    END IF;
  END IF;
  IF nombre_nuevo = objetivo.nombre
    AND identificacion_nueva IS NOT DISTINCT FROM objetivo.identificacion
    AND telefono_nuevo IS NOT DISTINCT FROM objetivo.telefono
  THEN
    RETURN QUERY SELECT objetivo.id, objetivo.nombre, objetivo.actualizado_en;
    RETURN;
  END IF;
  nueva_version := greatest(clock_timestamp(), objetivo.actualizado_en + interval '1 microsecond');
  UPDATE public.usuarios u SET nombre = nombre_nuevo, identificacion = identificacion_nueva,
    telefono = telefono_nuevo, actualizado_en = nueva_version WHERE u.id = p_id;
  INSERT INTO privado.administracion_usuarios_historial
    (actor_id, usuario_id, actor_nombre, usuario_nombre, accion, antes, despues)
  VALUES (actor.id, objetivo.id, actor.nombre, nombre_nuevo, 'perfil',
    jsonb_build_object('nombre', objetivo.nombre, 'identificacion', objetivo.identificacion, 'telefono', objetivo.telefono),
    jsonb_build_object('nombre', nombre_nuevo, 'identificacion', identificacion_nueva, 'telefono', telefono_nuevo));
  RETURN QUERY SELECT objetivo.id, nombre_nuevo, nueva_version;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_historial_usuario(
  p_admin_id integer, p_usuario_id integer, p_limite integer DEFAULT 20
)
RETURNS SETOF privado.administracion_usuarios_historial
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = p_admin_id AND u.rol = 'admin' AND u.activo) THEN
    RAISE EXCEPTION 'No puede administrar usuarios con esta cuenta.';
  END IF;
  RETURN QUERY SELECT h.* FROM privado.administracion_usuarios_historial h
    WHERE h.usuario_id = p_usuario_id
    ORDER BY h.creado_en DESC, h.id DESC LIMIT greatest(1, least(coalesce(p_limite, 20), 100));
END;
$$;

REVOKE ALL ON FUNCTION public.admin_actualizar_usuario(integer, integer, text, boolean, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_actualizar_perfil_usuario(integer, integer, text, text, text, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_historial_usuario(integer, integer, integer) FROM PUBLIC;
DO $$
DECLARE rol_db text;
BEGIN
  FOREACH rol_db IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = rol_db) THEN
      EXECUTE format('REVOKE ALL ON TABLE privado.administracion_usuarios_historial FROM %I', rol_db);
      EXECUTE format('REVOKE ALL ON SEQUENCE privado.administracion_usuarios_historial_id_seq FROM %I', rol_db);
      EXECUTE format('REVOKE ALL ON FUNCTION public.admin_actualizar_usuario(integer, integer, text, boolean, timestamptz) FROM %I', rol_db);
      EXECUTE format('REVOKE ALL ON FUNCTION public.admin_actualizar_perfil_usuario(integer, integer, text, text, text, timestamptz) FROM %I', rol_db);
      EXECUTE format('REVOKE ALL ON FUNCTION public.admin_historial_usuario(integer, integer, integer) FROM %I', rol_db);
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT USAGE ON SCHEMA privado TO service_role;
    REVOKE ALL ON TABLE privado.administracion_usuarios_historial FROM service_role;
    REVOKE ALL ON SEQUENCE privado.administracion_usuarios_historial_id_seq FROM service_role;
    GRANT SELECT, INSERT ON TABLE privado.administracion_usuarios_historial TO service_role;
    GRANT USAGE ON SEQUENCE privado.administracion_usuarios_historial_id_seq TO service_role;
    GRANT EXECUTE ON FUNCTION public.admin_actualizar_usuario(integer, integer, text, boolean, timestamptz) TO service_role;
    GRANT EXECUTE ON FUNCTION public.admin_actualizar_perfil_usuario(integer, integer, text, text, text, timestamptz) TO service_role;
    GRANT EXECUTE ON FUNCTION public.admin_historial_usuario(integer, integer, integer) TO service_role;
  END IF;
END;
$$;
NOTIFY pgrst, 'reload schema';
COMMIT;
