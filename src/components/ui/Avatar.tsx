import { ReactNode } from 'react';
import { cn, getInitials } from '@/lib/utils';

interface AvatarProps {
  name: string | null;
  url?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-16 h-16 text-xl',
};

export function Avatar({ name, url, size = 'md', className }: AvatarProps) {
  if (url) {
    return (
      <img
        src={url}
        alt={name ?? 'Avatar'}
        className={cn('rounded-full object-cover border border-ink-border', sizeMap[size], className)}
      />
    );
  }
  return (
    <div
      className={cn(
        'rounded-full bg-ink-elevated border border-ink-border flex items-center justify-center font-semibold text-cloud-dim',
        sizeMap[size],
        className
      )}
    >
      {getInitials(name)}
    </div>
  );
}

interface BadgeProps {
  children: ReactNode;
  variant?: 'default' | 'lime' | 'outline' | 'gold' | 'rust';
  className?: string;
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  const variants = {
    default: 'bg-ink-elevated text-cloud-dim',
    lime: 'bg-lime/15 text-lime border border-lime/30',
    outline: 'border border-ink-border text-cloud-dim',
    gold: 'bg-gold/15 text-gold border border-gold/30',
    rust: 'bg-rust/15 text-rust border border-rust/30',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
