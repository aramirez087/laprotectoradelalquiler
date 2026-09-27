-- ============================================================================
-- La Protectora del Alquiler — Esquema v2 (PostgreSQL / Supabase)
-- ----------------------------------------------------------------------------
-- Reemplaza el esquema legacy MySQL `laprotec_laprotectora` (ver legacy/schema.sql).
-- Ejecutar de arriba a abajo. Idempotencia: usar DROP IF EXISTS antes de crear.
-- ============================================================================

-- ============================ LOOKUPS ======================================

DROP TABLE IF EXISTS paises CASCADE;
CREATE TABLE paises (
  id serial PRIMARY KEY,
  iso2 char(2),
  nombre text NOT NULL UNIQUE
);

DROP TABLE IF EXISTS provincias CASCADE;
CREATE TABLE provincias (
  id serial PRIMARY KEY,
  codigo smallint,
  nombre text NOT NULL UNIQUE
);

DROP TABLE IF EXISTS cantones CASCADE;
CREATE TABLE cantones (
  id serial PRIMARY KEY,
  provincia_id int NOT NULL REFERENCES provincias(id) ON DELETE CASCADE,
  codigo smallint,
  nombre text NOT NULL,
  UNIQUE (provincia_id, codigo)
);

DROP TABLE IF EXISTS distritos CASCADE;
CREATE TABLE distritos (
  id serial PRIMARY KEY,
  canton_id int NOT NULL REFERENCES cantones(id) ON DELETE CASCADE,
  codigo smallint,
  nombre text NOT NULL,
  UNIQUE (canton_id, codigo)
);

DROP TABLE IF EXISTS barrios CASCADE;
CREATE TABLE barrios (
  id serial PRIMARY KEY,
  distrito_id int NOT NULL REFERENCES distritos(id) ON DELETE CASCADE,
  codigo smallint,
  nombre text NOT NULL
);

DROP TABLE IF EXISTS calificaciones CASCADE;
CREATE TABLE calificaciones (
  id serial PRIMARY KEY,
  valor smallint NOT NULL UNIQUE CHECK (valor BETWEEN 1 AND 5),
  texto text NOT NULL
);

DROP TABLE IF EXISTS etiquetas CASCADE;
CREATE TABLE etiquetas (
  id serial PRIMARY KEY,
  nombre text NOT NULL,
  tipo text NOT NULL DEFAULT 'inquilino' CHECK (tipo IN ('inquilino', 'propietario')),
  UNIQUE (nombre, tipo)
);

DROP TABLE IF EXISTS tipos_contrato CASCADE;
CREATE TABLE tipos_contrato (
  id serial PRIMARY KEY,
  nombre text NOT NULL UNIQUE
);

DROP TABLE IF EXISTS tipos_alquiler CASCADE;
CREATE TABLE tipos_alquiler (
  id serial PRIMARY KEY,
  nombre text NOT NULL UNIQUE
);

DROP TABLE IF EXISTS tiempos_alquiler CASCADE;
CREATE TABLE tiempos_alquiler (
  id serial PRIMARY KEY,
  nombre text NOT NULL UNIQUE
);

DROP TABLE IF EXISTS danos_vivienda CASCADE;
CREATE TABLE danos_vivienda (
  id serial PRIMARY KEY,
  nombre text NOT NULL UNIQUE
);

DROP TABLE IF EXISTS procesos_judiciales CASCADE;
CREATE TABLE procesos_judiciales (
  id serial PRIMARY KEY,
  nombre text NOT NULL UNIQUE
);

DROP TABLE IF EXISTS conductas CASCADE;
CREATE TABLE conductas (
  id serial PRIMARY KEY,
  nombre text NOT NULL UNIQUE
);

-- ============================ NÚCLEO =======================================

