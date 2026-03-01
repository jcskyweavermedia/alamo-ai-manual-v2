# Fix: Bar Prep First-Message Prompt Routing

## Problem

When a user clicks "Bar Prep" and sends their first message, the edge function uses **kitchen** prep prompts instead of bar-specific ones. This happens because the draft is empty `{}` on the first turn, so `currentDraft.department` is `undefined` and the `isBarPrep` check fails.

The fix: send `department` from the frontend alongside `productTable` in the request body, so the edge function knows it's a bar prep session from message 1.

---

## Changes

### 1. Frontend — `use-ingest-chat.ts`

**File**: `src/hooks/use-ingest-chat.ts` (line ~65-70)

The hook already sends `{ content, sessionId, productTable, language }`. Add `department`:

```typescript
// The hook receives activeType from the context/caller
// Derive department from activeType:
const department = activeType === 'bar_prep' ? 'bar' : undefined;

const { data, error: fnError } = await supabase.functions.invoke('ingest', {
  body: {
    content,
    sessionId: sessionId ?? undefined,
    productTable,
    language,
    department,  // NEW — undefined for non-prep types (omitted from JSON)
  },
});
```

The hook needs access to `activeType`. Check how it currently gets `productTable` — it likely receives it as a parameter or from context. Pass `activeType` the same way, or derive `department` in the calling component and pass it as a new param.

### 2. Frontend — `use-file-upload.ts`

**File**: `src/hooks/use-file-upload.ts` (line ~118-125)

Uses `FormData`. Add department:

```typescript
if (department) {
  formData.append('department', department);
}
```

Same derivation: `const department = activeType === 'bar_prep' ? 'bar' : undefined;`

### 3. Edge function — `ingest/index.ts`

**File**: `supabase/functions/ingest/index.ts`

Where the request body is parsed (line ~756):

```typescript
const { content, productTable, language = "en", sessionId: existingSessionId, department: reqDepartment } = body;
```

Where `isBarPrep` is checked (line ~841):

```typescript
// Use request-level department (first message) OR draft-level department (subsequent messages)
const isBarPrep = productTable === "prep_recipes" &&
  ((currentDraft as any).department === "bar" || reqDepartment === "bar");
```

This way:
- **First message**: `currentDraft.department` is undefined, but `reqDepartment` is `"bar"` → bar prompts used
- **Subsequent messages**: `currentDraft.department` is `"bar"` from the draft → bar prompts used
- **Kitchen prep**: `reqDepartment` is undefined, `currentDraft.department` is `"kitchen"` or undefined → kitchen prompts used

### 4. Edge function — `ingest-vision/index.ts`

**File**: `supabase/functions/ingest-vision/index.ts`

Parse from FormData:

```typescript
const department = formData.get("department") as string | null;
```

Use for prompt selection if this function selects prompts (check — it may use a single-call pipeline that doesn't need prompt routing). If it does need it, apply the same `isBarPrep` logic.

### 5. Edge function — `ingest-file/index.ts`

Same as ingest-vision — parse from FormData and use for prompt selection.

---

## Files Summary

| # | File | Action | What |
|---|------|--------|------|
| 1 | `src/hooks/use-ingest-chat.ts` | Edit | Add `department` to request body |
| 2 | `src/hooks/use-file-upload.ts` | Edit | Add `department` to FormData |
| 3 | `supabase/functions/ingest/index.ts` | Edit | Parse `department` from body, use in `isBarPrep` check |
| 4 | `supabase/functions/ingest-vision/index.ts` | Edit | Parse `department` from FormData |
| 5 | `supabase/functions/ingest-file/index.ts` | Edit | Parse `department` from FormData |

**5 files edited, 0 new files, 0 migrations.**

---

## Verification

1. Click "Bar Prep" → send first message "I want to make a honey-ginger syrup"
2. Check edge function logs — should show bar prep prompt slug (`ingest-chat-bar-prep`), not kitchen
3. AI response should use bar language ("What's the syrup ratio?" not "What kind of sauce?")
4. Kitchen prep still works — click "Prep Recipe" → first message uses kitchen prompts
5. Cocktails unaffected — `department` is undefined for non-prep product types
