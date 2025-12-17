
import React, { useEffect, useState, useRef } from 'react';
import { Project, ProjectTask } from '../types';
import { Search, Calendar, CheckSquare, AlertTriangle, Layers, Plus, Filter, History, Edit3, Trash2, ArrowRight, Rocket } from 'lucide-react';
import { supabase } from '../lib/supabase';
import Skeleton from './Skeleton';
import ProjectSlideOver from './ProjectSlideOver';
import { useToast } from './ToastProvider';
import { PROJECT_OWNERS } from '../constants';
import { useAdmin } from './AdminContext';
import Modal from './ui/Modal';
import ProjectForm from './forms/ProjectForm';

const ProjectAvatar = ({ src, name }: { src?: string | null, name?: string }) => {
    const [imgError, setImgError] = useState(false);
    const initials = name ? name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'SK';
    if (src && !imgError) return <img src={src} alt={name} onError={() => setImgError(true)} className="w-6 h-6 rounded-full object-cover border border-white shadow-sm" title={`Responsable: ${name}`} />;
    return <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-[8px] text-white font-bold border border-white shadow-sm" title={`Responsable: ${name}`}>{initials}</div>;
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
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isSlideOverOpen, setIsSlideOverOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const hasScrolledRef = useRef<string | null>(null);

  useEffect(() => {
    if (userId) {
        fetchProjectsAndTasks(true);
        const projectChannel = supabase.channel('realtime:projects_pipeline').on('postgres_changes', { event: '*', schema: 'public', table: 'projects', filter: `user_id=eq.${userId}` }, () => fetchProjectsAndTasks(false)).subscribe();
        const tasksChannel = supabase.channel('realtime:project_tasks_update').on('postgres_changes', { event: '*', schema: 'public', table: 'project_tasks' }, () => fetchProjectsAndTasks(false)).subscribe();
        return () => { supabase.removeChannel(projectChannel); supabase.removeChannel(tasksChannel); };
    }
  }, [userId, showAllHistory]);

  const fetchProjectsAndTasks = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    let query = supabase.from('projects').select('*').eq('user_id', userId);
    if (!showAllHistory) { const sixMonthsAgo = new Date(); sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6); query = query.gte('created_at', sixMonthsAgo.toISOString()); }
    const { data: projectsData, error: projectsError } = await query.order('created_at', { ascending: false });
    if (projectsError) { console.error('Erreur:', projectsError); setIsLoading(false); return; }
    if (!projectsData || projectsData.length === 0) { setProjects([]); setIsLoading(false); return; }
    const projectIds = projectsData.map((p: any) => p.id);
    const { data: tasksData } = await supabase.from('project_tasks').select('*').in('project_id', projectIds).order('created_at', { ascending: true });
    const mappedProjects: Project[] = projectsData.map((p: any) => {
        const projectTasksRaw = tasksData ? tasksData.filter((t: any) => t.project_id === p.id) : [];
        const tasks: ProjectTask[] = projectTasksRaw.map((t: any) => ({ id: t.id, name: t.name, completed: t.completed, type: t.type || 'agency', createdAt: t.created_at }));
        const tasksCount = tasks.length;
        const tasksCompleted = tasks.filter(t => t.completed).length;
        let calculatedProgress = tasksCount > 0 ? Math.round((tasksCompleted / tasksCount) * 100) : (p.progress || 0);
        return { id: p.id, clientId: p.user_id, title: p.title, description: p.description || '', status: p.status, startDate: p.start_date ? new Date(p.start_date).toLocaleDateString('fr-FR') : '-', endDate: p.end_date ? new Date(p.end_date).toLocaleDateString('fr-FR') : '-', tags: p.tags || [], tasks, resources: p.resources || [], progress: calculatedProgress, tasksCount, tasksCompleted, ownerName: p.owner_name || 'Skalia Team', ownerAvatar: PROJECT_OWNERS[p.owner_name || ''] || p.owner_avatar };
    });
    setProjects(mappedProjects);
    if (showLoading) setIsLoading(false);
  };

  const columns = [
    { id: 'uncategorized', label: 'Non catégorisé', color: 'border-slate-200 text-slate-500 bg-white' },
    { id: 'onboarding', label: 'Onboarding', color: 'bg-amber-400 text-white' },
    { id: 'in_progress', label: 'En cours', color: 'bg-blue-500 text-white' },
    { id: 'review', label: 'Révision', color: 'bg-purple-500 text-white' },
    { id: 'completed', label: 'Terminé', color: 'bg-emerald-500 text-white' },
  ];

  const getProjectsByStatus = (status: string) => projects.filter(p => p.status === status && (searchTerm === '' || p.title.toLowerCase().includes(searchTerm.toLowerCase())));
  const isOverdue = (dateStr: string) => { if (dateStr === '-') return false; const [d, m, y] = dateStr.split('/').map(Number); return new Date(y, m - 1, d) < new Date(); };
  
  const handleRequestProject = () => {
    if (isAdminMode) setIsModalOpen(true);
    else if (onNavigateToSupport) onNavigateToSupport('new', "Demande de nouveau projet d'automatisation :\n- Objectif :\n");
  };

  const executeDelete = async () => {
      if (!deleteId) return;
      setIsDeleting(true);
      await supabase.from('project_tasks').delete().eq('project_id', deleteId);
      await supabase.from('projects').delete().eq('id', deleteId);
      toast.success("Supprimé", "Projet retiré.");
      fetchProjectsAndTasks();
      setIsDeleting(false);
      setDeleteId(null);
  };

  return (
    <>
        <div className="flex flex-col h-[calc(100vh-8rem)] animate-fade-in-up">
        <div className="flex flex-col xl:flex-row justify-between items-end xl:items-center gap-4 mb-6 px-1">
            <div><h2 className="text-2xl font-bold text-slate-900">Pipeline Projets</h2><p className="text-sm text-slate-500">Suivez l'avancement de vos demandes.</p></div>
            <div className="flex flex-col md:flex-row items-center gap-3 w-full xl:w-auto">
                <button onClick={handleRequestProject} className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-all"><Plus size={18} /><span>Nouveau projet</span></button>
                <button onClick={() => setShowAllHistory(!showAllHistory)} className={`w-full md:w-auto px-4 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 border transition-all ${showAllHistory ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-600'}`}>{showAllHistory ? <History size={18} /> : <Filter size={18} />}<span>{showAllHistory ? "Tout" : "6 mois"}</span></button>
                <div className="relative w-full md:w-64"><div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400"><Search size={16} /></div><input type="text" placeholder="Rechercher..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm" /></div>
            </div>
        </div>

        {projects.length === 0 && !isLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center bg-white/50 rounded-[2.5rem] border-2 border-dashed border-slate-200 m-4 animate-fade-in">
                <div className="max-w-2xl w-full p-8 text-center space-y-8">
                    <div className="inline-flex p-4 bg-indigo-50 rounded-3xl text-indigo-600 border border-indigo-100 shadow-inner">
                        <Rocket size={48} className="animate-float" />
                    </div>
                    <div>
                        <h3 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">Démarrez votre transformation</h3>
                        <p className="text-slate-500 font-medium">Voici le parcours typique de nos clients lors du lancement :</p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {[
                            { step: '01', title: 'Audit Flux', desc: 'Analyse de vos processus manuels.' },
                            { step: '02', title: 'Design', desc: 'Architecture de vos futurs flux.' },
                            { step: '03', title: 'Build', desc: 'Mise en production par Skalia.' }
                        ].map((item, i) => (
                            <div key={i} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm text-left group hover:border-indigo-300 transition-colors">
                                <span className="text-xs font-black text-indigo-500 mb-2 block">{item.step}</span>
                                <h4 className="font-bold text-slate-800 mb-1">{item.title}</h4>
                                <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
                            </div>
                        ))}
                    </div>

                    <button 
                        onClick={handleRequestProject}
                        className="group relative px-8 py-4 bg-slate-900 text-white font-bold rounded-2xl shadow-2xl overflow-hidden hover:bg-indigo-600 transition-all flex items-center justify-center gap-3 mx-auto"
                    >
                        <span>Initialiser un premier projet</span>
                        <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                </div>
            </div>
        ) : (
            <div className="flex-1 flex gap-0 overflow-x-auto py-4 scrollbar-hide pb-10">
                {columns.map((col, index) => {
                    const colProjects = getProjectsByStatus(col.id);
                    return (
                        <div key={col.id} className="min-w-[360px] w-[360px] flex flex-col px-4 relative group/column">
                            {index < columns.length - 1 && (<div className="absolute right-0 top-8 bottom-8 w-px bg-gradient-to-b from-transparent via-slate-200 to-transparent"></div>)}
                            <div className="mb-6"><div className="flex items-center justify-between mb-2"><span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide shadow-sm border ${col.color}`}>{col.label}</span><span className="text-slate-400 text-xs font-medium bg-slate-100 px-2 py-0.5 rounded-full">{colProjects.length}</span></div><div className={`h-1 w-full rounded-full opacity-30 ${col.color.split(' ')[0]}`}></div></div>
                            <div className="flex-1 space-y-4">{isLoading ? (<div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm space-y-3"><Skeleton className="h-5 w-3/4" /><Skeleton className="h-20 w-full" /></div>) : colProjects.length === 0 ? (<div className="h-32 flex flex-col items-center justify-center border-2 border-dashed border-slate-100 rounded-xl bg-slate-50/30 text-slate-300 text-xs font-medium"><Layers size={24} className="mb-2" />Aucun projet</div>) : (colProjects.map(project => (<div key={project.id} id={`project-card-${project.id}`} onClick={() => { setSelectedProject(project); setIsSlideOverOpen(true); }} className={`bg-white rounded-xl border p-4 transition-all duration-300 cursor-pointer group relative ${project.id === highlightedProjectId ? 'border-indigo-500 shadow-xl ring-2 ring-indigo-500 z-10' : 'border-slate-200 shadow-sm hover:border-indigo-200 hover:-translate-y-1'}`}>{isAdminMode && (<div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20"><button onClick={(e) => { e.stopPropagation(); setEditingProject(project); setIsModalOpen(true); }} className="p-1.5 bg-white text-indigo-600 rounded border hover:bg-indigo-50"><Edit3 size={12} /></button><button onClick={(e) => { e.stopPropagation(); setDeleteId(project.id); }} className="p-1.5 bg-white text-red-600 rounded border hover:bg-red-50"><Trash2 size={12} /></button></div>)}<h3 className="font-bold text-slate-800 text-sm mb-2 leading-snug">{project.title}</h3><p className="text-xs text-slate-500 line-clamp-2 mb-4 leading-relaxed">{project.description}</p><div className="space-y-3 pt-3 border-t border-slate-50"><div className="space-y-1.5"><div className="flex justify-between text-[10px] text-slate-400 font-medium"><span>Progression</span><span>{project.progress}%</span></div><div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className={`h-full rounded-full transition-all duration-500 ${project.status === 'completed' ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${project.progress}%` }}></div></div></div><div className="flex items-center justify-between"><div className={`flex items-center gap-1.5 text-xs font-medium ${isOverdue(project.endDate) ? 'text-red-600 bg-red-50 px-2 py-1 rounded-md' : 'text-slate-500'}`}><Calendar size={12} /><span>{project.endDate}</span></div><div className="flex items-center gap-3"><ProjectAvatar src={project.ownerAvatar} name={project.ownerName} /></div></div></div></div>)))}</div>
                        </div>
                    )
                })}
            </div>
        )}
        </div>
        <ProjectSlideOver isOpen={isSlideOverOpen} onClose={() => setIsSlideOverOpen(false)} project={selectedProject} />
        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingProject ? "Modifier" : "Nouveau"}><ProjectForm initialData={editingProject} onSuccess={() => { setIsModalOpen(false); fetchProjectsAndTasks(); }} onCancel={() => setIsModalOpen(false)} /></Modal>
        <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Supprimer" maxWidth="max-w-md"><div className="text-center p-4"><AlertTriangle size={32} className="text-red-500 mx-auto mb-4" /><h3>Confirmer ?</h3><p className="text-slate-500">Action irréversible.</p><div className="flex gap-3 justify-center mt-6"><button onClick={() => setDeleteId(null)} className="px-4 py-2 border rounded-xl">Annuler</button><button onClick={executeDelete} disabled={isDeleting} className="px-4 py-2 bg-red-600 text-white rounded-xl">{isDeleting ? '...' : 'Supprimer'}</button></div></div></Modal>
    </>
  );
};

export default ProjectsPipeline;
