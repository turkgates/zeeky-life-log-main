import { Capacitor } from '@capacitor/core';
import { supabase } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Health = (window as any).Capacitor?.Plugins?.CapacitorHealthExtended;

export interface HealthDayData {
  steps?: number;
  distance_km?: number;
  calories?: number;
  sleepHours?: number;
  heartRate?: number;
}

// ── Title builder ────────────────────────────────────────────────────────────
function buildTitle(data: HealthDayData, language: string): string {
  const parts: string[] = [];

  if (language === 'fr') {
    if (data.steps)      parts.push(`${data.steps.toLocaleString('fr-FR')} pas`);
    if (data.distance_km) parts.push(`${data.distance_km.toLocaleString('fr-FR')} km`);
    if (data.sleepHours) parts.push(`${data.sleepHours}h sommeil`);
  } else if (language === 'en') {
    if (data.steps)      parts.push(`${data.steps.toLocaleString('en-US')} steps`);
    if (data.distance_km) parts.push(`${data.distance_km.toLocaleString('en-US')} km`);
    if (data.sleepHours) parts.push(`${data.sleepHours}h sleep`);
  } else {
    if (data.steps)      parts.push(`${data.steps.toLocaleString('tr-TR')} adım`);
    if (data.distance_km) parts.push(`${data.distance_km.toLocaleString('tr-TR')} km`);
    if (data.sleepHours) parts.push(`${data.sleepHours} saat uyku`);
  }

  return parts.join(' · ');
}

function buildCategoryTitle(language: string): string {
  if (language === 'en') return 'Health Summary';
  if (language === 'fr') return 'Bilan de santé';
  return 'Sağlık Özeti';
}

// ── Fetch one day from HealthKit ─────────────────────────────────────────────
async function fetchDayData(dateStr: string): Promise<HealthDayData> {
  const data: HealthDayData = {};
  const start = new Date(`${dateStr}T00:00:00`);
  const end   = new Date(`${dateStr}T23:59:59`);

  try {
    const res = await Health?.queryAggregated({
      dataType: 'steps',
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      bucket: 'day',
    });
    if (res?.value) data.steps = Math.round(res.value);
  } catch {}

  try {
    const res = await Health?.queryAggregated({
      dataType: 'distance',
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      bucket: 'day',
    });
    if (res?.value) data.distance_km = Math.round(res.value / 10) / 100; // metre → km
  } catch {}

  try {
    const res = await Health?.queryAggregated({
      dataType: 'calories',
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      bucket: 'day',
    });
    if (res?.value) data.calories = Math.round(res.value);
  } catch {}

  try {
    // Uyku: önceki gün 20:00 → bu gün 12:00
    const sleepStart = new Date(`${dateStr}T00:00:00`);
    sleepStart.setDate(sleepStart.getDate() - 1);
    sleepStart.setHours(20, 0, 0, 0);
    const sleepEnd = new Date(`${dateStr}T12:00:00`);

    const res = await Health?.queryAggregated({
      dataType: 'sleep',
      startDate: sleepStart.toISOString(),
      endDate: sleepEnd.toISOString(),
      bucket: 'day',
    });
    if (res?.value) data.sleepHours = Math.round((res.value / 60) * 10) / 10;
  } catch {}

  try {
    const res = await Health?.queryAggregated({
      dataType: 'heartRate',
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      bucket: 'day',
    });
    if (res?.value) data.heartRate = Math.round(res.value);
  } catch {}

  return data;
}

// ── Which dates already synced? ──────────────────────────────────────────────
async function getSyncedDates(userId: string): Promise<Set<string>> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data } = await supabase
    .from('activities')
    .select('activity_date')
    .eq('user_id', userId)
    .eq('created_via', 'healthkit')
    .gte('activity_date', sevenDaysAgo.toISOString());

  const synced = new Set<string>();
  data?.forEach(row => {
    const dateStr = (row.activity_date as string)?.split('T')[0];
    if (dateStr) synced.add(dateStr);
  });
  return synced;
}

// ── Main export ──────────────────────────────────────────────────────────────
export async function syncHealthKitActivities(
  userId: string,
  language: string,
): Promise<void> {
  if (!Capacitor.isNativePlatform() || !Health) return;

  // İzin iste
  try {
    await Health.requestAuthorization({
      read: ['steps', 'distance', 'calories', 'sleep', 'heartRate'],
    });
  } catch {
    return;
  }

  // Hangi günler sync edilmemiş?
  const syncedDates = await getSyncedDates(userId);
  const datesToSync: string[] = [];

  for (let i = 1; i <= 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    if (!syncedDates.has(dateStr)) datesToSync.push(dateStr);
  }

  if (datesToSync.length === 0) return;

  for (const dateStr of datesToSync) {
    const dayData = await fetchDayData(dateStr);

    const hasData = dayData.steps || dayData.distance_km ||
                    dayData.calories || dayData.sleepHours || dayData.heartRate;
    if (!hasData) continue;

    const title = buildTitle(dayData, language);
    if (!title) continue;

    await supabase.from('activities').insert({
      user_id:       userId,
      title:         title,
      category:      'sağlık-spor',
      amount:        null,
      duration_mins: dayData.sleepHours ? Math.round(dayData.sleepHours * 60) : null,
      quantity:      dayData.steps ?? null,
      quantity_unit: dayData.steps ? 'adım' : null,
      location:      null,
      people:        null,
      activity_date: `${dateStr}T08:00:00`,
      created_via:   'healthkit',
      raw_message:   JSON.stringify({
        steps:       dayData.steps,
        distance_km: dayData.distance_km,
        calories:    dayData.calories,
        sleep:       dayData.sleepHours,
        heartRate:   dayData.heartRate,
        label:       buildCategoryTitle(language),
      }),
      is_favorite:   false,
    });
  }
}