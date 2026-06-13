import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { tenantId, date } = body;

    if (!tenantId || !date) {
      return NextResponse.json({ error: 'Faltan parámetros obligatorios (tenantId, date)' }, { status: 400 });
    }

    // Obtener las órdenes del delivery completadas, no pagadas
    let query = supabase
      .from('orders')
      .select('id, delivery_fee')
      .eq('tenant_id', tenantId)
      .eq('delivery_type', 'delivery')
      .eq('status', 'completed')
      .eq('is_delivery_paid', false);

    if (date !== 'all') {
      const startOfDay = new Date(`${date}T00:00:00.000Z`);
      const endOfDay = new Date(`${date}T23:59:59.999Z`);
      query = query
        .gte('created_at', startOfDay.toISOString())
        .lte('created_at', endOfDay.toISOString());
    }

    const { data: unpaidOrders, error: fetchError } = await query;

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!unpaidOrders || unpaidOrders.length === 0) {
      return NextResponse.json({ error: 'No hay envíos pendientes de pago para este día.' }, { status: 400 });
    }

    const totalToPay = unpaidOrders.reduce((acc, order) => acc + (Number(order.delivery_fee) || 0), 0);
    const orderIds = unpaidOrders.map(o => o.id);

    // 1. Marcar órdenes como pagadas
    const { error: updateError } = await supabase
      .from('orders')
      .update({ is_delivery_paid: true })
      .in('id', orderIds);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // 2. Registrar el gasto en caja
    const { error: expenseError } = await supabase
      .from('expenses')
      .insert({
        tenant_id: tenantId,
        description: `Pago a Delivery - Liquidación del ${date}`,
        amount: totalToPay,
        type: 'service', // Podría ser salary también
        date: new Date().toISOString().split('T')[0] // Fecha actual
      });

    if (expenseError) {
      return NextResponse.json({ error: expenseError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Pago registrado exitosamente.', totalPaid: totalToPay });

  } catch (error: any) {
    console.error('Error en POST /api/delivery/pay:', error);
    return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 });
  }
}
