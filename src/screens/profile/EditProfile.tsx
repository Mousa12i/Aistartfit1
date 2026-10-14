import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { ChevronLeft, Check, AlertCircle } from 'lucide-react';
import type { FitnessGoal, ExperienceLevel, TrainingLocation, Equipment } from '@/lib/types';
import { cn, GOAL_LABELS, EXPERIENCE_LABELS, EQUIPMENT_LABELS } from '@/lib/utils';

interface EditProfileProps {
  onBack: () => void;
}

const GOALS: FitnessGoal[] = ['fat_loss', 'muscle_gain', 'strength', 'endurance', 'general_fitness'];
const EXPERIENCE: ExperienceLevel[] = ['beginner', 'intermediate', 'advanced'];
const LOCATIONS: TrainingLocation[] = ['gym', 'home', 'outdoor'];
const EQUIPMENT: Equipment[] = ['none', 'dumbbells', 'barbell', 'kettlebell', 'resistance_bands', 'pull_up_bar', 'bench', 'machine'];

export function EditProfile({ onBack }: EditProfileProps) {
  const { profile, updateProfile } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [fitnessGoal, setFitnessGoal] = useState<FitnessGoal | null>(profile?.fitness_goal ?? null);
  const [experience, setExperience] = useState<ExperienceLevel | null>(profile?.experience_level ?? null);
  const [location, setLocation] = useState<TrainingLocation | null>(profile?.training_location ?? null);
  const [equipment, setEquipment] = useState<Equipment[]>(profile?.preferred_equipment ?? []);
  const [limitations, setLimitations] = useState(profile?.limitations ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const toggleEquipment = (item: Equipment) => {
    setEquipment((prev) => (prev.includes(item) ? prev.filter((e) => e !== item) : [...prev, item]));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    const { error: updateError } = await updateProfile({
      display_name: displayName.trim() || null,
      fitness_goal: fitnessGoal,
      experience_level: experience,
      training_location: location,
      preferred_equipment: equipment,
      limitations: limitations.trim() || null,
    });
    setSaving(false);
    if (updateError) {
      setError(updateError);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-ink-bg pb-24 animate-fade-in">
      <div className="px-5 pt-6 pb-4 flex items-center gap-3">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-xl bg-ink-elevated flex items-center justify-center text-cloud-dim hover:text-cloud transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-display-sm text-cloud font-semibold">Edit Profile</h1>
      </div>

      <div className="px-5 flex flex-col gap-5">
        {/* Personal Info */}
        <div>
          <h3 className="text-sm font-semibold text-cloud mb-3">Personal Info</h3>
          <Card className="p-4">
            <Input
              label="Display Name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
            />
          </Card>
        </div>

        {/* Goal */}
        <div>
          <h3 className="text-sm font-semibold text-cloud mb-3">Fitness Goal</h3>
          <div className="flex flex-col gap-2">
            {GOALS.map((g) => (
              <SelectOption key={g} label={GOAL_LABELS[g]} active={fitnessGoal === g} onClick={() => setFitnessGoal(g)} />
            ))}
          </div>
        </div>

        {/* Experience */}
        <div>
          <h3 className="text-sm font-semibold text-cloud mb-3">Experience Level</h3>
          <div className="flex flex-col gap-2">
            {EXPERIENCE.map((e) => (
              <SelectOption key={e} label={EXPERIENCE_LABELS[e]} active={experience === e} onClick={() => setExperience(e)} />
            ))}
          </div>
        </div>

        {/* Location */}
        <div>
          <h3 className="text-sm font-semibold text-cloud mb-3">Training Location</h3>
          <div className="grid grid-cols-3 gap-2">
            {LOCATIONS.map((l) => (
              <button
                key={l}
                onClick={() => setLocation(l)}
                className={cn(
                  'py-3 rounded-xl text-sm font-medium transition-all capitalize',
                  location === l ? 'bg-lime text-ink-bg' : 'bg-ink-surface text-cloud-dim border border-ink-border'
                )}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Equipment */}
        <div>
          <h3 className="text-sm font-semibold text-cloud mb-3">Preferred Equipment</h3>
          <div className="flex flex-wrap gap-2">
            {EQUIPMENT.map((eq) => (
              <button
                key={eq}
                onClick={() => toggleEquipment(eq)}
                className={cn(
                  'px-3.5 py-2 rounded-full text-xs font-medium transition-all',
                  equipment.includes(eq) ? 'bg-lime text-ink-bg' : 'bg-ink-elevated text-cloud-dim border border-ink-border'
                )}
              >
                {EQUIPMENT_LABELS[eq]}
              </button>
            ))}
          </div>
        </div>

        {/* Limitations */}
        <div>
          <h3 className="text-sm font-semibold text-cloud mb-3">Training Limitations</h3>
          <Textarea
            value={limitations}
            onChange={(e) => setLimitations(e.target.value)}
            placeholder="Any injuries or limitations..."
            rows={3}
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-rust/10 border border-rust/20">
            <AlertCircle className="w-4 h-4 text-rust flex-shrink-0" />
            <p className="text-xs text-rust">{error}</p>
          </div>
        )}
      </div>

      {/* Save Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-ink-surface/95 backdrop-blur-xl border-t border-ink-border p-4 safe-bottom z-30">
        <div className="max-w-md mx-auto">
          <Button size="lg" onClick={handleSave} loading={saving} className="w-full">
            {saved ? <><Check className="w-4 h-4" /> Saved!</> : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function SelectOption({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center justify-between p-3.5 rounded-xl border transition-all',
        active ? 'bg-lime/10 border-lime/50 text-lime' : 'bg-ink-surface border-ink-border text-cloud-dim'
      )}
    >
      <span className="text-sm font-medium">{label}</span>
      <div className={cn('w-5 h-5 rounded-full border-2 transition-all', active ? 'border-lime bg-lime' : 'border-ink-border')}>
        {active && <Check className="w-3 h-3 text-ink-bg mx-auto" strokeWidth={3} />}
      </div>
    </button>
  );
}
