
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
import AdminToolbar from './components/AdminToolbar';
import { AdminProvider, useAdmin } from './components/AdminContext';
import { MENU_ITEMS } from './constants';
import { ChevronRight, Bell } from 'lucide-react';
import { Client } from './types';
import { supabase } from './lib/supabase';

// Composant Interne: Contenu principal après Auth
const AppContent: React.FC<{ 
    currentUser: Client;
    handleLogout: () => void;
}> = ({ currentUser, handleLogout }) => {
    
    const { targetUserId, clients } = useAdmin();
    
    // Fallback de sécurité : Si targetUserId est vide (non initialisé), on utilise l'ID courant
    const effectiveUserId = targetUserId || currentUser.id;
    
    // Trouver le client cible pour l'affichage (Sidebar, Header)
    // Si la liste clients n'est pas encore chargée, on fallback sur currentUser
    const targetClient = clients.find(c => c.id === effectiveUserId) || currentUser;

    const [activePage, setActivePage] = useState<string>(() => {
        return localStorage.getItem('skalia_last_page') || 'dashboard';
    });

    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
    const [unreadNotifications, setUnreadNotifications] = useState(0);
    const [notificationListTrigger, setNotificationListTrigger] = useState(0);
    const notificationRef = useRef<HTMLDivElement>(null);
    
    // Navigation inter-pages
    const [highlightedProjectId, setHighlightedProjectId] = useState<string | null>(null);
    const [supportPreFill, setSupportPreFill] = useState<{subject: string, description: string} | null>(null);
    const [autoOpenTicketId, setAutoOpenTicketId] = useState<string | null>(null);

    useEffect(() => {
        localStorage.setItem('skalia_last_page', activePage);
    }, [activePage]);

    // Click Outside Notification Panel
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
          if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
            setIsNotificationsOpen(false);
          }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [notificationRef]);

    useEffect(() => {
        if (effectiveUserId) fetchUnreadCount();
    }, [effectiveUserId]);

    const fetchUnreadCount = async () => {
         if (!effectiveUserId) return;
         try {
             const { count, error } = await supabase
                .from('notifications')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', effectiveUserId)
                .eq('is_read', false);
             if (!error) setUnreadNotifications(count || 0);
         } catch (e) { console.warn("Erreur fetch notif count", e); }
    };

    const handleNewNotificationEvent = useCallback(() => {
        fetchUnreadCount(); 
        setNotificationListTrigger(prev => prev + 1); 
    }, [effectiveUserId]);

    const handleNotificationRead = () => setUnreadNotifications(prev => Math.max(0, prev - 1));
    const handleAllNotificationsRead = () => setUnreadNotifications(0);

    const handleNavigateToProject = (projectId: string) => {
        setHighlightedProjectId(projectId);
        setActivePage('projects');
        setTimeout(() => setHighlightedProjectId(null), 3000);
    };
      
    const handleNavigateToSupport = (subject: string, description: string) => {
        setSupportPreFill({ subject, description });
        setActivePage('support');
    };
    
    const handleConsumeSupportData = () => {
        setSupportPreFill(null);
    };
    
    const handleTicketCreated = (ticketId: string) => {
        setAutoOpenTicketId(ticketId);
        setActivePage('history');
        setTimeout(() => setAutoOpenTicketId(null), 2000);
    };

    const getPageTitle = (id: string) => MENU_ITEMS.find(item => item.id === id)?.label || 'Skalia';

    const renderContent = () => {
        const userIdToUse = effectiveUserId;

        switch (activePage) {
          case 'dashboard': return <Dashboard userId={userIdToUse} onNavigate={setActivePage} onNavigateToSupport={handleNavigateToSupport} />;
          case 'automations': return <AutomationsList userId={userIdToUse} onNavigateToSupport={handleNavigateToSupport} />;
          case 'projects': return <ProjectsPipeline userId={userIdToUse} projects={[]} highlightedProjectId={highlightedProjectId} onNavigateToSupport={handleNavigateToSupport} />;
          case 'roadmap': return <ProjectRoadmap userId={userIdToUse} onProjectClick={handleNavigateToProject} />;
          case 'support': return <SupportPage currentUser={targetClient} initialData={supportPreFill} onConsumeData={handleConsumeSupportData} onTicketCreated={handleTicketCreated} />;
          case 'history': return <TicketsHistory userId={userIdToUse} initialTicketId={autoOpenTicketId} />;
          case 'invoices': return <InvoicesPage userId={userIdToUse} />;
          case 'expenses': return <ExpensesPage userId={userIdToUse} />;
          default: return <GenericPage title={getPageTitle(activePage)} />;
        }
    };

    return (
        <div className="flex h-screen w-full bg-slate-50/80 overflow-hidden font-sans text-slate-800 relative selection:bg-indigo-100 selection:text-indigo-700">
            <BackgroundBlobs />
            <GlobalListeners userId={effectiveUserId} onNewNotification={handleNewNotificationEvent} />
            
            <Sidebar activePage={activePage} setActivePage={setActivePage} currentClient={targetClient} onLogout={handleLogout} />
            
            <main className="flex-1 flex flex-col h-full overflow-hidden relative z-10">
                <AdminToolbar />

                <header className="h-16 bg-white/70 backdrop-blur-lg border-b border-white/40 flex items-center justify-between px-8 sticky top-0 z-20 shrink-0 shadow-sm">
                    <div className="flex items-center text-sm text-slate-500 gap-2">
                        <span>Portail client</span><ChevronRight size={14} className="opacity-50" /><span className="font-semibold text-slate-900">{getPageTitle(activePage)}</span>
                    </div>
                    <div className="flex items-center gap-6">
                        <div className="relative" ref={notificationRef}>
                            <button onClick={() => setIsNotificationsOpen(!isNotificationsOpen)} className={`p-2 rounded-xl transition-all duration-300 relative ${isNotificationsOpen ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-white/50 text-slate-500 hover:text-indigo-600'}`}>
                                <Bell size={20} />
                                {unreadNotifications > 0 && <span className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full border-2 border-white shadow-sm animate-bounce">{unreadNotifications > 9 ? '9+' : unreadNotifications}</span>}
                            </button>
                            {isNotificationsOpen && <NotificationsPanel userId={effectiveUserId} onClose={() => setIsNotificationsOpen(false)} onNavigate={setActivePage} onRead={handleNotificationRead} onAllRead={handleAllNotificationsRead} refreshTrigger={notificationListTrigger} />}
                        </div>
                        <div className="text-right hidden sm:block">
                            <p className="text-xs font-bold text-slate-900">{targetClient.company}</p>
                            <p className="text-xs text-slate-400 uppercase tracking-wider">ID: {targetClient.id.slice(0, 8)}...</p>
                        </div>
                    </div>
                </header>
                <div className="flex-1 overflow-y-auto p-8 scroll-smooth"><div className="max-w-7xl mx-auto w-full h-full">{renderContent()}</div></div>
            </main>
        </div>
    );
}

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<Client | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isPasswordRecoveryMode, setIsPasswordRecoveryMode] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        fetchUserProfile(session.user.id, session.user.email || '');
      } else {
        setIsLoadingAuth(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setIsPasswordRecoveryMode(true);
      if (session) {
        fetchUserProfile(session.user.id, session.user.email || '');
      } else {
        setCurrentUser(null);
        setIsAuthenticated(false);
        setIsLoadingAuth(false);
        setIsPasswordRecoveryMode(false);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const fetchUserProfile = async (userId: string, email: string) => {
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
      
      if (error) {
          console.error("Erreur fetch profil (RLS possible) :", error);
          throw error;
      }

      if (data) {
        setCurrentUser({
            id: data.id,
            name: data.full_name || 'Utilisateur',
            company: data.company_name || 'Ma Société',
            avatarInitials: data.avatar_initials || 'U',
            email: email,
            logoUrl: data.logo_url || undefined,
            role: data.role
        });
      }
      setIsAuthenticated(true);
    } catch (error: any) {
        // Fallback profile safe
        setCurrentUser({ 
            id: userId, 
            name: 'Utilisateur', 
            company: 'Ma Société', 
            avatarInitials: 'U', 
            email: email, 
            role: 'client' 
        });
        setIsAuthenticated(true);
    } finally {
        setIsLoadingAuth(false);
    }
  };

  const handleLogout = async () => { await supabase.auth.signOut(); };
  const handlePasswordUpdated = () => setIsPasswordRecoveryMode(false);

  if (isLoadingAuth) return <div className="h-screen w-full flex items-center justify-center bg-slate-900"><div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div></div>;
  if (isPasswordRecoveryMode) return <UpdatePasswordPage onSuccess={handlePasswordUpdated} />;
  
  // Protection: Si pas authentifié ou pas de user, login
  if (!isAuthenticated || !currentUser) return <LoginPage />;

  return (
      <AdminProvider currentUser={currentUser}>
          <AppContent 
              currentUser={currentUser} 
              handleLogout={handleLogout} 
          />
      </AdminProvider>
  );
};

export default App;
