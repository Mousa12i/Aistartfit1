import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/Button';
import { ChevronLeft, ChevronRight, Check, Flame, Dumbbell, Home as HomeIcon, TreePine, Clock, Heart, Activity, Ruler, Weight } from 'lucide-react';
import type { FitnessGoal, ExperienceLevel, TrainingLocation, Equipment, ActivityLevel, UnitSystem } from '@/lib/types';
import { cn, ACTIVITY_LABELS } from '@/lib/utils';

const GOALS: { value: FitnessGoal; label: string; desc: string; icon: typeof Flame }[] = [
  { value: 'fat_loss', label: 'Fat Loss', desc: 'Burn calories, get lean', icon: Flame },
  { value: 'muscle_gain', label: 'Muscle Gain', desc: 'Build size and mass', icon: Dumbbell },
  { value: 'strength', label: 'Strength', desc: 'Get stronger faster', icon: Dumbbell },
  { value: 'endurance', label: 'Endurance', desc: 'Build stamina & cardio', icon: Heart },
  { value: 'general_fitness', label: 'General Fitness', desc: 'Stay fit and healthy', icon: Heart },
];

const EXPERIENCE: { value: ExperienceLevel; label: string; desc: string }[] = [
  { value: 'beginner', label: 'Beginner', desc: 'New to training' },
  { value: 'intermediate', label: 'Intermediate', desc: '1-2 years experience' },
  { value: 'advanced', label: 'Advanced', desc: '3+ years consistent training' },
];

const LOCATIONS: { value: TrainingLocation; label: string; icon: typeof HomeIcon }[] = [
  { value: 'gym', label: 'Gym', icon: Dumbbell },
  { value: 'home', label: 'Home', icon: HomeIcon },
  { value: 'outdoor', label: 'Outdoor', icon: TreePine },
];

const EQUIPMENT: { value: Equipment; label: string }[] = [
  { value: 'none', label: 'Bodyweight only' },
  { value: 'dumbbells', label: 'Dumbbells' },
  { value: 'barbell', label: 'Barbell' },
  { value: 'kettlebell', label: 'Kettlebell' },
  { value: 'resistance_bands', label: 'Resistance bands' },
  { value: 'pull_up_bar', label: 'Pull-up bar' },
  { value: 'bench', label: 'Bench' },
  { value: 'machine', label: 'Machines' },
];

const ACTIVITY_LEVELS: { value: ActivityLevel; label: string; desc: string }[] = [
  { value: 'sedentary', label: 'Sedentary', desc: 'Little to no exercise' },
  { value: 'light', label: 'Lightly Active', desc: 'Light exercise 1-3 days/week' },
  { value: 'moderate', label: 'Moderately Active', desc: 'Moderate exercise 3-5 days/week' },
  { value: 'active', label: 'Very Active', desc: 'Hard exercise 6-7 days/week' },
  { value: 'very_active', label: 'Athlete', desc: 'Training 2x per day' },
];

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DURATIONS = [15, 30, 45, 60, 90];

interface OnboardingSetupProps {
  onComplete: () => void;
  onBack: () => void;
}

