# Phase 7 — Wire AI Buttons

> Connect all 5 viewer AI buttons to the `/ask-product` edge function. ~1–2 sessions.

## Context

Phase 5 deployed the `/ask-product` edge function with dual-mode AI (action mode + open question mode) across 5 domains and 18 action prompts. Phase 6 wired all 5 viewers to the database, replaced mock data, and left AI sheets with placeholder text reading _"will appear here once wired to the ask-product API"_.

This phase:
1. Creates a `useAskProduct` hook (modeled on `useAskAI`)
2. Updates the 3 existing AI sheets to call the real endpoint
3. Creates 2 new AI sheets (Recipe, Beer & Liquor) and their action configs
4. Adds AI buttons to the 2 card views that lack them
5. Adds a freeform "Ask a question" input to every AI sheet

---

## Prerequisites

- [x] `/ask-product` edge function deployed and tested (Phase 5)
- [x] All 5 viewers fetching from Supabase (Phase 6)
- [x] 3 existing AI sheets with placeholder text (Dish, Wine, Cocktail)
- [x] `useAskAI` hook exists as reference pattern (`src/hooks/use-ask-ai.ts`)
- [x] `useAuth` returns `permissions.memberships[0].groupId`
- [x] `useLanguage` returns current `language: 'en' | 'es'`

---

## Current State of AI Components

| Component | AI Buttons | AI Sheet | Status |
|-----------|-----------|----------|--------|
| DishCardView | 4 buttons (practicePitch, samplePitch, teachMe, questions) | DishAISheet (placeholder) | Needs wiring |
| WineCardView | 4 buttons (explainToGuest, wineDetails, foodPairings, questions) | WineAISheet (placeholder) | Needs wiring |
| CocktailCardView | 4 buttons (explainToGuest, samplePitch, foodPairings, questions) | CocktailAISheet (placeholder) | Needs wiring |
| RecipeCardView | **NONE** | **Does not exist** | Build from scratch |
| BeerLiquorCardView | **NONE** | **Does not exist** | Build from scratch |

---

## Step 1 — Create `useAskProduct` Hook

A new hook modeled on `useAskAI` (`src/hooks/use-ask-ai.ts`, 167 lines). Same auth, language, group, and error handling patterns — different endpoint and request shape.

### File: `src/hooks/use-ask-product.ts`

```typescript
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';
import { toast } from 'sonner';

// =============================================================================
// TYPES
// =============================================================================

export type ProductDomain = 'dishes' | 'wines' | 'cocktails' | 'recipes' | 'beer_liquor';

export interface ProductCitation {
  id: string;
  slug: string;
  name: string;
  domain: ProductDomain;
}

export interface UsageInfo {
  daily: { used: number; limit: number };
  monthly: { used: number; limit: number };
}

export interface AskProductResult {
  answer: string;
  citations: ProductCitation[];
  usage: UsageInfo;
  mode: 'action' | 'search';
}

export interface AskProductActionOptions {
  action: string;                         // Action key (e.g., 'practicePitch')
  itemContext: Record<string, unknown>;    // Full serialized card data
}

export interface AskProductOptions {
  domain: ProductDomain;
  actionOptions?: AskProductActionOptions; // Present for button press, absent for freeform
}

export interface UseAskProductReturn {
  askProduct: (question: string, options: AskProductOptions) => Promise<AskProductResult | null>;
  isLoading: boolean;
  result: AskProductResult | null;
  error: string | null;
  clearResult: () => void;
  clearError: () => void;
}

// =============================================================================
// HOOK
// =============================================================================

export function useAskProduct(): UseAskProductReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AskProductResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { user, permissions } = useAuth();
  const { language } = useLanguage();

  const primaryGroup = permissions?.memberships?.[0] ?? null;

  const askProduct = useCallback(async (
    question: string,
    options: AskProductOptions,
  ): Promise<AskProductResult | null> => {
    // --- Validate prerequisites (same as useAskAI) ---
    if (!user) {
      const msg = language === 'es'
        ? 'Por favor inicia sesión para usar el asistente AI'
        : 'Please sign in to use the AI assistant';
      toast.error(msg);
      return null;
    }

    if (!primaryGroup) {
      const msg = language === 'es'
        ? 'No tienes acceso a ningún grupo'
        : "You don't have access to any group";
      toast.error(msg);
      return null;
    }

    if (primaryGroup.policy && !primaryGroup.policy.canUseAi) {
      const msg = language === 'es'
        ? 'El asistente AI no está disponible para tu rol'
        : 'AI assistant is not available for your role';
      toast.error(msg);
      return null;
    }

    // --- Call edge function ---
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const body: Record<string, unknown> = {
        question,
        domain: options.domain,
        language,
        groupId: primaryGroup.groupId,
      };

      // Action mode: add action + itemContext
      if (options.actionOptions) {
        body.action = options.actionOptions.action;
        body.itemContext = options.actionOptions.itemContext;
      }

      const { data, error: fnError } = await supabase.functions.invoke('ask-product', { body });

      if (fnError) {
        throw new Error(fnError.message || 'Failed to call product AI');
      }

      // Handle error responses from the edge function
      if (data?.error) {
        if (data.error === 'limit_exceeded') {
          const msg = data.message || (language === 'es'
            ? 'Límite de preguntas alcanzado'
            : 'Question limit reached');
          toast.error(msg);
          setError(msg);
          return null;
        }
        if (data.error === 'forbidden') {
          const msg = data.message || (language === 'es'
            ? 'No tienes acceso a este grupo'
            : "You don't have access to this group");
          toast.error(msg);
          setError(msg);
          return null;
        }
        throw new Error(data.message || data.error);
      }

      const askResult = data as AskProductResult;
      setResult(askResult);
      return askResult;
    } catch (err) {
      const msg = err instanceof Error
        ? err.message
        : (language === 'es' ? 'Error al obtener respuesta' : 'Failed to get answer');
      setError(msg);
      toast.error(msg);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [user, primaryGroup, language]);

  const clearResult = useCallback(() => setResult(null), []);
  const clearError = useCallback(() => setError(null), []);

  return { askProduct, isLoading, result, error, clearResult, clearError };
}
```

