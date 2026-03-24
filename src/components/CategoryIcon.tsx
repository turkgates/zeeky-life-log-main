import { MapPin, CheckCircle, Wallet, Moon, Play, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const CATEGORY_MAP: Record<string, { icon: React.ElementType; color: string }> = {
  gittim:   { icon: MapPin,        color: '#1E88E5' },
  yaptim:   { icon: CheckCircle,   color: '#43A047' },
  harcama:  { icon: Wallet,        color: '#FB8C00' },
  uyudum:   { icon: Moon,          color: '#7B1FA2' },
  izledim:  { icon: Play,          color: '#E91E63' },
  spor:     { icon: CheckCircle,   color: '#43A047' },
  sosyal:   { icon: MapPin,        color: '#1E88E5' },
  sağlık:   { icon: Moon,          color: '#7B1FA2' },
  iş:       { icon: CheckCircle,   color: '#78909C' },
  eğlence:  { icon: Play,          color: '#E91E63' },
  diğer:    { icon: HelpCircle,    color: '#78909C' },
};

export default function CategoryIcon({
  category,
  size = 'md',
}: {
  category: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const config = CATEGORY_MAP[category?.toLowerCase?.() ?? ''] ?? CATEGORY_MAP['diğer']!;
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
