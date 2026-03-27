import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { signIn, signUp, resetPassword } from '@/lib/auth';
import { useAuthStore } from '@/store/useAuthStore';
import { cn } from '@/lib/utils';

type Tab = 'login' | 'register';

export default function AuthPage() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuthStore();

  const [tab, setTab] = useState<Tab>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [registerSuccess, setRegisterSuccess] = useState(false);

  const [forgotMode, setForgotMode] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [authLoading, isAuthenticated, navigate]);

  const inputCls =
    'w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-blue-500 transition-colors';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError('E-posta ve şifre gerekli');
      return;
    }
    setLoading(true);
    const { error: err } = await signIn(email.trim(), password);
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    navigate('/', { replace: true });
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!fullName.trim() || !email.trim() || !password) {
      setError('Tüm alanları doldur');
      return;
    }
    if (password !== password2) {
      setError('Şifreler eşleşmiyor');
      return;
    }
    setLoading(true);
    const { error: err } = await signUp(email.trim(), password, fullName.trim());
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    setRegisterSuccess(true);
    setTab('login');
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim()) {
      setError('E-posta gerekli');
      return;
    }
    setLoading(true);
    const { error: err } = await resetPassword(email.trim());
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    setForgotSent(true);
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white max-w-[430px] mx-auto px-6 pt-16 pb-10">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-blue-600 mb-2">Zeeky</h1>
        <p className="text-sm text-gray-500">Kişisel yapay zeka yaşam koçun</p>
      </div>

      {!forgotMode ? (
        <>
          <div className="flex rounded-xl bg-gray-100 p-1 mb-8">
            <button
              type="button"
              onClick={() => {
                setTab('login');
                setError('');
                setRegisterSuccess(false);
              }}
              className={cn(
                'flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors',
                tab === 'login' ? 'bg-white shadow text-blue-600' : 'text-gray-500',
              )}
            >
              Giriş Yap
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('register');
                setError('');
                setRegisterSuccess(false);
              }}
              className={cn(
                'flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors',
                tab === 'register' ? 'bg-white shadow text-blue-600' : 'text-gray-500',
              )}
            >
              Kayıt Ol
            </button>
          </div>

          {registerSuccess && tab === 'login' && (
            <p className="mb-4 text-sm text-green-600 text-center bg-green-50 rounded-xl px-3 py-2">
              E-posta adresinize doğrulama linki gönderdik. Giriş yapabilirsin.
            </p>
          )}

          {error && (
            <p className="mb-4 text-sm text-red-600 text-center bg-red-50 rounded-xl px-3 py-2">{error}</p>
          )}

          {tab === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">E-posta</label>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className={inputCls}
                  placeholder="ornek@email.com"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Şifre</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className={cn(inputCls, 'pr-12')}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  >
                    {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setForgotMode(true);
                  setError('');
                  setForgotSent(false);
                }}
                className="text-sm text-blue-600 font-medium"
              >
                Şifremi Unuttum
              </button>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl bg-blue-600 text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60 mt-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Giriş Yap
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Ad Soyad</label>
                <input
                  type="text"
                  autoComplete="name"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  className={inputCls}
                  placeholder="Adınız Soyadınız"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">E-posta</label>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className={inputCls}
                  placeholder="ornek@email.com"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Şifre</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className={cn(inputCls, 'pr-12')}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  >
                    {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Şifre tekrar</label>
                <div className="relative">
                  <input
                    type={showPw2 ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={password2}
                    onChange={e => setPassword2(e.target.value)}
                    className={cn(inputCls, 'pr-12')}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw2(!showPw2)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  >
                    {showPw2 ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl bg-blue-600 text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60 mt-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Kayıt Ol
              </button>
            </form>
          )}
        </>
      ) : (
        <div>
          <button
            type="button"
            onClick={() => {
              setForgotMode(false);
              setForgotSent(false);
              setError('');
            }}
            className="text-sm text-blue-600 font-medium mb-6"
          >
            ← Girişe dön
          </button>
          {forgotSent ? (
            <p className="text-center text-gray-600 text-sm bg-gray-50 rounded-xl px-4 py-6">
              E-postanızı kontrol edin. Şifre sıfırlama linki gönderildi.
            </p>
          ) : (
            <form onSubmit={handleForgot} className="space-y-4">
              {error && (
                <p className="text-sm text-red-600 text-center bg-red-50 rounded-xl px-3 py-2">{error}</p>
              )}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">E-posta</label>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className={inputCls}
                  placeholder="ornek@email.com"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl bg-blue-600 text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Sıfırlama Linki Gönder
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
