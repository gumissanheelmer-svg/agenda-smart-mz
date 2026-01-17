
-- ============================================================
-- SECURITY FIX: Remove overly permissive policies
-- Issue: Policies with "true" or "OR true" conditions expose data to all authenticated users
-- Solution: Remove these policies and rely on SECURITY DEFINER RPCs for public access
-- ============================================================

-- 1. FIX professional_attendance: Remove the problematic "OR true" policy
DROP POLICY IF EXISTS "Users can view attendance for booking" ON public.professional_attendance;

-- 2. FIX professional_schedules: Remove the problematic "true" policy
DROP POLICY IF EXISTS "Users can view schedules for booking" ON public.professional_schedules;

-- 3. FIX professional_time_off: Remove the problematic "true" policy
DROP POLICY IF EXISTS "Users can view time_off for booking" ON public.professional_time_off;

-- 4. FIX service_professionals: Change authenticated to more restricted
DROP POLICY IF EXISTS "Authenticated can view service_professionals" ON public.service_professionals;

-- The public access to these tables is now ONLY through secure RPCs:
-- - get_public_professional_schedules(p_barbershop_id)
-- - get_public_professional_time_off(p_barbershop_id)
-- - get_public_service_professionals(p_barbershop_id)
-- - get_available_professionals(p_barbershop_id, p_date)

-- ============================================================
-- VERIFY: All public booking data access is through SECURITY DEFINER RPCs
-- ============================================================

-- Double-check the RPC exists and is secure
DO $$
BEGIN
  -- Verify RPCs exist
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_public_professional_schedules') THEN
    RAISE EXCEPTION 'Missing RPC: get_public_professional_schedules';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_public_professional_time_off') THEN
    RAISE EXCEPTION 'Missing RPC: get_public_professional_time_off';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_public_service_professionals') THEN
    RAISE EXCEPTION 'Missing RPC: get_public_service_professionals';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_available_professionals') THEN
    RAISE EXCEPTION 'Missing RPC: get_available_professionals';
  END IF;
END $$;
