
import React, { useEffect, useState } from 'react';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { Client } from '../types';
import { Search, Plus, Trash2, Edit3, Shield, Mail, Building, User, Lock, Key, RefreshCw, CreditCard, Globe } from 'lucide-react';
import Skeleton from './Skeleton';
import { useToast } from './ToastProvider';
import Modal from './ui/Modal';

// --- COMPOSANT AVATAR INTELLIGENT ---
const ClientAvatar = ({ client }: { client: Client }) => {
  const [imgError, setImgError] = useState(false);
  
  // Clé publique Logo.dev (la même que ExpenseLogo)
  const LOGO_DEV_PUBLIC_KEY = 'pk_PhkKGyy8QSawDAIdG5tLlg';

  const getLogoUrl = () => {
      if (!client.logoUrl) return null;
      try {
          // On s'assure d'avoir un format URL valide pour extraire le domaine
          const urlStr = client.logoUrl.startsWith('http') ? client.logoUrl : `https://${client.logoUrl}`;
          const urlObj = new URL(urlStr);
          const domain = urlObj.hostname.replace('www.', '');
          
          return `https://img.logo.dev/${domain}?token=${LOGO_DEV_PUBLIC_KEY}&retina=true`;
      } catch (e) {
          return null;
      }
  };

  const logoSrc = getLogoUrl();

  // Si on a une URL valide et pas d'erreur de chargement, on affiche le logo
  if (logoSrc && !imgError) {
      return (
          <img 
            src={logoSrc} 
            alt={client.company} 
            className="w-10 h-10 rounded-full object-contain bg-white border border-slate-200 shadow-sm"
            onError={() => setImgError(true)}
            loading="lazy"
          />
      );
  }

  // Sinon, fallback sur les initiales
  return (
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-100 to-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-600 text-xs shadow-sm select-none">
          {client.avatarInitials}
      </div>
  );
};

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const toast = useToast();

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Client | null>(null); // Pour le mode édition
  
  const [formData, setFormData] = useState({
      email: '',
      password: '',
      fullName: '',
      companyName: '',
      website: '', // Nouveau champ pour le logo
      role: 'client',
      stripeCustomerId: '' 
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
      fetchUsers();
  }, []);

  // Reset form quand on ferme ou change de mode
  useEffect(() => {
      if (editingUser) {
          setFormData({
              email: editingUser.email,
              password: '', // On ne remplit pas le mot de passe en édition par sécurité
              fullName: editingUser.name,
              companyName: editingUser.company,
              website: editingUser.logoUrl || '', // On utilise logoUrl pour stocker le site web
              role: editingUser.role || 'client',
              stripeCustomerId: editingUser.stripeCustomerId || ''
          });
      } else {
          setFormData({ 
              email: '', 
              password: '', 
              fullName: '', 
              companyName: '', 
              website: '',
              role: 'client',
              stripeCustomerId: ''
          });
      }
  }, [editingUser, isModalOpen]);

  const fetchUsers = async () => {
      setIsLoading(true);
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
              role: p.role,
              stripeCustomerId: p.stripe_customer_id,
              logoUrl: p.logo_url // Récupération de l'URL
          }));
          setUsers(mapped);
      }
      setIsLoading(false);
  };

  const handleSubmitUser = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSubmitting(true);

      try {
          if (editingUser) {
              // --- MODE MODIFICATION ---
              const updates: any = {
                  full_name: formData.fullName,
                  company_name: formData.companyName,
                  role: formData.role,
                  stripe_customer_id: formData.stripeCustomerId || null,
                  logo_url: formData.website || null, // Sauvegarde du site web
                  updated_at: new Date().toISOString()
              };
              
              // On met à jour l'email seulement s'il a changé (attention aux contraintes Auth)
              if (formData.email !== editingUser.email) {
                  updates.email = formData.email;
              }

              const { error } = await supabase
                  .from('profiles')
                  .update(updates)
                  .eq('id', editingUser.id);

              if (error) throw error;
              toast.success("Mis à jour", "Le profil a été modifié.");

          } else {
              // --- MODE CRÉATION ---
              // 1. Création utilisateur Auth (via client temporaire pour ne pas déconnecter l'admin)
              // Cela garantit qu'on a un ID valide qui existe dans auth.users
              const tempClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
                  auth: {
                      persistSession: false, 
                      autoRefreshToken: false,
                      detectSessionInUrl: false
                  }
              });

              const { data: authData, error: authError } = await tempClient.auth.signUp({
                  email: formData.email,
                  password: formData.password,
              });

              if (authError) throw authError;
              
              const newUserId = authData.user?.id;
              
              if (!newUserId) {
                  throw new Error("L'utilisateur Auth n'a pas pu être créé.");
              }

              // 2. Création du Profil (Lié par FK à auth.users)
              const { error: profileError } = await supabase
                .from('profiles')
                .insert({
                    id: newUserId, // On utilise l'ID généré par Auth
                    email: formData.email,
                    full_name: formData.fullName,
                    company_name: formData.companyName,
                    avatar_initials: formData.fullName.substring(0, 2).toUpperCase(),
                    role: formData.role,
                    stripe_customer_id: formData.stripeCustomerId || null,
                    logo_url: formData.website || null
                });

              // Si le profil existe déjà (créé par un trigger), on l'update pour compléter les infos
              if (profileError) {
                  if (profileError.code === '23505') { // Unique violation
                       await supabase.from('profiles').update({
                            full_name: formData.fullName,
                            company_name: formData.companyName,
                            role: formData.role,
                            stripe_customer_id: formData.stripeCustomerId || null,
                            logo_url: formData.website || null,
                            avatar_initials: formData.fullName.substring(0, 2).toUpperCase(),
                       }).eq('id', newUserId);
                  } else {
                      throw profileError;
                  }
              }

              toast.success("Utilisateur créé", "Compte Auth & Profil générés.");
              
              if (!authData.session) {
                  // Si pas de session, c'est que l'email confirmation est ON
                  setTimeout(() => {
                      toast.info("Info", "L'utilisateur doit confirmer son email avant connexion.");
                  }, 1500);
              }
          }

          setIsModalOpen(false);
          fetchUsers();

      } catch (err: any) {
          toast.error("Erreur", err.message || "Echec de l'opération.");
      } finally {
          setIsSubmitting(false);
      }
  };

  const handleEdit = (user: Client) => {
      setEditingUser(user);
      setIsModalOpen(true);
  };

  const handleCreate = () => {
      setEditingUser(null);
      setIsModalOpen(true);
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
    <>
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
                      onClick={handleCreate}
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
                              <th className="px-6 py-4">Stripe ID</th>
                              <th className="px-6 py-4">Rôle</th>
                              <th className="px-6 py-4 text-right">Actions</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                          {filteredUsers.map(user => (
                              <tr key={user.id} className="hover:bg-slate-50 transition-colors group">
                                  <td className="px-6 py-4">
                                      <div className="flex items-center gap-3">
                                          {/* UTILISATION DU COMPOSANT AVATAR INTELLIGENT */}
                                          <div className="shrink-0">
                                              <ClientAvatar client={user} />
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
                                      {user.stripeCustomerId ? (
                                          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-slate-100 text-slate-600 font-mono text-[10px] border border-slate-200">
                                              <CreditCard size={10} /> {user.stripeCustomerId}
                                          </span>
                                      ) : (
                                          <span className="text-xs text-slate-300 italic">-</span>
                                      )}
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
                                          <button 
                                              onClick={() => handleEdit(user)}
                                              className="p-2 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 rounded-lg transition-colors"
                                              title="Modifier"
                                          >
                                              <Edit3 size={16} />
                                          </button>
                                          <button 
                                              onClick={() => handleDelete(user.id)}
                                              className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-colors"
                                              title="Supprimer"
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
      </div>

      {/* MODAL CREATION / EDITION (Hors du conteneur animé) */}
      <Modal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          title={editingUser ? "Modifier le client" : "Ajouter un nouveau client"}
      >
          <form onSubmit={handleSubmitUser} className="space-y-6">
              
              <div className="grid grid-cols-2 gap-5">
                  <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Nom Complet</label>
                      <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                          <input 
                              type="text" required 
                              value={formData.fullName}
                              onChange={e => setFormData({...formData, fullName: e.target.value})}
                              className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-all"
                              placeholder="Jean Dupont"
                              autoComplete="off"
                          />
                      </div>
                  </div>
                  <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Société</label>
                      <div className="relative">
                          <Building className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                          <input 
                              type="text" required 
                              value={formData.companyName}
                              onChange={e => setFormData({...formData, companyName: e.target.value})}
                              className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-all"
                              placeholder="Acme Inc."
                              autoComplete="off"
                          />
                      </div>
                  </div>
              </div>

              {/* NOUVEAU CHAMP SITE WEB */}
              <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 flex items-center gap-2">
                      Site Web (pour Logo) <Globe size={12} />
                  </label>
                  <div className="relative">
                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input 
                          type="text"
                          value={formData.website}
                          onChange={e => setFormData({...formData, website: e.target.value})}
                          className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-all"
                          placeholder="https://mon-site-client.com"
                          autoComplete="off"
                      />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1.5 ml-1">
                      L'avatar du client sera automatiquement récupéré depuis ce domaine.
                  </p>
              </div>

              <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Email (Identifiant)</label>
                  <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input 
                          type="email" required 
                          value={formData.email}
                          onChange={e => setFormData({...formData, email: e.target.value})}
                          className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-all"
                          placeholder="jean@client.com"
                          autoComplete="new-password"
                      />
                  </div>
              </div>

              {/* Champ ID Stripe (Optionnel) */}
              <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 flex items-center gap-2">
                      Stripe Customer ID <span className="text-[10px] font-normal text-slate-400">(Optionnel - Auto-généré sinon)</span>
                  </label>
                  <div className="relative">
                      <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input 
                          type="text"
                          value={formData.stripeCustomerId}
                          onChange={e => setFormData({...formData, stripeCustomerId: e.target.value})}
                          className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-mono text-slate-600 transition-all"
                          placeholder="cus_..."
                          autoComplete="off"
                      />
                  </div>
              </div>

              {!editingUser && (
                  <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 flex items-center gap-2">
                          Mot de passe Initial <Lock size={12} />
                      </label>
                      <div className="relative">
                          <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                          <input 
                              type="text" required 
                              value={formData.password}
                              onChange={e => setFormData({...formData, password: e.target.value})}
                              className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-mono transition-all"
                              placeholder="Saisir mot de passe..."
                              autoComplete="new-password"
                          />
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1.5">
                          Utilisez ce mot de passe pour créer l'utilisateur dans Supabase Auth si besoin.
                      </p>
                  </div>
              )}

              <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Rôle</label>
                  <select 
                      value={formData.role}
                      onChange={e => setFormData({...formData, role: e.target.value})}
                      className="w-full px-3 py-3 border border-slate-200 rounded-xl outline-none bg-white text-sm focus:ring-2 focus:ring-indigo-500 transition-all"
                  >
                      <option value="client">Client (Accès restreint)</option>
                      <option value="admin">Admin (Accès total)</option>
                  </select>
              </div>

              <div className="pt-6 flex justify-end gap-3 border-t border-slate-100">
                  <button 
                      type="button" 
                      onClick={() => setIsModalOpen(false)}
                      className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                  >
                      Annuler
                  </button>
                  <button 
                      type="submit" 
                      disabled={isSubmitting}
                      className="px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-200 disabled:opacity-50 transition-all transform active:scale-95"
                  >
                      {isSubmitting ? 'Enregistrement...' : (editingUser ? 'Sauvegarder' : 'Créer le compte')}
                  </button>
              </div>

          </form>
      </Modal>
    </>
  );
};

export default UserManagement;
