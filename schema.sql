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
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
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
  -- Quien escribe puede pedir que la ficha no muestre su nombre.
  -- autor_id se conserva; la sesión no puede leerlo (ver el bloque RLS).
  anonima boolean NOT NULL DEFAULT false,
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

-- Protege rol y activo. El JWT trae el rol en auth.role(); session_user no
-- cambia cuando la API usa el rol authenticated.
CREATE OR REPLACE FUNCTION fn_usuarios_proteger_rol() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  rol_jwt text := NULL;
BEGIN
  IF to_regnamespace('auth') IS NOT NULL THEN
    EXECUTE 'SELECT auth.role()' INTO rol_jwt;
  END IF;

  IF current_user IN ('authenticated', 'anon') OR rol_jwt = 'authenticated' THEN
    IF TG_OP = 'INSERT'
       AND (NEW.rol IS DISTINCT FROM 'propietario' OR NEW.activo IS DISTINCT FROM true)
    THEN
      RAISE EXCEPTION 'los campos rol y activo solo los cambia la administracion';
    END IF;
    IF TG_OP = 'UPDATE'
       AND (NEW.rol IS DISTINCT FROM OLD.rol OR NEW.activo IS DISTINCT FROM OLD.activo)
    THEN
      RAISE EXCEPTION 'los campos rol y activo solo los cambia la administracion';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_usuarios_proteger_rol ON usuarios;
CREATE TRIGGER trg_usuarios_proteger_rol
  BEFORE INSERT OR UPDATE ON usuarios
  FOR EACH ROW EXECUTE FUNCTION fn_usuarios_proteger_rol();

