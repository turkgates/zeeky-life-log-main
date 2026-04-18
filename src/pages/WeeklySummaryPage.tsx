import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Footprints, Activity, BedDouble, Heart, Flame } from 'lucide-react';
import { supabase, getUserCurrency } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';
import { useLanguageStore } from '@/store/useLanguageStore';
import { useTranslation } from 'react-i18next';

export interface WeeklySummaryData {
  week_label: string;
  ai_comment: string;
  language?: string;
  sport_days: number;
  sport_goal: number;
  sport_days_prev_week?: number;
  social_count: number;
  social_count_prev_week?: number;
  week_expense: number;
  expense_change_percent: number;
  total_activities: number;
  top_activities: string[];
  top_people: string[];
  top_expense_categories: string[];
  healthkit_total_steps?: number;
  healthkit_total_distance_km?: number;
  healthkit_total_calories?: number;
  healthkit_avg_sleep?: number;
  healthkit_avg_heart_rate?: number;
  healthkit_days_count?: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function WeeklySummaryPage({ isOpen, onClose }: Props) {
  const { t } = useTranslation();
  const { language } = useLanguageStore();
  const user = useAuthStore(s => s.user);
  const userId = user?.id ?? '';

  const [summary, setSummary] = useState<WeeklySummaryData | null>(null);
  const [currencySymbol, setCurrencySymbol] = useState('₺');
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  const dragStartY = useRef(0);
  const dragging = useRef(false);
  const [dragOffset, setDragOffset] = useState(0);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

  const generateSummary = useCallback(async (_force?: boolean) => {
    if (!userId) return;
    setIsGenerating(true);
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/zeeky-weekly-summary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supabaseAnonKey}`,
          apikey: supabaseAnonKey,
        },
        body: JSON.stringify({
          user_id: userId,
          language,
        }),
      });
      const data = (await response.json()) as { summary?: WeeklySummaryData };
      if (data.summary) {
        const summary: WeeklySummaryData = { ...data.summary, language };
        setSummary(summary);
        setGeneratedAt(new Date().toISOString());
      }
    } finally {
      setIsGenerating(false);
    }
  }, [supabaseUrl, supabaseAnonKey, userId, language]);

  const checkAndLoad = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);

    const now = new Date();
    const dayOfWeek = now.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const thisMonday = new Date(now);
    thisMonday.setDate(now.getDate() - daysToMonday);
    thisMonday.setHours(0, 0, 0, 0);

    const weekStart =
      dayOfWeek === 0
        ? new Date(thisMonday.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
        : thisMonday.toISOString();

    const { data: existing, error } = await supabase
      .from('weekly_summaries')
      .select('summary_data, generated_at')
      .eq('user_id', userId)
      .gte('week_start', weekStart)
      .order('week_start', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('weekly_summaries:', error);
    }

    if (existing?.summary_data) {
      const savedLanguage = (existing.summary_data as WeeklySummaryData).language;
      if (!savedLanguage || savedLanguage !== language) {
        setIsLoading(false);
        await generateSummary(true);
        return;
      }
      setSummary(existing.summary_data as WeeklySummaryData);
      setGeneratedAt(existing.generated_at as string | null);
      setIsLoading(false);
      return;
    }

    setIsLoading(false);
    await generateSummary(true);
  }, [generateSummary, userId, language]);

  useEffect(() => {
    if (!isOpen || !userId) return;
    void getUserCurrency(userId).then(({ symbol }) => setCurrencySymbol(symbol));
  }, [isOpen, userId]);

  useEffect(() => {
    if (!isOpen || !userId) return;
    supabase
      .from('users')
      .select('plan_type')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => {
        setIsPremium(data?.plan_type === 'premium');
      });
  }, [isOpen, userId]);

  useEffect(() => {
    if (isOpen && userId) {
      void checkAndLoad();
    }
  }, [isOpen, userId, language, checkAndLoad]);

  const handleDragStart = (e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
    dragging.current = true;
  };
  const handleDragMove = (e: React.TouchEvent) => {
    if (!dragging.current) return;
    setDragOffset(Math.max(0, e.touches[0].clientY - dragStartY.current));
  };
  const handleDragEnd = () => {
    dragging.current = false;
    if (dragOffset > 100) onClose();
    setDragOffset(0);
  };

  const handleRefresh = () => {
    void generateSummary(true);
  };

  if (!isOpen) return null;

  const showInitialSpinner = isLoading || (isGenerating && !summary);
  const sportPrev = summary?.sport_days_prev_week;
  const socialPrev = summary?.social_count_prev_week;
  const sportDelta =
    sportPrev !== undefined ? (summary?.sport_days ?? 0) - sportPrev : undefined;
  const socialDelta =
    socialPrev !== undefined ? (summary?.social_count ?? 0) - socialPrev : undefined;

  const isEmptyData =
    summary &&
    summary.total_activities === 0 &&
    !showInitialSpinner;

  const isRefreshedToday = generatedAt
    ? new Date(generatedAt).toDateString() === new Date().toDateString()
    : false;

  return (
    <>
      <div
        className="fixed inset-0 z-[400] bg-black/60"
        onClick={onClose}
        aria-hidden
      />
      <div
        className="fixed inset-x-0 bottom-0 z-[401] flex max-h-[min(92dvh,920px)] flex-col rounded-t-3xl bg-white shadow-2xl w-full"
        style={{
          transform: `translateY(${dragOffset}px)`,
          transition: dragging.current ? 'none' : 'transform 200ms ease',
          paddingBottom: 'env(safe-area-inset-bottom, 16px)',
        }}
      >
        <div
          className="flex flex-shrink-0 cursor-grab justify-center py-3"
          onTouchStart={handleDragStart}
          onTouchMove={handleDragMove}
          onTouchEnd={handleDragEnd}
        >
          <div className="h-1 w-10 rounded-full bg-gray-300" />
        </div>

        <div className="relative flex flex-1 flex-col overflow-hidden rounded-t-3xl">
          <div className="relative rounded-t-3xl bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30"
              aria-label={t('common.close')}
            >
              <X className="h-5 w-5" />
            </button>
            <p className="text-sm opacity-75">{t('weekly_summary.title')}</p>
            {showInitialSpinner ? (
              <div className="mt-4 flex flex-col items-center gap-4 py-6 pr-8">
                <div className="h-10 w-10 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <p className="text-center text-sm leading-relaxed opacity-90">
                  {t('weekly_summary.generating')}
                </p>
              </div>
            ) : summary ? (
              <>
                <h2 className="mt-1 pr-10 text-xl font-semibold">{summary.week_label}</h2>
                <p className="mt-3 text-sm leading-relaxed opacity-90">{summary.ai_comment}</p>
              </>
            ) : (
              <p className="mt-3 text-sm opacity-90">{t('weekly_summary.error')}</p>
            )}
          </div>

          {showInitialSpinner ? null : isEmptyData ? (
            <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
              <p className="text-gray-600 leading-relaxed whitespace-pre-line">
                {t('weekly_summary.no_data')}
              </p>
              {isPremium && (
                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={isGenerating || isRefreshedToday}
                  className="mt-6 w-full max-w-xs rounded-2xl bg-blue-600 py-3.5 text-sm font-semibold text-white transition active:scale-[0.99] disabled:opacity-60"
                >
                  {isGenerating
                    ? t('weekly_summary.refreshing')
                    : isRefreshedToday
                      ? t('weekly_summary.already_refreshed_today')
                      : t('weekly_summary.refresh')}
                </button>
              )}
            </div>
          ) : summary ? (
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
              {/* Stats grid */}
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-gray-100 bg-gray-50/80 p-3">
                  <div className="text-lg">🏃</div>
                  <p className="mt-1 text-xs font-medium text-gray-500">{t('weekly_summary.sport')}</p>
                  <p className="mt-0.5 text-lg font-semibold text-gray-900">
                    {summary.sport_days} {t('profile.days')}
                  </p>
                  <p className="mt-1 text-xs">
                    {summary.sport_days >= summary.sport_goal ? (
                      <span className="text-green-600">{t('weekly_summary.goal_achieved')}</span>
                    ) : summary.sport_days > 0 ? (
                      <span className="text-amber-600">
                        {t('weekly_summary.days_missing', { count: summary.sport_goal - summary.sport_days })}
                      </span>
                    ) : (
                      <span className="text-red-500">{t('weekly_summary.no_sport')}</span>
                    )}
                  </p>
                  {sportDelta !== undefined && (
                    <p className="mt-1 text-xs text-gray-500">
                      {sportDelta > 0 ? (
                        <span className="text-green-600">{t('weekly_summary.prev_increase', { count: sportDelta })}</span>
                      ) : sportDelta < 0 ? (
                        <span className="text-red-500">{t('weekly_summary.prev_decrease', { count: Math.abs(sportDelta) })}</span>
                      ) : (
                        <span>{t('weekly_summary.prev_same')}</span>
                      )}
                    </p>
                  )}
                </div>

                <div className="rounded-2xl border border-gray-100 bg-gray-50/80 p-3">
                  <div className="text-lg">👥</div>
                  <p className="mt-1 text-xs font-medium text-gray-500">{t('weekly_summary.social')}</p>
                  <p className="mt-0.5 text-lg font-semibold text-gray-900">
                    {summary.social_count} {t('weekly_summary.activity_label')}
                  </p>
                  {socialDelta !== undefined && (
                    <p className="mt-2 text-xs text-gray-500">
                      {socialDelta > 0 ? (
                        <span className="text-green-600">{t('weekly_summary.prev_increase', { count: socialDelta })}</span>
                      ) : socialDelta < 0 ? (
                        <span className="text-red-500">{t('weekly_summary.prev_decrease', { count: Math.abs(socialDelta) })}</span>
                      ) : (
                        <span>{t('weekly_summary.prev_same')}</span>
                      )}
                    </p>
                  )}
                </div>

                <div className="rounded-2xl border border-gray-100 bg-gray-50/80 p-3">
                  <div className="text-lg">💰</div>
                  <p className="mt-1 text-xs font-medium text-gray-500">{t('weekly_summary.expense')}</p>
                  <p className="mt-0.5 text-lg font-semibold text-gray-900">
                    {summary.week_expense}
                    {currencySymbol}
                  </p>
                  <p className="mt-1 text-xs">
                    {summary.expense_change_percent > 0 ? (
                      <span className="text-red-500">
                        {t('weekly_summary.expense_increased', { pct: Math.abs(summary.expense_change_percent).toFixed(0) })}
                      </span>
                    ) : summary.expense_change_percent < 0 ? (
                      <span className="text-green-600">
                        {t('weekly_summary.expense_decreased', { pct: Math.abs(summary.expense_change_percent).toFixed(0) })}
                      </span>
                    ) : (
                      <span className="text-gray-500">{t('weekly_summary.expense_unchanged')}</span>
                    )}
                  </p>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-gray-50/80 p-3">
                  <div className="text-lg">📊</div>
                  <p className="mt-1 text-xs font-medium text-gray-500">{t('weekly_summary.total')}</p>
                  <p className="mt-0.5 text-lg font-semibold text-gray-900">
                    {summary.total_activities} {t('weekly_summary.activities_label')}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">{t('weekly_summary.recorded_this_week')}</p>
                </div>
              </div>

              {/* HealthKit bölümü */}
              {(summary.healthkit_days_count ?? 0) > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-semibold text-gray-800">
                    {language === 'en'
                      ? '📱 iPhone Health Data'
                      : language === 'fr'
                        ? '📱 Données de santé iPhone'
                        : '📱 iPhone Sağlık Verileri'}
                  </h3>
                  <div className="mt-2 grid grid-cols-2 gap-3">
                    {summary.healthkit_total_steps !== undefined && (
                      <div className="rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 p-3 text-white">
                        <Footprints className="h-5 w-5 opacity-90" />
                        <p className="mt-1 text-xs font-medium opacity-80">
                          {language === 'en' ? 'Total Steps' : language === 'fr' ? 'Pas totaux' : 'Toplam Adım'}
                        </p>
                        <p className="mt-0.5 text-lg font-semibold">
                          {summary.healthkit_total_steps.toLocaleString()}
                        </p>
                      </div>
                    )}
                    {summary.healthkit_total_distance_km !== undefined && (
                      <div className="rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 p-3 text-white">
                        <Activity className="h-5 w-5 opacity-90" />
                        <p className="mt-1 text-xs font-medium opacity-80">
                          {language === 'en' ? 'Total Distance' : language === 'fr' ? 'Distance totale' : 'Toplam Mesafe'}
                        </p>
                        <p className="mt-0.5 text-lg font-semibold">
                          {summary.healthkit_total_distance_km.toFixed(1)} km
                        </p>
                      </div>
                    )}
                    {summary.healthkit_avg_sleep !== undefined && (
                      <div className="rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-700 p-3 text-white">
                        <BedDouble className="h-5 w-5 opacity-90" />
                        <p className="mt-1 text-xs font-medium opacity-80">
                          {language === 'en' ? 'Avg Sleep' : language === 'fr' ? 'Sommeil moy.' : 'Ort. Uyku'}
                        </p>
                        <p className="mt-0.5 text-lg font-semibold">
                          {summary.healthkit_avg_sleep.toFixed(1)} {language === 'en' ? 'h' : language === 'fr' ? 'h' : 'sa'}
                        </p>
                      </div>
                    )}
                    {summary.healthkit_avg_heart_rate !== undefined && (
                      <div className="rounded-2xl bg-gradient-to-br from-purple-500 to-violet-700 p-3 text-white">
                        <Heart className="h-5 w-5 opacity-90" />
                        <p className="mt-1 text-xs font-medium opacity-80">
                          {language === 'en' ? 'Avg Heart Rate' : language === 'fr' ? 'Fréq. cardiaque' : 'Ort. Kalp Atışı'}
                        </p>
                        <p className="mt-0.5 text-lg font-semibold">
                          {Math.round(summary.healthkit_avg_heart_rate)} bpm
                        </p>
                      </div>
                    )}
                    {summary.healthkit_total_calories !== undefined && (
                      <div className="col-span-2 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 p-3 text-white">
                        <Flame className="h-5 w-5 opacity-90" />
                        <p className="mt-1 text-xs font-medium opacity-80">
                          {language === 'en' ? 'Total Active Calories' : language === 'fr' ? 'Calories actives totales' : 'Toplam Aktif Kalori'}
                        </p>
                        <p className="mt-0.5 text-lg font-semibold">
                          {Math.round(summary.healthkit_total_calories).toLocaleString()} kcal
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Top activities */}
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-gray-800">{t('weekly_summary.top_activities')}</h3>
                <div className="mt-2 divide-y divide-gray-100 rounded-xl border border-gray-100 px-3">
                  {(summary.top_activities ?? []).map((item, i) => (
                    <div key={i} className="flex items-center gap-3 py-2">
                      <span className="text-lg">{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</span>
                      <span className="text-sm text-gray-800">{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Social */}
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-gray-800">{t('weekly_summary.top_people')}</h3>
                <div className="mt-2 space-y-2">
                  {(summary.top_people ?? []).map((person, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600">
                        {person.charAt(0)}
                      </div>
                      <span className="text-sm text-gray-800">{person}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Expense categories */}
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-gray-800">{t('weekly_summary.top_expenses')}</h3>
                <div className="mt-2">
                  {(summary.top_expense_categories ?? []).map((item, i) => {
                    const [label, amount] = item.split(':');
                    return (
                      <div
                        key={i}
                        className="flex justify-between border-b border-gray-100 py-2 last:border-0"
                      >
                        <span className="text-sm text-gray-600">{label?.trim() ?? item}</span>
                        <span className="text-sm font-medium text-gray-900">
                          {amount?.trim() ?? ''}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {isPremium && (
                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={isGenerating || isRefreshedToday}
                  className="mt-6 w-full rounded-2xl bg-blue-600 py-3.5 text-sm font-semibold text-white transition active:scale-[0.99] disabled:opacity-60"
                >
                  {isGenerating
                    ? t('weekly_summary.refreshing')
                    : isRefreshedToday
                      ? t('weekly_summary.already_refreshed_today')
                      : t('weekly_summary.refresh')}
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center px-6 py-10">
              <p className="mb-4 text-center text-sm text-gray-600">{t('weekly_summary.error')}</p>
              {isPremium && (
                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={isGenerating || isRefreshedToday}
                  className="w-full max-w-xs rounded-2xl bg-blue-600 py-3.5 text-sm font-semibold text-white transition active:scale-[0.99] disabled:opacity-60"
                >
                  {isGenerating
                    ? t('weekly_summary.refreshing')
                    : isRefreshedToday
                      ? t('weekly_summary.already_refreshed_today')
                      : t('weekly_summary.refresh')}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
