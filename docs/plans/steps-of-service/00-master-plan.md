# Steps of Service Viewer — Master Plan

## Overview

Build a **Steps of Service (SOS) Viewer** that allows restaurant staff to study, search, and practice their position-specific service procedures through rendered markdown and AI-powered roleplay. The viewer supports four positions (Server, Bartender, Busser, Barback), uses grouped AI action buttons (Option A), and is designed from the ground up for multi-restaurant deployment.

### Goals

1. **Database**: Create a `steps_of_service_sections` table with FTS + vector search, scoped by `group_id` and `position`, following all existing patterns (RLS, indexes, RRF search function).
2. **Content**: Break the server SOS document into ~20-25 well-scoped sections, each as markdown, optimized for both display and LLM search retrieval.
3. **Frontend**: Build a hybrid viewer (position selector → markdown detail view with section sidebar + AI buttons), reusing `MarkdownRenderer` and the existing viewer architecture.
4. **AI**: Implement grouped action buttons (Questions, Practice ▾, Listen ▾) with dropdown sub-actions for approach-specific roleplay and sample listening.

---

## Current State

| Component | Status |
|-----------|--------|
| Server SOS content | ✅ Raw markdown in `docs/steps of service/server-steps-of-service.md` (366 lines) |
| Bartender / Busser / Barback SOS | ❌ Not yet written |
| Database table | ❌ Does not exist |
| Search function | ❌ Does not exist |
| Frontend viewer | ❌ Does not exist |
| AI prompts for SOS | ❌ Does not exist |
| Navigation entry | ❌ Not in STAFF_NAV_ITEMS |
| Route | ❌ Not in App.tsx |

---

## Scope Decisions

| Decision | Rationale |
|----------|-----------|
| Single table (`steps_of_service_sections`), not dual-table | Content stored once per section. Display = fetch all rows in sort_order. Search = each row is a focused chunk. No sync issues. |
| Markdown stored per-section in DB, not as files | Multi-tenant: each restaurant has its own content. Files would require per-restaurant file management. DB rows are searchable, versionable, and group-scoped. |
| Position selector as card grid, not tabs | Consistent with existing product viewer pattern. Cleaner on mobile. Extensible to more positions. |
| Option A (grouped dropdown buttons) for AI | 3 visible buttons with dropdowns vs 8-10 in a row. Cleaner UX, still instant access. Context-aware (Option B) is a future enhancement. |
| `position` as TEXT with CHECK, not enum | Restaurants may have custom positions. TEXT is more flexible for multi-tenant. CHECK constraint on the table keeps it validated. |
| Reuse existing `MarkdownRenderer` | Already supports GFM, callouts, tables, styled headings. No need to reinvent. |
| Server SOS content only for initial seed | Bartender/Busser/Barback content will be added later (separate effort). The schema and viewer support all 4 from day 1. |

---

## Target Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    steps_of_service_sections                 │
│  id | group_id | position | section_key | parent_key |      │
│  section_title | content_en | content_es | sort_order |     │
│  search_vector | embedding_en | embedding_es |              │
│  status | version | created_by | created_at | updated_at    │
├─────────────────────────────────────────────────────────────┤
│  GIN index (search_vector)                                  │
│  HNSW index (embedding_en)                                  │
│  Composite index (group_id, position, sort_order)           │
│  search_steps_of_service() — RRF hybrid search              │
├─────────────────────────────────────────────────────────────┤
│  4 RLS policies (SELECT auth, INSERT/UPDATE/DELETE admin)   │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────┐   ┌──────────────────────┐
│  /steps-of-     │──▶│  StepsOfServicePage  │
│  service (route)│   │  (orchestrator)      │
└─────────────────┘   └──────┬───────────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
     ┌────────────┐  ┌─────────────┐  ┌──────────────┐
     │ Position   │  │ SOS Detail  │  │ AI Grouped   │
     │ Selector   │  │ View        │  │ Buttons      │
     │ (4 cards)  │  │ (markdown + │  │ (Questions,  │
     │            │  │  sidebar)   │  │  Practice ▾, │
     └────────────┘  └─────────────┘  │  Listen ▾)   │
                                      └──────────────┘
