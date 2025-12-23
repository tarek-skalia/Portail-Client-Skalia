
import React, { useEffect, useState, useRef } from 'react';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../lib/supabase';
import { Check, Download, AlertCircle, FileText, Calendar, DollarSign, PenTool, CheckCircle2, RefreshCw, Layers, ArrowRight, Lock, Mail, Loader2, Key } from 'lucide-react';
import Logo from './Logo';
import { createClient } from '@supabase/supabase-js';

// Helper pour formatage
const formatCurrency = (val: number) => val.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });

interface QuoteItem {
    id: string;
    description: string;
    quantity: number;
    unit_price: number;
    total: number;
    billing_frequency: 'once' | 'monthly' | 'yearly';
}

interface QuoteData {
    id: string;
    title: string;
    description: string;
    total_amount: number;
    status: 'draft' | 'sent' | 'signed' | 'rejected' | 'paid';
    valid_until: string;
    created_at: string;
    recipient_email?: string;
    recipient_name?: string;
    recipient_company?: string;
    payment_terms?: any;
    view_count?: number;
    profile: {
        company_name: string;
        full_name: string;
        email: string;
        id: string;
    } | null;
    profile_id: string | null;
    lead_id?: string | null; // ID du Lead CRM lié
    items: QuoteItem[];
}

interface PublicQuoteViewProps {
    quoteId: string;
}

