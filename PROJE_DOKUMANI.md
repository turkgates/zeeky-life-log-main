# ZEEKY — Kişisel Yapay Zeka Yaşam Koçu
## Kapsamlı Proje Dökümanı

---

## 1. PROJE VİZYONU

Zeeky, kullanıcının günlük hayatını takip eden, anlayan ve ona kişisel yaşam koçu gibi davranan bir yapay zeka uygulamasıdır.

**Temel Mantık:**
- Kullanıcı sohbet ekranından Zeeky ile konuşur
- Konuşmadan aktiviteler, harcamalar, sosyal etkileşimler otomatik çıkarılır
- Sistem kullanıcıyı tanır ve kişiselleştirilmiş öneriler sunar
- Telefon verilerinede (konum, sağlık, adım) ileride entegre olacak

---

## 2. TECH STACK

| Katman | Teknoloji |
|--------|-----------|
| Frontend | React + Vite + TypeScript |
| Geliştirme Aracı | Cursor (AI destekli) |
| Backend | Supabase (DB + Auth + Edge Functions) |
| AI Modeli | OpenAI GPT-4o-mini |
| State Yönetimi | Zustand |
| Deploy | Vercel (web) → ileride Capacitor (native mobil) |
| Styling | Tailwind CSS |

---

## 3. SUPABASE BİLGİLERİ

```
URL: https://gmcmreinpnhuszxlpgpj.supabase.co
Test Kullanıcı: jakabo@gmail.com
Test Şifre: Zeeky2026!
```

### Edge Functions
| Fonksiyon | Görev |
|-----------|-------|
| zeeky-chat | Ana sohbet, aktivite ve transaction kaydı |
| zeeky-suggestions | AI tavsiye üretimi |
| zeeky-notifications | Bildirim üretimi |
| zeeky-summarize | Kullanıcı özeti üretimi |

**Önemli:** Tüm Edge Functions'da JWT verification KAPALI.

---

## 4. VERİTABANI TABLOLARI

### users
```sql
id, email, full_name, birth_date, gender, avatar_url,
ai_personality, profile_score, currency, currency_symbol,
plan_type, plan_expires_at, daily_message_count,
daily_message_date, stripe_customer_id, created_at
```

### user_profiles
```sql
id, user_id, weight, height, blood_type, chronic_diseases,
medications, is_smoker (text), alcohol_use (text),
sleep_goal, water_goal, activity_level, diet_type[],
does_sport, weekly_sport_goal, does_meditation,
relationship_status, has_children, children_count,
has_pet, lives_with[], profession, work_type,
daily_work_hours, home_to_work_km, salary_range,
education_level, interests[], favorite_music[],
favorite_genres[], monthly_budget, savings_goal,
financial_goal, short_term_goal, long_term_goal,
motivation_type, monthly_income, goals, hobbies[],
favorite_foods[], financial_goals, personal_goals,
weight_goal, sport_goal, ai_personality,
notification_enabled, language, currency,
employment_type, work_hours, family_members, updated_at
```

### activities
```sql
id, user_id, title, category, amount, duration_mins,
location, people[], is_favorite, activity_date,
created_via, raw_message, activity_time, created_at
```

**Kategoriler (constraint):**
`sağlık-spor | sosyal | iş-eğitim | eğlence | alışveriş | yeme-içme | seyahat | ev-yaşam | diğer`

**created_via:** `chat | manual | auto | recurring`

### conversations
```sql
id, user_id, role (user/assistant), content,
extracted_data (jsonb), created_at
```

### user_memory
```sql
id, user_id, memory_type (habit/preference/relationship/goal),
content, confidence, source_date, last_updated
```

### suggestions
```sql
id, user_id, category (sağlık/sosyal/finans/alışkanlık),
content, status (pending/accepted/skipped),
generated_at, responded_at, reason
```

### notifications
```sql
id, user_id, title, content,
type (system/reminder/budget/social/health/summary/zeeky/payment),
is_read, action_url, icon, color, created_at
```

