# Wizard Depth Selector — Implementation Plan

> **Status**: Ready for implementation
> **Date**: 2026-03-09
> **Depends on**: EN-First Pipeline (Pass 4 translation) — already merged

---

## Problem

The AI course builder generates massive courses by default (8+ sections, dozens of elements) regardless of content scope. A simple Valentine's Day feature menu with 3 items gets the same treatment as a full operational training program. There is no way for the user to control course depth, and two confusing AI instruction fields split across different wizard steps make the experience worse.

## Solution

Add a **Course Depth** step to the wizard where the AI previews what each depth tier would cover, then the user picks one (or goes custom). Simultaneously clean up the wizard: merge the two instruction fields, drop ES fields (Pass 4 handles translation), and fix button styling to match the orange admin theme.

---

## Current Wizard Flow (6 steps)

| Step | Name | Content |
|------|------|---------|
| 0 | Course Details | Title EN, Title ES, Description EN, Description ES |
| 1 | Select Items | SourceMaterialPicker (products + sections) |
| 2 | AI Instructions | Single textarea for ai_instructions |
| 3 | Assessment | QuizModeSelector |
| 4 | Teaching Style | TeacherLevelSelector |
| 5 | Review & Build | Summary + Build button |

## New Wizard Flow (6 steps — restructured)

| Step | Name | Content | Changes |
|------|------|---------|---------|
| 0 | Course Details | Title EN, Rollout Details (merged) | Drop ES fields, merge description + ai_instructions |
| 1 | Select Items | SourceMaterialPicker | No change |
| 2 | **Course Depth** | AI preview + 4 depth cards | **NEW STEP** |
| 3 | Assessment | QuizModeSelector | No change |
| 4 | Teaching Style | TeacherLevelSelector | No change |
| 5 | Review & Build | Updated summary | Add depth to review |

---

## Depth Tiers

| Tier | Sections | Elements/Section | Use Case |
|------|----------|-------------------|----------|
| `quick` | 3–4 | 2–4 | Quick briefing, feature highlight |
| `standard` | 5–6 | 4–6 | Standard staff training |
| `deep` | 7–8 | 5–8 | Comprehensive deep-dive |
| `custom` | User-defined | User-defined | Freeform prompt |

---

## Architecture

### AI Depth Preview Call

When the user arrives at Step 2 (Course Depth), the wizard makes a lightweight AI call to generate preview descriptions for each tier. This tells the user *what* each tier would cover based on their actual selected items.

**Edge function**: `build-course` with `step: 'depth_preview'`

**Input** (sent from frontend):
```json
{
  "step": "depth_preview",
  "course_id": "uuid",
  "language": "en"
}
```

The handler reads `wizard_config` from the course row (already saved with title + items) and assembles source material summaries.

**AI Schema** (`DEPTH_PREVIEW_SCHEMA`):
```json
{
  "type": "object",
  "properties": {
    "quick": {
      "type": "object",
      "properties": {
        "section_count": { "type": "integer" },
        "summary": { "type": "string" },
        "topics": { "type": "array", "items": { "type": "string" } }
      },
      "required": ["section_count", "summary", "topics"]
    },
    "standard": { "...same shape..." },
    "deep": { "...same shape..." }
  },
  "required": ["quick", "standard", "deep"]
}
```

**AI Response Example**:
```json
{
  "quick": {
    "section_count": 3,
    "summary": "Quick feature overview covering key ingredients, plating, and service notes.",
    "topics": ["Black Truffle Risotto — Key Ingredients", "Plating & Presentation", "Guest Talking Points"]
  },
  "standard": {
    "section_count": 5,
    "summary": "Full training covering prep, plating, pairings, allergens, and upselling.",
    "topics": ["Truffle Sourcing & Handling", "Prep & Station Setup", "Plating Standards", "Wine Pairings", "Allergens & Upselling"]
  },
  "deep": {
    "section_count": 7,
    "summary": "Comprehensive deep-dive with history, advanced techniques, and role-play scenarios.",
    "topics": ["Truffle History & Varieties", "Sourcing & Storage", "Mise en Place", "Step-by-Step Prep", "Plating Mastery", "Pairings & Upselling", "Service Role-Play Scenarios"]
  }
}
```

