import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Quote, QuoteItemData } from '../types';
import { CheckCircle2, XCircle, FileSignature, Loader2, Download, Calendar, Mail, User, Building, MapPin } from 'lucide-react';
import { useToast } from './ToastProvider';
import Logo from './Logo';

// URL unique pour le Switch N8N
const N8N_CREATE_INVOICE_WEBHOOK = "https://n8n-skalia-u41651.vm.elestio.app/webhook/de8b8392-51b4-4a45-875e-f11c9b6a0f6e";

interface PublicQuoteViewProps {
  quoteId: string;
}

const PublicQuoteView: React.FC<PublicQuoteViewProps> = ({ quoteId }) => {
  const [quote, setQuote] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    fetchQuote();
  }, [quoteId]);

  const fetchQuote = async () => {
    try {
      const { data, error } = await supabase
        .from('quotes')
        .select('*, quote_items(*), profiles(*)')
        .eq('id', quoteId)
        .single();

      if (error) throw error;
      setQuote(data);
    } catch (err: any) {
      console.error(err);
      setError("Impossible de charger le devis.");
    } finally {
      setLoading(false);
    }
  };

  const handleSign = async () => {
    if (!quote) return;
    setSigning(true);

    try {
        // 1. Mise à jour du statut du devis
        const { error: updateError } = await supabase
            .from('quotes')
            .update({ 
                status: 'signed', 
                updated_at: new Date().toISOString() 
            })
            .eq('id', quote.id);

        if (updateError) throw updateError;

        // --- LOGIQUE DU SNIPPET ---
        const isExistingClient = !!quote.profile_id;
        // Si c'est un prospect, on n'a pas encore de user_id stable pour les abonnements
        // Pour simplifier ici, on n'exécute la suite que si on a un profile_id ou si on vient de le créer (ce qui demanderait plus de logique auth).
        // On va supposer que si profile_id est null, on ne crée pas les abonnements tout de suite ou on le gère via N8N uniquement.
        
        const userId = quote.profile_id; 
        const email = quote.recipient_email;

        if (userId) {
             // 5. Création des abonnements si nécessaire (Recurring Items)
            const recurringItems = quote.quote_items?.filter((i: any) => i.billing_frequency !== 'once') || [];
            
            // Check conditions for immediate activation
            const isRetainer = quote.payment_terms?.quote_type === 'retainer';
            const shouldActivateImmediately = isExistingClient && isRetainer;

            if (recurringItems.length > 0) {
                const subscriptionsPayload = recurringItems.map((item: any) => ({
                    user_id: userId,
                    service_name: item.description,
                    amount: item.unit_price * item.quantity,
                    currency: 'EUR',
                    billing_cycle: item.billing_frequency,
                    status: shouldActivateImmediately ? 'active' : 'pending',
                    start_date: shouldActivateImmediately ? new Date().toISOString() : null,
                    created_at: new Date().toISOString()
                }));
                await supabase.from('client_subscriptions').insert(subscriptionsPayload);
            }

            // --- TRIGGER N8N POUR CLIENTS EXISTANTS (SKIP ONBOARDING) ---
            if (isExistingClient) {
                // On récupère les infos de facturation complètes du profil pour le payload
                const { data: fullProfile } = await supabase.from('profiles').select('*').eq('id', userId).single();
                
                if (fullProfile) {
                    const clientPayload = {
                        email: fullProfile.email || email,
                        name: fullProfile.full_name || quote.recipient_name,
                        company: fullProfile.company_name || quote.recipient_company,
                        supabase_user_id: userId,
                        stripe_customer_id: fullProfile.stripe_customer_id || null, // ADDED HERE
                        vat_number: fullProfile.vat_number || '',
                        phone: fullProfile.phone || '',
                        address_line1: fullProfile.address || '',
                        // Fallback champs vides si l'adresse est unifiée
                        address_postal_code: '', 
                        address_city: '',
                        address_country: ''
                    };

                    const taxRate = quote.payment_terms?.tax_rate || 0;

                    if (isRetainer) {
                        // On récupère l'abonnement qu'on vient de créer
                        // Note: On filtre par le statut qu'on vient d'insérer
                        const { data: subs } = await supabase.from('client_subscriptions')
                            .select('*')
                            .eq('user_id', userId)
                            .eq('status', shouldActivateImmediately ? 'active' : 'pending')
                            .order('created_at', { ascending: false }) // Le plus récent
                            .limit(1);
                        
                        const subscription = subs && subs.length > 0 ? subs[0] : null;

                        if (subscription) {
                            const n8nPayload = {
                                mode: 'subscription_start',
                                client: clientPayload,
                                subscription: {
                                    id: subscription.id,
                                    name: subscription.service_name,
                                    amount: subscription.amount,
                                    interval: subscription.billing_cycle === 'monthly' ? 'month' : 'year',
                                    currency: 'eur',
                                    tax_rate: taxRate,
                                    price_includes_tax: false
                                }
                            };

                            // Envoi N8N Fire & Forget
                            await fetch(N8N_CREATE_INVOICE_WEBHOOK, {
                                method: 'POST',
                                mode: 'no-cors',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(n8nPayload)
                            });

                            // Si pas activé immédiatement (cas théorique futur), on l'active ici
                            if (!shouldActivateImmediately) {
                                await supabase.from('client_subscriptions')
                                    .update({ status: 'active', start_date: new Date().toISOString() })
                                    .eq('id', subscription.id);
                            }
                        }
                    } else {
                        // Logic pour One-Shot si besoin (déjà géré dans OnboardingPage pour prospects, 
                        // mais ici pour client existant on pourrait vouloir générer la facture tout de suite)
                         // Création Facture One-Shot uniquement
                         const invoiceItems = quote.quote_items.filter((i: any) => i.billing_frequency === 'once');

                         if (invoiceItems.length > 0) {
                             const invoiceAmount = invoiceItems.reduce((acc: number, item: any) => acc + (item.unit_price * item.quantity), 0);
                             const totalWithTax = invoiceAmount * (1 + taxRate / 100);
       
                             const issueDateObj = new Date();
                             const issueDateStr = issueDateObj.toISOString().split('T')[0];
                             
                             const dueDateObj = new Date(issueDateObj);
                             dueDateObj.setDate(dueDateObj.getDate() + 7);
                             const dueDateStr = dueDateObj.toISOString().split('T')[0];
       
                             const n8nPayload = {
                                 client: clientPayload,
                                 invoice: {
                                     projectName: quote.title,
                                     issueDate: issueDateStr,
                                     dueDate: dueDateStr,
                                     amount: totalWithTax, 
                                     quote_id: quote.id,
                                     currency: 'eur',
                                     tax_rate: taxRate,
                                     status: 'pending'
                                 },
                                 items: invoiceItems
                             };
       
                             // Fire & Forget Standard
                             fetch(N8N_CREATE_INVOICE_WEBHOOK, {
                                 method: 'POST',
                                 mode: 'no-cors', 
                                 headers: { 'Content-Type': 'application/json' },
                                 body: JSON.stringify(n8nPayload)
                             });
                         }
                    }
                }
            }
        }

        toast.success("Devis signé", "Merci pour votre confiance !");
        fetchQuote();

    } catch (err: any) {
        console.error(err);
        toast.error("Erreur", "Une erreur est survenue lors de la signature.");
    } finally {
        setSigning(false);
    }
  };

  if (loading) return <div className="h-screen w-full flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-indigo-600" size={32} /></div>;
  if (error || !quote) return <div className="h-screen w-full flex items-center justify-center bg-slate-50 text-slate-500">{error || "Devis introuvable"}</div>;

  // Calculs pour l'affichage
  const taxRate = quote.payment_terms?.tax_rate || 0;
  const items = quote.quote_items || [];
  const subTotal = items.reduce((acc: number, i: any) => acc + (i.unit_price * i.quantity), 0);
  const taxAmount = subTotal * (taxRate / 100);
  const totalTTC = subTotal + taxAmount;

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="bg-slate-900 px-8 py-10 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-[80px] translate-x-1/3 -translate-y-1/3"></div>
            <div className="relative z-10 flex justify-between items-start">
                <div>
                    <Logo className="w-12 h-12" classNameText="text-2xl" />
                    <div className="mt-6">
                        <h1 className="text-3xl font-bold">{quote.title}</h1>
                        <p className="text-indigo-200 mt-1">Devis #{quote.id.slice(0, 8).toUpperCase()}</p>
                    </div>
                </div>
                <div className="text-right">
                    <div className="inline-flex flex-col items-end">
                        <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider mb-1">Date d'émission</span>
                        <span className="font-medium">{new Date(quote.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className="mt-4 inline-flex flex-col items-end">
                        <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider mb-1">Valide jusqu'au</span>
                        <span className="font-medium">{quote.valid_until ? new Date(quote.valid_until).toLocaleDateString() : '30 jours'}</span>
                    </div>
                </div>
            </div>
        </div>

        {/* Body */}
        <div className="p-8">
            {/* Destinataire */}
            <div className="flex justify-between mb-10 pb-10 border-b border-slate-100">
                <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Émetteur</h3>
                    <p className="font-bold text-slate-900">Skalia SRL</p>
                    <p className="text-slate-500 text-sm">Bruxelles, Belgique</p>
                    <p className="text-slate-500 text-sm">{quote.sender_name || 'Tarek Zreik'}</p>
                </div>
                <div className="text-right">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Pour</h3>
                    <p className="font-bold text-slate-900">{quote.recipient_company || quote.recipient_name}</p>
                    <p className="text-slate-500 text-sm">{quote.recipient_name}</p>
                    <p className="text-slate-500 text-sm">{quote.recipient_email}</p>
                </div>
            </div>

            {/* Description */}
            {quote.description && (
                <div className="mb-10">
                    <h3 className="text-sm font-bold text-slate-800 mb-2">Description du projet</h3>
                    <p className="text-slate-600 leading-relaxed text-sm whitespace-pre-line">{quote.description}</p>
                </div>
            )}

            {/* Items Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden mb-8">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-4">Description</th>
                            <th className="px-6 py-4 text-center">Qté</th>
                            <th className="px-6 py-4 text-right">Prix Unitaire</th>
                            <th className="px-6 py-4 text-right">Total HT</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {items.map((item: any) => (
                            <tr key={item.id}>
                                <td className="px-6 py-4 text-slate-800 font-medium">
                                    {item.description}
                                    {item.billing_frequency !== 'once' && (
                                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-100 uppercase tracking-wide">
                                            {item.billing_frequency === 'monthly' ? 'Mensuel' : 'Annuel'}
                                        </span>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-center text-slate-600">{item.quantity}</td>
                                <td className="px-6 py-4 text-right text-slate-600">{item.unit_price.toLocaleString('fr-FR', {style:'currency', currency: 'EUR'})}</td>
                                <td className="px-6 py-4 text-right text-slate-800 font-bold">{(item.unit_price * item.quantity).toLocaleString('fr-FR', {style:'currency', currency: 'EUR'})}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Totals */}
            <div className="flex justify-end mb-10">
                <div className="w-64 space-y-3">
                    <div className="flex justify-between text-slate-500 text-sm">
                        <span>Total HT</span>
                        <span>{subTotal.toLocaleString('fr-FR', {style:'currency', currency: 'EUR'})}</span>
                    </div>
                    {taxRate > 0 && (
                        <div className="flex justify-between text-slate-500 text-sm">
                            <span>TVA ({taxRate}%)</span>
                            <span>{taxAmount.toLocaleString('fr-FR', {style:'currency', currency: 'EUR'})}</span>
                        </div>
                    )}
                    <div className="pt-3 border-t border-slate-200 flex justify-between items-center">
                        <span className="font-bold text-slate-900">Total TTC</span>
                        <span className="font-bold text-2xl text-indigo-600">{totalTTC.toLocaleString('fr-FR', {style:'currency', currency: 'EUR'})}</span>
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="border-t border-slate-100 pt-8 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="text-slate-500 text-xs max-w-sm">
                    En signant ce devis, vous acceptez les conditions générales de vente de Skalia SRL.
                </div>
                
                {quote.status === 'signed' || quote.status === 'paid' ? (
                    <div className="flex items-center gap-2 px-6 py-3 bg-emerald-50 text-emerald-700 font-bold rounded-xl border border-emerald-100">
                        <CheckCircle2 size={20} /> Devis déjà signé
                    </div>
                ) : (
                    <button 
                        onClick={handleSign}
                        disabled={signing}
                        className="px-8 py-4 bg-indigo-600 text-white font-bold text-lg rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center gap-3 transform hover:-translate-y-1 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {signing ? <Loader2 className="animate-spin" /> : <FileSignature />}
                        Signer et Valider
                    </button>
                )}
            </div>

        </div>
      </div>
    </div>
  );
};

export default PublicQuoteView;