import i18n from '@/i18n';
import type { TFunction } from 'i18next';

const lang = () => i18n.language || 'tr';

/** DB category id → i18n key under finance.categories.* */
const FINANCE_CATEGORY_I18N_KEY: Record<string, string> = {
  'Maaş': 'finance.categories.salary',
  'Freelance': 'finance.categories.freelance',
  'Yatırım': 'finance.categories.investment',
  'Kira Geliri': 'finance.categories.rental_income',
  'Emeklilik': 'finance.categories.pension',
  'Burs': 'finance.categories.scholarship',
  'Yan Gelir': 'finance.categories.side_income',
  'Diğer Gelir': 'finance.categories.other_income',
  'Yiyecek & İçecek': 'finance.categories.food',
  'Ulaşım': 'finance.categories.transport',
  'Eğlence': 'finance.categories.entertainment',
  'Faturalar': 'finance.categories.bills',
  'Sağlık': 'finance.categories.health',
  'Giyim': 'finance.categories.clothing',
  'Teknoloji': 'finance.categories.technology',
  'Kira & Ev': 'finance.categories.rent',
  'Eğitim': 'finance.categories.education',
  'Spor': 'finance.categories.sports',
  'Güzellik & Bakım': 'finance.categories.beauty',
  'Seyahat': 'finance.categories.travel',
  'Hediye': 'finance.categories.gift',
  'Sigorta': 'finance.categories.insurance',
  'Alışveriş': 'finance.categories.shopping',
  'Diğer Gider': 'finance.categories.other_expense',
};

// ── Activity categories ───────────────────────────────────────────────────────

export const getActivityCategory = (category: string): string => {
  const map: Record<string, Record<string, string>> = {
    'sağlık-spor':  { tr: 'Sağlık & Spor', en: 'Health & Sports',   fr: 'Santé & Sport' },
    'sosyal':       { tr: 'Sosyal',         en: 'Social',            fr: 'Social' },
    'iş-eğitim':   { tr: 'İş & Eğitim',   en: 'Work & Education',  fr: 'Travail & Éducation' },
    'eğlence':      { tr: 'Eğlence',        en: 'Entertainment',     fr: 'Divertissement' },
    'alışveriş':    { tr: 'Alışveriş',      en: 'Shopping',          fr: 'Shopping' },
    'yeme-içme':    { tr: 'Yeme & İçme',   en: 'Food & Drink',      fr: 'Nourriture & Boisson' },
    'seyahat':      { tr: 'Seyahat',        en: 'Travel',            fr: 'Voyage' },
    'ev-yaşam':     { tr: 'Ev & Yaşam',    en: 'Home & Living',     fr: 'Maison & Vie' },
    'diğer':        { tr: 'Diğer',          en: 'Other',             fr: 'Autre' },
  };
  return map[category]?.[lang()] ?? category;
};

// ── Transaction categories (income + expense) ─────────────────────────────────

export const getTransactionCategory = (category: string): string => {
  const map: Record<string, Record<string, string>> = {
    'Yiyecek & İçecek': { tr: 'Yiyecek & İçecek', en: 'Food & Drink',      fr: 'Nourriture & Boisson' },
    'Ulaşım':           { tr: 'Ulaşım',            en: 'Transportation',    fr: 'Transport' },
    'Eğlence':          { tr: 'Eğlence',            en: 'Entertainment',     fr: 'Divertissement' },
    'Faturalar':        { tr: 'Faturalar',          en: 'Bills',             fr: 'Factures' },
    'Sağlık':           { tr: 'Sağlık',             en: 'Health',            fr: 'Santé' },
    'Giyim':            { tr: 'Giyim',              en: 'Clothing',          fr: 'Vêtements' },
    'Teknoloji':        { tr: 'Teknoloji',          en: 'Technology',        fr: 'Technologie' },
    'Kira & Ev':        { tr: 'Kira & Ev',          en: 'Rent & Home',       fr: 'Loyer & Maison' },
    'Eğitim':           { tr: 'Eğitim',             en: 'Education',         fr: 'Éducation' },
    'Spor':             { tr: 'Spor',               en: 'Sports',            fr: 'Sport' },
    'Güzellik & Bakım': { tr: 'Güzellik & Bakım',  en: 'Beauty & Care',     fr: 'Beauté & Soins' },
    'Seyahat':          { tr: 'Seyahat',            en: 'Travel',            fr: 'Voyage' },
    'Hediye':           { tr: 'Hediye',             en: 'Gift',              fr: 'Cadeau' },
    'Sigorta':          { tr: 'Sigorta',            en: 'Insurance',         fr: 'Assurance' },
    'Alışveriş':        { tr: 'Alışveriş',          en: 'Shopping',          fr: 'Shopping' },
    'Diğer Gider':      { tr: 'Diğer Gider',        en: 'Other Expense',     fr: 'Autre Dépense' },
    'Maaş':             { tr: 'Maaş',               en: 'Salary',            fr: 'Salaire' },
    'Freelance':        { tr: 'Freelance',           en: 'Freelance',         fr: 'Freelance' },
    'Yatırım':          { tr: 'Yatırım',             en: 'Investment',        fr: 'Investissement' },
    'Kira Geliri':      { tr: 'Kira Geliri',         en: 'Rental Income',     fr: 'Revenus locatifs' },
    'Emeklilik':        { tr: 'Emeklilik',           en: 'Retirement',        fr: 'Retraite' },
    'Burs':             { tr: 'Burs',                en: 'Scholarship',       fr: 'Bourse' },
    'Yan Gelir':        { tr: 'Yan Gelir',           en: 'Side Income',       fr: 'Revenus annexes' },
    'Diğer Gelir':      { tr: 'Diğer Gelir',         en: 'Other Income',      fr: 'Autre Revenu' },
  };
  return map[category]?.[lang()] ?? category;
};

