# StartFit

Fitness app: React + TypeScript + Vite + Tailwind, Supabase backend (Postgres, Auth, Edge Functions), Stripe billing.

## Run locally

```bash
npm install
cp .env.example .env   # fill VITE_SUPABASE_ANON_KEY
npm run dev
```

## Build / deploy the web app

`npm run build` outputs `dist/`. Deploy to Netlify, Vercel or Cloudflare Pages
(SPA rewrites are already configured: `netlify.toml`, `vercel.json`, `public/_redirects`).
Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the host's environment variables.

## Backend (Supabase)

```bash
supabase link --project-ref <ref>
supabase db push                       # applies supabase/migrations (includes the nutrition hub)
supabase functions deploy ai-coach
supabase functions deploy nutrition-coach
supabase functions deploy food-search
supabase functions deploy training-coach
supabase functions deploy recovery-coach
supabase secrets set OPENAI_API_KEY=... USDA_API_KEY=... STRIPE_SECRET_KEY=... STRIPE_WEBHOOK_SECRET=...
```

## Nutrition tab

Bottom-nav tab between Workout and Recover (`/nutrition`). Pages:

| Path | What it does |
| --- | --- |
| `/nutrition` | Hub: today's ring and macros (or balanced view), quick actions, insights, all sections |
| `/nutrition/diary` | Day-by-day diary by meal, edit portions, move/delete, water, copy previous day |
| `/nutrition/add` | Search (USDA FoodData Central + common foods + your foods), barcode number, recent, favourites, quick add |
| `/nutrition/food` | Create / edit your own foods from a pack label (per serving or per 100 g, salt or sodium) |
| `/nutrition/nutrients` | Day or 7-day nutrients vs personal targets and FDA Daily Values, with data coverage |
| `/nutrition/plan` | Goal (fat loss / maintain / lean gain / recomp), rate, protein, fat, meals, carb shift, adaptive maintenance check-in, diet breaks |
| `/nutrition/weight` | Weigh-ins (stored in `body_measurements`), smoothed trend, rate check |
| `/nutrition/coach` | AI nutrition coach (OpenAI via the `nutrition-coach` function) |
| `/nutrition/library` | Evidence-based guides; every claim tied to a checked reference |
| `/nutrition/reports` | Downloadable PDF report (7 / 14 / 30 days) |
| `/nutrition/check-in` | SCOFF wellbeing check-in, balanced mode (no numbers), diet preferences, allergies, support lines |
| `/nutrition/recipes` | Recipes that log to the diary in one tap |

How the numbers are calculated lives in `src/lib/nutrition/engine.ts` (tested in `engine.test.ts`).
The ~80 built-in common foods in `src/lib/nutrition/foods.ts` carry USDA SR Legacy values per 100 g (macros plus
vitamins and minerals), each with its FoodData Central ID, so they work offline and before `food-search` is deployed.
Food search needs the `food-search` function and ideally a free `USDA_API_KEY` (without it the shared `DEMO_KEY`
is limited to 30 searches an hour). Until the migration is applied the old diary keeps working in a basic mode.

## Training: exercise library, plan engine and training coach

**Exercise library** (`supabase/migrations/20261014090000_training_library.sql`, generated): 1,417 exercises,
1,178 visible after merging duplicates (hidden duplicates stay so old logs still work). Every exercise has a
movement pattern, the muscles it trains directly (counted as 1 set) and indirectly (½ set), equipment and
safety tags; `exercise_muscles` (used by Recovery) is kept in step by a trigger. Sources: the public-domain
free-exercise-db dataset (`data/free-exercise-db.json`) and the app's original catalogue
(`data/startfit-catalog.json`), reviewed in `src/lib/training/` (`taxonomy.ts`, `library-overrides.ts`,
`library-additions.ts`, `curated.ts`). Regenerate after editing them:

```bash
node scripts/generate-training-library.mjs   # also writes src/lib/training/curated-index.generated.ts
node scripts/generate-ready-routines.mjs     # 28 ready-made routines built by the plan engine
node scripts/generate-coach-evidence.mjs     # copies the evidence list into the training-coach function
```

**Plan engine** (`src/lib/training/engine.ts`, tested in `engine.test.ts`): deterministic. It reads the answers
(goal, experience, days, minutes, equipment, age, current activity, health screening, pain), the person's
logged history and the nutrition goal, then builds the week: split, exercises from the curated core, weekly
sets per muscle group (fractional counting), reps, reps in reserve, rest, session time, cardio, progression
and an optional lighter week. Every decision is tied to a claim in `src/lib/training/evidence.ts`; claims that
are StartFit design choices are labelled as such and never cited as studies. `validate.ts` re-checks every
plan and every change (equipment, safety limits, numbers, time). The health screen (`screening.ts`) holds the
plan and asks for a clinician first for symptoms, pregnancy without clearance, known heart/metabolic/kidney/lung
disease in people not yet exercising, uncontrolled high blood pressure, recent surgery, or a doctor's restriction.

**Training coach** (`/training/coach`): asks only for missing answers, builds the plan, lets you swap exercises,
saves it as a day-aware routine (`save_training_plan`), and downloads a text PDF with numbered references and
DOI links (Pro+). The chat uses the `training-coach` function (OpenAI `o3-mini`, same `OPENAI_API_KEY` and daily
limits as the other coaches). The server deletes any answer block that does not cite a known claim, a library
exercise or the person's own data, and plan changes it proposes are only applied by the app after the validator
accepts them.

