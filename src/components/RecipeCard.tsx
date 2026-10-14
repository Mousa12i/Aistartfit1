import { useState } from 'react';
import { Clock, Users, Flame, ChevronLeft, Plus, Minus, Check } from 'lucide-react';
import type { Recipe } from '@/lib/recipes';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

interface RecipeCardProps {
  recipe: Recipe;
  onClick: () => void;
}

export function RecipeCard({ recipe, onClick }: RecipeCardProps) {
  return (
    <button
      onClick={onClick}
      className="group text-left w-full"
    >
      <Card className="overflow-hidden !p-0 transition-all hover:border-lime/30">
        <div className="relative aspect-[16/10] bg-ink-secondary overflow-hidden">
          <img
            src={recipe.imageUrl}
            alt={recipe.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute top-2 left-2 flex gap-1.5">
            {recipe.tags.slice(0, 2).map((tag) => (
              <span key={tag} className="px-2 py-0.5 rounded-md bg-ink-bg/80 backdrop-blur-sm text-[9px] font-medium text-lime">
                {tag}
              </span>
            ))}
          </div>
          <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-ink-bg/80 backdrop-blur-sm text-[9px] text-cloud-dim">
            {recipe.photographer} · Pexels
          </div>
        </div>
        <div className="p-3">
          <h4 className="text-sm font-semibold text-cloud leading-tight mb-1">{recipe.name}</h4>
          <p className="text-[11px] text-cloud-dim leading-relaxed line-clamp-2 mb-2">{recipe.description}</p>
          <div className="flex items-center gap-3 text-[10px] text-cloud-dim">
            <span className="flex items-center gap-1"><Flame className="w-3 h-3 text-lime" />{recipe.perServing.kcal} kcal</span>
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{recipe.prepMinutes + recipe.cookMinutes} min</span>
            <span className="flex items-center gap-1"><Users className="w-3 h-3" />{recipe.defaultServings}</span>
          </div>
        </div>
      </Card>
    </button>
  );
}

interface RecipeDetailProps {
  recipe: Recipe;
  onBack: () => void;
  onLog?: (name: string, kcal: number, protein: number, carbs: number, fat: number) => void;
}

export function RecipeDetail({ recipe, onBack, onLog }: RecipeDetailProps) {
  const [servings, setServings] = useState(recipe.defaultServings);
  const [logged, setLogged] = useState(false);

  const ratio = servings / recipe.defaultServings;
  const scaledNutrition = {
    kcal: Math.round(recipe.perServing.kcal * ratio),
    protein: Math.round(recipe.perServing.protein * ratio),
    carbs: Math.round(recipe.perServing.carbs * ratio),
    fat: Math.round(recipe.perServing.fat * ratio),
  };

  const handleLog = () => {
    if (!onLog || logged) return;
    onLog(recipe.name, scaledNutrition.kcal, scaledNutrition.protein, scaledNutrition.carbs, scaledNutrition.fat);
    setLogged(true);
  };

  return (
    <div className="animate-fade-in pb-6">
      <div className="px-5 pt-6 pb-3 flex items-center gap-3">
        <button onClick={onBack} className="w-10 h-10 rounded-xl bg-ink-elevated flex items-center justify-center text-cloud-dim hover:text-cloud transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-display-md text-cloud font-bold flex-1 truncate">Recipe</h1>
      </div>

      <div className="px-5">
        <div className="relative aspect-[16/10] rounded-xl2 overflow-hidden bg-ink-secondary mb-4">
          <img src={recipe.imageUrl} alt={recipe.name} className="h-full w-full object-cover" />
          <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-ink-bg/80 backdrop-blur-sm text-[9px] text-cloud-dim">
            {recipe.photographer} · Pexels
          </div>
        </div>

        <h2 className="text-display-sm text-cloud font-bold mb-2">{recipe.name}</h2>
        <p className="text-sm text-cloud-dim leading-relaxed mb-4">{recipe.description}</p>

        <div className="flex flex-wrap gap-1.5 mb-4">
          {recipe.tags.map((tag) => (
            <span key={tag} className="px-2.5 py-1 rounded-md bg-lime/10 text-[10px] font-medium text-lime">{tag}</span>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          <Card className="p-3 text-center">
            <Clock className="w-4 h-4 text-cloud-dim mx-auto mb-1" />
            <p className="text-sm font-bold text-cloud">{recipe.prepMinutes + recipe.cookMinutes}</p>
            <p className="text-[9px] text-cloud-dim">minutes</p>
          </Card>
          <Card className="p-3 text-center">
            <Users className="w-4 h-4 text-cloud-dim mx-auto mb-1" />
            <p className="text-sm font-bold text-cloud">{servings}</p>
            <p className="text-[9px] text-cloud-dim">servings</p>
          </Card>
          <Card className="p-3 text-center">
            <Flame className="w-4 h-4 text-lime mx-auto mb-1" />
            <p className="text-sm font-bold text-cloud">{scaledNutrition.kcal}</p>
            <p className="text-[9px] text-cloud-dim">kcal/serv</p>
          </Card>
        </div>

        {/* Serving Adjustment */}
        <Card className="p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-cloud">Servings</p>
              <p className="text-[10px] text-cloud-dim">Adjust quantities and nutrition</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setServings((s) => Math.max(1, s - 1))}
                className="w-9 h-9 rounded-lg bg-ink-elevated flex items-center justify-center text-cloud-dim hover:text-cloud transition-colors"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="w-8 text-center text-lg font-bold text-cloud">{servings}</span>
              <button
                onClick={() => setServings((s) => Math.min(10, s + 1))}
                className="w-9 h-9 rounded-lg bg-ink-elevated flex items-center justify-center text-cloud-dim hover:text-cloud transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </Card>

        {/* Nutrition per serving (scaled) */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          <NutritionPill label="Kcal" value={scaledNutrition.kcal} color="text-lime" />
          <NutritionPill label="Protein" value={`${scaledNutrition.protein}g`} color="text-rust" />
          <NutritionPill label="Carbs" value={`${scaledNutrition.carbs}g`} color="text-gold" />
          <NutritionPill label="Fat" value={`${scaledNutrition.fat}g`} color="text-sky" />
        </div>

        {/* Ingredients */}
        <div className="mb-4">
          <h3 className="text-xs font-semibold text-cloud-dim uppercase tracking-wider mb-3">Ingredients</h3>
          <Card className="p-4">
            <div className="space-y-2.5">
              {recipe.ingredients.map((ing, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-sm text-cloud">{ing.name}</span>
                  <span className="text-xs text-cloud-dim font-mono">
                    {(ing.amount * ratio).toFixed(ing.unit === 'whole' || ing.unit === 'fillets' || ing.unit === 'scoop' ? 0 : 1)}
                    {' '}
                    {ing.unit}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Steps */}
        <div className="mb-4">
          <h3 className="text-xs font-semibold text-cloud-dim uppercase tracking-wider mb-3">Method</h3>
          <div className="space-y-2.5">
            {recipe.steps.map((step, i) => (
              <div key={i} className="flex items-start gap-3 rounded-xl2 bg-ink-surface border border-ink-border p-3">
                <div className="w-6 h-6 rounded-lg bg-lime/10 flex items-center justify-center text-lime text-[10px] font-bold flex-shrink-0">
                  {i + 1}
                </div>
                <p className="text-sm text-cloud-dim leading-relaxed pt-0.5">{step}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Log to diary */}
        {onLog && (
          <Button
            onClick={handleLog}
            variant={logged ? 'outline' : 'primary'}
            size="lg"
            className="w-full"
            disabled={logged}
          >
            {logged ? (
              <>
                <Check className="w-4 h-4" /> Logged to food diary
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" /> Log this meal ({scaledNutrition.kcal} kcal)
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

function NutritionPill({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="rounded-xl bg-ink-surface border border-ink-border p-2.5 text-center">
      <p className={cn('text-sm font-bold', color)}>{value}</p>
      <p className="text-[9px] text-cloud-dim mt-0.5">{label}</p>
    </div>
  );
}
