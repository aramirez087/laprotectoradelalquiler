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
