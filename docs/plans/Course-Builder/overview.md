# Course Builder — Feature Overview

> A comprehensive overview of the AI-powered Course Builder for Alamo Prime.
> This document must be agreed upon before breaking into construction phases.

---

## 1. What We're Building

We are rebuilding the entire training/course system from scratch. The existing training tables, placeholder courses (Server 101, etc.), and seed data are being discarded. They were prototypes — useful for proving out the concept, but the architecture needs to be redesigned around the Course Builder as the engine that creates everything.

### The Two Halves

**A. Course Builder (Authoring Tool)** — Where admins/managers create courses. An element-based editor (modeled after the Form Builder) where the AI reads the restaurant's database, assembles relevant material, and constructs full course content with media, formatted text, callouts, and quizzes. This is the primary focus of this feature.

**B. Course Player (Learning Tool)** — Where staff consume courses. Browse courses, learn through AI-guided sessions, take quizzes, track progress. This is also rebuilt from scratch to render the new element-based content produced by the Course Builder.

Both halves share the same database tables but are completely separate UI experiences. The Builder CREATES. The Player DELIVERS. Every course in the system — including what were previously the "Server 101" courses — will be built using this engine.

---

## 2. The Element System

Like the Form Builder uses `fields` (JSONB array of FormFieldDefinition objects) to define form structure, the Course Builder uses **elements** (JSONB array of CourseElement objects) to define lesson content. This is the core building block.

### 2.1 Element Types

#### A. Content Element
The primary text block. Stores Markdown content optimized for rich rendering.

```typescript
{
  type: 'content',
  key: string,              // Unique element ID
  title_en?: string,        // Optional section heading
  title_es?: string,
  body_en: string,           // Full Markdown (tables, lists, bold, headers, etc.)
  body_es: string,
  ai_instructions: string,  // Prompt used to generate this content (editable)
  source_refs: SourceRef[],  // Which DB records were used as source material
  sort_order: number,
  status: 'outline' | 'generated' | 'reviewed'  // Two-step workflow
}
```

**Capabilities**: Headers, paragraphs, bullet/numbered lists, tables, bold/italic, inline code. Everything the AI can output in Markdown. The renderer handles all formatting.

#### B. Feature Element (Callout)
A highlighted block that stands out visually — for tips, best practices, cautions, warnings, etc.

```typescript
{
  type: 'feature',
  key: string,
  variant: 'tip' | 'best_practice' | 'caution' | 'warning' | 'did_you_know' | 'key_point',
  title_en?: string,
  title_es?: string,
  body_en: string,
  body_es: string,
  icon?: string,             // Lucide icon override (default per variant)
  ai_instructions: string,
  sort_order: number,
  status: 'outline' | 'generated' | 'reviewed'
}
```

**Visual treatment per variant**:
| Variant | Color | Default Icon | Use Case |
|---------|-------|-------------|----------|
| `tip` | Blue | Lightbulb | Helpful advice, shortcuts |
| `best_practice` | Green | CheckCircle | Recommended approach |
| `caution` | Amber | AlertTriangle | Things to watch out for |
| `warning` | Red | ShieldAlert | Critical safety/allergen info |
| `did_you_know` | Purple | Sparkles | Interesting facts, guest talking points |
| `key_point` | Indigo | Star | Must-remember information |

#### C. Media Element
Supports images, videos, and YouTube embeds. Handles the media storage challenge creatively.

```typescript
{
  type: 'media',
  key: string,
  media_type: 'image' | 'video' | 'youtube',
  // Image
  image_url?: string,        // Supabase Storage URL or external
  image_source: 'upload' | 'ai_generated' | 'product_image' | 'external',
  ai_image_prompt?: string,  // Prompt used if AI-generated
  // Video
  video_url?: string,        // YouTube URL, Loom URL, or Supabase Storage
  // Common
  caption_en?: string,
  caption_es?: string,
  alt_text_en?: string,
  alt_text_es?: string,
  ai_instructions: string,
  sort_order: number,
  status: 'outline' | 'generated' | 'reviewed'
}
```

**Video storage strategy** (the creative solution):
1. **YouTube/Loom embeds** (primary) — No storage cost. Restaurant uploads training videos to their YouTube/Loom account, we embed via iframe. Best for procedural videos (handwashing, plating, tableside).
2. **Short clips via Supabase Storage** — For quick demos under 30 seconds (max 50MB). New `course_media` storage bucket with appropriate limits.
3. **Product images from DB** — When referencing dishes/wines/cocktails, pull the existing product image from the database. The AI knows NOT to generate images for products that already have internal photos.
4. **AI-generated images** — For illustrative/educational content (handwashing technique, table setup diagram, flavor wheel). Uses OpenAI DALL-E 3 or similar. Stored in `course_media` bucket after generation.

### 2.2 How Elements Work in Practice

Every course lesson is a **JSONB array of elements**, stored on the course section:

```json
[
  { "type": "content", "key": "intro-1", "body_en": "# Welcome to Wine Basics\n\nIn this lesson...", "sort_order": 1, "status": "generated" },
  { "type": "feature", "key": "tip-1", "variant": "tip", "body_en": "Always present the label to the guest...", "sort_order": 2, "status": "generated" },
  { "type": "media", "key": "img-1", "media_type": "image", "image_source": "product_image", "image_url": "...", "caption_en": "Veuve Clicquot Yellow Label", "sort_order": 3, "status": "generated" },
  { "type": "content", "key": "body-1", "body_en": "## Tasting Notes\n\n| Characteristic | Description |\n|...", "sort_order": 4, "status": "generated" },
  { "type": "feature", "key": "warn-1", "variant": "warning", "body_en": "**Allergen Alert**: Contains sulfites...", "sort_order": 5, "status": "generated" }
]
```

---

## 3. Content Storage Strategy (Dual-Purpose Architecture)

This is the critical design decision: how do we store restaurant manuals, SOPs, and employee handbooks so they serve **both** purposes?

### 3.1 The Two Purposes

**Purpose A — Search & AI Chat**: User asks "what's our policy on guest complaints?" → hybrid search finds relevant chunks → AI answers from context. This works well with the current `manual_sections` table (full markdown per section, FTS + vector embeddings). Already built and working.

