import { ChevronRight } from 'lucide-react';
import type { RecoveryMuscle } from '@/lib/recovery/muscles';
import { MUSCLE_LABELS } from '@/lib/recovery/muscles';
import type { MuscleRecoveryState } from '@/lib/recovery/engine';
import { cn } from '@/lib/utils';

interface BodyMapProps { showFront: boolean; muscleStates: MuscleRecoveryState[]; onMuscleClick: (muscle: RecoveryMuscle) => void }

const STATUS_COLORS = { green: '#8ff04b', orange: '#ffb84a', red: '#ff5964', no_data: '#234252' };
type Region = { id: RecoveryMuscle; front: string; back?: string; d: string };

const FRONT: Region[] = [
  { id: 'front_delts', front: 'Front delts', d: 'M42 93 Q30 94 25 108 L39 119 48 106Z M198 93 Q210 94 215 108 L201 119 192 106Z' },
  { id: 'upper_chest', front: 'Upper chest', d: 'M52 108 Q75 96 98 111 L98 130 Q75 124 54 137Z M142 111 Q165 96 188 108 L186 137 Q165 124 142 130Z' },
  { id: 'lower_chest', front: 'Lower chest', d: 'M54 137 Q75 124 98 130 L98 151 Q76 156 54 147Z M142 130 Q165 124 186 137 L186 147 Q164 156 142 151Z' },
  { id: 'biceps', front: 'Biceps', d: 'M29 116 Q18 126 24 160 L39 159 43 126Z M211 116 Q222 126 216 160 L201 159 197 126Z' },
  { id: 'forearms', front: 'Forearms', d: 'M23 163 L39 160 35 207 20 210Z M217 163 L201 160 205 207 220 210Z' },
  { id: 'abs', front: 'Abs', d: 'M101 128 Q120 132 139 128 L139 205 Q120 214 101 205Z' },
  { id: 'obliques', front: 'Obliques', d: 'M83 139 L101 145 101 204 86 193Z M157 139 L139 145 139 204 154 193Z' },
  { id: 'adductors', front: 'Adductors', d: 'M101 208 L119 211 113 283 101 270Z M139 208 L121 211 127 283 139 270Z' },
  { id: 'quads', front: 'Quadriceps', d: 'M78 201 Q96 204 113 210 L108 285 Q94 302 78 279Z M162 201 Q144 204 127 210 L132 285 Q146 302 162 279Z' },
  { id: 'calves', front: 'Calves', d: 'M83 292 Q96 300 108 288 L105 375 Q94 390 82 374Z M157 292 Q144 300 132 288 L135 375 Q146 390 158 374Z' },
];
const BACK: Region[] = [
  { id: 'rear_delts', front: 'Rear delts', d: 'M42 93 Q30 94 25 108 L39 119 48 106Z M198 93 Q210 94 215 108 L201 119 192 106Z' },
  { id: 'traps', front: 'Trapezius', d: 'M98 91 L120 106 142 91 154 125 120 143 86 125Z' },
  { id: 'lats', front: 'Lats', d: 'M86 126 L117 143 103 207 79 190Z M154 126 L123 143 137 207 161 190Z' },
  { id: 'mid_back', front: 'Mid back', d: 'M103 143 L120 149 137 143 137 204 120 214 103 204Z' },
  { id: 'lower_back', front: 'Lower back', d: 'M103 204 L120 214 137 204 139 250 120 260 101 250Z' },
  { id: 'triceps', front: 'Triceps', d: 'M29 116 Q18 126 24 160 L39 159 43 126Z M211 116 Q222 126 216 160 L201 159 197 126Z' },
  { id: 'forearms', front: 'Forearms', d: 'M23 163 L39 160 35 207 20 210Z M217 163 L201 160 205 207 220 210Z' },
  { id: 'glutes', front: 'Glutes', d: 'M79 190 Q99 194 120 210 Q141 194 161 190 L162 248 Q142 270 120 258 Q98 270 78 248Z' },
  { id: 'hamstrings', front: 'Hamstrings', d: 'M78 252 Q94 264 108 253 L108 316 Q94 331 78 311Z M162 252 Q146 264 132 253 L132 316 Q146 331 162 311Z' },
  { id: 'calves', front: 'Calves', d: 'M83 319 Q96 326 108 316 L105 375 Q94 390 82 374Z M157 319 Q144 326 132 316 L135 375 Q146 390 158 374Z' },
];

