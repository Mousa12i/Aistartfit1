import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Dumbbell, Mail, Lock, ChevronLeft, AlertCircle, ArrowLeft, Check } from 'lucide-react';
import { authLinkError, isSupabaseConfigured } from '@/lib/supabase';
import type { MessageKey } from '@/lib/i18n';
import { useI18n } from '@/lib/i18n';

type Mode = 'signin' | 'signup' | 'reset';

interface AuthScreenProps {
  initialMode?: Mode;
  onBack: () => void;
}

export function AuthScreen({ initialMode = 'signin', onBack }: AuthScreenProps) {
  const navigate = useNavigate();
  const { signIn, signUp, resetPassword, resendConfirmation } = useAuth();
  const { t, dir } = useI18n();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(() => (authLinkError ? t(authLinkError === 'otp_expired' ? 'auth.linkExpired' : 'auth.linkError') : null));
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [needsConfirm, setNeedsConfirm] = useState(authLinkError === 'otp_expired');

  /** Supabase's English messages, written for people (and in their language). */
  const friendly = (raw: string): string => {
    const m = raw.toLowerCase();
    const key: MessageKey | null = m.includes('not confirmed') ? 'auth.notConfirmed'
      : m.includes('invalid login') ? 'auth.badCredentials'
      : raw === 'already_registered' || m.includes('already registered') ? 'auth.alreadyRegistered'
      : m.includes('rate limit') || m.includes('security purposes') ? 'auth.rateLimited'
      : null;
    return key ? t(key) : raw;
  };

  const resend = async () => {
    if (!email.trim()) { setError(t('auth.fillAll')); return; }
    setLoading(true);
    const { error: resendError } = await resendConfirmation(email.trim());
    setLoading(false);
    if (resendError) setError(friendly(resendError));
    else { setError(null); setSuccess(t('auth.resent', { email: email.trim() })); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!email.trim() || !password.trim()) {
      setError(t('auth.fillAll'));
      return;
    }
    if (mode === 'signup' && password.length < 6) {
      setError(t('auth.passwordShort'));
      return;
    }

    setLoading(true);
    if (mode === 'signin') {
      const { error: signInError } = await signIn(email.trim(), password);
      if (signInError) {
        setError(friendly(signInError));
        setNeedsConfirm(signInError.toLowerCase().includes('not confirmed'));
        setLoading(false);
      }
    } else if (mode === 'signup') {
      if (!displayName.trim()) {
        setError(t('auth.enterName'));
        setLoading(false);
        return;
      }
      const { error: signUpError } = await signUp(email.trim(), password, displayName.trim());
      if (signUpError) {
        setError(friendly(signUpError));
        if (signUpError === 'already_registered') setMode('signin');
        setLoading(false);
      } else {
        setSuccess(t('auth.checkEmail', { email: email.trim() }));
        setNeedsConfirm(true);
        setLoading(false);
        setMode('signin');
      }
    } else if (mode === 'reset') {
      const { error: resetError } = await resetPassword(email.trim());
      if (resetError) {
        setError(friendly(resetError));
      } else {
        setSuccess(t('auth.resetSent'));
      }
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-ink-bg flex flex-col safe-top" dir={dir}>
      <div className="px-5 pt-5 pb-2">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-xl bg-ink-elevated flex items-center justify-center text-cloud-dim hover:text-cloud transition-colors"
        >
          <ChevronLeft className="w-5 h-5 rtl:rotate-180" />
        </button>
      </div>

      <div className="flex-1 flex flex-col justify-center px-6 pb-10 max-w-md mx-auto w-full">
        <div className="flex items-center gap-2.5 mb-8">
          <div className="w-10 h-10 rounded-xl bg-lime flex items-center justify-center">
            <Dumbbell className="w-5 h-5 text-ink-bg" strokeWidth={2.5} />
          </div>
          <span className="text-xl font-extrabold text-cloud tracking-tight">StartFit</span>
        </div>

        <h1 className="text-display-lg text-cloud mb-2">
          {mode === 'signin' ? t('auth.welcomeBack') : mode === 'signup' ? t('auth.createAccount') : t('auth.resetPassword')}
        </h1>
        <p className="text-sm text-cloud-dim mb-8">
          {mode === 'signin' ? t('auth.signinSubtitle') : mode === 'signup' ? t('auth.signupSubtitle') : t('auth.resetSubtitle')}
        </p>

        {!isSupabaseConfigured && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-rust/10 border border-rust/20 mb-6">
            <AlertCircle className="w-5 h-5 text-rust flex-shrink-0 mt-0.5" />
            <p className="text-xs text-rust/90 leading-relaxed">
              {t('auth.notConfigured')}
            </p>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-rust/10 border border-rust/20 mb-4 animate-fade-in">
            <AlertCircle className="w-4 h-4 text-rust flex-shrink-0 mt-0.5" />
            <p className="text-xs text-rust/90 leading-relaxed">{error}</p>
          </div>
        )}

        {needsConfirm && mode === 'signin' && (
          <button
            type="button"
            onClick={resend}
            disabled={loading}
            data-testid="resend-confirmation"
            className="mb-4 w-full rounded-xl border border-lime/30 py-2.5 text-xs font-semibold text-lime disabled:opacity-50"
          >
            {t('auth.resend')}
          </button>
        )}

        {success && (
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-lime/10 border border-lime/20 mb-4 animate-fade-in">
            <Check className="w-4 h-4 text-lime flex-shrink-0 mt-0.5" />
            <p className="text-xs text-lime/90 leading-relaxed">{success}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {mode === 'signup' && (
            <Input
              label={t('auth.name')}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={t('auth.namePlaceholder')}
              autoComplete="name"
            />
          )}
          <Input
            label={t('auth.email')}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            icon={<Mail className="w-4 h-4" />}
          />
          {mode !== 'reset' && (
            <Input
              label={t('auth.password')}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              icon={<Lock className="w-4 h-4" />}
            />
          )}

          {mode === 'signin' && (
            <button
              type="button"
              onClick={() => { setMode('reset'); setError(null); setSuccess(null); }}
              className="text-xs text-cloud-dim hover:text-lime transition-colors text-end -mt-2"
            >
              {t('auth.forgot')}
            </button>
          )}

          <Button type="submit" size="lg" loading={loading} className="w-full mt-2">
            {mode === 'signin' ? t('auth.signIn') : mode === 'signup' ? t('auth.createAccountButton') : t('auth.sendReset')}
          </Button>
        </form>

        {mode === 'reset' && (
          <button
            onClick={() => { setMode('signin'); setError(null); setSuccess(null); }}
            className="flex items-center justify-center gap-1.5 text-sm text-cloud-dim hover:text-cloud mt-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
            {t('auth.backToSignIn')}
          </button>
        )}

        {mode !== 'reset' && (
          <p className="text-center text-sm text-cloud-dim mt-6">
            {mode === 'signin' ? t('auth.noAccount') : t('auth.haveAccount')}{' '}
            <button
              onClick={() => {
                setMode(mode === 'signin' ? 'signup' : 'signin');
                setError(null);
                setSuccess(null);
              }}
              className="text-lime font-medium hover:text-lime-dark transition-colors"
            >
              {mode === 'signin' ? t('auth.signUpLink') : t('auth.signInLink')}
            </button>
          </p>
        )}

        <p className="text-center text-xs text-cloud-dim mt-4">
          {mode === 'signup' ? t('auth.privacySignup') : t('auth.privacyRead')}{' '}
          <button type="button" onClick={() => navigate('/privacy')} className="text-lime underline">{t('auth.privacyPolicy')}</button>.
        </p>
      </div>
    </div>
  );
}
