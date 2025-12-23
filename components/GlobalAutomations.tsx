
import React, { useEffect, useState } from 'react';
import { Automation } from '../types';
import { supabase } from '../lib/supabase';
import { useAdmin } from './AdminContext';
import { Zap, Activity, AlertTriangle, CheckCircle2, PauseCircle, XCircle, Search, Plus, Edit3, Trash2, Cpu, Server, Play, Clock, ArrowRight, Users } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';
import Skeleton from './Skeleton';
import AutomationSlideOver from './AutomationSlideOver';
import Modal from './ui/Modal';
import AutomationForm from './forms/AutomationForm';
import { useToast } from './ToastProvider';

// Extension locale pour les stats graphiques
interface AutomationWithStats extends Automation {
    history: { value: number }[];
    lastRunDate: string | null;
}

const GlobalAutomations: React.FC = () => {
  const { clients } = useAdmin();
  const toast = useToast();
  const [automations, setAutomations] = useState<AutomationWithStats[]>([]);
  const [allLogs, setAllLogs] = useState<any[]>([]); // Store all logs to recalc stats
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // CLIENT FILTER
  const [selectedClientId, setSelectedClientId] = useState<string>('all');

  // UI State
  const [selectedAutomation, setSelectedAutomation] = useState<Automation | null>(null);
  const [isSlideOverOpen, setIsSlideOverOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState<Automation | null>(null);
  
  // Delete
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchGlobalAutomations();
    
    const channel = supabase.channel('global_automations_realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'automations' }, () => fetchGlobalAutomations())
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'automation_logs' }, () => fetchGlobalAutomations())
        .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchGlobalAutomations = async () => {
    try {
        // 1. Récupération des Automatisations
        const { data: automationsData, error } = await supabase
            .from('automations')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        // 2. Récupération des Logs (30 jours pour KPI globaux, mais on va filtrer pour les sparklines)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const { data: logsData } = await supabase
            .from('automation_logs')
            .select('status, automation_id, created_at')
            .gte('created_at', thirtyDaysAgo.toISOString())
            .order('created_at', { ascending: true }); // Important pour l'ordre chronologique des graphs

        setAllLogs(logsData || []);

        // --- PREPARATION SPARKLINES (7 derniers jours) ---
        const last7Days = Array.from({length: 7}, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (6 - i));
            return d.toISOString().split('T')[0];
        });

        // Mapping
        const mapped: AutomationWithStats[] = (automationsData || []).map((item: any) => {
            const itemLogs = logsData?.filter(l => l.automation_id === item.id) || [];
            
            // Sparkline Data
            const history = last7Days.map(dateKey => ({
                value: itemLogs.filter(l => l.created_at.startsWith(dateKey)).length
            }));

            // Last Run
            const lastLog = itemLogs.length > 0 ? itemLogs[itemLogs.length - 1] : null;
            
            return {
                id: item.id,
                clientId: item.user_id,
                name: item.name,
                description: item.description || '',
                status: item.status,
                lastRun: 'Voir détails', // Placeholder
                runsThisMonth: 0, // Placeholder
                toolIcons: item.tool_icons || [],
                pipelineSteps: item.pipeline_steps || [],
                userGuide: item.user_guide || '',
                history: history,
                lastRunDate: lastLog ? lastLog.created_at : null
            };
        });

        setAutomations(mapped);
    } catch (e) {
        console.error("Global automations error:", e);
    } finally {
        setIsLoading(false);
    }
  };

  const getClientName = (clientId: string) => {
      const client = clients.find(c => c.id === clientId);
      return client ? client.company : 'Client Inconnu';
  };

  const executeDelete = async () => {
      if (!deleteId) return;
      setIsDeleting(true);
      try {
          await supabase.from('automation_logs').delete().eq('automation_id', deleteId);
          await supabase.from('automations').delete().eq('id', deleteId);
          toast.success("Supprimé", "L'automatisation a été retirée.");
          fetchGlobalAutomations();
      } catch (err) {
          toast.error("Erreur", "Impossible de supprimer.");
      } finally {
          setIsDeleting(false);
          setDeleteId(null);
      }
  };

  // --- FILTRAGE AUTOMATIONS & LOGS ---
  const filteredAutomations = automations.filter(auto => {
      const matchesClient = selectedClientId === 'all' || auto.clientId === selectedClientId;
      const matchesSearch = auto.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            getClientName(auto.clientId).toLowerCase().includes(searchTerm.toLowerCase());
      return matchesClient && matchesSearch;
  });

  // Calcul KPI sur la base des automations FILTRÉES
  const getFilteredLogs = () => {
      if (selectedClientId === 'all') return allLogs;
      // On récupère les IDs des automations affichées
      const displayedIds = filteredAutomations.map(a => a.id);
      return allLogs.filter(l => displayedIds.includes(l.automation_id));
  };

  const currentLogs = getFilteredLogs();
  
  const totalRuns = currentLogs.length || 0;
  const errorRuns = currentLogs.filter(l => l.status === 'error').length || 0;
  const uptime = totalRuns > 0 ? ((totalRuns - errorRuns) / totalRuns) * 100 : 100;
  
  const activeCount = filteredAutomations.filter(a => a.status === 'active').length || 0;
  const criticalErrors = filteredAutomations.filter(a => ['error', 'maintenance'].includes(a.status)).length || 0;

  const stats = {
      uptime: Math.round(uptime),
      criticalErrors: criticalErrors,
      totalRuns: totalRuns,
      activeWorkflows: activeCount
  };

  const getStatusColor = (status: string) => {
      switch(status) {
          case 'active': return 'text-emerald-500 bg-emerald-50 border-emerald-100 shadow-[0_0_10px_rgba(16,185,129,0.15)]';
          case 'error': return 'text-red-500 bg-red-50 border-red-100 shadow-[0_0_10px_rgba(239,68,68,0.15)]';
          case 'maintenance': return 'text-amber-500 bg-amber-50 border-amber-100';
          default: return 'text-slate-400 bg-slate-50 border-slate-100';
      }
  };

  const getCardStyle = (status: string) => {
      if (status === 'active') return 'border-emerald-200/60 shadow-[0_0_20px_rgba(16,185,129,0.05)] hover:border-emerald-300';
      if (status === 'error') return 'border-red-200 bg-red-50/10 shadow-[0_0_20px_rgba(239,68,68,0.05)] hover:border-red-300';
      return 'border-slate-200 hover:border-indigo-300';
  };

  const getTimeAgo = (dateStr: string | null) => {
      if (!dateStr) return 'Jamais';
      const diff = Math.floor((new Date().getTime() - new Date(dateStr).getTime()) / 60000); // minutes
      if (diff < 1) return 'À l\'instant';
      if (diff < 60) return `${diff} min`;
      if (diff < 1440) return `${Math.floor(diff/60)} h`;
      return `${Math.floor(diff/1440)} j`;
  };

  if (isLoading) return <div className="p-8"><Skeleton className="h-96 w-full rounded-2xl" /></div>;

  return (
    <>
    <div className="space-y-6 animate-fade-in-up pb-10">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-end gap-4">
            <div>
                <h1 className="text-3xl font-extrabold text-slate-900">Systèmes & Automatisations</h1>
                <p className="text-slate-500 mt-1">Monitoring temps réel de l'infrastructure.</p>
            </div>

            {/* CLIENT FILTER */}
            <div className="relative group">
                <select 
                    value={selectedClientId}
                    onChange={(e) => setSelectedClientId(e.target.value)}
                    className="appearance-none bg-white border border-slate-200 text-slate-700 font-bold py-2.5 pl-10 pr-10 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer hover:border-indigo-300 transition-colors"
                >
                    <option value="all">Tous les clients</option>
                    {clients.filter(c => c.role !== 'admin').map(client => (
                        <option key={client.id} value={client.id}>{client.company}</option>
                    ))}
                </select>
                <Users size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none border-l border-slate-200 pl-2">
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                </div>
            </div>
        </div>

        {/* --- KPIs SECTION --- */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between group relative cursor-help">
                <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Santé Infrastructure</p>
                    <p className={`text-2xl font-extrabold ${stats.uptime < 98 ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {stats.uptime}%
                    </p>
                </div>
                <div className={`p-2.5 rounded-lg ${stats.uptime < 98 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                    <Server size={20} />
                </div>
                {/* Tooltip */}
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 p-2 bg-slate-800 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-50 text-center shadow-xl">
                    Taux de réussite des exécutions (hors erreurs) sur les 30 derniers jours.
                </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between group relative cursor-help">
                <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Alertes Critiques</p>
                    <p className={`text-2xl font-extrabold ${stats.criticalErrors > 0 ? 'text-red-600' : 'text-slate-700'}`}>
                        {stats.criticalErrors}
                    </p>
                </div>
                <div className={`p-2.5 rounded-lg ${stats.criticalErrors > 0 ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-400'}`}>
                    <AlertTriangle size={20} />
                </div>
                {/* Tooltip */}
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 p-2 bg-slate-800 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-50 text-center shadow-xl">
                    Nombre de workflows actuellement en statut "Erreur" ou "Maintenance".
                </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between group relative cursor-help">
                <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Volume Traité (30j)</p>
                    <p className="text-2xl font-extrabold text-indigo-600">{stats.totalRuns.toLocaleString()}</p>
                </div>
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg"><Activity size={20} /></div>
                {/* Tooltip */}
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 p-2 bg-slate-800 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-50 text-center shadow-xl">
                    Nombre total d'exécutions d'automatisations sur le mois glissant pour les clients sélectionnés.
                </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between group relative cursor-help">
                <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Workflows Actifs</p>
                    <p className="text-2xl font-extrabold text-blue-600">{stats.activeWorkflows}</p>
                </div>
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg"><Cpu size={20} /></div>
                {/* Tooltip */}
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 p-2 bg-slate-800 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-50 text-center shadow-xl">
                    Nombre de scénarios déployés et fonctionnels.
                </div>
            </div>
        </div>

        {/* TOOLBAR */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-50 p-2 rounded-xl border border-slate-200">
            <div className="flex gap-3 w-full justify-between md:justify-end">
                <div className="relative flex-1 md:max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                        type="text" 
                        placeholder="Rechercher (Nom, Client)..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
                    />
                </div>
                <button 
                    onClick={() => { setEditingAutomation(null); setIsModalOpen(true); }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-sm transition-all whitespace-nowrap text-sm"
                >
                    <Plus size={16} /> <span className="hidden sm:inline">Nouveau</span>
                </button>
            </div>
        </div>

        {/* --- GRID VIEW (MONITORING) --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAutomations.length === 0 ? (
                <div className="col-span-full py-12 text-center text-slate-400 italic bg-white border border-dashed border-slate-200 rounded-2xl">
                    Aucune automatisation trouvée.
                </div>
            ) : (
                filteredAutomations.map(auto => (
                    <div 
                        key={auto.id}
                        onClick={() => { setSelectedAutomation(auto); setIsSlideOverOpen(true); }}
                        className={`
                            relative bg-white rounded-xl border p-5 shadow-sm transition-all duration-300 cursor-pointer group flex flex-col justify-between h-48 overflow-hidden
                            ${getCardStyle(auto.status)}
                        `}
                    >
                        {/* ACTIONS ADMIN (Au survol) */}
                        <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                            <button onClick={(e) => { e.stopPropagation(); setEditingAutomation(auto); setIsModalOpen(true); }} className="p-1.5 bg-white text-indigo-600 rounded-lg shadow-sm border border-slate-200 hover:bg-indigo-50"><Edit3 size={14} /></button>
                            <button onClick={(e) => { e.stopPropagation(); setDeleteId(auto.id); }} className="p-1.5 bg-white text-red-600 rounded-lg shadow-sm border border-slate-200 hover:bg-red-50"><Trash2 size={14} /></button>
                        </div>

                        {/* HEAD */}
                        <div>
                            <div className="flex justify-between items-start mb-3">
                                {/* STATUS BADGE PULSE */}
                                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusColor(auto.status)}`}>
                                    {auto.status === 'active' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>}
                                    {auto.status === 'error' && <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>}
                                    {auto.status === 'maintenance' ? 'Maintenance' : auto.status === 'error' ? 'Erreur' : auto.status === 'active' ? 'Opérationnel' : 'Inactif'}
                                </div>
                                
                                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                    <Clock size={10} /> {getTimeAgo(auto.lastRunDate)}
                                </span>
                            </div>
                            
                            <h3 className="font-bold text-slate-800 text-lg mb-1 group-hover:text-indigo-600 transition-colors truncate pr-10">
                                {auto.name}
                            </h3>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide truncate">
                                {getClientName(auto.clientId)}
                            </p>
                        </div>

                        {/* BODY : SPARKLINE & STATS */}
                        <div className="flex items-end justify-between mt-4">
                            <div className="flex-1 mr-4 h-12 relative opacity-60 group-hover:opacity-100 transition-opacity">
                                {/* SPARKLINE SECURED */}
                                {auto.history && auto.history.length > 0 && (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={auto.history}>
                                            <Line 
                                                type="monotone" 
                                                dataKey="value" 
                                                stroke={auto.status === 'error' ? '#ef4444' : auto.status === 'active' ? '#10b981' : '#94a3b8'} 
                                                strokeWidth={2} 
                                                dot={false} 
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                )}
                            </div>
                            
                            <div className="text-right shrink-0">
                                <span className="block text-2xl font-extrabold text-slate-900">
                                    {auto.history.reduce((a, b) => a + b.value, 0)}
                                </span>
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Runs (7j)</span>
                            </div>
                        </div>
                    </div>
                ))
            )}
        </div>
    </div>

    <AutomationSlideOver 
        isOpen={isSlideOverOpen}
        onClose={() => setIsSlideOverOpen(false)}
        automation={selectedAutomation}
    />

    <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingAutomation ? "Modifier Automatisation" : "Nouvelle Automatisation"}>
        <AutomationForm 
            initialData={editingAutomation} 
            onSuccess={() => { setIsModalOpen(false); fetchGlobalAutomations(); }} 
            onCancel={() => setIsModalOpen(false)} 
        />
    </Modal>

    <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Supprimer ?" maxWidth="max-w-md">
        <div className="text-center p-4">
            <AlertTriangle size={32} className="text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-900 mb-2">Confirmer la suppression</h3>
            <p className="text-slate-500 text-sm mb-6">L'historique des logs sera également supprimé.</p>
            <div className="flex gap-3 justify-center">
                <button onClick={() => setDeleteId(null)} className="px-4 py-2 border rounded-xl">Annuler</button>
                <button onClick={executeDelete} disabled={isDeleting} className="px-4 py-2 bg-red-600 text-white rounded-xl">
                    {isDeleting ? '...' : 'Supprimer'}
                </button>
            </div>
        </div>
    </Modal>
    </>
  );
};

export default GlobalAutomations;
