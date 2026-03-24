import { useState } from 'react';
import { Filter, Check, X, Heart, Coins, Users, Activity } from 'lucide-react';
import { useSuggestions } from '@/store/useStore';
import { cn } from '@/lib/utils';

const FILTERS = [
  { key: 'all', label: 'Tümü' },
  { key: 'saglik', label: 'Sağlık', icon: Activity },
  { key: 'sosyal', label: 'Sosyal', icon: Users },
  { key: 'finans', label: 'Finans', icon: Coins },
  { key: 'aliskanlik', label: 'Alışkanlık', icon: Heart },
];

const categoryColors: Record<string, string> = {
  saglik: 'hsl(142, 71%, 45%)',
  sosyal: 'hsl(210, 80%, 55%)',
  finans: 'hsl(38, 92%, 50%)',
  aliskanlik: 'hsl(263, 55%, 50%)',
};

const categoryIcons: Record<string, typeof Activity> = {
  saglik: Activity,
  sosyal: Users,
  finans: Coins,
  aliskanlik: Heart,
};

export default function SuggestionsPage() {
  const [filter, setFilter] = useState('all');
  const { suggestions, acceptSuggestion, dismissSuggestion } = useSuggestions();

  const filtered = filter === 'all' ? suggestions : suggestions.filter(s => s.category === filter);

  return (
    <div className="pb-24 max-w-[430px] mx-auto animate-fade-in">
      <div className="flex items-center justify-between p-4">
        <h1 className="text-lg font-semibold">Tavsiyeler</h1>
        <Filter className="w-5 h-5 text-muted-foreground" />
      </div>

      {/* Filter Chips */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide px-4 pb-4 -mx-0">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-colors active:scale-95",
              filter === f.key ? "bg-primary text-primary-foreground" : "bg-card border border-border text-foreground"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Suggestions List */}
      <div className="px-4 space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">💡</p>
            <p className="text-sm text-muted-foreground">Bu kategoride tavsiye yok</p>
          </div>
        ) : (
          filtered.map(s => {
            const Icon = categoryIcons[s.category] || Activity;
            const color = categoryColors[s.category] || 'hsl(263, 55%, 50%)';
            return (
              <div key={s.id} className={cn("bg-card border border-border rounded-2xl p-4 transition-all", s.accepted && "opacity-60")}>
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: color + '20', color }}>
                    <Icon size={20} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium leading-snug">{s.text}</p>
                    <p className="text-xs text-muted-foreground mt-1">{s.basedOn}</p>
                  </div>
                </div>
                {!s.accepted && (
                  <div className="flex gap-2">
                    <button onClick={() => acceptSuggestion(s.id)} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-success/10 text-success rounded-xl text-sm font-medium active:scale-95 transition-transform">
                      <Check className="w-4 h-4" /> Kabul Et
                    </button>
                    <button onClick={() => dismissSuggestion(s.id)} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-destructive/10 text-destructive rounded-xl text-sm font-medium active:scale-95 transition-transform">
                      <X className="w-4 h-4" /> Geç
                    </button>
                  </div>
                )}
                {s.accepted && (
                  <div className="flex items-center gap-1.5 text-success text-xs font-medium">
                    <Check className="w-4 h-4" /> Kabul edildi
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
