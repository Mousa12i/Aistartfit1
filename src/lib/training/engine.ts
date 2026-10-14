// The training plan engine. Deterministic: the same inputs and library always give the same plan,
// and every design decision is tied to a claim in evidence.ts. The AI coach never invents a plan;
// it collects the inputs, calls this engine, and explains or adjusts the result through the validator.

import { CORE_SLOTS, type ExperienceLevel, type SlotCandidate, type SlotKey } from './curated';
import { CURATED_SOURCE_IDS } from './curated-index.generated';
import {
  BASE_RANGE,
  BASE_RIR,
  ENGINE_VERSION,
  GENERAL_RANGE,
  GROUP_FILL_SLOTS,
  MAX_STRENGTH_DAYS,
  RAMP_SECONDS,
  SECONDS_PER_REP,
  SESSION_GROUP_CAP,
  SLOT_KIND,
  SLOT_ORDER,
  SPLITS,
  STRENGTH_WEEKDAYS,
  TARGET_GROUPS,
  TRANSITION_SECONDS,
  WARMUP_MINUTES,
  WARMUP_MINUTES_CAREFUL,
  WEEKDAY_NAMES,
  baseSets,
  maxSetsFor,
  repRange,
  restSeconds,
  type DayTemplate,
  type SlotKind,
} from './engine-config';
import { PlanLibrary, exerciseContributions, hasEquipment, isSafeAndAllowed, levelAllows, type UsableContext } from './engine-library';
import { screenForTraining, type ScreeningResult } from './screening';
import { EQUIP_LABELS, MUSCLE_GROUPS, PAIN_AREA_LABELS, type EquipTag, type MuscleGroupKey } from './taxonomy';
import {
  CARDIO_MODE_LABELS,
  PLAN_GOAL_LABELS,
  type CardioMode,
  type PlanDay,
  type PlanExerciseRef,
  type PlanGoal,
  type PlanNote,
  type PlannedCardio,
  type PlannedExercise,
  type ProgressionWeek,
  type TrainingIntake,
  type TrainingPlan,
  type VolumeRow,
} from './plan-types';

export { ENGINE_VERSION };

export type GenerateResult =
  | { status: 'hold'; screening: ScreeningResult }
  | { status: 'ready'; plan: TrainingPlan; screening: ScreeningResult };

interface Rx {
  repsMin: number;
  repsMax: number;
  timed: boolean;
  rest: number;
  rir: number;
}

interface Item {
  slot: SlotKey;
  kind: SlotKind;
  ex: PlanExerciseRef;
  cand: SlotCandidate | null;
  sets: number;
  minSets: number;
  maxSets: number;
  rx: Rx;
  contrib: Partial<Record<MuscleGroupKey, number>>;
  /** Core items came from the day template; fill items were added to reach weekly targets. */
  role: 'core' | 'fill';
}

interface DayDraft {
  template: DayTemplate;
  items: Item[];
}

