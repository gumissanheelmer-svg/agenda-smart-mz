-- ============================================
-- COMPREHENSIVE SECURITY UPDATE
-- Protecting all sensitive data from public access
-- ============================================

-- ============================================
-- 1. APPOINTMENTS TABLE - Protect client data
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can manage own barbershop appointments" ON public.appointments;
DROP POLICY IF EXISTS "Authenticated users can view relevant appointments" ON public.appointments;
DROP POLICY IF EXISTS "Anyone can create appointments for active barbershops" ON public.appointments;

-- Super Admin: Full access to all appointments
CREATE POLICY "Superadmin can manage all appointments"
ON public.appointments
FOR ALL
TO authenticated
USING (is_superadmin(auth.uid()))
WITH CHECK (is_superadmin(auth.uid()));

-- Admin: Full access to their barbershop appointments only
CREATE POLICY "Admins can manage own barbershop appointments"
ON public.appointments
FOR ALL
TO authenticated
USING (is_barbershop_admin(auth.uid(), barbershop_id))
WITH CHECK (is_barbershop_admin(auth.uid(), barbershop_id));

-- Barber: Can only view their OWN appointments (not others')
CREATE POLICY "Barbers can view own appointments"
ON public.appointments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM barber_accounts ba
    WHERE ba.user_id = auth.uid()
      AND ba.barber_id = appointments.barber_id
      AND ba.approval_status = 'approved'
  )
);

-- Barber: Can update their own appointments (e.g., mark as done)
CREATE POLICY "Barbers can update own appointments"
ON public.appointments
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM barber_accounts ba
    WHERE ba.user_id = auth.uid()
      AND ba.barber_id = appointments.barber_id
      AND ba.approval_status = 'approved'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM barber_accounts ba
    WHERE ba.user_id = auth.uid()
      AND ba.barber_id = appointments.barber_id
      AND ba.approval_status = 'approved'
  )
);

-- Anonymous/Public: Can ONLY INSERT (book), NOT read appointments
-- This prevents public access to client names and phones
CREATE POLICY "Anyone can book appointments"
ON public.appointments
FOR INSERT
TO anon, authenticated
WITH CHECK (
  (EXISTS (
    SELECT 1 FROM barbershops
    WHERE barbershops.id = appointments.barbershop_id
      AND barbershops.active = true
      AND barbershops.approval_status = 'approved'
  ))
  AND (EXISTS (
    SELECT 1 FROM barbers
    WHERE barbers.id = appointments.barber_id
      AND barbers.barbershop_id = appointments.barbershop_id
      AND barbers.active = true
  ))
  AND (EXISTS (
    SELECT 1 FROM services
    WHERE services.id = appointments.service_id
      AND services.barbershop_id = appointments.barbershop_id
      AND services.active = true
  ))
);

-- ============================================
-- 2. BARBER_ACCOUNTS TABLE - Protect email/phone
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can create their own barber account" ON public.barber_accounts;
DROP POLICY IF EXISTS "Users can view own barber account" ON public.barber_accounts;
DROP POLICY IF EXISTS "Admins can view barbershop barber accounts" ON public.barber_accounts;
DROP POLICY IF EXISTS "Admins can update barbershop barber accounts" ON public.barber_accounts;

-- Superadmin: Full access
CREATE POLICY "Superadmin can manage all barber accounts"
ON public.barber_accounts
FOR ALL
TO authenticated
USING (is_superadmin(auth.uid()))
WITH CHECK (is_superadmin(auth.uid()));

-- Users can view their OWN barber account
CREATE POLICY "Users can view own barber account"
ON public.barber_accounts
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Users can create their own barber account (registration)
CREATE POLICY "Users can create own barber account"
ON public.barber_accounts
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Admins can view barber accounts for their barbershop only
CREATE POLICY "Admins can view barbershop barber accounts"
ON public.barber_accounts
FOR SELECT
TO authenticated
USING (
  is_barbershop_admin(auth.uid(), barbershop_id)
  OR (
    EXISTS (
      SELECT 1 FROM barbershops b
      JOIN user_roles ur ON ur.barbershop_id = b.id
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'
        AND lower(trim(b.name)) = lower(trim(barber_accounts.barbershop_name))
    )
  )
);

-- Admins can update barber accounts for their barbershop only
CREATE POLICY "Admins can update barbershop barber accounts"
ON public.barber_accounts
FOR UPDATE
TO authenticated
USING (
  is_barbershop_admin(auth.uid(), barbershop_id)
  OR (
    EXISTS (
      SELECT 1 FROM barbershops b
      JOIN user_roles ur ON ur.barbershop_id = b.id
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'
        AND lower(trim(b.name)) = lower(trim(barber_accounts.barbershop_name))
    )
  )
)
WITH CHECK (
  is_barbershop_admin(auth.uid(), barbershop_id)
  OR (
    EXISTS (
      SELECT 1 FROM barbershops b
      JOIN user_roles ur ON ur.barbershop_id = b.id
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'
        AND lower(trim(b.name)) = lower(trim(barber_accounts.barbershop_name))
    )
  )
);

-- ============================================
-- 3. BARBERS TABLE - Hide phone from public
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can manage own barbershop barbers" ON public.barbers;
DROP POLICY IF EXISTS "Anyone can view active barbers basic info" ON public.barbers;

-- Superadmin: Full access
CREATE POLICY "Superadmin can manage all barbers"
ON public.barbers
FOR ALL
TO authenticated
USING (is_superadmin(auth.uid()))
WITH CHECK (is_superadmin(auth.uid()));

-- Admins: Full access to their barbershop barbers
CREATE POLICY "Admins can manage own barbershop barbers"
ON public.barbers
FOR ALL
TO authenticated
USING (is_barbershop_admin(auth.uid(), barbershop_id))
WITH CHECK (is_barbershop_admin(auth.uid(), barbershop_id));

-- Public: Can ONLY see name and working_hours (not phone)
-- We'll handle this in the application layer since RLS can't filter columns
-- But we restrict to only active barbers
CREATE POLICY "Anyone can view active barbers name only"
ON public.barbers
FOR SELECT
TO anon, authenticated
USING (active = true);

-- ============================================
-- 4. BARBERSHOPS TABLE - Hide owner_email from anon
-- ============================================

-- Drop and recreate the public view policy to be more restrictive
DROP POLICY IF EXISTS "Anyone can view active barbershops" ON public.barbershops;

-- Public can only view approved and active barbershops
-- owner_email will be hidden at application layer
CREATE POLICY "Anyone can view approved active barbershops"
ON public.barbershops
FOR SELECT
TO anon, authenticated
USING (active = true AND approval_status = 'approved');

-- ============================================
-- 5. PROFILES TABLE - Already protected
-- Ensure no public access
-- ============================================
-- Profiles table already has proper RLS, no changes needed

-- ============================================
-- 6. SERVICES TABLE - Already mostly correct
-- Just ensure proper isolation
-- ============================================
-- Services are already properly restricted, no changes needed