import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Search, Users, BarChart2, Settings, MessageSquare, ScrollText } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { supabase } from '@/lib/supabase';
import { getLocalISOString } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type Tab = 'overview' | 'users' | 'settings' | 'feedback' | 'legal';

interface LegalDoc {
  id: string;
  doc_type: 'privacy_policy' | 'terms_of_service';
  language: string;
  version: string;
  title: string;
  content: string;
}

interface FeedbackRow {
  id: string;
  user_id: string;
  message: string;
  status: 'unread' | 'read' | 'resolved';
  created_at: string;
  user_email?: string | null;
}

interface AdminStats {
  total_users: number;
  premium_users: number;
  free_users: number;
  new_users_7days: number;
  messages_today: number;
  messages_7days: number;
  total_activities: number;
  total_transactions: number;
  active_users_today: number;
  active_users_7days: number;
  active_users_30days: number;
  new_users_30days: number;
  users_tr: number;
  users_en: number;
  users_fr: number;
  estimated_monthly_revenue_eur: number;
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
  const [categoryStats, setCategoryStats] = useState<{ name: string; count: number }[]>([]);

  const CATEGORY_TR: Record<string, string> = {
    'sağlık-spor': 'Sağlık & Spor',
    'sosyal': 'Sosyal',
    'iş-eğitim': 'İş & Eğitim',
    'eğlence': 'Eğlence',
    'alışveriş': 'Alışveriş',
    'yeme-içme': 'Yeme & İçme',
    'seyahat': 'Seyahat',
    'ev-yaşam': 'Ev & Yaşam',
    'harcama': 'Harcama',
    'diğer': 'Diğer',
    'gittim': 'Gittim',
    'yaptim': 'Yaptım',
    'uyudum': 'Uyudum',
    'izledim': 'İzledim',
    'spor': 'Spor',
    'sağlık': 'Sağlık',
    'iş': 'İş',
  };

  useEffect(() => {
    setStatsLoading(true);
    supabase
      .from('admin_stats')
      .select('*')
      .single()
      .then(({ data }) => setStats(data as AdminStats))
      .finally(() => setStatsLoading(false));
  }, []);

