import { useEffect, useMemo, useState } from 'react';
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
  new_users_7d: number;
  messages_today: number;
  messages_7d: number;
  total_activities: number;
  total_transactions: number;
}

interface AdminUser {
  id: string;
  full_name: string | null;
  email: string | null;
  plan_type: string | null;
  is_admin: boolean | null;
  message_count: number | null;
  activity_count: number | null;
  last_active: string | null;
  created_at: string | null;
}

interface AppSetting {
  key: string;
  value: string;
  description: string | null;
  updated_at: string | null;
}

const APP_SETTING_GROUPS: { title: string; keys: string[] }[] = [
  {
    title: 'MESAJ LİMİTLERİ',
    keys: [
      'free_daily_messages',
      'free_monthly_activities',
      'free_monthly_transactions',
      'premium_daily_messages',
    ],
  },
  {
    title: 'EURO FİYATLARI',
    keys: ['premium_monthly_price_eur', 'premium_yearly_price_eur'],
  },
  {
    title: 'DOLAR FİYATLARI',
    keys: ['premium_monthly_price_usd', 'premium_yearly_price_usd'],
  },
  {
    title: 'TÜRK LİRASI FİYATLARI',
    keys: ['premium_monthly_price_try', 'premium_yearly_price_try'],
  },
  {
    title: 'STERLİN FİYATLARI',
    keys: ['premium_monthly_price_gbp', 'premium_yearly_price_gbp'],
  },
];

function StatCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="bg-gray-800 rounded-2xl p-4 flex flex-col gap-1">
      <p className="text-xs text-gray-400 font-medium">{label}</p>
      <p className="text-2xl font-bold text-white">{value ?? '—'}</p>
      {sub && <p className="text-xs text-gray-500">{sub}</p>}
    </div>
  );
}

