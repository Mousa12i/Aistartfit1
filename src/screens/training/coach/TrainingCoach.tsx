import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Brain, Download, Lock, RefreshCw, Save, SlidersHorizontal, Sparkles } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useEntitlements } from '@/lib/entitlements-context';
import { fetchWorkoutPlanById } from '@/lib/data';
import { fetchSettings } from '@/lib/nutrition/api';
import { downloadBlob } from '@/lib/nutrition/pdf';
import {
  fetchActiveRoutine,
  loadPlanLibrary,
  loadTrainingHistory,
  loadTrainingProfile,
  saveTrainingProfile,
  savePlanAsRoutine,
} from '@/lib/training/api';
import { routineVariant, type RoutineVariant } from '@/lib/training/api';
import { EQUIP_LABELS, type EquipTag } from '@/lib/training/taxonomy';
import { completeIntake, draftFromSources, missingFields, type IntakeDraft, type IntakeField } from '@/lib/training/intake';
import { generatePlan } from '@/lib/training/engine';
import { applyPlanAction, resolvePlanIds, type PlanAction } from '@/lib/training/plan-actions';
import { usableContextFor, validatePlan } from '@/lib/training/validate';
import { screenForTraining, type ScreeningResult } from '@/lib/training/screening';
import { renderPlanPdf, planPdfFilename } from '@/lib/training/plan-pdf';
import type { PlanLibrary } from '@/lib/training/engine-library';
import type { TrainingHistorySummary, TrainingPlan } from '@/lib/training/plan-types';
import { Notice, Page, PageHeader, Segmented, Toast } from '@/screens/nutrition/ui';
import { LoadingState } from '@/components/ui/States';
import { StripeUpgradeModal } from '@/components/ui/StripeUpgradeModal';
import { IntakeWizard } from './IntakeWizard';
import { PlanView } from './PlanView';
import { CoachChat } from './CoachChat';
import { AiConsentGate } from '@/components/privacy/AiConsentGate';

const ALL_STEPS: IntakeField[] = ['goal', 'experience', 'schedule', 'equipment', 'age', 'sex', 'activity', 'screening', 'pain'];
const LOCAL_PLAN_KEY = 'startfit_unsaved_training_plan';

function readLocalPlan(): TrainingPlan | null {
  try {
    const raw = localStorage.getItem(LOCAL_PLAN_KEY);
    return raw ? (JSON.parse(raw) as TrainingPlan) : null;
  } catch {
    return null;
  }
}

function writeLocalPlan(plan: TrainingPlan | null) {
  try {
    if (plan) localStorage.setItem(LOCAL_PLAN_KEY, JSON.stringify(plan));
    else localStorage.removeItem(LOCAL_PLAN_KEY);
  } catch {
    // storage may be unavailable (private mode); the plan still works for this visit
  }
}

function isEnginePlan(v: unknown): v is TrainingPlan {
  return !!v && typeof v === 'object' && 'engineVersion' in (v as object) && Array.isArray((v as TrainingPlan).days);
}

