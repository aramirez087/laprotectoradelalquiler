-- Additive migration; apply administrar-usuarios.sql first.
-- Mailbox verification and session revocation precede every acceptance.
BEGIN;
CREATE TABLE IF NOT EXISTS public.invitaciones_admin (
  id uuid PRIMARY KEY,
  email text NOT NULL CHECK (email = lower(email)),
  nombre text NOT NULL,
  auth_user_id uuid NOT NULL,
  invitado_por integer REFERENCES public.usuarios(id) ON DELETE SET NULL,
  token_digest text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('invite', 'recovery')),
  vence_en timestamptz NOT NULL,
  aceptada_en timestamptz,
  creado_en timestamptz NOT NULL DEFAULT now()
);
-- Preserve previous invitations instead of overwriting their history on renewal.
ALTER TABLE public.invitaciones_admin DROP CONSTRAINT IF EXISTS invitaciones_admin_email_key;
ALTER TABLE public.invitaciones_admin DROP CONSTRAINT IF EXISTS invitaciones_admin_auth_user_id_key;
ALTER TABLE public.invitaciones_admin
  ADD COLUMN IF NOT EXISTS target_usuario_id integer REFERENCES public.usuarios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS target_version timestamptz,
  ADD COLUMN IF NOT EXISTS proposito text NOT NULL DEFAULT 'administracion' CHECK (proposito IN ('administracion', 'acceso')),
  ADD COLUMN IF NOT EXISTS revocada_en timestamptz,
  ADD COLUMN IF NOT EXISTS enviada_en timestamptz,
  ADD COLUMN IF NOT EXISTS error_envio_en timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS invitaciones_admin_pendiente_email
  ON public.invitaciones_admin(email) WHERE aceptada_en IS NULL AND revocada_en IS NULL;
CREATE INDEX IF NOT EXISTS invitaciones_admin_creado ON public.invitaciones_admin(creado_en DESC, id DESC);
ALTER TABLE public.invitaciones_admin ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.invitaciones_admin FROM PUBLIC;

-- The Auth API invalidates older tokens when it generates another. Reserve the
-- mailbox before that external call so concurrent renewals cannot swap tokens.
CREATE TABLE IF NOT EXISTS privado.invitaciones_admin_emisiones (
  email text PRIMARY KEY CHECK (email = lower(trim(email))),
  id uuid NOT NULL UNIQUE,
  vence_en timestamptz NOT NULL
);
ALTER TABLE privado.invitaciones_admin_emisiones ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON privado.invitaciones_admin_emisiones FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.reservar_emision_invitacion_admin(p_admin_id integer, p_email text, p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('administracion_usuarios', 0));
  PERFORM 1 FROM public.usuarios WHERE id = p_admin_id AND rol = 'admin' AND activo FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Se requiere una cuenta de administración activa'; END IF;
  IF p_id IS NULL OR p_email IS NULL OR p_email <> lower(trim(p_email)) THEN
    RAISE EXCEPTION 'Revise los datos de la invitación';
  END IF;
  IF EXISTS(SELECT 1 FROM privado.invitaciones_admin_emisiones WHERE email = p_email AND vence_en > clock_timestamp()) THEN
    RAISE EXCEPTION 'Ya se está generando una invitación para ese correo. Espere un momento antes de intentar de nuevo';
  END IF;
  -- Auth requests have a 20-second timeout; the lease leaves a large margin for
  -- interrupted requests and recovers automatically if the server process exits.
  INSERT INTO privado.invitaciones_admin_emisiones(email, id, vence_en)
    VALUES(p_email, p_id, clock_timestamp() + interval '10 minutes')
    ON CONFLICT(email) DO UPDATE SET id = excluded.id, vence_en = excluded.vence_en;
END;
$$;

CREATE OR REPLACE FUNCTION public.liberar_emision_invitacion_admin(p_id uuid)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path = pg_catalog
AS $$ DELETE FROM privado.invitaciones_admin_emisiones WHERE id = p_id; $$;

