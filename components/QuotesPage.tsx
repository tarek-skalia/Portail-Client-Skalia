
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { FileText, ExternalLink, CheckCircle2, Clock, XCircle, Send } from 'lucide-react';
import Skeleton from './Skeleton';

interface QuotesPageProps {
  userId?: string;
}

const QuotesPage: React.FC<QuotesPageProps> = ({ userId }) => {
  const [quotes, setQuotes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
      if (userId) {
          fetchQuotes();
      }
  }, [userId]);

  const fetchQuotes = async () => {
      const { data, error } = await supabase
        .from('quotes')
        .select('*')
        .eq('profile_id', userId)
        .order('created_at', { ascending: false });
      
      if (!error && data) {
          setQuotes(data);
      }
      setIsLoading(false);
  };

  const getStatusBadge = (status: string) => {
      switch (status) {
          case 'draft': return <span className="px-3 py-1 bg-slate-100 text-slate-500 rounded-full text-xs font-bold border border-slate-200 flex items-center gap-1.5"><Clock size={12} /> En préparation</span>;
          case 'sent': return <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-bold border border-blue-100 flex items-center gap-1.5"><Send size={12} /> Reçu</span>;
          case 'signed': return <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-xs font-bold border border-emerald-100 flex items-center gap-1.5"><CheckCircle2 size={12} /> Signé & Validé</span>;
          case 'rejected': return <span className="px-3 py-1 bg-red-50 text-red-600 rounded-full text-xs font-bold border border-red-100 flex items-center gap-1.5"><XCircle size={12} /> Refusé</span>;
          default: return null;
      }
  };

  if (isLoading) return <div className="p-8"><Skeleton className="h-64 w-full rounded-2xl" /></div>;

  return (
    <div className="space-y-6 animate-fade-in-up pb-10">
        <div>
            <h1 className="text-3xl font-extrabold text-slate-900">Mes Devis</h1>
            <p className="text-slate-500 mt-1">Historique de vos propositions commerciales.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {quotes.length === 0 ? (
                <div className="col-span-full p-12 text-center text-slate-400 italic bg-white rounded-2xl border border-dashed border-slate-200">
                    Aucun devis disponible pour le moment.
                </div>
            ) : (
                quotes.map(quote => (
                    <div key={quote.id} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
                        <div>
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                                    <FileText size={24} />
                                </div>
                                {getStatusBadge(quote.status)}
                            </div>
                            <h3 className="font-bold text-slate-900 text-lg mb-1">{quote.title}</h3>
                            <p className="text-sm text-slate-500 line-clamp-2">{quote.description || "Voir le détail de la proposition."}</p>
                        </div>
                        
                        <div className="mt-6 pt-4 border-t border-slate-50 flex items-center justify-between">
                            <div>
                                <p className="text-[10px] text-slate-400 uppercase font-bold">Total TTC</p>
                                <p className="text-xl font-black text-slate-900">{quote.total_amount.toLocaleString('fr-FR', {style: 'currency', currency: 'EUR'})}</p>
                            </div>
                            <a 
                                href={`/?quote_id=${quote.id}`} 
                                target="_blank"
                                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-indigo-600 transition-colors shadow-lg"
                            >
                                Voir <ExternalLink size={14} />
                            </a>
                        </div>
                    </div>
                ))
            )}
        </div>
    </div>
  );
};

export default QuotesPage;
