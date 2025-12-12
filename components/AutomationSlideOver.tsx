
import React, { useEffect, useState } from 'react';
import { Automation, AutomationLog } from '../types';
import { X, Clock, CheckCircle2, XCircle, AlertTriangle, History, Zap, LayoutDashboard, Workflow, BookOpen, ChevronDown, Calendar, Copy } from 'lucide-react';
import { supabase } from '../lib/supabase';
import Skeleton from './Skeleton';
import { useToast } from './ToastProvider';

// Composant interne pour l'animation des nombres (CountUp)
const AnimatedNumber = ({ value, formatter = (v: number) => v.toString() }: { value: number, formatter?: (v: number) => string | React.ReactNode }) => {
    const [displayValue, setDisplayValue] = useState(0);
  
    useEffect(() => {
      let start = 0;
      const end = value;
      if (start === end) {
          setDisplayValue(end);
          return;
      }
  
      // Durée ajustée à 1.2s pour un effet "Premium"
      const duration = 1200;
      const startTime = performance.now();
  
      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function (easeOutExpo)
        const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
        
        // Math.floor pour garder des entiers
        const current = Math.floor(start + (end - start) * ease);
        
        setDisplayValue(current);
  
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          setDisplayValue(end);
        }
      };
  
      requestAnimationFrame(animate);
    }, [value]);
  
    return <>{formatter(displayValue)}</>;
};

// --- Utilitaires pour le Markdown (Formatage) ---
const parseBold = (text: string) => {
    // Regex pour capturer **texte**
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            // On retire les ** et on affiche en gras
            return <strong key={index} className="font-bold text-slate-900">{part.slice(2, -2)}</strong>;
        }
        return part;
    });
};

