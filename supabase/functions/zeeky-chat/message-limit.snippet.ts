/**
 * MESSAGE LIMIT — zeeky-chat/index.ts içine eklenecek kod parçaları
 *
 * Bu dosyayı doğrudan deploy etme; Supabase Dashboard'daki
 * zeeky-chat editörüne aşağıdaki bloğu ekle.
 *
 * ── 1. Promise.all içine users sorgusunu ekle ──────────────────────────
 *
 *   const [
 *     { data: profileData },
 *     { data: historyData },
 *     { data: userData },        // ← YENİ
 *   ] = await Promise.all([
 *     supabase.from("user_profiles").select("...").eq("user_id", user_id).single(),
 *     supabase.from("conversations").select("...").eq("user_id", user_id).order(...).limit(...),
 *     supabase.from("users")                                              // ← YENİ
 *       .select("plan_type, daily_message_count, daily_message_date")    // ← YENİ
 *       .eq("id", user_id)                                               // ← YENİ
 *       .single(),                                                        // ← YENİ
 *   ]);
 *
 * ── 2. Limit kontrolü (Promise.all'dan hemen sonra) ───────────────────
 */

// ↓ Bu bloğu Promise.all sonrasına ekle:
export function buildMessageLimitCheck(corsHeaders: Record<string, string>) {
  return function checkLimit(userData: {
    plan_type?: string | null;
    daily_message_count?: number | null;
    daily_message_date?: string | null;
  } | null) {
    const FREE_LIMIT = 10;
    const today = new Date().toISOString().split("T")[0];
    const isNewDay = userData?.daily_message_date !== today;
    const currentCount = isNewDay ? 0 : (userData?.daily_message_count ?? 0);
    const isPremium = userData?.plan_type === "premium";

    if (!isPremium && currentCount >= FREE_LIMIT) {
      return new Response(
        JSON.stringify({
          error: "message_limit_reached",
          limit: FREE_LIMIT,
          plan: "free",
        }),
        {
          status: 429,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }
    return { isNewDay, currentCount };
  };
}

/**
 * ── 3. OpenAI çağrısından SONRA sayacı güncelle ───────────────────────
 *
 *   await supabase
 *     .from("users")
 *     .update({
 *       daily_message_count: isNewDay ? 1 : currentCount + 1,
 *       daily_message_date: today,
 *     })
 *     .eq("id", user_id);
 *
 * ── Genel yerleşim şeması ─────────────────────────────────────────────
 *
 *   const [profileData, historyData, userData] = await Promise.all([...])
 *
 *   const today = new Date().toISOString().split("T")[0]
 *   const isNewDay = userData?.daily_message_date !== today
 *   const currentCount = isNewDay ? 0 : (userData?.daily_message_count ?? 0)
 *   const isPremium = userData?.plan_type === "premium"
 *   const FREE_LIMIT = 10
 *
 *   if (!isPremium && currentCount >= FREE_LIMIT) {
 *     return new Response(
 *       JSON.stringify({ error: "message_limit_reached", limit: FREE_LIMIT, plan: "free" }),
 *       { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
 *     )
 *   }
 *
 *   // ... OpenAI çağrısı ...
 *
 *   await supabase
 *     .from("users")
 *     .update({
 *       daily_message_count: isNewDay ? 1 : currentCount + 1,
 *       daily_message_date: today,
 *     })
 *     .eq("id", user_id)
 */
