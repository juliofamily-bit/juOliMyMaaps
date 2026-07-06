-- Permite acceso anon a saas_subscriptions para que el POS frontend pueda ver las fechas de prueba antes de hacer login
CREATE POLICY "Public profiles are viewable by everyone." 
ON public.saas_subscriptions FOR SELECT 
USING (true);
