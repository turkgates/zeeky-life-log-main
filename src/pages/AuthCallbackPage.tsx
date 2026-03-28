import { Loader2 } from 'lucide-react';

/** Supabase e-posta linki bu sayfaya yönlendirir; PASSWORD_RECOVERY App.tsx içinde yakalanır. */
export default function AuthCallbackPage() {
  return (
    <div className="min-h-screen bg-background w-full flex flex-col items-center justify-center gap-3 px-6">
      <Loader2 className="w-10 h-10 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Yükleniyor…</p>
    </div>
  );
}
