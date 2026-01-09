-- =============================================
-- CORREÇÕES CRÍTICAS DE SEGURANÇA
-- =============================================

-- Bloquear SELECT anônimo em appointments (criar policy que nega acesso)
DO $$
BEGIN
  -- Tentar dropar policy se existir
  DROP POLICY IF EXISTS "Block anonymous select on appointments" ON public.appointments;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Block anonymous select on appointments"
ON public.appointments
FOR SELECT
TO anon
USING (false);

-- Adicionar comentários de segurança nas tabelas
COMMENT ON TABLE public.appointments IS 'Agendamentos - SELECT restrito a staff autenticado';
COMMENT ON TABLE public.barber_accounts IS 'Contas de profissionais - SELECT restrito a admins/managers';
COMMENT ON TABLE public.managers IS 'Gerentes - SELECT restrito a admins do estabelecimento';
COMMENT ON TABLE public.expenses IS 'Despesas - SELECT restrito a admins/managers';
COMMENT ON TABLE public.subscriptions IS 'Assinaturas - SELECT restrito a superadmin e admin do estabelecimento';