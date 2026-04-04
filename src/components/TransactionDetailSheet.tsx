import { useState, useRef } from 'react';
import { Pencil, Trash2, Calendar, RefreshCw, FileText, ChevronLeft, Loader2, X as XIcon, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Transaction,
  TransactionCategory,
  updateTransaction,
} from '@/lib/transactionSupabase';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { translateFinanceCategory, getSubcategory } from '@/lib/categoryTranslations';
import { getLocalNoonISOStringFromYMD } from '@/lib/dateUtils';

interface Props {
  userId: string;
  transaction: Transaction | null;
  categories:  TransactionCategory[];
  currencySymbol: string;
  onClose:  () => void;
  onSaved:  () => void;
  onDelete: (id: string, opts: { deleteAll?: boolean; parentId?: string | null }) => Promise<void>;
}

export default function TransactionDetailSheet({
  userId,
  transaction, categories, currencySymbol, onClose, onSaved, onDelete,
}: Props) {
  const { t, i18n } = useTranslation();

  const [editMode,          setEditMode]          = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRecurringAsk,  setShowRecurringAsk]  = useState(false);
  const [saving,            setSaving]            = useState(false);

  // edit fields
  const [editTitle,    setEditTitle]    = useState('');
  const [editType,     setEditType]     = useState<'income' | 'expense'>('expense');
  const [editAmount,   setEditAmount]   = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editDate,     setEditDate]     = useState('');
  const [editNote,     setEditNote]     = useState('');
  const [editFreq,     setEditFreq]     = useState<Transaction['frequency']>('none');

  // drag to dismiss
  const dragStartY = useRef(0);
  const dragging   = useRef(false);
  const [dragOffset, setDragOffset] = useState(0);

  if (!transaction) return null;

  const locale =
    i18n.language === 'en' ? 'en-US' :
    i18n.language === 'fr' ? 'fr-FR' : 'tr-TR';

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' });
  };

  const getFrequencyLabel = (f: string) => {
    if (f === 'daily')   return t('finance.freq_daily');
    if (f === 'weekly')  return t('finance.weekly');
    if (f === 'monthly') return t('finance.monthly');
    return t('finance.freq_none');
  };

  const catInfo = categories.find(c => c.name === transaction.category);

  // ── Enter edit ───────────────────────────────────────────────────────────
  const enterEdit = () => {
    setEditTitle(transaction.title);
    setEditType(transaction.type);
    setEditAmount(String(transaction.amount));
    setEditCategory(transaction.category);
    setEditDate(transaction.date);
    setEditNote(transaction.description ?? '');
    setEditFreq(transaction.frequency);
    setEditMode(true);
  };

  // ── Save ─────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!editTitle.trim() || !editAmount) { toast.error(t('finance.error_title_amount')); return; }
    setSaving(true);
    const ok = await updateTransaction(userId, transaction.id, {
      title:            editTitle.trim(),
      type:             editType,
      amount:           parseFloat(editAmount),
      category:         editCategory,
      transaction_date: getLocalNoonISOStringFromYMD(editDate),
      description:      editNote.trim() || null,
      frequency:        editFreq,
    });
    setSaving(false);
    if (ok) { toast.success(t('finance.update_success')); onSaved(); onClose(); }
    else toast.error(t('finance.error_save_failed'));
  };

  // ── Delete ───────────────────────────────────────────────────────────────
  const triggerDelete = () => {
    if (transaction.frequency !== 'none') setShowRecurringAsk(true);
    else setShowDeleteConfirm(true);
  };

  // ── Drag ─────────────────────────────────────────────────────────────────
  const onDragStart = (e: React.TouchEvent) => { dragStartY.current = e.touches[0].clientY; dragging.current = true; };
  const onDragMove  = (e: React.TouchEvent) => { if (!dragging.current) return; setDragOffset(Math.max(0, e.touches[0].clientY - dragStartY.current)); };
  const onDragEnd   = () => { dragging.current = false; if (dragOffset > 100) onClose(); setDragOffset(0); };

  const fieldCls = "w-full bg-muted rounded-xl px-3 py-2.5 text-sm outline-none border border-border focus:border-accent transition-colors";
  const labelCls = "text-xs font-medium text-muted-foreground mb-1 block";

  return (
    <>
      <div className="fixed inset-0 z-[300] bg-black/60" onClick={onClose} />
      <div
        className="fixed inset-x-0 bottom-0 z-[301] bg-card rounded-t-3xl shadow-2xl animate-slide-up max-h-[85vh] flex flex-col"
        style={{
          transform:  `translateY(${dragOffset}px)`,
          transition: dragging.current ? 'none' : 'transform 200ms ease',
          paddingBottom: 'env(safe-area-inset-bottom, 16px)',
        }}
      >
        {/* Drag handle */}
        <div className="flex justify-center py-3 cursor-grab flex-shrink-0"
          onTouchStart={onDragStart} onTouchMove={onDragMove} onTouchEnd={onDragEnd}>
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        {/* ── EDIT MODE ─────────────────────────────────────────────────── */}
        {editMode ? (
          <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <button onClick={() => setEditMode(false)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <h2 className="text-base font-semibold flex-1">{t('finance.edit_transaction')}</h2>
            </div>

            {/* Type */}
            <div className="flex bg-muted rounded-xl p-1">
              <button onClick={() => setEditType('income')}
                className={cn("flex-1 py-2 rounded-lg text-sm font-semibold transition-colors", editType === 'income' ? "bg-success text-white" : "text-muted-foreground")}>
                {t('finance.income')}
              </button>
              <button onClick={() => setEditType('expense')}
                className={cn("flex-1 py-2 rounded-lg text-sm font-semibold transition-colors", editType === 'expense' ? "bg-destructive text-white" : "text-muted-foreground")}>
                {t('finance.expense')}
              </button>
            </div>

            {/* Title */}
            <div>
              <label className={labelCls}>{t('finance.form.title')}</label>
              <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)} className={fieldCls} />
            </div>

            {/* Amount + Date */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>{t('finance.form.amount')} ({currencySymbol})</label>
                <input type="number" value={editAmount} onChange={e => setEditAmount(e.target.value)} min="0" step="0.01" className={fieldCls} />
              </div>
              <div>
                <label className={labelCls}>{t('finance.form.date')}</label>
                <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} className={fieldCls} />
              </div>
            </div>

            {/* Category */}
            <div>
              <label className={labelCls}>{t('finance.form.category')}</label>
              <div className="grid grid-cols-4 gap-2">
                {categories.filter(c => c.type === editType || c.type === 'both').map(c => (
                  <button
                    key={c.id}
                    onClick={() => setEditCategory(c.name)}
                    className={cn(
                      "flex flex-col items-center gap-1 p-2 rounded-xl border transition-colors",
                      editCategory === c.name ? "border-accent bg-accent/5" : "border-border"
                    )}
                  >
                    <span className="text-lg">{c.icon}</span>
                    <span className="text-[9px] font-medium text-center leading-tight">{translateFinanceCategory(t, c.name)}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Frequency */}
            <div>
              <label className={labelCls}>{t('finance.frequency')}</label>
              <div className="flex gap-2 flex-wrap">
                {(['none', 'daily', 'weekly', 'monthly'] as Transaction['frequency'][]).map(f => (
                  <button
                    key={f}
                    onClick={() => setEditFreq(f)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                      editFreq === f ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"
                    )}
                  >
                    {getFrequencyLabel(f)}
                  </button>
                ))}
              </div>
            </div>

            {/* Note */}
            <div>
              <label className={labelCls}>{t('finance.form.description')}</label>
              <textarea value={editNote} onChange={e => setEditNote(e.target.value)} className={cn(fieldCls, "resize-none")} rows={3} />
            </div>

            <button
              onClick={handleSave} disabled={saving}
              className="w-full py-3 rounded-xl bg-accent text-accent-foreground font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-60"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {t('finance.save')}
            </button>
            <button
              onClick={() => setEditMode(false)}
              className="w-full py-3 rounded-xl bg-muted text-muted-foreground font-semibold text-sm"
            >
              {t('finance.cancel')}
            </button>
          </div>

        ) : (
          // ── VIEW MODE ──────────────────────────────────────────────────
          <div className="flex-1 overflow-y-auto px-5 pb-4">
            {/* Header */}
            <div className="flex items-start justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
                  style={{ backgroundColor: (catInfo?.color || '#78909C') + '20' }}>
                  {catInfo?.icon || '📦'}
                </div>
                <div>
                  <h2 className="text-lg font-bold">{transaction.title}</h2>
                  <span className={cn(
                    "inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full mt-0.5",
                    transaction.type === 'income' ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                  )}>
                    {transaction.type === 'income' ? t('finance.income') : t('finance.expense')}
                  </span>
                </div>
              </div>
              <div className="flex gap-1.5">
                <button onClick={enterEdit}
                  className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center active:scale-90 transition-transform"
                  aria-label={t('finance.edit_transaction')}>
                  <Pencil className="w-4 h-4 text-accent" />
                </button>
                <button onClick={triggerDelete}
                  className="w-9 h-9 rounded-full bg-destructive/10 flex items-center justify-center active:scale-90 transition-transform"
                  aria-label={t('finance.delete')}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </button>
              </div>
            </div>

            {/* Amount */}
            <div className="text-center mb-6">
              <p className={cn("text-3xl font-bold", transaction.type === 'income' ? "text-success" : "text-destructive")}>
                {transaction.type === 'income' ? '+' : '-'}{transaction.amount.toLocaleString(locale)} {currencySymbol}
              </p>
            </div>

            {/* Details */}
            {[
              { icon: <Calendar className="w-4 h-4" />,  label: t('finance.form.date'),  value: formatDate(transaction.date) },
              { icon: <RefreshCw className="w-4 h-4" />,  label: t('finance.recurrence'),  value: getFrequencyLabel(transaction.frequency) },
              ...(transaction.subcategory ? [{ icon: <FolderOpen className="w-4 h-4" />, label: t('finance.subcategory'), value: getSubcategory(transaction.category, transaction.subcategory) }] : []),
              ...(transaction.description ? [{ icon: <FileText className="w-4 h-4" />, label: t('finance.form.description'), value: transaction.description }] : []),
            ].map((row, i, arr) => (
              <div key={i} className={cn("flex items-center gap-3 py-3", i < arr.length - 1 && "border-b border-border")}>
                <span className="text-muted-foreground">{row.icon}</span>
                <span className="text-xs text-muted-foreground font-medium w-24 flex-shrink-0">{row.label}</span>
                <span className="text-sm flex-1">{row.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete confirmation (single) */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/40" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-card rounded-2xl p-6 mx-8 shadow-xl" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-medium text-center mb-4">{t('finance.delete_confirm')}</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-2.5 rounded-xl bg-muted text-muted-foreground font-semibold text-sm">{t('finance.cancel')}</button>
              <button
                onClick={async () => { setShowDeleteConfirm(false); await onDelete(transaction.id, {}); }}
                className="flex-1 py-2.5 rounded-xl bg-destructive text-destructive-foreground font-semibold text-sm"
              >{t('finance.delete')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Recurring delete options */}
      {showRecurringAsk && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/40" onClick={() => setShowRecurringAsk(false)}>
          <div className="bg-card rounded-2xl p-6 mx-8 shadow-xl relative" onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowRecurringAsk(false)} className="absolute top-3 right-3 p-1">
              <XIcon className="w-4 h-4 text-muted-foreground" />
            </button>
            <p className="text-sm font-medium text-center mb-5">{t('finance.recurring_delete_ask')}</p>
            <div className="space-y-2">
              <button
                onClick={async () => { setShowRecurringAsk(false); await onDelete(transaction.id, {}); }}
                className="w-full py-3 rounded-xl bg-muted text-foreground font-semibold text-sm"
              >{t('finance.delete_single')}</button>
              <button
                onClick={async () => {
                  setShowRecurringAsk(false);
                  const parentId = transaction.parent_transaction_id ?? transaction.id;
                  await onDelete(transaction.id, { deleteAll: true, parentId });
                }}
                className="w-full py-3 rounded-xl bg-destructive text-destructive-foreground font-semibold text-sm"
              >{t('finance.delete_all_recurring')}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
