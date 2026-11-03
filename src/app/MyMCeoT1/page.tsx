"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
    ShieldAlert, LogIn, Activity, Users, Settings, Tag, MessageSquare, 
    Power, Search, Loader2, ChevronDown, ChevronUp, CreditCard, Clock, 
    CheckCircle2, XCircle, RefreshCw, MapPin, Compass, Copy, Check, 
    ExternalLink, Send, Sparkles, MessageCircle, Lock 
} from 'lucide-react';
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

    // Estados de Exclusividad Territorial y Cupos por Ciudad
    const [applicants, setApplicants] = useState<any[]>([]);
    const [loadingApplicants, setLoadingApplicants] = useState(false);
    const [applicantFilter, setApplicantFilter] = useState<'all' | 'pending_activation' | 'waitlist' | 'approved'>('all');
    const [applicantSearch, setApplicantSearch] = useState('');
    const [adminActionLoading, setAdminActionLoading] = useState<string | null>(null);
    const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
    const [actionStatusMsg, setActionStatusMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

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

    // Consultar todos los postulantes y locales con sus cupos territoriales
    const fetchApplicants = async () => {
        setLoadingApplicants(true);
        try {
            const res = await fetch('/api/access/admin-action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'get_applicants',
                    adminEmail: loginForm.email || 'ceo@mymapps.com',
                    adminPass: loginForm.password || 'master2026',
                })
            });
            const data = await res.json();
            if (data.success) {
                setApplicants(data.applicants || []);
            }
        } catch (e) {
            console.error('Error fetching applicants:', e);
        } finally {
            setLoadingApplicants(false);
        }
    };

    // Efecto para cargar postulantes al entrar en la pestaña de cupos
    useEffect(() => {
        if (isAuthenticated && activeTab === 'territory_caps') {
            fetchApplicants();
        }
    }, [activeTab, isAuthenticated]);

    // Aprobar excepción comercial
    const handleApproveException = async (tenantId: string, name: string) => {
        if (!window.confirm(`¿Aprobar excepción territorial para "${name}"? Se le asignará cupo y se le notificará por correo.`)) return;
        setAdminActionLoading(tenantId);
        setActionStatusMsg(null);
        try {
            const res = await fetch('/api/access/admin-action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'approve_exception',
                    tenantId,
                    adminEmail: loginForm.email || 'ceo@mymapps.com',
                    adminPass: loginForm.password || 'master2026',
                })
            });
            const data = await res.json();
            if (data.success) {
                setActionStatusMsg({ type: 'success', text: `¡${name} aprobado con éxito!` });
                await fetchApplicants();
            } else {
                setActionStatusMsg({ type: 'error', text: data.error || 'Error al aprobar' });
            }
        } catch (e: any) {
            setActionStatusMsg({ type: 'error', text: e.message || 'Error de conexión' });
        } finally {
            setAdminActionLoading(null);
        }
    };

    // Reenviar código por correo
    const handleResendCode = async (tenantId: string, email: string) => {
        setAdminActionLoading(tenantId);
        setActionStatusMsg(null);
        try {
            const res = await fetch('/api/access/admin-action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'resend_code',
                    tenantId,
                    adminEmail: loginForm.email || 'ceo@mymapps.com',
                    adminPass: loginForm.password || 'master2026',
                })
            });
            const data = await res.json();
            if (data.success) {
                setActionStatusMsg({ type: 'success', text: `Código reenviado a ${email}` });
            } else {
                setActionStatusMsg({ type: 'error', text: data.error || 'Error al reenviar' });
            }
        } catch (e: any) {
            setActionStatusMsg({ type: 'error', text: e.message || 'Error de conexión' });
        } finally {
            setAdminActionLoading(null);
        }
    };

    // Generar nuevo código aleatorio
    const handleGenerateNewCode = async (tenantId: string, name: string) => {
        if (!window.confirm(`¿Generar un nuevo código aleatorio para "${name}" y enviárselo por email?`)) return;
        setAdminActionLoading(tenantId);
        setActionStatusMsg(null);
        try {
            const res = await fetch('/api/access/admin-action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'generate_new_code',
                    tenantId,
                    adminEmail: loginForm.email || 'ceo@mymapps.com',
                    adminPass: loginForm.password || 'master2026',
                })
            });
            const data = await res.json();
            if (data.success) {
                setActionStatusMsg({ type: 'success', text: `Nuevo código generado (${data.newCode}) y enviado por correo.` });
                await fetchApplicants();
            } else {
                setActionStatusMsg({ type: 'error', text: data.error || 'Error al generar código' });
            }
        } catch (e: any) {
            setActionStatusMsg({ type: 'error', text: e.message || 'Error de conexión' });
        } finally {
            setAdminActionLoading(null);
        }
    };

    // Liberar cupo (mover a lista de espera)
    const handleReleaseSpot = async (tenantId: string, name: string) => {
        if (!window.confirm(`¿Liberar el cupo de "${name}" y moverlo a lista de espera?`)) return;
        setAdminActionLoading(tenantId);
        setActionStatusMsg(null);
        try {
            const res = await fetch('/api/access/admin-action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'release_spot',
                    tenantId,
                    adminEmail: loginForm.email || 'ceo@mymapps.com',
                    adminPass: loginForm.password || 'master2026',
                })
            });
            const data = await res.json();
            if (data.success) {
                setActionStatusMsg({ type: 'success', text: `Cupo de ${name} liberado.` });
                await fetchApplicants();
            } else {
                setActionStatusMsg({ type: 'error', text: data.error || 'Error al liberar cupo' });
            }
        } catch (e: any) {
            setActionStatusMsg({ type: 'error', text: e.message || 'Error de conexión' });
        } finally {
            setAdminActionLoading(null);
        }
    };

    // Copiar código al portapapeles
    const handleCopyCode = (code: string, id: string) => {
        if (!code) return;
        navigator.clipboard.writeText(code);
        setCopiedCodeId(id);
        setTimeout(() => setCopiedCodeId(null), 2500);
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
                        { id: 'territory_caps', icon: <MapPin size={18} />, label: 'Cupos y Solicitudes' },
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

                    {activeTab === 'territory_caps' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div>
                                    <h2 className="text-2xl font-black text-white flex items-center gap-2">
                                        Exclusividad Territorial y Cupos por Ciudad <MapPin className="text-orange-500" size={24} />
                                    </h2>
                                    <p className="text-xs text-slate-400 mt-1">
                                        Gestión de plazas limitadas (máximo 5 locales por localidad). Monitoreo de solicitudes, códigos de activación y geolocalización GPS antifraude.
                                    </p>
                                </div>
                                <button
                                    onClick={fetchApplicants}
                                    disabled={loadingApplicants}
                                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-white/10 rounded-xl text-xs font-bold text-slate-300 flex items-center gap-2 self-start transition-colors"
                                >
                                    <RefreshCw size={14} className={loadingApplicants ? 'animate-spin text-orange-500' : ''} />
                                    Actualizar Cupos
                                </button>
                            </div>

                            {/* Alerta de Estado de Acciones */}
                            {actionStatusMsg && (
                                <div className={`p-4 rounded-2xl border flex items-center justify-between animate-in fade-in duration-300 ${
                                    actionStatusMsg.type === 'success' 
                                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                                        : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                                }`}>
                                    <p className="text-xs font-bold">{actionStatusMsg.text}</p>
                                    <button onClick={() => setActionStatusMsg(null)} className="text-xs opacity-60 hover:opacity-100 font-bold ml-4">✕</button>
                                </div>
                            )}

                            {/* Tarjetas Métricas Territoriales */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="glass p-5 rounded-2xl border border-white/5 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-4 opacity-10"><Users size={48}/></div>
                                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Solicitudes</h3>
                                    <p className="text-3xl font-black text-white">{applicants.length}</p>
                                    <p className="text-[9px] text-slate-500 mt-2 font-bold uppercase">Registros recibidos</p>
                                </div>

                                <div className="glass p-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-4 opacity-10 text-emerald-400"><CheckCircle2 size={48}/></div>
                                    <h3 className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-1">Cupos Aprobados</h3>
                                    <p className="text-3xl font-black text-emerald-400">
                                        {applicants.filter(a => a.access_status === 'approved' || !a.access_status).length}
                                    </p>
                                    <p className="text-[9px] text-emerald-500/70 mt-2 font-bold uppercase">Locales con plaza activa</p>
                                </div>

                                <div className="glass p-5 rounded-2xl border border-amber-500/20 bg-amber-500/5 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-4 opacity-10 text-amber-400"><Clock size={48}/></div>
                                    <h3 className="text-[10px] font-bold text-amber-400 uppercase tracking-widest mb-1">Esperando Código</h3>
                                    <p className="text-3xl font-black text-amber-400">
                                        {applicants.filter(a => a.access_status === 'pending_activation').length}
                                    </p>
                                    <p className="text-[9px] text-amber-500/70 mt-2 font-bold uppercase">Código enviado por mail</p>
                                </div>

                                <div className="glass p-5 rounded-2xl border border-purple-500/20 bg-purple-500/5 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-4 opacity-10 text-purple-400"><Sparkles size={48}/></div>
                                    <h3 className="text-[10px] font-bold text-purple-400 uppercase tracking-widest mb-1">En Lista de Espera</h3>
                                    <p className="text-3xl font-black text-purple-400">
                                        {applicants.filter(a => a.access_status === 'waitlist').length}
                                    </p>
                                    <p className="text-[9px] text-purple-400/70 mt-2 font-bold uppercase">Cupos llenos en su ciudad</p>
                                </div>
                            </div>

                            {/* Resumen de Ocupación por Ciudad */}
                            <div className="glass p-6 rounded-2xl border border-white/5 space-y-4">
                                <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                                    <MapPin size={14} className="text-orange-500" /> Ocupación de Cupos por Localidad (Máx 5 por Zona)
                                </h3>

                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                    {(() => {
                                        const cityMap: { [key: string]: { city: string, province: string, country: string, count: number } } = {};
                                        applicants.forEach(a => {
                                            const c = (a.city || 'Sin ciudad declarada').trim();
                                            const p = a.province || '';
                                            const key = `${c}-${p}`.toLowerCase();
                                            if (!cityMap[key]) {
                                                cityMap[key] = { city: c, province: p, country: a.country || 'Argentina', count: 0 };
                                            }
                                            if (a.access_status === 'approved' || !a.access_status) {
                                                cityMap[key].count++;
                                            }
                                        });

                                        const list = Object.values(cityMap);
                                        if (list.length === 0) {
                                            return <p className="text-xs text-slate-500 italic col-span-3">Aún no hay localidades registradas.</p>;
                                        }

                                        return list.map(item => {
                                            const isFull = item.count >= 5;
                                            return (
                                                <div key={`${item.city}-${item.province}`} className={`p-4 rounded-xl border flex items-center justify-between ${
                                                    isFull 
                                                        ? 'bg-rose-500/10 border-rose-500/30 text-rose-300' 
                                                        : 'bg-slate-900/60 border-white/5 text-slate-200'
                                                }`}>
                                                    <div>
                                                        <p className="font-bold text-sm text-white">{item.city}</p>
                                                        <p className="text-[10px] text-slate-400 uppercase tracking-wider">{item.province || item.country}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className={`text-xs font-mono font-black px-2.5 py-1 rounded-lg border ${
                                                            isFull ? 'bg-rose-500/20 border-rose-500/40 text-rose-400' : 'bg-orange-500/15 border-orange-500/30 text-orange-400'
                                                        }`}>
                                                            {item.count} / 5
                                                        </span>
                                                        <p className="text-[9px] mt-1 font-bold uppercase tracking-widest text-slate-500">
                                                            {isFull ? 'AGOTADO' : `${5 - item.count} libres`}
                                                        </p>
                                                    </div>
                                                </div>
                                            );
                                        });
                                    })()}
                                </div>
                            </div>

                            {/* Filtros y Buscador de Solicitudes */}
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                                    {[
                                        { id: 'all', label: 'Todos' },
                                        { id: 'approved', label: 'Aprobados' },
                                        { id: 'pending_activation', label: 'Esperando Código' },
                                        { id: 'waitlist', label: 'Lista de Espera' },
                                    ].map(f => (
                                        <button
                                            key={f.id}
                                            onClick={() => setApplicantFilter(f.id as any)}
                                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                                applicantFilter === f.id
                                                    ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                                                    : 'bg-slate-900/60 text-slate-400 hover:text-white border border-white/5'
                                            }`}
                                        >
                                            {f.label}
                                        </button>
                                    ))}
                                </div>

                                <div className="relative w-full sm:w-72">
                                    <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                                    <input
                                        type="text"
                                        placeholder="Buscar local, ciudad, titular o email..."
                                        value={applicantSearch}
                                        onChange={(e) => setApplicantSearch(e.target.value)}
                                        className="w-full bg-slate-900 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs focus:outline-none focus:border-orange-500 transition-colors"
                                    />
                                </div>
                            </div>

                            {/* Tabla Completa de Solicitantes */}
                            <div className="glass rounded-2xl border border-white/5 overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-white/5 text-slate-400 uppercase tracking-widest text-[9px]">
                                            <tr>
                                                <th className="px-5 py-4 font-black">Local y Titular</th>
                                                <th className="px-5 py-4 font-black">Ubicación Declarada</th>
                                                <th className="px-5 py-4 font-black">GPS Antifraude</th>
                                                <th className="px-5 py-4 font-black">Contacto</th>
                                                <th className="px-5 py-4 font-black">Estado</th>
                                                <th className="px-5 py-4 font-black">Código de Activación</th>
                                                <th className="px-5 py-4 font-black text-right">Acciones del CEO</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {applicants
                                                .filter(a => {
                                                    if (applicantFilter === 'approved') return a.access_status === 'approved' || !a.access_status;
                                                    if (applicantFilter === 'pending_activation') return a.access_status === 'pending_activation';
                                                    if (applicantFilter === 'waitlist') return a.access_status === 'waitlist';
                                                    return true;
                                                })
                                                .filter(a => {
                                                    if (!applicantSearch.trim()) return true;
                                                    const q = applicantSearch.toLowerCase();
                                                    return (
                                                        (a.name || '').toLowerCase().includes(q) ||
                                                        (a.owner_name || '').toLowerCase().includes(q) ||
                                                        (a.city || '').toLowerCase().includes(q) ||
                                                        (a.province || '').toLowerCase().includes(q) ||
                                                        (a.email || '').toLowerCase().includes(q) ||
                                                        (a.contact_phone || '').includes(q)
                                                    );
                                                })
                                                .map(a => {
                                                    const cleanPhone = (a.contact_phone || '').replace(/\D/g, '');
                                                    const isGpsOk = a.detected_lat && a.detected_lng;
                                                    const mapsUrl = isGpsOk ? `https://www.google.com/maps?q=${a.detected_lat},${a.detected_lng}` : null;
                                                    const isBusy = adminActionLoading === a.id;

                                                    return (
                                                        <tr key={a.id} className="hover:bg-white/5 transition-colors">
                                                            {/* Local y Titular */}
                                                            <td className="px-5 py-4">
                                                                <div className="font-bold text-white text-sm">{a.name}</div>
                                                                <div className="text-[10px] text-slate-400 mt-0.5">
                                                                    {a.owner_name ? `👤 Titular: ${a.owner_name}` : 'Titular no especificado'}
                                                                </div>
                                                                <div className="text-[9px] font-mono text-slate-500 mt-0.5">/{a.slug}</div>
                                                            </td>

                                                            {/* Ubicación */}
                                                            <td className="px-5 py-4">
                                                                <div className="font-bold text-slate-200">
                                                                    {a.city || <span className="text-slate-600 italic">No especificada</span>}
                                                                </div>
                                                                <div className="text-[10px] text-slate-400">
                                                                    {a.province ? `${a.province}, ` : ''}{a.country || 'Argentina'}
                                                                </div>
                                                                {a.zone && (
                                                                    <div className="text-[9px] text-orange-400/80 font-medium">Barrio: {a.zone}</div>
                                                                )}
                                                            </td>

                                                            {/* GPS Antifraude */}
                                                            <td className="px-5 py-4">
                                                                {isGpsOk ? (
                                                                    <a
                                                                        href={mapsUrl!}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 font-bold text-[10px] hover:bg-emerald-500/20 transition-colors"
                                                                        title="Abrir ubicación real en Google Maps"
                                                                    >
                                                                        <Compass size={12} />
                                                                        GPS OK (Ver Mapa)
                                                                        <ExternalLink size={10} />
                                                                    </a>
                                                                ) : (
                                                                    <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
                                                                        ⚠️ Sin GPS verificado
                                                                    </span>
                                                                )}
                                                            </td>

                                                            {/* Contacto */}
                                                            <td className="px-5 py-4">
                                                                <div className="text-slate-300 font-medium">{a.email}</div>
                                                                {cleanPhone ? (
                                                                    <a
                                                                        href={`https://wa.me/${cleanPhone.startsWith('54') ? cleanPhone : '549' + cleanPhone}?text=${encodeURIComponent(
                                                                            `Hola ${a.owner_name || a.name}, te escribimos de la dirección de mmmTodoLoQueQuiero respecto a tu solicitud para el local en ${a.city}...`
                                                                        )}`}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="inline-flex items-center gap-1.5 mt-1 text-[10px] font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
                                                                    >
                                                                        <MessageCircle size={12} />
                                                                        {a.contact_phone} (WhatsApp ↗)
                                                                    </a>
                                                                ) : (
                                                                    <span className="text-[10px] text-slate-600 block mt-0.5">Sin teléfono</span>
                                                                )}
                                                            </td>

                                                            {/* Estado Territorial */}
                                                            <td className="px-5 py-4">
                                                                {a.access_status === 'approved' || !a.access_status ? (
                                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                                                        <CheckCircle2 size={11} /> Aprobado (1 de 5)
                                                                    </span>
                                                                ) : a.access_status === 'pending_activation' ? (
                                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                                                        <Clock size={11} /> Esperando Código
                                                                    </span>
                                                                ) : a.access_status === 'waitlist' ? (
                                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold bg-purple-500/15 text-purple-400 border border-purple-500/30">
                                                                        <Lock size={11} /> Lista de Espera
                                                                    </span>
                                                                ) : (
                                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                                                                        <XCircle size={11} /> {a.access_status}
                                                                    </span>
                                                                )}
                                                            </td>

                                                            {/* Código de Activación */}
                                                            <td className="px-5 py-4">
                                                                {a.acceptance_code ? (
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="font-mono text-xs font-black tracking-wider text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded-lg">
                                                                            {a.acceptance_code}
                                                                        </span>
                                                                        <button
                                                                            onClick={() => handleCopyCode(a.acceptance_code, a.id)}
                                                                            className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                                                                            title="Copiar código al portapapeles"
                                                                        >
                                                                            {copiedCodeId === a.id ? (
                                                                                <Check size={14} className="text-emerald-400" />
                                                                            ) : (
                                                                                <Copy size={14} />
                                                                            )}
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-[10px] text-slate-600 italic">Sin código</span>
                                                                )}
                                                            </td>

                                                            {/* Acciones del CEO */}
                                                            <td className="px-5 py-4 text-right">
                                                                <div className="flex items-center justify-end gap-1.5">
                                                                    {/* Aprobar Excepción */}
                                                                    {(a.access_status === 'waitlist' || a.access_status === 'pending_activation') && (
                                                                        <button
                                                                            disabled={isBusy}
                                                                            onClick={() => handleApproveException(a.id, a.name)}
                                                                            className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition-all flex items-center gap-1"
                                                                            title="Aprobar cupo y enviar notificación"
                                                                        >
                                                                            {isBusy ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                                                                            Aprobar Cupo
                                                                        </button>
                                                                    )}

                                                                    {/* Reenviar Email */}
                                                                    {a.acceptance_code && (
                                                                        <button
                                                                            disabled={isBusy}
                                                                            onClick={() => handleResendCode(a.id, a.email)}
                                                                            className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 transition-all flex items-center gap-1"
                                                                            title="Reenviar código al correo del restaurante"
                                                                        >
                                                                            <Send size={11} />
                                                                            Reenviar Mail
                                                                        </button>
                                                                    )}

                                                                    {/* Generar Nuevo Código */}
                                                                    <button
                                                                        disabled={isBusy}
                                                                        onClick={() => handleGenerateNewCode(a.id, a.name)}
                                                                        className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                                                                        title="Generar nuevo código aleatorio"
                                                                    >
                                                                        <RefreshCw size={13} />
                                                                    </button>

                                                                    {/* Liberar Cupo */}
                                                                    {a.access_status === 'approved' && (
                                                                        <button
                                                                            disabled={isBusy}
                                                                            onClick={() => handleReleaseSpot(a.id, a.name)}
                                                                            className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-all"
                                                                            title="Mover a lista de espera para liberar cupo"
                                                                        >
                                                                            Liberar Cupo
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                        </tbody>
                                    </table>
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
