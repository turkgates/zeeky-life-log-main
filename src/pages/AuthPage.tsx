import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { signIn, signUp, resetPassword } from '@/lib/auth';
import { useAuthStore } from '@/store/useAuthStore';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useLanguageStore } from '@/store/useLanguageStore';

type Tab = 'login' | 'register';

function mapAuthError(message: string | undefined, translate: TFunction): string {
  if (!message) return translate('auth.error_generic');
  const m = message.toLowerCase();
  if (
    m.includes('invalid login') ||
    m.includes('invalid email or password') ||
    m.includes('invalid credentials')
  ) {
    return translate('auth.error_invalid');
  }
  if (m.includes('already registered') || m.includes('user already') || m.includes('email address is already')) {
    return translate('auth.error_email_taken');
  }
  if (
    (m.includes('password') && (m.includes('6') || m.includes('least') || m.includes('short'))) ||
    m.includes('weak password')
  ) {
    return translate('auth.error_weak_password');
  }
  return translate('auth.error_generic');
}

export default function AuthPage() {
  const { t } = useTranslation();
  const { language, setLanguage } = useLanguageStore();
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
    'w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-500 transition-colors';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError(t('auth.error_required_login'));
      return;
    }
    setLoading(true);
    const { error: err } = await signIn(email.trim(), password);
    setLoading(false);
    if (err) {
      setError(mapAuthError(err.message, t));
      return;
    }
    navigate('/', { replace: true });
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!fullName.trim() || !email.trim() || !password) {
      setError(t('auth.error_required_register'));
      return;
    }
    if (password !== password2) {
      setError(t('auth.error_password_mismatch'));
      return;
    }
    setLoading(true);
    const { error: err } = await signUp(email.trim(), password, fullName.trim());
    setLoading(false);
    if (err) {
      setError(mapAuthError(err.message, t));
      return;
    }
    setRegisterSuccess(true);
    setTab('login');
    navigate('/onboarding');
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim()) {
      setError(t('auth.error_email_required'));
      return;
    }
    setLoading(true);
    const { error: err } = await resetPassword(email.trim());
    setLoading(false);
    if (err) {
      setError(mapAuthError(err.message, t));
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
    <div className="relative min-h-screen bg-white dark:bg-gray-900 w-full px-6 pt-16 pb-10">
      <div className="absolute top-4 right-4 flex gap-1 z-10">
        {[
          { code: 'tr' },
          { code: 'en' },
          { code: 'fr' },
        ].map(lang => (
          <button
            key={lang.code}
            type="button"
            onClick={() => void setLanguage(lang.code)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
              language === lang.code
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600'
            }`}
          >
            {lang.code.toUpperCase()}
          </button>
        ))}
      </div>
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-blue-600 mb-2">Zeeky</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('auth.tagline')}</p>
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
              {t('auth.sign_in')}
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
              {t('auth.sign_up')}
            </button>
          </div>

          {registerSuccess && tab === 'login' && (
            <p className="mb-4 text-sm text-green-600 text-center bg-green-50 dark:bg-green-950/40 rounded-xl px-3 py-2">
              {t('auth.success_register')}
            </p>
          )}

          {error && (
            <p className="mb-4 text-sm text-red-600 text-center bg-red-50 rounded-xl px-3 py-2">{error}</p>
          )}

          {tab === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white text-center">{t('auth.welcome_back')}</h2>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">{t('auth.email')}</label>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className={inputCls}
                  placeholder={t('auth.email_placeholder')}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">{t('auth.password')}</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className={cn(inputCls, 'pr-12')}
                    placeholder={t('auth.password_placeholder')}
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
                {t('auth.forgot_password')}
              </button>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl bg-blue-600 text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60 mt-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {t('auth.sign_in_button')}
              </button>
              <p className="text-center text-sm text-gray-500 dark:text-gray-400 pt-1">
                {t('auth.no_account')}{' '}
                <button
                  type="button"
                  onClick={() => {
                    setTab('register');
                    setError('');
                    setRegisterSuccess(false);
                  }}
                  className="text-blue-600 font-semibold"
                >
                  {t('auth.sign_up')}
                </button>
              </p>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white text-center">{t('auth.create_account')}</h2>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">{t('auth.full_name')}</label>
                <input
                  type="text"
                  autoComplete="name"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  className={inputCls}
                  placeholder={t('auth.name_placeholder')}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">{t('auth.email')}</label>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className={inputCls}
                  placeholder={t('auth.email_placeholder')}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">{t('auth.password')}</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className={cn(inputCls, 'pr-12')}
                    placeholder={t('auth.password_placeholder')}
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
                <label className="text-xs font-medium text-gray-500 mb-1 block">{t('auth.password_repeat')}</label>
                <div className="relative">
                  <input
                    type={showPw2 ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={password2}
                    onChange={e => setPassword2(e.target.value)}
                    className={cn(inputCls, 'pr-12')}
                    placeholder={t('auth.password_placeholder')}
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
                {t('auth.sign_up_button')}
              </button>
              <p className="text-center text-sm text-gray-500 dark:text-gray-400 pt-1">
                {t('auth.has_account')}{' '}
                <button
                  type="button"
                  onClick={() => {
                    setTab('login');
                    setError('');
                    setRegisterSuccess(false);
                  }}
                  className="text-blue-600 font-semibold"
                >
                  {t('auth.sign_in')}
                </button>
              </p>
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
            {t('auth.back_to_login')}
          </button>
          {forgotSent ? (
            <div className="text-center bg-gray-50 dark:bg-gray-800/80 rounded-xl px-4 py-6 space-y-2">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('auth.check_email')}</h2>
              <p className="text-gray-600 dark:text-gray-300 text-sm">{t('auth.reset_sent')}</p>
            </div>
          ) : (
            <form onSubmit={handleForgot} className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white text-center">{t('auth.reset_password')}</h2>
              {error && (
                <p className="text-sm text-red-600 text-center bg-red-50 dark:bg-red-950/30 rounded-xl px-3 py-2">{error}</p>
              )}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">{t('auth.email')}</label>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className={inputCls}
                  placeholder={t('auth.email_placeholder')}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl bg-blue-600 text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? t('auth.sending') : t('auth.send_reset_link')}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
