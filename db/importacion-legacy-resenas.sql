-- Archivo privado de todas las fichas originales, incluidas sus versiones.
-- La importación conserva una reseña por autor/persona en public.resenas.
-- La huella SHA-256 se calcula sobre el JSON canónico de la fila de origen:
-- repetir una importación no duplica el archivo ni reemplaza versiones previas.
-- Sin BEGIN/COMMIT: el importador aplica este bloque en su propia transacción.
CREATE SCHEMA IF NOT EXISTS privado;
REVOKE ALL ON SCHEMA privado FROM PUBLIC;

CREATE TABLE IF NOT EXISTS privado.resenas_legacy_originales (
  id_fuente integer NOT NULL,
  huella text NOT NULL CHECK (huella ~ '^[0-9a-f]{64}$'),
  datos jsonb NOT NULL CHECK (jsonb_typeof(datos) = 'object'),
  resena_id integer REFERENCES public.resenas(id) ON DELETE SET NULL,
  archivado_en timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id_fuente, huella)
);

CREATE INDEX IF NOT EXISTS idx_resenas_legacy_originales_resena
  ON privado.resenas_legacy_originales (resena_id);

ALTER TABLE privado.resenas_legacy_originales ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE privado.resenas_legacy_originales FROM PUBLIC;
-- Sin políticas ni permisos para las sesiones de la aplicación. El archivo
-- contiene datos de origen sin normalizar y solo lo maneja la conexión privada.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE privado.resenas_legacy_originales FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE privado.resenas_legacy_originales FROM authenticated;
  END IF;
END;
$$;

-- Cambiar la ficha elegida dentro del mismo par no concede tiempo nuevo por
-- una aprobación histórica. Solo el importador privado activa esta excepción;
-- una publicación manual conserva su fecha de aprobación actual.
CREATE OR REPLACE FUNCTION privado.registrar_primera_aprobacion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.primera_aprobacion_en := CASE WHEN NEW.estado = 'publicada' THEN
      CASE WHEN NEW.fuente = 'legacy' THEN least(NEW.creado_en, now()) ELSE now() END
    ELSE NULL END;
  ELSE
    NEW.primera_aprobacion_en := OLD.primera_aprobacion_en;
    IF OLD.primera_aprobacion_en IS NULL AND NEW.estado = 'publicada' THEN
      NEW.primera_aprobacion_en := CASE
        WHEN NEW.fuente = 'legacy'
          AND current_setting('laprotec.importacion_legacy', true) = 'on'
          AND EXISTS (
            SELECT 1 FROM pg_roles
            WHERE rolname = current_user AND (rolbypassrls OR rolsuper)
          )
        THEN least(NEW.creado_en, now())
        ELSE now()
      END;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION privado.registrar_primera_aprobacion() FROM PUBLIC;