export function TrainingCoach() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { profile } = useAuth();
  const { hasFeature, tier } = useEntitlements();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lib, setLib] = useState<PlanLibrary | null>(null);
  const [draft, setDraft] = useState<IntakeDraft>({});
  const [profileAvailable, setProfileAvailable] = useState(true);
  const [history, setHistory] = useState<TrainingHistorySummary | null>(null);
  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [routineId, setRoutineId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [hold, setHold] = useState<ScreeningResult | null>(null);
  const [wizard, setWizard] = useState<IntakeField[] | null>(null);
  const [tab, setTab] = useState<'plan' | 'coach'>(params.get('tab') === 'coach' ? 'coach' : 'plan');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  /** Set when the active routine is a home version: rebuilding then uses the home equipment. */
  const [homeVariant, setHomeVariant] = useState<RoutineVariant | null>(null);

  const routineParam = params.get('routine');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [{ lib: library }, saved, nutrition, fetchedRoutine] = await Promise.all([
          loadPlanLibrary(),
          loadTrainingProfile(),
          fetchSettings().catch(() => null),
          routineParam ? fetchWorkoutPlanById(routineParam).catch(() => null) : fetchActiveRoutine().catch(() => null),
        ]);
        if (cancelled) return;
        // A home version has no engine plan of its own: show the gym plan it came from, and build for home.
        const variant = routineVariant(fetchedRoutine);
        setHomeVariant(variant);
        const routine = variant ? await fetchWorkoutPlanById(variant.sourcePlanId).catch(() => null) : fetchedRoutine;
        const hist = await loadTrainingHistory(library).catch(() => null);
        const settings = nutrition?.settings ?? null;
        const d = draftFromSources({
          saved: { ...saved.draft, screening: saved.screening },
          profile,
          nutrition: settings ? { sex: settings.sex, goalMode: settings.goal_mode } : null,
        });
        setLib(library);
        setProfileAvailable(saved.available);
        setHistory(hist);
        setDraft(d);
        let current: TrainingPlan | null = null;
        if (routine && isEnginePlan(routine.details)) {
          current = resolvePlanIds(routine.details, library);
          if (routine.is_public || routine.created_by !== profile?.id) {
            // A ready-made routine: saving makes the person's own copy.
            setDirty(true);
          } else {
            setRoutineId(routine.id);
          }
        } else {
          current = readLocalPlan();
          if (current) setDirty(true);
        }
        setPlan(current);
        const missing = missingFields(d);
        if (!current && missing.length) setWizard(missing);
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Could not load your training data.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile, routineParam]);

  const missing = useMemo(() => missingFields(draft), [draft]);
  const intake = useMemo(() => completeIntake(draft, history), [draft, history]);
  const screening = useMemo(() => (intake ? screenForTraining(intake) : null), [intake]);

  // A plan is always re-checked against the person's current answers (equipment, pain, health).
  const fitIssues = useMemo(() => {
    if (!plan || !lib || !intake || !screening || screening.status === 'medical_first') return [];
    return validatePlan(plan, lib, usableContextFor(intake, screening), screening).filter((i) => i.level === 'error');
  }, [plan, lib, intake, screening]);

  const build = useCallback(
    async (d: IntakeDraft) => {
      if (!lib) return;
      setWizard(null);
      setActionError(null);
      if (profileAvailable) await saveTrainingProfile(d, d.screening ?? null).catch(() => undefined);
      // Training at home: the plan is built for the home equipment; the saved answers keep the gym setup.
      const full = completeIntake(homeVariant ? { ...d, equipment: homeVariant.equipment as EquipTag[] } : d, history);
      if (homeVariant) setRoutineId(null);
      if (!full) {
        setWizard(missingFields(d));
        return;
      }
      const result = generatePlan(full, lib);
      if (result.status === 'hold') {
        setHold(result.screening);
        return;
      }
      setHold(null);
      setPlan(result.plan);
      setDirty(true);
      writeLocalPlan(result.plan);
      setTab('plan');
    },
    [lib, history, profileAvailable, homeVariant],
  );

  const applyAction = useCallback(
    (a: PlanAction): string | null => {
      if (!plan || !lib || !intake || !screening) return 'Build your plan first.';
      const res = applyPlanAction(plan, a, lib, usableContextFor(intake, screening), screening);
      if (!res.ok) return res.message.replace(/^Not changed: /, '');
      setPlan(res.plan);
      setDirty(true);
      writeLocalPlan(res.plan);
      setToast(res.message);
      return null;
    },
    [plan, lib, intake, screening],
  );

  const save = async () => {
    if (!plan) return;
    setSaving(true);
    setActionError(null);
    try {
      const id = await savePlanAsRoutine(plan, { replacePlanId: routineId, source: 'engine' });
      setRoutineId(id);
      setDirty(false);
      writeLocalPlan(null);
      setToast('Saved to My routines and set as your active routine');
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not save the routine.');
    } finally {
      setSaving(false);
    }
  };

  const downloadPdf = () => {
    if (!plan) return;
    if (!hasFeature('biometric')) {
      setShowUpgrade(true);
      return;
    }
    try {
      const bytes = renderPlanPdf(plan, { personName: profile?.display_name ?? null });
      downloadBlob(new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' }), planPdfFilename(plan));
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not create the PDF.');
    }
  };

  const exerciseName = useCallback((id: string) => lib?.byId.get(id)?.name ?? 'Exercise', [lib]);

  if (loading) {
    return (
      <Page>
        <PageHeader title="Training coach" onBack={() => navigate('/training')} />
        <LoadingState label="Loading your training data…" />
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        title="Training coach"
        subtitle="Plans built from studies, your body and your training"
        onBack={() => navigate('/training')}
        right={
          <button
            type="button"
            onClick={() => navigate('/memory')}
            aria-label="What the app remembers"
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink-elevated text-cloud-dim hover:text-lime"
          >
            <Brain className="h-5 w-5" />
          </button>
        }
      />

      {loadError && <Notice tone="danger" title="Something went wrong">{loadError}</Notice>}
      {!profileAvailable && (
        <div className="mb-4">
          <Notice tone="warn" title="Database update needed">
            Saving your answers and routines needs the migration <code className="text-cloud">20261014091000_training_brain.sql</code>. You can still build and view a plan.
          </Notice>
        </div>
      )}

      {homeVariant && !wizard && (
        <div className="mb-4">
          <Notice tone="info" title="You're training at home">
            Your active routine is the home version of “{homeVariant.sourceName}” ({homeVariant.equipment.map((e) => EQUIP_LABELS[e as EquipTag] ?? e).join(', ').toLowerCase()}). The plan shown is your gym plan; rebuilding here makes a new plan for your home equipment. The coach knows you are training at home.
          </Notice>
        </div>
      )}

      {wizard ? (
        <IntakeWizard
          draft={draft}
          steps={wizard}
          onChange={setDraft}
          onDone={(d) => void build(d)}
          onCancel={plan ? () => setWizard(null) : undefined}
        />
      ) : hold ? (
        <div className="space-y-4">
          <Notice tone="danger" title="Please check with a clinician first">
            <ul className="mt-1 list-disc space-y-1 pl-4">
              {hold.holdReasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </Notice>
          {hold.notes.map((n, i) => (
            <p key={i} className="text-xs text-cloud-dim">{n}</p>
          ))}
          <button type="button" onClick={() => setWizard(['screening', 'pain'])} className="w-full rounded-xl bg-ink-elevated py-3 text-sm font-semibold text-cloud">
            Review my health answers
          </button>
          <button type="button" onClick={() => setTab('coach')} className="w-full rounded-xl border border-ink-border py-3 text-sm text-cloud-dim">
            Ask the coach a question instead
          </button>
          {tab === 'coach' && (
            <AiConsentGate>
              <CoachChat plan={null} draft={draft} missing={missing} history={history} exerciseName={exerciseName} onApplyAction={() => 'No plan yet.'} onOpenExercise={(id) => navigate(`/exercise/${id}`)} />
            </AiConsentGate>
          )}
        </div>
      ) : (
        <>
          <div className="mb-4">
            <Segmented
              options={[
                { value: 'plan', label: 'My plan' },
                { value: 'coach', label: 'Ask the coach' },
              ]}
              value={tab}
              onChange={setTab}
            />
          </div>

          {tab === 'plan' ? (
            plan ? (
              <>
                {dirty && (
                  <div className="mb-3">
                    <Notice tone="info" title={routineId ? 'You have unsaved changes' : 'Not saved yet'}>
                      Save it to start the sessions, log them and track it in My routines.
                    </Notice>
                  </div>
                )}
                <div className="mb-4 grid grid-cols-3 gap-2">
                  <button type="button" onClick={() => void save()} disabled={saving || (!dirty && !!routineId)} className="flex flex-col items-center gap-1 rounded-xl bg-lime px-2 py-2.5 text-[11px] font-bold text-ink-bg disabled:opacity-50">
                    <Save className="h-4 w-4" /> {routineId && !dirty ? 'Saved' : saving ? 'Saving…' : 'Save routine'}
                  </button>
                  <button type="button" onClick={downloadPdf} className="flex flex-col items-center gap-1 rounded-xl bg-ink-elevated px-2 py-2.5 text-[11px] font-semibold text-cloud">
                    {hasFeature('biometric') ? <Download className="h-4 w-4" /> : <Lock className="h-4 w-4" />} PDF
                  </button>
                  <button type="button" onClick={() => setWizard(ALL_STEPS)} className="flex flex-col items-center gap-1 rounded-xl bg-ink-elevated px-2 py-2.5 text-[11px] font-semibold text-cloud">
                    <SlidersHorizontal className="h-4 w-4" /> Edit answers
                  </button>
                </div>
                {actionError && <p className="mb-3 text-xs text-rust">{actionError}</p>}
                {fitIssues.length > 0 && (
                  <div className="mb-3">
                    <Notice tone="warn" title="Parts of this plan do not fit your answers" action={<button type="button" className="text-xs font-semibold text-lime" onClick={() => void build(draft)}>Rebuild for me</button>}>
                      <ul className="list-disc space-y-0.5 pl-4">
                        {fitIssues.slice(0, 5).map((i, k) => (
                          <li key={k}>{i.message}</li>
                        ))}
                      </ul>
                    </Notice>
                  </div>
                )}
                {screening?.status === 'medical_first' && (
                  <div className="mb-3">
                    <Notice tone="danger" title="Please check with a clinician first">
                      {screening.holdReasons[0]} Review your health answers before training with this plan.
                    </Notice>
                  </div>
                )}
                {missing.length > 0 && (
                  <div className="mb-3">
                    <Notice tone="warn" title="Some answers are out of date" action={<button type="button" className="text-xs font-semibold text-lime" onClick={() => setWizard(missing)}>Update</button>}>
                      Your health check is older than 6 months or something is missing. Updating keeps the plan safe.
                    </Notice>
                  </div>
                )}
                <PlanView
                  plan={plan}
                  onAction={applyAction}
                  onStartDay={routineId && !dirty && screening?.status !== 'medical_first' ? (day) => navigate(`/workout/${routineId}?day=${day}`) : undefined}
                  onOpenExercise={(id) => navigate(`/exercise/${id}`)}
                />
                <button type="button" onClick={() => void (intake ? build(draft) : setWizard(missing))} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-ink-border py-3 text-sm text-cloud-dim">
                  <RefreshCw className="h-4 w-4" /> Rebuild from my answers
                </button>
              </>
            ) : (
              <div className="rounded-2xl border border-lime/25 bg-lime/5 p-5 text-center">
                <Sparkles className="mx-auto h-8 w-8 text-lime" />
                <p className="mt-2 text-sm font-semibold text-cloud">Build your plan</p>
                <p className="mt-1 text-xs text-cloud-dim">A few questions; the app only asks what it does not already know.</p>
                <button type="button" onClick={() => (missing.length ? setWizard(missing) : void build(draft))} className="mt-4 rounded-xl bg-lime px-5 py-3 text-sm font-bold text-ink-bg">
                  Start
                </button>
              </div>
            )
          ) : (
            <AiConsentGate>
              <CoachChat
                plan={plan}
                draft={draft}
                missing={missing}
                history={history}
                exerciseName={exerciseName}
                onApplyAction={applyAction}
                onOpenExercise={(id) => navigate(`/exercise/${id}`)}
              />
            </AiConsentGate>
          )}
        </>
      )}

      <StripeUpgradeModal open={showUpgrade} currentTier={tier} onClose={() => setShowUpgrade(false)} />
      <Toast message={toast} onDone={() => setToast(null)} />
    </Page>
  );
}
