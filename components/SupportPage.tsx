
import React, { useState, useRef } from 'react';
import { Client } from '../types';
import { Send, Paperclip, FileText, UploadCloud, X, Bug, FileCode, Zap, AlertCircle, HelpCircle, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from './ToastProvider';

interface SupportPageProps {
  currentUser: Client;
}

const SupportPage: React.FC<SupportPageProps> = ({ currentUser }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const toast = useToast();

  // Form State
  const [subject, setSubject] = useState<string>('');
  const [priority, setPriority] = useState<string>('medium');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
        const { error } = await supabase.from('tickets').insert({
            user_id: currentUser.id,
            subject: subjects.find(s => s.id === subject)?.label || 'Support',
            category: subject,
            priority: priority,
            status: 'open',
            description: description,
            last_update: 'À l\'instant'
        });

        if (error) throw error;

        // Feedback Luxe avec Toast
        toast.success(
            "Ticket envoyé avec succès", 
            "Notre équipe technique a été notifiée. Vous recevrez une réponse sous 24h."
        );

        // Reset form
        setSubject('');
        setDescription('');
        setFile(null);
        setPriority('medium');

    } catch (error) {
        console.error("Erreur lors de l'envoi du ticket:", error);
        toast.error(
            "Erreur d'envoi", 
            "Impossible d'envoyer votre demande pour le moment. Veuillez réessayer."
        );
    } finally {
        setIsSubmitting(false);
    }
  };

  // --- Gestion des Fichiers ---

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

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

  const removeFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFile(null);
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };

  const priorities = [
    { id: 'low', label: 'Faible', sub: 'Non urgent, dans la semaine', color: 'bg-green-100 text-green-700 border-green-200', icon: <Clock size={16} /> },
    { id: 'medium', label: 'Moyenne', sub: 'Dans les 2-3 jours', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: <AlertCircle size={16} /> },
    { id: 'high', label: 'Élevée', sub: 'Le plus tôt possible (Bloquant)', color: 'bg-red-100 text-red-700 border-red-200', icon: <Zap size={16} /> },
  ];

  const subjects = [
    { id: 'bug', label: 'Bug ou Erreur d\'exécution', icon: <Bug size={18} /> },
    { id: 'modify', label: 'Modifier un workflow existant', icon: <FileCode size={18} /> },
    { id: 'new', label: 'Demander une nouvelle automatisation', icon: <Zap size={18} /> },
    { id: 'connection', label: 'Problème de connexion API', icon: <AlertCircle size={18} /> },
    { id: 'other', label: 'Autre demande', icon: <HelpCircle size={18} /> },
  ];

  return (
    <div className="max-w-3xl mx-auto pb-10 animate-fade-in-up">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Nouvelle demande de support</h2>
        <p className="text-gray-500 mt-1">Détaillez votre problème ou votre besoin pour que nous puissions intervenir rapidement.</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-8">
        
        {/* Identité (Pré-rempli) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">Nom</label>
            <input 
              type="text" 
              value={currentUser.name} 
              disabled 
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-500 cursor-not-allowed"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">Email</label>
            <input 
              type="email" 
              value={currentUser.email} 
              disabled 
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-500 cursor-not-allowed"
            />
          </div>
        </div>

        {/* Sujets */}
        <div className="space-y-3">
          <label className="text-sm font-semibold text-gray-700 flex items-center gap-1">
            Sujet de la demande <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-1 gap-2">
            {subjects.map((sub) => (
              <div 
                key={sub.id}
                onClick={() => setSubject(sub.id)}
                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-200 ${
                  subject === sub.id 
                    ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm' 
                    : 'border-gray-100 hover:bg-gray-50 hover:border-gray-300'
                }`}
              >
                <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                  subject === sub.id ? 'border-indigo-600 bg-indigo-600' : 'border-gray-300 bg-white'
                }`}>
                  {subject === sub.id && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
                <div className="text-gray-400">
                    {sub.icon}
                </div>
                <span className={`font-medium ${subject === sub.id ? 'text-indigo-900' : 'text-gray-700'}`}>
                  {sub.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Priorité */}
        <div className="space-y-3">
          <label className="text-sm font-semibold text-gray-700 flex items-center gap-1">
            Niveau de priorité <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {priorities.map((p) => (
              <div 
                key={p.id}
                onClick={() => setPriority(p.id)}
                className={`relative p-4 rounded-xl border cursor-pointer transition-all duration-200 flex flex-col items-start gap-2 ${
                  priority === p.id 
                    ? `bg-white ${p.color} ring-2 ring-offset-1 ring-indigo-500/30 shadow-md` 
                    : 'bg-white border-gray-100 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-2 w-full">
                    <div className={`p-1.5 rounded-md ${priority === p.id ? 'bg-white/50' : 'bg-gray-100'}`}>
                        {p.icon}
                    </div>
                    <span className="font-bold text-sm">{p.label}</span>
                </div>
                <span className="text-xs opacity-80 pl-1">{p.sub}</span>
                
                {priority === p.id && (
                    <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-current"></div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Détails */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-700 flex items-center gap-1">
            Détail de votre demande <span className="text-red-500">*</span>
          </label>
          <textarea 
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Expliquez clairement ce que vous souhaitez modifier ou le bug rencontré. Plus vous êtes précis, plus nous pourrons agir rapidement."
            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none"
          />
        </div>

        {/* Fichier joint */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-700">Fichier(s) joint(s)</label>
          
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            className="hidden" 
            accept="image/*,.pdf,.doc,.docx"
          />

          {!file ? (
            <div 
              onClick={handleFileClick}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center transition-all cursor-pointer group ${
                isDragging 
                  ? 'border-indigo-500 bg-indigo-50' 
                  : 'border-gray-200 hover:bg-gray-50 hover:border-indigo-300'
              }`}
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 transition-transform duration-300 group-hover:scale-110 ${
                 isDragging ? 'bg-indigo-100' : 'bg-gray-100'
              }`}>
                 {isDragging ? <UploadCloud className="text-indigo-600" /> : <Paperclip className="text-gray-400" />}
              </div>
              <p className="text-sm font-medium text-gray-600">
                <span className="text-indigo-600">Cliquez pour ajouter</span> ou glissez vos fichiers ici
              </p>
              <p className="text-xs text-gray-400 mt-1">Images, Vidéos, PDF (Max 10Mo)</p>
            </div>
          ) : (
            <div className="border border-gray-200 rounded-xl p-4 flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                  <FileText className="text-indigo-600" size={20} />
                </div>
                <div className="flex flex-col overflow-hidden">
                   <p className="text-sm font-medium text-gray-800 truncate">{file.name}</p>
                   <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              </div>
              <button 
                onClick={removeFile}
                className="p-2 hover:bg-gray-200 rounded-lg text-gray-500 hover:text-red-500 transition-colors"
                type="button"
              >
                <X size={18} />
              </button>
            </div>
          )}
        </div>

        {/* Bouton Envoyer */}
        <button
            type="submit"
            disabled={isSubmitting || !subject || !description}
            className={`w-full py-4 px-6 rounded-xl font-bold text-white shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 transition-all duration-300 transform ${
                isSubmitting || !subject || !description
                ? 'bg-gray-300 cursor-not-allowed shadow-none' 
                : 'bg-indigo-600 hover:bg-indigo-700 hover:scale-[1.01] active:scale-[0.98]'
            }`}
        >
            {isSubmitting ? (
                 <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
                <>
                    <Send size={18} />
                    Envoyer la demande
                </>
            )}
        </button>

      </form>
    </div>
  );
};

export default SupportPage;
