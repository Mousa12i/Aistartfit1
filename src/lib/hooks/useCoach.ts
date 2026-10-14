import { useState, useCallback, useRef } from 'react';
import { useEntitlements } from '@/lib/entitlements-context';
import { fetchExercises } from '@/lib/data';
import type { Exercise, Profile, WorkoutSession } from '@/lib/types';

export interface CoachAction {
  id: string;
  label: string;
  description: string;
  icon: string;
}

export interface CoachProposal {
  type: 'shorten' | 'swap' | 'explain' | 'summary';
  title: string;
  body: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
}

export const COACH_ACTIONS: CoachAction[] = [
  {
    id: 'explain',
    label: 'Why this plan?',
    description: 'Explains how your plan was built',
    icon: 'info',
  },
  {
    id: 'today',
    label: 'What should I train today?',
    description: 'Based on your schedule and history',
    icon: 'calendar',
  },
  {
    id: 'shorten',
    label: "Shorten today's session",
    description: 'Fits your time and keeps the main lifts',
    icon: 'clock',
  },
  {
    id: 'swap',
    label: 'Swap an exercise',
    description: 'Finds an alternative for your equipment',
    icon: 'repeat',
  },
  {
    id: 'week',
    label: 'Summarise my week',
    description: 'From your logged sessions',
    icon: 'chart',
  },
];

interface UseCoachOptions {
  profile: Profile | null;
  sessions: WorkoutSession[];
  todaysWorkoutExercises: Exercise[];
}

export function useCoach({ profile, sessions, todaysWorkoutExercises }: UseCoachOptions) {
  const { coachActionsLeft, useCoachAction } = useEntitlements();
  const useCoachActionRef = useRef(useCoachAction);
  useCoachActionRef.current = useCoachAction;
  const [output, setOutput] = useState<string | null>(null);
  const [proposal, setProposal] = useState<CoachProposal | null>(null);

  const canUseCoach = coachActionsLeft > 0;

  const runAction = useCallback(
    async (actionId: string): Promise<void> => {
      if (!useCoachActionRef.current()) {
        setOutput(
          'Daily limit reached. Your plan allows a limited number of Coach actions per day.'
        );
        return;
      }

      if (!profile) {
        setOutput('Profile not loaded yet. Please try again.');
        return;
      }

      switch (actionId) {
        case 'explain':
          setOutput(generateExplanation(profile));
          setProposal(null);
          break;
        case 'today':
          setOutput(generateTodayAdvice(profile, sessions, todaysWorkoutExercises));
          setProposal(null);
          break;
        case 'shorten':
          if (todaysWorkoutExercises.length === 0) {
            setOutput('No workout scheduled for today.');
            setProposal(null);
          } else {
            setOutput(null);
            setProposal({
              type: 'shorten',
              title: 'How much time do you have?',
              body: 'Select a time to shorten your workout while keeping the key exercises.',
              confirmLabel: 'Apply',
            });
          }
          break;
        case 'swap':
          if (todaysWorkoutExercises.length === 0) {
            setOutput('No workout scheduled for today.');
            setProposal(null);
          } else {
            setOutput(null);
            setProposal({
              type: 'swap',
              title: 'Which exercise would you like to swap?',
              body: todaysWorkoutExercises.map((e, i) => `${i + 1}. ${e.name}`).join('\n'),
            });
          }
          break;
        case 'week':
          setOutput(generateWeekSummary(profile, sessions));
          setProposal(null);
          break;
        default:
          setOutput('Unknown action.');
          setProposal(null);
      }
    },
    [profile, sessions, todaysWorkoutExercises]
  );

  const shortenWorkout = useCallback(
    (minutes: number): { kept: Exercise[]; dropped: Exercise[] } | null => {
      if (todaysWorkoutExercises.length === 0) return null;
      // Estimate: ~9 minutes per exercise, keep at least 2
      const keepCount = Math.max(2, Math.floor(minutes / 9));
      const kept = todaysWorkoutExercises.slice(0, keepCount);
      const dropped = todaysWorkoutExercises.slice(keepCount);
      setOutput(
        `${minutes}-minute version: keeps ${kept.map((e) => e.name).join(', ')}${
          dropped.length > 0 ? `. Drops ${dropped.map((e) => e.name).join(', ')}` : ''
        }. Your plan is unchanged.`
      );
      setProposal(null);
      return { kept, dropped };
    },
    [todaysWorkoutExercises]
  );

  const swapExercise = useCallback(
    async (
      exerciseToSwap: Exercise,
      _allExercises: Exercise[]
    ): Promise<Exercise[]> => {
      void _allExercises;
      // Find alternatives with same primary muscle, compatible equipment
      const allExercises = await fetchExercises();
      const alternatives = allExercises.filter(
        (e) =>
          e.id !== exerciseToSwap.id &&
          e.primary_muscle === exerciseToSwap.primary_muscle &&
          isEquipmentCompatible(e.equipment, profile?.preferred_equipment ?? [])
      );
      return alternatives;
    },
    [profile]
  );

  const clearOutput = useCallback(() => {
    setOutput(null);
    setProposal(null);
  }, []);

  return {
    canUseCoach,
    coachActionsLeft,
    output,
    proposal,
    runAction,
    shortenWorkout,
    swapExercise,
    clearOutput,
  };
}

