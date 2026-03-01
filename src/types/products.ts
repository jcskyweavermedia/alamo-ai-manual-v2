// =============================================================================
// Product Types — Frontend interfaces matching DB schema (camelCase)
// Phase 6: Wire Viewers to Database
// =============================================================================

// =============================================================================
// DISHES (foh_plate_specs)
// =============================================================================

export type DishCategory = 'appetizer' | 'entree' | 'side' | 'dessert';

export type ProductSortMode = 'name' | 'recent' | 'featured';
export type AllergenType = 'dairy' | 'gluten' | 'eggs' | 'shellfish' | 'fish' | 'tree-nuts' | 'soy' | 'peanuts';

export interface Dish {
  id: string;
  slug: string;
  menuName: string;             // DB: menu_name (was mock: name)
  plateType: DishCategory;      // DB: plate_type (was mock: category)
  shortDescription: string;
  detailedDescription: string;
  ingredients: string[];         // DB: text[]
  keyIngredients: string[];      // DB: text[]
  flavorProfile: string[];       // DB: text[]
  allergens: AllergenType[];     // DB: text[]
  allergyNotes: string;          // DB: allergy_notes
  upsellNotes: string;           // DB: upsell_notes
  notes: string;
  image: string | null;
  isTopSeller: boolean;          // DB: is_top_seller (was mock: topSeller)
  isFeatured: boolean;           // DB: is_featured
  plateSpecId: string | null;    // DB: plate_spec_id (links to plate_specs)
  createdAt: string;             // DB: created_at
}

// =============================================================================
// WINES
// =============================================================================

export type WineStyle = 'red' | 'white' | 'rosé' | 'sparkling';
export type WineBody = 'light' | 'medium' | 'full';

export interface Wine {
  id: string;
  slug: string;
  name: string;
  producer: string;
  region: string;
  country: string;
  vintage: string | null;
  varietal: string;              // DB: varietal (was mock: grape)
  blend: boolean;                // DB: blend (was mock: isBlend)
  style: WineStyle;
  body: WineBody;
  tastingNotes: string;          // DB: tasting_notes
  producerNotes: string;         // DB: producer_notes (was mock: producerStory)
  notes: string;
  image: string | null;
  isTopSeller: boolean;          // DB: is_top_seller (was mock: topSeller)
  isFeatured: boolean;           // DB: is_featured
  createdAt: string;             // DB: created_at
}

// =============================================================================
// COCKTAILS
// =============================================================================

export type CocktailStyle = 'classic' | 'modern' | 'tiki' | 'refresher';

export interface CocktailProcedureStep {
  step: number;
  instruction: string;
}

export interface Cocktail {
  id: string;
  slug: string;
  name: string;
  style: CocktailStyle;
  glass: string;
  ingredients: RecipeIngredientGroup[];  // DB: jsonb (same structure as prep recipes)
  keyIngredients: string;        // DB: text (plain string)
  procedure: CocktailProcedureStep[];  // DB: jsonb [{step, instruction}]
  tastingNotes: string;          // DB: tasting_notes
  description: string;
  notes: string;
  image: string | null;
  isTopSeller: boolean;          // DB: is_top_seller (was mock: topSeller)
  isFeatured: boolean;           // DB: is_featured
  createdAt: string;             // DB: created_at
}

// =============================================================================
// RECIPES (prep_recipes + plate_specs — unified)
// =============================================================================

// --- Shared sub-types (match DB JSONB contracts exactly) ---

export interface RecipeIngredient {
  name: string;
  quantity: number;
  unit: string;
  prep_note?: string | null;
  allergens?: string[];
  prep_recipe_ref?: string;
  /** Client-only stable key for React list rendering; not persisted to DB */
  _key?: string;
}

export interface RecipeIngredientGroup {
  group_name: string;
  order: number;
  items: RecipeIngredient[];
  /** Client-only stable key for React list rendering; not persisted to DB */
  _key?: string;
}

export interface RecipeProcedureStep {
  step_number: number;
  instruction: string;
  critical?: boolean;
}

export interface RecipeProcedureGroup {
  group_name: string;
  order: number;
  steps: RecipeProcedureStep[];
}

export interface RecipeImage {
  url: string;
  alt?: string;
  caption?: string;
}

export interface BatchScaling {
  scalable: boolean;
  scaling_method: string;
  base_yield: { quantity: number; unit: string };
  notes: string;
  exceptions: string[];
}

export interface TrainingNotes {
  notes: string;
  common_mistakes: string[];
  quality_checks: string[];
}

// --- Prep Recipe ---

export interface PrepRecipe {
  id: string;
  slug: string;
  type: 'prep';                  // Discriminator
  name: string;
  department: 'kitchen' | 'bar'; // DB: department
  prepType: string;              // DB: prep_type
  tags: string[];
  yieldQty: number;              // DB: yield_qty NUMERIC
  yieldUnit: string;             // DB: yield_unit
  shelfLifeValue: number;        // DB: shelf_life_value INT
  shelfLifeUnit: string;         // DB: shelf_life_unit
  ingredients: RecipeIngredientGroup[];  // DB: jsonb
  procedure: RecipeProcedureGroup[];     // DB: jsonb
  batchScaling: BatchScaling | Record<string, never>;  // DB: jsonb (may be empty {})
  trainingNotes: TrainingNotes | Record<string, never>; // DB: jsonb (may be empty {})
  isFeatured: boolean;           // DB: is_featured
  images: RecipeImage[];         // DB: jsonb[]
  createdAt: string;             // DB: created_at
}

// --- Plate Spec ---

export interface PlateComponent {
  name: string;
  type: string;
  quantity: number;
  unit: string;
  order: number;
  prep_recipe_ref?: string;
  allergens?: string[];
}

export interface PlateComponentGroup {
  group_name: string;
  order: number;
  items: PlateComponent[];
}

export interface PlateSpec {
  id: string;
  slug: string;
  type: 'plate';                 // Discriminator
  name: string;
  plateType: string;             // DB: plate_type
  menuCategory: string;          // DB: menu_category
  tags: string[];
  allergens: string[];           // DB: text[]
  components: PlateComponentGroup[];     // DB: jsonb
  assemblyProcedure: RecipeProcedureGroup[];  // DB: assembly_procedure jsonb
  notes: string;
  isFeatured: boolean;           // DB: is_featured
  images: RecipeImage[];         // DB: jsonb[]
  createdAt: string;             // DB: created_at
}

export type Recipe = PrepRecipe | PlateSpec;

// =============================================================================
// BEER & LIQUOR
// =============================================================================

export type BeerLiquorCategory = 'Beer' | 'Liquor';

export interface BeerLiquorItem {
  id: string;
  slug: string;
  name: string;
  category: BeerLiquorCategory;
  subcategory: string;
  producer: string;
  country: string;
  description: string;
  style: string;
  notes: string;
  image: string | null;
  isFeatured: boolean;           // DB: is_featured
  createdAt: string;             // DB: created_at
}
