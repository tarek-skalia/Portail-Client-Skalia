
import React, { useState, useEffect } from 'react';
import { Project } from '../types';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, List, Search, MoreHorizontal, Filter } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ProjectRoadmapProps {
  userId?: string;
  projects?: Project[];
  onProjectClick?: (projectId: string) => void;
}

// Palette de couleurs VIVES uniquement (Suppression des gris/slates/zinc)
// 18 variations distinctes pour éviter les collisions visuelles
const PROJECT_COLORS = [
  { bg: 'bg-blue-100', border: 'border-blue-500', text: 'text-blue-900' },
  { bg: 'bg-emerald-100', border: 'border-emerald-500', text: 'text-emerald-900' },
  { bg: 'bg-purple-100', border: 'border-purple-500', text: 'text-purple-900' },
  { bg: 'bg-orange-100', border: 'border-orange-500', text: 'text-orange-900' },
  { bg: 'bg-rose-100', border: 'border-rose-500', text: 'text-rose-900' },
  { bg: 'bg-cyan-100', border: 'border-cyan-500', text: 'text-cyan-900' },
  { bg: 'bg-lime-100', border: 'border-lime-500', text: 'text-lime-900' },
  { bg: 'bg-indigo-100', border: 'border-indigo-500', text: 'text-indigo-900' },
  { bg: 'bg-amber-100', border: 'border-amber-500', text: 'text-amber-900' },
  { bg: 'bg-fuchsia-100', border: 'border-fuchsia-500', text: 'text-fuchsia-900' },
  { bg: 'bg-teal-100', border: 'border-teal-500', text: 'text-teal-900' },
  { bg: 'bg-pink-100', border: 'border-pink-500', text: 'text-pink-900' },
  { bg: 'bg-sky-100', border: 'border-sky-500', text: 'text-sky-900' },
  { bg: 'bg-red-100', border: 'border-red-500', text: 'text-red-900' },
  { bg: 'bg-green-100', border: 'border-green-500', text: 'text-green-900' },
  { bg: 'bg-violet-100', border: 'border-violet-500', text: 'text-violet-900' },
  { bg: 'bg-yellow-100', border: 'border-yellow-500', text: 'text-yellow-900' },
  { bg: 'bg-blue-200', border: 'border-blue-600', text: 'text-blue-950' }, // Variante bleu plus fort
];

