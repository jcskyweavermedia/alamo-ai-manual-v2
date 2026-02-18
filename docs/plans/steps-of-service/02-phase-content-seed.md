# Phase 2: Content Processing & Seed Data

## Overview

Parse `docs/steps of service/server-steps-of-service.md` (366 lines) into 29 section rows, format each as markdown optimized for both rendering and LLM search retrieval, and create a seed migration.

---

## Source Document Analysis

The source is plain text (not markdown). It has:
- No headings (all flat text)
- No markdown formatting (no `#`, `**`, `-`, etc.)
- Natural section breaks via topic transitions
- Examples embedded inline
- "BEST PRACTICE" callouts as inline text
- A two-column phrases table (tab-separated)
- A glossary as term-definition pairs

### Content Processing Steps

1. **Identify section boundaries** — Map each section to lines in the source document
2. **Convert to markdown** — Add headings, lists, callouts, tables, emphasis
3. **Optimize for dual use** — Display (readable, scannable) + Search (keyword-rich, self-contained)
4. **Validate parent_key references** — Ensure children point to valid parents

---

## Section Mapping (29 sections)

| # | section_key | title_en | parent_key | Source Lines | Content Focus |
|---|-------------|----------|------------|-------------|---------------|
| 1 | `welcome` | Welcome & Mission | — | 1-2 | Mission statement, hospitality philosophy |
| 2 | `primary-responsibilities` | Primary Responsibilities | — | 3-7 | Shift prep, station, teamwork, policies |
| 3 | `prime-steakhouse` | What is a Prime Steakhouse? | — | 8-10 | Concept, coursed dining, menu philosophy |
| 4 | `guest-service-standards` | Guest Service Standards | — | 11-27 | Eye contact, names, anticipation, right of way, confidence |
| 5 | `appearance-uniforms` | Appearance & Uniforms | — | 28-42 | Grooming, dress code |
| 6 | `tools-knowledge` | Tools & Knowledge | — | 43-49 | Pens, wine key, bank, menu knowledge |
| 7 | `dining-room` | Dining Room Setup | — | 50-54 | Station prep, tables, floors, steak knives |
| 8 | `job-responsibilities` | Job Responsibilities | — | 55-72 | Full responsibility list |
| 9 | `professionalism` | Professionalism | — | 73-81 | Eye contact, smile, body language, tone, positioning, language |
| 10 | `food-allergies` | Food Allergies & Intolerances | — | 82-90 | Allergens, symptoms, lactose, celiac |
| 11 | `warm-welcome` | Warm Welcome & Seating | — | 91-105 | Greeting, seating procedure, chit, menu intro |
| 12 | `transferring-checks` | Transferring Checks | — | 106-107 | Bar-to-table check transfers |
| 13 | `first-approach` | First Approach — The Greeting | — | 108-109 | Overview of the 4-part greeting |
| 14 | `first-approach-intro` | Name & Introduction | `first-approach` | 110-133 | Name, special occasion, first-time vs returning |
| 15 | `first-approach-beverage` | Beverage Order | `first-approach` | 134-154 | Cocktail/bourbon/wine suggestions, examples |
| 16 | `first-approach-water` | Water Type | `first-approach` | 155-160 | Regular vs bottled, still vs sparkling |
| 17 | `first-approach-appetizer` | Appetizer Mention | `first-approach` | 161-172 | Reading guests, 2-3 suggestions, taking the order |
| 18 | `second-approach` | Second Approach — Beverage Delivery & Entrée Presentation | — | 173-188 | Tray service, steak knife, 2-3 recommendations |
| 19 | `taking-the-order` | Taking the Order | — | 189-203 | Repeat-back, steak temps, cut/size/sides |
| 20 | `coursing` | Coursing Explained | — | 204-239 | Course progression, rules, timing, examples |
| 21 | `food-delivery-times` | Food Delivery Times | — | 240-246 | Appetizer/entrée/dessert timing |
| 22 | `prebussing` | Pre-bussing & Table Maintenance | — | 247-251 | Clearing, refills, napkin folding |
| 23 | `the-check` | The Check | — | 252-258 | Audit, present, collect, email card, farewell |
| 24 | `service-dos-donts` | Service Do's and Don'ts | — | 259-266 | Left/right service, trays, labels, silverware |
| 25 | `situations` | Situations & Guest Issues | — | 267-296 | Wrong temp, late food, spills, complaints |
| 26 | `teamwork` | Being Part of a Team | — | 297-305 | Team service philosophy |
| 27 | `study-guide` | Study Guide | — | 306-336 | Review questions |
| 28 | `phrases` | Phrases to Avoid & Use | — | 337-350 | Professional language reference |
| 29 | `glossary` | Glossary | — | 351-366 | Steak cuts, cooking terms, bourbon terms |

