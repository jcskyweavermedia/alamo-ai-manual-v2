# Course Builder — Element System Upgrade (v2 — Simplified)

## Context

The course builder has **4 element types** (`content`, `feature`, `media`, `product_viewer`) that produce functional but visually basic output — plain markdown, `border-l-4` callouts.

The HTML mockup (`docs/mockups/black-truffle-day-7-elements.html`) proves that **7 core visual elements** can reproduce the full premium magazine experience. This plan adds **4 new element types** and **upgrades 2 existing ones** — no elements removed, fully backward-compatible.

**Visual reference**: `docs/mockups/black-truffle-day-7-elements.html` (annotated with colored element tags)

---

## The 7 Elements (Mockup → Type Mapping)

| # | Visual Element | Type System | Status |
|---|---------------|-------------|--------|
| 1 | Section Header | **`section_header`** | NEW |
| 2 | Mini Cards (icon-tile, menu-item, bilingual) | **`card_grid`** | NEW |
| 3 | Intro Paragraph | `content` with `lead: true` | UPGRADE |
| 4 | Content (body text) | `content` (existing) | OK |
| 5 | Medium Cards (correct/incorrect, miss/fix) | **`comparison`** | NEW |
| 6 | Large Cards (callout + standout) | `feature` (card redesign) + `standout` variant | UPGRADE |
| 7 | Script / List Card | **`script_block`** | NEW |

**Result**: 4 new types + 2 upgrades. Zero mockup gaps.

---

## New Element Types (4)

### 1. `section_header` — Sub-section divider

Creates visual sub-sections within a page. Auto-inserts a divider line above (except when first element).

```typescript
interface SectionHeaderElement extends BaseElement {
  type: 'section_header';
  number_label?: string;    // "01 — The Vision" (optional, AI-generated)
  title_en: string;         // Supports light|bold split via "|" delimiter
  title_es: string;
  subtitle_en?: string;
  subtitle_es?: string;
}
```

**Rendering** (mockup `.section-header`):
- Divider: `border-top: 1px solid border` + `mt-10 pt-8` (suppressed if first element)
- Number label: `text-[11px] font-bold text-orange-500 uppercase tracking-wider`
- Title: `text-2xl font-black leading-tight` — if contains `|`, split into `font-light` block + `font-bold` block
- Subtitle: `text-sm text-muted-foreground`

**Builder**: Outline = title + subtitle + AI instructions. Generated/Edit = inline-editable fields.

---

### 2. `card_grid` — Multi-card grid with variants

```typescript
type CardGridVariant = 'icon_tile' | 'menu_item' | 'bilingual';

interface CardGridItem {
  icon?: string;            // Emoji (e.g., "💫") — used by icon_tile & menu_item
  icon_bg?: string;         // Gradient hint: 'orange' | 'yellow' | 'green' | 'blue' | 'purple'
  title_en: string;
  title_es: string;
  body_en: string;
  body_es: string;
}

interface CardGridElement extends BaseElement {
  type: 'card_grid';
  variant: CardGridVariant;
  columns: 2 | 3;
  cards: CardGridItem[];
}
```

**Rendering by variant** (mockup `.mini-card-grid`):

| Variant | Icon | Card style | Special |
|---------|------|------------|---------|
| `icon_tile` | 44px gradient tile | `rounded-[20px] shadow-card` | — |
| `menu_item` | 2rem emoji, no tile | Same card + 3px orange top bar | `::after` gradient border |
| `bilingual` | None | Same card, 2-col only | "English" / "Español" labels, shows EN/ES side-by-side |

**Responsive**: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-{columns}`

**Builder**: Outline = variant picker + column count + AI instructions. Generated = inline-editable cards with add/remove.

---

### 3. `comparison` — Side-by-side or stacked panels

```typescript
type ComparisonVariant = 'correct_incorrect' | 'miss_fix';

