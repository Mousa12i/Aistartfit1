import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { TIERS, type Tier, type TierConfig, type RecoveryFeature } from './entitlements';
import { useAuth } from './auth';

const ADMIN_EMAILS = ['mossaismael551@gmail.com'];

function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

interface EntitlementsContextValue {
  tier: Tier;
  config: TierConfig;
  hasFeature: (feature: keyof Omit<TierConfig, 'label' | 'price' | 'weeklyPrice' | 'dailyPrice' | 'feats' | 'recovery'>) => boolean;
  hasRecovery: (feature: RecoveryFeature) => boolean;
  coachActionsLeft: number;
  coachActionsUsed: number;
  useCoachAction: () => boolean;
  resetDailyUsage: () => void;
  refreshTier: () => Promise<void>;
}

const EntitlementsContext = createContext<EntitlementsContextValue | null>(null);

const USAGE_KEY = 'startfit_coach_usage';

function loadUsage(): Record<string, number> {
  try {
    const raw = localStorage.getItem(USAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveUsage(data: Record<string, number>): void {
  try {
    localStorage.setItem(USAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function tierFromProfile(serverTier: string | null | undefined): Tier {
  if (serverTier === 'pro') return 'pro';
  if (serverTier === 'plus') return 'plus';
  return 'free';
}

export function EntitlementsProvider({ children }: { children: ReactNode }) {
  const { profile, refreshProfile, user } = useAuth();
  const adminOverride = isAdminEmail(user?.email);
  const [tier, setTierState] = useState<Tier>(() => tierFromProfile(profile?.subscription_tier));
  const [usage, setUsage] = useState<Record<string, number>>(loadUsage);

  // Sync tier FROM server profile — or force 'plus' for admin emails.
  useEffect(() => {
    if (adminOverride) {
      setTierState('plus');
    } else {
      setTierState(tierFromProfile(profile?.subscription_tier));
    }
  }, [profile?.subscription_tier, adminOverride]);

  const config = TIERS[tier];

  const usedToday = usage[todayKey()] ?? 0;

  const coachLimit = adminOverride ? Infinity : config.coach;

  const hasFeature = useCallback(
    (feature: keyof Omit<TierConfig, 'label' | 'price' | 'weeklyPrice' | 'dailyPrice' | 'feats'>) => {
      return config[feature] !== false && config[feature] !== 0;
    },
    [config]
  );

  const hasRecovery = useCallback(
    (feature: RecoveryFeature) => {
      return config.recovery[feature] === true;
    },
    [config]
  );

  const useCoachAction = useCallback((): boolean => {
    if (adminOverride) return true;
    const key = todayKey();
    const current = usage[key] ?? 0;
    if (current >= config.coach) return false;
    const updated = { ...usage, [key]: current + 1 };
    setUsage(updated);
    saveUsage(updated);
    return true;
  }, [usage, config.coach, adminOverride]);

  const resetDailyUsage = useCallback(() => {
    const key = todayKey();
    const updated = { ...usage };
    delete updated[key];
    setUsage(updated);
    saveUsage(updated);
  }, [usage]);

  const refreshTier = useCallback(async () => {
    await refreshProfile();
  }, [refreshProfile]);

  const value: EntitlementsContextValue = {
    tier,
    config,
    hasFeature,
    hasRecovery,
    coachActionsLeft: adminOverride ? Infinity : coachLimit - usedToday,
    coachActionsUsed: usedToday,
    useCoachAction,
    resetDailyUsage,
    refreshTier,
  };

  return <EntitlementsContext.Provider value={value}>{children}</EntitlementsContext.Provider>;
}

export function useEntitlements(): EntitlementsContextValue {
  const ctx = useContext(EntitlementsContext);
  if (!ctx) throw new Error('useEntitlements must be used within EntitlementsProvider');
  return ctx;
}
