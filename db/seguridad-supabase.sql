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
