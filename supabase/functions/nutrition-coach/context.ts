// Pure helpers for the nutrition coach: safety flags, the system prompt and a
// compact text summary of the user's data. No Deno APIs, so it can be tested in Node.

export interface ProfileRow {
  display_name?: string | null;
  age?: number | null;
  height_cm?: number | null;
  weight_kg?: number | null;
  fitness_goal?: string | null;
  experience_level?: string | null;
  activity_level?: string | null;
  preferred_days?: string[] | null;
  limitations?: string | null;
  body_fat_pct?: number | null;
  unit_system?: string | null;
}

export interface SettingsRow {
  goal_mode?: string | null;
  rate_pct?: number | null;
  meals_per_day?: number | null;
  no_numbers?: boolean | null;
  diet_prefs?: string[] | null;
  allergies?: string[] | null;
  screening?: { positive?: boolean; under18?: boolean; pregnant?: boolean; conditions?: string[] } | null;
}

export interface MealRow {
  logged_date: string;
  meal_slot: string | null;
  name: string;
  kcal: number | string;
  protein: number | string;
  carbs_g: number | string;
  fat_g: number | string;
  fiber_g?: number | string | null;
  sugar_g?: number | string | null;
  sodium_mg?: number | string | null;
  grams?: number | string | null;
  servings?: number | string | null;
  serving_label?: string | null;
}

export interface TargetsSnapshot {
  date?: string;
  mode?: string;
  ratePct?: number;
  kcal?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
  waterMl?: number;
  proteinPerMeal?: number;
  maintenance?: number;
  trainingDay?: boolean;
}

export interface Flags {
  noNumbers: boolean;
  screenPositive: boolean;
  under18: boolean;
  pregnant: boolean;
  conditions: string[];
}

export function deriveFlags(profile: ProfileRow | null, settings: SettingsRow | null): Flags {
  const s = settings?.screening ?? null;
  const conditions: unknown[] = s && Array.isArray(s.conditions) ? s.conditions : [];
  return {
    noNumbers: settings?.no_numbers === true,
    screenPositive: s?.positive === true,
    under18: (profile?.age != null && profile.age > 0 && profile.age < 18) || s?.under18 === true,
    pregnant: s?.pregnant === true,
    conditions: conditions.filter((c): c is string => typeof c === 'string'),
  };
}

export const EVIDENCE_BRIEF = `[mifflin1990] Mifflin–St Jeor equation estimates resting energy expenditure.
[morton2018] Resistance training + protein: extra protein stops adding muscle at ~1.6 g/kg/day (upper 95% CI ~2.2 g/kg/day).
[jager2017] ISSN: 1.4–2.0 g/kg/day for most exercisers; doses of ~20–40 g every 3–4 h; 2.3–3.1 g/kg of fat-free mass when dieting while lean.
[schoenfeld2018] About 0.4 g/kg per meal over at least 4 meals (up to 0.55 g/kg per meal).
[helms2014] Lean resistance-trained athletes in a deficit: 2.3–3.1 g/kg of fat-free mass.
[ruiz2021] Fat-loss phase in trained people: lose 0.5–1% of body weight per week; protein 2.2–3.0 g/kg/day over 3–6 meals (0.40–0.55 g/kg per meal); a meal 2–3 h before and after training; caffeine 3–6 mg/kg and creatine 3–5 g/day as options.
[iraki2019] Off-season gain: 0.25–0.5% body weight per week for novice/intermediate, slower for advanced; protein 1.6–2.2 g/kg/day; 0.40–0.55 g/kg per meal over 3–6 meals.
[helms2023] Trained lifters with 5% vs 15% surplus for 8 weeks: faster weight gain mainly increased skinfolds (fat), not muscle thickness or strength.
[aragon2017] ISSN diets and body composition: energy balance drives weight change; higher protein helps retain or gain lean mass.
[kerksick2017] ISSN nutrient timing: daily totals matter most; protein every 3–4 h; 30–40 g casein before sleep can raise overnight muscle protein synthesis.
[thomas2016] ACSM/AND/DC: carbohydrate ~3–5 g/kg/day for light training, ~5–7 g/kg/day for ~1 h/day moderate training, more for heavy endurance.
[byrne2018] MATADOR (men with obesity): alternating 2-week diet and maintenance blocks gave more weight and fat loss than continuous dieting.
[peos2021] ICECAP secondary analysis (athletes): a 1-week diet break reduced hunger and improved leg endurance; fat mass did not change significantly.
[kreider2017] Creatine monohydrate 3–5 g/day (optional loading ~0.3 g/kg/day for 5–7 days); well studied and safe in healthy people.
[guest2021] Caffeine 3–6 mg/kg about 60 min before exercise; high doses (~9 mg/kg) increase side effects.
[trexler2015] Beta-alanine 4–6 g/day in divided doses for at least 2–4 weeks; helps efforts of ~1–4 min; tingling is common.
[maughan2018] IOC: good evidence for caffeine, creatine, nitrate, beta-alanine and sodium bicarbonate in specific situations; contamination risk — choose third-party tested products; vitamin D or iron only when a deficiency is confirmed.
[mountjoy2023] IOC REDs: problematic low energy availability impairs health and performance in all genders.
[sawka2007] ACSM fluids: avoid losing more than 2% of body mass through sweat; individualise drinking.
[efsa2010] Adequate total water intake ~2.0 L/day for women and ~2.5 L/day for men (drinks plus food).
[who2015] WHO: free sugars below 10% of energy, ideally below 5%.
[iom2005] Fibre ~14 g per 1,000 kcal; fat 20–35% of energy for adults.
[fdaDV] FDA Daily Values: sodium 2,300 mg; fibre 28 g; saturated fat 20 g (2,000 kcal diet).
[shephard2012] Ramadan: small effects for most people; athletes may see lower anaerobic, endurance and strength performance; protect sleep, carbohydrate-rich evening meals, spread fluids from iftar to bedtime.`;

