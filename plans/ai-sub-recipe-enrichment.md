# Plan: AI Sub-Recipe Enrichment

> **Status:** Audited and corrected (3 Opus agents: Backend Engineer, Technical Architect, Devil's Advocate)
> **File modified:** `supabase/functions/ask-product/index.ts` (single file, no migration, no frontend changes)

---

## Problem Statement

When users interact with the AI about a recipe (e.g., "What allergens are in this dish?" or "Teach me this recipe"), the AI has **zero awareness** of linked sub-recipes. It sees ingredient names like "Chimichurri" or "Herb Compound Butter" as plain text — it doesn't know these are real prep recipes in the database with their own ingredients, allergens, procedures, and training notes.

### Current Behavior

```
User views Bone-in Ribeye plate spec and asks: "What allergens should I warn guests about?"

AI sees: "Components: 1 each Herb Compound Butter, 4 oz Red Wine Demi-Glace, 8 oz Creamed Spinach"
AI answers: "Based on the recipe card, I don't see specific allergen information for this dish."

WRONG — Herb Compound Butter contains dairy, Creamed Spinach contains dairy + gluten, etc.
The data exists in the database but the AI never sees it.
```

### Desired Behavior

```
User views Bone-in Ribeye plate spec and asks: "What allergens should I warn guests about?"

AI sees the components AND their full sub-recipe data (ingredients, allergens, procedure)
AI answers: "This dish has several allergen considerations:
- Herb Compound Butter: contains dairy (butter)
- Creamed Spinach: contains dairy (cream, parmesan) and gluten (roux)
- Red Wine Demi-Glace: contains alcohol (red wine)
Always confirm specific allergies with guests before serving."
```

---

## How the AI Pipeline Works Today

### Three Modes in `ask-product/index.ts`

| Mode | Trigger | Data Source | DB Search? |
|------|---------|-------------|------------|
| **Action** | User taps button (Teach Me, Quiz Me, etc.) while viewing a card | `itemContext` blob from frontend | No |
| **Context** | User types freeform question while viewing a card | `itemContext` blob in system prompt | No |
| **Search** | Freeform question, no card in view | OpenAI tool calls to `search_*` functions | Yes |

### Key Function: `serializeItemContext()` (Action + Context modes)

For the `recipes` domain, this function extracts from the `itemContext` blob:
- `name`, `prep_type`, `plate_type`, `tags`, `yield_qty`, `shelf_life_value`
- `ingredients` → flattened to `"2 oz Chimichurri, 12 oz Outside skirt steak"`
- `procedure` → flattened to joined step instructions
- `components` → flattened to `"1 each Herb Compound Butter, 4 oz Red Wine Demi-Glace"`
- `training_notes`, `notes`

**The gap:** It completely ignores `prep_recipe_ref` on each ingredient/component item. The `itemContext` blob DOES contain this field (it's part of the JSONB from the database), but `serializeItemContext()` never reads it.

### Key Functions: `search_recipes()` and other search pipelines (Search mode)

All 5 search functions (`search_dishes`, `search_wines`, `search_cocktails`, `search_recipes`, `search_beer_liquor`) use RRF hybrid search (FTS + vector) and return **summary data only**: `id, slug, name, snippet, score`. None return JSONB ingredient data or `prep_recipe_ref` references.

**Why the existing search functions are NOT suitable for sub-recipe resolution:**
1. They require an embedding vector (extra OpenAI API call per query)
2. They return only summary data (name, slug, snippet) — no JSONB ingredients, procedure, or allergens
3. They search by similarity, not exact slug match
4. They're designed for user discovery, not internal reference resolution

The `ask-product` edge function already uses these search functions in Search mode via OpenAI function calling. The AI CAN call `search_recipes` multiple times, but results are always summaries — the AI never gets full recipe data in Search mode. This is a structural limitation of the search pipeline, not a bug.

---

## Implementation Plan

### Scope: Action + Context Modes Only

Sub-recipe enrichment targets **Action and Context modes** where:
1. The full `itemContext` blob is available (contains JSONB with `prep_recipe_ref`)
2. The AI needs detailed, accurate answers about a specific recipe
3. We can fetch sub-recipe data server-side before calling OpenAI

**Search mode gets NO data enrichment.** Rationale:
- Search results are summary-level — no JSONB data to extract `prep_recipe_ref` from
- The AI cannot see sub-recipe references in search result snippets
- Enriching search results would require 2+ extra DB queries per request (fetch full rows, then fetch sub-recipes)
- Search mode is for discovery/recommendations — users tap into a card for detailed questions
- Instead, we add an honest prompt note directing users to open the card for detailed ingredient/allergen analysis

### Domain: `recipes` Only

Only the `recipes` domain has sub-recipe links (`prep_recipe_ref` on `RecipeIngredient` and `PlateComponent`). The `dishes` domain uses `foh_plate_specs` which has no ingredient JSONB. Wines, cocktails, and beer/liquor have no sub-recipe concept.

### Data Flow Verification (Audit Confirmed)

The `itemContext` blob is sent from the frontend as `selectedRecipe as unknown as Record<string, unknown>`. The JSONB sub-objects (`ingredients[].items[]`, `components[].items[]`) retain their original database shape including `prep_recipe_ref` and `allergens` fields. The `extractPrepRecipeRefs` function can safely access these fields.

**Note:** In current seed data, `prep_recipe_ref` only appears on `plate_specs.components` items (e.g., bone-in-ribeye referencing herb-compound-butter). No `prep_recipes` ingredient items have `prep_recipe_ref` in seed data. However, the data model supports it, and the ingestion UI allows it, so the code handles both paths.

---

### Part 1: Four Helper Functions

All added to `supabase/functions/ask-product/index.ts`, placed between the existing `enrichWithMenuItems()` function and the `jsonResponse()` helper.

#### 1.1 `extractPrepRecipeRefs(item)`

Scans the `itemContext` blob for all `prep_recipe_ref` slugs. Uses `Set` for automatic deduplication (same sub-recipe referenced in multiple groups).

```typescript
function extractPrepRecipeRefs(item: Record<string, unknown>): string[] {
  const refs = new Set<string>();

  // Prep recipe ingredients: [{ group_name, items: [{ name, prep_recipe_ref, ... }] }]
  // deno-lint-ignore no-explicit-any
  const ingredients = item.ingredients as any[] | null;
  if (Array.isArray(ingredients)) {
    for (const group of ingredients) {
      // deno-lint-ignore no-explicit-any
      for (const it of (group.items || []) as any[]) {
        if (it.prep_recipe_ref) refs.add(it.prep_recipe_ref);
      }
    }
  }

  // Plate spec components: [{ group_name, items: [{ name, prep_recipe_ref, ... }] }]
  // deno-lint-ignore no-explicit-any
  const components = item.components as any[] | null;
  if (Array.isArray(components)) {
    for (const group of components) {
      // deno-lint-ignore no-explicit-any
      for (const it of (group.items || []) as any[]) {
        if (it.prep_recipe_ref) refs.add(it.prep_recipe_ref);
      }
    }
  }

  return [...refs];
}
```

**Safety:** All inputs guarded by `Array.isArray`, `|| []` fallbacks, and truthiness checks. Handles undefined/null/malformed inputs gracefully (returns empty array).

#### 1.2 `fetchSubRecipes(supabase, slugs)`

Fetches full prep recipe rows by slug in a single batched query.

```typescript
// deno-lint-ignore no-explicit-any
async function fetchSubRecipes(supabase: any, slugs: string[]): Promise<any[]> {
  if (!slugs.length) return [];

  // Cap at 5 to limit token budget and latency
  const limited = slugs.slice(0, 5);
  if (slugs.length > 5) {
    console.warn(`[ask-product] Sub-recipe cap: ${slugs.length} refs found, using first 5`);
  }

  try {
    const { data, error } = await supabase
      .from('prep_recipes')
      .select('slug, name, prep_type, ingredients, procedure, training_notes, yield_qty, yield_unit, shelf_life_value, shelf_life_unit, tags')
      .in('slug', limited)
      .eq('status', 'published');

    if (error) {
      console.error('[ask-product] Sub-recipe fetch error:', error.message);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('[ask-product] Sub-recipe fetch exception:', err);
    return [];
  }
}
```

**Column verification (audit confirmed):** All 11 columns (`slug`, `name`, `prep_type`, `ingredients`, `procedure`, `training_notes`, `yield_qty`, `yield_unit`, `shelf_life_value`, `shelf_life_unit`, `tags`) exist on the `prep_recipes` table. The `status` column also exists for filtering.

**Uses service role client:** Consistent with all other DB operations in this edge function. RLS allows SELECT for all authenticated users anyway, but service role bypasses it for consistency.

**Cap of 5 with warning:** When more than 5 refs are found, a warning is logged so the gap is visible. The enrichment section will include a note (see Part 1.4).

#### 1.3 `serializeSubRecipe(recipe)`

Formats a sub-recipe for injection into the AI context.

```typescript
// deno-lint-ignore no-explicit-any
function serializeSubRecipe(recipe: any): string {
  const parts: (string | null)[] = [
    `Sub-Recipe: ${recipe.name} (${recipe.slug})`,
    recipe.prep_type ? `Type: ${recipe.prep_type}` : null,
    recipe.yield_qty ? `Yield: ${recipe.yield_qty} ${recipe.yield_unit || ''}` : null,
    recipe.shelf_life_value ? `Shelf Life: ${recipe.shelf_life_value} ${recipe.shelf_life_unit || ''}` : null,
  ];

  // Ingredients with allergens
  const allAllergens = new Set<string>();
  if (Array.isArray(recipe.ingredients)) {
    // deno-lint-ignore no-explicit-any
    const items = recipe.ingredients.flatMap((g: any) =>
      // deno-lint-ignore no-explicit-any
      g.items?.map((i: any) => {
        let text = i.name;
        if (i.quantity != null) {
          const unit = i.unit ? ` ${i.unit}` : '';
          text = `${i.quantity}${unit} ${text}`;
        }
        if (i.allergens?.length) {
          text += ` [ALLERGENS: ${i.allergens.join(', ')}]`;
          for (const a of i.allergens) allAllergens.add(a);
        }
        return text;
      }) || []
    );
    if (items.length) parts.push(`Ingredients: ${items.join(', ')}`);
  }

  // Aggregated allergen summary line
  if (allAllergens.size) {
    parts.push(`Contains Allergens: ${[...allAllergens].join(', ')}`);
  }

  // Procedure
  if (Array.isArray(recipe.procedure)) {
    // deno-lint-ignore no-explicit-any
    const steps = recipe.procedure.flatMap((g: any) =>
      // deno-lint-ignore no-explicit-any
      g.steps?.map((s: any) => s.instruction) || []
    );
    if (steps.length) parts.push(`Procedure: ${steps.join(' ')}`);
  }

  // Training notes
  if (recipe.training_notes && typeof recipe.training_notes === 'object' && Object.keys(recipe.training_notes).length > 0) {
    parts.push(`Training Notes: ${JSON.stringify(recipe.training_notes)}`);
  }

  // Warn about nested refs (depth-2 not resolved)
  if (Array.isArray(recipe.ingredients)) {
    // deno-lint-ignore no-explicit-any
    const nestedRefs = recipe.ingredients.flatMap((g: any) =>
      // deno-lint-ignore no-explicit-any
      (g.items || []).filter((i: any) => i.prep_recipe_ref).map((i: any) => i.prep_recipe_ref)
    );
    if (nestedRefs.length) {
      console.warn(`[ask-product] Sub-recipe "${recipe.slug}" has nested refs (depth-2 not resolved): ${nestedRefs.join(', ')}`);
    }
  }

  return parts.filter(Boolean).join('\n');
}
```

**Allergen aggregation:** Collects allergens from each ingredient inline AND adds a summary `Contains Allergens:` line per sub-recipe. This makes allergen questions trivially answerable.

**Depth-2 warning:** If a fetched sub-recipe itself contains `prep_recipe_ref` values, a warning is logged. These nested refs are NOT resolved (depth-1 only), but the warning makes the gap visible for future enhancement.

#### 1.4 `enrichContextWithSubRecipes(supabase, item, contextText)`

Orchestrator that ties it all together.

```typescript
async function enrichContextWithSubRecipes(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  item: Record<string, unknown>,
  contextText: string
): Promise<string> {
  try {
    const refs = extractPrepRecipeRefs(item);
    if (!refs.length) return contextText;

    console.log(`[ask-product] Enriching with ${refs.length} sub-recipe(s): ${refs.join(', ')}`);

    const subRecipes = await fetchSubRecipes(supabase, refs);
    if (!subRecipes.length) return contextText;

    const subRecipeText = subRecipes.map(serializeSubRecipe).join('\n\n');

    let header = '\n\n--- Linked Sub-Recipes (referenced by ingredients/components above) ---\n';
    if (refs.length > 5) {
      header += `Note: This recipe references ${refs.length} sub-recipes; showing the first 5.\n`;
    }

    return contextText + header + subRecipeText;
  } catch (err) {
    console.error('[ask-product] Sub-recipe enrichment failed:', err);
    return contextText; // Graceful degradation — original context unchanged
  }
}
```

**Cap transparency:** When more than 5 refs exist, a note is added to the enrichment section so the AI knows data is incomplete and can mention this to the user if relevant.

---

### Part 2: Wire Into Action Mode

**Exact location: Line 830** (between `let extraCitations = [];` on line 829 and the `if (PAIRING_ACTIONS.has(action))` block on line 832).

Current code at lines 828-832:
```typescript
let contextText = serializeItemContext(domain, itemContext);     // line 828
let extraCitations: ProductCitation[] = [];                      // line 829
                                                                 // line 830 ← INSERT HERE
// Pairing enrichment: fetch real menu items for pairing actions // line 831
if (PAIRING_ACTIONS.has(action)) {                               // line 832
```

Insert at line 830:
```typescript
// Enrich with sub-recipe data (recipes domain only)
if (domain === 'recipes') {
  contextText = await enrichContextWithSubRecipes(supabase, itemContext, contextText);
}
```

No conflict with pairing enrichment: sub-recipe enrichment only triggers for `domain === 'recipes'`, while pairing enrichment only triggers for `foodPairings`/`suggestPairing` actions (which exist only on wines/cocktails/beer_liquor domains).

The `supabase` service role client is in scope (created at line 710).

---

### Part 3: Wire Into Context Mode

**Exact location: Line 912** (where `const contextText` is declared).

Current code at line 912:
```typescript
const contextText = serializeItemContext(domain, itemContext);   // line 912
```

Change to:
```typescript
let contextText = serializeItemContext(domain, itemContext);      // line 912

// Enrich with sub-recipe data (recipes domain only)
if (domain === 'recipes') {
  contextText = await enrichContextWithSubRecipes(supabase, itemContext, contextText);
}
```

The `contextText` variable is subsequently used in the template literal system prompt at line 918 (`${contextText}`). Changing `const` to `let` has no impact on template literal interpolation — the variable's current value is used at string construction time, which happens AFTER the enrichment.

The `supabase` service role client is in scope (created at line 710).

---

### Part 4: Update `serializeItemContext()` — Mark Linked Items

Modify the ingredient/component serialization to indicate which items are linked sub-recipes. This gives the AI a cross-reference between the main ingredient list and the sub-recipe section below.

**Two edit locations in `serializeItemContext()` for the `recipes` case:**

**Location 1 — Ingredients return (line 399):**

Current:
```typescript
return `${prefix}${i.name}`;
```

Updated:
```typescript
const ref = i.prep_recipe_ref ? ` [sub-recipe: ${i.prep_recipe_ref}]` : '';
return `${prefix}${i.name}${ref}`;
```

**Location 2 — Components return (line 426):**

Current:
```typescript
return `${prefix}${i.name}`;
```

Updated:
```typescript
const ref = i.prep_recipe_ref ? ` [sub-recipe: ${i.prep_recipe_ref}]` : '';
return `${prefix}${i.name}${ref}`;
```

**Result example:** `"1 pc Herb Compound Butter [sub-recipe: herb-compound-butter]"` — the AI can now match this to the full sub-recipe data in the enrichment section.

---

### Part 5: System Prompt Additions

#### Action Mode System Prompt (line 844)

Current rules section:
```
Rules:
- Use ONLY the product data provided below — never invent facts
- Be warm, professional, and encouraging
- ${langInstruction}
- Keep responses focused and actionable
```

Updated:
```
Rules:
- Use ONLY the product data provided below — never invent facts
- When linked sub-recipes are listed below the main recipe, use their ingredient, allergen, and procedure data to give complete answers. Reference sub-recipes by name when citing their data, but only when relevant to the question.
- Be warm, professional, and encouraging
- ${langInstruction}
- Keep responses focused and actionable
```

#### Context Mode System Prompt (line 914)

Current:
```
Answer the user's question using ONLY the product data above. Be accurate — cite exact quantities, ingredients, and details as shown. If the data above doesn't contain the answer, say so.
${langInstruction}
```

Updated:
```
Answer the user's question using ONLY the product data above. Be accurate — cite exact quantities, ingredients, and details as shown. If the data above doesn't contain the answer, say so.
When linked sub-recipes are provided after the main recipe data, use them to answer questions about ingredients, allergens, preparation details, and quality checks. Reference the sub-recipe name when citing data from it, but only when relevant to the question.
${langInstruction}
```

#### Search Mode System Prompt (line 984)

Current (after the "multiple tools" paragraph):
```
Rules:
- Always search before answering — do not guess product details
```

Add BEFORE the `Rules:` section:
```
Note: Some recipes contain linked sub-recipes (prep recipes used as components). For detailed ingredient or allergen questions about a specific recipe, the user should open the recipe card and ask from there — search results only contain summaries, not full ingredient data.
```

**Why this wording (audit correction):** The original plan suggested telling the AI to "search for sub-recipes by name." However, `search_recipes` returns only summary data (name, snippet, score) — not JSONB ingredients or allergens. The AI cannot actually answer allergen questions from search summaries alone. This honest wording directs the AI to tell users to open the card for detailed analysis, which activates Context mode where enrichment IS available.

---

## Token Budget Analysis

| Component | Tokens (estimated) |
|-----------|-------------------|
| Current recipe context (no enrichment) | ~200-400 |
| Each sub-recipe (name + type + yield + ~8 ingredients + ~5 procedure steps + training notes) | ~180-350 |
| Max 5 sub-recipes | ~900-1750 |
| **Total with enrichment** | **~1100-2150** |

**Real-world example — Bone-in Ribeye with 3 sub-recipes:**
- Parent context: ~200 tokens
- Herb Compound Butter: ~200 tokens
- Red Wine Demi-Glace: ~300 tokens
- Creamed Spinach: ~280 tokens
- **Total: ~980 tokens** — well within gpt-4o-mini's context window

- gpt-4o-mini input cost: $0.15 / 1M tokens
- Extra cost per enriched request: ~$0.0001-0.0003
- Latency: One additional DB query (~50-100ms), <5% of total request time

---

## Error Handling

- `fetchSubRecipes()` returns `[]` on any Supabase error (logged to console)
- `enrichContextWithSubRecipes()` wraps everything in try/catch, returns original context on failure
- No new error states in the API response — enrichment is purely additive
- If a `prep_recipe_ref` slug doesn't resolve (e.g., recipe was deleted), it's simply not included
- Draft/unpublished sub-recipes are excluded (`status = 'published'`)
- Depth-2 nested refs: warning logged, not resolved (documented limitation)
- Cap exceeded (>5 refs): warning logged, note added to context, AI can mention incompleteness

---

## Constraints

1. **Depth-1 only** — we resolve sub-recipes of the viewed recipe, but NOT sub-sub-recipes. If a sub-recipe itself has `prep_recipe_ref` links, they are not followed. A console warning is logged when this occurs.
2. **Max 5 sub-recipes per request** — prevents runaway token usage. When exceeded, a warning is logged and a note is added to the enrichment text so the AI knows data is incomplete.
3. **`recipes` domain only** — `dishes` (foh_plate_specs) has no ingredient JSONB; other domains have no sub-recipe concept.
4. **Action + Context modes only** — Search mode gets an honest prompt note (not a misleading hint), directing users to open the card for detailed analysis.
5. **Published only** — draft sub-recipes are excluded to avoid showing unstable data.

---

## Files Modified

| File | Change |
|------|--------|
| `supabase/functions/ask-product/index.ts` | Add 4 helper functions, wire into Action + Context modes, update `serializeItemContext` (2 locations), update 3 system prompts |

**No new files. No database migration. No frontend changes.**

---

## Pre-Existing Issue (Informational)

The audit uncovered a pre-existing camelCase/snake_case mismatch in `serializeItemContext()`. The function accesses snake_case properties (`item.prep_type`, `item.yield_qty`, `item.shelf_life_value`, `item.plate_type`, `item.menu_category`, `item.assembly_procedure`, `item.training_notes`) but the frontend sends camelCase equivalents (`prepType`, `yieldQty`, `shelfLifeValue`, etc.).

This means some fields are silently `undefined` in the current AI context (Type, Yield, Shelf Life, Category, Assembly, Training Notes). The fields that work are: `name`, `tags`, `ingredients`, `procedure`, `components`, `notes` — these happen to match in both naming conventions.

**This is NOT caused or worsened by this plan.** The enrichment functions access `item.ingredients` and `item.components`, which are unaffected by the mismatch. Fixing the mismatch is a separate improvement worth tracking but out of scope for this plan.

---

## Verification Plan

### Test 1: Action Mode — Teach Me (Plate Spec with Sub-Recipes)
1. View Bone-in Ribeye plate spec (has Herb Compound Butter, Red Wine Demi-Glace, Creamed Spinach)
2. Tap "Teach Me"
3. Verify the AI mentions sub-recipe details (ingredients, procedure) in its teaching
4. Check edge function logs for `Enriching with 3 sub-recipe(s): herb-compound-butter, red-wine-demi-glace, creamed-spinach`

### Test 2: Context Mode — Allergen Question (Plate Spec with Sub-Recipes)
1. View Bone-in Ribeye plate spec
2. Ask "What allergens are in this dish?"
3. Verify the AI lists allergens from sub-recipe ingredients (dairy from butter, dairy+gluten from creamed spinach, etc.)

### Test 3: Context Mode — Recipe without Sub-Recipes
1. View Chimichurri prep recipe (no `prep_recipe_ref` links)
2. Ask any question
3. Verify behavior is unchanged (no enrichment, no errors, no log messages about sub-recipes)

### Test 4: Search Mode — Honest Limitation
1. Without viewing a card, ask "What allergens are in the ribeye?"
2. Verify the AI searches via `search_recipes`, gets summary results
3. Verify the AI does NOT hallucinate allergen details (it should acknowledge summary-level data or suggest opening the card)

### Test 5: Error Resilience
1. Manually set a `prep_recipe_ref` to a non-existent slug (e.g., `"deleted-recipe"`)
2. Ask a question in Context mode
3. Verify the AI still answers (graceful degradation — missing sub-recipe is just not enriched)
4. Check logs for `Sub-recipe fetch` returning fewer results than expected (no error thrown)

### Test 6: Quiz Me (Plate Spec with Sub-Recipes)
1. View Bone-in Ribeye plate spec
2. Tap "Quiz Me"
3. Verify quiz questions can reference sub-recipe details (e.g., "What allergens does the Herb Compound Butter contain?")