**Characteristics**:
- Cheap call: ~500 input tokens, ~300 output tokens, temp 0.4
- `MAX_TOKENS_DEPTH_PREVIEW = 2048`
- No DB writes (stateless preview)
- Cached on `wizard_config.depth_preview` after first call (avoid re-calling on step navigation)

### Depth → Structure Planner Integration

The selected depth is stored in `wizard_config.depth` and injected into the Pass 1 (Structure Plan) prompt:

```
DEPTH CONSTRAINTS:
- Tier: standard
- Target sections: 5-6
- Target elements per section: 4-6
- User notes: "Focus on wine pairings"
Do NOT exceed the section or element limits.
```

For `custom` depth, the user's freeform prompt replaces the constraints block:

```
DEPTH CONSTRAINTS (custom):
"I want 4 sections: one for each dish, plus a final quiz review section. Keep elements minimal — just the key prep steps and one pairing per dish."
```

---

## Files to Modify

### 1. `src/types/course-builder.ts`

**Add types**:
```typescript
export type CourseDepth = 'quick' | 'standard' | 'deep' | 'custom';

export interface DepthPreview {
  section_count: number;
  summary: string;
  topics: string[];
}

export interface DepthPreviewResponse {
  quick: DepthPreview;
  standard: DepthPreview;
  deep: DepthPreview;
}
```

**Update `WizardConfig`**:
```typescript
export interface WizardConfig {
  courseType: CourseType;
  title: string;
  // REMOVE: titleEs, descriptionEs
  description: string;             // renamed from descriptionEn semantically (field keeps same key)
  selectedSourceIds: SourceRef[];
  teacherLevel: TeacherLevel;
  teacherId: string | null;
  quizConfig: QuizConfig;
  additionalInstructions: string;  // merged — single field now
  assignTo: AssignmentTarget;
  deadline: string | null;
  expiresAt: string | null;
  // NEW depth fields
  depth: CourseDepth;
  depth_notes: string;             // optional refinement notes for selected tier
  depth_custom_prompt: string;     // freeform prompt when depth === 'custom'
  depth_preview: DepthPreviewResponse | null;  // cached AI response
  // Edge-function-compatible fields
  ai_instructions?: string;
  source_sections?: string[];
  source_products?: Array<{ table: string; ids: string[] }>;
}
```

### 2. `src/components/course-builder/wizard/MenuRolloutWizard.tsx`

**Step 0 — Simplified Course Details**:
- Remove `titleEs`, `descriptionEs` state variables and fields
- Remove corresponding STRINGS entries
- Rename "Description (English)" → "Rollout Details"
- Update placeholder: "Describe this rollout — what's new, any focus areas, special instructions for the AI..."
- This single field replaces both `description` and `ai_instructions`
- Remove Step 2 (old AI Instructions) — its content is now in "Rollout Details"

**Step 2 — New Course Depth**:
- New component: `DepthSelector`
- On mount: check `depthPreview` cache → if null, call `build-course` with `step: 'depth_preview'`
- Show loading skeleton while AI generates
- Render 4 cards in a 2×2 grid:

```
┌─────────────────────┐  ┌─────────────────────┐
│  ⚡ Quick Briefing  │  │ 📘 Standard Training│
│  3 sections         │  │ 5 sections          │
│  "Quick overview..."│  │ "Full training..."  │
│  • Topic 1          │  │ • Topic 1           │
│  • Topic 2          │  │ • Topic 2           │
│  • Topic 3          │  │ • Topic 3           │
│                     │  │  ...                │
│  [Optional notes]   │  │  [Optional notes]   │
└─────────────────────┘  └─────────────────────┘
┌─────────────────────┐  ┌─────────────────────┐
│  🎓 Deep Dive       │  │  ✏️ Custom          │
│  7 sections         │  │  "Tell the AI what  │
│  "Comprehensive..." │  │   you want..."      │
│  • Topic 1          │  │                     │
│  • Topic 2          │  │  [Textarea prompt]  │
│  • ...              │  │                     │
│  [Optional notes]   │  │                     │
└─────────────────────┘  └─────────────────────┘
```

- Selected card gets orange ring: `ring-2 ring-orange-500`
- Default selection: `standard`
- Each AI-generated card shows:
  - Icon + tier name (header)
  - Section count badge
  - Summary text (1 sentence)
  - Topic bullets (from AI preview)
  - Optional "Notes" textarea (collapsed by default, expand on click)
- Custom card shows:
  - Icon + "Custom" header
  - Textarea for freeform prompt
  - No AI preview needed