export function buildSystemPrompt(flags: Flags, mode: 'chat' | 'plan'): string {
  const parts: string[] = [];
  parts.push(`You are the StartFit Nutrition Coach, a sports nutrition specialist inside the StartFit training app. You help people who train eat well for performance, body composition and health.

HOW YOU WORK
- Use the user's real data in USER CONTEXT: targets calculated by the app, food diary, water, weight trend, training and recovery. Refer to it specifically.
- Do not invent different targets. If asked how targets were set, explain the app's method (Mifflin–St Jeor × activity, adjusted for the goal, corrected with the user's own intake and weight trend over time).
- Evidence: base advice on the EVIDENCE list below. When you rely on one of them, cite its id in square brackets, e.g. [morton2018]. Never invent studies, authors, numbers or links. If something is not covered by the list or the evidence is uncertain, say so and give general, widely accepted guidance without a citation.
- Be practical: concrete foods, portions and timing. Prefer whole foods. Respect diet preferences (e.g. halal, vegetarian) and never include listed allergens.
- Food values you quote are estimates unless they come from the user's diary — say "about".
- Reply in the same language the user writes in (Arabic or English). Be concise: under 250 words for normal questions unless the user asks for more detail.
- Format: short paragraphs, bullet lists, **bold** for key numbers. Tables are fine for meal plans.

SAFETY (always)
- You are not a doctor. For medical conditions, medicines, pregnancy, injuries or symptoms, advise talking to a doctor or registered dietitian.
- Never recommend eating below the app's safety floor, rapid-weight-loss fasting, purging, laxatives, diuretics or "detox" products, and never suggest supplement doses above those in the evidence list.
- If the user describes binge eating, purging, extreme restriction, fear of food, or distress about eating or their body: respond with warmth, give no calorie or weight-loss advice, and encourage support (UK: Beat 0808 801 0677; US: National Alliance for Eating Disorders 866-662-1235; elsewhere: findahelpline.com). If they may be in danger, urge them to contact local emergency services now.
- When discussing performance supplements, mention choosing third-party tested products.`);

  if (flags.noNumbers) {
    parts.push('BALANCED MODE IS ON: do not mention calories, grams of macronutrients, body weight or numeric weight-change targets. Talk about food groups, regular meals, a protein source at each meal, fruit and vegetables, hunger and fullness, energy and hydration.');
  }
  if (flags.screenPositive) {
    parts.push("The user's wellbeing check-in suggested eating may be difficult for them. Do not set or support any weight-loss or weight-gain goal. Focus on regular, adequate eating and gently mention professional support when relevant.");
  }
  if (flags.under18) {
    parts.push('The user is under 18: never suggest a calorie deficit or a weight-loss plan. Emphasise enough energy for growth and training, and suggest involving a parent, guardian or doctor in any diet change.');
  }
  if (flags.pregnant) {
    parts.push('The user is pregnant or breastfeeding: no calorie deficit; defer to their midwife or doctor for specific advice.');
  }
  if (flags.conditions.includes('kidney')) {
    parts.push('The user has kidney disease: do not give protein targets; refer protein questions to their doctor or renal dietitian.');
  }
  if (flags.conditions.includes('diabetes_meds')) {
    parts.push('The user takes diabetes medication: changes to carbohydrate or calories can cause low blood sugar — advise checking changes with their diabetes care team.');
  }
  if (flags.conditions.includes('other')) {
    parts.push('A clinician manages part of the user’s diet: suggest checking any change with them.');
  }

  if (mode === 'plan') {
    parts.push(`TASK: BUILD A MEAL PLAN
- ${flags.noNumbers ? 'Do not show numbers.' : 'Match the targets in USER CONTEXT: total calories within about ±5% and protein at or above target. Show approximate kcal and protein per meal and a daily total.'}
- Use the number of meals per day in USER CONTEXT; if today is a training day, place a carbohydrate + protein meal 2–3 hours before and after training.
- Respect diet preferences and allergies strictly. Use familiar, affordable foods; include Middle Eastern options when the user writes in Arabic.
- For each meal list the foods with grams or household measures.
- For multi-day plans, finish with a grouped shopping list.
- End with: "Values are estimates — log what you actually eat for accurate totals."`);
  }

  parts.push(`EVIDENCE (cite by id)\n${EVIDENCE_BRIEF}`);
  return parts.join('\n\n');
}

