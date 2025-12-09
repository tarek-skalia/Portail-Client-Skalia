
import React, { useState, useEffect, useRef, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import GenericPage from './components/GenericPage';
import AutomationsList from './components/AutomationsList';
import SupportPage from './components/SupportPage';
import TicketsHistory from './components/TicketsHistory';
import InvoicesPage from './components/InvoicesPage';
import ExpensesPage from './components/ExpensesPage';
import ProjectsPipeline from './components/ProjectsPipeline';
import ProjectRoadmap from './components/ProjectRoadmap';
import LoginPage from './components/LoginPage';
import UpdatePasswordPage from './components/UpdatePasswordPage';
import BackgroundBlobs from './components/BackgroundBlobs'; 
import NotificationsPanel from './components/NotificationsPanel';
import GlobalListeners from './components/GlobalListeners';
import { MENU_ITEMS } from './constants';
import { ChevronRight, Bell } from 'lucide-react';
import { Client } from './types';
import { supabase } from './lib/supabase';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<Client | null>(null);
  const [activePage, setActivePage] = useState<string>('dashboard');
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isPasswordRecoveryMode, setIsPasswordRecoveryMode] = useState(false);
  
  // États pour notifications
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [notificationListTrigger, setNotificationListTrigger] = useState(0); 
  const notificationRef = useRef<HTMLDivElement>(null);
  
  const [highlightedProjectId, setHighlightedProjectId] = useState<string | null>(null);

  // Initialisation de l'auth Supabase
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchUserProfile(session.user.id, session.user.email || '');
      } else {
        setIsLoadingAuth(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("Auth Event:", event);
      
      // Détection de la récupération de mot de passe
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecoveryMode(true);
      }

      setSession(session);
      if (session) {
        fetchUserProfile(session.user.id, session.user.email || '');
      } else {
        // Déconnexion propre
        setCurrentUser(null);
        setIsAuthenticated(false);
        setIsLoadingAuth(false);
        setUnreadNotifications(0);
        setIsPasswordRecoveryMode(false); // Reset mode
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // SÉCURITÉ : Écouteur de suppression de compte
  useEffect(() => {
    if (!currentUser?.id) return;

    const channel = supabase
      .channel('force_logout_on_delete')
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${currentUser.id}`,
        },
        async () => {
          console.warn("Compte supprimé détecté. Déconnexion immédiate.");
          await supabase.auth.signOut();
          window.location.reload(); 
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser?.id]);

  // Fermer les notifications si on clique ailleurs
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [notificationRef]);

  // Chargement initial du compteur de notifications
  useEffect(() => {
    if (currentUser?.id) {
        fetchUnreadCount();
    }
  }, [currentUser]);

  const fetchUnreadCount = async () => {
     if (!currentUser) return;
     try {
         const { count, error } = await supabase
            .from('notifications')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', currentUser.id)
            .eq('is_read', false);
         
         if (!error) {
             setUnreadNotifications(count || 0);
         }
     } catch (e) {
         console.warn("Erreur fetch notifications count", e);
     }
  };

  const handleNewNotificationEvent = useCallback(() => {
      console.log("App: Mise à jour des notifications demandée.");
      fetchUnreadCount(); 
      setNotificationListTrigger(prev => prev + 1); 
  }, [currentUser]);

  const fetchUserProfile = async (userId: string, email: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.warn('Profil non trouvé, utilisation du défaut.');
        setCurrentUser({
            id: userId,
            name: 'Utilisateur',
            company: 'Ma Société',
            avatarInitials: 'U',
            email: email,
        });
      } else if (data) {
        setCurrentUser({
            id: data.id,
            name: data.full_name || 'Utilisateur',
            company: data.company_name || 'Ma Société',
            avatarInitials: data.avatar_initials || 'U',
            email: email,
            logoUrl: data.logo_url || undefined
        });
      }
      setIsAuthenticated(true);
    } catch (error: any) {
        console.warn("Erreur chargement profil", error.message);
        setCurrentUser({
            id: userId,
            name: 'Utilisateur',
            company: 'Connexion instable',
            avatarInitials: 'HF',
            email: email,
        });
        setIsAuthenticated(true);
    } finally {
        setIsLoadingAuth(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleNavigateToProject = (projectId: string) => {
    setHighlightedProjectId(projectId);
    setActivePage('projects');
    setTimeout(() => {
        setHighlightedProjectId(null);
    }, 3000);
  };

  const handleNotificationRead = () => {
      setUnreadNotifications(prev => Math.max(0, prev - 1));
  };

  const handleAllNotificationsRead = () => {
      setUnreadNotifications(0);
  };

  const handlePasswordUpdated = () => {
      setIsPasswordRecoveryMode(false);
      // L'utilisateur est déjà connecté, on le laisse accéder au dashboard
  };

  const getPageTitle = (id: string) => {
    return MENU_ITEMS.find(item => item.id === id)?.label || 'Skalia';
  };

  const renderContent = () => {
    const userId = currentUser?.id;

    switch (activePage) {
      case 'dashboard':
        return <Dashboard userId={userId} />;
      case 'automations':
        return <AutomationsList userId={userId} />;
      case 'projects':
        return (
            <ProjectsPipeline 
                userId={userId} 
                projects={[]} 
                highlightedProjectId={highlightedProjectId} 
            />
        );
      case 'roadmap':
        return (
            <ProjectRoadmap 
                userId={userId} 
                onProjectClick={handleNavigateToProject}
            />
        );
      case 'support':
        return currentUser ? <SupportPage currentUser={currentUser} /> : null;
      case 'history':
        return <TicketsHistory userId={userId} />;
      case 'invoices':
        return <InvoicesPage userId={userId} />;
      case 'expenses':
        return <ExpensesPage userId={userId} />;
      default:
        return <GenericPage title={getPageTitle(activePage)} />;
    }
  };

  if (isLoadingAuth) {
      return (
          <div className="h-screen w-full flex items-center justify-center bg-slate-900">
              <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
      );
  }

  // Cas spécial : Récupération de mot de passe
  if (isPasswordRecoveryMode) {
      return <UpdatePasswordPage onSuccess={handlePasswordUpdated} />;
  }

  if (!isAuthenticated || !currentUser) {
    return <LoginPage />;
  }

  return (
    <div className="flex h-screen w-full bg-slate-50/80 overflow-hidden font-sans text-slate-800 relative selection:bg-indigo-100 selection:text-indigo-700">
      
      <BackgroundBlobs />
      
      <GlobalListeners 
        userId={currentUser.id} 
        onNewNotification={handleNewNotificationEvent} 
      />

      <Sidebar 
        activePage={activePage} 
        setActivePage={setActivePage} 
        currentClient={currentUser}
        onLogout={handleLogout}
      />
      
      <main className="flex-1 flex flex-col h-full overflow-hidden relative z-10">
        <header className="h-16 bg-white/70 backdrop-blur-lg border-b border-white/40 flex items-center justify-between px-8 sticky top-0 z-20 shrink-0 shadow-sm">
          <div className="flex items-center text-sm text-slate-500 gap-2">
            <span>Portail client</span>
            <ChevronRight size={14} className="opacity-50" />
            <span className="font-semibold text-slate-900">{getPageTitle(activePage)}</span>
          </div>
          
          <div className="flex items-center gap-6">
            
            <div className="relative" ref={notificationRef}>
                <button 
                  onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                  className={`p-2 rounded-xl transition-all duration-300 relative ${isNotificationsOpen ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-white/50 text-slate-500 hover:text-indigo-600'}`}
                >
                    <Bell size={20} />
                    {unreadNotifications > 0 && (
                        <span className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full border-2 border-white shadow-sm animate-bounce">
                            {unreadNotifications > 9 ? '9+' : unreadNotifications}
                        </span>
                    )}
                </button>
                
                {isNotificationsOpen && (
                    <NotificationsPanel 
                      userId={currentUser.id} 
                      onClose={() => setIsNotificationsOpen(false)}
                      onNavigate={setActivePage}
                      onRead={handleNotificationRead}
                      onAllRead={handleAllNotificationsRead}
                      refreshTrigger={notificationListTrigger}
                    />
                )}
            </div>

            <div className="text-right hidden sm:block">
               <p className="text-xs font-bold text-slate-900">{currentUser.company}</p>
               <p className="text-xs text-slate-400 uppercase tracking-wider">ID: {currentUser.id.slice(0, 8)}...</p>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 scroll-smooth">
          <div className="max-w-7xl mx-auto w-full h-full">
            {renderContent()}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
