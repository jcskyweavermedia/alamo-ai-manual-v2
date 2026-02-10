# Phase 5 — `/ask-product` Edge Function

> The AI brain with function calling (tool use). ~2 sessions.

## Context

Phases 2–4 built the product database: 6 tables, 44 rows, 5 search functions, and 44 vector embeddings. Phase 5 builds the edge function that sits between the frontend AI buttons and the database. It handles two modes:

1. **Action mode** — button presses (e.g., "Practice a pitch") that use the full card context directly
2. **Open question mode** — freeform questions that use OpenAI tool use (function calling) to search the right product table

This function shares the same auth, usage limits, and CORS patterns as the existing `/ask` function (manual AI assistant) but operates on product data instead of manual sections.

---

## Prerequisites

- [x] 6 product tables with data (Phase 2)
- [x] 5 search functions deployed (Phase 3)
- [x] 44/44 product embeddings generated (Phase 4)
- [x] `/ask` edge function (reference implementation for auth + usage)
- [x] `OPENAI_API_KEY` set in Supabase secrets

---

## Differences from `/ask` (Manual Assistant)

| Aspect | `/ask` (manual) | `/ask-product` (new) |
|--------|-----------------|----------------------|
| Data source | `manual_sections` | 6 product tables |
| Search | `hybrid_search_manual` RPC | 5 domain search RPCs via tool use |
| Modes | Single (open question) | Dual: action mode + open question mode |
| Context | Section title hint | Full serialized card data (`itemContext`) |
| AI approach | RAG (retrieve → generate) | Action: direct generation. Open: tool use → generate |
| Language | Bilingual (EN/ES content) | English content, AI translates to ES when needed |
| Off-topic filter | Regex heuristic | Domain-scoped (product questions only) |
| Max tokens | 500 / 1200 (expand) | 600 (action) / 800 (open question) |

---

## Request Interface

```
POST /functions/v1/ask-product
Authorization: Bearer <USER_JWT>
Content-Type: application/json
```

```typescript
interface AskProductRequest {
  // Required
  question: string;       // User's question OR action label (e.g., "Practice a pitch")
  domain: ProductDomain;  // Which product domain
  language: 'en' | 'es';  // UI language
  groupId: string;        // User's group UUID

  // Action mode (button press)
  action?: string;        // Action key (e.g., "practicePitch", "foodPairings")
  itemContext?: Record<string, unknown>;  // Full serialized card data

  // Open question mode (freeform)
  // No extra fields — just question + domain
}

type ProductDomain = 'dishes' | 'wines' | 'cocktails' | 'recipes' | 'beer_liquor';
```

### Mode Detection

```
if (action && itemContext) → Action mode
else                       → Open question mode
```

---

## Response Interface

```typescript
interface AskProductResponse {
  answer: string;
  citations: ProductCitation[];
  usage: UsageInfo;
  mode: 'action' | 'search';
}

interface ProductCitation {
  id: string;
  slug: string;
  name: string;
  domain: ProductDomain;
}

interface UsageInfo {
  daily:   { used: number; limit: number };
  monthly: { used: number; limit: number };
}
```

Error responses follow the same shape as `/ask`:

```typescript
interface ErrorResponse {
  error: string;
  message?: string;
  usage?: UsageInfo;
}
```

---

## Action Types by Domain

These are the existing frontend AI button actions. The edge function must handle all of them.

### Dishes (`foh_plate_specs`)

| Action Key | Button Label | What AI Should Do |
|-----------|-------------|-------------------|
| `practicePitch` | "Practice a pitch" | Generate a guest-facing sales pitch for the dish |
| `samplePitch` | "Hear a sample pitch" | Generate a polished example pitch a server would say |
| `teachMe` | "Teach Me" | Explain the dish's story, technique, key selling points |
| `questions` | "Have any questions?" | List common guest questions + answers about this dish |

### Wines

| Action Key | Button Label | What AI Should Do |
|-----------|-------------|-------------------|
| `explainToGuest` | "Practice a pitch" | Generate a guest-facing wine recommendation pitch |
| `wineDetails` | "Hear a sample pitch" | Generate a polished sommelier-style pitch |
| `foodPairings` | "Food pairings" | Suggest Alamo Prime menu pairings for this wine |
| `questions` | "Have any questions?" | List common guest questions + answers about this wine |

### Cocktails

