import { DailySplashScreen } from "@/components/DailySplashScreen";
import { useCallback, useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import BottomNav from "@/components/BottomNav";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import HomePage from "./pages/HomePage";
import AddActionPage from "./pages/AddActionPage";
import HistoryPage from "./pages/HistoryPage";
import SuggestionsPage from "./pages/SuggestionsPage";
import ProfilePage from "./pages/ProfilePage";
import SettingsPage from "./pages/SettingsPage";
import FinancePage from "./pages/FinancePage";
import NotificationsPage from "./pages/NotificationsPage";
import FriendsPage from "./pages/FriendsPage";
import AuthPage from "./pages/AuthPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import AuthCallbackPage from "./pages/AuthCallbackPage";
import OnboardingPage from "./pages/OnboardingPage";
import NotFound from "./pages/NotFound";
import { AdminPage } from "./pages/AdminPage";
import { AdminRoute } from "@/components/AdminRoute";
import { getUserCurrency, supabase } from "@/lib/supabase";
import { useCurrencyStore } from "@/store/useCurrencyStore";
import { useAuthStore } from "@/store/useAuthStore";
import { useLanguageStore } from "@/store/useLanguageStore";

function CurrencyLoader() {
  const setCurrency = useCurrencyStore(s => s.setCurrency);
  const userId = useAuthStore(s => s.user?.id);
  useEffect(() => {
    if (!userId) return;
    getUserCurrency(userId).then(({ code, symbol }) => {
      setCurrency(code, symbol);
    });
  }, [userId, setCurrency]);
  return null;
}

function OnboardingGuard() {
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);

  useEffect(() => {
    if (!user) return;
    const check = async () => {
      const { data } = await supabase
        .from('users')
        .select('onboarding_completed')
        .eq('id', user.id)
        .single();
      if (data && !data.onboarding_completed) {
        navigate('/onboarding', { replace: true });
      }
    };
    void check();
  }, [user, navigate]);

  return null;
}

function AppRoutes() {
  const user = useAuthStore(s => s.user);
  const { loadLanguage } = useLanguageStore();

  useEffect(() => {
    if (user?.id) {
      void loadLanguage(user.id);
    }
  }, [user?.id, loadLanguage]);

  return (
    <>
      <CurrencyLoader />
      <OnboardingGuard />
      <div className="min-h-screen flex flex-col bg-background w-full">
        <div className="flex-1 flex flex-col w-full">
          <Routes>
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/auth/callback" element={<AuthCallbackPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/onboarding" element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />
            <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
            <Route path="/add" element={<ProtectedRoute><AddActionPage /></ProtectedRoute>} />
            <Route path="/history" element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />
            <Route path="/suggestions" element={<ProtectedRoute><SuggestionsPage /></ProtectedRoute>} />
            <Route path="/finance" element={<ProtectedRoute><FinancePage /></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
            <Route path="/friends" element={<ProtectedRoute><FriendsPage /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
            <Route path="/admin" element={<AdminRoute><AdminPage /></AdminRoute>} />
            <Route path="*" element={<ProtectedRoute><NotFound /></ProtectedRoute>} />
          </Routes>
        </div>
        <BottomNav />
      </div>
    </>
  );
}

const queryClient = new QueryClient();

function AppShellWithSplash() {
  const initialize = useAuthStore(s => s.initialize);
  const user = useAuthStore(s => s.user);
  const isLoading = useAuthStore(s => s.isLoading);
  const [showSplash, setShowSplash] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    void initialize();
  }, [initialize]);

  const checkUserFlow = useCallback(async () => {
    if (!user?.id) return;

    const { data } = await supabase
      .from('users')
      .select('onboarding_completed')
      .eq('id', user.id)
      .single();

    if (!data?.onboarding_completed) {
      navigate('/onboarding');
      setShowSplash(false);
      return;
    }

    const today = new Date().toDateString();
    const lastSplash = localStorage.getItem(`zeeky_splash_${user.id}`);

    if (lastSplash !== today) {
      setShowSplash(true);
    } else {
      setShowSplash(false);
    }
  }, [user?.id, navigate]);

  useEffect(() => {
    if (isLoading) return;
    if (!user?.id) {
      setShowSplash(false);
      return;
    }
    void checkUserFlow();
  }, [user?.id, isLoading, location.pathname, checkUserFlow]);

  const handleSplashComplete = useCallback(() => {
    if (user?.id) {
      localStorage.setItem(`zeeky_splash_${user.id}`, new Date().toDateString());
    }
    setShowSplash(false);
  }, [user?.id]);

  if (showSplash) {
    return <DailySplashScreen onComplete={handleSplashComplete} />;
  }

  return <AppRoutes />;
}

function AppShell() {
  return (
    <BrowserRouter>
      <AppShellWithSplash />
    </BrowserRouter>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Sonner />
        <AppShell />
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
