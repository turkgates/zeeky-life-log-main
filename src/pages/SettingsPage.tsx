import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sun, Moon, Globe, Info, Loader2 } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { CURRENCIES, getCurrencySymbol } from '@/lib/currency';
import { useCurrencyStore } from '@/store/useCurrencyStore';
import { useAuthStore } from '@/store/useAuthStore';
import { toast } from 'sonner';

const DEFAULT_NOTIFICATION_SETTINGS = {
  weekly_summary: true,
  budget_alerts: true,
  sport_reminders: true,
  social_reminders: true,
  payment_reminders: true,
} as const;

type NotificationSettings = typeof DEFAULT_NOTIFICATION_SETTINGS;

function mergeNotificationSettings(raw: unknown): NotificationSettings {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_NOTIFICATION_SETTINGS };
  }
  const o = raw as Record<string, unknown>;
  return {
    weekly_summary: o.weekly_summary !== false,
    budget_alerts: o.budget_alerts !== false,
    sport_reminders: o.sport_reminders !== false,
    social_reminders: o.social_reminders !== false,
    payment_reminders: o.payment_reminders !== false,
  };
}

function Toggle({
  on,
  onToggle,
  value,
  onChange,
  disabled,
}: {
  on?: boolean;
  onToggle?: () => void;
  value?: boolean;
  onChange?: (v: boolean) => void;
  disabled?: boolean;
}) {
  const isOn = value !== undefined ? value : on ?? false;
  const handle = () => {
    if (disabled) return;
    if (onChange) onChange(!isOn);
    else onToggle?.();
  };
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={handle}
      className={cn(
        'w-12 h-7 rounded-full transition-colors relative shrink-0',
        disabled && 'opacity-50 cursor-not-allowed',
        isOn ? 'bg-primary' : 'bg-muted',
      )}
    >
      <div
        className={cn(
          'w-5 h-5 rounded-full bg-card absolute top-1 transition-transform shadow-sm',
          isOn ? 'translate-x-6' : 'translate-x-1',
        )}
      />
    </button>
  );
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const userId = user?.id ?? '';
  const { theme, toggle } = useTheme();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(() => ({
    ...DEFAULT_NOTIFICATION_SETTINGS,
  }));
  const [lang, setLang] = useState<'tr' | 'en'>('tr');

  const setGlobalCurrency = useCurrencyStore(s => s.setCurrency);
  const [prefsLoading, setPrefsLoading] = useState(true);
  const [aiPersonality, setAiPersonality] = useState<'balanced' | 'strict' | 'gentle'>('balanced');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isPasswordOpen, setIsPasswordOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!userId) {
        setPrefsLoading(false);
        return;
      }
      setPrefsLoading(true);
      try {
        const [u, p] = await Promise.all([
          supabase.from('users').select('currency, currency_symbol').eq('id', userId).single(),
          supabase
            .from('user_profiles')
            .select('ai_personality, notification_enabled, notification_settings')
            .eq('user_id', userId)
            .single(),
        ]);
        if (u.data?.currency) {
          const sym = u.data.currency_symbol || getCurrencySymbol(u.data.currency);
          setGlobalCurrency(u.data.currency, sym);
        }
        if (p.data?.ai_personality === 'strict' || p.data?.ai_personality === 'gentle' || p.data?.ai_personality === 'balanced') {
          setAiPersonality(p.data.ai_personality);
        }
        if (p.data) {
          setNotificationsEnabled(p.data.notification_enabled ?? true);
          setNotificationSettings(mergeNotificationSettings(p.data.notification_settings));
        }
      } finally {
        setPrefsLoading(false);
      }
    };
    void load();
  }, [setGlobalCurrency, userId]);

  const currencyCode = useCurrencyStore(s => s.code);

  const handleCurrencyChange = async (code: string) => {
    if (!userId) return;
    const c = CURRENCIES.find(x => x.code === code);
    if (!c) return;
    const { error } = await supabase
      .from('users')
      .update({ currency: c.code, currency_symbol: c.symbol })
      .eq('id', userId);
    if (error) {
      console.error(error);
      toast.error('Para birimi kaydedilemedi');
      return;
    }
    setGlobalCurrency(c.code, c.symbol);
    toast.success('Para birimi güncellendi');
  };

  const handlePersonalityChange = async (v: 'balanced' | 'strict' | 'gentle') => {
    if (!userId) return;
    setAiPersonality(v);
    const { error } = await supabase
      .from('user_profiles')
      .update({ ai_personality: v })
      .eq('user_id', userId);
    if (error) {
      console.error(error);
      toast.error('Kişilik kaydedilemedi');
      return;
    }
    toast.success('Zeeky kişiliği güncellendi');
  };

  const handleNotificationToggle = async (value: boolean) => {
    if (!userId) return;
    setNotificationsEnabled(value);
    const { error } = await supabase
      .from('user_profiles')
      .update({ notification_enabled: value })
      .eq('user_id', userId);
    if (error) {
      console.error(error);
      toast.error('Bildirim ayarı kaydedilemedi');
    }
  };

  const handleCategoryToggle = async (key: keyof NotificationSettings, value: boolean) => {
    if (!userId) return;
    const next = { ...notificationSettings, [key]: value };
    setNotificationSettings(next);
    const { error } = await supabase
      .from('user_profiles')
      .update({ notification_settings: next })
      .eq('user_id', userId);
    if (error) {
      console.error(error);
      toast.error('Bildirim tercihi kaydedilemedi');
    }
  };

  const handlePasswordChange = async () => {
    setPasswordError(null);
    if (!user?.email) {
      toast.error('Oturum bulunamadı');
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      setPasswordError('Yeni şifreler eşleşmiyor');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('Yeni şifre en az 6 karakter olmalı');
      return;
    }
    setIsChangingPassword(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (signInError) {
        setPasswordError('Mevcut şifre yanlış');
        return;
      }
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) {
        setPasswordError(error.message);
        return;
      }
      toast.success('Şifre güncellendi');
      setCurrentPassword('');
      setNewPassword('');
      setNewPasswordConfirm('');
    } finally {
      setIsChangingPassword(false);
    }
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

        {/* Şifre Değiştir — accordion */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden dark:bg-card dark:border-border">
          <button
            type="button"
            onClick={() => setIsPasswordOpen(!isPasswordOpen)}
            className="w-full flex items-center justify-between px-4 py-4 text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-950/50 flex items-center justify-center">
                🔒
              </div>
              <span className="font-medium text-gray-800 dark:text-foreground">Şifre Değiştir</span>
            </div>
            <svg
              className={cn(
                'w-5 h-5 text-gray-400 transition-transform duration-200 shrink-0 dark:text-muted-foreground',
                isPasswordOpen ? 'rotate-180' : '',
              )}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {isPasswordOpen && (
            <div className="px-4 pb-4 border-t border-gray-100 dark:border-border">
              <div className="space-y-3 mt-4">
                <div>
                  <label className="text-sm text-gray-600 dark:text-muted-foreground mb-1 block">Mevcut Şifre</label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    autoComplete="current-password"
                    className="w-full border border-gray-200 dark:border-border dark:bg-muted rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400 dark:focus:border-accent"
                    placeholder="••••••••"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-600 dark:text-muted-foreground mb-1 block">Yeni Şifre</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    className="w-full border border-gray-200 dark:border-border dark:bg-muted rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400 dark:focus:border-accent"
                    placeholder="••••••••"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-600 dark:text-muted-foreground mb-1 block">Yeni Şifre Tekrar</label>
                  <input
                    type="password"
                    value={newPasswordConfirm}
                    onChange={e => setNewPasswordConfirm(e.target.value)}
                    autoComplete="new-password"
                    className="w-full border border-gray-200 dark:border-border dark:bg-muted rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400 dark:focus:border-accent"
                    placeholder="••••••••"
                  />
                </div>
                {passwordError && (
                  <p className="text-red-500 text-sm">{passwordError}</p>
                )}
                <button
                  type="button"
                  onClick={() => void handlePasswordChange()}
                  disabled={isChangingPassword}
                  className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium text-sm disabled:opacity-50 dark:bg-primary dark:text-primary-foreground"
                >
                  {isChangingPassword ? 'Güncelleniyor...' : 'Şifreyi Güncelle'}
                </button>
              </div>
            </div>
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
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm dark:bg-card dark:border-border">
          <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100 dark:border-border">
            <div className="flex items-center gap-3">
              <span>🔔</span>
              <div>
                <p className="font-medium text-sm text-gray-900 dark:text-foreground">Bildirimler</p>
                <p className="text-xs text-gray-400 dark:text-muted-foreground">Tüm bildirimleri aç/kapat</p>
              </div>
            </div>
            <Toggle
              value={notificationsEnabled}
              onChange={v => void handleNotificationToggle(v)}
              disabled={!userId || prefsLoading}
            />
          </div>
          {([
            { key: 'weekly_summary' as const, label: 'Haftalık özet', icon: '📊' },
            { key: 'budget_alerts' as const, label: 'Bütçe uyarıları', icon: '💰' },
            { key: 'sport_reminders' as const, label: 'Spor hatırlatmaları', icon: '🏃' },
            { key: 'social_reminders' as const, label: 'Sosyal hatırlatmalar', icon: '👥' },
            { key: 'payment_reminders' as const, label: 'Ödeme hatırlatmaları', icon: '📅' },
          ]).map(item => (
            <div
              key={item.key}
              className={cn(
                'flex items-center justify-between px-4 py-3 border-b border-gray-100 last:border-0 dark:border-border',
                !notificationsEnabled && 'opacity-40',
              )}
            >
              <div className="flex items-center gap-3">
                <span>{item.icon}</span>
                <p className="text-sm text-gray-700 dark:text-foreground/90">{item.label}</p>
              </div>
              <Toggle
                value={notificationSettings[item.key] ?? true}
                onChange={v => void handleCategoryToggle(item.key, v)}
                disabled={!notificationsEnabled || !userId || prefsLoading}
              />
            </div>
          ))}
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
