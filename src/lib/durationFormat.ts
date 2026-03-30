import type { TFunction } from 'i18next';

/** Max duration representable by 0–23 h + 5‑minute steps (23:55). */
export const MAX_DURATION_PICKER_MINS = 23 * 60 + 55;

export function minsToHoursAndMins(mins: number | null): { hours: number; minutes: number } {
  if (!mins) return { hours: 0, minutes: 0 };
  const capped = Math.min(mins, MAX_DURATION_PICKER_MINS);
  return {
    hours: Math.floor(capped / 60),
    minutes: capped % 60,
  };
}

export function snapMinutesToFiveStep(m: number): number {
  const r = Math.round(m / 5) * 5;
  return Math.min(55, Math.max(0, r));
}

/**
 * Smart duration for UI: minutes → hours+minutes → days (+ hours when needed).
 * Returns `null` when there is nothing to show.
 */
export function formatDuration(mins: number, t: TFunction): string | null {
  if (!mins || mins === 0) return null;

  if (mins < 60) {
    return `${mins} ${t('common.minutes')}`;
  }

  if (mins < 1440) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (m === 0) return `${h} ${t('common.hours')}`;
    return `${h} ${t('common.hours')} ${m} ${t('common.minutes')}`;
  }

  const days = Math.floor(mins / 1440);
  const remaining = mins % 1440;
  const hours = Math.floor(remaining / 60);

  if (hours === 0) return `${days} ${t('common.days')}`;
  return `${days} ${t('common.days')} ${hours} ${t('common.hours')}`;
}

/** Same as `formatDuration` but never null (empty string instead). */
export function formatDurationMinutes(mins: number, t: TFunction): string {
  return formatDuration(mins, t) ?? '';
}

export function getActivityDurationMins(activity: {
  duration_mins?: number | null;
  details?: Record<string, unknown> | null;
}): number | null {
  if (typeof activity.duration_mins === 'number' && activity.duration_mins > 0) {
    return activity.duration_mins;
  }
  const d = activity.details?.duration;
  if (typeof d === 'number' && d > 0) return d;
  return null;
}
