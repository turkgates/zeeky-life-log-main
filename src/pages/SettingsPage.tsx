import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sun, Moon, Bell, Globe, Info, Trash2, Loader2 } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { CURRENCIES, getCurrencySymbol } from '@/lib/currency';
import { useCurrencyStore } from '@/store/useCurrencyStore';
import { toast } from 'sonner';

const USER_ID = '520ffdd8-fd9e-472f-a388-021bded37b7f';

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={cn('w-12 h-7 rounded-full transition-colors relative', on ? 'bg-primary' : 'bg-muted')}
    >
      <div className={cn('w-5 h-5 rounded-full bg-card absolute top-1 transition-transform shadow-sm', on ? 'translate-x-6' : 'translate-x-1')} />
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

  const setGlobalCurrency = useCurrencyStore(s => s.setCurrency);
  const [prefsLoading, setPrefsLoading] = useState(true);
  const [aiPersonality, setAiPersonality] = useState<'balanced' | 'strict' | 'gentle'>('balanced');

  useEffect(() => {
    const load = async () => {
      setPrefsLoading(true);
      try {
        const [u, p] = await Promise.all([
          supabase.from('users').select('currency, currency_symbol').eq('id', USER_ID).single(),
          supabase.from('user_profiles').select('ai_personality').eq('user_id', USER_ID).single(),
        ]);
        if (u.data?.currency) {
          const sym = u.data.currency_symbol || getCurrencySymbol(u.data.currency);
          setGlobalCurrency(u.data.currency, sym);
        }
        if (p.data?.ai_personality === 'strict' || p.data?.ai_personality === 'gentle' || p.data?.ai_personality === 'balanced') {
          setAiPersonality(p.data.ai_personality);
        }
      } finally {
        setPrefsLoading(false);
      }
    };
    void load();
  }, [setGlobalCurrency]);

  const currencyCode = useCurrencyStore(s => s.code);

  const handleCurrencyChange = async (code: string) => {
    const c = CURRENCIES.find(x => x.code === code);
    if (!c) return;
    const { error } = await supabase
      .from('users')
      .update({ currency: c.code, currency_symbol: c.symbol })
      .eq('id', USER_ID);
    if (error) {
      console.error(error);
      toast.error('Para birimi kaydedilemedi');
      return;
    }
    setGlobalCurrency(c.code, c.symbol);
    toast.success('Para birimi güncellendi');
  };

  const handlePersonalityChange = async (v: 'balanced' | 'strict' | 'gentle') => {
    setAiPersonality(v);
    const { error } = await supabase
      .from('user_profiles')
      .update({ ai_personality: v })
      .eq('user_id', USER_ID);
    if (error) {
      console.error(error);
      toast.error('Kişilik kaydedilemedi');
      return;
    }
    toast.success('Zeeky kişiliği güncellendi');
  };

  return (
    <div className="min-h-screen bg-background max-w-[430px] mx-auto animate-slide-up">
      <div className="flex items-center gap-3 p-4 border-b border-border">
        <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center rounded-full active:bg-muted">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold">Ayarlar</h1>
      </div>

      <div className="p-4 space-y-3">
        {/* Para Birimi */}
        <div className="bg-card border border-border rounded-2xl p-4">
          <h2 className="text-sm font-semibold mb-2">Para Birimi</h2>
          {prefsLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <select
              value={currencyCode}
              onChange={e => void handleCurrencyChange(e.target.value)}
              className="w-full bg-muted rounded-xl px-3 py-2.5 text-sm outline-none border border-border focus:border-accent transition-colors appearance-none"
            >
              {CURRENCIES.map(c => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Zeeky kişiliği */}
        <div className="bg-card border border-border rounded-2xl p-4">
          <h2 className="text-sm font-semibold mb-1">Zeeky&apos;nin Kişiliği</h2>
          <p className="text-[11px] text-muted-foreground mb-3">Zeeky sana nasıl davransın?</p>
          {prefsLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { value: 'balanced' as const, emoji: '😊', label: 'Dengeli', desc: 'Motive edici ve dengeli' },
                  { value: 'strict' as const, emoji: '💪', label: 'Sert', desc: 'Direkt ve sonuç odaklı' },
                  { value: 'gentle' as const, emoji: '🤗', label: 'Nazik', desc: 'Anlayışlı ve destekleyici' },
                ]
              ).map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => void handlePersonalityChange(opt.value)}
                  className={cn(
                    'flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition-colors',
                    aiPersonality === opt.value
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-border bg-muted text-muted-foreground',
                  )}
                >
                  <span className="text-xl">{opt.emoji}</span>
                  <span className="text-xs font-semibold leading-tight">{opt.label}</span>
                  <span className="text-[10px] leading-snug">{opt.desc}</span>
                </button>
              ))}
            </div>
          )}
        </div>

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
            <button onClick={() => setLang('tr')} className={cn('px-3 py-1.5 rounded-md text-xs font-medium transition-colors', lang === 'tr' ? 'bg-primary text-primary-foreground' : 'text-foreground')}>TR</button>
            <button onClick={() => setLang('en')} className={cn('px-3 py-1.5 rounded-md text-xs font-medium transition-colors', lang === 'en' ? 'bg-primary text-primary-foreground' : 'text-foreground')}>EN</button>
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
