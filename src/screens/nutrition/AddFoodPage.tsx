import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ChevronRight, Database, Loader2, Pencil, Plus, Search, Star, Clock, User, Zap, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  customToFood,
  entryProfile,
  errorMessage,
  fetchEntries,
  isMealSlot,
  lookupBarcode,
  MEAL_SLOTS,
  searchFoodDatabase,
  slotForTime,
  slotLabel,
  type MealSlot,
} from '@/lib/nutrition/api';
import { addDays, formatDayLabel, isValidDateKey } from '@/lib/nutrition/dates';
import { foodFromEntry, matchesQuery, searchLocalFoods, type FoodItem } from '@/lib/nutrition/foods';
import { useNutrition } from './NutritionContext';
import { useNutritionNav } from './nav';
import { PortionSheet, SourceBadge } from './PortionSheet';
import { Chip, EmptyState, FieldLabel, Notice, Page, PageHeader, Toast, fmt, inputClass } from './ui';

type Tab = 'search' | 'recent' | 'favorites' | 'mine' | 'quick';

const TABS: { id: Tab; label: string }[] = [
  { id: 'search', label: 'Search' },
  { id: 'recent', label: 'Recent' },
  { id: 'favorites', label: 'Favourites' },
  { id: 'mine', label: 'My foods' },
  { id: 'quick', label: 'Quick add' },
];

export function AddFoodPage() {
  const n = useNutrition();
  const { params, go, replace } = useNutritionNav();
  const date = isValidDateKey(params.get('date')) ? (params.get('date') as string) : n.today;
  const paramSlot = params.get('meal');
  const slot: MealSlot = isMealSlot(paramSlot) ? paramSlot : slotForTime();
  const tabParam = params.get('tab');
  const tab: Tab = TABS.some((t) => t.id === tabParam) ? (tabParam as Tab) : 'search';

  const [selected, setSelected] = useState<FoodItem | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [addedCount, setAddedCount] = useState(0);

  const setTab = (t: Tab) => replace('add', { meal: slot, date, tab: t === 'search' ? null : t });
  const setSlot = (s: MealSlot) => replace('add', { meal: s, date, tab: tab === 'search' ? null : tab });

  return (
    <Page>
      <PageHeader
        title={`Add to ${slotLabel(slot)}`}
        subtitle={formatDayLabel(date, n.today)}
        onBack={() => go('diary', { date: date === n.today ? null : date })}
        right={
          <button type="button" onClick={() => go('diary', { date: date === n.today ? null : date })} className="rounded-xl bg-lime px-4 py-2.5 text-xs font-bold text-ink-bg">
            Done{addedCount > 0 ? ` (${addedCount})` : ''}
          </button>
        }
      />

      <div className="-mx-5 mb-3 flex gap-2 overflow-x-auto px-5 pb-1 scrollbar-hide">
        {MEAL_SLOTS.map((s) => (
          <Chip key={s.id} active={slot === s.id} onClick={() => setSlot(s.id)}>
            {s.label}
          </Chip>
        ))}
      </div>

      <div className="mb-4 flex rounded-xl bg-ink-elevated p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn('flex-1 rounded-lg px-1 py-2 text-[11px] font-semibold transition-all', tab === t.id ? 'bg-ink-surface text-cloud shadow-card' : 'text-cloud-dim')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'search' && <SearchTab onSelect={setSelected} />}
      {tab === 'recent' && <RecentTab onSelect={setSelected} />}
      {tab === 'favorites' && <FavoritesTab onSelect={setSelected} onSearch={() => setTab('search')} />}
      {tab === 'mine' && <MineTab onSelect={setSelected} onCreate={() => go('food', { meal: slot, date })} onEdit={(id) => go('food', { id, meal: slot, date })} />}
      {tab === 'quick' && (
        <QuickAddTab
          date={date}
          slot={slot}
          onAdded={(msg) => {
            setToast(msg);
            setAddedCount((c) => c + 1);
          }}
        />
      )}

      <PortionSheet
        food={selected}
        date={date}
        defaultSlot={slot}
        onClose={() => setSelected(null)}
        onAdded={(msg) => {
          setToast(msg);
          setAddedCount((c) => c + 1);
        }}
      />
      <Toast message={toast} onDone={() => setToast(null)} />
    </Page>
  );
}

function FoodRow({ food, onSelect }: { food: FoodItem; onSelect: (f: FoodItem) => void }) {
  return (
    <li>
      <FoodRowButton food={food} onSelect={onSelect} />
    </li>
  );
}

