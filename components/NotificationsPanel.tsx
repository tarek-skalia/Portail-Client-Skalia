
import React, { useEffect, useState } from 'react';
import { Bell, Check, Info, AlertTriangle, XCircle, CheckCircle2, ChevronRight } from 'lucide-react';
import { Notification } from '../types';
import { supabase } from '../lib/supabase';
import Skeleton from './Skeleton';

interface NotificationsPanelProps {
  userId?: string;
  onClose: () => void;
  onNavigate: (page: string) => void;
  onRead: () => void;
  onAllRead: () => void;
}

const NotificationsPanel: React.FC<NotificationsPanelProps> = ({ userId, onClose, onNavigate, onRead, onAllRead }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (userId) {
      fetchNotifications();
      
      // Realtime subscription avec filtre pour ne recevoir que SES notifications
      const channel = supabase
        .channel(`realtime:notifications:${userId}`)
        .on(
            'postgres_changes', 
            { 
                event: 'INSERT', 
                schema: 'public', 
                table: 'notifications', 
                filter: `user_id=eq.${userId}` 
            }, 
            (payload) => {
                // Ajout immédiat de la nouvelle notif à la liste sans re-fetch tout
                const newNotif = mapNotification(payload.new);
                setNotifications(prev => [newNotif, ...prev]);
            }
        )
        .subscribe();
      
      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [userId]);

  const mapNotification = (n: any): Notification => ({
    id: n.id,
    userId: n.user_id,
    title: n.title,
    message: n.message || '',
    type: n.type,
    link: n.link,
    isRead: n.is_read,
    createdAt: n.created_at
  });

  const fetchNotifications = async () => {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Erreur chargement notifications:', error);
    } else if (data) {
      const mapped = data.map(mapNotification);
      setNotifications(mapped);
    }
    setIsLoading(false);
  };

  const markAsRead = async (notifId: string) => {
    // Optimistic update
    setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, isRead: true } : n));
    onRead(); // Met à jour le compteur global immédiatement
    
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notifId);
  };

  const markAllAsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    onAllRead(); // Reset compteur global
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);
  };

  const handleClick = (n: Notification) => {
    if (!n.isRead) markAsRead(n.id);
    if (n.link) {
      onNavigate(n.link);
      onClose();
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle2 size={18} className="text-emerald-500" />;
      case 'warning': return <AlertTriangle size={18} className="text-amber-500" />;
      case 'error': return <XCircle size={18} className="text-red-500" />;
      default: return <Info size={18} className="text-blue-500" />;
    }
  };

  const getTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'À l\'instant';
    if (diffInSeconds < 3600) return `Il y a ${Math.floor(diffInSeconds / 60)} min`;
    if (diffInSeconds < 86400) return `Il y a ${Math.floor(diffInSeconds / 3600)} h`;
    return date.toLocaleDateString('fr-FR');
  };

  return (
    <div className="absolute top-16 right-4 w-96 bg-white border border-gray-200 rounded-2xl shadow-2xl z-50 overflow-hidden animate-fade-in-up origin-top-right">
      
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-white">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">
          Centre de notifications
        </h3>
        {notifications.some(n => !n.isRead) && (
            <button 
            onClick={markAllAsRead}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
            >
            Tout marquer comme lu
            </button>
        )}
      </div>

      {/* List */}
      <div className="max-h-[400px] overflow-y-auto custom-scrollbar bg-white">
        {isLoading ? (
          <div className="p-4 space-y-4">
             <div className="flex gap-3">
                <Skeleton className="w-8 h-8 rounded-full" />
                <div className="flex-1 space-y-2">
                   <Skeleton className="w-3/4 h-4" />
                   <Skeleton className="w-full h-3" />
                </div>
             </div>
             <div className="flex gap-3">
                <Skeleton className="w-8 h-8 rounded-full" />
                <div className="flex-1 space-y-2">
                   <Skeleton className="w-1/2 h-4" />
                   <Skeleton className="w-full h-3" />
                </div>
             </div>
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-12 px-6 text-center">
            <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
              <Bell className="text-slate-300" size={20} />
            </div>
            <p className="text-slate-800 font-medium">Tout est calme</p>
            <p className="text-xs text-slate-400 mt-1">Vous n'avez aucune nouvelle notification.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {notifications.map((n) => (
              <div 
                key={n.id}
                onClick={() => handleClick(n)}
                className={`p-4 hover:bg-slate-50 transition-colors cursor-pointer relative group ${!n.isRead ? 'bg-indigo-50/60' : ''}`}
              >
                {!n.isRead && (
                   <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500"></div>
                )}
                
                <div className="flex gap-3">
                   <div className="mt-0.5 shrink-0">
                      {getIcon(n.type)}
                   </div>
                   <div className="flex-1">
                      <div className="flex justify-between items-start">
                         <h4 className={`text-sm ${!n.isRead ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>
                            {n.title}
                         </h4>
                         <span className="text-[10px] text-slate-400 whitespace-nowrap ml-2">
                            {getTimeAgo(n.createdAt)}
                         </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed line-clamp-2">
                        {n.message}
                      </p>
                      {n.link && (
                         <div className="mt-2 flex items-center text-[10px] font-bold text-indigo-600 uppercase tracking-wide opacity-0 group-hover:opacity-100 transition-opacity">
                            Voir détails <ChevronRight size={12} />
                         </div>
                      )}
                   </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Footer */}
      <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 text-center">
         <p className="text-[10px] text-slate-400">Les notifications sont conservées 30 jours.</p>
      </div>
    </div>
  );
};

export default NotificationsPanel;
