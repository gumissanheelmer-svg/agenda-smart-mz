-- Drop existing restrictive INSERT policy
DROP POLICY IF EXISTS "Admins can manage own barbershop managers" ON public.managers;

-- Create specific INSERT policy for admins
CREATE POLICY "Admins can insert managers"
ON public.managers
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_barbershop_admin(auth.uid(), barbershop_id)
  OR (created_by = auth.uid() AND public.is_barbershop_admin(created_by, barbershop_id))
);

-- Create specific SELECT policy for admins
CREATE POLICY "Admins can select managers"
ON public.managers
FOR SELECT
TO authenticated
USING (
  public.is_barbershop_admin(auth.uid(), barbershop_id)
);

-- Create specific UPDATE policy for admins
CREATE POLICY "Admins can update managers"
ON public.managers
FOR UPDATE
TO authenticated
USING (public.is_barbershop_admin(auth.uid(), barbershop_id))
WITH CHECK (public.is_barbershop_admin(auth.uid(), barbershop_id));

-- Create specific DELETE policy for admins
CREATE POLICY "Admins can delete managers"
ON public.managers
FOR DELETE
TO authenticated
USING (public.is_barbershop_admin(auth.uid(), barbershop_id));