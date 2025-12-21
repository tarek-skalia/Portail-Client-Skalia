
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Invoice } from '../types';
import { useAdmin } from './AdminContext';
import { DollarSign, TrendingUp, AlertTriangle, Search, Filter, Plus, Edit3, Trash2, Users } from 'lucide-react';
import Skeleton from './Skeleton';
import InvoiceSlideOver from './InvoiceSlideOver';
import Modal from './ui/Modal';
import InvoiceForm from './forms/InvoiceForm';
import { useToast } from './ToastProvider';

const GlobalFinance: React.FC = () => {
  const { clients } = useAdmin();
  const toast = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  
  // CLIENT FILTER
  const [selectedClientId, setSelectedClientId] = useState<string>('all');

  // SlideOver & Modal
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isSlideOverOpen, setIsSlideOverOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);

  // Deletion
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
      fetchGlobalInvoices();
      
      const channel = supabase.channel('global_finance_realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, () => fetchGlobalInvoices())
        .subscribe();

      return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchGlobalInvoices = async () => {
      try {
          const { data, error } = await supabase
            .from('invoices')
            .select('*')
            .order('issue_date', { ascending: false });

          if (error) throw error;

          const mapped: Invoice[] = (data || []).map((inv: any) => ({
              id: inv.id,
              clientId: inv.user_id,
              number: inv.number,
              projectName: inv.project_name,
              amount: inv.amount,
              status: inv.status,
              issueDate: new Date(inv.issue_date).toLocaleDateString('fr-FR'),
              dueDate: inv.due_date ? new Date(inv.due_date).toLocaleDateString('fr-FR') : '-',
              pdfUrl: inv.pdf_url,
              paymentLink: inv.payment_link,
              items: inv.items,
              taxRate: inv.tax_rate
          }));

          setInvoices(mapped);

      } catch (e) {
          console.error("Global finance error:", e);
      } finally {
          setIsLoading(false);
      }
  };

  const getClientName = (clientId: string) => {
      const client = clients.find(c => c.id === clientId);
      return client ? client.company : 'Client Inconnu';
  };

  const handleEdit = (e: React.MouseEvent, invoice: Invoice) => {
      e.stopPropagation();
      setEditingInvoice(invoice);
      setIsModalOpen(true);
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      setDeleteId(id);
  };

  const executeDelete = async () => {
      if (!deleteId) return;
      setIsDeleting(true);
      const { error } = await supabase.from('invoices').delete().eq('id', deleteId);
      if (error) {
          toast.error("Erreur", "Impossible de supprimer la facture.");
      } else {
          toast.success("Supprimé", "Facture supprimée.");
          fetchGlobalInvoices();
      }
      setIsDeleting(false);
      setDeleteId(null);
  };

  // --- FILTRAGE & CALCULS ---
  const filteredInvoices = invoices.filter(inv => {
      const matchesClient = selectedClientId === 'all' || inv.clientId === selectedClientId;
      const matchesSearch = inv.number.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            getClientName(inv.clientId).toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = filterStatus === 'all' || inv.status === filterStatus;
      return matchesClient && matchesSearch && matchesStatus;
  });

  // KPI calculés sur la sélection
  const invoicesToCalc = selectedClientId === 'all' ? invoices : invoices.filter(i => i.clientId === selectedClientId);
  
  let paid = 0;
  let pending = 0;
  let overdue = 0;

  invoicesToCalc.forEach(inv => {
      if (inv.status === 'paid') paid += inv.amount;
      else if (inv.status === 'overdue') overdue += inv.amount;
      else pending += inv.amount;
  });

  const totalRevenue = paid;
  const pendingRevenue = pending;
  const overdueRevenue = overdue;

  if (isLoading) return <div className="p-8"><Skeleton className="h-96 w-full rounded-2xl" /></div>;

  return (
    <>
    <div className="space-y-6 animate-fade-in-up pb-10">
        
        <div className="flex flex-col md:flex-row justify-between items-end gap-4">
            <div>
                <h1 className="text-3xl font-extrabold text-slate-900">Finance & Trésorerie</h1>
                <p className="text-slate-500 mt-1">Suivi global de la facturation agence.</p>
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

        {/* KPI CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-emerald-100 shadow-sm flex items-center justify-between group relative cursor-help">
                <div>
                    <p className="text-xs font-bold text-emerald-600 uppercase tracking-wide mb-1">Total Encaissé</p>
                    <p className="text-3xl font-extrabold text-slate-900">
                        {totalRevenue.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
                    </p>
                </div>
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                    <DollarSign size={24} />
                </div>
                {/* Tooltip */}
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 p-2 bg-slate-800 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-50 text-center shadow-xl">
                    Montant total des factures marquées comme "Payée".
                </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-amber-100 shadow-sm flex items-center justify-between group relative cursor-help">
                <div>
                    <p className="text-xs font-bold text-amber-600 uppercase tracking-wide mb-1">En attente</p>
                    <p className="text-3xl font-extrabold text-slate-900">
                        {pendingRevenue.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
                    </p>
                </div>
                <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                    <TrendingUp size={24} />
                </div>
                {/* Tooltip */}
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 p-2 bg-slate-800 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-50 text-center shadow-xl">
                    Factures émises mais non encore réglées (échéance à venir).
                </div>
            </div>

            <div className={`p-6 rounded-2xl border shadow-sm flex items-center justify-between group relative cursor-help ${overdueRevenue > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}>
                <div>
                    <p className={`text-xs font-bold uppercase tracking-wide mb-1 ${overdueRevenue > 0 ? 'text-red-600' : 'text-slate-400'}`}>Retards</p>
                    <p className={`text-3xl font-extrabold ${overdueRevenue > 0 ? 'text-red-700' : 'text-slate-900'}`}>
                        {overdueRevenue.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
                    </p>
                </div>
                <div className={`p-3 rounded-xl ${overdueRevenue > 0 ? 'bg-white text-red-600' : 'bg-slate-50 text-slate-400'}`}>
                    <AlertTriangle size={24} />
                </div>
                {/* Tooltip */}
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 p-2 bg-slate-800 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-50 text-center shadow-xl">
                    Montant cumulé des factures dont la date d'échéance est dépassée.
                </div>
            </div>
        </div>

        <div className="flex gap-4 items-center justify-end">
             <button 
                onClick={() => { setEditingInvoice(null); setIsModalOpen(true); }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-indigo-200 transition-all active:scale-95"
            >
                <Plus size={18} /> Créer Facture
            </button>
        </div>

        {/* DATA TABLE */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            {/* Toolbar Table */}
            <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex gap-2">
                    {['all', 'paid', 'pending', 'overdue'].map(s => (
                        <button
                            key={s}
                            onClick={() => setFilterStatus(s)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-colors ${
                                filterStatus === s 
                                ? 'bg-slate-800 text-white' 
                                : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                            }`}
                        >
                            {s === 'all' ? 'Toutes' : s === 'paid' ? 'Payées' : s === 'pending' ? 'En attente' : 'Retard'}
                        </button>
                    ))}
                </div>
                <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                        type="text" 
                        placeholder="Rechercher..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none"
                    />
                </div>
            </div>

            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-slate-50/50 border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider">
                <div className="col-span-2">Numéro</div>
                <div className="col-span-2">Client</div>
                <div className="col-span-3">Projet</div>
                <div className="col-span-2 text-right">Montant</div>
                <div className="col-span-1 text-center">Statut</div>
                <div className="col-span-2 text-right">Actions</div>
            </div>

            {/* Table Body */}
            <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto custom-scrollbar">
                {filteredInvoices.map(inv => (
                    <div 
                        key={inv.id} 
                        onClick={() => { setSelectedInvoice(inv); setIsSlideOverOpen(true); }}
                        className="grid grid-cols-12 gap-4 px-6 py-4 hover:bg-slate-50/50 transition-colors cursor-pointer items-center group relative"
                    >
                        <div className="col-span-2 font-mono text-xs font-bold text-slate-600 group-hover:text-indigo-600">
                            {inv.number}
                        </div>
                        <div className="col-span-2 font-bold text-slate-800 truncate text-sm">
                            {getClientName(inv.clientId)}
                        </div>
                        <div className="col-span-3 text-sm text-slate-500 truncate">
                            {inv.projectName}
                        </div>
                        <div className="col-span-2 text-right font-bold text-slate-900">
                            {inv.amount.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                        </div>
                        <div className="col-span-1 flex justify-center">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide border whitespace-nowrap ${
                                inv.status === 'paid' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                inv.status === 'overdue' ? 'bg-red-50 text-red-600 border-red-100' :
                                'bg-amber-50 text-amber-600 border-amber-100'
                            }`}>
                                {inv.status === 'paid' ? 'Payée' : inv.status === 'overdue' ? 'Retard' : 'Attente'}
                            </span>
                        </div>
                        <div className="col-span-2 flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                                onClick={(e) => handleEdit(e, inv)}
                                className="p-1.5 bg-white border border-slate-200 text-indigo-600 rounded-lg hover:bg-indigo-50"
                                title="Modifier"
                            >
                                <Edit3 size={14} />
                            </button>
                            <button 
                                onClick={(e) => handleDelete(e, inv.id)}
                                className="p-1.5 bg-white border border-slate-200 text-red-600 rounded-lg hover:bg-red-50"
                                title="Supprimer"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    </div>
                ))}
                {filteredInvoices.length === 0 && (
                    <div className="p-12 text-center text-slate-400 italic">Aucune facture trouvée.</div>
                )}
            </div>
        </div>
    </div>

    <InvoiceSlideOver 
        isOpen={isSlideOverOpen}
        onClose={() => setIsSlideOverOpen(false)}
        invoice={selectedInvoice}
    />

    <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingInvoice ? "Modifier Facture" : "Nouvelle Facture"}>
        <InvoiceForm 
            initialData={editingInvoice}
            onSuccess={() => { 
                setIsModalOpen(false); 
                fetchGlobalInvoices(); 
            }} 
            onCancel={() => setIsModalOpen(false)} 
        />
    </Modal>

    <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Supprimer la facture ?" maxWidth="max-w-md">
        <div className="text-center p-4">
            <AlertTriangle size={32} className="text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-900 mb-2">Êtes-vous sûr ?</h3>
            <p className="text-slate-500 text-sm mb-6">Cela supprimera définitivement cette facture de l'historique.</p>
            <div className="flex gap-3 justify-center">
                <button 
                    onClick={() => setDeleteId(null)}
                    className="px-4 py-2 border rounded-xl hover:bg-slate-50"
                >
                    Annuler
                </button>
                <button 
                    onClick={executeDelete}
                    disabled={isDeleting}
                    className="px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 shadow-md"
                >
                    {isDeleting ? '...' : 'Supprimer'}
                </button>
            </div>
        </div>
    </Modal>
    </>
  );
};

export default GlobalFinance;
