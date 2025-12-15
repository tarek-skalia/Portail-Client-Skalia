
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ToastProvider';
import { useAdmin } from '../AdminContext';
import { Plus, Trash2, Calculator, Zap, Mail, Link as LinkIcon } from 'lucide-react';
import { InvoiceItem, Invoice } from '../../types';

// --- CONFIGURATION N8N ---
// Remplace ceci par l'URL de ton Webhook n8n (Production)
const N8N_CREATE_INVOICE_WEBHOOK = "https://ton-n8n.com/webhook/creer-facture-stripe"; 

interface InvoiceFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  initialData?: Invoice | null;
}

const InvoiceForm: React.FC<InvoiceFormProps> = ({ onSuccess, onCancel, initialData }) => {
  const { targetUserId } = useAdmin();
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  // Fields
  const [billingEmail, setBillingEmail] = useState(''); // Email spécifique pour la facture
  const [stripeCustomerId, setStripeCustomerId] = useState<string | null>(null); // ID Stripe existant

  const [number, setNumber] = useState(`INV-${new Date().getFullYear()}-`);
  const [projectName, setProjectName] = useState('');
  const [status, setStatus] = useState<'pending' | 'paid' | 'overdue'>('pending');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [paymentLink, setPaymentLink] = useState('');
  const [pdfUrl, setPdfUrl] = useState('');
  
  // Items Repeater
  const [items, setItems] = useState<InvoiceItem[]>([{ description: '', quantity: 1, unit_price: 0 }]);
  const [taxRate, setTaxRate] = useState(20);

  // Initialisation : Récupérer les infos du client (Email + ID Stripe)
  useEffect(() => {
      const fetchClientInfo = async () => {
          // On ne charge ces infos que si on crée une nouvelle facture
          if (targetUserId && !initialData) {
              const { data } = await supabase
                .from('profiles')
                .select('email, stripe_customer_id')
                .eq('id', targetUserId)
                .single();
                
              if (data) {
                  if (data.email) setBillingEmail(data.email); // Pré-remplissage
                  if (data.stripe_customer_id) setStripeCustomerId(data.stripe_customer_id);
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
          setTaxRate(initialData.taxRate || 20);
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

              // 1. Récupérer les infos complémentaires du profil (Nom, Société) pour n8n
              const { data: clientProfile, error: profileError } = await supabase
                  .from('profiles')
                  .select('full_name, company_name')
                  .eq('id', targetUserId)
                  .single();

              if (profileError) {
                  throw new Error("Impossible de récupérer les infos du client.");
              }

              // 2. Préparer le Payload pour n8n
              const n8nPayload = {
                  client: {
                      email: billingEmail, // C'est l'email saisi dans le formulaire
                      name: clientProfile.full_name,
                      company: clientProfile.company_name,
                      supabase_user_id: targetUserId,
                      stripe_customer_id: stripeCustomerId // On envoie l'ID s'il existe déjà !
                  },
                  invoice: {
                      projectName,
                      issueDate,
                      dueDate,
                      taxRate,
                      currency: 'eur'
                  },
                  items: items // Tableau des prestations
              };

              // 3. Envoi au Webhook n8n
              if (N8N_CREATE_INVOICE_WEBHOOK.includes("ton-n8n.com")) {
                  throw new Error("L'URL du Webhook n8n n'est pas configurée dans le code (InvoiceForm.tsx).");
              }

              const response = await fetch(N8N_CREATE_INVOICE_WEBHOOK, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(n8nPayload)
              });

              if (!response.ok) {
                  throw new Error("Erreur lors de l'appel à n8n. Code: " + response.status);
              }
              
              toast.success("Traitement lancé", `La facture sera envoyée à ${billingEmail}.`);
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
    <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* BANNER INFO AUTOMATISATION */}
        {!initialData && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 flex items-start gap-3 text-xs text-indigo-700">
                <Zap size={16} className="shrink-0 mt-0.5" />
                <div>
                    <strong>Mode Automatique :</strong> En validant, les données seront envoyées à <strong>Stripe</strong> via n8n. La facture sera générée et envoyée par email.
                </div>
            </div>
        )}

        {/* CHAMP EMAIL FACTURATION (Visible seulement en création) */}
        {!initialData && (
            <div className="flex gap-4 items-start">
                <div className="flex-1">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-2">
                        <Mail size={12} /> Email Facturation (Stripe Customer)
                    </label>
                    <input 
                        type="email" 
                        required
                        value={billingEmail} 
                        onChange={e => setBillingEmail(e.target.value)}
                        className="w-full px-3 py-2 border border-indigo-200 bg-indigo-50/30 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-indigo-900 font-medium placeholder-indigo-300"
                        placeholder="comptabilite@client.com"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                        L'email qui recevra la facture. Si différent du compte, un nouveau contact Stripe sera créé ou mis à jour.
                    </p>
                </div>
                
                {/* Badge ID Stripe existant */}
                {stripeCustomerId && (
                    <div className="mt-6">
                        <div className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg text-xs font-bold" title={`ID Stripe : ${stripeCustomerId}`}>
                            <LinkIcon size={12} />
                            Client Lié
                        </div>
                    </div>
                )}
            </div>
        )}

        <div className="grid grid-cols-2 gap-4">
            <div>
                {/* En mode création, le numéro est géré par Stripe, on le grise ou on le cache */}
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Numéro Facture {initialData ? '' : '(Auto)'}</label>
                <input 
                    type="text" 
                    value={initialData ? number : 'Généré par Stripe'} 
                    onChange={e => setNumber(e.target.value)}
                    disabled={!initialData}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-slate-50 text-slate-500" 
                />
            </div>
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Statut</label>
                <select 
                    value={status} onChange={e => setStatus(e.target.value as any)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                    disabled={!initialData} // En création, c'est Stripe qui décide (Draft ou Open)
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
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" 
                placeholder="Ex: Setup Automatisation CRM"
            />
        </div>

        <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date émission</label>
                <input type="date" required value={issueDate} onChange={e => setIssueDate(e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date échéance</label>
                <input type="date" required value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
            </div>
        </div>

        {/* ITEMS REPEATER */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <label className="block text-xs font-bold text-indigo-600 uppercase mb-3">Lignes de prestation</label>
            
            <div className="space-y-3">
                {items.map((item, idx) => (
                    <div key={idx} className="flex gap-2 items-start">
                        <input 
                            type="text" placeholder="Description" value={item.description}
                            onChange={e => updateItem(idx, 'description', e.target.value)}
                            className="flex-[3] px-3 py-2 text-sm border rounded-lg outline-none"
                        />
                        <input 
                            type="number" placeholder="Qté" value={item.quantity} min="1"
                            onChange={e => updateItem(idx, 'quantity', parseFloat(e.target.value))}
                            className="flex-[1] px-3 py-2 text-sm border rounded-lg outline-none"
                        />
                        <input 
                            type="number" placeholder="Prix Unitaire" value={item.unit_price}
                            onChange={e => updateItem(idx, 'unit_price', parseFloat(e.target.value))}
                            className="flex-[1] px-3 py-2 text-sm border rounded-lg outline-none"
                        />
                        <button type="button" onClick={() => handleRemoveItem(idx)} className="p-2 text-slate-400 hover:text-red-500"><Trash2 size={16} /></button>
                    </div>
                ))}
            </div>
            <button type="button" onClick={handleAddItem} className="mt-3 text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                <Plus size={14} /> Ajouter une ligne
            </button>
        </div>

        {/* TOTALS & TAX */}
        <div className="flex justify-end gap-6 items-center border-t border-slate-100 pt-4">
            <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-slate-500">TVA %</label>
                <input 
                    type="number" value={taxRate} onChange={e => setTaxRate(parseFloat(e.target.value))}
                    className="w-16 px-2 py-1 border rounded text-right"
                />
            </div>
            <div className="text-right">
                <p className="text-xs text-slate-400 uppercase font-bold">Total TTC Estimé</p>
                <p className="text-xl font-bold text-indigo-600 flex items-center gap-2">
                    <Calculator size={18} /> {totalAmount.toFixed(2)} €
                </p>
            </div>
        </div>

        {/* LINKS (Seulement en édition, car générés par Stripe) */}
        {initialData && (
            <div className="grid grid-cols-2 gap-4 opacity-75">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Lien PDF (Stripe)</label>
                    <input type="text" value={pdfUrl} onChange={e => setPdfUrl(e.target.value)} className="w-full px-3 py-2 border rounded-lg" placeholder="https://..." />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Lien de paiement</label>
                    <input type="text" value={paymentLink} onChange={e => setPaymentLink(e.target.value)} className="w-full px-3 py-2 border rounded-lg" placeholder="https://buy.stripe.com/..." />
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
