export const CURRENCIES: { code: string; symbol: string; label: string }[] = [
  { code: 'TRY', symbol: '₺', label: 'TRY (₺)' },
  { code: 'EUR', symbol: '€', label: 'EUR (€)' },
  { code: 'USD', symbol: '$', label: 'USD ($)' },
];

export const getCurrencySymbol = (currency: string): string => {
  const symbols: Record<string, string> = {
    TRY: '₺', EUR: '€', USD: '$',
  };
  return symbols[currency] || '₺';
};
