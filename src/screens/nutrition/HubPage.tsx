import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  Check,
  CheckCircle2,
  ChefHat,
  ChevronRight,
  Droplets,
  Dumbbell,
  FileText,
  Info,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Utensils,
  Weight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { slotForTime, MEAL_SLOTS, errorMessage } from '@/lib/nutrition/api';
import { addDays, formatDayLabel } from '@/lib/nutrition/dates';
import { GOAL_LABELS } from '@/lib/nutrition/engine';
import { buildInsights, loggingStreak, proteinMealsHit, summarizeDay, type Insight } from '@/lib/nutrition/insights';
import { useNutrition } from './NutritionContext';
import { useNutritionNav, type NutritionPage } from './nav';
import { GoalEntryCard } from './GoalPage';
import { CoachPlanCard } from './CoachPlanPage';
import { MACRO_COLORS, MacroBar, Notice, Page, PageHeader, Panel, Ring, Section, SetupRequired, Skeleton, Toast, fmt } from './ui';

export function HubPage() {
  const n = useNutrition();
  const { go } = useNutritionNav();
  const { today, days, loadRange } = n;
  const [toast, setToast] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyWater, setBusyWater] = useState(false);

  useEffect(() => {
    loadRange(addDays(today, -13), today).catch((err) => setLoadError(errorMessage(err)));
  }, [today, loadRange]);

  const targets = n.targetsFor(today);
  const trainingDay = n.isTrainingDay(today);
  const todayData = days[today];
  const summary = useMemo(() => summarizeDay(today, todayData?.entries ?? [], todayData?.water ?? []), [today, todayData]);

  const { insights, streak } = useMemo(() => {
    const recent = [];
    const withEntries = new Set<string>();
    for (let i = 0; i <= 13; i++) {
      const key = addDays(today, -i);
      const d = days[key];
      if (d?.entries.length) withEntries.add(key);
      if (i > 0 && i <= 7 && d) recent.push(summarizeDay(key, d.entries, d.water));
    }
    const s = loggingStreak(withEntries, today);
    return {
      streak: s,
      insights: buildInsights({ today: summary, recent, targets, noNumbers: n.noNumbers, trainingDay, hour: new Date().getHours(), streak: s }),
    };
  }, [days, today, summary, targets, n.noNumbers, trainingDay]);

  const addWater = useCallback(async () => {
    setBusyWater(true);
    try {
      await n.addWater(250, today);
      setToast('Added 250 ml of water');
    } catch (err) {
      setLoadError(errorMessage(err));
    } finally {
      setBusyWater(false);
    }
  }, [n, today]);

  const loadingToday = !todayData && !loadError;
  const eaten = summary.total.kcal;
  const left = targets.kcal - eaten;

  return (
    <Page>
      <PageHeader
        title="Nutrition"
        subtitle={`${formatDayLabel(today)} · ${trainingDay ? 'Training day' : 'Rest day'}${n.noNumbers ? '' : ` · ${GOAL_LABELS[targets.mode]}`}`}
        right={
          <button
            type="button"
            aria-label="Check-in and preferences"
            onClick={() => go('check-in')}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink-elevated text-cloud-dim hover:text-cloud"
          >
            <Settings className="h-5 w-5" />
          </button>
        }
      />

      <div className="space-y-3">
        {!n.settingsAvailable && <SetupRequired feature="Goals, the wellbeing check-in and favourites" />}
        {(loadError || n.error) && (
          <Notice tone="warn" title="Some data could not load">
            {loadError || n.error}
          </Notice>
        )}
        {n.safety.showSupport && (
          <Notice
            tone="danger"
            title="Support is available"
            action={
              <button type="button" onClick={() => go('check-in', { focus: 'support' })} className="text-xs font-semibold text-lime">
                See support options
              </button>
            }
          >
            Your check-in suggests it could help to talk to someone about eating. Weight goals are paused and you can hide numbers any time.
          </Notice>
        )}
        {n.settingsAvailable && !n.loading && !n.planConfirmed && (
          <SetupCard checkInDone={!!n.settings.screening} onCheckIn={() => go('check-in', { next: 'plan' })} onPlan={() => go('plan')} />
        )}
      </div>

      <div className="mt-4">
        {loadingToday ? (
          <Skeleton className="h-64 w-full rounded-2xl" />
        ) : n.noNumbers ? (
          <BalancedToday summary={summary} threshold={Math.max(15, targets.proteinPerMeal.low)} waterTarget={targets.waterMl} onOpen={() => go('diary')} />
        ) : (
          <Panel className="p-5" onClick={() => go('diary')}>
            <div className="flex items-center justify-between gap-2">
              <Stat label="Eaten" value={fmt(eaten)} unit="kcal" />
              <Ring value={eaten} max={targets.kcal} size={148}>
                <span className="text-[30px] font-extrabold leading-none tabular-nums text-cloud">{fmt(Math.abs(left))}</span>
                <span className="mt-1 text-[11px] text-cloud-dim">{left >= 0 ? 'kcal left' : 'kcal over'}</span>
              </Ring>
              <Stat label="Target" value={fmt(targets.kcal)} unit="kcal" align="right" />
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3">
              <MacroBar label="Protein" value={summary.total.protein} target={targets.protein} color={MACRO_COLORS.protein} />
              <MacroBar label="Carbs" value={summary.total.carbs} target={targets.carbs} color={MACRO_COLORS.carbs} />
              <MacroBar label="Fat" value={summary.total.fat} target={targets.fat} color={MACRO_COLORS.fat} />
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-ink-border/60 pt-3 text-[11px] text-cloud-dim">
              <span>
                Fibre <b className="text-cloud">{fmt(summary.total.fiber)}</b>/{targets.fiber} g
              </span>
              <span>
                Sugars <b className="text-cloud">{fmt(summary.total.sugar)}</b> g
              </span>
              <span>
                Water <b className="text-cloud">{(summary.waterMl / 1000).toFixed(1)}</b>/{(targets.waterMl / 1000).toFixed(1)} L
              </span>
            </div>
          </Panel>
        )}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <QuickAction icon={<Plus className="h-4 w-4" />} label="Log food" primary onClick={() => go('add', { meal: slotForTime(), date: today })} />
        <QuickAction icon={<Droplets className="h-4 w-4" />} label={busyWater ? 'Adding…' : '+250 ml'} onClick={addWater} disabled={busyWater} />
        {n.noNumbers ? (
          <QuickAction icon={<Sparkles className="h-4 w-4" />} label="Ask coach" onClick={() => go('coach')} />
        ) : (
          <QuickAction icon={<Weight className="h-4 w-4" />} label="Weigh-in" onClick={() => go('weight', { add: 1 })} />
        )}
      </div>

      {trainingDay && (
        <div className="mt-3 flex items-center gap-3 rounded-2xl border border-lime/20 bg-lime/5 px-4 py-3">
          <Dumbbell className="h-5 w-5 flex-shrink-0 text-lime" />
          <p className="text-xs leading-relaxed text-cloud-dim">
            <span className="font-semibold text-cloud">Training day.</span> Log a pre- and post-workout meal to fuel the session.
          </p>
          <button type="button" onClick={() => go('add', { meal: 'pre_workout', date: today })} className="flex-shrink-0 text-xs font-semibold text-lime">
            Log
          </button>
        </div>
      )}

      {n.coachPlan && (
        <div className="mt-3">
          <CoachPlanCard onOpen={() => go('coach-plan')} />
        </div>
      )}

      {!n.noNumbers && (
        <div className="mt-3">
          <GoalEntryCard onOpen={() => go('goal')} />
        </div>
      )}

      {insights.length > 0 && (
        <Section title="Insights" className="mt-6">
          <div className="space-y-2">
            {insights.map((i) => (
              <InsightCard key={i.id} insight={i} onRead={i.article ? () => go('library', { a: i.article }) : undefined} />
            ))}
          </div>
        </Section>
      )}

      <Section title="Everything nutrition" className="mt-6">
        <div className="grid grid-cols-2 gap-3">
          <Tile page="diary" icon={<Utensils className="h-5 w-5" />} title="Food diary" sub={`${summary.entryCount} item${summary.entryCount === 1 ? '' : 's'} today`} onGo={go} />
          <Tile page="add" icon={<Search className="h-5 w-5" />} title="Food search" sub="USDA + your own foods" onGo={go} />
          <Tile page="plan" icon={<Target className="h-5 w-5" />} title="Plan & targets" sub={n.noNumbers ? 'Balanced eating' : `${GOAL_LABELS[targets.mode]} · ${fmt(targets.kcal)} kcal`} onGo={go} />
          <Tile page="coach" icon={<Sparkles className="h-5 w-5" />} title="AI nutrition coach" sub="Plans, questions, analysis" onGo={go} highlight />
          {!n.noNumbers && <Tile page="nutrients" icon={<BarChart3 className="h-5 w-5" />} title="Nutrients" sub="Vitamins, minerals, fibre" onGo={go} />}
          {!n.noNumbers && <Tile page="weight" icon={<TrendingUp className="h-5 w-5" />} title="Weight trend" sub={n.latestTrendKg ? `${n.latestTrendKg.toFixed(1)} kg trend` : 'Log weigh-ins'} onGo={go} />}
          <Tile page="library" icon={<BookOpen className="h-5 w-5" />} title="Evidence library" sub="Guides with real references" onGo={go} />
          <Tile page="recipes" icon={<ChefHat className="h-5 w-5" />} title="Recipes" sub="Log a recipe in one tap" onGo={go} />
          <Tile page="reports" icon={<FileText className="h-5 w-5" />} title="Reports" sub="Download a PDF" onGo={go} />
          <Tile page="check-in" icon={<ShieldCheck className="h-5 w-5" />} title="Check-in & settings" sub="Wellbeing, diet, privacy" onGo={go} />
        </div>
      </Section>

      {!n.noNumbers && streak > 0 && <p className="text-center text-[11px] text-cloud-muted">Logging streak: {streak} day{streak === 1 ? '' : 's'}</p>}
      <Toast message={toast} onDone={() => setToast(null)} />
    </Page>
  );
}

