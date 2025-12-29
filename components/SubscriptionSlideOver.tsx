
import React, { useEffect, useState } from 'react';
import { ClientSubscription, Invoice } from '../types';
import { X, FileText, Calendar, CheckCircle2, Clock, AlertCircle, Download, ExternalLink, RefreshCw, CreditCard, History } from 'lucide-react';
import { supabase } from '../lib/supabase';
import Skeleton from './Skeleton';
import { useToast } from './ToastProvider';

interface SubscriptionSlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  subscription: ClientSubscription | null;
}

const SubscriptionSlideOver: React.FC<SubscriptionSlideOverProps> = ({ isOpen, onClose, subscription }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'history'>('details');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (isOpen) {
        const timer = setTimeout(() => setIsVisible(true), 50);
        return () => clearTimeout(timer);
    } else {
        setIsVisible(false);
    }
  }, [isOpen]);

  // Chargement de l'historique quand on ouvre ou change d'onglet
  useEffect(() => {
      if (isOpen && subscription && activeTab === 'history') {
          fetchHistory();
      }
  }, [isOpen, subscription, activeTab]);

  const fetchHistory = async () => {
      if (!subscription) return;
      setIsLoadingHistory(true);
      
      try {
          // On cherche les factures liées via subscription_id (UUID)
          const { data, error } = await supabase
            .from('invoices')
            .select('*')
            .eq('subscription_id', subscription.id)
            .order('issue_date', { ascending: false });

          if (error) throw error;

          if (data) {
              const mappedInvoices: Invoice[] = data.map((inv: any) => ({
                  id: inv.id,
                  clientId: inv.user_id,
                  number: inv.number,
                  projectName: inv.project_name,
                  amount: inv.amount,
                  status: inv.status,
                  issueDate: new Date(inv.issue_date).toLocaleDateString('fr-FR'),
                  dueDate: inv.due_date ? new Date(inv.due_date).toLocaleDateString('fr-FR') : '-',
                  pdfUrl: inv.pdf_url,
                  paymentLink: inv.payment_link
              }));
              setInvoices(mappedInvoices);
          }
      } catch (err) {
          console.error("Erreur historique:", err);
          toast.error("Erreur", "Impossible de charger l'historique.");
      } finally {
          setIsLoadingHistory(false);
      }
  };

  const getStatusBadge = (status: string) => {
      switch (status) {
          case 'paid': return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-50 text-emerald-600 border border-emerald-100"><CheckCircle2 size={10} /> Payée</span>;
          case 'pending': return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-50 text-amber-600 border border-amber-100"><Clock size={10} /> En attente</span>;
          case 'overdue': return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-red-50 text-red-600 border border-red-100"><AlertCircle size={10} /> Retard</span>;
          default: return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-50 text-slate-500 border border-slate-100">{status}</span>;
      }
  };

  if (!subscription) return null;

  return (
    <>
      <div 
        className={`fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-[110] transition-opacity duration-300 ${
          isVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      <div 
        className={`fixed inset-y-0 right-0 w-full md:w-[600px] bg-white shadow-2xl z-[120] transform transition-transform duration-300 ease-out flex flex-col ${
          isVisible ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* HEADER */}
        <div className="px-8 pt-8 pb-4 border-b border-slate-100 bg-white shrink-0">
            <div className="flex items-start justify-between mb-6">
                <div>
                     <div className="flex items-center gap-2 mb-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
                            subscription.status === 'active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                            subscription.status === 'paused' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                            subscription.status === 'cancelled' ? 'bg-red-50 text-red-600 border-red-100' :
                            'bg-slate-50 text-slate-500 border-slate-100'
                        }`}>
                            {subscription.status === 'active' ? 'Actif' : subscription.status === 'paused' ? 'En Pause' : subscription.status === 'cancelled' ? 'Annulé' : 'En attente'}
                        </span>
                        <span className="text-xs text-slate-400 font-mono">#{subscription.id.slice(0,8)}</span>
                     </div>
                     <h2 className="text-2xl font-bold text-slate-900">{subscription.serviceName}</h2>
                </div>
                <button 
                    onClick={onClose}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                >
                    <X size={24} />
                </button>
            </div>

            {/* TABS */}
            <div className="flex gap-6 mt-4">
                <button 
                    onClick={() => setActiveTab('details')}
                    className={`pb-3 text-sm font-medium transition-all relative ${
                        activeTab === 'details' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-800'
                    }`}
                >
                    Détails de l'offre
                    {activeTab === 'details' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 rounded-t-full"></div>}
                </button>
                <button 
                    onClick={() => setActiveTab('history')}
                    className={`pb-3 text-sm font-medium transition-all relative ${
                        activeTab === 'history' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-800'
                    }`}
                >
                    Historique Facturation
                    {activeTab === 'history' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 rounded-t-full"></div>}
                </button>
            </div>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto bg-slate-50/50 p-6 md:p-8">
            
            {activeTab === 'details' && (
                <div className="space-y-6 animate-fade-in">
                    {/* INFO CARDS */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Montant Récurrent</p>
                            <p className="text-2xl font-extrabold text-slate-900">
                                {subscription.amount.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                            </p>
                            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                                <RefreshCw size={10} /> Facturation {subscription.billingCycle === 'monthly' ? 'Mensuelle' : 'Annuelle'}
                            </p>
                        </div>
                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Prochaine Échéance</p>
                            <p className="text-xl font-bold text-slate-900">
                                {subscription.nextBillingDate ? new Date(subscription.nextBillingDate).toLocaleDateString('fr-FR') : 'Non planifiée'}
                            </p>
                            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                                <Calendar size={10} /> Date prévisionnelle
                            </p>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <CreditCard size={16} className="text-indigo-500" /> Infos Techniques
                        </h3>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center text-sm border-b border-slate-50 pb-2">
                                <span className="text-slate-500">Date de début</span>
                                <span className="font-medium text-slate-700">
                                    {subscription.startDate ? new Date(subscription.startDate).toLocaleDateString('fr-FR') : '-'}
                                </span>
                            </div>
                            <div className="flex justify-between items-center text-sm border-b border-slate-50 pb-2">
                                <span className="text-slate-500">ID Stripe</span>
                                <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded text-slate-600">
                                    {subscription.stripeSubscriptionId || 'N/A'}
                                </span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500">Taux TVA appliqué</span>
                                <span className="font-medium text-slate-700">
                                    {subscription.taxRate ? `${subscription.taxRate}%` : '0%'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'history' && (
                <div className="space-y-4 animate-fade-in">
                    {isLoadingHistory ? (
                        <div className="space-y-3">
                            <Skeleton className="h-16 w-full rounded-xl" />
                            <Skeleton className="h-16 w-full rounded-xl" />
                            <Skeleton className="h-16 w-full rounded-xl" />
                        </div>
                    ) : invoices.length === 0 ? (
                        <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-200">
                            <History className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                            <p className="text-slate-500 font-medium">Aucune facture liée trouvée.</p>
                            <p className="text-xs text-slate-400 mt-1">Les factures générées apparaîtront ici.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {invoices.map((inv) => (
                                <div key={inv.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between group hover:border-indigo-300 transition-all">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 group-hover:text-indigo-600 group-hover:bg-indigo-50 transition-colors">
                                            <FileText size={20} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-800">{inv.issueDate}</p>
                                            <p className="text-xs text-slate-500 font-mono">{inv.number}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-6">
                                        <div className="text-right">
                                            <p className="text-sm font-bold text-slate-900">{inv.amount.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</p>
                                            <div className="flex justify-end mt-0.5">{getStatusBadge(inv.status)}</div>
                                        </div>
                                        
                                        {inv.pdfUrl && inv.pdfUrl !== '#' ? (
                                            <a 
                                                href={inv.pdfUrl} 
                                                target="_blank" 
                                                rel="noreferrer"
                                                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-lg transition-colors"
                                                title="Télécharger PDF"
                                            >
                                                <Download size={18} />
                                            </a>
                                        ) : (
                                            <div className="w-9"></div> 
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

        </div>
      </div>
    </>
  );
};

export default SubscriptionSlideOver;
