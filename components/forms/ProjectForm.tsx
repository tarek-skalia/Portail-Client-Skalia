
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ToastProvider';
import { useAdmin } from '../AdminContext';
import { PROJECT_OWNERS } from '../../constants';
import { Project, ProjectTask } from '../../types';
import { Plus, Trash2, Briefcase, User, CheckSquare, Users, Lock } from 'lucide-react';

interface ProjectFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  initialData?: Project | null;
}

const ProjectForm: React.FC<ProjectFormProps> = ({ onSuccess, onCancel, initialData }) => {
  const { targetUserId, isAdmin, clients } = useAdmin();
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  const availableClients = clients.filter(c => c.role !== 'admin');

  // Détecter mode contextuel
  const currentViewedClient = clients.find(c => c.id === targetUserId);
  const isContextualMode = currentViewedClient && currentViewedClient.role !== 'admin';

  // Le champ est verrouillé si : Mode Contextuel OU Mode Édition
  const isClientLocked = isContextualMode || !!initialData;

  // Client Selection
  const [selectedClientId, setSelectedClientId] = useState(() => {
      if (initialData) return initialData.clientId;
      if (isContextualMode) return targetUserId;
      if (availableClients.length > 0) return availableClients[0].id;
      return targetUserId;
  });

  // Fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('onboarding');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const [ownerName, setOwnerName] = useState('Tarek Zreik');
  const [tagsStr, setTagsStr] = useState('');

  // Tasks Management
  const [tasks, setTasks] = useState<Partial<ProjectTask>[]>([]);
  const [tasksToDelete, setTasksToDelete] = useState<string[]>([]);

  const owners = Object.keys(PROJECT_OWNERS);

  // Initialisation
  useEffect(() => {
      if (initialData) {
          setSelectedClientId(initialData.clientId);
          setTitle(initialData.title);
          setDescription(initialData.description);
          setStatus(initialData.status);
          
          if (initialData.startDate && initialData.startDate.includes('/')) {
              const [d, m, y] = initialData.startDate.split('/');
              setStartDate(`${y}-${m}-${d}`);
          } else {
              setStartDate(initialData.startDate || '');
          }

          if (initialData.endDate && initialData.endDate.includes('/')) {
              const [d, m, y] = initialData.endDate.split('/');
              setEndDate(`${y}-${m}-${d}`);
          } else {
              setEndDate(initialData.endDate || '');
          }

          setOwnerName(initialData.ownerName || 'Skalia Team');
          setTagsStr(initialData.tags ? initialData.tags.join(', ') : '');

          // Load Tasks
          if (initialData.tasks) {
              setTasks(initialData.tasks.map(t => ({ ...t })));
          } else {
              setTasks([]);
          }
      } else {
          // Default Tasks for new project
          setTasks([
              { name: 'Kick-off meeting', type: 'agency', completed: false },
              { name: 'Validation des accès', type: 'client', completed: false }
          ]);
      }
  }, [initialData]);

  const handleAddTask = () => {
      setTasks([...tasks, { name: '', type: 'agency', completed: false }]);
  };

  const handleRemoveTask = (index: number) => {
      const taskToRemove = tasks[index];
      if (taskToRemove.id) {
          setTasksToDelete([...tasksToDelete, taskToRemove.id]);
      }
      const newTasks = [...tasks];
      newTasks.splice(index, 1);
      setTasks(newTasks);
  };

  const updateTask = (index: number, field: keyof ProjectTask, value: any) => {
      const newTasks = [...tasks];
      newTasks[index] = { ...newTasks[index], [field]: value };
      setTasks(newTasks);
  };

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);

      const tagsArray = tagsStr.split(',').map(t => t.trim()).filter(t => t !== '');
      const ownerAvatar = PROJECT_OWNERS[ownerName]; 

      const payload = {
          user_id: selectedClientId, // Use selected client
          title,
          description,
          status,
          start_date: startDate,
          end_date: endDate || null,
          owner_name: ownerName,
          owner_avatar: ownerAvatar,
          tags: tagsArray
      };

      try {
          let currentProjectId = initialData?.id;

          if (initialData) {
              // --- UPDATE PROJECT ---
              const { error } = await supabase
                .from('projects')
                .update(payload)
                .eq('id', initialData.id);
              
              if (error) throw error;
              toast.success("Mis à jour", "Le projet a été modifié.");
          } else {
              // --- INSERT PROJECT ---
              const { data: projectData, error } = await supabase.from('projects').insert({
                  ...payload,
                  resources: [],
                  created_at: new Date().toISOString()
              }).select().single();

              if (error) throw error;
              if (projectData) currentProjectId = projectData.id;
              
              toast.success("Créé", "Projet initialisé avec succès.");
          }

          // --- MANAGE TASKS ---
          if (currentProjectId) {
              if (tasksToDelete.length > 0) {
                  await supabase.from('project_tasks').delete().in('id', tasksToDelete);
              }

              const newTasks = tasks.filter(t => !t.id && t.name?.trim());
              const existingTasks = tasks.filter(t => t.id && t.name?.trim());

              if (newTasks.length > 0) {
                  await supabase.from('project_tasks').insert(newTasks.map(t => ({
                      project_id: currentProjectId,
                      name: t.name,
                      type: t.type || 'agency',
                      completed: t.completed || false
                  })));
              }

              if (existingTasks.length > 0) {
                  await Promise.all(existingTasks.map(t => 
                      supabase.from('project_tasks').update({
                          name: t.name,
                          type: t.type,
                          completed: t.completed
                      }).eq('id', t.id!)
                  ));
              }
          }

          onSuccess();

      } catch (err: any) {
          console.error(err);
          toast.error("Erreur", err.message);
      } finally {
          setLoading(false);
      }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* CLIENT SELECTOR (ADMIN ONLY) */}
        {isAdmin && (
            <div className={`p-4 rounded-xl border ${isClientLocked ? 'bg-slate-100 border-slate-200' : 'bg-indigo-50/50 border-indigo-100'}`}>
                <label className={`block text-xs font-bold uppercase mb-2 flex items-center gap-2 ${isClientLocked ? 'text-slate-500' : 'text-indigo-600'}`}>
                    {isClientLocked ? <Lock size={14} /> : <Users size={14} />} 
                    {isClientLocked ? 'Projet assigné à (Verrouillé)' : 'Client assigné'}
                </label>
                <div className="relative">
                    <select
                        value={selectedClientId}
                        onChange={(e) => setSelectedClientId(e.target.value)}
                        disabled={isClientLocked}
                        className={`w-full pl-3 pr-8 py-2.5 rounded-lg text-sm font-bold outline-none appearance-none transition-colors ${
                            isClientLocked 
                            ? 'bg-slate-200 text-slate-500 cursor-not-allowed border border-slate-300' 
                            : 'bg-white border border-indigo-200 text-slate-700 focus:ring-2 focus:ring-indigo-500 cursor-pointer hover:border-indigo-300'
                        }`}
                    >
                        {availableClients.map(client => (
                            <option key={client.id} value={client.id}>
                                {client.company} ({client.name})
                            </option>
                        ))}
                    </select>
                    <div className={`absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none ${isClientLocked ? 'text-slate-400' : 'text-indigo-500'}`}>
                        {isClientLocked ? <Lock size={16} /> : <User size={16} />}
                    </div>
                </div>
            </div>
        )}

        {/* ... Reste du formulaire identique ... */}
        {/* TITRE */}
        <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Titre du projet</label>
            <input 
                type="text" 
                required 
                value={title} 
                onChange={e => setTitle(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-800" 
                placeholder="Ex: Refonte CRM HubSpot"
            />
        </div>

        {/* DATES */}
        <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date de début</label>
                <input 
                    type="date" 
                    required 
                    value={startDate} 
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" 
                />
            </div>
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date de fin (estimée)</label>
                <input 
                    type="date" 
                    value={endDate} 
                    onChange={e => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" 
                />
            </div>
        </div>

        {/* STATUS & OWNER */}
        <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Statut</label>
                <select 
                    value={status} 
                    onChange={e => setStatus(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                >
                    <option value="uncategorized">Non catégorisé</option>
                    <option value="onboarding">Onboarding</option>
                    <option value="in_progress">En cours</option>
                    <option value="review">En révision</option>
                    <option value="completed">Terminé</option>
                </select>
            </div>
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Responsable</label>
                <select 
                    value={ownerName} 
                    onChange={e => setOwnerName(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                >
                    {owners.map(o => <option key={o} value={o}>{o}</option>)}
                    <option value="Skalia Team">Skalia Team</option>
                </select>
            </div>
        </div>

        {/* DESCRIPTION */}
        <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description</label>
            <textarea 
                rows={3}
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="Objectifs et périmètre..."
            />
        </div>

        {/* --- GESTION DES TACHES --- */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <label className="block text-xs font-bold text-indigo-600 uppercase mb-3 flex items-center gap-2">
                <CheckSquare size={14} /> Tâches & Jalons
            </label>
            
            <div className="space-y-3">
                {tasks.map((task, idx) => (
                    <div key={idx} className="flex gap-2 items-start">
                        {/* Type Selector */}
                        <div className="relative">
                            <select
                                value={task.type || 'agency'}
                                onChange={e => updateTask(idx, 'type', e.target.value)}
                                className={`appearance-none w-28 pl-8 pr-2 py-2 text-xs font-bold border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer ${
                                    task.type === 'client' 
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                    : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                }`}
                            >
                                <option value="agency">Agence</option>
                                <option value="client">Client</option>
                            </select>
                            <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                                {task.type === 'client' ? <User size={14} className="text-emerald-600" /> : <Briefcase size={14} className="text-indigo-600" />}
                            </div>
                        </div>

                        {/* Status Toggle Button (CHECKBOX) */}
                        <button
                            type="button"
                            onClick={() => updateTask(idx, 'completed', !task.completed)}
                            className={`p-2 rounded-lg border transition-all ${
                                task.completed 
                                ? 'bg-emerald-100 border-emerald-200 text-emerald-700 shadow-sm' 
                                : 'bg-white border-slate-200 text-slate-300 hover:border-indigo-300 hover:text-indigo-400'
                            }`}
                            title={task.completed ? "Marquer comme non fait" : "Marquer comme fait"}
                        >
                            <CheckSquare size={18} />
                        </button>

                        {/* Name Input */}
                        <input 
                            type="text" 
                            placeholder="Nom de la tâche..." 
                            value={task.name}
                            onChange={e => updateTask(idx, 'name', e.target.value)}
                            className={`flex-1 px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all ${
                                task.completed ? 'bg-slate-50 text-slate-500 line-through decoration-slate-400' : 'bg-white'
                            }`}
                        />

                        {/* Delete Button */}
                        <button 
                            type="button" 
                            onClick={() => handleRemoveTask(idx)}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                ))}
            </div>
            
            <button 
                type="button" 
                onClick={handleAddTask}
                className="mt-3 text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
            >
                <Plus size={14} /> Ajouter une tâche
            </button>
        </div>

        {/* TAGS */}
        <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tags (séparés par virgule)</label>
            <input 
                type="text" 
                value={tagsStr} 
                onChange={e => setTagsStr(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" 
                placeholder="Ex: CRM, API, Zapier"
            />
        </div>

        {/* ACTIONS */}
        <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
            <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg">Annuler</button>
            <button type="submit" disabled={loading} className="px-6 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-md disabled:opacity-50">
                {loading ? 'Enregistrement...' : (initialData ? 'Mettre à jour' : 'Lancer le projet')}
            </button>
        </div>
    </form>
  );
};

export default ProjectForm;
