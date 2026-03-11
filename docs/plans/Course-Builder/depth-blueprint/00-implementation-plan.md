# Blueprint-Driven Course Builder — Implementation Plan

## Context

The Course Builder's 3-pass AI pipeline produces card-heavy, content-less layouts because Pass 3 (layout architect) has a system prompt that tells it to "transform prose into visual elements" with hard rules like "at least 1 card_grid per section." The AI interprets `content` elements as "not doing its job" and skips them entirely. The `elementDensityNote` for the quick tier explicitly name-drops card_grid, comparison, and script_block but never mentions `content`. Result: 8-9 elements per section (target: 2-4), zero main content blocks, all cards and features.

**Fix**: Move element-type decisions from Pass 3 → Pass 1. Separate prompt concerns into composable layers (Direction + Depth + Tone) so the system scales to future wizard types without prompt explosion. Pass 3 becomes a formatter that follows blueprints.

---

## 3-Layer Prompt Architecture

### The Layers

| Layer | Controls | Set by | Lives in | Changes per... |
|-------|----------|--------|----------|----------------|
| **Direction** | What to teach, audience, focus areas | Wizard type picker | DB prompt: `{wizard}-pass1` | Wizard type |
| **Depth** | Blueprint structure, element counts, word budgets, accent rules | Depth selector | Code constant: `DEPTH_BLUEPRINTS[tier]` | Tier |
| **Tone** | Teaching voice, formality | Teacher level selector | User message: `TEACHER LEVEL: friendly` | Teacher level |

### How Layers Flow Through the Pipeline

```
                    PASS 1              PASS 2              PASS 3
                    (Architect)         (Writer)            (Formatter)

DIRECTION           ✅ System prompt    ✅ Implicit via     ❌ Doesn't care
(what to teach)     DB: {wizard}-pass1  course_type +       Just plugging
                                        brief from Pass 1   content into slots

DEPTH               ✅ User message     ✅ User message     ✅ User message
(how much)          Blueprint template  Word target          element_blueprint
                    + section count     (50 vs 400 vs 800)   from draft_content

TONE                ❌ Doesn't care     ✅ User message     ❌ Doesn't care
(how to say it)     Structure is the    TEACHER LEVEL:       Tone is already
                    same regardless     friendly/strict      baked into prose
```

### Composition at Runtime (Pass 1)

```
System prompt  = fetchPromptBySlug("{wizard}-pass1")     ← DIRECTION (DB)
User message   = DEPTH_BLUEPRINTS[tier]                  ← DEPTH (code)
               + wizard context (title, description)
               + WORD BUDGET block
               + source material
               + "Return JSON matching the schema."

Fallback: if {wizard}-pass1 not found → course-structure-planner (generic)
```

### Scaling Math

```
Old plan (combined slugs):  4 prompts × N wizard types = 4N prompts
New plan (layered):         1 prompt × N wizard types + 4 code constants = N + 4

With 6 wizard types:  Old = 24 DB prompts    New = 6 DB prompts + 4 constants
Adding a wizard:      Old = +4 DB rows       New = +1 DB row
Changing depth rules: Old = update N prompts  New = 1 code change
```

---

## Architecture Change

```
BEFORE:
  Pass 1 → page_header + sections[title, brief, target_words]
  Pass 2 → prose per section (unchanged)
  Pass 3 → AI FREELY decides all elements (broken)

AFTER:
  Pass 1 → page_header + sections[title, brief, target_words, element_blueprint[]]
  Pass 2 → prose per section (unchanged)
  Pass 3 → Follows blueprint exactly, fills content into predetermined slots
```

### Prompt Slugs

```
Pass 1: {wizard}-pass1             ← 1 per wizard type (DIRECTION only)
        + DEPTH_BLUEPRINTS[tier]   ← code constant in user message

Pass 2: course-content-writer      ← shared (already depth-agnostic)

Pass 3: course-pass3-formatter     ← shared (blueprint-driven, no design rules)

Current DB prompts to create:
  menu-rollout-pass1       (direction for menu rollouts)
  course-pass3-formatter   (replaces course-pass2-layout-architect)

Future (just add 1 prompt per wizard, no code changes):
  sop-review-pass1
  steps-of-service-pass1
  line-cook-pass1
  ...
```

