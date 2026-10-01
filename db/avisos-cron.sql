-- Requiere pg_cron, pg_net y Vault ya habilitados en Supabase. Sin secretos en SQL.
CREATE OR REPLACE FUNCTION privado.despertar_worker_avisos()
RETURNS bigint LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE secreto text; solicitud bigint;
BEGIN
  PERFORM public.limpiar_datos_activacion();
  -- Conserva siete días de ejecuciones únicamente de nuestro propio job.
  DELETE FROM cron.job_run_details WHERE jobid IN (
    SELECT jobid FROM cron.job WHERE jobname='protectora-avisos-moderacion'
  ) AND end_time < clock_timestamp()-interval '7 days';
  IF NOT EXISTS(SELECT 1 FROM privado.avisos_moderacion
    WHERE estado IN ('pendiente','procesando') AND proximo_intento_en<=clock_timestamp()) THEN RETURN NULL; END IF;
  SELECT decrypted_secret INTO secreto FROM vault.decrypted_secrets WHERE name='protectora_avisos_cron';
  IF secreto IS NULL THEN RAISE EXCEPTION 'Falta el secreto del worker de avisos'; END IF;
  SELECT net.http_get(url:='https://www.protectoradelalquiler.com/api/avisos',
    headers:=jsonb_build_object('Authorization','Bearer '||secreto),timeout_milliseconds:=180000) INTO solicitud;
  RETURN solicitud;
END;
$$;
REVOKE ALL ON FUNCTION privado.despertar_worker_avisos() FROM PUBLIC,anon,authenticated,service_role;
-- pg_net conserva temporalmente los headers para ejecutar la petición.
-- Endurecimiento adicional cuando el rol puede revocar los permisos. En Supabase,
-- los objetos administrados por supabase_admin pueden conservar grants a PUBLIC:
-- verificar que net no esté expuesto por Data API y anon/authenticated sean NOLOGIN.
REVOKE ALL ON TABLE net.http_request_queue,net._http_response FROM PUBLIC,anon,authenticated;