### Key Differences from `useAskAI`

| Aspect | `useAskAI` | `useAskProduct` |
|--------|-----------|----------------|
| Edge function | `ask` | `ask-product` |
| Request body | `{ question, language, groupId, expand, context }` | `{ question, domain, language, groupId, action?, itemContext? }` |
| Return | `AskResult` (answer, citations, usage) | `AskProductResult` (answer, citations, usage, mode) |
| State | `isLoading`, `error` | `isLoading`, `error`, **`result`** (persisted for sheet display) |
| Result clearing | Not tracked | `clearResult()` for sheet close/re-open |

### Why `result` is stored in the hook

The existing AI sheets only have a `responseText` string. After wiring, the sheet needs to:
1. Show loading spinner while `isLoading === true`
2. Display `result.answer` when available
3. Keep the answer visible until the sheet is closed
4. Clear on sheet close or new action tap

Storing `result` in the hook (rather than the sheet component) avoids prop-drilling and keeps the AI call state co-located.

---

## Step 2 — Define Recipe & Beer/Liquor AI Action Configs

### File: `src/data/mock-dishes.ts` (add to existing)

No changes — Dish AI actions already defined.

### File: `src/data/mock-wines.ts` (add to existing)

No changes — Wine AI actions already defined.

### File: `src/data/mock-cocktails.ts` (add to existing)

No changes — Cocktail AI actions already defined.

### File: `src/data/mock-recipes.ts` (add new exports)

```typescript
// --- AI action types and config (NEW) ---

export type RecipeAIAction = 'teachMe' | 'quizMe' | 'questions';

export const RECIPE_AI_ACTIONS: { key: RecipeAIAction; label: string; icon: string }[] = [
  { key: 'teachMe', label: 'Teach Me', icon: 'graduation-cap' },
  { key: 'quizMe', label: 'Quiz Me', icon: 'clipboard-list' },
  { key: 'questions', label: 'Ask a question', icon: 'help-circle' },
];
```

### File: `src/data/mock-beer-liquor.ts` (add new exports)

```typescript
// --- AI action types and config (NEW) ---

export type BeerLiquorAIAction = 'teachMe' | 'suggestPairing' | 'questions';

export const BEER_LIQUOR_AI_ACTIONS: { key: BeerLiquorAIAction; label: string; icon: string }[] = [
  { key: 'teachMe', label: 'Teach Me', icon: 'graduation-cap' },
  { key: 'suggestPairing', label: 'Suggest pairing', icon: 'utensils-crossed' },
  { key: 'questions', label: 'Ask a question', icon: 'help-circle' },
];
```

