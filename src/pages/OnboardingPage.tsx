import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { useCurrencyStore } from '@/store/useCurrencyStore';
import { supabase } from '@/lib/supabase';
import { useTranslation } from 'react-i18next';
import { useLanguageStore } from '@/store/useLanguageStore';

type FormData = {
  full_name: string;
  birth_date: string;
  gender: string;
  weight: string;
  height: string;
  is_smoker: string;
  alcohol_use: string;
  sleep_goal: string;
  employment_type: string;
  profession: string;
  activity_level: string;
  weekly_sport_goal: string;
  relationship_status: string;
  children_count: string;
  has_children: boolean;
  lives_with: string[];
  currency: string;
  currency_symbol: string;
  salary_range: string;
  monthly_budget: string;
  savings_goal: string;
  education_level: string;
  interests: string[];
  short_term_goal: string;
  long_term_goal: string;
  ai_personality: string;
  motivation_type: string;
};

const TOTAL_STEPS = 7;

const SMOKING_OPTS: { value: string; key: 'not_smoking' | 'quit_smoking' | 'smoking_1_5' | 'smoking_6plus' }[] = [
  { value: 'Kullanmıyorum', key: 'not_smoking' },
  { value: 'Bıraktım', key: 'quit_smoking' },
  { value: 'Günde 1-5', key: 'smoking_1_5' },
  { value: 'Günde 6+', key: 'smoking_6plus' },
];

const ALCOHOL_OPTS: { value: string; key: 'not_drinking' | 'social_drinking' | 'regular_drinking' }[] = [
  { value: 'Kullanmıyorum', key: 'not_drinking' },
  { value: 'Sosyal', key: 'social_drinking' },
  { value: 'Düzenli', key: 'regular_drinking' },
];

const WORK_OPTS: { value: string; key: 'working' | 'student' | 'both' | 'not_working' }[] = [
  { value: 'Çalışıyor', key: 'working' },
  { value: 'Öğrenci', key: 'student' },
  { value: 'Her ikisi', key: 'both' },
  { value: 'Çalışmıyor', key: 'not_working' },
];

const ACTIVITY_OPTS: { value: string; key: 'sedentary' | 'lightly_active' | 'moderate' | 'very_active' }[] = [
  { value: 'Hareketsiz', key: 'sedentary' },
  { value: 'Az Aktif', key: 'lightly_active' },
  { value: 'Orta', key: 'moderate' },
  { value: 'Çok Aktif', key: 'very_active' },
];

const EDUCATION_OPTS: { value: string; key: 'primary' | 'high_school' | 'associate' | 'bachelor' | 'master' | 'phd' }[] = [
  { value: 'İlköğretim', key: 'primary' },
  { value: 'Lise', key: 'high_school' },
  { value: 'Ön Lisans', key: 'associate' },
  { value: 'Lisans', key: 'bachelor' },
  { value: 'Yüksek Lisans', key: 'master' },
  { value: 'Doktora', key: 'phd' },
];

const RELATIONSHIP_OPTS: { value: string; key: 'single' | 'married' | 'together' | 'divorced' }[] = [
  { value: 'Bekar', key: 'single' },
  { value: 'Evli', key: 'married' },
  { value: 'Birlikte', key: 'together' },
  { value: 'Boşanmış', key: 'divorced' },
];

const LIVES_WITH_OPTS: { value: string; key: 'alone' | 'with_partner' | 'with_children' | 'with_family' | 'with_friends' }[] = [
  { value: 'Yalnız', key: 'alone' },
  { value: 'Eş/Partner', key: 'with_partner' },
  { value: 'Çocuklar', key: 'with_children' },
  { value: 'Aile', key: 'with_family' },
  { value: 'Arkadaşlar', key: 'with_friends' },
];

const GENDER_OPTS: { value: string; key: 'male' | 'female' | 'not_specified' }[] = [
  { value: 'Erkek', key: 'male' },
  { value: 'Kadın', key: 'female' },
  { value: 'Belirtmiyorum', key: 'not_specified' },
];

const inputCls =
  'w-full border border-gray-200 dark:border-gray-600 rounded-2xl px-4 py-3 text-sm bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-blue-400';

