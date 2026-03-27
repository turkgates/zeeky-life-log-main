import { useState, useEffect, useCallback } from 'react';
import { Filter, Check, X, Heart, Coins, Users, Activity, RefreshCw, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/useAuthStore';

type CategoryKey = 'all' | 'sağlık' | 'sosyal' | 'finans' | 'alışkanlık';
type StatusFilter = 'all' | 'pending' | 'accepted' | 'skipped';

const CATEGORY_OPTIONS: { key: CategoryKey; label: string }[] = [
  { key: 'all', label: 'Tümü' },
  { key: 'sağlık', label: 'Sağlık' },
  { key: 'sosyal', label: 'Sosyal' },
  { key: 'finans', label: 'Finans' },
  { key: 'alışkanlık', label: 'Alışkanlık' },
];

const STATUS_OPTIONS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'Tümü' },
  { key: 'pending', label: 'Bekleyen' },
  { key: 'accepted', label: 'Kabul Edilen' },
  { key: 'skipped', label: 'Geçilen' },
];

const CATEGORY_COLORS: Record<string, string> = {
  'sağlık':     '#22c55e',
  'sosyal':     '#3b82f6',
  'finans':     '#f97316',
  'alışkanlık': '#8b5cf6',
};

const CATEGORY_ICONS: Record<string, typeof Activity> = {
  'sağlık':     Activity,
  'sosyal':     Users,
  'finans':     Coins,
  'alışkanlık': Heart,
};

interface Suggestion {
  id: string;
  category: string;
  content: string;
  reason?: string;
  status: string;
  generated_at: string;
}

async function fetchSuggestions(
  userId: string,
  status: StatusFilter,
  category: CategoryKey,
): Promise<Suggestion[]> {
  if (!userId) return [];
  let query = supabase
    .from('suggestions')
    .select('*')
    .eq('user_id', userId)
    .order('generated_at', { ascending: false });

  if (status !== 'all') {
    query = query.eq('status', status);
  }
  if (category !== 'all') {
    query = query.eq('category', category);
  }

  const { data, error } = await query;
  console.log('Suggestions query:', data, error);
  return (data as Suggestion[]) ?? [];
}

