# Plan: Unified Beer & Liquor Management Page (Audited)

## Context

Beer/liquor management is split across two disconnected interfaces. The user wants ONE page at `/beer-liquor` as the single source of truth with an AI chatbot for adding items and inline edit/delete for management.

## Architecture (Revised After 4-Expert Audit)

| State | Main Content | Right Panel |
|-------|-------------|-------------|
| **List view, admin, chatbot open** | Published list + collapsible pending drafts | Ingest chatbot (toggle) |
| **List view, admin, chatbot closed** | Published list + collapsible pending drafts | Hidden |
| **List view, non-admin** | Published list | Hidden |
| **Item selected + AI action** | BeerLiquorCardView | Product AI assistant |

**Key audit-driven changes from original plan:**
- Chatbot panel is TOGGLE, not always-visible (UX audit)
- Pending drafts in separate collapsible section, not mixed (UX audit)
- Shared `IngestChatContent` inner component for desktop+mobile (Arch audit)
- Manager hook is sole owner of `useBatchIngest` (Arch audit)
- New props on CardView are optional (DevEx audit - training system compat)
- New migration for `updated_at` trigger + version auto-increment (DB audit)
- Soft-delete instead of hard delete (DevEx audit - training system refs)
- Slug regeneration + embedding refresh on update (DB audit)

## Execution Order

### Phase 0: Migration
- `updated_at` trigger on `beer_liquor_list`
- `version` auto-increment trigger on UPDATE

### Phase 1: Manager Hook (`use-beer-liquor-manager.ts`)
- Wraps `useBeerLiquorViewer` + `useBatchIngest`
- Sole owner of extraction/publish state
- CRUD: updateItem (with slug regen + embed refresh), softDeleteItem
- Draft management: addDrafts, removeDraft, publishDraft, publishAllDrafts
- Chat messages state (survives panel swap)
- Session persistence for drafts

### Phase 2: Shared Inner Component (`IngestChatContent.tsx`)
- Controlled component: receives messages + callbacks
- Text input + file upload + image upload
- No business logic

### Phase 3: Desktop Panel (`DockedIngestChatPanel.tsx`)
- Thin shell wrapping `IngestChatContent`

### Phase 4: Mobile Drawer (`IngestChatDrawer.tsx`)
- Thin shell wrapping `IngestChatContent`

### Phase 5: Edit Sheet (`BeerLiquorEditSheet.tsx`)
- Typed `BeerLiquorEditPayload` (not Record<string, unknown>)
- All beer/liquor fields

### Phase 6: Update `BeerLiquorList.tsx`
- Separate collapsible "Pending Items" section (admin only)

### Phase 7: Update `BeerLiquorCardView.tsx`
- Optional `onEdit`, `onDelete` props (backwards compat with training system)

### Phase 8: Update `BeerLiquor.tsx`
- Toggle button for chatbot (not always-visible)
- Wire manager hook + both panel types + edit sheet + delete dialog

### Phase 9: Cleanup
- IngestPage redirects beer_liquor to `/beer-liquor`
- BeerLiquorBatchIngest kept but not rendered (deprecated)

## Files: 4 new, 4 modified, 1 migration
