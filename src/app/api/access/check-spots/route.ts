import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normalizeLocation } from '@/lib/geoData';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const city = searchParams.get('city') || '';
    const country = searchParams.get('country') || 'Argentina';

    if (!city.trim()) {
      return NextResponse.json({ error: 'Ciudad requerida' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Consulta de todos los locales para comparar de forma segura con normalización
    const { data: tenants, error } = await supabase
      .from('tenants')
      .select('id, city, country, access_status');

    if (error) {
      console.error('Error verificando cupos:', error);
      return NextResponse.json({ error: 'Error en la base de datos' }, { status: 500 });
    }

    const normTargetCity = normalizeLocation(city);
    const normTargetCountry = normalizeLocation(country);

    // Filtrar locales aprobados o activos en la misma ciudad
    const activeTenantsInCity = (tenants || []).filter((t: any) => {
      const isSameCity = normalizeLocation(t.city) === normTargetCity;
      const isSameCountry = normalizeLocation(t.country || 'Argentina') === normTargetCountry;
      const isApproved = t.access_status === 'approved' || !t.access_status; // locales previos cuentan como aprobados
      return isSameCity && isSameCountry && isApproved;
    });

    const occupiedSpots = activeTenantsInCity.length;
    const maxSpots = 5;
    const hasAvailableSpots = occupiedSpots < maxSpots;

    return NextResponse.json({
      city,
      country,
      occupiedSpots,
      maxSpots,
      hasAvailableSpots,
      remainingSpots: Math.max(0, maxSpots - occupiedSpots),
    });
  } catch (err: any) {
    console.error('Error general en check-spots:', err);
    return NextResponse.json({ error: err.message || 'Error del servidor' }, { status: 500 });
  }
}
