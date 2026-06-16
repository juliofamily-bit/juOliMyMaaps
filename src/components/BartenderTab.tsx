'use client';

import React, { useState } from 'react';
import { Order, OrderItem } from '@/types/database';
import { Clock, CheckCircle2, User, Loader2, GlassWater, Sparkles, Check, RefreshCw } from 'lucide-react';
import { supabase, broadcastTenantChange } from '@/lib/supabase';
import { useNotifications } from '@/lib/store';

interface BartenderTabProps {
    orders: Order[];
    products: any[];
    tenant?: any;
    refetchData?: () => void;
}

const getTableDisplayName = (tableNumber: string | null | undefined, tenant: any) => {
    if (!tableNumber) return '';
    const tables = tenant?.tables || [];
    const foundTable = tables.find((t: any) => 
        t.id === tableNumber || 
        t.name?.toLowerCase().trim() === tableNumber.toLowerCase().trim()
    );
    let displayName = foundTable ? foundTable.name : tableNumber;
    
    if (displayName.startsWith('T-') && displayName.length > 5 && !foundTable) {
        return 'Mesa';
    }
    
    if (displayName && !displayName.toLowerCase().startsWith('mesa')) {
        displayName = `Mesa ${displayName}`;
    }
    return displayName;
};

const getOrderDisplayName = (order: any, tenant: any) => {
    if (!order.table_number) {
        return order.client_name || 'Cliente';
    }
    const tableName = getTableDisplayName(order.table_number, tenant);
    const clientName = order.client_name;
    const isCustomClient = clientName && 
                           clientName.toLowerCase() !== 'mesa' && 
                           !clientName.toLowerCase().startsWith('t-') &&
                           clientName.toLowerCase().trim() !== tableName.toLowerCase().replace('mesa', '').trim() &&
                           clientName.toLowerCase().trim() !== tableName.toLowerCase().trim();
                           
    if (isCustomClient) {
        return `${tableName} (${clientName})`;
    }
    return tableName;
};

