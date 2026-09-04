'use client';

import React, { useState, useRef, useMemo } from 'react';
import { Category, Product, Ingredient, OrderItem, Order } from '@/types/database';
import { Minus, Plus, Sparkles, Smartphone, Check, ArrowLeft, ShoppingCart, AlertCircle, X, RefreshCw, ClipboardList, CheckCircle2, Clock, User, Flame, Navigation, AlertTriangle, Printer, Trash2, ShoppingBag, Calendar, Users, Package, Utensils, GlassWater, Coffee, Pizza, Beer, Search, Info, Coins, Mic } from 'lucide-react';
import { supabase, broadcastTenantChange } from '@/lib/supabase';
import { useNotifications } from '@/lib/store';
import { useOfflineStore } from '@/lib/offlineStore';
import { cleanArgPhone, isSamePhone, mergeClientNames } from '@/lib/phoneUtils';
import { useReactToPrint } from 'react-to-print';
import { PrintableTicket } from './PrintableTicket';

const triggerTrialStart = (tenantId: string) => {
    fetch('/api/trial/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId })
    }).catch(() => {});
};

interface OrderTabProps {
    products: Product[];
    ingredients: Ingredient[];
    categories: Category[];
    productIngredients?: any[];
    orders?: Order[];
    expenses?: any[];
    tenant?: any;
    productOffers?: any[];
    isLight?: boolean;
    refetchData?: () => void;
}

const formatARS = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        maximumFractionDigits: 0
    }).format(amount);
};

const checkIsCurrentlyOpen = (cfg: any) => {
    if (!cfg || !cfg.enabled || !cfg.schedule) return true;
    const now = new Date();
    let currentDayStr = String(now.getDay());
    const currentHours = now.getHours().toString().padStart(2, '0');
    const currentMinutes = now.getMinutes().toString().padStart(2, '0');
    const currentTimeStr = `${currentHours}:${currentMinutes}`;
    const todayShifts = cfg.schedule[currentDayStr] || [];
    if (todayShifts.length === 0) return false;
    for (const shift of todayShifts) {
        if (shift.open <= shift.close) {
            if (currentTimeStr >= shift.open && currentTimeStr <= shift.close) return true;
        } else {
            if (currentTimeStr >= shift.open || currentTimeStr <= shift.close) return true;
        }
    }
    let yesterdayDayStr = String((now.getDay() - 1 + 7) % 7);
    const yesterdayShifts = cfg.schedule[yesterdayDayStr] || [];
    for (const shift of yesterdayShifts) {
        if (shift.open > shift.close) {
            if (currentTimeStr <= shift.close) return true;
        }
    }
    return false;
};

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

