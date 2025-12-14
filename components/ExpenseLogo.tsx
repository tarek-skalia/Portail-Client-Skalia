
import React, { useState, useEffect } from 'react';
import { Box, Server, Cpu, Zap, Database, Cloud, Globe } from 'lucide-react';

// ==================================================================================
// CONFIGURATION LOGO.DEV
// ==================================================================================
const LOGO_DEV_PUBLIC_KEY = 'pk_PhkKGyy8QSawDAIdG5tLlg'; 
// ==================================================================================

interface ExpenseLogoProps {
  provider: string;
  logoUrl?: string;
  websiteUrl?: string;
  className?: string;
}

const ExpenseLogo: React.FC<ExpenseLogoProps> = ({ provider, logoUrl, websiteUrl, className = "w-12 h-12" }) => {
  const [hasError, setHasError] = useState(false);

  // Si les props changent (ex: on corrige l'URL en base), on réinitialise l'erreur
  useEffect(() => {
    setHasError(false);
  }, [provider, logoUrl, websiteUrl]);

  // Logique de récupération automatique via Logo.dev
  const getImageUrl = () => {
    // 1. Priorité absolue : URL du logo fournie manuellement
    if (logoUrl) return logoUrl;

    let domain = '';

    // 2. Priorité secondaire : Extraire le domaine depuis l'URL du site web
    if (websiteUrl) {
        try {
            const urlStr = websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`;
            const urlObj = new URL(urlStr);
            domain = urlObj.hostname.replace('www.', '');
        } catch (e) {
            // Ignorer erreur parsing
        }
    }

    // 3. Fallback : On devine le domaine
    if (!domain) {
        const cleanName = provider.split('(')[0].trim().toLowerCase().replace(/\s+/g, '');
        
        const domainMap: Record<string, string> = {
            'openai': 'openai.com',
            'chatgpt': 'openai.com',
            'make': 'make.com',
            'integromat': 'make.com',
            'n8n': 'n8n.io',
            'zapier': 'zapier.com',
            'airtable': 'airtable.com',
            'google': 'google.com',
            'gsuite': 'google.com',
            'stripe': 'stripe.com',
            'hubspot': 'hubspot.com',
            'salesforce': 'salesforce.com',
            'digitalocean': 'digitalocean.com',
            'aws': 'aws.amazon.com',
            'amazon': 'aws.amazon.com',
            'vercel': 'vercel.com',
            'netlify': 'netlify.com',
            'supabase': 'supabase.com',
            'firebase': 'firebase.google.com',
            'notion': 'notion.so',
            'webflow': 'webflow.com',
            'bubble': 'bubble.io',
            'flutterflow': 'flutterflow.io',
            'slack': 'slack.com',
            'discord': 'discord.com',
            'linear': 'linear.app',
            'jira': 'atlassian.com',
            'trello': 'trello.com',
            'phantom': 'phantombuster.com',
            'lemlist': 'lemlist.com',
            'mailchimp': 'mailchimp.com',
            'sendgrid': 'sendgrid.com',
            'twilio': 'twilio.com'
        };

        domain = domainMap[cleanName] || `${cleanName}.com`;
    }
    
    // Construction de l'URL Logo.dev
    return `https://img.logo.dev/${domain}?token=${LOGO_DEV_PUBLIC_KEY}&retina=true`;
  };

  const imgSrc = getImageUrl();

  // Fallback : Icônes colorées si l'image ne charge pas
  const getFallback = () => {
      const p = provider.toLowerCase();
      let Icon = Box;
      let colorClass = "bg-slate-50 text-slate-500 border-slate-200";

      if (p.includes('openai') || p.includes('gpt') || p.includes('ai') || p.includes('bot')) { 
          Icon = Cpu; 
          colorClass="bg-emerald-50 text-emerald-600 border-emerald-100"; 
      }
      else if (p.includes('make') || p.includes('zapier') || p.includes('n8n') || p.includes('auto')) { 
          Icon = Zap; 
          colorClass="bg-purple-50 text-purple-600 border-purple-100"; 
      }
      else if (p.includes('airtable') || p.includes('supabase') || p.includes('data') || p.includes('sql')) { 
          Icon = Database; 
          colorClass="bg-amber-50 text-amber-600 border-amber-100"; 
      }
      else if (p.includes('hosting') || p.includes('digital') || p.includes('aws') || p.includes('cloud')) { 
          Icon = Cloud; 
          colorClass="bg-blue-50 text-blue-600 border-blue-100"; 
      }
      else if (p.includes('web') || p.includes('site') || p.includes('flow')) { 
          Icon = Globe; 
          colorClass="bg-indigo-50 text-indigo-600 border-indigo-100"; 
      }

      return (
          <div className={`rounded-xl flex items-center justify-center border shrink-0 ${className} ${colorClass}`}>
              <Icon size="50%" strokeWidth={1.5} />
          </div>
      );
  };

  if (hasError) {
      return getFallback();
  }

  return (
      // DESIGN UPDATE :
      // - p-0 : Suppression totale du padding pour que l'image colle aux bords (effet App Icon)
      // - border-slate-100 : Bordure très légère conservée pour les logos blancs sur fond blanc
      <div className={`relative rounded-xl overflow-hidden bg-white flex items-center justify-center border border-slate-100 shrink-0 ${className} p-0`}>
        <img 
            src={imgSrc} 
            alt={provider} 
            onError={() => setHasError(true)}
            className="w-full h-full object-contain"
            loading="lazy"
        />
      </div>
  );
};

export default ExpenseLogo;