**State changes**:
```typescript
// REMOVE
const [titleEs, setTitleEs] = useState('');
const [descriptionEs, setDescriptionEs] = useState('');
const [instructions, setInstructions] = useState('');

// ADD
const [depth, setDepth] = useState<CourseDepth>('standard');
const [depthNotes, setDepthNotes] = useState('');
const [depthCustomPrompt, setDepthCustomPrompt] = useState('');
const [depthPreview, setDepthPreview] = useState<DepthPreviewResponse | null>(null);
const [isLoadingPreview, setIsLoadingPreview] = useState(false);
```

**`canGoNext` update**:
```typescript
case 2: return depth === 'custom' ? depthCustomPrompt.trim().length >= 10 : true;
```

**`handleBuild` update** — Build `wizardConfig` with new fields:
```typescript
const wizardConfig: WizardConfig = {
  courseType: 'menu_rollout',
  title: titleEn.trim(),
  description: descriptionEn.trim(),       // was split, now merged
  selectedSourceIds: selectedItems,
  teacherLevel,
  teacherId: null,
  quizConfig,
  additionalInstructions: descriptionEn.trim(),  // same content as description now
  assignTo: { mode: 'all_staff' },
  deadline: null,
  expiresAt: null,
  depth,
  depth_notes: depthNotes.trim(),
  depth_custom_prompt: depth === 'custom' ? depthCustomPrompt.trim() : '',
  depth_preview: depthPreview,
  ai_instructions: descriptionEn.trim(),
  source_sections: [],
  source_products: sourceProducts,
};
```

**DB insert update** — Remove `title_es`, `description_es`:
```typescript
const { data, error } = await supabase.from('courses').insert({
  group_id: groupId,
  slug,
  title_en: titleEn.trim(),
  title_es: null,              // Pass 4 handles translation
  description_en: descriptionEn.trim() || null,
  description_es: null,        // Pass 4 handles translation
  // ...rest unchanged
});
```

**Review step update** — Add depth row:
```typescript
<ReviewRow label="Depth" value={
  depth === 'custom' ? 'Custom' :
  depth === 'quick' ? 'Quick Briefing (3-4 sections)' :
  depth === 'standard' ? 'Standard Training (5-6 sections)' :
  'Deep Dive (7-8 sections)'
} />
```

### 3. New Component: `src/components/course-builder/wizard/DepthSelector.tsx`

Extracted component for the Course Depth step. Handles:
- Calling `build-course` with `step: 'depth_preview'` on mount
- Loading skeleton state
- Error state with retry button
- 2×2 card grid rendering
- Selection state (orange ring on selected)
- Notes textarea per tier
- Custom textarea for freeform prompt
- Caches preview in parent state to avoid re-calling on step navigation

**Props**:
```typescript
interface DepthSelectorProps {
  courseId: string;                    // needed for AI call
  depth: CourseDepth;
  onDepthChange: (d: CourseDepth) => void;
  depthNotes: string;
  onDepthNotesChange: (n: string) => void;
  depthCustomPrompt: string;
  onDepthCustomPromptChange: (p: string) => void;
  depthPreview: DepthPreviewResponse | null;
  onDepthPreviewLoaded: (p: DepthPreviewResponse) => void;
  language: 'en' | 'es';
}
```

### 4. `src/components/course-builder/wizard/WizardStepLayout.tsx`

**Orange button styling**:
```tsx
// Next button (non-last step)
<Button
  size="sm"
  onClick={onNext}
  disabled={!canGoNext}
  className="bg-orange-500 text-white hover:bg-orange-600"
>
  {t.next}
</Button>

// Build button (last step)
<Button
  size="sm"
  onClick={onBuild}
  disabled={!canGoNext || isBuilding}
  className="bg-orange-500 text-white hover:bg-orange-600"
>
  ...
</Button>
```

This matches `AdminCourseListPage.tsx` lines 507, 570, 646 exactly.

### 5. `supabase/functions/_shared/course-builder.ts`

