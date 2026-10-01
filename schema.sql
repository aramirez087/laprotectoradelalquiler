-- ============================================================================
-- La Protectora del Alquiler — Esquema v2 (PostgreSQL / Supabase)
-- ----------------------------------------------------------------------------
-- Reemplaza el esquema legacy MySQL `laprotec_laprotectora` (ver legacy/schema.sql).
-- Ejecutar de arriba a abajo. Idempotencia: usar DROP IF EXISTS antes de crear.
-- ============================================================================

-- ============================ LOOKUPS ======================================

-- El esquema completo reinicia también los recibos; las migraciones los conservan.
DROP TABLE IF EXISTS privado.resultados_busqueda;
DROP TABLE IF EXISTS privado.busqueda_config;
DROP TABLE IF EXISTS privado.activacion_config;
DROP TABLE IF EXISTS privado.borradores_resena;
DROP TABLE IF EXISTS privado.activacion_cuentas;
DROP TABLE IF EXISTS privado.revision_tiempos;
DROP TABLE IF EXISTS privado.avisos_moderacion;
DROP TABLE IF EXISTS privado.historial_resenas;
DROP TABLE IF EXISTS privado.aportes_consulta;

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

-- Administración atómica de reseñas (también en db/administrar-resenas.sql).
-- Edición y eliminación atómicas, accesibles solo al servidor (service_role).
-- La identidad del administrador viene de la sesión validada en lib/admin.ts.
BEGIN;

