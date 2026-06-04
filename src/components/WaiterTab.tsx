'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Order, OrderItem, AppNotification } from '@/types/database';
import { 
  Bell, CheckCircle2, Clock, User, Check, RefreshCw, AlertCircle, 
  Sparkles, LogOut, CheckSquare, Layers, HelpCircle, X, CheckSquare as CheckIcon,
  Plus, Search, ShoppingBag, ChevronLeft, Minus, Trash2, Edit3, Loader2, Printer
} from 'lucide-react';
import { supabase, broadcastTenantChange } from '@/lib/supabase';
import { useNotifications } from '@/lib/store';
import { useReactToPrint } from 'react-to-print';
import { PrintableTicket } from './PrintableTicket';
interface TableInfo {
    id: string;
    name: string;
    description?: string;
    waiter_name?: string | null;
    capacity?: number;
    is_occupied?: boolean;
}

interface WaiterTabProps {
    orders: Order[];
    products: any[];
    ingredients: any[];
    productIngredients: any[];
    categories: any[];
    notifications: AppNotification[];
    tenant: any;
    tenantColors?: any;
    refetchData: () => Promise<void>;
    onTenantUpdate?: (updatedTenant: any) => void;
    isLight?: boolean;
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

const WAITER_GRADIENTS = [
    'from-pink-500 to-rose-600',
    'from-amber-400 to-orange-600',
    'from-emerald-400 to-teal-600',
    'from-cyan-400 to-blue-600',
    'from-purple-500 to-indigo-600',
    'from-fuchsia-500 to-pink-600',
    'from-red-500 to-orange-500',
    'from-violet-600 to-purple-800'
];

function getRandomGradient() {
    return WAITER_GRADIENTS[Math.floor(Math.random() * WAITER_GRADIENTS.length)];
}

export default function WaiterTab({ 
    orders, products, ingredients, productIngredients, categories, 
    notifications, tenant, tenantColors, refetchData, onTenantUpdate,
    isLight = false
}: WaiterTabProps) {
    const [localNotifications, setLocalNotifications] = useState<AppNotification[]>([]);
    const [tableItems, setTableItems] = useState<Record<string, { orderId: string, orderNumber: number, items: OrderItem[] }[]>>({});
    const [loading, setLoading] = useState(false);
    const [soundEnabled, setSoundEnabled] = useState(true);
    
    const [activeWaiter, setActiveWaiter] = useState<string | null>(null);
    const [showAddWaiterModal, setShowAddWaiterModal] = useState(false);
    const [newWaiterName, setNewWaiterName] = useState('');
    
    // Estados para la Comandera Móvil Táctil
    const [isTakingOrder, setIsTakingOrder] = useState(false);
    const [cart, setCart] = useState<Record<string, number>>({});
    const [cartNotes, setCartNotes] = useState<Record<string, string>>({});
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [orderLoading, setOrderLoading] = useState(false);
    const [cartPaymentMethod, setCartPaymentMethod] = useState<'efectivo' | 'mercadopago' | 'debito' | 'credito'>('efectivo');
    const [pendingPaymentTable, setPendingPaymentTable] = useState<any | null>(null);
    const [waiterManualCode, setWaiterManualCode] = useState('');
    const [waiterManualDiscount, setWaiterManualDiscount] = useState<number>(0);
    const [isWaiterValidatingCode, setIsWaiterValidatingCode] = useState(false);
    
    // Estados para facturación fiscal AFIP
    const [afipDocTipo, setAfipDocTipo] = useState<number>(99); // 99: Consumidor Final, 80: CUIT, 96: DNI
    const [afipDocNro, setAfipDocNro] = useState<string>('');

    const [orderToPrint, setOrderToPrint] = useState<Order | null>(null);
    const printComponentRef = useRef<HTMLDivElement>(null);
    const handlePrint = useReactToPrint({
        contentRef: printComponentRef,
        onAfterPrint: () => setOrderToPrint(null),
    });
    const triggerPrint = (orderData: Order) => {
        setOrderToPrint(orderData);
        setTimeout(() => handlePrint(), 100);
    };

    // Mapeo flexible para obtener siempre el ID técnico de la mesa
    const getTableId = (input: string): string => {
        if (!input) return '';
        const inputLower = input.toLowerCase().trim();
        // 1. Buscar coincidencia exacta por ID
        let found = tablesList.find(t => t.id.toLowerCase() === inputLower);
        if (found) return found.id;
        
        // 2. Buscar coincidencia exacta por nombre
        found = tablesList.find(t => t.name.toLowerCase() === inputLower);
        if (found) return found.id;
        
        // 3. Buscar coincidencia por número (extrayendo dígitos)
        const digitsMatch = inputLower.match(/\d+/);
        if (digitsMatch) {
            const num = digitsMatch[0];
            found = tablesList.find(t => {
                const nameNumMatch = t.name.toLowerCase().match(/\d+/);
                const idNumMatch = t.id.toLowerCase().match(/\d+/);
                return (nameNumMatch && nameNumMatch[0] === num) || (idNumMatch && idNumMatch[0] === num);
            });
            if (found) return found.id;
        }
        
        return input;
    };

    // Traducción dinámica de ID técnico a nombre legible (ej: "Mesa 1")
    const translateTableIdToName = (tableId: string): string => {
        if (!tableId) return 'Mesa';
        const found = tablesList.find(t => t.id === tableId || t.name === tableId);
        if (found) return found.name;
        
        // Si no se encuentra pero contiene dígitos, formatearlo como "Mesa <dígitos>"
        const numMatch = tableId.match(/\d+/);
        if (numMatch) {
            return `Mesa ${numMatch[0]}`;
        }
        return tableId;
    };

    // Traducir IDs técnicos en mensajes de notificaciones
    const translateNotificationMessage = (message: string): string => {
        if (!message) return '';
        let translated = message;
        // Buscar cualquier ID técnico que empiece con t_ y tenga números
        const techIdMatches = message.match(/t_\d+/g);
        if (techIdMatches) {
            techIdMatches.forEach(techId => {
                const name = translateTableIdToName(techId);
                translated = translated.replace(techId, name);
            });
        }
        return translated;
    };

    // Cargar mozo activo de localStorage al iniciar
    useEffect(() => {
        if (tenant?.id) {
            const storedWaiter = localStorage.getItem(`active_waiter_name_${tenant.id}`);
            if (storedWaiter) {
                setActiveWaiter(storedWaiter);
            }
        }
    }, [tenant?.id]);
    
    const [waitersList, setWaitersList] = useState<any[]>([]);

    // Recuperar lista de mozos desde la tabla employees unificada
    useEffect(() => {
        if (!tenant?.id) return;
        const fetchWaiters = async () => {
            const { data } = await supabase
                .from('employees')
                .select('*')
                .eq('tenant_id', tenant.id)
                .eq('role', 'waiter');
            if (data) {
                const mapped = data.map(e => ({
                    id: e.id,
                    name: e.name,
                    color: getRandomGradient() // Mantenemos colores aleatorios para la UI
                }));
                setWaitersList(mapped);
            }
        };
        fetchWaiters();
    }, [tenant?.id]);

    const handleSelectWaiter = (name: string) => {
        setActiveWaiter(name);
        if (tenant?.id) {
            localStorage.setItem(`active_waiter_name_${tenant.id}`, name);
        }
    };

    // Cargar y Escuchar Reservas de Hoy en Tiempo Real
    useEffect(() => {
        if (!tenant?.id) return;

        const fetchTodayReservations = async () => {
            setIsReservationsLoading(true);
            try {
                const todayStr = new Date().toISOString().split('T')[0];
                const { data, error } = await supabase
                    .from('reservations')
                    .select('*')
                    .eq('tenant_id', tenant.id)
                    .eq('reservation_date', todayStr)
                    .order('reservation_time', { ascending: true });

                if (error) throw error;
                setReservations(data || []);
            } catch (err) {
                console.error('Error al cargar reservas de hoy:', err);
            } finally {
                setIsReservationsLoading(false);
            }
        };

        fetchTodayReservations();

        const channel = supabase
            .channel(`waiter:reservations:tenant:${tenant.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'reservations',
                    filter: `tenant_id=eq.${tenant.id}`
                },
                (payload) => {
                    const todayStr = new Date().toISOString().split('T')[0];
                    const newRecord = payload.new as any;
                    const oldRecord = payload.old as any;
                    if (payload.eventType === 'INSERT' && newRecord && newRecord.reservation_date === todayStr) {
                        setReservations(prev => [...prev, newRecord].sort((a, b) => a.reservation_time.localeCompare(b.reservation_time)));
                    } else if (payload.eventType === 'UPDATE' && newRecord) {
                        setReservations(prev => prev.map(r => r.id === newRecord.id ? newRecord : r).filter(r => r.reservation_date === todayStr).sort((a, b) => a.reservation_time.localeCompare(b.reservation_time)));
                    } else if (payload.eventType === 'DELETE' && oldRecord) {
                        setReservations(prev => prev.filter(r => r.id !== oldRecord.id));
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [tenant?.id]);

    // Función para liberar una mesa marcada como ocupada por QR
    const handleFreeTable = async (tableId: string) => {
        if (!tenant?.id) return;
        try {
            // JIT Fetch para evitar condición de carrera
            const { data: latestTenant } = await supabase.from('tenants').select('tables').eq('id', tenant.id).single();
            const currentTables = Array.isArray(latestTenant?.tables) ? latestTenant.tables : (Array.isArray(tenant.tables) ? [...tenant.tables] : []);
            
            const updatedTables = currentTables.map((t: any) => {
                if (t.id === tableId) {
                    return { ...t, is_occupied: false };
                }
                return t;
            });

            if (onTenantUpdate) {
                onTenantUpdate({ ...tenant, tables: updatedTables });
            }

            const { error } = await supabase
                .from('tenants')
                .update({ tables: updatedTables })
                .eq('id', tenant.id);

            if (error) throw error;
            broadcastTenantChange(tenant.id);
            alert("🍽️ Mesa desocupada con éxito.");
        } catch (err) {
            console.error('Error al desocupar mesa:', err);
            alert('Error de conexión al liberar la mesa.');
        }
    };

    // Función para sentar/completar una reserva de hoy
    const handleCompleteReservation = async (reservationId: string) => {
        try {
            const { error } = await supabase
                .from('reservations')
                .update({ status: 'completed' })
                .eq('id', reservationId);
            
            if (error) throw error;
            alert("🎉 Reserva marcada como completada/sentada.");
        } catch (err) {
            console.error('Error al completar reserva:', err);
            alert("⚠️ Error al actualizar la reserva.");
        }
    };

    const handleAddWaiter = async (name: string) => {
        if (!name.trim()) return;
        // Ahora los mozos se crean desde Personal, pero si usan este atajo, creamos un empleado:
        if (tenant?.id) {
            try {
                const { data, error } = await supabase
                    .from('employees')
                    .insert([{
                        tenant_id: tenant.id,
                        name: name.trim(),
                        role: 'waiter',
                        pin_code: '1234'
                    }])
                    .select()
                    .single();
                
                if (!error && data) {
                    const newWaiter = {
                        id: data.id,
                        name: data.name,
                        color: getRandomGradient()
                    };
                    setWaitersList(prev => [...prev, newWaiter]);
                    handleSelectWaiter(newWaiter.name);
                } else {
                    alert("Error creando mozo. Intente desde la pestaña Personal.");
                }
            } catch (err) {
                console.error("Error al guardar empleado:", err);
            }
        }
        setNewWaiterName('');
        setShowAddWaiterModal(false);
    };

    const activeWaiterObj = waitersList.find(w => typeof w === 'object' && w !== null && w.name.toLowerCase().trim() === activeWaiter?.toLowerCase().trim());

    // --- LÓGICA DE STOCK DE LA COMANDERA MÓVIL TÁCTIL ---
    const getPendingUsage = (ingredientId: string) => {
        let usage = 0;
        const ingredient = ingredients.find(i => i.id === ingredientId);
        const ingDepts = ingredient?.target_departments || ['kitchen'];
        
        orders.forEach(order => {
            if (!order.is_archived && order.items) {
                order.items.forEach(item => {
                    if (item.status === 'pending') {
                        const itemDepts = item.target_departments || ['kitchen'];
                        const hasDeptOverlap = ingDepts.some((d: string) => itemDepts.includes(d));
                        
                        if (hasDeptOverlap) {
                            const recipe = productIngredients.filter(pi => pi.product_id === item.product_id);
                            const req = recipe.find(pi => pi.ingredient_id === ingredientId);
                            if (req) {
                                usage += req.quantity_used * item.quantity;
                            }
                        }
                    }
                });
            }
        });
        return usage;
    };

    const getAvailableStockForProduct = (productId: string, currentCart: Record<string, number> = cart) => {
        const recipe = productIngredients.filter(pi => pi.product_id === productId);
        if (recipe.length === 0) return Infinity;
        
        const ingredientUsageInCart: Record<string, number> = {};
        Object.entries(currentCart).forEach(([pid, quantity]) => {
            const itemRecipe = productIngredients.filter(pi => pi.product_id === pid);
            itemRecipe.forEach(req => {
                ingredientUsageInCart[req.ingredient_id] = (ingredientUsageInCart[req.ingredient_id] || 0) + (req.quantity_used * quantity);
            });
        });
        
        let maxPossible = Infinity;
        for (const req of recipe) {
            const ingredient = ingredients.find(i => i.id === req.ingredient_id);
            if (!ingredient) return 0;
            const usedAlready = ingredientUsageInCart[req.ingredient_id] || 0;
            const pendingUsed = getPendingUsage(req.ingredient_id);
            const remainingStock = ingredient.stock_level - usedAlready - pendingUsed;
            const canMake = Math.floor(remainingStock / req.quantity_used);
            if (canMake < maxPossible) maxPossible = canMake;
        }
        return Math.max(0, maxPossible);
    };

    const addToCart = (productId: string) => {
        const available = getAvailableStockForProduct(productId);
        if (available <= 0) return;

        const currentQty = cart[productId] || 0;
        setCart(prev => ({ ...prev, [productId]: currentQty + 1 }));
    };

    const removeFromCart = (productId: string) => {
        setCart(prev => {
            const currentQty = prev[productId] || 0;
            if (currentQty <= 1) {
                const next = { ...prev };
                delete next[productId];
                return next;
            }
            return { ...prev, [productId]: currentQty - 1 };
        });
    };

    const handleConfirmOrder = async () => {
        const cartItems = Object.entries(cart).filter(([_, qty]) => qty > 0);
        if (cartItems.length === 0) {
            alert("El carrito está vacío");
            return;
        }
        
        setOrderLoading(true);
        try {
            let total = 0;
            cartItems.forEach(([pid, qty]) => {
                const prod = products.find(p => p.id === pid);
                if (prod) {
                    const price = prod.price || 0;
                    total += price * qty;
                }
            });
            
            // 1. Insertar orden
            const { data: order, error: orderError } = await supabase
                .from('orders')
                .insert({
                    client_name: selectedTable?.name || 'Mesa',
                    table_number: selectedTable?.id || '',
                    total_price: total,
                    status: 'pending',
                    payment_status: 'pendiente',
                    payment_method: cartPaymentMethod,
                    waiter_name: activeWaiter,
                    tenant_id: tenant.id,
                    is_approved_for_production: true,
                    delivery_type: 'local'
                })
                .select()
                .single();
                
            if (orderError) throw orderError;
            
            // 2. Insertar los items
            const orderItemsInsert: any[] = [];
            
            cartItems.forEach(([pid, qty]) => {
                const prod = products.find(p => p.id === pid);
                const category = categories.find(c => c.id === prod?.category_id);
                const catDepts = category?.target_departments || ['kitchen'];
                const itemNotes = cartNotes[pid] || '';
                const price = prod?.price || 0;
                
                if (catDepts.length === 1) {
                    orderItemsInsert.push({
                        order_id: order.id,
                        product_id: pid,
                        quantity: qty,
                        unit_price: price,
                        status: 'pending',
                        tenant_id: tenant.id,
                        target_departments: catDepts,
                        notes: itemNotes,
                        is_served: false
                    });
                    return;
                }
                
                const recipe = productIngredients.filter(pi => pi.product_id === pid);
                if (recipe.length === 0) {
                    orderItemsInsert.push({
                        order_id: order.id,
                        product_id: pid,
                        quantity: qty,
                        unit_price: price,
                        status: 'pending',
                        tenant_id: tenant.id,
                        target_departments: ['kitchen'],
                        notes: itemNotes,
                        is_served: false
                    });
                    return;
                }
                
                const deptsMap: Record<string, string[]> = {};
                recipe.forEach(ri => {
                    const ing = ingredients.find(i => i.id === ri.ingredient_id);
                    const depts = (ing?.target_departments && ing.target_departments.length > 0) ? ing.target_departments : ['kitchen'];
                    depts.forEach((d: string) => {
                        if (!deptsMap[d]) deptsMap[d] = [];
                        if (ing) deptsMap[d].push(ing.name);
                    });
                });
                
                const deptsFound = Object.keys(deptsMap);
                if (deptsFound.length <= 1) {
                    orderItemsInsert.push({
                        order_id: order.id,
                        product_id: pid,
                        quantity: qty,
                        unit_price: price,
                        status: 'pending',
                        tenant_id: tenant.id,
                        target_departments: deptsFound.length === 1 ? [deptsFound[0]] : ['kitchen'],
                        notes: itemNotes,
                        is_served: false
                    });
                } else {
                    deptsFound.forEach((d, idx) => {
                        orderItemsInsert.push({
                            order_id: order.id,
                            product_id: pid,
                            quantity: qty,
                            unit_price: idx === 0 ? price : 0,
                            status: 'pending',
                            tenant_id: tenant.id,
                            target_departments: [d],
                            notes: (itemNotes ? `${itemNotes} | ` : '') + deptsMap[d].join(' + '),
                            is_served: false
                        });
                    });
                }
            });
            
            const { error: itemsError } = await supabase
                .from('order_items')
                .insert(orderItemsInsert);
                
            if (itemsError) throw itemsError;
            
            // Actualizar el estado de la mesa a ocupada en base de datos y localmente
            // JIT Fetch: Obtener el estado MÁS RECIENTE de la base de datos justo antes de actualizar
            const { data: latestTenant } = await supabase.from('tenants').select('tables').eq('id', tenant.id).single();
            const currentTables = Array.isArray(latestTenant?.tables) ? latestTenant.tables : (Array.isArray(tenant.tables) ? [...tenant.tables] : []);
            
            const updatedTables = currentTables.map((t: any) => {
                if (t.id === selectedTable?.id) {
                    return { ...t, is_occupied: true };
                }
                return t;
            });

            // Guardar en Supabase y validar errores
            const { error: tenantError } = await supabase.from('tenants')
                .update({ tables: updatedTables })
                .eq('id', tenant.id);

            if (tenantError) {
                console.error("Error al actualizar estado de la mesa en tenants:", tenantError);
                throw tenantError;
            }

            // Sincronizar el estado local en la app
            if (onTenantUpdate) {
                onTenantUpdate({ ...tenant, tables: updatedTables });
            }

            // Notificar cambios en tiempo real
            broadcastTenantChange(tenant.id);

            // 3. Notificar a departamentos
            const targetDeptsSet = new Set<string>();
            orderItemsInsert.forEach(item => {
                item.target_departments.forEach((d: string) => targetDeptsSet.add(d));
            });
            const notifyRoles = Array.from(targetDeptsSet);
            if (!notifyRoles.includes('admin')) notifyRoles.push('admin');
            
            await supabase.from('app_notifications').insert([{
                message: `🔔 Nuevo pedido de ${selectedTable?.name || 'Mesa'} tomado por ${activeWaiter} #${order.order_number}`,
                type: 'info',
                target_roles: notifyRoles,
                tenant_id: tenant.id
            }]);
            
            alert("¡Pedido enviado a cocina con éxito!");
            setCart({});
            setCartNotes({});
            setCartPaymentMethod('efectivo');
            setIsTakingOrder(false);
            
            await refetchData();
            await fetchItemsToServe();
            
        } catch (err: any) {
            console.error("Error al enviar comanda:", err);
            alert("Error al enviar el pedido: " + err.message);
        } finally {
            setOrderLoading(false);
        }
    };

    const [activeSubTab, setActiveSubTab] = useState<'my-tables' | 'all-tables' | 'alerts' | 'reservations'>('my-tables');
    const [reservations, setReservations] = useState<any[]>([]);
    const [isReservationsLoading, setIsReservationsLoading] = useState(false);
    
    // Mesa seleccionada para el detalle (Modal)
    const [selectedTable, setSelectedTable] = useState<TableInfo | null>(null);

    const { removeNotification, addNotification } = useNotifications();
    const primaryColor = tenantColors?.primary || '#f97316';
    const secondaryColor = tenantColors?.secondary || '#1e293b';

    // Generar mesas por defecto si el tenant no tiene mesas registradas en 'tables'
    const defaultTables: TableInfo[] = [
        { id: 't1', name: 'Mesa 1', description: 'Sector Ventanal VIP', waiter_name: null },
        { id: 't2', name: 'Mesa 2', description: 'Sector Ventanal VIP', waiter_name: null },
        { id: 't3', name: 'Mesa 3', description: 'Terraza Principal', waiter_name: null },
        { id: 't4', name: 'Mesa 4', description: 'Terraza Principal', waiter_name: null },
        { id: 't5', name: 'Mesa 5', description: 'Salón Central', waiter_name: null },
        { id: 't6', name: 'Mesa 6', description: 'Salón Central', waiter_name: null },
        { id: 't7', name: 'Mesa 7', description: 'Barra Alta', waiter_name: null },
        { id: 't8', name: 'Mesa 8', description: 'Barra Alta', waiter_name: null }
    ];

    const tablesList: TableInfo[] = Array.isArray(tenant?.tables) 
        ? (tenant.tables as TableInfo[]) 
        : defaultTables;

    // Estado Multi-Mozo: Mesas asignadas a este mozo en particular (derivado de tablesList y activeWaiter)
    const myTables = React.useMemo(() => {
        if (!activeWaiter) return [];
        const normActive = activeWaiter.toLowerCase().trim();
        return tablesList
            .filter(t => t.waiter_name?.toLowerCase().trim() === normActive)
            .map(t => t.id);
    }, [tablesList, activeWaiter]);

    // Guardar / Asignar mesas en Supabase
    const toggleTableAssignment = async (tableId: string) => {
        if (!activeWaiter || !tenant?.id) return;
        
        const tableObj = tablesList.find(t => t.id === tableId);
        const normActive = activeWaiter.toLowerCase().trim();
        const isCurrentlyAssignedToMe = tableObj && tableObj.waiter_name 
            ? tableObj.waiter_name.toLowerCase().trim() === normActive 
            : false;
        
        // JIT Fetch: Obtener estado fresco
        const { data: latestTenant } = await supabase.from('tenants').select('tables').eq('id', tenant.id).single();
        const currentTables = Array.isArray(latestTenant?.tables) ? latestTenant.tables : tablesList;

        const updatedTables = currentTables.map((table: any) => {
            if (table.id === tableId) {
                // Si la mesa ya está ocupada por otro mozo, no permitimos asignársela
                if (table.waiter_name && table.waiter_name.toLowerCase().trim() !== normActive) {
                    return table;
                }
                return {
                    ...table,
                    waiter_name: isCurrentlyAssignedToMe ? null : activeWaiter
                };
            }
            return table;
        });

        // Actualización optimista local para fluidez inmediata
        if (onTenantUpdate) {
            onTenantUpdate({ ...tenant, tables: updatedTables });
        }

        // Consistencia bidireccional: Actualizar waiter_name en los pedidos activos de la mesa
        try {
            const tableNamesToMatch = tableObj ? [tableId, tableObj.name] : [tableId];
            const newWaiterName = isCurrentlyAssignedToMe ? null : activeWaiter;

            await supabase
                .from('orders')
                .update({ waiter_name: newWaiterName })
                .eq('tenant_id', tenant.id)
                .in('table_number', tableNamesToMatch)
                .in('status', ['pending', 'delivered']);
        } catch (orderErr) {
            console.error("[TOGGLE ASSIGNMENT ERROR] Error al actualizar waiter_name en orders activos:", orderErr);
        }

        try {
            const { data, error } = await supabase
                .from('tenants')
                .update({ tables: updatedTables })
                .eq('id', tenant.id)
                .select()
                .single();
            
            if (!error && data) {
                if (onTenantUpdate) {
                    onTenantUpdate(data);
                }
                broadcastTenantChange(tenant.id);
            } else {
                console.error("Error al actualizar mesas en Supabase:", error);
            }
        } catch (err) {
            console.error("Fallo de conexión al actualizar mesas:", err);
        }
    };

    const handleValidateWaiterCode = async () => {
        if (!tenant || !waiterManualCode) return;
        setIsWaiterValidatingCode(true);
        try {
            let codeToSearch = waiterManualCode.toUpperCase().trim();
            if (codeToSearch.length === 4 && !codeToSearch.startsWith('RES-')) {
                codeToSearch = 'RES-' + codeToSearch;
            }
            // Buscar en reservations
            const { data: resData } = await supabase.from('reservations')
                .select('*')
                .eq('tenant_id', tenant.id)
                .eq('reservation_code', codeToSearch)
                .maybeSingle();
            
            if (resData && !resData.is_deposit_applied) {
                setWaiterManualDiscount(resData.deposit_amount || 0);
                alert(`✅ Reserva encontrada. Seña a descontar: $${resData.deposit_amount || 0}`);
            } else if (resData && resData.is_deposit_applied) {
                alert("⚠️ La seña de esta reserva ya fue aplicada anteriormente.");
            } else {
                // Buscar en discount_codes
                const { data: codeData } = await supabase.from('discount_codes')
                    .select('*')
                    .eq('tenant_id', tenant.id)
                    .eq('code', codeToSearch)
                    .maybeSingle();
                
                if (codeData && !codeData.is_used) {
                    setWaiterManualDiscount(codeData.discount_amount || 0);
                    alert(`✅ Código de descuento encontrado. Descuento: $${codeData.discount_amount || 0}`);
                } else if (codeData && codeData.is_used) {
                    alert("⚠️ Este código ya fue utilizado.");
                } else {
                    alert("⚠️ Código inválido o no encontrado.");
                }
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsWaiterValidatingCode(false);
        }
    };

    const handleConfirmTablePayment = async (tableId: string, method: 'efectivo' | 'debito' | 'credito', isAfipBilling: boolean = false) => {
        if (!tenant?.id) return;
        
        setOrderLoading(true);
        try {
            const tableObj = tablesList.find(t => t.id === tableId);
            const tableNamesToMatch = tableObj ? [tableId, tableObj.name] : [tableId];
            
            // 1. Obtener órdenes activas de esta mesa
            const activeOrdersOfTable = orders.filter(o => 
                o.tenant_id === tenant.id &&
                tableNamesToMatch.includes(o.table_number || '') &&
                o.status !== 'completed' &&
                !o.is_archived
            );

            if (activeOrdersOfTable.length === 0) {
                alert("No hay pedidos activos para esta mesa.");
                setPendingPaymentTable(null);
                setOrderLoading(false);
                return;
            }

            // 2. Actualizar todas las órdenes de la mesa a completadas y pagadas
            const orderIds = activeOrdersOfTable.map(o => o.id);
            for (let i = 0; i < orderIds.length; i++) {
                const orderId = orderIds[i];
                const updatePayload: any = {
                    status: 'completed',
                    payment_status: 'pagado',
                    payment_method: method,
                    is_archived: true
                };
                
                // Si se realiza facturación AFIP con DNI/CUIT, guardar en la orden
                if (isAfipBilling && afipDocNro) {
                    updatePayload.afip_doc_tipo = afipDocTipo;
                    updatePayload.afip_doc_nro = afipDocNro.trim();
                }
                
                if (i === 0 && waiterManualCode && waiterManualDiscount > 0) {
                    updatePayload.coupon_code = waiterManualCode.toUpperCase().trim();
                    updatePayload.discount_amount = waiterManualDiscount;
                    
                    const firstOrderObj = activeOrdersOfTable[0];
                    const currentTotal = firstOrderObj.total_price || 0;
                    updatePayload.total_price = Math.max(0, currentTotal - waiterManualDiscount);
                }
                
                const { error: ordersError } = await supabase
                    .from('orders')
                    .update(updatePayload)
                    .eq('id', orderId);
                
                if (ordersError) throw ordersError;
            }

            // JIT Fetch: Evitar condición de carrera
            const { data: latestTenant } = await supabase.from('tenants').select('tables').eq('id', tenant.id).single();
            const currentTables = Array.isArray(latestTenant?.tables) ? latestTenant.tables : tablesList;

            // 3. Liberar la mesa (waiter_name = null e is_occupied = false)
            const updatedTables = currentTables.map((table: any) => {
                if (table.id === tableId) {
                    return {
                        ...table,
                        waiter_name: null,
                        is_occupied: false
                    };
                }
                return table;
            });

            const { error: tenantError } = await supabase
                .from('tenants')
                .update({ tables: updatedTables })
                .eq('id', tenant.id);

            if (tenantError) throw tenantError;

            // 4. Resolver notificaciones del mozo sobre esta mesa
            await autoResolveTableNotifications(tableId);

            // 4.5 Quemar código si se usó uno
            if (waiterManualCode && waiterManualDiscount > 0) {
                const codeUpper = waiterManualCode.toUpperCase().trim();
                // Intentar en reservas primero
                await supabase.from('reservations').update({ is_deposit_applied: true }).eq('tenant_id', tenant.id).eq('reservation_code', codeUpper);
                // Intentar en códigos de descuento
                await supabase.from('discount_codes').update({ is_used: true }).eq('tenant_id', tenant.id).eq('code', codeUpper);
            }

            // 5. Notificación general
            const breakdown = activeOrdersOfTable.map(o => `#${o.order_number}`).join(', ');
            const clientName = tableObj?.name || tableId;
            const message = `💵 Mesa ${clientName} COBRADA (${method.toUpperCase()}) y liberada por Mozo: Pedidos ${breakdown}`;
            
            await supabase.from('app_notifications').insert([{
                message: message,
                type: 'success',
                target_roles: ['staff', 'admin'],
                tenant_id: tenant.id
            }]);

            // Actualización optimista local
            if (onTenantUpdate) {
                onTenantUpdate({ ...tenant, tables: updatedTables });
            }

            broadcastTenantChange(tenant.id);
            alert(`¡Mesa ${clientName} cobrada y liberada con éxito en ${method.toUpperCase()}!`);

            // AFIP Billing
            if (isAfipBilling && tenant?.afip_enabled && activeOrdersOfTable.length > 0) {
                try {
                    // Seleccionar la primera orden activa para representar el ID principal y calcular el total de todas juntas
                    const mainOrderId = activeOrdersOfTable[0].id;
                    let totalToBill = 0;
                    activeOrdersOfTable.forEach((o, i) => {
                        let subtotal = o.total_price || 0;
                        if (i === 0 && waiterManualCode && waiterManualDiscount > 0) {
                            subtotal = Math.max(0, subtotal - waiterManualDiscount);
                        }
                        totalToBill += subtotal;
                    });

                    addNotification(`⏳ Procesando factura AFIP para la mesa ${clientName}...`, ['staff', 'admin'], 'info', tenant?.id);
                    const response = await fetch('/api/afip/facturar', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            orderId: mainOrderId,
                            amount: totalToBill,
                            tenantId: tenant.id,
                            docTipo: afipDocNro ? afipDocTipo : 99,
                            docNro: afipDocNro ? parseInt(afipDocNro.trim()) : 0
                        })
                    });
                    const afipResult = await response.json();
                    if (!response.ok || !afipResult.success) {
                        throw new Error(afipResult.error || 'Error desconocido al facturar con AFIP');
                    }
                    addNotification(`✅ Factura AFIP generada con éxito (CAE: ${afipResult.cae})`, ['staff', 'admin'], 'success', tenant?.id);
                    alert("¡Factura Electrónica generada con éxito! CAE: " + afipResult.cae);
                } catch (afipErr: any) {
                    console.error("Error al facturar con AFIP:", afipErr);
                    alert("El cobro se registró, pero la facturación AFIP falló:\n" + afipErr.message);
                }
            }
            
            setPendingPaymentTable(null);
            setSelectedTable(null); // Cerrar detalle de mesa
            setWaiterManualCode('');
            setWaiterManualDiscount(0);
            setAfipDocTipo(99);
            setAfipDocNro('');
        } catch (err: any) {
            console.error("Error al cobrar mesa:", err);
            alert("Error al registrar pago de la mesa: " + (err.message || err));
        } finally {
            setOrderLoading(false);
        }
    };

    // 1. Filtrar notificaciones dirigidas al mozo que sean llamados de asistencia o alertas
    useEffect(() => {
        const waiterNotifs = notifications.filter(n => {
            const translatedMessage = translateNotificationMessage(n.message);
            const msgLower = translatedMessage.toLowerCase();
            
            // Llamados de asistencia
            const isTargeted = n.target_roles.includes('waiter');
            let isAssistance = msgLower.includes('asistencia') || 
                                 msgLower.includes('mesa') || 
                                 msgLower.includes('mozo') || 
                                 msgLower.includes('llamado');
            
            let isForSomeoneElse = false;
            if (isAssistance) {
                // Si la alerta es de una mesa asignada a otro mozo, la ignoramos para este mozo
                const tableMatch = tablesList.find(t => {
                    const name = t.name.toLowerCase();
                    const numMatch = name.match(/\d+/);
                    if (msgLower.includes(name)) return true;
                    if (numMatch) {
                        const num = numMatch[0];
                        return msgLower.includes(`mesa ${num}`) || msgLower.includes(`mesa: ${num}`) || msgLower.includes(`mesa #${num}`);
                    }
                    return false;
                });

                if (tableMatch && tableMatch.waiter_name && activeWaiter && tableMatch.waiter_name.toLowerCase().trim() !== activeWaiter.toLowerCase().trim()) {
                    isForSomeoneElse = true;
                }
            }
                                 
            // Excluir notificaciones de admin o insumos generales no operativas
            const isSystemOrPrep = msgLower.includes('stock') || 
                                   msgLower.includes('insumo') || 
                                   msgLower.includes('caja') ||
                                   msgLower.includes('insumos');

            return (isTargeted || isAssistance) && !isSystemOrPrep && !isForSomeoneElse;
        });
        setLocalNotifications(waiterNotifs);
    }, [notifications, tablesList, activeWaiter]);

    // 2. Agrupar y procesar comandas activas

    const ordersRef = useRef(orders);
    useEffect(() => {
        ordersRef.current = orders;
        fetchItemsToServe();
    }, [orders]);

    const fetchItemsToServe = async () => {
        setLoading(true);
        try {
            const activeOrders = ordersRef.current.filter(o => 
                (o.status === 'pending' || o.status === 'delivered') && 
                o.payment_status !== 'pagado' &&
                !o.is_archived &&
                (
                    (o.table_number && o.table_number.trim() !== '') ||
                    (o.client_name && o.client_name.toLowerCase().includes('mesa'))
                )
            );
            const activeOrderIds = activeOrders.map(o => o.id);
            
            if (activeOrderIds.length === 0) {
                setTableItems({});
                setLoading(false);
                return;
            }

            const { data, error } = await supabase
                .from('order_items')
                .select('*, product:products(*), order:orders(*)')
                .in('order_id', activeOrderIds)
                .order('created_at', { ascending: true });

            if (error) {
                console.error("Error fetching order items:", error);
            } else if (data) {
                const itemsByTable: Record<string, { orderId: string, orderNumber: number, items: OrderItem[] }[]> = {};

                (data as any[]).forEach(item => {
                    const orderObj = item.order as Order;
                    const tableNumber = orderObj?.table_number;
                    if (!tableNumber) return; // Omitir si no tiene mesa técnica
                    
                    const tableId = getTableId(tableNumber);
                    if (!tableId) return;

                    if (!itemsByTable[tableId]) {
                        itemsByTable[tableId] = [];
                    }

                    let orderGroup = itemsByTable[tableId].find(g => g.orderId === item.order_id);
                    if (!orderGroup) {
                        orderGroup = {
                            orderId: item.order_id,
                            orderNumber: orderObj?.order_number || 0,
                            items: []
                        };
                        itemsByTable[tableId].push(orderGroup);
                    }

                    orderGroup.items.push(item);
                });

                // Mostrar todas las mesas con pedidos activos, incluso si ya están 100% servidas.
                // Permanecerán hasta que el mozo cobre o libere la mesa.
                const filteredTableItems: Record<string, { orderId: string, orderNumber: number, items: OrderItem[] }[]> = {};
                Object.entries(itemsByTable).forEach(([tableId, groups]) => {
                    if (groups.length > 0) {
                        filteredTableItems[tableId] = groups;
                    }
                });

                setTableItems(filteredTableItems);
            }
        } catch (err) {
            console.error("Error in fetchItemsToServe:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const channel = supabase
            .channel('waiter_items_changes_v2')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'order_items' },
                () => { fetchItemsToServe(); }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'orders' },
                () => { fetchItemsToServe(); }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    // 3. Auto-sincronización proactiva eliminada para disolver bucles de carrera de datos

    // Helpers para mapeo inteligente de mesas a comandas y notificaciones
    const isTableCalling = (tableId: string) => {
        if (!tableId) return false;
        const resolvedId = getTableId(tableId);

        return localNotifications.some(n => {
            const translatedMessage = translateNotificationMessage(n.message);
            const msg = translatedMessage.toLowerCase();
            
            // FILTRADO ROBUSTO: Solo es llamada de auxilio/presencia si contiene palabras clave y NO es un pedido/comanda
            const isExplicitCall = msg.includes('asistencia') || msg.includes('ayuda') || msg.includes('llamado') || msg.includes('llamar');
            const isOrderAlert = msg.includes('pedido') || msg.includes('comanda') || msg.includes('actualizado') || msg.includes('listo');
            
            if (!isExplicitCall || isOrderAlert) return false;

            if (msg.includes(resolvedId.toLowerCase())) return true;
            
            const tableObj = tablesList.find(t => t.id === resolvedId);
            if (tableObj) {
                const name = tableObj.name.toLowerCase();
                if (msg.includes(name)) return true;
                
                const numMatch = name.match(/\d+/);
                if (numMatch) {
                    const num = numMatch[0];
                    return msg.includes(`mesa ${num}`) || msg.includes(`mesa: ${num}`) || msg.includes(`mesa #${num}`);
                }
            }
            return false;
        });
    };

    const getTableStatus = (tableId: string) => {
        if (isTableCalling(tableId)) return 'calling'; // Rojo latido

        const ordersInTable = getTableOrders(tableId);
        if (ordersInTable.length > 0) {
            const hasReadyToServe = ordersInTable.some(group => 
                group.items.some(item => item.status === 'delivered' && !item.is_served)
            );
            if (hasReadyToServe) return 'ready'; // Rojo palpitante / Platos listos

            const isAllServed = ordersInTable.every(group => 
                group.items.every(item => item.is_served)
            );
            if (isAllServed) return 'served'; // Comensales comiendo

            return 'occupied'; // Azul LED / Cocinando
        }
        
        // CORRECCIÓN: Si no hay pedidos pero la mesa está ocupada en el sistema, mantener estado 'occupied_empty' para evitar "COCINANDO"
        const resolvedId = getTableId(tableId);
        const tableObj = tablesList.find(t => t.id === resolvedId);
        if (tableObj?.is_occupied) {
            return 'occupied_empty';
        }
        
        return 'free'; // Disponible / Libre
    };

    const getTableOrders = (tableId: string) => {
        if (!tableId) return [];
        const resolvedId = getTableId(tableId);
        return tableItems[resolvedId] || [];
    };



    // 3. Control de Sonido Inteligente (Solo para Mis Mesas)
    const prevNotifLength = useRef(0);
    useEffect(() => {
        if (!soundEnabled || localNotifications.length <= prevNotifLength.current) {
            prevNotifLength.current = localNotifications.length;
            return;
        }

        const newNotifs = localNotifications.slice(prevNotifLength.current);
        const hasNewAlertForMe = newNotifs.some(n => {
            const translatedMessage = translateNotificationMessage(n.message);
            const msg = translatedMessage.toLowerCase();
            
            // Llamados explícitos de ayuda
            const isExplicitCall = msg.includes('asistencia') || msg.includes('ayuda') || msg.includes('llamado') || msg.includes('llamar');
            
            // Actualizaciones o completados de Cocina / Barra
            const isOrderAlert = (msg.includes('cocina') || msg.includes('barra')) && 
                                 (msg.includes('actualizó') || msg.includes('completó')) && 
                                 msg.includes('pedido');
            
            if (!isExplicitCall && !isOrderAlert) return false;

            return tablesList.some(table => {
                const isMyTable = myTables.includes(table.id);
                const isFreeTable = !table.waiter_name;
                if (!isMyTable && !isFreeTable) return false;
                
                const name = table.name.toLowerCase();
                if (msg.includes(name)) return true;
                
                const numMatch = name.match(/\d+/);
                if (numMatch) {
                    const num = numMatch[0];
                    return msg.includes(`mesa ${num}`) || msg.includes(`mesa: ${num}`) || msg.includes(`mesa #${num}`);
                }
                return false;
            });
        });

        if (hasNewAlertForMe) {
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2043/2043-preview.mp3');
            audio.volume = 0.6;
            audio.play().catch(e => console.log('Timbre bloqueado por navegador:', e));
        }

        prevNotifLength.current = localNotifications.length;
    }, [localNotifications, soundEnabled, myTables, tablesList]);

    const prevReadyCount = useRef<number | null>(null);
    useEffect(() => {
        let readyCountForMe = 0;
        
        tablesList.forEach(table => {
            if (myTables.includes(table.id)) {
                const ordersInTable = getTableOrders(table.id);
                ordersInTable.forEach(g => {
                    g.items.forEach(i => {
                        if (i.status === 'delivered' && !i.is_served) {
                            readyCountForMe++;
                        }
                    });
                });
            }
        });

        if (prevReadyCount.current !== null && readyCountForMe > prevReadyCount.current) {
            if (soundEnabled) {
                const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
                audio.volume = 0.5;
                audio.play().catch(e => console.log('Campana bloqueada por navegador:', e));
            }
        }
        prevReadyCount.current = readyCountForMe;
    }, [tableItems, soundEnabled, myTables, tablesList]);

    // Función helper para auto-resolver notificaciones activas de una mesa al entregar platos
    const autoResolveTableNotifications = async (tableId: string) => {
        if (!tenant?.id) return;
        const resolvedId = getTableId(tableId);
        const tableObj = tablesList.find(t => t.id === resolvedId);
        if (!tableObj) return;

        const tableNameStr = tableObj.name;
        
        const notifsToDelete = localNotifications.filter(n => {
            const translated = translateNotificationMessage(n.message).toLowerCase();
            const lowerName = tableNameStr.toLowerCase();
            const lowerId = resolvedId.toLowerCase();
            
            return translated.includes(lowerName) || translated.includes(lowerId);
        });

        if (notifsToDelete.length === 0) return;

        const idsToDelete = notifsToDelete.map(n => n.id);
        
        await supabase
            .from('app_notifications')
            .delete()
            .in('id', idsToDelete);
            
        broadcastTenantChange(tenant.id);
        await refetchData();
    };

    const checkAndArchiveOrderIfFullyServedAndPaid = async (orderId: string) => {
        try {
            // 1. Obtener la comanda
            const { data: order } = await supabase
                .from('orders')
                .select('*')
                .eq('id', orderId)
                .single();

            if (!order) return;

            // 2. Obtener todos los ítems de la orden para validar
            const { data: items } = await supabase
                .from('order_items')
                .select('is_served')
                .eq('order_id', orderId);

            if (!items || items.length === 0) return;

            // Nota: Se removió la autoliberación automática al servir platos. La mesa permanece ocupada
            // y es el mozo quien debe desocuparla o registrar el cobro manualmente cuando los clientes se retiren.
        } catch (err) {
            console.error("Error en autocompletado desde mozo:", err);
        }
    };

    // Acciones de servicio de ítems
    const handleServeItem = async (itemId: string) => {
        let itemToServe: any = null;
        let foundTableId: string | null = null;
        Object.entries(tableItems).forEach(([tableId, groups]) => {
            groups.forEach(g => {
                const found = g.items.find(i => i.id === itemId);
                if (found) {
                    itemToServe = found;
                    foundTableId = tableId;
                }
            });
        });
        
        if (itemToServe && itemToServe.status !== 'delivered') {
            alert('No se puede entregar un producto que no ha sido preparado por cocina o barra.');
            return;
        }

        const { error } = await supabase
            .from('order_items')
            .update({ is_served: true })
            .eq('id', itemId);

        if (error) {
            alert('Error al servir plato: ' + error.message);
        } else {
            fetchItemsToServe();
            // --- INYECCIÓN DE AUTO-CIERRE ---
            const foundOrder = orders.find(o => o.items?.some(i => i.id === itemId));
            if (foundOrder) {
                checkAndArchiveOrderIfFullyServedAndPaid(foundOrder.id);
            }
            // ---------------------------------
            if (foundTableId) {
                await autoResolveTableNotifications(foundTableId);
            }
        }
    };

    const handleSendOrderToProduction = async (orderId: string) => {
        const { error } = await supabase
            .from('orders')
            .update({ is_approved_for_production: true })
            .eq('id', orderId);

        if (error) {
            alert("Error al enviar el pedido a producción: " + error.message);
        } else {
            addNotification(`🍳 Pedido de mesa enviado a producción`, ['kitchen', 'bartender', 'admin'], 'info', tenant?.id);
            alert("¡Pedido enviado a producción!");
            fetchItemsToServe();
            if (tenant?.id) {
                broadcastTenantChange(tenant.id);
            }
        }
    };

    const handleServeAllInGroup = async (group: { orderId: string, items: OrderItem[] }) => {
        const notReadyItems = group.items.filter(i => i.status !== 'delivered' && !i.is_served);
        if (notReadyItems.length > 0) {
            alert('No se pueden entregar productos que no han sido preparados por cocina o barra.');
            return;
        }

        const ids = group.items
            .filter(i => i.status === 'delivered' && !i.is_served)
            .map(i => i.id);
            
        if (ids.length === 0) return;
        
        let foundTableId: string | null = null;
        Object.entries(tableItems).forEach(([tableId, groups]) => {
            if (groups.some(g => g.orderId === group.orderId)) {
                foundTableId = tableId;
            }
        });

        const { error } = await supabase
            .from('order_items')
            .update({ is_served: true })
            .in('id', ids);

        if (error) {
            alert('Error al servir platos: ' + error.message);
        } else {
            fetchItemsToServe();
            // --- INYECCIÓN DE AUTO-CIERRE ---
            checkAndArchiveOrderIfFullyServedAndPaid(group.orderId);
            // ---------------------------------
            if (foundTableId) {
                await autoResolveTableNotifications(foundTableId);
            }
        }
    };

    // Simular un llamado de asistencia en tiempo real mediante base de datos Supabase
    const handleSimulateAssistance = async (tableName: string) => {
        const { error } = await supabase.from('app_notifications').insert([{
            message: `🚨 Llamado de Asistencia en ${tableName}`,
            type: 'alert',
            target_roles: ['waiter', 'admin', 'staff']
        }]);
        
        if (error) {
            alert("Error al enviar llamado de asistencia: " + error.message);
        }
    };

    // Resolver una notificación (marcar como atendida)
    const handleResolveNotification = async (notifId: string) => {
        await removeNotification(notifId, tenant?.id);
    };

    // Contadores de alertas prioritarias para las pestañas
    const activeAlertsCount = localNotifications.length;

    const isAnyReservationWithinOneHour = reservations.some(res => {
        if (res.status !== 'confirmed') return false;
        try {
            const resDate = new Date(`${res.reservation_date}T${res.reservation_time}:00`);
            const diffMins = (resDate.getTime() - new Date().getTime()) / 60000;
            return diffMins > 0 && diffMins <= 60;
        } catch (e) {
            return false;
        }
    });
    
    // Contar cuántas de mis mesas tienen platos listos para servir
    const myTablesWithReadyItems = tablesList.filter(table => {
        if (!myTables.includes(table.id)) return false;
        const status = getTableStatus(table.id);
        return status === 'ready' || status === 'calling';
    }).length;

    // Pantalla de Selección de Perfil estilo Netflix si no hay mozo activo
    if (!activeWaiter) {
        return (
            <div className={`fixed inset-0 z-[300] flex flex-col items-center justify-center p-6 overflow-y-auto font-sans animate-in fade-in duration-500 transition-colors duration-500 ${
                isLight ? 'bg-slate-50 text-slate-900' : 'bg-slate-950/98 text-white'
            }`}>
                <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                    <div className="absolute -top-40 -left-40 w-[30rem] h-[30rem] bg-orange-600/10 rounded-full filter blur-[120px] animate-pulse" />
                    <div className="absolute -bottom-40 -right-40 w-[30rem] h-[30rem] bg-pink-600/10 rounded-full filter blur-[120px] animate-pulse" />
                </div>
                
                <div className="relative w-full max-w-4xl text-center space-y-12 animate-in zoom-in-95 duration-500">
                    <div className="space-y-4">
                        <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-orange-500 to-rose-600 flex items-center justify-center mx-auto shadow-2xl shadow-orange-500/20 mb-6 animate-bounce">
                            <Sparkles className="text-white" size={32} />
                        </div>
                        <h1 className={`text-4xl sm:text-5xl font-black tracking-tight uppercase italic leading-tight transition-colors ${
                            isLight ? 'text-slate-900' : 'text-white'
                        }`}>
                            ¿Quién está <span className="bg-gradient-to-r from-orange-400 via-pink-500 to-rose-500 bg-clip-text text-transparent">atendiendo hoy?</span>
                        </h1>
                        <p className={`text-[10px] sm:text-xs font-black uppercase tracking-widest max-w-md mx-auto transition-colors ${
                            isLight ? 'text-slate-500' : 'text-slate-400'
                        }`}>
                            Ingresa con tu perfil de mozo para ver tus mesas asignadas y tomar pedidos en tiempo real
                        </p>
                    </div>
                    
                    {/* Grid de Mozos estilo Netflix */}
                    <div className="flex flex-wrap items-center justify-center gap-8 max-w-3xl mx-auto py-4">
                        {waitersList.map((w: any) => {
                            const waiterId = typeof w === 'string' ? w : (w.id || w.name);
                            const waiterName = typeof w === 'string' ? w : w.name;
                            const waiterColor = typeof w === 'string' ? 'from-orange-500 to-rose-500' : (w.color || 'from-orange-500 to-rose-500');
                            const initial = waiterName.charAt(0).toUpperCase();
                            
                            return (
                                <button
                                    key={waiterId}
                                    onClick={() => handleSelectWaiter(waiterName)}
                                    className="group flex flex-col items-center space-y-4 focus:outline-none transition-transform duration-300 active:scale-95"
                                >
                                    <div className={`w-28 h-28 sm:w-32 sm:h-32 rounded-3xl bg-gradient-to-br ${waiterColor} flex items-center justify-center text-white font-black text-4xl shadow-xl group-hover:scale-108 group-hover:ring-4 group-hover:ring-orange-500/80 transition-all duration-300 relative overflow-hidden border ${
                                        isLight ? 'border-slate-100 shadow-md shadow-slate-200/50' : 'border-white/10 shadow-black/40'
                                    }`}>
                                        <div className="absolute inset-0 bg-slate-950/20 group-hover:bg-transparent transition-colors duration-300" />
                                        <span className="relative z-10 select-none tracking-tighter drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]">{initial}</span>
                                        <div className="absolute bottom-0 inset-x-0 h-1/3 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                    </div>
                                    <span className={`font-black text-xs sm:text-sm uppercase tracking-wider transition-colors max-w-[120px] truncate ${
                                        isLight ? 'text-slate-650 group-hover:text-slate-900' : 'text-slate-400 group-hover:text-white'
                                    }`}>
                                        {waiterName}
                                    </span>
                                </button>
                            );
                        })}
                        
                        {/* Botón Agregar Mozo */}
                        <button
                            onClick={() => setShowAddWaiterModal(true)}
                            className="group flex flex-col items-center space-y-4 focus:outline-none transition-transform duration-300 active:scale-95"
                        >
                            <div className={`w-28 h-28 sm:w-32 sm:h-32 rounded-3xl border-2 border-dashed flex items-center justify-center group-hover:scale-108 transition-all duration-300 ${
                                isLight 
                                    ? 'bg-white border-slate-350 hover:border-orange-500/60 text-slate-400 hover:text-orange-500 group-hover:bg-slate-50' 
                                    : 'border-slate-800 hover:border-orange-500/60 text-slate-600 hover:text-orange-400 group-hover:bg-slate-900/20 bg-slate-950/40 backdrop-blur-sm'
                            }`}>
                                <Plus size={36} className="group-hover:rotate-90 transition-transform duration-300" />
                            </div>
                            <span className={`font-black text-xs sm:text-sm uppercase tracking-wider transition-colors ${
                                isLight ? 'text-slate-500 group-hover:text-orange-500' : 'text-slate-600 group-hover:text-orange-400'
                            }`}>
                                Nuevo Perfil
                            </span>
                        </button>
                    </div>
                </div>
                
                {/* Modal para Agregar Mozo */}
                {showAddWaiterModal && (
                    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
                        <div className={`w-full max-w-sm rounded-[2.5rem] p-6 space-y-6 shadow-2xl border font-sans transition-all duration-300 ${
                            isLight ? 'bg-white border-slate-200/80 shadow-slate-200/50' : 'bg-slate-950/90 border-white/10 backdrop-blur-2xl'
                        }`}>
                            <div className={`flex justify-between items-center pb-2 border-b ${
                                isLight ? 'border-slate-200/60' : 'border-white/5'
                            }`}>
                                <h3 className={`text-sm font-black uppercase italic flex items-center gap-2 ${
                                    isLight ? 'text-slate-900' : 'text-white'
                                }`}>
                                    <Plus size={16} className="text-orange-400" /> Agregar Mozo
                                </h3>
                                <button 
                                    onClick={() => {
                                        setShowAddWaiterModal(false);
                                        setNewWaiterName('');
                                    }} 
                                    className={`p-2 rounded-xl transition-all border ${
                                        isLight 
                                            ? 'text-slate-400 hover:text-slate-700 bg-slate-50 border-slate-200' 
                                            : 'text-slate-500 hover:text-slate-300 bg-slate-900 border-slate-800'
                                    }`}
                                >
                                    <X size={14} />
                                </button>
                            </div>
                            
                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className={`text-[9px] font-black uppercase tracking-wider ${
                                        isLight ? 'text-slate-500' : 'text-slate-400'
                                    }`}>Nombre del Mozo</label>
                                    <input
                                        type="text"
                                        placeholder="Ej: Juan Silva"
                                        value={newWaiterName}
                                        onChange={(e) => setNewWaiterName(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleAddWaiter(newWaiterName);
                                        }}
                                        className={`w-full px-4 py-3 rounded-2xl font-medium text-sm focus:outline-none focus:border-orange-500/50 transition-colors ${
                                            isLight 
                                                ? 'bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400' 
                                                : 'bg-slate-900 border border-slate-800 text-white placeholder-slate-700'
                                        }`}
                                        autoFocus
                                    />
                                </div>
                            </div>
                            
                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        setShowAddWaiterModal(false);
                                        setNewWaiterName('');
                                    }}
                                    className={`flex-1 py-3 px-4 font-black rounded-2xl text-[9px] uppercase tracking-wider transition-all duration-200 active:scale-95 border ${
                                        isLight 
                                            ? 'bg-slate-100 hover:bg-slate-250 border-slate-200 text-slate-650' 
                                            : 'bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400'
                                    }`}
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={() => handleAddWaiter(newWaiterName)}
                                    disabled={!newWaiterName.trim()}
                                    className="flex-1 py-3 px-4 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:hover:bg-orange-500 text-white font-black rounded-2xl text-[9px] uppercase tracking-wider transition-all duration-200 active:scale-95 shadow-lg shadow-orange-500/10"
                                >
                                    Crear Perfil
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-4xl mx-auto px-1 pb-16">
            
            {/* Cabecera / Controles rápidos */}
            <div className={`relative overflow-hidden p-5 rounded-[2.5rem] border shadow-2xl transition-all duration-300 ${
                isLight 
                    ? 'bg-white border-slate-200/80 shadow-sm' 
                    : 'glass border-white/5 bg-slate-950/40 backdrop-blur-xl'
            }`}>
                <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full filter blur-2xl pointer-events-none" />
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                    <div className="flex items-center gap-3">
                        {activeWaiterObj ? (
                            <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${activeWaiterObj.color || 'from-orange-500 to-rose-500'} flex items-center justify-center text-white font-black text-xl shadow-lg border border-white/10 shrink-0`}>
                                {activeWaiterObj.name.charAt(0).toUpperCase()}
                            </div>
                        ) : (
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-rose-600 flex items-center justify-center text-white font-black text-xl shadow-lg border border-white/10 shrink-0">
                                {activeWaiter.charAt(0).toUpperCase()}
                            </div>
                        )}
                        <div>
                            <h2 className={`text-2xl font-black uppercase italic tracking-wider flex items-center gap-2 transition-colors ${
                                isLight ? 'text-slate-900' : 'text-white'
                            }`}>
                                <span>Portal de Mozos</span>
                                <Sparkles size={18} className="text-yellow-400 animate-pulse" />
                            </h2>
                            <p className={`text-[9px] font-black uppercase tracking-widest mt-1 ${
                                isLight ? 'text-slate-500' : 'text-slate-400'
                            }`}>
                                Local: <span style={{ color: primaryColor }}>{tenant?.name || 'MyMapps'}</span> • Atendido por <span className={isLight ? 'text-slate-900 font-extrabold' : 'text-white font-extrabold'}>{activeWaiter}</span>
                            </p>
                            {tenant?.description && (
                                <p className={`text-[8.5px] font-medium italic mt-1 leading-normal max-w-sm ${
                                    isLight ? 'text-slate-400 font-semibold' : 'text-slate-500'
                                }`}>
                                    💡 "{tenant.description.length > 80 ? `${tenant.description.substring(0, 80)}...` : tenant.description}"
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                        <button
                            onClick={() => {
                                  setActiveWaiter(null);
                                if (tenant?.id) {
                                    localStorage.removeItem(`active_waiter_name_${tenant.id}`);
                                }
                            }}
                            className={`px-3 py-2.5 rounded-xl transition-all duration-200 active:scale-95 flex items-center gap-1 text-[9px] font-black uppercase tracking-wider border ${
                                isLight 
                                    ? 'bg-slate-100 hover:bg-red-50 hover:border-red-200 hover:text-red-650 text-slate-650 border-slate-200' 
                                    : 'bg-slate-900/60 border-slate-800 hover:bg-red-950/40 hover:border-red-500/20 hover:text-red-400 text-slate-400'
                            }`}
                        >
                            <LogOut size={12} />
                            <span>Cambiar Mozo</span>
                        </button>
                        <button
                            onClick={() => setSoundEnabled(!soundEnabled)}
                            className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all duration-300 flex items-center gap-1.5 ${
                                soundEnabled 
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]' 
                                    : (isLight 
                                        ? 'bg-slate-100 text-slate-500 border border-slate-200' 
                                        : 'bg-slate-900 text-slate-500 border border-slate-800')
                            }`}
                        >
                            <span className={`w-1.5 h-1.5 rounded-full ${soundEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                            {soundEnabled ? 'Alertas: Audio Activo' : 'Alertas: Silenciadas'}
                        </button>
                        <button
                            onClick={async () => {
                                await refetchData();
                                await fetchItemsToServe();
                            }}
                            disabled={loading}
                            className={`p-2 rounded-xl transition-all duration-200 active:scale-95 flex items-center justify-center border ${
                                isLight 
                                    ? 'bg-slate-105 border-slate-200 hover:bg-slate-200 text-slate-600' 
                                    : 'bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400'
                            }`}
                        >
                            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Selector de Pestañas Operativas del Mozo (Mis Mesas / Salón Completo / Centro de Alertas) */}
            <div className={`flex p-1.5 rounded-[2rem] border shadow-xl w-full transition-all ${
                isLight ? 'bg-slate-100 border-slate-200/80' : 'bg-slate-950/80 border-slate-900 backdrop-blur-xl'
            }`}>
                <button
                    onClick={() => setActiveSubTab('my-tables')}
                    className={`flex-1 py-3 px-2.5 rounded-[1.6rem] text-[10px] font-black uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 ${
                        activeSubTab === 'my-tables'
                            ? 'text-white shadow-lg shadow-black/40 font-black'
                            : (isLight ? 'text-slate-500 hover:text-slate-850' : 'text-slate-500 hover:text-slate-350')
                    }`}
                    style={activeSubTab === 'my-tables' ? { backgroundColor: primaryColor } : {}}
                >
                    <User size={14} />
                    <span>Mis Mesas</span>
                    {myTablesWithReadyItems > 0 && (
                        <span className="w-5 h-5 rounded-full bg-white text-slate-900 flex items-center justify-center text-[8px] font-black animate-bounce shadow">
                            {myTablesWithReadyItems}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setActiveSubTab('all-tables')}
                    className={`flex-1 py-3 px-2.5 rounded-[1.6rem] text-[10px] font-black uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 ${
                        activeSubTab === 'all-tables'
                            ? 'text-white shadow-lg shadow-black/40 font-black'
                            : (isLight ? 'text-slate-500 hover:text-slate-850' : 'text-slate-500 hover:text-slate-350')
                    }`}
                    style={activeSubTab === 'all-tables' ? { backgroundColor: primaryColor } : {}}
                >
                    <Layers size={14} />
                    <span>Salón Completo</span>
                    <span className={`text-[8px] px-1.5 py-0.5 rounded-md font-bold border ${
                        isLight ? 'bg-slate-200 border-slate-300 text-slate-600' : 'bg-slate-900 text-slate-500 border-slate-800'
                    }`}>
                        {tablesList.length}
                    </span>
                </button>
                <button
                    onClick={() => setActiveSubTab('alerts')}
                    className={`flex-1 py-3 px-2.5 rounded-[1.6rem] text-[10px] font-black uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 relative ${
                        activeSubTab === 'alerts'
                            ? 'text-white shadow-lg shadow-black/40 font-black'
                            : (isLight ? 'text-slate-500 hover:text-slate-850' : 'text-slate-500 hover:text-slate-350')
                    }`}
                    style={activeSubTab === 'alerts' ? { backgroundColor: primaryColor } : {}}
                >
                    <Bell size={14} />
                    <span>Alertas</span>
                    {activeAlertsCount > 0 && (
                        <span className="w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center text-[8px] font-black animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]">
                            {activeAlertsCount}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setActiveSubTab('reservations')}
                    className={`flex-1 py-3 px-2.5 rounded-[1.6rem] text-[10px] uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 ${
                        isAnyReservationWithinOneHour ? 'animate-pulse' : ''
                    } ${
                        activeSubTab === 'reservations'
                            ? 'text-white shadow-lg shadow-black/40 font-black'
                            : (isLight ? 'text-slate-500 font-black hover:text-slate-850' : 'text-slate-500 font-black hover:text-slate-350')
                    }`}
                    style={activeSubTab === 'reservations' ? { backgroundColor: primaryColor } : {}}
                >
                    📅
                    <span>Reservas</span>
                    {reservations.filter(r => r.status === 'confirmed').length > 0 && (
                        <span className={`text-[7.5px] px-1.5 py-0.5 rounded font-bold border ${
                            isLight ? 'bg-orange-100 border-orange-200 text-orange-700' : 'bg-orange-500 text-slate-950 border-orange-400/25'
                        }`}>
                            {reservations.filter(r => r.status === 'confirmed').length}
                        </span>
                    )}
                </button>
            </div>

            {/* VISTA 1: MIS MESAS ASIGNADAS */}
            {activeSubTab === 'my-tables' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="flex justify-between items-center px-2">
                        <div>
                            <h3 className={`text-xs font-black uppercase tracking-widest flex items-center gap-1.5 ${
                                isLight ? 'text-slate-650' : 'text-slate-400'
                            }`}>
                                <User size={13} style={{ color: primaryColor }} /> Tu Sector Asignado
                            </h3>
                            <p className={`text-[8px] font-black uppercase mt-0.5 ${isLight ? 'text-slate-450' : 'text-slate-650'}`}>Mesas bajo tu responsabilidad directa</p>
                        </div>
                        <span className={`text-[8px] font-black uppercase border px-3 py-1 rounded-full ${
                            isLight ? 'bg-slate-100 border-slate-200 text-slate-600' : 'bg-slate-900 border-slate-800 text-slate-400'
                        }`}>
                            {myTables.length} mesas en tu lista
                        </span>
                    </div>

                    {myTables.length === 0 ? (
                        <div className={`py-16 px-6 text-center rounded-[2.5rem] p-8 border max-w-xl mx-auto transition-colors ${
                            isLight ? 'bg-white border-slate-200 shadow-sm' : 'glass border-white/5'
                        }`}>
                            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 border shadow-inner ${
                                isLight ? 'bg-slate-100 border-slate-200 text-slate-500' : 'bg-slate-900/60 border-white/5'
                            }`}>
                                <HelpCircle size={28} className="text-slate-500" />
                            </div>
                            <h4 className={`font-black uppercase tracking-widest text-[11px] mb-1 ${
                                isLight ? 'text-slate-900' : 'text-white'
                            }`}>Sin Mesas Asignadas</h4>
                            <p className="text-slate-500 text-[10px] leading-relaxed mb-6">Aún no has seleccionado qué mesas vas a atender hoy. Ve a la pestaña **Salón Completo** para configurar tu sector de trabajo.</p>
                            <button
                                onClick={() => setActiveSubTab('all-tables')}
                                className={`px-5 py-2.5 text-[9px] font-black text-white uppercase tracking-wider rounded-xl transition-all duration-300 hover:scale-105 active:scale-95 shadow-lg border ${
                                    isLight ? 'border-orange-400' : 'border-white/5 shadow-orange-500/10'
                                }`}
                                style={{ backgroundColor: primaryColor }}
                            >
                                Asignar Mesas del Salón
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {tablesList
                                .filter(table => myTables.includes(table.id))
                                .map(table => {
                                    const status = getTableStatus(table.id);
                                    const tableOrders = getTableOrders(table.id);
                                    const readyItemsCount = tableOrders.reduce((sum, g) => 
                                        sum + g.items.filter(i => i.status === 'delivered' && !i.is_served).length, 0
                                    );
                                    const allItems = tableOrders.flatMap(g => g.items);
                                    const hasPendingItems = allItems.some(i => !i.is_served);

                                    return (
                                        <div
                                            key={table.id}
                                            onClick={() => setSelectedTable(table)}
                                            className={`relative rounded-[2.5rem] p-6 flex flex-col justify-between border cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 shadow-2xl group select-none min-h-[260px] w-full ${
                                                isLight 
                                                    ? (status === 'calling'
                                                        ? 'bg-gradient-to-br from-red-50 via-red-50/50 to-white border-red-300 shadow-[0_0_20px_rgba(239,68,68,0.15)] animate-pulse text-slate-900'
                                                        : status === 'ready'
                                                            ? 'bg-gradient-to-br from-red-100/50 via-red-55 to-white border-red-450 shadow-[0_0_22px_rgba(239,68,68,0.22)] animate-pulse text-slate-900'
                                                            : status === 'occupied' || status === 'occupied_empty'
                                                                ? 'bg-white border-blue-200 hover:border-blue-400 shadow-sm text-slate-900'
                                                                : 'bg-white border-slate-200/60 hover:border-slate-350 shadow-sm text-slate-900')
                                                    : (status === 'calling'
                                                        ? 'bg-gradient-to-br from-red-950/80 via-red-900/30 to-slate-950/90 border-red-500/50 shadow-[0_0_25px_rgba(239,68,68,0.3)] animate-pulse text-white bg-slate-950/60 backdrop-blur-xl'
                                                        : status === 'ready'
                                                            ? 'bg-gradient-to-br from-red-950/90 via-red-900/40 to-slate-950/95 border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.45)] animate-pulse text-white bg-slate-950/60 backdrop-blur-xl'
                                                            : status === 'occupied' || status === 'occupied_empty'
                                                                ? 'bg-gradient-to-br from-slate-900/90 via-slate-900/60 to-slate-950/95 border-blue-500/30 hover:border-blue-500/60 shadow-[0_4px_20px_rgba(0,0,0,0.3)] text-white bg-slate-950/60 backdrop-blur-xl'
                                                                : 'bg-slate-950/30 border-white/5 opacity-80 hover:opacity-100 hover:border-white/15 shadow-[0_4px_15px_rgba(0,0,0,0.2)] text-white bg-slate-950/60 backdrop-blur-xl')
                                            }`}
                                        >
                                            {/* Tag Superior y LED */}
                                            <div className="flex justify-between items-center">
                                                <span className={`text-[8px] font-black uppercase px-2.5 py-1 rounded-lg border ${
                                                    isLight 
                                                        ? 'text-slate-500 bg-slate-100 border-slate-200' 
                                                        : 'text-slate-400 bg-slate-950/95 border-slate-900'
                                                }`}>
                                                    {table.description?.split(' ')[0] || 'Mesa'}
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    {hasPendingItems ? (
                                                        <div className="flex items-center gap-1 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-lg shrink-0">
                                                            <span className="relative flex h-2 w-2">
                                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.9)]"></span>
                                                            </span>
                                                            <span className="text-[7px] font-black uppercase text-red-400 tracking-wider">Ocupada</span>
                                                        </div>
                                                    ) : table.is_occupied ? (
                                                        <div className="flex items-center gap-1 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded-lg shrink-0">
                                                            <span className="relative flex h-2 w-2">
                                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.9)]"></span>
                                                            </span>
                                                            <span className="text-[7px] font-black uppercase text-orange-400 tracking-wider">Ocupada</span>
                                                        </div>
                                                    ) : (
                                                        <div className={`flex items-center gap-1 border px-2 py-0.5 rounded-lg shrink-0 ${
                                                            isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/80 border-slate-800'
                                                        }`}>
                                                            <span className={`w-1.5 h-1.5 rounded-full ${isLight ? 'bg-slate-400' : 'bg-slate-650'}`} />
                                                            <span className="text-[7px] font-black uppercase text-slate-500 tracking-wider">Libre</span>
                                                        </div>
                                                    )}
                                                    <span className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_6px_rgba(249,115,22,0.8)]" title="Tu mesa" />
                                                </div>
                                            </div>

                                            {/* Centro / Nombre de Mesa */}
                                            <div className="text-center py-3">
                                                <h3 className={`text-3xl font-black italic transition-colors leading-none ${
                                                    status === 'calling' 
                                                        ? 'text-red-500' 
                                                        : status === 'ready' 
                                                            ? 'text-red-500' 
                                                            : (isLight ? 'text-slate-900' : 'text-white')
                                                }`}>
                                                    {table.name}
                                                </h3>
                                                <p className={`text-[8px] font-bold uppercase mt-1 tracking-wider truncate max-w-[130px] mx-auto ${
                                                    isLight ? 'text-slate-455' : 'text-slate-400'
                                                }`}>
                                                    {table.description || 'Sin Sector'}
                                                </p>
                                            </div>

                                            {/* COMANDA INLINE (CHECKLIST) EN ESPAÑOL */}
                                            {allItems.length > 0 && hasPendingItems && (
                                                <div className={`mt-2 mb-4 space-y-2 border-t pt-3 flex-1 flex flex-col justify-start ${
                                                    isLight ? 'border-slate-205' : 'border-slate-900/60'
                                                }`}>
                                                    <p className="text-[7.5px] font-black uppercase text-slate-500 tracking-widest pl-1">
                                                        📋 Comanda Activa:
                                                    </p>
                                                    <div className="max-h-[140px] overflow-y-auto pr-1 space-y-1.5 custom-scrollbar">
                                                        {allItems.map(item => {
                                                            const isReady = item.status === 'delivered';
                                                            const isServed = item.is_served;

                                                            return (
                                                                <div
                                                                    key={item.id}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation(); // Prevenir que abra el modal general al hacer clic
                                                                        if (isReady && !isServed) {
                                                                            handleServeItem(item.id);
                                                                        }
                                                                    }}
                                                                    className={`flex items-center justify-between p-2 rounded-xl border transition-all duration-300 text-[10px] ${
                                                                        isServed
                                                                            ? (isLight 
                                                                                ? 'bg-emerald-50 border-emerald-100 text-emerald-700 line-through opacity-70 cursor-default' 
                                                                                : 'bg-emerald-950/20 border-emerald-900/20 text-emerald-400/50 line-through opacity-70 cursor-default')
                                                                            : isReady
                                                                                ? (isLight 
                                                                                    ? 'bg-red-50 border-red-200 text-red-750 font-extrabold hover:bg-red-100/50 shadow-sm active:scale-[0.98] cursor-pointer' 
                                                                                    : 'bg-red-500/10 border-red-500/35 text-red-200 font-extrabold hover:bg-red-500/15 shadow-[0_0_10px_rgba(239,68,68,0.15)] active:scale-[0.98] cursor-pointer')
                                                                                : (isLight 
                                                                                    ? 'bg-slate-50 border-slate-150 text-slate-500 cursor-not-allowed opacity-90' 
                                                                                    : 'bg-slate-900/40 border-slate-900/60 text-slate-500 cursor-not-allowed opacity-90')
                                                                    }`}
                                                                >
                                                                    <div className="flex flex-col min-w-0 flex-1 pr-2">
                                                                        <span className="font-extrabold truncate uppercase tracking-wide">
                                                                            {item.quantity}x {item.product?.name || 'Producto'}
                                                                        </span>
                                                                        {item.notes && (
                                                                            <span className="text-[7.5px] font-black text-amber-500 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-md mt-0.5 self-start tracking-wider truncate max-w-[150px] uppercase">
                                                                                ⚠️ NOTA: {item.notes}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    
                                                                    <div className="flex items-center gap-1 shrink-0">
                                                                        {isServed ? (
                                                                            <span className="text-[7.5px] font-black uppercase text-emerald-400/80 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.25 rounded">
                                                                                Listo
                                                                            </span>
                                                                        ) : isReady ? (
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    handleServeItem(item.id);
                                                                                }}
                                                                                className="bg-red-500 hover:bg-red-600 text-white text-[7.5px] font-black uppercase px-2 py-0.5 rounded-md shadow-md shadow-red-500/20 transition-all active:scale-90 flex items-center gap-0.5"
                                                                            >
                                                                                <Check size={8} className="stroke-[3]" /> Entregar
                                                                            </button>
                                                                        ) : (
                                                                            <span className={`text-[7.5px] font-black uppercase px-1.5 py-0.25 rounded flex items-center gap-0.5 animate-pulse border ${
                                                                                isLight 
                                                                                    ? 'text-slate-500 bg-slate-100 border-slate-200' 
                                                                                    : 'text-slate-400 bg-slate-950 border border-slate-900'
                                                                            }`}>
                                                                                <Clock size={8} /> Cocinando
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                                                                                {/* Pie / Estado Operativo General */}
                                            <div className="flex flex-col items-center gap-2 mt-auto z-20">
                                                <div className="flex justify-center w-full">
                                                    {status === 'calling' ? (
                                                        <span className="text-[7.5px] font-black uppercase tracking-wider bg-red-500 text-slate-950 px-3 py-1 rounded-lg animate-bounce flex items-center gap-1 font-sans shadow-lg shadow-red-500/20">
                                                            🚨 LLAMADO
                                                        </span>
                                                    ) : status === 'ready' ? (
                                                        <span className="text-[7.5px] font-black uppercase tracking-wider bg-red-600 text-white border border-red-500 px-3 py-1 rounded-lg flex items-center gap-1 shadow-[0_0_12px_rgba(239,68,68,0.4)] animate-pulse">
                                                            🍳 ¡PLATOS LISTOS! ({readyItemsCount})
                                                        </span>
                                                    ) : status === 'served' ? (
                                                        <span className="text-[7.5px] font-black uppercase tracking-wider bg-purple-500/10 border border-purple-500/20 text-purple-400 px-3 py-1 rounded-lg flex items-center gap-1">
                                                            🍽️ COMIENDO
                                                        </span>
                                                    ) : status === 'occupied' ? (
                                                        <span className="text-[7.5px] font-black uppercase tracking-wider bg-blue-500/10 border border-blue-500/20 text-blue-400 px-3 py-1 rounded-lg flex items-center gap-1">
                                                            <Clock size={9} className="animate-spin shrink-0 text-blue-400" /> COCINANDO
                                                        </span>
                                                    ) : table.is_occupied ? (
                                                        <span className="text-[7.5px] font-black uppercase tracking-wider bg-orange-500/10 border border-orange-500/20 text-orange-400 px-3 py-1 rounded-lg flex items-center gap-1">
                                                            📱 MESA OCUPADA
                                                        </span>
                                                    ) : (
                                                        <span className={`text-[7.5px] font-black uppercase tracking-wider px-3 py-1 rounded-lg border ${
                                                            isLight ? 'bg-slate-100 border-slate-200 text-slate-550' : 'bg-slate-900 border border-slate-800 text-slate-500'
                                                        }`}>
                                                            DISPONIBLE
                                                        </span>
                                                    )}
                                                </div>
                                                {table.is_occupied && (
                                                    <button
                                                        onClick={async (e) => {
                                                            e.stopPropagation();
                                                            await handleFreeTable(table.id);
                                                        }}
                                                        className={`text-[7px] font-black uppercase tracking-wider px-3 py-1.5 rounded-xl flex items-center gap-1 active:scale-95 transition-all w-full justify-center shadow-sm border ${
                                                            isLight 
                                                                ? 'bg-red-50 border-red-200 hover:bg-red-500 hover:text-white text-red-650' 
                                                                : 'bg-red-500/15 border border-red-500/30 hover:bg-red-500 hover:text-white text-red-400'
                                                        }`}
                                                    >
                                                        🚫 Desocupar Mesa
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>
                    )}
                </div>
            )}

            {/* VISTA 2: SALÓN COMPLETO (TODAS LAS MESAS Y ASIGNACIÓN) */}
            {activeSubTab === 'all-tables' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="flex justify-between items-center px-2">
                        <div>
                            <h3 className={`text-xs font-black uppercase tracking-widest flex items-center gap-1.5 ${
                                isLight ? 'text-slate-650' : 'text-slate-400'
                            }`}>
                                <Layers size={13} className="text-blue-400" /> Salón Completo y Sectores
                            </h3>
                            <p className={`text-[8px] font-black uppercase mt-0.5 ${isLight ? 'text-slate-450' : 'text-slate-650'}`}>Control global de todas las mesas del restaurante</p>
                        </div>
                        <span className={`text-[8px] font-black uppercase border px-3 py-1 rounded-full ${
                            isLight ? 'bg-slate-100 border-slate-200 text-slate-600' : 'bg-slate-900 border-slate-800 text-slate-400'
                        }`}>
                            Mapa de {tablesList.length} mesas
                        </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {tablesList.map(table => {
                            const status = getTableStatus(table.id);
                            const isAssigned = myTables.includes(table.id);
                            const isAssignedToOther = table.waiter_name && activeWaiter ? table.waiter_name.toLowerCase().trim() !== activeWaiter.toLowerCase().trim() : false;
                            const tableOrders = getTableOrders(table.id);
                            const readyItemsCount = tableOrders.reduce((sum, g) => 
                                sum + g.items.filter(i => i.status === 'delivered' && !i.is_served).length, 0
                            );

                            return (
                                <div
                                    key={table.id}
                                    className={`relative aspect-square rounded-[2rem] p-5 flex flex-col justify-between border transition-all duration-300 shadow-md group select-none ${
                                        isAssigned 
                                            ? (isLight ? 'bg-orange-50/40 border-orange-400 ring-1 ring-orange-400/20 text-slate-900' : 'bg-slate-900/60 border-orange-500/25 ring-1 ring-orange-500/10 text-white') 
                                            : table.is_occupied
                                                ? (isLight ? 'bg-white border-orange-200 shadow-sm text-slate-900' : 'bg-slate-900/40 border-orange-500/20 shadow-[0_0_15px_rgba(249,115,22,0.05)] ring-1 ring-orange-500/10 text-white')
                                                : isAssignedToOther
                                                    ? (isLight ? 'bg-slate-100 border-slate-200 opacity-40 text-slate-550' : 'bg-slate-950/10 border-slate-900/40 opacity-40 text-white')
                                                    : (isLight ? 'bg-white border-slate-200 hover:border-slate-350 shadow-sm text-slate-900' : 'bg-slate-950/20 border-white/5 opacity-70 hover:opacity-100 hover:border-white/10 text-white')
                                    }`}
                                >
                                    {/* Cabecera / Controles de Auto-asignación */}
                                    <div className="flex justify-between items-start gap-1">
                                        <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md truncate max-w-[70px] border ${
                                            isLight 
                                                ? 'text-slate-550 bg-slate-100 border-slate-200' 
                                                : 'text-slate-600 bg-slate-950 border border-slate-900/80'
                                        }`}>
                                            {table.description?.split(' ')[0] || 'Mesa'}
                                        </span>
                                        {table.is_occupied && !getTableOrders(table.id).length ? (
                                            <span className="px-2 py-0.5 rounded text-[6.5px] font-black uppercase tracking-wider bg-orange-500/20 text-orange-400 border border-orange-500/30 flex items-center gap-0.5 animate-pulse shrink-0">
                                                📱 QR
                                            </span>
                                        ) : !isAssignedToOther ? (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleTableAssignment(table.id);
                                                }}
                                                className={`px-2 py-0.5 rounded text-[7.5px] font-black uppercase tracking-wider transition-all duration-300 active:scale-90 shrink-0 border ${
                                                    isAssigned
                                                        ? (isLight ? 'bg-orange-100 text-orange-700 border-orange-300 font-extrabold' : 'bg-orange-500/15 text-orange-400 border border-orange-500/30')
                                                        : (isLight ? 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200' : 'bg-slate-900 hover:bg-slate-800 text-slate-500 hover:text-slate-300 border border-slate-800')
                                                }`}
                                            >
                                                {isAssigned ? 'Liberar' : 'Atender'}
                                            </button>
                                        ) : (
                                            <span className={`px-2 py-0.5 rounded text-[6.5px] font-black uppercase tracking-wider shrink-0 border ${
                                                isLight 
                                                    ? 'bg-slate-100 border-slate-200 text-slate-500' 
                                                    : 'bg-slate-950/80 text-slate-500 border border-slate-900'
                                            }`}>
                                                Ocupada
                                            </span>
                                        )}
                                    </div>

                                    {/* Número de Mesa clickeable para ver el detalle */}
                                    <div 
                                        onClick={() => {
                                            if (!isAssignedToOther) {
                                                setSelectedTable(table);
                                            }
                                        }}
                                        className={`text-center py-2 flex-1 flex flex-col justify-center ${!isAssignedToOther ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                                    >
                                        <h3 className={`text-2xl font-black italic transition-colors leading-none ${
                                            status === 'calling' && !isAssignedToOther 
                                                ? 'text-red-500 font-extrabold' 
                                                : status === 'ready' && !isAssignedToOther 
                                                    ? 'text-emerald-500 font-extrabold' 
                                                    : (isLight ? 'text-slate-900' : 'text-slate-100')
                                        }`}>
                                            {table.name}
                                        </h3>
                                        <p className={`text-[7px] font-bold uppercase mt-1 tracking-wider truncate max-w-[110px] mx-auto ${
                                            isLight ? 'text-slate-450' : 'text-slate-500'
                                        }`}>
                                            {table.description || 'Sin Sector'}
                                        </p>
                                    </div>

                                    {/* Pie de Mesa */}
                                    <div className="flex flex-col gap-1 items-center pt-1 w-full z-20">
                                        {isAssignedToOther ? (
                                            <span className={`text-[7.5px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg border truncate max-w-[110px] ${
                                                isLight 
                                                    ? 'bg-slate-100 border-slate-200 text-slate-500' 
                                                    : 'bg-slate-900 text-slate-400 border-white/5'
                                            }`}>
                                                👤 {table.waiter_name}
                                            </span>
                                        ) : status === 'calling' ? (
                                            <button
                                                onClick={async (e) => {
                                                    e.stopPropagation();
                                                    await autoResolveTableNotifications(table.id);
                                                }}
                                                className="text-[7px] font-black uppercase tracking-wider bg-red-500 hover:bg-red-600 text-white px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-md shadow-red-500/20 transition-all duration-200 active:scale-95 border border-red-400 animate-pulse cursor-pointer w-full justify-center"
                                                title="Marcar Asistencia como Atendida"
                                            >
                                                🚨 ATENDER LLAMADO
                                            </button>
                                        ) : status === 'ready' ? (
                                            <span className="text-[7px] font-black uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 px-2 py-0.5 rounded-lg flex items-center gap-1 shadow-[0_0_8px_rgba(16,185,129,0.1)] w-full justify-center">
                                                🍳 PLATOS LISTOS ({readyItemsCount})
                                            </span>
                                        ) : status === 'served' ? (
                                            <span className="text-[7px] font-black uppercase tracking-wider bg-purple-500/10 border border-purple-500/20 text-purple-400 px-2 py-0.5 rounded-lg flex items-center gap-1 shadow-[0_0_8px_rgba(168,85,247,0.1)] w-full justify-center">
                                                🍽️ COMIENDO
                                            </span>
                                        ) : status === 'occupied' ? (
                                            <span className="text-[7px] font-black uppercase tracking-wider bg-blue-500/5 border border-blue-500/10 text-blue-500/60 px-2 py-0.5 rounded-lg flex items-center gap-1 w-full justify-center">
                                                <Clock size={7} /> COCINANDO
                                            </span>
                                        ) : table.is_occupied ? (
                                            <span className="text-[7px] font-black uppercase tracking-wider bg-orange-500/10 border border-orange-500/20 text-orange-400 px-2 py-0.5 rounded-lg flex items-center gap-1 shadow-[0_0_8px_rgba(249,115,22,0.1)] w-full justify-center">
                                                🍽️ MESA OCUPADA
                                            </span>
                                        ) : (
                                            <span className={`text-[7px] font-black uppercase tracking-wider border px-2 py-0.5 rounded-lg w-full justify-center text-center ${
                                                isLight ? 'bg-slate-50 border-slate-200 text-slate-450' : 'bg-slate-950 border-slate-900 text-slate-600'
                                            }`}>
                                                LIBRE
                                            </span>
                                        )}
                                        {table.is_occupied && !isAssignedToOther && (
                                            <button
                                                onClick={async (e) => {
                                                    e.stopPropagation();
                                                    await handleFreeTable(table.id);
                                                }}
                                                className={`text-[6.5px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md mt-0.5 active:scale-95 transition-all w-full text-center border ${
                                                    isLight 
                                                        ? 'bg-red-50 border-red-200 hover:bg-red-500 hover:text-white text-red-650' 
                                                        : 'bg-red-500/15 border border-red-500/30 hover:bg-red-500 hover:text-white text-red-400'
                                                }`}
                                            >
                                                🚫 Desocupar
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* VISTA 3: CENTRO DE ALERTAS Y LLAMADOS */}
            {activeSubTab === 'alerts' && (
                <div className="space-y-4 animate-in fade-in duration-300">
                    <div className="flex justify-between items-center px-2">
                        <div>
                            <div className="flex items-center gap-2.5">
                                <h3 className={`text-xs font-black uppercase tracking-widest flex items-center gap-1.5 ${
                                    isLight ? 'text-slate-650' : 'text-slate-400'
                                }`}>
                                    <Bell size={13} style={{ color: primaryColor }} /> Centro de Alertas Recibidas
                                </h3>
                                {localNotifications.length > 0 && (
                                    <button
                                        onClick={async () => {
                                            if (confirm("¿Estás seguro de que deseas limpiar todas tus alertas?")) {
                                                const deletePromises = localNotifications.map(n => 
                                                    supabase.from('app_notifications').delete().eq('id', n.id)
                                                );
                                                await Promise.all(deletePromises);
                                                broadcastTenantChange(tenant.id);
                                                await refetchData();
                                            }
                                        }}
                                        className={`px-2.5 py-1 text-[8px] font-black uppercase tracking-wider rounded-xl transition-all duration-200 active:scale-95 border ${
                                            isLight 
                                                ? 'bg-red-50 hover:bg-red-100 border-red-200 text-red-650 shadow-sm' 
                                                : 'bg-red-500/10 border-red-500/20 hover:bg-red-500/20 text-red-400'
                                        }`}
                                    >
                                        Limpiar Alertas
                                    </button>
                                )}
                            </div>
                            <p className={`text-[8px] font-black uppercase mt-0.5 ${isLight ? 'text-slate-450' : 'text-slate-650'}`}>Historial de llamados en tiempo real</p>
                        </div>
                        {activeAlertsCount > 0 && (
                            <span className="text-[8px] font-black uppercase bg-red-500/10 border border-red-500/20 text-red-500 px-3 py-1 rounded-full animate-pulse">
                                {activeAlertsCount} Alertas Activas
                            </span>
                        )}
                    </div>

                    {localNotifications.length === 0 ? (
                        <div className={`py-16 text-center rounded-[2.5rem] p-8 border border-dashed max-w-xl mx-auto transition-colors ${
                            isLight ? 'bg-white border-slate-200 shadow-sm' : 'glass border-white/5'
                        }`}>
                            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 border shadow-inner ${
                                isLight ? 'bg-slate-100 border-slate-200 text-slate-500' : 'bg-slate-900/60 border-white/5'
                            }`}>
                                <CheckCircle2 size={28} className="text-slate-600" />
                            </div>
                            <h4 className={`font-black uppercase tracking-widest text-[11px] mb-1 ${
                                isLight ? 'text-slate-900' : 'text-white'
                            }`}>Sin Alertas</h4>
                            <p className="text-slate-500 text-[10px] leading-relaxed">No hay llamados de asistencia ni alertas operativas registradas en el salón.</p>
                        </div>
                    ) : (
                        <div className="grid gap-3 pr-1 max-w-2xl mx-auto">
                            {localNotifications.map((n) => {
                                const isUpdated = n.message.toLowerCase().includes('actualizado por');
                                const isAssistance = (n.message.toLowerCase().includes('asistencia') || n.message.toLowerCase().includes('llamado') || n.message.toLowerCase().includes('ayuda') || n.message.toLowerCase().includes('mozo')) && !isUpdated;
                                
                                // Verificar si la alerta corresponde a alguna de mis mesas
                                const isForMyTable = tablesList.some(t => {
                                    if (!myTables.includes(t.id)) return false;
                                    const name = t.name.toLowerCase();
                                    const translatedMessage = translateNotificationMessage(n.message);
                                    const msg = translatedMessage.toLowerCase();
                                    if (msg.includes(name)) return true;
                                    const numMatch = name.match(/\d+/);
                                    if (numMatch) {
                                        const num = numMatch[0];
                                        return msg.includes(`mesa ${num}`) || msg.includes(`mesa: ${num}`) || msg.includes(`mesa #${num}`);
                                    }
                                    return false;
                                });

                                return (
                                    <div 
                                        key={n.id} 
                                        className={`relative rounded-2xl p-4 flex justify-between items-center border shadow-sm overflow-hidden transition-all duration-300 animate-in slide-in-from-top-4 ${
                                            isAssistance
                                                ? isForMyTable
                                                    ? (isLight ? 'bg-gradient-to-r from-red-50 via-red-50/50 to-white border-red-200 text-slate-900' : 'bg-gradient-to-r from-red-950/80 via-red-900/10 to-slate-950/90 border-red-500/40 shadow-[0_0_15px_rgba(239,68,68,0.15)] ring-1 ring-red-500/20 text-white')
                                                    : (isLight ? 'bg-white border-slate-200/60 opacity-80 text-slate-900' : 'bg-slate-900/70 border-white/5 opacity-75 text-white')
                                                : isForMyTable
                                                    ? (isLight ? 'bg-gradient-to-r from-emerald-50 via-emerald-50/50 to-white border-emerald-250 text-slate-900' : 'bg-gradient-to-r from-emerald-950/50 via-slate-900/40 to-slate-950/90 border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/20 text-white')
                                                    : (isLight ? 'bg-white border-slate-200/60 opacity-80 text-slate-900' : 'bg-slate-900/60 border-white/5 opacity-75 text-white')
                                        }`}
                                    >
                                        <div className={`absolute top-0 left-0 w-1.5 h-full ${
                                            isAssistance 
                                                ? isForMyTable 
                                                    ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]' 
                                                    : 'bg-red-500/40' 
                                                : isForMyTable
                                                    ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]'
                                                    : 'bg-emerald-500/40'
                                        }`} />
                                        
                                        <div className="flex gap-3.5 items-center pl-2">
                                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                                                isAssistance ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'
                                            }`}>
                                                <Bell size={14} className={(isAssistance || isUpdated) && isForMyTable ? 'animate-bounce' : ''} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className={`font-black text-[10px] uppercase tracking-wider ${
                                                        isAssistance ? 'text-red-400' : 'text-emerald-400'
                                                    }`}>
                                                        {isAssistance ? '🚨 ASISTENCIA MESA' : '🍳 PEDIDO ACTUALIZADO'}
                                                    </p>
                                                    {isForMyTable && (
                                                        <span className="text-[7px] font-black uppercase bg-orange-500 text-slate-950 px-1.5 py-0.25 rounded">
                                                            TÚ
                                                        </span>
                                                    )}
                                                </div>
                                                <p className={`font-black text-xs mt-0.5 transition-colors ${isLight ? 'text-slate-900' : 'text-white'}`}>{translateNotificationMessage(n.message)}</p>
                                                <p className="text-[7.5px] text-slate-500 font-bold uppercase tracking-wider mt-1">
                                                    {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleResolveNotification(n.id)}
                                            className={`py-1.5 px-3 border hover:border-white/10 text-[9px] font-black uppercase tracking-wider rounded-xl transition-all duration-200 active:scale-95 shadow-md flex items-center justify-center pl-2 pr-2 ${
                                                isLight 
                                                    ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700 hover:text-slate-900' 
                                                    : 'bg-slate-950/80 hover:bg-slate-950 border-white/5 text-slate-300'
                                            }`}
                                        >
                                            OK
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* VISTA 4: RESERVAS DE HOY */}
            {activeSubTab === 'reservations' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="flex justify-between items-center px-2">
                        <div>
                            <h3 className={`text-xs font-black uppercase tracking-widest flex items-center gap-1.5 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                                📅 Reservas Confirmadas de Hoy
                            </h3>
                            <p className={`text-[8px] font-black uppercase mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-600'}`}>Listado de reservas vigentes para el servicio de hoy</p>
                        </div>
                        <span className={`text-[8px] font-black uppercase border px-3 py-1 rounded-full ${isLight ? 'bg-orange-50 border-orange-200 text-orange-600' : 'bg-orange-500/10 border-orange-500/20 text-orange-400'}`}>
                            {reservations.filter(r => r.status === 'confirmed').length} Activas
                        </span>
                    </div>

                    {isReservationsLoading ? (
                        <div className="py-12 text-center">
                            <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                            <p className="text-[9px] font-black uppercase text-slate-500">Cargando reservas...</p>
                        </div>
                    ) : reservations.filter(r => r.status === 'confirmed').length === 0 ? (
                        <div className={`py-16 text-center rounded-[2.5rem] p-8 border border-dashed max-w-xl mx-auto ${isLight ? 'bg-white border-slate-200 shadow-sm text-slate-800' : 'glass border-white/5'}`}>
                            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 border shadow-inner ${isLight ? 'bg-slate-100 border-slate-200/60' : 'bg-slate-900/60 border-white/5'}`}>
                                📅
                            </div>
                            <h4 className={`font-black uppercase tracking-widest text-[11px] mb-1 ${isLight ? 'text-slate-900' : 'text-white'}`}>Sin Reservas para Hoy</h4>
                            <p className={`text-[10px] leading-relaxed ${isLight ? 'text-slate-550' : 'text-slate-500'}`}>No hay reservas confirmadas para la fecha actual.</p>
                        </div>
                    ) : (
                        <div className="grid gap-3 pr-1 max-w-2xl mx-auto">
                            {reservations.filter(r => r.status === 'confirmed').map((r) => (
                                <div 
                                    key={r.id} 
                                    className={`relative rounded-2xl p-4 flex justify-between items-center border shadow-lg overflow-hidden ${isLight ? 'border-slate-200/60 bg-white shadow-slate-100/50 shadow-sm' : 'border-white/5 bg-slate-900/60 shadow-lg'}`}
                                >
                                    <div className="flex gap-3.5 items-center pl-2">
                                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-sans text-xs ${isLight ? 'bg-orange-50 text-orange-600' : 'bg-orange-500/10 text-orange-400'}`}>
                                            👥
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className={`font-black text-[10px] uppercase tracking-wider ${isLight ? 'text-orange-600 font-extrabold' : 'text-orange-400'}`}>
                                                    {r.client_name}
                                                </p>
                                                {r.deposit_amount > 0 && (
                                                    <span className="text-[7px] font-black uppercase bg-emerald-500 text-slate-950 px-1.5 py-0.25 rounded">
                                                        Seña: ${r.deposit_amount}
                                                    </span>
                                                )}
                                            </div>
                                            <p className={`font-black text-xs mt-0.5 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                                {r.party_size} personas - {r.reservation_time.substring(0, 5)} hs
                                            </p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <p className={`text-[7.5px] font-bold uppercase tracking-wider ${isLight ? 'text-slate-550' : 'text-slate-500'}`}>
                                                    Código: <span className={`font-black ${isLight ? 'text-slate-800' : 'text-slate-300'}`}>{r.reservation_code || 'N/A'}</span>
                                                </p>
                                                <span className={`text-[8px] ${isLight ? 'text-slate-300' : 'text-slate-650'}`}>•</span>
                                                <p className={`text-[7.5px] font-bold uppercase tracking-wider ${isLight ? 'text-slate-550' : 'text-slate-500'}`}>
                                                    Tel: <span className={isLight ? 'text-slate-700 font-extrabold' : 'text-slate-300'}>{r.client_phone}</span>
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleCompleteReservation(r.id)}
                                        className={`py-1.5 px-3 bg-emerald-500 hover:bg-emerald-600 text-[9px] font-black uppercase tracking-wider rounded-xl text-slate-950 transition-all duration-200 active:scale-95 shadow-md flex items-center justify-center font-sans font-black ${isLight ? 'shadow-emerald-100' : ''}`}
                                    >
                                        Sentar Comensal
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* DETALLE GENERAL DE COMANDAS COMPLETADAS (Opcional, abajo) */}
            <div className={`mt-8 pt-6 border-t ${isLight ? 'border-slate-200' : 'border-slate-900'}`}>
                <div className={`rounded-3xl p-5 flex flex-col md:flex-row justify-between items-center gap-4 border ${isLight ? 'bg-slate-100/70 border-slate-200/80 shadow-sm' : 'bg-slate-950/40 border-white/5'}`}>
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isLight ? 'bg-white text-slate-500 shadow-sm' : 'bg-slate-900 text-slate-400'}`}>
                            <Clock size={18} />
                        </div>
                        <div>
                            <h4 className={`font-black text-xs uppercase tracking-wider ${isLight ? 'text-slate-800' : 'text-white'}`}>¿Necesitas soporte técnico?</h4>
                            <p className={`text-[9px] font-bold uppercase mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>El sistema sincroniza automáticamente los pedidos en tiempo real con Supabase Realtime.</p>
                        </div>
                    </div>
                    <button
                        onClick={async () => {
                            setLoading(true);
                            await refetchData();
                            await fetchItemsToServe();
                            setLoading(false);
                        }}
                        className={`px-4 py-2 border font-black rounded-xl text-[9px] uppercase tracking-wider transition-all ${isLight ? 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-800 shadow-sm' : 'border-slate-800 hover:border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-300'}`}
                    >
                        Sincronizar Manual
                    </button>
                </div>
            </div>

            {/* MODAL GLASSMORPHIC: DETALLE DE LA MESA / COMANDERA MÓVIL TÁCTIL */}
            {selectedTable && (() => {
                const tableName = translateTableIdToName(selectedTable.id);
                const status = getTableStatus(selectedTable.id);
                const isAssigned = myTables.includes(selectedTable.id);
                const tableOrders = getTableOrders(selectedTable.id);
                const hasReadyToServe = tableOrders.some(g => g.items.some(i => i.status === 'delivered' && !i.is_served));

                return (
                    <div className="fixed inset-0 z-[250] flex items-center justify-center px-4 bg-black/85 backdrop-blur-md animate-in fade-in">
                        <div className={`w-full ${isTakingOrder ? 'max-w-2xl max-h-[92vh]' : 'max-w-lg max-h-[85vh]'} rounded-[2.5rem] p-6 space-y-6 shadow-2xl border flex flex-col ${isLight ? 'bg-white border-slate-200 text-slate-900 shadow-slate-200/50' : 'bg-slate-950/90 border-white/10 text-white'} transition-all duration-300 animate-in zoom-in-95`}>
                            
                            {/* Cabecera del Modal */}
                            <div className={`flex justify-between items-start pb-4 border-b ${isLight ? 'border-slate-100' : 'border-white/5'}`}>
                                {isTakingOrder ? (
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => {
                                                setIsTakingOrder(false);
                                                setCart({});
                                                setCartNotes({});
                                            }}
                                            className={`p-2.5 rounded-xl transition-all flex items-center gap-1 text-[10px] font-black uppercase tracking-wider active:scale-95 shrink-0 border ${isLight ? 'text-slate-650 hover:text-slate-800 hover:bg-slate-50 border-slate-200 bg-white shadow-sm' : 'text-slate-50 hover:text-slate-300 bg-slate-900 border-slate-800'}`}
                                        >
                                            <ChevronLeft size={14} /> Volver
                                        </button>
                                        <div>
                                            <h3 className={`text-xl font-black italic flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                                <span>Tomar Pedido</span>
                                                <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase border ${isLight ? 'bg-orange-50 text-orange-600 border-orange-200' : 'bg-orange-500/10 text-orange-400 border-orange-500/20'}`}>{tableName}</span>
                                            </h3>
                                            <p className={`text-[8px] font-black uppercase tracking-wider ${isLight ? 'text-slate-450' : 'text-slate-500'}`}>
                                                Selecciona productos para armar la comanda
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xs text-white shadow-xl shadow-black/20" 
                                            style={{ backgroundColor: status === 'calling' ? '#ef4444' : status === 'ready' ? '#10b981' : status === 'occupied' ? '#3b82f6' : '#64748b' }}
                                        >
                                            {tableName.slice(0, 4)}
                                        </div>
                                        <div>
                                            <h3 className={`text-xl font-black italic flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                                {tableName}
                                            </h3>
                                            <p className={`text-[8px] font-black uppercase tracking-wider ${isLight ? 'text-slate-450' : 'text-slate-500'}`}>
                                                {selectedTable.description || 'Sin Sector Configurado'}
                                            </p>
                                        </div>
                                    </div>
                                )}
                                <button 
                                    onClick={() => {
                                        setSelectedTable(null);
                                        setIsTakingOrder(false);
                                        setCart({});
                                        setCartNotes({});
                                    }} 
                                    className={`p-2 rounded-xl transition-all shrink-0 border ${isLight ? 'text-slate-500 hover:text-slate-800 bg-slate-50 border-slate-200' : 'text-slate-500 hover:text-slate-300 bg-slate-900 border-slate-800'}`}
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            {/* Alerta de Llamado Activo */}
                            {status === 'calling' && (
                                <div className={`rounded-2xl p-3.5 flex justify-between items-center gap-3 animate-pulse shrink-0 border ${isLight ? 'bg-red-50 border-red-100' : 'bg-red-500/10 border-red-500/20'}`}>
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)] shrink-0" />
                                        <p className={`text-[10px] font-black uppercase tracking-wider ${isLight ? 'text-red-650' : 'text-red-400'}`}>
                                            La mesa solicita tu presencia
                                        </p>
                                    </div>
                                    <button
                                        onClick={async () => {
                                            await autoResolveTableNotifications(selectedTable.id);
                                        }}
                                        className={`px-3 py-1.5 bg-red-500 hover:bg-red-600 active:bg-red-700 text-white rounded-xl text-[9px] font-black uppercase tracking-wider shadow-md active:scale-95 transition-all cursor-pointer ${isLight ? 'shadow-red-100' : 'shadow-red-500/20'}`}
                                    >
                                        Marcar Atendido
                                    </button>
                                </div>
                            )}

                            {isTakingOrder ? (
                                // ==========================================
                                // INTERFAZ DE COMANDERA MÓVIL TÁCTIL
                                // ==========================================
                                <div className="flex-1 flex flex-col min-h-0 space-y-4 font-sans">
                                    {/* Buscador y Categorías */}
                                    <div className="space-y-3 shrink-0">
                                        <div className="relative">
                                            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                                            <input
                                                type="text"
                                                placeholder="Buscar producto por nombre..."
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                className={`w-full pl-11 pr-10 py-3 rounded-2xl font-medium text-xs focus:outline-none focus:border-orange-500/50 transition-colors border ${isLight ? 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400' : 'bg-slate-900 border-slate-800 text-white placeholder-slate-700'}`}
                                            />
                                            {searchQuery && (
                                                <button
                                                    onClick={() => setSearchQuery('')}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1 rounded-lg"
                                                >
                                                    <X size={14} />
                                                </button>
                                            )}
                                        </div>

                                        {/* Barra de Categorías */}
                                        <div className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-none select-none">
                                            <button
                                                onClick={() => setSelectedCategory('all')}
                                                className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider shrink-0 transition-all border ${
                                                    selectedCategory === 'all'
                                                        ? (isLight ? 'bg-orange-55 text-orange-600 border-orange-200/60 shadow-sm' : 'bg-orange-500/10 text-orange-400 border-orange-500/30 shadow-[0_0_10px_rgba(249,115,22,0.1)]')
                                                        : (isLight ? 'bg-slate-50 text-slate-550 border-slate-200 hover:text-slate-800 hover:bg-slate-100' : 'bg-slate-900 text-slate-500 border-slate-800/80 hover:text-slate-300')
                                                }`}
                                            >
                                                Todas
                                            </button>
                                            {categories.map((c: any) => (
                                                <button
                                                    key={c.id}
                                                    onClick={() => setSelectedCategory(c.id)}
                                                    className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider shrink-0 transition-all border ${
                                                        selectedCategory === c.id
                                                            ? (isLight ? 'bg-orange-55 text-orange-600 border-orange-200/60 shadow-sm' : 'bg-orange-500/10 text-orange-400 border-orange-500/30 shadow-[0_0_10px_rgba(249,115,22,0.1)]')
                                                            : (isLight ? 'bg-slate-50 text-slate-550 border-slate-200 hover:text-slate-800 hover:bg-slate-100' : 'bg-slate-900 text-slate-500 border-slate-800/80 hover:text-slate-300')
                                                    }`}
                                                >
                                                    {c.name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Grid de Productos */}
                                    <div className="flex-1 overflow-y-auto pr-1 min-h-0 custom-scrollbar">
                                        {(() => {
                                            const filteredProducts = products.filter((p: any) => {
                                                const matchesCat = selectedCategory === 'all' || p.category_id === selectedCategory;
                                                const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
                                                return matchesCat && matchesSearch;
                                            });

                                            if (filteredProducts.length === 0) {
                                                return (
                                                    <div className={`py-12 text-center rounded-3xl border border-dashed ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/20 border-white/5'}`}>
                                                        <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">No hay productos disponibles</p>
                                                        <p className={`text-[8px] mt-1 ${isLight ? 'text-slate-400' : 'text-slate-600'}`}>Prueba cambiando el filtro de búsqueda o categoría.</p>
                                                    </div>
                                                );
                                            }

                                            return (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-2">
                                                    {filteredProducts.map((p: any) => {
                                                        const qtyInCart = cart[p.id] || 0;
                                                        const availableStock = getAvailableStockForProduct(p.id);
                                                        const isOutOfStock = availableStock <= 0;

                                                        return (
                                                            <div
                                                                key={p.id}
                                                                className={`rounded-2xl border p-3 flex flex-col justify-between transition-all duration-300 relative overflow-hidden ${
                                                                    isOutOfStock
                                                                        ? (isLight ? 'border-slate-100 bg-slate-50 opacity-55' : 'border-slate-900/30 bg-slate-950/20 opacity-50')
                                                                        : qtyInCart > 0
                                                                            ? (isLight ? 'border-orange-300 bg-orange-50/5 shadow-sm text-slate-900' : 'border-orange-500/30 bg-slate-900/60 shadow-[0_0_10px_rgba(249,115,22,0.05)] text-white')
                                                                            : (isLight ? 'border-slate-200/60 bg-white hover:border-slate-350 hover:shadow-sm text-slate-900' : 'border-white/5 bg-slate-950/40 hover:border-white/10 text-white')
                                                                }`}
                                                            >
                                                                <div className="flex justify-between items-start gap-2">
                                                                    <div>
                                                                        <h4 className={`text-xs font-black uppercase tracking-wider leading-snug ${isOutOfStock ? (isLight ? 'text-slate-350' : 'text-slate-600') : (isLight ? 'text-slate-900' : 'text-slate-100')}`}>
                                                                            {p.name}
                                                                        </h4>
                                                                        <span className="text-[10px] font-extrabold text-orange-400 mt-1 block">
                                                                            ${p.price.toLocaleString('es-AR')}
                                                                        </span>
                                                                    </div>
                                                                    
                                                                    {isOutOfStock ? (
                                                                        <span className="text-[7px] font-black uppercase bg-red-500/10 border border-red-500/20 text-red-500 px-1.5 py-0.5 rounded shrink-0">
                                                                            Agotado
                                                                        </span>
                                                                    ) : (
                                                                        <span className={`text-[7px] font-black uppercase px-1.5 py-0.5 rounded border shrink-0 ${
                                                                            availableStock < 5
                                                                                ? 'bg-amber-500/10 border-amber-500/20 text-amber-500 animate-pulse'
                                                                                : (isLight ? 'bg-slate-50 border-slate-200 text-slate-500' : 'bg-slate-900 border border-slate-800 text-slate-400')
                                                                        }`}>
                                                                            Stock: {availableStock === Infinity ? '∞' : availableStock}
                                                                        </span>
                                                                    )}
                                                                </div>

                                                                <div className="mt-3.5 flex justify-end">
                                                                    {isOutOfStock ? (
                                                                        <button disabled className={`w-full py-1.5 text-[8px] font-black uppercase tracking-wider rounded-xl border cursor-not-allowed ${isLight ? 'bg-slate-50 border-slate-150 text-slate-400' : 'bg-slate-950 border border-slate-900 text-slate-700'}`}>
                                                                            Sin Stock
                                                                        </button>
                                                                    ) : qtyInCart > 0 ? (
                                                                        <div className={`flex items-center gap-2.5 w-full border rounded-xl p-1 justify-between ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/80 border-slate-900'}`}>
                                                                            <button
                                                                                onClick={() => removeFromCart(p.id)}
                                                                                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all active:scale-90 border ${isLight ? 'bg-white hover:bg-slate-100 text-slate-600 border-slate-200/60 shadow-sm' : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border-transparent'}`}
                                                                            >
                                                                                <Minus size={12} />
                                                                            </button>
                                                                            <span className={`text-xs font-black px-1 select-none ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                                                                {qtyInCart}
                                                                            </span>
                                                                            <button
                                                                                onClick={() => addToCart(p.id)}
                                                                                disabled={availableStock <= 0}
                                                                                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all active:scale-90 border ${isLight ? 'bg-white hover:bg-slate-100 text-slate-600 border-slate-200/60 shadow-sm' : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border-transparent'}`}
                                                                            >
                                                                                <Plus size={12} />
                                                                            </button>
                                                                        </div>
                                                                    ) : (
                                                                        <button
                                                                            onClick={() => addToCart(p.id)}
                                                                            className={`w-full py-2 px-3 border font-black rounded-xl text-[8.5px] uppercase tracking-wider transition-all duration-200 active:scale-95 flex items-center justify-center gap-1 ${isLight ? 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 hover:text-slate-900 shadow-sm' : 'bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 hover:text-white text-slate-300'}`}
                                                                        >
                                                                            <Plus size={10} /> Agregar
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            );
                                        })()}
                                    </div>

                                    {/* Carrito e Inputs de Notas de Preparación */}
                                    <div className={`shrink-0 pt-3 border-t space-y-4 ${isLight ? 'border-slate-100' : 'border-white/5'}`}>
                                        {(() => {
                                            const cartItems = Object.entries(cart).filter(([_, qty]) => qty > 0);
                                            const cartItemsCount = cartItems.length;

                                            if (cartItemsCount === 0) {
                                                return (
                                                    <div className={`py-4 text-center rounded-2xl border border-dashed ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/20 border-white/5'}`}>
                                                        <p className="text-slate-600 text-[9px] font-black uppercase tracking-widest">El carrito está vacío</p>
                                                        <p className="text-slate-600 text-[8px] mt-0.5">Agrega algunos productos arriba para iniciar el pedido.</p>
                                                    </div>
                                                );
                                            }

                                            return (
                                                <div className="space-y-3">
                                                    <div className="flex justify-between items-center px-1">
                                                        <span className={`text-[9px] font-black uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Productos en Carrito</span>
                                                        <span className={`text-[9px] font-black uppercase border px-2 py-0.5 rounded ${isLight ? 'bg-orange-55 text-orange-600 border-orange-200/60 shadow-sm' : 'bg-orange-500/10 text-orange-400 border-orange-500/20'}`}>
                                                            {Object.values(cart).reduce((a, b) => a + b, 0)} items
                                                        </span>
                                                    </div>
                                                    
                                                    {/* Listado en miniatura del carrito con inputs de Notas */}
                                                    <div className="max-h-[16vh] overflow-y-auto pr-1 space-y-2 custom-scrollbar">
                                                        {cartItems.map(([pid, qty]) => {
                                                            const prod = products.find(p => p.id === pid);
                                                            if (!prod) return null;

                                                            return (
                                                                <div key={pid} className={`border rounded-2xl p-2.5 flex flex-col gap-2 ${isLight ? 'bg-slate-50/50 border-slate-200/80' : 'bg-slate-900/30 border-white/5'}`}>
                                                                    <div className="flex justify-between items-center">
                                                                        <span className={`text-[11px] font-black truncate max-w-[170px] uppercase tracking-wide ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                                                                            {qty}x {prod.name}
                                                                        </span>
                                                                        <div className="flex items-center gap-2">
                                                                            <span className={`text-[10px] font-extrabold ${isLight ? 'text-slate-600 font-extrabold' : 'text-slate-400'}`}>
                                                                                ${(prod.price * qty).toLocaleString('es-AR')}
                                                                            </span>
                                                                            <button
                                                                                onClick={() => {
                                                                                    setCart(prev => {
                                                                                        const next = { ...prev };
                                                                                        delete next[pid];
                                                                                        return next;
                                                                                    });
                                                                                    setCartNotes(prev => {
                                                                                        const next = { ...prev };
                                                                                        delete next[pid];
                                                                                        return next;
                                                                                    });
                                                                                }}
                                                                                className={`p-1 rounded-lg transition-colors ${isLight ? 'hover:bg-slate-100 text-slate-400 hover:text-red-500' : 'hover:bg-slate-900 text-slate-600 hover:text-red-400'}`}
                                                                            >
                                                                                <Trash2 size={12} />
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                    
                                                                    {/* Input de Nota */}
                                                                    <div className="relative flex items-center">
                                                                        <Edit3 size={11} className="absolute left-2.5 text-slate-600" />
                                                                        <input
                                                                            type="text"
                                                                            placeholder="Aclaración (ej: sin cebolla, muy caliente)..."
                                                                            value={cartNotes[pid] || ''}
                                                                            onChange={(e) => setCartNotes(prev => ({ ...prev, [pid]: e.target.value }))}
                                                                            className={`w-full pl-7 pr-3 py-1.5 rounded-xl font-medium text-[10px] focus:outline-none focus:border-orange-500/30 transition-colors border ${isLight ? 'bg-white border-slate-200 text-slate-950 placeholder-slate-400' : 'bg-slate-950/80 border-slate-900 text-white placeholder-slate-750'}`}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>

                                                    {/* Selector de Método de Pago */}
                                                    <div className={`py-2 border-t space-y-2 ${isLight ? 'border-slate-100' : 'border-white/5'}`}>
                                                        <span className={`text-[8px] font-black uppercase tracking-wider block ${isLight ? 'text-slate-500 font-extrabold' : 'text-slate-500'}`}>Método de Pago para Comanda</span>
                                                        <div className="grid grid-cols-4 gap-1.5">
                                                            {(['efectivo', 'mercadopago', 'debito', 'credito'] as const).map(method => {
                                                                const label = method === 'efectivo' ? 'Efectivo' 
                                                                            : method === 'mercadopago' ? 'MP' 
                                                                            : method === 'debito' ? 'Débito' 
                                                                            : 'Crédito';
                                                                const emoji = method === 'efectivo' ? '💵' 
                                                                            : method === 'mercadopago' ? '📱' 
                                                                            : method === 'debito' ? '💳' 
                                                                            : '💳';
                                                                const isSelected = cartPaymentMethod === method;
                                                                
                                                                return (
                                                                    <button
                                                                        key={method}
                                                                        type="button"
                                                                        onClick={() => setCartPaymentMethod(method)}
                                                                        className={`py-2 px-1 rounded-xl border text-[9px] font-black uppercase flex flex-col items-center justify-center gap-0.5 transition-all text-center ${
                                                                            isSelected
                                                                                ? (isLight ? 'bg-orange-50 border-orange-400 text-orange-700 shadow-sm' : 'bg-slate-900 border-orange-500 text-white shadow shadow-orange-500/10')
                                                                                : (isLight ? 'bg-white border-slate-200 text-slate-650 hover:bg-slate-50' : 'bg-slate-950/40 border-slate-900 text-slate-500 hover:text-slate-350')
                                                                        }`}
                                                                    >
                                                                        <span className="text-xs">{emoji}</span>
                                                                        <span>{label}</span>
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>

                                                    {/* Total y Botón de Confirmación */}
                                                    <div className={`pt-2.5 border-t flex items-center justify-between ${isLight ? 'border-slate-100' : 'border-white/5'}`}>
                                                        <div>
                                                            <span className={`text-[8px] font-black uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>Total Estimado</span>
                                                            <p className={`text-xl font-black italic leading-none mt-0.5 ${isLight ? 'text-slate-950 font-black' : 'text-white'}`}>
                                                                ${Object.entries(cart).reduce((total, [pid, qty]) => {
                                                                    const prod = products.find(p => p.id === pid);
                                                                    return total + (prod?.price || 0) * qty;
                                                                }, 0).toLocaleString('es-AR')}
                                                            </p>
                                                        </div>
                                                        
                                                        <button
                                                            onClick={handleConfirmOrder}
                                                            disabled={orderLoading}
                                                            className={`px-6 py-3 bg-gradient-to-r from-orange-500 to-rose-600 hover:from-orange-600 hover:to-rose-700 disabled:opacity-40 disabled:hover:from-orange-500 disabled:hover:to-rose-600 text-white font-black rounded-2xl text-[10px] uppercase tracking-wider transition-all duration-200 active:scale-95 shadow-lg border flex items-center gap-2 animate-pulse ${isLight ? 'shadow-orange-100 border-orange-400/20' : 'shadow-orange-500/20 border-white/10'}`}
                                                        >
                                                            {orderLoading ? (
                                                                <>
                                                                    <Loader2 size={13} className="animate-spin" />
                                                                    <span>Enviando...</span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <Check size={13} />
                                                                    <span>Enviar a Cocina</span>
                                                                </>
                                                            )}
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                            ) : (
                                // ==========================================
                                // VISTA ESTÁNDAR: DETALLE DE MESAS Y COMANDAS
                                // ==========================================
                                <>
                                    {/* Panel del Auto-Asignación */}
                                    <div className={`p-4 flex justify-between items-center shrink-0 border rounded-3xl ${isLight ? 'bg-slate-100/80 border-slate-200/60 shadow-sm' : 'bg-slate-900/60 border-slate-800'}`}>
                                        <div className="space-y-0.5">
                                            <span className={`text-[8px] font-black uppercase tracking-widest ${isLight ? 'text-slate-500 font-extrabold' : 'text-slate-500'}`}>Asignación del Mozo</span>
                                            <p className={`text-xs font-black ${isLight ? 'text-slate-850' : 'text-slate-200'}`}>
                                                {isAssigned ? '🟢 Atendida por ti (Mis Mesas)' : selectedTable.waiter_name ? `👤 Atendida por ${selectedTable.waiter_name}` : '⚪ Libre (Sin Mozo)'}
                                            </p>
                                        </div>
                                        <div className="flex gap-2">
                                            {(!selectedTable.waiter_name || isAssigned) ? (
                                                <button
                                                    onClick={() => toggleTableAssignment(selectedTable.id)}
                                                    className={`px-4 py-2.5 rounded-2xl text-[9px] font-black uppercase tracking-wider transition-all duration-300 active:scale-95 shadow-md ${
                                                        isAssigned
                                                            ? 'bg-orange-500 text-white hover:bg-orange-600 shadow-orange-500/10'
                                                            : (isLight ? 'bg-white text-slate-650 hover:text-slate-800 border border-slate-200 shadow-sm' : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800')
                                                    }`}
                                                >
                                                    {isAssigned ? 'Dejar de Atender' : 'Atender Mesa'}
                                                </button>
                                            ) : (
                                                <span className={`px-4 py-2.5 rounded-2xl text-[9px] font-black uppercase tracking-wider border ${isLight ? 'bg-slate-50 border-slate-200 text-slate-500' : 'bg-slate-950 border border-slate-800 text-slate-500'}`}>
                                                    Ocupada
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    {/* Contenido / Comandas Activas */}
                                    <div className="flex-1 overflow-y-auto pr-1 space-y-4 max-h-[40vh] custom-scrollbar">
                                        {tableOrders.filter(group => !group.items.every(i => i.is_served)).length === 0 ? (
                                            <div className={`py-12 text-center rounded-3xl border border-dashed ${isLight ? 'bg-slate-55/40 border-slate-200 text-slate-800' : 'bg-slate-900/20 border-white/5'}`}>
                                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3 border shadow-inner ${isLight ? 'bg-emerald-50 border-emerald-200/60 text-emerald-500' : 'bg-emerald-900/20 border-emerald-500/20 text-emerald-400'}`}>
                                                    <CheckCircle2 size={22} className="currentColor" />
                                                </div>
                                                <h4 className={`font-black uppercase tracking-widest text-[9px] mb-1 ${isLight ? 'text-slate-900' : 'text-white'}`}>Platos Entregados</h4>
                                                <p className="text-slate-550 text-[9px] max-w-xs mx-auto leading-relaxed">Todos los pedidos de esta mesa ya fueron servidos. Los clientes están comiendo.</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                {tableOrders.filter(group => !group.items.every(i => i.is_served)).map(group => {
                                                    const orderObj = orders.find(o => o.id === group.orderId);
                                                    const isPendingPayment = orderObj?.payment_status !== 'pagado';
                                                    const isNotApproved = !orderObj?.table_number && (orderObj as any)?.is_approved_for_production === false;

                                                    return (
                                                        <div key={group.orderId} className={`rounded-[1.8rem] border p-4 space-y-3 transition-all duration-300 ${
                                                            isPendingPayment && isNotApproved ? 'border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.15)] bg-gradient-to-br from-red-950/10 to-slate-950/20' : (isLight ? 'bg-slate-50/50 border-slate-200/80 shadow-sm' : 'border-white/5 bg-slate-900/30')
                                                        }`}>
                                                            {/* CARTEL ROJO BRILLANTE Y BOTÓN EN MOZO */}
                                                            {isPendingPayment && isNotApproved && (
                                                                <div className="bg-red-650 text-white p-3 rounded-2xl text-[9px] font-black uppercase tracking-wider flex justify-between items-center animate-pulse gap-2">
                                                                    <span>⚠️ PENDIENTE DE PAGO</span>
                                                                    {isAssigned && (
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handleSendOrderToProduction(group.orderId);
                                                                            }}
                                                                            className="bg-white text-red-650 hover:bg-slate-100 px-3 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-wider transition-all shadow active:scale-95 shrink-0"
                                                                        >
                                                                            Enviar Pedido a Producción
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            )}

                                                            <div className={`flex justify-between items-center pb-2 border-b ${isLight ? 'border-slate-100' : 'border-white/5'}`}>
                                                                <span className={`text-[9px] font-black uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                                                                    Comanda <span style={{ color: primaryColor }}>#{group.orderNumber}</span>
                                                                </span>
                                                                <button
                                                                    onClick={() => handleServeAllInGroup(group)}
                                                                    className="text-[9px] font-black uppercase tracking-wider text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-0.5"
                                                                >
                                                                    <Check size={11} /> Servir Todo Listo
                                                                </button>
                                                            </div>

                                                        <div className="space-y-2">
                                                            {group.items.map((item: any) => {
                                                                const isReady = item.status === 'delivered';
                                                                const isServed = item.is_served;
                                                                const isKitchen = item.target_departments?.includes('kitchen');
                                                                const isBar = item.target_departments?.includes('bartender');
                                                                const deptLabel = isKitchen ? 'Cocina' : isBar ? 'Barra' : 'General';
                                                                const deptIcon = isKitchen ? '🍳' : isBar ? '🍹' : '📦';

                                                                return (
                                                                    <div 
                                                                        key={item.id}
                                                                        onClick={() => {
                                                                            if (isReady && !isServed) handleServeItem(item.id);
                                                                        }}
                                                                        className={`flex items-center gap-3.5 p-3.5 border rounded-2xl transition-all duration-200 ${
                                                                            isServed
                                                                                ? (isLight ? 'border-emerald-250 bg-emerald-50 text-emerald-800 opacity-80 cursor-default' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400/80 cursor-default opacity-70')
                                                                                : isReady
                                                                                    ? (isLight ? 'border-red-400 bg-red-50 text-red-700 cursor-pointer active:scale-[0.98] shadow-sm shadow-red-100' : 'border-red-500 bg-red-500/10 cursor-pointer active:scale-[0.98] shadow-[0_0_15px_rgba(239,68,68,0.25)] ring-1 ring-red-500/20')
                                                                                    : (isLight ? 'border-slate-100 bg-slate-50/20 text-slate-400 opacity-50 cursor-not-allowed' : 'border-slate-800/60 bg-slate-950/20 text-slate-500 opacity-40 cursor-not-allowed')
                                                                        }`}
                                                                    >
                                                                        {/* CHECKBOX A LA IZQUIERDA */}
                                                                        {isServed ? (
                                                                            <div className="w-5.5 h-5.5 rounded-lg bg-emerald-500 border border-emerald-400 flex items-center justify-center shadow-[0_0_10px_rgba(16,185,129,0.4)] shrink-0 transition-transform select-none">
                                                                                <Check size={13} className="text-slate-950 stroke-[3.5]" />
                                                                            </div>
                                                                        ) : isReady ? (
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    handleServeItem(item.id);
                                                                                }}
                                                                                className={`w-5.5 h-5.5 rounded-lg border-2 border-red-500 flex items-center justify-center cursor-pointer transition-all duration-200 hover:bg-red-500 hover:scale-105 active:scale-90 group/check shrink-0 ${isLight ? 'bg-red-50 shadow-red-100/50' : 'bg-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.3)]'}`}
                                                                                title="Tildar como Entregado"
                                                                            >
                                                                                <Check size={13} className="text-red-500 group-hover/check:text-slate-950 stroke-[3.5] transition-colors" />
                                                                            </button>
                                                                        ) : (
                                                                            <div 
                                                                                className={`w-5.5 h-5.5 rounded-lg border border-dashed flex items-center justify-center shrink-0 select-none cursor-not-allowed ${isLight ? 'border-slate-300 bg-slate-50' : 'border-slate-700/80 bg-slate-950/50'}`}
                                                                                title="Esperando preparación en cocina/barra"
                                                                            >
                                                                                <Clock size={11} className="text-slate-400" />
                                                                            </div>
                                                                        )}

                                                                        {/* CANTIDAD Y NOMBRE DEL ITEM */}
                                                                        <div className="flex-1 min-w-0 flex items-center gap-3">
                                                                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                                                                                isServed
                                                                                    ? (isLight ? 'bg-emerald-100/70 border border-emerald-200/50 text-emerald-700/80' : 'bg-emerald-950/25 border border-emerald-900/30 text-emerald-400/60')
                                                                                    : isReady
                                                                                        ? (isLight ? 'bg-red-50 text-red-650 border border-red-200' : 'bg-red-500/15 text-red-500 border border-red-500/25 shadow-[0_0_10px_rgba(239,68,68,0.1)]')
                                                                                        : (isLight ? 'bg-slate-50 border border-slate-200 text-slate-500' : 'bg-slate-950 border border-slate-900/40 text-slate-500')
                                                                            }`}>
                                                                                {item.quantity}x
                                                                            </div>
                                                                                <p className={`font-black text-sm leading-tight truncate ${isServed ? 'line-through text-emerald-600 font-bold' : (isLight ? 'text-slate-800' : 'text-slate-100')}`}>
                                                                                    {item.product?.name || 'Producto'}
                                                                                </p>
                                                                                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                                                                    {item.notes && (
                                                                                        <span className="text-[7.5px] font-black text-amber-500 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded uppercase tracking-wider max-w-[160px] truncate">
                                                                                            ⚠️ NOTA: {item.notes}
                                                                                        </span>
                                                                                    )}
                                                                                    <span className={`text-[7px] font-black uppercase px-1.5 py-0.25 rounded border shrink-0 ${isLight ? 'border-slate-200 bg-slate-50 text-slate-500' : 'border-slate-800 bg-slate-950 text-slate-400'}`}>
                                                                                        {deptIcon} {deptLabel}
                                                                                    </span>
                                                                                </div>
                                                                            </div>

                                                                        {/* ESTADO OPERATIVO Y TIEMPOS */}
                                                                        <div className="flex items-center gap-2 shrink-0 select-none">
                                                                            {isServed ? (
                                                                                <span className="text-[8px] font-black uppercase text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg flex items-center gap-0.5 font-bold">
                                                                                    Servido
                                                                                </span>
                                                                            ) : isReady ? (
                                                                                <span className="text-[8px] font-black uppercase text-red-400 bg-red-500/15 border border-red-500/25 px-2.5 py-1 rounded-lg animate-pulse flex items-center gap-1">
                                                                                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping" /> ¡Listo!
                                                                                </span>
                                                                            ) : (
                                                                                <span className={`text-[8px] font-black uppercase border px-2.5 py-1 rounded-lg flex items-center gap-1 ${isLight ? 'bg-slate-50 border-slate-200 text-slate-500' : 'bg-slate-950 border border-slate-900 text-slate-500'}`}>
                                                                                    <Clock size={9} className="animate-spin text-slate-400 shrink-0" /> Cocina/Bar
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                    {/* Acciones del Pie del Modal */}
                                    <div className={`flex gap-2.5 pt-3 border-t shrink-0 w-full ${isLight ? 'border-slate-100' : 'border-white/5'}`}>
                                        {selectedTable.is_occupied && isAssigned && (
                                            <button
                                                onClick={async () => {
                                                    if (confirm("¿Estás seguro de que deseas marcar esta mesa como DESOCUPADA? Pasará a estar libre para nuevos clientes.")) {
                                                        await handleFreeTable(selectedTable.id);
                                                        setSelectedTable(null);
                                                    }
                                                }}
                                                className="w-1/2 py-3 px-4 bg-red-600 hover:bg-red-500 text-white font-black rounded-2xl text-[9px] uppercase tracking-wider transition-all duration-200 active:scale-95 text-center flex items-center justify-center gap-1.5 shadow-lg shadow-red-600/15"
                                            >
                                                Desocupar Mesa
                                            </button>
                                        )}
                                        <button
                                            onClick={() => setSelectedTable(null)}
                                            className={`${selectedTable.is_occupied && isAssigned ? 'w-1/2' : 'w-full'} py-3 px-4 font-black rounded-2xl text-[9px] uppercase tracking-wider transition-all duration-200 active:scale-95 text-center flex items-center justify-center border ${isLight ? 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-650 hover:text-slate-850 shadow-sm' : 'bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400'}`}
                                        >
                                            Cerrar Detalle
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                );
            })()}

            {/* Modal Premium de Cobro y Cierre de Mesa por Mozo */}
            {false && (() => {
                const tableName = translateTableIdToName(pendingPaymentTable.id);
                const tableOrders = getTableOrders(pendingPaymentTable.id);
                const totalMesa = tableOrders.reduce((sum, g) => {
                    const orderObj = orders.find(o => o.id === g.orderId);
                    return sum + (orderObj?.total_price || 0);
                }, 0);

                return (
                    <div className="fixed inset-0 z-[300] flex items-center justify-center px-4 bg-black/95 backdrop-blur-xl animate-in fade-in duration-300">
                        <div className={`w-full max-w-sm rounded-[2.5rem] p-6 space-y-5 border shadow-2xl animate-in zoom-in-95 duration-200 ${isLight ? 'bg-white border-emerald-100 text-slate-900 shadow-emerald-100/30' : 'glass border-emerald-500/20 bg-gradient-to-br from-emerald-950/20 via-slate-900/40 to-slate-950/80'}`}>
                            
                            <div className="text-center space-y-1.5">
                                <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto border ${isLight ? 'bg-emerald-50 border-emerald-150 text-emerald-600' : 'bg-emerald-500/10 text-emerald-450 border-emerald-500/20'}`}>
                                    <span className="text-2xl">💵</span>
                                </div>
                                <h3 className="text-base font-black uppercase text-emerald-400 tracking-widest pt-2">Registrar Cobro</h3>
                                <p className={`text-[9px] font-black uppercase tracking-wide ${isLight ? 'text-slate-600' : 'text-slate-500'}`}>
                                    Cobrar pedidos y liberar {tableName}
                                </p>
                            </div>

                            <div className={`rounded-3xl p-4 border space-y-2.5 text-xs ${isLight ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-slate-950/60 border-white/5 text-white'}`}>
                                <div className={`flex justify-between items-center pb-2 border-b ${isLight ? 'border-slate-100' : 'border-white/5'}`}>
                                    <span className={`font-extrabold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Mesa:</span>
                                    <span className={`font-black ${isLight ? 'text-slate-900 font-extrabold' : 'text-white'}`}>{tableName}</span>
                                </div>
                                <div className={`flex justify-between items-center pb-2 border-b ${isLight ? 'border-slate-100' : 'border-white/5'}`}>
                                    <span className={`font-extrabold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Comandas:</span>
                                    <span className={`font-black ${isLight ? 'text-slate-900 font-extrabold' : 'text-white'}`}>{tableOrders.length} activas</span>
                                </div>
                                <div className={`flex justify-between items-center pb-2 border-b ${isLight ? 'border-slate-100' : 'border-white/5'}`}>
                                    <span className={`font-extrabold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Subtotal:</span>
                                    <span className={`font-black ${isLight ? 'text-slate-900 font-extrabold' : 'text-white'}`}>${totalMesa.toLocaleString('es-AR')}</span>
                                </div>
                                {waiterManualDiscount > 0 && (
                                    <div className={`flex justify-between items-center pb-2 border-b ${isLight ? 'border-slate-100' : 'border-white/5'}`}>
                                        <span className={`font-extrabold text-orange-500`}>Descuento/Seña:</span>
                                        <span className={`font-black text-orange-500`}>-${waiterManualDiscount.toLocaleString('es-AR')}</span>
                                    </div>
                                )}
                                <div className="flex justify-between items-center pt-1.5">
                                    <span className={`font-extrabold text-sm ${isLight ? 'text-slate-550' : 'text-slate-400'}`}>Total a Cobrar:</span>
                                    <span className={`font-black text-sm ${isLight ? 'text-emerald-600 font-black' : 'text-emerald-450'}`}>${Math.max(0, totalMesa - waiterManualDiscount).toLocaleString('es-AR')}</span>
                                </div>
                            </div>

                            <div className="space-y-2 pb-2">
                                <p className={`text-[8px] font-black uppercase tracking-wider pl-1 ${isLight ? 'text-slate-550' : 'text-slate-500'}`}>Código de Descuento / Reserva:</p>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={waiterManualCode}
                                        onChange={(e) => setWaiterManualCode(e.target.value.toUpperCase())}
                                        placeholder="Código..."
                                        className={`flex-1 border rounded-xl px-3 py-2 text-xs outline-none uppercase font-bold ${isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-slate-900/50 border-slate-700 text-white'}`}
                                    />
                                    <button
                                        type="button"
                                        onClick={handleValidateWaiterCode}
                                        disabled={isWaiterValidatingCode || !waiterManualCode}
                                        className="px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-bold rounded-xl text-[10px] transition-all"
                                    >
                                        {isWaiterValidatingCode ? 'Validando...' : 'Aplicar'}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <p className={`text-[8px] font-black uppercase tracking-wider pl-1 ${isLight ? 'text-slate-550' : 'text-slate-500'} mb-2`}>Cobro Interno (Sin Factura):</p>
                                    <div className="grid grid-cols-3 gap-2">
                                        <button
                                            onClick={() => handleConfirmTablePayment(pendingPaymentTable.id, 'efectivo', false)}
                                            className="py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[9px] uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-95 flex flex-col items-center justify-center gap-1 border border-emerald-500/20"
                                        >
                                            <span>💵</span>
                                            <span>Efectivo</span>
                                        </button>
                                        <button
                                            onClick={() => handleConfirmTablePayment(pendingPaymentTable.id, 'debito', false)}
                                            className="py-3 bg-blue-600 hover:bg-blue-500 text-white font-black text-[9px] uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-95 flex flex-col items-center justify-center gap-1 border border-blue-500/20"
                                        >
                                            <span>💳</span>
                                            <span>Débito</span>
                                        </button>
                                        <button
                                            onClick={() => handleConfirmTablePayment(pendingPaymentTable.id, 'credito', false)}
                                            className="py-3 bg-purple-600 hover:bg-purple-500 text-white font-black text-[9px] uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-95 flex flex-col items-center justify-center gap-1 border border-purple-500/20"
                                        >
                                            <span>💳</span>
                                            <span>Crédito</span>
                                        </button>
                                    </div>
                                </div>

                                {(tenant as any)?.afip_enabled && (
                                    <div className={`p-3 rounded-2xl border space-y-2.5 ${isLight ? 'bg-blue-50/30 border-blue-200' : 'bg-blue-950/15 border-blue-500/20'}`}>
                                        <p className="text-[8px] font-black uppercase tracking-wider pl-1 text-blue-400">Datos Facturación AFIP (Opcional):</p>
                                        <div className="flex gap-2">
                                            <select
                                                value={afipDocTipo}
                                                onChange={(e) => setAfipDocTipo(parseInt(e.target.value))}
                                                className={`border rounded-xl px-2.5 py-2 text-[10px] outline-none font-bold shrink-0 ${isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-slate-900 border-slate-700 text-white'}`}
                                            >
                                                <option value={99}>Cons. Final</option>
                                                <option value={96}>DNI</option>
                                                <option value={80}>CUIT</option>
                                            </select>
                                            
                                            {afipDocTipo !== 99 && (
                                                <input
                                                    type="text"
                                                    value={afipDocNro}
                                                    onChange={(e) => setAfipDocNro(e.target.value.replace(/\D/g, ''))}
                                                    placeholder={afipDocTipo === 80 ? "Ingrese CUIT..." : "Ingrese DNI..."}
                                                    className={`flex-1 border rounded-xl px-3 py-2 text-xs outline-none font-bold ${isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-slate-900/50 border-slate-700 text-white'}`}
                                                />
                                            )}
                                        </div>
                                    </div>
                                )}

                                {(tenant as any)?.afip_enabled && (
                                    <div>
                                        <p className="text-[8px] font-black uppercase tracking-wider pl-1 text-blue-500 mb-2">Cobro con Factura AFIP (Fiscal):</p>
                                        <div className="grid grid-cols-3 gap-2">
                                            <button
                                                onClick={() => handleConfirmTablePayment(pendingPaymentTable.id, 'efectivo', true)}
                                                className="py-3 bg-blue-700 hover:bg-blue-600 text-white font-black text-[9px] uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-95 flex flex-col items-center justify-center gap-1 border border-blue-500/20"
                                            >
                                                <span>💵</span>
                                                <span>Efectivo</span>
                                            </button>
                                            <button
                                                onClick={() => handleConfirmTablePayment(pendingPaymentTable.id, 'debito', true)}
                                                className="py-3 bg-blue-700 hover:bg-blue-600 text-white font-black text-[9px] uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-95 flex flex-col items-center justify-center gap-1 border border-blue-500/20"
                                            >
                                                <span>💳</span>
                                                <span>Débito</span>
                                            </button>
                                            <button
                                                onClick={() => handleConfirmTablePayment(pendingPaymentTable.id, 'credito', true)}
                                                className="py-3 bg-blue-700 hover:bg-blue-600 text-white font-black text-[9px] uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-95 flex flex-col items-center justify-center gap-1 border border-blue-500/20"
                                            >
                                                <span>💳</span>
                                                <span>Crédito</span>
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={() => {
                                    const fakeOrder = {
                                        id: 'cuenta-' + pendingPaymentTable.id,
                                        created_at: new Date().toISOString(),
                                        order_number: 'MESA-' + tableName,
                                        table_number: tableName,
                                        total_price: Math.max(0, totalMesa - waiterManualDiscount),
                                        items: tableOrders.flatMap(o => o.items),
                                        tenant_id: tenant?.id,
                                        client_name: 'Mesa',
                                        afip_doc_tipo: afipDocNro ? afipDocTipo : undefined,
                                        afip_doc_nro: afipDocNro ? afipDocNro : undefined
                                    } as unknown as Order;
                                    triggerPrint(fakeOrder);
                                }}
                                className={`w-full py-3 border font-black uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 mt-2 mb-2 ${isLight ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50' : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white'}`}
                            >
                                <Printer size={16} /> Imprimir Pre-Cuenta
                            </button>

                            <button
                                onClick={() => {
                                    setPendingPaymentTable(null);
                                    setWaiterManualCode('');
                                    setWaiterManualDiscount(0);
                                }}
                                className={`w-full py-3 border text-[9px] font-black uppercase tracking-widest rounded-2xl transition-all active:scale-95 ${isLight ? 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-650 hover:text-slate-850 shadow-sm' : 'bg-slate-950/80 hover:bg-slate-900 border border-white/5 hover:border-white/10 text-slate-400 hover:text-slate-200'}`}
                            >
                                Cancelar
                            </button>
                            
                        </div>
                    </div>
                );
            })()}
            {/* HIDDEN PRINT TICKET */}
            <PrintableTicket ref={printComponentRef} order={orderToPrint} tenant={tenant} products={products} />
        </div>
    );
}