**Purpose B — Course Builder Source Material**: AI needs to read comprehensive material to build accurate courses. When building a "Steps of Service" course, the AI needs the COMPLETE steps-of-service documentation — not search snippets. Partial context = hallucination risk.

### 3.2 The Problem with Current Storage

`manual_sections` stores complete section content (2,000–4,000 words per section) as full Markdown. This creates a conflict:

- **Search needs chunks**: When a user asks an AI question, we need to find the right *piece* of a section. Sending a 4,000-word section through a search embedding creates diluted vectors — the embedding tries to represent too many topics at once. And when we return search results as context to the AI for answering questions, long sections risk token truncation, meaning the AI may not see the relevant part.
- **Course building needs full sections**: When the AI builds a course, it must read the COMPLETE source material — every detail, every procedure step, every allergen note. Partial context = hallucination risk.

### 3.3 The Dual-Layer Solution: Chunks + Full Sections

We store content at **two levels**: the full section (for course building and display) and its chunks (for search and AI Q&A).

**Layer 1 — Sections** (the complete document unit):
```
manual_sections (existing table, restructured)
  id, group_id, slug, title_en, title_es,
  content_en: TEXT,              -- Full Markdown (the complete section)
  content_es: TEXT,
  parent_id: UUID,               -- Hierarchy (category → section)
  category, tags, icon, sort_order, level, is_category,
  word_count_en, word_count_es,
  updated_at                     -- For change detection
```

**Layer 2 — Chunks** (search-optimized pieces):
```
section_chunks (NEW table)
  id, section_id (FK → manual_sections), group_id,
  chunk_index: INTEGER,          -- Order within section (0, 1, 2, ...)
  heading: TEXT,                 -- The heading this chunk falls under (e.g., "Step 3: Present the Check")
  content_en: TEXT,              -- ~300-800 words per chunk
  content_es: TEXT,
  search_vector_en: TSVECTOR,    -- FTS on chunk text (weighted: heading=A, content=B)
  search_vector_es: TSVECTOR,
  embedding_en: VECTOR(1536),    -- Embedding of chunk (much more focused than full-section embedding)
  embedding_es: VECTOR(1536),
```

**How chunking works**:
- Sections are split at natural boundaries: Markdown headings (H2, H3), paragraph breaks, or numbered list items
- Each chunk is 300–800 words — large enough for context, small enough for focused embeddings
- Chunks maintain their `heading` context so the AI knows what topic a chunk belongs to
- The `section_id` FK always links back to the full section for assembly

**How each purpose uses the layers**:

| Purpose | Layer Used | Why |
|---------|-----------|-----|
| **AI Q&A search** | Chunks | Focused embeddings → better semantic matches. No truncation risk. |
| **FTS keyword search** | Chunks | Smaller text units = more precise ranking |
| **Course Builder** | Full Sections | AI reads complete, untruncated source material. No hallucination. |
| **Manual viewer** | Full Sections | User sees the complete formatted document |
| **Content change detection** | Full Sections | MD5 hash on the full section content |

**When the Course Builder requests source material**:
```
Wizard selects section IDs → fetch full content_en/content_es from manual_sections
→ AI receives the COMPLETE text, every word, no chunks, no truncation
→ Source references stored on each element (source_refs[])
```

**When the AI answers a user question**:
```
User asks "how do I handle a guest complaint?"
→ Embed query → search section_chunks (vector + FTS)
→ Return top 5-8 matching CHUNKS (not full sections)
→ AI answers from focused, relevant context
→ No truncation because chunks are 300-800 words each
```

### 3.4 What Needs to Change for Scale

When restaurants upload their own manuals (employee handbooks, SOPs, brand standards), we need a structured ingestion pipeline:

**Table: `restaurant_documents`** (new)
```
id, group_id, slug, title_en, title_es,
document_type: 'employee_handbook' | 'sop' | 'brand_standards' | 'menu_guide' | 'training_manual' | 'custom',
original_file_url: TEXT,       -- Original PDF/DOCX in storage
```

**Table: `document_sections`** (new — children of restaurant_documents)
```
id, document_id, group_id, slug, title_en, title_es,
content_en: TEXT,              -- Full Markdown (extracted + cleaned)
content_es: TEXT,
section_number: TEXT,          -- e.g., "3.2.1" for hierarchy
parent_section_id: UUID,       -- For nested sections
tags: TEXT[],
word_count: INTEGER,
```

**Table: `document_chunks`** (new — children of document_sections)
```
id, section_id (FK → document_sections), group_id,
chunk_index, heading, content_en, content_es,
search_vector_en, search_vector_es,
embedding_en, embedding_es
```

The same dual-layer pattern applies: `document_sections` stores the full text, `document_chunks` stores search-optimized pieces. Same chunking rules.

**Key design principles**:
1. **Two layers, not one** — Full sections for assembly + course building, chunks for search. Never compromise one purpose for the other.
2. **Preserve hierarchy** — `parent_id` / `parent_section_id` + `section_number` maintain the document's structure, so the Course Builder can request "all sections under Chapter 3: Guest Services."
3. **Markdown is the canonical format** — Original files (PDF/DOCX) are stored for reference. Content is extracted, cleaned, and stored as Markdown. This is what the AI reads.
4. **Chunks are derived, not primary** — When a section is updated, its chunks are automatically re-generated (split + re-embedded). The section is the source of truth.
5. **Focused embeddings** — A chunk about "handwashing procedure" produces a much better vector than a 4,000-word section that also covers FIFO, temp control, and sanitation.

### 3.5 How the Course Builder Gets Source Material

```
Step 1: User picks course type via wizard (e.g., "SOP Review")
Step 2: Wizard shows available document sections (searchable picker)
Step 3: User selects specific sections (or AI recommends based on topic)
Step 4: System fetches FULL content of each selected section
Step 5: AI receives complete, untruncated source material
Step 6: AI builds course elements from this material
Step 7: Source references stored on each element (source_refs[])
```

This ensures: **No hallucination because the AI works from complete source documents, not search snippets.**

---

## 4. The Two-Step Generation Workflow

This is critical for user control and quality. The AI doesn't just dump out a finished course — it works in two steps.