export function BodyMap({ showFront, muscleStates, onMuscleClick }: BodyMapProps) {
  const regions = showFront ? FRONT : BACK;
  const stateByMuscle = new Map(muscleStates.map((state) => [state.muscle, state]));
  return <div className="rounded-2xl border border-[#153442] bg-[radial-gradient(circle_at_50%_35%,rgba(22,96,120,.24),transparent_55%),#04121d] p-3"><div className="flex justify-center"><svg viewBox="0 0 240 420" className="h-[360px] w-full max-w-[300px]" role="img" aria-label={`${showFront ? 'Front' : 'Back'} interactive anatomy map`}><defs><filter id="body-glow"><feGaussianBlur stdDeviation="4" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs><circle cx="120" cy="45" r="24" fill="#0a2534" stroke="#426574" strokeWidth="2" /><path d="M102 68 Q120 78 138 68 L158 96 176 188 161 204 162 250 158 285 151 320 135 320 120 280 105 320 89 320 82 285 78 250 64 204 49 188 64 96Z" fill="#081e2c" stroke="#426574" strokeWidth="2" /><path d="M65 95L43 113 29 208M175 95L197 113 211 208M89 318L82 378M151 318L158 378" fill="none" stroke="#426574" strokeWidth="8" strokeLinecap="round" />{regions.map((region) => { const state = stateByMuscle.get(region.id); const fill = state?.recoveryPercent == null ? STATUS_COLORS.no_data : state.recoveryPercent <= 50 ? STATUS_COLORS.red : state.recoveryPercent <= 85 ? STATUS_COLORS.orange : STATUS_COLORS.green; return <path key={region.id} d={region.d} fill={fill} fillOpacity=".88" stroke="#a7f7ff" strokeOpacity=".5" strokeWidth="1" filter="url(#body-glow)" role="button" tabIndex={0} aria-label={`Select ${MUSCLE_LABELS[region.id]}`} onClick={() => onMuscleClick(region.id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onMuscleClick(region.id); }} className="cursor-pointer transition-all hover:brightness-125" />; })}</svg></div><p className="mt-1 text-center text-[10px] uppercase tracking-[.2em] text-cyan-100/60">Tap a highlighted region for verified details</p></div>;
}

export function MuscleStatusLegend({ className }: { className?: string }) { return <div className={cn('flex flex-wrap items-center gap-3 text-[10px] text-cloud-dim', className)}><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-[#8ff04b]" />Recovered estimate</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-[#ffb84a]" />Recovering</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-[#ff5964]" />Needs attention</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-[#234252]" />No data</span></div>; }

export function MuscleGroupList({ muscleStates, onMuscleClick }: { muscleStates: MuscleRecoveryState[]; onMuscleClick: (muscle: RecoveryMuscle) => void }) { return <div className="grid grid-cols-2 gap-2">{muscleStates.map((state) => <button key={state.muscle} onClick={() => onMuscleClick(state.muscle)} className="flex items-center justify-between rounded-xl border border-[#153442] bg-[#071a29] px-3 py-2.5 text-left hover:border-cyan-300/50"><span><span className="block text-xs font-semibold text-cloud">{MUSCLE_LABELS[state.muscle]}</span><span className="block text-[10px] text-cloud-dim">{state.recoveryPercent == null ? 'No data' : `${Math.round(state.recoveryPercent)}% estimated`}</span></span><ChevronRight className="h-3.5 w-3.5 text-cyan-200/60" /></button>)}</div>; }