-- Persona natural (normalmente el inquilino al que se reseña).
-- Contiene PII: nunca exponer `identificacion` completo sin autorización.
DROP TABLE IF EXISTS personas CASCADE;
CREATE TABLE personas (
  id serial PRIMARY KEY,
  identificacion text NOT NULL UNIQUE,
  nombre text NOT NULL,
  nombre2 text,
  apellido1 text NOT NULL,
  apellido2 text,
  pais_id int REFERENCES paises(id) ON DELETE SET NULL,
  fecha_nacimiento date,
  sexo text CHECK (sexo IN ('masculino', 'femenino', 'otro', 'no_indicada')),
  foto_url text,
  provincia_id int REFERENCES provincias(id) ON DELETE SET NULL,
  canton_id int REFERENCES cantones(id) ON DELETE SET NULL,
  distrito_id int REFERENCES distritos(id) ON DELETE SET NULL,
  barrio_id int REFERENCES barrios(id) ON DELETE SET NULL,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  search_vector tsvector
);
CREATE INDEX idx_personas_busqueda ON personas USING gin (search_vector);
CREATE INDEX idx_personas_nombres ON personas (lower(apellido1), lower(nombre));

CREATE OR REPLACE FUNCTION fn_personas_search() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_vector := to_tsvector('spanish',
    coalesce(NEW.nombre, '') || ' ' || coalesce(NEW.nombre2, '') || ' ' ||
    coalesce(NEW.apellido1, '') || ' ' || coalesce(NEW.apellido2, '') || ' ' ||
    coalesce(NEW.identificacion, ''));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_personas_search ON personas;
CREATE TRIGGER trg_personas_search
  BEFORE INSERT OR UPDATE ON personas
  FOR EACH ROW EXECUTE FUNCTION fn_personas_search();

-- Perfil de usuario. La autenticación vive en Supabase Auth (auth.users);
-- `auth_user_id` los enlaza sin FK externa para portabilidad.
DROP TABLE IF EXISTS usuarios CASCADE;
CREATE TABLE usuarios (
  id serial PRIMARY KEY,
  auth_user_id uuid UNIQUE,
  email text NOT NULL UNIQUE,
  nombre text NOT NULL,
  persona_id int REFERENCES personas(id) ON DELETE SET NULL,
  identificacion text,
  telefono text,
  avatar_url text,
  rol text NOT NULL DEFAULT 'propietario'
    CHECK (rol IN ('admin', 'propietario', 'agencia', 'inquilino')),
  activo boolean NOT NULL DEFAULT true,
  ultimo_acceso timestamptz,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_usuarios_persona ON usuarios (persona_id) WHERE persona_id IS NOT NULL;

DROP TABLE IF EXISTS autenticaciones CASCADE;
CREATE TABLE autenticaciones (
  id serial PRIMARY KEY,
  usuario_id int NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  proveedor text NOT NULL CHECK (proveedor IN ('facebook', 'google', 'email')),
  proveedor_id text NOT NULL,
  creado_en timestamptz NOT NULL DEFAULT now(),
  UNIQUE (proveedor, proveedor_id)
);
CREATE INDEX idx_autenticaciones_usuario ON autenticaciones (usuario_id);

-- Vivienda referida por una reseña (opcional).
DROP TABLE IF EXISTS viviendas CASCADE;
CREATE TABLE viviendas (
  id serial PRIMARY KEY,
  descripcion text,
  direccion text,
  tipo_alquiler_id int REFERENCES tipos_alquiler(id) ON DELETE SET NULL,
  provincia_id int REFERENCES provincias(id) ON DELETE SET NULL,
  canton_id int REFERENCES cantones(id) ON DELETE SET NULL,
  distrito_id int REFERENCES distritos(id) ON DELETE SET NULL,
  barrio_id int REFERENCES barrios(id) ON DELETE SET NULL,
  lat decimal(9, 6),
  lng decimal(9, 6),
  creado_en timestamptz NOT NULL DEFAULT now()
);

-- La reseña: el corazón del sistema.
DROP TABLE IF EXISTS resenas CASCADE;
CREATE TABLE resenas (
  id serial PRIMARY KEY,
  persona_id int NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  autor_id int NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  vivienda_id int REFERENCES viviendas(id) ON DELETE SET NULL,
  tipo text NOT NULL DEFAULT 'inquilino' CHECK (tipo IN ('inquilino', 'propietario')),
  calificacion_id int REFERENCES calificaciones(id) ON DELETE SET NULL,
  recomienda boolean,
  drogas boolean,
  dano_vivienda_id int REFERENCES danos_vivienda(id) ON DELETE SET NULL,
  detalle_dano text,
  proceso_judicial_id int REFERENCES procesos_judiciales(id) ON DELETE SET NULL,
  tipo_contrato_id int REFERENCES tipos_contrato(id) ON DELETE SET NULL,
  tipo_alquiler_id int REFERENCES tipos_alquiler(id) ON DELETE SET NULL,
  tiempo_alquiler_id int REFERENCES tiempos_alquiler(id) ON DELETE SET NULL,
  fecha_inicio_alquiler date,
  fecha_fin_alquiler date,
  comentario text,
  verificada boolean NOT NULL DEFAULT false,
  detalle_verificacion text,
  estado text NOT NULL DEFAULT 'publicada'
    CHECK (estado IN ('borrador', 'publicada', 'oculta')),
  -- Provenencia de la migración (idempotencia + trazabilidad)
  fuente text,
  id_fuente int,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fuente, id_fuente)
);
CREATE INDEX idx_resenas_persona ON resenas (persona_id, creado_en DESC);
CREATE INDEX idx_resenas_autor ON resenas (autor_id, creado_en DESC);
CREATE INDEX idx_resenas_estado ON resenas (estado) WHERE estado = 'publicada';

