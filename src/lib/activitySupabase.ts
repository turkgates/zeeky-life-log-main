import { supabase } from '@/lib/supabase';
import type { Activity, ActionCategory } from '@/types/zeeky';

const CATEGORIES: ActionCategory[] = [
  // New categories
  'sağlık-spor', 'sosyal', 'iş-eğitim', 'eğlence',
  'alışveriş', 'yeme-içme', 'seyahat', 'ev-yaşam',
  'harcama', 'diğer',
  // Legacy
  'gittim', 'yaptim', 'uyudum', 'izledim', 'spor', 'sağlık', 'iş',
];

function isActionCategory(s: string): s is ActionCategory {
  return CATEGORIES.includes(s as ActionCategory);
}

export function mapRowToActivity(row: Record<string, unknown>): Activity {
  const id = row.id != null ? String(row.id) : '';

  const rawCategory = typeof row.category === 'string' ? row.category.trim() : '';
  const lowered = rawCategory.toLowerCase();
  const normalizedCategory = (CATEGORIES.find(c => c.toLowerCase() === lowered) ?? 'diğer') as ActionCategory;

  const title = typeof row.title === 'string' ? row.title : '';

  let dateStr = '';
  if (typeof row.activity_date === 'string') {
    dateStr = row.activity_date.slice(0, 10);
  } else if (row.activity_date) {
    const d = new Date(String(row.activity_date));
    if (!Number.isNaN(d.getTime())) dateStr = d.toISOString().slice(0, 10);
  }

  const created = typeof row.created_at === 'string' ? row.created_at : '';
  const createdDate = created ? new Date(created) : new Date();

  // If `activity_date` is missing (or invalid), fall back to `created_at` for the date string.
  if (!dateStr && created) {
    dateStr = createdDate.toISOString().slice(0, 10);
  }

  let timeStr = '';
  if (typeof row.activity_time === 'string' && /\d{1,2}:\d{2}/.test(row.activity_time)) {
    const parts = row.activity_time.split(':');
    const h = parts[0] ?? '0';
    const m = (parts[1] ?? '00').replace(/\D/g, '').slice(0, 2) || '00';
    timeStr = `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
  } else {
    timeStr = createdDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  }

  const rawMessage = typeof row.raw_message === 'string' ? row.raw_message : null;
  const note =
    typeof row.note === 'string' ? row.note : typeof rawMessage === 'string' ? rawMessage : undefined;

  const detailsRaw = row.details;
  const details: Record<string, unknown> =
    detailsRaw && typeof detailsRaw === 'object' && !Array.isArray(detailsRaw)
      ? { ...(detailsRaw as Record<string, unknown>) }
      : {};

  // Keep existing UI fields working (HomePage/ActivityDetailSheet read from `details.*`).
  if (typeof row.amount === 'number' && details.amount === undefined) details.amount = row.amount;
  if (typeof row.duration_mins === 'number' && details.duration === undefined) details.duration = row.duration_mins;
  if (Array.isArray(row.people) && details.companions === undefined) {
    const people = row.people.filter(p => typeof p === 'string') as string[];
    details.companions = people;
  }
  if (row.location != null && details.location === undefined) details.location = row.location;

  const isFavoriteVal =
    typeof row.is_favorite === 'boolean' ? row.is_favorite : typeof row.isFavorite === 'boolean' ? row.isFavorite : false;

  return {
    // Keep these required by the current UI model.
    id,
    title,
    category: normalizedCategory,
    time: timeStr,
    date: dateStr,
    note: note || undefined,
    details: Object.keys(details).length ? details : undefined,
    isFavorite: isFavoriteVal,

    // Add richer fields for debugging/inspection.
    amount: row.amount ?? null,
    duration_mins: row.duration_mins ?? null,
    location: row.location ?? null,
    people: Array.isArray(row.people) ? (row.people.filter(p => typeof p === 'string') as string[]) : [],
    activity_date: row.activity_date,
    created_at: row.created_at,
    created_via: typeof row.created_via === 'string' ? row.created_via : 'chat',
    raw_message: row.raw_message ?? null,
    is_favorite: isFavoriteVal,
  };
}

export async function fetchTodayActivities(userId: string): Promise<Activity[]> {
  if (!userId) return [];
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0]; // "2026-03-23"

  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .eq('user_id', userId)
    .gte('activity_date', `${todayStr}T00:00:00.000Z`)
    .lt('activity_date', `${todayStr}T23:59:59.999Z`)
    .order('activity_date', { ascending: false });

  console.log('Result:', data, error);

  if (error) {
    console.error('fetchTodayActivities', error);
    return [];
  }

  return (data || []).map(mapRowToActivity);
}

export async function fetchAllActivitiesOrdered(userId: string): Promise<Activity[]> {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .eq('user_id', userId)
    .order('activity_date', { ascending: false });

  if (error) {
    console.error('fetchAllActivitiesOrdered', error);
    return [];
  }
  return (data || []).map(mapRowToActivity);
}

export async function deleteActivityById(userId: string, id: string): Promise<boolean> {
  if (!userId) return false;
  const { error } = await supabase
    .from('activities')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    console.error('deleteActivityById', error);
    return false;
  }
  return true;
}

export async function fetchActivitiesByDate(userId: string, dateStr: string): Promise<Activity[]> {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .eq('user_id', userId)
    .gte('activity_date', `${dateStr}T00:00:00.000Z`)
    .lt('activity_date', `${dateStr}T23:59:59.999Z`)
    .order('activity_date', { ascending: false });

  if (error) {
    console.error('fetchActivitiesByDate', error);
    return [];
  }
  return (data || []).map(mapRowToActivity);
}

export interface FavoriteActivity {
  id: string;
  category: string;
  title: string;
  amount?: number | null;
  duration_mins?: number | null;
  location?: string | null;
  people?: string[];
  raw_message?: string | null;
  note?: string;
  details?: Record<string, unknown>;
}

export async function fetchFavoriteActivities(userId: string): Promise<FavoriteActivity[]> {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .eq('user_id', userId)
    .eq('is_favorite', true)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('fetchFavoriteActivities', error);
    return [];
  }
  return (data || []).map(row => ({
    id:            String(row.id),
    category:      typeof row.category === 'string' ? row.category : 'diğer',
    title:         typeof row.title === 'string' ? row.title : '',
    amount:        typeof row.amount === 'number' ? row.amount : null,
    duration_mins: typeof row.duration_mins === 'number' ? row.duration_mins : null,
    location:      typeof row.location === 'string' ? row.location : null,
    people:        Array.isArray(row.people) ? row.people as string[] : [],
    raw_message:   typeof row.raw_message === 'string' ? row.raw_message : null,
    note:          typeof row.note === 'string' ? row.note : undefined,
    details:       row.details && typeof row.details === 'object' && !Array.isArray(row.details)
                     ? row.details as Record<string, unknown>
                     : undefined,
  }));
}

export async function quickLogFavorite(userId: string, fav: FavoriteActivity): Promise<boolean> {
  if (!userId) return false;
  const { error } = await supabase.from('activities').insert({
    user_id:      userId,
    title:        fav.title,
    category:     fav.category,
    amount:       fav.amount ?? null,
    duration_mins: fav.duration_mins ?? null,
    location:     fav.location ?? null,
    people:       fav.people ?? [],
    activity_date: new Date().toISOString(),
    created_via:  'quick_log',
    raw_message:  fav.raw_message ?? fav.title,
    is_favorite:  true,
  });

  if (error) {
    console.error('quickLogFavorite', error);
    return false;
  }
  return true;
}

export interface Suggestion {
  id: string;
  text: string;
  category?: string;
  based_on?: string;
  status: 'pending' | 'accepted' | 'skipped';
}

export async function fetchPendingSuggestions(userId: string): Promise<Suggestion[]> {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('suggestions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .order('generated_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('fetchPendingSuggestions', error);
    return [];
  }
  return (data || []).map(row => ({
    id: String(row.id),
    text: typeof row.text === 'string' ? row.text : typeof row.content === 'string' ? row.content : '',
    category: typeof row.category === 'string' ? row.category : undefined,
    based_on: typeof row.based_on === 'string' ? row.based_on : undefined,
    status: 'pending',
  }));
}

export async function updateSuggestionStatus(userId: string, id: string, status: 'accepted' | 'skipped'): Promise<void> {
  if (!userId) return;
  const { error } = await supabase
    .from('suggestions')
    .update({ status })
    .eq('id', id)
    .eq('user_id', userId);

  if (error) console.error('updateSuggestionStatus', error);
}

export async function fetchDatesWithActivities(userId: string): Promise<Set<string>> {
  if (!userId) return new Set();
  const { data, error } = await supabase
    .from('activities')
    .select('created_at')
    .eq('user_id', userId);

  if (error || !data) return new Set();
  return new Set(
    data.map(row => {
      const d = new Date(row.created_at);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    })
  );
}

export function groupActivitiesByDate(activities: Activity[]): { dateKey: string; items: Activity[] }[] {
  const map = new Map<string, Activity[]>();
  for (const a of activities) {
    const key = a.date;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(a);
  }
  const keys = [...map.keys()].sort((a, b) => b.localeCompare(a));
  return keys.map(dateKey => ({ dateKey, items: map.get(dateKey)! }));
}
