import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Usar el cliente autenticado para respetar Row Level Security (RLS)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''; 

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const { orderId } = await request.json();

    if (!orderId) {
      return NextResponse.json({ error: 'Falta el ID del pedido a cancelar' }, { status: 400 });
    }

    // 1. Borramos los items de la orden para que desaparezca automáticamente de la cocina y mozos en tiempo real.
    const { error: itemsError } = await supabase
      .from('order_items')
      .delete()
      .eq('order_id', orderId);

    if (itemsError) throw itemsError;

    // 2. Marcamos la orden principal como cancelada y archivada.
    const { error: orderError } = await supabase
      .from('orders')
      .update({ status: 'cancelled', is_archived: true })
      .eq('id', orderId);

    if (orderError) throw orderError;

    return NextResponse.json({ success: true, message: 'Orden cancelada y eliminada correctamente de los paneles.' });
  } catch (err: any) {
    console.error("Error en API de cancelación de órdenes:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
