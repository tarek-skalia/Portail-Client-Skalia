
import React, { useEffect, useState } from 'react';
import { Automation } from '../types';
import { Activity, CheckCircle2, XCircle, AlertCircle, Clock, PauseCircle, Play, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import Skeleton from './Skeleton';

interface AutomationsListProps {
  userId?: string;
}

const AutomationsList: React.FC<AutomationsListProps> = ({ userId }) => {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (userId) {
        fetchAutomations();

        // Realtime Subscription
        const channel = supabase
            .channel('realtime:automations')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'automations' }, () => {
                fetchAutomations();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }
  }, [userId]);

  const fetchAutomations = async () => {
    const { data, error } = await supabase
        .from('automations')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Erreur chargement automations:', error);
    } else if (data) {
        const mapped: Automation[] = data.map((item: any) => ({
            id: item.id,
            clientId: item.user_id,
            name: item.name,
            description: item.description || '',
            status: item.status,
            lastRun: item.last_run || 'Jamais',
            runsThisMonth: item.runs_this_month || 0,
            toolIcons: item.tool_icons || []
        }));
        setAutomations(mapped);
    }
    setIsLoading(false);
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

  if (isLoading) {
      // Skeleton View
      return (
        <div className="space-y-6">
            <div className="flex justify-between items-end mb-8">
                <div className="space-y-2">
                    <Skeleton className="h-8 w-64" />
                    <Skeleton className="h-4 w-96" />
                </div>
                <Skeleton className="h-8 w-24 rounded-xl" />
            </div>
            <div className="grid grid-cols-1 gap-5">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col md:flex-row gap-6">
                        <div className="flex-1 flex gap-5">
                            <Skeleton className="w-12 h-12 rounded-xl shrink-0" />
                            <div className="flex-1 space-y-3">
                                <Skeleton className="h-6 w-1/3" />
                                <Skeleton className="h-4 w-3/4" />
                                <div className="flex gap-2 pt-2">
                                    <Skeleton className="h-6 w-16 rounded-lg" />
                                    <Skeleton className="h-6 w-16 rounded-lg" />
                                </div>
                            </div>
                        </div>
                        <div className="md:w-48 flex gap-4 border-t md:border-t-0 md:border-l border-slate-50 pt-4 md:pt-0 md:pl-6">
                             <div className="space-y-2 flex-1">
                                <Skeleton className="h-3 w-20" />
                                <Skeleton className="h-5 w-24" />
                             </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      );
  }

  if (automations.length === 0) {
    return (
        <div className="flex flex-col items-center justify-center h-[50vh] bg-white/50 rounded-3xl border border-dashed border-slate-300 animate-fade-in-up">
            <div className="p-6 bg-indigo-50 rounded-full mb-6">
                <Activity className="text-indigo-400 w-10 h-10" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800">Aucune automatisation</h3>
            <p className="text-slate-500 mt-2">Ce compte n'a pas encore de workflow configuré.</p>
        </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end mb-8 animate-fade-in-up">
        <div>
            <h2 className="text-2xl font-bold text-slate-900">Mes Automatisations</h2>
            <p className="text-slate-500 text-sm mt-2">Vue d'ensemble de vos processus automatisés.</p>
        </div>
        <div className="bg-white px-4 py-2 rounded-xl text-sm font-semibold text-slate-700 shadow-sm border border-slate-100 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            {automations.length} actifs
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5">
        {automations.map((auto, index) => {
          const statusStyle = getStatusStyle(auto.status);
          const delayClass = index === 0 ? '' : index === 1 ? 'delay-100' : index === 2 ? 'delay-200' : 'delay-300';
          
          return (
            <div 
                key={auto.id} 
                className={`bg-white rounded-2xl p-6 border border-slate-100 transition-all duration-300 ease-out group animate-fade-in-up ${delayClass} hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-100/50 cursor-default`}
            >
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
                    <div className="flex flex-wrap gap-2 mt-4">
                        {auto.toolIcons.map((tool, idx) => (
                            <span key={idx} className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 font-medium hover:bg-white hover:border-indigo-200 hover:text-indigo-600 transition-all cursor-default">
                                {tool}
                            </span>
                        ))}
                    </div>
                  </div>
                </div>

                {/* Right: Metrics & Actions */}
                <div className="flex items-center gap-8 border-t md:border-t-0 md:border-l border-slate-100 pt-5 md:pt-0 md:pl-8 shrink-0">
                    <div className="grid grid-cols-2 md:grid-cols-1 gap-4 md:gap-3 min-w-[150px]">
                        <div className="flex flex-col">
                            <span className="text-xs text-slate-400 uppercase tracking-wide font-medium">Dernier run</span>
                            <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                                <Clock size={14} className="text-slate-400" />
                                {auto.lastRun}
                            </div>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xs text-slate-400 uppercase tracking-wide font-medium">Runs / Mois</span>
                            <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                                <Play size={14} className="text-slate-400" />
                                {auto.runsThisMonth}
                            </div>
                        </div>
                    </div>
                    
                    <button className="hidden md:flex w-10 h-10 rounded-full bg-slate-50 text-slate-400 items-center justify-center hover:bg-indigo-600 hover:text-white transition-all duration-300 shadow-sm hover:shadow-indigo-500/30 group-hover:bg-indigo-600 group-hover:text-white group-hover:translate-x-1">
                        <ArrowRight size={18} />
                    </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AutomationsList;
