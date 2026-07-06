const fs = require('fs');
let content = fs.readFileSync('src/app/[tenant_slug]/page.tsx', 'utf-8');

// 1. Add state
content = content.replace(
  'const [planFeatures, setPlanFeatures] = useState<string[]>([]);',
  'const [planFeatures, setPlanFeatures] = useState<string[]>([]);\n  const [subscriptionData, setSubscriptionData] = useState<any>(null);'
);

// 2. Add TrialBanner rendering
const bannerInject = `  return (
    <div className={\`min-h-screen \${isLight ? 'bg-slate-50 text-slate-900' : 'bg-slate-950 text-slate-100'} transition-colors duration-500 font-sans\`}>
      
      {/* Global Trial Banner for Admin */}
      {profile?.role === 'admin' && subscriptionData && (function() {
        const isTrialActive = subscriptionData.trial_started_at && new Date(subscriptionData.trial_started_at).getTime() + (14 * 24 * 60 * 60 * 1000) > Date.now();
        if (isTrialActive) {
            const now = Date.now();
            const trialEndsAt = new Date(subscriptionData.trial_started_at).getTime() + (14 * 24 * 60 * 60 * 1000);
            const daysLeft = Math.max(0, Math.ceil((trialEndsAt - now) / (1000 * 60 * 60 * 24)));
            const isWarning = daysLeft <= 2;
            return (
                <div className={\`w-full text-white text-center py-2 px-4 shadow-lg text-sm font-bold animate-fade-in \${isWarning ? 'bg-red-600 animate-pulse' : 'bg-gradient-to-r from-orange-500 to-purple-600'}\`}>
                    {isWarning ? '⚠️ ¡Atención! Tu prueba está por finalizar. Día ' : '🔥 Prueba Gratis Activa: Día '}
                    {14 - daysLeft + 1} de 14. Te quedan {daysLeft} días gratis.
                </div>
            );
        }
        return null;
      })()}`;

content = content.replace('  return (\n    <div className={`min-h-screen ${isLight ? \'bg-slate-50 text-slate-900\' : \'bg-slate-950 text-slate-100\'} transition-colors duration-500 font-sans`}>', bannerInject);

// 3. Update loadTenant
const loadTenantFind = `        const isPendingTrial = subData?.status === 'pending_trial';

        if (isPromoActive || isTrialActive || isPendingTrial) {
          // Inyectamos las funciones PRO si está en alguna de las ventanas promocionales o a punto de empezar su prueba
          const { data: proPlan } = await supabaseAnon
            .from('saas_plans')
            .select('features')
            .eq('name', 'Pro Ilimitado')
            .maybeSingle();
          activeFeatures = proPlan?.features || [];
        } else if (subData && (subData.status === 'active' || subData.status === 'trial')) {
          activeFeatures = (subData.saas_plans as any)?.features || [];
        } else {
          // Si no tiene suscripción o está vencida, por defecto tiene los permisos básicos
          const { data: basicPlan } = await supabaseAnon
            .from('saas_plans')
            .select('features')
            .eq('name', 'Básico')
            .maybeSingle();
          activeFeatures = basicPlan?.features || ["KDS Cocina", "POS Caja", "Facturación AFIP", "Soporte Estándar"];
        }
        setPlanFeatures(activeFeatures);`;

const loadTenantReplace = `        const isPendingTrial = subData?.status === 'pending_trial';

        if (isPromoActive || isTrialActive || isPendingTrial) {
          activeFeatures = [
            'Todas las funciones', 
            'Panel de Mozos', 
            'Reservas con Seña', 
            'Programa de Fidelización', 
            'Balance Financiero Avanzado', 
            'Módulo Delivery', 
            'Panel de Barra'
          ];
        } else if (subData && (subData.status === 'active' || subData.status === 'trial')) {
          let dbFeats = (subData.saas_plans as any)?.features || [];
          if (typeof dbFeats === 'string') {
             try {
                 const parsed = JSON.parse(dbFeats);
                 if (Array.isArray(parsed)) {
                     dbFeats = parsed.map(f => typeof f === 'string' ? f : f.name);
                 }
             } catch(e) {}
          }
          activeFeatures = Array.isArray(dbFeats) ? dbFeats : [];
        } else {
          activeFeatures = ["KDS Cocina", "POS Caja", "Facturación AFIP", "Soporte Estándar"];
        }
        setPlanFeatures(activeFeatures);
        setSubscriptionData(subData);`;

content = content.replace(loadTenantFind, loadTenantReplace);

// 4. Add realtime listener for saas_subscriptions
const hookFind = `  useEffect(() => {
    loadTenant();
  }, [loadTenant]);`;

const hookReplace = `  useEffect(() => {
    loadTenant();
  }, [loadTenant]);

  useEffect(() => {
    if (!tenant?.id) return;
    const channel = supabaseAnon.channel('saas_subscriptions_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'saas_subscriptions', filter: \`tenant_id=eq.\${tenant.id}\` }, () => {
          loadTenant(true);
      })
      .subscribe();
    return () => {
      supabaseAnon.removeChannel(channel);
    };
  }, [tenant?.id, loadTenant]);`;

content = content.replace(hookFind, hookReplace);

fs.writeFileSync('src/app/[tenant_slug]/page.tsx', content);
console.log('Successfully updated page.tsx with safe node script');
