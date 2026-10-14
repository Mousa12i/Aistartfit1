import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/Button';
import {
  ChevronLeft, ChevronRight, Check, Ruler, Weight, Activity,
  Shield, Dumbbell, Home as HomeIcon, Heart, AlertTriangle, Target,
} from 'lucide-react';
import type { PhysiqueGoal } from '@/lib/types';
import { cn } from '@/lib/utils';

interface BiometricAssessmentProps {
  onBack: () => void;
  onComplete: () => void;
}

const PHYSIQUE_GOALS: { value: PhysiqueGoal; label: string; desc: string; icon: typeof Target }[] = [
  { value: 'hypertrophy', label: 'Hypertrophy', desc: 'Maximise muscle size', icon: Dumbbell },
  { value: 'fat_loss', label: 'Fat Loss', desc: 'Lean out and define', icon: Activity },
  { value: 'powerlifting', label: 'Powerlifting', desc: 'Maximise raw strength', icon: Weight },
  { value: 'recomposition', label: 'Recomposition', desc: 'Lose fat, build muscle', icon: Heart },
  { value: 'general', label: 'General Fitness', desc: 'Overall improvement', icon: Target },
];

const JOINT_ISSUES = [
  { id: 'lower_back', label: 'Lower Back' },
  { id: 'knees', label: 'Knees' },
  { id: 'shoulders', label: 'Shoulders' },
  { id: 'wrists', label: 'Wrists' },
  { id: 'neck', label: 'Neck' },
  { id: 'hips', label: 'Hips' },
  { id: 'ankles', label: 'Ankles' },
  { id: 'elbows', label: 'Elbows' },
];

const EQUIPMENT_OPTIONS = [
  { value: 'full_gym', label: 'Full Gym Access', icon: Dumbbell },
  { value: 'dumbbells', label: 'Dumbbells Only', icon: Weight },
  { value: 'bodyweight', label: 'Bodyweight Only', icon: HomeIcon },
];

