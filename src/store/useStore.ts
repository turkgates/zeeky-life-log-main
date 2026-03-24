import { useState, useCallback } from 'react';
import { Activity, Suggestion } from '@/types/zeeky';

const MOCK_ACTIVITIES: Activity[] = [
  { id: '1', category: 'gittim', title: 'Starbucks', time: '09:30', date: '2026-03-16', note: 'Ahmet ile kahve içtik' },
  { id: '2', category: 'yaptim', title: 'Spor', time: '11:00', date: '2026-03-16', note: '45 dk koşu bandı', details: { duration: 45 } },
  { id: '3', category: 'harcama', title: 'Market alışverişi', time: '13:15', date: '2026-03-16', details: { amount: 245, subcategory: 'yiyecek' } },
  { id: '4', category: 'uyudum', title: 'Gece uykusu', time: '23:00', date: '2026-03-15', details: { sleepStart: '23:00', wakeUp: '07:00', quality: 4 } },
  { id: '5', category: 'izledim', title: 'The Bear S3', time: '21:00', date: '2026-03-15', details: { type: 'Dizi', rating: 5 } },
  { id: '6', category: 'gittim', title: 'Ofis', time: '08:30', date: '2026-03-15' },
  { id: '7', category: 'harcama', title: 'Taksi', time: '08:15', date: '2026-03-14', details: { amount: 120, subcategory: 'ulaşım' } },
];

const MOCK_SUGGESTIONS: Suggestion[] = [
  { id: '1', category: 'saglik', text: 'Bu hafta sadece 2 gün spor yaptın. Haftada 4 gün hedefine ulaşmak için bugün de spor yapabilirsin!', basedOn: 'Son 7 günlük aktivite verilerine göre' },
  { id: '2', category: 'finans', text: 'Bu ay yeme-içme harcamaların geçen aya göre %30 arttı. Dikkat etmek isteyebilirsin.', basedOn: 'Aylık harcama karşılaştırmasına göre' },
  { id: '3', category: 'sosyal', text: 'Son 5 gündür arkadaşlarınla bir aktivite yapmadın. Birini aramaya ne dersin?', basedOn: 'Sosyal aktivite sıklığına göre' },
  { id: '4', category: 'aliskanlik', text: 'Uyku düzenin çok iyi! Son 7 gün ortalama 7.5 saat uyumuşsun.', basedOn: 'Uyku verilerine göre' },
  { id: '5', category: 'saglik', text: '3 gündür su içme kaydın yok. Günde en az 8 bardak su içmeyi unutma!', basedOn: 'Sağlık takip verilerine göre' },
];

const FAVORITE_ACTIONS = [
  { id: 'f1', category: 'gittim' as const, title: 'Ofis' },
  { id: 'f2', category: 'yaptim' as const, title: 'Spor' },
  { id: 'f3', category: 'harcama' as const, title: 'Kahve' },
  { id: 'f4', category: 'uyudum' as const, title: 'Şekerleme' },
];

export function useActivities() {
  const [activities, setActivities] = useState<Activity[]>(MOCK_ACTIVITIES);

  const addActivity = useCallback((activity: Omit<Activity, 'id'>) => {
    setActivities(prev => [{ ...activity, id: Date.now().toString() }, ...prev]);
  }, []);

  const removeActivity = useCallback((id: string) => {
    setActivities(prev => prev.filter(a => a.id !== id));
  }, []);

  const updateActivity = useCallback((id: string, data: Partial<Activity>) => {
    setActivities(prev => prev.map(a => a.id === id ? { ...a, ...data } : a));
  }, []);

  const getActivity = useCallback((id: string) => {
    return activities.find(a => a.id === id);
  }, [activities]);

  const todayActivities = activities.filter(a => a.date === '2026-03-16');

  return { activities, todayActivities, addActivity, removeActivity, updateActivity, getActivity, favorites: FAVORITE_ACTIONS };
}

export function useSuggestions() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>(MOCK_SUGGESTIONS);

  const acceptSuggestion = useCallback((id: string) => {
    setSuggestions(prev => prev.map(s => s.id === id ? { ...s, accepted: true } : s));
  }, []);

  const dismissSuggestion = useCallback((id: string) => {
    setSuggestions(prev => prev.filter(s => s.id !== id));
  }, []);

  return { suggestions, acceptSuggestion, dismissSuggestion };
}
