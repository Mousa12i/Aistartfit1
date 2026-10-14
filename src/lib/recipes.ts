export interface RecipeIngredient {
  name: string;
  amount: number;
  unit: string;
}

export interface Recipe {
  id: string;
  name: string;
  description: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  prepMinutes: number;
  cookMinutes: number;
  defaultServings: number;
  imageUrl: string;
  photographer: string;
  perServing: {
    kcal: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  ingredients: RecipeIngredient[];
  steps: string[];
  tags: string[];
}

const LICENSE = 'Pexels photo, free to use under the Pexels License.';

export const RECIPES: Recipe[] = [
  {
    id: 'chicken-rice-bowl',
    name: 'Grilled Chicken & Rice Bowl',
    description: 'Lean grilled chicken breast over seasoned rice with fresh vegetables — a balanced post-workout staple.',
    mealType: 'lunch',
    prepMinutes: 10,
    cookMinutes: 20,
    defaultServings: 1,
    imageUrl: 'https://images.pexels.com/photos/40108711/pexels-photo-40108711.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    photographer: 'Caleb Oquendo',
    perServing: { kcal: 520, protein: 42, carbs: 55, fat: 12 },
    tags: ['High protein', 'Post-workout', 'Meal prep'],
    ingredients: [
      { name: 'Chicken breast', amount: 200, unit: 'g' },
      { name: 'Brown rice (dry)', amount: 80, unit: 'g' },
      { name: 'Mixed vegetables', amount: 150, unit: 'g' },
      { name: 'Olive oil', amount: 1, unit: 'tbsp' },
      { name: 'Salt and pepper', amount: 1, unit: 'pinch' },
    ],
    steps: [
      'Cook the rice according to package directions.',
      'Season the chicken breast with salt, pepper, and a drizzle of olive oil.',
      'Grill the chicken over medium-high heat for 6-8 minutes per side until cooked through.',
      'Steam or stir-fry the mixed vegetables until tender-crisp.',
      'Slice the chicken and serve over rice with the vegetables.',
    ],
  },
  {
    id: 'greek-yogurt-bowl',
    name: 'Greek Yogurt & Berry Bowl',
    description: 'Creamy Greek yogurt topped with fresh berries and a sprinkle of granola — a quick protein-rich breakfast.',
    mealType: 'breakfast',
    prepMinutes: 5,
    cookMinutes: 0,
    defaultServings: 1,
    imageUrl: 'https://images.pexels.com/photos/6823339/pexels-photo-6823339.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    photographer: 'Antoni Shkraba',
    perServing: { kcal: 310, protein: 22, carbs: 38, fat: 7 },
    tags: ['High protein', 'No-cook', 'Breakfast'],
    ingredients: [
      { name: 'Greek yogurt (0%)', amount: 200, unit: 'g' },
      { name: 'Mixed berries', amount: 100, unit: 'g' },
      { name: 'Granola', amount: 40, unit: 'g' },
      { name: 'Honey', amount: 1, unit: 'tsp' },
    ],
    steps: [
      'Spoon the Greek yogurt into a bowl.',
      'Top with mixed berries and granola.',
      'Drizzle with honey and serve immediately.',
    ],
  },
  {
    id: 'salmon-roast-veg',
    name: 'Salmon with Roasted Vegetables',
    description: 'Omega-3-rich grilled salmon with colourful roasted vegetables for a satisfying dinner.',
    mealType: 'dinner',
    prepMinutes: 10,
    cookMinutes: 25,
    defaultServings: 2,
    imageUrl: 'https://images.pexels.com/photos/14515103/pexels-photo-14515103.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    photographer: 'Vidal Balielo Jr.',
    perServing: { kcal: 480, protein: 38, carbs: 22, fat: 24 },
    tags: ['Omega-3', 'Dinner', 'Low-carb'],
    ingredients: [
      { name: 'Salmon fillets', amount: 2, unit: 'fillets' },
      { name: 'Broccoli', amount: 200, unit: 'g' },
      { name: 'Bell peppers', amount: 2, unit: 'whole' },
      { name: 'Sweet potato', amount: 200, unit: 'g' },
      { name: 'Olive oil', amount: 2, unit: 'tbsp' },
      { name: 'Lemon', amount: 1, unit: 'whole' },
    ],
    steps: [
      'Preheat the oven to 200°C / 400°F.',
      'Chop the vegetables and sweet potato into even pieces.',
      'Toss vegetables with olive oil, salt, and pepper. Roast for 20 minutes.',
      'Season the salmon and add to the tray for the last 10-12 minutes.',
      'Squeeze lemon over the salmon and vegetables before serving.',
    ],
  },
  {
    id: 'oatmeal-fruit-nuts',
    name: 'Oatmeal with Fruit & Nuts',
    description: 'Warm oatmeal bowl topped with banana, berries, and walnuts for sustained morning energy.',
    mealType: 'breakfast',
    prepMinutes: 5,
    cookMinutes: 10,
    defaultServings: 1,
    imageUrl: 'https://images.pexels.com/photos/7655880/pexels-photo-7655880.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    photographer: 'Cup of Couple',
    perServing: { kcal: 380, protein: 12, carbs: 62, fat: 11 },
    tags: ['Complex carbs', 'Fibre', 'Breakfast'],
    ingredients: [
      { name: 'Rolled oats', amount: 60, unit: 'g' },
      { name: 'Milk or water', amount: 250, unit: 'ml' },
      { name: 'Banana', amount: 1, unit: 'whole' },
      { name: 'Blueberries', amount: 50, unit: 'g' },
      { name: 'Walnuts', amount: 20, unit: 'g' },
    ],
    steps: [
      'Combine oats and milk (or water) in a saucepan.',
      'Bring to a simmer and cook for 5 minutes, stirring occasionally.',
      'Transfer to a bowl and top with sliced banana, blueberries, and walnuts.',
    ],
  },
  {
    id: 'protein-smoothie',
    name: 'Berry Protein Smoothie',
    description: 'A fast post-workout shake with protein powder, banana, and mixed berries.',
    mealType: 'snack',
    prepMinutes: 5,
    cookMinutes: 0,
    defaultServings: 1,
    imageUrl: 'https://images.pexels.com/photos/775030/pexels-photo-775030.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    photographer: 'Element5 Digital',
    perServing: { kcal: 280, protein: 30, carbs: 32, fat: 4 },
    tags: ['Post-workout', 'High protein', 'No-cook'],
    ingredients: [
      { name: 'Whey protein powder', amount: 1, unit: 'scoop' },
      { name: 'Banana', amount: 1, unit: 'whole' },
      { name: 'Mixed frozen berries', amount: 100, unit: 'g' },
      { name: 'Milk or water', amount: 300, unit: 'ml' },
    ],
    steps: [
      'Add all ingredients to a blender.',
      'Blend until smooth, about 30 seconds.',
      'Pour into a glass and serve immediately.',
    ],
  },
  {
    id: 'steak-sweet-potato',
    name: 'Steak & Sweet Potato Plate',
    description: 'Lean beef steak with roasted sweet potato for a protein-dense, iron-rich dinner.',
    mealType: 'dinner',
    prepMinutes: 10,
    cookMinutes: 20,
    defaultServings: 1,
    imageUrl: 'https://images.pexels.com/photos/9465599/pexels-photo-9465599.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    photographer: 'Terrance Barksdale',
    perServing: { kcal: 550, protein: 45, carbs: 38, fat: 22 },
    tags: ['Iron-rich', 'Dinner', 'Strength'],
    ingredients: [
      { name: 'Lean beef steak', amount: 200, unit: 'g' },
      { name: 'Sweet potato', amount: 250, unit: 'g' },
      { name: 'Green salad', amount: 100, unit: 'g' },
      { name: 'Olive oil', amount: 1, unit: 'tbsp' },
      { name: 'Salt and pepper', amount: 1, unit: 'pinch' },
    ],
    steps: [
      'Preheat the oven to 200°C / 400°F.',
      'Cut the sweet potato into wedges, toss with olive oil, and roast for 20 minutes.',
      'Season the steak with salt and pepper.',
      'Sear the steak in a hot pan for 3-4 minutes per side for medium-rare.',
      'Rest the steak for 5 minutes, then slice and serve with sweet potato wedges and salad.',
    ],
  },
];

export function getRecipeById(id: string): Recipe | undefined {
  return RECIPES.find((r) => r.id === id);
}

export { LICENSE as PEXELS_LICENSE };
