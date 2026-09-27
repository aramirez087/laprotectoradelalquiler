-- Una reseña nueva de quien no administra queda en revisión.
-- Solo administración, con la clave de servicio, puede pasarla a publicada.
-- No borra datos. Se puede ejecutar más de una vez.
BEGIN;

DROP POLICY IF EXISTS resenas_escritura ON resenas;
CREATE POLICY resenas_escritura ON resenas
  FOR INSERT TO authenticated
  WITH CHECK (
    autor_id = (SELECT id FROM usuarios WHERE auth_user_id = auth.uid())
    AND (
      estado = 'borrador'
      OR (SELECT rol FROM usuarios WHERE auth_user_id = auth.uid()) = 'admin'
    )
  );

COMMIT;
