
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
    CheckCircle2, ArrowRight, Play, Calendar, FileSignature, 
    Building, Mail, Phone, MapPin, Hash, Globe, Info, 
    ArrowLeft, Flag, Check, Loader2, Sparkles, Lock
} from 'lucide-react';
import { Client } from '../types';
import Logo from './Logo';
import { useToast } from './ToastProvider';

interface OnboardingPageProps {
  currentUser: Client;
  onComplete: () => void;
}

const STEPS = [
    { id: 1, label: 'Signature du Devis', icon: FileSignature, desc: "Validation de l'offre commerciale" },
    { id: 2, label: 'Message de Bienvenue', icon: Play, desc: "Introduction par l'équipe" },
    { id: 3, label: 'Session de Lancement', icon: Calendar, desc: "Planification du Kick-off" },
    { id: 4, label: 'Dossier Administratif', icon: Building, desc: "Facturation et légal" },
];

// Configuration Pays & TVA
const COUNTRY_CONFIG: Record<string, { label: string, dial: string, vatPrefix: string, vatLength: number }> = {
    'BE': { label: 'Belgique', dial: '+32', vatPrefix: 'BE', vatLength: 10 },
    'FR': { label: 'France', dial: '+33', vatPrefix: 'FR', vatLength: 11 },
    'CH': { label: 'Suisse', dial: '+41', vatPrefix: 'CHE', vatLength: 9 }, // CHE-123.456.789
    'LU': { label: 'Luxembourg', dial: '+352', vatPrefix: 'LU', vatLength: 8 },
    'CA': { label: 'Canada', dial: '+1', vatPrefix: '', vatLength: 0 },
    'US': { label: 'États-Unis', dial: '+1', vatPrefix: '', vatLength: 0 },
    'GB': { label: 'Royaume-Uni', dial: '+44', vatPrefix: 'GB', vatLength: 9 },
};

const N8N_CREATE_INVOICE_WEBHOOK = "https://n8n-skalia-u41651.vm.elestio.app/webhook/de8b8392-51b4-4a45-875e-f11c9b6a0f6e";

