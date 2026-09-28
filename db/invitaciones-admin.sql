-- Additive migration: pending invitations confer no privileges until accepted.
BEGIN;
CREATE TABLE IF NOT EXISTS public.invitaciones_admin (
  id uuid PRIMARY KEY,
  email text NOT NULL UNIQUE CHECK (email = lower(email)),
  nombre text NOT NULL,
  auth_user_id uuid NOT NULL UNIQUE,
  invitado_por integer REFERENCES public.usuarios(id) ON DELETE SET NULL,
  token_digest text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('invite', 'recovery')),
  vence_en timestamptz NOT NULL,
  aceptada_en timestamptz,
  creado_en timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.invitaciones_admin ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.invitaciones_admin FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.aceptar_invitacion_admin(p_id uuid, p_auth_user_id uuid, p_digest text)
RETURNS void LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE invitacion public.invitaciones_admin%ROWTYPE;
BEGIN
  SELECT * INTO invitacion FROM public.invitaciones_admin
    WHERE id = p_id AND auth_user_id = p_auth_user_id AND token_digest = p_digest FOR UPDATE;
  IF NOT FOUND OR invitacion.aceptada_en IS NOT NULL OR invitacion.vence_en <= now() THEN
    RAISE EXCEPTION 'Invitación no disponible';
  END IF;
  PERFORM 1 FROM public.usuarios WHERE id = invitacion.invitado_por AND rol = 'admin' AND activo FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invitación no disponible'; END IF;
  -- Never promote or reactivate an existing account as a side effect of an invite.
  IF EXISTS (SELECT 1 FROM public.usuarios WHERE auth_user_id = p_auth_user_id OR lower(email) = invitacion.email) THEN
    RAISE EXCEPTION 'La cuenta ya existe';
  END IF;
  INSERT INTO public.usuarios(auth_user_id, email, nombre, rol, activo)
    VALUES(p_auth_user_id, invitacion.email, invitacion.nombre, 'admin', true);
  UPDATE public.invitaciones_admin SET aceptada_en = now() WHERE id = p_id;
END;
$$;
REVOKE ALL ON FUNCTION public.aceptar_invitacion_admin(uuid, uuid, text) FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON public.invitaciones_admin FROM anon;
    REVOKE ALL ON FUNCTION public.aceptar_invitacion_admin(uuid, uuid, text) FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON public.invitaciones_admin FROM authenticated;
    REVOKE ALL ON FUNCTION public.aceptar_invitacion_admin(uuid, uuid, text) FROM authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT SELECT, INSERT, UPDATE ON public.invitaciones_admin TO service_role;
    GRANT EXECUTE ON FUNCTION public.aceptar_invitacion_admin(uuid, uuid, text) TO service_role;
  END IF;
END;
$$;
NOTIFY pgrst, 'reload schema';
COMMIT;