function Stat({ label, value, unit, align = 'left' }: { label: string; value: string; unit: string; align?: 'left' | 'right' }) {
  return (
    <div className={cn('min-w-0', align === 'right' ? 'text-right' : 'text-left')}>
      <p className="text-[11px] text-cloud-dim">{label}</p>
      <p className="text-lg font-bold tabular-nums text-cloud">{value}</p>
      <p className="text-[10px] text-cloud-muted">{unit}</p>
    </div>
  );
}

function QuickAction({ icon, label, onClick, primary, disabled }: { icon: ReactNode; label: string; onClick: () => void; primary?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex h-12 items-center justify-center gap-1.5 rounded-xl text-xs font-semibold transition-all active:scale-[0.97] disabled:opacity-60',
        primary ? 'bg-lime text-ink-bg shadow-lime-sm' : 'border border-ink-border bg-ink-surface text-cloud hover:border-lime/30',
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function Tile({ page, icon, title, sub, onGo, highlight }: { page: NutritionPage; icon: ReactNode; title: string; sub: string; onGo: (p: NutritionPage) => void; highlight?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => onGo(page)}
      className={cn(
        'group flex min-h-[112px] flex-col justify-between rounded-2xl border p-4 text-left transition-all active:scale-[0.98]',
        highlight ? 'border-lime/30 bg-gradient-to-br from-lime/10 to-ink-surface' : 'border-ink-border bg-ink-surface hover:border-lime/30',
      )}
    >
      <div className="flex items-start justify-between">
        <span className={cn('flex h-10 w-10 items-center justify-center rounded-xl', highlight ? 'bg-lime text-ink-bg' : 'bg-ink-elevated text-lime')}>{icon}</span>
        <ChevronRight className="h-4 w-4 text-cloud-muted transition-transform group-hover:translate-x-0.5" />
      </div>
      <div className="mt-3">
        <p className="text-sm font-semibold text-cloud">{title}</p>
        <p className="mt-0.5 truncate text-[11px] text-cloud-dim">{sub}</p>
      </div>
    </button>
  );
}

function InsightCard({ insight, onRead }: { insight: Insight; onRead?: () => void }) {
  const icon =
    insight.tone === 'warn' ? <AlertTriangle className="h-4 w-4 text-gold" /> : insight.tone === 'good' ? <CheckCircle2 className="h-4 w-4 text-lime" /> : <Info className="h-4 w-4 text-sky" />;
  return (
    <div className={cn('flex gap-3 rounded-2xl border p-3.5', insight.tone === 'warn' ? 'border-gold/30 bg-gold/5' : 'border-ink-border bg-ink-surface')}>
      <div className="mt-0.5 flex-shrink-0">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-cloud">{insight.title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-cloud-dim">{insight.body}</p>
        {onRead && (
          <button type="button" onClick={onRead} className="mt-1.5 text-[11px] font-semibold text-lime">
            Why this matters →
          </button>
        )}
      </div>
    </div>
  );
}

function SetupCard({ checkInDone, onCheckIn, onPlan }: { checkInDone: boolean; onCheckIn: () => void; onPlan: () => void }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-lime/25 bg-gradient-to-br from-lime/10 via-ink-surface to-ink-surface p-5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-lime">Get started</p>
      <p className="mt-1 text-lg font-bold text-cloud">Personalise your nutrition</p>
      <p className="mt-1 text-xs leading-relaxed text-cloud-dim">Two quick steps. Until then you see maintenance targets estimated from your profile.</p>
      <div className="mt-4 space-y-2">
        <button type="button" onClick={onCheckIn} className="flex w-full items-center gap-3 rounded-xl bg-ink-bg/60 px-3.5 py-3 text-left">
          <span className={cn('flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold', checkInDone ? 'bg-lime/20 text-lime' : 'bg-lime text-ink-bg')}>
            {checkInDone ? <Check className="h-4 w-4" /> : '1'}
          </span>
          <span className={cn('flex-1 text-sm font-medium', checkInDone ? 'text-cloud-dim' : 'text-cloud')}>{checkInDone ? 'Wellbeing check-in done' : 'Wellbeing check-in (1 min)'}</span>
          <ChevronRight className="h-4 w-4 text-cloud-dim" />
        </button>
        <button type="button" onClick={onPlan} className="flex w-full items-center gap-3 rounded-xl bg-ink-bg/60 px-3.5 py-3 text-left">
          <span className={cn('flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold', checkInDone ? 'bg-lime text-ink-bg' : 'bg-ink-elevated text-cloud')}>2</span>
          <span className="flex-1 text-sm font-medium text-cloud">Choose your goal</span>
          <ChevronRight className="h-4 w-4 text-cloud-dim" />
        </button>
      </div>
    </div>
  );
}