-- Exact normalized comparison: email punctuation is never a LIKE pattern.
CREATE OR REPLACE FUNCTION public.cuenta_para_invitacion_admin(p_admin_id integer, p_email text)
RETURNS SETOF public.usuarios LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = pg_catalog, public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.usuarios WHERE id = p_admin_id AND rol = 'admin' AND activo) THEN
    RAISE EXCEPTION 'Se requiere una cuenta de administración activa';
  END IF;
  RETURN QUERY SELECT * FROM public.usuarios WHERE lower(email) = lower(trim(p_email));
END;
$$;

CREATE OR REPLACE FUNCTION public.registrar_invitacion_admin(
  p_id uuid, p_admin_id integer, p_email text, p_nombre text, p_auth_user_id uuid,
  p_digest text, p_tipo text, p_vence_en timestamptz, p_proposito text,
  p_target_usuario_id integer DEFAULT NULL, p_target_version timestamptz DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS $$
DECLARE
  actor public.usuarios%ROWTYPE;
  destino public.usuarios%ROWTYPE;
  renovada boolean;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('administracion_usuarios', 0));
  SELECT * INTO actor FROM public.usuarios WHERE id = p_admin_id AND rol = 'admin' AND activo FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Se requiere una cuenta de administración activa'; END IF;
  PERFORM 1 FROM privado.invitaciones_admin_emisiones WHERE email = p_email AND id = p_id AND vence_en > clock_timestamp() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'La emisión venció. Genere una nueva invitación'; END IF;
  IF p_email IS NULL OR p_email <> lower(trim(p_email)) OR p_email LIKE '%@legacy.laprotec'
    OR p_nombre IS NULL OR length(trim(p_nombre)) < 3 OR length(p_nombre) > 150
    OR p_auth_user_id IS NULL OR p_digest IS NULL OR length(p_digest) <> 64
    OR p_tipo IS NULL OR p_tipo NOT IN ('invite', 'recovery')
    OR p_proposito IS NULL OR p_proposito NOT IN ('administracion', 'acceso')
    OR p_vence_en IS NULL OR p_vence_en <= clock_timestamp() OR p_vence_en > clock_timestamp() + interval '24 hours'
  THEN RAISE EXCEPTION 'Revise los datos de la invitación'; END IF;
  IF p_target_usuario_id IS NOT NULL THEN
    SELECT * INTO destino FROM public.usuarios WHERE id = p_target_usuario_id FOR UPDATE;
    IF NOT FOUND OR p_target_version IS NULL OR destino.actualizado_en IS DISTINCT FROM p_target_version
      OR lower(destino.email) <> p_email
      OR (destino.auth_user_id IS NOT NULL AND destino.auth_user_id <> p_auth_user_id)
    THEN RAISE EXCEPTION 'La cuenta cambió. Actualice la lista antes de invitar'; END IF;
    IF NOT destino.activo THEN RAISE EXCEPTION 'Active la cuenta antes de enviar una invitación'; END IF;
    IF p_proposito = 'administracion' AND destino.rol = 'admin' THEN
      RAISE EXCEPTION 'Esta cuenta ya tiene permisos de administración';
    END IF;
    IF p_proposito = 'acceso' AND destino.auth_user_id IS NOT NULL THEN
      RAISE EXCEPTION 'Esta cuenta ya tiene un inicio de sesión';
    END IF;
  ELSIF p_proposito = 'acceso' OR p_target_version IS NOT NULL THEN
    RAISE EXCEPTION 'Seleccione una cuenta existente sin inicio de sesión';
  END IF;
  IF EXISTS (SELECT 1 FROM public.usuarios WHERE (lower(email) = p_email OR auth_user_id = p_auth_user_id)
    AND id IS DISTINCT FROM p_target_usuario_id) THEN
    RAISE EXCEPTION 'La cuenta cambió. Actualice la lista antes de invitar';
  END IF;
  SELECT EXISTS(SELECT 1 FROM public.invitaciones_admin WHERE email = p_email) INTO renovada;
  UPDATE public.invitaciones_admin SET revocada_en = clock_timestamp()
    WHERE email = p_email AND aceptada_en IS NULL AND revocada_en IS NULL;
  INSERT INTO public.invitaciones_admin(id, email, nombre, auth_user_id, invitado_por, token_digest, tipo,
    vence_en, target_usuario_id, target_version, proposito)
  VALUES(p_id, p_email, p_nombre, p_auth_user_id, actor.id, p_digest, p_tipo,
    p_vence_en, p_target_usuario_id, p_target_version, p_proposito);
  INSERT INTO privado.administracion_usuarios_historial(actor_id, actor_nombre, usuario_id, usuario_nombre, accion, antes, despues)
  VALUES(actor.id, actor.nombre, destino.id, coalesce(destino.nombre, p_nombre),
    CASE WHEN renovada THEN 'invitacion_renovada' ELSE 'invitacion_creada' END, NULL,
    jsonb_build_object('invitacion_id', p_id, 'email', p_email, 'proposito', p_proposito, 'vence_en', p_vence_en));