### Hierarchy

- 25 top-level sections (parent_key = NULL)
- 4 child sections under `first-approach`:
  - `first-approach-intro`
  - `first-approach-beverage`
  - `first-approach-water`
  - `first-approach-appetizer`

---

## Markdown Formatting Conventions

### Headings

Each section's markdown starts with `## {section_title}` as the top-level heading. Sub-sections within a section use `###`.

```markdown
## First Approach — The Greeting

The greeting has several parts that must be covered:

### 1. Name & Introduction
...
```

Wait — since each section is rendered individually (not as one long document), the top heading is implicit from the UI. So section content should start with the body, not a heading. Sub-headings within a section use `###`.

**Convention**: No `##` at the start. Use `###` for sub-headings within a section.

### Lists

Use bullet lists (`-`) for guidelines and numbered lists (`1.`) for sequential steps.

```markdown
Your primary responsibilities include:

- Arrive for your shift on time, in proper uniform, prepared with all tools
- Determine your station for the evening and detail it thoroughly
- Teamwork is key in delivering the Alamo Prime experience
- Adhere to all Alamo Prime Steakhouse policies and procedures

> **Best Practice**: Being 15 minutes early is being on time!
```

### Callouts

Use blockquote callouts for best practices and important notes:

```markdown
> **Best Practice**: The best servers always share one major quality — **CONFIDENCE!**
```

### Examples / Dialogue

Use blockquotes with italic role labels for conversation examples:

```markdown
> *Server*: "Welcome to Alamo Prime, Mr. Smith! It's a pleasure to have you here. Is this your first time dining with us?"
>
> *Guest*: "Actually, it is!"
>
> *Server*: "That's wonderful! We are a prime steakhouse and our menu features hand-selected cuts of beef..."
```

### Tables

Use GFM tables for structured data:

```markdown
| Avoid | Use Instead |
|-------|-------------|
| "No, we don't do that" | "Let me find out for you" |
| "Alright/Okay" | "My pleasure" |
```

### Emphasis

- **Bold** for key terms, critical actions
- *Italic* for examples, quotes
- `code` not used (not a technical document)

### Definition Lists (Glossary)

Use bold term + dash + definition:

```markdown
**Prime** — The highest USDA beef grade, indicating superior marbling, tenderness, and flavor. Only about 2-3% of all beef earns the Prime designation.

**Marbling** — The white flecks of intramuscular fat within a cut of beef. More marbling generally means more flavor and tenderness.
```

---

## Sample Sections (3 examples)

### Short Section: `tools-knowledge`

```markdown
Make sure you have these items before every shift:

- Pens
- Wine key
- A bank (cash for making change)
- Check presenters
- Steak temperature card (for reference)

You must also know the menu, cocktails, wine list, bourbon selection, and daily specials inside and out.
```

### Medium Section: `taking-the-order`

```markdown
Once your guests are ready to order, have your chit and pen ready. Begin with ladies first, if possible.

**You must REPEAT the ORDER back to each guest individually.** This ensures accuracy. Do not repeat the order to the entire table as a group — that is not the upscale way. Take one person's order, repeat it back immediately, then move to the next guest.

### Steak Orders

When taking steak orders, always confirm:

1. **The cut and size** (e.g., 12 oz New York Strip)
2. **The desired temperature**
3. **Any additions or toppings** (blue cheese crust, peppercorn sauce, sautéed mushrooms, etc.)
4. **Their choice of sides**

### Steak Temperatures

| Temperature | Description |
|-------------|-------------|
| Rare | Cool red center |
| Medium Rare | Warm red center *(our most popular)* |
| Medium | Warm pink center |
| Medium Well | Slight hint of pink |
| Well Done | No pink, cooked through |

If a guest is unsure about a temperature, describe them clearly using the table above.

> **Best Practice**: Repeat the order to each guest individually right after they finish ordering. Do not wait and repeat to the group.
```

### Long Section: `first-approach-intro`

