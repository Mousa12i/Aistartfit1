import { useEffect, useMemo, useState } from 'react';
import { BatteryCharging, ChevronDown, Footprints, Moon, StretchHorizontal, UserCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { averageSleep, deloadState, loadRecoveryPlan, shortDate, weekdayNames, type RecoveryPlan } from '@/lib/coach/recovery-plan';
import { localDateKey } from '@/lib/recovery/store';

/** "From your coach" on the Recovery screen: targets, today's rest or mobility day, routine and deload. */
export function CoachRecoveryCard({ sleepHistory }: { sleepHistory: { date: string; sleepHours: number }[] }) {
  const { user } = useAuth();
  const { t, dir, lang } = useI18n();
  const [plan, setPlan] = useState<RecoveryPlan | null>(null);
  const [open, setOpen] = useState(false);
  const today = localDateKey(new Date());
  const dow = new Date().getDay();
  const names = useMemo(() => weekdayNames(lang), [lang]);

  useEffect(() => {
    if (!user) return;
    loadRecoveryPlan(user.id).then(setPlan).catch(() => setPlan(null));
  }, [user]);

  if (!plan) return null;
  const deload = deloadState(plan, today);
  const sleep = averageSleep(sleepHistory, today);
  const restToday = plan.rest_days.includes(dow);
  const mobilityToday = plan.mobility.length > 0 && plan.mobility_days.includes(dow);
  const order = [1, 2, 3, 4, 5, 6, 0];

  return (
    <section className="rounded-2xl border border-[#8ad8f3]/30 bg-[#0d1820] p-4" dir={dir} data-testid="coach-recovery-card">
      <div className="mb-3 flex items-center gap-2 text-[14px] font-black text-white"><UserCheck className="h-4 w-4 text-[#8ad8f3]" />{t('recplan.fromCoach')}</div>

      {deload.kind === 'active' && (
        <div className="mb-3 rounded-xl border border-gold/40 bg-gold/10 p-3" data-testid="deload-active">
          <div className="flex items-center gap-2 text-sm font-bold text-gold"><BatteryCharging className="h-4 w-4" />{t('recplan.deloadNow', { day: deload.day, of: deload.of })}</div>
          <p className="mt-1 text-xs text-cloud">{t('recplan.deloadNowBody', { pct: deload.pct })}</p>
          {plan.deload_note && <p className="mt-1 whitespace-pre-line text-xs text-cloud-dim" dir="auto">{plan.deload_note}</p>}
        </div>
      )}
      {deload.kind === 'upcoming' && (
        <div className="mb-3 rounded-xl bg-[#172431] p-3 text-xs text-cloud" data-testid="deload-upcoming">
          <span className="font-bold text-gold">{t('recplan.deloadSoon', { n: deload.inDays })}</span>
          <span className="ms-1 text-cloud-dim">{t('recplan.deloadRange', { start: shortDate(deload.start, lang), end: shortDate(deload.end, lang) })}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        {plan.sleep_hours != null && (
          <div className="rounded-xl bg-[#172431] p-3">
            <div className="flex items-center gap-1 text-[11px] text-cloud-dim"><Moon className="h-3.5 w-3.5 text-[#8ad8f3]" />{t('recplan.sleepTarget')}</div>
            <div className="mt-1 text-lg font-black text-white">{t('recplan.hours', { h: plan.sleep_hours })}</div>
            <div className={cn('text-[11px]', sleep && sleep.avg >= plan.sleep_hours ? 'text-lime' : 'text-cloud-dim')} data-testid="sleep-vs-target">
              {sleep ? t('recplan.sleepAvg', { h: sleep.avg, n: sleep.nights }) : t('recplan.sleepNoData')}
            </div>
          </div>
        )}
        {plan.steps != null && (
          <div className="rounded-xl bg-[#172431] p-3">
            <div className="flex items-center gap-1 text-[11px] text-cloud-dim"><Footprints className="h-3.5 w-3.5 text-lime" />{t('recplan.stepsTarget')}</div>
            <div className="mt-1 text-lg font-black text-white" dir="ltr">{plan.steps.toLocaleString(lang)}</div>
            <div className="text-[11px] text-cloud-dim">{t('recplan.perDay')}</div>
          </div>
        )}
      </div>

      {plan.rest_days.length > 0 && (
        <div className="mt-3">
          <div className="mb-1.5 text-[11px] text-cloud-dim">{restToday ? <span className="font-bold text-lime" data-testid="rest-today">{t('recplan.restToday')}</span> : t('recplan.restDays')}</div>
          <div className="grid grid-cols-7 gap-1">
            {order.map((d) => (
              <span key={d} className={cn('rounded-md py-1 text-center text-[10px]', plan.rest_days.includes(d) ? 'bg-lime/15 font-bold text-lime' : 'bg-[#172431] text-cloud-muted', d === dow && 'ring-1 ring-white/40')}>{names[d]}</span>
            ))}
          </div>
        </div>
      )}

      {plan.mobility.length > 0 && (
        <div className="mt-3 rounded-xl bg-[#172431]">
          <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center gap-2 px-3 py-2.5 text-start" data-testid="mobility-toggle">
            <StretchHorizontal className="h-4 w-4 text-lime" />
            <span className="flex-1 text-sm font-bold text-white">{t('recplan.mobility')}</span>
            {mobilityToday && <span className="rounded-full bg-lime/15 px-2 py-0.5 text-[10px] font-bold text-lime">{t('recplan.today')}</span>}
            <span className="text-[11px] text-cloud-dim">{plan.mobility.length}</span>
            <ChevronDown className={cn('h-4 w-4 text-cloud-dim transition-transform', open && 'rotate-180')} />
          </button>
          {open && (
            <ol className="space-y-1.5 px-3 pb-3" data-testid="mobility-list">
              {plan.mobility.map((m, i) => (
                <li key={m.id} className="flex gap-2 text-sm">
                  <span className="w-5 flex-shrink-0 text-cloud-muted" dir="ltr">{i + 1}.</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex justify-between gap-2"><span className="text-white" dir="auto">{m.name}</span>{m.dose && <span className="flex-shrink-0 text-xs text-cloud-dim" dir="ltr">{m.dose}</span>}</span>
                    {m.note && <span className="block text-[11px] text-cloud-dim" dir="auto">{m.note}</span>}
                  </span>
                </li>
              ))}
              {plan.mobility_days.length > 0 && <li className="pt-1 text-[11px] text-cloud-dim">{t('recplan.onDays', { days: order.filter((d) => plan.mobility_days.includes(d)).map((d) => names[d]).join(' · ') })}</li>}
            </ol>
          )}
        </div>
      )}

      {plan.notes && <p className="mt-3 whitespace-pre-line text-xs leading-relaxed text-cloud-dim" dir="auto">{plan.notes}</p>}
    </section>
  );
}
