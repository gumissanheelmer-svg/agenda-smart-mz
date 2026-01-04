-- Remover políticas existentes
DROP POLICY IF EXISTS "Public can create appointments" ON public.appointments;
DROP POLICY IF EXISTS "Authenticated users can view appointments" ON public.appointments;

-- Recriar política INSERT explicitamente como PERMISSIVE
CREATE POLICY "Public can create appointments" 
ON public.appointments 
AS PERMISSIVE
FOR INSERT 
TO anon, authenticated 
WITH CHECK (true);

-- Recriar política SELECT para incluir anon (para verificar disponibilidade)
CREATE POLICY "Anyone can view appointments" 
ON public.appointments 
AS PERMISSIVE
FOR SELECT 
TO anon, authenticated 
USING (true);