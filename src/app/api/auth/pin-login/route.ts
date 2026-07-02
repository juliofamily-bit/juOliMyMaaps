import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function POST(request: Request) {
  try {
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Faltan credenciales de servidor");
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { tenantId, employeeId, pin } = await request.json();

    if (!tenantId || !employeeId || !pin) {
      return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 });
    }

    // 1. Verificar credenciales del empleado
    const { data: employeeData, error: empError } = await supabaseAdmin.rpc('check_employee_credential', {
      p_tenant_id: tenantId,
      p_employee_id: employeeId,
      p_pin: pin
    });

    if (empError || !employeeData?.success) {
      return NextResponse.json({ error: employeeData?.error || 'PIN incorrecto' }, { status: 401 });
    }

    // 2. Obtener la contraseña del rol desde el tenant
    const role = employeeData.role;
    const { data: tenantData, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single();

    if (tenantError || !tenantData) {
      return NextResponse.json({ error: 'Error obteniendo datos del negocio' }, { status: 500 });
    }

    const tenant = tenantData as any;
    const rolePassword = tenant[`${role}_password`];
    const email = `${role}@${tenant.slug}.mymfullcontrol.com`;

    if (!rolePassword) {
       return NextResponse.json({ error: 'El rol no tiene contraseña configurada' }, { status: 500 });
    }

    // 3. Iniciar sesión en Supabase Auth usando el usuario sintético del rol
    const { data: authData, error: authError } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password: rolePassword
    });

    if (authError || !authData.session) {
      console.error("Error en auth sintético:", authError);
      return NextResponse.json({ error: 'Error interno de autenticación' }, { status: 500 });
    }

    // 4. Retornar la sesión y los datos del empleado
    return NextResponse.json({
      success: true,
      session: {
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token
      },
      employee: {
        id: employeeData.employee_id,
        full_name: employeeData.name,
        role: employeeData.role
      }
    });

  } catch (err: any) {
    console.error("Error en /api/auth/pin-login:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
