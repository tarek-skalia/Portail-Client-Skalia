
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Client } from '../types';
import { Search, Plus, Trash2, Edit3, Shield, Mail, Building, User, Lock, Key, RefreshCw } from 'lucide-react';
import Skeleton from './Skeleton';
import { useToast } from './ToastProvider';
import Modal from './ui/Modal';

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const toast = useToast();

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
      email: '',
      password: '',
      fullName: '',
      companyName: '',
      role: 'client'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
      fetchUsers();
  }, []);

  const fetchUsers = async () => {
      setIsLoading(true);
      // On trie par updated_at décroissant pour avoir les modifications récentes en premier
      // et éviter les erreurs si created_at est manquant
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) {
          console.error("Erreur fetch profiles:", error);
          toast.error("Erreur", "Impossible de charger les utilisateurs.");
      } else if (data) {
          const mapped: Client[] = data.map((p: any) => ({
              id: p.id,
              name: p.full_name || 'Inconnu',
              company: p.company_name || 'Sans société',
              avatarInitials: p.avatar_initials || '?',
              email: p.email || '',
              role: p.role
          }));
          setUsers(mapped);
      }
      setIsLoading(false);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSubmitting(true);

      try {
          // Génération d'un UUID valide pour Postgres
          const newUserId = crypto.randomUUID();
          
          // 1. Insertion dans la table Profiles
          const { error: profileError } = await supabase
            .from('profiles')
            .insert({
                id: newUserId,
                email: formData.email,
                full_name: formData.fullName,
                company_name: formData.companyName,
                avatar_initials: formData.fullName.substring(0, 2).toUpperCase(),
                role: formData.role
            });

          if (profileError) throw profileError;

          toast.success("Utilisateur créé", "Le profil client a été ajouté avec succès.");
          setIsModalOpen(false);
          setFormData({ email: '', password: '', fullName: '', companyName: '', role: 'client' });
          fetchUsers();

          // Note pour l'admin
          setTimeout(() => {
              toast.info("Action requise", "Pensez à créer l'accès Auth correspondant dans Supabase ou invitez l'utilisateur par email.");
          }, 1500);

      } catch (err: any) {
          toast.error("Erreur", err.message || "Echec création utilisateur.");
      } finally {
          setIsSubmitting(false);
      }
  };

  const handleDelete = async (id: string) => {
      if (window.confirm("Supprimer cet utilisateur ? Cette action est irréversible.")) {
          const { error } = await supabase.from('profiles').delete().eq('id', id);
          if (error) {
              toast.error("Erreur", "Impossible de supprimer.");
          } else {
              toast.success("Supprimé", "Utilisateur retiré.");
              fetchUsers();
          }
      }
  };

  const filteredUsers = users.filter(u => 
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      u.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="animate-fade-in-up space-y-6 pb-10">
        
        <div className="flex flex-col md:flex-row justify-between items-end gap-4">
            <div>
                <h1 className="text-3xl font-extrabold text-slate-900">Gestion Clients</h1>
                <p className="text-slate-500 mt-1">Créez et gérez les accès à votre portail.</p>
            </div>
            
            <div className="flex gap-3 w-full md:w-auto">
                <button 
                    onClick={fetchUsers}
                    className="p-2.5 text-slate-500 hover:text-indigo-600 hover:bg-white bg-slate-100 rounded-xl transition-colors"
                    title="Actualiser"
                >
                    <RefreshCw size={20} className={isLoading ? "animate-spin" : ""} />
                </button>
                <div className="relative flex-1 md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                        type="text" 
                        placeholder="Rechercher..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                </div>
                <button 
                    onClick={() => setIsModalOpen(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-indigo-200 transition-all active:scale-95"
                >
                    <Plus size={18} /> Nouveau Client
                </button>
            </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            {isLoading ? (
                <div className="p-6 space-y-4">
                    {[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
                </div>
            ) : filteredUsers.length === 0 ? (
                <div className="p-12 text-center text-slate-400 italic">
                    Aucun utilisateur trouvé.
                </div>
            ) : (
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        <tr>
                            <th className="px-6 py-4">Utilisateur</th>
                            <th className="px-6 py-4">Entreprise</th>
                            <th className="px-6 py-4">Rôle</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredUsers.map(user => (
                            <tr key={user.id} className="hover:bg-slate-50 transition-colors group">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-100 to-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-600 text-xs">
                                            {user.avatarInitials}
                                        </div>
                                        <div>
                                            <div className="font-bold text-slate-900">{user.name}</div>
                                            <div className="text-xs text-slate-400 font-mono">{user.id.slice(0,8)}...</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2 text-slate-700 font-medium text-sm">
                                        <Building size={14} className="text-slate-400" />
                                        {user.company}
                                    </div>
                                    <div className="text-xs text-slate-400 pl-6">{user.email}</div>
                                </td>
                                <td className="px-6 py-4">
                                    {user.role === 'admin' ? (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-100 text-xs font-bold uppercase tracking-wide">
                                            <Shield size={12} /> Admin
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100 text-xs font-bold uppercase tracking-wide">
                                            <User size={12} /> Client
                                        </span>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button className="p-2 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 rounded-lg transition-colors">
                                            <Edit3 size={16} />
                                        </button>
                                        <button 
                                            onClick={() => handleDelete(user.id)}
                                            className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-colors"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>

        {/* MODAL CREATION */}
        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Ajouter un nouveau client">
            <form onSubmit={handleCreateUser} className="space-y-5">
                
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nom Complet</label>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input 
                                type="text" required 
                                value={formData.fullName}
                                onChange={e => setFormData({...formData, fullName: e.target.value})}
                                className="w-full pl-9 pr-4 py-2.5 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                placeholder="Jean Dupont"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Société</label>
                        <div className="relative">
                            <Building className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input 
                                type="text" required 
                                value={formData.companyName}
                                onChange={e => setFormData({...formData, companyName: e.target.value})}
                                className="w-full pl-9 pr-4 py-2.5 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                placeholder="Acme Inc."
                            />
                        </div>
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email (Identifiant)</label>
                    <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                            type="email" required 
                            value={formData.email}
                            onChange={e => setFormData({...formData, email: e.target.value})}
                            className="w-full pl-9 pr-4 py-2.5 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                            placeholder="jean@client.com"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-2">
                        Mot de passe Initial <Lock size={12} />
                    </label>
                    <div className="relative">
                        <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                            type="text" required 
                            value={formData.password}
                            onChange={e => setFormData({...formData, password: e.target.value})}
                            className="w-full pl-9 pr-4 py-2.5 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-mono"
                            placeholder="Saisir mot de passe..."
                        />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                        Utilisez ce mot de passe pour créer l'utilisateur dans Supabase Auth si besoin.
                    </p>
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Rôle</label>
                    <select 
                        value={formData.role}
                        onChange={e => setFormData({...formData, role: e.target.value})}
                        className="w-full px-3 py-2.5 border rounded-xl outline-none bg-white text-sm"
                    >
                        <option value="client">Client (Accès restreint)</option>
                        <option value="admin">Admin (Accès total)</option>
                    </select>
                </div>

                <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                    <button 
                        type="button" 
                        onClick={() => setIsModalOpen(false)}
                        className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg"
                    >
                        Annuler
                    </button>
                    <button 
                        type="submit" 
                        disabled={isSubmitting}
                        className="px-6 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-md disabled:opacity-50"
                    >
                        {isSubmitting ? 'Création...' : 'Créer le compte'}
                    </button>
                </div>

            </form>
        </Modal>

    </div>
  );
};

export default UserManagement;
