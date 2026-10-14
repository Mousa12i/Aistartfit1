import { useEffect, useRef, useState } from 'react';
import { Bookmark, Check, Send, Sparkles, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Notice } from '@/screens/nutrition/ui';
import { FunctionCallError } from '@/lib/nutrition/api';
import { clearCoachMessages, listCoachMessages, sendCoachMessage, type CoachBlock, type CoachMessage, type CoachReply } from '@/lib/training/api';
import { ClaimSources } from './PlanView';
import type { PlanAction } from '@/lib/training/plan-actions';
import type { IntakeDraft } from '@/lib/training/intake';
import type { TrainingHistorySummary, TrainingPlan } from '@/lib/training/plan-types';

const SUGGESTIONS = [
  'Why does my plan use these sets and reps?',
  'Swap an exercise that hurts my shoulder',
  'What muscles does the Romanian deadlift train?',
  'How should I progress next week?',
];

function describeAction(a: PlanAction, name: (id: string) => string, dayLabel: (i: number) => string): string {
  switch (a.type) {
    case 'swap_exercise':
      return `${dayLabel(a.dayIndex)}: swap ${name(a.exerciseId)} for ${name(a.newExerciseId)}`;
    case 'set_sets':
      return `${dayLabel(a.dayIndex)}: ${name(a.exerciseId)} → ${a.sets} sets`;
    case 'set_reps':
      return `${dayLabel(a.dayIndex)}: ${name(a.exerciseId)} → ${a.repsMin}–${a.repsMax}`;
    case 'set_rest':
      return `${dayLabel(a.dayIndex)}: ${name(a.exerciseId)} → rest ${a.restSeconds} s`;
    case 'remove_exercise':
      return `${dayLabel(a.dayIndex)}: remove ${name(a.exerciseId)}`;
    case 'add_exercise':
      return `${dayLabel(a.dayIndex)}: add ${name(a.exerciseId)} ${a.sets} × ${a.repsMin}–${a.repsMax}`;
    case 'move_exercise':
      return `${dayLabel(a.dayIndex)}: move ${name(a.exerciseId)} to position ${a.toIndex + 1}`;
  }
}

