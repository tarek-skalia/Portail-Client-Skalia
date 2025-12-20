
import React, { useEffect, useState } from 'react';
import { Project } from '../types';
import { supabase } from '../lib/supabase';
import { Kanban, Filter, Search, CheckCircle2, AlertTriangle, Clock, Briefcase, Plus, Edit3, Trash2, TrendingUp, AlertCircle, BarChart3, Layers } from 'lucide-react';
import Skeleton from './Skeleton';
import ProjectSlideOver from './ProjectSlideOver';
import { useAdmin } from './AdminContext';
import Modal from './ui/Modal';
import ProjectForm from './forms/ProjectForm';
import { useToast } from './ToastProvider';

const GlobalProjects: React.FC = () => {
  const { clients } = useAdmin();
  const toast = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  // SlideOver & Modal
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isSlideOverOpen, setIsSlideOverOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  // Deletion State
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchGlobalProjects();
    
    // Subscribe to all projects changes
    const channel = supabase.channel('global_projects_realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => fetchGlobalProjects())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'project_tasks' }, () => fetchGlobalProjects())
        .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Sync selectedProject with updated projects list
  useEffect(() => {
      if (selectedProject && projects.length > 0) {
          const updated = projects.find(p => p.id === selectedProject.id);
          if (updated && JSON.stringify(updated) !== JSON.stringify(selectedProject)) {
              setSelectedProject(updated);
          }
      }
  }, [projects]);

  const fetchGlobalProjects = async () => {
    try {
        const { data: projectsData, error } = await supabase
            .from('projects')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        const projectIds = projectsData?.map(p => p.id) || [];
        const { data: tasksData } = await supabase
            .from('project_tasks')
            .select('*')
            .in('project_id', projectIds);

        const mapped: Project[] = (projectsData || []).map((p: any) => {
            const pTasks = tasksData?.filter(t => t.project_id === p.id) || [];
            const done = pTasks.filter(t => t.completed).length;
            const progress = pTasks.length > 0 ? Math.round((done / pTasks.length) * 100) : (p.progress || 0);
            
            return {
                id: p.id,
                clientId: p.user_id,
                title: p.title,
                description: p.description,
                status: p.status,
                startDate: p.start_date,
                endDate: p.end_date,
                progress: progress,
                tasks: pTasks.map((t:any) => ({ id: t.id, name: t.name, completed: t.completed, type: t.type })),
                ownerName: p.owner_name,
                ownerAvatar: p.owner_avatar,
                resources: p.resources || [],
                tags: p.tags || []
            };
        });

        setProjects(mapped);
    } catch (e) {
        console.error("Global projects error:", e);
    } finally {
        setIsLoading(false);
    }
  };

  const getClientName = (clientId: string) => {
      const client = clients.find(c => c.id === clientId);
      return client ? client.company : 'Client Inconnu';
  };

  const handleEdit = (e: React.MouseEvent, project: Project) => {
      e.stopPropagation();
      setEditingProject(project);
      setIsModalOpen(true);
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      setDeleteId(id);
  };

  const executeDelete = async () => {
      if (!deleteId) return;
      setIsDeleting(true);
      try {
          // Delete tasks first (cascade manual just in case)
          await supabase.from('project_tasks').delete().eq('project_id', deleteId);
          const { error } = await supabase.from('projects').delete().eq('id', deleteId);
          
          if (error) throw error;
          
          toast.success("Supprimé", "Projet retiré avec succès.");
          fetchGlobalProjects();
      } catch (err) {
          toast.error("Erreur", "Impossible de supprimer le projet.");
      } finally {
          setIsDeleting(false);
          setDeleteId(null);
      }
  };

  const filteredProjects = projects.filter(p => {
      const matchesSearch = p.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            getClientName(p.clientId).toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = filterStatus === 'all' || p.status === filterStatus;
      return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
      switch(status) {
          case 'completed': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
          case 'in_progress': return 'bg-blue-100 text-blue-700 border-blue-200';
          case 'review': return 'bg-purple-100 text-purple-700 border-purple-200';
          case 'onboarding': return 'bg-amber-100 text-amber-700 border-amber-200';
          default: return 'bg-slate-100 text-slate-600 border-slate-200';
      }
  };

  const getStatusLabel = (status: string) => {
      const labels: Record<string, string> = {
          uncategorized: 'Brouillon',
          onboarding: 'Onboarding',
          in_progress: 'En production',
          review: 'En révision',
          completed: 'Terminé'
      };
      return labels[status] || status;
  };

  // --- CALCUL DES KPIS ---
  const activeProjects = projects.filter(p => ['in_progress', 'review'].includes(p.status)).length;
  
  const riskyProjects = projects.filter(p => {
      if (p.status === 'completed' || !p.endDate) return false;
      const today = new Date();
      // Format DD/MM/YYYY vers Date object
      const [d, m, y] = p.endDate.split('/').map(Number);
      const deadline = new Date(y, m - 1, d);
      const diffTime = deadline.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays < 3; // Moins de 3 jours ou retard
  }).length;

  const totalProgress = projects.length > 0 
    ? Math.round(projects.reduce((acc, p) => acc + (p.progress || 0), 0) / projects.length) 
    : 0;

  const backlogCount = projects.filter(p => ['onboarding', 'uncategorized'].includes(p.status)).length;

  if (isLoading) return <div className="p-8"><Skeleton className="h-64 w-full rounded-2xl" /></div>;

  return (
    <>
    <div className="space-y-6 animate-fade-in-up pb-10">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-end gap-4">
            <div>
                <h1 className="text-3xl font-extrabold text-slate-900">Opérations</h1>
                <p className="text-slate-500 mt-1">Vue consolidée de tous les projets de l'agence.</p>
            </div>
        </div>

        {/* --- KPI SECTION --- */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">En production</p>
                    <p className="text-2xl font-extrabold text-blue-600">{activeProjects}</p>
                </div>
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg"><Briefcase size={20} /></div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Risques / Retards</p>
                    <p className={`text-2xl font-extrabold ${riskyProjects > 0 ? 'text-red-600' : 'text-slate-700'}`}>{riskyProjects}</p>
                </div>
                <div className={`p-2.5 rounded-lg ${riskyProjects > 0 ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-400'}`}><AlertCircle size={20} /></div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Vélocité Globale</p>
                    <p className="text-2xl font-extrabold text-emerald-600">{totalProgress}%</p>
                </div>
                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg"><BarChart3 size={20} /></div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Backlog</p>
                    <p className="text-2xl font-extrabold text-amber-600">{backlogCount}</p>
                </div>
                <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg"><Layers size={20} /></div>
            </div>
        </div>

        {/* TOOLBAR */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-50 p-2 rounded-xl border border-slate-200">
            {/* STATUS TABS */}
            <div className="flex gap-2 overflow-x-auto w-full md:w-auto scrollbar-hide">
                {['all', 'onboarding', 'in_progress', 'review', 'completed'].map(status => (
                    <button
                        key={status}
                        onClick={() => setFilterStatus(status)}
                        className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                            filterStatus === status 
                            ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-indigo-100' 
                            : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
                        }`}
                    >
                        {status === 'all' ? 'Tous' : getStatusLabel(status)}
                    </button>
                ))}
            </div>

            <div className="flex gap-3 w-full md:w-auto">
                <div className="relative flex-1 md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                        type="text" 
                        placeholder="Rechercher..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                </div>
                <button 
                    onClick={() => { setEditingProject(null); setIsModalOpen(true); }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-sm transition-all whitespace-nowrap text-sm"
                >
                    <Plus size={16} /> <span className="hidden sm:inline">Nouveau</span>
                </button>
            </div>
        </div>

        {/* PROJECTS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.length === 0 ? (
                <div className="col-span-full py-12 text-center text-slate-400 italic bg-white border border-dashed border-slate-200 rounded-2xl">
                    Aucun projet correspondant aux filtres.
                </div>
            ) : (
                filteredProjects.map(project => (
                    <div 
                        key={project.id}
                        onClick={() => { setSelectedProject(project); setIsSlideOverOpen(true); }}
                        className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer group flex flex-col justify-between relative overflow-hidden"
                    >
                        {/* ACTIONS ADMIN (Au survol) */}
                        <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                            <button 
                                onClick={(e) => handleEdit(e, project)}
                                className="p-2 bg-white text-indigo-600 rounded-lg shadow-sm border border-slate-200 hover:bg-indigo-50 transition-colors"
                                title="Modifier"
                            >
                                <Edit3 size={16} />
                            </button>
                            <button 
                                onClick={(e) => handleDelete(e, project.id)}
                                className="p-2 bg-white text-red-600 rounded-lg shadow-sm border border-slate-200 hover:bg-red-50 transition-colors"
                                title="Supprimer"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>

                        <div>
                            <div className="flex justify-between items-start mb-3">
                                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide border ${getStatusColor(project.status)}`}>
                                    {getStatusLabel(project.status)}
                                </span>
                                <span className="text-xs text-slate-400 font-mono">
                                    {new Date(project.startDate).toLocaleDateString('fr-FR', {month: 'short', day: 'numeric'})}
                                </span>
                            </div>
                            
                            <h3 className="font-bold text-slate-800 text-lg mb-1 group-hover:text-indigo-600 transition-colors line-clamp-1 pr-16">
                                {project.title}
                            </h3>
                            
                            <div className="flex items-center gap-2 mb-4">
                                <Briefcase size={12} className="text-slate-400" />
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                                    {getClientName(project.clientId)}
                                </span>
                            </div>
                        </div>

                        <div className="space-y-3 pt-4 border-t border-slate-50">
                            <div className="space-y-1">
                                <div className="flex justify-between text-[10px] text-slate-500 font-medium">
                                    <span>Progression</span>
                                    <span>{project.progress}%</span>
                                </div>
                                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div 
                                        className={`h-full rounded-full ${project.status === 'completed' ? 'bg-emerald-500' : 'bg-indigo-500'}`} 
                                        style={{ width: `${project.progress}%` }}
                                    ></div>
                                </div>
                            </div>
                            
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                    {(project.tasks || []).filter(t => t.completed).length === (project.tasks || []).length && (project.tasks || []).length > 0 ? (
                                        <span className="text-emerald-600 text-xs font-bold flex items-center gap-1">
                                            <CheckCircle2 size={12} /> Tout terminé
                                        </span>
                                    ) : (
                                        <span className="text-slate-400 text-xs flex items-center gap-1">
                                            <Clock size={12} /> {(project.tasks || []).length} tâches
                                        </span>
                                    )}
                                </div>
                                <div className="text-xs text-slate-400">
                                    Resp: {project.ownerName?.split(' ')[0]}
                                </div>
                            </div>
                        </div>
                    </div>
                ))
            )}
        </div>
    </div>

    <ProjectSlideOver 
        isOpen={isSlideOverOpen}
        onClose={() => { setIsSlideOverOpen(false); fetchGlobalProjects(); }}
        project={selectedProject}
    />

    {/* MODAL EDITION / CREATION */}
    <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingProject ? "Modifier le Projet" : "Nouveau Projet"}>
        <ProjectForm 
            initialData={editingProject} 
            onSuccess={() => { setIsModalOpen(false); fetchGlobalProjects(); }} 
            onCancel={() => setIsModalOpen(false)} 
        />
    </Modal>

    {/* MODAL SUPPRESSION */}
    <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Supprimer le projet ?" maxWidth="max-w-md">
        <div className="text-center p-4">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Êtes-vous sûr ?</h3>
            <p className="text-slate-500 text-sm mb-6">
                Cette action est irréversible. Toutes les tâches et fichiers associés seront supprimés.
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
                    {isDeleting ? 'Suppression...' : 'Confirmer'}
                </button>
            </div>
        </div>
    </Modal>
    </>
  );
};

export default GlobalProjects;
