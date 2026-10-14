import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import {
  fetchConversations, createConversation, fetchMessages,
  saveMessage, sendAiMessage, deleteConversation
} from '@/lib/data';
import type { AiConversation, AiMessage } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { ConfirmDialog } from '@/components/ui/Modal';
import {
  Sparkles, Send, Plus, ChevronLeft,
  Dumbbell, Flame, Target, Heart, Loader2,
  Info, Calendar, Clock, Repeat, BarChart3,
  Crown, Lock
} from 'lucide-react';
import { useEntitlements } from '@/lib/entitlements-context';
import { StripeUpgradeModal } from '@/components/ui/StripeUpgradeModal';
import { useCoach, COACH_ACTIONS } from '@/lib/hooks/useCoach';
import { fetchUserSessions, fetchExercises } from '@/lib/data';
import type { WorkoutSession, Exercise } from '@/lib/types';
import { cn } from '@/lib/utils';

interface AiCoachProps {
  onBack?: () => void;
}

const SUGGESTED_PROMPTS = [
  { icon: Dumbbell, text: 'Create a 3-day workout split for muscle gain' },
  { icon: Flame, text: 'What\'s the best way to lose belly fat?' },
  { icon: Target, text: 'How do I improve my bench press?' },
  { icon: Heart, text: 'How often should I do cardio?' },
];

