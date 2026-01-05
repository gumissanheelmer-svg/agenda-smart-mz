-- Fix: Change the INSERT policy for appointments from RESTRICTIVE to PERMISSIVE
-- This allows unauthenticated clients to book appointments

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Anyone can book appointments" ON appointments;

-- Recreate as PERMISSIVE policy to allow public INSERT
CREATE POLICY "Anyone can book appointments" 
ON appointments 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM barbershops
    WHERE barbershops.id = barbershop_id
      AND barbershops.active = true
      AND barbershops.approval_status = 'approved'
  )
  AND EXISTS (
    SELECT 1 FROM barbers
    WHERE barbers.id = barber_id
      AND barbers.barbershop_id = appointments.barbershop_id
      AND barbers.active = true
  )
  AND EXISTS (
    SELECT 1 FROM services
    WHERE services.id = service_id
      AND services.barbershop_id = appointments.barbershop_id
      AND services.active = true
  )
);