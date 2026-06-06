import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Check, Trash2, ShieldAlert, Music, Heart, MessageCircle, Send } from 'lucide-react';
interface SocialInteraction {
  id: string;
  type: 'message' | 'song_request' | 'dedication';
  sender_name: string;
  is_anonymous: boolean;
  content: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

interface AnimadorTabProps {
  tenant: any;
  isLight?: boolean;
}

export default function AnimadorTab({ tenant, isLight = false }: AnimadorTabProps) {
  const [messages, setMessages] = useState<SocialInteraction[]>([]);
  const [customMessage, setCustomMessage] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const primaryColor = tenant?.theme_colors?.primary || '#f97316';

  useEffect(() => {
    if (!tenant?.id) return;

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('social_interactions')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setMessages(data);
      }
    };

    fetchMessages();

    const channel = supabase
      .channel(`admin:social_interactions:${tenant.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'social_interactions', filter: `tenant_id=eq.${tenant.id}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setMessages(prev => [payload.new as SocialInteraction, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setMessages(prev => prev.map(m => m.id === payload.new.id ? payload.new as SocialInteraction : m));
          } else if (payload.eventType === 'DELETE') {
            setMessages(prev => prev.filter(m => m.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenant?.id]);

  const updateStatus = async (id: string, status: 'approved' | 'rejected') => {
    try {
      await supabase.from('social_interactions').update({ status }).eq('id', id);
    } catch (e) {
      console.error(e);
      alert('Error al actualizar');
    }
  };

  const pendingMessages = messages.filter(m => m.status === 'pending');
  const processedMessages = messages.filter(m => m.status !== 'pending');

  const handlePostMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customMessage.trim() || !tenant?.id) return;

    setIsPosting(true);
    try {
      const { error } = await supabase.from('social_interactions').insert([{
        type: 'message',
        sender_name: 'Animador',
        is_anonymous: false,
        content: customMessage.trim(),
        status: 'approved',
        tenant_id: tenant.id
      }]);

      if (error) throw error;
      setCustomMessage('');
    } catch (e) {
      console.error(e);
      alert('Error al publicar el mensaje');
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <div className={`p-4 md:p-6 space-y-6 ${isLight ? 'text-slate-900' : 'text-white'}`}>
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-full flex items-center justify-center bg-purple-500/20 text-purple-500">
          <ShieldAlert size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-black uppercase tracking-tight italic">Panel del Animador</h2>
          <p className={`text-xs uppercase tracking-widest font-bold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Moderación de Rockola y Muro Social</p>
        </div>
      </div>

      {/* PUBLICAR MENSAJE DIRECTO */}
      <form onSubmit={handlePostMessage} className={`p-4 rounded-2xl border mb-8 flex flex-col md:flex-row gap-3 items-end md:items-center ${isLight ? 'bg-white border-slate-200' : 'bg-slate-900/50 border-slate-800'} animate-in fade-in`}>
        <div className="flex-1 w-full relative">
          <MessageCircle size={18} className={`absolute left-3 top-1/2 -translate-y-1/2 ${isLight ? 'text-slate-400' : 'text-slate-500'}`} />
          <input
            type="text"
            placeholder="Escribe un reto, anuncio o juego para el muro..."
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
            className={`w-full pl-10 pr-4 py-3 rounded-xl border font-medium text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all ${isLight ? 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400' : 'bg-slate-950 border-slate-800 text-white placeholder-slate-600'}`}
          />
        </div>
        <button 
          type="submit" 
          disabled={!customMessage.trim() || isPosting}
          className="w-full md:w-auto px-6 py-3 rounded-xl bg-purple-600 text-white font-bold text-sm uppercase tracking-wide hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {isPosting ? 'Publicando...' : (
            <>
              <Send size={16} /> Publicar
            </>
          )}
        </button>
      </form>

      <div className="grid md:grid-cols-2 gap-6">
        {/* PENDIENTES */}
        <div className="space-y-4">
          <h3 className="text-sm font-black uppercase flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></span>
            Pendientes de Aprobación ({pendingMessages.length})
          </h3>
          
          <div className="space-y-3">
            {pendingMessages.length === 0 ? (
              <div className={`p-8 text-center rounded-3xl border border-dashed ${isLight ? 'border-slate-300 text-slate-500 bg-slate-50' : 'border-slate-800 text-slate-500 bg-slate-900/30'}`}>
                No hay mensajes pendientes
              </div>
            ) : (
              pendingMessages.map(msg => (
                <div key={msg.id} className={`p-4 rounded-2xl border ${isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-900/50 border-slate-800'} animate-in fade-in`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-black uppercase text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded-md flex items-center gap-1">
                      {msg.type === 'song_request' ? <Music size={10} /> : msg.type === 'dedication' ? <Heart size={10} /> : <MessageCircle size={10} />}
                      {msg.type === 'song_request' ? 'Rockola' : msg.type === 'dedication' ? 'Dedicatoria' : 'Mensaje'}
                    </span>
                    <span className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  
                  <p className="text-sm font-medium mb-3">{msg.content}</p>
                  
                  <div className="flex items-center justify-between mt-4">
                    <div className="flex items-center gap-1">
                      <span className={`text-[9px] uppercase font-bold px-2 py-1 rounded-full ${msg.is_anonymous ? 'bg-purple-500/20 text-purple-400' : (isLight ? 'bg-slate-100 text-slate-600' : 'bg-slate-800 text-slate-400')}`}>
                        De: {msg.sender_name}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateStatus(msg.id, 'rejected')} className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl transition-colors">
                        <Trash2 size={16} />
                      </button>
                      <button onClick={() => updateStatus(msg.id, 'approved')} className="px-4 py-2 bg-green-500 text-white font-black text-[10px] uppercase tracking-wider rounded-xl hover:bg-green-600 transition-colors flex items-center gap-1">
                        <Check size={14} /> Aprobar
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* PROCESADOS */}
        <div className="space-y-4">
          <h3 className="text-sm font-black uppercase flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-slate-500"></span>
            Historial Procesado
          </h3>
          
          <div className="space-y-3 opacity-80">
            {processedMessages.length === 0 ? (
              <div className={`p-8 text-center rounded-3xl border border-dashed ${isLight ? 'border-slate-300 text-slate-500 bg-slate-50' : 'border-slate-800 text-slate-500 bg-slate-900/30'}`}>
                Sin historial
              </div>
            ) : (
              processedMessages.map(msg => (
                <div key={msg.id} className={`p-3 rounded-xl border ${msg.status === 'approved' ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'} ${isLight ? 'bg-white' : 'bg-slate-900/30'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded flex items-center gap-1 ${msg.status === 'approved' ? 'text-green-500 bg-green-500/10' : 'text-red-500 bg-red-500/10'}`}>
                      {msg.status === 'approved' ? <Check size={10} /> : <Trash2 size={10} />}
                      {msg.status === 'approved' ? 'Aprobado' : 'Rechazado'}
                    </span>
                    <span className="text-[9px] text-slate-500">
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-xs truncate" title={msg.content}>{msg.content}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
