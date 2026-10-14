import { useEffect, useState, useRef } from 'react';
import { fetchExerciseById, fetchPlanExercises } from '@/lib/data';
import { addExerciseToRoutine, createEmptyRoutine, listMyRoutines } from '@/lib/training/api';
import { routineDays } from '@/lib/training/routine';
import { MUSCLE_LABELS as FINE_MUSCLE_LABELS, type RecoveryMuscle } from '@/lib/recovery/muscles';
import {
  EQUIP_LABELS, EXTRA_MUSCLE_LABELS, PAIN_AREA_FLAGS, PAIN_AREA_LABELS, PATTERN_LABELS, SAFETY_FLAG_LABELS,
  type EquipTag, type ExtraMuscle, type MovementPattern, type PainArea, type SafetyFlag,
} from '@/lib/training/taxonomy';
import { Modal } from '@/components/ui/Modal';
import type { Exercise, WorkoutPlan } from '@/lib/types';
import { AnatomyViewer } from '@/components/ui/AnatomyViewer';
import { LoadingState, ErrorState } from '@/components/ui/States';
import {
  ChevronLeft, Star, HelpCircle,
  TrendingUp, Repeat, Target, Pencil, BarChart3,
  AlertTriangle, Play, ListPlus, Check, Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { StrengthTrends } from '@/components/StrengthTrends';

interface ExerciseDetailProps {
  exerciseId: string;
  onBack: () => void;
  onStartExercise: (exerciseId: string) => void;
  onOpenExercise: (exerciseId: string) => void;
}

export function ExerciseDetail({ exerciseId, onBack, onStartExercise, onOpenExercise }: ExerciseDetailProps) {
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isFavorite, setIsFavorite] = useState(false);
  const [note, setNote] = useState('');
  const [editingNote, setEditingNote] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showAddToRoutine, setShowAddToRoutine] = useState(false);
  const [canonical, setCanonical] = useState<Exercise | null>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchExerciseById(exerciseId);
        setExercise(data);
        if (data?.is_hidden && data.canonical_id) setCanonical(await fetchExerciseById(data.canonical_id).catch(() => null));
        const savedNote = localStorage.getItem(`exercise_note_${exerciseId}`);
        if (savedNote) setNote(savedNote);
        const savedFav = localStorage.getItem(`exercise_fav_${exerciseId}`);
        setIsFavorite(savedFav === 'true');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load exercise');
      } finally {
        setLoading(false);
      }
    })();
  }, [exerciseId]);

  const toggleFavorite = () => {
    const newVal = !isFavorite;
    setIsFavorite(newVal);
    localStorage.setItem(`exercise_fav_${exerciseId}`, String(newVal));
  };

  const saveNote = () => {
    localStorage.setItem(`exercise_note_${exerciseId}`, note);
    setEditingNote(false);
  };

  if (loading) return <div className="px-5 pt-12"><LoadingState /></div>;
  if (error) return <ErrorState message={error} onRetry={onBack} />;
  if (!exercise) return <ErrorState message="Exercise not found" onRetry={onBack} />;

  const difficultyLevel = exercise.difficulty === 'beginner' ? 1 : exercise.difficulty === 'intermediate' ? 2 : 3;
  const aliases = (exercise.aliases ?? []).filter((a) => a.toLowerCase() !== exercise.name.toLowerCase());
  const secondaryList = (exercise.secondary_muscles ?? []).filter(Boolean) as string[];
  const direct = (exercise.muscles_primary ?? []) as RecoveryMuscle[];
  const helping = (exercise.muscles_secondary ?? []) as RecoveryMuscle[];
  const stabilisers = (exercise.muscles_extra ?? []) as ExtraMuscle[];
  const flags = (exercise.safety_flags ?? []) as SafetyFlag[];
  const careAreas = (Object.keys(PAIN_AREA_FLAGS) as PainArea[]).filter((a) => PAIN_AREA_FLAGS[a].some((f) => flags.includes(f)));
  const equipment = (exercise.equipment_tags ?? []) as EquipTag[];

  return (
    <div className="min-h-screen bg-ink-bg animate-fade-in pb-8">
      {/* Top Bar */}
      <div className="sticky top-0 z-20 bg-ink-bg/90 backdrop-blur-md border-b border-ink-border/30">
        <div className="flex items-center gap-2 px-4 pt-5 pb-3">
          <button
            onClick={onBack}
            className="w-9 h-9 rounded-xl bg-ink-elevated flex items-center justify-center text-cloud-dim hover:text-cloud transition-colors flex-shrink-0"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="flex-1 text-base font-semibold text-cloud truncate text-center px-1">
            {exercise.name}
          </h1>
          <button
            onClick={toggleFavorite}
            className="w-9 h-9 rounded-xl bg-ink-elevated flex items-center justify-center transition-colors flex-shrink-0"
          >
            <Star
              className={cn('w-4.5 h-4.5', isFavorite ? 'text-gold' : 'text-cloud-dim')}
              fill={isFavorite ? 'currentColor' : 'none'}
            />
          </button>
          <button
            onClick={() => setShowHelp(!showHelp)}
            className="w-9 h-9 rounded-xl bg-ink-elevated flex items-center justify-center text-cloud-dim hover:text-cloud transition-colors flex-shrink-0"
          >
            <HelpCircle className="w-4.5 h-4.5" />
          </button>
        </div>
        {/* Duration/Sets breakdown */}
        <div className="flex items-center justify-center gap-4 pb-2.5 text-[11px] text-cloud-dim">
          <span className="flex items-center gap-1">
            <Target className="w-3 h-3 text-lime" />
            Start: {exercise.default_sets} sets
          </span>
          <span className="flex items-center gap-1">
            <Repeat className="w-3 h-3 text-lime" />
            {exercise.default_reps}
          </span>
          <span className="flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-lime" />
            {exercise.default_rest_seconds}s rest
          </span>
        </div>
      </div>

      {/* Help tooltip */}
      {showHelp && (
        <div className="px-5 py-3 bg-sky/5 border-b border-sky/20 animate-fade-in">
          <p className="text-xs text-cloud-dim leading-relaxed">
            Muscles come from the StartFit exercise library: main muscles count as one set per set you do, helping muscles as half a set.
            The level is the library's difficulty rating. Use the steps below for technique.
          </p>
        </div>
      )}

      {/* Exercise Demonstration Photo */}
      <div className="relative px-3 mt-4">
        <AnatomyViewer
          exerciseName={exercise.name}
          primaryMuscle={exercise.primary_muscle}
          secondaryMuscles={secondaryList}
          imageUrl={exercise.image_url}
        />
      </div>

      {/* Exercise Data Chips */}
      <div className="px-5 mt-5 mb-4">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
          <DataChip
            icon={<BarChart3 className="w-3.5 h-3.5" />}
            label={`Level ${difficultyLevel}`}
            subLabel="why?"
            onSubClick={() => setShowHelp(!showHelp)}
          />
          {exercise.force_type && (
            <DataChip
              icon={<Repeat className="w-3.5 h-3.5" />}
              label={exercise.force_type.charAt(0).toUpperCase() + exercise.force_type.slice(1)}
            />
          )}
          {exercise.mechanic && (
            <DataChip
              icon={<Target className="w-3.5 h-3.5" />}
              label={exercise.mechanic.charAt(0).toUpperCase() + exercise.mechanic.slice(1)}
            />
          )}
          {exercise.category && (
            <DataChip
              icon={<TrendingUp className="w-3.5 h-3.5" />}
              label={exercise.category.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
            />
          )}
          {exercise.is_custom && (
            <DataChip
              icon={<Star className="w-3.5 h-3.5" />}
              label="Custom"
            />
          )}
        </div>
      </div>

      {canonical && (
        <div className="px-5 mb-4">
          <button onClick={() => onOpenExercise(canonical.id)} className="w-full text-left rounded-xl2 bg-sky/5 border border-sky/20 p-3.5">
            <p className="text-xs text-cloud-dim">This is an older duplicate entry kept for past workouts. The main entry is</p>
            <p className="text-sm font-semibold text-sky mt-0.5">{canonical.name} →</p>
          </button>
        </div>
      )}

      {/* Muscles: from the exercise library (direct = counted as 1 set, helping = ½ set) */}
      <div className="px-5 mb-4">
        <h3 className="text-xs font-semibold text-cloud-dim uppercase tracking-wider mb-3">Muscles trained</h3>
        {direct.length === 0 && helping.length === 0 && stabilisers.length === 0 ? (
          <p className="text-sm text-cloud-dim">
            {exercise.pattern === 'cardio' || exercise.pattern === 'mobility' || exercise.pattern === 'balance'
              ? 'This is a cardio, mobility or balance exercise, so it is not counted as strength volume for a muscle.'
              : 'No muscle data for this exercise yet.'}
          </p>
        ) : (
          <div className="space-y-3">
            {direct.length > 0 && (
              <MuscleRow title="Main muscles" hint="each set counts as 1 set" names={direct.map((m) => FINE_MUSCLE_LABELS[m] ?? m)} strong />
            )}
            {helping.length > 0 && (
              <MuscleRow title="Helping muscles" hint="each set counts as ½ set" names={helping.map((m) => FINE_MUSCLE_LABELS[m] ?? m)} />
            )}
            {stabilisers.length > 0 && (
              <MuscleRow title="Small stabilisers" hint="not counted as volume" names={stabilisers.map((m) => EXTRA_MUSCLE_LABELS[m] ?? m)} />
            )}
          </div>
        )}
        <div className="flex flex-wrap gap-2 mt-3 text-[11px]">
          {exercise.pattern && (
            <span className="px-2 py-1 rounded-lg bg-ink-surface border border-ink-border text-cloud-dim">
              Movement: <span className="text-cloud">{PATTERN_LABELS[exercise.pattern as MovementPattern] ?? exercise.pattern}</span>
            </span>
          )}
          {equipment.length > 0 && (
            <span className="px-2 py-1 rounded-lg bg-ink-surface border border-ink-border text-cloud-dim">
              Equipment: <span className="text-cloud">{equipment.map((t) => EQUIP_LABELS[t] ?? t).join(', ')}</span>
            </span>
          )}
          {exercise.is_unilateral && <span className="px-2 py-1 rounded-lg bg-ink-surface border border-ink-border text-cloud">One side at a time</span>}
        </div>
      </div>

      {aliases.length > 0 && (
        <div className="px-5 mb-4">
          <p className="text-xs text-cloud-dim">
            Also known as: <span className="text-cloud">{aliases.join(', ')}</span>
          </p>
        </div>
      )}

      {flags.length > 0 && (
        <div className="px-5 mb-4">
          <div className="rounded-xl2 bg-gold/5 border border-gold/20 p-4">
            <p className="text-xs font-semibold text-gold flex items-center gap-1.5 mb-1.5">
              <AlertTriangle className="w-3.5 h-3.5" /> Movement features
            </p>
            <p className="text-xs text-cloud-dim leading-relaxed">{flags.map((f) => SAFETY_FLAG_LABELS[f] ?? f).join(' · ')}</p>
            {careAreas.length > 0 && (
              <p className="text-[11px] text-cloud-dim leading-relaxed mt-2">
                The plan builder leaves this exercise out while you report pain in: {careAreas.map((a) => PAIN_AREA_LABELS[a].toLowerCase()).join(', ')} (StartFit precaution, not a diagnosis).
              </p>
            )}
          </div>
        </div>
      )}

      {/* Exercise Note */}
      <div className="px-5 mb-4">
        <div className="rounded-xl2 bg-ink-surface border border-ink-border p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-cloud-dim uppercase tracking-wider">Exercise Note</span>
            {!editingNote ? (
              <button
                onClick={() => {
                  setEditingNote(true);
                  setTimeout(() => noteRef.current?.focus(), 100);
                }}
                className="text-cloud-dim hover:text-lime transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={saveNote}
                className="text-xs text-lime font-medium"
              >
                Save
              </button>
            )}
          </div>
          {editingNote ? (
            <textarea
              ref={noteRef}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onBlur={saveNote}
              placeholder="Write your notes about this exercise..."
              rows={3}
              className="w-full bg-ink-elevated rounded-lg px-3 py-2 text-sm text-cloud placeholder:text-cloud-dim/50 resize-none focus:outline-none focus:border-lime/30 border border-transparent"
            />
          ) : (
            <p className={cn('text-sm leading-relaxed', note ? 'text-cloud-dim' : 'text-cloud-dim/40 italic')}>
              {note || 'Tap the pencil to add a note about this exercise.'}
            </p>
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="px-5 mb-4">
        <h3 className="text-xs font-semibold text-cloud-dim uppercase tracking-wider mb-3">How to Perform</h3>
        <div className="space-y-2.5">
          {exercise.instructions.map((step, i) => (
            <div key={i} className="flex items-start gap-3 rounded-xl2 bg-ink-surface border border-ink-border p-3">
              <div className="w-6 h-6 rounded-lg bg-lime/10 flex items-center justify-center text-lime text-[10px] font-bold flex-shrink-0">
                {i + 1}
              </div>
              <p className="text-sm text-cloud-dim leading-relaxed pt-0.5">{step}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Strength Trends (tier-gated) */}
      <div className="px-5 mt-6">
        <StrengthTrends exerciseName={exercise.name} />
      </div>

      {/* Safety Notes */}
      {exercise.safety_notes && (
        <div className="px-5 mt-4">
          <div className="rounded-xl2 bg-gold/5 border border-gold/20 p-4">
            <p className="text-xs text-cloud-dim leading-relaxed">
              <span className="text-gold font-semibold">Safety: </span>
              {exercise.safety_notes}
            </p>
          </div>
        </div>
      )}

      <div className="h-24" />
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-ink-surface/95 backdrop-blur-xl border-t border-ink-border p-4 safe-bottom">
        <div className="max-w-md mx-auto flex gap-3">
          <button
            onClick={() => setShowAddToRoutine(true)}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-ink-elevated text-cloud text-sm font-semibold"
          >
            <ListPlus className="w-4 h-4" /> Add to routine
          </button>
          <button
            onClick={() => onStartExercise(canonical?.id ?? exercise.id)}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-lime text-ink-bg text-sm font-bold"
          >
            <Play className="w-4 h-4" fill="currentColor" /> Start & log
          </button>
        </div>
      </div>

      {showAddToRoutine && <AddToRoutineModal exercise={canonical ?? exercise} onClose={() => setShowAddToRoutine(false)} />}
    </div>
  );
}

function MuscleRow({ title, hint, names, strong }: { title: string; hint: string; names: string[]; strong?: boolean }) {
  return (
    <div>
      <p className="text-[11px] text-cloud-dim mb-1.5">
        <span className={cn('font-semibold', strong ? 'text-cloud' : 'text-cloud-dim')}>{title}</span> · {hint}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {names.map((n) => (
          <span key={n} className={cn('px-2.5 py-1 rounded-lg text-xs font-medium', strong ? 'bg-lime/15 text-lime' : 'bg-ink-elevated text-cloud-dim')}>
            {n}
          </span>
        ))}
      </div>
    </div>
  );
}

function AddToRoutineModal({ exercise, onClose }: { exercise: Exercise; onClose: () => void }) {
  const [routines, setRoutines] = useState<WorkoutPlan[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [days, setDays] = useState<{ index: number; label: string }[]>([]);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    listMyRoutines().then(setRoutines).catch((e) => setErr(e instanceof Error ? e.message : 'Could not load your routines.'));
  }, []);

  const choose = async (planId: string) => {
    setSelected(planId);
    setErr(null);
    try {
      const rows = await fetchPlanExercises(planId);
      const d = routineDays(rows).map((x) => ({ index: x.index, label: x.label }));
      setDays(d.length ? d : [{ index: 0, label: 'Day 1' }]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not load that routine.');
    }
  };

  const add = async (planId: string, day: { index: number; label: string }) => {
    setBusy(true);
    setErr(null);
    try {
      await addExerciseToRoutine(planId, exercise, day.index, days.length > 1 ? day.label : null);
      setDone(day.label);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not add the exercise.');
    } finally {
      setBusy(false);
    }
  };

  const createAndAdd = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const id = await createEmptyRoutine(newName.trim());
      await addExerciseToRoutine(id, exercise, 0, null);
      setDone(newName.trim());
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not create the routine.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} className="sm:max-w-md">
      <h2 className="text-display-sm font-semibold text-cloud mb-1">Add to routine</h2>
      <p className="text-xs text-cloud-dim mb-4">{exercise.name}</p>
      {done ? (
        <div className="text-center py-6">
          <Check className="w-8 h-8 text-lime mx-auto mb-2" />
          <p className="text-sm text-cloud">Added to {done}.</p>
          <button onClick={onClose} className="mt-4 px-4 py-2 rounded-xl bg-lime text-ink-bg text-sm font-semibold">Done</button>
        </div>
      ) : !routines ? (
        <p className="text-sm text-cloud-dim py-4">{err ?? 'Loading your routines…'}</p>
      ) : (
        <div className="space-y-2 max-h-[50vh] overflow-y-auto">
          {routines.map((r) => (
            <div key={r.id} className="rounded-xl bg-ink-elevated/60 border border-ink-border">
              <button onClick={() => void choose(r.id)} className="w-full text-left px-3.5 py-3 text-sm text-cloud font-medium">{r.name}</button>
              {selected === r.id && (
                <div className="px-3.5 pb-3 flex flex-wrap gap-2">
                  {days.map((d) => (
                    <button
                      key={d.index}
                      disabled={busy}
                      onClick={() => void add(r.id, d)}
                      className="px-3 py-1.5 rounded-lg bg-lime/10 text-lime text-xs font-semibold disabled:opacity-50"
                    >
                      {days.length > 1 ? d.label : 'Add'}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
          <div className="rounded-xl border border-dashed border-lime/30 p-3">
            <p className="text-xs text-cloud-dim mb-2">{routines.length ? 'Or start a new routine' : 'You have no routines yet. Start one:'}</p>
            <div className="flex gap-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Routine name"
                maxLength={120}
                className="flex-1 bg-ink-elevated border border-ink-border rounded-lg px-3 py-2 text-sm text-cloud placeholder:text-cloud-dim/50 focus:outline-none focus:border-lime/50"
              />
              <button disabled={busy || !newName.trim()} onClick={() => void createAndAdd()} className="px-3 rounded-lg bg-lime text-ink-bg disabled:opacity-50" aria-label="Create routine">
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
          {err && <p className="text-xs text-rust">{err}</p>}
        </div>
      )}
    </Modal>
  );
}

function DataChip({
  icon,
  label,
  subLabel,
  onSubClick,
}: {
  icon: React.ReactNode;
  label: string;
  subLabel?: string;
  onSubClick?: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-ink-surface border border-ink-border flex-shrink-0">
      <span className="text-lime">{icon}</span>
      <span className="text-xs font-medium text-cloud">{label}</span>
      {subLabel && (
        <button
          onClick={onSubClick}
          className="text-[10px] text-sky hover:text-sky/80 transition-colors ml-0.5"
        >
          - {subLabel}
        </button>
      )}
    </div>
  );
}