interface Target {
  low: number;
  high: number;
  target: number;
  priority: boolean;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** "20-40 s", "30 s", "10-30 s each side" -> [20, 40]. */
export function parseTimedReps(text: string): [number, number] | null {
  const m = /(\d+)\s*(?:-\s*(\d+))?\s*(?:s|sec|seconds)\b/i.exec(text);
  if (!m) return null;
  const a = Number(m[1]);
  const b = m[2] ? Number(m[2]) : a;
  return [Math.min(a, b), Math.max(a, b)];
}

export function generatePlan(intake: TrainingIntake, lib: PlanLibrary, opts: { now?: Date } = {}): GenerateResult {
  const now = opts.now ?? new Date();
  const screening = screenForTraining({ age: intake.age, currentActivity: intake.currentActivity, pain: intake.pain, screening: intake.screening });
  if (screening.status === 'medical_first') return { status: 'hold', screening };

  const notes: PlanNote[] = screening.notes.map((text) => ({ kind: 'safety' as const, text }));
  const claims = new Set<string>(screening.claimIds);
  const rationale: { claimId: string; decision: string }[] = [];
  const why = (claimId: string, decision: string) => {
    claims.add(claimId);
    rationale.push({ claimId, decision });
  };

  // ---------- goal and level ----------
  let goal: PlanGoal = intake.goal;
  if (goal === 'fat_loss' && (screening.youth || screening.pregnant || screening.postpartum)) {
    goal = 'general';
    notes.push({
      kind: 'adjustment',
      text: screening.youth
        ? 'Under 18 the plan does not aim for fat loss; it builds strength and fitness instead, in line with the nutrition hub, which does not plan a deficit for under-18s.'
        : 'During pregnancy or after birth the plan aims for health and fitness rather than fat loss.',
    });
  }
  const level: ExperienceLevel = intake.experience;

  // ---------- days ----------
  const requestedDays = clamp(Math.round(intake.daysPerWeek), 1, 7);
  let strengthDays = Math.min(requestedDays, MAX_STRENGTH_DAYS[level]);
  if (goal === 'endurance') strengthDays = Math.min(strengthDays, 2);
  strengthDays = Math.max(1, strengthDays);
  const sessionMinutes = clamp(Math.round(intake.sessionMinutes), 20, 120);

  if (requestedDays > strengthDays) {
    why(
      goal === 'endurance' ? 'who_activity' : 'acsm_days',
      goal === 'endurance'
        ? `You can train ${requestedDays} days; ${strengthDays} are strength days and the rest are cardio, because your goal is endurance.`
        : `You can train ${requestedDays} days. For your experience the plan uses ${strengthDays} strength days and turns the other ${requestedDays - strengthDays} into cardio days.`,
    );
  } else {
    why('acsm_days', `${strengthDays} strength day${strengthDays > 1 ? 's' : ''} a week, matching the time you have.`);
  }
  if (strengthDays === 1) {
    notes.push({ kind: 'info', text: 'With one strength day a week the plan trains your whole body in one session. Two days would let you spread the work and recover between sessions.' });
  }

  // ---------- context ----------
  const available = new Set<EquipTag>(intake.equipment.length ? intake.equipment : ['bodyweight']);
  available.add('bodyweight');
  const ctx: UsableContext = {
    available,
    excludeFlags: new Set(screening.excludeFlags),
    excludeLying: screening.excludeLying,
    excludeImpact: screening.excludeImpact,
    avoid: new Set(intake.avoidExerciseIds),
    level,
  };
  const preferred = new Set<string>([...intake.preferredExerciseIds, ...(intake.history?.frequentExerciseIds.slice(0, 12) ?? [])]);

  // ---------- weekly targets ----------
  const targets = buildTargets(intake, goal, level, notes);
  why('vol_fractional', 'Weekly sets are counted as 1 for the main muscle and ½ for helping muscles, and each muscle group gets a target range.');
  why(
    goal === 'general' || goal === 'endurance' ? 'vol_minimum' : 'vol_dose',
    goal === 'general' || goal === 'endurance'
      ? 'Targets start at about 4 weekly sets per muscle group, the time-efficient minimum, and go higher when time allows.'
      : `Targets for your level are ${BASE_RANGE[level][0]}–${BASE_RANGE[level][1]} weekly sets for the big muscle groups (fewer for calves and abs).`,
  );
  claims.add('vol_session_cap');
  claims.add('vol_targets_design');

  // ---------- build days ----------
  const templates = SPLITS[Math.min(strengthDays, 5)];
  const used = new Map<string, number>();
  const missingSlots = new Set<SlotKey>();
  const careful = screening.older || screening.pregnant || screening.postpartum || screening.minRir >= 3;
  const warmup = careful ? WARMUP_MINUTES_CAREFUL : WARMUP_MINUTES;
  const sameMainLift = goal === 'strength';

  const makeItem = (slot: SlotKey, ex: PlanExerciseRef, cand: SlotCandidate | null, role: Item['role']): Item => {
    const kind = SLOT_KIND[slot];
    const rx = prescription(goal, kind, level, ex, screening);
    const isPriority = Object.entries(exerciseContributions(ex)).some(([g, c]) => c === 1 && targets[g as MuscleGroupKey]?.priority);
    let sets = baseSets(kind, level, goal);
    if (isPriority && kind === 'isolation') sets += 1;
    return {
      slot,
      kind,
      ex,
      cand,
      sets,
      minSets: 2,
      maxSets: Math.min(maxSetsFor(kind, goal), level === 'new' ? 3 : level === 'beginner' ? 4 : 99),
      rx,
      contrib: exerciseContributions(ex),
      role,
    };
  };

  const pick = (slot: SlotKey, day: DayDraft, allowGeneric = true): { ex: PlanExerciseRef; cand: SlotCandidate | null } | null => {
    const onDay = new Set(day.items.map((i) => i.ex.id));
    let options: { ex: PlanExerciseRef; cand: SlotCandidate | null }[] = lib.usableForSlot(slot, ctx);
    if (options.length === 0 && allowGeneric) options = lib.genericForSlot(slot, ctx, new Set()).map((ex) => ({ ex, cand: null }));
    options = options.filter((o) => !onDay.has(o.ex.id));
    if (options.length === 0) return null;
    const pref = options.filter((o) => preferred.has(o.ex.id));
    const ordered = [...pref, ...options.filter((o) => !preferred.has(o.ex.id))];
    if (sameMainLift && SLOT_KIND[slot] === 'main') return ordered[0];
    // Variety between days, but only among the two best options so quality does not drop.
    let best = ordered[0];
    let bestUses = used.get(best.ex.id) ?? 0;
    const loaded = (o: { ex: PlanExerciseRef }) => o.ex.equipment.some((t) => t !== 'bodyweight');
    const peers = ordered.slice(0, 2).filter((o) => loaded(o) === loaded(ordered[0]));
    for (const o of peers) {
      const u = used.get(o.ex.id) ?? 0;
      if (u < bestUses) {
        best = o;
        bestUses = u;
      }
    }
    return best;
  };

  const days: DayDraft[] = templates.map((template) => ({ template, items: [] }));
  for (const day of days) {
    for (const slot of day.template.core) {
      const choice = pick(slot, day);
      if (!choice) {
        missingSlots.add(slot);
        continue;
      }
      used.set(choice.ex.id, (used.get(choice.ex.id) ?? 0) + 1);
      day.items.push(makeItem(slot, choice.ex, choice.cand, 'core'));
    }
  }

  // Older adults get balance practice added at the end of each session (about 3 minutes).
  const minutesOf = (day: DayDraft) => dayMinutes(day, warmup) + (screening.older ? 3 : 0);

  // ---------- fit core work into the session time ----------
  let trimmed = false;
  let shortenedRest = false;
  for (const day of days) {
    while (minutesOf(day) > sessionMinutes) {
      trimmed = true;
      // 1) reduce sets on isolation/core work, 2) drop the last non-main item, 3) reduce main sets, 4) drop the last item
      const iso = [...day.items].reverse().find((i) => i.kind !== 'main' && i.sets > i.minSets);
      if (iso) {
        iso.sets -= 1;
        continue;
      }
      const lastNonMainIdx = findLastIndex(day.items, (i) => i.kind !== 'main');
      if (lastNonMainIdx >= 0 && day.items.length > 2) {
        day.items.splice(lastNonMainIdx, 1);
        continue;
      }
      const main = [...day.items].reverse().find((i) => i.sets > i.minSets);
      if (main) {
        main.sets -= 1;
        continue;
      }
      if (day.items.length > 2) {
        day.items.pop();
        continue;
      }
      // Last resort for very short sessions: shorter rests (not below 60 s).
      const longRest = [...day.items].sort((a, b) => b.rx.rest - a.rx.rest).find((i) => i.rx.rest > 60);
      if (longRest) {
        longRest.rx.rest = Math.max(60, longRest.rx.rest - 15);
        shortenedRest = true;
        continue;
      }
      break;
    }
  }
  if (shortenedRest) {
    notes.push({ kind: 'adjustment', text: 'To fit your session length, some rests are shorter than ideal. Longer sessions would allow full rests between sets of the main lifts.' });
  }

  // ---------- fill weekly volume toward targets ----------
  const volume = () => weeklyVolume(days);
  for (let iter = 0; iter < 400; iter++) {
    const v = volume();
    let best: { gainPerMin: number; apply: () => void } | null = null;

    const gainFor = (contrib: Partial<Record<MuscleGroupKey, number>>, sets: number): number | null => {
      let gain = 0;
      for (const [g, c] of Object.entries(contrib) as [MuscleGroupKey, number][]) {
        const t = targets[g];
        if (!t) continue;
        const after = (v[g] ?? 0) + c * sets;
        // never push a group above its range through direct work; indirect work may overshoot a little
        if (after > t.high + (c >= 1 ? 0.01 : 2.01)) return null;
        const cur = v[g] ?? 0;
        const add = c * sets;
        const toLow = Math.max(0, t.low - cur);
        const toTarget = Math.max(0, t.target - cur);
        // closing a gap below the minimum counts double
        gain += (Math.min(toLow, add) + Math.min(toTarget, add)) * (t.priority ? 1.5 : 1);
      }
      return gain;
    };
    const sessionOk = (day: DayDraft, contrib: Partial<Record<MuscleGroupKey, number>>, sets: number) =>
      (Object.entries(contrib) as [MuscleGroupKey, number][]).every(([g, c]) => dayGroupSets(day, g) + c * sets <= SESSION_GROUP_CAP + 0.01);

    // Option A: one more set on an existing exercise
    for (const day of days) {
      const dayMin = minutesOf(day);
      for (const item of day.items) {
        if (item.sets >= item.maxSets) continue;
        const cost = setSeconds(item) / 60;
        if (dayMin + cost > sessionMinutes) continue;
        if (!sessionOk(day, item.contrib, 1)) continue;
        const gain = gainFor(item.contrib, 1);
        if (gain === null || gain < 0.45) continue;
        const score = gain / cost;
        if (!best || score > best.gainPerMin) best = { gainPerMin: score, apply: () => (item.sets += 1) };
      }
    }

    // Option B: add an exercise for a muscle group that is short
    for (const [g, t] of Object.entries(targets) as [MuscleGroupKey, Target][]) {
      if ((v[g] ?? 0) >= t.target - 0.45) continue;
      for (const day of days) {
        if (!day.template.allowed.includes(g)) continue;
        if (day.items.length >= 9) continue;
        const dayMin = minutesOf(day);
        for (const slot of GROUP_FILL_SLOTS[g]) {
          if (day.items.some((i) => i.slot === slot)) continue;
          const choice = pick(slot, day, false);
          if (!choice) continue;
          const item = makeItem(slot, choice.ex, choice.cand, 'fill');
          item.sets = Math.min(item.sets, 2);
          day.items.push(item);
          const cost = minutesOf(day) - dayMin;
          day.items.pop();
          if (dayMin + cost > sessionMinutes) continue;
          if (!sessionOk(day, item.contrib, item.sets)) continue;
          const gain = gainFor(item.contrib, item.sets);
          if (gain === null || gain < 0.9) continue;
          const score = (gain / cost) * 0.9; // small preference for adding sets over adding exercises
          if (!best || score > best.gainPerMin) {
            best = {
              gainPerMin: score,
              apply: () => {
                used.set(item.ex.id, (used.get(item.ex.id) ?? 0) + 1);
                day.items.push(item);
              },
            };
          }
          break; // first usable slot for this group on this day is enough
        }
      }
    }

    if (!best) break;
    best.apply();
  }

  // ---------- bring groups that ended above their range back into it ----------
  for (let iter = 0; iter < 200; iter++) {
    const v = volume();
    const over = (Object.entries(targets) as [MuscleGroupKey, Target][]).find(([g, t]) => (v[g] ?? 0) > t.high + 2.01);
    if (!over) break;
    const [g] = over;
    // candidates: items that train g; prefer the one whose other groups lose least below their target
    let bestItem: { day: DayDraft; item: Item; cost: number } | null = null;
    for (const day of days) {
      for (const item of day.items) {
        const c = item.contrib[g] ?? 0;
        if (c <= 0) continue;
        if (item.kind === 'main') continue;
        const removing = item.sets <= item.minSets;
        if (removing && day.items.length <= 3) continue;
        const lose = removing ? item.sets : 1;
        let cost = 0;
        for (const [g2, c2] of Object.entries(item.contrib) as [MuscleGroupKey, number][]) {
          if (g2 === g) continue;
          const t2 = targets[g2];
          if (!t2) continue;
          cost += Math.max(0, t2.target - ((v[g2] ?? 0) - c2 * lose)) * c2;
        }
        cost += removing ? 0.5 : 0;
        cost -= c * 0.1;
        if (!bestItem || cost < bestItem.cost) bestItem = { day, item, cost };
      }
    }
    if (!bestItem) break;
    if (bestItem.item.sets > bestItem.item.minSets) bestItem.item.sets -= 1;
    else bestItem.day.items.splice(bestItem.day.items.indexOf(bestItem.item), 1);
  }

  // ---------- order, finalise ----------
  for (const day of days) {
    day.items.sort((a, b) => {
      const ka = a.kind === 'main' ? 0 : a.kind === 'secondary' ? 1 : 2;
      const kb = b.kind === 'main' ? 0 : b.kind === 'secondary' ? 1 : 2;
      if (ka !== kb) return ka - kb;
      return SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot);
    });
  }
  why('exercise_order', 'Each session starts with the big multi-joint lifts and ends with smaller single-joint and core exercises.');

