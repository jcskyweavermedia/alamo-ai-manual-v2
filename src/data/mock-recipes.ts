// =============================================================================
// MOCK RECIPE DATA
// Hardcoded recipes for BOH Recipe Viewer (Phase 1 - no Supabase integration)
// =============================================================================

// --- Types ---

export type Allergen = 'dairy' | 'gluten' | 'nuts' | 'shellfish' | 'soy' | 'eggs';

export type RecipeType = 'prep' | 'plate';

export type PrepCategory = 'sauce' | 'base' | 'compound-butter' | 'marinade';

export type PlateCategory = 'entree' | 'appetizer' | 'side' | 'dessert';

export interface Ingredient {
  qty: string;
  unit: string;
  name: string;
  prepRecipeRef?: string;
  allergens?: Allergen[];
}

export interface IngredientGroup {
  label: string;
  items: Ingredient[];
}

export interface ProcedureStep {
  text: string;
  critical?: boolean;
}

export interface ProcedureGroup {
  label: string;
  steps: ProcedureStep[];
  image?: string;
}

export interface PrepRecipe {
  id: string;
  slug: string;
  type: 'prep';
  name: string;
  image: string;
  category: PrepCategory;
  tags: string[];
  allergens: Allergen[];
  yield: string;
  shelfLife: string;
  ingredientGroups: IngredientGroup[];
  procedureGroups: ProcedureGroup[];
  batchScaling?: string;
  trainingNotes?: string;
}

export interface PlateComponent {
  qty: string;
  unit: string;
  name: string;
  prepRecipeRef?: string;
}

export interface PlateComponentGroup {
  label: string;
  items: PlateComponent[];
}

export interface PlateSpec {
  id: string;
  slug: string;
  type: 'plate';
  name: string;
  image: string;
  category: PlateCategory;
  tags: string[];
  allergens: Allergen[];
  componentGroups: PlateComponentGroup[];
  assemblyGroups: ProcedureGroup[];
  platingNotes?: string;
}

export type Recipe = PrepRecipe | PlateSpec;

// --- Allergen display config ---

export const ALLERGEN_CONFIG: Record<Allergen, { label: string; color: string; darkColor: string }> = {
  dairy: { label: 'Dairy', color: 'bg-amber-100 text-amber-800', darkColor: 'dark:bg-amber-900/30 dark:text-amber-300' },
  gluten: { label: 'Gluten', color: 'bg-orange-100 text-orange-800', darkColor: 'dark:bg-orange-900/30 dark:text-orange-300' },
  nuts: { label: 'Nuts', color: 'bg-red-100 text-red-800', darkColor: 'dark:bg-red-900/30 dark:text-red-300' },
  shellfish: { label: 'Shellfish', color: 'bg-rose-100 text-rose-800', darkColor: 'dark:bg-rose-900/30 dark:text-rose-300' },
  soy: { label: 'Soy', color: 'bg-yellow-100 text-yellow-800', darkColor: 'dark:bg-yellow-900/30 dark:text-yellow-300' },
  eggs: { label: 'Eggs', color: 'bg-lime-100 text-lime-800', darkColor: 'dark:bg-lime-900/30 dark:text-lime-300' },
};

// --- Quantity scaling utility ---

function formatScaled(n: number): string {
  if (n === Math.floor(n)) return n.toString();
  const oneDecimal = Math.round(n * 10) / 10;
  if (oneDecimal === Math.floor(oneDecimal)) return oneDecimal.toString();
  return oneDecimal.toFixed(1);
}

export function scaleQuantity(qty: string, multiplier: number): string {
  if (!qty.trim() || multiplier === 1) return qty;

  // Fractions: "1/2", "3/4"
  const fractionMatch = qty.match(/^(\d+)\/(\d+)$/);
  if (fractionMatch) {
    const val = (parseInt(fractionMatch[1]) / parseInt(fractionMatch[2])) * multiplier;
    return formatScaled(val);
  }

  // Plain numbers
  const num = parseFloat(qty);
  if (!isNaN(num)) {
    return formatScaled(num * multiplier);
  }

  return qty;
}

// --- Mock Data: 4 Prep Recipes ---

