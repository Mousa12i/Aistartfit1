import { Fragment, useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Loader2, RotateCcw, Send, Sparkles, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/Modal';
import { StripeUpgradeModal } from '@/components/ui/StripeUpgradeModal';
import { useEntitlements } from '@/lib/entitlements-context';
import { cn } from '@/lib/utils';
import {
  clearCoachMessages,
  errorMessage,
  fetchCoachMessages,
  sendCoachMessage,
  type CoachMessage,
  type CoachTargetsSnapshot,
} from '@/lib/nutrition/api';
import { formatDayLabel, isValidDateKey } from '@/lib/nutrition/dates';
import { useNutrition } from './NutritionContext';
import { useNutritionNav } from './nav';
import { Notice, Page, PageHeader, SetupRequired } from './ui';
import { useConsent } from '@/lib/consent-context';
import { AiConsentCard } from '@/components/privacy/AiConsentGate';

const PROMPTS_NUMBERS: { label: string; text: string; mode: 'chat' | 'plan' }[] = [
  { label: 'Analyse my day', text: 'Analyse what I have eaten today against my targets. What should I eat for the rest of the day?', mode: 'chat' },
  { label: '1-day meal plan', text: 'Build me a 1-day meal plan that matches my targets, my diet preferences and allergies. Give each meal with grams and its calories and protein.', mode: 'plan' },
  { label: '7-day plan + shopping list', text: 'Build a 7-day meal plan that fits my targets and preferences, keeping it simple and affordable, then give me a grouped shopping list.', mode: 'plan' },
  { label: 'Pre-workout meal', text: 'What should I eat before and after my training today, and when?', mode: 'chat' },
  { label: 'Am I eating enough protein?', text: 'Look at my last 7 days. Am I eating enough protein and is it spread well across my meals?', mode: 'chat' },
  { label: 'Supplements', text: 'Which supplements are actually worth it for my goal, and which are not?', mode: 'chat' },
];

const PROMPTS_BALANCED: { label: string; text: string; mode: 'chat' | 'plan' }[] = [
  { label: 'Balanced meal ideas', text: 'Give me some balanced meal ideas for this week, without numbers.', mode: 'chat' },
  { label: 'Before training', text: 'What is a good thing to eat before and after training?', mode: 'chat' },
  { label: 'Easy protein foods', text: 'What are easy everyday foods with protein?', mode: 'chat' },
  { label: 'Food feels stressful', text: 'Food and eating have been feeling stressful lately. What can help?', mode: 'chat' },
];

interface LocalMessage extends CoachMessage {
  failed?: boolean;
  mode?: 'chat' | 'plan';
}

export function CoachPage() {
  const consent = useConsent();
  const n = useNutrition();
  const { tier } = useEntitlements();
  const { params, go, replace } = useNutritionNav();
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [available, setAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState<{ message: string; upgradeText: string | null } | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const autoSent = useRef(false);

  useEffect(() => {
    let cancelled = false;
    fetchCoachMessages()
      .then((res) => {
        if (cancelled) return;
        setMessages(res.messages);
        setAvailable(res.available);
      })
      .catch((err) => !cancelled && setError(errorMessage(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, sending]);

  const snapshot = useCallback((): CoachTargetsSnapshot => {
    const t = n.targetsFor(n.today);
    return {
      date: n.today,
      mode: t.mode,
      ratePct: n.settings.rate_pct,
      kcal: t.kcal,
      protein: t.protein,
      carbs: t.carbs,
      fat: t.fat,
      fiber: t.fiber,
      waterMl: t.waterMl,
      proteinPerMeal: t.proteinPerMeal.target,
      maintenance: t.maintenance,
      trainingDay: n.isTrainingDay(n.today),
    };
  }, [n]);

  const send = useCallback(
    async (text: string, mode: 'chat' | 'plan' = 'chat') => {
      const message = text.trim();
      if (!message || sending) return;
      setError(null);
      setLimit(null);
      const local: LocalMessage = { id: `local-${Date.now()}`, role: 'user', content: message, created_at: new Date().toISOString(), mode };
      setMessages((prev) => [...prev, local]);
      setInput('');
      setSending(true);
      try {
        const result = await sendCoachMessage({ message, mode, targets: n.noNumbers ? null : snapshot(), today: n.today });
        if (result.ok) {
          setMessages((prev) => [...prev, { id: `reply-${Date.now()}`, role: 'assistant', content: result.reply, created_at: new Date().toISOString() }]);
        } else {
          setMessages((prev) => prev.map((m) => (m.id === local.id ? { ...m, failed: true } : m)));
          setLimit({ message: result.message, upgradeText: result.upgradeText });
        }
      } catch (err) {
        setMessages((prev) => prev.map((m) => (m.id === local.id ? { ...m, failed: true } : m)));
        setError(errorMessage(err));
      } finally {
        setSending(false);
      }
    },
    [n.noNumbers, n.today, sending, snapshot],
  );

  // Deep links from other pages: ?plan=1 or ?analyze=YYYY-MM-DD send a prepared request once.
  useEffect(() => {
    if (loading || autoSent.current || !available) return;
    const plan = params.get('plan');
    const analyze = params.get('analyze');
    if (!plan && !analyze) return;
    autoSent.current = true;
    replace('coach');
    if (plan) {
      void send(
        n.noNumbers
          ? 'Give me a balanced 1-day meal plan without numbers that fits my preferences.'
          : 'Build me a 1-day meal plan that matches my targets, my diet preferences and allergies. Give each meal with grams and its calories and protein.',
        'plan',
      );
    } else if (analyze && isValidDateKey(analyze)) {
      void send(`Analyse my food on ${formatDayLabel(analyze, n.today).toLowerCase()} (${analyze}). What went well and what one or two things should I change?`, 'chat');
    }
  }, [loading, available, params, replace, send, n.noNumbers, n.today]);

  const retry = (m: LocalMessage) => {
    setMessages((prev) => prev.filter((x) => x.id !== m.id));
    void send(m.content, m.mode ?? 'chat');
  };

  const clear = async () => {
    setConfirmClear(false);
    try {
      await clearCoachMessages();
      setMessages([]);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void send(input, /plan|meal plan|خطة|برنامج/i.test(input) ? 'plan' : 'chat');
  };

  const prompts = n.noNumbers ? PROMPTS_BALANCED : PROMPTS_NUMBERS;

  if (!loading && !available) {
    return (
      <Page>
        <PageHeader title="AI nutrition coach" onBack={() => go('hub')} />
        <SetupRequired feature="The nutrition coach" />
      </Page>
    );
  }

  if (!consent.ai) {
    return (
      <Page>
        <PageHeader title="AI nutrition coach" onBack={() => go('hub')} />
        <AiConsentCard />
      </Page>
    );
  }

  return (
    // Full-height chat: header on top, messages scroll in the middle, input pinned at the bottom.
    // The app's bottom navigation is hidden on this page (see App.tsx); the back button returns to the hub.
    <div className="mx-auto flex h-screen h-dvh w-full max-w-2xl flex-col px-5 animate-fade-in">
      <PageHeader
        title="AI nutrition coach"
        subtitle="Knows your targets, diary, training and recovery"
        onBack={() => go('hub')}
        right={
          messages.length > 0 ? (
            <button type="button" aria-label="Clear conversation" onClick={() => setConfirmClear(true)} className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink-elevated text-cloud-dim hover:text-rust">
              <Trash2 className="h-4 w-4" />
            </button>
          ) : null
        }
      />

      <div className="-mx-5 min-h-0 flex-1 overflow-y-auto px-5 pb-4">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-lime" />
          </div>
        ) : messages.length === 0 ? (
          <div className="pt-4 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-lime/15">
              <Sparkles className="h-8 w-8 text-lime" />
            </div>
            <p className="text-lg font-bold text-cloud">Your nutrition coach</p>
            <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-cloud-dim">
              Ask in English or Arabic. Answers use your own diary, targets, training and recovery data, and cite only checked sources.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-2 text-left">
              {prompts.map((p) => (
                <button key={p.label} type="button" onClick={() => send(p.text, p.mode)} className="rounded-2xl border border-ink-border bg-ink-surface p-3.5 text-xs font-medium text-cloud hover:border-lime/30">
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((m) => (
              <div key={m.id} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
                    m.role === 'user' ? 'rounded-br-md bg-lime text-ink-bg' : 'rounded-bl-md border border-ink-border bg-ink-surface text-cloud',
                  )}
                >
                  {m.role === 'assistant' ? <MessageText text={m.content} /> : <p dir="auto" className="whitespace-pre-wrap">{m.content}</p>}
                  {m.failed && (
                    <button type="button" onClick={() => retry(m)} className="mt-2 flex items-center gap-1 text-[11px] font-semibold underline">
                      <RotateCcw className="h-3 w-3" /> Not sent — tap to retry
                    </button>
                  )}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-ink-border bg-ink-surface px-4 py-3 text-xs text-cloud-dim">
                  <Loader2 className="h-4 w-4 animate-spin text-lime" /> Thinking with your data…
                </div>
              </div>
            )}
          </div>
        )}

        {(error || limit) && (
          <div className="mt-4 space-y-2">
            {error && <Notice tone="warn">{error}</Notice>}
            {limit && (
              <Notice
                tone="warn"
                title={limit.message}
                action={
                  <button type="button" onClick={() => setShowUpgrade(true)} className="text-xs font-semibold text-lime">
                    See plans →
                  </button>
                }
              >
                {limit.upgradeText}
              </Notice>
            )}
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="safe-bottom -mx-5 border-t border-ink-border/50 bg-ink-bg/95 px-5 pt-3 backdrop-blur-xl">
        {messages.length > 0 && !sending && (
          <div className="mb-2 flex gap-2 overflow-x-auto scrollbar-hide">
            {prompts.slice(0, 4).map((p) => (
              <button key={p.label} type="button" onClick={() => send(p.text, p.mode)} className="flex-shrink-0 rounded-full bg-ink-elevated px-3 py-1.5 text-[11px] text-cloud-dim hover:text-cloud">
                {p.label}
              </button>
            ))}
          </div>
        )}
        <form onSubmit={submit} className="flex gap-2">
          <input
            dir="auto"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about food, plans, supplements…"
            aria-label="Message the nutrition coach"
            maxLength={2000}
            className="min-w-0 flex-1 rounded-xl border border-ink-border bg-ink-surface px-4 py-3 text-sm text-cloud placeholder:text-cloud-muted focus:border-lime/50 focus:outline-none"
          />
          <button type="submit" disabled={!input.trim() || sending} aria-label="Send" className="flex h-12 w-12 items-center justify-center rounded-xl bg-lime text-ink-bg disabled:opacity-40">
            <Send className="h-5 w-5" />
          </button>
        </form>
        <p className="mb-2 mt-1.5 text-center text-[10px] text-cloud-muted">AI can make mistakes. Not medical advice — check health conditions with a professional.</p>
      </div>

      <ConfirmDialog open={confirmClear} title="Clear conversation?" message="This deletes your nutrition coach history." confirmLabel="Clear" variant="destructive" onConfirm={clear} onCancel={() => setConfirmClear(false)} />
      <StripeUpgradeModal open={showUpgrade} currentTier={tier} onClose={() => setShowUpgrade(false)} />
    </div>
  );
}

/** Minimal, safe markdown: headings, lists, bold, tables. Renders React elements only (no HTML injection). */
export function MessageText({ text }: { text: string }) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) {
      i++;
      continue;
    }
    if (trimmed.startsWith('|')) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const cells = lines[i].trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells);
        i++;
      }
      blocks.push(
        <div key={`t${i}`} className="my-2 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri} className={ri === 0 ? 'border-b border-ink-border font-semibold' : 'border-b border-ink-border/40'}>
                  {r.map((c, ci) => (
                    <td key={ci} dir="auto" className="px-1.5 py-1 align-top">
                      {inline(c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    const heading = /^(#{1,4})\s+(.*)$/.exec(trimmed);
    if (heading) {
      blocks.push(
        <p key={`h${i}`} dir="auto" className="mb-1 mt-3 font-bold text-cloud first:mt-0">
          {inline(heading[2])}
        </p>,
      );
      i++;
      continue;
    }
    if (/^([-*•]|\d+[.)])\s+/.test(trimmed)) {
      const ordered = /^\d+[.)]\s+/.test(trimmed);
      const items: string[] = [];
      while (i < lines.length && /^([-*•]|\d+[.)])\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^([-*•]|\d+[.)])\s+/, ''));
        i++;
      }
      const ListTag = ordered ? 'ol' : 'ul';
      blocks.push(
        <ListTag key={`l${i}`} dir="auto" className={cn('my-1.5 space-y-1 ps-5', ordered ? 'list-decimal' : 'list-disc')}>
          {items.map((it, k) => (
            <li key={k}>{inline(it)}</li>
          ))}
        </ListTag>,
      );
      continue;
    }
    blocks.push(
      <p key={`p${i}`} dir="auto" className="my-1.5">
        {inline(trimmed)}
      </p>,
    );
    i++;
  }
  return <div className="break-words">{blocks}</div>;
}

function inline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, idx) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4 ? (
      <strong key={idx} className="font-semibold">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <Fragment key={idx}>{part}</Fragment>
    ),
  );
}
