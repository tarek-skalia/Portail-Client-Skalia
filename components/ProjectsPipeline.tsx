
import React, { useEffect, useState, useRef } from 'react';
import { Project } from '../types';
import { Search, Filter, Calendar, CheckSquare, AlertTriangle, Layers } from 'lucide-react';
import { supabase } from '../lib/supabase';
import Skeleton from './Skeleton';
import ProjectSlideOver from './ProjectSlideOver';
import { useToast } from './ToastProvider';

interface ProjectsPipelineProps {
  projects: Project[];
  userId?: string;
  highlightedProjectId?: string | null;
}

const ProjectsPipeline: React.FC<ProjectsPipelineProps> = ({ projects: initialProjects, userId, highlightedProjectId }) => {
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // SlideOver State
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isSlideOverOpen, setIsSlideOverOpen] = useState(false);

  const hasScrolledRef = useRef<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    if (userId) {
        fetchProjects();

        // Écoute les changements sur la table projects
        const projectChannel = supabase
            .channel('realtime:projects_pipeline')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => {
                fetchProjects();
            })
            .subscribe();

        // Écoute AUSSI les changements sur la nouvelle table des tâches pour mettre à jour la barre de progression en temps réel
        const tasksChannel = supabase
            .channel('realtime:project_tasks_update')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'project_tasks' }, () => {
                fetchProjects();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(projectChannel);
            supabase.removeChannel(tasksChannel);
        };
    }
  }, [userId]);

  // NOUVEAU : Synchronisation en temps réel du panneau latéral
  // Si 'projects' change (via fetchProjects), on met à jour 'selectedProject' pour que le SlideOver affiche les nouvelles tâches/ressources
  useEffect(() => {
      if (selectedProject && projects.length > 0) {
          const updatedSelectedProject = projects.find(p => p.id === selectedProject.id);
          if (updatedSelectedProject) {
              // Vérification profonde simplifiée pour voir si on doit rafraîchir le slideover
              const hasTasksChanged = JSON.stringify(updatedSelectedProject.tasks) !== JSON.stringify(selectedProject.tasks);
              const hasResourcesChanged = JSON.stringify(updatedSelectedProject.resources) !== JSON.stringify(selectedProject.resources);
              const hasProgressChanged = updatedSelectedProject.progress !== selectedProject.progress;

              if (hasTasksChanged || hasResourcesChanged || hasProgressChanged) {
                  setSelectedProject(updatedSelectedProject);
              }
          }
      }
  }, [projects]);

  // Scroll automatique vers un projet mis en avant
  useEffect(() => {
    if (highlightedProjectId && projects.length > 0 && hasScrolledRef.current !== highlightedProjectId) {
        setTimeout(() => {
            const element = document.getElementById(`project-card-${highlightedProjectId}`);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                element.classList.add('ring-4', 'ring-indigo-300');
                setTimeout(() => element.classList.remove('ring-4', 'ring-indigo-300'), 2000);
                
                hasScrolledRef.current = highlightedProjectId;
            }
        }, 300);
    }
  }, [highlightedProjectId, projects]);

  const fetchProjects = async () => {
    // On joint la table project_tasks
    const { data, error } = await supabase
        .from('projects')
        .select(`
            *,
            project_tasks (
                id,
                name,
                completed,
                created_at
            )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Erreur chargement projets:', error);
    } else if (data) {
        const mappedProjects: Project[] = data.map((p: any) => {
            
            // Les tâches viennent maintenant de la relation
            const tasks = p.project_tasks ? p.project_tasks.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) : [];
            
            const tasksCount = tasks.length;
            const tasksCompleted = tasks.filter((t: any) => t.completed).length;
            
            // Calcul progression (Toujours calculé dynamiquement, on n'utilise plus p.progress de la DB)
            const calculatedProgress = tasksCount === 0 ? 0 : Math.round((tasksCompleted / tasksCount) * 100);

            // Gestion sécurisée des ressources (JSONB)
            let resources = [];
            if (p.resources && Array.isArray(p.resources)) {
                resources = p.resources;
            }

            return {
                id: p.id,
                clientId: p.user_id,
                title: p.title,
                description: p.description || '',
                status: p.status,
                startDate: p.start_date ? new Date(p.start_date).toLocaleDateString('fr-FR') : '-',
                endDate: p.end_date ? new Date(p.end_date).toLocaleDateString('fr-FR') : '-',
                
                tags: p.tags || [], 
                tasks: tasks,
                resources: resources,
                
                // Champs Calculés dynamiquement
                progress: calculatedProgress,
                tasksCount: tasksCount,
                tasksCompleted: tasksCompleted,
                
                ownerName: p.owner_name || 'Skalia Team'
            };
        });
        setProjects(mappedProjects);
    }
    setIsLoading(false);
  };

  const handleCardClick = (project: Project) => {
      setSelectedProject(project);
      setIsSlideOverOpen(true);
  };

  const columns = [
    { id: 'uncategorized', label: 'Non catégorisé', color: 'border-slate-300 text-slate-600 bg-white' },
    { id: 'onboarding', label: 'Onboarding', color: 'bg-amber-400 text-white border-transparent' },
    { id: 'in_progress', label: 'En cours', color: 'bg-blue-500 text-white border-transparent' },
    { id: 'review', label: 'En révision', color: 'bg-purple-500 text-white border-transparent' },
    { id: 'completed', label: 'Terminé', color: 'bg-emerald-500 text-white border-transparent' },
  ];

  // Logique de Filtrage (Recherche)
  const getProjectsByStatus = (status: string) => {
    return projects.filter(p => {
        const matchesStatus = p.status === status;
        const matchesSearch = searchTerm === '' || 
            p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (p.tags && p.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase())));
        
        return matchesStatus && matchesSearch;
    });
  };

  const isOverdue = (dateStr: string) => {
      if (dateStr === '-') return false;
      const [day, month, year] = dateStr.split('/').map(Number);
      const date = new Date(year, month - 1, day);
      return date < new Date() && date.getFullYear() > 2000;
  };

  return (
    <>
        <div className="flex flex-col h-[calc(100vh-8rem)] animate-fade-in-up">
        {/* Toolbar */}
        <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4 mb-6 px-1">
            <div>
                <h2 className="text-2xl font-bold text-slate-900">Pipeline Projets</h2>
                <p className="text-sm text-slate-500">Gérez l'avancement de vos missions en temps réel.</p>
            </div>
            
            <div className="flex items-center gap-3 w-full md:w-auto">
                <div className="relative flex-1 md:w-64">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Search size={16} />
                    </div>
                    <input 
                        type="text"
                        placeholder="Rechercher un projet, un tag..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
                    />
                </div>
                <button className="p-2 bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-indigo-600 hover:border-indigo-200 transition-colors shadow-sm">
                    <Filter size={18} />
                </button>
            </div>
        </div>

        {/* Board */}
        <div className="flex-1 flex gap-0 overflow-x-auto py-4 scrollbar-hide pb-10">
            {columns.map((col, index) => {
                const colProjects = getProjectsByStatus(col.id);
                const isLast = index === columns.length - 1;
                
                return (
                    <div key={col.id} className="min-w-[360px] w-[360px] flex flex-col px-4 relative group/column">
                        
                        {!isLast && (
                            <div className="absolute right-0 top-8 bottom-8 w-px bg-gradient-to-b from-transparent via-slate-200 to-transparent"></div>
                        )}

                        {/* Column Header */}
                        <div className="mb-6">
                            <div className="flex items-center justify-between mb-2">
                                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide shadow-sm border ${col.color.includes('border-transparent') ? '' : col.color} ${!col.color.includes('border-transparent') ? '' : col.color}`}>
                                    {col.label}
                                </span>
                                <span className="text-slate-400 text-xs font-medium bg-slate-100 px-2 py-0.5 rounded-full">
                                    {colProjects.length}
                                </span>
                            </div>
                            <div className={`h-1 w-full rounded-full opacity-30 ${col.color.split(' ')[0].replace('bg-', 'bg-')}`}></div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 space-y-4">
                            {isLoading ? (
                                <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm space-y-3">
                                    <Skeleton className="h-5 w-3/4" />
                                    <Skeleton className="h-20 w-full" />
                                    <div className="flex justify-between pt-2">
                                        <Skeleton className="h-3 w-16" />
                                    </div>
                                </div>
                            ) : colProjects.length === 0 ? (
                                <div className="h-32 flex flex-col items-center justify-center border-2 border-dashed border-slate-100 rounded-xl bg-slate-50/30">
                                    <Layers size={24} className="text-slate-300 mb-2" />
                                    <span className="text-slate-400 text-xs font-medium">Aucun projet</span>
                                </div>
                            ) : (
                                colProjects.map(project => {
                                    const isHighlighted = project.id === highlightedProjectId;
                                    const overdue = project.status !== 'completed' && isOverdue(project.endDate);

                                    return (
                                        <div 
                                            key={project.id} 
                                            id={`project-card-${project.id}`}
                                            onClick={() => handleCardClick(project)}
                                            className={`
                                                bg-white rounded-xl border p-4 transition-all duration-300 cursor-pointer group relative
                                                ${isHighlighted 
                                                    ? 'border-indigo-500 shadow-[0_0_30px_rgba(99,102,241,0.25)] scale-[1.02] ring-2 ring-indigo-500 z-10' 
                                                    : 'border-slate-200 shadow-sm hover:shadow-lg hover:shadow-indigo-100/40 hover:border-indigo-200 hover:-translate-y-1'
                                                }
                                            `}
                                        >
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="flex flex-wrap gap-1.5">
                                                    {project.tags?.map((tag, i) => (
                                                        <span key={i} className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-wide border border-slate-200">
                                                            {tag}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>

                                            <h3 className="font-bold text-slate-800 text-sm mb-2 leading-snug group-hover:text-indigo-700 transition-colors">
                                                {project.title}
                                            </h3>
                                            <p className="text-xs text-slate-500 line-clamp-2 mb-4 leading-relaxed">
                                                {project.description}
                                            </p>

                                            <div className="space-y-3 pt-3 border-t border-slate-50">
                                                {/* Progress Bar (Calculé automatiquement) */}
                                                <div className="space-y-1.5">
                                                    <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                                                        <span>Progression</span>
                                                        <span>{project.progress}%</span>
                                                    </div>
                                                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                        <div 
                                                            className={`h-full rounded-full transition-all duration-500 ${project.status === 'completed' ? 'bg-emerald-500' : 'bg-indigo-500'}`} 
                                                            style={{ width: `${project.progress}%` }}
                                                        ></div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between">
                                                    <div className={`flex items-center gap-1.5 text-xs font-medium ${overdue ? 'text-red-600 bg-red-50 px-2 py-1 rounded-md' : 'text-slate-500'}`}>
                                                        {overdue ? <AlertTriangle size={12} /> : <Calendar size={12} />}
                                                        <span>{project.endDate}</span>
                                                    </div>

                                                    <div className="flex items-center gap-3">
                                                        {project.tasksCount !== undefined && project.tasksCount > 0 && (
                                                            <div className="flex items-center gap-1 text-xs text-slate-400" title="Tâches terminées">
                                                                <CheckSquare size={12} />
                                                                <span>{project.tasksCompleted}/{project.tasksCount}</span>
                                                            </div>
                                                        )}
                                                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-[8px] text-white font-bold border border-white shadow-sm" title={`Responsable: ${project.ownerName}`}>
                                                            {project.ownerName ? project.ownerName.substring(0,2).toUpperCase() : 'SK'}
                                                        </div>
                                                    </div>
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

        <ProjectSlideOver 
            isOpen={isSlideOverOpen}
            onClose={() => setIsSlideOverOpen(false)}
            project={selectedProject}
        />
    </>
  );
};

export default ProjectsPipeline;
