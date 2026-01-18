-- Fix: Manager policy should use 'authenticated' role, not 'public'
DROP POLICY IF EXISTS "Managers can manage own barbershop appointments" ON public.appointments;

CREATE POLICY "Managers can manage own barbershop appointments"
ON public.appointments
FOR ALL
TO authenticated
USING (is_barbershop_manager(auth.uid(), barbershop_id))
WITH CHECK (is_barbershop_manager(auth.uid(), barbershop_id));