/** Prefer react-i18next `t()` labels; fallback to static map for unknown ids. */
export const translateFinanceCategory = (t: TFunction, id: string): string => {
  const key = FINANCE_CATEGORY_I18N_KEY[id];
  if (key) return t(key);
  return getTransactionCategory(id);
};

type TxSubNs =
  | 'food' | 'transport' | 'bills' | 'health' | 'shopping' | 'entertainment' | 'travel' | 'education' | 'income';

/** Transaction category → `finance.subcategories` namespace (food, transport, income, …). */
const TX_SUB_NS: Record<string, TxSubNs> = {
  'Yiyecek & İçecek': 'food',
  'Ulaşım': 'transport',
  'Faturalar': 'bills',
  'Sağlık': 'health',
  'Alışveriş': 'shopping',
  'Eğlence': 'entertainment',
  'Seyahat': 'travel',
  'Eğitim': 'education',
  'Maaş': 'income',
  'Freelance': 'income',
  'Yatırım': 'income',
  'Kira Geliri': 'income',
  'Emeklilik': 'income',
  'Burs': 'income',
  'Yan Gelir': 'income',
  'Diğer Gelir': 'income',
};

/** Turkish income subcategory (DB) → leaf key under `finance.subcategories.income`. */
const INCOME_SUB_TO_KEY: Record<string, string> = {
  'Düzenli Maaş': 'salary_regular',
  'Prim / Bonus': 'salary_bonus',
  'Fazla Mesai': 'salary_overtime',
  'Proje Bazlı': 'freelance_project',
  'Danışmanlık': 'freelance_consulting',
  'Tasarım': 'freelance_design',
  'İçerik / Yazarlık': 'freelance_writing',
  'Hisse Senedi': 'investment_stock',
  'Kripto': 'investment_crypto',
  'Fon': 'investment_fund',
  'Temettü': 'investment_dividend',
  'Daire Kirası': 'rental_apartment',
  'Araç Kirası': 'rental_car',
  'Diğer Kira': 'rental_other',
  'Devlet Emekliliği': 'pension_state',
  'Özel Emeklilik': 'pension_private',
  'Devlet Bursu': 'scholarship_state',
  'Özel Burs': 'scholarship_private',
  'E-ticaret': 'side_ecommerce',
  'Sosyal Medya': 'side_social_media',
  'Özel Ders': 'side_teaching',
  'Diğer Yan Gelir': 'side_other',
  'Hediye / Bağış': 'other_gift',
  'Satış Geliri': 'other_sale',
  'Diğer': 'other',
  // Legacy DB / önceki etiketler
  'Aylık Maaş': 'salary_regular',
  'İkramiye': 'salary_bonus',
  'Prim': 'salary_bonus',
  'Yazarlık': 'freelance_writing',
  'Yazılım': 'other',
  'Gayrimenkul': 'other',
  'Faiz': 'other',
  'Konut Kirası': 'rental_apartment',
  'İşyeri Kirası': 'rental_other',
  'Emekli Maaşı': 'pension_state',
  'BES': 'pension_private',
  'Yurt Dışı Burs': 'scholarship_private',
  'Satış': 'other_sale',
  'Komisyon': 'side_other',
  'Telif': 'side_other',
  'Reklam Geliri': 'side_social_media',
  'Hediye': 'other_gift',
  'Miras': 'other_gift',
  'Piyango': 'other',
};