  const finalVolume = volume();
  const volumeRows: VolumeRow[] = (Object.keys(MUSCLE_GROUPS) as MuscleGroupKey[])
    .filter((g) => targets[g] || (finalVolume[g] ?? 0) > 0)
    .map((g) => {
      const t = targets[g];
      const sets = round1(finalVolume[g] ?? 0);
      const low = t ? t.low : 0;
      const high = t ? t.high : 0;
      return {
        group: g,
        label: MUSCLE_GROUPS[g].label,
        sets,
        low,
        high,
        status: !t ? 'in_range' : sets < low - 0.01 ? 'low' : sets > high + 0.01 ? 'high' : 'in_range',
        priority: !!t?.priority,
      } as VolumeRow;
    });

  const short = volumeRows.filter((r) => r.status === 'low' && TARGET_GROUPS[r.group]);
  if (short.length > 0) {
    const missingByEquipment = short.filter((r) => GROUP_FILL_SLOTS[r.group].every((s) => lib.usableForSlot(s, ctx).length === 0 && lib.genericForSlot(s, ctx, new Set()).length === 0));
    if (missingByEquipment.length) {
      notes.push({
        kind: 'adjustment',
        text: `No suitable exercise was found for ${missingByEquipment.map((r) => r.label.toLowerCase()).join(', ')} with your equipment and current limits.`,
      });
    }
    const byTime = short.filter((r) => !missingByEquipment.includes(r));
    if (byTime.length) {
      notes.push({
        kind: 'adjustment',
        text: `${byTime.map((r) => r.label).join(', ')} ${byTime.length > 1 ? 'are' : 'is'} below the weekly target because the sessions are full. More minutes per session or another training day would close the gap.`,
      });
    }
  }
  if (trimmed) claims.add('estimate_time');

