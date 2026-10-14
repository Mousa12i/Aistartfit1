import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, Check } from 'lucide-react';
import { useConsent } from '@/lib/consent-context';
import { cn } from '@/lib/utils';

/**
 * Shows the AI coaches only after explicit permission to send data to the AI provider
 * (App Store Review Guideline 5.1.2(i)). The servers check the same permission.
 */
export function AiConsentGate({
  children,
  compact = false,
  fallbackWrapper,
}: {
  children: ReactNode;
  compact?: boolean;
  fallbackWrapper?: (card: ReactNode) => ReactNode;
}) {
  const consent = useConsent();
  if (consent.ai) return <>{children}</>;
  const card = <AiConsentCard compact={compact} />;
  return <>{fallbackWrapper ? fallbackWrapper(card) : card}</>;
}

export function AiConsentCard({ compact = false }: { compact?: boolean }) {
  const navigate = useNavigate();
  const consent = useConsent();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allow = async () => {
    setSaving(true);
    setError(null);
    try {
      await consent.set('third_party_ai', true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your choice.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={cn('rounded-2xl border border-ink-border bg-ink-surface text-left', compact ? 'm-3 p-3' : 'p-4')} data-testid="ai-consent">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-lime/10 text-lime"><Bot className="h-4 w-4" /></span>
        <p className="text-sm font-semibold text-cloud">Allow the AI coaches?</p>
      </div>
      <p className="text-xs leading-relaxed text-cloud-dim">
        The coaches are powered by <b className="text-cloud">OpenAI</b>, a third-party AI provider. When you send a coach a message, StartFit sends OpenAI your message and the data the coach needs to answer, which can include health data:
      </p>
      <ul className="mt-2 space-y-0.5 text-xs text-cloud-dim">
        <li>• profile basics (age, height, weight, goal, experience)</li>
        <li>• your routine, recent workouts and session ratings</li>
        <li>• check-ins, sleep and pain reports</li>
        <li>• meals and targets (nutrition coach) and your saved memory</li>
      </ul>
      <p className="mt-2 text-xs leading-relaxed text-cloud-dim">
        OpenAI does not use it to train its models and keeps it for up to 30 days for abuse monitoring. Nothing is sent until you allow it, and you can switch this off any time in Settings → Privacy &amp; Data.{' '}
        <button type="button" onClick={() => navigate('/privacy')} className="font-semibold text-lime underline">Privacy Policy</button>
      </p>
      {error && <p className="mt-2 text-xs text-rust">{error}</p>}
      <button type="button" onClick={() => void allow()} disabled={saving} data-testid="allow-ai" className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-lime py-2.5 text-sm font-bold text-ink-bg disabled:opacity-50">
        <Check className="h-4 w-4" /> {saving ? 'Saving…' : 'Allow and continue'}
      </button>
      <p className="mt-1.5 text-center text-[10px] text-cloud-dim">If you don’t allow it, everything else in StartFit keeps working.</p>
    </div>
  );
}
