import { useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { useLanguageStore } from '@/store/useLanguageStore';
import zeekyLogo from '@/assets/zeeky-logo.png';

interface Props {
  onComplete: () => void;
}

const messages = {
  tr: [
    'Zeeky düşünüyor... 🧠',
    'Verileriniz analiz ediliyor... 📊',
    'Size özel öneriler hazırlanıyor... ✨',
    'Finansal durumunuz inceleniyor... 💰',
    'Neredeyse hazır... 🚀',
  ],
  en: [
    'Zeeky is thinking... 🧠',
    'Analyzing your data... 📊',
    'Preparing personalized suggestions... ✨',
    'Reviewing your financial status... 💰',
    'Almost ready... 🚀',
  ],
  fr: [
    'Zeeky réfléchit... 🧠',
    'Analyse de vos données... 📊',
    'Préparation de suggestions personnalisées... ✨',
    'Examen de votre situation financière... 💰',
    'Presque prêt... 🚀',
  ],
} as const;

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export function DailySplashScreen({ onComplete }: Props) {
  const { user } = useAuthStore();
  const { language } = useLanguageStore();
  const [messageIndex, setMessageIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  const langMessages = useMemo(() => {
    const key = language as keyof typeof messages;
    return messages[key] ?? messages.tr;
  }, [language]);

  useEffect(() => {
    setMessageIndex(0);
    setProgress(0);

    let cancelled = false;

    const msgInterval = window.setInterval(() => {
      setMessageIndex(prev =>
        prev < langMessages.length - 1 ? prev + 1 : prev,
      );
    }, 800);

    const progressInterval = window.setInterval(() => {
      setProgress(prev => (prev >= 100 ? 100 : prev + 2));
    }, 80);

    const finish = () => {
      if (cancelled) return;
      window.clearInterval(msgInterval);
      window.clearInterval(progressInterval);
      setProgress(100);
      window.setTimeout(() => {
        if (cancelled) return;
        onComplete();
      }, 500);
    };

    const runUpdates = async () => {
      if (!user?.id) {
        finish();
        return;
      }

      try {
        await Promise.all([
          fetch(`${supabaseUrl}/functions/v1/zeeky-summarize`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${supabaseAnonKey}`,
              apikey: supabaseAnonKey,
            },
            body: JSON.stringify({
              user_id: user.id,
              language,
            }),
          }),
          fetch(`${supabaseUrl}/functions/v1/zeeky-notifications`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${supabaseAnonKey}`,
              apikey: supabaseAnonKey,
            },
            body: JSON.stringify({
              user_id: user.id,
              language,
            }),
          }),
          fetch(`${supabaseUrl}/functions/v1/zeeky-suggestions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${supabaseAnonKey}`,
              apikey: supabaseAnonKey,
            },
            body: JSON.stringify({
              user_id: user.id,
              mode: 'auto',
              language,
            }),
          }),
          new Promise<void>(resolve => {
            window.setTimeout(resolve, 4000);
          }),
        ]);
      } catch (err) {
        console.error('Daily update error:', err);
      } finally {
        finish();
      }
    };

    void runUpdates();

    return () => {
      cancelled = true;
      window.clearInterval(msgInterval);
      window.clearInterval(progressInterval);
    };
  }, [user?.id, language, onComplete, langMessages]);

  const tagline =
    language === 'en'
      ? 'Your personal AI life coach'
      : language === 'fr'
        ? 'Ton coach de vie personnel'
        : 'Kişisel yapay zeka yaşam koçun';

  const footer =
    language === 'en'
      ? 'Preparing the best experience for you'
      : language === 'fr'
        ? 'Préparation de la meilleure expérience pour toi'
        : 'Sizin için en iyi deneyim hazırlanıyor';

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-b from-blue-600 to-indigo-700">
      <div className="w-24 h-24 rounded-3xl bg-white/20 flex items-center justify-center mb-8 shadow-lg">
        <img src={zeekyLogo} alt="Zeeky" className="w-20 h-20 object-contain" />
      </div>

      <h1 className="text-3xl font-bold text-white mb-2">Zeeky</h1>
      <p className="text-white/70 text-sm mb-12">{tagline}</p>

      <div className="h-8 flex items-center justify-center mb-8">
        <p className="text-white/90 text-base animate-pulse text-center px-8">
          {langMessages[messageIndex]}
        </p>
      </div>

      <div className="w-64 h-1.5 bg-white/20 rounded-full overflow-hidden">
        <div
          className="h-full bg-white rounded-full transition-all duration-100"
          style={{ width: `${progress}%` }}
        />
      </div>

      <p className="text-white/40 text-xs mt-8">{footer}</p>
    </div>
  );
}