### Step 1: Outline Generation (Fast)

The AI produces the course **structure** with element placeholders. Each element contains:
- The element type (content, feature, media)
- A title/topic for that element
- The `ai_instructions` — the specific prompt the AI will use to generate the full content
- Status: `outline`

**What the user sees**: A skeleton of the course with topic cards. Each card shows what the AI plans to put there and the instructions it will follow.

**What the user can do**:
- Reorder elements via **up/down arrow buttons** (placed outside the element card, on the left) — large element cards are too big for drag-and-drop reordering
- Delete elements they don't want
- **Add new elements from the palette** — drag-and-drop from the palette IS used for adding new elements (small palette items → canvas). When the user drops in a new element, it arrives empty with an `ai_instructions` field where they write what they want the AI to build for that element. Example: user adds a Content element → types in the instructions field "Write a comparison table of our three steak cuts with cooking temps and price points" → clicks Generate → AI produces the content. This is how users direct the AI at the element level, whether during outline review or at any point in the editing process.
- Edit `ai_instructions` on any element to steer the AI (both AI-generated and user-added elements have this field)
- Edit titles, change element types, change feature variants

**Time**: ~5-10 seconds for the AI to produce an outline

### Step 2: Content Generation (Slower)

Once the user approves the outline (or clicks "Build All"), the AI generates full content for each element:
- Content elements get full Markdown body text
- Feature elements get their callout text
- Media elements get AI-generated images (if applicable) or product image lookups

**Two modes**:
- **Build All**: AI generates all elements sequentially. User sees progress. At the end, AI asks "Want me to auto-generate images too?"
- **Build One**: User clicks "Generate" on a single element. Good for iterating on specific sections.

**After generation**: Each element's status changes to `generated`. The user can then:
- Inline-edit any element directly
- Click the AI button on any element → opens a mini-prompt input → "make this shorter", "add a table comparing the three steaks", "translate to Spanish"
- Use the AI chat panel to make broader changes → "add a tip about allergens after every dish section"

### Step 3: Review & Publish

User reviews all content, marks elements as `reviewed`, and publishes the course. Published courses become available in the Course Player for assigned staff.

---

## 5. The Course Editor Interface

### 5.1 Layout (Desktop/iPad)

```
┌──────────────────────────────────────────────────────────────────┐
│  ← Back    Course Title                    [Save Draft] [Publish]│
├──────────┬───────────────────────────────────────┬───────────────┤
│          │                                       │               │
│ Element  │         Editor Canvas                 │   AI Panel    │
│ Palette  │                                       │               │
│          │  ┌─────────────────────────────┐      │  Chat with    │
│ + Content│  │ [≡] Content: Introduction   [🤖]│  │  AI to make   │
│ + Feature│  │     # Welcome to...          [✎]│  │  changes      │
│ + Media  │  │     In this lesson you...    [🗑]│  │               │
│          │  └─────────────────────────────┘      │  [Build All]  │
│          │  ┌─────────────────────────────┐      │  [Build This] │
│ ───────  │  │ [≡] Tip: Pro tip           [🤖]│  │               │
│ Sections │  │     💡 Always present...     [✎]│  │  Voice input  │
│          │  │                              [🗑]│  │  supported    │
│ Overview │  └─────────────────────────────┘      │               │
│ Lesson 1 │  ┌─────────────────────────────┐      │               │
│ Lesson 2 │  │ [≡] Media: Wine bottle      [🤖]│  │               │
│ Quiz     │  │     [image placeholder]      [✎]│  │               │
│          │  │                              [🗑]│  │               │
│          │  └─────────────────────────────┘      │               │
│          │                                       │               │
│          │  [+ Add Element]                      │               │
│          │                                       │               │
├──────────┴───────────────────────────────────────┴───────────────┤
│  Course Settings  │  Outline  │  Content  │  Quiz  │  Preview    │
└──────────────────────────────────────────────────────────────────┘
```

### 5.2 Element Controls

