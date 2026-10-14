import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Dumbbell, Mail, Lock, ChevronLeft, AlertCircle, ArrowLeft, Check } from 'lucide-react';
import { isSupabaseConfigured } from '@/lib/supabase';

type Mode = 'signin' | 'signup' | 'reset';

interface AuthScreenProps {
  initialMode?: Mode;
  onBack: () => void;
}

export function AuthScreen({ initialMode = 'signin', onBack }: AuthScreenProps) {
  const navigate = useNavigate();
  const { signIn, signUp, resetPassword } = useAuth();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!email.trim() || !password.trim()) {
      setError('Please fill in all fields.');
      return;
    }
    if (mode === 'signup' && password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    if (mode === 'signin') {
      const { error: signInError } = await signIn(email.trim(), password);
      if (signInError) {
        setError(signInError);
        setLoading(false);
      }
    } else if (mode === 'signup') {
      if (!displayName.trim()) {
        setError('Please enter your name.');
        setLoading(false);
        return;
      }
      const { error: signUpError } = await signUp(email.trim(), password, displayName.trim());
      if (signUpError) {
        setError(signUpError);
        setLoading(false);
      } else {
        setSuccess('Account created! Check your email if confirmation is required, or sign in with your credentials.');
        setLoading(false);
        setMode('signin');
      }
    } else if (mode === 'reset') {
      const { error: resetError } = await resetPassword(email.trim());
      if (resetError) {
        setError(resetError);
      } else {
        setSuccess('Password reset link sent to your email.');
      }
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-ink-bg flex flex-col safe-top">
      <div className="px-5 pt-5 pb-2">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-xl bg-ink-elevated flex items-center justify-center text-cloud-dim hover:text-cloud transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
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
          {mode === 'signin' ? 'Welcome back' : mode === 'signup' ? 'Create account' : 'Reset password'}
        </h1>
        <p className="text-sm text-cloud-dim mb-8">
          {mode === 'signin'
            ? 'Sign in to continue your fitness journey.'
            : mode === 'signup'
            ? 'Start your fitness journey today.'
            : "Enter your email and we'll send you a reset link."}
        </p>

        {!isSupabaseConfigured && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-rust/10 border border-rust/20 mb-6">
            <AlertCircle className="w-5 h-5 text-rust flex-shrink-0 mt-0.5" />
            <p className="text-xs text-rust/90 leading-relaxed">
              Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file to enable authentication.
            </p>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-rust/10 border border-rust/20 mb-4 animate-fade-in">
            <AlertCircle className="w-4 h-4 text-rust flex-shrink-0 mt-0.5" />
            <p className="text-xs text-rust/90 leading-relaxed">{error}</p>
          </div>
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
              label="Name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              autoComplete="name"
            />
          )}
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            icon={<Mail className="w-4 h-4" />}
          />
          {mode !== 'reset' && (
            <Input
              label="Password"
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
              className="text-xs text-cloud-dim hover:text-lime transition-colors text-right -mt-2"
            >
              Forgot password?
            </button>
          )}

          <Button type="submit" size="lg" loading={loading} className="w-full mt-2">
            {mode === 'signin' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Send Reset Link'}
          </Button>
        </form>

        {mode === 'reset' && (
          <button
            onClick={() => { setMode('signin'); setError(null); setSuccess(null); }}
            className="flex items-center justify-center gap-1.5 text-sm text-cloud-dim hover:text-cloud mt-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to sign in
          </button>
        )}

        {mode !== 'reset' && (
          <p className="text-center text-sm text-cloud-dim mt-6">
            {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={() => {
                setMode(mode === 'signin' ? 'signup' : 'signin');
                setError(null);
                setSuccess(null);
              }}
              className="text-lime font-medium hover:text-lime-dark transition-colors"
            >
              {mode === 'signin' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        )}

        <p className="text-center text-xs text-cloud-dim mt-4">
          {mode === 'signup' ? 'By creating an account you confirm you have read our ' : 'Read our '}
          <button type="button" onClick={() => navigate('/privacy')} className="text-lime underline">Privacy Policy</button>.
        </p>
      </div>
    </div>
  );
}
