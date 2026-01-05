-- Remover política existente
DROP POLICY IF EXISTS "Anyone can view appointments" ON public.appointments;

-- Criar política PERMISSIVE para leitura
CREATE POLICY "Anyone can view appointments"
ON public.appointments
FOR SELECT
USING (true);