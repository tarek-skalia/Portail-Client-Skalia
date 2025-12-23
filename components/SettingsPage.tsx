
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from './ToastProvider';
import { Client } from '../types';
import { User, Building, Lock, UploadCloud, Save, Loader2, Camera, ShieldCheck, Mail, Phone, MapPin, Hash, Globe } from 'lucide-react';

interface SettingsPageProps {
  currentUser: Client;
  onProfileUpdate?: () => void;
}

const SettingsPage: React.FC<SettingsPageProps> = ({ currentUser, onProfileUpdate }) => {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'profile' | 'company' | 'security'>('profile');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form States
  const [formData, setFormData] = useState({
      full_name: '',
      email: '',
      phone: '',
      company_name: '',
      website: '',
      address: '',
      vat_number: '',
      current_password: '',
      new_password: '',
      confirm_password: ''
  });

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
      fetchProfile();
  }, [currentUser.id]);

  const fetchProfile = async () => {
      setIsLoading(true);
      try {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .single();

          if (error) throw error;

          if (data) {
              setFormData(prev => ({
                  ...prev,
                  full_name: data.full_name || '',
                  email: data.email || '',
                  phone: data.phone || '',
                  company_name: data.company_name || '',
                  website: data.logo_url || '', // On utilise logo_url comme site web pour l'instant
                  address: data.address || '',
                  vat_number: data.vat_number || ''
              }));
          }
      } catch (err) {
          console.error("Error fetching profile:", err);
          toast.error("Erreur", "Impossible de charger le profil.");
      } finally {
          setIsLoading(false);
      }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          setAvatarFile(file);
          // Preview local
          const reader = new FileReader();
          reader.onloadend = () => {
              setAvatarPreview(reader.result as string);
          };
          reader.readAsDataURL(file);
      }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSaving(true);

      try {
          // 1. Upload Avatar if changed (Not implemented fully in this snippet as it needs specific bucket setup, skipping for now or mocking)
          // For now, we focus on text fields update. Real avatar upload would require storage bucket "avatars" public policy.
          
          const updates = {
              full_name: formData.full_name,
              phone: formData.phone,
              updated_at: new Date().toISOString()
          };

          const { error } = await supabase.from('profiles').update(updates).eq('id', currentUser.id);
          if (error) throw error;

          toast.success("Succès", "Profil mis à jour.");
          if (onProfileUpdate) onProfileUpdate();

      } catch (err: any) {
          toast.error("Erreur", err.message);
      } finally {
          setIsSaving(false);
      }
  };

  const handleSaveCompany = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSaving(true);

      try {
          const updates = {
              company_name: formData.company_name,
              logo_url: formData.website, // Simplified logic: website url = logo source via logo.dev
              address: formData.address,
              vat_number: formData.vat_number,
              updated_at: new Date().toISOString()
          };

          const { error } = await supabase.from('profiles').update(updates).eq('id', currentUser.id);
          if (error) throw error;

          toast.success("Succès", "Informations entreprise mises à jour.");
          if (onProfileUpdate) onProfileUpdate();

      } catch (err: any) {
          toast.error("Erreur", err.message);
      } finally {
          setIsSaving(false);
      }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
      e.preventDefault();
      if (formData.new_password !== formData.confirm_password) {
          toast.error("Erreur", "Les mots de passe ne correspondent pas.");
          return;
      }
      if (formData.new_password.length < 6) {
          toast.error("Erreur", "Le mot de passe doit contenir au moins 6 caractères.");
          return;
      }

      setIsSaving(true);
      try {
          const { error } = await supabase.auth.updateUser({ password: formData.new_password });
          if (error) throw error;
          
          toast.success("Succès", "Mot de passe modifié.");
          setFormData(prev => ({ ...prev, current_password: '', new_password: '', confirm_password: '' }));
      } catch (err: any) {
          toast.error("Erreur", err.message);
      } finally {
          setIsSaving(false);
      }
  };

  if (isLoading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-indigo-600" size={32} /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in-up pb-10">
        
        <div>
            <h1 className="text-3xl font-extrabold text-slate-900">Paramètres du compte</h1>
            <p className="text-slate-500 mt-1">Gérez vos informations personnelles et préférences.</p>
        </div>

        <div className="flex flex-col md:flex-row gap-8">
            
            {/* SIDEBAR TABS */}
            <div className="w-full md:w-64 flex flex-col gap-2 shrink-0">
                <button 
                    onClick={() => setActiveTab('profile')}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'profile' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'}`}
                >
                    <User size={18} /> Mon Profil
                </button>
                <button 
                    onClick={() => setActiveTab('company')}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'company' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'}`}
                >
                    <Building size={18} /> Entreprise
                </button>
                <button 
                    onClick={() => setActiveTab('security')}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'security' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'}`}
                >
                    <ShieldCheck size={18} /> Sécurité
                </button>
            </div>

            {/* CONTENT AREA */}
            <div className="flex-1">
                
                {/* --- TAB: PROFILE --- */}
                {activeTab === 'profile' && (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 animate-fade-in">
                        <div className="flex items-center gap-6 mb-8">
                            <div className="relative group">
                                <div className="w-24 h-24 rounded-full bg-slate-100 border-4 border-white shadow-lg overflow-hidden flex items-center justify-center">
                                    {avatarPreview ? (
                                        <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="text-2xl font-bold text-slate-400">{currentUser.avatarInitials}</div>
                                    )}
                                </div>
                                <button 
                                    onClick={() => avatarInputRef.current?.click()}
                                    className="absolute bottom-0 right-0 p-2 bg-indigo-600 text-white rounded-full shadow-md hover:bg-indigo-700 transition-colors"
                                >
                                    <Camera size={16} />
                                </button>
                                <input type="file" ref={avatarInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-900">Photo de profil</h3>
                                <p className="text-sm text-slate-500">Formats acceptés : JPG, PNG. Max 2MB.</p>
                            </div>
                        </div>

                        <form onSubmit={handleSaveProfile} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Nom Complet</label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                        <input 
                                            type="text" 
                                            value={formData.full_name} 
                                            onChange={e => setFormData({...formData, full_name: e.target.value})}
                                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Téléphone</label>
                                    <div className="relative">
                                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                        <input 
                                            type="tel" 
                                            value={formData.phone} 
                                            onChange={e => setFormData({...formData, phone: e.target.value})}
                                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium"
                                            placeholder="+33 6..."
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Email (Non modifiable)</label>
                                <div className="relative opacity-70">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                    <input 
                                        type="email" 
                                        value={formData.email} 
                                        disabled
                                        className="w-full pl-10 pr-4 py-3 bg-slate-100 border border-slate-200 rounded-xl outline-none text-slate-500 cursor-not-allowed text-sm font-medium"
                                    />
                                </div>
                            </div>

                            <div className="pt-4 border-t border-slate-100 flex justify-end">
                                <button 
                                    type="submit" 
                                    disabled={isSaving}
                                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transition-all flex items-center gap-2 disabled:opacity-50"
                                >
                                    {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                                    Sauvegarder
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* --- TAB: COMPANY --- */}
                {activeTab === 'company' && (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 animate-fade-in">
                        <form onSubmit={handleSaveCompany} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Nom de la Société</label>
                                    <div className="relative">
                                        <Building className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                        <input 
                                            type="text" 
                                            value={formData.company_name} 
                                            onChange={e => setFormData({...formData, company_name: e.target.value})}
                                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Site Web (pour Logo)</label>
                                    <div className="relative">
                                        <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                        <input 
                                            type="text" 
                                            value={formData.website} 
                                            onChange={e => setFormData({...formData, website: e.target.value})}
                                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium"
                                            placeholder="https://..."
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Numéro de TVA</label>
                                <div className="relative">
                                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                    <input 
                                        type="text" 
                                        value={formData.vat_number} 
                                        onChange={e => setFormData({...formData, vat_number: e.target.value})}
                                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium"
                                        placeholder="FR..."
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Adresse de Facturation</label>
                                <div className="relative">
                                    <MapPin className="absolute left-3 top-4 text-slate-400" size={18} />
                                    <textarea 
                                        rows={3}
                                        value={formData.address} 
                                        onChange={e => setFormData({...formData, address: e.target.value})}
                                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium resize-none"
                                        placeholder="Adresse complète..."
                                    />
                                </div>
                            </div>

                            <div className="pt-4 border-t border-slate-100 flex justify-end">
                                <button 
                                    type="submit" 
                                    disabled={isSaving}
                                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transition-all flex items-center gap-2 disabled:opacity-50"
                                >
                                    {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                                    Enregistrer infos
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* --- TAB: SECURITY --- */}
                {activeTab === 'security' && (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 animate-fade-in">
                        <form onSubmit={handleUpdatePassword} className="space-y-6 max-w-md">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Nouveau mot de passe</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                    <input 
                                        type="password" 
                                        value={formData.new_password} 
                                        onChange={e => setFormData({...formData, new_password: e.target.value})}
                                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium"
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Confirmer le mot de passe</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                    <input 
                                        type="password" 
                                        value={formData.confirm_password} 
                                        onChange={e => setFormData({...formData, confirm_password: e.target.value})}
                                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium"
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>

                            <div className="pt-4 border-t border-slate-100">
                                <button 
                                    type="submit" 
                                    disabled={isSaving}
                                    className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
                                >
                                    {isSaving ? <Loader2 className="animate-spin" size={18} /> : <ShieldCheck size={18} />}
                                    Mettre à jour
                                </button>
                            </div>
                        </form>
                    </div>
                )}

            </div>
        </div>
    </div>
  );
};

export default SettingsPage;
