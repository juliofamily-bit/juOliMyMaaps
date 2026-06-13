'use client';

import React, { useEffect, useState } from 'react';
import { Order, Product } from '@/types/database';
import { Clock, CheckCircle2, User, Loader2, Navigation, Phone, Check, MapPin, ExternalLink, MessageCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useNotifications } from '@/lib/store';
import { cleanArgPhone } from '@/lib/phoneUtils';

interface DeliveryTabProps {
  orders: Order[];
  products: Product[];
  tenantColors?: {
    primary: string;
    secondary: string;
    mode: string;
  };
  tenant?: any;
}

const formatARS = (amount: number) => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0
  }).format(amount);
};

export default function DeliveryTab({ orders, products, tenantColors, tenant }: DeliveryTabProps) {
  const [orderItems, setOrderItems] = useState<Record<string, any[]>>({});
  const [loadingItems, setLoadingItems] = useState<Record<string, boolean>>({});
  const { addNotification } = useNotifications();
  const [pendingPaymentOrder, setPendingPaymentOrder] = useState<any | null>(null);

  const isLight = tenantColors?.mode === 'light';
  const primaryColor = tenantColors?.primary || '#f97316';

  // Pedidos de delivery activos (no archivados)
  const activeDeliveries = orders.filter(o => 
    (o as any).delivery_type === 'delivery' && 
    !o.is_archived &&
    o.status !== 'completed'
  );

  // Historial de entregados (últimos 7 días)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  sevenDaysAgo.setHours(0,0,0,0);

  const deliveredHistorial = orders.filter(o => 
    (o as any).delivery_type === 'delivery' && 
    o.status === 'completed' &&
    new Date(o.created_at) >= sevenDaysAgo
  );

  const getTimeAgo = (timestamp: string) => {
    const diff = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000 / 60);
    return diff < 0 ? '0m' : `${diff}m`;
  };

  // Traer los productos asociados a la orden
  useEffect(() => {
    const fetchItems = async (orderId: string) => {
      if (orderItems[orderId] || loadingItems[orderId]) return;

      setLoadingItems(prev => ({ ...prev, [orderId]: true }));
      const { data, error } = await supabase
        .from('order_items')
        .select('*, products(*)')
        .eq('order_id', orderId);

      if (data) {
        setOrderItems(prev => ({ ...prev, [orderId]: data }));
      }
      setLoadingItems(prev => ({ ...prev, [orderId]: false }));
    };

    activeDeliveries.forEach(order => fetchItems(order.id));
    deliveredHistorial.forEach(order => fetchItems(order.id));
  }, [activeDeliveries, deliveredHistorial]);

  const handleDeliverOrder = async (orderId: string, clientName: string) => {
    const orderObj = orders.find(o => o.id === orderId);
    
    // Si la orden tiene pago pendiente, abrimos el modal de cobro para el repartidor
    if (orderObj && orderObj.payment_status === 'pendiente') {
      setPendingPaymentOrder(orderObj);
      return;
    }

    const items = orderItems[orderId] || [];
    const breakdown = items.map(i => `${i.quantity}x ${i.products?.name || 'Producto'}`).join(', ');

    // Si ya está pagado, el repartidor lo entrega directamente
    const { error } = await supabase
      .from('orders')
      .update({ status: 'completed', is_archived: true })
      .eq('id', orderId);

    if (error) {
      alert("Error al completar la entrega: " + error.message);
    } else {
      const message = `🚚 Pedido de ${clientName} ENTREGADO Y COMPLETADO por el Repartidor: ${breakdown}`;
      addNotification(message, ['staff', 'admin'], 'success', orderObj?.tenant_id);
      alert("¡Pedido entregado con éxito!");
    }
  };

  const handleConfirmDeliveryPayment = async (orderId: string, method: 'efectivo' | 'transferencia' | 'rappi' | 'pedidosya') => {
    const orderObj = orders.find(o => o.id === orderId);
    const items = orderItems[orderId] || [];
    const breakdown = items.map(i => `${i.quantity}x ${i.products?.name || 'Producto'}`).join(', ');

    const { error } = await supabase
      .from('orders')
      .update({ 
        status: 'completed',
        payment_status: 'pagado',
        payment_method: method,
        is_archived: true
      })
      .eq('id', orderId);

    if (error) {
      alert("Error al confirmar el pago y entrega: " + error.message);
    } else {
      const methodName = method === 'efectivo' ? 'EFECTIVO' : method === 'rappi' ? 'RAPPI' : method === 'pedidosya' ? 'PEDIDOSYA' : 'MEDIO DIGITAL';
      const message = `🚚 Pedido de ${orderObj?.client_name || 'Cliente'} ENTREGADO Y COBRADO (${methodName}) por el Repartidor: ${breakdown}`;
      addNotification(message, ['staff', 'admin', 'delivery'], 'success', orderObj?.tenant_id);
      alert(`¡Pedido cobrado y entregado con éxito en ${methodName}!`);
      setPendingPaymentOrder(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Sección 1: Envíos Activos */}
      <div className="flex justify-between items-center px-2">
        <div>
          <h2 className="text-xl font-black uppercase italic tracking-widest text-white leading-none">Reparto & Despacho 🛵</h2>
          <p className="text-[8px] font-black uppercase text-slate-500 tracking-wider mt-1">Órdenes a Domicilio aprobadas para producción</p>
        </div>
        <div className="bg-orange-500 text-slate-950 px-4 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-widest animate-pulse flex items-center gap-1">
          <Navigation size={11} className="fill-slate-950" /> {activeDeliveries.length} Pendientes
        </div>
      </div>

      {activeDeliveries.length === 0 ? (
        <div className="py-24 text-center glass rounded-[3rem] p-10 border-dashed border-2 border-white/5 bg-gradient-to-br from-orange-500/5 to-transparent shadow-xl">
          <div className="bg-slate-950/80 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 border border-white/5 shadow-inner">
            <Navigation size={36} className="text-orange-500 animate-bounce" />
          </div>
          <h3 className="text-white font-black text-sm uppercase tracking-widest mb-1">Hoja de Ruta Vacía</h3>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">No hay pedidos de Delivery listos para despachar por ahora.</p>
        </div>
      ) : (
        <div className="grid gap-6">
          {activeDeliveries.map(order => {
            const clientNameClean = order.client_name?.split('(')[0]?.trim() || 'Cliente';
            const mapsUrl = (order as any).delivery_lat && (order as any).delivery_lng
              ? `https://www.google.com/maps/search/?api=1&query=${(order as any).delivery_lat},${(order as any).delivery_lng}`
              : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((order as any).delivery_address || '')}`;
            
            const whatsappUrl = order.phone_number 
              ? `https://wa.me/${cleanArgPhone(order.phone_number)}`
              : null;

            const isPreparing = order.status !== 'delivered';
            const deliveryFee = Number((order as any).delivery_fee) || 0;
            const orderSubtotal = order.total_price - deliveryFee;

            return (
              <div
                key={order.id}
                className={`glass rounded-[2.5rem] overflow-hidden border transition-all duration-300 ${
                  isPreparing 
                    ? 'opacity-40 grayscale border-white/5 pointer-events-none' 
                    : 'border-white/5 bg-gradient-to-br from-orange-500/5 to-transparent hover:border-orange-500/10'
                }`}
              >
                {/* 1. SECCIÓN DE ENVÍO DESTACADA: PRIMERO Y EN GRANDE */}
                <div className="p-6 bg-slate-950/80 border-b border-white/5 space-y-4">
                  <div className="flex justify-between items-start gap-4">
                    <div className="space-y-1">
                      <span className="text-[8px] font-black uppercase text-orange-500 tracking-widest block">📍 DIRECCIÓN DE ENTREGA</span>
                      <h3 className="text-xl font-black text-white leading-tight uppercase">
                        {(order as any).delivery_address || 'Sin Dirección'}
                      </h3>
                      {/* Enlace de Google Maps en caso de que esté presente */}
                      {(order as any).delivery_map_link && (
                        <div className="mt-1">
                          <a 
                            href={(order as any).delivery_map_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[9px] font-bold text-orange-400 hover:underline"
                          >
                            <ExternalLink size={10} /> Ubicación en Google Maps (Cliente)
                          </a>
                        </div>
                      )}
                      <p className="text-sm font-extrabold text-slate-350">
                        Pedido: <span className="text-orange-500 font-black text-base">#{order.order_number}</span> - Cliente: <span className="text-white font-black text-base">{clientNameClean}</span>
                      </p>
                    </div>
                    <div className="text-right shrink-0 space-y-2">
                      <span className="text-sm font-black text-white bg-slate-900 px-4 py-2 rounded-2xl border border-white/5 block">
                        {formatARS(order.total_price)}
                      </span>
                      {order.payment_status === 'pagado' ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[9px] font-black uppercase tracking-wider rounded-xl shadow-[0_0_15px_rgba(16,185,129,0.15)]">
                          ✅ PAGADO
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[9px] font-black uppercase tracking-wider rounded-xl shadow-[0_0_15px_rgba(244,63,94,0.15)] animate-pulse">
                          ⚠️ A COBRAR EN LA ENTREGA
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Desglose de Costos de la Tarjeta */}
                  <div className="bg-slate-900/60 p-4 rounded-2xl border border-white/5 space-y-2 text-xs">
                    <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      <span>Costo del Pedido</span>
                      <span className="text-white font-extrabold">{formatARS(orderSubtotal)}</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] text-orange-400 font-bold uppercase tracking-wider">
                      <span>Costo de Envío</span>
                      <span className="text-orange-400 font-extrabold">+ {formatARS(deliveryFee)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs font-black uppercase tracking-wider pt-2 border-t border-white/5">
                      <span className="text-white">Monto Total</span>
                      <span className="text-orange-500 font-black text-sm">{formatARS(order.total_price)}</span>
                    </div>
                  </div>

                  {/* Botones de acción del repartidor */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-3.5 bg-orange-500 hover:bg-orange-400 text-slate-950 font-black rounded-2xl text-[9px] uppercase tracking-widest shadow-[0_0_20px_rgba(249,115,22,0.15)] active:scale-95 transition-all text-center flex items-center justify-center gap-1.5"
                    >
                      🗺️ Abrir Ruta en Google Maps
                    </a>
                    {whatsappUrl ? (
                      <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl text-[9px] uppercase tracking-widest active:scale-95 transition-all text-center flex items-center justify-center gap-1.5"
                      >
                        <MessageCircle size={13} className="fill-white text-emerald-600" /> WhatsApp Cliente
                      </a>
                    ) : (
                      <button
                        disabled
                        className="py-3.5 bg-slate-900 text-slate-600 font-black rounded-2xl text-[9px] uppercase tracking-wider text-center cursor-not-allowed border border-white/5"
                      >
                        Sin WhatsApp
                      </button>
                    )}
                  </div>

                  {/* Botones de Acción Rápida (WhatsApp 1 Clic) */}
                  {order.phone_number && (
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <a
                        href={`https://wa.me/${cleanArgPhone(order.phone_number)}?text=${encodeURIComponent(
                          `Hola ${clientNameClean}, tu pedido de ${tenant?.name || 'nuestro local'} ya va en camino hacia tu domicilio. 🛵 ¡Atento a la puerta!`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-3 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-black rounded-2xl text-[9px] uppercase tracking-widest active:scale-95 transition-all text-center flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(245,158,11,0.15)]"
                      >
                        En Camino 🛵
                      </a>
                      <a
                        href={`https://wa.me/${cleanArgPhone(order.phone_number)}?text=${encodeURIComponent(
                          `Hola ${clientNameClean}, ¡ya estoy en la puerta con tu pedido! 🏠🍔 Por favor, ¿podrías salir a recibirme?`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black rounded-2xl text-[9px] uppercase tracking-widest active:scale-95 transition-all text-center flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                      >
                        Llegué / Estoy afuera 🏠
                      </a>
                    </div>
                  )}

                  {order.phone_number && (
                    <div className="pt-1 flex items-center gap-1 text-[9px] font-extrabold text-slate-450 uppercase">
                      <Phone size={10} className="text-orange-500" /> Llama al cliente: <a href={`tel:${order.phone_number}`} className="text-orange-400 hover:underline ml-1">{order.phone_number}</a>
                    </div>
                  )}
                </div>

                {/* 2. SECCIÓN DEL PEDIDO: DEBAJO Y SECUNDARIO */}
                <div className="p-6 space-y-4">
                  <div className="space-y-3">
                    <span className="text-[8.5px] font-black uppercase text-slate-500 tracking-widest block">📦 Desglose de Productos</span>
                    {loadingItems[order.id] ? (
                      <div className="flex items-center gap-2 text-slate-550 font-bold text-[10px] uppercase">
                        <Loader2 className="animate-spin text-orange-500" size={13} /> Cargando comanda...
                      </div>
                    ) : (
                      <div className="grid gap-2.5">
                        {orderItems[order.id]?.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center bg-slate-950/60 p-3.5 rounded-2xl border border-white/5">
                            <div className="flex items-center gap-3">
                              <span className="w-6.5 h-6.5 rounded-lg bg-orange-500/10 text-orange-450 border border-orange-500/20 flex items-center justify-center font-black text-xs shrink-0">
                                {item.quantity}x
                              </span>
                              <span className="font-extrabold text-xs text-white">{item.products?.name}</span>
                            </div>
                            <span className="text-[10px] font-black text-slate-400">
                              {formatARS(item.unit_price * item.quantity)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between items-center text-[9px] font-bold text-slate-500 uppercase tracking-wide pt-2 border-t border-white/5">
                    <span>Solicitado hace {getTimeAgo(order.created_at)}</span>
                    <span className="text-slate-400">Método: <span className="text-white font-black">{(order as any).payment_method === 'efectivo' ? '💵 Efectivo' : '💳 Pago Digital'}</span></span>
                  </div>

                  <button
                    onClick={() => handleDeliverOrder(order.id, order.client_name)}
                    disabled={isPreparing}
                    className="w-full mt-2 text-white font-black py-4 rounded-2xl shadow-xl hover:shadow-orange-500/10 bg-gradient-to-r from-orange-500 to-rose-600 hover:from-orange-600 hover:to-rose-700 transition-all active:scale-95 text-xs uppercase tracking-widest flex items-center justify-center gap-2 border border-white/10"
                  >
                    <Check size={14} className="stroke-[3]" />
                    {isPreparing ? '⏳ Preparándose en Cocina / Barra' : 'Entregado / Finalizar Pedido'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tarjeta Premium de Balance Pendiente de Pago */}
      {deliveredHistorial.length > 0 && (() => {
        const unpaidDeliveries = deliveredHistorial.filter(o => !(o as any).is_delivery_paid);
        const totalPendingIncome = unpaidDeliveries.reduce((acc, o) => acc + (Number((o as any).delivery_fee) || 0), 0);

        return (
          <div className="glass rounded-[2.5rem] border border-orange-500/20 bg-gradient-to-br from-orange-500/10 via-slate-900/60 to-slate-950/80 p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-[8px] font-black uppercase text-orange-500 tracking-widest block">📊 BOLSA ACUMULADA</span>
                <h3 className="text-base font-black text-white uppercase tracking-wider">Pendiente de Cobro</h3>
              </div>
              <div className="bg-orange-500/10 text-orange-400 border border-orange-500/30 px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest">
                Acumulado
              </div>
            </div>

            <div className="bg-slate-950/60 p-4 rounded-2xl border border-orange-500/10 flex items-center justify-between">
              <div>
                <span className="text-[8px] font-black text-orange-400 uppercase tracking-widest block">💰 Total a Rendir</span>
                <span className="text-3xl font-black text-orange-500 block">{formatARS(totalPendingIncome)}</span>
                <span className="text-[8px] text-slate-400 font-extrabold uppercase">{unpaidDeliveries.length} viajes sin liquidar</span>
              </div>
            </div>
            
            <p className="text-[8px] font-bold text-slate-500 uppercase text-center tracking-wider">
              💡 Nota: Este balance suma las tarifas de envío de los últimos 7 días que el administrador aún no te ha liquidado.
            </p>
          </div>
        );
      })()}

      {/* Historial de Envíos Agrupado por Día (Últimos 7 días) */}
      {deliveredHistorial.length > 0 && (() => {
        // Agrupar por fecha
        const grouped = deliveredHistorial.reduce((acc, order) => {
          // Usamos la fecha local de creacion de la orden para agrupar
          const d = new Date(order.created_at);
          const dateStr = d.toLocaleDateString('es-AR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
          if (!acc[dateStr]) acc[dateStr] = [];
          acc[dateStr].push(order);
          return acc;
        }, {} as Record<string, typeof deliveredHistorial>);

        return Object.entries(grouped).map(([dateLabel, dayOrders], groupIdx) => {
          const totalDayDeliveries = dayOrders.length;
          const totalDayIncome = dayOrders.reduce((acc, o) => acc + (Number((o as any).delivery_fee) || 0), 0);
          
          return (
            <div key={groupIdx} className="space-y-4 pt-6 border-t border-white/5">
              <div className="flex justify-between items-end px-2">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 leading-none capitalize">{dateLabel}</h3>
                  <p className="text-[9px] text-slate-500 font-bold uppercase mt-1">{totalDayDeliveries} viajes realizados</p>
                </div>
                <div className="text-right">
                  <span className="text-sm font-black text-orange-400">{formatARS(totalDayIncome)}</span>
                </div>
              </div>
              <div className="grid gap-3">
                {dayOrders.map(order => {
                  const clientNameClean = order.client_name?.split('(')[0]?.trim() || 'Cliente';
                  const deliveryFee = Number((order as any).delivery_fee) || 0;
                  const isPaid = (order as any).is_delivery_paid;
                  
                  return (
                    <div
                      key={order.id}
                      className="p-4 rounded-2xl border border-white/5 bg-slate-900/20 flex justify-between items-center transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-green-550/10 text-green-550 flex items-center justify-center shrink-0 border border-green-500/20">
                          <Check size={14} className="stroke-[3]" />
                        </div>
                        <div>
                          <p className="font-extrabold text-xs text-white">
                            <span className="text-orange-500 font-black mr-1.5">#{order.order_number}</span>
                            {clientNameClean}
                          </p>
                          <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
                            Dirección: {(order as any).delivery_address || 'Entregado en local'}
                          </p>
                          <p className="text-[8.5px] font-extrabold text-slate-450 uppercase mt-0.5">
                            Envío: <span className="text-orange-450">{formatARS(deliveryFee)}</span> | Total: <span className="text-white">{formatARS(order.total_price)}</span>
                          </p>
                        </div>
                      </div>
                      <span className={`text-[8px] font-black uppercase border px-3 py-1 rounded-full shrink-0 ${isPaid ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-orange-400 bg-orange-500/10 border-orange-500/20'}`}>
                        {isPaid ? 'Liquidado' : 'Pendiente'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        });
      })()}

      {/* Modal Premium de Cobro y Entrega para el Repartidor */}
      {pendingPaymentOrder && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center px-4 bg-black/95 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="glass w-full max-w-sm rounded-[2.5rem] p-6 space-y-5 border border-red-500/20 shadow-2xl bg-gradient-to-br from-red-950/20 via-slate-900/40 to-slate-950/80 animate-in zoom-in-95 duration-200">
            
            <div className="text-center space-y-1.5">
              <div className="w-14 h-14 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto border border-red-500/20 animate-pulse">
                <Navigation size={24} className="fill-red-500/5 text-red-400" />
              </div>
              <h3 className="text-base font-black uppercase text-red-400 tracking-widest pt-2">💵 Cobro de Envío</h3>
              <p className="text-[9px] font-black uppercase text-slate-500 tracking-wide">
                Registra el pago para completar la entrega física de comanda
              </p>
            </div>

            <div className="bg-slate-950/60 rounded-3xl p-4 border border-white/5 space-y-2.5 text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-white/5">
                <span className="font-extrabold text-slate-400">Cliente:</span>
                <span className="font-black text-white">{pendingPaymentOrder.client_name}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-white/5">
                <span className="font-extrabold text-slate-400">Dirección:</span>
                <span className="font-black text-white text-right max-w-[70%] truncate">{(pendingPaymentOrder as any).delivery_address || 'Sin dirección'}</span>
              </div>
              <div className="flex justify-between items-center pt-1.5">
                <span className="font-extrabold text-slate-400 text-sm">Monto a Cobrar:</span>
                <span className="font-black text-red-400 text-sm">{formatARS(pendingPaymentOrder.total_price)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[8px] font-black uppercase text-slate-500 tracking-wider pl-1">Selecciona método de pago definitivo:</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleConfirmDeliveryPayment(pendingPaymentOrder.id, 'efectivo')}
                  className="py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-95 flex flex-col items-center justify-center gap-1.5 border border-emerald-500/20"
                >
                  <span className="text-xl">💵</span>
                  <span>Efectivo</span>
                </button>
                <button
                  onClick={() => handleConfirmDeliveryPayment(pendingPaymentOrder.id, 'transferencia')}
                  className="py-4 bg-blue-600 hover:bg-blue-500 text-white font-black text-[10px] uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-95 flex flex-col items-center justify-center gap-1.5 border border-blue-500/20"
                >
                  <span className="text-xl">📱</span>
                  <span>Digital</span>
                </button>
                <button
                  onClick={() => handleConfirmDeliveryPayment(pendingPaymentOrder.id, 'rappi')}
                  className="py-4 bg-orange-500 hover:bg-orange-400 text-slate-950 font-black text-[10px] uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-95 flex flex-col items-center justify-center gap-1.5 border border-orange-500/20"
                >
                  <span className="text-xl">🎒</span>
                  <span>Rappi</span>
                </button>
                <button
                  onClick={() => handleConfirmDeliveryPayment(pendingPaymentOrder.id, 'pedidosya')}
                  className="py-4 bg-red-600 hover:bg-red-500 text-white font-black text-[10px] uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-95 flex flex-col items-center justify-center gap-1.5 border border-red-500/20"
                >
                  <span className="text-xl">🎒</span>
                  <span>PedidosYa</span>
                </button>
              </div>
              <p className="text-[8px] text-slate-500 text-center mt-1">Medio Digital incluye Transferencia y Débito al entregar.</p>
            </div>

            <button
              onClick={() => setPendingPaymentOrder(null)}
              className="w-full py-3 bg-slate-950/80 hover:bg-slate-900 border border-white/5 hover:border-white/10 text-slate-400 hover:text-slate-200 text-[9px] font-black uppercase tracking-widest rounded-2xl transition-all active:scale-95"
            >
              Cancelar
            </button>
            
          </div>
        </div>
      )}
    </div>
  );
}
