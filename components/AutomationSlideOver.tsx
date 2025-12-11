
import React, { useEffect, useState } from 'react';
import { Automation, AutomationLog } from '../types';
import { X, Clock, CheckCircle2, XCircle, AlertTriangle, History, Zap, LayoutDashboard, Workflow, BookOpen, ChevronDown } from 'lucide-react';
import { supabase } from '../lib/supabase';
import Skeleton from './Skeleton';

interface AutomationSlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  automation: Automation | null;
  onNavigateToSupport?: (subject: string, description: string) => void;
}

const AutomationSlideOver: React.FC<AutomationSlideOverProps> = ({ isOpen, onClose, automation, onNavigateToSupport }) => {
  const [logs, setLogs] = useState<AutomationLog[]>([]);
  const [stats, setStats] = useState({
    totalTimeSaved: 0,
    successRate: 0,
    totalExecutions: 0
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'pipeline' | 'docs'>('overview');

  // Animation d'entrée : On attend le montage pour activer la classe visible
  useEffect(() => {
    if (isOpen) {
        const timer = setTimeout(() => setIsVisible(true), 50);
        return () => clearTimeout(timer);
    } else {
        setIsVisible(false);
    }
  }, [isOpen]);

  // Effet pour charger les données quand une automatisation est sélectionnée
  useEffect(() => {
    if (isOpen && automation) {
      setActiveTab('overview'); // Reset tab
      fetchLogsAndStats();
    } else {
      // Reset à la fermeture (après l'animation)
      if (!isOpen) {
        const timer = setTimeout(() => {
            setLogs([]);
            setStats({ totalTimeSaved: 0, successRate: 0, totalExecutions: 0 });
        }, 300);
        return () => clearTimeout(timer);
      }
    }
  }, [isOpen, automation]);

  const fetchLogsAndStats = async () => {
    if (!automation) return;
    setIsLoading(true);

    try {
      // Récupération de TOUS les logs pour cette automatisation (sans limite) pour calculer les stats exactes
      const { data, error } = await supabase
        .from('automation_logs')
        .select('*')
        .eq('automation_id', automation.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error("Erreur fetch logs:", error);
        setLogs([]);
        setStats({ totalTimeSaved: 0, successRate: 0, totalExecutions: 0 });
      } else {
        const allLogs: AutomationLog[] = (data || []).map((log: any) => ({
          id: log.id,
          automationId: log.automation_id,
          status: log.status,
          createdAt: log.created_at,
          duration: log.duration || '0s',
          minutesSaved: log.minutes_saved || 0
        }));

        // Calcul des KPIs sur l'ensemble des données
        calculateStats(allLogs);

        // On ne garde que les 10 derniers pour l'affichage du tableau
        setLogs(allLogs.slice(0, 10));
      }
    } catch (e) {
      console.error("Exception fetch logs:", e);
      setLogs([]);
      setStats({ totalTimeSaved: 0, successRate: 0, totalExecutions: 0 });
    } finally {
      setIsLoading(false);
    }
  };

  const calculateStats = (allLogs: AutomationLog[]) => {
    // 1. Temps Gagné Total (Somme de minutes_saved UNIQUEMENT si succès)
    const totalMinutes = allLogs.reduce((acc, log) => {
      // On n'ajoute le temps gagné que si le statut est 'success'
      if (log.status === 'success') {
          return acc + (log.minutesSaved || 0);
      }
      return acc;
    }, 0);
    
    // 2. Taux de Succès (% de status === 'success')
    const successCount = allLogs.filter(l => l.status === 'success').length;
    const rate = allLogs.length > 0 ? (successCount / allLogs.length) * 100 : 0;

    // 3. Exécutions Totales (Nombre total de logs)
    const count = allLogs.length;

    setStats({
      totalTimeSaved: totalMinutes,
      successRate: Math.round(rate),
      totalExecutions: count
    });
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const handleReportProblem = () => {
    if (onNavigateToSupport && automation) {
        const description = `Bonjour,\n\nJe souhaite signaler une anomalie sur l'automatisation suivante :\n\n- Nom : ${automation.name}\n- ID : ${automation.id}\n\nDétails du problème rencontré : \n`;
        onNavigateToSupport('bug', description);
        onClose();
    }
  };

  const renderOverview = () => (
    <div className="space-y-8 animate-fade-in pb-4">
        {/* KPI Grid - Couleurs RENFORCÉES et DISTINCTES + SOUS-TITRES */}
        <div className="grid grid-cols-3 gap-4">
            {/* Temps Gagné - VIOLET (Valeur) */}
            <div className="p-4 rounded-xl bg-purple-100 border border-purple-200 flex flex-col items-center text-center shadow-sm hover:shadow-md transition-shadow">
                <div className="mb-2 text-purple-700">
                    <Clock size={24} />
                </div>
                <span className="text-[10px] uppercase font-bold tracking-widest text-purple-600 mb-0.5">Temps gagné</span>
                <span className="text-xl font-extrabold text-purple-900 mb-1">
                    {isLoading ? <Skeleton className="h-7 w-20 bg-purple-200" /> : formatDuration(stats.totalTimeSaved)}
                </span>
                <span className="text-[10px] text-purple-700/70 font-medium">estimé sur l'historique</span>
            </div>

            {/* Exécutions - BLEU (Volume) */}
            <div className="p-4 rounded-xl bg-blue-100 border border-blue-200 flex flex-col items-center text-center shadow-sm hover:shadow-md transition-shadow">
                <div className="mb-2 text-blue-700">
                    <Zap size={24} />
                </div>
                <span className="text-[10px] uppercase font-bold tracking-widest text-blue-600 mb-0.5">Exécutions</span>
                <span className="text-xl font-extrabold text-blue-900 mb-1">
                        {isLoading ? <Skeleton className="h-7 w-12 bg-blue-200" /> : stats.totalExecutions}
                </span>
                <span className="text-[10px] text-blue-700/70 font-medium">depuis le lancement</span>
            </div>

            {/* Succès - VERT (Qualité) */}
            <div className="p-4 rounded-xl bg-emerald-100 border border-emerald-200 flex flex-col items-center text-center shadow-sm hover:shadow-md transition-shadow">
                <div className="mb-2 text-emerald-700">
                    <CheckCircle2 size={24} />
                </div>
                <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-600 mb-0.5">Succès</span>
                <span className="text-xl font-extrabold text-emerald-900 mb-1">
                        {isLoading ? <Skeleton className="h-7 w-12 bg-emerald-200" /> : `${stats.successRate}%`}
                </span>
                <span className="text-[10px] text-emerald-700/70 font-medium">taux de réussite global</span>
            </div>
        </div>

        {/* History Table */}
        <div>
            <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                <History size={18} className="text-slate-400" />
                Dernières exécutions
            </h3>

            <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500 font-medium text-xs uppercase">
                        <tr>
                            <th className="px-4 py-3">Statut</th>
                            <th className="px-4 py-3">Date</th>
                            <th className="px-4 py-3 text-right">Durée</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {isLoading ? (
                            [1,2,3,4,5].map(i => (
                                <tr key={i}>
                                    <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
                                    <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                                    <td className="px-4 py-3"><Skeleton className="h-4 w-10 ml-auto" /></td>
                                </tr>
                            ))
                        ) : logs.length === 0 ? (
                            <tr>
                                <td colSpan={3} className="px-4 py-8 text-center text-slate-400 italic">
                                    Aucun historique disponible pour le moment.
                                </td>
                            </tr>
                        ) : (
                            logs.map(log => (
                                <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                                    <td className="px-4 py-3">
                                        {log.status === 'success' ? (
                                            <div className="flex items-center gap-1.5 text-emerald-600 font-medium text-xs">
                                                <CheckCircle2 size={14} /> Succès
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1.5 text-red-600 font-medium text-xs">
                                                <XCircle size={14} /> Erreur
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-slate-600">
                                        {new Date(log.createdAt).toLocaleString('fr-FR', {
                                            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                                        })}
                                    </td>
                                    <td className="px-4 py-3 text-right text-slate-500 font-mono text-xs">
                                        {log.duration}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
            {stats.totalExecutions > 10 && (
                    <p className="text-center text-xs text-slate-400 mt-2 italic">
                        Affichage des 10 dernières exécutions sur {stats.totalExecutions}.
                    </p>
            )}
        </div>

        {/* Integration Details (Outils connectés) - DESIGN COMPACT (Pills) */}
        {automation?.toolIcons && automation.toolIcons.length > 0 && (
            <div className="pt-2">
                <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                    <Zap size={16} className="text-indigo-500" /> Outils connectés
                </h4>
                <div className="flex flex-wrap gap-2">
                    {automation.toolIcons.map((tool, i) => (
                        <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-indigo-100 rounded-full text-xs font-semibold text-slate-700 shadow-sm hover:border-indigo-300 hover:text-indigo-600 transition-colors cursor-default select-none">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                            {tool}
                        </span>
                    ))}
                </div>
            </div>
        )}
    </div>
  );

  const renderPipeline = () => {
      const steps = automation?.pipelineSteps || [];
      if (steps.length === 0) {
          return (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                      <Workflow size={32} className="text-slate-300" />
                  </div>
                  <p className="text-slate-500 font-medium">Aucun flux visuel disponible.</p>
                  <p className="text-xs text-slate-400 mt-1">Les étapes de cette automatisation n'ont pas encore été documentées.</p>
              </div>
          );
      }

      return (
          <div className="py-2 animate-fade-in relative">
              {/* Ligne verticale connectrice (Centrée mathématiquement avec translate-x-1/2) */}
              <div className="absolute left-6 -translate-x-1/2 top-4 bottom-8 w-0.5 bg-indigo-100 z-0"></div>

              <div className="space-y-6 relative z-10">
                  {steps.map((step, index) => (
                      <div key={index} className="flex items-start gap-4">
                          <div className="w-12 h-12 rounded-full bg-white border-2 border-indigo-100 shadow-sm flex items-center justify-center shrink-0 text-indigo-600 font-bold text-sm z-10">
                              {index + 1}
                          </div>
                          <div className="flex-1 bg-white rounded-xl border border-slate-100 p-4 shadow-sm hover:shadow-md transition-shadow">
                              <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs font-bold text-indigo-600 uppercase tracking-wide bg-indigo-50 px-2 py-0.5 rounded-md">
                                      {step.tool}
                                  </span>
                              </div>
                              <p className="text-slate-700 font-medium text-sm leading-relaxed">
                                  {step.action}
                              </p>
                          </div>
                      </div>
                  ))}
              </div>
              
              {/* Flèche de fin (Ajustée avec background blanc pour masquer la ligne) */}
              <div className="flex items-center gap-4 mt-8 text-slate-400 text-xs relative z-10">
                  <div className="w-12 flex justify-center shrink-0">
                      <div className="bg-white rounded-full p-1 border border-indigo-50 shadow-sm z-20">
                        <ChevronDown size={16} className="text-indigo-300" />
                      </div>
                  </div>
                  <span className="italic font-medium text-slate-400">Fin du processus</span>
              </div>
          </div>
      );
  };

  const renderDocs = () => {
      const guide = automation?.userGuide;
      if (!guide) {
          return (
            <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                    <BookOpen size={32} className="text-slate-300" />
                </div>
                <p className="text-slate-500 font-medium">Documentation non disponible.</p>
            </div>
          );
      }

      return (
          <div className="prose prose-sm prose-indigo max-w-none text-slate-600 bg-slate-50 rounded-xl p-6 border border-slate-100 animate-fade-in">
              <div className="whitespace-pre-wrap font-sans leading-relaxed">
                  {guide}
              </div>
          </div>
      );
  };

  if (!automation) return null;

  return (
    <>
      {/* Backdrop (Fond sombre) */}
      <div 
        className={`fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-[60] transition-opacity duration-300 ${
          isVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Panel (Glissant depuis la droite) */}
      <div 
        className={`fixed inset-y-0 right-0 w-full md:w-[600px] bg-white shadow-2xl z-[70] transform transition-transform duration-300 ease-out flex flex-col ${
          isVisible ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-2 border-b border-slate-100 bg-white shrink-0">
            <div className="flex items-start justify-between mb-6">
                <div>
                    <div className="flex items-center gap-3 mb-1.5">
                        <h2 className="text-xl font-bold text-slate-800 line-clamp-1">{automation.name}</h2>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider border ${
                            automation.status === 'active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                            automation.status === 'error' ? 'bg-red-50 text-red-600 border-red-100' :
                            automation.status === 'maintenance' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                            'bg-slate-50 text-slate-500 border-slate-100'
                        }`}>
                            {automation.status === 'active' ? 'Actif' : 
                            automation.status === 'error' ? 'Erreur' : 
                            automation.status === 'maintenance' ? 'Maintenance' : 'Inactif'}
                        </span>
                    </div>
                    <p className="text-xs text-slate-400 font-mono">ID: {automation.id}</p>
                </div>
                <button 
                    onClick={onClose}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                >
                    <X size={24} />
                </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex gap-6">
                <button 
                    onClick={() => setActiveTab('overview')}
                    className={`pb-3 text-sm font-medium transition-all relative ${
                        activeTab === 'overview' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-800'
                    }`}
                >
                    <div className="flex items-center gap-2">
                        <LayoutDashboard size={16} /> Vue d'ensemble
                    </div>
                    {activeTab === 'overview' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 rounded-t-full"></div>}
                </button>
                
                <button 
                    onClick={() => setActiveTab('pipeline')}
                    className={`pb-3 text-sm font-medium transition-all relative ${
                        activeTab === 'pipeline' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-800'
                    }`}
                >
                    <div className="flex items-center gap-2">
                        <Workflow size={16} /> Flux Visuel
                    </div>
                    {activeTab === 'pipeline' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 rounded-t-full"></div>}
                </button>

                <button 
                    onClick={() => setActiveTab('docs')}
                    className={`pb-3 text-sm font-medium transition-all relative ${
                        activeTab === 'docs' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-800'
                    }`}
                >
                    <div className="flex items-center gap-2">
                        <BookOpen size={16} /> Mode d'emploi
                    </div>
                    {activeTab === 'docs' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 rounded-t-full"></div>}
                </button>
            </div>
        </div>

        {/* Content Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 bg-white">
            {activeTab === 'overview' && renderOverview()}
            {activeTab === 'pipeline' && renderPipeline()}
            {activeTab === 'docs' && renderDocs()}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 shrink-0">
            <button 
                onClick={handleReportProblem}
                className="w-full py-3 bg-white border border-slate-200 text-slate-700 hover:text-red-600 hover:border-red-200 hover:bg-red-50 font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 group"
            >
                <AlertTriangle size={18} className="text-slate-400 group-hover:text-red-500 transition-colors" />
                Signaler un problème
            </button>
        </div>
      </div>
    </>
  );
};

export default AutomationSlideOver;