### Action Map (Frontend → Edge Function)

| Domain | Frontend Action Key | Edge Function Action Key | Match? |
|--------|-------------------|-------------------------|--------|
| Dishes | `practicePitch` | `practicePitch` | Yes |
| Dishes | `samplePitch` | `samplePitch` | Yes |
| Dishes | `teachMe` | `teachMe` | Yes |
| Dishes | `questions` | `questions` | Yes |
| Wines | `explainToGuest` | `explainToGuest` | Yes |
| Wines | `wineDetails` | `wineDetails` | Yes |
| Wines | `foodPairings` | `foodPairings` | Yes |
| Wines | `questions` | `questions` | Yes |
| Cocktails | `explainToGuest` | `explainToGuest` | Yes |
| Cocktails | `samplePitch` | `samplePitch` | Yes |
| Cocktails | `foodPairings` | `foodPairings` | Yes |
| Cocktails | `questions` | `questions` | Yes |
| Recipes | `teachMe` | `teachMe` | Yes |
| Recipes | `quizMe` | `quizMe` | Yes |
| Recipes | `questions` | `questions` | Yes |
| Beer/Liquor | `teachMe` | `teachMe` | Yes |
| Beer/Liquor | `suggestPairing` | `suggestPairing` | Yes |
| Beer/Liquor | `questions` | `questions` | Yes |

All 18 action keys match between frontend configs and edge function `ACTION_PROMPTS`. No mapping needed.

---

## Step 3 — Update Existing AI Sheets (Dish, Wine, Cocktail)

All 3 existing sheets follow the exact same pattern (71 lines each, identical structure). The update is identical for all 3 — replacing the placeholder with a real API call.

### Current Pattern (placeholder)

```tsx
// DishAISheet.tsx (WineAISheet and CocktailAISheet are identical in structure)
const responseText = `AI-generated "${actionLabel}" response for ${dish.menuName} will appear here...`;

return (
  <Sheet>
    <SheetContent>
      <SheetHeader>...</SheetHeader>
      <div className="flex-1 overflow-y-auto py-4">
        <p>{responseText}</p>
      </div>
      <SheetFooter>
        <Button onClick={handleCopy}>Copy</Button>
      </SheetFooter>
    </SheetContent>
  </Sheet>
);
```

### New Pattern (wired)

```tsx
// All 3 sheets get the same structural update
export function DishAISheet({ dish, action, open, onOpenChange }: DishAISheetProps) {
  const { askProduct, isLoading, result, error, clearResult, clearError } = useAskProduct();
  const [copied, setCopied] = useState(false);
  const [freeformQuestion, setFreeformQuestion] = useState('');
  const prevActionRef = useRef<string | null>(null);

  // Auto-trigger AI when action changes (button press = action mode)
  useEffect(() => {
    if (!action || !open) return;
    if (action === prevActionRef.current) return;
    prevActionRef.current = action;

    // "questions" action opens freeform mode — don't auto-call
    if (action === 'questions') return;

    clearResult();
    clearError();

    askProduct(actionLabel, {
      domain: 'dishes',  // 'wines' for WineAISheet, etc.
      actionOptions: {
        action,
        itemContext: dish as unknown as Record<string, unknown>,
      },
    });
  }, [action, open]);

  // Reset on sheet close
  useEffect(() => {
    if (!open) {
      prevActionRef.current = null;
      clearResult();
      clearError();
      setFreeformQuestion('');
    }
  }, [open]);

  // Handle freeform question submit
  function handleAskQuestion() {
    if (!freeformQuestion.trim()) return;
    clearResult();
    askProduct(freeformQuestion.trim(), {
      domain: 'dishes',
      actionOptions: {
        action: 'questions',
        itemContext: dish as unknown as Record<string, unknown>,
      },
    });
  }

  const responseText = result?.answer ?? '';

  function handleCopy() {
    if (!responseText) return;
    navigator.clipboard.writeText(responseText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[70vh] flex flex-col rounded-t-xl">
        <SheetHeader className="shrink-0">
          <SheetTitle>{actionLabel}</SheetTitle>
          <SheetDescription>{dish.menuName}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-4">
          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Thinking...</span>
            </div>
          )}

          {/* Error state */}
          {error && !isLoading && (
            <div className="flex flex-col items-center gap-2 py-8">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* AI response (with Markdown rendering) */}
          {responseText && !isLoading && (
            <div className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
              {responseText}
            </div>
          )}

          {/* Freeform input for "questions" action */}
          {action === 'questions' && !isLoading && (
            <div className="flex gap-2 mt-4">
              <Input
                value={freeformQuestion}
                onChange={(e) => setFreeformQuestion(e.target.value)}
                placeholder="Ask anything about this dish..."
                onKeyDown={(e) => e.key === 'Enter' && handleAskQuestion()}
              />
              <Button size="sm" onClick={handleAskQuestion} disabled={!freeformQuestion.trim()}>
                Ask
              </Button>
            </div>
          )}
        </div>

        <SheetFooter className="shrink-0 border-t pt-3">
          {/* Citations */}
          {result?.citations && result.citations.length > 0 && (
            <div className="flex-1 text-xs text-muted-foreground">
              Sources: {result.citations.map(c => c.name).join(', ')}
            </div>
          )}
          <Button variant="ghost" size="sm" onClick={handleCopy} disabled={!responseText} className="gap-2">
            {copied ? <><Check className="h-4 w-4" /> Copied</> : <><Copy className="h-4 w-4" /> Copy</>}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
```

