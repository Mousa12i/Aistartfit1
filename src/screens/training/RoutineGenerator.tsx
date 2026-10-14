import { useState } from 'react';
import { reportIfAiConsentMissing } from '@/lib/consent-events';
import { useAuth } from '@/lib/auth';
import { useEntitlements } from '@/lib/entitlements-context';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StripeUpgradeModal } from '@/components/ui/StripeUpgradeModal';
import { BlueprintStorefront } from '@/components/ui/BlueprintStorefront';
import { downloadRoutinePDF } from '@/lib/pdfExport';
import {
  ChevronLeft, Sparkles, Loader2, Dumbbell, Crown, AlertCircle,
  Activity, Zap, ChevronDown, ChevronUp, Brain, FileDown, FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface GeneratedRoutine {
  routine_name: string;
  summary: string;
  physiological_reasoning?: string;
  macros?: { calories: number; protein_g: number; carbs_g: number; fat_g: number };
  days: {
    day: string;
    focus: string;
    exercises: { name: string; sets: number; reps: string; rest: string; notes: string; form_cues?: string }[];
  }[];
  progression_notes: string;
}

interface RoutineGeneratorProps {
  onBack: () => void;
}

export function RoutineGenerator({ onBack }: RoutineGeneratorProps) {
  const { profile } = useAuth();
  const { tier, hasFeature } = useEntitlements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [routine, setRoutine] = useState<GeneratedRoutine | null>(null);
  const [fatigue, setFatigue] = useState('normal');
  const [soreness, setSoreness] = useState('none');
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showStorefront, setShowStorefront] = useState(false);

  const isUnlocked = hasFeature('biometric');

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Please sign in first.');

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/routine-generator`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ fatigue, soreness }),
      });

      const body = await response.json().catch(() => ({})) as { routine?: GeneratedRoutine; error?: string; message?: string };
      reportIfAiConsentMissing(response.status, body);
      if (!response.ok) {
        throw new Error(typeof body.message === 'string' ? body.message : typeof body.error === 'string' ? body.error : 'Generation failed.');
      }
      if (body.routine) {
        setRoutine(body.routine);
        setExpandedDay(body.routine.days[0]?.day ?? null);
      } else {
        throw new Error('No routine returned.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate routine.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-ink-bg pb-24 animate-fade-in">
      <div className="px-5 pt-6 pb-4 flex items-center gap-3">
        <button onClick={onBack} className="w-10 h-10 rounded-xl bg-ink-elevated flex items-center justify-center text-cloud-dim hover:text-cloud transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-display-md text-cloud font-bold">AI Routine Generator</h1>
          <p className="text-xs text-cloud-dim">Biometric-customised weekly programming</p>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-lime/10 text-lime text-[10px] font-bold">
          <Brain className="w-3 h-3" />
          o3-mini
        </div>
      </div>

      {!isUnlocked ? (
        <div className="px-5 mt-8">
          <Card className="p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-lime/30 to-lime/5 flex items-center justify-center mx-auto mb-4 ring-1 ring-lime/20">
              <Crown className="w-8 h-8 text-lime" />
            </div>
            <h2 className="text-display-sm text-cloud font-semibold mb-2">Pro+ Exclusive</h2>
            <p className="text-sm text-cloud-dim leading-relaxed mb-6 max-w-xs mx-auto">
              The AI Biometric Routine Generator analyses your body fat, joint limitations, and weak points to create a fully custom weekly program — powered by OpenAI's o3-mini reasoning engine.
            </p>
            <div className="flex flex-col gap-2">
              <Button size="lg" onClick={() => setShowUpgrade(true)} className="w-full">
                <Crown className="w-4 h-4" />
                Upgrade to Pro+
              </Button>
              <button
                onClick={() => setShowStorefront(true)}
                className="w-full flex items-center justify-center gap-2 rounded-xl py-3 bg-ink-elevated text-cloud font-semibold text-sm hover:bg-ink-surface transition-all border border-ink-border"
              >
                <FileText className="w-4 h-4 text-lime" />
                Or buy a one-off AI Blueprint
              </button>
            </div>
          </Card>
        </div>
      ) : (
        <>
          {/* Current biometrics summary */}
          <div className="px-5 mb-5">
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Activity className="w-4 h-4 text-lime" />
                <p className="text-xs font-semibold text-cloud">Your Biometric Profile</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <BioStat label="Weight" value={profile?.weight_kg ? `${profile.weight_kg}kg` : '—'} />
                <BioStat label="Body Fat" value={profile?.body_fat_pct ? `${profile.body_fat_pct}%` : '—'} />
                <BioStat label="Goal" value={profile?.physique_goal ?? profile?.fitness_goal ?? '—'} />
              </div>
              {profile?.limitations && (
                <div className="mt-3 p-2.5 rounded-lg bg-rust/5 border border-rust/20">
                  <p className="text-[10px] text-rust leading-relaxed">
                    <span className="font-semibold">Flagged limitations: </span>{profile.limitations}
                  </p>
                </div>
              )}
            </Card>
          </div>

          {/* Fatigue / Soreness inputs */}
          <div className="px-5 mb-5">
            <h3 className="text-sm font-semibold text-cloud mb-3">How are you feeling today?</h3>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <p className="text-[10px] text-cloud-dim mb-2">Fatigue Level</p>
                <div className="flex gap-1.5">
                  {['low', 'normal', 'high'].map((f) => (
                    <button
                      key={f}
                      onClick={() => setFatigue(f)}
                      className={cn(
                        'flex-1 py-2 rounded-lg text-[11px] font-medium capitalize transition-all',
                        fatigue === f ? 'bg-lime text-ink-bg' : 'bg-ink-elevated text-cloud-dim'
                      )}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] text-cloud-dim mb-2">Soreness</p>
                <div className="flex gap-1.5">
                  {['none', 'mild', 'severe'].map((s) => (
                    <button
                      key={s}
                      onClick={() => setSoreness(s)}
                      className={cn(
                        'flex-1 py-2 rounded-lg text-[11px] font-medium capitalize transition-all',
                        soreness === s ? 'bg-lime text-ink-bg' : 'bg-ink-elevated text-cloud-dim'
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <p className="text-[10px] text-cloud-dim">The AI will adjust volume and exercise selection based on your current state.</p>
          </div>

          {/* Generate button */}
          <div className="px-5 mb-5">
            <Button size="lg" onClick={generate} loading={loading} className="w-full" disabled={loading}>
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Generating your routine...</>
              ) : (
                <><Sparkles className="w-4 h-4" /> Generate AI Routine</>
              )}
            </Button>
          </div>

          {error && (
            <div className="px-5 mb-4">
              <div className="flex items-center gap-2 p-3 rounded-xl bg-rust/10 border border-rust/30">
                <AlertCircle className="w-4 h-4 text-rust flex-shrink-0" />
                <p className="text-xs text-rust">{error}</p>
              </div>
            </div>
          )}

          {/* Generated routine display */}
          {routine && (
            <div className="px-5 space-y-4">
              <Card elevated className="p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-5 h-5 text-lime" />
                  <h2 className="text-display-sm text-cloud font-bold">{routine.routine_name}</h2>
                </div>
                <p className="text-sm text-cloud-dim leading-relaxed mb-3">{routine.summary}</p>
                {routine.physiological_reasoning && (
                  <div className="p-3 rounded-lg bg-lime/5 border border-lime/20 mb-3">
                    <p className="text-[10px] text-lime font-semibold uppercase tracking-wider mb-1">Physiological Reasoning</p>
                    <p className="text-xs text-cloud-dim leading-relaxed">{routine.physiological_reasoning}</p>
                  </div>
                )}
                {routine.macros && (
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    <MacroStat label="kcal" value={String(routine.macros.calories)} />
                    <MacroStat label="Protein" value={`${routine.macros.protein_g}g`} />
                    <MacroStat label="Carbs" value={`${routine.macros.carbs_g}g`} />
                    <MacroStat label="Fat" value={`${routine.macros.fat_g}g`} />
                  </div>
                )}
                <div className="p-3 rounded-lg bg-lime/5 border border-lime/20">
                  <p className="text-xs text-cloud-dim leading-relaxed">
                    <span className="text-lime font-semibold">Progression: </span>{routine.progression_notes}
                  </p>
                </div>
                <button
                  onClick={() => downloadRoutinePDF(routine, profile)}
                  className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl py-2.5 bg-lime/10 text-lime font-semibold text-xs hover:bg-lime/20 transition-all border border-lime/20"
                >
                  <FileDown className="w-4 h-4" />
                  Download PDF Blueprint
                </button>
              </Card>

              {routine.days.map((day) => (
                <Card key={day.day} className="overflow-hidden">
                  <button
                    onClick={() => setExpandedDay(expandedDay === day.day ? null : day.day)}
                    className="w-full flex items-center justify-between p-4 hover:bg-ink-elevated/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-lime/10 flex items-center justify-center">
                        <Dumbbell className="w-5 h-5 text-lime" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-semibold text-cloud">{day.day}</p>
                        <p className="text-[11px] text-cloud-dim">{day.focus}</p>
                      </div>
                    </div>
                    {expandedDay === day.day ? <ChevronUp className="w-4 h-4 text-cloud-dim" /> : <ChevronDown className="w-4 h-4 text-cloud-dim" />}
                  </button>
                  {expandedDay === day.day && (
                    <div className="px-4 pb-4 space-y-2 animate-fade-in">
                      {day.exercises.map((ex, i) => (
                        <div key={i} className="p-3 rounded-xl bg-ink-elevated/50 border border-ink-border">
                          <div className="flex items-center justify-between mb-1.5">
                            <p className="text-sm font-medium text-cloud">{ex.name}</p>
                            <span className="text-[10px] text-lime font-mono">{ex.sets}x{ex.reps}</span>
                          </div>
                          <div className="flex items-center gap-3 text-[10px] text-cloud-dim mb-1.5">
                            <span>Rest: {ex.rest}</span>
                          </div>
                          {ex.form_cues && (
                              <p className="text-[10px] text-lime/70 leading-relaxed mb-1">Form: {ex.form_cues}</p>
                            )}
                            {ex.notes && (
                              <p className="text-[10px] text-cloud-dim leading-relaxed italic">{ex.notes}</p>
                            )}
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      <StripeUpgradeModal open={showUpgrade} currentTier={tier} onClose={() => setShowUpgrade(false)} />
      <BlueprintStorefront open={showStorefront} onClose={() => setShowStorefront(false)} />
    </div>
  );
}

function BioStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center text-center py-2 rounded-xl bg-ink-elevated/50">
      <p className="text-xs font-bold text-cloud truncate w-full px-1 capitalize">{value}</p>
      <p className="text-[9px] text-cloud-dim mt-0.5">{label}</p>
    </div>
  );
}

function MacroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center text-center py-2 rounded-lg bg-ink-elevated/50">
      <p className="text-sm font-bold text-lime truncate">{value}</p>
      <p className="text-[9px] text-cloud-dim mt-0.5">{label}</p>
    </div>
  );
}
