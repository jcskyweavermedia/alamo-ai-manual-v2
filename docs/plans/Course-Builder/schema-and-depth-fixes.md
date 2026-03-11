# Fix Plan: Schema Simplification + Depth Signal Propagation

Two fixes to address the most common course builder failures:
1. **Issue 1**: Pass 3 layout failures ("missing elements array") caused by fat union schema
2. **Issue 2**: Depth setting ignored — "quick" produces in-depth content

---

## Issue 1: Schema Simplification (22 → 3 required fields)

### Problem

`PASS2_SECTION_SCHEMA` in `course-builder.ts` forces every element to declare all 22 fields regardless of type. A simple `content` element must output 17 useless `null` fields. This causes:

1. **AI confusion** → "missing elements array" failures (3/3 retries fail for content-heavy sections)
2. **~8,400 wasted tokens** on null padding per response
3. **Element 1 dropped** → `parsePass2Response` requires `title_en` on ALL elements, but `content` (lead paragraphs) and `media` elements legitimately have no title

### Per-Type Field Requirements

| Type | Universal | Type-Specific Required | Type-Specific Optional |
|------|-----------|----------------------|----------------------|
| **content** | `type`, `key`, `sort_order` | `body_en` | `title_en`, `lead` |
| **feature** | `type`, `key`, `sort_order` | `variant`, `body_en` | `title_en`, `icon` |
| **section_header** | `type`, `key`, `sort_order` | `title_en` | `subtitle_en`, `number_label` |
| **card_grid** | `type`, `key`, `sort_order` | `variant`, `columns`, `cards` (non-empty array) | `title_en` |
| **comparison** | `type`, `key`, `sort_order` | `variant` | `positive`, `negative`, `pairs`, `title_en` |
| **script_block** | `type`, `key`, `sort_order` | `header_en`, `lines` (non-empty array) | `header_icon`, `title_en` |
| **media** | `type`, `key`, `sort_order` | `media_type` | `image_source`, `caption_en`, `ai_image_prompt` |

### Step 1: Slim the Schema `required` Array

**File:** `supabase/functions/_shared/course-builder.ts` (lines 731-738)

**Old:**
```ts
required: [
  "type", "key", "title_en", "sort_order",
  "body_en", "variant", "lead", "icon",
  "columns", "cards", "positive", "negative", "pairs",
  "header_en", "header_icon", "lines",
  "number_label", "subtitle_en",
  "media_type", "image_source", "caption_en", "ai_image_prompt",
],
```

**New:**
```ts
required: ["type", "key", "sort_order"],
```

All 19 removed fields **stay defined** in `properties` — the AI still sees them, it just doesn't have to emit `null` for irrelevant ones. `additionalProperties: false` stays as-is.

**Token savings:** ~560 tokens per section (7 elements × ~16 null fields × ~5 tokens each).

### Step 2: Rewrite `parsePass2Response` with Per-Type Validation

**File:** `supabase/functions/_shared/course-builder.ts` (lines 753-797)

Replace the universal `if (!el.type || !el.key || !el.title_en)` check with per-type validation:

1. **Universal check:** `type` and `key` must exist (drop `title_en` from universal)
2. **Type validity check:** `type` must be in `validTypes`
3. **Per-type switch:**
   - `content` → must have non-empty `body_en`
   - `feature` → must have `variant` and non-empty `body_en`
   - `section_header` → must have non-empty `title_en`
   - `card_grid` → must have non-empty `cards` array and `columns`
   - `comparison` → must have `variant`; if `correct_incorrect`: require `positive`+`negative`; if `miss_fix`: require non-empty `pairs`
   - `script_block` → must have `header_en` and non-empty `lines` array
   - `media` → must have `media_type`
4. **Auto-assign `sort_order`** from loop index if missing or not a number

### Step 3: Add Fallback Parsing (Structural Error Recovery)

**File:** `supabase/functions/_shared/course-builder.ts` (lines 757-760)

Before returning `null` on "missing elements array", attempt recovery:

1. If `json` is an array → wrap: `json = { elements: json }`
2. If `json.elements?.elements` is an array → unwrap one level
3. If `json` has a single key whose value contains an `elements` array → unwrap

Only return `null` if all recovery attempts fail.

### Step 4: Add Response Shape Logging on Failure

**File:** `supabase/functions/_shared/course-builder.ts`

When `parsePass2Response` returns `null`, log:
```ts
console.error("[course-builder] pass2 response shape:", JSON.stringify({
  type: typeof json,
  isArray: Array.isArray(json),
  keys: json && typeof json === 'object' ? Object.keys(json) : [],
  elementsType: typeof json?.elements,
  sample: JSON.stringify(json)?.substring(0, 500),
}));
```

**File:** `supabase/functions/build-course/index.ts` (lines ~2896-2899)