| Action Key | Button Label | What AI Should Do |
|-----------|-------------|-------------------|
| `explainToGuest` | "Practice a pitch" | Generate a guest-facing cocktail recommendation |
| `samplePitch` | "Hear a sample pitch" | Generate a polished bartender-style pitch |
| `foodPairings` | "Food pairings" | Suggest Alamo Prime menu pairings for this cocktail |
| `questions` | "Have any questions?" | List common guest questions + answers about this cocktail |

### Recipes (NEW — to be created in Phase 7)

| Action Key | Button Label | What AI Should Do |
|-----------|-------------|-------------------|
| `teachMe` | "Teach Me" | Explain technique, critical steps, common mistakes |
| `quizMe` | "Quiz Me" | Generate 3-5 quiz questions about this recipe |
| `questions` | "Ask a question" | Answer a freeform question about this recipe |

### Beer & Liquor (NEW — to be created in Phase 7)

| Action Key | Button Label | What AI Should Do |
|-----------|-------------|-------------------|
| `teachMe` | "Teach Me" | Explain the spirit/beer, its story, how to serve |
| `suggestPairing` | "Suggest pairing" | Suggest Alamo Prime food pairings |
| `questions` | "Ask a question" | Answer a freeform question about this item |

---

## Action Mode: System Prompts

In action mode, the AI has the full card data as context and generates a response based on the action type. **No search is needed** — the context is already provided.

### Prompt Template (Action Mode)

```
System: You are a training assistant for Alamo Prime steakhouse.
{ACTION_SPECIFIC_INSTRUCTIONS}

Rules:
- Use ONLY the product data provided below — never invent facts
- Be warm, professional, and encouraging
- {LANGUAGE_INSTRUCTIONS}
- Keep responses focused and actionable

Product data:
{SERIALIZED_ITEM_CONTEXT}
```

### Action-Specific Instructions

```typescript
const ACTION_PROMPTS: Record<string, Record<string, string>> = {
  // === DISHES ===
  dishes: {
    practicePitch: 'Generate a natural, enthusiastic 2-3 sentence sales pitch a server would say to a guest about this dish. Include flavor highlights and what makes it special. Write it as dialogue the server would actually say.',
    samplePitch: 'Write a polished, confident server pitch for this dish (3-4 sentences). Include the dish name naturally, mention key ingredients, flavor profile, and a compelling reason to order it. Make it sound like a top-performing server at a premium steakhouse.',
    teachMe: 'Teach the server about this dish in a structured way:\n1. What it is and why guests love it\n2. Key ingredients and flavor profile\n3. Allergen awareness\n4. Best upsell opportunities\n5. One insider tip',
    questions: 'List 4-5 common guest questions about this dish and provide clear, confident answers. Include questions about allergens, preparation, modifications, and pairings.',
  },

  // === WINES ===
  wines: {
    explainToGuest: 'Generate a natural, confident 2-3 sentence wine recommendation a server would say to a guest. Mention the grape, region, and key tasting notes in accessible language (not overly technical).',
    wineDetails: 'Write a polished sommelier-style pitch for this wine (3-4 sentences). Include producer story, tasting notes, and what makes it special. Make it sound knowledgeable but approachable.',
    foodPairings: 'Suggest 3-4 specific dishes from the Alamo Prime menu that pair well with this wine. For each pairing, explain WHY it works (flavor complement, contrast, etc.). Use the wine\'s tasting notes and style to justify each pairing.',
    questions: 'List 4-5 common guest questions about this wine and provide confident answers. Include questions about taste, food pairings, serving temperature, and comparisons to other wines.',
  },

  // === COCKTAILS ===
  cocktails: {
    explainToGuest: 'Generate a natural, enthusiastic 2-3 sentence cocktail recommendation a server would say to a guest. Mention the spirit base, key flavors, and who would enjoy it.',
    samplePitch: 'Write a polished bartender-style pitch for this cocktail (3-4 sentences). Include the preparation method, flavor profile, and what makes it special at Alamo Prime.',
    foodPairings: 'Suggest 3-4 specific dishes from the Alamo Prime menu that pair well with this cocktail. For each pairing, explain WHY it works (flavor complement, contrast, palate cleanse, etc.).',
    questions: 'List 4-5 common guest questions about this cocktail and provide confident answers. Include questions about flavor, strength, spirit options, and modifications.',
  },

  // === RECIPES (BOH) ===
  recipes: {
    teachMe: 'Teach the cook about this recipe in a structured way:\n1. What it is and its role on the menu\n2. Critical steps that must be followed exactly\n3. Common mistakes and how to avoid them\n4. Quality checks (what does "done right" look like?)\n5. Storage and shelf life reminders',
    quizMe: 'Generate 5 quiz questions about this recipe to test the cook\'s knowledge. Mix question types:\n- 2 knowledge recall (ingredients, temps, times)\n- 2 situational (what do you do if...)\n- 1 quality check (how do you know when...)\nProvide answers after all questions.',
    questions: 'Answer the question using the recipe data provided. Focus on practical, actionable information relevant to kitchen execution.',
  },

  // === BEER & LIQUOR ===
  beer_liquor: {
    teachMe: 'Teach the server about this beverage in a structured way:\n1. What it is (style, origin, producer)\n2. Tasting notes and flavor profile\n3. How to serve it (glassware, temperature)\n4. Who typically orders it (guest profile)\n5. One interesting fact or talking point',
    suggestPairing: 'Suggest 3-4 specific dishes from the Alamo Prime menu that pair well with this beverage. For each pairing, explain WHY it works. Consider the beverage\'s flavor profile, weight, and carbonation.',
    questions: 'Answer the question using the product data provided. Focus on practical service knowledge.',
  },
};
```

