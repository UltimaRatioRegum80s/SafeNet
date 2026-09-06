import { Switch, Route, useLocation, Redirect } from "wouter";
import { RoutePaths } from "./router/routePaths";
import { useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { ToastAction } from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";
import StatusHUD from "@/components/StatusHUD";
import { onUpdateAvailable } from "@/lib/serviceWorker";

import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuthStore } from "./store/auth";
import { useUserStore } from "./store/user";
import { getCurrentUser } from "./lib/auth";
import { wireIncidentSocketToQueryCache, setSocketInstance, getSocket } from "./lib/socketService";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import AppLayout from "@/components/layout/AppLayout";
import FeedPageWrapper from "@/components/FeedPageWrapper";
import { Share2, Search, Bell } from "lucide-react";
import { LegalGate } from "@/components/LegalGate";
import { DisclaimerBanner } from "@/components/DisclaimerBanner";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { InstallPrompt } from "@/components/InstallPrompt";
import { useDeviceLocation } from "@/lib/useDeviceLocation";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Pages
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import NotFound from "@/pages/not-found";

// Public Pages (landing/marketing)
import Landing from "./pages/public/Landing";
import About from "./pages/public/About";
import HowItWorks from "./pages/public/HowItWorks";
import Safety from "./pages/public/Safety";

// Legal Pages
import Terms from "./pages/legal/Terms";
import Privacy from "./pages/legal/Privacy";

// Auth Pages
import VerifyEmail from "./pages/VerifyEmail";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Pending from "./pages/Pending";
import AccessDenied from "./pages/AccessDenied";
import AccessRequests from "./pages/admin/AccessRequests";

// Community Pages
import CommunityDashboard from "./pages/community/Dashboard";
import CommunityFeed from "./pages/community/Feed";
import SimpleMap from "./pages/community/SimpleMap";
import ReportIncident from "./pages/community/ReportIncident";
import ReportFull from "./pages/community/ReportFull";
import CommunityServices from "./pages/community/Services";
import Phase2 from "./pages/community/Phase2";
import NotificationSettings from "./pages/community/NotificationSettings";
import ModerationQueue from "./pages/admin/ModerationQueue";
import LandingBackgrounds from "./pages/admin/LandingBackgrounds";
import Welcome from "./pages/Welcome";
import { NetBadge } from "./components/NetBadge";

function ServiceWorkerUpdateToast() {
  const { toast } = useToast();
  
  useEffect(() => {
    onUpdateAvailable((waitingWorker) => {
      toast({
        title: "Update Available",
        description: "A new version is available. Tap to refresh.",
        duration: 0,
        action: (
          <ToastAction
            altText="Refresh to update"
            onClick={() => {
              navigator.serviceWorker.addEventListener('controllerchange', () => {
                window.location.reload();
              }, { once: true });
              waitingWorker.postMessage({ type: 'SKIP_WAITING' });
            }}
          >
            Refresh
          </ToastAction>
        ),
      });
    });
  }, [toast]);
  
  return null;
}

