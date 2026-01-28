-- Add payment configuration columns to barbershops
ALTER TABLE public.barbershops 
ADD COLUMN IF NOT EXISTS mpesa_number VARCHAR(20) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS emola_number VARCHAR(20) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS payment_methods_enabled TEXT[] DEFAULT '{}';