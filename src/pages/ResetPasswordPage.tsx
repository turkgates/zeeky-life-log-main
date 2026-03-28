import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error('Şifre en az 6 karakter olmalı');
      return;
    }
    if (password !== password2) {
      toast.error('Şifreler eşleşmiyor');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Şifre güncellendi');
    navigate('/', { replace: true });
  };

  return (
    <div className="min-h-screen bg-background w-full px-6 pt-16 pb-10">
      <h1 className="text-lg font-semibold mb-2">Yeni şifre</h1>
      <p className="text-sm text-muted-foreground mb-6">Yeni şifrenizi belirleyin.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Yeni şifre</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full rounded-xl border border-border bg-muted px-4 py-3 text-sm outline-none"
            autoComplete="new-password"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Şifre tekrar</label>
          <input
            type="password"
            value={password2}
            onChange={e => setPassword2(e.target.value)}
            className="w-full rounded-xl border border-border bg-muted px-4 py-3 text-sm outline-none"
            autoComplete="new-password"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          Kaydet
        </button>
      </form>
    </div>
  );
}
