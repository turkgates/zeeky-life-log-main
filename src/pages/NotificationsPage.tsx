import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BellOff, CheckCheck, Loader2, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { useNotificationStore } from '@/store/useNotificationStore';

const USER_ID = '520ffdd8-fd9e-472f-a388-021bded37b7f';

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

const MONTH_NAMES = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatGroupLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const toYMD = (dt: Date) => dt.toISOString().split('T')[0];
  if (toYMD(d) === toYMD(today))     return 'Bugün';
  if (toYMD(d) === toYMD(yesterday)) return 'Dün';
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

function groupByDate(items: Notification[]): { label: string; items: Notification[] }[] {
  const map = new Map<string, Notification[]>();
  for (const n of items) {
    const label = formatGroupLabel(n.created_at);
    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(n);
  }
  return Array.from(map.entries()).map(([label, items]) => ({ label, items }));
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { setUnreadCount } = useNotificationStore();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [longPressId, setLongPressId] = useState<string | null>(null);
  const longPressTimer = { current: 0 };

  const refreshUnreadCount = useCallback(async () => {
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', USER_ID)
      .eq('is_read', false);
    setUnreadCount(count ?? 0);
  }, [setUnreadCount]);

  const loadNotifications = useCallback(async () => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', USER_ID)
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) setNotifications(data as Notification[]);
    await refreshUnreadCount();
  }, [refreshUnreadCount]);

  const generateNotifications = useCallback(async () => {
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
          body: JSON.stringify({ user_id: USER_ID }),
        }
      );
    } catch (e) {
      console.error('generateNotifications error:', e);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await generateNotifications();
      await loadNotifications();
      setIsLoading(false);
    };
    void init();
  }, [generateNotifications, loadNotifications]);

  const markAsRead = async (n: Notification) => {
    if (!n.is_read) {
      await supabase.from('notifications').update({ is_read: true }).eq('id', n.id);
      setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x));
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
    if (n.navigate_to) navigate(n.navigate_to);
  };

  const markAllRead = async () => {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', USER_ID)
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

  const groups = groupByDate(notifications);
  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="min-h-screen bg-background max-w-[430px] mx-auto flex flex-col">

      {/* Header */}
      <div className="bg-primary text-primary-foreground px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center rounded-full active:bg-white/10">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="flex-1 text-base font-semibold">Bildirimler</h1>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 text-xs font-medium active:bg-white/25"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            Tümünü oku
          </button>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="text-sm">Yükleniyor...</p>
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground px-8">
          <BellOff className="w-16 h-16 opacity-30" />
          <p className="text-sm font-medium">Henüz bildirim yok</p>
        </div>
      ) : (
        <div className="flex-1 pb-6">
          {groups.map(group => (
            <div key={group.label}>
              <p className="px-4 pt-4 pb-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                {group.label}
              </p>
              <div className="px-4 space-y-2">
                {group.items.map(n => (
                  <div key={n.id} className="relative">
                    <button
                      onClick={() => void markAsRead(n)}
                      onMouseDown={() => handleLongPressStart(n.id)}
                      onMouseUp={handleLongPressEnd}
                      onTouchStart={() => handleLongPressStart(n.id)}
                      onTouchEnd={handleLongPressEnd}
                      className={cn(
                        "w-full flex items-start gap-3 p-3.5 rounded-xl border text-left active:scale-[0.98] transition-all",
                        n.is_read
                          ? "bg-card border-border"
                          : "bg-blue-50 dark:bg-blue-950/30 border-blue-100 dark:border-blue-900"
                      )}
                    >
                      {/* Unread dot */}
                      {!n.is_read && (
                        <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-blue-500" />
                      )}

                      {/* Icon */}
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-lg"
                        style={{ backgroundColor: (n.color ?? '#6366f1') + '20' }}
                      >
                        {n.icon ?? '🔔'}
                      </div>

                      {/* Text */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className={cn("text-sm truncate", !n.is_read ? "font-semibold text-foreground" : "font-medium text-foreground/80")}>
                            {n.title}
                          </p>
                          <span className="text-[10px] text-muted-foreground flex-shrink-0">
                            {formatTime(n.created_at)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.content}</p>
                      </div>
                    </button>

                    {/* Long-press delete action */}
                    {longPressId === n.id && (
                      <div className="absolute inset-0 z-10 rounded-xl bg-black/40 flex items-center justify-center gap-3"
                        onClick={() => setLongPressId(null)}
                      >
                        <button
                          onClick={e => { e.stopPropagation(); void deleteNotification(n.id); }}
                          className="flex items-center gap-1.5 px-4 py-2 bg-destructive text-white rounded-xl text-sm font-semibold"
                        >
                          <Trash2 className="w-4 h-4" /> Sil
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); setLongPressId(null); }}
                          className="px-4 py-2 bg-card text-foreground rounded-xl text-sm font-semibold"
                        >
                          İptal
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
