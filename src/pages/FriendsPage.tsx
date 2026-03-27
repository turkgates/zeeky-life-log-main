import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Search,
  MoreVertical,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  fetchFriends,
  addFriend,
  updateFriend,
  deleteFriend,
  type Friend,
} from '@/lib/friendsSupabase';
import { useAuthStore } from '@/store/useAuthStore';

const FRIEND_RELATIONSHIPS = ['arkadaş', 'aile', 'akraba', 'iş arkadaşı', 'partner', 'diğer'] as const;

const FILTER_CHIPS: { key: 'all' | typeof FRIEND_RELATIONSHIPS[number]; label: string }[] = [
  { key: 'all', label: 'Tümü' },
  { key: 'arkadaş', label: 'Arkadaş' },
  { key: 'aile', label: 'Aile' },
  { key: 'akraba', label: 'Akraba' },
  { key: 'iş arkadaşı', label: 'İş Arkadaşı' },
  { key: 'partner', label: 'Partner' },
  { key: 'diğer', label: 'Diğer' },
];

const AVATAR_COLORS = [
  '#2563eb', '#16a34a', '#ca8a04', '#9333ea', '#db2777',
  '#0d9488', '#ea580c', '#4f46e5', '#0891b2', '#be123c',
];

function avatarColor(name: string): string {
  let sum = 0;
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
  return AVATAR_COLORS[Math.abs(sum) % AVATAR_COLORS.length];
}

function formatRelationship(r: string): string {
  const map: Record<string, string> = {
    arkadaş: 'Arkadaş',
    aile: 'Aile',
    akraba: 'Akraba',
    'iş arkadaşı': 'İş Arkadaşı',
    partner: 'Partner',
    diğer: 'Diğer',
  };
  return map[r] ?? r;
}