### Per-Sheet Differences

| Sheet | `domain` param | Item prop | Item name field | Placeholder text |
|-------|---------------|-----------|-----------------|------------------|
| DishAISheet | `'dishes'` | `dish: Dish` | `dish.menuName` | "Ask anything about this dish..." |
| WineAISheet | `'wines'` | `wine: Wine` | `wine.name` | "Ask anything about this wine..." |
| CocktailAISheet | `'cocktails'` | `cocktail: Cocktail` | `cocktail.name` | "Ask anything about this cocktail..." |

### New Imports (all 3 sheets)

```typescript
import { useState, useEffect, useRef } from 'react';
import { Copy, Check, Loader2, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useAskProduct } from '@/hooks/use-ask-product';
```

---

## Step 4 — Create RecipeAISheet

### File: `src/components/recipes/RecipeAISheet.tsx`

Follows the same pattern as the updated DishAISheet, with these differences:

| Aspect | Value |
|--------|-------|
| Domain | `'recipes'` |
| Item prop | `recipe: Recipe` |
| Item name | `recipe.name` |
| Action type | `RecipeAIAction` |
| Actions config | `RECIPE_AI_ACTIONS` |
| Placeholder | "Ask anything about this recipe..." |
| Special: `questions` action | Opens freeform mode (same as other sheets) |

### Serializing Recipe itemContext

Recipes are a union type (`PrepRecipe | PlateSpec`). The full object is sent as `itemContext`. The edge function's `serializeItemContext('recipes', item)` handles both variants — no frontend transformation needed. Just cast:

```typescript
itemContext: recipe as unknown as Record<string, unknown>
```

---

## Step 5 — Create BeerLiquorAISheet

### File: `src/components/beer-liquor/BeerLiquorAISheet.tsx`

Same pattern, with:

| Aspect | Value |
|--------|-------|
| Domain | `'beer_liquor'` |
| Item prop | `item: BeerLiquorItem` |
| Item name | `item.name` |
| Action type | `BeerLiquorAIAction` |
| Actions config | `BEER_LIQUOR_AI_ACTIONS` |
| Placeholder | "Ask anything about this beverage..." |

---

## Step 6 — Add AI Buttons to RecipeCardView

### File: `src/components/recipes/RecipeCardView.tsx`

**What to add:**
1. Import AI action config and sheet
2. Add `activeAction` state
3. Add AI button row (same layout as DishCardView)
4. Add RecipeAISheet component

### Changes

```tsx
// New imports
import { GraduationCap, ClipboardList, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RecipeAISheet } from './RecipeAISheet';
import type { RecipeAIAction } from '@/data/mock-recipes';
import { RECIPE_AI_ACTIONS } from '@/data/mock-recipes';

// Icon map
const AI_ICON_MAP: Record<string, typeof GraduationCap> = {
  'graduation-cap': GraduationCap,
  'clipboard-list': ClipboardList,
  'help-circle': HelpCircle,
};

// Inside component, add state:
const [activeAction, setActiveAction] = useState<RecipeAIAction | null>(null);

// Disable swipe when AI sheet is open:
const { ref: swipeRef } = useSwipeNavigation({
  onSwipeLeft: onNext,
  onSwipeRight: onPrev,
  enabled: !expandedImage && activeAction === null,  // ← add activeAction check
});
```

