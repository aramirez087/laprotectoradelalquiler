-- El GRANT SELECT de tabla no se anula con REVOKE de una columna.
-- Deja la cédula, el correo y el cambio de rol fuera de la sesión.
REVOKE SELECT, UPDATE, DELETE, TRUNCATE ON TABLE public.personas FROM PUBLIC, anon, authenticated;
GRANT INSERT ON TABLE public.personas TO authenticated;
GRANT SELECT (
  id, nombre, nombre2, apellido1, apellido2, pais_id, provincia_id, canton_id,
  distrito_id, barrio_id, creado_en, actualizado_en
) ON TABLE public.personas TO authenticated;

REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.usuarios FROM PUBLIC, anon, authenticated;
GRANT SELECT (
  id, nombre, avatar_url, rol, activo, ultimo_acceso, creado_en, actualizado_en
) ON TABLE public.usuarios TO authenticated;
DROP POLICY IF EXISTS usuarios_actualizar ON public.usuarios;

CREATE SCHEMA IF NOT EXISTS privado;
REVOKE ALL ON SCHEMA privado FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA privado TO authenticated, service_role;

DO $$
BEGIN
  IF to_regprocedure('public.sesion_activa()') IS NOT NULL
     AND to_regprocedure('privado.sesion_activa()') IS NULL THEN
    ALTER FUNCTION public.sesion_activa() SET SCHEMA privado;
  END IF;
  IF to_regprocedure('public.puede_leer_registro()') IS NOT NULL
     AND to_regprocedure('privado.puede_leer_registro()') IS NULL THEN
    ALTER FUNCTION public.puede_leer_registro() SET SCHEMA privado;
  END IF;
  IF to_regprocedure('public.fn_usuarios_proteger_rol()') IS NOT NULL
     AND to_regprocedure('privado.fn_usuarios_proteger_rol()') IS NULL THEN
    ALTER FUNCTION public.fn_usuarios_proteger_rol() SET SCHEMA privado;
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
