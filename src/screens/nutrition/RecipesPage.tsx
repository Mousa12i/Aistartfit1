import { useState } from 'react';
import { RecipeCard, RecipeDetail } from '@/components/RecipeCard';
import { RECIPES, type Recipe } from '@/lib/recipes';
import { errorMessage, slotLabel, type MealSlot } from '@/lib/nutrition/api';
import { useNutrition } from './NutritionContext';
import { useNutritionNav } from './nav';
import { Chip, Notice, Page, PageHeader, Toast } from './ui';

const FILTERS = ['all', 'breakfast', 'lunch', 'dinner', 'snack'] as const;
type Filter = (typeof FILTERS)[number];

export function RecipesPage() {
  const n = useNutrition();
  const { go } = useNutritionNav();
  const [filter, setFilter] = useState<Filter>('all');
  const [selected, setSelected] = useState<Recipe | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const list = filter === 'all' ? RECIPES : RECIPES.filter((r) => r.mealType === filter);

  const log = async (recipe: Recipe, name: string, kcal: number, protein: number, carbs: number, fat: number) => {
    const slot: MealSlot = recipe.mealType;
    try {
      await n.addEntries([
        {
          date: n.today,
          slot,
          name,
          amounts: { kcal, protein, carbs, fat, sugar: null, fiber: null, satFat: null, sodiumMg: null, micros: {} },
          servings: 1,
          servingLabel: 'portion (recipe)',
          foodRef: `recipe:${recipe.id}`,
          source: 'recipe',
        },
      ]);
      setToast(`Logged to ${slotLabel(slot)}`);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  if (selected) {
    return (
      <div className="mx-auto w-full max-w-2xl pb-32">
        {error && (
          <div className="px-5 pt-4">
            <Notice tone="warn">{error}</Notice>
          </div>
        )}
        <RecipeDetail recipe={selected} onBack={() => setSelected(null)} onLog={(name, kcal, protein, carbs, fat) => log(selected, name, kcal, protein, carbs, fat)} />
        <Toast message={toast} onDone={() => setToast(null)} />
      </div>
    );
  }

  return (
    <Page>
      <PageHeader title="Recipes" subtitle="Training-friendly meals you can log in one tap" onBack={() => go('hub')} />
      <div className="-mx-5 mb-4 flex gap-2 overflow-x-auto px-5 pb-1 scrollbar-hide">
        {FILTERS.map((f) => (
          <Chip key={f} active={filter === f} onClick={() => setFilter(f)}>
            {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
          </Chip>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {list.map((r) => (
          <RecipeCard key={r.id} recipe={r} onClick={() => setSelected(r)} />
        ))}
      </div>
      <p className="mt-4 text-center text-[10px] leading-relaxed text-cloud-muted">Recipe nutrition is estimated per serving from the listed ingredients.</p>
      <Toast message={toast} onDone={() => setToast(null)} />
    </Page>
  );
}
