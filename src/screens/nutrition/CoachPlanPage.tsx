import { useMemo, useState } from 'react';
import { Check, ChevronLeft, ClipboardList, ShoppingCart, Utensils } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import type { MealSlot, NewEntry } from '@/lib/nutrition/api';
import { emptyProfile } from '@/lib/nutrition/nutrients';
import { dayTargets, itemMacros, optionMacros, shoppingList, type PlanMeal } from '@/lib/coach/nutrition-plan';
import { useNutrition } from './NutritionContext';
import { useNutritionNav } from './nav';

/** Slot for a meal from its name or time (breakfast before 11, lunch before 16, dinner before 21, else snack). */
export function slotFor(meal: Pick<PlanMeal, 'name' | 'time'>): MealSlot {
  const n = meal.name.toLowerCase();
  if (/breakfast|فطور|desayuno|petit|frühstück|café da manhã|kahvaltı|colazione/.test(n)) return 'breakfast';
  if (/pre/.test(n)) return 'pre_workout';
  if (/post/.test(n)) return 'post_workout';
  if (/lunch|غداء|almuerzo|déjeuner|mittag|almoço|öğle|pranzo/.test(n)) return 'lunch';
  if (/dinner|عشاء|cena|dîner|abend|jantar|akşam/.test(n)) return 'dinner';
  const h = meal.time ? Number(meal.time.slice(0, 2)) : NaN;
  if (Number.isFinite(h)) return h < 11 ? 'breakfast' : h < 16 ? 'lunch' : h < 21 ? 'dinner' : 'snack';
  return 'snack';
}

