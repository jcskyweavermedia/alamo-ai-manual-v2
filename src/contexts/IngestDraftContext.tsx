import { createContext, useContext, useReducer, useCallback, type Dispatch, type ReactNode } from 'react';
import type { PrepRecipeDraft, WineDraft, CocktailDraft, PlateSpecDraft, FohPlateSpecDraft, ChatMessage, MobileMode, ProductType } from '@/types/ingestion';
import { createEmptyPrepRecipeDraft, createEmptyWineDraft, createEmptyCocktailDraft, createEmptyPlateSpecDraft, generateSlug, isPrepRecipeDraft, isCocktailDraft, isPlateSpecDraft } from '@/types/ingestion';
import type {
  RecipeImage,
  RecipeIngredient,
  RecipeIngredientGroup,
  RecipeProcedureStep,
  RecipeProcedureGroup,
  CocktailProcedureStep,
  CocktailStyle,
  PlateComponentGroup,
} from '@/types/products';

// =============================================================================
// STATE
// =============================================================================

export interface IngestState {
  activeType: ProductType;
  mobileMode: MobileMode;
  draft: PrepRecipeDraft | WineDraft | CocktailDraft | PlateSpecDraft;
  messages: ChatMessage[];
  isDirty: boolean;
  sessionId: string | null;
  editingProductId: string | null;
  isSaving: boolean;
  draftVersion: number;
}

const initialState: IngestState = {
  activeType: 'prep_recipe',
  mobileMode: 'chat',
  draft: createEmptyPrepRecipeDraft(),
  messages: [],
  isDirty: false,
  sessionId: null,
  editingProductId: null,
  isSaving: false,
  draftVersion: 1,
};

// =============================================================================
// ACTIONS
// =============================================================================

