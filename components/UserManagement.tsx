
import React, { useEffect, useState } from 'react';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { Client } from '../types';
import { Search, Plus, Trash2, Edit3, Shield, Mail, Building, User, Lock, Key, RefreshCw, CreditCard, Globe, Eye, Monitor } from 'lucide-react';
import Skeleton from './Skeleton';
import { useToast } from './ToastProvider';
import Modal from './ui/Modal';
import { useAdmin } from './AdminContext';

// --- COMPOSANT AVATAR INTELLIGENT ---
const ClientAvatar = ({ client }: { client: Client }) => {
  const [imgError, setImgError] = useState(false);
  const LOGO_DEV_PUBLIC_KEY = 'pk_PhkKGyy8QSawDAIdG5tLlg';

  const getLogoUrl = () => {
      if (!client.logoUrl) return null;
      try {
          const urlStr = client.logoUrl.startsWith('http') ? client.logoUrl : `https://${client.logoUrl}`;
          const urlObj = new URL(urlStr);
          const domain = urlObj.hostname.replace('www.', '');
          return `https://img.logo.dev/${domain}?token=${LOGO_DEV_PUBLIC_KEY}&retina=true`;
      } catch (e) {
          return null;
      }
  };

  const logoSrc = getLogoUrl();

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

  return (
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-100 to-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-600 text-xs shadow-sm select-none">
          {client.avatarInitials}
      </div>
  );
};

