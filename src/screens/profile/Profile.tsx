import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { fetchUserSessions, createBillingPortalSession } from '@/lib/data';
import type { WorkoutSession } from '@/lib/types';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { LoadingState } from '@/components/ui/States';
import { ConfirmDialog } from '@/components/ui/Modal';
import { StripeUpgradeModal } from '@/components/ui/StripeUpgradeModal';
import {
  ChevronRight, Settings, LogOut, Edit3, Target, Dumbbell, Clock,
  MapPin, Wrench, Calendar, TrendingUp, Bell, Shield,
  Flame, Activity, Crown, Apple, HeartPulse, Brain, Ruler, Lock,
  CreditCard, RefreshCw, Loader2, ExternalLink
} from 'lucide-react';
import { useEntitlements } from '@/lib/entitlements-context';

import {
  GOAL_LABELS, EXPERIENCE_LABELS, EQUIPMENT_LABELS,
  formatDuration, calculateStreak, startOfWeek, WEEK_DAYS,
  formatRelativeDate, cn
} from '@/lib/utils';

interface ProfileProps {
  onNavigate: (screen: { name: string; [key: string]: string | null }) => void;
}

function tierFromServer(serverTier: string | null | undefined): 'free' | 'pro' | 'plus' {
  if (serverTier === 'pro') return 'pro';
  if (serverTier === 'plus') return 'plus';
  return 'free';
}

