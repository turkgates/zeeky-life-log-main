import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Loader2, Plus, X as XIcon, Star } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { TEST_USER_ID } from '@/lib/activitySupabase';
import { useCurrencyStore } from '@/store/useCurrencyStore';
import { useActivityRefresh } from '@/store/useActivityRefresh';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ── Category definitions ─────────────────────────────────────────────────────
const CATEGORIES = [
  { id: 'sağlık-spor', emoji: '🏃', label: 'Sağlık & Spor', desc: 'Koşu, yüzme, doktor...',     color: '#22c55e' },
  { id: 'sosyal',      emoji: '👥', label: 'Sosyal',         desc: 'Arkadaş, aile, buluşma...', color: '#3b82f6' },
  { id: 'iş-eğitim',  emoji: '💼', label: 'İş & Eğitim',   desc: 'Çalışma, toplantı, kurs...',  color: '#6366f1' },
  { id: 'eğlence',    emoji: '🎬', label: 'Eğlence',        desc: 'Sinema, dizi, konser...',      color: '#ec4899' },
  { id: 'alışveriş',  emoji: '🛒', label: 'Alışveriş',      desc: 'Market, giyim, teknoloji...', color: '#f97316' },
  { id: 'yeme-içme',  emoji: '🍽️', label: 'Yeme & İçme',   desc: 'Restoran, kafe, ev yemeği...', color: '#ef4444' },
  { id: 'seyahat',    emoji: '✈️', label: 'Seyahat',        desc: 'Gezi, tatil, şehir dışı...',  color: '#0ea5e9' },
  { id: 'ev-yaşam',   emoji: '🏠', label: 'Ev & Yaşam',    desc: 'Tadilat, temizlik, bakım...', color: '#84cc16' },
  { id: 'harcama',    emoji: '💰', label: 'Harcama',        desc: 'Para harcanan her şey...',    color: '#f59e0b' },
  { id: 'diğer',      emoji: '📦', label: 'Diğer',          desc: 'Kategoriye uymayan...',       color: '#94a3b8' },
] as const;

type CategoryId = typeof CATEGORIES[number]['id'];

const EXPENSE_SUBCATS = ['Yiyecek', 'Ulaşım', 'Eğlence', 'Faturalar', 'Sağlık', 'Giyim', 'Teknoloji', 'Diğer'];

const TITLE_PLACEHOLDERS: Record<CategoryId, string> = {
  'sağlık-spor': 'Ör: 45 dk koşu yaptım',
  'sosyal':      'Ör: Ali ile buluştum',
  'iş-eğitim':  'Ör: Proje toplantısı',
  'eğlence':    'Ör: Sinemaya gittim',
  'alışveriş':  'Ör: Market alışverişi',
  'yeme-içme':  'Ör: Öğle yemeği',
  'seyahat':    'Ör: İstanbul\'a gittim',
  'ev-yaşam':   'Ör: Ev temizliği',
  'harcama':    'Ör: Fatura ödedim',
  'diğer':      'Ne yaptın?',
};

function getCat(id: string) {
  return CATEGORIES.find(c => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];
}

const ALL_CATEGORY_IDS = CATEGORIES.map(c => c.id) as string[];
const LEGACY_IDS = ['gittim', 'yaptim', 'uyudum', 'izledim', 'spor', 'sağlık', 'iş'];
const VALID_IDS = [...ALL_CATEGORY_IDS, ...LEGACY_IDS];

// ── Styles ───────────────────────────────────────────────────────────────────
const inputCls = "w-full bg-muted rounded-xl px-4 py-3 text-sm outline-none border border-border focus:border-foreground/30 transition-colors";
const labelCls = "text-[11px] font-semibold text-foreground/50 mb-1.5 block uppercase tracking-wider";

