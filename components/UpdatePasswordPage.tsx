
import React, { useState } from 'react';
import { Lock, ArrowRight, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import Logo from './Logo';

interface UpdatePasswordPageProps {
  onSuccess: () => void;
}

const UpdatePasswordPage: React.FC<UpdatePasswordPageProps> = ({ onSuccess }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
        setError("Le mot de passe doit contenir au moins 6 caractères.");
        return;
    }

    if (password !== confirmPassword) {
        setError("Les mots de passe ne correspondent pas.");
        return;
    }

    setIsLoading(true);

    try {
        const { error } = await supabase.auth.updateUser({
            password: password
        });

        if (error) throw error;

        // Succès !
        onSuccess();

    } catch (err: any) {
        setError(err.message || "Erreur lors de la mise à jour.");
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center relative overflow-hidden font-sans">
        
        {/* Background Blobs (cohérent avec Login) */}
        <div className="absolute inset-0 w-full h-full">
            <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-purple-600/30 rounded-full blur-[120px] animate-float opacity-70"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-indigo-600/30 rounded-full blur-[120px] animate-float-delayed opacity-70"></div>
        </div>

        <div className="relative z-10 w-full max-w-md p-6">
            
            <div className="flex justify-center mb-8">
                 <div className="bg-gradient-to-br from-white/10 to-indigo-900/20 border border-white/10 rounded-2xl py-3 px-8 shadow-xl backdrop-blur-sm flex items-center justify-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-[40%] bg-gradient-to-b from-white/10 to-transparent pointer-events-none"></div>
                    <Logo className="w-12 h-12" classNameText="text-2xl drop-shadow-md tracking-wider" showText={true} />
                 </div>
            </div>

            <div className="bg-white/5 backdrop-blur-xl border border-white/20 rounded-[2rem] p-8 shadow-2xl animate-fade-in-up relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/5 to-transparent pointer-events-none"></div>

                <div className="mb-8 text-center">
                    <h2 className="text-2xl font-bold text-white mb-2">Nouveau mot de passe</h2>
                    <p className="text-indigo-200 text-sm">
                        Sécurisez votre compte en définissant un nouveau mot de passe.
                    </p>
                </div>

                <form onSubmit={handleUpdate} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-indigo-200 uppercase tracking-wider ml-1">Nouveau mot de passe</label>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <Lock className="h-5 w-5 text-indigo-300" />
                            </div>
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="block w-full pl-11 pr-4 py-3 border border-white/10 rounded-xl leading-5 bg-black/20 text-white placeholder-indigo-300/40 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-indigo-200 uppercase tracking-wider ml-1">Confirmer</label>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <CheckCircle2 className="h-5 w-5 text-indigo-300" />
                            </div>
                            <input
                                type="password"
                                required
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="block w-full pl-11 pr-4 py-3 border border-white/10 rounded-xl leading-5 bg-black/20 text-white placeholder-indigo-300/40 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-100 text-sm flex items-center animate-fade-in">
                            <span className="w-1.5 h-1.5 bg-red-400 rounded-full mr-2"></span>
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading}
                        className={`w-full flex items-center justify-center py-3.5 px-6 rounded-xl shadow-lg shadow-indigo-900/20 text-base font-bold text-indigo-950 bg-white hover:bg-indigo-50 transition-all transform hover:scale-[1.02] active:scale-[0.98] ${
                            isLoading ? 'opacity-80 cursor-not-allowed' : ''
                        }`}
                    >
                        {isLoading ? (
                            <div className="w-5 h-5 border-2 border-indigo-900/30 border-t-indigo-900 rounded-full animate-spin"></div>
                        ) : (
                            <>
                                Valider le changement
                                <ArrowRight size={18} className="ml-2" />
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    </div>
  );
};

export default UpdatePasswordPage;
