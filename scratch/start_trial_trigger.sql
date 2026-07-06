CREATE OR REPLACE FUNCTION start_tenant_trial_on_first_order()
RETURNS TRIGGER AS $$
BEGIN
  -- Verificar si el tenant existe en saas_subscriptions y su estado es pending_trial
  UPDATE public.saas_subscriptions
  SET 
    status = 'trial',
    trial_started_at = NOW()
  WHERE tenant_id = NEW.tenant_id 
    AND status = 'pending_trial'
    AND trial_started_at IS NULL;
    
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS start_trial_on_order ON public.orders;

CREATE TRIGGER start_trial_on_order
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION start_tenant_trial_on_first_order();
