-- Cierra la lectura anónima, la auto-promoción a administrador y las tablas
-- públicas sin RLS. Idempotente. No borra fichas ni reseñas.
-- No usar schema.sql ni npm run db:aplicar sobre una base con datos.

CREATE OR REPLACE FUNCTION public.fn_personas_search() RETURNS trigger
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

-- auth.role() es el rol del JWT. session_user sigue siendo el rol de conexión
-- (authenticator o postgres) y no distingue a la persona que llama por la API.
CREATE OR REPLACE FUNCTION public.fn_usuarios_proteger_rol() RETURNS trigger
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

DROP TRIGGER IF EXISTS trg_usuarios_proteger_rol ON public.usuarios;
CREATE TRIGGER trg_usuarios_proteger_rol
  BEFORE INSERT OR UPDATE ON public.usuarios
  FOR EACH ROW EXECUTE FUNCTION public.fn_usuarios_proteger_rol();

CREATE OR REPLACE FUNCTION public.sesion_activa()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios
    WHERE auth_user_id = auth.uid()
      AND activo
  );
$$;

-- La consulta del registro exige cuenta activa y, si no administra, una reseña
-- ya publicada. SECURITY DEFINER evita la recursión con las políticas.
CREATE OR REPLACE FUNCTION public.puede_leer_registro()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios u
    WHERE u.auth_user_id = auth.uid()
      AND u.activo
      AND (
        u.rol = 'admin'
        OR EXISTS (
          SELECT 1
          FROM public.resenas r
          WHERE r.autor_id = u.id
            AND r.estado = 'publicada'
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.fn_usuarios_proteger_rol() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_personas_search() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sesion_activa() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.puede_leer_registro() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_usuarios_proteger_rol() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_personas_search() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sesion_activa() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.puede_leer_registro() TO authenticated, service_role;

DO $$
DECLARE
  tabla text;
  columnas text;
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
    RAISE EXCEPTION 'No se encontró el rol authenticated de Supabase';
  END IF;

  FOREACH tabla IN ARRAY catalogos || privadas || ARRAY['personas', 'usuarios', 'resenas', 'denuncias', 'bitacora']
  LOOP
    IF to_regclass(format('public.%I', tabla)) IS NULL THEN
      CONTINUE;
    END IF;
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM PUBLIC, anon', tabla);
    SELECT string_agg(quote_ident(attname), ', ' ORDER BY attnum) INTO columnas
    FROM pg_attribute
    WHERE attrelid = to_regclass(format('public.%I', tabla))
      AND attnum > 0
      AND NOT attisdropped;
    IF columnas IS NOT NULL THEN
      EXECUTE format('REVOKE ALL PRIVILEGES (%s) ON TABLE public.%I FROM PUBLIC, anon', columnas, tabla);
    END IF;
  END LOOP;

  FOREACH tabla IN ARRAY privadas LOOP
    IF to_regclass(format('public.%I', tabla)) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tabla);
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM authenticated', tabla);
    SELECT string_agg(quote_ident(attname), ', ' ORDER BY attnum) INTO columnas
    FROM pg_attribute
    WHERE attrelid = to_regclass(format('public.%I', tabla))
      AND attnum > 0 AND NOT attisdropped;
    IF columnas IS NOT NULL THEN
      EXECUTE format('REVOKE ALL PRIVILEGES (%s) ON TABLE public.%I FROM authenticated', columnas, tabla);
    END IF;
  END LOOP;

  FOREACH tabla IN ARRAY catalogos LOOP
    IF to_regclass(format('public.%I', tabla)) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tabla);
    EXECUTE format('DROP POLICY IF EXISTS catalogo_lectura ON public.%I', tabla);
    EXECUTE format(
      'CREATE POLICY catalogo_lectura ON public.%I FOR SELECT TO authenticated USING (public.sesion_activa())',
      tabla
    );
    EXECUTE format(
      'REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.%I FROM PUBLIC, anon, authenticated',
      tabla
    );
    EXECUTE format('GRANT SELECT ON TABLE public.%I TO authenticated', tabla);
  END LOOP;
END;
$$;

ALTER TABLE public.personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resenas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.denuncias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS personas_lectura ON public.personas;
DROP POLICY IF EXISTS personas_escritura ON public.personas;
CREATE POLICY personas_lectura ON public.personas
  FOR SELECT TO authenticated
  USING (public.puede_leer_registro());
CREATE POLICY personas_escritura ON public.personas
  FOR INSERT TO authenticated
  WITH CHECK (public.sesion_activa());

DROP POLICY IF EXISTS usuarios_lectura ON public.usuarios;
DROP POLICY IF EXISTS usuarios_crear ON public.usuarios;
DROP POLICY IF EXISTS usuarios_actualizar ON public.usuarios;
DROP POLICY IF EXISTS usuarios_eliminar ON public.usuarios;
CREATE POLICY usuarios_lectura ON public.usuarios
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());
CREATE POLICY usuarios_actualizar ON public.usuarios
  FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

