import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Star } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/utils';
import { errorMessage, MEAL_SLOTS, type MealSlot } from '@/lib/nutrition/api';
import { SOURCE_BADGE, type FoodItem } from '@/lib/nutrition/foods';
import { atwaterKcal, MICRO_KEYS, metaFor, scaleProfile } from '@/lib/nutrition/nutrients';
import { useNutrition } from './NutritionContext';
import { Chip, MACRO_COLORS, Stepper, fmt } from './ui';

export function SourceBadge({ food }: { food: Pick<FoodItem, 'source'> }) {
  const badge = SOURCE_BADGE[food.source];
  const tone = {
    lime: 'bg-lime/15 text-lime',
    sky: 'bg-sky/15 text-sky',
    gold: 'bg-gold/15 text-gold',
    dim: 'bg-ink-elevated text-cloud-dim',
  }[badge.tone];
  return <span className={cn('rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide', tone)}>{badge.label}</span>;
}

export function displayName(food: Pick<FoodItem, 'name' | 'brand'>): string {
  return food.brand ? `${food.name} — ${food.brand}` : food.name;
}

interface PortionSheetProps {
  food: FoodItem | null;
  date: string;
  defaultSlot: MealSlot;
  onClose: () => void;
  onAdded: (message: string) => void;
}

