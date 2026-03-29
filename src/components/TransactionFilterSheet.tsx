import { useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCurrencyStore } from '@/store/useCurrencyStore';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { translateFinanceCategory } from '@/lib/categoryTranslations';

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

const INCOME_CATEGORIES = [
  'Maaş', 'Freelance', 'Yatırım', 'Kira Geliri',
  'Emeklilik', 'Burs', 'Yan Gelir', 'Diğer Gelir',
];

const EXPENSE_CATEGORIES = [
  'Yiyecek & İçecek', 'Ulaşım', 'Eğlence', 'Faturalar',
  'Sağlık', 'Giyim', 'Teknoloji', 'Kira & Ev',
  'Eğitim', 'Spor', 'Güzellik & Bakım', 'Seyahat',
  'Hediye', 'Sigorta', 'Alışveriş', 'Diğer Gider',
];

function getCategoriesForType(type: 'all' | 'income' | 'expense'): string[] {
  if (type === 'income')  return INCOME_CATEGORIES;
  if (type === 'expense') return EXPENSE_CATEGORIES;
  return [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES];
}

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
  const { t } = useTranslation();
  const [local, setLocal] = useState<TransactionFilters>({ ...filters });
  const currencySymbol = useCurrencyStore(s => s.symbol);

  const toggleCategory = (name: string) => {
    setLocal(prev => ({
      ...prev,
      categories: prev.categories.includes(name)
        ? prev.categories.filter(c => c !== name)
        : [...prev.categories, name],
    }));
  };

  const handleTypeChange = (next: 'all' | 'income' | 'expense') => {
    setLocal(prev => ({ ...prev, type: next, categories: [] }));
  };

  const visibleCategories = getCategoriesForType(local.type);

  const dateRangeOptions = [
    { k: 'all', labelKey: 'finance.filter.all_time' },
    { k: 'thisMonth', labelKey: 'finance.filter.this_month' },
    { k: 'lastMonth', labelKey: 'finance.filter.last_month' },
    { k: 'last3Months', labelKey: 'finance.filter.last_3_months' },
    { k: 'thisYear', labelKey: 'finance.filter.this_year' },
    { k: 'custom', labelKey: 'finance.filter.custom_range' },
  ] as const;

  return (
    <>
      <div className="fixed inset-0 z-[300] bg-black/60" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-[301] bg-card rounded-t-3xl shadow-2xl animate-slide-up max-h-[85vh] flex flex-col" style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}>
        <div className="flex justify-center py-3">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        <div className="flex items-center justify-between px-5 mb-4">
          <h3 className="font-semibold text-base">{t('finance.filter.title')}</h3>
          <button type="button" onClick={onClose} aria-label={t('common.close')}><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-5">
          {/* Type */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">{t('finance.filter.type')}</label>
            <div className="flex gap-2">
              {([
                { k: 'all' as const, labelKey: 'finance.filter.all' },
                { k: 'income' as const, labelKey: 'finance.filter.income' },
                { k: 'expense' as const, labelKey: 'finance.filter.expense' },
              ]).map(opt => (
                <button key={opt.k} type="button" onClick={() => handleTypeChange(opt.k)}
                  className={cn("flex-1 py-2 rounded-xl text-xs font-semibold transition-colors", local.type === opt.k ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}
                >{t(opt.labelKey)}</button>
              ))}
            </div>
          </div>

          {/* Categories */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">
              {t('finance.filter.category')}
              {local.type !== 'all' && (
                <span className="ml-1 text-[10px] text-muted-foreground/60">
                  ({local.type === 'income' ? t('finance.filter.income') : t('finance.filter.expense')})
                </span>
              )}
            </label>
            <div className="flex flex-wrap gap-2">
              {visibleCategories.map(name => (
                <button key={name} type="button" onClick={() => toggleCategory(name)}
                  className={cn("px-3 py-1.5 rounded-full text-xs font-medium transition-colors", local.categories.includes(name) ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground")}
                >{translateFinanceCategory(t, name)}</button>
              ))}
            </div>
          </div>

          {/* Date Range */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">{t('finance.filter.date_range')}</label>
            <div className="flex flex-wrap gap-2">
              {dateRangeOptions.map(d => (
                <button key={d.k} type="button" onClick={() => setLocal(p => ({ ...p, dateRange: d.k }))}
                  className={cn("px-3 py-1.5 rounded-full text-xs font-medium transition-colors", local.dateRange === d.k ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}
                >{t(d.labelKey)}</button>
              ))}
            </div>
            {local.dateRange === 'custom' && (
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">{t('finance.filter.start_date')}</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button type="button" className="w-full bg-muted rounded-xl px-3 py-2.5 text-sm text-left border border-border">
                        {local.customStart ? format(local.customStart, 'dd/MM/yyyy') : t('finance.filter.select_date')}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={local.customStart} onSelect={d => setLocal(p => ({ ...p, customStart: d }))} className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">{t('finance.filter.end_date')}</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button type="button" className="w-full bg-muted rounded-xl px-3 py-2.5 text-sm text-left border border-border">
                        {local.customEnd ? format(local.customEnd, 'dd/MM/yyyy') : t('finance.filter.select_date')}
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
            <label className="text-xs font-medium text-muted-foreground mb-2 block">{t('finance.filter.amount_range')}</label>
            <div className="grid grid-cols-2 gap-3">
              <input type="number" placeholder={t('finance.filter.min_placeholder', { symbol: currencySymbol })} value={local.minAmount} onChange={e => setLocal(p => ({ ...p, minAmount: e.target.value }))}
                className="w-full bg-muted rounded-xl px-3 py-2.5 text-sm outline-none border border-border focus:border-accent transition-colors" />
              <input type="number" placeholder={t('finance.filter.max_placeholder', { symbol: currencySymbol })} value={local.maxAmount} onChange={e => setLocal(p => ({ ...p, maxAmount: e.target.value }))}
                className="w-full bg-muted rounded-xl px-3 py-2.5 text-sm outline-none border border-border focus:border-accent transition-colors" />
            </div>
          </div>

          {/* Recurring */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">{t('finance.filter.recurring_section')}</label>
            <div className="flex gap-2">
              {[
                { k: 'all' as const, labelKey: 'finance.filter.all' },
                { k: 'recurring' as const, labelKey: 'finance.filter.recurring_only' },
                { k: 'oneTime' as const, labelKey: 'finance.filter.one_time' },
              ].map(r => (
                <button key={r.k} type="button" onClick={() => setLocal(p => ({ ...p, recurring: r.k }))}
                  className={cn("flex-1 py-2 rounded-xl text-xs font-semibold transition-colors", local.recurring === r.k ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}
                >{t(r.labelKey)}</button>
              ))}
            </div>
          </div>

          {/* Sort */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">{t('finance.filter.sort_section')}</label>
            <div className="flex flex-wrap gap-2">
              {[
                { k: 'newest' as const, labelKey: 'finance.filter.sort_newest' },
                { k: 'oldest' as const, labelKey: 'finance.filter.sort_oldest' },
                { k: 'highest' as const, labelKey: 'finance.filter.sort_highest' },
                { k: 'lowest' as const, labelKey: 'finance.filter.sort_lowest' },
              ].map(s => (
                <button key={s.k} type="button" onClick={() => setLocal(p => ({ ...p, sort: s.k }))}
                  className={cn("px-3 py-1.5 rounded-full text-xs font-medium transition-colors", local.sort === s.k ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}
                >{t(s.labelKey)}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 pt-3 pb-2 border-t border-border flex gap-3">
          <button type="button" onClick={() => { onApply(DEFAULT_FILTERS); onClose(); }}
            className="flex-1 py-3 rounded-xl border border-border text-muted-foreground font-semibold text-sm active:scale-[0.97] transition-transform">
            {t('finance.filter.clear')}
          </button>
          <button type="button" onClick={() => { onApply(local); onClose(); }}
            className="flex-1 py-3 rounded-xl bg-accent text-accent-foreground font-semibold text-sm active:scale-[0.97] transition-transform">
            {t('finance.filter.apply')}
          </button>
        </div>
      </div>
    </>
  );
}
