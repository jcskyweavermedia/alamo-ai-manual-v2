# Prompt Architecture: Direction + Depth + Tone

Reference for developers maintaining the course builder's 3-layer composable prompt system.

---

## 1. Overview

The course builder uses a 3-layer prompt architecture that separates concerns so new wizard types can be added with a single DB row instead of rewriting prompts across all passes.

| Layer | Controls | Source | Location | Changes per |
|-------|----------|--------|----------|-------------|
| **Direction** | What to teach: audience, focus areas, title style | 1 DB prompt per wizard type | `ai_prompts` table, slug `{wizard}-pass1` | Wizard type |
| **Depth** | How much: section count, word budget, element structure | 4 code constants shared across all wizards | `DEPTH_BLUEPRINTS[tier]` in `course-builder.ts` | Depth tier |
| **Tone** | How to say it: formality, teaching voice | Already in user message | `TEACHER LEVEL: friendly\|professional\|strict` | Teacher level |

The key insight: Direction and Depth are orthogonal. A "menu rollout" wizard and a "SOP review" wizard teach different things but share the same depth structure at a given tier. This means adding a wizard type requires one new Direction prompt, zero Depth changes.

---

## 2. Layer Flow Through the Pipeline

```
                    PASS 1              PASS 2              PASS 3
                    (Structure Planner) (Content Writer)    (Formatter)

DIRECTION           System prompt       Implicit via        N/A
(what to teach)     DB: {wizard}-pass1  course_type +       Formats content
                                        brief from Pass 1   into element slots

DEPTH               User message        User message        User message
(how much)          DEPTH_BLUEPRINTS    target_words        element_blueprint
                    + section count     per section          from draft_content

TONE                N/A                 User message        N/A
(how to say it)     Structure is the    TEACHER LEVEL:      Tone is already
                    same regardless     friendly/strict      baked into prose
```

### Pass 1 (Structure Planner)

Receives Direction as the system prompt (fetched from DB) and Depth as part of the user message (injected from `DEPTH_BLUEPRINTS[tier]`). Outputs `page_header` + `sections[]`, where each section includes `title_en`, `brief_en`, `target_words`, `source_hints`, and `element_blueprint[]`.

The `element_blueprint` is an ordered array of `{ type, variant? }` objects that prescribes the exact element structure for each section. Pass 1 decides this based on the Depth tier rules and the section's content needs.

Composition at runtime:
```
system_prompt  = fetchPromptBySlug("{wizard}-pass1")     <- DIRECTION (DB)
user_message   = DEPTH_BLUEPRINTS[tier]                  <- DEPTH (code)
               + wizard context (title, description)
               + WORD BUDGET block
               + source material
               + "Return JSON matching the schema."

Fallback: if {wizard}-pass1 not found -> course-structure-planner (generic)
```

### Pass 2 (Content Writer)

Receives the brief and target word count from Pass 1. Direction is implicit (the brief already reflects the wizard type). Depth manifests as the word target per section (e.g., 150 words for quick vs. 700 for deep). Tone is injected via `TEACHER LEVEL` in the user message.

Outputs `content_en` and `teaching_notes` per section. The `element_blueprint` from Pass 1 survives through Pass 2 via a spread merge of `draft_content` in `handleContentWrite` -- the writer adds `content_en`/`teaching_notes` to the existing `draft_content` object without overwriting `element_blueprint`.

### Pass 3 (Formatter)

Receives `element_blueprint` from `draft_content` (persisted through Pass 2). When a blueprint exists, the system prompt is `course-pass3-formatter` and the user message includes the blueprint as an ordered list with instructions to follow it exactly. The formatter fills each slot with content from the prose -- it does not decide element types or ordering.

When no blueprint exists (backward compatibility with older courses or wizard types without direction prompts), Pass 3 falls back to `course-pass2-layout-architect` and the old free-form behavior.

After the AI returns elements, `validateBlueprintCompliance()` runs on the raw output (before `parsePass2Response()` strips invalid elements):
- `ok` -- exact match or +/-1 element. Proceed.
- `warn` -- +/-2 elements or type mismatch. Log and proceed.
- `fail` -- >2 element difference or no `content` element when blueprint requires one. Triggers 1 server-side retry with a correction note appended. If the retry also fails, proceeds best-effort (never hard-fails for the user).

---

## 3. How to Add a New Wizard Type

1. **Create a direction prompt** in a new migration:

