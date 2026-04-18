/**
 * LOCATION INTEGRATION — zeeky-chat/index.ts içine eklenecek kod parçaları
 *
 * Bu dosyayı doğrudan deploy etme; Supabase Dashboard'daki
 * zeeky-chat editörüne aşağıdaki bloğu ekle.
 *
 * ── 1. req.json() destructuring'ine location ekle ─────────────────────
 *
 *   const {
 *     message, user_id, personality, timezone,
 *     current_datetime, language,
 *     location,   // ← YENİ
 *   } = await req.json();
 *
 *   // location tipi:
 *   // { lat: number; lon: number; displayName: string; shortName: string } | null
 *
 * ── 2. System prompt RULES bölümüne ekle ──────────────────────────────
 *
 *   RULES bölümündeki son maddenin numarasından sonra şunu ekle
 *   (mevcut son madde 10 ise, bu 11 olur):
 *
 *   `11. USER CURRENT LOCATION: ${
 *     location
 *       ? `${location.displayName} (${location.lat}, ${location.lon})`
 *       : 'Unknown'
 *   }. If activity has a physical location and user location is known,
 *   use it. For food/drink/shopping/entertainment activities, set location
 *   field to display name.`
 *
 * ── 3. activitiesToInsert içindeki location alanını güncelle ──────────
 *
 *   Şu anki:
 *     location: act.location || null,
 *
 *   Bununla değiştir:
 *     location: act.location ||
 *       (location && ['yeme-içme', 'eğlence', 'alışveriş', 'seyahat']
 *         .includes(act.category)
 *         ? location.displayName
 *         : null),
 *     location_lat: act.location_lat ||
 *       (location && ['yeme-içme','eğlence','alışveriş','seyahat',
 *         'sağlık-spor','sosyal','iş-eğitim','ev-yaşam','diğer']
 *         .includes(act.category) ? location.lat : null),
 *     location_lon: act.location_lon ||
 *       (location && ['yeme-içme','eğlence','alışveriş','seyahat',
 *         'sağlık-spor','sosyal','iş-eğitim','ev-yaşam','diğer']
 *         .includes(act.category) ? location.lon : null),
 */

// Tip referansı (index.ts içinde kullanmak için)
export interface LocationPayload {
  lat: number;
  lon: number;
  displayName: string;
  shortName: string;
}
