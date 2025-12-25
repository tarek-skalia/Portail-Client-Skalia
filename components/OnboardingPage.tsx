
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { CheckCircle2, Circle, ArrowRight, Play, Calendar, CreditCard, FileSignature, Lock, Loader2, Building, Mail, Phone, MapPin, Hash, Globe, Info, ArrowLeft } from 'lucide-react';
import { Client } from '../types';
import Logo from './Logo';
import { useToast } from './ToastProvider';

interface OnboardingPageProps {
  currentUser: Client;
  onComplete: () => void;
}

const STEPS = [
    { id: 1, label: 'Signature Devis', icon: FileSignature },
    { id: 2, label: 'Vidéo Bienvenue', icon: Play },
    { id: 3, label: 'Appel Lancement', icon: Calendar },
    { id: 4, label: 'Dossier Admin', icon: Building },
];

const N8N_CREATE_INVOICE_WEBHOOK = "https://n8n-skalia-u41651.vm.elestio.app/webhook/de8b8392-51b4-4a45-875e-f11c9b6a0f6e";

const OnboardingPage: React.FC<OnboardingPageProps> = ({ currentUser, onComplete }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [maxStepReached, setMaxStepReached] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingQuote, setPendingQuote] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const toast = useToast();

  const [billingInfo, setBillingInfo] = useState({
      companyName: '', 
      vatNumber: '',
      address: '',
      phone: '',
      website: ''
  });

  useEffect(() => {
      checkProgress();
  }, []);

  const checkProgress = async () => {
      const { data: profile } = await supabase.from('profiles').select('onboarding_step, company_name, phone, address, vat_number, logo_url').eq('id', currentUser.id).single();
      const dbStep = profile?.onboarding_step || 0;
      
      let realStep = 1;
      if (dbStep >= 1) realStep = 2;
      if (dbStep >= 2) realStep = 3;
      if (dbStep >= 3) realStep = 4;
      if (dbStep >= 4) {
          onComplete(); 
          return;
      }

      setMaxStepReached(realStep);
      setCurrentStep(realStep);

      if (profile) {
          setBillingInfo({
              companyName: profile.company_name || '',
              vatNumber: profile.vat_number || '',
              address: profile.address || '',
              phone: profile.phone || '',
              website: profile.logo_url || ''
          });
      }

      const { data: quotes } = await supabase.from('quotes')
        .select('*, quote_items(*)')
        .eq('profile_id', currentUser.id)
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (quotes && quotes.length > 0) {
          setPendingQuote(quotes[0]);
      }

      setIsLoading(false);
  };

  const updateStep = async (step: number) => {
      setIsLoading(true);
      await supabase.from('profiles').update({ onboarding_step: step }).eq('id', currentUser.id);
      
      if (step >= 4) {
          onComplete();
      } else {
          checkProgress();
      }
  };

  const handleStepAction = async () => {
      await updateStep(currentStep); 
  };

  const handleNavigate = (stepId: number) => {
      if (stepId <= maxStepReached) {
          setCurrentStep(stepId);
      }
  };

  const handleBillingSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSubmitting(true);

      try {
          // 1. Mise à jour Supabase Profil
          const { error } = await supabase.from('profiles').update({
              company_name: billingInfo.companyName,
              vat_number: billingInfo.vatNumber,
              address: billingInfo.address,
              phone: billingInfo.phone,
              logo_url: billingInfo.website,
              updated_at: new Date().toISOString()
          }).eq('id', currentUser.id);

          if (error) throw error;

          // 2. Traitement Financier (Facture One-Shot UNIQUEMENT)
          // L'abonnement a déjà été créé au moment de la signature (Magic Sign)
          if (pendingQuote) {
              const invoiceItems = pendingQuote.quote_items.filter((i: any) => i.billing_frequency === 'once');

              if (invoiceItems.length > 0) {
                  const invoiceAmount = invoiceItems.reduce((acc: number, item: any) => acc + (item.unit_price * item.quantity), 0);
                  const taxRate = pendingQuote.payment_terms?.tax_rate || 0;
                  const totalWithTax = invoiceAmount * (1 + taxRate / 100);

                  const issueDateObj = new Date();
                  const issueDateStr = issueDateObj.toISOString().split('T')[0];
                  
                  const dueDateObj = new Date(issueDateObj);
                  dueDateObj.setDate(dueDateObj.getDate() + 7);
                  const dueDateStr = dueDateObj.toISOString().split('T')[0];

                  const n8nPayload = {
                      client: {
                          email: currentUser.email,
                          name: currentUser.name,
                          company: billingInfo.companyName,
                          supabase_user_id: currentUser.id,
                          address: billingInfo.address,
                          vat_number: billingInfo.vatNumber,
                          phone: billingInfo.phone
                      },
                      invoice: {
                          projectName: pendingQuote.title,
                          issueDate: issueDateStr,
                          dueDate: dueDateStr,
                          amount: totalWithTax, 
                          quote_id: pendingQuote.id,
                          currency: 'eur',
                          tax_rate: taxRate,
                          status: 'pending'
                      },
                      items: invoiceItems // Seulement le One-Shot
                  };

                  console.log("Sending Invoice to N8N:", n8nPayload);

                  fetch(N8N_CREATE_INVOICE_WEBHOOK, {
                      method: 'POST',
                      mode: 'no-cors', 
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(n8nPayload)
                  });
              }
          }

          toast.success("Dossier validé", "Vos informations sont enregistrées et la facture est en cours de génération.");
          
          await updateStep(4);

      } catch (err: any) {
          console.error(err);
          toast.error("Erreur", "Impossible d'enregistrer les informations.");
          setIsSubmitting(false);
      }
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-indigo-600 w-12 h-12" /></div>;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
        {/* Top Bar */}
        <div className="h-20 bg-white border-b border-slate-200 flex items-center px-8 justify-between sticky top-0 z-50">
            <Logo classNameText="text-slate-900" />
            <div className="flex items-center gap-4">
                <span className="text-sm font-bold text-slate-500 uppercase tracking-wider hidden md:inline">Onboarding Client</span>
                <div className="bg-slate-100 px-3 py-1 rounded-full text-xs font-bold text-slate-600">
                    Étape {currentStep} sur 4
                </div>
            </div>
        </div>

        <div className="flex-1 flex flex-col md:flex-row">
            
            {/* Left Sidebar Steps */}
            <div className="w-full md:w-80 bg-white border-r border-slate-200 p-8 flex flex-col gap-8 sticky top-20 h-auto md:h-[calc(100vh-80px)]">
                {STEPS.map((step) => {
                    const isDone = maxStepReached > step.id; 
                    const isCurrent = currentStep === step.id;
                    const isClickable = step.id <= maxStepReached;

                    return (
                        <div 
                            key={step.id} 
                            onClick={() => isClickable && handleNavigate(step.id)}
                            className={`flex items-center gap-4 transition-all ${isClickable ? 'cursor-pointer hover:opacity-80' : 'opacity-40 cursor-not-allowed'}`}
                        >
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                                isDone ? 'bg-emerald-500 border-emerald-500 text-white' :
                                isCurrent ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200' :
                                'bg-white border-slate-200 text-slate-300'
                            }`}>
                                {isDone ? <CheckCircle2 size={20} /> : <step.icon size={18} />}
                            </div>
                            <span className={`font-bold ${isCurrent ? 'text-slate-900' : 'text-slate-500'}`}>{step.label}</span>
                        </div>
                    )
                })}
            </div>

            {/* Main Content */}
            <div className="flex-1 p-8 md:p-16 flex items-center justify-center bg-slate-50/50">
                <div className="max-w-2xl w-full bg-white rounded-3xl shadow-xl border border-slate-100 p-10 animate-fade-in-up relative">
                    
                    {currentStep > 1 && (
                        <button 
                            onClick={() => handleNavigate(currentStep - 1)}
                            className="absolute top-8 left-8 p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-full transition-colors"
                            title="Revenir à l'étape précédente"
                        >
                            <ArrowLeft size={20} />
                        </button>
                    )}

                    {/* STEP 1: SIGNATURE */}
                    {currentStep === 1 && (
                        <div className="text-center space-y-6">
                            <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6">
                                <FileSignature size={40} />
                            </div>
                            <h2 className="text-3xl font-extrabold text-slate-900">Validation de la proposition</h2>
                            <p className="text-slate-500 leading-relaxed max-w-lg mx-auto">
                                Pour démarrer notre collaboration, nous avons besoin de votre accord sur le devis initial.
                            </p>
                            
                            {pendingQuote ? (
                                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 my-8">
                                    <p className="font-bold text-slate-800 text-lg mb-1">{pendingQuote.title}</p>
                                    <p className="text-indigo-600 font-bold text-2xl mb-6">{pendingQuote.total_amount} €</p>
                                    
                                    {pendingQuote.status === 'signed' ? (
                                        <div className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-100 text-emerald-700 font-bold rounded-xl border border-emerald-200">
                                            <CheckCircle2 size={20} /> Devis Signé
                                        </div>
                                    ) : (
                                        <a 
                                            href={`/p/quote/${pendingQuote.id}`} 
                                            target="_blank"
                                            className="inline-flex items-center gap-2 px-8 py-4 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg hover:shadow-indigo-200"
                                        >
                                            Voir et Signer le devis <ArrowRight size={20} />
                                        </a>
                                    )}
                                    
                                    <p className="text-xs text-slate-400 mt-4">
                                        Une fois signé, revenez ici pour continuer (rafraîchissez la page si nécessaire).
                                    </p>
                                </div>
                            ) : (
                                <div className="p-6 bg-amber-50 text-amber-800 rounded-xl border border-amber-100">
                                    Aucun devis en attente. Si vous avez déjà signé, cliquez sur "Continuer".
                                </div>
                            )}
                            
                            <button onClick={handleStepAction} className="block w-full mt-4 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors">
                                Continuer
                            </button>
                        </div>
                    )}

                    {/* STEP 2: VIDEO */}
                    {currentStep === 2 && (
                        <div className="text-center space-y-6">
                            <h2 className="text-3xl font-extrabold text-slate-900">Bienvenue chez Skalia !</h2>
                            <p className="text-slate-500">Un petit message de Tarek pour vous expliquer la suite.</p>
                            
                            <div className="aspect-video bg-slate-900 rounded-2xl overflow-hidden shadow-2xl my-8 relative group cursor-pointer">
                                <img src="https://cdn.dribbble.com/users/1728247/screenshots/14299887/media/6b9d80c05763b03666632490333276df.png" className="w-full h-full object-cover opacity-80" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <Play size={40} className="text-white fill-white ml-2" />
                                    </div>
                                </div>
                            </div>

                            <button onClick={handleStepAction} className="w-full py-4 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg">
                                J'ai vu la vidéo, continuer
                            </button>
                        </div>
                    )}

                    {/* STEP 3: CALENDAR */}
                    {currentStep === 3 && (
                        <div className="text-center space-y-6">
                            <div className="w-16 h-16 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Calendar size={32} />
                            </div>
                            <h2 className="text-3xl font-extrabold text-slate-900">Programmer le Kick-off</h2>
                            <p className="text-slate-500">Choisissez un créneau pour notre atelier de lancement.</p>
                            
                            <div className="bg-white border border-slate-200 rounded-xl p-4 h-96 flex flex-col items-center justify-center text-slate-400 bg-slate-50 my-6">
                                <p className="font-medium mb-4">[Intégration Calendly ici]</p>
                                <a href="https://calendly.com" target="_blank" className="text-indigo-600 underline">Ouvrir Calendly dans un nouvel onglet</a>
                            </div>

                            <button onClick={handleStepAction} className="w-full py-4 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg">
                                Rendez-vous confirmé
                            </button>
                        </div>
                    )}

                    {/* STEP 4: DOSSIER ADMIN (BILLING) */}
                    {currentStep === 4 && (
                        <div className="space-y-6">
                            <div className="text-center mb-8">
                                <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Building size={32} />
                                </div>
                                <h2 className="text-2xl font-extrabold text-slate-900">Informations de facturation</h2>
                                <p className="text-slate-500 text-sm">Ces données serviront à établir votre facture automatiquement.</p>
                            </div>

                            <form onSubmit={handleBillingSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Nom légal de la société</label>
                                    <div className="relative">
                                        <Building size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input 
                                            type="text" 
                                            required
                                            value={billingInfo.companyName}
                                            onChange={(e) => setBillingInfo({...billingInfo, companyName: e.target.value})}
                                            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold text-slate-800"
                                            placeholder="Ma Société SRL"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Numéro de TVA</label>
                                        <div className="relative">
                                            <Hash size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input 
                                                type="text" 
                                                value={billingInfo.vatNumber}
                                                onChange={(e) => setBillingInfo({...billingInfo, vatNumber: e.target.value})}
                                                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
                                                placeholder="BE 0123.456.789"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Téléphone</label>
                                        <div className="relative">
                                            <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input 
                                                type="tel" 
                                                value={billingInfo.phone}
                                                onChange={(e) => setBillingInfo({...billingInfo, phone: e.target.value})}
                                                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
                                                placeholder="+32 4..."
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Adresse de Facturation Complète</label>
                                    <div className="relative">
                                        <MapPin size={16} className="absolute left-4 top-3 text-slate-400" />
                                        <textarea 
                                            rows={2}
                                            required
                                            value={billingInfo.address}
                                            onChange={(e) => setBillingInfo({...billingInfo, address: e.target.value})}
                                            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium resize-none"
                                            placeholder="Rue, Numéro, Code Postal, Ville"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Site Web (Optionnel)</label>
                                    <div className="relative">
                                        <Globe size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input 
                                            type="text" 
                                            value={billingInfo.website}
                                            onChange={(e) => setBillingInfo({...billingInfo, website: e.target.value})}
                                            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
                                            placeholder="www.monsite.com"
                                        />
                                    </div>
                                </div>

                                <div className="pt-4">
                                    <button 
                                        type="submit" 
                                        disabled={isSubmitting}
                                        className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-70 transform active:scale-95"
                                    >
                                        {isSubmitting ? <Loader2 className="animate-spin" /> : 'Valider et Accéder au Portail'}
                                    </button>
                                    <p className="text-[10px] text-center text-slate-400 mt-3 flex items-center justify-center gap-1">
                                        <Info size={12} /> La facture sera générée pour le paiement du setup.
                                    </p>
                                </div>
                            </form>
                        </div>
                    )}

                </div>
            </div>
        </div>
    </div>
  );
};

export default OnboardingPage;
