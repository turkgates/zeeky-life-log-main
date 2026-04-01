import { Home, ClipboardList, Lightbulb, User, Wallet } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const tabs = [
    { path: '/', icon: Home, label: t('nav.home') },
    { path: '/history', icon: ClipboardList, label: t('nav.history') },
    { path: '/finance', icon: Wallet, label: t('nav.finance') },
    { path: '/suggestions', icon: Lightbulb, label: t('nav.suggestions') },
    { path: '/profile', icon: User, label: t('nav.profile') },
  ];

  if (
    location.pathname === '/add'
    || location.pathname === '/settings'
    || location.pathname === '/notifications'
    || location.pathname === '/auth'
    || location.pathname === '/auth/callback'
    || location.pathname === '/reset-password'
    || location.pathname === '/onboarding'
  ) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 w-full shrink-0 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-700 pb-safe">
      <div className="w-full flex items-center justify-around px-1 h-16">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={cn(
                "flex flex-col items-center gap-0.5 py-2 px-2 min-w-[56px] transition-colors",
                isActive ? "text-accent" : "text-muted-foreground"
              )}
            >
              <tab.icon className="w-5 h-5" />
              <span className="text-[9px] font-medium leading-tight text-center">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