DROP TABLE IF EXISTS resena_etiquetas CASCADE;
CREATE TABLE resena_etiquetas (
  resena_id int NOT NULL REFERENCES resenas(id) ON DELETE CASCADE,
  etiqueta_id int NOT NULL REFERENCES etiquetas(id) ON DELETE CASCADE,
  PRIMARY KEY (resena_id, etiqueta_id)
);

DROP TABLE IF EXISTS resena_conductas CASCADE;
CREATE TABLE resena_conductas (
  resena_id int NOT NULL REFERENCES resenas(id) ON DELETE CASCADE,
  conducta_id int NOT NULL REFERENCES conductas(id) ON DELETE CASCADE,
  PRIMARY KEY (resena_id, conducta_id)
);

DROP TABLE IF EXISTS fotos_resena CASCADE;
CREATE TABLE fotos_resena (
  id serial PRIMARY KEY,
  resena_id int NOT NULL REFERENCES resenas(id) ON DELETE CASCADE,
  url text NOT NULL,
  descripcion text,
  orden smallint NOT NULL DEFAULT 0,
  creado_en timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_fotos_resena ON fotos_resena (resena_id, orden);

-- Denuncia de una reseña (moderación / protección legal).
DROP TABLE IF EXISTS denuncias CASCADE;
CREATE TABLE denuncias (
  id serial PRIMARY KEY,
  resena_id int NOT NULL REFERENCES resenas(id) ON DELETE CASCADE,
  denunciante_id int NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  motivo text NOT NULL CHECK (motivo IN ('informacion_falsa', 'difamacion', 'datos_incorrectos', 'otro')),
  detalle text,
  estado text NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'aceptada', 'rechazada')),
  resuelta_en timestamptz,
  creado_en timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_denuncias_estado ON denuncias (estado) WHERE estado = 'pendiente';

