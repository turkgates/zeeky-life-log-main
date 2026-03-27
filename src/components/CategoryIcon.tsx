import {
  Activity, Users, Briefcase, Film, ShoppingCart,
  UtensilsCrossed, Plane, Home, MoreHorizontal,
  MapPin, CheckCircle, Moon, Play,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const CATEGORY_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  // New categories
  'sağlık-spor': { icon: Activity,        color: '#22c55e', label: 'Sağlık & Spor' },
  'sosyal':      { icon: Users,           color: '#3b82f6', label: 'Sosyal'         },
  'iş-eğitim':  { icon: Briefcase,       color: '#6366f1', label: 'İş & Eğitim'    },
  'eğlence':    { icon: Film,            color: '#ec4899', label: 'Eğlence'        },
  'alışveriş':  { icon: ShoppingCart,    color: '#f97316', label: 'Alışveriş'      },
  'yeme-içme':  { icon: UtensilsCrossed, color: '#ef4444', label: 'Yeme & İçme'    },
  'seyahat':    { icon: Plane,           color: '#0ea5e9', label: 'Seyahat'        },
  'ev-yaşam':   { icon: Home,            color: '#84cc16', label: 'Ev & Yaşam'     },
  'diğer':      { icon: MoreHorizontal,  color: '#94a3b8', label: 'Diğer'          },
  // Legacy categories (backward compat)
  'gittim':     { icon: MapPin,          color: '#1E88E5', label: 'Gittim'         },
  'yaptim':     { icon: CheckCircle,     color: '#43A047', label: 'Yaptım'         },
  'uyudum':     { icon: Moon,            color: '#7B1FA2', label: 'Uyudum'         },
  'izledim':    { icon: Play,            color: '#E91E63', label: 'İzledim'        },
  'spor':       { icon: Activity,        color: '#22c55e', label: 'Spor'           },
  'sağlık':     { icon: Activity,        color: '#22c55e', label: 'Sağlık'         },
  'iş':         { icon: Briefcase,       color: '#6366f1', label: 'İş'             },
};

export default function CategoryIcon({
  category,
  size = 'md',
}: {
  category: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const key    = category?.toLowerCase?.()?.trim() ?? '';
  const config = CATEGORY_CONFIG[key] ?? CATEGORY_CONFIG['diğer']!;
  const { icon: Icon, color } = config;

  const sizeClass = size === 'sm' ? 'w-8 h-8' : size === 'lg' ? 'w-12 h-12' : 'w-10 h-10';
  const iconSize  = size === 'sm' ? 16 : size === 'lg' ? 24 : 20;

  return (
    <div
      className={cn('rounded-xl flex items-center justify-center flex-shrink-0', sizeClass)}
      style={{ backgroundColor: color + '20', color }}
    >
      <Icon size={iconSize} />
    </div>
  );
}

export { CATEGORY_CONFIG };