### Language Instructions

```typescript
const LANGUAGE_INSTRUCTIONS = {
  en: 'Respond in English.',
  es: 'Responde en español. El contenido del producto está en inglés — tradúcelo naturalmente al español en tu respuesta.',
};
```

---

## Open Question Mode: Tool Use (Function Calling)

In open question mode, the user asks a freeform question. The AI decides which search tool to call based on the question and the `domain` hint.

### Tool Definitions

```typescript
const SEARCH_TOOLS: OpenAI.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'search_dishes',
      description: 'Search the dish menu (appetizers, entrees, sides, desserts). Use when the question is about a specific dish, menu item, food allergens, or dish recommendations.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query — key terms about the dish (e.g., "ribeye steak", "gluten free appetizer", "top seller entree")',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_wines',
      description: 'Search the wine list. Use when the question is about wines, varietals, regions, or wine pairings.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query — key terms about wine (e.g., "full bodied red", "sauvignon blanc", "bordeaux")',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_cocktails',
      description: 'Search the cocktail menu. Use when the question is about cocktails, mixed drinks, or cocktail ingredients.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query — key terms about cocktails (e.g., "bourbon classic", "espresso martini", "tiki")',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_recipes',
      description: 'Search kitchen recipes (prep recipes and plate specs). Use when the question is about how to make something, ingredients, cooking procedures, or kitchen prep.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query — key terms about recipes (e.g., "chimichurri", "demi glace", "ribeye plating")',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_beer_liquor',
      description: 'Search the beer and spirits list. Use when the question is about beers, liquors, spirits, bourbon, whiskey, or draft selections.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query — key terms about beer/liquor (e.g., "bourbon", "IPA", "tequila", "scotch")',
          },
        },
        required: ['query'],
      },
    },
  },
];
```

### Domain Hint

The `domain` field from the request tells the AI which viewer the user is currently in. This biases tool selection:

```typescript
const DOMAIN_HINT: Record<ProductDomain, string> = {
  dishes: 'The user is currently viewing the dish menu.',
  wines: 'The user is currently viewing the wine list.',
  cocktails: 'The user is currently viewing the cocktail menu.',
  recipes: 'The user is currently viewing kitchen recipes.',
  beer_liquor: 'The user is currently viewing the beer & spirits list.',
};
```

### Open Question System Prompt

```
You are a knowledgeable assistant for Alamo Prime steakhouse. Answer questions about the restaurant's menu, drinks, and recipes.

{DOMAIN_HINT}

You have access to search tools for each product domain. Use them to find relevant products before answering. You may call multiple tools if a question spans domains (e.g., "what wine pairs with the ribeye?" → search wines AND dishes).

Rules:
- Always search before answering — do not guess product details
- Cite specific products by name in your answer
- If no results found, say "I don't have information about that in our current menu."
- {LANGUAGE_INSTRUCTIONS}
- Be concise: 2-4 sentences + bullets if needed
```

### Tool Execution Flow

