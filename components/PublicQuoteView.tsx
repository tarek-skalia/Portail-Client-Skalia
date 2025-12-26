
import React, { useEffect, useState, useRef } from 'react';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../lib/supabase';
import { 
    Check, Download, AlertCircle, FileText, Calendar, DollarSign, PenTool, 
    CheckCircle2, RefreshCw, Layers, ArrowRight, Lock, Mail, Loader2, Key, 
    Zap, Target, Users, ShieldCheck, Star, Phone, MapPin, Globe, Hash, Cpu, BrainCircuit,
    ArrowDown, ChevronDown, ChevronLeft, Scale, Clock, Sparkles, LayoutGrid, Terminal, Activity, Server, Rocket, Crown,
    Eye, HeartHandshake, Lightbulb, TrendingUp, GraduationCap, Workflow, Bot, Fingerprint, Shield
} from 'lucide-react';
import Logo from './Logo';
import { createClient } from '@supabase/supabase-js';

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

const SKALIA_KNOWHOW = [
    {
        title: "Automatisation & intégration",
        desc: "Conception de systèmes complets qui connectent vos outils et optimisent vos processus de bout en bout.",
        icon: <Workflow size={24} />
    },
    {
        title: "Agents IA sur mesure",
        desc: "Développement d'agents intelligents capables de traiter vos tâches complexes comme de vrais collaborateurs digitaux.",
        icon: <Bot size={24} />
    },
    {
        title: "Formation en entreprise",
        desc: "Transmission des savoir-faire pour assurer l'adoption et l'utilisation optimale des solutions.",
        icon: <GraduationCap size={24} />
    }
];

const SKALIA_VALUES = [
    {
        label: "Réactivité",
        color: "bg-slate-50 text-slate-800 border-slate-200",
        iconColor: "bg-amber-100 text-amber-600",
        icon: <Zap size={18} />
    },
    {
        label: "Transparence",
        color: "bg-slate-50 text-slate-800 border-slate-200",
        iconColor: "bg-blue-100 text-blue-600",
        icon: <Eye size={18} />
    },
    {
        label: "Innovation",
        color: "bg-slate-50 text-slate-800 border-slate-200",
        iconColor: "bg-purple-100 text-purple-600",
        icon: <Lightbulb size={18} />
    }
];

const METHODOLOGY_STEPS = [
    { num: '01', title: 'Onboarding', desc: 'Cadrage, compréhension des objectifs et collecte des accès.' },
    { num: '02', title: 'Réalisation', desc: 'Construction des flux, intégration IA et tests rigoureux.' },
    { num: '03', title: 'Livraison', desc: 'Démonstration, transfert de propriété et formation.' },
    { num: '04', title: 'Support', desc: 'Maintenance continue et ajustements post-lancement.' },
];

const formatCurrency = (val: number) => val.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 });