### transactions
```sql
id, user_id, activity_id, type (income/expense),
title, amount, currency, category, subcategory,
transaction_date, frequency (none/daily/weekly/monthly/yearly),
frequency_end_date, parent_transaction_id, description,
tags[], payment_method, is_confirmed,
created_via (manual/chat/auto/recurring), created_at, updated_at
```

### transaction_categories
```sql
id, type (income/expense), name, subcategories[],
icon, color, is_active, sort_order
```

**Gelir kategorileri:** Maaş, Freelance, Yatırım, Kira Geliri, Emeklilik, Burs, Yan Gelir, Diğer Gelir

**Gider kategorileri:** Yiyecek & İçecek, Ulaşım, Eğlence, Faturalar, Sağlık, Giyim, Teknoloji, Kira & Ev, Eğitim, Spor, Güzellik & Bakım, Seyahat, Hediye, Sigorta, Diğer Gider

### recurring_transactions
```sql
id, user_id, title, type (income/expense), amount,
category, frequency (monthly/weekly), due_day,
is_active, created_at
```

### friends
```sql
id, user_id, name, phone, email, nickname,
relationship (arkadaş/aile/akraba/iş arkadaşı/partner/diğer),
avatar_url, notes, is_favorite, last_interaction,
interaction_count, source (manual/chat/contacts), created_at, updated_at
```

### user_summaries
```sql
id, user_id (unique), summary, interests_summary,
health_summary, finance_summary, social_summary, last_updated
```

---

## 5. UYGULAMA SAYFALARI VE ROTALAR

| Rota | Sayfa | Açıklama |
|------|-------|----------|
| / | HomePage | Ana sohbet ekranı |
| /history | HistoryPage | Neler Yaptım (takvim, favoriler) |
| /finance | FinancePage | Gelir & Gider |
| /suggestions | SuggestionsPage | AI Tavsiyeleri |
| /profile | ProfilePage | Kullanıcı profili |
| /notifications | NotificationsPage | Bildirimler |
| /add | AddActionPage | Manuel aktivite ekleme |
| /friends | FriendsPage | Arkadaş listesi |
| /settings | SettingsPage | Ayarlar |
| /auth | AuthPage | Giriş / Kayıt |
| /reset-password | ResetPasswordPage | Şifre sıfırlama |
| /auth/callback | AuthCallbackPage | Auth yönlendirme |

---

## 6. KATEGORİ SİSTEMİ

### Aktivite Kategorileri (9 adet)
```
🏃 sağlık-spor   → koşu, yüzme, spor, doktor
👥 sosyal        → arkadaş, aile, buluşma, parti
💼 iş-eğitim    → çalışma, toplantı, kurs, okul
🎬 eğlence       → sinema, dizi, konser, oyun
🛒 alışveriş     → market, giyim, teknoloji
🍽️ yeme-içme     → restoran, kafe, ev yemeği
✈️ seyahat       → gezi, tatil, şehir dışı
🏠 ev-yaşam      → tadilat, temizlik, bakım
📦 diğer         → kategoriye uymayan
```

**ÖNEMLİ:** Harcama kategorisi KALDIRILDI. Para işlemleri transactions tablosuna gider.

### Para İşlemi Mantığı
```
Sadece para → Sadece transactions'a yaz (aktivite yok)
Aktivite + para → Her ikisine yaz
Sadece aktivite → Sadece activities'e yaz
```

---

## 7. EDGE FUNCTION MANTIKLARI

### zeeky-chat
Her mesajda şunları çeker:
1. Kullanıcı temel bilgileri (users tablosu)
2. Kullanıcı özeti (user_summaries tablosu) ← ANA BAĞLAM
3. Son 3 günün aktiviteleri (max 10)
4. Bu ayın transactions (gelir/gider özeti)
5. Hafıza (user_memory, max 10)
6. Son 10 konuşma (conversations)

Sonra kaydeder:
- conversations (kullanıcı + asistan mesajları)
- activities (has_activity: true ise)
- transactions (has_transaction: true ise)
- user_memory (new_memory varsa)
- friends (people dizisindeki kişileri findOrCreateFriend ile)

**Tarih düzeltme:** activity_date 00:00:00 ise şu anki saat eklenir.