Fallback: if `{wizard}-pass1` not found → `course-structure-planner` (generic).

---

## Section Blueprints by Tier (Code Constants)

### Quick (light) — 3 elements/section
```
Per section:
  1. section_header        ← REQUIRED, always first
  2. content               ← REQUIRED, main body, rich markdown
  3. ONE accent element    ← AI picks: card_grid | feature | comparison | script_block
                              MUST differ from previous section's accent
```

### Standard — 4-6 elements/section
```
Per section:
  1. section_header           ← REQUIRED
  2. content                  ← REQUIRED, main body
  3. 1-2 accent elements      ← AI picks types, varies across sections
  4. content OR feature(key_point) to close  ← AI decides
```

### Deep — 5-8 elements/section
```
Per section:
  1. section_header                ← REQUIRED
  2-N. Multiple content + accents  ← AI orders for best flow
  Last. feature(key_point)         ← REQUIRED to close
```

### Custom
```
  - AI sees examples of all 3 tier blueprints as reference
  - Reads the user's custom prompt (from wizard_config.depth_custom_prompt)
  - Decides best blueprint per user intent + best practices
  - Hard constraint: every section MUST have section_header + at least 1 content
```

---

## Files to Modify

| # | File | Change |
|---|------|--------|
| 1 | `supabase/migrations/YYYYMMDD_blueprint_prompts.sql` | **NEW** — 1 `menu-rollout-pass1` direction prompt + 1 `course-pass3-formatter` + deactivate old |
| 2 | `supabase/functions/_shared/course-builder.ts` | Update `STRUCTURE_PLAN_SCHEMA` (add `element_blueprint`), update `parseStructurePlanResponse()`, add `validateBlueprintCompliance()`, add `DEPTH_BLUEPRINTS` constant |
| 3 | `supabase/functions/build-course/index.ts` | Update `handleStructurePlan()` (layered prompt composition + persist blueprint), update `handlePass3()` (new prompt + blueprint user message + compliance check) |
| 4 | `docs/plans/Course-Builder/depth-blueprint/` | This plan + `01-prompt-architecture.md` |

No frontend changes needed. No schema migrations needed (blueprint lives in existing `draft_content` JSONB).

---

## Detailed Changes

### Task 1: Migration — Direction Prompt + Formatter Prompt

**File**: `supabase/migrations/YYYYMMDD_blueprint_prompts.sql` (new)

Insert 2 new prompts. Keep old prompt ACTIVE for backward compat fallback.

#### `menu-rollout-pass1` (Direction — what makes a rollout course a rollout)

System prompt for Pass 1 when wizard=menu_rollout. Direction ONLY — no depth/element guidance:
```
You are a course architect for a restaurant training platform.

ROLLOUT COURSES are pre-shift operational briefings for FOH staff
(servers, bartenders, hosts — tips-motivated, reading on phones).

ROLLOUT FOCUS:
- The app has dedicated PRODUCT VIEWERS for every menu item showing
  recipes, selling approach, and allergens. Staff learn PRODUCTS from
  product viewers — not from your training narrative.
- YOUR job is the OPERATIONAL WRAPPER: what's new, why it matters,
  how service changes today, timing, availability, and the one
  non-negotiable rule.
- Always include a FAILURE PATH: what to say when it sells out,
  wrong time, allergy concern, or guest confusion.
- Include exact SERVICE LANGUAGE staff can memorize.
- Title style: punchy, Apple-keynote-inspired. Use | pipe for
  light|bold title splits.

Design a course structure with a page_header and logical sections.
Follow the SECTION BLUEPRINT in the user message for element structure.
Return JSON matching the schema.
```

#### `course-pass3-formatter` (Replaces `course-pass2-layout-architect`)

New identity: "content formatter" not "visual architect."
- Element type reference (condensed definitions, field specs only)
- Markdown style guide (kept from old prompt — still relevant for `content` elements)
- NO design rules (no "at least 1 card_grid", no "end with key_point")
- Key instruction: "Follow the ELEMENT BLUEPRINT exactly. Do not add, remove, or reorder elements. Your job is to fill each slot with content from the prose."
- Fallback mode: when no blueprint provided, use the prose to decide elements freely (backward compat)

