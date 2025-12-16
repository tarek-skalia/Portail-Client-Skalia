
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Client } from '../types';

interface AdminContextType {
  isAdmin: boolean;
  isAdminMode: boolean;
  toggleAdminMode: () => void;
  targetUserId: string;
  setTargetUserId: (id: string) => void;
  clients: Client[];
  loadingClients: boolean;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export const useAdmin = () => {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
};

interface AdminProviderProps {
  children: React.ReactNode;
  currentUser: Client | null;
}

export const AdminProvider: React.FC<AdminProviderProps> = ({ children, currentUser }) => {
  const [isAdmin, setIsAdmin] = useState(currentUser?.role === 'admin');
  const [isAdminMode, setIsAdminMode] = useState(currentUser?.role === 'admin');
  const [targetUserId, setTargetUserId] = useState<string>(currentUser?.id || '');
  
  const [clients, setClients] = useState<Client[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);

  // Initialisation et gestion des droits
  useEffect(() => {
    if (currentUser) {
        const isUserAdmin = currentUser.role === 'admin';
        setIsAdmin(isUserAdmin);
        
        // Initialisation de la cible si pas encore définie
        setTargetUserId(prev => prev || currentUser.id);

        if (isUserAdmin) {
            setIsAdminMode(true);
        }
    }
  }, [currentUser]);

  // Chargement des données Clients (Admin Only) avec Realtime
  useEffect(() => {
      if (currentUser?.role === 'admin') {
          fetchClients();

          // Souscription aux changements pour mise à jour immédiate (ex: changement de logo)
          const channel = supabase.channel('admin_clients_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
                fetchClients();
            })
            .subscribe();

          return () => { supabase.removeChannel(channel); };
      }
  }, [currentUser]);

  const fetchClients = async () => {
      setLoadingClients(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('company_name', { ascending: true });
      
      if (!error && data) {
          const mappedClients: Client[] = data.map((p: any) => ({
              id: p.id,
              name: p.full_name || 'Inconnu',
              company: p.company_name || 'Sans société',
              avatarInitials: p.avatar_initials || '?',
              email: p.email || '',
              role: p.role,
              logoUrl: p.logo_url // Récupération vitale pour l'affichage du logo
          }));
          setClients(mappedClients);
      }
      setLoadingClients(false);
  };

  const toggleAdminMode = () => setIsAdminMode(prev => !prev);

  return (
    <AdminContext.Provider value={{
      isAdmin,
      isAdminMode,
      toggleAdminMode,
      targetUserId,
      setTargetUserId,
      clients,
      loadingClients
    }}>
      {children}
    </AdminContext.Provider>
  );
};
