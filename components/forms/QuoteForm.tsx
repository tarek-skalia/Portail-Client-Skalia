
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ToastProvider';
import { useAdmin } from '../AdminContext';
import { Plus, Trash2, Calculator, Save, User, FileText, Calendar, Lock, Users, UserPlus, RefreshCw, Layers, DollarSign, MapPin, Hash, Percent, Clock, Briefcase, Infinity, UserCircle } from 'lucide-react';
import { Lead } from '../../types';

interface QuoteFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  initialData?: any | null;
}

// Nettoyage strict des UUIDs
const cleanUuid = (id: any): string | null => {
    if (!id) return null;
    const str = String(id).trim();
    if (str === '' || str === 'undefined' || str === 'null') return null;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str) ? str : null;
};

// Générateur UUID v4 compatible tous navigateurs
const generateUUID = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

const QuoteForm: React.FC<QuoteFormProps> = ({ onSuccess, onCancel, initialData }) => {
  const { targetUserId, clients } = useAdmin();
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  
  // --- FORM STATE ---
  const [quoteType, setQuoteType] = useState<'project' | 'retainer'>('project'); 
  const [clientMode, setClientMode] = useState<'existing' | 'prospect'>('existing');
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedLeadId, setSelectedLeadId] = useState<string>('');

  // Prospect Fields
  const [prospectName, setProspectName] = useState('');
  const [prospectEmail, setProspectEmail] = useState('');
  const [prospectCompany, setProspectCompany] = useState('');
  
  // Quote Fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('draft');
  const [validUntil, setValidUntil] = useState('');
  const [deliveryDelay, setDeliveryDelay] = useState('');
  const [taxRate, setTaxRate] = useState<number>(0); 
  const [senderName, setSenderName] = useState('Tarek Zreik'); // NOUVEAU
  
  // Items
  const [items, setItems] = useState([
      { description: 'Mise en place automatisation', quantity: 1, unit_price: 1500, billing_frequency: 'once' }
  ]);

  // Payment
  const [paymentTermsType, setPaymentTermsType] = useState<'100_percent' | '50_50' | '30_70' | 'custom'>('100_percent');

  // Load Leads
  useEffect(() => {
      const fetchLeads = async () => {
          const { data } = await supabase.from('crm_leads').select('*').neq('status', 'won').neq('status', 'lost');
          if (data) setLeads(data);
      };
      fetchLeads();
  }, []);

  // --- INITIALISATION ---
  useEffect(() => {
      if (initialData) {
          setEditingQuoteId(cleanUuid(initialData.id)); 

          setTitle(initialData.title || initialData.company || 'Proposition Commerciale');
          setDescription(initialData.description || initialData.notes || '');
          setStatus(['draft', 'sent', 'signed', 'rejected'].includes(initialData.status) ? initialData.status : 'draft');
          setDeliveryDelay(initialData.delivery_delay || '');
          setSenderName(initialData.sender_name || 'Tarek Zreik'); // Init Sender
          
          if (initialData.valid_until) {
              setValidUntil(initialData.valid_until.split('T')[0]);
          } else {
              const d = new Date();
              d.setDate(d.getDate() + 30);
              setValidUntil(d.toISOString().split('T')[0]);
          }

          // Détection du mode (Client vs Prospect)
          const profileUuid = cleanUuid(initialData.profile_id);
          const leadUuid = cleanUuid(initialData.lead_id);
          
          if (profileUuid) {
              setClientMode('existing');
              setSelectedClientId(profileUuid);
          } else {
              setClientMode('prospect');
              setSelectedClientId(''); 
              
              if (leadUuid) setSelectedLeadId(leadUuid);
              
              setProspectName(initialData.recipient_name || `${initialData.first_name || ''} ${initialData.last_name || ''}`.trim());
              setProspectEmail(initialData.recipient_email || initialData.email || '');
              setProspectCompany(initialData.recipient_company || initialData.company || '');
          }

          // Récupération des infos étendues stockées dans payment_terms (JSON)
          if (initialData.payment_terms) {
              setPaymentTermsType(initialData.payment_terms.type || '100_percent');
              setTaxRate(initialData.payment_terms.tax_rate || 0);
              const loadedType = initialData.payment_terms.quote_type || 'project';
              setQuoteType(loadedType);
          }

          if (initialData.items && Array.isArray(initialData.items)) {
              setItems(initialData.items.map((i: any) => ({
                  description: i.description,
                  quantity: i.quantity,
                  unit_price: i.unit_price,
                  // Si c'est un retainer, on force monthly visuellement, sinon on prend la valeur
                  billing_frequency: i.billing_frequency || 'once'
              })));
          } else if (initialData.value) {
              setItems([{ description: 'Prestation principale', quantity: 1, unit_price: initialData.value, billing_frequency: 'once' }]);
          }

      } else {
          setEditingQuoteId(null);
          const d = new Date();
          d.setDate(d.getDate() + 30);
          setValidUntil(d.toISOString().split('T')[0]);

          const availableClients = clients.filter(c => c.role !== 'admin');
          if (availableClients.length > 0) {
              setClientMode('existing');
              setSelectedClientId(availableClients[0].id);
          }
      }
  }, [initialData, clients]);

  // Si on passe en mode Retainer, on met à jour les items existants pour être mensuels
  useEffect(() => {
      if (quoteType === 'retainer') {
          setItems(prev => prev.map(i => ({ ...i, billing_frequency: 'monthly' })));
      }
  }, [quoteType]);

  const handleLeadSelect = (leadId: string) => {
      setSelectedLeadId(leadId);
      const lead = leads.find(l => l.id === leadId);
      if (lead) {
          setProspectName(`${lead.first_name || ''} ${lead.last_name || ''}`.trim());
          setProspectEmail(lead.email || '');
          setProspectCompany(lead.company || '');
          if (lead.value > 0) {
             setItems([{ description: 'Prestation principale', quantity: 1, unit_price: lead.value, billing_frequency: quoteType === 'retainer' ? 'monthly' : 'once' }]);
          }
      } else {
          setProspectName('');
          setProspectEmail('');
          setProspectCompany('');
      }
  };

  const handleAddItem = () => setItems([...items, { description: '', quantity: 1, unit_price: 0, billing_frequency: quoteType === 'retainer' ? 'monthly' : 'once' }]);
  const handleRemoveItem = (index: number) => setItems(items.filter((_, i) => i !== index));
  
  const updateItem = (index: number, field: string, value: any) => {
      const newItems = [...items];
      (newItems[index] as any)[field] = value;
      setItems(newItems);
  };

  // CALCULS FINANCIERS
  const subTotal = items.reduce((acc, item) => acc + (item.quantity * item.unit_price), 0);
  const taxAmount = subTotal * (taxRate / 100);
  const totalTTC = subTotal + taxAmount;

  const oneShotTotal = items.filter(i => i.billing_frequency === 'once').reduce((acc, i) => acc + (i.quantity * i.unit_price), 0);
  
  let depositAmount = oneShotTotal;
  if (paymentTermsType === '50_50') depositAmount = oneShotTotal * 0.5;
  if (paymentTermsType === '30_70') depositAmount = oneShotTotal * 0.3;
  
  // Acompte TTC (approximatif pour l'affichage, le vrai calcul se fera sur facture)
  const depositTTC = depositAmount * (1 + taxRate / 100);

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);

      try {
          let finalProfileId: string | null = null;
          let finalLeadId: string | null = null;
          
          // Variables pour stocker les infos du destinataire (que ce soit prospect ou client existant)
          let finalRecipientEmail: string | null = null;
          let finalRecipientName: string | null = null;
          let finalRecipientCompany: string | null = null;

          if (clientMode === 'existing') {
              finalProfileId = cleanUuid(selectedClientId);
              finalLeadId = null;
              
              // RÉCUPÉRATION DES INFOS DU CLIENT EXISTANT POUR LES COPIER DANS LE DEVIS
              // Cela permet d'avoir toujours les infos de contact dans la table quotes, même si le profil change ou RLS bloque
              const existingClient = clients.find(c => c.id === selectedClientId);
              if (existingClient) {
                  finalRecipientEmail = existingClient.email;
                  finalRecipientName = existingClient.name;
                  finalRecipientCompany = existingClient.company;
              }
          } else {
              finalProfileId = null; 
              finalLeadId = cleanUuid(selectedLeadId);
              
              finalRecipientEmail = prospectEmail;
              finalRecipientName = prospectName;
              finalRecipientCompany = prospectCompany;
          }

          // Construction dynamique
          const basePayload: any = {
              profile_id: finalProfileId,
              recipient_email: finalRecipientEmail, // IMPORTANT: Toujours rempli maintenant
              recipient_name: finalRecipientName,
              recipient_company: finalRecipientCompany,
              sender_name: senderName, // NOUVEAU
              title: title || 'Devis sans titre',
              description,
              status: ['draft', 'sent', 'signed', 'rejected'].includes(status) ? status : 'draft',
              valid_until: validUntil || null,
              delivery_delay: deliveryDelay || null, 
              // Si Retainer, le total_amount stocké est 0 pour la partie "One-Shot", 
              // mais pour l'affichage liste, on stocke le total TTC du mois.
              total_amount: totalTTC, 
              // On stocke les métadonnées de facturation dans le JSON payment_terms
              payment_terms: { 
                  type: paymentTermsType,
                  tax_rate: taxRate,
                  quote_type: quoteType // Sauvegarde du type (Project vs Retainer)
              },
              updated_at: new Date().toISOString()
          };

          if (finalLeadId) basePayload.lead_id = finalLeadId;
          else basePayload.lead_id = null;

          let targetQuoteId: string | null = editingQuoteId;

          if (targetQuoteId) {
              const { error } = await supabase.from('quotes').update(basePayload).eq('id', targetQuoteId);
              if (error) throw error;
              await supabase.from('quote_items').delete().eq('quote_id', targetQuoteId);
          } else {
              const { data, error } = await supabase.from('quotes').insert({
                  ...basePayload,
                  public_token: generateUUID(),
                  created_at: new Date().toISOString()
              }).select('id').single();
              
              if (error) throw error;
              targetQuoteId = data.id;
          }

          if (targetQuoteId && items.length > 0) {
              const itemsPayload = items.map(item => ({
                  quote_id: targetQuoteId,
                  description: item.description,
                  quantity: item.quantity,
                  unit_price: item.unit_price,
                  // Force 'monthly' si mode retainer
                  billing_frequency: quoteType === 'retainer' ? 'monthly' : item.billing_frequency
              }));
              const { error: itemsError } = await supabase.from('quote_items').insert(itemsPayload);
              if (itemsError) throw itemsError;
          }

          toast.success("Succès", "Devis enregistré avec succès.");
          onSuccess();

      } catch (err: any) {
          console.error("Erreur Devis:", err);
          let msg = err.message;
          if (msg.includes('invalid input syntax for type uuid')) {
              msg = "Erreur technique : ID invalide.";
          }
          toast.error("Erreur", msg);
      } finally {
          setLoading(false);
      }
  };

  const availableClients = clients.filter(c => c.role !== 'admin');

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pt-2">
        
        {/* TYPE D'OFFRE TOGGLE */}
        <div className="bg-white p-1 rounded-xl border border-slate-200 shadow-sm flex mb-4">
            <button
                type="button"
                onClick={() => setQuoteType('project')}
                className={`flex-1 py-3 text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${
                    quoteType === 'project' 
                    ? 'bg-slate-900 text-white shadow-md' 
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                }`}
            >
                <Briefcase size={16} /> Projet Standard (Facture)
            </button>
            <button
                type="button"
                onClick={() => setQuoteType('retainer')}
                className={`flex-1 py-3 text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${
                    quoteType === 'retainer' 
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md' 
                    : 'text-slate-500 hover:text-indigo-600 hover:bg-indigo-50'
                }`}
            >
                <Infinity size={16} /> Accompagnement (Abonnement)
            </button>
        </div>

        {/* NOUVEAU: SÉLECTION ÉMETTEUR (Placé avant la sélection client pour le contexte) */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-4">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-2">
                <UserCircle size={14} /> Responsable / Émetteur du devis
            </label>
            <select
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
            >
                <option value="Tarek Zreik">Tarek Zreik</option>
                <option value="Zakaria Jellouli">Zakaria Jellouli</option>
            </select>
        </div>

        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
            {/* Mode Toggle Client/Prospect */}
            <div className="flex bg-white p-1 rounded-lg border border-slate-200 shadow-sm w-full">
                <button
                    type="button"
                    onClick={() => { setClientMode('existing'); setSelectedLeadId(''); }}
                    className={`flex-1 py-2 text-sm font-bold rounded-md flex items-center justify-center gap-2 transition-all ${
                        clientMode === 'existing' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                    <Users size={16} /> Client Existant
                </button>
                <button
                    type="button"
                    onClick={() => { setClientMode('prospect'); setSelectedClientId(''); }}
                    className={`flex-1 py-2 text-sm font-bold rounded-md flex items-center justify-center gap-2 transition-all ${
                        clientMode === 'prospect' ? 'bg-emerald-50 text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                    <UserPlus size={16} /> Nouveau Prospect
                </button>
            </div>

            {/* MODE: CLIENT EXISTANT */}
            {clientMode === 'existing' && (
                <div className="animate-fade-in">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Sélectionner le client</label>
                    <div className="relative">
                        <select
                            value={selectedClientId}
                            onChange={(e) => setSelectedClientId(e.target.value)}
                            className="w-full pl-3 pr-8 py-2.5 bg-white border border-slate-300 rounded-lg text-sm font-bold outline-none appearance-none focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="">-- Choisir un client --</option>
                            {availableClients.map(client => (
                                <option key={client.id} value={client.id}>{client.company} ({client.name})</option>
                            ))}
                        </select>
                        <Lock size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                    {/* INFO : On explique que l'email sera copié */}
                    <p className="text-[10px] text-slate-400 mt-2 flex items-center gap-1">
                        <User size={12} /> Les informations du client (Email, Société) seront automatiquement copiées dans le devis pour la signature.
                    </p>
                </div>
            )}

            {/* MODE: PROSPECT */}
            {clientMode === 'prospect' && (
                <div className="space-y-4 animate-fade-in">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Lier à un Lead CRM (Recommandé)</label>
                        <select 
                            value={selectedLeadId}
                            onChange={(e) => handleLeadSelect(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                            <option value="">-- Saisie libre ou choisir un lead --</option>
                            {leads.map(lead => (
                                <option key={lead.id} value={lead.id}>
                                    {lead.company ? `${lead.company} - ` : ''}{lead.first_name} {lead.last_name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nom Complet</label>
                            <input type="text" required={clientMode === 'prospect'} value={prospectName} onChange={e => setProspectName(e.target.value)} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="Jean Dupont" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email</label>
                            <input type="email" required={clientMode === 'prospect'} value={prospectEmail} onChange={e => setProspectEmail(e.target.value)} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="jean@exemple.com" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Société</label>
                        <input type="text" value={prospectCompany} onChange={e => setProspectCompany(e.target.value)} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="Entreprise SAS" />
                    </div>
                </div>
            )}
        </div>

        <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Titre du projet</label>
                <input type="text" required value={title} onChange={e => setTitle(e.target.value)} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-800" placeholder="Ex: Refonte Automatisation" />
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
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description</label>
            <textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} className="w-full px-3 py-2 border rounded-lg outline-none" placeholder="Contexte du projet..." />
        </div>

        <div className="grid grid-cols-3 gap-4">
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date de validité</label>
                <input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} className="w-full px-3 py-2 border rounded-lg outline-none" />
            </div>
            
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1"><Clock size={12} /> Délai Livraison</label>
                <input 
                    type="text" 
                    value={deliveryDelay} 
                    onChange={e => setDeliveryDelay(e.target.value)} 
                    className="w-full px-3 py-2 border rounded-lg outline-none text-sm"
                    placeholder={quoteType === 'retainer' ? "Immédiat" : "Ex: 3 semaines"}
                />
            </div>
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Conditions Paiement</label>
                {quoteType === 'retainer' ? (
                    <div className="w-full px-3 py-2 border rounded-lg bg-slate-50 text-slate-500 text-sm font-bold">
                        Paiement Mensuel
                    </div>
                ) : (
                    <select value={paymentTermsType} onChange={e => setPaymentTermsType(e.target.value as any)} className="w-full px-3 py-2 border rounded-lg outline-none bg-white">
                        <option value="100_percent">100% à la commande</option>
                        <option value="50_50">Acompte 50% / Solde 50%</option>
                        <option value="30_70">Acompte 30% / Solde 70%</option>
                    </select>
                )}
            </div>
        </div>

        {/* ITEMS */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className={`px-4 py-2 border-b border-slate-200 flex justify-between items-center ${quoteType === 'retainer' ? 'bg-indigo-50' : 'bg-slate-50'}`}>
                <span className={`text-xs font-bold uppercase ${quoteType === 'retainer' ? 'text-indigo-700' : 'text-slate-600'}`}>
                    {quoteType === 'retainer' ? 'Détails de l\'abonnement' : 'Prestations'}
                </span>
                <button type="button" onClick={handleAddItem} className="text-xs font-bold text-indigo-600 flex items-center gap-1"><Plus size={12} /> Ajouter ligne</button>
            </div>
            <div className="p-2 space-y-2">
                {items.map((item, idx) => (
                    <div key={idx} className="flex gap-2 items-start bg-slate-50/50 p-2 rounded-lg border border-slate-100">
                        <div className="flex-1 space-y-2">
                            <input type="text" placeholder="Description" value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} className="w-full px-3 py-1.5 text-sm border rounded outline-none focus:border-indigo-500" />
                            <div className="flex gap-2">
                                {quoteType === 'retainer' ? (
                                    <div className="px-3 py-1.5 rounded border border-indigo-200 bg-indigo-50 text-indigo-700 text-xs font-bold flex items-center gap-1">
                                        <RefreshCw size={10} /> Mensuel
                                    </div>
                                ) : (
                                    <select value={item.billing_frequency} onChange={e => updateItem(idx, 'billing_frequency', e.target.value)} className="text-xs font-bold py-1.5 px-2 rounded border outline-none bg-white">
                                        <option value="once">Une fois (Setup)</option>
                                        <option value="monthly">Mensuel</option>
                                        <option value="yearly">Annuel</option>
                                    </select>
                                )}
                                <input type="number" placeholder="Qté" value={item.quantity} onChange={e => updateItem(idx, 'quantity', parseFloat(e.target.value))} className="w-16 px-2 py-1.5 text-sm border rounded outline-none text-center" />
                                <input type="number" placeholder="Prix" value={item.unit_price} onChange={e => updateItem(idx, 'unit_price', parseFloat(e.target.value))} className="w-24 px-2 py-1.5 text-sm border rounded outline-none text-right font-mono" />
                            </div>
                        </div>
                        <button type="button" onClick={() => handleRemoveItem(idx)} className="p-2 text-slate-400 hover:text-red-500 mt-1"><Trash2 size={16} /></button>
                    </div>
                ))}
            </div>
            
            <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 text-sm">
                <div className="flex justify-between items-center mb-1 text-slate-500">
                    <span>Total HT</span>
                    <span className="font-mono">{subTotal.toLocaleString()} €</span>
                </div>
                
                {/* TAX RATE INPUT */}
                <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                        <span className="text-slate-500 flex items-center gap-1"><Percent size={12} /> TVA (%)</span>
                        <input 
                            type="number" 
                            value={taxRate} 
                            onChange={(e) => setTaxRate(parseFloat(e.target.value))} 
                            className="w-14 px-1 py-0.5 border rounded text-right text-xs font-bold bg-white"
                        />
                    </div>
                    <span className="font-mono text-slate-600">
                        {taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                    </span>
                </div>

                <div className="border-t border-slate-200 pt-2 mt-2 flex justify-between items-center">
                    <span className="font-bold text-slate-700 uppercase text-xs">
                        {quoteType === 'retainer' ? 'Total Mensuel TTC' : 'Total TTC'}
                    </span>
                    <span className="text-lg font-black text-indigo-600 flex items-center gap-2">
                        <Calculator size={16} /> 
                        {totalTTC.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                    </span>
                </div>
                {quoteType === 'project' && (
                    <div className="text-right text-[10px] text-slate-400 mt-1">
                        Dont acompte TTC : {depositTTC.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                    </div>
                )}
            </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg">Annuler</button>
            <button type="submit" disabled={loading} className="px-6 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-md flex items-center gap-2">
                {loading ? 'Enregistrement...' : <><Save size={16} /> {editingQuoteId ? 'Mettre à jour' : 'Créer le devis'}</>}
            </button>
        </div>
    </form>
  );
};

export default QuoteForm;
