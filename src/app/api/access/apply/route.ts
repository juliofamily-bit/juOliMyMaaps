import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normalizeLocation, generateRandomAccessCode } from '@/lib/geoData';
import { sendAccessCodeEmail } from '@/lib/sendAccessEmail';
import { DEFAULT_LANDING_CONFIG } from '@/lib/constants';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name,
      slug,
      email,
      adminPassword,
      ownerName,
      contactPhone,
      country = 'Argentina',
      province = '',
      city = '',
      zone = '',
      primaryColor = '#f97316',
      secondaryColor = '#1e293b',
      themeMode = 'dark',
      enabledRoles = ['staff', 'kitchen', 'delivery', 'waiter', 'bartender', 'animador'],
      detectedLat = null,
      detectedLng = null,
      gpsVerified = false,
      wantsImmediateSpot = true,
    } = body;

    // Validaciones indispensables
    if (!name?.trim() || !slug?.trim()) {
      return NextResponse.json({ error: 'El nombre y el enlace del local son obligatorios.' }, { status: 400 });
    }
    if (!email?.trim() || !email.includes('@')) {
      return NextResponse.json({ error: 'Correo electrónico inválido.' }, { status: 400 });
    }
    if (!city?.trim()) {
      return NextResponse.json({ error: 'La ciudad o localidad es obligatoria para validar el cupo territorial.' }, { status: 400 });
    }
    if (!adminPassword || adminPassword.length < 4) {
      return NextResponse.json({ error: 'La contraseña de administrador debe tener al menos 4 caracteres.' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 1. Validar unicidad de Nombre y Slug
    const { data: existingName } = await supabase
      .from('tenants')
      .select('id')
      .ilike('name', name.trim())
      .maybeSingle();

    if (existingName) {
      return NextResponse.json({
        error: 'El nombre de este local ya está registrado. Por favor, usa una variación (ej: agregando tu calle o barrio).'
      }, { status: 400 });
    }

    const { data: existingSlug } = await supabase
      .from('tenants')
      .select('id')
      .ilike('slug', slug.trim())
      .maybeSingle();

    if (existingSlug) {
      return NextResponse.json({
        error: 'Esta dirección web (slug) ya está en uso por otro local. Elige otra.'
      }, { status: 400 });
    }

    // 2. Comprobar cupos disponibles en la ciudad (máximo 5)
    const { data: allTenants } = await supabase
      .from('tenants')
      .select('id, city, country, access_status');

    const normTargetCity = normalizeLocation(city);
    const normTargetCountry = normalizeLocation(country);

    const activeInCity = (allTenants || []).filter((t: any) => {
      const isSameCity = normalizeLocation(t.city) === normTargetCity;
      const isSameCountry = normalizeLocation(t.country || 'Argentina') === normTargetCountry;
      const isApproved = t.access_status === 'approved' || !t.access_status;
      return isSameCity && isSameCountry && isApproved;
    });

    const waitlistInCity = (allTenants || []).filter((t: any) => {
      const isSameCity = normalizeLocation(t.city) === normTargetCity;
      const isSameCountry = normalizeLocation(t.country || 'Argentina') === normTargetCountry;
      return isSameCity && isSameCountry && t.access_status === 'waitlist';
    });

    const occupiedSpots = activeInCity.length;
    const hasSpot = occupiedSpots < 5 && wantsImmediateSpot !== false;

    // 3. Crear usuario en Supabase Auth
    try {
      await supabase.auth.admin.createUser({
        email: email.trim().toLowerCase(),
        password: adminPassword,
        email_confirm: true,
      });
    } catch (authErr) {
      console.warn('Nota Auth admin create:', authErr);
    }

    if (hasSpot) {
      // CASO A: CUPO DISPONIBLE -> Generar código aleatorio y mandar email
      const acceptanceCode = generateRandomAccessCode();

      const { data: newTenant, error: insertError } = await supabase
        .from('tenants')
        .insert([{
          name: name.trim(),
          slug: slug.trim(),
          email: email.trim().toLowerCase(),
          owner_name: ownerName?.trim() || null,
          contact_phone: contactPhone?.trim() || null,
          country: country.trim(),
          province: province.trim(),
          city: city.trim(),
          zone: zone.trim() || null,
          detected_lat: detectedLat || null,
          detected_lng: detectedLng || null,
          gps_verified: !!gpsVerified,
          access_status: 'pending_activation',
          acceptance_code: acceptanceCode,
          theme_colors: { primary: primaryColor, secondary: secondaryColor, mode: themeMode },
          enabled_roles: ['admin', ...enabledRoles],
          admin_password: adminPassword,
          staff_password: '',
          kitchen_password: '',
          bartender_password: '',
          waiter_password: '',
          delivery_password: '',
          landing_config: DEFAULT_LANDING_CONFIG,
          terms_accepted: true,
          terms_accepted_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (insertError) {
        console.error('Error insertando tenant con cupo:', insertError);
        return NextResponse.json({ error: 'No se pudo registrar el local en la base de datos: ' + insertError.message }, { status: 500 });
      }

      // Enviar correo con Resend
      const emailResult = await sendAccessCodeEmail({
        toEmail: email.trim().toLowerCase(),
        restaurantName: name.trim(),
        ownerName: ownerName?.trim(),
        city: city.trim(),
        province: province.trim(),
        acceptanceCode,
      });

      return NextResponse.json({
        success: true,
        status: 'pending_activation',
        tenantId: newTenant.id,
        slug: newTenant.slug,
        email: newTenant.email,
        city: newTenant.city,
        occupiedSpots: occupiedSpots + 1,
        emailSent: emailResult.success,
        emailError: emailResult.error || null,
      });

    } else {
      // CASO B: CUPOS AGOTADOS O USUARIO DECIDIÓ LISTA DE ESPERA
      const waitlistPos = waitlistInCity.length + 1;

      const { data: newTenant, error: insertError } = await supabase
        .from('tenants')
        .insert([{
          name: name.trim(),
          slug: slug.trim(),
          email: email.trim().toLowerCase(),
          owner_name: ownerName?.trim() || null,
          contact_phone: contactPhone?.trim() || null,
          country: country.trim(),
          province: province.trim(),
          city: city.trim(),
          zone: zone.trim() || null,
          detected_lat: detectedLat || null,
          detected_lng: detectedLng || null,
          gps_verified: !!gpsVerified,
          access_status: 'waitlist',
          acceptance_code: null,
          theme_colors: { primary: primaryColor, secondary: secondaryColor, mode: themeMode },
          enabled_roles: ['admin', ...enabledRoles],
          admin_password: adminPassword,
          landing_config: DEFAULT_LANDING_CONFIG,
          terms_accepted: true,
          terms_accepted_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (insertError) {
        console.error('Error insertando tenant en lista de espera:', insertError);
        return NextResponse.json({ error: 'No se pudo guardar la postulación: ' + insertError.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        status: 'waitlist',
        tenantId: newTenant.id,
        slug: newTenant.slug,
        email: newTenant.email,
        city: newTenant.city,
        waitlistPosition: waitlistPos,
        message: 'Los cupos para esta localidad se encuentran completos. Has quedado en lista de espera prioritaria.'
      });
    }

  } catch (err: any) {
    console.error('Error general en access/apply:', err);
    return NextResponse.json({ error: err.message || 'Error inesperado en el servidor' }, { status: 500 });
  }
}
