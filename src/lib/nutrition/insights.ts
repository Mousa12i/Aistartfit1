import type { FoodEntry, MealSlot, WaterEntry } from './api';
import { entryProfile } from './api';
import { addDays } from './dates';
import type { Targets } from './engine';
import { sumProfiles, type NutrientProfile, type NutrientKey } from './nutrients';

export interface DaySummary {
  date: string;
  total: NutrientProfile;
  coverage: Partial<Record<NutrientKey, number>>;
  entryCount: number;
  slotProtein: Partial<Record<MealSlot, number>>;
  slotKcal: Partial<Record<MealSlot, number>>;
  waterMl: number;
}

export function summarizeDay(date: string, entries: FoodEntry[], water: WaterEntry[]): DaySummary {
  const dayEntries = entries.filter((e) => e.logged_date === date);
  const { total, coverage } = sumProfiles(dayEntries.map(entryProfile));
  const slotProtein: Partial<Record<MealSlot, number>> = {};
  const slotKcal: Partial<Record<MealSlot, number>> = {};
  for (const e of dayEntries) {
    const slot = e.meal_slot ?? 'snack';
    slotProtein[slot] = (slotProtein[slot] ?? 0) + e.protein;
    slotKcal[slot] = (slotKcal[slot] ?? 0) + e.kcal;
  }
  return {
    date,
    total,
    coverage,
    entryCount: dayEntries.length,
    slotProtein,
    slotKcal,
    waterMl: water.filter((w) => w.logged_date === date).reduce((sum, w) => sum + w.ml, 0),
  };
}

/** Number of meals (slots) that reached the per-meal protein threshold. */
export function proteinMealsHit(day: DaySummary, threshold: number): number {
  return Object.values(day.slotProtein).filter((p) => (p ?? 0) >= threshold).length;
}

export function loggingStreak(daysWithEntries: Set<string>, today: string): number {
  let streak = 0;
  let cursor = daysWithEntries.has(today) ? today : addDays(today, -1);
  while (daysWithEntries.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export interface Insight {
  id: string;
  tone: 'good' | 'tip' | 'warn';
  title: string;
  body: string;
  article?: string;
}

export interface InsightInput {
  today: DaySummary;
  /** Previous days (not including today), newest first or any order. */
  recent: DaySummary[];
  targets: Targets;
  noNumbers: boolean;
  trainingDay: boolean;
  hour: number;
  streak: number;
}

export function buildInsights(input: InsightInput): Insight[] {
  const { today, recent, targets, noNumbers, trainingDay, hour, streak } = input;
  const out: Insight[] = [];
  const logged = recent.filter((d) => d.entryCount >= 2);

  // Very low intake on several days (possible under-fuelling).
  const veryLow = logged.filter((d) => d.total.kcal > 0 && d.total.kcal < targets.bmr);
  if (logged.length >= 3 && veryLow.length >= 3) {
    out.push({
      id: 'low-intake',
      tone: 'warn',
      title: noNumbers ? 'Some days look light on food' : 'Several very low-intake days',
      body: noNumbers
        ? 'Regular, filling meals support training, recovery and mood. If eating feels hard right now, the support page can help.'
        : `On ${veryLow.length} of the last ${logged.length} logged days you ate less than your resting energy needs. If that is accurate, it can affect energy, hormones and performance.`,
      article: 'reds',
    });
  }

  // Protein spread through the day.
  const threshold = Math.max(15, targets.proteinPerMeal.low);
  const hits = proteinMealsHit(today, threshold);
  const expected = hour >= 20 ? 3 : hour >= 15 ? 2 : hour >= 11 ? 1 : 0;
  if (today.entryCount > 0 && hits < expected) {
    out.push({
      id: 'protein-spread',
      tone: 'tip',
      title: 'Add protein to your next meal',
      body: noNumbers
        ? 'Spreading protein across your meals helps muscles recover. Eggs, yogurt, chicken, fish, beans or tofu all count.'
        : `Aim for about ${targets.proteinPerMeal.low}–${targets.proteinPerMeal.high} g of protein per meal. ${hits} meal${hits === 1 ? '' : 's'} so far reached ${threshold} g.`,
      article: 'protein',
    });
  } else if (!noNumbers && targets.protein > 0 && today.total.protein >= targets.protein * 0.9) {
    out.push({ id: 'protein-done', tone: 'good', title: 'Protein target reached', body: `${Math.round(today.total.protein)} g of ${targets.protein} g today. Nice work.`, article: 'protein' });
  }

  // Fibre consistently low (only on days where fibre data covers most of the food).
  const fibreDays = logged.filter((d) => (d.coverage.fiber ?? 0) >= 0.6);
  const lowFibre = fibreDays.filter((d) => (d.total.fiber ?? 0) < targets.fiber * 0.5);
  if (fibreDays.length >= 3 && lowFibre.length >= 3) {
    out.push({
      id: 'fibre-low',
      tone: 'tip',
      title: 'Fibre has been low',
      body: noNumbers
        ? 'Beans, lentils, oats, fruit and vegetables add fibre, which helps digestion and fullness.'
        : `Fibre was under half of your ${targets.fiber} g target on ${lowFibre.length} recent days. Beans, lentils, oats, fruit and vegetables help.`,
      article: 'fibre-sugar-salt',
    });
  }

  // Sodium repeatedly high.
  const sodiumDays = logged.filter((d) => (d.coverage.sodiumMg ?? 0) >= 0.6);
  const highSodium = sodiumDays.filter((d) => (d.total.sodiumMg ?? 0) > targets.sodiumMax);
  if (!noNumbers && sodiumDays.length >= 3 && highSodium.length >= 3) {
    out.push({
      id: 'sodium-high',
      tone: 'tip',
      title: 'Salt has been high',
      body: `Sodium was above ${targets.sodiumMax.toLocaleString('en-GB')} mg on ${highSodium.length} recent days. Processed and restaurant foods are the usual sources.`,
      article: 'fibre-sugar-salt',
    });
  }

  if (trainingDay) {
    out.push({
      id: 'training-fuel',
      tone: 'tip',
      title: 'Training day',
      body: 'Have a meal with carbohydrate and protein within 2–3 hours before and after your session.',
      article: 'timing',
    });
  }

  if (hour >= 15 && targets.waterMl > 0 && today.waterMl < targets.waterMl * 0.4) {
    out.push({
      id: 'water',
      tone: 'tip',
      title: 'Time for some water',
      body: noNumbers ? 'You have not logged much to drink today.' : `${(today.waterMl / 1000).toFixed(1)} L of ${(targets.waterMl / 1000).toFixed(1)} L so far.`,
      article: 'hydration',
    });
  }

  if (streak >= 3) {
    out.push({ id: 'streak', tone: 'good', title: `${streak}-day logging streak`, body: 'Consistent logging is what makes the adaptive targets accurate.' });
  }

  const order = { warn: 0, tip: 1, good: 2 } as const;
  return out.sort((a, b) => order[a.tone] - order[b.tone]).slice(0, 4);
}
