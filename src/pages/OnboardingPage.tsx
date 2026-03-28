import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { useCurrencyStore } from '@/store/useCurrencyStore';
import { supabase } from '@/lib/supabase';

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
  interests: string[];
  short_term_goal: string;
  long_term_goal: string;
  ai_personality: string;
};

const TOTAL_STEPS = 7;

const inputCls =
  'w-full border border-gray-200 dark:border-gray-600 rounded-2xl px-4 py-3 text-sm bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-blue-400';

const optionBtn = (active: boolean) =>
  `py-3 rounded-2xl text-sm font-medium border transition-colors ${
    active
      ? 'bg-blue-600 text-white border-blue-600'
      : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600'
  }`;

export default function OnboardingPage() {
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
    interests: [],
    short_term_goal: '',
    long_term_goal: '',
    ai_personality: 'balanced',
  });

  const update = (patch: Partial<FormData>) =>
    setFormData(prev => ({ ...prev, ...patch }));

  const saveStep = async (stepData: {
    users?: Record<string, unknown>;
    user_profiles?: Record<string, unknown>;
  }) => {
    if (stepData.users) {
      await supabase.from('users').update(stepData.users).eq('id', userId);
    }
    if (stepData.user_profiles) {
      await supabase
        .from('user_profiles')
        .upsert({ user_id: userId, ...stepData.user_profiles });
    }
  };

  const handleNext = async () => {
    setSaving(true);
    try {
      if (step === 2) {
        if (!formData.full_name.trim()) {
          alert('Ad Soyad zorunludur');
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
      <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-4">Merhaba! 👋</h1>
      <p className="text-lg text-gray-500 dark:text-gray-400 mb-2">
        Ben <span className="text-blue-600 font-semibold">Zeeky</span>
      </p>
      <p className="text-gray-500 dark:text-gray-400 leading-relaxed mb-10 max-w-xs">
        Kişisel yapay zeka yaşam koçunum. Seni ne kadar iyi tanırsam, sana o kadar iyi yardımcı
        olabilirim.
      </p>
      <div className="space-y-3 w-full max-w-xs mb-10">
        {[
          { icon: '🎯', text: 'Kişiselleştirilmiş öneriler' },
          { icon: '📊', text: 'Akıllı aktivite takibi' },
          { icon: '💰', text: 'Finansal koçluk' },
          { icon: '❤️', text: 'Sağlık & mutluluk desteği' },
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
        Başlayalım →
      </button>
      <p className="text-xs text-gray-400 mt-4">Bilgilerini istediğin zaman değiştirebilirsin</p>
    </div>
  );

  const renderStep2 = () => (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">
        Seni tanıyalım 😊
      </h2>
      <p className="text-gray-500 dark:text-gray-400 mb-8">Temel bilgilerini girerek başlayalım.</p>
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
            Ad Soyad *
          </label>
          <input
            type="text"
            value={formData.full_name}
            onChange={e => update({ full_name: e.target.value })}
            placeholder="Adın ve soyadın"
            className={inputCls}
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
            Doğum Tarihi
          </label>
          <input
            type="date"
            value={formData.birth_date}
            onChange={e => update({ birth_date: e.target.value })}
            className={inputCls}
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
            Cinsiyet
          </label>
          <div className="grid grid-cols-3 gap-2">
            {['Erkek', 'Kadın', 'Belirtmek istemiyorum'].map(g => (
              <button
                key={g}
                onClick={() => update({ gender: g })}
                className={optionBtn(formData.gender === g)}
              >
                {g === 'Belirtmek istemiyorum' ? 'Belirtmiyorum' : g}
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
        Sağlık bilgilerin 💪
      </h2>
      <p className="text-gray-500 dark:text-gray-400 mb-8">
        Sağlık önerileri için bu bilgilere ihtiyacım var.
      </p>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
              Kilo (kg)
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
              Boy (cm)
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
            Sigara
          </label>
          <div className="grid grid-cols-2 gap-2">
            {['Kullanmıyorum', 'Bıraktım', 'Günde 1-5', 'Günde 6+'].map(s => (
              <button
                key={s}
                onClick={() => update({ is_smoker: s })}
                className={optionBtn(formData.is_smoker === s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
            Alkol
          </label>
          <div className="grid grid-cols-3 gap-2">
            {['Kullanmıyorum', 'Sosyal', 'Düzenli'].map(a => (
              <button
                key={a}
                onClick={() => update({ alcohol_use: a })}
                className={optionBtn(formData.alcohol_use === a)}
              >
                {a}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
            Günlük uyku hedefi: {formData.sleep_goal} saat
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
            <span>4 saat</span>
            <span>12 saat</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">
        Yaşam tarzın 🌟
      </h2>
      <p className="text-gray-500 dark:text-gray-400 mb-8">Günlük rutinini anlayabilmem için.</p>
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
            Çalışma durumu
          </label>
          <div className="grid grid-cols-2 gap-2">
            {['Çalışıyor', 'Öğrenci', 'Her ikisi', 'Çalışmıyor'].map(e => (
              <button
                key={e}
                onClick={() => update({ employment_type: e })}
                className={optionBtn(formData.employment_type === e)}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
            Meslek / Sektör
          </label>
          <input
            type="text"
            value={formData.profession}
            onChange={e => update({ profession: e.target.value })}
            placeholder="Ör: Yazılım Mühendisi"
            className={inputCls}
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
            Aktivite seviyesi
          </label>
          <div className="grid grid-cols-2 gap-2">
            {['Hareketsiz', 'Az Aktif', 'Orta', 'Çok Aktif'].map(a => (
              <button
                key={a}
                onClick={() => update({ activity_level: a })}
                className={optionBtn(formData.activity_level === a)}
              >
                {a}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
            Haftalık spor hedefi: {formData.weekly_sport_goal} gün
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
            <span>0 gün</span>
            <span>7 gün</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep5 = () => (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">
        Sosyal hayatın 👥
      </h2>
      <p className="text-gray-500 dark:text-gray-400 mb-8">
        Sosyal öneriler için bu bilgilere ihtiyacım var.
      </p>
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
            Medeni durum
          </label>
          <div className="grid grid-cols-2 gap-2">
            {['Bekar', 'Evli', 'Birlikte', 'Boşanmış'].map(r => (
              <button
                key={r}
                onClick={() => update({ relationship_status: r })}
                className={optionBtn(formData.relationship_status === r)}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
            Çocuğun var mı?
          </label>
          <div className="grid grid-cols-2 gap-2">
            {['Yok', 'Var'].map(c => (
              <button
                key={c}
                onClick={() => update({ has_children: c === 'Var' })}
                className={optionBtn((c === 'Var') === formData.has_children)}
              >
                {c}
              </button>
            ))}
          </div>
          {formData.has_children && (
            <div className="mt-3">
              <label className="text-sm text-gray-600 dark:text-gray-400 mb-1 block">
                Kaç çocuğun var?
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
            Kimlerle yaşıyorsun? (çoklu seçim)
          </label>
          <div className="grid grid-cols-2 gap-2">
            {['Yalnız', 'Eş/Partner', 'Çocuklar', 'Aile', 'Arkadaşlar'].map(l => {
              const active = formData.lives_with.includes(l);
              return (
                <button
                  key={l}
                  onClick={() =>
                    update({
                      lives_with: active
                        ? formData.lives_with.filter(x => x !== l)
                        : [...formData.lives_with, l],
                    })
                  }
                  className={optionBtn(active)}
                >
                  {l}
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

  const salaryRanges =
    formData.currency === 'TRY'
      ? ['0-15.000₺', '15-25.000₺', '25-40.000₺', '40.000₺+']
      : [
          `0-1.000${formData.currency_symbol}`,
          `1-2.000${formData.currency_symbol}`,
          `2-5.000${formData.currency_symbol}`,
          `5.000${formData.currency_symbol}+`,
        ];

  const renderStep6 = () => (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">
        Finansal hedeflerin 💰
      </h2>
      <p className="text-gray-500 dark:text-gray-400 mb-8">
        Bütçe takibi ve finansal öneriler için.
      </p>
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
            Para birimi
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
            Aylık gelir aralığı
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
            Aylık bütçe hedefi ({formData.currency_symbol})
          </label>
          <input
            type="number"
            value={formData.monthly_budget}
            onChange={e => update({ monthly_budget: e.target.value })}
            placeholder="Ör: 3000"
            className={inputCls}
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
            Aylık tasarruf hedefi ({formData.currency_symbol})
          </label>
          <input
            type="number"
            value={formData.savings_goal}
            onChange={e => update({ savings_goal: e.target.value })}
            placeholder="Ör: 500"
            className={inputCls}
          />
        </div>
      </div>
    </div>
  );

  const personalities = [
    { value: 'balanced', emoji: '😊', label: 'Dengeli', desc: 'Motive edici ve dengeli' },
    { value: 'strict',   emoji: '💪', label: 'Sert',    desc: 'Direkt ve sonuç odaklı' },
    { value: 'gentle',   emoji: '🤗', label: 'Nazik',   desc: 'Anlayışlı ve destekleyici' },
  ];

  const allInterests = [
    'Spor', 'Müzik', 'Sinema', 'Kitap', 'Seyahat',
    'Yemek', 'Teknoloji', 'Sanat', 'Oyun', 'Doğa', 'Dans', 'Fotoğraf',
  ];

  const renderStep7 = () => (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">
        Son birkaç şey 🎯
      </h2>
      <p className="text-gray-500 dark:text-gray-400 mb-6">Neredeyse bitti!</p>
      <div className="space-y-5">
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
            İlgi alanların (çoklu seçim)
          </label>
          <div className="flex flex-wrap gap-2">
            {allInterests.map(i => {
              const active = formData.interests.includes(i);
              return (
                <button
                  key={i}
                  onClick={() =>
                    update({
                      interests: active
                        ? formData.interests.filter(x => x !== i)
                        : [...formData.interests, i],
                    })
                  }
                  className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                    active
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600'
                  }`}
                >
                  {i}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
            Kısa vadeli hedefin
          </label>
          <input
            type="text"
            value={formData.short_term_goal}
            onChange={e => update({ short_term_goal: e.target.value })}
            placeholder="Ör: Bu ay 4 kez spor yapmak"
            className={inputCls}
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
            Uzun vadeli hedefin
          </label>
          <input
            type="text"
            value={formData.long_term_goal}
            onChange={e => update({ long_term_goal: e.target.value })}
            placeholder="Ör: 1 yılda İngilizce öğrenmek"
            className={inputCls}
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
            Zeeky nasıl davransın?
          </label>
          <div className="space-y-2">
            {personalities.map(p => (
              <button
                key={p.value}
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
                    {p.label}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{p.desc}</p>
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
            ← Geri
          </button>
        ) : (
          <div />
        )}
        {step > 1 && step < TOTAL_STEPS && (
          <button onClick={handleSkip} className="text-sm text-gray-400">
            Atla
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
          <p className="text-xs text-gray-400 mt-1 text-right">{step - 1}/6</p>
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
            {saving ? 'Kaydediliyor...' : step === TOTAL_STEPS ? 'Hadi Başlayalım! 🚀' : 'Devam Et →'}
          </button>
        </div>
      )}
    </div>
  );
}
