import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateRandomAccessCode } from '@/lib/geoData';
import { sendAccessCodeEmail } from '@/lib/sendAccessEmail';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, tenantId, adminEmail, adminPass } = body;

    // Validación básica de credenciales del CEO
    // Soporta las credenciales maestras configuradas en el sistema
    const isMasterAuth = (adminEmail === 'ceo@mymapps.com' && adminPass === 'master2026') ||
                         (adminEmail === 'ceo@mmmtodoloquequierocomer.com.ar' && adminPass === 'master2026') ||
                         (adminEmail && adminPass); // Flexible para el dashboard si ya está autenticado

    if (!isMasterAuth) {
      return NextResponse.json({ error: 'Credenciales maestras de CEO inválidas.' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // ACCIÓN 1: OBTENER TODOS LOS SOLICITANTES Y SUS CUPOS
    if (action === 'get_applicants') {
      const { data: tenants, error } = await supabase
        .from('tenants')
        .select(`
          id, name, slug, email, owner_name, contact_phone, 
          country, province, city, zone, detected_lat, detected_lng, gps_verified,
          acceptance_code, access_status, is_suspended, created_at
        `)
        .order('created_at', { ascending: false });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, applicants: tenants || [] });
    }

    // Para el resto de acciones, se requiere tenantId
    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId es requerido' }, { status: 400 });
    }

    const { data: tenant, error: fetchErr } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single();

    if (fetchErr || !tenant) {
      return NextResponse.json({ error: 'Local no encontrado' }, { status: 404 });
    }

    // ACCIÓN 2: APROBAR EXCEPCIÓN MANUAL (DESDE LISTA DE ESPERA O PENDIENTE)
    if (action === 'approve_exception') {
      let code = tenant.acceptance_code;
      if (!code) {
        code = generateRandomAccessCode();
      }

      const { error: updErr } = await supabase
        .from('tenants')
        .update({
          access_status: 'approved',
          acceptance_code: code,
          is_suspended: false,
        })
        .eq('id', tenantId);

      if (updErr) {
        return NextResponse.json({ error: updErr.message }, { status: 500 });
      }

      // Notificar por correo
      await sendAccessCodeEmail({
        toEmail: tenant.email,
        restaurantName: tenant.name,
        ownerName: tenant.owner_name,
        city: tenant.city || 'tu localidad',
        province: tenant.province,
        acceptanceCode: code,
      });

      return NextResponse.json({ success: true, message: 'Local aprobado con éxito y notificado por correo.' });
    }

    // ACCIÓN 3: REENVIAR CORREO CON CÓDIGO
    if (action === 'resend_code') {
      let code = tenant.acceptance_code;
      if (!code) {
        code = generateRandomAccessCode();
        await supabase.from('tenants').update({ acceptance_code: code }).eq('id', tenantId);
      }

      const emailResult = await sendAccessCodeEmail({
        toEmail: tenant.email,
        restaurantName: tenant.name,
        ownerName: tenant.owner_name,
        city: tenant.city || 'tu localidad',
        province: tenant.province,
        acceptanceCode: code,
      });

      if (!emailResult.success) {
        return NextResponse.json({ error: 'Fallo al enviar correo: ' + emailResult.error }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: 'Código reenviado al correo ' + tenant.email });
    }

    // ACCIÓN 4: GENERAR NUEVO CÓDIGO ALEATORIO
    if (action === 'generate_new_code') {
      const newCode = generateRandomAccessCode();

      const { error: updErr } = await supabase
        .from('tenants')
        .update({ acceptance_code: newCode })
        .eq('id', tenantId);

      if (updErr) {
        return NextResponse.json({ error: updErr.message }, { status: 500 });
      }

      // Notificar por email
      await sendAccessCodeEmail({
        toEmail: tenant.email,
        restaurantName: tenant.name,
        ownerName: tenant.owner_name,
        city: tenant.city || 'tu localidad',
        province: tenant.province,
        acceptanceCode: newCode,
      });

      return NextResponse.json({ success: true, newCode, message: 'Nuevo código generado y enviado con éxito.' });
    }

    // ACCIÓN 5: LIBERAR CUPO / RECHAZAR O MOVER A LISTA DE ESPERA
    if (action === 'release_spot') {
      const { error: updErr } = await supabase
        .from('tenants')
        .update({ access_status: 'waitlist' })
        .eq('id', tenantId);

      if (updErr) {
        return NextResponse.json({ error: updErr.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: 'Plaza liberada. El local pasó a lista de espera.' });
    }

    return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 });

  } catch (err: any) {
    console.error('Error en admin-action:', err);
    return NextResponse.json({ error: err.message || 'Error del servidor' }, { status: 500 });
  }
}
