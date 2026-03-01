# Fix: Wire `filter_department` Through search_recipes Tool

## Problem

The AI prompt tells the model to call `search_recipes` with `filter_department: "bar"` during cocktail/bar-prep sessions, but the tool's JSON schema only defines `query` as a parameter. OpenAI's strict mode silently drops the unknown `filter_department` param. The edge function's RPC call also doesn't forward it.

Result: search returns ALL prep recipes (kitchen + bar) instead of just the relevant department.

The DB function already supports `filter_department` (added in migration `20260225200400`). We just need to wire it through the AI tool schema and the RPC call.

---

## Changes

### 1. Update tool schema — `ingest/index.ts`

**File**: `supabase/functions/ingest/index.ts` (line ~693-707)

Add `filter_department` to the `search_recipes` tool parameters:

```typescript
{
  type: "function",
  name: "search_recipes",
  description: "Search existing prep recipes in the database. Use this when the user mentions an ingredient or sub-recipe that might already exist (e.g., 'chimichurri', 'demi-glace', 'compound butter', 'honey-ginger syrup'). Use filter_department to narrow results.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Search query for recipe name or ingredient",
      },
      filter_department: {
        type: "string",
        enum: ["kitchen", "bar"],
        description: "Filter by department. Use 'bar' when searching for syrups, infusions, bitters, shrubs. Use 'kitchen' for sauces, stocks, marinades. Omit to search all.",
      },
    },
    required: ["query"],  // filter_department stays optional
  },
}
```

### 2. Forward param in RPC call — `ingest/index.ts`

**File**: `supabase/functions/ingest/index.ts` (line ~946-956)

Update the handler that processes the AI's `search_recipes` tool call:

```typescript
if (fnName === "search_recipes") {
  try {
    const fnArgs = JSON.parse(fc.arguments);
    const query = fnArgs.query || "";
    const filterDept = fnArgs.filter_department || null;  // NEW
    console.log(`[ingest] search_recipes: "${query}" dept=${filterDept}`);

    const { data, error: rpcError } = await supabase.rpc("search_recipes", {
      search_query: query,
      query_embedding: null,
      result_limit: 5,
      filter_department: filterDept,  // NEW — passes to DB function
    });
    // ... rest unchanged
  }
}
```

That's it. The DB function already handles `filter_department DEFAULT NULL` — when null, returns all; when `'bar'`, returns only bar recipes.

---

## Files Summary

| # | File | Action | What |
|---|------|--------|------|
| 1 | `supabase/functions/ingest/index.ts` | Edit | Add `filter_department` to tool schema + forward in RPC call |

**1 file edited, 0 new files, 0 migrations.**

---

## Verification

1. Open a cocktail builder session
2. Say "Make me a Penicillin with our honey-ginger syrup"
3. Check edge function logs — `search_recipes` should show `dept=bar`
4. Results should only contain bar prep recipes (syrups, infusions, etc.), not chimichurri or demi-glace
5. Open a plate spec session → mention "our chimichurri"
6. `search_recipes` should show `dept=null` (no filter) — returns all recipes
7. Verify bar prep builder: "use our house grenadine" → `search_recipes` with `dept=bar`