```
1. Send user question + tools to OpenAI (model: gpt-4o-mini)
2. If AI returns tool_calls:
   a. For each tool call:
      - Parse function name + query argument
      - Generate query embedding via OpenAI text-embedding-3-small
      - Call corresponding Supabase RPC (e.g., search_wines)
      - Collect results
   b. Send tool results back to OpenAI as tool messages
   c. AI generates final answer grounded in search results
3. If AI returns content directly (no tool call):
   - Use the answer as-is (AI decided no search was needed)
4. Extract citations from search results used
```

### Cross-Domain Questions

The AI can call **multiple tools** in a single turn. For example:

> "What wine pairs best with the Bone-In Ribeye?"

The AI would call:
1. `search_dishes({ query: "bone-in ribeye" })` — to get dish details
2. `search_wines({ query: "full bodied red cabernet" })` — to find pairing candidates

Then synthesize an answer using both result sets.

---

## Function Structure (Pseudocode)

```
1. Handle CORS preflight

2. Authenticate user (JWT → userId)
   - Same pattern as /ask: parse Authorization header, getClaims()

3. Parse request body → { question, domain, language, groupId, action?, itemContext? }

4. Validate required fields (question, domain, language, groupId)
   - Validate domain ∈ ['dishes', 'wines', 'cocktails', 'recipes', 'beer_liquor']

5. Check usage limits
   - get_user_usage(_user_id, _group_id) → { can_ask, daily_count, ... }
   - If !can_ask → return 429 with limit_exceeded

6. Determine mode:
   if (action && itemContext) → ACTION MODE
   else                       → OPEN QUESTION MODE

7a. ACTION MODE:
   - Look up system prompt: ACTION_PROMPTS[domain][action]
   - If not found → return 400 invalid action
   - Serialize itemContext to structured text

   - PAIRING ENRICHMENT (for foodPairings / suggestPairing actions only):
     - Build a search query from the item's flavor/style attributes
     - Generate query embedding
     - Call search_dishes() to get top 5 menu items
     - Append "Alamo Prime Menu Items:" + dish list to serialized context
     - Add matched dishes to citations

   - Call OpenAI chat completion (NO tools):
     system: action prompt + rules + language instruction
     user: serialized product data (+ menu items if pairing action)
   - Extract answer
   - Citations: [{ id, slug, name from itemContext }] (+ dish citations if pairing)

7b. OPEN QUESTION MODE:
   - Build system prompt with domain hint + language instruction
   - Call OpenAI chat completion WITH tools (SEARCH_TOOLS)
   - If response has tool_calls:
     - For each tool call:
       - Generate query embedding
       - Execute corresponding search RPC via Supabase
       - Format results as tool message
     - Send follow-up request with tool results
     - Extract final answer
   - Build citations from search results

8. Increment usage counter
   - increment_usage(_user_id, _group_id)

9. Return response:
   { answer, citations, usage, mode }
```

---

## itemContext Serialization

When the frontend sends `itemContext`, it's the full card data as a JSON object. The function serializes it into structured text for the AI prompt.

### Serializer per Domain

