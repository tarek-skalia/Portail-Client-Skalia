
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
import GlobalDashboard from './components/GlobalDashboard';
import UserManagement from './components/UserManagement';
import LoginPage from './components/LoginPage';
import UpdatePasswordPage from './components/UpdatePasswordPage';
import BackgroundBlobs from './components/BackgroundBlobs'; 
import NotificationsPanel from './components/NotificationsPanel';
import GlobalListeners from './components/GlobalListeners';
import AdminToolbar from './components/AdminToolbar';
import Logo from './components/Logo';
import { AdminProvider, useAdmin } from './components/AdminContext';
import { MENU_ITEMS, ADMIN_MENU_ITEMS } from './constants';
import { ChevronRight, Bell, Monitor, ArrowRight } from 'lucide-react';
import { Client } from './types';
import { supabase } from './lib/supabase';

// --- COMPOSANT : ÉCRAN DE BLOCAGE MOBILE ---
const MobileBlocker: React.FC<{ onBypass: () => void }> = ({ onBypass }) => {
    return (
        <div className="flex flex-col h-screen w-full items-center justify-center p-8 bg-slate-950 text-white text-center relative overflow-hidden z-[500]">
            {/* Background Decor */}
            <div className="absolute top-[-10%] left-[-10%] w-[300px] h-[300px] bg-indigo-600/20 rounded-full blur-[100px] animate-float"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[300px] h-[300px] bg-purple-600/20 rounded-full blur-[100px] animate-float-delayed"></div>
            
            <div className="relative z-10 animate-fade-in-up flex flex-col items-center">
                <div className="mb-12 bg-white/5 p-6 rounded-3xl border border-white/10 backdrop-blur-md shadow-2xl">
                    <Logo className="w-16 h-16" classNameText="text-3xl tracking-widest font-bold" showText={true} />
                </div>
                
                <div className="w-20 h-20 bg-indigo-600/20 rounded-2xl flex items-center justify-center mb-8 border border-indigo-500/30 text-indigo-400">
                    <Monitor size={40} strokeWidth={1.5} />
                </div>
                
                <h1 className="text-2xl font-extrabold mb-4 tracking-tight">Version Desktop Requise</h1>
                
                <p className="text-slate-400 text-sm leading-relaxed max-w-[280px] mb-10 font-medium">
                    Le portail <span className="text-indigo-400 font-bold">SKALIA</span> est un outil d'analyse haute résolution optimisé pour les écrans larges.
                </p>
                
                <div className="flex flex-col gap-4 w-full max-w-[240px]">
                    <div className="bg-white/5 border border-white/5 rounded-2xl px-6 py-4 backdrop-blur-sm">
                        <p className="text-[10px] text-indigo-300 font-bold uppercase tracking-widest">
                            Accès restreint aux ordinateurs
                        </p>
                    </div>
                    
                    <button 
                        onClick={onBypass}
                        className="text-xs font-bold text-slate-500 hover:text-white transition-colors flex items-center justify-center gap-2 group"
                    >
                        Accéder quand même <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                </div>
                
                <p className="mt-12 text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                    © {new Date().getFullYear()} SKALIA AGENCY
                </p>
            </div>
        </div>
    );
};

