import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Settings, ChevronDown, ChevronUp, Plus, Pencil, Save, Loader2 } from 'lucide-react';
import { signOut } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { getCurrencySymbol } from '@/lib/currency';
import { useCurrencyStore } from '@/store/useCurrencyStore';
import { useAuthStore } from '@/store/useAuthStore';

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

function FieldSelect({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1 block">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-muted rounded-xl px-3 py-2.5 text-sm outline-none border border-border focus:border-accent transition-colors appearance-none"
      >
        <option value="">Seçiniz</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
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

function SegmentedSelector({ label, options, value, onChange }: {
  label: string; options: string[]; value: string; onChange: (v: string) => void;
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
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

function MultiChips({ label, options, selected, onChange }: {
  label: string; options: string[]; selected: string[]; onChange: (v: string[]) => void;
}) {
  const toggle = (o: string) => {
    onChange(selected.includes(o) ? selected.filter(s => s !== o) : [...selected, o]);
  };
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{label}</label>
      <div className="flex flex-wrap gap-1.5">
        {options.map(o => (
          <button
            key={o}
            onClick={() => toggle(o)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
              selected.includes(o) ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"
            )}
          >
            {o}
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
        if (u.gender) setGender(u.gender);
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
        if (p.is_smoker) setSmoking(p.is_smoker);
        if (p.alcohol_use) setAlcohol(p.alcohol_use);
        if (p.water_goal != null) setWaterGoal(p.water_goal);
        if (p.sleep_goal != null) setSleepGoal(p.sleep_goal);
        if (p.activity_level) setActivityLevel(p.activity_level);
        if (p.diet_type != null) setDietPrefs(Array.isArray(p.diet_type) ? p.diet_type : p.diet_type ? [p.diet_type] : []);
        if (p.does_sport != null) setDoesSport(!!p.does_sport);
        if (p.weekly_sport_goal != null) setSportGoal(p.weekly_sport_goal);
        if (p.does_meditation != null) setDoesMeditation(!!p.does_meditation);
        if (p.relationship_status) setMaritalStatus(p.relationship_status);
        if (p.children_count != null) setChildCount(p.children_count);
        if (p.has_pet != null) setHasPet(!!p.has_pet);
        if (p.lives_with != null) setLivesWith(Array.isArray(p.lives_with) ? p.lives_with : p.lives_with ? [p.lives_with] : []);
        if (p.employment_type) setWorkStatus(p.employment_type);
        if (p.profession) setProfession(p.profession);
        if (p.work_type) setWorkStyle(p.work_type);
        if (p.daily_work_hours != null) setDailyWorkHours(p.daily_work_hours);
        if (p.home_to_work_km != null) setCommuteDistance(p.home_to_work_km);
        if (p.salary_range) setSalaryRange(p.salary_range);
        if (p.education_level) setEducation(p.education_level);
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
        toast.error('Bir hata oluştu');
      } else {
        toast.success('Profil güncellendi ✅');
      }
    } catch (err) {
      console.error('handleSave', err);
      toast.error('Bir hata oluştu');
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
    financialGoal, shortTermGoal, longTermGoal, motivationPref,
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
        <p className="text-sm text-muted-foreground">Profil yükleniyor…</p>
      </div>
    );
  }

  return (
    <div className="pb-32 w-full animate-fade-in">
      <div className="flex items-center justify-between p-4">
        <h1 className="text-lg font-semibold">Bilgilerim</h1>
        <div className="flex gap-3">
          <button type="button" onClick={() => navigate('/friends')} className="p-2 rounded-full active:bg-muted" aria-label="Arkadaşlar">
            <Users size={22} className="text-gray-600" />
          </button>
          <button type="button" onClick={() => navigate('/settings')} className="p-2 rounded-full active:bg-muted" aria-label="Ayarlar">
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
        <h2 className="font-semibold">{fullName || 'Kullanıcı'}</h2>
        {userEmail && <p className="text-xs text-muted-foreground">{userEmail}</p>}
      </div>

      {/* Completion Bar */}
      <div className="mx-4 mb-4 bg-card border border-border rounded-2xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold">Profil Tamamlanma: %{profileScore}</span>
        </div>
        <Progress value={profileScore} className="h-2.5" />
        <p className="text-[11px] text-muted-foreground mt-2">
          {profileScore < 50
            ? 'Daha fazla bilgi = daha iyi yapay zeka koçluğu! 🎯'
            : profileScore < 80
            ? 'İyi gidiyorsun! Birkaç alan daha doldurarak daha kişisel öneriler al. ✨'
            : 'Harika! Profilin neredeyse tam, en iyi önerileri alacaksın! 🚀'}
        </p>
      </div>

      <div className="px-4 space-y-3">
        {/* Basic Info */}
        <ExpandableSection title="Temel Bilgiler" defaultOpen>
          <FieldText label="Ad Soyad" value={fullName} onChange={setFullName} placeholder="Adın ve soyadın" />
          <FieldDate label="Doğum Tarihi" value={birthDate} onChange={setBirthDate} />
          <SegmentedSelector label="Cinsiyet" options={['Erkek', 'Kadın', 'Diğer']} value={gender} onChange={setGender} />
        </ExpandableSection>

        {/* Health */}
        <ExpandableSection title="🏥 Sağlık & Vücut">
          <div className="grid grid-cols-2 gap-3">
            <FieldNumber label="Kilo" value={weight} onChange={setWeight} suffix="kg" min={30} max={300} />
            <FieldNumber label="Boy" value={height} onChange={setHeight} suffix="cm" min={100} max={250} />
          </div>
          {bmi && (
            <div className="bg-muted rounded-xl px-3 py-2.5 flex justify-between items-center">
              <span className="text-xs text-muted-foreground">BMI</span>
              <span className="text-sm font-bold">{bmi}</span>
            </div>
          )}
          <FieldSelect label="Kan Grubu" value={bloodType} onChange={setBloodType} options={['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', '0+', '0-']} />
          <FieldToggle label="Kronik hastalık var mı?" value={chronicDisease} onChange={setChronicDisease} />
          {chronicDisease && <FieldText label="Hastalık Detayı" value={chronicDiseaseText} onChange={setChronicDiseaseText} placeholder="Ör: Diyabet" />}
          <FieldToggle label="Düzenli ilaç kullanıyor musun?" value={medication} onChange={setMedication} />
          {medication && <FieldText label="İlaç Detayı" value={medicationText} onChange={setMedicationText} placeholder="Ör: Tansiyon ilacı" />}
          <FieldSelect label="Sigara Kullanımı" value={smoking} onChange={setSmoking} options={['Kullanmıyorum', 'Bıraktım', 'Günde 1-5', 'Günde 6-20', '20+']} />
          <FieldSelect label="Alkol Kullanımı" value={alcohol} onChange={setAlcohol} options={['Kullanmıyorum', 'Sosyal', 'Düzenli']} />
          <div className="grid grid-cols-2 gap-3">
            <FieldNumber label="Su Hedefi" value={waterGoal} onChange={setWaterGoal} suffix="lt" min={0} max={10} />
            <FieldNumber label="Uyku Hedefi" value={sleepGoal} onChange={setSleepGoal} suffix="saat" min={4} max={12} />
          </div>
        </ExpandableSection>

        {/* Lifestyle */}
        <ExpandableSection title="🏃 Yaşam Tarzı">
          <SegmentedSelector label="Aktivite Seviyesi" options={['Hareketsiz', 'Az Aktif', 'Orta', 'Çok Aktif']} value={activityLevel} onChange={setActivityLevel} />
          <MultiChips label="Beslenme Tercihi" options={['Omnivore', 'Vejetaryen', 'Vegan', 'Glutensiz', 'Laktozsuz']} selected={dietPrefs} onChange={setDietPrefs} />
          <FieldToggle label="Spor yapıyor musun?" value={doesSport} onChange={setDoesSport} />
          {doesSport && <FieldNumber label="Haftalık Spor Hedefi" value={sportGoal} onChange={setSportGoal} suffix="gün" min={1} max={7} />}
          <FieldToggle label="Meditasyon/mindfulness yapıyor musun?" value={doesMeditation} onChange={setDoesMeditation} />
        </ExpandableSection>

        {/* Social */}
        <ExpandableSection title="👨‍👩‍👧‍👦 Sosyal & Aile">
          <FieldSelect label="Medeni Durum" value={maritalStatus} onChange={setMaritalStatus} options={['Bekar', 'Evli', 'Boşanmış', 'İlişkide']} />
          <FieldNumber label="Çocuk Sayısı" value={childCount} onChange={setChildCount} min={0} max={20} />
          <FieldToggle label="Evcil hayvan var mı?" value={hasPet} onChange={setHasPet} />
          {hasPet && <FieldText label="Evcil Hayvan Türü" value={petType} onChange={setPetType} placeholder="Ör: Kedi" />}
          <MultiChips label="Birlikte Yaşadıkları" options={['Yalnız', 'Eş/Partner', 'Çocuklar', 'Aile', 'Arkadaşlar']} selected={livesWith} onChange={setLivesWith} />
        </ExpandableSection>

        {/* Work */}
        <ExpandableSection title="💼 İş & Eğitim">
          <FieldSelect label="Çalışma Durumu" value={workStatus} onChange={setWorkStatus} options={['Çalışıyor', 'Öğrenci', 'Her ikisi', 'Çalışmıyor']} />
          <FieldText label="Meslek / Sektör" value={profession} onChange={setProfession} placeholder="Ör: Yazılım Mühendisi" />
          <SegmentedSelector label="Çalışma Şekli" options={['Ofis', 'Uzaktan', 'Hibrit']} value={workStyle} onChange={setWorkStyle} />
          <div className="grid grid-cols-2 gap-3">
            <FieldNumber label="Günlük Çalışma" value={dailyWorkHours} onChange={setDailyWorkHours} suffix="saat" min={1} max={16} />
            <FieldNumber label="Ev-İş Mesafe" value={commuteDistance} onChange={setCommuteDistance} suffix="km" min={0} max={200} />
          </div>
          <FieldSelect
            label="Maaş Aralığı"
            value={salaryRange}
            onChange={setSalaryRange}
            options={
              (currency === 'TRY'
                ? ['0-15.000', '15.000-25.000', '25.000-40.000', '40.000-60.000', '60.000-100.000', '100.000+']
                : ['0-1.000', '1.000-2.000', '2.000-3.500', '3.500-5.000', '5.000-8.000', '8.000+']
              ).map(r => `${r} ${currencySymbolState}`)
            }
          />
          <FieldSelect label="Eğitim Seviyesi" value={education} onChange={setEducation} options={['İlköğretim', 'Lise', 'Önlisans', 'Lisans', 'Yüksek Lisans', 'Doktora']} />
        </ExpandableSection>

        {/* Interests */}
        <ExpandableSection title="🎯 İlgi Alanları & Hobiler">
          <MultiChips label="İlgi Alanları" options={['Müzik', 'Spor', 'Sinema', 'Kitap', 'Seyahat', 'Yemek', 'Teknoloji', 'Sanat', 'Doğa', 'Oyun', 'Fotoğraf', 'Dans']} selected={interests} onChange={setInterests} />
          <MultiChips label="Favori Müzik Türleri" options={['Pop', 'Rock', 'Jazz', 'Klasik', 'Hip-Hop', 'Elektronik', 'R&B', 'Türkçe Pop']} selected={musicGenres} onChange={setMusicGenres} />
          <MultiChips label="Favori Film/Dizi Türleri" options={['Aksiyon', 'Komedi', 'Drama', 'Bilim Kurgu', 'Korku', 'Romantik', 'Belgesel', 'Animasyon']} selected={filmGenres} onChange={setFilmGenres} />
        </ExpandableSection>

        {/* Financial */}
        <ExpandableSection title="💰 Finansal Hedefler">
          <FieldNumber label="Aylık Bütçe Hedefi" value={monthlyBudget} onChange={setMonthlyBudget} suffix={currencySymbolState} />
          <FieldNumber label="Tasarruf Hedefi" value={savingsGoal} onChange={setSavingsGoal} suffix={`${currencySymbolState}/ay`} />
          <FieldText label="Finansal Hedef" value={financialGoal} onChange={setFinancialGoal} placeholder="Ör: 1 yılda araba almak" />
        </ExpandableSection>

        {/* Goals */}
        <ExpandableSection title="🎯 Kişisel Hedefler">
          <FieldTextArea label="Kısa Vadeli Hedef" value={shortTermGoal} onChange={setShortTermGoal} placeholder="Ör: Bu ay 4 kez spor yapmak" />
          <FieldTextArea label="Uzun Vadeli Hedef" value={longTermGoal} onChange={setLongTermGoal} placeholder="Ör: 1 yılda İngilizce öğrenmek" />
          <FieldSelect label="Günlük Motivasyon Tercihi" value={motivationPref} onChange={setMotivationPref} options={['Pozitif öneriler', 'Zorlu hedefler', 'Dengeli yaklaşım']} />
        </ExpandableSection>

        {/* Income / Expense definitions (static) */}
        <ExpandableSection title="Gelir & Gider Tanımları">
          <div className="space-y-2">
            {[`Maaş - 30.000 ${currencySymbolState}`, `Kira - 8.500 ${currencySymbolState}`, `Market - ~3.000 ${currencySymbolState}`].map(item => (
              <div key={item} className="flex items-center justify-between bg-muted rounded-xl px-3 py-2.5">
                <span className="text-sm">{item}</span>
                <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
            ))}
            <button className="w-full flex items-center justify-center gap-1.5 py-2.5 border border-dashed border-border rounded-xl text-sm text-primary font-medium active:scale-95">
              <Plus className="w-4 h-4" /> Ekle
            </button>
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
          Çıkış Yap
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
          {saving ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
      </div>
    </div>
  );
}
