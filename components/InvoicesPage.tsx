
import React, { useEffect, useState } from 'react';
import { Invoice } from '../types';
import { FileText, Download, ExternalLink, AlertCircle, CheckCircle2, Clock, Euro, Search, Filter, ArrowRight, Wallet, CreditCard, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import Skeleton from './Skeleton';
import InvoiceSlideOver from './InvoiceSlideOver';
import { useToast } from './ToastProvider';

interface InvoicesPageProps {
  userId?: string;
}

const InvoicesPage: React.FC<InvoicesPageProps> = ({ userId }) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // États Filtres & Recherche
  const [filterStatus, setFilterStatus] = useState<'all' | 'paid' | 'pending' | 'overdue'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // États SlideOver
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isSlideOverOpen, setIsSlideOverOpen] = useState(false);

  const toast = useToast();

  useEffect(() => {
    if (userId) {
        fetchInvoices();

        // ÉCOUTE TEMPS RÉEL : Si n8n ajoute une facture, elle apparaît direct !
        const channel = supabase
            .channel('realtime:invoices')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, () => {
                fetchInvoices();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }
  }, [userId]);

  const fetchInvoices = async () => {
    const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('user_id', userId)
        .order('issue_date', { ascending: false });

    if (error) {
        console.error('Erreur chargement factures:', error);
    } else if (data) {
        const mapped: Invoice[] = data.map((item: any) => ({
            id: item.id,
            clientId: item.user_id,
            number: item.number,
            projectName: item.project_name || 'Facture Skalia',
            amount: item.amount,
            status: mapStripeStatus(item.status), // Conversion statut Stripe -> App
            issueDate: item.issue_date ? new Date(item.issue_date).toLocaleDateString('fr-FR') : '-',
            dueDate: item.due_date ? new Date(item.due_date).toLocaleDateString('fr-FR') : '-',
            pdfUrl: item.pdf_url || '#',
            // Fallback intelligent : Si payment_link est vide, on utilise pdf_url car c'est souvent la "Hosted Invoice Page" de Stripe
            paymentLink: item.payment_link || item.pdf_url || '#',
            stripeInvoiceId: item.stripe_invoice_id,
            items: item.items,
            taxRate: item.tax_rate
        }));
        setInvoices(mapped);
    }
    setIsLoading(false);
  };

  // Helper pour normaliser les statuts Stripe (open, paid, uncollectible, etc.)
  const mapStripeStatus = (status: string): Invoice['status'] => {
      if (status === 'paid') return 'paid';
      if (status === 'open') return 'pending';
      if (status === 'void' || status === 'uncollectible' || status === 'overdue') return 'overdue';
      return 'pending'; // Défaut
  };

  // --- LOGIQUE FILTRAGE ---
  const filteredInvoices = invoices.filter(inv => {
      const matchesSearch = 
        inv.number.toLowerCase().includes(searchTerm.toLowerCase()) || 
        inv.projectName.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesFilter = filterStatus === 'all' || inv.status === filterStatus;

      return matchesSearch && matchesFilter;
  });

  // KPIs
  const totalPaid = invoices
    .filter(i => i.status === 'paid')
    .reduce((sum, i) => sum + i.amount, 0);

  const totalDue = invoices
    .filter(i => i.status !== 'paid')
    .reduce((sum, i) => sum + i.amount, 0);

  const overdueCount = invoices.filter(i => i.status === 'overdue').length;

  const handleOpenInvoice = (inv: Invoice) => {
      setSelectedInvoice(inv);
      setIsSlideOverOpen(true);
  };

  const getStatusStyle = (status: Invoice['status']) => {
    switch (status) {
      case 'paid':
        return { 
          bg: 'bg-emerald-50', 
          text: 'text-emerald-700', 
          border: 'border-emerald-100',
          label: 'Payée',
          icon: <CheckCircle2 size={14} />
        };
      case 'pending':
        return { 
          bg: 'bg-amber-50', 
          text: 'text-amber-700', 
          border: 'border-amber-100',
          label: 'À payer',
          icon: <Clock size={14} />
        };
      case 'overdue':
        return { 
          bg: 'bg-red-50', 
          text: 'text-red-700', 
          border: 'border-red-100',
          label: 'En retard',
          icon: <AlertCircle size={14} />
        };
      default:
         return { 
          bg: 'bg-slate-50', 
          text: 'text-slate-700', 
          border: 'border-slate-100',
          label: 'Brouillon',
          icon: <Clock size={14} />
        };
    }
  };

  if (isLoading) {
      return (
          <div className="space-y-8 animate-fade-in-up">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Skeleton className="h-28 w-full rounded-2xl" />
                  <Skeleton className="h-28 w-full rounded-2xl" />
              </div>
              <Skeleton className="h-12 w-full rounded-xl" />
              <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                      <Skeleton key={i} className="h-20 w-full rounded-xl" />
                  ))}
              </div>
          </div>
      );
  }

  return (
    <>
    <div className="space-y-8 animate-fade-in-up pb-10">
      
      {/* KPI Cards Redesignés */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Carte Reste à Payer (Orange Doux & Étiquette Blanche) */}
        <div className={`relative p-6 rounded-2xl shadow-sm border overflow-hidden transition-all duration-300 ${totalDue > 0 ? 'bg-gradient-to-br from-[#F59E0B] to-[#F97316] border-orange-200 text-white' : 'bg-white border-gray-100'}`}>
            {totalDue > 0 && (
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
            )}
            
            <div className="relative z-10 flex justify-between items-start">
                <div>
                    <p className={`text-sm font-medium mb-1 ${totalDue > 0 ? 'text-orange-50' : 'text-gray-500'}`}>Reste à payer</p>
                    <p className={`text-3xl font-bold tracking-tight ${totalDue > 0 ? 'text-white' : 'text-gray-900'}`}>
                        {totalDue.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                    </p>
                    {overdueCount > 0 && (
                        <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 bg-white rounded-lg shadow-sm text-xs font-bold text-orange-600 animate-pulse">
                            <AlertCircle size={14} />
                            {overdueCount} facture(s) en retard
                        </div>
                    )}
                </div>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${totalDue > 0 ? 'bg-white/20 text-white' : 'bg-indigo-50 text-indigo-600'}`}>
                    <Wallet size={24} />
                </div>
            </div>
        </div>

        {/* Carte Total Payé */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-start justify-between">
            <div>
                <p className="text-sm text-gray-500 font-medium mb-1">Total réglé</p>
                <p className="text-3xl font-bold text-emerald-600">
                    {totalPaid.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                </p>
                <p className="text-xs text-gray-400 mt-2">Merci pour votre confiance</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                <CheckCircle2 size={24} />
            </div>
        </div>
      </div>

      {/* Barre d'outils (Filtres + Recherche) */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          
          {/* Tabs Filtres */}
          <div className="flex p-1 bg-slate-100/80 rounded-xl">
              {(['all', 'pending', 'paid', 'overdue'] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => setFilterStatus(status)}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                        filterStatus === status 
                        ? 'bg-white text-indigo-600 shadow-sm' 
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                    }`}
                  >
                      {status === 'all' && 'Toutes'}
                      {status === 'pending' && 'À payer'}
                      {status === 'paid' && 'Payées'}
                      {status === 'overdue' && 'En retard'}
                  </button>
              ))}
          </div>

          {/* Recherche */}
          <div className="relative w-full md:w-72">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Search size={16} />
                </div>
                <input 
                    type="text" 
                    placeholder="N° facture ou projet..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
                />
          </div>
      </div>

      {/* Liste des factures (Style Cards Rows) */}
      <div className="space-y-3">
          {filteredInvoices.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 bg-white rounded-2xl border border-dashed border-slate-200">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 text-slate-300">
                      <Filter size={24} />
                  </div>
                  <p className="text-slate-500 font-medium">Aucune facture trouvée</p>
                  {searchTerm && <p className="text-xs text-slate-400 mt-1">Essayez de modifier votre recherche</p>}
              </div>
          ) : (
              filteredInvoices.map((inv) => {
                  const style = getStatusStyle(inv.status);
                  
                  return (
                      <div 
                        key={inv.id}
                        onClick={() => handleOpenInvoice(inv)}
                        className="group bg-white rounded-xl border border-slate-200 p-4 hover:border-indigo-300 hover:shadow-md transition-all duration-300 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden"
                      >
                          <div className="flex items-start gap-4 z-10">
                              <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${style.bg} ${style.text}`}>
                                  <FileText size={20} />
                              </div>
                              <div>
                                  <div className="flex items-center gap-2 mb-1">
                                      <h3 className="font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">
                                          {inv.number}
                                      </h3>
                                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide border ${style.bg} ${style.text} ${style.border}`}>
                                          {style.label}
                                      </span>
                                  </div>
                                  <p className="text-sm text-slate-500 font-medium">{inv.projectName}</p>
                              </div>
                          </div>

                          <div className="flex items-center justify-between md:justify-end gap-6 md:gap-10 pl-16 md:pl-0 z-10">
                              <div className="text-right">
                                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-0.5">Date</p>
                                  <p className="text-sm font-medium text-slate-700">{inv.issueDate}</p>
                              </div>
                              <div className="text-right w-24">
                                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-0.5">Montant</p>
                                  <p className="text-lg font-bold text-slate-900">
                                      {inv.amount.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                                  </p>
                              </div>
                              
                              {/* Bouton de paiement Direct */}
                              <div className="hidden md:flex flex-col gap-2 min-w-[140px] items-end">
                                  {inv.status !== 'paid' ? (
                                     inv.paymentLink && inv.paymentLink !== '#' ? (
                                        <a 
                                            href={inv.paymentLink}
                                            target="_blank"
                                            rel="noreferrer"
                                            onClick={(e) => e.stopPropagation()}
                                            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200 hover:shadow-indigo-300 active:scale-95"
                                        >
                                            <CreditCard size={16} />
                                            Payer
                                        </a>
                                     ) : (
                                        <span className="text-xs text-slate-400 italic">Lien indisponible</span>
                                     )
                                  ) : (
                                     <button className="flex items-center gap-1 text-emerald-600 font-medium text-sm cursor-default">
                                         <CheckCircle2 size={16} /> Réglée
                                     </button>
                                  )}
                              </div>
                              
                              <div className="hidden md:flex text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all items-center">
                                  <ChevronRight size={20} />
                              </div>
                          </div>
                      </div>
                  )
              })
          )}
      </div>

    </div>
    
    {/* SlideOver */}
    <InvoiceSlideOver 
        isOpen={isSlideOverOpen}
        onClose={() => setIsSlideOverOpen(false)}
        invoice={selectedInvoice}
    />
    </>
  );
};

export default InvoicesPage;
