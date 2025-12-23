
import React, { useEffect, useState, useRef } from 'react';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../lib/supabase';
import { Check, Download, AlertCircle, FileText, Calendar, DollarSign, PenTool, CheckCircle2, RefreshCw, Layers, ArrowRight, Lock, Mail, Loader2, Key, Zap, Target, Users, ShieldCheck, Star } from 'lucide-react';
import Logo from './Logo';
import { createClient } from '@supabase/supabase-js';

// --- DATA HARDCODÉE AGENCE (Pour le Storytelling) ---
const AGENCY_TEAM = [
    {
        name: 'Zakaria Jellouli',
        role: 'Process Analyst',
        img: 'https://cdn.prod.website-files.com/68101e1142e157b7bc0d9366/693e20a344d8467df0c49ca8_1742836594868.jpeg'
    },
    {
        name: 'Tarek Zreik',
        role: 'Tech Specialist',
        img: 'https://cdn.prod.website-files.com/68101e1142e157b7bc0d9366/693e208badeaae7b477b5ee4_Design%20sans%20titre%20(17).png'
    }
];

const METHODOLOGY_STEPS = [
    { num: '01', title: 'Onboarding', desc: 'Cadrage, compréhension des objectifs et collecte des accès.' },
    { num: '02', title: 'Réalisation', desc: 'Construction des flux, intégration IA et tests rigoureux.' },
    { num: '03', title: 'Livraison', desc: 'Démonstration, transfert de propriété et formation.' },
    { num: '04', title: 'Support', desc: 'Maintenance continue et ajustements post-lancement.' },
];

