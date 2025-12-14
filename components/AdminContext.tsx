
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
  // CORRECTION : On initialise directement avec l'ID du user, on n'attend pas le useEffect
  const [isAdmin, setIsAdmin] = useState(currentUser?.role === 'admin');
  const [isAdminMode, setIsAdminMode] = useState(currentUser?.role === 'admin');
  const [targetUserId, setTargetUserId] = useState<string>(currentUser?.id || '');
  
  const [clients, setClients] = useState<Client[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);

  // Synchronisation si currentUser change (ex: rechargement de session)
  useEffect(() => {
    if (currentUser) {
        const isUserAdmin = currentUser.role === 'admin';
        setIsAdmin(isUserAdmin);
        
        // Si on n'a pas encore de cible définie, on met l'utilisateur courant
        setTargetUserId(prev => prev || currentUser.id);

        if (isUserAdmin) {
            setIsAdminMode(true);
            fetchClients();
        }
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
              role: p.role
          }));
          setClients(mappedClients);
      }
      setLoadingClients(false);
  };

  const toggleAdminMode = () => setIsAdminMode(!isAdminMode);

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