```

---

## Section Breakdown (Server SOS → ~22 Sections)

| # | section_key | section_title | Parent | Content Focus |
|---|-------------|---------------|--------|---------------|
| 1 | `welcome` | Welcome & Mission | — | Mission statement, hospitality philosophy |
| 2 | `primary-responsibilities` | Primary Responsibilities | — | Shift prep, station, teamwork |
| 3 | `prime-steakhouse` | What is a Prime Steakhouse? | — | Concept, coursed dining, menu philosophy |
| 4 | `guest-service-standards` | Guest Service Standards | — | Eye contact, names, anticipation, right of way |
| 5 | `appearance-uniforms` | Appearance & Uniforms | — | Grooming, dress code |
| 6 | `tools-knowledge` | Tools & Knowledge | — | Pens, wine key, bank, menu knowledge |
| 7 | `dining-room` | Dining Room Setup | — | Station prep, table/floor standards |
| 8 | `job-responsibilities` | Job Responsibilities | — | Full responsibility list |
| 9 | `professionalism` | Professionalism | — | Eye contact, smile, body language, tone, positioning |
| 10 | `food-allergies` | Food Allergies & Intolerances | — | Allergens, symptoms, lactose, celiac |
| 11 | `warm-welcome` | Warm Welcome & Seating | — | Greeting, seating procedure, chit, menu intro |
| 12 | `transferring-checks` | Transferring Checks | — | Bar-to-table check transfers |
| 13 | `first-approach` | First Approach — The Greeting | — | Overview of the 4-part greeting |
| 14 | `first-approach-intro` | Name & Introduction | `first-approach` | Name, special occasion, first-time vs returning |
| 15 | `first-approach-beverage` | Beverage Order | `first-approach` | Cocktail/bourbon/wine suggestions, examples |
| 16 | `first-approach-water` | Water Type | `first-approach` | Regular vs bottled, still vs sparkling |
| 17 | `first-approach-appetizer` | Appetizer Mention | `first-approach` | Reading guests, 2-3 suggestions, taking the order |
| 18 | `second-approach` | Second Approach — Beverage Delivery & Entrée Presentation | — | Tray service, steak knife, 2-3 recommendations |
| 19 | `taking-the-order` | Taking the Order | — | Repeat-back, steak temps, cut/size/sides |
| 20 | `coursing` | Coursing Explained | — | Course progression, rules, timing, examples |
| 21 | `food-delivery-times` | Food Delivery Times | — | Appetizer/entrée/dessert timing |
| 22 | `prebussing` | Pre-bussing & Table Maintenance | — | Clearing, refills, napkin folding |
| 23 | `the-check` | The Check | — | Audit, present, collect, email card, farewell |
| 24 | `service-dos-donts` | Service Do's and Don'ts | — | Left/right service, trays, labels, silverware |
| 25 | `situations` | Situations & Guest Issues | — | Wrong temp, late food, spills, complaints |
| 26 | `teamwork` | Being Part of a Team | — | Team service philosophy |
| 27 | `study-guide` | Study Guide | — | Review questions |
| 28 | `phrases` | Phrases to Avoid & Use | — | Professional language reference |
| 29 | `glossary` | Glossary | — | Steak cuts, cooking terms, bourbon terms |

---

## AI Actions for Steps of Service

### Visible Buttons (3)

| Button | Type | Behavior |
|--------|------|----------|
| **Questions?** | Single button | `conversation` mode — open-ended Q&A about the SOS for this position |
| **Practice ▾** | Dropdown button | Expands to show sub-actions (conversation mode) |
| **Listen ▾** | Dropdown button | Expands to show sub-actions (voice-tts mode) |

### Practice Sub-Actions (conversation mode — AI plays the guest)

| Key | Label | Description |
|-----|-------|-------------|
| `practice1stApproach` | 1st Approach | AI plays a guest being seated. User practices greeting, beverage order, water, appetizer mention. |
| `practice2ndApproach` | 2nd Approach | AI plays a guest after drinks arrive. User practices entrée recommendations. |
| `practiceDessert` | Dessert | AI plays a guest finishing entrées. User practices dessert upsell. |
| `practiceCheck` | The Check | AI plays a guest ready to leave. User practices check presentation and farewell. |

### Listen Sub-Actions (voice-tts mode — AI speaks a sample)

| Key | Label | Description |
|-----|-------|-------------|
| `listen1stApproach` | 1st Approach | AI speaks a polished sample 1st approach greeting |
| `listen2ndApproach` | 2nd Approach | AI speaks a sample entrée presentation |
| `listenDessert` | Dessert | AI speaks a sample dessert recommendation |
| `listenCheck` | The Check | AI speaks a sample check presentation |

### Total: 9 AI actions (1 + 4 practice + 4 listen)

Prompts stored in `ai_prompts` with:
- `domain = 'steps_of_service'`
- Action slugs: `action-steps_of_service-{key}` (text), `voice-action-steps_of_service-{key}` (voice)

---

## Phases

### Phase 1: Database Schema & Migration
> Table, indexes, RLS, trigger, search function, CHECK constraint updates. ~1 session.

- Create `steps_of_service_sections` table
- Create `update_sos_sections_search_vector()` trigger function
- Create `search_steps_of_service()` RRF hybrid search function
- Update `ai_prompts.domain` CHECK constraint to include `'steps_of_service'`
- Update `chat_sessions.context_type` CHECK constraint
- 4 RLS policies, 4+ indexes

**Deliverable:** Single migration file, all DB objects created.
**Detailed plan:** [01-phase-db-schema.md](./01-phase-db-schema.md)

### Phase 2: Content Processing & Seed Data
> Break server SOS into ~29 sections, format as markdown, seed into DB. ~1 session.

- Parse `server-steps-of-service.md` into 29 section rows
- Format each section's markdown for optimal rendering (headings, callouts, examples)
- Create seed migration with INSERT statements
- Establish markdown formatting conventions for future restaurant onboarding

**Deliverable:** Seed migration file, 29 rows for server position under Alamo Prime group.
**Detailed plan:** [02-phase-content-seed.md](./02-phase-content-seed.md)

### Phase 3: Frontend Viewer — Core
> Route, page, viewer hook, data hook, position selector, SOS detail view. ~1-2 sessions.

- Add `/steps-of-service` route to App.tsx
- Add nav entry to `STAFF_NAV_ITEMS` (icon: `ClipboardList`)
- Create `useSupabaseSOS` data hook (react-query)
- Create `useSOSViewer` viewer hook (position selection, section navigation)
- Create `SOSPositionSelector` component (4 position cards)
- Create `SOSDetailView` component (section sidebar + markdown content)
- Create `StepsOfServicePage` orchestrator
- Reuse `MarkdownRenderer` for content display

**Deliverable:** Functional viewer showing server SOS content, position selection, section navigation.
**Detailed plan:** [03-phase-frontend-viewer.md](./03-phase-frontend-viewer.md)

### Phase 4A: AI Button UI & Placement
> Create dropdown button component, add toolbar to SOS viewer. ~0.5 session.

- Create `SOSActionButtons` component (Questions, Practice ▾, Listen ▾ with dropdowns)
- Add persistent **toolbar row in the top navbar area** (outside scroll container)
  - Desktop/iPad: toolbar at top of main content column, always visible
  - Mobile: compact row below mobile header + progress bar
- Add `activeAction` state to `StepsOfService.tsx`, pass to `SOSScrollView`
- Verify buttons render, dropdowns work (UI only — no AI backend yet)

**Key decision:** Buttons go in the top toolbar, NOT in the content area. The SOS viewer is a continuous scroll reader — embedding buttons in the content wastes vertical reading space.

**Deliverable:** 3 toolbar buttons with functional dropdowns, positioned in header area.
**Detailed plan:** [04-phase-ai-integration.md](./04-phase-ai-integration.md)

### Phase 4B: AI Backend Wiring
> AI prompts, action config, edge function updates, panel wiring. ~1 session.

- Add `steps_of_service` domain to `ai-action-config.ts` with 9 actions
- Create migration: 10 AI prompt rows (1 domain + 5 action + 4 voice-action)
- Wire buttons to `ProductAIDrawer` (mobile) and `DockedProductAIPanel` (desktop)
- Update `realtime-session/index.ts` for SOS domain (context serializer, tool defs)
- Update `realtime-search` edge function for `search_steps_of_service` tool

**Deliverable:** All 9 AI actions functional — Questions, 4× Practice, 4× Listen.
**Detailed plan:** [04-phase-ai-integration.md](./04-phase-ai-integration.md)

### Phase 5: Embeddings & Search
> Generate vector embeddings, verify hybrid search. ~0.5 session. Runs parallel to Phase 4B.

- Deploy or update `embed-products` edge function to support SOS sections
- Generate embeddings for all 29 sections (EN)
- Verify hybrid search returns relevant results for SOS queries
- Integrate SOS results into global `/search` page (if applicable)

**Deliverable:** 29/29 embeddings generated, hybrid search verified.
**Detailed plan:** [05-phase-embeddings-search.md](./05-phase-embeddings-search.md)

### Phase 6: Testing & Polish
> End-to-end testing, responsiveness, edge cases. ~1 session.

- TypeScript check (`npx tsc --noEmit`)
- Manual test all 9 AI actions
- Test position selector → detail view → section navigation flow
- Test search relevance (FTS + vector)
- Mobile responsiveness
- Dark mode
- Verify no regressions in existing viewers

**Deliverable:** Fully functional, tested Steps of Service viewer.
**Detailed plan:** [06-phase-testing-polish.md](./06-phase-testing-polish.md)

---

## Dependency Graph

```
Phase 1 (DB Schema)
  │
  ▼
