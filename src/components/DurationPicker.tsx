import { Clock } from 'lucide-react';

interface DurationPickerProps {
  hours: number;
  minutes: number;
  onChange: (hours: number, minutes: number) => void;
}

export default function DurationPicker({ hours, minutes, onChange }: DurationPickerProps) {
  const timeValue = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const [h, m] = e.target.value.split(':').map(Number);
    onChange(h || 0, m || 0);
  };

  const displayText = `${hours > 0 ? `${hours} saat ` : ''}${minutes > 0 ? `${minutes} dakika` : hours > 0 ? '' : '0 dakika'}`;

  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1 block">Süre</label>
      <div className="relative">
        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input
          type="time"
          value={timeValue}
          onChange={handleChange}
          className="w-full bg-muted rounded-md pl-9 pr-3 py-2.5 text-sm outline-none border border-border focus:border-accent transition-colors"
        />
      </div>
      <p className="text-[10px] text-muted-foreground mt-1">{displayText}</p>
    </div>
  );
}
