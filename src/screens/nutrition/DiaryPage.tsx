import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Copy, Droplets, Plus, RotateCcw, Sparkles, Trash2, Utensils } from 'lucide-react';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { cn } from '@/lib/utils';
import {
  errorMessage,
  entryProfile,
  isMealSlot,
  MEAL_SLOTS,
  scaleEntryValues,
  slotLabel,
  type FoodEntry,
  type MealSlot,
} from '@/lib/nutrition/api';
import { addDays, formatDayLabel, formatLongDate, isValidDateKey } from '@/lib/nutrition/dates';
import { summarizeDay } from '@/lib/nutrition/insights';
import { useNutrition } from './NutritionContext';
import { useNutritionNav } from './nav';
import { Chip, MACRO_COLORS, Notice, Page, PageHeader, Panel, ProgressBar, Ring, Skeleton, Stepper, Toast, fmt } from './ui';

export function DiaryPage() {
  const n = useNutrition();
  const { params, go, replace } = useNutritionNav();
  const date = isValidDateKey(params.get('date')) ? (params.get('date') as string) : n.today;
  const { days, loadRange } = n;
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<FoodEntry | null>(null);
  const [confirmCopy, setConfirmCopy] = useState(false);
  const [copying, setCopying] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [waterBusy, setWaterBusy] = useState(false);

  const prevDate = addDays(date, -1);
  useEffect(() => {
    setError(null);
    loadRange(prevDate, date).catch((err) => setError(errorMessage(err)));
  }, [prevDate, date, loadRange]);

  const day = days[date];
  const prevDay = days[prevDate];
  const targets = n.targetsFor(date);
  const trainingDay = n.isTrainingDay(date);
  const summary = useMemo(() => summarizeDay(date, day?.entries ?? [], day?.water ?? []), [date, day]);

  const grouped = useMemo(() => {
    const map = new Map<MealSlot | 'other', FoodEntry[]>();
    for (const e of day?.entries ?? []) {
      const key = e.meal_slot ?? 'other';
      map.set(key, [...(map.get(key) ?? []), e]);
    }
    return map;
  }, [day]);

  const visibleSlots = MEAL_SLOTS.filter((s) => !s.workoutOnly || trainingDay || (grouped.get(s.id)?.length ?? 0) > 0);
  const setDate = (key: string) => replace('diary', { date: key === n.today ? null : key });

  const copyPrevious = async () => {
    setCopying(true);
    try {
      const source = prevDay?.entries ?? [];
      await n.addEntries(
        source.map((e) => ({
          date,
          slot: e.meal_slot ?? 'snack',
          name: e.name,
          amounts: entryProfile(e),
          grams: e.grams,
          servings: e.servings,
          servingLabel: e.serving_label,
          foodRef: e.food_ref,
          source: null,
        })),
      );
      setToast(`Copied ${source.length} item${source.length === 1 ? '' : 's'} from ${formatDayLabel(prevDate, n.today).toLowerCase()}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setCopying(false);
      setConfirmCopy(false);
    }
  };

  const addWater = async (ml: number) => {
    setWaterBusy(true);
    try {
      await n.addWater(ml, date);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setWaterBusy(false);
    }
  };

  const undoWater = async () => {
    const last = day?.water[day.water.length - 1];
    if (!last) return;
    setWaterBusy(true);
    try {
      await n.deleteWater(last);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setWaterBusy(false);
    }
  };

  return (
    <Page>
      <PageHeader title="Food diary" subtitle={formatLongDate(date)} onBack={() => go('hub')} />

      <div className="mb-4 flex items-center gap-2">
        <button type="button" aria-label="Previous day" onClick={() => setDate(prevDate)} className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink-elevated text-cloud">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 rounded-xl bg-ink-surface py-2.5 text-center text-sm font-semibold text-cloud">
          {formatDayLabel(date, n.today)}
          {trainingDay && <span className="ml-2 rounded-full bg-lime/15 px-2 py-0.5 text-[10px] font-semibold text-lime">Training</span>}
        </div>
        <button
          type="button"
          aria-label="Next day"
          onClick={() => setDate(addDays(date, 1))}
          disabled={date >= n.today}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink-elevated text-cloud disabled:opacity-30"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {error && (
        <div className="mb-3">
          <Notice tone="warn" title="Something went wrong">
            {error}
          </Notice>
        </div>
      )}
      {n.legacyDiary && (
        <div className="mb-3">
          <Notice tone="info" title="Basic diary mode">
            The database has not been updated yet, so only calories and macros are saved and meals are grouped until you reload. Run the latest migration to enable full tracking.
          </Notice>
        </div>
      )}

      {!day ? (
        <div className="space-y-3">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
        </div>
      ) : (
        <>
          {!n.noNumbers && (
            <Panel className="mb-4 flex items-center gap-4 p-4">
              <Ring value={summary.total.kcal} max={targets.kcal} size={92} stroke={10}>
                <span className="text-base font-extrabold tabular-nums text-cloud">{fmt(summary.total.kcal)}</span>
                <span className="text-[9px] text-cloud-dim">of {fmt(targets.kcal)}</span>
              </Ring>
              <div className="min-w-0 flex-1 space-y-2">
                <MiniMacro label="Protein" value={summary.total.protein} target={targets.protein} color={MACRO_COLORS.protein} />
                <MiniMacro label="Carbs" value={summary.total.carbs} target={targets.carbs} color={MACRO_COLORS.carbs} />
                <MiniMacro label="Fat" value={summary.total.fat} target={targets.fat} color={MACRO_COLORS.fat} />
              </div>
            </Panel>
          )}

          <div className="space-y-3">
            {visibleSlots.map((slot) => (
              <MealCard
                key={slot.id}
                label={slot.label}
                entries={grouped.get(slot.id) ?? []}
                noNumbers={n.noNumbers}
                onAdd={() => go('add', { meal: slot.id, date })}
                onEdit={setEditing}
              />
            ))}
            {(grouped.get('other')?.length ?? 0) > 0 && (
              <MealCard label="Other (earlier entries)" entries={grouped.get('other') ?? []} noNumbers={n.noNumbers} onAdd={() => go('add', { meal: 'snack', date })} onEdit={setEditing} />
            )}
          </div>

          <Panel className="mt-4 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Droplets className="h-5 w-5 text-sky" />
                <div>
                  <p className="text-sm font-semibold text-cloud">Water</p>
                  <p className="text-[11px] text-cloud-dim">
                    {n.noNumbers ? `${Math.floor(summary.waterMl / 250)} glasses` : `${(summary.waterMl / 1000).toFixed(2)} of ${(targets.waterMl / 1000).toFixed(1)} L`}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                {(day.water.length ?? 0) > 0 && (
                  <button type="button" aria-label="Undo last water entry" disabled={waterBusy} onClick={undoWater} className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink-elevated text-cloud-dim">
                    <RotateCcw className="h-4 w-4" />
                  </button>
                )}
                <button type="button" disabled={waterBusy} onClick={() => addWater(250)} className="rounded-lg border border-ink-border px-3 text-xs font-semibold text-cloud disabled:opacity-50">
                  +250 ml
                </button>
                <button type="button" disabled={waterBusy} onClick={() => addWater(500)} className="rounded-lg border border-ink-border px-3 text-xs font-semibold text-cloud disabled:opacity-50">
                  +500 ml
                </button>
              </div>
            </div>
            {!n.noNumbers && <ProgressBar className="mt-3" value={summary.waterMl} max={targets.waterMl} color="#4AA8E5" />}
          </Panel>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={!prevDay?.entries.length || copying}
              onClick={() => setConfirmCopy(true)}
              className="flex h-12 items-center justify-center gap-2 rounded-xl border border-ink-border bg-ink-surface text-xs font-semibold text-cloud disabled:opacity-40"
            >
              <Copy className="h-4 w-4" /> Copy previous day
            </button>
            <button
              type="button"
              disabled={!day.entries.length}
              onClick={() => go('coach', { analyze: date })}
              className="flex h-12 items-center justify-center gap-2 rounded-xl border border-lime/30 bg-lime/10 text-xs font-semibold text-lime disabled:opacity-40"
            >
              <Sparkles className="h-4 w-4" /> Analyse this day
            </button>
          </div>
        </>
      )}

      <EntrySheet entry={editing} noNumbers={n.noNumbers} onClose={() => setEditing(null)} onError={setError} />
      <ConfirmDialog
        open={confirmCopy}
        title="Copy previous day?"
        message={`Adds ${prevDay?.entries.length ?? 0} item${prevDay?.entries.length === 1 ? '' : 's'} from ${formatDayLabel(prevDate, n.today).toLowerCase()} to ${formatDayLabel(date, n.today).toLowerCase()}. You can edit or delete them afterwards.`}
        confirmLabel={copying ? 'Copying…' : 'Copy'}
        onConfirm={copyPrevious}
        onCancel={() => setConfirmCopy(false)}
      />
      <Toast message={toast} onDone={() => setToast(null)} />
    </Page>
  );
}

function MiniMacro({ label, value, target, color }: { label: string; value: number; target: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-12 text-[10px] text-cloud-dim">{label}</span>
      <ProgressBar className="flex-1" value={value} max={target} color={value > target * 1.1 ? MACRO_COLORS.over : color} />
      <span className="w-16 text-right text-[10px] tabular-nums text-cloud-dim">
        {fmt(value)}/{fmt(target)} g
      </span>
    </div>
  );
}

export function amountLabel(e: Pick<FoodEntry, 'grams' | 'servings' | 'serving_label'>): string {
  if (e.grams && e.grams > 0) return `${fmt(e.grams, 1)} g`;
  if (e.servings && e.servings !== 1) return `${fmt(e.servings, 2)} × ${e.serving_label || 'serving'}`;
  return e.serving_label || '1 serving';
}

function MealCard({ label, entries, noNumbers, onAdd, onEdit }: { label: string; entries: FoodEntry[]; noNumbers: boolean; onAdd: () => void; onEdit: (e: FoodEntry) => void }) {
  const kcal = entries.reduce((s, e) => s + e.kcal, 0);
  const protein = entries.reduce((s, e) => s + e.protein, 0);
  return (
    <Panel className="overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-cloud">{label}</p>
          <p className="text-[11px] text-cloud-dim">
            {entries.length === 0 ? 'Nothing logged' : noNumbers ? `${entries.length} item${entries.length === 1 ? '' : 's'}` : `${fmt(kcal)} kcal · ${fmt(protein)} g protein`}
          </p>
        </div>
        <button type="button" onClick={onAdd} aria-label={`Add food to ${label}`} className="flex h-10 w-10 items-center justify-center rounded-xl bg-lime text-ink-bg shadow-lime-sm active:scale-95">
          <Plus className="h-5 w-5" />
        </button>
      </div>
      {entries.length > 0 && (
        <ul className="divide-y divide-ink-border/60 border-t border-ink-border/60">
          {entries.map((e) => (
            <li key={e.id}>
              <button type="button" onClick={() => onEdit(e)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-ink-elevated/40">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-cloud">{e.name}</p>
                  <p className="text-[11px] text-cloud-dim">
                    {amountLabel(e)}
                    {!noNumbers && ` · P ${fmt(e.protein)} · C ${fmt(e.carbs_g)} · F ${fmt(e.fat_g)}`}
                  </p>
                </div>
                {!noNumbers && <span className="text-sm font-semibold tabular-nums text-cloud">{fmt(e.kcal)}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function EntrySheet({ entry, noNumbers, onClose, onError }: { entry: FoodEntry | null; noNumbers: boolean; onClose: () => void; onError: (msg: string) => void }) {
  const n = useNutrition();
  const usesGrams = !!entry?.grams && entry.grams > 0;
  const original = usesGrams ? entry?.grams ?? 100 : entry?.servings ?? 1;
  const [amount, setAmount] = useState(original);
  const [slot, setSlot] = useState<MealSlot>('snack');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!entry) return;
    setAmount(entry.grams && entry.grams > 0 ? entry.grams : entry.servings ?? 1);
    setSlot(isMealSlot(entry.meal_slot) ? entry.meal_slot : 'snack');
    setConfirmDelete(false);
  }, [entry]);

  if (!entry) return null;
  const factor = original > 0 ? amount / original : 1;
  const preview = scaleEntryValues(entry, factor);

  const save = async () => {
    setBusy(true);
    try {
      await n.updateEntry(entry, { factor, slot });
      onClose();
    } catch (err) {
      onError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await n.deleteEntry(entry);
      onClose();
    } catch (err) {
      onError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={!!entry} onClose={onClose} title="Edit entry">
      <div className="max-h-[70vh] space-y-5 overflow-y-auto">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-ink-elevated text-lime">
            <Utensils className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-cloud">{entry.name}</p>
            <p className="text-[11px] text-cloud-dim">Currently {slotLabel(entry.meal_slot).toLowerCase()} · {amountLabel(entry)}</p>
          </div>
        </div>

        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-cloud-dim">{usesGrams ? 'Amount (grams)' : 'Servings'}</p>
          <Stepper
            label={usesGrams ? 'grams' : 'servings'}
            value={amount}
            onChange={setAmount}
            step={usesGrams ? 10 : 0.25}
            min={usesGrams ? 1 : 0.25}
            max={usesGrams ? 3000 : 20}
            decimals={usesGrams ? 0 : 2}
            suffix={usesGrams ? 'g' : '×'}
          />
        </div>

        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-cloud-dim">Meal</p>
          <div className="flex flex-wrap gap-2">
            {MEAL_SLOTS.map((s) => (
              <Chip key={s.id} active={slot === s.id} onClick={() => setSlot(s.id)}>
                {s.label}
              </Chip>
            ))}
          </div>
        </div>

        {!noNumbers && (
          <div className="grid grid-cols-4 gap-2 rounded-xl bg-ink-bg/60 p-3 text-center">
            <PreviewStat label="kcal" value={fmt(preview.kcal)} />
            <PreviewStat label="protein" value={`${fmt(preview.protein, 1)} g`} />
            <PreviewStat label="carbs" value={`${fmt(preview.carbs_g, 1)} g`} />
            <PreviewStat label="fat" value={`${fmt(preview.fat_g, 1)} g`} />
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            disabled={busy}
            className={cn('flex h-12 w-12 items-center justify-center rounded-xl border border-rust/30 bg-rust/10 text-rust', busy && 'opacity-50')}
            aria-label="Delete entry"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button type="button" onClick={save} disabled={busy} className="h-12 flex-1 rounded-xl bg-lime text-sm font-semibold text-ink-bg disabled:opacity-50">
            {busy ? 'Saving…' : 'Save changes'}
          </button>
        </div>
        {confirmDelete && (
          <div className="flex items-center justify-between rounded-xl border border-rust/30 bg-rust/5 px-3 py-2.5">
            <span className="text-xs text-cloud">Delete this entry?</span>
            <div className="flex gap-2">
              <button type="button" onClick={() => setConfirmDelete(false)} className="rounded-lg px-3 py-1.5 text-xs text-cloud-dim">
                Cancel
              </button>
              <button type="button" onClick={remove} disabled={busy} className="rounded-lg bg-rust px-3 py-1.5 text-xs font-semibold text-white">
                Delete
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function PreviewStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm font-bold tabular-nums text-cloud">{value}</p>
      <p className="text-[10px] text-cloud-dim">{label}</p>
    </div>
  );
}

