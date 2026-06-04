'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Category, Product, OrderItem, Ingredient, ProductIngredient, ProductOffer } from '@/types/database';
import { ShoppingBag, ChevronRight, Minus, Plus, X, Search, Utensils, CheckCircle, Loader2, Trash2, ChevronDown, ChevronUp, Star, BellRing, Instagram, Facebook, MessageCircle, MapPin, Map, Sun, Moon, Info, Gift } from 'lucide-react';
import { MaxesLogo } from '@/components/MaxesLogo';
import { useRealtimeData } from '@/hooks/useRealtimeData';
import { supabase, broadcastTenantChange } from '@/lib/supabase';

interface PublicMenuProps {
  tenant: any;
}

interface CartItem extends Product {
  cartItemId: string;
  quantity: number;
  notes?: string;
}

const getProductIdsArray = (pIds: any): string[] => {
  if (!pIds) return [];
  if (Array.isArray(pIds)) return pIds;
  
  const strVal = String(pIds).trim();
  if (strVal.startsWith('{') && strVal.endsWith('}')) {
    return strVal.slice(1, -1).split(',').map(s => s.replace(/["\s]/g, '')).filter(Boolean);
  }
  if (strVal.startsWith('[') && strVal.endsWith(']')) {
    try {
      return JSON.parse(strVal);
    } catch (e) {
      return strVal.slice(1, -1).split(',').map(s => s.replace(/["\s]/g, '')).filter(Boolean);
    }
  }
  return [strVal];
};

const getMapIframeSrc = (iframeString: string): string => {
  if (!iframeString) return '';
  if (iframeString.includes('<iframe')) {
    const srcMatch = iframeString.match(/src="([^"]+)"/);
    if (srcMatch && srcMatch[1]) {
      return srcMatch[1];
    }
  }
  return iframeString;
};

// Formateador robusto de número de WhatsApp para evitar errores de "número inexistente"
const formatWhatsAppNumber = (phoneStr: string): string => {
  let clean = String(phoneStr || '').replace(/\D/g, '');
  if (!clean) return '';
  
  if (clean.startsWith('0')) {
    clean = clean.substring(1);
  }
  
  // Si tiene 10 dígitos (ej: 1123456789), asumimos Argentina y agregamos prefijo internacional móvil 549
  if (clean.length === 10) {
    return '549' + clean;
  }
  
  // Si tiene 11 dígitos y empieza con 9 (ej: 9112345678), agregamos el prefijo de país 54
  if (clean.length === 11 && clean.startsWith('9')) {
    return '54' + clean;
  }
  
  // Si no empieza con ningún prefijo de la región, agregamos por defecto 549
  if (!clean.startsWith('54') && !clean.startsWith('56') && !clean.startsWith('55') && !clean.startsWith('598')) {
    return '549' + clean;
  }
  
  return clean;
};

export default function PublicMenu({ tenant }: PublicMenuProps) {
  const [isLight, setIsLight] = useState<boolean>(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme-mode');
    if (savedTheme) {
      setIsLight(savedTheme === 'light');
    } else {
      setIsLight(tenant?.theme_colors?.mode === 'light');
    }
  }, [tenant?.theme_colors?.mode]);

  const toggleTheme = () => {
    const nextTheme = !isLight;
    setIsLight(nextTheme);
    localStorage.setItem('theme-mode', nextTheme ? 'light' : 'dark');
  };

  const { 
    categories, 
    products, 
    ingredients, 
    productIngredients,
    orders = [],
    productOffers = [],
    isLoading
  } = useRealtimeData(tenant.id, true);

  const notifyChanges = () => {
    broadcastTenantChange(tenant?.id);
  };

  const loading = isLoading;

  // Helper para obtener oferta activa de un producto hoy
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

      // Validar si la oferta tiene límite físico y si ya se ha consumido por completo
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
          return false; // Límite promocional alcanzado
        }
      }

      return true;
    });
  };
  
  // States para interactividad
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedProducts, setExpandedProducts] = useState<Record<string, boolean>>({});

  const toggleProductDesc = (id: string) => {
    setExpandedProducts(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // States para Reseñas
  const [reviews, setReviews] = useState<any[]>([]);
  const [isReviewsLoading, setIsReviewsLoading] = useState(true);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [newReviewName, setNewReviewName] = useState('');
  const [newReviewRating, setNewReviewRating] = useState(5);
  const [newReviewComment, setNewReviewComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // States para Reservas y Seña
  const [isReservationModalOpen, setIsReservationModalOpen] = useState(false);
  const [reservationName, setReservationName] = useState('');
  const [reservationPhone, setReservationPhone] = useState('');
  const [reservationPhonePrefix, setReservationPhonePrefix] = useState('+54');
  const [reservationDate, setReservationDate] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  });
  const [reservationTime, setReservationTime] = useState('');
  const [reservationPartySize, setReservationPartySize] = useState<number>(2);
  const [isSubmittingReservation, setIsSubmittingReservation] = useState(false);
  
  // Pasarela virtual Mercado Pago para Reservas
  const [isMpReservationModalOpen, setIsMpReservationModalOpen] = useState(false);
  const [isMpReservationPaying, setIsMpReservationPaying] = useState(false);
  const [isMpReservationSuccess, setIsMpReservationSuccess] = useState(false);
  const [isRedirectingToPayment, setIsRedirectingToPayment] = useState(false);
  const [pendingReservationId, setPendingReservationId] = useState<string | null>(null);
  const [reservationToPayAmount, setReservationToPayAmount] = useState<number>(0);
  const [generatedReservationCode, setGeneratedReservationCode] = useState<string>('');

  // Validacion de Cupones de Seña en Carrito
  const [couponCode, setCouponCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<number>(0);
  const [validatedReservation, setValidatedReservation] = useState<any | null>(null);
  const [couponError, setCouponError] = useState('');
  const [couponSuccess, setCouponSuccess] = useState('');
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);
  const [showAntiForgetModal, setShowAntiForgetModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  
  // States del carrito
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  
  // Checkout states
  const [customerInfo, setCustomerInfo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [successOrderNumber, setSuccessOrderNumber] = useState<number | null>(null);

  // Delivery and Payment State
  const currentDayOfWeek = new Date().getDay();
  const tenantDeliveryDays = tenant?.delivery_days || [0,1,2,3,4,5,6];
  const isDeliveryActiveToday = tenantDeliveryDays.includes(currentDayOfWeek);

  const [deliveryType, setDeliveryType] = useState<'local' | 'llevar' | 'delivery'>('llevar'); // 'local' es salón (con mesa), 'llevar' (Take Away), 'delivery' (Envío)
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryMapLink, setDeliveryMapLink] = useState('');
  const [selectedDeliveryZone, setSelectedDeliveryZone] = useState<{ name: string; fee: number } | null>(null);
  const [deliveryPhone, setDeliveryPhone] = useState('');
  const [phonePrefix, setPhonePrefix] = useState('+54');
  const [deliveryLat, setDeliveryLat] = useState<number | null>(null);
  const [deliveryLng, setDeliveryLng] = useState<number | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'efectivo' | 'mercadopago' | 'credito'>('efectivo');

  // AFIP Billing States
  const [afipBillingRequested, setAfipBillingRequested] = useState(false);
  const [afipClientType, setAfipClientType] = useState<'consumidor_final' | 'monotributista' | 'responsable_inscripto'>('consumidor_final');
  const [afipDocType, setAfipDocType] = useState<'DNI' | 'CUIT'>('CUIT');
  const [afipDocNumber, setAfipDocNumber] = useState('');

  // Estados del Club de Clientes y Fidelización (Monedero Virtual MyMapps 2026)
  const [loyaltyAccount, setLoyaltyAccount] = useState<any>(null);
  const [useLoyaltyDiscount, setUseLoyaltyDiscount] = useState(false);

  useEffect(() => {
    const cleanPhone = deliveryPhone ? `${phonePrefix} ${deliveryPhone.trim()}`.trim() : '';
    if (!tenant?.id || !deliveryPhone.trim() || deliveryPhone.trim().length < 6) {
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
          .eq('phone_number', cleanPhone)
          .single();

        if (!error && data) {
          setLoyaltyAccount(data);
        } else {
          setLoyaltyAccount(null);
        }
      } catch (e) {
        setLoyaltyAccount(null);
      }
    }, 600); // 600ms de debounce para no saturar la API al escribir

    return () => clearTimeout(timer);
  }, [deliveryPhone, phonePrefix, tenant?.id]);

  // Mercado Pago pasarela virtual


  // Table and waiter calling states
  const [tableParamId, setTableParamId] = useState<string | null>(null);
  const [tableName, setTableName] = useState<string | null>(null);
  const [isCallingWaiter, setIsCallingWaiter] = useState(false);
  const [waiterCallCooldown, setWaiterCallCooldown] = useState(0);

  // Estados y referencias para el botón flotante arrastrable (Premium Glassmorphic)
  const [dragPosition, setDragPosition] = useState({ x: 24, y: 120 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = React.useRef({ x: 0, y: 0 });
  const positionStart = React.useRef({ x: 0, y: 0 });
  const dragDistance = React.useRef(0);

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    positionStart.current = { ...dragPosition };
    dragDistance.current = 0;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!isDragging) return;
    const deltaX = e.clientX - dragStart.current.x;
    const deltaY = dragStart.current.y - e.clientY; // Invertido porque bottom aumenta hacia arriba
    
    dragDistance.current = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    let newX = positionStart.current.x + deltaX;
    let newY = positionStart.current.y + deltaY;

    // Mantener dentro del Viewport con un padding de resguardo
    const padding = 10;
    const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 500;
    const screenHeight = typeof window !== 'undefined' ? window.innerHeight : 800;

    newX = Math.max(padding, Math.min(screenWidth - 170, newX));
    newY = Math.max(padding, Math.min(screenHeight - 80, newY));

    setDragPosition({ x: newX, y: newY });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const handleBtnClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (dragDistance.current > 5) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    handleCallWaiter();
  };


  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tableId = params.get('table');
      if (tableId) {
        setTableParamId(tableId);
        setTableName(tableId);
        setDeliveryType('local');
        
        const tables = tenant?.tables || [];
        const match = tables.find((t: any) => {
            const tableIdLower = (t.id || '').toLowerCase().trim();
            const tableNameLower = (t.name || '').toLowerCase().trim();
            const searchStr = tableId.toLowerCase().trim();

            if (tableIdLower === searchStr || tableNameLower === searchStr) return true;

            const numMatchSearch = searchStr.match(/\d+/);
            if (numMatchSearch) {
                const num = numMatchSearch[0];
                
                const numMatchName = tableNameLower.match(/\d+/);
                if (numMatchName && numMatchName[0] === num) return true;

                const numMatchId = tableIdLower.match(/\d+/);
                if (numMatchId && numMatchId[0] === num) return true;
                
                if (tableIdLower.includes(num)) return true;
            }
            return false;
        });
        if (match) {
          setTableName(match.name);
        }
      }

      // -----------------------------------------------------
      // DETECCIÓN DE RETORNO DE MERCADO PAGO
      // -----------------------------------------------------
      const mpStatus = params.get('collection_status');
      const orderIdRef = params.get('external_reference');
      const isReservation = params.get('reservation_id');
      
      if (mpStatus === 'approved') {
        // Limpiar URL para que no vuelva a procesar
        window.history.replaceState({}, document.title, window.location.pathname);
        
        if (isReservation) {
          // Es una reserva exitosa
          const code = generateResCode();
          setGeneratedReservationCode(code);
          
          supabase.from('reservations')
            .update({ 
              status: 'confirmed',
              reservation_code: code
            })
            .eq('id', isReservation)
            .then(({ error }) => {
              if (!error) {
                setIsMpReservationSuccess(true);
                // Notificar al local
                supabase.from('app_notifications').insert([{
                  message: `✅ Seña Pagada para Reserva (Cód: ${code})`,
                  type: 'info',
                  target_roles: ['admin', 'staff'],
                  tenant_id: tenant?.id || ''
                }]).then();
              }
            });
        } else if (orderIdRef) {
          // Actualizar el pedido en la base de datos
          supabase.from('orders')
            .update({ 
              payment_status: 'pagado', 
              is_approved_for_production: true,
              status: 'pending'
            })
            .eq('id', orderIdRef)
            .then(({ error }) => {
              if (!error) {
                setOrderSuccess(true);
                setSuccessOrderNumber(0); // 0 indica pedido online
                
                // Notificar al local
                supabase.from('app_notifications').insert([{
                  message: `✅ Pago Online Aprobado para el pedido (Ref: ${orderIdRef.substring(0,6)})`,
                  type: 'info',
                  target_roles: ['admin', 'staff'],
                  tenant_id: tenant?.id || ''
                }]).then();

                setTimeout(() => {
                  setOrderSuccess(false);
                  setSuccessOrderNumber(null);
                  setIsCartOpen(false);
                }, 18000);
              }
            });
        }
      }
    }
  }, [tenant]);

  useEffect(() => {
    if (waiterCallCooldown > 0) {
      const timer = setTimeout(() => setWaiterCallCooldown(prev => prev - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [waiterCallCooldown]);

  // Carga y Realtime de Reseñas
  useEffect(() => {
    if (!tenant?.id) return;

    const fetchReviews = async () => {
      setIsReviewsLoading(true);
      try {
        const { data, error } = await supabase
          .from('reviews')
          .select('*')
          .eq('tenant_id', tenant.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setReviews(data || []);
      } catch (err) {
        console.error('Error al cargar reseñas:', err);
      } finally {
        setIsReviewsLoading(false);
      }
    };

    fetchReviews();

    const channel = supabase
      .channel(`public:reviews:tenant:${tenant.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reviews',
          filter: `tenant_id=eq.${tenant.id}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setReviews(prev => [payload.new, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setReviews(prev => prev.map(r => r.id === payload.new.id ? payload.new : r));
          } else if (payload.eventType === 'DELETE') {
            setReviews(prev => prev.filter(r => r.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenant?.id]);

  // Cálculo de promedio de calificaciones
  const { avgRating, totalReviews } = useMemo(() => {
    if (!reviews || reviews.length === 0) {
      return { avgRating: '5.0', totalReviews: 0 };
    }
    const sum = reviews.reduce((acc, r) => acc + (r.rating || 5), 0);
    const avg = sum / reviews.length;
    return {
      avgRating: avg.toFixed(1),
      totalReviews: reviews.length
    };
  }, [reviews]);

  // Desestructuración segura del perfil del local y enlaces sociales
  const profilePictureUrl = tenant.profile_picture_url || '';
  const bannerUrl = tenant.banner_url || '';
  const reviewsEnabled = tenant.reviews_enabled !== false; // Habilitado por defecto
  const reservationsEnabled = tenant.reservations_enabled === true;
  const reservationDepositAmount = tenant.reservation_deposit_amount || 0;

  const socialLinks = useMemo(() => {
    const defaultLinks = { instagram: '', facebook: '', whatsapp: '', address: '', google_maps_url: '', maps_iframe: '' };
    if (!tenant.social_links) {
      return defaultLinks;
    }
    if (typeof tenant.social_links === 'string') {
      try {
        return { ...defaultLinks, ...JSON.parse(tenant.social_links) };
      } catch (e) {
        return defaultLinks;
      }
    }
    return { ...defaultLinks, ...tenant.social_links };
  }, [tenant.social_links]);

  // Límites de fecha para la reserva (mínimo hoy, máximo 1 mes en el futuro)
  const reservationDateLimits = useMemo(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const minDateStr = `${yyyy}-${mm}-${dd}`;
    
    const maxDate = new Date();
    maxDate.setMonth(maxDate.getMonth() + 1);
    const maxYYYY = maxDate.getFullYear();
    const maxMM = String(maxDate.getMonth() + 1).padStart(2, '0');
    const maxDD = String(maxDate.getDate()).padStart(2, '0');
    const maxDateStr = `${maxYYYY}-${maxMM}-${maxDD}`;
    
    return { min: minDateStr, max: maxDateStr };
  }, []);

  // Guardar nueva reseña en Supabase
  const handleSubmitReview = async () => {
    if (!newReviewName.trim()) {
      alert("⚠️ Por favor ingresa tu Nombre.");
      return;
    }

    setIsSubmittingReview(true);
    try {
      const { error } = await supabase
        .from('reviews')
        .insert([
          {
            tenant_id: tenant.id,
            client_name: newReviewName.trim(),
            rating: newReviewRating,
            comment: newReviewComment.trim()
          }
        ]);

      if (error) throw error;
      
      setIsReviewModalOpen(false);
      setNewReviewName('');
      setNewReviewRating(5);
      setNewReviewComment('');
      
      alert("🎉 ¡Muchas gracias por tu reseña! Tu opinión es muy valiosa para nosotros.");
    } catch (err) {
      console.error('Error al guardar la reseña:', err);
      alert("⚠️ Ocurrió un error al guardar tu reseña. Por favor intenta de nuevo.");
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // (El control automático de ocupación por QR fue eliminado a pedido del usuario)

  // 2. Mesas Libres ahora
  const freeTablesCount = useMemo(() => {
    const tables = tenant?.tables || [];
    return tables.filter((t: any) => !t.is_occupied).length;
  }, [tenant?.tables]);

  // Generador de Código de Reserva (6 caracteres en mayúsculas)
  const generateResCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'RES-';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  // 3. Crear Reserva en Supabase
  const handleSubmitReservation = async () => {
    if (!reservationName.trim() || !reservationPhone.trim() || !reservationDate || !reservationTime) {
      alert("⚠️ Por favor completa todos los campos del formulario.");
      return;
    }

    // Validar rango de fecha (mínimo hoy, máximo 1 mes en el futuro)
    const selectedDate = new Date(reservationDate + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const maxDate = new Date();
    maxDate.setMonth(maxDate.getMonth() + 1);
    maxDate.setHours(23, 59, 59, 999);

    if (selectedDate < today) {
      alert("⚠️ No puedes seleccionar una fecha en el pasado.");
      return;
    }

    if (selectedDate > maxDate) {
      alert("⚠️ Solo puedes reservar con un máximo de 1 mes de anticipación.");
      return;
    }

    setIsSubmittingReservation(true);
    try {
      const depositAmount = tenant.reservation_deposit_amount || 0;
      const status = depositAmount > 0 ? 'pending_payment' : 'confirmed';
      const code = status === 'confirmed' ? generateResCode() : '';
      const finalReservationPhone = reservationPhone ? `${reservationPhonePrefix} ${reservationPhone.trim()}` : '';

      const newReservation = {
        tenant_id: tenant.id,
        client_name: reservationName.trim(),
        client_phone: finalReservationPhone,
        reservation_date: reservationDate,
        reservation_time: reservationTime,
        party_size: reservationPartySize,
        status: status,
        deposit_amount: depositAmount,
        reservation_code: code || null,
        is_deposit_applied: false
      };

      const { data, error } = await supabase
        .from('reservations')
        .insert([newReservation])
        .select()
        .single();

      if (error) throw error;

      if (depositAmount > 0) {
        setIsReservationModalOpen(false);
        setPendingReservationId(data.id);
        setReservationToPayAmount(depositAmount);
        handleConfirmReservationPayment(data.id, depositAmount);
      } else {
        setIsReservationModalOpen(false);
        alert(`🎉 ¡Reserva Confirmada con éxito!\n\nTu Código de Reserva es: ${code}\nTe esperamos.`);
      }
    } catch (err) {
      console.error('Error al registrar la reserva:', err);
      alert("⚠️ Ocurrió un error al registrar tu reserva. Por favor intenta de nuevo.");
    } finally {
      setIsSubmittingReservation(false);
    }
  };

  // 4. Pago de Seña de Reserva con Mercado Pago
  const handleConfirmReservationPayment = async (reservationId: string, depositAmount: number) => {
    if (!reservationId) return;
    setIsMpReservationPaying(true);

    if (!tenant?.mercadopago_access_token) {
      alert("⚠️ El local no tiene habilitados los pagos online.");
      setIsMpReservationPaying(false);
      return;
    }

    try {
      setIsRedirectingToPayment(true);
      let currentDomain = window.location.origin;
      const isLocalhost = window.location.hostname === 'localhost' || 
                          window.location.hostname === '127.0.0.1';
      if (currentDomain.startsWith('http://') && !isLocalhost) {
        currentDomain = currentDomain.replace('http://', 'https://');
      }

      // Obtener el monto de la seña de la base de datos
      const { data: resData, error: resError } = await supabase
        .from('reservations')
        .select('deposit_amount')
        .eq('id', pendingReservationId)
        .single();

      if (resError || !resData) throw new Error("No se pudo obtener el monto de la seña.");

      const response = await fetch('/api/mercadopago/create-preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken: tenant.mercadopago_access_token,
          external_reference: pendingReservationId,
          items: [
            {
              title: `Seña de Reserva - ${tenant.name}`,
              unit_price: depositAmount || tenant.reservation_deposit_amount,
              quantity: 1,
              currency_id: 'ARS'
            }
          ],
          back_urls: {
            success: `${currentDomain}/${tenant.slug}/menu?reservation_id=${reservationId}`,
            failure: `${currentDomain}/${tenant.slug}/menu?reservation_id=${reservationId}`,
            pending: `${currentDomain}/${tenant.slug}/menu?reservation_id=${reservationId}`
          }
        })
      });

      const data = await response.json();
      if (data.init_point) {
        window.location.href = data.init_point;
      } else {
        throw new Error(data.error || "Error al generar pasarela de pago para la reserva");
      }
    } catch (err) {
      console.error('Error al iniciar pago de reserva:', err);
      alert("⚠️ Error al acreditar el pago. Por favor intenta de nuevo.");
      setIsMpReservationPaying(false);
      setIsRedirectingToPayment(false);
    }
  };

  // 5. Validar Cupón de Reserva en el Carrito (Caja y Anti-Fraude)
  const handleValidateCoupon = async () => {
    if (!couponCode.trim()) {
      setCouponError('⚠️ Por favor ingresa un código.');
      return;
    }

    setIsValidatingCoupon(true);
    setCouponError('');
    setCouponSuccess('');
    
    try {
      let cleanCode = couponCode.replace(/\s+/g, '').toUpperCase();
      if (cleanCode.length === 4 && !cleanCode.startsWith('RES-')) {
        cleanCode = 'RES-' + cleanCode;
      }
      
      // 1. Buscar en reservas
      const { data: resData } = await supabase
        .from('reservations')
        .select('*')
        .eq('reservation_code', cleanCode)
        .eq('tenant_id', tenant.id)
        .maybeSingle();

      if (resData) {
        if (resData.status !== 'confirmed') {
          setCouponError('❌ Esta reserva no se encuentra confirmada.');
          setAppliedDiscount(0);
          setValidatedReservation(null);
          return;
        }
        if (resData.is_deposit_applied === true) {
          setCouponError('❌ Este código ya fue utilizado en otro pedido.');
          setAppliedDiscount(0);
          setValidatedReservation(null);
          return;
        }
        // Reserva válida
        setCouponSuccess(`✅ ¡Reserva Válida! Seña de $${resData.deposit_amount} descontada.`);
        setAppliedDiscount(resData.deposit_amount || 0);
        setValidatedReservation({ type: 'reservation', data: resData });
        return;
      }

      // 2. Si no es reserva, buscar en discount_codes
      const { data: codeData } = await supabase
        .from('discount_codes')
        .select('*')
        .eq('code', cleanCode)
        .eq('tenant_id', tenant.id)
        .maybeSingle();

      if (codeData) {
        if (codeData.is_used) {
          setCouponError('❌ Este código de descuento ya fue utilizado.');
          setAppliedDiscount(0);
          setValidatedReservation(null);
          return;
        }
        // Código válido
        setCouponSuccess(`✅ ¡Código Válido! Descuento de $${codeData.discount_amount} aplicado.`);
        setAppliedDiscount(codeData.discount_amount || 0);
        setValidatedReservation({ type: 'discount_code', data: codeData });
        return;
      }

      // Si no encontró nada
      setCouponError('❌ Código inexistente o no válido para este local.');
      setAppliedDiscount(0);
      setValidatedReservation(null);

    } catch (err) {
      console.error('Error al validar código:', err);
      setCouponError('⚠️ Error de conexión al validar.');
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  const handleCallWaiter = async () => {
    if (!tenant || !tableParamId || waiterCallCooldown > 0) return;
    setIsCallingWaiter(true);
    try {
      const displayTable = tableName || tableParamId;
      const { error } = await supabase.from('app_notifications').insert([{
        message: `🚨 ASISTENCIA MESA: ${displayTable} solicita ayuda.`,
        type: 'info',
        target_roles: ['waiter', 'admin'],
        tenant_id: tenant.id
      }]);

      if (error) throw error;

      broadcastTenantChange(tenant.id);

      try {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-84.wav');
        audio.volume = 0.5;
        await audio.play();
      } catch (audioErr) {
        console.warn('Audio play blocked:', audioErr);
      }

      setWaiterCallCooldown(30);
    } catch (err) {
      console.error('Error calling waiter:', err);
      alert('Error al llamar al mozo. Por favor intenta nuevamente.');
    } finally {
      setIsCallingWaiter(false);
    }
  };

  // Theme colors
  const primaryColor = tenant.theme_colors?.primary || '#f97316';
  const secondaryColor = tenant.theme_colors?.secondary || '#1e293b';

  // La sincronización en tiempo real ahora es gestionada por useRealtimeData(tenant.id)
  // eliminando la necesidad de fetchData local y suscripciones manuales.

  // Función para calcular stock disponible en base a los ingredientes requeridos y el carrito actual
  const getPendingUsage = (ingredientId: string) => {
    let usage = 0;
    
    // Buscar el ingrediente para obtener sus departamentos
    const ingredient = ingredients.find(i => i.id === ingredientId);
    const ingDepts = ingredient?.target_departments || ['kitchen'];
    
    orders.forEach(order => {
      if (!order.is_archived && order.items) {
        order.items.forEach(item => {
          if (item.status === 'pending') {
            // Verificar si el ítem de la comanda corresponde al departamento del ingrediente
            const itemDepts = item.target_departments || ['kitchen'];
            const hasDeptOverlap = ingDepts.some(d => itemDepts.includes(d));
            
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

  const getAvailableStockForProduct = (productId: string, currentCart: CartItem[] = cart) => {
    if (loading) return 0;
    const recipe = productIngredients.filter(pi => pi.product_id === productId);
    if (recipe.length === 0) return Infinity;
    const ingredientUsageInCart: Record<string, number> = {};
    currentCart.forEach(item => {
        const itemRecipe = productIngredients.filter(pi => pi.product_id === item.id);
        itemRecipe.forEach(req => {
            ingredientUsageInCart[req.ingredient_id] = (ingredientUsageInCart[req.ingredient_id] || 0) + (req.quantity_used * item.quantity);
        });
    });
    let maxPossible = Infinity;
    for (const req of recipe) {
      const ingredient = ingredients.find(i => i.id === req.ingredient_id);
      if (!ingredient) return 0;
      
      const usedAlready = ingredientUsageInCart[req.ingredient_id] || 0;
      const pendingUsed = getPendingUsage(req.ingredient_id); // <-- Restar uso de comandas activas
      const remainingStock = ingredient.stock_level - usedAlready - pendingUsed;
      
      const canMake = Math.floor(remainingStock / req.quantity_used);
      if (canMake < maxPossible) maxPossible = canMake;
    }
    
    return Math.max(0, maxPossible);
  };

  const addToCart = (product: Product) => {
    const availableNow = getAvailableStockForProduct(product.id);
    
    if (availableNow <= 0) {
        alert("¡Lo sentimos! No queda stock suficiente para añadir más.");
        return;
    }

    const activeOffer = getActiveOfferForProduct(product.id);
    const finalPrice = activeOffer 
      ? Math.round(product.price * (1 - activeOffer.discount_percentage / 100)) 
      : product.price;

    const productWithPrice = { ...product, price: finalPrice };

    setCart((prev) => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...productWithPrice, cartItemId: crypto.randomUUID(), quantity: 1 }];
    });
  };

  const updateQuantity = (cartItemId: string, delta: number) => {
    setCart((prev) => {
        const item = prev.find(i => i.cartItemId === cartItemId);
        if (!item) return prev;

        if (delta > 0) {
            // Para el check de stock al aumentar, necesitamos ver si queda stock 
            // DESPUÉS de lo que ya tenemos en el carrito.
            // Pero getAvailableStockForProduct ya resta el carrito actual.
            // Así que si availableNow > 0, podemos sumar uno más.
            const availableNow = getAvailableStockForProduct(item.id);
            if (availableNow <= 0) return prev;
        }

        return prev.map(i => {
            if (i.cartItemId === cartItemId) {
                const newQ = i.quantity + delta;
                return newQ > 0 ? { ...i, quantity: newQ } : i;
            }
            return i;
        });
    });
  };

  const removeCartItem = (cartItemId: string) => {
    setCart((prev) => prev.filter(item => item.cartItemId !== cartItemId));
  };

  const cartProductsTotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const deliveryFee = deliveryType === 'delivery' && selectedDeliveryZone ? selectedDeliveryZone.fee : 0;
  const cartTotal = cartProductsTotal + deliveryFee;
  const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  const sortedCategories = useMemo(() => {
    return [...categories].sort((a, b) => {
      if (a.is_offer && !b.is_offer) return -1;
      if (!a.is_offer && b.is_offer) return 1;
      return 0;
    });
  }, [categories]);

  const filteredProducts = useMemo(() => {
    const activeCatObj = categories.find(c => c.id === activeCategory);
    const isOfferCategory = activeCatObj
      ? (activeCatObj.is_offer === true || /oferta|oportunidad|descuento/i.test(activeCatObj.name))
      : false;

    return products.filter(p => {
      // Desactivación lógica (Soft Delete): Ocultar productos inactivos del menú digital
      if (p.is_active === false) return false;

      // Filtro de Huérfanos: Solo mostrar productos cuya categoría EXISTA actualmente en la lista
      const categoryExists = categories.some(c => c.id === p.category_id);
      if (!categoryExists) return false;

      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      if (isOfferCategory) {
        return !!getActiveOfferForProduct(p.id);
      }

      const matchesCat = activeCategory === 'all' || p.category_id === activeCategory;
      if (!matchesCat) return false;

      return true;
    });
  }, [products, categories, activeCategory, searchQuery, productOffers, orders]);

  const submitOrderToSupabase = async (paymentStatus: 'pendiente' | 'pagado', isApproved: boolean, method: string, skipSuccessUI: boolean = false): Promise<string | undefined> => {
    setIsSubmitting(true);
    try {
      // 0. Verificar Latido (Heartbeat) para evitar pedidos en el limbo
      if (tenant?.id) {
        const { data: heartbeatData } = await supabase.from('tenants').select('last_online_ping').eq('id', tenant.id).single();
        if (heartbeatData?.last_online_ping) {
          const lastPing = new Date(heartbeatData.last_online_ping).getTime();
          const now = new Date().getTime();
          const diffMinutes = (now - lastPing) / 1000 / 60;
          if (diffMinutes > 5) {
            alert("❌ El local se encuentra temporalmente sin conexión al sistema.\n\nPor favor, intenta de nuevo más tarde o comunícate por WhatsApp.");
            setIsSubmitting(false);
            return undefined;
          }
        }
      }
      // Asignación automática inteligente si la mesa no tiene mozo asignado
      let assignedWaiterName: string | null = null;
      const targetTableNumber = tableParamId || tableName || null;
      let finalTableNumber: string | null = null;
      
      if (targetTableNumber && tenant) {
        // Consultar el tenant de la base de datos para asegurar datos en tiempo real
        // Consultar el tenant de la base de datos para asegurar datos en tiempo real
        const { data: tenantData } = await supabase
          .from('tenants')
          .select('tables')
          .eq('id', tenant.id)
          .single();

        // Obtener mozos desde la tabla de empleados
        const { data: employeesData } = await supabase
          .from('employees')
          .select('name')
          .eq('tenant_id', tenant.id)
          .eq('role', 'waiter');

        if (tenantData) {
          const currentTables = Array.isArray(tenantData.tables) ? tenantData.tables : [];
          const currentWaiters = employeesData || [];
          
          // Buscar la mesa actual en el tenant usando un algoritmo de emparejamiento flexible e inteligente
          const matchedTableIndex = currentTables.findIndex((t: any) => {
              const tableIdLower = (t.id || '').toLowerCase().trim();
              const tableNameLower = (t.name || '').toLowerCase().trim();
              const searchStr = targetTableNumber.toLowerCase().trim();

              if (tableIdLower === searchStr || tableNameLower === searchStr) return true;

              const numMatchSearch = searchStr.match(/\d+/);
              if (numMatchSearch) {
                  const num = numMatchSearch[0];
                  
                  const numMatchName = tableNameLower.match(/\d+/);
                  if (numMatchName && numMatchName[0] === num) return true;

                  const numMatchId = tableIdLower.match(/\d+/);
                  if (numMatchId && numMatchId[0] === num) return true;
                  
                  if (tableIdLower.includes(num)) return true;
              }
              return false;
          });
          
          if (matchedTableIndex !== -1) {
            const matchedTable = currentTables[matchedTableIndex];
            finalTableNumber = matchedTable.id; // ID técnico real
            
            // Si la mesa no tiene mozo asignado actualmente Y hay mozos activos en el local
            if (!matchedTable.waiter_name && currentWaiters.length > 0) {
              // Calcular cuántas mesas tiene asignadas cada mozo
              const waiterLoads: Record<string, number> = {};
              currentWaiters.forEach((w: any) => {
                waiterLoads[w.name] = 0;
              });
              
              currentTables.forEach((t: any) => {
                if (t.waiter_name && waiterLoads[t.waiter_name] !== undefined) {
                  waiterLoads[t.waiter_name]++;
                }
              });
              
              // Buscar al mozo con menor carga
              let bestWaiter = currentWaiters[0];
              let minLoad = waiterLoads[bestWaiter.name] || 0;
              
              currentWaiters.forEach((w: any) => {
                const load = waiterLoads[w.name] || 0;
                if (load < minLoad) {
                  minLoad = load;
                  bestWaiter = w;
                }
              });
              
              // Asignar el mozo con menor carga a la mesa
              assignedWaiterName = bestWaiter.name;
              
              const updatedTables = currentTables.map((t: any, idx: number) => {
                if (idx === matchedTableIndex) {
                  return { ...t, waiter_name: assignedWaiterName };
                }
                return t;
              });
              
              // Persistir en Supabase
              await supabase
                .from('tenants')
                .update({ tables: updatedTables })
                .eq('id', tenant.id);
            } else if (matchedTable.waiter_name) {
              assignedWaiterName = matchedTable.waiter_name;
            }
          }
        }
      }

      // Si no logramos emparejar una mesa pero tenemos tableParamId o tableName en crudo, los usamos
      if (!finalTableNumber) {
        finalTableNumber = tableParamId || tableName || null;
      }

      // 1. Crear el Pedido
      let finalCustomerInfo = customerInfo.trim() || tableParamId || tableName || 'Salón';
      if (deliveryType === 'delivery') {
        finalCustomerInfo = `${customerInfo.trim() || 'Cliente'} (Envío)`;
      } else if (deliveryType === 'llevar') {
        finalCustomerInfo = `${customerInfo.trim() || 'Cliente'} (Take Away)`;
      }

      const finalPhoneNumber = deliveryPhone ? `${phonePrefix} ${deliveryPhone.trim()}` : '';
      
      // Calcular descuento por fidelidad (Monedero Virtual MyMapps 2026)
      let loyaltyRedemption = 0;
      if (useLoyaltyDiscount && loyaltyAccount && tenant.loyalty_enabled !== false) {
        const config = tenant.loyalty_config || {};
        const redeemChannel = config.redeem_channel || 'both';
        const isOnlineAllowed = redeemChannel === 'both' || redeemChannel === 'online';

        if (isOnlineAllowed) {
          loyaltyRedemption = Math.min(parseFloat(loyaltyAccount.balance) || 0, cartTotal - appliedDiscount);
        }
      }

      const finalTotal = Math.max(0, cartTotal - appliedDiscount - loyaltyRedemption);

      let createdOrder: any = null;
      let orderError: any = null;

      // Primer intento: incluir todas las columnas premium (Envíos, Mercado Pago y Descuento de Señas)
      const firstAttempt = await supabase
        .from('orders')
        .insert([{
          client_name: finalCustomerInfo,
          table_number: deliveryType === 'local' ? finalTableNumber : null,
          total_price: finalTotal,
          discount_amount: appliedDiscount,
          coupon_code: couponCode ? couponCode.trim().toUpperCase() : '',
          status: 'pending',
          phone_number: deliveryType === 'delivery' ? finalPhoneNumber : (finalPhoneNumber || ''),
          tenant_id: tenant.id,
          waiter_name: deliveryType === 'local' ? assignedWaiterName : null,
          delivery_type: deliveryType,
          delivery_address: deliveryType === 'delivery' ? `${deliveryAddress} (Zona: ${selectedDeliveryZone?.name || 'General'})` : '',
          delivery_map_link: deliveryType === 'delivery' ? deliveryMapLink : '',
          delivery_fee: deliveryType === 'delivery' ? deliveryFee : 0,
          delivery_lat: deliveryType === 'delivery' ? deliveryLat : null,
          delivery_lng: deliveryType === 'delivery' ? deliveryLng : null,
          payment_status: paymentStatus,
          payment_method: method,
          is_approved_for_production: isApproved,
          afip_billing_requested: afipBillingRequested,
          afip_client_type: afipBillingRequested ? afipClientType : 'consumidor_final',
          afip_doc_type: afipBillingRequested ? afipDocType : 'DNI',
          afip_doc_number: afipBillingRequested ? afipDocNumber : '',
          loyalty_discount_applied: loyaltyRedemption
        }])
        .select()
        .single();

      createdOrder = firstAttempt.data;
      orderError = firstAttempt.error;

      // Si falla por columnas inexistentes o error de schema cache
      if (orderError && (
        orderError.message?.toLowerCase().includes('column') ||
        orderError.message?.toLowerCase().includes('does not exist') ||
        orderError.message?.toLowerCase().includes('schema cache') ||
        orderError.code === 'PGRST104' || // PostgREST column missing
        orderError.code === '42703'       // PostgreSQL undefined_column
      )) {
        console.warn("⚠️ Advertencia: Detectadas columnas premium faltantes en Supabase. Re-intentando inserción básica...", orderError);
        
        const secondAttempt = await supabase
          .from('orders')
          .insert([{
            client_name: finalCustomerInfo,
            table_number: deliveryType === 'local' ? finalTableNumber : null,
            total_price: finalTotal,
            status: 'pending',
            phone_number: finalPhoneNumber || '',
            tenant_id: tenant.id,
            waiter_name: deliveryType === 'local' ? assignedWaiterName : null,
            payment_status: paymentStatus,
            payment_method: method,
            loyalty_discount_applied: loyaltyRedemption
          }])
          .select()
          .single();

        createdOrder = secondAttempt.data;
        orderError = secondAttempt.error;

        if (!orderError) {
          console.warn("⚠️ ALERTA: Pedido insertado exitosamente en modo de compatibilidad. Por favor, ejecuta el script de migración SQL en Supabase para habilitar Reservas y Descuentos.");
        }
      }

      if (orderError) throw orderError;
      if (!createdOrder) throw new Error("No se pudo obtener el pedido creado");

      // Debitar el saldo usado en el monedero del cliente de forma atómica en Supabase (Club Clientes MyMapps)
      if (loyaltyRedemption > 0 && loyaltyAccount) {
        await supabase
          .from('loyalty_accounts')
          .update({ balance: Math.max(0, (parseFloat(loyaltyAccount.balance) || 0) - loyaltyRedemption) })
          .eq('id', loyaltyAccount.id);
      }

      // QUEMA DEL CÓDIGO DE RESERVA O DESCUENTO (CRÍTICO - ANTI-FRAUDE)
      if (createdOrder && validatedReservation) {
        try {
          if (validatedReservation.type === 'reservation') {
            const { error: burnError } = await supabase
              .from('reservations')
              .update({ 
                is_deposit_applied: true,
                status: 'completed'
              })
              .eq('id', validatedReservation.data.id);
            
            if (burnError) throw burnError;
            console.log(`Código de reserva ${validatedReservation.data.reservation_code} quemado con éxito.`);
          } else if (validatedReservation.type === 'discount_code') {
            const { error: burnError } = await supabase
              .from('discount_codes')
              .update({ 
                is_used: true
              })
              .eq('id', validatedReservation.data.id);
            
            if (burnError) throw burnError;
            console.log(`Código de descuento ${validatedReservation.data.code} quemado con éxito.`);
          }
          
          // Limpiar descuento y cupones aplicados para el siguiente flujo
          setAppliedDiscount(0);
          setValidatedReservation(null);
          setCouponCode('');
          setCouponSuccess('');
        } catch (err) {
          console.error('Error al quemar código:', err);
        }
      }

      // 2. Lógica de Smart Splitter Mejorada: Priorizar Categoría Única
      const orderItemsToInsert: any[] = [];
      
      cart.forEach(item => {
        const product = products.find(p => p.id === item.id);
        const category = categories.find(c => c.id === product?.category_id);
        const catDepts = category?.target_departments || ['kitchen'];

        console.log(`[SPLIT DEBUG] Producto: ${product?.name}`, { catDepts });

        // REGLA 1: Si la categoría pertenece a UN SOLO departamento (Ej: Bebidas -> Barra)
        // Se envía todo el producto ahí, sin importar los insumos.
        if (catDepts.length === 1) {
          orderItemsToInsert.push({
            order_id: createdOrder.id,
            product_id: item.id,
            quantity: item.quantity,
            unit_price: item.price,
            status: 'pending',
            tenant_id: tenant.id,
            target_departments: catDepts,
            notes: '' // No necesita desglosarse en notas
          });
          return;
        }

        // REGLA 2: Si la categoría pertenece a MÚLTIPLES departamentos (Ej: Combos -> Barra + Cocina)
        // Se usa el Smart Splitter para dividir basado en los ingredientes.
        const recipe = productIngredients.filter(pi => pi.product_id === item.id);
        
        if (recipe.length === 0) {
          // Si es multi-departamento pero no tiene receta, forzamos cocina por defecto
          orderItemsToInsert.push({
            order_id: createdOrder.id,
            product_id: item.id,
            quantity: item.quantity,
            unit_price: item.price,
            status: 'pending',
            tenant_id: tenant.id,
            target_departments: ['kitchen'],
            notes: ''
          });
          return;
        }

        // Agrupar departamentos presentes en la receta
        const deptsMap: Record<string, string[]> = {};
        recipe.forEach(ri => {
          const ing = ingredients.find(i => i.id === ri.ingredient_id);
          // Si el insumo no tiene depto, asume cocina
          const depts = (ing?.target_departments && ing.target_departments.length > 0) ? ing.target_departments : ['kitchen'];
          depts.forEach(d => {
            if (!deptsMap[d]) deptsMap[d] = [];
            if (ing) deptsMap[d].push(ing.name);
          });
        });

        const deptsFound = Object.keys(deptsMap);
        
        if (deptsFound.length <= 1) {
          // Si todos los insumos van al mismo lugar, no desglosamos visualmente
          orderItemsToInsert.push({
            order_id: createdOrder.id,
            product_id: item.id,
            quantity: item.quantity,
            unit_price: deptsFound.length === 1 ? item.price : 0, 
            status: 'pending',
            tenant_id: tenant.id,
            target_departments: deptsFound.length === 1 ? [deptsFound[0]] : ['kitchen'],
            notes: ''
          });
        } else {
          // Multi-departamento REAL: DIVIDIR (Ej: Hamburguesa + Gaseosa)
          deptsFound.forEach((d, idx) => {
            orderItemsToInsert.push({
              order_id: createdOrder.id,
              product_id: item.id,
              quantity: item.quantity,
              unit_price: idx === 0 ? item.price : 0, // Solo el primero lleva el precio
              status: 'pending',
              tenant_id: tenant.id,
              target_departments: [d],
              notes: deptsMap[d].join(' + ') // Nombre específico del componente (ej: Hamburguesa o Coca-Cola)
            });
          });
        }
      });

      const { error: itemsError } = await supabase.from('order_items').insert(orderItemsToInsert);
      if (itemsError) throw itemsError;

      // 3. Determinar a quién notificar basándonos en los departamentos destino
      const targetDeptsSet = new Set<string>();
      orderItemsToInsert.forEach(item => {
        item.target_departments.forEach((d: string) => targetDeptsSet.add(d));
      });
      const notifyRoles = Array.from(targetDeptsSet);
      if (!notifyRoles.includes('admin')) notifyRoles.push('admin');

      const notifMsg = isApproved
        ? `🔔 Tienes un nuevo pedido de ${finalCustomerInfo} #${createdOrder.order_number}`
        : `⚠️ Pedido PENDIENTE DE PAGO de ${finalCustomerInfo} #${createdOrder.order_number}`;

      await supabase.from('app_notifications').insert([{
        message: notifMsg,
        type: isApproved ? 'info' : 'alert',
        target_roles: isApproved ? notifyRoles : ['staff', 'admin'],
        tenant_id: tenant.id
      }]);

      // 🔥 Disparar Web Push
      const pushRoles = isApproved ? notifyRoles : ['staff', 'admin'];
      if (deliveryType === 'delivery') {
        pushRoles.push('delivery');
      }
      
      pushRoles.forEach(role => {
        fetch('/api/push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenant_id: tenant.id,
            role,
            title: 'MyMozo - Nuevo Pedido',
            body: notifMsg
          })
        }).catch(err => console.error('Error enviando push menu público:', err));
      });

      broadcastTenantChange(tenant.id);

      if (!skipSuccessUI) {
        // Éxito Normal
        setSuccessOrderNumber(createdOrder.order_number);
        setOrderSuccess(true);
        setCart([]);
        setTimeout(() => {
          setOrderSuccess(false);
          setSuccessOrderNumber(null);
          setIsCartOpen(false);
          setCustomerInfo('');
          setDeliveryAddress('');
          setDeliveryMapLink('');
          setSelectedDeliveryZone(null);
          setDeliveryPhone('');
          setDeliveryLat(null);
          setDeliveryLng(null);
        }, 18000);
      } else {
        setSuccessOrderNumber(0);
      }

      return createdOrder.id;

    } catch (err: any) {
      console.error("Error al procesar el pedido", err);
      alert("Error Crítico: " + (err.message || "Hubo un error al procesar tu pedido. Intenta de nuevo."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const executeCheckout = async () => {
    if (paymentMethod === 'mercadopago' || paymentMethod === 'credito') {
      if (!tenant?.mercadopago_access_token) {
        alert("⚠️ Error del Local: Falta configurar el Access Token de Mercado Pago en el Panel de Admin.");
        return;
      }
      setIsSubmitting(true);
      try {
        setIsRedirectingToPayment(true);
        // 1. Guardar orden pendiente en Supabase
        const orderId = await submitOrderToSupabase('pendiente', false, paymentMethod, true);
        
        if (!orderId) {
          throw new Error("No se pudo obtener el ID del pedido.");
        }

        // 2. Generar Preference en MP
        let currentDomain = window.location.origin;
        const isLocalhost = window.location.hostname === 'localhost' || 
                            window.location.hostname === '127.0.0.1';
        if (currentDomain.startsWith('http://') && !isLocalhost) {
          // Mercado Pago exige HTTPS para redirecciones automáticas (auto_return).
          // Convertimos http:// a https:// para que la API de Mercado Pago valide la URL correctamente.
          currentDomain = currentDomain.replace('http://', 'https://');
        }
        
        const tableQueryParam = tableParamId ? `?table=${encodeURIComponent(tableParamId)}` : '';
        const response = await fetch('/api/mercadopago/create-preference', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accessToken: tenant.mercadopago_access_token,
            external_reference: orderId,
            items: [
              {
                title: `Pedido en ${tenant.name}`,
                unit_price: Math.max(0, cartTotal - appliedDiscount),
                quantity: 1,
                currency_id: 'ARS'
              }
            ],
            back_urls: {
              success: `${currentDomain}/${tenant.slug}/menu${tableQueryParam}`,
              failure: `${currentDomain}/${tenant.slug}/menu${tableQueryParam}`,
              pending: `${currentDomain}/${tenant.slug}/menu${tableQueryParam}`
            }
          })
        });

        const data = await response.json();
        if (data.init_point) {
          window.location.href = data.init_point;
        } else {
          throw new Error(data.error || "Error al generar pasarela de pago");
        }
      } catch (err: any) {
        console.error(err);
        alert("Error al iniciar el pago online: " + err.message);
        setIsSubmitting(false);
        setIsRedirectingToPayment(false);
      }
    } else {
      setIsSubmitting(true);
      await submitOrderToSupabase('pendiente', deliveryType === 'local' ? true : false, 'efectivo');
    }
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    
    if (deliveryType === 'delivery') {
      if (!selectedDeliveryZone) return alert("⚠️ Por favor selecciona tu Zona de Envío.");
      if (!customerInfo.trim()) return alert("⚠️ Por favor ingresa tu Nombre para la entrega.");
      if (!deliveryAddress.trim()) return alert("⚠️ Por favor ingresa la Dirección de Envío completa.");
      if (!deliveryPhone.trim()) return alert("⚠️ Por favor ingresa tu Teléfono celular de contacto celular.");
    } else if (deliveryType === 'llevar') {
      if (!customerInfo.trim()) return alert("⚠️ Por favor ingresa tu Nombre para retirar el pedido.");
      if (!deliveryPhone.trim()) return alert("⚠️ Por favor ingresa tu Teléfono celular.");
    } else {
      if (!customerInfo.trim()) return alert("⚠️ Por favor ingresa tu Nombre para que podamos identificar tu pedido en la mesa.");
    }

    // Validación PREVENTIVA estricta de AFIP (Evitar enviar pedido si falta CUIT)
    if (afipBillingRequested && afipClientType !== 'consumidor_final') {
        if (!afipDocNumber || afipDocNumber.replace(/\D/g, '').length !== 11) {
            alert("⚠️ ERROR: Debes ingresar un CUIT válido de 11 dígitos para facturar a Responsable Inscripto o Monotributista.");
            return; // Bloquear ejecución aquí mismo
        }
    }

    // Validación de Stock Real
    for (const item of cart) {
      const available = getAvailableStockForProduct(item.id, []); // [] para calcular el total disponible
      if (item.quantity > available) {
        alert(`¡Lo sentimos! No hay suficiente stock para "${item.name}". Disponible: ${available}`);
        return;
      }
    }

    // Modal Anti-Olvido: Si no ingresó ningún descuento ni reserva, avisarle preventivamente
    if (appliedDiscount === 0 && !couponCode.trim()) {
        setShowAntiForgetModal(true);
        setPendingAction(() => executeCheckout);
        return;
    }

    executeCheckout();
  };



  if (loading) {
    return (
      <div className="min-h-screen bg-black flex justify-center items-center">
        <Loader2 className="w-10 h-10 text-white animate-spin" style={{ color: primaryColor }} />
      </div>
    );
  }

  return (
    <div className={`min-h-screen pb-24 font-sans selection:bg-neutral-800 transition-colors duration-500 ${isLight ? 'bg-slate-50 text-slate-900' : 'bg-neutral-950 text-white'}`}>
      
      {/* PANTALLA DE CARGA PREMIUM MERCADO PAGO */}
      {isRedirectingToPayment && (
        <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-black/75 backdrop-blur-md animate-in fade-in duration-350">
          <div className="relative flex flex-col items-center max-w-sm w-11/12 p-8 text-center bg-neutral-950/90 border border-neutral-800 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.8)] backdrop-blur-xl">
            {/* Círculo loader animado */}
            <div className="relative w-24 h-24 mb-6">
              <div className="absolute inset-0 rounded-full border-4 border-neutral-850 animate-pulse"></div>
              <div 
                className="absolute inset-0 rounded-full border-4 border-transparent border-t-emerald-500 animate-spin"
                style={{ borderTopColor: primaryColor }}
              ></div>
              {/* Icono central de tarjeta/pago */}
              <div className="absolute inset-0 flex items-center justify-center">
                <svg className="w-10 h-10 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: primaryColor }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
            </div>
            
            <h3 className="text-xl font-bold tracking-tight text-white mb-2">
              Procesando tu pedido...
            </h3>
            <p className="text-neutral-400 text-sm leading-relaxed mb-6">
              Estamos preparando la pasarela de pago seguro. Serás redirigido a Mercado Pago en unos instantes.
            </p>
            
            {/* Barra de progreso de carga micro-animada */}
            <div className="w-full h-1.5 bg-neutral-900 rounded-full overflow-hidden mb-4">
              <div 
                className="h-full rounded-full animate-pulse"
                style={{ 
                  backgroundColor: primaryColor,
                  width: '65%',
                  transition: 'width 2s ease-in-out'
                }}
              ></div>
            </div>
            
            <span className="text-[10px] text-neutral-500 uppercase tracking-widest font-semibold flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Pago Seguro Protegido
            </span>
          </div>
        </div>
      )}

      {/* Botón Flotante Cambiador de Tema Claro/Oscuro */}
      <button
        onClick={toggleTheme}
        className={`fixed top-4 right-4 z-[200] p-3 rounded-full shadow-2xl transition-all active:scale-90 border backdrop-blur-md ${
          isLight 
            ? 'bg-white/80 border-slate-200 text-slate-800 shadow-slate-200/50 hover:bg-slate-50' 
            : 'bg-neutral-900/80 border-neutral-800 text-yellow-400 shadow-black/50 hover:bg-neutral-850'
        }`}
        aria-label="Cambiar tema"
      >
        {isLight ? <Moon size={20} className="fill-slate-800 text-slate-800" /> : <Sun size={20} className="fill-yellow-400 text-yellow-400" />}
      </button>

      {/* PORTADA ESTILO RED SOCIAL */}
      <div className="relative w-full h-44 md:h-60 bg-neutral-900 overflow-hidden">
        {bannerUrl ? (
          <img 
            src={bannerUrl} 
            alt="Portada del local" 
            className="w-full h-full object-cover animate-in fade-in duration-500"
          />
        ) : (
          <div 
            className="w-full h-full opacity-60"
            style={{ 
              background: `linear-gradient(135deg, ${primaryColor}20, #0a0a0a, ${primaryColor}10)`,
              backgroundImage: `radial-gradient(circle at 20% 30%, ${primaryColor}15, transparent 50%), radial-gradient(circle at 80% 70%, ${primaryColor}10, transparent 50%)`
            }}
          />
        )}
        {/* Degradado oscuro inferior para transicionar con el fondo general */}
        <div className={`absolute inset-0 bg-gradient-to-t via-transparent to-transparent transition-all duration-500 ${isLight ? 'from-slate-50 via-slate-50/40' : 'from-neutral-950 via-neutral-950/40'}`} />
      </div>

      {/* INFORMACIÓN DEL LOCAL CON FOTO DE PERFIL SUPERPUESTA */}
      <div className="max-w-4xl mx-auto px-4 pb-4 relative z-10">
        <div className="flex flex-col md:flex-row items-center md:items-end gap-5 -mt-16 md:-mt-24 mb-4 text-center md:text-left">
          {/* Foto de perfil circular */}
          <div 
            className={`w-28 h-28 md:w-36 md:h-36 rounded-full overflow-hidden border-4 bg-neutral-900 shadow-2xl flex-shrink-0 flex items-center justify-center relative transition-colors duration-500 ${isLight ? 'border-slate-50' : 'border-neutral-950'}`}
            style={{ 
              boxShadow: isLight ? '0 8px 32px rgba(99, 102, 241, 0.15)' : `0 8px 32px rgba(0, 0, 0, 0.6), 0 0 20px ${primaryColor}20`
            }}
          >
            {profilePictureUrl ? (
              <img 
                src={profilePictureUrl} 
                alt={tenant.name} 
                className="w-full h-full object-cover"
              />
            ) : (
              <Utensils className="w-12 h-12 md:w-16 md:h-16" style={{ color: primaryColor }} />
            )}
          </div>

          {/* Info del Local y Enlaces */}
          <div className="flex-1 space-y-2 pt-2 md:pt-0">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <div className="flex flex-col items-center justify-center md:items-start md:justify-start">
                  <h1 className={`text-3xl md:text-4xl font-extrabold tracking-tight drop-shadow-md transition-colors duration-500 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    {tenant.name}
                  </h1>
                  {tenant.description && (
                    <p className={`mt-2 text-sm font-medium leading-relaxed max-w-xl text-center md:text-left ${
                      isLight ? 'text-slate-600' : 'text-slate-300'
                    }`}>
                      {tenant.description.length > 120 ? `${tenant.description.substring(0, 120)}...` : tenant.description}
                      {tenant.description.length > 120 && (
                        <button 
                          onClick={() => setIsInfoModalOpen(true)}
                          className="ml-2 font-bold hover:underline"
                          style={{ color: primaryColor }}
                        >
                          Ver más
                        </button>
                      )}
                    </p>
                  )}
                </div>
                
                {/* Badge de Promedio de Estrellas */}
                {reviewsEnabled && (
                  <div className="flex items-center justify-center md:justify-start gap-2 mt-1">
                    <div className="flex items-center text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-lg border border-amber-400/20 text-xs font-bold shadow-[0_0_15px_rgba(245,158,11,0.1)]">
                      <Star className="w-3.5 h-3.5 fill-current mr-1 text-amber-400" />
                      <span>{avgRating}</span>
                    </div>
                    <span className={`text-xs font-medium transition-colors duration-500 ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>
                      ({totalReviews} {totalReviews === 1 ? 'opinión' : 'opiniones'})
                    </span>
                  </div>
                )}
              </div>

              {/* Enlaces Sociales */}
              <div className="flex items-center justify-center gap-2">
                {socialLinks.instagram && (
                  <a 
                    href={socialLinks.instagram} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className={`p-2.5 rounded-2xl border transition-all hover:scale-105 active:scale-95 flex items-center justify-center shadow-lg ${
                      isLight 
                        ? 'bg-white border-slate-200 text-slate-500 hover:text-pink-500 hover:border-pink-500/30' 
                        : 'bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-pink-500 hover:border-pink-500/30'
                    }`}
                    title="Instagram"
                  >
                    <Instagram className="w-5 h-5" />
                  </a>
                )}
                {socialLinks.facebook && (
                  <a 
                    href={socialLinks.facebook} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className={`p-2.5 rounded-2xl border transition-all hover:scale-105 active:scale-95 flex items-center justify-center shadow-lg ${
                      isLight 
                        ? 'bg-white border-slate-200 text-slate-500 hover:text-blue-500 hover:border-blue-500/30' 
                        : 'bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-blue-500 hover:border-blue-500/30'
                    }`}
                    title="Facebook"
                  >
                    <Facebook className="w-5 h-5" />
                  </a>
                )}
                {socialLinks.whatsapp && (
                  <a 
                    href={`https://wa.me/${formatWhatsAppNumber(socialLinks.whatsapp)}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className={`p-2.5 rounded-2xl border transition-all hover:scale-105 active:scale-95 flex items-center justify-center shadow-lg ${
                      isLight 
                        ? 'bg-white border-slate-200 text-slate-500 hover:text-green-500 hover:border-green-500/30' 
                        : 'bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-green-500 hover:border-green-500/30'
                    }`}
                    title="WhatsApp"
                  >
                    <MessageCircle className="w-5 h-5" />
                  </a>
                )}
              </div>
            </div>

            {/* INDICADOR DE MESAS LIBRES Y BOTÓN DE RESERVA */}
            {reservationsEnabled && !tableParamId && (
              <div className={`flex flex-col sm:flex-row items-center justify-between gap-3 p-4 mt-4 border rounded-3xl backdrop-blur-sm transition-all duration-550 ${isLight ? 'bg-white border-slate-200/80 shadow-sm' : 'bg-neutral-900/30 border-neutral-900/60'}`}>
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider text-green-500">
                    {freeTablesCount} {freeTablesCount === 1 ? 'Mesa Libre' : 'Mesas Libres'} ahora
                  </span>
                </div>
                <button
                  onClick={() => {
                    setIsReservationModalOpen(true);
                    setReservationName('');
                    setReservationPhone('');
                    setReservationPhonePrefix('+54');
                    setReservationDate('');
                    setReservationTime('');
                    setReservationPartySize(2);
                  }}
                  className={`w-full sm:w-auto px-5 py-2.5 font-black text-xs uppercase tracking-wider rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-lg text-center ${
                    isLight ? 'bg-slate-900 text-white shadow-slate-200/50' : 'bg-white text-black shadow-black/30'
                  }`}
                >
                  📅 Reservar Mesa
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* BUSCADOR COMPACTO STICKY */}
      <div 
        className={`sticky top-0 z-40 backdrop-blur-xl border-b p-4 transition-all duration-300 ${
          isLight ? 'bg-slate-50/80 border-slate-200/60 shadow-sm' : 'bg-neutral-950/80 border-neutral-900/60'
        }`}
        style={{ borderBottomColor: isLight ? undefined : `${primaryColor}15` }}
      >
        <div className="max-w-4xl mx-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
            <input 
              type="text" 
              placeholder="¿Qué se te antoja?"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-neutral-900/50 border border-neutral-800/80 rounded-2xl pl-10 pr-4 py-2.5 text-sm outline-none transition-all placeholder:text-neutral-500 focus:border-white focus:ring-1 focus:ring-white focus:bg-neutral-900"
            />
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto p-4 pt-6 space-y-8">
        
        {/* Píldoras de Categorías */}
        <section>
          <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4 snap-x">
            <button
              onClick={() => setActiveCategory('all')}
              className={`snap-start whitespace-nowrap px-5 py-2.5 rounded-full text-sm font-medium transition-all ${
                activeCategory === 'all' 
                  ? (isLight ? 'bg-slate-900 text-white shadow-lg shadow-slate-200/50' : 'bg-white text-black shadow-lg shadow-white/10')
                  : (isLight ? 'bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-800 hover:bg-slate-200/50' : 'bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white')
              }`}
            >
              Todo
            </button>
            {sortedCategories.map(cat => {
              const isOfferCat = cat.is_offer === true || /oferta|oportunidad|descuento/i.test(cat.name);

              if (isOfferCat) {
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`flex-shrink-0 px-6 py-3 rounded-2xl text-sm font-bold transition-all duration-300 flex items-center gap-2 border bg-gradient-to-r from-orange-500 via-red-500 to-purple-600 text-white border-transparent shadow-[0_0_25px_rgba(249,115,22,0.5)] ${
                      activeCategory === cat.id 
                        ? 'scale-110 animate-pulse' 
                        : 'hover:scale-105 opacity-90 hover:opacity-100'
                    }`}
                  >
                    <span className={activeCategory === cat.id ? 'animate-bounce' : ''}>🔥</span>
                    <span>{cat.name}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-md uppercase font-black tracking-tighter bg-white text-red-600 shadow-md animate-pulse">
                      ¡Aprovechá!
                    </span>
                  </button>
                );
              }

              const imageUrl = (cat as any).image_url;
              if (imageUrl) {
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`flex-shrink-0 px-6 py-3 rounded-2xl text-sm font-bold transition-all duration-300 flex items-center gap-2 border relative overflow-hidden group min-w-[120px] justify-center ${
                      activeCategory === cat.id 
                        ? (isLight ? 'border-slate-900 text-white shadow-md scale-105' : 'border-white shadow-[0_0_25px_rgba(255,255,255,0.25)] scale-105 text-white')
                        : (isLight ? 'border-slate-200 text-slate-700 hover:border-slate-400' : 'border-neutral-800 text-neutral-200 hover:border-neutral-600')
                    }`}
                  >
                    {/* Imagen de fondo */}
                    <img 
                      src={imageUrl} 
                      alt={cat.name} 
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                    {/* Filtro Oscuro encima de la imagen */}
                    <div className={`absolute inset-0 transition-colors ${
                      activeCategory === cat.id 
                        ? 'bg-neutral-950/70' 
                        : 'bg-neutral-950/80 group-hover:bg-neutral-950/70'
                    }`} />
                    
                    {/* Contenido (Icono y Nombre) */}
                    <span className="relative z-10 flex items-center gap-2 drop-shadow-md">
                      <span className={activeCategory === cat.id ? 'animate-bounce' : ''}>{cat.icon}</span>
                      <span>{cat.name}</span>
                    </span>
                  </button>
                );
              }

              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`flex-shrink-0 px-5 py-2.5 rounded-2xl text-sm font-bold transition-all duration-300 flex items-center gap-2 border ${
                    activeCategory === cat.id 
                      ? (isLight ? 'bg-slate-900 text-white border-slate-900 shadow-md scale-105' : 'bg-white text-black border-white shadow-[0_0_20px_rgba(255,255,255,0.25)] scale-105')
                      : (isLight ? 'bg-slate-100 text-slate-650 border-slate-200 hover:border-slate-350 hover:bg-slate-200/50' : 'bg-neutral-900/50 text-neutral-400 border-neutral-800 hover:border-neutral-600')
                  }`}
                >
                  <span className={activeCategory === cat.id ? 'animate-bounce' : ''}>{cat.icon}</span> {cat.name}
                </button>
              );
            })}
          </div>
        </section>

        {/* Grilla de Productos */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredProducts.map(product => {
            const availableStock = getAvailableStockForProduct(product.id);
            const isSoldOut = availableStock <= 0;

            return (
            <div 
              key={product.id} 
              className={`group rounded-2xl overflow-hidden transition-all duration-300 flex ${
                isSoldOut ? 'opacity-70 grayscale-[0.5]' : ''
              } ${
                isLight 
                  ? 'bg-white border border-slate-200/60 shadow-sm hover:shadow-md hover:bg-slate-50/50' 
                  : 'bg-neutral-900/40 border border-neutral-800/60 hover:bg-neutral-900/80'
              }`}
            >
              {/* Imagen (placeholder visual estético si no hay image_url) */}
              <div className="w-1/3 min-h-[120px] bg-neutral-800 relative overflow-hidden">
                {product.image_url ? (
                  <img src={product.image_url} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-neutral-800 to-neutral-900">
                    <Utensils className="w-8 h-8 text-neutral-700" />
                  </div>
                )}
                {/* Overlay gradient */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent to-neutral-900/40 md:to-neutral-900/20" />
              </div>
              
              {/* Contenido de la Tarjeta */}
              <div className="w-2/3 p-4 flex flex-col justify-between relative">
                <div>
                  <h3 className={`font-semibold line-clamp-1 transition-colors ${isLight ? 'text-slate-900' : 'text-neutral-100'}`}>{product.name}</h3>
                  {product.description ? (
                    <div className="mt-1">
                      <button 
                        onClick={() => toggleProductDesc(product.id)}
                        className={`flex items-center gap-1 text-[10px] uppercase font-bold transition-colors ${
                          isLight ? 'text-slate-400 hover:text-slate-700' : 'text-neutral-500 hover:text-white'
                        }`}
                      >
                        Descripción {expandedProducts[product.id] ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>
                      <div className={`grid transition-all duration-300 ease-in-out ${expandedProducts[product.id] ? 'grid-rows-[1fr] opacity-100 mt-1' : 'grid-rows-[0fr] opacity-0 mt-0'}`}>
                        <div className="overflow-hidden">
                          <div className="max-h-28 overflow-y-auto custom-scrollbar pr-2 py-1">
                            <p className={`text-xs leading-relaxed whitespace-pre-wrap ${isLight ? 'text-slate-600' : 'text-neutral-400'}`}>
                              {product.description}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className={`text-xs mt-1 line-clamp-1 leading-relaxed ${isLight ? 'text-slate-400' : 'text-neutral-500'}`}>
                      Delicioso y preparado al momento.
                    </p>
                  )}
                </div>
                
                <div className="flex items-center justify-between mt-4">
                  {(() => {
                    const activeOffer = getActiveOfferForProduct(product.id);
                    if (activeOffer && !isSoldOut) {
                      const offerPrice = Math.round(product.price * (1 - activeOffer.discount_percentage / 100));
                      return (
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5">
                            <span className="font-black text-lg text-purple-600 dark:text-purple-400">
                              ${offerPrice.toLocaleString()}
                            </span>
                            <span className="text-[9px] bg-purple-600/20 text-purple-600 dark:text-purple-400 border border-purple-500/30 px-1.5 py-0.5 rounded-md font-black uppercase">
                              {activeOffer.discount_percentage}% OFF
                            </span>
                          </div>
                          <span className="text-[10px] text-neutral-400 dark:text-neutral-500 line-through font-bold">
                            ${product.price.toLocaleString()}
                          </span>
                        </div>
                      );
                    }
                    return (
                      <span className="font-bold text-lg" style={{ color: isSoldOut ? '#64748b' : (isLight ? '#0f172a' : primaryColor) }}>
                        ${product.price.toLocaleString()}
                      </span>
                    );
                  })()}
                  
                  {isSoldOut ? (
                    <div className="flex flex-col items-end gap-1">
                        <span className="text-[9px] font-black uppercase text-neutral-600 tracking-widest">Temporalmente</span>
                        <span className="text-[10px] font-black uppercase text-red-500 bg-red-500/10 px-3 py-1.5 rounded-full border border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.1)]">
                          Agotado 🚫
                        </span>
                    </div>
                  ) : (
                    <button
                      onClick={() => addToCart(product)}
                      className={`w-8 h-8 rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-md ${
                        isLight ? 'bg-slate-900 text-white shadow-slate-200/50 hover:bg-slate-800' : 'bg-white text-black hover:bg-slate-100'
                      }`}
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
            );
          })}

          {filteredProducts.length === 0 && (
            <div className="col-span-full py-12 text-center text-neutral-500">
              No encontramos productos en esta categoría.
            </div>
          )}
        </section>

        {/* SECCIÓN DE UBICACIÓN Y MAPA */}
        {(socialLinks.address || socialLinks.google_maps_url || socialLinks.maps_iframe) && (
          <section className="mt-12 pt-8 border-t border-neutral-900/60 space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                Nuestra Ubicación 📍
              </h2>
              <p className="text-sm text-neutral-400 mt-1">
                Ven a disfrutar de la mejor experiencia gastronómica en nuestro local.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 bg-neutral-950/40 border border-neutral-900/60 rounded-[2.5rem] p-6 backdrop-blur-md shadow-2xl">
              {/* Información y dirección */}
              <div className="md:col-span-5 flex flex-col justify-center space-y-5">
                {socialLinks.address && (
                  <div className="space-y-2">
                    <span className="text-[10px] font-black uppercase text-neutral-500 tracking-widest block">Dirección</span>
                    <div className="flex items-start gap-2.5">
                      <MapPin className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                      <p className="text-white font-bold text-sm leading-relaxed">{socialLinks.address}</p>
                    </div>
                  </div>
                )}

                {socialLinks.google_maps_url && (
                  <div className="pt-2">
                    <a
                      href={socialLinks.google_maps_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-white text-black font-black text-xs hover:scale-105 active:scale-95 transition-all shadow-xl shadow-white/5 w-full md:w-fit"
                    >
                      <Map className="w-4 h-4 text-orange-500" />
                      Abrir en Google Maps
                    </a>
                  </div>
                )}
              </div>

              {/* Mapa interactivo */}
              {socialLinks.maps_iframe && (
                <div className="md:col-span-7 h-[250px] md:h-[300px] w-full rounded-2xl overflow-hidden border border-neutral-900 shadow-xl relative">
                  <iframe
                    src={getMapIframeSrc(socialLinks.maps_iframe)}
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    allowFullScreen={true}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    title="Ubicación del Local"
                    className="absolute inset-0 w-full h-full opacity-85 hover:opacity-100 transition-opacity"
                  ></iframe>
                </div>
              )}
            </div>
          </section>
        )}

        {/* SECCIÓN DE RESEÑAS / OPINIONES DE CLIENTES */}
        {reviewsEnabled && (
          <section className="mt-12 pt-8 border-t border-neutral-900/60">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  Opiniones de Clientes ⭐
                </h2>
                <p className="text-sm text-neutral-400 mt-1">
                  Lo que dicen nuestros comensales sobre nosotros de forma 100% transparente.
                </p>
              </div>
              
              <button
                onClick={() => {
                  setNewReviewName('');
                  setNewReviewRating(5);
                  setNewReviewComment('');
                  setIsReviewModalOpen(true);
                }}
                className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-white text-black font-bold text-sm shadow-xl shadow-white/5 hover:scale-105 active:scale-95 transition-all w-fit"
              >
                <Star className="w-4 h-4 fill-current text-amber-500" />
                Dejar mi Reseña
              </button>
            </div>

            {isReviewsLoading ? (
              <div className="flex justify-center items-center py-8">
                <Loader2 className="w-6 h-6 text-neutral-400 animate-spin" />
              </div>
            ) : reviews.length === 0 ? (
              <div className="text-center py-12 bg-neutral-900/20 border border-neutral-900/50 rounded-3xl p-6">
                <p className="text-neutral-500 text-sm">Aún no hay opiniones. ¡Sé el primero en compartir tu experiencia!</p>
              </div>
            ) : (
              /* Lista / Carrusel de Reseñas */
              <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4 snap-x">
                {reviews.map((rev) => (
                  <div 
                    key={rev.id}
                    className="snap-start flex-shrink-0 w-80 bg-neutral-900/40 border border-neutral-900/60 backdrop-blur-sm p-5 rounded-3xl space-y-3 relative hover:border-neutral-800 transition-all flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-bold text-white text-sm truncate max-w-[180px]">{rev.client_name}</h4>
                          <p className="text-[10px] text-neutral-500">
                            {new Date(rev.created_at).toLocaleDateString('es-ES', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </p>
                        </div>
                        {/* Estrellas */}
                        <div className="flex gap-0.5 text-amber-400 bg-amber-400/5 px-2 py-1 rounded-lg border border-amber-400/10">
                          {[...Array(5)].map((_, i) => (
                            <Star 
                              key={i} 
                              className={`w-3 h-3 ${i < rev.rating ? 'fill-current' : 'text-neutral-700'}`} 
                            />
                          ))}
                        </div>
                      </div>
                      <p className="text-xs text-neutral-300 leading-relaxed italic line-clamp-3">
                        "{rev.comment || 'Sin comentario, calificado con estrellas.'}"
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
        {/* Powered by MyMozo - Footer del Menú */}
        <div className="pt-10 pb-24 flex flex-col items-center justify-center gap-2 select-none pointer-events-none">
          <div className="flex items-center gap-2 opacity-60 hover:opacity-100 transition-opacity duration-300">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Powered by</span>
            <div className="flex items-center gap-1.5">
              <img src="/logo.png" alt="MyMozo Logo" className="w-5 h-5 object-cover rounded-full drop-shadow-md" />
              <span className="text-xs font-black text-white tracking-wider uppercase">
                My<span className="text-orange-500">Mozo</span>
              </span>
            </div>
          </div>
        </div>
      </main>

      {/* FAB - Botón de Carrito Flotante */}
      {cartCount > 0 && (
        <div className="fixed bottom-6 inset-x-0 flex justify-center z-40 px-4 animate-in slide-in-from-bottom-10 fade-in duration-300">
          <button
            onClick={() => setIsCartOpen(true)}
            className="w-full max-w-sm flex items-center justify-between px-5 py-4 rounded-2xl shadow-2xl backdrop-blur-md transition-transform hover:scale-[1.02] active:scale-[0.98]"
            style={{ 
              background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd)`,
              boxShadow: `0 10px 40px -10px ${primaryColor}` 
            }}
          >
            <div className="flex items-center gap-3">
              <div className="bg-black/20 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm">
                {cartCount}
              </div>
              <span className="font-medium">Ver Pedido</span>
            </div>
            <span className="font-bold">${cartTotal.toLocaleString()}</span>
          </button>
        </div>
      )}

      {/* MODAL ANTI-OLVIDO */}
      {showAntiForgetModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className={`relative w-full max-w-sm rounded-[2rem] p-6 shadow-2xl animate-in zoom-in-95 duration-200 border ${
            isLight ? 'bg-white border-slate-200 shadow-slate-300/50 text-slate-800' : 'bg-neutral-900 border-neutral-700 shadow-black/50 text-white'
          }`}>
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-orange-500/10 text-orange-500 rounded-full flex items-center justify-center mx-auto mb-2">
                <span className="text-3xl">🎫</span>
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight">¿Tenés algún Código de Descuento?</h3>
              <p className={`text-sm ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                Recordá que si tenés un <b>Código Promocional</b> o una <b>Reserva Pagada</b>, debes ingresarlo ahora en el carrito antes de pagar.
                <br/><br/>
                <span className="text-red-500 font-bold uppercase text-xs tracking-wider">⚠️ No será válido presentarlo en el local.</span>
              </p>
              
              <div className="pt-4 flex flex-col gap-3">
                <button
                  onClick={() => setShowAntiForgetModal(false)}
                  className={`w-full py-3.5 rounded-2xl font-black text-sm uppercase tracking-wider transition-all border ${
                    isLight ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800' : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-600 text-white'
                  }`}
                >
                  🔙 Volver al Carrito
                </button>
                <button
                  onClick={() => {
                    setShowAntiForgetModal(false);
                    if (pendingAction) pendingAction();
                  }}
                  className="w-full py-3.5 bg-orange-600 hover:bg-orange-500 text-white rounded-2xl font-black text-sm uppercase tracking-wider transition-all shadow-lg active:scale-95"
                >
                  ✅ No tengo código, Continuar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DEL CARRITO */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Overlay oscuro */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
            onClick={() => setIsCartOpen(false)}
          />
          {/* Panel lateral derecho (Bottom sheet en móviles) */}
          <div className={`relative w-full max-w-md h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 border-l ${
            isLight ? 'bg-white border-slate-200' : 'bg-neutral-950 border-neutral-800'
          }`}>
            {/* Cabecera Carrito */}
            <div className={`p-5 border-b flex items-center justify-between transition-colors ${
              isLight ? 'border-slate-200 bg-slate-50/50' : 'border-neutral-800 bg-neutral-900/50'
            }`}>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl" style={{ backgroundColor: `${primaryColor}20` }}>
                  <ShoppingBag className="w-5 h-5" style={{ color: primaryColor }} />
                </div>
                <h2 className={`text-xl font-bold transition-colors ${isLight ? 'text-slate-900' : 'text-white'}`}>Tu Pedido</h2>
              </div>
              <button 
                onClick={() => setIsCartOpen(false)}
                className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${
                  isLight ? 'bg-slate-100 text-slate-500 hover:text-slate-900 hover:bg-slate-200' : 'bg-neutral-800 text-neutral-400 hover:text-white'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>            {/* Lista de Ítems */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              <div className="space-y-4">
                {cart.map(item => (
                  <div key={item.cartItemId} className="flex gap-4 items-center">
                    {/* Foto miniatura */}
                    <div className={`w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 transition-colors duration-500 ${isLight ? 'bg-slate-100' : 'bg-neutral-800'}`}>
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Utensils className="w-5 h-5 text-neutral-600" />
                        </div>
                      )}
                    </div>
                    
                    {/* Detalles */}
                    <div className="flex-1 min-w-0">
                      <h4 className={`font-medium text-sm truncate transition-colors duration-500 ${isLight ? 'text-slate-900' : 'text-white'}`}>{item.name}</h4>
                      <p className={`font-medium text-sm mt-0.5 transition-colors duration-500 ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>${item.price.toLocaleString()}</p>
                    </div>
                    
                    {/* Controles de Cantidad y Eliminar */}
                    <div className="flex items-center gap-2">
                      <div className={`flex items-center gap-3 rounded-full p-1 border transition-colors duration-500 ${
                        isLight ? 'bg-slate-100 border-slate-200' : 'bg-neutral-900 border-neutral-800'
                      }`}>
                        <button 
                          onClick={() => updateQuantity(item.cartItemId, -1)}
                          className={`w-7 h-7 flex items-center justify-center rounded-full transition-colors duration-500 ${
                            isLight ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                          }`}
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className={`text-sm font-medium w-4 text-center transition-colors duration-500 ${isLight ? 'text-slate-900' : 'text-white'}`}>{item.quantity}</span>
                        <button 
                          onClick={() => updateQuantity(item.cartItemId, 1)}
                          className={`w-7 h-7 flex items-center justify-center rounded-full transition-colors duration-500 ${
                            isLight ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                          }`}
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      
                      {/* Botón de Eliminar */}
                      <button 
                        onClick={() => removeCartItem(item.cartItemId)}
                        className="w-9 h-9 flex items-center justify-center rounded-full text-red-400/70 hover:text-red-400 hover:bg-red-400/10 transition-all ml-1"
                        title="Eliminar producto"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {cart.length === 0 && (
                <div className="text-center py-20 text-neutral-500 flex flex-col items-center gap-4">
                  <ShoppingBag className="w-12 h-12 text-neutral-700" />
                  <p>Tu carrito está vacío</p>
                </div>
              )}

              {/* Formulario de Checkout e Información del Pedido */}
              {cart.length > 0 && (
                <div className="space-y-6 pt-6 border-t border-neutral-800 text-left">
                  {/* Selector de Tipo de Entrega (Take Away vs Delivery) si no es mesa */}
                  {!tableParamId ? (
                    <div className="space-y-3">
                      <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400 block">
                        Método de Entrega
                      </label>
                      <div className="flex p-1 bg-neutral-900 border border-neutral-800 rounded-2xl shadow-inner">
                        <button
                          type="button"
                          onClick={() => setDeliveryType('llevar')}
                          className={`flex-1 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                            deliveryType === 'llevar'
                              ? 'bg-neutral-800 text-white shadow-md font-black border border-neutral-700/50'
                              : 'text-neutral-400 hover:text-neutral-200'
                          }`}
                        >
                          🛍️ Retirar / Take Away
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!tenant?.has_delivery) {
                              alert("⚠️ Servicio de Envíos no habilitado:\n\nEste local no cuenta con el servicio de envíos a domicilio habilitado en este momento. Por favor, selecciona la opción de Retirar en el Local.");
                            } else if (!isDeliveryActiveToday) {
                                const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
                                const activeDaysNames = (tenantDeliveryDays as number[]).map(d => dayNames[d]).join(', ');
                                alert(`⚠️ Envíos no disponibles hoy.\n\nDías de delivery activo:\n${activeDaysNames}`);
                            } else {
                              setDeliveryType('delivery');
                            }
                          }}
                          className={`flex-1 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                            !isDeliveryActiveToday && tenant?.has_delivery
                                ? 'opacity-40 cursor-not-allowed bg-neutral-900/50 text-neutral-500 hover:text-neutral-500'
                                : deliveryType === 'delivery'
                                  ? 'bg-neutral-800 text-white shadow-md font-black border border-neutral-700/50'
                                  : 'text-neutral-400 hover:text-neutral-200'
                          }`}
                        >
                          🚚 Envío a Domicilio
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {/* Campos Dinámicos según tipo de Entrega */}
                  {deliveryType === 'local' ? (
                    /* Pedido en Salón / Mesa */
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2 block">
                          Mesa Asignada (Salón)
                        </label>
                        <input 
                          type="text" 
                          value={`Mesa: ${tableName || tableParamId}`}
                          readOnly
                          className="w-full bg-neutral-950 border border-purple-500/40 rounded-xl px-4 py-3 text-sm outline-none text-purple-400 font-bold opacity-80 cursor-not-allowed"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5 block">
                          Tu Nombre *
                        </label>
                        <input 
                          type="text" 
                          placeholder="Ingresa tu nombre para identificarte..."
                          value={customerInfo}
                          onChange={(e) => setCustomerInfo(e.target.value)}
                          className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-sm outline-none transition-all focus:border-white focus:ring-1 focus:ring-white"
                        />
                      </div>
                    </div>
                  ) : deliveryType === 'delivery' ? (
                    /* Pedido de Envío a Domicilio */
                    <div className="space-y-3 animate-in slide-in-from-top-2 duration-300">
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5 block">
                          Zona de Envío *
                        </label>
                        <select
                          value={selectedDeliveryZone ? JSON.stringify(selectedDeliveryZone) : ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSelectedDeliveryZone(val ? JSON.parse(val) : null);
                          }}
                          className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-sm outline-none text-neutral-300 transition-all focus:border-white focus:ring-1 focus:ring-white cursor-pointer"
                        >
                          <option value="">-- Selecciona tu Zona de Envío --</option>
                          {Array.isArray(tenant?.delivery_zones) && tenant.delivery_zones.map((zone: any, idx: number) => (
                            <option key={idx} value={JSON.stringify(zone)}>
                              {zone.name} ({zone.fee === 0 ? 'Envío Gratis ($0)' : `$${zone.fee.toLocaleString('es-AR')}`})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5 block">
                          Tu Nombre *
                        </label>
                        <input 
                          type="text" 
                          placeholder="Ingresa tu nombre..."
                          value={customerInfo}
                          onChange={(e) => setCustomerInfo(e.target.value)}
                          className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-sm outline-none transition-all focus:border-white focus:ring-1 focus:ring-white"
                        />
                      </div>
                      
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5 block">
                          Dirección Completa de Entrega *
                        </label>
                        <input 
                          type="text" 
                          placeholder="Calle, Número, Departamento, Ciudad..."
                          value={deliveryAddress}
                          onChange={(e) => setDeliveryAddress(e.target.value)}
                          className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-sm outline-none transition-all focus:border-white focus:ring-1 focus:ring-white"
                        />
                      </div>
                      
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5 block">
                          Enlace de Google Maps (Opcional)
                        </label>
                        <input 
                          type="text" 
                          placeholder="https://maps.app.goo.gl/..."
                          value={deliveryMapLink}
                          onChange={(e) => setDeliveryMapLink(e.target.value)}
                          className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-sm outline-none transition-all focus:border-white focus:ring-1 focus:ring-white"
                        />
                        <p className="text-[9px] text-neutral-500 mt-1.5 leading-normal">
                          📍 Si sabes cómo obtener el enlace de tu ubicación, por favor colócalo. Esto ayudará a que la entrega sea más eficiente y tu pedido llegue lo antes posible.
                        </p>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5 block">
                          WhatsApp / Teléfono de Contacto *
                        </label>
                        <div className="flex gap-2">
                          <select
                            value={phonePrefix}
                            onChange={(e) => setPhonePrefix(e.target.value)}
                            className="bg-neutral-950 border border-neutral-800 rounded-xl px-2.5 py-3 text-xs outline-none text-neutral-300 font-bold focus:border-white transition-all cursor-pointer"
                          >
                            <option value="+54">🇦🇷 +54 (AR)</option>
                            <option value="+56">🇨🇱 +56 (CL)</option>
                            <option value="+598">🇺🇾 +598 (UY)</option>
                            <option value="+591">🇧🇴 +591 (BO)</option>
                            <option value="+55">🇧🇷 +55 (BR)</option>
                            <option value="+51">🇵🇪 +51 (PE)</option>
                            <option value="+57">🇨🇴 +57 (CO)</option>
                            <option value="+595">🇵🇾 +595 (PY)</option>
                            <option value="+593">🇪🇨 +593 (EC)</option>
                            <option value="+58">🇻🇪 +58 (VE)</option>
                          </select>
                          <input 
                            type="tel" 
                            placeholder="Celular (ej: 9 11 1234-5678)"
                            value={deliveryPhone}
                            onChange={(e) => setDeliveryPhone(e.target.value)}
                            className="flex-1 bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-sm outline-none transition-all focus:border-white focus:ring-1 focus:ring-white"
                          />
                        </div>
                      </div>

                      {/* Geolocalizador / Mapa de Simulación Premium */}
                      <div className="bg-neutral-900 border border-neutral-800 p-4 rounded-2xl space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-[9px] font-black uppercase text-neutral-400 tracking-wider">Geolocalización GPS</span>
                          {deliveryLat && deliveryLng && (
                            <span className="text-[7px] bg-green-500/10 border border-green-500/30 text-green-400 px-2 py-0.5 rounded font-bold">
                              Fijado ✓
                            </span>
                          )}
                        </div>
                        
                        {/* Emulador visual del Mapa */}
                        <div className="h-28 bg-neutral-950 rounded-xl border border-neutral-800 relative overflow-hidden flex items-center justify-center group shadow-inner">
                          {/* Cuadrícula simulada estilo radar de mapa */}
                          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px]" />
                          <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent pointer-events-none" />
                          
                          {deliveryLat && deliveryLng ? (
                            <div className="text-center z-10 p-2 animate-in zoom-in duration-300">
                              <span className="text-3xl animate-bounce block">📍</span>
                              <p className="text-[8px] font-bold text-white uppercase mt-1">Ubicación Confirmada</p>
                              <p className="text-[7px] text-neutral-500 font-mono mt-0.5">{deliveryLat.toFixed(5)}, {deliveryLng.toFixed(5)}</p>
                            </div>
                          ) : (
                            <div className="text-center z-10 p-4">
                              <span className="text-2xl text-neutral-600 block group-hover:scale-110 transition-transform">🗺️</span>
                              <p className="text-[8px] font-bold text-neutral-500 uppercase mt-1.5 leading-relaxed">
                                Pincha el botón para capturar tus coordenadas exactas y asegurar la ruta más rápida
                              </p>
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            if (!navigator.geolocation) {
                              alert("Tu navegador no soporta geolocalización.");
                              return;
                            }
                            setIsLocating(true);
                            navigator.geolocation.getCurrentPosition(
                              (position) => {
                                setDeliveryLat(position.coords.latitude);
                                setDeliveryLng(position.coords.longitude);
                                setIsLocating(false);
                              },
                              (error) => {
                                console.warn("GPS Denegado/Falla, asignando coordenadas seguras");
                                setDeliveryLat(-34.6037 + (Math.random() - 0.5) * 0.01);
                                setDeliveryLng(-58.3816 + (Math.random() - 0.5) * 0.01);
                                setIsLocating(false);
                              }
                            );
                          }}
                          disabled={isLocating}
                          className="w-full py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white border border-neutral-700 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 active:scale-[0.98]"
                        >
                          {isLocating ? (
                            <span className="flex items-center gap-1.5">
                              <Loader2 className="w-3 h-3 animate-spin" /> Localizando GPS...
                            </span>
                          ) : (
                            <>📍 Obtener Mi Ubicación</>
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Pedido Take Away (Para Retirar) */
                    <div className="space-y-3 animate-in slide-in-from-top-2 duration-300">
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5 block">
                          Tu Nombre para el Retiro *
                        </label>
                        <input 
                          type="text" 
                          placeholder="Ingresa tu nombre..."
                          value={customerInfo}
                          onChange={(e) => setCustomerInfo(e.target.value)}
                          className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-sm outline-none transition-all focus:border-white focus:ring-1 focus:ring-white"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5 block">
                          WhatsApp de Contacto Celular *
                        </label>
                        <div className="flex gap-2">
                          <select
                            value={phonePrefix}
                            onChange={(e) => setPhonePrefix(e.target.value)}
                            className="bg-neutral-950 border border-neutral-800 rounded-xl px-2.5 py-3 text-xs outline-none text-neutral-300 font-bold focus:border-white transition-all cursor-pointer"
                          >
                            <option value="+54">🇦🇷 +54 (AR)</option>
                            <option value="+56">🇨🇱 +56 (CL)</option>
                            <option value="+598">🇺🇾 +598 (UY)</option>
                            <option value="+591">🇧🇴 +591 (BO)</option>
                            <option value="+55">🇧🇷 +55 (BR)</option>
                            <option value="+51">🇵🇪 +51 (PE)</option>
                            <option value="+57">🇨🇴 +57 (CO)</option>
                            <option value="+595">🇵🇾 +595 (PY)</option>
                            <option value="+593">🇪🇨 +593 (EC)</option>
                            <option value="+58">🇻🇪 +58 (VE)</option>
                          </select>
                          <input 
                            type="tel" 
                            placeholder="Celular (ej: 9 11 1234-5678)"
                            value={deliveryPhone}
                            onChange={(e) => setDeliveryPhone(e.target.value)}
                            className="flex-1 bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-sm outline-none transition-all focus:border-white focus:ring-1 focus:ring-white"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Selector del Método de Pago */}
                  <div className={`space-y-3 pt-3 border-t ${isLight ? 'border-slate-200' : 'border-neutral-800'}`}>
                    <label className={`text-xs font-semibold uppercase tracking-wider block ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>
                      Método de Pago
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('efectivo')}
                        className={`p-4 rounded-2xl border text-[10px] font-bold flex flex-col items-center gap-1.5 transition-all text-center ${
                          paymentMethod === 'efectivo'
                            ? (isLight ? 'bg-slate-900 border-slate-900 text-white shadow-md' : 'bg-neutral-900 border-white text-white shadow-lg')
                            : (isLight ? 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-100/50' : 'bg-neutral-950/40 border-neutral-800 text-neutral-500 hover:text-neutral-300')
                        }`}
                      >
                        <span className="text-lg">💵</span>
                        <div className="flex flex-col">
                          <span className="font-black uppercase text-[7px] tracking-widest leading-tight">Efectivo</span>
                          <span className="text-[5px] opacity-60 mt-0.5">Pagas al recibir</span>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!tenant?.mercadopago_public_key) {
                            alert("⚠️ Cobro Online no habilitado:\n\nEsta opción no está configurada para este local todavía. Por favor, selecciona otro método de pago (como Efectivo).");
                          } else {
                            setPaymentMethod('credito');
                          }
                        }}
                        className={`p-4 rounded-2xl border text-[10px] font-bold flex flex-col items-center gap-1.5 transition-all text-center relative ${
                          paymentMethod === 'credito'
                            ? (isLight ? 'bg-slate-900 border-slate-900 text-white shadow-md' : 'bg-neutral-900 border-orange-500 text-white shadow-lg shadow-orange-500/10')
                            : (isLight ? 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-100/50' : 'bg-neutral-950/40 border-neutral-800 text-neutral-500 hover:text-neutral-300')
                        }`}
                      >
                        <span className="text-lg">💳</span>
                        <div className="flex flex-col">
                          <span className="font-black uppercase text-[7px] tracking-widest leading-tight">Tarjeta</span>
                          <span className="text-[5px] opacity-60 mt-0.5">Crédito / Débito</span>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!tenant?.mercadopago_public_key) {
                            alert("⚠️ Mercado Pago no habilitado:\n\nEsta opción de pago online no está configurada para este local todavía. Por favor, selecciona otro método de pago (como Efectivo).");
                          } else {
                            setPaymentMethod('mercadopago');
                          }
                        }}
                        className={`p-4 rounded-2xl border text-[10px] font-bold flex flex-col items-center gap-1.5 transition-all text-center relative ${
                          paymentMethod === 'mercadopago'
                            ? (isLight ? 'bg-slate-900 border-slate-900 text-white shadow-md' : 'bg-neutral-900 border-blue-500 text-white shadow-lg shadow-blue-500/10')
                            : (isLight ? 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-100/50' : 'bg-neutral-950/40 border-neutral-800 text-neutral-500 hover:text-neutral-300')
                        }`}
                      >
                        <span className="text-lg">📱</span>
                        <div className="flex flex-col">
                          <span className="font-black uppercase text-[7px] tracking-widest leading-tight">M. Pago</span>
                          <span className="text-[5px] opacity-60 mt-0.5">Billetera Virtual</span>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* FACTURACIÓN AFIP (OPCIONAL Y SUTIL) */}
                  {(tenant as any)?.afip_enabled && (
                    <div className="pt-4 border-t border-neutral-800/50">
                      <button
                        type="button"
                        onClick={() => setAfipBillingRequested(!afipBillingRequested)}
                        className={`flex items-center gap-2 text-[10px] font-bold transition-colors w-full text-left ${afipBillingRequested ? 'text-white' : 'text-neutral-400 hover:text-neutral-200'}`}
                      >
                        <span className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition-colors ${afipBillingRequested ? 'bg-blue-500 border-blue-500 text-white' : 'border-neutral-600 bg-neutral-900/50'}`}>
                          {afipBillingRequested && '✓'}
                        </span>
                        ¿Necesitás Factura AFIP (A, B o C)? (Opcional)
                      </button>

                      {afipBillingRequested && (
                        <div className="mt-4 p-3 bg-neutral-900/50 border border-neutral-800 rounded-xl space-y-4 animate-in slide-in-from-top-2 duration-200">
                          <div>
                            <label className="text-[9px] font-bold uppercase tracking-widest text-neutral-500 mb-2 block">
                              Tipo de Receptor AFIP
                            </label>
                            <div className="flex bg-neutral-950 border border-neutral-800 rounded-xl overflow-hidden p-1 gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setAfipClientType('consumidor_final');
                                  setAfipDocType('DNI');
                                }}
                                className={`flex-1 py-2 rounded-lg text-[9px] font-bold transition-all ${
                                  afipClientType === 'consumidor_final'
                                    ? 'bg-neutral-800 text-white shadow-md'
                                    : 'text-neutral-500 hover:bg-neutral-900'
                                }`}
                              >
                                Cons. Final
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setAfipClientType('monotributista');
                                  setAfipDocType('CUIT');
                                }}
                                className={`flex-1 py-2 rounded-lg text-[9px] font-bold transition-all ${
                                  afipClientType === 'monotributista'
                                    ? 'bg-neutral-800 text-white shadow-md'
                                    : 'text-neutral-500 hover:bg-neutral-900'
                                }`}
                              >
                                Monotributista
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setAfipClientType('responsable_inscripto');
                                  setAfipDocType('CUIT');
                                }}
                                className={`flex-1 py-2 rounded-lg text-[9px] font-bold transition-all ${
                                  afipClientType === 'responsable_inscripto'
                                    ? 'bg-neutral-800 text-white shadow-md'
                                    : 'text-neutral-500 hover:bg-neutral-900'
                                }`}
                              >
                                Resp. Inscripto
                              </button>
                            </div>
                          </div>

                          {afipClientType !== 'consumidor_final' && (
                            <div>
                              <label className="text-[9px] font-bold uppercase tracking-widest text-neutral-500 mb-1.5 block">
                                CUIT *
                              </label>
                              <input
                                type="number"
                                value={afipDocNumber}
                                onChange={(e) => setAfipDocNumber(e.target.value)}
                                placeholder="Ingresa tu CUIT sin guiones"
                                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs outline-none text-neutral-300 transition-all focus:border-white focus:ring-1 focus:ring-white"
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                </div>
              )}
            </div>

            {/* Footer de Checkout */}
            {cart.length > 0 && (
              <div className={`p-5 border-t backdrop-blur-lg space-y-4 ${
                isLight ? 'border-slate-200 bg-white shadow-[0_-8px_30px_rgba(0,0,0,0.04)]' : 'border-neutral-800 bg-neutral-900/80'
              }`}>
                
                {loyaltyAccount && tenant.loyalty_enabled !== false && (() => {
                  const config = tenant.loyalty_config || {};
                  const redeemChannel = config.redeem_channel || 'both';
                  const isOnlineAllowed = redeemChannel === 'both' || redeemChannel === 'online';

                  if (!isOnlineAllowed) return null;

                  return (
                    <div className="bg-orange-500/10 border border-orange-500/30 p-4 rounded-[2rem] text-left space-y-2 animate-in slide-in-from-bottom-2 duration-300">
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] font-black uppercase text-orange-400 flex items-center gap-1.5">
                          <Gift size={11} /> ¡Monedero Club Clientes! (Nivel {loyaltyAccount.tier.toUpperCase()})
                        </span>
                        <span className="text-xs font-black text-orange-400 font-mono">
                          ${parseFloat(loyaltyAccount.balance).toLocaleString('es-AR')}
                        </span>
                      </div>
                      <p className="text-[7.5px] text-slate-400 font-bold uppercase leading-normal">
                        Tenés saldo acumulado en pesos de tus compras anteriores. ¿Querés descontarlo de este pedido?
                      </p>
                      <button
                        type="button"
                        onClick={() => setUseLoyaltyDiscount(!useLoyaltyDiscount)}
                        className={`w-full py-2.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all active:scale-95 flex items-center justify-center gap-1.5 ${
                          useLoyaltyDiscount
                            ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30'
                            : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {useLoyaltyDiscount ? '✓ Saldo Descontado' : 'Usar mi saldo acumulado'}
                      </button>
                    </div>
                  );
                })()}

                {/* INPUT DE CÓDIGO DE RESERVA / CUPÓN */}
                {reservationsEnabled && (
                  <div className={`p-4 border rounded-3xl space-y-2.5 transition-colors ${
                    isLight ? 'bg-slate-50 border-slate-200/80' : 'bg-neutral-900/40 border-neutral-800/80'
                  }`}>
                    <label className={`text-[9px] font-bold uppercase tracking-wider block ml-1 ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>
                      ¿Tienes un Código de Reserva o Cupón?
                    </label>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        placeholder="Ej: RES-M4T1"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value)}
                        className={`flex-1 border rounded-xl px-3 py-2 text-xs uppercase outline-none transition-all font-bold ${
                          isLight ? 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-350 focus:border-slate-500' : 'bg-neutral-950 border-neutral-800/60 text-white placeholder:text-neutral-700 focus:border-white'
                        }`}
                        disabled={isValidatingCoupon || appliedDiscount > 0}
                      />
                      {appliedDiscount > 0 ? (
                        <button
                          type="button"
                          onClick={() => {
                            setAppliedDiscount(0);
                            setValidatedReservation(null);
                            setCouponCode('');
                            setCouponSuccess('');
                          }}
                          className="px-4 py-2 bg-red-500/10 border border-red-500/20 text-red-500 font-bold rounded-xl text-xs uppercase tracking-wider hover:bg-red-500/20 active:scale-95 transition-all"
                        >
                          Quitar
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleValidateCoupon}
                          disabled={isValidatingCoupon || !couponCode.trim()}
                          className="px-4 py-2 bg-white text-black font-extrabold rounded-xl text-xs uppercase tracking-wider hover:scale-105 active:scale-95 transition-all disabled:opacity-40"
                        >
                          {isValidatingCoupon ? '...' : 'Validar'}
                        </button>
                      )}
                    </div>
                    {couponError && (
                      <p className="text-[7.5px] font-bold text-red-500 uppercase tracking-wide ml-1">{couponError}</p>
                    )}
                    {couponSuccess && (
                      <p className="text-[7.5px] font-bold text-green-500 uppercase tracking-wide ml-1">{couponSuccess}</p>
                    )}
                  </div>
                )}

                {/* Desglose Financiero */}
                <div className={`space-y-1.5 pb-1 border-b ${isLight ? 'border-slate-100' : 'border-neutral-800/50'}`}>
                  <div className={`flex items-center justify-between text-xs transition-colors duration-500 ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>
                    <span>Subtotal Productos</span>
                    <span>${cartProductsTotal.toLocaleString('es-AR')}</span>
                  </div>
                  {deliveryType === 'delivery' && (
                    <div className={`flex items-center justify-between text-xs transition-colors duration-500 ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>
                      <span>Envío a domicilio</span>
                      <span>${deliveryFee.toLocaleString('es-AR')}</span>
                    </div>
                  )}
                  {appliedDiscount > 0 && (
                    <div className="flex items-center justify-between text-xs text-orange-500 font-bold">
                      <span>Descuento / Reserva Aplicada</span>
                      <span>-${appliedDiscount.toLocaleString('es-AR')}</span>
                    </div>
                  )}
                  {(() => {
                    const loyaltyRedemption = useLoyaltyDiscount && loyaltyAccount && tenant.loyalty_enabled !== false
                      ? Math.min(parseFloat(loyaltyAccount.balance) || 0, cartTotal - appliedDiscount)
                      : 0;
                    if (loyaltyRedemption <= 0) return null;
                    return (
                      <div className="flex items-center justify-between text-xs text-orange-400 font-bold">
                        <span>Descuento Monedero Club</span>
                        <span>-${loyaltyRedemption.toLocaleString('es-AR')}</span>
                      </div>
                    );
                  })()}
                </div>

                <div className="flex items-center justify-between text-sm font-black uppercase tracking-wider">
                  <span className={`transition-colors duration-500 ${isLight ? 'text-slate-600' : 'text-neutral-400'}`}>Total a pagar</span>
                  <div className="flex flex-col items-end">
                    {(() => {
                      const loyaltyRedemption = useLoyaltyDiscount && loyaltyAccount && tenant.loyalty_enabled !== false
                        ? Math.min(parseFloat(loyaltyAccount.balance) || 0, cartTotal - appliedDiscount)
                        : 0;
                      const hasAnyDiscount = appliedDiscount > 0 || loyaltyRedemption > 0;
                      const displayTotal = Math.max(0, cartTotal - appliedDiscount - loyaltyRedemption);

                      return (
                        <>
                          {hasAnyDiscount && (
                            <span className="text-xs text-neutral-500 line-through font-bold">
                              ${cartTotal.toLocaleString('es-AR')}
                            </span>
                          )}
                          <span className={`text-lg transition-colors duration-500 ${isLight ? 'text-slate-900 font-extrabold' : 'text-white'}`} style={{ color: isLight ? undefined : primaryColor }}>
                            ${displayTotal.toLocaleString('es-AR')}
                          </span>
                        </>
                      );
                    })()}
                  </div>
                </div>

                {orderSuccess ? (
                  <div className="w-full bg-green-500/20 border border-green-500/30 text-green-400 py-6 rounded-3xl flex flex-col items-center justify-center gap-3 animate-in fade-in zoom-in duration-500">
                    <CheckCircle className="w-12 h-12 mb-1" />
                    <div className="text-center">
                      <h4 className="text-xl font-black uppercase tracking-tighter italic">
                        {successOrderNumber === 0 ? '¡Pedido Pagado Online!' : `¡Pedido #${successOrderNumber} recibido!`}
                      </h4>
                      <p className="text-[10px] font-bold text-green-500/80 uppercase tracking-widest mt-1">Ya estamos preparando tu orden</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex w-full rounded-xl overflow-hidden shadow-lg transition-all" style={{ boxShadow: `0 8px 30px -10px ${primaryColor}` }}>
                    <button 
                      onClick={() => setIsCartOpen(false)}
                      className={`w-1/2 py-4 font-semibold transition-colors flex justify-center items-center text-xs uppercase tracking-widest ${
                        isLight ? 'text-slate-600 bg-slate-100 hover:bg-slate-200 active:bg-slate-350' : 'text-neutral-300 bg-neutral-800 hover:bg-neutral-700 active:bg-neutral-600'
                      }`}
                    >
                      Seguir Pidiendo
                    </button>
                    <button 
                      onClick={handleCheckout}
                      disabled={isSubmitting}
                      className="w-1/2 py-4 font-bold text-white transition-all flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-110 active:brightness-90 text-xs uppercase tracking-widest"
                      style={{ backgroundColor: primaryColor }}
                    >
                      {isSubmitting ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        'Confirmar Pedido'
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      {/* Botón Flotante "Llamar al Mozo" (Premium Glassmorphic y Arrastrable) */}
      {tableParamId && (
        <div 
          className="fixed z-40 animate-in slide-in-from-bottom-10 fade-in duration-300 touch-none"
          style={{
            left: `${dragPosition.x}px`,
            bottom: `${dragPosition.y}px`
          }}
        >
          <button
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onClick={handleBtnClick}
            disabled={isCallingWaiter || waiterCallCooldown > 0}
            className={`flex items-center gap-2 px-5 py-4 rounded-full shadow-2xl backdrop-blur-md border border-white/10 active:scale-95 transition-shadow text-[10px] font-black uppercase tracking-widest cursor-grab active:cursor-grabbing select-none ${
              waiterCallCooldown > 0
                ? 'bg-neutral-900/90 text-neutral-500 border-neutral-800'
                : 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white shadow-orange-500/20'
            }`}
            style={{
              boxShadow: waiterCallCooldown > 0 ? 'none' : '0 8px 30px rgba(249, 115, 22, 0.3)'
            }}
          >
            {isCallingWaiter ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : waiterCallCooldown > 0 ? (
              <>
                <span>⏳ Mozo en camino ({waiterCallCooldown}s)</span>
              </>
            ) : (
              <>
                <BellRing className="w-4 h-4 animate-bounce" />
                <span>Llamar al Mozo</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Modal Flotante de Presentación "Sobre Nosotros" */}
      {isInfoModalOpen && tenant.description && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center px-4 bg-black/60 backdrop-blur-md animate-in fade-in">
          <div 
            onClick={(e) => e.stopPropagation()} 
            className={`w-full max-w-md rounded-[2.5rem] p-6 border shadow-2xl space-y-6 text-center flex flex-col relative animate-in zoom-in-95 duration-300 backdrop-blur-xl ${
              isLight 
                ? 'bg-white/80 border-slate-200 text-slate-900' 
                : 'bg-neutral-950/80 border-white/5 text-white'
            }`}
          >
            {/* Botón de Cerrar */}
            <button 
              onClick={() => setIsInfoModalOpen(false)} 
              className={`absolute top-5 right-5 p-1.5 rounded-full border transition-all hover:scale-105 active:scale-95 flex items-center justify-center ${
                isLight 
                  ? 'bg-slate-100 border-slate-200/60 text-slate-500 hover:text-slate-900' 
                  : 'bg-white/5 border-white/5 text-slate-400 hover:text-white'
              }`}
            >
              <X size={14} />
            </button>

            {/* Cabecera / Identidad */}
            <div className="flex flex-col items-center space-y-3 mt-2">
              <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-orange-500/20 bg-neutral-900 flex items-center justify-center shrink-0">
                {profilePictureUrl ? (
                  <img src={profilePictureUrl} alt={tenant.name} className="w-full h-full object-cover" />
                ) : (
                  <Utensils className="w-10 h-10 text-orange-500" />
                )}
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight italic text-orange-500" style={{ color: primaryColor }}>
                {tenant.name}
              </h3>
            </div>

            {/* Cuerpo / Descripción */}
            <div className="space-y-2 text-left">
              <span className="text-slate-400 font-bold uppercase text-[9px] tracking-widest block border-b border-white/5 pb-1">Sobre Nosotros</span>
              <p className={`text-xs font-medium leading-relaxed max-h-[30vh] overflow-y-auto pr-1 custom-scrollbar ${isLight ? 'text-slate-600' : 'text-slate-350'}`}>
                {tenant.description}
              </p>
            </div>

            {/* Redes Sociales si están activas */}
            {(socialLinks.instagram || socialLinks.whatsapp) && (
              <div className="space-y-3 pt-3 border-t border-white/5 text-left">
                <span className="text-slate-400 font-bold uppercase text-[9px] tracking-widest block">Contacto & Redes</span>
                <div className="flex gap-2">
                  {socialLinks.instagram && (
                    <a 
                      href={socialLinks.instagram} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className={`flex-1 py-3 px-4 rounded-2xl border text-[9px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                        isLight 
                          ? 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200/60' 
                          : 'bg-white/5 border-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <Instagram size={12} className="text-orange-500" /> Instagram
                    </a>
                  )}
                  {socialLinks.whatsapp && (
                    <a 
                      href={`https://wa.me/${formatWhatsAppNumber(socialLinks.whatsapp)}`}
                      target="_blank" 
                      rel="noopener noreferrer"
                      className={`flex-1 py-3 px-4 rounded-2xl border text-[9px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                        isLight 
                          ? 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200/60' 
                          : 'bg-white/5 border-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <MessageCircle size={12} className="text-orange-500" /> WhatsApp
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Pasarela Virtual de Mercado Pago */}

      {/* MODAL DE RESERVAR MESA */}
      {isReservationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div 
            className="absolute inset-0 bg-black/70 backdrop-blur-md"
            onClick={() => setIsReservationModalOpen(false)}
          />
          <div className="relative bg-neutral-950 border border-neutral-900 w-full max-w-md rounded-3xl p-6 space-y-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-xl font-black text-white">📅 Reservar Mesa</h3>
                <p className="text-xs text-neutral-400 mt-0.5">Completa los detalles de tu visita.</p>
              </div>
              <button 
                onClick={() => setIsReservationModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-neutral-900 text-neutral-400 hover:text-white hover:bg-neutral-800 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Seña informativa */}
              {reservationDepositAmount > 0 && (
                <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-2xl text-center space-y-1">
                  <span className="text-[10px] font-black uppercase text-orange-500 block tracking-wider">Seña Requerida</span>
                  <span className="text-lg font-black text-white block">${reservationDepositAmount.toLocaleString()}</span>
                  <span className="text-[7.5px] text-slate-400 uppercase font-bold block">El importe será descontado de tu total en tu pedido final.</span>
                </div>
              )}

              {/* Nombre */}
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-neutral-500 block ml-1">Tu Nombre</label>
                <input
                  type="text"
                  placeholder="Ej. Juan Pérez"
                  value={reservationName}
                  onChange={(e) => setReservationName(e.target.value)}
                  className="w-full bg-neutral-900/50 border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white focus:ring-1 focus:ring-white transition-all placeholder:text-neutral-600 font-bold"
                />
              </div>

              {/* Teléfono */}
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-neutral-500 block ml-1">Teléfono de Contacto</label>
                <div className="flex gap-2">
                  <select
                    value={reservationPhonePrefix}
                    onChange={(e) => setReservationPhonePrefix(e.target.value)}
                    className="bg-neutral-900 border border-neutral-800 rounded-xl px-2.5 py-3 text-xs outline-none text-neutral-300 font-bold focus:border-white transition-all cursor-pointer"
                  >
                    <option value="+54">🇦🇷 +54 (AR)</option>
                    <option value="+56">🇨🇱 +56 (CL)</option>
                    <option value="+598">🇺🇾 +598 (UY)</option>
                    <option value="+591">🇧🇴 +591 (BO)</option>
                    <option value="+55">🇧🇷 +55 (BR)</option>
                    <option value="+51">🇵🇪 +51 (PE)</option>
                    <option value="+57">🇨🇴 +57 (CO)</option>
                    <option value="+595">🇵🇾 +595 (PY)</option>
                    <option value="+593">🇪🇨 +593 (EC)</option>
                    <option value="+58">🇻🇪 +58 (VE)</option>
                  </select>
                  <input
                    type="tel"
                    placeholder="Celular (ej: 9 11 1234-5678)"
                    value={reservationPhone}
                    onChange={(e) => setReservationPhone(e.target.value)}
                    className="flex-1 bg-neutral-900/50 border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white focus:ring-1 focus:ring-white transition-all placeholder:text-neutral-600 font-bold"
                  />
                </div>
              </div>

              {/* Fecha y Hora en Fila */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-neutral-500 block ml-1">Día</label>
                  <input
                    type="date"
                    min={reservationDateLimits.min}
                    max={reservationDateLimits.max}
                    value={reservationDate}
                    onChange={(e) => {
                      const val = e.target.value;
                      setReservationDate(val);
                      
                      if (val && val.length === 10) {
                        const selected = new Date(val + 'T00:00:00');
                        const today = new Date();
                        today.setHours(0,0,0,0);
                        const maxDate = new Date();
                        maxDate.setMonth(maxDate.getMonth() + 1);
                        maxDate.setHours(23,59,59,999);
                        
                        if (selected < today) {
                          alert("⚠️ No puedes seleccionar una fecha en el pasado.");
                          setReservationDate(reservationDateLimits.min);
                        } else if (selected > maxDate) {
                          alert("⚠️ Solo puedes reservar con un máximo de 1 mes de anticipación.");
                          setReservationDate(reservationDateLimits.min);
                        }
                      }
                    }}
                    className="w-full bg-neutral-900/50 border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white focus:ring-1 focus:ring-white transition-all font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-neutral-500 block ml-1">Hora</label>
                  <input
                    type="time"
                    value={reservationTime}
                    onChange={(e) => setReservationTime(e.target.value)}
                    className="w-full bg-neutral-900/50 border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white focus:ring-1 focus:ring-white transition-all font-bold"
                  />
                </div>
              </div>

              {/* Cantidad de personas */}
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-neutral-500 block ml-1">Cantidad de Personas</label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setReservationPartySize(prev => Math.max(1, prev - 1))}
                    className="w-10 h-10 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center font-bold text-white hover:bg-neutral-800 transition-all active:scale-95"
                  >
                    -
                  </button>
                  <div className="flex-1 bg-neutral-900/30 border border-neutral-900 rounded-xl py-2.5 text-center font-bold text-sm text-white">
                    👥 {reservationPartySize} {reservationPartySize === 1 ? 'Persona' : 'Personas'}
                  </div>
                  <button
                    type="button"
                    onClick={() => setReservationPartySize(prev => prev + 1)}
                    className="w-10 h-10 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center font-bold text-white hover:bg-neutral-800 transition-all active:scale-95"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setIsReservationModalOpen(false)}
                className="flex-1 py-3 rounded-2xl bg-neutral-900 text-neutral-400 hover:text-white hover:bg-neutral-800 transition-all font-bold text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmitReservation}
                disabled={isSubmittingReservation}
                className="flex-1 py-3 rounded-2xl bg-white text-black hover:scale-[1.02] active:scale-[0.98] transition-all font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmittingReservation ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Guardando...</span>
                  </>
                ) : (
                  <span>{reservationDepositAmount > 0 ? 'Pagar Seña' : 'Confirmar Reserva'}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PASARELA VIRTUAL DE PAGO DE SEÑA MERCADO PAGO */}
      {isMpReservationModalOpen && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/85 backdrop-blur-md" 
            onClick={() => {
              if (!isMpReservationPaying && !isMpReservationSuccess) {
                setIsMpReservationModalOpen(false);
              }
            }}
          />
          
          <div className="relative w-full max-w-sm bg-neutral-950 border border-neutral-900 rounded-[2.5rem] p-6 space-y-6 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {isMpReservationSuccess && (
              <div className="py-8 flex flex-col items-center text-center space-y-4 animate-in zoom-in duration-300">
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-3xl shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                  ✓
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-black text-white uppercase tracking-wide">¡Seña Acreditada!</h3>
                  <p className="text-xs text-neutral-400">Tu reserva ha sido confirmada con éxito.</p>
                </div>

                <div className="w-full p-4 bg-neutral-900/40 border border-neutral-900 rounded-2xl space-y-2 mt-4">
                  <span className="text-[8px] font-black uppercase text-slate-500 block">Código Único de Reserva</span>
                  <span className="text-2xl font-black text-orange-500 tracking-wider block">{generatedReservationCode}</span>
                  <span className="text-[7px] text-slate-500 uppercase font-bold block leading-relaxed">Presenta este código al mozo o ingrésalo en el carrito de compras para descontar tu seña.</span>
                </div>

                <a
                  href={`https://wa.me/${formatWhatsAppNumber(socialLinks.whatsapp || '5491122334455')}?text=${encodeURIComponent(
                    `*¡Hola! Acabo de registrar una Reserva con Seña Pagada en ${tenant.name}!*\n\n` +
                    `*Detalles de la Reserva:*\n` +
                    `• *Nombre:* ${reservationName}\n` +
                    `• *Teléfono:* ${reservationPhonePrefix} ${reservationPhone}\n` +
                    `• *Día y Hora:* ${reservationDate} a las ${reservationTime} hs\n` +
                    `• *Personas:* ${reservationPartySize} comensales\n` +
                    `• *Seña Pagada:* $${reservationToPayAmount.toLocaleString()}\n` +
                    `• *CÓDIGO ÚNICO:* ${generatedReservationCode}\n\n` +
                    `_Por favor, confirmen la recepción. ¡Muchas gracias!_`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg"
                >
                  <MessageCircle size={14} />
                  Enviar comprobante a mi WhatsApp
                </a>

                <button
                  onClick={() => setIsMpReservationModalOpen(false)}
                  className="text-xs text-neutral-500 hover:text-white uppercase tracking-wider font-bold pt-2"
                >
                  Cerrar Ventana
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {/* MODAL DE DEJAR RESEÑA */}
      {isReviewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/70 backdrop-blur-md"
            onClick={() => setIsReviewModalOpen(false)}
          />
          <div className="relative bg-neutral-950 border border-neutral-900 w-full max-w-md rounded-3xl p-6 space-y-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            {/* Header del Modal */}
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-xl font-black text-white">Dejar mi Reseña</h3>
                <p className="text-xs text-neutral-400 mt-0.5">Comparte tu opinión con la comunidad.</p>
              </div>
              <button 
                onClick={() => setIsReviewModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-neutral-900 text-neutral-400 hover:text-white hover:bg-neutral-800 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Formulario */}
            <div className="space-y-4">
              {/* Selector de Estrellas */}
              <div className="space-y-2 text-center py-2 bg-neutral-900/30 rounded-2xl border border-neutral-900">
                <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block">
                  Calificación
                </label>
                <div className="flex justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setNewReviewRating(star)}
                      className="p-1 hover:scale-125 transition-transform"
                    >
                      <Star 
                        className={`w-8 h-8 transition-colors ${
                          star <= newReviewRating 
                            ? 'text-amber-400 fill-current drop-shadow-[0_0_8px_rgba(245,158,11,0.4)]' 
                            : 'text-neutral-700'
                        }`} 
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Nombre */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block ml-1">
                  Tu Nombre
                </label>
                <input
                  type="text"
                  placeholder="Ej. Juan Pérez"
                  value={newReviewName}
                  onChange={(e) => setNewReviewName(e.target.value)}
                  className="w-full bg-neutral-900/50 border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white focus:ring-1 focus:ring-white transition-all placeholder:text-neutral-600"
                  required
                />
              </div>

              {/* Comentario */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block ml-1">
                  Comentario
                </label>
                <textarea
                  placeholder="Cuéntanos qué te pareció la comida, la atención y el ambiente..."
                  value={newReviewComment}
                  onChange={(e) => setNewReviewComment(e.target.value)}
                  rows={4}
                  className="w-full bg-neutral-900/50 border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white focus:ring-1 focus:ring-white transition-all resize-none placeholder:text-neutral-600"
                />
              </div>
            </div>

            {/* Acciones */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setIsReviewModalOpen(false)}
                className="flex-1 py-3 rounded-2xl bg-neutral-900 text-neutral-400 hover:text-white hover:bg-neutral-800 transition-all font-bold text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmitReview}
                disabled={isSubmittingReview}
                className="flex-1 py-3 rounded-2xl bg-white text-black hover:scale-[1.02] active:scale-[0.98] transition-all font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmittingReview ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Guardando...</span>
                  </>
                ) : (
                  <span>Enviar Reseña</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal de Éxito Premium de Pedido */}
      {orderSuccess && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center px-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
          <div 
            className={`w-full max-w-md rounded-[2.5rem] p-8 border shadow-2xl animate-in zoom-in-95 duration-200 text-center space-y-6 ${
              isLight 
                ? 'bg-white border-slate-200 text-slate-900 shadow-slate-200/50' 
                : 'glass border-white/10 bg-gradient-to-br from-neutral-900 via-neutral-950 to-neutral-900 text-white'
            }`}
          >
            {/* Ícono animado de éxito */}
            <div className="relative w-20 h-20 mx-auto flex items-center justify-center rounded-full bg-green-500/10 border border-green-500/20 text-green-400">
              <CheckCircle className="w-10 h-10 animate-bounce" />
              <div className="absolute -inset-1 rounded-full border border-green-500/10 animate-ping opacity-75" />
            </div>

            <div className="space-y-2">
              <h3 className="text-2xl font-black uppercase tracking-tight italic bg-gradient-to-r from-green-400 to-emerald-500 bg-clip-text text-transparent">
                ¡Pedido Recibido con Éxito!
              </h3>
              <div className="inline-flex bg-green-500/10 border border-green-500/20 text-green-400 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider">
                Orden #{successOrderNumber}
              </div>
            </div>

            <div className={`text-sm leading-relaxed ${isLight ? 'text-slate-650' : 'text-neutral-350'}`}>
              {tableParamId ? (
                <>
                  <p className="font-extrabold text-green-400 text-base">¡Gracias por la compra!</p>
                  <p className="mt-1.5 font-bold">Tu pedido ya está siendo preparado.</p>
                  <p className="mt-0.5 text-xs text-slate-400">En cuanto esté listo, se acercarán a tu mesa.</p>
                  <div className="text-[10.5px] leading-relaxed font-bold mt-4 border-t border-white/5 pt-3.5 space-y-1.5 text-center">
                    <p className="text-orange-400 uppercase tracking-wider text-[9px] font-black">🛎️ ¿Tienes alguna duda o quieres asistencia?</p>
                    <p className={isLight ? 'text-slate-600 font-extrabold' : 'text-neutral-400'}>
                      Recuerda que tienes un botón ahí en el menú para **llamar al mozo cuando quieras**, en el momento que quieras. ¡No dudes en utilizarlo ante cualquier inquietud!
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <p className="font-extrabold text-green-400 text-base">¡Muchas gracias por tu compra!</p>
                  <p className="mt-1.5 font-bold">Tu pedido ya está siendo preparado con dedicación.</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {deliveryType === 'delivery' ? 'Te avisaremos cuando esté en camino con el repartidor.' : 'Te avisaremos cuando esté listo para retirar en mostrador.'}
                  </p>
                </>
              )}
            </div>

            {/* Acciones del Modal */}
            <div className="space-y-3 pt-4">
              <button
                onClick={() => {
                  setOrderSuccess(false);
                  setSuccessOrderNumber(null);
                  setIsCartOpen(false);
                }}
                className={`w-full py-4 font-black text-xs uppercase tracking-widest rounded-2xl border transition-all active:scale-95 ${
                  isLight 
                    ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-650 hover:text-slate-900 shadow-sm' 
                    : 'bg-neutral-900 hover:bg-neutral-800 border-neutral-800 text-neutral-400 hover:text-white'
                }`}
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
