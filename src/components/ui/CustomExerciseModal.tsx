import { useState } from 'react';
import { createCustomExercise } from '@/lib/data';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  MUSCLE_LABELS, EQUIPMENT_LABELS, DIFFICULTY_LABELS,
} from '@/lib/utils';
import type { Exercise } from '@/lib/types';
import { X, Plus, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CustomExerciseModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (exercise: Exercise) => void;
}

const MUSCLE_OPTIONS = Object.entries(MUSCLE_LABELS).map(([value, label]) => ({ value, label }));
const EQUIPMENT_OPTIONS = Object.entries(EQUIPMENT_LABELS).map(([value, label]) => ({ value, label }));
const DIFFICULTY_OPTIONS = Object.entries(DIFFICULTY_LABELS).map(([value, label]) => ({ value, label }));

export function CustomExerciseModal({ open, onClose, onCreated }: CustomExerciseModalProps) {
  const [name, setName] = useState('');
  const [primaryMuscle, setPrimaryMuscle] = useState('chest');
  const [equipment, setEquipment] = useState('dumbbells');
  const [difficulty, setDifficulty] = useState('beginner');
  const [category, setCategory] = useState('strength');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Please enter an exercise name.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const ex = await createCustomExercise({
        name: name.trim(),
        primary_muscle: primaryMuscle,
        equipment,
        difficulty,
        category,
        description: description.trim() || name.trim(),
      });
      if (ex) {
        onCreated(ex);
        setName('');
        setDescription('');
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save exercise.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div
        className="w-full sm:max-w-md bg-ink-surface rounded-t-3xl sm:rounded-3xl border border-ink-border max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-ink-surface border-b border-ink-border/50 px-5 py-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-cloud">Add Custom Exercise</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-ink-elevated flex items-center justify-center text-cloud-dim hover:text-cloud">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="text-xs font-semibold text-cloud-dim uppercase tracking-wider mb-1.5 block">Exercise Name</label>
            <Input
              placeholder="e.g. Cable Woodchopper"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-cloud-dim uppercase tracking-wider mb-1.5 block">Primary Muscle</label>
            <div className="flex flex-wrap gap-1.5">
              {MUSCLE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setPrimaryMuscle(opt.value)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                    primaryMuscle === opt.value ? 'bg-lime text-ink-bg' : 'bg-ink-elevated text-cloud-dim hover:text-cloud'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-cloud-dim uppercase tracking-wider mb-1.5 block">Equipment</label>
            <div className="flex flex-wrap gap-1.5">
              {EQUIPMENT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setEquipment(opt.value)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                    equipment === opt.value ? 'bg-lime text-ink-bg' : 'bg-ink-elevated text-cloud-dim hover:text-cloud'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-cloud-dim uppercase tracking-wider mb-1.5 block">Difficulty</label>
            <div className="flex gap-1.5">
              {DIFFICULTY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setDifficulty(opt.value)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                    difficulty === opt.value ? 'bg-lime text-ink-bg' : 'bg-ink-elevated text-cloud-dim hover:text-cloud'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-cloud-dim uppercase tracking-wider mb-1.5 block">Category</label>
            <div className="flex flex-wrap gap-1.5">
              {['strength', 'cardio', 'stretching', 'plyometrics'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize',
                    category === cat ? 'bg-lime text-ink-bg' : 'bg-ink-elevated text-cloud-dim hover:text-cloud'
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-cloud-dim uppercase tracking-wider mb-1.5 block">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the exercise..."
              rows={2}
              className="w-full bg-ink-elevated rounded-lg px-3 py-2 text-sm text-cloud placeholder:text-cloud-dim/50 resize-none focus:outline-none focus:border-lime/30 border border-transparent"
            />
          </div>

          {error && <p className="text-sm text-rust text-center">{error}</p>}

          <Button onClick={() => handleSave()} disabled={saving} className="w-full" size="lg">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {saving ? 'Saving...' : 'Add Exercise'}
          </Button>
        </div>
      </div>
    </div>
  );
}