export default function OrderTab({ products, ingredients, categories: initialCategories, orders = [], tenant, productIngredients = [], productOffers = [], isLight = false, refetchData }: OrderTabProps) {
    const [subTab, setSubTab] = useState<'new_order' | 'deliveries' | 'reservations'>('new_order');
    const [calendarReservations, setCalendarReservations] = useState<any[]>([]);
    const [selectedResDate, setSelectedResDate] = useState<string>(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });
    const [selectedResShift, setSelectedResShift] = useState<'mediodia' | 'tarde' | 'noche'>('noche');
    
    // Configuración general
    const [categories, setCategories] = useState<Category[]>(initialCategories);
    const [clientName, setClientName] = useState('');
    const [phone, setPhone] = useState('');
    const [customerCuit, setCustomerCuit] = useState('');
    const [afipClientType, setAfipClientType] = useState<'consumidor_final' | 'monotributista' | 'responsable_inscripto'>('consumidor_final');
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
    const [cart, setCart] = useState<Record<string, number>>({});
    const [cartNotes, setCartNotes] = useState<Record<string, string>>({});
    const [showSummary, setShowSummary] = useState(false);
    const [questionModalProduct, setQuestionModalProduct] = useState<any>(null);
    const [questionModalSelectedOption, setQuestionModalSelectedOption] = useState<string>('');
    const [questionModalAnswer, setQuestionModalAnswer] = useState<string>('');
    const [showOfflineQueue, setShowOfflineQueue] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Delight UX & Animaciones del Carrito en Caja
    const [flyingProducts, setFlyingProducts] = useState<{ id: string; startX: number; startY: number; targetX: number; targetY: number; imageUrl?: string | null; name: string }[]>([]);
    const [cartBump, setCartBump] = useState(false);
    const [priceDeltaBubble, setPriceDeltaBubble] = useState<{ id: string; amount: number } | null>(null);
    const lastClickPos = useRef<{ x: number; y: number }>({ x: typeof window !== 'undefined' ? window.innerWidth / 2 : 200, y: 300 });
    const cartButtonRef = useRef<HTMLDivElement | null>(null);

    const { addNotification } = useNotifications();

    const handleVoiceSearch = () => {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            alert('Tu navegador no soporta reconocimiento de voz. Usa Chrome o Safari.');
            return;
        }
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.lang = 'es-AR';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => setIsListening(true);
        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            setSearchQuery(transcript);
        };
        recognition.onerror = () => setIsListening(false);
        recognition.onend = () => setIsListening(false);
        recognition.start();
    };
    const { addToQueue, syncQueue, queue } = useOfflineStore();

    // NUEVOS ESTADOS DE COBRO CRUZADO, BUSCADOR Y MÉTODOS DE PAGO NATIVOS
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'efectivo' | 'debito' | 'credito' | 'rappi' | 'pedidosya'>('efectivo');
    const [crossPaymentOrder, setCrossPaymentOrder] = useState<Order | null>(null);
    const [crossPaymentMethod, setCrossPaymentMethod] = useState<'efectivo' | 'debito' | 'credito'>('efectivo');
    const [additionalTipAmount, setAdditionalTipAmount] = useState<number>(0);
    const [deliveriesSubTab, setDeliveriesSubTab] = useState<'pending' | 'completed'>('pending');

    const [orderToPrint, setOrderToPrint] = useState<Order | null>(null);

    // Estados y Búsqueda del Club de Clientes y Fidelización en Caja (mmmTodoLoQueQuiero 2026)
    const [loyaltyAccount, setLoyaltyAccount] = useState<any>(null);
    const [useLoyaltyDiscount, setUseLoyaltyDiscount] = useState(false);
    const [loyaltyTodayEarned, setLoyaltyTodayEarned] = useState<number>(0);

    React.useEffect(() => {
        if (!tenant?.id || !phone.trim() || phone.trim().length < 6) {
            setLoyaltyAccount(null);
            setUseLoyaltyDiscount(false);
            setLoyaltyTodayEarned(0);
            return;
        }

        const timer = setTimeout(async () => {
            try {
                let account = null;
                const { data: list } = await supabase
                    .from('loyalty_accounts')
                    .select('*')
                    .eq('tenant_id', tenant.id);

                if (list && list.length > 0) {
                    account = list.find((a: any) => isSamePhone(a.phone_number, phone.trim())) || null;
                }

                if (account) {
                    setLoyaltyAccount(account);

                    // Consultar pedidos de hoy para este teléfono para bloquear saldo generado hoy (Regla: Canje a partir de la próxima visita / día siguiente)
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const rawDigits = phone.trim().replace(/\D/g, '').slice(-8);

                    let todayOrdersList: any[] = [];
                    if (orders && orders.length > 0) {
                        todayOrdersList = orders.filter((o: any) => {
                            if (o.status === 'cancelled') return false;
                            const orderDate = new Date(o.created_at);
                            return orderDate >= today;
                        });
                    } else {
                        const { data: dbOrders } = await supabase
                            .from('orders')
                            .select('id, total_price, created_at, status, phone_number')
                            .eq('tenant_id', tenant.id)
                            .gte('created_at', today.toISOString())
                            .neq('status', 'cancelled');
                        todayOrdersList = dbOrders || [];
                    }

                    if (todayOrdersList.length > 0) {
                        const clientTodayOrders = todayOrdersList.filter((o: any) => {
                            const oDigits = (o.phone_number || '').replace(/\D/g, '');
                            return rawDigits.length >= 6 && (oDigits.includes(rawDigits) || rawDigits.includes(oDigits.slice(-8)));
                        });

                        if (clientTodayOrders.length > 0) {
                            const config = tenant?.loyalty_config || {};
                            const tiers = config.tiers || [];
                            let currentTier = account.tier || 'bronce';
                            let cashbackPct = config.cashback_pct || 5;
                            const foundTier = tiers.find((t: any) => t.name === currentTier);
                            if (foundTier) cashbackPct = foundTier.cashback_pct || cashbackPct;

                            const todayEarned = Math.round(clientTodayOrders.reduce((sum: number, o: any) => sum + ((Number(o.total_price) || 0) * (cashbackPct / 100)), 0));
                            setLoyaltyTodayEarned(todayEarned);
                        } else {
                            setLoyaltyTodayEarned(0);
                        }
                    } else {
                        setLoyaltyTodayEarned(0);
                    }
                } else {
                    setLoyaltyAccount(null);
                    setLoyaltyTodayEarned(0);
                }
            } catch (e) {
                setLoyaltyAccount(null);
                setLoyaltyTodayEarned(0);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [phone, tenant?.id, orders]);

    // Effect para autocompletar AFIP si el cliente lo pidió (movido después de los useState)
    React.useEffect(() => {
        if (crossPaymentOrder && (crossPaymentOrder as any).afip_billing_requested) {
            setAfipClientType((crossPaymentOrder as any).afip_client_type || 'consumidor_final');
            setCustomerCuit((crossPaymentOrder as any).afip_doc_number || '');
        } else if (crossPaymentOrder) {
            setAfipClientType('consumidor_final');
            setCustomerCuit('');
        }
    }, [crossPaymentOrder]);

    // Effect para auto-sincronizar cuando vuelve el internet (Caja Salvavidas)
    React.useEffect(() => {
        const handleOnline = () => {
            console.log("Internet recuperado. Iniciando sincronización de Caja Salvavidas...");
            addNotification("Internet recuperado. Sincronizando pedidos guardados...", ['staff', 'admin'], 'info', tenant?.id);
            syncQueue().then(() => {
                if (refetchData) refetchData();
                addNotification("Sincronización offline completada.", ['staff', 'admin'], 'success', tenant?.id);
            }).catch(err => console.error("Error en sincronización offline", err));
        };

        window.addEventListener('online', handleOnline);
        return () => window.removeEventListener('online', handleOnline);
    }, [syncQueue, refetchData, tenant?.id, addNotification]);

    // Listener para el botón ATRÁS del celular (PWA Global Back Button)
    React.useEffect(() => {
        const handleGoBack = () => {
            if (showOfflineQueue) setShowOfflineQueue(false);
            else if (orderToPrint) setOrderToPrint(null);
            else if (crossPaymentOrder) setCrossPaymentOrder(null);
            else if (showSummary) setShowSummary(false);
            else if (selectedCategoryId) setSelectedCategoryId(null);
            else if (subTab === 'deliveries') setSubTab('new_order');
        };
        window.addEventListener('app-go-back', handleGoBack);
        return () => window.removeEventListener('app-go-back', handleGoBack);
    }, [showOfflineQueue, orderToPrint, crossPaymentOrder, showSummary, selectedCategoryId, subTab]);

    React.useEffect(() => {
        if (!tenant || !tenant.id) return;
        
        const fetchReservations = async () => {
            const today = new Date();
            today.setHours(0,0,0,0);
            const future = new Date(today);
            future.setDate(future.getDate() + 35);
            
            const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            const futureStr = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}-${String(future.getDate()).padStart(2, '0')}`;
            
            const { data, error } = await supabase
                .from('reservations')
                .select('*')
                .eq('tenant_id', tenant.id)
                .in('status', ['confirmed', 'pending_payment', 'completed'])
                .gte('reservation_date', todayStr)
                .lte('reservation_date', futureStr)
                .order('reservation_date', { ascending: true })
                .order('reservation_time', { ascending: true });
                
            if (!error && data) {
                setCalendarReservations(data);
            }
        };
        
        fetchReservations();
        
        const channel = supabase.channel('order-tab-reservations')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations', filter: `tenant_id=eq.${tenant.id}` }, () => {
                fetchReservations();
            })
            .subscribe();
            
        return () => {
            supabase.removeChannel(channel);
        };
    }, [tenant?.id]);

    const printComponentRef = useRef<HTMLDivElement>(null);
    const handlePrint = useReactToPrint({
        contentRef: printComponentRef,
        onAfterPrint: () => setOrderToPrint(null),
    });
    const triggerPrint = async (order: Order) => {
        // JIT Fetch: Traer la orden más fresca de Supabase antes de imprimir
        // Evita imprimir tickets comunes (sin CAE) si AFIP facturó hace mili-segundos y Realtime no llegó
        const { data: freshOrder } = await supabase
            .from('orders')
            .select('*, items:order_items(*)')
            .eq('id', order.id)
            .single();

        setOrderToPrint(freshOrder || order);
        setTimeout(() => handlePrint(), 100);
    };

    // RESOLUCIÓN DE OFERTAS COMPATIBLE CON PUBLICMENU
    const getProductIdsArray = (productIds: any): string[] => {
        if (!productIds) return [];
        if (Array.isArray(productIds)) return productIds.map(String);
        if (typeof productIds === 'string') {
            try {
                const parsed = JSON.parse(productIds);
                if (Array.isArray(parsed)) return parsed.map(String);
            } catch (e) {
                return productIds.split(',').map(s => s.trim());
            }
        }
        return [];
    };

    const getActiveOfferForProduct = (productId: string) => {
        return (productOffers || []).find(offer => {
            const pIds = getProductIdsArray(offer.product_ids);
            if (!pIds.includes(productId)) return false;

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const parseDate = (dStr: string) => {
                const [y, m, d] = dStr.split('T')[0].split('-').map(Number);
                return new Date(y, m - 1, d);
            };

            const start = parseDate(offer.start_date);
            const end = parseDate(offer.end_date);
            end.setHours(23, 59, 59, 999);

            const isDateValid = today >= start && today <= end;
            if (!isDateValid) return false;

            if (offer.limit_quantity !== null && offer.limit_quantity !== undefined && offer.limit_quantity > 0) {
                let totalSold = 0;
                (orders || []).forEach(order => {
                    if (order.is_archived) return;
                    
                    const orderDate = new Date(order.created_at);
                    const isOrderInOfferRange = orderDate >= start && orderDate <= end;
                    
                    if (isOrderInOfferRange && order.items) {
                        order.items.forEach(item => {
                            if (item.product_id === productId) {
                                totalSold += item.quantity;
                            }
                        });
                    }
                });

                if (totalSold >= offer.limit_quantity) {
                    return false;
                }
            }

            return true;
        });
    };

    const getProductFinalPrice = (productId: string): number => {
        const prod = products.find(p => p.id === productId);
        if (!prod) return 0;
        const activeOffer = getActiveOfferForProduct(productId);
        return activeOffer
            ? Math.round(prod.price * (1 - activeOffer.discount_percentage / 100))
            : prod.price;
    };

    // Mapa de popularidad acumulada de ventas por producto (Top Ventas del Mes) idéntico a AdminTab (Balance / Ajustes)
    const productSalesMap = useMemo(() => {
        const counts: Record<string, number> = {};
        const allTimeCounts: Record<string, number> = {};
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();

        (orders || []).forEach(o => {
            if (!o?.created_at) return;
            const oDate = new Date(o.created_at);
            const isCurrentMonth = oDate.getFullYear() === currentYear && oDate.getMonth() === currentMonth;

            if (Array.isArray(o.items)) {
                o.items.forEach((item: any) => {
                    if (item?.product_id) {
                        const qty = Number(item.quantity) || 1;
                        allTimeCounts[item.product_id] = (allTimeCounts[item.product_id] || 0) + qty;
                        if (isCurrentMonth) {
                            counts[item.product_id] = (counts[item.product_id] || 0) + qty;
                        }
                    }
                });
            }
        });

        // Si en el mes actual ya hay ventas, se usa el ranking del mes; si el mes recién empieza o está vacío, fallback a ventas históricas
        const hasMonthSales = Object.keys(counts).length > 0;
        return hasMonthSales ? counts : allTimeCounts;
    }, [orders]);

    // Conteo de ofertas activas en tiempo real
    const activeOffersCount = useMemo(() => {
        const offerCat = categories.find(c => c.is_offer === true || /oferta|oportunidad|descuento/i.test(c.name));
        return products.filter(p => p.is_active !== false && (!!getActiveOfferForProduct(p.id) || (offerCat && p.category_id === offerCat.id))).length;
    }, [products, productOffers, orders, categories]);

    // Lista unificada de productos para Caja: Búsqueda Global Instantánea y Orden por Top Ventas
    const displayedProducts = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();

        // 1. REGLA CLAVE DE BÚSQUEDA GLOBAL:
        // Si hay texto en el buscador, busca en TODO el catálogo de la tienda independientemente de la categoría previa
        if (q) {
            const matches = products.filter(p => {
                if (p.is_active === false) return false;
                const nameLower = p.name.toLowerCase();
                const descLower = p.description?.toLowerCase() || '';
                return nameLower.includes(q) || descLower.includes(q);
            });

            return matches.sort((a, b) => {
                const aName = a.name.toLowerCase();
                const bName = b.name.toLowerCase();

                // Prioridad 1: Los que EMPIEZAN exactamente con las letras ingresadas (ej: "ha" -> "Hamburguesa")
                const aStarts = aName.startsWith(q);
                const bStarts = bName.startsWith(q);
                if (aStarts && !bStarts) return -1;
                if (!aStarts && bStarts) return 1;

                // Prioridad 2: Si alguna palabra interna empieza con las letras (ej: "Súper Hamburguesa")
                const aWordStarts = aName.split(/\s+/).some(w => w.startsWith(q));
                const bWordStarts = bName.split(/\s+/).some(w => w.startsWith(q));
                if (aWordStarts && !bWordStarts) return -1;
                if (!aWordStarts && bWordStarts) return 1;

                // Prioridad 3: Más vendidos primero (Top Ventas)
                const salesA = productSalesMap[a.id] || 0;
                const salesB = productSalesMap[b.id] || 0;
                if (salesB !== salesA) return salesB - salesA;

                // Prioridad 4: Destacados primero
                if ((b.is_featured ? 1 : 0) !== (a.is_featured ? 1 : 0)) {
                    return (b.is_featured ? 1 : 0) - (a.is_featured ? 1 : 0);
                }

                // Prioridad 5: Alfabético
                return a.name.localeCompare(b.name);
            });
        }

        // 2. SIN TEXTO ESCRITO:
        // Si se borra la búsqueda o está vacío, filtra por categoría si está seleccionada, o muestra todo el menú
        let filtered = products.filter(p => p.is_active !== false);

        if (selectedCategoryId === 'offers') {
            const offerCat = categories.find(c => c.is_offer === true || /oferta|oportunidad|descuento/i.test(c.name));
            filtered = filtered.filter(p => !!getActiveOfferForProduct(p.id) || (offerCat && p.category_id === offerCat.id));
        } else if (selectedCategoryId && selectedCategoryId !== 'all') {
            const selectedCat = categories.find(c => c.id === selectedCategoryId);
            const isOfferCat = selectedCat 
                ? (selectedCat.is_offer === true || /oferta|oportunidad|descuento/i.test(selectedCat.name))
                : false;

            if (isOfferCat) {
                filtered = filtered.filter(p => !!getActiveOfferForProduct(p.id) || (selectedCat && p.category_id === selectedCat.id));
            } else {
                filtered = filtered.filter(p => p.category_id === selectedCategoryId);
            }
        }

        // 3. ORDEN NATURAL: Más vendidos (Top Ventas) primero, luego destacados, luego alfabético
        return filtered.sort((a, b) => {
            const salesA = productSalesMap[a.id] || 0;
            const salesB = productSalesMap[b.id] || 0;
            if (salesB !== salesA) return salesB - salesA;

            if ((b.is_featured ? 1 : 0) !== (a.is_featured ? 1 : 0)) {
                return (b.is_featured ? 1 : 0) - (a.is_featured ? 1 : 0);
            }

            return a.name.localeCompare(b.name);
        });
    }, [products, searchQuery, selectedCategoryId, categories, productSalesMap, productOffers, orders]);


    // MÓDULO DE SIMULACIÓN DE NOTIFICACIONES SMS / WHATSAPP AUTOMÁTICAS
    const sendOrderSmsNotification = async (order: Order, type: 'ready' | 'shipped') => {
        const clientNameClean = order.client_name?.split('(')[0]?.trim() || 'Cliente';
        const orderNum = order.order_number || order.id?.substring(0, 4) || 'N/A';
        const localName = tenant?.name || 'Local';
        
        let message = '';
        if (type === 'ready') {
            message = `¡Hola ${clientNameClean}! Tu pedido #${orderNum} en ${localName} ya está listo. Podés pasar a buscarlo. 🍕`;
        } else {
            message = `¡Hola ${clientNameClean}! Tu pedido #${orderNum} de ${localName} está en camino a tu domicilio. ¡Llegará pronto! 🛵`;
        }

        console.log(`[SMS/WhatsApp Simulator] Enviando a ${order.phone_number || 'N/A'}: ${message}`);
        
        // Registrar notificación en app_notifications
        try {
            await supabase.from('app_notifications').insert([{
                message: `[SMS ENVIADO] A ${clientNameClean} (${order.phone_number || 'N/A'}): "${message}"`,
                type: 'info',
                target_roles: ['staff', 'admin'],
                tenant_id: order.tenant_id
            }]);
        } catch (err) {
            console.error("Error al registrar logs de SMS:", err);
        }
    };

    // APROBACIÓN DE PRODUCCIÓN DE FORMA REMOTA DESDE LA CAJA
    const handleSendOrderToProduction = async (orderId: string) => {
        const { error } = await supabase
            .from('orders')
            .update({ is_approved_for_production: true })
            .eq('id', orderId);

        if (error) {
            alert("Error al enviar el pedido a producción: " + error.message);
        } else {
            // Buscar items para notificar correctamente
            const { data: orderItems } = await supabase.from('order_items').select('target_departments').eq('order_id', orderId);
            const targetRoles = new Set<any>(['admin', 'staff']);
            if (orderItems) {
                orderItems.forEach(item => {
                    if (item.target_departments?.includes('kitchen')) targetRoles.add('kitchen');
                    if (item.target_departments?.includes('bartender') || item.target_departments?.includes('bar')) targetRoles.add('bartender');
                });
            } else {
                targetRoles.add('kitchen').add('bartender');
            }
            
            addNotification(`🍳 Pedido enviado a producción`, Array.from(targetRoles), 'info', tenant?.id);
            alert("¡Pedido enviado a producción!");
            if (tenant?.id) {
                broadcastTenantChange(tenant.id);
            }
            if (refetchData) refetchData();
        }
    };

    const handleConfirmPayment = async (order: Order, finalMethod: 'efectivo' | 'debito' | 'credito', isAfipBilling: boolean = false) => {
        // Validación PREVENTIVA estricta de AFIP (Evitar actualizar a cobrado si falta CUIT)
        if (isAfipBilling) {
            const docLen = customerCuit ? customerCuit.replace(/\D/g, '').length : 0;
            if (afipClientType !== 'consumidor_final' && docLen !== 11) {
                alert("⚠️ ERROR: Debes ingresar un CUIT válido de 11 dígitos para facturar a Responsable Inscripto o Monotributista.");
                return; // Bloquear ejecución aquí mismo
            } else if (afipClientType === 'consumidor_final' && docLen < 7) {
                alert("⚠️ ERROR: Para emitir factura electrónica debes ingresar el DNI o CUIT del cliente.");
                return;
            }
        }

        try {
            setIsSubmitting(true);
            // 1. Actualizar el estado de cobro de la orden
            let updateError: any = null;

            const finalTipAmount = (order.tip_amount || 0) + additionalTipAmount;
            const finalTotalWithExtraTip = order.total_price + additionalTipAmount;
            const isAlreadyDelivered = order.status === 'delivered' && (order as any).delivery_type === 'delivery';

            // Primer intento: incluir is_approved_for_production, tip_amount
            const { error: firstAttemptError } = await supabase
                .from('orders')
                .update({ 
                    payment_status: 'pagado', 
                    payment_method: finalMethod,
                    is_approved_for_production: true,
                    ...(isAlreadyDelivered ? {
                        status: 'completed',
                        is_archived: true
                    } : {}),
                    ...(additionalTipAmount > 0 ? {
                        tip_amount: finalTipAmount,
                        total_price: finalTotalWithExtraTip
                    } : {})
                })
                .eq('id', order.id);

            updateError = firstAttemptError;

            // Si falla por columnas inexistentes o error de schema cache
            if (updateError && (
                updateError.message?.toLowerCase().includes('column') ||
                updateError.message?.toLowerCase().includes('does not exist') ||
                updateError.message?.toLowerCase().includes('schema cache') ||
                updateError.code === 'PGRST104' ||
                updateError.code === '42703'
            )) {
                console.warn("⚠️ Advertencia: Detectadas columnas de Envío/Producción faltantes en Supabase al confirmar pago. Re-intentando actualización básica...");
                
                const { error: secondAttemptError } = await supabase
                    .from('orders')
                    .update({ 
                        payment_status: 'pagado', 
                        payment_method: finalMethod,
                        ...(isAlreadyDelivered ? {
                            status: 'completed',
                            is_archived: true
                        } : {})
                    })
                    .eq('id', order.id);

                updateError = secondAttemptError;
            }

            if (updateError) throw updateError;

            // 2. Facturar con AFIP si se solicita
            if (isAfipBilling && (tenant as any)?.afip_enabled) {
                try {
                    addNotification(`⏳ Procesando factura AFIP para pedido #${order.order_number || order.id.substring(0,4)}...`, ['staff', 'admin'], 'info', tenant?.id);

                    let docTipo = 99;
                    let docNro = 0;
                    let tipoComprobante = 6;

                    if (afipClientType !== 'consumidor_final') {
                        if (!customerCuit || customerCuit.replace(/\D/g, '').length !== 11) {
                            throw new Error("El CUIT debe tener 11 dígitos para Factura A o a Monotributista.");
                        }
                        docTipo = 80; // CUIT
                        docNro = parseInt(customerCuit.replace(/\D/g, ''));
                        
                        const isLocalMonotributista = tenant?.afip_condicion_iva?.toLowerCase().includes('monotribut');
                        if (isLocalMonotributista) {
                            tipoComprobante = 11; // Monotributista siempre hace C
                        } else {
                            if (afipClientType === 'responsable_inscripto' || afipClientType === 'monotributista') {
                                tipoComprobante = 1; // Factura A (RI a RI o a Monotributista por RG 5003/2021)
                            } else {
                                tipoComprobante = 6; // Factura B
                            }
                        }
                    } else {
                        // Si es Consumidor Final
                        const isLocalMonotributista = tenant?.afip_condicion_iva?.toLowerCase().includes('monotribut');
                        tipoComprobante = isLocalMonotributista ? 11 : 6;
                    }

                    const response = await fetch('/api/afip/facturar', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            orderId: order.id,
                            tenantId: tenant?.id,
                            docTipo,
                            docNro,
                            tipoComprobante
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
                    alert("El cobro cruzado se registró, pero la facturación AFIP falló:\n" + afipErr.message);
                }
            }

            // Nota: Se removió la autoliberación automática de mesas en Caja al confirmar pago. La mesa
            // sigue ocupada por su respectivo mozo en salón hasta que el mozo la libere manualmente.
            
            // Nota: Se removió la autoliberación automática de mesas en Caja al confirmar pago. La mesa
            // sigue ocupada por su respectivo mozo en salón hasta que el mozo la libere manualmente.

            addNotification(`💵 Pago confirmado: Pedido #${order.order_number} cobrado en ${finalMethod.toUpperCase()}`, ['staff', 'admin'], 'success', tenant?.id);
            if (!isAfipBilling) {
                alert(`¡Pago confirmado con éxito en ${finalMethod.toUpperCase()}!`);
            }
            
            // Cerrar modal
            setCrossPaymentOrder(null);

            // Difundir cambios en tiempo real
            if (tenant?.id) {
                broadcastTenantChange(tenant.id);
            }
            if (refetchData) refetchData();
        } catch (err: any) {
            console.error("Error al procesar el cobro cruzado:", err);
            alert("Error al confirmar el pago: " + err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Despachar y archivar comanda de forma total (especialmente útil para órdenes ya pagadas como MP)
    const handleCloseAndArchiveOrder = async (order: Order) => {
        try {
            // 1. Marcar todos los items de la orden como servidos y entregados
            const { error: itemsError } = await supabase
                .from('order_items')
                .update({ is_served: true, status: 'delivered' })
                .eq('order_id', order.id);

            if (itemsError) throw itemsError;

            // 2. Marcar la orden como entregada y archivada
            const { error: orderError } = await supabase
                .from('orders')
                .update({ 
                    status: 'delivered', 
                    is_archived: true 
                })
                .eq('id', order.id);

            if (orderError) throw orderError;

            // Nota: Se removió la autoliberación automática de mesas en Caja al archivar. La mesa
            // sigue ocupada por su respectivo mozo en salón hasta que el mozo la libere manualmente.
            
            // Archivar todas las órdenes activas vinculadas a esta mesa (solo si es una mesa real)
            if (order.table_number) {
                const activeMesaOrders = orders.filter(o => 
                    o.table_number === order.table_number && 
                    !o.is_archived && 
                    o.id !== order.id
                );

                for (const activeO of activeMesaOrders) {
                    await supabase
                        .from('orders')
                        .update({ is_archived: true, payment_status: 'pagado' })
                        .eq('id', activeO.id);
                }
            }

            addNotification(`📦 Comanda #${order.order_number} despachada y archivada con éxito`, ['staff', 'admin'], 'success', tenant?.id);
            alert(`¡Comanda #${order.order_number} despachada y archivada con éxito!`);
            
            if (tenant?.id) {
                broadcastTenantChange(tenant.id);
            }
            if (refetchData) refetchData();
        } catch (err: any) {
            console.error("Error al despachar y archivar la comanda:", err);
            alert("Error al despachar y archivar: " + err.message);
        }
    };

    // Obtener el nombre del producto de forma rápida
    const getProductName = (productId: string) => {
        const product = products.find(p => p.id === productId);
        return product ? product.name : 'Producto';
    };

    // Sonido sutil de campana cristalina mediante Web Audio API nativo
    const playCartChime = () => {
        try {
            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();
            if (ctx.state === 'suspended') ctx.resume();

            const now = ctx.currentTime;
            const osc1 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(880, now);
            osc1.frequency.exponentialRampToValueAtTime(1318.5, now + 0.1);
            gain1.gain.setValueAtTime(0.14, now);
            gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
            osc1.connect(gain1);
            gain1.connect(ctx.destination);
            osc1.start(now);
            osc1.stop(now + 0.35);

            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.type = 'triangle';
            osc2.frequency.setValueAtTime(1760, now + 0.08);
            gain2.gain.setValueAtTime(0.08, now + 0.08);
            gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.start(now + 0.08);
            osc2.stop(now + 0.45);
        } catch {}
    };

    const triggerCartBump = (finalPrice: number, product: Product) => {
        const cartRect = cartButtonRef.current?.getBoundingClientRect();
        const targetX = cartRect 
            ? (cartRect.left + cartRect.width / 2) 
            : (typeof window !== 'undefined' ? window.innerWidth / 2 : 200);
        const targetY = cartRect 
            ? (cartRect.top + cartRect.height / 2) 
            : (typeof window !== 'undefined' ? window.innerHeight - 100 : 600);

        const startX = lastClickPos.current?.x || (typeof window !== 'undefined' ? window.innerWidth / 2 : 200);
        const startY = lastClickPos.current?.y || (typeof window !== 'undefined' ? window.innerHeight / 2 : 300);

        const flyingId = crypto.randomUUID();
        setFlyingProducts(prev => [
            ...prev,
            {
                id: flyingId,
                startX,
                startY,
                targetX,
                targetY,
                imageUrl: product.image_url,
                name: product.name,
            }
        ]);

        setTimeout(() => {
            setFlyingProducts(prev => prev.filter(p => p.id !== flyingId));
        }, 700);

        setTimeout(() => {
            setCartBump(true);
            setPriceDeltaBubble({ id: crypto.randomUUID(), amount: finalPrice });
            setTimeout(() => setCartBump(false), 550);
            setTimeout(() => setPriceDeltaBubble(null), 1100);
        }, 420);
    };

    const addToCart = (productIdOrKey: string, bypassModal: boolean = false, event?: React.MouseEvent) => {
        if (event) {
            const targetEl = event.currentTarget as HTMLElement | null;
            const rect = targetEl?.getBoundingClientRect?.();
            if (rect) {
                lastClickPos.current = {
                    x: rect.left + rect.width / 2,
                    y: rect.top + rect.height / 2
                };
            } else if (event.clientX && event.clientY) {
                lastClickPos.current = { x: event.clientX, y: event.clientY };
            }
        }

        const [productId] = productIdOrKey.split("::");
        const prod = products.find(p => p.id === productId);
        const hasOptionals = (productIngredients || []).some(pi => pi.product_id === productId && pi.is_optional);
        
        if (!bypassModal && prod && (hasOptionals || prod.custom_question)) {
            setQuestionModalProduct(prod);
            setQuestionModalSelectedOption('');
            setQuestionModalAnswer('');
            return;
        }

        const currentQty = cart[productIdOrKey] || 0;
        setCart(prev => ({ ...prev, [productIdOrKey]: currentQty + 1 }));

        if (prod) {
            const price = getProductFinalPrice(productId);
            playCartChime();
            triggerCartBump(price, prod);
        }
    };

    const performAddToCartWithOption = (productId: string, optionId: string, answer: string = '') => {
        const cartKey = optionId ? `${productId}::${optionId}` : productId;
        const currentQty = cart[cartKey] || 0;
        setCart(prev => ({ ...prev, [cartKey]: currentQty + 1 }));
        if (answer) setCartNotes(prev => ({ ...prev, [cartKey]: answer }));
        setQuestionModalProduct(null);
        setQuestionModalSelectedOption('');
        setQuestionModalAnswer('');

        const prod = products.find(p => p.id === productId);
        if (prod) {
            const price = getProductFinalPrice(productId);
            playCartChime();
            triggerCartBump(price, prod);
        }
    };

    const removeFromCart = (cartKey: string) => {
        setCart(prev => {
            const newVal = (prev[cartKey] || 0) - 1;
            if (newVal <= 0) {
                const { [cartKey]: _, ...rest } = prev;
                return rest;
            }
            return { ...prev, [cartKey]: newVal };
        });
    };

    const getProductCartQty = (productId: string) => {
        return Object.entries(cart).reduce((sum, [key, qty]) => {
            if (key === productId || key.startsWith(`${productId}::`)) {
                return sum + (qty || 0);
            }
            return sum;
        }, 0);
    };

    const handleRemoveProductFromCart = (productId: string) => {
        const matchingKey = Object.keys(cart).reverse().find(k => k === productId || k.startsWith(`${productId}::`));
        if (matchingKey) {
            removeFromCart(matchingKey);
        }
    };

    const totalPrice = Object.entries(cart).reduce((sum, [cartKey, qty]) => {
        const [id] = cartKey.split("::");
        return sum + getProductFinalPrice(id) * qty;
    }, 0);

    const handleFinish = async (isAfipBilling: boolean = false) => {
        if (!clientName) return alert("Nombre de cliente requerido");

        // Validación PREVENTIVA estricta de AFIP (Evitar crear pedido si falta CUIT)
        if (isAfipBilling) {
            const docLen = customerCuit ? customerCuit.replace(/\D/g, '').length : 0;
            if (afipClientType !== 'consumidor_final' && docLen !== 11) {
                alert("⚠️ ERROR: Debes ingresar un CUIT válido de 11 dígitos para facturar a Responsable Inscripto o Monotributista.");
                return; // Bloquear ejecución aquí mismo
            } else if (afipClientType === 'consumidor_final' && docLen < 7) {
                alert("⚠️ ERROR: Para emitir factura electrónica debes ingresar el DNI o CUIT del cliente.");
                return;
            }
        }

        setIsSubmitting(true);

        // Calcular descuento por fidelidad (Monedero Virtual mmmTodoLoQueQuiero 2026)
        let loyaltyRedemption = 0;
        if (useLoyaltyDiscount && loyaltyAccount && tenant?.loyalty_enabled === true) {
            const config = tenant?.loyalty_config || {};
            const redeemChannel = config.redeem_channel || 'both';
            const isSalonAllowed = redeemChannel === 'both' || redeemChannel === 'salon';

            if (isSalonAllowed) {
                const totalBalance = parseFloat(loyaltyAccount.balance) || 0;
                const canRedeemAmount = Math.max(0, totalBalance - loyaltyTodayEarned);
                loyaltyRedemption = Math.min(canRedeemAmount, totalPrice);
            }
        }

        const finalTotal = Math.max(0, totalPrice - loyaltyRedemption);

        const orderData = {
            client_name: clientName,
            phone_number: phone,
            total_price: finalTotal,
            items: Object.entries(cart).map(([cartKey, quantity]) => ({
                product_id: cartKey.split("::")[0],
                cart_key: cartKey,
                quantity,
                unit_price: getProductFinalPrice(cartKey.split("::")[0])
            }))
        };

        try {
            // Check online status briefly
            if (!navigator.onLine) {
                throw new Error("offline");
            }

            // 1. Create order
            let order: any = null;
            let orderError: any = null;

            // Primer intento: incluir todas las columnas de la Fase 1 (is_approved_for_production, delivery_type)
            const firstAttempt = await supabase
                .from('orders')
                .insert({
                    client_name: orderData.client_name,
                    phone_number: orderData.phone_number,
                    total_price: orderData.total_price,
                    status: 'pending',
                    payment_method: selectedPaymentMethod,
                    payment_status: 'pagado',
                    is_approved_for_production: true,
                    delivery_type: 'local',
                    loyalty_discount_applied: loyaltyRedemption,
                    tenant_id: tenant?.id
                })
                .select()
                .single();

            order = firstAttempt.data;
            orderError = firstAttempt.error;

            // Si falla por columnas inexistentes o error de schema cache
            if (orderError && (
                orderError.message?.toLowerCase().includes('column') ||
                orderError.message?.toLowerCase().includes('does not exist') ||
                orderError.message?.toLowerCase().includes('schema cache') ||
                orderError.code === 'PGRST104' ||
                orderError.code === '42703'
            )) {
                console.warn("⚠️ Advertencia: Detectadas columnas de Envío faltantes en Supabase desde Caja. Re-intentando inserción básica...", orderError);
                
                const secondAttempt = await supabase
                    .from('orders')
                    .insert({
                        client_name: orderData.client_name,
                        phone_number: orderData.phone_number,
                        total_price: orderData.total_price,
                        status: 'pending',
                        payment_method: selectedPaymentMethod,
                        payment_status: 'pagado',
                        loyalty_discount_applied: loyaltyRedemption,
                        tenant_id: tenant?.id
                    })
                    .select()
                    .single();

                order = secondAttempt.data;
                orderError = secondAttempt.error;

                if (!orderError) {
                    console.warn("⚠️ ALERTA: Pedido de Caja insertado exitosamente en modo de compatibilidad. Por favor, ejecuta el script de migración SQL en Supabase para soporte de Envíos.");
                }
            }

            if (orderError) throw orderError;

            // Debitar el saldo usado en el monedero del cliente de forma atómica en Supabase (Caja mmmTodoLoQueQuiero)
            if (loyaltyRedemption > 0 && loyaltyAccount) {
                await supabase
                    .from('loyalty_accounts')
                    .update({ balance: Math.max(0, (parseFloat(loyaltyAccount.balance) || 0) - loyaltyRedemption) })
                    .eq('id', loyaltyAccount.id);
            }

            // 2. Create order items applying the Smart Splitter logic
            const orderItemsToInsert: any[] = [];
            
            orderData.items.forEach(i => {
                const pid = i.product_id;
                const cartKey = (i as any).cart_key || pid;
                const qty = i.quantity;
                const price = i.unit_price;

                const prod = products.find(p => p.id === pid);
                const category = categories.find(c => c.id === prod?.category_id);
                const catDepts = (category?.target_departments && category.target_departments.length > 0) ? category.target_departments : ['kitchen'];

                // Evaluar la receta (Smart Splitter para combos)
                const recipe = (productIngredients || []).filter(pi => pi.product_id === pid);
                if (recipe.length === 0) {
                    orderItemsToInsert.push({
                        order_id: order.id,
                        product_id: pid,
                        quantity: qty,
                        unit_price: price,
                        status: 'pending',
                        tenant_id: tenant?.id,
                        target_departments: catDepts, // fallback a la categoria
                        is_served: false,
                        notes: cartNotes[cartKey] || ''
                    });
                    return;
                }

                const deptsMap: Record<string, string[]> = {};
                recipe.forEach(ri => {
                    const ing = ingredients.find(ingr => ingr.id === ri.ingredient_id);
                    // fallback a la categoria en lugar de kitchen
                    const depts = (ing?.target_departments && ing.target_departments.length > 0) ? ing.target_departments : catDepts;
                    depts.forEach((d: string) => {
                        if (!deptsMap[d]) deptsMap[d] = [];
                        if (ing) deptsMap[d].push(ing.name);
                    });
                });

                const deptsFound = Object.keys(deptsMap);
                if (deptsFound.length <= 1) {
                    orderItemsToInsert.push({
                        order_id: order.id,
                        product_id: pid,
                        quantity: qty,
                        unit_price: price,
                        status: 'pending',
                        tenant_id: tenant?.id,
                        target_departments: deptsFound.length === 1 ? [deptsFound[0]] : catDepts, // fallback a la categoria
                        is_served: false,
                        notes: ''
                    });
                } else {
                    // Multi-departamento REAL: Dividir de forma inteligente (Hamburguesa + Bebida)
                    deptsFound.forEach((d, idx) => {
                        orderItemsToInsert.push({
                            order_id: order.id,
                            product_id: pid,
                            quantity: qty,
                            unit_price: idx === 0 ? price : 0, // Solo el primero lleva el precio del combo
                            status: 'pending',
                            tenant_id: tenant?.id,
                            target_departments: [d],
                            is_served: false,
                            notes: [cartNotes[cartKey], deptsMap[d].join(' + ')].filter(Boolean).join(' - ') // Nombre específico del componente
                        });
                    });
                }
            });

            const { error: itemsError } = await supabase
                .from('order_items')
                .insert(orderItemsToInsert);

            if (itemsError) throw itemsError;

            // Enrutamiento dinámico de notificaciones (Cocina vs Barra)
            const targetRoles = new Set<any>(['admin', 'staff']);
            orderItemsToInsert.forEach(item => {
                if (item.target_departments.includes('kitchen')) targetRoles.add('kitchen');
                if (item.target_departments.includes('bartender') || item.target_departments.includes('bar')) targetRoles.add('bartender');
            });

            addNotification(`Nuevo pedido de ${clientName}`, Array.from(targetRoles), 'info', tenant?.id);
            
            let successAlertMessage = "¡Pedido creado y notificado correctamente!";
            
            if (tenant?.loyalty_enabled === true && (phone.trim() || loyaltyAccount)) {
                const config = tenant.loyalty_config || {};
                const tiers = config.tiers || [];
                let currentTier = loyaltyAccount ? loyaltyAccount.tier : 'bronce';
                let cashbackPct = config.cashback_pct || 5;
                const foundTier = tiers.find((t: any) => t.name === currentTier);
                if (foundTier) {
                    cashbackPct = foundTier.cashback_pct || cashbackPct;
                }
                const earnedCashback = Math.round((finalTotal * (cashbackPct / 100)) * 100) / 100;
                
                // ACREDITAR EN TIEMPO REAL EN SUPABASE (Caja Club Clientes)
                if (earnedCashback > 0) {
                    try {
                        const cleanPhone = phone.trim() || loyaltyAccount?.phone_number || '';
                        const clientNameClean = clientName.trim() || loyaltyAccount?.client_name || 'Cliente';

                        if (loyaltyAccount) {
                            const currentBal = Math.max(0, (parseFloat(loyaltyAccount.balance) || 0) - loyaltyRedemption);
                            const newBal = currentBal + earnedCashback;
                            const newSpent = (parseFloat(loyaltyAccount.total_spent) || 0) + finalTotal;
                            const newOrders = (loyaltyAccount.total_orders || 0) + 1;

                            let nextTier = loyaltyAccount.tier || 'bronce';
                            for (const t of tiers) {
                                if (newOrders >= t.min_orders && newOrders <= t.max_orders) {
                                    nextTier = t.name;
                                    break;
                                }
                            }

                            const mergedName = mergeClientNames(loyaltyAccount.client_name, clientNameClean);
                            await supabase
                                .from('loyalty_accounts')
                                .update({
                                    balance: newBal,
                                    total_spent: newSpent,
                                    total_orders: newOrders,
                                    last_order_date: new Date().toISOString(),
                                    tier: nextTier,
                                    client_name: mergedName
                                })
                                .eq('id', loyaltyAccount.id);
                        } else if (cleanPhone && cleanPhone.length >= 6) {
                            // Verificar si ya existe una cuenta con este mismo teléfono para evitar duplicados
                            const { data: existingList } = await supabase
                                .from('loyalty_accounts')
                                .select('*')
                                .eq('tenant_id', tenant.id);

                            const existing = existingList?.find((a: any) => isSamePhone(a.phone_number, cleanPhone));
                            if (existing) {
                                const newBal = (existing.balance || 0) + earnedCashback;
                                const newSpent = (parseFloat(existing.total_spent) || 0) + finalTotal;
                                const newOrders = (existing.total_orders || 0) + 1;
                                const mergedName = mergeClientNames(existing.client_name, clientNameClean);

                                let nextTier = existing.tier || 'bronce';
                                for (const t of tiers) {
                                    if (newOrders >= t.min_orders && newOrders <= t.max_orders) {
                                        nextTier = t.name;
                                        break;
                                    }
                                }

                                await supabase
                                    .from('loyalty_accounts')
                                    .update({
                                        balance: newBal,
                                        total_spent: newSpent,
                                        total_orders: newOrders,
                                        last_order_date: new Date().toISOString(),
                                        tier: nextTier,
                                        client_name: mergedName
                                    })
                                    .eq('id', existing.id);
                            } else {
                                await supabase
                                    .from('loyalty_accounts')
                                    .insert({
                                        tenant_id: tenant.id,
                                        phone_number: cleanPhone,
                                        client_name: clientNameClean || 'Cliente Frecuente',
                                        balance: earnedCashback,
                                        total_spent: finalTotal,
                                        total_orders: 1,
                                        last_order_date: new Date().toISOString(),
                                        tier: 'bronce'
                                    });
                            }
                        }
                    } catch (accErr) {
                        console.error("Error al acreditar puntos de fidelización en caja:", accErr);
                    }

                    successAlertMessage += `\n\n🎁 ¡Beneficio Club Clientes!\nEl cliente acumuló ${formatARS(earnedCashback)} que podrá canjear a partir de su próxima visita (mañana).\n\nIdentificado con su WhatsApp: ${phone.trim()}`;
                }
            }

            alert(successAlertMessage);

            if (isAfipBilling && tenant?.afip_enabled) {
                try {
                    addNotification(`⏳ Procesando factura AFIP para pedido #${order.order_number || order.id.substring(0,4)}...`, ['staff', 'admin'], 'info', tenant?.id);
                    
                    let docTipo = 99; // 99 = Consumidor Final
                    let docNro = 0;
                    let tipoComprobante = 6;
                    
                    // Si se seleccionó Responsable Inscripto o Monotributista, el CUIT es obligatorio
                    if (afipClientType !== 'consumidor_final') {
                        if (!customerCuit || customerCuit.trim().length < 10) {
                            throw new Error("El CUIT es obligatorio para Responsable Inscripto o Monotributista.");
                        }
                        docTipo = 80; // CUIT
                        docNro = parseInt(customerCuit.replace(/\D/g, ''));
                        
                        const isLocalMonotributista = tenant?.afip_condicion_iva?.toLowerCase().includes('monotribut');
                        if (isLocalMonotributista) {
                            tipoComprobante = 11; // Monotributista siempre hace C
                        } else {
                            if (afipClientType === 'responsable_inscripto' || afipClientType === 'monotributista') {
                                tipoComprobante = 1; // Factura A (RI a RI o a Monotributista por RG 5003/2021)
                            } else {
                                tipoComprobante = 6; // Factura B
                            }
                        }
                    } else {
                        // Si es Consumidor Final
                        const isLocalMonotributista = tenant?.afip_condicion_iva?.toLowerCase().includes('monotribut');
                        tipoComprobante = isLocalMonotributista ? 11 : 6;
                    }

                    const response = await fetch('/api/afip/facturar', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            orderId: order.id,
                            tenantId: tenant.id,
                            docTipo,
                            docNro,
                            tipoComprobante
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
                    alert("El pedido se creó, pero la facturación AFIP falló:\n" + afipErr.message);
                }
            }
            
            
            // Refrescar en tiempo real
            if (tenant?.id) {
                broadcastTenantChange(tenant.id);
            }

            // Llamar al refetch local de inmediato para emular el click en el botón de refrescar
            if (refetchData) {
                refetchData();
            }
        } catch (error: any) {
            console.error(error);
            if (error.message === "offline" || error.code === "PGRST301" || !navigator.onLine) {
                addToQueue({
                    ...orderData,
                    payment_method: selectedPaymentMethod,
                    payment_status: 'pagado',
                    is_approved_for_production: true,
                    delivery_type: 'local',
                    tenant_id: tenant?.id,
                    table_number: null,
                    waiter_name: null
                });
                alert("Sin conexión. El pedido se guardó localmente y se enviará automáticamente al recuperar el Wi-Fi.");
            } else {
                alert("Error al crear el pedido: " + error.message);
            }
        } finally {
            // Reset regardless
            setCart({});
            if (tenant?.id) triggerTrialStart(tenant.id);
            setClientName('');
            setPhone('');
            setSelectedCategoryId(null);
            setShowSummary(false);
            setIsSubmitting(false);
            setUseLoyaltyDiscount(false);
            setLoyaltyTodayEarned(0);
            setLoyaltyAccount(null);
        }
    };

    // Gestionar la entrega física atómica desde la Caja
    const handleToggleItemServed = async (item: any, order: Order) => {
        const newServed = !item.is_served;

        const { error } = await supabase
            .from('order_items')
            .update({ is_served: newServed })
            .eq('id', item.id);

        if (error) {
            alert('Error al actualizar la entrega del plato: ' + error.message);
            return;
        }

        // Crear una notificación elegante local y en Supabase en español
        if (newServed) {
            const prodName = getProductName(item.product_id);
            addNotification(`🚀 Despachado en Caja: Cliente ${order.client_name} - ${item.quantity}x ${prodName}`, ['staff', 'admin'], 'success', order.tenant_id);
            
            // Disparar SMS/WhatsApp automático simulado si tiene teléfono
            if (order.phone_number) {
                const isDelivery = (order as any).delivery_type === 'delivery';
                sendOrderSmsNotification(order, isDelivery ? 'shipped' : 'ready');
            }

            try {
                await supabase.from('app_notifications').insert([{
                    message: `El pedido de ${order.client_name} (#${order.order_number}) fue entregado en Caja`,
                    type: 'success',
                    target_roles: ['staff', 'admin'],
                    tenant_id: order.tenant_id
                }]);
            } catch (err) {
                console.error("Error al registrar notificación de despacho:", err);
            }
        }

        // Si todos los ítems de esta orden sin mesa han sido servidos y preparados,
        // podemos marcar la orden como completada o archivada para limpiar la interfaz.
        // Pero sólo lo hacemos tras validar.
        const { data: allItems } = await supabase
            .from('order_items')
            .select('is_served, status')
            .eq('order_id', order.id);

        if (allItems && allItems.length > 0 && allItems.every(i => i.is_served)) {
            // Regla: Autoarchivar y completar al 100% de inmediato SOLO si ya está pagado
            if (order.payment_status === 'pagado') {
                const { error: orderError } = await supabase
                    .from('orders')
                    .update({ status: 'completed', is_archived: true })
                    .eq('id', order.id);

                if (!orderError) {
                    addNotification(`📦 Despacho finalizado: Pedido de ${order.client_name} #${order.order_number} completamente entregado y cobrado`, ['staff', 'admin'], 'success', order.tenant_id);
                }
            }
        }

        // Difundir cambios en tiempo real
        if (order.tenant_id) {
            broadcastTenantChange(order.tenant_id);
        }
        if (refetchData) refetchData();
    };

    // Filtrar órdenes activas para la sección de entregas (Doble pestaña de Trazabilidad)
    const pendingOrdersForDeliveries = orders.filter(o => {
        if (o.status === 'completed' || o.is_archived) return false;

        const isPaid = o.payment_status === 'pagado';
        const isDelivered = o.status === 'delivered';
        const allItemsServed = o.items?.every((item: any) => item.is_served) ?? true;
        
        // REGLA FASE 3: Si está pago Y completamente entregado/servido, desaparece de pendientes automáticamente.
        if (isPaid && isDelivered && allItemsServed) return false;

        return true;
    });

    const completedOrdersForDeliveries = orders.filter(o => {
        const isPaid = o.payment_status === 'pagado';
        const isDelivered = o.status === 'delivered';
        const allItemsServed = o.items?.every((item: any) => item.is_served) ?? true;
        const isFullyCompleted = isPaid && isDelivered && allItemsServed;

        if (!(o.is_archived || o.status === 'completed' || isFullyCompleted)) return false;

        // Regla: Solo comandas completadas del día actual para evitar saturación del historial
        const orderDate = new Date(o.created_at);
        const today = new Date();
        return (
            orderDate.getDate() === today.getDate() &&
            orderDate.getMonth() === today.getMonth() &&
            orderDate.getFullYear() === today.getFullYear()
        );
    });

    const activeOrdersForDeliveries = pendingOrdersForDeliveries; // Para mantener compatibilidad con contadores existentes

    // Generar un ID temporal para las órdenes offline en UI
    const pendingSyncOrders = queue.map(qo => ({
        id: qo.id,
        order_number: 'LOCAL',
        client_name: qo.client_name,
        phone_number: qo.phone_number,
        total_price: qo.total_price,
        status: 'pending',
        payment_method: qo.payment_method || 'efectivo',
        payment_status: qo.payment_status || 'pagado',
        is_approved_for_production: qo.is_approved_for_production,
        table_number: qo.table_number,
        waiter_name: qo.waiter_name,
        created_at: qo.created_at,
        is_archived: false,
        tenant_id: qo.tenant_id,
        items: qo.items.map(qi => ({
            id: Math.random().toString(),
            product_id: qi.product_id,
            quantity: qi.quantity,
            unit_price: qi.unit_price,
            status: 'pending',
            is_served: false,
            target_departments: ['kitchen']
        }))
    })) as unknown as Order[];

    const allDisplayOrders = [...pendingSyncOrders, ...activeOrdersForDeliveries];

    if (showSummary) {
        return (
            <div className="glass rounded-[2.5rem] p-8 space-y-6 animate-in zoom-in-95">
                <h2 className="text-2xl font-black text-orange-500 uppercase italic">Revisar Pedido</h2>
                <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                    {Object.entries(cart).map(([cartKey, qty]) => {
                        const [id, optId] = cartKey.split("::");
                        const p = products.find(item => item.id === id);
                        const optIng = optId ? ingredients.find(ing => ing.id === optId) : null;
                        const note = cartNotes[cartKey];
                        return (
                            <div key={cartKey} className={`flex flex-col gap-2 p-3 rounded-2xl ${isLight ? 'bg-slate-50 border border-slate-100' : 'bg-slate-900/50'}`}>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <span className="font-bold text-sm"><span className="text-orange-500">{qty}x</span> {p?.name}</span>
                                        {optIng && (
                                            <p className="text-xs font-bold text-orange-400 mt-0.5">
                                                ⭐ Opción: {optIng.name}
                                            </p>
                                        )}
                                        {note && (
                                            <p className="text-[11px] text-slate-400 italic mt-0.5">
                                                💬 {note}
                                            </p>
                                        )}
                                    </div>
                                    <span className="font-black text-sm">{formatARS(getProductFinalPrice(id) * qty)}</span>
                                </div>
                                <div className="flex items-center justify-end gap-2 mt-1">
                                    <button onClick={() => removeFromCart(cartKey)} className={`w-7 h-7 rounded-lg flex items-center justify-center font-black transition-all ${isLight ? 'bg-slate-200 text-slate-700 hover:bg-slate-300' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>-</button>
                                    <span className="text-xs font-bold w-4 text-center">{qty}</span>
                                    <button onClick={() => addToCart(cartKey, true)} className={`w-7 h-7 rounded-lg flex items-center justify-center font-black transition-all ${isLight ? 'bg-slate-200 text-slate-700 hover:bg-slate-300' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>+</button>
                                    <button onClick={() => {
                                        setCart(prev => {
                                            const { [cartKey]: _, ...rest } = prev;
                                            return rest;
                                        });
                                    }} className="w-7 h-7 ml-2 rounded-lg flex items-center justify-center transition-all bg-red-500/10 text-red-500 hover:bg-red-500/20">
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div className="pt-4 border-t border-slate-700 flex justify-between items-end">
                    <span className="text-slate-400 font-bold uppercase text-xs">Total</span>
                    <div className="text-right">
                        {useLoyaltyDiscount && loyaltyAccount && tenant?.loyalty_enabled === true && (() => {
                            const totalBalance = parseFloat(loyaltyAccount.balance) || 0;
                            const canRedeemAmount = Math.max(0, totalBalance - loyaltyTodayEarned);
                            const loyaltyRedemption = Math.min(canRedeemAmount, totalPrice);
                            return (
                                <>
                                    <span className="text-xs text-slate-500 line-through font-mono block">
                                        {formatARS(totalPrice)}
                                    </span>
                                    <span className="text-3xl font-black text-emerald-400">
                                        {formatARS(totalPrice - loyaltyRedemption)}
                                    </span>
                                </>
                            );
                        })() || (
                            <span className="text-3xl font-black text-white">{formatARS(totalPrice)}</span>
                        )}
                    </div>
                </div>
                {/* Datos del Cliente dentro de la vista de desglose final */}
                <div className="space-y-3 pt-3 border-t border-slate-800/60">
                    <span className="text-slate-400 font-bold uppercase text-[9px] tracking-widest block">Datos del Cliente</span>
                    <input
                        type="text" placeholder="NOMBRE DEL CLIENTE *" value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        className={`w-full border rounded-2xl py-3 px-5 font-black uppercase outline-none focus:border-orange-500 transition-all ${
                            isLight 
                                ? 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-slate-50/20' 
                                : 'bg-slate-900/80 border-slate-800 text-white placeholder:text-slate-650 focus:bg-slate-900'
                        }`}
                    />
                    <div className="relative">
                        <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                        <input
                            type="tel" placeholder="WhatsApp (Opcional)" value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className={`w-full border rounded-2xl py-2.5 pl-11 text-xs font-bold outline-none focus:border-orange-500 transition-all ${
                                isLight 
                                ? 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-slate-50/20' 
                                : 'bg-slate-900/80 border-slate-800 text-white placeholder:text-slate-650 focus:bg-slate-900'
                            }`}
                        />
                    </div>

                    {loyaltyAccount && tenant?.loyalty_enabled === true && (() => {
                        const config = tenant?.loyalty_config || {};
                        const redeemChannel = config.redeem_channel || 'both';
                        const isSalonAllowed = redeemChannel === 'both' || redeemChannel === 'salon';
                        if (!isSalonAllowed) return null;

                        const totalBalance = parseFloat(loyaltyAccount.balance) || 0;
                        const canRedeemAmount = Math.max(0, totalBalance - loyaltyTodayEarned);
                        const todayLockedAmount = Math.min(totalBalance, loyaltyTodayEarned);

                        if (totalBalance <= 0) return null;

                        return (
                            <div className="bg-orange-500/10 border border-orange-500/30 p-4 rounded-[2rem] text-left space-y-2.5 animate-in slide-in-from-bottom-2 duration-300">
                                <div className="flex justify-between items-center">
                                    <span className="text-[9px] font-black uppercase text-orange-400 flex items-center gap-1.5">
                                        🎁 Monedero Club Clientes (Nivel {loyaltyAccount.tier.toUpperCase()})
                                    </span>
                                    <span className="text-xs font-black text-orange-400 font-mono">
                                        {formatARS(totalBalance)}
                                    </span>
                                </div>

                                {canRedeemAmount > 0 ? (
                                    <>
                                        <p className="text-[8.5px] text-slate-300 font-bold uppercase leading-normal">
                                            Disponible de visitas anteriores: <span className="text-emerald-400 font-black">{formatARS(canRedeemAmount)}</span>
                                        </p>
                                        {todayLockedAmount > 0 && (
                                            <p className="text-[7.5px] text-amber-400/90 font-bold uppercase leading-tight bg-amber-500/10 border border-amber-500/20 p-2 rounded-xl">
                                                🔒 +{formatARS(todayLockedAmount)} acumulados hoy (activables a partir de mañana / próxima visita).
                                            </p>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => setUseLoyaltyDiscount(!useLoyaltyDiscount)}
                                            className={`w-full py-2.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all active:scale-95 flex items-center justify-center gap-1.5 ${
                                                useLoyaltyDiscount
                                                    ? 'bg-orange-500 text-slate-950 shadow-lg shadow-orange-500/30 font-black'
                                                    : 'bg-slate-950 border border-slate-850 text-slate-400 hover:text-white'
                                            }`}
                                        >
                                            {useLoyaltyDiscount 
                                                ? `✓ Descontando ${formatARS(Math.min(canRedeemAmount, totalPrice))}` 
                                                : `Descontar Saldo Disponible (${formatARS(canRedeemAmount)})`}
                                        </button>
                                    </>
                                ) : (
                                    <div className="bg-slate-950/60 border border-amber-500/30 p-3 rounded-2xl space-y-1.5">
                                        <div className="flex items-center gap-1.5 text-amber-400 text-[10px] font-black uppercase">
                                            <span>⏳</span>
                                            <span>Disponible para la próxima visita</span>
                                        </div>
                                        <p className="text-[8px] text-slate-300 font-bold leading-relaxed">
                                            Los <span className="text-amber-400 font-black">{formatARS(todayLockedAmount)}</span> acumulados en el día de hoy estarán disponibles para canjear a partir de mañana o en su próxima visita.
                                        </p>
                                    </div>
                                )}
                            </div>
                        );
                    })()}
                </div>
                {/* Selector de Método de Pago Nativo */}
                <div className="space-y-2 pt-3 border-t border-slate-800/60">
                    <span className="text-slate-400 font-bold uppercase text-[9px] tracking-widest block">Método de Pago</span>
                    <div className="grid grid-cols-3 gap-2">
                        {(['efectivo', 'debito', 'credito', 'rappi', 'pedidosya'] as const).map((method) => (
                            <button
                                key={method}
                                type="button"
                                onClick={() => setSelectedPaymentMethod(method)}
                                className={`py-3 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all border ${
                                    selectedPaymentMethod === method
                                        ? method === 'rappi' ? 'bg-orange-500 text-slate-950 border-orange-450' 
                                        : method === 'pedidosya' ? 'bg-red-600 text-white border-red-500'
                                        : 'bg-orange-500 text-slate-950 border-orange-450'
                                        : (isLight ? 'bg-slate-100 text-slate-650 border-slate-200' : 'bg-slate-900 text-slate-400 border-slate-850 hover:text-white')
                                }`}
                            >
                                {method === 'efectivo' ? '💵 Efectivo' : method === 'debito' ? '💳 Débito' : method === 'credito' ? '💳 Crédito' : method === 'rappi' ? '🎒 Rappi' : '🎒 PedidosYa'}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2">
                    <button 
                        onClick={() => setShowSummary(false)} 
                        className={`col-span-1 py-4 font-black rounded-2xl text-[9px] uppercase tracking-wider transition-all border ${
                            isLight 
                                ? 'bg-slate-100 hover:bg-slate-250 border-slate-200 text-slate-650' 
                                : 'bg-slate-800 text-slate-400 border-transparent hover:text-white'
                        }`}
                    >
                        Volver
                    </button>
                    <button
                        disabled={isSubmitting}
                        onClick={() => handleFinish(false)}
                        className="col-span-2 py-4 bg-orange-600 hover:bg-orange-500 text-white font-black rounded-2xl shadow-xl text-[11px] uppercase tracking-widest active:scale-95 transition-all disabled:opacity-50"
                    >
                        {isSubmitting ? 'Enviando...' : 'Confirmar Cobro'}
                    </button>
                </div>

                {(tenant as any)?.afip_enabled && (
                    <div className={`mt-2 pt-3 border-t space-y-2 opacity-75 hover:opacity-100 transition-opacity ${
                        isLight ? 'border-slate-200/80' : 'border-slate-800/60'
                    }`}>
                        <span className="text-slate-400 font-bold uppercase text-[8px] tracking-widest block">Opciones AFIP (Opcional)</span>
                        <div className="grid grid-cols-3 gap-1">
                            <button
                                type="button"
                                onClick={() => {
                                    setAfipClientType('consumidor_final');
                                    setCustomerCuit('');
                                }}
                                className={`py-1.5 rounded-lg transition-all border flex flex-col items-center justify-center gap-0.5 ${
                                    afipClientType === 'consumidor_final'
                                        ? 'bg-slate-700 text-white border-slate-600 shadow-sm'
                                        : (isLight ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-slate-900/50 text-slate-500 border-slate-800 hover:text-slate-300')
                                }`}
                            >
                                <span className="text-[7px] font-black uppercase tracking-wider">Cons. Final</span>
                                <span className={`text-[6px] font-bold ${afipClientType === 'consumidor_final' ? 'text-slate-300' : 'text-slate-500/80'}`}>Factura {(tenant as any)?.afip_condicion_iva?.toLowerCase().includes('monotribut') ? 'C' : 'B'}</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setAfipClientType('monotributista')}
                                className={`py-1.5 rounded-lg transition-all border flex flex-col items-center justify-center gap-0.5 ${
                                    afipClientType === 'monotributista'
                                        ? 'bg-slate-700 text-white border-slate-600 shadow-sm'
                                        : (isLight ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-slate-900/50 text-slate-500 border-slate-800 hover:text-slate-300')
                                }`}
                            >
                                <span className="text-[7px] font-black uppercase tracking-wider">Monotributo</span>
                                <span className={`text-[6px] font-bold ${afipClientType === 'monotributista' ? 'text-slate-300' : 'text-slate-500/80'}`}>Factura {(tenant as any)?.afip_condicion_iva?.toLowerCase().includes('monotribut') ? 'C' : 'A'}</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setAfipClientType('responsable_inscripto')}
                                className={`py-1.5 rounded-lg transition-all border flex flex-col items-center justify-center gap-0.5 ${
                                    afipClientType === 'responsable_inscripto'
                                        ? 'bg-slate-700 text-white border-slate-600 shadow-sm'
                                        : (isLight ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-slate-900/50 text-slate-500 border-slate-800 hover:text-slate-300')
                                }`}
                            >
                                <span className="text-[7px] font-black uppercase tracking-wider">Resp. Inscripto</span>
                                <span className={`text-[6px] font-bold ${afipClientType === 'responsable_inscripto' ? 'text-slate-300' : 'text-slate-500/80'}`}>Factura {(tenant as any)?.afip_condicion_iva?.toLowerCase().includes('monotribut') ? 'C' : 'A'}</span>
                            </button>
                        </div>
                        
                        <div className="pt-1 animate-in slide-in-from-top-2 duration-255">
                            <input
                                type="text"
                                placeholder={afipClientType === 'consumidor_final' ? "DNI / CUIT *" : "CUIT *"}
                                value={customerCuit}
                                onChange={(e) => setCustomerCuit(e.target.value)}
                                className={`w-full border rounded-lg py-1.5 px-3 text-[10px] font-bold outline-none transition-all ${
                                    isLight 
                                        ? 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-slate-400' 
                                        : 'bg-slate-900/50 border-slate-800 text-white placeholder:text-slate-600 focus:border-slate-600'
                                }`}
                            />
                        </div>

                        <button
                            disabled={isSubmitting}
                            onClick={() => handleFinish(true)}
                            className={`w-full py-2.5 font-bold rounded-xl text-[9px] uppercase tracking-wider shadow-sm active:scale-95 transition-all disabled:opacity-50 ${
                                isLight ? 'bg-slate-200 hover:bg-slate-300 text-slate-700' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                            }`}
                        >
                            {isSubmitting ? 'Facturando...' : 'Cobrar con Factura AFIP'}
                        </button>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className={`space-y-6 transition-colors duration-500 ${isLight ? 'text-slate-900' : 'text-white'}`}>
            {/* Selector Premium Superior de Subpestañas */}
            <div className={`flex justify-center p-1 border rounded-2xl max-w-lg mx-auto shadow-inner transition-colors ${
                isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-950/80 border-white/5'
            }`}>
                <button
                    onClick={() => setSubTab('new_order')}
                    className={`flex-1 py-3.5 rounded-xl font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all ${
                        subTab === 'new_order'
                            ? 'bg-orange-500 text-slate-950 shadow-md scale-100 font-black'
                            : (isLight ? 'text-slate-500 hover:text-slate-850' : 'text-slate-400 hover:text-white')
                    }`}
                >
                    <ClipboardList size={13} /> Registrar Pedido
                </button>
                <button
                    onClick={() => setSubTab('deliveries')}
                    className={`flex-1 py-3.5 rounded-xl font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all ${
                        subTab === 'deliveries'
                            ? 'bg-orange-500 text-slate-950 shadow-md scale-100 font-black'
                            : (isLight ? 'text-slate-500 hover:text-slate-850' : 'text-slate-400 hover:text-white')
                    }`}
                >
                    <CheckCircle2 size={13} /> Entregas
                    {activeOrdersForDeliveries.length > 0 && (
                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full shrink-0 ${
                            subTab === 'deliveries' ? 'bg-slate-950 text-orange-400' : 'bg-orange-500 text-slate-950'
                        }`}>
                            {activeOrdersForDeliveries.length}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setSubTab('reservations')}
                    className={`flex-1 py-3.5 rounded-xl font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all ${
                        subTab === 'reservations'
                            ? 'bg-orange-500 text-slate-950 shadow-md scale-100 font-black'
                            : (isLight ? 'text-slate-500 hover:text-slate-850' : 'text-slate-400 hover:text-white')
                    }`}
                >
                    <Calendar size={13} /> Reservas
                    {calendarReservations.filter(r => r.status === 'confirmed' || r.status === 'pending_payment').length > 0 && (
                        <span className={`w-1.5 h-1.5 rounded-full ${subTab === 'reservations' ? 'bg-slate-950' : 'bg-orange-500 animate-pulse'}`}></span>
                    )}
                </button>
            </div>

            {subTab === 'new_order' ? (
                /* Pestaña: REGISTRAR NUEVO PEDIDO (Mantiene la funcionalidad existente al 100%) */
                <div className="space-y-6">
                    {/* Aviso de Modo Caja / Fuera de Horario */}
                    {!checkIsCurrentlyOpen(tenant?.business_hours) && (
                        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3.5 flex items-center gap-3 animate-in fade-in">
                            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 shrink-0">
                                <Clock size={16} />
                            </div>
                            <div>
                                <p className="text-xs font-black text-amber-400 uppercase tracking-wide">
                                    Modo Caja Habilitado (Fuera de Horario)
                                </p>
                                <p className="text-[10px] text-slate-400">
                                    El menú web y de mesas se encuentran bloqueados por horario. Como cajero, tienes acceso exclusivo para registrar pedidos presenciales libremente.
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="space-y-3">
                        <input
                            type="text" placeholder="NOMBRE DEL CLIENTE *" value={clientName}
                            onChange={(e) => setClientName(e.target.value)}
                            className={`w-full border rounded-2xl py-4 px-6 font-black uppercase outline-none focus:border-orange-500 transition-all ${
                                isLight ? 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-450 focus:bg-slate-50/20' : 'bg-slate-900 border-slate-800 text-white placeholder:text-slate-600 focus:bg-slate-900'
                            }`}
                        />
                        <div className="relative">
                            <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                            <input
                                type="tel" placeholder="WhatsApp (Opcional)" value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                className={`w-full border rounded-2xl py-3 pl-12 text-sm font-bold outline-none focus:border-orange-500 transition-all ${
                                    isLight ? 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-450 focus:bg-slate-50/20' : 'bg-slate-900 border-slate-800 text-white placeholder:text-slate-650 focus:bg-slate-900'
                                }`}
                            />
                        </div>
                        {(tenant as any)?.afip_enabled && (
                            <input
                                type="text" placeholder="CUIT DEL CLIENTE (OPCIONAL PARA FACTURA A)" value={customerCuit}
                                onChange={(e) => setCustomerCuit(e.target.value)}
                                className={`w-full border rounded-2xl py-3 px-6 text-xs font-bold uppercase outline-none focus:border-blue-500 transition-all ${
                                    isLight 
                                        ? 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-blue-50/20' 
                                        : 'bg-slate-900 border-slate-800 text-white placeholder:text-slate-650 focus:bg-slate-900'
                                }`}
                            />
                        )}
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

                    {/* CONTENEDOR STICKY: BUSCADOR Y CATEGORÍAS SIEMPRE VISIBLES EN PANTALLA */}
                    <div className={`sticky top-0 z-30 pt-3 pb-2 -mx-4 px-4 sm:-mx-6 sm:px-6 backdrop-blur-2xl border-b transition-all duration-200 shadow-sm ${
                        isLight 
                            ? 'bg-slate-50/95 border-slate-200/80 shadow-slate-200/50' 
                            : 'bg-slate-950/95 border-white/5 shadow-black/40'
                    }`}>
                        {/* Buscador de productos con voz */}
                        <div className="relative mb-2.5 flex items-center gap-2">
                            <div className="relative flex-1">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 opacity-50">
                                    <Search size={16} />
                                </div>
                                <input
                                    type="text"
                                    placeholder="Buscar productos (ej. combo hamburguesa)..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className={`w-full rounded-2xl py-2.5 pl-10 pr-10 text-xs font-bold outline-none transition-all shadow-sm border ${
                                        isLight 
                                            ? 'bg-white border-slate-200 text-slate-900 focus:border-orange-500' 
                                            : 'bg-slate-900 border-slate-800 text-white focus:border-orange-500'
                                    }`}
                                />
                                {searchQuery && (
                                    <button onClick={() => setSearchQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100">
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                            <button
                                onClick={handleVoiceSearch}
                                className={`h-9 w-9 shrink-0 rounded-2xl flex items-center justify-center transition-all shadow-sm border ${
                                    isListening 
                                        ? 'bg-red-500 text-white border-red-500 animate-pulse' 
                                        : isLight 
                                            ? 'bg-white text-slate-700 border-slate-200 hover:border-orange-500 hover:text-orange-500' 
                                            : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-orange-500 hover:text-orange-500'
                                }`}
                                title="Búsqueda por voz"
                            >
                                <Mic size={16} className={isListening ? 'animate-bounce' : ''} />
                            </button>
                        </div>

                        {/* Barra Superior de Categorías Compactas */}
                        <div className="flex items-center gap-2 overflow-x-auto pb-1.5 pt-0.5 scrollbar-hide -mx-2 px-2 snap-x">
                            {/* Botón Todo el Menú */}
                            <button
                                onClick={() => {
                                    setSearchQuery('');
                                    setSelectedCategoryId(null);
                                }}
                                className={`snap-start shrink-0 px-4 py-2 rounded-2xl text-xs font-bold transition-all duration-200 flex items-center gap-1.5 border active:scale-95 ${
                                    !selectedCategoryId && !searchQuery
                                        ? (isLight ? 'bg-slate-900 text-white border-slate-900 shadow-md shadow-slate-200/50 scale-105' : 'bg-white text-slate-900 border-white shadow-[0_0_18px_rgba(255,255,255,0.25)] scale-105')
                                        : (isLight ? 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300' : 'bg-slate-900/80 text-slate-300 border-slate-800 hover:border-slate-700')
                                }`}
                            >
                                <span>⭐</span>
                                <span>Todo el Menú</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                                    !selectedCategoryId && !searchQuery
                                        ? (isLight ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-900')
                                        : (isLight ? 'bg-slate-100 text-slate-600' : 'bg-slate-800 text-slate-400')
                                }`}>
                                    {products.filter(p => p.is_active !== false).length}
                                </span>
                            </button>

                            {/* Botón Especial: 🔥 Ofertas Especiales */}
                            <button
                                onClick={() => {
                                    setSearchQuery('');
                                    setSelectedCategoryId(prev => prev === 'offers' ? null : 'offers');
                                }}
                                className={`snap-start shrink-0 px-4 py-2 rounded-2xl text-xs font-black transition-all duration-300 flex items-center gap-2 border active:scale-95 ${
                                    selectedCategoryId === 'offers' && !searchQuery
                                        ? 'bg-gradient-to-r from-orange-500 via-red-500 to-purple-600 text-white border-transparent shadow-[0_0_20px_rgba(249,115,22,0.5)] scale-105 animate-pulse'
                                        : 'bg-gradient-to-r from-orange-500/15 via-red-500/15 to-purple-600/15 text-orange-400 border-orange-500/30 hover:border-orange-500/50 hover:scale-102'
                                }`}
                            >
                                <span className={selectedCategoryId === 'offers' ? 'animate-bounce' : ''}>🔥</span>
                                <span>Ofertas Especiales</span>
                                {activeOffersCount > 0 && (
                                    <span className="text-[9px] px-1.5 py-0.5 rounded-md uppercase font-black tracking-tighter bg-white text-red-600 shadow-sm animate-pulse">
                                        {activeOffersCount} ¡Aprovechá!
                                    </span>
                                )}
                            </button>

                            {/* Categorías registradas (excluyendo ofertas especiales ya mostradas en el botón superior) */}
                            {categories
                                .filter(cat => !(cat.is_offer === true || /oferta|oportunidad|descuento/i.test(cat.name)))
                                .map(cat => {
                                    const isSelected = selectedCategoryId === cat.id && !searchQuery;
                                    return (
                                        <button
                                            key={cat.id}
                                            onClick={() => {
                                                setSearchQuery('');
                                                setSelectedCategoryId(prev => prev === cat.id ? null : cat.id);
                                            }}
                                            className={`snap-start shrink-0 px-4 py-2 rounded-2xl text-xs font-bold transition-all duration-200 flex items-center gap-1.5 border active:scale-95 ${
                                                isSelected
                                                    ? (isLight ? 'bg-orange-500 text-white border-orange-500 shadow-md shadow-orange-500/20 scale-105' : 'bg-orange-500 text-white border-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.3)] scale-105')
                                                    : (isLight ? 'bg-white text-slate-700 border-slate-200 hover:border-orange-500/30 hover:bg-slate-50' : 'bg-slate-900/80 text-slate-300 border-slate-800 hover:border-orange-500/30')
                                            }`}
                                        >
                                            <span className={isSelected ? 'animate-bounce' : ''}>{cat.icon || '🍽️'}</span>
                                            <span>{cat.name}</span>
                                        </button>
                                    );
                                })}
                        </div>
                    </div>

                    <div className="space-y-3">

                        {/* Encabezado contextual dinámico de la lista de productos */}
                        <div className="flex items-center justify-between px-1 pt-1 pb-0.5">
                            <div className="flex items-center gap-2">
                                {searchQuery ? (
                                    <span className="text-xs font-black uppercase text-orange-500 flex items-center gap-1.5">
                                        <Search size={14} />
                                        Búsqueda global: "{searchQuery}" ({displayedProducts.length})
                                    </span>
                                ) : selectedCategoryId === 'offers' ? (
                                    <span className="text-xs font-black uppercase text-purple-400 flex items-center gap-1.5">
                                        <Flame size={14} className="text-red-500 fill-red-500" />
                                        Ofertas Especiales Activas ({displayedProducts.length})
                                    </span>
                                ) : selectedCategoryId ? (
                                    <span className="text-xs font-black uppercase flex items-center gap-1.5" style={{ color: tenant?.theme_colors?.primary || '#f97316' }}>
                                        <span>{categories.find(c => c.id === selectedCategoryId)?.icon || '🍽️'}</span>
                                        Categoría: {categories.find(c => c.id === selectedCategoryId)?.name || 'Seleccionada'} ({displayedProducts.length})
                                    </span>
                                ) : (
                                    <span className={`text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                                        <Flame size={13} className="text-amber-500 fill-amber-500" />
                                        Todos los productos ({displayedProducts.length}) • Ordenados por Top Ventas
                                    </span>
                                )}
                            </div>

                            {(searchQuery || selectedCategoryId) && (
                                <button
                                    onClick={() => {
                                        setSearchQuery('');
                                        setSelectedCategoryId(null);
                                    }}
                                    className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg border transition-all flex items-center gap-1 ${
                                        isLight 
                                            ? 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200' 
                                            : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                                    }`}
                                >
                                    <X size={12} />
                                    Ver Todo
                                </button>
                            )}
                        </div>
                    </div>

                    {/* GRILLA UNIFICADA DE PRODUCTOS (Estilo Menú del Cliente, Orden Top Ventas) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 animate-in fade-in duration-300">
                        {displayedProducts.map(product => {
                            const qty = getProductCartQty(product.id);
                            const activeOffer = getActiveOfferForProduct(product.id);
                            const originalPrice = product.price;
                            const finalPrice = activeOffer
                                ? Math.round(originalPrice * (1 - activeOffer.discount_percentage / 100))
                                : originalPrice;
                            const salesCount = productSalesMap[product.id] || 0;

                            return (
                                <div
                                    key={product.id}
                                    onClick={(e) => addToCart(product.id, false, e)}
                                    className={`group rounded-2xl overflow-hidden transition-all duration-300 flex cursor-pointer hover:shadow-lg hover:-translate-y-0.5 border select-none ${
                                        qty > 0
                                            ? 'border-orange-500/80 bg-orange-500/5 shadow-md shadow-orange-500/10'
                                            : isLight
                                                ? 'bg-white border-slate-200/80 shadow-sm hover:shadow-md hover:border-slate-300'
                                                : 'glass border-white/5 hover:border-white/15'
                                    }`}
                                >
                                    {/* Imagen (1/3 de ancho) */}
                                    <div className={`w-28 sm:w-32 shrink-0 min-h-[110px] relative overflow-hidden ${isLight ? 'bg-slate-100' : 'bg-neutral-800/80'}`}>
                                        {product.image_url ? (
                                            <img
                                                src={product.image_url}
                                                alt={product.name}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-neutral-800 to-neutral-900">
                                                <Utensils className="w-8 h-8 text-neutral-600" />
                                            </div>
                                        )}
                                        {/* Overlay gradient sutil */}
                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/20" />

                                        {/* Badges sobre la imagen */}
                                        {activeOffer ? (
                                            <div className="absolute top-1.5 left-1.5 bg-gradient-to-r from-red-600 to-purple-600 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-md shadow-md border border-white/20">
                                                -{activeOffer.discount_percentage}% OFF
                                            </div>
                                        ) : salesCount > 0 ? (
                                            <div className="absolute top-1.5 left-1.5 bg-black/75 backdrop-blur-sm text-amber-400 text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md flex items-center gap-0.5 border border-amber-400/20 shadow-sm">
                                                <Flame size={10} className="fill-amber-400" />
                                                <span>Top</span>
                                            </div>
                                        ) : null}
                                    </div>

                                    {/* Contenido de la Tarjeta */}
                                    <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
                                        <div>
                                            <h3 className={`font-black text-xs sm:text-sm line-clamp-2 leading-snug transition-colors ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                                {product.name}
                                            </h3>
                                            {product.description && (
                                                <p className={`text-[11px] line-clamp-1 mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                                                    {product.description}
                                                </p>
                                            )}
                                        </div>

                                        <div className="flex items-end justify-between gap-2 mt-2">
                                            {/* Precios */}
                                            <div>
                                                {activeOffer ? (
                                                    <div className="flex flex-col">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="font-black text-sm sm:text-base text-purple-500 dark:text-purple-400">
                                                                {formatARS(finalPrice)}
                                                            </span>
                                                        </div>
                                                        <span className="text-[10px] text-slate-400 line-through font-bold">
                                                            {formatARS(originalPrice)}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="font-black text-sm sm:text-base text-orange-500">
                                                        {formatARS(originalPrice)}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Botón + o Stepper si ya está agregado */}
                                            <div onClick={(e) => e.stopPropagation()}>
                                                {qty > 0 ? (
                                                    <div className={`flex items-center gap-1.5 p-1 rounded-xl border ${
                                                        isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-950/70 border-white/10'
                                                    }`}>
                                                        <button
                                                            onClick={() => handleRemoveProductFromCart(product.id)}
                                                            className="w-7 h-7 rounded-lg bg-red-500/20 text-red-500 hover:bg-red-500 hover:text-white flex items-center justify-center transition-colors font-black active:scale-95"
                                                            title="Quitar uno"
                                                        >
                                                            <Minus size={13} />
                                                        </button>
                                                        <span className={`font-black text-xs min-w-[1.25rem] text-center ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                                            {qty}
                                                        </span>
                                                        <button
                                                            onClick={(e) => addToCart(product.id, false, e)}
                                                            className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500 hover:text-white flex items-center justify-center transition-colors font-black active:scale-95"
                                                            title="Sumar uno"
                                                        >
                                                            <Plus size={13} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={(e) => addToCart(product.id, false, e)}
                                                        className="w-8 h-8 rounded-xl bg-orange-500 hover:bg-orange-600 active:scale-90 text-white flex items-center justify-center shadow-md shadow-orange-500/25 transition-all"
                                                        title="Agregar al pedido"
                                                    >
                                                        <Plus size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        {/* Estado vacío si no hay coincidencias */}
                        {displayedProducts.length === 0 && (
                            <div className={`col-span-full py-12 text-center rounded-3xl border border-dashed p-8 ${
                                isLight ? 'bg-slate-50 border-slate-300 text-slate-500' : 'bg-slate-900/40 border-slate-800 text-slate-400'
                            }`}>
                                <AlertCircle className="mx-auto mb-3 opacity-30" size={40} />
                                <p className="text-sm font-black uppercase tracking-wider">
                                    {searchQuery ? `No se encontraron productos para "${searchQuery}"` : 'No hay productos en esta selección'}
                                </p>
                                <button
                                    onClick={() => {
                                        setSearchQuery('');
                                        setSelectedCategoryId(null);
                                    }}
                                    className="mt-4 px-4 py-2 rounded-xl bg-orange-500 text-white text-xs font-black uppercase tracking-wider hover:bg-orange-600 transition-colors shadow-md shadow-orange-500/20 active:scale-95"
                                >
                                    Ver Todo el Menú
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Clones voladores hacia el carrito de caja */}
                    {flyingProducts.length > 0 && (
                        <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
                            {flyingProducts.map((flying) => {
                                const dx = flying.targetX - flying.startX;
                                const dy = flying.targetY - flying.startY;

                                return (
                                    <div
                                        key={flying.id}
                                        className="absolute animate-fly-to-cart flex items-center justify-center pointer-events-none"
                                        style={{
                                            left: `${flying.startX - 28}px`,
                                            top: `${flying.startY - 28}px`,
                                            width: '56px',
                                            height: '56px',
                                            '--target-x': `${dx}px`,
                                            '--target-y': `${dy}px`,
                                        } as React.CSSProperties}
                                    >
                                        <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-orange-400 shadow-[0_10px_25px_rgba(0,0,0,0.6)] ring-4 ring-orange-400/40 bg-neutral-900 flex items-center justify-center">
                                            {flying.imageUrl ? (
                                                <img
                                                    src={flying.imageUrl}
                                                    alt={flying.name}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <span className="text-2xl">🍔</span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {totalPrice > 0 && (
                        <div 
                            ref={cartButtonRef}
                            className="fixed bottom-24 md:bottom-28 left-1/2 -translate-x-1/2 z-[60] animate-in slide-in-from-bottom-8 w-full max-w-md px-4 pointer-events-none flex gap-2.5"
                        >
                            {selectedCategoryId !== null && (
                                <button
                                    onClick={() => setSelectedCategoryId(null)}
                                    className={`py-4 px-4 rounded-[1.75rem] font-black uppercase text-[10px] tracking-wider transition-all active:scale-95 flex items-center justify-center gap-1 shadow-xl border pointer-events-auto shrink-0 ${
                                        isLight 
                                            ? 'bg-slate-200 border-slate-350 text-slate-700 hover:bg-slate-300' 
                                            : 'bg-slate-900 border-white/10 text-slate-300 hover:bg-slate-800'
                                    }`}
                                >
                                    ⭐ Ver Todo
                                </button>
                            )}

                            <button
                                onClick={() => setShowSummary(true)}
                                className={`flex-1 flex justify-between items-center px-5 py-4 md:py-4.5 rounded-[1.75rem] shadow-2xl backdrop-blur-md transition-all duration-300 md:hover:scale-[1.03] active:scale-[0.97] pointer-events-auto border border-orange-400/30 relative overflow-hidden group ${
                                    cartBump ? 'animate-cart-bump ring-4 ring-orange-400/60' : ''
                                }`}
                                style={{
                                    background: 'linear-gradient(135deg, #f97316, #ea580c)',
                                    boxShadow: '0 14px 40px -8px rgba(249, 115, 22, 0.6), 0 6px 20px rgba(0,0,0,0.3)'
                                }}
                            >
                                {/* Destello shimmer */}
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 pointer-events-none" />

                                {/* Burbuja flotante de incremento de precio */}
                                {priceDeltaBubble && (
                                    <span 
                                        key={priceDeltaBubble.id}
                                        className="absolute -top-3.5 right-6 bg-amber-400 text-neutral-950 font-black text-xs px-3 py-1 rounded-full shadow-xl border-2 border-white animate-price-float pointer-events-none z-50 flex items-center gap-1"
                                    >
                                        <span>+{formatARS(priceDeltaBubble.amount)}</span>
                                        <Sparkles className="w-3.5 h-3.5 text-neutral-950" />
                                    </span>
                                )}

                                <div className="flex items-center gap-3">
                                    <div className={`relative bg-black/30 w-11 h-11 rounded-2xl flex items-center justify-center font-black text-base shadow-inner border border-white/15 transition-transform duration-300 ${
                                        cartBump ? 'scale-125 bg-amber-400 text-neutral-950 ring-2 ring-white' : 'text-white'
                                    }`}>
                                        <ShoppingCart size={20} />
                                        <span className="absolute -top-1.5 -right-1.5 bg-amber-400 text-neutral-950 text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-md border-2 border-neutral-900">
                                            {Object.values(cart).reduce((a, b) => a + b, 0)}
                                        </span>
                                    </div>
                                    <div className="text-left">
                                        <span className="block text-xs md:text-sm font-black uppercase tracking-wider text-white">
                                            Ver Desglose
                                        </span>
                                        <span className="text-[10px] text-white/80 font-medium">
                                            {Object.values(cart).reduce((a, b) => a + b, 0)} items cargados
                                        </span>
                                    </div>
                                </div>

                                <div className="text-right flex flex-col items-end">
                                    <span className={`block text-lg md:text-2xl font-black text-white tracking-tight drop-shadow transition-transform duration-300 ${
                                        cartBump ? 'scale-110 text-amber-300' : ''
                                    }`}>
                                        {formatARS(totalPrice)}
                                    </span>
                                    <span className="text-[10px] uppercase font-bold text-white/80 tracking-wider">
                                        Cobrar ➔
                                    </span>
                                </div>
                            </button>
                        </div>
                    )}
                </div>
            ) : subTab === 'deliveries' ? (
                /* Pestaña: ENTREGAS DE CAJA (Implementada Premium, translúcida, interactiva) */
                <div className="space-y-5 animate-in fade-in duration-300">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-1 shrink-0">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-orange-500/10 border border-orange-500/20 text-orange-400 rounded-xl">
                                <ClipboardList size={16} />
                            </div>
                            <div>
                                <h3 className="font-black text-xs uppercase tracking-widest text-white leading-none">Despacho y Control de Entregas</h3>
                                <p className="text-[8px] font-bold text-slate-500 uppercase mt-0.5">Auditoría central y despacho de salón y barra</p>
                            </div>
                        </div>
                        
                        {/* Buscador de entregas */}
                        <div className="relative w-full max-w-sm">
                            <input
                                type="text"
                                placeholder="Buscar por # Orden, Cliente o Teléfono..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className={`w-full border rounded-2xl py-3 pl-4 pr-10 text-[10px] placeholder:text-slate-500 outline-none focus:border-orange-500 transition-all font-black uppercase ${
                                    isLight ? 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400' : 'bg-slate-900 border-slate-800 text-white placeholder:text-slate-650'
                                }`}
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-350 p-1"
                                >
                                    <X size={12} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Selector Premium de Subpestañas de Entregas */}
                    <div className={`flex p-1 border rounded-2xl max-w-md mx-auto shadow-inner select-none shrink-0 transition-colors ${
                        isLight ? 'bg-slate-100 border-slate-200 shadow-slate-100/50' : 'bg-slate-950/60 border-white/5'
                    }`}>
                        <button
                            onClick={() => setDeliveriesSubTab('pending')}
                            className={`flex-1 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all duration-300 ${
                                deliveriesSubTab === 'pending'
                                    ? 'bg-orange-500 text-slate-950 shadow-lg scale-100 font-bold'
                                    : (isLight ? 'text-slate-500 hover:text-slate-850' : 'text-slate-400 hover:text-white')
                            }`}
                        >
                            ⏳ Pendientes ({pendingOrdersForDeliveries.length})
                        </button>
                        <button
                            onClick={() => setDeliveriesSubTab('completed')}
                            className={`flex-1 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all duration-300 ${
                                deliveriesSubTab === 'completed'
                                    ? 'bg-emerald-500 text-slate-950 shadow-lg scale-100 font-bold'
                                    : (isLight ? 'text-slate-500 hover:text-slate-850' : 'text-slate-400 hover:text-white')
                            }`}
                        >
                            ✅ Completados ({completedOrdersForDeliveries.length})
                        </button>
                    </div>

                    {(() => {
                        const activeList = deliveriesSubTab === 'pending' ? allDisplayOrders : completedOrdersForDeliveries;
                        const filteredOrders = activeList.filter(o => {
                            if (!searchQuery) return true;
                            const q = searchQuery.toLowerCase().trim();
                            const num = o.order_number?.toString() || '';
                            const name = o.client_name?.toLowerCase() || '';
                            const phoneVal = o.phone_number?.toLowerCase() || '';
                            return num.includes(q) || name.includes(q) || phoneVal.includes(q) || `#${num}`.includes(q);
                        });

                        if (filteredOrders.length === 0) {
                            return (
                                <div className={`py-20 text-center rounded-[2.5rem] p-8 border-dashed border-2 bg-gradient-to-br transition-all ${
                                    isLight ? 'bg-white border-slate-200 shadow-sm from-slate-50 to-transparent' : 'glass border-white/5 from-orange-500/5 to-transparent'
                                }`}>
                                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border ${
                                        isLight ? 'bg-slate-100 border-slate-200/60' : 'bg-slate-950/80 border-white/5'
                                    }`}>
                                        <CheckCircle2 size={28} className="text-orange-500 animate-pulse" />
                                    </div>
                                    <h4 className={`font-black text-xs uppercase tracking-widest mb-1 ${isLight ? 'text-slate-900' : 'text-white'}`}>Sin Entregas</h4>
                                    <p className="text-slate-500 text-[9px] font-bold uppercase tracking-wider">No se encontraron pedidos activos que coincidan con los filtros.</p>
                                </div>
                            );
                        }

                        return (
                            <div className="grid gap-4">
                                {filteredOrders.map(order => {
                                    const items = order.items || [];
                                    const hasMesa = !!order.table_number;
                                    const isPendingPayment = order.payment_status !== 'pagado';
                                    const isNotApproved = !hasMesa && (order as any).is_approved_for_production === false;
                                    
                                    if (deliveriesSubTab === 'completed') {
                                        return (
                                            <div key={order.id} className={`rounded-[2rem] border p-5 transition-all duration-300 shadow-md ${
                                                isLight 
                                                    ? 'bg-white border-emerald-250 bg-gradient-to-br from-emerald-500/5 to-transparent' 
                                                    : 'glass border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent opacity-90'
                                            }`}>
                                                <div className={`flex justify-between items-start border-b pb-3 ${
                                                    isLight ? 'border-slate-200/60' : 'border-white/5'
                                                }`}>
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-10 h-10 rounded-2xl border flex items-center justify-center font-black text-xs animate-pulse ${
                                                            isLight 
                                                                ? 'bg-emerald-50 text-emerald-600 border-emerald-200' 
                                                                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                                        }`}>
                                                            #{order.order_number || 'N/A'}
                                                        </div>
                                                        <div>
                                                            <h4 className={`font-extrabold text-sm leading-tight transition-colors ${
                                                                isLight ? 'text-slate-900' : 'text-white'
                                                            }`}>{getOrderDisplayName(order, tenant)}</h4>
                                                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                                                {hasMesa ? (
                                                                    <span className="text-[7px] bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded text-blue-400 font-black uppercase">
                                                                        {getTableDisplayName(order.table_number, tenant)}
                                                                    </span>
                                                                ) : (order as any).delivery_type === 'delivery' ? (
                                                                    <span className="text-[7px] bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded text-purple-400 font-black uppercase">
                                                                        Envío 🛵
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-[7px] bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded text-emerald-400 font-black uppercase">
                                                                        Take Away / Caja 🛍️
                                                                    </span>
                                                                )}
                                                                {order.origin === 'rappi' && (
                                                                    <span className="text-[7.5px] bg-orange-500 text-white px-2 py-0.5 rounded-full font-black uppercase shadow-sm shadow-orange-500/30 flex items-center gap-1">
                                                                        <ShoppingBag size={8} /> RAPPI
                                                                    </span>
                                                                )}
                                                                {order.origin === 'pedidosya' && (
                                                                    <span className="text-[7.5px] bg-red-600 text-white px-2 py-0.5 rounded-full font-black uppercase shadow-sm shadow-red-600/30 flex items-center gap-1">
                                                                        <ShoppingBag size={8} /> PEDIDOSYA
                                                                    </span>
                                                                )}
                                                                <span className="text-[7px] bg-emerald-500 text-slate-950 px-1.5 py-0.5 rounded font-black uppercase">
                                                                    Entregado & Cobrado
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-xs font-black text-emerald-500 block">{formatARS(order.total_price)}</span>
                                                        <span className="text-[7px] font-black uppercase text-slate-500 tracking-wider block mb-1">
                                                            {order.origin === 'rappi' ? 'RAPPI' : order.origin === 'pedidosya' ? 'PEDIDOSYA' : order.payment_method ? order.payment_method.toUpperCase() : 'PAGADO'}
                                                        </span>
                                                        <div className="flex gap-1.5 justify-end mt-1.5">
                                                            {(order as any).afip_cae && (
                                                                <span className="text-[7.5px] bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 px-1.5 py-1 rounded-lg font-black uppercase flex items-center gap-0.5" title={`CAE: ${(order as any).afip_cae}`}>
                                                                    🏛️ ARCA
                                                                </span>
                                                            )}
                                                            <button onClick={() => triggerPrint(order)} className={`p-1.5 rounded-lg border flex items-center justify-center gap-1 hover:bg-slate-500/10 transition-all ${isLight ? 'border-slate-300 text-slate-600' : 'border-white/10 text-slate-400'}`}>
                                                                <Printer size={12} /> <span className="text-[8px] font-bold uppercase">Imprimir</span>
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                {(order as any).delivery_type === 'delivery' && (order as any).delivery_address && (
                                                    <p className={`text-[8.5px] font-bold mt-2.5 ${
                                                        isLight ? 'text-slate-500' : 'text-slate-400'
                                                    }`}>
                                                        📍 Dirección: <span className={isLight ? 'text-slate-800' : 'text-slate-350'}>{(order as any).delivery_address}</span>
                                                    </p>
                                                )}
 
                                                <div className={`mt-3 rounded-2xl p-3 border space-y-1 ${
                                                    isLight ? 'bg-slate-50 border-slate-200/60' : 'bg-slate-950/40 border-white/5'
                                                }`}>
                                                    {items.map((item, idx) => (
                                                        <div key={idx} className={`flex justify-between text-[9px] ${
                                                            isLight ? 'text-slate-650' : 'text-slate-400'
                                                        }`}>
                                                            <span>{item.quantity}x {getProductName(item.product_id || '')}</span>
                                                            <span className={isLight ? 'text-slate-500 font-semibold' : 'text-slate-500'}>{formatARS((item.unit_price || 0) * item.quantity)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                                
                                                <div className="mt-2.5 flex justify-between items-center text-[7px] text-slate-500 font-bold uppercase">
                                                    <span>mmmTodoLoQueQuiero Control</span>
                                                    <span>Hora: {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>

                                                {order.phone_number && (
                                                    <div className="mt-3 flex flex-col gap-2">
                                                        <a
                                                            href={`https://wa.me/${cleanArgPhone(order.phone_number)}?text=${encodeURIComponent(
                                                                `¡Hola ${order.client_name}! Gracias por tu compra en ${tenant?.name || 'nuestro local'}. Te dejamos el detalle de tu pedido pagado:\n\n${items.map(i => `${i.quantity}x ${getProductName(i.product_id || '')}`).join('\n')}\n\nTotal Pagado: ${formatARS(order.total_price)}\n\n(Si necesitas tu ticket físico o fiscal, por favor solicítalo al cajero o búscalo en tu envío).`
                                                            )}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-[9px] uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/25 active:scale-95 transition-all text-center"
                                                        >
                                                            💬 Enviar Desglose por WhatsApp
                                                        </a>
                                                        <a
                                                            href={`https://wa.me/${cleanArgPhone(order.phone_number)}?text=${encodeURIComponent(
                                                                `Hola ${order.client_name}, te escribimos de ${tenant?.name || 'nuestro local'}. ¡Tu pedido está listo y fue completado con éxito! ✅ Ya puedes pasar a retirarlo.`
                                                            )}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className={`w-full py-2.5 ${isLight ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'} font-black rounded-xl text-[9px] uppercase tracking-wider flex items-center justify-center gap-1.5 active:scale-95 transition-all text-center border ${isLight ? 'border-slate-200' : 'border-slate-700'}`}
                                                        >
                                                            🔔 Avisar Retiro / Pedido Listo
                                                        </a>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    }

                                    return (
                                        <div key={order.id} className={`rounded-[2rem] border overflow-hidden shadow-xl transition-all duration-300 ${
                                            isPendingPayment && isNotApproved 
                                                ? (isLight 
                                                    ? 'border-red-200 shadow-md bg-gradient-to-br from-red-50/50 to-transparent text-slate-900' 
                                                    : 'border-red-500/60 shadow-[0_0_20px_rgba(239,68,68,0.2)] bg-gradient-to-br from-red-950/10 via-slate-900/40 to-slate-950/80 text-white')
                                                : (isLight ? 'bg-white border-slate-200/60 text-slate-900 shadow-sm' : 'glass border-white/5 bg-gradient-to-br from-orange-500/5 to-transparent text-white')
                                        }`}>
                                            {/* RESALTADO PENDIENTE DE PAGO */}
                                            {isPendingPayment && isNotApproved && (
                                                <div className="bg-red-600 text-white px-5 py-3 text-[9px] font-black uppercase tracking-wider flex items-center justify-between animate-pulse">
                                                    <span className="flex items-center gap-1">⚠️ PENDIENTE DE PAGO (Bloqueado)</span>
                                                    <button
                                                        onClick={() => handleSendOrderToProduction(order.id)}
                                                        className="bg-white text-red-600 hover:bg-slate-100 px-3.5 py-1.5 rounded-xl text-[8.5px] font-black uppercase tracking-wider transition-all shadow-md active:scale-95"
                                                    >
                                                        Enviar Pedido a Producción
                                                    </button>
                                                </div>
                                            )}

                                            {isPendingPayment && !isNotApproved && (
                                                <div className={`px-5 py-2 text-[8.5px] font-black uppercase tracking-wide border-b ${
                                                    isLight ? 'bg-red-50 border-red-100 text-red-600' : 'bg-red-950/35 border-red-900/20 text-red-400'
                                                }`}>
                                                    ⚠️ PAGO PENDIENTE (En preparación en Cocina/Barra)
                                                </div>
                                            )}

                                            {!isPendingPayment && (
                                                <div className="bg-emerald-600 text-white px-5 py-3 text-[9px] font-black uppercase tracking-wider flex items-center justify-between shadow-inner">
                                                    <span className="flex items-center gap-1">✅ ESTE PEDIDO HA SIDO PAGADO ONLINE</span>
                                                </div>
                                            )}

                                            {String(order.order_number) === 'LOCAL' && (
                                                <div className="bg-orange-500 text-white px-5 py-2.5 text-[9px] font-black uppercase tracking-wider flex items-center justify-between shadow-inner animate-pulse">
                                                    <span className="flex items-center gap-2">📶 SIN CONEXIÓN - SE ENVIARÁ AUTOMÁTICAMENTE</span>
                                                </div>
                                            )}

                                            {/* Cabecera de la Orden */}
                                            <div className={`p-4 flex justify-between items-center border-b ${
                                                isLight ? 'bg-slate-50 border-slate-200/60' : 'bg-slate-950/60 border-white/5'
                                            }`}>
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-xl bg-orange-500/10 text-orange-400 border border-orange-500/20 flex items-center justify-center shrink-0">
                                                        <User size={16} />
                                                    </div>
                                                    <div>
                                                        <h4 className={`font-black text-sm leading-none mb-1 ${
                                                            isLight ? 'text-slate-900' : 'text-white'
                                                        }`}>
                                                            <span className="text-orange-500 font-bold mr-1">#{order.order_number}</span>
                                                            {getOrderDisplayName(order, tenant)}
                                                        </h4>
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            {hasMesa ? (
                                                                <span className="text-[7px] bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded text-blue-400 font-black uppercase">
                                                                    {getTableDisplayName(order.table_number, tenant)}
                                                                </span>
                                                            ) : (order as any).delivery_type === 'delivery' ? (
                                                                <span className="text-[7px] bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded text-purple-400 font-black uppercase">
                                                                    Envío a Domicilio 🛵
                                                                </span>
                                                            ) : (
                                                                <span className="text-[7px] bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded text-emerald-400 font-black uppercase">
                                                                    Para Llevar / Caja 🛍️
                                                                </span>
                                                            )}
                                                            {order.origin === 'rappi' && (
                                                                <span className="text-[7.5px] bg-orange-500 text-white px-2 py-0.5 rounded-full font-black uppercase shadow-sm shadow-orange-500/30 flex items-center gap-1">
                                                                    <ShoppingBag size={8} /> RAPPI
                                                                </span>
                                                            )}
                                                            {order.origin === 'pedidosya' && (
                                                                <span className="text-[7.5px] bg-red-600 text-white px-2 py-0.5 rounded-full font-black uppercase shadow-sm shadow-red-600/30 flex items-center gap-1">
                                                                    <ShoppingBag size={8} /> PEDIDOSYA
                                                                </span>
                                                            )}
                                                            {order.status === 'delivered' && (
                                                                <span className={`text-[7px] px-2 py-0.5 rounded font-black uppercase animate-pulse ${
                                                                    (order as any).delivery_type === 'delivery' 
                                                                        ? 'bg-purple-500 text-white' 
                                                                        : 'bg-orange-500 text-slate-950'
                                                                }`}>
                                                                    {(order as any).delivery_type === 'delivery' ? 'Entregado al Cliente' : 'Todo Preparado'}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <span className={`text-[9px] font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>{formatARS(order.total_price)}</span>
                                                    <p className="text-[7px] text-slate-500 font-bold uppercase mt-0.5 mb-1">Monto Total</p>
                                                    <div className="flex gap-1.5 justify-end mt-1.5">
                                                        {(order as any).afip_cae && (
                                                            <span className="text-[7.5px] bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 px-1.5 py-1 rounded-lg font-black uppercase flex items-center gap-0.5" title={`CAE: ${(order as any).afip_cae}`}>
                                                                🏛️ ARCA
                                                            </span>
                                                        )}
                                                        <button onClick={() => triggerPrint(order)} className={`p-1.5 rounded-lg border w-full flex items-center justify-center gap-1 hover:bg-slate-500/10 transition-all ${isLight ? 'border-slate-300 text-slate-600' : 'border-white/10 text-slate-400'}`}>
                                                            <Printer size={12} /> <span className="text-[8px] font-bold uppercase">Imprimir</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Detalles de Envío destacados (Si es Delivery) */}
                                            {(order as any).delivery_type === 'delivery' && (
                                                <div className={`p-4 border-b space-y-2 text-xs ${
                                                    isLight ? 'bg-white border-slate-200/60' : 'bg-slate-900/60 border-white/5'
                                                }`}>
                                                    <p className="text-[8.5px] font-black text-slate-500 uppercase tracking-widest leading-none">Datos de Envío</p>
                                                    <div className="flex justify-between items-start gap-3">
                                                        <div className="space-y-1">
                                                            <p className={`font-extrabold ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>Dirección: <span className={isLight ? 'text-slate-900' : 'text-slate-350'}>{(order as any).delivery_address || 'Sin especificar'}</span></p>
                                                            {order.phone_number && (
                                                                <p className={`font-extrabold ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>Teléfono: <span className={isLight ? 'text-slate-900' : 'text-slate-350'}>{order.phone_number}</span></p>
                                                            )}
                                                        </div>
                                                        <div className="flex flex-col gap-1.5 shrink-0">
                                                            {(order as any).delivery_lat && (order as any).delivery_lng && (
                                                                <a
                                                                    href={`https://www.google.com/maps/search/?api=1&query=${(order as any).delivery_lat},${(order as any).delivery_lng}`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider flex items-center gap-1 transition-all ${
                                                                        isLight 
                                                                            ? 'bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800' 
                                                                            : 'bg-slate-950 hover:bg-slate-900 border border-white/10 text-white'
                                                                    }`}
                                                                >
                                                                    🗺️ Abrir Ruta
                                                                </a>
                                                            )}
                                                            {order.phone_number && (
                                                                <a
                                                                    href={`https://wa.me/${cleanArgPhone(order.phone_number)}`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[8px] font-black uppercase tracking-wider text-center transition-all"
                                                                >
                                                                    💬 WhatsApp
                                                                </a>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Detalles de Retiro / Local con celular (Si no es Delivery y tiene celular) */}
                                            {(order as any).delivery_type !== 'delivery' && order.phone_number && (
                                                <div className={`p-4 border-b flex justify-between items-center text-xs ${
                                                    isLight ? 'bg-white border-slate-200/60' : 'bg-slate-900/40 border-white/5'
                                                }`}>
                                                    <div>
                                                        <p className="text-[8.5px] font-black text-slate-500 uppercase tracking-widest leading-none">Contacto de Retiro</p>
                                                        <p className={`font-extrabold mt-1.5 ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>WhatsApp: <span className={isLight ? 'text-slate-900' : 'text-slate-350'}>{order.phone_number}</span></p>
                                                    </div>
                                                    <a
                                                        href={`https://wa.me/${cleanArgPhone(order.phone_number)}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className={`px-2.5 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-wider text-center transition-all ${
                                                            isLight 
                                                                ? 'bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 hover:text-slate-900' 
                                                                : 'bg-slate-950 hover:bg-slate-900 border border-white/10 text-slate-400 hover:text-white'
                                                        }`}
                                                    >
                                                        💬 WhatsApp (Chat Libre)
                                                    </a>
                                                </div>
                                            )}

                                            {/* Lista de Ítems */}
                                            <div className="p-5 space-y-2.5">
                                                {items.map((item, idx) => {
                                                    const isDelivered = item.status === 'delivered';
                                                    const isServed = item.is_served;
                                                    const prodName = getProductName(item.product_id || '');
                                                    
                                                    return (
                                                        <div 
                                                            key={idx}
                                                            className={`flex justify-between items-center p-3 rounded-2xl border transition-all ${
                                                                isServed 
                                                                    ? (isLight ? 'bg-slate-50 border-slate-100 opacity-40' : 'bg-slate-950/20 border-white/5 opacity-40') 
                                                                    : (isLight ? 'bg-white border-slate-200 hover:border-orange-200 shadow-sm' : 'bg-slate-950/60 border-white/10 hover:border-orange-500/10')
                                                            }`}
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-[10px] ${
                                                                    isServed 
                                                                        ? (isLight ? 'bg-slate-200 text-slate-500' : 'bg-slate-900 text-slate-600') 
                                                                        : 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                                                                }`}>
                                                                    {item.quantity}x
                                                                </span>
                                                                <div>
                                                                    <p className={`font-black text-xs transition-colors ${
                                                                        isServed 
                                                                            ? 'line-through text-slate-500' 
                                                                            : (isLight ? 'text-slate-900' : 'text-white')
                                                                    }`}>
                                                                        {item.notes ? `${item.notes} (${prodName})` : prodName}
                                                                    </p>
                                                                    <div className="flex items-center gap-1.5 mt-1 flex-wrap select-none">
                                                                        {item.target_departments?.includes('kitchen') && (
                                                                            <span className={`text-[6px] font-black uppercase px-1.5 py-0.5 rounded border ${
                                                                                isDelivered 
                                                                                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                                                                                    : 'bg-orange-500/10 border-orange-500/20 text-orange-400'
                                                                            }`}>
                                                                                🍳 Cocina: {isDelivered ? 'Listo' : 'Preparando'}
                                                                            </span>
                                                                        )}
                                                                        {item.target_departments?.includes('bartender') && (
                                                                            <span className={`text-[6px] font-black uppercase px-1.5 py-0.5 rounded border ${
                                                                                isDelivered 
                                                                                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                                                                                    : 'bg-orange-500/10 border-orange-500/20 text-orange-400'
                                                                            }`}>
                                                                                🍹 Barra: {isDelivered ? 'Listo' : 'Preparando'}
                                                                            </span>
                                                                        )}
                                                                        <span className={`text-[6px] font-black uppercase px-1.5 py-0.5 rounded border ${
                                                                            isServed 
                                                                                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                                                                                : (isLight ? 'bg-slate-100 border-slate-200 text-slate-500' : 'bg-slate-800 border-white/5 text-slate-400')
                                                                        }`}>
                                                                            📦 {isServed ? 'Servido' : 'Pendiente'}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>
 
                                                            {/* Control de Acción (Por Mozo vs Caja vs Repartidor) */}
                                                            <div>
                                                                {isServed ? (
                                                                    <div 
                                                                        className="flex items-center gap-1 text-[8px] font-black text-emerald-400 bg-emerald-500/10 px-2.5 py-1.5 rounded-xl border border-emerald-500/20 select-none cursor-default"
                                                                    >
                                                                        <Check size={10} className="stroke-[3]" /> Entregado
                                                                    </div>
                                                                ) : !isDelivered ? (
                                                                    /* Sigue en Preparación */
                                                                    <div className={`flex items-center gap-1 text-[8px] font-black text-slate-500 px-2.5 py-1.5 rounded-xl border select-none ${
                                                                        isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-950/80 border-white/5'
                                                                    }`}>
                                                                        <Clock size={10} className="animate-spin text-orange-500" /> Preparando
                                                                    </div>
                                                                ) : hasMesa ? (
                                                                    /* Pedido con Mesa asignada -> Protegido para el Mozo */
                                                                    <div className="flex items-center gap-1 text-[8px] font-black text-blue-400 bg-blue-500/10 px-2.5 py-1.5 rounded-xl border border-blue-500/20 select-none cursor-not-allowed animate-pulse" title="Entrega física administrada exclusivamente por el Mozo asignado a la mesa">
                                                                        Por Mozo 🛎️
                                                                    </div>
                                                                ) : (order as any).delivery_type === 'delivery' ? (
                                                                    /* Pedido de Delivery -> Protegido para Repartidor */
                                                                    <div className="flex items-center gap-1 text-[8px] font-black text-purple-400 bg-purple-500/10 px-2.5 py-1.5 rounded-xl border border-purple-500/20 select-none cursor-not-allowed animate-pulse" title="Entrega física administrada exclusivamente por el Repartidor">
                                                                        Por Repartidor 🛵
                                                                    </div>
                                                                ) : (
                                                                    /* Habilitado para el Cajero (Take Away o cargado por Caja sin mesa) */
                                                                    <button
                                                                        onClick={() => handleToggleItemServed(item, order)}
                                                                        className="text-[8px] font-black uppercase px-2.5 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-slate-950 shadow-orange-500/10 transition-all shadow-md active:scale-95"
                                                                        title="Marcar como entregado desde Caja"
                                                                    >
                                                                        Entregar
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {/* Desglose Financiero de la Comanda */}
                                            {((order.table_charge || 0) > 0 || (order.tip_amount || 0) > 0 || (order.discount_amount || 0) > 0 || (order.loyalty_discount_applied || 0) > 0) && (
                                                <div className={`px-5 pb-4 space-y-1 text-[9px] font-bold uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                                                    <div className="flex justify-between border-t border-dashed pt-2 dark:border-white/10 border-slate-200">
                                                        <span>Subtotal Productos</span>
                                                        <span>{formatARS(order.total_price - (order.table_charge || 0) - (order.tip_amount || 0) + (order.discount_amount || 0) + (order.loyalty_discount_applied || 0) - (order.delivery_fee || 0))}</span>
                                                    </div>
                                                    {(order.delivery_fee || 0) > 0 && (
                                                        <div className="flex justify-between">
                                                            <span>Envío a domicilio</span>
                                                            <span>{formatARS(order.delivery_fee || 0)}</span>
                                                        </div>
                                                    )}
                                                    {(order.table_charge || 0) > 0 && (
                                                        <div className="flex justify-between">
                                                            <span>Servicio de Mesa (Cubierto)</span>
                                                            <span>{formatARS(order.table_charge || 0)}</span>
                                                        </div>
                                                    )}
                                                    {(order.tip_amount || 0) > 0 && (
                                                        <div className="flex justify-between text-orange-500 dark:text-orange-400">
                                                            <span>Propina ({(order as any).is_tip_paid ? 'Ya Liquidada' : 'Pendiente Pago al Mozo'})</span>
                                                            <span>{formatARS(order.tip_amount || 0)}</span>
                                                        </div>
                                                    )}
                                                    {(order.discount_amount || 0) > 0 && (
                                                        <div className="flex justify-between text-green-500">
                                                            <span>Descuento / Reserva</span>
                                                            <span>-{formatARS(order.discount_amount || 0)}</span>
                                                        </div>
                                                    )}
                                                    {(order.loyalty_discount_applied || 0) > 0 && (
                                                        <div className="flex justify-between text-green-500">
                                                            <span>Descuento Club</span>
                                                            <span>-{formatARS(order.loyalty_discount_applied || 0)}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
 
                                            {/* SECCIÓN DE ACCIÓN EXCLUSIVA DE COBRO O ARCHIVADO */}
                                            {isPendingPayment && order.origin !== 'rappi' && order.origin !== 'pedidosya' ? (
                                                <div className={`p-4 border-t flex gap-2 ${
                                                    isLight ? 'bg-slate-50 border-slate-200/60' : 'bg-slate-950/40 border-white/5'
                                                }`}>
                                                    <button
                                                        onClick={() => {
                                                            setCrossPaymentOrder(order);
                                                            setCrossPaymentMethod('efectivo');
                                                            setAdditionalTipAmount(0);
                                                        }}
                                                        className="w-full py-3.5 bg-red-600 hover:bg-red-500 text-white font-black rounded-xl text-[9.5px] uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-1.5 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.4)] border border-red-500/30"
                                                    >
                                                        {order.status === 'delivered' && (order as any).delivery_type === 'delivery' 
                                                            ? '💵 Repartidor Volvió - Confirmar Cobro' 
                                                            : '💵 Confirmar Pago / Cobrar'}
                                                    </button>
                                                </div>
                                            ) : (() => {
                                                // 1. Evaluar si todos los productos que requieren preparación están listos en Cocina/Barra
                                                const allItemsPrepared = order.items?.every(item => {
                                                    const needsPrep = item.target_departments?.includes('kitchen') || item.target_departments?.includes('bartender');
                                                    if (!needsPrep) return true;
                                                    return item.status === 'delivered';
                                                }) ?? true;

                                                // 2. Evaluar si todos los ítems fueron entregados físicamente al cliente
                                                const allItemsServed = order.items?.every(item => item.is_served) ?? true;

                                                const isDeliveryType = (order as any).delivery_type === 'delivery';
                                                const hasMesaType = !!order.table_number;
                                                const isExternalApp = order.origin === 'rappi' || order.origin === 'pedidosya';

                                                return (
                                                    <div className={`p-4 border-t flex gap-2 w-full ${
                                                        isLight ? 'bg-slate-50 border-slate-200/60' : 'bg-slate-950/40 border-white/5'
                                                    }`}>
                                                        {isDeliveryType && !isExternalApp && order.status !== 'delivered' ? (
                                                            /* Regla: Si es Delivery local, solo el repartidor finaliza el flujo desde su terminal */
                                                            <div className="w-full py-3.5 bg-purple-500/10 border border-purple-500/20 text-purple-400 font-black rounded-xl text-[9px] uppercase tracking-wider flex items-center justify-center gap-1.5 select-none animate-pulse">
                                                                💡 En reparto - Cierre a cargo del Repartidor
                                                            </div>
                                                        ) : !allItemsPrepared ? (
                                                            /* Regla: Bloqueado hasta que Cocina/Barra den el OK de listo */
                                                            <button
                                                                disabled
                                                                className={`w-full py-3.5 font-black rounded-xl text-[9px] uppercase tracking-wider flex items-center justify-center gap-1.5 select-none cursor-not-allowed border ${
                                                                    isLight ? 'bg-slate-200 border-slate-300 text-slate-500' : 'bg-slate-800 border-white/5 text-slate-500'
                                                                }`}
                                                            >
                                                                ⏳ Esperando Cocina / Barra
                                                            </button>
                                                        ) : hasMesaType && !allItemsServed ? (
                                                            /* Regla: Bloqueado hasta que el Mozo entregue físicamente en mesa */
                                                            <button
                                                                disabled
                                                                className={`w-full py-3.5 font-black rounded-xl text-[9px] uppercase tracking-wider flex items-center justify-center gap-1.5 select-none cursor-not-allowed border ${
                                                                    isLight ? 'bg-slate-200 border-slate-300 text-slate-500' : 'bg-slate-800 border-white/5 text-slate-500'
                                                                }`}
                                                            >
                                                                ⏳ Esperando Mozo (Entrega en Mesa)
                                                            </button>
                                                        ) : !allItemsServed ? (
                                                            /* Regla: Take Away/Caja/Apps habilitado para entregar y despachar todo en lote */
                                                            <div className="flex flex-col gap-2 w-full">
                                                                {isExternalApp ? (
                                                                    <button
                                                                        onClick={async () => {
                                                                            // Simular notificación API a Rappi / PedidosYa de que está listo para retiro por el delivery partner
                                                                            alert(`[${(order.origin || 'App').toUpperCase()}] Notificación digital enviada a la plataforma. Repartidor de la app notificado para pasar a retirar el pedido #${order.order_number || order.id}.`);
                                                                        }}
                                                                        className="w-full py-3 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-400 hover:to-red-500 text-white font-black rounded-xl text-[9.5px] uppercase tracking-widest flex items-center justify-center gap-1.5 shadow-md shadow-orange-500/25 active:scale-95 transition-all"
                                                                    >
                                                                        📲 Avisar a Repartidor ({(order.origin || 'App').toUpperCase()})
                                                                    </button>
                                                                ) : order.phone_number && !isDeliveryType ? (
                                                                    <a
                                                                        href={`https://wa.me/${cleanArgPhone(order.phone_number)}?text=${encodeURIComponent(
                                                                            `Hola ${order.client_name}, te escribimos de ${tenant?.name || 'nuestro local'}. ¡Tu pedido ya está LISTO! ✅ Ya puedes pasar a retirarlo.`
                                                                        )}`}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-[9px] uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/25 active:scale-95 transition-all"
                                                                    >
                                                                        💬 Avisar Retiro
                                                                    </a>
                                                                ) : null}
                                                                
                                                                {isDeliveryType && !isExternalApp && order.status !== 'delivered' ? (
                                                                    <div className="w-full py-3.5 bg-purple-500/10 border border-purple-500/20 text-purple-400 font-black rounded-xl text-[9px] uppercase tracking-wider flex items-center justify-center gap-1.5 select-none cursor-not-allowed">
                                                                        🛵 Despacho a cargo del Repartidor
                                                                    </div>
                                                                ) : (
                                                                    <button
                                                                        onClick={() => handleCloseAndArchiveOrder(order)}
                                                                        className="w-full py-3.5 bg-orange-500 hover:bg-orange-400 text-slate-950 font-black rounded-xl text-[9.5px] uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-lg shadow-orange-500/25 border border-orange-400/30"
                                                                    >
                                                                        📦 {isExternalApp ? 'Completar y Despachar Pedido' : (order.status === 'delivered' ? 'Archivar Pedido Entregado' : 'Entregar Todo y Despachar')}
                                                                    </button>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            /* Regla: Todo OK, habilitado para cerrar comanda */
                                                            <button
                                                                onClick={() => handleCloseAndArchiveOrder(order)}
                                                                className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-[9.5px] uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/35 border border-emerald-400/30"
                                                            >
                                                                📦 Despachar y Archivar Comanda
                                                            </button>
                                                        )}
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })()}
                </div>
            ) : subTab === 'reservations' ? (
                <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="flex items-center gap-2 px-1">
                        <div className="p-2 bg-orange-500/10 border border-orange-500/20 text-orange-400 rounded-xl">
                            <Calendar size={16} />
                        </div>
                        <div>
                            <h3 className="font-black text-xs uppercase tracking-widest text-white leading-none">Gestión de Reservas</h3>
                            <p className="text-[8px] font-bold text-slate-500 uppercase mt-0.5">Calendario de disponibilidad y atención</p>
                        </div>
                    </div>

                    {/* Calendario Horizontal */}
                    <div className={`p-3 rounded-3xl border transition-colors ${
                        isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-950/80 border-white/5'
                    }`}>
                        {(() => {
                            const days = [];
                            const today = new Date();
                            today.setHours(0,0,0,0);
                            
                            for (let i = 0; i < 30; i++) {
                                const d = new Date(today);
                                d.setDate(today.getDate() + i);
                                const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                                
                                const hasRes = calendarReservations.some(r => r.reservation_date === dateStr && (r.status === 'confirmed' || r.status === 'pending_payment'));
                                const isSelected = selectedResDate === dateStr;
                                
                                const dayName = d.toLocaleDateString('es-AR', { weekday: 'short' }).replace('.', '');
                                const dayNum = d.getDate();
                                
                                days.push(
                                    <button
                                        key={dateStr}
                                        onClick={() => setSelectedResDate(dateStr)}
                                        className={`flex-shrink-0 flex flex-col items-center justify-center w-[3.5rem] h-16 rounded-2xl border transition-all relative ${
                                            isSelected 
                                                ? 'bg-orange-500 border-orange-400 text-white shadow-lg shadow-orange-500/30 scale-105 z-10' 
                                                : (isLight ? 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100' : 'bg-slate-900 border-white/5 text-slate-400 hover:bg-slate-800')
                                        }`}
                                    >
                                        <span className={`text-[9px] font-black uppercase ${isSelected ? 'text-orange-100' : ''}`}>{dayName}</span>
                                        <span className={`text-lg font-black ${isSelected ? 'text-white' : ''}`}>{dayNum}</span>
                                        {hasRes && (
                                            <span className={`absolute bottom-1.5 w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-orange-500 animate-pulse'}`}></span>
                                        )}
                                    </button>
                                );
                            }
                            
                            return (
                                <div className="flex overflow-x-auto gap-2 pb-2 px-1 snap-x hide-scrollbar">
                                    {days}
                                </div>
                            );
                        })()}
                    </div>

                    {/* Selector de Turnos */}
                    <div className="flex gap-2 mb-4">
                        {(['mediodia', 'tarde', 'noche'] as const).map(shift => (
                            <button
                                key={shift}
                                onClick={() => setSelectedResShift(shift)}
                                className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all border shadow-sm ${
                                    selectedResShift === shift
                                        ? 'bg-orange-500 text-white border-orange-400 shadow-orange-500/25'
                                        : (isLight ? 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50' : 'bg-slate-900/40 text-slate-400 border-white/5 hover:bg-slate-800')
                                }`}
                            >
                                Turno {shift}
                            </button>
                        ))}
                    </div>

                    {/* Mapa de Mesitas del Turno */}
                    {(() => {
                        const dayRes = calendarReservations.filter(r => {
                            if (r.reservation_date !== selectedResDate) return false;
                            const h = parseInt(r.reservation_time.split(':')[0], 10);
                            const rShift = h >= 11 && h < 16 ? 'mediodia' : h >= 16 && h < 20 ? 'tarde' : 'noche';
                            return rShift === selectedResShift && (r.status === 'confirmed' || r.status === 'pending_payment');
                        });

                        const allTables = tenant?.tables || [];
                        const assignedTableIds = new Map<string, any>();
                        dayRes.forEach(res => {
                            const tArr = res.assigned_tables || [];
                            tArr.forEach((t: any) => assignedTableIds.set(t.id, res));
                        });

                        if (allTables.length === 0) return null;

                        return (
                            <div className={`p-5 rounded-[2.5rem] border shadow-sm transition-all mb-4 ${
                                isLight ? 'bg-slate-50/50 border-slate-200' : 'bg-slate-950/40 border-white/5'
                            }`}>
                                <h4 className={`font-black text-[10px] uppercase tracking-widest mb-4 flex items-center gap-2 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                                    <div className="w-1.5 h-1.5 rounded-full bg-orange-500"></div>
                                    Mapa de Mesas - Turno {selectedResShift}
                                </h4>
                                <div className="flex flex-wrap gap-3">
                                    {allTables.map((t: any) => {
                                        const res = assignedTableIds.get(t.id);
                                        const isOccupied = !!res;
                                        return (
                                            <div
                                                key={t.id}
                                                className={`relative w-[4.5rem] h-[4.5rem] rounded-2xl flex flex-col items-center justify-center border-2 transition-all group ${
                                                    isOccupied 
                                                        ? 'bg-red-500/10 border-red-500/40 text-red-600 shadow-md shadow-red-500/10 cursor-help' 
                                                        : (isLight ? 'bg-white border-slate-200 text-slate-400' : 'bg-slate-900/60 border-slate-800 text-slate-500')
                                                }`}
                                            >
                                                <span className={`text-lg font-black ${isOccupied ? '' : (isLight ? 'text-slate-300' : 'text-slate-700')}`}>{t.name}</span>
                                                <span className={`text-[8px] font-bold uppercase mt-0.5 ${isOccupied ? 'text-red-400' : (isLight ? 'text-slate-400' : 'text-slate-600')}`}>{t.capacity} pax</span>
                                                {isOccupied && (
                                                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 p-3 bg-slate-900 border border-white/10 rounded-2xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20 text-white pointer-events-none">
                                                        <div className="flex justify-between items-start mb-1">
                                                            <p className="text-[9px] font-black uppercase text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded border border-orange-500/20">{res.reservation_time.slice(0,5)} hs</p>
                                                            {!res.message_sent && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>}
                                                        </div>
                                                        <p className="text-xs font-black truncate">{res.client_name}</p>
                                                        <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">{res.party_size} personas</p>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })()}

                    {/* Lista de Reservas del Día y Turno */}
                    {(() => {
                        const dayRes = calendarReservations.filter(r => {
                            if (r.reservation_date !== selectedResDate) return false;
                            const h = parseInt(r.reservation_time.split(':')[0], 10);
                            const rShift = h >= 11 && h < 16 ? 'mediodia' : h >= 16 && h < 20 ? 'tarde' : 'noche';
                            return rShift === selectedResShift;
                        });
                        
                        if (dayRes.length === 0) {
                            return (
                                <div className={`py-16 text-center rounded-[2.5rem] p-8 border-dashed border-2 bg-gradient-to-br transition-all ${
                                    isLight ? 'bg-white border-slate-200 shadow-sm from-slate-50 to-transparent' : 'glass border-white/5 from-orange-500/5 to-transparent'
                                }`}>
                                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border ${
                                        isLight ? 'bg-slate-100 border-slate-200/60' : 'bg-slate-950/80 border-white/5'
                                    }`}>
                                        <Calendar size={28} className="text-orange-500 opacity-50" />
                                    </div>
                                    <h4 className={`font-black text-xs uppercase tracking-widest mb-1 ${isLight ? 'text-slate-900' : 'text-white'}`}>Sin Reservas</h4>
                                    <p className="text-slate-500 text-[9px] font-bold uppercase tracking-wider">No hay reservas para el turno {selectedResShift}.</p>
                                </div>
                            );
                        }
                        
                        return (
                            <div className="grid gap-4">
                                {dayRes.map(res => (
                                    <div key={res.id} className={`rounded-[2.5rem] border p-6 transition-all duration-300 shadow-md flex flex-col gap-4 relative overflow-hidden ${
                                        isLight ? 'bg-white border-slate-200' : 'bg-slate-900/60 border-white/5'
                                    }`}>
                                        {/* Indicador de Falta Enviar WhatsApp */}
                                        {!res.message_sent && (res.status === 'confirmed' || res.status === 'pending_payment') && (
                                            <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 -rotate-45 translate-x-16 -translate-y-16 flex items-end justify-center pb-2 z-0 animate-pulse">
                                                <span className="text-[7px] font-black uppercase text-red-500 tracking-widest">Pendiente Envío</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between items-start relative z-10">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                    <h4 className={`font-black text-base uppercase ${isLight ? 'text-slate-900' : 'text-white'}`}>{res.client_name}</h4>
                                                    <span className={`text-[8px] font-black px-2.5 py-0.5 rounded-lg uppercase ${
                                                        res.status === 'confirmed' || res.status === 'pending_payment' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 
                                                        res.status === 'completed' ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' :
                                                        'bg-red-500/10 text-red-500 border border-red-500/20'
                                                    }`}>
                                                        {res.status === 'confirmed' || res.status === 'pending_payment' ? 'Activa' : res.status === 'completed' ? 'Asistió' : 'Cancelada'}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-3 mt-3 flex-wrap">
                                                    <p className={`text-[10px] font-bold uppercase flex items-center gap-1.5 px-2 py-1 rounded-lg border ${
                                                        isLight ? 'bg-slate-50 border-slate-200 text-slate-600' : 'bg-slate-950/50 border-white/5 text-slate-400'
                                                    }`}>
                                                        <Clock size={12} className="text-orange-500" /> {res.reservation_time.slice(0, 5)} hs
                                                    </p>
                                                    <p className={`text-[10px] font-bold uppercase flex items-center gap-1.5 px-2 py-1 rounded-lg border ${
                                                        isLight ? 'bg-slate-50 border-slate-200 text-slate-600' : 'bg-slate-950/50 border-white/5 text-slate-400'
                                                    }`}>
                                                        <Users size={12} className="text-blue-400" /> {res.party_size} pax
                                                    </p>
                                                    <p className={`text-[10px] font-bold uppercase flex items-center gap-1.5 px-2 py-1 rounded-lg border ${
                                                        isLight ? 'bg-slate-50 border-slate-200 text-slate-600' : 'bg-slate-950/50 border-white/5 text-slate-400'
                                                    }`}>
                                                        <Smartphone size={12} className="text-emerald-400" /> {res.client_phone}
                                                    </p>
                                                </div>
                                                
                                                {/* Mostrar mesas asignadas si tiene */}
                                                {res.assigned_tables && res.assigned_tables.length > 0 && (
                                                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                                                        <span className="text-[8px] font-black uppercase text-slate-400">Mesas Asignadas:</span>
                                                        {res.assigned_tables.map((t: any) => (
                                                            <span key={t.id} className="text-[9px] font-black text-red-500 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20 uppercase">
                                                                {t.name}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="text-right flex flex-col items-end">
                                                <span className="text-[7.5px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Código de Reserva</span>
                                                <span className="text-lg font-black text-orange-500 tracking-wider bg-orange-500/10 px-4 py-1.5 rounded-xl border border-orange-500/20">{res.reservation_code}</span>
                                                {res.is_deposit_applied && (
                                                    <span className="text-[8px] font-black uppercase text-emerald-500 mt-2 flex items-center gap-1 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20 shadow-sm">
                                                        <CheckCircle2 size={10} /> Seña Descontada
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        
                                        {/* Botonera de acciones */}
                                        {(res.status === 'confirmed' || res.status === 'pending_payment') && (
                                            <div className={`flex flex-col sm:flex-row gap-2 pt-4 mt-2 border-t relative z-10 ${isLight ? 'border-slate-100' : 'border-white/5'}`}>
                                                <div className="flex gap-2 flex-1">
                                                    <button
                                                        onClick={async () => {
                                                            if(confirm('¿Seguro que deseas MARCAR COMO CANCELADA esta reserva?')) {
                                                                await supabase.from('reservations').update({ status: 'cancelled' }).eq('id', res.id);
                                                                setCalendarReservations(prev => prev.filter(r => r.id !== res.id));
                                                            }
                                                        }}
                                                        className={`flex-1 py-3.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all border flex items-center justify-center gap-1.5 ${
                                                            isLight ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100' : 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20'
                                                        }`}
                                                    >
                                                        <X size={14} /> Cancelar
                                                    </button>
                                                    <button
                                                        onClick={async () => {
                                                            if(confirm('¿Marcar cliente como ASISTIÓ? (Esto finalizará la reserva)')) {
                                                                await supabase.from('reservations').update({ status: 'completed' }).eq('id', res.id);
                                                                setCalendarReservations(prev => prev.filter(r => r.id !== res.id));
                                                            }
                                                        }}
                                                        className={`flex-1 py-3.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all border flex items-center justify-center gap-1.5 ${
                                                            isLight ? 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100' : 'bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20'
                                                        }`}
                                                    >
                                                        <Check size={14} /> Asistió
                                                    </button>
                                                </div>
                                                <button
                                                    onClick={async () => {
                                                        const msg = `¡Hola ${res.client_name}! Gracias por hacer una reserva con nosotros en ${tenant?.name || 'el local'} para el día ${res.reservation_date.split('-').reverse().join('/')} a las ${res.reservation_time.slice(0,5)} hs.\n\nTu código de reserva/descuento es: *${res.reservation_code}*.\n\nLo tenés que colocar al momento de realizar el pago de tu pedido o presentarlo al llegar. No olvides guardarlo, ya que sin él no podremos aplicar el descuento de la seña que acabas de pagar.\n\n¡Te esperamos!`;
                                                        window.open(`https://wa.me/${cleanArgPhone(res.client_phone)}?text=${encodeURIComponent(msg)}`, '_blank');
                                                        if (!res.message_sent) {
                                                            await supabase.from('reservations').update({ message_sent: true }).eq('id', res.id);
                                                            setCalendarReservations(prev => prev.map(r => r.id === res.id ? { ...r, message_sent: true } : r));
                                                        }
                                                    }}
                                                    className={`w-full sm:w-auto flex-[2] py-3.5 text-white font-black rounded-xl text-[9.5px] uppercase tracking-wider shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 border ${
                                                        !res.message_sent 
                                                            ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30 border-emerald-500 animate-pulse ring-2 ring-emerald-500/50 ring-offset-2 ring-offset-slate-900' 
                                                            : 'bg-emerald-700/80 hover:bg-emerald-600 border-emerald-600/50'
                                                    }`}
                                                >
                                                    <span className="text-lg">💬</span> {res.message_sent ? 'Reenviar WhatsApp' : 'Enviar Código x WhatsApp'}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        );
                    })()}
                </div>
            ) : null}
                                         {/* Offline Queue Modal (Mantiene funcionalidad al 100%) */}
            {showOfflineQueue && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center px-4 bg-black/80 backdrop-blur-md animate-in fade-in">
                    <div className={`w-full max-w-sm rounded-[2.5rem] p-6 space-y-4 shadow-2xl flex flex-col max-h-[80vh] border transition-all ${
                        isLight ? 'bg-white border-slate-200/80' : 'glass border-white/10'
                    }`}>
                        <div className={`flex justify-between items-center pb-2 border-b ${
                            isLight ? 'border-slate-200/60' : 'border-white/5'
                        }`}>
                            <h3 className="text-lg font-black uppercase italic text-orange-500">Pedidos Offline</h3>
                            <button onClick={() => setShowOfflineQueue(false)} className={`p-2 transition-all ${
                                isLight ? 'text-slate-400 hover:text-slate-900' : 'text-slate-500 hover:text-white'
                            }`}><X /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar">
                            {queue.map(order => (
                                <div key={order.id} className={`rounded-2xl p-4 border space-y-2 transition-colors ${
                                    isLight ? 'bg-slate-50 border-slate-200/60' : 'bg-slate-900/50 border-white/5'
                                }`}>
                                    <div className="flex justify-between items-start">
                                        <span className={`text-sm font-black transition-colors ${isLight ? 'text-slate-900' : 'text-white'}`}>{order.client_name}</span>
                                        <span className="text-[9px] font-bold text-slate-500 uppercase">{new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    <div className="space-y-1">
                                        {order.items.map((item, idx) => {
                                            const p = products.find(prod => prod.id === item.product_id);
                                            return (
                                                <div key={idx} className={`flex justify-between text-[10px] ${isLight ? 'text-slate-650' : 'text-slate-400'}`}>
                                                    <span>{item.quantity}x {(item as any).notes ? `${(item as any).notes} (${p?.name || 'Producto'})` : (p?.name || 'Producto')}</span>
                                                    <span>{formatARS(item.unit_price * item.quantity)}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className={`pt-2 border-t flex justify-between items-center ${isLight ? 'border-slate-200/60' : 'border-white/5'}`}>
                                        <span className="text-[10px] font-black text-orange-500 uppercase">Total</span>
                                        <span className={`text-sm font-black transition-colors ${isLight ? 'text-slate-900' : 'text-white'}`}>{formatARS(order.total_price)}</span>
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

            {/* Modal de Cobro Cruzado Premium */}
            {crossPaymentOrder && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center px-4 bg-black/80 backdrop-blur-md animate-in fade-in">
                    <div className={`w-full max-w-sm rounded-[2.5rem] p-6 space-y-4 shadow-2xl flex flex-col animate-in zoom-in-95 border transition-all ${
                        isLight ? 'bg-white border-slate-200/80' : 'glass border-white/10'
                    }`}>
                        <div className={`flex justify-between items-center pb-2 border-b ${
                            isLight ? 'border-slate-200/60' : 'border-white/5'
                        }`}>
                            <h3 className="text-[11px] font-black uppercase italic text-orange-500 tracking-wider">💰 Registrar Pago / Cobrar</h3>
                            <button onClick={() => setCrossPaymentOrder(null)} className={`p-2 transition-all ${
                                isLight ? 'text-slate-400 hover:text-slate-900' : 'text-slate-500 hover:text-white'
                            }`}><X size={15} /></button>
                        </div>
                        
                        <div className="space-y-3 py-1">
                            <div className={`p-4 rounded-2xl border space-y-1.5 text-xs transition-colors ${
                                isLight ? 'bg-slate-50 border-slate-200/60' : 'bg-slate-900/60 border-white/5'
                            }`}>
                                <p className="text-[8.5px] font-black text-slate-500 uppercase tracking-widest">Detalles de la Comanda</p>
                                <p className={`font-extrabold leading-none ${isLight ? 'text-slate-900' : 'text-white'}`}>Cliente: {crossPaymentOrder.client_name}</p>
                                {crossPaymentOrder.table_number && (
                                    <p className="text-[9px] font-black text-blue-400">Mesa: {crossPaymentOrder.table_number}</p>
                                )}
                                
                                {tenant?.tips_enabled && crossPaymentOrder.delivery_type !== 'delivery' && (
                                    <>
                                        {(crossPaymentOrder.tip_amount || 0) > 0 && (
                                            <div className="pt-2 flex items-center justify-between mt-2 border-t border-slate-200/50 dark:border-white/5">
                                                <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                                                    Propina del Cliente
                                                    <button 
                                                        onClick={() => {
                                                            if(confirm('¿Seguro que deseas eliminar la propina que dejó el cliente?')) {
                                                                const newTotal = Math.max(0, crossPaymentOrder.total_price - (crossPaymentOrder.tip_amount || 0));
                                                                setCrossPaymentOrder({
                                                                    ...crossPaymentOrder,
                                                                    tip_amount: 0,
                                                                    total_price: newTotal
                                                                });
                                                            }
                                                        }}
                                                        className="ml-1 text-[8px] bg-red-500/10 text-red-500 px-1.5 py-0.5 rounded hover:bg-red-500/20 transition-colors"
                                                    >
                                                        <Trash2 size={10} className="inline mr-0.5" /> Eliminar
                                                    </button>
                                                </label>
                                                <span className="text-xs font-black text-slate-500">${crossPaymentOrder.tip_amount?.toLocaleString('es-AR')}</span>
                                            </div>
                                        )}
                                        <div className="pt-2 flex items-center justify-between mt-2 border-t border-slate-200/50 dark:border-white/5">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase">Propina (Agregada en Caja)</label>
                                            <div className="relative w-24">
                                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">$</span>
                                                <input 
                                                    type="number" 
                                                    value={additionalTipAmount || ''} 
                                                    onChange={(e) => setAdditionalTipAmount(Number(e.target.value))}
                                                    className={`w-full pl-5 pr-2 py-1 rounded text-xs font-bold outline-none ${
                                                        isLight ? 'bg-white border border-slate-200 text-slate-900' : 'bg-slate-950 border border-white/10 text-white'
                                                    }`}
                                                />
                                            </div>
                                        </div>
                                    </>
                                )}
                                
                                <p className="text-sm font-black text-orange-500 pt-1 border-t border-slate-200/50 dark:border-white/5 mt-2">
                                    Total a Cobrar: {formatARS(crossPaymentOrder.total_price + additionalTipAmount)}
                                </p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[8.5px] font-black uppercase text-slate-400 tracking-wider block">Método de Pago Recibido</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {(['efectivo', 'debito', 'credito'] as const).map((method) => (
                                        <button
                                            key={method}
                                            type="button"
                                            onClick={() => setCrossPaymentMethod(method)}
                                            className={`py-3 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all border ${
                                                crossPaymentMethod === method
                                                    ? 'bg-orange-50 text-slate-950 border-orange-400 font-black'
                                                    : (isLight 
                                                        ? 'bg-slate-100 text-slate-650 border-slate-200 hover:text-slate-900 hover:bg-slate-200' 
                                                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white')
                                            }`}
                                        >
                                            {method === 'efectivo' ? '💵 Efectivo' : method === 'debito' ? '💳 Débito' : '💳 Crédito'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-2 pt-1">
                                <button
                                    disabled={isSubmitting}
                                    onClick={() => setCrossPaymentOrder(null)}
                                    className={`col-span-1 py-4 font-black rounded-2xl text-[9px] uppercase tracking-wider transition-all border ${
                                        isLight 
                                            ? 'bg-slate-100 hover:bg-slate-250 border-slate-200 text-slate-650' 
                                            : 'bg-slate-800 text-slate-400 border-transparent hover:text-white'
                                    }`}
                                >
                                    Cancelar
                                </button>
                                <button
                                    disabled={isSubmitting}
                                    onClick={() => handleConfirmPayment(crossPaymentOrder, crossPaymentMethod, false)}
                                    className="col-span-2 py-4 bg-orange-500 hover:bg-orange-400 text-slate-950 font-black rounded-2xl text-[11px] uppercase tracking-widest shadow-xl shadow-orange-500/20 active:scale-95 transition-all disabled:opacity-50"
                                >
                                    Confirmar Cobro
                                </button>
                            </div>

                            {(tenant as any)?.afip_enabled && (
                                <div className={`mt-2 pt-3 border-t space-y-2 opacity-75 hover:opacity-100 transition-opacity ${
                                    isLight ? 'border-slate-200/80' : 'border-white/5'
                                }`}>
                                    <span className="text-slate-400 font-bold uppercase text-[8px] tracking-widest block">Opciones AFIP (Opcional)</span>
                                    <div className="grid grid-cols-3 gap-1">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setAfipClientType('consumidor_final');
                                                setCustomerCuit('');
                                            }}
                                            className={`py-1.5 rounded-lg transition-all border flex flex-col items-center justify-center gap-0.5 ${
                                                afipClientType === 'consumidor_final'
                                                    ? 'bg-slate-700 text-white border-slate-600 shadow-sm'
                                                    : (isLight ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-slate-900/50 text-slate-500 border-slate-800 hover:text-slate-300')
                                            }`}
                                        >
                                            <span className="text-[7px] font-black uppercase tracking-wider">Cons. Final</span>
                                            <span className={`text-[6px] font-bold ${afipClientType === 'consumidor_final' ? 'text-slate-300' : 'text-slate-500/80'}`}>Factura {(tenant as any)?.afip_condicion_iva?.toLowerCase().includes('monotribut') ? 'C' : 'B'}</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setAfipClientType('monotributista')}
                                            className={`py-1.5 rounded-lg transition-all border flex flex-col items-center justify-center gap-0.5 ${
                                                afipClientType === 'monotributista'
                                                    ? 'bg-slate-700 text-white border-slate-600 shadow-sm'
                                                    : (isLight ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-slate-900/50 text-slate-500 border-slate-800 hover:text-slate-300')
                                            }`}
                                        >
                                            <span className="text-[7px] font-black uppercase tracking-wider">Monotributo</span>
                                            <span className={`text-[6px] font-bold ${afipClientType === 'monotributista' ? 'text-slate-300' : 'text-slate-500/80'}`}>Factura {(tenant as any)?.afip_condicion_iva?.toLowerCase().includes('monotribut') ? 'C' : 'A'}</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setAfipClientType('responsable_inscripto')}
                                            className={`py-1.5 rounded-lg transition-all border flex flex-col items-center justify-center gap-0.5 ${
                                                afipClientType === 'responsable_inscripto'
                                                    ? 'bg-slate-700 text-white border-slate-600 shadow-sm'
                                                    : (isLight ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-slate-900/50 text-slate-500 border-slate-800 hover:text-slate-300')
                                            }`}
                                        >
                                            <span className="text-[7px] font-black uppercase tracking-wider">Resp. Inscripto</span>
                                            <span className={`text-[6px] font-bold ${afipClientType === 'responsable_inscripto' ? 'text-slate-300' : 'text-slate-500/80'}`}>Factura {(tenant as any)?.afip_condicion_iva?.toLowerCase().includes('monotribut') ? 'C' : 'A'}</span>
                                        </button>
                                    </div>
                                    
                                    <div className="pt-1 animate-in slide-in-from-top-2 duration-255">
                                        <input
                                            type="text"
                                            placeholder={afipClientType === 'consumidor_final' ? "DNI / CUIT *" : "CUIT *"}
                                            value={customerCuit}
                                            onChange={(e) => setCustomerCuit(e.target.value)}
                                            className={`w-full border rounded-lg py-1.5 px-3 text-[10px] font-bold outline-none transition-all ${
                                                isLight 
                                                    ? 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-slate-400' 
                                                    : 'bg-slate-900/50 border-slate-800 text-white placeholder:text-slate-600 focus:border-slate-600'
                                            }`}
                                        />
                                    </div>

                                    <button
                                        disabled={isSubmitting}
                                        onClick={() => handleConfirmPayment(crossPaymentOrder, crossPaymentMethod, true)}
                                        className={`w-full py-2.5 font-bold rounded-xl text-[9px] uppercase tracking-wider shadow-sm active:scale-95 transition-all disabled:opacity-50 ${
                                            isLight ? 'bg-slate-200 hover:bg-slate-300 text-slate-700' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                                        }`}
                                    >
                                        {isSubmitting ? 'Facturando...' : 'Cobrar con Factura AFIP'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
            
            {/* Modal de Opciones y Pregunta Personalizada */}
            {questionModalProduct && (
                <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="glass w-full max-w-sm rounded-[2rem] p-6 shadow-2xl border border-white/10 text-center max-h-[90vh] overflow-y-auto custom-scrollbar">
                        <h2 className="text-lg font-black text-white mb-1">{questionModalProduct.name}</h2>
                        <p className="text-xs text-slate-400 mb-4 font-semibold">Personalizar pedido</p>
                        
                        {(() => {
                            const optionalIngs = (productIngredients || []).filter((pi: any) => pi.product_id === questionModalProduct.id && pi.is_optional);
                            return (
                                <div className="space-y-4 text-left">
                                    {optionalIngs.length > 0 && (
                                        <div className="space-y-2">
                                            <label className="block text-xs font-black uppercase tracking-wider text-orange-400">
                                                Elegí una opción (Obligatorio) *
                                            </label>
                                            <div className="grid grid-cols-1 gap-2">
                                                {optionalIngs.map((opt: any) => {
                                                    const ing = ingredients.find(i => i.id === opt.ingredient_id);
                                                    if (!ing) return null;
                                                    const isSelected = questionModalSelectedOption === ing.id;
                                                    return (
                                                        <button
                                                            key={ing.id}
                                                            type="button"
                                                            onClick={() => setQuestionModalSelectedOption(ing.id)}
                                                            className={`w-full text-left p-3.5 rounded-2xl border-2 transition-all flex items-center justify-between ${
                                                                isSelected 
                                                                    ? 'border-orange-500 bg-orange-500/10 text-orange-500 shadow-sm' 
                                                                    : 'border-slate-800 bg-slate-900/50 hover:border-slate-700 text-white'
                                                            }`}
                                                        >
                                                            <span className="font-bold text-sm">{ing.name}</span>
                                                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                                                isSelected ? 'border-orange-500 bg-orange-500' : 'border-slate-600'
                                                            }`}>
                                                                {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-2">
                                            {questionModalProduct.custom_question || 'Aclaraciones / Aderezos (Opcional)'}
                                            {optionalIngs.length === 0 && questionModalProduct.is_question_required && <span className="text-red-500 ml-1">*</span>}
                                        </label>
                                        <textarea
                                            value={questionModalAnswer || ''}
                                            onChange={(e) => setQuestionModalAnswer(e.target.value)}
                                            placeholder="Ej: Ketchup, sin cebolla, etc."
                                            className="w-full rounded-2xl p-3.5 min-h-[80px] bg-slate-900/50 border border-slate-700 text-white outline-none focus:border-orange-500 transition-all text-xs"
                                        />
                                    </div>
                                </div>
                            );
                        })()}

                        <div className="flex gap-3 mt-6">
                            <button 
                                type="button" 
                                onClick={() => { 
                                    setQuestionModalProduct(null); 
                                    setQuestionModalSelectedOption(''); 
                                    setQuestionModalAnswer(''); 
                                }} 
                                className="flex-1 py-3 bg-slate-800 text-white rounded-xl font-bold text-sm hover:bg-slate-700 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button 
                                type="button" 
                                onClick={() => {
                                    const optionalIngs = (productIngredients || []).filter((pi: any) => pi.product_id === questionModalProduct.id && pi.is_optional);
                                    if (optionalIngs.length > 0 && !questionModalSelectedOption) { 
                                        alert("Por favor elegí una de las opciones obligatorias"); 
                                        return; 
                                    }
                                    if (optionalIngs.length === 0 && questionModalProduct.is_question_required && (!questionModalAnswer || !questionModalAnswer.trim())) { 
                                        alert("Por favor respondé la pregunta"); 
                                        return; 
                                    }
                                    
                                    performAddToCartWithOption(questionModalProduct.id, questionModalSelectedOption, questionModalAnswer || '');
                                }} 
                                className="flex-1 py-3 bg-orange-500 text-white rounded-xl font-bold text-sm hover:bg-orange-600 transition-colors shadow-lg shadow-orange-500/20"
                            >
                                Agregar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <PrintableTicket ref={printComponentRef} order={orderToPrint} tenant={tenant} products={products} />
        </div>
    );
}
