
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Client, Quote, ClientSubscription } from '../types';
import { useToast } from './ToastProvider';
import { CheckCircle2, ChevronRight, Building, FileText, Rocket, Loader2, User, Globe, MapPin, Hash } from 'lucide-react';
import Logo from './Logo';

const N8N_CREATE_INVOICE_WEBHOOK = "https://n8n-skalia-u41651.vm.elestio.app/webhook/de8b8392-51b4-4a45-875e-f11c9b6a0f6e";

interface OnboardingPageProps {
  currentUser: Client;
  onComplete: () => void;
}

const OnboardingPage: React.FC<OnboardingPageProps> = ({ currentUser, onComplete }) => {
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  
  // Data State
  const [formData, setFormData] = useState({
      companyName: currentUser.company || '',
      fullName: currentUser.name || '',
      phone: '',
      website: '',
      address: '',
      vatNumber: ''
  });

  const [pendingQuote, setPendingQuote] = useState<Quote | null>(null);
  const [subscription, setSubscription] = useState<ClientSubscription | null>(null);

  useEffect(() => {
      fetchOnboardingData();
  }, [currentUser.id]);

  const fetchOnboardingData = async () => {
      setIsLoading(true);
      try {
          // 1. Fetch Profile Details
          const { data: profile } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single();
          if (profile) {
              setFormData({
                  companyName: profile.company_name || currentUser.company || '',
                  fullName: profile.full_name || currentUser.name || '',
                  phone: profile.phone || '',
                  website: profile.logo_url || '',
                  address: profile.address || '',
                  vatNumber: profile.vat_number || ''
              });
              
              // Restore step if saved
              if (profile.onboarding_step && profile.onboarding_step > 1) {
                  setStep(profile.onboarding_step);
              }
          }

          // 2. Fetch Pending Quote (Sent or Draft associated to profile)
          const { data: quotes } = await supabase
              .from('quotes')
              .select('*')
              .eq('profile_id', currentUser.id)
              .in('status', ['sent', 'draft'])
              .order('created_at', { ascending: false })
              .limit(1);
          
          if (quotes && quotes.length > 0) {
              setPendingQuote(quotes[0] as any);
          }

          // 3. Fetch Pending Subscription
          const { data: subs } = await supabase
              .from('client_subscriptions')
              .select('*')
              .eq('user_id', currentUser.id)
              .eq('status', 'pending')
              .limit(1);
          
          if (subs && subs.length > 0) {
              setSubscription({
                  id: subs[0].id,
                  clientId: subs[0].user_id,
                  serviceName: subs[0].service_name,
                  amount: subs[0].amount,
                  currency: subs[0].currency,
                  billingCycle: subs[0].billing_cycle,
                  status: subs[0].status,
                  createdAt: subs[0].created_at
              });
          }

      } catch (error) {
          console.error("Onboarding data error:", error);
      } finally {
          setIsLoading(false);
      }
  };

  const updateProfileStep = async (newStep: number) => {
      await supabase.from('profiles').update({ onboarding_step: newStep }).eq('id', currentUser.id);
      setStep(newStep);
  };

  const handleStep1Submit = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsLoading(true);
      try {
          const { error } = await supabase.from('profiles').update({
              company_name: formData.companyName,
              full_name: formData.fullName,
              phone: formData.phone,
              logo_url: formData.website,
              address: formData.address,
              vat_number: formData.vatNumber,
              updated_at: new Date().toISOString()
          }).eq('id', currentUser.id);

          if (error) throw error;
          await updateProfileStep(2);
      } catch (err) {
          toast.error("Erreur", "Impossible de sauvegarder les informations.");
      } finally {
          setIsLoading(false);
      }
  };

  const handleStep2Submit = async () => {
      setIsLoading(true);
      try {
          // Si il y a un devis en attente, on le passe en signé
          if (pendingQuote) {
              await supabase.from('quotes').update({ 
                  status: 'signed',
                  updated_at: new Date().toISOString()
              }).eq('id', pendingQuote.id);
          }
          await updateProfileStep(3);
      } catch (err) {
          toast.error("Erreur", "Impossible de valider l'étape.");
      } finally {
          setIsLoading(false);
      }
  };

  const handleStep3Submit = async () => {
      setIsLoading(true);
      try {
          // --- ACTIVATION ABONNEMENT VIA N8N ---
          
          // Préparation des données client pour le webhook
          const clientPayload = {
              email: currentUser.email,
              name: formData.fullName,
              company: formData.companyName,
              supabase_user_id: currentUser.id,
              stripe_customer_id: currentUser.stripeCustomerId
          };

          // Récupération Tax Rate depuis le devis si dispo
          const taxRate = (pendingQuote?.payment_terms as any)?.tax_rate || 0;

          const n8nPayload = {
              mode: 'subscription_start', // SIGNAL POUR N8N
              client: clientPayload,
              subscription: subscription ? {
                  id: subscription.id,
                  name: subscription.serviceName, // CORRECTION: serviceName au lieu de service_name
                  amount: subscription.amount,
                  interval: subscription.billingCycle === 'monthly' ? 'month' : 'year', // CORRECTION: billingCycle
                  currency: 'eur',
                  tax_rate: taxRate, 
                  price_includes_tax: false,
                  duration: pendingQuote?.delivery_delay || 'Indéterminée'
              } : null
          };

          // Si on a bien un abonnement à activer
          if (subscription) {
              await fetch(N8N_CREATE_INVOICE_WEBHOOK, {
                  method: 'POST',
                  mode: 'no-cors', 
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(n8nPayload)
              });
              
              // Activation locale immédiate
              await supabase.from('client_subscriptions').update({ status: 'active', start_date: new Date().toISOString() }).eq('id', subscription.id);
          }

          // Finalisation
          await updateProfileStep(4);
          onComplete(); // Rafraichit l'app pour sortir de l'onboarding

      } catch (err: any) {
          console.error(err);
          toast.error("Erreur", "Une erreur est survenue lors de l'activation.");
      } finally {
          setIsLoading(false);
      }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        
        {/* Progress Bar */}
        <div className="w-full max-w-2xl mb-8">
            <div className="flex justify-between mb-2 px-2">
                <span className={`text-xs font-bold uppercase tracking-wider ${step >= 1 ? 'text-indigo-600' : 'text-slate-400'}`}>Bienvenue</span>
                <span className={`text-xs font-bold uppercase tracking-wider ${step >= 2 ? 'text-indigo-600' : 'text-slate-400'}`}>Entreprise</span>
                <span className={`text-xs font-bold uppercase tracking-wider ${step >= 3 ? 'text-indigo-600' : 'text-slate-400'}`}>Validation</span>
                <span className={`text-xs font-bold uppercase tracking-wider ${step >= 4 ? 'text-indigo-600' : 'text-slate-400'}`}>Accès</span>
            </div>
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-600 transition-all duration-500 ease-out" style={{ width: `${(step / 4) * 100}%` }}></div>
            </div>
        </div>

        <div className="bg-white w-full max-w-2xl rounded-3xl shadow-xl border border-slate-200 overflow-hidden relative min-h-[500px] flex flex-col">
            
            {/* Header */}
            <div className="bg-slate-900 text-white p-8 text-center relative overflow-hidden shrink-0">
                <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-indigo-500/20 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2"></div>
                <div className="relative z-10">
                    <div className="inline-flex mb-4 bg-white/10 p-3 rounded-2xl backdrop-blur-md border border-white/20">
                        <Logo className="w-8 h-8" showText={false} />
                    </div>
                    <h1 className="text-2xl font-bold mb-2">Configuration de votre espace</h1>
                    <p className="text-indigo-200 text-sm">Finalisez votre inscription pour accéder à Skalia.</p>
                </div>
            </div>

            {/* Content Body */}
            <div className="flex-1 p-8 flex flex-col justify-center">
                
                {/* STEP 1: COMPANY INFO */}
                {step === 1 && (
                    <form onSubmit={handleStep1Submit} className="space-y-6 animate-fade-in">
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <Building className="text-indigo-600" /> Informations Entreprise
                        </h2>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Nom Complet</label>
                                <div className="relative"><User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input type="text" required value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-all" /></div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Société</label>
                                <div className="relative"><Building className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input type="text" required value={formData.companyName} onChange={e => setFormData({...formData, companyName: e.target.value})} className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-all" /></div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Site Web</label>
                                <div className="relative"><Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input type="url" value={formData.website} onChange={e => setFormData({...formData, website: e.target.value})} className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-all" placeholder="https://..." /></div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">TVA (Optionnel)</label>
                                <div className="relative"><Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input type="text" value={formData.vatNumber} onChange={e => setFormData({...formData, vatNumber: e.target.value})} className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-all" /></div>
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Adresse</label>
                                <div className="relative"><MapPin className="absolute left-3 top-3 text-slate-400" size={16} /><textarea rows={2} value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-all resize-none" /></div>
                            </div>
                        </div>

                        <div className="flex justify-end pt-4">
                            <button type="submit" disabled={isLoading} className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg transition-all flex items-center gap-2">
                                {isLoading ? <Loader2 className="animate-spin" /> : <>Suivant <ChevronRight size={18} /></>}
                            </button>
                        </div>
                    </form>
                )}

                {/* STEP 2: QUOTE REVIEW */}
                {step === 2 && (
                    <div className="space-y-6 animate-fade-in">
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <FileText className="text-indigo-600" /> Validation de l'offre
                        </h2>
                        
                        {pendingQuote ? (
                            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                                <h3 className="font-bold text-lg text-slate-900 mb-2">{pendingQuote.title}</h3>
                                <p className="text-slate-600 text-sm mb-4">{pendingQuote.description}</p>
                                
                                <div className="flex justify-between items-center pt-4 border-t border-slate-200">
                                    <span className="text-sm font-medium text-slate-500">Montant Total</span>
                                    <span className="text-xl font-extrabold text-indigo-600">{pendingQuote.total_amount.toLocaleString('fr-FR', {style: 'currency', currency: 'EUR'})}</span>
                                </div>
                            </div>
                        ) : (
                            <div className="p-6 bg-slate-50 rounded-2xl border border-dashed border-slate-300 text-center">
                                <p className="text-slate-500 italic">Aucun devis en attente pour le moment.</p>
                            </div>
                        )}

                        <div className="flex justify-end pt-4 gap-4">
                            <button onClick={() => setStep(1)} className="px-6 py-3 text-slate-500 font-bold hover:text-slate-800 transition-colors">Retour</button>
                            <button onClick={handleStep2Submit} disabled={isLoading} className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg transition-all flex items-center gap-2">
                                {isLoading ? <Loader2 className="animate-spin" /> : <>Valider et Continuer <ChevronRight size={18} /></>}
                            </button>
                        </div>
                    </div>
                )}

                {/* STEP 3: SUBSCRIPTION & FINALIZATION */}
                {step === 3 && (
                    <div className="space-y-6 animate-fade-in text-center">
                        <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-100 shadow-sm">
                            <Rocket size={40} />
                        </div>
                        
                        <h2 className="text-2xl font-bold text-slate-900">Tout est prêt !</h2>
                        <p className="text-slate-500 max-w-md mx-auto">
                            En cliquant sur "Accéder à mon espace", vous confirmez votre inscription.
                            {subscription && (
                                <span className="block mt-2 text-indigo-600 font-medium bg-indigo-50 py-2 px-4 rounded-lg inline-block">
                                    Abonnement : {subscription.serviceName} ({subscription.amount}€/mois)
                                </span>
                            )}
                        </p>

                        <div className="pt-8">
                            <button onClick={handleStep3Submit} disabled={isLoading} className="w-full max-w-sm px-8 py-4 bg-slate-900 hover:bg-indigo-600 text-white font-bold rounded-xl shadow-xl transition-all flex items-center justify-center gap-3 transform hover:scale-105 active:scale-95">
                                {isLoading ? <Loader2 className="animate-spin" /> : <>Accéder à mon espace <CheckCircle2 size={20} /></>}
                            </button>
                        </div>
                    </div>
                )}

                {/* STEP 4: REDIRECTING... */}
                {step === 4 && (
                    <div className="flex flex-col items-center justify-center h-full text-center space-y-4 animate-fade-in">
                        <Loader2 size={48} className="text-indigo-600 animate-spin" />
                        <h3 className="text-xl font-bold text-slate-800">Initialisation de votre portail...</h3>
                        <p className="text-slate-500">Nous configurons vos accès.</p>
                    </div>
                )}

            </div>
        </div>
    </div>
  );
};

export default OnboardingPage;
