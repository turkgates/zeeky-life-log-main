import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import tr from './locales/tr.json';
import en from './locales/en.json';
import fr from './locales/fr.json';

const SUPPORTED = ['tr', 'en', 'fr'] as const;

export function detectLanguage(): string {
  if (typeof window === 'undefined') return 'tr';
  const saved = localStorage.getItem('zeeky_language');
  if (saved && (SUPPORTED as readonly string[]).includes(saved)) return saved;
  const browserLang = navigator.language.split('-')[0];
  if ((SUPPORTED as readonly string[]).includes(browserLang)) return browserLang;
  return 'tr';
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      tr: { translation: tr },
      en: { translation: en },
      fr: { translation: fr },
    },
    fallbackLng: 'tr',
    lng: detectLanguage(),
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage'],
      lookupLocalStorage: 'zeeky_language',
      caches: ['localStorage'],
    },
  });

export default i18n;