```typescript
function serializeItemContext(domain: ProductDomain, item: Record<string, unknown>): string {
  switch (domain) {
    case 'dishes':
      return [
        `Dish: ${item.menu_name || item.name}`,
        `Type: ${item.plate_type}`,
        item.short_description ? `Description: ${item.short_description}` : null,
        item.detailed_description ? `Details: ${item.detailed_description}` : null,
        item.key_ingredients ? `Key Ingredients: ${Array.isArray(item.key_ingredients) ? item.key_ingredients.join(', ') : item.key_ingredients}` : null,
        item.flavor_profile ? `Flavor: ${Array.isArray(item.flavor_profile) ? item.flavor_profile.join(', ') : item.flavor_profile}` : null,
        item.allergens ? `Allergens: ${Array.isArray(item.allergens) ? item.allergens.join(', ') : item.allergens}` : null,
        item.allergy_notes ? `Allergy Notes: ${item.allergy_notes}` : null,
        item.upsell_notes ? `Upsell Notes: ${item.upsell_notes}` : null,
        item.notes ? `Notes: ${item.notes}` : null,
        item.is_top_seller ? 'This is a TOP SELLER.' : null,
      ].filter(Boolean).join('\n');

    case 'wines':
      return [
        `Wine: ${item.name}`,
        `Producer: ${item.producer}`,
        item.vintage ? `Vintage: ${item.vintage}` : null,
        `Varietal: ${item.varietal}`,
        `Region: ${[item.region, item.country].filter(Boolean).join(', ')}`,
        `Style: ${item.style}, Body: ${item.body}`,
        item.tasting_notes ? `Tasting Notes: ${item.tasting_notes}` : null,
        item.producer_notes ? `Producer Notes: ${item.producer_notes}` : null,
        item.is_top_seller ? 'This is a TOP SELLER.' : null,
      ].filter(Boolean).join('\n');

    case 'cocktails':
      return [
        `Cocktail: ${item.name}`,
        `Style: ${item.style}`,
        `Glass: ${item.glass}`,
        item.key_ingredients ? `Key Ingredients: ${item.key_ingredients}` : null,
        item.ingredients ? `Full Ingredients: ${item.ingredients}` : null,
        item.tasting_notes ? `Tasting Notes: ${item.tasting_notes}` : null,
        item.description ? `Description: ${item.description}` : null,
        item.notes ? `Notes: ${item.notes}` : null,
        item.is_top_seller ? 'This is a TOP SELLER.' : null,
      ].filter(Boolean).join('\n');

    case 'recipes': {
      const parts: (string | null)[] = [
        `Recipe: ${item.name}`,
        item.prep_type ? `Type: ${item.prep_type}` : null,
        item.plate_type ? `Type: ${item.plate_type}` : null,
        item.menu_category ? `Category: ${item.menu_category}` : null,
        item.tags ? `Tags: ${Array.isArray(item.tags) ? item.tags.join(', ') : item.tags}` : null,
        item.yield_qty ? `Yield: ${item.yield_qty} ${item.yield_unit || ''}` : null,
        item.shelf_life_value ? `Shelf Life: ${item.shelf_life_value} ${item.shelf_life_unit || ''}` : null,
      ];

      // prep_recipes.ingredients: JSONB [{ group_name, items: [{ name, quantity, unit }] }]
      const ingredients = item.ingredients as { items: { name: string }[] }[] | null;
      if (Array.isArray(ingredients)) {
        const names = ingredients.flatMap((g: any) => g.items?.map((i: any) => i.name) || []);
        if (names.length) parts.push(`Ingredients: ${names.join(', ')}`);
      }

      // prep_recipes.procedure: JSONB [{ group_name, steps: [{ instruction }] }]
      const procedure = item.procedure as { steps: { instruction: string }[] }[] | null;
      if (Array.isArray(procedure)) {
        const steps = procedure.flatMap((g: any) => g.steps?.map((s: any) => s.instruction) || []);
        if (steps.length) parts.push(`Procedure: ${steps.join(' ')}`);
      }

      // plate_specs.components: JSONB [{ group_name, items: [{ name }] }]
      const components = item.components as { items: { name: string }[] }[] | null;
      if (Array.isArray(components)) {
        const names = components.flatMap((g: any) => g.items?.map((i: any) => i.name) || []);
        if (names.length) parts.push(`Components: ${names.join(', ')}`);
      }

      // plate_specs.assembly_procedure: JSONB [{ group_name, steps: [{ instruction }] }]
      const assembly = item.assembly_procedure as { steps: { instruction: string }[] }[] | null;
      if (Array.isArray(assembly)) {
        const steps = assembly.flatMap((g: any) => g.steps?.map((s: any) => s.instruction) || []);
        if (steps.length) parts.push(`Assembly: ${steps.join(' ')}`);
      }

      // prep_recipes.training_notes: JSONB (only exists on prep_recipes, not plate_specs)
      if (item.training_notes) {
        const tn = item.training_notes;
        parts.push(`Training Notes: ${typeof tn === 'string' ? tn : JSON.stringify(tn)}`);
      }

      // plate_specs.notes: TEXT (only exists on plate_specs, not prep_recipes)
      if (item.notes) parts.push(`Notes: ${item.notes}`);

      return parts.filter(Boolean).join('\n');
    }

    case 'beer_liquor':
      return [
        `Name: ${item.name}`,
        `Category: ${item.category}`,
        item.subcategory ? `Subcategory: ${item.subcategory}` : null,
        item.producer ? `Producer: ${item.producer}` : null,
        item.country ? `Country: ${item.country}` : null,
        item.style ? `Style: ${item.style}` : null,
        item.description ? `Description: ${item.description}` : null,
        item.notes ? `Notes: ${item.notes}` : null,
      ].filter(Boolean).join('\n');
  }
}
```

---

