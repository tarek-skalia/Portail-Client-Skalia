
import React from 'react';
import { useAdmin } from './AdminContext';
import { Users, Eye, Edit3, ChevronDown, LogOut } from 'lucide-react';

const AdminToolbar: React.FC = () => {
  const { isAdmin, clients, targetUserId, setTargetUserId, isAdminMode, toggleAdminMode } = useAdmin();

  if (!isAdmin) return null;

  const currentClientName = clients.find(c => c.id === targetUserId)?.company || 'Moi-même';

  return (
    <div className="bg-slate-900 text-white px-4 py-2 flex items-center justify-between shadow-md relative z-[100] text-sm border-b border-indigo-500/30">
        
        <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 font-bold text-indigo-400 select-none">
                <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
                SKALIA ADMIN
            </div>

            {/* SÉLECTEUR DE CLIENT */}
            <div className="flex items-center gap-2">
                <Users size={14} className="text-slate-400" />
                <span className="text-slate-400 hidden sm:inline">Voir en tant que :</span>
                <div className="relative group">
                    <select 
                        value={targetUserId}
                        onChange={(e) => setTargetUserId(e.target.value)}
                        className="bg-slate-800 border border-slate-700 text-white rounded px-3 py-1 pr-8 outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer appearance-none min-w-[200px]"
                    >
                        {clients.map(client => (
                            <option key={client.id} value={client.id}>
                                {client.company} ({client.name}) {client.role === 'admin' ? '👑' : ''}
                            </option>
                        ))}
                    </select>
                    <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
            </div>
        </div>

        <div className="flex items-center gap-4">
            {/* TOGGLE EDIT MODE */}
            <button 
                onClick={toggleAdminMode}
                className={`flex items-center gap-2 px-3 py-1 rounded transition-colors ${
                    isAdminMode ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
            >
                {isAdminMode ? <Edit3 size={14} /> : <Eye size={14} />}
                <span>{isAdminMode ? 'Mode Édition' : 'Lecture Seule'}</span>
            </button>
        </div>
    </div>
  );
};

export default AdminToolbar;