#### Old prompt: KEEP ACTIVE
~~`UPDATE public.ai_prompts SET is_active = false WHERE slug = 'course-pass2-layout-architect';`~~
**AUDIT FIX (B3)**: Do NOT deactivate. The backward-compat fallback in `handlePass3()` needs it
for courses without blueprints. Deactivate later when all wizard types have direction prompts.

---

### Task 2: Schema + Parser + Validator + Depth Constants

**File**: `supabase/functions/_shared/course-builder.ts`

#### 2A. Add `DEPTH_BLUEPRINTS` constant (new)

Code constants injected into Pass 1 user message. Each is a multi-line string:

```typescript
export const DEPTH_BLUEPRINTS: Record<string, string> = {
  quick: `SECTION BLUEPRINT (quick tier):
Target: 1-3 sections, ~300 words total.

Each section MUST follow this exact structure:
  1. section_header — always first
  2. content — main body. ALL section information goes here. Use rich markdown
     (## headings, **bold**, bullets, > blockquotes). This IS the section.
  3. ONE accent element — pick the BEST fit for this section's content:
     • card_grid (variant: icon_tile) if there are 3+ parallel facts to display
     • script_block if there is guest-facing dialogue or service language
     • comparison (variant: miss_fix) if there is a right/wrong contrast
     • feature (variant: standout|tip|key_point) if there is a non-negotiable rule or callout

ACCENT ROTATION RULE: Each section's accent type MUST differ from the previous
section's accent. You see all sections — enforce this.

Output element_blueprint per section: exactly 3 items in the order above.
Write a 1-sentence brief per section.`,

  standard: `SECTION BLUEPRINT (standard tier):
Target: 3-6 sections, ~2400 words total.

Each section MUST follow this structure:
  1. section_header — always first
  2. content — main body with rich markdown
  3. 1-2 accent elements — AI picks types, vary across sections:
     • card_grid (icon_tile | menu_item) for parallel facts or menu items
     • script_block for guest-facing dialogue
     • comparison (correct_incorrect | miss_fix) for right/wrong contrasts
     • feature (any variant) for callouts, rules, tips
  4. Optional closing: content block OR feature(key_point)

Vary accent types across consecutive sections. 4-6 elements per section total.
Write 2-3 sentence briefs.`,

  deep: `SECTION BLUEPRINT (deep tier):
Target: 5-9 sections, ~5400 words total.

Each section MUST include:
  1. section_header — always first
  2-N. Multiple content blocks interspersed with 2-4 accent elements.
       You have full ordering freedom. Use the full element palette:
       content, card_grid, script_block, comparison, feature, media.
  Last. feature(key_point) — REQUIRED to close every section.

5-8 elements per section. No two content blocks back-to-back without a
visual element between them. Write 3-4 detailed sentence briefs.`,

  custom: `SECTION BLUEPRINT (custom tier):
The admin provided a custom depth prompt (see CUSTOM INSTRUCTIONS below).

REFERENCE — here are our standard blueprints:
• Quick: section_header → content → 1 accent. 3 elements/section, 1-3 sections.
• Standard: section_header → content → 1-2 accents → optional closing. 4-6 elements/section, 3-6 sections.
• Deep: section_header → multiple content+accents → feature(key_point). 5-8 elements/section, 5-9 sections.

Read the custom instructions and decide the best blueprint. You may mix approaches.
HARD RULES (cannot be overridden by custom prompt):
  - Every section MUST start with section_header
  - Every section MUST have at least 1 content element
  - Output element_blueprint per section`,
};
```

#### 2B. Update `STRUCTURE_PLAN_SCHEMA` (line 874)

Add `element_blueprint` to section items:
```typescript
element_blueprint: {
  type: "array",
  items: {
    type: "object",
    properties: {
      type: { type: "string", enum: ["content","feature","section_header","card_grid","comparison","script_block","media"] },
      variant: { anyOf: [{ type: "string" }, { type: "null" }] },
    },
    required: ["type"],
    additionalProperties: false,
  },
},
```
**AUDIT FIX (B1)**: Do NOT add to `required` array — keep OPTIONAL. The generic
`course-structure-planner` fallback has no blueprint guidance; making it required would
force the AI to fabricate blueprints with no instruction. Optional means: when a
direction prompt provides blueprint guidance → AI returns it (structured output
includes it in properties). When fallback prompt is used → AI may omit it → Pass 3
falls back to old behavior. Win-win.

#### 2C. Update `StructurePlanSection` interface + `parseStructurePlanResponse()`

**AUDIT FIX (B2)**: Add `element_blueprint` to the TypeScript interface:
```typescript
export interface StructurePlanSection {
  // ... existing fields ...
  element_blueprint?: Array<{ type: string; variant?: string }>;
}
```

In the section parsing loop, extract and validate `element_blueprint` with type whitelist:
```typescript
const VALID_ELEMENT_TYPES = new Set(["content","feature","section_header","card_grid","comparison","script_block","media"]);

element_blueprint: Array.isArray(sec.element_blueprint)
  ? sec.element_blueprint.filter((bp: any) => bp.type && typeof bp.type === 'string' && VALID_ELEMENT_TYPES.has(bp.type))
  : undefined,
```

#### 2D. Add `validateBlueprintCompliance()` (new export)

**AUDIT FIX (B4)**: Run compliance against RAW AI output (before `parsePass2Response()` strips elements).
Pass the raw `elements` array from the AI response, not the post-parsed array.

Compares Pass 3 output against the blueprint:
- Check element count matches (excluding page_header)
- Check element types match in order
- Check variants match where specified
- Check every section has at least 1 `content` element (custom tier hard rule)
- Returns `{ valid: boolean, issues: string[], severity: 'ok' | 'warn' | 'fail' }`
- `ok`: exact match or ±1 element
- `warn`: ±2 elements or type mismatch — log and proceed
- `fail`: >2 element diff OR missing content element — triggers 1 server-side retry

---

### Task 3: Edge Function Wiring

**File**: `supabase/functions/build-course/index.ts`

#### 3A. Update `handleStructurePlan()` (line 2218)

**AUDIT FIX (B5)**: Default to generic, not menu_rollout:

**Prompt selection** — direction layer from DB:
```typescript
const wizardType = course.course_type || "custom"; // AUDIT FIX: generic default, not menu_rollout
const normalizedWizard = wizardType.replace(/_/g, "-");
const directionSlug = `${normalizedWizard}-pass1`;
let systemPrompt = await fetchPromptBySlug(supabase, directionSlug, language);
if (!systemPrompt) {
  systemPrompt = await fetchPromptBySlug(supabase, "course-structure-planner", language) || "...fallback...";
}
```

**User message** — depth layer from code constant:
```typescript
import { DEPTH_BLUEPRINTS } from "../_shared/course-builder.ts";

const blueprintBlock = DEPTH_BLUEPRINTS[depthConfig.tier] || DEPTH_BLUEPRINTS.standard;
const customInstructions = depthConfig.tier === "custom" && depthConfig.customPrompt
  ? `\nCUSTOM INSTRUCTIONS:\n"${depthConfig.customPrompt}"`
  : "";

const userMessage = `${wizardContext}

${blueprintBlock}${customInstructions}

${wordBudgetBlock}

SOURCE MATERIAL:
${material.text}

Design a course structure. Return JSON matching the schema.
- Create a compelling page_header (hero) with badge, title (use | for light|bold split), tagline, and icon.
- Follow the SECTION BLUEPRINT above for section count and element structure.
- Include source_hints listing which source IDs are most relevant to each section.
- Set target_words for each section based on the WORD BUDGET above.`;
```

Remove: old `depthConstraints`, `briefStyleLine`, `buildDepthConstraints()` call from user message (depth is now in the blueprint block).

**Persist blueprint** — in section row creation (line 2346), add `element_blueprint` to `draft_content`:
```typescript
draft_content: {
  brief_en: sec.brief_en,
  source_hints: sec.source_hints || [],
  target_words: sec.target_words,
  element_blueprint: sec.element_blueprint || undefined,
},
```

#### 3B. Update `handlePass3()` (line 2981)

**Prompt selection** — try new formatter first, fall back to old:
```typescript
const systemPrompt = await fetchPromptBySlug(supabase, "course-pass3-formatter", language) ||
  await fetchPromptBySlug(supabase, "course-pass2-layout-architect", language) ||
  "You are a content formatter for restaurant training courses.";
```

**User message** — when blueprint exists, inject it and omit depth constraints:
```typescript
const blueprint = prose.element_blueprint as Array<{ type: string; variant?: string }> | undefined;

let blueprintBlock = "";
if (blueprint && blueprint.length > 0) {
  blueprintBlock = `\nELEMENT BLUEPRINT (follow EXACTLY — do not add, remove, or reorder):
${blueprint.map((bp, i) => `  ${i + 1}. ${bp.type}${bp.variant ? ` (variant: ${bp.variant})` : ""}`).join("\n")}

You MUST produce exactly ${blueprint.length} elements in this order.
Fill each slot with content from the prose below.
Do NOT add extra elements. Do NOT skip elements. Do NOT reorder.
The content element is the MAIN body — put the bulk of information there using rich markdown.`;
}
```

When no blueprint (backward compat), keep current depth constraints behavior.

**AUDIT FIX (B6)**: Add 1 server-side retry instead of relying on (nonexistent) client retry:

**Post-processing** — BEFORE `parsePass2Response()`, run `validateBlueprintCompliance()` on raw AI elements:
- `ok` → proceed to parsePass2Response() and return
- `warn` → log issues, proceed to parsePass2Response() and return
- `fail` → re-call Claude ONCE with correction note appended:
  `"Your previous output had these issues: [issues]. Please try again following the blueprint EXACTLY."`
  If retry also fails → log, proceed with best-effort result (never hard-fail for the user)

#### 3C. Simplify `getDepthConfig()` and `buildDepthConstraints()`

Keep for backward compat (no-blueprint fallback path) but:
- Remove element-type recommendations from `elementDensityNote`
- These are now only used when a wizard type has no direction prompt and falls back to the old generic flow

---

### Task 4: Documentation

**Directory**: `docs/plans/Course-Builder/depth-blueprint/`

- `00-implementation-plan.md` — This plan (already created)
- `01-prompt-architecture.md` — Layered prompt system docs:
  - How to add a new wizard type (insert 1 DB prompt)
  - How to modify depth rules (edit DEPTH_BLUEPRINTS constant)
  - Layer diagram showing Direction × Depth × Tone flow
  - Element type reference for prompt authors

---

## Agent Parallelization

```
┌─────────────────────────────────────────────────────────┐
│  Agent 1: PROMPT ENGINEERING                            │
│  Write 2 DB prompts in migration SQL:                   │
│    - menu-rollout-pass1 (direction)                     │
│    - course-pass3-formatter                             │
│  File: new migration                                    │
│  Dependencies: NONE (pure text)                         │
│  Can start: IMMEDIATELY                                 │
├─────────────────────────────────────────────────────────┤
│  Agent 2: SCHEMA + DEPTH CONSTANTS + VALIDATOR          │
│  - Add DEPTH_BLUEPRINTS constant (4 tier templates)     │
│  - Update STRUCTURE_PLAN_SCHEMA (add element_blueprint) │
│  - Update parseStructurePlanResponse()                  │
│  - Add validateBlueprintCompliance()                    │
│  File: course-builder.ts                                │
│  Dependencies: NONE                                     │
│  Can start: IMMEDIATELY (parallel with Agent 1)         │
├─────────────────────────────────────────────────────────┤
│  Agent 3: EDGE FUNCTION WIRING                          │
│  - Update handleStructurePlan() — layered composition   │
│  - Update handlePass3() — blueprint user msg + check    │
│  File: build-course/index.ts                            │
│  Dependencies: Agent 2 (needs DEPTH_BLUEPRINTS import)  │
│  Starts after: Agent 2 completes                        │
├─────────────────────────────────────────────────────────┤
│  Agent 4: DOCS                                          │
│  Write 01-prompt-architecture.md                        │
│  Directory: docs/plans/Course-Builder/depth-blueprint/  │
│  Dependencies: NONE                                     │
│  Can start: IMMEDIATELY (parallel with all)             │
└─────────────────────────────────────────────────────────┘

Execution: Agents 1, 2, 4 in parallel → Agent 3 after Agent 2 completes
Deploy:    echo y | npx supabase db push && npx supabase functions deploy build-course --no-verify-jwt
```

---

## Verification

1. **Migration clean**: `echo y | npx supabase db push` succeeds
2. **Prompts active**: `SELECT slug, is_active FROM ai_prompts WHERE slug IN ('menu-rollout-pass1', 'course-pass3-formatter')` → 2 active rows
3. **Old prompt still active**: `course-pass2-layout-architect` → `is_active = true` (kept for backward compat)
4. **Quick tier test**: Build menu_rollout course with quick depth
   - Verify 1-3 sections
   - Each section has exactly: section_header + content + 1 accent
   - Content block has rich markdown (headings, bullets, bold)
   - Accent types differ across sections
5. **Standard tier test**: 3-6 sections, 4-6 elements each, content leads
6. **Deep tier test**: 5-9 sections, key_point closing, rich element variety
7. **Custom tier test**: Custom prompt "Make a 2-section cheat sheet" produces reasonable blueprint
8. **Backward compat**: Course with `course_type = 'sop_review'` (no direction prompt yet) falls back to `course-structure-planner` + old Pass 3 behavior
9. **Translation**: After layout, run 🌐 Translate — works unchanged
10. **Page header**: Still deterministically prepended to section 0 from `course.page_header_data`

---

## Risks

| Risk | Level | Mitigation |
|------|-------|------------|
| AI ignores blueprint in Pass 3 | Medium | `validateBlueprintCompliance()` runs on raw output; 1 server-side retry on `fail`; never hard-fails for user |
| AI omits element_blueprint in Pass 1 | Low | Schema has it in `properties`; direction prompts instruct it; generic fallback gracefully omits it |
| Old courses without blueprint | None | Pass 3 falls back to free-form when blueprint absent; old prompt stays active |
| Token budget for Pass 1 | Low | Blueprint text adds ~200 tokens to user message; well within limits |
| Custom tier produces bad blueprints | Low | Hard constraint: must have section_header + content; user can switch to named tier |
| Future wizards need direction prompts | Expected | Insert 1 `{wizard}-pass1` row; depth blueprints are shared code |
| Pass 2 needs direction awareness later | Low | Currently brief from Pass 1 carries enough context; can add `{wizard}-pass2` slugs later if needed |

---

## Pre-Implementation Audit Log (2026-03-11)

4 Opus agents audited this plan. 6 blockers found and resolved:

| # | Blocker | Source | Resolution |
|---|---------|--------|------------|
| B1 | `element_blueprint` as `required` breaks generic fallback | DB Expert | Made optional in schema |
| B2 | `StructurePlanSection` interface missing field | Architect, DB Expert | Added to interface update in Task 2C |
| B3 | Migration deactivates old prompt but fallback needs it | Devil's Advocate | Keep old prompt ACTIVE |
| B4 | Parser strips elements before compliance check | Architect, Devil's Advocate | Run compliance on raw AI output |
| B5 | `course_type \|\| "menu_rollout"` wrong default | Devil's Advocate | Changed to `"custom"` (generic) |
| B6 | No retry mechanism — "triggers retry" was fictional | Devil's Advocate | Added 1 server-side retry on `fail` |

Additional audit notes (non-blocking, addressed in implementation):
- `draft_content` blueprint survival through Pass 2 is via spread — add explicit comment
- Custom tier hard rules are prompt-only — validator also checks for `content` presence
- Accent rotation is best-effort (AI instruction only, not code-enforced)
- UX: `content(lead)` variant not in blueprint vocab — future enhancement
- UX: Per-section word caps recommended for standard/deep — added to blueprint text
- Deep tier mandatory `key_point` closing creates repetition — accepted trade-off for pedagogy
