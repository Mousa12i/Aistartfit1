import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center px-6 py-12', className)}>
      {icon && (
        <div className="w-16 h-16 rounded-2xl bg-ink-elevated border border-ink-border flex items-center justify-center text-cloud-dim mb-4">
          {icon}
        </div>
      )}
      <h3 className="text-display-sm text-cloud font-semibold">{title}</h3>
      {description && (
        <p className="text-sm text-cloud-dim mt-2 max-w-xs leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({ message, onRetry, className }: ErrorStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center px-6 py-8', className)}>
      <div className="w-14 h-14 rounded-2xl bg-rust/10 border border-rust/20 flex items-center justify-center text-rust mb-3">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <p className="text-sm text-cloud-dim max-w-xs">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 text-sm text-lime font-medium hover:text-lime-dark transition-colors"
        >
          Try again
        </button>
      )}
    </div>
  );
}

interface LoadingStateProps {
  label?: string;
  className?: string;
}

export function LoadingState({ label = 'Loading...', className }: LoadingStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-8', className)}>
      <div className="w-8 h-8 border-2 border-ink-border border-t-lime rounded-full animate-spin" />
      <p className="text-xs text-cloud-dim mt-3">{label}</p>
    </div>
  );
}

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return <div className={cn('skeleton', className)} />;
}
