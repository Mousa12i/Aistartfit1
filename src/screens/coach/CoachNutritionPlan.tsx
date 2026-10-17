import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Copy, Loader2, Plus, Search, Trash2, Utensils, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { useI18n, type MessageKey } from '@/lib/i18n';
import { fetchRoster } from '@/lib/coach/api';
import type { RosterRow } from '@/lib/coach/insights';
import {
  dayTargets, itemMacros, KCAL_MAX, KCAL_MIN, loadNutritionPlan, newId, optionMacros, planDayMacros, planErrors, saveNutritionPlan,
  type Macros, type MealOption, type NutritionPlan, type PlanItem, type PlanMeal,
} from '@/lib/coach/nutrition-plan';
import { searchFoodDatabase } from '@/lib/nutrition/api';
import { searchLocalFoods, type FoodItem } from '@/lib/nutrition/foods';
import { Sheet } from './ui';

type T = (k: MessageKey, v?: Record<string, string | number>) => string;
const field = 'w-full rounded-xl border border-ink-border bg-ink-bg px-3 py-2 text-sm text-cloud placeholder:text-cloud-muted focus:border-lime/50 focus:outline-none';
const num = (s: string) => (s.trim() === '' ? NaN : Number(s.replace(',', '.')));

const MEAL_PRESETS: MessageKey[] = ['mealplan.breakfast', 'mealplan.lunch', 'mealplan.dinner', 'mealplan.snack', 'mealplan.preWorkout', 'mealplan.postWorkout'];