const n = (v: unknown): number => {
  const x = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
};
const nn = (v: unknown): number | null => {
  if (v == null || v === '') return null;
  const x = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(x) ? x : null;
};
const fmt = (v: number) => Math.round(v).toLocaleString('en-GB');

const SLOT_LABEL: Record<string, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snacks',
  pre_workout: 'Pre-workout',
  post_workout: 'Post-workout',
};

export function summarizeMeals(rows: MealRow[], today: string, noNumbers: boolean): { days: string[]; today: string[] } {
  const byDate = new Map<string, MealRow[]>();
  for (const row of rows) {
    const list = byDate.get(row.logged_date) ?? [];
    list.push(row);
    byDate.set(row.logged_date, list);
  }
  const dates = [...byDate.keys()].sort().reverse();
  const days = dates.map((date) => {
    const list = byDate.get(date) ?? [];
    const slots = new Set(list.map((r) => r.meal_slot ?? 'other'));
    if (noNumbers) return `${date}: ${list.length} items across ${slots.size} meals`;
    const sum = (k: keyof MealRow) => list.reduce((s, r) => s + n(r[k]), 0);
    const known = (k: keyof MealRow) => list.filter((r) => nn(r[k]) != null);
    const fibre = known('fiber_g').length ? `, fibre ${fmt(sum('fiber_g'))} g` : '';
    const sugar = known('sugar_g').length ? `, sugars ${fmt(sum('sugar_g'))} g` : '';
    const sodium = known('sodium_mg').length ? `, sodium ${fmt(sum('sodium_mg'))} mg` : '';
    return `${date}: ${fmt(sum('kcal'))} kcal, protein ${fmt(sum('protein'))} g, carbs ${fmt(sum('carbs_g'))} g, fat ${fmt(sum('fat_g'))} g${fibre}${sugar}${sodium}; ${list.length} items in ${slots.size} meals`;
  });

  const todayRows = byDate.get(today) ?? [];
  const bySlot = new Map<string, MealRow[]>();
  for (const r of todayRows) {
    const key = r.meal_slot ?? 'other';
    bySlot.set(key, [...(bySlot.get(key) ?? []), r]);
  }
  const todayLines: string[] = [];
  for (const [slot, list] of bySlot) {
    const items = list.slice(0, 12).map((r) => {
      const amount = nn(r.grams) ? `${fmt(n(r.grams))} g` : r.serving_label ? `${nn(r.servings) ?? 1} × ${r.serving_label}` : '';
      const values = noNumbers ? '' : ` (${fmt(n(r.kcal))} kcal, ${fmt(n(r.protein))} g protein)`;
      return `${r.name}${amount ? ` ${amount}` : ''}${values}`;
    });
    todayLines.push(`${SLOT_LABEL[slot] ?? 'Other'}: ${items.join('; ')}`);
  }
  return { days, today: todayLines };
}

export interface ContextInput {
  today: string;
  profile: ProfileRow | null;
  settings: SettingsRow | null;
  targets: TargetsSnapshot | null;
  meals: MealRow[];
  waterByDate: Record<string, number>;
  weights: { date: string; kg: number }[];
  workouts: { date: string; name: string | null; minutes: number }[];
  checkins: { date: string; sleep_hours: number | null; stress: number | null; soreness_count: number }[];
  flags: Flags;
}

