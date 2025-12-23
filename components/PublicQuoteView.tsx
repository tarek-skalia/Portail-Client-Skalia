
import React, { useEffect, useState, useRef } from 'react';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../lib/supabase';
import { 
    Check, Download, AlertCircle, FileText, Calendar, DollarSign, PenTool, 
    CheckCircle2, RefreshCw, Layers, ArrowRight, Lock, Mail, Loader2, Key, 
    Zap, Target, Users, ShieldCheck, Star, Phone, MapPin, Globe, Hash, Cpu, BrainCircuit
} from 'lucide-react';
import Logo from './Logo';
import { createClient } from '@supabase/supabase-js';

// --- DATA STATIC (PDF CONTENT) ---
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

const SKALIA_EXPERTISE = [
    {
        title: "Automatisation & Intégration",
        desc: "Conception de systèmes complets qui connectent vos outils et optimisent vos processus de bout en bout.",
        icon: <Zap size={20} />
    },
    {
        title: "Agents IA sur mesure",
        desc: "Développement d’agents intelligents capables de traiter vos tâches complexes comme de vrais collaborateurs.",
        icon: <BrainCircuit size={20} />
    },
    {
        title: "Formation en entreprise",
        desc: "Transmission des savoir-faire pour assurer l’adoption et l’utilisation optimale des solutions.",
        icon: <Users size={20} />
    }
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
        <div className="min-h-screen bg-white font-sans selection:bg-indigo-200 selection:text-indigo-900 overflow-x-hidden">
            
            {/* --- HERO SECTION IMMERSIVE (Style PDF Skalia + Tech) --- */}
            <header className="relative bg-[#0F0A1F] text-white min-h-[100vh] flex flex-col relative overflow-hidden">
                
                {/* Tech Background Grid & Glows */}
                <div className="absolute inset-0 pointer-events-none">
                    {/* Grid Pattern */}
                    <div className="absolute inset-0 opacity-10" 
                         style={{ backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
                    </div>
                    {/* Glowing Orbs */}
                    <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-purple-700/20 rounded-full blur-[120px] animate-pulse"></div>
                    <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-indigo-600/20 rounded-full blur-[100px]"></div>
                </div>

                <div className="max-w-7xl mx-auto px-6 md:px-12 relative z-10 w-full flex-1 flex flex-col justify-between py-12 md:py-16">
                    
                    {/* Top Bar (Logo & Ref) */}
                    <div className="flex justify-between items-start animate-fade-in">
                        <Logo className="w-12 h-12" classNameText="text-2xl" showText={true} />
                        <div className="text-right text-indigo-300/80 text-xs font-mono border border-white/10 px-3 py-1.5 rounded-lg bg-white/5 backdrop-blur-sm">
                            <p>REF: {quote.id.slice(0,8).toUpperCase()}</p>
                            <p>{new Date(quote.created_at).toLocaleDateString()}</p>
                        </div>
                    </div>

                    {/* Main Title Content (Centered Vertically in available space) */}
                    <div className="flex-1 flex flex-col justify-center max-w-5xl">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 text-xs font-bold uppercase tracking-widest mb-8 animate-fade-in-up w-fit">
                            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span>
                            Proposition de Projet
                        </div>
                        
                        <h1 className="text-6xl md:text-8xl font-bold leading-none tracking-tight mb-8 animate-fade-in-up delay-100">
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-indigo-100 to-indigo-300">
                                {quote.title}
                            </span>
                        </h1>
                        
                        <div className="flex items-center gap-4 animate-fade-in-up delay-200">
                            <div className="h-px w-16 bg-indigo-500"></div>
                            <p className="text-2xl md:text-4xl text-indigo-200 font-light">
                                Pour <span className="font-bold text-white">{companyName}</span>
                            </p>
                        </div>
                    </div>

                    {/* Footer Contact Info (Hud Style - Always at bottom) */}
                    <div className="border-t border-white/10 pt-8 animate-fade-in delay-300">
                        <div className="flex flex-col md:flex-row gap-12 text-sm text-indigo-200/70">
                            
                            <div className="space-y-2">
                                <p className="font-bold text-white mb-1 uppercase tracking-wider text-xs flex items-center gap-2">
                                    <MapPin size={12} className="text-indigo-400" /> Agence
                                </p>
                                <div className="pl-5">
                                    <div className="flex items-center gap-2">Quai Banning 6, 4000 Liège</div>
                                    <div className="flex items-center gap-2 mt-1 font-mono text-xs opacity-70">BE1023214594</div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <p className="font-bold text-white mb-1 uppercase tracking-wider text-xs flex items-center gap-2">
                                    <Phone size={12} className="text-indigo-400" /> Contact
                                </p>
                                <div className="pl-5 flex flex-col gap-1">
                                    <a href="tel:+32465580790" className="hover:text-white transition-colors">+32 465 58 07 90</a>
                                    <a href="mailto:contact@skalia.io" className="hover:text-white transition-colors">contact@skalia.io</a>
                                </div>
                            </div>
                            
                            <div className="md:ml-auto flex items-end">
                                <a href="https://skalia.io" target="_blank" className="text-white font-bold hover:text-indigo-300 transition-colors flex items-center gap-2">
                                    <Globe size={16} /> skalia.io
                                </a>
                            </div>

                        </div>
                    </div>

                    {/* Scroll Indicator */}
                    <div className="absolute bottom-12 right-6 animate-bounce text-indigo-400 opacity-50 hidden md:block">
                        <ArrowRight className="rotate-90" size={24} />
                    </div>
                </div>
            </header>

            {/* --- SECTION 2 : SKALIA (Expertise & Team) - DÉPLACÉ ICI --- */}
            <section className="py-24 bg-white relative overflow-hidden">
                <div className="max-w-6xl mx-auto px-6">
                    
                    <div className="text-center max-w-3xl mx-auto mb-20">
                        <h2 className="text-4xl font-bold text-slate-900 mb-6">
                            L'expertise <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">Skalia</span>.
                        </h2>
                        <p className="text-lg text-slate-600 leading-relaxed">
                            Jeune agence liégeoise, Skalia aide les entreprises à supprimer les tâches répétitives et gagner en clarté en automatisant leurs processus avec l’intelligence artificielle. Notre approche pragmatique transforme la complexité en solutions simples.
                        </p>
                    </div>

                    {/* Savoir-Faire Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
                        {SKALIA_EXPERTISE.map((exp, i) => (
                            <div key={i} className="p-8 rounded-3xl bg-slate-50 border border-slate-100 hover:border-indigo-100 hover:shadow-lg transition-all group">
                                <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm mb-6 group-hover:scale-110 transition-transform duration-300">
                                    {exp.icon}
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 mb-3">{exp.title}</h3>
                                <p className="text-slate-500 leading-relaxed text-sm">
                                    {exp.desc}
                                </p>
                            </div>
                        ))}
                    </div>

                    {/* Team & Values Split */}
                    <div className="flex flex-col md:flex-row gap-16 items-center">
                        {/* Values */}
                        <div className="flex-1 space-y-6">
                            <h3 className="text-2xl font-bold text-slate-900 mb-6">Nos Valeurs</h3>
                            {[
                                { title: "Réactivité", desc: "Des solutions déployées rapidement." },
                                { title: "Transparence", desc: "Pas de coûts cachés, code documenté." },
                                { title: "Innovation", desc: "Les dernières technologies IA." }
                            ].map((val, i) => (
                                <div key={i} className="flex items-center gap-4">
                                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm shrink-0">
                                        {i+1}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-900">{val.title}</h4>
                                        <p className="text-sm text-slate-500">{val.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Team Photos */}
                        <div className="flex gap-6">
                            {AGENCY_TEAM.map((member, i) => (
                                <div key={i} className="group relative w-40 md:w-48 aspect-[3/4] rounded-2xl overflow-hidden shadow-xl border-4 border-white">
                                    <img src={member.img} alt={member.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-90"></div>
                                    <div className="absolute bottom-0 left-0 w-full p-4 text-white">
                                        <p className="font-bold text-sm">{member.name}</p>
                                        <p className="text-[10px] text-indigo-300 font-medium uppercase tracking-wider">{member.role}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>
            </section>

            {/* --- SECTION 3 : LE PROJET (Description Détaillée) - DÉPLACÉ ICI --- */}
            <section className="py-20 bg-slate-50 relative">
                <div className="max-w-4xl mx-auto px-6 relative z-10">
                    <div className="bg-white rounded-3xl p-8 md:p-12 shadow-xl border border-slate-100">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                                <Target size={24} />
                            </div>
                            <h2 className="text-3xl font-bold text-slate-900">Le Projet</h2>
                        </div>
                        
                        <div className="prose prose-lg text-slate-600 leading-relaxed whitespace-pre-line">
                            {quote.description || "Aucune description détaillée disponible pour ce projet."}
                        </div>
                    </div>
                </div>
                {/* Decor */}
                <div className="absolute top-1/2 left-0 w-64 h-64 bg-indigo-100/50 rounded-full blur-[80px] -translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>
            </section>

            {/* --- SECTION METHODOLOGIE (Timeline Fixed) --- */}
            <section className="py-24 bg-[#0F0A1F] text-white relative overflow-hidden">
                <div className="absolute inset-0 opacity-10" style={{backgroundImage: 'radial-gradient(#4f46e5 1px, transparent 1px)', backgroundSize: '30px 30px'}}></div>
                
                <div className="max-w-6xl mx-auto px-6 relative z-10">
                    <h2 className="text-3xl md:text-4xl font-bold mb-20 text-center">Notre méthode en 4 étapes</h2>
                    
                    <div className="relative">
                        {/* THE CONNECTING LINE (Absolute centered) */}
                        {/* Desktop: Horizontal */}
                        <div className="hidden md:block absolute top-8 left-0 right-0 h-0.5 bg-indigo-900/50 z-0">
                            <div className="h-full bg-indigo-500 w-full origin-left transform scale-x-100 transition-transform duration-1000"></div>
                        </div>
                        {/* Mobile: Vertical */}
                        <div className="md:hidden absolute left-8 top-0 bottom-0 w-0.5 bg-indigo-900/50 z-0"></div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 md:gap-8">
                            {METHODOLOGY_STEPS.map((step, i) => (
                                <div key={i} className="relative z-10 flex md:block items-start gap-6 group">
                                    {/* Circle Number */}
                                    <div className="w-16 h-16 rounded-2xl bg-[#1a152e] border border-indigo-500/30 flex items-center justify-center text-2xl font-bold text-indigo-400 shrink-0 group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-500 transition-all shadow-[0_0_20px_rgba(79,70,229,0.15)] group-hover:shadow-[0_0_30px_rgba(79,70,229,0.4)]">
                                        {step.num}
                                    </div>
                                    
                                    <div className="mt-2 md:mt-8">
                                        <h3 className="text-xl font-bold mb-2 text-white">{step.title}</h3>
                                        <p className="text-slate-400 text-sm leading-relaxed">
                                            {step.desc}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* --- SECTION PRICING (Tech Cards) --- */}
            <section className="py-24 bg-slate-50">
                <div className="max-w-5xl mx-auto px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-bold text-slate-900 mb-4">Proposition Financière</h2>
                        <p className="text-slate-500 max-w-lg mx-auto">
                            Une tarification claire et transparente.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                        
                        {/* CARD 1: SETUP */}
                        <div className="bg-white rounded-[2rem] p-10 shadow-xl shadow-slate-200/50 border border-slate-100 relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300">
                            <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                                <Layers size={140} />
                            </div>
                            <h3 className="text-sm font-bold text-indigo-600 uppercase tracking-widest mb-4">Initialisation</h3>
                            <div className="flex items-baseline gap-2 mb-8">
                                <span className="text-5xl font-extrabold text-slate-900">{formatCurrency(oneShotTotal)}</span>
                                <span className="text-xl text-slate-400 font-medium">HT</span>
                            </div>
                            
                            <ul className="space-y-4 mb-8 relative z-10">
                                {oneShotItems.map((item, idx) => (
                                    <li key={idx} className="flex items-start gap-3 text-slate-700">
                                        <div className="mt-1 p-0.5 bg-emerald-100 rounded-full text-emerald-600 shrink-0"><Check size={12} strokeWidth={3} /></div>
                                        <span className="text-sm font-medium">{item.description}</span>
                                    </li>
                                ))}
                                {oneShotItems.length === 0 && <li className="text-slate-400 italic text-sm">Aucun frais d'installation</li>}
                            </ul>
                        </div>

                        {/* CARD 2: RECURRING (Dark Mode) */}
                        <div className="bg-[#0F0A1F] rounded-[2rem] p-10 shadow-2xl shadow-indigo-900/20 border border-indigo-500/20 relative overflow-hidden text-white transform md:-translate-y-4 group">
                            <div className="absolute inset-0 bg-gradient-to-b from-indigo-900/20 to-transparent pointer-events-none"></div>
                            <div className="absolute top-0 right-0 p-6 opacity-10">
                                <RefreshCw size={140} />
                            </div>
                            
                            <div className="inline-block px-3 py-1 bg-indigo-500 rounded-full text-[10px] font-bold uppercase tracking-wide mb-6">
                                Mensualité
                            </div>
                            
                            <div className="flex items-baseline gap-2 mb-8">
                                <span className="text-5xl font-extrabold text-white">{formatCurrency(recurringTotal)}</span>
                                <span className="text-xl text-indigo-300 font-medium">/mois</span>
                            </div>
                            
                            <ul className="space-y-4 mb-8 relative z-10">
                                {recurringItems.length > 0 ? recurringItems.map((item, idx) => (
                                    <li key={idx} className="flex items-start gap-3 text-indigo-50">
                                        <div className="mt-1 p-0.5 bg-indigo-500/30 border border-indigo-500 rounded-full text-indigo-300 shrink-0"><Check size={12} strokeWidth={3} /></div>
                                        <span className="text-sm font-medium">{item.description}</span>
                                    </li>
                                )) : (
                                    <>
                                        <li className="flex items-start gap-3 text-indigo-50">
                                            <div className="mt-1 p-0.5 bg-indigo-500/30 border border-indigo-500 rounded-full text-indigo-300 shrink-0"><Check size={12} strokeWidth={3} /></div>
                                            <span className="text-sm font-medium">Hébergement serveurs & Base de données</span>
                                        </li>
                                        <li className="flex items-start gap-3 text-indigo-50">
                                            <div className="mt-1 p-0.5 bg-indigo-500/30 border border-indigo-500 rounded-full text-indigo-300 shrink-0"><Check size={12} strokeWidth={3} /></div>
                                            <span className="text-sm font-medium">Support technique prioritaire</span>
                                        </li>
                                    </>
                                )}
                            </ul>
                        </div>

                    </div>

                    {/* TOTAL RECAP */}
                    <div className="mt-12 bg-white rounded-2xl p-8 border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-6 shadow-sm">
                        <div className="text-center md:text-left">
                            <p className="text-sm text-slate-500 font-bold uppercase tracking-wider mb-1">Conditions de démarrage</p>
                            <p className="text-base text-slate-800">
                                {termsType === '100_percent' ? '100% à la commande' : termsType === '50_50' ? 'Acompte 50% à la commande' : 'Acompte 30% à la commande'}
                            </p>
                        </div>
                        <div className="text-center md:text-right">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total à régler aujourd'hui (TTC)</p>
                            <p className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">
                                {formatCurrency(totalDueNowTTC)}
                            </p>
                        </div>
                    </div>

                </div>
            </section>

            {/* --- STICKY FOOTER CTA --- */}
            {quote.status !== 'signed' && (
                <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-lg border-t border-slate-200 p-4 z-50 shadow-[0_-5px_30px_rgba(0,0,0,0.08)]">
                    <div className="max-w-5xl mx-auto flex justify-between items-center">
                        <div className="hidden md:block">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{quote.title}</p>
                            <p className="font-bold text-slate-900">Pour {companyName}</p>
                        </div>
                        <button 
                            onClick={handleOpenSignModal}
                            className="w-full md:w-auto relative overflow-hidden bg-slate-900 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-xl shadow-indigo-500/20 hover:shadow-indigo-500/40 transition-all flex items-center justify-center gap-3 transform hover:-translate-y-1 group"
                        >
                            {/* Shine Effect */}
                            <div className="absolute top-0 -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-gradient-to-r from-transparent to-white opacity-20 group-hover:animate-shine" />
                            
                            <PenTool size={20} />
                            Accepter et Signer
                        </button>
                    </div>
                </div>
            )}

            {/* --- MODAL SIGNATURE (Gardé identique) --- */}
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
