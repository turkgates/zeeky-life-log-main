import { useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, Lightbulb, Wallet, Activity, BellOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Notification {
  id: string;
  icon: typeof AlertTriangle;
  iconColor: string;
  iconBg: string;
  title: string;
  description: string;
  time: string;
  unread: boolean;
  navigateTo: string;
}

const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: '1',
    icon: AlertTriangle,
    iconColor: 'hsl(var(--warning))',
    iconBg: 'hsl(var(--warning) / 0.1)',
    title: 'Eksik Bilgiler',
    description: 'Profil bilgilerini tamamla: kilo, sigara kullanımı, iş bilgileri eksik.',
    time: '2 saat önce',
    unread: true,
    navigateTo: '/profile',
  },
  {
    id: '2',
    icon: Lightbulb,
    iconColor: 'hsl(var(--primary))',
    iconBg: 'hsl(var(--primary) / 0.1)',
    title: 'Yapay Zeka Önerisi',
    description: 'Bu hafta sosyal aktivite girişin az. Arkadaşlarınla vakit geçirmeyi düşün.',
    time: '5 saat önce',
    unread: true,
    navigateTo: '/suggestions',
  },
  {
    id: '3',
    icon: Wallet,
    iconColor: 'hsl(var(--success))',
    iconBg: 'hsl(var(--success) / 0.1)',
    title: 'Bütçe Uyarısı',
    description: "Bu ay eğlence harcaman limitinin %80'ine ulaştı.",
    time: 'Dün',
    unread: false,
    navigateTo: '/finance',
  },
  {
    id: '4',
    icon: Activity,
    iconColor: 'hsl(var(--accent))',
    iconBg: 'hsl(var(--accent) / 0.1)',
    title: 'Aktivite Hatırlatıcı',
    description: '3 gündür spor aktivitesi girmedin.',
    time: '2 gün önce',
    unread: false,
    navigateTo: '/history',
  },
];

export default function NotificationsPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background max-w-[430px] mx-auto flex flex-col">
      {/* Header */}
      <div className="bg-primary text-primary-foreground px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center rounded-full active:bg-white/10">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="flex-1 text-base font-semibold">Bildirimler</h1>
      </div>

      {MOCK_NOTIFICATIONS.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground px-8">
          <BellOff className="w-16 h-16 opacity-30" />
          <p className="text-sm font-medium">Henüz bildirim yok</p>
        </div>
      ) : (
        <div className="flex-1 px-4 py-4 space-y-2">
          {MOCK_NOTIFICATIONS.map(n => (
            <button
              key={n.id}
              onClick={() => navigate(n.navigateTo)}
              className="w-full flex items-start gap-3 p-3.5 bg-card rounded-xl border border-border text-left active:scale-[0.98] transition-transform relative"
            >
              {n.unread && (
                <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-accent" />
              )}
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: n.iconBg }}
              >
                <n.icon className="w-5 h-5" style={{ color: n.iconColor }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className={cn("text-sm font-semibold truncate", n.unread && "text-foreground")}>{n.title}</p>
                  <span className="text-[10px] text-muted-foreground flex-shrink-0">{n.time}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.description}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