  const unlock = equipmentSuggestions(lib, ctx, [...missingSlots]);
  if (unlock.length) notes.push({ kind: 'info', text: unlock.join(' ') });

  for (const p of intake.pain) {
    notes.push({
      kind: 'safety',
      text:
        p.level === 'mild'
          ? `${PAIN_AREA_LABELS[p.area]} (mild): the positions most likely to aggravate it are left out. Work in a range that stays pain-free and stop any exercise that causes sharp or increasing pain.`
          : `${PAIN_AREA_LABELS[p.area]} (${p.level}): exercises that load it in the positions most likely to hurt are left out. Stop any exercise that causes sharp or increasing pain.`,
    });
  }

  // ---------- weekdays ----------
  const strengthWeekdays = STRENGTH_WEEKDAYS[Math.min(strengthDays, 5)];
  const planDays: PlanDay[] = days.map((day, i) => ({
    index: i,
    label: `Day ${i + 1} · ${day.template.label}`,
    focus: day.template.focus,
    weekday: strengthWeekdays[i],
    exercises: day.items.map((item) => toPlanned(item, lib, ctx, intake)),
    warmup: careful
      ? 'About 8 minutes of easy movement (walking or cycling, then the movements of the first exercise without weight), then 1–2 light practice sets of the first lift.'
      : 'About 5 minutes of easy movement, then 1–2 lighter practice sets of the first lift before the working sets.',
    estimatedMinutes: Math.round(minutesOf(day) / 5) * 5,
  }));
  why('warmup', 'Every session starts with a short general warm-up and lighter practice sets.');

