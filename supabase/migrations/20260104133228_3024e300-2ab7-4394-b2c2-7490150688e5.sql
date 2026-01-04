-- Allow anyone to view settings (needed for WhatsApp number in booking form)
CREATE POLICY "Anyone can view settings"
ON public.settings
FOR SELECT
USING (true);