function FoodRowButton({ food, onSelect }: { food: FoodItem; onSelect: (f: FoodItem) => void }) {
  const n = useNutrition();
  const serving = food.servingOnly ? food.servings[0] : food.servings.find((s) => s.label !== '100 g') ?? food.servings[0];
  return (
    <button type="button" onClick={() => onSelect(food)} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-ink-elevated/50">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <SourceBadge food={food} />
          <p className="truncate text-sm text-cloud">{food.name}</p>
        </div>
        <p className="mt-0.5 truncate text-[11px] text-cloud-dim">
          {food.brand ? `${food.brand} · ` : ''}
          {n.noNumbers
            ? serving?.label ?? ''
            : food.servingOnly
              ? `${fmt(food.per100.kcal)} kcal per ${serving?.label ?? 'serving'} · P ${fmt(food.per100.protein)} g`
              : `${fmt(food.per100.kcal)} kcal / 100 g · P ${fmt(food.per100.protein, 1)} · C ${fmt(food.per100.carbs, 1)} · F ${fmt(food.per100.fat, 1)}`}
        </p>
      </div>
      <Plus className="h-4 w-4 flex-shrink-0 text-lime" />
    </button>
  );
}

function SearchTab({ onSelect }: { onSelect: (f: FoodItem) => void }) {
  const n = useNutrition();
  const [query, setQuery] = useState('');
  const [remote, setRemote] = useState<FoodItem[]>([]);
  const [remoteState, setRemoteState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [remoteMessage, setRemoteMessage] = useState<string | null>(null);
  const [barcodeOpen, setBarcodeOpen] = useState(false);
  const [barcode, setBarcode] = useState('');
  const [barcodeBusy, setBarcodeBusy] = useState(false);
  const [barcodeError, setBarcodeError] = useState<string | null>(null);
  const requestId = useRef(0);

  const trimmed = query.trim();
  const local = useMemo(() => searchLocalFoods(trimmed, 12), [trimmed]);
  const mine = useMemo(
    () => (trimmed ? n.customFoods.filter((c) => matchesQuery(`${c.name} ${c.brand ?? ''}`, trimmed)).slice(0, 8).map(customToFood) : []),
    [n.customFoods, trimmed],
  );

  // Built-in common foods already carry the USDA values, so hide the same USDA record in the database list.
  const remoteShown = useMemo(() => {
    const builtIn = new Set(local.map((f) => f.fdcId).filter((id): id is number => id != null));
    return remote.filter((f) => !(f.ref.startsWith('usda:') && builtIn.has(Number(f.ref.slice(5)))));
  }, [remote, local]);

  useEffect(() => {
    if (trimmed.length < 2) {
      setRemote([]);
      setRemoteState('idle');
      setRemoteMessage(null);
      return;
    }
    const id = ++requestId.current;
    setRemoteState('loading');
    const timer = window.setTimeout(async () => {
      try {
        const result = await searchFoodDatabase(trimmed);
        if (id !== requestId.current) return;
        setRemote(result.foods);
        setRemoteMessage(result.notice);
        setRemoteState('done');
      } catch (err) {
        if (id !== requestId.current) return;
        setRemote([]);
        setRemoteMessage(errorMessage(err));
        setRemoteState('error');
      }
    }, 450);
    return () => window.clearTimeout(timer);
  }, [trimmed]);

  const submitBarcode = async (e: FormEvent) => {
    e.preventDefault();
    const code = barcode.replace(/\D/g, '');
    if (code.length < 6) {
      setBarcodeError('Enter the 8–14 digit number under the barcode.');
      return;
    }
    setBarcodeBusy(true);
    setBarcodeError(null);
    try {
      const own = n.customFoods.find((c) => c.barcode === code);
      const food = own ? customToFood(own) : await lookupBarcode(code);
      if (food) onSelect(food);
      else setBarcodeError('No product found for that barcode. You can create it under My foods.');
    } catch (err) {
      setBarcodeError(errorMessage(err));
    } finally {
      setBarcodeBusy(false);
    }
  };

  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-cloud-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search foods, e.g. chicken breast, hummus"
          aria-label="Search foods"
          autoFocus
          className={cn(inputClass, 'pl-10 pr-10')}
        />
        {query && (
          <button type="button" aria-label="Clear search" onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-cloud-muted">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <button type="button" onClick={() => setBarcodeOpen((v) => !v)} className="mt-2 text-[11px] font-semibold text-lime">
        {barcodeOpen ? 'Hide barcode entry' : 'Type a barcode number instead'}
      </button>
      {barcodeOpen && (
        <form onSubmit={submitBarcode} className="mt-2 flex gap-2">
          <input value={barcode} onChange={(e) => setBarcode(e.target.value)} inputMode="numeric" placeholder="e.g. 5000159407236" aria-label="Barcode number" className={inputClass} />
          <button type="submit" disabled={barcodeBusy} className="flex-shrink-0 rounded-xl bg-ink-elevated px-4 text-xs font-semibold text-cloud disabled:opacity-50">
            {barcodeBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Find'}
          </button>
        </form>
      )}
      {barcodeError && <p className="mt-2 text-xs text-gold">{barcodeError}</p>}

      {!trimmed ? (
        <div className="mt-6">
          <EmptyState
            icon={<Database className="h-5 w-5" />}
            title="Search the food database"
            body="Results combine the USDA FoodData Central database, product labels, your own foods and a list of common foods."
          />
        </div>
      ) : (
        <div className="mt-4 space-y-5">
          {mine.length > 0 && (
            <ResultGroup title="My foods">
              {mine.map((f) => (
                <FoodRow key={f.ref} food={f} onSelect={onSelect} />
              ))}
            </ResultGroup>
          )}
          {local.length > 0 && (
            <ResultGroup title="Common foods">
              {local.map((f) => (
                <FoodRow key={f.ref} food={f} onSelect={onSelect} />
              ))}
            </ResultGroup>
          )}
          {remoteState !== 'error' && (
            <ResultGroup
              title="USDA FoodData Central"
              right={remoteState === 'loading' ? <Loader2 className="h-3.5 w-3.5 animate-spin text-cloud-dim" /> : null}
            >
              {remoteState === 'loading' && remoteShown.length === 0 && <li className="px-3 py-3 text-xs text-cloud-dim">Searching…</li>}
              {remoteShown.map((f) => (
                <FoodRow key={f.ref} food={f} onSelect={onSelect} />
              ))}
              {remoteState === 'done' && remote.length === 0 && <li className="px-3 py-3 text-xs text-cloud-dim">No matches. Try a simpler name, or create the food under My foods.</li>}
              {remoteState === 'done' && remote.length > 0 && remoteShown.length === 0 && <li className="px-3 py-3 text-xs text-cloud-dim">Same USDA foods as in the list above.</li>}
              {remoteState === 'idle' && <li className="px-3 py-3 text-xs text-cloud-dim">Type at least 2 letters.</li>}
            </ResultGroup>
          )}
          {remoteMessage && (
            <Notice tone={remoteState === 'error' ? 'warn' : 'info'} title={remoteState === 'error' ? 'Database search unavailable' : undefined}>
              {/[.!?]$/.test(remoteMessage.trim()) ? remoteMessage.trim() : `${remoteMessage.trim()}.`}
              {remoteState === 'error' && ' Common foods and your own foods still work.'}
            </Notice>
          )}
        </div>
      )}
    </div>
  );
}

function ResultGroup({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between px-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-cloud-dim">{title}</p>
        {right}
      </div>
      <ul className="rounded-2xl border border-ink-border bg-ink-surface p-1">{children}</ul>
    </div>
  );
}

function RecentTab({ onSelect }: { onSelect: (f: FoodItem) => void }) {
  const n = useNutrition();
  const [foods, setFoods] = useState<FoodItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchEntries(addDays(n.today, -30), n.today)
      .then((entries) => {
        if (cancelled) return;
        const seen = new Set<string>();
        const list: FoodItem[] = [];
        for (const e of [...entries].reverse()) {
          const key = (e.food_ref || e.name).toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          const food = foodFromEntry({ ...e, profile: entryProfile(e) });
          if (food) list.push(food);
          if (list.length >= 40) break;
        }
        setFoods(list);
      })
      .catch((err) => !cancelled && setError(errorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, [n.today]);

  if (error) return <Notice tone="warn">{error}</Notice>;
  if (!foods) return <p className="py-6 text-center text-xs text-cloud-dim">Loading recent foods…</p>;
  if (!foods.length) return <EmptyState icon={<Clock className="h-5 w-5" />} title="No recent foods" body="Foods you log appear here for quick re-logging." />;
  return (
    <ul className="rounded-2xl border border-ink-border bg-ink-surface p-1">
      {foods.map((f) => (
        <FoodRow key={f.ref + f.name} food={f} onSelect={onSelect} />
      ))}
    </ul>
  );
}

function FavoritesTab({ onSelect, onSearch }: { onSelect: (f: FoodItem) => void; onSearch: () => void }) {
  const n = useNutrition();
  if (!n.settingsAvailable) return <Notice tone="warn">Favourites need the latest database update.</Notice>;
  if (!n.settings.favorites.length) {
    return (
      <EmptyState
        icon={<Star className="h-5 w-5" />}
        title="No favourites yet"
        body="Tap the star on any food to keep it here."
        action={
          <button type="button" onClick={onSearch} className="rounded-xl bg-ink-elevated px-4 py-2 text-xs font-semibold text-cloud">
            Search foods
          </button>
        }
      />
    );
  }
  return (
    <ul className="rounded-2xl border border-ink-border bg-ink-surface p-1">
      {n.settings.favorites.map((f) => (
        <FoodRow key={f.ref} food={f} onSelect={onSelect} />
      ))}
    </ul>
  );
}

function MineTab({ onSelect, onCreate, onEdit }: { onSelect: (f: FoodItem) => void; onCreate: () => void; onEdit: (id: string) => void }) {
  const n = useNutrition();
  if (!n.customAvailable) return <Notice tone="warn">Your own foods need the latest database update.</Notice>;
  return (
    <div className="space-y-3">
      <button type="button" onClick={onCreate} className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-lime/40 bg-lime/5 px-4 py-4 text-left">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-lime text-ink-bg">
          <Plus className="h-5 w-5" />
        </span>
        <span className="flex-1">
          <span className="block text-sm font-semibold text-cloud">Create a food</span>
          <span className="block text-[11px] text-cloud-dim">Copy the values from the pack label</span>
        </span>
        <ChevronRight className="h-4 w-4 text-cloud-dim" />
      </button>
      {n.customFoods.length === 0 ? (
        <EmptyState icon={<User className="h-5 w-5" />} title="No foods yet" body="Home recipes, local dishes or products not in the database — add them once, log them any time." />
      ) : (
        <ul className="rounded-2xl border border-ink-border bg-ink-surface p-1">
          {n.customFoods.map((c) => {
            const food = customToFood(c);
            return (
              <li key={c.id} className="flex items-center">
                <div className="min-w-0 flex-1">
                  <FoodRowButton food={food} onSelect={onSelect} />
                </div>
                <button type="button" aria-label={`Edit ${c.name}`} onClick={() => onEdit(c.id)} className="mr-2 flex h-9 w-9 items-center justify-center rounded-lg text-cloud-dim hover:bg-ink-elevated">
                  <Pencil className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function QuickAddTab({ date, slot, onAdded }: { date: string; slot: MealSlot; onAdded: (msg: string) => void }) {
  const n = useNutrition();
  const [name, setName] = useState('');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parse = (v: string) => {
    const x = Number(v.replace(',', '.'));
    return Number.isFinite(x) && x >= 0 ? x : 0;
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Give the food a name.');
      return;
    }
    if (!n.noNumbers && !kcal) {
      setError('Enter the calories.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const p = parse(protein);
      const c = parse(carbs);
      const f = parse(fat);
      const energy = kcal ? parse(kcal) : Math.round(p * 4 + c * 4 + f * 9);
      await n.addEntries([
        {
          date,
          slot,
          name: name.trim(),
          amounts: { kcal: energy, protein: p, carbs: c, fat: f, sugar: null, fiber: null, satFat: null, sodiumMg: null, micros: {} },
          servings: 1,
          servingLabel: '1 portion',
          foodRef: null,
          source: 'manual',
        },
      ]);
      onAdded(`Added to ${slotLabel(slot)}`);
      setName('');
      setKcal('');
      setProtein('');
      setCarbs('');
      setFat('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-xs leading-relaxed text-cloud-dim">
        For a meal you can’t find or weigh. Values are your estimate — searching the database is more accurate when possible.
      </p>
      <div>
        <FieldLabel htmlFor="qa-name">Name</FieldLabel>
        <input id="qa-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Chicken shawarma wrap" className={inputClass} />
      </div>
      {!n.noNumbers && (
        <div className="grid grid-cols-2 gap-3">
          <NumberField id="qa-kcal" label="Calories (kcal)" value={kcal} onChange={setKcal} />
          <NumberField id="qa-protein" label="Protein (g)" value={protein} onChange={setProtein} />
          <NumberField id="qa-carbs" label="Carbs (g)" value={carbs} onChange={setCarbs} />
          <NumberField id="qa-fat" label="Fat (g)" value={fat} onChange={setFat} />
        </div>
      )}
      {error && <p className="text-xs text-rust">{error}</p>}
      <button type="submit" disabled={busy} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-lime text-sm font-bold text-ink-bg disabled:opacity-50">
        <Zap className="h-4 w-4" /> {busy ? 'Adding…' : `Add to ${slotLabel(slot)}`}
      </button>
    </form>
  );
}

export function NumberField({ id, label, value, onChange, placeholder }: { id: string; label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <input id={id} value={value} onChange={(e) => onChange(e.target.value)} inputMode="decimal" placeholder={placeholder ?? '0'} className={inputClass} />
    </div>
  );
}
