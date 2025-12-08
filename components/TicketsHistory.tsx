
import React, { useEffect, useState } from 'react';
import { Ticket } from '../types';
import { CheckCircle2, Clock, Circle, MessageSquare, ArrowUpRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import Skeleton from './Skeleton';

interface TicketsHistoryProps {
  userId?: string;
}

const TicketsHistory: React.FC<TicketsHistoryProps> = ({ userId }) => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (userId) {
        fetchTickets();

        const channel = supabase
            .channel('realtime:tickets')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, () => {
                fetchTickets();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }
  }, [userId]);

  const fetchTickets = async () => {
    const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Erreur chargement tickets:', error);
    } else if (data) {
        const mapped: Ticket[] = data.map((item: any) => ({
            id: item.id,
            clientId: item.user_id,
            subject: item.subject,
            category: item.category || 'Support',
            priority: item.priority,
            status: item.status,
            date: item.date ? new Date(item.date).toLocaleDateString('fr-FR') : '-',
            lastUpdate: item.last_update || 'À l\'instant'
        }));
        setTickets(mapped);
    }
    setIsLoading(false);
  };

  const getStatusConfig = (status: Ticket['status']) => {
    switch (status) {
      case 'open':
        return { 
          label: 'Ouvert', 
          bg: 'bg-blue-50', 
          text: 'text-blue-600', 
          icon: <Circle size={14} className="fill-blue-600" /> 
        };
      case 'in_progress':
        return { 
          label: 'En cours', 
          bg: 'bg-purple-50', 
          text: 'text-purple-600', 
          icon: <Clock size={14} className="animate-pulse" /> 
        };
      case 'resolved':
        return { 
          label: 'Résolu', 
          bg: 'bg-emerald-50', 
          text: 'text-emerald-600', 
          icon: <CheckCircle2 size={14} /> 
        };
      case 'closed':
        return { 
          label: 'Fermé', 
          bg: 'bg-gray-100', 
          text: 'text-gray-500', 
          icon: <CheckCircle2 size={14} /> 
        };
      default:
        return { label: status, bg: 'bg-gray-50', text: 'text-gray-500', icon: <Circle size={14} /> };
    }
  };

  const getPriorityStyle = (priority: Ticket['priority']) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-50 border-red-100';
      case 'medium': return 'text-amber-600 bg-amber-50 border-amber-100';
      case 'low': return 'text-green-600 bg-green-50 border-green-100';
      default: return 'text-gray-600 bg-gray-50 border-gray-100';
    }
  };

  if (isLoading) {
      return (
        <div className="space-y-6 animate-fade-in-up">
            <div className="flex justify-between items-end mb-6">
                <div className="space-y-2">
                    <Skeleton className="h-8 w-64" />
                    <Skeleton className="h-4 w-48" />
                </div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden p-6 space-y-4">
                 {[1, 2, 3, 4].map(i => (
                     <div key={i} className="flex justify-between items-center py-4 border-b border-gray-50 last:border-0">
                         <div className="flex-1 space-y-2">
                             <Skeleton className="h-5 w-1/3" />
                             <Skeleton className="h-3 w-1/4" />
                         </div>
                         <div className="w-1/4 flex gap-4">
                            <Skeleton className="h-4 w-20" />
                            <Skeleton className="h-6 w-24 rounded-full" />
                         </div>
                     </div>
                 ))}
            </div>
        </div>
      );
  }

  if (tickets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] bg-white/50 rounded-3xl border border-dashed border-slate-300 animate-fade-in-up">
        <div className="p-6 bg-indigo-50 rounded-full mb-6">
          <MessageSquare className="text-indigo-400 w-10 h-10" />
        </div>
        <h3 className="text-lg font-semibold text-slate-800">Aucun ticket</h3>
        <p className="text-slate-500 mt-2">Vous n'avez pas encore fait de demande de support.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex justify-between items-end mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Historique des Tickets</h2>
          <p className="text-gray-500 text-sm mt-1">Suivez l'avancement de vos demandes.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase text-gray-500 font-semibold tracking-wider">
                <th className="px-6 py-4">Sujet</th>
                <th className="px-6 py-4 hidden sm:table-cell">ID Ticket</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Priorité</th>
                <th className="px-6 py-4">Statut</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tickets.map((ticket) => {
                const status = getStatusConfig(ticket.status);
                const priorityClass = getPriorityStyle(ticket.priority);
                
                return (
                  <tr 
                    key={ticket.id} 
                    className="hover:bg-gray-50/80 transition-colors group cursor-pointer"
                  >
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-semibold text-gray-800 group-hover:text-indigo-600 transition-colors">
                          {ticket.subject}
                        </span>
                        <span className="text-xs text-gray-400 mt-0.5">{ticket.category}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 font-mono hidden sm:table-cell">
                      #{ticket.id.slice(0, 8)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {ticket.date}
                      <div className="text-[10px] text-gray-400">Maj: {ticket.lastUpdate}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${priorityClass}`}>
                        {ticket.priority === 'high' ? 'Haute' : ticket.priority === 'medium' ? 'Moyenne' : 'Faible'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${status.bg} ${status.text}`}>
                        {status.icon}
                        {status.label}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                       <button className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                          <ArrowUpRight size={18} />
                       </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TicketsHistory;
