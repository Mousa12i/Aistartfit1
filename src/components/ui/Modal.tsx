import { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
}

export function Modal({ open, onClose, title, children, className }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className={cn(
          'w-full sm:max-w-md bg-ink-surface border border-ink-border rounded-t-3xl sm:rounded-3xl',
          'animate-slide-up sm:animate-scale-in safe-bottom',
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-ink-border">
            <h2 className="text-display-sm font-semibold text-cloud">{title}</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-ink-elevated flex items-center justify-center text-cloud-dim hover:text-cloud transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'destructive';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onCancel} className="sm:max-w-sm">
      <h2 className="text-display-sm font-semibold text-cloud mb-2">{title}</h2>
      <p className="text-sm text-cloud-dim leading-relaxed mb-6">{message}</p>
      <div className="flex gap-3">
        <button
          onClick={onCancel}
          className="flex-1 py-3 rounded-xl bg-ink-elevated text-cloud font-medium text-sm hover:bg-ink-border transition-colors"
        >
          {cancelLabel}
        </button>
        <button
          onClick={onConfirm}
          className={cn(
            'flex-1 py-3 rounded-xl font-semibold text-sm transition-colors',
            variant === 'destructive'
              ? 'bg-rust text-white hover:bg-rust/90'
              : 'bg-lime text-ink-bg hover:bg-lime-dark'
          )}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
