import { create } from 'zustand';

interface CurrencyStore {
  symbol: string;
  code: string;
  setCurrency: (code: string, symbol: string) => void;
}

export const useCurrencyStore = create<CurrencyStore>((set) => ({
  symbol: '₺',
  code: 'TRY',
  setCurrency: (code, symbol) => set({ code, symbol }),
}));
