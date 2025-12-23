
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
import GlobalProjects from './components/GlobalProjects';
import GlobalFinance from './components/GlobalFinance';
import GlobalAutomations from './components/GlobalAutomations';
import GlobalExpenses from './components/GlobalExpenses';
import GlobalQuotes from './components/GlobalQuotes';
import CRMPage from './components/CRMPage'; 
import TasksPage from './components/TasksPage'; 
import UserManagement from './components/UserManagement';
import QuotesPage from './components/QuotesPage';
import OnboardingPage from './components/OnboardingPage';
import SettingsPage from './components/SettingsPage'; // NEW
import LoginPage from './components/LoginPage';
import UpdatePasswordPage from './components/UpdatePasswordPage';
import BackgroundBlobs from './components/BackgroundBlobs'; 
import NotificationsPanel from './components/NotificationsPanel';
import GlobalListeners from './components/GlobalListeners';
import Logo from './components/Logo';
import { AdminProvider, useAdmin } from './components/AdminContext';
import { MENU_ITEMS, ADMIN_MENU_ITEMS } from './constants';
import { ChevronRight, Bell, Monitor, ArrowRight, Home, LayoutGrid } from 'lucide-react';
import { Client } from './types';
import { supabase } from './lib/supabase';
import PublicQuoteView from './components/PublicQuoteView';

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
    userProfile: any; 
    refreshProfile: () => void;
}> = ({ currentUser, handleLogout, userProfile, refreshProfile }) => {
    
    const { targetUserId, clients, isAdmin } = useAdmin();
    
    // Détermination : sommes-nous en vue Client ou ERP ?
    const effectiveUserId = targetUserId || currentUser.id;
    const targetClient = clients.find(c => c.id === effectiveUserId) || currentUser;
    const isViewingAsClient = isAdmin && targetClient.role !== 'admin';

    // ONBOARDING CHECK
    // Si c'est un client, et que son onboarding_step est défini et inférieur à 3 (Booking fait), on affiche l'onboarding
    const isOnboarding = !isAdmin && userProfile?.onboarding_step !== null && (userProfile?.onboarding_step || 0) < 3;

    // Page par défaut différente selon le mode
    const [activePage, setActivePage] = useState<string>(() => {
        return isAdmin ? 'global_view' : 'dashboard';
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

    // Reset page quand on change de contexte (ERP <-> Client)
    useEffect(() => {
        if (isViewingAsClient) {
            // Si on bascule sur un client, on va sur son Dashboard
            if (activePage.startsWith('global_') || activePage === 'users' || activePage === 'crm') setActivePage('dashboard');
        } else if (isAdmin) {
            // Si on revient en ERP, on va sur la Global View
            if (!activePage.startsWith('global_') && activePage !== 'crm' && activePage !== 'users') {
                setActivePage('global_view');
            }
        }
    }, [targetUserId, isAdmin]);

    useEffect(() => {
        const handleResize = () => {
            setIsSmallScreen(window.innerWidth < 768);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

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
        if (id === 'settings') return 'Mon Compte'; // NEW
        const cleanId = id.split(':')[0];
        const item = [...MENU_ITEMS, ...ADMIN_MENU_ITEMS].find(i => i.id === cleanId);
        return item?.label || 'Skalia';
    };

    const renderContent = () => {
        const userIdToUse = effectiveUserId;

        // ROUTAGE ERP
        if (!isViewingAsClient && isAdmin) {
            switch (activePage) {
                case 'global_view': return <GlobalDashboard initialTicketId={autoOpenTicketId} />;
                case 'global_quotes': return <GlobalQuotes />; 
                case 'global_projects': return <GlobalProjects />;
                case 'global_tasks': return <TasksPage />;
                case 'global_finance': return <GlobalFinance />;
                case 'global_automations': return <GlobalAutomations />;
                case 'global_expenses': return <GlobalExpenses />;
                case 'crm': return <CRMPage />;
                case 'users': return <UserManagement />;
                case 'settings': return <SettingsPage currentUser={targetClient} onProfileUpdate={refreshProfile} />; // Allow admin to see their settings
                default: return <GlobalDashboard />;
            }
        }

        // ROUTAGE CLIENT
        switch (activePage) {
          case 'dashboard': return <Dashboard userId={userIdToUse} onNavigate={setActivePage} onNavigateToSupport={handleNavigateToSupport} />;
          case 'quotes': return <QuotesPage userId={userIdToUse} />;
          case 'automations': return <AutomationsList userId={userIdToUse} onNavigateToSupport={handleNavigateToSupport} />;
          case 'projects': return <ProjectsPipeline userId={userIdToUse} projects={[]} highlightedProjectId={highlightedProjectId} onNavigateToSupport={handleNavigateToSupport} />;
          case 'roadmap': return <ProjectRoadmap userId={userIdToUse} onProjectClick={handleNavigateToProject} />;
          case 'support': return <SupportPage currentUser={targetClient} initialData={supportPreFill} onConsumeData={handleConsumeSupportData} onTicketCreated={handleTicketCreated} />;
          case 'history': return <TicketsHistory userId={userIdToUse} initialTicketId={autoOpenTicketId} />;
          case 'invoices': return <InvoicesPage userId={userIdToUse} />;
          case 'expenses': return <ExpensesPage userId={userIdToUse} />;
          case 'settings': return <SettingsPage currentUser={targetClient} onProfileUpdate={refreshProfile} />; // NEW
          default: return <GenericPage title={getPageTitle(activePage)} />;
        }
    };

    if (isSmallScreen && !bypassBlocker) {
        return <MobileBlocker onBypass={() => setBypassBlocker(true)} />;
    }

    // --- ONBOARDING INTERCEPT ---
    if (isOnboarding) {
        return <OnboardingPage currentUser={currentUser} onComplete={refreshProfile} />;
    }

    return (
        <div className="flex h-screen w-full bg-slate-50/80 overflow-hidden font-sans text-slate-800 relative selection:bg-indigo-100 selection:text-indigo-700">
            <BackgroundBlobs />
            <GlobalListeners userId={effectiveUserId} onNewNotification={handleNewNotificationEvent} />
            
            <Sidebar activePage={activePage.split(':')[0]} setActivePage={setActivePage} currentClient={targetClient} onLogout={handleLogout} />
            
            <main className="flex-1 flex flex-col h-full overflow-hidden relative z-10">
                <header className="h-16 bg-white/70 backdrop-blur-lg border-b border-white/40 flex items-center justify-between px-8 sticky top-0 z-20 shrink-0 shadow-sm transition-all">
                    <div className="flex items-center text-sm text-slate-500 gap-2">
                        {isViewingAsClient ? (
                            <span className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-indigo-50 text-indigo-700 font-bold"><Monitor size={14} /> Vue Client</span>
                        ) : (
                            <span className="flex items-center gap-1.5 font-bold text-slate-900"><LayoutGrid size={16} className="text-slate-900" /> ERP Skalia</span>
                        )}
                        <ChevronRight size={14} className="opacity-50" />
                        <span className="font-semibold text-slate-900">{getPageTitle(activePage)}</span>
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
  const [fullUserProfile, setFullUserProfile] = useState<any>(null); // To store DB fields like onboarding_step
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isPasswordRecoveryMode, setIsPasswordRecoveryMode] = useState(false);
  
  // Public Route State
  const [publicQuoteId, setPublicQuoteId] = useState<string | null>(null);

  useEffect(() => {
    // --- 0. CHECK PUBLIC ROUTE (MANUAL ROUTING) ---
    const path = window.location.pathname;
    if (path.startsWith('/p/quote/')) {
        const quoteId = path.split('/p/quote/')[1];
        if (quoteId) {
            setPublicQuoteId(quoteId);
            setIsLoadingAuth(false);
            return; // STOP ICI, on ne vérifie pas l'auth
        }
    }

    // 1. Initialisation de la session (Si pas de route publique)
    const initSession = async () => {
        try {
            const { data: { session }, error } = await supabase.auth.getSession();
            if (error) throw error;

            if (session) {
                fetchUserProfile(session.user.id, session.user.email || '');
            } else {
                setIsLoadingAuth(false);
            }
        } catch (error) {
            console.warn("Session Init Error:", error);
            await supabase.auth.signOut();
            setIsLoadingAuth(false);
        }
    };

    initSession();

    // 2. Écouteur d'état
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') setIsPasswordRecoveryMode(true);
      if (event === 'SIGNED_IN') localStorage.removeItem('skalia_last_page');
      
      // FIX: Cast explicite car TOKEN_REFRESH_REVOKED peut ne pas être dans les types installés
      if (event === ('TOKEN_REFRESH_REVOKED' as any)) {
          await supabase.auth.signOut();
          setIsAuthenticated(false);
          setCurrentUser(null);
          setFullUserProfile(null);
          setIsLoadingAuth(false);
          return;
      }

      if (session) {
        if (!currentUser || currentUser.id !== session.user.id) {
            fetchUserProfile(session.user.id, session.user.email || '');
        }
      } else {
        setCurrentUser(null);
        setFullUserProfile(null);
        setIsAuthenticated(false);
        setIsLoadingAuth(false);
        setIsPasswordRecoveryMode(false);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const fetchUserProfile = async (userId: string, email: string, retryCount = 0) => {
    try {
      // TENTATIVE 1 : Récupération standard
      let { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
      
      // TENTATIVE 2 : SELF-HEALING (Auto-réparation)
      if (error && error.code === 'PGRST116') {
          console.warn("⚠️ Profil manquant détecté. Tentative de restauration automatique...");
          const { data: newProfile, error: createError } = await supabase.from('profiles').insert({
              id: userId,
              email: email,
              full_name: 'Utilisateur Récupéré', 
              company_name: 'À renseigner',      
              avatar_initials: '?',
              role: 'client',
              updated_at: new Date().toISOString()
          }).select().single();

          if (createError) throw createError;
          data = newProfile;
          error = null;
      }

      if (error) throw error;

      if (data) {
        setFullUserProfile(data); // Store DB profile for onboarding check
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
        console.error("Erreur critique fetchUserProfile:", JSON.stringify(error, null, 2));
        
        if (retryCount < 3 && (error?.message?.includes('Failed to fetch') || error?.message?.includes('NetworkError'))) {
            console.log(`Tentative de reconnexion au serveur (${retryCount + 1}/3)...`);
            setTimeout(() => {
                fetchUserProfile(userId, email, retryCount + 1);
            }, 1000 * (retryCount + 1)); 
            return; 
        }

        // Mode Secours
        const isEmergencyAdmin = email === 'tarek@skalia.io' || email === 'zakaria@skalia.io';
        const companyName = isEmergencyAdmin ? 'Skalia Agency' : 'Mode Secours';
        const role = isEmergencyAdmin ? 'admin' : 'client';

        setCurrentUser({ 
            id: userId, 
            name: isEmergencyAdmin ? 'Admin' : 'Utilisateur', 
            company: companyName, 
            avatarInitials: isEmergencyAdmin ? 'AD' : '!', 
            email: email, 
            role: role
        });
        setIsAuthenticated(true);
    } finally {
        if (retryCount >= 3 || (!isLoadingAuth && retryCount === 0)) {
             setIsLoadingAuth(false);
        }
    }
  };

  const handleLogout = async () => { 
      localStorage.removeItem('skalia_last_page');
      await supabase.auth.signOut(); 
  };
  const handlePasswordUpdated = () => setIsPasswordRecoveryMode(false);

  // --- RENDER ---

  // 1. Loading global
  if (isLoadingAuth) return <div className="h-screen w-full flex items-center justify-center bg-slate-900"><div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div></div>;
  
  // 2. Route Publique (Devis) - PRIORITAIRE
  if (publicQuoteId) return <PublicQuoteView quoteId={publicQuoteId} />;

  // 3. Password Recovery
  if (isPasswordRecoveryMode) return <UpdatePasswordPage onSuccess={handlePasswordUpdated} />;
  
  // 4. Login (Si pas auth et pas de route publique)
  if (!isAuthenticated || !currentUser) return <LoginPage />;

  // 5. Main App
  return (
      <AdminProvider currentUser={currentUser}>
          <AppContent 
              currentUser={currentUser} 
              userProfile={fullUserProfile}
              refreshProfile={() => fetchUserProfile(currentUser.id, currentUser.email)}
              handleLogout={handleLogout} 
          />
      </AdminProvider>
  );
};

export default App;
