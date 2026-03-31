import { useState, useEffect } from 'react';

interface Props {
  endDate: string;
}

export default function CampaignCountdown({ endDate }: Props) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const calculate = () => {
      const end = new Date(endDate).getTime();
      const now = new Date().getTime();
      const diff = end - now;

      if (diff <= 0) {
        setTimeLeft('');
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (days > 0) {
        setTimeLeft(`${days} gün ${hours} saat kaldı`);
      } else {
        setTimeLeft(`${hours} saat ${minutes} dakika kaldı`);
      }
    };

    calculate();
    const interval = setInterval(calculate, 60_000);
    return () => clearInterval(interval);
  }, [endDate]);

  if (!timeLeft) return null;

  return (
    <div className="bg-orange-50 dark:bg-orange-900/20 rounded-2xl p-3 text-center mt-2">
      <p className="text-xs text-orange-600 dark:text-orange-400 font-medium">
        ⏰ {timeLeft}
      </p>
    </div>
  );
}