export default function BartenderTab({ orders, products, tenant, refetchData }: BartenderTabProps) {
    const { addNotification } = useNotifications();
    const [updatingItems, setUpdatingItems] = useState<Record<string, 'pending' | 'delivered'>>({});

    const pendingOrders = orders.filter(o => o.status === 'pending');

    const getTimeAgo = (timestamp: string) => {
        const diff = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000 / 60);
        return diff < 0 ? '0m' : `${diff}m`;
    };

    // Extraer de forma reactiva y sin peticiones duplicadas las bebidas de barra de la orden
    const getDrinkItemsForOrder = (order: Order): OrderItem[] => {
        const items = (order as any).items || [];
        return items.filter((item: any) => item.target_departments?.includes('bartender'));
    };

    const getOrderLabel = (order: Order) => {
        const orderNum = order.order_number || '?';
        if (order.table_number) {
            return `Pedido de Mesa (Sector Mozos) #${orderNum}`;
        } else if ((order as any).delivery_type === 'delivery') {
            return `Pedido de Delivery (Sector Reparto) #${orderNum}`;
        } else {
            return `Pedido de Caja (Sector Caja/Retiro) #${orderNum}`;
        }
    };

    const handleToggleItemStatus = async (item: OrderItem) => {
        const newStatus: 'pending' | 'delivered' = item.status === 'delivered' ? 'pending' : 'delivered';

        // Agregar al estado optimista antes de la llamada de red
        setUpdatingItems(prev => ({ ...prev, [item.id]: newStatus }));

        try {
            const { error } = await supabase
                .from('order_items')
                .update({ status: newStatus })
                .eq('id', item.id);

            if (error) {
                throw error;
            }

            const targetOrder = orders.find(o => o.id === item.order_id);

            // Crear una notificación elegante y disparar broadcast en tiempo real
            if (newStatus === 'delivered' && targetOrder) {
                const hasMesa = !!targetOrder.table_number;
                const orderLabel = getOrderLabel(targetOrder);
                
                if (hasMesa) {
                    // Para salón: Notificación compacta a nivel comanda para no saturar al mozo
                    const msg = `🍹 Barra actualizó el pedido #${targetOrder.order_number} - Mesa ${targetOrder.table_number} (${targetOrder.client_name})`;
                    addNotification(msg, ['waiter', 'staff', 'admin'], 'success', targetOrder.tenant_id);
                } else {
                    // Para Delivery/Caja: Notificación detallada para el mostrador/despacho
                    const msg = `🍹 Bebida lista para ${orderLabel} - ${item.quantity}x ${item.product?.name || 'Producto'}`;
                    addNotification(msg, ['staff', 'admin'], 'success', targetOrder.tenant_id);
                }
            }

            // Verificar autocompletado del pedido entero
            const { data: allItems } = await supabase
                .from('order_items')
                .select('status')
                .eq('order_id', item.order_id);

            if (allItems && allItems.length > 0 && allItems.every(i => i.status === 'delivered')) {
                const isDelivery = targetOrder && (targetOrder as any).delivery_type === 'delivery';
                const finalStatus = isDelivery ? 'ready' : 'delivered';

                const { error: orderError } = await supabase
                    .from('orders')
                    .update({ status: finalStatus })
                    .eq('id', item.order_id);

                if (!orderError && targetOrder) {
                    const hasMesa = !!targetOrder.table_number;
                    const orderLabel = getOrderLabel(targetOrder);
                    
                    if (hasMesa) {
                        const msg = `🎉 ¡Barra completó el pedido #${targetOrder.order_number}! - Mesa ${targetOrder.table_number} (${targetOrder.client_name})`;
                        addNotification(msg, ['waiter', 'staff', 'admin'], 'success', targetOrder.tenant_id);
                    } else {
                        const msg = `🎉 ¡PEDIDO ${isDelivery ? 'LISTO PARA REPARTO' : 'COMPLETO LISTO'}! ${orderLabel} para ${targetOrder.client_name || 'Cliente'}`;
                        addNotification(msg, ['staff', 'admin'], 'success', targetOrder.tenant_id);
                    }
                }
            }

            // Difundir los cambios de inmediato en tiempo real
            if (targetOrder) {
                broadcastTenantChange(targetOrder.tenant_id || null);
            }

            // Llamar al refetch local de inmediato para emular el click en el botón de refrescar
            if (refetchData) {
                refetchData();
            }
        } catch (err: any) {
            // Revertir cambio optimista
            setUpdatingItems(prev => {
                const copy = { ...prev };
                delete copy[item.id];
                return copy;
            });
            alert('Error al actualizar el estado de la bebida: ' + err.message);
        } finally {
            // Limpiar del estado optimista
            setUpdatingItems(prev => {
                const copy = { ...prev };
                delete copy[item.id];
                return copy;
            });
        }
    };

    // Filtrar órdenes que tienen al menos un ítem de barra PENDIENTE
    const ordersWithDrinks = pendingOrders.filter(order => {
        const items = getDrinkItemsForOrder(order);
        // Solo mostrar si tiene items de barra Y al menos uno NO está entregado
        return items.length > 0 && items.some(i => i.status !== 'delivered');
    });

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center px-2">
                <div className="flex items-center gap-2">
                    <div className="p-2.5 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-2xl shadow-[0_0_15px_rgba(168,85,247,0.15)]">
                        <GlassWater size={20} className="animate-bounce" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black uppercase italic tracking-widest bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">Barra & Bebidas</h2>
                        <p className="text-[8px] font-black uppercase text-slate-500 tracking-wider">Pantalla Operativa de Bartender</p>
                    {ordersWithDrinks.length > 0 && (
                <div className="bg-purple-500 text-slate-900 px-4 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-widest animate-pulse">
                    {ordersWithDrinks.length} Pedidos en Fuego
                </div>
            )}</div>
                </div>
            </div>

            {ordersWithDrinks.length === 0 ? (
                <div className="py-24 text-center glass rounded-[3rem] p-10 border-dashed border-2 border-purple-500/20 shadow-[0_0_20px_rgba(168,85,247,0.05)]">
                    <div className="bg-purple-950/40 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 border border-purple-500/20 shadow-[0_0_30px_rgba(168,85,247,0.2)]">
                        <Sparkles size={40} className="text-purple-400 animate-pulse" />
                    </div>
                    <h3 className="text-white font-black uppercase tracking-widest text-sm mb-1">Barra Despejada</h3>
                    <p className="text-slate-500 text-xs max-w-xs mx-auto">No hay comandas de bebidas pendientes por preparar en este momento.</p>
                </div>
            ) : (
                <div className="grid gap-6">
                    {ordersWithDrinks.map(order => {
                        const items = getDrinkItemsForOrder(order);
                        const completedCount = items.filter(i => i.status === 'delivered').length;
                        const isFullyDone = completedCount === items.length;

                        return (
                            <div key={order.id} className="glass rounded-[2.5rem] overflow-hidden border border-purple-500/10 shadow-[0_4px_30px_rgba(0,0,0,0.4)] animate-in slide-in-from-bottom-4">
                                <div className="p-5 bg-gradient-to-r from-purple-950/80 via-slate-900/90 to-slate-900/90 flex justify-between items-center border-b border-purple-500/10">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-purple-500 flex items-center justify-center text-slate-900 shadow-lg">
                                            <User size={24} />
                                        </div>
                                        <div>
                                            <h3 className="font-black text-xl leading-none mb-1">
                                                <span className="text-orange-500 mr-2">#{order.order_number || '?'}</span>
                                                {getOrderDisplayName(order, tenant)}
                                            </h3>
                                            <p className="text-[10px] text-slate-500 font-black tracking-[0.2em] uppercase">Comanda de Barra</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <div className="flex items-center gap-1 text-slate-500 font-black text-xs uppercase mb-0.5">
                                            <Clock size={16} />
                                            <span>{getTimeAgo(order.created_at)}</span>
                                        </div>
                                        <span className="text-[8px] font-black bg-purple-500/10 border border-purple-500/20 text-purple-500 px-2 py-0.5 rounded-lg uppercase tracking-wider">
                                            {completedCount}/{items.length} Listos
                                        </span>
                                    </div>
                                </div>

                                {/* CARTEL DISTINTIVO DE REGALO (SOCIAL DINING) */}
                                {order.client_name?.startsWith('REGALO') && (
                                    <div className="bg-fuchsia-600 text-white p-3 flex flex-col gap-1 shadow-inner border-y border-fuchsia-500">
                                        <div className="flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest animate-pulse">
                                            <span className="text-base">🎁</span>
                                            {order.client_name}
                                        </div>
                                        {items.some((i: any) => i.notes?.includes('REGALO PARA:')) && (
                                            <p className="text-center text-[9px] font-medium italic text-fuchsia-100 opacity-90">
                                                Mensaje: {items.find((i: any) => i.notes?.includes('REGALO PARA:'))?.notes?.split('| DE:')[0].replace('🎁 REGALO PARA:', '').trim()}
                                            </p>
                                        )}
                                    </div>
                                )}

                                {/* ADVERTENCIA DE PAGO PENDIENTE */}
                                {order.payment_status === 'pendiente' && (
                                    <div className="bg-red-650 text-white font-black px-6 py-2.5 text-[9px] uppercase tracking-widest text-center animate-pulse">
                                        ⚠️ PAGO PENDIENTE: PREPARAR PERO NO ENTREGAR HASTA COBRAR
                                    </div>
                                )}

                                <div className="p-6 space-y-4">
                                    <div className="space-y-2.5">
                                        {items.map((item) => {
                                            const currentStatus = updatingItems[item.id] !== undefined ? updatingItems[item.id] : item.status;
                                            const isUpdating = updatingItems[item.id] !== undefined;
                                            const isDelivered = currentStatus === 'delivered';
                                            return (
                                                <div 
                                                    key={item.id} 
                                                    onClick={() => !isUpdating && handleToggleItemStatus(item)}
                                                    className={`flex gap-4 items-center justify-between p-3.5 rounded-2xl border transition-all active:scale-[0.98] ${
                                                        isUpdating ? 'cursor-not-allowed opacity-70 border-purple-500/20' : 'cursor-pointer'
                                                    } ${
                                                        isDelivered 
                                                            ? 'bg-slate-950/40 border-purple-500/5 opacity-55 hover:opacity-75' 
                                                            : 'bg-purple-950/10 hover:bg-purple-950/20 border-purple-500/20'
                                                    }`}
                                                >
                                                    <div className="flex gap-4 items-center">
                                                        <span className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm transition-all ${
                                                            isDelivered 
                                                                ? 'bg-slate-950 text-slate-500' 
                                                                : 'bg-purple-500/10 text-purple-500 border border-purple-500/20'
                                                        }`}>
                                                            {item.quantity}
                                                        </span>
                                                        <div>
                                                            <p className={`font-black text-lg leading-none transition-all ${isDelivered ? 'line-through text-slate-500' : 'text-white'}`}>
                                                                {item.notes ? `${item.notes} (${item.product?.name || products.find(p => p.id === item.product_id)?.name})` : (item.product?.name || products.find(p => p.id === item.product_id)?.name)}
                                                            </p>
                                                            <p className="text-[9px] text-slate-500 font-black uppercase tracking-wider mt-0.5">Barra</p>
                                                        </div>
                                                    </div>

                                                    <div className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-all ${
                                                        isDelivered 
                                                            ? 'bg-purple-500 border-transparent text-slate-900' 
                                                            : 'border-slate-700 bg-slate-900'
                                                    }`}>
                                                        {isUpdating ? (
                                                            <RefreshCw size={12} className="stroke-[3] animate-spin text-purple-400" />
                                                        ) : (
                                                            isDelivered && <Check size={14} className="stroke-[3]" />
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <div className="flex pt-2">
                                        <button
                                            onClick={async () => {
                                                // Marcar todas las bebidas de esta orden como listas
                                                for (const item of items) {
                                                    if (item.status !== 'delivered') {
                                                        await handleToggleItemStatus(item);
                                                    }
                                                }
                                            }}
                                            disabled={isFullyDone}
                                            className={`w-full font-black py-4.5 rounded-2xl shadow-xl transition-all active:scale-95 text-xs uppercase tracking-widest ${
                                                isFullyDone 
                                                    ? 'bg-slate-900/20 border border-slate-800 text-slate-500 cursor-not-allowed' 
                                                    : 'bg-purple-600 hover:bg-purple-500 text-slate-900 shadow-purple-500/20 cursor-pointer'
                                            }`}
                                        >
                                            Tildar Todo
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
