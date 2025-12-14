
import React from 'react';
import { MENU_ITEMS, ADMIN_MENU_ITEMS } from '../constants';
import { LogOut, Phone } from 'lucide-react';
import { Client } from '../types';
import Logo from './Logo';
import { useAdmin } from './AdminContext';

interface SidebarProps {
  activePage: string;
  setActivePage: (page: string) => void;
  currentClient: Client;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activePage, setActivePage, currentClient, onLogout }) => {
  const { isAdmin } = useAdmin();

  return (
    <div className="w-72 h-screen bg-[#4338ca] text-white flex flex-col shadow-2xl flex-shrink-0 sticky top-0 z-50 overflow-hidden font-sans transition-all duration-300">
      {/* Decorative animated gradients */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-30">
        <div className="absolute top-[-20%] left-[-20%] w-[350px] h-[350px] rounded-full bg-purple-500 blur-[80px] animate-float"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[250px] h-[250px] rounded-full bg-indigo-400 blur-[60px] animate-float-delayed"></div>
        <div className="absolute top-[40%] right-[-30%] w-[200px] h-[200px] rounded-full bg-pink-500 blur-[70px] animate-float opacity-60"></div>
      </div>

      {/* Header with 3D Framed Logo */}
      <div className="px-4 pt-8 pb-4 relative z-10">
        <div className="bg-gradient-to-br from-white/10 to-indigo-900/20 border border-white/10 rounded-2xl p-4 shadow-xl backdrop-blur-sm flex items-center justify-center relative overflow-hidden group hover:scale-[1.02] transition-transform duration-500">
            {/* Glossy shine effect */}
            <div className="absolute top-0 left-0 w-full h-[40%] bg-gradient-to-b from-white/10 to-transparent pointer-events-none"></div>
            
            <Logo 
              className="w-16 h-16 transition-transform duration-500 group-hover:rotate-3" 
              classNameText="text-2xl drop-shadow-md tracking-wider" 
            />
        </div>
      </div>

      {/* Navigation - Added top margin for optical balance */}
      <nav className="flex-1 px-4 overflow-y-auto space-y-2 relative z-10 py-4 custom-scrollbar flex flex-col">
        
        {/* SECTION ADMIN (si admin) */}
        {isAdmin && (
            <div className="mb-4 space-y-2">
                <p className="px-4 text-[10px] font-bold uppercase tracking-widest text-indigo-300 opacity-80 mb-2">Administration</p>
                {ADMIN_MENU_ITEMS.map((item) => {
                    const isActive = activePage === item.id;
                    return (
                        <button
                        key={item.id}
                        onClick={() => setActivePage(item.id)}
                        className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold transition-all duration-300 group relative overflow-hidden border
                            ${
                            isActive
                                ? 'bg-indigo-950 text-white border-indigo-500 shadow-md translate-x-1'
                                : 'bg-indigo-900/40 text-indigo-200 border-indigo-500/20 hover:bg-indigo-800 hover:text-white hover:border-indigo-400'
                            }
                        `}
                        >
                        <span className={`relative z-10 transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                            {item.icon}
                        </span>
                        <span className="relative z-10">{item.label}</span>
                        </button>
                    );
                })}
                <div className="h-px w-full bg-indigo-500/30 my-4"></div>
            </div>
        )}

        {/* SECTION CLIENT */}
        {isAdmin && <p className="px-4 text-[10px] font-bold uppercase tracking-widest text-indigo-300 opacity-80 mb-2">Vue Client</p>}
        {MENU_ITEMS.map((item) => {
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActivePage(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium transition-all duration-300 group relative overflow-hidden
                ${
                  isActive
                    ? 'bg-white text-indigo-700 shadow-[0_0_20px_rgba(255,255,255,0.3)] translate-x-1 scale-[1.02]'
                    : 'text-indigo-100 hover:bg-white/10 hover:text-white hover:translate-x-1'
                }
              `}
            >
              {/* Hover effect background for non-active items */}
              {!isActive && (
                <div className="absolute inset-0 bg-white/5 translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-300 rounded-xl"></div>
              )}

              <span className={`relative z-10 transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110 group-hover:rotate-3'}`}>
                {item.icon}
              </span>
              <span className="relative z-10">{item.label}</span>
              
              {isActive && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse relative z-10" />
              )}
            </button>
          );
        })}
        {/* Filler div to push content down if needed, though flex-1 does this */}
        <div className="flex-grow"></div>
      </nav>

      {/* Call to Action Button - Standard Button (No Magnetic) */}
      <div className="px-4 mb-2 mt-8 relative z-10">
         <button 
            type="button"
            className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 border border-white/10 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-indigo-900/20 flex items-center justify-center gap-2 group relative overflow-hidden hover:scale-[1.02] transition-transform duration-300 active:scale-[0.98]"
            data-iclosed-link="https://app.iclosed.io/e/tarekskalia/appel-decouverte"
            data-embed-type="popup"
         >
            {/* Hover shine effect */}
            <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>

            <div className="p-1.5 bg-white/10 rounded-lg group-hover:bg-white/20 transition-colors border border-white/10">
                <Phone size={18} className="text-white transition-colors" />
            </div>
            <span className="text-white transition-colors relative z-10">Réservez un appel</span>
         </button>
      </div>

      {/* Footer */}
      <div className="p-4 m-4 mt-2 rounded-2xl bg-indigo-950/30 backdrop-blur-md border border-white/5 relative z-10 shadow-lg group hover:bg-indigo-950/40 transition-colors duration-300">
        
        {/* User Profile */}
        <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center font-bold text-sm text-white shadow-md border border-white/20 shrink-0 group-hover:scale-110 transition-transform duration-300">
                {currentClient.avatarInitials}
            </div>
            <div className="flex-1 overflow-hidden">
                <p className="text-sm font-semibold truncate text-white group-hover:text-indigo-100 transition-colors">{currentClient.name}</p>
                <p className="text-xs text-indigo-200 truncate">{currentClient.company}</p>
            </div>
        </div>
        
        <div className="pt-3 border-t border-white/10 flex justify-center">
            <button 
                onClick={onLogout}
                className="w-full py-2 hover:bg-red-500/20 text-indigo-200 hover:text-red-200 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 text-xs font-medium" 
                title="Déconnexion"
            >
                <LogOut size={14} />
                <span>Déconnexion</span>
            </button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