const OnboardingPage: React.FC<OnboardingPageProps> = ({ currentUser, onComplete }) => {
  const toast = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [maxStepReached, setMaxStepReached] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingQuote, setPendingQuote] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- FORM STATE ---
  const [countryCode, setCountryCode] = useState('BE');
  const [phonePrefix, setPhonePrefix] = useState('+32');
  const [phoneNumber, setPhoneNumber] = useState('');
  
  const [billingInfo, setBillingInfo] = useState({
      companyName: '', 
      vatNumber: '',
      addressLine1: '',
      postalCode: '',
      city: '',
      website: ''
  });

  const [vatError, setVatError] = useState('');

  // Initialisation
  useEffect(() => {
      checkProgress();
  }, []);

  // Synchronisation Pays -> Préfixe TVA & Tel
  useEffect(() => {
      const config = COUNTRY_CONFIG[countryCode];
      if (config) {
          setPhonePrefix(config.dial);
          
          // Si le champ TVA est vide ou contient juste un ancien préfixe, on met le nouveau
          const currentVat = billingInfo.vatNumber;
          const isJustPrefix = Object.values(COUNTRY_CONFIG).some(c => c.vatPrefix === currentVat);
          
          if (!currentVat || isJustPrefix) {
              setBillingInfo(prev => ({ ...prev, vatNumber: config.vatPrefix }));
          }
      }
  }, [countryCode]);

  // Validation TVA temps réel
  useEffect(() => {
      const config = COUNTRY_CONFIG[countryCode];
      if (config && config.vatPrefix) {
          // On retire le préfixe pour compter les chiffres
          const numericPart = billingInfo.vatNumber.replace(config.vatPrefix, '').replace(/[^0-9]/g, '');
          
          if (!billingInfo.vatNumber.startsWith(config.vatPrefix)) {
              setVatError(`Doit commencer par ${config.vatPrefix}`);
          } else if (config.vatLength > 0 && numericPart.length !== config.vatLength) {
              setVatError(`Doit contenir ${config.vatLength} chiffres (actuel: ${numericPart.length})`);
          } else {
              setVatError('');
          }
      } else {
          setVatError('');
      }
  }, [billingInfo.vatNumber, countryCode]);

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
          setBillingInfo(prev => ({
              ...prev,
              companyName: profile.company_name || '',
              vatNumber: profile.vat_number || 'BE',
              website: profile.logo_url || '',
              addressLine1: profile.address || '' 
          }));
          
          // Tentative parsing téléphone existant (si présent)
          if (profile.phone) {
              setPhoneNumber(profile.phone); 
          }
      }

      // Check Quote Status
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
      // On sauvegarde l'étape atteinte en base
      await supabase.from('profiles').update({ onboarding_step: step }).eq('id', currentUser.id);
      
      if (step >= 4) {
          onComplete(); // Fin du flow -> Refresh App
      } else {
          checkProgress();
      }
  };

  const handleStepAction = async () => {
      // Pour l'étape 1, on vérifie que le devis est signé (sécurité frontend)
      if (currentStep === 1) {
          if (pendingQuote && pendingQuote.status !== 'signed' && pendingQuote.status !== 'paid') {
              toast.warning("Signature requise", "Veuillez signer le devis avant de continuer.");
              return;
          }
      }
      await updateStep(currentStep); 
  };

  const handleNavigate = (stepId: number) => {
      // Sécurité : On ne peut pas aller plus loin que ce qu'on a validé
      if (stepId <= maxStepReached) {
          setCurrentStep(stepId);
      }
  };

  // Validation formulaire étape 4
  const isFormValid = () => {
      if (!billingInfo.companyName) return false;
      if (!billingInfo.addressLine1) return false;
      if (!billingInfo.postalCode) return false;
      if (!billingInfo.city) return false;
      if (!phoneNumber) return false;
      if (vatError) return false; // Bloque si format TVA invalide
      return true;
  };

  const handleBillingSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!isFormValid()) return;
      
      setIsSubmitting(true);

      try {
          // Reconstitution de l'adresse complète pour Supabase (Stockage simple)
          const config = COUNTRY_CONFIG[countryCode];
          const countryLabel = config?.label || countryCode;
          const fullAddress = `${billingInfo.addressLine1}, ${billingInfo.postalCode} ${billingInfo.city}, ${countryLabel}`;
          const fullPhone = `${phonePrefix}${phoneNumber.replace(/^0+/, '')}`; // Retire le 0 initial si présent

          // 1. Mise à jour Supabase Profil
          const { error } = await supabase.from('profiles').update({
              company_name: billingInfo.companyName,
              vat_number: billingInfo.vatNumber,
              address: fullAddress,
              phone: fullPhone,
              logo_url: billingInfo.website,
              updated_at: new Date().toISOString()
          }).eq('id', currentUser.id);

          if (error) throw error;

          // 2. Traitement Financier (Facture One-Shot)
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
                          vat_number: billingInfo.vatNumber,
                          phone: fullPhone,
                          // STRUCTURED ADDRESS
                          address_line1: billingInfo.addressLine1,
                          address_postal_code: billingInfo.postalCode,
                          address_city: billingInfo.city,
                          address_country: countryCode 
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
                      items: invoiceItems
                  };

                  // Fire & Forget
                  fetch(N8N_CREATE_INVOICE_WEBHOOK, {
                      method: 'POST',
                      mode: 'no-cors', 
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(n8nPayload)
                  });
              }
          }

          toast.success("Dossier validé", "Bienvenue à bord ! Accès au portail en cours...");
          
          // Petit délai pour l'expérience utilisateur
          setTimeout(() => {
              updateStep(4);
          }, 1500);

      } catch (err: any) {
          console.error(err);
          toast.error("Erreur", "Impossible d'enregistrer les informations.");
          setIsSubmitting(false);
      }
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-950"><Loader2 className="animate-spin text-indigo-500 w-12 h-12" /></div>;

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans overflow-hidden selection:bg-indigo-200 selection:text-indigo-900">
        
        {/* --- LEFT SIDEBAR (DARK) --- */}
        <div className="w-[400px] bg-slate-900 text-white flex flex-col justify-between p-10 relative overflow-hidden shrink-0 hidden lg:flex">
            {/* Background Effects */}
            <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-indigo-600/20 rounded-full blur-[100px] translate-x-1/2 -translate-y-1/2"></div>
            <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-purple-600/20 rounded-full blur-[100px] -translate-x-1/2 translate-y-1/2"></div>

            <div className="relative z-10">
                <div className="mb-12">
                    <Logo showText={true} classNameText="text-2xl tracking-widest font-bold" />
                </div>
                
                <h1 className="text-3xl font-bold mb-2">Initialisation</h1>
                <p className="text-indigo-200 mb-12">Configurez votre espace en 4 étapes.</p>

                <div className="space-y-8 relative">
                    {/* Vertical Line */}
                    <div className="absolute left-6 top-4 bottom-4 w-0.5 bg-slate-800 z-0"></div>

                    {STEPS.map((step) => {
                        const isDone = maxStepReached > step.id; 
                        const isCurrent = currentStep === step.id;
                        const isLocked = step.id > maxStepReached;

                        return (
                            <div 
                                key={step.id} 
                                className={`relative z-10 flex items-start gap-5 transition-all duration-500 ${isLocked ? 'opacity-40 grayscale' : 'opacity-100'}`}
                            >
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border-2 transition-all duration-300 shadow-lg ${
                                    isDone ? 'bg-emerald-500 border-emerald-500 text-white' :
                                    isCurrent ? 'bg-indigo-600 border-indigo-500 text-white scale-110 shadow-indigo-500/30' :
                                    'bg-slate-800 border-slate-700 text-slate-400'
                                }`}>
                                    {isDone ? <Check size={20} strokeWidth={3} /> : <step.icon size={20} />}
                                </div>
                                <div className={`pt-1 transition-all duration-300 ${isCurrent ? 'translate-x-2' : ''}`}>
                                    <p className={`font-bold text-lg ${isCurrent ? 'text-white' : 'text-slate-400'}`}>{step.label}</p>
                                    <p className="text-xs text-slate-500 mt-0.5 font-medium uppercase tracking-wide">{step.desc}</p>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            <div className="relative z-10 text-xs text-slate-600 font-mono">
                SESSION ID: {currentUser.id.slice(0,8).toUpperCase()}
            </div>
        </div>

        {/* --- MAIN CONTENT --- */}
        <div className="flex-1 relative flex flex-col">
            
            {/* Header Mobile Only */}
            <div className="lg:hidden h-16 bg-white border-b border-slate-200 flex items-center px-6 justify-between sticky top-0 z-50">
                <Logo classNameText="text-slate-900" />
                <div className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                    {currentStep} / 4
                </div>
            </div>

            {/* Back Button (Masqué à l'étape 2 et 1) */}
            {currentStep > 2 && (
                <button 
                    onClick={() => handleNavigate(currentStep - 1)}
                    className="absolute top-8 left-8 p-3 text-slate-400 hover:text-indigo-600 hover:bg-white bg-slate-50 rounded-xl transition-all shadow-sm hover:shadow-md z-40 hidden lg:block"
                    title="Retour"
                >
                    <ArrowLeft size={20} />
                </button>
            )}

            <div className="flex-1 overflow-y-auto p-6 md:p-12 lg:p-20 flex items-center justify-center">
                <div className="max-w-2xl w-full mx-auto">
                    
                    {/* --- STEP 1: SIGNATURE --- */}
                    {currentStep === 1 && (
                        <div className="text-center animate-fade-in-up">
                            <div className="w-24 h-24 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
                                <FileSignature size={40} />
                            </div>
                            <h2 className="text-4xl font-extrabold text-slate-900 mb-4">Validation du devis</h2>
                            <p className="text-slate-500 text-lg leading-relaxed max-w-lg mx-auto mb-10">
                                Pour démarrer notre collaboration sur des bases saines, nous avons besoin de votre accord formel.
                            </p>
                            
                            {pendingQuote ? (
                                <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/50 mb-10 hover:border-indigo-200 transition-colors relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-bl-full -mr-4 -mt-4 z-0"></div>
                                    <div className="relative z-10">
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">PROJET</p>
                                        <p className="font-bold text-slate-900 text-2xl mb-1">{pendingQuote.title}</p>
                                        <p className="text-indigo-600 font-black text-3xl mb-8">{pendingQuote.total_amount.toLocaleString()} €</p>
                                        
                                        {pendingQuote.status === 'signed' ? (
                                            <div className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-100 text-emerald-700 font-bold rounded-xl border border-emerald-200">
                                                <CheckCircle2 size={20} /> Devis Signé avec succès
                                            </div>
                                        ) : (
                                            <a 
                                                href={`/p/quote/${pendingQuote.id}`} 
                                                target="_blank"
                                                className="inline-flex items-center gap-3 px-8 py-4 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all shadow-lg hover:shadow-indigo-300 transform hover:-translate-y-1"
                                            >
                                                Voir et Signer le devis <ArrowRight size={20} />
                                            </a>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="p-6 bg-amber-50 text-amber-800 rounded-xl border border-amber-100 mb-8">
                                    Aucun devis en attente. Si vous avez déjà signé, cliquez sur "Continuer".
                                </div>
                            )}
                            
                            <button 
                                onClick={handleStepAction} 
                                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold text-lg hover:bg-slate-800 transition-colors shadow-lg"
                            >
                                Continuer vers l'étape suivante
                            </button>
                        </div>
                    )}

                    {/* --- STEP 2: VIDEO --- */}
                    {currentStep === 2 && (
                        <div className="text-center animate-fade-in-up">
                            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-50 text-purple-700 text-xs font-bold uppercase tracking-widest mb-6 border border-purple-100">
                                <Sparkles size={14} /> Message de l'équipe
                            </span>
                            <h2 className="text-4xl font-extrabold text-slate-900 mb-4">Bienvenue chez Skalia !</h2>
                            <p className="text-slate-500 text-lg mb-10">Un petit mot de Tarek pour vous expliquer la suite des événements.</p>
                            
                            <div className="aspect-video bg-slate-900 rounded-3xl overflow-hidden shadow-2xl mb-10 relative group cursor-pointer border-4 border-slate-100">
                                <img src="https://cdn.dribbble.com/users/1728247/screenshots/14299887/media/6b9d80c05763b03666632490333276df.png" className="w-full h-full object-cover opacity-80 group-hover:opacity-60 transition-opacity duration-500" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-24 h-24 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300 border border-white/30 shadow-2xl">
                                        <Play size={40} className="text-white fill-white ml-2" />
                                    </div>
                                </div>
                            </div>

                            <button onClick={handleStepAction} className="w-full py-4 bg-indigo-600 text-white font-bold text-lg rounded-2xl hover:bg-indigo-700 transition-all shadow-lg hover:shadow-indigo-300 transform hover:-translate-y-1">
                                C'est vu, passons à la suite
                            </button>
                        </div>
                    )}

                    {/* --- STEP 3: CALENDAR --- */}
                    {currentStep === 3 && (
                        <div className="text-center animate-fade-in-up">
                            <div className="w-20 h-20 bg-purple-50 text-purple-600 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-inner border border-purple-100 transform rotate-3">
                                <Calendar size={36} />
                            </div>
                            <h2 className="text-3xl font-extrabold text-slate-900 mb-4">Programmer le Kick-off</h2>
                            <p className="text-slate-500 text-lg mb-8">Choisissez le créneau idéal pour notre atelier de lancement.</p>
                            
                            <div className="bg-white border border-slate-200 rounded-3xl p-4 h-[500px] flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 mb-8 shadow-inner">
                                <p className="font-medium mb-4">[Intégration Calendly ici]</p>
                                <a href="https://calendly.com" target="_blank" className="text-indigo-600 underline font-bold">Ouvrir Calendly</a>
                            </div>

                            <button onClick={handleStepAction} className="w-full py-4 bg-indigo-600 text-white font-bold text-lg rounded-2xl hover:bg-indigo-700 transition-all shadow-lg hover:shadow-indigo-300">
                                Rendez-vous confirmé
                            </button>
                        </div>
                    )}

                    {/* --- STEP 4: BILLING (UPDATED) --- */}
                    {currentStep === 4 && (
                        <div className="animate-fade-in-up">
                            <div className="text-center mb-10">
                                <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-100">
                                    <Building size={30} />
                                </div>
                                <h2 className="text-3xl font-extrabold text-slate-900">Dossier Administratif</h2>
                                <p className="text-slate-500 mt-2">Ces données légales sont obligatoires pour la facturation.</p>
                            </div>

                            <form onSubmit={handleBillingSubmit} className="space-y-6">
                                {/* SECTION IDENTITÉ */}
                                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1 flex items-center gap-1">Nom légal de la société <span className="text-red-500">*</span></label>
                                        <div className="relative group">
                                            <Building size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                                            <input 
                                                type="text" 
                                                required
                                                value={billingInfo.companyName}
                                                onChange={(e) => setBillingInfo({...billingInfo, companyName: e.target.value})}
                                                className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-sm font-bold text-slate-800 transition-all"
                                                placeholder="Ma Société SRL"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        {/* PAYS SELECTOR */}
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1 flex items-center gap-1">Pays <span className="text-red-500">*</span></label>
                                            <div className="relative group">
                                                <Flag size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500" />
                                                <select
                                                    value={countryCode}
                                                    onChange={(e) => setCountryCode(e.target.value)}
                                                    className="w-full pl-12 pr-10 py-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-sm font-bold text-slate-800 appearance-none cursor-pointer transition-all"
                                                >
                                                    {Object.entries(COUNTRY_CONFIG).map(([code, conf]) => (
                                                        <option key={code} value={code}>{conf.label}</option>
                                                    ))}
                                                    <option value="OTHER">Autre</option>
                                                </select>
                                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">▼</div>
                                            </div>
                                        </div>

                                        {/* TVA DYNAMIQUE */}
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1 flex items-center gap-1">
                                                Numéro de TVA <span className="text-red-500">*</span>
                                                {vatError && <span className="text-red-500 text-[9px] ml-auto bg-red-50 px-2 py-0.5 rounded">{vatError}</span>}
                                            </label>
                                            <div className="relative group">
                                                <Hash size={18} className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${vatError ? 'text-red-400' : 'text-slate-400 group-focus-within:text-indigo-500'}`} />
                                                <input 
                                                    type="text" 
                                                    required
                                                    value={billingInfo.vatNumber}
                                                    onChange={(e) => setBillingInfo({...billingInfo, vatNumber: e.target.value.toUpperCase()})}
                                                    className={`w-full pl-12 pr-4 py-3.5 bg-slate-50 border rounded-xl outline-none focus:ring-2 focus:bg-white text-sm font-bold text-slate-800 transition-all ${vatError ? 'border-red-300 focus:ring-red-200' : 'border-slate-200 focus:ring-indigo-500'}`}
                                                    placeholder="BE 0123.456.789"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* TELEPHONE (PREFIX + NUMBER) */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1 flex items-center gap-1">Téléphone <span className="text-red-500">*</span></label>
                                        <div className="flex gap-3">
                                            <div className="w-28 relative">
                                                <select 
                                                    value={phonePrefix}
                                                    onChange={(e) => setPhonePrefix(e.target.value)}
                                                    className="w-full pl-3 pr-6 py-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold text-slate-700 appearance-none cursor-pointer"
                                                >
                                                    {Object.values(COUNTRY_CONFIG).map(c => (
                                                        <option key={c.dial} value={c.dial}>{c.dial} ({c.vatPrefix})</option>
                                                    ))}
                                                    <option value="+other">Autre</option>
                                                </select>
                                                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">▼</div>
                                            </div>
                                            <div className="relative flex-1 group">
                                                <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500" />
                                                <input 
                                                    type="tel" 
                                                    required
                                                    value={phoneNumber}
                                                    onChange={(e) => setPhoneNumber(e.target.value)}
                                                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-sm font-bold text-slate-800 transition-all"
                                                    placeholder="470 12 34 56"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* SECTION ADRESSE */}
                                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1 flex items-center gap-1">Adresse (Rue & N°) <span className="text-red-500">*</span></label>
                                        <div className="relative group">
                                            <MapPin size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                                            <input 
                                                type="text"
                                                required
                                                value={billingInfo.addressLine1}
                                                onChange={(e) => setBillingInfo({...billingInfo, addressLine1: e.target.value})}
                                                className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-sm font-bold text-slate-800 transition-all"
                                                placeholder="123 Avenue de la Gare"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="col-span-1">
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1 flex items-center gap-1">Code Postal <span className="text-red-500">*</span></label>
                                            <input 
                                                type="text" 
                                                required
                                                value={billingInfo.postalCode}
                                                onChange={(e) => setBillingInfo({...billingInfo, postalCode: e.target.value})}
                                                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-sm font-bold text-slate-800 transition-all"
                                                placeholder="1000"
                                            />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1 flex items-center gap-1">Ville <span className="text-red-500">*</span></label>
                                            <input 
                                                type="text" 
                                                required
                                                value={billingInfo.city}
                                                onChange={(e) => setBillingInfo({...billingInfo, city: e.target.value})}
                                                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-sm font-bold text-slate-800 transition-all"
                                                placeholder="Bruxelles"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* SECTION OPTIONNELLE */}
                                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1">Site Web (Optionnel)</label>
                                        <div className="relative group">
                                            <Globe size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                                            <input 
                                                type="text" 
                                                value={billingInfo.website}
                                                onChange={(e) => setBillingInfo({...billingInfo, website: e.target.value})}
                                                className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-sm font-bold text-slate-800 transition-all"
                                                placeholder="www.masociete.com"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-4 pb-20 lg:pb-0">
                                    <button 
                                        type="submit" 
                                        disabled={isSubmitting || !isFormValid()}
                                        className={`w-full py-4 rounded-2xl font-bold text-lg shadow-xl flex items-center justify-center gap-3 transition-all transform active:scale-95 ${
                                            isFormValid() && !isSubmitting
                                            ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200 hover:-translate-y-1' 
                                            : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                                        }`}
                                    >
                                        {isSubmitting ? <Loader2 className="animate-spin" /> : (
                                            <>
                                                {isFormValid() ? <Lock size={20} /> : <Info size={20} />} 
                                                Valider et Accéder au Portail
                                            </>
                                        )}
                                    </button>
                                    {!isFormValid() && (
                                        <p className="text-center text-xs text-red-400 mt-3 font-medium">
                                            Veuillez remplir correctement tous les champs obligatoires (*)
                                        </p>
                                    )}
                                    <p className="text-[10px] text-center text-slate-400 mt-4 flex items-center justify-center gap-1 opacity-70">
                                        <Info size={12} /> La facture de setup sera générée automatiquement.
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
