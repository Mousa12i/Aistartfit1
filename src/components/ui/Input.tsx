import { InputHTMLAttributes, TextareaHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: ReactNode;
}

export function Input({ label, error, icon, className, ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-sm font-medium text-cloud-dim px-1">{label}</label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-cloud-dim pointer-events-none">
            {icon}
          </div>
        )}
        <input
          className={cn(
            'w-full bg-ink-elevated border rounded-xl text-cloud placeholder:text-cloud-dim/50',
            'px-4 py-3 text-sm transition-colors',
            'focus:outline-none focus:border-lime/50',
            icon ? 'pl-11' : '',
            error ? 'border-rust/50' : 'border-ink-border',
            className
          )}
          {...props}
        />
      </div>
      {error && <p className="text-xs text-rust px-1">{error}</p>}
    </div>
  );
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({ label, error, className, ...props }: TextareaProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-sm font-medium text-cloud-dim px-1">{label}</label>
      )}
      <textarea
        className={cn(
          'w-full bg-ink-elevated border rounded-xl text-cloud placeholder:text-cloud-dim/50',
          'px-4 py-3 text-sm transition-colors resize-none',
          'focus:outline-none focus:border-lime/50',
          error ? 'border-rust/50' : 'border-ink-border',
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-rust px-1">{error}</p>}
    </div>
  );
}
