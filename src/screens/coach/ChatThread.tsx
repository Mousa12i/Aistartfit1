import { useCallback, useEffect, useRef, useState } from 'react';
import { Image as ImageIcon, Send, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import { listMessages, markRead, sendMessage, type ChatMessage, type QuickReply } from '@/lib/coach/api';
import { Lightbox, PrivatePhoto } from './ui';

/** The coach–athlete conversation (text and photos). Refreshes every few seconds while open. */
export function ChatThread({ coachId, athleteId, me, replies, firstName }: {
  coachId: string;
  athleteId: string;
  me: string;
  replies?: QuickReply[];
  /** Fills {name} in quick replies. */
  firstName?: string;
}) {
  const { t, lang } = useI18n();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showReplies, setShowReplies] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const lastCount = useRef(0);

  const load = useCallback(async () => {
    try {
      const list = await listMessages(coachId, athleteId);
      setMessages(list);
      if (list.some((m) => m.sender_id !== me && !m.read_at)) await markRead(coachId, athleteId, me);
    } catch {
      setError(t('coach.chatLoadError'));
    }
  }, [coachId, athleteId, me, t]);

  useEffect(() => {
    load();
    const id = window.setInterval(load, 6000);
    return () => window.clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (messages.length !== lastCount.current) {
      lastCount.current = messages.length;
      endRef.current?.scrollIntoView({ block: 'end' });
    }
  }, [messages.length]);

  const send = async () => {
    if (!text.trim() && !file) return;
    setSending(true);
    setError(null);
    try {
      await sendMessage({ coachId, athleteId, senderId: me, body: text, file });
      setText('');
      setFile(null);
      await load();
    } catch {
      setError(t('coach.sendError'));
    } finally {
      setSending(false);
    }
  };

  const time = (iso: string) => {
    try {
      return new Date(iso).toLocaleString(lang, { weekday: 'short', hour: '2-digit', minute: '2-digit' });
    } catch {
      return iso.slice(11, 16);
    }
  };

  return (
    <div className="flex flex-col" data-testid="chat-thread">
      <div className="min-h-[240px] space-y-2 pb-3">
        {messages.length === 0 && <p className="py-10 text-center text-sm text-cloud-dim">{t('coach.chatEmpty')}</p>}
        {messages.map((m) => {
          const mine = m.sender_id === me;
          return (
            <div key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
              <div className={cn('max-w-[82%] rounded-2xl px-3.5 py-2.5', mine ? 'rounded-ee-md bg-lime text-ink-bg' : 'rounded-es-md bg-ink-elevated text-cloud')}>
                {m.image_path && <PrivatePhoto path={m.image_path} className="mb-1.5 max-h-64 w-full rounded-xl" onOpen={setLightbox} />}
                {m.body && <p dir="auto" className="whitespace-pre-wrap break-words text-sm leading-relaxed">{m.body}</p>}
                <div className={cn('mt-1 text-[10px]', mine ? 'text-ink-bg/60' : 'text-cloud-muted')}>
                  {time(m.created_at)}{mine && m.read_at ? ` · ${t('coach.seen')}` : ''}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {error && <p className="mb-2 text-xs text-rust">{error}</p>}

      {showReplies && replies && replies.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {replies.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => { setText((cur) => (cur ? `${cur}\n` : '') + r.body.replace(/\{name\}/g, firstName ?? '')); setShowReplies(false); }}
              className="rounded-full border border-ink-border bg-ink-elevated px-3 py-1.5 text-xs text-cloud"
            >
              {r.title}
            </button>
          ))}
        </div>
      )}

      {file && (
        <div className="mb-2 flex items-center justify-between rounded-xl bg-ink-elevated px-3 py-2 text-xs text-cloud-dim">
          <span className="truncate">{file.name}</span>
          <button type="button" onClick={() => setFile(null)} className="text-rust">{t('coach.remove')}</button>
        </div>
      )}

      <div className="sticky bottom-24 flex items-end gap-2 rounded-2xl border border-ink-border bg-ink-surface p-2">
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <button type="button" onClick={() => fileRef.current?.click()} aria-label={t('coach.attachPhoto')} className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-cloud-dim hover:text-cloud">
          <ImageIcon className="h-5 w-5" />
        </button>
        {replies && replies.length > 0 && (
          <button type="button" onClick={() => setShowReplies((v) => !v)} aria-label={t('coach.quickReplies')} className={cn('flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl', showReplies ? 'text-lime' : 'text-cloud-dim')}>
            <Zap className="h-5 w-5" />
          </button>
        )}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={1}
          placeholder={t('coach.messagePlaceholder')}
          data-testid="chat-input"
          className="max-h-32 min-h-10 flex-1 resize-none bg-transparent px-1 py-2 text-sm text-cloud placeholder:text-cloud-muted focus:outline-none"
        />
        <button
          type="button"
          onClick={send}
          disabled={sending || (!text.trim() && !file)}
          aria-label={t('coach.send')}
          data-testid="chat-send"
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-lime text-ink-bg disabled:opacity-40"
        >
          <Send className="h-4 w-4 rtl:-scale-x-100" />
        </button>
      </div>
      <Lightbox url={lightbox} onClose={() => setLightbox(null)} />
    </div>
  );
}
