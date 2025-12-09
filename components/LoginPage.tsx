
import React, { useState, useEffect } from 'react';
import { ArrowRight, Lock, Mail, Star, Eye, EyeOff, ArrowLeft, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import Logo from './Logo';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Nouveaux états
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [view, setView] = useState<'login' | 'forgot_password'>('login');

  // Chargement de l'email si "Se souvenir de moi" était coché
  useEffect(() => {
    const savedEmail = localStorage.getItem('skalia_remember_email');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
        // Gestion du "Se souvenir de moi"
        if (rememberMe) {
            localStorage.setItem('skalia_remember_email', email);
        } else {
            localStorage.removeItem('skalia_remember_email');
        }

        const { error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        if (signInError) throw signInError;
        // La redirection est gérée par le listener dans App.tsx
    } catch (err: any) {
        let errorMessage = err.message || 'Une erreur est survenue.';
        if (errorMessage === 'Invalid login credentials') {
            errorMessage = 'Identifiants incorrects. En cas de problème, veuillez contacter Skalia directement.';
        }
        setError(errorMessage);
    } finally {
        setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      setSuccessMsg('');
      setIsLoading(true);

      try {
          // L'URL de redirection doit être ton site actuel
          const { error } = await supabase.auth.resetPasswordForEmail(email, {
              redirectTo: window.location.origin,
          });

          if (error) throw error;
          
          setSuccessMsg("Un email de réinitialisation a été envoyé. Vérifiez votre boîte de réception.");
      } catch (err: any) {
          setError(err.message || "Impossible d'envoyer l'email.");
      } finally {
          setIsLoading(false);
      }
  };

  const clientLogos = [
      'https://cdn.prod.website-files.com/68101e1142e157b7bc0d9366/68dfe97e9c5196724841369b_Design%20sans%20titre%20(24).png',
      'https://cdn.prod.website-files.com/68101e1142e157b7bc0d9366/68dfdf7f2c7d81e132d4473a_Design%20sans%20titre%20(20).png',
      'https://cdn.prod.website-files.com/68101e1142e157b7bc0d9366/68a352170f1a2e4d09fa898b_Design%20sans%20titre%20(18).png'
  ];

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center relative overflow-hidden font-sans">
        
        {/* Animated Background */}
        <div className="absolute inset-0 w-full h-full">
            <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-purple-600/30 rounded-full blur-[120px] animate-float opacity-70"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-indigo-600/30 rounded-full blur-[120px] animate-float-delayed opacity-70"></div>
            <div className="absolute top-[30%] left-[40%] w-[300px] h-[300px] bg-pink-500/20 rounded-full blur-[100px] animate-float opacity-50" style={{ animationDelay: '1s' }}></div>
        </div>

        {/* Content Container */}
        <div className="relative z-10 w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 gap-12 p-6 items-center">
            
            {/* Left: Branding */}
            <div className="hidden md:flex flex-col justify-center p-8 text-white space-y-8 animate-fade-in-up">
                <div className="mb-4 inline-flex">
                    <div className="bg-gradient-to-br from-white/10 to-indigo-900/20 border border-white/10 rounded-3xl py-4 px-10 shadow-2xl backdrop-blur-sm flex items-center justify-center relative overflow-hidden group">
                        <div className="absolute top-0 left-0 w-full h-[40%] bg-gradient-to-b from-white/10 to-transparent pointer-events-none"></div>
                        <Logo 
                            className="w-24 h-24 md:w-28 md:h-28" 
                            classNameText="text-4xl md:text-5xl drop-shadow-lg tracking-wider font-bold" 
                            showText={true}
                        />
                    </div>
                </div>
                <h1 className="text-6xl font-bold leading-tight tracking-tight">
                    Accélérez votre <br/>
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-300">Croissance</span>
                </h1>
                <p className="text-xl text-indigo-200 max-w-md leading-relaxed">
                    Bienvenue sur votre portail client Skalia. Suivez vos projets d'automatisation, consultez vos KPI's et gérez vos demandes en temps réel !
                </p>

                <div className="pt-8 border-t border-white/10 w-full max-w-lg">
                    <p className="text-xs font-bold text-indigo-300 uppercase tracking-widest mb-4">
                        Plus de 50+ entreprises nous ont déjà fait confiance
                    </p>
                    <div className="flex items-center gap-6">
                        <div className="flex -space-x-4">
                            {clientLogos.map((src, i) => (
                                <div key={i} className="w-12 h-12 rounded-full border-2 border-slate-900 bg-white flex items-center justify-center overflow-hidden hover:scale-110 transition-transform duration-300 z-0 hover:z-10 relative">
                                    <img src={src} alt="Client" className="w-full h-full object-cover" />
                                </div>
                            ))}
                            <div className="w-12 h-12 rounded-full border-2 border-slate-900 bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white z-0 hover:z-10 relative">
                                +50
                            </div>
                        </div>
                        <div className="h-8 w-px bg-white/10"></div>
                        <div className="flex flex-col">
                            <div className="flex gap-0.5">
                                {[1,2,3,4,5].map(i => <Star key={i} size={16} className="text-amber-400 fill-amber-400" />)}
                            </div>
                            <span className="text-xs text-indigo-200 mt-1">4.9/5 satisfaction client</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right: Login Form */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/20 rounded-[2.5rem] p-8 md:p-14 shadow-2xl animate-fade-in-up delay-100 relative overflow-hidden transition-all duration-500">
                <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/5 to-transparent pointer-events-none"></div>

                <div className="md:hidden mb-10 flex justify-center">
                     <div className="bg-gradient-to-br from-white/10 to-indigo-900/20 border border-white/10 rounded-2xl py-3 px-8 shadow-xl backdrop-blur-sm flex items-center justify-center relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-[40%] bg-gradient-to-b from-white/10 to-transparent pointer-events-none"></div>
                        <Logo className="w-14 h-14" classNameText="text-3xl drop-shadow-md tracking-wider" showText={true} />
                     </div>
                </div>

                {view === 'login' ? (
                    // --- VUE CONNEXION ---
                    <>
                        <div className="mb-8">
                            <h2 className="text-3xl font-bold text-white mb-2">Connexion</h2>
                            <p className="text-indigo-200 text-base">
                                Entrez vos identifiants pour accéder à l'espace.
                            </p>
                        </div>

                        <form onSubmit={handleLogin} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-indigo-200 uppercase tracking-wider ml-1">Email</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors group-focus-within:text-indigo-400">
                                        <Mail className="h-5 w-5 text-indigo-300" />
                                    </div>
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="block w-full pl-11 pr-4 py-4 border border-white/10 rounded-2xl leading-5 bg-black/20 text-white placeholder-indigo-300/40 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-black/30 transition-all duration-300"
                                        placeholder="name@company.com"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-indigo-200 uppercase tracking-wider ml-1">Mot de passe</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors group-focus-within:text-indigo-400">
                                        <Lock className="h-5 w-5 text-indigo-300" />
                                    </div>
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="block w-full pl-11 pr-12 py-4 border border-white/10 rounded-2xl leading-5 bg-black/20 text-white placeholder-indigo-300/40 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-black/30 transition-all duration-300"
                                        placeholder="••••••••"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-indigo-300 hover:text-white transition-colors focus:outline-none"
                                    >
                                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center justify-between">
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <div className={`w-5 h-5 rounded border border-white/20 flex items-center justify-center transition-all ${rememberMe ? 'bg-indigo-600 border-indigo-600' : 'bg-black/20 group-hover:border-white/40'}`}>
                                        {rememberMe && <Check size={14} className="text-white" />}
                                    </div>
                                    <input 
                                        type="checkbox" 
                                        className="hidden" 
                                        checked={rememberMe}
                                        onChange={(e) => setRememberMe(e.target.checked)}
                                    />
                                    <span className="text-sm text-indigo-200 group-hover:text-white transition-colors select-none">Se souvenir de moi</span>
                                </label>

                                <button 
                                    type="button"
                                    onClick={() => setView('forgot_password')}
                                    className="text-sm font-semibold text-indigo-400 hover:text-white transition-colors"
                                >
                                    Mot de passe oublié ?
                                </button>
                            </div>

                            {error && (
                                <div className="p-4 rounded-xl bg-red-500/20 border border-red-500/30 text-red-100 text-sm flex items-center animate-fade-in backdrop-blur-md">
                                    <span className="w-1.5 h-1.5 bg-red-400 rounded-full mr-2"></span>
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={isLoading}
                                className={`w-full flex items-center justify-center py-4 px-6 rounded-2xl shadow-xl shadow-indigo-900/20 text-base font-bold text-indigo-950 bg-white hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-white transition-all transform hover:scale-[1.02] active:scale-[0.98] ${
                                    isLoading ? 'opacity-80 cursor-not-allowed' : ''
                                }`}
                            >
                                {isLoading ? (
                                    <div className="w-5 h-5 border-2 border-indigo-900/30 border-t-indigo-900 rounded-full animate-spin"></div>
                                ) : (
                                    <>
                                        Se connecter
                                        <ArrowRight size={20} className="ml-2" />
                                    </>
                                )}
                            </button>
                        </form>
                    </>
                ) : (
                    // --- VUE MOT DE PASSE OUBLIÉ ---
                    <div className="animate-fade-in">
                        <div className="mb-8">
                            <button 
                                onClick={() => setView('login')}
                                className="flex items-center gap-2 text-indigo-300 hover:text-white transition-colors text-sm font-medium mb-6"
                            >
                                <ArrowLeft size={16} /> Retour à la connexion
                            </button>
                            <h2 className="text-3xl font-bold text-white mb-2">Mot de passe oublié</h2>
                            <p className="text-indigo-200 text-base">
                                Entrez votre adresse email. Nous vous enverrons un lien pour réinitialiser votre mot de passe.
                            </p>
                        </div>

                        <form onSubmit={handleResetPassword} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-indigo-200 uppercase tracking-wider ml-1">Email</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors group-focus-within:text-indigo-400">
                                        <Mail className="h-5 w-5 text-indigo-300" />
                                    </div>
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="block w-full pl-11 pr-4 py-4 border border-white/10 rounded-2xl leading-5 bg-black/20 text-white placeholder-indigo-300/40 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-black/30 transition-all duration-300"
                                        placeholder="name@company.com"
                                    />
                                </div>
                            </div>

                            {error && (
                                <div className="p-4 rounded-xl bg-red-500/20 border border-red-500/30 text-red-100 text-sm flex items-center animate-fade-in backdrop-blur-md">
                                    <span className="w-1.5 h-1.5 bg-red-400 rounded-full mr-2"></span>
                                    {error}
                                </div>
                            )}

                            {successMsg && (
                                <div className="p-4 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-100 text-sm flex items-center animate-fade-in backdrop-blur-md">
                                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full mr-2"></span>
                                    {successMsg}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={isLoading || !!successMsg}
                                className={`w-full flex items-center justify-center py-4 px-6 rounded-2xl shadow-xl shadow-indigo-900/20 text-base font-bold text-indigo-950 bg-white hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-white transition-all transform hover:scale-[1.02] active:scale-[0.98] ${
                                    isLoading || !!successMsg ? 'opacity-80 cursor-not-allowed' : ''
                                }`}
                            >
                                {isLoading ? (
                                    <div className="w-5 h-5 border-2 border-indigo-900/30 border-t-indigo-900 rounded-full animate-spin"></div>
                                ) : successMsg ? (
                                    <>Email envoyé !</>
                                ) : (
                                    <>Envoyer le lien</>
                                )}
                            </button>
                        </form>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};

export default LoginPage;
