import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Settings, ChevronDown, ChevronUp, Pencil, Save, Loader2 } from 'lucide-react';
import { signOut } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { getCurrencySymbol } from '@/lib/currency';
import { useCurrencyStore } from '@/store/useCurrencyStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useTranslation } from 'react-i18next';
import { getActivityLevel, getMotivationType } from '@/lib/categoryTranslations';

function completionTier(score: number): 'low' | 'medium' | 'good' | 'excellent' {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'medium';
  return 'low';
}

// ─── Reusable field components ────────────────────────────────────────────────

interface SectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function ExpandableSection({ title, children, defaultOpen = false }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-4 active:bg-muted/50">
        <span className="font-medium text-sm">{title}</span>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">{children}</div>}
    </div>
  );
}

function FieldNumber({ label, value, onChange, placeholder, suffix, min, max }: {
  label: string; value: number | ''; onChange: (v: number | '') => void; placeholder?: string; suffix?: string; min?: number; max?: number;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1 block">{label}</label>
      <div className="relative">
        <input
          type="number"
          value={value}
          onChange={e => onChange(e.target.value === '' ? '' : Number(e.target.value))}
          placeholder={placeholder}
          min={min}
          max={max}
          className="w-full bg-muted rounded-xl px-3 py-2.5 text-sm outline-none border border-border focus:border-accent transition-colors"
        />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  );
}

function FieldText({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1 block">{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-muted rounded-xl px-3 py-2.5 text-sm outline-none border border-border focus:border-accent transition-colors"
      />
    </div>
  );
}

function FieldDate({ label, value, onChange }: {
  label: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1 block">{label}</label>
      <input
        type="date"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-muted rounded-xl px-3 py-2.5 text-sm outline-none border border-border focus:border-accent transition-colors"
      />
    </div>
  );
}

function FieldTextArea({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1 block">{label}</label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full bg-muted rounded-xl px-3 py-2.5 text-sm outline-none border border-border focus:border-accent transition-colors resize-none"
      />
    </div>
  );
}

