import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { 
    Check, Crown, Rocket, FileSignature, Loader2, AlertCircle, 
    CheckCircle2, X, Clock, Mail, Globe, Phone, MapPin 
} from 'lucide-react';
import Logo from './Logo';
import { Quote } from '../types';

interface PublicQuoteViewProps {
    quoteId: string;
}

const PublicQuoteView: React.FC<PublicQuoteViewProps> = ({ quoteId }) => {
    const [quote, setQuote] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSignModalOpen, setIsSignModalOpen] = useState(false);
    const [isSigning, setIsSigning] = useState(false);
    const [signName, setSignName] = useState('');
    const [signEmail, setSignEmail] = useState('');

    useEffect(() => {
        fetchQuote();
    }, [quoteId]);

    const fetchQuote = async () => {
        try {
            // On essaie de récupérer le devis par son ID
            // Note: En production, il faudrait s'assurer que les politiques RLS permettent la lecture publique
            // ou utiliser une Edge Function sécurisée.
            const { data, error } = await supabase
                .from('quotes')
                .select('*, quote_items(*), profiles(company_name, logo_url, address, email, phone, vat_number)')
                .eq('id', quoteId)
                .single();

            if (error) throw error;
            if (!data) throw new Error("Devis introuvable.");

            setQuote(data);
        } catch (err: any) {
            console.error("Erreur chargement devis:", err);
            setError("Ce devis est introuvable ou a expiré.");
        } finally {
            setLoading(false);
        }
    };

    const handleSignQuote = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSigning(true);
        try {
            const { error } = await supabase
                .from('quotes')
                .update({ 
                    status: 'signed', 
                    updated_at: new Date().toISOString() 
                    // Idéalement on stockerait aussi le nom/email du signataire et la date de signature
                })
                .eq('id', quoteId);

            if (error) throw error;
            
            // Re-fetch pour mettre à jour l'UI
            await fetchQuote();
            setIsSignModalOpen(false);
        } catch (err) {
            alert("Erreur lors de la signature. Veuillez réessayer.");
        } finally {
            setIsSigning(false);
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-indigo-600" size={32} /></div>;
    
    if (error || !quote) return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
            <div className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-md">
                <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertCircle size={32} />
                </div>
                <h1 className="text-xl font-bold text-slate-900 mb-2">Impossible d'accéder au devis</h1>
                <p className="text-slate-500 mb-6">{error}</p>
                <a href="/" className="text-indigo-600 font-bold hover:underline">Retour à l'accueil</a>
            </div>
        </div>
    );

    // --- CALCULS ---
    const items = quote.quote_items || [];
    const taxRate = quote.payment_terms?.tax_rate ? Number(quote.payment_terms.tax_rate) : 0;
    const isRetainer = quote.payment_terms?.quote_type === 'retainer';

    // Totaux
    const subTotalHT = items.reduce((acc: number, item: any) => acc + (item.quantity * item.unit_price), 0);
    const taxAmount = subTotalHT * (taxRate / 100);
    const totalTTC = subTotalHT + taxAmount;

    // Pour le mode retainer spécifique du snippet
    const recurringItems = items; // Dans le cas retainer, tous les items sont récurrents
    const recurringTotalTTC = totalTTC; // Pour l'affichage

    const handleOpenSignModal = () => {
        setIsSignModalOpen(true);
    };

    // --- RENDER RETAINER VIEW ---
    const renderRetainerPricing = () => (
        <div className="max-w-2xl mx-auto my-12">
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
                        <span className="text-6xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-indigo-100 to-indigo-200 tracking-tight">
                            {formatCurrency(recurringTotalTTC)}
                        </span>
                        <span className="text-2xl text-indigo-400 font-medium">/mois</span>
                    </div>
                    {taxRate > 0 && <p className="text-xs text-indigo-300 font-mono mb-2">Dont TVA {taxRate}% incluse</p>}
                    <p className="text-indigo-200/80 text-sm max-w-sm mx-auto">Un accompagnement complet pour transformer votre entreprise, sans coûts cachés.</p>
                </div>
                <div className="relative z-10 bg-white/5 backdrop-blur-md rounded-2xl p-8 border border-white/10">
                    <div className="space-y-4">
                        {recurringItems.map((item: any, idx: number) => (
                            <div key={idx} className="flex items-center gap-4 group">
                                <div className="p-1 bg-emerald-500 rounded-full text-white shrink-0 shadow-lg shadow-emerald-500/30"><Check size={14} strokeWidth={3} /></div>
                                <span className="text-lg font-medium text-white/90 group-hover:text-white transition-colors">{item.description}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="relative z-10 mt-10 text-center">
                    <p className="text-xs text-indigo-400 uppercase tracking-widest font-bold mb-4">
                        {quote.delivery_delay ? `Durée du contrat : ${quote.delivery_delay}` : 'Sans engagement de durée'}
                    </p>
                    {quote.status === 'signed' || quote.status === 'paid' ? (
                        <div className="w-full py-5 bg-emerald-500 text-white font-black text-xl rounded-2xl shadow-lg flex items-center justify-center gap-3 cursor-default">
                            <CheckCircle2 size={24} /> Offre déjà validée
                        </div>
                    ) : (
                        <button onClick={handleOpenSignModal} className="w-full py-5 bg-white text-indigo-900 font-black text-xl rounded-2xl hover:bg-indigo-50 transition-all shadow-[0_0_40px_-10px_rgba(255,255,255,0.5)] transform hover:scale-[1.02] flex items-center justify-center gap-3">
                            Devenir Partenaire <Rocket size={24} className="text-indigo-600" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );

    // --- RENDER STANDARD VIEW ---
    const renderStandardQuote = () => (
        <div className="max-w-4xl mx-auto my-12 bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-200">
            {/* Header */}
            <div className="bg-slate-900 text-white p-12 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/30 rounded-full blur-[80px] translate-x-1/2 -translate-y-1/2"></div>
                <div className="relative z-10 flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-bold mb-2">Devis</h1>
                        <p className="text-indigo-200 text-sm">#{quoteId.slice(0, 8).toUpperCase()}</p>
                    </div>
                    {/* Logo Agence */}
                    {quote.profiles?.logo_url ? (
                        <img src={quote.profiles.logo_url} alt="Logo" className="h-16 object-contain bg-white rounded-lg p-2" />
                    ) : (
                        <div className="bg-white text-slate-900 font-bold p-4 rounded-xl">LOGO</div>
                    )}
                </div>
                
                <div className="relative z-10 mt-12 grid grid-cols-2 gap-8">
                    <div>
                        <p className="text-xs font-bold text-indigo-300 uppercase tracking-widest mb-1">Émetteur</p>
                        <p className="font-bold text-lg">{quote.profiles?.company_name || 'Skalia'}</p>
                        <p className="text-sm text-indigo-100">{quote.profiles?.address}</p>
                        <p className="text-sm text-indigo-100">{quote.profiles?.email}</p>
                        <p className="text-sm text-indigo-100">{quote.profiles?.vat_number}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs font-bold text-indigo-300 uppercase tracking-widest mb-1">Destinataire</p>
                        <p className="font-bold text-lg">{quote.recipient_company || quote.recipient_name}</p>
                        <p className="text-sm text-indigo-100">{quote.recipient_email}</p>
                    </div>
                </div>
            </div>

            {/* Body */}
            <div className="p-12">
                <div className="mb-10">
                    <h2 className="text-xl font-bold text-slate-800 mb-2">{quote.title}</h2>
                    <p className="text-slate-500 leading-relaxed">{quote.description}</p>
                </div>

                <table className="w-full text-left mb-8">
                    <thead>
                        <tr className="border-b border-slate-200">
                            <th className="py-4 text-xs font-bold text-slate-400 uppercase tracking-wide">Description</th>
                            <th className="py-4 text-xs font-bold text-slate-400 uppercase tracking-wide text-center">Qté</th>
                            <th className="py-4 text-xs font-bold text-slate-400 uppercase tracking-wide text-right">Prix Unitaire</th>
                            <th className="py-4 text-xs font-bold text-slate-400 uppercase tracking-wide text-right">Total HT</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {items.map((item: any, idx: number) => (
                            <tr key={idx}>
                                <td className="py-4 text-slate-700 font-medium">{item.description}</td>
                                <td className="py-4 text-center text-slate-500">{item.quantity}</td>
                                <td className="py-4 text-right text-slate-500">{formatCurrency(item.unit_price)}</td>
                                <td className="py-4 text-right text-slate-800 font-bold">{formatCurrency(item.quantity * item.unit_price)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <div className="flex justify-end">
                    <div className="w-64 space-y-3">
                        <div className="flex justify-between text-slate-500">
                            <span>Total HT</span>
                            <span>{formatCurrency(subTotalHT)}</span>
                        </div>
                        <div className="flex justify-between text-slate-500">
                            <span>TVA ({taxRate}%)</span>
                            <span>{formatCurrency(taxAmount)}</span>
                        </div>
                        <div className="flex justify-between text-slate-900 text-xl font-black pt-4 border-t border-slate-200">
                            <span>Total TTC</span>
                            <span>{formatCurrency(totalTTC)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer Actions */}
            <div className="bg-slate-50 p-8 border-t border-slate-200 flex justify-between items-center">
                <div className="text-xs text-slate-400">
                    <p>Valide jusqu'au : {new Date(quote.valid_until || Date.now()).toLocaleDateString()}</p>
                    <p>Conditions de paiement : {quote.payment_terms?.type === '100_percent' ? '100% à la commande' : 'Selon accord'}</p>
                </div>
                
                {quote.status === 'signed' || quote.status === 'paid' ? (
                    <div className="px-8 py-4 bg-emerald-100 text-emerald-700 font-bold rounded-xl border border-emerald-200 flex items-center gap-2">
                        <CheckCircle2 size={20} /> Devis Signé
                    </div>
                ) : (
                    <button 
                        onClick={handleOpenSignModal}
                        className="px-8 py-4 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 transition-all flex items-center gap-2"
                    >
                        Signer le devis <FileSignature size={20} />
                    </button>
                )}
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-100 font-sans overflow-y-auto">
            {/* Navigation minimaliste */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center sticky top-0 z-20">
               <div className="flex items-center gap-2">
                   <Logo classNameText="text-slate-900" />
               </div>
               {quote.status === 'signed' && (
                   <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                       Document validé
                   </span>
               )}
            </div>

            {/* Contenu principal */}
            <div className="px-4 pb-20">
                {isRetainer ? renderRetainerPricing() : renderStandardQuote()}
            </div>

            {/* MODAL SIGNATURE */}
            {isSignModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 animate-fade-in-up">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-slate-900">Valider l'offre</h3>
                            <button onClick={() => setIsSignModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
                        </div>
                        
                        <p className="text-slate-600 mb-6 text-sm">
                            En signant ce document, vous acceptez les conditions générales de vente et validez la commande d'un montant total de <strong className="text-slate-900">{formatCurrency(totalTTC)}</strong> {isRetainer ? '/mois' : ''}.
                        </p>

                        <form onSubmit={handleSignQuote} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nom complet</label>
                                <input 
                                    type="text" 
                                    required 
                                    value={signName}
                                    onChange={(e) => setSignName(e.target.value)}
                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" 
                                    placeholder="Jean Dupont"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email professionnel</label>
                                <input 
                                    type="email" 
                                    required 
                                    value={signEmail}
                                    onChange={(e) => setSignEmail(e.target.value)}
                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" 
                                    placeholder="jean@societe.com"
                                />
                            </div>
                            
                            <div className="pt-4">
                                <button 
                                    type="submit" 
                                    disabled={isSigning}
                                    className="w-full py-4 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                                >
                                    {isSigning ? <Loader2 className="animate-spin" /> : <>Confirmer et Signer <FileSignature size={20} /></>}
                                </button>
                            </div>
                            <p className="text-[10px] text-center text-slate-400">
                                Cette signature numérique a valeur légale.
                            </p>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PublicQuoteView;