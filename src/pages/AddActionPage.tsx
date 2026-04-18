import { useState, useEffect, useRef, type ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Loader2, Star, MapPin } from 'lucide-react';
import { getCurrentLocation } from '@/hooks/useLocation';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';
import { useCurrencyStore } from '@/store/useCurrencyStore';
import { useActivityRefresh } from '@/store/useActivityRefresh';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { FriendAutocomplete } from '@/components/FriendAutocomplete';
import { useTranslation } from 'react-i18next';
import { useLanguageStore } from '@/store/useLanguageStore';
import { formatDate } from '@/lib/dateLocale';
import { getLocalDateString, getLocalNoonISOStringFromYMD } from '@/lib/dateUtils';
import { useAppSettings } from '@/hooks/useAppSettings';
import {
  MAX_DURATION_PICKER_MINS,
  minsToHoursAndMins,
  snapMinutesToFiveStep,
} from '@/lib/durationFormat';

const MINUTE_SELECT_OPTIONS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55] as const;

// ── Category definitions (ids & meta stay outside for TypeScript inference) ──
const CATEGORY_META = [
  { id: 'sağlık-spor', emoji: '🏃', labelKey: 'add_action.categories.health', descKey: 'add_action.categories.health_desc', color: '#22c55e' },
  { id: 'sosyal',      emoji: '👥', labelKey: 'add_action.categories.social', descKey: 'add_action.categories.social_desc', color: '#3b82f6' },
  { id: 'iş-eğitim',  emoji: '💼', labelKey: 'add_action.categories.work',   descKey: 'add_action.categories.work_desc',   color: '#6366f1' },
  { id: 'eğlence',    emoji: '🎬', labelKey: 'add_action.categories.entertainment', descKey: 'add_action.categories.entertainment_desc', color: '#ec4899' },
  { id: 'alışveriş',  emoji: '🛒', labelKey: 'add_action.categories.shopping', descKey: 'add_action.categories.shopping_desc', color: '#f97316' },
  { id: 'yeme-içme',  emoji: '🍽️', labelKey: 'add_action.categories.food',   descKey: 'add_action.categories.food_desc',   color: '#ef4444' },
  { id: 'seyahat',    emoji: '✈️', labelKey: 'add_action.categories.travel',  descKey: 'add_action.categories.travel_desc',  color: '#0ea5e9' },
  { id: 'ev-yaşam',   emoji: '🏠', labelKey: 'add_action.categories.home',   descKey: 'add_action.categories.home_desc',   color: '#84cc16' },
  { id: 'diğer',      emoji: '📦', labelKey: 'add_action.categories.other',  descKey: 'add_action.categories.other_desc',  color: '#94a3b8' },
] as const;

type CategoryId = typeof CATEGORY_META[number]['id'];

const EXPENSE_SUBCATS = ['Yiyecek', 'Ulaşım', 'Eğlence', 'Faturalar', 'Sağlık', 'Giyim', 'Teknoloji', 'Diğer'];

const TITLE_PLACEHOLDER_KEYS: Record<CategoryId, string> = {
  'sağlık-spor': 'add_action.placeholder_health',
  'sosyal':      'add_action.placeholder_social',
  'iş-eğitim':  'add_action.placeholder_work',
  'eğlence':    'add_action.placeholder_entertainment',
  'alışveriş':  'add_action.placeholder_shopping',
  'yeme-içme':  'add_action.placeholder_food',
  'seyahat':    'add_action.placeholder_travel',
  'ev-yaşam':   'add_action.placeholder_home',
  'diğer':      'add_action.placeholder_other',
};

function getCat(id: string) {
  return CATEGORY_META.find(c => c.id === id) ?? CATEGORY_META[CATEGORY_META.length - 1];
}

const ALL_CATEGORY_IDS = CATEGORY_META.map(c => c.id) as string[];
const LEGACY_IDS = ['gittim', 'yaptim', 'uyudum', 'izledim', 'spor', 'sağlık', 'iş'];
const VALID_IDS = [...ALL_CATEGORY_IDS, ...LEGACY_IDS];