### zeeky-suggestions
- user_id ve mode (auto/refresh) alır
- auto: her kategoriden 1 öneri (4 toplam)
- refresh: her kategoriden 3 öneri (12 toplam)
- suggestions tablosuna kaydeder
- Günde 1 kez otomatik üretilir

### zeeky-notifications
Şunları kontrol eder:
- Bütçe aşımı (%75 ve %90)
- 3 gündür spor yapılmadı
- 5 gündür sosyal aktivite yok
- Yaklaşan ödemeler (3 gün içinde)
- Haftalık özet (Pazartesi)
- Aylık özet (ayın son günü)
Aynı tipte bugün zaten bildirim varsa tekrar üretmez.

### zeeky-summarize
Tüm kullanıcı verilerini analiz eder:
- Kişisel profil
- Son 30 gün aktiviteleri
- Bu ayın transactions
- Hafıza kayıtları
4 özet üretir: summary, health_summary, finance_summary, social_summary
user_summaries tablosuna upsert eder.

---

## 8. AUTH SİSTEMİ

- Supabase Auth kullanılıyor
- E-posta + şifre ile kayıt/giriş
- Yeni kayıt olunca trigger ile users + user_profiles otomatik oluşur
- ProtectedRoute component'i ile korunan rotalar
- useAuthStore (Zustand) ile global auth state
- Şifre sıfırlama e-posta ile