const redWineDemiGlace: PrepRecipe = {
  id: 'prep-1',
  slug: 'red-wine-demi-glace',
  type: 'prep',
  name: 'Red Wine Demi-Glace',
  image: 'https://picsum.photos/seed/demi-glace/400/300',
  category: 'sauce',
  tags: ['signature', 'mother sauce', 'slow cook'],
  allergens: ['dairy'],
  yield: '1.5 qt',
  shelfLife: '7 days',
  ingredientGroups: [
    {
      label: 'Base',
      items: [
        { qty: '2', unit: 'qt', name: 'Veal Stock', prepRecipeRef: 'veal-stock' },
        { qty: '750', unit: 'ml', name: 'Dry red wine (Cabernet)' },
        { qty: '1', unit: 'cup', name: 'Mirepoix, fine dice' },
        { qty: '2', unit: 'tbsp', name: 'Tomato paste' },
      ],
    },
    {
      label: 'Finish',
      items: [
        { qty: '2', unit: 'tbsp', name: 'Unsalted butter, cold', allergens: ['dairy'] },
        { qty: '1', unit: 'tsp', name: 'Fresh thyme leaves' },
        { qty: '', unit: '', name: 'Kosher salt & black pepper to taste' },
      ],
    },
  ],
  procedureGroups: [
    {
      label: 'Reduction',
      image: 'https://picsum.photos/seed/reduction-sauce/200/150',
      steps: [
        { text: 'Sweat mirepoix in heavy-bottom saucepan over medium heat until translucent (5-6 min).' },
        { text: 'Add tomato paste, cook stirring 2 min until darkened slightly.' },
        { text: 'Deglaze with red wine. Reduce by half over medium-high (15-20 min).' },
        { text: 'Add veal stock. Simmer and reduce by half (45-60 min), skimming impurities.' },
      ],
    },
    {
      label: 'Finish & Store',
      image: 'https://picsum.photos/seed/strain-sauce/200/150',
      steps: [
        { text: 'Strain through fine-mesh sieve, pressing solids. Discard solids.' },
        { text: 'Return to clean pan — sauce should coat a spoon (nappe consistency).', critical: true },
        { text: 'Off heat: monte au beurre — whisk in cold butter one piece at a time.' },
        { text: 'Season with salt, pepper, thyme. Cool rapidly in ice bath.', critical: true },
        { text: 'Transfer to labeled deli containers. Date and refrigerate.' },
      ],
    },
  ],
  batchScaling: 'Scales linearly. Double batch: use wider pot to maintain reduction speed. +20 min total.',
  trainingNotes: 'Nappe = sauce coats and clings to a spoon without dripping immediately. Too thin → reduce further. Too thick → thin with stock.',
};

const chimichurri: PrepRecipe = {
  id: 'prep-2',
  slug: 'chimichurri',
  type: 'prep',
  name: 'Chimichurri',
  image: 'https://picsum.photos/seed/chimichurri/400/300',
  category: 'sauce',
  tags: ['signature', 'raw', 'Argentine'],
  allergens: [],
  yield: '3 cups',
  shelfLife: '5 days',
  ingredientGroups: [
    {
      label: 'Herbs & Aromatics',
      items: [
        { qty: '2', unit: 'cups', name: 'Flat-leaf parsley, packed, fine chop' },
        { qty: '1/2', unit: 'cup', name: 'Fresh oregano leaves, fine chop' },
        { qty: '6', unit: 'cloves', name: 'Garlic, minced' },
        { qty: '1', unit: 'pc', name: 'Shallot, minced fine' },
        { qty: '1', unit: 'tsp', name: 'Red pepper flakes' },
      ],
    },
    {
      label: 'Liquid',
      items: [
        { qty: '3/4', unit: 'cup', name: 'Extra virgin olive oil' },
        { qty: '1/4', unit: 'cup', name: 'Red wine vinegar' },
        { qty: '2', unit: 'tbsp', name: 'Fresh lemon juice' },
        { qty: '', unit: '', name: 'Kosher salt & black pepper to taste' },
      ],
    },
  ],
  procedureGroups: [
    {
      label: 'Preparation',
      image: 'https://picsum.photos/seed/herb-chop/200/150',
      steps: [
        { text: 'Combine chopped herbs, garlic, shallot, and red pepper flakes in mixing bowl.' },
        { text: 'Add olive oil, vinegar, and lemon juice. Stir to combine.' },
        { text: 'Season with salt and pepper. Adjust acid/oil balance.' },
        { text: 'Rest at room temp 30 min for flavors to meld.' },
        { text: 'Transfer to labeled squeeze bottles or deli containers. Date and refrigerate.', critical: true },
      ],
    },
  ],
  trainingNotes: 'Bright green with visible herb texture — do NOT use food processor. Hand-chop only. Should be loose and pourable, not paste-like.',
};