Before returning error, log raw response:
```ts
console.error("[build-course] pass3: raw AI response for section", body.section_id, ":",
  JSON.stringify(aiResponse)?.substring(0, 1000));
```

### Step 5: Update `validateLayoutResponse` (Server Validator)

**File:** `supabase/functions/_shared/course-builder.ts` (lines 1233-1264)

Replace `titledTypes` approach with per-type checks matching Step 2:
- Remove `feature` from `titledTypes` (feature titles are optional)
- Add `body_en` validation for `content` and `feature`
- Add `media_type` validation for `media`
- Add `variant` validation for `feature`
- Keep existing `card_grid`/`comparison`/`script_block` checks

### Step 6: Update `validateLayoutClient` (Frontend Validator)

**File:** `src/hooks/use-build-course.ts` (lines 214-240)

Mirror the same per-type validation from Step 5:
- Remove `feature` from `titledTypes`
- Add `body_en` checks for `content` and `feature`
- Add `media_type` check for `media`
- Keep existing deep-object checks for cards, comparison, script_block

### Risks

| Risk | Level | Mitigation |
|------|-------|------------|
| AI omits fields it shouldn't | Low | Fields stay in `properties`; system prompt describes each type; per-type parser catches missing fields |
| Existing saved data affected | None | `parsePass2Response` already null-strips before saving — stored data is identical |
| Translation pass breaks | None | `TRANSLATION_SCHEMA` references elements by `key`, decoupled from layout schema |
| Old `pass2` handler affected | Positive | Same schema + parser, so it benefits from the fix too |

### Execution Order

1. Schema change (Step 1) — changes what AI produces
2. Parser + fallback + logging (Steps 2-4) — must match new schema immediately
3. Server validator (Step 5) — must match parser
4. Frontend validator (Step 6) — must match server
5. Deploy: `npx supabase functions deploy build-course --no-verify-jwt`
6. Test: Rebuild the failing "Course 2 — Entrée Choice" section

---

## Issue 2: Depth Signal Propagation

### Problem

The depth signal flow is broken — only Pass 1 reads it (for section count), Passes 2 and 3 ignore it completely:

```
User picks "quick" → wizard_config.depth = "quick" → DB ✅
  ↓
Pass 1: reads depth → constrains to 1-3 sections ⚠️ (structural only, briefs are still elaborate)
  ↓
Pass 2: IGNORES depth ❌ — hardcodes 300-800 words, runs full wine/cocktail search augmentation
  ↓
Pass 3: IGNORES depth ❌ — hardcodes "5-8 elements per section"
```

### Step 1: Add `getDepthConfig()` Structured Config

**File:** `supabase/functions/build-course/index.ts` (after `buildDepthConstraints()` at line 2421)

Replace the string-only approach with a structured `DepthConfig` object:

| Field | quick | standard | deep |
|-------|-------|----------|------|
| `sectionRange` | `"1-3"` | `"3-6"` | `"5-9"` |
| `briefStyle` | terse (1 sentence) | standard (2-3 sentences) | detailed (3-4 sentences) |
| `wordCountRange` | `"50-150"` | `"300-800"` | `"600-1200"` |
| `contentStyle` | bullet points / key facts | teaching prose | comprehensive coverage |
| `skipBeverageSearch` | `true` | `false` | `false` |
| `skipStepsSearch` | `true` | `false` | `false` |
| `elementCountRange` | `"2-4"` | `"3-6"` | `"4-8"` |
| `allowedElementTypes` | content, feature, section_header only | all types | all types |
| `elementDensityNote` | Minimal. No script_blocks, comparisons, card_grids | Balanced mix | Rich, full palette |

Add `getMaxTokensForPass()` helper:

| Pass | quick | standard | deep |
|------|-------|----------|------|
| structure_plan | 2048 | 4096 | 4096 |
| content_write | 2048 | 8192 | 12288 |
| layout | 4096 | 16384 | 16384 |

### Step 2: Pass 1 — Brief Tone Guidance

**File:** `supabase/functions/build-course/index.ts` (line ~2287 in `handleStructurePlan`)

Inject brief style directive into user message:
- quick → "Write a single focused sentence brief per section"
- standard → "Write a 2-3 sentence brief per section" (current)
- deep → "Write a 3-4 sentence detailed brief per section"

### Step 3: Pass 2 — Full Depth Injection into `handleContentWrite`

**File:** `supabase/functions/build-course/index.ts` (lines 2535-2808)

#### 3A: Inject depth constraints into user message (after line 2721)

Add `DEPTH CONSTRAINTS` block with:
- Tier name
- Target word count range
- Content style guidance (bullet points vs teaching prose vs comprehensive)

#### 3B: Conditionally skip beverage/steps searches for "quick"

