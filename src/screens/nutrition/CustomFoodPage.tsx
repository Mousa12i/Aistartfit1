import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/Modal';
import { errorMessage } from '@/lib/nutrition/api';
import { atwaterKcal, round } from '@/lib/nutrition/nutrients';
import { useNutrition } from './NutritionContext';
import { useNutritionNav } from './nav';
import { NumberField } from './AddFoodPage';
import { FieldLabel, Notice, Page, PageHeader, Segmented, SetupRequired, inputClass } from './ui';

type Basis = 'per100' | 'serving';
type SaltUnit = 'salt_g' | 'sodium_mg';

const parse = (v: string): number | null => {
  if (!v.trim()) return null;
  const x = Number(v.replace(',', '.'));
  return Number.isFinite(x) && x >= 0 ? x : NaN;
};

export function CustomFoodPage() {
  const n = useNutrition();
  const { params, replace } = useNutritionNav();
  const editId = params.get('id');
  const existing = editId ? n.customFoods.find((c) => c.id === editId) ?? null : null;
  const meal = params.get('meal');
  const date = params.get('date');

  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [barcode, setBarcode] = useState('');
  const [basis, setBasis] = useState<Basis>('serving');
  const [servingGrams, setServingGrams] = useState('');
  const [servingLabel, setServingLabel] = useState('');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [sugar, setSugar] = useState('');
  const [fiber, setFiber] = useState('');
  const [satFat, setSatFat] = useState('');
  const [salt, setSalt] = useState('');
  const [saltUnit, setSaltUnit] = useState<SaltUnit>('salt_g');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!existing) return;
    setName(existing.name);
    setBrand(existing.brand ?? '');
    setBarcode(existing.barcode ?? '');
    setBasis('per100');
    setServingGrams(existing.serving_grams ? String(existing.serving_grams) : '');
    setServingLabel(existing.serving_label ?? '');
    setKcal(String(existing.kcal));
    setProtein(String(existing.protein));
    setCarbs(String(existing.carbs));
    setFat(String(existing.fat));
    setSugar(existing.sugar == null ? '' : String(existing.sugar));
    setFiber(existing.fiber == null ? '' : String(existing.fiber));
    setSatFat(existing.sat_fat == null ? '' : String(existing.sat_fat));
    setSaltUnit('sodium_mg');
    setSalt(existing.sodium_mg == null ? '' : String(existing.sodium_mg));
  }, [existing]);

  const back = () => replace('add', { meal, date, tab: 'mine' });

  const preview = useMemo(() => {
    const k = parse(kcal);
    const p = parse(protein) ?? 0;
    const c = parse(carbs) ?? 0;
    const f = parse(fat) ?? 0;
    if (k == null || Number.isNaN(k) || Number.isNaN(p) || Number.isNaN(c) || Number.isNaN(f)) return null;
    const macro = atwaterKcal(p, c, f);
    return { k, macro, mismatch: k > 20 && Math.abs(macro - k) / k > 0.2 };
  }, [kcal, protein, carbs, fat]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError('Give the food a name.');
    const k = parse(kcal);
    if (k == null || Number.isNaN(k)) return setError('Enter the calories.');
    const values = [protein, carbs, fat, sugar, fiber, satFat, salt].map(parse);
    if (values.some((v) => Number.isNaN(v))) return setError('Numbers only, please (use . or , for decimals).');
    const sg = parse(servingGrams);
    if (basis === 'serving' && (sg == null || Number.isNaN(sg) || sg <= 0)) return setError('Enter the serving size in grams (or ml).');
    const code = barcode.replace(/\D/g, '');
    if (code && (code.length < 6 || code.length > 14)) return setError('A barcode has 6–14 digits.');

    const factor = basis === 'serving' && sg ? 100 / sg : 1;
    const per100 = (v: number | null) => (v == null ? null : round(v * factor, 2));
    const [p, c, f, su, fi, sf, sa] = values as (number | null)[];
    const sodium = sa == null ? null : saltUnit === 'salt_g' ? sa * 400 : sa;
    const kcal100 = per100(k) ?? 0;
    const macros100 = [per100(p) ?? 0, per100(c) ?? 0, per100(f) ?? 0];
    if (kcal100 > 900 || macros100.some((m) => m > 100)) return setError('Those values are more than 100 g per 100 g — check the serving size.');

    setBusy(true);
    try {
      await n.saveCustomFood({
        id: existing?.id,
        name: name.trim(),
        brand: brand.trim() || null,
        barcode: code || null,
        serving_grams: sg && !Number.isNaN(sg) && sg > 0 ? sg : null,
        serving_label: servingLabel.trim() || null,
        kcal: kcal100,
        protein: macros100[0],
        carbs: macros100[1],
        fat: macros100[2],
        sugar: per100(su),
        fiber: per100(fi),
        sat_fat: per100(sf),
        sodium_mg: sodium == null ? null : Math.round(sodium * factor),
      });
      back();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!existing) return;
    setBusy(true);
    try {
      await n.deleteCustomFood(existing.id);
      back();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  if (!n.customAvailable) {
    return (
      <Page>
        <PageHeader title="Create a food" onBack={back} />
        <SetupRequired feature="Creating your own foods" />
      </Page>
    );
  }

  const unitWord = basis === 'serving' ? 'per serving' : 'per 100 g';

  return (
    <Page>
      <PageHeader
        title={existing ? 'Edit food' : 'Create a food'}
        subtitle="Copy the values from the nutrition label"
        onBack={back}
        right={
          existing ? (
            <button type="button" aria-label="Delete food" onClick={() => setConfirmDelete(true)} className="flex h-10 w-10 items-center justify-center rounded-xl bg-rust/10 text-rust">
              <Trash2 className="h-4 w-4" />
            </button>
          ) : null
        }
      />
      <form onSubmit={submit} className="space-y-5">
        <div className="space-y-3">
          <div>
            <FieldLabel htmlFor="cf-name">Name *</FieldLabel>
            <input id="cf-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="e.g. Mum's mansaf, Protein bar" className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel htmlFor="cf-brand">Brand</FieldLabel>
              <input id="cf-brand" value={brand} onChange={(e) => setBrand(e.target.value)} maxLength={120} placeholder="Optional" className={inputClass} />
            </div>
            <div>
              <FieldLabel htmlFor="cf-barcode">Barcode</FieldLabel>
              <input id="cf-barcode" value={barcode} onChange={(e) => setBarcode(e.target.value)} inputMode="numeric" placeholder="Optional" className={inputClass} />
            </div>
          </div>
        </div>

        <div>
          <FieldLabel>Values on the label are</FieldLabel>
          <Segmented
            value={basis}
            onChange={setBasis}
            options={[
              { value: 'serving', label: 'Per serving' },
              { value: 'per100', label: 'Per 100 g / ml' },
            ]}
          />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <NumberField id="cf-sg" label={basis === 'serving' ? 'Serving size (g) *' : 'Serving size (g)'} value={servingGrams} onChange={setServingGrams} placeholder="e.g. 60" />
            <div>
              <FieldLabel htmlFor="cf-sl">Serving name</FieldLabel>
              <input id="cf-sl" value={servingLabel} onChange={(e) => setServingLabel(e.target.value)} maxLength={60} placeholder="e.g. 1 bar" className={inputClass} />
            </div>
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-cloud">Nutrition {unitWord}</p>
          <div className="grid grid-cols-2 gap-3">
            <NumberField id="cf-kcal" label="Energy (kcal) *" value={kcal} onChange={setKcal} />
            <NumberField id="cf-p" label="Protein (g)" value={protein} onChange={setProtein} />
            <NumberField id="cf-c" label="Carbohydrate (g)" value={carbs} onChange={setCarbs} />
            <NumberField id="cf-su" label="of which sugars (g)" value={sugar} onChange={setSugar} placeholder="Optional" />
            <NumberField id="cf-f" label="Fat (g)" value={fat} onChange={setFat} />
            <NumberField id="cf-sf" label="of which saturates (g)" value={satFat} onChange={setSatFat} placeholder="Optional" />
            <NumberField id="cf-fi" label="Fibre (g)" value={fiber} onChange={setFiber} placeholder="Optional" />
            <div>
              <FieldLabel htmlFor="cf-salt">{saltUnit === 'salt_g' ? 'Salt (g)' : 'Sodium (mg)'}</FieldLabel>
              <div className="flex gap-1.5">
                <input id="cf-salt" value={salt} onChange={(e) => setSalt(e.target.value)} inputMode="decimal" placeholder="Optional" className={inputClass} />
                <button
                  type="button"
                  onClick={() => setSaltUnit((u) => (u === 'salt_g' ? 'sodium_mg' : 'salt_g'))}
                  className="flex-shrink-0 rounded-xl bg-ink-elevated px-2 text-[10px] font-semibold text-cloud-dim"
                  aria-label="Switch between salt and sodium"
                >
                  {saltUnit === 'salt_g' ? 'Na mg' : 'Salt g'}
                </button>
              </div>
            </div>
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-cloud-muted">UK and EU labels list salt; US labels list sodium. Salt (g) × 400 = sodium (mg).</p>
        </div>

        {preview?.mismatch && (
          <div className="flex gap-2 rounded-xl border border-gold/30 bg-gold/5 p-3 text-[11px] leading-relaxed text-cloud-dim">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 text-gold" />
            Protein, carbs and fat add up to about {Math.round(preview.macro)} kcal, but you entered {Math.round(preview.k)} kcal. Double-check the label (alcohol and some sweeteners also add energy).
          </div>
        )}
        {error && <Notice tone="warn">{error}</Notice>}

        <button type="submit" disabled={busy} className="h-12 w-full rounded-xl bg-lime text-sm font-bold text-ink-bg disabled:opacity-50">
          {busy ? 'Saving…' : existing ? 'Save changes' : 'Save food'}
        </button>
      </form>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this food?"
        message="It will be removed from My foods. Entries already in your diary stay as they are."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </Page>
  );
}