const herbCompoundButter: PrepRecipe = {
  id: 'prep-3',
  slug: 'herb-compound-butter',
  type: 'prep',
  name: 'Herb Compound Butter',
  image: 'https://picsum.photos/seed/herb-butter/400/300',
  category: 'compound-butter',
  tags: ['finishing', 'grill station'],
  allergens: ['dairy'],
  yield: '2 lbs',
  shelfLife: '10 days',
  ingredientGroups: [
    {
      label: 'Ingredients',
      items: [
        { qty: '2', unit: 'lbs', name: 'Unsalted butter, room temp', allergens: ['dairy'] },
        { qty: '3', unit: 'tbsp', name: 'Flat-leaf parsley, fine chop' },
        { qty: '2', unit: 'tbsp', name: 'Fresh chives, minced' },
        { qty: '1', unit: 'tbsp', name: 'Fresh thyme leaves' },
        { qty: '2', unit: 'tsp', name: 'Roasted garlic paste' },
        { qty: '1', unit: 'tsp', name: 'Flaky sea salt' },
        { qty: '1/2', unit: 'tsp', name: 'Black pepper, freshly cracked' },
        { qty: '1', unit: 'tsp', name: 'Lemon zest' },
      ],
    },
  ],
  procedureGroups: [
    {
      label: 'Mixing',
      image: 'https://picsum.photos/seed/butter-mix/200/150',
      steps: [
        { text: 'Butter must be room temp — soft but not melted.', critical: true },
        { text: 'Combine all herbs, garlic paste, salt, pepper, lemon zest in a bowl.' },
        { text: 'Fold herb mixture into butter with rubber spatula until evenly distributed.' },
      ],
    },
    {
      label: 'Forming & Storage',
      image: 'https://picsum.photos/seed/butter-roll/200/150',
      steps: [
        { text: 'Spoon butter onto plastic wrap in a rough log shape.' },
        { text: 'Roll tightly into ~2" diameter cylinder. Twist ends to seal.' },
        { text: 'Refrigerate until firm (2+ hrs). Slice into 1/2 oz medallions for service.' },
        { text: 'Label with date. Store wrapped logs in walk-in.' },
      ],
    },
  ],
  batchScaling: 'Doubles easily. Use stand mixer with paddle for batches over 4 lbs.',
};

const creamedSpinach: PrepRecipe = {
  id: 'prep-4',
  slug: 'creamed-spinach',
  type: 'prep',
  name: 'Creamed Spinach',
  image: 'https://picsum.photos/seed/creamed-spinach/400/300',
  category: 'base',
  tags: ['classic', 'side station'],
  allergens: ['dairy'],
  yield: '8 portions',
  shelfLife: '3 days',
  ingredientGroups: [
    {
      label: 'Spinach',
      items: [
        { qty: '2', unit: 'lbs', name: 'Baby spinach, washed' },
        { qty: '1', unit: 'tbsp', name: 'Olive oil' },
        { qty: '3', unit: 'cloves', name: 'Garlic, sliced thin' },
      ],
    },
    {
      label: 'Cream Base',
      items: [
        { qty: '2', unit: 'tbsp', name: 'Unsalted butter', allergens: ['dairy'] },
        { qty: '2', unit: 'tbsp', name: 'All-purpose flour', allergens: ['gluten'] },
        { qty: '1.5', unit: 'cups', name: 'Heavy cream', allergens: ['dairy'] },
        { qty: '1/4', unit: 'cup', name: 'Parmesan, finely grated', allergens: ['dairy'] },
        { qty: '1/4', unit: 'tsp', name: 'Nutmeg, freshly grated' },
        { qty: '', unit: '', name: 'Kosher salt & white pepper to taste' },
      ],
    },
  ],
  procedureGroups: [
    {
      label: 'Wilt Spinach',
      image: 'https://picsum.photos/seed/wilt-spinach/200/150',
      steps: [
        { text: 'Heat olive oil in large sauté pan over high heat.' },
        { text: 'Add garlic, cook 30 sec until fragrant — do not brown.' },
        { text: 'Add spinach in batches, toss until just wilted. Transfer to colander.' },
        { text: 'Press out excess liquid thoroughly. Rough chop and set aside.', critical: true },
      ],
    },
    {
      label: 'Cream Sauce & Combine',
      image: 'https://picsum.photos/seed/cream-sauce/200/150',
      steps: [
        { text: 'Melt butter in saucepan over medium heat. Add flour, whisk 1 min (blonde roux).' },
        { text: 'Slowly stream in cream while whisking. Cook until thickened (3-4 min).' },
        { text: 'Stir in Parmesan and nutmeg. Season with salt and white pepper.' },
        { text: 'Fold in chopped spinach. Should coat leaves without being soupy.' },
        { text: 'Hold at 140\u00B0F+ for service or cool rapidly for storage.', critical: true },
      ],
    },
  ],
  trainingNotes: 'Press ALL water from spinach — #1 cause of watery creamed spinach. Roux should be thick enough to coat the leaves.',
};