interface ComparisonSide {
  tag_en: string;           // e.g., "The Standard" or "Miss"
  tag_es: string;
  title_en?: string;        // Optional heading (used in side-by-side)
  title_es?: string;
  items_en: string[];       // Bullet list
  items_es: string[];
}

interface ComparisonElement extends BaseElement {
  type: 'comparison';
  variant: ComparisonVariant;
  pairs: ComparisonSide[];  // For miss_fix: array of {negative, positive} pairs
  positive: ComparisonSide; // For correct_incorrect: left (dark) side
  negative: ComparisonSide; // For correct_incorrect: right (light) side
}
```

**Layout by variant** (mockup `.medium-card-row` / `.medium-card-stack`):

| Variant | Layout | Positive | Negative |
|---------|--------|----------|----------|
| `correct_incorrect` | 2-col side-by-side | Dark bg, white text, orange `+` bullets | White card, gray text, `−` bullets |
| `miss_fix` | Vertical stack of paired rows | Green `Fix` pill tag | Red `Miss` pill tag |

**CSS (correct_incorrect)**:
- Positive: `bg-foreground text-white rounded-[20px] p-6`
- Tag: `text-[10px] font-bold uppercase bg-orange-500/20 text-orange-400 px-2.5 py-1 rounded-full`
- Negative: `bg-card rounded-[20px] border border-black/[0.04] shadow-card p-6`

**CSS (miss_fix)**:
- Pair card: `bg-card rounded-[20px] border border-black/[0.04] shadow-card overflow-hidden`
- Miss row: `flex items-start gap-3 px-5 py-3.5` + red pill
- Fix row: same + green pill + `border-t border-black/[0.04]`

**Builder**: Outline = variant picker + AI instructions. Generated = inline-editable sides/pairs.

---

### 4. `script_block` — Bilingual conversation/script lines

```typescript
interface ScriptLine {
  text_en: string;
  text_es?: string;
}

