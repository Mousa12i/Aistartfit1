import { useState, useEffect, useRef } from 'react';
import { X, Clock } from 'lucide-react';

export function DiscountBadge() {
  const [visible, setVisible] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [seconds, setSeconds] = useState(4 * 60 + 45);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (dismissed) return;
    const timer = setTimeout(() => setVisible(false), 8000);
    return () => clearTimeout(timer);
  }, [dismissed]);

  useEffect(() => {
    if (dismissed) return;
    intervalRef.current = setInterval(() => {
      setSeconds((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [dismissed]);

  if (dismissed || !visible) return null;

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 animate-slide-up">
      <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-full bg-gradient-to-r from-lime/90 to-lime-dark/90 shadow-lime backdrop-blur-sm">
        <div className="flex items-center gap-1 text-ink-bg">
          <span className="text-[11px] font-bold uppercase tracking-wide">70% off</span>
        </div>
        <div className="w-px h-3 bg-ink-bg/30" />
        <div className="flex items-center gap-1 text-ink-bg">
          <Clock className="w-3 h-3" />
          <span className="text-[11px] font-mono font-bold tabular-nums">{timeStr}</span>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="ml-1 text-ink-bg/60 hover:text-ink-bg transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
