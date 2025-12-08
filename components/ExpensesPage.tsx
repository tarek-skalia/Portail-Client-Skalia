
import React, { useEffect, useState } from 'react';
import { Expense } from '../types';
import { CreditCard, Calendar, Server, Cpu, Globe, Zap, Box, Database, Activity } from 'lucide-react';
import { supabase } from '../lib/supabase';
import Skeleton from './Skeleton';

interface ExpensesPageProps {
  userId?: string;
}

const ExpensesPage: React.FC<ExpensesPageProps> = ({ userId }) => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (userId) {
        fetchExpenses();

        const channel = supabase
            .channel('realtime:expenses')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, () => {
                fetchExpenses();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
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
            amount: item.amount,
            billingCycle: item.billing_cycle,
            nextBillingDate: item.next_billing_date ? new Date(item.next_billing_date).toLocaleDateString('fr-FR') : '-',
            status: item.status
        }));
        setExpenses(mapped);
    }
    setIsLoading(false);
  };

  const totalMonthly = expenses
    .filter(e => e.status === 'active')
    .reduce((sum, e) => {
        if (e.billingCycle === 'yearly') return sum + (e.amount / 12);
        return sum + e.amount;
    }, 0);

  const getIcon = (provider: string) => {
    const p = provider.toLowerCase();
    if (p.includes('openai') || p.includes('gpt')) return <Cpu />;
    if (p.includes('make') || p.includes('zapier')) return <Zap />;
    if (p.includes('airtable') || p.includes('database')) return <Database />;
    if (p.includes('hosting') || p.includes('digitalocean') || p.includes('aws')) return <Server />;
    return <Box />;
  };

  if (isLoading) {
      return (
          <div className="space-y-8 animate-fade-in-up">
              <Skeleton className="h-24 w-full rounded-2xl" />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[1, 2, 3].map(i => (
                      <div key={i} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm h-56 flex flex-col justify-between">
                          <div className="flex justify-between">
                              <Skeleton className="w-12 h-12 rounded-xl" />
                              <Skeleton className="w-12 h-6 rounded-md" />
                          </div>
                          <div className="space-y-2">
                              <Skeleton className="h-5 w-3/4" />
                              <Skeleton className="h-3 w-1/2" />
                          </div>
                          <div className="pt-4 border-t border-gray-50 flex justify-between items-end">
                              <div className="space-y-1">
                                  <Skeleton className="h-3 w-20" />
                                  <Skeleton className="h-4 w-24" />
                              </div>
                              <Skeleton className="h-8 w-16" />
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      );
  }

  if (expenses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] bg-white/50 rounded-3xl border border-dashed border-slate-300 animate-fade-in-up">
        <div className="p-6 bg-indigo-50 rounded-full mb-6">
          <CreditCard className="text-indigo-400 w-10 h-10" />
        </div>
        <h3 className="text-lg font-semibold text-slate-800">Aucune dépense</h3>
        <p className="text-slate-500 mt-2">Aucun abonnement actif enregistré.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in-up">
        
      {/* Summary Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
            <h2 className="text-xl font-bold mb-1">Coût des outils tiers</h2>
            <p className="text-slate-400 text-sm">Total estimé de vos abonnements (API, Serveurs, SaaS)</p>
        </div>
        <div className="flex items-center gap-4 bg-white/10 px-6 py-3 rounded-xl border border-white/10 backdrop-blur-sm">
            <div className="text-right">
                <p className="text-xs text-slate-300 uppercase font-bold tracking-wider">Mensuel</p>
                <p className="text-2xl font-bold">{totalMonthly.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</p>
            </div>
            <div className="w-10 h-10 bg-indigo-500 rounded-full flex items-center justify-center shadow-lg shadow-indigo-500/30">
                <Activity size={20} />
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {expenses.map((expense, index) => (
            <div 
                key={expense.id}
                className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-300 group"
            >
                <div className="flex items-start justify-between mb-6">
                    <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-300">
                        {getIcon(expense.provider)}
                    </div>
                    <span className={`px-2 py-1 rounded-md text-[10px] uppercase font-bold tracking-wide border ${
                        expense.status === 'active' 
                        ? 'bg-green-50 text-green-700 border-green-100' 
                        : 'bg-gray-50 text-gray-500 border-gray-100'
                    }`}>
                        {expense.status === 'active' ? 'Actif' : 'Inactif'}
                    </span>
                </div>

                <h3 className="font-bold text-gray-900 text-lg mb-1">{expense.serviceName}</h3>
                <p className="text-sm text-gray-500 mb-6 flex items-center gap-1">
                    Fournisseur : {expense.provider}
                </p>

                <div className="pt-6 border-t border-gray-50 flex items-end justify-between">
                    <div>
                        <p className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                            <Calendar size={12} />
                            Prochain paiement
                        </p>
                        <p className="text-sm font-medium text-gray-700">{expense.nextBillingDate}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-2xl font-bold text-gray-900">
                            {expense.amount.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                        </p>
                        <p className="text-[10px] text-gray-400 font-medium uppercase">
                            /{expense.billingCycle === 'monthly' ? 'mois' : 'an'}
                        </p>
                    </div>
                </div>
            </div>
        ))}
      </div>
    </div>
  );
};

export default ExpensesPage;
