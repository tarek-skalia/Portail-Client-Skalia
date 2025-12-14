
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { 
    Users, DollarSign, Activity, AlertCircle, TrendingUp, Layers, CheckCircle2 
} from 'lucide-react';
import Skeleton from './Skeleton';

const GlobalDashboard: React.FC = () => {
  const [stats, setStats] = useState({
      totalRevenue: 0,
      activeClients: 0,
      totalAutomations: 0,
      openTickets: 0,
      systemHealth: 100
  });
  const [recentTickets, setRecentTickets] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
      fetchGlobalStats();
  }, []);

  const fetchGlobalStats = async () => {
      try {
          // 1. REVENUE (Somme factures payées)
          const { data: invoices } = await supabase.from('invoices').select('amount').eq('status', 'paid');
          const revenue = invoices?.reduce((acc, inv) => acc + inv.amount, 0) || 0;

          // 2. CLIENTS
          const { count: clientsCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).neq('role', 'admin');

          // 3. AUTOMATIONS
          const { count: autoCount } = await supabase.from('automations').select('*', { count: 'exact', head: true }).eq('status', 'active');

          // 4. TICKETS OUVERTS
          const { count: ticketsCount } = await supabase.from('tickets').select('*', { count: 'exact', head: true }).in('status', ['open', 'in_progress']);

          // 5. RECENTS TICKETS (Avec info client)
          const { data: tickets } = await supabase
            .from('tickets')
            .select('*, profiles(company_name)')
            .in('status', ['open', 'in_progress'])
            .order('created_at', { ascending: false })
            .limit(5);

          // 6. ALERTS (Logs en erreur récents)
          const { data: errorLogs } = await supabase
            .from('automation_logs')
            .select('*, automations(name, user_id)')
            .eq('status', 'error')
            .order('created_at', { ascending: false })
            .limit(5);

          // 7. Enrichissement des logs avec le nom de l'entreprise (nécessite un fetch séparé ou une vue, ici on simplifie)
          let enrichedAlerts: any[] = [];
          if (errorLogs) {
              const userIds = [...new Set(errorLogs.map(l => l.automations?.user_id).filter(Boolean))];
              if (userIds.length > 0) {
                  const { data: profiles } = await supabase.from('profiles').select('id, company_name').in('id', userIds);
                  enrichedAlerts = errorLogs.map(log => {
                      const company = profiles?.find(p => p.id === log.automations?.user_id)?.company_name || 'Inconnu';
                      return { ...log, companyName: company };
                  });
              } else {
                  enrichedAlerts = errorLogs;
              }
          }

          setStats({
              totalRevenue: revenue,
              activeClients: clientsCount || 0,
              totalAutomations: autoCount || 0,
              openTickets: ticketsCount || 0,
              systemHealth: 98 // Valeur simulée ou calculée
          });
          setRecentTickets(tickets || []);
          setAlerts(enrichedAlerts);

      } catch (error) {
          console.error("Global stats error", error);
      } finally {
          setIsLoading(false);
      }
  };

  if (isLoading) return <div className="p-8"><Skeleton className="h-96 w-full" /></div>;

  return (
    <div className="space-y-8 animate-fade-in-up pb-10">
        
        <div className="flex justify-between items-end">
            <div>
                <h1 className="text-3xl font-extrabold text-slate-900">Vue Globale Agence</h1>
                <p className="text-slate-500 mt-1">Pilotage centralisé de tous les clients Skalia.</p>
            </div>
            <div className="px-4 py-2 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-200 text-sm font-bold flex items-center gap-2">
                <Activity size={18} className="animate-pulse" />
                Live Monitoring
            </div>
        </div>

        {/* KPI CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                        <DollarSign size={24} />
                    </div>
                    <span className="flex items-center text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                        <TrendingUp size={12} className="mr-1" /> +12%
                    </span>
                </div>
                <div>
                    <span className="text-3xl font-extrabold text-slate-900">
                        {stats.totalRevenue.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
                    </span>
                    <p className="text-xs font-bold text-slate-400 uppercase mt-1">Revenu Total Encaissé</p>
                </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                        <Users size={24} />
                    </div>
                </div>
                <div>
                    <span className="text-3xl font-extrabold text-slate-900">{stats.activeClients}</span>
                    <p className="text-xs font-bold text-slate-400 uppercase mt-1">Clients Actifs</p>
                </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-violet-50 text-violet-600 rounded-xl">
                        <Layers size={24} />
                    </div>
                </div>
                <div>
                    <span className="text-3xl font-extrabold text-slate-900">{stats.totalAutomations}</span>
                    <p className="text-xs font-bold text-slate-400 uppercase mt-1">Automatisations en Prod</p>
                </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between relative overflow-hidden">
                {stats.openTickets > 0 && <div className="absolute top-0 right-0 w-16 h-16 bg-red-500/10 rounded-bl-full"></div>}
                <div className="flex justify-between items-start mb-4 relative z-10">
                    <div className={`p-3 rounded-xl ${stats.openTickets > 0 ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-600'}`}>
                        <AlertCircle size={24} />
                    </div>
                </div>
                <div className="relative z-10">
                    <span className={`text-3xl font-extrabold ${stats.openTickets > 0 ? 'text-red-600' : 'text-slate-900'}`}>
                        {stats.openTickets}
                    </span>
                    <p className="text-xs font-bold text-slate-400 uppercase mt-1">Tickets Ouverts</p>
                </div>
            </div>
        </div>

        {/* ALERTS & TICKETS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* ALERTS SYSTEMES */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <Activity size={18} className="text-red-500" /> Alertes Critiques
                    </h3>
                    <span className="text-xs font-medium text-slate-500">{alerts.length} récentes</span>
                </div>
                <div className="flex-1 p-0">
                    {alerts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                            <CheckCircle2 size={32} className="text-emerald-300 mb-2" />
                            <p className="text-sm">Aucune alerte critique. Tout roule.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-50">
                            {alerts.map((log: any) => (
                                <div key={log.id} className="p-4 hover:bg-red-50/30 transition-colors flex items-start gap-3">
                                    <div className="mt-1">
                                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between">
                                            <p className="text-sm font-bold text-slate-800">{log.companyName}</p>
                                            <span className="text-[10px] text-slate-400">
                                                {new Date(log.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-600 mt-0.5 font-medium">{log.automations?.name || 'Système'}</p>
                                        <p className="text-xs text-red-500 mt-1 italic">Erreur d'exécution détectée</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* DERNIERS TICKETS */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <AlertCircle size={18} className="text-indigo-500" /> Support Client
                    </h3>
                    <button className="text-xs font-bold text-indigo-600 hover:underline">Voir tout</button>
                </div>
                <div className="flex-1 p-0">
                    {recentTickets.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                            <p className="text-sm">Aucun ticket en attente.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-50">
                            {recentTickets.map((ticket: any) => (
                                <div key={ticket.id} className="p-4 hover:bg-slate-50 transition-colors group cursor-pointer">
                                    <div className="flex justify-between items-start mb-1">
                                        <div className="flex items-center gap-2">
                                            <span className={`w-1.5 h-1.5 rounded-full ${ticket.status === 'open' ? 'bg-blue-500' : 'bg-purple-500'}`}></span>
                                            <span className="text-xs font-bold uppercase text-slate-500 tracking-wide">
                                                {ticket.profiles?.company_name || 'Client'}
                                            </span>
                                        </div>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                                            ticket.priority === 'high' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-slate-50 text-slate-500 border-slate-100'
                                        }`}>
                                            {ticket.priority === 'high' ? 'URGENT' : 'Normal'}
                                        </span>
                                    </div>
                                    <p className="text-sm font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">
                                        {ticket.subject}
                                    </p>
                                    <p className="text-xs text-slate-400 mt-1">
                                        Dernière maj: {ticket.last_update}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

        </div>
    </div>
  );
};

export default GlobalDashboard;
