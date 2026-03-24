import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import BottomNav from "@/components/BottomNav";
import HomePage from "./pages/HomePage";
import AddActionPage from "./pages/AddActionPage";
import HistoryPage from "./pages/HistoryPage";
import SuggestionsPage from "./pages/SuggestionsPage";
import ProfilePage from "./pages/ProfilePage";
import SettingsPage from "./pages/SettingsPage";
import FinancePage from "./pages/FinancePage";
import NotificationsPage from "./pages/NotificationsPage";
import NotFound from "./pages/NotFound";
import { getUserCurrency } from "@/lib/supabase";
import { useCurrencyStore } from "@/store/useCurrencyStore";

const BOOTSTRAP_USER_ID = '520ffdd8-fd9e-472f-a388-021bded37b7f';

/** Fetches the user's saved currency once on app start and hydrates the global store. */
function CurrencyLoader() {
  const setCurrency = useCurrencyStore(s => s.setCurrency);
  useEffect(() => {
    getUserCurrency(BOOTSTRAP_USER_ID).then(({ code, symbol }) => {
      setCurrency(code, symbol);
    });
  }, [setCurrency]);
  return null;
}

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Sonner />
        <BrowserRouter>
          <CurrencyLoader />
          <div className="min-h-screen bg-background max-w-[430px] mx-auto relative">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/add" element={<AddActionPage />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/suggestions" element={<SuggestionsPage />} />
              <Route path="/finance" element={<FinancePage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            <BottomNav />
          </div>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
