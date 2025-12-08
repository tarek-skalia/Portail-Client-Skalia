
import React, { useEffect, useState, useRef } from 'react';
import { Project } from '../types';
import { Search, Filter, ArrowUpDown } from 'lucide-react';
import { supabase } from '../lib/supabase';
import Skeleton from './Skeleton';

interface ProjectsPipelineProps {
  projects: Project[];
  userId?: string;
  highlightedProjectId?: string | null;
}

const ProjectsPipeline: React.FC<ProjectsPipelineProps> = ({ projects: initialProjects, userId, highlightedProjectId }) => {
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [isLoading, setIsLoading] = useState(true);
  
  const hasScrolledRef = useRef<string | null>(null);

  useEffect(() => {
    if (userId) {
        fetchProjects();

        const channel = supabase
            .channel('realtime:projects_pipeline')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => {
                fetchProjects();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }
  }, [userId]);

  useEffect(() => {
    if (highlightedProjectId && projects.length > 0 && hasScrolledRef.current !== highlightedProjectId) {
        setTimeout(() => {
            const element = document.getElementById(`project-card-${highlightedProjectId}`);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                hasScrolledRef.current = highlightedProjectId;
            }
        }, 100);
    }
  }, [highlightedProjectId, projects]);

  const fetchProjects = async () => {
    const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Erreur chargement projets:', error);
    } else if (data) {
        const mappedProjects: Project[] = data.map((p: any) => ({
            id: p.id,
            clientId: p.user_id,
            title: p.title,
            description: p.description || '',
            status: p.status,
            startDate: p.start_date ? new Date(p.start_date).toLocaleDateString('fr-FR') : '-',
            endDate: p.end_date ? new Date(p.end_date).toLocaleDateString('fr-FR') : '-',
        }));
        setProjects(mappedProjects);
    }
    setIsLoading(false);
  };

  const columns = [
    { id: 'uncategorized', label: 'Non catégorisé', color: 'border border-slate-300 text-slate-600 bg-white' },
    { id: 'onboarding', label: 'Onboarding', color: 'bg-amber-400 text-white border-transparent' },
    { id: 'in_progress', label: 'En cours', color: 'bg-blue-500 text-white border-transparent' },
    { id: 'review', label: 'En révision', color: 'bg-purple-500 text-white border-transparent' },
    { id: 'completed', label: 'Terminé', color: 'bg-emerald-500 text-white border-transparent' },
  ];

  const getProjectsByStatus = (status: string) => {
    return projects.filter(p => p.status === status);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] animate-fade-in-up">
      {/* Toolbar */}
      <div className="flex justify-end items-center gap-6 mb-6 px-1">
         <button className="text-sm font-medium text-slate-600 hover:text-slate-900 flex items-center gap-2 transition-colors hover:bg-slate-100 px-3 py-1.5 rounded-lg">
            Filtre
            <Filter size={16} />
         </button>
         <button className="text-sm font-medium text-slate-600 hover:text-slate-900 flex items-center gap-2 transition-colors hover:bg-slate-100 px-3 py-1.5 rounded-lg">
            Trier
            <ArrowUpDown size={16} />
         </button>
         <button className="p-2 hover:bg-slate-200/50 rounded-full text-slate-500 transition-colors">
            <Search size={20} />
         </button>
      </div>

      {/* Board */}
      <div className="flex-1 flex gap-0 overflow-x-auto py-4 scrollbar-hide">
        {columns.map((col, index) => {
            const colProjects = getProjectsByStatus(col.id);
            const isLast = index === columns.length - 1;

            return (
                <div key={col.id} className="min-w-[340px] w-[340px] flex flex-col px-4 relative group/column">
                    
                    {!isLast && (
                        <div className="absolute right-0 top-8 bottom-8 w-px bg-gradient-to-b from-transparent via-[#4338ca]/30 to-transparent"></div>
                    )}

                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <span className={`px-4 py-1.5 rounded-full text-sm font-bold shadow-sm ${col.color} transition-transform duration-300 group-hover/column:scale-105`}>
                            {col.label}
                        </span>
                        <span className="text-slate-400 text-sm font-medium pr-1">
                            {isLoading ? '...' : colProjects.length}
                        </span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 space-y-4">
                        {isLoading ? (
                            // Skeletons pour chaque colonne (1 ou 2 fausses cartes)
                            <>
                                <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm space-y-3">
                                    <Skeleton className="h-5 w-3/4" />
                                    <Skeleton className="h-3 w-full" />
                                    <Skeleton className="h-3 w-2/3" />
                                    <div className="flex justify-between pt-2">
                                        <Skeleton className="h-3 w-16" />
                                        <Skeleton className="h-3 w-16" />
                                    </div>
                                </div>
                                {index % 2 === 0 && (
                                    <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm space-y-3">
                                        <Skeleton className="h-5 w-1/2" />
                                        <Skeleton className="h-3 w-full" />
                                    </div>
                                )}
                            </>
                        ) : colProjects.length === 0 ? (
                            <div className="h-24 flex items-center justify-center opacity-50">
                                <span className="text-slate-300 text-sm font-medium italic">Aucun dossier</span>
                            </div>
                        ) : (
                            colProjects.map(project => {
                                const isHighlighted = project.id === highlightedProjectId;
                                
                                return (
                                    <div 
                                        key={project.id} 
                                        id={`project-card-${project.id}`}
                                        className={`
                                            bg-white p-5 rounded-xl border transition-all duration-300 cursor-pointer group
                                            ${isHighlighted 
                                                ? 'border-indigo-500 shadow-[0_0_30px_rgba(99,102,241,0.4)] scale-[1.05] ring-2 ring-indigo-500 ring-offset-2 z-10' 
                                                : 'border-slate-200 shadow-sm hover:shadow-lg hover:shadow-indigo-100/50 hover:border-indigo-200 hover:-translate-y-1 hover:scale-[1.02]'
                                            }
                                        `}
                                    >
                                        <h3 className="font-bold text-slate-900 mb-3 text-base leading-tight group-hover:text-indigo-700 transition-colors">
                                            {project.title}
                                        </h3>
                                        
                                        <div className="mb-4">
                                            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wide mb-1.5">Description / Notes (fr)</p>
                                            <p className="text-sm text-slate-600 leading-relaxed line-clamp-3">
                                                {project.description}
                                            </p>
                                        </div>

                                        <div className="space-y-1 pt-3 border-t border-slate-50">
                                            <div className="flex justify-between text-xs">
                                                <span className="text-slate-400 font-medium">Date de début</span>
                                                <span className="font-semibold text-slate-700">{project.startDate}</span>
                                            </div>
                                            <div className="flex justify-between text-xs">
                                                <span className="text-slate-400 font-medium">Date de fin</span>
                                                <span className="font-semibold text-slate-700">{project.endDate}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )
        })}
      </div>
    </div>
  );
};

export default ProjectsPipeline;
