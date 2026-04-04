/**
 * Local wall-clock helpers — avoids UTC calendar drift (e.g. 01:00 in UTC+2 → "yesterday" via toISOString).
 */

export function getLocalDateString(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** ISO 8601 with timezone offset for the user's local instant (not UTC `Z`). */
export function getLocalISOString(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  const ms = String(date.getMilliseconds()).padStart(3, '0');
  const offsetMin = -date.getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  const oh = String(Math.floor(abs / 60)).padStart(2, '0');
  const om = String(abs % 60).padStart(2, '0');
  return `${y}-${m}-${d}T${h}:${min}:${s}.${ms}${sign}${oh}:${om}`;
}

/**
 * Local calendar day as UTC ISO bounds for `timestamptz` filters (Supabase).
 * Same local day regardless of offset; avoids `${utcDate}T00:00:00.000Z` mistakes.
 */
export function getLocalDayUTCRangeISO(date: Date = new Date()): { start: string; end: string } {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

/** `YYYY-MM-DD` interpreted in the user's local timezone. */
export function getLocalDayUTCRangeISOFromYMD(ymd: string): { start: string; end: string } {
  const parts = ymd.split('-').map(Number);
  const y = parts[0];
  const mo = parts[1];
  const d = parts[2];
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) {
    return getLocalDayUTCRangeISO(new Date());
  }
  const start = new Date(y, mo - 1, d, 0, 0, 0, 0);
  const end = new Date(y, mo - 1, d, 23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

/** Calendar day at local noon as ISO-with-offset (stable `transaction_date` / `activity_date`). */
export function getLocalNoonISOStringFromYMD(ymd: string): string {
  return getLocalISOString(new Date(`${ymd}T12:00:00`));
}
