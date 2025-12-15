
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ToastProvider';
import { useAdmin } from '../AdminContext';
import { Plus, Trash2, Calculator, Zap, Mail, Link as LinkIcon, User, Building } from 'lucide-react';
import { InvoiceItem, Invoice } from '../../types';

// --- CONFIGURATION N8N ---
// URL de TEST (webhook-test)
const N8N_CREATE_INVOICE_WEBHOOK = "https://n8n-skalia-u41651.vm.elestio.app/webhook/de8b8392-51b4-4a45-875e-f11c9b6a0f6e"; 

interface InvoiceFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  initialData?: Invoice | null;
}

const InvoiceForm: React.FC<InvoiceFormProps> = ({ onSuccess, onCancel, initialData }) => {
  const { targetUserId } = useAdmin();
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  // Client Data
  const [clientName, setClientName] = useState('');
  const [clientCompany, setClientCompany] = useState(''); 
  const [billingEmail, setBillingEmail] = useState(''); 
  const [stripeCustomerId, setStripeCustomerId] = useState<string | null>(null); 

  // Invoice Data
  const [number, setNumber] = useState(`INV-${new Date().getFullYear()}-`);
  const [projectName, setProjectName] = useState('');
  const [status, setStatus] = useState<'pending' | 'paid' | 'overdue'>('pending');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  
  // Edit Mode Only Fields
  const [paymentLink, setPaymentLink] = useState('');
  const [pdfUrl, setPdfUrl] = useState('');
  
  // Items Repeater
  const [items, setItems] = useState<InvoiceItem[]>([{ description: '', quantity: 1, unit_price: 0 }]);
  
  // CORRECTION: Valeur par défaut à 0.
  const [taxRate, setTaxRate] = useState(0);

  // Initialisation : Récupérer les infos du client (Nom, Société, Email, ID Stripe)
  useEffect(() => {
      const fetchClientInfo = async () => {
          if (targetUserId) {
              const { data } = await supabase
                .from('profiles')
                .select('full_name, company_name, email, stripe_customer_id')
                .eq('id', targetUserId)
                .single();
                
              if (data) {
                  const displayName = data.company_name || data.full_name || '';
                  setClientName(displayName);
                  setClientCompany(data.company_name || '');
                  
                  if (!initialData) {
                      if (data.email) setBillingEmail(data.email);
                      if (data.stripe_customer_id) setStripeCustomerId(data.stripe_customer_id);
                  }
              }
          }
      };
      fetchClientInfo();
  }, [targetUserId, initialData]);

  // Initialisation : Données existantes (Mode Édition)
  useEffect(() => {
      if (initialData) {
          setNumber(initialData.number);
          setProjectName(initialData.projectName);
          setStatus(initialData.status === 'open' ? 'pending' : initialData.status as any);
          
          if (initialData.issueDate && initialData.issueDate.includes('/')) {
              const [d, m, y] = initialData.issueDate.split('/');
              setIssueDate(`${y}-${m}-${d}`);
          } else {
              setIssueDate(initialData.issueDate || '');
          }

          if (initialData.dueDate && initialData.dueDate.includes('/')) {
              const [d, m, y] = initialData.dueDate.split('/');
              setDueDate(`${y}-${m}-${d}`);
          } else {
              setDueDate(initialData.dueDate || '');
          }

          setPaymentLink(initialData.paymentLink || '');
          setPdfUrl(initialData.pdfUrl || '');
          setItems(initialData.items || [{ description: '', quantity: 1, unit_price: 0 }]);
          
          setTaxRate(initialData.taxRate ?? 0);
      }
  }, [initialData]);

  // Computed
  const subTotal = items.reduce((acc, item) => acc + (item.quantity * item.unit_price), 0);
  const totalAmount = subTotal * (1 + taxRate / 100);

  const handleAddItem = () => {
      setItems([...items, { description: '', quantity: 1, unit_price: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
      const newItems = [...items];
      newItems.splice(index, 1);
      setItems(newItems);
  };

  const updateItem = (index: number, field: keyof InvoiceItem, value: string | number) => {
      const newItems = [...items];
      (newItems[index] as any)[field] = value;
      setItems(newItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);

      try {
          // --- MODE ÉDITION : On modifie juste Supabase (Métadonnées) ---
          if (initialData) {
              const payload = {
                  number,
                  project_name: projectName,
                  amount: totalAmount,
                  status,
                  issue_date: issueDate,
                  due_date: dueDate,
                  pdf_url: pdfUrl,
                  payment_link: paymentLink,
                  items: items,
                  tax_rate: taxRate
              };

              const { error } = await supabase
                .from('invoices')
                .update(payload)
                .eq('id', initialData.id);
              
              if (error) throw error;
              toast.success("Mise à jour", "Les détails de la facture ont été modifiés dans le portail.");
              onSuccess();
          } 
          
          // --- MODE CRÉATION : On déclenche n8n -> Stripe ---
          else {
              
              if (!billingEmail) {
                  throw new Error("L'email de facturation est obligatoire.");
              }

              const n8nPayload = {
                  client: {
                      email: billingEmail, 
                      name: clientName,    
                      company: clientCompany, 
                      supabase_user_id: targetUserId,
                      stripe_customer_id: stripeCustomerId 
                  },
                  invoice: {
                      projectName,
                      issueDate,
                      dueDate,
                      taxRate, // Format CamelCase
                      tax_rate: taxRate, // Format SnakeCase (Force la DB à utiliser cette valeur)
                      amount: totalAmount,
                      currency: 'eur'
                  },
                  items: items 
              };

              // Debug Log
              console.log("Envoi à n8n (Test):", n8nPayload);

              // IMPORTANT: 'keepalive: true' garantit que la requête survit à la fermeture du composant
              await fetch(N8N_CREATE_INVOICE_WEBHOOK, {
                  method: 'POST',
                  mode: 'no-cors', 
                  headers: { 
                      'Content-Type': 'text/plain' 
                  },
                  body: JSON.stringify(n8nPayload),
                  keepalive: true
              });
              
              toast.success("Traitement lancé", `La demande a été envoyée à Stripe.`);
              onSuccess();
          }

      } catch (err: any) {
          console.error(err);
          toast.error("Erreur", err.message);
      } finally {
          setLoading(false);
      }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 pt-2">
        
        {/* SECTION INFOS CLIENT */}
        {!initialData && (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                        <User size={14} /> Informations Client
                    </h3>
                    {stripeCustomerId && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-bold">
                            <LinkIcon size={10} /> Lié Stripe
                        </span>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Nom Client / Société</label>
                        <div className="relative">
                            <Building className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                            <input 
                                type="text"
                                value={clientName}
                                onChange={(e) => setClientName(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 border border-slate-300 bg-white rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800 font-medium text-sm"
                                placeholder="Nom du client"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Email Facturation (Stripe)</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400" size={14} />
                            <input 
                                type="email" 
                                required
                                value={billingEmail} 
                                onChange={e => setBillingEmail(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 border border-indigo-200 bg-indigo-50/20 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-indigo-900 font-medium placeholder-indigo-300 text-sm"
                                placeholder="compta@client.com"
                            />
                        </div>
                    </div>
                </div>
                
                <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-2.5 flex items-start gap-2.5 text-xs text-indigo-800">
                    <Zap size={14} className="shrink-0 mt-0.5" />
                    <div>
                        <strong>Mode Automatique :</strong> La validation créera la facture Stripe, enverra le PDF par email et mettra à jour ce portail automatiquement.
                    </div>
                </div>
            </div>
        )}

        {/* SECTION FACTURE */}
        <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Numéro Facture {initialData ? '' : '(Auto)'}</label>
                <input 
                    type="text" 
                    value={initialData ? number : 'Généré par Stripe'} 
                    onChange={e => setNumber(e.target.value)}
                    disabled={!initialData}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-slate-50 text-slate-500 text-sm" 
                />
            </div>
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Statut</label>
                <select 
                    value={status} onChange={e => setStatus(e.target.value as any)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-sm"
                    disabled={!initialData} 
                >
                    <option value="pending">En attente (Open)</option>
                    <option value="paid">Payée</option>
                    <option value="overdue">En retard</option>
                </select>
            </div>
        </div>

        <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Titre / Projet (Description Stripe)</label>
            <input 
                type="text" required value={projectName} onChange={e => setProjectName(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm" 
                placeholder="Ex: Setup Automatisation CRM"
            />
        </div>

        <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date émission</label>
                <input type="date" required value={issueDate} onChange={e => setIssueDate(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date échéance</label>
                <input type="date" required value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
        </div>

        {/* ITEMS REPEATER */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex justify-between items-center">
                <label className="text-xs font-bold text-slate-600 uppercase">Prestations</label>
                <button type="button" onClick={handleAddItem} className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                    <Plus size={14} /> Ajouter
                </button>
            </div>
            
            <div className="p-3 space-y-2">
                {items.map((item, idx) => (
                    <div key={idx} className="flex gap-2 items-start">
                        <input 
                            type="text" placeholder="Description" value={item.description}
                            onChange={e => updateItem(idx, 'description', e.target.value)}
                            className="flex-[3] px-3 py-2 text-sm border rounded-lg outline-none focus:border-indigo-500"
                        />
                        <input 
                            type="number" placeholder="Qté" value={item.quantity} min="1"
                            onChange={e => updateItem(idx, 'quantity', parseFloat(e.target.value))}
                            className="flex-[1] px-3 py-2 text-sm border rounded-lg outline-none focus:border-indigo-500"
                        />
                        <input 
                            type="number" placeholder="Prix" value={item.unit_price}
                            onChange={e => updateItem(idx, 'unit_price', parseFloat(e.target.value))}
                            className="flex-[1] px-3 py-2 text-sm border rounded-lg outline-none focus:border-indigo-500"
                        />
                        <button type="button" onClick={() => handleRemoveItem(idx)} className="p-2 text-slate-400 hover:text-red-500"><Trash2 size={16} /></button>
                    </div>
                ))}
            </div>
        </div>

        {/* TOTALS */}
        <div className="flex justify-end gap-6 items-center pt-2">
            <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-500">TVA %</label>
                <input 
                    type="number" value={taxRate} onChange={e => setTaxRate(parseFloat(e.target.value))}
                    className="w-14 px-2 py-1 border rounded text-right text-sm"
                />
            </div>
            <div className="text-right">
                <p className="text-[10px] text-slate-400 uppercase font-bold">Total TTC Estimé</p>
                <p className="text-lg font-bold text-indigo-600 flex items-center gap-2">
                    <Calculator size={16} /> {totalAmount.toFixed(2)} €
                </p>
            </div>
        </div>

        {/* LINKS (UNIQUEMENT EN ÉDITION) */}
        {initialData && (
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Lien PDF (Stripe)</label>
                    <input type="text" value={pdfUrl} onChange={e => setPdfUrl(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="https://..." />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Lien de paiement</label>
                    <input type="text" value={paymentLink} onChange={e => setPaymentLink(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="https://buy.stripe.com/..." />
                </div>
            </div>
        )}

        <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
            <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg">Annuler</button>
            <button type="submit" disabled={loading} className="px-6 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-md disabled:opacity-50 flex items-center gap-2">
                {loading ? 'Traitement...' : (initialData ? 'Sauvegarder modifications' : <><Zap size={16} /> Générer dans Stripe</>)}
            </button>
        </div>
    </form>
  );
};

export default InvoiceForm;
