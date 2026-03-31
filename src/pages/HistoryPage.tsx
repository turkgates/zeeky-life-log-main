import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, Loader2, ChevronLeft, ChevronRight, MoreHorizontal, Edit2, StarOff, Trash2, Search, Plus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getActivityCategory } from '@/lib/categoryTranslations';
import { HighlightMatch } from '@/components/HighlightMatch';
import CategoryIcon from '@/components/CategoryIcon';
import SwipeableCard from '@/components/SwipeableCard';
import ActivityDetailSheet from '@/components/ActivityDetailSheet';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  fetchActivitiesByDate,
  fetchFavoriteActivities,
  FavoriteActivity,
  mapRowToActivity,
} from '@/lib/activitySupabase';
import { supabase } from '@/lib/supabase';

const deleteActivityById = async (id: string) => {
  const { error } = await supabase
    .from('activities')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return true;
};
import { Activity } from '@/types/zeeky';
import { useCurrencyStore } from '@/store/useCurrencyStore';
import { useActivityRefresh } from '@/store/useActivityRefresh';
import { useAuthStore } from '@/store/useAuthStore';
import {
  formatDate,
  getDayName,
  getMonthName,
  getLocaleTag,
  formatActivityDate,
  activityDateTimeSource,
} from '@/lib/dateLocale';
import { formatDuration, getActivityDurationMins } from '@/lib/durationFormat';

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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

const SEARCH_GROUP_ORDER = ['today', 'yesterday', 'this_week', 'this_month', 'older'] as const;
type SearchGroupId = (typeof SEARCH_GROUP_ORDER)[number];

function getActivityGroupId(dateStr: string): SearchGroupId {
  const today = toYMD(new Date());
  const yesterday = toYMD(new Date(Date.now() - 86_400_000));
  if (dateStr === today) return 'today';
  if (dateStr === yesterday) return 'yesterday';
  const d = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) return 'older';
  const now = new Date();
  const start = new Date(now);
  const dow = start.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  start.setDate(start.getDate() + diff);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  if (d >= start && d <= end) return 'this_week';
  if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) return 'this_month';
  return 'older';
}