// --- Mock Data: 3 Plate Specs ---

const boneInRibeye: PlateSpec = {
  id: 'plate-1',
  slug: 'bone-in-ribeye',
  type: 'plate',
  name: '16oz Bone-In Ribeye',
  image: 'https://picsum.photos/seed/ribeye-steak/400/300',
  category: 'entree',
  tags: ['signature', 'grill', 'premium'],
  allergens: ['dairy'],
  componentGroups: [
    {
      label: 'Grill',
      items: [
        { qty: '16', unit: 'oz', name: 'Bone-in ribeye, 1.5" thick' },
        { qty: '1', unit: 'pc', name: 'Herb Compound Butter', prepRecipeRef: 'herb-compound-butter' },
      ],
    },
    {
      label: 'Plate',
      items: [
        { qty: '3', unit: 'oz', name: 'Red Wine Demi-Glace', prepRecipeRef: 'red-wine-demi-glace' },
        { qty: '1', unit: 'ptn', name: 'Creamed Spinach', prepRecipeRef: 'creamed-spinach' },
        { qty: '5', unit: 'oz', name: 'Fingerling potatoes, roasted' },
        { qty: '1', unit: 'sprig', name: 'Fresh rosemary garnish' },
      ],
    },
  ],
  assemblyGroups: [
    {
      label: 'Grill',
      image: 'https://picsum.photos/seed/grill-steak/200/150',
      steps: [
        { text: 'Temper steak 30-45 min before grilling. Season generously with salt and pepper.' },
        { text: 'Grill over high heat: sear 4-5 min per side for medium-rare (130\u00B0F).', critical: true },
        { text: 'Rest 5-7 min on cutting board, loosely tented with foil.' },
      ],
    },
    {
      label: 'Plate',
      image: 'https://picsum.photos/seed/plate-steak/200/150',
      steps: [
        { text: 'Creamed spinach mound at 10 o\'clock on warm plate.' },
        { text: 'Fan fingerling potatoes at 2 o\'clock.' },
        { text: 'Ribeye center-front, bone pointing away from guest.' },
        { text: 'Herb butter medallion on top of steak (begin melting).' },
        { text: 'Drizzle demi-glace around the plate (not over steak).' },
        { text: 'Rosemary sprig leaning on the bone.' },
      ],
    },
  ],
  platingNotes: 'Bone always points AWAY from guest (12 o\'clock). Butter on immediately before running — timing is critical for visual melt.',
};

