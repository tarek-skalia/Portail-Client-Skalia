
import React, { useEffect, useState } from 'react';
import { Expense } from '../types';
import { Search, Filter, Layers, RefreshCw, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import Skeleton from './Skeleton';
import ExpenseSlideOver from './ExpenseSlideOver';
import ExpenseLogo from './ExpenseLogo';
import { useAdmin } from './AdminContext';
import Modal from './ui/Modal';
import ExpenseForm from './forms/ExpenseForm';

interface ExpensesPageProps {
  userId?: string;
}

const ExpensesPage: React.FC<ExpensesPageProps> = ({ userId }) => {
  const { isAdminMode } = useAdmin();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // UX State
  const [viewMode, setViewMode] = useState<'monthly' | 'yearly'>('monthly');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  // SlideOver State
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [isSlideOverOpen, setIsSlideOverOpen] = useState(false);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (userId) {
        fetchExpenses();
        const channel = supabase
            .channel('realtime:expenses')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, () => {
                fetchExpenses();
            })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }
  }, [userId]);

  const fetchExpenses = async () => {
    const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('user_id', userId);

    if (error) {
        console.error('Erreur chargement dépenses:', error);
    } else if (data) {
        const mapped: Expense[] = data.map((item: any) => ({
            id: item.id,
            clientId: item.user_id,
            serviceName: item.service_name,
            provider: item.provider || 'Autre',
            category: item.category || 'Software',
            amount: item.amount,
            billingCycle: item.billing_cycle,
            nextBillingDate: item.next_billing_date ? new Date(item.next_billing_date).toLocaleDateString('fr-FR') : 'Non renseignée',
            status: item.status,
            description: item.description,
            websiteUrl: item.website_url,
            logoUrl: item.logo_url
        }));
        setExpenses(mapped);
    }
    setIsLoading(false);
  };

  const filteredExpenses = expenses.filter(exp => {
      const matchesSearch = exp.serviceName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            exp.provider.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || exp.category === selectedCategory;
      return matchesSearch && matchesCategory;
  });

  const calculateCost = (exp: Expense) => {
      if (viewMode === 'monthly') {
          return exp.billingCycle === 'yearly' ? exp.amount / 12 : exp.amount;
      } else {
          return exp.billingCycle === 'monthly' ? exp.amount * 12 : exp.amount;
      }
  };

  const totalCost = filteredExpenses
    .filter(e => e.status === 'active')
    .reduce((sum, e) => sum + calculateCost(e), 0);

  const categories = ['all', ...Array.from(new Set(expenses.map(e => e.category)))];

  const handleCardClick = (expense: Expense) => {
      setSelectedExpense(expense);
      setIsSlideOverOpen(true);
  };

  if (isLoading) {
      return (
          <div className="space-y-8 animate-fade-in-up">
              <Skeleton className="h-32 w-full rounded-2xl" />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[1, 2, 3, 4].map(i => (
                      <Skeleton key={i} className="h-60 w-full rounded-2xl" />
                  ))}
              </div>
          </div>
      );
  }

  return (
    <>
    <div className="space-y-8 animate-fade-in-up pb-10">
        
      {/* HEADER: Total & Toggle */}
      <div className="relative overflow-hidden bg-slate-900 rounded-3xl p-8 text-white shadow-2xl flex flex-col md:flex-row items-center justify-between gap-8 border border-slate-700">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-indigo-600/20 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-purple-600/20 rounded-full blur-[80px] translate-y-1/2 -translate-x-1/2"></div>
        
        <div className="relative z-10">
            <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
                <Layers className="text-indigo-400" />
                Infrastructure & Outils
            </h2>
            <p className="text-slate-400 text-sm max-w-md leading-relaxed">
                Vue consolidée de l'ensemble de vos abonnements SaaS et coûts d'infrastructure gérés par Skalia.
            </p>
        </div>

        <div className="relative z-10 flex flex-col items-end gap-4">
            <div className="bg-slate-800/80 p-1 rounded-xl border border-slate-700 flex items-center">
                <button 
                    onClick={() => setViewMode('monthly')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-300 ${viewMode === 'monthly' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                >
                    Mensuel
                </button>
                <button 
                    onClick={() => setViewMode('yearly')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-300 ${viewMode === 'yearly' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                >
                    Annuel
                </button>
            </div>

            <div className="text-right">
                <p className="text-4xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-300">
                    {totalCost.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
                </p>
                <p className="text-xs text-slate-500 font-medium uppercase tracking-widest mt-1">
                    Estimation {viewMode === 'monthly' ? 'Mensuelle' : 'Annuelle'}
                </p>
            </div>
        </div>
      </div>

      {/* FILTERS & SEARCH */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between sticky top-0 z-20 py-2 bg-slate-50/80 backdrop-blur-sm rounded-xl md:pr-6">
          <div className="flex items-center gap-2 overflow-x-auto max-w-full pb-2 md:pb-0 scrollbar-hide px-6">
              {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wide border transition-all whitespace-nowrap ${
                        selectedCategory === cat 
                        ? 'bg-slate-800 text-white border-slate-800 shadow-md' 
                        : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700'
                    }`}
                  >
                      {cat === 'all' ? 'Tout' : cat}
                  </button>
              ))}
          </div>

          <div className="flex gap-4 w-full md:w-auto px-6 md:px-0">
                <div className="relative w-full md:w-64">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Search size={16} />
                    </div>
                    <input 
                        type="text" 
                        placeholder="Rechercher un outil..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
                    />
                </div>
                {isAdminMode && (
                  <button 
                    onClick={() => setIsModalOpen(true)}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-xl shadow-sm hover:bg-indigo-700 flex items-center gap-2 text-sm font-bold whitespace-nowrap"
                  >
                      <Plus size={16} /> Ajouter
                  </button>
                )}
          </div>
      </div>

      {/* GRID */}
      {filteredExpenses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-slate-200">
             <Filter className="text-slate-300 w-12 h-12 mb-4" />
             <p className="text-slate-500">Aucun outil trouvé pour cette recherche.</p>
          </div>
      ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredExpenses.map((expense) => {
                const cost = calculateCost(expense);
                
                return (
                    <div 
                        key={expense.id}
                        onClick={() => handleCardClick(expense)}
                        className={`
                            relative bg-white rounded-2xl p-6 border transition-all duration-300 cursor-pointer group overflow-hidden
                            ${expense.status === 'active' 
                                ? 'border-slate-200 hover:border-indigo-300 hover:shadow-xl hover:shadow-indigo-100/50 hover:-translate-y-1' 
                                : 'border-slate-100 opacity-75 grayscale hover:grayscale-0'
                            }
                        `}
                    >
                        <div className={`absolute top-6 right-6 w-2.5 h-2.5 rounded-full ${expense.status === 'active' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-300'}`}></div>

                        <div className="flex items-start gap-4 mb-6">
                            <ExpenseLogo 
                                provider={expense.provider} 
                                logoUrl={expense.logoUrl} 
                                websiteUrl={expense.websiteUrl} 
                                className="w-14 h-14" 
                            />
                            
                            <div className="flex-1 min-w-0 pt-1">
                                <h3 className="font-bold text-slate-900 truncate pr-4">{expense.serviceName}</h3>
                                <p className="text-xs text-slate-500 font-medium">{expense.provider}</p>
                            </div>
                        </div>

                        <div className="mb-6">
                             <p className="text-3xl font-extrabold text-slate-900 tracking-tight">
                                {cost.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                             </p>
                             <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                Coût estimé {viewMode === 'monthly' ? 'par mois' : 'par an'}
                             </p>
                        </div>

                        <div className="pt-4 border-t border-slate-50 flex items-center justify-between text-xs font-medium text-slate-500">
                            <div className="flex items-center gap-1.5 text-slate-500">
                                <RefreshCw size={12} className="text-slate-400" />
                                <span>
                                    {expense.billingCycle === 'monthly' ? 'Renouvellement Mensuel' : 'Renouvellement Annuel'}
                                </span>
                            </div>
                            
                            <div className="px-2 py-1 rounded-md bg-slate-50 border border-slate-100 text-slate-600 font-semibold truncate max-w-[100px]">
                                {expense.category}
                            </div>
                        </div>
                        <div className="absolute inset-0 bg-indigo-600/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                    </div>
                );
            })}
          </div>
      )}
    </div>

    <ExpenseSlideOver 
        isOpen={isSlideOverOpen}
        onClose={() => setIsSlideOverOpen(false)}
        expense={selectedExpense}
    />

    <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Nouvelle Dépense">
        <ExpenseForm onSuccess={() => { setIsModalOpen(false); fetchExpenses(); }} onCancel={() => setIsModalOpen(false)} />
    </Modal>
    </>
  );
};

export default ExpensesPage;
