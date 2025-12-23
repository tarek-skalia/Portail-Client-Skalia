
import React, { useState, useEffect } from 'react';
import { MENU_ITEMS, ADMIN_MENU_ITEMS } from '../constants';
import { LogOut, Phone, ShieldCheck, CornerUpLeft, User, Settings as SettingsIcon } from 'lucide-react';
import { Client } from '../types';
import Logo from './Logo';
import { useAdmin } from './AdminContext';

interface SidebarProps {
  activePage: string;
  setActivePage: (page: string) => void;
  currentClient: Client;
  onLogout: () => void;
}

const LOGO_DEV_PUBLIC_KEY = 'pk_PhkKGyy8QSawDAIdG5tLlg';

const Sidebar: React.FC<SidebarProps> = ({ activePage, setActivePage, currentClient, onLogout }) => {
  const { isAdmin, targetUserId, setTargetUserId, clients } = useAdmin();
  const [imgError, setImgError] = useState(false);

  // --- LOGIQUE ERP VS CLIENT ---
  // Est-ce un compte client (ou une vue client) ?
  const isClientTheme = currentClient.role !== 'admin';
  // Est-ce un admin qui se fait passer pour un client ?
  const isImpersonating = isAdmin && isClientTheme;

  const menuToRender = isClientTheme ? MENU_ITEMS : ADMIN_MENU_ITEMS;

  useEffect(() => {
      setImgError(false);
  }, [currentClient.id, currentClient.logoUrl]);

  const getLogoUrl = () => {
      if (!currentClient.logoUrl) return null;
      try {
          const urlStr = currentClient.logoUrl.startsWith('http') ? currentClient.logoUrl : `https://${currentClient.logoUrl}`;
          const urlObj = new URL(urlStr);
          const domain = urlObj.hostname.replace('www.', '');
          return `https://img.logo.dev/${domain}?token=${LOGO_DEV_PUBLIC_KEY}&retina=true`;
      } catch (e) {
          return null;
      }
  };

  const logoSrc = getLogoUrl();

  const handleReturnToAgency = () => {
      const adminUser = clients.find(c => c.role === 'admin');
      if (adminUser) {
          setTargetUserId(adminUser.id);
          setActivePage('global_view');
      }
  };

  return (
    <div className={`w-72 h-screen text-white flex flex-col shadow-2xl flex-shrink-0 sticky top-0 z-50 overflow-hidden font-sans transition-all duration-500 ${isClientTheme ? 'bg-[#4338ca]' : 'bg-slate-900'}`}>
      
      {/* Decorative animated gradients */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-30">
        <div className={`absolute top-[-20%] left-[-20%] w-[350px] h-[350px] rounded-full blur-[80px] animate-float ${isClientTheme ? 'bg-purple-500' : 'bg-indigo-900'}`}></div>
        <div className={`absolute bottom-[-10%] right-[-10%] w-[250px] h-[250px] rounded-full blur-[60px] animate-float-delayed ${isClientTheme ? 'bg-indigo-400' : 'bg-blue-900'}`}></div>
      </div>

      {/* Header with 3D Framed Logo - Compact Mode */}
      <div className="px-6 pt-6 pb-2 relative z-10 shrink-0">
        {isImpersonating && (
            <div className="mb-3 animate-fade-in">
                <button 
                    onClick={handleReturnToAgency}
                    className="flex items-center justify-center gap-2 text-[10px] font-bold text-white uppercase tracking-wider bg-black/30 hover:bg-black/50 border border-white/10 px-3 py-2 rounded-xl w-full transition-all hover:scale-[1.02] shadow-lg group"
                >
                    <CornerUpLeft size={12} className="group-hover:-translate-x-1 transition-transform" /> 
                    Retour Vue Agence
                </button>
            </div>
        )}

        <div className="bg-gradient-to-br from-white/10 to-indigo-900/20 border border-white/10 rounded-2xl p-3 shadow-xl backdrop-blur-sm flex items-center justify-center relative overflow-hidden group hover:scale-[1.02] transition-transform duration-500">
            {/* Glossy shine effect */}
            <div className="absolute top-0 left-0 w-full h-[40%] bg-gradient-to-b from-white/10 to-transparent pointer-events-none"></div>
            
            <Logo 
              className="w-10 h-10 transition-transform duration-500 group-hover:rotate-3" 
              classNameText="text-2xl drop-shadow-md tracking-wider" 
            />
        </div>
        
        {!isClientTheme && (
            <div className="mt-2 flex justify-center">
                <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/50 text-[9px] font-bold uppercase tracking-widest text-indigo-300 flex items-center gap-2">
                    <ShieldCheck size={10} /> Espace Administration
                </span>
            </div>
        )}
      </div>

      {/* Navigation - Espacement ajusté (space-y-1 et py-3) */}
      <nav className="flex-1 px-3 overflow-y-auto space-y-1 relative z-10 custom-scrollbar flex flex-col py-3">
        
        {/* TITRE DE SECTION */}
        <div className="px-3 mb-2 mt-1">
            <p className="text-[9px] font-bold uppercase tracking-widest text-white/40 flex items-center gap-2">
                {isClientTheme ? (
                    <>
                        <User size={10} />
                        ESPACE CLIENT
                    </>
                ) : 'NAVIGATION ERP'}
            </p>
        </div>
        
        <div className="space-y-1">
            {menuToRender.map((item) => {
            const isActive = activePage === item.id;
            const activeBg = isClientTheme ? 'bg-white text-indigo-700' : 'bg-indigo-600 text-white border border-indigo-500';
            const activeShadow = isClientTheme ? 'shadow-[0_0_20px_rgba(255,255,255,0.3)]' : 'shadow-lg shadow-indigo-900/50';

            return (
                <button
                key={item.id}
                onClick={() => setActivePage(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 group relative overflow-hidden
                    ${
                    isActive
                        ? `${activeBg} ${activeShadow} translate-x-1 scale-[1.02]`
                        : 'text-indigo-100 hover:bg-white/10 hover:text-white hover:translate-x-1'
                    }
                `}
                >
                {!isActive && (
                    <div className="absolute inset-0 bg-white/5 translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-300 rounded-xl"></div>
                )}

                <span className={`relative z-10 transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110 group-hover:rotate-3'}`}>
                    {item.icon}
                </span>
                <span className="relative z-10">{item.label}</span>
                
                {isActive && isClientTheme && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse relative z-10" />
                )}
                </button>
            );
            })}
        </div>
        
        <div className="flex-grow"></div>
      </nav>

      {/* Call to Action (Seulement pour les clients) - Compact */}
      {isClientTheme && (
          <div className="px-3 mb-2 mt-2 relative z-10 shrink-0">
             <button 
                type="button"
                className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 border border-white/10 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-indigo-900/20 flex items-center justify-center gap-2 group relative overflow-hidden hover:scale-[1.02] transition-transform duration-300 active:scale-[0.98]"
                data-iclosed-link="https://app.iclosed.io/e/tarekskalia/appel-decouverte"
                data-embed-type="popup"
             >
                <div className="p-1 bg-white/10 rounded-lg group-hover:bg-white/20 transition-colors border border-white/10">
                    <Phone size={16} className="text-white transition-colors" />
                </div>
                <span className="text-white transition-colors relative z-10 text-xs">Réservez un appel</span>
             </button>
          </div>
      )}

      {/* Footer User Profile (Clickable to Settings) - Compact */}
      <button 
        onClick={() => setActivePage('settings')}
        className="p-3 mx-3 mb-3 mt-0 rounded-2xl bg-black/20 backdrop-blur-md border border-white/5 relative z-10 shadow-lg group hover:bg-black/30 transition-colors duration-300 shrink-0 text-left w-[calc(100%-1.5rem)]"
      >
        <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-full bg-white shadow-md border border-white/20 shrink-0 group-hover:scale-110 transition-transform duration-300 flex items-center justify-center overflow-hidden">
                {logoSrc && !imgError ? (
                    <img 
                        src={logoSrc} 
                        alt={currentClient.company} 
                        className="w-full h-full object-cover" 
                        onError={() => setImgError(true)}
                        loading="lazy"
                    />
                ) : (
                    <div className="w-full h-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center font-bold text-xs text-white">
                        {currentClient.avatarInitials}
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-hidden">
                <p className="text-sm font-semibold truncate text-white group-hover:text-indigo-100 transition-colors">{currentClient.name}</p>
                <p className="text-[10px] text-indigo-300 truncate">{currentClient.company}</p>
            </div>
            
            <div className="text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity">
                <SettingsIcon size={14} />
            </div>
        </div>
        
        <div className="pt-2 border-t border-white/10 flex justify-center">
            <div 
                role="button"
                onClick={(e) => { e.stopPropagation(); onLogout(); }}
                className="w-full py-1 hover:bg-red-500/20 text-indigo-200 hover:text-red-200 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-wider" 
                title="Déconnexion"
            >
                <LogOut size={12} />
                <span>Déconnexion</span>
            </div>
        </div>
      </button>
    </div>
  );
};

export default Sidebar;