  // ---------- prescription rationale ----------
  const mainRange = repRange(goal, 'main', level);
  why('load_range', goal === 'strength'
    ? `Main lifts use ${mainRange[0]}–${mainRange[1]} repetitions so the loads are heavy enough to build strength.`
    : `Main lifts use ${mainRange[0]}–${mainRange[1]} repetitions and smaller exercises use higher repetitions; lighter and heavier loads both build muscle.`);
  const rirMain = Math.max(screening.minRir, BASE_RIR[level].main);
  why('failure_optional', `Sets stop about ${rirMain} repetitions short of failure on the main lifts; training to failure is not required.`);
  if (screening.minRir < 3 && level !== 'new') why('failure_proximity', 'Smaller exercises go a little closer to failure (about 1–2 repetitions in reserve) because growth tends to improve closer to failure.');
  if (level === 'new' || level === 'beginner') claims.add('rir_start_easier');
  claims.add('rir_scale');
  why(level === 'new' || level === 'beginner' ? 'rest_intervals' : 'rest_hypertrophy', `Rest about ${Math.round(restSeconds(goal, 'main', level) / 30) / 2} minutes after main-lift sets and ${restSeconds(goal, 'isolation', level)} seconds after smaller exercises.`);
  if (strengthDays >= 2) {
    why(goal === 'strength' ? 'freq_strength' : 'freq_hypertrophy', 'Each major muscle group is trained on at least two days, spreading the weekly sets so each session stays manageable.');
  }

  // ---------- progression ----------
  const progression = progressionWeeks(level, screening);
  const progressionRules = [
    `Double progression: keep the weight until you reach the top of the repetition range on every set at the planned effort, then add the smallest step the equipment allows. Adding repetitions or adding weight both work.`,
    'If you can do 1–2 repetitions more than the planned number, increase the load by about 2–10%.',
    'Log every set with its repetitions in reserve. If performance drops for two sessions in a row, or you feel run down, take the lighter week early.',
    'Rebuild the plan every 6–8 weeks, or sooner if your goal, schedule, equipment or health changes.',
  ];
  why('progress_both', 'Progress by adding repetitions first, then weight (double progression).');
  why('progress_increase', 'Load increases of about 2–10% once you can do 1–2 repetitions more than planned.');
  why('deload_concept', 'A lighter week is planned as an option, used when tiredness or performance call for it.');
  claims.add('deload_rule');

  // ---------- cardio ----------
  const cardio = buildCardio(intake, goal, level, screening, lib, ctx, strengthWeekdays, requestedDays - strengthDays);
  for (const c of cardio.claimIds) claims.add(c);
  for (const r of cardio.rationale) rationale.push(r);
  for (const n of cardio.notes) notes.push(n);

  // ---------- extra context ----------
  if (screening.older) {
    rationale.push({ claimId: 'neuromotor', decision: 'Balance practice is added at the end of each session.' });
    addBalance(planDays, lib, ctx);
  }
  if (goal === 'fat_loss') why('rt_body_fat', 'Strength training stays the core of the plan while you lose fat.');
  if (goal === 'general' || goal === 'endurance') why('injury_prevention', 'Strength work is kept in every week; it was linked to fewer sports injuries, stretching alone was not.');
  if (intake.sleepHours != null && intake.sleepHours > 0) {
    if (intake.sleepHours < 7) {
      why('sleep_strength', `You sleep about ${intake.sleepHours} hours. If that is less than you need to feel rested, expect strength to suffer on short nights and do not chase records on those days.`);
    }
  }
  if (intake.nutritionMode === 'cut' || intake.nutritionMode === 'bulk') {
    why('nutrition_link', intake.nutritionMode === 'cut'
      ? 'Your nutrition plan is a cut, so weekly sets aim for the lower part of each range.'
      : 'Your nutrition plan is a bulk, so weekly sets aim for the upper part of each range.');
  }

  const title = `${PLAN_GOAL_LABELS[goal]} · ${strengthDays} strength day${strengthDays > 1 ? 's' : ''}`;
  const summary =
    `${strengthDays} strength session${strengthDays > 1 ? 's' : ''} a week (${strengthWeekdays.map((d) => WEEKDAY_NAMES[d]).join(', ')}), ` +
    `about ${Math.max(...planDays.map((d) => d.estimatedMinutes))} minutes each, plus ${cardio.minutesPerWeek} minutes of cardio a week` +
    (cardio.ramp.length && cardio.ramp[0] < cardio.targetMinutes ? `, building up to ${cardio.targetMinutes}.` : '.');

  const plan: TrainingPlan = {
    engineVersion: ENGINE_VERSION,
    generatedAt: now.toISOString(),
    title,
    goal: intake.goal,
    effectiveGoal: goal,
    level,
    summary,
    daysPerWeek: requestedDays,
    strengthDays,
    sessionMinutes,
    equipmentUsed: [...new Set(planDays.flatMap((d) => d.exercises.flatMap((e) => lib.byId.get(e.exerciseId)?.equipment ?? [])))]
      .filter((t) => t !== 'bodyweight')
      .sort(),
    days: planDays,
    volume: volumeRows,
    progression,
    progressionRules,
    cardio: cardio.sessions,
    cardioMinutesPerWeek: cardio.minutesPerWeek,
    cardioTargetMinutes: cardio.targetMinutes,
    cardioRamp: cardio.ramp,
    notes,
    claimIds: [...claims],
    rationale,
    inputs: {
      goal: intake.goal,
      experience: level,
      daysPerWeek: requestedDays,
      sessionMinutes,
      equipment: [...available],
      age: intake.age,
      pain: intake.pain,
      priorityMuscles: intake.priorityMuscles,
      currentActivity: intake.currentActivity,
      screeningStatus: screening.status,
    },
  };
  return { status: 'ready', plan, screening };
}

// ---------------------------------------------------------------------------------------------