  useEffect(() => {
    supabase
      .from('activities')
      .select('category')
      .then(({ data }) => {
        if (!data) return;
        const counts: Record<string, number> = {};
        for (const row of data) {
          const cat = (row.category as string) || 'diğer';
          counts[cat] = (counts[cat] ?? 0) + 1;
        }
        const sorted = Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([key, count]) => ({ name: CATEGORY_TR[key] ?? key, count }));
        setCategoryStats(sorted);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // ── Feedback ──────────────────────────────────────────────────────────────
  const [feedbackRows, setFeedbackRows] = useState<FeedbackRow[]>([]);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const unreadCount = feedbackRows.filter(f => f.status === 'unread').length;

  useEffect(() => {
    if (tab !== 'feedback') return;
    setFeedbackLoading(true);
    supabase
      .from('feedback')
      .select('*, users(email)')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setFeedbackRows(
          ((data as Array<Record<string, unknown>>) || []).map(r => ({
            id: r.id as string,
            user_id: r.user_id as string,
            message: r.message as string,
            status: (r.status as FeedbackRow['status']) || 'unread',
            created_at: r.created_at as string,
            user_email: (r.users as { email?: string } | null)?.email ?? null,
          })),
        );
      })
      .finally(() => setFeedbackLoading(false));
  }, [tab]);

  const cycleFeedbackStatus = async (id: string, current: FeedbackRow['status']) => {
    const next: FeedbackRow['status'] =
      current === 'unread' ? 'read' : current === 'read' ? 'resolved' : 'unread';
    const { error } = await supabase.from('feedback').update({ status: next }).eq('id', id);
    if (error) { toast.error('Güncellenemedi'); return; }
    setFeedbackRows(prev => prev.map(f => f.id === id ? { ...f, status: next } : f));
  };

  // ── Legal Documents ────────────────────────────────────────────────────────
  const [legalLang, setLegalLang] = useState<'tr' | 'en' | 'fr'>('tr');
  const [legalDocs, setLegalDocs] = useState<LegalDoc[]>([]);
  const [legalLoading, setLegalLoading] = useState(false);
  const [legalSavedId, setLegalSavedId] = useState<string | null>(null);

  useEffect(() => {
    if (tab !== 'legal') return;
    setLegalLoading(true);
    supabase
      .from('legal_documents')
      .select('*')
      .eq('language', legalLang)
      .order('type', { ascending: true })
      .then(({ data }) => setLegalDocs((data as LegalDoc[]) || []))
      .finally(() => setLegalLoading(false));
  }, [tab, legalLang]);

  const saveLegalDoc = async (doc: LegalDoc, newTitle: string, newVersion: string, newContent: string) => {
    const { error } = await supabase
      .from('legal_documents')
      .update({ title: newTitle, version: newVersion, content: newContent, updated_at: getLocalISOString() })
      .eq('id', doc.id);
    if (error) { toast.error('Kaydedilemedi'); return; }
    setLegalDocs(prev => prev.map(d => d.id === doc.id ? { ...d, title: newTitle, version: newVersion, content: newContent } : d));
    setLegalSavedId(doc.id);
    window.setTimeout(() => setLegalSavedId(null), 2000);
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
      .update({ value, updated_at: getLocalISOString() })
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

  const TABS: { id: Tab; label: string; Icon: typeof BarChart2 }[] = [
    { id: 'overview',  label: 'Genel Bakış',     Icon: BarChart2     },
    { id: 'users',     label: 'Kullanıcılar',     Icon: Users         },
    { id: 'settings',  label: 'Ayarlar',          Icon: Settings      },
    { id: 'feedback',  label: 'Geri Bildirimler', Icon: MessageSquare },
    { id: 'legal',     label: 'Sözleşmeler',      Icon: ScrollText    },
  ];

  const activeCurrency = CURRENCIES.find(c => c.key === selectedCurrency) ?? CURRENCIES[0];

  return (
    <div className="h-screen flex flex-col bg-gray-950 text-white w-full">
      <div
        className="sticky z-10 bg-background"
        style={{
          top: 0,
          paddingTop: 'env(safe-area-inset-top, 0px)',
          marginTop: 'calc(-1 * env(safe-area-inset-top, 0px))',
        }}
      />
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 pt-4 pb-0 shrink-0">
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
              title={label}
              onClick={() => setTab(id)}
              className={cn(
                'relative flex items-center justify-center w-12 h-10 rounded-t-xl border-b-2 transition-colors',
                tab === id ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-300',
              )}
            >
              <Icon className="w-5 h-5" />
              {id === 'feedback' && unreadCount > 0 && (
                <span className="absolute top-1 right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── OVERVIEW ──────────────────────────────────────────────────────── */}
      {tab === 'overview' && (
        <div className="flex-1 overflow-y-auto px-4 pt-4 pb-24 space-y-6">
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
            <>
              {/* ── BÖLÜM 1: Kullanıcı Özeti ── */}
              <div>
                <p className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-3">👥 Kullanıcı Özeti</p>
                <div className="grid grid-cols-2 gap-3">
                  <StatCard icon="👥" label="Toplam Kullanıcı"   value={stats.total_users}      />
                  <StatCard icon="⭐" label="Premium Kullanıcı"  value={stats.premium_users}    />
                  <StatCard icon="🆓" label="Ücretsiz Kullanıcı" value={stats.free_users}       />
                  <StatCard icon="🆕" label="Son 7 Günde Yeni"   value={stats.new_users_7days}  />
                </div>
              </div>

              {/* ── BÖLÜM 2: Aktif Kullanıcılar ── */}
              <div>
                <p className="text-xs font-bold text-green-400 uppercase tracking-wider mb-3">🟢 Aktif Kullanıcılar</p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-green-900/30 border border-green-800/50 rounded-2xl p-3 flex flex-col gap-1">
                    <p className="text-[10px] text-green-400 font-medium">Bugün Aktif</p>
                    <p className="text-xl font-bold text-white">{stats.active_users_today ?? '—'}</p>
                  </div>
                  <div className="bg-green-900/30 border border-green-800/50 rounded-2xl p-3 flex flex-col gap-1">
                    <p className="text-[10px] text-green-400 font-medium">7 Gün Aktif</p>
                    <p className="text-xl font-bold text-white">{stats.active_users_7days ?? '—'}</p>
                  </div>
                  <div className="bg-green-900/30 border border-green-800/50 rounded-2xl p-3 flex flex-col gap-1">
                    <p className="text-[10px] text-green-400 font-medium">30 Gün Aktif</p>
                    <p className="text-xl font-bold text-white">{stats.active_users_30days ?? '—'}</p>
                  </div>
                </div>
                {stats.active_users_30days > 0 && (
                  <p className="text-xs text-green-400/70 mt-2 text-right">
                    DAU/MAU: {((stats.active_users_today / stats.active_users_30days) * 100).toFixed(1)}%
                  </p>
                )}
              </div>

              {/* ── BÖLÜM 3: Gelir Tahmini ── */}
              <div>
                <p className="text-xs font-bold text-yellow-400 uppercase tracking-wider mb-3">💰 Gelir Tahmini</p>
                <div className="bg-yellow-900/20 border border-yellow-700/40 rounded-2xl p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-yellow-300/80">Tahmini Aylık Gelir</span>
                    <span className="text-xl font-bold text-yellow-400">
                      {(stats.estimated_monthly_revenue_eur ?? 0).toFixed(0)} €
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-yellow-300/80">Tahmini Yıllık Gelir</span>
                    <span className="text-lg font-bold text-yellow-300">
                      {((stats.estimated_monthly_revenue_eur ?? 0) * 12).toFixed(0)} €
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-t border-yellow-800/40 pt-3">
                    <span className="text-sm text-yellow-300/80">Conversion Rate</span>
                    <span className="text-lg font-bold text-yellow-300">
                      {stats.total_users > 0
                        ? ((stats.premium_users / stats.total_users) * 100).toFixed(1)
                        : '0.0'}%
                    </span>
                  </div>
                </div>
              </div>

              {/* ── BÖLÜM 4: Dil Dağılımı ── */}
              <div>
                <p className="text-xs font-bold text-purple-400 uppercase tracking-wider mb-3">🌍 Dil Dağılımı</p>
                <div className="bg-gray-800 rounded-2xl p-4">
                  {(() => {
                    const langData = [
                      { name: 'TR 🇹🇷', value: stats.users_tr ?? 0, color: '#ef4444' },
                      { name: 'EN 🇬🇧', value: stats.users_en ?? 0, color: '#3b82f6' },
                      { name: 'FR 🇫🇷', value: stats.users_fr ?? 0, color: '#1e3a5f' },
                    ];
                    const total = langData.reduce((s, d) => s + d.value, 0);
                    return (
                      <div className="flex items-center gap-4">
                        <PieChart width={120} height={120}>
                          <Pie
                            data={langData}
                            cx={55}
                            cy={55}
                            innerRadius={30}
                            outerRadius={55}
                            paddingAngle={2}
                            dataKey="value"
                          >
                            {langData.map((entry, index) => (
                              <Cell key={index} fill={entry.color} />
                            ))}
                          </Pie>
                        </PieChart>
                        <div className="flex flex-col gap-2 flex-1">
                          {langData.map(d => (
                            <div key={d.name} className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                                <span className="text-sm text-gray-300">{d.name}</span>
                              </div>
                              <span className="text-sm font-bold text-white">
                                {d.value}
                                <span className="text-xs text-gray-400 font-normal ml-1">
                                  {total > 0 ? `(${((d.value / total) * 100).toFixed(0)}%)` : ''}
                                </span>
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* ── BÖLÜM 5: Mesaj & İçerik İstatistikleri ── */}
              <div>
                <p className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-3">💬 Mesaj & İçerik</p>
                <div className="grid grid-cols-2 gap-3">
                  <StatCard icon="💬" label="Bugün Mesaj"    value={stats.messages_today}     />
                  <StatCard icon="📊" label="7 Gün Mesaj"    value={stats.messages_7days}     />
                  <StatCard icon="🎯" label="Toplam Aktivite" value={stats.total_activities}  />
                  <StatCard icon="💳" label="Toplam İşlem"   value={stats.total_transactions} />
                </div>
              </div>

              {/* ── BÖLÜM 6: En Popüler Kategoriler ── */}
              {categoryStats.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-orange-400 uppercase tracking-wider mb-3">🏆 Popüler Kategoriler</p>
                  <div className="bg-gray-800 rounded-2xl p-4">
                    <ResponsiveContainer width="100%" height={categoryStats.length * 36 + 10}>
                      <BarChart
                        data={categoryStats}
                        layout="vertical"
                        margin={{ top: 0, right: 16, left: 4, bottom: 0 }}
                      >
                        <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="name" tick={{ fill: '#d1d5db', fontSize: 11 }} width={90} axisLine={false} tickLine={false} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8, color: '#fff' }}
                          cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                        />
                        <Bar dataKey="count" fill="#f97316" radius={[0, 6, 6, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </>
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

      {/* ── FEEDBACK ──────────────────────────────────────────────────────── */}
      {tab === 'feedback' && (
        <div className="flex-1 overflow-y-auto px-4 pt-4 pb-24">
          {feedbackLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
            </div>
          ) : feedbackRows.length === 0 ? (
            <p className="text-center text-gray-500 py-16">Henüz geri bildirim yok</p>
          ) : (
            <div className="space-y-3">
              {feedbackRows.map(f => {
                const statusColors: Record<FeedbackRow['status'], string> = {
                  unread:   'bg-blue-500/20 text-blue-400 border border-blue-500/30',
                  read:     'bg-gray-700 text-gray-400',
                  resolved: 'bg-green-500/20 text-green-400 border border-green-500/30',
                };
                const statusLabels: Record<FeedbackRow['status'], string> = {
                  unread:   '● Okunmadı',
                  read:     '✓ Okundu',
                  resolved: '✔ Çözüldü',
                };
                return (
                  <div key={f.id} className="bg-gray-800 rounded-2xl p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="text-xs text-gray-400 truncate">{f.user_email ?? f.user_id}</p>
                      <p className="text-xs text-gray-500 shrink-0">
                        {new Date(f.created_at).toLocaleDateString('tr-TR', {
                          day: 'numeric', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <p className="text-sm text-gray-200 leading-relaxed mb-3">{f.message}</p>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => void cycleFeedbackStatus(f.id, f.status)}
                        className={cn(
                          'text-xs font-semibold px-3 py-1.5 rounded-full transition-colors active:scale-[0.97]',
                          statusColors[f.status],
                        )}
                      >
                        {statusLabels[f.status]}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── LEGAL DOCUMENTS ───────────────────────────────────────────────── */}
      {tab === 'legal' && (
        <div className="flex-1 overflow-y-auto px-4 pt-4 pb-24">
          {/* Dil seçici */}
          <div className="flex gap-2 mb-4">
            {(['tr', 'en', 'fr'] as const).map(l => (
              <button
                key={l}
                type="button"
                onClick={() => setLegalLang(l)}
                className={cn(
                  'flex-1 py-2 rounded-xl text-xs font-bold border transition-colors',
                  legalLang === l
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-gray-800 text-gray-400 border-gray-700',
                )}
              >
                {l === 'tr' ? '🇹🇷 TR' : l === 'en' ? '🇬🇧 EN' : '🇫🇷 FR'}
              </button>
            ))}
          </div>

          {legalLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
            </div>
          ) : legalDocs.length === 0 ? (
            <p className="text-center text-gray-500 py-12">Bu dil için belge bulunamadı</p>
          ) : (
            <div className="space-y-6">
              {legalDocs.map(doc => (
                <LegalDocCard
                  key={doc.id}
                  doc={doc}
                  savedId={legalSavedId}
                  onSave={saveLegalDoc}
                />
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
}

function LegalDocCard({
  doc,
  savedId,
  onSave,
}: {
  doc: LegalDoc;
  savedId: string | null;
  onSave: (doc: LegalDoc, title: string, version: string, content: string) => Promise<void>;
}) {
  const [title, setTitle] = useState(doc.title);
  const [version, setVersion] = useState(doc.version);
  const [content, setContent] = useState(doc.content);
  const [saving, setSaving] = useState(false);

  const docLabel = doc.doc_type === 'privacy_policy' ? '🔒 Gizlilik Politikası' : '📄 Kullanıcı Sözleşmesi';

  const handleSave = async () => {
    setSaving(true);
    await onSave(doc, title, version, content);
    setSaving(false);
  };

  return (
    <div className="bg-gray-800 rounded-2xl p-4 space-y-3">
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{docLabel}</p>

      <div className="flex gap-3">
        <div className="flex-1">
          <p className="text-xs text-gray-500 mb-1">Başlık</p>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
          />
        </div>
        <div className="w-24">
          <p className="text-xs text-gray-500 mb-1">Versiyon</p>
          <input
            value={version}
            onChange={e => setVersion(e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-blue-500 text-center"
          />
        </div>
      </div>

      <div>
        <p className="text-xs text-gray-500 mb-1">İçerik</p>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          rows={10}
          className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500 resize-none"
        />
      </div>

      <div className="flex items-center justify-end gap-3">
        {savedId === doc.id && (
          <span className="text-xs text-green-400 font-semibold">✓ Kaydedildi</span>
        )}
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="px-5 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold disabled:opacity-50 active:scale-[0.97] transition-transform flex items-center gap-2"
        >
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Kaydet
        </button>
      </div>
    </div>
  );
}
