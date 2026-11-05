'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { DEFAULT_LANDING_CONFIG } from '@/lib/constants';
import { COUNTRIES, ARGENTINA_PROVINCES } from '@/lib/geoData';
import { 
  ChevronRight, LayoutGrid, MapPin, Store, Loader2, ArrowLeft, 
  Paintbrush, Shield, ShoppingBag, ChefHat, Check, UserPlus, LogIn, 
  Search, AlertCircle, Mail, Sun, Moon, Navigation, Phone, User, 
  Compass, Sparkles, Clock, Lock, CheckCircle2, MessageCircle
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const PRESET_COLORS = [
  { name: 'Naranja Sunset', primary: '#f97316', secondary: '#1e293b' },
  { name: 'Púrpura Neón', primary: '#a855f7', secondary: '#1e1b4b' },
  { name: 'Verde Esmeralda', primary: '#10b981', secondary: '#064e3b' },
  { name: 'Rojo Rubí', primary: '#ef4444', secondary: '#451a03' },
  { name: 'Azul Eléctrico', primary: '#3b82f6', secondary: '#172554' },
  { name: 'Oro Ámbar', primary: '#f59e0b', secondary: '#451a03' },
  { name: 'Rosa Fucsia', primary: '#ec4899', secondary: '#4d0727' },
];

export default function WelcomePage() {
  const router = useRouter();
  
  // App Modes: 'welcome' | 'select' | 'register' | 'verify_code' | 'waitlist_notice'
  const [mode, setMode] = useState<'welcome' | 'select' | 'register' | 'verify_code' | 'waitlist_notice'>('welcome');

  // List Tenants State
  const [tenants, setTenants] = useState<any[]>([]);
  const [recentTenants, setRecentTenants] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Register Tenant Form State
  const [name, setName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [email, setEmail] = useState('');
  const [slug, setSlug] = useState('');
  
  // Territorial Geolocation State
  const [country, setCountry] = useState('Argentina');
  const [province, setProvince] = useState('Buenos Aires');
  const [city, setCity] = useState('');
  const [zone, setZone] = useState('');
  const [detectedLat, setDetectedLat] = useState<number | null>(null);
  const [detectedLng, setDetectedLng] = useState<number | null>(null);
  const [gpsVerified, setGpsVerified] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);

  // Spot Availability Live State
  const [checkingSpots, setCheckingSpots] = useState(false);
  const [citySpotInfo, setCitySpotInfo] = useState<{
    occupiedSpots: number;
    maxSpots: number;
    hasAvailableSpots: boolean;
    remainingSpots: number;
  } | null>(null);

  // Customization & Auth State
  const [primaryColor, setPrimaryColor] = useState('#f97316');
  const [secondaryColor, setSecondaryColor] = useState('#1e293b');
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>('dark');
  const [adminPassword, setAdminPassword] = useState('');
  const [enabledRoles, setEnabledRoles] = useState<string[]>(['staff', 'kitchen', 'delivery', 'waiter', 'bartender', 'animador']);
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);

  // Verification & Post-Apply State
  const [registeredTenant, setRegisteredTenant] = useState<{
    id: string;
    slug: string;
    email: string;
    name: string;
    city: string;
  } | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [verifySuccess, setVerifySuccess] = useState(false);
  const [resendingCode, setResendingCode] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [waitlistInfo, setWaitlistInfo] = useState<{ position: number; city: string; name: string } | null>(null);

  // Cargar locales recientes
  useEffect(() => {
    if (mode === 'select') {
      try {
        const stored = localStorage.getItem('recent_tenants');
        if (stored) {
          setRecentTenants(JSON.parse(stored));
        }
      } catch (e) {
        console.error('Error parsing recent tenants', e);
      }
    }
  }, [mode]);

  // Consulta reactiva de cupos al cambiar de ciudad
  const checkCitySpots = useCallback(async (targetCity: string, targetCountry: string) => {
    if (!targetCity.trim() || targetCity.trim().length < 3) {
      setCitySpotInfo(null);
      return;
    }
    setCheckingSpots(true);
    try {
      const res = await fetch(`/api/access/check-spots?city=${encodeURIComponent(targetCity.trim())}&country=${encodeURIComponent(targetCountry)}`);
      if (res.ok) {
        const data = await res.json();
        setCitySpotInfo({
          occupiedSpots: data.occupiedSpots,
          maxSpots: data.maxSpots,
          hasAvailableSpots: data.hasAvailableSpots,
          remainingSpots: data.remainingSpots,
        });
      }
    } catch (e) {
      console.warn('Error verificando cupos:', e);
    } finally {
      setCheckingSpots(false);
    }
  }, []);

  // Debounce para chequear cupos de la ciudad
  useEffect(() => {
    const timer = setTimeout(() => {
      if (city) checkCitySpots(city, country);
    }, 450);
    return () => clearTimeout(timer);
  }, [city, country, checkCitySpots]);

  // Geocodificación GPS Antifraude
  const handleDetectGPS = () => {
    if (!navigator.geolocation) {
      alert('Tu dispositivo o navegador no soporta geolocalización.');
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setDetectedLat(lat);
        setDetectedLng(lng);
        setGpsVerified(true);

        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10`);
          if (res.ok) {
            const data = await res.json();
            const addr = data.address || {};
            const detectedCity = addr.city || addr.town || addr.municipality || addr.village || '';
            const detectedState = addr.state || '';
            if (detectedCity && !city) {
              setCity(detectedCity);
            }
            if (detectedState && country === 'Argentina') {
              const matchedProv = Object.keys(ARGENTINA_PROVINCES).find(
                p => p.toLowerCase().includes(detectedState.toLowerCase()) || detectedState.toLowerCase().includes(p.toLowerCase())
              );
              if (matchedProv) setProvince(matchedProv);
            }
          }
        } catch (e) {
          console.warn('Error en reverse geocoding:', e);
        } finally {
          setGpsLoading(false);
        }
      },
      (err) => {
        console.warn('GPS Error:', err);
        setGpsLoading(false);
        alert('No se pudo acceder a tu ubicación GPS. Asegúrate de otorgar los permisos de ubicación en tu navegador.');
      },
      { timeout: 9000, enableHighAccuracy: true }
    );
  };

  // Buscar local por nombre o correo
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setLoading(true);
    setError('');
    
    try {
      const trimmedQuery = searchQuery.trim();
      const { data, error: sbError } = await supabase
        .from('tenants')
        .select('id, name, slug, theme_colors, enabled_roles')
        .or(`name.ilike.%${trimmedQuery}%,slug.ilike.%${trimmedQuery}%,email.ilike.%${trimmedQuery}%`)
        .order('name', { ascending: true })
        .limit(5);

      if (sbError) {
        console.error('Error buscando locales:', sbError);
        setError('No se pudieron buscar los locales.');
      } else if (!data || data.length === 0) {
        setError('No se encontró ningún local con ese nombre o correo.');
        setTenants([]);
      } else {
        setTenants(data);
      }
    } catch (err) {
      console.error('Error general buscando locales:', err);
      setError('Error al conectar con la base de datos.');
    } finally {
      setLoading(false);
    }
  };

  // Generar slug automáticamente desde el nombre
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setName(newName);
    const generatedSlug = newName
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/^-+|-+$/g, '');
    setSlug(generatedSlug);
  };

  // Envío del Formulario de Registro / Postulación
  const handleRegister = async (e: React.FormEvent, forceWaitlist: boolean = false) => {
    e.preventDefault();
    setRegisterError('');
    
    if (!acceptTerms) {
      setRegisterError('Debes aceptar las Condiciones del Servicio y Políticas de Privacidad para continuar.');
      return;
    }

    if (!name.trim() || !slug.trim()) {
      setRegisterError('El nombre y el enlace web del local son obligatorios.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setRegisterError('Por favor, ingresa un correo electrónico válido para recibir tu código.');
      return;
    }
    if (!ownerName.trim()) {
      setRegisterError('Por favor, ingresa el nombre del titular o encargado del negocio.');
      return;
    }
    if (!contactPhone.trim() || contactPhone.trim().length < 8) {
      setRegisterError('Ingresa un número de WhatsApp / teléfono válido de al menos 8 dígitos.');
      return;
    }
    if (!city.trim()) {
      setRegisterError('La ciudad o localidad es obligatoria para verificar el cupo territorial.');
      return;
    }
    if (slug.length < 3) {
      setRegisterError('El enlace del local debe tener al menos 3 caracteres.');
      return;
    }
    if (!adminPassword || adminPassword.length < 4) {
      setRegisterError('Configura una contraseña de Administrador de al menos 4 caracteres.');
      return;
    }

    setRegistering(true);

    try {
      const response = await fetch('/api/access/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
          email: email.trim().toLowerCase(),
          ownerName: ownerName.trim(),
          contactPhone: contactPhone.trim(),
          country: country.trim(),
          province: province.trim(),
          city: city.trim(),
          zone: zone.trim(),
          adminPassword,
          primaryColor,
          secondaryColor,
          themeMode,
          enabledRoles,
          detectedLat,
          detectedLng,
          gpsVerified,
          wantsImmediateSpot: !forceWaitlist,
        }),
      });

      const resData = await response.json();

      if (!response.ok || resData.error) {
        setRegisterError(resData.error || 'Error al procesar la solicitud.');
        setRegistering(false);
        return;
      }

      if (resData.status === 'pending_activation') {
        // Asignado a cupo activo -> Ir a pantalla de código
        setRegisteredTenant({
          id: resData.tenantId,
          slug: resData.slug,
          email: resData.email,
          name: name.trim(),
          city: city.trim(),
        });
        setMode('verify_code');
      } else if (resData.status === 'waitlist') {
        // En lista de espera
        setWaitlistInfo({
          position: resData.waitlistPosition || 1,
          city: city.trim(),
          name: name.trim(),
        });
        setMode('waitlist_notice');
      }
    } catch (err: any) {
      setRegisterError('Error de conexión con el servidor. Intenta de nuevo.');
    } finally {
      setRegistering(false);
    }
  };

  // Verificación del Código de Activación
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationCode.trim()) {
      setVerifyError('Ingresa el código que te enviamos al correo.');
      return;
    }

    setVerifyingCode(true);
    setVerifyError('');

    try {
      const res = await fetch('/api/access/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: registeredTenant?.id,
          email: registeredTenant?.email,
          code: verificationCode.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setVerifyError(data.error || 'Código incorrecto. Verifica tu correo.');
        setVerifyingCode(false);
        return;
      }

      setVerifySuccess(true);
      setTimeout(() => {
        router.push(`/${data.slug || registeredTenant?.slug}`);
      }, 1400);

    } catch (e: any) {
      setVerifyError('Error al conectar con el servidor.');
    } finally {
      setVerifyingCode(false);
    }
  };

  // Reenviar Código por Email
  const handleResendCode = async () => {
    if (!registeredTenant?.id) return;
    setResendingCode(true);
    setResendMessage('');
    setVerifyError('');

    try {
      const res = await fetch('/api/access/admin-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'resend_code',
          tenantId: registeredTenant.id,
          adminEmail: 'ceo@mymapps.com',
          adminPass: 'master2026',
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setResendMessage(`✅ Código reenviado con éxito a ${registeredTenant.email}. Revisa también Spam.`);
      } else {
        setVerifyError(data.error || 'No se pudo reenviar el código.');
      }
    } catch (e) {
      setVerifyError('Fallo al contactar el servidor para el reenvío.');
    } finally {
      setResendingCode(false);
    }
  };

  const recordRecentTenant = (t: any) => {
    try {
      const stored = localStorage.getItem('recent_tenants');
      let recents = stored ? JSON.parse(stored) : [];
      recents = recents.filter((r: any) => r.id !== t.id);
      recents.unshift({ id: t.id, name: t.name, slug: t.slug, theme_colors: t.theme_colors });
      if (recents.length > 3) recents = recents.slice(0, 3);
      localStorage.setItem('recent_tenants', JSON.stringify(recents));
    } catch (e) {}
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 sm:p-6 bg-slate-950 text-white selection:bg-orange-500/30 relative overflow-hidden">
      {/* Fondo de Gradiente Premium */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-orange-500/10 via-slate-950 to-slate-950 pointer-events-none" />

      {/* PANTALLA 1: BIENVENIDA / PREGUNTA INICIAL */}
      {mode === 'welcome' && (
        <div className="glass p-8 sm:p-10 rounded-[2.5rem] w-full max-w-md flex flex-col items-center space-y-8 shadow-2xl border border-white/5 relative z-10 animate-in fade-in zoom-in duration-300">
          
          {/* Isotipo */}
          <div className="hover:scale-105 transition-transform duration-300 w-28 h-28 sm:w-32 sm:h-32 flex items-center justify-center">
            <img src="/logo.png" alt="Mmm TodoLoQueQuiero Comer" className="w-full h-full object-cover rounded-full drop-shadow-[0_0_20px_rgba(249,115,22,0.3)]" />
          </div>

          {/* Títulos */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl sm:text-4xl font-black italic text-orange-500 leading-none">mmmTodoLoQueQuiero</h1>
            <p className="text-slate-400 font-bold tracking-[0.2em] uppercase text-[9px]">
              Plataforma SaaS Multi-Tenant
            </p>
          </div>

          <div className="text-center space-y-2">
            <h2 className="text-lg sm:text-xl font-black text-white">¿Cómo deseas ingresar?</h2>
            <p className="text-slate-400 text-xs px-2 leading-relaxed">
              Inicia sesión en un negocio registrado o postula tu local para verificar disponibilidad de cupos territoriales exclusivos.
            </p>
          </div>

          {/* Banner de Exclusividad Territorial */}
          <div className="w-full bg-gradient-to-r from-orange-500/15 via-amber-500/10 to-transparent border border-orange-500/30 rounded-2xl p-3.5 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center shrink-0">
              <Sparkles size={16} />
            </div>
            <div className="text-left">
              <p className="text-[10px] font-black uppercase text-orange-400 tracking-wider">Exclusividad Territorial</p>
              <p className="text-[9px] text-slate-300 font-medium leading-tight">Máximo 5 restaurantes por ciudad para garantizar tu ventaja comercial.</p>
            </div>
          </div>

          {/* Botones de Selección */}
          <div className="w-full flex flex-col gap-3.5">
            <button
              onClick={() => setMode('select')}
              className="w-full py-4.5 bg-orange-500 hover:bg-orange-600 text-white font-black rounded-2xl shadow-xl shadow-orange-500/10 uppercase tracking-widest active:scale-95 transition-all text-xs flex items-center justify-center gap-2 group"
            >
              <LogIn size={15} className="group-hover:translate-x-0.5 transition-transform" />
              Ingresar a mi Local
            </button>

            <button
              onClick={() => setMode('register')}
              className="w-full py-4.5 bg-slate-900 border border-slate-800 hover:border-orange-500/40 text-white font-black rounded-2xl shadow-xl uppercase tracking-widest active:scale-95 transition-all text-xs flex items-center justify-center gap-2 group"
            >
              <UserPlus size={15} className="text-orange-500 group-hover:scale-110 transition-transform" />
              Postular mi Local (Cupos Limitados)
            </button>

            <Link href="/franchise" className="w-full mt-1">
              <button
                type="button"
                className="w-full py-3.5 bg-slate-950 border border-slate-800/50 hover:border-white/10 text-slate-400 hover:text-white font-black rounded-2xl shadow-lg uppercase tracking-widest active:scale-95 transition-all text-[10px] flex items-center justify-center gap-2 group"
              >
                <Store size={14} className="text-slate-500 group-hover:text-orange-500 transition-colors" />
                Acceso Franquicias
              </button>
            </Link>
          </div>
        </div>
      )}

      {/* PANTALLA 2: SELECCIÓN DE LOCALES ACTIVOS */}
      {mode === 'select' && (
        <div className="glass p-8 sm:p-10 rounded-[2.5rem] w-full max-w-md flex flex-col items-center space-y-6 shadow-2xl border border-white/5 relative z-10 animate-in fade-in slide-in-from-right-8 duration-300">
          
          <div className="w-full flex justify-between items-center pb-2 border-b border-white/5">
            <button onClick={() => setMode('welcome')} className="text-slate-400 hover:text-white p-2 bg-slate-900/50 rounded-xl transition-colors">
              <ArrowLeft size={16} />
            </button>
            <h1 className="text-xl font-black italic text-orange-500">Mis Locales</h1>
            <div className="w-9" />
          </div>

          <div className="w-full space-y-4">
            <p className="text-xs text-slate-400 text-center leading-relaxed">
              Busca tu local por nombre o correo para acceder a las pantallas de pedidos, cocina y administración.
            </p>

            <form onSubmit={handleSearch} className="relative w-full flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-3.5 text-slate-500" size={16} />
                <input
                  type="text"
                  placeholder="Correo o Nombre exacto..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-900/50 border border-slate-800 focus:border-orange-500/30 rounded-2xl p-3.5 pl-11 text-white text-xs outline-none transition-colors"
                />
              </div>
              <button 
                type="submit" 
                className="bg-orange-500 hover:bg-orange-600 text-white p-3.5 rounded-2xl font-bold transition-colors"
                disabled={loading}
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              </button>
            </form>

            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-center">
                <p className="text-red-500 text-[10px] font-bold uppercase tracking-wide">{error}</p>
              </div>
            )}

            {/* Resultados de Búsqueda */}
            {tenants.length > 0 && (
              <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase text-slate-500 tracking-wider text-center mt-4">Resultados</p>
                {tenants.map((t) => {
                  const accentColor = t.theme_colors?.primary || '#f97316';
                  return (
                    <Link
                      key={t.id}
                      href={`/${t.slug}`}
                      onClick={() => recordRecentTenant(t)}
                      className="w-full bg-slate-900/30 hover:bg-slate-900/80 border border-white/5 hover:border-white/10 p-4 rounded-3xl transition-all duration-300 flex items-center justify-between group cursor-pointer hover:scale-[1.02] active:scale-98"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className="w-9 h-9 rounded-2xl flex items-center justify-center text-lg animate-pulse"
                          style={{ backgroundColor: `${accentColor}15`, color: accentColor }}
                        >
                          <Store size={16} />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-black text-white group-hover:text-orange-500 transition-colors">{t.name}</p>
                          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1 mt-0.5">
                            <MapPin size={9} style={{ color: accentColor }} /> /{t.slug}
                          </p>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-slate-600 group-hover:text-white group-hover:translate-x-1 transition-all" />
                    </Link>
                  );
                })}
              </div>
            )}

            {/* Locales Recientes */}
            {!loading && tenants.length === 0 && recentTenants.length > 0 && (
              <div className="space-y-3 mt-4 pt-4 border-t border-white/5">
                <p className="text-[10px] font-bold uppercase text-slate-500 tracking-wider text-center flex items-center justify-center gap-2">
                  <MapPin size={10} /> Locales Recientes
                </p>
                {recentTenants.map((t) => {
                  const accentColor = t.theme_colors?.primary || '#f97316';
                  return (
                    <Link
                      key={t.id}
                      href={`/${t.slug}`}
                      onClick={() => recordRecentTenant(t)}
                      className="w-full bg-slate-900/30 hover:bg-slate-900/80 border border-white/5 hover:border-white/10 p-4 rounded-3xl transition-all duration-300 flex items-center justify-between group cursor-pointer hover:scale-[1.02] active:scale-98"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className="w-9 h-9 rounded-2xl flex items-center justify-center text-lg"
                          style={{ backgroundColor: `${accentColor}15`, color: accentColor }}
                        >
                          <Store size={16} />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-black text-white group-hover:text-orange-500 transition-colors">{t.name}</p>
                          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1 mt-0.5">
                            <MapPin size={9} style={{ color: accentColor }} /> /{t.slug}
                          </p>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-slate-600 group-hover:text-white group-hover:translate-x-1 transition-all" />
                    </Link>
                  );
                })}
              </div>
            )}

            {/* Empty State */}
            {!loading && tenants.length === 0 && recentTenants.length === 0 && !error && (
              <div className="p-8 bg-slate-900/50 border border-slate-800 rounded-3xl text-center space-y-2 mt-4">
                <Store size={24} className="text-slate-600 mx-auto" />
                <p className="text-slate-500 text-xs font-bold uppercase tracking-wide">Busca tu local</p>
                <p className="text-[10px] text-slate-600">Ingresa tu correo para encontrarlo</p>
                <button
                  onClick={() => setMode('register')}
                  className="mt-2 text-xs font-bold text-orange-500 hover:underline block mx-auto"
                >
                  ¿No tienes uno? Postula tu local
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PANTALLA 3: FORMULARIO DE REGISTRO CON ESCASÉZ Y EXCLUSIVIDAD (MÁXIMO 5 POR CIUDAD) */}
      {mode === 'register' && (
        <div className="glass p-6 sm:p-8 rounded-[2.5rem] w-full max-w-4xl flex flex-col md:flex-row gap-8 shadow-2xl border border-white/5 relative z-10 animate-in fade-in slide-in-from-right-8 duration-300">
          
          {/* Columna Izquierda: Formulario */}
          <div className="flex-1 flex flex-col space-y-5">
            <div className="w-full flex justify-between items-center pb-2 border-b border-white/5">
              <button type="button" onClick={() => setMode('welcome')} className="text-slate-400 hover:text-white p-2 bg-slate-900/50 rounded-xl transition-colors">
                <ArrowLeft size={16} />
              </button>
              <div className="text-center">
                <h1 className="text-xl font-black italic text-orange-500">Postulación de Local</h1>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Exclusividad Territorial (Máx 5 por Ciudad)</p>
              </div>
              <div className="w-9" />
            </div>

            {/* BANNER DE IMPACTO: FILOSOFÍA DE ESCASÉZ Y VENTAJA COMPETITIVA (HORMOZI) */}
            <div className="bg-gradient-to-br from-amber-500/15 via-slate-900/80 to-slate-950 p-4.5 rounded-3xl border border-amber-500/30 space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                  <Lock size={13} />
                </div>
                <h3 className="text-xs font-black uppercase text-amber-400 tracking-wider">
                  ¿Por qué limitamos el sistema a 5 locales por ciudad?
                </h3>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Si todos los negocios gastronómicos de tu zona cuentan con la misma plataforma, <strong>la ventaja competitiva no la tiene nadie</strong>. Para garantizar que tu negocio duplique su rentabilidad y mantenga la exclusividad en tus mesas y delivery, solo otorgamos <strong>5 plazas por localidad</strong>.
              </p>
            </div>

            <form onSubmit={(e) => handleRegister(e, false)} className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
              
              {/* Bloque 1: Ubicación Territorial y Geolocalización GPS Antifraude */}
              <div className="space-y-3 bg-slate-900/40 p-5 rounded-3xl border border-white/5">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1.5">
                    <MapPin size={13} className="text-orange-500" /> 1. Ubicación Territorial del Local
                  </p>
                  
                  {/* Botón GPS Antifraude */}
                  <button
                    type="button"
                    onClick={handleDetectGPS}
                    disabled={gpsLoading}
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                      gpsVerified 
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                        : 'bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 border border-orange-500/20'
                    }`}
                  >
                    {gpsLoading ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : gpsVerified ? (
                      <CheckCircle2 size={12} />
                    ) : (
                      <Compass size={12} />
                    )}
                    {gpsVerified ? 'GPS Verificado ✅' : 'Verificar GPS Antifraude'}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* País */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase text-slate-500 ml-1">País</label>
                    <select
                      value={country}
                      onChange={(e) => {
                        setCountry(e.target.value);
                        setCitySpotInfo(null);
                      }}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-white/20 rounded-xl p-3 text-white text-xs outline-none font-medium cursor-pointer"
                    >
                      {COUNTRIES.map((c) => (
                        <option key={c.code} value={c.name} className="bg-slate-900 text-white">
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Provincia / Estado */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase text-slate-500 ml-1">Provincia / Estado</label>
                    {country === 'Argentina' ? (
                      <select
                        value={province}
                        onChange={(e) => {
                          setProvince(e.target.value);
                          setCitySpotInfo(null);
                        }}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-white/20 rounded-xl p-3 text-white text-xs outline-none font-medium cursor-pointer"
                      >
                        {Object.keys(ARGENTINA_PROVINCES).map((prov) => (
                          <option key={prov} value={prov} className="bg-slate-900 text-white">
                            {prov}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        required
                        placeholder="Ej: Montevideo / Santiago"
                        value={province}
                        onChange={(e) => setProvince(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-white/20 rounded-xl p-3 text-white text-xs outline-none font-medium"
                      />
                    )}
                  </div>
                </div>

                {/* Ciudad y Barrio */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase text-slate-500 ml-1">Ciudad / Localidad (Obligatorio)</label>
                    <input
                      type="text"
                      required
                      list="city-suggestions"
                      placeholder="Ej: Rosario / Córdoba"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-orange-500/50 rounded-xl p-3 text-white text-xs outline-none font-bold"
                    />
                    {country === 'Argentina' && ARGENTINA_PROVINCES[province] && (
                      <datalist id="city-suggestions">
                        {ARGENTINA_PROVINCES[province].map((c) => (
                          <option key={c} value={c} />
                        ))}
                      </datalist>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase text-slate-500 ml-1">Barrio / Zona (Opcional)</label>
                    <input
                      type="text"
                      placeholder="Ej: Centro / Pichincha"
                      value={zone}
                      onChange={(e) => setZone(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-white/20 rounded-xl p-3 text-white text-xs outline-none font-medium"
                    />
                  </div>
                </div>

                {/* BADGE REACTIVO DE DISPONIBILIDAD DE CUPOS EN LA CIUDAD */}
                {checkingSpots && (
                  <div className="flex items-center gap-2 p-2.5 bg-slate-950/60 rounded-xl text-[10px] text-slate-400">
                    <Loader2 size={12} className="animate-spin text-orange-500" />
                    <span>Verificando disponibilidad de cupos en {city}...</span>
                  </div>
                )}

                {!checkingSpots && citySpotInfo && (
                  <div className={`p-3 rounded-2xl border flex items-center justify-between transition-all ${
                    citySpotInfo.hasAvailableSpots 
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                  }`}>
                    <div className="flex items-center gap-2.5">
                      {citySpotInfo.hasAvailableSpots ? <Sparkles size={16} /> : <Lock size={16} />}
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-wider">
                          {citySpotInfo.hasAvailableSpots ? '¡Plaza Territorial Disponible!' : 'Cupos Completos para tu Ciudad'}
                        </p>
                        <p className="text-[9px] opacity-80">
                          {citySpotInfo.hasAvailableSpots 
                            ? `Ocupación actual en ${city}: ${citySpotInfo.occupiedSpots}/5 locales. Quedan ${citySpotInfo.remainingSpots} plazas.`
                            : `Actualmente los 5 cupos de ${city} están tomados. Podrás postularte a la lista de espera.`}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-black px-2.5 py-1 rounded-lg bg-black/40 border border-current/20">
                      {citySpotInfo.occupiedSpots}/5
                    </span>
                  </div>
                )}
              </div>

              {/* Bloque 2: Datos de Identidad del Local y Dueño */}
              <div className="space-y-3 bg-slate-900/40 p-5 rounded-3xl border border-white/5">
                <p className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1.5">
                  <Store size={13} className="text-orange-500" /> 2. Identidad del Negocio y Titular
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase text-slate-500 ml-1">Nombre del Local</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: Pizzería Don Mario"
                      value={name}
                      onChange={handleNameChange}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-white/20 rounded-xl p-3 text-white text-xs outline-none font-medium"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase text-slate-500 ml-1 flex items-center gap-1">
                      <User size={11} className="text-orange-500" /> Nombre del Titular / Encargado
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: Mario Gómez"
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-white/20 rounded-xl p-3 text-white text-xs outline-none font-medium"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase text-slate-500 ml-1 flex items-center gap-1">
                      <Mail size={11} className="text-orange-500" /> Correo Electrónico (Para recibir el Código)
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="Ej: gerencia@donmario.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-white/20 rounded-xl p-3 text-white text-xs outline-none font-medium"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase text-slate-500 ml-1 flex items-center gap-1">
                      <Phone size={11} className="text-orange-500" /> Teléfono / WhatsApp de Contacto
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="Ej: 3415998877 o 1145678901"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-white/20 rounded-xl p-3 text-white text-xs outline-none font-medium"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase text-slate-500 ml-1">Dirección de Enlace Web (URL Slug)</label>
                  <div className="flex items-center bg-slate-950 border border-slate-800 focus-within:border-white/20 rounded-xl px-3 py-1">
                    <span className="text-[10px] text-slate-600 font-bold tracking-tight select-none">mmmtodoloquequierocomer.com.ar/</span>
                    <input
                      type="text"
                      required
                      placeholder="don-mario"
                      value={slug}
                      onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                      className="w-full bg-transparent p-2 text-white text-xs outline-none font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Bloque 3: Clave Principal */}
              <div className="space-y-3 bg-slate-900/40 p-5 rounded-3xl border border-white/5">
                <p className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1.5">
                  <Shield size={13} className="text-orange-500" /> 3. Contraseña Maestra (Administrador)
                </p>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase text-slate-500 ml-1">Clave de Acceso</label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-orange-500/50 rounded-xl p-3 text-white text-xs outline-none font-bold"
                  />
                </div>
              </div>

              {/* Bloque 4: Personalización Rápida de Colores */}
              <div className="space-y-3 bg-slate-900/40 p-5 rounded-3xl border border-white/5">
                <p className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1.5">
                  <Paintbrush size={13} className="text-orange-500" /> 4. Color y Tema de Marca
                </p>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map(c => (
                    <button
                      key={c.primary}
                      type="button"
                      onClick={() => { setPrimaryColor(c.primary); setSecondaryColor(c.secondary); }}
                      className="w-7 h-7 rounded-full border border-white/10 flex items-center justify-center transition-all duration-300 hover:scale-110 shadow-md"
                      style={{ backgroundColor: c.primary }}
                      title={c.name}
                    >
                      {primaryColor === c.primary && <Check size={11} className="text-white drop-shadow" />}
                    </button>
                  ))}
                </div>
              </div>

              {registerError && (
                <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl">
                  <AlertCircle size={16} className="text-red-500 shrink-0" />
                  <p className="text-red-500 text-[10px] font-bold uppercase tracking-wide leading-tight">{registerError}</p>
                </div>
              )}

              {/* Checkbox de Términos */}
              <div className="flex items-start gap-3 p-1">
                <input
                  type="checkbox"
                  id="terms"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded bg-slate-900 border-slate-700 accent-orange-500 cursor-pointer"
                />
                <label htmlFor="terms" className="text-xs text-slate-400 leading-relaxed cursor-pointer">
                  He leído y acepto las{' '}
                  <Link href="/terminos" target="_blank" className="text-orange-500 hover:underline font-bold">
                    Condiciones del Servicio
                  </Link>{' '}
                  y la{' '}
                  <Link href="/privacidad" target="_blank" className="text-orange-500 hover:underline font-bold">
                    Política de Exclusividad Territorial
                  </Link>.
                </label>
              </div>

              {/* BOTONES DE DECISIÓN: RECLAMAR PLAZA INMEDIATA VS QUEDAR EN LISTA DE ESPERA */}
              <div className="space-y-2 pt-2">
                <button
                  type="submit"
                  disabled={registering}
                  className="w-full py-4.5 text-white font-black rounded-2xl shadow-xl uppercase tracking-widest active:scale-95 transition-all text-xs flex items-center justify-center gap-2"
                  style={{ backgroundColor: primaryColor }}
                >
                  {registering ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <>
                      <Sparkles size={14} />
                      Reclamar Plaza Inmediata y Recibir Código por Email
                    </>
                  )}
                </button>

                <button
                  type="button"
                  disabled={registering}
                  onClick={(e) => handleRegister(e as any, true)}
                  className="w-full py-3 bg-slate-950 hover:bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800 rounded-2xl text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5"
                >
                  <Clock size={12} />
                  Ceder Plaza Inmediata y Postularme a Lista de Espera
                </button>
              </div>
            </form>
          </div>

          {/* Columna Derecha: Vista Previa en Vivo */}
          <div className="hidden md:flex flex-col w-[320px] bg-slate-900/20 p-6 rounded-[2rem] border border-white/5 items-center justify-center relative self-stretch">
            <div className="absolute top-4 left-6">
              <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider">Simulación en Vivo</span>
            </div>
            
            <div
              className={`w-[250px] h-[460px] rounded-[2.5rem] p-5 shadow-2xl flex flex-col justify-between border relative overflow-hidden transition-all duration-500 ${
                themeMode === 'light' ? 'bg-slate-50 text-slate-900 border-slate-200' : 'bg-slate-950 text-white border-white/5'
              }`}
            >
              <div
                className="absolute -top-20 -left-20 w-44 h-44 rounded-full opacity-10 pointer-events-none blur-3xl"
                style={{ backgroundColor: primaryColor }}
              />

              <div className="flex justify-between items-center z-10">
                <div>
                  <h3 className="text-[7px] font-black uppercase tracking-[0.2em]" style={{ color: primaryColor }}>
                    {name.trim() || 'Tu Restaurante'} • Salón
                  </h3>
                  <div className="flex items-center gap-1">
                    <img src="/logo.png" alt="Logo" className="w-3.5 h-3.5 object-contain" />
                    <h1 className="text-xs font-black italic">mmmTodoLoQueQuiero</h1>
                  </div>
                </div>
                <div className="flex gap-1 items-center">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: primaryColor }} />
                  <span className="text-[6px] font-bold opacity-40">EXCLUSIVO</span>
                </div>
              </div>

              <div className="my-auto flex flex-col items-center space-y-3 z-10 text-center">
                <div className="w-14 h-14 flex items-center justify-center transition-transform animate-bounce">
                  <img src="/logo.png" alt="Logo" className="w-full h-full object-cover rounded-full drop-shadow-md" />
                </div>
                <div>
                  <h2 className="text-sm font-black italic leading-tight">{name.trim() || 'Mi Local'}</h2>
                  <p className="text-[7px] tracking-widest uppercase opacity-50 mt-0.5">
                    {city ? `📍 ${city}` : '/enlace-web'}
                  </p>
                </div>
                <div className="w-full space-y-1.5">
                  <div className="w-full h-7 rounded-xl border opacity-50 flex items-center justify-center text-[7px] font-mono">
                    ••••••
                  </div>
                  <div className="w-full h-7 rounded-xl text-[7px] font-black uppercase flex items-center justify-center shadow-md" style={{ backgroundColor: primaryColor, color: '#fff' }}>
                    Entrar al Sistema
                  </div>
                </div>
              </div>

              <div className="w-full rounded-2xl p-1 flex justify-between border z-10" style={{ borderColor: 'rgba(255,255,255,0.05)', backgroundColor: 'rgba(15,23,42,0.5)' }}>
                <div className="flex-1 py-1 flex flex-col items-center gap-0.5 rounded-xl" style={{ backgroundColor: primaryColor, color: '#fff' }}>
                  <ShoppingBag size={9} />
                  <span className="text-[6px] font-black uppercase">Caja</span>
                </div>
                <div className="flex-1 py-1 flex flex-col items-center gap-0.5 opacity-40">
                  <ChefHat size={9} />
                  <span className="text-[6px] font-black uppercase">Cocina</span>
                </div>
                <div className="flex-1 py-1 flex flex-col items-center gap-0.5 opacity-40">
                  <Shield size={9} />
                  <span className="text-[6px] font-black uppercase">Admin</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PANTALLA 4: INTRODUCIR CÓDIGO DE ACTIVACIÓN RECIBIDO POR CORREO */}
      {mode === 'verify_code' && (
        <div className="glass p-8 sm:p-10 rounded-[2.5rem] w-full max-w-md flex flex-col items-center space-y-6 shadow-2xl border border-white/5 relative z-10 animate-in fade-in zoom-in duration-300">
          
          {/* Badge Dorado de Plaza Asignada */}
          <div className="bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-amber-500/20 border border-amber-500/40 px-4 py-1.5 rounded-full flex items-center gap-2">
            <Sparkles size={14} className="text-amber-400" />
            <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider">
              Plaza Reservada • {registeredTenant?.city || city}
            </span>
          </div>

          <div className="text-center space-y-2">
            <h2 className="text-2xl font-black text-white italic">Introduce tu Código de Activación</h2>
            <p className="text-slate-400 text-xs leading-relaxed px-2">
              Enviamos un código exclusivo de 6 caracteres a <strong className="text-white">{registeredTenant?.email}</strong>.
            </p>
            <p className="text-[11px] text-amber-400/90 font-medium bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20">
              💡 Revisa tu bandeja de entrada y la carpeta de <strong>Correo no deseado (Spam)</strong>.
            </p>
          </div>

          {verifySuccess ? (
            <div className="w-full py-8 flex flex-col items-center justify-center space-y-3 animate-in zoom-in duration-300">
              <div className="w-16 h-16 bg-emerald-500/20 border border-emerald-500/40 rounded-full flex items-center justify-center text-emerald-400 text-3xl shadow-lg shadow-emerald-500/20">
                ✓
              </div>
              <h3 className="text-xl font-black text-emerald-400 italic">¡Local Activado!</h3>
              <p className="text-slate-400 text-xs text-center">
                Tu cupo territorial ha sido confirmado. Redirigiendo a tu local...
              </p>
              <Loader2 size={22} className="text-emerald-400 animate-spin mt-2" />
            </div>
          ) : (
            <form onSubmit={handleVerifyCode} className="w-full space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block text-center">
                  Código de 6 Caracteres
                </label>
                <input
                  type="text"
                  maxLength={6}
                  required
                  placeholder="Ej: A7X92K"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                  className="w-full bg-slate-900 border-2 border-orange-500/40 focus:border-orange-500 rounded-2xl py-4 text-center text-2xl sm:text-3xl font-mono font-black text-orange-400 tracking-[0.3em] uppercase outline-none shadow-inner transition-colors"
                />
              </div>

              {verifyError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-center">
                  <p className="text-red-400 text-[10px] font-bold uppercase">{verifyError}</p>
                </div>
              )}

              {resendMessage && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-center">
                  <p className="text-emerald-400 text-[10px] font-bold">{resendMessage}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={verifyingCode || verificationCode.length < 6}
                className="w-full py-4.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-black rounded-2xl shadow-xl shadow-orange-500/20 uppercase tracking-widest active:scale-95 transition-all text-xs flex items-center justify-center gap-2"
              >
                {verifyingCode ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                Validar Código y Entrar a mi Local 🚀
              </button>

              <div className="pt-2 border-t border-white/5 flex flex-col items-center gap-2">
                <button
                  type="button"
                  disabled={resendingCode}
                  onClick={handleResendCode}
                  className="text-xs text-slate-400 hover:text-orange-400 transition-colors flex items-center gap-1 font-bold"
                >
                  {resendingCode ? <Loader2 size={13} className="animate-spin" /> : <Mail size={13} />}
                  ¿No recibiste el correo? Reenviar código
                </button>

                <button
                  type="button"
                  onClick={() => setMode('welcome')}
                  className="text-[10px] text-slate-500 hover:text-white uppercase font-bold tracking-wider"
                >
                  Volver al Inicio
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* PANTALLA 5: LISTA DE ESPERA EXCLUSIVA (CUPOS AGOTADOS EN LA CIUDAD) */}
      {mode === 'waitlist_notice' && (
        <div className="glass p-8 sm:p-10 rounded-[2.5rem] w-full max-w-md flex flex-col items-center space-y-6 shadow-2xl border border-white/5 relative z-10 animate-in fade-in zoom-in duration-300">
          
          {/* Badge de Cupos Cubiertos */}
          <div className="bg-rose-500/20 border border-rose-500/40 px-4 py-1.5 rounded-full flex items-center gap-2">
            <Lock size={14} className="text-rose-400" />
            <span className="text-[10px] font-black uppercase text-rose-400 tracking-wider">
              Cupos Completos • {waitlistInfo?.city || city}
            </span>
          </div>

          <div className="text-center space-y-2">
            <h2 className="text-2xl font-black text-white italic">Plazas Agotadas para tu Ciudad</h2>
            <p className="text-slate-400 text-xs leading-relaxed">
              Para garantizar que los 5 restaurantes activos en <strong className="text-white">{waitlistInfo?.city || city}</strong> mantengan su ventaja competitiva exclusiva, las plazas están actualmente cubiertas.
            </p>
          </div>

          {/* Tarjeta de Lista de Espera */}
          <div className="w-full bg-slate-900/60 border border-white/10 rounded-2xl p-5 text-center space-y-3">
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
              Tu Puesto en Lista de Espera Prioritaria
            </p>
            <div className="text-4xl font-black text-orange-400 font-mono">
              #{waitlistInfo?.position || 1}
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Tu postulación para <strong className="text-white">{waitlistInfo?.name || name}</strong> quedó guardada con prioridad. Si un local de tu ciudad no renueva su servicio o se aprueba una vacante especial, te contactaremos de inmediato.
            </p>
          </div>

          {/* Botón WhatsApp directo con el Administrador / CEO */}
          <a
            href={`https://wa.me/5493415998877?text=${encodeURIComponent(
              `Hola! Me registré para el local "${waitlistInfo?.name || name}" en "${waitlistInfo?.city || city}" y quedé en el puesto #${waitlistInfo?.position || 1} de la lista de espera. Quisiera consultar si existe la posibilidad de habilitar una excepción territorial.`
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl shadow-xl uppercase tracking-widest active:scale-95 transition-all text-xs flex items-center justify-center gap-2"
          >
            <MessageCircle size={16} />
            Consultar Excepción por WhatsApp 💬
          </a>

          <button
            type="button"
            onClick={() => setMode('welcome')}
            className="text-xs text-slate-400 hover:text-white uppercase font-bold tracking-wider"
          >
            Volver a la Página Principal
          </button>
        </div>
      )}

      {/* Footer Global Corporativo */}
      <div className="mt-8 pb-4 z-10 flex flex-col items-center space-y-3 animate-in fade-in duration-700">
        <a 
          href="https://www.mmmtodoloquequiero.com.ar" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="hover:scale-105 active:scale-95 transition-all duration-300 flex flex-col items-center gap-1.5 group"
        >
          <img 
            src="/logo_mym_saas.jpg" 
            alt="MmM Todo Lo Que Quiero" 
            className="w-14 h-14 object-contain rounded-2xl border border-white/10 shadow-lg shadow-black/40 group-hover:border-orange-500/50 transition-colors bg-black" 
          />
          <span className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] group-hover:text-orange-500 transition-colors">
            Conoce nuestras Apps
          </span>
        </a>
        <p className="text-[8px] font-black uppercase text-slate-600 tracking-widest">
          © 2026 mmmTodoLoQueQuiero Inc. Todos los derechos reservados
        </p>
      </div>
    </div>
  );
}
