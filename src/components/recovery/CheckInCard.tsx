import { useEffect, useState } from 'react';
import { Activity, Brain, Check, Droplets, Heart, Moon, Utensils } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import type { DailyCheckin } from '@/lib/recovery/store';
import { upsertDailyCheckin } from '@/lib/recovery/store';
import { fetchEntries, fetchWater } from '@/lib/nutrition/api';
import { todayKey } from '@/lib/nutrition/dates';

interface CheckInCardProps { checkin: DailyCheckin | null; weightKg: number | null; onSaved: () => void; onError: (message: string) => void }

export function CheckInCard({ checkin, weightKg, onSaved, onError }: CheckInCardProps) {
  const [sleep, setSleep] = useState(''); const [hydration, setHydration] = useState(''); const [stress, setStress] = useState(''); const [restingHr, setRestingHr] = useState(''); const [hrv, setHrv] = useState(''); const [protein, setProtein] = useState(''); const [saving, setSaving] = useState(false); const [saved, setSaved] = useState(false); const [confirmHr, setConfirmHr] = useState(false); const [hrVerified, setHrVerified] = useState(false);
  useEffect(() => { setSleep(checkin?.sleep_hours?.toString() ?? ''); setHydration(checkin?.hydration_l?.toString() ?? ''); setStress(checkin?.stress?.toString() ?? ''); setRestingHr((checkin?.resting_hr_bpm ?? checkin?.resting_hr)?.toString() ?? ''); setHrv(checkin?.hrv_ms?.toString() ?? ''); setProtein(checkin?.protein_g?.toString() ?? ''); setHrVerified(checkin?.hr_verified ?? false); }, [checkin]);
  // Linked to the Nutrition tab: pre-fill today's protein and water from the food diary when the check-in has none.
  const [fromDiary, setFromDiary] = useState(false);
  useEffect(() => {
    if (checkin?.protein_g != null && checkin?.hydration_l != null) return;
    let cancelled = false;
    const today = todayKey();
    Promise.all([fetchEntries(today, today), fetchWater(today, today)])
      .then(([entries, water]) => {
        if (cancelled) return;
        const proteinTotal = entries.reduce((sum, e) => sum + e.protein, 0);
        const litres = water.reduce((sum, w) => sum + w.ml, 0) / 1000;
        let used = false;
        if (checkin?.protein_g == null && proteinTotal > 0) { setProtein((current) => current || String(Math.round(proteinTotal))); used = true; }
        if (checkin?.hydration_l == null && litres > 0) { setHydration((current) => current || litres.toFixed(1)); used = true; }
        setFromDiary(used);
      })
      .catch(() => { /* the diary is optional here */ });
    return () => { cancelled = true; };
  }, [checkin]);
  const handleSave = async (verified = hrVerified) => { const parsedHr = restingHr ? Number(restingHr) : null; if (parsedHr != null && (parsedHr < 40 || parsedHr > 120) && !verified) { setConfirmHr(true); return; } setSaving(true); setSaved(false); try { await upsertDailyCheckin({ sleep_hours: sleep ? Number(sleep) : null, hydration_l: hydration ? Number(hydration) : null, stress: stress ? Number(stress) : null, resting_hr: parsedHr, resting_hr_bpm: parsedHr, hrv_ms: hrv ? Number(hrv) : null, body_weight: weightKg, protein_g: protein ? Number(protein) : null, sleep_source: sleep ? 'manual' : null, hrv_source: hrv ? 'manual' : null, hr_verified: hrVerified }); setSaved(true); onSaved(); } catch (error) { onError(error instanceof Error ? error.message : 'Could not save check-in.'); } finally { setSaving(false); } };
  const confirmAndSave = async () => { setHrVerified(true); setConfirmHr(false); await handleSave(true); };
  const target = weightKg == null ? null : weightKg * 1.6;
  return <Card className="p-4"><div className="mb-3 flex items-center gap-2"><Check className="h-4 w-4 text-lime" /><h3 className="text-sm font-semibold text-cloud">Daily Check-in</h3></div><p className="mb-3 text-[11px] text-cloud-dim">Empty fields stay unrecorded. Values outside the safe verification range need confirmation.</p><div className="grid grid-cols-2 gap-3"><Field icon={<Moon className="h-3.5 w-3.5" />} label="Sleep (hours)" value={sleep} onChange={setSleep} type="number" step="0.25" /><Field icon={<Droplets className="h-3.5 w-3.5" />} label="Water (litres)" value={hydration} onChange={setHydration} type="number" step="0.1" /><Field icon={<Brain className="h-3.5 w-3.5" />} label="Stress (1-10)" value={stress} onChange={setStress} type="number" /><Field icon={<Utensils className="h-3.5 w-3.5" />} label="Protein (g)" value={protein} onChange={setProtein} type="number" /><Field icon={<Heart className="h-3.5 w-3.5" />} label="Resting HR (bpm)" value={restingHr} onChange={setRestingHr} type="number" /><Field icon={<Activity className="h-3.5 w-3.5" />} label="HRV (ms)" value={hrv} onChange={setHrv} type="number" /></div>{target == null ? <p className="mt-2 text-[10px] text-cloud-dim">Add your body weight to see a protein target.</p> : <p className="mt-2 text-[10px] text-sky">Protein target: {target.toFixed(1)} g/day · body weight × 1.6 g/kg</p>}{fromDiary && <p className="mt-1 text-[10px] text-lime">Protein and water filled in from your Nutrition diary — edit if needed.</p>}{confirmHr && <div className="mt-3 rounded-xl border border-gold/30 bg-gold/10 p-3"><p className="text-xs font-semibold text-cloud">Confirm resting HR {restingHr} bpm</p><p className="mt-1 text-[10px] text-cloud-dim">This value is outside the usual verification range. Confirm it only if it is an intentional, valid reading.</p><button onClick={confirmAndSave} className="mt-2 rounded-lg bg-gold px-3 py-2 text-[10px] font-bold text-ink-bg">Confirm and save</button></div>}<Button onClick={() => handleSave()} size="sm" variant={saved ? 'outline' : 'primary'} loading={saving} disabled={saving} className="mt-3 w-full">{saved ? <><Check className="h-3.5 w-3.5" /> Saved</> : 'Save check-in'}</Button></Card>;
}

function Field({ icon, label, value, onChange, type, step }: { icon: React.ReactNode; label: string; value: string; onChange: (value: string) => void; type: string; step?: string }) { return <div><label className="mb-1 flex items-center gap-1 text-[10px] text-cloud-dim"><span className="text-lime">{icon}</span>{label}</label><input type={type} step={step} value={value} onChange={(event) => onChange(event.target.value)} inputMode="decimal" placeholder="No data" className="w-full rounded-lg border border-transparent bg-ink-elevated px-2.5 py-2 text-sm text-cloud placeholder:text-cloud-dim/40 focus:border-lime/30 focus:outline-none" /></div>; }
