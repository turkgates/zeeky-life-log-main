import { useState, useEffect } from 'react';
import { getAppSettings, AppSettings, DEFAULT_SETTINGS } from '../lib/appSettings';

export const useAppSettings = () => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getAppSettings()
      .then(setSettings)
      .finally(() => setIsLoading(false));
  }, []);

  return { settings, isLoading };
};
