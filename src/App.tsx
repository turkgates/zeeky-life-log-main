import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useNavigate } from "react-router-dom";
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
import NotFound from "./pages/NotFound";
import { getUserCurrency, supabase } from "@/lib/supabase";
import { useCurrencyStore } from "@/store/useCurrencyStore";
import { useAuthStore } from "@/store/useAuthStore";

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

function AppRoutes() {
  const initialize = useAuthStore(s => s.initialize);
  useEffect(() => {
    void initialize();
  }, [initialize]);

  return (
    <>
      <CurrencyLoader />
      <div className="min-h-screen flex flex-col bg-background w-full">
        <div className="flex-1 min-h-0 flex flex-col w-full">
          <Routes>
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/auth/callback" element={<AuthCallbackPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
            <Route path="/add" element={<ProtectedRoute><AddActionPage /></ProtectedRoute>} />
            <Route path="/history" element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />
            <Route path="/suggestions" element={<ProtectedRoute><SuggestionsPage /></ProtectedRoute>} />
            <Route path="/finance" element={<ProtectedRoute><FinancePage /></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
            <Route path="/friends" element={<ProtectedRoute><FriendsPage /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
            <Route path="*" element={<ProtectedRoute><NotFound /></ProtectedRoute>} />
          </Routes>
        </div>
        <BottomNav />
      </div>
    </>
  );
}

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Sonner />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
