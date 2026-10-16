import { useState } from 'react';
import { Lock, AlertCircle, Dumbbell } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

/** Opened from a password-reset email: choose a new password before using the app. */
export function NewPasswordScreen() {
  const { updatePassword } = useAuth();
  const { t, dir } = useI18n();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { setError(t('auth.passwordShort')); return; }
    if (password !== confirm) { setError(t('auth.passwordMismatch')); return; }
    setLoading(true);
    const { error: updateError } = await updatePassword(password);
    setLoading(false);
    if (updateError) setError(updateError);
  };

  return (
    <div className="min-h-screen bg-ink-bg flex flex-col justify-center px-6 pb-10 safe-top" dir={dir}>
      <div className="max-w-md mx-auto w-full">
        <div className="flex items-center gap-2.5 mb-8">
          <div className="w-10 h-10 rounded-xl bg-lime flex items-center justify-center">
            <Dumbbell className="w-5 h-5 text-ink-bg" strokeWidth={2.5} />
          </div>
          <span className="text-xl font-extrabold text-cloud tracking-tight">StartFit</span>
        </div>
        <h1 className="text-display-lg text-cloud mb-2">{t('auth.newPasswordTitle')}</h1>
        <p className="text-sm text-cloud-dim mb-8">{t('auth.newPasswordSubtitle')}</p>
        {error && (
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-rust/10 border border-rust/20 mb-4">
            <AlertCircle className="w-4 h-4 text-rust flex-shrink-0 mt-0.5" />
            <p className="text-xs text-rust/90 leading-relaxed">{error}</p>
          </div>
        )}
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Input label={t('auth.newPassword')} type="password" value={password} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)} autoComplete="new-password" icon={<Lock className="w-4 h-4" />} />
          <Input label={t('auth.confirmPassword')} type="password" value={confirm} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirm(e.target.value)} autoComplete="new-password" icon={<Lock className="w-4 h-4" />} />
          <Button type="submit" size="lg" loading={loading} className="w-full mt-2">{t('auth.savePassword')}</Button>
        </form>
      </div>
    </div>
  );
}
