-- Contención de la lectura anónima de datos personales por la API de Supabase.
-- No elimina datos ni cambia los permisos explícitos de authenticated/service_role.
-- Ejecutar en el SQL Editor de Supabase, con una cuenta administradora.
-- No usar schema.sql ni db:aplicar sobre una base existente: recrean las tablas.
-- Esto no sustituye una revisión de acceso entre usuarios autenticados.
BEGIN;

DO $$
DECLARE
  tabla text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    RAISE EXCEPTION 'No se encontró el rol anon de Supabase';
  END IF;

  FOREACH tabla IN ARRAY ARRAY[
    'personas', 'usuarios', 'resenas', 'autenticaciones', 'viviendas',
    'fotos_resena', 'resena_etiquetas', 'resena_conductas', 'denuncias', 'bitacora'
  ] LOOP
    IF to_regclass(format('public.%I', tabla)) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM PUBLIC, anon', tabla);
    END IF;
  END LOOP;
END;
$$;

COMMIT;

-- Comprobación: ambas columnas deben devolver false para cada tabla.
SELECT tablename,
       has_table_privilege('anon', format('public.%I', tablename), 'SELECT') AS lectura_anonima,
       has_any_column_privilege('anon', format('public.%I', tablename), 'SELECT') AS columnas_anonimas
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('personas', 'usuarios', 'resenas', 'autenticaciones', 'viviendas',
                    'fotos_resena', 'resena_etiquetas', 'resena_conductas', 'denuncias', 'bitacora');