-- Bitácora de sesiones.
DROP TABLE IF EXISTS bitacora CASCADE;
CREATE TABLE bitacora (
  id serial PRIMARY KEY,
  usuario_id int REFERENCES usuarios(id) ON DELETE SET NULL,
  tipo text NOT NULL CHECK (tipo IN ('inicio', 'fin', 'error')),
  ip text,
  user_agent text,
  creado_en timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_bitacora_usuario ON bitacora (usuario_id, creado_en DESC);

-- ============================ RLS (Supabase) ===============================
-- Solo se aplica en Supabase (existe el rol `authenticated`). En Postgres
-- plano (dev local) no hay roles auth: el bloque no hace nada y la app
-- funciona igual; la protección final la da Supabase.

-- Protege rol/activo contra auto-elevación vía API (solo `authenticated`
-- toca la tabla por la API; `postgres`/`service_role` pueden todo).
CREATE OR REPLACE FUNCTION fn_usuarios_proteger_rol() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF session_user = 'authenticated'
     AND (NEW.rol IS DISTINCT FROM OLD.rol
          OR NEW.activo IS DISTINCT FROM OLD.activo)
  THEN
    RAISE EXCEPTION 'los campos rol y activo solo los cambia la administracion';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_usuarios_proteger_rol ON usuarios;
CREATE TRIGGER trg_usuarios_proteger_rol
  BEFORE UPDATE ON usuarios
  FOR EACH ROW EXECUTE FUNCTION fn_usuarios_proteger_rol();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    -- resenas: lectura pública de publicadas; solo se puede autor como uno mismo
    ALTER TABLE resenas ENABLE ROW LEVEL SECURITY;
    CREATE POLICY resenas_lectura ON resenas
      FOR SELECT TO authenticated, anon USING (estado = 'publicada');
    -- Quien no administra solo puede dejar la reseña en revisión.
    -- Publicarla (y así abrir la consulta) lo hace la administración.
    CREATE POLICY resenas_escritura ON resenas
      FOR INSERT TO authenticated
      WITH CHECK (
        autor_id = (SELECT id FROM usuarios WHERE auth_user_id = auth.uid())
        AND (
          estado = 'borrador'
          OR (SELECT rol FROM usuarios WHERE auth_user_id = auth.uid()) = 'admin'
        )
      );

    -- personas: lectura pública; creación libre (la app la valida en el DAL)
    ALTER TABLE personas ENABLE ROW LEVEL SECURITY;
    CREATE POLICY personas_lectura ON personas
      FOR SELECT TO authenticated, anon USING (true);
    CREATE POLICY personas_escritura ON personas
      FOR INSERT TO authenticated WITH CHECK (true);

    -- usuarios: lectura abierta (la ficha muestra autores enlazados);
    -- crear/editar/eliminar solo la propia cuenta
    ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
    CREATE POLICY usuarios_lectura ON usuarios
      FOR SELECT TO authenticated, anon USING (true);
    CREATE POLICY usuarios_crear ON usuarios
      FOR INSERT TO authenticated WITH CHECK (auth_user_id = auth.uid());
    CREATE POLICY usuarios_actualizar ON usuarios
      FOR UPDATE TO authenticated
      USING (auth_user_id = auth.uid() OR email = lower(auth.email()))
      WITH CHECK (auth_user_id = auth.uid() OR email = lower(auth.email()));
    CREATE POLICY usuarios_eliminar ON usuarios
      FOR DELETE TO authenticated USING (auth_user_id = auth.uid());

    -- denuncias: solo las propias
    ALTER TABLE denuncias ENABLE ROW LEVEL SECURITY;
    CREATE POLICY denuncias_lectura ON denuncias
      FOR SELECT TO authenticated
      USING (denunciante_id = (SELECT id FROM usuarios WHERE auth_user_id = auth.uid()));
    CREATE POLICY denuncias_escritura ON denuncias
      FOR INSERT TO authenticated
      WITH CHECK (denunciante_id = (SELECT id FROM usuarios WHERE auth_user_id = auth.uid()));
  END IF;
END;
$$;