export function CoachChat({
  plan,
  draft,
  missing,
  history,
  exerciseName,
  onApplyAction,
  onOpenExercise,
}: {
  plan: TrainingPlan | null;
  draft: IntakeDraft;
  missing: string[];
  history: TrainingHistorySummary | null;
  exerciseName: (id: string) => string;
  onApplyAction: (a: PlanAction) => string | null;
  onOpenExercise: (id: string) => void;
}) {
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [available, setAvailable] = useState(true);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState<Record<string, string>>({});
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listCoachMessages()
      .then((r) => {
        setMessages(r.messages);
        setAvailable(r.available);
      })
      .catch(() => setAvailable(true));
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length, sending]);

  const dayLabel = (i: number) => plan?.days[i]?.label ?? `Day ${i + 1}`;

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || sending) return;
    setSending(true);
    setError(null);
    const now = new Date().toISOString();
    setMessages((m) => [...m, { id: `local-${now}`, role: 'user', content: message, data: null, created_at: now }]);
    setInput('');
    try {
      const reply = await sendCoachMessage({ message, plan, draft, missing, history });
      const content = [...reply.blocks.map((b) => b.text), ...reply.ask].join('\n\n');
      setMessages((m) => [...m, { id: `reply-${Date.now()}`, role: 'assistant', content, data: reply, created_at: new Date().toISOString() }]);
    } catch (e) {
      if (e instanceof FunctionCallError && e.status === 429) {
        const p = e.payload as { message?: string; upgrade_text?: string };
        setError([p.message, p.upgrade_text].filter(Boolean).join(' ') || e.message);
      } else setError(e instanceof Error ? e.message : 'The coach could not answer.');
    } finally {
      setSending(false);
    }
  };

  const clear = async () => {
    try {
      await clearCoachMessages();
      setMessages([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not clear the chat.');
    }
  };

  return (
    <div className="flex flex-col">
      {!available && (
        <Notice tone="warn" title="Database update needed">
          The training coach needs the latest database migration (<code className="text-cloud">20261014091000_training_brain.sql</code>).
        </Notice>
      )}
      <div className="space-y-3 pb-3">
        {messages.length === 0 && (
          <div className="rounded-2xl border border-ink-border bg-ink-surface p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-cloud">
              <Sparkles className="h-4 w-4 text-lime" /> Ask about your training
            </p>
            <p className="mt-1 text-xs leading-relaxed text-cloud-dim">
              Answers come only from StartFit's checked studies, the exercise library and your own data. If something is not covered, the coach says so instead of guessing. Plan changes are checked before they are applied.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" onClick={() => void send(s)} className="rounded-full bg-ink-elevated px-3 py-1.5 text-[11px] text-cloud-dim hover:text-cloud">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) =>
          m.role === 'user' ? (
            <div key={m.id} className="ml-10 rounded-2xl rounded-br-md bg-lime/15 px-3.5 py-2.5 text-sm text-cloud">
              {m.content}
            </div>
          ) : (
            <AssistantMessage
              key={m.id}
              m={m}
              exerciseName={exerciseName}
              describe={(a) => describeAction(a, exerciseName, dayLabel)}
              canApply={!!plan}
              applied={applied}
              onApply={(key, a) => {
                const err = onApplyAction(a);
                setApplied((s) => ({ ...s, [key]: err ? `Not applied: ${err}` : 'Applied' }));
              }}
              onOpenExercise={onOpenExercise}
            />
          ),
        )}
        {sending && <div className="mr-10 animate-pulse rounded-2xl bg-ink-surface px-3.5 py-3 text-xs text-cloud-dim">Checking your data and the evidence…</div>}
        {error && <Notice tone="danger">{error}</Notice>}
        <div ref={endRef} />
      </div>

      <div className="sticky bottom-0 -mx-5 border-t border-ink-border/60 bg-ink-bg/95 px-5 pb-4 pt-3 backdrop-blur-xl safe-bottom">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
          className="flex items-end gap-2"
        >
          {messages.length > 0 && (
            <button type="button" onClick={() => void clear()} aria-label="Clear chat" className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-ink-elevated text-cloud-dim hover:text-rust">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
            rows={1}
            maxLength={2000}
            placeholder="Ask the training coach…"
            className="max-h-32 min-h-[44px] flex-1 resize-none rounded-xl border border-ink-border bg-ink-elevated px-3.5 py-3 text-sm text-cloud placeholder:text-cloud-dim/60 focus:border-lime/50 focus:outline-none"
          />
          <button type="submit" disabled={!input.trim() || sending} aria-label="Send" className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-lime text-ink-bg disabled:opacity-40">
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}

function AssistantMessage({
  m,
  exerciseName,
  describe,
  canApply,
  applied,
  onApply,
  onOpenExercise,
}: {
  m: CoachMessage;
  exerciseName: (id: string) => string;
  describe: (a: PlanAction) => string;
  canApply: boolean;
  applied: Record<string, string>;
  onApply: (key: string, a: PlanAction) => void;
  onOpenExercise: (id: string) => void;
}) {
  const data: CoachReply | null = m.data;
  const blocks: CoachBlock[] = data?.blocks ?? [{ text: m.content, basis: 'general', claimIds: [], exerciseIds: [] }];
  return (
    <div className="mr-6 space-y-2 rounded-2xl rounded-bl-md border border-ink-border bg-ink-surface px-3.5 py-3">
      {blocks.map((b, i) => (
        <div key={i}>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-cloud" dir="auto">{b.text}</p>
          {b.basis === 'evidence' && <ClaimSources claimIds={b.claimIds} className="mt-1.5" />}
          {b.basis === 'library' && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {b.exerciseIds.map((id) => (
                <button key={id} type="button" onClick={() => onOpenExercise(id)} className="rounded-md bg-lime/10 px-2 py-0.5 text-[10px] text-lime">
                  {exerciseName(id)}
                </button>
              ))}
            </div>
          )}
          {(b.basis === 'plan' || b.basis === 'user_data') && <p className="mt-1 text-[10px] text-cloud-dim">From {b.basis === 'plan' ? 'your plan' : 'your data'}</p>}
        </div>
      ))}
      {data?.ask?.map((q, i) => (
        <p key={`ask-${i}`} className="text-sm font-medium text-lime" dir="auto">{q}</p>
      ))}
      {data?.actions && data.actions.length > 0 && (
        <div className="space-y-1.5 border-t border-ink-border/60 pt-2">
          <p className="text-[11px] font-semibold text-cloud-dim">Suggested changes</p>
          {data.actions.map((a, i) => {
            const key = `${m.id}-${i}`;
            return (
              <div key={key} className="flex items-center gap-2 rounded-lg bg-ink-elevated/60 px-2.5 py-2">
                <p className="min-w-0 flex-1 text-[11px] text-cloud">{describe(a)}</p>
                {applied[key] ? (
                  <span className={cn('text-[10px]', applied[key] === 'Applied' ? 'text-lime' : 'text-rust')}>{applied[key]}</span>
                ) : (
                  <button type="button" disabled={!canApply} onClick={() => onApply(key, a)} className="flex items-center gap-1 rounded-lg bg-lime px-2.5 py-1 text-[11px] font-bold text-ink-bg disabled:opacity-40">
                    <Check className="h-3 w-3" /> Apply
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
      {data?.memorySaved && data.memorySaved.length > 0 && (
        <p className="flex items-center gap-1.5 text-[10px] text-cloud-dim">
          <Bookmark className="h-3 w-3 text-lime" /> Saved to memory: {data.memorySaved.map((x) => x.content).join(' · ')}
        </p>
      )}
    </div>
  );
}
