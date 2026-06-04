'use client';

import React, { useState, useEffect, use } from 'react';
import { supabase, supabaseAnon, setSupabaseTenant } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';
import PublicMenu from '@/components/PublicMenu';
import { MaxesLogo, MaxesWatermark } from '@/components/MaxesLogo';
import { Lock } from 'lucide-react';

interface MenuPageProps {
  params: Promise<{ tenant_slug: string }>;
}

export default function MenuPage({ params }: MenuPageProps) {
  const { tenant_slug } = use(params);
  const [tenant, setTenant] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchTenant() {
      try {
        const { data, error } = await supabaseAnon
          .from('tenants')
          .select('*, description')
          .ilike('slug', tenant_slug)
          .maybeSingle();

        if (error || !data) {
          setError(`Local no encontrado (Detalle: ${error?.message || 'No existe en la base de datos'})`);
          return;
        }

        // ¡Súper importante! Esto le dice a Supabase que actúe en nombre de este tenant para RLS
        setSupabaseTenant(data.id);
        setTenant(data);
      } catch (err) {
        setError('Error al cargar el local');
      } finally {
        setLoading(false);
      }
    }

    fetchTenant();
  }, [tenant_slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <Loader2 className="w-10 h-10 text-white animate-spin" />
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-black p-6 text-center">
        <h1 className="text-2xl font-bold text-white mb-2">Ups...</h1>
        <p className="text-gray-400">{error || 'No pudimos cargar el menú de este local.'}</p>
      </div>
    );
  }

  // Pantalla de Suspensión
  if (tenant.is_suspended) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-slate-950 text-white text-center relative overflow-hidden">
        <MaxesWatermark />
        <div className="glass p-10 rounded-[2.5rem] w-full max-w-md flex flex-col items-center space-y-6 shadow-2xl border border-red-500/20 relative z-10">
          <MaxesLogo appName="MyMapps" scale={1} className="mb-4" />
          <div className="bg-red-500/10 p-4 rounded-3xl text-red-500 border border-red-500/30">
            <Lock size={48} />
          </div>
          <h1 className="text-2xl font-black text-white uppercase tracking-widest">Local Inactivo</h1>
          <p className="text-slate-400 text-sm font-bold">El menú digital de este local se encuentra temporalmente fuera de servicio.</p>
        </div>
      </div>
    );
  }

  return <PublicMenu tenant={tenant} />;
}
