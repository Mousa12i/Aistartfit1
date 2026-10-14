import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, Home, Lightbulb, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { loadPlanLibrary, saveHomeVersion } from '@/lib/training/api';
import { adaptRoutineForHome, HOME_EQUIPMENT_CHOICES, suggestEquipment, type HomeAdaptation } from '@/lib/training/home';
import { EQUIP_LABELS, type EquipTag } from '@/lib/training/taxonomy';
import type { PlanLibrary } from '@/lib/training/engine-library';
import type { ExperienceLevel } from '@/lib/training/curated';
import type { WorkoutPlan, WorkoutPlanExercise } from '@/lib/types';
import { ClaimSources } from './coach/PlanView';

const PRESETS: { id: string; label: string; tags: EquipTag[] }[] = [
  { id: 'none', label: 'Nothing (body weight)', tags: [] },
  { id: 'basic', label: 'Dumbbells, bands, bench', tags: ['dumbbell', 'band', 'bench'] },
  { id: 'full', label: 'Home gym', tags: ['dumbbell', 'barbell', 'rack', 'bench', 'pullup_bar', 'band', 'kettlebell', 'dip_bars'] },
];

const KIND_STYLE = {
  kept: 'text-cloud-dim',
  swapped: 'text-lime',
  removed: 'text-rust',
  unknown: 'text-gold',
} as const;