export function PortionSheet({ food, date, defaultSlot, onClose, onAdded }: PortionSheetProps) {
  const n = useNutrition();
  const [amount, setAmount] = useState(100);
  const [slot, setSlot] = useState<MealSlot>(defaultSlot);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [favBusy, setFavBusy] = useState(false);

  useEffect(() => {
    if (!food) return;
    setAmount(food.defaultGrams > 0 ? food.defaultGrams : food.servingOnly ? 1 : 100);
    setSlot(defaultSlot);
    setError(null);
    setShowMore(false);
  }, [food, defaultSlot]);

  const amounts = useMemo(() => (food ? scaleProfile(food.per100, food.servingOnly ? amount : amount / 100) : null), [food, amount]);

  if (!food || !amounts) return null;

  const servingOnly = !!food.servingOnly;
  const per100Kcal = food.per100.kcal;
  const macroKcal = atwaterKcal(food.per100.protein, food.per100.carbs, food.per100.fat, food.per100.micros.alcohol_g ?? 0);
  const mismatch = per100Kcal > 40 && Math.abs(macroKcal - per100Kcal) / per100Kcal > 0.25;
  const favorite = n.isFavorite(food.ref);
  const micros = MICRO_KEYS.filter((k) => amounts.micros[k] != null);
  const matchingServing = food.servings.find((s) => Math.abs(s.grams - amount) < 0.01);

  const add = async () => {
    if (!(amount > 0)) return;
    setBusy(true);
    setError(null);
    try {
      await n.addEntries([
        {
          date,
          slot,
          name: displayName(food).slice(0, 200),
          amounts,
          grams: servingOnly ? null : amount,
          servings: servingOnly ? amount : null,
          servingLabel: servingOnly ? food.servings[0]?.label ?? 'serving' : matchingServing && matchingServing.label !== '100 g' ? matchingServing.label : null,
          foodRef: food.ref,
          source: food.source,
        },
      ]);
      onAdded(`Added to ${MEAL_SLOTS.find((s) => s.id === slot)?.label ?? 'diary'}`);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const toggleFavorite = async () => {
    setFavBusy(true);
    try {
      await n.toggleFavorite(food);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setFavBusy(false);
    }
  };

  return (
    <Modal open={!!food} onClose={onClose}>
      <div className="max-h-[78vh] space-y-5 overflow-y-auto pr-1">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              <SourceBadge food={food} />
              <span className="truncate text-[10px] text-cloud-muted">{food.sourceLabel}</span>
            </div>
            <h2 className="text-lg font-bold leading-snug text-cloud">{food.name}</h2>
            {food.brand && <p className="text-xs text-cloud-dim">{food.brand}</p>}
          </div>
          {n.settingsAvailable && (
            <button
              type="button"
              onClick={toggleFavorite}
              disabled={favBusy}
              aria-label={favorite ? 'Remove from favourites' : 'Add to favourites'}
              aria-pressed={favorite}
              className={cn('flex h-10 w-10 items-center justify-center rounded-xl', favorite ? 'bg-gold/15 text-gold' : 'bg-ink-elevated text-cloud-dim')}
            >
              <Star className="h-5 w-5" fill={favorite ? 'currentColor' : 'none'} />
            </button>
          )}
        </div>

        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-cloud-dim">{servingOnly ? `Servings (${food.servings[0]?.label ?? 'serving'})` : 'Amount'}</p>
          <Stepper
            label={servingOnly ? 'servings' : 'grams'}
            value={amount}
            onChange={setAmount}
            step={servingOnly ? 0.5 : 10}
            min={servingOnly ? 0.25 : 1}
            max={servingOnly ? 20 : 3000}
            decimals={servingOnly ? 2 : 0}
            suffix={servingOnly ? '×' : 'g'}
          />
          {!servingOnly && food.servings.length > 0 && (
            <div className="mt-2.5 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {food.servings.map((s) => (
                <Chip key={`${s.label}-${s.grams}`} active={Math.abs(s.grams - amount) < 0.01} onClick={() => setAmount(Math.round(s.grams * 10) / 10)}>
                  {s.label === '100 g' ? '100 g' : `${s.label} · ${fmt(s.grams, 1)} g`}
                </Chip>
              ))}
            </div>
          )}
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

        {!n.noNumbers && (
          <div className="rounded-2xl border border-ink-border bg-ink-bg/60 p-4">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[11px] text-cloud-dim">Energy</p>
                <p className="text-3xl font-extrabold tabular-nums text-cloud">
                  {fmt(amounts.kcal)} <span className="text-sm font-medium text-cloud-dim">kcal</span>
                </p>
              </div>
              <p className="text-[10px] text-cloud-muted">{servingOnly ? 'per portion chosen' : `${fmt(per100Kcal)} kcal / 100 g`}</p>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <MacroTile label="Protein" value={amounts.protein} color={MACRO_COLORS.protein} />
              <MacroTile label="Carbs" value={amounts.carbs} color={MACRO_COLORS.carbs} />
              <MacroTile label="Fat" value={amounts.fat} color={MACRO_COLORS.fat} />
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2 text-center">
              <Small label="Sugars" value={amounts.sugar} unit="g" />
              <Small label="Fibre" value={amounts.fiber} unit="g" />
              <Small label="Sat. fat" value={amounts.satFat} unit="g" />
              <Small label="Sodium" value={amounts.sodiumMg} unit="mg" />
            </div>
            {micros.length > 0 && (
              <>
                <button type="button" onClick={() => setShowMore((v) => !v)} className="mt-3 flex w-full items-center justify-center gap-1 text-[11px] font-semibold text-lime">
                  {showMore ? 'Hide' : 'Show'} {micros.length} more nutrients {showMore ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
                {showMore && (
                  <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5">
                    {micros.map((k) => {
                      const meta = metaFor(k);
                      return (
                        <div key={k} className="flex justify-between text-[11px]">
                          <span className="text-cloud-dim">{meta?.label ?? k}</span>
                          <span className="tabular-nums text-cloud">
                            {fmt(amounts.micros[k], meta?.decimals ?? 1)} {meta?.unit}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {mismatch && !n.noNumbers && (
          <div className="flex gap-2 rounded-xl border border-gold/30 bg-gold/5 p-3 text-[11px] leading-relaxed text-cloud-dim">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 text-gold" />
            The listed energy ({fmt(per100Kcal)} kcal/100 g) does not match its protein, carbs and fat ({fmt(macroKcal)} kcal). Check the pack label.
          </div>
        )}
        {food.dataNote && <p className="text-[10px] leading-relaxed text-cloud-muted">{food.dataNote}</p>}
        {error && <p className="text-xs text-rust">{error}</p>}

        <button type="button" onClick={add} disabled={busy || !(amount > 0)} className="h-12 w-full rounded-xl bg-lime text-sm font-bold text-ink-bg shadow-lime-sm disabled:opacity-50">
          {busy ? 'Adding…' : `Add to ${MEAL_SLOTS.find((s) => s.id === slot)?.label ?? 'diary'}`}
        </button>
      </div>
    </Modal>
  );
}

function MacroTile({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl bg-ink-surface px-2 py-2.5 text-center">
      <p className="text-base font-bold tabular-nums" style={{ color }}>
        {fmt(value, 1)} g
      </p>
      <p className="text-[10px] text-cloud-dim">{label}</p>
    </div>
  );
}

function Small({ label, value, unit }: { label: string; value: number | null; unit: string }) {
  return (
    <div>
      <p className="text-xs font-semibold tabular-nums text-cloud">{value == null ? '—' : `${fmt(value, unit === 'mg' ? 0 : 1)} ${unit}`}</p>
      <p className="text-[9px] text-cloud-dim">{label}</p>
    </div>
  );
}
