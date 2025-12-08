
import React, { useState, useEffect, useRef } from 'react';
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
import BackgroundBlobs from './components/BackgroundBlobs'; 
import NotificationsPanel from './components/NotificationsPanel';
import { MENU_ITEMS } from './constants';
import { MoreHorizontal, ChevronRight, Bell } from 'lucide-react';
import { Client } from './types';
import { supabase } from './lib/supabase';
// import { useToast } from './components/ToastProvider'; // Toast n'est plus utilisé ici

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<Client | null>(null);
  const [activePage, setActivePage] = useState<string>('dashboard');
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  
  // États pour notifications
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const notificationRef = useRef<HTMLDivElement>(null);
  
  // État pour gérer la navigation depuis la Roadmap vers le Pipeline avec focus
  const [highlightedProjectId, setHighlightedProjectId] = useState<string | null>(null);

  // const toast = useToast(); // Désactivé pour les notifs globales

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
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchUserProfile(session.user.id, session.user.email || '');
      } else {
        setCurrentUser(null);
        setIsAuthenticated(false);
        setIsLoadingAuth(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

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

  // Gestion Globale des Notifications (Compteur UNIQUEMENT)
  useEffect(() => {
    if (currentUser?.id) {
        // 1. Initialiser le compteur
        fetchUnreadCount();

        // 2. Écouter les nouvelles notifications pour mettre à jour le compteur (SILENCIEUX)
        const channel = supabase
            .channel(`app-counter-${currentUser.id}`) 
            .on(
                'postgres_changes', 
                { 
                    event: 'INSERT', 
                    schema: 'public', 
                    table: 'notifications',
                }, 
                (payload) => {
                    const newNotif = payload.new as any;
                    
                    // Filtrage Client-Side
                    if (newNotif.user_id === currentUser.id) {
                        // Mise à jour du compteur uniquement, pas de toast
                        setUnreadNotifications(prev => prev + 1);
                    }
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
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
         console.warn("Impossible de récupérer les notifications (Mode hors ligne)");
     }
  };

  const fetchUserProfile = async (userId: string, email: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.warn('Profil non trouvé ou erreur Supabase, utilisation du profil par défaut.');
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
        console.warn("Mode hors ligne activé ou erreur réseau:", error.message);
        setCurrentUser({
            id: userId,
            name: 'Utilisateur (Hors ligne)',
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

  if (!isAuthenticated || !currentUser) {
    return <LoginPage />;
  }

  return (
    <div className="flex h-screen w-full bg-slate-50/80 overflow-hidden font-sans text-slate-800 relative selection:bg-indigo-100 selection:text-indigo-700">
      
      <BackgroundBlobs />

      <Sidebar 
        activePage={activePage} 
        setActivePage={setActivePage} 
        currentClient={currentUser}
        onLogout={handleLogout}
      />
      
      <main className="flex-1 flex flex-col h-full overflow-hidden relative z-10">
        {/* Top Header */}
        <header className="h-16 bg-white/70 backdrop-blur-lg border-b border-white/40 flex items-center justify-between px-8 sticky top-0 z-20 shrink-0 shadow-sm">
          <div className="flex items-center text-sm text-slate-500 gap-2">
            <span>Portail client</span>
            <ChevronRight size={14} className="opacity-50" />
            <span className="font-semibold text-slate-900">{getPageTitle(activePage)}</span>
          </div>
          
          <div className="flex items-center gap-6">
            
            {/* Notifications Center */}
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
                    />
                )}
            </div>

            <div className="text-right hidden sm:block">
               <p className="text-xs font-bold text-slate-900">{currentUser.company}</p>
               <p className="text-xs text-slate-400 uppercase tracking-wider">ID: {currentUser.id.slice(0, 8)}...</p>
            </div>
            
            <button className="p-2 hover:bg-white/50 rounded-lg text-slate-500 transition-colors">
                <MoreHorizontal size={20} />
            </button>
          </div>
        </header>

        {/* Content Area */}
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
