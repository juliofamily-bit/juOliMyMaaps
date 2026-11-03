import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Cliente administrativo singleton (evita instanciaciones repetitivas en cada llamada)
let supabaseAdmin: any = null;
function getAdminClient() {
  if (!supabaseAdmin && supabaseUrl && supabaseServiceKey) {
    supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });
  }
  return supabaseAdmin;
}

// Memoria caché de 15 segundos para evitar sobrecargar la base de datos con peticiones en ráfaga
const planCache: Record<string, { data: any; expiry: number }> = {};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tenant_id = searchParams.get('tenant_id');

  if (!tenant_id) {
    return NextResponse.json({ error: 'tenant_id is required' }, { status: 400 });
  }

  const now = Date.now();
  if (planCache[tenant_id] && planCache[tenant_id].expiry > now) {
    return NextResponse.json({ data: planCache[tenant_id].data, cached: true });
  }

  const client = getAdminClient();
  if (!client) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  try {
    const { data: subData, error } = await client
      .from('saas_subscriptions')
      .select('status, plan_id, trial_started_at, promo_pro_ends_at, saas_plans:saas_plans!saas_subscriptions_plan_id_fkey(*)')
      .eq('tenant_id', tenant_id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching subscription:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Guardar en caché por 15 segundos
    planCache[tenant_id] = {
      data: subData,
      expiry: now + 15000
    };

    return NextResponse.json({ data: subData });
  } catch (err: any) {
    console.error('Exception fetching subscription:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
