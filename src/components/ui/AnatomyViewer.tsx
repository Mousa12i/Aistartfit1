import { useState } from 'react';
import { AlertCircle, ImageOff, RotateCcw, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AnatomyViewerProps {
  exerciseName: string;
  primaryMuscle: string;
  secondaryMuscles: string[];
  imageUrl?: string | null;
  externalPlaying?: boolean;
  externalSpeed?: number;
}

interface MuscleInfo {
  name: string;
  role: 'primary' | 'secondary';
  description: string;
}

const MUSCLE_DESCRIPTIONS: Record<string, string> = {
  chest: 'The pectoralis major pushes weight away from the body. Engage fully by squeezing at the top.',
  back: 'The latissimus dorsi and mid-back muscles pull weight toward the body. Focus on the shoulder blades squeezing together.',
  shoulders: 'The deltoids raise the arms in multiple directions. Keep the core tight to avoid momentum.',
  arms: 'The biceps flex the elbow; the triceps extend it. Control the negative phase for maximum growth.',
  legs: 'The quadriceps, hamstrings, and calves drive lower-body power. Push through the heels.',
  glutes: 'The gluteus maximus extends the hips. Squeeze at the top of each rep for full activation.',
  core: 'The abdominals and obliques stabilise the spine. Maintain a braced midsection throughout.',
  full_body: 'Multiple large muscle groups work together. Prioritise form and breathing.',
  cardio: 'Sustained elevation of heart rate improves cardiovascular endurance and fat oxidation.',
};

function getMuscleInfo(muscle: string, role: 'primary' | 'secondary'): MuscleInfo {
  return {
    name: muscle.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    role,
    description: MUSCLE_DESCRIPTIONS[muscle] ?? 'This muscle supports the movement pattern.',
  };
}

export function AnatomyViewer({ exerciseName, primaryMuscle, secondaryMuscles, imageUrl }: AnatomyViewerProps) {
  const [failed, setFailed] = useState(false);
  const [imageKey, setImageKey] = useState(0);
  const [selectedMuscle, setSelectedMuscle] = useState<number | null>(null);

  const retry = () => {
    setFailed(false);
    setImageKey((key) => key + 1);
  };

  const allMuscles = [
    getMuscleInfo(primaryMuscle, 'primary'),
    ...secondaryMuscles.map((m) => getMuscleInfo(m, 'secondary')),
  ];

  if (!imageUrl) {
    return (
      <div className="relative aspect-video rounded-xl2 bg-ink-secondary border border-ink-border flex flex-col items-center justify-center px-6 text-center">
        <ImageOff className="w-8 h-8 text-cloud-dim mb-3" />
        <p className="text-sm font-semibold text-cloud">No verified demonstration available</p>
        <p className="text-xs text-cloud-dim mt-1 max-w-sm">
          We do not have a suitable human video or photograph for this exercise yet. Technique instructions remain available below.
        </p>
      </div>
    );
  }

  if (failed) {
    return (
      <div className="relative aspect-video rounded-xl2 bg-ink-secondary border border-rust/30 flex flex-col items-center justify-center px-6 text-center">
        <AlertCircle className="w-8 h-8 text-rust mb-3" />
        <p className="text-sm font-semibold text-cloud">Demonstration could not load</p>
        <p className="text-xs text-cloud-dim mt-1 max-w-sm">Check your connection and try again. No unrelated exercise image is shown as a substitute.</p>
        <button onClick={retry} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-ink-elevated px-3 py-2 text-xs font-medium text-cloud hover:text-lime transition-colors">
          <RotateCcw className="w-3.5 h-3.5" /> Retry
        </button>
      </div>
    );
  }

  return (
    <figure className="relative rounded-xl2 overflow-hidden bg-ink-secondary border border-ink-border">
      <div className="aspect-[4/3] sm:aspect-video bg-black flex items-center justify-center">
        <img
          key={imageKey}
          src={imageUrl}
          alt={exerciseName}
          className="h-full w-full object-contain"
          loading="eager"
          onError={() => setFailed(true)}
        />
      </div>

      {/* Interactive muscle overlay badges */}
      <div className="absolute top-2 left-2 flex flex-col gap-1.5">
        {allMuscles.map((m, i) => (
          <button
            key={i}
            onClick={() => setSelectedMuscle(selectedMuscle === i ? null : i)}
            className={cn(
              'px-2 py-1 rounded-lg text-[10px] font-bold backdrop-blur-sm transition-all',
              m.role === 'primary'
                ? 'bg-lime/90 text-ink-bg'
                : 'bg-ink-surface/80 text-cloud-dim border border-ink-border',
              selectedMuscle === i && 'ring-2 ring-lime/50 scale-105'
            )}
          >
            {m.name}
          </button>
        ))}
      </div>

      {/* Muscle info popup */}
      {selectedMuscle !== null && allMuscles[selectedMuscle] && (
        <div className="absolute bottom-2 left-2 right-2 bg-ink-surface/95 backdrop-blur-md rounded-xl p-3 border border-lime/20 animate-fade-in">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-lime flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-cloud">
                {allMuscles[selectedMuscle].name}
                <span className={cn(
                  'ml-2 px-1.5 py-0.5 rounded text-[8px] font-bold',
                  allMuscles[selectedMuscle].role === 'primary' ? 'bg-lime/20 text-lime' : 'bg-ink-elevated text-cloud-dim'
                )}>
                  {allMuscles[selectedMuscle].role === 'primary' ? 'PRIMARY' : 'SECONDARY'}
                </span>
              </p>
              <p className="text-[11px] text-cloud-dim mt-1 leading-relaxed">
                {allMuscles[selectedMuscle].description}
              </p>
            </div>
          </div>
        </div>
      )}

      <figcaption className="flex flex-wrap items-center justify-between gap-2 border-t border-ink-border bg-ink-surface px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-cloud">{exerciseName}</p>
          <p className="text-[10px] text-cloud-dim">
            Target: {primaryMuscle.replace(/_/g, ' ')}{secondaryMuscles.length > 0 ? ` · Also: ${secondaryMuscles.join(', ')}` : ''}
          </p>
        </div>
        <span className="text-[10px] text-cloud-dim/60 flex items-center gap-1">
          <Info className="w-3 h-3" /> Tap a muscle for info
        </span>
      </figcaption>
    </figure>
  );
}
