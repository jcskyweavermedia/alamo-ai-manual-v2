// =============================================================================
// Data Ingestion Types
// =============================================================================

import type {
  RecipeIngredientGroup,
  RecipeProcedureGroup,
  RecipeImage,
  BatchScaling,
  TrainingNotes,
  WineStyle,
  WineBody,
  CocktailStyle,
  CocktailProcedureStep,
  PlateComponentGroup,
} from './products';

// =============================================================================
// ENUMS
// =============================================================================

export type ProductType =
  | 'prep_recipe'
  | 'plate_spec'
  | 'foh_plate_spec'
  | 'wine'
  | 'cocktail'
  | 'beer_liquor';

export type IngestionMethod = 'chat' | 'file_upload' | 'image_upload' | 'edit';

export type MobileMode = 'chat' | 'preview' | 'edit';

// =============================================================================
// PRODUCT TYPE METADATA
// =============================================================================

export interface ProductTypeMeta {
  key: ProductType;
  label: string;
  enabled: boolean;
}

export const PRODUCT_TYPES: ProductTypeMeta[] = [
  { key: 'prep_recipe', label: 'Prep Recipe', enabled: true },
  { key: 'plate_spec', label: 'Plate Spec', enabled: true },
  { key: 'foh_plate_spec', label: 'Dish Guide', enabled: false },
  { key: 'wine', label: 'Wine', enabled: true },
  { key: 'cocktail', label: 'Cocktail', enabled: true },
  { key: 'beer_liquor', label: 'Beer/Liquor', enabled: false },
];

// =============================================================================
// CHAT MESSAGES
// =============================================================================

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** When role='assistant', may include a draft preview */
  draftPreview?: PrepRecipeDraft | WineDraft | CocktailDraft | PlateSpecDraft | null;
  createdAt: string;
}

// =============================================================================
// PREP RECIPE DRAFT (matches DB schema)
// =============================================================================

export interface PrepRecipeDraft {
  name: string;
  slug: string;
  prepType: string;
  tags: string[];
  yieldQty: number;
  yieldUnit: string;
  shelfLifeValue: number;
  shelfLifeUnit: string;
  ingredients: RecipeIngredientGroup[];
  procedure: RecipeProcedureGroup[];
  batchScaling: BatchScaling | Record<string, never>;
  trainingNotes: TrainingNotes | Record<string, never>;
  images: RecipeImage[];
}

// =============================================================================
// WINE DRAFT (matches DB schema)
// =============================================================================

export interface WineDraft {
  name: string;
  slug: string;
  producer: string;
  region: string;
  country: string;
  vintage: string | null;  // null for NV wines
  varietal: string;
  blend: boolean;
  style: WineStyle;
  body: WineBody;
  tastingNotes: string;
  producerNotes: string;
  notes: string;           // service/pairing notes
  image: string | null;
  isTopSeller: boolean;
}

// =============================================================================
// COCKTAIL DRAFT (matches DB schema)
// =============================================================================

export interface CocktailDraft {
  name: string;
  slug: string;
  style: CocktailStyle;
  glass: string;
  ingredients: string;
  keyIngredients: string;
  procedure: CocktailProcedureStep[];
  tastingNotes: string;
  description: string;
  notes: string;
  image: string | null;
  isTopSeller: boolean;
}

// =============================================================================
// FOH PLATE SPEC (DISH GUIDE) DRAFT
// =============================================================================

export interface FohPlateSpecDraft {
  menuName: string;
  slug: string;
  plateType: string;
  plateSpecId: string | null;     // FK, set at publish time
  shortDescription: string;
  detailedDescription: string;
  ingredients: string[];
  keyIngredients: string[];
  flavorProfile: string[];
  allergens: string[];
  allergyNotes: string;
  upsellNotes: string;
  notes: string;
  image: string | null;
  isTopSeller: boolean;
}

// =============================================================================
// PLATE SPEC DRAFT (with nested dish guide)
// =============================================================================

export interface PlateSpecDraft {
  name: string;
  slug: string;
  plateType: string;                          // entree, appetizer, side, dessert
  menuCategory: string;                       // steaks, seafood, salads, etc.
  tags: string[];
  allergens: string[];
  components: PlateComponentGroup[];          // from products.ts
  assemblyProcedure: RecipeProcedureGroup[];  // from products.ts
  notes: string;
  images: RecipeImage[];
  dishGuide: FohPlateSpecDraft | null;        // nested dish guide -- NOT a separate state field
  dishGuideStale: boolean;                    // true when plate spec changed after dish guide generation
}

