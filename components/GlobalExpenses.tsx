
import React, { useEffect, useState } from 'react';
import { Expense } from '../types';
import { supabase } from '../lib/supabase';
import { useAdmin } from './AdminContext';
import { CreditCard, Search, Plus, Edit3, Trash2, AlertTriangle, RefreshCw } from 'lucide-react';
import Skeleton from './Skeleton';
import ExpenseSlideOver from './ExpenseSlideOver';
import Modal from './ui/Modal';
import ExpenseForm from './forms/ExpenseForm';
import { useToast } from './ToastProvider';
import ExpenseLogo from './ExpenseLogo';

const GlobalExpenses: React.FC = () => {
  const { clients } = useAdmin();
  const toast = useToast();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
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
            .order('created_at', { ascending: false });

        if (error) throw error;

        const mapped: Expense[] = (data || []).map((item: any) => ({
            id: item.id,
            clientId: item.user_id,
            serviceName: item.service_name,
            provider: item.provider || 'Autre',
            category: item.category || 'Software',
            amount: item.amount,
            billingCycle: item.billing_cycle,
            nextBillingDate: item.next_billing_date,
            status: item.status,
            description: item.description,
            websiteUrl: item.website_url,
            logoUrl: item.logo_url
        }));

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

  const filteredExpenses = expenses.filter(exp => 
      exp.serviceName.toLowerCase().includes(searchTerm.toLowerCase()) || 
      getClientName(exp.clientId).toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) return <div className="p-8"><Skeleton className="h-96 w-full rounded-2xl" /></div>;

  return (
    <>
    <div className="space-y-6 animate-fade-in-up pb-10">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-end gap-4">
            <div>
                <h1 className="text-3xl font-extrabold text-slate-900">Dépenses & Abonnements</h1>
                <p className="text-slate-500 mt-1">Vue consolidée de tous les abonnements gérés pour les clients.</p>
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
                    onClick={() => { setEditingExpense(null); setIsModalOpen(true); }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-indigo-200 transition-all active:scale-95"
                >
                    <Plus size={18} /> Ajouter
                </button>
            </div>
        </div>

        {/* TABLE */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-slate-50/50 border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider">
                <div className="col-span-3">Service</div>
                <div className="col-span-3">Client</div>
                <div className="col-span-2">Montant</div>
                <div className="col-span-2">Cycle</div>
                <div className="col-span-2 text-right">Actions</div>
            </div>

            <div className="divide-y divide-slate-100">
                {filteredExpenses.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 italic">Aucune dépense trouvée.</div>
                ) : (
                    filteredExpenses.map(exp => (
                        <div 
                            key={exp.id}
                            onClick={() => { setSelectedExpense(exp); setIsSlideOverOpen(true); }}
                            className="grid grid-cols-12 gap-4 px-6 py-4 hover:bg-slate-50/50 transition-colors cursor-pointer items-center group"
                        >
                            <div className="col-span-3 flex items-center gap-3">
                                <ExpenseLogo 
                                    provider={exp.provider} 
                                    logoUrl={exp.logoUrl} 
                                    websiteUrl={exp.websiteUrl} 
                                    className="w-8 h-8 rounded-lg"
                                />
                                <span className="font-bold text-slate-800 truncate">{exp.serviceName}</span>
                            </div>
                            <div className="col-span-3 text-sm font-medium text-slate-600">
                                {getClientName(exp.clientId)}
                            </div>
                            <div className="col-span-2 font-mono font-bold text-slate-900">
                                {exp.amount.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                            </div>
                            <div className="col-span-2 text-xs flex items-center gap-1.5 text-slate-500">
                                <RefreshCw size={12} /> {exp.billingCycle === 'monthly' ? 'Mensuel' : 'Annuel'}
                            </div>
                            <div className="col-span-2 flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                    onClick={(e) => { e.stopPropagation(); setEditingExpense(exp); setIsModalOpen(true); }}
                                    className="p-1.5 bg-white border border-slate-200 text-indigo-600 rounded-lg hover:bg-indigo-50"
                                >
                                    <Edit3 size={14} />
                                </button>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); setDeleteId(exp.id); }}
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