export function Profile({ onNavigate }: ProfileProps) {
  const { profile, signOut } = useAuth();
  const { tier, config, refreshTier } = useEntitlements();
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [, setLoading] = useState(true);
  const [showSignOut, setShowSignOut] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);
  const [checkoutStatus, setCheckoutStatus] = useState<'success' | 'cancelled' | 'pending' | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const location = useLocation();

  useEffect(() => {
    (async () => {
      try {
        const s = await fetchUserSessions();
        setSessions(s.filter((x) => x.completed_at));
      } catch {
        // non-critical
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Handle post-checkout redirect: refresh profile to pick up webhook updates
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const checkoutParam = params.get('checkout');
    if (checkoutParam === 'success') {
      setCheckoutStatus('pending');
      setRefreshing(true);
      // Poll for webhook completion — webhook may take a few seconds
      const attempts = [0, 2000, 4000, 6000, 10000];
      let i = 0;
      const poll = async () => {
        await refreshTier();
        const currentTier = tierFromServer(profile?.subscription_tier);
        if (currentTier !== 'free' || i >= attempts.length - 1) {
          setCheckoutStatus('success');
          setRefreshing(false);
          return;
        }
        i++;
        setTimeout(poll, attempts[i] - attempts[i - 1]);
      };
      setTimeout(poll, attempts[0]);
    } else if (checkoutParam === 'cancelled') {
      setCheckoutStatus('cancelled');
    }
  }, [location.search]); // eslint-disable-line react-hooks/exhaustive-deps

  const openBillingPortal = async () => {
    setPortalLoading(true);
    setPortalError(null);
    try {
      const url = await createBillingPortalSession();
      window.location.assign(url);
    } catch (cause) {
      setPortalError(cause instanceof Error ? cause.message : 'Unable to open billing portal.');
      setPortalLoading(false);
    }
  };

  const streak = calculateStreak(sessions);
  const totalDuration = sessions.reduce((sum, s) => sum + s.duration_seconds, 0);
  const weekStart = startOfWeek();
  const weeklyGoal = profile?.preferred_days?.length ?? 3;
  const completedThisWeek = sessions.filter((s) => new Date(s.completed_at!) >= weekStart).length;

  if (!profile) {
    return <div className="px-5 pt-12"><LoadingState /></div>;
  }

  return (
    <div className="pb-24 animate-fade-in min-h-screen bg-ink-bg">
      {/* Header */}
      <div className="px-5 pt-6 pb-3 flex items-center justify-between">
        <h1 className="text-display-md text-cloud font-bold">Account</h1>
        <button
          onClick={() => onNavigate({ name: 'settings' })}
          className="w-10 h-10 rounded-xl bg-ink-elevated flex items-center justify-center text-cloud-dim hover:text-cloud transition-colors"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      {/* Profile Summary */}
      <div className="px-5 mb-5">
        <Card elevated className="p-5">
          <div className="flex items-center gap-4 mb-4">
            <Avatar name={profile.display_name ?? null} url={profile.avatar_url ?? null} size="lg" />
            <div className="flex-1 min-w-0">
              <h2 className="text-display-sm text-cloud font-semibold truncate">{profile.display_name ?? 'Athlete'}</h2>
              <p className="text-xs text-cloud-dim truncate">{profile.email}</p>
            </div>
            {tier !== 'free' && (
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-lime/10 text-lime text-[10px] font-bold">
                <Crown className="w-3 h-3" />
                {config.label}
              </div>
            )}
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <StatBox label="Goal" value={profile.fitness_goal ? GOAL_LABELS[profile.fitness_goal] : '—'} />
            <StatBox label="Weight" value={profile.weight_kg ? `${profile.weight_kg}kg` : '—'} />
            <StatBox label="Frequency" value={`${weeklyGoal}x/wk`} />
          </div>

          <Button variant="outline" size="sm" onClick={() => onNavigate({ name: 'edit-profile' })} className="w-full">
            <Edit3 className="w-3.5 h-3.5" />
            Edit Profile
          </Button>
        </Card>
      </div>

      {/* Quick Stats */}
      <div className="px-5 mb-5">
        <div className="grid grid-cols-3 gap-3">
          <StatCard icon={<Flame className="w-4 h-4" />} value={streak.toString()} label="Streak" />
          <StatCard icon={<Dumbbell className="w-4 h-4" />} value={sessions.length.toString()} label="Workouts" />
          <StatCard icon={<Clock className="w-4 h-4" />} value={formatDuration(totalDuration)} label="Time" />
        </div>
      </div>

      {/* Workout Calendar */}
      <div className="px-5 mb-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-cloud">Workout Calendar</h3>
          <span className="text-[11px] text-cloud-dim">{completedThisWeek}/{weeklyGoal} this week</span>
        </div>
        <Card className="p-4">
          <div className="flex justify-between gap-1.5 mb-4">
            {WEEK_DAYS.map((day, i) => {
              const dayDate = new Date(weekStart);
              dayDate.setDate(dayDate.getDate() + i);
              const isToday = dayDate.toDateString() === new Date().toDateString();
              const hasSession = sessions.some((s) => {
                const d = new Date(s.completed_at!);
                return d.toDateString() === dayDate.toDateString();
              });
              const isFuture = dayDate > new Date() && !isToday;
              return (
                <div key={day} className="flex flex-col items-center gap-1.5 flex-1">
                  <span className={cn('text-[10px]', isToday ? 'text-lime font-bold' : 'text-cloud-dim')}>
                    {day}
                  </span>
                  <div
                    className={cn(
                      'w-9 h-9 rounded-xl flex items-center justify-center text-[11px] font-bold transition-all',
                      hasSession
                        ? 'bg-lime-gradient text-ink-bg shadow-lime-sm'
                        : isToday
                        ? 'bg-ink-elevated text-cloud ring-1 ring-lime/30'
                        : isFuture
                        ? 'bg-ink-elevated/50 text-cloud-muted'
                        : 'bg-ink-elevated text-cloud-dim'
                    )}
                  >
                    {dayDate.getDate()}
                  </div>
                  <div className={cn('w-1 h-1 rounded-full', hasSession ? 'bg-lime' : 'bg-transparent')} />
                </div>
              );
            })}
          </div>

          {/* Progress bar */}
          <div className="h-2 bg-ink-elevated rounded-full overflow-hidden">
            <div
              className="h-full bg-lime-gradient rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, (completedThisWeek / weeklyGoal) * 100)}%` }}
            />
          </div>
          <p className="text-[10px] text-cloud-dim mt-2 text-center">
            {completedThisWeek >= weeklyGoal
              ? 'Weekly goal achieved! Keep it up.'
              : `${weeklyGoal - completedThisWeek} more session${weeklyGoal - completedThisWeek !== 1 ? 's' : ''} to hit your goal`}
          </p>
        </Card>
      </div>

      {/* Finished Workouts */}
      <div className="px-5 mb-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-cloud">Finished Workouts</h3>
          <button
            onClick={() => onNavigate({ name: 'workout-history' })}
            className="text-xs text-lime hover:text-lime-dark transition-colors flex items-center gap-0.5"
          >
            View all <ChevronRight className="w-3 h-3" />
          </button>
        </div>
        {sessions.length === 0 ? (
          <Card className="p-8 border-dashed border-ink-border">
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-ink-elevated flex items-center justify-center mb-3">
                <Dumbbell className="w-7 h-7 text-cloud-dim" />
              </div>
              <p className="text-sm font-medium text-cloud mb-1">No workouts yet</p>
              <p className="text-[11px] text-cloud-dim mb-4">Complete your first workout to see it here</p>
              <Button size="sm" onClick={() => onNavigate({ name: 'training' })}>
                <Dumbbell className="w-3.5 h-3.5" />
                Start Training
              </Button>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {sessions.slice(0, 4).map((session) => (
              <Card
                key={session.id}
                onClick={() => onNavigate({ name: 'workout-completion', sessionId: session.id })}
                className="p-3.5 hover:border-lime/20 transition-colors"
              >
                <div className="flex items-start gap-2.5 mb-2">
                  <div className="w-9 h-9 rounded-xl bg-lime/10 flex items-center justify-center flex-shrink-0">
                    <Dumbbell className="w-4 h-4 text-lime" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-cloud truncate">{session.plan_name ?? 'Workout'}</p>
                    <p className="text-[10px] text-cloud-dim">{formatRelativeDate(session.completed_at!)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-cloud-dim">
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDuration(session.duration_seconds)}</span>
                  <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" />{session.total_sets} sets</span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Fitness Profile */}
      <div className="px-5 mb-5">
        <h3 className="text-sm font-semibold text-cloud mb-3">Fitness Profile</h3>
        <Card className="divide-y divide-ink-border">
          {profile.fitness_goal && (
            <DetailRow icon={<Target className="w-4 h-4" />} label="Goal" value={GOAL_LABELS[profile.fitness_goal]} />
          )}
          {profile.experience_level && (
            <DetailRow icon={<TrendingUp className="w-4 h-4" />} label="Experience" value={EXPERIENCE_LABELS[profile.experience_level]} />
          )}
          {profile.training_location && (
            <DetailRow icon={<MapPin className="w-4 h-4" />} label="Location" value={profile.training_location.charAt(0).toUpperCase() + profile.training_location.slice(1)} />
          )}
          {profile.preferred_equipment && profile.preferred_equipment.length > 0 && (
            <DetailRow
              icon={<Wrench className="w-4 h-4" />}
              label="Equipment"
              value={profile.preferred_equipment.map((e) => EQUIPMENT_LABELS[e] ?? e).join(', ')}
            />
          )}
          {profile.preferred_days && profile.preferred_days.length > 0 && (
            <DetailRow icon={<Calendar className="w-4 h-4" />} label="Days" value={profile.preferred_days.join(', ')} />
          )}
        </Card>
      </div>

      {/* Quick Links */}
      <div className="px-5 mb-5">
        <h3 className="text-sm font-semibold text-cloud mb-3">Quick Access</h3>
        <div className="grid grid-cols-2 gap-3">
          <QuickLink icon={<Activity className="w-5 h-5" />} label="Workout History" onClick={() => onNavigate({ name: 'workout-history' })} />
          <QuickLink icon={<TrendingUp className="w-5 h-5" />} label="Progress" onClick={() => onNavigate({ name: 'progress' })} />
          <QuickLink icon={<Ruler className="w-5 h-5" />} label="Biometric Assessment" onClick={() => onNavigate({ name: 'biometric-assessment' })} />
          <QuickLink icon={<Apple className="w-5 h-5" />} label="Nutrition" onClick={() => onNavigate({ name: 'nutrition' })} />
          <QuickLink icon={<HeartPulse className="w-5 h-5" />} label="Recovery" onClick={() => onNavigate({ name: 'recovery' })} />
          {tier === 'plus' ? (
            <QuickLink icon={<Brain className="w-5 h-5" />} label="AI Routine Generator" onClick={() => onNavigate({ name: 'routine-generator' })} />
          ) : (
            <QuickLinkLocked icon={<Brain className="w-5 h-5" />} label="AI Routine Generator" onClick={() => setShowUpgrade(true)} />
          )}
        </div>
      </div>

      {/* Post-checkout status banner */}
      {checkoutStatus === 'pending' && (
        <div className="px-5 pt-4 animate-fade-in">
          <div className="flex items-center gap-3 p-4 rounded-xl2 bg-sky/10 border border-sky/30">
            <Loader2 className="w-5 h-5 text-sky animate-spin flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-cloud">Activating your subscription...</p>
              <p className="text-[11px] text-cloud-dim mt-0.5">We're confirming your payment. This usually takes a few seconds.</p>
            </div>
          </div>
        </div>
      )}
      {checkoutStatus === 'success' && (
        <div className="px-5 pt-4 animate-fade-in">
          <div className="flex items-center gap-3 p-4 rounded-xl2 bg-lime/10 border border-lime/30">
            <Shield className="w-5 h-5 text-lime flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-lime">Subscription activated!</p>
              <p className="text-[11px] text-cloud-dim mt-0.5">Your {config.label} features are now unlocked.</p>
            </div>
          </div>
        </div>
      )}
      {checkoutStatus === 'cancelled' && (
        <div className="px-5 pt-4 animate-fade-in">
          <div className="flex items-center gap-3 p-4 rounded-xl2 bg-ink-elevated border border-ink-border">
            <p className="text-sm text-cloud-dim">Checkout was cancelled. You can upgrade anytime.</p>
          </div>
        </div>
      )}

      {/* Subscription */}
      <div className="px-5 mb-5">
        <h3 className="text-sm font-semibold text-cloud mb-3">Subscription</h3>
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <Crown className="w-4 h-4 text-lime" />
                <p className="text-sm font-bold text-cloud">{config.label}</p>
              </div>
              <p className="text-[11px] text-cloud-dim mt-1">
                {config.price === 0 ? 'Free plan' : `GBP ${config.price}/mo`}
              </p>
            </div>
            {tier !== 'plus' && (
              <button
                onClick={() => setShowUpgrade(true)}
                className="px-3 py-1.5 rounded-lg bg-lime text-ink-bg text-xs font-bold hover:brightness-105 transition-all"
              >
                Upgrade
              </button>
            )}
          </div>

          {/* Subscription status details for paid users */}
          {tier !== 'free' && profile?.subscription_status && (
            <div className="mb-4 p-3 rounded-xl bg-ink-elevated/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-cloud-dim">Status</span>
                <span className={cn('text-[11px] font-medium capitalize',
                  profile.subscription_status === 'active' || profile.subscription_status === 'trialing' ? 'text-lime'
                  : profile.subscription_status === 'daily_pass' ? 'text-sky'
                  : 'text-gold')}>
                  {profile.subscription_status === 'daily_pass' ? '24h Pass' : profile.subscription_status}
                </span>
              </div>
              {profile.subscription_current_period_end && (
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-cloud-dim">
                    {profile.subscription_status === 'daily_pass' ? 'Expires' : 'Renews'}
                  </span>
                  <span className="text-[11px] text-cloud font-medium">
                    {new Date(profile.subscription_current_period_end).toLocaleDateString('en-GB', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </span>
                </div>
              )}
              {refreshing && (
                <div className="flex items-center gap-1.5 pt-1">
                  <RefreshCw className="w-3 h-3 text-sky animate-spin" />
                  <span className="text-[10px] text-sky">Syncing...</span>
                </div>
              )}
            </div>
          )}

          <div className="space-y-1.5 mb-4">
            {config.feats.map((feat, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-lime text-xs flex-shrink-0 mt-0.5">+</span>
                <span className="text-[11px] text-cloud-dim leading-relaxed">{feat}</span>
              </div>
            ))}
          </div>

          {/* Billing portal for paid subscribers */}
          {tier !== 'free' && profile?.stripe_customer_id && (
            <button
              onClick={openBillingPortal}
              disabled={portalLoading}
              className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 bg-ink-elevated text-cloud font-medium text-xs hover:bg-ink-surface transition-all border border-ink-border disabled:opacity-60 mb-2"
            >
              {portalLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CreditCard className="w-3.5 h-3.5" />}
              {portalLoading ? 'Opening...' : 'Manage Billing'}
              {!portalLoading && <ExternalLink className="w-3 h-3 opacity-50" />}
            </button>
          )}
          {portalError && (
            <p className="text-[10px] text-rust mb-2 text-center">{portalError}</p>
          )}

          {tier === 'free' && (
            <button
              onClick={() => setShowUpgrade(true)}
              className="w-full flex items-center justify-center gap-2 rounded-xl py-3 bg-lime-gradient text-ink-bg font-bold text-sm shadow-lime hover:brightness-105 transition-all"
            >
              <Crown className="w-4 h-4" />
              Unlock Pro Features
            </button>
          )}
        </Card>
      </div>

      {/* Settings Menu */}
      <div className="px-5 mb-5">
        <Card className="divide-y divide-ink-border">
          <MenuRow icon={<Bell className="w-4 h-4" />} label="Notifications" onClick={() => onNavigate({ name: 'settings' })} />
          <MenuRow icon={<Shield className="w-4 h-4" />} label="Privacy & Settings" onClick={() => onNavigate({ name: 'settings' })} />
        </Card>
      </div>

      {/* Sign Out */}
      <div className="px-5">
        <Button variant="destructive" size="lg" onClick={() => setShowSignOut(true)} className="w-full">
          <LogOut className="w-4 h-4" />
          Sign Out
        </Button>
      </div>

      <p className="text-center text-xs text-cloud-dim/40 mt-6">StartFit v1.0 - Train smarter</p>

      <ConfirmDialog
        open={showSignOut}
        title="Sign Out?"
        message="You'll need to sign in again to access your workouts and data."
        confirmLabel="Sign Out"
        variant="destructive"
        onConfirm={() => signOut()}
        onCancel={() => setShowSignOut(false)}
      />

      <StripeUpgradeModal
        open={showUpgrade}
        currentTier={tier}
        onClose={() => setShowUpgrade(false)}
      />
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center text-center py-2 rounded-xl bg-ink-elevated/50">
      <p className="text-xs font-bold text-cloud truncate w-full px-1">{value}</p>
      <p className="text-[9px] text-cloud-dim mt-0.5">{label}</p>
    </div>
  );
}

function StatCard({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <Card className="p-3 flex flex-col items-center text-center">
      <div className="w-8 h-8 rounded-lg bg-ink-elevated flex items-center justify-center text-lime mb-2">
        {icon}
      </div>
      <p className="text-sm font-bold text-cloud leading-tight">{value}</p>
      <p className="text-[10px] text-cloud-dim mt-0.5">{label}</p>
    </Card>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 p-4">
      <div className="w-8 h-8 rounded-lg bg-lime/10 flex items-center justify-center text-lime flex-shrink-0">
        {icon}
      </div>
      <span className="text-xs text-cloud-dim flex-shrink-0 w-24">{label}</span>
      <span className="text-sm text-cloud font-medium text-right flex-1 truncate">{value}</span>
    </div>
  );
}

function QuickLink({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 p-3.5 rounded-xl2 bg-ink-surface border border-ink-border hover:border-lime/30 transition-all active:scale-[0.98] text-left"
    >
      <div className="w-10 h-10 rounded-xl bg-lime/10 flex items-center justify-center text-lime flex-shrink-0">
        {icon}
      </div>
      <span className="text-sm font-medium text-cloud flex-1">{label}</span>
      <ChevronRight className="w-4 h-4 text-cloud-dim" />
    </button>
  );
}

function QuickLinkLocked({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 p-3.5 rounded-xl2 bg-ink-surface border border-ink-border hover:border-lime/30 transition-all active:scale-[0.98] text-left"
    >
      <div className="w-10 h-10 rounded-xl bg-ink-elevated flex items-center justify-center text-cloud-dim flex-shrink-0">
        {icon}
      </div>
      <span className="text-sm font-medium text-cloud-dim flex-1">{label}</span>
      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-ink-elevated text-cloud-dim text-[9px] font-bold flex-shrink-0">
        <Lock className="w-2.5 h-2.5" />
        PRO+
      </div>
    </button>
  );
}

function MenuRow({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 p-4 hover:bg-ink-elevated/50 transition-colors">
      <div className="w-8 h-8 rounded-lg bg-ink-elevated flex items-center justify-center text-cloud-dim flex-shrink-0">
        {icon}
      </div>
      <span className="text-sm text-cloud flex-1 text-left">{label}</span>
      <ChevronRight className="w-4 h-4 text-cloud-dim" />
    </button>
  );
}