DROP POLICY IF EXISTS resenas_lectura ON public.resenas;
DROP POLICY IF EXISTS resenas_escritura ON public.resenas;
CREATE POLICY resenas_lectura ON public.resenas
  FOR SELECT TO authenticated
  USING (estado = 'publicada' AND public.puede_leer_registro());
CREATE POLICY resenas_escritura ON public.resenas
  FOR INSERT TO authenticated
  WITH CHECK (
    autor_id = (SELECT id FROM public.usuarios WHERE auth_user_id = auth.uid() AND activo)
    AND (
      estado = 'borrador'
      OR (SELECT rol FROM public.usuarios WHERE auth_user_id = auth.uid() AND activo) = 'admin'
    )
  );

DROP POLICY IF EXISTS denuncias_lectura ON public.denuncias;
DROP POLICY IF EXISTS denuncias_escritura ON public.denuncias;
CREATE POLICY denuncias_lectura ON public.denuncias
  FOR SELECT TO authenticated
  USING (denunciante_id = (SELECT id FROM public.usuarios WHERE auth_user_id = auth.uid()));
CREATE POLICY denuncias_escritura ON public.denuncias
  FOR INSERT TO authenticated
  WITH CHECK (
    public.puede_leer_registro()
    AND denunciante_id = (SELECT id FROM public.usuarios WHERE auth_user_id = auth.uid() AND activo)
  );

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

REVOKE ALL PRIVILEGES ON TABLE public.resenas FROM PUBLIC, anon, authenticated;
DO $$
DECLARE
  columnas text;
BEGIN
  SELECT string_agg(quote_ident(attname), ', ' ORDER BY attnum) INTO columnas
  FROM pg_attribute
  WHERE attrelid = 'public.resenas'::regclass
    AND attnum > 0
    AND NOT attisdropped;
  EXECUTE format(
    'REVOKE ALL PRIVILEGES (%s) ON TABLE public.resenas FROM PUBLIC, anon, authenticated',
    columnas
  );
END;
$$;
REVOKE SELECT (autor_id) ON TABLE public.resenas FROM PUBLIC, anon, authenticated;
GRANT SELECT (
  id, persona_id, vivienda_id, tipo, calificacion_id, recomienda, drogas,
  dano_vivienda_id, detalle_dano, proceso_judicial_id, tipo_contrato_id,
  tipo_alquiler_id, tiempo_alquiler_id, fecha_inicio_alquiler, fecha_fin_alquiler,
  comentario, verificada, detalle_verificacion, estado, fuente, id_fuente,
  creado_en, actualizado_en, anonima
) ON TABLE public.resenas TO authenticated;
GRANT INSERT ON TABLE public.resenas TO authenticated;
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE public.resenas FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT ON TABLE public.denuncias TO authenticated;
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE public.denuncias FROM PUBLIC, anon, authenticated;

-- Las cuentas de demostración del repositorio no deben poder reclamarse.
UPDATE public.usuarios
SET
  email = CASE email
    WHEN 'admin@laprotec.test' THEN 'seed-admin@cuentas.invalid'
    WHEN 'propietario@laprotec.test' THEN 'seed-propietario@cuentas.invalid'
    WHEN 'inquilino@laprotec.test' THEN 'seed-inquilino@cuentas.invalid'
  END,
  rol = CASE WHEN rol = 'admin' THEN 'propietario' ELSE rol END,
  activo = false,
  actualizado_en = now()
WHERE auth_user_id IS NULL
  AND email IN (
    'admin@laprotec.test',
    'propietario@laprotec.test',
    'inquilino@laprotec.test'
  );

-- Un GRANT SELECT de tabla vuelve a abrir todas las columnas. La cédula, el
-- correo y el rol solo quedan en columnas que la sesión no puede leer o cambiar.
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
  ELSIF to_regprocedure('public.sesion_activa()') IS NOT NULL THEN
    DROP FUNCTION public.sesion_activa();
  END IF;
  IF to_regprocedure('public.puede_leer_registro()') IS NOT NULL
     AND to_regprocedure('privado.puede_leer_registro()') IS NULL THEN
    ALTER FUNCTION public.puede_leer_registro() SET SCHEMA privado;
  ELSIF to_regprocedure('public.puede_leer_registro()') IS NOT NULL THEN
    DROP FUNCTION public.puede_leer_registro();
  END IF;
  IF to_regprocedure('public.fn_usuarios_proteger_rol()') IS NOT NULL
     AND to_regprocedure('privado.fn_usuarios_proteger_rol()') IS NULL THEN
    ALTER FUNCTION public.fn_usuarios_proteger_rol() SET SCHEMA privado;
  ELSIF to_regprocedure('public.fn_usuarios_proteger_rol()') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_usuarios_proteger_rol ON public.usuarios;
    DROP FUNCTION public.fn_usuarios_proteger_rol();
    CREATE TRIGGER trg_usuarios_proteger_rol
      BEFORE INSERT OR UPDATE ON public.usuarios
      FOR EACH ROW EXECUTE FUNCTION privado.fn_usuarios_proteger_rol();
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