// ── PeopleInput sub-component ─────────────────────────────────────────────────
function PeopleInput({ people, onChange }: { people: string[]; onChange: (v: string[]) => void }) {
  const [input, setInput] = useState('');
  const add = () => {
    const p = input.trim();
    if (p && !people.includes(p)) onChange([...people, p]);
    setInput('');
  };
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder="Kişi adı ekle..."
          className={cn(inputCls, 'flex-1')}
        />
        <button
          type="button"
          onClick={add}
          className="px-4 py-3 bg-foreground/10 rounded-xl text-sm font-medium flex items-center gap-1.5 active:scale-95 transition-transform"
        >
          <Plus className="w-4 h-4" />
          Ekle
        </button>
      </div>
      {people.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {people.map((p, i) => (
            <span key={i} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-primary/10 text-primary font-medium">
              {p}
              <button type="button" onClick={() => onChange(people.filter((_, j) => j !== i))}>
                <XIcon className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AddActionPage() {
  const navigate       = useNavigate();
  const location       = useLocation();
  const state          = location.state as { editId?: string; category?: string } | null;
  const editId         = state?.editId;
  const isEditing      = !!editId;
  const currencySymbol = useCurrencyStore(s => s.symbol);
  const currencyCode   = useCurrencyStore(s => s.code);
  const { refresh }    = useActivityRefresh();

  // ── Step management ────────────────────────────────────────────────────────
  const initialCat = (): CategoryId => {
    const c = state?.category ?? '';
    return VALID_IDS.includes(c) ? (c as CategoryId) : 'diğer';
  };

  const [step,     setStep]     = useState<'category' | 'form'>(isEditing ? 'form' : 'category');
  const [selCat,   setSelCat]   = useState<CategoryId>(initialCat);
  const [loading,  setLoading]  = useState(isEditing);
  const [saving,   setSaving]   = useState(false);
  const [delConfirm, setDelConfirm] = useState(false);

  // ── Form state ─────────────────────────────────────────────────────────────
  const [title,           setTitle]           = useState('');
  const [date,            setDate]            = useState(new Date().toISOString().slice(0, 10));
  const [isFavorite,      setIsFavorite]      = useState(false);
  const [duration,        setDuration]        = useState('');   // minutes
  const [calories,        setCalories]        = useState('');
  const [people,          setPeople]          = useState<string[]>([]);
  const [location_,       setLocation_]       = useState('');
  const [amount,          setAmount]          = useState('');
  const [project,         setProject]         = useState('');
  const [notes,           setNotes]           = useState('');
  const [expenseSubcat,   setExpenseSubcat]   = useState('');
  const [travelDays,      setTravelDays]      = useState('');

  // ── Load existing activity (edit mode) ────────────────────────────────────
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
        const cat = data.category as string;
        setSelCat(VALID_IDS.includes(cat) ? (cat as CategoryId) : 'diğer');
        setAmount(data.amount != null ? String(data.amount) : '');
        if (data.activity_date) {
          const d = new Date(data.activity_date as string);
          setDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
        }
        if (data.duration_mins) setDuration(String(data.duration_mins as number));
        setIsFavorite(data.is_favorite ?? false);
        setLocation_(typeof data.location === 'string' ? data.location : '');
        setPeople(Array.isArray(data.people) ? (data.people as string[]) : []);
        setNotes(data.raw_message ?? '');
      })
      .finally(() => setLoading(false));
  }, [editId]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const cat = getCat(selCat);

  const handleSelectCategory = (id: CategoryId) => {
    setSelCat(id);
    setStep('form');
  };

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!title.trim()) { toast.error('Başlık boş olamaz'); return; }
    if ((selCat === 'harcama' || selCat === 'alışveriş') && !amount) {
      toast.error('Tutar zorunludur'); return;
    }
    setSaving(true);
    try {
      let durationMins: number | null = null;
      if (selCat === 'seyahat' && travelDays) {
        durationMins = parseInt(travelDays) * 1440;
      } else if (duration) {
        durationMins = parseInt(duration);
      }

      const activityPayload = {
        user_id:      TEST_USER_ID,
        title:        title.trim(),
        category:     selCat,
        amount:       amount ? parseFloat(amount) : null,
        duration_mins: durationMins,
        location:     location_.trim() || null,
        people,
        activity_date: new Date(`${date}T12:00:00`).toISOString(),
        created_via:  'manual' as const,
        raw_message:  notes.trim() || title.trim(),
        is_favorite:  isFavorite,
      };

      if (isEditing && editId) {
        const { error } = await supabase
          .from('activities')
          .update(activityPayload)
          .eq('id', editId)
          .eq('user_id', TEST_USER_ID);
        if (error) { console.error(error); toast.error('Kaydedilemedi'); return; }
      } else {
        const { error } = await supabase.from('activities').insert(activityPayload);
        if (error) { console.error(error); toast.error('Kaydedilemedi'); return; }
      }

      // Also save to transactions for spending categories
      if (!isEditing && (selCat === 'harcama' || selCat === 'alışveriş') && amount) {
        await supabase.from('transactions').insert({
          user_id:          TEST_USER_ID,
          type:             'expense',
          title:            title.trim(),
          amount:           parseFloat(amount),
          currency:         currencyCode ?? 'TRY',
          category:         expenseSubcat || selCat,
          transaction_date: new Date(`${date}T12:00:00`).toISOString(),
          created_via:      'manual',
        });
      }

      toast.success(isEditing ? 'Eylem güncellendi!' : 'Eylem eklendi!');
      refresh();
      navigate(-1);
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!editId) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('activities')
        .delete()
        .eq('id', editId)
        .eq('user_id', TEST_USER_ID);
      if (error) { toast.error('Silinemedi'); return; }
      toast.success('Eylem silindi');
      refresh();
      navigate(-1);
    } finally {
      setSaving(false);
      setDelConfirm(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 1 — Category selection
  // ═══════════════════════════════════════════════════════════════════════════
  if (step === 'category') {
    return (
      <div className="min-h-screen bg-background max-w-[430px] mx-auto flex flex-col">
        {/* Header */}
        <div className="px-4 pt-12 pb-6">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-muted mb-6"
          >
            <ArrowLeft className="w-4 h-4 text-foreground/60" />
          </button>
          <h1 className="text-2xl font-bold text-foreground">Ne yaptın?</h1>
          <p className="text-sm text-muted-foreground mt-1">Bir kategori seç</p>
        </div>

        {/* Grid */}
        <div className="flex-1 px-4 pb-8 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleSelectCategory(cat.id)}
                className="flex items-center gap-3 p-4 rounded-2xl border border-border bg-card active:scale-[0.97] transition-transform text-left"
                style={{ '--cat-color': cat.color } as React.CSSProperties}
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                  style={{ backgroundColor: cat.color + '18' }}
                >
                  {cat.emoji}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground leading-tight">{cat.label}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{cat.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 2 — Form
  // ═══════════════════════════════════════════════════════════════════════════
  const catColor = cat.color;

  return (
    <div className="min-h-screen bg-background max-w-[430px] mx-auto flex flex-col">

      {/* ── Colored Header ─────────────────────────────────────────────────── */}
      <div className="px-4 pt-10 pb-5" style={{ backgroundColor: catColor }}>
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => isEditing ? navigate(-1) : setStep('category')}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white/20"
          >
            <ArrowLeft className="w-4 h-4 text-white" />
          </button>
          <div className="flex-1" />
          {/* Favorite star in header */}
          <button
            type="button"
            onClick={() => setIsFavorite(v => !v)}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white/20 active:scale-95 transition-transform"
          >
            <Star
              className="w-4 h-4"
              fill={isFavorite ? 'white' : 'transparent'}
              stroke="white"
            />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-3xl">{cat.emoji}</span>
          <div>
            <p className="text-white/70 text-xs font-medium">{isEditing ? 'Düzenleniyor' : 'Yeni eylem'}</p>
            <p className="text-white font-bold text-lg leading-tight">{cat.label}</p>
          </div>
        </div>
      </div>

      {/* ── Scrollable Form ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 pt-5 pb-28 space-y-4">

        {/* ── COMMON: Title ── */}
        <div>
          <label className={labelCls}>Başlık *</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder={TITLE_PLACEHOLDERS[selCat] ?? 'Ne yaptın?'}
            className={inputCls}
            autoFocus
          />
        </div>

        {/* ── COMMON: Date ── */}
        <div>
          <label className={labelCls}>Tarih</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className={inputCls}
          />
        </div>

        {/* ── sağlık-spor ── */}
        {selCat === 'sağlık-spor' && (
          <>
            <div>
              <label className={labelCls}>Süre (dakika)</label>
              <input type="number" value={duration} onChange={e => setDuration(e.target.value)}
                placeholder="Ör: 45" min="0" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Kalori (opsiyonel)</label>
              <input type="number" value={calories} onChange={e => setCalories(e.target.value)}
                placeholder="Ör: 320 kcal" min="0" className={inputCls} />
            </div>
          </>
        )}

        {/* ── sosyal ── */}
        {selCat === 'sosyal' && (
          <>
            <div>
              <label className={labelCls}>Kişiler</label>
              <PeopleInput people={people} onChange={setPeople} />
            </div>
            <div>
              <label className={labelCls}>Konum</label>
              <input type="text" value={location_} onChange={e => setLocation_(e.target.value)}
                placeholder="Ör: Taksim Meydanı" className={inputCls} />
            </div>
          </>
        )}

        {/* ── iş-eğitim ── */}
        {selCat === 'iş-eğitim' && (
          <>
            <div>
              <label className={labelCls}>Süre (dakika)</label>
              <input type="number" value={duration} onChange={e => setDuration(e.target.value)}
                placeholder="Ör: 90" min="0" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Proje / Konu</label>
              <input type="text" value={project} onChange={e => setProject(e.target.value)}
                placeholder="Ör: Mobil uygulama projesi" className={inputCls} />
            </div>
          </>
        )}

        {/* ── eğlence ── */}
        {selCat === 'eğlence' && (
          <>
            <div>
              <label className={labelCls}>Ne izledin / Ne yaptın</label>
              <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Ör: Interstellar" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Kişiler</label>
              <PeopleInput people={people} onChange={setPeople} />
            </div>
            <div>
              <label className={labelCls}>Tutar (opsiyonel)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{currencySymbol}</span>
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                  placeholder="0" min="0" step="0.01" className={cn(inputCls, 'pl-8')} />
              </div>
            </div>
          </>
        )}

        {/* ── alışveriş ── */}
        {selCat === 'alışveriş' && (
          <>
            <div>
              <label className={labelCls}>Tutar *</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{currencySymbol}</span>
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                  placeholder="0" min="0" step="0.01" className={cn(inputCls, 'pl-8')} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Mağaza / Konum</label>
              <input type="text" value={location_} onChange={e => setLocation_(e.target.value)}
                placeholder="Ör: Migros, İstiklal Cad." className={inputCls} />
            </div>
          </>
        )}

        {/* ── yeme-içme ── */}
        {selCat === 'yeme-içme' && (
          <>
            <div>
              <label className={labelCls}>Tutar (opsiyonel)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{currencySymbol}</span>
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                  placeholder="0" min="0" step="0.01" className={cn(inputCls, 'pl-8')} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Restoran / Konum</label>
              <input type="text" value={location_} onChange={e => setLocation_(e.target.value)}
                placeholder="Ör: Nusret, Beşiktaş" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Kişiler</label>
              <PeopleInput people={people} onChange={setPeople} />
            </div>
          </>
        )}

        {/* ── seyahat ── */}
        {selCat === 'seyahat' && (
          <>
            <div>
              <label className={labelCls}>Gidilen Yer</label>
              <input type="text" value={location_} onChange={e => setLocation_(e.target.value)}
                placeholder="Ör: Antalya, Kapadokya" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Süre (gün)</label>
              <input type="number" value={travelDays} onChange={e => setTravelDays(e.target.value)}
                placeholder="Ör: 3" min="1" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Tutar (opsiyonel)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{currencySymbol}</span>
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                  placeholder="0" min="0" step="0.01" className={cn(inputCls, 'pl-8')} />
              </div>
            </div>
          </>
        )}

        {/* ── ev-yaşam ── */}
        {selCat === 'ev-yaşam' && (
          <>
            <div>
              <label className={labelCls}>Süre (dakika, opsiyonel)</label>
              <input type="number" value={duration} onChange={e => setDuration(e.target.value)}
                placeholder="Ör: 60" min="0" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Açıklama</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Ne yaptın, nasıl geçti..." rows={3}
                className={cn(inputCls, 'resize-none')} />
            </div>
          </>
        )}

        {/* ── harcama ── */}
        {selCat === 'harcama' && (
          <>
            <div>
              <label className={labelCls}>Tutar *</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{currencySymbol}</span>
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                  placeholder="0" min="0" step="0.01" className={cn(inputCls, 'pl-8')} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Kategori</label>
              <div className="flex flex-wrap gap-2">
                {EXPENSE_SUBCATS.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setExpenseSubcat(expenseSubcat === s ? '' : s)}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                      expenseSubcat === s
                        ? 'bg-foreground text-background border-foreground'
                        : 'bg-background text-foreground border-border'
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={labelCls}>Açıklama</label>
              <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Ör: Elektrik faturası" className={inputCls} />
            </div>
          </>
        )}

        {/* ── diğer ── */}
        {selCat === 'diğer' && (
          <>
            <div>
              <label className={labelCls}>Süre (dakika, opsiyonel)</label>
              <input type="number" value={duration} onChange={e => setDuration(e.target.value)}
                placeholder="Ör: 30" min="0" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Açıklama</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Detayları buraya yaz..." rows={3}
                className={cn(inputCls, 'resize-none')} />
            </div>
          </>
        )}

        {/* ── Delete button (edit only) ── */}
        {isEditing && (
          <button
            type="button"
            onClick={() => setDelConfirm(true)}
            className="w-full py-3 rounded-xl bg-destructive/10 text-destructive font-semibold text-sm active:scale-[0.98] transition-transform"
          >
            Eylemi Sil
          </button>
        )}
      </div>

      {/* ── Fixed Save Button ───────────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] px-4 pb-6 pt-3 bg-background/90 backdrop-blur-sm border-t border-border">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-4 rounded-2xl font-bold text-white text-base active:scale-[0.98] transition-transform disabled:opacity-60 flex items-center justify-center gap-2"
          style={{ backgroundColor: catColor }}
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {isEditing ? 'Güncelle' : 'Kaydet'}
        </button>
      </div>

      {/* ── Delete confirm dialog ───────────────────────────────────────────── */}
      {delConfirm && (
        <div
          className="fixed inset-0 z-[400] flex items-end justify-center bg-black/40 pb-6"
          onClick={() => setDelConfirm(false)}
        >
          <div
            className="bg-card rounded-2xl p-5 mx-4 shadow-xl w-full max-w-[400px]"
            onClick={e => e.stopPropagation()}
          >
            <p className="text-base font-semibold text-center mb-1">Eylemi sil</p>
            <p className="text-sm text-muted-foreground text-center mb-5">Bu eylem kalıcı olarak silinecek. Emin misin?</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDelConfirm(false)}
                className="flex-1 py-3 rounded-xl bg-muted text-muted-foreground font-semibold text-sm"
              >
                İptal
              </button>
              <button
                onClick={handleDelete}
                disabled={saving}
                className="flex-1 py-3 rounded-xl bg-destructive text-white font-semibold text-sm disabled:opacity-60 flex items-center justify-center gap-1.5"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Sil
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