function buildTargets(intake: TrainingIntake, goal: PlanGoal, level: ExperienceLevel, notes: PlanNote[]): Partial<Record<MuscleGroupKey, Target>> {
  const out: Partial<Record<MuscleGroupKey, Target>> = {};
  let [lo, hi] = goal === 'general' || goal === 'endurance' ? GENERAL_RANGE[level] : BASE_RANGE[level];
  if (goal === 'strength') {
    lo = Math.round(lo * 0.8);
    hi = Math.round(hi * 0.9);
  }
  const frac = intake.nutritionMode === 'cut' ? 0.3 : intake.nutritionMode === 'bulk' ? 0.7 : 0.5;
  const hist = intake.history && intake.history.weeksLogged >= 3 && intake.history.sessionsLast4Weeks >= 4 ? intake.history : null;
  let ramped = false;
  for (const [g, scale] of Object.entries(TARGET_GROUPS) as [MuscleGroupKey, number][]) {
    const priority = intake.priorityMuscles.includes(g);
    let low = Math.max(goal === 'general' || goal === 'endurance' ? 3 : 4, Math.round(lo * scale));
    // Glutes are a main mover in squats, lunges and hinges as well as bridges, so they collect direct
    // sets from all lower-body work; their ceiling is wider (design choice).
    const high = Math.round(hi * scale) + (priority ? 2 : 0) + (g === 'glutes' ? 4 : 0);
    let target = priority ? high : low + frac * (high - low);
    if (hist) {
      const current = hist.weeklySets[g] ?? 0;
      const ramp = Math.max(4, current * 1.3 + 2);
      if (ramp < target) {
        target = ramp;
        low = Math.min(low, Math.floor(ramp));
        ramped = true;
      }
    }
    out[g] = { low, high, target: round1(target), priority };
  }
  if (ramped) {
    notes.push({
      kind: 'adjustment',
      text: 'Your logged training shows lower weekly volume for some muscles than this plan would normally use, so those targets start close to what you do now and should rise over the next weeks.',
    });
  }
  return out;
}

function prescription(goal: PlanGoal, kind: SlotKind, level: ExperienceLevel, ex: PlanExerciseRef, screening: ScreeningResult): Rx {
  const timed = kind === 'core' || kind === 'carry' || kind === 'balance' ? parseTimedReps(ex.defaultReps) : null;
  let [repsMin, repsMax] = timed ?? repRange(goal, kind, level);
  if (!timed && (screening.youth || screening.older || screening.pregnant) && repsMin < 8) {
    repsMin = 8;
    repsMax = Math.max(repsMax, 12);
  }
  const rirKind = kind === 'main' || kind === 'secondary' || kind === 'isolation' ? kind : 'core';
  let rir = BASE_RIR[level][rirKind];
  if (goal === 'strength' && kind === 'main') rir = Math.max(rir, 2);
  rir = Math.max(rir, screening.minRir);
  return {
    repsMin,
    repsMax,
    timed: !!timed,
    rest: restSeconds(goal, kind, level),
    rir,
  };
}

function setSeconds(item: Item): number {
  const work = item.rx.timed ? (item.rx.repsMin + item.rx.repsMax) / 2 : ((item.rx.repsMin + item.rx.repsMax) / 2) * SECONDS_PER_REP;
  return work * (item.ex.unilateral ? 2 : 1) + item.rx.rest;
}

function itemMinutes(item: Item, first: boolean): number {
  return (item.sets * setSeconds(item) + TRANSITION_SECONDS + (first ? RAMP_SECONDS : 0)) / 60;
}

function dayMinutes(day: DayDraft, warmup: number): number {
  const firstMain = day.items.find((i) => i.kind === 'main');
  return warmup + day.items.reduce((sum, i) => sum + itemMinutes(i, i === firstMain), 0);
}

function dayGroupSets(day: DayDraft, g: MuscleGroupKey): number {
  return day.items.reduce((s, i) => s + i.sets * (i.contrib[g] ?? 0), 0);
}

function weeklyVolume(days: DayDraft[]): Partial<Record<MuscleGroupKey, number>> {
  const v: Partial<Record<MuscleGroupKey, number>> = {};
  for (const d of days) for (const i of d.items) for (const [g, c] of Object.entries(i.contrib) as [MuscleGroupKey, number][]) v[g] = (v[g] ?? 0) + c * i.sets;
  return v;
}

function findLastIndex<T>(arr: T[], fn: (x: T) => boolean): number {
  for (let i = arr.length - 1; i >= 0; i--) if (fn(arr[i])) return i;
  return -1;
}

function repsText(rx: Rx, unilateral: boolean): string {
  const range = rx.repsMin === rx.repsMax ? `${rx.repsMin}` : `${rx.repsMin}-${rx.repsMax}`;
  return `${range}${rx.timed ? ' s' : ''}${unilateral ? ' each side' : ''}`;
}

