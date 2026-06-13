import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Check, CheckCircle2, ChevronDown, ChevronUp, DollarSign, RefreshCw, AlertCircle } from 'lucide-react';
import { Order } from '@/types/database';

const formatARS = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        maximumFractionDigits: 0
    }).format(amount);
};

interface AdminWaiterSettlementProps {
    tenantId: string;
}

export default function AdminWaiterSettlement({ tenantId }: AdminWaiterSettlementProps) {
    const [ordersWithTips, setOrdersWithTips] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedWaiter, setExpandedWaiter] = useState<string | null>(null);
    const [payingWaiter, setPayingWaiter] = useState<string | null>(null);

    const loadTips = async () => {
        try {
            setLoading(true);
            setError(null);

            const { data, error } = await supabase
                .from('orders')
                .select('*')
                .eq('tenant_id', tenantId)
                .not('waiter_name', 'is', null)
                .not('waiter_name', 'eq', '')
                .gt('tip_amount', 0)
                .eq('is_tip_paid', false)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setOrdersWithTips(data || []);
        } catch (err: any) {
            console.error('Error loading tips:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (tenantId) {
            loadTips();
        }
    }, [tenantId]);

    const handlePayAllTips = async (waiterName: string) => {
        if (!confirm(`¿Estás seguro de que deseas liquidar TODAS las propinas pendientes de ${waiterName}?`)) return;

        setPayingWaiter(waiterName);
        try {
            const waiterOrders = ordersWithTips.filter(o => o.waiter_name === waiterName);
            const totalTip = waiterOrders.reduce((sum, o) => sum + (o.tip_amount || 0), 0);
            
            // 1. Marcar los pedidos como is_tip_paid = true
            const { error: updateError } = await supabase
                .from('orders')
                .update({ is_tip_paid: true })
                .in('id', waiterOrders.map(o => o.id));

            if (updateError) throw updateError;

            // 2. Crear un gasto para reflejar la salida de caja
            const { error: expenseError } = await supabase
                .from('expenses')
                .insert({
                    tenant_id: tenantId,
                    description: `Liquidación de Propinas: ${waiterName}`,
                    amount: totalTip,
                    type: 'tip_payout',
                    date: new Date().toISOString().split('T')[0]
                });

            if (expenseError) throw expenseError;

            // 3. Recargar local
            setOrdersWithTips(prev => prev.filter(o => o.waiter_name !== waiterName));
            alert(`✅ Se han liquidado ${formatARS(totalTip)} de propinas a ${waiterName} con éxito.`);
        } catch (err: any) {
            console.error('Error paying tips:', err);
            alert(`Error al liquidar propinas: ${err.message}`);
        } finally {
            setPayingWaiter(null);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center gap-3 p-4 bg-slate-900/50 rounded-2xl text-slate-400">
                <RefreshCw size={16} className="animate-spin text-orange-500" />
                <span className="text-sm font-bold uppercase tracking-wider">Cargando propinas...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <div>
                    <h5 className="text-sm font-bold uppercase mb-1">Error de carga</h5>
                    <p className="text-xs">{error}</p>
                </div>
            </div>
        );
    }

    // Agrupar propinas por mozo
    const tipsByWaiter = ordersWithTips.reduce((acc, order) => {
        const waiter = order.waiter_name || 'Desconocido';
        if (!acc[waiter]) {
            acc[waiter] = { orders: [], totalAmount: 0 };
        }
        acc[waiter].orders.push(order);
        acc[waiter].totalAmount += (order.tip_amount || 0);
        return acc;
    }, {} as Record<string, { orders: Order[], totalAmount: number }>);

    if (Object.keys(tipsByWaiter).length === 0) {
        return (
            <div className="p-8 text-center bg-slate-900/40 rounded-3xl border border-white/5 space-y-3">
                <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 size={32} className="text-green-500" />
                </div>
                <h4 className="text-slate-300 font-bold uppercase tracking-wider">Al día</h4>
                <p className="text-slate-500 text-xs">No hay propinas pendientes de liquidar a los mozos.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center mb-2">
                <p className="text-[10px] text-slate-400 uppercase font-bold">
                    Propinas pendientes agrupadas por Mozo.
                </p>
                <button 
                    onClick={loadTips}
                    className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                >
                    <RefreshCw size={14} />
                </button>
            </div>

            {Object.entries(tipsByWaiter).map(([waiterName, data]) => (
                <div key={waiterName} className="bg-slate-900/60 rounded-2xl border border-white/10 overflow-hidden">
                    <div 
                        onClick={() => setExpandedWaiter(expandedWaiter === waiterName ? null : waiterName)}
                        className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-800/50 transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-orange-500/20 text-orange-500 flex items-center justify-center">
                                <DollarSign size={20} />
                            </div>
                            <div>
                                <h5 className="font-black text-white text-sm uppercase tracking-wide">{waiterName}</h5>
                                <p className="text-[10px] text-slate-400 font-bold">
                                    {data.orders.length} {data.orders.length === 1 ? 'propina pendiente' : 'propinas pendientes'}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="font-mono font-black text-green-400 text-lg">
                                {formatARS(data.totalAmount)}
                            </span>
                            {expandedWaiter === waiterName ? <ChevronUp size={20} className="text-slate-500" /> : <ChevronDown size={20} className="text-slate-500" />}
                        </div>
                    </div>

                    {expandedWaiter === waiterName && (
                        <div className="p-4 border-t border-white/5 bg-slate-950/40 space-y-4">
                            {/* Desglose de Pedidos */}
                            <div className="space-y-2">
                                {data.orders.map(order => (
                                    <div key={order.id} className="flex justify-between items-center p-3 bg-slate-900 rounded-xl border border-white/5">
                                        <div>
                                            <p className="text-xs font-bold text-slate-300">
                                                Pedido #{order.order_number} - Mesa {order.table_number || 'S/N'}
                                            </p>
                                            <p className="text-[10px] text-slate-500">
                                                {new Date(order.created_at).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}
                                            </p>
                                        </div>
                                        <span className="font-mono font-bold text-green-400 text-sm">
                                            {formatARS(order.tip_amount || 0)}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            {/* Botón Liquidar Todo */}
                            <div className="pt-2">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handlePayAllTips(waiterName);
                                    }}
                                    disabled={payingWaiter === waiterName}
                                    className="w-full py-3 px-4 rounded-xl font-black uppercase text-[11px] tracking-wider transition-all flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {payingWaiter === waiterName ? (
                                        <>
                                            <RefreshCw size={14} className="animate-spin" /> Procesando liquidación...
                                        </>
                                    ) : (
                                        <>
                                            <Check size={14} /> Liquidar {formatARS(data.totalAmount)} a {waiterName}
                                        </>
                                    )}
                                </button>
                                <p className="text-[9px] text-center text-slate-500 mt-2">
                                    Esto marcará las propinas como pagadas y registrará un gasto en caja.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
