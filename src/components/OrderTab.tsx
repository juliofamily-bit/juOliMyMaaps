'use client';

import React, { useState, useRef } from 'react';
import { Category, Product, Ingredient, OrderItem, Order } from '@/types/database';
import { Minus, Plus, Smartphone, Check, ArrowLeft, ShoppingCart, AlertCircle, X, RefreshCw, ClipboardList, CheckCircle2, Clock, User, Flame, Navigation, AlertTriangle, Printer, Trash2, ShoppingBag } from 'lucide-react';
import { supabase, broadcastTenantChange } from '@/lib/supabase';
import { useNotifications } from '@/lib/store';
import { useOfflineStore } from '@/lib/offlineStore';
import { cleanArgPhone } from '@/lib/phoneUtils';
import { useReactToPrint } from 'react-to-print';
import { PrintableTicket } from './PrintableTicket';
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

export default function OrderTab({ products, ingredients, categories, orders = [], tenant, productIngredients = [], productOffers = [], isLight = false, refetchData }: OrderTabProps) {
    const [subTab, setSubTab] = useState<'new_order' | 'deliveries'>('new_order');
    const [clientName, setClientName] = useState('');
    const [phone, setPhone] = useState('');
    const [customerCuit, setCustomerCuit] = useState('');
    const [afipClientType, setAfipClientType] = useState<'consumidor_final' | 'monotributista' | 'responsable_inscripto'>('consumidor_final');
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
    const [cart, setCart] = useState<Record<string, number>>({});
    const [showSummary, setShowSummary] = useState(false);
    const [showOfflineQueue, setShowOfflineQueue] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { addNotification } = useNotifications();
    const { addToQueue, syncQueue, queue } = useOfflineStore();

    // NUEVOS ESTADOS DE COBRO CRUZADO, BUSCADOR Y MÉTODOS DE PAGO NATIVOS
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'efectivo' | 'debito' | 'credito' | 'rappi' | 'pedidosya'>('efectivo');
    const [searchQuery, setSearchQuery] = useState('');
    const [crossPaymentOrder, setCrossPaymentOrder] = useState<Order | null>(null);
    const [crossPaymentMethod, setCrossPaymentMethod] = useState<'efectivo' | 'debito' | 'credito'>('efectivo');
    const [deliveriesSubTab, setDeliveriesSubTab] = useState<'pending' | 'completed'>('pending');

    const [orderToPrint, setOrderToPrint] = useState<Order | null>(null);

    // Estados y Búsqueda del Club de Clientes y Fidelización en Caja (MyMapps 2026)
    const [loyaltyAccount, setLoyaltyAccount] = useState<any>(null);
    const [useLoyaltyDiscount, setUseLoyaltyDiscount] = useState(false);

    React.useEffect(() => {
        if (!tenant?.id || !phone.trim() || phone.trim().length < 6) {
            setLoyaltyAccount(null);
            setUseLoyaltyDiscount(false);
            return;
        }

        const timer = setTimeout(async () => {
            try {
                const { data, error } = await supabase
                    .from('loyalty_accounts')
                    .select('*')
                    .eq('tenant_id', tenant.id)
                    .eq('phone_number', phone.trim())
                    .single();

                if (!error && data) {
                    setLoyaltyAccount(data);
                } else {
                    setLoyaltyAccount(null);
                }
            } catch (e) {
                setLoyaltyAccount(null);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [phone, tenant?.id]);

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

    const printComponentRef = useRef<HTMLDivElement>(null);
    const handlePrint = useReactToPrint({
        contentRef: printComponentRef,
        onAfterPrint: () => setOrderToPrint(null),
    });
    const triggerPrint = (order: Order) => {
        setOrderToPrint(order);
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

            // Primer intento: incluir is_approved_for_production
            const { error: firstAttemptError } = await supabase
                .from('orders')
                .update({ 
                    payment_status: 'pagado', 
                    payment_method: finalMethod,
                    is_approved_for_production: true
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
                        payment_method: finalMethod
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
            
            // Archivar todas las órdenes activas vinculadas a esta mesa
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

        // Calcular descuento por fidelidad (Monedero Virtual MyMapps 2026)
        let loyaltyRedemption = 0;
        if (useLoyaltyDiscount && loyaltyAccount && tenant?.loyalty_enabled !== false) {
            const config = tenant?.loyalty_config || {};
            const redeemChannel = config.redeem_channel || 'both';
            const isSalonAllowed = redeemChannel === 'both' || redeemChannel === 'salon';

            if (isSalonAllowed) {
                loyaltyRedemption = Math.min(parseFloat(loyaltyAccount.balance) || 0, totalPrice);
            }
        }

        const finalTotal = Math.max(0, totalPrice - loyaltyRedemption);

        const orderData = {
            client_name: clientName,
            phone_number: phone,
            total_price: finalTotal,
            items: Object.entries(cart).map(([productId, quantity]) => ({
                product_id: productId,
                quantity,
                unit_price: getProductFinalPrice(productId)
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
                    loyalty_discount_applied: loyaltyRedemption
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
                        loyalty_discount_applied: loyaltyRedemption
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

            // Debitar el saldo usado en el monedero del cliente de forma atómica en Supabase (Caja MyMapps)
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
                const qty = i.quantity;
                const price = i.unit_price;

                const prod = products.find(p => p.id === pid);
                const category = categories.find(c => c.id === prod?.category_id);
                const catDepts = category?.target_departments || ['kitchen'];

                // Si la categoría tiene un único depto
                if (catDepts.length === 1) {
                    orderItemsToInsert.push({
                        order_id: order.id,
                        product_id: pid,
                        quantity: qty,
                        unit_price: price,
                        status: 'pending',
                        tenant_id: tenant?.id,
                        target_departments: catDepts,
                        is_served: false,
                        notes: ''
                    });
                    return;
                }

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
                        target_departments: ['kitchen'],
                        is_served: false,
                        notes: ''
                    });
                    return;
                }

                const deptsMap: Record<string, string[]> = {};
                recipe.forEach(ri => {
                    const ing = ingredients.find(ingr => ingr.id === ri.ingredient_id);
                    const depts = (ing?.target_departments && ing.target_departments.length > 0) ? ing.target_departments : ['kitchen'];
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
                        target_departments: deptsFound.length === 1 ? [deptsFound[0]] : ['kitchen'],
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
                            notes: deptsMap[d].join(' + ') // Nombre específico del componente
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
            alert("¡Pedido creado y notificado correctamente!");

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
            setClientName('');
            setPhone('');
            setSelectedCategoryId(null);
            setShowSummary(false);
            setIsSubmitting(false);
            setUseLoyaltyDiscount(false);
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
                    {Object.entries(cart).map(([id, qty]) => {
                        const p = products.find(item => item.id === id);
                        return (
                            <div key={id} className={`flex flex-col gap-2 p-3 rounded-2xl ${isLight ? 'bg-slate-50 border border-slate-100' : 'bg-slate-900/50'}`}>
                                <div className="flex justify-between items-center">
                                    <span className="font-bold text-sm"><span className="text-orange-500">{qty}x</span> {p?.name}</span>
                                    <span className="font-black text-sm">{formatARS(getProductFinalPrice(id) * qty)}</span>
                                </div>
                                <div className="flex items-center justify-end gap-2 mt-1">
                                    <button onClick={() => removeFromCart(id)} className={`w-7 h-7 rounded-lg flex items-center justify-center font-black transition-all ${isLight ? 'bg-slate-200 text-slate-700 hover:bg-slate-300' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>-</button>
                                    <span className="text-xs font-bold w-4 text-center">{qty}</span>
                                    <button onClick={() => addToCart(id)} className={`w-7 h-7 rounded-lg flex items-center justify-center font-black transition-all ${isLight ? 'bg-slate-200 text-slate-700 hover:bg-slate-300' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>+</button>
                                    <button onClick={() => {
                                        setCart(prev => {
                                            const { [id]: _, ...rest } = prev;
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
                        {useLoyaltyDiscount && loyaltyAccount && tenant?.loyalty_enabled !== false && (() => {
                            const loyaltyRedemption = Math.min(parseFloat(loyaltyAccount.balance) || 0, totalPrice);
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

                    {loyaltyAccount && tenant?.loyalty_enabled !== false && (() => {
                        const config = tenant?.loyalty_config || {};
                        const redeemChannel = config.redeem_channel || 'both';
                        const isSalonAllowed = redeemChannel === 'both' || redeemChannel === 'salon';
                        if (!isSalonAllowed) return null;

                        return (
                            <div className="bg-orange-500/10 border border-orange-500/30 p-4 rounded-[2rem] text-left space-y-2.5 animate-in slide-in-from-bottom-2 duration-300">
                                <div className="flex justify-between items-center">
                                    <span className="text-[9px] font-black uppercase text-orange-400 flex items-center gap-1.5">
                                        🎁 Monedero Club Clientes (Nivel {loyaltyAccount.tier.toUpperCase()})
                                    </span>
                                    <span className="text-xs font-black text-orange-400 font-mono">
                                        {formatARS(parseFloat(loyaltyAccount.balance) || 0)}
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setUseLoyaltyDiscount(!useLoyaltyDiscount)}
                                    className={`w-full py-2.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all active:scale-95 flex items-center justify-center gap-1.5 ${
                                        useLoyaltyDiscount
                                            ? 'bg-orange-500 text-slate-950 shadow-lg shadow-orange-500/30 font-black'
                                            : 'bg-slate-950 border border-slate-850 text-slate-400 hover:text-white'
                                    }`}
                                >
                                    {useLoyaltyDiscount ? '✓ Saldo Descontado en Caja' : 'Descontar Saldo del Cliente'}
                                </button>
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
            <div className={`flex justify-center p-1 border rounded-2xl max-w-sm mx-auto shadow-inner transition-colors ${
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
                    <CheckCircle2 size={13} /> Entregas de Caja
                    {activeOrdersForDeliveries.length > 0 && (
                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full shrink-0 ${
                            subTab === 'deliveries' ? 'bg-slate-950 text-orange-400' : 'bg-orange-500 text-slate-950'
                        }`}>
                            {activeOrdersForDeliveries.length}
                        </span>
                    )}
                </button>
            </div>

            {subTab === 'new_order' ? (
                /* Pestaña: REGISTRAR NUEVO PEDIDO (Mantiene la funcionalidad existente al 100%) */
                <div className="space-y-6">
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

                    {selectedCategoryId && (
                        <div className="flex items-center gap-3 mb-4 animate-in slide-in-from-left-4">
                            <button
                                onClick={() => setSelectedCategoryId(null)}
                                className={`w-10 h-10 shrink-0 rounded-2xl flex items-center justify-center active:scale-95 transition-all shadow-md ${
                                    isLight ? 'bg-white text-slate-900 border border-slate-200' : 'bg-slate-900 text-white border border-slate-800'
                                }`}
                            >
                                <ArrowLeft size={18} />
                            </button>
                            <h3 className="text-xs font-black uppercase" style={{ color: tenant?.theme_colors?.primary || '#f97316' }}>
                                Volver a Categorías
                            </h3>
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
                                    className={`aspect-square rounded-[2rem] flex flex-col items-center justify-center gap-3 active:scale-95 transition-all border ${
                                        isLight 
                                            ? 'bg-white border-slate-200/65 shadow-sm text-slate-800 hover:border-orange-500/50 hover:bg-slate-50/50' 
                                            : 'glass border-white/5 hover:border-orange-500/50 text-white'
                                    }`}
                                >
                                    <span className="text-4xl neon-icon">{cat.icon}</span>
                                    <span className="font-black uppercase text-[10px] tracking-widest">{cat.name}</span>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-4 animate-in slide-in-from-right-4">
                            {(() => {
                                const selectedCategory = categories.find(c => c.id === selectedCategoryId);
                                const isOfferCategory = selectedCategory 
                                    ? (selectedCategory.is_offer === true || /oferta|oportunidad|descuento/i.test(selectedCategory.name))
                                    : false;
                                
                                const displayedProducts = products.filter(p => {
                                    if (p.is_active === false) return false;
                                    if (isOfferCategory) {
                                        return !!getActiveOfferForProduct(p.id);
                                    }
                                    return p.category_id === selectedCategoryId;
                                });

                                if (displayedProducts.length === 0) {
                                    return (
                                        <p className="text-center py-10 text-slate-600 text-[10px] font-black uppercase">Sin productos en esta categoría</p>
                                    );
                                }

                                return displayedProducts.map(product => {
                                    const qty = cart[product.id] || 0;
                                    const activeOffer = getActiveOfferForProduct(product.id);
                                    const originalPrice = product.price;
                                    const finalPrice = activeOffer
                                        ? Math.round(originalPrice * (1 - activeOffer.discount_percentage / 100))
                                        : originalPrice;

                                    return (
                                        <div key={product.id} className={`rounded-3xl p-4 flex gap-4 border transition-all ${
                                            isLight ? 'bg-white border-slate-200/60 shadow-sm text-slate-900' : 'glass border-white/5 text-white'
                                        }`}>
                                            {product.image_url && <img src={product.image_url} className="w-20 h-20 rounded-2xl object-cover" />}
                                            <div className="flex-1 flex flex-col justify-between">
                                                <div>
                                                    <h3 className={`font-black text-sm leading-tight flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                                        {product.name}
                                                        {activeOffer && <span className="bg-red-500/20 text-red-500 text-[8px] font-black uppercase px-2 py-0.5 rounded-full border border-red-500/30">-{activeOffer.discount_percentage}%</span>}
                                                    </h3>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        {activeOffer ? (
                                                            <>
                                                                <span className="text-red-400 line-through text-[11px] font-bold">{formatARS(originalPrice)}</span>
                                                                <span className="text-emerald-400 text-xs font-black uppercase">{formatARS(finalPrice)}</span>
                                                            </>
                                                        ) : (
                                                            <span className="text-orange-500 text-xs font-black uppercase">{formatARS(originalPrice)}</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center justify-end">
                                                    <div className={`flex items-center gap-2 p-1 rounded-xl border ${
                                                        isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-950/50 border-slate-800'
                                                    }`}>
                                                        <button onClick={() => removeFromCart(product.id)} className={`w-8 h-8 rounded-lg text-white flex items-center justify-center font-black transition-colors ${isLight ? 'bg-slate-300 hover:bg-slate-400 disabled:opacity-30' : 'bg-slate-800'}`} disabled={qty <= 0}>-</button>
                                                        <span className={`font-black text-xs min-w-[1.5rem] text-center ${isLight ? 'text-slate-900' : 'text-white'}`}>{qty}</span>
                                                        <button onClick={() => addToCart(product.id)} className={`w-8 h-8 rounded-lg text-white flex items-center justify-center font-black transition-colors ${isLight ? 'bg-orange-500 hover:bg-orange-600' : 'bg-orange-500'}`}>+</button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                });
                            })()}
                        </div>
                    )}

                    {totalPrice > 0 && (
                        selectedCategoryId !== null ? (
                            <div className="fixed bottom-28 left-1/2 -translate-x-1/2 w-[90%] z-[60] flex gap-3 animate-in slide-in-from-bottom-8">
                                <button
                                    onClick={() => setSelectedCategoryId(null)}
                                    className={`flex-1 py-4 rounded-[2rem] font-black uppercase text-[10px] tracking-wider transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-xl border ${
                                        isLight 
                                            ? 'bg-slate-200 border-slate-350 text-slate-700 hover:bg-slate-300' 
                                            : 'bg-slate-900 border-white/5 text-slate-300 hover:bg-slate-850'
                                    }`}
                                >
                                    ↩️ Volver a Categorías
                                </button>
                                <button
                                    onClick={() => setShowSummary(true)}
                                    className="flex-[1.2] bg-orange-500 text-white rounded-[2rem] p-4 flex justify-between items-center shadow-2xl neon-glow active:scale-95 transition-all border border-orange-400/30"
                                >
                                    <div className="flex items-center gap-2">
                                        <ShoppingCart size={16} />
                                        <span className="text-[9px] font-black uppercase tracking-wider">Ver Desglose</span>
                                    </div>
                                    <span className="text-sm font-black">{formatARS(totalPrice)}</span>
                                </button>
                            </div>
                        ) : (
                            <div className="fixed bottom-28 left-1/2 -translate-x-1/2 w-[85%] z-[60] animate-in slide-in-from-bottom-8">
                                <button
                                    onClick={() => setShowSummary(true)}
                                    className="w-full bg-orange-500 text-white rounded-[2rem] p-5 flex justify-between items-center shadow-2xl neon-glow active:scale-95 transition-all border border-orange-400/30"
                                >
                                    <div className="flex items-center gap-3">
                                        <ShoppingCart size={20} />
                                        <span className="text-[10px] font-black uppercase tracking-wider">Ver Desglose</span>
                                    </div>
                                    <span className="text-xl font-black">{formatARS(totalPrice)}</span>
                                </button>
                            </div>
                        )
                    )}
                </div>
            ) : (
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
                                                    <span>MyMapps Control</span>
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
                                                                <span className="text-[7px] bg-orange-500 text-slate-950 px-2 py-0.5 rounded font-black uppercase animate-pulse">
                                                                    Todo Preparado
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
                                                                        {prodName}
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
 
                                            {/* SECCIÓN DE ACCIÓN EXCLUSIVA DE COBRO O ARCHIVADO */}
                                            {isPendingPayment && order.origin !== 'rappi' && order.origin !== 'pedidosya' ? (
                                                <div className={`p-4 border-t flex gap-2 ${
                                                    isLight ? 'bg-slate-50 border-slate-200/60' : 'bg-slate-950/40 border-white/5'
                                                }`}>
                                                    <button
                                                        onClick={() => {
                                                            setCrossPaymentOrder(order);
                                                            setCrossPaymentMethod('efectivo');
                                                        }}
                                                        className="w-full py-3.5 bg-red-600 hover:bg-red-500 text-white font-black rounded-xl text-[9.5px] uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-1.5 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.4)] border border-red-500/30"
                                                    >
                                                        💵 Confirmar Pago / Cobrar
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
                                                        {isDeliveryType && !isExternalApp ? (
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
                                                                ) : order.phone_number ? (
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
                                                                <button
                                                                    onClick={() => handleCloseAndArchiveOrder(order)}
                                                                    className="w-full py-3.5 bg-orange-500 hover:bg-orange-400 text-slate-950 font-black rounded-xl text-[9.5px] uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-lg shadow-orange-500/25 border border-orange-400/30"
                                                                >
                                                                    📦 {isExternalApp ? 'Completar y Despachar Pedido' : 'Entregar Todo y Despachar'}
                                                                </button>
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
            )}
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
                                                    <span>{item.quantity}x {p?.name || 'Producto'}</span>
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
                                <p className="text-sm font-black text-orange-500 pt-1">Total a Cobrar: {formatARS(crossPaymentOrder.total_price)}</p>
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
            <PrintableTicket ref={printComponentRef} order={orderToPrint} tenant={tenant} products={products} />
        </div>
    );
}