The 5 parallel RPC searches (wines, cocktails, beer_liquor, steps_of_service, dishes):
- **quick** → only run `search_dishes` (same-domain relevance). Skip wines, cocktails, beer_liquor, steps_of_service
- **standard/deep** → run all 5

This prevents wine pairing data from being injected into a quick reference card.

#### 3C: Tier-sensitive `maxTokens`

Replace hardcoded `MAX_TOKENS_CONTENT_WRITE` (8192) with:
- quick: 2048
- standard: 8192
- deep: 12288

### Step 4: Pass 3 — Full Depth Injection into `handlePass3`

**File:** `supabase/functions/build-course/index.ts` (lines 2814-2990)

#### 4A: Load `wizard_config` from course

Add `wizard_config` to the course SELECT (line 2831):
```ts
.select("id, teacher_level, course_type, group_id, page_header_data, wizard_config")
```

#### 4B: Inject depth constraints into user message

Replace hardcoded "Target 5-8 elements" with depth-dynamic:
- quick: "Target 2-4 elements. ONLY use content, feature(key_point), section_header."
- standard: "Target 3-6 elements. Balanced mix."
- deep: "Target 4-8 elements. Full element palette."

#### 4C: Tier-sensitive `maxTokens`

- quick: 4096
- standard: 16384
- deep: 16384

#### 4D: Post-generation element type filter (safety net)

For "quick" tier, strip disallowed element types after parsing:
```ts
if (tier === "quick") {
  parsed.elements = parsed.elements.filter(el => allowed.has(el.type));
}
```

### Step 5: System Prompt Migration

**File:** `supabase/migrations/20260310_depth_signal_propagation.sql` (new)

Update `course-content-writer` prompt to remove hardcoded "300-800 words of rich, teaching-oriented content" and replace with:
```
Write training content following the DEPTH CONSTRAINTS provided in the user message.
Adjust length, format, and density per the depth tier.
```

No changes needed for `course-pass2-layout-architect` (element count is in user message, not system prompt).
No changes needed for `course-structure-planner` (section count override already works).

### Step 6: Frontend — No Changes Needed

- `validateContentWriteClient` minimum 50 chars → fine for all tiers
- `validateLayoutClient` minimum 1 element → fine for all tiers
- Pass 4 (translate) → naturally adapts (shorter content = shorter translations)

### Risks

| Risk | Level | Mitigation |
|------|-------|------------|
| "Quick" produces too little for Pass 3 | Low | 50-word minimum still gives layout enough to work with |
| Existing courses without `depth` | None | Defaults to "standard" (current behavior) |
| "Custom" depth tier | None | Falls back to standard defaults + passes custom prompt |
| Quick element filter leaves 0 elements | Very Low | `section_header` is allowed; retry logic handles edge case |
| Dependency on Issue 1 | None | Fully independent changes |

### Execution Order

1. Add `getDepthConfig()` + `getMaxTokensForPass()` — pure functions, no side effects
2. Pass 1 brief style update
3. Pass 2 depth injection + conditional search + token cap
4. Pass 3 wizard_config load + depth injection + token cap + element filter
5. Migration: update `course-content-writer` prompt
6. Deploy: `echo y | npx supabase db push && npx supabase functions deploy build-course --no-verify-jwt`
7. Test: Build same course as "quick" and "deep" with same source material — verify content density difference

---

## Files Modified (Both Issues Combined)

| # | File | Changes |
|---|------|---------|
| 1 | `supabase/functions/_shared/course-builder.ts` | `PASS2_SECTION_SCHEMA.required` 22→3; `parsePass2Response` rewritten with per-type validation + fallback recovery + shape logging; `validateLayoutResponse` updated per-type |
| 2 | `supabase/functions/build-course/index.ts` | Add `DepthConfig`, `getDepthConfig()`, `getMaxTokensForPass()`. Update `handleStructurePlan` (brief style). Update `handleContentWrite` (depth injection, conditional search, token cap). Update `handlePass3` (wizard_config select, depth injection, token cap, element filter, response logging) |
| 3 | `src/hooks/use-build-course.ts` | `validateLayoutClient` updated to match server per-type validation |
| 4 | `supabase/migrations/20260310_depth_signal_propagation.sql` | New migration: update `course-content-writer` prompt to be depth-agnostic |

## Deploy Sequence

1. Implement Issue 1 (schema + parser + validators) — these are independent
2. Implement Issue 2 (depth config + pass updates + migration) — these are independent
3. Push migration: `echo y | npx supabase db push`
4. Deploy edge function: `npx supabase functions deploy build-course --no-verify-jwt`
5. Test: Rebuild "Mday v8" course — verify:
   - All 3 sections build (no "missing elements" failure)
   - "Quick" depth produces terse bullet-point content, 2-4 elements, no wine pairings
   - Lead content elements (no title) are preserved, not dropped