function FieldSelect({ label, value, onChange, options, placeholder }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1 block">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-muted rounded-xl px-3 py-2.5 text-sm outline-none border border-border focus:border-accent transition-colors appearance-none"
      >
        <option value="">{placeholder ?? ''}</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function FieldToggle({ label, value, onChange }: {
  label: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <button
        onClick={() => onChange(!value)}
        className={cn("w-11 h-6 rounded-full transition-colors relative", value ? "bg-success" : "bg-muted")}
      >
        <div className={cn("w-4 h-4 rounded-full bg-card absolute top-1 transition-transform shadow-sm", value ? "translate-x-6" : "translate-x-1")} />
      </button>
    </div>
  );
}

function SegmentedSelector({ label, options, value, onChange, translate }: {
  label: string; options: string[]; value: string; onChange: (v: string) => void; translate?: (o: string) => string;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{label}</label>
      <div className="flex bg-muted rounded-xl p-0.5">
        {options.map(o => (
          <button
            key={o}
            onClick={() => onChange(o)}
            className={cn(
              "flex-1 py-2 rounded-lg text-[11px] font-medium transition-colors",
              value === o ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            )}
          >
            {translate ? translate(o) : o}
          </button>
        ))}
      </div>
    </div>
  );
}

function MultiChips({ label, options, selected, onChange }: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (v: string) => {
    onChange(selected.includes(v) ? selected.filter(s => s !== v) : [...selected, v]);
  };
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{label}</label>
      <div className="flex flex-wrap gap-1.5">
        {options.map(o => (
          <button
            key={o.value}
            type="button"
            onClick={() => toggle(o.value)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
              selected.includes(o.value) ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Score calculation (spec: 100 points total) ───────────────────────────────

function calcScore(p: {
  fullName: string; birthDate: string;
  weight: number | ''; height: number | '';
  employmentType: string; interests: string[];
  shortTermGoal: string; longTermGoal: string;
  monthlyBudget: number | ''; relationshipStatus: string;
  doesSport: boolean; sleepGoal: number | '';
}): number {
  let score = 0;
  if (p.fullName.trim()) score += 10;
  if (p.birthDate) score += 5;
  if (p.weight && p.height) score += 10;
  if (p.employmentType) score += 10;
  if (p.interests.length > 0) score += 10;
  if (p.shortTermGoal.trim()) score += 15;
  if (p.longTermGoal.trim()) score += 15;
  if (p.monthlyBudget !== '' && p.monthlyBudget !== null) score += 10;
  if (p.relationshipStatus) score += 5;
  if (p.doesSport) score += 5;
  if (p.sleepGoal !== '' && p.sleepGoal !== null) score += 5;
  return score;
}

// ─── ProfilePage ──────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const userId = user?.id ?? '';
  const userEmail = user?.email || '';
  const [pageLoading, setPageLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const setGlobalCurrency = useCurrencyStore(s => s.setCurrency);

  // users table
  const [fullName, setFullName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState('');
  const [currency, setCurrency] = useState('TRY');
  const [currencySymbolState, setCurrencySymbolState] = useState('₺');

  // Health
  const [weight, setWeight] = useState<number | ''>('');
  const [height, setHeight] = useState<number | ''>('');
  const [bloodType, setBloodType] = useState('');
  const [chronicDisease, setChronicDisease] = useState(false);
  const [chronicDiseaseText, setChronicDiseaseText] = useState('');
  const [medication, setMedication] = useState(false);
  const [medicationText, setMedicationText] = useState('');
  const [smoking, setSmoking] = useState('');
  const [alcohol, setAlcohol] = useState('');
  const [waterGoal, setWaterGoal] = useState<number | ''>(2);
  const [sleepGoal, setSleepGoal] = useState<number | ''>(8);

  // Lifestyle
  const [activityLevel, setActivityLevel] = useState('Orta');
  const [dietPrefs, setDietPrefs] = useState<string[]>([]);
  const [doesSport, setDoesSport] = useState(true);
  const [sportGoal, setSportGoal] = useState<number | ''>(3);
  const [doesMeditation, setDoesMeditation] = useState(false);

  // Social
  const [maritalStatus, setMaritalStatus] = useState('');
  const [childCount, setChildCount] = useState<number | ''>(0);
  const [hasPet, setHasPet] = useState(false);
  const [petType, setPetType] = useState('');
  const [livesWith, setLivesWith] = useState<string[]>([]);

  // Work
  const [workStatus, setWorkStatus] = useState('Çalışıyor');
  const [profession, setProfession] = useState('');
  const [workStyle, setWorkStyle] = useState('Ofis');
  const [dailyWorkHours, setDailyWorkHours] = useState<number | ''>(8);
  const [commuteDistance, setCommuteDistance] = useState<number | ''>(12);
  const [salaryRange, setSalaryRange] = useState('');
  const [education, setEducation] = useState('');

  // Interests
  const [interests, setInterests] = useState<string[]>([]);
  const [musicGenres, setMusicGenres] = useState<string[]>([]);
  const [filmGenres, setFilmGenres] = useState<string[]>([]);

  // Financial
  const [monthlyBudget, setMonthlyBudget] = useState<number | ''>('');
  const [savingsGoal, setSavingsGoal] = useState<number | ''>('');
  const [financialGoal, setFinancialGoal] = useState('');

  // Personal Goals
  const [shortTermGoal, setShortTermGoal] = useState('');
  const [longTermGoal, setLongTermGoal] = useState('');
  const [motivationPref, setMotivationPref] = useState('');

  // ─── BMI ────────────────────────────────────────────────────────────────────
  const bmi = useMemo(() => {
    if (weight && height) {
      const val = Number(weight) / (Number(height) / 100) ** 2;
      return val.toFixed(1);
    }
    return null;
  }, [weight, height]);

  // ─── Score ──────────────────────────────────────────────────────────────────
  const profileScore = useMemo(() => calcScore({
    fullName, birthDate, weight, height,
    employmentType: workStatus, interests,
    shortTermGoal, longTermGoal,
    monthlyBudget, relationshipStatus: maritalStatus,
    doesSport, sleepGoal,
  }), [fullName, birthDate, weight, height, workStatus, interests, shortTermGoal, longTermGoal, monthlyBudget, maritalStatus, doesSport, sleepGoal]);

  const genderTranslate = useCallback((v: string) => {
    if (v === 'Erkek') return t('profile.options.male');
    if (v === 'Kadın') return t('profile.options.female');
    return t('profile.options.not_specified');
  }, [t]);

  const workStyleTranslate = useCallback((v: string) => {
    const m: Record<string, string> = {
      Ofis: 'profile.options.office',
      Uzaktan: 'profile.options.remote',
      Hibrit: 'profile.options.hybrid',
      Saha: 'profile.options.field',
    };
    const key = m[v];
    return key ? t(key) : v;
  }, [t]);

  const smokingOptions = useMemo(() => [
    { value: 'Kullanmıyorum', label: t('profile.options.not_smoking') },
    { value: 'Bıraktım', label: t('profile.options.quit_smoking') },
    { value: 'Günde 1-5', label: t('profile.options.smoking_1_5') },
    { value: 'Günde 6+', label: t('profile.options.smoking_6plus') },
  ], [t]);

  const alcoholOptions = useMemo(() => [
    { value: 'Kullanmıyorum', label: t('profile.options.not_drinking') },
    { value: 'Sosyal', label: t('profile.options.social_drinking') },
    { value: 'Düzenli', label: t('profile.options.regular_drinking') },
  ], [t]);

  const workStatusOptions = useMemo(() => [
    { value: 'Çalışıyor', label: t('profile.options.working') },
    { value: 'Öğrenci', label: t('profile.options.student') },
    { value: 'Her ikisi', label: t('profile.options.both') },
    { value: 'Çalışmıyor', label: t('profile.options.not_working') },
  ], [t]);

  const educationOptions = useMemo(() => [
    { value: 'İlköğretim', label: t('profile.options.primary') },
    { value: 'Lise', label: t('profile.options.high_school') },
    { value: 'Ön Lisans', label: t('profile.options.associate') },
    { value: 'Lisans', label: t('profile.options.bachelor') },
    { value: 'Yüksek Lisans', label: t('profile.options.master') },
    { value: 'Doktora', label: t('profile.options.phd') },
  ], [t]);

  const relationshipOptions = useMemo(() => [
    { value: 'Bekar', label: t('profile.options.single') },
    { value: 'Evli', label: t('profile.options.married') },
    { value: 'Birlikte', label: t('profile.options.in_relationship') },
    { value: 'Boşanmış', label: t('profile.options.divorced') },
  ], [t]);

  const livesWithOptions = useMemo(() => [
    { value: 'Yalnız', label: t('profile.options.alone') },
    { value: 'Eş/Partner', label: t('profile.options.with_partner') },
    { value: 'Çocuklar', label: t('profile.options.with_children') },
    { value: 'Aile', label: t('profile.options.with_family') },
    { value: 'Arkadaşlar', label: t('profile.options.with_friends') },
  ], [t]);

  const interestChipOptions = useMemo(() => {
    const pairs: [string, 'sports' | 'music' | 'cinema' | 'books' | 'travel' | 'food' | 'technology' | 'art' | 'gaming' | 'nature' | 'dance' | 'photography'][] = [
      ['Spor', 'sports'],
      ['Müzik', 'music'],
      ['Sinema', 'cinema'],
      ['Kitap', 'books'],
      ['Seyahat', 'travel'],
      ['Yemek', 'food'],
      ['Teknoloji', 'technology'],
      ['Sanat', 'art'],
      ['Oyun', 'gaming'],
      ['Doğa', 'nature'],
      ['Dans', 'dance'],
      ['Fotoğraf', 'photography'],
    ];
    return pairs.map(([value, key]) => ({ value, label: t(`profile.options.${key}`) }));
  }, [t]);

  const dietChipOptions = useMemo(() => [
    { value: 'Omnivore', label: t('profile.options.diet_omnivore') },
    { value: 'Vejetaryen', label: t('profile.options.diet_vegetarian') },
    { value: 'Vegan', label: t('profile.options.diet_vegan') },
    { value: 'Glutensiz', label: t('profile.options.diet_gluten_free') },
    { value: 'Laktozsuz', label: t('profile.options.diet_lactose_free') },
  ], [t]);

  const musicGenreOptions = useMemo(() => [
    { value: 'Pop', label: t('profile.music.pop') },
    { value: 'Rock', label: t('profile.music.rock') },
    { value: 'Hip-Hop', label: t('profile.music.hiphop') },
    { value: 'Klasik', label: t('profile.music.classical') },
    { value: 'Caz', label: t('profile.music.jazz') },
    { value: 'Elektronik', label: t('profile.music.electronic') },
    { value: 'R&B', label: t('profile.music.rnb') },
    { value: 'Metal', label: t('profile.music.metal') },
    { value: 'Folk', label: t('profile.music.folk') },
    { value: 'Türk Halk', label: t('profile.music.turkish_folk') },
    { value: 'Türk Pop', label: t('profile.music.turkish_pop') },
    { value: 'Arabesk', label: t('profile.music.arabesk') },
  ], [t]);

  const filmGenreOptions = useMemo(() => [
    { value: 'Aksiyon', label: t('profile.genres.action') },
    { value: 'Komedi', label: t('profile.genres.comedy') },
    { value: 'Dram', label: t('profile.genres.drama') },
    { value: 'Bilim Kurgu', label: t('profile.genres.scifi') },
    { value: 'Korku', label: t('profile.genres.horror') },
    { value: 'Romantik', label: t('profile.genres.romance') },
    { value: 'Belgesel', label: t('profile.genres.documentary') },
    { value: 'Animasyon', label: t('profile.genres.animation') },
    { value: 'Gerilim', label: t('profile.genres.thriller') },
    { value: 'Fantastik', label: t('profile.genres.fantasy') },
  ], [t]);

  const salaryRangeOptions = useMemo(() => {
    const raw = currency === 'TRY'
      ? ['0-15.000', '15.000-25.000', '25.000-40.000', '40.000-60.000', '60.000-100.000', '100.000+']
      : ['0-1.000', '1.000-2.000', '2.000-3.500', '3.500-5.000', '5.000-8.000', '8.000+'];
    return raw.map(r => {
      const v = `${r}${currencySymbolState}`;
      return { value: v, label: v };
    });
  }, [currency, currencySymbolState]);

  const bloodTypeOptions = useMemo(
    () => ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', '0+', '0-'].map(v => ({ value: v, label: v })),
    [],
  );

  // ─── Fetch on mount ─────────────────────────────────────────────────────────
  const loadProfile = useCallback(async () => {
    if (!userId) {
      setPageLoading(false);
      return;
    }
    setPageLoading(true);
    try {
      const [usersRes, profilesRes] = await Promise.all([
        supabase.from('users').select('full_name, birth_date, gender, currency, currency_symbol, profile_score').eq('id', userId).single(),
        supabase.from('user_profiles').select('*').eq('user_id', userId).single(),
      ]);

      console.log('Loaded user data:', usersRes.data);
      console.log('Profile loaded:', { users: usersRes.data, user_profiles: profilesRes.data });

      if (usersRes.data) {
        const u = usersRes.data;
        if (u.full_name) setFullName(u.full_name);
        if (u.birth_date) setBirthDate(u.birth_date);
        if (u.gender) setGender(u.gender === 'Diğer' ? 'Belirtmiyorum' : u.gender);
        const loadedCurrency = u.currency || 'TRY';
        const loadedSymbol = u.currency_symbol || getCurrencySymbol(loadedCurrency);
        setCurrency(loadedCurrency);
        setCurrencySymbolState(loadedSymbol);
        setGlobalCurrency(loadedCurrency, loadedSymbol);
      }

      if (profilesRes.data) {
        const p = profilesRes.data;
        if (p.weight != null) setWeight(p.weight);
        if (p.height != null) setHeight(p.height);
        if (p.blood_type) setBloodType(p.blood_type);
        // chronic_diseases / medications are text[] — join for the text input display
        if (p.chronic_diseases != null) {
          const val = Array.isArray(p.chronic_diseases) ? p.chronic_diseases.join(', ') : String(p.chronic_diseases);
          setChronicDisease(val.length > 0);
          setChronicDiseaseText(val);
        }
        if (p.medications != null) {
          const val = Array.isArray(p.medications) ? p.medications.join(', ') : String(p.medications);
          setMedication(val.length > 0);
          setMedicationText(val);
        }
        if (p.is_smoker) {
          let s = p.is_smoker;
          if (s === 'Günde 6-20' || s === '20+') s = 'Günde 6+';
          setSmoking(s);
        }
        if (p.alcohol_use) setAlcohol(p.alcohol_use);
        if (p.water_goal != null) setWaterGoal(p.water_goal);
        if (p.sleep_goal != null) setSleepGoal(p.sleep_goal);
        if (p.activity_level) setActivityLevel(p.activity_level);
        if (p.diet_type != null) setDietPrefs(Array.isArray(p.diet_type) ? p.diet_type : p.diet_type ? [p.diet_type] : []);
        if (p.does_sport != null) setDoesSport(!!p.does_sport);
        if (p.weekly_sport_goal != null) setSportGoal(p.weekly_sport_goal);
        if (p.does_meditation != null) setDoesMeditation(!!p.does_meditation);
        if (p.relationship_status) {
          const r = p.relationship_status === 'İlişkide' ? 'Birlikte' : p.relationship_status;
          setMaritalStatus(r);
        }
        if (p.children_count != null) setChildCount(p.children_count);
        if (p.has_pet != null) setHasPet(!!p.has_pet);
        if (p.lives_with != null) setLivesWith(Array.isArray(p.lives_with) ? p.lives_with : p.lives_with ? [p.lives_with] : []);
        if (p.employment_type) setWorkStatus(p.employment_type);
        if (p.profession) setProfession(p.profession);
        if (p.work_type) setWorkStyle(p.work_type);
        if (p.daily_work_hours != null) setDailyWorkHours(p.daily_work_hours);
        if (p.home_to_work_km != null) setCommuteDistance(p.home_to_work_km);
        if (p.salary_range) setSalaryRange(p.salary_range);
        if (p.education_level) {
          const e = p.education_level === 'Önlisans' ? 'Ön Lisans' : p.education_level;
          setEducation(e);
        }
        if (p.interests != null) setInterests(Array.isArray(p.interests) ? p.interests : p.interests ? [p.interests] : []);
        if (p.favorite_music != null) setMusicGenres(Array.isArray(p.favorite_music) ? p.favorite_music : p.favorite_music ? [p.favorite_music] : []);
        if (p.favorite_genres != null) setFilmGenres(Array.isArray(p.favorite_genres) ? p.favorite_genres : p.favorite_genres ? [p.favorite_genres] : []);
        if (p.monthly_budget != null) setMonthlyBudget(p.monthly_budget);
        if (p.savings_goal != null) setSavingsGoal(p.savings_goal);
        if (p.financial_goal) setFinancialGoal(p.financial_goal);
        if (p.short_term_goal) setShortTermGoal(p.short_term_goal);
        if (p.long_term_goal) setLongTermGoal(p.long_term_goal);
        if (p.motivation_type) setMotivationPref(p.motivation_type);
      }
    } catch (err) {
      console.error('loadProfile', err);
    } finally {
      setPageLoading(false);
    }
  }, [userId]);

  useEffect(() => { void loadProfile(); }, [loadProfile]);

  // ─── Save ────────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    setSaving(true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toArray = (val: any): string[] => {
      if (!val) return [];
      if (Array.isArray(val)) return val.filter(Boolean);
      if (typeof val === 'string') return val.length > 0 ? [val] : [];
      return [];
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toBool = (val: any): boolean => {
      if (typeof val === 'boolean') return val;
      if (val === 'Evet' || val === true) return true;
      return false;
    };

    try {
      const score = calcScore({
        fullName, birthDate, weight, height,
        employmentType: workStatus, interests,
        shortTermGoal, longTermGoal,
        monthlyBudget, relationshipStatus: maritalStatus,
        doesSport, sleepGoal,
      });

      const { data: existingProfile } = await supabase
        .from('user_profiles')
        .select('ai_personality')
        .eq('user_id', userId)
        .maybeSingle();
      const aiPersonalityPersist =
        existingProfile?.ai_personality === 'strict' ||
        existingProfile?.ai_personality === 'gentle' ||
        existingProfile?.ai_personality === 'balanced'
          ? existingProfile.ai_personality
          : 'balanced';

      const [usersRes, profilesRes] = await Promise.all([
        supabase.from('users').update({
          full_name: fullName || null,
          birth_date: birthDate || null,
          gender: gender || null,
          profile_score: score,
        }).eq('id', userId),

        supabase.from('user_profiles').upsert({
          user_id: userId,
          weight: weight === '' ? null : weight,
          height: height === '' ? null : height,
          blood_type: bloodType || null,
          chronic_diseases: toArray(chronicDiseaseText),
          medications: toArray(medicationText),
          is_smoker: smoking || null,
          alcohol_use: alcohol || null,
          water_goal: waterGoal === '' ? null : waterGoal,
          sleep_goal: sleepGoal === '' ? null : sleepGoal,
          activity_level: activityLevel || null,
          diet_type: toArray(dietPrefs),
          does_sport: toBool(doesSport),
          weekly_sport_goal: sportGoal === '' ? null : sportGoal,
          does_meditation: toBool(doesMeditation),
          relationship_status: maritalStatus || null,
          has_children: toBool(childCount !== '' && Number(childCount) > 0),
          children_count: childCount === '' ? null : childCount,
          has_pet: toBool(hasPet),
          lives_with: toArray(livesWith),
          employment_type: workStatus || null,
          profession: profession || null,
          work_type: workStyle || null,
          daily_work_hours: dailyWorkHours === '' ? null : dailyWorkHours,
          home_to_work_km: commuteDistance === '' ? null : commuteDistance,
          salary_range: salaryRange || null,
          education_level: education || null,
          interests: toArray(interests),
          favorite_music: toArray(musicGenres),
          favorite_genres: toArray(filmGenres),
          monthly_budget: monthlyBudget === '' ? null : monthlyBudget,
          savings_goal: savingsGoal === '' ? null : savingsGoal,
          financial_goal: financialGoal || null,
          short_term_goal: shortTermGoal || null,
          long_term_goal: longTermGoal || null,
          motivation_type: motivationPref || null,
          ai_personality: aiPersonalityPersist,
        }, { onConflict: 'user_id' }),
      ]);

      if (usersRes.error || profilesRes.error) {
        console.error('save errors', usersRes.error, profilesRes.error);
        toast.error(t('profile.toast_error'));
      } else {
        toast.success(t('profile.toast_updated'));
      }
    } catch (err) {
      console.error('handleSave', err);
      toast.error(t('profile.toast_error'));
    } finally {
      setSaving(false);
    }
  }, [
    fullName, birthDate, gender, weight, height, bloodType,
    chronicDisease, chronicDiseaseText, medication, medicationText,
    smoking, alcohol, waterGoal, sleepGoal, activityLevel, dietPrefs,
    doesSport, sportGoal, doesMeditation, maritalStatus, childCount,
    hasPet, petType, livesWith, workStatus, profession, workStyle,
    dailyWorkHours, commuteDistance, salaryRange, education,
    interests, musicGenres, filmGenres, monthlyBudget, savingsGoal,
    financialGoal, shortTermGoal, longTermGoal, motivationPref, t, userId,
  ]);

  // ─── Initials for avatar ─────────────────────────────────────────────────────
  const initials = useMemo(() => {
    const parts = fullName.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    if (parts[0]) return parts[0].slice(0, 2).toUpperCase();
    return 'ZK';
  }, [fullName]);

  if (pageLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{t('profile.loading')}</p>
      </div>
    );
  }

  return (
    <div className="pb-32 w-full animate-fade-in">
      <div className="flex items-center justify-between p-4">
        <h1 className="text-lg font-semibold">{t('profile.title')}</h1>
        <div className="flex gap-3">
          <button type="button" onClick={() => navigate('/friends')} className="p-2 rounded-full active:bg-muted" aria-label={t('friends.title')}>
            <Users size={22} className="text-gray-600" />
          </button>
          <button type="button" onClick={() => navigate('/settings')} className="p-2 rounded-full active:bg-muted" aria-label={t('settings.title')}>
            <Settings size={22} className="text-gray-600" />
          </button>
        </div>
      </div>

      {/* Avatar */}
      <div className="flex flex-col items-center mb-4">
        <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-2xl font-bold mb-2 relative">
          {initials}
          <button className="absolute -bottom-1 -right-1 w-7 h-7 bg-card border border-border rounded-full flex items-center justify-center">
            <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>
        <h2 className="font-semibold">{fullName || 'Zeeky'}</h2>
        {userEmail && <p className="text-xs text-muted-foreground">{userEmail}</p>}
      </div>

      {/* Completion Bar */}
      <div className="mx-4 mb-4 bg-card border border-border rounded-2xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold">{t('profile.completion_score', { score: profileScore })}</span>
        </div>
        <Progress value={profileScore} className="h-2.5" />
        <p className="text-[11px] text-muted-foreground mt-2">
          {t(`profile.completion.${completionTier(profileScore)}`)}
        </p>
      </div>

      <div className="px-4 space-y-3">
        {/* Basic Info */}
        <ExpandableSection title={t('profile.basic_info')} defaultOpen>
          <FieldText label={t('profile.fields.full_name')} value={fullName} onChange={setFullName} placeholder={t('auth.name_placeholder')} />
          <FieldDate label={t('profile.birth_date')} value={birthDate} onChange={setBirthDate} />
          <SegmentedSelector label={t('profile.gender')} options={['Erkek', 'Kadın', 'Belirtmiyorum']} value={gender} onChange={setGender} translate={genderTranslate} />
        </ExpandableSection>

        {/* Health */}
        <ExpandableSection title={t('profile.health')}>
          <div className="grid grid-cols-2 gap-3">
            <FieldNumber label={t('profile.fields.weight')} value={weight} onChange={setWeight} suffix="kg" min={30} max={300} />
            <FieldNumber label={t('profile.fields.height')} value={height} onChange={setHeight} suffix="cm" min={100} max={250} />
          </div>
          {bmi && (
            <div className="bg-muted rounded-xl px-3 py-2.5 flex justify-between items-center">
              <span className="text-xs text-muted-foreground">{t('profile.fields.bmi')}</span>
              <span className="text-sm font-bold">{bmi}</span>
            </div>
          )}
          <FieldSelect label={t('profile.fields.blood_type')} value={bloodType} onChange={setBloodType} options={bloodTypeOptions} placeholder={t('profile.select_placeholder')} />
          <FieldToggle label={t('profile.fields.chronic_disease')} value={chronicDisease} onChange={setChronicDisease} />
          {chronicDisease && <FieldText label={t('profile.fields.disease_detail')} value={chronicDiseaseText} onChange={setChronicDiseaseText} />}
          <FieldToggle label={t('profile.fields.medication_toggle')} value={medication} onChange={setMedication} />
          {medication && <FieldText label={t('profile.fields.medication_detail')} value={medicationText} onChange={setMedicationText} />}
          <FieldSelect label={t('profile.fields.smoking')} value={smoking} onChange={setSmoking} options={smokingOptions} placeholder={t('profile.select_placeholder')} />
          <FieldSelect label={t('profile.fields.alcohol')} value={alcohol} onChange={setAlcohol} options={alcoholOptions} placeholder={t('profile.select_placeholder')} />
          <div className="grid grid-cols-2 gap-3">
            <FieldNumber label={t('profile.fields.water_goal')} value={waterGoal} onChange={setWaterGoal} suffix={t('profile.fields.liters')} min={0} max={10} />
            <FieldNumber label={t('profile.fields.sleep_goal')} value={sleepGoal} onChange={setSleepGoal} suffix={t('profile.fields.hours')} min={4} max={12} />
          </div>
        </ExpandableSection>

        {/* Lifestyle */}
        <ExpandableSection title={t('profile.lifestyle')}>
          <SegmentedSelector label={t('profile.activity_level')} options={['Hareketsiz', 'Az Aktif', 'Orta', 'Çok Aktif']} value={activityLevel} onChange={setActivityLevel} translate={getActivityLevel} />
          <MultiChips label={t('profile.fields.diet')} options={dietChipOptions} selected={dietPrefs} onChange={setDietPrefs} />
          <FieldToggle label={t('profile.fields.sport_toggle')} value={doesSport} onChange={setDoesSport} />
          {doesSport && <FieldNumber label={t('profile.fields.weekly_sport')} value={sportGoal} onChange={setSportGoal} suffix={t('profile.days')} min={1} max={7} />}
          <FieldToggle label={t('profile.fields.meditation')} value={doesMeditation} onChange={setDoesMeditation} />
        </ExpandableSection>

        {/* Social */}
        <ExpandableSection title={t('profile.social')}>
          <FieldSelect label={t('profile.fields.relationship')} value={maritalStatus} onChange={setMaritalStatus} options={relationshipOptions} placeholder={t('profile.select_placeholder')} />
          <FieldNumber label={t('profile.fields.children_count')} value={childCount} onChange={setChildCount} min={0} max={20} />
          <FieldToggle label={t('profile.fields.has_pet')} value={hasPet} onChange={setHasPet} />
          {hasPet && <FieldText label={t('profile.fields.pet_type')} value={petType} onChange={setPetType} />}
          <MultiChips label={t('profile.fields.lives_with')} options={livesWithOptions} selected={livesWith} onChange={setLivesWith} />
        </ExpandableSection>

        {/* Work */}
        <ExpandableSection title={t('profile.work')}>
          <FieldSelect label={t('profile.fields.work_status')} value={workStatus} onChange={setWorkStatus} options={workStatusOptions} placeholder={t('profile.select_placeholder')} />
          <FieldText label={t('profile.fields.profession')} value={profession} onChange={setProfession} placeholder={t('finance.form.title_placeholder')} />
          <SegmentedSelector label={t('profile.fields.work_type')} options={['Ofis', 'Uzaktan', 'Hibrit', 'Saha']} value={workStyle} onChange={setWorkStyle} translate={workStyleTranslate} />
          <div className="grid grid-cols-2 gap-3">
            <FieldNumber label={t('profile.fields.daily_work_hours')} value={dailyWorkHours} onChange={setDailyWorkHours} suffix={t('profile.fields.hours')} min={1} max={16} />
            <FieldNumber label={t('profile.fields.home_to_work')} value={commuteDistance} onChange={setCommuteDistance} suffix="km" min={0} max={200} />
          </div>
          <FieldSelect
            label={t('profile.fields.salary_range')}
            value={salaryRange}
            onChange={setSalaryRange}
            options={salaryRangeOptions}
            placeholder={t('profile.select_placeholder')}
          />
          <FieldSelect label={t('profile.fields.education')} value={education} onChange={setEducation} options={educationOptions} placeholder={t('profile.select_placeholder')} />
        </ExpandableSection>

        {/* Interests */}
        <ExpandableSection title={t('profile.interests')}>
          <MultiChips label={t('profile.fields.interests')} options={interestChipOptions} selected={interests} onChange={setInterests} />
          <MultiChips label={t('profile.fields.favorite_music')} options={musicGenreOptions} selected={musicGenres} onChange={setMusicGenres} />
          <MultiChips label={t('profile.fields.favorite_film')} options={filmGenreOptions} selected={filmGenres} onChange={setFilmGenres} />
        </ExpandableSection>

        {/* Financial */}
        <ExpandableSection title={t('profile.financial')}>
          <FieldNumber label={t('profile.fields.budget_target')} value={monthlyBudget} onChange={setMonthlyBudget} suffix={currencySymbolState} />
          <FieldNumber label={t('profile.fields.savings_target')} value={savingsGoal} onChange={setSavingsGoal} suffix={`${currencySymbolState}/ay`} />
          <FieldText label={t('profile.fields.financial_goal')} value={financialGoal} onChange={setFinancialGoal} />
        </ExpandableSection>

        {/* Goals */}
        <ExpandableSection title={t('profile.goals')}>
          <FieldTextArea label={t('profile.fields.short_term_goal')} value={shortTermGoal} onChange={setShortTermGoal} />
          <FieldTextArea label={t('profile.fields.long_term_goal')} value={longTermGoal} onChange={setLongTermGoal} />
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">{t('profile.motivation')}</p>
            <div className="space-y-2">
              {[
                { value: 'positive',  descKey: 'profile.motivation_positive_desc' },
                { value: 'realistic', descKey: 'profile.motivation_realistic_desc' },
                { value: 'challenge', descKey: 'profile.motivation_challenge_desc' },
                { value: 'calm',      descKey: 'profile.motivation_calm_desc' },
              ].map(m => (
                <button
                  key={m.value}
                  type="button"
                  onClick={async () => {
                    setMotivationPref(m.value);
                    await supabase
                      .from('user_profiles')
                      .update({ motivation_type: m.value })
                      .eq('user_id', userId);
                  }}
                  className={`w-full flex items-center gap-3 p-4 rounded-2xl border transition-colors text-left ${
                    motivationPref === m.value
                      ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-400'
                      : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-600'
                  }`}
                >
                  <div className="flex-1">
                    <p className={`font-medium text-sm ${
                      motivationPref === m.value
                        ? 'text-blue-700 dark:text-blue-300'
                        : 'text-gray-800 dark:text-gray-200'
                    }`}>{getMotivationType(m.value)}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t(m.descKey)}</p>
                  </div>
                  {motivationPref === m.value && (
                    <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-xs">✓</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </ExpandableSection>

        <button
          type="button"
          onClick={async () => {
            await signOut();
            navigate('/auth');
          }}
          className="w-full py-3 mt-6 text-red-500 border border-red-200 rounded-2xl font-medium"
        >
          {t('profile.sign_out')}
        </button>
      </div>

      {/* Save Button */}
      <div className="fixed bottom-20 left-1/2 -translate-x-1/2 w-full px-4 pointer-events-none">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3.5 bg-primary text-primary-foreground rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-transform disabled:opacity-60 pointer-events-auto"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? t('profile.saving') : t('profile.save')}
        </button>
      </div>
    </div>
  );
}