/** /coach/athlete/:id/nutrition-plan — the coach builds the athlete's nutrition plan. */
export function CoachNutritionPlan() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, dir } = useI18n();
  const [row, setRow] = useState<RosterRow | null>(null);
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [protein, setProtein] = useState('');
  const [carbsT, setCarbsT] = useState('');
  const [fatT, setFatT] = useState('');
  const [sameRest, setSameRest] = useState(true);
  const [carbsR, setCarbsR] = useState('');
  const [fatR, setFatR] = useState('');
  const [fiber, setFiber] = useState('');
  const [water, setWater] = useState('');
  const [meals, setMeals] = useState<PlanMeal[]>([]);
  const [eat, setEat] = useState('');
  const [limit, setLimit] = useState('');
  const [notes, setNotes] = useState('');
  const [picker, setPicker] = useState<{ meal: string; option: string } | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const fill = (p: NutritionPlan) => {
    setProtein(String(p.protein_g)); setCarbsT(String(p.carbs_train_g)); setFatT(String(p.fat_train_g));
    const same = p.carbs_rest_g === p.carbs_train_g && p.fat_rest_g === p.fat_train_g;
    setSameRest(same); setCarbsR(String(p.carbs_rest_g)); setFatR(String(p.fat_rest_g));
    setFiber(p.fiber_g != null ? String(p.fiber_g) : ''); setWater(p.water_ml != null ? String(p.water_ml) : '');
    setMeals(p.meals.map((m) => ({ ...m, id: newId(), options: m.options.map((o) => ({ ...o, id: newId() })) })));
    setEat(p.guidance.eat ?? ''); setLimit(p.guidance.limit ?? ''); setNotes(p.guidance.notes ?? '');
  };

  useEffect(() => {
    (async () => {
      try {
        const r = await fetchRoster();
        setRoster(r);
        setRow(r.find((x) => x.athlete_id === id) ?? null);
        const p = await loadNutritionPlan(id);
        if (p) fill(p);
      } catch { /* shown as empty */ }
      setLoaded(true);
    })();
  }, [id]);

  const weight = row?.profile_weight_kg ? Number(row.profile_weight_kg) : null;
  const plan: NutritionPlan = useMemo(() => {
    const p = num(protein), ct = num(carbsT), ft = num(fatT);
    return {
      coach_id: user?.id ?? '', athlete_id: id,
      protein_g: p, carbs_train_g: ct, fat_train_g: ft,
      carbs_rest_g: sameRest ? ct : num(carbsR), fat_rest_g: sameRest ? ft : num(fatR),
      fiber_g: Number.isFinite(num(fiber)) ? num(fiber) : null, water_ml: Number.isFinite(num(water)) ? Math.round(num(water)) : null,
      meals, guidance: { eat: eat.trim() || undefined, limit: limit.trim() || undefined, notes: notes.trim() || undefined },
    };
  }, [protein, carbsT, fatT, sameRest, carbsR, fatR, fiber, water, meals, eat, limit, notes, user, id]);

  const macrosOk = [plan.protein_g, plan.carbs_train_g, plan.fat_train_g, plan.carbs_rest_g, plan.fat_rest_g].every((v) => Number.isFinite(v) && v >= 0);
  const errs = macrosOk ? planErrors(plan) : [];
  const trainT = macrosOk ? dayTargets(plan, true) : null;
  const restT = macrosOk ? dayTargets(plan, false) : null;
  const day = planDayMacros(plan);

  const save = async () => {
    if (!macrosOk || errs.length) return;
    setBusy(true); setMsg(null);
    try { await saveNutritionPlan(plan); setMsg({ ok: true, text: t('mealplan.saved') }); }
    catch { setMsg({ ok: false, text: t('coach.saveError') }); }
    finally { setBusy(false); }
  };

  const updMeal = (mid: string, f: (m: PlanMeal) => PlanMeal) => setMeals((ms) => ms.map((m) => (m.id === mid ? f(m) : m)));
  const updOption = (mid: string, oid: string, f: (o: MealOption) => MealOption) => updMeal(mid, (m) => ({ ...m, options: m.options.map((o) => (o.id === oid ? f(o) : o)) }));

  if (!loaded) return <div className="min-h-screen bg-ink-bg" />;

  return (
    <div className="min-h-screen bg-ink-bg px-5 pb-32 pt-5" dir={dir} data-testid="nutrition-plan-editor">
      <header className="mb-4 flex items-center gap-3">
        <button type="button" onClick={() => navigate(`/coach/athlete/${id}?tab=nutrition`)} aria-label={t('common.back')} className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-ink-elevated text-cloud-dim"><ChevronLeft className="h-5 w-5 rtl:rotate-180" /></button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs text-cloud-dim" dir="auto">{row?.display_name ?? ''}</div>
          <h1 className="truncate text-xl font-bold text-cloud">{t('mealplan.editorTitle')}</h1>
        </div>
        {roster.length > 1 && (
          <button type="button" onClick={() => setCopyOpen(true)} aria-label={t('mealplan.copyFrom')} title={t('mealplan.copyFrom')} className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink-elevated text-cloud-dim"><Copy className="h-4 w-4" /></button>
        )}
      </header>

      {/* Targets */}
      <section className="mb-4 rounded-2xl border border-ink-border bg-ink-surface p-4">
        <h2 className="mb-3 text-sm font-bold text-cloud">{t('mealplan.targets')}</h2>
        <div className="grid grid-cols-3 gap-2">
          <NumField label={t('mealplan.proteinG')} value={protein} set={setProtein} testId="np-protein" />
          <NumField label={t('mealplan.carbsG')} value={carbsT} set={setCarbsT} testId="np-carbs" />
          <NumField label={t('mealplan.fatG')} value={fatT} set={setFatT} testId="np-fat" />
        </div>
        {weight && (
          <p className="mt-2 text-[11px] leading-relaxed text-cloud-muted">{t('mealplan.proteinHint', { kg: weight, low: Math.round(weight * 1.6), high: Math.round(weight * 2.2) })}</p>
        )}
        <button type="button" role="switch" aria-checked={!sameRest} onClick={() => { setSameRest(!sameRest); if (sameRest) { setCarbsR(carbsT); setFatR(fatT); } }}
          className="mt-3 flex w-full items-center justify-between text-start text-xs text-cloud-dim" data-testid="np-rest-toggle">
          <span>{t('mealplan.restDifferent')}</span>
          <span className={cn('flex h-6 w-10 items-center rounded-full p-0.5', !sameRest ? 'bg-lime' : 'bg-ink-elevated')}><span className={cn('h-5 w-5 rounded-full bg-white transition-transform', !sameRest && 'translate-x-4 rtl:-translate-x-4')} /></span>
        </button>
        {!sameRest && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <NumField label={t('mealplan.carbsRestG')} value={carbsR} set={setCarbsR} testId="np-carbs-rest" />
            <NumField label={t('mealplan.fatRestG')} value={fatR} set={setFatR} />
          </div>
        )}
        <div className="mt-2 grid grid-cols-2 gap-2">
          <NumField label={t('mealplan.fiberG')} value={fiber} set={setFiber} />
          <NumField label={t('mealplan.waterMl')} value={water} set={setWater} />
        </div>
        {trainT && restT && (
          <div className="mt-3 grid grid-cols-2 gap-2 text-center" dir="ltr">
            {[[t('mealplan.trainingDay'), trainT.kcal, errs.includes('kcal_train')], [t('mealplan.restDay'), restT.kcal, errs.includes('kcal_rest')]].map(([label, kcal, bad]) => (
              <div key={String(label)} className={cn('rounded-xl py-2', bad ? 'bg-rust/10' : 'bg-ink-elevated')}>
                <div className={cn('text-lg font-bold tabular-nums', bad ? 'text-rust' : 'text-cloud')} data-testid="np-kcal">{kcal} kcal</div>
                <div className="text-[10px] text-cloud-dim">{label}</div>
              </div>
            ))}
          </div>
        )}
        <p className="mt-2 text-[10px] leading-relaxed text-cloud-muted">{t('mealplan.kcalNote', { min: KCAL_MIN, max: KCAL_MAX })}</p>
      </section>

      {/* Meals */}
      <section className="mb-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-bold text-cloud">{t('mealplan.meals')}</h2>
          {trainT && meals.length > 0 && <DayVsTarget day={day} target={trainT} t={t} />}
        </div>
        <div className="space-y-3">
          {meals.map((m) => (
            <MealEditor key={m.id} meal={m} t={t}
              onChange={(f) => updMeal(m.id, f)}
              onRemove={() => setMeals((ms) => ms.filter((x) => x.id !== m.id))}
              onAddFood={(oid) => setPicker({ meal: m.id, option: oid })}
              onItem={(oid, i, amount) => updOption(m.id, oid, (o) => ({ ...o, items: o.items.map((it, j) => (j === i ? { ...it, amount } : it)) }))}
              onRemoveItem={(oid, i) => updOption(m.id, oid, (o) => ({ ...o, items: o.items.filter((_, j) => j !== i) }))} />
          ))}
        </div>
        {meals.length < 8 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {MEAL_PRESETS.map((k) => (
              <button key={k} type="button" onClick={() => setMeals((ms) => [...ms, { id: newId(), name: t(k), time: null, options: [{ id: newId(), label: '', items: [] }] }])}
                className="flex items-center gap-1 rounded-full border border-dashed border-ink-border px-3 py-1.5 text-xs text-lime" data-testid="np-add-meal">
                <Plus className="h-3 w-3" />{t(k)}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Guidance */}
      <section className="mb-4 space-y-2 rounded-2xl border border-ink-border bg-ink-surface p-4">
        <h2 className="text-sm font-bold text-cloud">{t('mealplan.guidance')}</h2>
        <label className="block"><span className="mb-1 block text-[11px] text-lime">{t('mealplan.eat')}</span><textarea value={eat} onChange={(e) => setEat(e.target.value.slice(0, 800))} rows={2} dir="auto" placeholder={t('mealplan.eatPh')} className={field} /></label>
        <label className="block"><span className="mb-1 block text-[11px] text-gold">{t('mealplan.limit')}</span><textarea value={limit} onChange={(e) => setLimit(e.target.value.slice(0, 800))} rows={2} dir="auto" placeholder={t('mealplan.limitPh')} className={field} /></label>
        <label className="block"><span className="mb-1 block text-[11px] text-cloud-dim">{t('mealplan.notes')}</span><textarea value={notes} onChange={(e) => setNotes(e.target.value.slice(0, 1200))} rows={3} dir="auto" className={field} /></label>
        <p className="text-[10px] leading-relaxed text-cloud-muted">{t('mealplan.scopeNote')}</p>
      </section>

      {msg && <p className={cn('mb-2 text-center text-xs', msg.ok ? 'text-lime' : 'text-rust')} data-testid="np-msg">{msg.text}</p>}
      <div className="sticky bottom-3 z-30">
        <button type="button" onClick={save} disabled={busy || !macrosOk || errs.length > 0} data-testid="np-save"
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-lime text-sm font-bold text-ink-bg shadow-lg shadow-black/40 disabled:opacity-40">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}{t('mealplan.save')}
        </button>
      </div>

      {picker && (
        <FoodPicker t={t} onClose={() => setPicker(null)} onPick={(food) => {
          const it: PlanItem = {
            name: food.name, ref: food.ref, amount: food.servingOnly ? 1 : Math.round(food.defaultGrams || 100), servingOnly: !!food.servingOnly,
            servingLabel: food.servingOnly ? food.servings[0]?.label ?? null : null,
            per100: { kcal: food.per100.kcal, protein: food.per100.protein, carbs: food.per100.carbs, fat: food.per100.fat, fiber: food.per100.fiber },
          };
          updOption(picker.meal, picker.option, (o) => ({ ...o, items: [...o.items, it] }));
          setPicker(null);
        }} />
      )}

      <Sheet open={copyOpen} title={t('mealplan.copyFrom')} onClose={() => setCopyOpen(false)}>
        <ul className="space-y-1.5">
          {roster.filter((r) => r.athlete_id !== id).map((r) => (
            <li key={r.athlete_id}>
              <button type="button" onClick={async () => { const p = await loadNutritionPlan(r.athlete_id).catch(() => null); if (p) { fill(p); setMsg({ ok: true, text: t('mealplan.copied') }); } else setMsg({ ok: false, text: t('mealplan.noPlanToCopy') }); setCopyOpen(false); }}
                className="w-full rounded-xl bg-ink-elevated px-3 py-2.5 text-start text-sm text-cloud" dir="auto">{r.display_name ?? '—'}</button>
            </li>
          ))}
        </ul>
      </Sheet>
    </div>
  );
}

function NumField({ label, value, set, testId }: { label: string; value: string; set: (v: string) => void; testId?: string }) {
  return (
    <label className="block text-[10px] text-cloud-dim">{label}
      <input value={value} onChange={(e) => set(e.target.value.replace(/[^0-9.,]/g, '').slice(0, 6))} inputMode="decimal" dir="ltr" data-testid={testId}
        className="mt-1 w-full rounded-lg border border-ink-border bg-ink-bg px-2 py-2 text-center text-sm text-cloud" />
    </label>
  );
}

function DayVsTarget({ day, target, t }: { day: Macros; target: Macros; t: T }) {
  const diff = day.kcal - target.kcal;
  return (
    <span className={cn('text-[11px] tabular-nums', Math.abs(diff) <= target.kcal * 0.05 ? 'text-lime' : 'text-gold')} dir="ltr" data-testid="np-day-total" title={t('mealplan.dayVsTarget')}>
      {day.kcal} / {target.kcal} kcal · P {Math.round(day.protein)}/{target.protein}
    </span>
  );
}

function MealEditor({ meal, t, onChange, onRemove, onAddFood, onItem, onRemoveItem }: {
  meal: PlanMeal; t: T; onChange: (f: (m: PlanMeal) => PlanMeal) => void; onRemove: () => void;
  onAddFood: (optionId: string) => void; onItem: (optionId: string, i: number, amount: number) => void; onRemoveItem: (optionId: string, i: number) => void;
}) {
  const [active, setActive] = useState(meal.options[0]?.id ?? '');
  const opt = meal.options.find((o) => o.id === active) ?? meal.options[0];
  const m = opt ? optionMacros(opt) : null;
  return (
    <div className="rounded-2xl border border-ink-border bg-ink-surface p-4" data-testid="np-meal">
      <div className="mb-2 flex items-center gap-2">
        <Utensils className="h-4 w-4 flex-shrink-0 text-lime" />
        <input value={meal.name} onChange={(e) => onChange((x) => ({ ...x, name: e.target.value.slice(0, 40) }))} dir="auto" className="min-w-0 flex-1 bg-transparent text-sm font-bold text-cloud focus:outline-none" />
        <input type="time" value={meal.time ?? ''} onChange={(e) => onChange((x) => ({ ...x, time: e.target.value || null }))} className="rounded-lg bg-ink-bg px-2 py-1 text-xs text-cloud-dim" dir="ltr" />
        <button type="button" onClick={onRemove} aria-label={t('setup.remove')} className="text-cloud-muted hover:text-rust"><Trash2 className="h-4 w-4" /></button>
      </div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {meal.options.map((o, i) => (
          <button key={o.id} type="button" onClick={() => setActive(o.id)} className={cn('rounded-full border px-3 py-1 text-xs', o.id === opt?.id ? 'border-lime bg-lime/10 text-cloud' : 'border-ink-border text-cloud-dim')}>
            {t('mealplan.optionN', { n: i + 1 })}
          </button>
        ))}
        {meal.options.length < 4 && (
          <button type="button" onClick={() => { const nid = newId(); onChange((x) => ({ ...x, options: [...x.options, { id: nid, label: '', items: [] }] })); setActive(nid); }}
            className="rounded-full border border-dashed border-ink-border px-3 py-1 text-xs text-lime" data-testid="np-add-option">+ {t('mealplan.alternativeMeal')}</button>
        )}
        {meal.options.length > 1 && opt && (
          <button type="button" onClick={() => { onChange((x) => ({ ...x, options: x.options.filter((o) => o.id !== opt.id) })); setActive(meal.options[0].id); }} className="text-xs text-cloud-muted hover:text-rust">{t('mealplan.removeOption')}</button>
        )}
      </div>
      {opt && (
        <>
          <ul className="space-y-1.5">
            {opt.items.map((it, i) => {
              const mm = itemMacros(it);
              return (
                <li key={i} className="flex items-center gap-2 rounded-xl bg-ink-bg px-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-cloud" dir="auto">{it.name}</span>
                    <span className="block text-[10px] text-cloud-dim" dir="ltr">{mm.kcal} kcal · P {mm.protein} · C {mm.carbs} · F {mm.fat}</span>
                  </span>
                  <input value={String(it.amount)} onChange={(e) => { const v = Number(e.target.value.replace(/[^0-9.]/g, '')); if (Number.isFinite(v)) onItem(opt.id, i, Math.min(it.servingOnly ? 20 : 2000, v)); }}
                    inputMode="decimal" dir="ltr" className="w-16 rounded-lg border border-ink-border bg-ink-surface px-2 py-1 text-center text-sm text-cloud" data-testid="np-item-amount" />
                  <span className="w-10 text-[10px] text-cloud-dim">{it.servingOnly ? (it.servingLabel ?? t('mealplan.serving')) : 'g'}</span>
                  <button type="button" onClick={() => onRemoveItem(opt.id, i)} aria-label={t('setup.remove')} className="text-cloud-muted hover:text-rust"><X className="h-4 w-4" /></button>
                </li>
              );
            })}
          </ul>
          <button type="button" onClick={() => onAddFood(opt.id)} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-ink-border py-2 text-xs font-semibold text-lime" data-testid="np-add-food">
            <Plus className="h-3.5 w-3.5" />{t('mealplan.addFood')}
          </button>
          {m && opt.items.length > 0 && <div className="mt-2 text-end text-[11px] text-cloud-dim" dir="ltr">{m.kcal} kcal · P {m.protein} · C {m.carbs} · F {m.fat}</div>}
        </>
      )}
    </div>
  );
}

function FoodPicker({ t, onClose, onPick }: { t: T; onClose: () => void; onPick: (f: FoodItem) => void }) {
  const [q, setQ] = useState('');
  const [remote, setRemote] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(false);
  const local = useMemo(() => (q.trim().length >= 2 ? searchLocalFoods(q.trim(), 10) : []), [q]);
  useEffect(() => {
    if (q.trim().length < 3) { setRemote([]); return; }
    setLoading(true);
    const h = window.setTimeout(() => {
      searchFoodDatabase(q.trim()).then((r) => setRemote(r.foods.slice(0, 15))).catch(() => setRemote([])).finally(() => setLoading(false));
    }, 400);
    return () => window.clearTimeout(h);
  }, [q]);
  const seen = new Set<string>();
  const all = [...local, ...remote].filter((f) => (seen.has(f.ref) ? false : (seen.add(f.ref), true)));
  return (
    <Sheet open title={t('mealplan.addFood')} onClose={onClose}>
      <label className="mb-3 flex items-center gap-2 rounded-xl border border-ink-border bg-ink-bg px-3">
        <Search className="h-4 w-4 text-cloud-muted" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('mealplan.searchFood')} className="h-11 w-full bg-transparent text-sm text-cloud placeholder:text-cloud-muted focus:outline-none" data-testid="np-food-search" />
        {loading && <Loader2 className="h-4 w-4 animate-spin text-cloud-dim" />}
      </label>
      <ul className="max-h-[50vh] space-y-1 overflow-y-auto">
        {all.map((f) => (
          <li key={f.ref}>
            <button type="button" onClick={() => onPick(f)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start hover:bg-ink-elevated" data-testid="np-food-hit">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-cloud">{f.name}{f.brand ? ` · ${f.brand}` : ''}</span>
                <span className="block text-[11px] text-cloud-dim" dir="ltr">{f.servingOnly ? `${f.servings[0]?.label ?? '1 serving'}: ` : '100 g: '}{Math.round(f.per100.kcal)} kcal · P {Math.round(f.per100.protein)} · C {Math.round(f.per100.carbs)} · F {Math.round(f.per100.fat)} · {f.sourceLabel}</span>
              </span>
              <Plus className="h-4 w-4 text-lime" />
            </button>
          </li>
        ))}
        {q.trim().length >= 3 && !loading && all.length === 0 && <li className="py-6 text-center text-xs text-cloud-dim">{t('coach.noMatch')}</li>}
      </ul>
    </Sheet>
  );
}

