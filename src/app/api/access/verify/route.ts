import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    const { tenantId, email, code } = await req.json();

    if (!code?.trim()) {
      return NextResponse.json({ error: 'Por favor, ingresa el código de activación.' }, { status: 400 });
    }

    const cleanCode = code.trim().toUpperCase();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let query = supabase.from('tenants').select('id, name, slug, email, acceptance_code, access_status');
    if (tenantId) {
      query = query.eq('id', tenantId);
    } else if (email) {
      query = query.ilike('email', email.trim());
    } else {
      return NextResponse.json({ error: 'Se requiere el identificador o correo del local.' }, { status: 400 });
    }

    const { data: tenant, error } = await query.maybeSingle();

    if (error || !tenant) {
      return NextResponse.json({ error: 'No se encontró el registro del local.' }, { status: 404 });
    }

    if (tenant.access_status === 'approved') {
      return NextResponse.json({
        success: true,
        message: 'El local ya se encuentra activado.',
        slug: tenant.slug
      });
    }

    if (!tenant.acceptance_code || tenant.acceptance_code.trim().toUpperCase() !== cleanCode) {
      return NextResponse.json({
        error: 'El código ingresado no coincide con el enviado a tu correo. Por favor verifícalo o solicita reenvío.'
      }, { status: 400 });
    }

    // Código correcto: activar el local
    const { error: updateError } = await supabase
      .from('tenants')
      .update({
        access_status: 'approved',
      })
      .eq('id', tenant.id);

    if (updateError) {
      console.error('Error activando tenant:', updateError);
      return NextResponse.json({ error: 'Fallo al activar el local en la base de datos.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: '¡Tu local ha sido activado exitosamente!',
      slug: tenant.slug,
      name: tenant.name,
    });

  } catch (err: any) {
    console.error('Error general en access/verify:', err);
    return NextResponse.json({ error: err.message || 'Error del servidor' }, { status: 500 });
  }
}
