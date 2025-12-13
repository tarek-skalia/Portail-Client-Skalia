
import React, { useEffect, useState, useRef } from 'react';
import { Project, ProjectResource, ProjectTask } from '../types';
import { X, CheckSquare, Paperclip, Copy, Tag, Plus, Link as LinkIcon, FileText, UploadCloud, Trash2, ExternalLink, CheckCircle2, Briefcase } from 'lucide-react';
import { useToast } from './ToastProvider';
import { supabase } from '../lib/supabase';

interface ProjectSlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project | null;
}

const ProjectSlideOver: React.FC<ProjectSlideOverProps> = ({ isOpen, onClose, project }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'files'>('details');
  const toast = useToast();

  // Gestion des ressources
  const [resources, setResources] = useState<ProjectResource[]>([]);
  const [isAddingResource, setIsAddingResource] = useState(false);
  const [resourceType, setResourceType] = useState<'file' | 'link'>('file');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkName, setLinkName] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Gestion des tâches
  const [currentTasks, setCurrentTasks] = useState<ProjectTask[]>([]);
  const [computedProgress, setComputedProgress] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
        const timer = setTimeout(() => setIsVisible(true), 50);
        return () => clearTimeout(timer);
    } else {
        setIsVisible(false);
    }
  }, [isOpen]);

  // 1. Reset de l'interface UNIQUEMENT à l'ouverture du panneau
  useEffect(() => {
    if (isOpen) {
        setActiveTab('details');
        setIsAddingResource(false);
    }
  }, [isOpen]);

  // 2. Synchronisation des données (Realtime)
  useEffect(() => {
    if (project) {
        setResources(project.resources || []);
        
        // Initialiser les tâches
        const tasks = project.tasks || [];
        setCurrentTasks(tasks);
        calculateProgress(tasks);
    }
  }, [project]);

  const calculateProgress = (tasks: ProjectTask[]) => {
      if (tasks.length === 0) {
          setComputedProgress(0);
          return;
      }
      const done = tasks.filter(t => t.completed).length;
      setComputedProgress(Math.round((done / tasks.length) * 100));
  };

  const handleCopyId = () => {
    if (project) {
        navigator.clipboard.writeText(project.id);
        toast.success("ID Copié", "Identifiant du projet copié.");
    }
  };

  // --- Gestion Tâches ---
  const toggleTaskCompletion = async (task: ProjectTask) => {
      if (!project) return;
      if (task.type !== 'client') return; // Sécurité frontend

      // 1. Mise à jour optimiste
      const updatedTasks = currentTasks.map(t => 
          t.id === task.id ? { ...t, completed: !t.completed } : t
      );
      setCurrentTasks(updatedTasks);
      calculateProgress(updatedTasks);

      // 2. Mise à jour Supabase
      const { error } = await supabase
          .from('project_tasks')
          .update({ completed: !task.completed })
          .eq('id', task.id);

      if (error) {
          console.error("Erreur update task:", error);
          toast.error("Erreur", "Impossible de mettre à jour la tâche.");
          // Rollback
          setCurrentTasks(currentTasks); 
      } else {
          if (!task.completed) {
              toast.success("Tâche terminée", "Merci pour votre action !");
          }
      }
  };

  // --- Gestion Ressources ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        setUploadedFile(e.target.files[0]);
    }
  };

  const updateResourcesInDb = async (newResources: ProjectResource[]) => {
      if (!project) return false;
      const jsonPayload = newResources as any;
      const { error } = await supabase
        .from('projects')
        .update({ resources: jsonPayload })
        .eq('id', project.id);

      if (error) {
          console.error("Erreur update resources:", error);
          toast.error("Erreur de sauvegarde", "Vérifiez vos permissions.");
          return false;
      }
      return true;
  };

  const handleAddResource = async () => {
      if (!project) return;
      setIsSaving(true);
      let newResource: ProjectResource | null = null;

      try {
          if (resourceType === 'link') {
              if (!linkName || !linkUrl) {
                  toast.error("Erreur", "Veuillez remplir le nom et l'URL.");
                  setIsSaving(false);
                  return;
              }
              newResource = {
                  id: Math.random().toString(36).substr(2, 9),
                  type: 'link',
                  name: linkName,
                  url: linkUrl.startsWith('http') ? linkUrl : `https://${linkUrl}`,
                  addedAt: new Date().toISOString()
              };
          } else if (resourceType === 'file') {
              if (!uploadedFile) {
                  toast.error("Erreur", "Veuillez sélectionner un fichier.");
                  setIsSaving(false);
                  return;
              }

              // Nettoyage nom de fichier
              const fileExt = uploadedFile.name.split('.').pop();
              const cleanName = uploadedFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
              const fileName = `${Date.now()}_${cleanName}`;
              const filePath = `${project.id}/${fileName}`;

              const { error: uploadError } = await supabase.storage
                  .from('project_files')
                  .upload(filePath, uploadedFile);

              if (uploadError) throw new Error("Échec upload.");

              const { data: { publicUrl } } = supabase.storage
                  .from('project_files')
                  .getPublicUrl(filePath);

              newResource = {
                  id: Math.random().toString(36).substr(2, 9),
                  type: 'file',
                  name: uploadedFile.name,
                  url: publicUrl,
                  addedAt: new Date().toISOString(),
                  size: (uploadedFile.size / 1024).toFixed(1) + ' KB'
              };
          }

          if (newResource) {
              const updatedResources = [newResource, ...resources];
              const success = await updateResourcesInDb(updatedResources);
              if (success) {
                  setResources(updatedResources);
                  toast.success("Ajouté", "Ressource enregistrée.");
                  resetResourceForm();
              }
          }

      } catch (error: any) {
          toast.error("Erreur", error.message || "Une erreur est survenue.");
      } finally {
          setIsSaving(false);
      }
  };

  const deleteResource = async (resourceId: string) => {
      if (!project) return;
      
      const resourceToDelete = resources.find(r => r.id === resourceId);
      if (!resourceToDelete) return;

      const previousResources = [...resources];
      const updated = resources.filter(r => r.id !== resourceId);
      
      setIsSaving(true);
      setResources(updated); // UI Optimiste

      try {
          // 1. Si c'est un fichier, on le supprime du Storage
          if (resourceToDelete.type === 'file' && resourceToDelete.url) {
              // L'URL est du type: https://.../storage/v1/object/public/project_files/PROJECT_ID/FILENAME
              // On doit extraire: PROJECT_ID/FILENAME
              const urlParts = resourceToDelete.url.split('/project_files/');
              if (urlParts.length > 1) {
                  const filePath = urlParts[1]; // ex: "proj_123/169888_monfichier.pdf"
                  
                  // Décodage des caractères spéciaux (%20, etc) pour le storage
                  const decodedPath = decodeURIComponent(filePath);

                  const { error: storageError } = await supabase.storage
                      .from('project_files')
                      .remove([decodedPath]);

                  if (storageError) {
                      console.warn("Fichier non trouvé ou erreur storage:", storageError);
                      // On continue quand même pour supprimer la référence en base
                  }
              }
          }

          // 2. Mise à jour de la base de données (Tableau JSON)
          const success = await updateResourcesInDb(updated);
          if (success) {
              toast.info("Supprimé", "Ressource retirée.");
          } else {
              throw new Error("Erreur DB");
          }

      } catch (e) {
          // Rollback en cas d'erreur critique
          setResources(previousResources);
          toast.error("Erreur", "Impossible de supprimer la ressource.");
      } finally {
          setIsSaving(false);
      }
  };

  const resetResourceForm = () => {
      setLinkName('');
      setLinkUrl('');
      setUploadedFile(null);
      setIsAddingResource(false);
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
        uncategorized: 'Non catégorisé',
        onboarding: 'Onboarding',
        in_progress: 'En cours',
        review: 'En révision',
        completed: 'Terminé'
    };
    return labels[status] || status;
  };

  if (!project) return null;

  return (
    <>
      <div 
        className={`fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-[60] transition-opacity duration-300 ${
          isVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      <div 
        className={`fixed inset-y-0 right-0 w-full md:w-[600px] bg-white shadow-2xl z-[70] transform transition-transform duration-300 ease-out flex flex-col ${
          isVisible ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* HEADER */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-100 bg-white shrink-0">
            <div className="flex items-start justify-between mb-4">
                <div>
                     <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider border ${
                            project.status === 'completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                            project.status === 'in_progress' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                            project.status === 'review' ? 'bg-purple-50 text-purple-600 border-purple-100' :
                            'bg-amber-50 text-amber-600 border-amber-100'
                        }`}>
                            {getStatusLabel(project.status)}
                        </span>
                        <span className="text-xs text-slate-400 font-mono flex items-center gap-1 cursor-pointer hover:text-indigo-500" onClick={handleCopyId}>
                             #{project.id.slice(0,6)} <Copy size={10} />
                        </span>
                     </div>
                     <h2 className="text-xl font-bold text-slate-900 leading-tight">
                        {project.title}
                     </h2>
                </div>
                <button 
                    onClick={onClose}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                >
                    <X size={24} />
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-6 mt-4">
                <button 
                    onClick={() => setActiveTab('details')}
                    className={`pb-2 text-sm font-medium transition-all relative ${
                        activeTab === 'details' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-800'
                    }`}
                >
                    Détails & Tâches
                    {activeTab === 'details' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 rounded-t-full"></div>}
                </button>
                <button 
                    onClick={() => setActiveTab('files')}
                    className={`pb-2 text-sm font-medium transition-all relative ${
                        activeTab === 'files' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-800'
                    }`}
                >
                    Fichiers
                    {activeTab === 'files' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 rounded-t-full"></div>}
                </button>
            </div>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto bg-slate-50/50 p-6">
            
            {activeTab === 'details' && (
                <div className="space-y-6 animate-fade-in">
                    
                    {/* Description Card */}
                    <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
                        <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                            <Tag size={16} className="text-indigo-500" /> Description
                        </h3>
                        <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-line">
                            {project.description || "Aucune description fournie pour ce projet."}
                        </p>
                    </div>

                    {/* Avancement */}
                     <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
                        <div className="flex justify-between items-end mb-2">
                            <span className="text-sm font-medium text-slate-600">Progression globale</span>
                            <span className="text-xl font-bold text-indigo-600">{computedProgress}%</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-indigo-500 rounded-full transition-all duration-500 ease-out" 
                                style={{ width: `${computedProgress}%` }}
                            ></div>
                        </div>
                    </div>

                    {/* --- SECTION TÂCHES CLIENTS (INTERACTIVE) --- */}
                    <div>
                         <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                            <CheckCircle2 size={16} className="text-emerald-500" /> Vos actions requises
                        </h3>
                        
                        <div className="space-y-2">
                            {currentTasks.filter(t => t.type === 'client').length === 0 ? (
                                <div className="text-center py-4 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                                    <p className="text-slate-400 text-sm italic">Aucune action requise de votre part pour le moment.</p>
                                </div>
                            ) : (
                                currentTasks.filter(t => t.type === 'client').map((task) => (
                                    <div 
                                        key={task.id} 
                                        onClick={() => toggleTaskCompletion(task)}
                                        className={`flex items-center gap-3 p-3 bg-white rounded-lg border transition-all cursor-pointer group ${
                                            task.completed 
                                            ? 'border-emerald-100 bg-emerald-50/30 opacity-70' 
                                            : 'border-indigo-100 hover:border-indigo-300 hover:shadow-sm'
                                        }`}
                                    >
                                        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                                            task.completed 
                                            ? 'bg-emerald-500 border-emerald-500 text-white' 
                                            : 'border-slate-300 bg-white group-hover:border-indigo-500'
                                        }`}>
                                            {task.completed && <CheckSquare size={14} />}
                                        </div>
                                        
                                        <span className={`text-sm ${
                                            task.completed 
                                            ? 'text-slate-400 line-through decoration-slate-300' 
                                            : 'text-slate-800 font-medium'
                                        }`}>
                                            {task.name}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* --- SECTION TÂCHES AGENCE (LECTURE SEULE - VERSION COLORÉE) --- */}
                    <div>
                         <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                            <Briefcase size={16} className="text-indigo-500" /> Avancement Agence
                        </h3>
                        
                        <div className="space-y-3">
                             {currentTasks.filter(t => t.type !== 'client').length === 0 ? (
                                <div className="text-center py-4 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                                    <p className="text-slate-400 text-sm italic">Planning agence non défini.</p>
                                </div>
                            ) : (
                                currentTasks.filter(t => t.type !== 'client').map((task, i) => (
                                    <div 
                                        key={i} 
                                        className={`flex items-center gap-3 p-4 rounded-xl border shadow-sm transition-all cursor-default relative overflow-hidden ${
                                            task.completed 
                                            ? 'bg-slate-50 border-slate-200' 
                                            : 'bg-indigo-50/40 border-indigo-100'
                                        }`}
                                    >
                                        {/* Colored Left Border Accent */}
                                        <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                                            task.completed ? 'bg-slate-300' : 'bg-indigo-500'
                                        }`}></div>

                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                                            task.completed 
                                            ? 'border-slate-300 bg-slate-100 text-slate-400' 
                                            : 'border-indigo-500 bg-indigo-500 text-white shadow-sm'
                                        }`}>
                                            {task.completed ? <CheckSquare size={12} /> : <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                                        </div>
                                        
                                        <span className={`text-sm font-semibold ${
                                            task.completed 
                                            ? 'text-slate-400 line-through' 
                                            : 'text-indigo-950'
                                        }`}>
                                            {task.name}
                                        </span>

                                        {/* Badge Agence */}
                                        {!task.completed && (
                                            <span className="ml-auto text-[10px] uppercase font-bold text-indigo-600 bg-white border border-indigo-100 px-2 py-0.5 rounded-md shadow-sm">
                                                En cours
                                            </span>
                                        )}
                                        {task.completed && (
                                            <span className="ml-auto text-[10px] uppercase font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                                                Fait
                                            </span>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                </div>
            )}

            {activeTab === 'files' && (
                <div className="animate-fade-in space-y-6">
                    {/* Add Button */}
                    {!isAddingResource ? (
                        <button 
                            onClick={() => setIsAddingResource(true)}
                            className="w-full py-4 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center text-slate-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/50 transition-all group"
                        >
                            <div className="w-10 h-10 rounded-full bg-slate-100 group-hover:bg-indigo-100 flex items-center justify-center mb-2 transition-colors">
                                <Plus size={20} />
                            </div>
                            <span className="font-semibold text-sm">Ajouter un fichier ou un lien</span>
                        </button>
                    ) : (
                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm animate-fade-in">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-slate-800 text-sm">Nouvelle ressource</h3>
                                <button onClick={resetResourceForm} className="text-slate-400 hover:text-slate-600">
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Type Switcher */}
                            <div className="flex bg-slate-100 p-1 rounded-lg mb-4">
                                <button 
                                    onClick={() => setResourceType('file')}
                                    className={`flex-1 py-1.5 text-xs font-medium rounded-md flex items-center justify-center gap-2 transition-all ${resourceType === 'file' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    <UploadCloud size={14} /> Importer un fichier
                                </button>
                                <button 
                                    onClick={() => setResourceType('link')}
                                    className={`flex-1 py-1.5 text-xs font-medium rounded-md flex items-center justify-center gap-2 transition-all ${resourceType === 'link' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    <LinkIcon size={14} /> Ajouter un lien
                                </button>
                            </div>

                            {resourceType === 'link' ? (
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase">Nom du lien</label>
                                        <input 
                                            type="text" 
                                            value={linkName}
                                            onChange={(e) => setLinkName(e.target.value)}
                                            placeholder="Ex: Maquettes Figma" 
                                            className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase">URL</label>
                                        <input 
                                            type="url" 
                                            value={linkUrl}
                                            onChange={(e) => setLinkUrl(e.target.value)}
                                            placeholder="https://..." 
                                            className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                     <input 
                                        type="file" 
                                        ref={fileInputRef} 
                                        onChange={handleFileChange} 
                                        className="hidden" 
                                    />
                                    <div 
                                        onClick={() => fileInputRef.current?.click()}
                                        className="border-2 border-dashed border-slate-200 hover:border-indigo-300 rounded-lg p-6 text-center cursor-pointer transition-colors"
                                    >
                                        {uploadedFile ? (
                                            <div className="flex items-center justify-center gap-2 text-indigo-600 font-medium">
                                                <FileText size={18} />
                                                {uploadedFile.name}
                                            </div>
                                        ) : (
                                            <div className="text-slate-500 text-sm">
                                                Cliquez pour parcourir vos fichiers
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            <button 
                                onClick={handleAddResource}
                                disabled={isSaving}
                                className={`w-full mt-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg transition-colors ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                {isSaving ? 'Enregistrement...' : 'Ajouter'}
                            </button>
                        </div>
                    )}

                    {/* Resources List */}
                    <div className="space-y-3">
                        {resources.length === 0 && !isAddingResource ? (
                             <div className="text-center py-10">
                                <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-300">
                                    <Paperclip size={24} />
                                </div>
                                <p className="text-slate-500 text-sm">Aucun fichier partagé pour le moment.</p>
                             </div>
                        ) : (
                            resources.map((res) => (
                                <div key={res.id} className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3 group hover:border-indigo-200 transition-all">
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${res.type === 'link' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'}`}>
                                        {res.type === 'link' ? <LinkIcon size={20} /> : <FileText size={20} />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-sm font-semibold text-slate-800 truncate">{res.name}</h4>
                                        <div className="flex items-center gap-2 text-xs text-slate-400">
                                            <span>{new Date(res.addedAt).toLocaleDateString()}</span>
                                            {res.size && <span>• {res.size}</span>}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <a 
                                            href={res.url} 
                                            target="_blank" 
                                            rel="noreferrer"
                                            className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-indigo-600 transition-colors"
                                            title="Ouvrir"
                                        >
                                            <ExternalLink size={16} />
                                        </a>
                                        <button 
                                            onClick={() => deleteResource(res.id)}
                                            className="p-2 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500 transition-colors"
                                            title="Supprimer"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>

        {/* FOOTER */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 shrink-0">
            <button 
                onClick={onClose}
                className="w-full py-3 bg-white border border-slate-200 text-slate-700 hover:text-indigo-600 hover:border-indigo-200 font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-2"
            >
                Fermer
            </button>
        </div>
      </div>
    </>
  );
};

export default ProjectSlideOver;