const UserManagement: React.FC = () => {
  const { setTargetUserId } = useAdmin(); // Récupération de la fonction de changement de contexte
  const [users, setUsers] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const toast = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Client | null>(null);
  
  const [formData, setFormData] = useState({
      email: '',
      password: '',
      fullName: '',
      companyName: '',
      website: '',
      role: 'client',
      stripeCustomerId: '' 
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
      fetchUsers();
  }, []);

  useEffect(() => {
      if (editingUser) {
          setFormData({
              email: editingUser.email,
              password: '',
              fullName: editingUser.name,
              companyName: editingUser.company,
              website: editingUser.logoUrl || '',
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
              logoUrl: p.logo_url
          }));
          setUsers(mapped);
      }
      setIsLoading(false);
  };

  const handleImpersonate = (userId: string, companyName: string) => {
      setTargetUserId(userId);
      toast.success("Mode Immersion Activé", `Vous consultez maintenant le portail de ${companyName}.`);
  };

  const handleSubmitUser = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSubmitting(true);

      try {
          if (editingUser) {
              const updates: any = {
                  full_name: formData.fullName,
                  company_name: formData.companyName,
                  role: formData.role,
                  stripe_customer_id: formData.stripeCustomerId || null,
                  logo_url: formData.website || null,
                  updated_at: new Date().toISOString()
              };
              
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
              // --- CRÉATION NOUVEAU CLIENT ---
              const tempClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
                  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
              });

              let newUserId = null;

              // 1. TENTATIVE DE SIGN UP
              const { data: authData, error: authError } = await tempClient.auth.signUp({
                  email: formData.email,
                  password: formData.password,
              });

              if (authError) {
                  // --- AUTO-RECOVERY STRATEGY ---
                  // Si l'utilisateur existe déjà, on tente de se connecter pour récupérer son ID
                  if (authError.message.includes("already registered")) {
                      
                      const { data: signInData, error: signInError } = await tempClient.auth.signInWithPassword({
                          email: formData.email,
                          password: formData.password,
                      });

                      if (signInData.user) {
                          newUserId = signInData.user.id;
                          toast.info("Compte existant détecté", "Restauration du profil en cours...");
                      } else {
                          throw new Error("Un compte existe déjà avec cet email, mais le mot de passe est différent.");
                      }
                  } else {
                      throw authError;
                  }
              } else {
                  newUserId = authData.user?.id;
              }
              
              if (!newUserId) throw new Error("L'identifiant utilisateur n'a pas pu être généré.");

              // 2. CRÉATION / RESTAURATION DU PROFIL (UPSERT)
              // IMPORTANT : Si on a une session sur tempClient (nouvel utilisateur connecté), on l'utilise pour créer le profil.
              // Cela permet de passer la règle RLS "Users can insert their own profile" sans avoir besoin de droits Admin spéciaux.
              const profileClient = authData?.session ? tempClient : supabase;

              const { error: profileError } = await profileClient
                .from('profiles')
                .upsert({
                    id: newUserId,
                    email: formData.email,
                    full_name: formData.fullName,
                    company_name: formData.companyName,
                    avatar_initials: formData.fullName.substring(0, 2).toUpperCase(),
                    role: formData.role,
                    stripe_customer_id: formData.stripeCustomerId || null,
                    logo_url: formData.website || null,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'id' });

              if (profileError) {
                  console.error("Erreur création profil:", profileError);
                  throw new Error(`Erreur permission (RLS) : ${profileError.message}. L'utilisateur Auth est créé, mais pas le profil.`);
              }

              toast.success("Client opérationnel", "Le compte et le profil sont actifs.");
              // Si c'est une vraie création (pas une récup), authData.session peut être null si confirm required
              if (authData?.user && !authData?.session && !newUserId) {
                   toast.info("Info", "Email de confirmation envoyé.");
              }
          }

          setIsModalOpen(false);
          fetchUsers();

      } catch (err: any) {
          console.error(err);
          toast.error("Erreur", err.message || "Echec de l'opération.");
      } finally {
          setIsSubmitting(false);
      }
  };

  const handleEdit = (user: Client) => { setEditingUser(user); setIsModalOpen(true); };
  const handleCreate = () => { setEditingUser(null); setIsModalOpen(true); };
  
  const handleDelete = async (id: string) => {
      if (window.confirm("Supprimer cet utilisateur ? Cette action masque le client du dashboard mais conserve le compte de connexion (Auth).")) {
          const { error } = await supabase.from('profiles').delete().eq('id', id);
          if (error) toast.error("Erreur", "Impossible de supprimer.");
          else { toast.success("Supprimé", "Utilisateur retiré."); fetchUsers(); }
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
                  <button onClick={fetchUsers} className="p-2.5 text-slate-500 hover:text-indigo-600 hover:bg-white bg-slate-100 rounded-xl transition-colors"><RefreshCw size={20} className={isLoading ? "animate-spin" : ""} /></button>
                  <div className="relative flex-1 md:w-64"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input type="text" placeholder="Rechercher..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" /></div>
                  <button onClick={handleCreate} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-indigo-200 transition-all active:scale-95"><Plus size={18} /> Nouveau Client</button>
              </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              {isLoading ? (
                  <div className="p-6 space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>
              ) : filteredUsers.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 italic">Aucun utilisateur trouvé.</div>
              ) : (
                  <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wider">
                          <tr>
                              <th className="px-6 py-4">Utilisateur</th>
                              <th className="px-6 py-4">Entreprise</th>
                              <th className="px-6 py-4">Rôle</th>
                              <th className="px-6 py-4 text-right">Accès</th>
                              <th className="px-6 py-4 text-right">Actions</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                          {filteredUsers.map(user => (
                              <tr key={user.id} className="hover:bg-slate-50 transition-colors group">
                                  <td className="px-6 py-4">
                                      <div className="flex items-center gap-3">
                                          <div className="shrink-0"><ClientAvatar client={user} /></div>
                                          <div><div className="font-bold text-slate-900">{user.name}</div><div className="text-xs text-slate-400 font-mono">{user.id.slice(0,8)}...</div></div>
                                      </div>
                                  </td>
                                  <td className="px-6 py-4">
                                      <div className="flex items-center gap-2 text-slate-700 font-medium text-sm"><Building size={14} className="text-slate-400" />{user.company}</div>
                                      <div className="text-xs text-slate-400 pl-6">{user.email}</div>
                                  </td>
                                  <td className="px-6 py-4">
                                      {user.role === 'admin' ? (
                                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-100 text-xs font-bold uppercase tracking-wide"><Shield size={12} /> Admin</span>
                                      ) : (
                                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100 text-xs font-bold uppercase tracking-wide"><User size={12} /> Client</span>
                                      )}
                                  </td>
                                  <td className="px-6 py-4 text-right">
                                      {user.role !== 'admin' && (
                                          <button 
                                              onClick={() => handleImpersonate(user.id, user.company)}
                                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold border border-indigo-200 transition-all hover:shadow-sm"
                                          >
                                              <Eye size={14} /> Accéder
                                          </button>
                                      )}
                                  </td>
                                  <td className="px-6 py-4 text-right">
                                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                          <button onClick={() => handleEdit(user)} className="p-2 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 rounded-lg transition-colors"><Edit3 size={16} /></button>
                                          <button onClick={() => handleDelete(user.id)} className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-colors"><Trash2 size={16} /></button>
                                      </div>
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              )}
          </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingUser ? "Modifier le client" : "Ajouter un nouveau client"}>
          <form onSubmit={handleSubmitUser} className="space-y-6">
              <div className="grid grid-cols-2 gap-5">
                  <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Nom Complet</label>
                      <div className="relative"><User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input type="text" required value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-all" placeholder="Jean Dupont" autoComplete="off" /></div>
                  </div>
                  <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Société</label>
                      <div className="relative"><Building className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input type="text" required value={formData.companyName} onChange={e => setFormData({...formData, companyName: e.target.value})} className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-all" placeholder="Acme Inc." autoComplete="off" /></div>
                  </div>
              </div>
              <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 flex items-center gap-2">Site Web (pour Logo) <Globe size={12} /></label>
                  <div className="relative"><Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input type="text" value={formData.website} onChange={e => setFormData({...formData, website: e.target.value})} className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-all" placeholder="https://mon-site-client.com" autoComplete="off" /></div>
              </div>
              <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Email (Identifiant)</label>
                  <div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input type="email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-all" placeholder="jean@client.com" autoComplete="new-password" /></div>
              </div>
              <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 flex items-center gap-2">Stripe Customer ID <span className="text-[10px] font-normal text-slate-400">(Optionnel)</span></label>
                  <div className="relative"><CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input type="text" value={formData.stripeCustomerId} onChange={e => setFormData({...formData, stripeCustomerId: e.target.value})} className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-mono text-slate-600 transition-all" placeholder="cus_..." autoComplete="off" /></div>
              </div>
              {!editingUser && (
                  <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 flex items-center gap-2">Mot de passe Initial <Lock size={12} /></label>
                      <div className="relative"><Key className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input type="text" required value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-mono transition-all" placeholder="Saisir mot de passe..." autoComplete="new-password" /></div>
                  </div>
              )}
              <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Rôle</label>
                  <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} className="w-full px-3 py-3 border border-slate-200 rounded-xl outline-none bg-white text-sm focus:ring-2 focus:ring-indigo-500 transition-all">
                      <option value="client">Client (Accès restreint)</option>
                      <option value="admin">Admin (Accès total)</option>
                  </select>
              </div>
              <div className="pt-6 flex justify-end gap-3 border-t border-slate-100">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">Annuler</button>
                  <button type="submit" disabled={isSubmitting} className="px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-200 disabled:opacity-50 transition-all transform active:scale-95">{isSubmitting ? 'Enregistrement...' : (editingUser ? 'Sauvegarder' : 'Créer le compte')}</button>
              </div>
          </form>
      </Modal>
    </>
  );
};

export default UserManagement;
