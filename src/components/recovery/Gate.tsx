import { useState, type ReactNode } from 'react';
import { Lock, Crown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEntitlements } from '@/lib/entitlements-context';
import { StripeUpgradeModal } from '@/components/ui/StripeUpgradeModal';
import type { RecoveryFeature } from '@/lib/entitlements';

interface GateProps {
  feature: RecoveryFeature;
  children: ReactNode;
  fallback?: ReactNode;
  label?: string;
  className?: string;
}

export function Gate({ feature, children, fallback, label, className }: GateProps) {
  const { hasRecovery, tier } = useEntitlements();
  const [showPaywall, setShowPaywall] = useState(false);

  if (hasRecovery(feature)) {
    return <>{children}</>;
  }

  if (fallback) return <>{fallback}</>;

  const minTier = tier === 'free' ? 'Pro' : 'Pro+';

  return (
    <>
      <div
        className={cn(
          'relative rounded-xl border border-ink-border bg-ink-surface/50 p-4 flex flex-col items-center justify-center text-center',
          className
        )}
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-lime/10 text-lime mb-2">
          <Lock className="w-4 h-4" />
        </span>
        <p className="text-xs font-semibold text-cloud mb-1">
          {label ?? 'Premium feature'}
        </p>
        <p className="text-[10px] text-cloud-dim mb-3">
          Available with {minTier}. Upgrade to unlock this and more recovery tools.
        </p>
        <button
          onClick={() => setShowPaywall(true)}
          className="flex items-center gap-1.5 rounded-lg bg-lime/15 px-3 py-1.5 text-xs font-bold text-lime hover:bg-lime/25 transition-colors"
        >
          <Crown className="w-3.5 h-3.5" />
          Upgrade
        </button>
      </div>
      <StripeUpgradeModal open={showPaywall} currentTier={tier} onClose={() => setShowPaywall(false)} />
    </>
  );
}
