
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Lead, CRMField, LeadStatus } from '../types';
import { 
    Kanban, Table as TableIcon, Plus, Search, Filter, 
    Settings, MoreHorizontal, GripVertical, Calendar, Type, Hash, List, Trash2,
    DollarSign, User, Building, Phone, Mail, ChevronRight, X, PieChart, Target, Layers,
    Clock, Check, AlertCircle, Send, HelpCircle
} from 'lucide-react';
import { useToast } from './ToastProvider';
import Modal from './ui/Modal';
import Skeleton from './Skeleton';

// --- CONSTANTS ---
const STATUSES: { id: LeadStatus; label: string; color: string }[] = [
    { id: 'new', label: 'Nouveau', color: 'bg-slate-100 border-slate-200 text-slate-600' }, 
    { id: 'contacted', label: 'Contacté', color: 'bg-blue-50 border-blue-100 text-blue-700' },
    { id: 'qualified', label: 'Qualifié', color: 'bg-indigo-50 border-indigo-100 text-indigo-700' },
    { id: 'negotiation', label: 'Négociation', color: 'bg-purple-50 border-purple-100 text-purple-700' },
    { id: 'won', label: 'Gagné', color: 'bg-emerald-50 border-emerald-100 text-emerald-700' },
    { id: 'lost', label: 'Perdu', color: 'bg-red-50 border-red-100 text-red-700' },
];

// Helper pour le Rotting Time
const getRottingData = (dateStr?: string) => {
    if (!dateStr) return { style: 'bg-white border-slate-200', days: 0, isRotting: false };
    
    const diff = new Date().getTime() - new Date(dateStr).getTime();
    const days = Math.floor(diff / (1000 * 3600 * 24));

    if (days > 14) return { style: 'bg-red-50 border-red-200 shadow-red-100', days, isRotting: true, level: 'critical' };
    if (days > 7) return { style: 'bg-amber-50 border-amber-200 shadow-amber-100', days, isRotting: true, level: 'warning' };
    
    return { style: 'bg-white border-slate-200', days, isRotting: false, level: 'normal' };
};