const ProjectRoadmap: React.FC<ProjectRoadmapProps> = ({ userId, onProjectClick }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (userId) {
        fetchProjects();

        // Realtime Subscription
        const channel = supabase
            .channel('realtime:projects_roadmap')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => {
                fetchProjects();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }
  }, [userId]);

  const fetchProjects = async () => {
    // Premier chargement uniquement
    if (projects.length === 0) setIsLoading(true);

    const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', userId);

    if (error) {
        console.error('Erreur chargement projets roadmap:', error);
    } else if (data) {
        const mappedProjects: Project[] = data.map((p: any) => ({
            id: p.id,
            clientId: p.user_id,
            title: p.title,
            description: p.description || '',
            status: p.status,
            startDate: p.start_date || '', // On garde le format string YYYY-MM-DD pour le parsing
            endDate: p.end_date || '',
        }));
        setProjects(mappedProjects);
    }
    setIsLoading(false);
  };

  // --- Helpers ---

  const getDaysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const getFirstDayOfMonth = (date: Date) => {
    const day = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    return day === 0 ? 6 : day - 1; // Ajustement Lundi=0 ... Dimanche=6
  };

  const monthNames = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const daysOfWeek = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'];

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const goToToday = () => setCurrentDate(new Date());

  // Parsing sûr des dates (Supabase renvoie YYYY-MM-DD, le composant précédent renvoyait DD/MM/YYYY)
  const parseDate = (dateStr: string) => {
    if (!dateStr || dateStr === '-') return null;
    
    // Si format DD/MM/YYYY (Legacy Mock)
    if (dateStr.includes('/')) {
        const [day, month, year] = dateStr.split('/').map(Number);
        return new Date(year, month - 1, day);
    }
    // Si format YYYY-MM-DD (Supabase Standard)
    return new Date(dateStr);
  };

  // Génère une couleur STABLE basée sur l'ID du projet
  // Algorithme de hachage "DJB2" (plus robuste que le précédent pour éviter les collisions)
  const getColorForProject = (projectId: string) => {
    let hash = 5381;
    for (let i = 0; i < projectId.length; i++) {
        // hash * 33 + c
        hash = ((hash << 5) + hash) + projectId.charCodeAt(i); 
    }
    
    // On force un nombre positif et on prend le modulo
    const index = Math.abs(hash) % PROJECT_COLORS.length;
    return PROJECT_COLORS[index];
  };

  // --- Grid Generation ---
  
  const daysInMonth = getDaysInMonth(currentDate);
  const firstDayIndex = getFirstDayOfMonth(currentDate);
  
  // On construit un tableau de semaines. Chaque semaine contient les dates (objets Date) ou null
  const weeks: (Date | null)[][] = [];
  let currentWeek: (Date | null)[] = Array(7).fill(null);
  
  for (let i = 0; i < firstDayIndex; i++) {
    currentWeek[i] = null;
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dayOfWeek = (firstDayIndex + day - 1) % 7;
    currentWeek[dayOfWeek] = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    
    if (dayOfWeek === 6 || day === daysInMonth) {
      weeks.push(currentWeek);
      currentWeek = Array(7).fill(null);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] animate-fade-in-up bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
        <div className="flex items-center gap-4">
           <h2 className="text-2xl font-bold text-slate-800 capitalize flex items-center gap-3">
             {monthNames[currentDate.getMonth()]} <span className="text-slate-400 font-light">{currentDate.getFullYear()}</span>
             {isLoading && <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>}
           </h2>
        </div>

        <div className="flex items-center gap-3">
           <div className="flex items-center bg-slate-100 rounded-lg p-1">
              <button onClick={prevMonth} className="p-1.5 hover:bg-white rounded-md transition-colors text-slate-600 shadow-sm"><ChevronLeft size={18} /></button>
              <button onClick={nextMonth} className="p-1.5 hover:bg-white rounded-md transition-colors text-slate-600 ml-1"><ChevronRight size={18} /></button>
           </div>
           <button onClick={goToToday} className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">
              <CalendarIcon size={16} /> Aujourd'hui
           </button>
        </div>
      </div>

      {/* Grid Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
         <div className="w-full min-w-[800px]">
            {/* Jours de la semaine */}
            <div className="grid grid-cols-7 border-b border-slate-200 sticky top-0 bg-white z-20">
               {daysOfWeek.map((day) => (
                  <div key={day} className="py-3 text-center text-sm font-medium text-slate-500 border-r border-slate-100 last:border-r-0">
                     {day}
                  </div>
               ))}
            </div>

            {/* Corps du calendrier */}
            <div className="flex flex-col">
               {weeks.map((week, weekIndex) => {
                  // Trouver les projets actifs dans cette semaine spécifique
                  const weekStart = week.find(d => d !== null) || new Date();
                  const weekEnd = week.slice().reverse().find(d => d !== null) || new Date();

                  // Filtrer les projets qui chevauchent cette semaine
                  const activeProjects = projects.filter(project => {
                      const pStart = parseDate(project.startDate);
                      const pEnd = parseDate(project.endDate);
                      if (!pStart || !pEnd) return false;
                      // Chevauchement simple: StartProjet <= EndSemaine ET EndProjet >= StartSemaine
                      return pStart <= weekEnd && pEnd >= weekStart;
                  });

                  return (
                     <div key={weekIndex} className="relative min-h-[120px] border-b border-slate-100">
                        {/* Background Grid Cells */}
                        <div className="absolute inset-0 grid grid-cols-7 h-full pointer-events-none z-0">
                           {Array.from({ length: 7 }).map((_, i) => (
                              <div key={i} className="h-full border-r border-slate-100 last:border-r-0 p-2 relative">
                                  {week[i] && (
                                     <span className={`absolute top-2 right-2 text-sm z-0 ${
                                        week[i]?.getDate() === new Date().getDate() && 
                                        week[i]?.getMonth() === new Date().getMonth() && 
                                        week[i]?.getFullYear() === new Date().getFullYear()
                                        ? 'bg-indigo-600 text-white w-7 h-7 flex items-center justify-center rounded-full font-bold shadow-md'
                                        : 'text-slate-700 font-medium'
                                     }`}>
                                        {week[i]?.getDate()}
                                     </span>
                                  )}
                              </div>
                           ))}
                        </div>

                        {/* Projects Layer (Grille par dessus pour l'alignement précis) */}
                        <div className="relative pt-12 pb-2 px-0 z-10 w-full">
                           <div className="flex flex-col gap-1 w-full">
                               {activeProjects.map((project) => {
                                   const pStart = parseDate(project.startDate);
                                   const pEnd = parseDate(project.endDate);
                                   if (!pStart || !pEnd) return null;

                                   // Calculer la position dans la grille de 7 colonnes (0 à 6)
                                   // 1. Début effectif dans cette semaine
                                   let startCol = 0;
                                   if (pStart >= weekStart) {
                                       // Si le projet commence APRÈS ou LE jour du début de semaine, on trouve son index
                                       const dayDiff = Math.floor((pStart.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24));
                                       // Ajuster si la semaine a des jours nulls au début (première semaine du mois)
                                       const firstDayIndex = week.findIndex(d => d !== null);
                                       startCol = dayDiff + firstDayIndex;
                                   } else {
                                       // Sinon il continue de la semaine d'avant, donc il commence à la première colonne valide
                                       startCol = week.findIndex(d => d !== null);
                                   }

                                   // 2. Fin effective dans cette semaine
                                   let endCol = 6;
                                   if (pEnd <= weekEnd) {
                                       const dayDiff = Math.floor((pEnd.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24));
                                       const firstDayIndex = week.findIndex(d => d !== null);
                                       endCol = dayDiff + firstDayIndex;
                                   } else {
                                        // Sinon il continue la semaine d'après, donc il finit à la dernière colonne valide
                                        const reversedIndex = week.slice().reverse().findIndex(d => d !== null);
                                        endCol = 6 - reversedIndex;
                                   }
                                   
                                   // CSS Grid est base-1 pour start, et end est exclusif
                                   const gridStart = startCol + 1;
                                   const span = (endCol - startCol) + 1;
                                   
                                   // Utilisation de l'ID pour une couleur constante
                                   const color = getColorForProject(project.id);

                                   return (
                                       <div 
                                          key={project.id}
                                          className="grid grid-cols-7 w-full px-0 pointer-events-none" // Container grille
                                       >
                                           <div 
                                              onClick={() => onProjectClick && onProjectClick(project.id)}
                                              className={`
                                                  pointer-events-auto
                                                  mx-1 rounded-md shadow-sm border border-l-4 py-1.5 px-3 
                                                  text-xs font-bold truncate flex items-center cursor-pointer 
                                                  hover:brightness-95 transition-all
                                                  hover:scale-[1.01] hover:shadow-md
                                                  ${color.bg} ${color.border} ${color.text}
                                              `}
                                              title="Cliquez pour voir dans le pipeline"
                                              style={{ 
                                                  gridColumnStart: gridStart, 
                                                  gridColumnEnd: `span ${span}` 
                                              }}
                                           >
                                              {/* Flèche gauche si continue d'avant */}
                                              {pStart < weekStart && <span className="mr-1 opacity-60">←</span>}
                                              
                                              <span className="truncate">{project.title}</span>
                                              
                                              {/* Flèche droite si continue après */}
                                              {pEnd > weekEnd && <span className="ml-auto opacity-60">→</span>}
                                           </div>
                                       </div>
                                   );
                               })}
                           </div>
                        </div>
                     </div>
                  );
               })}
            </div>
         </div>
      </div>
    </div>
  );
};

export default ProjectRoadmap;