/** /nutrition/coach-plan — the athlete's meal plan from their coach. */
export function CoachPlanPage() {
  const n = useNutrition();
  const { t, dir } = useI18n();
  const { go } = useNutritionNav();
  const plan = n.coachPlan;
  const [choice, setChoice] = useState<Record<string, number>>({});
  const [logged, setLogged] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [showList, setShowList] = useState(false);
  const training = n.isTrainingDay(n.today);
  const list = useMemo(() => (plan ? shoppingList(plan) : []), [plan]);

  if (!plan) {
    return (
      <div className="min-h-screen bg-ink-bg px-5 pt-5" dir={dir}>
        <button type="button" onClick={() => go('hub')} aria-label={t('common.back')} className="mb-6 flex h-10 w-10 items-center justify-center rounded-xl bg-ink-elevated text-cloud-dim"><ChevronLeft className="h-5 w-5 rtl:rotate-180" /></button>
        <p className="text-sm text-cloud-dim">{t('mealplan.none')}</p>
      </div>
    );
  }

  const target = n.targetsFor(n.today);
  const planned = dayTargets(plan, training);

  const log = async (meal: PlanMeal) => {
    const opt = meal.options[choice[meal.id] ?? 0];
    if (!opt) return;
    setBusy(meal.id);
    try {
      const entries: NewEntry[] = opt.items.map((it) => {
        const m = itemMacros(it);
        return {
          date: n.today,
          slot: slotFor(meal),
          name: it.name,
          amounts: { ...emptyProfile(), kcal: m.kcal, protein: m.protein, carbs: m.carbs, fat: m.fat, fiber: it.per100.fiber == null ? null : m.fiber },
          grams: it.servingOnly ? null : it.amount,
          servings: it.servingOnly ? it.amount : null,
          servingLabel: it.servingOnly ? it.servingLabel ?? null : null,
          foodRef: it.ref,
          source: null,
        };
      });
      await n.addEntries(entries);
      setLogged((s) => ({ ...s, [meal.id]: true }));
    } catch {
      /* the diary shows its own error */
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen bg-ink-bg px-5 pb-28 pt-5" dir={dir} data-testid="coach-meal-plan">
      <header className="mb-4 flex items-center gap-3">
        <button type="button" onClick={() => go('hub')} aria-label={t('common.back')} className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink-elevated text-cloud-dim"><ChevronLeft className="h-5 w-5 rtl:rotate-180" /></button>
        <h1 className="text-[22px] font-bold text-cloud">{t('mealplan.title')}</h1>
      </header>

      {!n.noNumbers && (
        <section className="mb-4 rounded-2xl border border-ink-border bg-ink-surface p-4">
          <div className="mb-2 flex items-center justify-between text-xs text-cloud-dim">
            <span>{training ? t('mealplan.trainingDay') : t('mealplan.restDay')}</span>
            {target.kcal !== planned.kcal && <span className="text-gold">{t('mealplan.adjusted')}</span>}
          </div>
          <div className="grid grid-cols-4 gap-2 text-center" dir="ltr">
            {([['kcal', target.kcal, ''], ['P', target.protein, 'g'], ['C', target.carbs, 'g'], ['F', target.fat, 'g']] as const).map(([k, v, u]) => (
              <div key={k} className="rounded-xl bg-ink-elevated py-2">
                <div className="text-lg font-bold tabular-nums text-cloud">{v}{u}</div>
                <div className="text-[10px] text-cloud-dim">{k === 'kcal' ? 'kcal' : k === 'P' ? t('mealplan.protein') : k === 'C' ? t('mealplan.carbs') : t('mealplan.fat')}</div>
              </div>
            ))}
          </div>
          {(plan.fiber_g || plan.water_ml) && (
            <div className="mt-2 flex justify-center gap-4 text-[11px] text-cloud-dim" dir="ltr">
              {plan.fiber_g ? <span>{t('mealplan.fiber')} {plan.fiber_g} g</span> : null}
              {plan.water_ml ? <span>{t('mealplan.water')} {(plan.water_ml / 1000).toFixed(1)} L</span> : null}
            </div>
          )}
        </section>
      )}

      <div className="space-y-3">
        {plan.meals.map((meal) => {
          const idx = Math.min(choice[meal.id] ?? 0, Math.max(0, meal.options.length - 1));
          const opt = meal.options[idx];
          const m = opt ? optionMacros(opt) : null;
          return (
            <section key={meal.id} className="rounded-2xl border border-ink-border bg-ink-surface p-4" data-testid="plan-meal">
              <div className="mb-2 flex items-center gap-2">
                <Utensils className="h-4 w-4 text-lime" />
                <span className="flex-1 text-sm font-bold text-cloud" dir="auto">{meal.name}</span>
                {meal.time && <span className="text-xs text-cloud-dim" dir="ltr">{meal.time}</span>}
              </div>
              {meal.options.length > 1 && (
                <div className="mb-2 flex gap-1.5">
                  {meal.options.map((o, i) => (
                    <button key={o.id} type="button" onClick={() => setChoice((c) => ({ ...c, [meal.id]: i }))}
                      className={cn('rounded-full border px-3 py-1 text-xs', i === idx ? 'border-lime bg-lime/10 text-cloud' : 'border-ink-border text-cloud-dim')} dir="auto">{o.label || t('mealplan.optionN', { n: i + 1 })}</button>
                  ))}
                </div>
              )}
              {opt && (
                <ul className="space-y-1 text-sm text-cloud">
                  {opt.items.map((it, i) => (
                    <li key={i} className="flex justify-between gap-3">
                      <span className="min-w-0 truncate" dir="auto">{it.name}</span>
                      <span className="flex-shrink-0 text-cloud-dim" dir="ltr">{it.servingOnly ? `${it.amount} × ${it.servingLabel ?? t('mealplan.serving')}` : `${it.amount} g`}</span>
                    </li>
                  ))}
                </ul>
              )}
              {m && !n.noNumbers && <div className="mt-2 text-[11px] text-cloud-dim" dir="ltr">{m.kcal} kcal · P {m.protein} · C {m.carbs} · F {m.fat}</div>}
              <button type="button" onClick={() => log(meal)} disabled={!opt || busy === meal.id || logged[meal.id]} data-testid="log-plan-meal"
                className={cn('mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold', logged[meal.id] ? 'bg-lime/10 text-lime' : 'bg-lime text-ink-bg disabled:opacity-50')}>
                {logged[meal.id] ? <><Check className="h-4 w-4" />{t('mealplan.logged')}</> : t('mealplan.logMeal')}
              </button>
            </section>
          );
        })}
      </div>

      {(plan.guidance.eat || plan.guidance.limit || plan.guidance.notes) && (
        <section className="mt-4 rounded-2xl border border-ink-border bg-ink-surface p-4 text-sm" data-testid="plan-guidance">
          <div className="mb-2 flex items-center gap-2 font-semibold text-cloud"><ClipboardList className="h-4 w-4 text-lime" />{t('mealplan.guidance')}</div>
          {plan.guidance.eat && <p className="mb-2"><span className="font-semibold text-lime">{t('mealplan.eat')}: </span><span className="whitespace-pre-line text-cloud" dir="auto">{plan.guidance.eat}</span></p>}
          {plan.guidance.limit && <p className="mb-2"><span className="font-semibold text-gold">{t('mealplan.limit')}: </span><span className="whitespace-pre-line text-cloud" dir="auto">{plan.guidance.limit}</span></p>}
          {plan.guidance.notes && <p className="whitespace-pre-line text-cloud-dim" dir="auto">{plan.guidance.notes}</p>}
        </section>
      )}

      {list.length > 0 && (
        <section className="mt-4 rounded-2xl border border-ink-border bg-ink-surface p-4">
          <button type="button" onClick={() => setShowList((v) => !v)} className="flex w-full items-center gap-2 text-start text-sm font-semibold text-cloud" data-testid="shopping-toggle">
            <ShoppingCart className="h-4 w-4 text-lime" /><span className="flex-1">{t('mealplan.shopping')}</span><span className="text-xs text-cloud-dim">{list.length}</span>
          </button>
          {showList && (
            <>
              <p className="mb-2 mt-1 text-[11px] text-cloud-muted">{t('mealplan.shoppingHelp')}</p>
              <ul className="divide-y divide-ink-border/60 text-sm" data-testid="shopping-list">
                {list.map((x) => (
                  <li key={x.name + x.unit} className="flex justify-between gap-3 py-1.5">
                    <span className="min-w-0 truncate text-cloud" dir="auto">{x.name}</span>
                    <span className="flex-shrink-0 text-cloud-dim" dir="ltr">{x.unit === 'g' ? (x.amount >= 1000 ? `${(x.amount / 1000).toFixed(1)} kg` : `${x.amount} g`) : `${x.amount} ×`}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}
    </div>
  );
}

/** Hub card: shown when the athlete's coach made a meal plan. */
export function CoachPlanCard({ onOpen }: { onOpen: () => void }) {
  const n = useNutrition();
  const { t, dir } = useI18n();
  if (!n.coachPlan) return null;
  return (
    <button type="button" onClick={onOpen} dir={dir} data-testid="coach-plan-card"
      className="flex w-full items-center gap-3 rounded-2xl border border-lime/30 bg-lime/[0.06] px-4 py-3.5 text-start">
      <Utensils className="h-5 w-5 flex-shrink-0 text-lime" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-cloud">{t('mealplan.title')}</span>
        <span className="block text-xs text-cloud-dim">{t('mealplan.cardBody', { n: n.coachPlan.meals.length })}</span>
      </span>
    </button>
  );
}
