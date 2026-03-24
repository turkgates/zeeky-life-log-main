import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft, Search, Tag, MapPin, Users, FileEdit,
  Loader2, Plus, X as XIcon,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { TEST_USER_ID } from '@/lib/activitySupabase';
import { useCurrencyStore } from '@/store/useCurrencyStore';
import { useActivityRefresh } from '@/store/useActivityRefresh';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const ALL_CATEGORIES = [
  'spor', 'sosyal', 'harcama', 'sağlık', 'iş', 'eğlence', 'diğer',
  'gittim', 'yaptim', 'uyudum', 'izledim',
];
const VALID_CATEGORIES = ALL_CATEGORIES;

const TABS = [
  { icon: Tag,      label: 'Detaylar' },
  { icon: MapPin,   label: 'Konum'    },
  { icon: Users,    label: 'Kişiler'  },
  { icon: FileEdit, label: 'Notlar'   },
];

const fieldCls = "w-full bg-muted rounded-md px-3 py-2.5 text-sm outline-none border border-border focus:border-accent transition-colors";
const labelCls = "text-xs font-medium text-muted-foreground mb-1 block";

export default function AddActionPage() {
  const navigate         = useNavigate();
  const location         = useLocation();
  const state            = location.state as { editId?: string; category?: string } | null;
  const editId           = state?.editId;
  const isEditing        = !!editId;
  const currencySymbol   = useCurrencyStore(s => s.symbol);
  const { refresh }      = useActivityRefresh();

  const [pageLoading,       setPageLoading]       = useState(isEditing);
  const [isSaving,          setIsSaving]          = useState(false);
  const [activeTab,         setActiveTab]         = useState(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // ── form fields ──────────────────────────────────────────────────────────
  const [title,        setTitle]        = useState('');
  const [category,     setCategory]     = useState(state?.category ?? 'diğer');
  const [amount,       setAmount]       = useState('');
  const [activityDate, setActivityDate] = useState(new Date().toISOString().slice(0, 10));
  const [durationH,    setDurationH]    = useState(0);
  const [durationM,    setDurationM]    = useState(0);
  const [isFavorite,   setIsFavorite]   = useState(false);
  const [locationStr,  setLocationStr]  = useState('');
  const [people,       setPeople]       = useState<string[]>([]);
  const [note,         setNote]         = useState('');
  const [personInput,  setPersonInput]  = useState('');

  // ── load existing activity ───────────────────────────────────────────────
  useEffect(() => {
    if (!editId) return;
    supabase
      .from('activities')
      .select('*')
      .eq('id', editId)
      .eq('user_id', TEST_USER_ID)
      .single()
      .then(({ data, error }) => {
        if (error || !data) return;
        setTitle(data.title ?? '');
        setCategory(data.category ?? 'diğer');
        setAmount(data.amount != null ? String(data.amount) : '');
        if (data.activity_date) {
          const d = new Date(data.activity_date as string);
          setActivityDate(
            `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
          );
        }
        if (data.duration_mins) {
          setDurationH(Math.floor((data.duration_mins as number) / 60));
          setDurationM((data.duration_mins as number) % 60);
        }
        setIsFavorite(data.is_favorite ?? false);
        setLocationStr(typeof data.location === 'string' ? data.location : '');
        setPeople(Array.isArray(data.people) ? (data.people as string[]) : []);
        setNote(data.raw_message ?? '');
      })
      .finally(() => setPageLoading(false));
  }, [editId]);

  // ── save ─────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!title.trim()) { toast.error('Başlık boş olamaz'); return; }
    setIsSaving(true);
    try {
      const safeCategory  = VALID_CATEGORIES.includes(category) ? category : 'diğer';
      const durationMins  = durationH * 60 + durationM;
      const payload = {
        title:         title.trim(),
        category:      safeCategory,
        activity_date: activityDate
          ? new Date(`${activityDate}T12:00:00`).toISOString()
          : undefined,
        duration_mins: durationMins > 0 ? durationMins : null,
        amount:        amount ? parseFloat(amount) : null,
        location:      locationStr.trim() || null,
        people,
        is_favorite:   isFavorite,
        raw_message:   note.trim() || null,
      };

      if (isEditing && editId) {
        const { error } = await supabase
          .from('activities')
          .update(payload)
          .eq('id', editId)
          .eq('user_id', TEST_USER_ID);
        if (error) { console.error('update error:', error); toast.error('Kaydedilemedi'); return; }
        toast.success('Aktivite güncellendi ✅');
      } else {
        const { error } = await supabase
          .from('activities')
          .insert({ ...payload, user_id: TEST_USER_ID });
        if (error) { console.error('insert error:', error); toast.error('Kaydedilemedi'); return; }
        toast.success('Aktivite eklendi ✅');
      }
      refresh();
      navigate(-1);
    } finally {
      setIsSaving(false);
    }
  };

  // ── delete ───────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!editId) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('activities')
        .delete()
        .eq('id', editId)
        .eq('user_id', TEST_USER_ID);
      if (error) { toast.error('Silinemedi'); return; }
      toast.success('Aktivite silindi 🗑️');
      refresh();
      navigate(-1);
    } finally {
      setIsSaving(false);
      setShowDeleteConfirm(false);
    }
  };

  const addPerson = () => {
    const p = personInput.trim();
    if (p && !people.includes(p)) setPeople(prev => [...prev, p]);
    setPersonInput('');
  };

  // ── loading screen ───────────────────────────────────────────────────────
  if (pageLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background max-w-[430px] mx-auto flex flex-col">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="bg-primary text-primary-foreground px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 flex items-center justify-center rounded-full active:bg-white/10"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="flex-1 text-center text-base font-semibold">
          {isEditing ? 'Düzenle' : 'Aktivite Ekle'}
        </h1>
        <div className="w-10 h-10" /> {/* spacer */}
      </div>

      {/* ── Tab Bar ────────────────────────────────────────────────────── */}
      <div className="bg-card mx-4 mt-4 rounded-lg shadow-sm border border-border">
        <div className="flex">
          {TABS.map((tab, i) => (
            <button
              key={i}
              onClick={() => setActiveTab(i)}
              className={cn(
                "flex-1 flex items-center justify-center py-3 transition-colors relative",
                activeTab === i ? "text-accent" : "text-muted-foreground"
              )}
            >
              <tab.icon className="w-5 h-5" />
              {activeTab === i && (
                <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-accent rounded-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab Content ────────────────────────────────────────────────── */}
      <div className="flex-1 px-4 py-4">

        {/* TAB 1 — Details */}
        {activeTab === 0 && (
          <div className="bg-card rounded-lg shadow-sm border border-border p-4 space-y-4">

            {/* Title + Amount */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Aktivite / Başlık</label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Aktivite adı"
                  className={fieldCls}
                />
              </div>
              <div>
                <label className={labelCls}>Tutar ({currencySymbol})</label>
                <input
                  type="number"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0"
                  min="0"
                  step="0.01"
                  className={fieldCls}
                />
              </div>
            </div>

            {/* Category */}
            <div>
              <label className={labelCls}>Kategori</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className={cn(fieldCls, "appearance-none")}
              >
                <optgroup label="Kategoriler">
                  {['spor', 'sosyal', 'harcama', 'sağlık', 'iş', 'eğlence', 'diğer'].map(c => (
                    <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                  ))}
                </optgroup>
                <optgroup label="Diğer">
                  {['gittim', 'yaptim', 'uyudum', 'izledim'].map(c => (
                    <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                  ))}
                </optgroup>
              </select>
            </div>

            {/* Date + Duration */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Tarih</label>
                <input
                  type="date"
                  value={activityDate}
                  onChange={e => setActivityDate(e.target.value)}
                  className={fieldCls}
                />
              </div>
              <div>
                <label className={labelCls}>Süre (sa : dk)</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={durationH}
                    onChange={e => setDurationH(Math.max(0, Number(e.target.value)))}
                    min="0"
                    max="23"
                    className={cn(fieldCls, "text-center px-1")}
                  />
                  <span className="text-muted-foreground font-semibold">:</span>
                  <input
                    type="number"
                    value={durationM}
                    onChange={e => setDurationM(Math.max(0, Math.min(59, Number(e.target.value))))}
                    min="0"
                    max="59"
                    className={cn(fieldCls, "text-center px-1")}
                  />
                </div>
              </div>
            </div>

            {/* Favorite toggle + Save */}
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsFavorite(v => !v)}
                  className={cn(
                    "w-11 h-6 rounded-full transition-colors relative",
                    isFavorite ? "bg-success" : "bg-muted"
                  )}
                >
                  <div className={cn(
                    "w-4 h-4 rounded-full bg-card absolute top-1 transition-transform shadow-sm",
                    isFavorite ? "translate-x-6" : "translate-x-1"
                  )} />
                </button>
                <span className="text-xs font-medium text-muted-foreground">Favorilere ekle</span>
              </div>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-6 py-2 bg-accent text-accent-foreground rounded-md font-semibold text-sm active:scale-[0.97] transition-transform disabled:opacity-60 flex items-center gap-1.5"
              >
                {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Kaydet
              </button>
            </div>

            {/* Delete button (edit only) */}
            {isEditing && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isSaving}
                className="w-full py-2.5 rounded-md bg-destructive/10 text-destructive font-semibold text-sm active:scale-[0.98] transition-transform disabled:opacity-60"
              >
                Aktiviteyi Sil
              </button>
            )}
          </div>
        )}

        {/* TAB 2 — Location */}
        {activeTab === 1 && (
          <div className="bg-card rounded-lg shadow-sm border border-border p-4">
            <label className={labelCls}>Konum</label>
            <input
              type="text"
              value={locationStr}
              onChange={e => setLocationStr(e.target.value)}
              placeholder="Konum adı veya adresi"
              className={fieldCls}
            />
          </div>
        )}

        {/* TAB 3 — People */}
        {activeTab === 2 && (
          <div className="bg-card rounded-lg shadow-sm border border-border p-4 space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={personInput}
                onChange={e => setPersonInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addPerson(); } }}
                placeholder="Kişi adı ekle"
                className={cn(fieldCls, "flex-1")}
              />
              <button
                type="button"
                onClick={addPerson}
                className="px-3 py-2.5 bg-accent/10 text-accent rounded-md text-sm font-medium flex items-center gap-1 active:scale-95"
              >
                <Plus className="w-4 h-4" /> Ekle
              </button>
            </div>
            {people.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {people.map((p, i) => (
                  <span key={i} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-primary/10 text-primary font-medium">
                    {p}
                    <button
                      type="button"
                      onClick={() => setPeople(prev => prev.filter((_, j) => j !== i))}
                    >
                      <XIcon className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-4">Henüz kişi eklenmedi</p>
            )}
          </div>
        )}

        {/* TAB 4 — Notes */}
        {activeTab === 3 && (
          <div className="bg-card rounded-lg shadow-sm border border-border p-4">
            <label className={labelCls}>Notlar / Açıklama</label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Notunuzu buraya yazın..."
              rows={10}
              className={cn(fieldCls, "resize-none")}
            />
          </div>
        )}
      </div>

      {/* ── Delete Confirm ─────────────────────────────────────────────── */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-[400] flex items-center justify-center bg-black/40"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div className="bg-card rounded-2xl p-6 mx-8 shadow-xl" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-medium text-center mb-4">Bu aktiviteyi silmek istediğine emin misin?</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-muted text-muted-foreground font-semibold text-sm"
              >
                İptal
              </button>
              <button
                onClick={handleDelete}
                disabled={isSaving}
                className="flex-1 py-2.5 rounded-xl bg-destructive text-destructive-foreground font-semibold text-sm disabled:opacity-60 flex items-center justify-center gap-1.5"
              >
                {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Sil
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