const RichDescription: React.FC<{ text: string }> = ({ text }) => {
    if (!text) return <p className="text-slate-500 italic">Aucune description détaillée.</p>;

    const lines = text.split('\n');
    
    return (
        <div className="space-y-4">
            {lines.map((line, i) => {
                const trimmed = line.trim();
                if (!trimmed) return <div key={i} className="h-2" />; // Spacer

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
    const [viewMode, setViewMode] = useState<'quote' | 'legal'>('quote'); 
    
    // --- SIGNATURE STATE ---
    const [isSigningModalOpen, setIsSigningModalOpen] = useState(false);
    const [signStep, setSignStep] = useState<1 | 2 | 3>(1); // 1: Email, 2: OTP, 3: Password/Finalize
    
    const [email, setEmail] = useState('');
    const [otpCode, setOtpCode] = useState('');
    const [password, setPassword] = useState('');
    const [termsAccepted, setTermsAccepted] = useState(false);
    
    const [isProcessing, setIsProcessing] = useState(false);
    const [authError, setAuthError] = useState('');
    const [auditIp, setAuditIp] = useState('');

    const hasTrackedRef = useRef(false);
    const projectSectionRef = useRef<HTMLElement>(null);

    useEffect(() => {
        fetchQuote();
        // Pré-chargement IP pour audit trail
        fetch('https://api.ipify.org?format=json')
            .then(res => res.json())
            .then(data => setAuditIp(data.ip))
            .catch(() => setAuditIp('IP_MASKED'));
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
            
            // Si le devis a un email défini, on le pré-remplit mais on ne le verrouille pas totalement (l'utilisateur doit confirmer)
            // Cependant, la logique OTP forcera à utiliser l'email qui reçoit le code.
            const targetEmail = quoteData.profile?.email || quoteData.recipient_email || '';
            setEmail(targetEmail);

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

    const handleOpenSignModal = () => {
        setIsSigningModalOpen(true);
        setSignStep(1);
        setAuthError('');
    };

    // --- STEP 1: SEND OTP ---
    const handleSendOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setAuthError('');
        setIsProcessing(true);

        // VÉRIFICATION DE SÉCURITÉ : L'email saisi DOIT correspondre à l'email du devis
        const requiredEmail = quote?.profile?.email || quote?.recipient_email;
        if (requiredEmail && email.toLowerCase().trim() !== requiredEmail.toLowerCase().trim()) {
            setAuthError(`Sécurité : Vous devez utiliser l'adresse email destinataire du devis (${requiredEmail}) pour signer.`);
            setIsProcessing(false);
            return;
        }

        try {
            const { error } = await supabase.auth.signInWithOtp({
                email: email,
                options: {
                    shouldCreateUser: true // Crée le compte si inexistant
                }
            });

            if (error) throw error;

            setSignStep(2); // Passage à l'étape Code
        } catch (err: any) {
            setAuthError(err.message || "Erreur lors de l'envoi du code.");
        } finally {
            setIsProcessing(false);
        }
    };

    // --- STEP 2: VERIFY OTP ---
    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setAuthError('');
        setIsProcessing(true);

        try {
            const { data, error } = await supabase.auth.verifyOtp({
                email,
                token: otpCode,
                type: 'email'
            });

            if (error) throw error;
            if (!data.session) throw new Error("Session invalide.");

            setSignStep(3); // Passage à l'étape Mot de passe / Finalisation
        } catch (err: any) {
            setAuthError("Code invalide ou expiré.");
        } finally {
            setIsProcessing(false);
        }
    };

    // --- STEP 3: FINALIZE SIGNATURE ---
    const handleFinalizeSignature = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!termsAccepted) {
            setAuthError("Veuillez accepter les conditions générales.");
            return;
        }
        if (password.length < 6) {
            setAuthError("Le mot de passe doit contenir au moins 6 caractères.");
            return;
        }

        setIsProcessing(true);
        setAuthError('');

        try {
            // 1. Définir le mot de passe (Secure Account)
            const { error: pwError, data: userData } = await supabase.auth.updateUser({ password: password });
            if (pwError) throw pwError;

            const userId = userData.user.id;

            // 2. Création/MàJ du Profil (Si nouveau user)
            const profileClient = supabase;
            await profileClient.from('profiles').upsert({
                id: userId,
                email: email,
                full_name: quote?.recipient_name || 'Nouveau Client',
                company_name: quote?.recipient_company || 'Société',
                avatar_initials: (quote?.recipient_name || 'NC').substring(0,2).toUpperCase(),
                role: 'client',
                updated_at: new Date().toISOString()
            });

            // 3. Constitution de la Preuve Juridique (Audit Trail)
            const auditTrail = {
                signed_at: new Date().toISOString(),
                signer_ip: auditIp,
                signer_email: email,
                auth_method: 'OTP_VERIFIED', // Preuve de l'OTP
                legal_version: 'v2.0-eIDAS-Simple',
                user_agent: navigator.userAgent
            };

            const currentTerms = quote?.payment_terms || {};
            const updatedTerms = { ...currentTerms, audit_trail: auditTrail };

            // 4. Update Quote Status
            const { error: signError } = await supabase
                .from('quotes')
                .update({ 
                    status: 'signed', 
                    profile_id: userId,
                    payment_terms: updatedTerms,
                    updated_at: new Date().toISOString() 
                })
                .eq('id', quoteId);

            if (signError) throw signError;

            // 5. Création des abonnements si nécessaire (Recurring Items)
            const recurringItems = quote?.items.filter(i => i.billing_frequency !== 'once') || [];
            if (recurringItems.length > 0) {
                const subscriptionsPayload = recurringItems.map((item: any) => ({
                    user_id: userId,
                    service_name: item.description,
                    amount: item.unit_price * item.quantity,
                    currency: 'EUR',
                    billing_cycle: item.billing_frequency,
                    status: 'pending',
                    created_at: new Date().toISOString()
                }));
                await supabase.from('client_subscriptions').insert(subscriptionsPayload);
            }

            // 6. Update CRM Status (si lié)
            if (quote?.lead_id) {
                await supabase.from('crm_leads').update({ status: 'won', updated_at: new Date().toISOString() }).eq('id', quote.lead_id);
            }

            // 7. Redirection
            window.location.href = '/'; 

        } catch (err: any) {
            setAuthError(err.message || "Erreur lors de la finalisation.");
        } finally {
            setIsProcessing(false);
        }
    };

    const scrollToProject = () => {
        if (projectSectionRef.current) {
            projectSectionRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    };

    const handleViewModeChange = (mode: 'quote' | 'legal') => {
        setViewMode(mode);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    if (loading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center"><Loader2 className="animate-spin text-white" /></div>;
    if (error || !quote) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-red-400">{error}</div>;

    const companyName = quote.profile?.company_name || quote.recipient_company || 'votre entreprise';
    const isSignedOrAccepted = quote.status === 'signed' || quote.status === 'paid';
    
    // Pricing Calcs
    const oneShotItems = quote.items.filter(i => i.billing_frequency === 'once');
    const recurringItems = quote.items.filter(i => i.billing_frequency !== 'once');
    const oneShotTotal = oneShotItems.reduce((acc, i) => acc + (i.unit_price * i.quantity), 0);
    const recurringTotal = recurringItems.reduce((acc, i) => acc + (i.unit_price * i.quantity), 0);
    const taxRate = quote.payment_terms?.tax_rate || 0;
    const isRetainer = quote.payment_terms?.quote_type === 'retainer'; 
    let depositAmountHT = oneShotTotal;
    const termsType = quote.payment_terms?.type || '100_percent';
    if (termsType === '50_50') depositAmountHT = oneShotTotal * 0.5;
    if (termsType === '30_70') depositAmountHT = oneShotTotal * 0.3;
    const totalDueNowTTC = depositAmountHT * (1 + taxRate / 100);
    const recurringTotalTTC = recurringTotal * (1 + taxRate / 100);

    // --- RENDERERS ---
    const renderStandardPricing = () => (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            <div className="bg-slate-50 rounded-[2rem] p-10 shadow-xl shadow-slate-200/50 border border-slate-100 relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300">
                <h3 className="text-sm font-bold text-indigo-600 uppercase tracking-widest mb-4">Mise en place (One-Shot)</h3>
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
            <div className="bg-[#0F0A1F] rounded-[2rem] p-10 shadow-2xl shadow-indigo-900/20 border border-indigo-500/20 relative overflow-hidden text-white transform md:-translate-y-4 group">
                <div className="absolute inset-0 bg-gradient-to-b from-indigo-900/20 to-transparent pointer-events-none"></div>
                <div className="inline-block px-3 py-1 bg-indigo-500 rounded-full text-[10px] font-bold uppercase tracking-wide mb-6">Abonnement Récurrent</div>
                <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-5xl font-extrabold text-white">{formatCurrency(recurringTotal)}</span>
                    <span className="text-xl text-indigo-300 font-medium">/mois</span>
                </div>
                <p className="text-xs text-indigo-300 mb-6 italic">Démarre uniquement à la livraison du projet.</p>
                <ul className="space-y-4 mb-8 relative z-10">
                    {recurringItems.length > 0 ? recurringItems.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-3 text-indigo-50">
                            <div className="mt-1 p-0.5 bg-indigo-500/30 border border-indigo-500 rounded-full text-indigo-300 shrink-0"><Check size={12} strokeWidth={3} /></div>
                            <span className="text-sm font-medium">{item.description}</span>
                        </li>
                    )) : (
                        <li className="flex items-start gap-3 text-indigo-50"><span className="text-sm font-medium">Pas d'abonnement récurrent prévu</span></li>
                    )}
                </ul>
            </div>
        </div>
    );

    const renderRetainerPricing = () => (
        <div className="max-w-2xl mx-auto">
            <div className="relative bg-[#0F0A1F] rounded-[2.5rem] p-12 text-white shadow-2xl overflow-hidden border border-indigo-500/30 transform hover:-translate-y-1 transition-all duration-500">
                <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-purple-600/30 rounded-full blur-[100px] translate-x-1/2 -translate-y-1/2"></div>
                <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-indigo-600/20 rounded-full blur-[100px] -translate-x-1/2 translate-y-1/2"></div>
                <div className="absolute top-6 right-6">
                    <div className="bg-gradient-to-r from-amber-400 to-orange-500 p-3 rounded-2xl shadow-lg shadow-amber-500/30">
                        <Crown size={24} className="text-white fill-white" />
                    </div>
                </div>
                <div className="relative z-10 text-center mb-10">
                    <h3 className="text-lg font-bold text-indigo-200 uppercase tracking-widest mb-2">Partenariat Skalia</h3>
                    <div className="flex items-baseline justify-center gap-2 mb-4">
                        <span className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-indigo-100 to-indigo-200 tracking-tight">
                            {formatCurrency(recurringTotalTTC)}
                        </span>
                        <span className="text-2xl text-indigo-400 font-medium">/mois</span>
                    </div>
                    {taxRate > 0 && <p className="text-xs text-indigo-300 font-mono mb-2">Dont TVA {taxRate}% incluse</p>}
                    <p className="text-indigo-200/80 text-sm max-w-sm mx-auto">Un accompagnement complet pour transformer votre entreprise, sans coûts cachés.</p>
                </div>
                <div className="relative z-10 bg-white/5 backdrop-blur-md rounded-2xl p-8 border border-white/10">
                    <div className="space-y-4">
                        {recurringItems.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-4 group">
                                <div className="p-1 bg-emerald-500 rounded-full text-white shrink-0 shadow-lg shadow-emerald-500/30"><Check size={14} strokeWidth={3} /></div>
                                <span className="text-lg font-medium text-white/90 group-hover:text-white transition-colors">{item.description}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="relative z-10 mt-10 text-center">
                    <p className="text-xs text-indigo-400 uppercase tracking-widest font-bold mb-4">Sans engagement de durée</p>
                    <button onClick={handleOpenSignModal} className="w-full py-5 bg-white text-indigo-900 font-black text-xl rounded-2xl hover:bg-indigo-50 transition-all shadow-[0_0_40px_-10px_rgba(255,255,255,0.5)] transform hover:scale-[1.02] flex items-center justify-center gap-3">
                        Devenir Partenaire <Rocket size={24} className="text-indigo-600" />
                    </button>
                </div>
            </div>
        </div>
    );

    if (viewMode === 'legal') {
        return (
            <div className="min-h-screen bg-slate-50 font-sans animate-fade-in">
                <div className="bg-white border-b border-slate-200 sticky top-0 z-50">
                    <div className="max-w-4xl mx-auto px-6 h-20 flex items-center justify-between">
                        <Logo classNameText="text-slate-900" />
                        <button onClick={() => handleViewModeChange('quote')} className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm transition-colors">
                            <ChevronLeft size={16} /> Retour à la proposition
                        </button>
                    </div>
                </div>
                <div className="max-w-3xl mx-auto px-6 py-12">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-10 md:p-16">
                        <h1 className="text-3xl font-bold text-slate-900 mb-2">Conditions Générales de Vente</h1>
                        <p className="text-slate-500 mb-10 text-sm">SKALIA SRL • BE1023.214.594 • Liège, Belgique</p>
                        <div className="prose prose-slate prose-sm max-w-none text-justify space-y-8">
                            <p>Les présentes Conditions Générales régissent l’ensemble des relations entre la SRL Skalia (ci-dessous dénommée « le prestataire ») et ses clients...</p>
                            <p className="italic text-slate-400">[Texte légal complet masqué pour la brièveté de la démo]</p>
                        </div>
                        <div className="mt-16 pt-8 border-t border-slate-100 flex justify-center">
                            <button onClick={() => handleViewModeChange('quote')} className="px-8 py-4 bg-slate-900 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-600 transition-colors">J'ai lu et je reviens au devis</button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white font-sans selection:bg-indigo-200 selection:text-indigo-900 overflow-x-hidden">
            <header className="relative bg-[#0F0A1F] text-white min-h-[100vh] flex flex-col relative overflow-hidden">
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
                    <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-purple-700/20 rounded-full blur-[120px] animate-pulse"></div>
                    <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-indigo-600/20 rounded-full blur-[100px]"></div>
                </div>
                <div className="max-w-7xl mx-auto px-6 md:px-12 relative z-10 w-full flex-1 flex flex-col justify-between py-12 md:py-16">
                    <div className="flex justify-between items-start animate-fade-in">
                        <Logo className="w-20 h-20" classNameText="text-4xl tracking-tighter" showText={true} />
                        <div className="text-right text-indigo-300/80 text-xs font-mono border border-white/10 px-3 py-1.5 rounded-lg bg-white/5 backdrop-blur-sm">
                            <p>REF: {quote.id.slice(0,8).toUpperCase()}</p>
                            <p>{new Date(quote.created_at).toLocaleDateString()}</p>
                        </div>
                    </div>
                    <div className="flex-1 flex items-center justify-center w-full">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24 w-full max-w-6xl items-center">
                            <div className="flex flex-col justify-center">
                                <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-bold uppercase tracking-widest mb-8 animate-fade-in-up w-fit ${isRetainer ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' : 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'}`}>
                                    <span className={`w-2 h-2 rounded-full animate-pulse ${isRetainer ? 'bg-amber-400' : 'bg-indigo-400'}`}></span>
                                    {isRetainer ? 'Partenariat Long-Terme' : 'Proposition de Projet'}
                                </div>
                                <h1 className="text-5xl md:text-7xl font-bold leading-none tracking-tight mb-8 animate-fade-in-up delay-100">
                                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-indigo-100 to-indigo-300">{quote.title}</span>
                                </h1>
                                <div className="flex items-center gap-4 animate-fade-in-up delay-200 mb-10">
                                    <div className="h-px w-16 bg-indigo-500"></div>
                                    <p className="text-2xl md:text-3xl text-indigo-200 font-light">Pour <span className="font-bold text-white">{companyName}</span></p>
                                </div>
                                <div className="animate-fade-in-up delay-300">
                                    <button onClick={scrollToProject} className="group flex items-center gap-3 px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/10 rounded-full text-white font-semibold transition-all backdrop-blur-sm hover:scale-105">
                                        Découvrir la solution <div className="w-8 h-8 rounded-full bg-white text-indigo-900 flex items-center justify-center group-hover:translate-y-1 transition-transform"><ArrowDown size={16} /></div>
                                    </button>
                                </div>
                            </div>
                            <div className="hidden lg:flex justify-end animate-fade-in-up delay-200 relative perspective-1000">
                                <div className="relative w-96 bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl transform rotate-y-6 rotate-z-2 animate-float hover:rotate-0 transition-all duration-700 group flex flex-col gap-6">
                                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent rounded-3xl pointer-events-none"></div>
                                    <div className="flex items-center justify-between border-b border-white/10 pb-6">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-300 border border-white/5"><Cpu size={24} /></div>
                                            <div><p className="text-[10px] text-indigo-200 font-bold uppercase tracking-wider">Système</p><p className="text-lg font-bold text-white">Skalia Engine v2.0</p></div>
                                        </div>
                                        <div className="w-3 h-3 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_10px_#34d399]"></div>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                                            <div className="flex justify-between items-center mb-2"><span className="text-xs text-indigo-200 font-mono">DEPLOY_PIPELINE</span><span className="text-xs text-emerald-400 font-bold">RUNNING</span></div>
                                            <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden"><div className="bg-gradient-to-r from-indigo-500 to-emerald-400 h-full w-[75%] rounded-full animate-pulse"></div></div>
                                        </div>
                                        <div className="flex items-center gap-3"><Terminal size={14} className="text-slate-400" /><p className="text-xs text-slate-300 font-mono">Initializing core modules...</p></div>
                                        <div className="flex items-center gap-3"><CheckCircle2 size={14} className="text-emerald-500" /><p className="text-xs text-white font-mono">AI Models loaded successfully</p></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <section ref={projectSectionRef} className="py-24 bg-white relative overflow-hidden scroll-mt-20">
                <div className="max-w-6xl mx-auto px-6">
                    <div className="text-center max-w-4xl mx-auto mb-16">
                        <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-6 tracking-tight">Skalia.</h2>
                        <p className="text-lg text-slate-600 leading-relaxed font-medium">Jeune agence liégeoise, Skalia aide les entreprises à supprimer les tâches répétitives...</p>
                    </div>
                    <div className="text-center mb-10">
                        <h3 className="text-2xl font-bold text-slate-900 flex items-center justify-center gap-3"><span className="w-8 h-1 bg-slate-900 rounded-full"></span>Savoir-faire</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-24">
                        {SKALIA_KNOWHOW.map((item, i) => (
                            <div key={i} className="bg-slate-50 rounded-2xl p-8 border border-slate-100 hover:border-indigo-200 transition-all group hover:-translate-y-1 hover:shadow-lg duration-300">
                                <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-md mb-6 group-hover:scale-110 transition-transform group-hover:rotate-3">{item.icon}</div>
                                <h3 className="text-xl font-bold text-slate-900 mb-3">{item.title}</h3>
                                <p className="text-slate-500 leading-relaxed">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 items-start">
                        <div className="lg:col-span-2 space-y-8">
                            <h3 className="text-2xl font-bold text-slate-900 border-l-4 border-slate-900 pl-4">L'équipe</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                {AGENCY_TEAM.map((member, i) => (
                                    <div key={i} className="relative group overflow-hidden rounded-2xl h-[340px] w-full shadow-xl transition-all duration-300 hover:shadow-2xl">
                                        <img src={member.img} alt={member.name} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/20 to-transparent opacity-80"></div>
                                        <div className="absolute bottom-0 left-0 p-8 transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                                            <p className="text-white font-bold text-2xl mb-1">{member.name}</p>
                                            <p className="text-indigo-300 font-medium text-lg flex items-center gap-2"><div className="w-8 h-0.5 bg-indigo-500"></div>{member.role}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-8">
                            <h3 className="text-2xl font-bold text-slate-900 border-l-4 border-slate-900 pl-4">Nos valeurs</h3>
                            <div className="space-y-4">
                                {SKALIA_VALUES.map((val, i) => (
                                    <div key={i} className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${val.color} bg-white shadow-sm hover:shadow-md`}>
                                        <div className={`p-2 rounded-lg ${val.iconColor}`}>{val.icon}</div>
                                        <span className="font-bold text-lg text-slate-800">{val.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="py-24 bg-[#0F0A1F] text-white relative overflow-hidden">
                <div className="max-w-7xl mx-auto px-6 relative z-10">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-black mb-4 tracking-tight">Notre Méthodologie<span className="text-indigo-500">.</span></h2>
                        <p className="text-indigo-300">Un processus clair en 4 étapes.</p>
                    </div>
                    <div className="relative grid grid-cols-1 md:grid-cols-4 gap-8">
                        <div className="hidden md:block absolute top-8 left-0 right-0 h-0.5 bg-gradient-to-r from-indigo-500/0 via-indigo-500 to-indigo-500/0 z-0"></div>
                        {METHODOLOGY_STEPS.map((step, i) => (
                            <div key={i} className="relative z-10 flex flex-col items-center text-center group">
                                <div className="w-16 h-16 rounded-full bg-[#0F0A1F] border-2 border-indigo-500 flex items-center justify-center text-xl font-bold text-white shadow-[0_0_20px_rgba(99,102,241,0.4)] mb-6 group-hover:scale-110 transition-transform duration-300">{step.num}</div>
                                <h3 className="text-lg font-bold mb-2 text-indigo-100">{step.title}</h3>
                                <p className="text-sm text-slate-400 leading-relaxed max-w-[200px]">{step.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section className="py-24 bg-slate-50 relative overflow-hidden border-b border-slate-200">
                <div className="max-w-5xl mx-auto px-6 relative z-10">
                    <div className="flex items-center gap-4 mb-12">
                        <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-md border border-slate-100"><Target size={28} /></div>
                        <div>
                            <h2 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">Le Projet<span className="text-indigo-500">.</span></h2>
                            <p className="text-slate-500">Cadrage de la mission et objectifs.</p>
                        </div>
                    </div>
                    <div className="bg-white rounded-[2rem] p-8 md:p-12 shadow-xl shadow-slate-100 border border-slate-100/80">
                        <RichDescription text={quote.description || "Aucune description détaillée."} />
                    </div>
                </div>
            </section>

            <section className="py-24 bg-white shadow-[inset_0_20px_20px_-20px_rgba(0,0,0,0.05)]">
                <div className="max-w-5xl mx-auto px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-4 tracking-tight">Proposition Financière<span className="text-amber-400">.</span></h2>
                    </div>
                    {isRetainer ? renderRetainerPricing() : renderStandardPricing()}
                    {!isRetainer && (
                        <div className="mt-12 bg-slate-50 rounded-2xl p-8 border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-6 shadow-sm">
                            <div className="text-center md:text-left">
                                <p className="text-sm text-slate-500 font-bold uppercase tracking-wider mb-1">Conditions de démarrage</p>
                                <p className="text-base text-slate-800">{termsType === '100_percent' ? '100% à la commande' : termsType === '50_50' ? 'Acompte 50% à la commande' : 'Acompte 30% à la commande'}</p>
                            </div>
                            <div className="text-center md:text-right">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total à régler maintenant (TTC)</p>
                                <p className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">{formatCurrency(totalDueNowTTC)}</p>
                                {recurringTotal > 0 && <p className="text-[10px] text-slate-400 mt-1">*Hors abonnement (débutera plus tard)</p>}
                            </div>
                        </div>
                    )}
                </div>
            </section>

            {(!isRetainer || isSignedOrAccepted) && (
                isSignedOrAccepted ? (
                    <section className="py-20 bg-emerald-50 text-emerald-900 border-t border-emerald-100">
                        <div className="max-w-4xl mx-auto px-6 text-center">
                            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-200"><CheckCircle2 size={40} className="text-emerald-600" /></div>
                            <h2 className="text-3xl md:text-4xl font-bold mb-4">Offre Validée</h2>
                            <p className="text-emerald-800 text-lg mb-8 max-w-2xl mx-auto leading-relaxed">Merci de votre confiance ! Le projet est officiellement lancé.<br/>Vous pouvez accéder à votre espace client pour suivre l'avancement.</p>
                            <a href="/" className="inline-flex items-center gap-2 px-8 py-4 bg-emerald-600 text-white font-bold rounded-2xl shadow-xl shadow-emerald-200 hover:bg-emerald-700 transition-all transform hover:scale-105">Accéder à mon espace <ArrowRight size={20} /></a>
                        </div>
                    </section>
                ) : (
                    <section className="py-20 bg-slate-900 text-white relative overflow-hidden">
                        <div className="max-w-4xl mx-auto px-6 relative z-10 text-center">
                            <h2 className="text-3xl md:text-4xl font-bold mb-6">Prêt à accélérer ?</h2>
                            <p className="text-indigo-200 text-lg mb-10 max-w-2xl mx-auto leading-relaxed">Validez cette proposition pour lancer le projet. Dès signature, vous accéderez instantanément à votre espace client Skalia.</p>
                            <div className="flex justify-center">
                                <button onClick={handleOpenSignModal} className="group relative overflow-hidden bg-white text-indigo-900 px-10 py-5 rounded-2xl font-black text-xl shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)] hover:shadow-[0_0_60px_-15px_rgba(255,255,255,0.5)] transition-all transform hover:scale-105 active:scale-95 flex items-center gap-3">
                                    <span className="relative z-10 flex items-center gap-3"><PenTool size={24} />Accepter et Signer</span>
                                </button>
                            </div>
                            <p className="mt-6 text-xs text-slate-500 font-medium">En signant, vous acceptez les <button onClick={() => handleViewModeChange('legal')} className="text-indigo-400 hover:underline">conditions générales de vente</button> de Skalia SRL.</p>
                        </div>
                    </section>
                )
            )}

            <footer className="bg-white py-12 border-t border-slate-200">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="flex flex-col md:flex-row justify-between items-center text-sm text-slate-500 gap-6">
                        <div className="flex items-center gap-4"><p>© {new Date().getFullYear()} Skalia SRL. Tous droits réservés.</p></div>
                        <div className="flex flex-wrap justify-center gap-6 font-medium">
                            <button onClick={() => handleViewModeChange('legal')} className="hover:text-indigo-600 transition-colors">Conditions Générales de Vente</button>
                            <a href="https://www.skalia.io/mentions-legales" target="_blank" className="hover:text-indigo-600 transition-colors">Mentions Légales</a>
                            <a href="https://www.skalia.io/politique-de-confidentialite" target="_blank" className="hover:text-indigo-600 transition-colors">Politique de Confidentialité</a>
                        </div>
                    </div>
                </div>
            </footer>

            {/* --- MAGIC SIGN MODAL (WIZARD) --- */}
            {isSigningModalOpen && !isSignedOrAccepted && (
                <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up relative">
                        
                        {/* Header Wizard */}
                        <div className="bg-slate-50 p-6 text-center border-b border-slate-100">
                            {/* Steps Indicator */}
                            <div className="flex justify-center items-center gap-3 mb-6">
                                {[1, 2, 3].map(s => (
                                    <div key={s} className={`h-2 rounded-full transition-all duration-300 ${s === signStep ? 'w-8 bg-indigo-600' : s < signStep ? 'w-2 bg-emerald-500' : 'w-2 bg-slate-200'}`}></div>
                                ))}
                            </div>

                            <h3 className="text-xl font-bold text-slate-900">
                                {signStep === 1 && "Identification"}
                                {signStep === 2 && "Vérification d'identité"}
                                {signStep === 3 && "Sécurisation & Signature"}
                            </h3>
                            <p className="text-xs text-slate-500 mt-1">
                                {signStep === 1 && "Pour valider ce document, nous devons confirmer votre identité."}
                                {signStep === 2 && "Nous avons envoyé un code unique à votre adresse email."}
                                {signStep === 3 && "Dernière étape pour créer votre accès sécurisé."}
                            </p>
                        </div>

                        <div className="p-8">
                            
                            {/* STEP 1: EMAIL */}
                            {signStep === 1 && (
                                <form onSubmit={handleSendOtp} className="space-y-5">
                                    <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 flex gap-3 text-xs text-blue-800 leading-snug">
                                        <Lock size={16} className="shrink-0 text-blue-600" />
                                        Veuillez utiliser l'adresse email professionnelle à laquelle ce devis a été envoyé.
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Email Professionnel</label>
                                        <div className="relative">
                                            <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input 
                                                type="email" 
                                                required 
                                                value={email} 
                                                onChange={e => setEmail(e.target.value)} 
                                                className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold text-slate-800" 
                                                placeholder="nom@entreprise.com" 
                                            />
                                        </div>
                                    </div>
                                    <button type="submit" disabled={isProcessing} className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 disabled:opacity-70">
                                        {isProcessing ? <Loader2 className="animate-spin" /> : "Envoyer le code de sécurité"}
                                    </button>
                                </form>
                            )}

                            {/* STEP 2: OTP */}
                            {signStep === 2 && (
                                <form onSubmit={handleVerifyOtp} className="space-y-5">
                                    <div className="text-center mb-4">
                                        <p className="text-sm font-medium text-slate-600">Code envoyé à <strong className="text-slate-900">{email}</strong></p>
                                        <button type="button" onClick={() => setSignStep(1)} className="text-xs text-indigo-500 underline mt-1">Modifier l'email</button>
                                    </div>
                                    
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 text-center">Code de sécurité (6 chiffres)</label>
                                        <input 
                                            type="text" 
                                            required 
                                            value={otpCode} 
                                            onChange={e => setOtpCode(e.target.value.replace(/[^0-9]/g, '').slice(0,6))} 
                                            className="w-full text-center py-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-2xl font-bold tracking-[0.5em] text-slate-800 font-mono placeholder:tracking-normal" 
                                            placeholder="000000"
                                            autoFocus
                                        />
                                    </div>

                                    <button type="submit" disabled={isProcessing || otpCode.length < 6} className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed">
                                        {isProcessing ? <Loader2 className="animate-spin" /> : "Vérifier l'identité"}
                                    </button>
                                </form>
                            )}

                            {/* STEP 3: PASSWORD & SIGN */}
                            {signStep === 3 && (
                                <form onSubmit={handleFinalizeSignature} className="space-y-5">
                                    <div className="flex items-center justify-center gap-2 text-emerald-600 bg-emerald-50 py-2 rounded-lg text-xs font-bold mb-2">
                                        <ShieldCheck size={14} /> Identité vérifiée
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Définir votre mot de passe</label>
                                        <div className="relative">
                                            <Key size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input 
                                                type="password" 
                                                required 
                                                value={password} 
                                                onChange={e => setPassword(e.target.value)} 
                                                className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold text-slate-800" 
                                                placeholder="••••••••" 
                                            />
                                        </div>
                                        <p className="text-[10px] text-slate-400 mt-1 ml-1">Ce mot de passe servira à accéder à votre espace client.</p>
                                    </div>

                                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 mt-4">
                                        <p className="text-[10px] text-slate-400 uppercase font-bold mb-2 flex items-center gap-1">
                                            <Fingerprint size={12} /> Données de signature
                                        </p>
                                        <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-600 font-mono">
                                            <div>IP: {auditIp}</div>
                                            <div>Date: {new Date().toLocaleDateString()}</div>
                                            <div className="col-span-2">Email: {email}</div>
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-3 mt-2">
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
                                            Je certifie être habilité à engager la société et j'accepte les <button type="button" onClick={() => handleViewModeChange('legal')} className="text-indigo-600 font-bold underline">CGV</button>.
                                        </label>
                                    </div>

                                    <button type="submit" disabled={isProcessing} className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-2 disabled:opacity-70 transform active:scale-95">
                                        {isProcessing ? <Loader2 className="animate-spin" /> : "Signer électroniquement"}
                                    </button>
                                </form>
                            )}

                            {/* ERROR MESSAGE */}
                            {authError && (
                                <div className="mt-4 p-3 bg-red-50 text-red-600 text-xs font-bold rounded-xl flex items-center gap-2 border border-red-100 animate-fade-in">
                                    <AlertCircle size={14} className="shrink-0" /> {authError}
                                </div>
                            )}

                            {/* CANCEL */}
                            <button onClick={() => setIsSigningModalOpen(false)} className="w-full mt-6 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors">
                                Annuler
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PublicQuoteView;
