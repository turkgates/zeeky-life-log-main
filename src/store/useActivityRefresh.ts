import { create } from 'zustand';

interface ActivityRefreshStore {
  key: number;
  refresh: () => void;
}

export const useActivityRefresh = create<ActivityRefreshStore>(set => ({
  key: 0,
  refresh: () => set(s => ({ key: s.key + 1 })),
}));
