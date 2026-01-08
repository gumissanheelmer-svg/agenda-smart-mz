-- Create function to check if user is a manager for a barbershop
CREATE OR REPLACE FUNCTION public.is_barbershop_manager(_user_id uuid, _barbershop_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'manager'
      AND barbershop_id = _barbershop_id
  )
$$;

-- Create function to check if user is admin or manager for a barbershop
CREATE OR REPLACE FUNCTION public.is_barbershop_admin_or_manager(_user_id uuid, _barbershop_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'manager')
      AND barbershop_id = _barbershop_id
  )
$$;

-- Create managers table to store manager-specific info (created by admin)
CREATE TABLE IF NOT EXISTS public.managers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  barbershop_id uuid NOT NULL,
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  created_by uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  active boolean DEFAULT true NOT NULL,
  UNIQUE(email, barbershop_id)
);

-- Enable RLS on managers table
ALTER TABLE public.managers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for managers table
CREATE POLICY "Superadmin can manage all managers"
  ON public.managers FOR ALL
  USING (is_superadmin(auth.uid()))
  WITH CHECK (is_superadmin(auth.uid()));

CREATE POLICY "Admins can manage own barbershop managers"
  ON public.managers FOR ALL
  USING (is_barbershop_admin(auth.uid(), barbershop_id))
  WITH CHECK (is_barbershop_admin(auth.uid(), barbershop_id));

CREATE POLICY "Managers can view own record"
  ON public.managers FOR SELECT
  USING (user_id = auth.uid());

-- Update barbershops policy for managers to view
CREATE POLICY "Managers can view own barbershop"
  ON public.barbershops FOR SELECT
  USING (is_barbershop_manager(auth.uid(), id));

-- Update barbers policies for managers
CREATE POLICY "Managers can view barbershop barbers"
  ON public.barbers FOR SELECT
  USING (is_barbershop_manager(auth.uid(), barbershop_id));

CREATE POLICY "Managers can manage barbershop barbers"
  ON public.barbers FOR ALL
  USING (is_barbershop_manager(auth.uid(), barbershop_id))
  WITH CHECK (is_barbershop_manager(auth.uid(), barbershop_id));

-- Update appointments policy for managers
CREATE POLICY "Managers can manage own barbershop appointments"
  ON public.appointments FOR ALL
  USING (is_barbershop_manager(auth.uid(), barbershop_id))
  WITH CHECK (is_barbershop_manager(auth.uid(), barbershop_id));

-- Update services policy for managers
CREATE POLICY "Managers can manage own barbershop services"
  ON public.services FOR ALL
  USING (is_barbershop_manager(auth.uid(), barbershop_id))
  WITH CHECK (is_barbershop_manager(auth.uid(), barbershop_id));

-- Update expenses policy for managers
CREATE POLICY "Managers can manage own barbershop expenses"
  ON public.expenses FOR ALL
  USING (is_barbershop_manager(auth.uid(), barbershop_id))
  WITH CHECK (is_barbershop_manager(auth.uid(), barbershop_id));

-- Update professional_schedules policy for managers
CREATE POLICY "Managers can manage own barbershop professional_schedules"
  ON public.professional_schedules FOR ALL
  USING (is_barbershop_manager(auth.uid(), barbershop_id))
  WITH CHECK (is_barbershop_manager(auth.uid(), barbershop_id));

-- Update professional_attendance policy for managers
CREATE POLICY "Managers can manage own barbershop professional_attendance"
  ON public.professional_attendance FOR ALL
  USING (is_barbershop_manager(auth.uid(), barbershop_id))
  WITH CHECK (is_barbershop_manager(auth.uid(), barbershop_id));

-- Update professional_time_off policy for managers
CREATE POLICY "Managers can manage own barbershop professional_time_off"
  ON public.professional_time_off FOR ALL
  USING (is_barbershop_manager(auth.uid(), barbershop_id))
  WITH CHECK (is_barbershop_manager(auth.uid(), barbershop_id));

-- Update barber_accounts policies for managers
CREATE POLICY "Managers can view barbershop barber accounts"
  ON public.barber_accounts FOR SELECT
  USING (is_barbershop_manager(auth.uid(), barbershop_id));

CREATE POLICY "Managers can manage barbershop barber accounts"
  ON public.barber_accounts FOR UPDATE
  USING (is_barbershop_manager(auth.uid(), barbershop_id))
  WITH CHECK (is_barbershop_manager(auth.uid(), barbershop_id));

-- Update service_professionals policy for managers
CREATE POLICY "Managers can manage own barbershop service_professionals"
  ON public.service_professionals FOR ALL
  USING (is_barbershop_manager(auth.uid(), barbershop_id))
  WITH CHECK (is_barbershop_manager(auth.uid(), barbershop_id));

-- Update is_barbershop_staff to include manager role
CREATE OR REPLACE FUNCTION public.is_barbershop_staff(_user_id uuid, _barbershop_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND barbershop_id = _barbershop_id
      AND role IN ('admin', 'manager', 'barber')
  )
$$;