interface ScriptBlockElement extends BaseElement {
  type: 'script_block';
  header_en: string;
  header_es: string;
  header_icon?: string;     // Emoji for header
  lines: ScriptLine[];
}
```

**Rendering** (mockup `.script-card`):
- Container: `bg-card rounded-[20px] border border-black/[0.04] shadow-card overflow-hidden`
- Header bar: `px-6 py-3 bg-orange-50 border-b border-orange-100 text-[11px] font-bold uppercase tracking-wider text-orange-600`
- Each line: `px-6 py-4 border-b border-black/[0.04] last:border-b-0`
- EN text: `text-[15px] font-medium text-foreground leading-relaxed`
- ES text: `text-[13px] text-muted-foreground italic mt-1`
- In ES-only preview mode: show ES as primary text

**Builder**: Outline = header + AI instructions. Generated = inline-editable line list with add/remove.

---

## Existing Element Upgrades (2)

### A. Content Element → `lead` flag for intro paragraphs

Add optional `lead` boolean to `ContentElement`:

```typescript
interface ContentElement extends BaseElement {
  type: 'content';
  title_en?: string;
  title_es?: string;
  body_en: string;
  body_es: string;
  lead?: boolean;           // NEW — renders as larger, lighter intro text
}
```

When `lead: true` (mockup `.intro`):
- Body: `text-base font-light text-muted-foreground leading-relaxed max-w-[58ch]`
- No title rendered (lead paragraphs don't have titles)
- No markdown — plain text only

When `lead: false` (default): current rendering unchanged.

**Builder**: Toggle checkbox "Intro paragraph" in outline/edit mode.

---

### B. Feature Element → Card-based redesign + `standout` variant

**Current**: `border-l-4 border-{color}-500 bg-{color}-50` + 16px icon
**New**: White card with 44px icon tile + uppercase variant tag (mockup `.large-card-callout`)

Add `standout` to FeatureVariant:

```typescript
export type FeatureVariant = 'tip' | 'best_practice' | 'caution' | 'warning' | 'did_you_know' | 'key_point' | 'standout';
```

Add to `FeatureVariantConfig` in `builder-utils.ts`:
```typescript
iconTileBg: string;       // e.g., 'from-blue-50 to-blue-100'
iconTileColor: string;    // e.g., 'text-blue-600'
```

**Variant metadata (updated):**

| Variant | `iconTileBg` | `iconTileColor` | Card bg |
|---------|-------------|----------------|---------|
| tip | `from-blue-50 to-blue-100` | `text-blue-600` | `bg-card` (white) |
| best_practice | `from-green-50 to-green-100` | `text-green-600` | `bg-card` |
| caution | `from-amber-50 to-amber-100` | `text-amber-600` | `bg-card` |
| warning | `from-red-50 to-red-100` | `text-red-600` | `bg-card` |
| did_you_know | `from-orange-50 to-orange-100` | `text-orange-600` | `bg-orange-50` (tinted) |
| key_point | `from-indigo-50 to-indigo-100` | `text-indigo-600` | `bg-card` |
| **standout** | N/A | N/A | `bg-foreground` (dark) |

**Callout card CSS (all variants except standout):**
- Container: `bg-card rounded-[20px] border border-black/[0.04] shadow-card p-5 flex gap-4 items-start`
- Icon tile: `w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br {iconTileBg}`
- Tag: `text-[10px] font-bold uppercase tracking-wider {tagColor}`
- Title: `text-[15px] font-bold text-foreground`
- Body: standard markdown

**Standout variant CSS (mockup `.large-card-standout`):**
- Container: `bg-foreground rounded-[20px] p-7 sm:p-8 relative overflow-hidden`
- Radial glow: `after:` pseudo-element with `radial-gradient(circle, orange-600 0%, transparent 65%) opacity-[0.08]`
- Tag: `text-[10px] font-bold uppercase text-orange-400`
- Title: `text-xl font-extrabold text-white leading-tight`
- Body: `text-sm text-white/60 leading-relaxed`

**Backward-compatible**: Existing feature elements get the new card styling automatically. The `standout` variant is new.

---

## Updated Type Union

```typescript
// course-builder.ts

export type ElementType =
  | 'content' | 'feature' | 'media' | 'product_viewer'       // existing
  | 'section_header' | 'card_grid' | 'comparison' | 'script_block';  // new

export type FeatureVariant =
  | 'tip' | 'best_practice' | 'caution' | 'warning'
  | 'did_you_know' | 'key_point'                              // existing
  | 'standout';                                                // new

export type CourseElement =
  | ContentElement | FeatureElement | MediaElement | ProductViewerElement
  | SectionHeaderElement | CardGridElement | ComparisonElement | ScriptBlockElement;
