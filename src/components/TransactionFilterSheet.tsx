import { useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCurrencyStore } from '@/store/useCurrencyStore';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';

export interface TransactionFilters {
  type: 'all' | 'income' | 'expense';
  categories: string[];
  dateRange: string;
  customStart?: Date;
  customEnd?: Date;
  minAmount: string;
  maxAmount: string;
  recurring: 'all' | 'recurring' | 'oneTime';
  sort: 'newest' | 'oldest' | 'highest' | 'lowest';
}

const ALL_CATEGORIES = [
  { key: 'yiyecek', label: 'Yiyecek', icon: '🍔' },
  { key: 'eglence', label: 'Eğlence', icon: '🎬' },
  { key: 'ulasim', label: 'Ulaşım', icon: '🚗' },
  { key: 'teknoloji', label: 'Teknoloji', icon: '💻' },
  { key: 'maas', label: 'Maaş', icon: '💰' },
  { key: 'freelance', label: 'Freelance', icon: '💼' },
  { key: 'yatirim', label: 'Yatırım', icon: '📈' },
  { key: 'diger', label: 'Diğer', icon: '📦' },
];

const DEFAULT_FILTERS: TransactionFilters = {
  type: 'all',
  categories: [],
  dateRange: 'all',
  minAmount: '',
  maxAmount: '',
  recurring: 'all',
  sort: 'newest',
};

interface Props {
  filters: TransactionFilters;
  onApply: (f: TransactionFilters) => void;
  onClose: () => void;
}

export function getActiveFilterCount(f: TransactionFilters): number {
  let count = 0;
  if (f.type !== 'all') count++;
  if (f.categories.length > 0) count++;
  if (f.dateRange !== 'all') count++;
  if (f.minAmount || f.maxAmount) count++;
  if (f.recurring !== 'all') count++;
  if (f.sort !== 'newest') count++;
  return count;
}

export default function TransactionFilterSheet({ filters, onApply, onClose }: Props) {
  const [local, setLocal] = useState<TransactionFilters>({ ...filters });
  const currencySymbol = useCurrencyStore(s => s.symbol);

  const toggleCategory = (key: string) => {
    setLocal(prev => ({
      ...prev,
      categories: prev.categories.includes(key)
        ? prev.categories.filter(c => c !== key)
        : [...prev.categories, key],
    }));
  };

  return (
    <>
      <div className="fixed inset-0 z-[300] bg-black/60" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-[301] bg-card rounded-t-3xl shadow-2xl animate-slide-up max-h-[85vh] flex flex-col" style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}>
        <div className="flex justify-center py-3">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        <div className="flex items-center justify-between px-5 mb-4">
          <h3 className="font-semibold text-base">Filtrele</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-5">
          {/* Type */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">Tür</label>
            <div className="flex gap-2">
              {[{ k: 'all', l: 'Tümü' }, { k: 'income', l: 'Gelir' }, { k: 'expense', l: 'Gider' }].map(t => (
                <button key={t.k} onClick={() => setLocal(p => ({ ...p, type: t.k as any }))}
                  className={cn("flex-1 py-2 rounded-xl text-xs font-semibold transition-colors", local.type === t.k ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}
                >{t.l}</button>
              ))}
            </div>
          </div>

          {/* Categories */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">Kategori</label>
            <div className="flex flex-wrap gap-2">
              {ALL_CATEGORIES.map(c => (
                <button key={c.key} onClick={() => toggleCategory(c.key)}
                  className={cn("px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1", local.categories.includes(c.key) ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground")}
                >{c.icon} {c.label}</button>
              ))}
            </div>
          </div>

          {/* Date Range */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">Tarih Aralığı</label>
            <div className="flex flex-wrap gap-2">
              {[
                { k: 'all', l: 'Tümü' }, { k: 'thisWeek', l: 'Bu Hafta' }, { k: 'thisMonth', l: 'Bu Ay' },
                { k: 'last3Months', l: 'Son 3 Ay' }, { k: 'thisYear', l: 'Bu Yıl' }, { k: 'custom', l: 'Özel Aralık' },
              ].map(d => (
                <button key={d.k} onClick={() => setLocal(p => ({ ...p, dateRange: d.k }))}
                  className={cn("px-3 py-1.5 rounded-full text-xs font-medium transition-colors", local.dateRange === d.k ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}
                >{d.l}</button>
              ))}
            </div>
            {local.dateRange === 'custom' && (
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">Başlangıç</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="w-full bg-muted rounded-xl px-3 py-2.5 text-sm text-left border border-border">
                        {local.customStart ? format(local.customStart, 'dd/MM/yyyy') : 'Seç'}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={local.customStart} onSelect={d => setLocal(p => ({ ...p, customStart: d }))} className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">Bitiş</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="w-full bg-muted rounded-xl px-3 py-2.5 text-sm text-left border border-border">
                        {local.customEnd ? format(local.customEnd, 'dd/MM/yyyy') : 'Seç'}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={local.customEnd} onSelect={d => setLocal(p => ({ ...p, customEnd: d }))} className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            )}
          </div>

          {/* Amount Range */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">Tutar Aralığı</label>
            <div className="grid grid-cols-2 gap-3">
              <input type="number" placeholder={`Min ${currencySymbol}`} value={local.minAmount} onChange={e => setLocal(p => ({ ...p, minAmount: e.target.value }))}
                className="w-full bg-muted rounded-xl px-3 py-2.5 text-sm outline-none border border-border focus:border-accent transition-colors" />
              <input type="number" placeholder={`Max ${currencySymbol}`} value={local.maxAmount} onChange={e => setLocal(p => ({ ...p, maxAmount: e.target.value }))}
                className="w-full bg-muted rounded-xl px-3 py-2.5 text-sm outline-none border border-border focus:border-accent transition-colors" />
            </div>
          </div>

          {/* Recurring */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">Tekrarlayan</label>
            <div className="flex gap-2">
              {[{ k: 'all', l: 'Tümü' }, { k: 'recurring', l: 'Tekrarlayan' }, { k: 'oneTime', l: 'Tek seferlik' }].map(r => (
                <button key={r.k} onClick={() => setLocal(p => ({ ...p, recurring: r.k as any }))}
                  className={cn("flex-1 py-2 rounded-xl text-xs font-semibold transition-colors", local.recurring === r.k ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}
                >{r.l}</button>
              ))}
            </div>
          </div>

          {/* Sort */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">Sıralama</label>
            <div className="flex flex-wrap gap-2">
              {[
                { k: 'newest', l: 'En yeni' }, { k: 'oldest', l: 'En eski' },
                { k: 'highest', l: 'En yüksek tutar' }, { k: 'lowest', l: 'En düşük tutar' },
              ].map(s => (
                <button key={s.k} onClick={() => setLocal(p => ({ ...p, sort: s.k as any }))}
                  className={cn("px-3 py-1.5 rounded-full text-xs font-medium transition-colors", local.sort === s.k ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}
                >{s.l}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 pt-3 pb-2 border-t border-border flex gap-3">
          <button onClick={() => { onApply(DEFAULT_FILTERS); onClose(); }}
            className="flex-1 py-3 rounded-xl border border-border text-muted-foreground font-semibold text-sm active:scale-[0.97] transition-transform">
            Filtreleri Temizle
          </button>
          <button onClick={() => { onApply(local); onClose(); }}
            className="flex-1 py-3 rounded-xl bg-accent text-accent-foreground font-semibold text-sm active:scale-[0.97] transition-transform">
            Uygula
          </button>
        </div>
      </div>
    </>
  );
}