// Composant Interne: Contenu principal après Auth
const AppContent: React.FC<{ 
    currentUser: Client;
    handleLogout: () => void;
}> = ({ currentUser, handleLogout }) => {
    
    const { targetUserId, clients, isAdmin } = useAdmin();
    
    const effectiveUserId = targetUserId || currentUser.id;
    const targetClient = clients.find(c => c.id === effectiveUserId) || currentUser;

    const [activePage, setActivePage] = useState<string>(() => {
        return localStorage.getItem('skalia_last_page') || 'dashboard';
    });

    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
    const [unreadNotifications, setUnreadNotifications] = useState(0);
    const [notificationListTrigger, setNotificationListTrigger] = useState(0);
    const notificationRef = useRef<HTMLDivElement>(null);
    
    const [highlightedProjectId, setHighlightedProjectId] = useState<string | null>(null);
    const [supportPreFill, setSupportPreFill] = useState<{subject: string, description: string} | null>(null);
    const [autoOpenTicketId, setAutoOpenTicketId] = useState<string | null>(null);

    // --- LOGIQUE DE DÉTECTION TAILLE ÉCRAN ---
    const [isSmallScreen, setIsSmallScreen] = useState(window.innerWidth < 768);
    const [bypassBlocker, setBypassBlocker] = useState(false);

    useEffect(() => {
        const handleResize = () => {
            setIsSmallScreen(window.innerWidth < 768);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (activePage && !activePage.includes(':')) {
            localStorage.setItem('skalia_last_page', activePage);
        }
    }, [activePage]);

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

    const handleNavigationFromNotification = (link: string) => {
        if (!link) return;
        if (link.includes(':')) {
            const [page, id] = link.split(':');
            setAutoOpenTicketId(id);
            setActivePage(page);
            setTimeout(() => setAutoOpenTicketId(null), 3000);
        } else {
            setActivePage(link);
        }
        setIsNotificationsOpen(false);
    };

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

    const getPageTitle = (id: string) => {
        const cleanId = id.split(':')[0];
        const item = [...MENU_ITEMS, ...ADMIN_MENU_ITEMS].find(i => i.id === cleanId);
        return item?.label || 'Skalia';
    };

    const renderContent = () => {
        const userIdToUse = effectiveUserId;
        if (isAdmin) {
            if (activePage === 'global_view') return <GlobalDashboard initialTicketId={autoOpenTicketId} />;
            if (activePage === 'users') return <UserManagement />;
        }

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

    // --- CONDITION D'AFFICHAGE DU BLOCAGE ---
    if (isSmallScreen && !bypassBlocker) {
        return <MobileBlocker onBypass={() => setBypassBlocker(true)} />;
    }

    return (
        <div className="flex h-screen w-full bg-slate-50/80 overflow-hidden font-sans text-slate-800 relative selection:bg-indigo-100 selection:text-indigo-700">
            <BackgroundBlobs />
            <GlobalListeners userId={effectiveUserId} onNewNotification={handleNewNotificationEvent} />
            
            <Sidebar activePage={activePage.split(':')[0]} setActivePage={setActivePage} currentClient={targetClient} onLogout={handleLogout} />
            
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
                            {isNotificationsOpen && <NotificationsPanel userId={effectiveUserId} onClose={() => setIsNotificationsOpen(false)} onNavigate={handleNavigationFromNotification} onRead={handleNotificationRead} onAllRead={handleAllNotificationsRead} refreshTrigger={notificationListTrigger} />}
                        </div>
                        <div className="text-right hidden sm:block">
                            <p className="text-xs font-bold text-slate-900">{targetClient.company}</p>
                            <p className="text-xs text-slate-400 uppercase tracking-wider">ID: {targetClient.id.slice(0, 8)}...</p>
                        </div>
                    </div>
                </header>
                <div className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth"><div className="max-w-7xl mx-auto w-full h-full">{renderContent()}</div></div>
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
      
      if (event === 'SIGNED_IN') {
          localStorage.removeItem('skalia_last_page');
      }

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
          console.warn("Connexion profil (Info):", error.message);
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

  const handleLogout = async () => { 
      localStorage.removeItem('skalia_last_page');
      await supabase.auth.signOut(); 
  };
  const handlePasswordUpdated = () => setIsPasswordRecoveryMode(false);

  if (isLoadingAuth) return <div className="h-screen w-full flex items-center justify-center bg-slate-900"><div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div></div>;
  if (isPasswordRecoveryMode) return <UpdatePasswordPage onSuccess={handlePasswordUpdated} />;
  
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
