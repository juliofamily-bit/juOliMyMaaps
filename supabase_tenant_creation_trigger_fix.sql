-- Parche de Base de Datos: Solucionar error al crear locales nuevos
-- El trigger auto_create_saas_subscription intentaba insertar NULL en current_period_end, 
-- lo cual violaba la restricción NOT NULL de la tabla saas_subscriptions.

CREATE OR REPLACE FUNCTION public.auto_create_saas_subscription()
RETURNS TRIGGER AS $$
DECLARE
    v_pro_plan_id UUID;
BEGIN
    -- Buscar el plan "Pro Ilimitado" (Tercer plan)
    SELECT id INTO v_pro_plan_id FROM public.saas_plans WHERE name ILIKE '%Pro Ilimitado%' LIMIT 1;
    
    -- Insertamos el timestamp actual (now()) en lugar de NULL para evitar violar la restricción NOT NULL.
    -- Luego, cuando el local registre su primer pedido, el trigger start_trial_on_first_order 
    -- actualizará esta fecha sumándole los 14 días correspondientes del trial.
    INSERT INTO public.saas_subscriptions (tenant_id, plan_id, status, current_period_end, trial_started_at)
    VALUES (NEW.id, v_pro_plan_id, 'pending_trial', now(), NULL);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
