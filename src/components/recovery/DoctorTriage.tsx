import { useState } from 'react';
import { AlertTriangle, Activity, Stethoscope, X, Check } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import type { PainLog } from '@/lib/recovery/store';
import { createPainLog, deletePainLog } from '@/lib/recovery/store';

interface DoctorTriageProps {
  painLogs: PainLog[];
  onSaved: () => void;
}

type TriageLevel = 'green' | 'yellow' | 'red';

const RED_FLAGS = [
  'Dark or cola-colored urine',
  'Severe swelling or pain out of proportion',
  'Numbness or tingling',
  'Joint instability (gives way)',
  'Chest pain',
  'Dizziness or fainting',
  'Sudden sharp pain during a lift',
];

export function DoctorTriage({ painLogs, onSaved }: DoctorTriageProps) {
  const [showIntake, setShowIntake] = useState(false);
  const [bodyArea, setBodyArea] = useState('');
  const [onset, setOnset] = useState('');
  const [painType, setPainType] = useState('');
  const [severity, setSeverity] = useState(5);
  const [duringExercise, setDuringExercise] = useState<boolean | null>(null);
  const [swelling, setSwelling] = useState(false);
  const [bruising, setBruising] = useState(false);
  const [romLoss, setRomLoss] = useState(false);
  const [durationHours, setDurationHours] = useState('');
  const [notes, setNotes] = useState('');
  const [redFlags, setRedFlags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(true);

  const computeTriage = (): TriageLevel => {
    if (redFlags.length > 0) return 'red';
    if (severity >= 8 || swelling || bruising || romLoss) return 'yellow';
    if (severity >= 5 || duringExercise === true) return 'yellow';
    return 'green';
  };

  const handleSave = async () => {
    if (!bodyArea.trim()) return;
    setSaving(true);
    try {
      await createPainLog({
        body_area: bodyArea.trim(),
        onset: onset || null,
        pain_type: painType || null,
        severity,
        during_exercise: duringExercise,
        swelling,
        bruising,
        rom_loss: romLoss,
        duration_hours: durationHours ? parseFloat(durationHours) : null,
        // red flags are kept with the report so today's decision and the clinician PDF can show them
        notes: [redFlags.length ? `Red flags: ${redFlags.join('; ')}` : '', notes.trim()].filter(Boolean).join(' | ').slice(0, 1000) || null,
        triage_level: computeTriage(),
      });
      setShowIntake(false);
      resetForm();
      onSaved();
    } catch {
      // handled by parent
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setBodyArea(''); setOnset(''); setPainType(''); setSeverity(5);
    setDuringExercise(null); setSwelling(false); setBruising(false);
    setRomLoss(false); setDurationHours(''); setNotes(''); setRedFlags([]);
  };

  const triage = computeTriage();

  if (!showIntake) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Stethoscope className="w-4 h-4 text-lime" />
          <h3 className="text-sm font-semibold text-cloud">Doctor</h3>
        </div>
        <p className="text-[11px] text-cloud-dim mb-3">
          Structured pain intake with triage guidance. Not a diagnosis — educational information only.
        </p>

        {painLogs.length > 0 && (
          <div className="space-y-2 mb-3">
            <p className="text-[10px] text-cloud-dim uppercase tracking-wider">Recent entries</p>
            {painLogs.slice(0, 3).map((log) => (
              <PainLogRow key={log.id} log={log} onDelete={async () => { await deletePainLog(log.id); onSaved(); }} />
            ))}
          </div>
        )}

        <Button size="sm" onClick={() => setShowIntake(true)} className="w-full">
          <Activity className="w-3.5 h-3.5" /> New Pain Assessment
        </Button>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-cloud">Pain Assessment</h3>
        <button onClick={() => { setShowIntake(false); resetForm(); }} className="w-8 h-8 rounded-lg bg-ink-elevated flex items-center justify-center text-cloud-dim">
          <X className="w-4 h-4" />
        </button>
      </div>

      {showDisclaimer && (
        <div className="mb-3 p-2.5 rounded-lg bg-gold/5 border border-gold/20 flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-gold flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[10px] text-cloud-dim">Educational information, not a diagnosis or medical advice. Always consult a qualified healthcare professional for injury concerns.</p>
            <button onClick={() => setShowDisclaimer(false)} className="text-[9px] text-sky mt-1">Got it</button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label className="text-[10px] text-cloud-dim mb-1 block">Body area</label>
          <input
            value={bodyArea}
            onChange={(e) => setBodyArea(e.target.value)}
            placeholder="e.g. left knee, lower back, right shoulder"
            className="w-full bg-ink-elevated rounded-lg px-3 py-2 text-sm text-cloud placeholder:text-cloud-dim/40 border border-transparent focus:border-lime/30 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-cloud-dim mb-1 block">Onset</label>
            <select value={onset} onChange={(e) => setOnset(e.target.value)} className="w-full bg-ink-elevated rounded-lg px-3 py-2 text-sm text-cloud border border-transparent focus:border-lime/30 focus:outline-none">
              <option value="">Select...</option>
              <option value="sudden">Sudden</option>
              <option value="gradual">Gradual</option>
              <option value="overnight">Overnight</option>
              <option value="during_exercise">During exercise</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] text-cloud-dim mb-1 block">Type</label>
            <select value={painType} onChange={(e) => setPainType(e.target.value)} className="w-full bg-ink-elevated rounded-lg px-3 py-2 text-sm text-cloud border border-transparent focus:border-lime/30 focus:outline-none">
              <option value="">Select...</option>
              <option value="dull">Dull ache</option>
              <option value="sharp">Sharp</option>
              <option value="burning">Burning</option>
              <option value="tingling">Pins and needles</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-[10px] text-cloud-dim mb-1 block">Severity: {severity}/10</label>
          <input type="range" min="0" max="10" value={severity} onChange={(e) => setSeverity(parseInt(e.target.value))} className="w-full accent-lime" />
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setDuringExercise(true)}
            className={cn('flex-1 py-2 rounded-lg text-xs font-medium', duringExercise === true ? 'bg-lime text-ink-bg' : 'bg-ink-elevated text-cloud-dim')}
          >During exercise</button>
          <button
            onClick={() => setDuringExercise(false)}
            className={cn('flex-1 py-2 rounded-lg text-xs font-medium', duringExercise === false ? 'bg-lime text-ink-bg' : 'bg-ink-elevated text-cloud-dim')}
          >After exercise</button>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            { label: 'Swelling', val: swelling, set: setSwelling },
            { label: 'Bruising', val: bruising, set: setBruising },
            { label: 'ROM loss', val: romLoss, set: setRomLoss },
          ].map((item) => (
            <button
              key={item.label}
              onClick={() => item.set(!item.val)}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-medium', item.val ? 'bg-gold/20 text-gold' : 'bg-ink-elevated text-cloud-dim')}
            >
              {item.val && <Check className="w-3 h-3 inline mr-1" />}
              {item.label}
            </button>
          ))}
        </div>

        {/* Red flags */}
        <div>
          <p className="text-[10px] text-rust font-semibold mb-1.5">Red flags (check any that apply)</p>
          <div className="space-y-1">
            {RED_FLAGS.map((flag) => (
              <button
                key={flag}
                onClick={() => {
                  setRedFlags((prev) => prev.includes(flag) ? prev.filter(f => f !== flag) : [...prev, flag]);
                }}
                className={cn('w-full text-left p-2 rounded-lg text-xs flex items-center gap-2',
                  redFlags.includes(flag) ? 'bg-rust/15 text-rust' : 'bg-ink-elevated text-cloud-dim'
                )}
              >
                <div className={cn('w-4 h-4 rounded border flex items-center justify-center flex-shrink-0',
                  redFlags.includes(flag) ? 'border-rust bg-rust' : 'border-ink-border'
                )}>
                  {redFlags.includes(flag) && <Check className="w-3 h-3 text-ink-bg" />}
                </div>
                {flag}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[10px] text-cloud-dim mb-1 block">Duration (hours)</label>
          <input
            type="number"
            value={durationHours}
            onChange={(e) => setDurationHours(e.target.value)}
            placeholder="e.g. 48"
            className="w-full bg-ink-elevated rounded-lg px-3 py-2 text-sm text-cloud placeholder:text-cloud-dim/40 border border-transparent focus:border-lime/30 focus:outline-none"
          />
        </div>

        <div>
          <label className="text-[10px] text-cloud-dim mb-1 block">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any additional details..."
            rows={2}
            className="w-full bg-ink-elevated rounded-lg px-3 py-2 text-sm text-cloud placeholder:text-cloud-dim/40 border border-transparent focus:border-lime/30 focus:outline-none resize-none"
          />
        </div>

        {/* Triage preview */}
        <TriagePreview level={triage} redFlags={redFlags} />

        <Button onClick={handleSave} loading={saving} disabled={!bodyArea.trim()} className="w-full" size="sm">
          Save assessment
        </Button>
      </div>
    </Card>
  );
}

function TriagePreview({ level, redFlags }: { level: TriageLevel; redFlags: string[] }) {
  const config = {
    green: { color: 'text-lime', bg: 'bg-lime/5', border: 'border-lime/20', title: 'Green — Typical DOMS', desc: 'Likely normal muscle soreness. Self-care: light movement, hydration, protein, and rest. Monitor for 24-48h.' },
    yellow: { color: 'text-gold', bg: 'bg-gold/5', border: 'border-gold/20', title: 'Yellow — Monitor', desc: 'Monitor for 48-72h. Reduce load on this area. If pain worsens or does not improve, seek medical care.' },
    red: { color: 'text-rust', bg: 'bg-rust/5', border: 'border-rust/20', title: 'Red — Seek medical care', desc: 'Stop training immediately. These symptoms require evaluation by a healthcare professional.' },
  };
  const c = config[level];
  return (
    <div className={cn('rounded-xl border p-3', c.bg, c.border)}>
      <p className={cn('text-xs font-semibold mb-1', c.color)}>{c.title}</p>
      <p className="text-[11px] text-cloud-dim leading-relaxed">{c.desc}</p>
      {redFlags.length > 0 && (
        <div className="mt-2 space-y-1">
          {redFlags.map((f) => (
            <p key={f} className="text-[10px] text-rust flex items-center gap-1">
              <AlertTriangle className="w-2.5 h-2.5" /> {f}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function PainLogRow({ log, onDelete }: { log: PainLog; onDelete: () => void }) {
  const config = {
    green: { color: 'text-lime', bg: 'bg-lime/10', label: 'Green' },
    yellow: { color: 'text-gold', bg: 'bg-gold/10', label: 'Yellow' },
    red: { color: 'text-rust', bg: 'bg-rust/10', label: 'Red' },
  };
  const c = config[log.triage_level];
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-ink-elevated/40">
      <span className={cn('px-1.5 py-0.5 rounded text-[9px] font-bold', c.bg, c.color)}>{c.label}</span>
      <span className="text-xs text-cloud flex-1 truncate">{log.body_area}</span>
      <span className="text-[10px] text-cloud-dim">{log.severity}/10</span>
      <button onClick={onDelete} className="text-cloud-dim hover:text-rust">
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}
