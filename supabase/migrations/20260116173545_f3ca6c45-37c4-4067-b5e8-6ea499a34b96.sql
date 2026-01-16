-- =============================================
-- 0. DROPAR FUNÇÕES EXISTENTES PARA RECRIAR
-- =============================================

DROP FUNCTION IF EXISTS public.get_public_barbershop(text);
DROP FUNCTION IF EXISTS public.get_public_services(uuid);
DROP FUNCTION IF EXISTS public.get_public_professionals(uuid);
DROP FUNCTION IF EXISTS public.get_public_service_professionals(uuid);
DROP FUNCTION IF EXISTS public.get_public_professional_schedules(uuid);
DROP FUNCTION IF EXISTS public.get_public_professional_time_off(uuid);
DROP FUNCTION IF EXISTS public.get_public_appointments_for_day(uuid, date);
DROP FUNCTION IF EXISTS public.create_public_appointment(uuid, uuid, uuid, text, text, date, time, text);
DROP FUNCTION IF EXISTS public.get_barbershop_whatsapp_for_appointment(uuid);

-- =============================================
-- 1. CRIAR RPCs PÚBLICAS SEGURAS (READ-ONLY)
-- =============================================

-- RPC: get_public_barbershop (retorna dados públicos por slug)
CREATE FUNCTION public.get_public_barbershop(p_slug text)
RETURNS TABLE (
  id uuid,
  name text,
  slug text,
  logo_url text,
  primary_color text,
  secondary_color text,
  background_color text,
  text_color text,
  background_image_url text,
  background_overlay_level text,
  business_type text,
  opening_time time,
  closing_time time
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    b.id,
    b.name,
    b.slug,
    b.logo_url,
    b.primary_color,
    b.secondary_color,
    b.background_color,
    b.text_color,
    b.background_image_url,
    b.background_overlay_level,
    b.business_type,
    b.opening_time,
    b.closing_time
  FROM barbershops b
  WHERE b.slug = p_slug
    AND b.active = true
    AND b.approval_status = 'approved';
$$;

-- RPC: get_public_services (retorna serviços ativos de um barbershop)
CREATE FUNCTION public.get_public_services(p_barbershop_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  price numeric,
  duration integer,
  allowed_business_types text[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    s.id,
    s.name,
    s.price,
    s.duration,
    s.allowed_business_types
  FROM services s
  WHERE s.barbershop_id = p_barbershop_id
    AND s.active = true;
$$;

-- RPC: get_public_professionals (retorna profissionais SEM telefone/email)
CREATE FUNCTION public.get_public_professionals(p_barbershop_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  specialty text,
  working_hours jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    b.id,
    b.name,
    b.specialty,
    b.working_hours
  FROM barbers b
  WHERE b.barbershop_id = p_barbershop_id
    AND b.active = true;
$$;

-- RPC: get_public_service_professionals (mapeia serviço-profissional)
CREATE FUNCTION public.get_public_service_professionals(p_barbershop_id uuid)
RETURNS TABLE (
  id uuid,
  service_id uuid,
  professional_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    sp.id,
    sp.service_id,
    sp.professional_id
  FROM service_professionals sp
  WHERE sp.barbershop_id = p_barbershop_id;
$$;

-- RPC: get_public_professional_schedules (horários dos profissionais)
CREATE FUNCTION public.get_public_professional_schedules(p_barbershop_id uuid)
RETURNS TABLE (
  id uuid,
  barber_id uuid,
  day_of_week integer,
  is_working_day boolean,
  start_time time,
  end_time time,
  break_start time,
  break_end time
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    ps.id,
    ps.barber_id,
    ps.day_of_week,
    ps.is_working_day,
    ps.start_time,
    ps.end_time,
    ps.break_start,
    ps.break_end
  FROM professional_schedules ps
  WHERE ps.barbershop_id = p_barbershop_id;
$$;

-- RPC: get_public_professional_time_off (folgas)
CREATE FUNCTION public.get_public_professional_time_off(p_barbershop_id uuid)
RETURNS TABLE (
  id uuid,
  barber_id uuid,
  off_date date,
  reason text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    pto.id,
    pto.barber_id,
    pto.off_date,
    pto.reason
  FROM professional_time_off pto
  WHERE pto.barbershop_id = p_barbershop_id;
$$;

-- RPC: get_public_appointments_for_day (slots ocupados SEM dados do cliente)
CREATE FUNCTION public.get_public_appointments_for_day(
  p_barber_id uuid,
  p_date date
)
RETURNS TABLE (
  appointment_time time,
  service_duration integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    a.appointment_time,
    s.duration as service_duration
  FROM appointments a
  JOIN services s ON s.id = a.service_id
  WHERE a.barber_id = p_barber_id
    AND a.appointment_date = p_date
    AND a.status NOT IN ('cancelled', 'completed');
$$;

-- =============================================
-- 2. RPC PARA CRIAR AGENDAMENTO (WRITE SEGURO)
-- =============================================

CREATE FUNCTION public.create_public_appointment(
  p_barbershop_id uuid,
  p_barber_id uuid,
  p_service_id uuid,
  p_client_name text,
  p_client_phone text,
  p_appointment_date date,
  p_appointment_time time,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_appointment_id uuid;
  v_barbershop_exists boolean;
  v_barber_active boolean;
  v_service_active boolean;
  v_slot_available boolean;
  v_service_duration integer;
BEGIN
  -- Validar barbershop existe e está ativo/aprovado
  SELECT EXISTS (
    SELECT 1 FROM barbershops
    WHERE id = p_barbershop_id
      AND active = true
      AND approval_status = 'approved'
  ) INTO v_barbershop_exists;
  
  IF NOT v_barbershop_exists THEN
    RETURN jsonb_build_object('success', false, 'error', 'Estabelecimento não encontrado ou inativo');
  END IF;

  -- Validar barber existe e está ativo
  SELECT EXISTS (
    SELECT 1 FROM barbers
    WHERE id = p_barber_id
      AND barbershop_id = p_barbershop_id
      AND active = true
  ) INTO v_barber_active;
  
  IF NOT v_barber_active THEN
    RETURN jsonb_build_object('success', false, 'error', 'Profissional não encontrado ou inativo');
  END IF;

  -- Validar service existe e está ativo
  SELECT EXISTS (
    SELECT 1 FROM services
    WHERE id = p_service_id
      AND barbershop_id = p_barbershop_id
      AND active = true
  ) INTO v_service_active;
  
  IF NOT v_service_active THEN
    RETURN jsonb_build_object('success', false, 'error', 'Serviço não encontrado ou inativo');
  END IF;

  -- Obter duração do serviço
  SELECT duration INTO v_service_duration
  FROM services WHERE id = p_service_id;

  -- Validar que não há conflito de horário
  SELECT NOT EXISTS (
    SELECT 1 FROM appointments a
    JOIN services s ON s.id = a.service_id
    WHERE a.barber_id = p_barber_id
      AND a.appointment_date = p_appointment_date
      AND a.status NOT IN ('cancelled')
      AND (
        -- Novo horário sobrepõe existente
        (p_appointment_time >= a.appointment_time 
         AND p_appointment_time < a.appointment_time + (s.duration || ' minutes')::interval)
        OR
        -- Existente sobrepõe novo horário
        (a.appointment_time >= p_appointment_time 
         AND a.appointment_time < p_appointment_time + (v_service_duration || ' minutes')::interval)
      )
  ) INTO v_slot_available;
  
  IF NOT v_slot_available THEN
    RETURN jsonb_build_object('success', false, 'error', 'Horário não disponível');
  END IF;

  -- Validar que a data é futura ou hoje
  IF p_appointment_date < CURRENT_DATE THEN
    RETURN jsonb_build_object('success', false, 'error', 'Data deve ser futura');
  END IF;

  -- Validar dados do cliente
  IF p_client_name IS NULL OR trim(p_client_name) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nome do cliente é obrigatório');
  END IF;
  
  IF p_client_phone IS NULL OR trim(p_client_phone) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Telefone do cliente é obrigatório');
  END IF;

  -- Inserir agendamento
  INSERT INTO appointments (
    barbershop_id,
    barber_id,
    service_id,
    client_name,
    client_phone,
    appointment_date,
    appointment_time,
    notes,
    status
  ) VALUES (
    p_barbershop_id,
    p_barber_id,
    p_service_id,
    trim(p_client_name),
    trim(p_client_phone),
    p_appointment_date,
    p_appointment_time,
    p_notes,
    'pending'
  )
  RETURNING id INTO v_appointment_id;

  RETURN jsonb_build_object(
    'success', true,
    'appointment_id', v_appointment_id
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- =============================================
-- 3. RPC PARA OBTER WHATSAPP DO BARBERSHOP (após agendamento)
-- =============================================

CREATE FUNCTION public.get_barbershop_whatsapp_for_appointment(p_appointment_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.whatsapp_number
  FROM appointments a
  JOIN barbershops b ON b.id = a.barbershop_id
  WHERE a.id = p_appointment_id;
$$;

-- =============================================
-- 4. REMOVER POLICIES PÚBLICAS INSEGURAS
-- =============================================

-- Remover policy de INSERT público em appointments
DROP POLICY IF EXISTS "Public can book appointments with validation" ON appointments;

-- Bloquear SELECT anônimo
DROP POLICY IF EXISTS "Block anonymous select on appointments" ON appointments;
CREATE POLICY "Block anonymous select on appointments"
ON appointments FOR SELECT
TO anon
USING (false);

-- Bloquear INSERT anônimo completamente
DROP POLICY IF EXISTS "Block anonymous insert on appointments" ON appointments;
CREATE POLICY "Block anonymous insert on appointments"
ON appointments FOR INSERT
TO anon
WITH CHECK (false);

-- =============================================
-- 5. GARANTIR RLS EM TODAS AS TABELAS SENSÍVEIS
-- =============================================

-- Garantir block em barber_accounts para anon
DROP POLICY IF EXISTS "Block anonymous select on barber_accounts" ON barber_accounts;
CREATE POLICY "Block anonymous select on barber_accounts"
ON barber_accounts FOR SELECT
TO anon
USING (false);

DROP POLICY IF EXISTS "Block anonymous insert on barber_accounts" ON barber_accounts;
CREATE POLICY "Block anonymous insert on barber_accounts"
ON barber_accounts FOR INSERT
TO anon
WITH CHECK (false);

-- Garantir block em barbershops para anon
DROP POLICY IF EXISTS "Block anonymous select on barbershops" ON barbershops;
CREATE POLICY "Block anonymous select on barbershops"
ON barbershops FOR SELECT
TO anon
USING (false);

-- Garantir block em barbers para anon
DROP POLICY IF EXISTS "Block anonymous select on barbers" ON barbers;
CREATE POLICY "Block anonymous select on barbers"
ON barbers FOR SELECT
TO anon
USING (false);

-- Garantir block em managers para anon
DROP POLICY IF EXISTS "Block anonymous select on managers" ON managers;
CREATE POLICY "Block anonymous select on managers"
ON managers FOR SELECT
TO anon
USING (false);

-- Garantir block em expenses para anon
DROP POLICY IF EXISTS "Block anonymous select on expenses" ON expenses;
CREATE POLICY "Block anonymous select on expenses"
ON expenses FOR SELECT
TO anon
USING (false);

-- Garantir block em subscriptions para anon
DROP POLICY IF EXISTS "Block anonymous select on subscriptions" ON subscriptions;
CREATE POLICY "Block anonymous select on subscriptions"
ON subscriptions FOR SELECT
TO anon
USING (false);

-- Garantir block em user_roles para anon
DROP POLICY IF EXISTS "Block anonymous select on user_roles" ON user_roles;
CREATE POLICY "Block anonymous select on user_roles"
ON user_roles FOR SELECT
TO anon
USING (false);

-- Garantir block em profiles para anon
DROP POLICY IF EXISTS "Block anonymous select on profiles" ON profiles;
CREATE POLICY "Block anonymous select on profiles"
ON profiles FOR SELECT
TO anon
USING (false);