const optionBtn = (active: boolean) =>
  `py-3 rounded-2xl text-sm font-medium border transition-colors ${
    active
      ? 'bg-blue-600 text-white border-blue-600'
      : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600'
  }`;

export default function OnboardingPage() {
  const { t } = useTranslation();
  const { language, setLanguage } = useLanguageStore();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { setCurrency } = useCurrencyStore();
  const userId = user?.id ?? '';

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    full_name: '',
    birth_date: '',
    gender: '',
    weight: '',
    height: '',
    is_smoker: 'Kullanmıyorum',
    alcohol_use: 'Kullanmıyorum',
    sleep_goal: '8',
    employment_type: '',
    profession: '',
    activity_level: 'Orta',
    weekly_sport_goal: '3',
    relationship_status: '',
    children_count: '0',
    has_children: false,
    lives_with: [],
    currency: 'EUR',
    currency_symbol: '€',
    salary_range: '',
    monthly_budget: '',
    savings_goal: '',
    education_level: '',
    interests: [],
    short_term_goal: '',
    long_term_goal: '',
    ai_personality: 'balanced',
    motivation_type: '',
  });

  const update = (patch: Partial<FormData>) =>
    setFormData(prev => ({ ...prev, ...patch }));

  const interestOptions = useMemo(
    () => [
      { value: 'Spor', label: t('profile.options.sports') },
      { value: 'Müzik', label: t('profile.options.music') },
      { value: 'Sinema', label: t('profile.options.cinema') },
      { value: 'Kitap', label: t('profile.options.books') },
      { value: 'Seyahat', label: t('profile.options.travel') },
      { value: 'Yemek', label: t('profile.options.food') },
      { value: 'Teknoloji', label: t('profile.options.technology') },
      { value: 'Sanat', label: t('profile.options.art') },
      { value: 'Oyun', label: t('profile.options.gaming') },
      { value: 'Doğa', label: t('profile.options.nature') },
      { value: 'Dans', label: t('profile.options.dance') },
      { value: 'Fotoğraf', label: t('profile.options.photography') },
    ],
    [t],
  );

  useEffect(() => {
    if (!userId) return;
    const loadUserData = async () => {
      const { data: userData } = await supabase
        .from('users')
        .select('full_name, birth_date, gender, currency, currency_symbol')
        .eq('id', userId)
        .single();

      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (userData) {
        const rawGender = (userData.gender as string) || '';
        const normalizedGender =
          rawGender === 'Belirtmek istemiyorum' || rawGender === 'Diğer' ? 'Belirtmiyorum' : rawGender;
        setFormData(prev => ({
          ...prev,
          full_name: (userData.full_name as string) || '',
          birth_date: (userData.birth_date as string) || '',
          gender: normalizedGender,
          currency: (userData.currency as string) || 'EUR',
          currency_symbol: (userData.currency_symbol as string) || '€',
        }));
      }

      if (profileData) {
        setFormData(prev => ({
          ...prev,
          weight: profileData.weight != null ? String(profileData.weight) : '',
          height: profileData.height != null ? String(profileData.height) : '',
          is_smoker: (profileData.is_smoker as string) || 'Kullanmıyorum',
          alcohol_use: (profileData.alcohol_use as string) || 'Kullanmıyorum',
          sleep_goal: profileData.sleep_goal != null ? String(profileData.sleep_goal) : '8',
          employment_type: (profileData.employment_type as string) || '',
          profession: (profileData.profession as string) || '',
          activity_level: (profileData.activity_level as string) || 'Orta',
          weekly_sport_goal: profileData.weekly_sport_goal != null ? String(profileData.weekly_sport_goal) : '3',
          relationship_status: (profileData.relationship_status as string) || '',
          has_children: (profileData.has_children as boolean) || false,
          children_count: profileData.children_count != null ? String(profileData.children_count) : '0',
          lives_with: (profileData.lives_with as string[]) || [],
          monthly_budget: profileData.monthly_budget != null ? String(profileData.monthly_budget) : '',
          savings_goal: profileData.savings_goal != null ? String(profileData.savings_goal) : '',
          education_level: (profileData.education_level as string) || '',
          interests: (profileData.interests as string[]) || [],
          short_term_goal: (profileData.short_term_goal as string) || '',
          long_term_goal: (profileData.long_term_goal as string) || '',
          ai_personality: (profileData.ai_personality as string) || 'balanced',
          motivation_type: (profileData.motivation_type as string) || '',
        }));
      }
    };
    void loadUserData();
  }, [userId]);

  const saveStep = async (stepData: {
    users?: Record<string, unknown>;
    user_profiles?: Record<string, unknown>;
  }) => {
    try {
      if (stepData.users) {
        const { error } = await supabase
          .from('users')
          .update(stepData.users)
          .eq('id', userId);
        if (error) console.error('Users save error:', error);
      }
      if (stepData.user_profiles) {
        const { error } = await supabase
          .from('user_profiles')
          .upsert({ user_id: userId, ...stepData.user_profiles }, { onConflict: 'user_id' });
        if (error) console.error('Profile save error:', error);
      }
    } catch (err) {
      console.error('Save error:', err);
    }
  };

  const handleNext = async () => {
    setSaving(true);
    try {
      if (step === 2) {
        if (!formData.full_name.trim()) {
          alert(t('onboarding.basic.full_name_required'));
          return;
        }
        await saveStep({
          users: {
            full_name: formData.full_name,
            birth_date: formData.birth_date || null,
            gender: formData.gender || null,
          },
        });
      }

      if (step === 3) {
        await saveStep({
          user_profiles: {
            weight: formData.weight ? Number(formData.weight) : null,
            height: formData.height ? Number(formData.height) : null,
            is_smoker: formData.is_smoker,
            alcohol_use: formData.alcohol_use,
            sleep_goal: Number(formData.sleep_goal),
          },
        });
      }

      if (step === 4) {
        await saveStep({
          user_profiles: {
            employment_type: formData.employment_type || null,
            profession: formData.profession || null,
            education_level: formData.education_level || null,
            activity_level: formData.activity_level,
            weekly_sport_goal: Number(formData.weekly_sport_goal),
            does_sport: Number(formData.weekly_sport_goal) > 0,
          },
        });
      }

      if (step === 5) {
        await saveStep({
          user_profiles: {
            relationship_status: formData.relationship_status || null,
            has_children: formData.has_children,
            children_count: Number(formData.children_count),
            lives_with: formData.lives_with,
          },
        });
      }

      if (step === 6) {
        await saveStep({
          users: {
            currency: formData.currency,
            currency_symbol: formData.currency_symbol,
          },
          user_profiles: {
            salary_range: formData.salary_range || null,
            monthly_budget: formData.monthly_budget
              ? Number(formData.monthly_budget)
              : null,
            savings_goal: formData.savings_goal
              ? Number(formData.savings_goal)
              : null,
          },
        });
      }

      if (step === 7) {
        await saveStep({
          user_profiles: {
            interests: formData.interests,
            short_term_goal: formData.short_term_goal || null,
            long_term_goal: formData.long_term_goal || null,
            ai_personality: formData.ai_personality,
            motivation_type: formData.motivation_type || null,
          },
        });
        await supabase
          .from('users')
          .update({ onboarding_completed: true })
          .eq('id', userId);
        setCurrency(formData.currency, formData.currency_symbol);
        navigate('/');
        return;
      }

      setStep(s => s + 1);
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => setStep(s => s + 1);

  // ── Steps ─────────────────────────────────────────────────────────────────

  const renderStep1 = () => (
    <div className="flex flex-col items-center justify-center h-full text-center py-8">
      <div className="w-24 h-24 rounded-3xl bg-blue-600 flex items-center justify-center mb-8 shadow-lg shadow-blue-200">
        <span className="text-4xl font-bold text-white">Z</span>
      </div>
      <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-4">{t('onboarding.welcome_title')}</h1>
      <p className="text-lg text-gray-500 dark:text-gray-400 mb-2">
        {t('onboarding.welcome_subtitle')}
      </p>
      <p className="text-gray-500 dark:text-gray-400 leading-relaxed mb-10 max-w-xs">
        {t('onboarding.welcome_desc')}
      </p>
      <div className="space-y-3 w-full max-w-xs mb-10">
        {[
          { icon: '🎯', text: t('onboarding.features.personalized') },
          { icon: '📊', text: t('onboarding.features.tracking') },
          { icon: '💰', text: t('onboarding.features.financial') },
          { icon: '❤️', text: t('onboarding.features.health') },
        ].map((item, i) => (
          <div
            key={i}
            className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800 rounded-2xl px-4 py-3"
          >
            <span className="text-xl">{item.icon}</span>
            <span className="text-sm text-gray-700 dark:text-gray-300">{item.text}</span>
          </div>
        ))}
      </div>
      <button
        onClick={() => setStep(2)}
        className="w-full max-w-xs py-4 bg-blue-600 text-white rounded-2xl font-semibold text-base active:scale-95 transition-transform shadow-lg shadow-blue-200"
      >
        {t('onboarding.start')}
      </button>
      <p className="text-xs text-gray-400 mt-4">{t('onboarding.can_change_later')}</p>
      <div className="flex justify-center flex-wrap gap-2 mt-4 max-w-sm mx-auto">
        <p className="text-xs text-gray-400 mr-2 self-center">
          {t('onboarding.select_language')}:
        </p>
        {[
          { code: 'tr', label: 'TR', flag: '🇹🇷' },
          { code: 'en', label: 'EN', flag: '🇺🇸' },
          { code: 'fr', label: 'FR', flag: '🇫🇷' },
        ].map(lang => (
          <button
            key={lang.code}
            type="button"
            onClick={() => void setLanguage(lang.code, userId || undefined)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium border transition-colors ${
              language === lang.code
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600'
            }`}
          >
            <span>{lang.flag}</span>
            <span>{lang.label}</span>
          </button>
        ))}
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">
        {t('onboarding.basic.title')}
      </h2>
      <p className="text-gray-500 dark:text-gray-400 mb-8">{t('onboarding.basic.subtitle')}</p>
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
            {t('onboarding.basic.full_name')} *
          </label>
          <input
            type="text"
            value={formData.full_name}
            onChange={e => update({ full_name: e.target.value })}
            placeholder={t('onboarding.basic.full_name_placeholder')}
            className={inputCls}
          />
        </div>
        <div className="overflow-hidden">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
            {t('onboarding.basic.birth_date')}
          </label>
          <input
            type="date"
            value={formData.birth_date}
            onChange={e => update({ birth_date: e.target.value })}
            className={`${inputCls} max-w-full box-border`}
            style={{ boxSizing: 'border-box' }}
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
            {t('onboarding.basic.gender')}
          </label>
          <div className="grid grid-cols-3 gap-2">
            {GENDER_OPTS.map(({ value, key }) => (
              <button
                key={value}
                type="button"
                onClick={() => update({ gender: value })}
                className={optionBtn(formData.gender === value)}
              >
                {t(`onboarding.basic.${key}`)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">
        {t('onboarding.health_step.title')}
      </h2>
      <p className="text-gray-500 dark:text-gray-400 mb-8">
        {t('onboarding.health_step.subtitle')}
      </p>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
              {t('onboarding.health_step.weight')}
            </label>
            <input
              type="number"
              value={formData.weight}
              onChange={e => update({ weight: e.target.value })}
              placeholder="75"
              className={inputCls}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
              {t('onboarding.health_step.height')}
            </label>
            <input
              type="number"
              value={formData.height}
              onChange={e => update({ height: e.target.value })}
              placeholder="175"
              className={inputCls}
            />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
            {t('onboarding.health_step.smoking')}
          </label>
          <div className="grid grid-cols-2 gap-2">
            {SMOKING_OPTS.map(({ value, key }) => (
              <button
                key={value}
                type="button"
                onClick={() => update({ is_smoker: value })}
                className={optionBtn(formData.is_smoker === value)}
              >
                {t(`onboarding.health_step.${key}`)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
            {t('onboarding.health_step.alcohol')}
          </label>
          <div className="grid grid-cols-3 gap-2">
            {ALCOHOL_OPTS.map(({ value, key }) => (
              <button
                key={value}
                type="button"
                onClick={() => update({ alcohol_use: value })}
                className={optionBtn(formData.alcohol_use === value)}
              >
                {t(`onboarding.health_step.${key}`)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
            {t('onboarding.health_step.sleep_goal')}: {t('onboarding.health_step.sleep_value', { count: Number(formData.sleep_goal) })}
          </label>
          <input
            type="range"
            min="4"
            max="12"
            value={formData.sleep_goal}
            onChange={e => update({ sleep_goal: e.target.value })}
            className="w-full accent-blue-600"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>{t('onboarding.health_step.sleep_range_min', { count: 4 })}</span>
            <span>{t('onboarding.health_step.sleep_range_max', { count: 12 })}</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">
        {t('onboarding.lifestyle_step.title')}
      </h2>
      <p className="text-gray-500 dark:text-gray-400 mb-8">{t('onboarding.lifestyle_step.subtitle')}</p>
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
            {t('onboarding.lifestyle_step.work_status')}
          </label>
          <div className="grid grid-cols-2 gap-2">
            {WORK_OPTS.map(({ value, key }) => (
              <button
                key={value}
                type="button"
                onClick={() => update({ employment_type: value })}
                className={optionBtn(formData.employment_type === value)}
              >
                {t(`onboarding.lifestyle_step.${key}`)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
            {t('onboarding.lifestyle_step.profession')}
          </label>
          <input
            type="text"
            value={formData.profession}
            onChange={e => update({ profession: e.target.value })}
            placeholder={t('onboarding.lifestyle_step.profession_placeholder')}
            className={inputCls}
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
            {t('onboarding.lifestyle_step.activity_level')}
          </label>
          <div className="grid grid-cols-2 gap-2">
            {ACTIVITY_OPTS.map(({ value, key }) => (
              <button
                key={value}
                type="button"
                onClick={() => update({ activity_level: value })}
                className={optionBtn(formData.activity_level === value)}
              >
                {t(`onboarding.lifestyle_step.${key}`)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
            {t('onboarding.lifestyle_step.education')}
          </label>
          <div className="grid grid-cols-2 gap-2">
            {EDUCATION_OPTS.map(({ value, key }) => (
              <button
                key={value}
                type="button"
                onClick={() => update({ education_level: value })}
                className={optionBtn(formData.education_level === value)}
              >
                {t(`onboarding.lifestyle_step.${key}`)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
            {t('onboarding.lifestyle_step.weekly_sport')}: {t('onboarding.lifestyle_step.sport_value', { count: Number(formData.weekly_sport_goal) })}
          </label>
          <input
            type="range"
            min="0"
            max="7"
            value={formData.weekly_sport_goal}
            onChange={e => update({ weekly_sport_goal: e.target.value })}
            className="w-full accent-blue-600"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>{t('onboarding.lifestyle_step.sport_range_min', { count: 0 })}</span>
            <span>{t('onboarding.lifestyle_step.sport_range_max', { count: 7 })}</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep5 = () => (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">
        {t('onboarding.social_step.title')}
      </h2>
      <p className="text-gray-500 dark:text-gray-400 mb-8">
        {t('onboarding.social_step.subtitle')}
      </p>
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
            {t('onboarding.social_step.relationship')}
          </label>
          <div className="grid grid-cols-2 gap-2">
            {RELATIONSHIP_OPTS.map(({ value, key }) => (
              <button
                key={value}
                type="button"
                onClick={() => update({ relationship_status: value })}
                className={optionBtn(formData.relationship_status === value)}
              >
                {t(`onboarding.social_step.${key}`)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
            {t('onboarding.social_step.children')}
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => update({ has_children: false })}
              className={optionBtn(!formData.has_children)}
            >
              {t('onboarding.social_step.no_children')}
            </button>
            <button
              type="button"
              onClick={() => update({ has_children: true })}
              className={optionBtn(formData.has_children)}
            >
              {t('onboarding.social_step.has_children')}
            </button>
          </div>
          {formData.has_children && (
            <div className="mt-3">
              <label className="text-sm text-gray-600 dark:text-gray-400 mb-1 block">
                {t('onboarding.social_step.children_count')}
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={formData.children_count}
                onChange={e => update({ children_count: e.target.value })}
                className={inputCls}
              />
            </div>
          )}
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
            {t('onboarding.social_step.lives_with')}
          </label>
          <div className="grid grid-cols-2 gap-2">
            {LIVES_WITH_OPTS.map(({ value, key }) => {
              const active = formData.lives_with.includes(value);
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    update({
                      lives_with: active
                        ? formData.lives_with.filter(x => x !== value)
                        : [...formData.lives_with, value],
                    })
                  }
                  className={optionBtn(active)}
                >
                  {t(`onboarding.social_step.${key}`)}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );

  const currencies = [
    { code: 'TRY', symbol: '₺', label: 'TL' },
    { code: 'EUR', symbol: '€', label: 'Euro' },
    { code: 'USD', symbol: '$', label: 'Dolar' },
    { code: 'GBP', symbol: '£', label: 'Sterlin' },
    { code: 'CHF', symbol: 'Fr', label: 'Frank' },
  ];

  const salaryRangeValues =
    formData.currency === 'TRY'
      ? ['0-15.000', '15.000-25.000', '25.000-40.000', '40.000-60.000', '60.000-100.000', '100.000+']
      : ['0-1.000', '1.000-2.000', '2.000-3.500', '3.500-5.000', '5.000-8.000', '8.000+'];

  const salaryRanges = salaryRangeValues.map(r => `${r}${formData.currency_symbol}`);

  const renderStep6 = () => (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">
        {t('onboarding.finance_step.title')}
      </h2>
      <p className="text-gray-500 dark:text-gray-400 mb-8">
        {t('onboarding.finance_step.subtitle')}
      </p>
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
            {t('onboarding.finance_step.currency')}
          </label>
          <div className="grid grid-cols-3 gap-2">
            {currencies.map(c => (
              <button
                key={c.code}
                onClick={() => update({ currency: c.code, currency_symbol: c.symbol })}
                className={optionBtn(formData.currency === c.code)}
              >
                {c.symbol} {c.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
            {t('onboarding.finance_step.salary_range')}
          </label>
          <div className="grid grid-cols-2 gap-2">
            {salaryRanges.map(r => (
              <button
                key={r}
                onClick={() => update({ salary_range: r })}
                className={optionBtn(formData.salary_range === r)}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
            {t('onboarding.finance_step.monthly_budget')} ({formData.currency_symbol})
          </label>
          <input
            type="number"
            value={formData.monthly_budget}
            onChange={e => update({ monthly_budget: e.target.value })}
            placeholder={t('onboarding.finance_step.monthly_budget_placeholder')}
            className={inputCls}
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
            {t('onboarding.finance_step.savings_goal')} ({formData.currency_symbol})
          </label>
          <input
            type="number"
            value={formData.savings_goal}
            onChange={e => update({ savings_goal: e.target.value })}
            placeholder={t('onboarding.finance_step.savings_goal_placeholder')}
            className={inputCls}
          />
        </div>
      </div>
    </div>
  );

  const personalityOpts = useMemo(
    () => [
      { value: 'balanced' as const, emoji: '😊', labelKey: 'balanced' as const, descKey: 'balanced_desc' as const },
      { value: 'strict' as const, emoji: '💪', labelKey: 'strict' as const, descKey: 'strict_desc' as const },
      { value: 'gentle' as const, emoji: '🤗', labelKey: 'gentle' as const, descKey: 'gentle_desc' as const },
    ],
    [],
  );

  const motivationOpts = useMemo(
    () => [
      { value: 'positive' as const, labelKey: 'positive' as const, descKey: 'positive_desc' as const },
      { value: 'realistic' as const, labelKey: 'realistic' as const, descKey: 'realistic_desc' as const },
      { value: 'challenge' as const, labelKey: 'challenge' as const, descKey: 'challenge_desc' as const },
      { value: 'calm' as const, labelKey: 'calm' as const, descKey: 'calm_desc' as const },
    ],
    [],
  );

  const renderStep7 = () => (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">
        {t('onboarding.goals_step.title')}
      </h2>
      <p className="text-gray-500 dark:text-gray-400 mb-6">{t('onboarding.goals_step.subtitle')}</p>
      <div className="space-y-5">
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
            {t('onboarding.goals_step.interests')}
          </label>
          <div className="flex flex-wrap gap-2">
            {interestOptions.map(({ value, label }) => {
              const active = formData.interests.includes(value);
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    update({
                      interests: active
                        ? formData.interests.filter(x => x !== value)
                        : [...formData.interests, value],
                    })
                  }
                  className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                    active
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
            {t('onboarding.goals_step.short_term_goal')}
          </label>
          <input
            type="text"
            value={formData.short_term_goal}
            onChange={e => update({ short_term_goal: e.target.value })}
            placeholder={t('onboarding.goals_step.short_term_placeholder')}
            className={inputCls}
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
            {t('onboarding.goals_step.long_term_goal')}
          </label>
          <input
            type="text"
            value={formData.long_term_goal}
            onChange={e => update({ long_term_goal: e.target.value })}
            placeholder={t('onboarding.goals_step.long_term_placeholder')}
            className={inputCls}
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
            {t('onboarding.goals_step.personality')}
          </label>
          <div className="space-y-2">
            {personalityOpts.map(p => (
              <button
                key={p.value}
                type="button"
                onClick={() => update({ ai_personality: p.value })}
                className={`w-full flex items-center gap-3 p-4 rounded-2xl border transition-colors text-left ${
                  formData.ai_personality === p.value
                    ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-400'
                    : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-600'
                }`}
              >
                <span className="text-2xl">{p.emoji}</span>
                <div>
                  <p
                    className={`font-medium text-sm ${
                      formData.ai_personality === p.value
                        ? 'text-blue-700 dark:text-blue-300'
                        : 'text-gray-800 dark:text-gray-200'
                    }`}
                  >
                    {t(`onboarding.goals_step.${p.labelKey}`)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t(`onboarding.goals_step.${p.descKey}`)}</p>
                </div>
                {formData.ai_personality === p.value && (
                  <div className="ml-auto w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center">
                    <span className="text-white text-xs">✓</span>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
            {t('onboarding.goals_step.motivation')}
          </label>
          <div className="grid grid-cols-1 gap-2">
            {motivationOpts.map(m => (
              <button
                key={m.value}
                type="button"
                onClick={() => update({ motivation_type: m.value })}
                className={`flex items-center gap-3 p-4 rounded-2xl border transition-colors text-left ${
                  formData.motivation_type === m.value
                    ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-400'
                    : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-600'
                }`}
              >
                <div className="flex-1">
                  <p className={`font-medium text-sm ${
                    formData.motivation_type === m.value
                      ? 'text-blue-700 dark:text-blue-300'
                      : 'text-gray-800 dark:text-gray-200'
                  }`}>{t(`onboarding.goals_step.${m.labelKey}`)}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t(`onboarding.goals_step.${m.descKey}`)}</p>
                </div>
                {formData.motivation_type === m.value && (
                  <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xs">✓</span>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep = () => {
    switch (step) {
      case 1: return renderStep1();
      case 2: return renderStep2();
      case 3: return renderStep3();
      case 4: return renderStep4();
      case 5: return renderStep5();
      case 6: return renderStep6();
      case 7: return renderStep7();
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 flex flex-col">
      {/* Üst bar */}
      <div className="flex items-center justify-between px-4 py-4 flex-shrink-0">
        {step > 1 ? (
          <button
            onClick={() => setStep(s => s - 1)}
            className="text-gray-500 dark:text-gray-400 text-sm font-medium"
          >
            {t('onboarding.back')}
          </button>
        ) : (
          <div />
        )}
        {step > 1 && step < TOTAL_STEPS && (
          <button onClick={handleSkip} className="text-sm text-gray-400">
            {t('onboarding.skip')}
          </button>
        )}
      </div>

      {/* İlerleme çubuğu */}
      {step > 1 && (
        <div className="px-6 mb-2 flex-shrink-0">
          <div className="flex gap-1">
            {[2, 3, 4, 5, 6, 7].map(s => (
              <div
                key={s}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  s <= step ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                }`}
              />
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-1 text-right">{t('onboarding.progress', { step: step - 1 })}</p>
        </div>
      )}

      {/* İçerik */}
      <div className="flex-1 px-6 py-4 overflow-y-auto">{renderStep()}</div>

      {/* Alt buton */}
      {step > 1 && (
        <div className="px-6 pb-8 flex-shrink-0">
          <button
            onClick={handleNext}
            disabled={saving}
            className="w-full py-4 bg-blue-600 text-white rounded-2xl font-semibold text-base active:scale-95 transition-transform disabled:opacity-60"
          >
            {saving ? t('onboarding.saving') : step === TOTAL_STEPS ? t('onboarding.finish') : t('onboarding.continue')}
          </button>
        </div>
      )}
    </div>
  );
}
