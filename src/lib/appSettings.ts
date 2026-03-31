import { supabase } from './supabase';

export interface AppSettings {
  free_daily_messages: number;
  free_monthly_activities: number;
  free_monthly_transactions: number;
  premium_daily_messages: number;
  premium_monthly_price: number;
  premium_yearly_price: number;
  currency_key: string;
  campaign_active: boolean;
  campaign_end_date: string;
  campaign_monthly_price: number;
  campaign_yearly_price: number;
  campaign_label: string;
  campaign_desc: string;
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
  campaign_active: false,
  campaign_end_date: '',
  campaign_monthly_price: 4.99,
  campaign_yearly_price: 39.99,
  campaign_label: '',
  campaign_desc: '',
};

export const getAppSettings = async (
  currency: string,
  language: string,
): Promise<AppSettings> => {
  const { data } = await supabase.from('app_settings').select('key, value');

  const map = Object.fromEntries(
    (data || []).map((s: { key: string; value: string }) => [s.key, s.value]),
  ) as Record<string, string | undefined>;

  const currencyKey = getCurrencyKey(currency);
  const langKey = language === 'en' ? 'en' : language === 'fr' ? 'fr' : 'tr';

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
    campaign_active: map.campaign_active === 'true',
    campaign_end_date: map.campaign_end_date ?? '',
    campaign_monthly_price: parseFloat(
      map[`campaign_monthly_price_${currencyKey}`] ?? String(DEFAULT_SETTINGS.campaign_monthly_price),
    ),
    campaign_yearly_price: parseFloat(
      map[`campaign_yearly_price_${currencyKey}`] ?? String(DEFAULT_SETTINGS.campaign_yearly_price),
    ),
    campaign_label: map[`campaign_label_${langKey}`] ?? '',
    campaign_desc: map[`campaign_desc_${langKey}`] ?? '',
  };
};
