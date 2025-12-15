
import React, { useState, useEffect, useRef } from 'react';
import { Project, ProjectTask } from '../types';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, ZoomIn, ZoomOut, Layers, User, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import ProjectSlideOver from './ProjectSlideOver';
import { PROJECT_OWNERS } from '../constants';

// Sous-composant pour gérer l'avatar Timeline avec Fallback
const TimelineAvatar = ({ src, name }: { src?: string | null, name?: string }) => {
    const [imgError, setImgError] = useState(false);
    const initials = name ? name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'SK';

    // On priorise la source
    if (src && !imgError) {
        return (
            <img 
                src={src} 
                alt={name} 
                onError={() => setImgError(true)}
                className="w-6 h-6 rounded-full object-cover border border-white/50 shadow-sm shrink-0"
            />
        );
    }

    return (
        <div className="w-6 h-6 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-[9px] font-bold border border-white/30 shrink-0">
            {initials}
        </div>
    );
};

interface ProjectRoadmapProps {
  userId?: string;
  onProjectClick?: (projectId: string) => void; // Gardé pour compatibilité, mais on utilise le SlideOver interne
}

type ViewMode = 'week' | 'month' | 'quarter';

const PROJECT_COLORS = [
  { bg: 'bg-blue-500', hover: 'hover:bg-blue-600', ring: 'ring-blue-200', text: 'text-white' },
  { bg: 'bg-indigo-500', hover: 'hover:bg-indigo-600', ring: 'ring-indigo-200', text: 'text-white' },
  { bg: 'bg-purple-500', hover: 'hover:bg-purple-600', ring: 'ring-purple-200', text: 'text-white' },
  { bg: 'bg-orange-500', hover: 'hover:bg-orange-600', ring: 'ring-orange-200', text: 'text-white' },
  { bg: 'bg-rose-500', hover: 'hover:bg-rose-600', ring: 'ring-rose-200', text: 'text-white' },
  { bg: 'bg-cyan-500', hover: 'hover:bg-cyan-600', ring: 'ring-cyan-200', text: 'text-white' },
];