### Button Placement

Insert the AI buttons row **after the divider, before the two-column layout**. This matches the DishCardView pattern where buttons sit between the header section and the detail content.

```tsx
{/* Divider */}
<div className="border-t border-border" />

{/* AI Action Buttons (NEW) */}
<div className="flex items-center justify-center gap-2 flex-wrap">
  {RECIPE_AI_ACTIONS.map(({ key, label, icon }) => {
    const Icon = AI_ICON_MAP[icon];
    const isActive = activeAction === key;
    return (
      <Button
        key={key}
        variant={isActive ? 'default' : 'outline'}
        size="sm"
        className="shrink-0"
        onClick={() => setActiveAction(isActive ? null : key)}
      >
        {Icon && <Icon className={cn('h-4 w-4', !isActive && 'text-primary')} />}
        {label}
      </Button>
    );
  })}
</div>

{/* Two-column layout (existing) */}
...

{/* AI Response Sheet (NEW — add before closing </div>) */}
<RecipeAISheet
  recipe={recipe}
  action={activeAction}
  open={activeAction !== null}
  onOpenChange={(open) => { if (!open) setActiveAction(null); }}
/>
```

---

## Step 7 — Add AI Buttons to BeerLiquorCardView

### File: `src/components/beer-liquor/BeerLiquorCardView.tsx`

Same pattern as RecipeCardView. Currently the component is 108 lines with no AI integration.

### Changes

```tsx
// New imports
import { useState } from 'react';
import { GraduationCap, UtensilsCrossed, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BeerLiquorAISheet } from './BeerLiquorAISheet';
import type { BeerLiquorAIAction } from '@/data/mock-beer-liquor';
import { BEER_LIQUOR_AI_ACTIONS } from '@/data/mock-beer-liquor';

// Icon map
const AI_ICON_MAP: Record<string, typeof GraduationCap> = {
  'graduation-cap': GraduationCap,
  'utensils-crossed': UtensilsCrossed,
  'help-circle': HelpCircle,
};

// Inside component:
const [activeAction, setActiveAction] = useState<BeerLiquorAIAction | null>(null);

// Disable swipe when AI sheet is open:
const { ref: swipeRef } = useSwipeNavigation({
  onSwipeLeft: onNext,
  onSwipeRight: onPrev,
  enabled: activeAction === null,  // ← add check
});
```

### Button Placement

Insert after the divider, before the info sections:

```tsx
{/* Divider */}
<div className="border-t border-border" />

{/* AI Action Buttons (NEW) */}
<div className="flex items-center justify-center gap-2 flex-wrap">
  {BEER_LIQUOR_AI_ACTIONS.map(({ key, label, icon }) => {
    const Icon = AI_ICON_MAP[icon];
    const isActive = activeAction === key;
    return (
      <Button
        key={key}
        variant={isActive ? 'default' : 'outline'}
        size="sm"
        className="shrink-0"
        onClick={() => setActiveAction(isActive ? null : key)}
      >
        {Icon && <Icon className={cn('h-4 w-4', !isActive && 'text-primary')} />}
        {label}
      </Button>
    );
  })}
</div>

{/* Info sections (existing) */}
...

{/* AI Response Sheet (NEW) */}
<BeerLiquorAISheet
  item={item}
  action={activeAction}
  open={activeAction !== null}
  onOpenChange={(open) => { if (!open) setActiveAction(null); }}
/>
```

---

## Step 8 — Freeform "Ask a Question" Mode

All 5 AI sheets include a `questions` action that opens a freeform input instead of auto-triggering an AI call. This provides the "open question mode" from the `/ask-product` edge function.

### Behavior

1. User taps "Ask a question" / "Have any questions?" button on card
2. AI sheet opens with a text input + "Ask" button
3. User types a question and submits
4. Hook calls `/ask-product` with `action: 'questions'` + `itemContext` (action mode — the AI has the full card context)
5. Response displays below the input
6. User can ask follow-up questions (previous answer clears, new one appears)

### Why Action Mode (Not Open Question Mode)

Even though it's a freeform question, we still pass `itemContext` because:
- The user is asking **about a specific item** they're viewing
- The AI should ground its answer in that item's data
- This is faster (no search needed) and more accurate

