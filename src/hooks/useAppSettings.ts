import { useState, useEffect } from 'react';
import { getAppSettings, AppSettings, DEFAULT_SETTINGS } from '../lib/appSettings';
import { useCurrencyStore } from '@/store/useCurrencyStore';

export const useAppSettings = () => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const code = useCurrencyStore(s => s.code);

  useEffect(() => {
    setIsLoading(true);
    getAppSettings(code)
      .then(setSettings)
      .finally(() => setIsLoading(false));
  }, [code]);

  return { settings, isLoading };
};
