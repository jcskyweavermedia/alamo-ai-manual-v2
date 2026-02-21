import { useReducer, useCallback } from 'react';
import type { PrepRecipeDraft } from '@/types/ingestion';
import type {
  RecipeIngredientGroup,
  RecipeIngredient,
  RecipeProcedureGroup,
  RecipeProcedureStep,
} from '@/types/products';
import { createEmptyPrepRecipeDraft, generateSlug } from '@/types/ingestion';

// =============================================================================
// ACTIONS
// =============================================================================

type DraftAction =
  // Set entire draft (e.g., from AI)
  | { type: 'SET_ALL'; payload: PrepRecipeDraft }
  | { type: 'RESET' }
  // Metadata
  | { type: 'SET_NAME'; payload: string }
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
  | { type: 'SET_QUALITY_CHECKS'; payload: string[] };

// =============================================================================
// HELPERS
// =============================================================================

function swapArray<T>(arr: T[], i: number, j: number): T[] {
  if (i < 0 || j < 0 || i >= arr.length || j >= arr.length) return arr;
  const copy = [...arr];
  [copy[i], copy[j]] = [copy[j], copy[i]];
  return copy;
}

function reorderGroups(groups: RecipeIngredientGroup[]): RecipeIngredientGroup[] {
  return groups.map((g, i) => ({ ...g, order: i + 1 }));
}

function reorderProcGroups(groups: RecipeProcedureGroup[]): RecipeProcedureGroup[] {
  return groups.map((g, i) => ({ ...g, order: i + 1 }));
}

function renumberSteps(steps: RecipeProcedureStep[]): RecipeProcedureStep[] {
  return steps.map((s, i) => ({ ...s, step_number: i + 1 }));
}

// =============================================================================
// REDUCER
// =============================================================================

