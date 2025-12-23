
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Check, Download, AlertCircle, FileText, Calendar, DollarSign, PenTool, CheckCircle2 } from 'lucide-react';
import Logo from './Logo';
import Skeleton from './Skeleton';

interface QuoteItem {
    id: string;
    description: string;
    quantity: number;
    unit_price: number;
    total: number;
}

interface QuoteData {
    id: string;
    profile_id: string;
    title: string;
    description: string;
    total_amount: number;
    status: 'draft' | 'sent' | 'signed' | 'rejected' | 'paid';
    valid_until: string;
    profile: {
        company_name: string;
        full_name: string;
        email: string;
    } | null;
    items: QuoteItem[];
}

interface PublicQuoteViewProps {
    quoteId: string;
}

const PublicQuoteView: React.FC<PublicQuoteViewProps> = ({ quoteId }) => {
    const [quote, setQuote] = useState<QuoteData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [signing, setSigning] = useState(false);

    useEffect(() => {
        fetchQuote();
    }, [quoteId]);

    const fetchQuote = async () => {
        try {
            // Fetch quote + profile
            const { data: quoteData, error: quoteError } = await supabase
                .from('quotes')
                .select(`
                    *,
                    profile:profiles(company_name, full_name, email)
                `)
                .eq('id', quoteId)
                .single();

            if (quoteError) throw quoteError;

            // Fetch items
            const { data: itemsData, error: itemsError } = await supabase
                .from('quote_items')
                .select('*')
                .eq('quote_id', quoteId);

            if (itemsError) throw itemsError;

            setQuote({
                ...quoteData,
                items: itemsData || []
            });

        } catch (err: any) {
            console.error(err);
            setError("Impossible de charger le devis. Il a peut-être expiré ou été supprimé.");
        } finally {
            setLoading(false);
        }
    };

    const handleSign = async () => {
        if (!quote) return;
        setSigning(true);
        
        try {
            // 1. Update Quote Status
            const { error: signError } = await supabase
                .from('quotes')
                .update({ status: 'signed', updated_at: new Date().toISOString() })
                .eq('id', quoteId);

            if (signError) throw signError;

            // 2. Update Profile Onboarding Step (Start the flow)
            // Only if step is currently 0 (Initial)
            if (quote.profile_id) {
                const { data: profile } = await supabase.from('profiles').select('onboarding_step').eq('id', quote.profile_id).single();
                if (profile && (!profile.onboarding_step || profile.onboarding_step < 1)) {
                    await supabase.from('profiles').update({ onboarding_step: 1 }).eq('id', quote.profile_id);
                }
            }

            // 3. UI Update
            setQuote({ ...quote, status: 'signed' });
            alert("Devis signé avec succès ! Vous pouvez fermer cette fenêtre ou vous connecter à votre espace.");

        } catch (err) {
            console.error(err);
            alert("Erreur lors de la signature.");
        } finally {
            setSigning(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="w-full max-w-4xl bg-white rounded-2xl shadow-xl p-8 space-y-8">
                    <div className="flex justify-between">
                        <Skeleton className="h-12 w-48" />
                        <Skeleton className="h-12 w-32 rounded-xl" />
                    </div>
                    <div className="grid grid-cols-2 gap-8">
                        <Skeleton className="h-32 w-full rounded-xl" />
                        <Skeleton className="h-32 w-full rounded-xl" />
                    </div>
                    <Skeleton className="h-64 w-full rounded-xl" />
                </div>
            </div>
        );
    }

    if (error || !quote) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="text-center max-w-md">
                    <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertCircle size={32} />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 mb-2">Devis introuvable</h1>
                    <p className="text-slate-500">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 font-sans selection:bg-indigo-100 selection:text-indigo-700 pb-20">
            
            {/* TOP BAR BRANDING */}
            <div className="bg-slate-900 h-24 w-full absolute top-0 left-0 z-0"></div>
            
            <div className="max-w-5xl mx-auto px-4 sm:px-6 relative z-10 pt-8">
                
                {/* STATUS BAR */}
                {quote.status === 'signed' && (
                    <div className="bg-emerald-500 text-white px-6 py-3 rounded-t-2xl flex items-center justify-center gap-2 font-bold shadow-lg mx-4 sm:mx-0">
                        <CheckCircle2 size={20} />
                        Ce devis a été signé et validé.
                    </div>
                )}

                {/* MAIN PAPER */}
                <div className={`bg-white rounded-2xl shadow-2xl overflow-hidden min-h-[800px] flex flex-col ${quote.status === 'signed' ? 'rounded-t-none' : ''}`}>
                    
                    {/* HEADER */}
                    <div className="p-8 md:p-12 border-b border-slate-100 flex flex-col md:flex-row justify-between gap-8">
                        <div>
                            <div className="bg-slate-900 text-white p-3 rounded-xl inline-block mb-6 shadow-lg">
                                <Logo className="w-10 h-10" showText={true} />
                            </div>
                            <h1 className="text-3xl font-extrabold text-slate-900 mb-2">{quote.title}</h1>
                            <p className="text-slate-500 text-sm max-w-md leading-relaxed">{quote.description}</p>
                        </div>
                        
                        <div className="flex flex-col items-start md:items-end gap-4">
                            <div className="text-right">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Montant Total</p>
                                <p className="text-4xl font-black text-indigo-600 tracking-tight">
                                    {quote.total_amount.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                                </p>
                                <p className="text-xs text-slate-400 font-medium mt-1">Hors Taxes</p>
                            </div>
                            
                            <div className="flex gap-2 mt-2">
                                <div className="px-4 py-2 bg-slate-50 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 flex items-center gap-2">
                                    <FileText size={14} /> REF: {quote.id.slice(0, 8).toUpperCase()}
                                </div>
                                <div className="px-4 py-2 bg-slate-50 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 flex items-center gap-2">
                                    <Calendar size={14} /> Valide jusqu'au: {quote.valid_until ? new Date(quote.valid_until).toLocaleDateString() : 'Illimité'}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* CLIENT INFO */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-slate-100">
                        <div className="bg-white p-8 md:p-10">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Émetteur</h3>
                            <p className="font-bold text-slate-900 text-lg">Skalia Agency</p>
                            <p className="text-slate-500 text-sm mt-1">10 Rue de la Paix</p>
                            <p className="text-slate-500 text-sm">75002 Paris, France</p>
                            <p className="text-slate-500 text-sm mt-2">contact@skalia.io</p>
                        </div>
                        <div className="bg-white p-8 md:p-10">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Adressé à</h3>
                            {quote.profile ? (
                                <>
                                    <p className="font-bold text-slate-900 text-lg">{quote.profile.company_name || quote.profile.full_name}</p>
                                    <p className="text-slate-500 text-sm mt-1">{quote.profile.full_name}</p>
                                    <p className="text-slate-500 text-sm mt-2">{quote.profile.email}</p>
                                </>
                            ) : (
                                <p className="text-slate-400 italic">Informations client non disponibles</p>
                            )}
                        </div>
                    </div>

                    {/* ITEMS TABLE */}
                    <div className="p-8 md:p-12 flex-1">
                        <h3 className="text-lg font-bold text-slate-900 mb-6">Détails de la prestation</h3>
                        <div className="overflow-hidden rounded-xl border border-slate-200">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-bold tracking-wider">
                                    <tr>
                                        <th className="px-6 py-4">Description</th>
                                        <th className="px-6 py-4 text-center w-32">Qté</th>
                                        <th className="px-6 py-4 text-right w-40">Prix Unit.</th>
                                        <th className="px-6 py-4 text-right w-40">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-sm">
                                    {quote.items.map((item) => (
                                        <tr key={item.id}>
                                            <td className="px-6 py-4 font-medium text-slate-800">
                                                {item.description}
                                            </td>
                                            <td className="px-6 py-4 text-center text-slate-500">
                                                {item.quantity}
                                            </td>
                                            <td className="px-6 py-4 text-right text-slate-600 font-mono">
                                                {item.unit_price.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                                            </td>
                                            <td className="px-6 py-4 text-right font-bold text-slate-900 font-mono">
                                                {item.total.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-slate-50/50 font-bold text-slate-900">
                                    <tr>
                                        <td colSpan={3} className="px-6 py-4 text-right uppercase text-xs tracking-wider text-slate-500">Total HT</td>
                                        <td className="px-6 py-4 text-right text-lg">
                                            {quote.total_amount.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                        
                        <div className="mt-8 text-xs text-slate-400 text-center max-w-2xl mx-auto leading-relaxed">
                            Ce devis est valable 30 jours. En signant ce devis, vous acceptez les conditions générales de vente de Skalia Agency. Le paiement de l'acompte (si applicable) vaut pour démarrage du projet.
                        </div>
                    </div>

                    {/* FOOTER ACTIONS */}
                    <div className="p-6 bg-slate-50 border-t border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4 sticky bottom-0 z-20">
                        <button className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 rounded-xl text-slate-600 font-bold hover:bg-slate-100 hover:text-slate-900 transition-colors shadow-sm w-full md:w-auto justify-center">
                            <Download size={18} />
                            Télécharger PDF
                        </button>
                        
                        {quote.status !== 'signed' && (
                            <button 
                                onClick={handleSign}
                                disabled={signing}
                                className="flex items-center gap-2 px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 transition-all transform hover:scale-[1.02] active:scale-[0.98] w-full md:w-auto justify-center"
                            >
                                {signing ? 'Traitement...' : (
                                    <>
                                        <PenTool size={18} />
                                        Signer et Accepter
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PublicQuoteView;
