-- Resultados confirmados por el servidor al enviar formularios; nunca banderas del cliente.
BEGIN;
CREATE TABLE IF NOT EXISTS public.verificaciones_cedula (
  identificacion text PRIMARY KEY CHECK (identificacion ~ '^[1-9][0-9]{8}$'),
  estado text NOT NULL CHECK (estado IN ('encontrada', 'no_encontrada')),
  fecha_padron date NOT NULL,
  nombre_tse text,
  consultado_en timestamptz NOT NULL DEFAULT now(),
  CHECK ((estado = 'encontrada' AND nombre_tse IS NOT NULL AND length(btrim(nombre_tse)) > 0)
    OR (estado = 'no_encontrada' AND nombre_tse IS NULL))
);
ALTER TABLE public.verificaciones_cedula ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.verificaciones_cedula FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.verificaciones_cedula TO service_role;

CREATE OR REPLACE FUNCTION public.guardar_verificacion_cedula(
  p_identificacion text, p_fecha_padron date, p_nombre_tse text
) RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path = pg_catalog, public AS $$
  INSERT INTO public.verificaciones_cedula AS actual (identificacion, estado, fecha_padron, nombre_tse)
  VALUES (p_identificacion, CASE WHEN p_nombre_tse IS NULL THEN 'no_encontrada' ELSE 'encontrada' END,
    p_fecha_padron, p_nombre_tse)
  ON CONFLICT (identificacion) DO UPDATE SET estado = excluded.estado,
    fecha_padron = excluded.fecha_padron, nombre_tse = excluded.nombre_tse, consultado_en = now()
  WHERE actual.fecha_padron <= excluded.fecha_padron;
$$;
REVOKE ALL ON FUNCTION public.guardar_verificacion_cedula(text, date, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guardar_verificacion_cedula(text, date, text) TO service_role;
COMMIT;
