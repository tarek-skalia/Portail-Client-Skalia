
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { 
    Users, DollarSign, Activity, AlertCircle, TrendingUp, Layers, CheckCircle2, Clock, ArrowUpRight, MessageSquare, AlertTriangle, Search, Ban, Copy, Check, Filter
} from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import Skeleton from './Skeleton';
import TicketSlideOver from './TicketSlideOver';
import { Ticket } from '../types';
import { useToast } from './ToastProvider';

interface GlobalDashboardProps {
    initialTicketId?: string | null;
}

const GlobalDashboard: React.FC<GlobalDashboardProps> = ({ initialTicketId }) => {
  const toast = useToast();
  const [stats, setStats] = useState({
      totalRevenue: 0,
      monthlyRevenue: 0,
      overdueAmount: 0,
      activeClients: 0,
      totalAutomations: 0,
      openTickets: 0,
      urgentTickets: 0
  });
  
  const [revenueHistory, setRevenueHistory] = useState<any[]>([]);
  const [recentTickets, setRecentTickets] = useState<any[]>([]);
  const [watchlist, setWatchlist] = useState<any[]>([]);
  const [topDebtors, setTopDebtors] = useState<any[]>([]);
  const [groupedAlerts, setGroupedAlerts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filtres Inbox
  const [filterPriority, setFilterPriority] = useState<'all' | 'high' | 'medium' | 'low'>('all');

  // Gestion du SlideOver (Unified Inbox)
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [isSlideOverOpen, setIsSlideOverOpen] = useState(false);

  // --- OUVERTURE AUTOMATIQUE TICKET (Deep Link) ---
  useEffect(() => {
      const fetchAndOpenTicket = async () => {
          if (!initialTicketId) return;

          // On vérifie d'abord si le ticket est déjà dans la liste chargée "recentTickets"
          const existingTicket = recentTickets.find((t: any) => t.id === initialTicketId);
          if (existingTicket) {
              handleOpenTicket(existingTicket);
              return;
          }

          // Sinon, on le fetch spécifiquement (cas d'un ticket résolu ou paginé)
          const { data: ticket, error } = await supabase
            .from('tickets')
            .select('*, profiles(company_name, avatar_initials)')
            .eq('id', initialTicketId)
            .single();

          if (!error && ticket) {
              const mappedTicket = {
                  id: ticket.id,
                  clientId: ticket.user_id,
                  subject: ticket.subject,
                  category: ticket.category,
                  priority: ticket.priority,
                  status: ticket.status,
                  date: new Date(ticket.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
                  lastUpdate: ticket.last_update,
                  description: ticket.description,
                  clientName: ticket.profiles?.company_name || 'Client Inconnu',
                  avatarInitials: ticket.profiles?.avatar_initials || '?',
                  hasUnread: true // On suppose non lu si on arrive via notif
              };
              setSelectedTicket(mappedTicket);
              setIsSlideOverOpen(true);
          }
      };

      fetchAndOpenTicket();
  }, [initialTicketId, recentTickets]); // Dépendance à recentTickets importante pour le cache

  useEffect(() => {
      fetchGlobalStats();

      // Realtime listeners
      const ticketChannel = supabase.channel('global_dashboard_tickets')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, () => fetchGlobalStats())
        .subscribe();
        
      const invoiceChannel = supabase.channel('global_dashboard_invoices')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, () => fetchGlobalStats())
        .subscribe();
      
      // Écoute des nouveaux messages pour mettre à jour la pastille rouge en temps réel
      const messageChannel = supabase.channel('global_dashboard_messages')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ticket_messages' }, () => fetchGlobalStats())
        .subscribe();

      return () => { 
          supabase.removeChannel(ticketChannel); 
          supabase.removeChannel(invoiceChannel);
          supabase.removeChannel(messageChannel);
      };
  }, []);

  // Rafraichir lors de la fermeture du panneau pour mettre à jour le statut lu
  useEffect(() => {
      if (!isSlideOverOpen && !isLoading) fetchGlobalStats();
  }, [isSlideOverOpen]);

  const fetchGlobalStats = async () => {
      try {
          const now = new Date();
          const currentMonth = now.getMonth();
          const currentYear = now.getFullYear();

          // 1. REVENUE & CASHFLOW & HISTORY
          const { data: invoices } = await supabase.from('invoices').select('amount, status, issue_date, user_id');
          
          let revenueTotal = 0;
          let revenueMonth = 0;
          let overdue = 0;
          const monthlyRevenueMap = new Map<string, number>();
          const debtorsMap = new Map<string, number>();

          // Init 6 derniers mois pour le graph
          for (let i = 5; i >= 0; i--) {
              const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
              const key = `${d.getFullYear()}-${d.getMonth()}`; // Clé unique par mois
              monthlyRevenueMap.set(key, 0);
          }

          invoices?.forEach(inv => {
              const invDate = new Date(inv.issue_date);
              const monthKey = `${invDate.getFullYear()}-${invDate.getMonth()}`;

              // CA Encaissé
              if (inv.status === 'paid') {
                  revenueTotal += inv.amount;
                  
                  if (invDate.getMonth() === currentMonth && invDate.getFullYear() === currentYear) {
                      revenueMonth += inv.amount;
                  }

                  // Historique pour Sparkline
                  if (monthlyRevenueMap.has(monthKey)) {
                      monthlyRevenueMap.set(monthKey, monthlyRevenueMap.get(monthKey)! + inv.amount);
                  }
              } 
              // Impayés (Cash Collection)
              else if (inv.status === 'overdue' || inv.status === 'pending') {
                  overdue += inv.amount;
                  // Grouper par client pour Top Débiteurs
                  if (inv.user_id) {
                      debtorsMap.set(inv.user_id, (debtorsMap.get(inv.user_id) || 0) + inv.amount);
                  }
              }
          });

          // Formatage Sparkline Data
          const chartData = Array.from(monthlyRevenueMap.entries()).map(([key, value]) => ({
              name: key,
              value: value
          }));

          // 2. CLIENTS & WATCHLIST DATA
          const { data: profiles } = await supabase.from('profiles').select('id, company_name, full_name, avatar_initials, email').neq('role', 'admin');
          const clientsCount = profiles?.length || 0;

          // 3. AUTOMATIONS
          const { count: autoCount } = await supabase.from('automations').select('*', { count: 'exact', head: true }).eq('status', 'active');

          // 4. TICKETS (Unified Inbox Data) - TRI CHRONOLOGIQUE
          const { data: tickets } = await supabase
            .from('tickets')
            .select('*, profiles(company_name, avatar_initials)')
            .in('status', ['open', 'in_progress']) // Seuls les actifs
            .order('created_at', { ascending: false }); // Du plus récent au plus ancien

          // Calcul KPIs Tickets
          const openCount = tickets?.length || 0;
          const urgentCount = tickets?.filter(t => t.priority === 'high').length || 0;

          // 4b. FETCH MESSAGES POUR DETECTER NON-LUS
          // On récupère les messages liés à ces tickets pour savoir qui a parlé en dernier
          let messagesMap = new Map<string, {sender: string, date: string}>(); 
          
          if (tickets && tickets.length > 0) {
              const ticketIds = tickets.map(t => t.id);
              const { data: messages } = await supabase
                  .from('ticket_messages')
                  .select('ticket_id, sender_type, created_at')
                  .in('ticket_id', ticketIds)
                  .order('created_at', { ascending: true }); // On veut l'historique chrono

              if (messages) {
                  messages.forEach(msg => {
                      messagesMap.set(msg.ticket_id, { sender: msg.sender_type, date: msg.created_at });
                  });
              }
          }

          // 5. ALERTS (Logs en erreur - Groupés)
          const { data: errorLogs } = await supabase
            .from('automation_logs')
            .select('*, automations(name, user_id)')
            .eq('status', 'error')
            .gte('created_at', new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()) // 24h
            .order('created_at', { ascending: false });

          // Grouping des erreurs pour réduire le bruit
          const groupedErrorsMap = new Map<string, any>();
          errorLogs?.forEach(log => {
              const autoName = log.automations?.name || 'Système';
              if (groupedErrorsMap.has(autoName)) {
                  groupedErrorsMap.get(autoName).count++;
              } else {
                  groupedErrorsMap.set(autoName, {
                      id: log.id,
                      name: autoName,
                      userId: log.automations?.user_id,
                      count: 1,
                      lastTime: log.created_at
                  });
              }
          });
          
          // Enrichissement avec noms de société pour le monitoring
          let finalAlerts = Array.from(groupedErrorsMap.values());
          if (finalAlerts.length > 0 && profiles) {
              finalAlerts = finalAlerts.map(alert => {
                  const company = profiles.find(p => p.id === alert.userId)?.company_name || 'Inconnu';
                  return { ...alert, companyName: company };
              });
          }

          // 6. GENERATION WATCHLIST (Clients à Risque) & TOP DEBTORS
          // Score de risque : 1 ticket urgent = 3 pts, 1 ticket normal = 1 pt, 100€ dette = 1 pt
          const riskMap = new Map<string, number>();
          
          tickets?.forEach(t => {
              const points = t.priority === 'high' ? 3 : 1;
              riskMap.set(t.user_id, (riskMap.get(t.user_id) || 0) + points);
          });

          const enrichedDebtors: any[] = [];
          debtorsMap.forEach((amount, userId) => {
              // Ajout score dette (1 pt par 100€)
              riskMap.set(userId, (riskMap.get(userId) || 0) + Math.floor(amount / 100));
              
              // Préparation liste débiteurs
              const profile = profiles?.find(p => p.id === userId);
              if (profile && amount > 0) {
                  enrichedDebtors.push({
                      id: userId,
                      company: profile.company_name,
                      email: profile.email,
                      amount: amount
                  });
              }
          });

          // Trie et limite Watchlist
          const riskyClients = Array.from(riskMap.entries())
              .sort((a, b) => b[1] - a[1]) // Plus gros score en premier
              .slice(0, 3) // Top 3
              .map(([userId, score]) => {
                  const profile = profiles?.find(p => p.id === userId);
                  if (!profile) return null;
                  
                  // Détails du risque
                  const clientTickets = tickets?.filter(t => t.user_id === userId).length || 0;
                  const clientDebt = debtorsMap.get(userId) || 0;
                  
                  return {
                      ...profile,
                      riskScore: score,
                      ticketCount: clientTickets,
                      debtAmount: clientDebt
                  };
              })
              .filter(Boolean);

          setStats({
              totalRevenue: revenueTotal,
              monthlyRevenue: revenueMonth,
              overdueAmount: overdue,
              activeClients: clientsCount || 0,
              totalAutomations: autoCount || 0,
              openTickets: openCount,
              urgentTickets: urgentCount
          });
          
          const mappedTickets = tickets?.map((t: any) => {
              // Détermination du statut "Non lu par l'admin"
              // Côté Admin, c'est non lu si le dernier message est du client ET non lu localement
              const lastMsgData = messagesMap.get(t.id);
              let hasUnread = false;

              if (lastMsgData) {
                  const lastReadStr = localStorage.getItem(`skalia_read_${t.id}`);
                  const lastReadDate = lastReadStr ? new Date(lastReadStr) : new Date(0);
                  const lastMsgDate = new Date(lastMsgData.date);

                  if (lastMsgData.sender === 'client' && lastMsgDate > lastReadDate) {
                      hasUnread = true;
                  }
              }

              return {
                  id: t.id,
                  clientId: t.user_id,
                  subject: t.subject,
                  category: t.category,
                  priority: t.priority,
                  status: t.status,
                  date: new Date(t.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }), // Date Création
                  lastUpdate: t.last_update,
                  description: t.description,
                  clientName: t.profiles?.company_name || 'Client Inconnu',
                  avatarInitials: t.profiles?.avatar_initials || '?',
                  hasUnread: hasUnread
              };
          }) || [];

          setRevenueHistory(chartData);
          setRecentTickets(mappedTickets); 
          setWatchlist(riskyClients);
          setTopDebtors(enrichedDebtors.sort((a, b) => b.amount - a.amount).slice(0, 3));
          setGroupedAlerts(finalAlerts);

      } catch (error) {
          console.error("Global stats error", error);
      } finally {
          setIsLoading(false);
      }
  };

  const handleOpenTicket = (ticket: any) => {
      setSelectedTicket(ticket);
      
      // Mark as read locally immediately
      localStorage.setItem(`skalia_read_${ticket.id}`, new Date().toISOString());
      setRecentTickets(prev => prev.map(t => t.id === ticket.id ? { ...t, hasUnread: false } : t));
      
      setIsSlideOverOpen(true);
  };

  const handleQuickResolve = async (e: React.MouseEvent, ticketId: string) => {
      e.stopPropagation();
      try {
          await supabase.from('tickets').update({ status: 'resolved' }).eq('id', ticketId);
          toast.success("Ticket résolu", "Le ticket a été archivé.");
          fetchGlobalStats(); // Refresh immédiat
      } catch (err) {
          toast.error("Erreur", "Impossible de mettre à jour.");
      }
  };

  const handleCopyEmail = (e: React.MouseEvent, email: string) => {
      e.stopPropagation();
      navigator.clipboard.writeText(email);
      toast.success("Copié", "Email copié dans le presse-papier.");
  };

  // Filtrage local des tickets
  const filteredTickets = recentTickets.filter(t => 
      filterPriority === 'all' || t.priority === filterPriority
  );

  if (isLoading) return <div className="p-8"><Skeleton className="h-96 w-full" /></div>;

  return (
    <>
    <div className="space-y-6 animate-fade-in-up pb-10">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-end gap-4">
            <div>
                <h1 className="text-3xl font-extrabold text-slate-900">Tour de Contrôle</h1>
                <p className="text-slate-500 mt-1">Vue d'ensemble opérationnelle et financière de l'agence.</p>
            </div>
            <div className="flex gap-3">
                <div className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl shadow-sm text-sm font-bold flex items-center gap-2">
                    <Clock size={16} className="text-indigo-500" />
                    {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </div>
                <div className="px-4 py-2 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-200 text-sm font-bold flex items-center gap-2">
                    <Activity size={18} className="animate-pulse" />
                    Systèmes OK
                </div>
            </div>
        </div>

        {/* --- BLOC KPI FINANCIERS & OPERATONNELS --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            
            {/* 1. MRR + SPARKLINE */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-indigo-300 transition-colors relative overflow-hidden">
                <div className="flex justify-between items-start mb-2 relative z-10">
                    <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                        <DollarSign size={20} />
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide bg-slate-50 px-2 py-1 rounded-md">Ce mois-ci</span>
                </div>
                <div className="relative z-10">
                    <span className="text-2xl font-extrabold text-slate-900">
                        {stats.monthlyRevenue.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
                    </span>
                    <p className="text-xs font-bold text-slate-400 mt-1">CA Encaissé (MRR)</p>
                </div>
                {/* SPARKLINE BACKGROUND */}
                <div className="absolute bottom-0 left-0 right-0 h-16 opacity-20 pointer-events-none">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={revenueHistory}>
                            <Line type="monotone" dataKey="value" stroke="#10b981" strokeWidth={3} dot={false} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* 2. CASH COLLECTION */}
            <div className={`p-5 rounded-2xl border shadow-sm flex flex-col justify-between transition-colors ${stats.overdueAmount > 0 ? 'bg-orange-50 border-orange-200' : 'bg-white border-slate-200'}`}>
                <div className="flex justify-between items-start mb-2">
                    <div className={`p-2.5 rounded-xl ${stats.overdueAmount > 0 ? 'bg-white text-orange-600' : 'bg-slate-50 text-slate-600'}`}>
                        <AlertTriangle size={20} />
                    </div>
                    {stats.overdueAmount > 0 && <span className="animate-pulse w-2 h-2 bg-orange-500 rounded-full"></span>}
                </div>
                <div>
                    <span className={`text-2xl font-extrabold ${stats.overdueAmount > 0 ? 'text-orange-700' : 'text-slate-900'}`}>
                        {stats.overdueAmount.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
                    </span>
                    <p className={`text-xs font-bold mt-1 ${stats.overdueAmount > 0 ? 'text-orange-600/80' : 'text-slate-400'}`}>
                        Total à recouvrer
                    </p>
                </div>
            </div>

            {/* 3. SANTÉ SUPPORT */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-indigo-300 transition-colors">
                <div className="flex justify-between items-start mb-2">
                    <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                        <MessageSquare size={20} />
                    </div>
                    {stats.urgentTickets > 0 && (
                        <span className="text-[10px] font-bold text-white bg-red-500 px-2 py-0.5 rounded-full shadow-sm animate-pulse">
                            {stats.urgentTickets} Urgents
                        </span>
                    )}
                </div>
                <div>
                    <span className="text-2xl font-extrabold text-slate-900">{stats.openTickets}</span>
                    <p className="text-xs font-bold text-slate-400 mt-1">Tickets en cours</p>
                </div>
            </div>

            {/* 4. CLIENTS */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-indigo-300 transition-colors">
                <div className="flex justify-between items-start mb-2">
                    <div className="p-2.5 bg-violet-50 text-violet-600 rounded-xl">
                        <Users size={20} />
                    </div>
                </div>
                <div>
                    <span className="text-2xl font-extrabold text-slate-900">{stats.activeClients}</span>
                    <p className="text-xs font-bold text-slate-400 mt-1">Clients Actifs</p>
                </div>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-auto lg:h-[600px]">
            
            {/* COLONNE GAUCHE : UNIFIED INBOX (2/3) */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center shrink-0">
                    <div>
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            <MessageSquare size={18} className="text-indigo-500" /> Unified Inbox
                        </h3>
                        <p className="text-[10px] text-slate-400 mt-0.5">Trié du plus récent au plus ancien</p>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        {/* Filtre Priorité */}
                        <div className="relative group">
                            <select 
                                value={filterPriority} 
                                onChange={(e) => setFilterPriority(e.target.value as any)}
                                className="appearance-none bg-white border border-slate-200 text-xs font-bold text-slate-600 rounded-lg py-1.5 pl-3 pr-8 focus:outline-none focus:border-indigo-300 shadow-sm cursor-pointer hover:bg-slate-50"
                            >
                                <option value="all">Priorité : Toutes</option>
                                <option value="high">Urgent 🔴</option>
                                <option value="medium">Moyenne 🟠</option>
                                <option value="low">Faible 🟢</option>
                            </select>
                            <Filter size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>

                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-white border border-slate-200 px-2 py-1.5 rounded-lg shadow-sm">
                            {filteredTickets.length}
                        </span>
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                    {filteredTickets.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400">
                            <CheckCircle2 size={48} className="text-emerald-100 mb-4" />
                            <p className="font-medium text-slate-600">Inbox Zéro !</p>
                            <p className="text-xs mt-1">Aucun ticket correspondant aux filtres.</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {filteredTickets.map((ticket: any) => (
                                <div 
                                    key={ticket.id} 
                                    onClick={() => handleOpenTicket(ticket)}
                                    className="group relative p-4 bg-white border border-slate-100 hover:border-indigo-300 hover:shadow-md rounded-xl transition-all cursor-pointer flex items-center justify-between gap-4 overflow-hidden"
                                >
                                    {/* Action Rapide au Survol (Slide In) */}
                                    <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-white via-white to-transparent z-10 flex items-center justify-end pr-4 translate-x-full group-hover:translate-x-0 transition-transform duration-200">
                                        <button 
                                            onClick={(e) => handleQuickResolve(e, ticket.id)}
                                            className="p-2 bg-emerald-100 text-emerald-600 rounded-lg hover:bg-emerald-200 hover:scale-110 transition-all shadow-sm"
                                            title="Marquer comme résolu"
                                        >
                                            <CheckCircle2 size={20} />
                                        </button>
                                    </div>

                                    <div className="flex items-center gap-4 min-w-0 relative">
                                        {/* INDICATEUR NON LU (PASTILLE ROUGE) */}
                                        {ticket.hasUnread && (
                                            <div className="absolute -left-2 top-0 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shadow-sm z-20 border border-white" title="Message non lu"></div>
                                        )}

                                        {/* Avatar Client */}
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0">
                                            {ticket.avatarInitials}
                                        </div>
                                        
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <h4 className={`text-sm truncate transition-colors ${ticket.hasUnread ? 'font-black text-slate-900' : 'font-bold text-slate-800'} group-hover:text-indigo-600`}>
                                                    {ticket.subject}
                                                </h4>
                                                {/* Badge Priorité Explicite */}
                                                {ticket.priority === 'high' ? (
                                                    <span className="shrink-0 px-1.5 py-0.5 rounded bg-red-100 text-red-600 text-[9px] font-bold uppercase tracking-wide border border-red-200">
                                                        Urgent
                                                    </span>
                                                ) : ticket.priority === 'medium' ? (
                                                    <span className="shrink-0 px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 text-[9px] font-bold uppercase tracking-wide border border-amber-100">
                                                        Moyen
                                                    </span>
                                                ) : null}
                                            </div>
                                            <p className="text-xs text-slate-500 font-medium truncate">
                                                {ticket.clientName} • <span className="text-slate-400 font-normal">{ticket.category}</span>
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-6 shrink-0 group-hover:opacity-20 transition-opacity duration-200">
                                        <div className="text-right hidden sm:block">
                                            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Créé le</p>
                                            <p className="text-xs font-bold text-slate-700">{ticket.date}</p>
                                        </div>
                                        
                                        <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${
                                            ticket.status === 'open' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                            'bg-purple-50 text-purple-600 border-purple-100'
                                        }`}>
                                            {ticket.status === 'open' ? 'À traiter' : 'En cours'}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* COLONNE DROITE : WIDGETS EMPILÉS */}
            <div className="flex flex-col gap-5 h-full">
                
                {/* 1. WATCHLIST (Clients à Risque) */}
                <div className="flex-1 bg-white rounded-2xl border border-red-100 shadow-sm overflow-hidden flex flex-col min-h-[200px]">
                    <div className="px-5 py-3 border-b border-red-50 bg-red-50/30 flex justify-between items-center shrink-0">
                        <h3 className="font-bold text-red-700 flex items-center gap-2 text-sm">
                            <AlertTriangle size={16} /> Watchlist (Risque Churn)
                        </h3>
                    </div>
                    <div className="flex-1 overflow-y-auto p-0 custom-scrollbar">
                        {watchlist.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-slate-400 p-4 text-center">
                                <CheckCircle2 size={24} className="text-emerald-300 mb-1" />
                                <p className="text-xs">Aucun client à risque critique.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-red-50">
                                {watchlist.map((client: any) => (
                                    <div key={client.id} className="p-3 flex items-center justify-between hover:bg-red-50/20 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-white border border-red-100 text-red-500 font-bold text-xs flex items-center justify-center shadow-sm">
                                                {client.avatar_initials}
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-slate-800">{client.company_name}</p>
                                                <div className="flex gap-2 text-[9px] font-bold text-slate-500">
                                                    {client.ticketCount > 0 && <span className="text-red-500">{client.ticketCount} tickets</span>}
                                                    {client.debtAmount > 0 && <span className="text-orange-500">{client.debtAmount}€ du</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-[10px] font-bold text-red-400 bg-red-50 px-2 py-1 rounded-md">
                                            Score: {client.riskScore}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* 2. CASH COLLECTION DETAIL */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[150px]">
                    <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center shrink-0">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                            <Ban size={16} className="text-orange-500" /> Top Débiteurs
                        </h3>
                    </div>
                    <div className="p-0 overflow-y-auto custom-scrollbar">
                        {topDebtors.length === 0 ? (
                            <div className="p-4 text-center text-xs text-slate-400 italic">Aucun impayé.</div>
                        ) : (
                            <div className="divide-y divide-slate-50">
                                {topDebtors.map((d: any) => (
                                    <div key={d.id} className="p-3 flex items-center justify-between hover:bg-orange-50/10 group">
                                        <div className="min-w-0">
                                            <p className="text-xs font-bold text-slate-700 truncate">{d.company}</p>
                                            <p className="text-[10px] text-orange-600 font-medium">Doit {d.amount}€</p>
                                        </div>
                                        <button 
                                            onClick={(e) => handleCopyEmail(e, d.email)}
                                            className="p-1.5 text-slate-300 hover:text-indigo-600 hover:bg-slate-100 rounded-md opacity-0 group-hover:opacity-100 transition-all"
                                            title="Copier email"
                                        >
                                            <Copy size={12} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* 3. MONITORING (GROUPÉ) */}
                <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[150px]">
                    <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center shrink-0">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                            <Activity size={16} className="text-slate-400" /> Erreurs (24h)
                        </h3>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-0">
                        {groupedAlerts.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-slate-400 p-4 text-center">
                                <Check size={20} className="text-emerald-300 mb-1" />
                                <p className="text-xs">Systèmes stables.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-50">
                                {groupedAlerts.map((alert: any) => (
                                    <div key={alert.id} className="p-3 hover:bg-red-50/10 transition-colors flex items-start gap-2">
                                        <div className="mt-0.5 shrink-0">
                                            <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-baseline">
                                                <p className="text-xs font-bold text-slate-700 truncate">{alert.name}</p>
                                                {alert.count > 1 && (
                                                    <span className="text-[9px] font-bold text-white bg-red-500 px-1.5 rounded-full">x{alert.count}</span>
                                                )}
                                            </div>
                                            <p className="text-[10px] text-slate-400 truncate">{alert.companyName}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

            </div>

        </div>
    </div>

    {/* INTEGRATION SLIDEOVER POUR REPONSE RAPIDE */}
    <TicketSlideOver 
        isOpen={isSlideOverOpen}
        onClose={() => {
            setIsSlideOverOpen(false);
            fetchGlobalStats(); // Refresh stats on close to update read status
        }}
        ticket={selectedTicket}
        userId={selectedTicket?.clientId} // Important pour lier les uploads au bon dossier client
    />
    </>
  );
};

export default GlobalDashboard;