export function HomeSwitchSheet({ plan, rows, onClose, onSaved }: { plan: WorkoutPlan; rows: WorkoutPlanExercise[]; onClose: () => void; onSaved: (planId: string) => void }) {
  const [lib, setLib] = useState<PlanLibrary | null>(null);
  const [equipment, setEquipment] = useState<EquipTag[]>(['dumbbell', 'band', 'bench']);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPlanLibrary()
      .then((r) => setLib(r.lib))
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load the exercise library.'));
  }, []);

  const level: ExperienceLevel = plan.difficulty === 'advanced' ? 'advanced' : plan.difficulty === 'intermediate' ? 'intermediate' : 'beginner';
  const input = useMemo(
    () => rows.map((r) => ({ exercise_id: r.exercise_id, exercise_order: r.exercise_order, sets: r.sets, reps: r.reps, rest_seconds: r.rest_seconds, day_index: r.day_index ?? 0, day_label: r.day_label ?? null, rir_target: r.rir_target ?? null, notes: r.notes ?? null })),
    [rows],
  );
  const names = useMemo(() => new Map(rows.map((r) => [r.exercise_id, r.exercise?.name ?? 'Exercise'])), [rows]);
  const result: HomeAdaptation | null = useMemo(() => (lib ? adaptRoutineForHome(input, lib, equipment, { level, sessionsPerWeek: plan.sessions_per_week, names }) : null), [lib, input, equipment, level, plan.sessions_per_week, names]);
  const tip = useMemo(() => (lib && result && result.counts.removed > 0 ? suggestEquipment(input, lib, equipment, level) : null), [lib, input, equipment, level, result]);
  const days = useMemo(() => {
    const m = new Map<number, { label: string | null; changes: HomeAdaptation['changes'] }>();
    for (const c of result?.changes ?? []) {
      const d = m.get(c.dayIndex) ?? { label: c.dayLabel, changes: [] };
      d.changes.push(c);
      m.set(c.dayIndex, d);
    }
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [result]);

  const toggle = (t: EquipTag) => setEquipment((e) => (e.includes(t) ? e.filter((x) => x !== t) : [...e, t]));

  const save = async () => {
    if (!result || result.rows.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      const id = await saveHomeVersion(plan, result.rows, { equipment: result.equipment, counts: result.counts });
      onSaved(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the home version.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" role="dialog" aria-modal="true" aria-label="Train at home">
      <div className="max-h-[94vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-ink-border bg-ink-surface p-5 sm:rounded-3xl" data-testid="home-switch">
        <div className="mb-3 flex items-start justify-between">
          <div>
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-lime"><Home className="h-3.5 w-3.5" /> Train at home</p>
            <h2 className="text-lg font-bold text-cloud">Same plan, your home equipment</h2>
            <p className="text-[11px] text-cloud-dim">Every exercise you can't do at home is swapped for the one that trains the most of the same muscles. Days and sets stay the same.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full bg-ink-elevated p-2 text-cloud-dim">
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mb-1.5 text-xs font-semibold text-cloud">What do you have at home?</p>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {PRESETS.map((p) => {
            const on = p.tags.length === equipment.length && p.tags.every((t) => equipment.includes(t));
            return (
              <button key={p.id} type="button" onClick={() => setEquipment(p.tags)} className={cn('rounded-full px-3 py-1.5 text-[11px] font-semibold', on ? 'bg-lime text-ink-bg' : 'bg-ink-elevated text-cloud-dim')}>
                {p.label}
              </button>
            );
          })}
        </div>
        <div className="mb-4 flex flex-wrap gap-1.5">
          {HOME_EQUIPMENT_CHOICES.map((t) => (
            <button key={t} type="button" aria-pressed={equipment.includes(t)} onClick={() => toggle(t)} className={cn('flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px]', equipment.includes(t) ? 'border-lime/50 bg-lime/10 text-lime' : 'border-ink-border text-cloud-dim')}>
              {equipment.includes(t) && <Check className="h-3 w-3" />}
              {EQUIP_LABELS[t]}
            </button>
          ))}
        </div>

        {!result && !error && <p className="py-6 text-center text-xs text-cloud-dim">Loading the exercise library…</p>}
        {result && (
          <>
            <div className="mb-3 grid grid-cols-3 gap-2 text-center" data-testid="home-counts">
              <div className="rounded-xl bg-ink-elevated px-2 py-2"><p className="text-lg font-bold text-cloud">{result.counts.kept + result.counts.unknown}</p><p className="text-[10px] text-cloud-dim">kept</p></div>
              <div className="rounded-xl bg-ink-elevated px-2 py-2"><p className="text-lg font-bold text-lime">{result.counts.swapped}</p><p className="text-[10px] text-cloud-dim">swapped</p></div>
              <div className="rounded-xl bg-ink-elevated px-2 py-2"><p className={cn('text-lg font-bold', result.counts.removed ? 'text-rust' : 'text-cloud')}>{result.counts.removed}</p><p className="text-[10px] text-cloud-dim">no home option</p></div>
            </div>

            {tip && (
              <div className="mb-3 flex items-start gap-2 rounded-xl border border-gold/30 bg-gold/5 p-3" data-testid="home-tip">
                <Lightbulb className="mt-0.5 h-4 w-4 flex-shrink-0 text-gold" />
                <p className="text-[11px] text-cloud">
                  Adding <b>{EQUIP_LABELS[tip.tag].toLowerCase()}</b> would keep {tip.restored} more exercise{tip.restored > 1 ? 's' : ''}.{' '}
                  <button type="button" onClick={() => toggle(tip.tag)} className="font-semibold text-gold underline">Add it</button>
                </p>
              </div>
            )}

            <div className="mb-4 space-y-3">
              {days.map(([d, info]) => (
                <div key={d}>
                  {days.length > 1 && <p className="mb-1 text-[11px] font-semibold text-cloud">{info.label ?? `Day ${d + 1}`}</p>}
                  <ul className="space-y-1">
                    {info.changes.map((c, i) => (
                      <li key={i} className="flex items-start gap-1.5 rounded-lg bg-ink-elevated/60 px-2.5 py-1.5 text-[11px]">
                        <span className={cn('min-w-0 flex-1', KIND_STYLE[c.kind])}>
                          {c.kind === 'swapped' ? (
                            <>
                              <span className="text-cloud-dim line-through decoration-cloud-dim/50">{c.from.name}</span> <ArrowRight className="inline h-3 w-3" /> <b className="text-cloud">{c.to?.name}</b>
                              {c.lighter && <span className="block text-[10px] text-gold">Lighter: {c.repsAfter} reps, close to failure</span>}
                            </>
                          ) : c.kind === 'removed' ? (
                            <>{c.from.name} — no home exercise for these muscles with this equipment</>
                          ) : (
                            <>{c.from.name}</>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <p className="mb-1 text-xs font-semibold text-cloud">Weekly sets per muscle group</p>
            <div className="mb-3 grid grid-cols-2 gap-x-4 gap-y-1" data-testid="home-volume">
              {result.volume.map((v) => (
                <div key={v.group} className="flex items-center justify-between text-[11px]">
                  <span className="truncate text-cloud-dim">{v.label}</span>
                  <span className={cn('tabular-nums font-semibold', v.after < v.before * 0.75 ? 'text-rust' : 'text-cloud')}>
                    {v.before} → {v.after}
                  </span>
                </div>
              ))}
            </div>
            <ClaimSources claimIds={result.claimIds} className="mb-4" />
          </>
        )}

        {error && <p className="mb-3 text-xs text-rust">{error}</p>}
        <button
          type="button"
          disabled={!result || result.rows.length === 0 || saving}
          onClick={() => void save()}
          data-testid="save-home"
          className="w-full rounded-xl bg-lime py-3 text-sm font-bold text-ink-bg disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Use this at home'}
        </button>
        <p className="mt-2 text-center text-[10px] text-cloud-dim">Your gym routine stays saved. Switch back with one tap.</p>
      </div>
    </div>
  );
}
