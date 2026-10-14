import { useState } from 'react';
import { Check, Crown, Lock, Sparkles } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { StripeUpgradeModal } from '@/components/ui/StripeUpgradeModal';
import { useEntitlements } from '@/lib/entitlements-context';
import type { RecoveryFeature, Tier } from '@/lib/entitlements';

interface FeatureItem { feature: RecoveryFeature; name: string; benefit: string; source: string; implemented: boolean }

const PRO_FEATURES: FeatureItem[] = [
  { feature: 'recoveryWeeklyReport', name: 'Personalized recovery trends', benefit: 'See changes across your saved check-ins and training history.', source: 'Recorded check-ins and completed sets', implemented: true },
  { feature: 'recoveryWeeklyVolume', name: 'Advanced training-load analysis', benefit: 'Compare recent set volume without treating sets as a direct measure of tissue damage.', source: 'Completed working sets', implemented: true },
  { feature: 'recoveryLoadTrend', name: 'Load trend and baseline context', benefit: 'Review ACWR only after four distinct training weeks are available.', source: 'Dated workout sessions', implemented: true },
  { feature: 'recoveryDoctor', name: 'Recovery Doctor guidance', benefit: 'Structured symptom intake with conservative escalation guidance.', source: 'Your pain entries and recovery logs', implemented: true },
  { feature: 'recoveryCoach', name: 'AI Coach recovery recommendations', benefit: 'Rule-based recommendations grounded in your current recovery records.', source: 'Readiness inputs, sleep, soreness, and pain logs', implemented: true },
  { feature: 'recoveryPerformanceCheck', name: 'Performance checks', benefit: 'Compare first working-set estimated strength against your saved baseline.', source: 'At least two dated sessions per muscle', implemented: true },
  { feature: 'recoveryWeeklyReport', name: 'Modified-workout previews', benefit: 'Preview safer training changes before anything is applied.', source: 'Current recovery state and workout history', implemented: false },
  { feature: 'recoveryWeeklyReport', name: 'Expanded check-in history', benefit: 'Inspect historical recovery records without inventing missing days.', source: 'Saved daily check-ins', implemented: false },
];

const PLUS_FEATURES: FeatureItem[] = [
  { feature: 'recoveryPersonalProfile', name: 'Advanced personal recovery profile', benefit: 'Adjust the model gradually from repeated soreness and performance observations.', source: 'Three or more relevant sessions', implemented: true },
  { feature: 'recoveryManualOverride', name: 'Manual recovery overrides', benefit: 'Set a bounded per-muscle multiplier when you understand your own pattern.', source: 'Your explicit override', implemented: false },
  { feature: 'recoveryInjuryAdaptive', name: 'Adaptive injury-aware plans', benefit: 'Keep flagged areas out of future plan suggestions when supported.', source: 'Pain logs and exercise mapping', implemented: false },
  { feature: 'recoveryHrvTracking', name: 'Personal physiological trends', benefit: 'Compare HR and HRV with your own baseline when consistent readings exist.', source: 'Three or more comparable check-ins', implemented: true },
  { feature: 'recoveryAiChat', name: 'Expanded Doctor and Coach workflows', benefit: 'Ask questions through the existing protected AI service.', source: 'Verified recovery data and your request', implemented: true },
  { feature: 'recoveryAiChat', name: 'Wearable integration', benefit: 'Import supported device readings instead of entering them manually.', source: 'Supported device connection', implemented: false },
];

export function RecoveryFeatureExplorer() {
  const { tier } = useEntitlements();
  const [upgradeTier, setUpgradeTier] = useState<Tier | null>(null);

  return (
    <section className="space-y-3">
      <div>
        <div className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-lime" /><h2 className="text-sm font-semibold text-cloud">Unlock Your Full Recovery Intelligence</h2></div>
        <p className="text-[11px] text-cloud-dim mt-1">Explore exactly what each tier adds. Previews never use invented personal metrics.</p>
      </div>
      <FeatureTier title="Pro" tone="lime" features={PRO_FEATURES} currentTier={tier} onUpgrade={() => setUpgradeTier('pro')} />
      <FeatureTier title="Pro+" tone="sky" features={PLUS_FEATURES} currentTier={tier} onUpgrade={() => setUpgradeTier('plus')} />
      <StripeUpgradeModal open={upgradeTier !== null} currentTier={tier} onClose={() => setUpgradeTier(null)} />
    </section>
  );
}

function FeatureTier({ title, tone, features, currentTier, onUpgrade }: { title: string; tone: 'lime' | 'sky'; features: FeatureItem[]; currentTier: Tier; onUpgrade: () => void }) {
  const unlocked = title === 'Pro' ? currentTier !== 'free' : currentTier === 'plus';
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3"><div className="flex items-center gap-2"><Crown className={tone === 'lime' ? 'w-4 h-4 text-lime' : 'w-4 h-4 text-sky'} /><h3 className="text-sm font-bold text-cloud">{title}</h3></div><span className="text-[10px] font-bold text-cloud-dim">{unlocked ? 'Included' : 'Upgrade to unlock'}</span></div>
      <div className="space-y-2">
        {features.map((item) => (
          <div key={item.name} className="rounded-lg bg-ink-elevated/50 p-3">
            <div className="flex items-start gap-2"><span className={unlocked && item.implemented ? 'text-lime' : 'text-cloud-dim'}>{unlocked && item.implemented ? <Check className="w-3.5 h-3.5 mt-0.5" /> : <Lock className="w-3.5 h-3.5 mt-0.5" />}</span><div className="min-w-0 flex-1"><p className="text-xs font-semibold text-cloud">{item.name}</p><p className="text-[10px] text-cloud-dim leading-relaxed mt-0.5">{item.benefit}</p><p className="text-[9px] text-cloud-dim/60 mt-1">Uses: {item.source}</p>{!item.implemented && <p className="text-[9px] text-gold mt-1">Not available yet — shown for transparency.</p>}</div></div>
            {!unlocked && item.implemented && <button onClick={onUpgrade} className="mt-2 ml-5 text-[10px] font-bold text-lime hover:text-cloud transition-colors">See upgrade options</button>}
          </div>
        ))}
      </div>
      {!unlocked && <button onClick={onUpgrade} className="mt-3 w-full rounded-lg bg-lime py-2.5 text-xs font-bold text-ink-bg hover:brightness-105 transition-all">Explore {title}</button>}
    </Card>
  );
}
