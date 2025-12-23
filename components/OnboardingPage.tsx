
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { CheckCircle2, Circle, ArrowRight, Play, Calendar, CreditCard, FileSignature, Lock, Loader2 } from 'lucide-react';
import { Client } from '../types';
import Logo from './Logo';

interface OnboardingPageProps {
  currentUser: Client;
  onComplete: () => void;
}

const STEPS = [
    { id: 1, label: 'Signature Devis', icon: FileSignature },
    { id: 2, label: 'Vidéo Bienvenue', icon: Play },
    { id: 3, label: 'Appel Lancement', icon: Calendar },
];

const OnboardingPage: React.FC<OnboardingPageProps> = ({ currentUser, onComplete }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingQuote, setPendingQuote] = useState<any>(null);

  useEffect(() => {
      checkProgress();
  }, []);

  const checkProgress = async () => {
      // 1. Get current step from DB
      const { data: profile } = await supabase.from('profiles').select('onboarding_step').eq('id', currentUser.id).single();
      const dbStep = profile?.onboarding_step || 0;
      
      // Calculate real step
      let realStep = 1;
      if (dbStep >= 1) realStep = 2;
      if (dbStep >= 2) realStep = 3;
      if (dbStep >= 3) {
          onComplete(); // Already done
          return;
      }

      // Check for pending quote if step 1
      if (realStep === 1) {
          const { data: quotes } = await supabase.from('quotes').select('*').eq('profile_id', currentUser.id).eq('status', 'sent').limit(1);
          if (quotes && quotes.length > 0) setPendingQuote(quotes[0]);
      }

      setCurrentStep(realStep);
      setIsLoading(false);
  };

  const updateStep = async (step: number) => {
      setIsLoading(true);
      await supabase.from('profiles').update({ onboarding_step: step }).eq('id', currentUser.id);
      
      if (step >= 3) {
          // Finalize after step 3 (Booking)
          onComplete();
      } else {
          // Go to next
          checkProgress();
      }
  };

  const handleStepAction = async () => {
      await updateStep(currentStep); // Validate current step and move to next
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-indigo-600 w-12 h-12" /></div>;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
        {/* Top Bar */}
        <div className="h-20 bg-white border-b border-slate-200 flex items-center px-8 justify-between">
            <Logo classNameText="text-slate-900" />
            <div className="flex items-center gap-4">
                <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">Onboarding Client</span>
                <div className="bg-slate-100 px-3 py-1 rounded-full text-xs font-bold text-slate-600">
                    Étape {currentStep} sur 3
                </div>
            </div>
        </div>

        <div className="flex-1 flex flex-col md:flex-row">
            
            {/* Left Sidebar Steps */}
            <div className="w-full md:w-80 bg-white border-r border-slate-200 p-8 flex flex-col gap-8">
                {STEPS.map((step) => {
                    const isDone = currentStep > step.id;
                    const isCurrent = currentStep === step.id;
                    return (
                        <div key={step.id} className={`flex items-center gap-4 ${isCurrent ? 'opacity-100' : 'opacity-50'}`}>
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

            {/* Main Content Area */}
            <div className="flex-1 p-8 md:p-16 flex items-center justify-center bg-slate-50/50">
                <div className="max-w-2xl w-full bg-white rounded-3xl shadow-xl border border-slate-100 p-10 animate-fade-in-up">
                    
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
                                    <a 
                                        href={`/p/quote/${pendingQuote.id}`} 
                                        target="_blank"
                                        className="inline-flex items-center gap-2 px-8 py-4 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg hover:shadow-indigo-200"
                                    >
                                        Voir et Signer le devis <ArrowRight size={20} />
                                    </a>
                                    <p className="text-xs text-slate-400 mt-4">
                                        Une fois signé, revenez ici pour continuer (rafraîchissez la page si nécessaire).
                                    </p>
                                </div>
                            ) : (
                                <div className="p-6 bg-amber-50 text-amber-800 rounded-xl border border-amber-100">
                                    Aucun devis en attente. Si vous avez déjà signé, cliquez sur "Continuer".
                                    <button onClick={handleStepAction} className="block w-full mt-4 py-3 bg-amber-600 text-white rounded-lg font-bold">J'ai déjà signé</button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* STEP 2: VIDEO */}
                    {currentStep === 2 && (
                        <div className="text-center space-y-6">
                            <h2 className="text-3xl font-extrabold text-slate-900">Bienvenue chez Skalia !</h2>
                            <p className="text-slate-500">Un petit message de Tarek pour vous expliquer la suite.</p>
                            
                            <div className="aspect-video bg-slate-900 rounded-2xl overflow-hidden shadow-2xl my-8 relative group cursor-pointer">
                                {/* Placeholder Video */}
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

                </div>
            </div>
        </div>
    </div>
  );
};

export default OnboardingPage;
