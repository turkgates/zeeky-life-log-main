import { supabase } from './supabase';
import { getLocalISOString } from './dateUtils';

interface RecurringTransaction {
  id: string;
  user_id: string;
  title: string;
  type: 'income' | 'expense';
  amount: number;
  currency: string;
  category: string;
  subcategory?: string | null;
  frequency: 'weekly' | 'monthly';
  due_day: number; // monthly: 1–31  |  weekly: 1=Mon … 7=Sun
  description?: string | null;
  is_active: boolean;
}

async function insertIfMissing(
  userId: string,
  rec: RecurringTransaction,
  dueDate: Date,
  rangeStart: Date,
  rangeEnd: Date,
): Promise<void> {
  const { data: existing } = await supabase
    .from('transactions')
    .select('id')
    .eq('user_id', userId)
    .eq('parent_transaction_id', rec.id)
    .gte('transaction_date', rangeStart.toISOString())
    .lte('transaction_date', rangeEnd.toISOString())
    .maybeSingle();

  if (existing) return;

  await supabase.from('transactions').insert({
    user_id:               userId,
    title:                 rec.title,
    type:                  rec.type,
    amount:                rec.amount,
    currency:              rec.currency,
    category:              rec.category,
    subcategory:           rec.subcategory ?? null,
    frequency:             rec.frequency,
    description:           rec.description ?? null,
    transaction_date:      getLocalISOString(dueDate),
    parent_transaction_id: rec.id,
    created_via:           'recurring',
  });
}

export async function syncRecurringTransactions(userId: string): Promise<void> {
  if (!userId) return;

  const { data: recurring, error } = await supabase
    .from('recurring_transactions')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (error || !recurring || recurring.length === 0) return;

  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const ninetyDaysAgo = new Date(today);
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  for (const rec of recurring as RecurringTransaction[]) {
    if (rec.frequency === 'monthly') {
      // Walk each calendar month in the last 90 days
      const cur = new Date(ninetyDaysAgo.getFullYear(), ninetyDaysAgo.getMonth(), 1);
      while (cur <= today) {
        const y = cur.getFullYear();
        const m = cur.getMonth();
        const daysInMonth = new Date(y, m + 1, 0).getDate();
        const day = Math.min(rec.due_day, daysInMonth);
        const dueDate = new Date(y, m, day, 12, 0, 0, 0);

        if (dueDate >= ninetyDaysAgo && dueDate <= today) {
          const monthStart = new Date(y, m, 1);
          const monthEnd   = new Date(y, m + 1, 0, 23, 59, 59, 999);
          await insertIfMissing(userId, rec, dueDate, monthStart, monthEnd);
        }
        cur.setMonth(cur.getMonth() + 1);
      }
    } else if (rec.frequency === 'weekly') {
      // due_day 1=Mon … 7=Sun → convert to JS 0=Sun … 6=Sat
      const jsDay = rec.due_day === 7 ? 0 : rec.due_day;
      const cur = new Date(ninetyDaysAgo);
      // Advance to first matching weekday
      while (cur.getDay() !== jsDay) cur.setDate(cur.getDate() + 1);

      while (cur <= today) {
        const dueDate = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate(), 12, 0, 0, 0);
        const rangeStart = new Date(dueDate); rangeStart.setDate(dueDate.getDate() - 2);
        const rangeEnd   = new Date(dueDate); rangeEnd.setDate(dueDate.getDate() + 2);
        await insertIfMissing(userId, rec, dueDate, rangeStart, rangeEnd);
        cur.setDate(cur.getDate() + 7);
      }
    }
  }
}
