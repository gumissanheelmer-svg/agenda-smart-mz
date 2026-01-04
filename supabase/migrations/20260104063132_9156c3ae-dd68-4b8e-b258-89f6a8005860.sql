-- Remover a política existente que não funciona para utilizadores anónimos
DROP POLICY IF EXISTS "Anyone can create appointments" ON public.appointments;

-- Criar nova política que permite INSERT para utilizadores anónimos e autenticados
CREATE POLICY "Public can create appointments" 
ON public.appointments 
FOR INSERT 
TO anon, authenticated 
WITH CHECK (true);