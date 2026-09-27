-- Una reseña puede publicarse sin mostrar quién la escribió.
-- autor_id se conserva para la administración. La sesión (anon o authenticated)
-- ya no puede leer esa columna; el servidor la resuelve con la clave de servicio
-- y la omite cuando la reseña es anónima y quien mira no administra.
-- No borra datos. Se puede ejecutar más de una vez.
-- No usar schema.sql ni npm run db:aplicar sobre una base con datos: recrean las tablas.
BEGIN;

ALTER TABLE resenas ADD COLUMN IF NOT EXISTS anonima boolean NOT NULL DEFAULT false;

REVOKE SELECT ON TABLE public.resenas FROM PUBLIC, anon, authenticated;
REVOKE SELECT (autor_id) ON TABLE public.resenas FROM PUBLIC, anon, authenticated;

GRANT SELECT (
  id,
  persona_id,
  vivienda_id,
  tipo,
  calificacion_id,
  recomienda,
  drogas,
  dano_vivienda_id,
  detalle_dano,
  proceso_judicial_id,
  tipo_contrato_id,
  tipo_alquiler_id,
  tiempo_alquiler_id,
  fecha_inicio_alquiler,
  fecha_fin_alquiler,
  comentario,
  verificada,
  detalle_verificacion,
  estado,
  fuente,
  id_fuente,
  creado_en,
  actualizado_en,
  anonima
) ON TABLE public.resenas TO anon, authenticated;

DO $$
BEGIN
  IF has_column_privilege('authenticated', 'public.resenas', 'autor_id', 'SELECT')
     OR has_column_privilege('anon', 'public.resenas', 'autor_id', 'SELECT') THEN
    RAISE EXCEPTION 'la sesion aun puede leer autor_id';
  END IF;
  IF NOT has_column_privilege('authenticated', 'public.resenas', 'anonima', 'SELECT')
     OR NOT has_column_privilege('authenticated', 'public.resenas', 'comentario', 'SELECT') THEN
    RAISE EXCEPTION 'la sesion no puede leer la reseña';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role')
     AND NOT has_column_privilege('service_role', 'public.resenas', 'autor_id', 'SELECT') THEN
    RAISE EXCEPTION 'service_role perdio la lectura de autor_id';
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
