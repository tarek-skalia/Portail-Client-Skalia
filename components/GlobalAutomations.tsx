
import React, { useEffect, useState } from 'react';
import { Automation } from '../types';
import { supabase } from '../lib/supabase';
import { useAdmin } from './AdminContext';
import { Zap, Activity, AlertTriangle, CheckCircle2, PauseCircle, XCircle, Search, Plus, Edit3, Trash2 } from 'lucide-react';
import Skeleton from './Skeleton';
import AutomationSlideOver from './AutomationSlideOver';
import Modal from './ui/Modal';
import AutomationForm from './forms/AutomationForm';
import { useToast } from './ToastProvider';

const GlobalAutomations: React.FC = () => {
  const { clients } = useAdmin();
  const toast = useToast();
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // UI State
  const [selectedAutomation, setSelectedAutomation] = useState<Automation | null>(null);
  const [isSlideOverOpen, setIsSlideOverOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState<Automation | null>(null);
  
  // Delete
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchGlobalAutomations();
    
    const channel = supabase.channel('global_automations_realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'automations' }, () => fetchGlobalAutomations())
        .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchGlobalAutomations = async () => {
    try {
        const { data, error } = await supabase
            .from('automations')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Fetch logs for "Last Run" (Optional - simple version here)
        // Note: For a global view with potentially many items, calculating "last run" for everyone might be heavy.
        // We can skip it or do a smart fetch. For now, let's keep it simple.

        const mapped: Automation[] = (data || []).map((item: any) => ({
            id: item.id,
            clientId: item.user_id,
            name: item.name,
            description: item.description || '',
            status: item.status,
            lastRun: 'Voir détails', // Placeholder
            runsThisMonth: 0, // Placeholder
            toolIcons: item.tool_icons || [],
            pipelineSteps: item.pipeline_steps || [],
            userGuide: item.user_guide || ''
        }));

        setAutomations(mapped);
    } catch (e) {
        console.error("Global automations error:", e);
    } finally {
        setIsLoading(false);
    }
  };

  const getClientName = (clientId: string) => {
      const client = clients.find(c => c.id === clientId);
      return client ? client.company : 'Client Inconnu';
  };

  const executeDelete = async () => {
      if (!deleteId) return;
      setIsDeleting(true);
      try {
          await supabase.from('automation_logs').delete().eq('automation_id', deleteId);
          await supabase.from('automations').delete().eq('id', deleteId);
          toast.success("Supprimé", "L'automatisation a été retirée.");
          fetchGlobalAutomations();
      } catch (err) {
          toast.error("Erreur", "Impossible de supprimer.");
      } finally {
          setIsDeleting(false);
          setDeleteId(null);
      }
  };

  const filteredAutomations = automations.filter(auto => 
      auto.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      getClientName(auto.clientId).toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusIcon = (status: string) => {
      switch(status) {
          case 'active': return <CheckCircle2 size={16} className="text-emerald-500" />;
          case 'error': return <XCircle size={16} className="text-red-500" />;
          case 'maintenance': return <AlertTriangle size={16} className="text-amber-500" />;
          default: return <PauseCircle size={16} className="text-slate-400" />;
      }
  };

  if (isLoading) return <div className="p-8"><Skeleton className="h-96 w-full rounded-2xl" /></div>;

  return (
    <>
    <div className="space-y-6 animate-fade-in-up pb-10">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-end gap-4">
            <div>
                <h1 className="text-3xl font-extrabold text-slate-900">Systèmes & Automatisations</h1>
                <p className="text-slate-500 mt-1">Gérez l'infrastructure d'automatisation de tous vos clients.</p>
            </div>
            
            <div className="flex gap-3">
                <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                        type="text" 
                        placeholder="Rechercher..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                </div>
                <button 
                    onClick={() => { setEditingAutomation(null); setIsModalOpen(true); }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-indigo-200 transition-all active:scale-95"
                >
                    <Plus size={18} /> Ajouter
                </button>
            </div>
        </div>

        {/* TABLE */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-slate-50/50 border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider">
                <div className="col-span-1">Statut</div>
                <div className="col-span-3">Nom du flux</div>
                <div className="col-span-3">Client</div>
                <div className="col-span-3">Description</div>
                <div className="col-span-2 text-right">Actions</div>
            </div>

            <div className="divide-y divide-slate-100">
                {filteredAutomations.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 italic">Aucune automatisation trouvée.</div>
                ) : (
                    filteredAutomations.map(auto => (
                        <div 
                            key={auto.id}
                            onClick={() => { setSelectedAutomation(auto); setIsSlideOverOpen(true); }}
                            className="grid grid-cols-12 gap-4 px-6 py-4 hover:bg-slate-50/50 transition-colors cursor-pointer items-center group"
                        >
                            <div className="col-span-1 flex items-center">
                                {getStatusIcon(auto.status)}
                            </div>
                            <div className="col-span-3 font-bold text-slate-800 truncate">
                                {auto.name}
                            </div>
                            <div className="col-span-3 text-sm font-medium text-slate-600">
                                {getClientName(auto.clientId)}
                            </div>
                            <div className="col-span-3 text-xs text-slate-500 truncate">
                                {auto.description}
                            </div>
                            <div className="col-span-2 flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                    onClick={(e) => { e.stopPropagation(); setEditingAutomation(auto); setIsModalOpen(true); }}
                                    className="p-1.5 bg-white border border-slate-200 text-indigo-600 rounded-lg hover:bg-indigo-50"
                                >
                                    <Edit3 size={14} />
                                </button>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); setDeleteId(auto.id); }}
                                    className="p-1.5 bg-white border border-slate-200 text-red-600 rounded-lg hover:bg-red-50"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    </div>

    <AutomationSlideOver 
        isOpen={isSlideOverOpen}
        onClose={() => setIsSlideOverOpen(false)}
        automation={selectedAutomation}
    />

    <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingAutomation ? "Modifier Automatisation" : "Nouvelle Automatisation"}>
        <AutomationForm 
            initialData={editingAutomation} 
            onSuccess={() => { setIsModalOpen(false); fetchGlobalAutomations(); }} 
            onCancel={() => setIsModalOpen(false)} 
        />
    </Modal>

    <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Supprimer ?" maxWidth="max-w-md">
        <div className="text-center p-4">
            <AlertTriangle size={32} className="text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-900 mb-2">Confirmer la suppression</h3>
            <p className="text-slate-500 text-sm mb-6">L'historique des logs sera également supprimé.</p>
            <div className="flex gap-3 justify-center">
                <button onClick={() => setDeleteId(null)} className="px-4 py-2 border rounded-xl">Annuler</button>
                <button onClick={executeDelete} disabled={isDeleting} className="px-4 py-2 bg-red-600 text-white rounded-xl">
                    {isDeleting ? '...' : 'Supprimer'}
                </button>
            </div>
        </div>
    </Modal>
    </>
  );
};

export default GlobalAutomations;
