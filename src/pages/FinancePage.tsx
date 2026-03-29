import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Filter, Sparkles, ArrowRight, RefreshCw, ChevronLeft, ChevronRight, X, Loader2, Search } from 'lucide-react';
import { HighlightMatch } from '@/components/HighlightMatch';
import { useCurrencyStore } from '@/store/useCurrencyStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useTheme } from '@/components/ThemeProvider';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { useLanguageStore } from '@/store/useLanguageStore';
import { translateFinanceCategory, getSubcategory } from '@/lib/categoryTranslations';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { toast } from 'sonner';
import SwipeableCard from '@/components/SwipeableCard';
import TransactionDetailSheet from '@/components/TransactionDetailSheet';
import TransactionFilterSheet, {
  TransactionFilters,
  getActiveFilterCount,
} from '@/components/TransactionFilterSheet';
import {
  Transaction,
  TransactionCategory,
  ChartBar,
  fetchTransactions,
  fetchCategories,
  computeWeeklyChart,
  fetchMonthlyChart,
  fetchYearlyChart,
  addTransaction,
  deleteTransaction,
  MONTH_SHORT,
  mapRow,
} from '@/lib/transactionSupabase';
import { formatDate, getMonthName } from '@/lib/dateLocale';

const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const zeekySuggestionsUrl = `${supabaseUrl}/functions/v1/zeeky-suggestions`;

type Period     = 'weekly' | 'monthly' | 'yearly';
type Recurrence = 'none' | 'daily' | 'weekly' | 'monthly';

// ── Date label helpers ────────────────────────────────────────────────────────

