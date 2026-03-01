# Phase 5: Form Builder Admin -- UX/UI Design Specification

> **Status:** Planning
> **Date:** 2026-02-25
> **Author:** Senior UX/UI Designer (Opus)
> **Dependencies:** Phase 1 (DB Foundation), Phase 2 (Form Viewer), Phase 3 (AI Form Filling), Phase 5 DB Plan, Phase 5 Backend Plan
> **Companion Docs:** `05-phase-db-section.md` (schema), `05-phase-form-builder-admin-backend.md` (edge functions)

---

## Table of Contents

1. [Design Philosophy](#1-design-philosophy)
2. [Builder Layout](#2-builder-layout)
3. [Instructions Editor](#3-instructions-editor)
4. [AI Tools Picker](#4-ai-tools-picker)
5. [Field Block Design](#5-field-block-design)
   - 5.2a [Property Panel: `instructions` Type](#52a-property-panel-instructions-type)
   - 5.2b [Property Panel: `header` Type](#52b-property-panel-header-type)
6. [Live Preview](#6-live-preview)
7. [AI Template Generation](#7-ai-template-generation)
8. [Mobile Builder Experience](#8-mobile-builder-experience)
9. [Admin Forms List](#9-admin-forms-list)
   - 9.5 [Editing a Published Template](#95-editing-a-published-template)
10. [Component File Map](#10-component-file-map)
11. [Props Interfaces](#11-props-interfaces)
12. [ASCII Mockups](#12-ascii-mockups)
13. [Tailwind Class Reference](#13-tailwind-class-reference)
14. [Accessibility Checklist](#14-accessibility-checklist)
15. [Design Decision Log](#15-design-decision-log)

---

## 1. Design Philosophy

### 1.1 Core Principles

**Apple-like simplicity.** Every surface should feel immediately obvious. A restaurant manager who has never used a form builder should be able to create a simple form within 3 minutes without reading instructions. The builder must feel like a consumer product, not an enterprise tool.

**Mobile-first, desktop-enhanced.** The builder is fully functional on a phone (managers may start building a form at the restaurant on their phone). Desktop adds the two-column layout with live preview -- a productivity enhancement, not a requirement.

**Reuse, do not reinvent.** Every component pattern in this spec maps to an existing pattern in the codebase:

| New Pattern | Existing Pattern It Mirrors |
|-------------|---------------------------|
| Builder field block | `FormFieldWrapper` + `FormSection` card |
| Instructions editor sidebar | `DockedFormAIPanel` |
| AI template generation chat | `ChatIngestionPanel` |
| Toolbar | `FormToolbar` (frosted glass pill) |
| Field type picker | `AttachmentMenu` (bottom sheet on mobile, popover on desktop) |
| AI tools toggle cards | `FormCard` grid with toggle switches |
| Live preview phone frame | Static `FormBody` + `FormSection` in a bordered container |

**Bilingual throughout.** Every label, placeholder, and AI interaction supports EN/ES. The builder edits both language variants of titles, descriptions, and instructions. Language is controlled by the global `useLanguage()` hook.

### 1.2 Visual Language

- **Radius:** `rounded-[20px]` for cards, `rounded-[12px]` for tiles, `rounded-xl` for inputs
- **Shadows:** `shadow-card` for containers, `shadow-sm` for tiles, `shadow-xl` for panels
- **Borders:** `border border-black/[0.04] dark:border-white/[0.06]` (same ultra-subtle border as all cards)
- **Accent:** `bg-orange-500` for primary actions, `bg-primary` for submit, `bg-primary/10` for icon badges
- **Glass:** `bg-muted/90 backdrop-blur-md` for floating toolbars
- **Animation:** `animate-in slide-in-from-right-4 fade-in-0 duration-500 ease-out` for panels
- **Typography:** `text-[13px] font-bold uppercase tracking-wider` for section headers

---

## 2. Builder Layout

### 2.1 Desktop Layout (>= 1024px)

Two-column split. The left column is the scrollable editor. The right column is a sticky phone-frame live preview. When the Instructions AI Sidebar is open, it replaces the preview column.

```
+-----------------------------------------------------------------------+
| <- Back     Form Builder             [Save Draft]  [Publish]          |
+-------------------------------------------+---------------------------+
|                                           |                           |
|  EDITOR (scrollable)                      |  LIVE PREVIEW (sticky)    |
|                                           |                           |
|  [Form Metadata]                          |  +---------------------+  |
|    Title EN: ___________                  |  |  --- iPhone frame ---| |
|    Title ES: ___________                  |  |                     |  |
|    Description EN: _____                  |  |  Employee Write-Up  |  |
|    Description ES: _____                  |  |                     |  |
|    Icon: [ClipboardList v]               |  |  [Employee Info]    |  |
|                                           |  |   Name: ________   |  |
|  [Instructions]                           |  |   Position: _____  |  |
|    EN: [textarea] [AI Refine]             |  |                     |  |
|    ES: [textarea] [AI Refine]             |  |  [Incident Details] |  |
|                                           |  |   Date: [pick]     |  |
|  [AI Tools]                               |  |   Description: __  |  |
|    [x] Search Contacts                    |  |                     |  |
|    [x] Search Manual                      |  +---------------------+  |
|    [ ] Search Products                    |                           |
|                                           |  AI Fillability: 85/100  |
|  [Fields]                                 |  [Open in new tab ->]    |
|    + Add Field                            |                           |
|    [drag] Section: Employee Info          |                           |
|    [drag] Employee Name [text] [req]      |                           |
|    [drag] Position [text] [req]           |                           |
|    [drag] Department [select] [req]       |                           |
|    ...                                    |                           |
|                                           |                           |
+-------------------------------------------+---------------------------+
```

**Widths:**
- Editor: `flex-1 min-w-0` (takes remaining space)
- Preview: `w-80 xl:w-96 shrink-0` (same width as `DockedFormAIPanel`)

### 2.2 Mobile Layout (< 1024px)

Single column. A segmented tab bar at the top switches between three views: **Fields**, **Settings**, **Preview**. No split-screen.

```
+------------------------------------+
| <- Back   Form Builder    [Save]   |
+------------------------------------+
| [Fields] [Settings] [Preview]      |
+------------------------------------+
|                                    |
|  (Active tab content below)        |
|                                    |
|  ...                               |
|                                    |
+------------------------------------+
| [frosted toolbar: + Add | Publish] |
+------------------------------------+
```

**Tab contents:**
- **Fields:** Draggable field list + "Add Field" button
- **Settings:** Form metadata (title, description, icon), Instructions (EN/ES with AI Refine), AI Tools picker
- **Preview:** Read-only phone-frame preview of the form

### 2.3 Responsive Breakpoints

| Breakpoint | Layout | Preview |
|------------|--------|---------|
| < 640px (phone) | Single column, tabbed | Preview tab (separate view) |
| 640-1023px (tablet) | Single column, tabbed | Preview tab (separate view) |
| >= 1024px (desktop) | Two-column split | Sticky sidebar |
| >= 1280px (wide) | Two-column split, wider preview | `xl:w-96` preview |

---

## 3. Instructions Editor

### 3.1 Layout

The instructions editor is a section within the **Settings** area (mobile) or the editor column (desktop). It consists of a plain `<textarea>` for each language plus an "AI Refine" button that opens a chat sidebar.

```
+-----------------------------------------------+
|  Instructions for AI                           |
|  (The AI reads these when filling the form)    |
+-----------------------------------------------+
|  [EN] [ES]              <- language tab toggle |
+-----------------------------------------------+
|  +-----------------------------------------+  |
|  | 1. Record the employee's name and role  |  |
|  | 2. Determine the type of violation      |  |
|  | 3. Check the manual for relevant policy |  |
|  | 4. Write a factual description          |  |
|  |                                         |  |
|  +-----------------------------------------+  |
|                                                |
|  [Sparkles icon] AI Refine Instructions        |
|  Character count: 342 / 5,000                  |
+------------------------------------------------+
```

### 3.2 AI Refine Sidebar

Clicking "AI Refine Instructions" opens a chat sidebar (desktop) or a full-screen drawer (mobile). This sidebar calls the `refine-form-instructions` edge function and allows multi-turn conversation.

**Desktop:** The AI Refine sidebar replaces the live preview column. It uses the same `w-80 xl:w-96` sizing and `border-l` treatment as `DockedFormAIPanel`. A segmented toggle in the sidebar header switches between the preview and the AI refine chat.

**Mobile:** Opens as a full-screen sheet (`Sheet` from shadcn/ui) sliding up from the bottom, same pattern as the mobile AI form-filling drawer.

### 3.3 AI Refine Flow

```
1. Admin writes rough instructions in the textarea
2. Admin clicks "AI Refine"
3. Sidebar opens with the current instructions shown as the first user message
4. AI returns: refined instructions + explanation + suggestions
5. Refined instructions appear in a code-like block with "Apply" and "Edit" buttons
6. "Apply" copies the refined text back into the textarea
7. Admin can continue chatting: "Make step 3 shorter" or "Also mention contacts"
8. Each refinement round updates the instruction preview
9. On "Apply", the refined text replaces the textarea content
10. The conversation is stored in `ai_refinement_log` on the template
```

### 3.4 Refine Chat Message Types

| Message Type | Rendering |
|-------------|-----------|
| User's raw instructions | Right-aligned bubble (same as `UserMessageBubble`) |
| AI refined instructions | Left-aligned card with: refined text block, explanation paragraph, suggestion chips |
| User follow-up | Right-aligned bubble |
| AI updated refinement | Same card format with updated text |

### 3.5 "Apply" Interaction

The refined instructions card has two buttons:
- **Apply** (primary, `bg-primary`): Copies `refinedInstructions` into the instructions textarea and shows a toast "Instructions updated"
- **Edit** (ghost): Opens a pre-filled textarea overlay where the admin can manually tweak before applying

```
+--------------------------------------------+
|  AI  Refined Instructions                   |
|                                             |
|  +---------------------------------------+  |
|  | 1. Identify the employee and role...  |  |
|  | 2. Set violation_type to the closest  |  |
|  |    matching option...                 |  |
|  | 3. Use search_manual to find the      |  |
|  |    relevant policy...                 |  |
|  +---------------------------------------+  |
|                                             |
|  I refined your instructions to explicitly  |
|  name the search_manual tool so the AI      |
|  knows to look up policies. I also mapped   |
|  each step to field keys.                   |
|                                             |
|  Suggestions:                               |
|  [chip] Enable search_contacts              |
|  [chip] Add ai_hint to violation_type       |
|                                             |
|  [Apply]  [Edit]                            |
+---------------------------------------------+
```

---

## 4. AI Tools Picker

### 4.1 Data Source

Tool definitions are read from the `form_ai_tools` table via `useFormAITools()` hook. Each tool has: `id`, `label_en`, `label_es`, `description_en`, `description_es`, `icon`, `status`, `sort_order`.

### 4.2 Card-Per-Tool Design

Each tool renders as a horizontal card with a toggle switch on the right side. Cards are stacked vertically. The design mirrors the "Settings" card pattern seen in iOS Settings -- icon tile, title, description, toggle.

```
+---------------------------------------------------+
|  AI Tools                                          |
|  Select which tools the AI can use when filling    |
+---------------------------------------------------+
|                                                    |
|  +----------------------------------------------+ |
|  | [BookUser]  Search Contacts          [ON/off] | |
|  |             Search the restaurant's contact   | |
|  |             directory (hospitals, emergency    | |
|  |             services, management, vendors).    | |
|  +----------------------------------------------+ |
|                                                    |
|  +----------------------------------------------+ |
|  | [BookOpen]  Search Manual            [on/OFF] | |
|  |             Search restaurant policies,       | |
|  |             procedures, and SOPs.             | |
|  +----------------------------------------------+ |
|                                                    |
|  +----------------------------------------------+ |
|  | [Utensils]  Search Products          [on/OFF] | |
|  |             Search the menu, recipes,         | |
|  |             wines, cocktails, beverages.      | |
|  +----------------------------------------------+ |
|                                                    |
|  +----------------------------------------------+ |
|  | [Star]      Restaurant Standards     [on/OFF] | |
|  |             Search quality standards,         | |
|  |             dress code, and service protocols. | |
|  +----------------------------------------------+ |
|                                                    |
|  +----------------------------------------------+ |
|  | [ListChk]   Steps of Service         [on/OFF] | |
|  |             Search FOH procedures,            | |
|  |             greeting protocols, tableside.    | |
|  +----------------------------------------------+ |
|                                                    |
|  -- Recommendations ------------------------------ |
|  Based on your form title and fields:              |
|  [chip: Enable Search Contacts -- contact_lookup   |
|   field detected]                                  |
|  [chip: Enable Search Manual -- "write-up" in      |
|   title suggests policy references]                |
+----------------------------------------------------+
```

### 4.3 Tool Card Component

Each tool card is a single row inside a shared card container (all tools in one `bg-card rounded-[20px]` card, separated by hairline dividers). This is denser and more scannable than separate cards per tool.

```tsx
// Single row within the tools card
<div className="flex items-start gap-3 py-4 px-5">
  {/* Icon tile */}
  <div className="flex items-center justify-center shrink-0 w-9 h-9 rounded-[10px] bg-primary/10">
    <LucideIcon className="h-[18px] w-[18px] text-primary" />
  </div>
  {/* Text */}
  <div className="flex-1 min-w-0">
    <p className="text-sm font-semibold text-foreground">{label}</p>
    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
  </div>
  {/* Toggle */}
  <Switch checked={enabled} onCheckedChange={onToggle} className="shrink-0 mt-0.5" />
</div>
```

### 4.4 Smart Recommendations

Below the tool list, a "Recommendations" strip shows keyword-based suggestions. Each recommendation is a chip with a dismiss X. Clicking a recommendation enables the corresponding tool.

Recommendation logic runs client-side using the same keyword-matching described in the backend plan (Section 4.5):

```typescript
function getToolRecommendations(
  title: string,
  fields: FormFieldDefinition[],
  enabledTools: string[],
): ToolRecommendation[] {
  const recs: ToolRecommendation[] = [];
  const titleLower = title.toLowerCase();

  if (!enabledTools.includes('search_contacts')) {
    const hasContactField = fields.some(f => f.type === 'contact_lookup');
    const hasContactKeyword = /hospital|doctor|medical|emergency|call/.test(titleLower);
    if (hasContactField || hasContactKeyword) {
      recs.push({
        toolId: 'search_contacts',
        reason: hasContactField
          ? 'contact_lookup field detected'
          : 'Title suggests contact references',
      });
    }
  }
  // ... similar for search_manual, search_products, etc.
  return recs;
}
```

### 4.5 Toggle Behavior

- Toggling a tool ON: adds the tool `id` to `template.ai_tools` TEXT[] and triggers auto-save
- Toggling a tool OFF: removes the tool `id` from the array and triggers auto-save
- Deprecated tools (`status = 'deprecated'`): hidden from the picker, but existing templates that reference them continue to work

---

## 5. Field Block Design

### 5.1 Collapsed State

Each field in the builder field list renders as a collapsed row. This is the default view -- the admin sees all fields at a glance and can reorder them.

```
+--------------------------------------------------+
| [drag]  [Type Icon]  Employee Name   text  *req  |
+--------------------------------------------------+
```

The row contains:
- **Drag handle** (left): 6-dot grip icon (`GripVertical` from Lucide), visible on hover/touch
- **Type icon** (small): An icon representing the field type (e.g., `Type` for text, `Calendar` for date, `List` for select)
- **Label**: The field's `label` (or `label_es` based on current language)
- **Type badge**: Tiny pill showing the type name (`text`, `select`, `date`, etc.)
- **Required badge**: Red asterisk if `required = true`
- **Expand chevron** (right): Tapping the row or the chevron expands it for inline editing

### 5.2 Expanded State (Inline Editing)

Tapping a collapsed field row expands it in-place to show all configurable properties. No modal, no navigation -- the editing happens inline within the list, pushing other items down.

```
+--------------------------------------------------+
| [drag]  [Type Icon]  Employee Name   text  *req  |
|                                          [Collapse]|
|  +----- Field Properties ------------------+     |
|  |                                         |     |
|  |  Label (EN): [Employee Full Name     ]  |     |
|  |  Label (ES): [Nombre Completo        ]  |     |
|  |  Key:        [employee_name] (locked)   |     |
|  |  Type:       [text           v]         |     |
|  |  Required:   [x]                        |     |
|  |  Placeholder: [Enter full legal name ]  |     |
|  |  Hint:       [As it appears on ID    ]  |     |
|  |  AI Hint:    [Extract the employee's ]  |     |
|  |              [full name from input   ]  |     |
|  |  Width:      (o) Full  ( ) Half         |     |
|  |  Section:    [Employee Information   ]  |     |
|  |                                         |     |
|  |  [Delete Field]                         |     |
|  +-----------------------------------------+     |
+--------------------------------------------------+
```

**Conditional Properties (shown based on field type):**
- `select` / `radio` / `checkbox`: Shows an **Options Editor** -- a mini list where each option is an editable text row with a delete X and an "Add Option" button at the bottom.
- `contact_lookup`: Shows a **Category** dropdown (emergency, medical, management, vendor).
- `number`: Shows **Min** and **Max** inputs.
- `text` / `phone` / `email`: Shows a **Pattern** input for regex validation.
- All types except `header` and `instructions`: Show **Condition** editor (field dropdown + operator + value).

### 5.2a Property Panel: `instructions` Type

The `instructions` field type is a display-only paragraph shown to the form filler. It has no key/required/placeholder/ai_hint/options properties. The expanded panel shows:

```
+--------------------------------------------------+
| [drag]  [Info]  Instructions          inst.      |
|                                          [Collapse]|
|  +----- Field Properties ------------------+     |
|  |                                         |     |
|  |  Content (EN):                          |     |
|  |  +-------------------------------------+|     |
|  |  | Please complete all fields below.   ||     |
|  |  | This form will be reviewed by       ||     |
|  |  | management within 24 hours.         ||     |
|  |  +-------------------------------------+|     |
|  |                                         |     |
|  |  Content (ES):                          |     |
|  |  +-------------------------------------+|     |
|  |  | Por favor complete todos los campos.||     |
|  |  | Este formulario sera revisado por   ||     |
|  |  | la gerencia en 24 horas.            ||     |
|  |  +-------------------------------------+|     |
|  |                                         |     |
|  |  Width:      (o) Full  ( ) Half         |     |
|  |                                         |     |
|  |  [Delete Field]                         |     |
|  +-----------------------------------------+     |
+--------------------------------------------------+
```

**Property mapping:**
- **Content (EN)** textarea -- maps to the `hint` property on the `FormFieldDefinition`
- **Content (ES)** textarea -- maps to the `hint_es` property
- **Width** toggle (full/half) -- same as other fields

**Hidden / not applicable:**
- `label` / `label_es` -- not shown to the form filler, so not editable
- `placeholder`, `required`, `ai_hint` -- not applicable to display-only fields
- `options` -- not applicable
- `key` -- auto-generated (e.g., `instructions_1`, `instructions_2`) and hidden from the admin

### 5.2b Property Panel: `header` Type

The `header` field type is a section divider with bold heading text. It is always full-width and has no key/required/placeholder/ai_hint/options properties. The expanded panel shows:

```
+--------------------------------------------------+
| [drag]  [H]  Employee Information     header     |
|                                          [Collapse]|
|  +----- Field Properties ------------------+     |
|  |                                         |     |
|  |  Header Text (EN):                      |     |
|  |  [Employee Information              ]   |     |
|  |                                         |     |
|  |  Header Text (ES):                      |     |
|  |  [Informacion del Empleado          ]   |     |
|  |                                         |     |
|  |  Width: always Full (not editable)      |     |
|  |                                         |     |
|  |  [Delete Field]                         |     |
|  +-----------------------------------------+     |
+--------------------------------------------------+
```

**Property mapping:**
- **Header Text (EN)** input -- maps to the `label` property on the `FormFieldDefinition`
- **Header Text (ES)** input -- maps to the `label_es` property

**Hidden / not applicable:**
- `placeholder`, `required`, `ai_hint`, `options` -- not applicable
- `width` -- always `full`; the toggle is not rendered, just a read-only note
- `key` -- auto-generated (e.g., `header_1`, `header_2`) and hidden from the admin

### 5.3 Options Editor (for select/radio/checkbox)

Displayed within the expanded field block when the field type is `select`, `radio`, or `checkbox`.

```
  Options:
  +--------------------------------------+
  | 1. [FOH                      ] [X]  |
  | 2. [BOH                      ] [X]  |
  | 3. [Bar                      ] [X]  |
  | 4. [Management               ] [X]  |
  |                                      |
  | [+ Add Option]                       |
  +--------------------------------------+
```

- Each option is a simple text input with a delete button
- Options are ordered by their array index (drag-to-reorder is deferred -- simple up/down arrows or just sequential entry is sufficient)
- "Add Option" appends a new empty input and auto-focuses it
- Pressing Enter in the last option auto-adds a new one (fast entry)
- The DB trigger validates that options are non-empty (Rule 3 in the DB plan)

### 5.4 Drag-and-Drop Reorder

Uses `@dnd-kit/sortable` for field reordering. Only the collapsed rows participate in DnD -- an expanded field block is temporarily locked in place.

```typescript
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
```

**Sensors:**
- `PointerSensor` with `activationConstraint: { distance: 8 }` (8px movement threshold to distinguish taps from drags)
- `KeyboardSensor` with `sortableKeyboardCoordinates` for a11y

**Modifiers:**
- `restrictToVerticalAxis` -- fields only move up/down

**On drag end:** Update the `order` property of all affected fields and trigger auto-save.

### 5.5 Add Field Menu

A floating action button `[+ Add Field]` sits at the top of the field list. Tapping it opens a **field type picker**.

**Desktop:** Popover anchored to the button (shadcn/ui `Popover`).
**Mobile:** Bottom sheet (shadcn/ui `Sheet` with `side="bottom"`).

The picker shows a grid of field types, each as a tappable tile:

```
+-------------------------------------------+
|  Add Field                           [X]  |
+-------------------------------------------+
|                                           |
|  -- Input Fields -----------------------  |
|  [Aa]Text   [Lines]Textarea  [#]Number   |
|  [Phone]    [Mail]Email                   |
|                                           |
|  -- Date & Time ------------------------  |
|  [Cal]Date  [Clock]Time  [CalClock]Both   |
|                                           |
|  -- Choice Fields ----------------------  |
|  [List]Select  [Circle]Radio  [Check]Box  |
|                                           |
|  -- Special ----------------------------  |
|  [Pen]Signature  [Camera]Image  [File]    |
|  [Person]Contact  [H]Header  [Info]Inst.  |
|                                           |
+-------------------------------------------+
```

Each tile is `w-full sm:w-[calc(33%-8px)]` on mobile (3 per row). Selecting a type:
1. Creates a new `FormFieldDefinition` with sensible defaults for that type
2. Appends it to the end of the `fields` array with `order = lastOrder + 1`
3. Auto-generates a `key` from the label (e.g., `"field_7"` initially, renamed when label is set)
4. Scrolls the new field into view
5. Auto-expands the new field for editing

### 5.6 Section Headers

The `header` field type is treated specially in the builder:
- It renders as a full-width divider row with a section icon and bold text
- It is draggable -- dragging a header moves the header field only (see drag behavior below)
- Creating a new header field auto-fills `label` with "New Section" and focuses the label input

**Drag behavior for `header` fields:**
- Dragging a `header` field moves ONLY the header itself, NOT any fields below it
- If the admin wants to move an entire section, they must move the header and each field individually
- This is simpler to implement and avoids ambiguity about where a "section" ends (fields are not structurally owned by a header; the header is just another field with `type = 'header'` in the flat `fields` array)
- This decision is captured in Section 15.2, Open Design Question #2: "Should section drag-and-drop move all child fields?" -- deferred until user testing reveals frustration

### 5.7 Field Block AI Fillability Indicators

Each field block in the collapsed state shows a subtle visual indicator of its AI fillability status:

| Indicator | Condition | Visual |
|-----------|-----------|--------|
| Green dot | Field has `ai_hint` set and is a structured type (select, radio, date, etc.) | `bg-green-500` 6px dot |
| Amber dot | Field is fillable but missing `ai_hint` | `bg-amber-500` 6px dot |
| No dot | Non-fillable type (header, instructions, signature, image, file) | No indicator |

This gives the admin a quick visual scan of AI readiness without expanding each field.

---

## 6. Live Preview

### 6.1 Phone Frame

The live preview renders the form as users would see it, wrapped in a phone-shaped frame. The frame is purely decorative (no functional phone emulation).

```tsx
<div className="mx-auto w-[375px] h-[700px] rounded-[40px] border-[6px] border-foreground/10 dark:border-foreground/5 bg-background overflow-hidden shadow-2xl">
  {/* Notch */}
  <div className="mx-auto mt-2 w-[120px] h-[28px] rounded-full bg-foreground/10" />
  {/* Content */}
  <div className="h-full overflow-y-auto px-4 pt-3 pb-20">
    <FormBody
      fields={fields}
      values={{}}
      errors={{}}
      language={previewLanguage}
      onFieldChange={() => {}}
    />
  </div>
</div>
```

### 6.2 Preview Behavior

- **Real-time updates:** The preview re-renders on every change to `fields`, `title`, `description`. This uses the same `FormBody` + `FormSection` + `FormFieldRenderer` components as the viewer, in read-only mode (all inputs disabled, `onFieldChange` is a no-op).
- **Language toggle:** A small `[EN/ES]` toggle above the phone frame lets the admin preview both language variants.
- **Scroll sync:** Not implemented (too complex for marginal benefit). The preview scrolls independently.
- **Empty state:** When no fields exist, the preview shows a centered message: "Add fields to see a preview."

### 6.3 AI Fillability Score Badge

Below the phone frame, a circular progress badge shows the AI fillability score (computed by `computeAiFillabilityScore()` from the backend plan):

```
  [===========85%===]
  AI Fillability: 85/100

  Issues:
  - 2 fields missing ai_hint
```

Colors: red (<40), amber (40-70), green (>70). Clicking the score expands to show the issues list.

### 6.4 "Open in New Tab" Link

A small text link below the preview opens the form in its actual viewer URL (`/forms/:slug`) in a new tab. This lets the admin test the real form experience. Only visible if the template has been saved at least once (has an `id`).

---

## 7. AI Template Generation

### 7.1 Entry Point

The admin starts creating a form via the **Admin Forms List** page (`/admin/forms`). The "New Form" action offers two paths:

1. **Blank Form** -- Opens the builder with an empty template (title, 0 fields, draft status)
2. **AI Generate** -- Opens a `ChatIngestionPanel`-style flow where the admin describes the form

Both paths ultimately land on the same `AdminFormBuilder` page. The AI Generate path pre-fills the template with the AI's draft.

### 7.2 AI Generate Flow (ChatIngestionPanel Pattern)

The AI Generate flow reuses the `ChatIngestionPanel` visual pattern (same message bubbles, same input bar with mic + attachment + send buttons). The difference is in the system prompt and output format.

```
+--------------------------------------------+
|  AI Form Builder                    [X]    |
+--------------------------------------------+
|                                            |
|  [chef emoji]                              |
|  AI Form Builder                           |
|  Create a form by chatting or adding files |
|                                            |
|  [chat bubble] Describe your form          |
|  [attach]      Add files or images         |
|                                            |
+--------------------------------------------+
|  [attach] [mic]  [type here...]  [send]    |
+--------------------------------------------+
```

**Input modes (matching `ChatIngestionPanel`):**
- **Text:** Admin types "I need an injury report form"
- **Voice:** Admin speaks a description (transcribed via `transcribe` edge function)
- **Image:** Admin takes a photo of a paper form
- **File:** Admin uploads a Word/PDF/TXT document

**Output:** The AI returns a `GenerateTemplateResponse` (from the backend plan). The chat displays:
1. An AI message explaining what was generated
2. A **Draft Preview Card** showing: title, field count, section count, recommended tools
3. "Use This Draft" button and "Modify" button

### 7.3 Draft Preview Card

Renders inline in the chat, similar to `DraftPreviewCard` used in recipe ingestion:

```
+-----------------------------------------+
|  Generated Form Draft                    |
|                                          |
|  Employee Injury Report                  |
|  27 fields | 7 sections | 2 tools       |
|                                          |
|  Confidence: 92%                         |
|  Missing: [none]                         |
|                                          |
|  [Use This Draft]  [Modify]              |
+-----------------------------------------+
```

- **Use This Draft:** Navigates to `AdminFormBuilder` with the draft pre-loaded into all editor fields
- **Modify:** The admin can continue chatting ("Add a section for witnesses" or "Remove the signature fields") and the AI returns an updated draft

### 7.4 Desktop vs. Mobile for AI Generate

**Desktop:** The AI Generate flow opens as a full-page view (same as `/admin/forms/new` but with the chat panel as the primary content instead of the builder). On "Use This Draft", it transitions to the two-column builder with the draft pre-filled.

**Mobile:** The AI Generate flow is a full-screen sheet. On "Use This Draft", the sheet closes and the builder page renders with the draft.

---

## 8. Mobile Builder Experience

### 8.1 Tab-Based Navigation

The mobile builder uses a 3-segment tab bar at the top of the content area (below the header):

```tsx
<div className="flex rounded-lg bg-muted/50 p-0.5 mx-4 mt-3">
  {['Fields', 'Settings', 'Preview'].map((tab) => (
    <button
      key={tab}
      onClick={() => setActiveTab(tab)}
      className={cn(
        'flex-1 px-3 py-2 text-xs font-semibold rounded-md transition-colors',
        activeTab === tab
          ? 'bg-orange-500 text-white shadow-sm'
          : 'text-muted-foreground',
      )}
    >
      {tab}
    </button>
  ))}
</div>
```

This mirrors the `viewMode` toggle pattern from `FormToolbar`.

### 8.2 Fields Tab (Mobile)

The fields tab shows the draggable field list. Each collapsed field row is full-width. The drag handle is a left-edge grip area that responds to touch.

**Expanding a field on mobile:** Tapping a field row replaces the field list with a **full-screen field editor**. This avoids the cramped inline editing of desktop. The full-screen editor has:

- A header with the field label, type badge, and a "Done" button
- All field properties in a scrollable form
- Options editor (for select/radio/checkbox) with large touch targets
- "Delete Field" button at the bottom (red, requires confirmation)
- Swipe-right or "Done" to collapse back to the field list

```
+------------------------------------+
| <- Done    Employee Name    text   |
+------------------------------------+
|                                    |
|  Label (EN)                        |
|  [Employee Full Name            ]  |
|                                    |
|  Label (ES)                        |
|  [Nombre Completo               ]  |
|                                    |
|  Key                               |
|  [employee_name] (auto-generated)  |
|                                    |
|  Required  [x]                     |
|                                    |
|  Placeholder                       |
|  [Enter full legal name         ]  |
|                                    |
|  Hint                              |
|  [As it appears on their ID    ]  |
|                                    |
|  AI Hint                           |
|  [Extract the employee's full   ]  |
|  [name from the input           ]  |
|                                    |
|  Width                             |
|  (o) Full Width  ( ) Half Width    |
|                                    |
|  [Delete Field]                    |
|                                    |
+------------------------------------+
```

### 8.3 Settings Tab (Mobile)

A single scrollable view containing:

1. **Form Metadata** card: Title (EN/ES), Description (EN/ES), Icon picker, Header image
2. **Instructions** card: Instructions textarea (EN/ES) with "AI Refine" button
3. **AI Tools** card: Tool toggles with descriptions

All within `bg-card rounded-[20px]` containers matching the existing card style.

### 8.4 Preview Tab (Mobile)

A full-width read-only rendering of the form using `FormBody`. No phone frame on mobile (the phone IS the preview). A language toggle `[EN/ES]` at the top lets the admin check both variants.

### 8.5 Mobile Floating Toolbar

A frosted-glass pill at the bottom (matching `FormToolbar`) with:

```
[ + Add Field ]  <spacer>  [ Publish ]
```

- **+ Add Field:** Opens the field type picker as a bottom sheet
- **Publish:** Publishes the template (or "Save Draft" if already published)

The toolbar sits at `bottom-[72px]` to clear the `MobileTabBar`, matching the positioning of the existing `FormToolbar`.

---

## 9. Admin Forms List

### 9.1 Route

`/admin/forms` -- accessible from the Admin page or the main navigation (admin users only).

### 9.2 Layout

A list/table of all form templates (draft + published + archived) for the current group. On mobile, renders as a card list. On desktop, renders as a compact table.

**Mobile card list:**

```
+------------------------------------+
| <- Back      Form Templates        |
+------------------------------------+
|  [Search forms...]                 |
+------------------------------------+
|                                    |
|  +--------------------------------+|
|  | [icon] Employee Write-Up       ||
|  | Draft | v1 | 18 fields         ||
|  | Last edited: 2 hours ago       ||
|  |                     [Edit] [..] ||
|  +--------------------------------+|
|                                    |
|  +--------------------------------+|
|  | [icon] Employee Injury Report  ||
|  | Published | v3 | 27 fields     ||
|  | Published: Feb 24              ||
|  |                     [Edit] [..] ||
|  +--------------------------------+|
|                                    |
+------------------------------------+
| [+ New Form]  [AI Generate]       |
+------------------------------------+
```

**Desktop table:**

```
+----------------------------------------------------------------+
| Form Templates                    [Search...]  [+ New]  [AI]  |
+----------------------------------------------------------------+
| Title                  | Status    | Version | Fields | Actions|
+----------------------------------------------------------------+
| Employee Write-Up      | published | v3      | 18     | [Edit] |
| Employee Injury Report | published | v5      | 27     | [Edit] |
| Daily Checklist        | draft     | v1      | 12     | [Edit] |
+----------------------------------------------------------------+
```

### 9.3 Status Badges

| Status | Badge Style |
|--------|-------------|
| `draft` | `bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300` |
| `published` | `bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300` |
| `archived` | `bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400` |

### 9.4 Actions Menu

Each row has an overflow menu (`...`) with:
- **Edit** -- navigates to `/admin/forms/:id/edit`
- **Duplicate** -- creates a copy as a new draft
- **Publish / Unpublish** -- toggles status
- **Archive** -- sets status to `archived`
- **Delete** -- only for never-published templates with 0 submissions. Shows confirmation dialog.

### 9.5 Editing a Published Template

**Decision**: Editing a published template keeps `status = 'published'`. Changes are saved via auto-save as usual. The admin sees an amber indicator "Unpublished changes" next to the status badge.

**Flow:**

1. Admin opens a published template in the builder (`/admin/forms/:id/edit`)
2. Admin makes edits (add/remove/reorder fields, update settings, etc.)
3. Auto-save persists changes to the `fields` JSONB and other columns immediately
4. The status badge shows: `Published` with an amber dot and text "Unpublished changes"
5. A "Publish Changes" button appears (primary, `bg-orange-500`), replacing the normal "Save Draft" button
6. Clicking "Publish Changes" fires the publish trigger, which bumps `template_version` and clears `builder_state`
7. Live form fillers see the updated fields immediately after publish

```
+--------------------------------------------------+
|  <- Back     Form Builder                         |
|              [Published] ● Unpublished changes    |
|                              [Publish Changes]    |
+--------------------------------------------------+
```

**While editing (between steps 2 and 6):** The published form is still live with the PREVIOUS version's fields. Only after "Publish Changes" do form fillers see the updates. This is because the `fields` column is updated immediately by auto-save, but `template_version` only increments on explicit publish. The form viewer keys on `template_version` + `fields` snapshot to decide what to render -- it should cache the last-published snapshot until a new publish event is detected.

**Amber indicator behavior:**
- The amber dot and "Unpublished changes" text appear as soon as the first edit is made after opening a published template
- The indicator clears when the admin clicks "Publish Changes" and the publish succeeds
- If the admin discards all changes (unlikely without undo/redo, but possible via browser refresh), the indicator also clears

**Alternative considered and rejected**: Auto-reverting `status` to `draft` on first edit was rejected because it would make the form disappear from the staff forms list (RLS filters by `status = 'published'`), causing confusion for staff who suddenly cannot find the form.

**`BuilderHeaderProps` update:** The `BuilderHeaderProps` interface (Section 11.2) gains two additional props to support this flow:

```typescript
interface BuilderHeaderProps {
  // ... existing props ...
  hasUnpublishedChanges: boolean;   // true when editing a published template with unsaved publish
  onPublishChanges: () => void;     // fires publish trigger for a published template
}
```

---

## 10. Component File Map

### 10.1 New Page Components

| # | File Path | Description |
|---|-----------|-------------|
| 1 | `src/pages/AdminFormsList.tsx` | Admin forms list page -- table/card list of all templates with search, status filter, and actions |
| 2 | `src/pages/AdminFormBuilder.tsx` | Main builder page -- orchestrates editor + preview layout, manages template state |

### 10.2 Builder Components

| # | File Path | Description |
|---|-----------|-------------|
| 3 | `src/components/forms/builder/BuilderLayout.tsx` | Two-column desktop / tabbed mobile layout shell |
| 4 | `src/components/forms/builder/BuilderHeader.tsx` | Top bar with back, title, save draft, publish buttons |
| 5 | `src/components/forms/builder/BuilderTabBar.tsx` | Mobile-only 3-segment tab bar (Fields / Settings / Preview) |
| 6 | `src/components/forms/builder/BuilderToolbar.tsx` | Mobile floating toolbar with Add Field + Publish |
| 7 | `src/components/forms/builder/FormMetadataEditor.tsx` | Title (EN/ES), description (EN/ES), icon picker, header image uploader |
| 8 | `src/components/forms/builder/InstructionsEditor.tsx` | Instructions textarea (EN/ES tabs) + "AI Refine" button + character count |
| 9 | `src/components/forms/builder/InstructionsRefinePanel.tsx` | AI Refine chat sidebar (desktop) / sheet (mobile) -- calls `refine-form-instructions` |
| 10 | `src/components/forms/builder/RefineResultCard.tsx` | Rendered in the refine chat -- shows refined instructions + explanation + Apply/Edit buttons |
| 11 | `src/components/forms/builder/AIToolsPicker.tsx` | List of tool toggle cards from `form_ai_tools` + recommendations strip |
| 12 | `src/components/forms/builder/AIToolCard.tsx` | Single tool row: icon tile + label + description + Switch toggle |
| 13 | `src/components/forms/builder/ToolRecommendation.tsx` | Recommendation chip with dismiss X and auto-enable on click |
| 14 | `src/components/forms/builder/DraggableFieldList.tsx` | `@dnd-kit/sortable` wrapper around the field block list |
| 15 | `src/components/forms/builder/FieldBlock.tsx` | Collapsed/expanded field row -- the core builder unit |
| 16 | `src/components/forms/builder/FieldBlockCollapsed.tsx` | Collapsed state: drag handle, type icon, label, type badge, required badge |
| 17 | `src/components/forms/builder/FieldBlockExpanded.tsx` | Expanded state: all field properties in an inline form |
| 18 | `src/components/forms/builder/FieldOptionsEditor.tsx` | Mini-list for editing select/radio/checkbox options |
| 19 | `src/components/forms/builder/FieldConditionEditor.tsx` | Condition builder: field picker + operator + value |
| 20 | `src/components/forms/builder/FieldTypePicker.tsx` | Grid of field type tiles (Popover on desktop, Sheet on mobile) |
| 21 | `src/components/forms/builder/MobileFieldEditor.tsx` | Full-screen field property editor for mobile |
| 22 | `src/components/forms/builder/LivePreview.tsx` | Phone-frame wrapper around read-only `FormBody` |
| 23 | `src/components/forms/builder/AIFillabilityBadge.tsx` | Circular progress badge showing fillability score + issues |
| 24 | `src/components/forms/builder/TemplateGeneratePanel.tsx` | ChatIngestionPanel-style flow for AI template generation |
| 25 | `src/components/forms/builder/TemplateDraftCard.tsx` | Draft preview card rendered in the generate chat |
| 26 | `src/components/forms/builder/IconPicker.tsx` | Grid picker for Lucide icon names (subset relevant to forms) |
| 27 | `src/components/forms/builder/AdminFormCard.tsx` | Card/row for the admin forms list -- title, status badge, actions menu |

### 10.3 New Hooks

| # | File Path | Description |
|---|-----------|-------------|
| 28 | `src/hooks/use-form-builder.ts` | Core builder state: template CRUD, field CRUD, auto-save, publish, slug generation, optimistic concurrency |
| 29 | `src/hooks/use-form-ai-tools.ts` | Fetches `form_ai_tools` table, returns tool list with loading/error state |
| 30 | `src/hooks/use-refine-instructions.ts` | Calls `refine-form-instructions` edge function, manages conversation history |
| 31 | `src/hooks/use-generate-template.ts` | Calls `generate-form-template` edge function, manages chat flow |
| 32 | `src/hooks/use-admin-templates.ts` | Fetches all templates (draft + published + archived) for admin list |

### 10.4 Utility Files

| # | File Path | Description |
|---|-----------|-------------|
| 33 | `src/lib/field-defaults.ts` | Default `FormFieldDefinition` values per field type (used when adding new fields) |
| 34 | `src/lib/ai-fillability.ts` | `computeAiFillabilityScore()` and `getToolRecommendations()` functions |
| 35 | `src/lib/slug-utils.ts` | `generateSlug()` and `checkSlugAvailability()` functions |

### 10.5 Type Extensions

| # | File Path | Description |
|---|-----------|-------------|
| 36 | `src/types/form-builder.ts` | Builder-specific types: `BuilderTab`, `FormTemplateDraft`, `FieldBlockState`, `RefineResult`, `GenerateResult`, `ToolRecommendation` |

**Total: ~36 new files** (27 components, 5 hooks, 3 utilities, 1 type file).

---

## 11. Props Interfaces

### 11.1 Core Builder

```typescript
// src/types/form-builder.ts

/** Which tab is active on mobile */
export type BuilderTab = 'fields' | 'settings' | 'preview';

/** Transient builder state for a single field */
export interface FieldBlockState {
  isExpanded: boolean;
  isDragging: boolean;
}

/** Draft template being edited (superset of FormTemplate for unsaved state) */
export interface FormTemplateDraft {
  id?: string;                       // undefined for new templates
  slug: string;
  titleEn: string;
  titleEs: string;
  descriptionEn: string;
  descriptionEs: string;
  icon: string;
  headerImage: string | null;
  fields: FormFieldDefinition[];
  instructionsEn: string;
  instructionsEs: string;
  aiTools: string[];
  status: FormTemplateStatus;
  templateVersion: number;
  // Builder-only state (not persisted to DB as template columns)
  expandedFieldKey: string | null;
  activeTab: BuilderTab;
}

/** Tool from form_ai_tools table */
export interface FormAITool {
  id: string;
  labelEn: string;
  labelEs: string;
  descriptionEn: string;
  descriptionEs: string;
  icon: string;
  status: 'active' | 'deprecated';
  sortOrder: number;
}

/** Smart tool recommendation */
export interface ToolRecommendation {
  toolId: string;
  reason: string;
  reasonEs?: string;
}

/** Result from refine-form-instructions edge function */
export interface RefineResult {
  refinedInstructions: string;
  explanation: string;
  suggestions: string[];
}

/** Result from generate-form-template edge function */
export interface GenerateResult {
  draft: Omit<FormTemplateDraft, 'id' | 'status' | 'templateVersion' | 'expandedFieldKey' | 'activeTab'>;
  confidence: number;
  missingFields: string[];
  aiMessage: string;
  toolRecommendations: ToolRecommendation[];
}
```

### 11.2 Component Props

```typescript
/** BuilderLayout */
interface BuilderLayoutProps {
  editor: React.ReactNode;
  preview: React.ReactNode;
  refineSidebar?: React.ReactNode;
  isRefineSidebarOpen: boolean;
}

/** BuilderHeader */
interface BuilderHeaderProps {
  title: string;
  language: 'en' | 'es';
  isDirty: boolean;
  isSaving: boolean;
  canPublish: boolean;
  status: FormTemplateStatus;
  onBack: () => void;
  onSaveDraft: () => void;
  onPublish: () => void;
  onUnpublish: () => void;
}

/** FieldBlock (collapsed + expanded combined) */
interface FieldBlockProps {
  field: FormFieldDefinition;
  index: number;
  isExpanded: boolean;
  allFieldKeys: string[];       // For condition editor field picker
  language: 'en' | 'es';
  onToggleExpand: () => void;
  onUpdate: (updates: Partial<FormFieldDefinition>) => void;
  onDelete: () => void;
  /** @dnd-kit sortable props */
  dragHandleProps?: Record<string, unknown>;
  isDragging?: boolean;
}

/** FieldTypePicker */
interface FieldTypePickerProps {
  open: boolean;
  onClose: () => void;
  onSelectType: (type: FormFieldType) => void;
  language: 'en' | 'es';
}

/** AIToolsPicker */
interface AIToolsPickerProps {
  enabledTools: string[];
  onToggleTool: (toolId: string, enabled: boolean) => void;
  recommendations: ToolRecommendation[];
  onAcceptRecommendation: (toolId: string) => void;
  onDismissRecommendation: (toolId: string) => void;
  language: 'en' | 'es';
}

/** AIToolCard */
interface AIToolCardProps {
  tool: FormAITool;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  language: 'en' | 'es';
}

/** InstructionsEditor */
interface InstructionsEditorProps {
  instructionsEn: string;
  instructionsEs: string;
  onChangeEn: (value: string) => void;
  onChangeEs: (value: string) => void;
  onOpenRefine: (language: 'en' | 'es') => void;
  language: 'en' | 'es';
}

/** InstructionsRefinePanel (desktop sidebar / mobile sheet) */
interface InstructionsRefinePanelProps {
  open: boolean;
  onClose: () => void;
  currentInstructions: string;
  templateContext: {
    title: string;
    fields: FormFieldDefinition[];
    enabledTools: string[];
  };
  language: 'en' | 'es';
  onApply: (refinedInstructions: string) => void;
}

/** LivePreview */
interface LivePreviewProps {
  fields: FormFieldDefinition[];
  title: string;
  description: string;
  icon: string;
  language: 'en' | 'es';
  fillabilityScore: number;
  fillabilityIssues: string[];
  slug?: string;
}

/** MobileFieldEditor */
interface MobileFieldEditorProps {
  field: FormFieldDefinition;
  allFieldKeys: string[];
  language: 'en' | 'es';
  onUpdate: (updates: Partial<FormFieldDefinition>) => void;
  onDelete: () => void;
  onDone: () => void;
}

/** TemplateGeneratePanel */
interface TemplateGeneratePanelProps {
  open: boolean;
  onClose: () => void;
  onUseDraft: (draft: GenerateResult) => void;
  language: 'en' | 'es';
  groupId: string;
}

/** AdminFormCard */
interface AdminFormCardProps {
  template: FormTemplate;
  language: 'en' | 'es';
  onEdit: (id: string) => void;
  onDuplicate: (id: string) => void;
  onTogglePublish: (id: string, publish: boolean) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
}

/** FormMetadataEditor */
interface FormMetadataEditorProps {
  titleEn: string;
  titleEs: string;
  descriptionEn: string;
  descriptionEs: string;
  icon: string;
  headerImage: string | null;
  slug: string;
  isSlugLocked: boolean;          // true after first publish
  language: 'en' | 'es';
  onChangeTitleEn: (v: string) => void;
  onChangeTitleEs: (v: string) => void;
  onChangeDescriptionEn: (v: string) => void;
  onChangeDescriptionEs: (v: string) => void;
  onChangeIcon: (icon: string) => void;
  onChangeHeaderImage: (url: string | null) => void;
  onChangeSlug: (slug: string) => void;
}

/** IconPicker */
interface IconPickerProps {
  selected: string;
  onSelect: (icon: string) => void;
  language: 'en' | 'es';
}

/** FieldOptionsEditor */
interface FieldOptionsEditorProps {
  options: string[];
  onChange: (options: string[]) => void;
  language: 'en' | 'es';
}

/** FieldConditionEditor */
interface FieldConditionEditorProps {
  condition: FormFieldCondition | null;
  availableFields: Array<{ key: string; label: string; type: FormFieldType }>;
  onChange: (condition: FormFieldCondition | null) => void;
  language: 'en' | 'es';
}

/** AIFillabilityBadge */
interface AIFillabilityBadgeProps {
  score: number;
  issues: string[];
  language: 'en' | 'es';
}
```

### 11.3 Hook Interfaces

```typescript
/** useFormBuilder return type */
interface UseFormBuilderReturn {
  // Template state
  draft: FormTemplateDraft;
  isDirty: boolean;
  isSaving: boolean;
  isPublishing: boolean;
  lastSavedAt: Date | null;
  // Template actions
  updateMetadata: (updates: Partial<FormTemplateDraft>) => void;
  saveDraft: () => Promise<void>;
  publish: () => Promise<void>;
  unpublish: () => Promise<void>;
  // Field actions
  addField: (type: FormFieldType) => void;
  updateField: (key: string, updates: Partial<FormFieldDefinition>) => void;
  deleteField: (key: string) => void;
  reorderFields: (oldIndex: number, newIndex: number) => void;
  // UI state
  expandedFieldKey: string | null;
  setExpandedFieldKey: (key: string | null) => void;
  activeTab: BuilderTab;
  setActiveTab: (tab: BuilderTab) => void;
  // Computed
  fillabilityScore: number;
  fillabilityIssues: string[];
  toolRecommendations: ToolRecommendation[];
  // Errors
  validationErrors: Record<string, string>;
  saveError: string | null;
}

/** useFormAITools return type */
interface UseFormAIToolsReturn {
  tools: FormAITool[];
  isLoading: boolean;
  error: Error | null;
}

/** useRefineInstructions return type */
interface UseRefineInstructionsReturn {
  refine: (rawInstructions: string) => Promise<RefineResult | null>;
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string; result?: RefineResult }>;
  isLoading: boolean;
  error: string | null;
  clear: () => void;
}

/** useGenerateTemplate return type */
interface UseGenerateTemplateReturn {
  generate: (input: { description?: string; imageBase64?: string; fileContent?: string }) => Promise<GenerateResult | null>;
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string; result?: GenerateResult }>;
  isLoading: boolean;
  error: string | null;
  clear: () => void;
}

/** useAdminTemplates return type */
interface UseAdminTemplatesReturn {
  templates: FormTemplate[];
  isLoading: boolean;
  error: Error | null;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  statusFilter: FormTemplateStatus | 'all';
  setStatusFilter: (filter: FormTemplateStatus | 'all') => void;
}
```

---

## 12. ASCII Mockups

### 12.1 Desktop Builder -- Two-Column Layout

```
+==============================================================================+
|  <- Back to Forms       Form Builder                  [Save Draft] [Publish] |
+===============================================+==============================+
|  EDITOR (scrollable, flex-1)                  |  PREVIEW (w-80 xl:w-96)      |
|                                               |                              |
|  +--- Form Details -------- rounded-[20px] -+ |  [EN] [ES]                   |
|  |                                           | |                              |
|  |  Title (EN)                               | |  +-- Phone Frame ----------+ |
|  |  [Employee Write-Up                    ]  | |  | +----------------------+ | |
|  |                                           | |  | | notch                | | |
|  |  Title (ES)                               | |  | +----------------------+ | |
|  |  [Escrito de Empleado                  ]  | |  |                        | | |
|  |                                           | |  | Employee Write-Up      | | |
|  |  Description (EN)                         | |  |                        | | |
|  |  [Document employee performance...]       | |  | -- Employee Info --    | | |
|  |                                           | |  | +------------------+  | | |
|  |  Description (ES)                         | |  | | Name: ________  |  | | |
|  |  [Documentar problemas de...]             | |  | | Position: ___  |  | | |
|  |                                           | |  | | Department: [v]|  | | |
|  |  Icon  [ClipboardList v]   Slug           | |  | +------------------+  | | |
|  |                            [employee-     | |  |                        | | |
|  |                             write-up]     | |  | -- Write-Up Details -- | | |
|  +-------------------------------------------+ |  | +------------------+  | | |
|                                               | |  | | Date: [cal]     |  | | |
|  +--- Instructions -------- rounded-[20px] -+ | |  | | Type: [v]       |  | | |
|  |                                           | |  | | Severity: (o)   |  | | |
|  |  [EN] [ES]                                | |  | +------------------+  | | |
|  |  +-------------------------------------+ | |  |                        | | |
|  |  | 1. Identify the employee and their  | | |  +------------------------+ | |
|  |  |    role from the user's description | | |                              |
|  |  | 2. Determine the type of violation  | | |  AI Fillability: [====85%==] |
|  |  | 3. Use search_manual to find the    | | |  2 fields missing ai_hint    |
|  |  |    relevant policy...               | | |                              |
|  |  +-------------------------------------+ | |  [Open in new tab ->]        |
|  |                                           | |                              |
|  |  342 / 5,000       [Sparkles] AI Refine   | |                              |
|  +-------------------------------------------+ +==============================+
|                                               |
|  +--- AI Tools ------------ rounded-[20px] -+ |
|  |                                           | |
|  |  [BookUser] Search Contacts     [==ON==]  | |
|  |  Search the restaurant's contact          | |
|  |  directory (hospitals, vendors...)        | |
|  |  ---------------------------------------- | |
|  |  [BookOpen] Search Manual       [==ON==]  | |
|  |  Search restaurant policies and SOPs      | |
|  |  ---------------------------------------- | |
|  |  [Utensils] Search Products     [off   ]  | |
|  |  Search menu, recipes, wines              | |
|  |  ---------------------------------------- | |
|  |  [Star] Restaurant Standards    [off   ]  | |
|  |  Search quality standards, dress code     | |
|  |  ---------------------------------------- | |
|  |  [ListChk] Steps of Service     [off   ]  | |
|  |  Search FOH procedures, service flow      | |
|  |                                           | |
|  |  Recommendations:                         | |
|  |  [x Enable Search Manual -- "write-up"   | |
|  |     in title suggests policy refs]        | |
|  +-------------------------------------------+ |
|                                               |
|  +--- Fields -------------- rounded-[20px] -+ |
|  |                                           | |
|  |  [+ Add Field]                            | |
|  |                                           | |
|  |  [::::] [H] Employee Information          | |
|  |  ---------------------------------------- | |
|  |  [::::] [Aa] Employee Name    text *  [o] | |
|  |  ---------------------------------------- | |
|  |  [::::] [Aa] Position         text *  [o] | |
|  |  ---------------------------------------- | |
|  |  [::::] [Ls] Department       select* [o] | |
|  |  ---------------------------------------- | |
|  |  [::::] [Ca] Date of Hire     date    [o] | |
|  |  ---------------------------------------- | |
|  |                                           | |
|  |  [::::] [H] Write-Up Details              | |
|  |  ---------------------------------------- | |
|  |  [::::] [Ca] Date of Incident date *  [o] | |
|  |  ---------------------------------------- | |
|  |  [::::] [Ls] Type of Violation sel. * [v] | |
|  |         |                                || |
|  |         | EXPANDED FIELD PROPERTIES      || |
|  |         |                                || |
|  |         | Label (EN): [Type of Violat..] || |
|  |         | Label (ES): [Tipo de Violac..] || |
|  |         | Key: [violation_type] (locked) || |
|  |         | Type: [select v]               || |
|  |         | Required: [x]                  || |
|  |         |                                || |
|  |         | Options:                       || |
|  |         | 1. [Attendance          ] [X]  || |
|  |         | 2. [Performance         ] [X]  || |
|  |         | 3. [Conduct             ] [X]  || |
|  |         | 4. [Policy              ] [X]  || |
|  |         | 5. [Safety              ] [X]  || |
|  |         | 6. [Other               ] [X]  || |
|  |         | [+ Add Option]                 || |
|  |         |                                || |
|  |         | AI Hint:                       || |
|  |         | [Determine from keywords:     ]|| |
|  |         | [late=Attendance, rude=Conduct ]|| |
|  |         |                                || |
|  |         | [Delete Field]                 || |
|  |         +--------------------------------+| |
|  |  ---------------------------------------- | |
|  |  [::::] [Ci] Severity       radio *   [o] | |
|  |  ---------------------------------------- | |
|  |  ...                                      | |
|  +-------------------------------------------+ |
+===============================================+
```

### 12.2 Desktop Builder -- AI Refine Sidebar Open

```
+==============================================================================+
|  <- Back to Forms       Form Builder                  [Save Draft] [Publish] |
+===============================================+==============================+
|  EDITOR (scrollable)                          |  AI Refine Instructions       |
|                                               |  [Preview] [AI Refine]    [X] |
|  (same editor content as above)               +==============================+
|                                               |                              |
|                                               |  (conversation area)         |
|                                               |                              |
|                                               |    You:                      |
|                                               |    "Check employee handbook  |
|                                               |     for rules broken"        |
|                                               |                              |
|                                               |    AI:                       |
|                                               |    +------------------------+|
|                                               |    | Refined Instructions:  ||
|                                               |    | 1. Identify the        ||
|                                               |    |    employee and role   ||
|                                               |    | 2. Determine the type  ||
|                                               |    |    of violation...     ||
|                                               |    | 3. Use search_manual   ||
|                                               |    |    to find the policy  ||
|                                               |    +------------------------+|
|                                               |    I refined your            |
|                                               |    instructions to name      |
|                                               |    the search_manual tool... |
|                                               |                              |
|                                               |    [Apply]  [Edit]           |
|                                               |                              |
|                                               +------------------------------+
|                                               |  [type follow-up...]  [send] |
|                                               +==============================+
```

### 12.3 Mobile Builder -- Fields Tab

```
+------------------------------------+
|  <- Back    Form Builder    [Save] |
+------------------------------------+
| [*Fields*] [Settings] [Preview]    |
+------------------------------------+
|                                    |
|  [+ Add Field]                     |
|                                    |
|  +-------------------------------+ |
|  | [::::] [H] Employee Info      | |
|  +-------------------------------+ |
|  | [::::] [Aa] Employee Name   * | |
|  +-------------------------------+ |
|  | [::::] [Aa] Position        * | |
|  +-------------------------------+ |
|  | [::::] [Ls] Department      * | |
|  +-------------------------------+ |
|  | [::::] [Ca] Date of Hire      | |
|  +-------------------------------+ |
|                                    |
|  +-------------------------------+ |
|  | [::::] [H] Write-Up Details   | |
|  +-------------------------------+ |
|  | [::::] [Ca] Date of Incident* | |
|  +-------------------------------+ |
|  | [::::] [Ls] Type of Viol.   * | |
|  +-------------------------------+ |
|  | ...                           | |
|                                    |
+------------------------------------+
| [glass: + Add Field    [Publish] ] |
+------------------------------------+
```

### 12.4 Mobile Builder -- Full-Screen Field Editor

```
+------------------------------------+
|  <- Done   Employee Name    text   |
+------------------------------------+
|                                    |
|  Label (EN)                        |
|  +------------------------------+  |
|  | Employee Full Name           |  |
|  +------------------------------+  |
|                                    |
|  Label (ES)                        |
|  +------------------------------+  |
|  | Nombre Completo del Empleado |  |
|  +------------------------------+  |
|                                    |
|  Key (auto-generated)              |
|  +------------------------------+  |
|  | employee_name                |  |
|  +------------------------------+  |
|                                    |
|  Type                              |
|  +------------------------------+  |
|  | text                      v  |  |
|  +------------------------------+  |
|                                    |
|  Required                   [x]   |
|                                    |
|  Placeholder                       |
|  +------------------------------+  |
|  | Enter employee's full name   |  |
|  +------------------------------+  |
|                                    |
|  Hint                              |
|  +------------------------------+  |
|  | As it appears on their ID    |  |
|  +------------------------------+  |
|                                    |
|  AI Hint                           |
|  +------------------------------+  |
|  | Extract the employee's full  |  |
|  | name from the user's input   |  |
|  +------------------------------+  |
|                                    |
|  Width                             |
|  (o) Full Width  ( ) Half Width    |
|                                    |
|  Section                           |
|  +------------------------------+  |
|  | Employee Information         |  |
|  +------------------------------+  |
|                                    |
|                                    |
|  [Delete Field]  <- destructive    |
|                                    |
+------------------------------------+
```

### 12.5 Mobile Builder -- Settings Tab

```
+------------------------------------+
|  <- Back    Form Builder    [Save] |
+------------------------------------+
| [Fields] [*Settings*] [Preview]    |
+------------------------------------+
|                                    |
|  +--- Form Details --------card--+ |
|  |                               | |
|  | Title (EN)                    | |
|  | [Employee Write-Up         ]  | |
|  |                               | |
|  | Title (ES)                    | |
|  | [Escrito de Empleado       ]  | |
|  |                               | |
|  | Description (EN)              | |
|  | [Document employee...]        | |
|  |                               | |
|  | Description (ES)              | |
|  | [Documentar problemas...]     | |
|  |                               | |
|  | Icon  [ClipboardList   v]     | |
|  | Slug  [employee-write-up]     | |
|  +-------------------------------+ |
|                                    |
|  +--- Instructions ---------card-+ |
|  |                               | |
|  | [EN] [ES]                     | |
|  | +---------------------------+ | |
|  | | 1. Identify the employee  | | |
|  | | 2. Determine the type...  | | |
|  | +---------------------------+ | |
|  | 342/5000  [Sparkles] AI Ref.  | |
|  +-------------------------------+ |
|                                    |
|  +--- AI Tools -------------card-+ |
|  |                               | |
|  | [BookUser] Contacts   [==ON]  | |
|  | Search contact directory...   | |
|  | ----------------------------- | |
|  | [BookOpen] Manual     [==ON]  | |
|  | Search policies and SOPs...   | |
|  | ----------------------------- | |
|  | [Utensils] Products   [off ]  | |
|  | Search menu and recipes...    | |
|  | ----------------------------- | |
|  | [Star] Standards      [off ]  | |
|  | Search quality standards...   | |
|  | ----------------------------- | |
|  | [ListChk] Steps/Serv  [off ]  | |
|  | Search FOH procedures...      | |
|  |                               | |
|  | Recommendations:              | |
|  | [Enable Manual - title]       | |
|  +-------------------------------+ |
|                                    |
+------------------------------------+
```

### 12.6 AI Template Generation -- Chat Flow

```
+------------------------------------+
|  AI Form Builder             [X]   |
+------------------------------------+
|                                    |
|  [chef icon]                       |
|  AI Form Builder                   |
|  Create a form by chatting or      |
|  adding files and images           |
|                                    |
|  [chat] Describe your form         |
|  [clip] Add files or images        |
|                                    |
|  --------------------------------  |
|                                    |
|     "I need a daily kitchen        |
|      temperature log form"         |
|                                    |
|  AI:                               |
|  I've designed a daily kitchen     |
|  temperature log with 15 fields    |
|  across 3 sections...              |
|                                    |
|  +------------------------------+  |
|  | Generated Form Draft         |  |
|  |                              |  |
|  | Daily Kitchen Temp Log       |  |
|  | 15 fields | 3 sections       |  |
|  | Tools: search_manual         |  |
|  | Confidence: 88%              |  |
|  |                              |  |
|  | [Use This Draft] [Modify]    |  |
|  +------------------------------+  |
|                                    |
+------------------------------------+
| [clip] [mic]  [type...]   [send]   |
+------------------------------------+
```

### 12.7 Field Type Picker -- Mobile Bottom Sheet

```
+------------------------------------+
|                                    |
|  Add Field                    [X]  |
|                                    |
|  -- Input Fields ----------------  |
|  +--------+ +--------+ +--------+ |
|  | [Aa]   | | [Lines]| | [#]    | |
|  | Text   | |Textarea| | Number | |
|  +--------+ +--------+ +--------+ |
|  +--------+ +--------+            |
|  | [Phone]| | [Mail] |            |
|  | Phone  | | Email  |            |
|  +--------+ +--------+            |
|                                    |
|  -- Date & Time -----------------  |
|  +--------+ +--------+ +--------+ |
|  | [Cal]  | | [Clock]| | [Both] | |
|  | Date   | | Time   | |DateTime| |
|  +--------+ +--------+ +--------+ |
|                                    |
|  -- Choice Fields ---------------  |
|  +--------+ +--------+ +--------+ |
|  | [List] | | [Circ] | | [Check]| |
|  | Select | | Radio  | |Checkbox| |
|  +--------+ +--------+ +--------+ |
|                                    |
|  -- Special ---------------------  |
|  +--------+ +--------+ +--------+ |
|  | [Pen]  | | [Cam]  | | [File] | |
|  |Signatu.| | Image  | | File   | |
|  +--------+ +--------+ +--------+ |
|  +--------+ +--------+ +--------+ |
|  | [User] | | [H]    | | [Info] | |
|  |Contact | | Header | | Instru.| |
|  +--------+ +--------+ +--------+ |
|                                    |
+------------------------------------+
```

### 12.8 Admin Forms List -- Mobile

```
+------------------------------------+
|  <- Back      Form Templates       |
+------------------------------------+
|  [Search forms...              Q]  |
|  [All] [Draft] [Published] [Arch]  |
+------------------------------------+
|                                    |
|  +-------------------------------+ |
|  | [Clipboard]                   | |
|  | Employee Write-Up             | |
|  | [published] v3 | 18 fields    | |
|  | Published: Feb 24, 2026       | |
|  |                   [Edit] [...] | |
|  +-------------------------------+ |
|                                    |
|  +-------------------------------+ |
|  | [Shield]                      | |
|  | Employee Injury Report        | |
|  | [published] v5 | 27 fields    | |
|  | Published: Feb 20, 2026       | |
|  |                   [Edit] [...] | |
|  +-------------------------------+ |
|                                    |
|  +-------------------------------+ |
|  | [Checklist]                   | |
|  | Daily Kitchen Checklist       | |
|  | [draft] v1 | 12 fields        | |
|  | Last edited: 2 hours ago      | |
|  |                   [Edit] [...] | |
|  +-------------------------------+ |
|                                    |
+------------------------------------+
| [+ New Form]     [AI Generate]     |
+------------------------------------+
```

---

## 13. Tailwind Class Reference

### 13.1 Builder Cards

```css
/* Card container (all sections: metadata, instructions, tools, fields) */
.builder-card {
  @apply bg-card rounded-[20px]
         border border-black/[0.04] dark:border-white/[0.06]
         shadow-card
         px-5 py-5;
}
```

### 13.2 Section Headers

```css
/* Section header inside builder (matches FormSection pattern) */
.builder-section-header {
  @apply text-[13px] font-bold uppercase tracking-wider
         text-foreground/70 dark:text-foreground/60;
}
```

### 13.3 Field Block Rows

```css
/* Collapsed field row */
.field-block-collapsed {
  @apply flex items-center gap-3 px-4 py-3
         border-b border-border/30 dark:border-border/20
         hover:bg-muted/30
         transition-colors duration-100
         cursor-pointer;
}

/* Drag handle */
.field-drag-handle {
  @apply text-muted-foreground/40 hover:text-muted-foreground
         cursor-grab active:cursor-grabbing
         touch-none;
}

/* Field type badge */
.field-type-badge {
  @apply text-[10px] font-medium uppercase tracking-wider
         px-1.5 py-0.5 rounded-md
         bg-muted text-muted-foreground;
}

/* Required asterisk */
.field-required {
  @apply text-destructive text-xs font-bold;
}
```

### 13.4 Expanded Field Properties

```css
/* Expanded field block */
.field-block-expanded {
  @apply px-5 py-4
         bg-muted/20 dark:bg-muted/10
         border-b border-border/30
         animate-in fade-in-0 slide-in-from-top-2 duration-200;
}

/* Property label */
.field-property-label {
  @apply text-xs font-semibold text-foreground/60 dark:text-foreground/50
         uppercase tracking-wider mb-1.5;
}

/* Property input */
.field-property-input {
  @apply w-full rounded-xl
         bg-background
         border border-border/50 focus:border-primary/50
         text-sm text-foreground placeholder:text-muted-foreground
         focus:outline-none focus:ring-1 focus:ring-primary/30
         px-3 py-2
         transition-colors duration-150;
}
```

### 13.5 Tool Card Rows

```css
/* Tool row within the tools card */
.tool-row {
  @apply flex items-start gap-3 py-4 px-5
         border-b border-border/20 dark:border-border/10
         last:border-b-0;
}

/* Tool icon tile */
.tool-icon-tile {
  @apply flex items-center justify-center shrink-0
         w-9 h-9 rounded-[10px]
         bg-primary/10 dark:bg-primary/15;
}
```

### 13.6 Phone Frame (Live Preview)

```css
/* Phone frame container */
.phone-frame {
  @apply mx-auto w-[320px] xl:w-[375px]
         rounded-[40px]
         border-[6px] border-foreground/10 dark:border-foreground/5
         bg-background
         overflow-hidden
         shadow-2xl;
}

/* Phone notch */
.phone-notch {
  @apply mx-auto mt-2 w-[100px] h-[24px]
         rounded-full
         bg-foreground/10;
}
```

### 13.7 Recommendation Chips

```css
/* Tool recommendation chip */
.recommendation-chip {
  @apply inline-flex items-center gap-1.5
         px-3 py-1.5 rounded-full
         bg-amber-100 dark:bg-amber-900/20
         text-amber-800 dark:text-amber-300
         text-xs font-medium
         cursor-pointer
         hover:bg-amber-200 dark:hover:bg-amber-900/30
         transition-colors duration-150;
}
```

### 13.8 Status Badges

```css
/* Status badge - draft */
.status-draft {
  @apply px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider
         bg-amber-100 text-amber-800
         dark:bg-amber-900/30 dark:text-amber-300;
}

/* Status badge - published */
.status-published {
  @apply px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider
         bg-green-100 text-green-800
         dark:bg-green-900/30 dark:text-green-300;
}

/* Status badge - archived */
.status-archived {
  @apply px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider
         bg-gray-100 text-gray-600
         dark:bg-gray-800 dark:text-gray-400;
}
```

### 13.9 Floating Toolbar (Mobile)

```css
/* Mobile builder toolbar (matches FormToolbar pattern) */
.builder-toolbar {
  @apply fixed bottom-[72px] left-0 right-0 z-20
         md:sticky md:bottom-4 md:left-auto md:right-auto md:z-[25]
         bg-muted/90 backdrop-blur-md rounded-2xl
         shadow-[0_2px_16px_rgba(0,0,0,0.15)]
         mx-3 md:mx-0
         flex items-center gap-2 px-3 py-2;
}
```

---

## 14. Accessibility Checklist

### 14.1 Keyboard Navigation

| Interaction | Key | Behavior |
|-------------|-----|----------|
| Navigate field blocks | `Tab` / `Shift+Tab` | Moves focus between collapsed field blocks |
| Expand/collapse field | `Enter` or `Space` | Toggles the expanded state |
| Reorder field (keyboard) | `Space` to grab, `Arrow Up/Down` to move, `Space` to drop | `@dnd-kit` keyboard sensor with `sortableKeyboardCoordinates` |
| Cancel drag | `Escape` | Drops field back to original position |
| Close field type picker | `Escape` | Closes popover/sheet |
| Close AI refine sidebar | `Escape` | Closes the sidebar and returns to preview |
| Navigate tabs (mobile) | `Arrow Left/Right` | Moves between Fields/Settings/Preview |
| Save draft | `Ctrl+S` / `Cmd+S` | Keyboard shortcut for save (captured at page level) |

### 14.2 ARIA Attributes

| Element | ARIA | Purpose |
|---------|------|---------|
| Field list | `role="list"` | Announces as a list to screen readers |
| Field block | `role="listitem"`, `aria-expanded="true/false"` | Announces expanded/collapsed state |
| Drag handle | `aria-roledescription="sortable"`, `aria-describedby="DnD instructions"` | Provided by `@dnd-kit` |
| Tool toggle | `role="switch"`, `aria-checked` | shadcn/ui `Switch` provides this |
| Tab bar | `role="tablist"` with `role="tab"` children | Standard tab pattern |
| Live preview | `aria-label="Form preview"`, `aria-live="polite"` | Announces preview updates |
| Instructions textarea | `aria-label="Instructions for AI (English)"` | Clear purpose |
| AI refine sidebar | `role="complementary"`, `aria-label="AI Instruction Refiner"` | Same as `DockedFormAIPanel` |
| Field type picker | `role="dialog"`, `aria-label="Select field type"` | Modal picker |
| Status badge | `aria-label="Status: published"` | Announces status |
| Required indicator | `<span aria-hidden="true">*</span>` + `<span class="sr-only">(required)</span>` | Matches `FormFieldWrapper` pattern |

### 14.3 Focus Management

| Scenario | Focus Behavior |
|----------|----------------|
| Add new field | Focus moves to the new field's label input (auto-expanded) |
| Delete field | Focus moves to the next field in the list, or the previous if last |
| Open field type picker | Focus moves to the first type tile |
| Close field type picker | Focus returns to the "Add Field" button |
| Open AI refine sidebar | Focus moves to the sidebar's input textarea |
| Close AI refine sidebar | Focus returns to the "AI Refine" button |
| Switch tabs (mobile) | Focus stays within the new tab's content area |
| Open mobile field editor | Focus moves to the first input (Label EN) |
| Close mobile field editor | Focus returns to the field's collapsed row |

### 14.4 Color Contrast

All text meets WCAG 2.1 AA minimum contrast ratios:
- `text-foreground` on `bg-card`: 12.6:1 (light), 15.3:1 (dark)
- `text-muted-foreground` on `bg-card`: 4.8:1 (light), 5.2:1 (dark) -- passes AA
- `text-destructive` on `bg-card`: 5.1:1 (light), 6.3:1 (dark) -- passes AA
- Status badge text on badge backgrounds: all above 4.5:1

### 14.5 Touch Targets

All interactive elements meet the 44x44px minimum touch target size:
- Drag handle: 44px wide touch zone (the visual grip icon is 24px but the tappable area is 44px)
- Field type picker tiles: minimum `h-14` (56px)
- Tool toggle switches: shadcn/ui `Switch` is 44px tall touch target
- Tab bar buttons: `py-2` with `text-xs` + padding = ~40px, but container has `p-0.5` adding to 44px
- Floating toolbar buttons: `h-9` (36px) minimum, but the pill container adds padding

### 14.6 Motion Preferences

```css
@media (prefers-reduced-motion: reduce) {
  .animate-in { animation: none !important; }
  .transition-all { transition: none !important; }
}
```

The `@dnd-kit` drag animations respect `prefers-reduced-motion` via its built-in accessibility settings.

---

## 15. Design Decision Log

### 15.1 Decisions Made

| # | Decision | Alternatives Considered | Rationale |
|---|----------|------------------------|-----------|
| 1 | **Plain textarea for instructions** (not rich text editor) | Markdown editor, WYSIWYG editor (TipTap, Lexical) | Instructions are read by the AI, not rendered to users. Plain text with numbered lists is sufficient. A rich text editor adds bundle size (~50-100KB) and complexity for zero benefit. The AI refine feature handles formatting. |
| 2 | **Inline expansion for field editing** (desktop) | Modal dialog per field, separate page per field | Inline editing keeps context visible -- the admin can see surrounding fields. Modals break spatial awareness. The inline approach mirrors Apple Notes list editing. |
| 3 | **Full-screen field editor on mobile** (not inline) | Same inline expansion as desktop, bottom sheet | Mobile screens are too narrow for inline editing with all properties visible. A full-screen editor provides generous touch targets and scrollable property list. This follows the iOS Settings pattern of drilling into detail views. |
| 4 | **Phone frame for live preview** (not a plain rendering) | No frame, browser window frame, tablet frame | The phone frame creates visual separation between "builder" and "what users see." It immediately communicates that the form is mobile-first. The decorative frame is lightweight (pure CSS, no images). |
| 5 | **AI Refine sidebar replaces preview** (not overlays it) | Overlay panel, separate modal, always-visible narrow sidebar | The refine sidebar needs full attention -- it is a focused conversation. Overlaying would obscure both editor and preview. Replacing the preview is acceptable because the admin is working on instructions, not fields, when refining. A toggle in the sidebar header lets the admin switch back to preview. |
| 6 | **3-segment tab bar on mobile** (not bottom tabs or drawer) | Bottom tab bar, hamburger menu, horizontal scroll | Three tabs fit naturally at the top. A bottom tab bar would conflict with the existing `MobileTabBar`. A hamburger menu hides content. The segmented toggle is the same pattern already used in `FormToolbar` and is immediately scannable. |
| 7 | **Card-per-section layout** (all tools in one card, not individual cards) | Separate `bg-card` per tool | A single card with hairline dividers is denser and more iOS-like. Separate cards would look like a vertical grid of floating cards with too much whitespace between them. The single-card approach also loads faster (fewer DOM nodes). |
| 8 | **@dnd-kit/sortable** (not react-beautiful-dnd, not dnd-kit/vanilla) | `react-beautiful-dnd` (archived), HTML5 drag API, manual touch handling | `@dnd-kit/sortable` is the maintained standard for React DnD. It has built-in keyboard accessibility, touch support, and vertical list strategy. `react-beautiful-dnd` is no longer maintained by Atlassian. The HTML5 drag API has poor mobile touch support. |
| 9 | **Client-side slugify** (not server-generated) | Server-side slug generation, UUID-based URLs | Client-side slugify provides instant preview as the admin types the title. The `UNIQUE` constraint catches collisions. Server-side generation would require a round-trip. UUID URLs are not human-readable. |
| 10 | **AI fillability score is client-side** (not server-computed) | Edge function computation, database-stored score | The score depends only on field definitions (already on the client). Computing it client-side avoids an API call and provides instant feedback. The algorithm is simple (~30 lines of TypeScript). |
| 11 | **Options editor is a simple list** (not drag-and-drop) | DnD reorder for options, up/down arrow buttons | Options in select/radio fields rarely exceed 6-10 items. DnD for such short lists is overkill. Simple sequential entry (type, press Enter, next) is faster. If reorder is needed, the admin deletes and re-adds. This can be revisited in Phase 7. |
| 12 | **No autosave debounce to server** (explicit Save Draft) | Auto-save every 5 seconds, auto-save on every change | Restaurant managers may have unreliable network (kitchen, walk-in cooler). Auto-save that fails silently could cause data loss confusion. Explicit "Save Draft" with a clear dirty indicator (the save icon turns to a check mark on success) is more transparent. The `builder_state` column stores crash-recovery state as a secondary backup. |
| 13 | **ChatIngestionPanel pattern for AI generate** (not a wizard/stepper) | Multi-step wizard, form-based input | The chat pattern is already proven in recipe ingestion. It supports all input modes (text, voice, image, file) in a single interface. A wizard would require separate steps for each input mode and would not support follow-up refinement. |
| 14 | **Recommendations as dismissible chips** (not auto-enable) | Auto-enable recommended tools, no recommendations, modal suggestions | Chips give the admin control -- they can accept or dismiss. Auto-enabling tools without consent violates the "no surprise" principle. No recommendations would miss an easy UX win. A modal is too heavy for a suggestion. |
| 15 | **Separate `form-builder.ts` types file** (not extending `forms.ts`) | Add builder types to `forms.ts`, inline types in components | The builder types (draft, block state, refine result, etc.) are only used by builder components. Adding them to `forms.ts` would bloat the file that is imported by all form components, including the viewer (which should not know about builder internals). Separation of concerns. |

### 15.2 Open Design Questions (Deferred to Implementation)

| # | Question | Default Decision | Reconsider When |
|---|----------|-----------------|-----------------|
| 1 | Should the field key be editable after creation? | Yes, but warn if template has submissions | Phase 7 when key-rename detection is built |
| 2 | Should section drag-and-drop move all child fields? | No, just the header field. Fields are individually draggable. | User testing reveals frustration with field-by-field reordering |
| 3 | Should the builder support undo/redo? | No. Save Draft creates a restore point. | User feedback requests it |
| 4 | Should the icon picker show all Lucide icons? | No, curated subset of ~30 form-relevant icons. | Admin requests more options |
| 5 | Should the preview show validation errors? | No, preview is always in "clean" state. | Phase 7 polish |
| 6 | Should there be a "Test AI Fill" button in the builder? | Not in Phase 5. The admin can publish and test from `/forms/:slug`. | Phase 7 when we add inline AI testing |

---

## Appendix A: Field Type Icons

Icons used in the collapsed field block rows and the type picker tiles:

| Field Type | Lucide Icon | Picker Label (EN) | Picker Label (ES) |
|-----------|-------------|-------------------|-------------------|
| `text` | `Type` | Text | Texto |
| `textarea` | `AlignLeft` | Textarea | Area de Texto |
| `date` | `Calendar` | Date | Fecha |
| `time` | `Clock` | Time | Hora |
| `datetime` | `CalendarClock` | Date & Time | Fecha y Hora |
| `select` | `List` | Select | Seleccionar |
| `radio` | `CircleDot` | Radio | Opcion Unica |
| `checkbox` | `CheckSquare` | Checkbox | Casilla |
| `number` | `Hash` | Number | Numero |
| `phone` | `Phone` | Phone | Telefono |
| `email` | `Mail` | Email | Correo |
| `signature` | `PenTool` | Signature | Firma |
| `image` | `Camera` | Image | Imagen |
| `file` | `Paperclip` | File | Archivo |
| `header` | `Heading` | Section Header | Encabezado |
| `instructions` | `Info` | Instructions | Instrucciones |
| `contact_lookup` | `UserSearch` | Contact Lookup | Buscar Contacto |

---

## Appendix B: Bilingual Strings Index

All user-facing strings are stored in `STRINGS` objects following the existing `FormToolbar` / `FormAIContent` pattern:

```typescript
const STRINGS = {
  en: {
    // BuilderHeader
    formBuilder: 'Form Builder',
    saveDraft: 'Save Draft',
    publish: 'Publish',
    unpublish: 'Unpublish',
    saving: 'Saving...',
    saved: 'Saved',
    backToForms: 'Back to Forms',

    // BuilderTabBar
    fields: 'Fields',
    settings: 'Settings',
    preview: 'Preview',

    // FormMetadataEditor
    titleEn: 'Title (English)',
    titleEs: 'Title (Spanish)',
    descriptionEn: 'Description (English)',
    descriptionEs: 'Description (Spanish)',
    icon: 'Icon',
    slug: 'URL Slug',
    slugLocked: 'Slug cannot be changed after publishing',
    headerImage: 'Header Image',

    // InstructionsEditor
    instructionsTitle: 'Instructions for AI',
    instructionsDesc: 'The AI reads these instructions when filling this form',
    aiRefine: 'AI Refine',
    charCount: 'characters',

    // AIToolsPicker
    aiToolsTitle: 'AI Tools',
    aiToolsDesc: 'Select which tools the AI can use when filling this form',
    recommendations: 'Recommendations',

    // FieldBlock
    addField: 'Add Field',
    deleteField: 'Delete Field',
    deleteFieldConfirm: 'Are you sure you want to delete this field?',
    labelEn: 'Label (English)',
    labelEs: 'Label (Spanish)',
    key: 'Key',
    type: 'Type',
    required: 'Required',
    placeholder: 'Placeholder',
    hint: 'Hint text',
    aiHint: 'AI Hint',
    aiHintDesc: 'Instructions for the AI on how to extract this field',
    width: 'Width',
    fullWidth: 'Full Width',
    halfWidth: 'Half Width',
    section: 'Section',
    options: 'Options',
    addOption: 'Add Option',
    condition: 'Show Condition',
    done: 'Done',

    // FieldTypePicker
    selectFieldType: 'Add Field',
    inputFields: 'Input Fields',
    dateTimeFields: 'Date & Time',
    choiceFields: 'Choice Fields',
    specialFields: 'Special',

    // LivePreview
    previewTitle: 'Preview',
    addFieldsToPreview: 'Add fields to see a preview',
    openInNewTab: 'Open in new tab',
    aiFillability: 'AI Fillability',
    fieldsMissingHint: 'fields missing AI hint',

    // InstructionsRefinePanel
    refineTitle: 'AI Refine Instructions',
    refineInputPlaceholder: 'Describe what you want to improve...',
    apply: 'Apply',
    edit: 'Edit',
    refinedInstructions: 'Refined Instructions',
    explanation: 'Explanation',
    suggestions: 'Suggestions',

    // TemplateGeneratePanel
    generateTitle: 'AI Form Builder',
    generateDesc: 'Create a form by chatting or adding files and images',
    describeForm: 'Describe your form',
    addFilesImages: 'Add files or images',
    useThisDraft: 'Use This Draft',
    modify: 'Modify',
    generatedDraft: 'Generated Form Draft',
    confidence: 'Confidence',
    missing: 'Missing',

    // AdminFormsList
    formTemplates: 'Form Templates',
    newForm: 'New Form',
    aiGenerate: 'AI Generate',
    editForm: 'Edit',
    duplicateForm: 'Duplicate',
    archiveForm: 'Archive',
    deleteForm: 'Delete',
    deleteFormConfirm: 'Delete this form template? This cannot be undone.',
    noTemplatesYet: 'No form templates yet',
    version: 'v',
    lastEdited: 'Last edited',
    publishedOn: 'Published',
    fieldsCount: 'fields',

    // Status
    draft: 'Draft',
    published: 'Published',
    archived: 'Archived',
  },
  es: {
    formBuilder: 'Constructor de Formularios',
    saveDraft: 'Guardar Borrador',
    publish: 'Publicar',
    unpublish: 'Despublicar',
    saving: 'Guardando...',
    saved: 'Guardado',
    backToForms: 'Volver a Formularios',

    fields: 'Campos',
    settings: 'Ajustes',
    preview: 'Vista Previa',

    titleEn: 'Titulo (Ingles)',
    titleEs: 'Titulo (Espanol)',
    descriptionEn: 'Descripcion (Ingles)',
    descriptionEs: 'Descripcion (Espanol)',
    icon: 'Icono',
    slug: 'Slug de URL',
    slugLocked: 'El slug no puede cambiarse despues de publicar',
    headerImage: 'Imagen de Encabezado',

    instructionsTitle: 'Instrucciones para la IA',
    instructionsDesc: 'La IA lee estas instrucciones al llenar este formulario',
    aiRefine: 'Refinar con IA',
    charCount: 'caracteres',

    aiToolsTitle: 'Herramientas de IA',
    aiToolsDesc: 'Selecciona que herramientas puede usar la IA al llenar este formulario',
    recommendations: 'Recomendaciones',

    addField: 'Agregar Campo',
    deleteField: 'Eliminar Campo',
    deleteFieldConfirm: 'Seguro que deseas eliminar este campo?',
    labelEn: 'Etiqueta (Ingles)',
    labelEs: 'Etiqueta (Espanol)',
    key: 'Clave',
    type: 'Tipo',
    required: 'Requerido',
    placeholder: 'Marcador de posicion',
    hint: 'Texto de ayuda',
    aiHint: 'Pista para IA',
    aiHintDesc: 'Instrucciones para la IA sobre como extraer este campo',
    width: 'Ancho',
    fullWidth: 'Ancho Completo',
    halfWidth: 'Medio Ancho',
    section: 'Seccion',
    options: 'Opciones',
    addOption: 'Agregar Opcion',
    condition: 'Condicion de Visibilidad',
    done: 'Listo',

    selectFieldType: 'Agregar Campo',
    inputFields: 'Campos de Entrada',
    dateTimeFields: 'Fecha y Hora',
    choiceFields: 'Campos de Seleccion',
    specialFields: 'Especiales',

    previewTitle: 'Vista Previa',
    addFieldsToPreview: 'Agrega campos para ver una vista previa',
    openInNewTab: 'Abrir en nueva pestana',
    aiFillability: 'Llenabilidad IA',
    fieldsMissingHint: 'campos sin pista de IA',

    refineTitle: 'Refinar Instrucciones con IA',
    refineInputPlaceholder: 'Describe que quieres mejorar...',
    apply: 'Aplicar',
    edit: 'Editar',
    refinedInstructions: 'Instrucciones Refinadas',
    explanation: 'Explicacion',
    suggestions: 'Sugerencias',

    generateTitle: 'Constructor de Formularios IA',
    generateDesc: 'Crea un formulario con chat, archivos o imagenes',
    describeForm: 'Describe tu formulario',
    addFilesImages: 'Agregar archivos o imagenes',
    useThisDraft: 'Usar Este Borrador',
    modify: 'Modificar',
    generatedDraft: 'Borrador Generado',
    confidence: 'Confianza',
    missing: 'Faltante',

    formTemplates: 'Plantillas de Formularios',
    newForm: 'Nuevo Formulario',
    aiGenerate: 'Generar con IA',
    editForm: 'Editar',
    duplicateForm: 'Duplicar',
    archiveForm: 'Archivar',
    deleteForm: 'Eliminar',
    deleteFormConfirm: 'Eliminar esta plantilla de formulario? Esto no se puede deshacer.',
    noTemplatesYet: 'Aun no hay plantillas de formularios',
    version: 'v',
    lastEdited: 'Ultima edicion',
    publishedOn: 'Publicado',
    fieldsCount: 'campos',

    draft: 'Borrador',
    published: 'Publicado',
    archived: 'Archivado',
  },
} as const;
```

---

## Appendix C: Auto-Save and Crash Recovery Strategy

### Auto-Save to `builder_state` Column

The `builder_state` JSONB column on `form_templates` stores the transient builder UI state. This is NOT the template data itself (fields, instructions, etc.) -- it is metadata about the editing session.

**What is stored:**
```jsonc
{
  "collapsed_sections": ["section_employee_info"],
  "selected_field_key": "employee_name",
  "preview_mode": false,
  "last_builder_user": "uuid-of-admin",
  "last_builder_at": "2026-02-25T14:30:00Z"
}
```

**When is it written:**
- On every tab switch (mobile)
- On every field expand/collapse
- On page unload (`beforeunload` event -- best effort)

**When is it read:**
- On builder page mount, if `builder_state` is not null, show a "Resume where you left off?" prompt

**When is it cleared:**
- On publish (trigger clears it)
- On explicit "New Form" from admin list

### Dirty State and Unsaved Changes Warning

The `useFormBuilder` hook tracks `isDirty` by comparing the current draft to the last saved version (deep equality on fields, instructions, ai_tools, metadata). When `isDirty` is true:

1. The save button shows a hollow save icon (not a green check)
2. Navigating away triggers the browser's `beforeunload` confirmation dialog
3. The "Back" button in the header shows an "Unsaved changes" confirmation dialog (shadcn/ui `AlertDialog`)

---

## Appendix D: Routing Plan

### New Routes

| Route | Component | Auth | Description |
|-------|-----------|------|-------------|
| `/admin/forms` | `AdminFormsList` | admin/manager | List all templates |
| `/admin/forms/new` | `AdminFormBuilder` | admin/manager | Create new template |
| `/admin/forms/:id/edit` | `AdminFormBuilder` | admin/manager | Edit existing template |

### Route Parameters

- `:id` is the template UUID (not slug). This avoids issues with slug changes during editing.
- The builder page fetches the template by ID on mount using `supabase.from("form_templates").select("*").eq("id", id).single()`.

### Navigation Flow

```
Admin Dashboard (/admin)
  |
  +-> Form Templates (/admin/forms)
        |
        +-> New Form (blank) -> /admin/forms/new
        |
        +-> AI Generate -> /admin/forms/new?mode=generate
        |
        +-> Edit -> /admin/forms/:id/edit
        |
        +-> (After publish) -> /forms/:slug (viewer)
```

---

*This document is the comprehensive UX/UI design specification for Phase 5: Form Builder Admin. It is paired with `05-phase-db-section.md` (schema) and `05-phase-form-builder-admin-backend.md` (edge functions). Together, these three documents provide the complete plan for implementing the form builder.*