function formatLastInteraction(iso?: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

export default function FriendsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const userId = user?.id ?? '';
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [relFilter, setRelFilter] = useState<(typeof FILTER_CHIPS)[number]['key']>('all');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    id: undefined as string | undefined,
    name: '',
    nickname: '',
    relationship: 'arkadaş',
    phone: '',
    notes: '',
  });

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const { data, error } = await fetchFriends(userId);
      if (error && 'message' in error && error.message !== 'Oturum yok') {
        console.error(error);
        toast.error('Liste yüklenemedi');
        return;
      }
      setFriends((data as Friend[]) ?? []);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!menuOpenId) return;
    const close = () => setMenuOpenId(null);
    const t = window.setTimeout(() => document.addEventListener('click', close), 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('click', close);
    };
  }, [menuOpenId]);

  const filtered = useMemo(() => {
    let list = friends;
    if (relFilter !== 'all') {
      list = list.filter(f => f.relationship === relFilter);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(f => f.name.toLowerCase().includes(q));
    }
    return list;
  }, [friends, relFilter, search]);

  const openAdd = () => {
    setForm({
      id: undefined,
      name: '',
      nickname: '',
      relationship: 'arkadaş',
      phone: '',
      notes: '',
    });
    setSheetOpen(true);
    setMenuOpenId(null);
  };

  const openEdit = (f: Friend) => {
    setForm({
      id: f.id,
      name: f.name,
      nickname: f.nickname ?? '',
      relationship: (FRIEND_RELATIONSHIPS as readonly string[]).includes(f.relationship)
        ? (f.relationship as (typeof FRIEND_RELATIONSHIPS)[number])
        : 'diğer',
      phone: f.phone ?? '',
      notes: f.notes ?? '',
    });
    setSheetOpen(true);
    setMenuOpenId(null);
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.error('İsim zorunludur');
      return;
    }
    setSaving(true);
    try {
      if (!userId) {
        toast.error('Oturum yok');
        return;
      }
      if (form.id) {
        const { error } = await updateFriend(userId, form.id, {
          name: form.name.trim(),
          nickname: form.nickname.trim() || undefined,
          relationship: form.relationship || 'arkadaş',
          phone: form.phone.trim() || undefined,
          notes: form.notes.trim() || undefined,
        });
        if (error) {
          toast.error('Güncellenemedi');
          return;
        }
        toast.success('Güncellendi');
      } else {
        const { error } = await addFriend(userId, {
          name: form.name.trim(),
          nickname: form.nickname.trim() || undefined,
          relationship: form.relationship || 'arkadaş',
          phone: form.phone.trim() || undefined,
          notes: form.notes.trim() || undefined,
          source: 'manual',
        });
        if (error) {
          toast.error('Eklenemedi');
          return;
        }
        toast.success('Arkadaş eklendi');
      }
      setSheetOpen(false);
      void load();
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!userId) return;
    if (!window.confirm('Bu kişiyi silmek istediğine emin misin?')) return;
    const { error } = await deleteFriend(userId, id);
    if (error) {
      toast.error('Silinemedi');
      return;
    }
    toast.success('Silindi');
    setMenuOpenId(null);
    void load();
  };

  return (
    <div className="min-h-screen bg-background max-w-[430px] mx-auto pb-28 relative">
      {/* Blue header */}
      <div className="bg-blue-600 text-white px-4 pt-12 pb-4 rounded-b-3xl shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white/15 active:bg-white/25"
            aria-label="Geri"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold">Arkadaşlarım</h1>
          <button
            type="button"
            onClick={openAdd}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white/15 active:bg-white/25 text-xl font-light leading-none"
            aria-label="Yeni arkadaş"
          >
            +
          </button>
        </div>
      </div>

      <div className="px-4 -mt-2 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="İsme göre ara..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-card text-sm outline-none focus:border-blue-400"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
          {FILTER_CHIPS.map(c => (
            <button
              key={c.key}
              type="button"
              onClick={() => setRelFilter(c.key)}
              className={cn(
                'flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                relFilter === c.key
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-muted/80 text-muted-foreground border-border',
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 mt-4 space-y-2">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-12">
            {friends.length === 0 ? 'Henüz arkadaş eklenmedi.' : 'Sonuç bulunamadı.'}
          </p>
        ) : (
          filtered.map(f => {
            const bg = avatarColor(f.name);
            return (
              <div
                key={f.id}
                className="flex items-center gap-3 p-3 rounded-2xl border border-border bg-card shadow-sm"
              >
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
                  style={{ backgroundColor: bg }}
                >
                  {f.name.trim().charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-foreground truncate">{f.name}</p>
                  <p className="text-xs text-muted-foreground">{formatRelationship(f.relationship)}</p>
                  <p className="text-[11px] text-muted-foreground/80 mt-0.5">
                    Son etkileşim: {formatLastInteraction(f.last_interaction)}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                    {f.interaction_count ?? 0}
                  </span>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        setMenuOpenId(menuOpenId === f.id ? null : f.id);
                      }}
                      className="p-2 rounded-lg active:bg-muted"
                      aria-label="Menü"
                    >
                      <MoreVertical className="w-5 h-5 text-muted-foreground" />
                    </button>
                    {menuOpenId === f.id && (
                      <div
                        className="absolute right-0 top-full mt-1 z-[100] min-w-[140px] rounded-xl border border-border bg-card shadow-lg py-1 overflow-hidden"
                        onClick={e => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          className="w-full px-4 py-2.5 text-left text-sm hover:bg-muted"
                          onClick={() => openEdit(f)}
                        >
                          Düzenle
                        </button>
                        <button
                          type="button"
                          className="w-full px-4 py-2.5 text-left text-sm text-destructive hover:bg-destructive/10"
                          onClick={() => void remove(f.id)}
                        >
                          Sil
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* FAB */}
      <button
        type="button"
        onClick={openAdd}
        className="fixed z-40 w-14 h-14 rounded-full bg-blue-600 text-white shadow-lg flex items-center justify-center active:scale-95 transition-transform right-4"
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 5.5rem)' }}
        aria-label="Arkadaş ekle"
      >
        <Plus className="w-7 h-7" strokeWidth={2.5} />
      </button>

      {/* Bottom sheet */}
      {sheetOpen && (
        <>
          <div
            className="fixed inset-0 z-[300] bg-black/50"
            onClick={() => !saving && setSheetOpen(false)}
          />
          <div
            className="fixed inset-x-0 bottom-0 z-[301] bg-card rounded-t-3xl shadow-2xl max-w-[430px] mx-auto max-h-[90vh] overflow-y-auto"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>
            <div className="px-5 pb-6">
              <h2 className="text-base font-semibold mb-4">
                {form.id ? 'Arkadaşı düzenle' : 'Yeni arkadaş'}
              </h2>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">İsim *</label>
                  <input
                    value={form.name}
                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    className="w-full bg-muted rounded-xl px-3 py-2.5 text-sm outline-none border border-border"
                    placeholder="Ad Soyad"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Takma ad</label>
                  <input
                    value={form.nickname}
                    onChange={e => setForm(p => ({ ...p, nickname: e.target.value }))}
                    className="w-full bg-muted rounded-xl px-3 py-2.5 text-sm outline-none border border-border"
                    placeholder="Opsiyonel"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">İlişki tipi</label>
                  <select
                    value={form.relationship}
                    onChange={e => setForm(p => ({ ...p, relationship: e.target.value }))}
                    className="w-full bg-muted rounded-xl px-3 py-2.5 text-sm outline-none border border-border appearance-none"
                  >
                    {FRIEND_RELATIONSHIPS.map(r => (
                      <option key={r} value={r}>
                        {formatRelationship(r)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Telefon</label>
                  <input
                    value={form.phone}
                    onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                    className="w-full bg-muted rounded-xl px-3 py-2.5 text-sm outline-none border border-border"
                    placeholder="Opsiyonel"
                    inputMode="tel"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Notlar</label>
                  <textarea
                    value={form.notes}
                    onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                    rows={3}
                    className="w-full bg-muted rounded-xl px-3 py-2.5 text-sm outline-none border border-border resize-none"
                    placeholder="Opsiyonel"
                  />
                </div>
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={() => void save()}
                className="w-full mt-6 py-3.5 rounded-xl bg-blue-600 text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Kaydet
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
