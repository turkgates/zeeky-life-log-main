import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sun, Moon, Info, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { CURRENCIES, getCurrencySymbol } from '@/lib/currency';
import { useCurrencyStore } from '@/store/useCurrencyStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useLanguageStore } from '@/store/useLanguageStore';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useAppSettings } from '@/hooks/useAppSettings';
import CampaignCountdown from '@/components/CampaignCountdown';


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
  // —— Tüm hook'lar üstte (koşul / erken return yok) ——
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const userId = user?.id ?? '';
  const { language, setLanguage } = useLanguageStore();
  const currencyCode = useCurrencyStore(s => s.code);
  const setGlobalCurrency = useCurrencyStore(s => s.setCurrency);
  const { settings } = useAppSettings();
  const { t } = useTranslation();
  const { theme, toggle } = useTheme();

  const [notifications, setNotifications] = useState({ daily_motivation: true, weekly_summary: true });
  const [prefsLoading, setPrefsLoading] = useState(true);
  const [aiPersonality, setAiPersonality] = useState<'balanced' | 'strict' | 'gentle'>('balanced');
  const [isPremiumPlan, setIsPremiumPlan] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isPasswordOpen, setIsPasswordOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackSending, setFeedbackSending] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const handleFeedbackSend = async () => {
    const msg = feedbackText.trim();
    if (!msg || !userId) return;
    setFeedbackSending(true);
    const { error } = await supabase.from('feedback').insert({ user_id: userId, message: msg });
    setFeedbackSending(false);
    if (error) { toast.error('Hata oluştu'); return; }
    toast.success(t('settings.feedback_success'));
    setFeedbackText('');
  };

  const currencySymbolMap: Record<string, string> = { eur: '€', usd: '$', try: '₺' };
  const currencySymbol = currencySymbolMap[settings.currency_key] ?? '€';
  const monthlyPrice = settings.campaign_active ? settings.campaign_monthly_price : settings.premium_monthly_price;
  const yearlyPrice = settings.campaign_active ? settings.campaign_yearly_price : settings.premium_yearly_price;

  const personalityOptions = useMemo(() => [
    {
      value: 'balanced' as const,
      emoji: '😊',
      label: t('settings.personality_balanced'),
      desc: t('settings.personality_balanced_desc'),
    },
    {
      value: 'strict' as const,
      emoji: '💪',
      label: t('settings.personality_strict'),
      desc: t('settings.personality_strict_desc'),
    },
    {
      value: 'gentle' as const,
      emoji: '🤗',
      label: t('settings.personality_gentle'),
      desc: t('settings.personality_gentle_desc'),
    },
  ], [t]);

  useEffect(() => {
    const load = async () => {
      if (!userId) {
        setIsPremiumPlan(false);
        setPrefsLoading(false);
        return;
      }
      setPrefsLoading(true);
      try {
        const [u, p] = await Promise.all([
          supabase.from('users').select('currency, currency_symbol, plan_type, is_admin').eq('id', userId).single(),
          supabase
            .from('user_profiles')
            .select('ai_personality, notification_settings')
            .eq('user_id', userId)
            .single(),
        ]);
        if (u.data?.currency) {
          const sym = u.data.currency_symbol || getCurrencySymbol(u.data.currency);
          setGlobalCurrency(u.data.currency, sym);
        }
        setIsPremiumPlan(u.data?.plan_type === 'premium');
        setIsAdmin(u.data?.is_admin || false);
        if (p.data?.ai_personality === 'strict' || p.data?.ai_personality === 'gentle' || p.data?.ai_personality === 'balanced') {
          setAiPersonality(p.data.ai_personality);
        }
        if (p.data?.notification_settings) {
          const ns = p.data.notification_settings as Record<string, unknown>;
          setNotifications({
            daily_motivation: ns.daily_motivation !== false,
            weekly_summary: ns.weekly_summary !== false,
          });
        }
      } finally {
        setPrefsLoading(false);
      }
    };
    void load();
  }, [setGlobalCurrency, userId]);

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

  const allNotificationsEnabled = Object.values(notifications).every(Boolean);

  const toggleAllNotifications = async () => {
    if (!userId) return;
    const newValue = !allNotificationsEnabled;
    const updated = { daily_motivation: newValue, weekly_summary: newValue };
    setNotifications(updated);
    const { error } = await supabase
      .from('user_profiles')
      .update({ notification_settings: updated })
      .eq('user_id', userId);
    if (error) {
      console.error(error);
      toast.error('Bildirim ayarı kaydedilemedi');
    }
  };

  const updateNotification = async (key: string, value: boolean) => {
    if (!userId) return;
    const updated = { ...notifications, [key]: value };
    setNotifications(updated);
    const { error } = await supabase
      .from('user_profiles')
      .update({ notification_settings: updated })
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
      setPasswordError(t('settings.password_mismatch'));
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError(t('settings.password_min_length'));
      return;
    }
    setIsChangingPassword(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (signInError) {
        setPasswordError(t('settings.wrong_password'));
        return;
      }
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) {
        setPasswordError(error.message);
        return;
      }
      toast.success(t('settings.password_updated'));
      setCurrentPassword('');
      setNewPassword('');
      setNewPasswordConfirm('');
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="min-h-screen bg-background w-full animate-slide-up">
      <div
        className="sticky z-10 bg-background"
        style={{
          top: 0,
          paddingTop: 'env(safe-area-inset-top, 0px)',
          marginTop: 'calc(-1 * env(safe-area-inset-top, 0px))',
        }}
      />
      <div className="flex items-center gap-3 p-4 border-b border-border">
        <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center rounded-full active:bg-muted">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold">{t('settings.title')}</h1>
      </div>

      <div className="p-4 space-y-3">
        {/* PREMIUM BÖLÜMÜ — EN ÜSTTE */}
        <div className="rounded-2xl overflow-hidden border border-blue-200/80 dark:border-blue-900/50 shadow-md bg-gradient-to-br from-blue-600 to-indigo-700 text-white">
          <div className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-lg font-bold">Zeeky Premium</p>
                <p className="text-sm text-white/85 mt-1">{t('settings.premium_desc')}</p>
                {settings.campaign_active && settings.campaign_label && (
                  <div className="mt-2 inline-block bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                    🎉 {settings.campaign_label}
                  </div>
                )}
                <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                  <div>
                    <span className="text-white/60 block text-xs">{t('settings.premium_monthly')}</span>
                    {settings.campaign_active && (
                      <span className="text-white/40 text-xs line-through mr-1">{settings.premium_monthly_price}{currencySymbol}</span>
                    )}
                    <span className="font-semibold text-lg">{monthlyPrice}{currencySymbol}</span>
                  </div>
                  <div>
                    <span className="text-white/60 block text-xs">{t('settings.premium_yearly')}</span>
                    {settings.campaign_active && (
                      <span className="text-white/40 text-xs line-through mr-1">{settings.premium_yearly_price}{currencySymbol}</span>
                    )}
                    <span className="font-semibold text-lg">{yearlyPrice}{currencySymbol}</span>
                  </div>
                </div>
              </div>
              <span className="text-3xl shrink-0" aria-hidden>✨</span>
            </div>
            {isPremiumPlan ? (
              <p className="mt-4 text-center text-sm font-medium bg-white/15 rounded-xl py-2.5">
                {t('settings.premium_active')}
              </p>
            ) : (
              <button
                type="button"
                onClick={() => setShowPremiumModal(true)}
                className="mt-4 w-full py-3 rounded-xl bg-white text-blue-700 font-semibold text-sm active:scale-[0.99] transition-transform"
              >
                {t('settings.upgrade_to_premium')}
              </button>
            )}
          </div>
        </div>

        {/* Dil */}
        <div
          className="flex items-center justify-between px-4 py-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center shrink-0">
              🌍
            </div>
            <p className="font-medium text-sm text-gray-800 dark:text-gray-100">
              {t('settings.language')}
            </p>
          </div>
          <div className="flex gap-1 shrink-0">
            {[
              { code: 'tr', label: 'TR' },
              { code: 'en', label: 'EN' },
              { code: 'fr', label: 'FR' },
            ].map(lang => (
              <button
                key={lang.code}
                type="button"
                onClick={() => void setLanguage(lang.code, user?.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors ${
                  language === lang.code
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600'
                }`}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </div>

        {/* Para Birimi */}
        <div className="bg-card border border-border rounded-2xl p-4">
          <h2 className="text-sm font-semibold mb-2">{t('settings.currency')}</h2>
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
              <span className="font-medium text-gray-800 dark:text-foreground">{t('settings.change_password')}</span>
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
                  <label className="text-sm text-gray-600 dark:text-muted-foreground mb-1 block">{t('settings.current_password')}</label>
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
                  <label className="text-sm text-gray-600 dark:text-muted-foreground mb-1 block">{t('settings.new_password')}</label>
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
                  <label className="text-sm text-gray-600 dark:text-muted-foreground mb-1 block">{t('settings.new_password_confirm')}</label>
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
                  {isChangingPassword ? t('settings.updating') : t('settings.update_password')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Zeeky kişiliği */}
        <div className="bg-card border border-border rounded-2xl p-4">
          <h2 className="text-sm font-semibold mb-1">{t('settings.personality')}</h2>
          <p className="text-[11px] text-muted-foreground mb-3">{t('settings.personality_desc')}</p>
          {prefsLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {personalityOptions.map(opt => (
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
            <span className="text-sm font-medium">{t('settings.dark_mode')}</span>
          </div>
          <Toggle on={theme === 'dark'} onToggle={toggle} />
        </div>

        {/* Notifications */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm dark:bg-card dark:border-border">
          <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100 dark:border-border">
            <div className="flex items-center gap-3">
              <span>🔔</span>
              <div>
                <p className="font-medium text-sm text-gray-900 dark:text-foreground">{t('settings.notifications')}</p>
                <p className="text-xs text-gray-400 dark:text-muted-foreground">{t('settings.notifications_desc')}</p>
              </div>
            </div>
            <Toggle
              value={allNotificationsEnabled}
              onChange={() => void toggleAllNotifications()}
              disabled={!userId || prefsLoading}
            />
          </div>
          {([
            {
              key: 'daily_motivation',
              icon: '💪',
              label: t('settings.notif_daily_motivation'),
              desc: t('settings.notif_daily_motivation_desc'),
            },
            {
              key: 'weekly_summary',
              icon: '📊',
              label: t('settings.notif_weekly_summary'),
              desc: t('settings.notif_weekly_summary_desc'),
            },
          ] as const).map(item => (
            <div
              key={item.key}
              className="flex items-center justify-between px-4 py-3 border-b border-gray-100 last:border-0 dark:border-border"
            >
              <div className="flex items-center gap-3">
                <span>{item.icon}</span>
                <div>
                  <p className="text-sm text-gray-700 dark:text-foreground/90">{item.label}</p>
                  <p className="text-xs text-gray-400 dark:text-muted-foreground">{item.desc}</p>
                </div>
              </div>
              <Toggle
                value={notifications[item.key] ?? true}
                onChange={v => void updateNotification(item.key, v)}
                disabled={!userId || prefsLoading}
              />
            </div>
          ))}
        </div>

        {/* Görüş & Öneriler */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => setFeedbackOpen(o => !o)}
            className="flex items-center justify-between w-full px-4 py-4"
          >
            <h2 className="text-sm font-semibold">{t('settings.feedback_title')}</h2>
            {feedbackOpen
              ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
              : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>
          {feedbackOpen && (
            <div className="px-4 pb-4">
              <textarea
                value={feedbackText}
                onChange={e => setFeedbackText(e.target.value.slice(0, 500))}
                placeholder={t('settings.feedback_placeholder')}
                rows={4}
                className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground resize-none outline-none focus:border-primary transition-colors"
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-muted-foreground">
                  {t('settings.feedback_char_count', { count: feedbackText.length })}
                </span>
                <button
                  type="button"
                  onClick={() => void handleFeedbackSend()}
                  disabled={!feedbackText.trim() || feedbackSending}
                  className="px-5 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40 active:scale-[0.97] transition-transform"
                >
                  {feedbackSending ? <Loader2 className="w-4 h-4 animate-spin" /> : t('settings.feedback_send')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Admin Paneli */}
        {isAdmin && (
          <button
            type="button"
            onClick={() => navigate('/admin')}
            className="flex items-center justify-between w-full px-4 py-4 bg-red-50 dark:bg-red-900/20 rounded-2xl border border-red-200 dark:border-red-800"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
                🛡️
              </div>
              <p className="font-medium text-sm text-red-700 dark:text-red-400">
                Admin Paneli
              </p>
            </div>
            <span className="text-red-400">›</span>
          </button>
        )}

        {/* About */}
        <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
          <Info className="w-5 h-5 text-primary" />
          <div>
            <span className="text-sm font-medium block">{t('settings.about')}</span>
            <span className="text-xs text-muted-foreground">Zeeky v1.0.0</span>
          </div>
        </div>
      </div>

      {showPremiumModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setShowPremiumModal(false)}
        >
          <div
            className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-t-3xl p-6 pb-10"
            onClick={e => e.stopPropagation()}
          >
            <div className="text-center mb-6">
              <div className="text-4xl mb-2">⭐</div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Zeeky Premium
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {t('settings.coming_soon_payment')}
              </p>
            </div>

            <div className="space-y-3 mb-6">
              {[
                { icon: '💬', text: t('settings.feature_unlimited') },
                { icon: '⚡', text: t('settings.feature_priority') },
                { icon: '📊', text: t('settings.feature_insights') },
                { icon: '🎯', text: t('settings.feature_no_activity_limit') },
              ].map((f, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800 rounded-2xl px-4 py-3"
                >
                  <span className="text-xl">{f.icon}</span>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {f.text}
                  </p>
                </div>
              ))}
            </div>

            {settings.campaign_active && settings.campaign_label && (
              <div className="bg-orange-500 text-white text-xs font-bold px-3 py-1.5 rounded-full text-center mb-3">
                🎉 {settings.campaign_label}
              </div>
            )}
            {settings.campaign_active && settings.campaign_desc && (
              <p className="text-xs text-orange-500 text-center mb-3">{settings.campaign_desc}</p>
            )}

            <div className="flex gap-3 mb-4">
              <div className="flex-1 border-2 border-gray-200 dark:border-gray-700 rounded-2xl p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">{t('settings.monthly')}</p>
                {settings.campaign_active && (
                  <p className="text-sm text-gray-400 line-through">{settings.premium_monthly_price}{currencySymbol}</p>
                )}
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {monthlyPrice}{currencySymbol}
                </p>
                <p className="text-xs text-gray-400">{t('settings.per_month')}</p>
              </div>
              <div className="flex-1 border-2 border-blue-500 rounded-2xl p-4 text-center relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-xs px-3 py-0.5 rounded-full">
                  {t('settings.best_value')}
                </div>
                <p className="text-xs text-gray-500 mb-1">{t('settings.yearly')}</p>
                {settings.campaign_active && (
                  <p className="text-sm text-gray-400 line-through">{settings.premium_yearly_price}{currencySymbol}</p>
                )}
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {yearlyPrice}{currencySymbol}
                </p>
                <p className="text-xs text-gray-400">{t('settings.per_year')}</p>
              </div>
            </div>

            {settings.campaign_active && settings.campaign_end_date && (
              <CampaignCountdown endDate={settings.campaign_end_date} />
            )}

            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-4 mb-4">
              <p className="text-sm text-blue-600 dark:text-blue-400 text-center">
                🚀 {t('settings.coming_soon_payment')}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowPremiumModal(false)}
              className="w-full py-3 rounded-2xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 text-sm font-medium active:opacity-70"
            >
              {t('common.close')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