-- La misma contención que db/seguridad-acceso.sql, para una base nueva.
DO $$
DECLARE
  tabla text;
  catalogos text[] := ARRAY[
    'paises', 'provincias', 'cantones', 'distritos', 'barrios',
    'calificaciones', 'etiquetas', 'tipos_contrato', 'tipos_alquiler',
    'tiempos_alquiler', 'danos_vivienda', 'procesos_judiciales', 'conductas'
  ];
  privadas text[] := ARRAY[
    'autenticaciones', 'viviendas', 'fotos_resena',
    'resena_etiquetas', 'resena_conductas', 'bitacora'
  ];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    RETURN;
  END IF;

  CREATE SCHEMA IF NOT EXISTS privado;
  REVOKE ALL ON SCHEMA privado FROM PUBLIC, anon;
  GRANT USAGE ON SCHEMA privado TO authenticated;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT USAGE ON SCHEMA privado TO service_role;
  END IF;

  CREATE OR REPLACE FUNCTION privado.sesion_activa()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = pg_catalog, public
  AS $fn$
    SELECT EXISTS (
      SELECT 1 FROM public.usuarios
      WHERE auth_user_id = auth.uid() AND activo
    );
  $fn$;

  CREATE OR REPLACE FUNCTION privado.puede_leer_registro()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = pg_catalog, public
  AS $fn$
    SELECT EXISTS (
      SELECT 1
      FROM public.usuarios u
      WHERE u.auth_user_id = auth.uid()
        AND u.activo
        AND (
          u.rol = 'admin'
          OR EXISTS (
            SELECT 1 FROM public.resenas r
            WHERE r.autor_id = u.id AND r.estado = 'publicada'
          )
        )
    );
  $fn$;

  REVOKE ALL ON FUNCTION privado.sesion_activa() FROM PUBLIC, anon, authenticated;
  REVOKE ALL ON FUNCTION privado.puede_leer_registro() FROM PUBLIC, anon, authenticated;
  REVOKE ALL ON FUNCTION public.fn_usuarios_proteger_rol() FROM PUBLIC, anon, authenticated;
  REVOKE ALL ON FUNCTION public.fn_personas_search() FROM PUBLIC, anon;
  GRANT EXECUTE ON FUNCTION privado.sesion_activa() TO authenticated;
  GRANT EXECUTE ON FUNCTION privado.puede_leer_registro() TO authenticated;
  GRANT EXECUTE ON FUNCTION public.fn_usuarios_proteger_rol() TO authenticated;
  GRANT EXECUTE ON FUNCTION public.fn_personas_search() TO authenticated;
  ALTER FUNCTION public.fn_usuarios_proteger_rol() SET SCHEMA privado;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION privado.sesion_activa() TO service_role;
    GRANT EXECUTE ON FUNCTION privado.puede_leer_registro() TO service_role;
    GRANT EXECUTE ON FUNCTION privado.fn_usuarios_proteger_rol() TO service_role;
    GRANT EXECUTE ON FUNCTION public.fn_personas_search() TO service_role;
  END IF;

  FOREACH tabla IN ARRAY privadas LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tabla);
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM PUBLIC, anon, authenticated', tabla);
  END LOOP;

  FOREACH tabla IN ARRAY catalogos LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tabla);
    EXECUTE format('DROP POLICY IF EXISTS catalogo_lectura ON public.%I', tabla);
    EXECUTE format(
      'CREATE POLICY catalogo_lectura ON public.%I FOR SELECT TO authenticated USING (privado.sesion_activa())',
      tabla
    );
    EXECUTE format(
      'REVOKE INSERT, UPDATE, DELETE, TRUNCATE, SELECT ON TABLE public.%I FROM PUBLIC, anon',
      tabla
    );
    EXECUTE format(
      'REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.%I FROM authenticated',
      tabla
    );
    EXECUTE format('GRANT SELECT ON TABLE public.%I TO authenticated', tabla);
  END LOOP;

  ALTER TABLE personas ENABLE ROW LEVEL SECURITY;
  ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
  ALTER TABLE resenas ENABLE ROW LEVEL SECURITY;
  ALTER TABLE denuncias ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS personas_lectura ON personas;
  DROP POLICY IF EXISTS personas_escritura ON personas;
  CREATE POLICY personas_lectura ON personas
    FOR SELECT TO authenticated
    USING (privado.puede_leer_registro());
  CREATE POLICY personas_escritura ON personas
    FOR INSERT TO authenticated
    WITH CHECK (privado.sesion_activa());
  REVOKE SELECT, UPDATE, DELETE, TRUNCATE ON TABLE personas FROM PUBLIC, anon, authenticated;
  GRANT INSERT ON TABLE personas TO authenticated;
  GRANT SELECT (
    id, nombre, nombre2, apellido1, apellido2, pais_id, provincia_id, canton_id,
    distrito_id, barrio_id, creado_en, actualizado_en
  ) ON TABLE personas TO authenticated;

  DROP POLICY IF EXISTS usuarios_lectura ON usuarios;
  DROP POLICY IF EXISTS usuarios_crear ON usuarios;
  DROP POLICY IF EXISTS usuarios_actualizar ON usuarios;
  DROP POLICY IF EXISTS usuarios_eliminar ON usuarios;
  CREATE POLICY usuarios_lectura ON usuarios
    FOR SELECT TO authenticated
    USING (auth_user_id = auth.uid());
  REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON TABLE usuarios FROM PUBLIC, anon, authenticated;
  GRANT SELECT (
    id, nombre, avatar_url, rol, activo, ultimo_acceso, creado_en, actualizado_en
  ) ON TABLE usuarios TO authenticated;

  DROP POLICY IF EXISTS resenas_lectura ON resenas;
  DROP POLICY IF EXISTS resenas_escritura ON resenas;
  CREATE POLICY resenas_lectura ON resenas
    FOR SELECT TO authenticated
    USING (estado = 'publicada' AND privado.puede_leer_registro());
  CREATE POLICY resenas_escritura ON resenas
    FOR INSERT TO authenticated
    WITH CHECK (
      autor_id = (SELECT id FROM usuarios WHERE auth_user_id = auth.uid() AND activo)
      AND (
        estado = 'borrador'
        OR (SELECT rol FROM usuarios WHERE auth_user_id = auth.uid() AND activo) = 'admin'
      )
    );
  REVOKE ALL PRIVILEGES ON TABLE resenas FROM PUBLIC, anon, authenticated;
  REVOKE SELECT (autor_id) ON TABLE resenas FROM PUBLIC, anon, authenticated;
  GRANT SELECT (
    id, persona_id, vivienda_id, tipo, calificacion_id, recomienda, drogas,
    dano_vivienda_id, detalle_dano, proceso_judicial_id, tipo_contrato_id,
    tipo_alquiler_id, tiempo_alquiler_id, fecha_inicio_alquiler, fecha_fin_alquiler,
    comentario, verificada, detalle_verificacion, estado, fuente, id_fuente,
    creado_en, actualizado_en, anonima
  ) ON TABLE resenas TO authenticated;
  GRANT INSERT ON TABLE resenas TO authenticated;

  DROP POLICY IF EXISTS denuncias_lectura ON denuncias;
  DROP POLICY IF EXISTS denuncias_escritura ON denuncias;
  CREATE POLICY denuncias_lectura ON denuncias
    FOR SELECT TO authenticated
    USING (denunciante_id = (SELECT id FROM usuarios WHERE auth_user_id = auth.uid()));
  CREATE POLICY denuncias_escritura ON denuncias
    FOR INSERT TO authenticated
    WITH CHECK (
      privado.puede_leer_registro()
      AND denunciante_id = (SELECT id FROM usuarios WHERE auth_user_id = auth.uid() AND activo)
    );
  GRANT SELECT, INSERT ON TABLE denuncias TO authenticated;
  REVOKE UPDATE, DELETE, TRUNCATE ON TABLE denuncias FROM PUBLIC, anon, authenticated;