export default function SuggestionsPage() {
  const { user } = useAuthStore();
  const userId = user?.id ?? '';
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('all');
  const [filterCategory, setFilterCategory] = useState<CategoryKey>('all');
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [sheetStatus, setSheetStatus] = useState<StatusFilter>('all');
  const [sheetCategory, setSheetCategory] = useState<CategoryKey>('all');

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  const filterActive = filterStatus !== 'all' || filterCategory !== 'all';

  const generateSuggestions = useCallback(async (mode: 'auto' | 'refresh' = 'auto') => {
    if (!userId) return;
    setIsGenerating(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zeeky-suggestions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY as string,
          },
          body: JSON.stringify({
            user_id: userId,
            mode,
          }),
        }
      );

      const data = await response.json();
      console.log('Suggestions response:', data);

      if (data.suggestions && data.suggestions.length > 0) {
        setSuggestions(prev => [...(data.suggestions as Suggestion[]), ...prev]);
      }
    } catch (error) {
      console.error('Generate suggestions error:', error);
    } finally {
      setIsGenerating(false);
    }
  }, [userId]);

  const refreshSuggestions = useCallback(async () => {
    if (!userId) return;
    const today = new Date().toISOString().split('T')[0];
    await supabase
      .from('suggestions')
      .delete()
      .eq('user_id', userId)
      .eq('status', 'pending')
      .gte('generated_at', `${today}T00:00:00.000Z`);
    setSuggestions([]);
    await generateSuggestions('refresh');
    const list = await fetchSuggestions(userId, filterStatus, filterCategory);
    setSuggestions(list);
  }, [generateSuggestions, filterStatus, filterCategory, userId]);

  const handleAccept = async (id: string) => {
    if (!userId) return;
    await supabase
      .from('suggestions')
      .update({ status: 'accepted', responded_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId);
    setSuggestions(prev => prev.filter(s => s.id !== id));
  };

  const handleSkip = async (id: string) => {
    if (!userId) return;
    await supabase
      .from('suggestions')
      .update({ status: 'skipped', responded_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId);
    setSuggestions(prev => prev.filter(s => s.id !== id));
  };

  // İlk yükleme: gerekirse üret, sonra listeyi çek
  useEffect(() => {
    const init = async () => {
      if (!userId) {
        setIsLoading(false);
        return;
      }
      const today = new Date().toISOString().split('T')[0];
      const { data: todaySuggestions } = await supabase
        .from('suggestions')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'pending')
        .gte('generated_at', `${today}T00:00:00.000Z`)
        .lte('generated_at', `${today}T23:59:59.999Z`)
        .limit(1);

      if (!todaySuggestions || todaySuggestions.length === 0) {
        await generateSuggestions('auto');
      }
      const list = await fetchSuggestions(userId, 'all', 'all');
      setSuggestions(list);
      setIsLoading(false);
    };
    void init();
  }, [generateSuggestions, userId]);

  useEffect(() => {
    if (showFilterSheet) {
      setSheetStatus(filterStatus);
      setSheetCategory(filterCategory);
    }
  }, [showFilterSheet, filterStatus, filterCategory]);

  const applyFilters = async () => {
    if (!userId) return;
    setFilterStatus(sheetStatus);
    setFilterCategory(sheetCategory);
    setShowFilterSheet(false);
    setIsLoading(true);
    try {
      const list = await fetchSuggestions(userId, sheetStatus, sheetCategory);
      setSuggestions(list);
    } finally {
      setIsLoading(false);
    }
  };

  const showSpinner = isLoading || isGenerating;

  return (
    <div className="pb-24 max-w-[430px] mx-auto animate-fade-in relative">

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <h1 className="text-lg font-semibold">Tavsiyeler</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void refreshSuggestions()}
            disabled={isGenerating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border text-xs font-medium text-muted-foreground active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', isGenerating && 'animate-spin')} />
            Yenile
          </button>
          <button
            type="button"
            onClick={() => setShowFilterSheet(true)}
            className="relative p-2 rounded-full active:bg-muted"
            aria-label="Filtrele"
          >
            <Filter className="w-5 h-5 text-muted-foreground" />
            {filterActive && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-500 border border-white" />
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 space-y-3">
        {showSpinner ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
            <p className="text-sm text-muted-foreground">
              {isGenerating ? 'Zeeky tavsiyeler hazırlıyor...' : 'Yükleniyor...'}
            </p>
          </div>
        ) : suggestions.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">💡</p>
            <p className="text-sm text-muted-foreground">Bu filtreye uygun tavsiye yok</p>
          </div>
        ) : (
          suggestions.map(s => {
            const Icon  = CATEGORY_ICONS[s.category] ?? Activity;
            const color = CATEGORY_COLORS[s.category] ?? '#8b5cf6';
            const isPending = s.status === 'pending';
            const cardBg =
              s.status === 'accepted'
                ? 'bg-green-50 border-green-100'
                : s.status === 'skipped'
                  ? 'bg-gray-100 border-gray-200'
                  : 'bg-white border-border';

            return (
              <div key={s.id} className={cn('border rounded-2xl p-4', cardBg)}>
                <div className="flex items-start gap-3 mb-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: color + '20', color }}
                  >
                    <Icon size={20} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium leading-snug">{s.content}</p>
                    {s.reason && (
                      <p className="text-xs text-muted-foreground mt-1">{s.reason}</p>
                    )}
                  </div>
                </div>
                {isPending && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void handleAccept(s.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-success/10 text-success rounded-xl text-sm font-medium active:scale-95 transition-transform"
                    >
                      <Check className="w-4 h-4" /> Kabul Et
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSkip(s.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-destructive/10 text-destructive rounded-xl text-sm font-medium active:scale-95 transition-transform"
                    >
                      <X className="w-4 h-4" /> Geç
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Filter bottom sheet */}
      {showFilterSheet && (
        <>
          <div
            className="fixed inset-0 z-[300] bg-black/50"
            onClick={() => setShowFilterSheet(false)}
          />
          <div
            className="fixed inset-x-0 bottom-0 z-[301] bg-card rounded-t-3xl shadow-2xl max-w-[430px] mx-auto"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>
            <div className="px-5 pb-4">
              <h2 className="text-base font-semibold mb-4">Filtrele</h2>

              <p className="text-xs font-semibold text-muted-foreground mb-2">Durum</p>
              <div className="flex flex-wrap gap-2 mb-4">
                {STATUS_OPTIONS.map(o => (
                  <button
                    key={o.key}
                    type="button"
                    onClick={() => setSheetStatus(o.key)}
                    className={cn(
                      'px-3 py-2 rounded-full text-xs font-medium border',
                      sheetStatus === o.key
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background border-border',
                    )}
                  >
                    {o.label}
                  </button>
                ))}
              </div>

              <p className="text-xs font-semibold text-muted-foreground mb-2">Kategori</p>
              <div className="flex flex-wrap gap-2 mb-6">
                {CATEGORY_OPTIONS.map(o => (
                  <button
                    key={o.key}
                    type="button"
                    onClick={() => setSheetCategory(o.key)}
                    className={cn(
                      'px-3 py-2 rounded-full text-xs font-medium border',
                      sheetCategory === o.key
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background border-border',
                    )}
                  >
                    {o.label}
                  </button>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowFilterSheet(false)}
                  className="flex-1 py-3 rounded-xl bg-muted text-muted-foreground font-semibold text-sm"
                >
                  İptal
                </button>
                <button
                  type="button"
                  onClick={() => void applyFilters()}
                  className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm"
                >
                  Uygula
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
