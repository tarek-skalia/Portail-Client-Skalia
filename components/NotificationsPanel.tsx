
import React, { useEffect, useState } from 'react';
import { Bell, Info, AlertTriangle, XCircle, CheckCircle2, ChevronRight, Trash2 } from 'lucide-react';
import { Notification } from '../types';
import { supabase } from '../lib/supabase';
import Skeleton from './Skeleton';
import { useToast } from './ToastProvider';

interface NotificationsPanelProps {
  userId?: string;
  onClose: () => void;
  onNavigate: (page: string) => void;
  onRead: () => void;
  onAllRead: () => void;
  refreshTrigger: number;
}

const NotificationsPanel: React.FC<NotificationsPanelProps> = ({ userId, onClose, onNavigate, onRead, onAllRead, refreshTrigger }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const toast = useToast();

  // Charger les notifications
  useEffect(() => {
    if (userId) {
      fetchNotifications();
    }
  }, [userId, refreshTrigger]);

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
    // On garde le loading uniquement si c'est le premier chargement pour éviter le clignotement
    if (notifications.length === 0) setIsLoading(true);

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Erreur chargement notifications:', error);
    } else if (data) {
      const mapped = data.map(mapNotification);
      
      // --- DEDUPLICATION INTELLIGENTE (AGRESSIVE) ---
      // Si la DB contient des doublons à cause de multiples triggers, on nettoie ici pour l'affichage.
      const uniqueNotifications = mapped.filter((notif, index, self) => {
        // On cherche s'il existe une notification "similaire" qui est apparue AVANT celle-ci dans la liste (index plus petit)
        // La liste est triée par date décroissante (le plus récent en premier = index 0)
        
        const firstOccurrenceIndex = self.findIndex((t) => {
            const timeDiff = Math.abs(new Date(t.createdAt).getTime() - new Date(notif.createdAt).getTime());
            const isVeryClose = timeDiff < 3000; // 3 secondes d'écart max
            
            // Cas 1: Doublon exact
            if (t.title === notif.title && t.message === notif.message && isVeryClose) {
                return true;
            }

            // Cas 2: Doublon Projet (Même lien 'projects' + Titre similaire + Temps proche)
            if (t.link === 'projects' && notif.link === 'projects' && isVeryClose) {
                if ((t.title.includes('projet') || t.title.includes('Projet')) && 
                    (notif.title.includes('projet') || notif.title.includes('Projet'))) {
                    return true;
                }
            }

            // Cas 3: Doublon Facture (Même lien 'invoices' + Titre similaire)
            if (t.link === 'invoices' && notif.link === 'invoices' && isVeryClose) {
                 if (t.title.toLowerCase().includes('paiement') && notif.title.toLowerCase().includes('paiement')) {
                    return true;
                 }
            }

            return false;
        });

        // Si l'index trouvé est le même que l'index actuel, c'est la première fois qu'on voit cette notif (la plus récente), on la garde.
        return index === firstOccurrenceIndex;
      });

      setNotifications(uniqueNotifications);
    }
    setIsLoading(false);
  };

  const markAsRead = async (notifId: string) => {
    setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, isRead: true } : n));
    onRead();
    
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notifId);
  };

  const markAllAsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    onAllRead();
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);
  };

  const deleteAll = async () => {
    if (notifications.length === 0) return;
    
    const previousNotifications = [...notifications];

    // UI Optimiste : on vide tout de suite pour l'utilisateur
    setNotifications([]);
    onAllRead(); // Remet le compteur (badge rouge) à 0

    // Suppression réelle dans Supabase
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('user_id', userId);
      
    if (error) {
        console.error("Erreur suppression notifications", error);
        // Rollback : on remet les notifications si erreur (ex: permission refusée)
        setNotifications(previousNotifications);
        toast.error("Erreur suppression", "Impossible de supprimer. Vérifiez que la règle DELETE est active sur Supabase.");
    } else {
        toast.success("Nettoyage effectué", "Toutes les notifications ont été supprimées.");
    }
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
      case 'success': return <CheckCircle2 size={20} className="text-emerald-500" />;
      case 'warning': return <AlertTriangle size={20} className="text-amber-500" />;
      case 'error': return <XCircle size={20} className="text-red-500" />;
      default: return <Info size={20} className="text-blue-500" />;
    }
  };

  const getTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'À l\'instant';
    if (diffInSeconds < 3600) return `Il y a ${Math.floor(diffInSeconds / 60)} min`;
    if (diffInSeconds < 86400) return `Il y a ${Math.floor(diffInSeconds / 3600)} h`;
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="absolute top-16 right-4 w-96 bg-white border border-gray-200 rounded-2xl shadow-2xl z-50 overflow-hidden animate-fade-in-up origin-top-right">
      
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">
          Notifications
        </h3>
        <div className="flex items-center gap-2">
            {notifications.length > 0 && (
                <button 
                  onClick={deleteAll}
                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  title="Tout supprimer"
                >
                    <Trash2 size={16} />
                </button>
            )}
            
            {notifications.some(n => !n.isRead) && (
                <button 
                onClick={markAllAsRead}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors bg-indigo-50 px-2 py-1 rounded-lg"
                >
                Tout lire
                </button>
            )}
        </div>
      </div>

      {/* List */}
      <div className="max-h-[400px] overflow-y-auto custom-scrollbar bg-white">
        {isLoading ? (
          <div className="p-4 space-y-4">
             {[1,2,3].map(i => (
                <div key={i} className="flex gap-4">
                    <Skeleton className="w-10 h-10 rounded-full shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="w-3/4 h-3" />
                      <Skeleton className="w-full h-2" />
                    </div>
                </div>
             ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-12 px-6 text-center">
            <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
              <Bell className="text-slate-300" size={20} />
            </div>
            <p className="text-slate-800 font-medium">Tout est calme</p>
            <p className="text-xs text-slate-400 mt-1">Aucune nouvelle notification.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {notifications.map((n) => (
              <div 
                key={n.id}
                onClick={() => handleClick(n)}
                className={`p-4 hover:bg-slate-50 transition-colors cursor-pointer relative group ${!n.isRead ? 'bg-indigo-50/40' : ''}`}
              >
                {!n.isRead && (
                   <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500"></div>
                )}
                
                <div className="flex items-start gap-4">
                   <div className="w-10 h-10 rounded-full bg-white border border-slate-100 shadow-sm flex items-center justify-center shrink-0 mt-0.5">
                      {getIcon(n.type)}
                   </div>
                   
                   <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1">
                         <h4 className={`text-sm truncate pr-2 ${!n.isRead ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>
                            {n.title}
                         </h4>
                         <span className="text-[10px] text-slate-400 whitespace-nowrap shrink-0 mt-0.5">
                            {getTimeAgo(n.createdAt)}
                         </span>
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                        {n.message}
                      </p>
                      {n.link && (
                         <div className="mt-2 flex items-center text-[10px] font-bold text-indigo-600 uppercase tracking-wide opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-[-10px] group-hover:translate-x-0 duration-200">
                            VOIR DÉTAILS <ChevronRight size={12} />
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
         <p className="text-[10px] text-slate-400">Historique des 30 derniers jours</p>
      </div>
    </div>
  );
};

export default NotificationsPanel;
