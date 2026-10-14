import { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children: ReactNode;
}

const variants: Record<Variant, string> = {
  primary: 'bg-lime text-ink-bg font-semibold hover:bg-lime-dark active:scale-[0.98] shadow-lime-sm',
  secondary: 'bg-ink-elevated text-cloud font-medium hover:bg-ink-border active:scale-[0.98]',
  outline: 'border border-ink-border text-cloud font-medium hover:bg-ink-elevated active:scale-[0.98]',
  ghost: 'text-cloud-dim font-medium hover:text-cloud hover:bg-ink-elevated active:scale-[0.98]',
  destructive: 'bg-rust/15 text-rust font-semibold hover:bg-rust/25 active:scale-[0.98] border border-rust/30',
};

const sizes: Record<Size, string> = {
  sm: 'px-3 py-2 text-sm rounded-lg gap-1.5',
  md: 'px-5 py-3 text-sm rounded-xl gap-2',
  lg: 'px-6 py-4 text-base rounded-xl gap-2',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center transition-all duration-150 select-none',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-lime/50',
        'disabled:opacity-50 disabled:pointer-events-none',
        variants[variant],
        sizes[size],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
}
