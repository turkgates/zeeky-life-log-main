import { useState, useEffect, useCallback, useMemo } from 'react';
import { Filter, Check, X, Heart, Coins, Users, Activity, RefreshCw, Loader2, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { HighlightMatch } from '@/components/HighlightMatch';
import { useAuthStore } from '@/store/useAuthStore';
import { useLanguageStore } from '@/store/useLanguageStore';
import { useTranslation } from 'react-i18next';
import { getSuggestionCategory } from '@/lib/categoryTranslations';
import { getLocalDayUTCRangeISO, getLocalISOString } from '@/lib/dateUtils';

type CategoryKey = 'all' | 'sağlık' | 'sosyal' | 'finans' | 'alışkanlık';
type StatusFilter = 'all' | 'pending' | 'accepted' | 'skipped';

const CATEGORY_OPTIONS: { key: CategoryKey; tKey: string }[] = [
  { key: 'all', tKey: 'suggestions.all' },
  { key: 'sağlık', tKey: 'suggestions.health' },
  { key: 'sosyal', tKey: 'suggestions.social' },
  { key: 'finans', tKey: 'suggestions.finance' },
  { key: 'alışkanlık', tKey: 'suggestions.habit' },
];

const STATUS_OPTIONS: { key: StatusFilter; tKey: string }[] = [
  { key: 'all', tKey: 'suggestions.all' },
  { key: 'pending', tKey: 'suggestions.pending' },
  { key: 'accepted', tKey: 'suggestions.accepted' },
  { key: 'skipped', tKey: 'suggestions.skipped' },
];

const CATEGORY_COLORS: Record<string, string> = {
  'sağlık':     '#22c55e',
  'sosyal':     '#3b82f6',
  'finans':     '#f97316',
  'alışkanlık': '#8b5cf6',
};

const CATEGORY_ICONS: Record<string, typeof Activity> = {
  'sağlık':     Activity,
  'sosyal':     Users,
  'finans':     Coins,
  'alışkanlık': Heart,
};

interface Suggestion {
  id: string;
  category: string;
  content: string;
  reason?: string;
  status: string;
  generated_at: string;
  language?: string;
}

async function fetchSuggestions(
  userId: string,
  status: StatusFilter,
  category: CategoryKey,
): Promise<Suggestion[]> {
  if (!userId) return [];
  let query = supabase
    .from('suggestions')
    .select('*')
    .eq('user_id', userId)
    .order('generated_at', { ascending: false });

  if (status !== 'all') {
    query = query.eq('status', status);
  }
  if (category !== 'all') {
    query = query.eq('category', category);
  }

  const { data, error } = await query;
  console.log('Suggestions query:', data, error);
  return (data as Suggestion[]) ?? [];
}

export default function SuggestionsPage() {
  const { t } = useTranslation();
  const { language } = useLanguageStore();
  const { user } = useAuthStore();
  const userId = user?.id ?? '';
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('all');
  const [filterCategory, setFilterCategory] = useState<CategoryKey>('all');
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [sheetStatus, setSheetStatus] = useState<StatusFilter>('all');
  const [sheetCategory, setSheetCategory] = useState<CategoryKey>('all');

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filterActive = filterStatus !== 'all' || filterCategory !== 'all';

  const filteredSuggestions = useMemo(() => {
    if (searchQuery.length < 2) return suggestions;
    const q = searchQuery.toLowerCase();
    return suggestions.filter(s => s.content.toLowerCase().includes(q));
  }, [suggestions, searchQuery]);

  const searchActive = searchQuery.length >= 2;
  const closeSearch = () => {
    setShowSearch(false);
    setSearchQuery('');
  };

  const generateSuggestions = useCallback(async (mode: 'auto' | 'refresh' = 'auto') => {
    if (!userId) return;
    setIsGenerating(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zeeky-suggestions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY as string,
          },
          body: JSON.stringify({
            user_id: userId,
            mode: mode,
            language: language,
          }),
        }
      );

      const data = await response.json();
      console.log('Suggestions response:', data);
    } catch (error) {
      console.error('Generate suggestions error:', error);
    } finally {
      setIsGenerating(false);
    }
  }, [userId, language]);

  const refreshSuggestions = useCallback(async () => {
    if (!userId) return;
    const { start: todayStart } = getLocalDayUTCRangeISO(new Date());
    await supabase
      .from('suggestions')
      .delete()
      .eq('user_id', userId)
      .eq('status', 'pending')
      .gte('generated_at', todayStart);
    setSuggestions([]);
    await generateSuggestions('refresh');
    const list = await fetchSuggestions(userId, filterStatus, filterCategory);
    setSuggestions(list);
  }, [generateSuggestions, filterStatus, filterCategory, userId, language]);

  const handleAccept = async (id: string) => {
    if (!userId) return;
    await supabase
      .from('suggestions')
      .update({ status: 'accepted', responded_at: getLocalISOString() })
      .eq('id', id)
      .eq('user_id', userId);
    setSuggestions(prev => prev.filter(s => s.id !== id));
  };

  const handleSkip = async (id: string) => {
    if (!userId) return;
    await supabase
      .from('suggestions')
      .update({ status: 'skipped', responded_at: getLocalISOString() })
      .eq('id', id)
      .eq('user_id', userId);
    setSuggestions(prev => prev.filter(s => s.id !== id));
  };

  const loadSuggestions = useCallback(async () => {
    if (!userId) {
      setSuggestions([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const { start: todayStart, end: todayEnd } = getLocalDayUTCRangeISO(new Date());
      const { data: todaySuggestions } = await supabase
        .from('suggestions')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'pending')
        .gte('generated_at', todayStart)
        .lte('generated_at', todayEnd)
        .limit(1);

      if (!todaySuggestions || todaySuggestions.length === 0) {
        await generateSuggestions('auto');
      }
      const list = await fetchSuggestions(userId, 'all', 'all');
      setSuggestions(list);
    } finally {
      setIsLoading(false);
    }
  }, [userId, generateSuggestions]);

  useEffect(() => {
    if (!userId) {
      setSuggestions([]);
      setIsLoading(false);
      return;
    }
    void loadSuggestions();
  }, [userId, language, loadSuggestions]);

  useEffect(() => {
    if (showFilterSheet) {
      setSheetStatus(filterStatus);
      setSheetCategory(filterCategory);
    }
  }, [showFilterSheet, filterStatus, filterCategory]);

  const applyFilters = async () => {
    if (!userId) return;
    setFilterStatus(sheetStatus);
    setFilterCategory(sheetCategory);
    setShowFilterSheet(false);
    setIsLoading(true);
    try {
      const list = await fetchSuggestions(userId, sheetStatus, sheetCategory);
      setSuggestions(list);
    } finally {
      setIsLoading(false);
    }
  };

  const showSpinner = isLoading || isGenerating;

  return (
    <div className="pb-24 w-full animate-fade-in relative">

      {/* Header + search (sticky) */}
      <div className="sticky top-0 z-10 bg-background px-4 pb-3">
        <div className="flex items-center justify-between pt-4 pb-2">
          <h1 className="text-lg font-semibold">{t('suggestions.title')}</h1>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => void refreshSuggestions()}
              disabled={isGenerating}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border text-xs font-medium text-muted-foreground active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', isGenerating && 'animate-spin')} />
              {t('suggestions.refresh')}
            </button>
            <button
              type="button"
              onClick={() => setShowFilterSheet(true)}
              className="relative p-2 rounded-full active:bg-muted"
              aria-label="Filtrele"
            >
              <Filter className="w-5 h-5 text-muted-foreground" />
              {filterActive && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-500 border border-white" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setShowSearch(s => !s)}
              className="p-2 rounded-full active:bg-muted"
              aria-label="Ara"
            >
              <Search size={22} className="text-gray-600 dark:text-muted-foreground" />
            </button>
          </div>
        </div>

        {showSearch && (
          <div className="animate-in fade-in slide-in-from-top-1 duration-300 px-4 pb-3">
            <div className="relative">
              <input
                autoFocus
                type="search"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={t('suggestions.search_placeholder')}
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

      {/* Content */}
      <div className="px-4 space-y-3">
        {showSpinner ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
            <p className="text-sm text-muted-foreground">
              {isGenerating ? t('suggestions.generating') : t('suggestions.loading')}
            </p>
          </div>
        ) : suggestions.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">💡</p>
            <p className="text-sm text-muted-foreground">{t('suggestions.no_filter_results')}</p>
          </div>
        ) : searchActive && filteredSuggestions.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm text-muted-foreground">{t('suggestions.no_results')}</p>
          </div>
        ) : (
          <>
            {searchActive && filteredSuggestions.length > 0 && (
              <p className="text-xs text-muted-foreground -mt-1 mb-1">
                {t('suggestions.results_count', { count: filteredSuggestions.length })}
              </p>
            )}
            {filteredSuggestions.map(s => {
            const Icon  = CATEGORY_ICONS[s.category] ?? Activity;
            const color = CATEGORY_COLORS[s.category] ?? '#8b5cf6';
            const isPending = s.status === 'pending';
            const cardBg =
              s.status === 'accepted'
                ? 'bg-green-50 border-green-100 dark:bg-green-950/30 dark:border-green-800/50'
                : s.status === 'skipped'
                  ? 'bg-gray-100 border-gray-200 dark:bg-gray-800 dark:border-gray-700'
                  : 'bg-white border-gray-100 dark:bg-gray-800 dark:border-gray-700';

            return (
              <div key={s.id} className={cn('border rounded-2xl p-4', cardBg)}>
                <div className="flex items-start gap-3 mb-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: color + '20', color }}
                  >
                    <Icon size={20} />
                  </div>
                  <div className="flex-1">
                    <span
                      className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full mb-1"
                      style={{ backgroundColor: color + '20', color }}
                    >
                      {getSuggestionCategory(s.category)}
                    </span>
                    <p className="text-sm font-medium leading-snug text-gray-800 dark:text-gray-100">
                      <HighlightMatch text={s.content} query={searchQuery} />
                    </p>
                    {s.reason && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{s.reason}</p>
                    )}
                  </div>
                </div>
                {isPending && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void handleAccept(s.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-xl text-sm font-medium active:scale-95 transition-transform"
                    >
                      <Check className="w-4 h-4" /> {t('suggestions.accept')}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSkip(s.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400 rounded-xl text-sm font-medium active:scale-95 transition-transform"
                    >
                      <X className="w-4 h-4" /> {t('suggestions.skip')}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          </>
        )}
      </div>

      {/* Filter bottom sheet */}
      {showFilterSheet && (
        <>
          <div
            className="fixed inset-0 z-[300] bg-black/50"
            onClick={() => setShowFilterSheet(false)}
          />
          <div
            className="fixed inset-x-0 bottom-0 z-[301] bg-card rounded-t-3xl shadow-2xl w-full"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>
            <div className="px-5 pb-4">
              <h2 className="text-base font-semibold mb-4">{t('suggestions.filter')}</h2>

              <p className="text-xs font-semibold text-muted-foreground mb-2">{t('suggestions.filter_status')}</p>
              <div className="flex flex-wrap gap-2 mb-4">
                {STATUS_OPTIONS.map(o => (
                  <button
                    key={o.key}
                    type="button"
                    onClick={() => setSheetStatus(o.key)}
                    className={cn(
                      'px-3 py-2 rounded-full text-xs font-medium border text-gray-600 dark:text-gray-300',
                      sheetStatus === o.key
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600',
                    )}
                  >
                    {t(o.tKey)}
                  </button>
                ))}
              </div>

              <p className="text-xs font-semibold text-muted-foreground mb-2">{t('suggestions.filter_category')}</p>
              <div className="flex flex-wrap gap-2 mb-6">
                {CATEGORY_OPTIONS.map(o => (
                  <button
                    key={o.key}
                    type="button"
                    onClick={() => setSheetCategory(o.key)}
                    className={cn(
                      'px-3 py-2 rounded-full text-xs font-medium border text-gray-600 dark:text-gray-300',
                      sheetCategory === o.key
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600',
                    )}
                  >
                    {t(o.tKey)}
                  </button>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowFilterSheet(false)}
                  className="flex-1 py-3 rounded-xl bg-muted text-muted-foreground font-semibold text-sm"
                >
                  {t('suggestions.cancel')}
                </button>
                <button
                  type="button"
                  onClick={() => void applyFilters()}
                  className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm"
                >
                  {t('suggestions.apply')}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
