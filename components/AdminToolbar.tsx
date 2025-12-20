
import React from 'react';
import { useAdmin } from './AdminContext';
import { Users, Eye, Edit3, ChevronDown, Globe, CornerUpLeft } from 'lucide-react';

const AdminToolbar: React.FC = () => {
  const { isAdmin, clients, targetUserId, setTargetUserId, isAdminMode, toggleAdminMode } = useAdmin();

  if (!isAdmin) return null;

  const currentClient = clients.find(c => c.id === targetUserId);
  // On considère qu'on est en vue client si le rôle n'est PAS admin
  const isViewingAsClient = currentClient && currentClient.role !== 'admin';

  const handleReturnToGlobal = () => {
      const adminUser = clients.find(c => c.role === 'admin');
      if (adminUser) {
          setTargetUserId(adminUser.id);
      }
  };

  return (
    <div className={`px-4 py-2 flex items-center justify-between shadow-md relative z-[100] text-sm border-b transition-colors ${isViewingAsClient ? 'bg-indigo-900 border-indigo-700 text-white' : 'bg-slate-900 border-slate-800 text-slate-200'}`}>
        
        <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 font-bold select-none">
                <div className={`w-2 h-2 rounded-full animate-pulse ${isViewingAsClient ? 'bg-indigo-400' : 'bg-emerald-500'}`}></div>
                {isViewingAsClient ? (
                    <span className="text-indigo-200 tracking-wide">MODE VUE CLIENT</span>
                ) : (
                    <span className="text-emerald-400 tracking-wide">SKALIA ERP</span>
                )}
            </div>

            {/* SÉLECTEUR DE CLIENT */}
            <div className="flex items-center gap-2 pl-4 border-l border-white/10">
                <Users size={14} className="opacity-70" />
                <span className="opacity-70 hidden sm:inline">Contexte :</span>
                <div className="relative group">
                    <select 
                        value={targetUserId}
                        onChange={(e) => setTargetUserId(e.target.value)}
                        className="bg-black/20 border border-white/10 text-white rounded px-3 py-1 pr-8 outline-none focus:ring-1 focus:ring-white/50 cursor-pointer appearance-none min-w-[200px] hover:bg-black/30 transition-colors"
                    >
                        {clients.map(client => (
                            <option key={client.id} value={client.id} className="text-slate-900">
                                {client.company} ({client.name}) {client.role === 'admin' ? '— ADMIN' : ''}
                            </option>
                        ))}
                    </select>
                    <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 opacity-70 pointer-events-none" />
                </div>
            </div>

            {isViewingAsClient && (
                <button 
                    onClick={handleReturnToGlobal}
                    className="flex items-center gap-1.5 px-3 py-1 bg-white/10 hover:bg-white/20 rounded-md text-xs font-bold transition-all ml-2 border border-white/10"
                >
                    <CornerUpLeft size={12} />
                    Retour Global
                </button>
            )}
        </div>

        <div className="flex items-center gap-4">
            {/* TOGGLE EDIT MODE */}
            <button 
                onClick={toggleAdminMode}
                className={`flex items-center gap-2 px-3 py-1 rounded transition-colors ${
                    isAdminMode ? 'bg-emerald-600 text-white shadow-sm' : 'bg-black/20 text-slate-400 hover:text-white'
                }`}
            >
                {isAdminMode ? <Edit3 size={14} /> : <Eye size={14} />}
                <span>{isAdminMode ? 'Édition ON' : 'Lecture Seule'}</span>
            </button>
        </div>
    </div>
  );
};

export default AdminToolbar;
