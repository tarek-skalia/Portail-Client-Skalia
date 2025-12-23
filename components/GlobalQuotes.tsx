
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { FileText, Plus, Search, Filter, Edit3, Trash2, ExternalLink, CheckCircle2, XCircle, Clock, Copy, Send, Eye } from 'lucide-react';
import { useAdmin } from './AdminContext';
import Modal from './ui/Modal';
import QuoteForm from './forms/QuoteForm';
import { useToast } from './ToastProvider';
import Skeleton from './Skeleton';

const GlobalQuotes: React.FC = () => {
  const { clients } = useAdmin();
  const toast = useToast();
  const [quotes, setQuotes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  
  // MODAL
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingQuote, setEditingQuote] = useState<any | null>(null);

  useEffect(() => {
      fetchQuotes();
      const channel = supabase.channel('global_quotes_rt').on('postgres_changes', { event: '*', schema: 'public', table: 'quotes' }, fetchQuotes).subscribe();
      return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchQuotes = async () => {
      const { data, error } = await supabase
        .from('quotes')
        .select('*, profiles(company_name, full_name), quote_items(*)')
        .order('created_at', { ascending: false });
      
      if (!error && data) {
          setQuotes(data);
      }
      setIsLoading(false);
  };

  const handleDelete = async (id: string) => {
      if (!window.confirm("Supprimer ce devis ?")) return;
      await supabase.from('quote_items').delete().eq('quote_id', id);
      await supabase.from('quotes').delete().eq('id', id);
      toast.success("Supprimé", "Devis effacé.");
      fetchQuotes();
  };

  const handleCopyLink = (id: string) => {
      const link = `${window.location.origin}/p/quote/${id}`;
      navigator.clipboard.writeText(link);
      toast.success("Lien copié", "Lien public du devis dans le presse-papier.");
  };

  const getStatusBadge = (status: string) => {
      switch (status) {
          case 'draft': return <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded text-xs font-bold border border-slate-200 flex items-center gap-1"><Clock size={10} /> Brouillon</span>;
          case 'sent': return <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded text-xs font-bold border border-blue-100 flex items-center gap-1"><Send size={10} /> Envoyé</span>;
          case 'signed': return <span className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded text-xs font-bold border border-emerald-100 flex items-center gap-1"><CheckCircle2 size={10} /> Signé</span>;
          case 'rejected': return <span className="px-2 py-1 bg-red-50 text-red-600 rounded text-xs font-bold border border-red-100 flex items-center gap-1"><XCircle size={10} /> Refusé</span>;
          default: return null;
      }
  };

  const getTimeAgo = (dateStr?: string) => {
      if (!dateStr) return '';
      const diff = Math.floor((new Date().getTime() - new Date(dateStr).getTime()) / 60000);
      if (diff < 1) return 'À l\'instant';
      if (diff < 60) return `${diff} min`;
      if (diff < 1440) return `${Math.floor(diff/60)} h`;
      return `${Math.floor(diff/1440)} j`;
  };

  const filteredQuotes = quotes.filter(q => {
      const clientName = q.profiles?.company_name || q.profiles?.full_name || '';
      const matchesSearch = q.title.toLowerCase().includes(searchTerm.toLowerCase()) || clientName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = filterStatus === 'all' || q.status === filterStatus;
      return matchesSearch && matchesStatus;
  });

  if (isLoading) return <div className="p-8"><Skeleton className="h-96 w-full rounded-2xl" /></div>;

  return (
    <div className="space-y-6 animate-fade-in-up pb-10">
        <div className="flex justify-between items-end">
            <div>
                <h1 className="text-3xl font-extrabold text-slate-900">Devis & Propositions</h1>
                <p className="text-slate-500 mt-1">Gérez vos offres commerciales.</p>
            </div>
            <button onClick={() => { setEditingQuote(null); setIsModalOpen(true); }} className="bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg hover:bg-indigo-700 transition-all">
                <Plus size={18} /> Nouveau Devis
            </button>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row gap-4 justify-between items-center">
                <div className="flex gap-2">
                    {['all', 'draft', 'sent', 'signed', 'rejected'].map(s => (
                        <button key={s} onClick={() => setFilterStatus(s)} className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-colors ${filterStatus === s ? 'bg-slate-800 text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}>
                            {s === 'all' ? 'Tous' : s}
                        </button>
                    ))}
                </div>
                <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input type="text" placeholder="Rechercher..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none" />
                </div>
            </div>

            <div className="divide-y divide-slate-100">
                {filteredQuotes.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 italic">Aucun devis trouvé.</div>
                ) : (
                    filteredQuotes.map(quote => (
                        <div key={quote.id} className="p-4 flex flex-col md:flex-row items-center gap-4 hover:bg-slate-50 transition-colors group">
                            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                                <FileText size={24} />
                            </div>
                            <div className="flex-1 min-w-0 text-center md:text-left">
                                <div className="flex items-center gap-2 justify-center md:justify-start mb-1">
                                    <h3 className="font-bold text-slate-800 text-sm">{quote.title}</h3>
                                    {getStatusBadge(quote.status)}
                                    
                                    {/* INDICATEUR DE VUE */}
                                    {quote.view_count > 0 && (
                                        <div className="ml-2 flex items-center gap-1 text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full border border-slate-200" title={`Vu ${quote.view_count} fois. Dernier : ${new Date(quote.last_viewed_at).toLocaleString()}`}>
                                            <Eye size={10} /> 
                                            <span className="font-bold">{quote.view_count}</span>
                                            <span className="hidden sm:inline font-normal">• {getTimeAgo(quote.last_viewed_at)}</span>
                                        </div>
                                    )}
                                </div>
                                <p className="text-xs text-slate-500">{quote.profiles?.company_name || quote.profiles?.full_name || quote.recipient_company || quote.recipient_name} • Créé le {new Date(quote.created_at).toLocaleDateString()}</p>
                            </div>
                            <div className="text-right">
                                <p className="font-bold text-slate-900">{quote.total_amount.toLocaleString('fr-FR', {style: 'currency', currency: 'EUR'})}</p>
                                <p className="text-[10px] text-slate-400 uppercase">Total HT</p>
                            </div>
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleCopyLink(quote.id)} className="p-2 text-slate-400 hover:text-indigo-600 bg-white border border-slate-200 rounded-lg hover:shadow-sm transition-all" title="Copier lien public"><Copy size={16} /></button>
                                <a href={`/p/quote/${quote.id}`} target="_blank" className="p-2 text-slate-400 hover:text-indigo-600 bg-white border border-slate-200 rounded-lg hover:shadow-sm transition-all" title="Voir"><ExternalLink size={16} /></a>
                                <button onClick={() => { setEditingQuote(quote); setIsModalOpen(true); }} className="p-2 text-slate-400 hover:text-indigo-600 bg-white border border-slate-200 rounded-lg hover:shadow-sm transition-all" title="Modifier"><Edit3 size={16} /></button>
                                <button onClick={() => handleDelete(quote.id)} className="p-2 text-slate-400 hover:text-red-600 bg-white border border-slate-200 rounded-lg hover:shadow-sm transition-all" title="Supprimer"><Trash2 size={16} /></button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>

        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingQuote ? "Modifier Devis" : "Nouveau Devis"}>
            <QuoteForm initialData={editingQuote} onSuccess={() => { setIsModalOpen(false); fetchQuotes(); }} onCancel={() => setIsModalOpen(false)} />
        </Modal>
    </div>
  );
};

export default GlobalQuotes;
