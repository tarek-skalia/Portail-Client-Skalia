
import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ToastProvider';
import { useAdmin } from '../AdminContext';

interface ExpenseFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

const ExpenseForm: React.FC<ExpenseFormProps> = ({ onSuccess, onCancel }) => {
  const { targetUserId } = useAdmin();
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  // Fields
  const [serviceName, setServiceName] = useState('');
  const [provider, setProvider] = useState('');
  const [amount, setAmount] = useState(0);
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [category, setCategory] = useState('Software');
  const [status, setStatus] = useState('active');
  const [websiteUrl, setWebsiteUrl] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);

      try {
          const { error } = await supabase.from('expenses').insert({
              user_id: targetUserId,
              service_name: serviceName,
              provider,
              amount,
              billing_cycle: billingCycle,
              category,
              status,
              website_url: websiteUrl,
              created_at: new Date().toISOString()
          });

          if (error) throw error;
          
          toast.success("Ajouté", "L'abonnement a été ajouté au client.");
          onSuccess();

      } catch (err: any) {
          toast.error("Erreur", err.message);
      } finally {
          setLoading(false);
      }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
        
        <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nom du service</label>
                <input 
                    type="text" required value={serviceName} onChange={e => setServiceName(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" 
                    placeholder="Ex: Make Pro"
                />
            </div>
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Fournisseur</label>
                <input 
                    type="text" required value={provider} onChange={e => setProvider(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" 
                    placeholder="Ex: Celonis"
                />
            </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Montant</label>
                <input 
                    type="number" required value={amount} onChange={e => setAmount(parseFloat(e.target.value))}
                    className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" 
                />
            </div>
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cycle</label>
                <select 
                    value={billingCycle} onChange={e => setBillingCycle(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg outline-none bg-white"
                >
                    <option value="monthly">Mensuel</option>
                    <option value="yearly">Annuel</option>
                </select>
            </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Catégorie</label>
                <input 
                    type="text" value={category} onChange={e => setCategory(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg outline-none" 
                    placeholder="Automation, AI, Hosting..."
                />
            </div>
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Statut</label>
                <select 
                    value={status} onChange={e => setStatus(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg outline-none bg-white"
                >
                    <option value="active">Actif</option>
                    <option value="inactive">Inactif</option>
                </select>
            </div>
        </div>

        <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Site Web (pour le logo auto)</label>
            <input 
                type="text" value={websiteUrl} onChange={e => setWebsiteUrl(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg outline-none" 
                placeholder="https://make.com"
            />
        </div>

        <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
            <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg">Annuler</button>
            <button type="submit" disabled={loading} className="px-6 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-md disabled:opacity-50">
                {loading ? 'Ajout...' : 'Ajouter Dépense'}
            </button>
        </div>
    </form>
  );
};

export default ExpenseForm;