export function AiCoach({ onBack }: AiCoachProps) {
  const { user, profile } = useAuth();

  // Load sessions for rule-based coach
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [todaysExercises, setTodaysExercises] = useState<Exercise[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const s = await fetchUserSessions(10);
        setSessions(s);
        const allEx = await fetchExercises();
        setTodaysExercises(allEx.slice(0, 5));
      } catch {
        // non-critical
      }
    })();
  }, []);

  const coach = useCoach({ profile, sessions, todaysWorkoutExercises: todaysExercises });
  const { config, tier } = useEntitlements();
  const [, setConversations] = useState<AiConversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<AiConversation | null>(null);
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setShowSidebar] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AiConversation | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [limitInfo, setLimitInfo] = useState<{ limit: number; tier: string; upgradeText: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const convs = await fetchConversations();
        setConversations(convs);
        if (convs.length > 0) {
          setActiveConversation(convs[0]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load conversations');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (activeConversation) {
      (async () => {
        const msgs = await fetchMessages(activeConversation.id);
        setMessages(msgs);
      })();
    } else {
      setMessages([]);
    }
  }, [activeConversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleNewConversation = async () => {
    try {
      const conv = await createConversation('New Conversation');
      if (conv) {
        setConversations((prev) => [conv, ...prev]);
        setActiveConversation(conv);
        setMessages([]);
        setShowSidebar(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create conversation');
    }
  };

  const handleSend = async (messageText?: string) => {
    const text = (messageText ?? input).trim();
    if (!text || sending) return;

    let conversation = activeConversation;
    if (!conversation) {
      try {
        conversation = await createConversation('New Conversation');
        if (conversation) {
          setConversations((prev) => [conversation!, ...prev]);
          setActiveConversation(conversation);
        }
      } catch {
        setError('Failed to create conversation');
        return;
      }
    }

    if (!conversation) {
      setError('Failed to create conversation');
      return;
    }

    const conv = conversation;
    const userMessage: AiMessage = {
      id: `temp-${Date.now()}`,
      conversation_id: conv.id,
      user_id: user?.id ?? '',
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setSending(true);
    setError(null);

    const { error: saveError } = await saveMessage(conv.id, 'user', text);
    if (saveError) {
      console.error('Failed to save user message:', saveError);
    }

    try {
      const result = await sendAiMessage(conv.id, text, messages);
      if (result.limitReached) {
        setLimitInfo({
          limit: result.limit ?? 0,
          tier: result.tier ?? 'free',
          upgradeText: result.upgradeText ?? 'Upgrade for more daily actions.',
        });
        setShowUpgrade(true);
        setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));
      } else if (result.error) {
        setError(result.error);
        setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));
      } else if (result.reply) {
        const assistantMessage: AiMessage = {
          id: `temp-ai-${Date.now()}`,
          conversation_id: conv.id,
          user_id: user?.id ?? '',
          role: 'assistant',
          content: result.reply,
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
        await saveMessage(conv.id, 'assistant', result.reply);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
      setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));
    } finally {
      setSending(false);
    }
  };

  const handleDeleteConversation = async () => {
    if (!deleteTarget) return;
    const { error: delError } = await deleteConversation(deleteTarget.id);
    if (!delError) {
      setConversations((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      if (activeConversation?.id === deleteTarget.id) {
        setActiveConversation(null);
        setMessages([]);
      }
    }
    setDeleteTarget(null);
  };

  if (loading) {
    return (
      <div className="px-5 pt-12">
        <LoadingState label="Loading AI Coach..." />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-ink-bg animate-fade-in">
      {/* Header */}
      <div className="px-5 pt-6 pb-3 flex items-center gap-3 border-b border-ink-border">
        {onBack && (
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-xl bg-ink-elevated flex items-center justify-center text-cloud-dim hover:text-cloud transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        <div className="flex-1 flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-lime/10 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-lime" />
          </div>
          <div>
            <h1 className="text-display-sm text-cloud font-semibold">AI Coach</h1>
            <p className="text-[10px] text-cloud-dim">Your personal fitness assistant</p>
          </div>
        </div>
        <div className={cn(
          'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold',
          coach.coachActionsLeft === Infinity ? 'bg-lime/15 text-lime' :
          coach.coachActionsLeft <= 1 ? 'bg-rust/15 text-rust' : coach.coachActionsLeft <= 3 ? 'bg-gold/15 text-gold' : 'bg-lime/15 text-lime'
        )}>
          <Sparkles className="w-3 h-3" />
          {coach.coachActionsLeft === Infinity ? 'UNLIMITED' : `${coach.coachActionsLeft}/${config.coach} left today`}
        </div>
        <button
          onClick={handleNewConversation}
          className="w-10 h-10 rounded-xl bg-lime/10 flex items-center justify-center text-lime hover:bg-lime/20 transition-colors"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* Rule-based Quick Actions */}
      <div className="px-5 py-3 border-b border-ink-border">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] text-cloud-dim font-semibold uppercase tracking-wider">Quick Actions</p>
          <span className="text-[10px] text-cloud-dim">{coach.coachActionsLeft === Infinity ? 'UNLIMITED' : `${coach.coachActionsLeft}/${config.coach} left today`}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {COACH_ACTIONS.map((action) => {
            const iconMap: Record<string, typeof Info> = {
              info: Info, calendar: Calendar, clock: Clock, repeat: Repeat, chart: BarChart3
            };
            const ActionIcon = iconMap[action.icon] ?? Info;
            return (
              <button
                key={action.id}
                onClick={() => coach.runAction(action.id)}
                className="flex items-start gap-2 p-2.5 rounded-xl bg-ink-surface border border-ink-border hover:border-lime/30 transition-all text-left"
              >
                <ActionIcon className="w-4 h-4 text-lime flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-cloud">{action.label}</p>
                  <p className="text-[9px] text-cloud-dim truncate">{action.description}</p>
                </div>
              </button>
            );
          })}
        </div>
        {coach.output && (
          <div className="mt-2 p-3 rounded-xl bg-lime/5 border border-lime/20">
            <p className="text-xs text-cloud whitespace-pre-wrap leading-relaxed">{coach.output}</p>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 scrollbar-thin">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-2xl bg-lime/10 flex items-center justify-center mb-4">
              <Sparkles className="w-8 h-8 text-lime" />
            </div>
            <h2 className="text-display-sm text-cloud font-semibold mb-2">Ask me anything</h2>
            <p className="text-sm text-cloud-dim text-center max-w-xs mb-6">
              Get workout plans, exercise tips, and fitness advice tailored to your goals.
            </p>
            <div className="w-full max-w-md flex flex-col gap-2.5">
              {SUGGESTED_PROMPTS.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(prompt.text)}
                  disabled={sending}
                  className="flex items-center gap-3 p-3.5 rounded-xl2 bg-ink-surface border border-ink-border hover:border-lime/30 transition-all text-left active:scale-[0.99] disabled:opacity-50"
                >
                  <div className="w-9 h-9 rounded-lg bg-ink-elevated flex items-center justify-center text-lime flex-shrink-0">
                    <prompt.icon className="w-4 h-4" />
                  </div>
                  <span className="text-sm text-cloud-dim">{prompt.text}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 max-w-2xl mx-auto">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            {sending && (
              <div className="flex items-center gap-2 text-cloud-dim pl-2">
                <div className="w-8 h-8 rounded-lg bg-lime/10 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-lime" />
                </div>
                <div className="flex items-center gap-1.5">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-xs">Thinking...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}

        {error && (
          <div className="mt-4 max-w-2xl mx-auto">
            <ErrorState message={error} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-5 py-3 border-t border-ink-border bg-ink-surface/50 safe-bottom">
        <div className="flex items-end gap-2.5 max-w-2xl mx-auto">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask your AI Coach..."
            rows={1}
            className="flex-1 bg-ink-elevated border border-ink-border rounded-xl px-4 py-3 text-sm text-cloud placeholder:text-cloud-dim/50 resize-none focus:outline-none focus:border-lime/50 max-h-32"
            style={{ minHeight: '44px' }}
          />
          <Button
            size="md"
            onClick={() => handleSend()}
            disabled={!input.trim() || sending}
            className="flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-[10px] text-cloud-dim/50 text-center mt-2 max-w-2xl mx-auto">
          AI Coach provides fitness guidance, not medical advice. Consult a healthcare professional for health concerns.
        </p>
      </div>

      {limitInfo && (
        <div className="mx-5 mb-3 p-3.5 rounded-xl2 bg-gold/10 border border-gold/30 flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-gold/15 flex items-center justify-center flex-shrink-0">
            <Lock className="w-4.5 h-4.5 text-gold" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-cloud">Daily limit reached</p>
            <p className="text-[11px] text-cloud-dim mt-0.5">{limitInfo.upgradeText}</p>
            <button
              onClick={() => setShowUpgrade(true)}
              className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-lime-gradient text-ink-bg text-xs font-bold"
            >
              <Crown className="w-3.5 h-3.5" />
              Upgrade Now
            </button>
          </div>
        </div>
      )}

      <StripeUpgradeModal open={showUpgrade} currentTier={tier} onClose={() => setShowUpgrade(false)} />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete conversation?"
        message="All messages in this conversation will be permanently deleted."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDeleteConversation}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function MessageBubble({ message }: { message: AiMessage }) {
  const isUser = message.role === 'user';
  return (
    <div className={cn('flex gap-2.5', isUser ? 'flex-row-reverse' : 'flex-row')}>
      <div className={cn(
        'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
        isUser ? 'bg-ink-elevated' : 'bg-lime/10'
      )}>
        {isUser ? (
          <span className="text-xs font-bold text-cloud-dim">You</span>
        ) : (
          <Sparkles className="w-4 h-4 text-lime" />
        )}
      </div>
      <div className={cn(
        'rounded-2xl px-4 py-2.5 max-w-[80%]',
        isUser
          ? 'bg-lime text-ink-bg rounded-tr-sm'
          : 'bg-ink-surface border border-ink-border text-cloud rounded-tl-sm'
      )}>
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
      </div>
    </div>
  );
}
