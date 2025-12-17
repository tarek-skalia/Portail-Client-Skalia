
import React, { useEffect, useState, useRef } from 'react';
import AIInsightsWidget from './AIInsightsWidget';
import RecentActivityFeed from './RecentActivityFeed';
import Skeleton from './Skeleton';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend
} from 'recharts';
import { supabase } from '../lib/supabase';
import { 
    Zap, Clock, CheckCircle2, TrendingUp, Layers, Activity, 
    ArrowUpRight, Info, Euro, Settings, Plus, AlertCircle, FileText, Calendar, ChevronDown, Rocket, Sparkles
} from 'lucide-react';
import { useToast } from './ToastProvider';

// --- COMPOSANT INTERNE : ANIMATION COMPTEUR ---
const CountUp = ({ end, duration = 1500, suffix = '', prefix = '' }: { end: number, duration?: number, suffix?: string, prefix?: string }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let start = 0;
    if (end === 0) {
        setCount(0);
        return;
    }
    
    const frameDuration = 1000 / 60;
    const totalFrames = Math.round(duration / frameDuration);
    const easeOutExpo = (t: number) => t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
    
    let frame = 0;
    const counter = setInterval(() => {
      frame++;
      const progress = frame / totalFrames;
      const currentCount = Math.round(end * easeOutExpo(progress));

      if (frame === totalFrames) {
        setCount(end);
        clearInterval(counter);
      } else {
        setCount(currentCount);
      }
    }, frameDuration);

    return () => clearInterval(counter);
  }, [end, duration]);

  return <>{prefix}{count.toLocaleString('fr-FR')}{suffix}</>;
};

