
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ToastProvider';
import { useAdmin } from '../AdminContext';
import { Plus, Trash2, GripVertical, Info, Fingerprint, Users, User, Lock } from 'lucide-react';
import { Automation } from '../../types';

interface AutomationFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  initialData?: Automation | null; // Support édition
}

interface Step {
    tool: string;
    action: string;
}

const AutomationForm: React.FC<AutomationFormProps> = ({ onSuccess, onCancel, initialData }) => {
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
  const [customId, setCustomId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive' | 'maintenance' | 'error'>('active');
  const [toolIconsStr, setToolIconsStr] = useState(''); 
  const [pipelineSteps, setPipelineSteps] = useState<Step[]>([{ tool: '', action: '' }]);
  const [userGuide, setUserGuide] = useState('');

  // Initialisation pour l'édition
  useEffect(() => {
      if (initialData) {
          setSelectedClientId(initialData.clientId);
          setCustomId(initialData.id);
          setName(initialData.name);
          setDescription(initialData.description);
          setStatus(initialData.status as any);
          setToolIconsStr(initialData.toolIcons.join(', '));
          setPipelineSteps(initialData.pipelineSteps && initialData.pipelineSteps.length > 0 
            ? initialData.pipelineSteps 
            : [{ tool: '', action: '' }]
          );
          setUserGuide(initialData.userGuide || '');
      }
  }, [initialData]);

  const handleAddStep = () => {
      setPipelineSteps([...pipelineSteps, { tool: '', action: '' }]);
  };

  const handleRemoveStep = (index: number) => {
      const newSteps = [...pipelineSteps];
      newSteps.splice(index, 1);
      setPipelineSteps(newSteps);
  };

  const updateStep = (index: number, field: keyof Step, value: string) => {
      const newSteps = [...pipelineSteps];
      newSteps[index][field] = value;
      setPipelineSteps(newSteps);
  };

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);

      const toolsArray = toolIconsStr.split(',').map(t => t.trim()).filter(t => t !== '');
      const validSteps = pipelineSteps.filter(s => s.tool.trim() !== '' || s.action.trim() !== '');

      if (!customId.trim()) {
          toast.error("Erreur", "L'ID du workflow est obligatoire.");
          setLoading(false);
          return;
      }

      const payload = {
          user_id: selectedClientId,
          name,
          description,
          status,
          tool_icons: toolsArray,
          pipeline_steps: validSteps,
          user_guide: userGuide
      };

      try {
          if (initialData) {
              // UPDATE
              const { error } = await supabase
                .from('automations')
                .update(payload)
                .eq('id', initialData.id);
              if (error) throw error;
              toast.success("Mis à jour", "L'automatisation a été modifiée.");
          } else {
              // INSERT
              const { error } = await supabase
                .from('automations')
                .insert({
                    id: customId.trim(), 
                    created_at: new Date().toISOString(),
                    ...payload
                });
              if (error) throw error;
              toast.success("Créé", "L'automatisation a été ajoutée.");
          }
          
          onSuccess();

      } catch (err: any) {
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
                    {isClientLocked ? 'Assigné à (Verrouillé)' : 'Assigner au client'}
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

        {/* ... Rest of form ... */}
        {/* ID TECHNIQUE */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-2">
                <Fingerprint size={12} /> ID du Workflow (N8N / Technique)
            </label>
            <input 
                type="text" 
                required 
                value={customId} 
                onChange={e => setCustomId(e.target.value)}
                disabled={!!initialData} // Désactivé en édition car c'est la clé primaire
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-sm ${initialData ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-white'}`}
                placeholder="Collez l'ID du workflow ici..."
            />
            {!initialData && (
                <p className="text-[10px] text-slate-400 mt-1">
                    Cet ID servira de clé unique dans la base de données.
                </p>
            )}
        </div>

        {/* BASE INFO */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nom du workflow</label>
                <input 
                    type="text" 
                    required 
                    value={name} 
                    onChange={e => setName(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" 
                    placeholder="Ex: Traitement des leads..."
                />
            </div>
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Statut</label>
                <select 
                    value={status} 
                    onChange={e => setStatus(e.target.value as any)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                >
                    <option value="active">Actif</option>
                    <option value="inactive">Inactif</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="error">Erreur</option>
                </select>
            </div>
        </div>

        <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description courte</label>
            <textarea 
                rows={2}
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="Ce workflow permet de..."
            />
        </div>

        <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Outils connectés (séparés par virgule)</label>
            <input 
                type="text" 
                value={toolIconsStr} 
                onChange={e => setToolIconsStr(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" 
                placeholder="Ex: Stripe, Airtable, Gmail"
            />
        </div>

        {/* PIPELINE BUILDER */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <label className="block text-xs font-bold text-indigo-600 uppercase mb-3 flex items-center gap-2">
                <GripVertical size={14} /> Étapes du Pipeline (Visualisation)
            </label>
            
            <div className="space-y-3">
                {pipelineSteps.map((step, idx) => (
                    <div key={idx} className="flex gap-3 items-start">
                        <span className="mt-2 text-xs font-bold text-slate-400 w-4">{idx + 1}.</span>
                        <input 
                            type="text" 
                            placeholder="Outil (ex: Typeform)" 
                            value={step.tool}
                            onChange={e => updateStep(idx, 'tool', e.target.value)}
                            className="flex-1 px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                        <input 
                            type="text" 
                            placeholder="Action (ex: Réception)" 
                            value={step.action}
                            onChange={e => updateStep(idx, 'action', e.target.value)}
                            className="flex-[2] px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                        <button 
                            type="button" 
                            onClick={() => handleRemoveStep(idx)}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                ))}
            </div>
            
            <button 
                type="button" 
                onClick={handleAddStep}
                className="mt-3 text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
            >
                <Plus size={14} /> Ajouter une étape
            </button>
        </div>

        {/* USER GUIDE MARKDOWN */}
        <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-2">
                Documentation (Markdown supporté) <Info size={12} />
            </label>
            <textarea 
                rows={5}
                value={userGuide}
                onChange={e => setUserGuide(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-sm"
                placeholder="# Guide d'utilisation..."
            />
        </div>

        <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
            <button 
                type="button" 
                onClick={onCancel}
                className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg"
            >
                Annuler
            </button>
            <button 
                type="submit" 
                disabled={loading}
                className="px-6 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-md disabled:opacity-50"
            >
                {loading ? 'Enregistrement...' : (initialData ? 'Mettre à jour' : 'Créer l\'automatisation')}
            </button>
        </div>
    </form>
  );
};

export default AutomationForm;
