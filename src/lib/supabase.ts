import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const clientsCache: Record<string, SupabaseClient> = {};
let activeTenantId: string | null = null;

function getClient(): SupabaseClient {
  const key = activeTenantId || 'default';
  if (!clientsCache[key]) {
    clientsCache[key] = createClient(supabaseUrl, supabaseAnonKey, activeTenantId ? {
      global: {
        headers: {
          'x-tenant-id': activeTenantId
        }
      }
    } : undefined);
  }
  return clientsCache[key];
}

// Exportamos supabase como un Proxy para que actúe dinámicamente según el tenant activo,
// manteniendo la compatibilidad exacta con todas las importaciones existentes.
export const supabase = new Proxy({} as SupabaseClient, {
  get(target, prop) {
    const client = getClient();
    const value = (client as any)[prop];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  }
});

// Cliente completamente anónimo y limpio de cabeceras para operaciones públicas y transversales
// (como resolver el slug de un local a su ID).
export const supabaseAnon = new Proxy({} as SupabaseClient, {
  get(target, prop) {
    const client = clientsCache['default'] || (clientsCache['default'] = createClient(supabaseUrl, supabaseAnonKey));
    const value = (client as any)[prop];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  }
});

export function setSupabaseTenant(tenantId: string | null) {
  activeTenantId = tenantId;
}


const broadcastChannelsCache: Record<string, any> = {};

function getBroadcastChannel(tenantId: string) {
  const client = getClient();
  const channelName = `tenant-room-${tenantId}`;
  if (!broadcastChannelsCache[channelName]) {
    const chan = client.channel(channelName, {
      config: {
        broadcast: { self: true }
      }
    });
    chan.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`[BROADCAST HUB] Conectado permanentemente al canal ${channelName}`);
      }
    });
    broadcastChannelsCache[channelName] = chan;
  }
  return broadcastChannelsCache[channelName];
}

export function broadcastTenantChange(tenantId: string | null, event: string = 'schema-update', payload: any = {}) {
  if (!tenantId) return;
  try {
    const channel = getBroadcastChannel(tenantId);
    channel.send({
      type: 'broadcast',
      event,
      payload: { ...payload, timestamp: Date.now() }
    }).catch((err: any) => {
      console.warn('[BROADCAST HUB] Error al enviar evento:', err);
    });
  } catch (e) {
    console.error('[BROADCAST HUB] Error fatal en difusión:', e);
  }
}