## Pairing Enrichment (Action Mode Only)

When the action is `foodPairings` (wines, cocktails) or `suggestPairing` (beer_liquor), the function enriches the AI prompt with actual menu data so the AI can suggest **specific Alamo Prime dishes** instead of generic pairings.

### Which Actions Trigger Enrichment

```typescript
const PAIRING_ACTIONS = new Set(['foodPairings', 'suggestPairing']);
```

### How It Works

```typescript
async function enrichWithMenuItems(
  supabase: SupabaseClient,
  item: Record<string, unknown>,
  domain: ProductDomain,
): Promise<{ menuText: string; dishCitations: ProductCitation[] }> {
  // Build a search query from the item's flavor/style attributes
  const queryParts: string[] = [];

  if (domain === 'wines') {
    if (item.style) queryParts.push(String(item.style));
    if (item.body) queryParts.push(String(item.body));
    if (item.varietal) queryParts.push(String(item.varietal));
  } else if (domain === 'cocktails') {
    if (item.style) queryParts.push(String(item.style));
    if (item.key_ingredients) queryParts.push(String(item.key_ingredients));
  } else if (domain === 'beer_liquor') {
    if (item.style) queryParts.push(String(item.style));
    if (item.category) queryParts.push(String(item.category));
  }

  const searchQuery = queryParts.join(' ') || 'steak entree';

  // Generate embedding and search dishes
  const queryEmbedding = await getQueryEmbedding(searchQuery);
  if (!queryEmbedding) {
    return { menuText: '', dishCitations: [] };
  }

  const results = await executeSearch(supabase, 'search_dishes', searchQuery, queryEmbedding);

  if (!results.length) {
    return { menuText: '', dishCitations: [] };
  }

  // Format dish list for the AI prompt
  const menuText = '\n\nAlamo Prime Menu Items (suggest pairings from these):\n' +
    results.map((r) => {
      const parts = [`- ${r.name}`];
      if (r.plate_type) parts.push(` (${r.plate_type})`);
      if (r.is_top_seller) parts.push(' ★ Top Seller');
      return parts.join('');
    }).join('\n');

  const dishCitations: ProductCitation[] = results.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    domain: 'dishes' as ProductDomain,
  }));

  return { menuText, dishCitations };
}
```

### Integration Point (Action Mode Step 7a)

```typescript
// After serializing itemContext, before calling OpenAI:
let contextText = serializeItemContext(domain, itemContext);
let extraCitations: ProductCitation[] = [];

if (PAIRING_ACTIONS.has(action)) {
  const { menuText, dishCitations } = await enrichWithMenuItems(supabase, itemContext, domain);
  contextText += menuText;
  extraCitations = dishCitations;
}

// Then pass contextText to OpenAI as the user message
// And merge extraCitations into the final citations array
```

### Performance Impact

- Adds ~300ms (1 embedding + 1 search RPC) only for pairing actions
- Non-pairing actions are unaffected

---

## Search RPC Execution

When the AI calls a search tool in open question mode, the function executes the corresponding Supabase RPC.

```typescript
async function executeSearch(
  supabase: SupabaseClient,
  toolName: string,
  query: string,
  queryEmbedding: number[],
): Promise<SearchResult[]> {
  const { data, error } = await supabase.rpc(toolName, {
    search_query: query,
    query_embedding: JSON.stringify(queryEmbedding),
    result_limit: 5,
    keyword_weight: 0.4,
    vector_weight: 0.6,
  });

  if (error) {
    console.error(`[ask-product] Search error (${toolName}):`, error.message);
    return [];
  }

  return data || [];
}
```

### Formatting Search Results for AI

```typescript
function formatSearchResults(toolName: string, results: SearchResult[]): string {
  if (!results.length) return 'No results found.';

  return results.map((r, i) => {
    const parts = [`${i + 1}. ${r.name} (${r.slug})`];
    if (r.snippet) parts.push(`   ${r.snippet.replace(/<\/?mark>/g, '')}`);
    // Include domain-specific fields
    if (r.plate_type) parts.push(`   Type: ${r.plate_type}`);
    if (r.is_top_seller) parts.push(`   ★ Top Seller`);
    if (r.varietal) parts.push(`   Varietal: ${r.varietal}`);
    if (r.style) parts.push(`   Style: ${r.style}`);
    if (r.category) parts.push(`   Category: ${r.category}`);
    if (r.subcategory) parts.push(`   Subcategory: ${r.subcategory}`);
    if (r.source_table) parts.push(`   Source: ${r.source_table}`);
    return parts.join('\n');
  }).join('\n\n');
}
```

