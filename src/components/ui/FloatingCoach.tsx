import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, X, Send, Loader2, Dumbbell, Flame, Target, Heart } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { sendAiMessage, createConversation, saveMessage } from '@/lib/data';
import type { AiMessage } from '@/lib/types';
import { useEntitlements } from '@/lib/entitlements-context';
import { cn } from '@/lib/utils';
import { AiConsentGate } from '@/components/privacy/AiConsentGate';

const QUICK_PROMPTS = [
  { icon: Dumbbell, text: 'What should I train today?' },
  { icon: Flame, text: 'How do I progress my lifts?' },
  { icon: Target, text: 'Check my muscle recovery' },
  { icon: Heart, text: 'What should I eat?' },
];

interface FloatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export function FloatingCoach() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { coachActionsLeft, config, useCoachAction: consumeCoachAction } = useEntitlements();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<FloatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || sending || !user) return;

    if (!consumeCoachAction()) {
      setError(`Daily limit reached (${config.coach} actions). Upgrade to Pro for more.`);
      return;
    }

    const userMsg: FloatMessage = { id: `u-${Date.now()}`, role: 'user', content };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setSending(true);
    setError(null);

    try {
      const conv = await createConversation('Quick chat');
      if (!conv) throw new Error('Failed to start conversation');

      await saveMessage(conv.id, 'user', content);

      const history: AiMessage[] = messages.map((m) => ({
        id: m.id,
        conversation_id: conv.id,
        user_id: user.id,
        role: m.role,
        content: m.content,
        created_at: new Date().toISOString(),
      }));

      const result = await sendAiMessage(conv.id, content, history);
      if (result.error) {
        setError(result.error);
        setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
      } else if (result.reply) {
        const aiMsg: FloatMessage = { id: `a-${Date.now()}`, role: 'assistant', content: result.reply };
        setMessages((prev) => [...prev, aiMsg]);
        await saveMessage(conv.id, 'assistant', result.reply);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to send message');
      setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
    } finally {
      setSending(false);
    }
  };

  if (!user) return null;

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-24 right-4 z-40 w-14 h-14 rounded-2xl bg-lime-gradient text-ink-bg shadow-lime flex items-center justify-center hover:scale-105 active:scale-95 transition-all"
          aria-label="Open AI Coach"
        >
          <Sparkles className="w-6 h-6" />
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rust text-white text-[9px] font-bold flex items-center justify-center">
            {coachActionsLeft}
          </span>
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-4 left-4 sm:left-auto sm:w-96 z-40 bg-ink-surface border border-ink-border rounded-2xl shadow-elevated overflow-hidden animate-slide-up flex flex-col" style={{ maxHeight: '70vh' }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-ink-border bg-ink-elevated/50">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-lime/10 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-lime" />
              </div>
              <div>
                <p className="text-sm font-semibold text-cloud">AI Coach</p>
                <p className="text-[9px] text-cloud-dim">{coachActionsLeft}/{config.coach} actions left today</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  setOpen(false);
                  navigate('/ai-coach');
                }}
                className="text-[10px] text-lime hover:text-lime-dark transition-colors px-2 py-1 rounded-lg hover:bg-lime/10"
              >
                Full view
              </button>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close AI Coach"
                className="w-8 h-8 rounded-lg bg-ink-elevated flex items-center justify-center text-cloud-dim hover:text-cloud transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <AiConsentGate compact fallbackWrapper={(card) => <div className="overflow-y-auto">{card}</div>}>
          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 scrollbar-thin min-h-[200px] max-h-[400px]">
            {messages.length === 0 ? (
              <div className="flex flex-col gap-2 pt-2">
                <p className="text-xs text-cloud-dim text-center mb-1">
                  Hi {profile?.display_name?.split(' ')[0] ?? 'there'}! Ask me anything about your training.
                </p>
                {QUICK_PROMPTS.map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(prompt.text)}
                    disabled={sending}
                    className="flex items-center gap-2 p-2.5 rounded-xl bg-ink-elevated/50 border border-ink-border hover:border-lime/30 transition-all text-left disabled:opacity-50"
                  >
                    <div className="w-7 h-7 rounded-lg bg-lime/10 flex items-center justify-center text-lime flex-shrink-0">
                      <prompt.icon className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs text-cloud-dim">{prompt.text}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {messages.map((msg) => (
                  <div key={msg.id} className={cn('flex gap-2', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}>
                    <div className={cn(
                      'w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0',
                      msg.role === 'user' ? 'bg-ink-elevated' : 'bg-lime/10'
                    )}>
                      {msg.role === 'user' ? (
                        <span className="text-[10px] font-bold text-cloud-dim">You</span>
                      ) : (
                        <Sparkles className="w-3.5 h-3.5 text-lime" />
                      )}
                    </div>
                    <div className={cn(
                      'rounded-xl px-3 py-2 max-w-[85%]',
                      msg.role === 'user'
                        ? 'bg-lime text-ink-bg rounded-tr-sm'
                        : 'bg-ink-elevated border border-ink-border text-cloud rounded-tl-sm'
                    )}>
                      <p className="text-xs leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ))}
                {sending && (
                  <div className="flex items-center gap-2 text-cloud-dim pl-1">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span className="text-[11px]">Thinking...</span>
                  </div>
                )}
              </div>
            )}
            {error && (
              <p className="text-xs text-rust mt-2 px-1">{error}</p>
            )}
          </div>

          {/* Input */}
          <div className="px-3 py-2.5 border-t border-ink-border bg-ink-elevated/30">
            <div className="flex items-end gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Ask your coach..."
                className="flex-1 bg-ink-elevated border border-ink-border rounded-lg px-3 py-2 text-xs text-cloud placeholder:text-cloud-dim/50 focus:outline-none focus:border-lime/40"
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || sending}
                className="w-9 h-9 rounded-lg bg-lime text-ink-bg flex items-center justify-center disabled:opacity-40 transition-all hover:scale-105 active:scale-95 flex-shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
          </AiConsentGate>
        </div>
      )}
    </>
  );
}
