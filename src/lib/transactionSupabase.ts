import { supabase } from './supabase';

export const MONTH_SHORT = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
export const DAY_SHORT   = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

// ── Types ────────────────────────────────────────────────────────────────────

export interface Transaction {
  id: string;
  type: 'income' | 'expense';
  title: string;
  amount: number;
  currency: string;
  category: string;
  subcategory?: string | null;
  transaction_date: string; // ISO timestamp from DB
  date: string;             // YYYY-MM-DD derived
  frequency: 'none' | 'daily' | 'weekly' | 'monthly';
  description?: string | null;
  parent_transaction_id?: string | null;
  created_via?: string;
  activity_id?: string | null;
}

export interface TransactionCategory {
  id: string;
  name: string;
  type: 'income' | 'expense' | 'both';
  icon: string;
  color: string;
  is_active: boolean;
  sort_order: number;
  subcategories?: string[];
}

export interface ChartBar {
  name: string;
  gelir: number;
  gider: number;
}

// ── Row mapper ───────────────────────────────────────────────────────────────

function mapRow(row: Record<string, unknown>): Transaction {
  const d = new Date(row.transaction_date as string);
  return {
    id:                     row.id as string,
    type:                   row.type as 'income' | 'expense',
    title:                  (row.title as string) ?? '',
    amount:                 (row.amount as number) ?? 0,
    currency:               (row.currency as string) || 'TRY',
    category:               (row.category as string) || 'Diğer',
    subcategory:            row.subcategory as string | null,
    transaction_date:       row.transaction_date as string,
    date:                   `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    frequency:              ((row.frequency as string) || 'none') as Transaction['frequency'],
    description:            row.description as string | null,
    parent_transaction_id:  row.parent_transaction_id as string | null,
    created_via:            row.created_via as string,
    activity_id:            row.activity_id as string | null,
  };
}

// ── Fetch ────────────────────────────────────────────────────────────────────

export async function fetchTransactions(userId: string, year?: number, month?: number): Promise<Transaction[]> {
  if (!userId) return [];
  const safeYear = (year && !isNaN(year)) ? year : new Date().getFullYear();
  const safeMonth = (month !== undefined && !isNaN(month)) ? month : new Date().getMonth();

  let startOfMonth = new Date(safeYear, safeMonth, 1);
  let endOfMonth = new Date(safeYear, safeMonth + 1, 0, 23, 59, 59, 999);

  if (isNaN(startOfMonth.getTime()) || isNaN(endOfMonth.getTime())) {
    const now = new Date();
    const safeStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const safeEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    startOfMonth = safeStart;
    endOfMonth = safeEnd;
  }

  const startOfMonthIso = startOfMonth.toISOString();
  const endOfMonthIso = endOfMonth.toISOString();
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .gte('transaction_date', startOfMonthIso)
    .lte('transaction_date', endOfMonthIso)
    .order('transaction_date', { ascending: false });
  if (error) { console.error('fetchTransactions:', error); return []; }
  return (data || []).map(mapRow);
}

export async function fetchCategories(): Promise<TransactionCategory[]> {
  const { data, error } = await supabase
    .from('transaction_categories')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');
  if (error) { console.error('fetchCategories:', error); return []; }
  return (data || []) as TransactionCategory[];
}

// ── Chart helpers ────────────────────────────────────────────────────────────

/** Weekly chart — derived synchronously from the current month's transactions */
export function computeWeeklyChart(transactions: Transaction[]): ChartBar[] {
  const now = new Date();
  const dow = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const dayTxs = transactions.filter(t => t.date === ds);
    return {
      name:  DAY_SHORT[d.getDay()],
      gelir: dayTxs.filter(t => t.type === 'income' ).reduce((s, t) => s + t.amount, 0),
      gider: dayTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
    };
  });
}

/** Last N months income/expense bars */
export async function fetchMonthlyChart(userId: string, months = 6): Promise<ChartBar[]> {
  if (!userId) return [];
  const now = new Date();
  const results: ChartBar[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear(), m = d.getMonth();
    const start = new Date(y, m, 1).toISOString();
    const end   = new Date(y, m + 1, 0, 23, 59, 59).toISOString();
    const { data } = await supabase
      .from('transactions')
      .select('type, amount')
      .eq('user_id', userId)
      .gte('transaction_date', start)
      .lte('transaction_date', end);
    const txs = data || [];
    results.push({
      name:  MONTH_SHORT[m],
      gelir: txs.filter(t => t.type === 'income' ).reduce((s, t) => s + (t.amount as number), 0),
      gider: txs.filter(t => t.type === 'expense').reduce((s, t) => s + (t.amount as number), 0),
    });
  }
  return results;
}

/** Current year monthly bars */
export async function fetchYearlyChart(userId: string, year: number): Promise<ChartBar[]> {
  if (!userId) return [];
  const start = new Date(year, 0, 1).toISOString();
  const end   = new Date(year, 11, 31, 23, 59, 59).toISOString();
  const { data } = await supabase
    .from('transactions')
    .select('type, amount, transaction_date')
    .eq('user_id', userId)
    .gte('transaction_date', start)
    .lte('transaction_date', end);
  const txs = data || [];
  return MONTH_SHORT.map((name, i) => ({
    name,
    gelir: txs.filter(t => t.type === 'income'  && new Date(t.transaction_date as string).getMonth() === i).reduce((s, t) => s + (t.amount as number), 0),
    gider: txs.filter(t => t.type === 'expense' && new Date(t.transaction_date as string).getMonth() === i).reduce((s, t) => s + (t.amount as number), 0),
  }));
}

// ── Mutations ────────────────────────────────────────────────────────────────

export interface AddTransactionPayload {
  type: 'income' | 'expense';
  title: string;
  amount: number;
  currency: string;
  category: string;
  subcategory?: string | null;
  transaction_date: string;
  frequency: 'none' | 'daily' | 'weekly' | 'monthly';
  description?: string;
}

export async function addTransaction(userId: string, payload: AddTransactionPayload): Promise<boolean> {
  if (!userId) return false;
  const base = { ...payload, user_id: userId, created_via: 'manual' };
  const { data, error } = await supabase
    .from('transactions')
    .insert(base)
    .select('id')
    .single();
  if (error || !data) { console.error('addTransaction:', error); return false; }

  // Insert recurring instances
  if (payload.frequency !== 'none') {
    const parentId = (data as Record<string, unknown>).id as string;
    const count = payload.frequency === 'daily' ? 30 : 12;
    const instances = Array.from({ length: count }, (_, i) => {
      const d = new Date(payload.transaction_date);
      if (payload.frequency === 'daily')   d.setDate(d.getDate() + (i + 1));
      if (payload.frequency === 'weekly')  d.setDate(d.getDate() + (i + 1) * 7);
      if (payload.frequency === 'monthly') d.setMonth(d.getMonth() + (i + 1));
      return { ...base, transaction_date: d.toISOString(), parent_transaction_id: parentId };
    });
    await supabase.from('transactions').insert(instances);
  }
  return true;
}

export async function updateTransaction(
  userId: string,
  id: string,
  fields: Partial<Pick<Transaction, 'title' | 'amount' | 'category' | 'subcategory' | 'transaction_date' | 'frequency' | 'description' | 'type'>>,
): Promise<boolean> {
  if (!userId) return false;
  const { error } = await supabase
    .from('transactions')
    .update(fields)
    .eq('id', id)
    .eq('user_id', userId);
  if (error) { console.error('updateTransaction:', error); return false; }
  return true;
}

export async function deleteTransaction(
  userId: string,
  id: string,
  opts: { deleteAll?: boolean; parentId?: string | null } = {},
): Promise<boolean> {
  if (!userId) return false;
  if (opts.deleteAll && opts.parentId) {
    await supabase.from('transactions').delete().eq('parent_transaction_id', opts.parentId).eq('user_id', userId);
    await supabase.from('transactions').delete().eq('id', opts.parentId).eq('user_id', userId);
    return true;
  }
  const { error } = await supabase.from('transactions').delete().eq('id', id).eq('user_id', userId);
  if (error) { console.error('deleteTransaction:', error); return false; }
  return true;
}