function draftReducer(state: PrepRecipeDraft, action: DraftAction): PrepRecipeDraft {
  switch (action.type) {
    case 'SET_ALL':
      return action.payload;

    case 'RESET':
      return createEmptyPrepRecipeDraft();

    case 'SET_NAME':
      return { ...state, name: action.payload, slug: generateSlug(action.payload) };

    case 'SET_PREP_TYPE':
      return { ...state, prepType: action.payload };

    case 'SET_TAGS':
      return { ...state, tags: action.payload };

    case 'SET_YIELD':
      return { ...state, yieldQty: action.payload.qty, yieldUnit: action.payload.unit };

    case 'SET_SHELF_LIFE':
      return { ...state, shelfLifeValue: action.payload.value, shelfLifeUnit: action.payload.unit };

    // === INGREDIENT GROUPS ===
    case 'ADD_INGREDIENT_GROUP': {
      const newGroup: RecipeIngredientGroup = {
        group_name: action.payload || `Group ${state.ingredients.length + 1}`,
        order: state.ingredients.length + 1,
        items: [],
      };
      return { ...state, ingredients: [...state.ingredients, newGroup] };
    }

    case 'REMOVE_INGREDIENT_GROUP': {
      const filtered = state.ingredients.filter((_, i) => i !== action.payload);
      return { ...state, ingredients: reorderGroups(filtered) };
    }

    case 'RENAME_INGREDIENT_GROUP': {
      const groups = [...state.ingredients];
      groups[action.payload.index] = { ...groups[action.payload.index], group_name: action.payload.name };
      return { ...state, ingredients: groups };
    }

    case 'MOVE_GROUP_UP':
      return {
        ...state,
        ingredients: reorderGroups(swapArray(state.ingredients, action.payload, action.payload - 1)),
      };

    case 'MOVE_GROUP_DOWN':
      return {
        ...state,
        ingredients: reorderGroups(swapArray(state.ingredients, action.payload, action.payload + 1)),
      };

    // === INDIVIDUAL INGREDIENTS ===
    case 'ADD_INGREDIENT': {
      const groups = [...state.ingredients];
      const group = { ...groups[action.payload.groupIndex] };
      const newItem: RecipeIngredient = { name: '', quantity: 0, unit: '', allergens: [] };
      group.items = [...group.items, newItem];
      groups[action.payload.groupIndex] = group;
      return { ...state, ingredients: groups };
    }

    case 'UPDATE_INGREDIENT': {
      const groups = [...state.ingredients];
      const group = { ...groups[action.payload.groupIndex] };
      const items = [...group.items];
      items[action.payload.itemIndex] = action.payload.item;
      group.items = items;
      groups[action.payload.groupIndex] = group;
      return { ...state, ingredients: groups };
    }

    case 'REMOVE_INGREDIENT': {
      const groups = [...state.ingredients];
      const group = { ...groups[action.payload.groupIndex] };
      group.items = group.items.filter((_, i) => i !== action.payload.itemIndex);
      groups[action.payload.groupIndex] = group;
      return { ...state, ingredients: groups };
    }

    case 'MOVE_INGREDIENT_UP': {
      const groups = [...state.ingredients];
      const group = { ...groups[action.payload.groupIndex] };
      group.items = swapArray(group.items, action.payload.itemIndex, action.payload.itemIndex - 1);
      groups[action.payload.groupIndex] = group;
      return { ...state, ingredients: groups };
    }

    case 'MOVE_INGREDIENT_DOWN': {
      const groups = [...state.ingredients];
      const group = { ...groups[action.payload.groupIndex] };
      group.items = swapArray(group.items, action.payload.itemIndex, action.payload.itemIndex + 1);
      groups[action.payload.groupIndex] = group;
      return { ...state, ingredients: groups };
    }

    // === PROCEDURE GROUPS ===
    case 'ADD_PROCEDURE_GROUP': {
      const newGroup: RecipeProcedureGroup = {
        group_name: action.payload || `Phase ${state.procedure.length + 1}`,
        order: state.procedure.length + 1,
        steps: [],
      };
      return { ...state, procedure: [...state.procedure, newGroup] };
    }

    case 'REMOVE_PROCEDURE_GROUP': {
      const filtered = state.procedure.filter((_, i) => i !== action.payload);
      return { ...state, procedure: reorderProcGroups(filtered) };
    }

    case 'RENAME_PROCEDURE_GROUP': {
      const groups = [...state.procedure];
      groups[action.payload.index] = { ...groups[action.payload.index], group_name: action.payload.name };
      return { ...state, procedure: groups };
    }

    case 'MOVE_PROCEDURE_GROUP_UP':
      return {
        ...state,
        procedure: reorderProcGroups(swapArray(state.procedure, action.payload, action.payload - 1)),
      };

    case 'MOVE_PROCEDURE_GROUP_DOWN':
      return {
        ...state,
        procedure: reorderProcGroups(swapArray(state.procedure, action.payload, action.payload + 1)),
      };

    // === INDIVIDUAL STEPS ===
    case 'ADD_STEP': {
      const groups = [...state.procedure];
      const group = { ...groups[action.payload.groupIndex] };
      const newStep: RecipeProcedureStep = {
        step_number: group.steps.length + 1,
        instruction: '',
        critical: false,
      };
      group.steps = [...group.steps, newStep];
      groups[action.payload.groupIndex] = group;
      return { ...state, procedure: groups };
    }

    case 'UPDATE_STEP': {
      const groups = [...state.procedure];
      const group = { ...groups[action.payload.groupIndex] };
      const steps = [...group.steps];
      steps[action.payload.stepIndex] = action.payload.step;
      group.steps = steps;
      groups[action.payload.groupIndex] = group;
      return { ...state, procedure: groups };
    }

    case 'REMOVE_STEP': {
      const groups = [...state.procedure];
      const group = { ...groups[action.payload.groupIndex] };
      group.steps = renumberSteps(group.steps.filter((_, i) => i !== action.payload.stepIndex));
      groups[action.payload.groupIndex] = group;
      return { ...state, procedure: groups };
    }

    case 'MOVE_STEP_UP': {
      const groups = [...state.procedure];
      const group = { ...groups[action.payload.groupIndex] };
      group.steps = renumberSteps(swapArray(group.steps, action.payload.stepIndex, action.payload.stepIndex - 1));
      groups[action.payload.groupIndex] = group;
      return { ...state, procedure: groups };
    }

    case 'MOVE_STEP_DOWN': {
      const groups = [...state.procedure];
      const group = { ...groups[action.payload.groupIndex] };
      group.steps = renumberSteps(swapArray(group.steps, action.payload.stepIndex, action.payload.stepIndex + 1));
      groups[action.payload.groupIndex] = group;
      return { ...state, procedure: groups };
    }

    // === BATCH & TRAINING ===
    case 'SET_BATCH_NOTES':
      return {
        ...state,
        batchScaling: {
          scalable: true,
          scaling_method: 'linear',
          base_yield: { quantity: state.yieldQty, unit: state.yieldUnit },
          notes: action.payload,
          exceptions: [],
        },
      };

    case 'SET_TRAINING_NOTES': {
      const existing = 'notes' in state.trainingNotes ? state.trainingNotes : { notes: '', common_mistakes: [], quality_checks: [] };
      return {
        ...state,
        trainingNotes: { ...existing, notes: action.payload } as import('@/types/products').TrainingNotes,
      };
    }

    case 'SET_COMMON_MISTAKES': {
      const existing = 'notes' in state.trainingNotes ? state.trainingNotes : { notes: '', common_mistakes: [], quality_checks: [] };
      return {
        ...state,
        trainingNotes: { ...existing, common_mistakes: action.payload } as import('@/types/products').TrainingNotes,
      };
    }

    case 'SET_QUALITY_CHECKS': {
      const existing = 'notes' in state.trainingNotes ? state.trainingNotes : { notes: '', common_mistakes: [], quality_checks: [] };
      return {
        ...state,
        trainingNotes: { ...existing, quality_checks: action.payload } as import('@/types/products').TrainingNotes,
      };
    }

    default:
      return state;
  }
}

// =============================================================================
// HOOK
// =============================================================================

export function usePrepRecipeDraft(initial?: PrepRecipeDraft) {
  const [draft, dispatch] = useReducer(draftReducer, initial ?? createEmptyPrepRecipeDraft());

  const setAll = useCallback((d: PrepRecipeDraft) => dispatch({ type: 'SET_ALL', payload: d }), []);
  const reset = useCallback(() => dispatch({ type: 'RESET' }), []);

  return { draft, dispatch, setAll, reset };
}
