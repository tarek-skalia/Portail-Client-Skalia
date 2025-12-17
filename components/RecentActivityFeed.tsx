
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Terminal } from 'lucide-react';
import Skeleton from './Skeleton';

interface ActivityItem {
  id: string;
  type: 'log' | 'ticket' | 'invoice' | 'system';
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
    setActivities([]); 
    setIsLoading(true);

    if (userId) {
      fetchActivity();
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
      const { data: logs } = await supabase.from('automation_logs').select(`id, status, created_at, automations!inner(name, user_id)`).eq('automations.user_id', userId).order('created_at', { ascending: false }).limit(5);
      const { data: messages } = await supabase.from('ticket_messages').select(`id, message, created_at, sender_type, tickets!inner(subject, user_id)`).eq('tickets.user_id', userId).eq('sender_type', 'admin').order('created_at', { ascending: false }).limit(3);
      const { data: invoices } = await supabase.from('invoices').select('id, number, amount, status, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(2);

      const combined: ActivityItem[] = [];
      logs?.forEach((log: any) => combined.push({ id: log.id, type: 'log', title: log.automations?.name || 'System', subtitle: log.status === 'success' ? 'Task completed successfully' : 'Execution failed', date: log.created_at, status: log.status === 'success' ? 'success' : 'error' }));
      messages?.forEach((msg: any) => combined.push({ id: msg.id, type: 'ticket', title: 'Support Agent', subtitle: `Replied to: ${msg.tickets?.subject}`, date: msg.created_at, status: 'info' }));
      invoices?.forEach((inv: any) => combined.push({ id: inv.id, type: 'invoice', title: 'Billing System', subtitle: `Generated Invoice ${inv.number} (${inv.amount}€)`, date: inv.created_at, status: 'warning' }));

      // --- LOGIQUE PREMIER CONTACT : LOGS SYSTEMES ---
      if (combined.length === 0) {
          const now = new Date();
          const startOfSession = new Date(now.getTime() - 2000);
          combined.push({
              id: 'sys-1', type: 'system', title: 'Core', subtitle: 'SKALIA_V1.0_ENGINE_STARTED', date: startOfSession.toISOString(), status: 'success'
          });
          combined.push({
              id: 'sys-2', type: 'system', title: 'Security', subtitle: 'ENCRYPTED_HANDSHAKE_COMPLETED', date: new Date(now.getTime() - 1000).toISOString(), status: 'success'
          });
          combined.push({
              id: 'sys-3', type: 'system', title: 'Client', subtitle: 'WAITING_FOR_INCOMING_FLUX_DATA...', date: now.toISOString(), status: 'info'
          });
      }

      const sorted = combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 6);
      setActivities(sorted);
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  };

  const formatTime = (dateStr: string) => {
      const d = new Date(dateStr);
      return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  if (isLoading) return <Skeleton className="h-48 w-full rounded-2xl bg-slate-900" />;

  return (
    <div className="bg-slate-950 rounded-2xl border border-slate-800 p-6 shadow-2xl relative overflow-hidden group">
       <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-800">
           <div className="flex items-center gap-3"><div className="p-1.5 bg-slate-900 rounded-lg border border-slate-800 text-green-500"><Terminal size={16} /></div><h3 className="text-sm font-bold text-slate-200 tracking-wide font-mono">LIVE_ACTIVITY_FEED</h3></div>
           <div className="flex gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-slate-800"></div><div className="w-2.5 h-2.5 rounded-full bg-slate-800"></div><div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></div></div>
       </div>
       <div className="font-mono text-xs space-y-3 relative z-10">
           {activities.map((item) => (
               <div key={item.id} className="flex items-start gap-3 opacity-90 hover:opacity-100 transition-opacity">
                   <span className="text-slate-600 shrink-0">[{formatTime(item.date)}]</span>
                   <span className={`font-bold shrink-0 w-20 ${item.status === 'success' ? 'text-emerald-400' : item.status === 'error' ? 'text-red-500' : (item.status === 'warning' ? 'text-amber-400' : 'text-blue-400')}`}>{item.status.toUpperCase()}</span>
                   <div className="text-slate-300 truncate"><span className="text-slate-500 mr-2">root@{item.title.toLowerCase().replace(/\s/g, '_')}:</span>{item.subtitle}</div>
               </div>
           ))}
           <div className="mt-2 text-green-500 animate-pulse">_</div>
       </div>
       <div className="absolute top-0 right-0 w-64 h-64 bg-green-500/5 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/2"></div>
    </div>
  );
};

export default RecentActivityFeed;
