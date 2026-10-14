import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  elevated?: boolean;
  gradient?: boolean;
}

export function Card({ children, className, onClick, elevated, gradient }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-xl2 border border-ink-border overflow-hidden',
        gradient ? 'bg-card-gradient' : 'bg-ink-surface',
        elevated && 'shadow-elevated',
        onClick && 'cursor-pointer active:scale-[0.99] transition-transform',
        className
      )}
    >
      {children}
    </div>
  );
}