function toPlanned(item: Item, lib: PlanLibrary, ctx: UsableContext, intake: TrainingIntake): PlannedExercise {
  const alternatives: { exerciseId: string; name: string }[] = [];
  for (const o of lib.usableForSlot(item.slot, ctx)) {
    if (o.ex.id === item.ex.id) continue;
    alternatives.push({ exerciseId: o.ex.id, name: o.ex.name });
    if (alternatives.length >= 4) break;
  }
  if (alternatives.length < 2) {
    for (const ex of lib.genericForSlot(item.slot, ctx, new Set([item.ex.id, ...alternatives.map((a) => a.exerciseId)]))) {
      alternatives.push({ exerciseId: ex.id, name: ex.name });
      if (alternatives.length >= 3) break;
    }
  }
  const noteParts: string[] = [];
  const best = intake.history?.bestSets[item.ex.id];
  if (best) noteParts.push(`Last best set: ${best.weightKg} kg × ${best.reps}${best.rir != null ? ` (${best.rir} in reserve)` : ''}.`);
  if (item.rx.timed) noteParts.push('Hold steady with good form; stop the set when form slips.');
  return {
    exerciseId: item.ex.id,
    name: item.ex.name,
    slot: item.slot,
    pattern: item.ex.pattern,
    sets: item.sets,
    reps: repsText(item.rx, item.ex.unilateral),
    repsMin: item.rx.repsMin,
    repsMax: item.rx.repsMax,
    timed: item.rx.timed,
    restSeconds: item.rx.rest,
    rir: item.rx.rir,
    unilateral: item.ex.unilateral,
    note: noteParts.length ? noteParts.join(' ') : null,
    alternatives,
    contributions: item.contrib,
  };
}

function progressionWeeks(level: ExperienceLevel, screening: ScreeningResult): ProgressionWeek[] {
  const easy = screening.minRir >= 3;
  return [
    { week: 1, label: 'Learn the plan', setsNote: 'Planned sets', rirNote: easy ? 'Keep 3–4 repetitions in reserve while you find your weights' : 'One repetition more in reserve than planned while you find your weights' },
    { week: 2, label: 'Build', setsNote: 'Planned sets', rirNote: 'Planned reps in reserve; add repetitions where you can' },
    { week: 3, label: 'Build', setsNote: 'Planned sets', rirNote: 'Planned reps in reserve; add weight where you hit the top of the range' },
    { week: 4, label: 'Build', setsNote: 'Planned sets', rirNote: 'Planned reps in reserve' },
    {
      week: 5,
      label: level === 'new' || level === 'beginner' ? 'Build (lighter week only if needed)' : 'Build or lighter week',
      setsNote: 'If you feel run down or performance dropped: about half the sets',
      rirNote: 'Lighter week: easy loads, 4+ repetitions in reserve',
    },
    { week: 6, label: 'Re-test and rebuild', setsNote: 'Rebuild the plan with your new numbers', rirNote: 'Planned reps in reserve' },
  ];
}

function equipmentSuggestions(lib: PlanLibrary, ctx: UsableContext, missing: SlotKey[]): string[] {
  const out: string[] = [];
  for (const slot of missing) {
    let suggestion: EquipTag | null = null;
    for (const { ex, cand } of lib.slotCandidates(slot)) {
      if (!isSafeAndAllowed(ex, ctx) || !levelAllows(ctx.level, cand, ex)) continue;
      for (const set of cand.needs) {
        const lacking = set.filter((t) => !hasEquipment(ctx, t));
        if (lacking.length === 1 && !['machine', 'cable', 'smith_machine', 'cardio_machine'].includes(lacking[0])) {
          suggestion = lacking[0];
          break;
        }
      }
      if (suggestion) break;
    }
    if (suggestion) {
      const name = EQUIP_LABELS[suggestion].toLowerCase();
      const lead = /s$/.test(name) ? name.charAt(0).toUpperCase() + name.slice(1) : `${/^[aeiou]/.test(name) ? 'An' : 'A'} ${name}`;
      out.push(`${lead} would let the plan include ${CORE_SLOTS[slot].label.toLowerCase()} exercises.`);
    }
    else out.push(`No ${CORE_SLOTS[slot].label.toLowerCase()} exercise fits your equipment and limits, so that part is left out.`);
  }
  return [...new Set(out)].slice(0, 4);
}

function addBalance(days: PlanDay[], lib: PlanLibrary, ctx: UsableContext): void {
  const options = lib.usableForSlot('balance', ctx);
  if (!options.length) return;
  days.forEach((day, i) => {
    const ex = options[i % options.length].ex;
    const timed = parseTimedReps(ex.defaultReps) ?? [20, 30];
    day.exercises.push({
      exerciseId: ex.id,
      name: ex.name,
      slot: 'balance',
      pattern: ex.pattern,
      sets: 2,
      reps: `${timed[0] === timed[1] ? timed[0] : `${timed[0]}-${timed[1]}`} s${ex.unilateral ? ' each side' : ''}`,
      repsMin: timed[0],
      repsMax: timed[1],
      timed: true,
      restSeconds: 30,
      rir: 0,
      unilateral: ex.unilateral,
      note: 'Stand next to a wall or sturdy chair you can hold if needed.',
      alternatives: options.filter((o) => o.ex.id !== ex.id).map((o) => ({ exerciseId: o.ex.id, name: o.ex.name })),
      contributions: {},
    });
  });
}

const CARDIO_KEYS: Record<CardioMode, string[]> = {
  walking: ['N:brisk-walking', 'N:incline-treadmill-walking'],
  running: ['D:Jogging, Treadmill'],
  cycling: ['D:Bicycling, Stationary', 'D:Recumbent Bike'],
  swimming: ['N:swimming'],
  rowing: ['D:Rowing, Stationary'],
  elliptical: ['D:Elliptical Trainer'],
};