/** DB subcategory label (Turkish) → leaf key under `finance.subcategories.<ns>`. */
const TX_SUB_TO_KEY: Record<string, Record<string, string>> = {
  'Yiyecek & İçecek': {
    'Market': 'grocery',
    'Restaurant': 'restaurant',
    'Kafe': 'cafe',
    'Fast Food': 'fastfood',
    'Online Yemek': 'delivery',
    'Alkol': 'other',
    'Su & İçecek': 'other',
  },
  'Ulaşım': {
    'Yakıt': 'fuel',
    'Toplu Taşıma': 'public',
    'Taksi & Uber': 'taxi',
    'Araç Bakım': 'maintenance',
    'Otopark': 'parking',
    'Uçak': 'other',
    'Tren & Otobüs': 'other',
  },
  'Eğlence': {
    'Sinema': 'cinema',
    'Konser': 'concert',
    'Tiyatro': 'other',
    'Oyun': 'games',
    'Kitap': 'books',
    'Müzik': 'other',
    'Spor Maçı': 'other',
    'Gece Hayatı': 'other',
  },
  'Faturalar': {
    'Elektrik': 'electricity',
    'Su': 'water',
    'Doğalgaz': 'gas',
    'İnternet': 'internet',
    'Telefon': 'phone',
    'Abonelikler': 'subscription',
    'Kablo TV': 'other',
  },
  'Sağlık': {
    'Doktor': 'doctor',
    'Diş': 'dental',
    'İlaç': 'medicine',
    'Hastane': 'hospital',
    'Laboratuvar': 'other',
    'Göz': 'other',
    'Psikoloji': 'other',
  },
  'Alışveriş': {
    'Giyim': 'clothing',
    'Elektronik': 'electronics',
    'Ev Eşyası': 'home',
    'Online': 'other',
    'Diğer': 'other',
  },
  'Seyahat': {
    'Konaklama': 'hotel',
    'Uçak Bileti': 'flight',
    'Tur': 'vacation',
    'Vize': 'other',
    'Seyahat Sigortası': 'other',
    'Aktivite': 'other',
  },
  'Eğitim': {
    'Okul Ücreti': 'tuition',
    'Kurs': 'course',
    'Kitap & Kırtasiye': 'books',
    'Online Eğitim': 'course',
    'Dil Kursu': 'course',
  },
};

/**
 * Display label for a transaction subcategory stored as Turkish in the DB.
 * For `tr` UI language returns the raw stored value; for en/fr resolves `finance.subcategories.<ns>.<key>`.
 */
export const getSubcategory = (category: string, subcategory: string | null | undefined): string => {
  if (!subcategory) return '';
  const lang = (i18n.language || 'tr').split('-')[0];
  if (lang === 'tr') return subcategory;

  const ns = TX_SUB_NS[category];
  if (!ns) return subcategory;

  if (ns === 'income') {
    const subKey = INCOME_SUB_TO_KEY[subcategory];
    if (!subKey) return subcategory;
    return String(i18n.t(`finance.subcategories.income.${subKey}`));
  }

  const subKey = TX_SUB_TO_KEY[category]?.[subcategory];
  if (!subKey) return subcategory;
  return String(i18n.t(`finance.subcategories.${ns}.${subKey}`));
};

// ── Friend relationship types ─────────────────────────────────────────────────

export const getRelationship = (relationship: string): string => {
  const map: Record<string, Record<string, string>> = {
    'arkadaş':     { tr: 'Arkadaş',      en: 'Friend',         fr: 'Ami' },
    'aile':        { tr: 'Aile',          en: 'Family',         fr: 'Famille' },
    'akraba':      { tr: 'Akraba',        en: 'Relative',       fr: 'Parent' },
    'iş arkadaşı': { tr: 'İş Arkadaşı', en: 'Colleague',      fr: 'Collègue' },
    'partner':     { tr: 'Partner',       en: 'Partner',        fr: 'Partenaire' },
    'diğer':       { tr: 'Diğer',         en: 'Other',          fr: 'Autre' },
  };
  return map[relationship]?.[lang()] ?? relationship;
};