export type IngestAction =
  | { type: 'SET_ACTIVE_TYPE'; payload: ProductType }
  | { type: 'SET_MOBILE_MODE'; payload: MobileMode }
  | { type: 'ADD_MESSAGE'; payload: ChatMessage }
  | { type: 'SET_MESSAGES'; payload: ChatMessage[] }
  | { type: 'SET_DRAFT'; payload: PrepRecipeDraft | WineDraft | CocktailDraft | PlateSpecDraft }
  | { type: 'RESET_DRAFT' }
  | { type: 'SET_DIRTY'; payload: boolean }
  // Metadata (shared)
  | { type: 'SET_NAME'; payload: string }
  // Plate spec metadata
  | { type: 'SET_PLATE_TYPE'; payload: string }
  | { type: 'SET_MENU_CATEGORY'; payload: string }
  | { type: 'SET_PLATE_ALLERGENS'; payload: string[] }
  | { type: 'SET_PLATE_TAGS'; payload: string[] }
  | { type: 'SET_PLATE_NOTES'; payload: string }
  // Component groups (plate spec — dedicated actions)
  | { type: 'ADD_COMPONENT_GROUP'; payload: PlateComponentGroup }
  | { type: 'UPDATE_COMPONENT_GROUP'; payload: { index: number; group: PlateComponentGroup } }
  | { type: 'REMOVE_COMPONENT_GROUP'; payload: number }
  | { type: 'REORDER_COMPONENT_GROUPS'; payload: PlateComponentGroup[] }
  // Assembly procedure (plate spec — dedicated actions, NOT reused from prep recipe)
  | { type: 'ADD_ASSEMBLY_GROUP'; payload: RecipeProcedureGroup }
  | { type: 'UPDATE_ASSEMBLY_GROUP'; payload: { index: number; group: RecipeProcedureGroup } }
  | { type: 'REMOVE_ASSEMBLY_GROUP'; payload: number }
  | { type: 'REORDER_ASSEMBLY_GROUPS'; payload: RecipeProcedureGroup[] }
  // Dish guide (nested inside PlateSpecDraft)
  | { type: 'SET_DISH_GUIDE'; payload: FohPlateSpecDraft }
  | { type: 'UPDATE_DISH_GUIDE_FIELD'; payload: { field: keyof FohPlateSpecDraft; value: FohPlateSpecDraft[keyof FohPlateSpecDraft] } }
  | { type: 'CLEAR_DISH_GUIDE' }
  // Prep recipe metadata
  | { type: 'SET_PREP_TYPE'; payload: string }
  | { type: 'SET_TAGS'; payload: string[] }
  | { type: 'SET_YIELD'; payload: { qty: number; unit: string } }
  | { type: 'SET_SHELF_LIFE'; payload: { value: number; unit: string } }
  // Ingredient groups
  | { type: 'ADD_INGREDIENT_GROUP'; payload?: string }
  | { type: 'REMOVE_INGREDIENT_GROUP'; payload: number }
  | { type: 'RENAME_INGREDIENT_GROUP'; payload: { index: number; name: string } }
  | { type: 'MOVE_GROUP_UP'; payload: number }
  | { type: 'MOVE_GROUP_DOWN'; payload: number }
  // Individual ingredients
  | { type: 'ADD_INGREDIENT'; payload: { groupIndex: number } }
  | { type: 'UPDATE_INGREDIENT'; payload: { groupIndex: number; itemIndex: number; item: RecipeIngredient } }
  | { type: 'REMOVE_INGREDIENT'; payload: { groupIndex: number; itemIndex: number } }
  | { type: 'MOVE_INGREDIENT_UP'; payload: { groupIndex: number; itemIndex: number } }
  | { type: 'MOVE_INGREDIENT_DOWN'; payload: { groupIndex: number; itemIndex: number } }
  // Procedure groups
  | { type: 'ADD_PROCEDURE_GROUP'; payload?: string }
  | { type: 'REMOVE_PROCEDURE_GROUP'; payload: number }
  | { type: 'RENAME_PROCEDURE_GROUP'; payload: { index: number; name: string } }
  | { type: 'MOVE_PROCEDURE_GROUP_UP'; payload: number }
  | { type: 'MOVE_PROCEDURE_GROUP_DOWN'; payload: number }
  // Individual steps
  | { type: 'ADD_STEP'; payload: { groupIndex: number } }
  | { type: 'UPDATE_STEP'; payload: { groupIndex: number; stepIndex: number; step: RecipeProcedureStep } }
  | { type: 'REMOVE_STEP'; payload: { groupIndex: number; stepIndex: number } }
  | { type: 'MOVE_STEP_UP'; payload: { groupIndex: number; stepIndex: number } }
  | { type: 'MOVE_STEP_DOWN'; payload: { groupIndex: number; stepIndex: number } }
  // Batch & training
  | { type: 'SET_BATCH_NOTES'; payload: string }
  | { type: 'SET_TRAINING_NOTES'; payload: string }
  | { type: 'SET_COMMON_MISTAKES'; payload: string[] }
  | { type: 'SET_QUALITY_CHECKS'; payload: string[] }
  // Images (prep recipe)
  | { type: 'ADD_IMAGE'; payload: RecipeImage }
  | { type: 'REMOVE_IMAGE'; payload: number }
  | { type: 'REORDER_IMAGES'; payload: RecipeImage[] }
  | { type: 'SET_THUMBNAIL'; payload: number }
  // Wine metadata
  | { type: 'SET_WINE_PRODUCER'; payload: string }
  | { type: 'SET_WINE_REGION'; payload: string }
  | { type: 'SET_WINE_COUNTRY'; payload: string }
  | { type: 'SET_WINE_VINTAGE'; payload: string | null }
  | { type: 'SET_WINE_VARIETAL'; payload: string }
  | { type: 'SET_WINE_BLEND'; payload: boolean }
  | { type: 'SET_WINE_STYLE'; payload: string }
  | { type: 'SET_WINE_BODY'; payload: string }
  | { type: 'SET_WINE_TASTING_NOTES'; payload: string }
  | { type: 'SET_WINE_PRODUCER_NOTES'; payload: string }
  | { type: 'SET_WINE_NOTES'; payload: string }
  | { type: 'SET_WINE_IMAGE'; payload: string | null }
  | { type: 'SET_WINE_TOP_SELLER'; payload: boolean }
  // Cocktail metadata
  | { type: 'SET_COCKTAIL_STYLE'; payload: CocktailStyle }
  | { type: 'SET_COCKTAIL_GLASS'; payload: string }
  | { type: 'SET_COCKTAIL_INGREDIENTS'; payload: string }
  | { type: 'SET_COCKTAIL_KEY_INGREDIENTS'; payload: string }
  | { type: 'SET_COCKTAIL_PROCEDURE'; payload: CocktailProcedureStep[] }
  | { type: 'SET_COCKTAIL_TASTING_NOTES'; payload: string }
  | { type: 'SET_COCKTAIL_DESCRIPTION'; payload: string }
  | { type: 'SET_COCKTAIL_NOTES'; payload: string }
  | { type: 'SET_COCKTAIL_IMAGE'; payload: string | null }
  | { type: 'SET_COCKTAIL_TOP_SELLER'; payload: boolean }
  // Session
  | { type: 'SET_SESSION_ID'; payload: string }
  | { type: 'SET_EDITING_PRODUCT_ID'; payload: string | null }
  | { type: 'SET_IS_SAVING'; payload: boolean }
  | { type: 'SET_DRAFT_VERSION'; payload: number };

