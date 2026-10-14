import { useState } from 'react';
import { Activity, Brain, CheckCircle2, Clock3, Moon, ShieldAlert, TrendingUp, Zap } from 'lucide-react';
import type { FullRecoveryData } from '@/lib/recovery/store';

interface RecoveryIntelligenceVisualProps { data: FullRecoveryData }
type MetricKey = 'stress' | 'recovery' | 'sleep' | 'load' | 'hrv';

export function RecoveryIntelligenceVisual({ data }: RecoveryIntelligenceVisualProps) {
  const [activeMetric, setActiveMetric] = useState<MetricKey | null>(null);
  const checkin = data.todayCheckin;
  const metricDetails: Record<MetricKey, { label: string; value: string; detail: string; color: string }> = {
    stress: { label: 'Stress', value: checkin?.stress == null ? 'No data' : `${checkin.stress}/10`, detail: checkin?.stress == null ? 'Add stress to today\'s check-in.' : 'User-reported stress from today\'s check-in.', color: 'text-rust' },
    recovery: { label: 'Recovery', value: data.readiness.status === 'insufficient_data' ? 'No data' : data.readiness.status.replace(/_/g, ' '), detail: `${data.readiness.availableInputs.length} independent inputs support this rules-based interpretation.`, color: 'text-lime' },
    sleep: { label: 'Sleep', value: checkin?.sleep_hours == null ? 'No data' : `${checkin.sleep_hours}h`, detail: checkin?.sleep_hours == null ? 'Sleep duration is not recorded for today.' : 'User-reported sleep duration; no sleep stages are inferred.', color: 'text-sky' },
    load: { label: 'Training Load', value: data.acwr.acuteLoad === 0 ? 'No data' : `${data.acwr.acuteLoad} sets`, detail: data.acwr.hasEnoughData ? `Seven-day recorded load · ${data.acwr.band.replace('_', ' ')}.` : 'Recent sets are shown; trend classification needs four distinct weeks.', color: 'text-sky' },
    hrv: { label: 'HRV', value: checkin?.hrv_ms == null ? 'No data' : `${checkin.hrv_ms} ms`, detail: checkin?.hrv_ms == null ? 'HRV is optional and has not been recorded.' : `${checkin.hrv_source ?? 'manual'} · ${checkin.checkin_date} · Personal baseline not established until enough comparable records exist.`, color: 'text-lime' },
  };

  return (
    <section className="relative overflow-hidden rounded-3xl border border-[#1b4250] bg-[#03111d] p-3 shadow-[0_0_60px_rgba(15,154,190,0.1)] sm:p-5">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(26,111,139,0.18),transparent_45%)]" />
      <div className="relative mb-3 flex items-center justify-between">
        <div><p className="text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-300">Recovery intelligence</p><p className="mt-1 text-xs text-slate-400">Verified signals from your saved records</p></div>
        <Activity className="h-4 w-4 text-cyan-300" />
      </div>
      <div className="relative grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1.25fr_1fr] sm:grid-rows-[auto_auto_auto] sm:items-center">
        <MetricButton metric="stress" details={metricDetails.stress} position="sm:col-start-1 sm:row-start-1" onClick={setActiveMetric} />
        <div className="relative col-span-2 row-start-2 flex min-h-[180px] items-center justify-center sm:col-start-2 sm:col-span-1 sm:row-span-2 sm:row-start-1">
          <Waveform />
          <div className="relative flex h-36 w-36 items-center justify-center rounded-full border border-cyan-200/20 bg-[#061c2b]/70 shadow-[0_0_40px_rgba(55,214,225,0.16)]"><HeartDots /><span className="absolute text-[9px] uppercase tracking-[0.2em] text-cyan-100/60">signal motif</span></div>
        </div>
        <MetricButton metric="recovery" details={metricDetails.recovery} position="sm:col-start-3 sm:row-start-1" onClick={setActiveMetric} />
        <MetricButton metric="sleep" details={metricDetails.sleep} position="sm:col-start-1 sm:row-start-3" onClick={setActiveMetric} />
        <MetricButton metric="load" details={metricDetails.load} position="sm:col-start-3 sm:row-start-3" onClick={setActiveMetric} />
        <MetricButton metric="hrv" details={metricDetails.hrv} position="col-span-2 sm:col-start-2 sm:row-start-3" onClick={setActiveMetric} />
      </div>
      {activeMetric && <div className="relative mt-3 rounded-xl border border-cyan-300/20 bg-[#071d2b] p-3"><div className="flex items-center justify-between"><p className="text-xs font-semibold text-white">{metricDetails[activeMetric].label}</p><button onClick={() => setActiveMetric(null)} className="text-[10px] text-slate-400">Close</button></div><p className={`mt-1 text-lg font-bold ${metricDetails[activeMetric].color}`}>{metricDetails[activeMetric].value}</p><p className="mt-1 text-[11px] leading-relaxed text-slate-400">{metricDetails[activeMetric].detail}</p></div>}
      <ReadinessBanner data={data} />
    </section>
  );
}

