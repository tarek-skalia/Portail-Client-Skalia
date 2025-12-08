
import React, { useEffect, useState } from 'react';
import KPICard from './KPICard';
import ChartCard from './ChartCard';
import Skeleton from './Skeleton';
import { MOCK_CHART_DATA_TIME, MOCK_CHART_DATA_EXEC, MOCK_CHART_DATA_COST } from '../constants';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  AreaChart, 
  Area,
  LineChart,
  Line
} from 'recharts';
import { supabase } from '../lib/supabase';

interface DashboardProps {
  userId?: string;
}

const Dashboard: React.FC<DashboardProps> = ({ userId }) => {
  const [stats, setStats] = useState({
    totalExecutions: 0,
    activeAutomations: 0,
    activeProjects: 0,
    pendingInvoicesAmount: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (userId) {
      fetchDashboardStats();

      const automationChannel = supabase
        .channel('dashboard-automations')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'automations' }, () => {
          fetchDashboardStats();
        })
        .subscribe();

      const projectChannel = supabase
        .channel('dashboard-projects')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => {
          fetchDashboardStats();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(automationChannel);
        supabase.removeChannel(projectChannel);
      };
    }
  }, [userId]);

  const fetchDashboardStats = async () => {
    try {
      const { data: automations } = await supabase
        .from('automations')
        .select('runs_this_month, status')
        .eq('user_id', userId);

      const totalExecutions = automations?.reduce((acc, curr) => acc + (curr.runs_this_month || 0), 0) || 0;
      const activeAutomations = automations?.filter(a => a.status === 'active').length || 0;

      // On compte tout ce qui n'est pas 'completed' ou 'uncategorized' comme actif pour le client
      const { count: projectsCount } = await supabase
        .from('projects')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .in('status', ['onboarding', 'in_progress', 'review']);

      setStats({
        totalExecutions,
        activeAutomations,
        activeProjects: projectsCount || 0,
        pendingInvoicesAmount: 0
      });

    } catch (error) {
      console.error("Erreur chargement dashboard:", error);
    } finally {
      setTimeout(() => setIsLoading(false), 500); 
    }
  };

  const moneySaved = Math.round(stats.totalExecutions * 1.5);

  return (
    <div className="space-y-10 pb-10 animate-fade-in-up">
      
      {/* 1. Vue d'ensemble */}
      <section>
        <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
          <span className="w-1.5 h-6 bg-indigo-600 rounded-full"></span>
          Vue d'ensemble
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {isLoading ? (
            <>
               {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="p-6 rounded-lg border border-slate-100 bg-white shadow-sm h-32 flex flex-col justify-between">
                     <Skeleton className="h-4 w-1/2" />
                     <Skeleton className="h-10 w-3/4" />
                     <Skeleton className="h-3 w-1/3" />
                  </div>
               ))}
            </>
          ) : (
            <>
              <KPICard 
                title="Automatisations Actives" 
                value={stats.activeAutomations.toString()} 
                color="purple"
                subtext="Flux opérationnels"
              />
              <KPICard 
                title="Projets en cours" 
                value={stats.activeProjects.toString()} 
                color="blue" 
                subtext="En développement"
              />
              <KPICard 
                title="Exécutions ce mois" 
                value={stats.totalExecutions.toLocaleString()} 
                color="green" 
                subtext="Actions automatiques"
              />
              <KPICard 
                title="Économie estimée" 
                value={`${moneySaved} €`} 
                color="red" 
                subtext="Basé sur le volume"
              />
            </>
          )}
        </div>
      </section>

      {/* 2. Détails & Graphiques */}
      <section className="delay-100">
        <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
          <span className="w-1.5 h-6 bg-blue-600 rounded-full"></span>
          Performance des systèmes
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          <div className="h-full">
            {isLoading ? (
               <div className="bg-white rounded-xl border border-gray-100 p-6 h-[300px] flex flex-col gap-6">
                  <Skeleton className="h-4 w-1/2" />
                  <div className="flex-1 flex items-end gap-2">
                     <Skeleton className="w-full h-[40%]" />
                     <Skeleton className="w-full h-[70%]" />
                     <Skeleton className="w-full h-[50%]" />
                     <Skeleton className="w-full h-[80%]" />
                     <Skeleton className="w-full h-[60%]" />
                  </div>
               </div>
            ) : (
              <ChartCard title="Temps gagné par semaine">
                  <BarChart data={MOCK_CHART_DATA_TIME}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8'}} dy={10} />
                  <YAxis hide />
                  <Tooltip 
                      cursor={{fill: '#f8fafc'}} 
                      contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px'}} 
                  />
                  <Bar dataKey="value" fill="#818cf8" radius={[6, 6, 0, 0]} barSize={24} animationDuration={1500} />
                  </BarChart>
              </ChartCard>
            )}
          </div>

          <div className="h-full">
            {isLoading ? (
               <div className="bg-white rounded-xl border border-gray-100 p-6 h-[300px] flex flex-col gap-6">
                  <Skeleton className="h-4 w-1/2" />
                  <div className="flex-1 flex items-end">
                     <Skeleton className="w-full h-full rounded-none rounded-t-xl opacity-50" />
                  </div>
               </div>
            ) : (
              <ChartCard title="Nombre d'exécutions (Tendance)">
                  <LineChart data={MOCK_CHART_DATA_EXEC}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8'}} dy={10} />
                  <YAxis hide />
                  <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px'}} />
                  <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={3} dot={{r: 4, strokeWidth: 2, fill: 'white', stroke: '#3b82f6'}} activeDot={{r: 7, strokeWidth: 0, fill: '#2563eb'}} animationDuration={1500} />
                  </LineChart>
              </ChartCard>
            )}
          </div>

          <div className="h-full">
             {isLoading ? (
               <div className="bg-white rounded-xl border border-gray-100 p-6 h-[300px] flex flex-col gap-6">
                  <Skeleton className="h-4 w-1/2" />
                  <div className="flex-1 flex items-end">
                     <Skeleton className="w-full h-[80%] rounded-none rounded-t-xl opacity-30" />
                  </div>
               </div>
            ) : (
              <ChartCard title="Coût économisé (€)">
                  <AreaChart data={MOCK_CHART_DATA_COST}>
                  <defs>
                      <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ec4899" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#ec4899" stopOpacity={0}/>
                      </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8'}} dy={10} />
                  <YAxis hide />
                  <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px'}} />
                  <Area type="monotone" dataKey="value" stroke="#ec4899" fill="url(#colorCost)" strokeWidth={3} animationDuration={1500} />
                  </AreaChart>
              </ChartCard>
            )}
          </div>

        </div>
      </section>
    </div>
  );
};

export default Dashboard;
