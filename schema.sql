-- ============================================================================
-- La Protectora del Alquiler — Esquema v2 (PostgreSQL / Supabase)
-- ----------------------------------------------------------------------------
-- Reemplaza el esquema legacy MySQL `laprotec_laprotectora` (ver legacy/schema.sql).
-- Ejecutar de arriba a abajo. Idempotencia: usar DROP IF EXISTS antes de crear.
-- ============================================================================

-- ============================ LOOKUPS ======================================

-- El esquema completo reinicia también los recibos; las migraciones los conservan.
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

  IF p_nombre IS NULL OR length(btrim(p_nombre)) < 2 OR p_apellido1 IS NULL OR length(btrim(p_apellido1)) < 2
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
