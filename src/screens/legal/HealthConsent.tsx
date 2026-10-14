import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HeartPulse, LogOut } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useConsent } from '@/lib/consent-context';
import { cn } from '@/lib/utils';

/**
 * Explicit consent to process health data (UK GDPR Art. 9(2)(a)), asked before any health data is collected
 * and again if the policy changes how health data is used.
 */
export function HealthConsent() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const consent = useConsent();
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const agree = async () => {
    setSaving(true);
    setError(null);
    try {
      await consent.set('health_data', true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your choice.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-ink-bg px-5 pb-10 pt-10" data-testid="health-consent">
      <div className="mx-auto max-w-md">
        <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-lime/10 text-lime"><HeartPulse className="h-6 w-6" /></span>
        <h1 className="text-display-sm font-bold text-cloud">Your health data</h1>
        <p className="mt-2 text-sm leading-relaxed text-cloud-dim">
          To build your plans and track your training, nutrition and recovery, StartFit needs to store and use health and fitness data you enter, such as:
        </p>
        <ul className="mt-3 space-y-1 text-sm text-cloud">
          <li>• body measurements, workouts and how hard they felt</li>
          <li>• health screening answers, pain reports and symptoms</li>
          <li>• meals, water, sleep, soreness, stress and mood</li>
          <li>• menstrual cycle dates, only if you switch that on later</li>
        </ul>
        <p className="mt-3 text-sm leading-relaxed text-cloud-dim">
          We use it only to run StartFit for you. We never sell it or use it for advertising. You can withdraw your consent or delete your account at any time in Settings → Privacy &amp; Data.
        </p>
        <p className="mt-3 rounded-xl border border-ink-border bg-ink-surface p-3 text-xs leading-relaxed text-cloud-dim" data-testid="doctor-reminder">
          StartFit gives general fitness guidance and estimates, not medical advice. Check with a doctor before making medical decisions, and before starting if you have a health condition, are pregnant or have an injury.
        </p>
        <button type="button" onClick={() => navigate('/privacy')} className="mt-3 inline-block text-sm font-semibold text-lime underline">Read the Privacy Policy</button>

        <label className={cn('mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border p-4', checked ? 'border-lime/50 bg-lime/5' : 'border-ink-border bg-ink-surface')}>
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-0.5 h-5 w-5 accent-[#a3e635]" data-testid="health-consent-check" />
          <span className="text-sm leading-relaxed text-cloud">
            I give my explicit consent to StartFit processing my health and fitness data for the purposes described in the Privacy Policy.
          </span>
        </label>
        {error && <p className="mt-2 text-xs text-rust">{error}</p>}
        <button type="button" disabled={!checked || saving} onClick={() => void agree()} data-testid="health-consent-agree" className="mt-4 w-full rounded-xl bg-lime py-3 text-sm font-bold text-ink-bg disabled:opacity-40">
          {saving ? 'Saving…' : 'Agree and continue'}
        </button>
        <button type="button" onClick={() => void signOut()} className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-ink-border py-3 text-sm text-cloud-dim">
          <LogOut className="h-4 w-4" /> Not now — sign out
        </button>
        <p className="mt-3 text-center text-[11px] text-cloud-dim">StartFit cannot work without this consent. Your account stays; you can come back, or delete it from Settings → Privacy &amp; Data after agreeing, or by contacting us (see the Privacy Policy).</p>
      </div>
    </div>
  );
}
