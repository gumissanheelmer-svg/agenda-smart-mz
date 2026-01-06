-- Create service_professionals table for N:N relationship (salons)
CREATE TABLE IF NOT EXISTS public.service_professionals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL REFERENCES public.barbers(id) ON DELETE CASCADE,
  barbershop_id UUID NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(service_id, professional_id)
);

-- Enable RLS on service_professionals
ALTER TABLE public.service_professionals ENABLE ROW LEVEL SECURITY;

-- RLS Policies for service_professionals
CREATE POLICY "Superadmin can manage all service_professionals"
ON public.service_professionals FOR ALL
USING (is_superadmin(auth.uid()))
WITH CHECK (is_superadmin(auth.uid()));

CREATE POLICY "Admins can manage own barbershop service_professionals"
ON public.service_professionals FOR ALL
USING (is_barbershop_admin(auth.uid(), barbershop_id))
WITH CHECK (is_barbershop_admin(auth.uid(), barbershop_id));

CREATE POLICY "Anyone can view service_professionals"
ON public.service_professionals FOR SELECT
USING (true);