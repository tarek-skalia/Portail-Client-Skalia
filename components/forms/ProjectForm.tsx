
import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ToastProvider';
import { useAdmin } from '../AdminContext';
import { PROJECT_OWNERS } from '../../constants';

interface ProjectFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

const ProjectForm: React.FC<ProjectFormProps> = ({ onSuccess, onCancel }) => {
  const { targetUserId } = useAdmin();
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  // Fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('onboarding');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const [ownerName, setOwnerName] = useState('Tarek Zreik');
  const [tagsStr, setTagsStr] = useState('');

  const owners = Object.keys(PROJECT_OWNERS);

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);

      const tagsArray = tagsStr.split(',').map(t => t.trim()).filter(t => t !== '');
      const ownerAvatar = PROJECT_OWNERS[ownerName]; // Auto-fill avatar

      try {
          // 1. Create Project
          const { data: projectData, error } = await supabase.from('projects').insert({
              user_id: targetUserId,
              title,
              description,
              status,
              start_date: startDate,
              end_date: endDate || null,
              owner_name: ownerName,
              owner_avatar: ownerAvatar,
              tags: tagsArray,
              resources: [], // Init empty
              created_at: new Date().toISOString()
          }).select().single();

          if (error) throw error;
          
          // 2. Create Default Tasks (Optional but nice)
          if (projectData) {
              await supabase.from('project_tasks').insert([
                  { project_id: projectData.id, name: 'Kick-off meeting', type: 'agency' },
                  { project_id: projectData.id, name: 'Validation des accès', type: 'client' }
              ]);
          }

          toast.success("Créé", "Projet initialisé avec succès.");
          onSuccess();

      } catch (err: any) {
          toast.error("Erreur", err.message);
      } finally {
          setLoading(false);
      }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
        
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

        <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
            <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg">Annuler</button>
            <button type="submit" disabled={loading} className="px-6 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-md disabled:opacity-50">
                {loading ? 'Création...' : 'Lancer le projet'}
            </button>
        </div>
    </form>
  );
};

export default ProjectForm;
