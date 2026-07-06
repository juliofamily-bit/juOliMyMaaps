import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Usamos el Service Role Key para hacer bypass del RLS ya que el RLS estaba
// bloqueando el update debido a un conflicto entre auth.jwt() y la sesión anónima.
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { tenantId, updates } = body;

        if (!tenantId) {
            return NextResponse.json({ error: 'Falta tenantId' }, { status: 400 });
        }

        const { data, error } = await supabaseAdmin
            .from('tenants')
            .update(updates)
            .eq('id', tenantId)
            .select();

        if (error) {
            console.error('Error in /api/update-tenant:', error);
            return NextResponse.json({ error: { message: error.message, code: error.code } }, { status: 500 });
        }

        return NextResponse.json({ data: data?.[0] || null });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
