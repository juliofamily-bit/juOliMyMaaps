'use client';

import React, { useState } from 'react';
import { Category, Product, Ingredient, OrderItem } from '@/types/database';
import { Minus, Plus, Smartphone, Check, ArrowLeft, ShoppingCart, AlertCircle, X, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useNotifications } from '@/lib/store';
import { useOfflineStore } from '@/lib/offlineStore';

interface OrderTabProps {
    products: Product[];
    ingredients: Ingredient[];
    categories: Category[];
}

const formatARS = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        maximumFractionDigits: 0
    }).format(amount);
};

export default function OrderTab({ products, ingredients, categories }: OrderTabProps) {
    const [clientName, setClientName] = useState('');
    const [phone, setPhone] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
    const [cart, setCart] = useState<Record<string, number>>({});
    const [showSummary, setShowSummary] = useState(false);
    const [showOfflineQueue, setShowOfflineQueue] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { addNotification } = useNotifications();
    const { addToQueue, syncQueue, queue } = useOfflineStore();

    const checkStock = (productId: string, quantity: number) => {
        const product = products.find(p => p.id === productId);
        if (!product) return false;

        // This logic should ideally fetch product_ingredients mapping
        // For now, we'll assume the products have a flat logic or we need to fetch mapping
        // To be precise, we need the mapping. Let's assume for simplicity we check availability
        return true;
    };

    const addToCart = (productId: string) => {
        const currentQty = cart[productId] || 0;
        setCart(prev => ({ ...prev, [productId]: currentQty + 1 }));
    };

    const removeFromCart = (productId: string) => {
        setCart(prev => {
            const newVal = (prev[productId] || 0) - 1;
            if (newVal <= 0) {
                const { [productId]: _, ...rest } = prev;
                return rest;
            }
            return { ...prev, [productId]: newVal };
        });
    };

    const totalPrice = Object.entries(cart).reduce((sum, [id, qty]) => {
        const prod = products.find(p => p.id === id);
        return sum + (prod?.price || 0) * qty;
    }, 0);

    const handleFinish = async () => {
        if (!clientName) return alert("Nombre de cliente requerido");
        setIsSubmitting(true);

        const orderData = {
            client_name: clientName,
            phone_number: phone,
            total_price: totalPrice,
            items: Object.entries(cart).map(([productId, quantity]) => ({
                product_id: productId,
                quantity,
                unit_price: products.find(p => p.id === productId)?.price || 0
            }))
        };

        try {
            // Check online status briefly
            if (!navigator.onLine) {
                throw new Error("offline");
            }

            // 1. Create order
            const { data: order, error: orderError } = await supabase
                .from('orders')
                .insert({
                    client_name: orderData.client_name,
                    phone_number: orderData.phone_number,
                    total_price: orderData.total_price,
                    status: 'pending'
                })
                .select()
                .single();

            if (orderError) throw orderError;

            // 2. Create order items
            const orderItems = orderData.items.map(i => ({
                order_id: order.id,
                product_id: i.product_id,
                quantity: i.quantity,
                unit_price: i.unit_price
            }));

            const { error: itemsError } = await supabase
                .from('order_items')
                .insert(orderItems);

            if (itemsError) throw itemsError;

            addNotification(`Nuevo pedido de ${clientName}`, ['kitchen', 'admin'], 'info');
            alert("¡Pedido enviado a cocina!");
        } catch (error: any) {
            console.error(error);
            if (error.message === "offline" || error.code === "PGRST301") {
                addToQueue(orderData);
                alert("Sin conexión. El pedido se guardó localmente y se enviará automáticamente al recuperar el Wi-Fi.");
            } else {
                alert("Error al crear el pedido: " + error.message);
            }
        } finally {
            // Reset regardless
            setCart({});
            setClientName('');
            setPhone('');
            setSelectedCategoryId(null);
            setShowSummary(false);
            setIsSubmitting(false);
        }
    };

    if (showSummary) {
        return (
            <div className="glass rounded-[2.5rem] p-8 space-y-6 animate-in zoom-in-95">
                <h2 className="text-2xl font-black text-orange-500 uppercase italic">Revisar Pedido</h2>
                <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                    {Object.entries(cart).map(([id, qty]) => {
                        const p = products.find(item => item.id === id);
                        return (
                            <div key={id} className="flex justify-between items-center bg-slate-900/50 p-3 rounded-2xl">
                                <span className="font-bold text-sm"><span className="text-orange-500">{qty}x</span> {p?.name}</span>
                                <span className="font-black text-sm">{formatARS((p?.price || 0) * qty)}</span>
                            </div>
                        );
                    })}
                </div>
                <div className="pt-4 border-t border-slate-700 flex justify-between items-end">
                    <span className="text-slate-400 font-bold uppercase text-xs">Total</span>
                    <span className="text-3xl font-black text-white">{formatARS(totalPrice)}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-4">
                    <button onClick={() => setShowSummary(false)} className="py-4 bg-slate-800 text-white font-bold rounded-2xl">Volver</button>
                    <button
                        disabled={isSubmitting}
                        onClick={handleFinish}
                        className="py-4 bg-orange-600 text-white font-black rounded-2xl shadow-xl disabled:opacity-50"
                    >
                        {isSubmitting ? 'Enviando...' : 'Confirmar'}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="space-y-3">
                <input
                    type="text" placeholder="NOMBRE DEL CLIENTE *" value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-2xl py-4 px-6 font-black uppercase text-white placeholder:text-slate-600 outline-none focus:border-orange-500 transition-all"
                />
                <div className="relative">
                    <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                    <input
                        type="tel" placeholder="WhatsApp (Opcional)" value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-2xl py-3 pl-12 text-sm font-bold text-white outline-none focus:border-orange-500 transition-all"
                    />
                </div>
            </div>

            {queue.length > 0 && (
                <div onClick={() => setShowOfflineQueue(true)} className="bg-orange-500/10 border border-orange-500/30 rounded-2xl p-3 flex justify-between items-center cursor-pointer animate-pulse hover:bg-orange-500/20 transition-all">
                    <span className="text-[10px] font-black uppercase text-orange-500">
                        {queue.length} pedido(s) pendiente(s) de sincronizar
                    </span>
                    <div className="flex items-center gap-2">
                        <span className="text-[9px] font-bold text-slate-500">Ver Desglose</span>
                        <ArrowLeft size={14} className="text-orange-500 rotate-180" />
                    </div>
                </div>
            )}

            {!selectedCategoryId ? (
                <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-4">
                    {categories.length === 0 && (
                        <div className="col-span-2 py-10 text-center text-slate-600">
                            <AlertCircle className="mx-auto mb-2 opacity-20" size={40} />
                            <p className="text-[10px] font-black uppercase tracking-widest">Carga categorías en Admin</p>
                        </div>
                    )}
                    {categories.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setSelectedCategoryId(cat.id)}
                            className="glass aspect-square rounded-[2rem] flex flex-col items-center justify-center gap-3 active:scale-95 transition-all border border-white/5 hover:border-orange-500/50"
                        >
                            <span className="text-4xl neon-icon">{cat.icon}</span>
                            <span className="font-black uppercase text-[10px] tracking-widest">{cat.name}</span>
                        </button>
                    ))}
                </div>
            ) : (
                <div className="space-y-4 animate-in slide-in-from-right-4">
                    <button
                        onClick={() => setSelectedCategoryId(null)}
                        className="flex items-center gap-2 text-orange-500 font-black uppercase text-[10px] mb-2"
                    >
                        <ArrowLeft size={14} /> Volver a Categorías
                    </button>
                    {products.filter(p => p.category_id === selectedCategoryId).map(product => {
                        const qty = cart[product.id] || 0;
                        return (
                            <div key={product.id} className="glass rounded-3xl p-4 flex gap-4 border border-white/5">
                                {product.image_url && <img src={product.image_url} className="w-20 h-20 rounded-2xl object-cover" />}
                                <div className="flex-1 flex flex-col justify-between">
                                    <div>
                                        <h3 className="font-black text-sm leading-tight">{product.name}</h3>
                                        <p className="text-[10px] font-bold text-orange-500 uppercase">{formatARS(product.price)}</p>
                                    </div>
                                    <div className="flex items-center justify-end">
                                        <div className="flex items-center gap-2 bg-slate-950/50 p-1 rounded-xl border border-slate-800">
                                            <button onClick={() => removeFromCart(product.id)} className="w-8 h-8 rounded-lg bg-slate-800 text-white flex items-center justify-center font-black" disabled={qty <= 0}>-</button>
                                            <span className="font-black text-xs min-w-[1.5rem] text-center">{qty}</span>
                                            <button onClick={() => addToCart(product.id)} className="w-8 h-8 rounded-lg bg-orange-500 text-white flex items-center justify-center font-black">+</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    {products.filter(p => p.category_id === selectedCategoryId).length === 0 && (
                        <p className="text-center py-10 text-slate-600 text-[10px] font-black uppercase">Sin productos en esta categoría</p>
                    )}
                </div>
            )}

            {totalPrice > 0 && (
                <div className="fixed bottom-28 left-1/2 -translate-x-1/2 w-[85%] z-[60] animate-in slide-in-from-bottom-8">
                    <button
                        onClick={() => setShowSummary(true)}
                        className="w-full bg-orange-500 text-white rounded-[2rem] p-5 flex justify-between items-center shadow-2xl neon-glow active:scale-95 transition-all"
                    >
                        <div className="flex items-center gap-3">
                            <ShoppingCart size={20} />
                            <span className="text-[10px] font-black uppercase tracking-wider">Ver Desglose</span>
                        </div>
                        <span className="text-xl font-black">{formatARS(totalPrice)}</span>
                    </button>
                </div>
            )}

            {/* Offline Queue Modal */}
            {showOfflineQueue && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center px-4 bg-black/80 backdrop-blur-md animate-in fade-in">
                    <div className="glass w-full max-w-sm rounded-[2.5rem] p-6 space-y-4 shadow-2xl border border-white/10 flex flex-col max-h-[80vh]">
                        <div className="flex justify-between items-center pb-2 border-b border-white/5">
                            <h3 className="text-lg font-black uppercase italic text-orange-500">Pedidos Offline</h3>
                            <button onClick={() => setShowOfflineQueue(false)} className="text-slate-500 p-2 hover:text-white transition-all"><X /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar">
                            {queue.map(order => (
                                <div key={order.id} className="bg-slate-900/50 rounded-2xl p-4 border border-white/5 space-y-2">
                                    <div className="flex justify-between items-start">
                                        <span className="text-sm font-black text-white">{order.client_name}</span>
                                        <span className="text-[9px] font-bold text-slate-500 uppercase">{new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    <div className="space-y-1">
                                        {order.items.map((item, idx) => {
                                            const p = products.find(prod => prod.id === item.product_id);
                                            return (
                                                <div key={idx} className="flex justify-between text-[10px] text-slate-400">
                                                    <span>{item.quantity}x {p?.name || 'Producto'}</span>
                                                    <span>{formatARS(item.unit_price * item.quantity)}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="pt-2 border-t border-white/5 flex justify-between items-center">
                                        <span className="text-[10px] font-black text-orange-500 uppercase">Total</span>
                                        <span className="text-sm font-black text-white">{formatARS(order.total_price)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <button
                            onClick={() => { syncQueue(); setShowOfflineQueue(false); }}
                            className="w-full py-4 bg-orange-600 text-white font-black rounded-2xl shadow-xl flex items-center justify-center gap-2 uppercase tracking-widest active:scale-95 transition-all"
                        >
                            <RefreshCw size={16} /> Reintentar Envío
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
