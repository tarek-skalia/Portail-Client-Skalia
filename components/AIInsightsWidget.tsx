
import React, { useState, useEffect } from 'react';
import { Sparkles, Bot, ArrowRight, Loader2, BrainCircuit } from 'lucide-react';

interface AIInsightsWidgetProps {
  stats: {
    totalExecutions: number;
    activeAutomations: number;
    activeProjects: number;
  };
  isLoading: boolean;
}

const AIInsightsWidget: React.FC<AIInsightsWidgetProps> = ({ stats, isLoading }) => {
  const [status, setStatus] = useState<'idle' | 'analyzing' | 'completed'>('idle');
  const [insight, setInsight] = useState('');
  const [showCursor, setShowCursor] = useState(true);
  const [isTyping, setIsTyping] = useState(false); // Nouvel état pour gérer l'affichage du curseur

  // Curseur clignotant
  useEffect(() => {
    const interval = setInterval(() => {
      setShowCursor((prev) => !prev);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const startAnalysis = () => {
    setStatus('analyzing');
    setIsTyping(true); // Début de la frappe
    
    // Simulation du temps de "réflexion" de l'IA (2.5 secondes)
    setTimeout(() => {
        generateSmartInsight();
        setStatus('completed');
    }, 2500);
  };

  const generateSmartInsight = () => {
    const savings = Math.round(stats.totalExecutions * 1.5);
    let text = "";

    // --- HELPER GRAMMAIRE ---
    const plural = (count: number, singular: string, pluralStr: string) => count > 1 ? pluralStr : singular;
    const accord = (count: number, singular: string, pluralStr: string) => count > 1 ? pluralStr : singular;

    // --- MOTEUR DE GÉNÉRATION DE TEXTE (Templates) ---
    
    const highActivityPhrases = [
        `Activité intense détectée ! Vos ${stats.activeAutomations} ${plural(stats.activeAutomations, 'automatisation', 'automatisations')} tournent à plein régime avec ${stats.totalExecutions} exécutions.`,
        `Vos systèmes sont en surchauffe positive : ${stats.totalExecutions} tâches ${accord(stats.totalExecutions, 'automatisée', 'automatisées')} cette semaine.`,
        `Performance exceptionnelle. Le volume d'automatisation est en hausse avec ${stats.totalExecutions} runs enregistrés.`
    ];

    const lowActivityPhrases = [
        `L'activité est calme pour le moment avec ${stats.totalExecutions} ${plural(stats.totalExecutions, 'exécution', 'exécutions')}.`,
        `Vos flux sont opérationnels mais peu sollicités cette semaine.`,
        `Volume stable et modéré détecté sur vos automatisations.`
    ];

    const moneyPhrases = [
        `Cela représente une économie estimée de ${savings}€ de main d'œuvre.`,
        `Impact financier estimé : ${savings}€ économisés sur la période.`,
        `Valeur générée automatiquement : environ ${savings}€.`,
        `Votre retour sur investissement continue de croître (+${savings}€ estimés).`
    ];

    // Correction Vocabulaire : "Chantier/Flux" remplacé par "Projet"
    const projectPhrases = stats.activeProjects > 0 
        ? [
            `En parallèle, ${stats.activeProjects} ${plural(stats.activeProjects, 'projet', 'projets')} de développement ${accord(stats.activeProjects, 'avance', 'avancent')} normalement.`,
            `Côté développement, ${stats.activeProjects} ${plural(stats.activeProjects, 'projet est', 'projets sont')} en cours de traitement.`,
            `Notez que ${stats.activeProjects} ${plural(stats.activeProjects, 'projet est', 'projets sont')} actuellement en cours dans le pipeline.`
          ]
        : [
            `Aucun nouveau développement majeur en cours, vos systèmes actuels sont stables.`,
            `Vos infrastructures sont stables, aucun nouveau projet n'est ouvert.`,
            `Le pipeline de projet est vide, signe d'une phase d'exploitation pure.`
          ];

    // Sélection aléatoire
    const rand = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

    // Construction du message (DIRECT, SANS INTRO, SANS SUGGESTIONS)
    
    if (stats.totalExecutions > 500) {
        text += rand(highActivityPhrases) + " ";
    } else {
        text += rand(lowActivityPhrases) + " ";
    }

    if (stats.totalExecutions > 0) {
        text += rand(moneyPhrases) + " ";
    }

    text += rand(projectPhrases);

    // Lancement de l'effet Typewriter
    let i = 0;
    const typingInterval = setInterval(() => {
        setInsight(text.substring(0, i + 1));
        i++;
        if (i > text.length) {
            clearInterval(typingInterval);
            setIsTyping(false); // Arrêt du curseur quand le texte est fini
        }
    }, 25);
  };

  if (isLoading) return null;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 p-[1px] shadow-xl mb-8 animate-fade-in-up group">
       <div className="relative bg-white rounded-[15px] p-6 md:p-8 flex flex-col md:flex-row gap-6 items-center md:items-start min-h-[140px] transition-all duration-500">
          
          {/* Icone IA animée */}
          <div className="relative shrink-0">
             <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center shadow-inner border border-indigo-100 group-hover:scale-105 transition-transform duration-500">
                {status === 'analyzing' ? (
                    <Loader2 className="text-indigo-600 animate-spin" size={32} />
                ) : (
                    <BrainCircuit className="text-purple-600" size={32} />
                )}
             </div>
             <div className="absolute -bottom-2 -right-2 bg-white rounded-full p-1.5 shadow-md border border-slate-50">
                <Bot size={16} className="text-indigo-600" />
             </div>
          </div>

          <div className="flex-1 w-full">
             <div className="flex items-center gap-2 mb-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">
                   Skalia AI Consultant
                </h3>
                {status === 'analyzing' && (
                    <span className="flex gap-1 ml-2">
                        <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></span>
                        <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce delay-100"></span>
                        <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce delay-200"></span>
                    </span>
                )}
             </div>
             
             {status === 'idle' && (
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                    <p className="text-slate-500 text-base font-medium">
                        Votre consultant virtuel est prêt à analyser vos performances de la semaine.
                    </p>
                    <button 
                        onClick={startAnalysis}
                        className="px-5 py-2.5 bg-slate-900 hover:bg-indigo-600 text-white text-sm font-bold rounded-xl shadow-lg shadow-indigo-200/50 hover:shadow-indigo-500/30 transition-all duration-300 flex items-center gap-2 group/btn"
                    >
                        <Sparkles size={16} className="text-indigo-300 group-hover/btn:text-white transition-colors" />
                        Demander un rapport
                        <ArrowRight size={16} className="group-hover/btn:translate-x-1 transition-transform" />
                    </button>
                </div>
             )}

             {status === 'analyzing' && (
                 <p className="text-slate-400 text-lg font-medium italic animate-pulse">
                     Analyse des flux de données en cours...
                 </p>
             )}

             {status === 'completed' && (
                 <div className="animate-fade-in">
                    <p className="text-slate-700 text-lg leading-relaxed font-medium font-sans">
                        {insight}
                        {/* Le curseur ne s'affiche que si on est encore en train d'écrire */}
                        {isTyping && (
                             <span className={`${showCursor ? 'opacity-100' : 'opacity-0'} text-indigo-500 ml-0.5 font-bold transition-opacity duration-100`}>|</span>
                        )}
                    </p>
                    <div className="mt-4 flex gap-3">
                        <button onClick={startAnalysis} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1">
                            <Sparkles size={12} />
                            Générer une nouvelle analyse
                        </button>
                    </div>
                 </div>
             )}
          </div>
       </div>
    </div>
  );
};

export default AIInsightsWidget;