const CRMPage: React.FC = () => {
    const toast = useToast();
    const [leads, setLeads] = useState<Lead[]>([]);
    const [fields, setFields] = useState<CRMField[]>([]);
    const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Modal States
    const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
    const [isFieldModalOpen, setIsFieldModalOpen] = useState(false);
    const [editingLead, setEditingLead] = useState<Lead | null>(null);

    // Form States (Lead)
    const [formData, setFormData] = useState<Partial<Lead>>({ status: 'new', custom_data: {} });
    
    // Form States (Field)
    const [fieldData, setFieldData] = useState<Partial<CRMField>>({ type: 'text', options: [] });
    const [newOption, setNewOption] = useState('');

    // Drag & Drop State
    const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);

    useEffect(() => {
        fetchCRMData();
        
        // Realtime Subscription
        const leadsChannel = supabase.channel('crm_leads_rt')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'crm_leads' }, () => fetchLeadsOnly())
            .subscribe();
            
        const fieldsChannel = supabase.channel('crm_fields_rt')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'crm_fields' }, () => fetchFieldsOnly())
            .subscribe();

        return () => {
            supabase.removeChannel(leadsChannel);
            supabase.removeChannel(fieldsChannel);
        };
    }, []);

    const fetchCRMData = async () => {
        setIsLoading(true);
        await Promise.all([fetchFieldsOnly(), fetchLeadsOnly()]);
        setIsLoading(false);
    };

    const fetchLeadsOnly = async () => {
        // On récupère updated_at pour le rotting time
        const { data } = await supabase.from('crm_leads').select('*').order('created_at', { ascending: false });
        if (data) setLeads(data);
    };

    const fetchFieldsOnly = async () => {
        const { data } = await supabase.from('crm_fields').select('*');
        if (data) setFields(data);
    };

    // --- LOGIQUE LEAD ---

    const handleSaveLead = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload = {
                ...formData,
                updated_at: new Date().toISOString()
            };

            if (editingLead) {
                await supabase.from('crm_leads').update(payload).eq('id', editingLead.id);
                toast.success("Mis à jour", "Lead modifié avec succès.");
            } else {
                await supabase.from('crm_leads').insert({ ...payload, created_at: new Date().toISOString() });
                toast.success("Créé", "Nouveau lead ajouté.");
            }
            setIsLeadModalOpen(false);
            setEditingLead(null);
            fetchLeadsOnly();
        } catch (error) {
            toast.error("Erreur", "Impossible de sauvegarder.");
        }
    };

    const handleDeleteLead = async (id: string) => {
        if (window.confirm("Supprimer ce lead définitivement ?")) {
            await supabase.from('crm_leads').delete().eq('id', id);
            toast.success("Supprimé", "Lead retiré de la base.");
            fetchLeadsOnly();
        }
    };

    // QUICK ACTION : Mark as Won
    const handleQuickWon = async (e: React.MouseEvent, lead: Lead) => {
        e.stopPropagation();
        try {
            await supabase.from('crm_leads').update({ 
                status: 'won', 
                updated_at: new Date().toISOString() 
            }).eq('id', lead.id);
            toast.success("Félicitations ! 🚀", "Affaire gagnée.");
        } catch (err) {
            toast.error("Erreur", "Impossible de mettre à jour.");
        }
    };

    const openLeadModal = (lead?: Lead) => {
        if (lead) {
            setEditingLead(lead);
            setFormData(lead);
        } else {
            setEditingLead(null);
            setFormData({ status: 'new', custom_data: {}, value: 0 });
        }
        setIsLeadModalOpen(true);
    };

    // --- LOGIQUE CHAMPS PERSONNALISÉS ---

    const handleSaveField = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!fieldData.label) return;

        // Générer une clé technique (slug)
        const key = fieldData.label.toLowerCase().replace(/[^a-z0-9]/g, '_');

        try {
            await supabase.from('crm_fields').insert({
                key,
                label: fieldData.label,
                type: fieldData.type,
                options: fieldData.options
            });
            toast.success("Colonne ajoutée", `Le champ "${fieldData.label}" est maintenant disponible.`);
            setIsFieldModalOpen(false);
            setFieldData({ type: 'text', options: [] });
            fetchFieldsOnly();
        } catch (error) {
            toast.error("Erreur", "Impossible d'ajouter la colonne.");
        }
    };

    const handleDeleteField = async (id: string) => {
        if(window.confirm("Supprimer cette colonne ? Les données associées seront conservées mais masquées.")) {
            await supabase.from('crm_fields').delete().eq('id', id);
            fetchFieldsOnly();
        }
    };

    // --- LOGIQUE KANBAN DRAG & DROP ---

    const handleDragStart = (e: React.DragEvent, id: string) => {
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(() => {
            setDraggedLeadId(id);
        }, 0);
    };

    const handleDragEnd = () => {
        setDraggedLeadId(null);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = async (e: React.DragEvent, status: LeadStatus) => {
        e.preventDefault();
        if (!draggedLeadId) return;

        const updatedLeads = leads.map(l => l.id === draggedLeadId ? { ...l, status, updated_at: new Date().toISOString() } : l); // Optimistic UI update including timestamp
        setLeads(updatedLeads);

        try {
            await supabase.from('crm_leads').update({ 
                status,
                updated_at: new Date().toISOString() // Important pour reset le rotting time
            }).eq('id', draggedLeadId);
            toast.success("Statut mis à jour", `Le lead est maintenant "${STATUSES.find(s => s.id === status)?.label}"`);
        } catch (error) {
            toast.error("Erreur", "La synchronisation a échoué.");
            fetchLeadsOnly();
        }
        setDraggedLeadId(null);
    };

    // --- CALCULS KPI & FILTRES ---
    const filteredLeads = leads.filter(l => 
        (l.company?.toLowerCase().includes(searchTerm.toLowerCase()) || 
         l.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
         l.email?.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const activePipelineValue = filteredLeads
        .filter(l => !['won', 'lost'].includes(l.status))
        .reduce((acc, l) => acc + (l.value || 0), 0);

    const wonPipelineValue = filteredLeads
        .filter(l => l.status === 'won')
        .reduce((acc, l) => acc + (l.value || 0), 0);

    // KPI: Taux de conversion
    const totalFinished = filteredLeads.filter(l => ['won', 'lost'].includes(l.status)).length;
    const totalWon = filteredLeads.filter(l => l.status === 'won').length;
    const conversionRate = totalFinished > 0 ? Math.round((totalWon / totalFinished) * 100) : 0;

    // KPI: Total Leads
    const totalLeads = filteredLeads.length;

    if (isLoading) return <div className="p-8"><Skeleton className="h-96 w-full rounded-2xl" /></div>;

    return (
        <div className="h-[calc(100vh-6rem)] flex flex-col animate-fade-in-up pb-4">
            
            {/* KPI BAR */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 shrink-0">
                
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between group relative cursor-help">
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Pipeline Actif</p>
                        <p className="text-2xl font-extrabold text-indigo-600">
                            {activePipelineValue.toLocaleString('fr-FR', {style:'currency', currency:'EUR', maximumFractionDigits:0})}
                        </p>
                    </div>
                    <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg"><Layers size={20} /></div>
                    {/* Tooltip */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 p-2 bg-slate-800 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-50 text-center shadow-xl">
                        Valeur totale des leads en cours de négociation (hors gagnés/perdus).
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between group relative cursor-help">
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Affaires Gagnées</p>
                        <p className="text-2xl font-extrabold text-emerald-600">
                            {wonPipelineValue.toLocaleString('fr-FR', {style:'currency', currency:'EUR', maximumFractionDigits:0})}
                        </p>
                    </div>
                    <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg"><DollarSign size={20} /></div>
                    {/* Tooltip */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 p-2 bg-slate-800 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-50 text-center shadow-xl">
                        Montant total des deals marqués comme "Gagné".
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between group relative cursor-help">
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Taux Conversion</p>
                        <p className="text-2xl font-extrabold text-slate-800">{conversionRate}%</p>
                    </div>
                    <div className="p-2.5 bg-slate-50 text-slate-600 rounded-lg"><PieChart size={20} /></div>
                    {/* Tooltip */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 p-2 bg-slate-800 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-50 text-center shadow-xl">
                        Ratio des affaires gagnées sur le total des affaires clôturées (gagnées + perdues).
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between group relative cursor-help">
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Total Leads</p>
                        <p className="text-2xl font-extrabold text-slate-500">{totalLeads}</p>
                    </div>
                    <div className="p-2.5 bg-slate-50 text-slate-400 rounded-lg"><Target size={20} /></div>
                    {/* Tooltip */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 p-2 bg-slate-800 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-50 text-center shadow-xl">
                        Nombre total de prospects dans la base de données.
                    </div>
                </div>
            </div>

            {/* HEADER TOOLBAR */}
            <div className="flex flex-col md:flex-row justify-between items-end gap-4 mb-4 shrink-0 bg-slate-50 p-2 rounded-xl border border-slate-200">
                <div className="flex items-center gap-3 w-full">
                    {/* View Switcher */}
                    <div className="flex bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
                        <button 
                            onClick={() => setViewMode('kanban')}
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'kanban' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                            title="Vue Kanban"
                        >
                            <Kanban size={18} />
                        </button>
                        <button 
                            onClick={() => setViewMode('table')}
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'table' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                            title="Vue Liste"
                        >
                            <TableIcon size={18} />
                        </button>
                    </div>

                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                            type="text" 
                            placeholder="Rechercher..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
                        />
                    </div>

                    <button 
                        onClick={() => setIsFieldModalOpen(true)}
                        className="p-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 hover:text-indigo-600 transition-colors shadow-sm"
                        title="Gérer les colonnes"
                    >
                        <Settings size={20} />
                    </button>

                    <button 
                        onClick={() => openLeadModal()}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-sm transition-all active:scale-95 text-sm whitespace-nowrap"
                    >
                        <Plus size={18} /> <span className="hidden sm:inline">Nouveau Lead</span>
                    </button>
                </div>
            </div>

            {/* MAIN CONTENT AREA */}
            <div className="flex-1 overflow-hidden min-h-0 pb-4">
                
                {/* --- VUE KANBAN --- */}
                {viewMode === 'kanban' && (
                    <div className="h-full overflow-x-auto overflow-y-hidden flex gap-4 px-1">
                        {STATUSES.map(status => {
                            const columnLeads = filteredLeads.filter(l => l.status === status.id);
                            const columnValue = columnLeads.reduce((acc, l) => acc + (l.value || 0), 0);

                            return (
                                <div 
                                    key={status.id} 
                                    className="flex flex-col min-w-[300px] w-[300px] max-w-[300px] h-full rounded-2xl bg-slate-100/50 border border-slate-200/60"
                                    onDragOver={handleDragOver}
                                    onDrop={(e) => handleDrop(e, status.id)}
                                >
                                    {/* Column Header */}
                                    <div className={`p-3 m-2 mb-0 rounded-xl border ${status.color} bg-opacity-50 flex justify-between items-center shadow-sm bg-white`}>
                                        <span className="font-bold text-sm uppercase tracking-wide truncate">{status.label}</span>
                                        <span className="text-xs font-bold px-2 py-0.5 bg-slate-100 rounded-full text-slate-600 border border-slate-200">{columnLeads.length}</span>
                                    </div>
                                    <div className="px-4 pb-2 text-[10px] font-medium text-slate-400 text-right">
                                        {columnValue > 0 ? columnValue.toLocaleString('fr-FR', {style:'currency', currency:'EUR', maximumFractionDigits:0}) : '-'}
                                    </div>

                                    {/* Column Body */}
                                    <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                                        {columnLeads.map(lead => {
                                            // Calcul du Rotting Time
                                            const rotting = getRottingData(lead.updated_at || lead.created_at);
                                            const isDragging = draggedLeadId === lead.id;

                                            return (
                                                <div 
                                                    key={lead.id}
                                                    id={`lead-card-${lead.id}`}
                                                    draggable
                                                    onDragStart={(e) => handleDragStart(e, lead.id)}
                                                    onDragEnd={handleDragEnd}
                                                    onClick={() => openLeadModal(lead)}
                                                    className={`
                                                        p-3 rounded-xl border shadow-sm hover:shadow-md cursor-grab active:cursor-grabbing transition-all group relative overflow-hidden
                                                        ${rotting.style}
                                                        ${rotting.isRotting ? 'border-l-4' : ''}
                                                        ${isDragging ? 'opacity-0' : 'opacity-100'}
                                                    `}
                                                >
                                                    {/* QUICK ACTIONS OVERLAY (Survol) */}
                                                    <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 duration-200">
                                                        {lead.phone && (
                                                            <a href={`tel:${lead.phone}`} onClick={(e) => e.stopPropagation()} className="p-2.5 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100 hover:scale-110 transition-all shadow-sm" title="Appeler">
                                                                <Phone size={18} />
                                                            </a>
                                                        )}
                                                        {/* Suppression Bouton Mail ici comme demandé */}
                                                        {lead.status !== 'won' && (
                                                            <button 
                                                                onClick={(e) => handleQuickWon(e, lead)} 
                                                                className="p-2.5 bg-emerald-50 text-emerald-600 rounded-full hover:bg-emerald-100 hover:scale-110 transition-all shadow-sm"
                                                                title="Marquer comme Gagné"
                                                            >
                                                                <Check size={18} />
                                                            </button>
                                                        )}
                                                    </div>

                                                    <div className="flex justify-between items-start mb-2 relative z-10">
                                                        <span className="font-bold text-slate-800 text-sm line-clamp-1 group-hover:text-indigo-600 transition-colors">
                                                            {lead.company || `${lead.first_name} ${lead.last_name}`}
                                                        </span>
                                                        
                                                        {/* ROTTING ALERT */}
                                                        {rotting.isRotting && (
                                                            <div className="absolute top-0 right-0 -mr-1 -mt-1" title={`${rotting.days} jours sans activité`}>
                                                                <AlertCircle size={14} className={rotting.level === 'critical' ? 'text-red-500' : 'text-amber-500'} />
                                                            </div>
                                                        )}

                                                        {/* VALEUR */}
                                                        {lead.value > 0 && !rotting.isRotting && (
                                                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full shrink-0 ml-1 border border-emerald-100">
                                                                {lead.value.toLocaleString('fr-FR', {style:'currency', currency:'EUR', maximumFractionDigits:0})}
                                                            </span>
                                                        )}
                                                    </div>
                                                    
                                                    <div className="space-y-0.5 relative z-10">
                                                        {lead.company && (lead.first_name || lead.last_name) && (
                                                            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                                                                <User size={10} /> {lead.first_name} {lead.last_name}
                                                            </div>
                                                        )}
                                                        {lead.email && (
                                                            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 truncate">
                                                                <Mail size={10} /> {lead.email}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Affichage d'un tag custom si présent */}
                                                    {Object.keys(lead.custom_data).length > 0 && (
                                                        <div className="mt-2 pt-2 border-t border-slate-50 flex flex-wrap gap-1 relative z-10">
                                                            {Object.entries(lead.custom_data).slice(0,2).map(([key, val]) => (
                                                                <span key={key} className="text-[9px] bg-slate-50 text-slate-500 px-1.5 py-0.5 rounded border border-slate-100 truncate max-w-[100px]">
                                                                    {String(val)}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {/* Rotting Footer Text */}
                                                    {rotting.isRotting && (
                                                        <div className={`mt-2 text-[9px] font-bold uppercase tracking-wide flex items-center gap-1 ${rotting.level === 'critical' ? 'text-red-500' : 'text-amber-600'}`}>
                                                            <Clock size={10} /> {rotting.days}j sans action
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* --- VUE TABLE (COMPACTE & PRO) --- */}
                {viewMode === 'table' && (
                    <div className="h-full bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
                        <div className="flex-1 overflow-auto custom-scrollbar">
                            <table className="w-full text-left border-collapse min-w-[1000px]">
                                <thead className="bg-slate-50/80 border-b border-slate-200 sticky top-0 z-10 backdrop-blur-sm">
                                    <tr>
                                        <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-64">Nom / Société</th>
                                        <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-32">Statut</th>
                                        <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Valeur</th>
                                        <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Email</th>
                                        <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Téléphone</th>
                                        {fields.map(field => (
                                            <th key={field.id} className="px-6 py-3 text-[10px] font-bold text-indigo-600 uppercase tracking-wider bg-indigo-50/30 border-l border-indigo-100">
                                                {field.label}
                                            </th>
                                        ))}
                                        <th className="px-6 py-3 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredLeads.map(lead => (
                                        <tr key={lead.id} className="hover:bg-slate-50/80 transition-colors group cursor-pointer" onClick={() => openLeadModal(lead)}>
                                            <td className="px-6 py-2">
                                                <div className="font-bold text-slate-800 text-sm truncate max-w-[200px]">{lead.company || 'Particulier'}</div>
                                                <div className="text-[11px] text-slate-500 truncate">{lead.first_name} {lead.last_name}</div>
                                            </td>
                                            <td className="px-6 py-2">
                                                {(() => {
                                                    const s = STATUSES.find(st => st.id === lead.status);
                                                    return (
                                                        <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border whitespace-nowrap ${s?.color || 'bg-gray-100 text-gray-500'}`}>
                                                            {s?.label || lead.status}
                                                        </span>
                                                    )
                                                })()}
                                            </td>
                                            <td className="px-6 py-2 text-right font-mono text-sm text-slate-700 font-medium">
                                                {lead.value > 0 ? lead.value.toLocaleString('fr-FR', {style:'currency', currency:'EUR', maximumFractionDigits: 0}) : <span className="text-slate-300">-</span>}
                                            </td>
                                            <td className="px-6 py-2 text-xs text-slate-600 truncate max-w-[150px]">{lead.email || <span className="text-slate-300">-</span>}</td>
                                            <td className="px-6 py-2 text-xs text-slate-600 font-mono">{lead.phone || <span className="text-slate-300">-</span>}</td>
                                            
                                            {fields.map(field => (
                                                <td key={field.id} className="px-6 py-2 text-xs text-slate-600 border-l border-slate-50">
                                                    {lead.custom_data[field.key] ? String(lead.custom_data[field.key]) : <span className="text-slate-300">-</span>}
                                                </td>
                                            ))}

                                            <td className="px-6 py-2 text-right">
                                                <button onClick={(e) => { e.stopPropagation(); handleDeleteLead(lead.id); }} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors">
                                                    <Trash2 size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* ... MODALS ... */}
            {/* Le reste du code des modals est inchangé */}
            <Modal isOpen={isLeadModalOpen} onClose={() => setIsLeadModalOpen(false)} title={editingLead ? "Modifier le Lead" : "Nouveau Lead"} maxWidth="max-w-4xl">
                <form onSubmit={handleSaveLead} className="space-y-8">
                    {/* ... Contenu du formulaire ... */}
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">Identité</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Prénom</label>
                                    <input type="text" value={formData.first_name || ''} onChange={e => setFormData({...formData, first_name: e.target.value})} className="w-full p-2.5 border rounded-lg text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Nom</label>
                                    <input type="text" value={formData.last_name || ''} onChange={e => setFormData({...formData, last_name: e.target.value})} className="w-full p-2.5 border rounded-lg text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Entreprise</label>
                                <div className="relative"><Building size={14} className="absolute left-3 top-3 text-slate-400" /><input type="text" value={formData.company || ''} onChange={e => setFormData({...formData, company: e.target.value})} className="w-full pl-9 p-2.5 border rounded-lg text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Nom de la société" /></div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">Coordonnées</h4>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Email</label>
                                <div className="relative"><Mail size={14} className="absolute left-3 top-3 text-slate-400" /><input type="email" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full pl-9 p-2.5 border rounded-lg text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none" /></div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Téléphone</label>
                                <div className="relative"><Phone size={14} className="absolute left-3 top-3 text-slate-400" /><input type="text" value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full pl-9 p-2.5 border rounded-lg text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none" /></div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">Détails du Deal</h4>
                        <div className="grid grid-cols-3 gap-6">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Statut</label>
                                <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as LeadStatus})} className="w-full p-2.5 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none">
                                    {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Valeur Estimée (€)</label>
                                <div className="relative"><DollarSign size={14} className="absolute left-3 top-3 text-slate-400" /><input type="number" value={formData.value || 0} onChange={e => setFormData({...formData, value: parseFloat(e.target.value)})} className="w-full pl-9 p-2.5 border rounded-lg text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-800" /></div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Source</label>
                                <input type="text" value={formData.source || ''} onChange={e => setFormData({...formData, source: e.target.value})} placeholder="LinkedIn, Site, etc." className="w-full p-2.5 border rounded-lg text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none" />
                            </div>
                        </div>
                    </div>

                    {fields.length > 0 && (
                        <div className="space-y-4 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
                            <h4 className="text-sm font-bold text-indigo-700 uppercase tracking-wider flex items-center gap-2">
                                <List size={14} /> Champs Personnalisés
                            </h4>
                            <div className="grid grid-cols-2 gap-4">
                                {fields.map(field => (
                                    <div key={field.id}>
                                        <label className="block text-xs font-bold text-indigo-600 mb-1">{field.label}</label>
                                        
                                        {field.type === 'select' ? (
                                            <select
                                                value={formData.custom_data?.[field.key] || ''}
                                                onChange={(e) => setFormData({ ...formData, custom_data: { ...formData.custom_data, [field.key]: e.target.value } })}
                                                className="w-full p-2.5 border border-indigo-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                            >
                                                <option value="">Sélectionner...</option>
                                                {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                            </select>
                                        ) : field.type === 'date' ? (
                                            <input
                                                type="date"
                                                value={formData.custom_data?.[field.key] || ''}
                                                onChange={(e) => setFormData({ ...formData, custom_data: { ...formData.custom_data, [field.key]: e.target.value } })}
                                                className="w-full p-2.5 border border-indigo-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                            />
                                        ) : (
                                            <input
                                                type={field.type === 'number' ? 'number' : 'text'}
                                                value={formData.custom_data?.[field.key] || ''}
                                                onChange={(e) => setFormData({ ...formData, custom_data: { ...formData.custom_data, [field.key]: e.target.value } })}
                                                className="w-full p-2.5 border border-indigo-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                                placeholder={`Valeur pour ${field.label}`}
                                            />
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Notes internes</label>
                        <textarea rows={3} value={formData.notes || ''} onChange={e => setFormData({...formData, notes: e.target.value})} className="w-full p-3 border rounded-lg text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Détails importants..."></textarea>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                        <button type="button" onClick={() => setIsLeadModalOpen(false)} className="px-5 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50">Annuler</button>
                        <button type="submit" className="px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md">{editingLead ? 'Sauvegarder' : 'Créer le lead'}</button>
                    </div>
                </form>
            </Modal>

            <Modal isOpen={isFieldModalOpen} onClose={() => setIsFieldModalOpen(false)} title="Configurer les colonnes" maxWidth="max-w-2xl">
                {/* ... Contenu gestion champs ... */}
                <div className="space-y-8">
                    <div className="space-y-3">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Colonnes Actives</h4>
                        {fields.length === 0 ? (
                            <p className="text-sm text-slate-400 italic">Aucune colonne personnalisée.</p>
                        ) : (
                            fields.map(f => (
                                <div key={f.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-200">
                                    <div className="flex items-center gap-3">
                                        <div className="p-1.5 bg-white border rounded text-slate-500">
                                            {f.type === 'text' && <Type size={14} />}
                                            {f.type === 'number' && <Hash size={14} />}
                                            {f.type === 'date' && <Calendar size={14} />}
                                            {f.type === 'select' && <List size={14} />}
                                        </div>
                                        <span className="font-bold text-slate-700 text-sm">{f.label}</span>
                                        <span className="text-xs text-slate-400 bg-white px-2 py-0.5 rounded border">ID: {f.key}</span>
                                    </div>
                                    <button onClick={() => handleDeleteField(f.id)} className="text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="bg-indigo-50/50 p-5 rounded-xl border border-indigo-100">
                        <h4 className="text-sm font-bold text-indigo-800 mb-4 flex items-center gap-2"><Plus size={16} /> Ajouter une colonne</h4>
                        <form onSubmit={handleSaveField} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-indigo-600 mb-1">Nom de la colonne</label>
                                    <input type="text" required value={fieldData.label || ''} onChange={e => setFieldData({...fieldData, label: e.target.value})} className="w-full p-2 border border-indigo-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Ex: Date de naissance" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-indigo-600 mb-1">Type de donnée</label>
                                    <select value={fieldData.type} onChange={e => setFieldData({...fieldData, type: e.target.value as any})} className="w-full p-2 border border-indigo-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                        <option value="text">Texte</option>
                                        <option value="number">Nombre / Montant</option>
                                        <option value="date">Date</option>
                                        <option value="select">Liste déroulante</option>
                                    </select>
                                </div>
                            </div>

                            {fieldData.type === 'select' && (
                                <div>
                                    <label className="block text-xs font-bold text-indigo-600 mb-1">Options de la liste</label>
                                    <div className="flex gap-2 mb-2">
                                        <input type="text" value={newOption} onChange={e => setNewOption(e.target.value)} className="flex-1 p-2 border border-indigo-200 rounded-lg text-sm" placeholder="Nouvelle option..." />
                                        <button type="button" onClick={() => { if(newOption) { setFieldData(prev => ({...prev, options: [...(prev.options || []), newOption]})); setNewOption(''); } }} className="px-3 bg-indigo-600 text-white rounded-lg text-xs font-bold">Ajouter</button>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {fieldData.options?.map((opt, idx) => (
                                            <span key={idx} className="bg-white border border-indigo-200 text-indigo-600 px-2 py-1 rounded text-xs flex items-center gap-1">
                                                {opt}
                                                <button type="button" onClick={() => setFieldData(prev => ({...prev, options: prev.options?.filter((_, i) => i !== idx)}))} className="hover:text-red-500"><X size={10} /></button>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-end pt-2">
                                <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors shadow-sm">Créer la colonne</button>
                            </div>
                        </form>
                    </div>
                </div>
            </Modal>

        </div>
    );
};

export default CRMPage;
