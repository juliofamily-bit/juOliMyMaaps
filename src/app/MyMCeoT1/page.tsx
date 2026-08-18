"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { ShieldAlert, LogIn, Activity, Users, Settings, Tag, MessageSquare, Power, Search, Loader2, ChevronDown, ChevronUp, CreditCard, Clock, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { MaxesLogo, MaxesWatermark, MaxesCornerFrame } from '@/components/MaxesLogo';

export default function MasterAdminPage() {
    const router = useRouter();
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loginForm, setLoginForm] = useState({ email: '', password: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState('dashboard');
    const [saasData, setSaasData] = useState<any>(null);
    const [expandedTenantId, setExpandedTenantId] = useState<string | null>(null);

    // Formulario de Cupones
    const [couponForm, setCouponForm] = useState({ code: '', type: 'percentage', value: '70', duration_months: '3' });
    const [isCreatingCoupon, setIsCreatingCoupon] = useState(false);

    // Fetch data via RPC
    const fetchSaasData = async (email: string, pass: string) => {
        setLoading(true);
        try {
            const { data, error } = await supabase.rpc('get_all_saas_data', {
                p_admin_email: email,
                p_admin_pass: pass
            });

            if (error) throw error;
            if (data && data.success) {
                setSaasData(data);
                setIsAuthenticated(true);
                // Ocultar credenciales en variables de estado para futuros llamados
                localStorage.setItem('saas_ceo_auth', JSON.stringify({ email, pass }));
            } else {
                setError(data?.error || 'Credenciales inválidas');
            }
        } catch (err: any) {
            console.error(err);
            setError('Error: ' + (err.message || 'Fallo de conexión. ¿Ejecutaste el script SQL?'));
        } finally {
            setLoading(false);
        }
    };

    // Helper to generate a random 8-character promo code
    const generateRandomCode = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = 'MAX-';
        for (let i = 0; i < 8; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        setCouponForm(prev => ({...prev, code}));
    };

    // Intentar auto-login si ya había entrado antes
    useEffect(() => {
        const stored = localStorage.getItem('saas_ceo_auth');
        if (stored) {
            const { email, pass } = JSON.parse(stored);
            setLoginForm({ email, password: pass });
            fetchSaasData(email, pass);
            // Generate random initial code
            generateRandomCode();
        }
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        await fetchSaasData(loginForm.email, loginForm.password);
        generateRandomCode();
    };

    const handleLogout = () => {
        localStorage.removeItem('saas_ceo_auth');
        setIsAuthenticated(false);
        setSaasData(null);
        setLoginForm({ email: '', password: '' });
    };

    const toggleTenantSuspension = async (tenantId: string, currentStatus: boolean) => {
        const { email, password } = loginForm;
        const confirmMsg = currentStatus 
            ? '¿Estás seguro de que deseas REACTIVAR esta cuenta?' 
            : '¿Estás seguro de que deseas SUSPENDER esta cuenta? Se bloqueará el acceso a todos sus empleados.';
            
        if (!window.confirm(confirmMsg)) return;

        setLoading(true);
        const { data, error } = await supabase.rpc('toggle_tenant_suspension', {
            p_admin_email: email,
            p_admin_pass: password,
            p_tenant_id: tenantId,
            p_suspend: !currentStatus
        });

        if (data?.success) {
            await fetchSaasData(email, password); // refresh data
        } else {
            alert('Error al cambiar estado: ' + (error?.message || data?.error));
        }
        setLoading(false);
    };

    const handleCreateCoupon = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsCreatingCoupon(true);
        const { email, password } = loginForm;

        const { data, error } = await supabase.rpc('create_discount_code', {
            p_admin_email: email,
            p_admin_pass: password,
            p_code: couponForm.code.trim().toUpperCase(),
            p_type: couponForm.type,
            p_value: parseFloat(couponForm.value),
            p_duration_months: parseInt(couponForm.duration_months) || 1
        });

        if (data?.success) {
            alert('¡Cupón creado con éxito! Se marcó como código de un solo uso.');
            // Clean up and generate new code
            setCouponForm({ code: '', type: 'percentage', value: '70', duration_months: '3' });
            generateRandomCode();
            
            // Refresh
            await fetchSaasData(email, password); // refresh data
        } else {
            alert('Error al crear cupón: ' + (error?.message || data?.error));
        }
        setIsCreatingCoupon(false);
    };

    // ================= PANTALLA DE LOGIN =================
    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative">
                <MaxesWatermark />
                <div className="max-w-md w-full relative z-10">
                    <div className="glass p-8 rounded-[2rem] border border-white/10 shadow-2xl animate-in fade-in zoom-in duration-500 relative overflow-hidden">
                        <MaxesCornerFrame color="gold" opacity="opacity-50" />
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 to-purple-500"></div>
                        <div className="mb-8">
                            <MaxesLogo appName="Mmm TodoLoQueQuiero CEO" scale={1.2} />
                        </div>

                        {error && (
                            <div className="mb-6 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-500 text-sm text-center">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleLogin} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Correo Maestro</label>
                                <input 
                                    type="email" 
                                    required
                                    value={loginForm.email}
                                    onChange={e => setLoginForm({...loginForm, email: e.target.value})}
                                    className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-colors"
                                    placeholder="ceo@mmmtodoloquequierocomer.com.ar"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Código de Acceso</label>
                                <input 
                                    type="password" 
                                    required
                                    value={loginForm.password}
                                    onChange={e => setLoginForm({...loginForm, password: e.target.value})}
                                    className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-colors"
                                    placeholder="••••••••"
                                />
                            </div>

                            <button 
                                type="submit" 
                                disabled={loading}
                                className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold py-3 rounded-xl transition-all shadow-[0_0_20px_rgba(249,115,22,0.3)] flex items-center justify-center gap-2 mt-4"
                            >
                                {loading ? <Loader2 size={20} className="animate-spin" /> : <LogIn size={20} />}
                                {loading ? 'Verificando...' : 'Entrar al Panel'}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        );
    }

    // ================= PANTALLA PRINCIPAL DEL CEO =================
    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 relative pb-20 md:pb-0">
            <MaxesWatermark />
            
            {/* Header del Dashboard */}
            <header className="sticky top-0 z-40 glass border-b border-white/5 px-6 py-4 flex items-center justify-between relative">
                <div className="flex items-center gap-3">
                    <MaxesLogo appName="Mmm TodoLoQueQuiero CEO" scale={0.7} />
                </div>

                <div className="flex items-center gap-4">
                    <button onClick={() => fetchSaasData(loginForm.email, loginForm.password)} className="text-slate-400 hover:text-white transition-colors" title="Actualizar Datos">
                        <Activity size={20} />
                    </button>
                    <button onClick={handleLogout} className="text-red-400 hover:text-red-300 transition-colors flex items-center gap-2 text-sm font-bold bg-red-400/10 px-3 py-1.5 rounded-lg">
                        <Power size={16} /> Salir
                    </button>
                </div>
            </header>

            <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 md:grid-cols-12 gap-6">
                
                {/* Sidebar Navigation */}
                <div className="md:col-span-3 space-y-2">
                    {[
                        { id: 'dashboard', icon: <Activity size={18} />, label: 'Visión General' },
                        { id: 'tenants', icon: <Users size={18} />, label: 'Gestión de Locales' },
                        { id: 'promos', icon: <Tag size={18} />, label: 'Cupones y Promos' },
                        { id: 'support', icon: <MessageSquare size={18} />, label: 'Bandeja de Soporte' },
                        { id: 'settings', icon: <Settings size={18} />, label: 'Ajustes de Cobro' },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${
                                activeTab === tab.id 
                                ? 'bg-orange-500 text-white shadow-[0_0_15px_rgba(249,115,22,0.3)]' 
                                : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                            }`}
                        >
                            {tab.icon} {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content Area */}
                <div className="md:col-span-9 space-y-6">
                    {loading && (
                        <div className="flex items-center gap-2 text-orange-500 font-bold bg-orange-500/10 p-3 rounded-xl animate-pulse">
                            <Loader2 size={16} className="animate-spin" /> Sincronizando datos con la base central...
                        </div>
                    )}

                    {activeTab === 'dashboard' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                            <h2 className="text-2xl font-black text-white">Resumen Financiero</h2>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="glass p-5 rounded-2xl border border-white/5 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-4 opacity-10"><Users size={48}/></div>
                                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Cuentas Registradas</h3>
                                    <p className="text-3xl font-black text-white">{saasData?.tenants?.length || 0}</p>
                                    <p className="text-[9px] text-slate-500 mt-2 font-bold uppercase">Totales creadas</p>
                                </div>
                                <div className="glass p-5 rounded-2xl border border-white/5 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-4 opacity-10"><Settings size={48}/></div>
                                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Cargando Datos</h3>
                                    <p className="text-3xl font-black text-blue-400">
                                        {saasData?.tenants?.filter((t:any) => t.products_count > 0 && t.orders_count === 0).length || 0}
                                    </p>
                                    <p className="text-[9px] text-slate-500 mt-2 font-bold uppercase">Aún no facturan</p>
                                </div>
                                <div className="glass p-5 rounded-2xl border border-white/5 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-4 opacity-10"><Activity size={48}/></div>
                                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">En Trial (14 días)</h3>
                                    <p className="text-3xl font-black text-orange-400">
                                        {saasData?.tenants?.filter((t:any) => t.orders_count > 0 && t.subscription_status === 'trial').length || 0}
                                    </p>
                                    <p className="text-[9px] text-slate-500 mt-2 font-bold uppercase">Trial activo</p>
                                </div>
                                <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 p-5 rounded-2xl border border-purple-500/30 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-4 opacity-10 text-purple-400"><Tag size={48}/></div>
                                    <h3 className="text-[10px] font-bold text-purple-300 uppercase tracking-widest mb-1">Suscripciones Pagas</h3>
                                    <p className="text-3xl font-black text-white">
                                        {saasData?.tenants?.filter((t:any) => t.subscription_status === 'active').length || 0}
                                    </p>
                                    <p className="text-[9px] text-purple-400/80 mt-2 font-bold uppercase">Clientes retenidos</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 p-6 rounded-2xl border border-emerald-500/20 relative overflow-hidden">
                                    <h3 className="text-[11px] font-bold text-emerald-400 uppercase tracking-widest mb-1">Ingresos (MRR Proyectado)</h3>
                                    <p className="text-4xl font-black text-emerald-400">
                                        {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(
                                            saasData?.tenants?.filter((t:any) => t.subscription_status === 'active').reduce((acc: number, t: any) => acc + (parseFloat(t.price_ars) || 0), 0) || 0
                                        )}
                                    </p>
                                    <p className="text-[10px] text-emerald-500/60 mt-2 font-bold uppercase">Suma de cuotas mensuales activas</p>
                                </div>

                                <div className="glass p-6 rounded-2xl border border-white/5 relative overflow-hidden">
                                    <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4">Embudo de Conversión Detallado</h3>
                                    <div className="space-y-4">
                                        
                                        {/* Paso 1: Creados */}
                                        <div className="space-y-1">
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="text-slate-400">1. Locales Registrados (Top Funnel)</span>
                                                <span className="font-black text-white">{saasData?.tenants?.length || 0}</span>
                                            </div>
                                            <div className="w-full bg-slate-900 rounded-full h-1.5">
                                                <div className="bg-slate-500 h-1.5 rounded-full" style={{ width: '100%' }}></div>
                                            </div>
                                        </div>

                                        {/* Paso 2: Configurando / No facturan */}
                                        <div className="space-y-1">
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="text-slate-400">2. Pendientes de Activar (Sin Ventas)</span>
                                                <span className="font-black text-white">
                                                    {saasData?.tenants?.filter((t:any) => !t.orders_count || t.orders_count === 0).length || 0}
                                                </span>
                                            </div>
                                            <div className="w-full bg-slate-900 rounded-full h-1.5">
                                                <div className="bg-blue-500/50 h-1.5 rounded-full" style={{ width: `${saasData?.tenants?.length ? (saasData?.tenants?.filter((t:any) => !t.orders_count || t.orders_count === 0).length / saasData?.tenants?.length) * 100 : 0}%` }}></div>
                                            </div>
                                        </div>

                                        {/* Paso 3: En Trial Gratis */}
                                        <div className="space-y-1">
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="text-slate-400">3. En Período de Prueba (14 Días)</span>
                                                <span className="font-black text-white">
                                                    {saasData?.tenants?.filter((t:any) => t.subscription_status === 'trial').length || 0}
                                                </span>
                                            </div>
                                            <div className="w-full bg-slate-900 rounded-full h-1.5">
                                                <div className="bg-orange-500 h-1.5 rounded-full" style={{ width: `${saasData?.tenants?.length ? (saasData?.tenants?.filter((t:any) => t.subscription_status === 'trial').length / saasData?.tenants?.length) * 100 : 0}%` }}></div>
                                            </div>
                                        </div>

                                        {/* Paso 4: Pagando (Total) */}
                                        <div className="space-y-1">
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="text-slate-400">4. Suscripciones Activas (Promo + Normal)</span>
                                                <span className="font-black text-white">
                                                    {saasData?.tenants?.filter((t:any) => t.subscription_status === 'active').length || 0}
                                                </span>
                                            </div>
                                            <div className="w-full bg-slate-900 rounded-full h-1.5">
                                                <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${saasData?.tenants?.length ? (saasData?.tenants?.filter((t:any) => t.subscription_status === 'active').length / saasData?.tenants?.length) * 100 : 0}%` }}></div>
                                            </div>
                                        </div>

                                        {/* Paso 5: Abandonos / Churn */}
                                        <div className="space-y-1 pt-2 border-t border-white/5">
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="text-red-400">Abandonos (Trial Vencido / Cancelado)</span>
                                                <span className="font-black text-red-400">
                                                    {saasData?.tenants?.filter((t:any) => ['canceled', 'past_due', 'unpaid'].includes(t.subscription_status)).length || 0}
                                                </span>
                                            </div>
                                            <div className="w-full bg-slate-900 rounded-full h-1.5">
                                                <div className="bg-red-500 h-1.5 rounded-full" style={{ width: `${saasData?.tenants?.length ? (saasData?.tenants?.filter((t:any) => ['canceled', 'past_due', 'unpaid'].includes(t.subscription_status)).length / saasData?.tenants?.length) * 100 : 0}%` }}></div>
                                            </div>
                                        </div>

                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'tenants' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                            <div className="flex items-center justify-between">
                                <h2 className="text-2xl font-black text-white">Gestión de Locales</h2>
                                <div className="relative">
                                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input type="text" placeholder="Buscar local..." className="bg-slate-900 border border-white/10 rounded-full pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-orange-500" />
                                </div>
                            </div>

                            <div className="glass rounded-2xl border border-white/5 overflow-hidden">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-white/5 text-slate-400 uppercase tracking-widest text-[10px]">
                                        <tr>
                                            <th className="px-6 py-4 font-black">Local / Franquicia</th>
                                            <th className="px-6 py-4 font-black">Estado General</th>
                                            <th className="px-6 py-4 font-black">Cobro y Pagos</th>
                                            <th className="px-6 py-4 font-black text-right">Acción Maestra</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {saasData?.tenants?.map((tenant: any) => {
                                            const isExpanded = expandedTenantId === tenant.id;
                                            
                                            // Determine overall status visually
                                            let statusConfig = { color: 'text-slate-400', bg: 'bg-slate-500/10', label: 'Desconocido', icon: <Activity size={14}/> };
                                            if (tenant.is_suspended) {
                                                statusConfig = { color: 'text-red-500', bg: 'bg-red-500/10', label: 'Suspendido (Bloqueado)', icon: <XCircle size={14}/> };
                                            } else if (tenant.subscription_status === 'canceled') {
                                                statusConfig = { color: 'text-red-400', bg: 'bg-red-500/10', label: 'Cancelado', icon: <XCircle size={14}/> };
                                            } else if (tenant.subscription_status === 'trial' || tenant.subscription_status === 'pending_trial') {
                                                const hasPaymentMethodLocal = !!tenant.mp_payer_email || !!tenant.mp_subscription_id;
                                                if (hasPaymentMethodLocal) {
                                                    statusConfig = { color: 'text-orange-400', bg: 'bg-orange-500/10', label: 'En Prueba (Con Tarjeta)', icon: <CreditCard size={14}/> };
                                                } else {
                                                    statusConfig = { color: 'text-orange-400', bg: 'bg-orange-500/10', label: 'En Prueba (Sin Tarjeta)', icon: <Clock size={14}/> };
                                                }
                                            } else if (tenant.subscription_status === 'active') {
                                                const hasPaymentMethodLocal = !!tenant.mp_payer_email || !!tenant.mp_subscription_id;
                                                const hasPromoLocal = tenant.promo_pro_ends_at && new Date(tenant.promo_pro_ends_at) > new Date();
                                                
                                                if (hasPromoLocal && hasPaymentMethodLocal) {
                                                    statusConfig = { color: 'text-purple-400', bg: 'bg-purple-500/10', label: 'Activo (Promo + Tarjeta)', icon: <CheckCircle2 size={14}/> };
                                                } else if (hasPromoLocal && !hasPaymentMethodLocal) {
                                                    statusConfig = { color: 'text-purple-400', bg: 'bg-purple-500/10', label: 'Activo (Solo Promo)', icon: <CheckCircle2 size={14}/> };
                                                } else {
                                                    statusConfig = { color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Activo / Pagando', icon: <CheckCircle2 size={14}/> };
                                                }
                                            } else {
                                                statusConfig = { color: 'text-slate-400', bg: 'bg-slate-500/10', label: tenant.subscription_status || 'Sin datos', icon: <Activity size={14}/> };
                                            }

                                            // Determine payment status
                                            const hasPaymentMethod = !!tenant.mp_payer_email || !!tenant.mp_subscription_id;

                                            return (
                                                <React.Fragment key={tenant.id}>
                                                    <tr 
                                                        className="hover:bg-white/5 transition-colors cursor-pointer"
                                                        onClick={() => setExpandedTenantId(isExpanded ? null : tenant.id)}
                                                    >
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center justify-between">
                                                                <div>
                                                                    <div className="font-bold text-white flex items-center gap-2">
                                                                        {tenant.name}
                                                                        {tenant.promo_pro_ends_at && new Date(tenant.promo_pro_ends_at) > new Date() && (
                                                                            <span className="bg-purple-500/20 text-purple-400 text-[9px] px-1.5 py-0.5 rounded border border-purple-500/30 uppercase tracking-widest">PROMO</span>
                                                                        )}
                                                                    </div>
                                                                    <div className="text-slate-500 text-xs">{tenant.email}</div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold border ${statusConfig.bg} ${statusConfig.color} border-current/20`}>
                                                                {statusConfig.icon}
                                                                {statusConfig.label}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            {hasPaymentMethod ? (
                                                                <div className="space-y-1">
                                                                    <span className="text-emerald-400 font-bold text-xs flex items-center gap-1">
                                                                        <CreditCard size={14}/> Tarjeta/MP Vinculada
                                                                    </span>
                                                                    {tenant.subscription_status === 'active' ? (
                                                                        <span className="text-[10px] text-emerald-500 font-semibold block">Suscripción: Activa</span>
                                                                    ) : tenant.subscription_status === 'canceled' ? (
                                                                        <span className="text-[10px] text-red-400 font-semibold block">Suscripción: Desactivada (Cancelada)</span>
                                                                    ) : (
                                                                        <span className="text-[10px] text-amber-500 font-semibold block">Suscripción: Inactiva / Pendiente</span>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <span className="text-slate-500 font-bold text-xs flex items-center gap-1"><CreditCard size={14}/> Sin método de pago</span>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <div className="flex items-center justify-end gap-3">
                                                                <button 
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        toggleTenantSuspension(tenant.id, tenant.is_suspended);
                                                                    }}
                                                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                                                        tenant.is_suspended 
                                                                        ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20' 
                                                                        : 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20'
                                                                    }`}
                                                                >
                                                                    {tenant.is_suspended ? 'Reactivar' : 'Bloquear'}
                                                                </button>
                                                                <button className="p-1.5 rounded-md hover:bg-white/10 text-slate-400 transition-colors">
                                                                    {isExpanded ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                    
                                                    {/* DETALLES EXPANSIBLES */}
                                                    {isExpanded && (
                                                        <tr className="bg-slate-900/50 border-t border-white/5 border-b border-white/5">
                                                            <td colSpan={4} className="px-6 py-6">
                                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                                    {/* Columna 1: Plan y Vencimientos */}
                                                                    <div className="space-y-3">
                                                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-white/10 pb-2">Plan y Estado</h4>
                                                                        <div className="text-xs space-y-2">
                                                                            <div className="flex justify-between"><span className="text-slate-500">Plan Actual:</span> <span className="font-bold text-white">{tenant.plan_name || 'Ninguno'}</span></div>
                                                                            <div className="flex justify-between"><span className="text-slate-500">Status Interno:</span> <span className="font-mono text-slate-300">{tenant.subscription_status}</span></div>
                                                                            <div className="flex justify-between"><span className="text-slate-500">Trial Iniciado:</span> <span className="text-slate-300">{tenant.trial_started_at ? new Date(tenant.trial_started_at).toLocaleDateString() : 'Aún no inicia (Esperando 1ra venta)'}</span></div>
                                                                            <div className="flex justify-between"><span className="text-slate-500">Vencimiento Ciclo:</span> <span className="text-slate-300">{tenant.current_period_end ? new Date(tenant.current_period_end).toLocaleDateString() : 'N/A'}</span></div>
                                                                        </div>
                                                                    </div>
                                                                    
                                                                    {/* Columna 2: Pagos y Facturación */}
                                                                    <div className="space-y-3">
                                                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-white/10 pb-2">Información de Pago</h4>
                                                                        <div className="text-xs space-y-2">
                                                                            <div className="flex justify-between"><span className="text-slate-500">Cuenta MercadoPago:</span> <span className="font-bold text-white">{tenant.mp_payer_email || 'No vinculada'}</span></div>
                                                                            <div className="flex justify-between"><span className="text-slate-500">ID Suscripción MP:</span> <span className="font-mono text-[10px] text-slate-400">{tenant.mp_subscription_id || 'N/A'}</span></div>
                                                                            <div className="flex justify-between"><span className="text-slate-500">Precio del Plan:</span> <span className="text-emerald-400 font-bold">${tenant.price_ars || 0} ARS</span></div>
                                                                            <div className="flex justify-between"><span className="text-slate-500">Aviso Downgrade Activo:</span> <span className="text-slate-300">{tenant.show_downgrade_alert ? 'Sí (Avisado)' : 'No'}</span></div>
                                                                        </div>
                                                                    </div>

                                                                    {/* Columna 3: Promos y Descuentos */}
                                                                    <div className="space-y-3">
                                                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-white/10 pb-2">Descuentos Aplicados</h4>
                                                                        <div className="text-xs space-y-2">
                                                                            <div className="flex justify-between"><span className="text-slate-500">Promo Pro Gratis hasta:</span> <span className="font-bold text-purple-400">{tenant.promo_pro_ends_at ? new Date(tenant.promo_pro_ends_at).toLocaleDateString() : 'No tiene'}</span></div>
                                                                            <div className="flex justify-between"><span className="text-slate-500">Descuento %:</span> <span className="text-slate-300">{tenant.discount_percentage ? tenant.discount_percentage + '%' : 'Ninguno'}</span></div>
                                                                            <div className="flex justify-between"><span className="text-slate-500">Descuento Termina:</span> <span className="text-slate-300">{tenant.discount_ends_at ? new Date(tenant.discount_ends_at).toLocaleDateString() : 'N/A'}</span></div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab === 'promos' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                            <h2 className="text-2xl font-black text-white">Generador de Cupones</h2>
                            
                            <div className="glass p-6 rounded-2xl border border-white/5">
                                <form onSubmit={handleCreateCoupon} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                                    <div className="md:col-span-1 relative">
                                        <label className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                                            <span>Código Único</span>
                                            <button 
                                                type="button" 
                                                onClick={generateRandomCode}
                                                className="text-orange-500 hover:text-orange-400 flex items-center gap-1 text-[10px]"
                                            >
                                                <RefreshCw size={12} /> Regenerar
                                            </button>
                                        </label>
                                        <input 
                                            type="text" 
                                            required
                                            value={couponForm.code}
                                            onChange={e => setCouponForm({...couponForm, code: e.target.value.toUpperCase()})}
                                            className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-orange-500 uppercase font-mono tracking-wider"
                                            placeholder="MAX-XXXXXX"
                                        />
                                    </div>
                                    <div className="md:col-span-1">
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Tipo de Descuento</label>
                                        <select 
                                            value={couponForm.type}
                                            onChange={e => setCouponForm({...couponForm, type: e.target.value})}
                                            className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-orange-500"
                                        >
                                            <option value="percentage">Porcentaje Descuento (%)</option>
                                            <option value="free_months">Meses de Prueba Gratis</option>
                                        </select>
                                    </div>
                                    <div className="md:col-span-1">
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                                            {couponForm.type === 'percentage' ? 'Valor (%)' : 'Meses Gratis'}
                                        </label>
                                        <input 
                                            type="number" 
                                            required min="1" max={couponForm.type === 'percentage' ? 100 : 12}
                                            value={couponForm.value}
                                            onChange={e => setCouponForm({...couponForm, value: e.target.value})}
                                            className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-orange-500"
                                        />
                                    </div>
                                    {couponForm.type === 'percentage' && (
                                        <div className="md:col-span-1">
                                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Duración (Meses)</label>
                                            <input 
                                                type="number" 
                                                required min="1" max="24"
                                                value={couponForm.duration_months}
                                                onChange={e => setCouponForm({...couponForm, duration_months: e.target.value})}
                                                className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-orange-500"
                                            />
                                        </div>
                                    )}
                                    <div className="md:col-span-1">
                                        <button 
                                            type="submit" 
                                            disabled={isCreatingCoupon}
                                            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded-xl transition-all h-[42px] flex items-center justify-center gap-2"
                                        >
                                            {isCreatingCoupon ? <Loader2 size={16} className="animate-spin" /> : <Tag size={16} />}
                                            Crear Cupón
                                        </button>
                                    </div>
                                </form>
                            </div>

                            <div className="glass rounded-2xl border border-white/5 overflow-hidden mt-6">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-white/5 text-slate-400 uppercase tracking-widest text-[10px]">
                                        <tr>
                                            <th className="px-6 py-4 font-black">Código</th>
                                            <th className="px-6 py-4 font-black">Beneficio</th>
                                            <th className="px-6 py-4 font-black">Estado</th>
                                            <th className="px-6 py-4 font-black">Usado por</th>
                                            <th className="px-6 py-4 font-black">Fecha Creación</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {saasData?.discount_codes?.length > 0 ? saasData.discount_codes.map((code: any) => (
                                            <tr key={code.id} className="hover:bg-white/5 transition-colors">
                                                <td className="px-6 py-4 font-black tracking-widest text-orange-400">{code.code}</td>
                                                <td className="px-6 py-4">
                                                    {code.discount_type === 'percentage' 
                                                        ? `${code.discount_value}% OFF x ${code.discount_duration_months} meses`
                                                        : `${code.discount_value} Meses Gratis`}
                                                </td>
                                                <td className="px-6 py-4">
                                                    {code.is_used ? (
                                                        <span className="text-red-400 text-xs font-bold px-2 py-1 bg-red-400/10 rounded-lg">USADO</span>
                                                    ) : (
                                                        <span className="text-emerald-400 text-xs font-bold px-2 py-1 bg-emerald-400/10 rounded-lg">DISPONIBLE</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-slate-300 font-bold">{code.used_by_tenant_name || '-'}</td>
                                                <td className="px-6 py-4 text-slate-500">{new Date(code.created_at).toLocaleDateString()}</td>
                                            </tr>
                                        )) : (
                                            <tr>
                                                <td colSpan={5} className="px-6 py-8 text-center text-slate-500">No hay cupones creados.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab === 'support' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                            <h2 className="text-2xl font-black text-white flex items-center gap-2">
                                Bandeja de Soporte 
                                <span className="bg-orange-500 text-white text-[10px] px-2 py-0.5 rounded-full">
                                    {saasData?.support_tickets?.filter((t:any) => t.status === 'open').length || 0} Nuevos
                                </span>
                            </h2>
                            
                            <div className="space-y-4">
                                {saasData?.support_tickets?.length > 0 ? saasData.support_tickets.map((ticket: any) => (
                                    <div key={ticket.id} className={`glass p-5 rounded-2xl border ${ticket.status === 'open' ? 'border-orange-500/50 shadow-[0_0_15px_rgba(249,115,22,0.1)]' : 'border-white/5 opacity-70'}`}>
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md mb-2 inline-block ${ticket.status === 'open' ? 'bg-orange-500/20 text-orange-400' : 'bg-slate-500/20 text-slate-400'}`}>
                                                    {ticket.status === 'open' ? 'Abierto' : 'Cerrado'}
                                                </span>
                                                <h3 className="font-bold text-white text-lg">{ticket.subject}</h3>
                                                <p className="text-xs text-slate-400 font-bold mt-1">Local: <span className="text-slate-300">{ticket.tenant_name}</span> • {new Date(ticket.created_at).toLocaleString()}</p>
                                            </div>
                                            {ticket.status === 'open' && (
                                                <button className="bg-white/10 hover:bg-white/20 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors">
                                                    Marcar Resuelto
                                                </button>
                                            )}
                                        </div>
                                        <div className="bg-slate-900/50 p-4 rounded-xl border border-white/5 text-slate-300 text-sm whitespace-pre-wrap">
                                            {ticket.message}
                                        </div>
                                    </div>
                                )) : (
                                    <div className="glass p-12 text-center rounded-2xl border border-white/5">
                                        <MessageSquare size={48} className="mx-auto text-slate-600 mb-4" />
                                        <p className="text-slate-400">No hay tickets de soporte en la bandeja.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'settings' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                            <h2 className="text-2xl font-black text-white flex items-center gap-2">
                                Ajustes de Cobro <Settings className="text-orange-500" />
                            </h2>

                            {/* Mostrar Planes */}
                            <div className="glass p-6 rounded-2xl border border-white/5 space-y-4">
                                <h3 className="text-lg font-bold text-white mb-2">Planes Activos (Suscripciones)</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {saasData?.plans?.map((plan: any) => (
                                        <div key={plan.id} className="p-4 rounded-xl border border-white/10 bg-slate-900/50">
                                            <h4 className="font-black text-orange-400 uppercase tracking-widest">{plan.name}</h4>
                                            <p className="text-2xl font-black text-white mt-2">
                                                {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(plan.price_ars)}
                                            </p>
                                            <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold">Por mes</p>
                                        </div>
                                    ))}
                                </div>
                                <p className="text-[10px] text-slate-500 italic mt-4">Para modificar los precios de los planes, actualiza la tabla `saas_plans` en Supabase.</p>
                            </div>

                            {/* Guía de Configuración de Mercado Pago */}
                            <div className="glass p-6 rounded-2xl border border-blue-500/20 bg-blue-500/5 space-y-4">
                                <h3 className="text-lg font-black text-blue-400 uppercase tracking-widest flex items-center gap-2">
                                    <ShieldAlert size={20} />
                                    Guía de Integración con Mercado Pago
                                </h3>
                                <div className="text-sm text-slate-300 space-y-4">
                                    <p>Para que los pagos automáticos (suscripciones mensuales) funcionen correctamente en tu aplicación SaaS, debes configurar tu cuenta de Mercado Pago Vendedor (CEO):</p>
                                    
                                    <div className="space-y-2">
                                        <h4 className="font-bold text-white">Paso 1: Obtener el Access Token (Producción)</h4>
                                        <ul className="list-disc pl-5 space-y-1 text-xs text-slate-400">
                                            <li>Ingresa a <a href="https://www.mercadopago.com.ar/developers/panel" target="_blank" className="text-blue-400 underline">Mercado Pago Developers</a> con tu cuenta principal.</li>
                                            <li>Crea una nueva aplicación en <strong>Tus Integraciones</strong>.</li>
                                            <li>Ve a <strong>Credenciales de Producción</strong>.</li>
                                            <li>Copia el <strong>Access Token</strong> (debe empezar con <code className="bg-black/50 px-1 py-0.5 rounded text-orange-400">APP_USR-</code>).</li>
                                            <li>Pega ese token en las variables de entorno de Vercel/Supabase bajo el nombre: <code className="bg-black/50 px-1 py-0.5 rounded text-white font-mono">MP_SAAS_ACCESS_TOKEN</code>.</li>
                                        </ul>
                                    </div>

                                    <div className="space-y-2">
                                        <h4 className="font-bold text-white">Paso 2: Configurar los Webhooks (Notificaciones)</h4>
                                        <ul className="list-disc pl-5 space-y-1 text-xs text-slate-400">
                                            <li>En la misma app de Mercado Pago, ve a <strong>Notificaciones Webhooks</strong>.</li>
                                            <li>URL de producción: <code className="bg-black/50 px-1 py-0.5 rounded text-white font-mono">https://tu-dominio.com/api/webhooks/mercadopago-saas</code></li>
                                            <li>Eventos a escuchar: Activa la casilla de <strong>Suscripciones (Preapproval)</strong>.</li>
                                        </ul>
                                    </div>

                                    <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl">
                                        <p className="text-xs text-blue-300 font-bold">
                                            ¡Una vez configurado esto, el sistema se encargará de todo! Cuando un local pague desde su panel, se creará una "Suscripción" automática y Mercado Pago le debitará el monto mes a mes sin que tengas que hacer nada más.
                                        </p>
                                    </div>
                                </div>
                            </div>

                        </div>
                    )}

                </div>
            </main>
        </div>
    );
}
