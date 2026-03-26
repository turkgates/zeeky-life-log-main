export type ActionCategory =
  | 'sağlık-spor' | 'sosyal' | 'iş-eğitim' | 'eğlence'
  | 'alışveriş' | 'yeme-içme' | 'seyahat' | 'ev-yaşam'
  | 'harcama' | 'diğer'
  // legacy
  | 'gittim' | 'yaptim' | 'uyudum' | 'izledim' | 'spor' | 'sağlık' | 'iş';

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
  'sağlık-spor': { label: 'Sağlık & Spor', icon: 'Activity',        color: '#22c55e' },
  'sosyal':      { label: 'Sosyal',         icon: 'Users',           color: '#3b82f6' },
  'iş-eğitim':  { label: 'İş & Eğitim',   icon: 'Briefcase',       color: '#6366f1' },
  'eğlence':    { label: 'Eğlence',        icon: 'Film',            color: '#ec4899' },
  'alışveriş':  { label: 'Alışveriş',      icon: 'ShoppingCart',    color: '#f97316' },
  'yeme-içme':  { label: 'Yeme & İçme',   icon: 'UtensilsCrossed', color: '#ef4444' },
  'seyahat':    { label: 'Seyahat',        icon: 'Plane',           color: '#0ea5e9' },
  'ev-yaşam':   { label: 'Ev & Yaşam',    icon: 'Home',            color: '#84cc16' },
  'harcama':    { label: 'Harcama',        icon: 'Wallet',          color: '#f59e0b' },
  'diğer':      { label: 'Diğer',          icon: 'MoreHorizontal',  color: '#94a3b8' },
  // legacy
  'gittim':  { label: 'Gittim',  icon: 'MapPin',       color: '#1E88E5' },
  'yaptim':  { label: 'Yaptım',  icon: 'CheckCircle',  color: '#43A047' },
  'uyudum':  { label: 'Uyudum',  icon: 'Moon',         color: '#7B1FA2' },
  'izledim': { label: 'İzledim', icon: 'Play',         color: '#E91E63' },
  'spor':    { label: 'Spor',    icon: 'Activity',     color: '#22c55e' },
  'sağlık':  { label: 'Sağlık',  icon: 'Activity',     color: '#22c55e' },
  'iş':      { label: 'İş',      icon: 'Briefcase',    color: '#6366f1' },
};
