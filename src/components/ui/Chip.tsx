import { cn } from '@/lib/utils';

interface ChipProps {
  label: string;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}

export function Chip({ label, active, onClick, className }: ChipProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-150 whitespace-nowrap',
        'active:scale-95 select-none',
        active
          ? 'bg-lime text-ink-bg'
          : 'bg-ink-elevated text-cloud-dim hover:text-cloud border border-ink-border',
        className
      )}
    >
      {label}
    </button>
  );
}

interface FilterChipsProps {
  options: { value: string; label: string }[];
  selected: string;
  onSelect: (value: string) => void;
  className?: string;
}

export function FilterChips({ options, selected, onSelect, className }: FilterChipsProps) {
  return (
    <div className={cn('flex gap-2 overflow-x-auto scrollbar-hide py-1', className)}>
      {options.map((opt) => (
        <Chip
          key={opt.value}
          label={opt.label}
          active={selected === opt.value}
          onClick={() => onSelect(opt.value)}
        />
      ))}
    </div>
  );
}
