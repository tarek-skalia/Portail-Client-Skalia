
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ToastProvider';
import { useAdmin } from '../AdminContext';
import { Expense } from '../../types';
import { Users, User, Lock } from 'lucide-react';

interface ExpenseFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  initialData?: Expense | null;
}

const ExpenseForm: React.FC<ExpenseFormProps> = ({ onSuccess, onCancel, initialData }) => {
  const { targetUserId, isAdmin, clients } = useAdmin();
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  // Filtrer les clients (exclure l'admin)
  const availableClients = clients.filter(c => c.role !== 'admin');

  // Détecter si on est en "Mode Contextuel" (Vue Client spécifique)
  const currentViewedClient = clients.find(c => c.id === targetUserId);
  const isContextualMode = currentViewedClient && currentViewedClient.role !== 'admin';

  // Le champ est verrouillé si : Mode Contextuel OU Mode Édition
  const isClientLocked = isContextualMode || !!initialData;

  // Client Selection
  const [selectedClientId, setSelectedClientId] = useState(() => {
      if (initialData) return initialData.clientId;
      
      // Si on est en mode contextuel, on force le client actuel
      if (isContextualMode) return targetUserId;

      // Sinon (Vue Global), on prend le premier de la liste par défaut
      if (availableClients.length > 0) {
          return availableClients[0].id;
      }
      return targetUserId;
  });

  // Fields
  const [serviceName, setServiceName] = useState('');
  const [provider, setProvider] = useState('');
  const [amount, setAmount] = useState(0);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [category, setCategory] = useState('Software');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [websiteUrl, setWebsiteUrl] = useState('');

  // Initialisation
  useEffect(() => {
      if (initialData) {
          setSelectedClientId(initialData.clientId);
          setServiceName(initialData.serviceName);
          setProvider(initialData.provider);
          setAmount(initialData.amount);
          setBillingCycle(initialData.billingCycle);
          setCategory(initialData.category);
          setStatus(initialData.status);
          setWebsiteUrl(initialData.websiteUrl || '');
      }
  }, [initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);

      const payload = {
          user_id: selectedClientId,
          service_name: serviceName,
          provider,
          amount,
          billing_cycle: billingCycle,
          category,
          status,
          website_url: websiteUrl
      };

      try {
          if (initialData) {
              // UPDATE
              const { error } = await supabase
                .from('expenses')
                .update(payload)
                .eq('id', initialData.id);
              if (error) throw error;
              toast.success("Mis à jour", "Dépense modifiée.");
          } else {
              // INSERT
              const { error } = await supabase.from('expenses').insert({
                  ...payload,
                  created_at: new Date().toISOString()
              });
              if (error) throw error;
              toast.success("Ajouté", "L'abonnement a été ajouté au dossier client.");
          }
          
          onSuccess();

      } catch (err: any) {
          toast.error("Erreur", err.message);
      } finally {
          setLoading(false);
      }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* CLIENT SELECTOR (ADMIN ONLY) */}
        {isAdmin && (
            <div className={`p-4 rounded-xl border ${isClientLocked ? 'bg-slate-100 border-slate-200' : 'bg-indigo-50/50 border-indigo-100'}`}>
                <label className={`block text-xs font-bold uppercase mb-2 flex items-center gap-2 ${isClientLocked ? 'text-slate-500' : 'text-indigo-600'}`}>
                    {isClientLocked ? <Lock size={14} /> : <Users size={14} />} 
                    {isClientLocked ? 'Client (Verrouillé)' : 'Dépense pour le client'}
                </label>
                <div className="relative">
                    <select
                        value={selectedClientId}
                        onChange={(e) => setSelectedClientId(e.target.value)}
                        disabled={isClientLocked}
                        className={`w-full pl-3 pr-8 py-2.5 rounded-lg text-sm font-bold outline-none appearance-none transition-colors ${
                            isClientLocked 
                            ? 'bg-slate-200 text-slate-500 cursor-not-allowed border border-slate-300' 
                            : 'bg-white border border-indigo-200 text-slate-700 focus:ring-2 focus:ring-indigo-500 cursor-pointer hover:border-indigo-300'
                        }`}
                    >
                        {availableClients.map(client => (
                            <option key={client.id} value={client.id}>
                                {client.company} ({client.name})
                            </option>
                        ))}
                    </select>
                    <div className={`absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none ${isClientLocked ? 'text-slate-400' : 'text-indigo-500'}`}>
                        {isClientLocked ? <Lock size={16} /> : <User size={16} />}
                    </div>
                </div>
            </div>
        )}

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
                    value={billingCycle} onChange={e => setBillingCycle(e.target.value as any)}
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
                    value={status} onChange={e => setStatus(e.target.value as any)}
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
                {loading ? 'Enregistrement...' : (initialData ? 'Mettre à jour' : 'Ajouter Dépense')}
            </button>
        </div>
    </form>
  );
};

export default ExpenseForm;