Open question mode (without `itemContext`) is reserved for a future global search feature where the user isn't looking at a specific card.

---

## Step 9 — Markdown Rendering (Optional Enhancement)

The edge function's AI responses may include:
- Numbered lists (1. 2. 3.)
- Bullet points (-)
- Bold text (**text**)
- Headers (rarely)

### Option A: Simple `whitespace-pre-wrap` (Current)

The placeholder sheets already use `whitespace-pre-wrap` which handles line breaks and numbered lists adequately. This is the minimum viable approach.

### Option B: Lightweight Markdown

If responses look better with proper formatting, install `react-markdown` and render:

```tsx
import ReactMarkdown from 'react-markdown';

<ReactMarkdown className="prose prose-sm dark:prose-invert max-w-none">
  {responseText}
</ReactMarkdown>
```

**Recommendation:** Start with Option A. Add react-markdown in Phase 8 polish if needed.

---

## Files Summary

### New Files (4)

| File | Purpose | ~Lines |
|------|---------|--------|
| `src/hooks/use-ask-product.ts` | Hook: calls `/ask-product` edge function | ~130 |
| `src/components/recipes/RecipeAISheet.tsx` | AI sheet for Recipe domain | ~100 |
| `src/components/beer-liquor/BeerLiquorAISheet.tsx` | AI sheet for Beer & Liquor domain | ~100 |

### Modified Files (8)

| File | Changes |
|------|---------|
| `src/components/dishes/DishAISheet.tsx` | Replace placeholder with `useAskProduct` call, add loading/error/freeform |
| `src/components/wines/WineAISheet.tsx` | Same update as DishAISheet (domain: `'wines'`) |
| `src/components/cocktails/CocktailAISheet.tsx` | Same update as DishAISheet (domain: `'cocktails'`) |
| `src/components/recipes/RecipeCardView.tsx` | Add AI button row + RecipeAISheet |
| `src/components/beer-liquor/BeerLiquorCardView.tsx` | Add AI button row + BeerLiquorAISheet |
| `src/data/mock-recipes.ts` | Add `RecipeAIAction` type + `RECIPE_AI_ACTIONS` config |
| `src/data/mock-beer-liquor.ts` | Add `BeerLiquorAIAction` type + `BEER_LIQUOR_AI_ACTIONS` config |

### Unchanged Files

| File | Reason |
|------|--------|
| `src/data/mock-dishes.ts` | `DishAIAction` + `DISH_AI_ACTIONS` already exist |
| `src/data/mock-wines.ts` | `WineAIAction` + `WINE_AI_ACTIONS` already exist |
| `src/data/mock-cocktails.ts` | `CocktailAIAction` + `COCKTAIL_AI_ACTIONS` already exist |
| `supabase/functions/ask-product/index.ts` | All 18 actions already handled, no changes needed |

---

## Implementation Order

```
1. Create useAskProduct hook               (Step 1)  — foundation, no deps
2. Add Recipe + B&L action configs          (Step 2)  — quick, no deps
3. Update DishAISheet                       (Step 3)  — test the hook end-to-end
4. Update WineAISheet + CocktailAISheet     (Step 3)  — same pattern, fast
5. Create RecipeAISheet                     (Step 4)  — new file
6. Add AI buttons to RecipeCardView         (Step 6)  — wire sheet into view
7. Create BeerLiquorAISheet                 (Step 5)  — new file
8. Add AI buttons to BeerLiquorCardView     (Step 7)  — wire sheet into view
9. Test all 5 domains                       (Step 10) — verify
```

**Recommended approach:** Implement Steps 1-3 first and test one domain end-to-end (Dishes). Once confirmed working, the remaining 4 domains are mechanical repetitions of the same pattern.

---

## Testing Plan

### Step 10a — Action Mode Tests (1 per domain)

For each domain, tap one AI button and verify:

| Domain | Button to Test | Expected Behavior |
|--------|---------------|-------------------|
| Dishes | "Practice a pitch" | Sheet opens, spinner shows, AI generates 2-3 sentence pitch |
| Wines | "Food pairings" | Sheet opens, AI suggests Alamo Prime menu pairings |
| Cocktails | "Hear a sample pitch" | Sheet opens, AI generates bartender-style pitch |
| Recipes | "Teach Me" | Sheet opens, AI generates structured teaching points |
| Beer/Liquor | "Suggest pairing" | Sheet opens, AI suggests food pairings |

