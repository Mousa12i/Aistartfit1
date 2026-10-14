import { useEffect, useRef, useState } from 'react';
import { OctagonAlert, Bookmark, Send, Stethoscope, Trash2 } from 'lucide-react';
import { FunctionCallError } from '@/lib/nutrition/api';
import {
  clearRecoveryCoachMessages,
  listRecoveryCoachMessages,
  sendRecoveryCoachMessage,
  type RecoveryCoachLink,
  type RecoveryCoachMessage,
  type RecoveryCoachReply,
} from '@/lib/recovery/doctor/coach-api';
import { RecoverySources } from './ui';

const SUGGESTIONS = [
  'Should I train hard today?',
  'Why are my legs still sore after 3 days?',
  'Are ice baths good after lifting?',
  'Do I need a lighter week?',
  'كيف بحسن نومي للريكفري؟',
];

export const LINK_LABELS: Record<RecoveryCoachLink, string> = {
  checkin: 'Morning check-in',
  rate_session: 'Rate a session',
  triage: 'Pain triage',
  return_to_training: 'Return to training',
  methods: 'Recovery methods',
  deload: 'Lighter-week detector',
  sleep: 'Sleep',
  report_pdf: 'PDF report',
  nutrition: 'Nutrition',
};

export function RecoveryCoachChat({ getSnapshot, onLink }: { getSnapshot: () => unknown; onLink: (l: RecoveryCoachLink) => void }) {
  const [messages, setMessages] = useState<RecoveryCoachMessage[]>([]);
  const [available, setAvailable] = useState(true);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRecoveryCoachMessages()
      .then((r) => {
        setMessages(r.messages);
        setAvailable(r.available);
      })
      .catch(() => setAvailable(true));
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length, sending]);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || sending) return;
    setSending(true);
    setError(null);
    const now = new Date().toISOString();
    setMessages((m) => [...m, { id: `local-${now}`, role: 'user', content: message, data: null, created_at: now }]);
    setInput('');
    try {
      const reply = await sendRecoveryCoachMessage(message, getSnapshot());
      setRemaining(reply.remaining);
      setMessages((m) => [...m, { id: `reply-${Date.now()}`, role: 'assistant', content: reply.blocks.map((b) => b.text).join('\n\n'), data: reply, created_at: new Date().toISOString() }]);
    } catch (e) {
      if (e instanceof FunctionCallError && e.status === 429) {
        const p = e.payload as { message?: string; upgrade_text?: string };
        setError([p.message, p.upgrade_text].filter(Boolean).join(' ') || e.message);
      } else setError(e instanceof Error ? e.message : 'The coach could not answer.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col" data-testid="recovery-coach">
      {!available && <p className="mb-3 rounded-xl border border-[#ffd34f]/30 bg-[#ffd34f]/10 p-3 text-xs text-cloud">The recovery coach needs the latest database update (20261014093000_recovery_doctor_v2.sql).</p>}
      <div className="space-y-3 pb-3">
        {messages.length === 0 && (
          <div className="rounded-2xl border border-[#243442] bg-[#0d1820] p-4">
            <p className="flex items-center gap-2 text-sm font-black text-white">
              <Stethoscope className="h-4 w-4 text-[#8ad8f3]" /> Your recovery coach
            </p>
            <p className="mt-1 text-xs leading-relaxed text-cloud-dim">
              Answers only from StartFit's checked recovery studies and your own data (check-ins, sleep, session load, muscle estimates, pain reports). If something isn't covered, it says so. It does not diagnose — warning signs always get a "see a clinician" answer.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" dir="auto" onClick={() => void send(s)} className="rounded-full bg-[#172431] px-3 py-1.5 text-[11px] text-cloud-dim hover:text-cloud">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) =>
          m.role === 'user' ? (
            <div key={m.id} dir="auto" className="ml-10 rounded-2xl rounded-br-md bg-[#8ad8f3]/15 px-3.5 py-2.5 text-sm text-white">
              {m.content}
            </div>
          ) : (
            <Answer key={m.id} m={m} onLink={onLink} />
          ),
        )}
        {sending && <div className="mr-10 animate-pulse rounded-2xl bg-[#0d1820] px-3.5 py-3 text-xs text-cloud-dim">Checking your recovery data and the evidence…</div>}
        {error && <p className="rounded-xl border border-[#ff5964]/30 bg-[#ff5964]/10 p-3 text-xs text-cloud">{error}</p>}
        <div ref={endRef} />
      </div>
      <div className="sticky bottom-0 -mx-5 border-t border-[#243442] bg-[#071018]/95 px-5 pb-4 pt-3 backdrop-blur-xl">
        {remaining != null && <p className="mb-1.5 text-[10px] text-cloud-dim">{remaining} coach actions left today</p>}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
          className="flex items-end gap-2"
        >
          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => void clearRecoveryCoachMessages().then(() => setMessages([])).catch((e) => setError(e instanceof Error ? e.message : 'Could not clear.'))}
              aria-label="Clear chat"
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-[#172431] text-cloud-dim hover:text-[#ff5964]"
            >
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
            dir="auto"
            maxLength={2000}
            placeholder="Ask about your recovery…"
            className="max-h-32 min-h-[44px] flex-1 resize-none rounded-xl border border-[#243442] bg-[#172431] px-3.5 py-3 text-sm text-white placeholder:text-cloud-dim/60 focus:border-[#8ad8f3]/50 focus:outline-none"
          />
          <button type="submit" disabled={!input.trim() || sending} aria-label="Send" className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-[#8ad8f3] text-[#071018] disabled:opacity-40">
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}

function Answer({ m, onLink }: { m: RecoveryCoachMessage; onLink: (l: RecoveryCoachLink) => void }) {
  const data: RecoveryCoachReply | null = m.data;
  const blocks = data?.blocks ?? [{ text: m.content, basis: 'general' as const, claimIds: [] }];
  return (
    <div className="mr-6 space-y-2.5 rounded-2xl rounded-bl-md border border-[#243442] bg-[#0d1820] px-3.5 py-3">
      {blocks.map((b, i) => (
        <div key={i} className={data?.safety && i === 0 ? 'rounded-xl border border-[#ff5964]/40 bg-[#ff5964]/10 p-2.5' : undefined}>
          {data?.safety && i === 0 && <OctagonAlert className="mb-1 h-4 w-4 text-[#ff5964]" />}
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-white" dir="auto">{b.text}</p>
          {b.basis === 'evidence' && <RecoverySources claimIds={b.claimIds} className="mt-1.5" />}
          {b.basis === 'user_data' && <p className="mt-1 text-[10px] text-cloud-dim">From your data</p>}
        </div>
      ))}
      {data?.links && data.links.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-t border-[#243442] pt-2">
          {data.links.map((l) => (
            <button key={l} type="button" onClick={() => onLink(l)} className="rounded-lg bg-[#8ad8f3]/15 px-2.5 py-1 text-[11px] font-bold text-[#8ad8f3]">
              {LINK_LABELS[l] ?? l} →
            </button>
          ))}
        </div>
      )}
      {data?.memorySaved && data.memorySaved.length > 0 && (
        <p className="flex items-center gap-1.5 text-[10px] text-cloud-dim">
          <Bookmark className="h-3 w-3 text-[#8ad8f3]" /> Saved to memory: {data.memorySaved.map((x) => x.content).join(' · ')}
        </p>
      )}
    </div>
  );
}
