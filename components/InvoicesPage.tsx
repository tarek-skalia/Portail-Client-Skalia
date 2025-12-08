
import React, { useEffect, useState } from 'react';
import { Invoice } from '../types';
import { FileText, Download, ExternalLink, AlertCircle, CheckCircle2, Clock, Euro } from 'lucide-react';
import { supabase } from '../lib/supabase';
import Skeleton from './Skeleton';

interface InvoicesPageProps {
  userId?: string;
}

const InvoicesPage: React.FC<InvoicesPageProps> = ({ userId }) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (userId) {
        fetchInvoices();

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
            projectName: item.project_name || 'Service',
            amount: item.amount,
            status: item.status,
            issueDate: item.issue_date ? new Date(item.issue_date).toLocaleDateString('fr-FR') : '-',
            dueDate: item.due_date ? new Date(item.due_date).toLocaleDateString('fr-FR') : '-',
            pdfUrl: item.pdf_url || '#',
            paymentLink: item.payment_link || '#'
        }));
        setInvoices(mapped);
    }
    setIsLoading(false);
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
    }
  };

  const totalPaid = invoices
    .filter(i => i.status === 'paid')
    .reduce((sum, i) => sum + i.amount, 0);

  const totalDue = invoices
    .filter(i => i.status !== 'paid')
    .reduce((sum, i) => sum + i.amount, 0);

  const handleDownload = (id: string) => {
    alert(`Téléchargement de la facture ${id}...`);
  };

  const handlePay = (link: string) => {
    if (link && link !== '#') window.open(link, '_blank');
  };

  if (isLoading) {
      return (
          <div className="space-y-8 animate-fade-in-up">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Skeleton className="h-24 w-full rounded-2xl" />
                  <Skeleton className="h-24 w-full rounded-2xl" />
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden p-6 space-y-4">
                  <div className="flex justify-between mb-6">
                     <Skeleton className="h-6 w-32" />
                  </div>
                  {[1, 2, 3, 4].map(i => (
                      <div key={i} className="flex justify-between items-center py-4 border-b border-gray-50 last:border-0">
                          <div className="space-y-2">
                              <Skeleton className="h-4 w-32" />
                              <Skeleton className="h-3 w-20" />
                          </div>
                          <Skeleton className="h-4 w-24 hidden md:block" />
                          <Skeleton className="h-4 w-16" />
                          <Skeleton className="h-6 w-20 rounded-full" />
                          <Skeleton className="h-8 w-8 rounded-lg" />
                      </div>
                  ))}
              </div>
          </div>
      );
  }

  if (invoices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] bg-white/50 rounded-3xl border border-dashed border-slate-300 animate-fade-in-up">
        <div className="p-6 bg-indigo-50 rounded-full mb-6">
          <FileText className="text-indigo-400 w-10 h-10" />
        </div>
        <h3 className="text-lg font-semibold text-slate-800">Aucune facture</h3>
        <p className="text-slate-500 mt-2">Vous n'avez aucune facture pour le moment.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in-up">
      
      {/* Header Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
            <div>
                <p className="text-sm text-gray-500 font-medium">Total Payé</p>
                <p className="text-2xl font-bold text-emerald-600 mt-1">{totalPaid.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                <CheckCircle2 size={20} />
            </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
            <div>
                <p className="text-sm text-gray-500 font-medium">Reste à payer</p>
                <p className="text-2xl font-bold text-gray-800 mt-1">{totalDue.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-600">
                <Euro size={20} />
            </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100">
            <h3 className="font-bold text-gray-800">Toutes les factures</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 text-xs uppercase text-gray-500 font-semibold tracking-wider">
                <th className="px-6 py-4">Numéro & Projet</th>
                <th className="px-6 py-4">Dates</th>
                <th className="px-6 py-4">Montant</th>
                <th className="px-6 py-4">Statut</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {invoices.map((inv) => {
                const style = getStatusStyle(inv.status);
                
                return (
                  <tr key={inv.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-gray-800">{inv.number}</span>
                        <span className="text-sm text-gray-500 mt-0.5">{inv.projectName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col text-sm">
                        <span className="text-gray-700">Émise : {inv.issueDate}</span>
                        <span className="text-gray-400 text-xs mt-0.5">Échéance : {inv.dueDate}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono font-medium text-gray-900">
                        {inv.amount.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${style.bg} ${style.text} ${style.border}`}>
                        {style.icon}
                        {style.label}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                            onClick={() => handleDownload(inv.number)}
                            className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Télécharger PDF"
                        >
                            <Download size={18} />
                        </button>
                        
                        {inv.status !== 'paid' && (
                            <button 
                                onClick={() => handlePay(inv.paymentLink)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-all shadow-sm shadow-indigo-200"
                            >
                                Payer
                                <ExternalLink size={12} />
                            </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default InvoicesPage;
