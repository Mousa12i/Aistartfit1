import { useEffect, useState } from 'react';
import { ShieldCheck, Trash2, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { useI18n, type MessageKey } from '@/lib/i18n';
import { addReply, deleteReply, listReplies, saveCoachBrand, type QuickReply } from '@/lib/coach/api';
import { Sheet } from './ui';

const DAYS: MessageKey[] = ['coach.daySun', 'coach.dayMon', 'coach.dayTue', 'coach.dayWed', 'coach.dayThu', 'coach.dayFri', 'coach.daySat'];

const input = 'w-full rounded-xl border border-ink-border bg-ink-bg px-3.5 py-2.5 text-sm text-cloud placeholder:text-cloud-muted focus:border-lime/50 focus:outline-none';

/** Coach brand, review day and quick replies. */
export function CoachSettingsSheet({ open, onClose, userId }: { open: boolean; onClose: () => void; userId: string }) {
  const { profile, refreshProfile } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [day, setDay] = useState(1);
  const [replies, setReplies] = useState<QuickReply[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDay(profile?.coach_checkin_day ?? 1);
    listReplies(userId).then(setReplies).catch(() => undefined);
  }, [open, profile, userId]);

  const save = async () => {
    setError(null);
    try {
      await saveCoachBrand(userId, { coach_checkin_day: day });
      await refreshProfile();
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1600);
    } catch {
      setError(t('coach.saveError'));
    }
  };

  const add = async () => {
    if (!title.trim() || !body.trim()) return;
    try {
      await addReply(userId, title.trim().slice(0, 80), body.trim());
      setTitle('');
      setBody('');
      setReplies(await listReplies(userId));
    } catch {
      setError(t('coach.saveError'));
    }
  };

  const addStarters = async () => {
    for (const [k1, k2] of [['coach.starter1Title', 'coach.starter1Body'], ['coach.starter2Title', 'coach.starter2Body'], ['coach.starter3Title', 'coach.starter3Body']] as [MessageKey, MessageKey][]) {
      await addReply(userId, t(k1), t(k2)).catch(() => undefined);
    }
    setReplies(await listReplies(userId));
  };

  return (
    <Sheet open={open} title={t('coach.settings')} onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => { onClose(); navigate('/coach/profile'); }} className="flex items-center justify-center gap-2 rounded-xl border border-ink-border py-3 text-xs font-semibold text-cloud" data-testid="edit-coach-profile">
            <UserRound className="h-4 w-4 text-lime" />{t('coach.editProfile')}
          </button>
          <button type="button" onClick={() => { onClose(); navigate('/coach/rules'); }} className="flex items-center justify-center gap-2 rounded-xl border border-ink-border py-3 text-xs font-semibold text-cloud">
            <ShieldCheck className="h-4 w-4 text-lime" />{t('coach.viewRules')}
          </button>
        </div>
        <div>
          <span className="mb-1.5 block text-xs text-cloud-dim">{t('coach.checkinDay')}</span>
          <div className="flex flex-wrap gap-1.5">
            {DAYS.map((k, i) => (
              <button key={k} type="button" onClick={() => setDay(i)} className={cn('rounded-full border px-3 py-1.5 text-xs', day === i ? 'border-lime bg-lime/10 text-cloud' : 'border-ink-border text-cloud-dim')}>
                {t(k)}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-cloud-muted">{t('coach.checkinDayHelp')}</p>
        </div>
        {error && <p className="text-xs text-rust">{error}</p>}
        <button type="button" onClick={save} className="w-full rounded-xl bg-lime py-3 text-sm font-bold text-ink-bg">{saved ? t('coach.saved') : t('common.save')}</button>

        <div className="border-t border-ink-border pt-4">
          <h3 className="text-sm font-semibold text-cloud">{t('coach.quickReplies')}</h3>
          <p className="mb-3 mt-0.5 text-[11px] text-cloud-dim">{t('coach.quickRepliesHelp')}</p>
          <ul className="mb-3 space-y-2">
            {replies.map((r) => (
              <li key={r.id} className="flex items-start gap-2 rounded-xl bg-ink-elevated px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-cloud">{r.title}</div>
                  <div className="line-clamp-2 text-[11px] text-cloud-dim">{r.body}</div>
                </div>
                <button type="button" aria-label={t('coach.remove')} onClick={async () => { await deleteReply(r.id); setReplies(await listReplies(userId)); }} className="text-cloud-muted hover:text-rust">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
          {replies.length === 0 && (
            <button type="button" onClick={addStarters} className="mb-3 w-full rounded-xl border border-dashed border-ink-border py-2.5 text-xs font-semibold text-cloud-dim">{t('coach.addStarters')}</button>
          )}
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('coach.replyTitle')} className={cn(input, 'mb-2')} />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder={t('coach.replyBody')} className={input} />
          <button type="button" onClick={add} disabled={!title.trim() || !body.trim()} className="mt-2 w-full rounded-xl border border-lime/40 py-2.5 text-sm font-semibold text-lime disabled:opacity-40">{t('coach.addReply')}</button>
        </div>
      </div>
    </Sheet>
  );
}
