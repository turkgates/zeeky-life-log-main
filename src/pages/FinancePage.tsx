import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Filter, Sparkles, ArrowRight, RefreshCw, ChevronLeft, ChevronRight, X, Loader2 } from 'lucide-react';
import { useCurrencyStore } from '@/store/useCurrencyStore';
import { useAuthStore } from '@/store/useAuthStore';
import { cn } from '@/lib/utils';
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
} from '@/lib/transactionSupabase';

const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const zeekyChatUrl = 'https://gmcmreinpnhuszxlpgpj.supabase.co/functions/v1/zeeky-chat';

const MONTH_NAMES = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

type Period     = 'weekly' | 'monthly' | 'yearly';
type Recurrence = 'none' | 'daily' | 'weekly' | 'monthly';

// ── Date label helpers ────────────────────────────────────────────────────────

function toYMD(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function humanDate(dateStr: string) {
  const today     = toYMD(new Date());
  const yesterday = toYMD(new Date(Date.now() - 86_400_000));
  if (dateStr === today)     return 'Bugün';
  if (dateStr === yesterday) return 'Dün';
  const d = new Date(dateStr + 'T12:00:00');
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function FinancePage() {
  const { user } = useAuthStore();
  const userId = user?.id ?? '';
  const { symbol: currencySymbol, code: currencyCode } = useCurrencyStore();

  const now = new Date();
  const [viewYear,  setViewYear]  = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  const [transactions,  setTransactions]  = useState<Transaction[]>([]);
  const [txLoading,     setTxLoading]     = useState(true);
  const [categories,    setCategories]    = useState<TransactionCategory[]>([]);
  const [period,        setPeriod]        = useState<Period>('monthly');
  const [chartData,     setChartData]     = useState<ChartBar[]>([]);
  const [chartLoading,  setChartLoading]  = useState(false);
  const [aiSuggestion,  setAiSuggestion]  = useState<string | null>(null);
  const [aiLoading,     setAiLoading]     = useState(false);
  const [showAdd,       setShowAdd]       = useState(false);
  const [selectedTx,    setSelectedTx]    = useState<Transaction | null>(null);
  const [swipedCardId,  setSwipedCardId]  = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [showFilters,   setShowFilters]   = useState(false);
  const [filters, setFilters] = useState<TransactionFilters>({
    type: 'all', categories: [], dateRange: 'all', minAmount: '', maxAmount: '', recurring: 'all', sort: 'newest',
  });

  // ── Load transactions ────────────────────────────────────────────────────
  const loadTransactions = useCallback(async () => {
    setTxLoading(true);
    if (!userId) {
      setTransactions([]);
      setTxLoading(false);
      return;
    }
    const txs = await fetchTransactions(userId, viewYear, viewMonth);
    setTransactions(txs);
    setTxLoading(false);
  }, [userId, viewYear, viewMonth]);

  useEffect(() => { void loadTransactions(); }, [loadTransactions]);

  // ── Load categories once ─────────────────────────────────────────────────
  useEffect(() => { fetchCategories().then(setCategories); }, []);

  // ── AI suggestion ────────────────────────────────────────────────────────
  const fetchAiSuggestion = useCallback(async () => {
    if (!userId) return;
    setAiLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];

      // 1. Check if today's suggestion already exists
      const { data: existing } = await supabase
        .from('suggestions')
        .select('content, generated_at')
        .eq('user_id', userId)
        .eq('category', 'finans')
        .gte('generated_at', `${today}T00:00:00.000Z`)
        .lte('generated_at', `${today}T23:59:59.999Z`)
        .order('generated_at', { ascending: false })
        .limit(1)
        .single();

      if (existing?.content) {
        setAiSuggestion(existing.content);
        return;
      }

      // 2. No cached suggestion — fetch from API
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const endOfMonth   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();

      const { data: txData } = await supabase
        .from('transactions')
        .select('type, amount, category')
        .eq('user_id', userId)
        .gte('transaction_date', startOfMonth)
        .lte('transaction_date', endOfMonth);

      const income  = txData?.filter(t => t.type === 'income' ).reduce((s, t) => s + Number(t.amount), 0) ?? 0;
      const expense = txData?.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0) ?? 0;

      const response = await fetch(zeekyChatUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'apikey': supabaseAnonKey,
        },
        body: JSON.stringify({
          message: `Bu ayki finansal durumumu analiz et ve tek cümle öneri ver. Gelir: ${income}${currencySymbol}, Gider: ${expense}${currencySymbol}, Bakiye: ${income - expense}${currencySymbol}`,
          user_id: userId,
          personality: 'balanced',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          current_datetime: new Date().toISOString(),
        }),
      });
      const data = await response.json();
      console.log('Finance advice response:', data);
      const cleanReply = data.reply?.trim();

      if (cleanReply && cleanReply.length > 10) {
        setAiSuggestion(cleanReply);
        // 3. Save to suggestions table
        await supabase.from('suggestions').insert({
          user_id: userId,
          category: 'finans',
          content: cleanReply,
          status: 'pending',
          generated_at: new Date().toISOString(),
        });
      } else {
        setAiSuggestion(null);
      }
    } catch (error) {
      console.error('Finance advice error:', error);
      setAiSuggestion(null);
    } finally {
      setAiLoading(false);
    }
  }, [currencySymbol, userId]);

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
    void fetchAiSuggestion();
  }, [fetchAiSuggestion, userId]);

  useEffect(() => {
    if (!txLoading) void fetchAiSuggestion();
  }, [txLoading, fetchAiSuggestion]);

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
      : fetchYearlyChart(userId, viewYear);
    fetch.then(d => { setChartData(d); setChartLoading(false); });
  }, [period, transactions, viewYear, userId]);

  // ── Summaries ────────────────────────────────────────────────────────────
  const totalIncome  = useMemo(() => transactions.filter(t => t.type === 'income' ).reduce((s, t) => s + t.amount, 0), [transactions]);
  const totalExpense = useMemo(() => transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0), [transactions]);
  const balance      = totalIncome - totalExpense;

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

  // Group by date — newest day first; within each day, newest transaction first
  const grouped = useMemo(() => {
    const g: Record<string, Transaction[]> = {};
    filteredTx.forEach(t => {
      const label = humanDate(t.date);
      if (!g[label]) g[label] = [];
      g[label].push(t);
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
  }, [filteredTx, filters.sort]);

  // ── Helpers ──────────────────────────────────────────────────────────────
  const getCatInfo = (tx: Transaction) => categories.find(c => c.name === tx.category);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  const handleDeleteTx = async (id: string) => {
    if (!userId) return;
    const ok = await deleteTransaction(userId, id);
    if (ok) { toast.success('İşlem silindi'); void loadTransactions(); }
    setDeleteConfirm(null);
    setSwipedCardId(null);
  };

  const activeFilterCount = getActiveFilterCount(filters);

  return (
    <div className="pb-24 max-w-[430px] mx-auto animate-fade-in">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-lg font-semibold">Gelir & Gider</h1>
      </div>

      {/* ── Balance Card ───────────────────────────────────────────────── */}
      <div className="mx-4 bg-card rounded-2xl border border-border shadow-sm p-5 mb-4">
        {/* Month navigator */}
        <div className="flex items-center justify-between mb-3">
          <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-full active:bg-muted">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold">{MONTH_NAMES[viewMonth]} {viewYear}</span>
          <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-full active:bg-muted">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs font-medium text-muted-foreground mb-1">Aylık Bakiye</p>
        {txLoading ? (
          <div className="h-8 w-32 bg-muted rounded-lg animate-pulse mb-3" />
        ) : (
          <p className={cn("text-2xl font-bold mb-3", balance >= 0 ? "text-success" : "text-destructive")}>
            {balance >= 0 ? '+' : ''}{balance.toLocaleString('tr-TR')} {currencySymbol}
          </p>
        )}
        <div className="flex gap-2 flex-wrap">
          <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-success/10 text-success">
            Gelir: +{totalIncome.toLocaleString('tr-TR')} {currencySymbol}
          </span>
          <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-destructive/10 text-destructive">
            Gider: -{totalExpense.toLocaleString('tr-TR')} {currencySymbol}
          </span>
        </div>
      </div>

      {/* ── AI Suggestion ──────────────────────────────────────────────── */}
      {(aiLoading || aiSuggestion !== null) && (
      <div className="mx-4 mb-4 bg-gradient-to-r from-[hsl(227,47%,45%)] to-[hsl(263,55%,50%)] rounded-2xl p-4 text-white">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold opacity-80 mb-1">Yapay Zeka Önerisi</p>
            {aiLoading ? (
              <p className="text-sm opacity-80 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Zeeky analiz ediyor...
              </p>
            ) : (
              <p className="text-sm leading-snug">{aiSuggestion}</p>
            )}
          </div>
        </div>
        <div className="flex justify-end mt-2">
          <button
            onClick={() => { void fetchAiSuggestion(); }}
            className="text-xs opacity-70 flex items-center gap-1"
          >
            Yenile <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>
      )}

      {/* ── Charts ─────────────────────────────────────────────────────── */}
      <div className="mx-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">İstatistikler</h2>
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
                {p === 'weekly' ? 'Haftalık' : p === 'monthly' ? 'Aylık' : 'Yıllık'}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border p-4 mb-3">
          {chartLoading ? (
            <div className="h-[180px] flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={40}
                  tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                <Tooltip formatter={(v: number) => `${v.toLocaleString('tr-TR')} ${currencySymbol}`} />
                <Bar dataKey="gelir" fill="hsl(142,71%,45%)"  radius={[4, 4, 0, 0]} name="Gelir" />
                <Bar dataKey="gider" fill="hsl(0,84%,60%)"    radius={[4, 4, 0, 0]} name="Gider" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Pie chart */}
        <div className="bg-card rounded-2xl border border-border p-4">
          <p className="text-xs font-semibold text-muted-foreground mb-3">Gider Dağılımı</p>
          {pieData.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">Bu ay harcama kaydı yok</p>
          ) : (
            <div className="flex items-center gap-4">
              <div className="w-32 h-32 flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={28} outerRadius={54} paddingAngle={2}>
                      {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => `${v.toLocaleString('tr-TR')} ${currencySymbol}`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-1.5 min-w-0">
                {pieData.map(d => (
                  <div key={d.name} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                    <span className="text-xs text-muted-foreground flex-1 truncate">{d.name}</span>
                    <span className="text-xs font-medium">{d.value.toLocaleString('tr-TR')} {currencySymbol}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Transactions list ───────────────────────────────────────────── */}
      <div className="mx-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">İşlemler</h2>
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
        </div>

        {txLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
          </div>
        ) : filteredTx.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">💸</p>
            <p className="text-sm text-muted-foreground">Bu ay için işlem yok</p>
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
                            <p className="text-sm font-medium truncate">{tx.title}</p>
                            <p className="text-[10px] text-muted-foreground">{humanDate(tx.date)}</p>
                          </div>
                          {tx.frequency !== 'none' && <RefreshCw className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
                          <span className={cn(
                            "text-sm font-semibold flex-shrink-0",
                            tx.type === 'income' ? "text-success" : "text-destructive"
                          )}>
                            {tx.type === 'income' ? '+' : '-'}{tx.amount.toLocaleString('tr-TR')} {currencySymbol}
                          </span>
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

      {/* ── FAB ──────────────────────────────────────────────────────────── */}
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
          onSaved={() => { setShowAdd(false); void loadTransactions(); void invalidateAndRefreshAdvice(); toast.success('İşlem eklendi ✅'); }}
        />
      )}

      {selectedTx && (
        <TransactionDetailSheet
          userId={userId}
          transaction={selectedTx}
          categories={categories}
          currencySymbol={currencySymbol}
          onClose={() => setSelectedTx(null)}
          onSaved={() => { setSelectedTx(null); void loadTransactions(); }}
          onDelete={async (id, opts) => {
            if (!userId) return false;
            const ok = await deleteTransaction(userId, id, opts);
            if (ok) { toast.success('İşlem silindi'); void loadTransactions(); }
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
            <p className="text-sm font-medium text-center mb-4">Bu işlemi silmek istediğine emin misin?</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 rounded-xl bg-muted text-muted-foreground font-semibold text-sm">İptal</button>
              <button onClick={() => handleDeleteTx(deleteConfirm)} className="flex-1 py-2.5 rounded-xl bg-destructive text-destructive-foreground font-semibold text-sm">Sil</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Static category / subcategory maps ───────────────────────────────────────

const INCOME_SUBS: Record<string, string[]> = {
  'Maaş':        ['Aylık Maaş', 'İkramiye', 'Prim', 'Fazla Mesai'],
  'Freelance':   ['Proje Bazlı', 'Danışmanlık', 'Yazarlık', 'Tasarım', 'Yazılım'],
  'Yatırım':     ['Hisse Senedi', 'Kripto', 'Gayrimenkul', 'Fon', 'Faiz', 'Temettü'],
  'Kira Geliri': ['Konut Kirası', 'İşyeri Kirası', 'Araç Kirası'],
  'Emeklilik':   ['Emekli Maaşı', 'BES'],
  'Burs':        ['Devlet Bursu', 'Özel Burs', 'Yurt Dışı Burs'],
  'Yan Gelir':   ['Satış', 'Komisyon', 'Telif', 'Reklam Geliri'],
  'Diğer Gelir': ['Hediye', 'Miras', 'Piyango', 'Diğer'],
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
  const [type,        setType]        = useState<'income' | 'expense'>('expense');
  const [amount,      setAmount]      = useState('');
  const [title,       setTitle]       = useState('');
  const [category,    setCategory]    = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [date,        setDate]        = useState(new Date().toISOString().slice(0, 10));
  const [frequency,   setFrequency]   = useState<Recurrence>('none');
  const [saving,      setSaving]      = useState(false);

  const cats = type === 'income' ? INCOME_CATS : EXPENSE_CATS;
  const subs = category ? (type === 'income' ? INCOME_SUBS[category] : EXPENSE_SUBS[category]) ?? [] : [];

  const handleSave = async () => {
    if (!amount || !category) { toast.error('Tutar ve kategori zorunlu'); return; }
    if (!userId) { toast.error('Oturum yok'); return; }
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
      description: title.trim() || undefined,
    });
    setSaving(false);
    if (ok) onSaved();
    else toast.error('Kaydedilemedi');
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative w-full max-w-[430px] bg-card rounded-t-2xl p-5 pb-8 animate-slide-up max-h-[88vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">İşlem Ekle</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>

        {/* Type toggle */}
        <div className="flex bg-muted rounded-xl p-1 mb-4">
          <button
            onClick={() => { setType('income'); setCategory(''); setSubcategory(''); }}
            className={cn("flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors", type === 'income' ? "bg-success text-white" : "text-muted-foreground")}
          >Gelir</button>
          <button
            onClick={() => { setType('expense'); setCategory(''); setSubcategory(''); }}
            className={cn("flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors", type === 'expense' ? "bg-destructive text-white" : "text-muted-foreground")}
          >Gider</button>
        </div>

        {/* Amount */}
        <div className="flex items-center justify-center gap-1 mb-4">
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0"
            className="text-4xl font-bold text-center w-40 bg-transparent outline-none"
          />
          <span className="text-2xl font-bold text-muted-foreground">{currencySymbol}</span>
        </div>

        {/* Categories */}
        <p className="text-xs font-medium text-muted-foreground mb-2">Kategori</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {cats.map(name => (
            <button
              key={name}
              onClick={() => { setCategory(name); setSubcategory(''); }}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                category === name ? "bg-accent text-accent-foreground border-accent" : "bg-muted text-muted-foreground border-transparent"
              )}
            >{name}</button>
          ))}
        </div>

        {/* Subcategories */}
        {subs.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Alt Kategori <span className="text-[10px] opacity-60">(isteğe bağlı)</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {subs.map(s => (
                <button
                  key={s}
                  onClick={() => setSubcategory(subcategory === s ? '' : s)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                    subcategory === s ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"
                  )}
                >{s}</button>
              ))}
            </div>
          </div>
        )}

        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Açıklama (isteğe bağlı)"
          className="w-full bg-muted rounded-xl px-4 py-3 text-sm outline-none border border-border mb-3"
        />
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="w-full bg-muted rounded-xl px-4 py-3 text-sm outline-none border border-border mb-3"
        />

        {/* Frequency */}
        <p className="text-xs font-medium text-muted-foreground mb-2">Tekrar</p>
        <div className="flex gap-2 mb-5">
          {(['none', 'daily', 'weekly', 'monthly'] as Recurrence[]).map(r => (
            <button
              key={r}
              onClick={() => setFrequency(r)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                frequency === r ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"
              )}
            >
              {r === 'none' ? 'Yok' : r === 'daily' ? 'Günlük' : r === 'weekly' ? 'Haftalık' : 'Aylık'}
            </button>
          ))}
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3.5 bg-accent text-accent-foreground rounded-xl font-semibold text-sm active:scale-[0.97] transition-transform disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Kaydet
        </button>
      </div>
    </div>
  );
}