function DurationDropdownField({
  label,
  valueMins,
  onChangeMins,
  hint,
}: {
  label: ReactNode;
  valueMins: number | null;
  onChangeMins: (v: number | null) => void;
  hint?: string;
}) {
  const { t } = useTranslation();
  const selectCls =
    'w-full border border-gray-200 dark:border-gray-600 rounded-2xl px-4 py-3 text-sm bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-blue-400 appearance-none text-center';

  const capped = Math.min(valueMins ?? 0, MAX_DURATION_PICKER_MINS);
  const { hours: hRaw, minutes: mRaw } = minsToHoursAndMins(capped);
  const durationHours = Math.min(23, hRaw);
  const durationMins = snapMinutesToFiveStep(mRaw);

  return (
    <div>
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">{label}</label>
      <div className="flex items-center gap-3">
        <div className="flex-1 flex items-center gap-2">
          <select
            value={durationHours}
            onChange={e => {
              const h = parseInt(e.target.value, 10);
              const total = h * 60 + durationMins;
              onChangeMins(total > 0 ? total : null);
            }}
            className={selectCls}
          >
            {Array.from({ length: 24 }, (_, i) => (
              <option key={i} value={i}>
                {String(i).padStart(2, '0')}
              </option>
            ))}
          </select>
          <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
            {t('common.hours')}
          </span>
        </div>

        <span className="text-gray-400 font-bold">:</span>

        <div className="flex-1 flex items-center gap-2">
          <select
            value={durationMins}
            onChange={e => {
              const m = parseInt(e.target.value, 10);
              const total = durationHours * 60 + m;
              onChangeMins(total > 0 ? total : null);
            }}
            className={selectCls}
          >
            {MINUTE_SELECT_OPTIONS.map(m => (
              <option key={m} value={m}>
                {String(m).padStart(2, '0')}
              </option>
            ))}
          </select>
          <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
            {t('common.minutes')}
          </span>
        </div>
      </div>
      {hint ? (
        <p className="text-xs text-gray-400 mt-1 ml-1 dark:text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const inputCls = "w-full bg-muted rounded-xl px-4 py-3 text-sm outline-none border border-border focus:border-foreground/30 transition-colors";
const labelCls = "text-[11px] font-semibold text-foreground/50 mb-1.5 block uppercase tracking-wider";

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AddActionPage() {
  const { t } = useTranslation();
  const { language } = useLanguageStore();
  const navigate       = useNavigate();
  const { user }       = useAuthStore();
  const userId         = user?.id ?? '';
  const location       = useLocation();
  const state          = location.state as { editId?: string; category?: string } | null;
  const editId         = state?.editId;
  const isEditing      = !!editId;
  const currencySymbol = useCurrencyStore(s => s.symbol);
  const currencyCode   = useCurrencyStore(s => s.code);
  const { refresh }    = useActivityRefresh();
  const { settings }   = useAppSettings();

  // ── Translated category list (re-computed when language changes) ──────────
  const CATEGORIES = CATEGORY_META.map(c => ({
    ...c,
    label: t(c.labelKey),
    desc:  t(c.descKey),
  }));

  // ── Per-category title placeholder ────────────────────────────────────────
  const getPlaceholder = (category: string): string =>
    t(TITLE_PLACEHOLDER_KEYS[category as CategoryId] ?? 'add_action.activity_name_placeholder_default');

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
  const [activityCount, setActivityCount] = useState(0);
  const [isPremiumUser, setIsPremiumUser] = useState(false);

  // ── Form state ─────────────────────────────────────────────────────────────
  const [title,           setTitle]           = useState('');
  const [date,            setDate]            = useState(getLocalDateString());
  const [isFavorite,      setIsFavorite]      = useState(false);
  const [activityDurationMins, setActivityDurationMins] = useState<number | null>(null);
  const [calories,        setCalories]        = useState('');
  const [people,          setPeople]          = useState<string[]>([]);
  const [location_,       setLocation_]       = useState('');
  const [amount,          setAmount]          = useState('');
  const [project,         setProject]         = useState('');
  const [notes,           setNotes]           = useState('');
  const [expenseSubcat,   setExpenseSubcat]   = useState('');
  const [travelDays,      setTravelDays]      = useState('');
  const [quantity,        setQuantity]        = useState('');
  const [quantityUnit,    setQuantityUnit]    = useState('');
  const [locationLat,     setLocationLat]     = useState<number | null>(null);
  const [locationLon,     setLocationLon]     = useState<number | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      const screenHeight = window.screen.height;
      setKeyboardOpen(viewportHeight < screenHeight * 0.75);
    };
    window.visualViewport?.addEventListener('resize', handleResize);
    window.addEventListener('resize', handleResize);
    return () => {
      window.visualViewport?.removeEventListener('resize', handleResize);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // ── Plan & monthly activity count check ───────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    const checkLimits = async () => {
      const { data: userData } = await supabase
        .from('users')
        .select('plan_type')
        .eq('id', userId)
        .single();

      const premium = userData?.plan_type === 'premium';
      setIsPremiumUser(premium);
      if (premium) return;

      const firstOfMonth = new Date();
      firstOfMonth.setDate(1);
      firstOfMonth.setHours(0, 0, 0, 0);

      const lastOfMonth = new Date();
      lastOfMonth.setMonth(lastOfMonth.getMonth() + 1);
      lastOfMonth.setDate(0);
      lastOfMonth.setHours(23, 59, 59, 999);

      const { count } = await supabase
        .from('activities')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('activity_date', firstOfMonth.toISOString())
        .lte('activity_date', lastOfMonth.toISOString());

      setActivityCount(count ?? 0);
    };
    void checkLimits();
  }, [userId]);

  const isActivityLimitReached = !isPremiumUser && !isEditing &&
    activityCount >= settings.free_monthly_activities;

  // ── Load existing activity (edit mode) ────────────────────────────────────
  useEffect(() => {
    if (!editId || !userId) return;
    supabase
      .from('activities')
      .select('*')
      .eq('id', editId)
      .eq('user_id', userId)
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
        if (data.duration_mins != null && Number(data.duration_mins) > 0) {
          setActivityDurationMins(Number(data.duration_mins));
        }
        setIsFavorite(data.is_favorite ?? false);
        setLocation_(typeof data.location === 'string' ? data.location : '');
        setPeople(Array.isArray(data.people) ? (data.people as string[]) : []);
        setNotes(data.raw_message ?? '');
        setQuantity(data.quantity != null && data.quantity !== '' ? String(data.quantity as number) : '');
        setQuantityUnit(typeof data.quantity_unit === 'string' ? data.quantity_unit : '');
        setLocationLat((data as any).location_lat ?? null);
        setLocationLon((data as any).location_lon ?? null);
      })
      .finally(() => setLoading(false));
  }, [editId, userId]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const cat = getCat(selCat);

  const handleSelectCategory = (id: CategoryId) => {
    setSelCat(id);
    setStep('form');
  };

  // ── Get current location ──────────────────────────────────────────────────
  const handleGetLocation = async () => {
    setLocationLoading(true);
    try {
      const result = await getCurrentLocation();
      if (result) {
        setLocation_(result.shortName);
        setLocationLat(result.lat);
        setLocationLon(result.lon);
      }
    } finally {
      setLocationLoading(false);
    }
  };

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (isActivityLimitReached) {
      toast.error(t('add_action.error_activity_limit', { limit: settings.free_monthly_activities }));
      return;
    }
    if (!title.trim()) { toast.error(t('add_action.error_title_empty')); return; }
    if (selCat === 'alışveriş' && !amount) {
      toast.error(t('add_action.error_amount_required')); return;
    }
    if (!userId) {
      toast.error(t('add_action.error_no_session'));
      return;
    }
    setSaving(true);
    try {
      let durationMins: number | null = null;
      if (selCat === 'seyahat' && travelDays) {
        durationMins = parseInt(travelDays) * 1440;
      } else {
        durationMins =
          activityDurationMins != null && activityDurationMins > 0 ? activityDurationMins : null;
      }

      const activityPayload = {
        user_id:      userId,
        title:        title.trim(),
        category:     selCat,
        amount:       amount ? parseFloat(amount) : null,
        duration_mins: durationMins,
        location:     location_.trim() || null,
        people,
        activity_date: getLocalNoonISOStringFromYMD(date),
        created_via:  'manual' as const,
        raw_message:  notes.trim() || title.trim(),
        is_favorite:  isFavorite,
        quantity:     selCat === 'yeme-içme' && quantity ? Number(quantity) : null,
        quantity_unit: selCat === 'yeme-içme' ? (quantityUnit.trim() || null) : null,
        location_lat: location_.trim() ? locationLat : null,
        location_lon: location_.trim() ? locationLon : null,
      };

      if (isEditing && editId) {
        const { error } = await supabase
          .from('activities')
          .update(activityPayload)
          .eq('id', editId)
          .eq('user_id', userId);
        if (error) { console.error(error); toast.error(t('add_action.error_save_failed')); return; }
      } else {
        const { error } = await supabase.from('activities').insert(activityPayload);
        if (error) { console.error(error); toast.error(t('add_action.error_save_failed')); return; }
      }

      // Also save to transactions for alışveriş and yeme-içme when amount is set
      if (!isEditing && ['alışveriş', 'yeme-içme'].includes(selCat) && amount) {
        await supabase.from('transactions').insert({
          user_id:          userId,
          type:             'expense',
          title:            title.trim(),
          amount:           parseFloat(amount),
          currency:         currencyCode ?? 'TRY',
          category:         selCat === 'alışveriş' ? 'Alışveriş' : 'Yiyecek & İçecek',
          transaction_date: getLocalNoonISOStringFromYMD(date),
          created_via:      'manual',
        });
      }

      toast.success(isEditing ? t('add_action.success_updated') : t('add_action.success_added'));
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
        .eq('user_id', userId);
      if (error) { toast.error(t('add_action.error_delete_failed')); return; }
      toast.success(t('add_action.success_deleted'));
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
      <div className="min-h-screen bg-background w-full flex flex-col">
        {/* Header */}
<div className="px-4 pb-4 pt-4">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-muted mb-6"
          >
            <ArrowLeft className="w-4 h-4 text-foreground/60" />
          </button>
          <h1 className="text-2xl font-bold text-foreground">{t('add_action.what_did_you_do')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('add_action.select_category')}</p>
        </div>

        {/* Grid */}
        <div className="flex-1 px-4 pb-8 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            {CATEGORIES.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => handleSelectCategory(c.id)}
                className="flex items-center gap-3 p-4 rounded-2xl border border-border bg-card active:scale-[0.97] transition-transform text-left"
                style={{ '--cat-color': c.color } as React.CSSProperties}
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                  style={{ backgroundColor: c.color + '18' }}
                >
                  {c.emoji}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground leading-tight">{c.label}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{c.desc}</p>
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
    <div className="min-h-screen bg-background w-full">

      {/* ── Colored Header ─────────────────────────────────────────────────── */}
      <div
        className="px-4 pb-5"
        style={{
          backgroundColor: catColor,
          position: keyboardOpen ? 'relative' : 'sticky',
          top: 0,
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)',
          marginTop: keyboardOpen ? 0 : 'calc(-1 * env(safe-area-inset-top, 0px))',
          zIndex: 10,
        }}
      >
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
            <p className="text-white/70 text-xs font-medium">{isEditing ? t('add_action.editing') : t('add_action.new_action')}</p>
            <p className="text-white font-bold text-lg leading-tight">{t(cat.labelKey)}</p>
          </div>
        </div>
      </div>

      {/* ── Scrollable Form ─────────────────────────────────────────────────── */}
      <div className="px-4 pt-5 pb-28 space-y-4">

        {/* ── COMMON: Title ── */}
        <div>
          <label className={labelCls}>{t('add_action.title_label')}</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder={getPlaceholder(selCat)}
            className={inputCls}
            autoFocus
          />
        </div>

        {/* ── COMMON: Date ── */}
        <div>
          <label className={labelCls}>{t('add_action.date')}</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className={inputCls}
          />
          <p className="text-xs text-muted-foreground mt-1.5">{formatDate(date)}</p>
        </div>

        {/* ── sağlık-spor ── */}
        {selCat === 'sağlık-spor' && (
          <>
            <DurationDropdownField
              label={
                <>
                  {t('add_action.duration')}
                  <span className="text-gray-400 text-xs ml-1">({t('common.optional')})</span>
                </>
              }
              valueMins={activityDurationMins}
              onChangeMins={setActivityDurationMins}
              hint={t('add_action.duration_hint')}
            />
            <div>
              <label className={labelCls}>{t('add_action.calories')}</label>
              <input type="number" value={calories} onChange={e => setCalories(e.target.value)}
                placeholder={t('add_action.calories_placeholder')} min="0" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{t('add_action.notes_optional')}</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                placeholder={t('add_action.notes_placeholder')} rows={2}
                className={cn(inputCls, 'resize-none')} />
            </div>
          </>
        )}

        {/* ── sosyal ── */}
        {selCat === 'sosyal' && (
          <>
            <div>
              <label className={labelCls}>{t('add_action.people')}</label>
              <FriendAutocomplete
                userId={userId}
                value={people}
                onChange={setPeople}
                placeholder={t('add_action.people_placeholder')}
              />
            </div>
            <div>
              <label className={labelCls}>{t('add_action.location')}</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={location_}
                  onChange={e => { setLocation_(e.target.value); setLocationLat(null); setLocationLon(null); }}
                  placeholder={t('add_action.location_placeholder')}
                  className={cn(inputCls, 'flex-1')}
                />
                <button
                  type="button"
                  onClick={handleGetLocation}
                  disabled={locationLoading}
                  className="w-11 h-11 flex items-center justify-center rounded-xl bg-muted border border-border active:scale-95 transition-transform disabled:opacity-50 flex-shrink-0"
                >
                  {locationLoading
                    ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    : <MapPin className="w-4 h-4 text-muted-foreground" />
                  }
                </button>
              </div>
              {locationLat && locationLon && (
                <div className="mt-2 rounded-2xl overflow-hidden" style={{ height: 120 }}>
                  <iframe
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${locationLon - 0.001},${locationLat - 0.001},${locationLon + 0.001},${locationLat + 0.001}&layer=mapnik&marker=${locationLat},${locationLon}`}
                    width="100%"
                    height="120"
                    scrolling="no"
                    style={{ border: 'none', borderRadius: 16, pointerEvents: 'none' }}
                  />
                </div>
              )}
            </div>
            <div>
              <label className={labelCls}>{t('add_action.notes_optional')}</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                placeholder={t('add_action.notes_placeholder')} rows={2}
                className={cn(inputCls, 'resize-none')} />
            </div>
          </>
        )}

        {/* ── iş-eğitim ── */}
        {selCat === 'iş-eğitim' && (
          <>
            <DurationDropdownField
              label={
                <>
                  {t('add_action.duration')}
                  <span className="text-gray-400 text-xs ml-1">({t('common.optional')})</span>
                </>
              }
              valueMins={activityDurationMins}
              onChangeMins={setActivityDurationMins}
              hint={t('add_action.duration_hint')}
            />
            <div>
              <label className={labelCls}>{t('add_action.project')}</label>
              <input type="text" value={project} onChange={e => setProject(e.target.value)}
                placeholder={t('add_action.project_placeholder')} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{t('add_action.notes_optional')}</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                placeholder={t('add_action.notes_placeholder')} rows={2}
                className={cn(inputCls, 'resize-none')} />
            </div>
          </>
        )}

        {/* ── eğlence ── */}
        {selCat === 'eğlence' && (
          <>
            <div>
              <label className={labelCls}>{t('add_action.what_watched')}</label>
              <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
                placeholder={t('add_action.what_watched_placeholder')} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{t('add_action.people')}</label>
              <FriendAutocomplete
                userId={userId}
                value={people}
                onChange={setPeople}
                placeholder={t('add_action.people_placeholder')}
              />
            </div>
            <div>
              <label className={labelCls}>{t('add_action.amount_optional')}</label>
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
              <label className={labelCls}>{t('add_action.amount_required')}</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{currencySymbol}</span>
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                  placeholder="0" min="0" step="0.01" className={cn(inputCls, 'pl-8')} />
              </div>
            </div>
            <div>
              <label className={labelCls}>{t('add_action.store_location')}</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={location_}
                  onChange={e => { setLocation_(e.target.value); setLocationLat(null); setLocationLon(null); }}
                  placeholder={t('add_action.store_location_placeholder')}
                  className={cn(inputCls, 'flex-1')}
                />
                <button
                  type="button"
                  onClick={handleGetLocation}
                  disabled={locationLoading}
                  className="w-11 h-11 flex items-center justify-center rounded-xl bg-muted border border-border active:scale-95 transition-transform disabled:opacity-50 flex-shrink-0"
                >
                  {locationLoading
                    ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    : <MapPin className="w-4 h-4 text-muted-foreground" />
                  }
                </button>
              </div>
              {locationLat && locationLon && (
                <div className="mt-2 rounded-2xl overflow-hidden" style={{ height: 120 }}>
                  <iframe
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${locationLon - 0.001},${locationLat - 0.001},${locationLon + 0.001},${locationLat + 0.001}&layer=mapnik&marker=${locationLat},${locationLon}`}
                    width="100%"
                    height="120"
                    scrolling="no"
                    style={{ border: 'none', borderRadius: 16, pointerEvents: 'none' }}
                  />
                </div>
              )}
            </div>
            <div>
              <label className={labelCls}>{t('add_action.notes_optional')}</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                placeholder={t('add_action.notes_placeholder')} rows={2}
                className={cn(inputCls, 'resize-none')} />
            </div>
          </>
        )}

        {/* ── yeme-içme ── */}
        {selCat === 'yeme-içme' && (
          <>
            <div>
              <label className={labelCls}>{t('add_action.amount_optional')}</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{currencySymbol}</span>
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                  placeholder="0" min="0" step="0.01" className={cn(inputCls, 'pl-8')} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>
                  {t('add_action.quantity')}
                  <span className="text-muted-foreground font-normal normal-case tracking-normal ml-1">
                    ({t('common.optional')})
                  </span>
                </label>
                <input
                  type="number"
                  value={quantity}
                  onChange={e => setQuantity(e.target.value)}
                  placeholder="4"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>
                  {t('add_action.quantity_unit')}
                  <span className="text-muted-foreground font-normal normal-case tracking-normal ml-1">
                    ({t('common.optional')})
                  </span>
                </label>
                <input
                  type="text"
                  value={quantityUnit}
                  onChange={e => setQuantityUnit(e.target.value)}
                  placeholder="duble / porsiyon / bardak"
                  className={inputCls}
                />
              </div>
            </div>
            <div>
              <label className={labelCls}>{t('add_action.restaurant_location')}</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={location_}
                  onChange={e => { setLocation_(e.target.value); setLocationLat(null); setLocationLon(null); }}
                  placeholder={t('add_action.restaurant_location_placeholder')}
                  className={cn(inputCls, 'flex-1')}
                />
                <button
                  type="button"
                  onClick={handleGetLocation}
                  disabled={locationLoading}
                  className="w-11 h-11 flex items-center justify-center rounded-xl bg-muted border border-border active:scale-95 transition-transform disabled:opacity-50 flex-shrink-0"
                >
                  {locationLoading
                    ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    : <MapPin className="w-4 h-4 text-muted-foreground" />
                  }
                </button>
              </div>
              {locationLat && locationLon && (
                <div className="mt-2 rounded-2xl overflow-hidden" style={{ height: 120 }}>
                  <iframe
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${locationLon - 0.001},${locationLat - 0.001},${locationLon + 0.001},${locationLat + 0.001}&layer=mapnik&marker=${locationLat},${locationLon}`}
                    width="100%"
                    height="120"
                    scrolling="no"
                    style={{ border: 'none', borderRadius: 16, pointerEvents: 'none' }}
                  />
                </div>
              )}
            </div>
            <div>
              <label className={labelCls}>{t('add_action.people')}</label>
              <FriendAutocomplete
                userId={userId}
                value={people}
                onChange={setPeople}
                placeholder={t('add_action.people_placeholder')}
              />
            </div>
            <div>
              <label className={labelCls}>{t('add_action.notes_optional')}</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                placeholder={t('add_action.notes_placeholder')} rows={2}
                className={cn(inputCls, 'resize-none')} />
            </div>
          </>
        )}

        {/* ── seyahat ── */}
        {selCat === 'seyahat' && (
          <>
            <div>
              <label className={labelCls}>{t('add_action.destination')}</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={location_}
                  onChange={e => { setLocation_(e.target.value); setLocationLat(null); setLocationLon(null); }}
                  placeholder={t('add_action.destination_placeholder')}
                  className={cn(inputCls, 'flex-1')}
                />
                <button
                  type="button"
                  onClick={handleGetLocation}
                  disabled={locationLoading}
                  className="w-11 h-11 flex items-center justify-center rounded-xl bg-muted border border-border active:scale-95 transition-transform disabled:opacity-50 flex-shrink-0"
                >
                  {locationLoading
                    ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    : <MapPin className="w-4 h-4 text-muted-foreground" />
                  }
                </button>
              </div>
              {locationLat && locationLon && (
                <div className="mt-2 rounded-2xl overflow-hidden" style={{ height: 120 }}>
                  <iframe
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${locationLon - 0.001},${locationLat - 0.001},${locationLon + 0.001},${locationLat + 0.001}&layer=mapnik&marker=${locationLat},${locationLon}`}
                    width="100%"
                    height="120"
                    scrolling="no"
                    style={{ border: 'none', borderRadius: 16, pointerEvents: 'none' }}
                  />
                </div>
              )}
            </div>
            <div>
              <label className={labelCls}>{t('add_action.duration_days')}</label>
              <input type="number" value={travelDays} onChange={e => setTravelDays(e.target.value)}
                placeholder={t('add_action.travel_days_placeholder')} min="1" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{t('add_action.amount_optional')}</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{currencySymbol}</span>
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                  placeholder="0" min="0" step="0.01" className={cn(inputCls, 'pl-8')} />
              </div>
            </div>
            <div>
              <label className={labelCls}>{t('add_action.notes_optional')}</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                placeholder={t('add_action.notes_placeholder')} rows={2}
                className={cn(inputCls, 'resize-none')} />
            </div>
          </>
        )}

        {/* ── ev-yaşam ── */}
        {selCat === 'ev-yaşam' && (
          <>
            <DurationDropdownField
              label={t('add_action.duration_optional')}
              valueMins={activityDurationMins}
              onChangeMins={setActivityDurationMins}
              hint={t('add_action.duration_hint')}
            />
            <div>
              <label className={labelCls}>{t('add_action.description')}</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                placeholder={t('add_action.notes_placeholder')} rows={3}
                className={cn(inputCls, 'resize-none')} />
            </div>
          </>
        )}

        {/* ── harcama (legacy) ── */}
        {selCat === 'harcama' && (
          <>
            <div>
              <label className={labelCls}>{t('add_action.amount_required')}</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{currencySymbol}</span>
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                  placeholder="0" min="0" step="0.01" className={cn(inputCls, 'pl-8')} />
              </div>
            </div>
            <div>
              <label className={labelCls}>{t('add_action.category')}</label>
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
              <label className={labelCls}>{t('add_action.description')}</label>
              <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
                placeholder={t('add_action.expense_description_placeholder')} className={inputCls} />
            </div>
          </>
        )}

        {/* ── diğer ── */}
        {selCat === 'diğer' && (
          <>
            <DurationDropdownField
              label={t('add_action.duration_optional')}
              valueMins={activityDurationMins}
              onChangeMins={setActivityDurationMins}
              hint={t('add_action.duration_hint')}
            />
            <div>
              <label className={labelCls}>{t('add_action.description')}</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                placeholder={t('add_action.notes_placeholder')} rows={3}
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
            {t('add_action.delete_action')}
          </button>
        )}
      </div>

      {/* ── Fixed Save Button ───────────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full px-4 pb-6 pt-3 bg-background/90 backdrop-blur-sm border-t border-border">
        {isActivityLimitReached && (
          <div className="mb-3 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-2xl border border-orange-200 dark:border-orange-800">
            <p className="text-xs text-orange-600 dark:text-orange-400 text-center">
              {t('add_action.activity_limit_banner', { count: activityCount, limit: settings.free_monthly_activities })}
            </p>
          </div>
        )}
        <button
          onClick={handleSave}
          disabled={saving || isActivityLimitReached}
          className="w-full py-4 rounded-2xl font-bold text-white text-base active:scale-[0.98] transition-transform disabled:opacity-60 flex items-center justify-center gap-2"
          style={{ backgroundColor: isActivityLimitReached ? '#94a3b8' : catColor }}
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {isEditing ? t('add_action.update') : t('add_action.save')}
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
            <p className="text-base font-semibold text-center mb-1">{t('add_action.delete_confirm_title')}</p>
            <p className="text-sm text-muted-foreground text-center mb-5">{t('add_action.delete_confirm_desc')}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDelConfirm(false)}
                className="flex-1 py-3 rounded-xl bg-muted text-muted-foreground font-semibold text-sm"
              >
                {t('add_action.cancel')}
              </button>
              <button
                onClick={handleDelete}
                disabled={saving}
                className="flex-1 py-3 rounded-xl bg-destructive text-white font-semibold text-sm disabled:opacity-60 flex items-center justify-center gap-1.5"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
