import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2, CheckCircle2 } from 'lucide-react';
import Logo from './Logo';
import { useToast } from './ToastProvider';

interface PublicQuoteViewProps {
  quoteId: string;
}

const N8N_CREATE_INVOICE_WEBHOOK = "https://n8n-skalia-u41651.vm.elestio.app/webhook/de8b8392-51b4-4a45-875e-f11c9b6a0f6e";

const PublicQuoteView: React.FC<PublicQuoteViewProps> = ({ quoteId }) => {
  const [quote, setQuote] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSigning, setIsSigning] = useState(false);
  const [email, setEmail] = useState('');
  const toast = useToast();

  useEffect(() => {
    fetchQuote();
  }, [quoteId]);

  const fetchQuote = async () => {
    try {
        const { data, error } = await supabase
            .from('quotes')
            .select('*, quote_items(*)')
            .eq('id', quoteId)
            .single();

        if (error) throw error;
        setQuote(data);
        if (data.recipient_email) setEmail(data.recipient_email);
    } catch (err: any) {
        setError("Devis introuvable ou lien expiré.");
    } finally {
        setIsLoading(false);
    }
  };

  const handleAccept = async () => {
      if (!quote) return;
      setIsSigning(true);

      try {
          const userId = quote.profile_id;
          const isExistingClient = !!userId;

          const { error: updateError } = await supabase
              .from('quotes')
              .update({ 
                  status: 'signed', 
                  updated_at: new Date().toISOString() 
              })
              .eq('id', quote.id);

          if (updateError) throw updateError;

          if (userId) {
            const recurringItems = quote?.quote_items?.filter((i: any) => i.billing_frequency !== 'once') || [];
            
            const isRetainer = quote?.payment_terms?.quote_type === 'retainer';
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

            if (isExistingClient) {
                const { data: fullProfile } = await supabase.from('profiles').select('*').eq('id', userId).single();
                
                if (fullProfile) {
                    const clientPayload = {
                        email: fullProfile.email || email,
                        name: fullProfile.full_name || quote?.recipient_name,
                        company: fullProfile.company_name || quote?.recipient_company,
                        supabase_user_id: userId,
                        stripe_customer_id: fullProfile.stripe_customer_id || null, 
                        vat_number: fullProfile.vat_number || '',
                        phone: fullProfile.phone || '',
                        address_line1: fullProfile.address || '',
                        address_postal_code: '', 
                        address_city: '',
                        address_country: ''
                    };

                    const taxRate = quote?.payment_terms?.tax_rate || 0;

                    if (isRetainer) {
                        const { data: subs } = await supabase.from('client_subscriptions')
                            .select('*')
                            .eq('user_id', userId)
                            .eq('status', shouldActivateImmediately ? 'active' : 'pending')
                            .order('created_at', { ascending: false })
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

                            await fetch(N8N_CREATE_INVOICE_WEBHOOK, {
                                method: 'POST',
                                mode: 'no-cors',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(n8nPayload)
                            });

                            if (!shouldActivateImmediately) {
                                await supabase.from('client_subscriptions')
                                    .update({ status: 'active', start_date: new Date().toISOString() })
                                    .eq('id', subscription.id);
                            }
                        }
                    }
                }
            }
          }

          toast.success("Devis signé", "Merci ! Nous allons procéder à l'activation.");
          fetchQuote();

      } catch (err: any) {
          toast.error("Erreur", "Impossible de signer le devis.");
          console.error(err);
      } finally {
          setIsSigning(false);
      }
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-indigo-600" /></div>;
  if (error || !quote) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500">{error || "Devis introuvable"}</div>;

  return (
      <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
          <div className="max-w-3xl mx-auto">
              <div className="bg-white shadow-xl rounded-2xl overflow-hidden border border-slate-200">
                  <div className="p-8 md:p-12">
                      <div className="flex justify-between items-start mb-8">
                          <Logo classNameText="text-slate-900" />
                          <div className="text-right">
                              <h1 className="text-2xl font-bold text-slate-900">Devis #{quote.id.slice(0,8)}</h1>
                              <p className="text-slate-500 text-sm mt-1">{new Date(quote.created_at).toLocaleDateString()}</p>
                          </div>
                      </div>
                      
                      <div className="border-t border-slate-100 my-8"></div>

                      <div className="flex justify-between gap-8 mb-12">
                          <div>
                              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Émetteur</p>
                              <p className="font-bold text-slate-900">Skalia SRL</p>
                              <p className="text-slate-500 text-sm">contact@skalia.io</p>
                          </div>
                          <div className="text-right">
                              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Destinataire</p>
                              <p className="font-bold text-slate-900">{quote.recipient_company}</p>
                              <p className="text-slate-500 text-sm">{quote.recipient_name}</p>
                              <p className="text-slate-500 text-sm">{quote.recipient_email}</p>
                          </div>
                      </div>

                      <table className="w-full text-left mb-8">
                          <thead>
                              <tr className="border-b border-slate-200">
                                  <th className="pb-3 font-bold text-slate-600 text-sm">Description</th>
                                  <th className="pb-3 font-bold text-slate-600 text-sm text-center">Qté</th>
                                  <th className="pb-3 font-bold text-slate-600 text-sm text-right">Prix Unit.</th>
                                  <th className="pb-3 font-bold text-slate-600 text-sm text-right">Total</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                              {quote.quote_items?.map((item: any) => (
                                  <tr key={item.id}>
                                      <td className="py-4 text-slate-800 text-sm">{item.description}</td>
                                      <td className="py-4 text-slate-500 text-sm text-center">{item.quantity}</td>
                                      <td className="py-4 text-slate-500 text-sm text-right">{item.unit_price.toLocaleString()} €</td>
                                      <td className="py-4 text-slate-900 font-bold text-sm text-right">{(item.unit_price * item.quantity).toLocaleString()} €</td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>

                      <div className="flex justify-end">
                          <div className="w-64 space-y-2">
                              <div className="flex justify-between text-slate-500 text-sm">
                                  <span>Total HT</span>
                                  <span>{quote.total_amount.toLocaleString()} €</span>
                              </div>
                              <div className="pt-4 border-t border-slate-200 flex justify-between items-center">
                                  <span className="font-bold text-slate-900">Total TTC</span>
                                  <span className="text-2xl font-black text-indigo-600">{quote.total_amount.toLocaleString()} €</span>
                              </div>
                          </div>
                      </div>
                  </div>

                  <div className="bg-slate-50 p-8 border-t border-slate-200 flex justify-between items-center">
                      {quote.status === 'signed' || quote.status === 'paid' ? (
                          <div className="w-full text-center py-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 font-bold flex items-center justify-center gap-2">
                              <CheckCircle2 size={24} /> Devis signé le {new Date(quote.updated_at).toLocaleDateString()}
                          </div>
                      ) : (
                          <button 
                              onClick={handleAccept} 
                              disabled={isSigning}
                              className="w-full py-4 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                          >
                              {isSigning ? <Loader2 className="animate-spin" /> : "Accepter et Signer"}
                          </button>
                      )}
                  </div>
              </div>
          </div>
      </div>
  );
};

export default PublicQuoteView;