**Redirect URLs (Supabase'de kayıtlı):**
```
https://zeeky.vercel.app
https://zeeky.vercel.app/auth/callback
http://localhost:5173
http://localhost:5173/auth/callback
```

---

## 9. STATE YÖNETİMİ (ZUSTAND STORES)

| Store | Görev |
|-------|-------|
| useAuthStore | Kullanıcı auth durumu |
| useChatStore | Sohbet mesajları (sayfa değişince sıfırlanmaz) |
| useCurrencyStore | Para birimi (symbol, code) |

---

## 10. ÖNEMLİ DOSYALAR

```
src/
├── lib/
│   ├── supabase.ts          → Supabase client
│   ├── auth.ts              → Auth fonksiyonları
│   ├── activitySupabase.ts  → Aktivite DB işlemleri
│   ├── transactionSupabase.ts → Transaction DB işlemleri
│   ├── friendsSupabase.ts   → Arkadaş DB işlemleri
│   └── currency.ts          → Para birimi yardımcıları
├── store/
│   ├── useAuthStore.ts
│   ├── useChatStore.ts
│   └── useCurrencyStore.ts
├── components/
│   ├── CategoryIcon.tsx     → Kategori ikon + renk
│   ├── FriendAutocomplete.tsx → Arkadaş autocomplete
│   ├── ProtectedRoute.tsx   → Auth koruması
│   └── BottomNav.tsx        → Alt navigasyon
└── pages/
    ├── HomePage.tsx
    ├── HistoryPage.tsx
    ├── FinancePage.tsx
    ├── SuggestionsPage.tsx
    ├── ProfilePage.tsx
    ├── NotificationsPage.tsx
    ├── AddActionPage.tsx
    ├── FriendsPage.tsx
    ├── SettingsPage.tsx
    ├── AuthPage.tsx
    ├── ResetPasswordPage.tsx
    └── AuthCallbackPage.tsx
```

---

## 11. DEPLOY

### Vercel
```
URL: https://zeeky.vercel.app
GitHub repo'ya push yapılınca otomatik deploy
```

### Environment Variables (Vercel + .env.local)
```
VITE_SUPABASE_URL=https://gmcmreinpnhuszxlpgpj.supabase.co
VITE_SUPABASE_ANON_KEY=...
VITE_ZEEKY_FUNCTION_URL=https://gmcmreinpnhuszxlpgpj.supabase.co/functions/v1/zeeky-chat
```

### Güncelleme Komutu
```bash
git add .
git commit -m "açıklama"
git push
```

---

## 12. TAMAMLANAN ÖZELLİKLER ✅

- Ana sayfa sohbet ekranı (GPT-4o-mini entegre)
- Konuşmadan otomatik aktivite + transaction çıkarma
- Aktivite ekleme (sohbet + manuel)
- 9 kategori sistemi
- Neler Yaptım sayfası (takvim, favoriler, düzenleme)
- Gelir & Gider sayfası (transactions, grafikler, filtreleme)
- Alt kategoriler sistemi
- Tavsiyeler sayfası (AI önerileri, filtre)
- Bildirimler sayfası
- Kapsamlı profil sayfası
- Arkadaşlar sayfası (FriendAutocomplete dahil)
- Ayarlar sayfası (şifre değiştirme, para birimi, kişilik)
- Kullanıcı Auth sistemi (Supabase Auth)
- Para birimi sistemi (çoklu para birimi)
- User Summary sistemi (AI özet profili)
- Vercel deployment

---

## 13. SIRADAKI ÖZELLİKLER ⏳ (Öncelik Sırasıyla)

1. **Haftalık özet ekranı**
2. **Arama özelliği**
3. **Genel tasarım düzenlemeleri**
4. **Capacitor ile native mobil uygulamaya geçiş**
   - Arka plan konum takibi
   - Apple HealthKit / Google Health Connect
   - Push bildirimleri
   - App Store + Google Play yayını

---

## 14. GELİR MODELİ (Planlandı)

- **Free:** Sınırlı özellikler
- **Standart:** ~4.99€/ay
- **Premium:** ~9.99€/ay
- **Lifetime:** ~49.99€ (lansman dönemi)
- **Kurumsal:** Kullanıcı başına 3-5€/ay

Teknik hazırlık: users tablosunda plan_type, plan_expires_at, stripe_customer_id alanları mevcut.

---

## 15. MALİYET TAHMİNİ (1000 Kullanıcı)

| Kalem | Aylık |
|-------|-------|
| Supabase Pro | $25 |
| OpenAI API | $80-150 |
| Vercel (web) | $0-20 |
| **Toplam** | **~$105-195** |

---

## 16. ÖNEMLİ TEKNİK KARARLAR

1. **Lovable → Cursor'a taşındı** (Lovable kredi sorunu)
2. **Make.com yerine Supabase Edge Functions** (limit sorunu)
3. **Claude API yerine OpenAI GPT-4o-mini** (mevcut OpenAI kredisi)
4. **FlutterFlow yerine React+Vite** (daha esnek)
5. **Capacitor seçildi** (React Native yerine, mevcut kodu korur)
6. **User Summary sistemi** (her mesajda büyük sorgu yerine özet fısıldama)
7. **Harcama kategorisi kaldırıldı** (transactions ayrı tablo)
8. **Tarih düzeltme** (GPT eski tarih yazınca şu anki saat eklenir)

---

## 17. BİLİNEN SORUNLAR VE ÇÖZÜMLER

| Sorun | Çözüm |
|-------|-------|
| CORS hatası | Edge Functions'da corsHeaders eklendi, JWT verification kapalı |
| Token limit aşımı | Prompt kısaltıldı, User Summary sistemi eklendi |
| Vercel alias güncellenmemesi | `vercel alias` komutu ile manuel güncelleme |
| GPT yanlış tarih yazıyor | UTC 00:00:00 kontrolü ile şu anki saat ekleniyor |
| Çift kayıt sorunu | Frontend'den Supabase insert kaldırıldı, sadece Edge Function kaydediyor |

---

## 18. CURSOR İÇİN HATIRLATMALAR

- Tüm sayfalar `useAuthStore`'dan `user?.id` alır (hardcoded UUID kullanılmaz)
- Test UUID: `520ffdd8-fd9e-472f-a388-021bded37b7f` (sadece geliştirme)
- Para birimi `useCurrencyStore`'dan gelir
- Sohbet geçmişi `useChatStore`'da tutulur (sayfa değişince sıfırlanmaz)
- Edge Function URL: `import.meta.env.VITE_SUPABASE_URL + '/functions/v1/zeeky-chat'`
- Git push sonrası Vercel otomatik deploy eder

---

*Son güncelleme: Mart 2026*
*Proje yöneticisi: Claude (Anthropic)*