export function OnboardingSetup({ onComplete, onBack }: OnboardingSetupProps) {
  const { updateProfile, profile } = useAuth();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [goal, setGoal] = useState<FitnessGoal | null>(profile?.fitness_goal ?? null);
  const [experience, setExperience] = useState<ExperienceLevel | null>(profile?.experience_level ?? null);
  const [location, setLocation] = useState<TrainingLocation | null>(profile?.training_location ?? null);
  const [equipment, setEquipment] = useState<Equipment[]>(profile?.preferred_equipment ?? []);
  const [days, setDays] = useState<string[]>(profile?.preferred_days ?? []);
  const [duration, setDuration] = useState<number | null>(profile?.session_duration_min ?? null);
  const [limitations, setLimitations] = useState<string>(profile?.limitations ?? '');

  // New personal metrics
  const [age, setAge] = useState<string>(profile?.age?.toString() ?? '');
  const [heightCm, setHeightCm] = useState<string>(profile?.height_cm?.toString() ?? '');
  const [weightKg, setWeightKg] = useState<string>(profile?.weight_kg?.toString() ?? '');
  const [unitSystem, setUnitSystem] = useState<UnitSystem>(profile?.unit_system ?? 'metric');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel | null>(profile?.activity_level ?? null);

  const totalSteps = 7;
  const progress = ((step + 1) / totalSteps) * 100;

  const toggleEquipment = (item: Equipment) => {
    setEquipment((prev) =>
      prev.includes(item) ? prev.filter((e) => e !== item) : [...prev, item]
    );
  };

  const toggleDay = (day: string) => {
    setDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const canProceed = () => {
    if (step === 0) return goal !== null;
    if (step === 1) return experience !== null;
    if (step === 2) return location !== null;
    if (step === 3) return equipment.length > 0;
    if (step === 4) return days.length > 0 && duration !== null;
    if (step === 5) return age !== '' && heightCm !== '' && weightKg !== '' && activityLevel !== null;
    return true;
  };

  const handleNext = async () => {
    if (step < totalSteps - 1) {
      setStep((s) => s + 1);
      return;
    }
    setSaving(true);
    setError(null);

    let heightVal = heightCm ? parseFloat(heightCm) : null;
    let weightVal = weightKg ? parseFloat(weightKg) : null;

    if (unitSystem === 'imperial') {
      if (heightVal) heightVal = heightVal * 2.54;
      if (weightVal) weightVal = weightVal / 2.20462;
    }

    const { error: updateError } = await updateProfile({
      fitness_goal: goal,
      experience_level: experience,
      training_location: location,
      preferred_equipment: equipment,
      preferred_days: days,
      session_duration_min: duration,
      limitations: limitations.trim() || null,
      age: age ? parseInt(age) : null,
      height_cm: heightVal,
      weight_kg: weightVal,
      activity_level: activityLevel,
      unit_system: unitSystem,
      onboarding_completed: true,
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
          onClick={() => (step === 0 ? onBack() : setStep((s) => s - 1))}
          className="w-10 h-10 rounded-xl bg-ink-elevated flex items-center justify-center text-cloud-dim hover:text-cloud transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 h-2 bg-ink-elevated rounded-full overflow-hidden">
          <div
            className="h-full bg-lime-gradient rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-xs text-cloud-dim tabular-nums w-10 text-right">{step + 1}/{totalSteps}</span>
      </div>

      <div className="flex-1 px-5 py-6 overflow-y-auto">
        {step === 0 && (
          <StepContainer title="What's your main goal?" subtitle="We'll tailor your workouts to match.">
            <div className="flex flex-col gap-3">
              {GOALS.map((g) => (
                <OptionCard
                  key={g.value}
                  label={g.label}
                  desc={g.desc}
                  icon={<g.icon className="w-5 h-5" />}
                  active={goal === g.value}
                  onClick={() => setGoal(g.value)}
                />
              ))}
            </div>
          </StepContainer>
        )}

        {step === 1 && (
          <StepContainer title="Your experience level" subtitle="So we can set the right intensity.">
            <div className="flex flex-col gap-3">
              {EXPERIENCE.map((e) => (
                <OptionCard
                  key={e.value}
                  label={e.label}
                  desc={e.desc}
                  active={experience === e.value}
                  onClick={() => setExperience(e.value)}
                />
              ))}
            </div>
          </StepContainer>
        )}

        {step === 2 && (
          <StepContainer title="Where do you train?" subtitle="This affects your exercise recommendations.">
            <div className="grid grid-cols-3 gap-3">
              {LOCATIONS.map((l) => (
                <button
                  key={l.value}
                  onClick={() => setLocation(l.value)}
                  className={cn(
                    'flex flex-col items-center gap-3 py-6 rounded-xl2 border transition-all',
                    location === l.value
                      ? 'bg-lime/10 border-lime text-lime'
                      : 'bg-ink-surface border-ink-border text-cloud-dim hover:border-ink-elevated'
                  )}
                >
                  <l.icon className="w-7 h-7" strokeWidth={1.8} />
                  <span className="text-sm font-medium">{l.label}</span>
                </button>
              ))}
            </div>
          </StepContainer>
        )}

        {step === 3 && (
          <StepContainer title="Available equipment" subtitle="Select all that apply to your setup.">
            <div className="flex flex-col gap-2.5">
              {EQUIPMENT.map((e) => (
                <CheckOption
                  key={e.value}
                  label={e.label}
                  checked={equipment.includes(e.value)}
                  onClick={() => toggleEquipment(e.value)}
                />
              ))}
            </div>
          </StepContainer>
        )}

        {step === 4 && (
          <StepContainer title="Training schedule" subtitle="Pick your preferred days and session length.">
            <p className="text-sm text-cloud-dim mb-3">Preferred training days</p>
            <div className="flex gap-2 mb-6">
              {DAYS.map((day) => (
                <button
                  key={day}
                  onClick={() => toggleDay(day)}
                  className={cn(
                    'flex-1 py-2.5 rounded-lg text-xs font-medium transition-all',
                    days.includes(day)
                      ? 'bg-lime text-ink-bg'
                      : 'bg-ink-elevated text-cloud-dim border border-ink-border'
                  )}
                >
                  {day}
                </button>
              ))}
            </div>
            <p className="text-sm text-cloud-dim mb-3">Session duration</p>
            <div className="flex gap-2.5 flex-wrap">
              {DURATIONS.map((d) => (
                <button
                  key={d}
                  onClick={() => setDuration(d)}
                  className={cn(
                    'flex items-center gap-1.5 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all',
                    duration === d
                      ? 'bg-lime/10 border-lime text-lime'
                      : 'bg-ink-surface border-ink-border text-cloud-dim'
                  )}
                >
                  <Clock className="w-4 h-4" />
                  {d} min
                </button>
              ))}
            </div>
          </StepContainer>
        )}

        {step === 5 && (
          <StepContainer title="Your body metrics" subtitle="This helps us calculate your needs accurately.">
            {/* Unit system toggle */}
            <p className="text-sm text-cloud-dim mb-2">Measurement units</p>
            <div className="flex bg-ink-elevated rounded-xl p-1 mb-5">
              <button
                onClick={() => setUnitSystem('metric')}
                className={cn(
                  'flex-1 py-2.5 rounded-lg text-sm font-medium transition-all',
                  unitSystem === 'metric' ? 'bg-lime text-ink-bg' : 'text-cloud-dim'
                )}
              >
                Metric (cm/kg)
              </button>
              <button
                onClick={() => setUnitSystem('imperial')}
                className={cn(
                  'flex-1 py-2.5 rounded-lg text-sm font-medium transition-all',
                  unitSystem === 'imperial' ? 'bg-lime text-ink-bg' : 'text-cloud-dim'
                )}
              >
                Imperial (ft/lbs)
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-5">
              <MetricInput
                icon={<Activity className="w-4 h-4" />}
                label="Age"
                value={age}
                onChange={setAge}
                placeholder="25"
                suffix="yrs"
              />
              <MetricInput
                icon={<Ruler className="w-4 h-4" />}
                label="Height"
                value={heightCm}
                onChange={setHeightCm}
                placeholder={unitSystem === 'metric' ? '175' : "5'9\""}
                suffix={unitSystem === 'metric' ? 'cm' : 'in'}
              />
              <MetricInput
                icon={<Weight className="w-4 h-4" />}
                label="Weight"
                value={weightKg}
                onChange={setWeightKg}
                placeholder={unitSystem === 'metric' ? '75' : '165'}
                suffix={unitSystem === 'metric' ? 'kg' : 'lbs'}
              />
            </div>

            <p className="text-sm text-cloud-dim mb-3">Activity level</p>
            <div className="flex flex-col gap-2.5">
              {ACTIVITY_LEVELS.map((a) => (
                <OptionCard
                  key={a.value}
                  label={a.label}
                  desc={a.desc}
                  active={activityLevel === a.value}
                  onClick={() => setActivityLevel(a.value)}
                />
              ))}
            </div>
          </StepContainer>
        )}

        {step === 6 && (
          <StepContainer title="Any training limitations?" subtitle="Optional — helps us suggest safer exercises. Your data stays private to you.">
            <textarea
              value={limitations}
              onChange={(e) => setLimitations(e.target.value)}
              placeholder="e.g. bad knee, lower back pain, shoulder injury..."
              className="w-full bg-ink-elevated border border-ink-border rounded-xl text-cloud placeholder:text-cloud-dim/50 px-4 py-3 text-sm resize-none focus:outline-none focus:border-lime/50 min-h-[120px]"
            />
            <div className="mt-4 p-4 rounded-xl bg-ink-muted border border-ink-border">
              <p className="text-xs text-cloud-dim leading-relaxed">
                This information is stored securely with your profile and is only visible to you. It is not shared with other users. The AI Coach may use it to provide safer recommendations.
              </p>
            </div>

            {/* Summary */}
            <div className="mt-6 p-4 rounded-xl2 bg-ink-elevated border border-ink-border">
              <p className="text-xs font-semibold text-cloud mb-3">Your Profile Summary</p>
              <div className="flex flex-col gap-2">
                <SummaryRow label="Goal" value={goal ? GOALS.find(g => g.value === goal)?.label ?? '—' : '—'} />
                <SummaryRow label="Experience" value={experience ?? '—'} />
                <SummaryRow label="Location" value={location ?? '—'} />
                <SummaryRow label="Equipment" value={`${equipment.length} selected`} />
                <SummaryRow label="Days/week" value={`${days.length} days`} />
                <SummaryRow label="Session length" value={duration ? `${duration} min` : '—'} />
                <SummaryRow label="Activity" value={activityLevel ? ACTIVITY_LABELS[activityLevel] : '—'} />
              </div>
            </div>
          </StepContainer>
        )}
      </div>

      <div className="px-5 pb-8 pt-3 border-t border-ink-border safe-bottom">
        {error && <p className="text-xs text-rust mb-2 text-center">{error}</p>}
        <Button size="lg" onClick={handleNext} loading={saving} disabled={!canProceed()} className="w-full">
          {step === totalSteps - 1 ? 'Complete Setup' : 'Continue'}
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
}

function StepContainer({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="animate-fade-in-up">
      <h2 className="text-display-md text-cloud mb-1">{title}</h2>
      <p className="text-sm text-cloud-dim mb-6">{subtitle}</p>
      {children}
    </div>
  );
}

function OptionCard({ label, desc, icon, active, onClick }: { label: string; desc: string; icon?: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-4 p-4 rounded-xl2 border text-left transition-all active:scale-[0.99]',
        active ? 'bg-lime/10 border-lime' : 'bg-ink-surface border-ink-border hover:border-ink-elevated'
      )}
    >
      {icon && (
        <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center', active ? 'bg-lime text-ink-bg' : 'bg-ink-elevated text-cloud-dim')}>
          {icon}
        </div>
      )}
      <div className="flex-1">
        <p className={cn('font-semibold text-sm', active ? 'text-lime' : 'text-cloud')}>{label}</p>
        <p className="text-xs text-cloud-dim mt-0.5">{desc}</p>
      </div>
      {active && <Check className="w-5 h-5 text-lime" />}
    </button>
  );
}

function CheckOption({ label, checked, onClick }: { label: string; checked: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center justify-between p-3.5 rounded-xl border transition-all',
        checked ? 'bg-lime/10 border-lime/50' : 'bg-ink-surface border-ink-border'
      )}
    >
      <span className={cn('text-sm font-medium', checked ? 'text-lime' : 'text-cloud')}>{label}</span>
      <div className={cn('w-5 h-5 rounded-md border flex items-center justify-center transition-all', checked ? 'bg-lime border-lime' : 'border-ink-border')}>
        {checked && <Check className="w-3.5 h-3.5 text-ink-bg" strokeWidth={3} />}
      </div>
    </button>
  );
}

function MetricInput({ icon, label, value, onChange, placeholder, suffix }: { icon: React.ReactNode; label: string; value: string; onChange: (v: string) => void; placeholder: string; suffix: string }) {
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
      <span className="text-xs text-cloud font-medium capitalize">{value}</span>
    </div>
  );
}
