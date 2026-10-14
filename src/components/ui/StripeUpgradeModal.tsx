import { useState } from 'react';
import { Check, Crown, Loader2, ShieldCheck, X, Calendar } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { createCheckoutSession, createDailyPassCheckout } from '@/lib/data';
import { TIERS, type Tier } from '@/lib/entitlements';
import { cn } from '@/lib/utils';

interface StripeUpgradeModalProps {
  open: boolean;
  currentTier: Tier;
  onClose: () => void;
}

type PaidTier = 'pro' | 'plus';
type Billing = 'weekly' | 'monthly' | 'annual';
type Mode = 'subscription' | 'daily';

export function StripeUpgradeModal({ open, onClose }: StripeUpgradeModalProps) {
  const [tier, setTier] = useState<PaidTier>('pro');
  const [billing, setBilling] = useState<Billing>('monthly');
  const [mode, setMode] = useState<Mode>('subscription');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = TIERS[tier];
  const displayPrice = billing === 'annual' ? selected.price * 10 : billing === 'weekly' ? selected.weeklyPrice : selected.price;
  const periodLabel = billing === 'annual' ? 'year' : billing === 'weekly' ? 'week' : 'month';

  const startCheckout = async () => {
    setLoading(true);
    setError(null);
    try {
      if (mode === 'daily') {
        const checkoutUrl = await createDailyPassCheckout();
        window.location.assign(checkoutUrl);
      } else {
        const checkoutUrl = await createCheckoutSession(tier, billing);
        window.location.assign(checkoutUrl);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to start checkout.');
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} className="sm:max-w-lg !p-0">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2 text-lime mb-1">
            <Crown className="w-5 h-5" />
            <span className="text-xs font-bold uppercase tracking-widest">StartFit Premium</span>
          </div>
          <h2 className="text-display-md text-cloud font-bold">Train with more intelligence</h2>
          <p className="text-sm text-cloud-dim mt-1">Choose a plan and continue securely through Stripe.</p>
        </div>
        <button onClick={onClose} className="text-cloud-dim hover:text-cloud transition-colors" aria-label="Close upgrade dialog">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Mode Toggle: Subscription vs Daily Pass */}
      <div className="flex bg-ink-elevated rounded-xl p-1 mb-4">
        <button
          onClick={() => setMode('subscription')}
          className={cn(
            'flex-1 rounded-lg px-3 py-2.5 text-center transition-all',
            mode === 'subscription' ? 'bg-lime text-ink-bg shadow-lime-sm' : 'text-cloud-dim hover:text-cloud'
          )}
        >
          <span className="block text-xs font-bold">Subscription</span>
        </button>
        <button
          onClick={() => setMode('daily')}
          className={cn(
            'flex-1 rounded-lg px-3 py-2.5 text-center transition-all',
            mode === 'daily' ? 'bg-lime text-ink-bg shadow-lime-sm' : 'text-cloud-dim hover:text-cloud'
          )}
        >
          <span className="block text-xs font-bold">Daily Pass</span>
        </button>
      </div>

      {mode === 'daily' ? (
        <div className="rounded-2xl bg-gradient-to-br from-lime/10 to-sky/5 border border-lime/20 p-4 mb-5">
          <div className="flex items-end justify-between mb-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="w-4 h-4 text-lime" />
                <p className="text-xs text-cloud-dim">Daily Pass — 24h Full Access</p>
              </div>
              <p className="text-3xl font-bold text-cloud">£1.49<span className="text-xs text-cloud-dim font-normal">/day</span></p>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-lime"><ShieldCheck className="w-3.5 h-3.5" /> Secure</div>
          </div>
          <p className="text-xs text-cloud-dim leading-relaxed mb-3">
            Get 24 hours of full Pro+ access — all exercises, AI coach, biometric routine generator, and analytics. Perfect for trying before you subscribe.
          </p>
          <div className="space-y-2">
            {['Full Pro+ access for 24 hours', 'AI Biometric Routine Generator (o3-mini)', 'Exercise Vault (153+ exercises)', 'All analytics and meal plans'].map((f) => (
              <div key={f} className="flex items-start gap-2 text-xs text-cloud-dim">
                <Check className="w-3.5 h-3.5 text-lime flex-shrink-0 mt-0.5" />
                <span>{f}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="flex bg-ink-elevated rounded-xl p-1 mb-4">
            {(['pro', 'plus'] as PaidTier[]).map((option) => (
              <button
                key={option}
                onClick={() => setTier(option)}
                className={cn(
                  'flex-1 rounded-lg px-3 py-3 text-left transition-all',
                  tier === option ? 'bg-lime text-ink-bg shadow-lime-sm' : 'text-cloud-dim hover:text-cloud'
                )}
              >
                <span className="block text-sm font-bold">{TIERS[option].label}</span>
                <span className={cn('block text-[11px] mt-0.5', tier === option ? 'text-ink-bg/70' : 'text-cloud-dim')}>
                  {TIERS[option].feats[1]}
                </span>
              </button>
            ))}
          </div>

          <div className="flex items-center justify-center gap-1.5 p-1 rounded-xl bg-ink-surface border border-ink-border mb-5">
            <button
              onClick={() => setBilling('weekly')}
              className={cn('flex-1 rounded-lg py-2 text-xs font-semibold transition-colors', billing === 'weekly' ? 'bg-ink-elevated text-cloud' : 'text-cloud-dim')}
            >
              Weekly · £{selected.weeklyPrice.toFixed(2)}
            </button>
            <button
              onClick={() => setBilling('monthly')}
              className={cn('flex-1 rounded-lg py-2 text-xs font-semibold transition-colors', billing === 'monthly' ? 'bg-ink-elevated text-cloud' : 'text-cloud-dim')}
            >
              Monthly · £{selected.price.toFixed(2)}
            </button>
            <button
              onClick={() => setBilling('annual')}
              className={cn('flex-1 rounded-lg py-2 text-xs font-semibold transition-colors', billing === 'annual' ? 'bg-ink-elevated text-cloud' : 'text-cloud-dim')}
            >
              Annual · 2 months free
            </button>
          </div>

          <div className="rounded-2xl bg-gradient-to-br from-lime/10 to-sky/5 border border-lime/20 p-4 mb-5">
            <div className="flex items-end justify-between mb-3">
              <div>
                <p className="text-xs text-cloud-dim">{selected.label}</p>
                <p className="text-3xl font-bold text-cloud">£{displayPrice.toFixed(2)}<span className="text-xs text-cloud-dim font-normal">/{periodLabel}</span></p>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-lime"><ShieldCheck className="w-3.5 h-3.5" /> Secure checkout</div>
            </div>
            <div className="space-y-2">
              {selected.feats.slice(0, 5).map((feature) => (
                <div key={feature} className="flex items-start gap-2 text-xs text-cloud-dim">
                  <Check className="w-3.5 h-3.5 text-lime flex-shrink-0 mt-0.5" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {error && <p className="text-xs text-rust mb-3">{error}</p>}

      <button
        onClick={startCheckout}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 bg-lime-gradient text-ink-bg font-bold text-sm shadow-lime hover:brightness-105 disabled:opacity-60 transition-all"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crown className="w-4 h-4" />}
        {loading ? 'Opening secure checkout…' : mode === 'daily' ? 'Get 24h Access for £1.49' : `Continue with ${selected.label}`}
      </button>
      <p className="text-center text-[10px] text-cloud-dim mt-3">Cancel anytime from your Stripe billing portal.</p>
    </Modal>
  );
}