export function buildContext(input: ContextInput): string {
  const { profile, settings, targets, flags } = input;
  const lines: string[] = [];
  lines.push(`Today (user's local date): ${input.today}`);

  lines.push('\n=== PROFILE ===');
  if (profile?.display_name) lines.push(`Name: ${profile.display_name}`);
  if (profile?.age) lines.push(`Age: ${profile.age}`);
  if (!flags.noNumbers) {
    if (profile?.height_cm) lines.push(`Height: ${profile.height_cm} cm`);
    if (profile?.weight_kg) lines.push(`Profile weight: ${profile.weight_kg} kg`);
    if (profile?.body_fat_pct) lines.push(`Body fat: ${profile.body_fat_pct}%`);
  }
  if (profile?.fitness_goal) lines.push(`Training goal: ${profile.fitness_goal}`);
  if (profile?.experience_level) lines.push(`Experience: ${profile.experience_level}`);
  if (profile?.activity_level) lines.push(`Activity level: ${profile.activity_level}`);
  if (profile?.preferred_days?.length) lines.push(`Planned training days: ${profile.preferred_days.join(', ')}`);
  if (profile?.limitations) lines.push(`Injuries/limitations: ${profile.limitations}`);

  lines.push('\n=== NUTRITION SETTINGS ===');
  lines.push(`Goal mode: ${settings?.goal_mode ?? 'maintain'}${!flags.noNumbers && settings?.rate_pct ? ` at ${settings.rate_pct}% body weight per week` : ''}`);
  lines.push(`Meals per day: ${settings?.meals_per_day ?? 4}`);
  lines.push(`Diet preferences: ${settings?.diet_prefs?.length ? settings.diet_prefs.join(', ') : 'none given'}`);
  lines.push(`Allergies / avoid: ${settings?.allergies?.length ? settings.allergies.join(', ') : 'none given'}`);
  lines.push(`Balanced mode (no numbers): ${flags.noNumbers ? 'ON' : 'off'}`);

  if (targets && !flags.noNumbers) {
    lines.push("\n=== TODAY'S TARGETS (calculated by the app) ===");
    lines.push(
      `Calories ${fmt(n(targets.kcal))} kcal (maintenance ${fmt(n(targets.maintenance))}); protein ${fmt(n(targets.protein))} g (about ${fmt(n(targets.proteinPerMeal))} g per meal); carbs ${fmt(n(targets.carbs))} g; fat ${fmt(n(targets.fat))} g; fibre ${fmt(n(targets.fiber))} g; water ${(n(targets.waterMl) / 1000).toFixed(1)} L.`,
    );
    lines.push(`Training day today: ${targets.trainingDay ? 'yes' : 'no'}`);
  }

  const meals = summarizeMeals(input.meals, input.today, flags.noNumbers);
  lines.push("\n=== TODAY'S DIARY ===");
  lines.push(meals.today.length ? meals.today.join('\n') : 'Nothing logged yet today.');
  const water = input.waterByDate[input.today] ?? 0;
  lines.push(flags.noNumbers ? `Water today: ${Math.floor(water / 250)} glasses` : `Water today: ${(water / 1000).toFixed(2)} L`);

  lines.push('\n=== LAST 14 DAYS (daily totals; days not listed had nothing logged) ===');
  lines.push(meals.days.length ? meals.days.join('\n') : 'No food logged in the last 14 days.');

  if (!flags.noNumbers && input.weights.length) {
    lines.push('\n=== WEIGHT (most recent first) ===');
    const recent = [...input.weights].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 10);
    lines.push(recent.map((w) => `${w.date}: ${w.kg.toFixed(1)} kg`).join('; '));
    if (input.weights.length >= 4) {
      const sorted = [...input.weights].sort((a, b) => (a.date < b.date ? -1 : 1));
      const first = sorted.slice(0, 3).reduce((s, w) => s + w.kg, 0) / Math.min(3, sorted.length);
      const last = sorted.slice(-3).reduce((s, w) => s + w.kg, 0) / Math.min(3, sorted.length);
      lines.push(`Change from first to last readings (3-reading averages): ${(last - first).toFixed(1)} kg between ${sorted[0].date} and ${sorted[sorted.length - 1].date}. Daily weight is noisy; use trends.`);
    }
  }

  lines.push('\n=== TRAINING (completed sessions, last 14 days) ===');
  lines.push(input.workouts.length ? input.workouts.map((w) => `${w.date}: ${w.name ?? 'Workout'} (${w.minutes} min)`).join('; ') : 'No completed sessions logged.');

  if (input.checkins.length) {
    lines.push('\n=== RECOVERY CHECK-INS ===');
    lines.push(
      input.checkins
        .map((c) => `${c.date}: sleep ${c.sleep_hours ?? '—'} h, stress ${c.stress ?? '—'}/10${c.soreness_count ? `, ${c.soreness_count} sore muscle groups` : ''}`)
        .join('; '),
    );
  }

  return lines.join('\n');
}
