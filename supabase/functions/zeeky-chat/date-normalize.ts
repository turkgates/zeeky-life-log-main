/**
 * Zeeky-chat Edge Function — bu repo’da ana handler dosyası yok (Supabase’de deploy).
 * Aşağıdaki fonksiyonları `import { ... } from './date-normalize.ts'` ile kullanın
 * veya Edge Function içindeki ESKİ tek satırlık if bloklarını aşağıdaki INLINE
 * sürümlerle değiştirin.
 *
 * Örnek (import):
 *   let activityDate = activity.activity_date
 *   activityDate = normalizeActivityDateTime(activityDate)
 *
 *   let transactionDate = transaction.transaction_date
 *   transactionDate = normalizeTransactionDateTime(transactionDate)
 */

export function normalizeActivityDateTime(
  activityDate: string | undefined | null,
): string {
  if (!activityDate || new Date(activityDate).getFullYear() < 2025) {
    return new Date().toISOString();
  }
  const date = new Date(activityDate);
  if (date.getHours() === 0 && date.getMinutes() === 0 && date.getSeconds() === 0) {
    const now = new Date();
    date.setHours(now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds());
    return date.toISOString();
  }
  return activityDate;
}

export function normalizeTransactionDateTime(
  transactionDate: string | undefined | null,
): string {
  if (!transactionDate || new Date(transactionDate).getFullYear() < 2025) {
    return new Date().toISOString();
  }
  const date = new Date(transactionDate);
  if (date.getHours() === 0 && date.getMinutes() === 0 && date.getSeconds() === 0) {
    const now = new Date();
    date.setHours(now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds());
    return date.toISOString();
  }
  return transactionDate;
}
