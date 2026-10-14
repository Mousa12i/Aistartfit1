import { useEffect, useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { fetchAllUserSetLogs } from '@/lib/data';
import type { WorkoutSetLog } from '@/lib/types';
import { Card } from '@/components/ui/Card';
import { LoadingState, EmptyState } from '@/components/ui/States';
import { TrendingUp, Lock, Dumbbell } from 'lucide-react';
import { useEntitlements } from '@/lib/entitlements-context';

interface StrengthPoint {
  date: string;
  label: string;
  maxWeight: number;
  estimated1RM: number;
  volume: number;
}

export function StrengthTrends({ exerciseName }: { exerciseName: string }) {
  const { hasFeature } = useEntitlements();
  const [data, setData] = useState<StrengthPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const unlocked = hasFeature('trend');

  useEffect(() => {
    if (!unlocked) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const allLogs = await fetchAllUserSetLogs();
        const exerciseLogs = allLogs.filter(
          (l) => l.exercise_name.toLowerCase() === exerciseName.toLowerCase() && l.weight && l.completed
        );

        // Group by session (by session_id), find max weight per session
        const bySession: Record<string, WorkoutSetLog[]> = {};
        for (const log of exerciseLogs) {
          if (!bySession[log.session_id]) bySession[log.session_id] = [];
          bySession[log.session_id].push(log);
        }

        // Convert to chronological points
        const points: StrengthPoint[] = Object.entries(bySession)
          .map(([sessionId, logs]) => {
            const maxWeight = Math.max(...logs.map((l) => l.weight ?? 0));
            const bestSet = logs.find((l) => l.weight === maxWeight);
            const reps = bestSet?.reps ?? 1;
            // Epley formula for estimated 1RM
            const estimated1RM = maxWeight > 0 ? Math.round(maxWeight * (1 + reps / 30)) : 0;
            const volume = logs.reduce((sum, l) => sum + (l.weight ?? 0) * l.reps, 0);
            return {
              date: sessionId,
              label: '',
              maxWeight,
              estimated1RM,
              volume,
            };
          })
          .sort((a, b) => a.date.localeCompare(b.date));

        // Label points by session number
        points.forEach((p, i) => {
          p.label = `S${i + 1}`;
        });

        setData(points);
      } catch {
        // non-critical
      } finally {
        setLoading(false);
      }
    })();
  }, [exerciseName, unlocked]);

  const latest1RM = useMemo(() => (data.length > 0 ? data[data.length - 1].estimated1RM : 0), [data]);
  const first1RM = useMemo(() => (data.length > 0 ? data[0].estimated1RM : 0), [data]);
  const improvement = latest1RM - first1RM;

  if (!unlocked) {
    return (
      <Card className="p-6">
        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-2xl bg-ink-elevated flex items-center justify-center mb-3">
            <Lock className="w-6 h-6 text-cloud-dim" />
          </div>
          <p className="text-sm font-semibold text-cloud mb-1">Per-Exercise Strength Trends</p>
          <p className="text-[11px] text-cloud-dim max-w-[240px]">
            Upgrade to Pro+ to see 1RM progression and weight trends for each exercise.
          </p>
        </div>
      </Card>
    );
  }

  if (loading) return <Card className="p-5"><LoadingState label="Loading strength data..." /></Card>;

  if (data.length === 0) {
    return (
      <Card className="p-6">
        <EmptyState
          icon={<Dumbbell className="w-6 h-6" />}
          title="No strength data for this exercise"
          description="Log workouts with this exercise to see your strength progression."
        />
      </Card>
    );
  }

  return (
    <Card elevated className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-cloud">Strength Trends — {exerciseName}</h3>
          <p className="text-[11px] text-cloud-dim">
            Est. 1RM: {latest1RM}kg
            {improvement !== 0 && (
              <span className={improvement > 0 ? 'text-lime ml-2' : 'text-rust ml-2'}>
                {improvement > 0 ? '+' : ''}{improvement}kg
              </span>
            )}
          </p>
        </div>
        <div className="w-10 h-10 rounded-xl bg-lime/10 flex items-center justify-center">
          <TrendingUp className="w-5 h-5 text-lime" />
        </div>
      </div>
      {data.length >= 2 ? (
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1B2922" />
            <XAxis dataKey="label" tick={{ fill: '#6b7b72', fontSize: 10 }} axisLine={{ stroke: '#1B2922' }} />
            <YAxis tick={{ fill: '#6b7b72', fontSize: 10 }} axisLine={{ stroke: '#1B2922' }} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#0F1814',
                border: '1px solid #1B2922',
                borderRadius: '12px',
                fontSize: '12px',
              }}
              labelStyle={{ color: '#A6FF32' }}
              formatter={(value, name) => [
                `${Number(value ?? 0)}kg`,
                name === 'estimated1RM' ? 'Est. 1RM' : 'Max Weight',
              ]}
            />
            <ReferenceLine y={latest1RM} stroke="#A6FF32" strokeDasharray="5 5" strokeOpacity={0.3} />
            <Line
              type="monotone"
              dataKey="maxWeight"
              stroke="#ff8822"
              strokeWidth={2}
              dot={{ fill: '#ff8822', r: 3 }}
              name="Max Weight"
            />
            <Line
              type="monotone"
              dataKey="estimated1RM"
              stroke="#A6FF32"
              strokeWidth={2}
              dot={{ fill: '#A6FF32', r: 3 }}
              name="Est. 1RM"
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="py-6 text-center">
          <p className="text-xs text-cloud-dim">Log at least 2 sessions with this exercise to see trend lines.</p>
        </div>
      )}
      <p className="text-[9px] text-cloud-muted mt-2">
        1RM estimated using the Epley formula. Values are approximate and for tracking purposes only.
      </p>
    </Card>
  );
}
