import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { useNotificationStore } from '@/store/useNotificationStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useLanguageStore } from '@/store/useLanguageStore';
import { useTranslation } from 'react-i18next';
import { getLocalDayUTCRangeISO } from '@/lib/dateUtils';

interface Notification {
  id: string;
  title: string;
  content: string;
  icon?: string;
  color?: string;
  is_read: boolean;
  created_at: string;
  navigate_to?: string;
}

function formatTime(dateStr: string, t: (key: string, opts?: Record<string, unknown>) => string, locale: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return t('notifications.just_now');
  if (mins < 60) return t('notifications.minutes_ago', { count: mins });
  if (hours < 24) return t('notifications.hours_ago', { count: hours });
  if (days === 1) return t('notifications.yesterday');
  return date.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
  });
}

function startOfWeekMonday(d: Date): Date {
  const copy = new Date(d);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function getGroupLabel(iso: string, t: (key: string) => string, locale: string): string {
  const d = new Date(iso);
  const dOnly = new Date(d);
  dOnly.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today.getTime() - dOnly.getTime()) / 86400000);
  if (diffDays === 0) return t('notifications.today');
  if (diffDays === 1) return t('notifications.yesterday');
  const weekStart = startOfWeekMonday(today);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);
  if (dOnly >= weekStart && dOnly < weekEnd) return t('notifications.this_week');
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
}

function groupNotifications(items: Notification[], t: (key: string) => string, locale: string): { label: string; items: Notification[] }[] {
  const todayLabel = t('notifications.today');
  const yesterdayLabel = t('notifications.yesterday');
  const thisWeekLabel = t('notifications.this_week');
  const GROUP_ORDER = [todayLabel, yesterdayLabel, thisWeekLabel];
  const map = new Map<string, Notification[]>();
  for (const n of items) {
    const label = getGroupLabel(n.created_at, t, locale);
    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(n);
  }
  const entries = Array.from(map.entries()).map(([label, groupItems]) => ({ label, items: groupItems }));
  return entries.sort((a, b) => {
    const ia = GROUP_ORDER.indexOf(a.label);
    const ib = GROUP_ORDER.indexOf(b.label);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    const ta = a.items[0]?.created_at ?? '';
    const tb = b.items[0]?.created_at ?? '';
    return tb.localeCompare(ta);
  });
}