Each element in the canvas has:
- **[↑↓] Move arrows** — Up/down arrow buttons outside the card (left side) to reorder. Drag-and-drop is only used for adding new elements from the palette, not for rearranging existing cards (they're too large for drag reordering)
- **[🤖] AI button** — Opens inline prompt: "What should I change?" → AI regenerates just that element with instructions
- **[✎] Edit button** — Toggle inline editing (direct Markdown editing)
- **[🗑] Delete button** — Remove element (with undo)

### 5.3 AI Panel (Right Side)

The AI chat panel (like the Form Builder's AIBuilderPanel) allows conversational editing:
- "Add a warning about shellfish allergens after the shrimp cocktail section"
- "Make all the feature callouts shorter"
- "Add images for each dish"
- "Translate everything to Spanish"
- "Add a table comparing all three steaks side by side"

The AI can modify multiple elements at once from a single chat instruction.

### 5.4 Mobile Layout

```
┌─────────────────────────────┐
│ ← Back   Course Title       │
├─────────────────────────────┤
│ [Canvas] [Elements] [AI]    │  ← Tab bar
├─────────────────────────────┤
│                             │
│  (active tab content)       │
│                             │
└─────────────────────────────┘
```

### 5.5 Element Palette (Left Panel)

Draggable element types:
- **Content** — Rich text/Markdown block
- **Feature** — Callout (tip, best practice, caution, warning, did you know, key point)
- **Media** — Image, video, YouTube embed

Below the palette, a **section navigator** shows the course structure:
- Overview
- Lesson 1: [title]
- Lesson 2: [title]
- ...
- Quiz Settings

Click a lesson to jump to its elements in the canvas.

---

## 6. Quiz & Assessment Builder

### 6.1 Quiz Configuration per Course

When creating a course, the user configures the assessment:

```typescript
{
  quiz_mode: 'multiple_choice' | 'voice_response' | 'interactive_ai' | 'mixed',
  question_count: number,          // Total questions to show per attempt
  question_pool_size: number,      // Total questions generated (larger = less repetition)
  passing_score: number,           // Default 70%
  max_attempts: number | null,     // null = unlimited
  cooldown_minutes: number,        // Time between attempts (default 30)
  shuffle_questions: boolean,      // Randomize order
  shuffle_options: boolean,        // Randomize MC option order
}
```

### 6.2 Quiz Modes

#### A. Multiple Choice (Default)
- AI generates questions from course content + source material
- 4 options per question, 1 correct
- Immediate feedback with explanation after each question (or at end — configurable)
- **Best for**: Quick evaluation, noisy environments, mobile

#### B. Voice Transcribed Response
- AI poses open-ended questions ("Describe the dry-aging process to a guest")
- User records voice → Whisper transcribes → AI evaluates transcript
- Scored on rubric: accuracy, completeness, hospitality tone
- Simple UI: question → record button → review transcript → submit
- **Best for**: Testing verbal articulation — describing dishes, wine pairings

#### C. Interactive AI (Realtime Voice)
- Real-time voice conversation with AI evaluator
- AI asks questions, follows up, probes deeper
- Role-playing scenarios (steps of service, guest complaints, upselling)
- **Credit warning**: Uses realtime API — significantly higher cost per session
- **Best for**: Steps of service role-play, guest interaction practice

#### D. Mixed
- Combine any of the above in one assessment
- User configures how many questions of each type

### 6.3 Question Pool Generation

Questions are **pre-generated when the course is built**, not on-the-fly:
- AI generates `question_pool_size` questions (e.g., 30 questions for a pool)
- Each quiz attempt draws `question_count` from the pool (e.g., 10 per attempt)
- Questions are randomized per attempt → different students get different questions
- Questions track `times_shown` and `times_correct` for quality monitoring
- Low-performing questions (>70% miss rate after 10+ attempts) are auto-flagged

### 6.4 Credit Warning for Interactive AI Mode

When the user selects Interactive AI mode in the wizard:
```
┌─────────────────────────────────────────────┐
│ ⚠️ Credit Usage Notice                      │
│                                             │
│ Interactive AI mode uses realtime voice,    │
│ which consumes significantly more credits   │
│ than multiple choice or voice response.     │
│                                             │
│ Estimated: ~5-8 credits per session         │
│ (vs. 1 credit for multiple choice)          │
│                                             │
│ Recommended for:                            │
│ • Steps of service role-play               │
│ • Guest interaction practice               │
│ • Scenarios requiring back-and-forth       │
│                                             │
│ [Use Interactive AI] [Switch to Voice Response] │
└─────────────────────────────────────────────┘
```

---

## 7. Content Change Tracking & Element-Level Rebuild

> **DESIGN DECISION (Owner, 2026-03-05)**: Rebuilds are **admin-triggered and element-level**, NOT automatic full-course rebuilds. When source material changes, the system detects staleness at the element level and notifies the admin. The admin decides when to rebuild. Only the specific affected elements are rebuilt — never the entire course.

### 7.1 How Source Material Links to Courses

Every course element stores `source_refs[]` — an array of references to the database records it was built from:

```typescript
interface SourceRef {
  table: string;      // 'manual_sections' | 'foh_plate_specs' | 'wines' | etc.
  id: string;         // UUID of the source record
  content_hash: string; // MD5 hash of the source content at build time
}
```

### 7.2 Change Detection

Database triggers on all source tables monitor for content changes:
1. When a record in `manual_sections`, `foh_plate_specs`, `wines`, etc. is updated
2. The trigger computes MD5 of the new content
3. Compares against `source_refs[].content_hash` in all course elements referencing that record
4. If hash differs → logs to `content_change_log` with `affected_elements` JSONB (element-level, not just course-level)
5. Admin notification displayed — **NO automatic rebuild**

### 7.3 What Happens When Content Changes (Admin-Triggered Pipeline)

```
Source record updated (e.g., wine description changed)
  ↓
Trigger fires → logs change in content_change_log
  with affected_elements: [{course_id, section_id, element_key}, ...]
  ↓
ADMIN NOTIFICATION (prominent full-width alert banner):
  ┌──────────────────────────────────────────────────────────────┐
  │  ⚠️ Source Material Changed                                   │
  │                                                              │
  │  The following source material has changed:                  │
  │  • Veuve Clicquot Yellow Label — description updated         │
  │  • Pinot Noir food pairings — new pairings added            │
  │                                                              │
  │  Affected elements:                                          │
  │  • "Server Wine Training" → 3 elements stale                 │
  │  • "Menu Rollout: Spring" → 1 element stale                  │
  │                                                              │
  │  [Rebuild Affected Elements]  [Review]  [Dismiss]            │
  └──────────────────────────────────────────────────────────────┘
```

This is a **full-width alert banner** at the top of the admin interface, NOT a small toast. It persists until the admin dismisses it or takes action. The admin decides whether and when to rebuild.

### 7.4 The Element-Level Rebuild Pipeline (Detail)

When the admin clicks "Rebuild Affected Elements":

```
1. Admin triggers rebuild via notification banner or change log page
   ↓
2. System fetches the list of stale elements from content_change_log
   ↓
3. For each affected element (NOT the whole course):
   a. Fetch the updated source material
   b. Call rebuild-course-elements edge function with:
      - The element's existing ai_instructions
      - The NEW source material
      - The element type and configuration
   c. AI regenerates ONLY that element's content
   d. Update source_refs[].content_hash with new hash
   ↓
4. For each affected course section (sections containing rebuilt elements):
   a. Archive existing quiz questions (is_active = false)
   b. Call generate-quiz-pool with the updated course content
   c. New questions go live immediately
   ↓
5. Course version incremented
   ↓
6. element_rebuild_log entries created (per-element rebuild audit trail)
   ↓
7. Student completions are NOT auto-reset
   (Manager can create a refresh rollout if they want staff to re-certify)
```

**Why element-level, not full course**: A menu item change (e.g., price update on the Ribeye) only affects the 2-3 elements that reference it. The rest of the course stays untouched. Cost: ~$0.30-0.50 per change vs. ~$2-5 for a full course rebuild.

**Auto-rebuild toggle** (Phase 9, optional): After the element-level rebuild pipeline is proven reliable, a per-course `auto_rebuild` toggle can be enabled. When on, rebuilds happen automatically with debounce (5 min) and rate limiting (max 1 batch/hour). Default is OFF (admin-triggered).

### 7.5 Admin Change Log

All element rebuilds are logged in a persistent **Element Rebuild Log** accessible from the admin panel:

| Date | Course | Element | Source Change | Quiz Questions | Status |
|------|--------|---------|--------------|----------------|--------|
| Mar 5 | Wine Training | content:wine-desc-1 | Veuve Clicquot updated | 3 regenerated | Reviewed |
| Mar 3 | Menu Rollout | content:steak-intro | NY Strip removed | 4 regenerated | Pending Review |
| Feb 28 | SOP Review | feature:wash-warning | Handwashing section updated | 2 regenerated | Reviewed |

Admins can click into any entry to see exactly what changed (diff view of old vs. new element content).

---

## 8. Course Creation Wizards

Six specialized wizards guide the user through course creation. Each wizard collects specific inputs, then hands off to the AI for outline generation.

### 8.1 Wizard: Menu Rollout / Menu Review / New Item

**Use case**: New menu items, seasonal menu changes, menu knowledge review.

**Steps**:
1. **Course Details**: Title, description, the "why" behind the rollout, effective date, urgency
2. **Item Selection**: Search + pick items from the database — any combination of:
   - FOH Plate Specs (dishes)
   - Prep Recipes
   - Wines
   - Cocktails
   - Beer & Liquor
   - Searchable picker with filters (category, type)
   - User picks individual items (e.g., 5 specific dishes)
3. **Assessment Type**: Multiple choice / Voice response / Interactive AI / Mixed
4. **Assignment**: Who gets this course? (by role, individual, all staff)
5. **Longevity**: Deadline date, expiry date, recurring (one-time vs. ongoing)
6. **Review & Build**: Summary → AI generates course outline → user reviews → build content

**AI behavior**: For each selected item, the AI creates:
- A content element with the item's key details (description, preparation, ingredients)
- A feature element with allergen warnings (if applicable)
- A media element pulling the product's existing image
- Key talking points for guest descriptions
- Pairing suggestions (if wine/cocktail selected alongside food)

### 8.2 Wizard: SOP Review / Employee Handbook

**Use case**: Training on operational procedures, company policies, safety protocols.

**Steps**:
1. **Topic Selection**: Two paths:
   - **From manual**: Browse/search `manual_sections` + `document_sections` → pick specific sections
   - **Custom topic**: User describes topics → AI searches database for relevant material and recommends sections
2. **Course Details**: Title, description, learning objectives
3. **AI Instructions**: Additional context for the AI ("focus on the new handwashing protocol", "emphasize the updated PTO policy")
4. **Assessment Type**: Multiple choice (most common for SOPs) / Voice / Mixed
5. **Assignment & Longevity**: Same as Wizard 8.1
6. **Review & Build**: Summary → outline → build

**AI behavior**: Reads complete manual sections, restructures into digestible lessons with:
- Clear topic headers
- Step-by-step breakdowns for procedures
- Caution/warning callouts for safety-critical content
- "Did you know" callouts for policy rationale
- Key point summaries at the end of each lesson

### 8.3 Wizard: Steps of Service

**Use case**: Training front-of-house staff on service sequences (greeting, seating, ordering, serving, farewell).

**Steps**:
1. **Role Selection**: Which role's steps of service? (Server, Busser, Bartender, Barback, Host)
2. **Step Selection**: Which specific steps to cover? (User picks from the role's step sequence in the database)
3. **Course Details**: Title, emphasis areas, any recent changes to highlight
4. **Assessment Type**: **Interactive AI (recommended)** — with credit warning. Option to switch to voice response or mixed.
5. **Assignment & Longevity**: Same as other wizards
6. **Review & Build**: Summary → outline → build

**AI behavior**: Creates scenario-based content:
- Each step gets a content element with the procedure
- Feature callouts for common mistakes and best practices
- The quiz section defaults to Interactive AI for role-playing
- AI generates role-play scenarios ("A guest says they've been waiting 10 minutes for their drink. Walk me through your response.")

**Search consideration**: Steps of Service content may live in `manual_sections` OR in a dedicated structure. If the existing manual has steps of service by role, the wizard searches for them. If not, the user can input custom content or the AI can search across all manual sections for service-related content.

**Potential need**: A `steps_of_service` table or a tag/category filter on `manual_sections` to make step-of-service content easily queryable by role. Alternatively, we can use the existing `tags` array on `manual_sections` (e.g., `tags: ['steps-of-service', 'server']`) and create a search function that filters by tag.

### 8.4 Wizard: Line Cook Training

**Use case**: Training kitchen staff on prep procedures, plate specifications, portioning, and kitchen standards.

**Steps**:
1. **Training Focus**: Two sections:
   - **Operational Standards**: Pick from manual sections (kitchen safety, FIFO, temp controls, sanitation)
   - **Dish Training**: Pick specific dishes from `plate_specs` + `prep_recipes`
2. **Portion Detail Level**: How detailed? (Basic = name + components, Detailed = exact weights/measures/temps)
3. **Course Details**: Title, emphasis areas
4. **Assessment Type**: **Multiple choice (recommended)** — precise portioning is best tested with exact values. Option for voice ("walk me through the prep steps for demi-glace").
5. **Assignment & Longevity**: Same
6. **Review & Build**: Summary → outline → build

**AI behavior**: Creates precision-focused content:
- Exact quantities, temperatures, times from prep recipes
- Component breakdowns with portions
- Feature callouts for critical control points (temps, cross-contamination)
- Warning elements for allergen handling
- Multiple choice questions with specific values as distractors ("The ribeye is served at: A) 8oz B) 10oz C) 12oz D) 14oz")

### 8.5 Wizard: Custom Course

**Use case**: Anything not covered by the other wizards. Full creative freedom.

**Steps**:
1. **Course Description**: Free-text description of what the course should cover
2. **Source Material**: Three options:
   - **Search everything**: AI searches across the entire database (all manual sections, all products, all documents)
   - **Pick sources**: User manually selects tables/sections to include
   - **Upload new material**: User provides text, files, or links as source
3. **AI Instructions**: Detailed instructions for the AI
4. **Assessment Type**: User chooses
5. **Assignment & Longevity**: Same
6. **Review & Build**: Summary → outline → build

**AI behavior**: Deploys all available search functions (`search_manual_v2`, `search_dishes`, `search_wines`, `search_cocktails`, `search_recipes`, `search_beer_liquor`) to find relevant content. Presents material recommendations to the user before building.

### 8.6 Wizard: Start Blank

**Use case**: Power users who want to build from scratch without AI guidance.

**Behavior**:
- Drops directly into the Course Editor (Section 5)
- Empty canvas with the element palette on the left
- AI panel available on the right for assistance when needed
- No wizard steps — user has full control from the start
- Can still use AI: drag a Content element → click 🤖 → "write about our wine service procedures" → AI generates

---

## 9. Teacher Levels & AI Personas

### 9.1 Teacher Configuration

Each course is assigned a **teacher level** that controls how the AI communicates during learning sessions and assessments.

```typescript
{
  teacher_level: 'friendly' | 'professional' | 'strict' | 'expert',
  teacher_persona_id?: string,  // Optional: specific AI teacher from ai_teachers table
}
```

### 9.2 Teacher Levels

| Level | Tone | Quiz Leniency | Best For |
|-------|------|---------------|----------|
| **Friendly** | Casual, encouraging, lots of praise. Uses analogies and simple language. | Lenient — hints before marking wrong, partial credit | New hires, first-time training |
| **Professional** | Clear, structured, business-appropriate. Balanced encouragement + correction. | Standard — clear right/wrong, good explanations | Standard training, SOPs |
| **Strict** | Direct, no-nonsense, high standards. Emphasizes precision. | Strict — no hints, exact answers required, no partial credit | Kitchen/safety training, allergen protocols |
| **Expert** | Deep knowledge, industry context, "why" behind everything. Assumes baseline competency. | Challenging — follow-up questions, expects elaboration | Advanced training, manager development |

### 9.3 Advisement to User

When the user selects a teacher level in the wizard:
```
┌─────────────────────────────────────────────┐
│ Teacher Level                               │
│                                             │
│ ○ Friendly                                  │
│   Warm, encouraging. Great for new hires    │
│   who are learning for the first time.      │
│                                             │
│ ● Professional (Recommended)                │
│   Clear and balanced. Good for most         │
│   training situations.                      │
│                                             │
│ ○ Strict                                    │
│   Direct and precise. Best for safety-      │
│   critical content (allergens, kitchen).    │
│                                             │
│ ○ Expert                                    │
│   Deep and challenging. For experienced     │
│   staff or management training.             │
└─────────────────────────────────────────────┘
```

### 9.4 AI Teacher Selection

If custom AI teachers exist in the `ai_teachers` table, the user can also pick which "teacher persona" to use (e.g., "Sophia the Sommelier" for wine courses, "Chef Marco" for kitchen courses). This layers on top of the teacher level.

---

## 10. The "Quick Build" Flow

For users who want to get courses out FAST (the most common scenario):

```
1. Pick wizard type (e.g., "Menu Rollout")
2. Fill in basics (title, select items)
3. Click "Build Course" ←── SINGLE ACTION
   ↓
   AI generates outline (~5 sec)
   ↓
   AI auto-builds all content (~30-60 sec, shows progress)
   ↓
   AI asks: "Want me to generate images too?
   (You can later replace with your own photos/videos)"
   ↓
   [Yes, add images] → AI generates educational images (~20 sec)
   NOTE: AI does NOT generate images for products that have
   existing photos in the database — it uses those instead.
   AI only generates illustrative images (handwashing, table
   setup, general concepts).
   ↓
4. Course is ready for review
5. User can edit anything, or just hit [Publish]
6. Course appears in the Training section for assigned staff
```

**Total time: ~2-3 minutes** from wizard start to published course.

For users who want more control, they can pause at any step (review outline, edit instructions, build one element at a time).

---

## 11. Image Generation Strategy

### 11.1 When AI Generates Images

- **Educational illustrations**: Proper handwashing technique, table setup diagram, garnish placement
- **Concept visuals**: Flavor profiles, wine regions map, cocktail classification
- **Scenario images**: Guest interaction setups, restaurant floor plans

### 11.2 When AI Does NOT Generate Images

- **Product photos**: Dishes, wines, cocktails, beer — these have real photos in the database. AI uses existing product images.
- **Branded content**: Restaurant logos, specific decor — user uploads these.
- **People**: AI does not generate images of staff or guests.

### 11.3 Image Quality Requirements

- **Model**: OpenAI DALL-E 3 (or best available at build time)
- **Style**: Clean, professional, instructional. Not photorealistic for illustrations — more like high-quality infographics.
- **Resolution**: 1024x1024 minimum
- **Storage**: `course_media` Supabase bucket, optimized/compressed before storage
- **Fallback**: If image generation fails, element shows placeholder with caption text. User can always upload their own.

---

## 12. Database Schema Impact

The existing training tables (`courses`, `course_sections`, `course_enrollments`, `section_progress`, `course_conversations`, `quiz_questions`, `quiz_attempts`, `quiz_attempt_answers`, `evaluations`, `rollouts`, `rollout_assignments`, `content_change_log`, `training_programs`, `program_enrollments`) will be **dropped and rebuilt from scratch**. The new schema is designed around the element-based content model from the ground up.

### 12.1 Core Tables (Rebuilt)

| Table | Purpose |
|-------|---------|
| `courses` | Course definitions — title, description, type (wizard type), teacher level, quiz config, status, versioning |
| `course_sections` | Lesson definitions — title, `elements JSONB` (the element array), source material refs, generation status, sort order |
| `course_enrollments` | Student enrollment tracking per course (status, scores, timestamps) |
| `section_progress` | Per-section completion — topics covered, quiz score, time spent, content hash at completion |
| `course_conversations` | Persistent AI teacher chat history (messages JSONB, session summary, topic tracking) |
| `quiz_questions` | MC + voice + interactive questions — pre-generated at build time into a question pool |
| `quiz_attempts` | Quiz session tracking (attempt number, score, pass/fail) |
| `quiz_attempt_answers` | Individual answer records (MC selection, voice transcription, AI feedback) |
| `evaluations` | AI evaluation snapshots — dual feedback (student view + manager view) |
| `rollouts` | Training assignment packages with deadlines and expiry |
| `rollout_assignments` | Per-user rollout assignment tracking |
| `content_change_log` | MD5 hash tracking for source content updates → course staleness detection |
| `training_programs` | Program groupings (optional — groups multiple courses into a program) |
| `program_enrollments` | Program-level enrollment + auto-sync from course completions |

### 12.2 New Tables

| Table | Purpose |
|-------|---------|
| `section_chunks` | Search-optimized chunks of `manual_sections` content (300-800 words each, with focused FTS + embeddings) |
| `element_rebuild_log` | Per-element rebuild audit trail (what changed, what was rebuilt, admin review status) |
| `restaurant_documents` | Ingested manuals, handbooks, SOPs (future — not required for Phase 1) |
| `document_sections` | Sections within ingested documents (future — not required for Phase 1) |
| `document_chunks` | Search-optimized chunks of document_sections (future — not required for Phase 1) |

### 12.3 New Storage Bucket

| Bucket | Purpose | Limits |
|--------|---------|--------|
| `course-media` | Course images (uploaded + AI-generated) + short video clips | Private, 50MB max, image/* + video/mp4 |

### 12.4 New Edge Functions

| Function | Purpose |
|----------|---------|
| `build-course` | AI course outline + content generation. Reads source material, produces elements JSONB. |
| `build-course-element` | Regenerate a single element with new instructions. |
| `generate-image` | Generate educational illustrations via DALL-E 3 (`mode: 'course'`). |
| `generate-quiz-pool` | Generate quiz question pool from course content + source material. |
| `rebuild-course-elements` | Element-level rebuild of stale elements + quiz regeneration. |

### 12.5 New/Modified Frontend

| Component | Purpose |
|-----------|---------|
| `CourseBuilderPage` | Main builder page (like AdminFormBuilderPage) |
| `CourseBuilderContext` | State management (like BuilderContext for forms) |
| `ElementPalette` | Left panel — draggable element types |
| `BuilderCanvas` | Center — rendered elements with controls |
| `ElementRenderer` | Renders content/feature/media elements |
| `ElementControls` | Drag handle, AI button, edit, delete per element |
| `AIBuilderPanel` | Right panel — chat with AI for course editing |
| `CourseWizardDialog` | Wizard selector + wizard step flows |
| `MenuRolloutWizard` | Wizard 8.1 steps |
| `SOPReviewWizard` | Wizard 8.2 steps |
| `StepsOfServiceWizard` | Wizard 8.3 steps |
| `LineCookWizard` | Wizard 8.4 steps |
| `CustomCourseWizard` | Wizard 8.5 steps |
| `QuizConfigPanel` | Quiz settings panel within builder |
| `TeacherLevelSelector` | Teacher level picker with descriptions |
| `SourceMaterialPicker` | Searchable DB item selector for wizards |

---

## 13. What This Reuses vs. What's New

### Reuses from Form Builder (Pattern, Not Code)
- JSONB array of typed elements (like `fields[]`)
- BuilderContext state machine (reducer + context pattern)
- Element palette + canvas + right panel layout
- Undo/redo history (snapshot-based)
- AI chat panel for conversational editing
- Auto-save with optimistic concurrency
- Arrow-based element reordering (drag-and-drop only for adding new elements from palette)

### Reuses from Existing Training System (Patterns Only, Not Tables)
- The enrollment + progress tracking **pattern** (rebuilt with new schema)
- The rollout system **concept** (rebuilt with new schema)
- Content change detection **approach** (MD5 hashing, rebuilt for element source_refs)
- AI teacher personas from `ai_teachers` table (reused as-is — this table stays)
- AI prompt templates from `ai_prompts` table (reused + extended)

> **Note**: All training-related tables are dropped and rebuilt. Only the `ai_teachers` and `ai_prompts` tables (which serve the broader AI system, not just training) are preserved.

### Reuses from AI System
- OpenAI chat completions (gpt-4o-mini for content generation)
- OpenAI embeddings (text-embedding-3-small for search)
- Realtime voice (for Interactive AI quiz mode)
- Usage tracking + credit system
- Search functions (all 7 hybrid search functions for source material discovery)

### Entirely New (Built from Scratch)
- All training database tables (dropped + redesigned around element-based content)
- Element type system (content, feature, media)
- Two-step generation workflow (outline → content)
- Course Builder editor UI (admin authoring tool)
- Course Player UI (staff learning tool — replaces existing training pages)
- Manager Training Dashboard
- 6 course creation wizards
- Image generation integration (DALL-E)
- `course-media` storage bucket
- `build-course` / `build-course-element` / `generate-image` / `generate-quiz-pool` / `rebuild-course-elements` edge functions
- Element-level AI regeneration
- Source material assembly pipeline
- Quiz pool pre-generation
- All training hooks (rebuilt for new schema)
- All training components (rebuilt for element-based rendering)

---

## 14. Open Questions for Discussion

### Q1: Steps of Service Data
Do we need a dedicated `steps_of_service` table, or can we use tags on `manual_sections` to filter step-of-service content by role? The wizard needs to know which steps exist for each role.

**Recommendation**: Use tags for now (`tags: ['steps-of-service', 'server', 'greeting']`). If the data model becomes more complex (step ordering, role-specific overrides), create a dedicated table later.

### Q2: Document Ingestion (restaurant_documents / document_sections)
Should Phase 1 include the document ingestion pipeline for external manuals, or defer it? The current `manual_sections` table already has all of Alamo Prime's content.

**Recommendation**: Defer to a later phase. Build the Course Builder using existing `manual_sections` + product tables first. Add document ingestion when restaurants start uploading their own manuals.

### Q3: Image Generation Model
DALL-E 3 vs. alternatives? Quality is critical — "can't put crap out."

**Recommendation**: Start with DALL-E 3 (best quality from OpenAI). Evaluate quality during development. If insufficient, explore Midjourney API or Stability AI as alternatives.

### Q4: Video Storage Limits
How much video storage per restaurant? Short clips (30 sec) vs. longer training videos (5 min)?

**Recommendation**: Start with YouTube/Loom embeds for videos, Supabase Storage for images only. Add short clip support (max 50MB / 30 sec) in a later phase if needed.

### Q5: Course Versioning
When a course is rebuilt after content changes, do we keep the old version? Students who completed v1 — does their completion still count?

**Recommendation**: Yes, keep old versions. Student completions are tied to a version. When a new version is published, the old version is archived. Managers can decide whether to require re-certification on the new version via a rollout.

---

## 15. System Architecture

```
                    ┌─────────────────────┐
                    │   COURSE BUILDER    │  Admin/Manager interface
                    │   (Authoring Tool)  │
                    │                     │
                    │  Wizards → Editor   │
                    │  AI generates       │
                    │  elements + quizzes │
                    └─────────┬───────────┘
                              │ publishes to
                              ▼
                    ┌─────────────────────┐
                    │  SHARED DATABASE    │  courses, course_sections,
                    │                     │  quiz_questions, enrollments,
                    │                     │  progress, evaluations
                    └─────────┬───────────┘
                              │ consumed by
                              ▼
                    ┌─────────────────────┐
                    │   COURSE PLAYER     │  Staff interface
                    │   (Learning Tool)   │
                    │                     │
                    │  Browse → Learn     │
                    │  AI teacher chat    │
                    │  Take quizzes       │
                    │  Track progress     │
                    └─────────────────────┘
                              │ reports to
                              ▼
                    ┌─────────────────────┐
                    │  MANAGER DASHBOARD  │  Admin/Manager interface
                    │                     │
                    │  Team progress      │
                    │  Rollouts           │
                    │  AI insights        │
                    └─────────────────────┘
```

Both the Builder and the Player are built from scratch as part of this feature. The Builder CREATES courses. The Player DELIVERS them. The Dashboard MONITORS them. They share the same database tables but are completely separate UI experiences.

The existing training UI (TrainingHome, ProgramDetail, CourseDetail, placeholder components) and all placeholder seed data (Server 101 courses, training programs) will be removed as part of Phase 1. Everything is rebuilt using the new element-based architecture.

---

---

## 16. Manual Content Migration Plan

The existing `manual_sections` content (34 sections, 30 with EN+ES content, 30 with embeddings) must be restructured to support the new dual-layer architecture (full sections + search chunks). This is a prerequisite for the Course Builder — without it, the AI has no properly chunked source material to search, and no properly structured sections to assemble for course building.

### 16.1 Migration Steps

1. **Create `section_chunks` table** — New table with FK to `manual_sections`, chunk-level FTS + embeddings
2. **Build chunking function** — A Postgres function or edge function that:
   - Reads each `manual_sections.content_en` / `content_es`
   - Splits at Markdown headings (H2, H3) or natural paragraph boundaries
   - Targets 300–800 words per chunk
   - Preserves the heading context for each chunk
   - Inserts into `section_chunks` with `chunk_index` ordering
3. **Run initial chunking** — Process all 30 sections → generate ~100-200 chunks
4. **Generate chunk embeddings** — Call `text-embedding-3-small` for each chunk (both EN + ES)
5. **Generate chunk FTS vectors** — Auto-populated by trigger on insert
6. **Update search functions** — Modify `search_manual_v2()` to query `section_chunks` instead of `manual_sections` for search. Add a `get_full_section()` function that returns the complete section content by ID (for course building).
7. **Add auto-chunking trigger** — When `manual_sections.content_en` or `content_es` is updated:
   - Delete existing chunks for that section
   - Re-run chunking function
   - Re-generate chunk embeddings
   - This ensures chunks always reflect the latest section content
8. **Verify** — Test that AI Q&A search returns better results with chunks, and that course building still gets complete sections

### 16.2 Future: Document Ingestion Pipeline

When restaurants upload their own manuals, the same chunking logic applies:
- `restaurant_documents` → `document_sections` → `document_chunks`
- Same 300–800 word chunking rules
- Same dual-layer pattern: full sections for assembly, chunks for search

This is deferred to a later phase — the current `manual_sections` content is sufficient for Alamo Prime's Course Builder.

---

## 17. Phase 1 Requirement: HTML Design Mockup

Before writing any production code, **Phase 1 must produce a static HTML/CSS mockup** of the Course Builder interface. This mockup will:

1. **Validate the layout** — Three-column editor (palette | canvas | AI panel), mobile tab layout, element rendering
2. **Validate the element system** — How content, feature, and media elements look when rendered, both in outline state and generated state
3. **Validate the wizard flows** — Step-by-step wizard screens for at least 2 wizards (Menu Rollout + SOP Review)
4. **Validate the quiz builder** — Quiz configuration panel, question preview
5. **Validate the notification system** — The full-width content-change alert banner
6. **Validate mobile responsiveness** — iPad and phone breakpoints

The mockup is a standalone HTML file (or small set of files) with hardcoded content — no backend, no API calls. It exists purely to confirm we're on the right track with the design before investing in implementation.

**Deliverable**: A clickable HTML mockup that the team can review, iterate on, and approve before Phase 2 begins building the real thing.

---

## Next Steps

This overview has been approved. The detailed **master-implementation-plan.md** breaks the work into 9 phases:

1. **Phase 1 — HTML Mockup**: Clickable HTML/CSS prototype (done)
2. **Phase 2 — Teardown + Foundation**: Drop 18 old tables, rebuild 3 core tables, stub UI
3. **Phase 3 — Builder Core**: Types, state management, element system, 3-column editor
4. **Phase 4 — Menu Rollout Wizard + AI + Images**: First wizard, `build-course`, DALL-E image gen
5. **Phase 5 — Quiz + Player MVP**: MC quiz, Course Player, enrollment/progress (training goes live)
6. **Phase 6 — Element-Level Rebuild**: Stale detection, admin-triggered element rebuilds
7. **Phase 7 — Manual Migration + Chunking + Voice Quiz**: Convert manuals, search upgrade, voice quiz
8. **Phase 8 — SOP Review + Steps of Service + Rollouts + Dashboard**: Next two wizards, rollout system
9. **Phase 9 — Remaining Wizards + Interactive AI + Polish**: Line Cook, Custom, Start Blank, realtime quiz

**MVP Boundary**: Phases 1-5. **Wizard Strategy**: One at a time, battle-test each before the next.

See `master-implementation-plan.md` for detailed specs, migration SQL, and acceptance criteria per phase.
