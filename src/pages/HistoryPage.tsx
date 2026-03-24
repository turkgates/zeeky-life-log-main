import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, X, InboxIcon, Star, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import CategoryIcon from '@/components/CategoryIcon';
import SwipeableCard from '@/components/SwipeableCard';
import ActivityDetailSheet from '@/components/ActivityDetailSheet';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  fetchActivitiesByDate,
  fetchFavoriteActivities,
  fetchPendingSuggestions,
  updateSuggestionStatus,
  quickLogFavorite,
  deleteActivityById,
  FavoriteActivity,
  Suggestion,
  TEST_USER_ID,
} from '@/lib/activitySupabase';
import { supabase } from '@/lib/supabase';
import { Activity } from '@/types/zeeky';
import { useCurrencyStore } from '@/store/useCurrencyStore';
import { useActivityRefresh } from '@/store/useActivityRefresh';

const MONTH_NAMES = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const DAY_SHORT = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
const DAY_NAMES = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateHeader(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00');
  if (Number.isNaN(d.getTime())) return dateStr;
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}, ${DAY_NAMES[d.getDay()]}`;
}

function getWeekDays(base: Date): Date[] {
  const start = new Date(base);
  const dow = start.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  start.setDate(start.getDate() + diff);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

export default function HistoryPage() {
  const navigate       = useNavigate();
  const currencySymbol = useCurrencyStore(s => s.symbol);
  const refreshKey     = useActivityRefresh(s => s.key);

  // Calendar state
  const [currentWeekBase, setCurrentWeekBase] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(toYMD(new Date()));
  const [datesWithData, setDatesWithData] = useState<Set<string>>(new Set());

  // Activities for selected day
  const [dayActivities, setDayActivities] = useState<Activity[]>([]);
  const [dayLoading, setDayLoading] = useState(true);

  // Favorites
  const [favorites, setFavorites] = useState<FavoriteActivity[]>([]);

  // Suggestions
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [activeSlide, setActiveSlide] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Card state
  const [swipedCardId, setSwipedCardId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);

  const weekDays = getWeekDays(currentWeekBase);

  // ── Derive visible month from the first day of the displayed week ────────
  const viewYear  = weekDays[0].getFullYear();
  const viewMonth = weekDays[0].getMonth();

  // ── Load dates that have activities for the visible month (for dots) ──────
  const loadDatesForMonth = useCallback(async (year: number, month: number) => {
    const startOfMonth = new Date(year, month, 1).toISOString();
    const endOfMonth   = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
    const { data } = await supabase
      .from('activities')
      .select('activity_date')
      .eq('user_id', TEST_USER_ID)
      .gte('activity_date', startOfMonth)
      .lte('activity_date', endOfMonth);
    if (data) {
      setDatesWithData(new Set(data.map(r => toYMD(new Date(r.activity_date as string)))));
    }
  }, []);

  useEffect(() => {
    void loadDatesForMonth(viewYear, viewMonth);
  }, [viewYear, viewMonth, loadDatesForMonth, refreshKey]);

  // ── Load activities for selected day ─────────────────────────────────────
  const loadDayActivities = useCallback(async (date: string) => {
    setDayLoading(true);
    try {
      const list = await fetchActivitiesByDate(date);
      setDayActivities(list);
    } finally {
      setDayLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDayActivities(selectedDate);
  }, [selectedDate, loadDayActivities, refreshKey]);

  // ── Load favorites ────────────────────────────────────────────────────────
  useEffect(() => {
    fetchFavoriteActivities().then(setFavorites);
  }, []);

  // ── Load suggestions ──────────────────────────────────────────────────────
  useEffect(() => {
    fetchPendingSuggestions().then(setSuggestions);
  }, []);

  // ── Suggestions scroll dot ────────────────────────────────────────────────
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const el = scrollRef.current;
    const cardWidth = el.firstElementChild?.clientWidth || 1;
    setActiveSlide(Math.round(el.scrollLeft / cardWidth));
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleDeleteConfirm = async (id: string) => {
    const ok = await deleteActivityById(id);
    if (ok) {
      void loadDayActivities(selectedDate);
      void loadDatesForMonth(viewYear, viewMonth);
    }
    setDeleteConfirm(null);
    setSwipedCardId(null);
  };

  const handleAcceptSuggestion = async (id: string) => {
    await updateSuggestionStatus(id, 'accepted');
    setSuggestions(prev => prev.filter(s => s.id !== id));
  };

  const handleDismissSuggestion = async (id: string) => {
    await updateSuggestionStatus(id, 'skipped');
    setSuggestions(prev => prev.filter(s => s.id !== id));
  };

  const handleQuickLog = async (fav: FavoriteActivity) => {
    const ok = await quickLogFavorite(fav);
    if (ok) {
      toast.success(`${fav.title} kaydedildi ✅`);
      const today = toYMD(new Date());
      if (selectedDate === today) void loadDayActivities(today);
      void loadDatesForMonth(viewYear, viewMonth);
    } else {
      toast.error('Kaydedilemedi, tekrar dene.');
    }
  };

  const prevWeek = () => setCurrentWeekBase(d => { const n = new Date(d); n.setDate(n.getDate() - 7); return n; });
  const nextWeek = () => setCurrentWeekBase(d => { const n = new Date(d); n.setDate(n.getDate() + 7); return n; });

  const monthLabel = (() => {
    const first = weekDays[0];
    const last = weekDays[6];
    if (first.getMonth() === last.getMonth()) {
      return `${MONTH_NAMES[first.getMonth()]} ${first.getFullYear()}`;
    }
    return `${MONTH_NAMES[first.getMonth()]} – ${MONTH_NAMES[last.getMonth()]} ${last.getFullYear()}`;
  })();

  return (
    <div className="pb-24 max-w-[430px] mx-auto animate-fade-in">

      {/* ── Calendar Strip ─────────────────────────────────────────────── */}
      <div className="px-4 pt-4 mb-3">
        <div className="flex items-center justify-between mb-2">
          <button onClick={prevWeek} className="w-8 h-8 flex items-center justify-center rounded-full active:bg-muted">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold">{monthLabel}</span>
          <button onClick={nextWeek} className="w-8 h-8 flex items-center justify-center rounded-full active:bg-muted">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="flex justify-around">
          {weekDays.map(d => {
            const dateStr = toYMD(d);
            const isSelected = dateStr === selectedDate;
            const hasData = datesWithData.has(dateStr);
            return (
              <button
                key={dateStr}
                onClick={() => setSelectedDate(dateStr)}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-2 px-1.5 rounded-xl transition-colors min-w-[40px]",
                  isSelected ? "bg-primary text-primary-foreground" : "text-foreground"
                )}
              >
                <span className="text-[10px] font-medium opacity-70">{DAY_SHORT[d.getDay()]}</span>
                <span className="text-sm font-semibold">{d.getDate()}</span>
                {hasData
                  ? <div className={cn("w-1.5 h-1.5 rounded-full", isSelected ? "bg-primary-foreground" : "bg-primary")} />
                  : <div className="w-1.5 h-1.5" />
                }
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Favorites ──────────────────────────────────────────────────── */}
      {favorites.length > 0 && (
        <div className="px-4 mb-4">
          <h2 className="font-semibold text-sm flex items-center gap-1 mb-3">
            <Star className="w-4 h-4 text-accent" /> Favoriler
          </h2>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-1">
            {favorites.map(fav => (
              <button
                key={fav.id}
                onClick={() => handleQuickLog(fav)}
                className="flex-shrink-0 flex flex-col items-center gap-2 p-3 bg-card rounded-xl border border-border active:scale-95 transition-transform min-w-[80px]"
              >
                <CategoryIcon category={fav.category as import('@/types/zeeky').ActionCategory} size="sm" />
                <span className="text-xs font-medium text-foreground text-center line-clamp-2">{fav.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Suggestions ────────────────────────────────────────────────── */}
      {suggestions.length > 0 && (
        <div className="px-4 mb-5">
          <h2 className="text-xs font-semibold text-muted-foreground mb-2">Öneriler</h2>
          <div
            ref={scrollRef}
            className="flex gap-3 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-2"
            style={{ scrollSnapType: 'x mandatory' }}
          >
            {suggestions.map(s => (
              <div
                key={s.id}
                className="flex-shrink-0 bg-card border border-border rounded-xl p-4"
                style={{ width: '85%', maxWidth: 320, scrollSnapAlign: 'center', whiteSpace: 'normal', wordBreak: 'break-word' }}
              >
                <p className="text-xs mb-3 leading-relaxed">{s.text}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAcceptSuggestion(s.id)}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-success/10 text-success rounded-lg text-xs font-medium active:scale-95"
                  >
                    <Check className="w-3.5 h-3.5" /> Kabul
                  </button>
                  <button
                    onClick={() => handleDismissSuggestion(s.id)}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-destructive/10 text-destructive rounded-lg text-xs font-medium active:scale-95"
                  >
                    <X className="w-3.5 h-3.5" /> Geç
                  </button>
                </div>
              </div>
            ))}
          </div>
          {suggestions.length > 1 && (
            <div className="flex justify-center gap-1.5 mt-2">
              {suggestions.map((_, i) => (
                <div
                  key={i}
                  className={cn("rounded-full transition-all", i === activeSlide ? "w-2.5 h-2.5 bg-primary" : "w-2 h-2 bg-muted-foreground/30")}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Activities for selected day ─────────────────────────────────── */}
      <div className="px-4">
        <h3 className="text-xs font-semibold text-muted-foreground mb-3">{formatDateHeader(selectedDate)}</h3>
        {dayLoading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
            <p className="text-xs text-muted-foreground">Yükleniyor…</p>
          </div>
        ) : dayActivities.length === 0 ? (
          <div className="text-center py-12">
            <InboxIcon className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Bu gün için aktivite yok</p>
          </div>
        ) : (
          <div className="space-y-2">
            {dayActivities.map(a => {
              const amount = a.details?.amount as number | undefined;
              return (
                <SwipeableCard
                  key={a.id}
                  isOpen={swipedCardId === a.id}
                  onSwipeOpen={() => setSwipedCardId(prev => prev === a.id ? null : a.id)}
                  onEdit={() => { setSwipedCardId(null); navigate('/add', { state: { editId: a.id, category: a.category } }); }}
                  onDelete={() => setDeleteConfirm(a.id)}
                >
                  <div className="flex items-center gap-3 p-3" onClick={() => setSelectedActivity(a)}>
                    <CategoryIcon category={a.category} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{a.title}</p>
                      {amount != null && (
                        <p className="text-xs font-medium text-foreground">
                          {amount.toLocaleString('tr-TR')} {currencySymbol}
                        </p>
                      )}
                      {a.note && <p className="text-xs text-muted-foreground truncate">{a.note}</p>}
                    </div>
                    <span className="text-xs text-muted-foreground tabular-nums">{a.time}</span>
                  </div>
                </SwipeableCard>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Delete Confirmation ────────────────────────────────────────── */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-card rounded-2xl p-6 mx-8 shadow-xl" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-medium text-center mb-4">Bu aktiviteyi silmek istediğine emin misin?</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 rounded-xl bg-muted text-muted-foreground font-semibold text-sm">İptal</button>
              <button onClick={() => handleDeleteConfirm(deleteConfirm)} className="flex-1 py-2.5 rounded-xl bg-destructive text-destructive-foreground font-semibold text-sm">Sil</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Activity Detail Sheet ──────────────────────────────────────── */}
      {selectedActivity && (
        <ActivityDetailSheet
          activity={selectedActivity}
          onClose={() => setSelectedActivity(null)}
          onDelete={async id => {
            await deleteActivityById(id);
            void loadDayActivities(selectedDate);
            void loadDatesForMonth(viewYear, viewMonth);
            setSelectedActivity(null);
          }}
        />
      )}
    </div>
  );
}
