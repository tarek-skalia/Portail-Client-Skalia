
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Terminal } from 'lucide-react';
import Skeleton from './Skeleton';

interface ActivityItem {
  id: string;
  type: 'log' | 'ticket' | 'invoice';
  title: string;
  subtitle: string;
  date: string;
  status: 'success' | 'warning' | 'error' | 'info';
}

interface RecentActivityFeedProps {
  userId?: string;
}

const RecentActivityFeed: React.FC<RecentActivityFeedProps> = ({ userId }) => {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Reset immédiat au changement d'utilisateur pour éviter l'affichage persistant
    setActivities([]); 
    setIsLoading(true);

    if (userId) {
      fetchActivity();
      
      // Utilisation d'un nom de channel unique par utilisateur pour éviter le mélange de données
      // lors du switch rapide Admin -> Client -> Admin
      const channelName = `dashboard_feed_${userId}`;
      const channel = supabase.channel(channelName)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'automation_logs' }, () => fetchActivity())
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ticket_messages' }, () => fetchActivity())
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'invoices' }, () => fetchActivity())
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }
  }, [userId]);

  const fetchActivity = async () => {
    try {
      // 1. LOGS: Filtre via la table jointe automations!inner(user_id)
      const { data: logs } = await supabase
        .from('automation_logs')
        .select(`id, status, created_at, automations!inner(name, user_id)`)
        .eq('automations.user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5);

      // 2. MESSAGES: Filtre via la table jointe tickets!inner(user_id)
      const { data: messages } = await supabase
        .from('ticket_messages')
        .select(`id, message, created_at, sender_type, tickets!inner(subject, user_id)`)
        .eq('tickets.user_id', userId)
        .eq('sender_type', 'admin') // On garde seulement les réponses admin
        .order('created_at', { ascending: false })
        .limit(3);

      // 3. INVOICES: Filtre direct sur user_id
      const { data: invoices } = await supabase
        .from('invoices')
        .select('id, number, amount, status, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(2);

      const combined: ActivityItem[] = [];

      logs?.forEach((log: any) => {
        combined.push({
          id: log.id,
          type: 'log',
          title: log.automations?.name || 'System',
          subtitle: log.status === 'success' ? 'Task completed successfully' : 'Execution failed',
          date: log.created_at,
          status: log.status === 'success' ? 'success' : 'error'
        });
      });

      messages?.forEach((msg: any) => {
        combined.push({
          id: msg.id,
          type: 'ticket',
          title: 'Support Agent',
          subtitle: `Replied to: ${msg.tickets?.subject}`,
          date: msg.created_at,
          status: 'info'
        });
      });

      invoices?.forEach((inv: any) => {
        combined.push({
          id: inv.id,
          type: 'invoice',
          title: 'Billing System',
          subtitle: `Generated Invoice ${inv.number} (${inv.amount}€)`,
          date: inv.created_at,
          status: 'warning'
        });
      });

      const sorted = combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 6);
      setActivities(sorted);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (dateStr: string) => {
      const d = new Date(dateStr);
      return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  if (isLoading) {
    return <Skeleton className="h-48 w-full rounded-2xl bg-slate-900" />;
  }

  return (
    <div className="bg-slate-950 rounded-2xl border border-slate-800 p-6 shadow-2xl relative overflow-hidden group">
       {/* Header Terminal */}
       <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-800">
           <div className="flex items-center gap-3">
               <div className="p-1.5 bg-slate-900 rounded-lg border border-slate-800 text-green-500">
                   <Terminal size={16} />
               </div>
               <h3 className="text-sm font-bold text-slate-200 tracking-wide font-mono">LIVE_ACTIVITY_FEED</h3>
           </div>
           <div className="flex gap-1.5">
               <div className="w-2.5 h-2.5 rounded-full bg-slate-800"></div>
               <div className="w-2.5 h-2.5 rounded-full bg-slate-800"></div>
               <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></div>
           </div>
       </div>

       {/* Content Log Style */}
       <div className="font-mono text-xs space-y-3 relative z-10">
           {activities.length === 0 ? (
               <p className="text-slate-600 italic">&gt;&gt; No recent activity for this user...</p>
           ) : (
               activities.map((item, index) => (
                   <div key={item.id} className="flex items-start gap-3 opacity-90 hover:opacity-100 transition-opacity">
                       <span className="text-slate-600 shrink-0">[{formatTime(item.date)}]</span>
                       
                       <span className={`font-bold shrink-0 w-20 ${
                           item.status === 'success' ? 'text-emerald-400' :
                           item.status === 'error' ? 'text-red-500' :
                           item.status === 'warning' ? 'text-amber-400' : 'text-blue-400'
                       }`}>
                           {item.status.toUpperCase()}
                       </span>

                       <div className="text-slate-300 truncate">
                           <span className="text-slate-500 mr-2">root@{item.title.toLowerCase().replace(/\s/g, '_')}:</span>
                           {item.subtitle}
                       </div>
                   </div>
               ))
           )}
           {/* Fake cursor blinking at the end */}
           <div className="mt-2 text-green-500 animate-pulse">_</div>
       </div>
       
       {/* Background Glow */}
       <div className="absolute top-0 right-0 w-64 h-64 bg-green-500/5 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/2"></div>
    </div>
  );
};

export default RecentActivityFeed;
