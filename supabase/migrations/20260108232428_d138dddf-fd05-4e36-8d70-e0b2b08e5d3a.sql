-- Add 'manager' to the app_role enum
-- Note: This must be committed before it can be used in queries
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'manager';