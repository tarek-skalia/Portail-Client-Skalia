
import React, { useEffect, useState } from 'react';
import { Expense } from '../types';
import { supabase } from '../lib/supabase';
import { useAdmin } from './AdminContext';
import { CreditCard, Search, Plus, Edit3, Trash2, AlertTriangle, RefreshCw, BarChart4, CheckCircle2, TrendingDown, Users } from 'lucide-react';
import Skeleton from './Skeleton';
import ExpenseSlideOver from './ExpenseSlideOver';
import Modal from './ui/Modal';
import ExpenseForm from './forms/ExpenseForm';
import { useToast } from './ToastProvider';
import ExpenseLogo from './ExpenseLogo';

// Extension pour l'UI d'audit
interface ExpenseWithAudit extends Expense {
    monthlyCost: number; // Coût normalisé
}

const GlobalExpenses: React.FC = () => {
  const { clients } = useAdmin();
  const toast = useToast();
  const [expenses, setExpenses] = useState<ExpenseWithAudit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // CLIENT FILTER
  const [selectedClientId, setSelectedClientId] = useState<string>('all');

  // UI State
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [isSlideOverOpen, setIsSlideOverOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  
  // Delete
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchGlobalExpenses();
    
    const channel = supabase.channel('global_expenses_realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, () => fetchGlobalExpenses())
        .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchGlobalExpenses = async () => {
    try {
        const { data, error } = await supabase
            .from('expenses')
            .select('*')
            .order('amount', { ascending: false }); // Tri par montant pour mettre en avant les gros coûts

        if (error) throw error;

        const mapped: ExpenseWithAudit[] = (data || []).map((item: any) => {
            // Normalisation du coût mensuel avec cast explicite pour éviter les erreurs TS
            const amount = Number(item.amount || 0);
            const monthly = item.billing_cycle === 'yearly' ? amount / 12 : amount;
            
            return {
                id: item.id,
                clientId: item.user_id,
                serviceName: item.service_name,
                provider: item.provider || 'Autre',
                category: item.category || 'Software',
                amount: amount,
                billingCycle: item.billing_cycle,
                nextBillingDate: item.next_billing_date,
                status: item.status,
                description: item.description,
                websiteUrl: item.website_url,
                logoUrl: item.logo_url,
                monthlyCost: monthly
            };
        });

        setExpenses(mapped);
    } catch (e) {
        console.error("Global expenses error:", e);
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
          await supabase.from('expenses').delete().eq('id', deleteId);
          toast.success("Supprimé", "La dépense a été retirée.");
          fetchGlobalExpenses();
      } catch (err) {
          toast.error("Erreur", "Impossible de supprimer.");
      } finally {
          setIsDeleting(false);
          setDeleteId(null);
      }
  };

  // --- FILTRAGE ---
  const filteredExpenses = expenses.filter(exp => {
      const matchesClient = selectedClientId === 'all' || exp.clientId === selectedClientId;
      const matchesSearch = exp.serviceName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            getClientName(exp.clientId).toLowerCase().includes(searchTerm.toLowerCase());
      return matchesClient && matchesSearch;
  });

  // --- KPI & AUDIT CALCULATIONS (Basés sur les données filtrées) ---
  const activeExpenses = filteredExpenses.filter(e => e.status === 'active');
  const totalMonthlyCost = activeExpenses.reduce<number>((acc, exp) => acc + exp.monthlyCost, 0);
  const totalYearlyCost = totalMonthlyCost * 12;
  
  // Répartition par Catégorie
  const categoryStats = activeExpenses.reduce<Record<string, number>>((acc, curr) => {
      const cat = curr.category || 'Autre';
      const currentVal = acc[cat] || 0;
      acc[cat] = currentVal + curr.monthlyCost;
      return acc;
  }, {});

  const categoryDistribution = Object.entries(categoryStats)
      .map(([name, value]) => ({ 
          name, 
          value: Number(value), 
          percent: totalMonthlyCost > 0 ? (Number(value) / totalMonthlyCost) * 100 : 0 
      }))
      .sort((a, b) => b.value - a.value);

  const COLORS = ['bg-indigo-500', 'bg-purple-500', 'bg-pink-500', 'bg-amber-500', 'bg-emerald-500', 'bg-blue-500', 'bg-slate-400'];

  if (isLoading) return <div className="p-8"><Skeleton className="h-96 w-full rounded-2xl" /></div>;

  return (
    <>
    <div className="space-y-6 animate-fade-in-up pb-10">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-end gap-4">
            <div>
                <h1 className="text-3xl font-extrabold text-slate-900">Audit des Coûts</h1>
                <p className="text-slate-500 mt-1">Analyse de la répartition budgétaire de l'infrastructure.</p>
            </div>
            
            {/* CLIENT FILTER */}
            <div className="relative group">
                <select 
                    value={selectedClientId}
                    onChange={(e) => setSelectedClientId(e.target.value)}
                    className="appearance-none bg-white border border-slate-200 text-slate-700 font-bold py-2.5 pl-10 pr-10 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer hover:border-indigo-300 transition-colors"
                >
                    <option value="all">Tous les clients</option>
                    {clients.filter(c => c.role !== 'admin').map(client => (
                        <option key={client.id} value={client.id}>{client.company}</option>
                    ))}
                </select>
                <Users size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none border-l border-slate-200 pl-2">
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                </div>
            </div>
        </div>

        {/* --- AUDIT VISUEL : STACKED BAR --- */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative group cursor-help">
            <div className="flex justify-between items-end mb-4">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2">
                    <BarChart4 size={16} className="text-indigo-600" /> Répartition du budget mensuel
                </h3>
                <div className="text-right">
                    <span className="text-2xl font-extrabold text-slate-900">{Math.round(totalMonthlyCost).toLocaleString('fr-FR')} €</span>
                    <span className="text-xs text-slate-400 font-bold ml-1">/ mois</span>
                </div>
            </div>

            {/* La Barre Empilée */}
            <div className="h-4 w-full rounded-full bg-slate-100 overflow-hidden flex mb-4">
                {categoryDistribution.map((cat, index) => (
                    <div 
                        key={cat.name}
                        className={`h-full ${COLORS[index % COLORS.length]} hover:opacity-90 transition-all cursor-help relative group/bar`}
                        style={{ width: `${cat.percent}%` }}
                    >
                        {/* Tooltip au survol */}
                        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover/bar:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                            {cat.name}: {Math.round(Number(cat.value))}€ ({Math.round(Number(cat.percent))}%)
                        </div>
                    </div>
                ))}
            </div>

            {/* Légende */}
            <div className="flex flex-wrap gap-4">
                {categoryDistribution.map((cat, index) => (
                    <div key={cat.name} className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${COLORS[index % COLORS.length]}`}></div>
                        <span className="text-xs font-medium text-slate-600">
                            {cat.name} <span className="text-slate-400">({Math.round(Number(cat.percent))}%)</span>
                        </span>
                    </div>
                ))}
            </div>

            {/* Tooltip Global */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 p-2 bg-slate-800 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-50 text-center shadow-xl">
                Coût mensuel récurrent total estimé basé sur les abonnements actifs.
            </div>
        </div>

        {/* --- KPI SECONDAIRES --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4 group relative cursor-help">
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg"><CheckCircle2 size={24} /></div>
                <div>
                    <p className="text-xs font-bold text-slate-400 uppercase">Actifs</p>
                    <p className="text-xl font-bold text-slate-900">{activeExpenses.length} outils</p>
                </div>
                {/* Tooltip */}
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 p-2 bg-slate-800 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-50 text-center shadow-xl">
                    Nombre total d'abonnements actuellement actifs pour la sélection.
                </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4 group relative cursor-help">
                <div className="p-3 bg-slate-100 text-slate-500 rounded-lg"><TrendingDown size={24} /></div>
                <div>
                    <p className="text-xs font-bold text-slate-400 uppercase">Projection Annuelle</p>
                    <p className="text-xl font-bold text-slate-900">{Math.round(totalYearlyCost).toLocaleString()} €</p>
                </div>
                {/* Tooltip */}
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 p-2 bg-slate-800 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-50 text-center shadow-xl">
                    Estimation du coût total sur 12 mois si les abonnements actuels sont maintenus.
                </div>
            </div>
        </div>

        {/* TOOLBAR SEARCH */}
        <div className="flex justify-between gap-4 items-center">
            <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                    type="text" 
                    placeholder="Filtrer les dépenses (Nom, Client, Catégorie)..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm"
                />
            </div>
            <button 
                onClick={() => { setEditingExpense(null); setIsModalOpen(true); }}
                className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all active:scale-95 text-sm"
            >
                <Plus size={16} /> Ajouter
            </button>
        </div>

        {/* LISTE DES DÉPENSES (CARTE AUDIT) */}
        <div className="grid grid-cols-1 gap-3">
            {filteredExpenses.length === 0 ? (
                <div className="p-12 text-center text-slate-400 italic bg-white rounded-2xl border border-dashed border-slate-200">Aucune dépense trouvée.</div>
            ) : (
                filteredExpenses.map(exp => (
                    <div 
                        key={exp.id}
                        onClick={() => { setSelectedExpense(exp); setIsSlideOverOpen(true); }}
                        className="group bg-white rounded-xl border border-slate-200 p-4 hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer flex flex-col md:flex-row items-center gap-4 relative overflow-hidden"
                    >
                        {/* Logo & Nom */}
                        <div className="flex items-center gap-4 flex-1 min-w-0 w-full">
                            <ExpenseLogo 
                                provider={exp.provider} 
                                logoUrl={exp.logoUrl} 
                                websiteUrl={exp.websiteUrl} 
                                className="w-12 h-12 rounded-lg shrink-0"
                            />
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <h4 className="font-bold text-slate-800 text-base truncate">{exp.serviceName}</h4>
                                    {exp.status === 'inactive' && (
                                        <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded border border-slate-200">Inactif</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                    <span className="font-medium text-slate-700 bg-slate-100 px-1.5 rounded">{exp.category}</span>
                                    <span>•</span>
                                    <span>{getClientName(exp.clientId)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Coût & Cycle */}
                        <div className="flex items-center justify-between w-full md:w-auto gap-8 pl-16 md:pl-0">
                            <div className="text-right">
                                <p className="text-lg font-bold text-slate-900 font-mono">
                                    {exp.monthlyCost.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                                    <span className="text-[10px] text-slate-400 font-sans font-medium ml-1">/mois</span>
                                </p>
                                <div className="flex items-center justify-end gap-1 text-[10px] text-slate-400 uppercase font-bold tracking-wide">
                                    <RefreshCw size={10} /> {exp.billingCycle === 'monthly' ? 'Mensuel' : 'Annuel'}
                                </div>
                            </div>

                            {/* Actions (Visible au survol) */}
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                    onClick={(e) => { e.stopPropagation(); setEditingExpense(exp); setIsModalOpen(true); }}
                                    className="p-2 bg-white border border-slate-200 text-indigo-600 rounded-lg hover:bg-indigo-50 shadow-sm"
                                >
                                    <Edit3 size={16} />
                                </button>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); setDeleteId(exp.id); }}
                                    className="p-2 bg-white border border-slate-200 text-red-600 rounded-lg hover:bg-red-50 shadow-sm"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    </div>
                ))
            )}
        </div>
    </div>

    <ExpenseSlideOver 
        isOpen={isSlideOverOpen}
        onClose={() => setIsSlideOverOpen(false)}
        expense={selectedExpense}
    />

    <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingExpense ? "Modifier Dépense" : "Ajouter Dépense"}>
        <ExpenseForm 
            initialData={editingExpense} 
            onSuccess={() => { setIsModalOpen(false); fetchGlobalExpenses(); }} 
            onCancel={() => setIsModalOpen(false)} 
        />
    </Modal>

    <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Supprimer ?" maxWidth="max-w-md">
        <div className="text-center p-4">
            <AlertTriangle size={32} className="text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-900 mb-2">Confirmer la suppression</h3>
            <p className="text-slate-500 text-sm mb-6">Cela retirera cette dépense du calcul des coûts globaux.</p>
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

export default GlobalExpenses;