END;
$$;

CREATE OR REPLACE FUNCTION public.cancelar_invitacion_admin(p_admin_id integer, p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS $$
DECLARE
  actor public.usuarios%ROWTYPE;
  invitacion public.invitaciones_admin%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('administracion_usuarios', 0));
  SELECT * INTO actor FROM public.usuarios WHERE id = p_admin_id AND rol = 'admin' AND activo FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Se requiere una cuenta de administración activa'; END IF;
  SELECT * INTO invitacion FROM public.invitaciones_admin WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No encontramos esa invitación'; END IF;
  IF invitacion.aceptada_en IS NOT NULL THEN
    RAISE EXCEPTION 'La invitación ya fue aceptada. Revise los permisos de la cuenta';
  END IF;
  IF invitacion.revocada_en IS NOT NULL THEN RETURN; END IF;
  UPDATE public.invitaciones_admin SET revocada_en = clock_timestamp() WHERE id = p_id;
  INSERT INTO privado.administracion_usuarios_historial(actor_id, actor_nombre, usuario_id, usuario_nombre, accion, antes, despues)
  VALUES(actor.id, actor.nombre, invitacion.target_usuario_id, invitacion.nombre, 'invitacion_revocada',
    jsonb_build_object('invitacion_id', p_id, 'email', invitacion.email, 'proposito', invitacion.proposito),
    jsonb_build_object('estado', 'revocada'));
END;
$$;

