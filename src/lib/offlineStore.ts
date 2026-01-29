import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from './supabase';
import { UserRole } from '@/types/database';

interface OfflineOrder {
    id: string;
    client_name: string;
    phone_number: string;
    total_price: number;
    items: {
        product_id: string;
        quantity: number;
        unit_price: number;
    }[];
    status: 'pending-sync' | 'syncing' | 'failed';
    created_at: string;
}

interface OfflineStore {
    queue: OfflineOrder[];
    addToQueue: (order: Omit<OfflineOrder, 'id' | 'status' | 'created_at'>) => void;
    removeFromQueue: (id: string) => void;
    updateStatus: (id: string, status: OfflineOrder['status']) => void;
    syncQueue: () => Promise<void>;
}

export const useOfflineStore = create<OfflineStore>()(
    persist(
        (set, get) => ({
            queue: [],
            addToQueue: (order) => {
                const newOrder: OfflineOrder = {
                    ...order,
                    id: Math.random().toString(36).substring(7),
                    status: 'pending-sync',
                    created_at: new Date().toISOString()
                };
                set((state) => ({ queue: [...state.queue, newOrder] }));
            },
            removeFromQueue: (id) => {
                set((state) => ({ queue: state.queue.filter(o => o.id !== id) }));
            },
            updateStatus: (id, status) => {
                set((state) => ({
                    queue: state.queue.map(o => o.id === id ? { ...o, status } : o)
                }));
            },
            syncQueue: async () => {
                const { queue, updateStatus, removeFromQueue } = get();
                const pending = queue.filter(o => o.status === 'pending-sync' || o.status === 'failed');

                for (const order of pending) {
                    try {
                        updateStatus(order.id, 'syncing');

                        // 1. Create order
                        const { data: remoteOrder, error: orderError } = await supabase
                            .from('orders')
                            .insert({
                                client_name: order.client_name,
                                phone_number: order.phone_number,
                                total_price: order.total_price,
                                status: 'pending',
                                created_at: order.created_at
                            })
                            .select()
                            .single();

                        if (orderError) throw orderError;

                        // 2. Create items
                        const items = order.items.map(i => ({
                            order_id: remoteOrder.id,
                            product_id: i.product_id,
                            quantity: i.quantity,
                            unit_price: i.unit_price
                        }));

                        const { error: itemsError } = await supabase
                            .from('order_items')
                            .insert(items);

                        if (itemsError) throw itemsError;

                        // 3. Notification (direct to supabase)
                        await supabase.from('app_notifications').insert([{
                            message: `Nuevo pedido de ${order.client_name} (Sincronizado)`,
                            type: 'info',
                            target_roles: ['kitchen', 'admin']
                        }]);

                        removeFromQueue(order.id);
                    } catch (error) {
                        console.error('Error syncing order:', error);
                        updateStatus(order.id, 'failed');
                    }
                }
            }
        }),
        {
            name: 'offline-orders-storage',
        }
    )
);