function toYMD(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function humanDate(dateStr: string, todayLabel: string, yesterdayLabel: string) {
  const today     = toYMD(new Date());
  const yesterday = toYMD(new Date(Date.now() - 86_400_000));
  if (dateStr === today)     return todayLabel;
  if (dateStr === yesterday) return yesterdayLabel;
  return formatDate(dateStr);
}

function txPassesDateFilter(tx: Transaction, f: TransactionFilters): boolean {
  if (f.dateRange === 'all') return true;
  const d = new Date(tx.date + 'T12:00:00');
  const now = new Date();
  const sod = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
  switch (f.dateRange) {
    case 'thisMonth':
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    case 'lastMonth': {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return d >= start && d <= end;
    }
    case 'last3Months': {
      const boundary = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      return d >= boundary;
    }
    case 'thisYear':
      return d.getFullYear() === now.getFullYear();
    case 'custom': {
      if (!f.customStart || !f.customEnd) return true;
      const txd = sod(d);
      const s = sod(f.customStart);
      const e = sod(f.customEnd);
      return txd >= s && txd <= e;
    }
    default:
      return true;
  }
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function FinancePage() {
  const { t, i18n } = useTranslation();
  const { language } = useLanguageStore();
  const { user } = useAuthStore();
  const userId = user?.id ?? '';
  const { symbol: currencySymbol, code: currencyCode } = useCurrencyStore();
  const { theme } = useTheme();
  const darkMode = theme === 'dark';
  const locale = i18n.language;

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());

  const [transactions,  setTransactions]  = useState<Transaction[]>([]);
  const [txLoading,     setTxLoading]     = useState(true);
  const [categories,    setCategories]    = useState<TransactionCategory[]>([]);
  const [period,        setPeriod]        = useState<Period>('monthly');
  const [chartData,     setChartData]     = useState<ChartBar[]>([]);
  const [chartLoading,  setChartLoading]  = useState(false);
  const [aiSuggestion,  setAiSuggestion]  = useState<string | null>(null);
  const [aiLoading,     setAiLoading]     = useState(false);
  const [aiAttempted,   setAiAttempted]   = useState(false);
  const [showAdd,       setShowAdd]       = useState(false);
  const [selectedTx,    setSelectedTx]    = useState<Transaction | null>(null);
  const [swipedCardId,  setSwipedCardId]  = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [showFilters,   setShowFilters]   = useState(false);
  const [filters, setFilters] = useState<TransactionFilters>({
    type: 'all', categories: [], dateRange: 'all', minAmount: '', maxAmount: '', recurring: 'all', sort: 'newest',
  });
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Transaction[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // ── Load transactions ────────────────────────────────────────────────────
  const loadTransactions = useCallback(async () => {
    setTxLoading(true);
    if (!userId) {
      setTransactions([]);
      setTxLoading(false);
      return;
    }
    console.log('Finance selected period:', { selectedYear, selectedMonth });
    const txs = await fetchTransactions(userId, selectedYear, selectedMonth);
    setTransactions(txs);
    setTxLoading(false);
  }, [userId, selectedYear, selectedMonth]);

  useEffect(() => { void loadTransactions(); }, [loadTransactions]);

  // ── Load categories once ─────────────────────────────────────────────────
  useEffect(() => { fetchCategories().then(setCategories); }, []);

  // ── AI suggestion (zeeky-suggestions only — not zeeky-chat) ─────────────────
  const fetchAiSuggestion = useCallback(async (mode: 'auto' | 'refresh' = 'auto') => {
    if (!userId) return;
    setAiLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];

      if (mode === 'auto') {
        const { data: existing } = await supabase
          .from('suggestions')
          .select('content, generated_at')
          .eq('user_id', userId)
          .eq('category', 'finans')
          .gte('generated_at', `${today}T00:00:00.000Z`)
          .lte('generated_at', `${today}T23:59:59.999Z`)
          .order('generated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existing?.content) {
          setAiSuggestion(existing.content);
          return;
        }
      }

      const response = await fetch(zeekySuggestionsUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supabaseAnonKey}`,
          apikey: supabaseAnonKey,
        },
        body: JSON.stringify({
          user_id: userId,
          mode,
          language,
          category_filter: 'finans',
        }),
      });
      const data = (await response.json()) as {
        suggestions?: Array<{ category: string; content: string }>;
      };
      const financeSuggestion = data.suggestions?.find(s => s.category === 'finans');
      const text = financeSuggestion?.content?.trim();
      if (text && text.length > 0) {
        setAiSuggestion(text);
      } else {
        setAiSuggestion(null);
      }
    } catch (error) {
      console.error('Finance suggestion error:', error);
      setAiSuggestion(null);
    } finally {
      setAiLoading(false);
      setAiAttempted(true);
    }
  }, [userId, language]);

  // Helper: invalidate today's cached suggestion then regenerate
  const invalidateAndRefreshAdvice = useCallback(async () => {
    if (!userId) return;
    const today = new Date().toISOString().split('T')[0];
    await supabase
      .from('suggestions')
      .delete()
      .eq('user_id', userId)
      .eq('category', 'finans')
      .gte('generated_at', `${today}T00:00:00.000Z`);
    void fetchAiSuggestion('refresh');
  }, [fetchAiSuggestion, userId]);

  useEffect(() => {
    if (!txLoading) void fetchAiSuggestion();
  }, [txLoading, fetchAiSuggestion]);

  const prevLangRef = useRef<string | null>(null);
  useEffect(() => {
    if (!userId || txLoading) return;
    if (prevLangRef.current === null) {
      prevLangRef.current = language;
      return;
    }
    if (prevLangRef.current === language) return;
    prevLangRef.current = language;
    void (async () => {
      const today = new Date().toISOString().split('T')[0];
      await supabase
        .from('suggestions')
        .delete()
        .eq('user_id', userId)
        .eq('category', 'finans')
        .gte('generated_at', `${today}T00:00:00.000Z`);
      setAiSuggestion(null);
      await fetchAiSuggestion();
    })();
  }, [language, userId, txLoading, fetchAiSuggestion]);

  // ── Chart data ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (period === 'weekly') {
      setChartData(computeWeeklyChart(transactions));
      return;
    }
    if (!userId) {
      setChartData([]);
      return;
    }
    setChartLoading(true);
    const fetch = period === 'monthly'
      ? fetchMonthlyChart(userId, 6)
      : fetchYearlyChart(userId, selectedYear);
    fetch.then(d => { setChartData(d); setChartLoading(false); });
  }, [period, transactions, selectedYear, userId]);

  // ── Summaries ────────────────────────────────────────────────────────────
  const totalIncome  = useMemo(() => transactions.filter(t => t.type === 'income' ).reduce((s, t) => s + t.amount, 0), [transactions]);
  const totalExpense = useMemo(() => transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0), [transactions]);
  const balance      = totalIncome - totalExpense;

  const chartHasNoData = useMemo(
    () => chartData.length === 0 || chartData.every(d => !d.gelir && !d.gider),
    [chartData],
  );

  // ── Pie chart data ───────────────────────────────────────────────────────
  const pieData = useMemo(() => {
    const expenses = transactions.filter(t => t.type === 'expense');
    const grouped = expenses.reduce<Record<string, number>>((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {});
    return Object.entries(grouped).map(([cat, value]) => {
      const catInfo = categories.find(c => c.name === cat);
      return { name: cat, value, color: catInfo?.color || '#78909C' };
    }).filter(d => d.value > 0).sort((a, b) => b.value - a.value);
  }, [transactions, categories]);

  // ── Filter + sort ────────────────────────────────────────────────────────
  const normalizeText = (text: string) =>
    text
      .toLowerCase()
      .replace(/ş/g, 's').replace(/Ş/g, 's')
      .replace(/ğ/g, 'g').replace(/Ğ/g, 'g')
      .replace(/ü/g, 'u').replace(/Ü/g, 'u')
      .replace(/ö/g, 'o').replace(/Ö/g, 'o')
      .replace(/ı/g, 'i').replace(/İ/g, 'i')
      .replace(/ç/g, 'c').replace(/Ç/g, 'c')
      .trim();

  const filteredTx = useMemo(() => {
    let list = [...transactions];
    if (filters.dateRange !== 'all') list = list.filter(t => txPassesDateFilter(t, filters));
    if (filters.type !== 'all') list = list.filter(t => t.type === filters.type);
    if (filters.categories.length > 0) {
      console.log('Normalized filter:', filters.categories.map(normalizeText));
      console.log('Normalized transactions:', list.map(t => normalizeText(t.category)));
      list = list.filter(t =>
        filters.categories.some(c => normalizeText(c) === normalizeText(t.category))
      );
    }
    if (filters.recurring === 'recurring') list = list.filter(t => t.frequency !== 'none');
    if (filters.recurring === 'oneTime')   list = list.filter(t => t.frequency === 'none');
    if (filters.minAmount) list = list.filter(t => t.amount >= Number(filters.minAmount));
    if (filters.maxAmount) list = list.filter(t => t.amount <= Number(filters.maxAmount));
    list.sort((a, b) => {
      if (filters.sort === 'oldest')  return a.date.localeCompare(b.date);
      if (filters.sort === 'highest') return b.amount - a.amount;
      if (filters.sort === 'lowest')  return a.amount - b.amount;
      return b.date.localeCompare(a.date);
    });
    return list;
  }, [transactions, filters]);

  const searchActive = searchQuery.length >= 2;

  const searchTransactions = useCallback(async (q: string) => {
    if (!userId || q.length < 2) return;
    setSearchLoading(true);
    try {
      const pattern = `%${q}%`;
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .or(`title.ilike.${pattern},category.ilike.${pattern}`)
        .order('transaction_date', { ascending: false })
        .limit(20);
      if (error) {
        console.error('searchTransactions:', error);
        setSearchResults([]);
        return;
      }
      setSearchResults((data || []).map(r => mapRow(r as Record<string, unknown>)));
    } finally {
      setSearchLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    void searchTransactions(searchQuery);
  }, [searchQuery, searchTransactions]);

  const closeSearch = () => {
    setShowSearch(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  const listForGroup = searchActive ? searchResults : filteredTx;

  const todayLabel     = t('finance.today');
  const yesterdayLabel = t('finance.yesterday');

  // Group by date — newest day first; within each day, newest transaction first
  const grouped = useMemo(() => {
    const g: Record<string, Transaction[]> = {};
    listForGroup.forEach(tx => {
      const label = humanDate(tx.date, todayLabel, yesterdayLabel);
      if (!g[label]) g[label] = [];
      g[label].push(tx);
    });
    const rows = Object.entries(g)
      .sort((a, b) => {
        const dA = a[1][0]?.date ?? '';
        const dB = b[1][0]?.date ?? '';
        return dB.localeCompare(dA);
      })
      .map(([label, txs]) => {
        if (filters.sort === 'newest') {
          return [label, [...txs].sort((x, y) => y.transaction_date.localeCompare(x.transaction_date))] as [string, Transaction[]];
        }
        if (filters.sort === 'oldest') {
          return [label, [...txs].sort((x, y) => x.transaction_date.localeCompare(y.transaction_date))] as [string, Transaction[]];
        }
        return [label, txs] as [string, Transaction[]];
      });
    return rows;
  }, [listForGroup, filters.sort, todayLabel, yesterdayLabel, i18n.language]);

  // ── Helpers ──────────────────────────────────────────────────────────────
  const getCatInfo = (tx: Transaction) => categories.find(c => c.name === tx.category);

  const prevMonth = () => {
    if (selectedMonth === 0) { setSelectedYear(y => y - 1); setSelectedMonth(11); }
    else setSelectedMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (selectedMonth === 11) { setSelectedYear(y => y + 1); setSelectedMonth(0); }
    else setSelectedMonth(m => m + 1);
  };

  const handleDeleteTx = async (id: string) => {
    if (!userId) return;
    const ok = await deleteTransaction(userId, id);
    if (ok) {
      toast.success(t('finance.delete_success'));
      void loadTransactions();
      if (searchQuery.length >= 2) void searchTransactions(searchQuery);
    }
    setDeleteConfirm(null);
    setSwipedCardId(null);
  };

  const activeFilterCount = getActiveFilterCount(filters);

  return (
    <div className="pb-24 w-full animate-fade-in">

      {/* ── Header + search (sticky) ───────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-background">
        <div className="px-4 pt-4 pb-2 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-800 dark:text-foreground">{t('finance.title')}</h1>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setShowSearch(s => !s)}
              className="p-1.5 rounded-full active:bg-muted"
              aria-label={t('common.search')}
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
                placeholder={t('finance.search_placeholder')}
                className="w-full border border-gray-200 dark:border-border rounded-2xl px-4 py-2.5 pr-10 text-sm focus:outline-none focus:border-blue-400 bg-gray-50 dark:bg-muted"
              />
              <button
                type="button"
                onClick={closeSearch}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-muted-foreground hover:text-foreground"
                aria-label={t('finance.close_search')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {!searchActive && (
      <>
      {/* ── Balance Card ───────────────────────────────────────────────── */}
      <div className="mx-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 mb-4">
        <p className="text-xs font-medium text-muted-foreground mb-2">{t('finance.monthly_summary')}</p>
        {/* Month navigator */}
        <div className="flex items-center justify-between mb-3">
          <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-full active:bg-muted">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold">
            {getMonthName(new Date(selectedYear, selectedMonth, 1))}
          </span>
          <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-full active:bg-muted">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs font-medium text-muted-foreground mb-1">{t('finance.balance_this_month')}</p>
        {txLoading ? (
          <div className="h-8 w-32 bg-muted rounded-lg animate-pulse mb-3" />
        ) : (
          <p className={cn(
            "text-2xl font-bold mb-3",
            balance >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400",
          )}>
            {balance >= 0 ? '+' : ''}{balance.toLocaleString(locale)} {currencySymbol}
          </p>
        )}
        <div className="flex gap-2 flex-wrap">
          <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-success/10 text-green-600 dark:text-green-400">
            {t('finance.income_this_month')}: +{totalIncome.toLocaleString(locale)} {currencySymbol}
          </span>
          <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-destructive/10 text-red-600 dark:text-red-400">
            {t('finance.expense_this_month')}: -{totalExpense.toLocaleString(locale)} {currencySymbol}
          </span>
        </div>
      </div>

      {/* ── AI Suggestion ──────────────────────────────────────────────── */}
      {(aiLoading || aiSuggestion !== null || aiAttempted) && (
      <div className="mx-4 mb-4 bg-gradient-to-r from-[hsl(227,47%,45%)] to-[hsl(263,55%,50%)] rounded-2xl p-4 text-white">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold opacity-80 mb-1">{t('finance.ai_suggestion_title')}</p>
            {aiLoading ? (
              <p className="text-sm opacity-80 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> {t('finance.ai_suggestion_loading')}
              </p>
            ) : aiSuggestion ? (
              <p className="text-sm leading-snug">{aiSuggestion}</p>
            ) : (
              <p className="text-sm opacity-80">{t('finance.ai_suggestion_empty')}</p>
            )}
          </div>
        </div>
        <div className="flex justify-end mt-2">
          <button
            onClick={() => { void fetchAiSuggestion(); }}
            className="text-xs opacity-70 flex items-center gap-1"
          >
            {t('finance.refresh')} <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>
      )}

      {/* ── Charts ─────────────────────────────────────────────────────── */}
      <div className="mx-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">{t('finance.statistics')}</h2>
          <div className="flex bg-muted rounded-lg p-0.5">
            {(['weekly', 'monthly', 'yearly'] as Period[]).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  "px-3 py-1 rounded-md text-xs font-medium transition-colors",
                  period === p ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                )}
              >
                {p === 'weekly' ? t('finance.weekly') : p === 'monthly' ? t('finance.monthly') : t('finance.yearly')}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 mb-3">
          {chartLoading ? (
            <div className="h-[180px] flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : chartHasNoData ? (
            <div className="h-[180px] flex items-center justify-center">
              <p className="text-sm text-muted-foreground">{t('finance.no_data_chart')}</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData}>
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: darkMode ? '#9ca3af' : '#6b7280' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: darkMode ? '#9ca3af' : '#6b7280' }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                  tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                />
                <Tooltip formatter={(v: number) => `${v.toLocaleString(locale)} ${currencySymbol}`} />
                <Bar dataKey="gelir" fill="hsl(142,71%,45%)"  radius={[4, 4, 0, 0]} name={t('finance.chart_income')} />
                <Bar dataKey="gider" fill="hsl(0,84%,60%)"    radius={[4, 4, 0, 0]} name={t('finance.chart_expense')} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Pie chart */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4">
          <p className="text-xs font-semibold text-muted-foreground mb-3">{t('finance.expense_distribution')}</p>
          {pieData.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">{t('finance.no_expense')}</p>
          ) : (
            <div className="flex items-center gap-4">
              <div className="w-32 h-32 flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={28} outerRadius={54} paddingAngle={2}>
                      {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => `${v.toLocaleString(locale)} ${currencySymbol}`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-1.5 min-w-0">
                {pieData.map(d => (
                  <div key={d.name} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                    <span className="text-xs text-muted-foreground flex-1 truncate">{translateFinanceCategory(t, d.name)}</span>
                    <span className="text-xs font-medium">{d.value.toLocaleString(locale)} {currencySymbol}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      </>
      )}

      {/* ── Transactions list ───────────────────────────────────────────── */}
      <div className="mx-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">{t('finance.transactions')}</h2>
          {!searchActive && (
            <button
              onClick={() => setShowFilters(true)}
              className="flex items-center gap-1 text-xs text-muted-foreground active:text-foreground"
            >
              <Filter className="w-4 h-4" />
              {activeFilterCount > 0 && (
                <span className="bg-accent text-accent-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {activeFilterCount}
                </span>
              )}
            </button>
          )}
        </div>

          {searchActive && (
          <p className="text-xs text-muted-foreground mb-2">
            {searchLoading
              ? t('finance.searching')
              : t('finance.results_count', { count: searchResults.length })
            }
          </p>
        )}

        {searchActive ? (
          searchLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
            </div>
          ) : searchResults.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-muted-foreground">{t('finance.no_results')}</p>
            </div>
          ) : (
          <div className="space-y-4">
            {grouped.map(([label, txs]) => (
              <div key={label}>
                <p className="text-xs font-semibold text-muted-foreground mb-2">{label}</p>
                <div className="space-y-2">
                  {txs.map(tx => {
                    const cat = getCatInfo(tx);
                    return (
                      <SwipeableCard
                        key={tx.id}
                        isOpen={swipedCardId === tx.id}
                        onSwipeOpen={() => setSwipedCardId(prev => prev === tx.id ? null : tx.id)}
                        onEdit={() => { setSwipedCardId(null); setSelectedTx(tx); }}
                        onDelete={() => setDeleteConfirm(tx.id)}
                      >
                        <div className="flex items-center gap-3 p-3" onClick={() => setSelectedTx(tx)}>
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                            style={{ backgroundColor: (cat?.color || '#78909C') + '20' }}
                          >
                            {cat?.icon || '📦'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              <HighlightMatch text={tx.title} query={searchQuery} />
                            </p>
                            <p className="text-[10px] text-muted-foreground truncate">
                              <HighlightMatch
                                text={
                                  tx.subcategory
                                    ? `${translateFinanceCategory(t, tx.category)} · ${getSubcategory(tx.category, tx.subcategory)}`
                                    : translateFinanceCategory(t, tx.category)
                                }
                                query={searchQuery}
                              />
                              <span className="opacity-70"> · {humanDate(tx.date, todayLabel, yesterdayLabel)}</span>
                            </p>
                          </div>
                          {tx.frequency !== 'none' && <RefreshCw className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
                          <span className={cn(
                            "text-sm font-semibold flex-shrink-0",
                            tx.type === 'income' ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400",
                          )}>
                            {tx.type === 'income' ? '+' : '-'}{tx.amount.toLocaleString(locale)} {currencySymbol}
                          </span>
                        </div>
                      </SwipeableCard>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          )
        ) : (
          txLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
            </div>
          ) : filteredTx.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-4xl mb-3">💸</p>
              <p className="text-sm text-muted-foreground">{t('finance.no_transactions')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {grouped.map(([label, txs]) => (
                <div key={label}>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">{label}</p>
                  <div className="space-y-2">
                    {txs.map(tx => {
                      const cat = getCatInfo(tx);
                      return (
                        <SwipeableCard
                          key={tx.id}
                          isOpen={swipedCardId === tx.id}
                          onSwipeOpen={() => setSwipedCardId(prev => prev === tx.id ? null : tx.id)}
                          onEdit={() => { setSwipedCardId(null); setSelectedTx(tx); }}
                          onDelete={() => setDeleteConfirm(tx.id)}
                        >
                          <div className="flex items-center gap-3 p-3" onClick={() => setSelectedTx(tx)}>
                            <div
                              className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                              style={{ backgroundColor: (cat?.color || '#78909C') + '20' }}
                            >
                              {cat?.icon || '📦'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                <HighlightMatch text={tx.title} query={searchQuery} />
                              </p>
                              <p className="text-[10px] text-muted-foreground truncate">
                                <HighlightMatch
                                text={
                                  tx.subcategory
                                    ? `${translateFinanceCategory(t, tx.category)} · ${getSubcategory(tx.category, tx.subcategory)}`
                                    : translateFinanceCategory(t, tx.category)
                                }
                                query={searchQuery}
                              />
                                <span className="opacity-70"> · {humanDate(tx.date, todayLabel, yesterdayLabel)}</span>
                              </p>
                            </div>
                            {tx.frequency !== 'none' && <RefreshCw className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
                            <span className={cn(
                              "text-sm font-semibold flex-shrink-0",
                              tx.type === 'income' ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400",
                            )}>
                              {tx.type === 'income' ? '+' : '-'}{tx.amount.toLocaleString(locale)} {currencySymbol}
                            </span>
                          </div>
                        </SwipeableCard>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      <button
        onClick={() => setShowAdd(true)}
        className="fixed bottom-24 z-50 w-14 h-14 rounded-full bg-accent text-accent-foreground shadow-lg flex items-center justify-center active:scale-95 transition-transform"
        style={{ right: 'max(16px, calc(50% - 215px + 16px))' }}
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* ── Modals ───────────────────────────────────────────────────────── */}
      {showAdd && (
        <AddTransactionModal
          userId={userId}
          currencySymbol={currencySymbol}
          currencyCode={currencyCode}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); void loadTransactions(); void invalidateAndRefreshAdvice(); toast.success(t('finance.add_success')); }}
        />
      )}

      {selectedTx && (
        <TransactionDetailSheet
          userId={userId}
          transaction={selectedTx}
          categories={categories}
          currencySymbol={currencySymbol}
          onClose={() => setSelectedTx(null)}
          onSaved={() => {
            setSelectedTx(null);
            void loadTransactions();
            if (searchQuery.length >= 2) void searchTransactions(searchQuery);
          }}
          onDelete={async (id, opts) => {
            if (!userId) return false;
            const ok = await deleteTransaction(userId, id, opts);
            if (ok) {
              toast.success(t('finance.delete_success'));
              void loadTransactions();
              if (searchQuery.length >= 2) void searchTransactions(searchQuery);
            }
            setSelectedTx(null);
          }}
        />
      )}

      {showFilters && (
        <TransactionFilterSheet
          filters={filters}
          onApply={setFilters}
          onClose={() => setShowFilters(false)}
        />
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-card rounded-2xl p-6 mx-8 shadow-xl" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-medium text-center mb-4">{t('finance.delete_confirm')}</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 rounded-xl bg-muted text-muted-foreground font-semibold text-sm">{t('finance.cancel')}</button>
              <button onClick={() => handleDeleteTx(deleteConfirm)} className="flex-1 py-2.5 rounded-xl bg-destructive text-destructive-foreground font-semibold text-sm">{t('finance.delete')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Static category / subcategory maps ───────────────────────────────────────

const INCOME_SUBS: Record<string, string[]> = {
  'Maaş':        ['Düzenli Maaş', 'Prim / Bonus', 'Fazla Mesai'],
  'Freelance':   ['Proje Bazlı', 'Danışmanlık', 'Tasarım', 'İçerik / Yazarlık'],
  'Yatırım':     ['Hisse Senedi', 'Kripto', 'Fon', 'Temettü'],
  'Kira Geliri': ['Daire Kirası', 'Araç Kirası', 'Diğer Kira'],
  'Emeklilik':   ['Devlet Emekliliği', 'Özel Emeklilik'],
  'Burs':        ['Devlet Bursu', 'Özel Burs'],
  'Yan Gelir':   ['E-ticaret', 'Sosyal Medya', 'Özel Ders', 'Diğer Yan Gelir'],
  'Diğer Gelir': ['Hediye / Bağış', 'Satış Geliri', 'Diğer'],
};

const EXPENSE_SUBS: Record<string, string[]> = {
  'Yiyecek & İçecek': ['Market', 'Restaurant', 'Kafe', 'Fast Food', 'Online Yemek', 'Alkol', 'Su & İçecek'],
  'Ulaşım':           ['Yakıt', 'Toplu Taşıma', 'Taksi & Uber', 'Araç Bakım', 'Otopark', 'Uçak', 'Tren & Otobüs'],
  'Eğlence':          ['Sinema', 'Konser', 'Tiyatro', 'Oyun', 'Kitap', 'Müzik', 'Spor Maçı', 'Gece Hayatı'],
  'Faturalar':        ['Elektrik', 'Su', 'Doğalgaz', 'İnternet', 'Telefon', 'Abonelikler', 'Kablo TV'],
  'Sağlık':           ['Doktor', 'Diş', 'İlaç', 'Hastane', 'Laboratuvar', 'Göz', 'Psikoloji'],
  'Giyim':            ['Kıyafet', 'Ayakkabı', 'Aksesuar', 'Spor Giyim', 'İç Giyim'],
  'Teknoloji':        ['Telefon', 'Bilgisayar', 'Tablet', 'Aksesuar', 'Yazılım', 'Oyun'],
  'Kira & Ev':        ['Kira', 'Aidat', 'Tadilat', 'Mobilya', 'Ev Eşyası', 'Temizlik', 'Güvenlik'],
  'Eğitim':           ['Okul Ücreti', 'Kurs', 'Kitap & Kırtasiye', 'Online Eğitim', 'Dil Kursu'],
  'Spor':             ['Spor Salonu', 'Ekipman', 'Spor Kıyafeti', 'Yüzme', 'Yoga', 'Koçluk'],
  'Güzellik & Bakım': ['Kuaför', 'Kozmetik', 'Cilt Bakımı', 'Masaj & SPA', 'Manikür'],
  'Seyahat':          ['Konaklama', 'Uçak Bileti', 'Tur', 'Vize', 'Seyahat Sigortası', 'Aktivite'],
  'Hediye':           ['Doğum Günü', 'Düğün', 'Yılbaşı', 'Bebek Hediyesi', 'Diğer Hediye'],
  'Sigorta':          ['Sağlık Sigortası', 'Araç Sigortası', 'Konut Sigortası', 'Hayat Sigortası'],
  'Alışveriş':        ['Giyim', 'Elektronik', 'Ev Eşyası', 'Online', 'Diğer'],
  'Diğer Gider':      ['Bağış', 'Para Cezası', 'Kayıp & Hasar', 'Diğer'],
};

const INCOME_CATS  = Object.keys(INCOME_SUBS);
const EXPENSE_CATS = Object.keys(EXPENSE_SUBS);

// ── Add Transaction Modal ─────────────────────────────────────────────────────

function AddTransactionModal({ userId, currencySymbol, currencyCode, onClose, onSaved }: {
  userId: string;
  currencySymbol: string;
  currencyCode:   string;
  onClose:  () => void;
  onSaved:  () => void;
}) {
  const { t } = useTranslation();
  const fieldCls = 'w-full bg-muted rounded-xl px-4 py-3 text-sm outline-none border border-border';
  const [type,        setType]        = useState<'income' | 'expense'>('expense');
  const [amount,      setAmount]      = useState('');
  const [title,       setTitle]       = useState('');
  const [description, setDescription] = useState('');
  const [category,    setCategory]    = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [date,        setDate]        = useState(new Date().toISOString().slice(0, 10));
  const [frequency,   setFrequency]   = useState<Recurrence>('none');
  const [saving,      setSaving]      = useState(false);

  const cats = type === 'income' ? INCOME_CATS : EXPENSE_CATS;
  const subs = category ? (type === 'income' ? INCOME_SUBS[category] : EXPENSE_SUBS[category]) ?? [] : [];

  const handleSave = async () => {
    if (!amount || !category) { toast.error(t('finance.error_amount_category')); return; }
    if (!userId) { toast.error(t('finance.error_no_session')); return; }
    setSaving(true);
    const ok = await addTransaction(userId, {
      type,
      title: title.trim() || category,
      amount: parseFloat(amount),
      currency: currencyCode,
      category,
      subcategory: subcategory || null,
      transaction_date: new Date(`${date}T12:00:00`).toISOString(),
      frequency,
      description: description.trim() || undefined,
    });
    setSaving(false);
    if (ok) onSaved();
    else toast.error(t('finance.error_save_failed'));
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative w-full bg-card rounded-t-2xl p-5 pb-8 animate-slide-up max-h-[88vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">{t('finance.add_transaction')}</h3>
          <button type="button" onClick={onClose} aria-label={t('common.close')}><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>

        {/* Type toggle */}
        <div className="flex bg-muted rounded-xl p-1 mb-4">
          <button
            type="button"
            onClick={() => { setType('income'); setCategory(''); setSubcategory(''); setTitle(''); setDescription(''); }}
            className={cn("flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors", type === 'income' ? "bg-success text-white" : "text-muted-foreground")}
          >{t('finance.income')}</button>
          <button
            type="button"
            onClick={() => { setType('expense'); setCategory(''); setSubcategory(''); setTitle(''); setDescription(''); }}
            className={cn("flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors", type === 'expense' ? "bg-destructive text-white" : "text-muted-foreground")}
          >{t('finance.expense')}</button>
        </div>

        <div className="mb-3">
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t('finance.form.title')}</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder={t('finance.form.title_placeholder')}
            className={fieldCls}
          />
        </div>

        <div className="mb-4">
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t('finance.form.amount')}</label>
          <div className="flex items-center justify-center gap-1">
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder={t('finance.form.amount_placeholder')}
              className="text-4xl font-bold text-center w-40 bg-transparent outline-none"
            />
            <span className="text-2xl font-bold text-muted-foreground">{currencySymbol}</span>
          </div>
        </div>

        {/* Categories */}
        <p className="text-xs font-medium text-muted-foreground mb-2">{t('finance.form.category')}</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {cats.map(name => (
            <button
              key={name}
              type="button"
              onClick={() => { setCategory(name); setSubcategory(''); }}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                category === name ? "bg-accent text-accent-foreground border-accent" : "bg-muted text-muted-foreground border-transparent"
              )}
            >{translateFinanceCategory(t, name)}</button>
          ))}
        </div>

        {/* Subcategories */}
        {subs.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">
              {t('finance.subcategory')} <span className="text-[10px] opacity-60">{t('finance.optional')}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {subs.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSubcategory(subcategory === s ? '' : s)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                    subcategory === s ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"
                  )}
                >{getSubcategory(category, s)}</button>
              ))}
            </div>
          </div>
        )}

        <div className="mb-3">
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t('finance.form.description')}</label>
          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder={t('finance.description_placeholder')}
            className={fieldCls}
          />
        </div>

        <div className="mb-3">
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t('finance.form.date')}</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className={fieldCls}
          />
        </div>

        {/* Frequency */}
        <p className="text-xs font-medium text-muted-foreground mb-2">{t('finance.frequency')}</p>
        <div className="flex gap-2 mb-5 flex-wrap">
          {(['none', 'daily', 'weekly', 'monthly'] as Recurrence[]).map(r => (
            <button
              key={r}
              type="button"
              onClick={() => setFrequency(r)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                frequency === r ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"
              )}
            >
              {r === 'none' ? t('finance.freq_none') : r === 'daily' ? t('finance.freq_daily') : r === 'weekly' ? t('finance.weekly') : t('finance.monthly')}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3.5 bg-accent text-accent-foreground rounded-xl font-semibold text-sm active:scale-[0.97] transition-transform disabled:opacity-60 flex items-center justify-center gap-2 mb-2"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {t('common.save')}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-muted text-muted-foreground font-semibold text-sm"
        >
          {t('common.cancel')}
        </button>
      </div>
    </div>
  );
}
