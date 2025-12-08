
import React, { useState } from 'react';
import { ArrowRight, Lock, Mail, Star } from 'lucide-react';
import { supabase } from '../lib/supabase';
import Logo from './Logo';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
        // Mode Connexion uniquement
        const { error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        if (signInError) throw signInError;
        // La redirection est gérée par le listener dans App.tsx
    } catch (err: any) {
        setError(err.message || 'Une erreur est survenue. Vérifiez vos identifiants.');
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
                    {/* Framed Logo with Text - Increased horizontal padding (px-10) */}
                    <div className="bg-gradient-to-br from-white/10 to-indigo-900/20 border border-white/10 rounded-3xl py-4 px-10 shadow-2xl backdrop-blur-sm flex items-center justify-center relative overflow-hidden group">
                        {/* Glossy shine effect */}
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

                {/* Social Proof Section */}
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
            <div className="bg-white/5 backdrop-blur-xl border border-white/20 rounded-[2.5rem] p-8 md:p-14 shadow-2xl animate-fade-in-up delay-100 relative overflow-hidden">
                {/* Glossy effect */}
                <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/5 to-transparent pointer-events-none"></div>

                <div className="md:hidden mb-10 flex justify-center">
                     {/* Mobile Logo with Frame */}
                     <div className="bg-gradient-to-br from-white/10 to-indigo-900/20 border border-white/10 rounded-2xl py-3 px-8 shadow-xl backdrop-blur-sm flex items-center justify-center relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-[40%] bg-gradient-to-b from-white/10 to-transparent pointer-events-none"></div>
                        <Logo 
                            className="w-14 h-14" 
                            classNameText="text-3xl drop-shadow-md tracking-wider"
                            showText={true}
                        />
                     </div>
                </div>

                <div className="mb-10">
                    <h2 className="text-3xl font-bold text-white mb-2">Connexion</h2>
                    <p className="text-indigo-200 text-base">
                        Entrez vos identifiants pour accéder à l'espace.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
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
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="block w-full pl-11 pr-4 py-4 border border-white/10 rounded-2xl leading-5 bg-black/20 text-white placeholder-indigo-300/40 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-black/30 transition-all duration-300"
                                placeholder="••••••••"
                            />
                        </div>
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
            </div>
        </div>
    </div>
  );
};

export default LoginPage;
