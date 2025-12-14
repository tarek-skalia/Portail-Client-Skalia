
import React, { useState, useRef, useEffect } from 'react';
import { Client } from '../types';
import { Send, Paperclip, FileText, UploadCloud, X, Bug, FileCode, Zap, AlertCircle, HelpCircle, Lightbulb, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from './ToastProvider';

interface SupportPageProps {
  currentUser: Client;
  initialData?: { subject: string, description: string } | null;
  onConsumeData?: () => void;
  onTicketCreated?: (ticketId: string) => void;
}

const SupportPage: React.FC<SupportPageProps> = ({ currentUser, initialData, onConsumeData, onTicketCreated }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const toast = useToast();

  // Form State
  const [subjectId, setSubjectId] = useState<string>('');
  const [customSubject, setCustomSubject] = useState('');
  const [priority, setPriority] = useState<string>('medium');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // FAQ State
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialData) {
        const matchedCategory = subjects.find(s => initialData.subject.toLowerCase().includes(s.id));
        if (matchedCategory) {
            setSubjectId(matchedCategory.id);
        } else {
            setSubjectId('other');
        }
        
        const fullDesc = `[Sujet Original: ${initialData.subject}]\n\n${initialData.description}`;
        setDescription(fullDesc);
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
        if (onConsumeData) onConsumeData();
    }
  }, [initialData, onConsumeData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
        let uploadedFileUrl: string | null = null;

        // 1. Upload du fichier s'il existe
        if (file) {
             const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
             const fileName = `tickets/${currentUser.id}/${Date.now()}_${cleanName}`;
             
             const { error: uploadError } = await supabase.storage
                .from('project_files')
                .upload(fileName, file);
             
             if (uploadError) throw uploadError;

             const { data: { publicUrl } } = supabase.storage
                .from('project_files')
                .getPublicUrl(fileName);
             
             uploadedFileUrl = publicUrl;
        }

        // 2. Création du Ticket
        const selectedSubjectLabel = subjects.find(s => s.id === subjectId)?.label || 'Autre demande';
        const finalSubject = subjectId === 'other' && customSubject ? customSubject : selectedSubjectLabel;

        const { data: ticketData, error } = await supabase.from('tickets').insert({
            user_id: currentUser.id,
            subject: finalSubject,
            category: subjectId,
            priority: priority,
            status: 'open',
            description: description,
            last_update: 'À l\'instant',
            date: new Date().toISOString()
        }).select().single();

        if (error) throw error;

        // 3. Création du premier message
        if (ticketData) {
             await supabase.from('ticket_messages').insert({
                 ticket_id: ticketData.id,
                 sender_id: currentUser.id,
                 sender_type: 'client',
                 message: description,
                 attachments: uploadedFileUrl ? [uploadedFileUrl] : [],
                 created_at: new Date().toISOString()
             });

             // --- FEEDBACK IMMÉDIAT ---
             // Au lieu d'un Toast, on redirige vers l'historique et on ouvre le ticket
             if (onTicketCreated) {
                 onTicketCreated(ticketData.id);
             } else {
                 toast.success("Ticket envoyé", "Votre demande a été enregistrée.");
                 // Reset si pas de redirection
                 setSubjectId('');
                 setDescription('');
                 setFile(null);
             }
        }

    } catch (error) {
        console.error("Erreur envoi:", error);
        toast.error("Erreur", "Impossible d'envoyer la demande. Vérifiez votre connexion.");
        setIsSubmitting(false); // Reset loading only on error
    }
  };

  const handleCopyEmail = () => {
      navigator.clipboard.writeText('contact@skalia.io');
      toast.success("Email copié", "contact@skalia.io a été copié dans votre presse-papier.");
  };

  // Gestion du Drag & Drop
  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          setFile(e.dataTransfer.files[0]);
      }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) setFile(e.target.files[0]);
  };

  const subjects = [
    { id: 'bug', label: 'Signaler un Bug', desc: 'Une automatisation ne fonctionne pas comme prévu.', icon: <Bug size={24} />, color: 'bg-red-50 text-red-600 border-red-100 hover:border-red-300' },
    { id: 'modify', label: 'Modification', desc: 'Ajuster un processus existant.', icon: <FileCode size={24} />, color: 'bg-blue-50 text-blue-600 border-blue-100 hover:border-blue-300' },
    { id: 'new', label: 'Nouveau Projet', desc: 'Demander une nouvelle automatisation.', icon: <Zap size={24} />, color: 'bg-purple-50 text-purple-600 border-purple-100 hover:border-purple-300' },
    { id: 'connection', label: 'Problème API', desc: 'Erreur de connexion (Stripe, HubSpot...).', icon: <AlertCircle size={24} />, color: 'bg-amber-50 text-amber-600 border-amber-100 hover:border-amber-300' },
    { id: 'other', label: 'Autre question', desc: 'Facturation, conseil ou autre.', icon: <HelpCircle size={24} />, color: 'bg-slate-50 text-slate-600 border-slate-100 hover:border-slate-300' },
  ];

  // FAQ Mise à jour : Ton "Done for you"
  const faqItems = [
    {
        q: "Quel est le délai de réponse moyen ?",
        a: "Pour les urgences bloquantes (Priorité Haute), nous intervenons sous 2 à 4 heures ouvrées. Pour les demandes standards, tout est traité en moins de 24h."
    },
    {
        q: "Une automatisation semble arrêtée, dois-je intervenir ?",
        a: "Non, absolument pas. Nos systèmes de monitoring nous alertent souvent avant vous. Si vous constatez une anomalie, ouvrez simplement un ticket 'Bug' et nous nous occupons de tout. Vous n'avez aucune maintenance technique à faire."
    },
    {
        q: "Comment donner accès à un nouvel outil ?",
        a: "Ne partagez jamais de mot de passe en clair. Si nous avons besoin d'un accès, nous vous enverrons un lien sécurisé ou une procédure simple. Concentrez-vous sur votre métier, nous gérons la technique."
    },
    {
        q: "Puis-je modifier ma demande après envoi ?",
        a: "Oui, vous pouvez ajouter des précisions via le système de chat dans l'historique du ticket à tout moment."
    }
  ];

  return (
    <div className="pb-10 animate-fade-in-up">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Nouvelle demande</h2>
        <p className="text-gray-500 mt-1">Dites-nous comment nous pouvons vous aider aujourd'hui.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* COLONNE GAUCHE : Formulaire */}
          <div className="lg:col-span-2 space-y-8">
               
               {/* 1. SUJET */}
               <section>
                   <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4">1. Quel est le sujet ?</h3>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       {subjects.map((sub) => (
                           <button
                                key={sub.id}
                                type="button"
                                onClick={() => setSubjectId(sub.id)}
                                className={`relative p-5 rounded-2xl border-2 text-left transition-all duration-200 group flex items-start gap-4 ${
                                    subjectId === sub.id 
                                    ? `ring-2 ring-indigo-500 ring-offset-2 ${sub.color}` 
                                    : 'border-slate-100 bg-white hover:border-indigo-200 hover:shadow-md'
                                }`}
                           >
                               <div className={`p-3 rounded-xl ${subjectId === sub.id ? 'bg-white/50' : 'bg-slate-50 group-hover:bg-indigo-50'}`}>
                                   {sub.icon}
                               </div>
                               <div>
                                   <div className="font-bold text-slate-800 mb-1">{sub.label}</div>
                                   <div className="text-xs text-slate-500 font-medium leading-snug">{sub.desc}</div>
                               </div>
                               {subjectId === sub.id && (
                                   <div className="absolute top-4 right-4 text-indigo-600">
                                       <div className="w-3 h-3 bg-indigo-600 rounded-full animate-pulse"></div>
                                   </div>
                               )}
                           </button>
                       ))}
                   </div>
               </section>

               {/* 2. PRIORITÉ */}
               <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                   <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4">2. Niveau d'urgence</h3>
                   <div className="flex flex-col md:flex-row gap-4">
                       {[
                           { id: 'low', label: 'Faible', desc: 'Pas bloquant', color: 'bg-green-500' },
                           { id: 'medium', label: 'Moyenne', desc: 'Gênant mais fonctionnel', color: 'bg-amber-500' },
                           { id: 'high', label: 'Élevée', desc: 'Production arrêtée', color: 'bg-red-500' }
                       ].map((p) => (
                           <button
                                key={p.id}
                                type="button"
                                onClick={() => setPriority(p.id)}
                                className={`flex-1 p-3 rounded-xl border flex items-center justify-center gap-3 transition-all ${
                                    priority === p.id 
                                    ? 'bg-slate-800 text-white border-slate-800 shadow-lg' 
                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                }`}
                           >
                               <div className={`w-2.5 h-2.5 rounded-full ${p.color}`}></div>
                               <div className="text-left">
                                   <div className="font-bold text-sm">{p.label}</div>
                               </div>
                           </button>
                       ))}
                   </div>
               </section>

               {/* 3. DETAILS (Amélioré Drag & Drop) */}
               <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                   <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4">3. Description détaillée</h3>
                   
                   <textarea 
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Décrivez le contexte, les étapes pour reproduire le problème ou vos attentes..."
                        className="w-full h-40 p-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none transition-all"
                   />

                   {/* Zone de Drag & Drop */}
                   <div className="mt-4">
                       <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                       
                       {!file ? (
                           <div 
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                                className={`w-full border-2 border-dashed rounded-xl p-6 transition-all cursor-pointer flex flex-col items-center justify-center gap-2 group ${
                                    isDragging 
                                    ? 'border-indigo-500 bg-indigo-50/50 scale-[1.01]' 
                                    : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
                                }`}
                           >
                               <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${isDragging ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400 group-hover:text-indigo-500 group-hover:bg-indigo-50'}`}>
                                   <UploadCloud size={20} />
                               </div>
                               <p className="text-sm font-medium text-slate-600">
                                   <span className="text-indigo-600">Cliquez pour ajouter</span> ou glissez un fichier ici
                               </p>
                               <p className="text-xs text-slate-400">Images, PDF, Logs (Max 10MB)</p>
                           </div>
                       ) : (
                           <div className="w-full bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex items-center justify-between animate-fade-in">
                               <div className="flex items-center gap-3">
                                   <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
                                       <FileText size={20} />
                                   </div>
                                   <div>
                                       <p className="text-sm font-bold text-slate-800">{file.name}</p>
                                       <p className="text-xs text-emerald-600">Prêt à l'envoi</p>
                                   </div>
                               </div>
                               <button 
                                   type="button"
                                   onClick={(e) => { e.stopPropagation(); setFile(null); if(fileInputRef.current) fileInputRef.current.value = ''; }}
                                   className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors"
                               >
                                   <X size={18} />
                               </button>
                           </div>
                       )}
                   </div>
               </section>

               <button
                    onClick={handleSubmit}
                    disabled={isSubmitting || !subjectId || !description}
                    className={`w-full py-4 rounded-xl font-bold text-white text-lg shadow-xl shadow-indigo-200 flex items-center justify-center gap-3 transition-all duration-300 hover:-translate-y-1 ${
                        isSubmitting || !subjectId || !description
                        ? 'bg-slate-300 cursor-not-allowed shadow-none' 
                        : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:shadow-indigo-500/30'
                    }`}
                >
                    {isSubmitting ? (
                        <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                        <>
                            Envoyer le ticket <Send size={20} />
                        </>
                    )}
                </button>
          </div>

          {/* COLONNE DROITE : Sidebar Contextuelle + FAQ */}
          <div className="space-y-6 lg:sticky lg:top-24">
              
              {/* Box Conseil */}
              <div className="bg-gradient-to-br from-indigo-900 to-slate-900 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
                  
                  <div className="flex items-start gap-4 relative z-10">
                      <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0 border border-white/20">
                          <Lightbulb className="text-yellow-300" size={20} />
                      </div>
                      <div>
                          <h4 className="font-bold text-lg mb-1">Astuce Pro</h4>
                          <p className="text-indigo-200 text-sm leading-relaxed">
                             Une capture d'écran vaut mille mots ! N'hésitez pas à glisser vos images directement dans le formulaire.
                          </p>
                      </div>
                  </div>
              </div>

              {/* FAQ Interactive */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-5 border-b border-slate-100 flex items-center gap-2">
                       <HelpCircle className="text-indigo-600" size={20} />
                       <h4 className="font-bold text-slate-800">Questions Fréquentes</h4>
                  </div>
                  
                  <div className="divide-y divide-slate-100">
                      {faqItems.map((item, idx) => {
                          const isOpen = openFaqIndex === idx;
                          return (
                              <div key={idx} className="bg-white transition-colors hover:bg-slate-50">
                                  <button 
                                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                                    className="w-full flex items-center justify-between p-4 text-left focus:outline-none"
                                  >
                                      <span className={`text-sm font-semibold transition-colors ${isOpen ? 'text-indigo-600' : 'text-slate-700'}`}>
                                          {item.q}
                                      </span>
                                      {isOpen ? <ChevronUp size={16} className="text-indigo-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                                  </button>
                                  
                                  {isOpen && (
                                      <div className="px-4 pb-4 animate-fade-in">
                                          <p className="text-sm text-slate-500 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">
                                              {item.a}
                                          </p>
                                      </div>
                                  )}
                              </div>
                          );
                      })}
                  </div>
                  
                  <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
                      <p className="text-xs text-slate-400 mb-3">Besoin d'autre chose ?</p>
                      
                      {/* Bouton Copy Email - Centré et Propre */}
                      <button 
                        onClick={handleCopyEmail}
                        title="contact@skalia.io"
                        className="w-full py-2.5 bg-white border border-slate-200 hover:border-indigo-300 hover:text-indigo-600 rounded-xl text-xs font-bold text-slate-600 transition-all flex items-center justify-center gap-2 shadow-sm hover:shadow-md active:scale-95 group"
                      >
                          <Copy size={14} className="text-slate-400 group-hover:text-indigo-600 transition-colors" />
                          <span>Copier email support</span>
                      </button>
                  </div>
              </div>

          </div>

      </div>
    </div>
  );
};

export default SupportPage;