// =============================================================================
// TYPE GUARDS
// =============================================================================

/** Type guard: is the draft a PlateSpecDraft? */
export function isPlateSpecDraft(d: unknown): d is PlateSpecDraft {
  return d !== null && typeof d === 'object'
    && 'components' in d && 'assemblyProcedure' in d && 'menuCategory' in d;
}

/** Type guard: is the draft a FohPlateSpecDraft? */
export function isFohPlateSpecDraft(d: unknown): d is FohPlateSpecDraft {
  return d !== null && typeof d === 'object'
    && 'menuName' in d && 'shortDescription' in d && 'plateSpecId' in d;
}

/** Type guard: is the draft a WineDraft? */
export function isWineDraft(draft: PrepRecipeDraft | WineDraft | CocktailDraft | PlateSpecDraft): draft is WineDraft {
  return 'producer' in draft && 'varietal' in draft;
}

/** Type guard: is the draft a PrepRecipeDraft? */
export function isPrepRecipeDraft(draft: PrepRecipeDraft | WineDraft | CocktailDraft | PlateSpecDraft): draft is PrepRecipeDraft {
  return 'ingredients' in draft && 'procedure' in draft && 'prepType' in draft;
}

/** Type guard: is the draft a CocktailDraft? */
export function isCocktailDraft(draft: PrepRecipeDraft | WineDraft | CocktailDraft | PlateSpecDraft): draft is CocktailDraft {
  return 'glass' in draft && 'keyIngredients' in draft;
}

// =============================================================================
// DRAFT STATE
// =============================================================================

export interface DraftState {
  productType: ProductType;
  draft: PrepRecipeDraft | WineDraft | CocktailDraft | PlateSpecDraft | null;
  messages: ChatMessage[];
  mobileMode: MobileMode;
  isDirty: boolean;
}

// =============================================================================
// ATTACHMENT QUEUE
// =============================================================================

export interface QueuedAttachment {
  id: string;
  file: File;
  preview: string | null;
  type: 'image' | 'document';
}

// =============================================================================
// HELPERS
// =============================================================================

export function createEmptyFohPlateSpecDraft(): FohPlateSpecDraft {
  return {
    menuName: '', slug: '', plateType: '', plateSpecId: null,
    shortDescription: '', detailedDescription: '',
    ingredients: [], keyIngredients: [], flavorProfile: [],
    allergens: [], allergyNotes: '', upsellNotes: '',
    notes: '', image: null, isTopSeller: false,
  };
}

export function createEmptyPlateSpecDraft(): PlateSpecDraft {
  return {
    name: '', slug: '', plateType: '', menuCategory: '',
    tags: [], allergens: [],
    components: [], assemblyProcedure: [],
    notes: '', images: [],
    dishGuide: null,   // no dish guide until generated
    dishGuideStale: false,
  };
}

export function createEmptyPrepRecipeDraft(): PrepRecipeDraft {
  return {
    name: '',
    slug: '',
    prepType: 'sauce',
    tags: [],
    yieldQty: 0,
    yieldUnit: 'qt',
    shelfLifeValue: 0,
    shelfLifeUnit: 'days',
    ingredients: [],
    procedure: [],
    batchScaling: {},
    trainingNotes: {},
    images: [],
  };
}

export function createEmptyWineDraft(): WineDraft {
  return {
    name: '',
    slug: '',
    producer: '',
    region: '',
    country: '',
    vintage: null,
    varietal: '',
    blend: false,
    style: 'red',
    body: 'medium',
    tastingNotes: '',
    producerNotes: '',
    notes: '',
    image: null,
    isTopSeller: false,
  };
}

export function createEmptyCocktailDraft(): CocktailDraft {
  return {
    name: '',
    slug: '',
    style: 'classic',
    glass: '',
    ingredients: '',
    keyIngredients: '',
    procedure: [],
    tastingNotes: '',
    description: '',
    notes: '',
    image: null,
    isTopSeller: false,
  };
}

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