// --- COMPOSANT INTERNE : TOOLTIP GRAPHIQUE CUSTOM ---
const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-slate-900 text-white text-xs p-3 rounded-lg shadow-xl border border-slate-700/50 backdrop-blur-md z-50">
                <p className="font-bold mb-2 text-slate-300">{label}</p>
                {payload.map((entry: any, index: number) => (
                    <div key={index} className="flex items-center gap-2 mb-1 last:mb-0">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                        <span className="capitalize text-slate-200">{entry.name}:</span>
                        <span className="font-bold">{entry.value}</span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
};

interface DashboardProps {
  userId?: string;
  onNavigate: (page: string) => void;
  onNavigateToSupport?: (subject: string, description: string) => void;
}

type TimeRange = 'month' | 'quarter' | 'year' | 'all';

const Dashboard: React.FC<DashboardProps> = ({ userId, onNavigate, onNavigateToSupport }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [userName, setUserName] = useState('');
  
  // FILTERS & SETTINGS
  const [timeRange, setTimeRange] = useState<TimeRange>('month');
  const [viewMode, setViewMode] = useState<'time' | 'money'>('time');
  const [hourlyRate, setHourlyRate] = useState<number>(50); // Valeur par défaut 50€/h
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  const toast = useToast();
  const prevUserIdRef = useRef<string | undefined>(undefined);

  // DATA STATES
  const [stats, setStats] = useState({
    totalExecutions: 0,
    totalExecutionsPrev: 0,
    activeAutomations: 0,
    successRate: 0,
    minutesSaved: 0,
    topAutomationName: ''
  });

  const [dailyActivityData, setDailyActivityData] = useState<any[]>([]);
  const [distributionData, setDistributionData] = useState<any[]>([]);

  // Load saved hourly rate
  useEffect(() => {
      const savedRate = localStorage.getItem('skalia_hourly_rate');
      if (savedRate) setHourlyRate(parseInt(savedRate));
  }, []);

  const saveHourlyRate = (newRate: number) => {
      setHourlyRate(newRate);
      localStorage.setItem('skalia_hourly_rate', newRate.toString());
      setIsSettingsOpen(false);
      toast.success("Taux mis à jour", `Le ROI sera calculé sur une base de ${newRate}€/h`);
  };

  useEffect(() => {
    if (userId) {
      // Détection changement d'utilisateur (vs changement de filtre)
      const isUserChange = prevUserIdRef.current !== userId;
      prevUserIdRef.current = userId;

      if (isUserChange) {
          setUserName(''); 
          setStats({
            totalExecutions: 0,
            totalExecutionsPrev: 0,
            activeAutomations: 0,
            successRate: 0,
            minutesSaved: 0,
            topAutomationName: ''
          });
          setDailyActivityData([]);
          setDistributionData([]);
      }
      
      setIsLoading(true);
      fetchDashboardData();

      const channelName = `dashboard_main_${userId}`;
      const channel = supabase.channel(channelName)
        .on('postgres_changes', { 
            event: '*', 
            schema: 'public', 
            table: 'automations',
            filter: `user_id=eq.${userId}`
        }, () => fetchDashboardData())
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'automation_logs' }, () => fetchDashboardData())
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }
  }, [userId, timeRange]);

  const fetchDashboardData = async () => {
    try {
      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', userId).single();
      if (profile?.full_name) {
          setUserName(profile.full_name.split(' ')[0]);
      } else {
          setUserName('Client');
      }

      const { data: automations } = await supabase.from('automations').select('id, name, status').eq('user_id', userId);
      
      const activeAutosCount = automations?.filter(a => a.status === 'active').length || 0;
      const automationNames = new Map<string, string>(automations?.map(a => [a.id, a.name] as [string, string]) || []);
      const userAutomationIds = automations?.map(a => a.id) || [];

      const now = new Date();
      let startDate = new Date();
      let prevStartDate = new Date();
      let prevEndDate = new Date();

      if (timeRange === 'month') {
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          prevStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          prevEndDate = new Date(now.getFullYear(), now.getMonth(), 0);
      } else if (timeRange === 'quarter') {
          const currentQuarter = Math.floor(now.getMonth() / 3);
          startDate = new Date(now.getFullYear(), currentQuarter * 3, 1);
          prevStartDate = new Date(now.getFullYear(), (currentQuarter - 1) * 3, 1);
          prevEndDate = new Date(now.getFullYear(), currentQuarter * 3, 0);
      } else if (timeRange === 'year') {
          startDate = new Date(now.getFullYear(), 0, 1);
          prevStartDate = new Date(now.getFullYear() - 1, 0, 1);
          prevEndDate = new Date(now.getFullYear() - 1, 11, 31);
      } else { // 'all'
          startDate = new Date(0); 
          prevStartDate = new Date(0); 
          prevEndDate = new Date(0);
      }

      let currentLogs: any[] = [];
      let prevLogs: any[] = [];

      if (userAutomationIds.length > 0) {
          const fetchStart = timeRange === 'all' ? startDate : prevStartDate;
          
          const { data: logs } = await supabase
            .from('automation_logs')
            .select('created_at, status, minutes_saved, automation_id')
            .in('automation_id', userAutomationIds)
            .gte('created_at', fetchStart.toISOString())
            .order('created_at', { ascending: true });

          if (logs) {
              currentLogs = logs.filter(l => new Date(l.created_at) >= startDate);
              if (timeRange !== 'all') {
                  prevLogs = logs.filter(l => {
                      const d = new Date(l.created_at);
                      return d >= prevStartDate && d <= prevEndDate;
                  });
              }
          }
      }

      const totalExecs = currentLogs.length;
      const totalExecsPrev = prevLogs.length;
      
      const successCount = currentLogs.filter(l => l.status === 'success').length;
      const successRate = totalExecs > 0 ? Math.round((successCount / totalExecs) * 100) : 100;
      const minutesSaved = currentLogs.reduce((acc, l) => acc + (l.minutes_saved || 0), 0);

      const last14DaysMap = new Map<string, { success: number, error: number, date: string, shortDate: string }>();
      for (let i = 13; i >= 0; i--) {
         const d = new Date();
         d.setDate(d.getDate() - i);
         const key = d.toISOString().split('T')[0];
         const shortDate = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
         last14DaysMap.set(key, { success: 0, error: 0, date: key, shortDate });
      }

      currentLogs.forEach(l => {
          const d = new Date(l.created_at);
          const key = d.toISOString().split('T')[0];
          if (last14DaysMap.has(key)) {
              const entry = last14DaysMap.get(key)!;
              if (l.status === 'success') entry.success++;
              else entry.error++;
          }
      });
      const formattedBarData = Array.from(last14DaysMap.values());

      const distributionMap = new Map<string, number>();
      currentLogs.forEach(l => {
          const name = automationNames.get(l.automation_id as string) || 'Inconnu';
          distributionMap.set(name, (distributionMap.get(name) || 0) + 1);
      });

      const sortedDistribution = Array.from(distributionMap.entries()).sort((a, b) => b[1] - a[1]);
      
      let finalDistribution = [];
      if (sortedDistribution.length > 4) {
          const top4 = sortedDistribution.slice(0, 4);
          const others = sortedDistribution.slice(4).reduce((acc, curr) => acc + curr[1], 0);
          finalDistribution = top4.map(([name, value]) => ({ name, value }));
          finalDistribution.push({ name: 'Autres', value: others });
      } else {
          finalDistribution = sortedDistribution.map(([name, value]) => ({ name, value }));
      }

      const topAuto = sortedDistribution.length > 0 ? sortedDistribution[0][0] : '';

      setStats({
          totalExecutions: totalExecs,
          totalExecutionsPrev: totalExecsPrev,
          activeAutomations: activeAutosCount,
          successRate,
          minutesSaved,
          topAutomationName: topAuto
      });
      setDailyActivityData(formattedBarData);
      setDistributionData(finalDistribution);

    } catch (error) {
      console.error("Dashboard data error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getGreeting = () => {
      const h = new Date().getHours();
      if (h < 18) return 'Bonjour';
      return 'Bonsoir';
  };

  const formatTimeSaved = (minutes: number) => {
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      return { h, m };
  };

  const moneySaved = Math.round((stats.minutesSaved / 60) * hourlyRate);

  let trend = 0;
  if (stats.totalExecutionsPrev > 0) {
      trend = Math.round(((stats.totalExecutions - stats.totalExecutionsPrev) / stats.totalExecutionsPrev) * 100);
  } else if (stats.totalExecutions > 0 && timeRange !== 'all') {
      trend = 100;
  }

  const getTrendLabel = () => {
      if (timeRange === 'month') return 'vs M-1';
      if (timeRange === 'quarter') return 'vs T-1';
      if (timeRange === 'year') return 'vs N-1';
      return '';
  };

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#06b6d4'];

  const handleNewTicket = () => {
      if (onNavigateToSupport) onNavigateToSupport('bug', "Bonjour, je rencontre un problème sur...");
  };
  const handleNewProject = () => {
      if (onNavigateToSupport) onNavigateToSupport('new', "Demande de nouveau projet d'automatisation :\n\n- Objectif :\n- Délai :");
  };

  const getTimeRangeLabel = () => {
      if (timeRange === 'month') return 'Ce mois-ci';
      if (timeRange === 'quarter') return 'Ce trimestre';
      if (timeRange === 'year') return 'Cette année';
      if (timeRange === 'all') return 'Tout';
      return 'Période';
  };

  const isInitialState = !isLoading && stats.totalExecutions === 0;

  return (
    <div className="pb-10 animate-fade-in-up space-y-8">
      
      <section>
          <div className="mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
              <div>
                  <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight flex items-baseline gap-2">
                      {getGreeting()}, <span className="text-indigo-600">{userName || (isLoading ? '...' : 'Client')}</span>
                  </h1>
                  <div className="flex items-center gap-2 mt-2">
                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-100 shadow-sm">
                           <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                           <span className="text-xs font-bold text-emerald-700 uppercase tracking-wide">Systèmes Opérationnels</span>
                      </div>
                  </div>
              </div>

              <div className="relative group z-20">
                  <div className="flex items-center gap-3 bg-white px-4 py-2.5 rounded-xl shadow-sm border border-slate-200 cursor-pointer hover:border-indigo-300 hover:shadow-md transition-all">
                      <Calendar size={18} className="text-indigo-500" />
                      <select 
                        value={timeRange}
                        onChange={(e) => setTimeRange(e.target.value as TimeRange)}
                        className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer appearance-none pr-6"
                      >
                          <option value="month">Ce mois-ci</option>
                          <option value="quarter">Ce trimestre</option>
                          <option value="year">Cette année</option>
                          <option value="all">Tout l'historique</option>
                      </select>
                      <ChevronDown size={14} className="absolute right-4 text-slate-400 pointer-events-none group-hover:text-indigo-500 transition-colors" />
                  </div>
              </div>
          </div>
          
          <AIInsightsWidget 
            stats={{
                totalExecutions: stats.totalExecutions,
                activeAutomations: stats.activeAutomations,
                activeProjects: 0,
                minutesSaved: stats.minutesSaved,
                successRate: stats.successRate,
                trendPercentage: trend,
                topAutomationName: stats.topAutomationName
            }}
            isLoading={isLoading}
          />
      </section>

      {/* BIENVENUE STATE (ONBOARDING) */}
      {isInitialState && (
          <section className="bg-gradient-to-br from-indigo-600 to-indigo-900 rounded-[2rem] p-10 text-white shadow-2xl relative overflow-hidden animate-fade-in-up">
              <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-white/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/3"></div>
              <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-purple-600/20 rounded-full blur-[80px] translate-y-1/2 -translate-x-1/3"></div>
              
              <div className="relative z-10 flex flex-col md:flex-row items-center gap-12">
                  <div className="flex-1 space-y-6">
                      <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/10 backdrop-blur-md rounded-full border border-white/20 text-xs font-bold uppercase tracking-widest text-indigo-100">
                          <Rocket size={14} /> Initialisation de votre portail
                      </div>
                      <h2 className="text-4xl md:text-5xl font-black leading-tight tracking-tight">
                          Propulsez votre agence <br/>vers l'automatisation.
                      </h2>
                      <p className="text-lg text-indigo-100/80 max-w-xl leading-relaxed">
                          Bienvenue chez <span className="text-white font-bold">SKALIA</span>. Vos automatisations sont en cours de configuration par nos ingénieurs. Dès que les premiers flux seront actifs, vos statistiques de rentabilité et de temps gagné apparaîtront ici.
                      </p>
                      <div className="flex flex-wrap gap-4 pt-4">
                          <button 
                            onClick={handleNewProject}
                            className="px-8 py-4 bg-white text-indigo-600 font-bold rounded-2xl shadow-xl hover:bg-indigo-50 transition-all flex items-center gap-3 transform hover:scale-105 active:scale-95"
                          >
                              Lancer un projet <ArrowUpRight size={20} />
                          </button>
                          <button 
                            onClick={() => onNavigate('automations')}
                            className="px-8 py-4 bg-white/10 backdrop-blur-md border border-white/20 text-white font-bold rounded-2xl hover:bg-white/20 transition-all"
                          >
                              Voir le catalogue
                          </button>
                      </div>
                  </div>
                  <div className="w-full md:w-1/3 flex justify-center">
                       <div className="w-64 h-64 bg-white/5 rounded-full border border-white/10 flex items-center justify-center relative">
                            <div className="w-48 h-48 bg-indigo-500/30 rounded-full animate-pulse flex items-center justify-center">
                                <Sparkles className="text-white w-20 h-20" />
                            </div>
                            {/* Orbital icons */}
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-white rounded-xl shadow-lg flex items-center justify-center text-indigo-600 animate-float">
                                <Zap size={24} />
                            </div>
                            <div className="absolute bottom-10 -right-4 w-14 h-14 bg-emerald-500 rounded-xl shadow-lg flex items-center justify-center text-white animate-float-delayed">
                                <Euro size={24} />
                            </div>
                       </div>
                  </div>
              </div>
          </section>
      )}

      {/* KPI HERO & GRID COMPACTE (MASQUÉ SI INITIAL STATE POUR FOCUS SUR ONBOARDING) */}
      {!isInitialState && (
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="md:col-span-2 relative overflow-hidden rounded-2xl p-6 shadow-2xl bg-slate-900 text-white border border-slate-800 group transition-all duration-300">
                  <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-indigo-600/30 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/3 group-hover:bg-indigo-500/40 transition-colors duration-700"></div>
                  <div className="absolute bottom-0 left-0 w-[200px] h-[200px] bg-purple-600/20 rounded-full blur-[60px] translate-y-1/3 -translate-x-1/3"></div>
                  
                  <div className="relative z-10 h-full flex flex-col justify-between">
                      <div className="flex justify-between items-start">
                          <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-sm border border-white/10 text-indigo-300">
                              {viewMode === 'time' ? <Clock size={24} /> : <Euro size={24} />}
                          </div>
                          
                          <div className="flex items-center gap-3">
                              <div className="bg-white/10 p-1 rounded-lg border border-white/10 flex items-center backdrop-blur-sm">
                                  <button onClick={() => setViewMode('time')} className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase transition-all ${viewMode === 'time' ? 'bg-white text-indigo-900 shadow-sm' : 'text-indigo-200 hover:text-white'}`}>Temps</button>
                                  <button onClick={() => setViewMode('money')} className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase transition-all ${viewMode === 'money' ? 'bg-emerald-500 text-white shadow-sm' : 'text-indigo-200 hover:text-white'}`}>Argent</button>
                              </div>
                              <div className="relative">
                                <button onClick={() => setIsSettingsOpen(!isSettingsOpen)} className="p-2 bg-white/5 hover:bg-white/20 rounded-lg border border-white/10 text-indigo-200 hover:text-white transition-colors"><Settings size={16} /></button>
                                {isSettingsOpen && (
                                    <div className="absolute top-10 right-0 bg-white p-4 rounded-xl shadow-2xl border border-slate-200 w-64 z-50 text-slate-800 animate-fade-in">
                                        <h4 className="text-xs font-bold uppercase text-slate-400 mb-2">Paramètre ROI</h4>
                                        <p className="text-sm font-medium mb-2">Votre taux horaire moyen (€)</p>
                                        <input type="number" defaultValue={hourlyRate} onBlur={(e) => saveHourlyRate(parseInt(e.target.value))} onKeyDown={(e) => { if (e.key === 'Enter') saveHourlyRate(parseInt(e.currentTarget.value)) }} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-2 focus:ring-2 focus:ring-indigo-500 outline-none" />
                                        <p className="text-[10px] text-slate-400">Appuyez sur Entrée pour valider.</p>
                                    </div>
                                )}
                              </div>
                          </div>
                      </div>

                      <div className="mt-4">
                          <div className="flex items-center gap-2 mb-1">
                              <p className={`font-bold text-xs uppercase tracking-widest ${viewMode === 'money' ? 'text-emerald-300' : 'text-indigo-200'}`}>{viewMode === 'time' ? 'Temps Économisé' : 'Argent Économisé'}</p>
                          </div>
                          <div className="flex items-baseline gap-1.5 min-h-[50px]">
                              {viewMode === 'time' ? (
                                  <><span className="text-5xl font-extrabold tracking-tighter text-white drop-shadow-sm">{isLoading ? '-' : <CountUp end={formatTimeSaved(stats.minutesSaved).h} />}</span><span className="text-xl font-medium text-indigo-300">h</span><span className="text-3xl font-bold tracking-tight text-white/80 ml-1">{isLoading ? '-' : <CountUp end={formatTimeSaved(stats.minutesSaved).m} />}</span><span className="text-lg font-medium text-indigo-300">m</span></>
                              ) : (
                                  <><span className="text-5xl font-extrabold tracking-tighter text-emerald-400 drop-shadow-sm">{isLoading ? '-' : <CountUp end={moneySaved} />}</span><span className="text-2xl font-medium text-emerald-600 ml-1">€</span></>
                              )}
                          </div>
                          <p className="text-slate-400 text-xs mt-3 font-medium leading-relaxed border-t border-white/10 pt-3">
                              {viewMode === 'time' ? <span>Vos automatisations ont absorbé l'équivalent de <strong className="text-white">{(stats.minutesSaved / (7 * 60)).toFixed(1)} jours</strong> de travail humain.</span> : <span>Calculé sur une base de <strong className="text-white">{hourlyRate}€/h</strong> ({getTimeRangeLabel()}).</span>}
                          </p>
                      </div>
                  </div>
              </div>

              <div className="bg-gradient-to-br from-white to-violet-50/50 p-6 rounded-2xl border border-violet-100 shadow-sm flex flex-col justify-between group hover:border-violet-200 hover:shadow-lg transition-all relative overflow-hidden">
                  <div className="flex justify-between items-start mb-2 relative z-10">
                      <div className="p-2.5 bg-white text-violet-600 rounded-xl border border-violet-100 shadow-sm group-hover:scale-105 transition-transform duration-300"><Zap size={20} /></div>
                      {timeRange !== 'all' && (
                          <span className={`text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 border ${trend >= 0 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>{trend > 0 ? '+' : ''}{trend}% {getTrendLabel()}</span>
                      )}
                  </div>
                  <div className="relative z-10"><p className="text-3xl font-extrabold text-slate-900 tracking-tight">{isLoading ? '-' : <CountUp end={stats.totalExecutions} />}</p><p className="text-[10px] font-bold text-violet-400 uppercase tracking-wide mt-1">Volume traité</p></div>
                  <div className="mt-2 pt-3 border-t border-violet-100 relative z-10"><p className="text-[10px] text-slate-500 font-medium">Exécutions réussies ({getTimeRangeLabel().toLowerCase()}).</p></div>
              </div>

              <div className="flex flex-col gap-4">
                  <div className="flex-1 bg-gradient-to-br from-white to-emerald-50/60 p-4 rounded-2xl border border-emerald-100 shadow-sm flex items-center justify-between group hover:border-emerald-200 transition-all relative overflow-hidden">
                      <div className="relative z-10"><p className="text-[10px] font-bold text-emerald-600/80 uppercase tracking-wide mb-0.5">Taux de succès</p><p className="text-2xl font-extrabold text-slate-900">{isLoading ? '-' : <CountUp end={stats.successRate} suffix="%" />}</p><p className="text-[9px] text-slate-400 mt-1">Fiabilité système</p></div>
                      <div className="h-10 w-10 rounded-full border border-emerald-100 flex items-center justify-center text-emerald-600 bg-white shadow-sm group-hover:scale-105 transition-transform z-10"><CheckCircle2 size={18} /></div>
                  </div>
                  <div className="flex-1 bg-gradient-to-br from-white to-indigo-50/60 p-4 rounded-2xl border border-indigo-100 shadow-sm flex items-center justify-between group hover:border-indigo-200 transition-all relative overflow-hidden">
                      <div className="relative z-10"><p className="text-[10px] font-bold text-indigo-600/80 uppercase tracking-wide mb-0.5">Automatisations</p><p className="text-2xl font-extrabold text-slate-900">{isLoading ? '-' : <CountUp end={stats.activeAutomations} />}</p><p className="text-[9px] text-slate-400 mt-1">Actives en production</p></div>
                      <div className="h-10 w-10 rounded-full border border-indigo-100 flex items-center justify-center text-indigo-600 bg-white shadow-sm group-hover:scale-105 transition-transform z-10"><Layers size={18} /></div>
                  </div>
              </div>
          </section>
      )}

      {/* 3. WIDGET ACTIONS */}
      <section className="bg-white rounded-2xl border border-slate-200 p-2 shadow-sm flex flex-wrap gap-2 animate-fade-in-up delay-100">
            <button onClick={handleNewTicket} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-50 hover:bg-red-50 hover:text-red-600 hover:border-red-100 border border-slate-100 rounded-xl text-xs font-bold text-slate-600 transition-all group">
                <AlertCircle size={16} className="text-slate-400 group-hover:text-red-500" />Signaler un Bug
            </button>
            <button onClick={handleNewProject} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-100 border border-slate-100 rounded-xl text-xs font-bold text-slate-600 transition-all group">
                <Plus size={16} className="text-slate-400 group-hover:text-indigo-500" />Nouveau Projet
            </button>
            <button onClick={() => onNavigate('invoices')} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-50 hover:bg-amber-50 hover:text-amber-600 hover:border-amber-100 border border-slate-100 rounded-xl text-xs font-bold text-slate-600 transition-all group">
                <FileText size={16} className="text-slate-400 group-hover:text-amber-500" />Factures
            </button>
      </section>

      {/* 4. GRAPHIQUES AVEC ETAT VIDE SI PAS DE RUNS */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-5 h-[320px]">
          
          {/* GRAPHIQUE 1 : Bar Chart */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-lg shadow-slate-100/50 p-6 flex flex-col relative overflow-hidden">
              <div className="flex justify-between items-center mb-6 relative z-10">
                  <div><h3 className="text-base font-bold text-slate-900">Activité Journalière</h3><p className="text-xs text-slate-500 font-medium">Volume d'exécutions sur les 14 derniers jours</p></div>
                  {!isInitialState && (
                    <div className="flex gap-3 text-[10px] font-bold bg-slate-50 p-1 rounded-lg border border-slate-100">
                        <span className="flex items-center gap-1.5 px-2 py-1 bg-white rounded shadow-sm text-slate-700 border border-slate-100"><span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span> Succès</span>
                        <span className="flex items-center gap-1.5 px-2 py-1 text-slate-500 hover:bg-white hover:shadow-sm rounded transition-all"><span className="w-1.5 h-1.5 rounded-full bg-red-400"></span> Erreurs</span>
                    </div>
                  )}
              </div>
              
              <div className="flex-1 w-full min-h-0 relative z-10 flex items-center justify-center">
                  {isLoading ? <Skeleton className="w-full h-full rounded-xl" /> : isInitialState ? (
                      <div className="flex flex-col items-center gap-2 text-slate-400 opacity-60">
                          <Activity size={40} className="stroke-1" />
                          <p className="text-sm font-medium">En attente des premières données...</p>
                      </div>
                  ) : (
                      <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={dailyActivityData} barSize={20} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                              <defs>
                                  <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6366f1" stopOpacity={1}/><stop offset="100%" stopColor="#4f46e5" stopOpacity={1}/></linearGradient>
                                  <linearGradient id="errorGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f87171" stopOpacity={1}/><stop offset="100%" stopColor="#ef4444" stopOpacity={1}/></linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                              <XAxis dataKey="shortDate" tick={{fontSize: 10, fill: '#94a3b8', fontWeight: 500}} axisLine={false} tickLine={false} dy={10}/>
                              <YAxis tick={{fontSize: 10, fill: '#94a3b8', fontWeight: 500}} axisLine={false} tickLine={false} />
                              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc', radius: 6 }} />
                              <Bar dataKey="success" stackId="a" fill="url(#barGradient)" radius={[0, 0, 4, 4]} />
                              <Bar dataKey="error" stackId="a" fill="url(#errorGradient)" radius={[4, 4, 0, 0]} />
                          </BarChart>
                      </ResponsiveContainer>
                  )}
              </div>
          </div>

          {/* GRAPHIQUE 2 : Donut */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-lg shadow-slate-100/50 p-6 flex flex-col relative">
              <h3 className="text-base font-bold text-slate-900 mb-1">Répartition de la charge</h3>
              <p className="text-xs text-slate-500 font-medium mb-4">Utilisation par processus ({getTimeRangeLabel().toLowerCase()})</p>
              
              <div className="flex-1 w-full min-h-0 relative flex items-center justify-center">
                  {isLoading ? <Skeleton className="w-full h-full rounded-full" variant="circular" /> : (
                      distributionData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={distributionData} cx="50%" cy="50%" innerRadius={55} outerRadius={75} paddingAngle={3} dataKey="value" stroke="none" cornerRadius={4}>
                                    {distributionData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                </Pie>
                                <Tooltip content={<CustomTooltip />} />
                                <Legend verticalAlign="bottom" height={24} iconType="circle" iconSize={6} formatter={(value) => <span className="text-slate-600 font-medium ml-1 text-[10px]">{value}</span>}/>
                            </PieChart>
                        </ResponsiveContainer>
                      ) : (
                          <div className="flex flex-col items-center gap-2 text-slate-400 opacity-60">
                              <Layers size={40} className="stroke-1" />
                              <p className="text-sm font-medium">Aucun flux détecté</p>
                          </div>
                      )
                  )}
                  {!isLoading && distributionData.length > 0 && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-6">
                          <span className="text-2xl font-extrabold text-slate-800">{stats.totalExecutions}</span>
                          <span className="text-[9px] text-slate-400 uppercase font-bold tracking-widest">Runs</span>
                      </div>
                  )}
              </div>
          </div>
      </section>

      {/* 5. FLUX D'ACTIVITÉ */}
      <RecentActivityFeed userId={userId} />

    </div>
  );
};

export default Dashboard;