Phase 2 (Content Seed)
  │
  ▼
Phase 3 (Frontend Viewer)
  │
  ▼
Phase 4A (Button UI) ──────────┐
  │                             │
  ▼                             ▼
Phase 4B (AI Wiring)    Phase 5 (Embeddings)
  │                             │
  └──────────┬──────────────────┘
             ▼
Phase 6 (Testing & Polish)
```

Phase 4A is pure frontend — no backend dependency.
Phase 4B and Phase 5 can run in parallel after 4A.
Phase 6 requires both 4B and 5.

Phases 3 and 5 can run in parallel after Phase 2.
Phase 4 depends on both Phase 3 (UI) and Phase 5 (search for AI tools).

---

## Multi-Restaurant Considerations

| Concern | Approach |
|---------|----------|
| Content isolation | Every row scoped by `group_id`. Queries always filter by group. |
| Custom positions | `position` is TEXT with CHECK, easily extendable. Future: make positions table-driven. |
| Onboarding flow | AI agents process new restaurant's SOS docs → break into sections → format markdown → INSERT rows. Same table schema, different content. |
| Section structure variance | `section_key` + `parent_key` + `sort_order` allows any hierarchy. Some restaurants may have 15 sections, others 40. |
| Language support | `content_en` + `content_es` columns, same as all existing tables. `embedding_en` + `embedding_es` for bilingual search. |
| Search function | Filters by `group_id` (required) and `position` (optional). Works across positions or within one. |

---

## File Organization

```
docs/plans/steps-of-service/
├── 00-master-plan.md          ← this file
├── 01-phase-db-schema.md
├── 02-phase-content-seed.md
├── 03-phase-frontend-viewer.md
├── 04-phase-ai-integration.md
├── 05-phase-embeddings-search.md
└── 06-phase-testing-polish.md
```

---

## Estimated Effort

| Phase | Work |
|-------|------|
| Phase 1: DB Schema | ~1 session (1 migration, 1 search function) |
| Phase 2: Content Seed | ~1 session (29 sections, markdown formatting) |
| Phase 3: Frontend Viewer | ~1-2 sessions (route, page, hooks, 3 components) |
| Phase 4: AI Integration | ~1-2 sessions (dropdown component, 9 prompts, edge function updates) |
| Phase 5: Embeddings | ~0.5 session (deploy, generate, verify) |
| Phase 6: Testing | ~0.5 session (manual testing, polish) |
| **Total** | **~5-7 sessions** |