CREATE OR REPLACE FUNCTION public.admin_editar_resena(
  p_admin_id integer, p_id integer, p_identificacion text,
  p_nombre text, p_nombre2 text, p_apellido1 text, p_apellido2 text,
  p_comentario text, p_anonima boolean
)
RETURNS TABLE (
  persona_id integer, persona_anterior_id integer, movida boolean,
  autor_email text, autor_nombre text
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  actual record;
  documento text := regexp_replace(btrim(p_identificacion), '\s+', '', 'g');
  digitos text := regexp_replace(documento, '[^0-9]', '', 'g');
  destino integer;
  otras boolean;
BEGIN
  PERFORM 1 FROM public.usuarios u WHERE u.id = p_admin_id AND u.rol = 'admin' AND u.activo FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No puede administrar reseñas con esta cuenta.'; END IF;

  SELECT r.persona_id, p.identificacion, u.email, u.nombre AS autor_nombre
    INTO actual
    FROM public.resenas r
    JOIN public.personas p ON p.id = r.persona_id
    JOIN public.usuarios u ON u.id = r.autor_id
    WHERE r.id = p_id
    FOR UPDATE OF r, p;
  IF NOT FOUND THEN RAISE EXCEPTION 'No encontramos esa reseña.'; END IF;

  -- Los documentos legacy se conservan al corregir otros campos.
  IF documento IS NULL OR (documento <> regexp_replace(btrim(actual.identificacion), '\s+', '', 'g')
      AND length(digitos) NOT BETWEEN 6 AND 12) THEN
    RAISE EXCEPTION 'Escriba un documento de 6 a 12 dígitos; puede incluir guiones.';
  END IF;

  IF p_nombre IS NULL OR length(btrim(p_nombre)) < 1 OR p_apellido1 IS NULL OR length(btrim(p_apellido1)) < 1
      OR p_comentario IS NULL OR length(btrim(p_comentario)) NOT BETWEEN 1 AND 5000 THEN
    RAISE EXCEPTION 'Revise los campos indicados.';
  END IF;

  destino := actual.persona_id;
  IF documento = regexp_replace(btrim(actual.identificacion), '\s+', '', 'g')
      OR (length(digitos) BETWEEN 6 AND 12 AND digitos = regexp_replace(actual.identificacion, '[^0-9]', '', 'g')) THEN
    -- Al conservar la identidad solo se corrigen sus datos.
    UPDATE public.personas p SET identificacion = documento, nombre = btrim(p_nombre),
      nombre2 = nullif(btrim(p_nombre2), ''), apellido1 = btrim(p_apellido1),
      apellido2 = nullif(btrim(p_apellido2), ''), actualizado_en = now()
      WHERE p.id = destino;
  ELSE
    SELECT p.id INTO destino FROM public.personas p
      WHERE p.identificacion = documento OR regexp_replace(p.identificacion, '[^0-9]', '', 'g') = digitos
      ORDER BY (p.identificacion = documento) DESC, p.id
      LIMIT 1 FOR UPDATE;
    IF destino IS NULL THEN
      SELECT EXISTS(SELECT 1 FROM public.resenas r WHERE r.persona_id = actual.persona_id AND r.id <> p_id) INTO otras;
      IF otras THEN
        INSERT INTO public.personas (identificacion, nombre, nombre2, apellido1, apellido2)
          VALUES (documento, btrim(p_nombre), nullif(btrim(p_nombre2), ''), btrim(p_apellido1), nullif(btrim(p_apellido2), ''))
          ON CONFLICT (identificacion) DO NOTHING
          RETURNING id INTO destino;
        IF destino IS NULL THEN
          SELECT p.id INTO destino FROM public.personas p WHERE p.identificacion = documento FOR UPDATE;
        END IF;
      ELSE
        destino := actual.persona_id;
        UPDATE public.personas p SET identificacion = documento, nombre = btrim(p_nombre),
          nombre2 = nullif(btrim(p_nombre2), ''), apellido1 = btrim(p_apellido1),
          apellido2 = nullif(btrim(p_apellido2), ''), actualizado_en = now()
          WHERE p.id = destino;
      END IF;
    END IF;
  END IF;

  UPDATE public.resenas r SET persona_id = destino, comentario = btrim(p_comentario),
    anonima = coalesce(p_anonima, false), actualizado_en = now() WHERE r.id = p_id;
  RETURN QUERY SELECT destino, actual.persona_id, destino <> actual.persona_id, actual.email, actual.autor_nombre;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_eliminar_resena(p_admin_id integer, p_id integer)
RETURNS TABLE (persona_id integer, autor_email text, autor_nombre text)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
BEGIN
  PERFORM 1 FROM public.usuarios u WHERE u.id = p_admin_id AND u.rol = 'admin' AND u.activo FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No puede administrar reseñas con esta cuenta.'; END IF;

  RETURN QUERY DELETE FROM public.resenas r USING public.usuarios u
    WHERE r.id = p_id AND u.id = r.autor_id
    RETURNING r.persona_id, u.email, u.nombre;
  IF NOT FOUND THEN RAISE EXCEPTION 'No encontramos esa reseña.'; END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_editar_resena(integer, integer, text, text, text, text, text, text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_eliminar_resena(integer, integer) FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION public.admin_editar_resena(integer, integer, text, text, text, text, text, text, boolean) FROM anon;
    REVOKE ALL ON FUNCTION public.admin_eliminar_resena(integer, integer) FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON FUNCTION public.admin_editar_resena(integer, integer, text, text, text, text, text, text, boolean) FROM authenticated;
    REVOKE ALL ON FUNCTION public.admin_eliminar_resena(integer, integer) FROM authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.admin_editar_resena(integer, integer, text, text, text, text, text, text, boolean) TO service_role;
    GRANT EXECUTE ON FUNCTION public.admin_eliminar_resena(integer, integer) TO service_role;
  END IF;
END;
$$;
NOTIFY pgrst, 'reload schema';
COMMIT;

-- Acceso temporal a consultas (también en db/acceso-temporal-consultas.sql).
-- Acceso temporal: aplicar antes de desplegar la aplicación. Conserva los datos.
-- La primera aprobación por autor e inquilino suma 3 meses al saldo vigente,
-- con un máximo de 12 meses desde esa aprobación. Repetir inquilino no suma tiempo.
BEGIN;

ALTER TABLE public.resenas ADD COLUMN IF NOT EXISTS primera_aprobacion_en timestamptz;

-- No hay historial de aprobaciones anterior: conservar la antigüedad conocida.
UPDATE public.resenas
SET primera_aprobacion_en = creado_en
WHERE estado = 'publicada' AND primera_aprobacion_en IS NULL;

CREATE INDEX IF NOT EXISTS idx_resenas_acceso_autor
  ON public.resenas (autor_id, primera_aprobacion_en, id)
  WHERE estado = 'publicada';

CREATE SCHEMA IF NOT EXISTS privado;
REVOKE ALL ON SCHEMA privado FROM PUBLIC;

CREATE OR REPLACE FUNCTION privado.registrar_primera_aprobacion()
RETURNS trigger
LANGUAGE plpgsql
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
      NEW.primera_aprobacion_en := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION privado.registrar_primera_aprobacion() FROM PUBLIC;
DROP TRIGGER IF EXISTS trg_resenas_primera_aprobacion ON public.resenas;
CREATE TRIGGER trg_resenas_primera_aprobacion
  BEFORE INSERT OR UPDATE ON public.resenas
  FOR EACH ROW EXECUTE FUNCTION privado.registrar_primera_aprobacion();

-- Un recibo inmutable por primera aprobación. Conservamos el recibo al borrar
-- la reseña para que volver a reseñar al mismo inquilino no reinicie su recompensa.
-- No lleva FK a resenas/personas por ese motivo; borrar la cuenta sí lo elimina.
CREATE TABLE IF NOT EXISTS privado.aportes_consulta (
  resena_id integer PRIMARY KEY,
  autor_id integer NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  persona_id integer NOT NULL,
  tipo text NOT NULL,
  fecha_inicio_alquiler date,
  aprobada_en timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_aportes_consulta_autor
  ON privado.aportes_consulta (autor_id, persona_id, tipo, fecha_inicio_alquiler);
ALTER TABLE privado.aportes_consulta ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE privado.aportes_consulta FROM PUBLIC;

INSERT INTO privado.aportes_consulta
  (resena_id, autor_id, persona_id, tipo, fecha_inicio_alquiler, aprobada_en)
SELECT id, autor_id, persona_id, tipo, fecha_inicio_alquiler, primera_aprobacion_en
FROM public.resenas
WHERE primera_aprobacion_en IS NOT NULL
ON CONFLICT (resena_id) DO NOTHING;

CREATE OR REPLACE FUNCTION privado.registrar_aporte_consulta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  -- Solo se invoca por una escritura autorizada en resenas. No acepta IDs
  -- externos ni permite al cliente escribir en el historial de recompensas.
  IF NEW.primera_aprobacion_en IS NOT NULL THEN
    INSERT INTO privado.aportes_consulta
      (resena_id, autor_id, persona_id, tipo, fecha_inicio_alquiler, aprobada_en)
    VALUES (NEW.id, NEW.autor_id, NEW.persona_id, NEW.tipo,
      NEW.fecha_inicio_alquiler, NEW.primera_aprobacion_en)
    ON CONFLICT (resena_id) DO NOTHING;
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION privado.registrar_aporte_consulta() FROM PUBLIC;
DROP TRIGGER IF EXISTS trg_resenas_aporte_consulta ON public.resenas;
CREATE TRIGGER trg_resenas_aporte_consulta
  AFTER INSERT OR UPDATE ON public.resenas
  FOR EACH ROW EXECUTE FUNCTION privado.registrar_aporte_consulta();

-- Incluye los estados pendientes/rechazados sin descargar reseñas ni depender
-- del límite de filas de PostgREST. Un solo cálculo para servidor, UI y RLS.
CREATE OR REPLACE FUNCTION public.accesos_consulta(p_usuario_ids integer[])
RETURNS TABLE (
  usuario_id integer, puede_consultar boolean, aprobadas integer,
  pendientes integer, rechazadas integer, ultima_aprobacion_en timestamptz,
  vence_en timestamptz, motivo text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog
SET timezone = 'UTC'
AS $$
  WITH RECURSIVE experiencias AS (
    -- Un aporte es autor + persona, sin distinguir fechas ni tipos de reseña.
    -- Se aplica también al historial: las fechas registradas se conservan.
    -- La primera aprobación incluye recibos borrados/ocultos para no premiar reenvíos.
    SELECT a.autor_id, a.persona_id,
      min(a.aprobada_en) AS aprobada_en, min(a.resena_id) AS orden
    FROM privado.aportes_consulta a
    LEFT JOIN public.resenas r ON r.id = a.resena_id AND r.autor_id = a.autor_id
    WHERE a.autor_id = ANY(p_usuario_ids)
    GROUP BY a.autor_id, a.persona_id
    HAVING bool_or(r.estado = 'publicada')
  ), resenas_ordenadas AS (
    SELECT autor_id, aprobada_en,
      row_number() OVER (
        PARTITION BY autor_id
        ORDER BY aprobada_en, orden
      ) AS paso
    FROM experiencias
  ), vigencias AS (
    SELECT autor_id, paso, aprobada_en,
      aprobada_en + interval '3 months' AS vence
    FROM resenas_ordenadas
    WHERE paso = 1
    UNION ALL
    SELECT siguiente.autor_id, siguiente.paso, siguiente.aprobada_en,
      least(
        greatest(anterior.vence, siguiente.aprobada_en) + interval '3 months',
        siguiente.aprobada_en + interval '12 months'
      ) AS vence
    FROM vigencias anterior
    JOIN resenas_ordenadas siguiente
      ON siguiente.autor_id = anterior.autor_id
     AND siguiente.paso = anterior.paso + 1
  ), premios AS (
    SELECT autor_id, count(*)::integer AS aprobadas,
      max(aprobada_en) AS ultima, max(vence) AS vence
    FROM vigencias
    GROUP BY autor_id
  ), otros_estados AS (
    SELECT r.autor_id,
      count(*) FILTER (WHERE r.estado = 'borrador')::integer AS pendientes,
      count(*) FILTER (WHERE r.estado = 'oculta')::integer AS rechazadas
    FROM public.resenas r
    WHERE r.autor_id = ANY(p_usuario_ids)
    GROUP BY r.autor_id
  )
  SELECT u.id,
    u.activo AND (u.rol = 'admin' OR coalesce(p.vence > now(), false)),
    coalesce(p.aprobadas, 0), coalesce(e.pendientes, 0),
    coalesce(e.rechazadas, 0), p.ultima,
    CASE WHEN u.rol = 'admin' THEN NULL ELSE p.vence END,
    CASE
      WHEN NOT u.activo THEN 'inactiva'
      WHEN u.rol = 'admin' THEN 'administracion'
      WHEN p.vence > now() THEN 'vigente'
      WHEN coalesce(p.aprobadas, 0) > 0 THEN 'vencida'
      WHEN coalesce(e.pendientes, 0) > 0 THEN 'revision'
      WHEN coalesce(e.rechazadas, 0) > 0 THEN 'rechazada'
      ELSE 'ninguna'
    END
  FROM public.usuarios u
  LEFT JOIN premios p ON p.autor_id = u.id
  LEFT JOIN otros_estados e ON e.autor_id = u.id
  WHERE u.id = ANY(p_usuario_ids);
$$;
REVOKE ALL ON FUNCTION public.accesos_consulta(integer[]) FROM PUBLIC;

-- Permite instalar el esquema en Postgres de pruebas, sin Supabase Auth.
DO $migration$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON SCHEMA privado FROM anon;
    REVOKE ALL ON FUNCTION public.accesos_consulta(integer[]) FROM anon;
    REVOKE ALL ON FUNCTION privado.registrar_primera_aprobacion() FROM anon;
    REVOKE ALL ON FUNCTION privado.registrar_aporte_consulta() FROM anon;
    REVOKE ALL ON TABLE privado.aportes_consulta FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT USAGE ON SCHEMA privado TO authenticated;
    REVOKE ALL ON FUNCTION public.accesos_consulta(integer[]) FROM authenticated;
    REVOKE ALL ON FUNCTION privado.registrar_primera_aprobacion() FROM authenticated;
    REVOKE ALL ON FUNCTION privado.registrar_aporte_consulta() FROM authenticated;
    REVOKE ALL ON TABLE privado.aportes_consulta FROM authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.accesos_consulta(integer[]) TO service_role;
    GRANT USAGE ON SCHEMA privado TO service_role;
    GRANT SELECT ON TABLE privado.aportes_consulta TO service_role;
  END IF;
  IF to_regprocedure('auth.uid()') IS NULL THEN RETURN; END IF;

  -- SECURITY DEFINER solo aquí: resuelve la identidad de la sesión y evita la
  -- recursión RLS. No acepta un ID que pueda elegir quien llama.
  CREATE OR REPLACE FUNCTION privado.mi_acceso_consulta()
  RETURNS TABLE (
    usuario_id integer, puede_consultar boolean, aprobadas integer,
    pendientes integer, rechazadas integer, ultima_aprobacion_en timestamptz,
    vence_en timestamptz, motivo text
  )
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = pg_catalog
  AS $fn$
    SELECT a.* FROM public.accesos_consulta(ARRAY(
      SELECT id FROM public.usuarios WHERE auth_user_id = auth.uid()
    )) a;
  $fn$;

  CREATE OR REPLACE FUNCTION public.mi_acceso_consulta()
  RETURNS TABLE (
    usuario_id integer, puede_consultar boolean, aprobadas integer,
    pendientes integer, rechazadas integer, ultima_aprobacion_en timestamptz,
    vence_en timestamptz, motivo text
  )
  LANGUAGE sql STABLE SECURITY INVOKER
  SET search_path = pg_catalog
  AS $fn$ SELECT * FROM privado.mi_acceso_consulta(); $fn$;

  CREATE OR REPLACE FUNCTION privado.puede_leer_registro()
  RETURNS boolean
  LANGUAGE sql STABLE SECURITY INVOKER
  SET search_path = pg_catalog
  AS $fn$
    SELECT coalesce((SELECT puede_consultar FROM privado.mi_acceso_consulta()), false);
  $fn$;

  REVOKE ALL ON FUNCTION privado.mi_acceso_consulta() FROM PUBLIC, anon, authenticated;
  REVOKE ALL ON FUNCTION public.mi_acceso_consulta() FROM PUBLIC, anon, authenticated;
  REVOKE ALL ON FUNCTION privado.puede_leer_registro() FROM PUBLIC, anon, authenticated;
  GRANT EXECUTE ON FUNCTION privado.mi_acceso_consulta(), public.mi_acceso_consulta(), privado.puede_leer_registro() TO authenticated;

  -- Actualiza también instalaciones anteriores al traslado al esquema privado.
  ALTER POLICY personas_lectura ON public.personas USING ((SELECT privado.puede_leer_registro()));
  ALTER POLICY resenas_lectura ON public.resenas
    USING (estado = 'publicada' AND (SELECT privado.puede_leer_registro()));
  -- auth_user_id es una columna privada: las políticas de escritura obtienen
  -- la identidad mediante la función de sesión, sin abrir esa columna.
  ALTER POLICY resenas_escritura ON public.resenas WITH CHECK (
    autor_id = (SELECT usuario_id FROM privado.mi_acceso_consulta() WHERE motivo <> 'inactiva')
    AND (estado = 'borrador' OR (SELECT motivo FROM privado.mi_acceso_consulta()) = 'administracion')
  );
  ALTER POLICY denuncias_escritura ON public.denuncias WITH CHECK (
    (SELECT privado.puede_leer_registro())
    AND denunciante_id = (SELECT usuario_id FROM privado.mi_acceso_consulta())
  );
  ALTER POLICY denuncias_lectura ON public.denuncias
    USING (denunciante_id = (SELECT usuario_id FROM privado.mi_acceso_consulta()));
  GRANT USAGE ON SEQUENCE public.resenas_id_seq, public.denuncias_id_seq TO authenticated;
END;
$migration$;

NOTIFY pgrst, 'reload schema';
COMMIT;

-- Una sola reseña por propietario y persona, en cualquier estado.
-- No elimina ni combina reseñas existentes: resolver duplicados antes de aplicar.
BEGIN;

LOCK TABLE public.resenas IN SHARE ROW EXCLUSIVE MODE;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.resenas GROUP BY autor_id, persona_id HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Hay varias reseñas del mismo propietario sobre una persona. Revise los duplicados antes de aplicar la restricción.'
      USING HINT = 'SELECT autor_id, persona_id, array_agg(id ORDER BY id) AS resenas FROM public.resenas GROUP BY autor_id, persona_id HAVING count(*) > 1;';
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS resenas_autor_persona_unica
  ON public.resenas (autor_id, persona_id);

NOTIFY pgrst, 'reload schema';
COMMIT;

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

-- Migración aditiva: cambios de cuentas atómicos y trazables. Conserva los datos.
BEGIN;

CREATE SCHEMA IF NOT EXISTS privado;
REVOKE ALL ON SCHEMA privado FROM PUBLIC;

CREATE TABLE IF NOT EXISTS privado.administracion_usuarios_historial (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id integer REFERENCES public.usuarios(id) ON DELETE SET NULL,
  usuario_id integer REFERENCES public.usuarios(id) ON DELETE SET NULL,
  actor_nombre text NOT NULL,
  usuario_nombre text NOT NULL,
  accion text NOT NULL CHECK (length(trim(accion)) BETWEEN 1 AND 80),
  antes jsonb,
  despues jsonb,
  creado_en timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS idx_administracion_usuarios_historial_usuario
  ON privado.administracion_usuarios_historial(usuario_id, creado_en DESC, id DESC);
ALTER TABLE privado.administracion_usuarios_historial ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE privado.administracion_usuarios_historial FROM PUBLIC;
REVOKE ALL ON SEQUENCE privado.administracion_usuarios_historial_id_seq FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.admin_actualizar_usuario(
  p_admin_id integer, p_id integer, p_rol text, p_activo boolean,
  p_version_esperada timestamptz
)
RETURNS TABLE(id integer, nombre text, actualizado_en timestamptz)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $$
DECLARE
  actor public.usuarios%ROWTYPE;
  objetivo public.usuarios%ROWTYPE;
  nueva_version timestamptz;
BEGIN
  -- Toda mutación de permisos y aceptación de invitaciones comparte este bloqueo.
  PERFORM pg_advisory_xact_lock(hashtextextended('administracion_usuarios', 0));
  SELECT u.* INTO actor FROM public.usuarios u
    WHERE u.id = p_admin_id AND u.rol = 'admin' AND u.activo FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No puede administrar usuarios con esta cuenta.'; END IF;
  SELECT u.* INTO objetivo FROM public.usuarios u WHERE u.id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No encontramos esa cuenta.'; END IF;
  IF p_version_esperada IS NULL OR objetivo.actualizado_en IS DISTINCT FROM p_version_esperada THEN
    RAISE EXCEPTION 'Esta cuenta cambió desde que la abrió. Actualice la página y revise los cambios.';
  END IF;
  IF p_rol IS NULL OR p_rol NOT IN ('admin', 'propietario', 'agencia', 'inquilino') OR p_activo IS NULL THEN
    RAISE EXCEPTION 'Revise los permisos de la cuenta.';
  END IF;
  IF p_rol = 'inquilino' AND objetivo.rol <> 'inquilino' THEN
    RAISE EXCEPTION 'El rol histórico de inquilino solo puede conservarse en cuentas existentes.';
  END IF;
  IF p_rol = 'admin' AND objetivo.rol <> 'admin' THEN
    RAISE EXCEPTION 'Para conceder administración, envíe una invitación de acceso.';
  END IF;
  IF p_id = p_admin_id AND (p_rol <> 'admin' OR NOT p_activo) THEN
    RAISE EXCEPTION 'No puede quitarse el acceso de administración.';
  END IF;
  IF objetivo.rol = 'admin' AND objetivo.activo AND (p_rol <> 'admin' OR NOT p_activo)
    AND NOT EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id <> p_id AND u.rol = 'admin' AND u.activo)
  THEN
    RAISE EXCEPTION 'Debe quedar al menos una cuenta de administración activa.';
  END IF;
  IF objetivo.rol = p_rol AND objetivo.activo = p_activo THEN
    RETURN QUERY SELECT objetivo.id, objetivo.nombre, objetivo.actualizado_en;
    RETURN;
  END IF;

  nueva_version := greatest(clock_timestamp(), objetivo.actualizado_en + interval '1 microsecond');
  UPDATE public.usuarios u SET rol = p_rol, activo = p_activo, actualizado_en = nueva_version
    WHERE u.id = p_id;
  INSERT INTO privado.administracion_usuarios_historial
    (actor_id, usuario_id, actor_nombre, usuario_nombre, accion, antes, despues)
  VALUES (actor.id, objetivo.id, actor.nombre, objetivo.nombre, 'permisos',
    jsonb_build_object('rol', objetivo.rol, 'activo', objetivo.activo),
    jsonb_build_object('rol', p_rol, 'activo', p_activo));
  RETURN QUERY SELECT objetivo.id, objetivo.nombre, nueva_version;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_actualizar_perfil_usuario(
  p_admin_id integer, p_id integer, p_nombre text, p_identificacion text,
  p_telefono text, p_version_esperada timestamptz
)
RETURNS TABLE(id integer, nombre text, actualizado_en timestamptz)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $$
DECLARE
  actor public.usuarios%ROWTYPE;
  objetivo public.usuarios%ROWTYPE;
  nombre_nuevo text := btrim(p_nombre);
  identificacion_nueva text := nullif(btrim(p_identificacion), '');
  telefono_nuevo text := nullif(btrim(p_telefono), '');
  nueva_version timestamptz;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('administracion_usuarios', 0));
  SELECT u.* INTO actor FROM public.usuarios u
    WHERE u.id = p_admin_id AND u.rol = 'admin' AND u.activo FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No puede administrar usuarios con esta cuenta.'; END IF;
  SELECT u.* INTO objetivo FROM public.usuarios u WHERE u.id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No encontramos esa cuenta.'; END IF;
  IF p_version_esperada IS NULL OR objetivo.actualizado_en IS DISTINCT FROM p_version_esperada THEN
    RAISE EXCEPTION 'Esta cuenta cambió desde que la abrió. Actualice la página y revise los cambios.';
  END IF;
  IF nombre_nuevo IS NULL OR char_length(nombre_nuevo) NOT BETWEEN 3 AND 150
    OR char_length(telefono_nuevo) > 30
  THEN
    RAISE EXCEPTION 'Revise el nombre y el teléfono de la cuenta.';
  END IF;
  -- Los documentos históricos pueden conservarse sin inventar un documento nuevo.
  IF identificacion_nueva IS DISTINCT FROM objetivo.identificacion AND identificacion_nueva IS NOT NULL THEN
    IF identificacion_nueva !~ '^[0-9 -]+$'
      OR regexp_replace(identificacion_nueva, '[^0-9]', '', 'g') !~ '^[0-9]{6,12}$'
    THEN
      RAISE EXCEPTION 'Escriba una cédula de 6 a 12 dígitos, o deje el campo vacío.';
    END IF;
    identificacion_nueva := regexp_replace(identificacion_nueva, '[^0-9]', '', 'g');
    IF EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id <> p_id
      AND regexp_replace(coalesce(u.identificacion, ''), '[^0-9]', '', 'g') = identificacion_nueva)
    THEN
      RAISE EXCEPTION 'Esa cédula ya pertenece a otra cuenta.';
    END IF;
  END IF;
  IF nombre_nuevo = objetivo.nombre
    AND identificacion_nueva IS NOT DISTINCT FROM objetivo.identificacion
    AND telefono_nuevo IS NOT DISTINCT FROM objetivo.telefono
  THEN
    RETURN QUERY SELECT objetivo.id, objetivo.nombre, objetivo.actualizado_en;
    RETURN;
  END IF;
  nueva_version := greatest(clock_timestamp(), objetivo.actualizado_en + interval '1 microsecond');
  UPDATE public.usuarios u SET nombre = nombre_nuevo, identificacion = identificacion_nueva,
    telefono = telefono_nuevo, actualizado_en = nueva_version WHERE u.id = p_id;
  INSERT INTO privado.administracion_usuarios_historial
    (actor_id, usuario_id, actor_nombre, usuario_nombre, accion, antes, despues)
  VALUES (actor.id, objetivo.id, actor.nombre, nombre_nuevo, 'perfil',
    jsonb_build_object('nombre', objetivo.nombre, 'identificacion', objetivo.identificacion, 'telefono', objetivo.telefono),
    jsonb_build_object('nombre', nombre_nuevo, 'identificacion', identificacion_nueva, 'telefono', telefono_nuevo));
  RETURN QUERY SELECT objetivo.id, nombre_nuevo, nueva_version;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_historial_usuario(
  p_admin_id integer, p_usuario_id integer, p_limite integer DEFAULT 20
)
RETURNS SETOF privado.administracion_usuarios_historial
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = p_admin_id AND u.rol = 'admin' AND u.activo) THEN
    RAISE EXCEPTION 'No puede administrar usuarios con esta cuenta.';
  END IF;
  RETURN QUERY SELECT h.* FROM privado.administracion_usuarios_historial h
    WHERE h.usuario_id = p_usuario_id
    ORDER BY h.creado_en DESC, h.id DESC LIMIT greatest(1, least(coalesce(p_limite, 20), 100));
END;
$$;

REVOKE ALL ON FUNCTION public.admin_actualizar_usuario(integer, integer, text, boolean, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_actualizar_perfil_usuario(integer, integer, text, text, text, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_historial_usuario(integer, integer, integer) FROM PUBLIC;
DO $$
DECLARE rol_db text;
BEGIN
  FOREACH rol_db IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = rol_db) THEN
      EXECUTE format('REVOKE ALL ON TABLE privado.administracion_usuarios_historial FROM %I', rol_db);
      EXECUTE format('REVOKE ALL ON SEQUENCE privado.administracion_usuarios_historial_id_seq FROM %I', rol_db);
      EXECUTE format('REVOKE ALL ON FUNCTION public.admin_actualizar_usuario(integer, integer, text, boolean, timestamptz) FROM %I', rol_db);
      EXECUTE format('REVOKE ALL ON FUNCTION public.admin_actualizar_perfil_usuario(integer, integer, text, text, text, timestamptz) FROM %I', rol_db);
      EXECUTE format('REVOKE ALL ON FUNCTION public.admin_historial_usuario(integer, integer, integer) FROM %I', rol_db);
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT USAGE ON SCHEMA privado TO service_role;
    REVOKE ALL ON TABLE privado.administracion_usuarios_historial FROM service_role;
    REVOKE ALL ON SEQUENCE privado.administracion_usuarios_historial_id_seq FROM service_role;
    GRANT SELECT, INSERT ON TABLE privado.administracion_usuarios_historial TO service_role;
    GRANT USAGE ON SEQUENCE privado.administracion_usuarios_historial_id_seq TO service_role;
    GRANT EXECUTE ON FUNCTION public.admin_actualizar_usuario(integer, integer, text, boolean, timestamptz) TO service_role;
    GRANT EXECUTE ON FUNCTION public.admin_actualizar_perfil_usuario(integer, integer, text, text, text, timestamptz) TO service_role;
    GRANT EXECUTE ON FUNCTION public.admin_historial_usuario(integer, integer, integer) TO service_role;
  END IF;
END;
$$;
NOTIFY pgrst, 'reload schema';
COMMIT;

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

-- Las sesiones revocadas no adquieren acceso al vincular o elevar una cuenta existente.
BEGIN;

CREATE OR REPLACE FUNCTION public.sesion_administracion_vigente(p_auth_user_id uuid, p_session_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
  IF p_auth_user_id IS NULL OR p_session_id IS NULL OR to_regclass('auth.sessions') IS NULL THEN
    RETURN false;
  END IF;
  RETURN EXISTS (SELECT 1 FROM auth.sessions s WHERE s.id = p_session_id AND s.user_id = p_auth_user_id);
END;
$$;
REVOKE ALL ON FUNCTION public.sesion_administracion_vigente(uuid, uuid) FROM PUBLIC;

DO $migration$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.sesion_administracion_vigente(uuid, uuid) TO service_role;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION public.sesion_administracion_vigente(uuid, uuid) FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON FUNCTION public.sesion_administracion_vigente(uuid, uuid) FROM authenticated;
  END IF;
  IF to_regprocedure('auth.uid()') IS NULL THEN RETURN; END IF;
  CREATE OR REPLACE FUNCTION privado.sesion_administracion_actual()
  RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $fn$
  DECLARE sesion text;
  BEGIN
    sesion := coalesce(
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'session_id',
      nullif(current_setting('request.jwt.claim.session_id', true), '')
    );
    IF sesion IS NULL OR sesion !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN RETURN false; END IF;
    RETURN public.sesion_administracion_vigente(auth.uid(), sesion::uuid);
  EXCEPTION WHEN invalid_text_representation THEN RETURN false;
  END;
  $fn$;

  CREATE OR REPLACE FUNCTION public.mi_sesion_administracion_vigente()
  RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = pg_catalog
  AS $fn$ SELECT privado.sesion_administracion_actual(); $fn$;

  CREATE OR REPLACE FUNCTION privado.sesion_activa()
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog
  AS $fn$
    SELECT EXISTS (SELECT 1 FROM public.usuarios u WHERE u.auth_user_id = auth.uid() AND u.activo)
      AND privado.sesion_administracion_actual();
  $fn$;

  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'usuarios' AND policyname = 'usuarios_lectura') THEN
    ALTER POLICY usuarios_lectura ON public.usuarios USING (
      auth_user_id = auth.uid() AND (SELECT privado.sesion_administracion_actual())
    );
  END IF;

  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'denuncias' AND policyname = 'denuncias_lectura') THEN
    ALTER POLICY denuncias_lectura ON public.denuncias USING (
      denunciante_id = (SELECT usuario_id FROM privado.mi_acceso_consulta())
      AND (SELECT privado.sesion_administracion_actual())
    );
  END IF;

  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'resenas' AND policyname = 'resenas_escritura') THEN
    ALTER POLICY resenas_escritura ON public.resenas WITH CHECK (
      autor_id = (SELECT usuario_id FROM privado.mi_acceso_consulta() WHERE motivo NOT IN ('inactiva', 'error'))
      AND (estado = 'borrador' OR (SELECT motivo FROM privado.mi_acceso_consulta()) = 'administracion')
    );
  END IF;

  CREATE OR REPLACE FUNCTION privado.mi_acceso_consulta()
  RETURNS TABLE (usuario_id integer, puede_consultar boolean, aprobadas integer,
    pendientes integer, rechazadas integer, ultima_aprobacion_en timestamptz, vence_en timestamptz, motivo text)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $fn$
    SELECT a.usuario_id,
      a.puede_consultar AND privado.sesion_administracion_actual(),
      a.aprobadas, a.pendientes, a.rechazadas, a.ultima_aprobacion_en, a.vence_en,
      CASE WHEN a.motivo <> 'inactiva' AND NOT privado.sesion_administracion_actual() THEN 'error' ELSE a.motivo END
    FROM public.accesos_consulta(ARRAY(SELECT u.id FROM public.usuarios u WHERE u.auth_user_id = auth.uid())) a;
  $fn$;

  REVOKE ALL ON FUNCTION privado.sesion_administracion_actual(), public.mi_sesion_administracion_vigente() FROM PUBLIC;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION public.sesion_administracion_vigente(uuid, uuid), privado.sesion_administracion_actual(), public.mi_sesion_administracion_vigente() FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON FUNCTION public.sesion_administracion_vigente(uuid, uuid) FROM authenticated;
    GRANT EXECUTE ON FUNCTION privado.sesion_administracion_actual(), public.mi_sesion_administracion_vigente() TO authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION privado.sesion_administracion_actual(), public.mi_sesion_administracion_vigente() TO service_role;
  END IF;
