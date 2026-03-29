import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import i18n, { detectLanguage } from '@/i18n';

interface LanguageStore {
  language: string;
  setLanguage: (lang: string, userId?: string) => Promise<void>;
  loadLanguage: (userId: string) => Promise<void>;
}

export const useLanguageStore = create<LanguageStore>((set) => ({
  language: detectLanguage(),

  setLanguage: async (lang: string, userId?: string) => {
    set({ language: lang });
    await i18n.changeLanguage(lang);
    localStorage.setItem('zeeky_language', lang);

    if (userId) {
      await supabase
        .from('user_profiles')
        .update({ language: lang })
        .eq('user_id', userId);
    }
  },

  loadLanguage: async (userId: string) => {
    const savedLang = localStorage.getItem('zeeky_language');

    if (savedLang) {
      void i18n.changeLanguage(savedLang);
      set({ language: savedLang });
      return;
    }

    const { data } = await supabase
      .from('user_profiles')
      .select('language')
      .eq('user_id', userId)
      .single();

    if (data?.language) {
      void i18n.changeLanguage(data.language as string);
      set({ language: data.language as string });
    }
  },
}));