export default function HistoryPage() {
  const { t, i18n } = useTranslation();
  const navigate       = useNavigate();
  const { user }       = useAuthStore();
  const userId         = user?.id ?? '';
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
  const [favActionSheet, setFavActionSheet] = useState<FavoriteActivity | null>(null);
  const [favDeleteConfirm, setFavDeleteConfirm] = useState<FavoriteActivity | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Card state
  const [swipedCardId, setSwipedCardId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);

  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Activity[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const weekDays = getWeekDays(currentWeekBase);

  const isGlobalSearch = showSearch && searchQuery.length >= 2;

  const groupedSearchResults = useMemo(() => {
    const buckets: Record<SearchGroupId, Activity[]> = {
      today: [],
      yesterday: [],
      this_week: [],
      this_month: [],
      older: [],
    };
    searchResults.forEach(a => {
      buckets[getActivityGroupId(a.date)].push(a);
    });
    return SEARCH_GROUP_ORDER
      .filter(id => buckets[id].length > 0)
      .map(id => ({ groupId: id, items: buckets[id] }));
  }, [searchResults]);

  const searchAllActivities = useCallback(async (q: string) => {
    if (!userId || q.length < 2) return;
    setSearchLoading(true);
    try {
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('user_id', userId)
        .ilike('title', `%${q}%`)
        .order('activity_date', { ascending: false })
        .limit(20);
      if (error) {
        console.error('searchAllActivities:', error);
        setSearchResults([]);
        return;
      }
      setSearchResults((data || []).map(r => mapRowToActivity(r as Record<string, unknown>)));
    } finally {
      setSearchLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    void searchAllActivities(searchQuery);
  }, [searchQuery, searchAllActivities]);

  const closeSearch = () => {
    setShowSearch(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  // Derive visible month from the first day of the displayed week
  const viewYear  = weekDays[0].getFullYear();
  const viewMonth = weekDays[0].getMonth();

  // Load dates that have activities for the visible month (for dots)
  const loadDatesForMonth = useCallback(async (year: number, month: number) => {
    if (!userId) return;
    const startOfMonth = new Date(year, month, 1).toISOString();
    const endOfMonth   = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
    const { data } = await supabase
      .from('activities')
      .select('activity_date')
      .eq('user_id', userId)
      .gte('activity_date', startOfMonth)
      .lte('activity_date', endOfMonth);
    if (data) {
      setDatesWithData(new Set(data.map(r => toYMD(new Date(r.activity_date as string)))));
    }
  }, [userId]);

  useEffect(() => {
    void loadDatesForMonth(viewYear, viewMonth);
  }, [viewYear, viewMonth, loadDatesForMonth, refreshKey]);

  // Load activities for selected day
  const loadDayActivities = useCallback(async (date: string) => {
    setDayLoading(true);
    try {
      const list = await fetchActivitiesByDate(userId, date);
      setDayActivities(list);
    } finally {
      setDayLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadDayActivities(selectedDate);
  }, [selectedDate, loadDayActivities, refreshKey]);

  // Load favorites
  const loadFavorites = useCallback(async () => {
    const list = await fetchFavoriteActivities(userId);
    setFavorites(list);
  }, [userId]);

  useEffect(() => {
    void loadFavorites();
  }, [loadFavorites]);

  // Handlers
  const handleDeleteConfirm = async (id: string) => {
    try {
      await deleteActivityById(id);
      void loadDayActivities(selectedDate);
      void loadDatesForMonth(viewYear, viewMonth);
      if (searchQuery.length >= 2) void searchAllActivities(searchQuery);
    } catch (e) {
      console.error('deleteActivityById', e);
    }
    setDeleteConfirm(null);
    setSwipedCardId(null);
  };

  const handleQuickLog = async (fav: FavoriteActivity) => {
    if (!userId) return;
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('activities')
      .insert({
        user_id:      userId,
        title:        fav.title,
        category:     fav.category,
        amount:       fav.amount ?? null,
        duration_mins: fav.duration_mins ?? null,
        location:     fav.location ?? null,
        people:       fav.people ?? [],
        activity_date: now,
        created_via:  'manual',
        raw_message:  fav.raw_message ?? fav.title,
        is_favorite:  false,
      });

    console.log('Quick log result:', data, error);

    if (!error) {
      toast.success(`"${fav.title}" bugüne eklendi!`);
      const today = toYMD(new Date());
      if (selectedDate === today) void loadDayActivities(today);
      void loadDatesForMonth(viewYear, viewMonth);
    } else {
      toast.error('Eklenirken hata oluştu');
      console.error('Quick log error:', error);
    }
  };

  const removeFromFavorites = async (fav: FavoriteActivity) => {
    if (!userId) return;
    const { error } = await supabase
      .from('activities')
      .update({ is_favorite: false })
      .eq('id', fav.id)
      .eq('user_id', userId);
    if (!error) {
      toast.success('Favorilerden çıkarıldı');
      await loadFavorites();
    } else {
      toast.error('Hata oluştu');
    }
    setFavActionSheet(null);
  };

  const deleteFavorite = async (fav: FavoriteActivity) => {
    setFavActionSheet(null);
    setFavDeleteConfirm(fav);
  };

  const confirmDeleteFavorite = async (fav: FavoriteActivity) => {
    if (!userId) return;
    const { error } = await supabase
      .from('activities')
      .delete()
      .eq('id', fav.id)
      .eq('user_id', userId);
    if (!error) {
      toast.success('Eylem silindi');
      await loadFavorites();
      void loadDayActivities(selectedDate);
      void loadDatesForMonth(viewYear, viewMonth);
    } else {
      toast.error('Silinemedi');
    }
    setFavDeleteConfirm(null);
  };

  // Long press handlers for favorite cards
  const handleFavPressStart = (fav: FavoriteActivity) => {
    longPressTimerRef.current = setTimeout(() => {
      setFavActionSheet(fav);
    }, 500);
  };

  const handleFavPressEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const prevWeek = () => setCurrentWeekBase(d => { const n = new Date(d); n.setDate(n.getDate() - 7); return n; });
  const nextWeek = () => setCurrentWeekBase(d => { const n = new Date(d); n.setDate(n.getDate() + 7); return n; });

  const monthLabel = useMemo(() => {
    const first = weekDays[0];
    const last = weekDays[6];
    const loc = getLocaleTag();
    if (first.getMonth() === last.getMonth() && first.getFullYear() === last.getFullYear()) {
      return getMonthName(first);
    }
    return `${first.toLocaleDateString(loc, { month: 'long' })} – ${getMonthName(last)}`;
  }, [currentWeekBase, i18n.language]);

  return (
    <div className="pb-24 w-full animate-fade-in">

      {/* ── Title + search (sticky) ───────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-background">
        <div className="px-4 pt-4 pb-2 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-800 dark:text-foreground">{t('history.title')}</h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/add')}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-blue-500 text-white active:opacity-70 transition-opacity"
              aria-label={t('history.add_activity')}
            >
              <Plus size={20} />
            </button>
            <button
              type="button"
              onClick={() => setShowSearch(s => !s)}
              className="p-1.5 rounded-full active:bg-muted"
              aria-label="Ara"
            >
              <Search size={22} className="text-gray-600 dark:text-muted-foreground" />
            </button>
          </div>
        </div>

        {showSearch && (
          <div className="animate-in fade-in slide-in-from-top-1 duration-300 px-4 pb-3 pt-1">
            <div className="relative">
              <input
                autoFocus
                type="search"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={t('history.search_placeholder')}
                className="w-full border border-gray-200 dark:border-border rounded-2xl px-4 py-2.5 pr-10 text-sm focus:outline-none focus:border-blue-400 bg-gray-50 dark:bg-muted"
              />
              <button
                type="button"
                onClick={closeSearch}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-muted-foreground hover:text-foreground"
                aria-label="Aramayı kapat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {isGlobalSearch ? (
        <div className="px-4 mb-4">
          <p className="text-xs text-muted-foreground py-2">
            {searchLoading ? t('history.searching') : t('history.results_count', { count: searchResults.length })}
          </p>
          {searchLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
              <p className="text-xs text-muted-foreground">{t('history.searching')}</p>
            </div>
          ) : searchResults.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">{t('history.no_results')}</p>
          ) : (
            <div className="space-y-4">
              {groupedSearchResults.map(({ groupId, items }) => (
                <div key={groupId}>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">{t(`history.${groupId}`)}</p>
                  <div className="space-y-2">
                    {items.map(a => {
                      const amount = a.details?.amount as number | undefined;
                      const durMins = getActivityDurationMins(a);
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
                              <p className="text-[10px] text-muted-foreground mb-0.5">
                                {getActivityCategory(a.category)} · {formatActivityDate(activityDateTimeSource(a))}
                              </p>
                              <p className="text-sm font-medium truncate">
                                <HighlightMatch text={a.title} query={searchQuery} />
                              </p>
                              {amount != null && (
                                <p className="text-xs font-medium text-foreground">
                                  {amount.toLocaleString('tr-TR')} {currencySymbol}
                                </p>
                              )}
                              {durMins != null && (
                                <p className="text-xs text-muted-foreground">{formatDuration(durMins, t) ?? ''}</p>
                              )}
                              {a.note && <p className="text-xs text-muted-foreground truncate">{a.note}</p>}
                            </div>
                            <span className="text-xs text-muted-foreground tabular-nums">{a.time}</span>
                          </div>
                        </SwipeableCard>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
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
                <span className="text-[10px] font-medium opacity-70">{getDayName(d)}</span>
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
            <Star className="w-4 h-4 text-accent" /> {t('history.favorites')}
          </h2>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-1">
            {favorites.map(fav => (
              <div
                key={fav.id}
                className="flex-shrink-0 relative min-w-[80px]"
              >
                <button
                  onClick={() => handleQuickLog(fav)}
                  onMouseDown={() => handleFavPressStart(fav)}
                  onMouseUp={handleFavPressEnd}
                  onMouseLeave={handleFavPressEnd}
                  onTouchStart={() => handleFavPressStart(fav)}
                  onTouchEnd={handleFavPressEnd}
                  onContextMenu={e => { e.preventDefault(); setFavActionSheet(fav); }}
                  className="flex flex-col items-center gap-2 p-3 bg-card rounded-xl border border-border active:scale-95 transition-transform w-full select-none"
                >
                  <CategoryIcon category={fav.category as import('@/types/zeeky').ActionCategory} size="sm" />
                  <span className="text-xs font-medium text-foreground text-center line-clamp-2">{fav.title}</span>
                </button>
                {/* "..." menu trigger */}
                <button
                  onClick={e => { e.stopPropagation(); setFavActionSheet(fav); }}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-background/80 flex items-center justify-center"
                >
                  <MoreHorizontal className="w-3 h-3 text-muted-foreground" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Activities for selected day ─────────────────────────────────── */}
      <div className="px-4">
        <h3 className="text-xs font-semibold text-muted-foreground mb-3">{formatDate(selectedDate)}</h3>
        {dayLoading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
            <p className="text-xs text-muted-foreground">{t('history.loading')}</p>
          </div>
        ) : dayActivities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mb-4">
              <span className="text-3xl">💬</span>
            </div>
            <p className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-2">
              {t('history.no_activities_title')}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
              {t('history.no_activities_desc')}
            </p>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="mt-5 px-6 py-3 rounded-2xl bg-blue-500 text-white text-sm font-medium active:opacity-70 transition-opacity flex items-center gap-2"
            >
              <span>💬</span>
              {t('history.go_to_chat')}
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {dayActivities.map(a => {
              const amount = a.details?.amount as number | undefined;
              const durMins = getActivityDurationMins(a);
              const at = new Date(activityDateTimeSource(a));
              const timeLabel = Number.isNaN(at.getTime())
                ? a.time
                : at.toLocaleTimeString(getLocaleTag(), { hour: '2-digit', minute: '2-digit' });
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
                      <p className="text-[10px] text-muted-foreground mb-0.5">{getActivityCategory(a.category)}</p>
                      <p className="text-sm font-medium truncate">{a.title}</p>
                      {amount != null && (
                        <p className="text-xs font-medium text-foreground">
                          {amount.toLocaleString('tr-TR')} {currencySymbol}
                        </p>
                      )}
                      {durMins != null && (
                        <p className="text-xs text-muted-foreground">{formatDuration(durMins, t) ?? ''}</p>
                      )}
                      {a.note && <p className="text-xs text-muted-foreground truncate">{a.note}</p>}
                    </div>
                    <span className="text-xs text-muted-foreground tabular-nums">{timeLabel}</span>
                  </div>
                </SwipeableCard>
              );
            })}
          </div>
        )}
      </div>

        </>
      )}

      {/* ── Delete Confirmation ────────────────────────────────────────── */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-card rounded-2xl p-6 mx-8 shadow-xl" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-medium text-center mb-4">{t('history.delete_confirm')}</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 rounded-xl bg-muted text-muted-foreground font-semibold text-sm">{t('history.cancel')}</button>
              <button onClick={() => handleDeleteConfirm(deleteConfirm)} className="flex-1 py-2.5 rounded-xl bg-destructive text-destructive-foreground font-semibold text-sm">{t('history.delete')}</button>
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
            try {
              await deleteActivityById(id);
              void loadDayActivities(selectedDate);
              void loadDatesForMonth(viewYear, viewMonth);
              if (searchQuery.length >= 2) void searchAllActivities(searchQuery);
              setSelectedActivity(null);
            } catch (e) {
              console.error('deleteActivityById', e);
            }
          }}
        />
      )}

      {/* ── Favorite Action Sheet ──────────────────────────────────────── */}
      {favActionSheet && (
        <>
          <div
            className="fixed inset-0 z-[300] bg-black/50"
            onClick={() => setFavActionSheet(null)}
          />
          <div
            className="fixed inset-x-0 bottom-0 z-[301] bg-card rounded-t-3xl shadow-2xl"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>

            {/* Activity name */}
            <div className="px-5 py-3 border-b border-border">
              <div className="flex items-center gap-3">
                <CategoryIcon category={favActionSheet.category as import('@/types/zeeky').ActionCategory} size="sm" />
                <div>
                  <p className="text-sm font-semibold">{favActionSheet.title}</p>
                  <p className="text-xs text-muted-foreground">{t('history.favorite_action')}</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="px-4 py-2 space-y-1">
              <button
                onClick={() => {
                  setFavActionSheet(null);
                  navigate('/add', { state: { editId: favActionSheet.id, category: favActionSheet.category } });
                }}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl active:bg-muted transition-colors text-left"
              >
                <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center">
                  <Edit2 className="w-4 h-4 text-blue-600" />
                </div>
                <span className="text-sm font-medium">{t('history.edit')}</span>
              </button>

              <button
                onClick={() => void removeFromFavorites(favActionSheet)}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl active:bg-muted transition-colors text-left"
              >
                <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center">
                  <StarOff className="w-4 h-4 text-amber-600" />
                </div>
                <span className="text-sm font-medium">{t('history.remove_favorite')}</span>
              </button>

              <button
                onClick={() => void deleteFavorite(favActionSheet)}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl active:bg-muted transition-colors text-left"
              >
                <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center">
                  <Trash2 className="w-4 h-4 text-red-600" />
                </div>
                <span className="text-sm font-medium text-destructive">{t('history.delete')}</span>
              </button>
            </div>

            {/* Cancel */}
            <div className="px-4 pb-4">
              <button
                onClick={() => setFavActionSheet(null)}
                className="w-full py-3.5 rounded-xl bg-muted text-muted-foreground font-semibold text-sm active:opacity-70"
              >
                {t('history.cancel')}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Favorite Delete Confirmation ───────────────────────────────── */}
      {favDeleteConfirm && (
        <div
          className="fixed inset-0 z-[400] flex items-end justify-center bg-black/50 pb-6"
          onClick={() => setFavDeleteConfirm(null)}
        >
          <div
            className="bg-card rounded-2xl p-5 mx-4 shadow-xl w-full max-w-[400px]"
            onClick={e => e.stopPropagation()}
          >
            <p className="text-base font-semibold text-center mb-1">{t('history.delete')}</p>
            <p className="text-sm text-muted-foreground text-center mb-5">
              <span className="font-medium text-foreground">"{favDeleteConfirm.title}"</span> {t('history.delete_confirm')}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setFavDeleteConfirm(null)}
                className="flex-1 py-3 rounded-xl bg-muted text-muted-foreground font-semibold text-sm"
              >
                {t('history.cancel')}
              </button>
              <button
                onClick={() => void confirmDeleteFavorite(favDeleteConfirm)}
                className="flex-1 py-3 rounded-xl bg-destructive text-white font-semibold text-sm"
              >
                {t('history.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
