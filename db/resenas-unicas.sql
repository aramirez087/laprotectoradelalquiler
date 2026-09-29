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
