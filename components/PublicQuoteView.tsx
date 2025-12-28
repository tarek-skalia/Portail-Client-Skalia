import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Quote, InvoiceItem } from '../types';
import { CheckCircle2, XCircle, FileText, Download, Calendar, ArrowRight, Loader2, DollarSign, Calculator, Percent } from 'lucide-react';
import Logo from './Logo';
import { useToast } from './ToastProvider';

const N8N_CREATE_INVOICE_WEBHOOK = "https://n8n-skalia-u41651.vm.elestio.app/webhook/de8b8392-51b4-4a45-875e-f11c9b6a0f6e";

interface PublicQuoteViewProps {
  quoteId: string;
}

const PublicQuoteView: React.FC<PublicQuoteViewProps> = ({ quoteId }) => {
    const [quote, setQuote] = useState<any | null>(null);
    const [items, setItems] = useState<InvoiceItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSigning, setIsSigning] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        fetchQuote();
    }, [quoteId]);

    const fetchQuote = async () => {
        setIsLoading(true);
        try {
            // Fetch Quote
            const { data: quoteData, error: quoteError } = await supabase
                .from('quotes')
                .select('*')
                .eq('id', quoteId)
                .single();

            if (quoteError || !quoteData) throw new Error("Devis introuvable.");

            // Fetch Items
            const { data: itemsData, error: itemsError } = await supabase
                .from('quote_items')
                .select('*')
                .eq('quote_id', quoteId);

            if (itemsError) throw itemsError;

            // Increment View Count (Fire & Forget)
            supabase.from('quotes').update({ 
                view_count: (quoteData.view_count || 0) + 1,
                last_viewed_at: new Date().toISOString()
            }).eq('id', quoteId).then();

            setQuote(quoteData);
            setItems(itemsData || []);

        } catch (err: any) {
            setError(err.message || "Impossible de charger le devis.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSign = async () => {
        if (!quote) return;
        if (!window.confirm("En signant ce devis, vous acceptez les conditions de vente.")) return;

        setIsSigning(true);
        try {
            // 1. Update Quote Status
            const { error } = await supabase
                .from('quotes')
                .update({ 
                    status: 'signed',
                    updated_at: new Date().toISOString()
                })
                .eq('id', quote.id);

            if (error) throw error;

            // 2. Trigger Subscription Logic (N8N) if applicable
            const taxRate = (quote.payment_terms && quote.payment_terms.tax_rate) ? Number(quote.payment_terms.tax_rate) : 0;
            const isRetainer = quote.payment_terms?.quote_type === 'retainer';

            if (isRetainer && quote.profile_id) {
                // Check if subscription exists in pending state
                const { data: subs } = await supabase
                    .from('client_subscriptions')
                    .select('*')
                    .eq('user_id', quote.profile_id)
                    .eq('status', 'pending')
                    .limit(1);
                
                const subscription = subs && subs.length > 0 ? subs[0] : null;

                if (subscription) {
                    // Fetch client data for webhook
                    const { data: profile } = await supabase.from('profiles').select('email, full_name, company_name, stripe_customer_id').eq('id', quote.profile_id).single();
                    
                    const clientPayload = {
                        email: profile?.email || quote.recipient_email,
                        name: profile?.full_name || quote.recipient_name,
                        company: profile?.company_name || quote.recipient_company,
                        supabase_user_id: quote.profile_id,
                        stripe_customer_id: profile?.stripe_customer_id
                    };

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
                            price_includes_tax: false,
                            duration: quote.delivery_delay || 'Indéterminée'
                        }
                    };

                    // Call Webhook
                    await fetch(N8N_CREATE_INVOICE_WEBHOOK, {
                        method: 'POST',
                        mode: 'no-cors',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(n8nPayload)
                    });

                    // Activate Local Sub
                    await supabase.from('client_subscriptions')
                        .update({ status: 'active', start_date: new Date().toISOString() })
                        .eq('id', subscription.id);
                }
            }

            setSuccess(true);
            setQuote({ ...quote, status: 'signed' });

        } catch (err: any) {
            console.error("Sign error:", err);
            alert("Erreur lors de la signature : " + err.message);
        } finally {
            setIsSigning(false);
        }
    };

    if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-indigo-600" size={32} /></div>;
    if (error) return <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4 text-center"><XCircle className="text-red-500 mb-4" size={48} /><h1 className="text-xl font-bold text-slate-800">Erreur</h1><p className="text-slate-500">{error}</p></div>;
    if (!quote) return null;

    const subTotal = items.reduce((acc, item) => acc + (item.quantity * item.unit_price), 0);
    const taxRate = (quote.payment_terms && quote.payment_terms.tax_rate) ? Number(quote.payment_terms.tax_rate) : 0;
    const taxAmount = subTotal * (taxRate / 100);
    const totalTTC = subTotal + taxAmount;

    return (
        <div className="min-h-screen bg-slate-100 py-12 px-4 sm:px-6 lg:px-8 font-sans">
            <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
                
                {/* Header */}
                <div className="bg-slate-900 text-white p-8">
                    <div className="flex justify-between items-start mb-8">
                        <div className="bg-white/10 p-2 rounded-lg backdrop-blur-md">
                            <Logo className="w-8 h-8" classNameText="text-xl" />
                        </div>
                        <div className="text-right">
                            <h1 className="text-2xl font-bold">Devis</h1>
                            <p className="text-indigo-200 text-sm mt-1">#{quote.id.slice(0, 8).toUpperCase()}</p>
                            <p className="text-slate-400 text-xs mt-1">Émis le {new Date(quote.created_at).toLocaleDateString()}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-8 mt-8 pt-8 border-t border-white/10">
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Émetteur</p>
                            <p className="font-bold">Skalia SRL</p>
                            <p className="text-sm text-slate-300">contact@skalia.io</p>
                            <p className="text-sm text-slate-300">Bruxelles, Belgique</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Client</p>
                            <p className="font-bold">{quote.recipient_company || quote.recipient_name}</p>
                            <p className="text-sm text-slate-300">{quote.recipient_email}</p>
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="p-8">
                    <h2 className="text-xl font-bold text-slate-900 mb-2">{quote.title}</h2>
                    <p className="text-slate-600 text-sm mb-8 leading-relaxed whitespace-pre-line">{quote.description}</p>

                    <div className="overflow-hidden rounded-lg border border-slate-200 mb-8">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 text-slate-500 font-medium">
                                <tr>
                                    <th className="px-4 py-3 font-semibold">Description</th>
                                    <th className="px-4 py-3 text-center font-semibold w-20">Qté</th>
                                    <th className="px-4 py-3 text-right font-semibold w-32">Total HT</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {items.map((item, idx) => (
                                    <tr key={idx}>
                                        <td className="px-4 py-3 text-slate-700">{item.description}</td>
                                        <td className="px-4 py-3 text-center text-slate-500">{item.quantity}</td>
                                        <td className="px-4 py-3 text-right text-slate-700 font-mono">
                                            {(item.unit_price * item.quantity).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex justify-end mb-8">
                        <div className="w-64 space-y-3">
                            <div className="flex justify-between text-slate-500 text-sm">
                                <span>Sous-total HT</span>
                                <span>{subTotal.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</span>
                            </div>
                            <div className="flex justify-between text-slate-500 text-sm">
                                <span>TVA ({taxRate}%)</span>
                                <span>{taxAmount.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</span>
                            </div>
                            <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
                                <span className="font-bold text-slate-800">Total TTC</span>
                                <span className="font-bold text-2xl text-indigo-600">
                                    {totalTTC.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="border-t border-slate-100 pt-8 flex flex-col items-center">
                        {success || quote.status === 'signed' ? (
                            <div className="text-center animate-fade-in">
                                <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-100">
                                    <CheckCircle2 size={32} />
                                </div>
                                <h3 className="text-xl font-bold text-slate-900">Devis signé !</h3>
                                <p className="text-slate-500 mt-1">Merci pour votre confiance. Vous allez recevoir une confirmation par email.</p>
                            </div>
                        ) : (
                            <button 
                                onClick={handleSign}
                                disabled={isSigning}
                                className="px-8 py-4 bg-slate-900 hover:bg-indigo-600 text-white font-bold rounded-xl shadow-xl transition-all transform hover:scale-105 active:scale-95 flex items-center gap-3 text-lg"
                            >
                                {isSigning ? <Loader2 className="animate-spin" /> : <>Signer le devis <ArrowRight size={20} /></>}
                            </button>
                        )}
                        
                        {quote.valid_until && (
                            <p className="text-xs text-slate-400 mt-4 flex items-center gap-1">
                                <Calendar size={12} /> Valide jusqu'au {new Date(quote.valid_until).toLocaleDateString()}
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PublicQuoteView;