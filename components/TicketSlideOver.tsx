
import React, { useEffect, useState, useRef } from 'react';
import { Ticket, TicketMessage } from '../types';
import { X, Send, Paperclip, CheckCircle2, Circle, Clock, User, ShieldAlert, FileText, Download, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from './ToastProvider';
import Skeleton from './Skeleton';
import { useAdmin } from './AdminContext';

interface TicketSlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  ticket: Ticket | null;
  userId?: string; // Id du client cible (pour l'historique)
}

const TicketSlideOver: React.FC<TicketSlideOverProps> = ({ isOpen, onClose, ticket, userId }) => {
  const { isAdmin } = useAdmin(); // Récupérer le statut réel de l'admin
  const [isVisible, setIsVisible] = useState(false);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  
  // File Upload State in Chat
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  useEffect(() => {
    if (isOpen) {
        const timer = setTimeout(() => setIsVisible(true), 50);
        return () => clearTimeout(timer);
    } else {
        setIsVisible(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && ticket) {
        fetchMessages();
        
        const channel = supabase
            .channel(`ticket_messages:${ticket.id}`)
            .on('postgres_changes', { 
                event: 'INSERT', 
                schema: 'public', 
                table: 'ticket_messages',
                filter: `ticket_id=eq.${ticket.id}`
            }, (payload) => {
                const newMsg = payload.new;
                setMessages(prev => [...prev, {
                    id: newMsg.id,
                    ticketId: newMsg.ticket_id,
                    senderId: newMsg.sender_id,
                    senderType: newMsg.sender_type,
                    message: newMsg.message,
                    createdAt: newMsg.created_at,
                    attachments: newMsg.attachments
                }]);
                scrollToBottom();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }
  }, [isOpen, ticket]);

  const scrollToBottom = () => {
      setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
  };

  const fetchMessages = async () => {
      if (!ticket) return;
      setIsLoadingMessages(true);

      const { data, error } = await supabase
          .from('ticket_messages')
          .select('*')
          .eq('ticket_id', ticket.id)
          .order('created_at', { ascending: true });

      if (data) {
          const mapped: TicketMessage[] = data.map((m: any) => ({
              id: m.id,
              ticketId: m.ticket_id,
              senderId: m.sender_id,
              senderType: m.sender_type,
              message: m.message,
              createdAt: m.created_at,
              attachments: m.attachments
          }));
          setMessages(mapped);
      } else {
          setMessages([{
              id: 'init',
              ticketId: ticket.id,
              senderId: ticket.clientId,
              senderType: 'client',
              message: ticket.description || "Ouverture du ticket",
              createdAt: ticket.date || new Date().toISOString(),
              attachments: []
          }]);
      }
      setIsLoadingMessages(false);
      scrollToBottom();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          setSelectedFile(e.target.files[0]);
      }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
      e.preventDefault();
      // On autorise l'envoi si texte OU fichier est présent
      if ((!newMessage.trim() && !selectedFile) || !ticket) return;

      setIsSending(true);
      
      try {
          // --- LOGIQUE ADMIN ---
          // Si isAdmin est vrai, on envoie en tant qu'admin
          // Le sender_id sera l'ID de l'admin (auth.uid()), mais on peut le récupérer proprement
          const { data: { user } } = await supabase.auth.getUser();
          const currentSenderId = user?.id;

          const senderType = isAdmin ? 'admin' : 'client';

          let uploadedFileUrl: string | null = null;

          // 1. Upload du fichier (dans le dossier du ticket)
          if (selectedFile) {
               const cleanName = selectedFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
               // On stocke dans tickets/{clientId}/... pour que le client puisse lire ses propres fichiers
               const storagePath = `tickets/${userId || ticket.clientId}/${Date.now()}_${cleanName}`;
               
               const { error: uploadError } = await supabase.storage
                  .from('project_files')
                  .upload(storagePath, selectedFile);
               
               if (uploadError) throw uploadError;

               const { data: { publicUrl } } = supabase.storage
                  .from('project_files')
                  .getPublicUrl(storagePath);
               
               uploadedFileUrl = publicUrl;
          }

          const { error } = await supabase.from('ticket_messages').insert({
              ticket_id: ticket.id,
              sender_id: currentSenderId,
              sender_type: senderType,
              message: newMessage, 
              attachments: uploadedFileUrl ? [uploadedFileUrl] : [],
              created_at: new Date().toISOString()
          });

          if (error) throw error;

          setNewMessage('');
          setSelectedFile(null);
          if (fileInputRef.current) fileInputRef.current.value = '';
          
          scrollToBottom();
          await supabase.from('tickets').update({ last_update: 'À l\'instant' }).eq('id', ticket.id);

      } catch (err) {
          console.error("Erreur envoi message", err);
          toast.error("Erreur", "Impossible d'envoyer le message.");
      } finally {
          setIsSending(false);
      }
  };

  if (!ticket) return null;

  const getStatusConfig = (status: Ticket['status']) => {
    switch (status) {
      case 'open': return { label: 'Ouvert', bg: 'bg-blue-100', text: 'text-blue-700', icon: <Circle size={14} className="fill-blue-600" /> };
      case 'in_progress': return { label: 'En cours', bg: 'bg-purple-100', text: 'text-purple-700', icon: <Clock size={14} className="animate-pulse" /> };
      case 'resolved': return { label: 'Résolu', bg: 'bg-emerald-100', text: 'text-emerald-700', icon: <CheckCircle2 size={14} /> };
      case 'closed': return { label: 'Fermé', bg: 'bg-slate-100', text: 'text-slate-500', icon: <CheckCircle2 size={14} /> };
      default: return { label: status, bg: 'bg-slate-100', text: 'text-slate-500', icon: <Circle size={14} /> };
    }
  };

  const statusConfig = getStatusConfig(ticket.status);

  return (
    <>
      <div 
        className={`fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-[110] transition-opacity duration-300 ${
          isVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      <div 
        className={`fixed inset-y-0 right-0 w-full md:w-[600px] bg-white shadow-2xl z-[120] transform transition-transform duration-300 ease-out flex flex-col ${
          isVisible ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* HEADER */}
        <div className="px-6 py-4 border-b border-slate-100 bg-white shrink-0 shadow-sm z-10 flex items-center justify-between">
            <div className="flex items-center gap-3">
                 <button 
                    onClick={onClose}
                    className="p-2 -ml-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-colors"
                >
                    <X size={20} />
                </button>
                <div>
                     <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-mono text-xs text-slate-400">#{ticket.id.slice(0,8)}</span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wide ${statusConfig.bg} ${statusConfig.text}`}>
                            {statusConfig.icon}
                            {statusConfig.label}
                        </span>
                     </div>
                     <h2 className="font-bold text-slate-800 line-clamp-1">{ticket.subject}</h2>
                </div>
            </div>
            <div className="flex gap-2">
                 {ticket.priority === 'high' && (
                     <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center text-red-500" title="Priorité Haute">
                         <ShieldAlert size={16} />
                     </div>
                 )}
            </div>
        </div>

        {/* MESSAGES AREA */}
        <div className="flex-1 overflow-y-auto bg-slate-50 p-4 md:p-6 space-y-6 custom-scrollbar">
            
            <div className="flex justify-center">
                <span className="text-xs font-medium text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
                    Début de la conversation • {ticket.date}
                </span>
            </div>

            {isLoadingMessages ? (
                <div className="space-y-4">
                     <Skeleton className="h-16 w-3/4 rounded-2xl ml-auto" />
                     <Skeleton className="h-16 w-3/4 rounded-2xl mr-auto" />
                     <Skeleton className="h-10 w-1/2 rounded-2xl ml-auto" />
                </div>
            ) : (
                messages.map((msg, idx) => {
                    const isClient = msg.senderType === 'client';
                    const isAdminMsg = msg.senderType === 'admin';
                    
                    const isMe = isAdmin ? isAdminMsg : isClient;
                    const isSequence = idx > 0 && messages[idx - 1].senderType === msg.senderType;

                    return (
                        <div key={msg.id} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
                            <div className={`flex max-w-[85%] md:max-w-[75%] gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                                
                                {/* Avatar */}
                                {!isSequence ? (
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border shadow-sm ${
                                        isAdminMsg 
                                        ? 'bg-slate-900 border-slate-700 text-white' // Admin Avatar Dark
                                        : 'bg-white border-slate-200 text-indigo-600' // Client Avatar Light
                                    }`}>
                                        {isAdminMsg ? <ShieldCheck size={14} /> : <User size={14} />}
                                    </div>
                                ) : (
                                    <div className="w-8 shrink-0" />
                                )}

                                {/* Bulle Message */}
                                <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                    
                                    {/* Nom au dessus (Optionnel, utile si admin parle au client) */}
                                    {!isMe && !isSequence && (
                                        <span className="text-[10px] text-slate-400 mb-1 ml-1">
                                            {isAdminMsg ? 'Support Skalia' : 'Client'}
                                        </span>
                                    )}

                                    <div className={`px-4 py-3 rounded-2xl shadow-sm text-sm leading-relaxed whitespace-pre-wrap ${
                                        isMe 
                                        ? 'bg-indigo-600 text-white rounded-tr-sm' 
                                        : isAdminMsg ? 'bg-slate-800 text-slate-100 rounded-tl-sm' : 'bg-white text-slate-700 border border-slate-200 rounded-tl-sm'
                                    }`}>
                                        {msg.message}
                                        
                                        {/* AFFICHAGE PIÈCES JOINTES */}
                                        {msg.attachments && msg.attachments.length > 0 && (
                                            <div className={`mt-3 pt-3 border-t ${isMe || isAdminMsg ? 'border-white/20' : 'border-slate-100'} space-y-2`}>
                                                {msg.attachments.map((url, i) => (
                                                    <a 
                                                        key={i} 
                                                        href={url} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer" 
                                                        className={`flex items-center gap-2 p-2 rounded-lg text-xs font-medium transition-colors ${
                                                            isMe || isAdminMsg
                                                            ? 'bg-white/10 hover:bg-white/20 text-white' 
                                                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                                        }`}
                                                    >
                                                        <FileText size={14} />
                                                        <span className="truncate max-w-[150px]">Pièce jointe {i + 1}</span>
                                                        <Download size={12} className="ml-auto opacity-70" />
                                                    </a>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    
                                    <span className="text-[10px] text-slate-400 mt-1 px-1">
                                        {new Date(msg.createdAt).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})}
                                    </span>
                                </div>

                            </div>
                        </div>
                    );
                })
            )}
            
            <div ref={messagesEndRef} />
        </div>

        {/* INPUT AREA */}
        <div className="p-4 bg-white border-t border-slate-200 shrink-0">
            {ticket.status === 'closed' ? (
                 <div className="text-center py-4 text-slate-500 bg-slate-50 rounded-xl border border-slate-100 italic text-sm">
                    Ce ticket est fermé. Vous ne pouvez plus y répondre.
                 </div>
            ) : (
                <form onSubmit={handleSendMessage} className="relative">
                    
                    {/* Preview du fichier sélectionné */}
                    {selectedFile && (
                        <div className="absolute bottom-full left-0 mb-2 bg-emerald-50 border border-emerald-100 text-emerald-700 px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2 shadow-sm animate-fade-in-up">
                             <Paperclip size={12} />
                             <span className="max-w-[200px] truncate">{selectedFile.name}</span>
                             <button type="button" onClick={() => setSelectedFile(null)} className="hover:text-red-500 ml-2">
                                 <X size={14} />
                             </button>
                        </div>
                    )}

                    <textarea
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder={isAdmin ? "Répondre en tant que Support..." : "Rédigez votre message..."}
                        className={`w-full pl-4 pr-12 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 transition-all resize-none min-h-[50px] max-h-[150px] ${
                            isAdmin 
                            ? 'bg-slate-50 border-slate-300 focus:ring-slate-500/20 focus:border-slate-500' 
                            : 'bg-slate-50 border-slate-200 focus:ring-indigo-500/20 focus:border-indigo-500'
                        }`}
                        rows={2}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSendMessage(e);
                            }
                        }}
                    />
                    
                    <div className="absolute right-2 bottom-2.5 flex items-center gap-1">
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleFileSelect} 
                            className="hidden" 
                        />
                        <button 
                            type="button" 
                            onClick={() => fileInputRef.current?.click()}
                            className={`p-2 rounded-lg transition-colors ${
                                selectedFile 
                                ? 'text-emerald-600 bg-emerald-50' 
                                : 'text-slate-400 hover:text-indigo-600 hover:bg-slate-200/50'
                            }`}
                            title="Joindre un fichier"
                        >
                            <Paperclip size={18} />
                        </button>
                        <button 
                            type="submit" 
                            disabled={(!newMessage.trim() && !selectedFile) || isSending}
                            className={`p-2 rounded-lg transition-all ${
                                (newMessage.trim() || selectedFile) && !isSending
                                ? (isAdmin ? 'bg-slate-800 text-white hover:bg-slate-900 shadow-md' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md')
                                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            }`}
                        >
                            <Send size={18} />
                        </button>
                    </div>
                </form>
            )}
            <p className="text-[10px] text-center text-slate-400 mt-2">
                Tapez Entrée pour envoyer • Shift + Entrée pour sauter une ligne
            </p>
        </div>
      </div>
    </>
  );
};

export default TicketSlideOver;