const skirtSteakChimichurri: PlateSpec = {
  id: 'plate-2',
  slug: 'skirt-steak-chimichurri',
  type: 'plate',
  name: 'Grilled Skirt Steak w/ Chimichurri',
  image: 'https://picsum.photos/seed/skirt-steak/400/300',
  category: 'entree',
  tags: ['Argentine', 'grill', 'shareable'],
  allergens: [],
  componentGroups: [
    {
      label: 'Grill',
      items: [
        { qty: '12', unit: 'oz', name: 'Outside skirt steak, trimmed' },
      ],
    },
    {
      label: 'Plate',
      items: [
        { qty: '3', unit: 'oz', name: 'Chimichurri', prepRecipeRef: 'chimichurri' },
        { qty: '6', unit: 'oz', name: 'Grilled broccolini' },
        { qty: '4', unit: 'oz', name: 'Crispy smashed potatoes' },
        { qty: '1', unit: 'pc', name: 'Lemon wedge' },
      ],
    },
  ],
  assemblyGroups: [
    {
      label: 'Grill',
      image: 'https://picsum.photos/seed/grill-skirt/200/150',
      steps: [
        { text: 'Season steak with salt, pepper, light coat of olive oil.' },
        { text: 'Very high heat: 3-4 min per side for medium-rare. Do NOT overcook — tough past medium.', critical: true },
        { text: 'Rest 3-4 min. Slice against the grain in 1/2" strips on a bias.' },
      ],
    },
    {
      label: 'Plate',
      image: 'https://picsum.photos/seed/plate-skirt/200/150',
      steps: [
        { text: 'Fan sliced steak across center of warm oval plate.' },
        { text: 'Spoon chimichurri generously over sliced steak.' },
        { text: 'Grilled broccolini alongside. Smashed potatoes at the end.' },
        { text: 'Lemon wedge on the side.' },
      ],
    },
  ],
  platingNotes: 'Slice AGAINST the grain — most critical step for tenderness. Grain runs the short way across the steak.',
};

const steakhouseWedgeSalad: PlateSpec = {
  id: 'plate-3',
  slug: 'steakhouse-wedge-salad',
  type: 'plate',
  name: 'Steakhouse Wedge Salad',
  image: 'https://picsum.photos/seed/wedge-salad/400/300',
  category: 'appetizer',
  tags: ['classic', 'cold station'],
  allergens: ['dairy', 'eggs'],
  componentGroups: [
    {
      label: 'Plating',
      items: [
        { qty: '1', unit: 'pc', name: 'Iceberg lettuce wedge (1/4 head)' },
        { qty: '3', unit: 'oz', name: 'House blue cheese dressing' },
        { qty: '3', unit: 'strips', name: 'Applewood smoked bacon, crispy' },
        { qty: '6', unit: 'pc', name: 'Cherry tomatoes, halved' },
        { qty: '2', unit: 'tbsp', name: 'Red onion, shaved thin' },
        { qty: '1', unit: 'tbsp', name: 'Blue cheese crumbles' },
        { qty: '1', unit: 'pinch', name: 'Chives, snipped' },
        { qty: '', unit: '', name: 'Freshly cracked black pepper' },
      ],
    },
  ],
  assemblyGroups: [
    {
      label: 'Plating',
      image: 'https://picsum.photos/seed/wedge-plate/200/150',
      steps: [
        { text: 'Iceberg wedge on chilled plate, cut-side up.' },
        { text: 'Ladle blue cheese dressing generously over the top.' },
        { text: 'Bacon strips criss-crossed over the wedge.' },
        { text: 'Scatter tomato halves and shaved red onion around plate.' },
        { text: 'Sprinkle blue cheese crumbles and chives on top.' },
        { text: 'Finish with freshly cracked black pepper.' },
      ],
    },
  ],
  platingNotes: 'Plate MUST be chilled. Wedge should stand upright. Wilted or browning lettuce = replace it.',
};

// --- Exports ---

export const PREP_RECIPES: PrepRecipe[] = [
  redWineDemiGlace,
  chimichurri,
  herbCompoundButter,
  creamedSpinach,
];

export const PLATE_SPECS: PlateSpec[] = [
  boneInRibeye,
  skirtSteakChimichurri,
  steakhouseWedgeSalad,
];

export const ALL_RECIPES: Recipe[] = [...PREP_RECIPES, ...PLATE_SPECS];

export function getRecipeBySlug(slug: string): Recipe | undefined {
  return ALL_RECIPES.find(r => r.slug === slug);
}

// --- AI action types and config ---

export type RecipeAIAction = 'teachMe' | 'quizMe' | 'questions';

export const RECIPE_AI_ACTIONS: { key: RecipeAIAction; label: string; icon: string }[] = [
  { key: 'teachMe', label: 'Teach Me', icon: 'graduation-cap' },
  { key: 'quizMe', label: 'Quiz Me', icon: 'clipboard-list' },
  { key: 'questions', label: 'Ask a question', icon: 'help-circle' },
];