-- Remove the previous overload: acceptance always needs a verified live session.
DROP FUNCTION IF EXISTS public.aceptar_invitacion_admin(uuid, uuid, text);
CREATE OR REPLACE FUNCTION public.aceptar_invitacion_admin(p_id uuid, p_auth_user_id uuid, p_digest text, p_session_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS $$
DECLARE
  invitacion public.invitaciones_admin%ROWTYPE;
  actor public.usuarios%ROWTYPE;
  destino public.usuarios%ROWTYPE;
  anterior jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('administracion_usuarios', 0));
  SELECT * INTO invitacion FROM public.invitaciones_admin
    WHERE id = p_id AND auth_user_id = p_auth_user_id AND token_digest = p_digest FOR UPDATE;
  IF NOT FOUND OR invitacion.aceptada_en IS NOT NULL OR invitacion.revocada_en IS NOT NULL OR invitacion.vence_en <= clock_timestamp() THEN
    RAISE EXCEPTION 'Invitación no disponible';
  END IF;
  SELECT * INTO actor FROM public.usuarios WHERE id = invitacion.invitado_por AND rol = 'admin' AND activo FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invitación no disponible'; END IF;
  IF NOT public.sesion_administracion_vigente(p_auth_user_id, p_session_id) THEN
    RAISE EXCEPTION 'La sesión de aceptación ya no está disponible';
  END IF;
  IF invitacion.target_usuario_id IS NOT NULL THEN
    SELECT * INTO destino FROM public.usuarios WHERE id = invitacion.target_usuario_id FOR UPDATE;
    IF NOT FOUND OR invitacion.target_version IS NULL OR destino.actualizado_en IS DISTINCT FROM invitacion.target_version
      OR NOT destino.activo OR lower(destino.email) <> invitacion.email
      OR (destino.auth_user_id IS NOT NULL AND destino.auth_user_id <> p_auth_user_id)
      OR (invitacion.proposito = 'administracion' AND destino.rol = 'admin')
      OR (invitacion.proposito = 'acceso' AND destino.auth_user_id IS NOT NULL)
    THEN RAISE EXCEPTION 'La cuenta cambió. Pida una nueva invitación'; END IF;
    IF EXISTS(SELECT 1 FROM public.usuarios WHERE id <> destino.id
      AND (auth_user_id = p_auth_user_id OR lower(email) = invitacion.email)) THEN
      RAISE EXCEPTION 'La cuenta cambió. Pida una nueva invitación';
    END IF;
    anterior := jsonb_build_object('rol', destino.rol, 'activo', destino.activo, 'tiene_login', destino.auth_user_id IS NOT NULL);
    UPDATE public.usuarios SET auth_user_id = p_auth_user_id,
      rol = CASE WHEN invitacion.proposito = 'administracion' THEN 'admin' ELSE destino.rol END,
      actualizado_en = greatest(clock_timestamp(), destino.actualizado_en + interval '1 microsecond')
      WHERE id = destino.id RETURNING * INTO destino;
  ELSE
    -- Deleting an invited target must never turn it into a new profile.
    IF invitacion.target_version IS NOT NULL OR invitacion.proposito <> 'administracion'
      OR EXISTS(SELECT 1 FROM public.usuarios WHERE auth_user_id = p_auth_user_id OR lower(email) = invitacion.email)
    THEN RAISE EXCEPTION 'La cuenta ya existe o cambió. Pida una nueva invitación'; END IF;
    INSERT INTO public.usuarios(auth_user_id, email, nombre, rol, activo)
      VALUES(p_auth_user_id, invitacion.email, invitacion.nombre, 'admin', true) RETURNING * INTO destino;
  END IF;
  UPDATE public.invitaciones_admin SET aceptada_en = clock_timestamp() WHERE id = p_id;
  INSERT INTO privado.administracion_usuarios_historial(actor_id, actor_nombre, usuario_id, usuario_nombre, accion, antes, despues)
  VALUES(actor.id, actor.nombre, destino.id, destino.nombre,
    CASE WHEN invitacion.proposito = 'administracion' THEN 'elevacion_admin' ELSE 'activacion_login' END, anterior,
    jsonb_build_object('rol', destino.rol, 'activo', destino.activo, 'tiene_login', true, 'invitacion_id', p_id));
END;
$$;
DO $$
DECLARE funcion regprocedure;
BEGIN
  FOREACH funcion IN ARRAY ARRAY[
    'public.reservar_emision_invitacion_admin(integer,text,uuid)'::regprocedure,
    'public.liberar_emision_invitacion_admin(uuid)'::regprocedure,
    'public.cuenta_para_invitacion_admin(integer,text)'::regprocedure,
    'public.registrar_invitacion_admin(uuid,integer,text,text,uuid,text,text,timestamptz,text,integer,timestamptz)'::regprocedure,
    'public.cancelar_invitacion_admin(integer,uuid)'::regprocedure,
    'public.aceptar_invitacion_admin(uuid,uuid,text,uuid)'::regprocedure
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', funcion);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', funcion);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', funcion);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', funcion);
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON public.invitaciones_admin, privado.invitaciones_admin_emisiones FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON public.invitaciones_admin, privado.invitaciones_admin_emisiones FROM authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT SELECT, INSERT, UPDATE ON public.invitaciones_admin TO service_role;
    GRANT SELECT, INSERT, UPDATE, DELETE ON privado.invitaciones_admin_emisiones TO service_role;
  END IF;
END;
$$;
NOTIFY pgrst, 'reload schema';
COMMIT;