END;
$migration$;

NOTIFY pgrst, 'reload schema';
COMMIT;

-- Additive hardening. Never run schema.sql against an existing project.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- Table grants override column revocations: remove both before the allowlist.
DO $$
DECLARE tabla text; columnas text;
BEGIN
  FOREACH tabla IN ARRAY ARRAY['personas', 'resenas', 'denuncias'] LOOP
    SELECT string_agg(quote_ident(attname), ', ') INTO columnas
    FROM pg_attribute WHERE attrelid = to_regclass('public.' || tabla)
      AND attnum > 0 AND NOT attisdropped;
    EXECUTE format('REVOKE INSERT ON TABLE public.%I FROM PUBLIC, anon, authenticated', tabla);
    EXECUTE format('REVOKE INSERT (%s) ON TABLE public.%I FROM PUBLIC, anon, authenticated', columnas, tabla);
  END LOOP;
  -- No API client needs schema creation, triggers, or foreign-key privileges.
  FOR tabla IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('REVOKE REFERENCES, TRIGGER ON TABLE public.%I FROM PUBLIC, anon, authenticated', tabla);
  END LOOP;
END;
$$;

-- People are created by the checked server path. Reviews retain the existing
-- session/author/draft RLS checks but cannot forge verification or provenance.
GRANT INSERT (
  persona_id, autor_id, calificacion_id, recomienda, drogas, dano_vivienda_id,
  detalle_dano, proceso_judicial_id, tipo_contrato_id, tipo_alquiler_id,
  tiempo_alquiler_id, fecha_inicio_alquiler, fecha_fin_alquiler, comentario,
  anonima, estado
) ON public.resenas TO authenticated;
GRANT INSERT (resena_id, denunciante_id, motivo, detalle)
  ON public.denuncias TO authenticated;

