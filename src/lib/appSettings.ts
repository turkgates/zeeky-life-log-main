import { supabase } from './supabase';

export interface AppSettings {
  free_daily_messages: number;
  free_monthly_activities: number;
  free_monthly_transactions: number;
  premium_daily_messages: number;
  premium_monthly_price: number;
  premium_yearly_price: number;
  currency_key: string;
}

const getCurrencyKey = (currency: string): string => {
  const map: Record<string, string> = {
    EUR: 'eur',
    USD: 'usd',
    TRY: 'try',
    GBP: 'gbp',
  };
  return map[currency] || 'eur';
};

export const DEFAULT_SETTINGS: AppSettings = {
  free_daily_messages: 5,
  free_monthly_activities: 5,
  free_monthly_transactions: 5,
  premium_daily_messages: 50,
  premium_monthly_price: 7.99,
  premium_yearly_price: 59.99,
  currency_key: 'eur',
};

export const getAppSettings = async (currency: string): Promise<AppSettings> => {
  const { data } = await supabase.from('app_settings').select('key, value');

  const map = Object.fromEntries(
    (data || []).map((s: { key: string; value: string }) => [s.key, s.value]),
  ) as Record<string, string | undefined>;

  const currencyKey = getCurrencyKey(currency);

  return {
    free_daily_messages: parseInt(map.free_daily_messages ?? String(DEFAULT_SETTINGS.free_daily_messages)),
    free_monthly_activities: parseInt(map.free_monthly_activities ?? String(DEFAULT_SETTINGS.free_monthly_activities)),
    free_monthly_transactions: parseInt(
      map.free_monthly_transactions ?? String(DEFAULT_SETTINGS.free_monthly_transactions),
    ),
    premium_daily_messages: parseInt(map.premium_daily_messages ?? String(DEFAULT_SETTINGS.premium_daily_messages)),
    premium_monthly_price: parseFloat(
      map[`premium_monthly_price_${currencyKey}`] ?? map.premium_monthly_price ?? String(DEFAULT_SETTINGS.premium_monthly_price),
    ),
    premium_yearly_price: parseFloat(
      map[`premium_yearly_price_${currencyKey}`] ?? map.premium_yearly_price ?? String(DEFAULT_SETTINGS.premium_yearly_price),
    ),
    currency_key: currencyKey,
  };
};