export default function NotificationsPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'fr' ? 'fr-FR' : i18n.language === 'en' ? 'en-GB' : 'tr-TR';
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { language } = useLanguageStore();
  const userId = user?.id || '';
  const { setUnreadCount } = useNotificationStore();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [longPressId, setLongPressId] = useState<string | null>(null);
  const longPressTimer = { current: 0 };

  const refreshUnreadCount = useCallback(async () => {
    if (!userId) {
      setUnreadCount(0);
      return;
    }
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);
    setUnreadCount(count ?? 0);
  }, [setUnreadCount, userId]);

  const loadNotifications = useCallback(async () => {
    if (!userId) {
      setNotifications([]);
      return;
    }
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) setNotifications(data as Notification[]);
    await refreshUnreadCount();
  }, [refreshUnreadCount, userId]);

  const generateNotifications = useCallback(async () => {
    if (!userId) return;
    const lang = useLanguageStore.getState().language;
    try {
      await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zeeky-notifications`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY as string,
          },
          body: JSON.stringify({
            user_id: userId,
            language: lang,
          }),
        }
      );
    } catch (e) {
      console.error('generateNotifications error:', e);
    }
  }, [userId]);

  const regenerateNotifications = useCallback(async () => {
    if (!userId) return;
    const { start: todayStart, end: todayEnd } = getLocalDayUTCRangeISO(new Date());
    await supabase
      .from('notifications')
      .delete()
      .eq('user_id', userId)
      .eq('is_read', false)
      .gte('created_at', todayStart)
      .lte('created_at', todayEnd);
    await generateNotifications();
    await loadNotifications();
  }, [userId, generateNotifications, loadNotifications]);

  const checkAndGenerate = useCallback(async () => {
    if (!userId) return;
    const lang = useLanguageStore.getState().language;
    const { start: todayStart, end: todayEnd } = getLocalDayUTCRangeISO(new Date());

    const { data: todayNotifs } = await supabase
      .from('notifications')
      .select('id, title')
      .eq('user_id', userId)
      .gte('created_at', todayStart)
      .lte('created_at', todayEnd)
      .limit(1);

    if (!todayNotifs || todayNotifs.length === 0) {
      await generateNotifications();
    } else {
      const firstTitle = todayNotifs[0].title;
      const isTurkish = /[çğışöüÇĞİŞÖÜ]/.test(firstTitle);
      const isFrench = /[àâçéèêëîïôùûüÀÂÇÉÈÊËÎÏÔÙÛÜ]/.test(firstTitle);

      const needsRegenerate =
        (lang === 'tr' && !isTurkish && isFrench) ||
        (lang === 'en' && (isTurkish || isFrench)) ||
        (lang === 'fr' && !isFrench && isTurkish);

      if (needsRegenerate) {
        await regenerateNotifications();
        return;
      }
    }

    await loadNotifications();
  }, [userId, generateNotifications, loadNotifications, regenerateNotifications]);

  const languageEffectReady = useRef(false);
  const prevUserIdForLangEffect = useRef(userId);

  useEffect(() => {
    if (prevUserIdForLangEffect.current !== userId) {
      prevUserIdForLangEffect.current = userId;
      languageEffectReady.current = false;
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    if (!languageEffectReady.current) {
      languageEffectReady.current = true;
      return;
    }
    void regenerateNotifications();
  }, [language, userId, regenerateNotifications]);

  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      setUnreadCount(0);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    void checkAndGenerate().finally(() => setIsLoading(false));
  }, [userId, checkAndGenerate, setUnreadCount]);

  const markAsRead = async (id: string) => {
    const n = notifications.find(x => x.id === id);
    if (!n) return;
    if (!n.is_read) {
      await supabase.from('notifications').update({ is_read: true }).eq('id', id);
      setNotifications(prev => prev.map(x => x.id === id ? { ...x, is_read: true } : x));
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
    if (n.navigate_to) navigate(n.navigate_to);
  };

  const markAllRead = async () => {
    if (!userId) return;
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);
    setNotifications(prev => prev.map(x => ({ ...x, is_read: true })));
    setUnreadCount(0);
  };

  const deleteNotification = async (id: string) => {
    await supabase.from('notifications').delete().eq('id', id);
    setNotifications(prev => {
      const updated = prev.filter(x => x.id !== id);
      const unread = updated.filter(x => !x.is_read).length;
      setUnreadCount(unread);
      return updated;
    });
    setLongPressId(null);
  };

  const handleLongPressStart = (id: string) => {
    longPressTimer.current = window.setTimeout(() => setLongPressId(id), 500);
  };

  const handleLongPressEnd = () => {
    clearTimeout(longPressTimer.current);
  };

  const groups = useMemo(() => groupNotifications(notifications, t, locale), [notifications, t, locale]);

  if (!userId) {
    return (
      <div className="min-h-screen bg-gray-50 w-full flex flex-col">
        <div className="bg-blue-600 text-white px-4 py-3 flex items-center gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex items-center justify-center rounded-full active:bg-white/10"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="flex-1 text-base font-semibold">{t('notifications.title')}</h1>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center text-gray-500 text-sm">
          <p>{t('notifications.login_required')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 w-full flex flex-col">

      {/* Header */}
      <div className="bg-blue-600 text-white px-4 py-3 flex items-center gap-3 flex-shrink-0">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="w-10 h-10 flex items-center justify-center rounded-full active:bg-white/10"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="flex-1 text-base font-semibold">{t('notifications.title')}</h1>
        {notifications.some(n => !n.is_read) && (
          <button
            type="button"
            onClick={() => void markAllRead()}
            className="text-xs font-medium text-white/90 active:opacity-80"
          >
            {t('notifications.mark_all_read')}
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="text-sm">{t('notifications.loading')}</p>
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-gray-400 px-6">
          <span className="text-5xl mb-4">🔔</span>
          <p className="font-medium">{t('notifications.no_notifications')}</p>
          <p className="text-sm mt-1 text-center">{t('notifications.no_notifications_sub')}</p>
        </div>
      ) : (
        <div className="flex-1 px-4 py-3 pb-8">
          {groups.map(group => (
            <div key={group.label} className="mb-4">
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2 px-0.5">
                {group.label}
              </p>
              <div className="space-y-2">
                {group.items.map(n => (
                  <div key={n.id} className="relative">
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => void markAsRead(n.id)}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') void markAsRead(n.id); }}
                      onMouseDown={() => handleLongPressStart(n.id)}
                      onMouseUp={handleLongPressEnd}
                      onMouseLeave={handleLongPressEnd}
                      onTouchStart={() => handleLongPressStart(n.id)}
                      onTouchEnd={handleLongPressEnd}
                      className={cn(
                        'flex items-start gap-3 p-4 rounded-2xl mb-2 cursor-pointer border border-gray-100 shadow-sm',
                        n.is_read ? 'bg-white' : 'bg-blue-50',
                      )}
                    >
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0"
                        style={{ backgroundColor: (n.color ?? '#6366f1') + '20' }}
                      >
                        {n.icon ?? '🔔'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-semibold text-sm text-gray-800">{n.title}</p>
                          {!n.is_read && (
                            <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1" />
                          )}
                        </div>
                        <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">{n.content}</p>
                        <p className="text-xs text-gray-400 mt-1">{formatTime(n.created_at, t, locale)}</p>
                      </div>
                    </div>

                    {longPressId === n.id && (
                      <div
                        className="absolute inset-0 z-10 rounded-2xl bg-black/40 flex items-center justify-center gap-3"
                        onClick={() => setLongPressId(null)}
                      >
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); void deleteNotification(n.id); }}
                          className="flex items-center gap-1.5 px-4 py-2 bg-destructive text-white rounded-xl text-sm font-semibold"
                        >
                          <Trash2 className="w-4 h-4" /> {t('notifications.delete')}
                        </button>
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); setLongPressId(null); }}
                          className="px-4 py-2 bg-white text-gray-800 rounded-xl text-sm font-semibold"
                        >
                          {t('notifications.cancel')}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