### Step 10b — Freeform Question Tests (2 domains)

| Domain | Action | Question | Expected |
|--------|--------|----------|----------|
| Dishes | "Have any questions?" | "Is the ribeye gluten free?" | Sheet shows input, answer grounded in dish data |
| Wines | "Have any questions?" | "What temperature should I serve this?" | Answer based on wine's style/body |

### Step 10c — Error Handling Tests

| Scenario | How to Trigger | Expected |
|----------|---------------|----------|
| Loading state | Tap any AI button | Spinner shows for ~1-2 seconds |
| Usage limit | Exhaust daily limit | Toast: "Question limit reached" |
| Network error | Disconnect/bad URL | Toast: "Failed to get answer" |
| Copy | Tap "Copy" after response | Text copied to clipboard |

### Step 10d — Spanish Language Test

| Action | Expected |
|--------|----------|
| Switch UI to Spanish → tap AI button | Response comes in Spanish |
| Sheet title/labels | Remain in English (action labels are English-only per design) |

### Step 10e — TypeScript Verification

```bash
npx tsc --noEmit  # Zero new errors
```

---

## Edge Cases & Considerations

### Sheet Re-open Behavior

When a user taps the same action button twice (close → re-open), the sheet should:
1. Close on first tap (toggle off)
2. Re-open on second tap with a fresh AI call

The `prevActionRef` pattern handles this — when the sheet closes, the ref is reset to `null`, so re-opening triggers a new API call.

### Multiple Rapid Taps

If a user taps different action buttons quickly, each tap:
1. Clears previous result
2. Starts new loading state
3. Only the last response displays

The `useAskProduct` hook's `setResult(null)` at the start of each call handles this naturally. No debouncing needed since each call is independent.

### Large Recipe itemContext

Recipes (especially PrepRecipes with JSONB ingredients/procedure) can produce large `itemContext` objects. The edge function's `serializeItemContext` extracts only relevant text fields, so the AI prompt stays manageable. The full object is sent over the wire but this is fine for <100KB payloads.

### Usage Counter Sharing

Product AI questions share the same daily/monthly counters as manual AI questions (both call `increment_usage`). This is intentional — prevents users from bypassing limits by switching between manual and product AI.

---

## Dependency Graph

```
Phase 5 (/ask-product) ← DONE
  ↓
Phase 6 (Wire Viewers) ← DONE
  ↓
Phase 7 (Wire AI Buttons) ← THIS PHASE
  ↓
Phase 8 (Integration Testing & Polish)
```

---

## Implementation Checklist

- [ ] Create `src/hooks/use-ask-product.ts`
- [ ] Add `RecipeAIAction` type + `RECIPE_AI_ACTIONS` to `mock-recipes.ts`
- [ ] Add `BeerLiquorAIAction` type + `BEER_LIQUOR_AI_ACTIONS` to `mock-beer-liquor.ts`
- [ ] Update `DishAISheet.tsx`: replace placeholder with `useAskProduct`, add loading/error/freeform
- [ ] Update `WineAISheet.tsx`: same pattern (domain: `'wines'`)
- [ ] Update `CocktailAISheet.tsx`: same pattern (domain: `'cocktails'`)
- [ ] Create `RecipeAISheet.tsx` (domain: `'recipes'`)
- [ ] Create `BeerLiquorAISheet.tsx` (domain: `'beer_liquor'`)
- [ ] Add AI buttons to `RecipeCardView.tsx` + wire RecipeAISheet
- [ ] Add AI buttons to `BeerLiquorCardView.tsx` + wire BeerLiquorAISheet
- [ ] Test: Dish action mode (practicePitch)
- [ ] Test: Wine action mode (foodPairings)
- [ ] Test: Cocktail action mode (samplePitch)
- [ ] Test: Recipe action mode (teachMe)
- [ ] Test: Beer/Liquor action mode (suggestPairing)
- [ ] Test: Freeform question (at least 2 domains)
- [ ] Test: Spanish language response
- [ ] Test: Loading spinner displays correctly
- [ ] Test: Error state displays correctly
- [ ] Test: Copy button works
- [ ] Test: Sheet close/re-open resets state
- [ ] Verify: `npx tsc --noEmit` passes with zero new errors
