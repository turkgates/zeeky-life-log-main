import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Search, Users, BarChart3, Settings2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type Tab = 'overview' | 'users' | 'settings';

interface AdminStats {
  total_users: number;
  premium_users: number;
  free_users: number;
  new_users_7days: number;
  messages_today: number;
  messages_7days: number;
  total_activities: number;
  total_transactions: number;
}

interface AdminUser {
  id: string;
  full_name: string | null;
  email: string | null;
  plan_type: string | null;
  is_admin: boolean | null;
  total_messages: number | null;
  total_activities: number | null;
  total_transactions: number | null;
  last_active: string | null;
  created_at: string | null;
}

interface AppSetting {
  key: string;
  value: string;
  description: string | null;
  updated_at: string | null;
}

// ── Sabitler ──────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

const SETTING_LABELS: Record<string, string> = {
  free_daily_messages: 'Ücretsiz günlük mesaj limiti',
  free_monthly_activities: 'Ücretsiz aylık aktivite limiti',
  free_monthly_transactions: 'Ücretsiz aylık işlem limiti',
  premium_daily_messages: 'Premium günlük mesaj limiti',
};

const LIMIT_KEYS = [
  'free_daily_messages',
  'free_monthly_activities',
  'free_monthly_transactions',
  'premium_daily_messages',
];

const CURRENCIES = [
  { key: 'eur', label: '€ Euro',  lang: 'fr', langLabel: 'Fransızca 🇫🇷' },
  { key: 'usd', label: '$ Dolar', lang: 'en', langLabel: 'İngilizce 🇬🇧' },
  { key: 'try', label: '₺ Lira',  lang: 'tr', langLabel: 'Türkçe 🇹🇷'    },
];

// ── Yardımcı bileşenler ───────────────────────────────────────────────────────

function StatCard({ label, value, icon }: { label: string; value?: number | string; icon: string }) {
  return (
    <div className="bg-gray-800 rounded-2xl p-4 flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <span className="text-sm">{icon}</span>
        <p className="text-xs text-gray-400 font-medium">{label}</p>
      </div>
      <p className="text-2xl font-bold text-white">{value ?? '—'}</p>
    </div>
  );
}

