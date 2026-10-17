import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { fetchAllUserSetLogs, fetchExercisesByIds } from '@/lib/data';
import { Card } from '@/components/ui/Card';
import { LoadingState, EmptyState } from '@/components/ui/States';
import { Dumbbell, Lock } from 'lucide-react';
import { MUSCLE_LABELS } from '@/lib/utils';
import { useEntitlements } from '@/lib/entitlements-context';

const MUSCLE_ORDER = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'glutes', 'full_body', 'cardio'] as const;
const MUSCLE_COLORS: Record<string, string> = {
  chest: '#ff4444',
  back: '#ff6633',
  legs: '#ff8822',
  shoulders: '#ffaa33',
  arms: '#ff9944',
  core: '#ffbb55',
  glutes: '#ff7733',
  full_body: '#a6ff32',
  cardio: '#4aa8e5',
};

interface VolumeData {
  muscle: string;
  volume: number;
  sets: number;
}

export function TrainingVolumeAnalytics() {
  const { hasFeature } = useEntitlements();
  const [data, setData] = useState<VolumeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalVolume, setTotalVolume] = useState(0);
  const unlocked = hasFeature('volume');

  useEffect(() => {
    if (!unlocked) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        // Last 50 finished workouts, working sets only; each exercise counts for its primary muscle in the library.
        const setLogs = (await fetchAllUserSetLogs()).filter((l) => l.completed && l.weight && l.weight > 0 && l.reps > 0 && l.set_type !== 'warm_up');
        if (setLogs.length === 0) {
          setLoading(false);
          return;
        }
        const exercises = await fetchExercisesByIds([...new Set(setLogs.map((l) => l.exercise_id))]);
        const muscleOf = new Map(exercises.map((e) => [e.id, e.primary_muscle as string]));
        const muscleVolume: Record<string, { volume: number; sets: number }> = {};

        for (const log of setLogs) {
          const muscle = muscleOf.get(log.exercise_id) ?? 'full_body';
          if (!muscleVolume[muscle]) muscleVolume[muscle] = { volume: 0, sets: 0 };
          muscleVolume[muscle].volume += (log.weight ?? 0) * log.reps;
          muscleVolume[muscle].sets += 1;
        }

        const chartData: VolumeData[] = MUSCLE_ORDER
          .filter((m) => muscleVolume[m])
          .map((m) => ({
            muscle: MUSCLE_LABELS[m] ?? m,
            volume: Math.round(muscleVolume[m].volume),
            sets: muscleVolume[m].sets,
          }));

        setData(chartData);
        setTotalVolume(chartData.reduce((sum, d) => sum + d.volume, 0));
      } catch {
        // non-critical
      } finally {
        setLoading(false);
      }
    })();
  }, [unlocked]);

  if (!unlocked) {
    return (
      <Card className="p-6">
        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-2xl bg-ink-elevated flex items-center justify-center mb-3">
            <Lock className="w-6 h-6 text-cloud-dim" />
          </div>
          <p className="text-sm font-semibold text-cloud mb-1">Training Volume Analytics</p>
          <p className="text-[11px] text-cloud-dim max-w-[240px]">
            Upgrade to Pro to see total volume per muscle group from your completed workouts.
          </p>
        </div>
      </Card>
    );
  }

  if (loading) return <Card className="p-5"><LoadingState label="Calculating volume..." /></Card>;

  if (data.length === 0) {
    return (
      <Card className="p-6">
        <EmptyState
          icon={<Dumbbell className="w-6 h-6" />}
          title="No volume data yet"
          description="Complete workouts with logged weights to see volume analytics."
        />
      </Card>
    );
  }

  return (
    <Card elevated className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-cloud">Training Volume</h3>
          <p className="text-[11px] text-cloud-dim">Last 50 workouts, working sets: {totalVolume.toLocaleString()} kg lifted (weight × reps)</p>
        </div>
        <div className="w-10 h-10 rounded-xl bg-lime/10 flex items-center justify-center">
          <Dumbbell className="w-5 h-5 text-lime" />
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1B2922" />
          <XAxis dataKey="muscle" tick={{ fill: '#6b7b72', fontSize: 10 }} axisLine={{ stroke: '#1B2922' }} />
          <YAxis tick={{ fill: '#6b7b72', fontSize: 10 }} axisLine={{ stroke: '#1B2922' }} />
          <Tooltip
            cursor={{ fill: 'rgba(166,255,50,0.05)' }}
            contentStyle={{
              backgroundColor: '#0F1814',
              border: '1px solid #1B2922',
              borderRadius: '12px',
              fontSize: '12px',
            }}
            labelStyle={{ color: '#A6FF32' }}
            formatter={(value) => [`${Number(value ?? 0).toLocaleString()} kg`, 'Volume']}
          />
          <Bar dataKey="volume" radius={[6, 6, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={index} fill={MUSCLE_COLORS[MUSCLE_ORDER.find((m) => MUSCLE_LABELS[m] === entry.muscle) ?? 'chest']} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}
