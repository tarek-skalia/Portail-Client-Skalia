
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { 
    Check, Plus, User, Briefcase, Calendar as CalendarIcon, Trash2, Filter, 
    AlertCircle, LayoutList, Building, Search, X, CheckCircle2,
    Briefcase as ProjectIcon, Layers, Clock, CalendarDays, ChevronLeft, ChevronRight
} from 'lucide-react';
import { useToast } from './ToastProvider';
import { PROJECT_OWNERS } from '../constants';
import Skeleton from './Skeleton';
import Modal from './ui/Modal';
import { useAdmin } from './AdminContext';

// Interface unifiée pour l'affichage
interface UnifiedTask {
    id: string;
    origin: 'internal' | 'project';
    title: string;
    completed: boolean;
    createdAt: string;
    
    // Champs spécifiques Internal
    assignee?: string;
    priority?: 'low' | 'medium' | 'high';
    dueDate?: string;
    
    // Champs spécifiques Project
    projectId?: string;
    projectName?: string;
    projectType?: 'client' | 'agency'; // Qui doit faire l'action ?
    clientId?: string;
    clientName?: string;
    clientAvatar?: string;
}

const TasksPage: React.FC = () => {
    const { clients } = useAdmin();
    const toast = useToast();
    const [tasks, setTasks] = useState<UnifiedTask[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // VIEW MODE
    const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
    const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());

    // FILTRES
    const [searchTerm, setSearchTerm] = useState('');
    const [filterContext, setFilterContext] = useState<'all' | 'internal' | 'project'>('all');
    const [filterClient, setFilterClient] = useState<string>('all');
    const [filterProject, setFilterProject] = useState<string>('all');
    const [filterAssignee, setFilterAssignee] = useState<string>('all');

    // LISTES POUR DROPDOWNS
    const [availableProjects, setAvailableProjects] = useState<any[]>([]);

    // MODAL CREATION
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newTask, setNewTask] = useState({
        title: '',
        context: 'internal' as 'internal' | 'project',
        // Internal fields
        assignee: 'Tarek Zreik',
        priority: 'medium' as 'low' | 'medium' | 'high',
        dueDate: '', // Nouveau champ
        // Project fields
        targetClientId: '',
        targetProjectId: '',
        taskType: 'agency' as 'agency' | 'client'
    });
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        fetchData();

        // Realtime
        const internalSub = supabase.channel('rt_internal_tasks_v3')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'internal_tasks' }, () => fetchData())
            .subscribe();

        const projectSub = supabase.channel('rt_project_tasks_v3')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'project_tasks' }, () => fetchData())
            .subscribe();

        return () => {
            supabase.removeChannel(internalSub);
            supabase.removeChannel(projectSub);
        };
    }, []);

    const fetchData = async () => {
        try {
            // 1. Fetch Internal Tasks
            const { data: internalData } = await supabase
                .from('internal_tasks')
                .select('*')
                .order('created_at', { ascending: false });

            // 2. Fetch Project Tasks
            const { data: projectData } = await supabase
                .from('project_tasks')
                .select(`
                    *,
                    projects (
                        id,
                        title,
                        user_id,
                        profiles (
                            id,
                            company_name,
                            avatar_initials
                        )
                    )
                `)
                .order('created_at', { ascending: false });

            // 3. Charger la liste des projets pour le formulaire
            const { data: allProjects } = await supabase
                .from('projects')
                .select('id, title, user_id, status')
                .neq('status', 'completed')
                .order('created_at', { ascending: false });
            
            setAvailableProjects(allProjects || []);

            const unified: UnifiedTask[] = [];

            if (internalData) {
                internalData.forEach((t: any) => {
                    unified.push({
                        id: t.id,
                        origin: 'internal',
                        title: t.title,
                        completed: t.completed,
                        createdAt: t.created_at,
                        assignee: t.assignee,
                        priority: t.priority,
                        dueDate: t.due_date
                    });
                });
            }

            if (projectData) {
                projectData.forEach((t: any) => {
                    if (!t.projects) return;
                    unified.push({
                        id: t.id,
                        origin: 'project',
                        title: t.name,
                        completed: t.completed,
                        createdAt: t.created_at,
                        projectId: t.project_id,
                        projectName: t.projects.title,
                        projectType: t.type,
                        clientId: t.projects.user_id,
                        clientName: t.projects.profiles?.company_name || 'Inconnu',
                        clientAvatar: t.projects.profiles?.avatar_initials
                    });
                });
            }

            unified.sort((a, b) => {
                if (a.completed === b.completed) {
                    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                }
                return a.completed ? 1 : -1;
            });

            setTasks(unified);
        } catch (e) {
            console.error("Error fetching tasks", e);
        } finally {
            setIsLoading(false);
        }
    };

    // --- ACTIONS ---

    const handleCreateTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTask.title.trim()) return;
        setIsSaving(true);

        try {
            if (newTask.context === 'internal') {
                const { error } = await supabase.from('internal_tasks').insert({
                    title: newTask.title,
                    assignee: newTask.assignee,
                    priority: newTask.priority,
                    due_date: newTask.dueDate || null,
                    completed: false,
                    created_at: new Date().toISOString()
                });
                if (error) throw error;
            } else {
                if (!newTask.targetProjectId) {
                    toast.error("Erreur", "Veuillez sélectionner un projet.");
                    setIsSaving(false);
                    return;
                }
                const { error } = await supabase.from('project_tasks').insert({
                    project_id: newTask.targetProjectId,
                    name: newTask.title,
                    type: newTask.taskType,
                    completed: false,
                    created_at: new Date().toISOString()
                });
                if (error) throw error;
            }

            toast.success("Tâche créée", "Ajoutée à la liste avec succès.");
            setIsModalOpen(false);
            setNewTask({ ...newTask, title: '', dueDate: '' }); 
        } catch (err) {
            toast.error("Erreur", "Impossible de créer la tâche.");
        } finally {
            setIsSaving(false);
        }
    };

    const toggleTask = async (task: UnifiedTask) => {
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: !t.completed } : t));

        if (task.origin === 'internal') {
            await supabase.from('internal_tasks').update({ completed: !task.completed }).eq('id', task.id);
        } else {
            await supabase.from('project_tasks').update({ completed: !task.completed }).eq('id', task.id);
        }
    };

    const deleteTask = async (task: UnifiedTask) => {
        if (!window.confirm("Supprimer cette tâche ?")) return;

        if (task.origin === 'internal') {
            await supabase.from('internal_tasks').delete().eq('id', task.id);
        } else {
            await supabase.from('project_tasks').delete().eq('id', task.id);
        }
        toast.info("Supprimé", "Tâche retirée.");
    };

    // --- FILTRAGE AVANCÉ ---
    const filteredTasks = tasks.filter(t => {
        const matchesSearch = t.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              (t.projectName && t.projectName.toLowerCase().includes(searchTerm.toLowerCase())) ||
                              (t.clientName && t.clientName.toLowerCase().includes(searchTerm.toLowerCase()));

        const matchesContext = filterContext === 'all' || t.origin === filterContext;

        let matchesClient = true;
        if (filterClient !== 'all') {
            if (t.origin === 'project') matchesClient = t.clientId === filterClient;
            else matchesClient = false; 
        }

        let matchesProject = true;
        if (filterProject !== 'all') {
            if (t.origin === 'project') matchesProject = t.projectId === filterProject;
            else matchesProject = false;
        }

        let matchesAssignee = true;
        if (filterAssignee !== 'all') {
            if (t.origin === 'internal') matchesAssignee = t.assignee === filterAssignee;
            else matchesAssignee = false;
        }

        return matchesSearch && matchesContext && matchesClient && matchesProject && matchesAssignee;
    });

    const pendingCount = filteredTasks.filter(t => !t.completed).length;

    // --- CALENDAR HELPERS ---
    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const days = new Date(year, month + 1, 0).getDate();
        const firstDay = new Date(year, month, 1).getDay(); // 0 = Dimanche
        const offset = firstDay === 0 ? 6 : firstDay - 1; // 0 = Lundi pour nous
        return { days, offset, year, month };
    };

    const { days, offset, year, month } = getDaysInMonth(currentCalendarDate);
    
    // Filtrage des tâches pour le calendrier (On affiche celles avec une date d'échéance ou créées aujourd'hui si projet)
    const getTasksForDay = (day: number) => {
        const dateStr = new Date(year, month, day).toISOString().split('T')[0];
        
        return filteredTasks.filter(t => {
            if (t.dueDate) {
                return t.dueDate.startsWith(dateStr);
            }
            // Fallback : Si pas de due date, on ne l'affiche pas dans le calendrier pour l'instant pour éviter la surcharge
            // Ou on pourrait l'afficher à la date de création
            return false;
        });
    };

    const nextMonth = () => setCurrentCalendarDate(new Date(year, month + 1, 1));
    const prevMonth = () => setCurrentCalendarDate(new Date(year, month - 1, 1));

    // --- RENDER HELPERS ---
    const getPriorityBadge = (p?: string) => {
        if (p === 'high') return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-red-100 text-red-600 border border-red-200">Urgent</span>;
        if (p === 'medium') return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 text-amber-600 border border-amber-200">Moyen</span>;
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-500 border border-slate-200">Faible</span>;
    };

    const filteredProjectsForDropdown = newTask.targetClientId 
        ? availableProjects.filter(p => p.user_id === newTask.targetClientId)
        : [];

    // Filter projects for the main view dropdown based on selected client
    const viewFilteredProjects = filterClient === 'all'
        ? availableProjects
        : availableProjects.filter(p => p.user_id === filterClient);

    if (isLoading) return <div className="p-8"><Skeleton className="h-96 w-full rounded-2xl" /></div>;

    return (
        <div className="space-y-6 animate-fade-in-up pb-10">
            
            {/* HEADER & ACTIONS */}
            <div className="flex flex-col md:flex-row justify-between items-end gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-3">
                        Tâches & To-Do <span className="text-sm font-medium bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full border border-indigo-100">{pendingCount} actives</span>
                    </h1>
                    <p className="text-slate-500 mt-1">Gestion centralisée des tâches agence et clients.</p>
                </div>
                
                <div className="flex gap-3">
                    <div className="bg-white p-1 rounded-xl border border-slate-200 flex items-center shadow-sm">
                        <button 
                            onClick={() => setViewMode('list')}
                            className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-indigo-50 text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            title="Vue Liste"
                        >
                            <LayoutList size={20} />
                        </button>
                        <button 
                            onClick={() => setViewMode('calendar')}
                            className={`p-2 rounded-lg transition-all ${viewMode === 'calendar' ? 'bg-indigo-50 text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            title="Vue Calendrier"
                        >
                            <CalendarDays size={20} />
                        </button>
                    </div>

                    <button 
                        onClick={() => setIsModalOpen(true)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-indigo-200 flex items-center gap-2 transition-all active:scale-95"
                    >
                        <Plus size={18} /> Nouvelle Tâche
                    </button>
                </div>
            </div>

            {/* BARRE DE FILTRES (MODERNE) - Visible only in list mode usually, but useful for filtering calendar too */}
            <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-sm flex flex-col xl:flex-row gap-3 items-center">
                
                {/* Recherche */}
                <div className="relative w-full xl:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                        type="text" 
                        placeholder="Rechercher..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                </div>

                <div className="h-8 w-px bg-slate-200 hidden xl:block"></div>

                {/* Filtres Dropdowns */}
                <div className="flex flex-wrap gap-2 w-full">
                    
                    {/* Contexte */}
                    <div className="relative group">
                        <select 
                            value={filterContext}
                            onChange={(e) => { setFilterContext(e.target.value as any); setFilterClient('all'); setFilterProject('all'); }}
                            className="appearance-none bg-white border border-slate-200 text-slate-700 text-xs font-bold py-2 pl-3 pr-8 rounded-lg cursor-pointer hover:border-indigo-300 focus:outline-none"
                        >
                            <option value="all">Vue : Tout</option>
                            <option value="internal">Interne Agence</option>
                            <option value="project">Projets Clients</option>
                        </select>
                        <Filter size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>

                    {/* Filtre Client */}
                    {filterContext !== 'internal' && (
                        <div className="relative group">
                            <select 
                                value={filterClient}
                                onChange={(e) => { setFilterClient(e.target.value); setFilterProject('all'); }}
                                className="appearance-none bg-white border border-slate-200 text-slate-700 text-xs font-bold py-2 pl-3 pr-8 rounded-lg cursor-pointer hover:border-indigo-300 focus:outline-none max-w-[150px] truncate"
                            >
                                <option value="all">Client : Tous</option>
                                {clients.filter(c => c.role !== 'admin').map(c => (
                                    <option key={c.id} value={c.id}>{c.company}</option>
                                ))}
                            </select>
                            <Building size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>
                    )}

                    {/* Filtre Projet */}
                    {filterContext !== 'internal' && (
                        <div className="relative group">
                            <select 
                                value={filterProject}
                                onChange={(e) => setFilterProject(e.target.value)}
                                className="appearance-none bg-white border border-slate-200 text-slate-700 text-xs font-bold py-2 pl-3 pr-8 rounded-lg cursor-pointer hover:border-indigo-300 focus:outline-none max-w-[150px] truncate"
                            >
                                <option value="all">Projet : Tous</option>
                                {viewFilteredProjects.map(p => (
                                    <option key={p.id} value={p.id}>{p.title}</option>
                                ))}
                            </select>
                            <Briefcase size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>
                    )}

                    {(filterClient !== 'all' || filterProject !== 'all' || filterAssignee !== 'all' || filterContext !== 'all' || searchTerm) && (
                        <button 
                            onClick={() => { setFilterClient('all'); setFilterProject('all'); setFilterAssignee('all'); setFilterContext('all'); setSearchTerm(''); }}
                            className="px-3 py-2 text-xs font-bold text-red-500 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1"
                        >
                            <X size={12} /> Reset
                        </button>
                    )}
                </div>
            </div>

            {/* --- LIST VIEW --- */}
            {viewMode === 'list' && (
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-[400px]">
                    
                    {filteredTasks.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                            <LayoutList size={48} className="mb-4 opacity-50" />
                            <p className="font-medium">Aucune tâche trouvée</p>
                            <p className="text-xs mt-1">Essayez de modifier vos filtres</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-50">
                            {filteredTasks.map(task => {
                                const isInternal = task.origin === 'internal';
                                const isAgencyTask = task.projectType === 'agency';
                                const avatarSrc = isInternal && task.assignee ? PROJECT_OWNERS[task.assignee] : null;

                                return (
                                    <div 
                                        key={`${task.origin}-${task.id}`} 
                                        className={`group flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-all duration-200 ${
                                            task.completed ? 'bg-emerald-50/20' : 'bg-white'
                                        }`}
                                    >
                                        {/* Checkbox */}
                                        <button 
                                            onClick={() => toggleTask(task)}
                                            className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all shrink-0 border-2 ${
                                                task.completed 
                                                ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm'
                                                : 'border-slate-300 hover:border-indigo-400 text-transparent bg-white'
                                            }`}
                                        >
                                            <Check size={14} strokeWidth={4} />
                                        </button>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0 grid grid-cols-1 lg:grid-cols-2 gap-4 items-center">
                                            
                                            <div>
                                                <p className={`text-sm font-bold truncate mb-1.5 ${
                                                    task.completed 
                                                    ? 'text-emerald-800 line-through decoration-emerald-500 decoration-2 opacity-60' 
                                                    : 'text-slate-800'
                                                }`}>
                                                    {task.title}
                                                </p>
                                                
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    {/* Badge Origine */}
                                                    {isInternal ? (
                                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide bg-slate-100 text-slate-500 px-2 py-0.5 rounded border border-slate-200">
                                                            <Layers size={10} /> Interne
                                                        </span>
                                                    ) : (
                                                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded border ${
                                                            isAgencyTask 
                                                            ? 'bg-indigo-50 text-indigo-600 border-indigo-100' 
                                                            : 'bg-amber-50 text-amber-600 border-amber-100' 
                                                        }`}>
                                                            {isAgencyTask ? <Briefcase size={10} /> : <User size={10} />}
                                                            {isAgencyTask ? 'Action Agence' : 'Attente Client'}
                                                        </span>
                                                    )}

                                                    {/* Date */}
                                                    {task.dueDate && (
                                                        <span className={`flex items-center gap-1 text-[11px] font-medium ${
                                                            new Date(task.dueDate) < new Date() && !task.completed ? 'text-red-500' : 'text-slate-400'
                                                        }`}>
                                                            <CalendarIcon size={10} /> 
                                                            {new Date(task.dueDate).toLocaleDateString('fr-FR', {day: 'numeric', month: 'short'})}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Right: Context Details */}
                                            <div className="flex items-center justify-start lg:justify-end gap-4">
                                                
                                                {!isInternal && (
                                                    <div className="flex flex-col items-start lg:items-end text-right min-w-0">
                                                        <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5 truncate max-w-[200px]">
                                                            {task.clientName}
                                                        </span>
                                                        <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1 truncate max-w-[200px]">
                                                            <ProjectIcon size={10} /> {task.projectName}
                                                        </span>
                                                    </div>
                                                )}

                                                <div className="shrink-0">
                                                    {isInternal && avatarSrc ? (
                                                        <img src={avatarSrc} alt="Assignee" className="w-8 h-8 rounded-full border border-white shadow-sm object-cover" title={task.assignee} />
                                                    ) : !isInternal ? (
                                                        <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600" title={task.clientName}>
                                                            {task.clientAvatar || 'CL'}
                                                        </div>
                                                    ) : null}
                                                </div>

                                                {isInternal && (
                                                    <div className="shrink-0 w-16 text-right">
                                                        {getPriorityBadge(task.priority)}
                                                    </div>
                                                )}

                                                <button 
                                                    onClick={() => deleteTask(task)}
                                                    className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all ml-2"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* --- CALENDAR VIEW --- */}
            {viewMode === 'calendar' && (
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-[600px] animate-fade-in">
                    
                    {/* Calendar Header */}
                    <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                        <div className="flex items-center gap-4">
                            <h2 className="text-lg font-bold text-slate-800 capitalize">
                                {currentCalendarDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                            </h2>
                            <div className="flex bg-white rounded-lg border border-slate-200 shadow-sm">
                                <button onClick={prevMonth} className="p-1.5 hover:bg-slate-50 rounded-l-lg"><ChevronLeft size={18} /></button>
                                <button onClick={nextMonth} className="p-1.5 hover:bg-slate-50 rounded-r-lg border-l border-slate-100"><ChevronRight size={18} /></button>
                            </div>
                        </div>
                        <button onClick={() => setCurrentCalendarDate(new Date())} className="text-xs font-bold text-indigo-600 hover:underline">
                            Aujourd'hui
                        </button>
                    </div>

                    {/* Calendar Grid */}
                    <div className="flex-1 grid grid-cols-7 grid-rows-[auto_1fr] bg-slate-200 gap-[1px]">
                        
                        {/* Days Header */}
                        {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(d => (
                            <div key={d} className="bg-slate-50 p-2 text-center text-xs font-bold text-slate-400 uppercase">
                                {d}
                            </div>
                        ))}

                        {/* Empty cells before start of month */}
                        {Array.from({ length: offset }).map((_, i) => (
                            <div key={`empty-${i}`} className="bg-slate-50/50 min-h-[100px]" />
                        ))}

                        {/* Days */}
                        {Array.from({ length: days }).map((_, i) => {
                            const day = i + 1;
                            const dayTasks = getTasksForDay(day);
                            const isToday = day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();

                            return (
                                <div key={day} className={`bg-white min-h-[100px] p-2 hover:bg-slate-50 transition-colors group relative ${isToday ? 'bg-indigo-50/30' : ''}`}>
                                    <div className="flex justify-between items-start mb-1">
                                        <span className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-indigo-600 text-white' : 'text-slate-600'}`}>
                                            {day}
                                        </span>
                                        {dayTasks.length > 0 && (
                                            <span className="text-[10px] text-slate-400 font-medium">{dayTasks.length} tâches</span>
                                        )}
                                    </div>
                                    
                                    <div className="space-y-1">
                                        {dayTasks.map(task => (
                                            <div 
                                                key={task.id}
                                                className={`text-[10px] px-1.5 py-1 rounded border truncate cursor-pointer transition-all ${
                                                    task.completed 
                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100 line-through opacity-60' 
                                                    : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300 hover:shadow-sm'
                                                }`}
                                                onClick={() => toggleTask(task)}
                                                title={task.title}
                                            >
                                                {task.origin === 'internal' ? '🔹' : '🔸'} {task.title}
                                            </div>
                                        ))}
                                    </div>
                                    
                                    {/* Add Button on Hover */}
                                    <button 
                                        onClick={() => {
                                            const dateStr = new Date(year, month, day).toLocaleDateString('fr-CA'); // YYYY-MM-DD
                                            setNewTask({ ...newTask, context: 'internal', dueDate: dateStr });
                                            setIsModalOpen(true);
                                        }}
                                        className="absolute top-2 right-2 p-1 text-slate-300 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <Plus size={14} />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* MODAL AJOUT TÂCHE */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Nouvelle Tâche">
                <form onSubmit={handleCreateTask} className="space-y-6 pt-2">
                    
                    {/* SWITCH CONTEXTE */}
                    <div className="grid grid-cols-2 gap-4 p-1 bg-slate-100 rounded-xl">
                        <button
                            type="button"
                            onClick={() => setNewTask({...newTask, context: 'internal'})}
                            className={`py-2.5 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                                newTask.context === 'internal' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            <Layers size={16} /> Tâche Interne
                        </button>
                        <button
                            type="button"
                            onClick={() => setNewTask({...newTask, context: 'project'})}
                            className={`py-2.5 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                                newTask.context === 'project' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            <Briefcase size={16} /> Tâche Projet
                        </button>
                    </div>

                    {/* CHAMPS COMMUNS */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Titre de la tâche</label>
                        <input 
                            type="text" 
                            required
                            autoFocus
                            value={newTask.title} 
                            onChange={(e) => setNewTask({...newTask, title: e.target.value})}
                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                            placeholder="Ex: Relancer client, Configurer API..."
                        />
                    </div>

                    {/* CHAMPS INTERNE */}
                    {newTask.context === 'internal' && (
                        <div className="space-y-4 animate-fade-in">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Assigné à</label>
                                    <select 
                                        value={newTask.assignee}
                                        onChange={(e) => setNewTask({...newTask, assignee: e.target.value})}
                                        className="w-full px-3 py-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                    >
                                        <option value="Tarek Zreik">Tarek</option>
                                        <option value="Zakaria Jellouli">Zakaria</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Priorité</label>
                                    <select 
                                        value={newTask.priority}
                                        onChange={(e) => setNewTask({...newTask, priority: e.target.value as any})}
                                        className="w-full px-3 py-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                    >
                                        <option value="low">Faible</option>
                                        <option value="medium">Moyenne</option>
                                        <option value="high">Haute</option>
                                    </select>
                                </div>
                            </div>
                            
                            {/* NEW: DATE ECHEANCE */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Date d'échéance</label>
                                <input 
                                    type="date"
                                    value={newTask.dueDate}
                                    onChange={(e) => setNewTask({...newTask, dueDate: e.target.value})}
                                    className="w-full px-3 py-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                        </div>
                    )}

                    {/* CHAMPS PROJET */}
                    {newTask.context === 'project' && (
                        <div className="space-y-4 animate-fade-in">
                            {/* SELECTEUR CLIENT D'ABORD */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">1. Sélectionner le Client</label>
                                <select 
                                    value={newTask.targetClientId}
                                    onChange={(e) => setNewTask({...newTask, targetClientId: e.target.value, targetProjectId: ''})}
                                    className="w-full px-3 py-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="">-- Choisir un client --</option>
                                    {clients.filter(c => c.role !== 'admin').map(c => (
                                        <option key={c.id} value={c.id}>{c.company}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">2. Sélectionner le Projet</label>
                                <div className="relative">
                                    <select 
                                        value={newTask.targetProjectId}
                                        onChange={(e) => setNewTask({...newTask, targetProjectId: e.target.value})}
                                        disabled={!newTask.targetClientId}
                                        className={`w-full pl-3 pr-10 py-3 border border-slate-200 rounded-xl text-sm outline-none appearance-none ${
                                            !newTask.targetClientId ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white focus:ring-2 focus:ring-indigo-500'
                                        }`}
                                    >
                                        <option value="">-- Choisir un projet --</option>
                                        {filteredProjectsForDropdown.map(p => (
                                            <option key={p.id} value={p.id}>{p.title}</option>
                                        ))}
                                    </select>
                                    <Briefcase size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Type de tâche</label>
                                <div className="grid grid-cols-2 gap-4">
                                    <label className={`flex items-center justify-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${newTask.taskType === 'agency' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'border-slate-200 hover:bg-slate-50'}`}>
                                        <input type="radio" name="taskType" className="hidden" checked={newTask.taskType === 'agency'} onChange={() => setNewTask({...newTask, taskType: 'agency'})} />
                                        <Briefcase size={16} /> Action Agence
                                    </label>
                                    <label className={`flex items-center justify-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${newTask.taskType === 'client' ? 'bg-amber-50 border-amber-200 text-amber-700' : 'border-slate-200 hover:bg-slate-50'}`}>
                                        <input type="radio" name="taskType" className="hidden" checked={newTask.taskType === 'client'} onChange={() => setNewTask({...newTask, taskType: 'client'})} />
                                        <User size={16} /> Action Client
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                        <button 
                            type="button" 
                            onClick={() => setIsModalOpen(false)}
                            className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                        >
                            Annuler
                        </button>
                        <button 
                            type="submit" 
                            disabled={isSaving}
                            className="px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-200 transition-all disabled:opacity-50"
                        >
                            {isSaving ? 'Création...' : 'Ajouter la tâche'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default TasksPage;
