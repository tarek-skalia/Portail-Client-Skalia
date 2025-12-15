
import React, { useEffect, useState } from 'react';
import { Automation } from '../types';
import { Activity, CheckCircle2, XCircle, AlertCircle, Clock, PauseCircle, Play, ArrowRight, Zap, Search, Plus, Trash2, Edit3, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import Skeleton from './Skeleton';
import AutomationSlideOver from './AutomationSlideOver';
import { useAdmin } from './AdminContext';
import { useToast } from './ToastProvider';
import Modal from './ui/Modal';
import AutomationForm from './forms/AutomationForm';

interface AutomationsListProps {
  userId?: string;
  onNavigateToSupport?: (subject: string, description: string) => void;
}

const AutomationsList: React.FC<AutomationsListProps> = ({ userId, onNavigateToSupport }) => {
  const { isAdminMode } = useAdmin();
  const toast = useToast();
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // États SlideOver
  const [selectedAutomation, setSelectedAutomation] = useState<Automation | null>(null);
  const [isSlideOverOpen, setIsSlideOverOpen] = useState(false);

  // États Modal CRUD
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState<Automation | null>(null);

  // État Suppression
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (userId) {
        fetchAutomationsAndStats();

        const automationsChannel = supabase
            .channel('realtime:automations_list')
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'automations',
                filter: `user_id=eq.${userId}` 
            }, () => {
                fetchAutomationsAndStats();
            })
            .subscribe();

        const logsChannel = supabase
            .channel('realtime:automation_logs_stats')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'automation_logs' }, () => {
                fetchAutomationsAndStats();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(automationsChannel);
            supabase.removeChannel(logsChannel);
        };
    }
  }, [userId]);

  const getTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'À l\'instant';
    if (diffInSeconds < 3600) return `Il y a ${Math.floor(diffInSeconds / 60)} min`;
    if (diffInSeconds < 86400) return `Il y a ${Math.floor(diffInSeconds / 3600)} h`;
    if (diffInSeconds < 604800) return `Il y a ${Math.floor(diffInSeconds / 86400)} j`;
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  const fetchAutomationsAndStats = async () => {
    const { data: autosData, error: autosError } = await supabase
        .from('automations')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (autosError) {
        console.error('Erreur chargement automations:', autosError);
        setIsLoading(false);
        return;
    }

    if (!autosData || autosData.length === 0) {
        setAutomations([]);
        setIsLoading(false);
        return;
    }

    const automationIds = autosData.map((a: any) => a.id);
    const { data: logsData } = await supabase
        .from('automation_logs')
        .select('automation_id, created_at')
        .in('automation_id', automationIds)
        .order('created_at', { ascending: false });

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const mapped: Automation[] = autosData.map((item: any) => {
        const autoLogs = logsData ? logsData.filter((l: any) => l.automation_id === item.id) : [];
        const runsMonth = autoLogs.filter((l: any) => new Date(l.created_at) >= startOfMonth).length;
        
        let lastRunLabel = 'Jamais';
        if (autoLogs.length > 0) {
            lastRunLabel = getTimeAgo(autoLogs[0].created_at);
        }

        return {
            id: item.id,
            clientId: item.user_id,
            name: item.name,
            description: item.description || '',
            status: item.status,
            lastRun: lastRunLabel,
            runsThisMonth: runsMonth,
            toolIcons: item.tool_icons || [],
            pipelineSteps: item.pipeline_steps || [],
            userGuide: item.user_guide || ''
        };
    });

    setAutomations(mapped);
    setIsLoading(false);
  };
  
  const handleOpenDetails = (automation: Automation) => {
      setSelectedAutomation(automation);
      setIsSlideOverOpen(true);
  };

  const handleCloseDetails = () => {
      setIsSlideOverOpen(false);
      setTimeout(() => setSelectedAutomation(null), 300);
  };

  // --- CRUD ACTIONS ---
  const handleEdit = (e: React.MouseEvent, auto: Automation) => {
      e.stopPropagation();
      setEditingAutomation(auto);
      setIsModalOpen(true);
  };

  const confirmDelete = (e: React.MouseEvent, autoId: string) => {
      e.stopPropagation();
      setDeleteId(autoId); // Ouvre la modale de confirmation
  };

  const executeDelete = async () => {
      if (!deleteId) return;
      setIsDeleting(true);

      try {
          // 1. Suppression Cascade Manuelle (Logs)
          await supabase.from('automation_logs').delete().eq('automation_id', deleteId);

          // 2. Suppression de l'automatisation
          const { error, count } = await supabase
            .from('automations')
            .delete({ count: 'exact' })
            .eq('id', deleteId);
          
          if (error) {
              console.error("Erreur SQL:", error);
              toast.error("Erreur", error.message);
          } else if (count === 0) {
              console.warn("Aucune ligne supprimée. Vérifiez les Policies RLS.");
              toast.error("Impossible", "Vous n'avez pas les droits de suppression sur cet élément.");
          } else {
              toast.success("Supprimé", "L'automatisation a été retirée.");
              fetchAutomationsAndStats();
          }
      } catch (err: any) {
          console.error("Erreur inattendue:", err);
          toast.error("Erreur", "Une erreur inattendue est survenue.");
      } finally {
          setIsDeleting(false);
          setDeleteId(null);
      }
  };

  const handleCreate = () => {
      setEditingAutomation(null);
      setIsModalOpen(true);
  };

  const getStatusStyle = (status: Automation['status']) => {
    switch (status) {
      case 'active':
        return { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-100', icon: <CheckCircle2 size={14} /> };
      case 'error':
        return { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-100', icon: <XCircle size={14} /> };
      case 'maintenance':
        return { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-100', icon: <AlertCircle size={14} /> };
      case 'inactive':
        return { bg: 'bg-slate-50', text: 'text-slate-500', border: 'border-slate-100', icon: <PauseCircle size={14} /> };
      default:
        return { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-100', icon: <Activity size={14} /> };
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      active: 'Opérationnel',
      inactive: 'En pause',
      error: 'Erreur',
      maintenance: 'Maintenance'
    };
    return labels[status] || status;
  };

  const filteredAutomations = automations.filter(auto => {
      const searchLower = searchTerm.toLowerCase();
      return (
          auto.name.toLowerCase().includes(searchLower) ||
          auto.description.toLowerCase().includes(searchLower) ||
          auto.toolIcons.some(tool => tool.toLowerCase().includes(searchLower))
      );
  });

  const activeAutomationsCount = automations.filter(a => a.status === 'active').length;

  if (isLoading) {
      return (
        <div className="space-y-6">
            <div className="flex justify-between items-end mb-8">
                <div className="space-y-2">
                    <Skeleton className="h-8 w-64" />
                    <Skeleton className="h-4 w-96" />
                </div>
                <Skeleton className="h-8 w-24 rounded-xl" />
            </div>
            <Skeleton className="h-12 w-full rounded-xl mb-6" />
            <div className="grid grid-cols-1 gap-5">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col md:flex-row gap-6">
                        <div className="flex-1 flex gap-5">
                            <Skeleton className="w-12 h-12 rounded-xl shrink-0" />
                            <div className="flex-1 space-y-3">
                                <Skeleton className="h-6 w-1/3" />
                                <Skeleton className="h-4 w-3/4" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      );
  }

  return (
    <>
        <div className="space-y-6 relative z-0">
        <div className="flex justify-between items-end mb-2 animate-fade-in-up">
            <div>
                <h2 className="text-2xl font-bold text-slate-900">Mes Automatisations</h2>
                <p className="text-slate-500 text-sm mt-2">Vue d'ensemble de vos processus automatisés.</p>
            </div>
            <div className="flex gap-2">
                 <div className="bg-white px-4 py-2 rounded-xl text-sm font-semibold text-slate-700 shadow-sm border border-slate-100 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    {activeAutomationsCount} actifs
                </div>
                {/* BOUTON ADMIN */}
                {isAdminMode && (
                    <button 
                        onClick={handleCreate}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm hover:bg-indigo-700 flex items-center gap-2"
                    >
                        <Plus size={16} /> Ajouter
                    </button>
                )}
            </div>
        </div>

        {/* Barre de Recherche */}
        <div className="relative animate-fade-in-up delay-100 mb-6">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                <Search size={20} />
            </div>
            <input 
                type="text" 
                placeholder="Rechercher par nom, outil..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
            />
        </div>

        <div className="grid grid-cols-1 gap-5">
            {filteredAutomations.length === 0 && automations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[50vh] bg-white/50 rounded-3xl border border-dashed border-slate-300 animate-fade-in-up">
                    <div className="p-6 bg-indigo-50 rounded-full mb-6">
                        <Activity className="text-indigo-400 w-10 h-10" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-800">Aucune automatisation</h3>
                    <p className="text-slate-500 mt-2">Ce compte n'a pas encore de workflow configuré.</p>
                </div>
            ) : filteredAutomations.length === 0 ? (
                 <div className="text-center py-10 text-slate-400">
                    <p>Aucune automatisation ne correspond à votre recherche.</p>
                </div>
            ) : (
                filteredAutomations.map((auto, index) => {
                const statusStyle = getStatusStyle(auto.status);
                const delayClass = index === 0 ? '' : index === 1 ? 'delay-100' : index === 2 ? 'delay-200' : 'delay-300';
                
                return (
                    <div 
                        key={auto.id} 
                        className={`bg-white rounded-2xl p-6 border border-slate-100 transition-all duration-300 ease-out group animate-fade-in-up ${delayClass} hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-100/50 cursor-pointer relative overflow-hidden`}
                        onClick={() => handleOpenDetails(auto)}
                    >
                    
                    {/* ADMIN ACTIONS OVERLAY */}
                    {isAdminMode && (
                        <div className="absolute top-4 right-4 flex gap-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                                onClick={(e) => handleEdit(e, auto)}
                                className="p-2 bg-white text-indigo-600 rounded-lg shadow-sm border border-slate-200 hover:bg-indigo-50 hover:border-indigo-200"
                                title="Modifier"
                            >
                                <Edit3 size={16} />
                            </button>
                            <button 
                                onClick={(e) => confirmDelete(e, auto.id)}
                                className="p-2 bg-white text-red-600 rounded-lg shadow-sm border border-slate-200 hover:bg-red-50 hover:border-red-200"
                                title="Supprimer"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    )}

                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        
                        {/* Left: Icon & Info */}
                        <div className="flex items-start gap-5 flex-1">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${statusStyle.bg} transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}>
                            <Activity className={statusStyle.text} size={24} />
                        </div>
                        <div>
                            <div className="flex items-center gap-3 mb-2 flex-wrap">
                                <h3 className="font-bold text-slate-800 text-lg group-hover:text-indigo-600 transition-colors">{auto.name}</h3>
                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}>
                                    {statusStyle.icon}
                                    {getStatusLabel(auto.status)}
                                </span>
                            </div>
                            <p className="text-slate-500 text-sm leading-relaxed max-w-2xl">
                                {auto.description}
                            </p>
                            
                            {/* Tools Tags */}
                            {auto.toolIcons && auto.toolIcons.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-5 pt-3 border-t border-slate-50">
                                    {auto.toolIcons.map((tool, idx) => (
                                        <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-full text-xs font-semibold text-slate-600 shadow-sm hover:border-indigo-300 hover:text-indigo-600 transition-all cursor-default">
                                            <Zap size={12} className="text-indigo-500 fill-indigo-500/10" />
                                            {tool}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                        </div>

                        {/* Right: Metrics & Actions */}
                        <div className="flex items-center gap-8 border-t md:border-t-0 md:border-l border-slate-100 pt-5 md:pt-0 md:pl-8 shrink-0">
                            <div className="grid grid-cols-2 md:grid-cols-1 gap-4 md:gap-3 min-w-[150px]">
                                <div className="flex flex-col">
                                    <span className="text-xs text-slate-400 uppercase tracking-wide font-medium">Dernière exécution</span>
                                    <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                                        <Clock size={14} className="text-slate-400" />
                                        {auto.lastRun}
                                    </div>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-xs text-slate-400 uppercase tracking-wide font-medium">Exécutions / mois</span>
                                    <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                                        <Play size={14} className="text-slate-400" />
                                        {auto.runsThisMonth}
                                    </div>
                                </div>
                            </div>
                            
                            <button 
                                className="hidden md:flex w-10 h-10 rounded-full bg-slate-50 text-slate-400 items-center justify-center hover:bg-indigo-600 hover:text-white transition-all duration-300 shadow-sm hover:shadow-indigo-500/30 group-hover:bg-indigo-600 group-hover:text-white group-hover:translate-x-1"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenDetails(auto);
                                }}
                            >
                                <ArrowRight size={18} />
                            </button>
                        </div>
                    </div>
                    </div>
                );
                })
            )}
        </div>
        </div>

        {/* Slide Over Component */}
        <AutomationSlideOver 
            isOpen={isSlideOverOpen} 
            onClose={handleCloseDetails} 
            automation={selectedAutomation}
            onNavigateToSupport={onNavigateToSupport}
        />

        {/* MODAL CREATION / EDITION */}
        <Modal 
            isOpen={isModalOpen} 
            onClose={() => setIsModalOpen(false)} 
            title={editingAutomation ? "Modifier l'automatisation" : "Nouvelle Automatisation"}
        >
            <AutomationForm 
                initialData={editingAutomation}
                onSuccess={() => { setIsModalOpen(false); fetchAutomationsAndStats(); }}
                onCancel={() => setIsModalOpen(false)}
            />
        </Modal>

        {/* MODAL SUPPRESSION */}
        <Modal
            isOpen={!!deleteId}
            onClose={() => setDeleteId(null)}
            title="Suppression"
            maxWidth="max-w-md"
        >
            <div className="text-center p-4">
                <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertTriangle size={32} />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Êtes-vous sûr ?</h3>
                <p className="text-slate-500 text-sm mb-6">
                    Cette action est irréversible. L'historique d'exécution sera également supprimé.
                </p>
                <div className="flex gap-3 justify-center">
                    <button 
                        onClick={() => setDeleteId(null)}
                        className="px-4 py-2 bg-white border border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                    >
                        Annuler
                    </button>
                    <button 
                        onClick={executeDelete}
                        disabled={isDeleting}
                        className="px-4 py-2 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition-colors shadow-md shadow-red-200 flex items-center gap-2"
                    >
                        {isDeleting ? 'Suppression...' : 'Confirmer la suppression'}
                    </button>
                </div>
            </div>
        </Modal>
    </>
  );
};

export default AutomationsList;