---

## OpenAI API Calls

### Action Mode

```typescript
const response = await fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${OPENAI_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: actionSystemPrompt },
      { role: 'user', content: serializedItemContext },
    ],
    max_tokens: 600,
    temperature: 0.4,
  }),
});
```

### Open Question Mode — Initial Call (with tools)

```typescript
const response = await fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${OPENAI_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: openQuestionSystemPrompt },
      { role: 'user', content: question },
    ],
    tools: SEARCH_TOOLS,
    tool_choice: 'auto',
    max_tokens: 800,
    temperature: 0.3,
  }),
});
```

### Open Question Mode — Follow-up (with tool results)

```typescript
const followUp = await fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${OPENAI_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: openQuestionSystemPrompt },
      { role: 'user', content: question },
      assistantMessage,  // The tool_calls message from initial response
      ...toolResultMessages,  // Tool results as { role: 'tool', content, tool_call_id }
    ],
    max_tokens: 800,
    temperature: 0.3,
  }),
});
```

---

## Auth & Usage (Shared with `/ask`)

The auth and usage checking logic is identical to `/ask`:

1. **Auth**: Parse `Authorization: Bearer <JWT>` header → `supabaseAuth.auth.getClaims(token)` → extract `userId`
2. **Usage check**: `supabase.rpc('get_user_usage', { _user_id: userId, _group_id: groupId })` → check `can_ask`
3. **Increment**: After successful response, `supabase.rpc('increment_usage', { _user_id: userId, _group_id: groupId })`
4. **Shared counters**: Product AI questions count toward the same daily/monthly limits as manual AI questions

---

## File Structure

```
supabase/functions/ask-product/index.ts    ← Single file (~400-500 lines)
```

Single file. No separate modules needed — the function is self-contained. The complexity is in the prompt engineering and tool execution, not the code structure.

### Code Organization (within the file)

```
1. Imports + CORS headers
2. Type definitions
3. Constants: ACTION_PROMPTS, SEARCH_TOOLS, DOMAIN_HINT, LANGUAGE_INSTRUCTIONS
4. Helper: serializeItemContext()
5. Helper: executeSearch()
6. Helper: formatSearchResults()
7. Helper: getQueryEmbedding()
8. Helper: jsonResponse(), errorResponse()
9. Main handler: Deno.serve()
   a. CORS preflight
   b. Auth
   c. Parse request
   d. Usage check
   e. Mode branch (action vs open question)
   f. Increment usage
   g. Return response
```

---

## Deployment

```bash
npx supabase functions deploy ask-product
```

**Note:** This function uses `verify_jwt: true` (default) because it requires user authentication. Unlike `embed-products` (admin-only, no JWT), this is a user-facing function.

However, since the function does its own auth via `getClaims()` and needs to work with the new publishable key format, deploy with `--no-verify-jwt` and handle auth manually inside the function (same pattern as `/ask`):

```bash
npx supabase functions deploy ask-product --no-verify-jwt
```

---

## Testing Plan

### Action Mode Tests

Test each domain with one action to verify the full flow:

```bash
# 1. Dish: practicePitch
curl -X POST "https://nxeorbwqsovybfttemrw.supabase.co/functions/v1/ask-product" \
  -H "Authorization: Bearer <USER_JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Practice a pitch",
    "domain": "dishes",
    "language": "en",
    "groupId": "00000000-0000-0000-0000-000000000001",
    "action": "practicePitch",
    "itemContext": {
      "menu_name": "16oz Bone-In Ribeye",
      "plate_type": "entree",
      "short_description": "Our signature cut...",
      "key_ingredients": ["Bone-in ribeye", "Herb compound butter"],
      "flavor_profile": ["Rich", "Smoky", "Buttery"],
      "is_top_seller": true
    }
  }'

# 2. Wine: foodPairings
# 3. Cocktail: samplePitch
# 4. Recipe: teachMe
# 5. Beer/Liquor: suggestPairing
```

### Open Question Mode Tests