const ProjectRoadmap: React.FC<ProjectRoadmapProps> = ({ userId }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // États de vue
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // États SlideOver
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isSlideOverOpen, setIsSlideOverOpen] = useState(false);
  
  // État UX - Synchronisation Hover
  const [hoveredProjectId, setHoveredProjectId] = useState<string | null>(null);

  // Refs pour le scroll synchro (si besoin futur)
  const timelineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (userId) {
        fetchProjects();

        // 1. Écoute projets (filtrée)
        const projectChannel = supabase
            .channel('realtime:projects_roadmap')
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'projects',
                filter: `user_id=eq.${userId}` 
            }, () => {
                fetchProjects();
            })
            .subscribe();

        // 2. Écoute tâches (globale)
        const tasksChannel = supabase
            .channel('realtime:tasks_roadmap')
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

  // Synchronisation des changements locaux (ex: tâches modifiées dans le SlideOver)
  useEffect(() => {
      if (selectedProject && projects.length > 0) {
          const updated = projects.find(p => p.id === selectedProject.id);
          if (updated) {
             const hasTasksChanged = JSON.stringify(updated.tasks) !== JSON.stringify(selectedProject.tasks);
             const hasResourcesChanged = JSON.stringify(updated.resources) !== JSON.stringify(selectedProject.resources);
             
             if (hasTasksChanged || hasResourcesChanged) {
                 setSelectedProject(updated);
             }
          }
      }
  }, [projects]);

  const fetchProjects = async () => {
    if (projects.length === 0) setIsLoading(true);

    // 1. Récupération des projets
    const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', userId)
        .order('start_date', { ascending: true }); // Tri par date de début pour l'effet escalier

    if (projectsError) {
        console.error('Erreur chargement projets roadmap:', projectsError);
        setIsLoading(false);
        return;
    }

    if (!projectsData || projectsData.length === 0) {
        setProjects([]);
        setIsLoading(false);
        return;
    }

    // 2. Récupération des tâches (Même logique que Pipeline pour avoir les données complètes)
    const projectIds = projectsData.map((p: any) => p.id);
    const { data: tasksData } = await supabase
        .from('project_tasks')
        .select('*')
        .in('project_id', projectIds)
        .order('created_at', { ascending: true });

    // 3. Mapping complet
    const mappedProjects: Project[] = projectsData.map((p: any) => {
        // Fallback Owner
        const ownerName = p.owner_name || 'Skalia Team';
        const ownerAvatar = PROJECT_OWNERS[ownerName] || p.owner_avatar;

        // Gestion des tâches pour ce projet
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

        // Calcul stats (identique pipeline)
        const tasksCount = tasks.length;
        const tasksCompleted = tasks.filter(t => t.completed).length;
        let calculatedProgress = 0;
        if (tasksCount > 0) {
            calculatedProgress = Math.round((tasksCompleted / tasksCount) * 100);
        } else {
            calculatedProgress = (p.progress !== undefined && p.progress !== null) ? p.progress : 0;
        }

        // Ressources
        let resources = [];
        if (p.resources && Array.isArray(p.resources)) resources = p.resources;

        return {
            id: p.id,
            clientId: p.user_id,
            title: p.title,
            description: p.description || '',
            status: p.status,
            startDate: p.start_date || '',
            endDate: p.end_date || '',
            
            ownerName: ownerName,
            ownerAvatar: ownerAvatar,
            
            tasks: tasks, 
            resources: resources,
            
            progress: calculatedProgress,
            tasksCount: tasksCount,
            tasksCompleted: tasksCompleted
        };
    });

    setProjects(mappedProjects);
    setIsLoading(false);
  };

  // --- LOGIQUE DATE & GANTT ---

  const getStartDate = () => {
      const date = new Date(currentDate);
      date.setHours(0, 0, 0, 0);
      
      if (viewMode === 'week') {
          // Lundi de la semaine actuelle
          const day = date.getDay();
          const diff = date.getDate() - day + (day === 0 ? -6 : 1);
          return new Date(date.setDate(diff));
      }
      if (viewMode === 'month') {
          // 1er du mois
          return new Date(date.getFullYear(), date.getMonth(), 1);
      }
      if (viewMode === 'quarter') {
          // 1er du trimestre
          const quarterMonth = Math.floor(date.getMonth() / 3) * 3;
          return new Date(date.getFullYear(), quarterMonth, 1);
      }
      return date;
  };

  const getEndDate = (start: Date) => {
      const end = new Date(start);
      if (viewMode === 'week') {
          end.setDate(end.getDate() + 7); // 7 jours
      } else if (viewMode === 'month') {
          end.setMonth(end.getMonth() + 1); // 1 mois
      } else if (viewMode === 'quarter') {
          end.setMonth(end.getMonth() + 3); // 3 mois
      }
      return end;
  };

  const viewStart = getStartDate();
  const viewEnd = getEndDate(viewStart);
  const totalDuration = viewEnd.getTime() - viewStart.getTime();

  // Navigation
  const handlePrev = () => {
      const newDate = new Date(currentDate);
      if (viewMode === 'week') newDate.setDate(newDate.getDate() - 7);
      else if (viewMode === 'month') newDate.setMonth(newDate.getMonth() - 1);
      else if (viewMode === 'quarter') newDate.setMonth(newDate.getMonth() - 3);
      setCurrentDate(newDate);
  };

  const handleNext = () => {
      const newDate = new Date(currentDate);
      if (viewMode === 'week') newDate.setDate(newDate.getDate() + 7);
      else if (viewMode === 'month') newDate.setMonth(newDate.getMonth() + 1);
      else if (viewMode === 'quarter') newDate.setMonth(newDate.getMonth() + 3);
      setCurrentDate(newDate);
  };

  const handleToday = () => setCurrentDate(new Date());

  // Génération des colonnes de la grille
  const getGridColumns = () => {
      const cols = [];
      const tempDate = new Date(viewStart);
      
      if (viewMode === 'week') {
          // 7 Jours
          for (let i = 0; i < 7; i++) {
              cols.push(new Date(tempDate));
              tempDate.setDate(tempDate.getDate() + 1);
          }
      } else if (viewMode === 'month') {
          // Jours du mois (ex: 30 ou 31)
          while (tempDate < viewEnd) {
              cols.push(new Date(tempDate));
              tempDate.setDate(tempDate.getDate() + 1);
          }
      } else if (viewMode === 'quarter') {
          // Semaines du trimestre (environ 12-14)
          while (tempDate < viewEnd) {
              cols.push(new Date(tempDate));
              tempDate.setDate(tempDate.getDate() + 7);
          }
      }
      return cols;
  };

  const gridColumns = getGridColumns();

  // Helpers positionnement
  const getPosition = (dateStr: string) => {
      if (!dateStr || dateStr === '-') return 0;
      const date = new Date(dateStr);
      // Correction format DD/MM/YYYY si nécessaire
      if (dateStr.includes('/')) {
        const [d, m, y] = dateStr.split('/').map(Number);
        date.setFullYear(y, m - 1, d);
      }
      
      const diff = date.getTime() - viewStart.getTime();
      const percent = (diff / totalDuration) * 100;
      return Math.max(0, Math.min(100, percent));
  };

  const getBarWidth = (startStr: string, endStr: string) => {
      const startPos = getPosition(startStr);
      const endPos = getPosition(endStr);
      // Si endPos est 0 (date avant la vue) et startPos est 0, largeur 0
      // Si endPos est 100 (date après la vue), on cape
      let width = endPos - startPos;
      
      // Cas particulier : Projet qui traverse toute la vue
      const dStart = new Date(startStr);
      const dEnd = new Date(endStr);
      if (dStart < viewStart && dEnd > viewEnd) return 100;

      // Largeur minimale visuelle (1%)
      return Math.max(1, width);
  };

  // Couleur stable par ID
  const getColor = (id: string, status: string) => {
      // Si le projet est terminé, on force le vert émeraude
      if (status === 'completed') {
          return { bg: 'bg-emerald-500', hover: 'hover:bg-emerald-600', ring: 'ring-emerald-200', text: 'text-white' };
      }

      let hash = 0;
      for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
      return PROJECT_COLORS[Math.abs(hash) % PROJECT_COLORS.length];
  };

  // Style Hachuré pour les projets terminés
  const getHatchStyle = (status: string) => {
    if (status === 'completed') {
        return {
            backgroundImage: 'linear-gradient(45deg, rgba(255,255,255,0.15) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.15) 75%, transparent 75%, transparent)',
            backgroundSize: '8px 8px'
        };
    }
    return {};
  };

  // Ligne Aujourd'hui
  const today = new Date();
  const todayPos = (today.getTime() - viewStart.getTime()) / totalDuration * 100;
  const showTodayLine = today >= viewStart && today <= viewEnd;

  const handleBarClick = (project: Project) => {
      setSelectedProject(project);
      setIsSlideOverOpen(true);
  };

  return (
    <>
    <div className="flex flex-col h-[calc(100vh-8rem)] animate-fade-in-up bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden relative">
      
      {/* --- HEADER CONTROLS --- */}
      <div className="flex flex-col md:flex-row items-center justify-between px-6 py-4 border-b border-slate-200 gap-4">
        
        {/* Date Nav */}
        <div className="flex items-center gap-4">
           <div className="flex items-center bg-slate-100 rounded-lg p-1">
              <button onClick={handlePrev} className="p-1.5 hover:bg-white rounded-md transition-colors text-slate-600 shadow-sm"><ChevronLeft size={18} /></button>
              <button onClick={handleNext} className="p-1.5 hover:bg-white rounded-md transition-colors text-slate-600 ml-1"><ChevronRight size={18} /></button>
           </div>
           
           <h2 className="text-xl font-bold text-slate-800 capitalize min-w-[200px]">
             {viewMode === 'quarter' 
                ? `Trimestre ${Math.floor(currentDate.getMonth()/3)+1} ${currentDate.getFullYear()}`
                : currentDate.toLocaleString('fr-FR', { month: 'long', year: 'numeric' })
             }
           </h2>

           <button onClick={handleToday} className="flex items-center gap-2 px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
              <CalendarIcon size={14} /> Aujourd'hui
           </button>
        </div>

        {/* View Switcher */}
        <div className="flex bg-slate-100 p-1 rounded-lg">
             <button 
                onClick={() => setViewMode('week')}
                className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${viewMode === 'week' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
             >
                Semaine
             </button>
             <button 
                onClick={() => setViewMode('month')}
                className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${viewMode === 'month' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
             >
                Mois
             </button>
             <button 
                onClick={() => setViewMode('quarter')}
                className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${viewMode === 'quarter' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
             >
                Trimestre
             </button>
        </div>
      </div>

      {/* --- GANTT BODY --- */}
      <div className="flex-1 flex overflow-hidden relative">
          
          {/* SIDEBAR (Liste Projets) */}
          <div className="w-64 border-r border-slate-200 bg-white flex flex-col shrink-0 z-20 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.1)]">
              {/* Header Sidebar */}
              <div className="h-12 border-b border-slate-100 bg-slate-50 px-4 flex items-center text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Projets actifs
              </div>
              
              {/* List */}
              <div className="flex-1 overflow-y-hidden pt-2 group-list"> 
                  {/* Note: overflow-y-hidden car le scroll est géré par le conteneur principal pour synchroniser */}
                  {projects.map((p) => (
                      <div 
                        key={p.id} 
                        className={`
                            h-16 px-4 flex flex-col justify-center border-b border-slate-50 transition-all duration-200 cursor-pointer
                            ${hoveredProjectId === p.id 
                                ? 'bg-indigo-50/60 ring-1 ring-inset ring-indigo-100/50' 
                                : 'hover:bg-slate-50'
                            }
                        `} 
                        onClick={() => handleBarClick(p)}
                        onMouseEnter={() => setHoveredProjectId(p.id)}
                        onMouseLeave={() => setHoveredProjectId(null)}
                      >
                          <div className={`font-bold text-sm truncate transition-colors ${hoveredProjectId === p.id ? 'text-indigo-700' : 'text-slate-800'}`}>
                              {p.title}
                          </div>
                          <div className="text-xs text-slate-400 flex items-center gap-1">
                              <User size={10} /> {p.ownerName}
                          </div>
                      </div>
                  ))}
                  {projects.length === 0 && (
                      <div className="p-8 text-center text-slate-400 text-sm italic">
                          Aucun projet
                      </div>
                  )}
              </div>
          </div>

          {/* TIMELINE AREA */}
          <div className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar relative bg-slate-50/30" ref={timelineRef}>
              
              {/* Grille de fond & En-tête Date */}
              <div className="min-w-full" style={{ width: viewMode === 'month' ? '150%' : '100%' }}> 
                  {/* Largeur forcée à 150% en mode mois pour que les cases ne soient pas trop petites */}
                  
                  {/* HEADER DATES */}
                  <div className="h-12 border-b border-slate-200 bg-white flex sticky top-0 z-10">
                      {gridColumns.map((date, i) => (
                          <div key={i} className="flex-1 border-r border-slate-100 flex flex-col items-center justify-center text-xs text-slate-500 min-w-[40px]">
                              <span className="font-bold text-slate-700">
                                  {viewMode === 'quarter' ? `S${getWeekNumber(date)}` : date.getDate()}
                              </span>
                              <span className="text-[10px] uppercase">
                                  {viewMode === 'quarter' 
                                    ? date.toLocaleString('fr-FR', {month:'short'}) 
                                    : date.toLocaleString('fr-FR', {weekday:'short'})}
                              </span>
                          </div>
                      ))}
                  </div>

                  {/* CORPS (Lignes + Barres) */}
                  <div className="relative pt-2">
                      
                      {/* Lignes verticales de fond */}
                      <div className="absolute inset-0 top-0 z-0 flex pointer-events-none">
                           {gridColumns.map((_, i) => (
                              <div key={i} className={`flex-1 border-r border-slate-100/50 ${viewMode === 'week' ? 'bg-white' : i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}></div>
                           ))}
                      </div>

                      {/* Ligne AUJOURD'HUI */}
                      {showTodayLine && (
                          <div 
                            className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-30 shadow-[0_0_8px_rgba(239,68,68,0.6)]"
                            style={{ left: `${todayPos}%` }}
                          >
                              <div className="absolute -top-1 -translate-x-1/2 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-sm shadow-sm">
                                  AUJ
                              </div>
                          </div>
                      )}

                      {/* Barres Projets */}
                      {projects.map((project) => {
                          const left = getPosition(project.startDate);
                          const width = getBarWidth(project.startDate, project.endDate);
                          const color = getColor(project.id, project.status);
                          const isHovered = hoveredProjectId === project.id;
                          const hatchStyle = getHatchStyle(project.status);
                          
                          // Avatar Initials est géré dans TimelineAvatar maintenant

                          return (
                              <div key={project.id} className="h-16 border-b border-slate-50 relative group flex items-center w-full z-10 hover:bg-white/50 transition-colors">
                                  {/* La Barre */}
                                  <div 
                                      onClick={() => handleBarClick(project)}
                                      onMouseEnter={() => setHoveredProjectId(project.id)}
                                      onMouseLeave={() => setHoveredProjectId(null)}
                                      className={`
                                        absolute h-9 rounded-lg shadow-sm border border-white/20 cursor-pointer 
                                        flex items-center px-3 overflow-hidden transition-all duration-300
                                        ${color.bg} ${color.text} ${color.hover}
                                        ${isHovered ? 'shadow-[0_0_15px_rgba(99,102,241,0.4)] scale-[1.01] z-30 brightness-105' : 'hover:shadow-md hover:scale-[1.01] hover:z-20'}
                                      `}
                                      style={{ left: `${left}%`, width: `${width}%`, ...hatchStyle }}
                                  >
                                      {/* Contenu de la barre */}
                                      <div className="flex items-center gap-2 w-full relative z-10">
                                          {/* Avatar Circle sur la barre (Fallback intégré) */}
                                          <TimelineAvatar 
                                            src={project.ownerAvatar} 
                                            name={project.ownerName} 
                                          />
                                          
                                          {/* Titre (masqué si barre trop petite) */}
                                          {width > 5 && (
                                              <div className="flex flex-col min-w-0">
                                                  <span className="font-semibold text-xs truncate drop-shadow-sm select-none flex items-center gap-1.5">
                                                      {project.title}
                                                      {project.status === 'completed' && (
                                                        <CheckCircle2 size={10} className="text-emerald-100" />
                                                      )}
                                                  </span>
                                              </div>
                                          )}
                                      </div>

                                      {/* Tooltip au survol */}
                                      <div className={`opacity-0 ${isHovered ? 'opacity-100' : ''} absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap z-50 transition-opacity pointer-events-none`}>
                                          {new Date(project.startDate).toLocaleDateString()} - {new Date(project.endDate).toLocaleDateString()}
                                      </div>
                                  </div>
                              </div>
                          );
                      })}

                      {projects.length === 0 && (
                          <div className="h-32 flex items-center justify-center">
                              <div className="flex flex-col items-center opacity-30">
                                  <Layers size={32} />
                                  <span className="text-sm mt-2">Aucune donnée à afficher</span>
                              </div>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      </div>
    </div>

    {/* Integration SlideOver */}
    <ProjectSlideOver 
        isOpen={isSlideOverOpen}
        onClose={() => setIsSlideOverOpen(false)}
        project={selectedProject}
    />
    </>
  );
};

// Helper pour numéro de semaine
function getWeekNumber(d: Date) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    const weekNo = Math.ceil(( ( (d.getTime() - yearStart.getTime()) / 86400000) + 1)/7);
    return weekNo;
}

export default ProjectRoadmap;