// =============================================================================
// HELPERS
// =============================================================================

function swapArray<T>(arr: T[], i: number, j: number): T[] {
  if (i < 0 || j < 0 || i >= arr.length || j >= arr.length) return arr;
  const copy = [...arr];
  [copy[i], copy[j]] = [copy[j], copy[i]];
  return copy;
}

function reorderIngGroups(groups: RecipeIngredientGroup[]): RecipeIngredientGroup[] {
  return groups.map((g, i) => ({ ...g, order: i + 1 }));
}

function reorderProcGroups(groups: RecipeProcedureGroup[]): RecipeProcedureGroup[] {
  return groups.map((g, i) => ({ ...g, order: i + 1 }));
}

function renumberSteps(steps: RecipeProcedureStep[]): RecipeProcedureStep[] {
  return steps.map((s, i) => ({ ...s, step_number: i + 1 }));
}

function updatePrepDraft(state: IngestState, draftUpdate: Partial<PrepRecipeDraft>): IngestState {
  return { ...state, draft: { ...(state.draft as PrepRecipeDraft), ...draftUpdate }, isDirty: true };
}

function updateWineDraft(state: IngestState, draftUpdate: Partial<WineDraft>): IngestState {
  return { ...state, draft: { ...(state.draft as WineDraft), ...draftUpdate }, isDirty: true };
}

function updateCocktailDraft(state: IngestState, draftUpdate: Partial<CocktailDraft>): IngestState {
  return { ...state, draft: { ...(state.draft as CocktailDraft), ...draftUpdate }, isDirty: true };
}

function updatePlateSpecDraft(
  state: IngestState,
  updater: (d: PlateSpecDraft) => Partial<PlateSpecDraft>
): IngestState {
  const d = state.draft as PlateSpecDraft;
  return { ...state, draft: { ...d, ...updater(d) }, isDirty: true };
}

// =============================================================================
// REDUCER
// =============================================================================

