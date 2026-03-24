import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sun, Moon, Bell, Globe, Info, Trash2 } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import { cn } from '@/lib/utils';
import { useState } from 'react';

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={cn("w-12 h-7 rounded-full transition-colors relative", on ? "bg-primary" : "bg-muted")}
    >
      <div className={cn("w-5 h-5 rounded-full bg-card absolute top-1 transition-transform shadow-sm", on ? "translate-x-6" : "translate-x-1")} />
    </button>
  );
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();
  const [notifAll, setNotifAll] = useState(true);
  const [notifReminder, setNotifReminder] = useState(true);
  const [notifSuggestion, setNotifSuggestion] = useState(false);
  const [lang, setLang] = useState<'tr' | 'en'>('tr');

  return (
    <div className="min-h-screen bg-background max-w-[430px] mx-auto animate-slide-up">
      <div className="flex items-center gap-3 p-4 border-b border-border">
        <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center rounded-full active:bg-muted">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold">Ayarlar</h1>
      </div>

      <div className="p-4 space-y-3">
        {/* Theme */}
        <div className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {theme === 'dark' ? <Moon className="w-5 h-5 text-primary" /> : <Sun className="w-5 h-5 text-primary" />}
            <span className="text-sm font-medium">Karanlık Mod</span>
          </div>
          <Toggle on={theme === 'dark'} onToggle={toggle} />
        </div>

        {/* Notifications */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="flex items-center gap-3 p-4 border-b border-border">
            <Bell className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium">Bildirimler</span>
          </div>
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm">Tüm Bildirimler</span>
              <Toggle on={notifAll} onToggle={() => setNotifAll(!notifAll)} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Hatırlatmalar</span>
              <Toggle on={notifReminder} onToggle={() => setNotifReminder(!notifReminder)} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Tavsiye Bildirimleri</span>
              <Toggle on={notifSuggestion} onToggle={() => setNotifSuggestion(!notifSuggestion)} />
            </div>
          </div>
        </div>

        {/* Routine Actions */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-border">
            <span className="text-sm font-medium">Rutin Eylemler</span>
          </div>
          <div className="p-4 space-y-2">
            {['Sabah sporu', 'Kahve molası', 'Akşam yürüyüşü'].map(item => (
              <div key={item} className="flex items-center justify-between bg-muted rounded-xl px-3 py-2.5">
                <span className="text-sm">{item}</span>
                <Trash2 className="w-4 h-4 text-destructive" />
              </div>
            ))}
          </div>
        </div>

        {/* Language */}
        <div className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Globe className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium">Dil</span>
          </div>
          <div className="flex gap-1 bg-muted rounded-lg p-0.5">
            <button onClick={() => setLang('tr')} className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-colors", lang === 'tr' ? "bg-primary text-primary-foreground" : "text-foreground")}>TR</button>
            <button onClick={() => setLang('en')} className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-colors", lang === 'en' ? "bg-primary text-primary-foreground" : "text-foreground")}>EN</button>
          </div>
        </div>

        {/* About */}
        <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
          <Info className="w-5 h-5 text-primary" />
          <div>
            <span className="text-sm font-medium block">Hakkında</span>
            <span className="text-xs text-muted-foreground">Zeeky v1.0.0</span>
          </div>
        </div>
      </div>
    </div>
  );
}
