import { supabase } from './supabase';

export interface AppSettings {
  free_daily_messages: number;
  free_monthly_activities: number;
  free_monthly_transactions: number;
  premium_monthly_price: number;
  premium_yearly_price: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  free_daily_messages: 5,
  free_monthly_activities: 5,
  free_monthly_transactions: 5,
  premium_monthly_price: 9.99,
  premium_yearly_price: 99.99,
};

export const getAppSettings = async (): Promise<AppSettings> => {
  const { data } = await supabase
    .from('app_settings')
    .select('key, value');

  const map = Object.fromEntries(
    (data || []).map((s: { key: string; value: string }) => [s.key, s.value]),
  );

  return {
    free_daily_messages:       parseInt(map.free_daily_messages       ?? String(DEFAULT_SETTINGS.free_daily_messages)),
    free_monthly_activities:   parseInt(map.free_monthly_activities   ?? String(DEFAULT_SETTINGS.free_monthly_activities)),
    free_monthly_transactions: parseInt(map.free_monthly_transactions ?? String(DEFAULT_SETTINGS.free_monthly_transactions)),
    premium_monthly_price:     parseFloat(map.premium_monthly_price   ?? String(DEFAULT_SETTINGS.premium_monthly_price)),
    premium_yearly_price:      parseFloat(map.premium_yearly_price    ?? String(DEFAULT_SETTINGS.premium_yearly_price)),
  };
};