export function BiometricAssessment({ onBack, onComplete }: BiometricAssessmentProps) {
  const { updateProfile, profile } = useAuth();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [weightKg, setWeightKg] = useState(profile?.weight_kg?.toString() ?? '');
  const [heightCm, setHeightCm] = useState(profile?.height_cm?.toString() ?? '');
  const [bodyFat, setBodyFat] = useState(profile?.body_fat_pct?.toString() ?? '');
  const [physiqueGoal, setPhysiqueGoal] = useState<PhysiqueGoal | null>(profile?.physique_goal ?? null);
  const [jointIssues, setJointIssues] = useState<string[]>([]);
  const [limitationsText, setLimitationsText] = useState(profile?.limitations ?? '');
  const [equipment, setEquipment] = useState<string>('full_gym');

  const totalSteps = 5;
  const progress = ((step + 1) / totalSteps) * 100;

  const toggleJoint = (id: string) => {
    setJointIssues((prev) => prev.includes(id) ? prev.filter((j) => j !== id) : [...prev, id]);
  };

  const canProceed = () => {
    if (step === 0) return weightKg !== '' && heightCm !== '';
    if (step === 1) return bodyFat !== '';
    if (step === 2) return physiqueGoal !== null;
    if (step === 3) return equipment !== '';
    return true;
  };

  const handleNext = async () => {
    if (step < totalSteps - 1) {
      setStep((s) => s + 1);
      return;
    }
    setSaving(true);
    setError(null);

    const jointSummary = jointIssues.length > 0
      ? `Joint concerns: ${jointIssues.join(', ')}.${limitationsText.trim() ? ' ' + limitationsText.trim() : ''}`
      : limitationsText.trim() || null;

    const { error: updateError } = await updateProfile({
      weight_kg: weightKg ? parseFloat(weightKg) : null,
      height_cm: heightCm ? parseFloat(heightCm) : null,
      body_fat_pct: bodyFat ? parseFloat(bodyFat) : null,
      physique_goal: physiqueGoal,
      limitations: jointSummary,
    });

    setSaving(false);
    if (updateError) {
      setError(updateError);
      return;
    }
    onComplete();
  };

  return (
    <div className="min-h-screen bg-ink-bg flex flex-col safe-top">
      <div className="px-5 pt-5 pb-3 flex items-center gap-3">
        <button
          onClick={() => step === 0 ? onBack() : setStep((s) => s - 1)}
          className="w-10 h-10 rounded-xl bg-ink-elevated flex items-center justify-center text-cloud-dim hover:text-cloud transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 h-2 bg-ink-elevated rounded-full overflow-hidden">
          <div className="h-full bg-lime-gradient rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
        <span className="text-xs text-cloud-dim tabular-nums w-10 text-right">{step + 1}/{totalSteps}</span>
      </div>

      <div className="flex-1 px-5 py-6 overflow-y-auto">
        {step === 0 && (
          <div className="animate-fade-in-up">
            <h2 className="text-display-md text-cloud mb-1">Body Metrics</h2>
            <p className="text-sm text-cloud-dim mb-6">Your physical baseline for AI-driven programming.</p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <MetricField icon={<Weight className="w-4 h-4" />} label="Weight" value={weightKg} onChange={setWeightKg} placeholder="75" suffix="kg" />
              <MetricField icon={<Ruler className="w-4 h-4" />} label="Height" value={heightCm} onChange={setHeightCm} placeholder="175" suffix="cm" />
            </div>
            <div className="p-4 rounded-xl bg-sky/5 border border-sky/20 mt-4">
              <p className="text-xs text-cloud-dim leading-relaxed">These numbers feed directly into the o3 AI engine for calorie targets, macro splits, and progressive overload calculations.</p>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="animate-fade-in-up">
            <h2 className="text-display-md text-cloud mb-1">Body Fat Estimate</h2>
            <p className="text-sm text-cloud-dim mb-6">Used for precise caloric targeting and physique tracking.</p>
            <div className="flex items-center gap-3 mb-6">
              <div className="flex-1 relative">
                <input
                  type="text"
                  inputMode="numeric"
                  value={bodyFat}
                  onChange={(e) => setBodyFat(e.target.value.replace(/[^0-9.]/g, ''))}
                  placeholder="18"
                  className="w-full bg-ink-elevated border border-ink-border rounded-xl px-4 py-4 text-2xl text-cloud text-center font-bold focus:outline-none focus:border-lime/50"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-cloud-dim">%</span>
              </div>
            </div>
            <div className="space-y-2">
              {[
                { range: '8-12%', label: 'Athletic / Lean' },
                { range: '13-17%', label: 'Fit / Moderate' },
                { range: '18-24%', label: 'Average' },
                { range: '25%+', label: 'Higher body fat' },
              ].map((bf) => (
                <button
                  key={bf.range}
                  onClick={() => setBodyFat(bf.range.split('-')[0].replace('%', '').replace('+', ''))}
                  className="w-full flex items-center justify-between p-3.5 rounded-xl bg-ink-surface border border-ink-border hover:border-lime/30 transition-all"
                >
                  <span className="text-sm text-cloud font-medium">{bf.range}</span>
                  <span className="text-xs text-cloud-dim">{bf.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="animate-fade-in-up">
            <h2 className="text-display-md text-cloud mb-1">Physique Goal</h2>
            <p className="text-sm text-cloud-dim mb-6">What transformation are you targeting?</p>
            <div className="flex flex-col gap-3">
              {PHYSIQUE_GOALS.map((g) => (
                <button
                  key={g.value}
                  onClick={() => setPhysiqueGoal(g.value)}
                  className={cn(
                    'flex items-center gap-4 p-4 rounded-xl2 border text-left transition-all active:scale-[0.99]',
                    physiqueGoal === g.value ? 'bg-lime/10 border-lime' : 'bg-ink-surface border-ink-border hover:border-ink-elevated'
                  )}
                >
                  <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center', physiqueGoal === g.value ? 'bg-lime text-ink-bg' : 'bg-ink-elevated text-cloud-dim')}>
                    <g.icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <p className={cn('font-semibold text-sm', physiqueGoal === g.value ? 'text-lime' : 'text-cloud')}>{g.label}</p>
                    <p className="text-xs text-cloud-dim mt-0.5">{g.desc}</p>
                  </div>
                  {physiqueGoal === g.value && <Check className="w-5 h-5 text-lime" />}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="animate-fade-in-up">
            <h2 className="text-display-md text-cloud mb-1">Joint & Injury Profile</h2>
            <p className="text-sm text-cloud-dim mb-6">The AI will automatically avoid problematic movements.</p>
            <div className="grid grid-cols-2 gap-2.5 mb-5">
              {JOINT_ISSUES.map((joint) => (
                <button
                  key={joint.id}
                  onClick={() => toggleJoint(joint.id)}
                  className={cn(
                    'flex items-center gap-2.5 p-3.5 rounded-xl border transition-all',
                    jointIssues.includes(joint.id) ? 'bg-rust/10 border-rust/50' : 'bg-ink-surface border-ink-border'
                  )}
                >
                  <div className={cn('w-5 h-5 rounded-md border flex items-center justify-center', jointIssues.includes(joint.id) ? 'bg-rust border-rust' : 'border-ink-border')}>
                    {jointIssues.includes(joint.id) && <AlertTriangle className="w-3 h-3 text-white" />}
                  </div>
                  <span className={cn('text-sm font-medium', jointIssues.includes(joint.id) ? 'text-rust' : 'text-cloud')}>{joint.label}</span>
                </button>
              ))}
            </div>
            <textarea
              value={limitationsText}
              onChange={(e) => setLimitationsText(e.target.value)}
              placeholder="Describe any specific injuries, pain triggers, or movements to avoid..."
              className="w-full bg-ink-elevated border border-ink-border rounded-xl text-cloud placeholder:text-cloud-dim/50 px-4 py-3 text-sm resize-none focus:outline-none focus:border-lime/50 min-h-[100px]"
            />
            <div className="mt-4 p-4 rounded-xl bg-gold/5 border border-gold/20">
              <div className="flex items-start gap-3">
                <Shield className="w-4 h-4 text-gold flex-shrink-0 mt-0.5" />
                <p className="text-xs text-cloud-dim leading-relaxed">If you select "Lower Back", the AI will replace barbell squats and deadlifts with leg presses and hip thrusts. Shoulder issues will swap overhead presses for landmine presses.</p>
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="animate-fade-in-up">
            <h2 className="text-display-md text-cloud mb-1">Available Equipment</h2>
            <p className="text-sm text-cloud-dim mb-6">Determines which exercises the AI can select for you.</p>
            <div className="flex flex-col gap-3">
              {EQUIPMENT_OPTIONS.map((eq) => (
                <button
                  key={eq.value}
                  onClick={() => setEquipment(eq.value)}
                  className={cn(
                    'flex items-center gap-4 p-5 rounded-xl2 border transition-all',
                    equipment === eq.value ? 'bg-lime/10 border-lime' : 'bg-ink-surface border-ink-border hover:border-ink-elevated'
                  )}
                >
                  <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center', equipment === eq.value ? 'bg-lime text-ink-bg' : 'bg-ink-elevated text-cloud-dim')}>
                    <eq.icon className="w-6 h-6" />
                  </div>
                  <span className={cn('font-semibold text-sm', equipment === eq.value ? 'text-lime' : 'text-cloud')}>{eq.label}</span>
                  {equipment === eq.value && <Check className="w-5 h-5 text-lime ml-auto" />}
                </button>
              ))}
            </div>

            <div className="mt-6 p-4 rounded-xl2 bg-ink-elevated border border-ink-border">
              <p className="text-xs font-semibold text-cloud mb-3">Assessment Summary</p>
              <div className="flex flex-col gap-2">
                <SummaryRow label="Weight" value={weightKg ? `${weightKg} kg` : '—'} />
                <SummaryRow label="Height" value={heightCm ? `${heightCm} cm` : '—'} />
                <SummaryRow label="Body Fat" value={bodyFat ? `${bodyFat}%` : '—'} />
                <SummaryRow label="Goal" value={physiqueGoal ? PHYSIQUE_GOALS.find(g => g.value === physiqueGoal)?.label ?? '—' : '—'} />
                <SummaryRow label="Joint Issues" value={jointIssues.length > 0 ? `${jointIssues.length} flagged` : 'None'} />
                <SummaryRow label="Equipment" value={EQUIPMENT_OPTIONS.find(e => e.value === equipment)?.label ?? '—'} />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="px-5 pb-8 pt-3 border-t border-ink-border safe-bottom">
        {error && <p className="text-xs text-rust mb-2 text-center">{error}</p>}
        <Button size="lg" onClick={handleNext} loading={saving} disabled={!canProceed()} className="w-full">
          {step === totalSteps - 1 ? 'Save Assessment' : 'Continue'}
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
}

function MetricField({ icon, label, value, onChange, placeholder, suffix }: { icon: React.ReactNode; label: string; value: string; onChange: (v: string) => void; placeholder: string; suffix: string }) {
  return (
    <div className="flex flex-col">
      <label className="text-[10px] text-cloud-dim mb-1.5 flex items-center gap-1">
        <span className="text-lime">{icon}</span>
        {label}
      </label>
      <div className="relative">
        <input
          type="text"
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ''))}
          placeholder={placeholder}
          className="w-full bg-ink-elevated border border-ink-border rounded-lg px-3 py-2.5 text-sm text-cloud text-center focus:outline-none focus:border-lime/50"
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-cloud-dim">{suffix}</span>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-cloud-dim">{label}</span>
      <span className="text-xs text-cloud font-medium">{value}</span>
    </div>
  );
}
