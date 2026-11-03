import { useEffect, useState, useRef } from 'react'
import { supabase, setSupabaseTenant, subscribeToTenantBroadcast } from '@/lib/supabase'
import { Category, Product, Ingredient, Order, Expense, ProductIngredient, AppNotification, IngredientBatch, ProductOffer } from '@/types/database'


export function useRealtimeData(tenantId: string | null, isPublic: boolean = false, role?: string) {
    const [categories, setCategories] = useState<Category[]>([])
    const [products, setProducts] = useState<Product[]>([])
    const [ingredients, setIngredients] = useState<Ingredient[]>([])
    const [orders, setOrders] = useState<Order[]>([])
    const [expenses, setExpenses] = useState<Expense[]>([])
    const [notifications, setNotifications] = useState<AppNotification[]>([])
    const [productIngredients, setProductIngredients] = useState<ProductIngredient[]>([])
    const [ingredientBatches, setIngredientBatches] = useState<IngredientBatch[]>([])
    const [productOffers, setProductOffers] = useState<ProductOffer[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const isFetchingRef = useRef(false)
    const hasLoadedHistoricalRef = useRef(false)

    const processOffers = (offers: ProductOffer[]) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // 1. Filtrar las ofertas activas hoy
        const activeOffers = offers.filter(offer => {
            const [y, m, d] = offer.end_date.split('T')[0].split('-').map(Number);
            const end = new Date(y, m - 1, d);
            end.setHours(23, 59, 59, 999);
            return today <= end;
        });

        // 2. Ejecutar limpieza física asíncrona y silenciosa de las vencidas
        const expiredIds = offers.filter(offer => {
            const [y, m, d] = offer.end_date.split('T')[0].split('-').map(Number);
            const end = new Date(y, m - 1, d);
            end.setHours(23, 59, 59, 999);
            return today > end;
        }).map(o => o.id);

        if (expiredIds.length > 0 && !isPublic) {
            console.log(`[OFFER AUTO-CLEANUP] Eliminando físicamente ${expiredIds.length} ofertas vencidas de la base de datos...`);
            supabase.from('product_offers').delete().in('id', expiredIds).then(({ error }) => {
                if (error) console.error("Error al eliminar ofertas expiradas:", error);
            });
        }

        setProductOffers(activeOffers);
    };

    const fetchOrdersOptimized = async (includeHistorical: boolean = false) => {
        if (!tenantId || isPublic) return;
        if (isFetchingRef.current) return; // Guardia anti-estampida: evitar peticiones solapadas
        isFetchingRef.current = true;

        try {
            const isOperationalRole = role === 'kitchen' || role === 'bartender' || role === 'waiter' || role === 'delivery';

            // 1. Pedidos activos en curso (Cocina, Barra, Mozos, Despacho, Caja)
            // Se filtran estrictamente por estados activos: pending, preparing, ready, out_for_delivery
            const activePromise = supabase
                .from('orders')
                .select('*')
                .eq('tenant_id', tenantId)
                .in('status', ['pending', 'preparing', 'ready', 'out_for_delivery'])
                .order('created_at', { ascending: false })
                .limit(100);

            // 2. Pedidos recientes:
            // Si es rol operativo, solo traer 30 órdenes recientes para aligerar la memoria.
            // Si es Admin/Caja, traer 150 para cierres de caja del día.
            const recentLimit = isOperationalRole ? 30 : 150;
            const recentPromise = supabase
                .from('orders')
                .select('*')
                .eq('tenant_id', tenantId)
                .order('created_at', { ascending: false })
                .limit(recentLimit);

            const [actRes, recRes] = await Promise.all([activePromise, recentPromise]);
            
            const ordersMap = new Map<string, any>();
            (actRes.data || []).forEach(o => ordersMap.set(o.id, o));
            (recRes.data || []).forEach(o => ordersMap.set(o.id, o));

            const operationalOrders = Array.from(ordersMap.values());
            const orderIds = operationalOrders.map(o => o.id);

            // 3. Traer los ítems en bloque para estos pedidos operativos en pasos rápidos (0 timeouts)
            let items: any[] = [];
            if (orderIds.length > 0) {
                const chunkSize = 150;
                const itemPromises = [];
                for (let i = 0; i < orderIds.length; i += chunkSize) {
                    const chunk = orderIds.slice(i, i + chunkSize);
                    itemPromises.push(
                        supabase.from('order_items').select('*').in('order_id', chunk)
                    );
                }
                const itemResults = await Promise.all(itemPromises);
                itemResults.forEach(r => {
                    if (r.data) items.push(...r.data);
                });
            }

            const itemsByOrder: Record<string, any[]> = {};
            items.forEach(it => {
                if (!itemsByOrder[it.order_id]) itemsByOrder[it.order_id] = [];
                itemsByOrder[it.order_id].push(it);
            });

            const fullOperational = operationalOrders.map(o => ({
                ...o,
                items: itemsByOrder[o.id] || []
            }));

            const validOperational = fullOperational.filter(o => 
                !((o.payment_method === 'mercadopago' || o.payment_method === 'credito') && !o.is_approved_for_production && o.payment_status === 'pendiente')
            );

            // Si es rol operativo o no se solicita histórico, actualizar solo activos/recientes
            if (!includeHistorical || isOperationalRole) {
                setOrders(prev => {
                    const mergedMap = new Map<string, any>();
                    prev.forEach(o => mergedMap.set(o.id, o));
                    validOperational.forEach(o => mergedMap.set(o.id, o));
                    return Array.from(mergedMap.values()).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                });
                return;
            }

            // 4. Carga Dinámica Acotada para Reportes y Balances (EXCLUSIVA para AdminTab / Balance Financiero)
            // Traer pedidos de los últimos 45 días (cubre el mes en curso y semana) con límite estricto de 600
            // Esto reduce las lecturas de disco un 95% evitando paginar miles de órdenes antiguas
            const fullMap = new Map<string, any>();
            validOperational.forEach(o => fullMap.set(o.id, o));

            const fortyFiveDaysAgo = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString();
            const { data: recentHistorical } = await supabase
                .from('orders')
                .select('id, order_number, client_name, phone_number, status, total_price, created_at, tenant_id, payment_method, payment_status, is_archived, table_number, waiter_name, delivery_type, delivery_fee, discount_amount, coupon_code, origin, loyalty_discount_applied, is_approved_for_production')
                .eq('tenant_id', tenantId)
                .gte('created_at', fortyFiveDaysAgo)
                .order('created_at', { ascending: false })
                .limit(600);

            if (recentHistorical) {
                recentHistorical.forEach(o => {
                    const isValid = !((o.payment_method === 'mercadopago' || o.payment_method === 'credito') && !o.is_approved_for_production && o.payment_status === 'pendiente');
                    if (isValid && !fullMap.has(o.id)) {
                        fullMap.set(o.id, { ...o, items: [] });
                    }
                });
            }

            const allCombined = Array.from(fullMap.values()).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            setOrders(allCombined);
        } catch (err) {
            console.warn("[REALTIME] Advertencia al cargar pedidos optimizados:", err);
        } finally {
            isFetchingRef.current = false;
        }
    };

    const fetchData = async (isSilent: boolean = false, tableToFetch: string | null = null) => {
        if (!tenantId) return;
        if (!isSilent) setIsLoading(true);

        // 1. CARGA QUIRÚRGICA (Solo una tabla específica)
        if (tableToFetch) {
            try {
                switch (tableToFetch) {
                    case 'categories':
                        const { data: catData } = await supabase.from('categories').select('*').eq('tenant_id', tenantId).order('created_at');
                        if (catData) {
                            setCategories(catData);
                            localStorage.setItem(`cache_categories_${tenantId}`, JSON.stringify(catData));
                        }
                        break;
                    case 'products':
                        const { data: prodData } = await supabase.from('products').select('*, category:categories(*)').eq('tenant_id', tenantId).order('created_at');
                        if (prodData) {
                            setProducts(prodData);
                            localStorage.setItem(`cache_products_${tenantId}`, JSON.stringify(prodData));
                        }
                        break;
                    case 'ingredients':
                        const { data: ingData } = await supabase.from('ingredients').select('*').eq('tenant_id', tenantId);
                        if (ingData) {
                            setIngredients(ingData);
                            localStorage.setItem(`cache_ingredients_${tenantId}`, JSON.stringify(ingData));
                        }
                        break;
                    case 'orders':
                    case 'order_items': // order_items actualiza la lista de pedidos en la UI
                        if (!isPublic) {
                            await fetchOrdersOptimized(false);
                        }
                        break;
                    case 'expenses':
                        if (!isPublic) {
                            const { data: expData } = await supabase.from('expenses').select('*').eq('tenant_id', tenantId).order('date', { ascending: false });
                            if (expData) setExpenses(expData);
                        }
                        break;
                    case 'product_ingredients':
                        const { data: piData } = await supabase.from('product_ingredients').select('*').eq('tenant_id', tenantId);
                        if (piData) setProductIngredients(piData);
                        break;
                    case 'app_notifications':
                        if (!isPublic) {
                            const { data: notifData } = await supabase.from('app_notifications').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(50);
                            if (notifData) setNotifications(notifData);
                        }
                        break;
                    case 'ingredient_batches':
                        if (!isPublic) {
                            const { data: batchesData } = await supabase.from('ingredient_batches').select('*').eq('tenant_id', tenantId).order('expiration_date', { ascending: true });
                            if (batchesData) setIngredientBatches(batchesData);
                        }
                        break;
                    case 'product_offers':
                        const { data: offersData } = await supabase.from('product_offers').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false });
                        if (offersData) processOffers(offersData);
                        break;
                }
            } catch (err) {
                console.error(`Error cargando tabla ${tableToFetch}:`, err);
            } finally {
                if (!isSilent) setIsLoading(false);
            }
            return;
        }

        // 2. CARGA COMPLETA EN PARALELO (Initial load & manual refresh)
        const promises: Promise<void>[] = [];

        // Categorías
        promises.push(
            (async () => {
                try {
                    const { data, error } = await supabase.from('categories').select('*').eq('tenant_id', tenantId).order('created_at');
                    if (error) throw error;
                    if (data) {
                        setCategories(data);
                        localStorage.setItem(`cache_categories_${tenantId}`, JSON.stringify(data));
                    }
                } catch (err) {
                    const cCat = localStorage.getItem(`cache_categories_${tenantId}`);
                    if (cCat) setCategories(JSON.parse(cCat));
                }
            })()
        );

        // Productos
        promises.push(
            (async () => {
                try {
                    const { data, error } = await supabase.from('products').select('*, category:categories(*)').eq('tenant_id', tenantId).order('created_at');
                    if (error) throw error;
                    if (data) {
                        setProducts(data);
                        localStorage.setItem(`cache_products_${tenantId}`, JSON.stringify(data));
                    }
                } catch (err) {
                    const cProd = localStorage.getItem(`cache_products_${tenantId}`);
                    if (cProd) setProducts(JSON.parse(cProd));
                }
            })()
        );

        // Insumos
        promises.push(
            (async () => {
                try {
                    const { data, error } = await supabase.from('ingredients').select('*').eq('tenant_id', tenantId);
                    if (error) throw error;
                    if (data) {
                        setIngredients(data);
                        localStorage.setItem(`cache_ingredients_${tenantId}`, JSON.stringify(data));
                    }
                } catch (err) {
                    const cIng = localStorage.getItem(`cache_ingredients_${tenantId}`);
                    if (cIng) setIngredients(JSON.parse(cIng));
                }
            })()
        );

        // Pedidos
        if (!isPublic) {
            promises.push(
                (async () => {
                    const isOperationalRole = role === 'kitchen' || role === 'bartender' || role === 'waiter' || role === 'delivery';
                    const shouldLoadHistorical = !isOperationalRole && !hasLoadedHistoricalRef.current;
                    if (shouldLoadHistorical) {
                        hasLoadedHistoricalRef.current = true;
                    }
                    await fetchOrdersOptimized(shouldLoadHistorical);
                })()
            );
        }

        // Gastos
        if (!isPublic) {
            promises.push(
                (async () => {
                    try {
                        const { data } = await supabase.from('expenses').select('*').eq('tenant_id', tenantId).order('date', { ascending: false });
                        if (data) setExpenses(data);
                    } catch (err) { /* Silencioso */ }
                })()
            );
        }

        // Recetas
        promises.push(
            (async () => {
                try {
                    const { data } = await supabase.from('product_ingredients').select('*').eq('tenant_id', tenantId);
                    if (data) setProductIngredients(data);
                } catch (err) { /* Silencioso */ }
            })()
        );

        // Notificaciones
        if (!isPublic) {
            promises.push(
                (async () => {
                    try {
                        const { data } = await supabase.from('app_notifications').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(50);
                        if (data) setNotifications(data);
                    } catch (err) { /* Silencioso */ }
                })()
            );
        }

        // Lotes
        if (!isPublic) {
            promises.push(
                (async () => {
                    try {
                        const { data } = await supabase.from('ingredient_batches').select('*').eq('tenant_id', tenantId).order('expiration_date', { ascending: true });
                        if (data) setIngredientBatches(data);
                    } catch (err) { /* Silencioso */ }
                })()
            );
        }

        // Ofertas
        promises.push(
            (async () => {
                try {
                    const { data } = await supabase.from('product_offers').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false });
                    if (data) processOffers(data);
                } catch (err) { /* Silencioso */ }
            })()
        );

        await Promise.allSettled(promises);
        if (!isSilent) setIsLoading(false);
    };

    useEffect(() => {
        if (!tenantId) {
            setCategories([])
            setProducts([])
            setIngredients([])
            setOrders([])
            setExpenses([])
            setNotifications([])
            setProductIngredients([])
            setIngredientBatches([])
            setProductOffers([])
            return;
        }

        // Establecer el tenant activo en el proxy de Supabase
        setSupabaseTenant(tenantId);
        fetchData()

        const debounceTimers: Record<string, NodeJS.Timeout> = {};

        const handlePayload = (payload: any) => {
            const table = payload.table;
            console.log(`[REALTIME DEBUG] Evento ${payload.eventType} en ${table} para tenant ${tenantId}`);

            // Agrupar 'orders' y 'order_items' bajo 'orders' para consolidar ráfagas de pedidos
            const fetchKey = (table === 'order_items' || table === 'orders') ? 'orders' : table;

            if (debounceTimers[fetchKey]) {
                clearTimeout(debounceTimers[fetchKey]);
            }

            debounceTimers[fetchKey] = setTimeout(() => {
                delete debounceTimers[fetchKey];
                fetchData(true, fetchKey);
            }, 350);
        };

        const handleBroadcast = (data: any) => {
            const payload = data?.payload;
            const event = data?.event || 'schema-update';
            console.log(`[REALTIME BROADCAST] Evento recibido: ${event} para tenant ${tenantId}`, payload);

            if (event === 'order:new' && payload?.order) {
                // Inyección instantánea en memoria (0 milisegundos de latencia)
                setOrders(prev => {
                    const exists = prev.some(o => o.id === payload.order.id);
                    if (exists) return prev;
                    return [payload.order, ...prev];
                });
                return;
            }

            if (event === 'order:item_status' && payload?.itemId) {
                // Actualización instantánea del plato en memoria
                setOrders(prev => prev.map(order => {
                    const hasItem = (order.items || []).some((i: any) => i.id === payload.itemId);
                    if (!hasItem) return order;
                    const updatedItems = (order.items || []).map((i: any) => {
                        if (i.id === payload.itemId) {
                            return { ...i, status: payload.newStatus };
                        }
                        return i;
                    });
                    const allDelivered = updatedItems.length > 0 && updatedItems.every((i: any) => i.status === 'delivered');
                    return {
                        ...order,
                        items: updatedItems,
                        ...(allDelivered && payload.orderFinalStatus ? { status: payload.orderFinalStatus } : {})
                    };
                }));
                return;
            }

            if (event === 'order:status' && payload?.orderId) {
                setOrders(prev => prev.map(order => {
                    if (order.id !== payload.orderId) return order;
                    return {
                        ...order,
                        status: payload.status || order.status,
                        payment_status: payload.payment_status || order.payment_status,
                        is_archived: payload.is_archived !== undefined ? payload.is_archived : order.is_archived
                    };
                }));
                return;
            }

            // Recarga quirúrgica si se especifica la tabla, o general si es esquema completo
            const targetTable = payload?.table || null;
            fetchData(true, targetTable);
        };

        // 1. Suscribirse al canal de Broadcast unificado para sincronización instantánea (<50ms)
        const unsubscribeBroadcast = subscribeToTenantBroadcast(tenantId, handleBroadcast);

        // 2. Suscribirse a los cambios en tiempo real específicos por tabla FILTRADOS por tenant
        const tables = isPublic
            ? [
                'tenants',
                'categories',
                'products',
                'ingredients',
                'product_ingredients',
                'product_offers'
              ]
            : [
                'tenants',
                'categories',
                'products',
                'ingredients',
                'product_ingredients',
                'orders',
                'order_items',
                'expenses',
                'app_notifications',
                'ingredient_batches',
                'product_offers'
              ];

        let dbChannel = supabase.channel(`db-changes-${tenantId}`);

        tables.forEach(table => {
            const filter = table === 'tenants' ? `id=eq.${tenantId}` : `tenant_id=eq.${tenantId}`;
            dbChannel = dbChannel.on(
                'postgres_changes',
                { event: '*', schema: 'public', table, filter },
                handlePayload
            );
        });

        dbChannel.subscribe((status, err) => {
            if (err) {
                console.warn('[REALTIME DATABASE STATUS]', status, err?.message || err);
            } else {
                console.log('REALTIME DATABASE STATUS:', status);
            }
        });

        // 3. Polling Quirúrgico de Respaldo para Órdenes Activas (30s)
        // Se pausa automáticamente si la pantalla está bloqueada o en segundo plano
        let fastOrdersPollInterval: NodeJS.Timeout | null = null;
        if (!isPublic) {
            fastOrdersPollInterval = setInterval(() => {
                if (typeof document !== 'undefined' && document.hidden) {
                    return; // Cero peticiones de fondo cuando el celular está en el bolsillo
                }
                fetchData(true, 'orders');
            }, 30000);
        }

        // 4. Polling General de Respaldo para Tablas Estáticas (300s = 5 minutos)
        // Solo refresca catálogos fijos; los pedidos ya se manejan por Broadcast y polling de órdenes
        let slowGeneralPollInterval: NodeJS.Timeout | null = null;
        if (!isPublic) {
            slowGeneralPollInterval = setInterval(() => {
                if (typeof document !== 'undefined' && document.hidden) return;
                fetchData(true, 'categories');
                fetchData(true, 'products');
                fetchData(true, 'product_offers');
            }, 300000);
        }

        // 5. Heartbeat (Latido) para indicar que el local tiene internet
        // Solo lo ejecuta la terminal de Caja/Admin (evita escrituras redundantes a disco desde mozos/cocina)
        let heartbeatInterval: NodeJS.Timeout;
        const isMasterTerminal = role === 'admin' || role === 'staff' || !role;
        if (!isPublic && tenantId && isMasterTerminal) {
            supabase.from('tenants').update({ last_online_ping: new Date().toISOString() }).eq('id', tenantId).then();
            
            heartbeatInterval = setInterval(() => {
                if (navigator.onLine) {
                    supabase.from('tenants').update({ last_online_ping: new Date().toISOString() }).eq('id', tenantId).then();
                }
            }, 180000);

            // Auto-limpieza de notificaciones viejas (> 3 días) para mantener la base de datos ligera
            const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
            supabase.from('app_notifications').delete().eq('tenant_id', tenantId).lt('created_at', threeDaysAgo).then();
        }

        // 6. Refresco Inmediato al volver a la pestaña (soluciona throttling de navegadores)
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                console.log(`[REALTIME] Pestaña activa, refrescando pedidos forzadamente...`);
                fetchData(true, 'orders');
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            unsubscribeBroadcast();
            supabase.removeChannel(dbChannel);
            Object.values(debounceTimers).forEach(timer => clearTimeout(timer));
            if (fastOrdersPollInterval) clearInterval(fastOrdersPollInterval);
            if (slowGeneralPollInterval) clearInterval(slowGeneralPollInterval);
            if (heartbeatInterval) clearInterval(heartbeatInterval);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [tenantId, isPublic, role])

    return { categories, products, ingredients, orders, expenses, productIngredients, notifications, ingredientBatches, productOffers, isLoading, setOrders, refetch: fetchData }
}
