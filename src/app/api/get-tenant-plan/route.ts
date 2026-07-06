import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tenant_id = searchParams.get('tenant_id');

  if (!tenant_id) {
    return NextResponse.json({ error: 'tenant_id is required' }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  // Use SERVICE ROLE KEY to completely bypass RLS!
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { data: subData, error } = await supabaseAdmin
      .from('saas_subscriptions')
      .select('status, plan_id, trial_started_at, promo_pro_ends_at, saas_plans:saas_plans!saas_subscriptions_plan_id_fkey(*)')
      .eq('tenant_id', tenant_id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching subscription:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: subData });
  } catch (err: any) {
    console.error('Exception fetching subscription:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