function AuthHandler() {
  const { setUser, setLoading } = useAuthStore();
  const { setCurrentRole } = useUserStore();

  useEffect(() => {
    const checkAuth = async () => {
      setLoading(true);
      try {
        const user = await getCurrentUser();
        setUser(user);
        
        // Set default role if user has roles
        if (user && user.roles && user.roles.length > 0) {
          setCurrentRole(user.roles[0] as any);
        } else {
          setCurrentRole('resident' as any);
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        setUser(null);
        setCurrentRole('resident' as any);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [setUser, setLoading, setCurrentRole]);

  return null;
}

function Router() {
  const [location] = useLocation();
  const { user, loading } = useAuthStore();
  const { currentRole } = useUserStore();
  
  // Initialize global device location watcher
  useDeviceLocation();

  // Show loading while auth is being determined - but with shorter timeout
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background dark:bg-background">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-muted-foreground">Loading NaborNet...</p>
        </div>
      </div>
    );
  }

  // Show auth pages if user is not logged in
  if (!user) {
    return (
      <Switch>
        {/* Public marketing pages */}
        <Route path="/about" component={About} />
        <Route path="/how-it-works" component={HowItWorks} />
        <Route path="/safety" component={Safety} />
        
        {/* Legal pages */}
        <Route path="/legal/terms" component={Terms} />
        <Route path="/legal/privacy" component={Privacy} />
        
        {/* Auth pages */}
        <Route path="/verify-email" component={VerifyEmail} />
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route path="/reset-password" component={ResetPassword} />
        <Route path="/login" component={Login} />
        <Route path="/signup" component={Signup} />
        
        {/* Landing page at root */}
        <Route path="/" component={Landing} />
        <Route component={Landing} />
      </Switch>
    );
  }
  
  // Define header actions with theme toggle
  const headerActions = [
    { key: "share", aria: "Share", icon: <Share2 className="h-5 w-5" /> },
    { key: "search", aria: "Search", icon: <Search className="h-5 w-5" /> },
    { key: "bell", aria: "Notifications", icon: <Bell className="h-5 w-5" /> },
    { key: "theme", aria: "Toggle theme", render: () => <ThemeToggle /> },
  ];

  // Access gate: redirect non-approved users
  const accessStatus = user.accessStatus || 'approved';
  if (accessStatus === 'pending') {
    return (
      <Switch>
        <Route path="/about" component={About} />
        <Route path="/how-it-works" component={HowItWorks} />
        <Route path="/safety" component={Safety} />
        <Route path="/legal/terms" component={Terms} />
        <Route path="/legal/privacy" component={Privacy} />
        <Route path="/pending" component={Pending} />
        <Route><Redirect to="/pending" /></Route>
      </Switch>
    );
  }

  if (accessStatus === 'denied') {
    return (
      <Switch>
        <Route path="/about" component={About} />
        <Route path="/how-it-works" component={HowItWorks} />
        <Route path="/safety" component={Safety} />
        <Route path="/legal/terms" component={Terms} />
        <Route path="/legal/privacy" component={Privacy} />
        <Route path="/access-denied" component={AccessDenied} />
        <Route><Redirect to="/access-denied" /></Route>
      </Switch>
    );
  }

  // User is approved - show main app
  return (
    <Switch>
      {/* Public marketing pages - accessible to all */}
      <Route path="/about" component={About} />
      <Route path="/how-it-works" component={HowItWorks} />
      <Route path="/safety" component={Safety} />
      
      {/* Legal Pages - accessible to all */}
      <Route path="/legal/terms" component={Terms} />
      <Route path="/legal/privacy" component={Privacy} />
      
      {/* Auth Pages - accessible even when logged in */}
      <Route path="/verify-email" component={VerifyEmail} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      
      {/* Public Routes */}
      <Route path="/login" component={Login} />
      
      {/* Access gate pages (approved users redirected to dashboard) */}
      <Route path="/pending"><Redirect to="/community/dashboard" /></Route>
      <Route path="/access-denied"><Redirect to="/community/dashboard" /></Route>
      
      {/* Admin: Access Requests */}
      <Route path="/admin/access">
        <AppLayout title="Access Requests" actions={headerActions}>
          <AccessRequests />
        </AppLayout>
      </Route>
      
      {/* Community Routes with standardized header */}
      <Route path="/">
        <AppLayout title="Dashboard" actions={headerActions}>
          <CommunityDashboard />
        </AppLayout>
      </Route>
      
      <Route path="/community">
        <AppLayout title="Dashboard" actions={headerActions}>
          <CommunityDashboard />
        </AppLayout>
      </Route>
      
      <Route path="/community/dashboard">
        <AppLayout title="Dashboard" actions={headerActions}>
          <CommunityDashboard />
        </AppLayout>
      </Route>
      
      <Route path={RoutePaths.Map}>
        <AppLayout title="Incident Map" actions={headerActions}>
          <DisclaimerBanner compact />
          <SimpleMap />
        </AppLayout>
      </Route>
      
      {/* Legacy redirect for old /map links */}
      <Route path="/map">
        <Redirect to={RoutePaths.Map} />
      </Route>
      
      <Route path="/community/feed">
        {/* The Feed manages its own full-bleed width and sticky filter bar, so
            it renders as pageChrome — inside the layout's reserved top space
            rather than underneath the fixed mobile navigation. */}
        <AppLayout
          title="Feed"
          actions={headerActions}
          pageChrome={<><DisclaimerBanner compact /><FeedPageWrapper /></>}
        >
          <div />
        </AppLayout>
      </Route>
      
      <Route path="/community/report">
        <AppLayout title="Report Incident" actions={headerActions}>
          <ReportIncident />
        </AppLayout>
      </Route>
      
      <Route path="/community/report-full">
        <AppLayout title="Full Report" actions={headerActions}>
          <ReportFull />
        </AppLayout>
      </Route>
      
      {/* Community Services: non-emergency requests to verified local services.
          Sits inside the approved-user branch, so pending and denied accounts
          are redirected by the access gate above before reaching it. */}
      <Route path="/community/services">
        <AppLayout title="Community Services" actions={headerActions}>
          <CommunityServices />
        </AppLayout>
      </Route>

      <Route path="/community/phase2">
        <AppLayout title="Phase 2 Features" actions={headerActions}>
          <Phase2 />
        </AppLayout>
      </Route>
      
      <Route path="/community/notifications">
        <AppLayout title="Notification Settings" actions={headerActions}>
          <NotificationSettings />
        </AppLayout>
      </Route>
      
      <Route path="/admin/moderation">
        <AppLayout title="Moderation Queue" actions={headerActions}>
          <ModerationQueue />
        </AppLayout>
      </Route>

      <Route path="/admin/backgrounds">
        <AppLayout title="Landing Backgrounds" actions={headerActions}>
          <LandingBackgrounds />
        </AppLayout>
      </Route>

      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // Wire socket events to query cache once at app startup
  useEffect(() => {
    // Wire socket to query cache and set instance for watchdog
    wireIncidentSocketToQueryCache(queryClient);
    import("./lib/socketService").then(({ socket }) => {
      setSocketInstance(socket);
    });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" storageKey="nabornet-theme">
        <LegalGate>
          <AuthHandler />
          <ServiceWorkerUpdateToast />
          <Toaster />
          <ErrorBoundary>
            <Router />
          </ErrorBoundary>
          <NetBadge socket={getSocket()} />
          <OfflineIndicator />
          <InstallPrompt />
        </LegalGate>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
