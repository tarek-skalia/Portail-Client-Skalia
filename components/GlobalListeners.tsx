
import React, { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from './ToastProvider';

interface GlobalListenersProps {
  userId: string;
  onNewNotification: () => void;
}

const GlobalListeners: React.FC<GlobalListenersProps> = ({ userId, onNewNotification }) => {
  const toast = useToast();
  
  // Refs pour éviter les doublons (Debounce)
  const hasCheckedInvoicesRef = useRef(false);
  const recentToastsRef = useRef<{id: string; time: number; contentHash: string}[]>([]);

  // Reset du flag si l'utilisateur change
  useEffect(() => {
    hasCheckedInvoicesRef.current = false;
    recentToastsRef.current = [];
  }, [userId]);

  // =========================================================================
  // 1. ÉCOUTE UNIQUE : TABLE NOTIFICATIONS
  // =========================================================================
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('public:notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newNotif = payload.new;
          const now = Date.now();
          
          // Création d'une signature unique pour cette notification (Titre + Lien)
          // Si deux notifs parlent du même lien avec un titre similaire en < 3s, c'est un doublon
          const notifLink = newNotif.link || 'nolink';
          const notifTitleSnippet = newNotif.title ? newNotif.title.substring(0, 10) : 'notitle';
          const contentHash = `${notifLink}-${notifTitleSnippet}`;

          // Nettoyage des vieux logs (> 5s)
          recentToastsRef.current = recentToastsRef.current.filter(t => now - t.time < 5000);

          // Vérification si doublon
          const isDuplicate = recentToastsRef.current.some(t => {
             // Soit c'est exactement le même ID (reçu deux fois par le websocket)
             if (t.id === newNotif.id) return true;
             // Soit c'est le même contenu sémantique reçu il y a très peu de temps
             if (t.contentHash === contentHash && (now - t.time) < 3000) return true;
             return false;
          });

          if (isDuplicate) {
            // On déclenche quand même le refresh de la liste pour être sûr d'avoir les données
            onNewNotification(); 
            return; 
          }

          // Ajout à la liste des récents
          recentToastsRef.current.push({ 
              id: newNotif.id, 
              time: now, 
              contentHash 
          });

          // Mise à jour de la pastille
          onNewNotification();
          
          // Affichage du Toast
          const { title, message, type } = newNotif;
          
          // Petit délai pour s'assurer que le rendu React est prêt
          setTimeout(() => {
             const safeMessage = message || '';
             if (type === 'success') toast.success(title, safeMessage);
             else if (type === 'error') toast.error(title, safeMessage);
             else if (type === 'warning') toast.warning(title, safeMessage);
             else toast.info(title, safeMessage);
          }, 50);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, onNewNotification, toast]);

  // =========================================================================
  // 2. VÉRIFICATION ÉCHÉANCES FACTURES (Au démarrage)
  // =========================================================================
  useEffect(() => {
    if (!userId || hasCheckedInvoicesRef.current) return;

    const checkDeadlines = async () => {
        hasCheckedInvoicesRef.current = true;

        const { data: invoices } = await supabase
            .from('invoices')
            .select('*')
            .eq('user_id', userId)
            .neq('status', 'paid');

        if (!invoices || invoices.length === 0) return;

        const today = new Date();
        today.setHours(0,0,0,0);

        for (const inv of invoices) {
            if (!inv.due_date) continue;
            const due = new Date(inv.due_date);
            due.setHours(0,0,0,0);
            
            const diffTime = due.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays === 3 || diffDays === 1) {
                const title = `Échéance proche (${diffDays}j)`;
                const todayStr = new Date().toISOString().split('T')[0];
                
                // Vérification anti-doublon en base avant d'insérer
                const { data: existing } = await supabase
                    .from('notifications')
                    .select('id')
                    .eq('user_id', userId)
                    .ilike('title', `%${title}%`)
                    .ilike('message', `%${inv.number}%`)
                    .gte('created_at', todayStr);

                if (!existing || existing.length === 0) {
                     await supabase.from('notifications').insert({
                        user_id: userId,
                        title: `${title} : ${inv.number}`,
                        message: `La facture ${inv.number} arrive à échéance dans ${diffDays} jour(s).`,
                        type: 'warning',
                        link: 'invoices',
                        is_read: false,
                        created_at: new Date().toISOString()
                     });
                }
            }
        }
    };

    checkDeadlines();
  }, [userId]);

  return null;
};

export default GlobalListeners;