// ── Suggestion categories ─────────────────────────────────────────────────────

export const getSuggestionCategory = (category: string): string => {
  const map: Record<string, Record<string, string>> = {
    'sağlık':     { tr: 'Sağlık',     en: 'Health',  fr: 'Santé' },
    'sosyal':     { tr: 'Sosyal',     en: 'Social',  fr: 'Social' },
    'finans':     { tr: 'Finans',     en: 'Finance', fr: 'Finance' },
    'alışkanlık': { tr: 'Alışkanlık', en: 'Habit',   fr: 'Habitude' },
  };
  return map[category]?.[lang()] ?? category;
};

// ── Gender ────────────────────────────────────────────────────────────────────

export const getGender = (gender: string): string => {
  const map: Record<string, Record<string, string>> = {
    'Erkek':                   { tr: 'Erkek',        en: 'Male',          fr: 'Homme' },
    'Kadın':                   { tr: 'Kadın',        en: 'Female',        fr: 'Femme' },
    'Diğer':                   { tr: 'Belirtmiyorum', en: 'Not specified', fr: 'Non spécifié' },
    'Belirtmek istemiyorum':   { tr: 'Belirtmiyorum', en: 'Not specified', fr: 'Non spécifié' },
    'Belirtmiyorum':           { tr: 'Belirtmiyorum', en: 'Not specified', fr: 'Non spécifié' },
  };
  return map[gender]?.[lang()] ?? gender;
};

// ── Relationship status ───────────────────────────────────────────────────────

export const getRelationshipStatus = (status: string): string => {
  const map: Record<string, Record<string, string>> = {
    'Bekar':     { tr: 'Bekar',     en: 'Single',           fr: 'Célibataire' },
    'Evli':      { tr: 'Evli',      en: 'Married',          fr: 'Marié(e)' },
    'Birlikte':  { tr: 'Birlikte',  en: 'In a relationship', fr: 'En couple' },
    'İlişkide':  { tr: 'Birlikte',  en: 'In a relationship', fr: 'En couple' },
    'Boşanmış':  { tr: 'Boşanmış', en: 'Divorced',          fr: 'Divorcé(e)' },
  };
  return map[status]?.[lang()] ?? status;
};

// ── Activity level ────────────────────────────────────────────────────────────

export const getActivityLevel = (level: string): string => {
  const map: Record<string, Record<string, string>> = {
    'Hareketsiz': { tr: 'Hareketsiz', en: 'Sedentary',        fr: 'Sédentaire' },
    'Az Aktif':   { tr: 'Az Aktif',   en: 'Lightly Active',   fr: 'Peu actif' },
    'Orta':       { tr: 'Orta',       en: 'Moderately Active', fr: 'Modérément actif' },
    'Çok Aktif':  { tr: 'Çok Aktif', en: 'Very Active',      fr: 'Très actif' },
  };
  return map[level]?.[lang()] ?? level;
};

// ── Motivation type ───────────────────────────────────────────────────────────

export const getMotivationType = (type: string): string => {
  const map: Record<string, Record<string, string>> = {
    'positive':  { tr: '😊 Pozitif & Motive Edici', en: '😊 Positive & Motivating', fr: '😊 Positif & Motivant' },
    'realistic': { tr: '🎯 Gerçekçi & Pratik',      en: '🎯 Realistic & Practical', fr: '🎯 Réaliste & Pratique' },
    'challenge': { tr: '💪 Meydan Okuyucu',          en: '💪 Challenging',            fr: '💪 Stimulant' },
    'calm':      { tr: '🧘 Sakin & Dengeli',          en: '🧘 Calm & Balanced',        fr: '🧘 Calme & Équilibré' },
  };
  return map[type]?.[lang()] ?? type;
};

// ── AI personality ────────────────────────────────────────────────────────────

export const getPersonality = (personality: string): string => {
  const map: Record<string, Record<string, string>> = {
    'balanced': { tr: 'Dengeli', en: 'Balanced', fr: 'Équilibré' },
    'strict':   { tr: 'Sert',    en: 'Strict',   fr: 'Strict' },
    'gentle':   { tr: 'Nazik',   en: 'Gentle',   fr: 'Doux' },
  };
  return map[personality]?.[lang()] ?? personality;
};
