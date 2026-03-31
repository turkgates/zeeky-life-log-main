import { useState, useEffect } from 'react';
import { getAppSettings, AppSettings, DEFAULT_SETTINGS } from '../lib/appSettings';
import { useCurrencyStore } from '@/store/useCurrencyStore';
import { useLanguageStore } from '@/store/useLanguageStore';

export const useAppSettings = () => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const code = useCurrencyStore(s => s.code);
  const { language } = useLanguageStore();

  useEffect(() => {
    setIsLoading(true);
    getAppSettings(code, language)
      .then(setSettings)
      .finally(() => setIsLoading(false));
  }, [code, language]);

  return { settings, isLoading };
};
