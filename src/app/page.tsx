'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useNotifications } from '@/lib/store';
import { useRealtimeData } from '@/hooks/useRealtimeData';
import { useOfflineStore } from '@/lib/offlineStore';
import { UserRole, Profile } from '@/types/database';
import { Bell, ShoppingBag, ChefHat, Settings, LogOut, Wifi, WifiOff, X, AlertCircle, CheckCircle, Trash2 } from 'lucide-react';

// Components
import OrderTab from '@/components/OrderTab';
import KitchenTab from '@/components/KitchenTab';
import AdminTab from '@/components/AdminTab';

export default function App() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [activeTab, setActiveTab] = useState<'orders' | 'kitchen' | 'admin'>('orders');
  const [isOnline, setIsOnline] = useState(true);
  const [showNotificationOverlay, setShowNotificationOverlay] = useState(false);
  // State and Data
  const { categories, products, ingredients, orders, expenses, productIngredients, notifications } = useRealtimeData();
  const { clearAll, removeNotification, addNotification } = useNotifications();
  const { syncQueue } = useOfflineStore();

  // Notification Filtering
  const filteredNotifications = notifications.filter(n => {
    if (!profile) return false;

    // ADMIN: Ve todo SIEMPRE en su campana principal
    if (profile.role === 'admin') {
      return true;
    }

    // COCINA: Solo ve notificaciones para 'kitchen' (Nuevos pedidos)
    if (profile.role === 'kitchen') {
      return n.target_roles.includes('kitchen');
    }

    // STAFF (Ventas): Solo ve notificaciones para 'staff' (Pedidos listos y stock)
    if (profile.role === 'staff') {
      return n.target_roles.includes('staff');
    }

    return false;
  });

  // Stock Alert logic
  useEffect(() => {
    ingredients.forEach(ing => {
      if (ing.stock_level <= ing.min_stock_alert) {
        // Only add if not already notified (basic check by message)
        const msg = `STOCK BAJO: ${ing.name} (${ing.stock_level} ${ing.unit})`;
        if (!(notifications as any[]).some(n => n.message === msg)) {
          addNotification(msg, ['staff', 'admin'], 'alert');
        }
      }
    });
  }, [ingredients, notifications]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncQueue(); // Sincronizar automáticamente al recuperar internet
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Notification Sound logic
  const lastNotifCount = useRef(0);
  useEffect(() => {
    const playSound = () => {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
      audio.play().catch(e => console.log('Sound blocked by browser:', e));
    };

    if (filteredNotifications.length > lastNotifCount.current) {
      playSound();
    }
    lastNotifCount.current = filteredNotifications.length;
  }, [filteredNotifications.length]);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) setProfile(data);
  };

  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const adminPass = process.env.NEXT_PUBLIC_ADMIN_PASSWORD;
    const staffPass = process.env.NEXT_PUBLIC_STAFF_PASSWORD;
    const kitchenPass = "cocina2026";

    if (password === adminPass) {
      setProfile({ id: 'admin', full_name: 'Administrador', role: 'admin' });
      setActiveTab('admin');
      setError('');
    } else if (password === kitchenPass) {
      setProfile({ id: 'kitchen', full_name: 'Cocinero', role: 'kitchen' });
      setActiveTab('kitchen');
      setError('');
    } else if (password === staffPass) {
      setProfile({ id: 'staff', full_name: 'Vendedor', role: 'staff' });
      setActiveTab('orders');
      setError('');
    } else {
      setError('Clave incorrecta');
      setPassword('');
    }
  };

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-slate-950">
        <div className="glass p-10 rounded-[2.5rem] w-full max-w-md flex flex-col items-center space-y-8 shadow-2xl border border-white/5">
          <div className="bg-orange-500 p-5 rounded-3xl neon-glow text-5xl">🦁</div>
          <div className="text-center">
            <h1 className="text-4xl font-black italic text-orange-500">MyMapps</h1>
            <p className="text-slate-400 font-medium tracking-widest uppercase text-[10px] mt-2">Acceso al Sistema</p>
          </div>
          <form onSubmit={handleLogin} className="w-full space-y-4 pt-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-500 ml-2">Ingresa tu clave</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 text-white font-bold outline-none text-center tracking-widest"
                placeholder="****"
              />
            </div>
            {error && <p className="text-red-500 text-[10px] font-bold text-center uppercase tracking-wider">{error}</p>}
            <button type="submit" className="w-full py-5 bg-orange-600 text-white font-black rounded-2xl shadow-xl uppercase tracking-widest active:scale-95 transition-all">
              Entrar
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-32 pt-6 px-4 max-w-md mx-auto min-h-screen relative overflow-x-hidden">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">{profile.role} • {profile.full_name}</h2>
          <div className="flex items-center gap-2">
            <span className="text-xl">🦁</span>
            <h1 className="text-2xl font-black text-white italic">MyMapps</h1>
          </div>
        </div>
        <div className="flex gap-3 items-center">
          <button
            onClick={() => setShowNotificationOverlay(true)}
            className="relative text-slate-500 hover:text-white bg-slate-900/50 p-2 rounded-xl transition-all active:scale-90"
          >
            <Bell size={18} />
            {filteredNotifications.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center animate-bounce">
                {filteredNotifications.length}
              </span>
            )}
          </button>
          {isOnline ? <Wifi size={16} className="text-green-500" /> : <WifiOff size={16} className="text-red-500" />}
          <button onClick={() => setProfile(null)} className="text-slate-500 hover:text-white bg-slate-900/50 p-2 rounded-xl transition-all">
            <LogOut size={18} />
          </button>
        </div>
      </div>

      <main className="animate-in fade-in duration-500">
        {activeTab === 'orders' && <OrderTab products={products} ingredients={ingredients} categories={categories} />}
        {activeTab === 'kitchen' && <KitchenTab orders={orders} products={products} />}
        {activeTab === 'admin' && (
          <AdminTab
            products={products}
            categories={categories}
            ingredients={ingredients}
            orders={orders}
            expenses={expenses}
            productIngredients={productIngredients}
          />
        )}
      </main>

      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] glass rounded-[2.5rem] p-2 flex justify-between shadow-2xl z-50 border border-white/10">
        <button onClick={() => setActiveTab('orders')} className={`flex-1 flex flex-col items-center py-3 rounded-[2rem] transition-all ${activeTab === 'orders' ? 'bg-orange-500 text-white shadow-lg' : 'text-slate-500'}`}>
          <ShoppingBag size={20} /><span className="text-[9px] font-black uppercase">Pedidos</span>
        </button>
        <button onClick={() => setActiveTab('kitchen')} className={`flex-1 flex flex-col items-center py-3 rounded-[2rem] transition-all ${activeTab === 'kitchen' ? 'bg-orange-500 text-white shadow-lg' : 'text-slate-500'}`}>
          <ChefHat size={20} /><span className="text-[9px] font-black uppercase">Cocina</span>
        </button>
        {profile.role === 'admin' && (
          <button onClick={() => setActiveTab('admin')} className={`flex-1 flex flex-col items-center py-3 rounded-[2rem] transition-all ${activeTab === 'admin' ? 'bg-orange-500 text-white shadow-lg' : 'text-slate-500'}`}>
            <Settings size={20} /><span className="text-[9px] font-black uppercase">Admin</span>
          </button>
        )}
      </nav>

      {/* Notifications Overlay */}
      {showNotificationOverlay && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center px-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="glass w-full max-w-sm rounded-[2.5rem] p-6 space-y-4 shadow-2xl border border-white/10 flex flex-col max-h-[80vh]">
            <div className="flex justify-between items-center pb-2 border-b border-white/5">
              <h3 className="text-lg font-black uppercase italic text-orange-500">Notificaciones</h3>
              <button onClick={() => setShowNotificationOverlay(false)} className="text-slate-500 p-2"><X /></button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
              {filteredNotifications.length === 0 ? (
                <div className="py-12 text-center text-slate-600 font-bold uppercase text-[10px] tracking-widest">
                  No hay notificaciones
                </div>
              ) : (
                filteredNotifications.map(n => (
                  <div key={n.id} className={`p-4 rounded-3xl border relative group ${n.type === 'alert' ? 'bg-red-500/10 border-red-500/30' : n.type === 'success' ? 'bg-green-500/10 border-green-500/30' : 'bg-orange-500/10 border-orange-500/30'}`}>
                    <div className="flex gap-3">
                      {n.type === 'alert' && <AlertCircle className="text-red-500 flex-shrink-0" size={18} />}
                      {n.type === 'success' && <CheckCircle className="text-green-500 flex-shrink-0" size={18} />}
                      {n.type === 'info' && <Bell className="text-orange-500 flex-shrink-0" size={18} />}
                      <div className="pr-6">
                        <p className="text-xs font-bold text-white leading-tight mb-1">{n.message}</p>
                        <p className="text-[8px] font-black uppercase text-slate-500">{new Date(n.created_at).toLocaleTimeString()}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => removeNotification(n.id)}
                      className="absolute top-4 right-4 text-slate-600 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
            <button
              onClick={() => { clearAll(); setShowNotificationOverlay(false); }}
              className="w-full py-3 bg-slate-800 text-slate-400 text-[10px] font-black uppercase rounded-2xl hover:bg-slate-700"
            >
              Limpiar Todo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
