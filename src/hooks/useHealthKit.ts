import { Capacitor } from '@capacitor/core';
import { supabase } from '@/lib/supabase';
import { getLocalDateString, getLocalISOString } from '@/lib/dateUtils';

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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchDayData(dateStr: string, Health: any): Promise<HealthDayData> {
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
    const firstItem = res?.aggregatedData?.[0];
    if (firstItem?.value) data.steps = Math.round(firstItem.value);
  } catch {}

  try {
    const res = await Health?.queryAggregated({
      dataType: 'distance',
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      bucket: 'day',
    });
    const firstItem = res?.aggregatedData?.[0];
    if (firstItem?.value) data.distance_km = Math.round(firstItem.value / 10) / 100; // metre → km
  } catch {}

  try {
    const res = await Health?.queryAggregated({
      dataType: 'active-calories',
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      bucket: 'day',
    });
    const firstItem = res?.aggregatedData?.[0];
    if (firstItem?.value) data.calories = Math.round(firstItem.value);
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
    const firstItem = res?.aggregatedData?.[0];
    if (firstItem?.value) data.sleepHours = Math.round((firstItem.value / 60 / 60) * 10) / 10;
  } catch {}

  try {
    const res = await Health?.queryAggregated({
      dataType: 'heart-rate',
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      bucket: 'day',
    });
    const firstItem = res?.aggregatedData?.[0];
    if (firstItem?.value) data.heartRate = Math.round(firstItem.value);
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
    const raw = row.activity_date as string | undefined;
    if (!raw) return;
    const dateStr = getLocalDateString(new Date(raw));
    synced.add(dateStr);
  });
  return synced;
}

// ── Main export ──────────────────────────────────────────────────────────────
export async function syncHealthKitActivities(
  userId: string,
  language: string,
): Promise<void> {
  const Health = (window as any).Capacitor?.Plugins?.HealthPlugin as any;

  if (!Capacitor.isNativePlatform() || !Health) return;

  // İzin iste
  try {
    await Health.requestHealthPermissions({
      permissions: [
        'READ_STEPS',
        'READ_DISTANCE',
        'READ_ACTIVE_CALORIES',
        'READ_SLEEP',
        'READ_HEART_RATE',
      ],
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
    const dateStr = getLocalDateString(d);
    if (!syncedDates.has(dateStr)) datesToSync.push(dateStr);
  }

  if (datesToSync.length === 0) return;

  for (const dateStr of datesToSync) {
    const dayData = await fetchDayData(dateStr, Health);

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
      activity_date: getLocalISOString(new Date(`${dateStr}T08:00:00`)),
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