ALTER POLICY denuncias_escritura ON public.denuncias WITH CHECK (
  (SELECT privado.puede_leer_registro())
  AND denunciante_id = (SELECT usuario_id FROM privado.mi_acceso_consulta())
  AND EXISTS (SELECT 1 FROM public.resenas r WHERE r.id = resena_id AND r.estado = 'publicada')
);

CREATE OR REPLACE FUNCTION privado.validar_insercion_api()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  -- Service imports keep their existing historical content. Direct user writes
  -- receive the same limits as the form; the API role cannot bypass this trigger.
  IF current_user = 'authenticated' THEN
    IF TG_TABLE_NAME = 'resenas' THEN
      IF NEW.comentario IS NULL OR length(btrim(NEW.comentario)) NOT BETWEEN 30 AND 5000 THEN
        RAISE EXCEPTION 'Revise el comentario de la reseña.' USING ERRCODE = '23514';
      END IF;
    ELSIF TG_TABLE_NAME = 'denuncias' THEN
      IF length(NEW.detalle) > 2000 THEN
        RAISE EXCEPTION 'El detalle de la denuncia es muy largo.' USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION privado.validar_insercion_api() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_resenas_validar_api ON public.resenas;
CREATE TRIGGER trg_resenas_validar_api BEFORE INSERT ON public.resenas
  FOR EACH ROW EXECUTE FUNCTION privado.validar_insercion_api();
DROP TRIGGER IF EXISTS trg_denuncias_validar_api ON public.denuncias;
CREATE TRIGGER trg_denuncias_validar_api BEFORE INSERT ON public.denuncias
  FOR EACH ROW EXECUTE FUNCTION privado.validar_insercion_api();

-- No unauthenticated application profile writes. Auth confirms the address
-- before creating both records atomically. User-editable metadata can request
-- only ordinary account types, never administrative authority.
CREATE OR REPLACE FUNCTION privado.crear_perfil_correo_confirmado()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE m jsonb; perfil_id integer; documento text; perfil_facebook text;
BEGIN
  IF NEW.email_confirmed_at IS NULL OR NEW.email IS NULL
     OR NEW.raw_user_meta_data ->> 'registro_correo' IS DISTINCT FROM 'true'
     OR EXISTS (SELECT 1 FROM public.usuarios WHERE auth_user_id = NEW.id) THEN
    RETURN NEW;
  END IF;
  m := NEW.raw_user_meta_data;
  documento := regexp_replace(coalesce(m ->> 'identificacion', ''), '[^0-9]', '', 'g');
  perfil_facebook := btrim(coalesce(m ->> 'facebook', ''));
  IF documento !~ '^[0-9]{6,12}$' OR length(btrim(coalesce(m ->> 'nombre', ''))) NOT BETWEEN 3 AND 200
     OR length(perfil_facebook) NOT BETWEEN 1 AND 2000
     OR coalesce(m ->> 'rol', '') NOT IN ('propietario', 'agencia') THEN
    RAISE EXCEPTION 'Revise los datos del registro.' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public.usuarios
    WHERE regexp_replace(coalesce(identificacion, ''), '[^0-9]', '', 'g') = documento) THEN
    RAISE EXCEPTION 'No se pudo completar el registro.' USING ERRCODE = '23505';
  END IF;
  INSERT INTO public.usuarios (auth_user_id, email, nombre, rol, identificacion)
  VALUES (NEW.id, lower(NEW.email), btrim(m ->> 'nombre'), m ->> 'rol', documento)
  RETURNING id INTO perfil_id;
  INSERT INTO public.autenticaciones (usuario_id, proveedor, proveedor_id)
  VALUES (perfil_id, 'facebook', perfil_facebook);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION privado.crear_perfil_correo_confirmado() FROM PUBLIC, anon, authenticated;
DO $$
BEGIN
  IF to_regclass('auth.users') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_correo_confirmado_perfil ON auth.users;
    CREATE TRIGGER trg_correo_confirmado_perfil AFTER INSERT OR UPDATE OF email_confirmed_at ON auth.users
      FOR EACH ROW EXECUTE FUNCTION privado.crear_perfil_correo_confirmado();
  END IF;
END;
$$;

-- Opt-in grants for future objects, including PUBLIC's global function default.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;
-- supabase_admin is provider-owned: postgres cannot alter its defaults. Application
-- migrations run as postgres; provider-owned defaults require Supabase support.

NOTIFY pgrst, 'reload schema';
COMMIT;


