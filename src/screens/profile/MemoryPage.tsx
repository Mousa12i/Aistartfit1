import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Brain, Check, Pencil, Pin, Plus, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Chip, EmptyState, Notice, Page, PageHeader, Toast } from '@/screens/nutrition/ui';
import { ConfirmDialog } from '@/components/ui/Modal';
import { LoadingState } from '@/components/ui/States';
import {
  addMemory,
  deleteAllMemory,
  deleteMemory,
  listMemory,
  updateMemory,
  MEMORY_CATEGORY_LABELS,
  type MemoryCategory,
  type MemoryEntry,
} from '@/lib/training/api';

const SOURCE_LABELS: Record<MemoryEntry['source'], string> = {
  user: 'You',
  training_coach: 'Training coach',
  nutrition_coach: 'Nutrition coach',
  ai_coach: 'AI coach',
  app: 'App',
};

const CATEGORIES = Object.keys(MEMORY_CATEGORY_LABELS) as MemoryCategory[];

export function MemoryPage() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [available, setAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newText, setNewText] = useState('');
  const [newCat, setNewCat] = useState<MemoryCategory>('preference');
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [confirmAll, setConfirmAll] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = async () => {
    try {
      const r = await listMemory();
      setEntries(r.entries);
      setAvailable(r.available);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load memory.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const run = async (fn: () => Promise<void>, done: string) => {
    setError(null);
    try {
      await fn();
      await load();
      setToast(done);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    }
  };

  return (
    <Page>
      <PageHeader title="What the app remembers" subtitle="Used by every coach to build on what you have told it" onBack={() => navigate(-1)} />

      {!available && (
        <Notice tone="warn" title="Database update needed">
          Memory needs the migration <code className="text-cloud">20261014091000_training_brain.sql</code>.
        </Notice>
      )}

      <div className="mb-5 rounded-2xl border border-ink-border bg-ink-surface p-4">
        <p className="mb-2 text-sm font-semibold text-cloud">Add something to remember</p>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <Chip key={c} active={newCat === c} onClick={() => setNewCat(c)}>
              {MEMORY_CATEGORY_LABELS[c]}
            </Chip>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            maxLength={500}
            placeholder="e.g. My left knee hurts on deep squats"
            className="flex-1 rounded-xl border border-ink-border bg-ink-elevated px-3 py-2.5 text-sm text-cloud placeholder:text-cloud-dim/50 focus:border-lime/50 focus:outline-none"
            dir="auto"
          />
          <button
            type="button"
            disabled={!newText.trim() || !available}
            onClick={() =>
              void run(async () => {
                await addMemory(newCat, newText);
                setNewText('');
              }, 'Saved')
            }
            aria-label="Add"
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-lime text-ink-bg disabled:opacity-40"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-3">
          <Notice tone="danger">{error}</Notice>
        </div>
      )}

      {loading ? (
        <LoadingState />
      ) : entries.length === 0 ? (
        <EmptyState icon={<Brain className="h-6 w-6" />} title="Nothing saved yet" body="Things you add here, and facts the coaches save from your chats (injuries, equipment, preferences), appear here. You can edit or delete any of them." />
      ) : (
        <div className="space-y-2">
          {entries.map((m) => (
            <div key={m.id} className={cn('rounded-2xl border bg-ink-surface p-3.5', m.pinned ? 'border-lime/40' : 'border-ink-border')}>
              <div className="mb-1 flex items-center gap-2 text-[10px] text-cloud-dim">
                <span className="rounded bg-ink-elevated px-1.5 py-0.5 text-cloud">{MEMORY_CATEGORY_LABELS[m.category]}</span>
                <span>From {SOURCE_LABELS[m.source]}</span>
                <span>· {new Date(m.updated_at).toLocaleDateString('en-GB')}</span>
              </div>
              {editing === m.id ? (
                <div className="flex gap-2">
                  <input
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    maxLength={500}
                    className="flex-1 rounded-lg border border-ink-border bg-ink-elevated px-2.5 py-2 text-sm text-cloud focus:border-lime/50 focus:outline-none"
                    dir="auto"
                  />
                  <button type="button" aria-label="Save" onClick={() => void run(async () => { await updateMemory(m.id, { content: editText }); setEditing(null); }, 'Updated')} className="rounded-lg bg-lime px-2.5 text-ink-bg">
                    <Check className="h-4 w-4" />
                  </button>
                  <button type="button" aria-label="Cancel" onClick={() => setEditing(null)} className="rounded-lg bg-ink-elevated px-2.5 text-cloud-dim">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <p className="min-w-0 flex-1 text-sm text-cloud" dir="auto">{m.content}</p>
                  <button type="button" aria-label={m.pinned ? 'Unpin' : 'Pin'} onClick={() => void run(() => updateMemory(m.id, { pinned: !m.pinned }), m.pinned ? 'Unpinned' : 'Pinned')} className={cn('p-1', m.pinned ? 'text-lime' : 'text-cloud-dim hover:text-cloud')}>
                    <Pin className="h-4 w-4" />
                  </button>
                  <button type="button" aria-label="Edit" onClick={() => { setEditing(m.id); setEditText(m.content); }} className="p-1 text-cloud-dim hover:text-cloud">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button type="button" aria-label="Delete" onClick={() => void run(() => deleteMemory(m.id), 'Deleted')} className="p-1 text-cloud-dim hover:text-rust">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
          <button type="button" onClick={() => setConfirmAll(true)} className="mt-3 w-full rounded-xl border border-rust/30 py-3 text-sm text-rust">
            Delete everything
          </button>
        </div>
      )}

      <ConfirmDialog
        open={confirmAll}
        title="Delete all memory?"
        message="Every saved fact is deleted for all coaches. This cannot be undone."
        confirmLabel="Delete all"
        variant="destructive"
        onCancel={() => setConfirmAll(false)}
        onConfirm={() => {
          setConfirmAll(false);
          void run(() => deleteAllMemory(), 'Memory cleared');
        }}
      />
      <Toast message={toast} onDone={() => setToast(null)} />
    </Page>
  );
}
