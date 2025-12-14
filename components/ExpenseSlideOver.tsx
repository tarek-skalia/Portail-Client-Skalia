
import React, { useEffect, useState } from 'react';
import { Expense } from '../types';
import { X, ExternalLink, RefreshCw, CreditCard, Layers, ShieldCheck } from 'lucide-react';
import ExpenseLogo from './ExpenseLogo';

interface ExpenseSlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  expense: Expense | null;
}

const ExpenseSlideOver: React.FC<ExpenseSlideOverProps> = ({ isOpen, onClose, expense }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
        const timer = setTimeout(() => setIsVisible(true), 50);
        return () => clearTimeout(timer);
    } else {
        setIsVisible(false);
    }
  }, [isOpen]);

  // Fonction utilitaire pour garantir que le lien est absolu
  const ensureProtocol = (url: string) => {
      if (!url) return '#';
      if (url.startsWith('http://') || url.startsWith('https://')) return url;
      return `https://${url}`;
  };

  if (!expense) return null;

  const monthlyCost = expense.billingCycle === 'yearly' ? expense.amount / 12 : expense.amount;
  const yearlyCost = expense.billingCycle === 'monthly' ? expense.amount * 12 : expense.amount;

  return (
    <>
      <div 
        className={`fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-[60] transition-opacity duration-300 ${
          isVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      <div 
        className={`fixed inset-y-0 right-0 w-full md:w-[500px] bg-white shadow-2xl z-[70] transform transition-transform duration-300 ease-out flex flex-col ${
          isVisible ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="px-8 pt-8 pb-6 border-b border-slate-100 bg-white shrink-0">
             <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                    <ExpenseLogo 
                        provider={expense.provider} 
                        logoUrl={expense.logoUrl} 
                        websiteUrl={expense.websiteUrl} 
                        className="w-16 h-16"
                    />
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900 leading-tight">{expense.serviceName}</h2>
                        <p className="text-sm font-medium text-slate-500">{expense.provider}</p>
                    </div>
                </div>
                <button 
                    onClick={onClose}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                >
                    <X size={24} />
                </button>
            </div>

            <div className="flex items-center gap-3">
                 <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
                     expense.status === 'active' 
                     ? 'bg-green-50 text-green-700 border-green-100' 
                     : 'bg-slate-50 text-slate-500 border-slate-100'
                 }`}>
                     {expense.status === 'active' ? 'Abonnement Actif' : 'Inactif'}
                 </div>
                 <div className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border bg-slate-50 text-slate-600 border-slate-100">
                     {expense.category || 'Autre'}
                 </div>
            </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-slate-50/50 p-6 md:p-8 space-y-6">
            
            {/* Usage Info */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                    <Layers size={16} className="text-indigo-500" /> Usage dans vos systèmes
                </h3>
                <p className="text-slate-600 text-sm leading-relaxed">
                    {expense.description || "Cet outil est une composante essentielle de votre infrastructure d'automatisation. Il permet de gérer les processus en arrière-plan."}
                </p>
            </div>

            {/* Cost Details */}
             <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <CreditCard size={16} className="text-indigo-500" /> Détails de facturation
                </h3>
                
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-slate-50 border border-slate-100">
                        <p className="text-xs text-slate-400 uppercase font-bold mb-1">Coût Mensuel</p>
                        <p className="text-lg font-bold text-slate-900">
                            {monthlyCost.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                        </p>
                    </div>
                    <div className="p-4 rounded-lg bg-slate-50 border border-slate-100">
                         <p className="text-xs text-slate-400 uppercase font-bold mb-1">Coût Annuel (Est.)</p>
                        <p className="text-lg font-bold text-slate-900">
                             {yearlyCost.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                        </p>
                    </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-sm">
                    {/* MODIFICATION : Remplacement de 'Prochaine échéance' par 'Fréquence de facturation' */}
                    <span className="text-slate-500 flex items-center gap-2">
                        <RefreshCw size={14} /> Fréquence de facturation
                    </span>
                    <span className="font-semibold text-slate-800">
                        {expense.billingCycle === 'monthly' ? 'Mensuelle' : 'Annuelle'}
                    </span>
                </div>
                 <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-slate-500 flex items-center gap-2">
                        <ShieldCheck size={14} /> Statut du service
                    </span>
                    <span className={`font-semibold capitalize ${expense.status === 'active' ? 'text-green-600' : 'text-slate-500'}`}>
                        {expense.status === 'active' ? 'Opérationnel' : 'Arrêté'}
                    </span>
                </div>
            </div>

        </div>

        {/* Footer Actions */}
        {expense.websiteUrl && (
            <div className="p-4 border-t border-slate-200 bg-white shrink-0">
                <a 
                    href={ensureProtocol(expense.websiteUrl)}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                >
                    Accéder au compte <ExternalLink size={16} />
                </a>
            </div>
        )}
      </div>
    </>
  );
};

export default ExpenseSlideOver;