function MetricButton({ metric, details, position, onClick }: { metric: MetricKey; details: { label: string; value: string; detail: string; color: string }; position: string; onClick: (metric: MetricKey) => void }) {
  const icons = { stress: ShieldAlert, recovery: CheckCircle2, sleep: Moon, load: TrendingUp, hrv: Brain };
  const Icon = icons[metric];
  return <button onClick={() => onClick(metric)} className={`relative z-10 flex min-h-[74px] flex-col justify-between rounded-xl border border-slate-700/80 bg-[#071a29]/90 p-3 text-left transition-colors hover:border-cyan-300/60 ${position}`}><span className={`flex h-6 w-6 items-center justify-center rounded-full bg-current/10 ${details.color}`}><Icon className="h-3.5 w-3.5" /></span><span className="mt-2 text-[9px] font-bold uppercase tracking-wider text-slate-400">{details.label}</span><span className={`text-sm font-semibold ${details.value === 'No data' ? 'text-slate-500' : 'text-white'}`}>{details.value}</span></button>;
}

function ReadinessBanner({ data }: { data: FullRecoveryData }) {
  const hasInterpretation = data.readiness.status !== 'insufficient_data';
  const label = !hasInterpretation ? 'Not enough data' : data.readiness.status === 'usual_training_may_be_reasonable' ? 'Usual training may be reasonable' : data.readiness.status === 'caution' ? 'Take care today' : 'Consider reducing intensity';
  return <div className="relative mt-3 flex items-center gap-3 rounded-xl border border-cyan-300/20 bg-[#071d2b] px-3 py-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-300/10 text-cyan-300">{hasInterpretation ? <CheckCircle2 className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}</span><div><p className="text-[10px] uppercase tracking-wider text-slate-400">Readiness · Rule {data.readiness.firedRuleId}</p><p className="text-sm font-semibold text-white">{label}</p><p className="text-[10px] text-slate-400">{data.readiness.disclaimer}</p></div><Zap className="ml-auto h-4 w-4 text-cyan-300/60" /></div>;
}

function Waveform() { return <svg aria-label="Decorative signal motif, not a measured ECG" className="pointer-events-none absolute inset-x-0 top-1/2 h-20 w-full -translate-y-1/2 opacity-70" viewBox="0 0 600 100" preserveAspectRatio="none"><path d="M0 54h35l8-5 8 6 9-4 8 5 10-4 10 3 8-8 8 11 10-7 10 7 12-5 10 3 10-36 10 52 10-26 11 20 12-8 10 4 11-55 10 67 10-31 10 21 10-7 12 3 10-42 10 59 11-29 12 20 11-8 12 4 12-32 10 44 11-18 12 11 10-4 12 3 10-18 11 21 12-6 12 4 10-5 12 3 12-4 15 4h60" fill="none" stroke="#a8f6ff" strokeWidth="1.5" strokeLinecap="round" /></svg>; }

function HeartDots() { return <svg aria-hidden="true" className="h-28 w-28 text-cyan-100/80" viewBox="0 0 120 120"><defs><pattern id="heart-grid" width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="currentColor" opacity=".72" /></pattern></defs><path d="M60 102C51 92 18 71 18 42c0-15 10-25 24-25 9 0 15 5 18 12 3-7 9-12 18-12 14 0 24 10 24 25 0 29-33 50-42 60Z" fill="url(#heart-grid)" stroke="currentColor" strokeOpacity=".45" /></svg>; }