function ingestReducer(state: IngestState, action: IngestAction): IngestState {
  switch (action.type) {
    case 'SET_ACTIVE_TYPE':
      return { ...state, activeType: action.payload };
    case 'SET_MOBILE_MODE':
      return { ...state, mobileMode: action.payload };
    case 'ADD_MESSAGE':
      return { ...state, messages: [...state.messages, action.payload] };
    case 'SET_MESSAGES':
      return { ...state, messages: action.payload };
    case 'SET_DRAFT': {
      // Preserve user-uploaded images when AI returns empty images array.
      // AI extraction schemas use `additionalProperties: false` and never return
      // user images, so we must carry them forward from the current draft.
      let mergedPayload = action.payload;

      if (state.activeType === 'plate_spec' && isPlateSpecDraft(state.draft)) {
        const oldDraft = state.draft as PlateSpecDraft;
        const newDraft = mergedPayload as PlateSpecDraft;
        const patches: Partial<PlateSpecDraft> = {};

        // Preserve dishGuide (mark stale if BOH changed)
        if (oldDraft.dishGuide && !newDraft.dishGuide) {
          patches.dishGuide = oldDraft.dishGuide;
          patches.dishGuideStale = true;
        }

        // Preserve images if AI returned empty array but user had uploaded images
        if (oldDraft.images.length > 0 && (!newDraft.images || newDraft.images.length === 0)) {
          patches.images = oldDraft.images;
        }

        if (Object.keys(patches).length > 0) {
          mergedPayload = { ...newDraft, ...patches };
        }
      } else if (isPrepRecipeDraft(state.draft)) {
        const oldDraft = state.draft as PrepRecipeDraft;
        const newDraft = mergedPayload as PrepRecipeDraft;
        // Preserve images if AI returned empty array but user had uploaded images
        if (oldDraft.images.length > 0 && (!newDraft.images || newDraft.images.length === 0)) {
          mergedPayload = { ...newDraft, images: oldDraft.images };
        }
      }

      return { ...state, draft: mergedPayload, isDirty: true };
    }
    case 'RESET_DRAFT': {
      const emptyDraft = state.activeType === 'plate_spec'
        ? createEmptyPlateSpecDraft()
        : state.activeType === 'cocktail'
          ? createEmptyCocktailDraft()
          : state.activeType === 'wine'
            ? createEmptyWineDraft()
            : createEmptyPrepRecipeDraft();
      return { ...state, draft: emptyDraft, isDirty: false, messages: [], sessionId: null, editingProductId: null, isSaving: false, draftVersion: 1 };
    }
    case 'SET_DIRTY':
      return { ...state, isDirty: action.payload };

    // Metadata
    case 'SET_NAME': {
      const slug = generateSlug(action.payload);
      if (isPrepRecipeDraft(state.draft)) {
        return updatePrepDraft(state, { name: action.payload, slug });
      }
      if (isCocktailDraft(state.draft)) {
        return updateCocktailDraft(state, { name: action.payload, slug });
      }
      if (isPlateSpecDraft(state.draft)) {
        return updatePlateSpecDraft(state, () => ({ name: action.payload, slug }));
      }
      return updateWineDraft(state, { name: action.payload, slug });
    }
    case 'SET_PREP_TYPE':
      return updatePrepDraft(state, { prepType: action.payload });
    case 'SET_TAGS':
      return updatePrepDraft(state, { tags: action.payload });
    case 'SET_YIELD':
      return updatePrepDraft(state, { yieldQty: action.payload.qty, yieldUnit: action.payload.unit });
    case 'SET_SHELF_LIFE':
      return updatePrepDraft(state, { shelfLifeValue: action.payload.value, shelfLifeUnit: action.payload.unit });

    // === INGREDIENT GROUPS ===
    case 'ADD_INGREDIENT_GROUP': {
      const d = state.draft as PrepRecipeDraft;
      const newGroup: RecipeIngredientGroup = {
        group_name: action.payload || `Group ${d.ingredients.length + 1}`,
        order: d.ingredients.length + 1,
        items: [],
        _key: crypto.randomUUID(),
      };
      return updatePrepDraft(state, { ingredients: [...d.ingredients, newGroup] });
    }
    case 'REMOVE_INGREDIENT_GROUP': {
      const d = state.draft as PrepRecipeDraft;
      return updatePrepDraft(state, {
        ingredients: reorderIngGroups(d.ingredients.filter((_, i) => i !== action.payload)),
      });
    }
    case 'RENAME_INGREDIENT_GROUP': {
      const groups = [...(state.draft as PrepRecipeDraft).ingredients];
      groups[action.payload.index] = { ...groups[action.payload.index], group_name: action.payload.name };
      return updatePrepDraft(state, { ingredients: groups });
    }
    case 'MOVE_GROUP_UP': {
      const d = state.draft as PrepRecipeDraft;
      return updatePrepDraft(state, {
        ingredients: reorderIngGroups(swapArray(d.ingredients, action.payload, action.payload - 1)),
      });
    }
    case 'MOVE_GROUP_DOWN': {
      const d = state.draft as PrepRecipeDraft;
      return updatePrepDraft(state, {
        ingredients: reorderIngGroups(swapArray(d.ingredients, action.payload, action.payload + 1)),
      });
    }

    // === INDIVIDUAL INGREDIENTS ===
    case 'ADD_INGREDIENT': {
      const groups = [...(state.draft as PrepRecipeDraft).ingredients];
      const group = { ...groups[action.payload.groupIndex] };
      group.items = [...group.items, { name: '', quantity: 0, unit: '', allergens: [], _key: crypto.randomUUID() }];
      groups[action.payload.groupIndex] = group;
      return updatePrepDraft(state, { ingredients: groups });
    }
    case 'UPDATE_INGREDIENT': {
      const groups = [...(state.draft as PrepRecipeDraft).ingredients];
      const group = { ...groups[action.payload.groupIndex] };
      const items = [...group.items];
      items[action.payload.itemIndex] = action.payload.item;
      group.items = items;
      groups[action.payload.groupIndex] = group;
      return updatePrepDraft(state, { ingredients: groups });
    }
    case 'REMOVE_INGREDIENT': {
      const groups = [...(state.draft as PrepRecipeDraft).ingredients];
      const group = { ...groups[action.payload.groupIndex] };
      group.items = group.items.filter((_, i) => i !== action.payload.itemIndex);
      groups[action.payload.groupIndex] = group;
      return updatePrepDraft(state, { ingredients: groups });
    }
    case 'MOVE_INGREDIENT_UP': {
      const groups = [...(state.draft as PrepRecipeDraft).ingredients];
      const group = { ...groups[action.payload.groupIndex] };
      group.items = swapArray(group.items, action.payload.itemIndex, action.payload.itemIndex - 1);
      groups[action.payload.groupIndex] = group;
      return updatePrepDraft(state, { ingredients: groups });
    }
    case 'MOVE_INGREDIENT_DOWN': {
      const groups = [...(state.draft as PrepRecipeDraft).ingredients];
      const group = { ...groups[action.payload.groupIndex] };
      group.items = swapArray(group.items, action.payload.itemIndex, action.payload.itemIndex + 1);
      groups[action.payload.groupIndex] = group;
      return updatePrepDraft(state, { ingredients: groups });
    }

    // === PROCEDURE GROUPS ===
    case 'ADD_PROCEDURE_GROUP': {
      const d = state.draft as PrepRecipeDraft;
      const newGroup: RecipeProcedureGroup = {
        group_name: action.payload || `Phase ${d.procedure.length + 1}`,
        order: d.procedure.length + 1,
        steps: [],
      };
      return updatePrepDraft(state, { procedure: [...d.procedure, newGroup] });
    }
    case 'REMOVE_PROCEDURE_GROUP': {
      const d = state.draft as PrepRecipeDraft;
      return updatePrepDraft(state, {
        procedure: reorderProcGroups(d.procedure.filter((_, i) => i !== action.payload)),
      });
    }
    case 'RENAME_PROCEDURE_GROUP': {
      const groups = [...(state.draft as PrepRecipeDraft).procedure];
      groups[action.payload.index] = { ...groups[action.payload.index], group_name: action.payload.name };
      return updatePrepDraft(state, { procedure: groups });
    }
    case 'MOVE_PROCEDURE_GROUP_UP': {
      const d = state.draft as PrepRecipeDraft;
      return updatePrepDraft(state, {
        procedure: reorderProcGroups(swapArray(d.procedure, action.payload, action.payload - 1)),
      });
    }
    case 'MOVE_PROCEDURE_GROUP_DOWN': {
      const d = state.draft as PrepRecipeDraft;
      return updatePrepDraft(state, {
        procedure: reorderProcGroups(swapArray(d.procedure, action.payload, action.payload + 1)),
      });
    }

    // === INDIVIDUAL STEPS ===
    case 'ADD_STEP': {
      const groups = [...(state.draft as PrepRecipeDraft).procedure];
      const group = { ...groups[action.payload.groupIndex] };
      group.steps = [...group.steps, { step_number: group.steps.length + 1, instruction: '', critical: false }];
      groups[action.payload.groupIndex] = group;
      return updatePrepDraft(state, { procedure: groups });
    }
    case 'UPDATE_STEP': {
      const groups = [...(state.draft as PrepRecipeDraft).procedure];
      const group = { ...groups[action.payload.groupIndex] };
      const steps = [...group.steps];
      steps[action.payload.stepIndex] = action.payload.step;
      group.steps = steps;
      groups[action.payload.groupIndex] = group;
      return updatePrepDraft(state, { procedure: groups });
    }
    case 'REMOVE_STEP': {
      const groups = [...(state.draft as PrepRecipeDraft).procedure];
      const group = { ...groups[action.payload.groupIndex] };
      group.steps = renumberSteps(group.steps.filter((_, i) => i !== action.payload.stepIndex));
      groups[action.payload.groupIndex] = group;
      return updatePrepDraft(state, { procedure: groups });
    }
    case 'MOVE_STEP_UP': {
      const groups = [...(state.draft as PrepRecipeDraft).procedure];
      const group = { ...groups[action.payload.groupIndex] };
      group.steps = renumberSteps(swapArray(group.steps, action.payload.stepIndex, action.payload.stepIndex - 1));
      groups[action.payload.groupIndex] = group;
      return updatePrepDraft(state, { procedure: groups });
    }
    case 'MOVE_STEP_DOWN': {
      const groups = [...(state.draft as PrepRecipeDraft).procedure];
      const group = { ...groups[action.payload.groupIndex] };
      group.steps = renumberSteps(swapArray(group.steps, action.payload.stepIndex, action.payload.stepIndex + 1));
      groups[action.payload.groupIndex] = group;
      return updatePrepDraft(state, { procedure: groups });
    }

    // === BATCH & TRAINING ===
    case 'SET_BATCH_NOTES': {
      const d = state.draft as PrepRecipeDraft;
      return updatePrepDraft(state, {
        batchScaling: {
          scalable: true,
          scaling_method: 'linear',
          base_yield: { quantity: d.yieldQty, unit: d.yieldUnit },
          notes: action.payload,
          exceptions: [],
        },
      });
    }
    case 'SET_TRAINING_NOTES': {
      const d = state.draft as PrepRecipeDraft;
      const existing = 'notes' in d.trainingNotes
        ? d.trainingNotes
        : { notes: '', common_mistakes: [] as string[], quality_checks: [] as string[] };
      return updatePrepDraft(state, {
        trainingNotes: { ...existing, notes: action.payload },
      });
    }
    case 'SET_COMMON_MISTAKES': {
      const d = state.draft as PrepRecipeDraft;
      const existing = 'notes' in d.trainingNotes
        ? d.trainingNotes
        : { notes: '', common_mistakes: [] as string[], quality_checks: [] as string[] };
      return updatePrepDraft(state, {
        trainingNotes: { ...existing, common_mistakes: action.payload },
      });
    }
    case 'SET_QUALITY_CHECKS': {
      const d = state.draft as PrepRecipeDraft;
      const existing = 'notes' in d.trainingNotes
        ? d.trainingNotes
        : { notes: '', common_mistakes: [] as string[], quality_checks: [] as string[] };
      return updatePrepDraft(state, {
        trainingNotes: { ...existing, quality_checks: action.payload },
      });
    }

    // === IMAGES (prep recipe) ===
    case 'ADD_IMAGE': {
      const d = state.draft as PrepRecipeDraft;
      const newImages = [...d.images, action.payload];
      // Propagate first image to FOH Plate Spec thumbnail if it exists
      if (state.activeType === 'plate_spec') {
        const ps = state.draft as PlateSpecDraft;
        if (ps.dishGuide) {
          return {
            ...state,
            draft: { ...ps, images: newImages, dishGuide: { ...ps.dishGuide, image: newImages[0].url } },
            isDirty: true,
          };
        }
      }
      return updatePrepDraft(state, { images: newImages });
    }
    case 'REMOVE_IMAGE': {
      const d = state.draft as PrepRecipeDraft;
      return updatePrepDraft(state, { images: d.images.filter((_, i) => i !== action.payload) });
    }
    case 'REORDER_IMAGES':
      return updatePrepDraft(state, { images: action.payload });
    case 'SET_THUMBNAIL': {
      const d = state.draft as PrepRecipeDraft;
      if (action.payload < 0 || action.payload >= d.images.length) return state;
      const imgs = [...d.images];
      const [selected] = imgs.splice(action.payload, 1);
      return updatePrepDraft(state, { images: [selected, ...imgs] });
    }

    // === WINE METADATA ===
    case 'SET_WINE_PRODUCER':
      return updateWineDraft(state, { producer: action.payload });
    case 'SET_WINE_REGION':
      return updateWineDraft(state, { region: action.payload });
    case 'SET_WINE_COUNTRY':
      return updateWineDraft(state, { country: action.payload });
    case 'SET_WINE_VINTAGE':
      return updateWineDraft(state, { vintage: action.payload });
    case 'SET_WINE_VARIETAL':
      return updateWineDraft(state, { varietal: action.payload });
    case 'SET_WINE_BLEND':
      return updateWineDraft(state, { blend: action.payload });
    case 'SET_WINE_STYLE':
      return updateWineDraft(state, { style: action.payload as WineDraft['style'] });
    case 'SET_WINE_BODY':
      return updateWineDraft(state, { body: action.payload as WineDraft['body'] });
    case 'SET_WINE_TASTING_NOTES':
      return updateWineDraft(state, { tastingNotes: action.payload });
    case 'SET_WINE_PRODUCER_NOTES':
      return updateWineDraft(state, { producerNotes: action.payload });
    case 'SET_WINE_NOTES':
      return updateWineDraft(state, { notes: action.payload });
    case 'SET_WINE_IMAGE':
      return updateWineDraft(state, { image: action.payload });
    case 'SET_WINE_TOP_SELLER':
      return updateWineDraft(state, { isTopSeller: action.payload });

    // === COCKTAIL METADATA ===
    case 'SET_COCKTAIL_STYLE':
      return updateCocktailDraft(state, { style: action.payload });
    case 'SET_COCKTAIL_GLASS':
      return updateCocktailDraft(state, { glass: action.payload });
    case 'SET_COCKTAIL_INGREDIENTS':
      return updateCocktailDraft(state, { ingredients: action.payload });
    case 'SET_COCKTAIL_KEY_INGREDIENTS':
      return updateCocktailDraft(state, { keyIngredients: action.payload });
    case 'SET_COCKTAIL_PROCEDURE':
      return updateCocktailDraft(state, { procedure: action.payload });
    case 'SET_COCKTAIL_TASTING_NOTES':
      return updateCocktailDraft(state, { tastingNotes: action.payload });
    case 'SET_COCKTAIL_DESCRIPTION':
      return updateCocktailDraft(state, { description: action.payload });
    case 'SET_COCKTAIL_NOTES':
      return updateCocktailDraft(state, { notes: action.payload });
    case 'SET_COCKTAIL_IMAGE':
      return updateCocktailDraft(state, { image: action.payload });
    case 'SET_COCKTAIL_TOP_SELLER':
      return updateCocktailDraft(state, { isTopSeller: action.payload });

    // === PLATE SPEC METADATA ===
    case 'SET_PLATE_TYPE':
      return updatePlateSpecDraft(state, () => ({ plateType: action.payload }));
    case 'SET_MENU_CATEGORY':
      return updatePlateSpecDraft(state, () => ({ menuCategory: action.payload }));
    case 'SET_PLATE_ALLERGENS':
      return updatePlateSpecDraft(state, () => ({ allergens: action.payload }));
    case 'SET_PLATE_TAGS':
      return updatePlateSpecDraft(state, () => ({ tags: action.payload }));
    case 'SET_PLATE_NOTES':
      return updatePlateSpecDraft(state, () => ({ notes: action.payload }));

    // === COMPONENT GROUPS (plate spec) ===
    case 'ADD_COMPONENT_GROUP':
      return updatePlateSpecDraft(state, (d) => ({
        components: [...d.components, action.payload],
      }));
    case 'UPDATE_COMPONENT_GROUP':
      return updatePlateSpecDraft(state, (d) => {
        const components = [...d.components];
        components[action.payload.index] = action.payload.group;
        return { components };
      });
    case 'REMOVE_COMPONENT_GROUP':
      return updatePlateSpecDraft(state, (d) => ({
        components: d.components.filter((_, i) => i !== action.payload),
      }));
    case 'REORDER_COMPONENT_GROUPS':
      return updatePlateSpecDraft(state, () => ({
        components: action.payload,
      }));

    // === ASSEMBLY PROCEDURE (plate spec — dedicated, NOT reused from prep recipe) ===
    case 'ADD_ASSEMBLY_GROUP':
      return updatePlateSpecDraft(state, (d) => ({
        assemblyProcedure: [...d.assemblyProcedure, action.payload],
      }));
    case 'UPDATE_ASSEMBLY_GROUP':
      return updatePlateSpecDraft(state, (d) => {
        const assemblyProcedure = [...d.assemblyProcedure];
        assemblyProcedure[action.payload.index] = action.payload.group;
        return { assemblyProcedure };
      });
    case 'REMOVE_ASSEMBLY_GROUP':
      return updatePlateSpecDraft(state, (d) => ({
        assemblyProcedure: d.assemblyProcedure.filter((_, i) => i !== action.payload),
      }));
    case 'REORDER_ASSEMBLY_GROUPS':
      return updatePlateSpecDraft(state, () => ({
        assemblyProcedure: action.payload,
      }));

    // === DISH GUIDE (nested inside PlateSpecDraft) ===
    case 'SET_DISH_GUIDE':
      return updatePlateSpecDraft(state, () => ({
        dishGuide: action.payload,
        dishGuideStale: false,
      }));
    case 'UPDATE_DISH_GUIDE_FIELD':
      return updatePlateSpecDraft(state, (d) => {
        if (!d.dishGuide) return {};
        return {
          dishGuide: { ...d.dishGuide, [action.payload.field]: action.payload.value },
        };
      });
    case 'CLEAR_DISH_GUIDE':
      return updatePlateSpecDraft(state, () => ({
        dishGuide: null,
        dishGuideStale: false,
      }));

    // === SESSION ===
    case 'SET_SESSION_ID':
      return { ...state, sessionId: action.payload };
    case 'SET_EDITING_PRODUCT_ID':
      return { ...state, editingProductId: action.payload };
    case 'SET_IS_SAVING':
      return { ...state, isSaving: action.payload };
    case 'SET_DRAFT_VERSION':
      return { ...state, draftVersion: action.payload };

    default:
      return state;
  }
}

// =============================================================================
// CONTEXT
// =============================================================================

interface IngestContextValue {
  state: IngestState;
  dispatch: Dispatch<IngestAction>;
}

const IngestDraftContext = createContext<IngestContextValue | null>(null);

export function IngestDraftProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(ingestReducer, initialState);

  return (
    <IngestDraftContext.Provider value={{ state, dispatch }}>
      {children}
    </IngestDraftContext.Provider>
  );
}

export function useIngestDraft() {
  const ctx = useContext(IngestDraftContext);
  if (!ctx) throw new Error('useIngestDraft must be used within IngestDraftProvider');
  return ctx;
}
