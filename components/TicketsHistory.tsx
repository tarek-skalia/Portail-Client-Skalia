
import React, { useEffect, useState } from 'react';
import { Ticket } from '../types';
import { CheckCircle2, Clock, Circle, MessageSquare, ArrowUpRight, Search, Filter } from 'lucide-react';
import { supabase } from '../lib/supabase';
import Skeleton from './Skeleton';
import TicketSlideOver from './TicketSlideOver';

// Extension locale du type Ticket pour inclure l'info "non lu"
interface ExtendedTicket extends Ticket {
    hasUnreadMessages?: boolean;
}

interface TicketsHistoryProps {
  userId?: string;
  initialTicketId?: string | null;
}

const TicketsHistory: React.FC<TicketsHistoryProps> = ({ userId, initialTicketId }) => {
  const [tickets, setTickets] = useState<ExtendedTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // UX State
  const [filterStatus, setFilterStatus] = useState<'all' | 'open' | 'closed'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  // SlideOver State
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [isSlideOverOpen, setIsSlideOverOpen] = useState(false);

  // --- AUTO-OUVERTURE DU TICKET (Redirection depuis Support) ---
  useEffect(() => {
      if (initialTicketId && tickets.length > 0) {
          const target = tickets.find(t => t.id === initialTicketId);
          if (target) {
              setSelectedTicket(target);
              setIsSlideOverOpen(true);
          }
      }
  }, [initialTicketId, tickets]);

  useEffect(() => {
    if (userId) {
        fetchTickets();

        const channel = supabase
            .channel('realtime:tickets_history')
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'tickets',
                filter: `user_id=eq.${userId}` // OPTIMISATION
            }, () => {
                fetchTickets();
            })
            .subscribe();

        // On écoute aussi les messages pour mettre à jour la pastille rouge en temps réel
        // Pour les messages, on ne peut pas filtrer par user_id facilement car il n'est pas dans ticket_messages
        // On garde le listener global OU on ajoute user_id dans ticket_messages (optimisation future)
        // Ici, on actualise si N'IMPORTE quel message est posté, mais fetchTickets filtrera ensuite.
        const msgChannel = supabase
            .channel('realtime:tickets_history_messages')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ticket_messages' }, () => {
                fetchTickets();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
            supabase.removeChannel(msgChannel);
        };
    }
  }, [userId]);

  const fetchTickets = async () => {
    // 1. Récupérer les tickets
    const { data: ticketsData, error } = await supabase
        .from('tickets')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Erreur chargement tickets:', error);
        setIsLoading(false);
        return;
    } 
    
    if (ticketsData) {
        // 2. Pour chaque ticket, on veut savoir si le dernier message est 'admin'
        // Optimisation: On récupère les messages récents de l'utilisateur globalement (ou par ticket)
        // Pour faire simple et robuste : On fait un fetch des derniers messages pour ces tickets.
        const ticketIds = ticketsData.map((t: any) => t.id);
        
        // On récupère TOUS les messages de ces tickets (si volume raisonnable) ou on utilise une RPC (pas dispo ici).
        // On va filtrer côté client le dernier message de chaque ticket.
        const { data: messagesData } = await supabase
            .from('ticket_messages')
            .select('ticket_id, sender_type, created_at')
            .in('ticket_id', ticketIds)
            .order('created_at', { ascending: true }); // On veut l'ordre chronologique pour trouver le dernier

        const mapped: ExtendedTicket[] = ticketsData.map((item: any) => {
            let hasUnread = false;
            
            if (messagesData) {
                // Trouver les messages de ce ticket
                const msgs = messagesData.filter((m: any) => m.ticket_id === item.id);
                if (msgs.length > 0) {
                    const lastMsg = msgs[msgs.length - 1];
                    // SI le dernier message n'est PAS du client (donc admin ou system), c'est potentiellement non lu
                    if (lastMsg.sender_type !== 'client') {
                        hasUnread = true;
                    }
                }
            }

            return {
                id: item.id,
                clientId: item.user_id,
                subject: item.subject,
                category: item.category || 'Support',
                priority: item.priority,
                status: item.status,
                date: item.date ? new Date(item.date).toLocaleDateString('fr-FR') : '-',
                lastUpdate: item.last_update || 'À l\'instant',
                description: item.description,
                hasUnreadMessages: hasUnread // Indicateur UI
            };
        });
        setTickets(mapped);
    }
    setIsLoading(false);
  };

  const handleRowClick = (ticket: Ticket) => {
      setSelectedTicket(ticket);
      setIsSlideOverOpen(true);
      // Optionnel : Marquer comme lu localement instantanément pour UX
      setTickets(prev => prev.map(t => t.id === ticket.id ? { ...t, hasUnreadMessages: false } : t));
  };

  const filteredTickets = tickets.filter(t => {
      const matchesSearch = t.subject.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            t.id.toLowerCase().includes(searchTerm.toLowerCase());
      
      let matchesFilter = true;
      if (filterStatus === 'open') matchesFilter = ['open', 'in_progress'].includes(t.status);
      if (filterStatus === 'closed') matchesFilter = ['resolved', 'closed'].includes(t.status);

      return matchesSearch && matchesFilter;
  });

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
            <div className="space-y-4">
                 {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}
            </div>
        </div>
      );
  }

  return (
    <>
    <div className="space-y-8 animate-fade-in-up pb-10">
      
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Historique des Tickets</h2>
          <p className="text-gray-500 text-sm mt-1">Suivez l'avancement de vos demandes et échangez avec le support.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
             {/* Filtres Rapides */}
             <div className="flex bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
                <button 
                    onClick={() => setFilterStatus('all')}
                    className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${filterStatus === 'all' ? 'bg-slate-100 text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    Tous
                </button>
                <button 
                    onClick={() => setFilterStatus('open')}
                    className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${filterStatus === 'open' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    En cours
                </button>
                <button 
                    onClick={() => setFilterStatus('closed')}
                    className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${filterStatus === 'closed' ? 'bg-emerald-50 text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    Terminés
                </button>
             </div>

             {/* Recherche */}
             <div className="relative w-full sm:w-64">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Search size={16} />
                </div>
                <input 
                    type="text" 
                    placeholder="Rechercher..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
                />
            </div>
        </div>
      </div>

      {/* Content */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
         {filteredTickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="p-4 bg-slate-50 rounded-full mb-4">
                    <Filter className="text-slate-300 w-8 h-8" />
                </div>
                <h3 className="text-lg font-semibold text-slate-800">Aucun ticket trouvé</h3>
                <p className="text-slate-500 text-sm mt-1">Modifiez vos filtres ou créez une nouvelle demande.</p>
            </div>
         ) : (
            <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Sujet</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider hidden sm:table-cell">ID</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Créé le</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">Priorité</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">Statut</th>
                    <th className="px-6 py-4"></th>
                </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                {filteredTickets.map((ticket) => {
                    const status = getStatusConfig(ticket.status);
                    const priorityClass = getPriorityStyle(ticket.priority);
                    
                    return (
                    <tr 
                        key={ticket.id} 
                        onClick={() => handleRowClick(ticket)}
                        className="hover:bg-indigo-50/30 transition-colors cursor-pointer group"
                    >
                        <td className="px-6 py-4">
                        <div className="flex flex-col max-w-[200px] md:max-w-xs relative">
                            {/* INDICATEUR NON LU (Point Rouge Pulsant) */}
                            {ticket.hasUnreadMessages && (
                                <div className="absolute -left-3 top-1 w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-sm" title="Nouveau message"></div>
                            )}
                            
                            <span className={`font-bold truncate transition-colors ${ticket.hasUnreadMessages ? 'text-slate-900' : 'text-slate-800'} group-hover:text-indigo-600`}>
                                {ticket.subject}
                            </span>
                            <span className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                                {ticket.category}
                                {ticket.hasUnreadMessages && (
                                    <span className="text-[10px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded-md">
                                        Nouveau message
                                    </span>
                                )}
                            </span>
                        </div>
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-400 font-mono hidden sm:table-cell">
                        #{ticket.id.slice(0, 8)}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                         {ticket.date}
                        </td>
                        <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${priorityClass}`}>
                            {ticket.priority === 'high' ? 'Haute' : ticket.priority === 'medium' ? 'Moyenne' : 'Faible'}
                        </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium justify-center min-w-[100px] ${status.bg} ${status.text}`}>
                            {status.icon}
                            {status.label}
                        </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                        <button className="p-2 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                            <ArrowUpRight size={18} />
                        </button>
                        </td>
                    </tr>
                    );
                })}
                </tbody>
            </table>
            </div>
         )}
      </div>

    </div>

    <TicketSlideOver 
        isOpen={isSlideOverOpen}
        onClose={() => setIsSlideOverOpen(false)}
        ticket={selectedTicket}
        userId={userId}
    />
    </>
  );
};

export default TicketsHistory;