const renderMarkdown = (text: string) => {
    if (!text) return null;
    return text.split('\n').map((line, i) => {
        const trimmed = line.trim();
        
        // H2 (## Titre ou ##Titre) - On vérifie H2 avant H1 car il commence aussi par #
        if (trimmed.startsWith('##')) {
            // On enlève les ## et les espaces éventuels au début
            const content = trimmed.replace(/^##\s*/, '');
            return <h2 key={i} className="text-lg font-bold text-slate-800 mt-5 mb-2 flex items-center gap-2"><span className="w-1 h-4 bg-indigo-500 rounded-full"></span>{content}</h2>
        }

        // H1 (# Titre ou #Titre)
        if (trimmed.startsWith('#')) {
             // On enlève le # et les espaces éventuels au début
            const content = trimmed.replace(/^#\s*/, '');
            return <h1 key={i} className="text-xl font-bold text-slate-900 mt-6 mb-3 border-b border-slate-200 pb-2">{content}</h1>
        }

        // Liste à puces (- item)
        if (trimmed.startsWith('- ')) {
            return (
                <div key={i} className="flex items-start gap-3 mb-1.5 pl-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-2 shrink-0 opacity-70"></span>
                    <span className="text-slate-600 leading-relaxed">{parseBold(trimmed.replace('- ', ''))}</span>
                </div>
            )
        }
        // Paragraphe vide
        if (trimmed === '') {
            return <div key={i} className="h-3"></div>
        }
        // Texte standard
        return <p key={i} className="text-slate-600 mb-1.5 leading-relaxed">{parseBold(line)}</p>
    });
};

interface AutomationSlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  automation: Automation | null;
  onNavigateToSupport?: (subject: string, description: string) => void;
}

const AutomationSlideOver: React.FC<AutomationSlideOverProps> = ({ isOpen, onClose, automation, onNavigateToSupport }) => {
  const toast = useToast();

  // Stockage des données
  const [allLogs, setAllLogs] = useState<AutomationLog[]>([]);
  const [displayedLogs, setDisplayedLogs] = useState<AutomationLog[]>([]);
  const [stats, setStats] = useState({
    totalTimeSaved: 0,
    successRate: 0,
    totalExecutions: 0
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'pipeline' | 'docs'>('overview');
  const [timeRange, setTimeRange] = useState<'all' | 'month' | '30days'>('all');

  // Animation d'entrée
  useEffect(() => {
    if (isOpen) {
        const timer = setTimeout(() => setIsVisible(true), 50);
        return () => clearTimeout(timer);
    } else {
        setIsVisible(false);
    }
  }, [isOpen]);

  // Chargement initial & Reset
  useEffect(() => {
    if (isOpen && automation) {
      setAllLogs([]);
      setDisplayedLogs([]);
      setStats({ totalTimeSaved: 0, successRate: 0, totalExecutions: 0 });
      setIsLoading(true);

      setActiveTab('overview');
      setTimeRange('all');
      fetchLogs();
    } else {
      if (!isOpen) {
        const timer = setTimeout(() => {
            setAllLogs([]);
            setDisplayedLogs([]);
            setStats({ totalTimeSaved: 0, successRate: 0, totalExecutions: 0 });
        }, 300);
        return () => clearTimeout(timer);
      }
    }
  }, [isOpen, automation]);

  // Filtrage & Calculs
  useEffect(() => {
      if (allLogs.length === 0) return;

      const now = new Date();
      let filtered = allLogs;

      if (timeRange === 'month') {
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          filtered = allLogs.filter(l => new Date(l.createdAt) >= startOfMonth);
      } else if (timeRange === '30days') {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(now.getDate() - 30);
          filtered = allLogs.filter(l => new Date(l.createdAt) >= thirtyDaysAgo);
      }

      calculateStats(filtered);
      // Limite à 20 items pour l'affichage
      setDisplayedLogs(filtered.slice(0, 20));

  }, [timeRange, allLogs]);

  const fetchLogs = async () => {
    if (!automation) return;
    try {
      const { data, error } = await supabase
        .from('automation_logs')
        .select('*')
        .eq('automation_id', automation.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error("Erreur fetch logs:", error);
        setAllLogs([]);
      } else {
        const logsData: AutomationLog[] = (data || []).map((log: any) => ({
          id: log.id,
          automationId: log.automation_id,
          status: log.status,
          createdAt: log.created_at,
          duration: log.duration || '0s',
          minutesSaved: log.minutes_saved || 0
        }));
        setAllLogs(logsData);
      }
    } catch (e) {
      console.error("Exception fetch logs:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateStats = (logsToCalculate: AutomationLog[]) => {
    const totalMinutes = logsToCalculate.reduce((acc, log) => {
      if (log.status === 'success') {
          return acc + (log.minutesSaved || 0);
      }
      return acc;
    }, 0);
    
    const successCount = logsToCalculate.filter(l => l.status === 'success').length;
    const rate = logsToCalculate.length > 0 ? (successCount / logsToCalculate.length) * 100 : 0;
    const count = logsToCalculate.length;

    setStats({
      totalTimeSaved: totalMinutes,
      successRate: Math.round(rate),
      totalExecutions: count
    });
  };

  const formatDuration = (minutes: number) => {
    const m = Math.floor(minutes);
    if (m < 60) return `${m} min`;
    const hours = Math.floor(m / 60);
    const mins = m % 60;
    return `${hours}h ${mins}m`;
  };

  const handleReportProblem = () => {
    if (onNavigateToSupport && automation) {
        const description = `Bonjour,\n\nJe souhaite signaler une anomalie sur l'automatisation suivante :\n\n- Nom : ${automation.name}\n- ID : ${automation.id}\n\nDétails du problème rencontré : \n`;
        onNavigateToSupport('bug', description);
        onClose();
    }
  };

  const handleCopyId = () => {
      if (automation) {
          navigator.clipboard.writeText(automation.id);
          toast.success("ID Copié", "Identifiant copié dans le presse-papier.");
      }
  };

  // Textes dynamiques pour les KPIs
  const getSubtext = (type: 'time' | 'count' | 'rate') => {
      if (timeRange === 'month') return type === 'count' ? "ce mois-ci" : type === 'time' ? "sur ce mois-ci" : "sur ce mois-ci";
      if (timeRange === '30days') return "sur les 30 derniers jours";
      
      // Default
      if (type === 'time') return "estimé sur l'historique";
      if (type === 'count') return "depuis le lancement";
      if (type === 'rate') return "taux de réussite global";
      return "";
  };

  // --- RENDER VUE D'ENSEMBLE ---
  const renderOverview = () => (
    <div className="flex flex-col h-full animate-fade-in p-6 space-y-6">
        
        {/* KPI Cards */}
        <div className="grid grid-cols-3 gap-4 shrink-0 select-none">
            {/* Temps Gagné - Violet */}
            <div className="p-4 rounded-xl bg-violet-100 border border-violet-200 flex flex-col items-center text-center shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md cursor-default group">
                <div className="mb-2 text-violet-700 transition-transform group-hover:scale-110 duration-300">
                    <Clock size={24} />
                </div>
                <span className="text-[10px] uppercase font-bold tracking-widest text-violet-900 mb-0.5 opacity-70">Temps gagné</span>
                <span className="text-xl font-extrabold text-violet-900 mb-1">
                    {isLoading ? <Skeleton className="h-7 w-20 bg-violet-200" /> : (
                        <AnimatedNumber value={stats.totalTimeSaved} formatter={formatDuration} />
                    )}
                </span>
                <span className="text-[10px] text-violet-900/60 font-medium whitespace-nowrap">
                    {getSubtext('time')}
                </span>
            </div>

            {/* Exécutions - Bleu */}
            <div className="p-4 rounded-xl bg-blue-100 border border-blue-200 flex flex-col items-center text-center shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md cursor-default group">
                <div className="mb-2 text-blue-700 transition-transform group-hover:scale-110 duration-300">
                    <Zap size={24} />
                </div>
                <span className="text-[10px] uppercase font-bold tracking-widest text-blue-900 mb-0.5 opacity-70">Exécutions</span>
                <span className="text-xl font-extrabold text-blue-900 mb-1">
                        {isLoading ? <Skeleton className="h-7 w-12 bg-blue-200" /> : (
                            <AnimatedNumber value={stats.totalExecutions} />
                        )}
                </span>
                <span className="text-[10px] text-blue-900/60 font-medium whitespace-nowrap">
                    {getSubtext('count')}
                </span>
            </div>

            {/* Succès - Vert */}
            <div className="p-4 rounded-xl bg-emerald-100 border border-emerald-200 flex flex-col items-center text-center shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md cursor-default group">
                <div className="mb-2 text-emerald-700 transition-transform group-hover:scale-110 duration-300">
                    <CheckCircle2 size={24} />
                </div>
                <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-900 mb-0.5 opacity-70">Succès</span>
                <span className="text-xl font-extrabold text-emerald-900 mb-1">
                        {isLoading ? <Skeleton className="h-7 w-12 bg-emerald-200" /> : (
                            <AnimatedNumber value={stats.successRate} formatter={(v) => `${v}%`} />
                        )}
                </span>
                <span className="text-[10px] text-emerald-900/60 font-medium whitespace-nowrap">
                    {getSubtext('rate')}
                </span>
            </div>
        </div>

        {/* Outils Connectés (Design Compact) */}
        {automation?.toolIcons && automation.toolIcons.length > 0 && (
            <div className="shrink-0 select-none cursor-default">
                <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                    <Zap size={16} className="text-indigo-500" /> Outils connectés
                </h4>
                <div className="flex flex-wrap gap-2">
                    {automation.toolIcons.map((tool, i) => (
                        <span key={i} className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-full text-xs font-bold text-slate-700 shadow-sm hover:border-indigo-200 transition-colors">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                            {tool}
                        </span>
                    ))}
                </div>
            </div>
        )}

        {/* Tableau Historique */}
        <div className="flex-1 flex flex-col min-h-0 border border-slate-100 rounded-xl overflow-hidden shadow-sm bg-white">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between shrink-0 select-none">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <History size={16} className="text-slate-400" />
                    Les 20 dernières exécutions
                </h3>
            </div>

            {/* En-tête Tableau */}
            <div className="grid grid-cols-12 gap-4 px-4 py-2 bg-slate-50/50 border-b border-slate-100 text-xs uppercase font-bold text-slate-400 shrink-0 select-none">
                <div className="col-span-4">Statut</div>
                <div className="col-span-5">Date</div>
                <div className="col-span-3 text-right">Durée</div>
            </div>

            {/* Corps Tableau */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {isLoading ? (
                    <div className="p-4 space-y-3">
                        {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-8 w-full" />)}
                    </div>
                ) : displayedLogs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 italic py-10 select-none">
                        <p>Aucune donnée pour cette période.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-50">
                        {displayedLogs.map(log => (
                            <div key={log.id} className="grid grid-cols-12 gap-4 px-4 py-3 hover:bg-slate-50 transition-colors items-center text-sm cursor-default">
                                <div className="col-span-4">
                                    {log.status === 'success' ? (
                                        <div className="flex items-center gap-1.5 text-emerald-600 font-medium text-xs">
                                            <CheckCircle2 size={14} /> Succès
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1.5 text-red-600 font-medium text-xs">
                                            <XCircle size={14} /> Erreur
                                        </div>
                                    )}
                                </div>
                                <div className="col-span-5 text-slate-600 text-xs">
                                    {new Date(log.createdAt).toLocaleString('fr-FR', {
                                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                                    })}
                                </div>
                                <div className="col-span-3 text-right text-slate-500 font-mono text-xs">
                                    {log.duration}
                                </div>
                            </div>
                        ))}
                        
                        {/* Indicateur de limite */}
                        <div className="py-4 text-center border-t border-slate-50">
                            <p className="text-[10px] text-slate-400 italic select-none">
                                Affichage des {displayedLogs.length} dernières exécutions.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    </div>
  );

  // --- RENDER PIPELINE (Flux Visuel) ---
  const renderPipeline = () => {
      const steps = automation?.pipelineSteps || [];
      if (steps.length === 0) {
          return (
              <div className="flex flex-col items-center justify-center py-12 text-center h-full select-none">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                      <Workflow size={32} className="text-slate-300" />
                  </div>
                  <p className="text-slate-500 font-medium">Aucun flux visuel disponible.</p>
              </div>
          );
      }

      return (
          <div className="p-6 animate-fade-in relative overflow-y-auto custom-scrollbar h-full">
              {/* Conteneur relatif pour le trait */}
              <div className="relative">
                  {/* Ligne Verticale Connectrice (Centrée à 24px = 1.5rem = left-6) */}
                  <div className="absolute left-6 top-6 bottom-6 w-0.5 bg-indigo-100 -translate-x-1/2 z-0"></div>

                  <div className="space-y-8 relative z-10">
                      {steps.map((step, index) => (
                          <div key={index} className="grid grid-cols-[3rem_1fr] gap-6 items-start group">
                              {/* Colonne 1 : Cercle Numéro (w-12 = 3rem) */}
                              <div className="w-12 h-12 rounded-full bg-white border-2 border-indigo-100 shadow-sm flex items-center justify-center shrink-0 text-indigo-600 font-bold text-sm z-10 select-none group-hover:scale-110 transition-transform bg-white">
                                  {index + 1}
                              </div>
                              
                              {/* Colonne 2 : Carte Détail */}
                              <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm hover:shadow-md transition-shadow cursor-default">
                                  <div className="flex items-center justify-between mb-1 select-none">
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
                  
                  {/* Flèche de fin */}
                  <div className="mt-8 grid grid-cols-[3rem_1fr] gap-6 items-center">
                      <div className="w-12 flex justify-center relative z-10">
                          <div className="bg-white rounded-full p-1 border border-indigo-50 shadow-sm text-indigo-300">
                              <ChevronDown size={16} />
                          </div>
                      </div>
                      <span className="italic font-medium text-slate-400 text-xs select-none">Fin du processus</span>
                  </div>
              </div>
          </div>
      );
  };

  const renderDocs = () => {
      const guide = automation?.userGuide;
      if (!guide) {
          return (
            <div className="flex flex-col items-center justify-center py-12 text-center h-full select-none">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                    <BookOpen size={32} className="text-slate-300" />
                </div>
                <p className="text-slate-500 font-medium">Documentation non disponible.</p>
            </div>
          );
      }

      return (
          <div className="p-6 h-full overflow-y-auto custom-scrollbar">
            <div className="bg-slate-50 rounded-xl p-8 border border-slate-100 animate-fade-in shadow-inner">
                {renderMarkdown(guide)}
            </div>
          </div>
      );
  };

  if (!automation) return null;

  return (
    <>
      <div 
        className={`fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-[60] transition-opacity duration-300 ${
          isVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      <div 
        className={`fixed inset-y-0 right-0 w-full md:w-[600px] bg-white shadow-2xl z-[70] transform transition-transform duration-300 ease-out flex flex-col ${
          isVisible ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* HEADER */}
        <div className="px-6 pt-6 border-b border-slate-100 bg-white shrink-0">
            <div className="flex items-start justify-between mb-6">
                <div className="group">
                    <div className="flex items-center gap-3 mb-1.5 select-none">
                        <h2 className="text-xl font-bold text-slate-800 line-clamp-1 cursor-default">{automation.name}</h2>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider border cursor-default ${
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
                    
                    {/* ID Copy-able */}
                    <button 
                        onClick={handleCopyId}
                        className="flex items-center gap-1.5 text-xs text-slate-400 font-mono hover:text-indigo-500 hover:bg-indigo-50 px-1.5 py-0.5 -ml-1.5 rounded-md transition-colors duration-200"
                        title="Cliquez pour copier"
                    >
                        <span>ID: {automation.id}</span>
                        <Copy size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                </div>
                <button 
                    onClick={onClose}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                >
                    <X size={24} />
                </button>
            </div>

            {/* Navigation Tabs + Filter */}
            <div className="flex items-end justify-between">
                <div className="flex gap-6 select-none">
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

                {activeTab === 'overview' && (
                    <div className="pb-2 pl-4">
                        <div className="relative inline-flex items-center group">
                            <Calendar size={10} className="absolute left-2 text-slate-400 pointer-events-none group-hover:text-indigo-500 transition-colors" />
                            <select 
                                value={timeRange}
                                onChange={(e) => setTimeRange(e.target.value as any)}
                                className="pl-6 pr-5 py-1 bg-white border border-slate-200 text-slate-600 text-[10px] font-medium rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500/20 focus:border-indigo-500 appearance-none cursor-pointer hover:bg-slate-50 hover:text-indigo-600 transition-all"
                            >
                                <option value="all">Tout l'historique</option>
                                <option value="month">Ce mois-ci</option>
                                <option value="30days">30 derniers jours</option>
                            </select>
                            <ChevronDown size={10} className="absolute right-1.5 text-slate-300 pointer-events-none group-hover:text-indigo-500 transition-colors" />
                        </div>
                    </div>
                )}
            </div>
        </div>

        {/* CONTENU */}
        <div className="flex-1 overflow-hidden bg-white">
            {activeTab === 'overview' && renderOverview()}
            {activeTab === 'pipeline' && renderPipeline()}
            {activeTab === 'docs' && renderDocs()}
        </div>

        {/* FOOTER */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 shrink-0">
            <button 
                onClick={handleReportProblem}
                className="w-full py-3 bg-white border border-slate-200 text-slate-700 hover:text-red-600 hover:border-red-200 hover:bg-red-50 font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 group transform active:scale-[0.99]"
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