```

---

## Element Palette (Updated)

### Elements group
| Icon | Label EN | Type |
|------|----------|------|
| FileText | Content | content |
| Heading2 | Section Header | section_header |
| LayoutGrid | Card Grid | card_grid |
| ArrowLeftRight | Comparison | comparison |
| MessageSquareQuote | Script Block | script_block |

### Callouts group (existing feature variants, restyled)
| Icon | Label EN | Type + Variant |
|------|----------|----------------|
| Lightbulb | Tip | feature:tip |
| CheckCircle | Best Practice | feature:best_practice |
| AlertTriangle | Caution | feature:caution |
| ShieldAlert | Warning | feature:warning |
| Sparkles | Did You Know? | feature:did_you_know |
| Star | Key Point | feature:key_point |
| Megaphone | Standout | feature:standout |

### Media & Embed group
| Icon | Label EN | Type |
|------|----------|------|
| Image | Media | media |
| Eye | Product | product_viewer |

---

## Implementation Phases

### Phase 1A: Type System Foundation
**Files to modify:**
- `src/types/course-builder.ts` (line 11, 13, 34-40, 79)
  - Add 4 new interfaces: `SectionHeaderElement`, `CardGridElement`, `ComparisonElement`, `ScriptBlockElement`
  - Expand `ElementType` union with 4 new types
  - Expand `CourseElement` union
  - Add `standout` to `FeatureVariant`
  - Add `lead?: boolean` to `ContentElement`
  - Add type guards for new types

- `src/lib/course-builder/builder-utils.ts` (line 84-147, 194-252)
  - Add 4 factory cases in `getDefaultElement()` switch
  - Add `standout` to `FEATURE_VARIANTS` record
  - Add `iconTileBg` + `iconTileColor` fields to `FeatureVariantConfig`
  - Add variant metadata: `CARD_GRID_VARIANTS`, `COMPARISON_VARIANTS`

### Phase 1B: Player Renderers (4 new + 2 upgraded)
**New files in** `src/components/course-player/`:
1. `PlayerSectionHeaderRenderer.tsx`
2. `PlayerCardGridRenderer.tsx`
3. `PlayerComparisonRenderer.tsx`
4. `PlayerScriptBlockRenderer.tsx`

**Modified:**
- `PlayerElementDispatcher.tsx` — add 4 switch cases
- `PlayerFeatureRenderer.tsx` — card-based redesign with icon tiles + standout variant
- `PlayerContentRenderer.tsx` — add `lead` flag rendering

### Phase 1C: Builder Renderers (4 new + 2 upgraded)
**New files in** `src/components/course-builder/`:
1. `SectionHeaderElementRenderer.tsx`
2. `CardGridElementRenderer.tsx`
3. `ComparisonElementRenderer.tsx`
4. `ScriptBlockElementRenderer.tsx`

**Modified:**
- `CourseBuilderCanvas.tsx` — add 4 switch cases in `ElementRenderer`
- `FeatureElementRenderer.tsx` — card-based design + standout variant
- `ContentElementRenderer.tsx` — add `lead` toggle

### Phase 1D: Palette + Preview Upgrades
**Modified:**
- `ElementPalette.tsx` — restructure into 3 groups (Elements, Callouts, Media/Embed), add 4 new palette items + standout
- `CoursePreviewPanel.tsx` — upgrade section heading to numbered light/bold style

### Phase 1E: Edge Function Updates
**Modified:** `supabase/functions/_shared/course-builder.ts` (if exists)
- Add 4 new types to AI outline parser `validTypes` array
- Add serialization cases for AI generation
- Token limits: section_header: 200, card_grid: 1500, comparison: 1200, script_block: 1500

---

## Dependency Order

```
Phase 1A (types + factories)
    ├── Phase 1B (player renderers + upgrades)
    ├── Phase 1C (builder renderers + upgrades)
    │       └── Phase 1D (palette + preview)
    └── Phase 1E (edge function — independent)
```

1B, 1C, and 1E can run in parallel after 1A.

---

## File Summary

| Category | Count | Files |
|----------|-------|-------|
| New files | 8 | 4 player renderers + 4 builder renderers |
| Modified files | ~10 | types, utils, 2 dispatchers, canvas, palette, preview, 2 feature renderers, 2 content renderers |
| Migrations | 0 | JSONB is schema-less — additive only |

---

## Verification

1. Add each of the 4 new element types via the palette
2. Confirm outline state shows AI instructions + type-specific options (variant picker, column count)
3. Manually populate with Black Truffle Day sample content, set to `generated`
4. Verify preview panel renders each element matching the 7-element mockup
5. Verify existing courses with old elements still render correctly (backward compatibility)
6. Test feature callouts — card-based with icon tiles, not `border-l-4`
7. Test standout variant — dark banner with radial glow
8. Test lead paragraph — `lead: true` content renders larger/lighter
9. Check mobile responsiveness (card_grid → 1-col, comparison → stacked)
10. Run `npx tsc --noEmit` — 0 TypeScript errors
