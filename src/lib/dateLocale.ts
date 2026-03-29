import i18n from '@/i18n';
import type { Activity } from '@/types/zeeky';

export function getLocaleTag(): string {
  const lang = i18n.language;
  if (lang === 'en') return 'en-US';
  if (lang === 'fr') return 'fr-FR';
  return 'tr-TR';
}

function parseDateInput(dateStr: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return new Date(`${dateStr}T12:00:00`);
  }
  return new Date(dateStr);
}

export function formatDate(dateStr: string, options?: Intl.DateTimeFormatOptions) {
  const date = parseDateInput(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  const locale = getLocaleTag();
  return date.toLocaleDateString(locale, options || {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatDateTime(dateStr: string) {
  const date = parseDateInput(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  const locale = getLocaleTag();
  return date.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getDayName(date: Date) {
  const locale = getLocaleTag();
  return date.toLocaleDateString(locale, { weekday: 'short' });
}

export function getMonthName(date: Date) {
  const locale = getLocaleTag();
  return date.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
}

/** Prefer full ISO from `activity_date` (UTC from DB → local when formatted); else local `date` + `time`. */
export function activityDateTimeSource(activity: Pick<Activity, 'date' | 'time' | 'activity_date'>): string {
  const raw = activity.activity_date;
  if (typeof raw === 'string' && raw.trim()) return raw;
  const d = activity.date;
  const rawT = activity.time || '12:00';
  const m = rawT.match(/^(\d{1,2}):(\d{2})/);
  const hh = m ? String(Math.min(23, Math.max(0, parseInt(m[1], 10)))).padStart(2, '0') : '12';
  const mm = m ? String(Math.min(59, Math.max(0, parseInt(m[2], 10)))).padStart(2, '0') : '00';
  return `${d}T${hh}:${mm}:00`;
}

/** Local calendar + time (UTC instant interpreted in user locale). */
export function formatActivityDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  const locale = getLocaleTag();
  return date.toLocaleString(locale, {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}
