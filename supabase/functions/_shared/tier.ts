// The plan a person really has right now. A Daily Pass stops at its end time even if the
// database job that resets it (expire_daily_passes, every 5 minutes) has not run yet.

export type PaidTier = 'free' | 'pro' | 'plus';

export function effectiveTier(profile: { subscription_tier?: unknown; subscription_status?: unknown; subscription_current_period_end?: unknown } | null | undefined, now = new Date()): PaidTier {
  const tier = profile?.subscription_tier === 'pro' || profile?.subscription_tier === 'plus' ? profile.subscription_tier : 'free';
  if (tier !== 'free' && profile?.subscription_status === 'daily_pass') {
    const end = typeof profile.subscription_current_period_end === 'string' ? Date.parse(profile.subscription_current_period_end) : NaN;
    if (!Number.isFinite(end) || end <= now.getTime()) return 'free';
  }
  return tier;
}