function PlanBadge({ plan }: { plan: string | null }) {
  if (plan === 'premium') {
    return (
      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
        Premium
      </span>
    );
  }
  return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-700 text-gray-400 border border-gray-600">
      Free
    </span>
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
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (tab !== 'users') return;
    setUsersLoading(true);
    supabase
      .from('admin_users')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => setUsers((data as AdminUser[]) || []))
      .finally(() => setUsersLoading(false));
  }, [tab]);

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

  const toggleAdmin = async (userId: string, current: boolean | null) => {
    const { error } = await supabase
      .from('users')
      .update({ is_admin: !current })
      .eq('id', userId);
    if (error) { toast.error('Yetki değiştirilemedi'); return; }
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_admin: !current } : u));
    toast.success(!current ? 'Admin yapıldı' : 'Admin yetkisi kaldırıldı');
  };

  // ── Settings ──────────────────────────────────────────────────────────────
  const [appSettings, setAppSettings] = useState<AppSetting[]>([]);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [savedKey, setSavedKey] = useState<string | null>(null);

  const settingsByKey = useMemo(
    () => Object.fromEntries(appSettings.map(s => [s.key, s])) as Record<string, AppSetting>,
    [appSettings],
  );

  const groupedKeySet = useMemo(
    () => new Set(APP_SETTING_GROUPS.flatMap(g => g.keys)),
    [],
  );

  const otherSettings = useMemo(
    () => appSettings.filter(s => !groupedKeySet.has(s.key)),
    [appSettings, groupedKeySet],
  );

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
    if (error) {
      toast.error('Ayar kaydedilemedi');
      return;
    }
    toast.success('Kaydedildi');
    setSavedKey(key);
    window.setTimeout(() => setSavedKey(null), 2000);
  };

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const TABS: { id: Tab; label: string; Icon: typeof BarChart3 }[] = [
    { id: 'overview', label: 'Genel Bakış', Icon: BarChart3 },
    { id: 'users', label: 'Kullanıcılar', Icon: Users },
    { id: 'settings', label: 'Ayarlar', Icon: Settings2 },
  ];

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

        {/* Tabs */}
        <div className="flex gap-1 -mb-px">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
                tab === id
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-300',
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-24 space-y-4">
        {/* ── OVERVIEW ── */}
        {tab === 'overview' && (
          statsLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
            </div>
          ) : !stats ? (
            <p className="text-center text-gray-500 py-16">Veri alınamadı.<br /><span className="text-xs">admin_stats view mevcut mu?</span></p>
          ) : (
            <>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Kullanıcılar</h2>
              <div className="grid grid-cols-2 gap-3">
                <StatCard label="Toplam Kullanıcı" value={stats.total_users} />
                <StatCard label="Premium" value={stats.premium_users} />
                <StatCard label="Ücretsiz" value={stats.free_users} />
                <StatCard label="Son 7 gün yeni" value={stats.new_users_7d} />
              </div>

              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider pt-2">Mesajlar</h2>
              <div className="grid grid-cols-2 gap-3">
                <StatCard label="Bugün" value={stats.messages_today} />
                <StatCard label="Son 7 gün" value={stats.messages_7d} />
              </div>

              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider pt-2">Aktivite</h2>
              <div className="grid grid-cols-2 gap-3">
                <StatCard label="Toplam Eylem" value={stats.total_activities} />
                <StatCard label="Toplam İşlem" value={stats.total_transactions} />
              </div>
            </>
          )
        )}

        {/* ── USERS ── */}
        {tab === 'users' && (
          <>
            <div className="relative">
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
              <div className="space-y-3">
                {filteredUsers.map(u => (
                  <div key={u.id} className="bg-gray-800 rounded-2xl p-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-white truncate">
                            {u.full_name || '—'}
                          </p>
                          <PlanBadge plan={u.plan_type} />
                          {u.is_admin && (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                              Admin
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 truncate mt-0.5">{u.email || '—'}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mb-3 text-center">
                      <div className="bg-gray-700/50 rounded-xl p-2">
                        <p className="text-xs text-gray-500">Mesaj</p>
                        <p className="text-sm font-bold text-white">{u.message_count ?? 0}</p>
                      </div>
                      <div className="bg-gray-700/50 rounded-xl p-2">
                        <p className="text-xs text-gray-500">Eylem</p>
                        <p className="text-sm font-bold text-white">{u.activity_count ?? 0}</p>
                      </div>
                      <div className="bg-gray-700/50 rounded-xl p-2">
                        <p className="text-xs text-gray-500">Kayıt</p>
                        <p className="text-[11px] font-medium text-white">{formatDate(u.created_at)}</p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {u.plan_type === 'premium' ? (
                        <button
                          type="button"
                          onClick={() => void changePlan(u.id, 'free')}
                          className="flex-1 py-2 text-xs font-semibold rounded-xl bg-gray-700 text-gray-300 active:scale-[0.98]"
                        >
                          → Free yap
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void changePlan(u.id, 'premium')}
                          className="flex-1 py-2 text-xs font-semibold rounded-xl bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 active:scale-[0.98]"
                        >
                          ✨ Premium yap
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void toggleAdmin(u.id, u.is_admin)}
                        className={cn(
                          'flex-1 py-2 text-xs font-semibold rounded-xl active:scale-[0.98]',
                          u.is_admin
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                            : 'bg-gray-700 text-gray-300',
                        )}
                      >
                        {u.is_admin ? '🛡️ Admin kaldır' : '🛡️ Admin yap'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── SETTINGS ── */}
        {tab === 'settings' && (
          settingsLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
            </div>
          ) : appSettings.length === 0 ? (
            <p className="text-center text-gray-500 py-12">Ayar bulunamadı</p>
          ) : (
            <div>
              {APP_SETTING_GROUPS.map((group, gi) => {
                const rows = group.keys.map(k => settingsByKey[k]).filter(Boolean) as AppSetting[];
                if (rows.length === 0) return null;
                return (
                  <div key={group.title}>
                    <p
                      className={cn(
                        'text-xs font-bold text-gray-400 uppercase tracking-wider mb-2',
                        gi === 0 ? 'mt-0' : 'mt-4',
                      )}
                    >
                      {group.title}
                    </p>
                    <div className="bg-gray-800 rounded-2xl overflow-hidden">
                      {rows.map((s, ri) => (
                        <div
                          key={s.key}
                          className={cn(
                            'flex items-center justify-between gap-4 px-4 py-3',
                            ri < rows.length - 1 && 'border-b border-gray-700',
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-white">{s.key}</p>
                            {s.description && (
                              <p className="text-xs text-gray-400 mt-0.5">{s.description}</p>
                            )}
                          </div>
                          <div className="flex items-center shrink-0">
                            <input
                              type="text"
                              defaultValue={s.value}
                              onBlur={e => void updateSetting(s.key, e.target.value)}
                              className="w-24 text-right bg-gray-700 border border-gray-600 rounded-xl px-3 py-1.5 text-sm text-white outline-none focus:border-blue-500"
                            />
                            {savedKey === s.key && (
                              <span className="text-xs text-green-500 ml-2 whitespace-nowrap">
                                ✓ Kaydedildi
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {otherSettings.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 mt-4">
                    Diğer
                  </p>
                  <div className="bg-gray-800 rounded-2xl overflow-hidden">
                    {otherSettings.map((s, i) => (
                      <div
                        key={s.key}
                        className={cn(
                          'flex items-center justify-between gap-4 px-4 py-3',
                          i < otherSettings.length - 1 && 'border-b border-gray-700',
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-white">{s.key}</p>
                          {s.description && (
                            <p className="text-xs text-gray-400 mt-0.5">{s.description}</p>
                          )}
                        </div>
                        <div className="flex items-center shrink-0">
                          <input
                            type="text"
                            defaultValue={s.value}
                            onBlur={e => void updateSetting(s.key, e.target.value)}
                            className="w-24 text-right bg-gray-700 border border-gray-600 rounded-xl px-3 py-1.5 text-sm text-white outline-none focus:border-blue-500"
                          />
                          {savedKey === s.key && (
                            <span className="text-xs text-green-500 ml-2 whitespace-nowrap">
                              ✓ Kaydedildi
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
}
