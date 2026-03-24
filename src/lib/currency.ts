export const CURRENCIES: { code: string; symbol: string; label: string }[] = [
  { code: 'TRY', symbol: '₺', label: 'TRY (₺)' },
  { code: 'EUR', symbol: '€', label: 'EUR (€)' },
  { code: 'USD', symbol: '$', label: 'USD ($)' },
  { code: 'GBP', symbol: '£', label: 'GBP (£)' },
  { code: 'CHF', symbol: 'Fr', label: 'CHF (Fr)' },
];

export const getCurrencySymbol = (currency: string): string => {
  const symbols: Record<string, string> = {
    TRY: '₺', EUR: '€', USD: '$', GBP: '£', CHF: 'Fr',
  };
  return symbols[currency] || '₺';
};
