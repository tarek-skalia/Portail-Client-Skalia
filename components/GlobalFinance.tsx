
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Invoice, ClientSubscription } from '../types';
import { useAdmin } from './AdminContext';
import { DollarSign, TrendingUp, AlertTriangle, Search, Filter, Plus, Edit3, Trash2, Users, RefreshCw, PlayCircle, PauseCircle, StopCircle, CheckCircle2, Clock, Loader2, Wallet, HelpCircle } from 'lucide-react';
import Skeleton from './Skeleton';
import InvoiceSlideOver from './InvoiceSlideOver';
import Modal from './ui/Modal';
import InvoiceForm from './forms/InvoiceForm';
import { useToast } from './ToastProvider';

// URL unique pour le Switch N8N
const N8N_FINANCE_WEBHOOK = "https://n8n-skalia-u41651.vm.elestio.app/webhook/de8b8392-51b4-4a45-875e-f11c9b6a0f6e";

const GlobalFinance: React.FC = () => {
  const { clients } = useAdmin();
  const toast = useToast();
  
  // TABS STATE
  const [activeTab, setActiveTab] = useState<'invoices' | 'subscriptions'>('invoices');

  // INVOICES STATE
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  
  // SUBSCRIPTIONS STATE
  const [subscriptions, setSubscriptions] = useState<ClientSubscription[]>([]);
  const [isSubModalOpen, setIsSubModalOpen] = useState(false);
  const [editingSub, setEditingSub] = useState<ClientSubscription | null>(null);
  const [subFormData, setSubFormData] = useState({
      clientId: '',
      serviceName: '',
      amount: 0,
      billingCycle: 'monthly',
      status: 'pending'
  });
  
  // Processing State pour les actions asynchrones (Activation N8N)
  const [processingSubId, setProcessingSubId] = useState<string | null>(null);

  // CLIENT FILTER
  const [selectedClientId, setSelectedClientId] = useState<string>('all');

  // SlideOver & Modal (Invoices)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isSlideOverOpen, setIsSlideOverOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);

  // Deletion
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteType, setDeleteType] = useState<'invoice' | 'subscription'>('invoice');

  useEffect(() => {
      fetchGlobalInvoices();
      fetchSubscriptions();
      
      const channel = supabase.channel('global_finance_realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, () => fetchGlobalInvoices())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'client_subscriptions' }, () => fetchSubscriptions())
        .subscribe();

      return () => { supabase.removeChannel(channel); };
  }, []);

  // --- FETCHERS ---

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

  const fetchSubscriptions = async () => {
      try {
          const { data, error } = await supabase
            .from('client_subscriptions')
            .select('*')
            .order('created_at', { ascending: false });

          if (error) throw error;

          const mapped: ClientSubscription[] = (data || []).map((sub: any) => ({
              id: sub.id,
              clientId: sub.user_id,
              serviceName: sub.service_name,
              amount: sub.amount,
              currency: sub.currency,
              billingCycle: sub.billing_cycle,
              status: sub.status,
              startDate: sub.start_date,
              nextBillingDate: sub.next_billing_date,
              stripeSubscriptionId: sub.stripe_subscription_id,
              createdAt: sub.created_at
          }));

          setSubscriptions(mapped);
      } catch (e) {
          console.error("Subscription fetch error:", e);
      }
  };

  const getClientName = (clientId: string) => {
      const client = clients.find(c => c.id === clientId);
      return client ? client.company : 'Client Inconnu';
  };

  // --- INVOICE ACTIONS ---

  const handleEditInvoice = (e: React.MouseEvent, invoice: Invoice) => {
      e.stopPropagation();
      setEditingInvoice(invoice);
      setIsModalOpen(true);
  };

  const handleDeleteInvoice = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      setDeleteType('invoice');
      setDeleteId(id);
  };

  // --- SUBSCRIPTION ACTIONS ---

  const handleCreateSub = () => {
      setEditingSub(null);
      setSubFormData({
          clientId: selectedClientId !== 'all' ? selectedClientId : '',
          serviceName: '',
          amount: 0,
          billingCycle: 'monthly',
          status: 'pending'
      });
      setIsSubModalOpen(true);
  };

  const handleEditSub = (sub: ClientSubscription) => {
      setEditingSub(sub);
      setSubFormData({
          clientId: sub.clientId,
          serviceName: sub.serviceName,
          amount: sub.amount,
          billingCycle: sub.billingCycle,
          status: sub.status
      });
      setIsSubModalOpen(true);
  };

  const handleSubmitSub = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsLoading(true); 
      try {
          const payload = {
              user_id: subFormData.clientId,
              service_name: subFormData.serviceName,
              amount: subFormData.amount,
              billing_cycle: subFormData.billingCycle,
              status: subFormData.status,
              currency: 'EUR'
          };

          if (editingSub) {
              const { error } = await supabase.from('client_subscriptions').update(payload).eq('id', editingSub.id);
              if (error) throw error;
              toast.success("Mis à jour", "Abonnement modifié.");
          } else {
              const { error } = await supabase.from('client_subscriptions').insert({ ...payload, created_at: new Date().toISOString() });
              if (error) throw error;
              toast.success("Créé", "Abonnement ajouté.");
          }
          setIsSubModalOpen(false);
          fetchSubscriptions();
      } catch (e: any) {
          toast.error("Erreur", e.message);
      } finally {
          setIsLoading(false);
      }
  };

  // --- ACTIVATION AVEC N8N ---
  const handleActivateSub = async (sub: ClientSubscription) => {
      if (!window.confirm(`Confirmer l'activation de l'abonnement "${sub.serviceName}" ?\nCela déclenchera la création dans Stripe.`)) return;
      
      setProcessingSubId(sub.id);

      try {
          const { data: profile } = await supabase.from('profiles').select('email, full_name, stripe_customer_id').eq('id', sub.clientId).single();
          
          if (!profile) throw new Error("Profil client introuvable.");

          const payload = {
              action: 'start_subscription',
              subscription_id: sub.id,
              client: {
                  email: profile.email,
                  name: profile.full_name,
                  stripe_customer_id: profile.stripe_customer_id,
                  supabase_user_id: sub.clientId
              },
              service: {
                  name: sub.serviceName,
                  amount: sub.amount,
                  interval: sub.billingCycle === 'monthly' ? 'month' : 'year',
                  currency: 'eur'
              }
          };

          await fetch(N8N_FINANCE_WEBHOOK, {
              method: 'POST',
              mode: 'no-cors',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
          });

          const { error } = await supabase.from('client_subscriptions').update({
              status: 'active',
              start_date: new Date().toISOString()
          }).eq('id', sub.id);

          if (error) throw error;

          toast.success("Activation lancée", "La demande est partie chez Stripe.");
          fetchSubscriptions();

      } catch (err: any) {
          toast.error("Erreur", "Echec de l'activation : " + err.message);
      } finally {
          setProcessingSubId(null);
      }
  };

  const handleDeactivateSub = async (sub: ClientSubscription) => {
      if (!window.confirm("Arrêter cet abonnement immédiatement ?")) return;
      
      setProcessingSubId(sub.id);
      try {
          await supabase.from('client_subscriptions').update({ status: 'cancelled' }).eq('id', sub.id);
          toast.info("Arrêté", "Abonnement annulé.");
          fetchSubscriptions();
      } catch (e) {
          toast.error("Erreur", "Impossible d'arrêter.");
      } finally {
          setProcessingSubId(null);
      }
  };

  const handleDeleteSub = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      setDeleteType('subscription');
      setDeleteId(id);
  };

  const executeDelete = async () => {
      if (!deleteId) return;
      setIsDeleting(true);
      
      const table = deleteType === 'invoice' ? 'invoices' : 'client_subscriptions';
      const { error } = await supabase.from(table).delete().eq('id', deleteId);
      
      if (error) {
          toast.error("Erreur", "Impossible de supprimer.");
      } else {
          toast.success("Supprimé", "Élément supprimé.");
          if (deleteType === 'invoice') fetchGlobalInvoices();
          else fetchSubscriptions();
      }
      setIsDeleting(false);
      setDeleteId(null);
  };

  // --- FILTERED DATA ---
  const filteredInvoices = invoices.filter(inv => {
      const matchesClient = selectedClientId === 'all' || inv.clientId === selectedClientId;
      const matchesSearch = inv.number.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            getClientName(inv.clientId).toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = filterStatus === 'all' || inv.status === filterStatus;
      return matchesClient && matchesSearch && matchesStatus;
  });

  const filteredSubscriptions = subscriptions.filter(sub => {
      const matchesClient = selectedClientId === 'all' || sub.clientId === selectedClientId;
      const matchesSearch = sub.serviceName.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesClient && matchesSearch;
  });

  // KPI calculés sur la sélection
  let totalRevenue = 0;
  let totalPending = 0;
  let mrr = 0;

  invoices.forEach(inv => {
      if (inv.status === 'paid') totalRevenue += inv.amount;
      if (inv.status === 'pending' || inv.status === 'overdue') totalPending += inv.amount;
  });

  subscriptions.forEach(sub => {
      if (sub.status === 'active') {
          mrr += sub.billingCycle === 'monthly' ? sub.amount : sub.amount / 12;
      }
  });

  if (isLoading) return <div className="p-8"><Skeleton className="h-96 w-full rounded-2xl" /></div>;

  return (
    <>
    <div className="space-y-6 animate-fade-in-up pb-10">
        
        <div className="flex flex-col md:flex-row justify-between items-end gap-4">
            <div>
                <h1 className="text-3xl font-extrabold text-slate-900">Finance & Trésorerie</h1>
                <p className="text-slate-500 mt-1">Suivi global de la facturation et des revenus récurrents.</p>
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

        {/* KPI CARDS (4 COLONNES) */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            
            {/* Total Encaissé */}
            <div className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-sm flex items-center justify-between group relative cursor-help hover:shadow-md transition-shadow">
                <div>
                    <p className="text-xs font-bold text-emerald-600 uppercase tracking-wide mb-1 flex items-center gap-1">
                        Total Encaissé <HelpCircle size={10} className="text-slate-300" />
                    </p>
                    <p className="text-2xl font-extrabold text-slate-900">
                        {totalRevenue.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
                    </p>
                </div>
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                    <DollarSign size={20} />
                </div>
                {/* Tooltip */}
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 p-2 bg-slate-800 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-50 text-center shadow-xl">
                    Total de toutes les factures avec le statut "Payée".
                </div>
            </div>

            {/* Montant en Attente (Restauré) */}
            <div className={`p-5 rounded-2xl border shadow-sm flex items-center justify-between group relative cursor-help hover:shadow-md transition-all ${totalPending > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'}`}>
                <div>
                    <p className={`text-xs font-bold uppercase tracking-wide mb-1 flex items-center gap-1 ${totalPending > 0 ? 'text-amber-700' : 'text-slate-400'}`}>
                        En Attente <HelpCircle size={10} className="opacity-50" />
                    </p>
                    <p className={`text-2xl font-extrabold ${totalPending > 0 ? 'text-amber-700' : 'text-slate-900'}`}>
                        {totalPending.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
                    </p>
                </div>
                <div className={`p-3 rounded-xl ${totalPending > 0 ? 'bg-white text-amber-600' : 'bg-slate-50 text-slate-400'}`}>
                    <Wallet size={20} />
                </div>
                {/* Tooltip */}
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 p-2 bg-slate-800 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-50 text-center shadow-xl">
                    Montant total des factures envoyées mais non encore réglées.
                </div>
            </div>

            {/* MRR */}
            <div className="bg-white p-5 rounded-2xl border border-indigo-100 shadow-sm flex items-center justify-between group relative cursor-help hover:shadow-md transition-shadow">
                <div>
                    <p className="text-xs font-bold text-indigo-600 uppercase tracking-wide mb-1 flex items-center gap-1">
                        MRR Récurrent <HelpCircle size={10} className="text-slate-300" />
                    </p>
                    <p className="text-2xl font-extrabold text-slate-900">
                        {mrr.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
                    </p>
                </div>
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                    <RefreshCw size={20} />
                </div>
                {/* Tooltip */}
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 p-2 bg-slate-800 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-50 text-center shadow-xl">
                    Revenu Récurrent Mensuel : Somme lissée de tous les abonnements actifs (Mensuels + Annuels/12).
                </div>
            </div>

            {/* Abonnements Actifs */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between group relative cursor-help hover:shadow-md transition-shadow">
                <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1 flex items-center gap-1">
                        Abonnements <HelpCircle size={10} className="text-slate-300" />
                    </p>
                    <p className="text-2xl font-extrabold text-slate-900">
                        {subscriptions.filter(s => s.status === 'active').length}
                    </p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 text-slate-400">
                    <TrendingUp size={20} />
                </div>
                {/* Tooltip */}
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 p-2 bg-slate-800 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-50 text-center shadow-xl">
                    Nombre total d'abonnements actuellement actifs.
                </div>
            </div>
        </div>

        {/* --- TABS --- */}
        <div className="flex gap-6 border-b border-slate-200">
            <button 
                onClick={() => setActiveTab('invoices')}
                className={`pb-4 text-sm font-bold transition-all relative ${activeTab === 'invoices' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
                Factures
                {activeTab === 'invoices' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 rounded-t-full"></div>}
            </button>
            <button 
                onClick={() => setActiveTab('subscriptions')}
                className={`pb-4 text-sm font-bold transition-all relative ${activeTab === 'subscriptions' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
                Abonnements
                {activeTab === 'subscriptions' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 rounded-t-full"></div>}
            </button>
        </div>

        {/* ... (Le reste du code des tables reste inchangé) ... */}
        {/* --- INVOICES VIEW --- */}
        {activeTab === 'invoices' && (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden animate-fade-in">
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
                    <div className="flex gap-3">
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
                        <button 
                            onClick={() => { setEditingInvoice(null); setIsModalOpen(true); }}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-sm transition-all active:scale-95 text-sm whitespace-nowrap"
                        >
                            <Plus size={16} /> Créer
                        </button>
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
                                    onClick={(e) => handleEditInvoice(e, inv)}
                                    className="p-1.5 bg-white border border-slate-200 text-indigo-600 rounded-lg hover:bg-indigo-50"
                                    title="Modifier"
                                >
                                    <Edit3 size={14} />
                                </button>
                                <button 
                                    onClick={(e) => handleDeleteInvoice(e, inv.id)}
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
        )}

        {/* --- SUBSCRIPTIONS VIEW --- */}
        {activeTab === 'subscriptions' && (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden animate-fade-in">
                
                {/* Toolbar */}
                <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                    <div className="relative w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                            type="text" 
                            placeholder="Rechercher abonnement..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none"
                        />
                    </div>
                    <button 
                        onClick={handleCreateSub}
                        className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-sm transition-all whitespace-nowrap text-sm"
                    >
                        <Plus size={16} /> Nouvel Abonnement
                    </button>
                </div>

                {/* Table Header */}
                <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-slate-50/50 border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider">
                    <div className="col-span-3">Service</div>
                    <div className="col-span-3">Client</div>
                    <div className="col-span-2 text-right">Montant</div>
                    <div className="col-span-2 text-center">Statut</div>
                    <div className="col-span-2 text-right">Actions</div>
                </div>

                {/* Table Body */}
                <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto custom-scrollbar">
                    {filteredSubscriptions.map(sub => {
                        const isProcessing = processingSubId === sub.id;
                        
                        return (
                            <div 
                                key={sub.id} 
                                className="grid grid-cols-12 gap-4 px-6 py-4 hover:bg-slate-50/50 transition-colors items-center group"
                            >
                                <div className="col-span-3 font-bold text-slate-800 truncate text-sm">
                                    {sub.serviceName}
                                    <div className="text-[10px] text-slate-400 font-normal uppercase flex items-center gap-1 mt-0.5">
                                        <RefreshCw size={10} /> {sub.billingCycle}
                                    </div>
                                </div>
                                <div className="col-span-3 text-sm text-slate-600">
                                    {getClientName(sub.clientId)}
                                </div>
                                <div className="col-span-2 text-right font-bold text-indigo-600">
                                    {sub.amount.toLocaleString('fr-FR', { style: 'currency', currency: sub.currency })}
                                </div>
                                <div className="col-span-2 flex justify-center">
                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide border whitespace-nowrap flex items-center gap-1 ${
                                        sub.status === 'active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                        sub.status === 'pending' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                        'bg-slate-100 text-slate-500 border-slate-200'
                                    }`}>
                                        {isProcessing ? <Loader2 size={10} className="animate-spin" /> : 
                                         sub.status === 'active' ? <CheckCircle2 size={10} /> : sub.status === 'pending' ? <Clock size={10} /> : <StopCircle size={10} />
                                        }
                                        {sub.status}
                                    </span>
                                </div>
                                <div className="col-span-2 flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {sub.status === 'pending' && (
                                        <button 
                                            onClick={() => handleActivateSub(sub)}
                                            className="p-1.5 bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-lg hover:bg-emerald-100"
                                            title="Activer la facturation"
                                            disabled={isProcessing}
                                        >
                                            <PlayCircle size={14} />
                                        </button>
                                    )}
                                    {sub.status === 'active' && (
                                        <button 
                                            onClick={() => handleDeactivateSub(sub)}
                                            className="p-1.5 bg-amber-50 border border-amber-200 text-amber-600 rounded-lg hover:bg-amber-100"
                                            title="Suspendre/Arrêter"
                                            disabled={isProcessing}
                                        >
                                            <PauseCircle size={14} />
                                        </button>
                                    )}
                                    <button 
                                        onClick={() => handleEditSub(sub)}
                                        className="p-1.5 bg-white border border-slate-200 text-indigo-600 rounded-lg hover:bg-indigo-50"
                                        title="Modifier"
                                    >
                                        <Edit3 size={14} />
                                    </button>
                                    <button 
                                        onClick={(e) => handleDeleteSub(e, sub.id)}
                                        className="p-1.5 bg-white border border-slate-200 text-red-600 rounded-lg hover:bg-red-50"
                                        title="Supprimer"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                    {filteredSubscriptions.length === 0 && (
                        <div className="p-12 text-center text-slate-400 italic">Aucun abonnement trouvé.</div>
                    )}
                </div>
            </div>
        )}

    </div>

    {/* INVOICE MODALS */}
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

    {/* SUBSCRIPTION MODAL */}
    <Modal isOpen={isSubModalOpen} onClose={() => setIsSubModalOpen(false)} title={editingSub ? "Modifier Abonnement" : "Nouvel Abonnement"}>
        {/* ... Formulaire Sub inchangé ... */}
        <form onSubmit={handleSubmitSub} className="space-y-6 pt-2">
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Client</label>
                <select 
                    value={subFormData.clientId} 
                    onChange={e => setSubFormData({...subFormData, clientId: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg bg-white outline-none"
                    disabled={!!editingSub}
                >
                    <option value="">Choisir un client...</option>
                    {clients.filter(c => c.role !== 'admin').map(client => (
                        <option key={client.id} value={client.id}>{client.company}</option>
                    ))}
                </select>
            </div>
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nom du service</label>
                <input 
                    type="text" 
                    value={subFormData.serviceName}
                    onChange={e => setSubFormData({...subFormData, serviceName: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Ex: Maintenance Mensuelle"
                />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Montant (€)</label>
                    <input 
                        type="number" 
                        value={subFormData.amount}
                        onChange={e => setSubFormData({...subFormData, amount: parseFloat(e.target.value)})}
                        className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cycle</label>
                    <select 
                        value={subFormData.billingCycle}
                        onChange={e => setSubFormData({...subFormData, billingCycle: e.target.value as any})}
                        className="w-full px-3 py-2 border rounded-lg bg-white outline-none"
                    >
                        <option value="monthly">Mensuel</option>
                        <option value="yearly">Annuel</option>
                    </select>
                </div>
            </div>
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Statut</label>
                <select 
                    value={subFormData.status}
                    onChange={e => setSubFormData({...subFormData, status: e.target.value as any})}
                    className="w-full px-3 py-2 border rounded-lg bg-white outline-none"
                >
                    <option value="pending">En attente (Pending)</option>
                    <option value="active">Actif</option>
                    <option value="paused">En pause</option>
                    <option value="cancelled">Arrêté</option>
                </select>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setIsSubModalOpen(false)} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg">Annuler</button>
                <button type="submit" className="px-6 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-md">Sauvegarder</button>
            </div>
        </form>
    </Modal>

    {/* DELETE MODAL */}
    <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Supprimer ?" maxWidth="max-w-md">
        <div className="text-center p-4">
            <AlertTriangle size={32} className="text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-900 mb-2">Êtes-vous sûr ?</h3>
            <p className="text-slate-500 text-sm mb-6">Cela supprimera définitivement cet élément.</p>
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
