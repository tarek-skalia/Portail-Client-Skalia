
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ToastProvider';
import { useAdmin } from '../AdminContext';
import { Plus, Trash2, Calculator, Save, User, FileText, Calendar, Lock, Users, UserPlus, RefreshCw, Layers, DollarSign } from 'lucide-react';
import { Lead } from '../../types';

interface QuoteFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  initialData?: any | null;
}

const QuoteForm: React.FC<QuoteFormProps> = ({ onSuccess, onCancel, initialData }) => {
  const { targetUserId, clients } = useAdmin();
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  // Data Loading (Leads)
  const [leads, setLeads] = useState<Lead[]>([]);

  // Mode Selection
  const [clientMode, setClientMode] = useState<'existing' | 'prospect'>('existing');

  // Existing Client Selection
  const availableClients = clients.filter(c => c.role !== 'admin');
  const [selectedClientId, setSelectedClientId] = useState(() => {
      if (initialData?.profile_id) return initialData.profile_id;
      if (availableClients.length > 0) return availableClients[0].id;
      return '';
  });

  // Prospect Fields
  const [prospectName, setProspectName] = useState('');
  const [prospectEmail, setProspectEmail] = useState('');
  const [prospectCompany, setProspectCompany] = useState('');
  const [selectedLeadId, setSelectedLeadId] = useState('');

  // Quote Fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('draft');
  const [validUntil, setValidUntil] = useState('');
  
  // Items
  const [items, setItems] = useState([
      { description: 'Mise en place automatisation', quantity: 1, unit_price: 1500, billing_frequency: 'once' }
  ]);

  // Payment Terms
  const [paymentTermsType, setPaymentTermsType] = useState<'100_percent' | '50_50' | '30_70' | 'custom'>('100_percent');

  // Load Leads for Prospect Mode
  useEffect(() => {
      const fetchLeads = async () => {
          const { data } = await supabase.from('crm_leads').select('*').neq('status', 'won').neq('status', 'lost');
          if (data) setLeads(data);
      };
      fetchLeads();
  }, []);

  // Initialisation Data
  useEffect(() => {
      if (initialData) {
          setTitle(initialData.title);
          setDescription(initialData.description || '');
          setStatus(initialData.status);
          setValidUntil(initialData.valid_until ? initialData.valid_until.split('T')[0] : '');
          
          if (initialData.profile_id) {
              setClientMode('existing');
              setSelectedClientId(initialData.profile_id);
          } else {
              setClientMode('prospect');
              setProspectName(initialData.recipient_name || '');
              setProspectEmail(initialData.recipient_email || '');
              setProspectCompany(initialData.recipient_company || '');
          }

          if (initialData.items) {
              setItems(initialData.items.map((i: any) => ({
                  description: i.description,
                  quantity: i.quantity,
                  unit_price: i.unit_price,
                  billing_frequency: i.billing_frequency || 'once'
              })));
          }

          if (initialData.payment_terms) {
              setPaymentTermsType(initialData.payment_terms.type || '100_percent');
          }
      } else {
          // Default validity: 30 days
          const d = new Date();
          d.setDate(d.getDate() + 30);
          setValidUntil(d.toISOString().split('T')[0]);
      }
  }, [initialData]);

  // Lead Selection Handler
  const handleLeadSelect = (leadId: string) => {
      setSelectedLeadId(leadId);
      const lead = leads.find(l => l.id === leadId);
      if (lead) {
          setProspectName(`${lead.first_name} ${lead.last_name}`);
          setProspectEmail(lead.email);
          setProspectCompany(lead.company);
      }
  };

  const handleAddItem = () => setItems([...items, { description: '', quantity: 1, unit_price: 0, billing_frequency: 'once' }]);
  const handleRemoveItem = (index: number) => setItems(items.filter((_, i) => i !== index));
  
  const updateItem = (index: number, field: string, value: any) => {
      const newItems = [...items];
      (newItems[index] as any)[field] = value;
      setItems(newItems);
  };

  const totalAmount = items.reduce((acc, item) => acc + (item.quantity * item.unit_price), 0);
  const oneShotTotal = items.filter(i => i.billing_frequency === 'once').reduce((acc, i) => acc + (i.quantity * i.unit_price), 0);
  const monthlyTotal = items.filter(i => i.billing_frequency === 'monthly').reduce((acc, i) => acc + (i.quantity * i.unit_price), 0);

  // Calcul Acompte
  let depositAmount = oneShotTotal; // Par défaut 100% du one shot
  if (paymentTermsType === '50_50') depositAmount = oneShotTotal * 0.5;
  if (paymentTermsType === '30_70') depositAmount = oneShotTotal * 0.3;

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);

      try {
          let quoteId = initialData?.id;

          const quotePayload = {
              profile_id: clientMode === 'existing' ? selectedClientId : null,
              recipient_email: clientMode === 'prospect' ? prospectEmail : null,
              recipient_name: clientMode === 'prospect' ? prospectName : null,
              recipient_company: clientMode === 'prospect' ? prospectCompany : null,
              title,
              description,
              status,
              valid_until: validUntil || null,
              total_amount: totalAmount,
              payment_terms: { type: paymentTermsType },
              updated_at: new Date().toISOString()
          };

          if (quoteId) {
              await supabase.from('quotes').update(quotePayload).eq('id', quoteId);
              await supabase.from('quote_items').delete().eq('quote_id', quoteId);
          } else {
              const { data, error } = await supabase.from('quotes').insert({
                  ...quotePayload,
                  public_token: Math.random().toString(36).substring(2, 15), // Basic token gen
                  created_at: new Date().toISOString()
              }).select().single();
              
              if (error) throw error;
              quoteId = data.id;
          }

          if (quoteId && items.length > 0) {
              const itemsPayload = items.map(item => ({
                  quote_id: quoteId,
                  description: item.description,
                  quantity: item.quantity,
                  unit_price: item.unit_price,
                  billing_frequency: item.billing_frequency
              }));
              await supabase.from('quote_items').insert(itemsPayload);
          }

          toast.success("Succès", initialData ? "Devis mis à jour." : "Devis créé avec succès.");
          onSuccess();

      } catch (err: any) {
          toast.error("Erreur", err.message);
      } finally {
          setLoading(false);
      }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pt-2">
        
        {/* --- SECTION DESTINATAIRE --- */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
            
            {/* Mode Toggle */}
            <div className="flex bg-white p-1 rounded-lg border border-slate-200 shadow-sm w-full">
                <button
                    type="button"
                    onClick={() => setClientMode('existing')}
                    className={`flex-1 py-2 text-sm font-bold rounded-md flex items-center justify-center gap-2 transition-all ${
                        clientMode === 'existing' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                    <Users size={16} /> Client Existant
                </button>
                <button
                    type="button"
                    onClick={() => setClientMode('prospect')}
                    className={`flex-1 py-2 text-sm font-bold rounded-md flex items-center justify-center gap-2 transition-all ${
                        clientMode === 'prospect' ? 'bg-emerald-50 text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                    <UserPlus size={16} /> Nouveau Prospect
                </button>
            </div>

            {/* Existing Client Select */}
            {clientMode === 'existing' && (
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Sélectionner le client</label>
                    <div className="relative">
                        <select
                            value={selectedClientId}
                            onChange={(e) => setSelectedClientId(e.target.value)}
                            className="w-full pl-3 pr-8 py-2.5 bg-white border border-slate-300 rounded-lg text-sm font-bold outline-none appearance-none focus:ring-2 focus:ring-indigo-500"
                        >
                            {availableClients.map(client => (
                                <option key={client.id} value={client.id}>{client.company} ({client.name})</option>
                            ))}
                        </select>
                        <Lock size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                </div>
            )}

            {/* Prospect Fields */}
            {clientMode === 'prospect' && (
                <div className="space-y-4 animate-fade-in">
                    {/* CRM Import */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Importer depuis CRM (Optionnel)</label>
                        <select 
                            value={selectedLeadId}
                            onChange={(e) => handleLeadSelect(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                            <option value="">-- Choisir un lead --</option>
                            {leads.map(lead => (
                                <option key={lead.id} value={lead.id}>{lead.company || 'Sans société'} - {lead.first_name} {lead.last_name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nom Complet</label>
                            <input 
                                type="text" 
                                required={clientMode === 'prospect'}
                                value={prospectName} 
                                onChange={e => setProspectName(e.target.value)} 
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" 
                                placeholder="Jean Dupont" 
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email (Important)</label>
                            <input 
                                type="email" 
                                required={clientMode === 'prospect'}
                                value={prospectEmail} 
                                onChange={e => setProspectEmail(e.target.value)} 
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" 
                                placeholder="jean@exemple.com" 
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Société</label>
                        <input 
                            type="text" 
                            value={prospectCompany} 
                            onChange={e => setProspectCompany(e.target.value)} 
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" 
                            placeholder="Entreprise SAS" 
                        />
                    </div>
                </div>
            )}
        </div>

        {/* --- INFO DEVIS --- */}
        <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Titre du projet</label>
                <input type="text" required value={title} onChange={e => setTitle(e.target.value)} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Ex: Refonte Automatisation" />
            </div>
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Statut</label>
                <select value={status} onChange={e => setStatus(e.target.value)} className="w-full px-3 py-2 border rounded-lg outline-none bg-white">
                    <option value="draft">Brouillon</option>
                    <option value="sent">Envoyé</option>
                    <option value="signed">Signé</option>
                    <option value="rejected">Refusé</option>
                </select>
            </div>
        </div>

        <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description (Intro)</label>
            <textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} className="w-full px-3 py-2 border rounded-lg outline-none" placeholder="Contexte du projet..." />
        </div>

        <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date de validité</label>
                <input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} className="w-full px-3 py-2 border rounded-lg outline-none" />
            </div>
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Conditions Paiement (Setup)</label>
                <select value={paymentTermsType} onChange={e => setPaymentTermsType(e.target.value as any)} className="w-full px-3 py-2 border rounded-lg outline-none bg-white">
                    <option value="100_percent">100% à la commande</option>
                    <option value="50_50">Acompte 50% / Solde 50%</option>
                    <option value="30_70">Acompte 30% / Solde 70%</option>
                </select>
            </div>
        </div>

        {/* --- ITEMS --- */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                <span className="text-xs font-bold text-slate-600 uppercase">Prestations</span>
                <button type="button" onClick={handleAddItem} className="text-xs font-bold text-indigo-600 flex items-center gap-1"><Plus size={12} /> Ajouter ligne</button>
            </div>
            <div className="p-2 space-y-2">
                {items.map((item, idx) => (
                    <div key={idx} className="flex gap-2 items-start bg-slate-50/50 p-2 rounded-lg border border-slate-100">
                        <div className="flex-1 space-y-2">
                            <input 
                                type="text" 
                                placeholder="Description" 
                                value={item.description} 
                                onChange={e => updateItem(idx, 'description', e.target.value)} 
                                className="w-full px-3 py-1.5 text-sm border rounded outline-none focus:border-indigo-500" 
                            />
                            <div className="flex gap-2">
                                <select 
                                    value={item.billing_frequency}
                                    onChange={e => updateItem(idx, 'billing_frequency', e.target.value)}
                                    className={`text-xs font-bold py-1.5 px-2 rounded border outline-none ${
                                        item.billing_frequency === 'once' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                                        item.billing_frequency === 'monthly' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                        'bg-purple-50 text-purple-700 border-purple-200'
                                    }`}
                                >
                                    <option value="once">Une fois (Setup)</option>
                                    <option value="monthly">Mensuel</option>
                                    <option value="yearly">Annuel</option>
                                </select>
                                <input 
                                    type="number" placeholder="Qté" value={item.quantity} 
                                    onChange={e => updateItem(idx, 'quantity', parseFloat(e.target.value))} 
                                    className="w-16 px-2 py-1.5 text-sm border rounded outline-none text-center" 
                                />
                                <input 
                                    type="number" placeholder="Prix" value={item.unit_price} 
                                    onChange={e => updateItem(idx, 'unit_price', parseFloat(e.target.value))} 
                                    className="w-24 px-2 py-1.5 text-sm border rounded outline-none text-right font-mono" 
                                />
                            </div>
                        </div>
                        <button type="button" onClick={() => handleRemoveItem(idx)} className="p-2 text-slate-400 hover:text-red-500 mt-1"><Trash2 size={16} /></button>
                    </div>
                ))}
            </div>
            
            {/* RÉCAPITULATIF FINANCIER */}
            <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 text-sm">
                <div className="flex justify-between items-center mb-1 text-slate-500">
                    <span>Total One-Shot (Setup)</span>
                    <span className="font-mono">{oneShotTotal.toLocaleString()} €</span>
                </div>
                {monthlyTotal > 0 && (
                    <div className="flex justify-between items-center mb-2 text-amber-600 font-bold">
                        <span className="flex items-center gap-1"><RefreshCw size={12} /> Récurrent Mensuel</span>
                        <span className="font-mono">{monthlyTotal.toLocaleString()} € /mois</span>
                    </div>
                )}
                
                <div className="border-t border-slate-200 pt-2 mt-2 flex justify-between items-center">
                    <span className="font-bold text-slate-700 uppercase text-xs">Acompte à payer (Dû immédiat)</span>
                    <span className="text-lg font-black text-indigo-600 flex items-center gap-2">
                        <Calculator size={16} /> 
                        {(depositAmount + monthlyTotal).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                    </span>
                </div>
                <p className="text-[10px] text-right text-slate-400 mt-1 italic">
                    (Inclus: {depositAmount.toLocaleString()}€ d'acompte + 1er mois d'abo)
                </p>
            </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg">Annuler</button>
            <button type="submit" disabled={loading} className="px-6 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-md flex items-center gap-2">
                {loading ? 'Enregistrement...' : <><Save size={16} /> {initialData ? 'Mettre à jour' : 'Créer le devis'}</>}
            </button>
        </div>
    </form>
  );
};

export default QuoteForm;
