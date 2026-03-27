import { Home, ClipboardList, Lightbulb, User, Wallet } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

const tabs = [
  { path: '/', icon: Home, label: 'Ana Sayfa' },
  { path: '/history', icon: ClipboardList, label: 'Neler Yaptım' },
  { path: '/finance', icon: Wallet, label: 'Gelir & Gider' },
  { path: '/suggestions', icon: Lightbulb, label: 'Tavsiyeler' },
  { path: '/profile', icon: User, label: 'Profil' },
];

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  if (
    location.pathname === '/add'
    || location.pathname === '/settings'
    || location.pathname === '/notifications'
    || location.pathname === '/auth'
    || location.pathname === '/auth/callback'
    || location.pathname === '/reset-password'
  ) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border safe-bottom">
      <div className="max-w-[430px] mx-auto flex items-center justify-around px-1 h-16">
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