// Helper pour formatage
const formatCurrency = (val: number) => val.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 });

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
    lead_id?: string | null;
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
            setError("Impossible de charger la proposition.");
        } finally {
            setLoading(false);
        }
    };

    const oneShotItems = quote?.items.filter(i => i.billing_frequency === 'once') || [];
    const recurringItems = quote?.items.filter(i => i.billing_frequency !== 'once') || [];
    
    const oneShotTotal = oneShotItems.reduce((acc, i) => acc + (i.unit_price * i.quantity), 0);
    const recurringTotal = recurringItems.reduce((acc, i) => acc + (i.unit_price * i.quantity), 0);
    
    const taxRate = quote?.payment_terms?.tax_rate || 0;
    const prospectAddress = quote?.payment_terms?.billing_address || '';
    const prospectVat = quote?.payment_terms?.vat_number || '';

    const oneShotTotalTTC = oneShotTotal * (1 + taxRate / 100);
    const recurringTotalTTC = recurringTotal * (1 + taxRate / 100);

    let depositAmountHT = oneShotTotal;
    const termsType = quote?.payment_terms?.type || '100_percent';
    if (termsType === '50_50') depositAmountHT = oneShotTotal * 0.5;
    if (termsType === '30_70') depositAmountHT = oneShotTotal * 0.3;

    const depositAmountTTC = depositAmountHT * (1 + taxRate / 100);
    const totalDueNowTTC = depositAmountTTC + recurringTotalTTC; // Acompte + 1er mois

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
                        throw new Error("Un compte existe déjà. Connectez-vous.");
                    }
                    throw error;
                }
                if (data.user) {
                    userId = data.user.id;
                    await tempClient.from('profiles').upsert({
                        id: userId,
                        email: email,
                        full_name: quote?.recipient_name || 'Nouveau Client',
                        company_name: quote?.recipient_company || 'Société',
                        avatar_initials: (quote?.recipient_name || 'NC').substring(0,2).toUpperCase(),
                        role: 'client',
                        address: prospectAddress || null,
                        vat_number: prospectVat || null,
                        updated_at: new Date().toISOString()
                    });
                }
            }

            if (!userId) throw new Error("Erreur d'identification.");

            const { error: signError } = await tempClient
                .from('quotes')
                .update({ status: 'signed', profile_id: userId, updated_at: new Date().toISOString() })
                .eq('id', quoteId);

            if (signError) throw signError;

            if (quote?.lead_id) {
                try {
                    await tempClient.from('crm_leads').update({ status: 'won', updated_at: new Date().toISOString() }).eq('id', quote.lead_id);
                } catch (e) {}
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

    if (loading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center"><Loader2 className="animate-spin text-white" /></div>;
    if (error || !quote) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-red-400">{error}</div>;

    const companyName = quote.profile?.company_name || quote.recipient_company || 'votre entreprise';

    return (
        <div className="min-h-screen bg-slate-50 font-sans selection:bg-indigo-200 selection:text-indigo-900">
            
            {/* --- HERO SECTION IMMERSIVE (Style PDF Skalia) --- */}
            <header className="relative bg-gradient-to-br from-[#2E1065] to-[#4C1D95] text-white overflow-hidden min-h-[90vh] flex flex-col justify-center">
                {/* Abstract Waves Background */}
                <div className="absolute inset-0 opacity-20 pointer-events-none">
                    <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] border-[40px] border-white/10 rounded-full animate-pulse"></div>
                    <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] border-[60px] border-white/5 rounded-full"></div>
                    <div className="absolute top-[40%] right-[20%] w-[200px] h-[200px] bg-indigo-500/30 blur-[100px]"></div>
                </div>

                <div className="max-w-5xl mx-auto px-6 relative z-10 w-full">
                    {/* Logo & Date */}
                    <div className="flex justify-between items-start mb-16 opacity-0 animate-fade-in" style={{ animationDelay: '0.2s' }}>
                        <Logo className="w-12 h-12" classNameText="text-2xl" showText={true} />
                        <div className="text-right text-indigo-200 text-sm font-medium">
                            <p>Proposition émise le</p>
                            <p className="text-white font-bold">{new Date(quote.created_at).toLocaleDateString()}</p>
                        </div>
                    </div>

                    {/* Main Title */}
                    <div className="max-w-3xl">
                        <div className="inline-block px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-indigo-200 text-sm font-bold uppercase tracking-widest mb-6 opacity-0 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
                            Offre de projet sur mesure
                        </div>
                        <h1 className="text-5xl md:text-7xl font-bold leading-tight mb-6 opacity-0 animate-fade-in-up" style={{ animationDelay: '0.6s' }}>
                            Accélérez la croissance de <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 to-purple-300">{companyName}</span>.
                        </h1>
                        <p className="text-xl text-indigo-100/80 max-w-2xl leading-relaxed opacity-0 animate-fade-in-up" style={{ animationDelay: '0.8s' }}>
                            {quote.description || "Nous avons conçu une solution d'automatisation intelligente pour libérer votre potentiel et éliminer les tâches répétitives."}
                        </p>
                    </div>

                    {/* Scroll Indicator */}
                    <div className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-bounce opacity-0 animate-fade-in" style={{ animationDelay: '1.5s' }}>
                        <ArrowRight className="rotate-90 text-indigo-300/50" size={32} />
                    </div>
                </div>
            </header>

            {/* --- SECTION ÉQUIPE & VALEURS (Glassmorphism Light) --- */}
            <section className="py-24 bg-white relative overflow-hidden">
                <div className="max-w-5xl mx-auto px-6">
                    <div className="flex flex-col md:flex-row gap-16 items-start">
                        
                        {/* Text Content */}
                        <div className="flex-1 space-y-8">
                            <h2 className="text-4xl font-bold text-slate-900">
                                L'équipe <span className="text-indigo-600">Skalia</span>.
                            </h2>
                            <p className="text-lg text-slate-600 leading-relaxed">
                                Jeune agence liégeoise, Skalia aide les entreprises à supprimer les tâches répétitives et gagner en clarté en automatisant leurs processus avec l’intelligence artificielle. 
                            </p>
                            
                            <div className="grid grid-cols-1 gap-6 mt-8">
                                {[
                                    { icon: Zap, title: "Réactivité", desc: "Des solutions déployées en quelques jours, pas des mois." },
                                    { icon: ShieldCheck, title: "Transparence", desc: "Pas de coûts cachés, code documenté et accessible." },
                                    { icon: Target, title: "Innovation", desc: "Les dernières technologies IA au service de votre business." }
                                ].map((val, i) => (
                                    <div key={i} className="flex items-start gap-4 p-4 rounded-xl hover:bg-slate-50 transition-colors">
                                        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg shrink-0">
                                            <val.icon size={24} />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-900">{val.title}</h4>
                                            <p className="text-sm text-slate-500 mt-1">{val.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Team Cards */}
                        <div className="w-full md:w-auto flex flex-col sm:flex-row gap-6">
                            {AGENCY_TEAM.map((member, i) => (
                                <div key={i} className="group relative w-full sm:w-48 aspect-[3/4] rounded-2xl overflow-hidden shadow-2xl">
                                    <img src={member.img} alt={member.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-90"></div>
                                    <div className="absolute bottom-0 left-0 w-full p-4 text-white">
                                        <p className="font-bold text-lg">{member.name}</p>
                                        <p className="text-xs text-indigo-300 font-medium uppercase tracking-wider">{member.role}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                    </div>
                </div>
            </section>

            {/* --- SECTION METHODOLOGIE (Timeline) --- */}
            <section className="py-24 bg-slate-900 text-white relative">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[120px]"></div>
                <div className="max-w-5xl mx-auto px-6 relative z-10">
                    <h2 className="text-3xl font-bold mb-16 text-center">Notre méthode en 4 étapes</h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                        {METHODOLOGY_STEPS.map((step, i) => (
                            <div key={i} className="relative group">
                                {/* Connector Line */}
                                {i < METHODOLOGY_STEPS.length - 1 && (
                                    <div className="hidden md:block absolute top-8 left-full w-full h-[2px] bg-white/10 group-hover:bg-indigo-500/50 transition-colors"></div>
                                )}
                                
                                <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-2xl font-bold text-indigo-400 mb-6 group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-500 transition-all shadow-lg shadow-indigo-900/20">
                                    {step.num}
                                </div>
                                <h3 className="text-xl font-bold mb-3">{step.title}</h3>
                                <p className="text-slate-400 text-sm leading-relaxed">
                                    {step.desc}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* --- SECTION PRICING (Modern Cards) --- */}
            <section className="py-24 bg-slate-50">
                <div className="max-w-4xl mx-auto px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-bold text-slate-900 mb-4">Investissement</h2>
                        <p className="text-slate-500 max-w-lg mx-auto">
                            Une tarification transparente adaptée à vos besoins.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                        
                        {/* CARD 1: SETUP (One Shot) */}
                        <div className="bg-white rounded-3xl p-8 shadow-xl border border-slate-100 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <Layers size={120} />
                            </div>
                            <h3 className="text-lg font-bold text-slate-500 uppercase tracking-widest mb-2">Initialisation</h3>
                            <div className="text-4xl font-extrabold text-slate-900 mb-6">
                                {formatCurrency(oneShotTotal)}<span className="text-lg text-slate-400 font-medium">HT</span>
                            </div>
                            
                            <ul className="space-y-4 mb-8 relative z-10">
                                {oneShotItems.map((item, idx) => (
                                    <li key={idx} className="flex items-start gap-3 text-slate-700">
                                        <CheckCircle2 className="text-emerald-500 shrink-0 mt-0.5" size={18} />
                                        <span className="text-sm font-medium">{item.description}</span>
                                    </li>
                                ))}
                                {oneShotItems.length === 0 && <li className="text-slate-400 italic text-sm">Aucun frais d'installation</li>}
                            </ul>
                        </div>

                        {/* CARD 2: RECURRING (Abonnement) */}
                        <div className="bg-slate-900 rounded-3xl p-8 shadow-2xl border border-indigo-500/30 relative overflow-hidden text-white transform md:-translate-y-4">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <RefreshCw size={120} />
                            </div>
                            <div className="inline-block px-3 py-1 bg-indigo-500 rounded-full text-[10px] font-bold uppercase tracking-wide mb-4">
                                Recommandé
                            </div>
                            <h3 className="text-lg font-bold text-indigo-200 uppercase tracking-widest mb-2">Suivi & Maintenance</h3>
                            <div className="text-4xl font-extrabold text-white mb-6">
                                {formatCurrency(recurringTotal)}<span className="text-lg text-indigo-300 font-medium">/mois</span>
                            </div>
                            
                            <ul className="space-y-4 mb-8 relative z-10">
                                {recurringItems.length > 0 ? recurringItems.map((item, idx) => (
                                    <li key={idx} className="flex items-start gap-3 text-indigo-50">
                                        <CheckCircle2 className="text-indigo-400 shrink-0 mt-0.5" size={18} />
                                        <span className="text-sm font-medium">{item.description}</span>
                                    </li>
                                )) : (
                                    <>
                                        <li className="flex items-start gap-3 text-indigo-50">
                                            <CheckCircle2 className="text-indigo-400 shrink-0 mt-0.5" size={18} />
                                            <span className="text-sm font-medium">Hébergement serveurs & Base de données</span>
                                        </li>
                                        <li className="flex items-start gap-3 text-indigo-50">
                                            <CheckCircle2 className="text-indigo-400 shrink-0 mt-0.5" size={18} />
                                            <span className="text-sm font-medium">Support technique prioritaire</span>
                                        </li>
                                    </>
                                )}
                            </ul>
                        </div>

                    </div>

                    {/* TOTAL RECAP */}
                    <div className="mt-12 bg-white rounded-2xl p-6 border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-6 shadow-sm">
                        <div className="text-center md:text-left">
                            <p className="text-sm text-slate-500 font-medium">Conditions de démarrage</p>
                            <p className="text-xs text-slate-400 mt-1">
                                {termsType === '100_percent' ? '100% à la commande' : termsType === '50_50' ? 'Acompte 50% à la commande' : 'Acompte 30% à la commande'}
                            </p>
                        </div>
                        <div className="text-center md:text-right">
                            <p className="text-sm font-bold text-slate-400 uppercase">Total à régler aujourd'hui (TTC)</p>
                            <p className="text-3xl font-black text-indigo-600">{formatCurrency(totalDueNowTTC)}</p>
                        </div>
                    </div>

                </div>
            </section>

            {/* --- STICKY FOOTER CTA --- */}
            {quote.status !== 'signed' && (
                <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-slate-200 p-4 z-50 shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
                    <div className="max-w-5xl mx-auto flex justify-between items-center">
                        <div className="hidden md:block">
                            <p className="text-xs font-bold text-slate-500 uppercase">{quote.title}</p>
                            <p className="font-bold text-slate-900">Pour {companyName}</p>
                        </div>
                        <button 
                            onClick={handleOpenSignModal}
                            className="w-full md:w-auto bg-slate-900 hover:bg-indigo-600 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-xl hover:shadow-indigo-500/30 transition-all flex items-center justify-center gap-3 transform hover:-translate-y-1"
                        >
                            <PenTool size={20} />
                            Accepter et Signer
                        </button>
                    </div>
                </div>
            )}

            {/* --- MODAL SIGNATURE (Gardé identique mais stylisé) --- */}
            {isSigningModalOpen && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up">
                        <div className="bg-slate-50 p-8 text-center border-b border-slate-100">
                            <div className="w-14 h-14 bg-white border border-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                                <Lock size={24} className="text-indigo-600" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900">Dernière étape</h3>
                            <p className="text-sm text-slate-500 mt-2">Créez votre accès sécurisé pour valider le devis et accéder à votre espace projet.</p>
                        </div>

                        <div className="p-8">
                            {/* Toggle Login/Register */}
                            <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
                                <button onClick={() => setAuthMode('register')} className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${authMode === 'register' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>Nouveau Compte</button>
                                <button onClick={() => setAuthMode('login')} className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${authMode === 'login' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>J'ai un compte</button>
                            </div>

                            <form onSubmit={handleMagicSign} className="space-y-5">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Email professionnel</label>
                                    <div className="relative">
                                        <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold text-slate-800" placeholder="vous@entreprise.com" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Mot de passe</label>
                                    <div className="relative">
                                        <Key size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold text-slate-800" placeholder="••••••••" />
                                    </div>
                                </div>

                                {authError && <div className="p-3 bg-red-50 text-red-600 text-xs font-bold rounded-xl flex items-center gap-2 border border-red-100"><AlertCircle size={14} /> {authError}</div>}

                                <button type="submit" disabled={isProcessing} className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 disabled:opacity-70 text-base transform active:scale-95">
                                    {isProcessing ? <Loader2 className="animate-spin" /> : (authMode === 'register' ? 'Signer & Créer mon espace' : 'Connexion & Signer')}
                                </button>
                            </form>
                            <button onClick={() => setIsSigningModalOpen(false)} className="w-full mt-6 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors">Annuler et revenir</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PublicQuoteView;
