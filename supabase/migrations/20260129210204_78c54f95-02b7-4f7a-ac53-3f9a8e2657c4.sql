-- Corrigir política de INSERT para ser mais restritiva (validar no RPC)
DROP POLICY IF EXISTS "Anyone can insert payment confirmations" ON public.payment_confirmations;

-- A inserção agora só acontece via RPC (SECURITY DEFINER), então bloqueamos INSERT direto
CREATE POLICY "Block direct inserts - use RPC"
ON public.payment_confirmations
FOR INSERT
WITH CHECK (false);

-- Permitir que o RPC (SECURITY DEFINER) faça o insert internamente