export function AdminPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('overview');

  // ── Overview ──────────────────────────────────────────────────────────────
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    setStatsLoading(true);
    supabase
      .from('admin_stats')
      .select('*')
      .single()
      .then(({ data }) => setStats(data as AdminStats))
      .finally(() => setStatsLoading(false));
  }, []);

  // ── Users ─────────────────────────────────────────────────────────────────
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const usersScrollRef = useRef<HTMLDivElement>(null);

  const loadUsers = async (pageNum: number) => {
    if (pageNum === 0) setUsersLoading(true);
    else setIsLoadingMore(true);

    const { data } = await supabase
      .from('admin_users')
      .select('*')
      .order('created_at', { ascending: false })
      .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1);

    const rows = (data as AdminUser[]) || [];
    if (pageNum === 0) setUsers(rows);
    else setUsers(prev => [...prev, ...rows]);
    setHasMore(rows.length === PAGE_SIZE);

    if (pageNum === 0) setUsersLoading(false);
    else setIsLoadingMore(false);
  };

  useEffect(() => {
    if (tab !== 'users') return;
    setPage(0);
    setHasMore(true);
    void loadUsers(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const handleUsersScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 120 && hasMore && !isLoadingMore) {
      const next = page + 1;
      setPage(next);
      void loadUsers(next);
    }
  };

  const filteredUsers = users.filter(u =>
    !search ||
    u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase()),
  );

  const changePlan = async (userId: string, newPlan: string) => {
    const { error } = await supabase
      .from('users')
      .update({
        plan_type: newPlan,
        plan_expires_at: newPlan === 'premium'
          ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
          : null,
      })
      .eq('id', userId);
    if (error) { toast.error('Plan değiştirilemedi'); return; }
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, plan_type: newPlan } : u));
    toast.success(`Plan: ${newPlan}`);
  };

  const makeAdmin = async (userId: string) => {
    const { error } = await supabase
      .from('users')
      .update({ is_admin: true })
      .eq('id', userId);
    if (error) { toast.error('Yetki değiştirilemedi'); return; }
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_admin: true } : u));
    toast.success('Admin yapıldı');
  };

  // ── Settings ──────────────────────────────────────────────────────────────
  const [appSettings, setAppSettings] = useState<AppSetting[]>([]);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [selectedCurrency, setSelectedCurrency] = useState('eur');

  const getSettingValue = (key: string) =>
    appSettings.find(s => s.key === key)?.value ?? '';

  useEffect(() => {
    if (tab !== 'settings') return;
    setSettingsLoading(true);
    supabase
      .from('app_settings')
      .select('*')
      .order('key')
      .then(({ data }) => setAppSettings((data as AppSetting[]) || []))
      .finally(() => setSettingsLoading(false));
  }, [tab]);

  const updateSetting = async (key: string, value: string) => {
    const { error } = await supabase
      .from('app_settings')
      .update({ value, updated_at: new Date().toISOString() })
      .eq('key', key);
    if (error) { toast.error('Ayar kaydedilemedi'); return; }
    setAppSettings(prev => prev.map(s => s.key === key ? { ...s, value } : s));
    setSavedKey(key);
    window.setTimeout(() => setSavedKey(null), 2000);
  };

  // ── Diğer ─────────────────────────────────────────────────────────────────
  const formatLastActive = (d: string | null) => {
    if (!d) return 'Henüz aktif değil';
    return new Date(d).toLocaleDateString('tr-TR', {
      day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const TABS: { id: Tab; label: string; Icon: typeof BarChart3 }[] = [
    { id: 'overview', label: 'Genel Bakış', Icon: BarChart3 },
    { id: 'users', label: 'Kullanıcılar', Icon: Users },
    { id: 'settings', label: 'Ayarlar', Icon: Settings2 },
  ];

  const activeCurrency = CURRENCIES.find(c => c.key === selectedCurrency) ?? CURRENCIES[0];

  return (
    <div className="h-screen flex flex-col bg-gray-950 text-white w-full">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 pt-12 pb-0 shrink-0">
        <div className="flex items-center gap-3 mb-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-800 text-gray-300"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-white">🛡️ Admin Paneli</h1>
            <p className="text-xs text-gray-500">Zeeky yönetim arayüzü</p>
          </div>
        </div>

        <div className="flex gap-1 -mb-px">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
                tab === id ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-300',
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── OVERVIEW ──────────────────────────────────────────────────────── */}
      {tab === 'overview' && (
        <div className="flex-1 overflow-y-auto px-4 pt-4 pb-24 space-y-4">
          {statsLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
            </div>
          ) : !stats ? (
            <p className="text-center text-gray-500 py-16">
              Veri alınamadı.<br />
              <span className="text-xs">admin_stats view mevcut mu?</span>
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <StatCard icon="👥" label="Toplam Kullanıcı"    value={stats.total_users}       />
              <StatCard icon="⭐" label="Premium Kullanıcı"   value={stats.premium_users}     />
              <StatCard icon="🆓" label="Ücretsiz Kullanıcı"  value={stats.free_users}        />
              <StatCard icon="🆕" label="Son 7 Günde Yeni"    value={stats.new_users_7days}   />
              <StatCard icon="💬" label="Bugün Sohbet"        value={stats.messages_today}    />
              <StatCard icon="📊" label="Son 7 Gün Sohbet"    value={stats.messages_7days}    />
              <StatCard icon="🎯" label="Toplam Eylem"        value={stats.total_activities}  />
              <StatCard icon="💰" label="Toplam İşlem"        value={stats.total_transactions}/>
            </div>
          )}
        </div>
      )}

      {/* ── USERS ─────────────────────────────────────────────────────────── */}
      {tab === 'users' && (
        <div
          ref={usersScrollRef}
          className="flex-1 overflow-y-auto px-4 pt-4 pb-24"
          onScroll={handleUsersScroll}
        >
          {/* Arama */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="İsim veya e-posta ara..."
              className="w-full bg-gray-800 border border-gray-700 rounded-2xl pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-gray-500 outline-none focus:border-blue-500"
            />
          </div>

          {usersLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <p className="text-center text-gray-500 py-12">Kullanıcı bulunamadı</p>
          ) : (
            <>
              {filteredUsers.map(u => (
                <div key={u.id} className="bg-gray-800 rounded-2xl p-4 mb-3">
                  {/* Üst — isim & plan */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">
                        {u.full_name || '—'}
                      </p>
                      <p className="text-xs text-gray-400 truncate mt-0.5">{u.email || '—'}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {u.is_admin && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                          🛡️
                        </span>
                      )}
                      <span className={cn(
                        'text-xs font-bold px-2.5 py-1 rounded-full',
                        u.plan_type === 'premium'
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-gray-700 text-gray-400',
                      )}>
                        {u.plan_type === 'premium' ? '⭐ Premium' : 'Free'}
                      </span>
                    </div>
                  </div>

                  {/* İstatistikler */}
                  <div className="grid grid-cols-3 gap-2 mb-3 text-center">
                    {[
                      { icon: '💬', label: 'Sohbet',  value: u.total_messages    },
                      { icon: '🎯', label: 'Eylem',   value: u.total_activities  },
                      { icon: '💰', label: 'İşlem',   value: u.total_transactions },
                    ].map(stat => (
                      <div key={stat.label} className="bg-gray-700/50 rounded-xl p-2">
                        <p className="text-sm font-bold text-white">{stat.value ?? 0}</p>
                        <p className="text-xs text-gray-400">{stat.icon} {stat.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Son aktif */}
                  <p className="text-xs text-gray-500 mb-3">
                    Son aktif: {formatLastActive(u.last_active)}
                  </p>

                  {/* Butonlar */}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void changePlan(u.id, u.plan_type === 'premium' ? 'free' : 'premium')}
                      className={cn(
                        'flex-1 py-2 rounded-xl text-xs font-semibold active:scale-[0.98] transition-transform',
                        u.plan_type === 'premium'
                          ? 'bg-gray-700 text-gray-300'
                          : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
                      )}
                    >
                      {u.plan_type === 'premium' ? "→ Free'e Geçir" : '⭐ Premium Yap'}
                    </button>
                    {!u.is_admin && (
                      <button
                        type="button"
                        onClick={() => void makeAdmin(u.id)}
                        className="px-3 py-2 rounded-xl text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/30 active:scale-[0.98] transition-transform"
                      >
                        🛡️ Admin
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {isLoadingMore && (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
                </div>
              )}
              {!hasMore && users.length > 0 && (
                <p className="text-center text-xs text-gray-500 py-4">
                  Tüm kullanıcılar yüklendi ({users.length})
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* ── SETTINGS ──────────────────────────────────────────────────────── */}
      {tab === 'settings' && (
        <div className="flex-1 overflow-y-auto px-4 pt-4 pb-24">
          {settingsLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
            </div>
          ) : (
            <div className="space-y-6">

              {/* ─── 1. GENEL LİMİTLER ─── */}
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                  📊 Genel Limitler
                </p>
                <div className="bg-gray-800 rounded-2xl overflow-hidden">
                  {LIMIT_KEYS.map((key, i) => (
                    <div
                      key={key}
                      className={cn(
                        'flex items-center justify-between gap-4 px-4 py-3',
                        i < LIMIT_KEYS.length - 1 && 'border-b border-gray-700',
                      )}
                    >
                      <p className="text-sm font-medium text-gray-200 flex-1">
                        {SETTING_LABELS[key] ?? key}
                      </p>
                      <div className="flex items-center gap-2 shrink-0">
                        <input
                          type="number"
                          defaultValue={getSettingValue(key)}
                          onBlur={e => void updateSetting(key, e.target.value)}
                          className="w-20 text-right bg-gray-700 border border-gray-600 rounded-xl px-3 py-1.5 text-sm text-white outline-none focus:border-blue-500"
                        />
                        {savedKey === key && (
                          <span className="text-xs text-green-400">✓</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ─── 2. KAMPANYA AYARLARI ─── */}
              <div>
                <p className="text-xs font-bold text-orange-400 uppercase tracking-wider mb-3">
                  🎉 Kampanya Ayarları
                </p>
                <div className="bg-gray-800 rounded-2xl overflow-hidden px-4">

                  {/* Toggle */}
                  <div className="flex items-center justify-between py-4 border-b border-gray-700">
                    <div>
                      <p className="text-sm font-semibold text-white">Kampanya Aktif</p>
                      <p className="text-xs text-gray-400 mt-0.5">Açıkken kampanya fiyatları gösterilir</p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        void updateSetting(
                          'campaign_active',
                          getSettingValue('campaign_active') === 'true' ? 'false' : 'true',
                        )
                      }
                      className={cn(
                        'w-12 h-6 rounded-full transition-colors relative shrink-0',
                        getSettingValue('campaign_active') === 'true' ? 'bg-orange-500' : 'bg-gray-600',
                      )}
                    >
                      <div
                        className={cn(
                          'w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform shadow',
                          getSettingValue('campaign_active') === 'true' ? 'translate-x-6' : 'translate-x-0.5',
                        )}
                      />
                    </button>
                  </div>

                  {/* Bitiş tarihi */}
                  <div className="py-4 border-b border-gray-700">
                    <p className="text-sm font-semibold text-white mb-2">Kampanya Bitiş Tarihi</p>
                    <input
                      type="date"
                      value={getSettingValue('campaign_end_date')}
                      onChange={e => void updateSetting('campaign_end_date', e.target.value)}
                      className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-orange-400 [color-scheme:dark]"
                    />
                  </div>

                  {/* Etiketler */}
                  {[
                    { key: 'campaign_label_tr', lang: '🇹🇷 Türkçe Etiket' },
                    { key: 'campaign_label_en', lang: '🇬🇧 İngilizce Etiket' },
                    { key: 'campaign_label_fr', lang: '🇫🇷 Fransızca Etiket' },
                  ].map(item => (
                    <div key={item.key} className="py-3 border-b border-gray-700">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-gray-200">{item.lang}</p>
                        {savedKey === item.key && <span className="text-xs text-green-400">✓ Kaydedildi</span>}
                      </div>
                      <input
                        type="text"
                        defaultValue={getSettingValue(item.key)}
                        onBlur={e => void updateSetting(item.key, e.target.value)}
                        placeholder="Örn: Lansmana Özel"
                        className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-gray-500 outline-none focus:border-orange-400"
                      />
                    </div>
                  ))}

                  {/* Açıklamalar */}
                  {[
                    { key: 'campaign_desc_tr', lang: '🇹🇷 Türkçe Açıklama' },
                    { key: 'campaign_desc_en', lang: '🇬🇧 İngilizce Açıklama' },
                    { key: 'campaign_desc_fr', lang: '🇫🇷 Fransızca Açıklama' },
                  ].map((item, i, arr) => (
                    <div key={item.key} className={cn('py-3', i < arr.length - 1 && 'border-b border-gray-700')}>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-gray-200">{item.lang}</p>
                        {savedKey === item.key && <span className="text-xs text-green-400">✓ Kaydedildi</span>}
                      </div>
                      <textarea
                        defaultValue={getSettingValue(item.key)}
                        onBlur={e => void updateSetting(item.key, e.target.value)}
                        placeholder="Örn: Sınırlı süre için özel fiyat!"
                        rows={3}
                        className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-gray-500 outline-none focus:border-orange-400 resize-none"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* ─── 3. FİYATLAR ─── */}
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                  💰 Fiyatlar
                </p>

                {/* Para birimi seçici (GBP yok) */}
                <div className="flex gap-2 mb-4">
                  {CURRENCIES.map(c => (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => setSelectedCurrency(c.key)}
                      className={cn(
                        'flex-1 py-2 rounded-xl text-xs font-bold border transition-colors',
                        selectedCurrency === c.key
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-500',
                      )}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>

                {/* Seçili para birimi bilgisi */}
                <p className="text-xs text-gray-500 mb-3">
                  Dil: <span className="text-gray-300">{activeCurrency.langLabel}</span>
                  {' · '}
                  Metin anahtarı: <span className="text-gray-300">campaign_*_{activeCurrency.lang}</span>
                </p>

                <div className="bg-gray-800 rounded-2xl overflow-hidden px-4">
                  {[
                    {
                      normalKey: `premium_monthly_price_${selectedCurrency}`,
                      campaignKey: `campaign_monthly_price_${selectedCurrency}`,
                      label: 'Aylık Fiyat',
                    },
                    {
                      normalKey: `premium_yearly_price_${selectedCurrency}`,
                      campaignKey: `campaign_yearly_price_${selectedCurrency}`,
                      label: 'Yıllık Fiyat',
                    },
                  ].map((item, i, arr) => (
                    <div key={item.normalKey} className={cn('py-4', i < arr.length - 1 && 'border-b border-gray-700')}>
                      <p className="text-sm font-semibold text-white mb-3">{item.label}</p>
                      <div className="flex gap-3">
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-xs text-gray-400">Normal Fiyat</p>
                            {savedKey === item.normalKey && <span className="text-xs text-green-400">✓</span>}
                          </div>
                          <input
                            type="number"
                            step="0.01"
                            defaultValue={getSettingValue(item.normalKey)}
                            onBlur={e => void updateSetting(item.normalKey, e.target.value)}
                            className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-sm text-center text-white outline-none focus:border-blue-500"
                          />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-xs text-orange-400">Kampanya Fiyatı</p>
                            {savedKey === item.campaignKey && <span className="text-xs text-green-400">✓</span>}
                          </div>
                          <input
                            type="number"
                            step="0.01"
                            defaultValue={getSettingValue(item.campaignKey)}
                            onBlur={e => void updateSetting(item.campaignKey, e.target.value)}
                            className="w-full bg-orange-900/30 border border-orange-700/50 rounded-xl px-3 py-2 text-sm text-center text-white outline-none focus:border-orange-400"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}
        </div>
      )}
    </div>
  );
}
