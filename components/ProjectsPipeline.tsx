
import React, { useEffect, useState, useRef } from 'react';
import { Project, ProjectTask } from '../types';
import { Search, Calendar, CheckSquare, AlertTriangle, Layers, Plus, Filter, History, Edit3, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import Skeleton from './Skeleton';
import ProjectSlideOver from './ProjectSlideOver';
import { useToast } from './ToastProvider';
import { PROJECT_OWNERS } from '../constants';
import { useAdmin } from './AdminContext';
import Modal from './ui/Modal';
import ProjectForm from './forms/ProjectForm';

// Sous-composant pour gérer l'avatar avec Fallback
const ProjectAvatar = ({ src, name }: { src?: string | null, name?: string }) => {
    const [imgError, setImgError] = useState(false);
    const initials = name ? name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'SK';

    if (src && !imgError) {
        return (
            <img 
                src={src} 
                alt={name} 
                onError={() => setImgError(true)}
                className="w-6 h-6 rounded-full object-cover border border-white shadow-sm" 
                title={`Responsable: ${name}`}
            />
        );
    }

    return (
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-[8px] text-white font-bold border border-white shadow-sm" title={`Responsable: ${name}`}>
            {initials}
        </div>
    );
};

interface ProjectsPipelineProps {
  projects: Project[];
  userId?: string;
  highlightedProjectId?: string | null;
  onNavigateToSupport?: (subject: string, description: string) => void;
}

const ProjectsPipeline: React.FC<ProjectsPipelineProps> = ({ projects: initialProjects, userId, highlightedProjectId, onNavigateToSupport }) => {
  const { isAdminMode } = useAdmin();
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const toast = useToast();
  
  // État pour le filtre historique
  const [showAllHistory, setShowAllHistory] = useState(false);
  
  // SlideOver State
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isSlideOverOpen, setIsSlideOverOpen] = useState(false);
  
  // Modal Creation / Edition
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  const hasScrolledRef = useRef<string | null>(null);

  useEffect(() => {
    if (userId) {
        fetchProjectsAndTasks(true);

        const projectChannel = supabase
            .channel('realtime:projects_pipeline')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => {
                fetchProjectsAndTasks(false);
            })
            .subscribe();

        const tasksChannel = supabase
            .channel('realtime:project_tasks_update')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'project_tasks' }, () => {
                fetchProjectsAndTasks(false);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(projectChannel);
            supabase.removeChannel(tasksChannel);
        };
    }
  }, [userId, showAllHistory]);

  useEffect(() => {
      if (selectedProject && projects.length > 0) {
          const updatedSelectedProject = projects.find(p => p.id === selectedProject.id);
          if (updatedSelectedProject) {
              const hasTasksChanged = JSON.stringify(updatedSelectedProject.tasks) !== JSON.stringify(selectedProject.tasks);
              const hasResourcesChanged = JSON.stringify(updatedSelectedProject.resources) !== JSON.stringify(selectedProject.resources);
              const hasProgressChanged = updatedSelectedProject.progress !== selectedProject.progress;

              if (hasTasksChanged || hasResourcesChanged || hasProgressChanged) {
                  setSelectedProject(updatedSelectedProject);
              }
          }
      }
  }, [projects]);

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

  const fetchProjectsAndTasks = async (showLoading = true) => {
    if (showLoading) {
        setIsLoading(true);
    }

    let query = supabase.from('projects').select('*').eq('user_id', userId);

    if (!showAllHistory) {
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        query = query.gte('created_at', sixMonthsAgo.toISOString());
    }

    const { data: projectsData, error: projectsError } = await query.order('created_at', { ascending: false });

    if (projectsError) {
        console.error('Erreur chargement projets:', projectsError);
        setIsLoading(false);
        return;
    }

    if (!projectsData || projectsData.length === 0) {
        setProjects([]);
        setIsLoading(false);
        return;
    }

    const projectIds = projectsData.map((p: any) => p.id);
    const { data: tasksData } = await supabase
        .from('project_tasks')
        .select('*')
        .in('project_id', projectIds)
        .order('created_at', { ascending: true });

    const mappedProjects: Project[] = projectsData.map((p: any) => {
        const projectTasksRaw = tasksData 
            ? tasksData.filter((t: any) => t.project_id === p.id)
                       .sort((a: any, b: any) => {
                           const timeA = new Date(a.created_at).getTime();
                           const timeB = new Date(b.created_at).getTime();
                           if (timeA !== timeB) return timeA - timeB;
                           return a.id.localeCompare(b.id);
                       })
            : [];
        
        const tasks: ProjectTask[] = projectTasksRaw.map((t: any) => ({
            id: t.id,
            name: t.name,
            completed: t.completed,
            type: t.type || 'agency', 
            createdAt: t.created_at
        }));

        const tasksCount = tasks.length;
        const tasksCompleted = tasks.filter(t => t.completed).length;
        let calculatedProgress = 0;
        if (tasksCount > 0) {
            calculatedProgress = Math.round((tasksCompleted / tasksCount) * 100);
        } else {
            calculatedProgress = (p.progress !== undefined && p.progress !== null) ? p.progress : 0;
        }

        let resources = [];
        if (p.resources && Array.isArray(p.resources)) resources = p.resources;

        const ownerName = p.owner_name || 'Skalia Team';
        const ownerAvatar = PROJECT_OWNERS[ownerName] || p.owner_avatar;

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
            progress: calculatedProgress,
            tasksCount: tasksCount,
            tasksCompleted: tasksCompleted,
            ownerName: ownerName,
            ownerAvatar: ownerAvatar
        };
    });

    setProjects(mappedProjects);
    
    if (showLoading) {
        setIsLoading(false);
    }
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

  const handleRequestProject = () => {
      setEditingProject(null);
      if (isAdminMode) {
          setIsModalOpen(true);
      } else if (onNavigateToSupport) {
          onNavigateToSupport('new', "Bonjour, je souhaite démarrer un nouveau projet concernant :\n\n- Objectif :\n- Délai souhaité :\n");
      }
  };

  const handleEdit = (e: React.MouseEvent, project: Project) => {
      e.stopPropagation();
      setEditingProject(project);
      setIsModalOpen(true);
  };

  const handleDelete = async (e: React.MouseEvent, projectId: string) => {
      e.stopPropagation();
      if (window.confirm("Supprimer ce projet ? Toutes les tâches et fichiers associés seront perdus.")) {
          const { error } = await supabase.from('projects').delete().eq('id', projectId);
          if (error) {
              toast.error("Erreur", "Impossible de supprimer le projet.");
          } else {
              toast.success("Supprimé", "Projet retiré.");
              fetchProjectsAndTasks();
          }
      }
  };

  return (
    <>
        <div className="flex flex-col h-[calc(100vh-8rem)] animate-fade-in-up">
        {/* Toolbar */}
        <div className="flex flex-col xl:flex-row justify-between items-end xl:items-center gap-4 mb-6 px-1">
            <div>
                <h2 className="text-2xl font-bold text-slate-900">Pipeline Projets</h2>
                <p className="text-sm text-slate-500">Gérez l'avancement de vos missions en temps réel.</p>
            </div>
            
            <div className="flex flex-col md:flex-row items-center gap-3 w-full xl:w-auto">
                {/* Bouton Nouveau Projet */}
                <button 
                    onClick={handleRequestProject}
                    className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-all hover:shadow-indigo-200 active:scale-95 order-1 md:order-1"
                >
                    <Plus size={18} />
                    <span>Nouveau projet</span>
                </button>

                {/* Filtre Historique */}
                <button
                    onClick={() => setShowAllHistory(!showAllHistory)}
                    className={`w-full md:w-auto px-4 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 border transition-all shadow-sm active:scale-95 order-2 md:order-2 ${
                        showAllHistory 
                            ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-inner' 
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                >
                    {showAllHistory ? <History size={18} /> : <Filter size={18} />}
                    <span className="whitespace-nowrap">{showAllHistory ? "Tout l'historique" : "6 derniers mois"}</span>
                </button>

                {/* Barre de recherche */}
                <div className="relative w-full md:w-64 order-3 md:order-3">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Search size={16} />
                    </div>
                    <input 
                        type="text"
                        placeholder="Rechercher..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
                    />
                </div>
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
                                            
                                            {/* ACTIONS ADMIN */}
                                            {isAdminMode && (
                                                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                                    <button 
                                                        onClick={(e) => handleEdit(e, project)}
                                                        className="p-1.5 bg-white text-indigo-600 rounded shadow-sm border hover:bg-indigo-50"
                                                    >
                                                        <Edit3 size={12} />
                                                    </button>
                                                    <button 
                                                        onClick={(e) => handleDelete(e, project.id)}
                                                        className="p-1.5 bg-white text-red-600 rounded shadow-sm border hover:bg-red-50"
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                </div>
                                            )}

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
                                                        <ProjectAvatar src={project.ownerAvatar} name={project.ownerName} />
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

        <Modal 
            isOpen={isModalOpen} 
            onClose={() => setIsModalOpen(false)} 
            title={editingProject ? "Modifier le projet" : "Nouveau Projet"}
        >
            <ProjectForm 
                initialData={editingProject}
                onSuccess={() => { setIsModalOpen(false); fetchProjectsAndTasks(); }} 
                onCancel={() => setIsModalOpen(false)} 
            />
        </Modal>
    </>
  );
};

export default ProjectsPipeline;