**Add schema + parser**:
```typescript
export const DEPTH_PREVIEW_SCHEMA = {
  type: "object",
  properties: {
    quick: {
      type: "object",
      properties: {
        section_count: { type: "integer" },
        summary: { type: "string", description: "1-sentence summary of what this tier covers" },
        topics: { type: "array", items: { type: "string" }, description: "Section topic names" }
      },
      required: ["section_count", "summary", "topics"]
    },
    standard: { /* same shape */ },
    deep: { /* same shape */ }
  },
  required: ["quick", "standard", "deep"]
};

export const MAX_TOKENS_DEPTH_PREVIEW = 2048;

export function parseDepthPreviewResponse(raw: unknown): DepthPreviewResponse | null {
  // Validate quick/standard/deep each have section_count, summary, topics
}
```

### 6. `supabase/functions/build-course/index.ts`

**New handler: `handleDepthPreview`**:
```typescript
async function handleDepthPreview(supabase, userId, groupId, body): Promise<Response> {
  // 1. Load course + wizard_config
  // 2. Assemble source material (same as structure_plan)
  // 3. Build prompt:
  //    "Given these menu items, describe 3 depth tiers for a training course:
  //     - quick (3-4 sections): fast briefing
  //     - standard (5-6 sections): normal training
  //     - deep (7-8 sections): comprehensive
  //     For each tier, provide a section_count, a 1-sentence summary, and topic names."
  // 4. Call Claude with DEPTH_PREVIEW_SCHEMA, temp 0.4, MAX_TOKENS_DEPTH_PREVIEW
  // 5. Parse response
  // 6. Return JSON (no DB write — stateless)
  // 7. Credit cost: 0 or minimal (preview only)
}
```

**Update router**: Add `case "depth_preview"` to step switch.

**Update `handleStructurePlan`** — Inject depth constraints:
```typescript
// After existing wizardContext lines (line ~2266):
const depthConstraints = buildDepthConstraints(wizardConfig);

const userMessage = `${wizardContext}
${depthConstraints}

SOURCE MATERIAL:
${material.text}

Design a course structure. Return JSON matching the schema.
...`;
```

**New helper: `buildDepthConstraints`**:
```typescript
function buildDepthConstraints(wizardConfig: Record<string, unknown>): string {
  const depth = wizardConfig.depth as string || 'standard';
  const notes = wizardConfig.depth_notes as string || '';

  if (depth === 'custom') {
    const prompt = wizardConfig.depth_custom_prompt as string || '';
    return `DEPTH CONSTRAINTS (custom):\n"${prompt}"`;
  }

  const ranges: Record<string, { sections: string; elements: string }> = {
    quick:    { sections: '3-4', elements: '2-4' },
    standard: { sections: '5-6', elements: '4-6' },
    deep:     { sections: '7-8', elements: '5-8' },
  };

  const r = ranges[depth] || ranges.standard;
  let block = `DEPTH CONSTRAINTS:
- Tier: ${depth}
- Target sections: ${r.sections}
- Target elements per section: ${r.elements}
- Do NOT exceed the section or element limits.`;

  if (notes) block += `\n- User notes: "${notes}"`;
  return block;
}
```

### 7. Migration: `supabase/migrations/20260310_depth_preview.sql`

Seed the `depth-preview` prompt in `ai_prompts` and add credit cost (0 credits for preview).

```sql
INSERT INTO public.ai_prompts (slug, label, system_prompt, model, temperature, created_at, updated_at)
VALUES (
  'course-depth-preview',
  'Course Depth Preview',
  'You are a course architect for a restaurant training platform. Given a set of menu items or training material, describe three depth tiers for a training course. Be specific to the actual items provided — reference real dish names, ingredients, and techniques. Keep summaries concise (1 sentence) and topics as short labels.',
  'claude-sonnet-4-5-20250514',
  0.4,
  now(), now()
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.credit_costs (action_group, action_name, credit_cost, label, created_at, updated_at)
VALUES ('course_builder', 'depth_preview', 0, 'Depth Preview (free)', now(), now())
ON CONFLICT (action_group, action_name) DO NOTHING;
```

---

## Implementation Order

### Phase 1: Backend (Edge Function + Schema)
1. Add `DEPTH_PREVIEW_SCHEMA`, `MAX_TOKENS_DEPTH_PREVIEW`, `parseDepthPreviewResponse` to `_shared/course-builder.ts`
2. Add `handleDepthPreview` to `build-course/index.ts`
3. Add `"depth_preview"` to router + `BuildCourseRequest` type
4. Add `buildDepthConstraints` helper
5. Update `handleStructurePlan` to inject depth constraints into prompt
6. Create migration `20260310_depth_preview.sql`
7. Deploy: `echo y | npx supabase db push --include-all && npx supabase functions deploy build-course --no-verify-jwt`

