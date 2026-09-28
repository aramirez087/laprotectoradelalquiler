-- Eliminación que Facebook pide con una solicitud firmada.
-- No borra reseñas. Se puede ejecutar más de una vez.
-- No usar schema.sql ni npm run db:aplicar sobre una base con datos: recrean las tablas.
BEGIN;

CREATE TABLE IF NOT EXISTS eliminaciones_facebook (
  codigo text PRIMARY KEY,
  facebook_user_id text NOT NULL,
  estado text NOT NULL CHECK (estado IN ('completada', 'sin_cuenta')),
  creado_en timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE eliminaciones_facebook ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE eliminaciones_facebook FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.buscar_auth_por_facebook(p_proveedor_id text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = auth, public
AS $$
  SELECT user_id
  FROM auth.identities
  WHERE provider = 'facebook'
    AND provider_id = p_proveedor_id
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.quitar_identidad_facebook(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
DECLARE
  otras int;
BEGIN
  SELECT count(*) INTO otras
  FROM auth.identities
  WHERE user_id = p_user_id
    AND provider <> 'facebook';

  IF otras < 1 THEN
    RETURN false;
  END IF;

  DELETE FROM auth.identities
  WHERE user_id = p_user_id
    AND provider = 'facebook';

  UPDATE auth.users
  SET
    raw_app_meta_data = jsonb_set(
      jsonb_set(
        COALESCE(raw_app_meta_data, '{}'::jsonb),
        '{providers}',
        COALESCE(
          (
            SELECT jsonb_agg(DISTINCT provider)
            FROM auth.identities
            WHERE user_id = p_user_id
          ),
          '[]'::jsonb
        )
      ),
      '{provider}',
      to_jsonb(
        (
          SELECT provider
          FROM auth.identities
          WHERE user_id = p_user_id
            AND provider <> 'facebook'
          ORDER BY created_at
          LIMIT 1
        )
      )
    ),
    raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) - 'facebook'
  WHERE id = p_user_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.buscar_auth_por_facebook(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.quitar_identidad_facebook(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.buscar_auth_por_facebook(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.quitar_identidad_facebook(uuid) TO service_role;

COMMIT;
