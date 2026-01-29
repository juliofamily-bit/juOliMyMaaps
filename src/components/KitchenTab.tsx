'use client';

import React, { useEffect, useState } from 'react';
import { Order, Product } from '@/types/database';
import { Clock, CheckCircle2, User, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useNotifications } from '@/lib/store';

interface KitchenTabProps {
    orders: Order[];
    products: Product[];
}

export default function KitchenTab({ orders, products }: KitchenTabProps) {
    const [orderItems, setOrderItems] = useState<Record<string, any[]>>({});
    const [loadingItems, setLoadingItems] = useState<Record<string, boolean>>({});
    const { addNotification } = useNotifications();

    const pendingOrders = orders.filter(o => o.status === 'pending');

    const getTimeAgo = (timestamp: string) => {
        const diff = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000 / 60);
        return diff < 0 ? '0m' : `${diff}m`;
    };

    // Fetch items for specific orders when they appear
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

        pendingOrders.forEach(order => fetchItems(order.id));
    }, [pendingOrders]);

    const handleCompleteOrder = async (orderId: string, clientName: string) => {
        const items = orderItems[orderId] || [];
        const breakdown = items.map(i => `${i.quantity}x ${i.products?.name}`).join(', ');

        const { error } = await supabase
            .from('orders')
            .update({ status: 'completed' })
            .eq('id', orderId);

        if (error) {
            alert("Error al completar el pedido: " + error.message);
        } else {
            const message = `Pedido de ${clientName} LISTO: ${breakdown}`;
            addNotification(message, ['staff', 'admin'], 'success');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center px-2">
                <h2 className="text-xl font-black uppercase italic tracking-widest">Pendientes</h2>
                <div className="bg-orange-500 text-white px-4 py-1 rounded-full text-xs font-black animate-pulse">
                    {pendingOrders.length} EN COLA
                </div>
            </div>

            {pendingOrders.length === 0 ? (
                <div className="py-24 text-center glass rounded-[3rem] p-10 border-dashed border-2 border-slate-800">
                    <div className="bg-slate-900 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle2 size={40} className="text-slate-700" />
                    </div>
                    <p className="text-slate-500 font-bold uppercase tracking-widest text-sm">Sin órdenes pendientes.<br />¡A descansar!</p>
                </div>
            ) : (
                <div className="grid gap-5">
                    {pendingOrders.map(order => (
                        <div key={order.id} className="glass rounded-[2rem] overflow-hidden border border-white/5 shadow-2xl animate-in slide-in-from-right-4">
                            <div className="p-5 bg-slate-900/90 flex justify-between items-center">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-orange-500 flex items-center justify-center text-white shadow-lg">
                                        <User size={24} />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-xl leading-none mb-1">{order.client_name}</h3>
                                        <p className="text-[10px] text-orange-500 font-black tracking-[0.2em] uppercase">Orden #{order.order_number}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 text-slate-500 font-black text-sm">
                                    <Clock size={16} />
                                    <span>{getTimeAgo(order.created_at)}</span>
                                </div>
                            </div>

                            <div className="p-6 space-y-4">
                                <div className="space-y-3">
                                    {loadingItems[order.id] ? (
                                        <div className="flex items-center gap-2 text-slate-600 font-bold text-xs">
                                            <Loader2 className="animate-spin" size={14} /> Cargando pedido...
                                        </div>
                                    ) : (
                                        orderItems[order.id]?.map((item, idx) => (
                                            <div key={idx} className="flex gap-4 items-center">
                                                <span className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center font-black text-orange-500">
                                                    {item.quantity}
                                                </span>
                                                <div>
                                                    <p className="font-black text-lg leading-none">{item.products?.name}</p>
                                                    <p className="text-[10px] text-slate-500 font-bold uppercase">Cocina</p>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>

                                <button
                                    onClick={() => handleCompleteOrder(order.id, order.client_name)}
                                    className="w-full mt-4 bg-orange-600 hover:bg-orange-500 text-white font-black py-5 rounded-2xl shadow-xl transition-all active:scale-95 text-lg uppercase tracking-widest"
                                >
                                    PEDIDO LISTO
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
