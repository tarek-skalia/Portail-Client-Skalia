
import React, { useEffect, useState, useRef } from 'react';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../lib/supabase';
import { 
    Check, Download, AlertCircle, FileText, Calendar, DollarSign, PenTool, 
    CheckCircle2, RefreshCw, Layers, ArrowRight, Lock, Mail, Loader2, Key, 
    Zap, Target, Users, ShieldCheck, Star, Phone, MapPin, Globe, Hash, Cpu, BrainCircuit,
    ArrowDown, ChevronDown, ChevronLeft, Scale, Clock, Sparkles, LayoutGrid
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

// --- SMART PARSER COMPONENT ---
const RichDescription: React.FC<{ text: string }> = ({ text }) => {
    if (!text) return <p className="text-slate-500 italic">Aucune description détaillée.</p>;

    const lines = text.split('\n');
    
    return (
        <div className="space-y-4">
            {lines.map((line, i) => {
                const trimmed = line.trim();
                if (!trimmed) return <div key={i} className="h-2" />; // Spacer

                // 1. Détection des Titres/Badges (ex: "OBJECTIFS :")
                // Règle : Commence par majuscule, finit par deux-points, longuer < 120 chars.
                const isBadge = /^[A-ZÀ-ÖØ-Þ0-9\s\W]+:$/.test(trimmed) && trimmed.length < 120;
                
                if (isBadge) {
                    return (
                        <div key={i} className="mt-6 mb-3">
                            <span className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-lg text-xs font-bold uppercase tracking-wider shadow-sm">
                                <Sparkles size={12} />
                                {trimmed.replace(':', '')}
                            </span>
                        </div>
                    );
                }

                // 2. Détection des Listes (commence par - )
                if (trimmed.startsWith('-')) {
                    return (
                        <div key={i} className="flex items-start gap-3 pl-2">
                            <div className="mt-1.5 min-w-[6px] h-[6px] rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]"></div>
                            <p className="text-slate-600 leading-relaxed text-sm md:text-base">
                                {trimmed.substring(1).trim()}
                            </p>
                        </div>
                    );
                }

                // 3. Paragraphe standard
                return (
                    <p key={i} className="text-slate-600 leading-relaxed text-sm md:text-base text-justify">
                        {trimmed}
                    </p>
                );
            })}
        </div>
    );
};

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
    delivery_delay?: string;
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
    const [viewMode, setViewMode] = useState<'quote' | 'legal'>('quote'); // Navigation interne
    const [isSigningModalOpen, setIsSigningModalOpen] = useState(false);
    const hasTrackedRef = useRef(false);
    
    // Auth State for "Magic Sign"
    // Initialisé plus tard quand on a les données du devis
    const [authMode, setAuthMode] = useState<'register' | 'login'>('register');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [authError, setAuthError] = useState('');
    const [termsAccepted, setTermsAccepted] = useState(false); // Checkbox Legal

    const projectSectionRef = useRef<HTMLElement>(null);

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
            
            // LOGIQUE INTELLIGENTE D'EMAIL ET DE MODE
            const targetEmail = quoteData.profile?.email || quoteData.recipient_email || '';
            setEmail(targetEmail);
            
            // Si profile_id existe -> C'est un client existant -> Force Login
            // Sinon -> C'est un prospect -> Force Register
            if (quoteData.profile_id) {
                setAuthMode('login');
            } else {
                setAuthMode('register');
            }

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

    const scrollToProject = () => {
        if (projectSectionRef.current) {
            projectSectionRef.current.scrollIntoView({ behavior: 'smooth' });
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
        
        // --- SÉCURITÉ ANTI-RESIGNATURE ---
        if (quote?.status === 'signed' || quote?.status === 'accepted') {
            setAuthError("Cette offre a déjà été signée.");
            return;
        }

        if (!termsAccepted) {
            setAuthError("Vous devez accepter les Conditions Générales de Vente pour continuer.");
            return;
        }

        setIsProcessing(true);
        setAuthError('');

        // On utilise un client temporaire pour s'authentifier
        const tempClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

        try {
            // 1. Capture IP (Audit Trail)
            let userIp = 'Unknown';
            try {
                const ipRes = await fetch('https://api.ipify.org?format=json');
                const ipData = await ipRes.json();
                userIp = ipData.ip;
            } catch (e) { console.warn("IP fetch failed"); }

            let userId = quote?.profile_id;
            let session = null;

            // 2. Gestion Auth
            if (authMode === 'login') {
                const { data, error } = await tempClient.auth.signInWithPassword({ email, password });
                if (error) throw new Error("Mot de passe incorrect.");
                userId = data.user.id;
                session = data.session;
            } else {
                const { data, error } = await tempClient.auth.signUp({ email, password });
                if (error) {
                    if (error.message.includes('already registered')) {
                        throw new Error("Un compte existe déjà avec cet email. Veuillez contacter Skalia si vous avez oublié vos accès.");
                    }
                    throw error;
                }
                
                if (data.user) {
                    userId = data.user.id;
                    session = data.session;
                    
                    // On tente de créer le profil immédiatement
                    // On utilise tempClient si on a une session, sinon on espère que supabase anon fonctionne (dépend RLS)
                    const profileClient = session ? tempClient : supabase;
                    
                    await profileClient.from('profiles').upsert({
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

            if (!userId) throw new Error("Erreur d'identification technique.");

            // IMPORTANT : FORCE LOGIN pour s'assurer que tempClient a les droits RLS
            // Si signUp n'a pas auto-login (cas Confirm Email), on force le login
            if (!session) {
                const { data: loginData, error: loginError } = await tempClient.auth.signInWithPassword({ email, password });
                if (loginError) {
                    // Si on ne peut pas se connecter (ex: email non confirmé), on ne peut pas mettre à jour le devis via RLS
                    // On lance une erreur explicite pour l'utilisateur
                    throw new Error("Veuillez confirmer votre email avant de pouvoir signer le devis, ou contactez le support.");
                }
                session = loginData.session;
            }

            // 3. Signature du Devis (Update)
            const auditTrail = {
                signed_at: new Date().toISOString(),
                signer_ip: userIp,
                signer_email: email,
                legal_version: 'v1.0-2025'
            };

            const currentTerms = quote?.payment_terms || {};
            const updatedTerms = { ...currentTerms, audit_trail: auditTrail };

            // On utilise tempClient qui est maintenant authentifié
            const { data: updatedData, error: signError } = await tempClient
                .from('quotes')
                .update({ 
                    status: 'signed', 
                    profile_id: userId, // LIEN CRITIQUE
                    payment_terms: updatedTerms,
                    updated_at: new Date().toISOString() 
                })
                .eq('id', quoteId)
                .select();

            if (signError) throw signError;
            
            // Vérification que l'update a bien eu lieu (RLS check)
            if (!updatedData || updatedData.length === 0) {
                throw new Error("Erreur de droits : Impossible de mettre à jour le devis. Contactez l'administrateur.");
            }

            // 4. Update CRM (Optionnel, best effort)
            if (quote?.lead_id) {
                try {
                    await tempClient.from('crm_leads').update({ status: 'won', updated_at: new Date().toISOString() }).eq('id', quote.lead_id);
                } catch (e) {}
            }

            // 5. Update Onboarding (Optionnel)
            const { data: profile } = await tempClient.from('profiles').select('onboarding_step').eq('id', userId).single();
            if (profile && (!profile.onboarding_step || profile.onboarding_step < 1)) {
                await tempClient.from('profiles').update({ onboarding_step: 1 }).eq('id', userId);
            }

            // 6. Login final sur l'app principale et Redirection
            await supabase.auth.signInWithPassword({ email, password });
            
            // On force le rechargement pour mettre à jour l'état local avant la redirection
            setQuote(prev => prev ? ({ ...prev, status: 'signed', profile_id: userId }) : null);
            setIsSigningModalOpen(false);
            
            // Redirection
            window.location.href = '/'; 

        } catch (err: any) {
            setAuthError(err.message || "Une erreur est survenue.");
        } finally {
            setIsProcessing(false);
        }
    };

    if (loading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center"><Loader2 className="animate-spin text-white" /></div>;
    if (error || !quote) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-red-400">{error}</div>;

    const companyName = quote.profile?.company_name || quote.recipient_company || 'votre entreprise';
    const isExistingClient = !!quote.profile_id;
    // Vérification stricte du statut pour l'affichage
    const isSignedOrAccepted = quote.status === 'signed' || quote.status === 'accepted' || quote.status === 'paid';

    // --- VUE JURIDIQUE SÉPARÉE (CGV) ---
    if (viewMode === 'legal') {
        return (
            <div className="min-h-screen bg-slate-50 font-sans">
                {/* ... (Code CGV inchangé) ... */}
                <div className="bg-white border-b border-slate-200 sticky top-0 z-50">
                    <div className="max-w-4xl mx-auto px-6 h-20 flex items-center justify-between">
                        <Logo classNameText="text-slate-900" />
                        <button 
                            onClick={() => setViewMode('quote')}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm transition-colors"
                        >
                            <ChevronLeft size={16} /> Retour à la proposition
                        </button>
                    </div>
                </div>

                <div className="max-w-3xl mx-auto px-6 py-12">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-10 md:p-16">
                        <h1 className="text-3xl font-bold text-slate-900 mb-2">Conditions Générales de Vente</h1>
                        <p className="text-slate-500 mb-10 text-sm">SKALIA SRL • BE1023.214.594 • Liège, Belgique</p>
                        <div className="prose prose-slate prose-sm max-w-none text-justify space-y-8">
                            <p>Les présentes Conditions Générales régissent l’ensemble des relations entre la SRL Skalia...</p>
                            {/* ... (Contenu abrégé pour clarté, remettre le texte complet si nécessaire) ... */}
                        </div>
                        <div className="mt-16 pt-8 border-t border-slate-100 flex justify-center">
                            <button onClick={() => setViewMode('quote')} className="px-8 py-4 bg-slate-900 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-600 transition-colors">
                                J'ai lu et je reviens au devis
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // --- VUE PRINCIPALE (DEVIS) ---
    return (
        <div className="min-h-screen bg-white font-sans selection:bg-indigo-200 selection:text-indigo-900 overflow-x-hidden">
            
            {/* --- HERO SECTION IMMERSIVE --- */}
            <header className="relative bg-[#0F0A1F] text-white min-h-[100vh] flex flex-col relative overflow-hidden">
                {/* Tech Background Grid & Glows */}
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute inset-0 opacity-10" 
                         style={{ backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
                    </div>
                    <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-purple-700/20 rounded-full blur-[120px] animate-pulse"></div>
                    <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-indigo-600/20 rounded-full blur-[100px]"></div>
                </div>

                <div className="max-w-7xl mx-auto px-6 md:px-12 relative z-10 w-full flex-1 flex flex-col justify-between py-12 md:py-16">
                    {/* Top Bar */}
                    <div className="flex justify-between items-start animate-fade-in">
                        <Logo className="w-12 h-12" classNameText="text-2xl" showText={true} />
                        <div className="text-right text-indigo-300/80 text-xs font-mono border border-white/10 px-3 py-1.5 rounded-lg bg-white/5 backdrop-blur-sm">
                            <p>REF: {quote.id.slice(0,8).toUpperCase()}</p>
                            <p>{new Date(quote.created_at).toLocaleDateString()}</p>
                        </div>
                    </div>

                    {/* Main Content Area */}
                    <div className="flex-1 flex items-center justify-center w-full">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24 w-full max-w-6xl items-center">
                            {/* Left: Text & CTA */}
                            <div className="flex flex-col justify-center">
                                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 text-xs font-bold uppercase tracking-widest mb-8 animate-fade-in-up w-fit">
                                    <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span>
                                    Proposition de Projet
                                </div>
                                <h1 className="text-5xl md:text-7xl font-bold leading-none tracking-tight mb-8 animate-fade-in-up delay-100">
                                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-indigo-100 to-indigo-300">
                                        {quote.title}
                                    </span>
                                </h1>
                                <div className="flex items-center gap-4 animate-fade-in-up delay-200 mb-10">
                                    <div className="h-px w-16 bg-indigo-500"></div>
                                    <p className="text-2xl md:text-3xl text-indigo-200 font-light">
                                        Pour <span className="font-bold text-white">{companyName}</span>
                                    </p>
                                </div>
                                <div className="animate-fade-in-up delay-300">
                                    <button 
                                        onClick={scrollToProject}
                                        className="group flex items-center gap-3 px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/10 rounded-full text-white font-semibold transition-all backdrop-blur-sm hover:scale-105"
                                    >
                                        Découvrir la solution
                                        <div className="w-8 h-8 rounded-full bg-white text-indigo-900 flex items-center justify-center group-hover:translate-y-1 transition-transform">
                                            <ArrowDown size={16} />
                                        </div>
                                    </button>
                                </div>
                            </div>

                            {/* Right: Holographic Tech Card */}
                            <div className="hidden lg:flex justify-end animate-fade-in-up delay-200 relative perspective-1000">
                                <div className="relative w-80 bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl transform rotate-y-6 rotate-z-2 animate-float hover:rotate-0 transition-all duration-700 group">
                                    {/* ... (Holographic Card Content) ... */}
                                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent rounded-3xl pointer-events-none"></div>
                                    <div className="flex items-center justify-between mb-8 border-b border-white/10 pb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-300 border border-white/5">
                                                <Cpu size={20} />
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-indigo-200 font-bold uppercase tracking-wider">Système</p>
                                                <p className="text-sm font-bold text-white">Skalia Engine v2.0</p>
                                            </div>
                                        </div>
                                        <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_10px_#34d399]"></div>
                                    </div>
                                    {/* ... */}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer Contact Info */}
                    <div className="border-t border-white/10 pt-8 animate-fade-in delay-300">
                        {/* ... (Contact Info) ... */}
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
                            {/* ... */}
                            <div className="md:ml-auto flex items-end gap-6">
                                <button onClick={() => setViewMode('legal')} className="text-xs font-bold text-indigo-300 hover:text-white transition-colors flex items-center gap-2 border-b border-transparent hover:border-white pb-0.5">
                                    <Scale size={14} /> Conditions Générales
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* --- SECTIONS CONTENT (Expertise, Projet, Méthodo, Prix) --- */}
            <section ref={projectSectionRef} className="py-24 bg-white relative overflow-hidden scroll-mt-20">
                {/* ... (Section Expertise) ... */}
                <div className="max-w-6xl mx-auto px-6">
                    <div className="text-center max-w-3xl mx-auto mb-20">
                        <h2 className="text-4xl font-bold text-slate-900 mb-6">L'expertise <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">Skalia</span>.</h2>
                        <p className="text-lg text-slate-600 leading-relaxed">Jeune agence liégeoise, Skalia aide les entreprises à supprimer les tâches répétitives...</p>
                    </div>
                    {/* ... */}
                </div>
            </section>

            {/* --- SECTION PROJET --- */}
            <section className="py-24 bg-slate-50 relative overflow-hidden">
                {/* ... (Section Projet avec RichDescription) ... */}
                <div className="max-w-7xl mx-auto px-6 relative z-10">
                    <div className="flex items-center gap-4 mb-12">
                        <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-md border border-slate-100"><Target size={28} /></div>
                        <div><h2 className="text-3xl font-bold text-slate-900">Le Projet</h2><p className="text-slate-500">Cadrage de la mission et objectifs.</p></div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 items-start">
                        <div className="lg:col-span-3">
                            <div className="bg-white rounded-[2rem] p-8 md:p-10 shadow-xl shadow-slate-100 border border-slate-100/80">
                                <RichDescription text={quote.description || "Aucune description détaillée."} />
                            </div>
                        </div>
                        {/* ... */}
                    </div>
                </div>
            </section>

            <section className="py-24 bg-[#0F0A1F] text-white relative overflow-hidden">
                {/* ... (Section Méthodologie) ... */}
            </section>

            <section className="py-24 bg-slate-50">
                {/* ... (Section Prix) ... */}
                <div className="max-w-5xl mx-auto px-6">
                    <div className="text-center mb-16"><h2 className="text-3xl font-bold text-slate-900 mb-4">Proposition Financière</h2></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                        {/* One Shot & Recurring Cards */}
                        <div className="bg-white rounded-[2rem] p-10 shadow-xl shadow-slate-200/50 border border-slate-100 relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300">
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
                            </ul>
                        </div>
                        {/* ... */}
                    </div>
                    {/* ... (Conditions) ... */}
                </div>
            </section>

            {/* --- FINAL ACTION SECTION --- */}
            {isSignedOrAccepted ? (
                <section className="py-20 bg-emerald-50 text-emerald-900 border-t border-emerald-100">
                    <div className="max-w-4xl mx-auto px-6 text-center">
                        <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-200">
                            <CheckCircle2 size={40} className="text-emerald-600" />
                        </div>
                        <h2 className="text-3xl md:text-4xl font-bold mb-4">Offre Validée</h2>
                        <p className="text-emerald-800 text-lg mb-8 max-w-2xl mx-auto leading-relaxed">
                            Merci de votre confiance ! Le projet est officiellement lancé.<br/>
                            Vous pouvez accéder à votre espace client pour suivre l'avancement.
                        </p>
                        <a href="/" className="inline-flex items-center gap-2 px-8 py-4 bg-emerald-600 text-white font-bold rounded-2xl shadow-xl shadow-emerald-200 hover:bg-emerald-700 transition-all transform hover:scale-105">
                            Accéder à mon espace <ArrowRight size={20} />
                        </a>
                    </div>
                </section>
            ) : (
                <section className="py-20 bg-slate-900 text-white relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/40 via-slate-900 to-slate-900 pointer-events-none"></div>
                    
                    <div className="max-w-4xl mx-auto px-6 relative z-10 text-center">
                        <h2 className="text-3xl md:text-4xl font-bold mb-6">Prêt à accélérer ?</h2>
                        <p className="text-indigo-200 text-lg mb-10 max-w-2xl mx-auto leading-relaxed">
                            Validez cette proposition pour lancer le projet. Dès signature, vous accéderez instantanément à votre espace client Skalia pour suivre l'avancement.
                        </p>
                        
                        <div className="flex justify-center">
                            <button 
                                onClick={handleOpenSignModal}
                                className="group relative overflow-hidden bg-white text-indigo-900 px-10 py-5 rounded-2xl font-black text-xl shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)] hover:shadow-[0_0_60px_-15px_rgba(255,255,255,0.5)] transition-all transform hover:scale-105 active:scale-95 flex items-center gap-3"
                            >
                                <span className="relative z-10 flex items-center gap-3">
                                    <PenTool size={24} />
                                    Accepter et Signer l'offre
                                </span>
                                <div className="absolute inset-0 bg-gradient-to-r from-indigo-50 to-white opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            </button>
                        </div>
                        
                        <p className="mt-6 text-xs text-slate-500 font-medium">
                            En signant, vous acceptez les conditions générales de vente de Skalia SRL.
                        </p>
                    </div>
                </section>
            )}

            {/* --- MODAL SIGNATURE --- */}
            {isSigningModalOpen && !isSignedOrAccepted && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up">
                        <div className="bg-slate-50 p-8 text-center border-b border-slate-100">
                            <div className="w-14 h-14 bg-white border border-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                                <Lock size={24} className="text-indigo-600" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900">
                                {isExistingClient ? "Dernière étape" : "Validation & Accès Portail"}
                            </h3>
                            <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                                {isExistingClient 
                                    ? `Bon retour ${quote.recipient_name?.split(' ')[0] || 'parmi nous'}, connectez-vous pour valider.` 
                                    : "Cette étape est double : elle signe électroniquement l'offre et crée votre accès client sécurisé."}
                            </p>
                        </div>

                        <div className="p-8">
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
                                    {!isExistingClient && (
                                        <p className="text-[10px] text-slate-400 mt-1 ml-1">Ce mot de passe servira à vous connecter à votre espace client Skalia.</p>
                                    )}
                                </div>

                                {/* CHECKBOX LEGAL - OBLIGATOIRE */}
                                <div className="flex items-start gap-3 mt-4 mb-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                                    <div className="relative flex items-center h-5">
                                        <input 
                                            type="checkbox" 
                                            id="terms" 
                                            required
                                            checked={termsAccepted}
                                            onChange={(e) => setTermsAccepted(e.target.checked)}
                                            className="w-5 h-5 border-2 border-slate-300 rounded focus:ring-indigo-500 text-indigo-600 cursor-pointer"
                                        />
                                    </div>
                                    <label htmlFor="terms" className="text-xs text-slate-600 leading-snug cursor-pointer select-none">
                                        J'accepte les <button type="button" onClick={() => setViewMode('legal')} className="text-indigo-600 font-bold underline hover:text-indigo-800">Conditions Générales de Vente</button> et je reconnais que la création de mon compte vaut signature électronique de l'offre.
                                    </label>
                                </div>

                                {authError && <div className="p-3 bg-red-50 text-red-600 text-xs font-bold rounded-xl flex items-center gap-2 border border-red-100"><AlertCircle size={14} /> {authError}</div>}

                                <button type="submit" disabled={isProcessing} className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 disabled:opacity-70 text-base transform active:scale-95 disabled:cursor-not-allowed">
                                    {isProcessing ? <Loader2 className="animate-spin" /> : (isExistingClient ? 'Connexion & Signer l\'offre' : 'Créer mon compte & Signer l\'offre')}
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
