-- Ana bildirim anahtarı (yoksa)
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS notification_enabled boolean DEFAULT true;

-- Bildirim kategorileri (jsonb)
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS notification_settings jsonb
DEFAULT '{
  "weekly_summary": true,
  "budget_alerts": true,
  "sport_reminders": true,
  "social_reminders": true,
  "payment_reminders": true
}'::jsonb;