function cardioExercise(mode: CardioMode, lib: PlanLibrary, ctx: UsableContext): PlanExerciseRef | null {
  for (const key of CARDIO_KEYS[mode]) {
    const ex = lib.bySource.get(CURATED_SOURCE_IDS[key] ?? '');
    if (!ex) continue;
    if (ex.flags.some((f) => ctx.excludeFlags.has(f))) continue;
    if (ctx.excludeImpact && ex.flags.includes('impact')) continue;
    // walking outdoors needs nothing; machines need a cardio machine (or a pool for swimming)
    if (ex.equipment.includes('cardio_machine') && !hasEquipment(ctx, 'cardio_machine')) continue;
    return ex;
  }
  return null;
}

function buildCardio(
  intake: TrainingIntake,
  goal: PlanGoal,
  level: ExperienceLevel,
  screening: ScreeningResult,
  lib: PlanLibrary,
  ctx: UsableContext,
  strengthWeekdays: number[],
  extraDays: number,
): {
  sessions: PlannedCardio[];
  minutesPerWeek: number;
  targetMinutes: number;
  ramp: number[];
  claimIds: string[];
  rationale: { claimId: string; decision: string }[];
  notes: PlanNote[];
} {
  const claimIds: string[] = [];
  const rationale: { claimId: string; decision: string }[] = [];
  const notes: PlanNote[] = [];
  if (intake.cardio === 'none' && goal !== 'endurance') {
    notes.push({ kind: 'info', text: 'You chose no cardio. WHO guidelines still suggest 150+ minutes of moderate activity a week for health; brisk walking counts.' });
    claimIds.push('who_activity');
    return { sessions: [], minutesPerWeek: 0, targetMinutes: 0, ramp: [], claimIds, rationale, notes };
  }
  const targetMinutes = goal === 'endurance' ? 240 : goal === 'fat_loss' ? 200 : 150;
  const start = intake.currentActivity === 'inactive' ? Math.min(60, targetMinutes) : intake.currentActivity === 'some' ? Math.min(90, targetMinutes) : targetMinutes;
  const step = start >= targetMinutes ? 0 : Math.max(15, Math.round((targetMinutes - start) / 4 / 5) * 5);
  const ramp = [0, 1, 2, 3, 4, 5].map((w) => Math.min(targetMinutes, start + step * w));
  claimIds.push('who_activity');
  rationale.push({
    claimId: 'who_activity',
    decision:
      start < targetMinutes
        ? `Cardio starts at ${start} minutes a week and builds by about ${step} minutes a week to ${targetMinutes}.`
        : `${targetMinutes} minutes of cardio a week, inside the WHO range of 150–300.`,
  });

  const modes: CardioMode[] = intake.cardioModes.length ? intake.cardioModes : ['walking'];
  const usable = modes.map((m) => ({ mode: m, ex: cardioExercise(m, lib, ctx) })).filter((m) => m.mode !== 'running' || !ctx.excludeImpact);
  if (usable.length === 0) usable.push({ mode: 'walking', ex: cardioExercise('walking', lib, ctx) });

  const free = [0, 1, 2, 3, 4, 5, 6].filter((d) => !strengthWeekdays.includes(d));
  const order = [...free, ...strengthWeekdays];
  const count = clamp(Math.ceil(start / 45), 2, 7);
  const weekdays = order.slice(0, count).sort((a, b) => a - b);
  // split the minutes into 5-minute blocks as evenly as possible, so the total matches exactly
  const blocks = Math.round(start / 5);
  const perSessionList = weekdays.map((_, i) => (Math.floor(blocks / count) + (i < blocks % count ? 1 : 0)) * 5);
  const perSession = perSessionList[0];
  const intervals = screening.maxCardioIntensity === 'vigorous' && level !== 'new' && (goal === 'fat_loss' || goal === 'endurance') && intake.currentActivity !== 'inactive';
  const sessions: PlannedCardio[] = weekdays.map((weekday, i) => {
    const m = usable[i % usable.length];
    const isInterval = intervals && i === 0;
    return {
      mode: m.mode,
      label: isInterval ? `${CARDIO_MODE_LABELS[m.mode]} — intervals` : CARDIO_MODE_LABELS[m.mode],
      minutes: isInterval ? Math.max(15, Math.min(25, perSessionList[i])) : perSessionList[i],
      intensity: isInterval ? 'vigorous' : 'moderate',
      exerciseId: m.ex?.id ?? null,
      weekday,
      note: isInterval
        ? 'After an easy warm-up, alternate about 1 minute hard with 2 minutes easy; start with 4–6 rounds (StartFit starting point, not a study protocol).'
        : 'Moderate effort: you can talk but not sing.',
    };
  });
  if (intervals) {
    claimIds.push('hiit_time');
    rationale.push({ claimId: 'hiit_time', decision: 'One session a week is intervals, which saves time for similar body-composition results.' });
  }
  void perSession;
  if (weekdays.some((d) => strengthWeekdays.includes(d)) || extraDays <= 0) {
    claimIds.push('concurrent');
    rationale.push({ claimId: 'concurrent', decision: 'Cardio goes on other days or at least a few hours away from lifting where possible, so it does not blunt your strength sessions.' });
  } else {
    claimIds.push('concurrent');
    rationale.push({ claimId: 'concurrent', decision: 'Cardio is on separate days from lifting.' });
  }
  if (screening.maxCardioIntensity === 'moderate') {
    notes.push({ kind: 'safety', text: 'Cardio stays at a moderate effort (you can talk in full sentences).' });
  }
  const minutesPerWeek = sessions.reduce((s, c) => s + c.minutes, 0);
  return { sessions, minutesPerWeek, targetMinutes, ramp, claimIds, rationale, notes };
}
