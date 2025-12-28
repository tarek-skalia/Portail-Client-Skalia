import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Rocket, FileSignature, Download, CheckCircle2, XCircle, Clock, Check, X, Loader2, Briefcase, Infinity, RefreshCw, Calendar, Mail, User, Building, MapPin } from 'lucide-react';
import Logo from './Logo';
import { useToast } from './ToastProvider';

interface PublicQuoteViewProps {
  quoteId: string;
}

const PublicQuoteView: React.FC<PublicQuoteViewProps> = ({ quoteId }) => {
  const [quote, setQuote] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSignModalOpen, setIsSignModalOpen] = useState(false);
  
  // Signature Form
  const [signName, setSignName] = useState('');
  const [signEmail, setSignEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const toast = useToast();

  useEffect(() => {
    fetchQuote();
  }, [quoteId]);

  const fetchQuote = async () => {
    try {
      const { data, error } = await supabase
        .from('quotes')
        .select('*, quote_items(*)')
        .eq('id', quoteId)
        .single();

      if (error) throw error;
      setQuote(data);
      
      if (data) {
          setSignName(data.recipient_name || '');
          setSignEmail(data.recipient_email || '');
      }

    } catch (err) {
      console.error("Error fetching quote:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenSignModal = () => {
      setIsSignModalOpen(true);
  };

  const handleSign = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!signName || !signEmail) {
          setErrorMsg("Veuillez remplir tous les champs.");
          return;
      }
      setIsSubmitting(true);
      setErrorMsg('');

      try {
          const { error } = await supabase
            .from('quotes')
            .update({ 
                status: 'signed', 
                recipient_name: signName,
                recipient_email: signEmail,
                updated_at: new Date().toISOString()
            })
            .eq('id', quoteId);

          if (error) throw error;

          toast.success("Félicitations", "Le devis a été signé avec succès.");
          setIsSignModalOpen(false);
          fetchQuote();

      } catch (err: any) {
          setErrorMsg(err.message || "Une erreur est survenue.");
          toast.error("Erreur", "Signature échouée.");
      } finally {
          setIsSubmitting(false);
      }
  };

  const handleDownload = () => {
      window.print();
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-950"><Loader2 className="animate-spin text-indigo-500 w-12 h-12" /></div>;
  if (!quote) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500">Devis introuvable ou lien expiré.</div>;

  const items = quote.quote_items || [];
  const taxRate = quote.payment_terms?.tax_rate ? Number(quote.payment_terms.tax_rate) : 0;
  const isRetainer = quote.payment_terms?.quote_type === 'retainer';
  
  const subTotal = items.reduce((acc: number, item: any) => acc + (item.unit_price * item.quantity), 0);
  const taxAmount = subTotal * (taxRate / 100);
  const totalTTC = subTotal + taxAmount;

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800">
       
       {/* Background Decoration */}
       <div className="fixed inset-0 pointer-events-none overflow-hidden">
           <div className="absolute top-0 left-0 w-full h-[600px] bg-gradient-to-b from-slate-900 to-slate-100"></div>
           <div className="absolute top-[-100px] right-[-100px] w-[500px] h-[500px] bg-indigo-600/30 rounded-full blur-[120px]"></div>
           <div className="absolute top-[100px] left-[-200px] w-[600px] h-[600px] bg-purple-600/20 rounded-full blur-[100px]"></div>
       </div>

       <div className="relative max-w-4xl mx-auto pt-12 pb-20 px-4">
           
           {/* HEADER */}
           <div className="flex justify-between items-start mb-8 text-white">
               <div>
                   <div className="flex items-center gap-3 mb-2">
                       <Logo className="w-8 h-8" showText={false} />
                       <span className="text-2xl font-bold tracking-tight">SKALIA</span>
                   </div>
                   <p className="text-indigo-200 text-sm">Proposition Commerciale</p>
               </div>
               <div className="text-right">
                   <p className="text-sm font-medium opacity-80">Valable jusqu'au</p>
                   <p className="font-bold">{quote.valid_until ? new Date(quote.valid_until).toLocaleDateString() : '-'}</p>
               </div>
           </div>

           {/* MAIN CARD */}
           <div className="bg-white rounded-3xl shadow-2xl overflow-hidden animate-fade-in-up">
               
               {/* STATUS BAR */}
               {quote.status === 'signed' && (
                   <div className="bg-emerald-500 text-white py-3 px-6 text-center font-bold flex items-center justify-center gap-2">
                       <CheckCircle2 size={20} /> Devis signé le {new Date(quote.updated_at).toLocaleDateString()}
                   </div>
               )}
               {quote.status === 'rejected' && (
                   <div className="bg-red-500 text-white py-3 px-6 text-center font-bold flex items-center justify-center gap-2">
                       <XCircle size={20} /> Devis refusé
                   </div>
               )}

               <div className="p-8 md:p-12">
                   
                   {/* TITLE & INTRO */}
                   <div className="text-center mb-12">
                       <div className="inline-flex p-3 rounded-2xl bg-indigo-50 text-indigo-600 mb-6">
                           {isRetainer ? <Infinity size={32} /> : <FileText size={32} />}
                       </div>
                       <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-4 leading-tight">
                           {quote.title}
                       </h1>
                       {quote.description && (
                           <p className="text-slate-500 text-lg max-w-2xl mx-auto leading-relaxed">
                               {quote.description}
                           </p>
                       )}
                   </div>

                   {/* CLIENT & SENDER */}
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                       <div>
                           <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Préparé pour</p>
                           <p className="font-bold text-slate-900 text-lg">{quote.recipient_company || quote.recipient_name}</p>
                           <div className="space-y-1 mt-2 text-sm text-slate-600">
                               <div className="flex items-center gap-2"><User size={14} /> {quote.recipient_name}</div>
                               {quote.recipient_email && <div className="flex items-center gap-2"><Mail size={14} /> {quote.recipient_email}</div>}
                           </div>
                       </div>
                       <div className="md:text-right">
                           <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Émis par</p>
                           <p className="font-bold text-slate-900 text-lg">Skalia SRL</p>
                           <div className="space-y-1 mt-2 text-sm text-slate-600 md:flex md:flex-col md:items-end">
                               <div className="flex items-center gap-2"><Building size={14} /> {quote.sender_name || 'Tarek Zreik'}</div>
                               <div className="flex items-center gap-2"><MapPin size={14} /> Bruxelles, Belgique</div>
                           </div>
                       </div>
                   </div>

                   {/* PRICING TABLE */}
                   <div className="mb-12">
                       <h3 className="font-bold text-slate-900 text-xl mb-6">Détail des prestations</h3>
                       <div className="border border-slate-200 rounded-xl overflow-hidden">
                           <table className="w-full text-left border-collapse">
                               <thead className="bg-slate-50 border-b border-slate-200">
                                   <tr>
                                       <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Description</th>
                                       <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-center w-24">Qté</th>
                                       <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right w-32">Prix Unitaire</th>
                                       <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right w-32">Total</th>
                                   </tr>
                               </thead>
                               <tbody className="divide-y divide-slate-100">
                                   {items.map((item: any, idx: number) => (
                                       <tr key={idx}>
                                           <td className="px-6 py-4">
                                               <p className="font-bold text-slate-800">{item.description}</p>
                                               {item.billing_frequency !== 'once' && (
                                                   <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                                                       <RefreshCw size={10} /> {item.billing_frequency === 'monthly' ? 'Mensuel' : 'Annuel'}
                                                   </span>
                                               )}
                                           </td>
                                           <td className="px-6 py-4 text-center text-slate-600 font-medium">{item.quantity}</td>
                                           <td className="px-6 py-4 text-right text-slate-600 font-mono">{item.unit_price.toLocaleString('fr-FR')} €</td>
                                           <td className="px-6 py-4 text-right font-bold text-slate-800 font-mono">{(item.unit_price * item.quantity).toLocaleString('fr-FR')} €</td>
                                       </tr>
                                   ))}
                               </tbody>
                           </table>
                       </div>
                   </div>

                   {/* TOTALS */}
                   <div className="flex justify-end mb-12">
                       <div className="w-full md:w-1/2 lg:w-1/3 bg-slate-50 rounded-xl p-6 border border-slate-100">
                           <div className="flex justify-between items-center mb-3 text-slate-500 text-sm">
                               <span>Total HT</span>
                               <span className="font-mono font-medium">{subTotal.toLocaleString('fr-FR', {minimumFractionDigits: 2})} €</span>
                           </div>
                           {taxRate > 0 && (
                               <div className="flex justify-between items-center mb-3 text-slate-500 text-sm">
                                   <span>TVA ({taxRate}%)</span>
                                   <span className="font-mono font-medium">{taxAmount.toLocaleString('fr-FR', {minimumFractionDigits: 2})} €</span>
                               </div>
                           )}
                           <div className="pt-4 border-t border-slate-200 flex justify-between items-end mt-2">
                               <span className="font-bold text-slate-800 uppercase text-xs tracking-wide mb-1">
                                   Total TTC {isRetainer ? '/ mois' : ''}
                               </span>
                               <span className="text-3xl font-black text-indigo-900 leading-none">
                                   {totalTTC.toLocaleString('fr-FR', {style: 'currency', currency: 'EUR'})}
                               </span>
                           </div>
                           {/* Deposit Info for Projects */}
                           {!isRetainer && (
                               <div className="mt-4 pt-4 border-t border-slate-200 text-right">
                                   <p className="text-xs text-slate-500 mb-1">Acompte à la commande ({quote.payment_terms?.type === '50_50' ? '50%' : quote.payment_terms?.type === '30_70' ? '30%' : '100%'})</p>
                                   <p className="font-bold text-slate-800">
                                       {((totalTTC * (quote.payment_terms?.type === '50_50' ? 0.5 : quote.payment_terms?.type === '30_70' ? 0.3 : 1))).toLocaleString('fr-FR', {style: 'currency', currency: 'EUR'})}
                                   </p>
                               </div>
                           )}
                       </div>
                   </div>

                   {/* ACTIONS (Only if draft or sent) */}
                   {['draft', 'sent'].includes(quote.status) && (
                        <div className="relative z-10 mt-10 text-center">
                            <p className="text-xs text-indigo-400 uppercase tracking-widest font-bold mb-4">
                                {quote.delivery_delay ? `Durée du contrat : ${quote.delivery_delay}` : 'Sans engagement de durée'}
                            </p>
                            <button onClick={handleOpenSignModal} className="w-full py-5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black text-xl rounded-2xl hover:shadow-2xl hover:shadow-indigo-500/30 transition-all transform hover:scale-[1.02] flex items-center justify-center gap-3">
                                Devenir Partenaire <Rocket size={24} className="text-white" />
                            </button>
                            <button onClick={handleDownload} className="mt-6 text-slate-400 hover:text-indigo-600 font-bold text-sm flex items-center justify-center gap-2 mx-auto transition-colors">
                                <Download size={16} /> Télécharger le PDF
                            </button>
                        </div>
                   )}

                   {/* FOOTER MESSAGE */}
                   {quote.status === 'signed' && (
                       <div className="text-center py-8">
                           <p className="text-emerald-600 font-medium text-lg mb-2">Merci pour votre confiance !</p>
                           <p className="text-slate-500 text-sm">Une copie du devis signé vous a été envoyée par email.</p>
                       </div>
                   )}

               </div>
           </div>
       </div>

       {/* SIGNATURE MODAL */}
       {isSignModalOpen && (
           <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
               <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={() => setIsSignModalOpen(false)}></div>
               <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up">
                   <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                       <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2"><FileSignature size={20} className="text-indigo-600" /> Signature</h3>
                       <button onClick={() => setIsSignModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
                   </div>
                   <form onSubmit={handleSign} className="p-6 space-y-4">
                       <p className="text-sm text-slate-600 mb-4">En signant ce document, vous acceptez les conditions de la proposition commerciale.</p>
                       
                       <div>
                           <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nom Complet</label>
                           <input 
                               type="text" 
                               required 
                               value={signName} 
                               onChange={e => setSignName(e.target.value)} 
                               className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-800"
                               placeholder="Jean Dupont"
                           />
                       </div>
                       
                       <div>
                           <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email</label>
                           <input 
                               type="email" 
                               required 
                               value={signEmail} 
                               onChange={e => setSignEmail(e.target.value)} 
                               className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-800"
                               placeholder="jean@societe.com"
                           />
                       </div>

                       <div className="flex items-start gap-3 p-3 bg-indigo-50 rounded-xl border border-indigo-100 text-indigo-800 text-xs font-medium mt-2">
                           <Clock size={16} className="shrink-0 mt-0.5" />
                           <p>Horodatage certifié : {new Date().toLocaleString()}</p>
                       </div>

                       {errorMsg && <p className="text-xs text-red-500 font-bold text-center">{errorMsg}</p>}

                       <button 
                           type="submit" 
                           disabled={isSubmitting}
                           className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 mt-4 disabled:opacity-70 disabled:cursor-not-allowed"
                       >
                           {isSubmitting ? <Loader2 className="animate-spin" /> : <><Check size={20} /> Valider la signature</>}
                       </button>
                   </form>
               </div>
           </div>
       )}

    </div>
  );
};

export default PublicQuoteView;