function BalancedToday({
  summary,
  threshold,
  waterTarget,
  onOpen,
}: {
  summary: ReturnType<typeof summarizeDay>;
  threshold: number;
  waterTarget: number;
  onOpen: () => void;
}) {
  const mainSlots = MEAL_SLOTS.filter((s) => !s.workoutOnly);
  const proteinHits = proteinMealsHit(summary, threshold);
  const glasses = Math.floor(summary.waterMl / 250);
  const glassTarget = Math.max(6, Math.round(waterTarget / 250));
  return (
    <Panel className="p-5" onClick={onOpen}>
      <p className="text-sm font-semibold text-cloud">Today</p>
      <p className="mt-0.5 text-xs text-cloud-dim">Regular meals, protein at each one, and enough to drink.</p>
      <div className="mt-4 grid grid-cols-4 gap-2">
        {mainSlots.map((s) => {
          const logged = (summary.slotKcal[s.id] ?? 0) > 0 || (summary.slotProtein[s.id] ?? 0) > 0;
          return (
            <div key={s.id} className={cn('rounded-xl border px-2 py-3 text-center', logged ? 'border-lime/30 bg-lime/10' : 'border-ink-border bg-ink-bg/40')}>
              {logged ? <CheckCircle2 className="mx-auto h-5 w-5 text-lime" /> : <span className="mx-auto block h-5 w-5 rounded-full border-2 border-ink-border" />}
              <p className="mt-1.5 text-[10px] font-medium text-cloud-dim">{s.label}</p>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex items-center justify-between rounded-xl bg-ink-bg/50 px-3.5 py-3">
        <span className="text-xs text-cloud-dim">Meals with a good protein source</span>
        <span className="text-sm font-bold text-cloud">{proteinHits}</span>
      </div>
      <div className="mt-2 flex items-center gap-1.5 rounded-xl bg-ink-bg/50 px-3.5 py-3" aria-label={`${glasses} glasses of water`}>
        <Droplets className="mr-1 h-4 w-4 text-sky" />
        {Array.from({ length: Math.min(glassTarget, 12) }).map((_, i) => (
          <span key={i} className={cn('h-4 flex-1 rounded-sm', i < glasses ? 'bg-sky' : 'bg-ink-elevated')} />
        ))}
      </div>
    </Panel>
  );
}