const PublicQuoteView: React.FC<PublicQuoteViewProps> = ({ quoteId }) => {
    const [quote, setQuote] = useState<QuoteData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isSigningModalOpen, setIsSigningModalOpen] = useState(false);
    const hasTrackedRef = useRef(false);
    
    // Auth State for "Magic Sign"
    const [authMode, setAuthMode] = useState<'register' | 'login'>('register');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [authError, setAuthError] = useState('');

    useEffect(() => {
        fetchQuote();
    }, [quoteId]);

    const fetchQuote = async () => {
        try {
            const { data: quoteData, error: quoteError } = await supabase
                .from('quotes')
                .select(`*, profile:profiles(id, company_name, full_name, email)`)
                .eq('id', quoteId)
                .single();

            if (quoteError) throw quoteError;

            const { data: itemsData } = await supabase.from('quote_items').select('*').eq('quote_id', quoteId);

            setQuote({ ...quoteData, items: itemsData || [] });
            
            const targetEmail = quoteData.profile?.email || quoteData.recipient_email || '';
            setEmail(targetEmail);
            
            if (quoteData.profile_id) setAuthMode('login');

            if (!hasTrackedRef.current && quoteData) {
                hasTrackedRef.current = true;
                const { error: rpcError } = await supabase.rpc('increment_quote_view', { quote_id: quoteId });
                if (rpcError) {
                    const newCount = (quoteData.view_count || 0) + 1;
                    await supabase.from('quotes').update({
                        view_count: newCount,
                        last_viewed_at: new Date().toISOString()
                    }).eq('id', quoteId);
                }
            }

        } catch (err: any) {
            setError("Impossible de charger le devis.");
        } finally {
            setLoading(false);
        }
    };

    const oneShotItems = quote?.items.filter(i => i.billing_frequency === 'once') || [];
    const recurringItems = quote?.items.filter(i => i.billing_frequency !== 'once') || [];
    
    const oneShotTotal = oneShotItems.reduce((acc, i) => acc + (i.unit_price * i.quantity), 0);
    const recurringTotal = recurringItems.reduce((acc, i) => acc + (i.unit_price * i.quantity), 0);
    
    // Récupération Tax & Infos Prospect
    const taxRate = quote?.payment_terms?.tax_rate || 0;
    const prospectAddress = quote?.payment_terms?.billing_address || '';
    const prospectVat = quote?.payment_terms?.vat_number || '';

    // Calcul TTC
    const oneShotTotalTTC = oneShotTotal * (1 + taxRate / 100);
    const recurringTotalTTC = recurringTotal * (1 + taxRate / 100);

    let depositAmountHT = oneShotTotal;
    const termsType = quote?.payment_terms?.type || '100_percent';
    if (termsType === '50_50') depositAmountHT = oneShotTotal * 0.5;
    if (termsType === '30_70') depositAmountHT = oneShotTotal * 0.3;

    const depositAmountTTC = depositAmountHT * (1 + taxRate / 100);
    const totalDueNowTTC = depositAmountTTC + recurringTotalTTC;

    const handleOpenSignModal = () => setIsSigningModalOpen(true);

    const handleMagicSign = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsProcessing(true);
        setAuthError('');

        const tempClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

        try {
            let userId = quote?.profile_id;

            if (authMode === 'login') {
                const { data, error } = await tempClient.auth.signInWithPassword({ email, password });
                if (error) throw error;
                userId = data.user.id;
            } else {
                const { data, error } = await tempClient.auth.signUp({ email, password });
                if (error) {
                    if (error.message.includes('already registered')) {
                        setAuthMode('login');
                        throw new Error("Un compte existe déjà avec cet email. Veuillez vous connecter.");
                    }
                    throw error;
                }
                if (data.user) {
                    userId = data.user.id;
                    // Création Profil Immédiate (Transforme le prospect en client)
                    await tempClient.from('profiles').upsert({
                        id: userId,
                        email: email,
                        full_name: quote?.recipient_name || 'Nouveau Client',
                        company_name: quote?.recipient_company || 'Société',
                        avatar_initials: (quote?.recipient_name || 'NC').substring(0,2).toUpperCase(),
                        role: 'client',
                        // Sauvegarde des infos de facturation si fournies
                        address: prospectAddress || null,
                        vat_number: prospectVat || null,
                        updated_at: new Date().toISOString()
                    });
                }
            }

            if (!userId) throw new Error("Erreur d'identification.");

            const { error: signError } = await tempClient
                .from('quotes')
                .update({ 
                    status: 'signed', 
                    profile_id: userId, 
                    updated_at: new Date().toISOString() 
                })
                .eq('id', quoteId);

            if (signError) throw signError;

            if (quote?.lead_id) {
                try {
                    await tempClient
                        .from('crm_leads')
                        .update({ status: 'won', updated_at: new Date().toISOString() })
                        .eq('id', quote.lead_id);
                } catch (crmError) {
                    console.warn("CRM Update Warning (RLS or missing column):", crmError);
                }
            }

            const { data: profile } = await tempClient.from('profiles').select('onboarding_step').eq('id', userId).single();
            if (profile && (!profile.onboarding_step || profile.onboarding_step < 1)) {
                await tempClient.from('profiles').update({ onboarding_step: 1 }).eq('id', userId);
            }

            await supabase.auth.signInWithPassword({ email, password });
            window.location.reload(); 

        } catch (err: any) {
            setAuthError(err.message || "Une erreur est survenue.");
        } finally {
            setIsProcessing(false);
        }
    };

    if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><Loader2 className="animate-spin text-indigo-600" /></div>;
    if (error || !quote) return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-red-500">{error}</div>;

    return (
        <div className="min-h-screen bg-slate-50 font-sans pb-24 relative">
            <div className="bg-slate-900 h-32 w-full absolute top-0 left-0 z-0"></div>

            <div className="max-w-4xl mx-auto px-4 relative z-10 pt-10">
                {quote.status === 'signed' && (
                    <div className="bg-emerald-500 text-white px-6 py-4 rounded-t-2xl flex items-center justify-center gap-3 font-bold shadow-lg animate-fade-in-up">
                        <CheckCircle2 size={24} />
                        Devis signé et validé. Bienvenue chez Skalia !
                        <button onClick={() => window.location.href = '/'} className="ml-4 bg-white text-emerald-600 px-4 py-1.5 rounded-lg text-xs hover:bg-emerald-50 transition-colors">
                            Accéder à mon espace
                        </button>
                    </div>
                )}

                <div className={`bg-white rounded-2xl shadow-2xl overflow-hidden min-h-[800px] flex flex-col ${quote.status === 'signed' ? 'rounded-t-none' : ''}`}>
                    
                    <div className="p-8 border-b border-slate-100 flex justify-between items-start">
                        <div>
                            <div className="bg-slate-900 text-white p-3 rounded-xl inline-block mb-4 shadow-lg">
                                <Logo className="w-8 h-8" showText={true} />
                            </div>
                            <h1 className="text-3xl font-extrabold text-slate-900 mb-2">{quote.title}</h1>
                            <p className="text-slate-500 text-sm max-w-lg leading-relaxed">{quote.description}</p>
                        </div>
                        <div className="text-right">
                            <div className="inline-block px-4 py-2 bg-slate-50 rounded-lg border border-slate-200 text-xs font-bold text-slate-500 mb-2">
                                Émis le : {new Date(quote.created_at).toLocaleDateString()}
                            </div>
                            <div className="text-xs text-slate-400">
                                Valide jusqu'au : {new Date(quote.valid_until).toLocaleDateString()}
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-50/50 p-8 border-b border-slate-100 grid grid-cols-2 gap-8">
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Pour</p>
                            <p className="font-bold text-slate-900 text-lg">{quote.profile?.company_name || quote.recipient_company || 'Société'}</p>
                            <p className="text-slate-600 text-sm">{quote.profile?.full_name || quote.recipient_name}</p>
                            <p className="text-slate-500 text-sm">{quote.profile?.email || quote.recipient_email}</p>
                            {/* Affichage Adresse & TVA si dispo */}
                            {prospectAddress && <p className="text-slate-500 text-sm mt-1">{prospectAddress}</p>}
                            {prospectVat && <p className="text-slate-400 text-xs font-mono mt-1">TVA: {prospectVat}</p>}
                        </div>
                        <div className="text-right">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Par</p>
                            <p className="font-bold text-slate-900 text-lg">Skalia Agency</p>
                            <p className="text-slate-600 text-sm">Paris, France</p>
                            <p className="text-slate-500 text-sm">contact@skalia.io</p>
                        </div>
                    </div>

                    <div className="p-8 flex-1">
                        {oneShotItems.length > 0 && (
                            <div className="mb-8">
                                <h3 className="text-sm font-bold text-indigo-600 uppercase tracking-wide mb-4 flex items-center gap-2">
                                    <Layers size={16} /> Mise en place (Setup)
                                </h3>
                                <div className="border border-slate-200 rounded-xl overflow-hidden">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-50 text-slate-500 font-medium">
                                            <tr>
                                                <th className="px-4 py-3">Description</th>
                                                <th className="px-4 py-3 text-right">Prix HT</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {oneShotItems.map((item, idx) => (
                                                <tr key={idx}>
                                                    <td className="px-4 py-3 text-slate-700">
                                                        <span className="font-medium">{item.description}</span>
                                                        {item.quantity > 1 && <span className="text-slate-400 text-xs ml-2">x{item.quantity}</span>}
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-mono text-slate-900">
                                                        {formatCurrency(item.unit_price * item.quantity)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {recurringItems.length > 0 && (
                            <div className="mb-8">
                                <h3 className="text-sm font-bold text-amber-600 uppercase tracking-wide mb-4 flex items-center gap-2">
                                    <RefreshCw size={16} /> Abonnements & Maintenance
                                </h3>
                                <div className="border border-slate-200 rounded-xl overflow-hidden">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-50 text-slate-500 font-medium">
                                            <tr>
                                                <th className="px-4 py-3">Description</th>
                                                <th className="px-4 py-3 text-right">Fréquence</th>
                                                <th className="px-4 py-3 text-right">Prix HT</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {recurringItems.map((item, idx) => (
                                                <tr key={idx}>
                                                    <td className="px-4 py-3 text-slate-700 font-medium">{item.description}</td>
                                                    <td className="px-4 py-3 text-right text-xs uppercase font-bold text-slate-400">
                                                        {item.billing_frequency === 'monthly' ? 'Mensuel' : 'Annuel'}
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-mono text-slate-900">
                                                        {formatCurrency(item.unit_price * item.quantity)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end mt-8">
                            <div className="w-full max-w-sm bg-slate-50 rounded-xl p-6 border border-slate-200 space-y-3">
                                <div className="flex justify-between text-sm text-slate-600">
                                    <span>Total Setup (HT)</span>
                                    <span>{formatCurrency(oneShotTotal)}</span>
                                </div>
                                {recurringItems.length > 0 && (
                                    <div className="flex justify-between text-sm text-slate-600">
                                        <span>Total Récurrent (HT)</span>
                                        <span>{formatCurrency(recurringTotal)} /mois</span>
                                    </div>
                                )}
                                
                                {/* Ligne TVA */}
                                {taxRate > 0 && (
                                    <div className="flex justify-between text-sm text-slate-500 border-t border-slate-200 pt-2 mt-2">
                                        <span>TVA ({taxRate}%)</span>
                                        <span>
                                            {formatCurrency( (oneShotTotal + recurringTotal) * (taxRate/100) )}
                                        </span>
                                    </div>
                                )}
                                
                                <div className="h-px bg-slate-200 my-2"></div>
                                
                                <div className="flex justify-between items-center text-lg font-bold text-slate-900">
                                    <span>À régler aujourd'hui (TTC)</span>
                                    <span className="text-indigo-600">{formatCurrency(totalDueNowTTC)}</span>
                                </div>
                                <p className="text-xs text-right text-slate-400 italic">
                                    (Acompte + 1er mois abonnement)
                                </p>
                            </div>
                        </div>
                    </div>

                    {quote.status !== 'signed' && (
                        <div className="sticky bottom-0 bg-white border-t border-slate-200 p-4 md:p-6 flex justify-between items-center z-20 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
                            <div className="hidden md:block">
                                <p className="text-xs font-bold text-slate-400 uppercase">Total Projet TTC</p>
                                {/* On affiche le montant total du projet TTC (Setup + 1 mois récurrent) */}
                                <p className="text-xl font-black text-slate-900">
                                    {formatCurrency(quote.total_amount)}
                                </p>
                            </div>
                            
                            <button onClick={handleOpenSignModal} className="flex items-center gap-3 bg-slate-900 text-white px-8 py-4 rounded-xl font-bold hover:bg-indigo-600 transition-all shadow-lg hover:shadow-indigo-200 transform hover:scale-[1.02] active:scale-[0.98] w-full md:w-auto justify-center">
                                <PenTool size={18} />
                                Signer le devis ({formatCurrency(totalDueNowTTC)})
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {isSigningModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up">
                        <div className="bg-slate-50 p-6 border-b border-slate-100 text-center">
                            <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-3">
                                <Lock size={24} />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900">Sécurisez votre espace</h3>
                            <p className="text-sm text-slate-500 mt-1">Pour valider ce devis, veuillez créer ou vous connecter à votre compte client Skalia.</p>
                        </div>

                        <div className="p-6">
                            <div className="flex bg-slate-100 p-1 rounded-lg mb-6">
                                <button onClick={() => setAuthMode('register')} className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${authMode === 'register' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>Créer un compte</button>
                                <button onClick={() => setAuthMode('login')} className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${authMode === 'login' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>J'ai un compte</button>
                            </div>

                            <form onSubmit={handleMagicSign} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email professionnel</label>
                                    <div className="relative">
                                        <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium" placeholder="vous@entreprise.com" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Mot de passe</label>
                                    <div className="relative">
                                        <Key size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium" placeholder="••••••••" />
                                    </div>
                                </div>

                                {authError && <div className="p-3 bg-red-50 text-red-600 text-xs font-medium rounded-lg flex items-center gap-2"><AlertCircle size={14} /> {authError}</div>}

                                <button type="submit" disabled={isProcessing} className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-70">
                                    {isProcessing ? <Loader2 className="animate-spin" /> : (authMode === 'register' ? 'Créer compte & Signer' : 'Connexion & Signer')}
                                </button>
                            </form>
                            <button onClick={() => setIsSigningModalOpen(false)} className="w-full mt-4 text-xs font-bold text-slate-400 hover:text-slate-600">Annuler</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PublicQuoteView;
