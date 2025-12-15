
import React, { useEffect, useState } from 'react';
import { Invoice, InvoiceItem } from '../types';
import { X, CheckCircle2, AlertCircle, Clock, Download, ExternalLink, Hash, Calendar, FileText, CreditCard } from 'lucide-react';
import { useToast } from './ToastProvider';
import Logo from './Logo';

interface InvoiceSlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
}

const InvoiceSlideOver: React.FC<InvoiceSlideOverProps> = ({ isOpen, onClose, invoice }) => {
  const [isVisible, setIsVisible] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (isOpen) {
        const timer = setTimeout(() => setIsVisible(true), 50);
        return () => clearTimeout(timer);
    } else {
        setIsVisible(false);
    }
  }, [isOpen]);

  if (!invoice) return null;

  const handleDownload = () => {
    if (invoice.pdfUrl && invoice.pdfUrl !== '#') {
        window.open(invoice.pdfUrl, '_blank');
        toast.success("Téléchargement lancé", "Votre facture est en cours de téléchargement.");
    } else {
        toast.info("Indisponible", "Le PDF n'est pas encore disponible.");
    }
  };

  const handlePay = () => {
    if (invoice.paymentLink && invoice.paymentLink !== '#') {
        window.open(invoice.paymentLink, '_blank');
    } else {
        toast.error("Lien manquant", "Aucun lien de paiement associé.");
    }
  };

  const getStatusConfig = (status: string) => {
      switch(status) {
          case 'paid': return { color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100', icon: <CheckCircle2 size={18} />, label: 'Payée' };
          case 'pending': return { color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100', icon: <Clock size={18} />, label: 'En attente' };
          case 'overdue': return { color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100', icon: <AlertCircle size={18} />, label: 'En retard' };
          default: return { color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-100', icon: <Clock size={18} />, label: status };
      }
  };

  const statusConfig = getStatusConfig(invoice.status);

  // Calcul des totaux
  // Si les items existent, on les utilise. Sinon on fallback sur une ligne générique.
  const items = invoice.items && invoice.items.length > 0 ? invoice.items : [
      { description: `Prestation : ${invoice.projectName}`, quantity: 1, unit_price: invoice.amount }
  ];

  const subTotal = items.reduce((acc, item) => acc + (item.unit_price * item.quantity), 0);
  
  // CORRECTION TVA : On utilise le taux défini, sinon 0. On utilise '??' pour ne pas écraser le 0 par défaut.
  const taxRate = invoice.taxRate ?? 0;
  
  const taxAmount = (subTotal * taxRate) / 100;
  const totalCalculated = subTotal + taxAmount;

  // On vérifie si le montant calculé correspond à peu près au montant total stocké (pour gérer les arrondis ou TVA incluse)
  // Si l'écart est trop grand, on affiche le montant stocké 'amount' comme Total TTC officiel.
  const displayTotal = Math.abs(totalCalculated - invoice.amount) < 1 ? totalCalculated : invoice.amount;

  return (
    <>
      <div 
        className={`fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-[60] transition-opacity duration-300 ${
          isVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      <div 
        className={`fixed inset-y-0 right-0 w-full md:w-[600px] bg-white shadow-2xl z-[70] transform transition-transform duration-300 ease-out flex flex-col ${
          isVisible ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* HEADER */}
        <div className="px-8 pt-8 pb-6 border-b border-slate-100 bg-white shrink-0">
            <div className="flex items-start justify-between mb-6">
                <div>
                     <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border mb-4 ${statusConfig.bg} ${statusConfig.color} ${statusConfig.border}`}>
                        {statusConfig.icon}
                        {statusConfig.label}
                     </div>
                     <h2 className="text-2xl font-bold text-slate-900">{invoice.number}</h2>
                     <p className="text-slate-500 font-medium text-sm mt-1">{invoice.projectName}</p>
                </div>
                <button 
                    onClick={onClose}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                >
                    <X size={24} />
                </button>
            </div>

            {/* Actions Rapides */}
            <div className="flex gap-3">
                 <button 
                    onClick={handleDownload}
                    className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 hover:border-slate-300 hover:text-indigo-600 transition-all flex items-center justify-center gap-2 shadow-sm text-sm"
                 >
                    <Download size={16} /> Télécharger
                 </button>
                 {invoice.status !== 'paid' && (
                     <button 
                        onClick={handlePay}
                        className="flex-1 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-md shadow-indigo-200 text-sm"
                     >
                        <CreditCard size={16} /> Payer maintenant
                     </button>
                 )}
            </div>
        </div>

        {/* CONTENT (Paper Style) */}
        <div className="flex-1 overflow-y-auto bg-slate-50/50 p-6 md:p-8">
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                
                {/* Invoice Header Details */}
                <div className="p-6 grid grid-cols-2 gap-6 border-b border-slate-100 bg-slate-50/30">
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                            <Calendar size={12} /> Date d'émission
                        </p>
                        <p className="text-sm font-semibold text-slate-800">{invoice.issueDate}</p>
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                            <Clock size={12} /> Échéance
                        </p>
                        <p className={`text-sm font-semibold ${invoice.status === 'overdue' ? 'text-red-600' : 'text-slate-800'}`}>
                            {invoice.dueDate}
                        </p>
                    </div>
                </div>

                {/* Items Table */}
                <div className="p-6">
                    <h3 className="text-sm font-bold text-slate-800 mb-4">Détails de la facturation</h3>
                    <div className="overflow-hidden rounded-lg border border-slate-100">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 text-slate-500 font-medium">
                                <tr>
                                    <th className="px-4 py-3 font-semibold">Description</th>
                                    <th className="px-4 py-3 text-center font-semibold w-20">Qté</th>
                                    <th className="px-4 py-3 text-right font-semibold w-32">Total HT</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {items.map((item, idx) => (
                                    <tr key={idx}>
                                        <td className="px-4 py-3 text-slate-700">{item.description}</td>
                                        <td className="px-4 py-3 text-center text-slate-500">{item.quantity}</td>
                                        <td className="px-4 py-3 text-right text-slate-700 font-mono">
                                            {(item.unit_price * item.quantity).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Totaux */}
                    <div className="mt-6 flex justify-end">
                        <div className="w-64 space-y-3">
                            <div className="flex justify-between text-slate-500 text-sm">
                                <span>Sous-total HT</span>
                                <span>{subTotal.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</span>
                            </div>
                            <div className="flex justify-between text-slate-500 text-sm">
                                <span>TVA ({taxRate}%)</span>
                                <span>{taxAmount.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</span>
                            </div>
                            <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
                                <span className="font-bold text-slate-800">Total TTC</span>
                                <span className="font-bold text-xl text-indigo-600">
                                    {displayTotal.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Note */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 text-xs text-slate-400 text-center">
                    Merci de votre confiance. Pour toute question concernant cette facture, contactez le support.
                </div>
            </div>
        </div>

      </div>
    </>
  );
};

export default InvoiceSlideOver;