### Phase 2: Types
1. Add `CourseDepth`, `DepthPreview`, `DepthPreviewResponse` to `types/course-builder.ts`
2. Update `WizardConfig`: add depth fields, remove `titleEs`/`descriptionEs`

### Phase 3: Frontend — Wizard Restructure
1. Create `DepthSelector.tsx` component
2. Update `MenuRolloutWizard.tsx`:
   - Remove ES state/fields
   - Merge description + instructions → "Rollout Details"
   - Replace Step 2 (AI Instructions) → Step 2 (Course Depth / DepthSelector)
   - Update `handleBuild` with new wizardConfig shape
   - Update review step with depth info
3. Update `WizardStepLayout.tsx` — orange buttons

### Phase 4: Verify
1. `npx tsc --noEmit` — 0 errors
2. Build a course with each depth tier
3. Verify section counts match tier constraints
4. Verify custom depth prompt flows through

---

## STRINGS Updates (MenuRolloutWizard)

### Remove
- `titleEs`, `titleEsPlaceholder`
- `descriptionEs`, `descriptionEsPlaceholder`
- `step3Title`, `step3Desc`, `instructionsPlaceholder` (merged into step 0)
- `reviewInstructions`

### Update
- `descriptionEn` → `rolloutDetails`: "Rollout Details"
- `descriptionEnPlaceholder` → `rolloutDetailsPlaceholder`: "Describe this rollout — what's new, any focus areas, special instructions for the AI..."
- `step1Desc` → "Name and describe your course rollout."

### Add
- `step3Title` (reused index): "Course Depth"
- `step3Desc`: "Choose how comprehensive the AI-generated course should be."
- `reviewDepth`: "Depth"
- `loadingPreview`: "Generating preview..."
- `retryPreview`: "Retry"
- `depthQuick`: "Quick Briefing"
- `depthStandard`: "Standard Training"
- `depthDeep`: "Deep Dive"
- `depthCustom`: "Custom"
- `depthNotes`: "Refinement notes (optional)"
- `depthCustomPrompt`: "Describe what you want..."
- `depthSections`: "sections"

---

## Visual Spec — Depth Cards

```
┌─ ring-2 ring-orange-500 (selected) ─────────────────────┐
│                                                          │
│  ⚡  Quick Briefing            ┌────────────┐           │
│                                │  3 sections │ (badge)   │
│                                └────────────┘           │
│  Quick feature overview covering key ingredients,        │
│  plating, and service notes.                             │
│                                                          │
│  • Black Truffle Risotto — Key Ingredients               │
│  • Plating & Presentation                                │
│  • Guest Talking Points                                  │
│                                                          │
│  ┌─ collapsed by default ──────────────────────────────┐ │
│  │ ▼ Add notes...                                      │ │
│  └─────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

**Card CSS**:
```
bg-card rounded-[20px] border border-black/[0.04] shadow-sm p-5
cursor-pointer transition-all
hover:shadow-md
selected: ring-2 ring-orange-500
```

**Badge CSS**: `text-[10px] font-semibold bg-orange-100 text-orange-700 rounded-full px-2.5 py-0.5`

**Custom card**: Same card shell but body is a textarea instead of AI preview. No badge.

---

## What We're NOT Changing

- **Single-element regeneration** (`build-course-element`): Unaffected
- **Pass 2/3/4 pipeline**: Depth only affects Pass 1 (structure plan)
- **Course player**: No changes needed
- **QuizModeSelector / TeacherLevelSelector**: No changes needed
- **SourceMaterialPicker**: No changes needed
- **CourseWizardDialog**: No changes (still shows 6 course type cards)

---

## Risk Notes

- **AI preview might be slow**: If the depth preview takes >5s, the loading skeleton keeps the UX smooth. The preview is cached in state so re-visiting the step is instant.
- **AI might not respect depth constraints**: The prompt says "Do NOT exceed" but Claude may still overshoot. Existing structure plan validation can warn. Not a blocker — the constraint is a strong hint, not a hard gate.
- **Custom depth needs minimum length**: 10 char minimum prevents empty/useless custom prompts.
- **Backward compatibility**: Existing courses without `depth` in wizard_config default to `standard` behavior (the structure planner already works without constraints — it just won't have the guardrails).