**Train at home** (`src/lib/training/home.ts`, routine page → "Train at home"): rebuilds any routine for the
equipment at home, exercise by exercise (same days and sets; each swap trains the most of the same muscles;
lighter swaps get a higher rep range and closer-to-failure effort), shows weekly sets before → after and which
single piece of equipment would keep the most exercises. It is saved as "<routine> · Home" (`details.variant`)
and made active; "Back to gym" re-activates the original.

**Short on time** (`src/lib/training/time-fit.ts`, "Short on time?" in a workout): fits today's session into
15/20/30/45 minutes — exercise-specific warm-up, supersets for exercises that train different muscles, fewer
accessory sets, then leaving out the last accessories (never the first main lift or anything already started)
— shows what was cut, and can be undone.

**Connected across the app**: every coach (training, recovery, nutrition, general) reads the same
"current training setup" from the database (`supabase/functions/_shared/training-context.ts`): the active routine
and its exercises, whether it is the home version and with which equipment, sessions shortened with "Short on
time" (recorded in `workout_sessions.notes`) and an active lighter week. The Recovery Doctor plans today's decision
around the active routine (home or gym), the next routine day carries on across the gym/home versions, and the
lighter-week detector pauses its lift comparison for two weeks after a gym↔home switch. Deploy the coach
functions again after updating (`supabase functions deploy training-coach recovery-coach nutrition-coach ai-coach`).

**Memory** (`/memory`): `user_memory` holds facts the person or a coach saved (injuries, equipment, preferences).
The person can add, edit, pin and delete every entry. All three coaches read it.

**Routines**: `workout_plan_exercises.day_index` / `day_label` give routines real training days;
`workout_sessions.plan_day` records which day was trained and "Start" picks the next day. Every exercise page
has **Start & log** (`/workout/free?exercise=<id>`) and **Add to routine**.

## Recovery Doctor (`/recovery`)

The 3D body model (`RecoveryBodyModel.tsx`, `public/models/body.glb`) and its red/amber/green colours are unchanged.
Migration `supabase/migrations/20261014093000_recovery_doctor_v2.sql` adds the morning wellness answers, session RPE,
lighter weeks, return-to-training, optional cycle insights and the coach chat (all owner-only RLS).

- **Evidence** (`src/lib/recovery/doctor/evidence.ts`): every statement is checked against the study's abstract;
  thresholds StartFit chose are labelled "StartFit rule" and never cited as studies. The acute:chronic workload
  ratio is deliberately not used to predict injury (Impellizzeri et al., 2021).
- **Today's decision** (`decision.ts`): morning check-in vs your own 28-day baseline, last night's sleep, recovery
  estimates of the next workout's muscles, pain reports and monotony → Go / Adjust / Easy / Stop. Shown on Home too.
- **Load** (`load.ts`): session RPE × minutes (asked on the workout-complete screen), weekly load, monotony, strain.
- **Trends, lighter-week detector, weekly report, return-to-training** (Pro); **fingerprint, "what works for you",
  PDF report and clinician record** (Pro+). Check-in, decision, triage with red flags, methods library, sleep, this
  week's load, cycle opt-in and the coach (daily limits) are free.
- **Recovery coach**: `supabase/functions/recovery-coach` (OpenAI `o3-mini`, same key and daily limits). It may
  only cite the recovery claims (`node scripts/generate-coach-evidence.mjs` copies them) or the person's own data;
  red-flag symptoms in a message always get a fixed safety answer first, even past the daily limit.
- The old `recovery-doctor` function is no longer called by the app and can be left or removed.

## Privacy, consent and account deletion

What the app stores, why and who receives it is written in `src/lib/legal/privacy-policy.ts` (one source for the
in-app page `/privacy` and the public pages). Store answers: `STORE_COMPLIANCE.md`.

- **Health-data consent** — after sign-in, before onboarding, the app asks for explicit consent to process health and
  fitness data (`user_consents`, kind `health_data`). Withdrawing it in Settings stops the app until the person agrees again.
- **AI permission** — every AI coach (floating coach, AI coach page, training, nutrition and recovery coaches, routine
  generator) shows what is sent to OpenAI and asks first (kind `third_party_ai`). All six OpenAI functions refuse with
  `403 ai_consent_required` without it (`supabase/functions/_shared/consent.ts`).
- Every grant and withdrawal is recorded in `user_consent_events` (append-only, written by a trigger).
- **Delete account** — Settings → Privacy & Data → Delete account (type DELETE) calls the `delete-account` function: it
  cancels an active Stripe subscription (nothing is deleted if that fails), asks Stripe to delete the customer, deletes the
  person's private routines and then the auth user; every other table cascades.
- **Public pages** — `node scripts/generate-privacy-html.mjs` writes `public/privacy.html` and `public/delete-account.html`
  (Vite copies them into the build). Fill in the `[[placeholders]]` first; the script warns while any remain.
  Bump `PRIVACY_POLICY_VERSION` (`src/lib/legal/version.ts`) when a change needs people to agree again.

Deploy:

```bash
supabase db push                                   # 20261014094000_privacy_consent.sql
supabase functions deploy delete-account
supabase functions deploy ai-coach nutrition-coach training-coach recovery-coach routine-generator recovery-doctor
ESBUILD_PATH=... node scripts/generate-privacy-html.mjs && npm run build
```

`delete-account` uses `STRIPE_SECRET_KEY` (already set for checkout). Deploy the migration before the new app version:
until it exists the app skips the consent screen and keeps the AI coaches off.
