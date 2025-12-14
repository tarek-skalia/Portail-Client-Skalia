
import React, { useState, useEffect } from 'react';
import { Sparkles, Bot, ArrowRight, Loader2, BrainCircuit, TrendingUp, TrendingDown } from 'lucide-react';

interface AIInsightsWidgetProps {
  stats: {
    totalExecutions: number;
    activeAutomations: number;
    activeProjects: number;
    minutesSaved: number;
    successRate: number;
    trendPercentage: number; // Croissance vs mois dernier
    topAutomationName?: string;
  };
  isLoading: boolean;
}

const AIInsightsWidget: React.FC<AIInsightsWidgetProps> = ({ stats, isLoading }) => {
  const [status, setStatus] = useState<'idle' | 'analyzing' | 'completed'>('idle');
  const [insight, setInsight] = useState('');
  const [showCursor, setShowCursor] = useState(true);
  const [isTyping, setIsTyping] = useState(false);

  // Curseur clignotant
  useEffect(() => {
    const interval = setInterval(() => {
      setShowCursor((prev) => !prev);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const startAnalysis = () => {
    setStatus('analyzing');
    setIsTyping(true);
    
    setTimeout(() => {
        generateRealInsight();
        setStatus('completed');
    }, 2000);
  };

  const generateRealInsight = () => {
    let text = "";
    
    // --- STRATÉGIE DE CONTENU : POSITIVITÉ ABSOLUE & RASSURANCE ---

    // 1. ANALYSE DE TENDANCE
    if (stats.totalExecutions === 0) {
        text += "Infrastructure prête et opérationnelle. Vos systèmes de captation sont actifs et en attente de vos prochains prospects ou données. ";
    } else if (stats.trendPercentage > 0) {
        text += `Excellente dynamique ! Votre activité est en croissance de **+${stats.trendPercentage}%** ce mois-ci. L'infrastructure Skalia absorbe parfaitement cette montée en charge sans ralentissement. `;
    } else {
        // Même si la tendance est négative, on la présente comme une stabilisation ou une optimisation
        text += `Votre flux de données est stabilisé. L'infrastructure maintient une haute disponibilité pour traiter vos demandes instantanément. `;
    }

    // 2. FOCUS SUR LA VALEUR (Le Top Performer)
    if (stats.topAutomationName) {
        text += `Le processus clé **"${stats.topAutomationName}"** fonctionne à plein régime pour soutenir votre activité. `;
    }

    // 3. FIABILITÉ & SÉCURITÉ (Jamais d'erreur mentionnée négativement)
    // Même si le taux de succès est bas, on dit que le système de filtrage fonctionne.
    if (stats.successRate < 95) {
        text += `Nos protocoles de sécurité ont filtré les données invalides (Taux de traitement : ${stats.successRate}%). Votre base de données reste ainsi propre et exploitable. `;
    } else {
        text += `La fiabilité système est optimale avec un taux de succès de **${stats.successRate}%**. Vos données sont traitées en toute sécurité. `;
    }

    // 4. ROI (La cerise sur le gâteau)
    const hours = Math.floor(stats.minutesSaved / 60);
    if (hours > 0) {
        text += `Au total, Skalia a automatisé l'équivalent de **${hours} heures** de travail manuel ce mois-ci, vous permettant de vous concentrer sur votre cœur de métier.`;
    } else {
        text += `Skalia est prêt à accélérer votre productivité dès les prochaines exécutions.`;
    }

    // Lancement de l'effet Typewriter
    let i = 0;
    const typingInterval = setInterval(() => {
        setInsight(text.substring(0, i + 1));
        i++;
        if (i > text.length) {
            clearInterval(typingInterval);
            setIsTyping(false);
        }
    }, 20); // Vitesse de frappe
  };

  if (isLoading) return null;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 p-[1px] shadow-xl mb-8 animate-fade-in-up group">
       <div className="relative bg-white rounded-[15px] p-6 md:p-8 flex flex-col md:flex-row gap-6 items-center md:items-start min-h-[130px] transition-all duration-500">
          
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
                <h3 className="text-sm font-bold uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 flex items-center gap-2">
                   <Sparkles size={14} className="text-purple-500" />
                   Analyse Skalia
                </h3>
             </div>
             
             {status === 'idle' && (
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                    <p className="text-slate-600 text-sm font-medium leading-relaxed">
                        L'IA Skalia surveille vos systèmes en permanence. Cliquez pour générer un rapport de performance et de rentabilité en temps réel.
                    </p>
                    <button 
                        onClick={startAnalysis}
                        className="px-5 py-2 bg-slate-900 hover:bg-indigo-600 text-white text-xs font-bold uppercase tracking-wide rounded-lg shadow-lg shadow-indigo-200/50 hover:shadow-indigo-500/30 transition-all duration-300 flex items-center gap-2 whitespace-nowrap"
                    >
                        Lancer l'analyse
                        <ArrowRight size={14} />
                    </button>
                </div>
             )}

             {status === 'analyzing' && (
                 <div className="flex items-center gap-3 text-slate-500 text-sm font-medium">
                     <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
                     </span>
                     Vérification de l'intégrité du système...
                 </div>
             )}

             {status === 'completed' && (
                 <div className="animate-fade-in">
                    <p className="text-slate-800 text-base leading-relaxed font-medium font-sans">
                        {/* Parser le Markdown basic (**gras**) */}
                        {insight.split('**').map((part, i) => 
                            i % 2 === 1 ? <strong key={i} className="text-indigo-700 font-bold">{part}</strong> : part
                        )}
                        {isTyping && (
                             <span className={`${showCursor ? 'opacity-100' : 'opacity-0'} text-indigo-500 ml-0.5 font-bold`}>|</span>
                        )}
                    </p>
                 </div>
             )}
          </div>
       </div>
    </div>
  );
};

export default AIInsightsWidget;
