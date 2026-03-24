export type ActionCategory = 'gittim' | 'yaptim' | 'harcama' | 'uyudum' | 'izledim';

export interface Activity {
  id: string;
  category: ActionCategory;
  title: string;
  time: string;
  date: string;
  note?: string;
  isFavorite?: boolean;
  details?: Record<string, unknown>;

  // Supabase/raw fields (used for debugging and for richer cards).
  amount?: number | null;
  duration_mins?: number | null;
  location?: unknown | null;
  people?: string[];
  activity_date?: unknown;
  created_at?: unknown;
  created_via?: string;
  raw_message?: string | null;
  is_favorite?: boolean;
}

export interface Suggestion {
  id: string;
  category: 'saglik' | 'sosyal' | 'finans' | 'aliskanlik';
  text: string;
  basedOn: string;
  accepted?: boolean;
}

export const CATEGORY_CONFIG: Record<ActionCategory, { label: string; icon: string; color: string }> = {
  gittim: { label: 'Gittim', icon: 'MapPin', color: '#1E88E5' },
  yaptim: { label: 'Yaptım', icon: 'CheckCircle', color: '#43A047' },
  harcama: { label: 'Harcama', icon: 'Wallet', color: '#FB8C00' },
  uyudum: { label: 'Uyudum', icon: 'Moon', color: '#7B1FA2' },
  izledim: { label: 'İzledim', icon: 'Play', color: '#E91E63' },
};