function isEquipmentCompatible(
  exerciseEquipment: string,
  preferredEquipment: string[]
): boolean {
  if (exerciseEquipment === 'none') return true;
  if (preferredEquipment.includes(exerciseEquipment)) return true;
  // Gym equipment covers most machine/barbell exercises
  if (preferredEquipment.includes('barbell') && exerciseEquipment === 'barbell') return true;
  if (preferredEquipment.includes('dumbbells') && exerciseEquipment === 'dumbbells') return true;
  return false;
}

function generateExplanation(profile: Profile): string {
  const goalLabels: Record<string, string> = {
    fat_loss: 'Fat loss',
    muscle_gain: 'Muscle gain',
    strength: 'Strength',
    endurance: 'Endurance',
    general_fitness: 'General fitness',
  };
  const expLabels: Record<string, string> = {
    beginner: 'Beginner',
    intermediate: 'Intermediate',
    advanced: 'Advanced',
  };

  const goal = goalLabels[profile.fitness_goal ?? 'general_fitness'] ?? 'General fitness';
  const exp = expLabels[profile.experience_level ?? 'beginner'] ?? 'Beginner';
  const days = profile.preferred_days?.length ?? 3;
  const dur = profile.session_duration_min ?? 45;

  return `Your plan was built from your profile:

Goal: ${goal} — sets the rep ranges, rest periods, and volume.
Experience: ${exp} — ${exp === 'Beginner' ? 'starts with fewer sets to build form safely' : 'full volume for your level'}.
Days: ${days} per week, about ${dur} minutes each.
${profile.limitations ? `Avoiding: ${profile.limitations}` : 'No limitations specified.'}

Changes to your plan come only from your logged sessions and only after you approve them.`;
}

function generateTodayAdvice(
  profile: Profile,
  sessions: WorkoutSession[],
  todaysExercises: Exercise[]
): string {
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
  const trainedToday = sessions.some((s) => {
    const d = new Date(s.started_at);
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}` === todayKey;
  });

  if (trainedToday) {
    return "You already trained today. Rest, eat well and sleep. Tomorrow's plan is on the Train tab.";
  }

  if (todaysExercises.length === 0) {
    return 'Rest day. Try the recovery guide, or pick a workout from the Train tab if you feel fresh.';
  }

  const names = todaysExercises.map((e) => e.name).join(', ');
  return `Today's workout: ${names}. Check the Train tab to start.`;
}

function generateWeekSummary(profile: Profile, sessions: WorkoutSession[]): string {
  const now = Date.now();
  const weekStart = now - 7 * 86400000;
  const weekSessions = sessions.filter((s) => new Date(s.started_at).getTime() >= weekStart);

  if (weekSessions.length === 0) {
    return 'No sessions logged this week. Start one from the Train tab!';
  }

  const totalDuration = weekSessions.reduce((sum, s) => sum + s.duration_seconds, 0);
  const totalSets = weekSessions.reduce((sum, s) => sum + s.total_sets, 0);
  const mins = Math.round(totalDuration / 60);

  return `This week: ${weekSessions.length} session${weekSessions.length > 1 ? 's' : ''}, ${mins} minutes, ${totalSets} total sets. Keep it up!`;
}
