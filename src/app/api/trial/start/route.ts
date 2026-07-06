import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(req: Request) {
  try {
    const { tenant_id } = await req.json();

    if (!tenant_id) {
      return NextResponse.json({ error: 'tenant_id is required' }, { status: 400 });
    }

    // Verificar si está pending
    const { data: sub, error: subError } = await supabase
      .from('saas_subscriptions')
      .select('status, trial_started_at')
      .eq('tenant_id', tenant_id)
      .maybeSingle();

    if (subError) {
      return NextResponse.json({ error: subError.message }, { status: 500 });
    }

    if (sub && sub.status === 'pending_trial' && !sub.trial_started_at) {
      // Iniciar trial
      const { error: updateError } = await supabase
        .from('saas_subscriptions')
        .update({
          status: 'trial',
          trial_started_at: new Date().toISOString()
        })
        .eq('tenant_id', tenant_id)
        .eq('status', 'pending_trial');

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: 'Trial started' });
    }

    return NextResponse.json({ success: false, message: 'Not eligible for trial start' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