```sql
INSERT INTO public.ai_prompts (slug, category, domain, is_active, prompt_en)
VALUES (
  'sop-review-pass1',
  'system', NULL, true,
  E'You are a course architect for a restaurant training platform.\n\n[Describe WHAT this wizard teaches, WHO the audience is, WHAT to focus on, and title style.]\n\nDesign a course structure with a page_header and logical sections.\nFollow the SECTION BLUEPRINT in the user message for element structure.\nReturn JSON matching the schema.'
)
ON CONFLICT (slug) DO UPDATE SET
  prompt_en = EXCLUDED.prompt_en,
  is_active = EXCLUDED.is_active;
```

2. **Rules for the direction prompt**:
   - Describe WHAT to teach for this wizard type, the audience, focus areas, and title style.
   - Do NOT mention element structure, section counts, word budgets, or depth tiers. That comes from `DEPTH_BLUEPRINTS`.
   - MUST include the sentence: "Follow the SECTION BLUEPRINT in the user message for element structure."
   - MUST end with: "Return JSON matching the schema."

3. **Slug convention**: `{wizard-type}-pass1` where `wizard-type` uses hyphens (the code normalizes underscores to hyphens via `course_type.replace(/_/g, "-")`).

4. **Fallback**: If no direction prompt exists for a `course_type`, the system falls back to `course-structure-planner` (the generic prompt). This means new wizard types work immediately with generic output -- the direction prompt just improves quality.

5. **No code changes required**. The edge function dynamically constructs the slug from `course.course_type` and fetches it from the DB.

---

## 4. How to Modify Depth Rules

Edit `DEPTH_BLUEPRINTS` in `supabase/functions/_shared/course-builder.ts`. Search for `DEPTH_BLUEPRINTS` to find the constant.

```typescript
export const DEPTH_BLUEPRINTS: Readonly<Record<string, string>> = Object.freeze({
  quick:    "...",  // 1-3 sections, ~300 words, 3 elements/section
  standard: "...",  // 3-6 sections, ~2400 words, 4-6 elements/section
  deep:     "...",  // 5-9 sections, ~5400 words, 5-8 elements/section
  custom:   "...",  // Shows all 3 tiers as reference + admin's custom prompt
});
```

Key properties each tier blueprint controls:
- **Target section count** -- range the AI should aim for
- **Total word budget** -- approximate total across all sections
- **Per-section word cap** -- prevents any single section from dominating
- **Element structure** -- ordered list of element types per section (section_header, content, accents, closing)
- **Accent rotation rule** -- whether consecutive sections must use different accent types
- **Brief style** -- number of sentences for the section brief

Changes to `DEPTH_BLUEPRINTS` affect ALL wizard types automatically. Deploy with:
```bash
npx supabase functions deploy build-course --no-verify-jwt
```

The `custom` tier is special: it shows all three standard blueprints as reference, then reads the admin's custom prompt from `wizard_config.depth_custom_prompt`. Hard rules that cannot be overridden by custom prompts:
- Every section MUST start with `section_header`
- Every section MUST have at least 1 `content` element
- Must output `element_blueprint` per section

---

## 5. Element Type Reference for Prompt Authors

These are the 7 element types available in blueprints. When writing direction prompts or modifying depth blueprints, use these type names and their variants exactly.

### 5.1 `section_header`

Section divider. Always the first element in every section.

| Field | Required | Description |
|-------|----------|-------------|
| `title_en` | Yes | Section title |
| `number_label` | No | e.g. "01", "02" |
| `subtitle_en` | No | Short subtitle under the title |

### 5.2 `content`

Rich markdown body. The primary information container. Most section content should live here, not split across cards or features.