```bash
# 1. Same-domain question
curl -X POST ".../ask-product" \
  -H "Authorization: Bearer <USER_JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What is our most popular steak?",
    "domain": "dishes",
    "language": "en",
    "groupId": "00000000-0000-0000-0000-000000000001"
  }'

# 2. Cross-domain question
curl -d '{ "question": "What wine pairs with the ribeye?", "domain": "wines", ... }'

# 3. Spanish language
curl -d '{ "question": "Cuál es nuestro coctel más popular?", "domain": "cocktails", "language": "es", ... }'

# 4. No results scenario
curl -d '{ "question": "Do we have sushi?", "domain": "dishes", ... }'
```

### Edge Cases

```bash
# 5. Missing question → 400
curl -d '{ "domain": "dishes", "language": "en", "groupId": "..." }'

# 6. Invalid domain → 400
curl -d '{ "question": "test", "domain": "pizza", ... }'

# 7. Invalid action → 400
curl -d '{ "question": "test", "domain": "dishes", "action": "invalidAction", "itemContext": {...}, ... }'

# 8. Usage limit exceeded → 429
# (Use a test user that has hit their daily limit)

# 9. Unauthenticated → 401
curl -d '{ "question": "test", "domain": "dishes", ... }' -H "Authorization: Bearer invalid"
```

### Verification Queries

```sql
-- After running tests, verify usage was incremented
SELECT daily_count, monthly_count
FROM get_user_usage(
  '<user-uuid>',
  '00000000-0000-0000-0000-000000000001'
);
```

---

## Performance Estimates

| Metric | Action Mode | Open Question Mode |
|--------|------------|-------------------|
| Embedding generation | — | ~200ms (1 query embedding) |
| Search RPC execution | — | ~50ms per tool call |
| OpenAI chat completion | ~800ms (1 call) | ~1500ms (2 calls: initial + follow-up) |
| Auth + usage check | ~100ms | ~100ms |
| **Total latency** | **~1 second** | **~2 seconds** |
| OpenAI cost per request | ~$0.001 | ~$0.002 |

---

## Implementation Checklist

- [ ] Create `supabase/functions/ask-product/index.ts`
- [ ] Type definitions (request, response, domains, citations)
- [ ] CORS headers (copy from `/ask`)
- [ ] Auth: JWT parsing → `getClaims()` → userId
- [ ] Usage check: `get_user_usage` RPC
- [ ] Request validation (question, domain, groupId)
- [ ] Action mode:
  - [ ] ACTION_PROMPTS constant (5 domains × 3-4 actions each)
  - [ ] `serializeItemContext()` function (5 domain serializers)
  - [ ] OpenAI chat completion (no tools)
- [ ] Open question mode:
  - [ ] SEARCH_TOOLS constant (5 tool definitions)
  - [ ] DOMAIN_HINT constant
  - [ ] `getQueryEmbedding()` function
  - [ ] `executeSearch()` function (calls Supabase RPCs)
  - [ ] `formatSearchResults()` function
  - [ ] OpenAI chat completion with tools
  - [ ] Tool result follow-up call
- [ ] Usage increment: `increment_usage` RPC
- [ ] Error handling (auth, validation, OpenAI, search, usage)
- [ ] Deploy: `npx supabase functions deploy ask-product --no-verify-jwt`
- [ ] Test: action mode (1 per domain, 5 total)
- [ ] Test: open question mode (same-domain, cross-domain, no-results)
- [ ] Test: edge cases (missing fields, invalid domain, limit exceeded, unauth)
- [ ] Test: Spanish language response
- [ ] Check edge function logs for errors
- [ ] Run security advisor

---

## Cost & Scaling Notes

- **Cost per question**: ~$0.001-0.002 (gpt-4o-mini is very cheap)
- **44 products**: All fit in search results easily; no pagination needed
- **Tool use overhead**: The two-step flow (initial + follow-up) adds ~500ms but enables smarter search routing
- **Action mode is faster**: No embedding generation or search needed — just a single AI call
- **Rate limits**: OpenAI gpt-4o-mini has generous rate limits; 1000 concurrent users is well within bounds
- **Shared usage counters**: Product AI shares limits with manual AI to prevent abuse

---

## Relationship to Other Phases

```
Phase 5 (/ask-product)
  ↑ depends on
  Phase 2 (tables) + Phase 3 (search functions) + Phase 4 (embeddings)
  ↓ consumed by
  Phase 7 (Wire AI Buttons) — frontend calls this endpoint
```

Phase 6 (Wire Viewers to Database) and Phase 7 (Wire AI Buttons) can run in parallel after Phase 5 is complete.