-- Manifiesto del índice privado del TSE. Los millones de nombres viven en Storage.
BEGIN;
CREATE TABLE IF NOT EXISTS public.padron_tse (
  id smallint PRIMARY KEY CHECK (id = 1),
  version text NOT NULL CHECK (version ~ '^\d{4}-\d{2}-\d{2}-[a-f0-9]{16}$'),
  fecha_padron date NOT NULL,
  prefijos text[] NOT NULL,
  registros integer NOT NULL CHECK (registros >= 3000000),
  sha256 text NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.padron_tse ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.limites_consulta_padron (
  clave text PRIMARY KEY CHECK (clave ~ '^[a-f0-9]{64}$'),
  ventana timestamptz NOT NULL,
  consultas integer NOT NULL
);
ALTER TABLE public.limites_consulta_padron ENABLE ROW LEVEL SECURITY;

-- El padrón incluye nombres y apellidos legales de una sola letra.
CREATE OR REPLACE FUNCTION public.admin_editar_resena(
  p_admin_id integer, p_id integer, p_identificacion text,
  p_nombre text, p_nombre2 text, p_apellido1 text, p_apellido2 text,
  p_comentario text, p_anonima boolean
)
RETURNS TABLE (
  persona_id integer, persona_anterior_id integer, movida boolean,
  autor_email text, autor_nombre text
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  actual record;
  documento text := regexp_replace(btrim(p_identificacion), '\s+', '', 'g');
  digitos text := regexp_replace(documento, '[^0-9]', '', 'g');
  destino integer;
  otras boolean;
BEGIN
  PERFORM 1 FROM public.usuarios u WHERE u.id = p_admin_id AND u.rol = 'admin' AND u.activo FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No puede administrar reseñas con esta cuenta.'; END IF;

  SELECT r.persona_id, p.identificacion, u.email, u.nombre AS autor_nombre
    INTO actual
    FROM public.resenas r
    JOIN public.personas p ON p.id = r.persona_id
    JOIN public.usuarios u ON u.id = r.autor_id
    WHERE r.id = p_id
    FOR UPDATE OF r, p;
  IF NOT FOUND THEN RAISE EXCEPTION 'No encontramos esa reseña.'; END IF;

  -- Los documentos legacy se conservan al corregir otros campos.
  IF documento IS NULL OR (documento <> regexp_replace(btrim(actual.identificacion), '\s+', '', 'g')
      AND length(digitos) NOT BETWEEN 6 AND 12) THEN
    RAISE EXCEPTION 'Escriba un documento de 6 a 12 dígitos; puede incluir guiones.';
  END IF;

  IF p_nombre IS NULL OR length(btrim(p_nombre)) < 1 OR p_apellido1 IS NULL OR length(btrim(p_apellido1)) < 1
      OR p_comentario IS NULL OR length(btrim(p_comentario)) NOT BETWEEN 1 AND 5000 THEN
    RAISE EXCEPTION 'Revise los campos indicados.';
  END IF;

  destino := actual.persona_id;
  IF documento = regexp_replace(btrim(actual.identificacion), '\s+', '', 'g')
      OR (length(digitos) BETWEEN 6 AND 12 AND digitos = regexp_replace(actual.identificacion, '[^0-9]', '', 'g')) THEN
    -- Al conservar la identidad solo se corrigen sus datos.
    UPDATE public.personas p SET identificacion = documento, nombre = btrim(p_nombre),
      nombre2 = nullif(btrim(p_nombre2), ''), apellido1 = btrim(p_apellido1),
      apellido2 = nullif(btrim(p_apellido2), ''), actualizado_en = now()
      WHERE p.id = destino;
  ELSE
    SELECT p.id INTO destino FROM public.personas p
      WHERE p.identificacion = documento OR regexp_replace(p.identificacion, '[^0-9]', '', 'g') = digitos
      ORDER BY (p.identificacion = documento) DESC, p.id
      LIMIT 1 FOR UPDATE;
    IF destino IS NULL THEN
      SELECT EXISTS(SELECT 1 FROM public.resenas r WHERE r.persona_id = actual.persona_id AND r.id <> p_id) INTO otras;
      IF otras THEN
        INSERT INTO public.personas (identificacion, nombre, nombre2, apellido1, apellido2)
          VALUES (documento, btrim(p_nombre), nullif(btrim(p_nombre2), ''), btrim(p_apellido1), nullif(btrim(p_apellido2), ''))
          ON CONFLICT (identificacion) DO NOTHING
          RETURNING id INTO destino;
        IF destino IS NULL THEN
          SELECT p.id INTO destino FROM public.personas p WHERE p.identificacion = documento FOR UPDATE;
        END IF;
      ELSE
        destino := actual.persona_id;
        UPDATE public.personas p SET identificacion = documento, nombre = btrim(p_nombre),
          nombre2 = nullif(btrim(p_nombre2), ''), apellido1 = btrim(p_apellido1),
          apellido2 = nullif(btrim(p_apellido2), ''), actualizado_en = now()
          WHERE p.id = destino;
      END IF;
    END IF;
  END IF;

  UPDATE public.resenas r SET persona_id = destino, comentario = btrim(p_comentario),
    anonima = coalesce(p_anonima, false), actualizado_en = now() WHERE r.id = p_id;
  RETURN QUERY SELECT destino, actual.persona_id, destino <> actual.persona_id, actual.email, actual.autor_nombre;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_editar_resena(integer, integer, text, text, text, text, text, text, boolean) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.publicar_padron_tse(
  p_version text, p_fecha date, p_prefijos text[], p_registros integer, p_sha256 text
) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS $$
BEGIN
  IF p_fecha > current_date OR cardinality(p_prefijos) < 1
    OR EXISTS (SELECT FROM unnest(p_prefijos) p WHERE p !~ '^[1-9]\d{2}$')
    OR p_version <> p_fecha::text || '-' || left(p_sha256, 16) THEN
    RAISE EXCEPTION 'Manifiesto del padrón inválido.';
  END IF;
  INSERT INTO public.padron_tse AS actual (id, version, fecha_padron, prefijos, registros, sha256)
  VALUES (1, p_version, p_fecha, p_prefijos, p_registros, p_sha256)
  ON CONFLICT (id) DO UPDATE SET version = excluded.version, fecha_padron = excluded.fecha_padron,
    prefijos = excluded.prefijos, registros = excluded.registros, sha256 = excluded.sha256, actualizado_en = now()
  WHERE actual.fecha_padron <= excluded.fecha_padron;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.consumir_consulta_padron(p_clave text) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS $$
DECLARE cantidad integer;
BEGIN
  DELETE FROM public.limites_consulta_padron WHERE ventana < now() - interval '20 minutes';
  INSERT INTO public.limites_consulta_padron AS l (clave, ventana, consultas)
  VALUES (p_clave, now(), 1)
  ON CONFLICT (clave) DO UPDATE SET
    ventana = CASE WHEN l.ventana <= now() - interval '10 minutes' THEN now() ELSE l.ventana END,
    consultas = CASE WHEN l.ventana <= now() - interval '10 minutes' THEN 1 ELSE least(l.consultas + 1, 31) END
  RETURNING consultas INTO cantidad;
  RETURN cantidad <= 30;
END;
$$;

REVOKE ALL ON FUNCTION public.consumir_consulta_padron(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.publicar_padron_tse(text, date, text[], integer, text) FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON public.padron_tse, public.limites_consulta_padron FROM anon;
    REVOKE ALL ON FUNCTION public.admin_editar_resena(integer, integer, text, text, text, text, text, text, boolean) FROM anon;
    REVOKE ALL ON FUNCTION public.consumir_consulta_padron(text) FROM anon;
    REVOKE ALL ON FUNCTION public.publicar_padron_tse(text, date, text[], integer, text) FROM anon;
  END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON public.padron_tse, public.limites_consulta_padron FROM authenticated;
    REVOKE ALL ON FUNCTION public.admin_editar_resena(integer, integer, text, text, text, text, text, text, boolean) FROM authenticated;
    REVOKE ALL ON FUNCTION public.consumir_consulta_padron(text) FROM authenticated;
    REVOKE ALL ON FUNCTION public.publicar_padron_tse(text, date, text[], integer, text) FROM authenticated;
  END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.padron_tse, public.limites_consulta_padron TO service_role;
    GRANT EXECUTE ON FUNCTION public.admin_editar_resena(integer, integer, text, text, text, text, text, text, boolean) TO service_role;
    GRANT EXECUTE ON FUNCTION public.consumir_consulta_padron(text) TO service_role;
    GRANT EXECUTE ON FUNCTION public.publicar_padron_tse(text, date, text[], integer, text) TO service_role;
  END IF;
END;
$$;
COMMIT;

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

-- Correcciones autorizadas por moderación. Conserva una sola reseña por autor
-- e inquilino, su primera aprobación y todas las versiones desde esta migración.
BEGIN;

ALTER TABLE public.resenas
  ADD COLUMN IF NOT EXISTS permite_correccion boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
ALTER TABLE public.resenas DROP CONSTRAINT IF EXISTS resenas_correccion_autorizada;
ALTER TABLE public.resenas ADD CONSTRAINT resenas_correccion_autorizada CHECK (
  NOT permite_correccion OR (estado = 'oculta' AND length(btrim(coalesce(detalle_verificacion, ''))) > 0)
);

CREATE SCHEMA IF NOT EXISTS privado;
REVOKE ALL ON SCHEMA privado FROM PUBLIC;
CREATE TABLE IF NOT EXISTS privado.historial_resenas (
  resena_id integer NOT NULL REFERENCES public.resenas(id) ON DELETE CASCADE,
  version integer NOT NULL,
  persona_id integer NOT NULL,
  comentario text,
  anonima boolean NOT NULL,
  estado text NOT NULL,
  detalle_verificacion text,
  permite_correccion boolean NOT NULL,
  guardado_en timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (resena_id, version)
);
ALTER TABLE privado.historial_resenas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE privado.historial_resenas FROM PUBLIC;

CREATE OR REPLACE FUNCTION privado.archivar_version_resena()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
BEGIN
  INSERT INTO privado.historial_resenas
    (resena_id, version, persona_id, comentario, anonima, estado, detalle_verificacion, permite_correccion)
  VALUES (OLD.id, OLD.version, OLD.persona_id, OLD.comentario, OLD.anonima,
    OLD.estado, OLD.detalle_verificacion, OLD.permite_correccion);
  NEW.version := OLD.version + 1;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION privado.archivar_version_resena() FROM PUBLIC;
DROP TRIGGER IF EXISTS trg_resenas_historial ON public.resenas;
CREATE TRIGGER trg_resenas_historial BEFORE UPDATE ON public.resenas
  FOR EACH ROW EXECUTE FUNCTION privado.archivar_version_resena();

-- Solo el servidor llama estas funciones, después de validar la sesión.
-- La identidad del actor siempre viene de la sesión, nunca del formulario.
CREATE OR REPLACE FUNCTION public.corregir_resena(
  p_autor_id integer, p_id integer, p_version integer, p_comentario text, p_anonima boolean
)
RETURNS TABLE (persona_id integer)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
DECLARE actual public.resenas%ROWTYPE;
BEGIN
  PERFORM 1 FROM public.usuarios u WHERE u.id = p_autor_id AND u.activo FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Su cuenta está inactiva y no puede reenviar reseñas.'; END IF;
  SELECT r.* INTO actual FROM public.resenas r
    WHERE r.id = p_id AND r.autor_id = p_autor_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No encontramos esa reseña en su cuenta.'; END IF;
  IF p_version IS NULL OR actual.version <> p_version THEN
    RAISE EXCEPTION 'La reseña cambió desde que la abrió. Vuelva a su perfil y revise su estado.';
  END IF;
  IF actual.estado <> 'oculta' OR NOT actual.permite_correccion THEN
    RAISE EXCEPTION 'Esta reseña no admite correcciones. Revise su estado en el perfil.';
  END IF;
  IF p_comentario IS NULL OR length(btrim(p_comentario)) NOT BETWEEN 30 AND 5000 OR p_anonima IS NULL THEN
    RAISE EXCEPTION 'Revise el relato: debe tener entre 30 y 5000 caracteres.';
  END IF;
  IF btrim(p_comentario) = btrim(coalesce(actual.comentario, '')) AND p_anonima = actual.anonima THEN
    RAISE EXCEPTION 'Corrija el relato o la opción de anonimato antes de reenviar.';
  END IF;
  UPDATE public.resenas r SET comentario = btrim(p_comentario), anonima = p_anonima,
    estado = 'borrador', permite_correccion = false, verificada = false
    WHERE r.id = actual.id;
  -- No cambia persona, autor, fecha de creación ni primera aprobación.
  RETURN QUERY SELECT actual.persona_id;
END;
$$;

-- El bloqueo y la comparación evitan sobrescribir una corrección recién enviada
-- con el contenido de un formulario administrativo antiguo.
CREATE OR REPLACE FUNCTION public.admin_editar_resena_versionada(
  p_admin_id integer, p_id integer, p_identificacion text,
  p_nombre text, p_nombre2 text, p_apellido1 text, p_apellido2 text,
  p_comentario text, p_anonima boolean, p_version integer
)
RETURNS TABLE (
  persona_id integer, persona_anterior_id integer, movida boolean,
  autor_email text, autor_nombre text
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
DECLARE actual integer;
BEGIN
  PERFORM 1 FROM public.usuarios u WHERE u.id = p_admin_id AND u.rol = 'admin' AND u.activo FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No puede administrar reseñas con esta cuenta.'; END IF;
  SELECT r.version INTO actual FROM public.resenas r WHERE r.id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No encontramos esa reseña.'; END IF;
  IF p_version IS NULL OR actual <> p_version THEN
    RAISE EXCEPTION 'La reseña cambió desde que la abrió. Actualice la página y revise los cambios.';
  END IF;
  RETURN QUERY SELECT * FROM public.admin_editar_resena(p_admin_id, p_id, p_identificacion,
    p_nombre, p_nombre2, p_apellido1, p_apellido2, p_comentario, p_anonima);
END;
$$;

CREATE OR REPLACE FUNCTION public.historial_resenas(p_usuario_id integer, p_resena_ids integer[])
RETURNS TABLE (
  resena_id integer, version integer, comentario text, anonima boolean, estado text,
  detalle_verificacion text, permite_correccion boolean, guardado_en timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
  SELECT h.resena_id, h.version, h.comentario, h.anonima, h.estado,
    h.detalle_verificacion, h.permite_correccion, h.guardado_en
  FROM public.usuarios u
  JOIN public.resenas r ON (u.rol = 'admin' OR r.autor_id = u.id)
  CROSS JOIN LATERAL (
    SELECT v.* FROM privado.historial_resenas v WHERE v.resena_id = r.id
      ORDER BY v.version DESC LIMIT 10
  ) h
  WHERE u.id = p_usuario_id AND u.activo
    AND r.id = ANY(p_resena_ids[1:20])
  ORDER BY h.resena_id, h.version DESC;
$$;

REVOKE ALL ON FUNCTION public.corregir_resena(integer, integer, integer, text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_editar_resena_versionada(integer, integer, text, text, text, text, text, text, boolean, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.historial_resenas(integer, integer[]) FROM PUBLIC;
DO $$
DECLARE rol text;
BEGIN
  FOREACH rol IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = rol) THEN
      EXECUTE format('REVOKE ALL ON TABLE privado.historial_resenas FROM %I', rol);
      EXECUTE format('REVOKE ALL ON FUNCTION privado.archivar_version_resena() FROM %I', rol);
      EXECUTE format('REVOKE ALL ON FUNCTION public.corregir_resena(integer, integer, integer, text, boolean) FROM %I', rol);
      EXECUTE format('REVOKE ALL ON FUNCTION public.admin_editar_resena_versionada(integer, integer, text, text, text, text, text, text, boolean, integer) FROM %I', rol);
      EXECUTE format('REVOKE ALL ON FUNCTION public.historial_resenas(integer, integer[]) FROM %I', rol);
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT USAGE ON SCHEMA privado TO service_role;
    GRANT SELECT, INSERT ON TABLE privado.historial_resenas TO service_role;
    GRANT EXECUTE ON FUNCTION public.corregir_resena(integer, integer, integer, text, boolean) TO service_role;
    GRANT EXECUTE ON FUNCTION public.admin_editar_resena_versionada(integer, integer, text, text, text, text, text, text, boolean, integer) TO service_role;
    GRANT EXECUTE ON FUNCTION public.historial_resenas(integer, integer[]) TO service_role;
  END IF;
END;
$$;
NOTIFY pgrst, 'reload schema';
COMMIT;

-- Borradores privados, hitos de activación y avisos durables. Migración aditiva.
BEGIN;
CREATE SCHEMA IF NOT EXISTS privado;
-- Las políticas existentes necesitan USAGE para mi_acceso_consulta().
-- Los datos nuevos se protegen por permisos de tabla/RPC, sin retirar ese acceso.
REVOKE ALL ON SCHEMA privado FROM PUBLIC, anon;

CREATE TABLE IF NOT EXISTS privado.activacion_config (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  iniciada_en timestamptz NOT NULL DEFAULT clock_timestamp()
);
INSERT INTO privado.activacion_config(id) VALUES (true) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS privado.borradores_resena (
  autor_id integer NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  contexto integer NOT NULL CHECK (contexto >= 0),
  version uuid NOT NULL DEFAULT gen_random_uuid(),
  datos jsonb,
  actualizado_en timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (autor_id, contexto)
);
CREATE TABLE IF NOT EXISTS privado.activacion_cuentas (
  usuario_id integer PRIMARY KEY REFERENCES public.usuarios(id) ON DELETE CASCADE,
  creada_en timestamptz NOT NULL,
  primera_resena_en timestamptz,
  primera_aprobacion_en timestamptz,
  primera_consulta_en timestamptz
);
CREATE INDEX IF NOT EXISTS idx_activacion_creada ON privado.activacion_cuentas(creada_en);
CREATE TABLE IF NOT EXISTS privado.revision_tiempos (
  resena_id integer PRIMARY KEY REFERENCES public.resenas(id) ON DELETE CASCADE,
  enviada_en timestamptz NOT NULL,
  aprobada_en timestamptz
);
CREATE TABLE IF NOT EXISTS privado.avisos_moderacion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resena_id integer NOT NULL REFERENCES public.resenas(id) ON DELETE CASCADE,
  autor_id integer NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  version integer NOT NULL,
  accion text NOT NULL CHECK (accion IN ('aprobada', 'corregir', 'rechazada')),
  email text NOT NULL,
  nombre text NOT NULL,
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','procesando','enviada','omitida','revision')),
  creado_en timestamptz NOT NULL DEFAULT clock_timestamp(),
  proximo_intento_en timestamptz NOT NULL DEFAULT clock_timestamp(),
  primer_intento_en timestamptz,
  intentos integer NOT NULL DEFAULT 0,
  token uuid,
  cuerpo jsonb,
  proveedor_id text,
  UNIQUE (resena_id, version)
);
CREATE INDEX IF NOT EXISTS idx_avisos_pendientes ON privado.avisos_moderacion(proximo_intento_en)
  WHERE estado IN ('pendiente','procesando');

ALTER TABLE privado.activacion_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE privado.borradores_resena ENABLE ROW LEVEL SECURITY;
ALTER TABLE privado.activacion_cuentas ENABLE ROW LEVEL SECURITY;
ALTER TABLE privado.revision_tiempos ENABLE ROW LEVEL SECURITY;
ALTER TABLE privado.avisos_moderacion ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE privado.activacion_config, privado.borradores_resena,
  privado.activacion_cuentas, privado.revision_tiempos, privado.avisos_moderacion FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA privado TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE privado.activacion_config, privado.borradores_resena,
  privado.activacion_cuentas, privado.revision_tiempos, privado.avisos_moderacion TO service_role;

CREATE OR REPLACE FUNCTION public.leer_borrador_resena(p_autor_id integer, p_persona_id integer)
RETURNS TABLE (version uuid, datos jsonb)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.usuarios WHERE id=p_autor_id AND activo) THEN
    RAISE EXCEPTION 'Cuenta no disponible';
  END IF;
  RETURN QUERY SELECT b.version, CASE WHEN b.actualizado_en > clock_timestamp()-interval '30 days' THEN b.datos END
    FROM privado.borradores_resena b WHERE b.autor_id=p_autor_id AND b.contexto=coalesce(p_persona_id,0);
END;
$$;

CREATE OR REPLACE FUNCTION public.guardar_borrador_resena(p_autor_id integer, p_persona_id integer, p_version uuid, p_datos jsonb)
RETURNS TABLE (guardado boolean, version uuid)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $$
DECLARE actual uuid; nueva uuid := gen_random_uuid(); clave text; limite integer;
BEGIN
  PERFORM 1 FROM public.usuarios WHERE id=p_autor_id AND activo FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cuenta no disponible'; END IF;
  IF p_persona_id IS NOT NULL AND (p_persona_id < 1 OR NOT EXISTS (
    SELECT 1 FROM public.accesos_consulta(ARRAY[p_autor_id]) WHERE puede_consultar)) THEN
    RAISE EXCEPTION 'Consulta no autorizada';
  END IF;
  IF p_datos IS NOT NULL THEN
    IF jsonb_typeof(p_datos) <> 'object' OR (SELECT count(*) FROM jsonb_object_keys(p_datos)) <> 7
      OR jsonb_typeof(p_datos->'anonima') IS DISTINCT FROM 'boolean' THEN
      RAISE EXCEPTION 'Borrador inválido';
    END IF;
    FOREACH clave IN ARRAY ARRAY['identificacion','nombre','nombre2','apellido1','apellido2','comentario'] LOOP
      limite := CASE clave WHEN 'identificacion' THEN 30 WHEN 'comentario' THEN 5000 ELSE 100 END;
      IF jsonb_typeof(p_datos->clave) IS DISTINCT FROM 'string' OR length(p_datos->>clave) > limite THEN
        RAISE EXCEPTION 'Borrador inválido';
      END IF;
    END LOOP;
  END IF;
  PERFORM pg_advisory_xact_lock(p_autor_id, coalesce(p_persona_id,0));
  IF p_datos IS NOT NULL AND EXISTS (SELECT 1 FROM public.resenas r JOIN public.personas p ON p.id=r.persona_id
    WHERE r.autor_id=p_autor_id AND (r.persona_id=p_persona_id OR
      p.identificacion=regexp_replace(p_datos->>'identificacion','[^0-9]','','g'))) THEN
    RETURN QUERY SELECT false, NULL::uuid; RETURN;
  END IF;
  SELECT b.version INTO actual FROM privado.borradores_resena b
    WHERE b.autor_id=p_autor_id AND b.contexto=coalesce(p_persona_id,0) FOR UPDATE;
  IF actual IS DISTINCT FROM p_version THEN RETURN QUERY SELECT false, NULL::uuid; RETURN; END IF;
  INSERT INTO privado.borradores_resena(autor_id,contexto,version,datos)
    VALUES(p_autor_id,coalesce(p_persona_id,0),nueva,p_datos)
    ON CONFLICT(autor_id,contexto) DO UPDATE SET version=nueva,datos=p_datos,actualizado_en=clock_timestamp();
  RETURN QUERY SELECT true, nueva;
END;
$$;

CREATE OR REPLACE FUNCTION privado.iniciar_activacion_cuenta()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $$
BEGIN
  IF NEW.auth_user_id IS NOT NULL AND NEW.rol IN ('propietario','agencia') AND NEW.activo
    AND NEW.creado_en >= (SELECT iniciada_en FROM privado.activacion_config WHERE id) THEN
    INSERT INTO privado.activacion_cuentas(usuario_id,creada_en) VALUES(NEW.id,clock_timestamp()) ON CONFLICT DO NOTHING;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_usuarios_activacion ON public.usuarios;
CREATE TRIGGER trg_usuarios_activacion AFTER INSERT ON public.usuarios
  FOR EACH ROW EXECUTE FUNCTION privado.iniciar_activacion_cuenta();

-- El trigger no amplía permisos de escritura. La API ya valida el autor y el
-- estado antes del INSERT; el acceso privado se requiere también en ese camino.
CREATE OR REPLACE FUNCTION privado.registrar_activacion_resena()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE autor public.usuarios%ROWTYPE; decision text; documento text;
BEGIN
  IF current_setting('role',true) IN ('anon','authenticated') AND NOT EXISTS (
    SELECT 1 FROM public.usuarios u WHERE u.id=NEW.autor_id AND u.auth_user_id=auth.uid() AND u.activo) THEN
    RAISE EXCEPTION 'Autor no autorizado';
  END IF;
  SELECT * INTO autor FROM public.usuarios WHERE id=NEW.autor_id;
  IF TG_OP='INSERT' THEN
    -- Siempre bloquea en orden: general, luego ficha. Mantiene tombstones UUID
    -- para invalidar autosaves antiguos incluso cuando aún no había borrador.
    PERFORM pg_advisory_xact_lock(NEW.autor_id,0);
    PERFORM pg_advisory_xact_lock(NEW.autor_id,NEW.persona_id);
    SELECT identificacion INTO documento FROM public.personas WHERE id=NEW.persona_id;
    INSERT INTO privado.borradores_resena(autor_id,contexto,datos) VALUES(NEW.autor_id,0,NULL)
      ON CONFLICT(autor_id,contexto) DO UPDATE SET datos=NULL,version=gen_random_uuid(),actualizado_en=clock_timestamp()
      WHERE privado.borradores_resena.datos IS NULL OR
        regexp_replace(privado.borradores_resena.datos->>'identificacion','[^0-9]','','g')=documento;
    INSERT INTO privado.borradores_resena(autor_id,contexto,datos) VALUES(NEW.autor_id,NEW.persona_id,NULL)
      ON CONFLICT(autor_id,contexto) DO UPDATE SET datos=NULL,version=gen_random_uuid(),actualizado_en=clock_timestamp();
    IF autor.rol IN ('propietario','agencia') AND NEW.creado_en >= (SELECT iniciada_en FROM privado.activacion_config WHERE id) THEN
      INSERT INTO privado.revision_tiempos(resena_id,enviada_en) VALUES(NEW.id,clock_timestamp()) ON CONFLICT DO NOTHING;
      UPDATE privado.activacion_cuentas SET primera_resena_en=coalesce(primera_resena_en,clock_timestamp()) WHERE usuario_id=NEW.autor_id;
    END IF;
  END IF;
  IF NEW.estado='publicada' THEN
    UPDATE privado.revision_tiempos SET aprobada_en=coalesce(aprobada_en,clock_timestamp()) WHERE resena_id=NEW.id;
    UPDATE privado.activacion_cuentas SET primera_aprobacion_en=coalesce(primera_aprobacion_en,clock_timestamp())
      WHERE usuario_id=NEW.autor_id AND primera_resena_en IS NOT NULL;
  END IF;
  IF TG_OP='UPDATE' AND autor.rol <> 'admin' AND (
    NEW.estado IS DISTINCT FROM OLD.estado OR NEW.permite_correccion IS DISTINCT FROM OLD.permite_correccion) THEN
    decision := CASE WHEN NEW.estado='publicada' THEN 'aprobada'
      WHEN NEW.estado='oculta' AND NEW.permite_correccion THEN 'corregir'
      WHEN NEW.estado='oculta' THEN 'rechazada' END;
    IF decision IS NOT NULL THEN
      INSERT INTO privado.avisos_moderacion(resena_id,autor_id,version,accion,email,nombre)
        VALUES(NEW.id,NEW.autor_id,NEW.version,decision,autor.email,autor.nombre) ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_resenas_activacion ON public.resenas;
CREATE TRIGGER trg_resenas_activacion AFTER INSERT OR UPDATE ON public.resenas
  FOR EACH ROW EXECUTE FUNCTION privado.registrar_activacion_resena();

CREATE OR REPLACE FUNCTION public.registrar_primera_consulta(p_usuario_id integer)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path = pg_catalog AS $$
  UPDATE privado.activacion_cuentas SET primera_consulta_en=clock_timestamp()
    WHERE usuario_id=p_usuario_id AND primera_consulta_en IS NULL AND primera_aprobacion_en IS NOT NULL
      AND EXISTS(SELECT 1 FROM public.usuarios WHERE id=p_usuario_id AND activo AND rol IN ('propietario','agencia'))
      AND EXISTS(SELECT 1 FROM public.accesos_consulta(ARRAY[p_usuario_id]) WHERE puede_consultar);
$$;

CREATE OR REPLACE FUNCTION public.resumen_activacion(p_admin_id integer, p_dias integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $$
DECLARE resultado jsonb; desde timestamptz; hasta timestamptz;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.usuarios WHERE id=p_admin_id AND activo AND rol='admin') THEN
    RAISE EXCEPTION 'Administración no autorizada';
  END IF;
  IF p_dias NOT IN (7,28) THEN RAISE EXCEPTION 'Período inválido'; END IF;
  -- Días completos de Costa Rica. La tasa usa solo cuentas con 7 días completos.
  hasta := date_trunc('day',clock_timestamp() AT TIME ZONE 'America/Costa_Rica') AT TIME ZONE 'America/Costa_Rica';
  desde := hasta - make_interval(days=>p_dias);
  SELECT jsonb_build_object('cuentas',count(*),'enviaron',count(primera_resena_en),
    'aprobadas',count(primera_aprobacion_en),'consultaron',count(primera_consulta_en),
    'maduras',0,'activadas_7d',0) INTO resultado
    FROM privado.activacion_cuentas a JOIN public.usuarios u ON u.id=a.usuario_id
    WHERE a.creada_en>=desde AND a.creada_en<hasta AND u.rol IN ('propietario','agencia');
  RETURN resultado || jsonb_build_object('desde',desde,'hasta',hasta,
    'maduras',(SELECT count(*) FROM privado.activacion_cuentas a JOIN public.usuarios u ON u.id=a.usuario_id
      WHERE a.creada_en>=desde-interval '7 days' AND a.creada_en<hasta-interval '7 days' AND u.rol IN ('propietario','agencia')),
    'activadas_7d',(SELECT count(*) FROM privado.activacion_cuentas a JOIN public.usuarios u ON u.id=a.usuario_id
      WHERE a.creada_en>=desde-interval '7 days' AND a.creada_en<hasta-interval '7 days' AND u.rol IN ('propietario','agencia')
        AND a.primera_consulta_en<=a.creada_en+interval '7 days'),
    'iniciada_en',(SELECT iniciada_en FROM privado.activacion_config WHERE id),
    'revisiones',(SELECT count(*) FROM privado.revision_tiempos WHERE aprobada_en>=desde AND aprobada_en<hasta),
    'mediana_horas',(SELECT percentile_cont(0.5) WITHIN GROUP(ORDER BY extract(epoch FROM (aprobada_en-enviada_en))/3600)
      FROM privado.revision_tiempos WHERE aprobada_en>=desde AND aprobada_en<hasta));
END;
$$;

CREATE OR REPLACE FUNCTION public.reclamar_avisos_moderacion(p_limite integer)
RETURNS SETOF privado.avisos_moderacion
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $$
BEGIN
  -- No reenviar decisiones superadas, cuentas desactivadas o correos cambiados.
  UPDATE privado.avisos_moderacion a SET estado='omitida',cuerpo=NULL,token=NULL
    WHERE a.estado IN ('pendiente','procesando') AND EXISTS(SELECT 1 FROM public.resenas r JOIN public.usuarios u ON u.id=a.autor_id
      WHERE r.id=a.resena_id AND (r.version<>a.version OR NOT u.activo OR u.email<>a.email OR u.rol='admin'
        OR a.email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' OR a.email ~ '@(legacy\.laprotec|[^@]*\.invalid)$'));
  -- Resend conserva claves 24h. Tras 23h, un timeout incierto exige revisión,
  -- evitando duplicar un envío cuya confirmación pudo perderse.
  UPDATE privado.avisos_moderacion SET estado='revision',token=NULL
    WHERE estado IN ('pendiente','procesando') AND primer_intento_en<=clock_timestamp()-interval '23 hours';
  RETURN QUERY WITH candidatas AS (
    SELECT id FROM privado.avisos_moderacion WHERE
      (estado='pendiente' AND proximo_intento_en<=clock_timestamp()) OR
      (estado='procesando' AND proximo_intento_en<=clock_timestamp())
      ORDER BY creado_en LIMIT least(greatest(coalesce(p_limite,1),1),10) FOR UPDATE SKIP LOCKED
  ) UPDATE privado.avisos_moderacion a SET estado='procesando',token=gen_random_uuid(),
      proximo_intento_en=clock_timestamp()+interval '5 minutes'
    FROM candidatas c WHERE a.id=c.id RETURNING a.*;
END;
$$;

CREATE OR REPLACE FUNCTION public.preparar_aviso_moderacion(p_id uuid, p_token uuid, p_cuerpo jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $$
DECLARE resultado jsonb;
BEGIN
  UPDATE privado.avisos_moderacion SET cuerpo=coalesce(cuerpo,p_cuerpo),
    primer_intento_en=coalesce(primer_intento_en,clock_timestamp()),intentos=intentos+1
    WHERE id=p_id AND token=p_token AND estado='procesando'
    RETURNING cuerpo INTO resultado;
  RETURN resultado;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalizar_aviso_moderacion(p_id uuid, p_token uuid, p_estado text, p_proveedor_id text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $$
BEGIN
  IF p_estado NOT IN ('enviada','pendiente','revision') THEN RAISE EXCEPTION 'Estado inválido'; END IF;
  UPDATE privado.avisos_moderacion SET estado=CASE WHEN p_estado='pendiente' AND intentos>=5 THEN 'revision' ELSE p_estado END,
    proveedor_id=p_proveedor_id,token=NULL,
    proximo_intento_en=clock_timestamp()+make_interval(mins=>least(60,power(3,intentos)::integer)),
    cuerpo=CASE WHEN p_estado='enviada' THEN NULL ELSE cuerpo END
    WHERE id=p_id AND token=p_token AND estado='procesando';
END;
$$;

CREATE OR REPLACE FUNCTION public.resumen_avisos_moderacion(p_admin_id integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.usuarios WHERE id=p_admin_id AND activo AND rol='admin') THEN
    RAISE EXCEPTION 'Administración no autorizada'; END IF;
  RETURN (SELECT jsonb_build_object('pendientes',count(*) FILTER(WHERE estado IN ('pendiente','procesando')),
    'revision',count(*) FILTER(WHERE estado='revision'),
    'detalle_revision',coalesce((SELECT jsonb_agg(to_jsonb(f)) FROM (
      SELECT id,resena_id,accion,intentos,creado_en,proveedor_id FROM privado.avisos_moderacion
      WHERE estado='revision' ORDER BY creado_en,id LIMIT 10
    ) f),'[]'::jsonb)) FROM privado.avisos_moderacion);
END;
$$;

-- Borrado de datos vencidos y copias de entrega, sin borrar hitos ni versiones
-- de concurrencia. Se ejecuta con el worker; nunca activa ni publica reseñas.
CREATE OR REPLACE FUNCTION public.limpiar_datos_activacion()
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $$
BEGIN
  UPDATE privado.borradores_resena SET datos=NULL,version=gen_random_uuid()
    WHERE datos IS NOT NULL AND actualizado_en<=clock_timestamp()-interval '30 days';
  DELETE FROM privado.avisos_moderacion WHERE estado IN ('enviada','omitida') AND creado_en<clock_timestamp()-interval '30 days';
END;
$$;

REVOKE ALL ON FUNCTION privado.iniciar_activacion_cuenta(),privado.registrar_activacion_resena() FROM PUBLIC,anon,authenticated;
DO $$ DECLARE f regprocedure; BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.leer_borrador_resena(integer,integer)'::regprocedure,
    'public.guardar_borrador_resena(integer,integer,uuid,jsonb)'::regprocedure,
    'public.registrar_primera_consulta(integer)'::regprocedure,
    'public.resumen_activacion(integer,integer)'::regprocedure,
    'public.reclamar_avisos_moderacion(integer)'::regprocedure,
    'public.preparar_aviso_moderacion(uuid,uuid,jsonb)'::regprocedure,
    'public.finalizar_aviso_moderacion(uuid,uuid,text,text)'::regprocedure,
    'public.resumen_avisos_moderacion(integer)'::regprocedure,
    'public.limpiar_datos_activacion()'::regprocedure
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f);
  END LOOP;
END $$;
COMMIT;

BEGIN;

-- No new extension or changes to the stored identity. Search-only normalization.
CREATE OR REPLACE FUNCTION public.normalizar_nombre_busqueda(p_texto text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE SECURITY INVOKER SET search_path = pg_catalog AS $$
  SELECT trim(regexp_replace(translate(lower(normalize(coalesce(p_texto,''), NFKC)),
    'áéíóúüñ','aeiouun'), '[^[:alnum:]]+', ' ', 'g'));
$$;
CREATE OR REPLACE FUNCTION public.normalizar_documento_busqueda(p_texto text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE SECURITY INVOKER SET search_path = pg_catalog AS $$
  SELECT lower(regexp_replace(normalize(coalesce(p_texto,''), NFKC), '[[:space:].-]+', '', 'g'));
$$;

CREATE INDEX IF NOT EXISTS idx_personas_nombre_busqueda ON public.personas USING gin (
  to_tsvector('simple'::regconfig, public.normalizar_nombre_busqueda(
    nombre || ' ' || coalesce(nombre2,'') || ' ' || apellido1 || ' ' || coalesce(apellido2,''))));
CREATE INDEX IF NOT EXISTS idx_personas_documento_busqueda ON public.personas (
  public.normalizar_documento_busqueda(identificacion) text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_resenas_publicadas_persona ON public.resenas (persona_id, creado_en DESC) WHERE estado='publicada';

CREATE OR REPLACE FUNCTION public.buscar_fichas_relevantes(p_usuario_id integer, p_q text DEFAULT '', p_pagina integer DEFAULT 1)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = pg_catalog SET plan_cache_mode = force_custom_plan AS $$
DECLARE consulta text := trim(normalize(coalesce(p_q,''), NFKC));
  tipo text := 'nombre'; documento text; palabras text[]; prefijos tsquery; exactas tsquery; resultado jsonb;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.accesos_consulta(ARRAY[p_usuario_id]) WHERE puede_consultar) THEN
    RAISE EXCEPTION 'Consulta no autorizada' USING ERRCODE='42501'; END IF;
  IF p_pagina IS NULL OR p_pagina<1 OR p_pagina>100000 OR length(consulta)>150 THEN
    RAISE EXCEPTION 'Búsqueda inválida' USING ERRCODE='22023'; END IF;
  IF consulta='' THEN tipo := 'listado';
  ELSIF consulta ~ '^[0-9[:space:].-]+$' OR consulta ~* '^[a-z]{1,4}[[:space:].-]*[0-9][a-z0-9[:space:].-]*$' THEN
    tipo := 'documento'; documento := public.normalizar_documento_busqueda(consulta);
    IF length(documento)<4 THEN RETURN jsonb_build_object('total',0,'fichas','[]'::jsonb); END IF;
  ELSE
    consulta := public.normalizar_nombre_busqueda(consulta);
    SELECT array_agg(p) INTO palabras FROM unnest(string_to_array(consulta,' ')) p WHERE length(p)>=2;
    IF coalesce(array_length(palabras,1),0) NOT BETWEEN 1 AND 12 THEN
      RETURN jsonb_build_object('total',0,'fichas','[]'::jsonb); END IF;
    SELECT to_tsquery('simple',string_agg(quote_literal(p)||':*',' & ')),
      to_tsquery('simple',string_agg(quote_literal(p),' & ')) INTO prefijos,exactas FROM unnest(palabras) p;
  END IF;

  WITH candidatas AS MATERIALIZED (
    SELECT p.id,p.identificacion,p.nombre,p.nombre2,p.apellido1,p.apellido2,p.foto_url,
      CASE WHEN tipo='listado' THEN NULL
        WHEN tipo='documento' AND public.normalizar_documento_busqueda(p.identificacion)=documento THEN 'documento_exacto'
        WHEN tipo='documento' THEN 'documento_parcial'
        WHEN public.normalizar_nombre_busqueda(p.nombre||' '||coalesce(p.nombre2,'')||' '||p.apellido1||' '||coalesce(p.apellido2,''))=consulta THEN 'nombre_completo'
        WHEN to_tsvector('simple',public.normalizar_nombre_busqueda(p.nombre||' '||coalesce(p.nombre2,'')||' '||p.apellido1||' '||coalesce(p.apellido2,''))) @@ exactas THEN 'palabras_completas'
        ELSE 'nombre_parcial' END AS coincidencia,
      public.normalizar_nombre_busqueda(p.apellido1||' '||coalesce(p.apellido2,'')||' '||p.nombre||' '||coalesce(p.nombre2,'')) AS orden,
      CASE WHEN tipo='nombre' THEN cardinality(string_to_array(public.normalizar_nombre_busqueda(p.nombre||' '||coalesce(p.nombre2,'')||' '||p.apellido1||' '||coalesce(p.apellido2,'')),' ')) ELSE 0 END AS longitud_nombre
    FROM public.personas p
    WHERE EXISTS(SELECT 1 FROM public.resenas r WHERE r.persona_id=p.id AND r.estado='publicada')
      AND (tipo='listado'
        OR (tipo='documento' AND public.normalizar_documento_busqueda(p.identificacion) LIKE documento||'%')
        OR (tipo='nombre' AND to_tsvector('simple',public.normalizar_nombre_busqueda(p.nombre||' '||coalesce(p.nombre2,'')||' '||p.apellido1||' '||coalesce(p.apellido2,''))) @@ prefijos))
  ), pagina AS (
    SELECT c.* FROM candidatas c ORDER BY CASE c.coincidencia
      WHEN 'documento_exacto' THEN 0 WHEN 'nombre_completo' THEN 0
      WHEN 'palabras_completas' THEN 1 ELSE 2 END, c.longitud_nombre,c.orden,c.id
    LIMIT 20 OFFSET (p_pagina::bigint-1)*20
  )
  SELECT jsonb_build_object('total',(SELECT count(*) FROM candidatas),
    'fichas',coalesce((SELECT jsonb_agg(jsonb_build_object(
      'persona',jsonb_build_object('id',s.id,'identificacion',s.identificacion,'nombre',s.nombre,'nombre2',s.nombre2,
        'apellido1',s.apellido1,'apellido2',s.apellido2,'foto_url',s.foto_url),
      'coincidencia',s.coincidencia,'resenas',r.cantidad,'ultima',r.ultima)
      ORDER BY CASE s.coincidencia WHEN 'documento_exacto' THEN 0 WHEN 'nombre_completo' THEN 0 WHEN 'palabras_completas' THEN 1 ELSE 2 END,s.longitud_nombre,s.orden,s.id)
      FROM pagina s CROSS JOIN LATERAL (
        SELECT count(*) AS cantidad,max(creado_en) AS ultima FROM public.resenas WHERE persona_id=s.id AND estado='publicada'
      ) r),'[]'::jsonb)) INTO resultado;
  RETURN resultado;
END;
$$;

-- Only outcome receipts; no query, document, person ID, URL or review content.
CREATE TABLE IF NOT EXISTS privado.resultados_busqueda (
  id uuid PRIMARY KEY,
  usuario_id integer NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  iniciada_en timestamptz NOT NULL,
  tipo text NOT NULL CHECK(tipo IN ('nombre','documento')),
  con_resultados boolean NOT NULL,
  abrio_ficha boolean NOT NULL DEFAULT false CHECK(NOT abrio_ficha OR con_resultados)
);
CREATE INDEX IF NOT EXISTS idx_resultados_busqueda_fecha ON privado.resultados_busqueda(iniciada_en,usuario_id);
ALTER TABLE privado.resultados_busqueda ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE privado.resultados_busqueda FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE privado.resultados_busqueda TO service_role;

CREATE TABLE IF NOT EXISTS privado.busqueda_config (
  id boolean PRIMARY KEY DEFAULT true CHECK(id), iniciada_en timestamptz NOT NULL DEFAULT clock_timestamp()
);
INSERT INTO privado.busqueda_config(id) VALUES(true) ON CONFLICT DO NOTHING;
ALTER TABLE privado.busqueda_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE privado.busqueda_config FROM PUBLIC,anon,authenticated;
GRANT SELECT ON TABLE privado.busqueda_config TO service_role;

CREATE OR REPLACE FUNCTION public.registrar_resultado_busqueda(p_usuario_id integer,p_id uuid,p_iniciada_en timestamptz,
  p_tipo text,p_con_resultados boolean,p_abrio_ficha boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN
  IF p_id IS NULL OR p_iniciada_en IS NULL OR p_iniciada_en>clock_timestamp()+interval '5 seconds'
    OR p_iniciada_en<clock_timestamp()-interval '30 minutes' OR p_tipo IS NULL OR p_tipo NOT IN ('nombre','documento')
    OR p_con_resultados IS NULL OR p_abrio_ficha IS NULL OR (p_abrio_ficha AND NOT p_con_resultados) THEN
    RAISE EXCEPTION 'Resultado inválido' USING ERRCODE='22023'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.usuarios WHERE id=p_usuario_id AND activo AND rol IN ('propietario','agencia'))
    OR NOT EXISTS(SELECT 1 FROM public.accesos_consulta(ARRAY[p_usuario_id]) WHERE puede_consultar) THEN
    RAISE EXCEPTION 'Consulta no autorizada' USING ERRCODE='42501'; END IF;
  INSERT INTO privado.resultados_busqueda(id,usuario_id,iniciada_en,tipo,con_resultados,abrio_ficha)
    VALUES(p_id,p_usuario_id,p_iniciada_en,p_tipo,p_con_resultados,p_abrio_ficha)
    ON CONFLICT(id) DO UPDATE SET abrio_ficha=privado.resultados_busqueda.abrio_ficha OR EXCLUDED.abrio_ficha
      WHERE privado.resultados_busqueda.usuario_id=EXCLUDED.usuario_id
        AND privado.resultados_busqueda.iniciada_en=EXCLUDED.iniciada_en
        AND privado.resultados_busqueda.tipo=EXCLUDED.tipo AND privado.resultados_busqueda.con_resultados=EXCLUDED.con_resultados;
  DELETE FROM privado.resultados_busqueda WHERE iniciada_en<clock_timestamp()-interval '90 days';
END;
$$;

CREATE OR REPLACE FUNCTION public.resumen_resultados_busqueda(p_admin_id integer,p_dias integer DEFAULT 7)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE hasta timestamptz := date_trunc('day',clock_timestamp() AT TIME ZONE 'America/Costa_Rica') AT TIME ZONE 'America/Costa_Rica';
  desde timestamptz; resultado jsonb;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.usuarios WHERE id=p_admin_id AND activo AND rol='admin') THEN
    RAISE EXCEPTION 'Administración no autorizada' USING ERRCODE='42501'; END IF;
  IF p_dias IS NULL OR p_dias NOT IN (7,28) THEN RAISE EXCEPTION 'Período inválido' USING ERRCODE='22023'; END IF;
  desde := hasta - make_interval(days=>p_dias);
  DELETE FROM privado.resultados_busqueda WHERE iniciada_en<clock_timestamp()-interval '90 days';
  WITH eventos AS MATERIALIZED (
    SELECT * FROM privado.resultados_busqueda WHERE iniciada_en>=desde AND iniciada_en<hasta
  ), miembros AS (
    SELECT usuario_id,bool_or(abrio_ficha) AS abrio,
      count(DISTINCT (iniciada_en AT TIME ZONE 'America/Costa_Rica')::date)>1 AS regreso
    FROM eventos GROUP BY usuario_id
  )
  SELECT jsonb_build_object('busquedas',count(*),'sin_resultados',count(*) FILTER(WHERE NOT con_resultados),
    'con_resultados',count(*) FILTER(WHERE con_resultados),'con_apertura',count(*) FILTER(WHERE abrio_ficha),
    'miembros',(SELECT count(*) FROM miembros),'miembros_con_apertura',(SELECT count(*) FROM miembros WHERE abrio),
    'miembros_recurrentes',(SELECT count(*) FROM miembros WHERE regreso),
    'documentos',count(*) FILTER(WHERE tipo='documento'),'nombres',count(*) FILTER(WHERE tipo='nombre'),
    'desde',desde,'hasta',hasta,'iniciada_en',(SELECT iniciada_en FROM privado.busqueda_config WHERE id))
  INTO resultado FROM eventos;
  RETURN resultado;
END;
$$;

-- Reuse the existing five-minute cleanup worker so retention holds without traffic.
CREATE OR REPLACE FUNCTION public.limpiar_datos_activacion()
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $$
BEGIN
  UPDATE privado.borradores_resena SET datos=NULL,version=gen_random_uuid()
    WHERE datos IS NOT NULL AND actualizado_en<=clock_timestamp()-interval '30 days';
  DELETE FROM privado.avisos_moderacion WHERE estado IN ('enviada','omitida') AND creado_en<clock_timestamp()-interval '30 days';
  DELETE FROM privado.resultados_busqueda WHERE iniciada_en<clock_timestamp()-interval '90 days';
END;
$$;
REVOKE ALL ON FUNCTION public.limpiar_datos_activacion() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.limpiar_datos_activacion() TO service_role;

REVOKE ALL ON FUNCTION public.normalizar_nombre_busqueda(text),public.normalizar_documento_busqueda(text),
  public.buscar_fichas_relevantes(integer,text,integer),
  public.registrar_resultado_busqueda(integer,uuid,timestamptz,text,boolean,boolean),
  public.resumen_resultados_busqueda(integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.normalizar_nombre_busqueda(text),public.normalizar_documento_busqueda(text),
  public.buscar_fichas_relevantes(integer,text,integer),
  public.registrar_resultado_busqueda(integer,uuid,timestamptz,text,boolean,boolean),
  public.resumen_resultados_busqueda(integer,integer) TO service_role;

COMMIT;