| Field | Required | Description |
|-------|----------|-------------|
| `body_en` | Yes | Markdown content (supports ##, **, bullets, > blockquotes) |
| `lead` | No | Boolean. When true, renders as an introductory paragraph with distinct styling. Not controlled by blueprints -- Pass 3 decides. |
| `variant` | No | Not commonly used |

### 5.3 `card_grid`

Parallel facts or items displayed as cards. Use when there are 3+ related items to show side by side.

| Variant | Use case |
|---------|----------|
| `icon_tile` | Parallel facts with icons (default) |
| `menu_item` | Menu items with descriptions |
| *(none)* | Falls back to icon_tile |

| Field | Required | Description |
|-------|----------|-------------|
| `cards` | Yes | Array of card objects. Limit 3-5 cards per grid. |
| `columns` | No | Number of columns (default: auto) |

Each card: `{ icon, icon_bg, title_en, body_en }`

### 5.4 `comparison`

Right/wrong contrasts. Two variants with different data shapes.

| Variant | Use case | Data shape |
|---------|----------|------------|
| `correct_incorrect` | Binary right vs. wrong | `positive` + `negative` objects |
| `miss_fix` | Paired miss-then-fix items | `pairs[]` array |

For `correct_incorrect`:
- `positive`: `{ tag_en, title_en, items_en[] }`
- `negative`: `{ tag_en, title_en, items_en[] }`

For `miss_fix`:
- `pairs[]`: `{ tag_en, items_en[] }`

### 5.5 `feature`

Visual callout for a single important point. Seven variants:

| Variant | Use case |
|---------|----------|
| `standout` | Non-negotiable rule or critical info |
| `tip` | Helpful suggestion |
| `key_point` | Summary or takeaway (often used as section closer in deep tier) |
| `warning` | Caution or safety note |
| `note` | Supplementary information |
| `quote` | Staff quote or guest testimonial |
| `stat` | Key metric or number |

| Field | Required | Description |
|-------|----------|-------------|
| `body_en` | Yes | The callout text |
| `variant` | Yes | One of the variants above |
| `icon` | No | Lucide icon name or emoji |

### 5.6 `script_block`

Memorizable dialogue for guest-facing service language.

| Field | Required | Description |
|-------|----------|-------------|
| `header_en` | Yes | Context line (e.g., "When the guest asks about the special:") |
| `header_icon` | No | Icon for the header |
| `lines[]` | Yes | Array of `{ text_en }` objects, each a line of dialogue |

### 5.7 `media`

Visual placeholder. The course builder creates the slot; actual images are uploaded separately.

| Field | Required | Description |
|-------|----------|-------------|
| `media_type` | Yes | e.g., "image", "video" |
| `image_source` | No | Source hint for the image |
| `caption_en` | No | Caption text |
| `ai_image_prompt` | No | Prompt for AI image generation (future) |

---

## 6. Known Limitations

- **Accent rotation rule is best-effort.** It is an AI instruction in the Depth blueprint, not code-enforced. The AI usually follows it but may repeat accent types in edge cases.

- **Custom tier hard rules are prompt-only.** The `custom` tier blueprint tells the AI that section_header + content are required, but this is enforced by the `validateBlueprintCompliance()` function only after Pass 3 output -- not during Pass 1 planning.

- **`content(lead)` variant is not controlled by blueprints.** Pass 3 decides whether to mark a content element as `lead: true` based on its position. Blueprints specify `content` without distinguishing lead vs. non-lead.

- **Blueprint survival through Pass 2 depends on spread merge.** In `handleContentWrite`, the writer's output (`content_en`, `teaching_notes`) is merged into the existing `draft_content` object via spread. The `element_blueprint` field persists because it is not overwritten. If `handleContentWrite` is refactored to replace `draft_content` entirely instead of merging, blueprints will be lost.

- **Pass 3 has 1 server-side retry on blueprint compliance failure, then proceeds best-effort.** If the AI produces output with severity `fail` (>2 element difference or missing `content` element), it retries once with a correction note. If the retry also fails, the best-effort result is used. The system never hard-fails for the user.

- **Deep tier mandatory `key_point` closing creates repetition.** Every section in the deep tier ends with `feature(key_point)`, which can feel repetitive in courses with many sections. This is an accepted trade-off for consistent pedagogical structure.

---

## 7. File Map

| Purpose | File |
|---------|------|
| DB prompts (direction + formatter) | `supabase/migrations/20260314_blueprint_prompts.sql` |
| Depth constants + blueprint types + validator | `supabase/functions/_shared/course-builder.ts` (search for `DEPTH_BLUEPRINTS`) |
| Blueprint compliance validator | `supabase/functions/_shared/course-builder.ts` (search for `validateBlueprintCompliance`) |
| Structure plan schema (includes `element_blueprint`) | `supabase/functions/_shared/course-builder.ts` (search for `STRUCTURE_PLAN_SCHEMA`) |
| Edge function wiring (handleStructurePlan, handlePass3) | `supabase/functions/build-course/index.ts` |
| Implementation plan | `docs/plans/Course-Builder/depth-blueprint/00-implementation-plan.md` |