END;
$$;

-- Solicitudes de eliminación firmadas por Facebook. Sin políticas: solo el servidor.
DROP TABLE IF EXISTS eliminaciones_facebook CASCADE;
CREATE TABLE eliminaciones_facebook (
  codigo text PRIMARY KEY,
  facebook_user_id text NOT NULL,
  estado text NOT NULL CHECK (estado IN ('completada', 'sin_cuenta')),
  creado_en timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE eliminaciones_facebook ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE eliminaciones_facebook FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE eliminaciones_facebook FROM anon, authenticated;
  END IF;

  IF to_regclass('auth.identities') IS NULL THEN
    RETURN;
  END IF;

  EXECUTE $fn$
    CREATE OR REPLACE FUNCTION public.buscar_auth_por_facebook(p_proveedor_id text)
    RETURNS uuid
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    SET search_path = auth, public
    AS $cuerpo$
      SELECT user_id
      FROM auth.identities
      WHERE provider = 'facebook'
        AND provider_id = p_proveedor_id
      LIMIT 1;
    $cuerpo$
  $fn$;

  EXECUTE $fn$
    CREATE OR REPLACE FUNCTION public.quitar_identidad_facebook(p_user_id uuid)
    RETURNS boolean
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = auth, public
    AS $cuerpo$
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
    $cuerpo$
  $fn$;

  REVOKE ALL ON FUNCTION public.buscar_auth_por_facebook(text) FROM PUBLIC;
  REVOKE ALL ON FUNCTION public.quitar_identidad_facebook(uuid) FROM PUBLIC;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION public.buscar_auth_por_facebook(text) FROM anon, authenticated;
    REVOKE ALL ON FUNCTION public.quitar_identidad_facebook(uuid) FROM anon, authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.buscar_auth_por_facebook(text) TO service_role;
    GRANT EXECUTE ON FUNCTION public.quitar_identidad_facebook(uuid) TO service_role;
  END IF;
END;
$$;
