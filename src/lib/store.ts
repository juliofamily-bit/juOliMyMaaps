import { create } from 'zustand'
import { supabase } from './supabase'

export type UserRole = 'admin' | 'staff' | 'kitchen';

interface NotificationStore {
    addNotification: (message: string, target_roles: UserRole[], type?: 'info' | 'alert' | 'success') => Promise<void>;
    removeNotification: (id: string) => Promise<void>;
    clearAll: () => Promise<void>;
}

export const useNotifications = create<NotificationStore>(() => ({
    addNotification: async (message: string, target_roles: UserRole[], type = 'info') => {
        const { error } = await supabase.from('app_notifications').insert([{
            message,
            type,
            target_roles
        }]);
        if (error) console.error('Error adding notification:', error);
    },
    removeNotification: async (id: string) => {
        const { error } = await supabase.from('app_notifications').delete().eq('id', id);
        if (error) console.error('Error removing notification:', error);
    },
    clearAll: async () => {
        const { error } = await supabase.from('app_notifications').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (error) console.error('Error clearing notifications:', error);
    },
}))