```markdown
Your introduction sets the tone for the entire dining experience. Cover these key points:

### Address the Guest

- Use the guest's last name (from the seating chit)
- If you cannot pronounce their name, ask for help — if in doubt, don't use it
- Acknowledge any special occasions: *"Congratulations, Mr. Smith! Happy Birthday!"*
- Ask if this is anyone's first time at the restaurant

### First-Time Guests

All new guests need to be informed about:

1. **We are a prime steakhouse** featuring the finest cuts of beef and an exceptional dining experience
2. **Our menu is coursed** — appetizers, entrées with your choice of sides, and desserts
3. **Our steaks are hand-selected, aged, and cooked to your preferred temperature** — our Chef takes great pride in every cut
4. **We feature an outstanding bourbon and whiskey program**, along with a curated wine list

> *Server*: "Welcome to Alamo Prime, Mr. Smith! It's a pleasure to have you here. Is this your first time dining with us?"
>
> *Guest*: "Actually, it is!"
>
> *Server*: "That's wonderful! We are a prime steakhouse and our menu features hand-selected cuts of beef, fresh seafood, and classic steakhouse appetizers. Your meal will be coursed — we'll start you with appetizers, then move to your entrée with your choice of sides, and finish with dessert if you'd like. We also have an exceptional bourbon and whiskey collection."

### Returning Guests

- Welcome them back and thank them for choosing Alamo Prime again
- Proceed directly to the beverage order

> **Best Practice**: Infuse the greeting with your own personality. Always cover the main points, but find new ways of delivering the message. Practice your spiel, listen to how others do it, and develop a style that suits you. The best servers always learn from others. Also, ask your guests if they are in a hurry to catch a show or other engagement.
```

---

## Seed Migration Structure

File: `supabase/migrations/TIMESTAMP_seed_steps_of_service_server.sql`

### SQL Template

```sql
-- =============================================================================
-- SEED: Steps of Service — Server Position (Alamo Prime)
-- 29 sections for the Server position
-- =============================================================================

-- Get the Alamo Prime group_id and admin user_id
DO $$
DECLARE
  v_group_id UUID;
  v_user_id UUID;
BEGIN
  SELECT id INTO v_group_id FROM public.groups WHERE slug = 'alamo-prime';
  SELECT id INTO v_user_id FROM public.profiles
    WHERE email = 'juancarlosmarchan@skyweavermedia.com';

  -- Section 1: Welcome & Mission
  INSERT INTO public.steps_of_service_sections
    (group_id, position, section_key, parent_key, sort_order,
     title_en, title_es, content_en, content_es, status, version, created_by)
  VALUES
    (v_group_id, 'server', 'welcome', NULL, 10,
     'Welcome & Mission',
     'Bienvenida y Misión',
     E'Your mission is to provide our guests with a memorable...',
     NULL,
     'published', 1, v_user_id);

  -- Section 2: Primary Responsibilities
  INSERT INTO ...

  -- ... (sections 3-29)
END;
$$;
```

### sort_order Convention

- Top-level sections: 10, 20, 30, ... (increments of 10 for easy insertion)
- Children of `first-approach`: 131, 132, 133, 134 (parent_sort × 10 + child index)

### Language Strategy

- `content_en`: All 29 sections populated (English)
- `content_es`: NULL for initial seed (Spanish translations added in a future phase)
- `title_es`: Populated with Spanish titles for all 29 sections (short strings, easy to translate)

---

## Content Processing Workflow

1. Read source document line by line
2. For each section:
   a. Extract the raw text from source lines
   b. Convert to markdown following conventions above
   c. Escape single quotes for SQL (`''`)
   d. Escape backslashes if any
   e. Use `E'...'` string syntax for sections with special characters
3. Assemble into INSERT statements within DO block
4. Test: push migration, verify 29 rows, spot-check 3-5 sections

---

## Verification Checklist

After pushing the seed migration:

- [ ] Row count: `SELECT count(*) FROM steps_of_service_sections;` → 29
- [ ] Position: All rows have `position = 'server'`
- [ ] Group: All rows have correct `group_id` (Alamo Prime)
- [ ] Hierarchy: 4 rows have `parent_key = 'first-approach'`, 25 have NULL
- [ ] Sort order: `SELECT section_key, sort_order FROM steps_of_service_sections ORDER BY sort_order;` → logical progression
- [ ] FTS populated: `SELECT section_key FROM steps_of_service_sections WHERE search_vector_en IS NULL;` → 0 rows
- [ ] Content spot-check: Read `welcome`, `first-approach-intro`, `glossary` sections — markdown renders correctly
- [ ] No embeddings yet: `SELECT count(*) FROM steps_of_service_sections WHERE embedding_en IS NOT NULL;` → 0 (Phase 5)

---

## Dependencies

- **Requires**: Phase 1 (table must exist)
- **Requires**: Alamo Prime group exists (slug: `alamo-prime`)
- **Requires**: Admin user exists
- **Blocks**: Phase 3 (frontend needs data to display)
- **Blocks**: Phase 5 (embeddings need content)
