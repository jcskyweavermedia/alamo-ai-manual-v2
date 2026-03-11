# Beer & Liquor — Admin Ingestion Mockup

> **Scope**: Admin-only view inside `/admin/ingest` when `activeType === 'beer_liquor'`.
> The main `/beer-liquor` viewer is **not affected** — it remains the standard card/list viewer.

---

## Desktop Layout (≥ 1024px)

```
┌──────────────────────────────────────────────┬──────────────────────────────┐
│  Beer & Liquor                               │  AI Chat Assistant           │
│  ─────────────────────────────────────────   │  ─────────────────────────── │
│                                              │                              │
│  🍺 BEER (6)                     [+ Add]    │  ┌──────────────────────────┐ │
│  ┌──────────────────────────────────────┐   │  │ 👤 Add Corona Extra,     │ │
│  │  Corona Extra       Lager      [🗑] │   │  │    Dos Equis, and        │ │
│  │  Stella Artois      Lager      [🗑] │   │  │    Blue Moon.            │ │
│  │  Blue Moon          Wheat Ale  [🗑] │   │  └──────────────────────────┘ │
│  │  Dos Equis Lager    Lager      [🗑] │   │                              │
│  │  Modelo Especial    Lager      [🗑] │   │  ┌──────────────────────────┐ │
│  │  Heineken           Lager      [🗑] │   │  │ 🤖 Got it! I've          │ │
│  └──────────────────────────────────────┘   │  │ structured 3 items:      │ │
│                                              │  │                          │ │
│  🥃 SPIRITS (4)                             │  │  ┌────────────────────┐  │ │
│  ┌──────────────────────────────────────┐   │  │  │ 🍺 Corona Extra    │  │ │
│  │  Grey Goose         Vodka      [🗑] │   │  │  │ Beer · Lager       │  │ │
│  │  Patrón Silver      Tequila    [🗑] │   │  │  │ Mexico             │  │ │
│  │  Maker's Mark       Bourbon    [🗑] │   │  │  └────────────────────┘  │ │
│  │  Hendrick's         Gin        [🗑] │   │  │  ┌────────────────────┐  │ │
│  └──────────────────────────────────────┘   │  │  │ 🍺 Dos Equis       │  │ │
│                                              │  │  │ Beer · Lager       │  │ │
│  ─────────────────────────────────────────   │  │  │ Mexico             │  │ │
│  ▶ Pending Drafts  (3)                      │  │  └────────────────────┘  │ │
│  ┌──────────────────────────────────────┐   │  │  ┌────────────────────┐  │ │
│  │  Corona Extra       Beer > Lager     │   │  │  │ 🍺 Blue Moon       │  │ │
│  │               [Edit ✏]  [Publish ✓] │   │  │  │ Beer · Wheat Ale   │  │ │
│  │  Dos Equis          Beer > Lager     │   │  │  │ USA                │  │ │
│  │               [Edit ✏]  [Publish ✓] │   │  │  └────────────────────┘  │ │
│  │  Blue Moon          Beer > Wheat Ale │   │  │                          │ │
│  │               [Edit ✏]  [Publish ✓] │   │  │  [Publish All 3]         │ │
│  └──────────────────────────────────────┘   │  └──────────────────────────┘ │
│                                              │                              │
│                                              │  ┌──────────────────────────┐ │
│                                              │  │ Type a message...  [🎤]  │ │
│                                              │  │                    [▶ →] │ │
│                                              │  └──────────────────────────┘ │
└──────────────────────────────────────────────┴──────────────────────────────┘
```

**Notes:**
- Left panel: always shows the full multi-item list (published + pending)
- Right panel: `ChatIngestionPanel` — **zero modifications**, exact same component used for recipes/cocktails/wines
- `DraftPreviewCard` in chat message shows one card per extracted item
- "Publish All N" button appears in the message when multiple drafts extracted
- Delete (🗑) on a published row shows an inline confirm: "Delete? [Yes] [No]"
- "Pending Drafts" section is collapsible; shows only when drafts exist in context

---

## Mobile Layout (< 1024px) — Two Tabs

```
┌─────────────────────────────────────┐
│  ← Ingest   Beer & Liquor           │
│  ─────────────────────────────────  │
│                                     │
│  [  List  ]  [     Chat     ]       │  ← 2 tabs only (no Preview/Edit)
│                                     │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│  (LIST TAB active)                  │
│                                     │
│  🍺 BEER (6)                        │
│  ┌─────────────────────────────┐    │
│  │ Corona Extra    Lager  [🗑] │    │
│  │ Stella Artois   Lager  [🗑] │    │
│  │ Blue Moon       Wheat  [🗑] │    │
│  │ Dos Equis       Lager  [🗑] │    │
│  │ Modelo          Lager  [🗑] │    │
│  │ Heineken        Lager  [🗑] │    │
│  └─────────────────────────────┘    │
│                                     │
│  🥃 SPIRITS (4)                     │
│  ┌─────────────────────────────┐    │
│  │ Grey Goose      Vodka  [🗑] │    │
│  │ Patrón Silver   Tequila[🗑] │    │
│  │ Maker's Mark    Bourbon[🗑] │    │
│  │ Hendrick's      Gin    [🗑] │    │
│  └─────────────────────────────┘    │
│                                     │
│  ▶ Pending Drafts (3)               │
│  ┌─────────────────────────────┐    │
│  │ Corona Extra    [Pub] [Edit]│    │
│  │ Dos Equis       [Pub] [Edit]│    │
│  │ Blue Moon       [Pub] [Edit]│    │
│  └─────────────────────────────┘    │
│                                     │
│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─── │
│  [  List  ]  [     Chat     ]       │  ← fixed bottom tabs
└─────────────────────────────────────┘
```

```
┌─────────────────────────────────────┐
│  ← Ingest   Beer & Liquor           │
│  ─────────────────────────────────  │
│                                     │
│  [  List  ]  [  ● Chat (1)  ]      │  ← badge when unread draft
│                                     │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│  (CHAT TAB active)                  │
│                                     │
│  ┌───────────────────────────────┐  │
│  │ 👤  Add Dos Equis lager...    │  │
│  └───────────────────────────────┘  │
│                                     │
│  ┌───────────────────────────────┐  │
│  │ 🤖  Got it! Here's the draft: │  │
│  │  ┌─────────────────────────┐  │  │
│  │  │ 🍺  Dos Equis           │  │  │
│  │  │ Beer · Lager  · Mexico  │  │  │
│  │  │ [Edit ✏]  [Publish ✓]  │  │  │
│  │  └─────────────────────────┘  │  │
│  └───────────────────────────────┘  │
│                                     │
│  ┌───────────────────────────────┐  │
│  │ Type a message...      [🎤]   │  │
│  │                        [▶ →] │  │
│  └───────────────────────────────┘  │
│                                     │
│ ─────────────────────────────────── │
│  [  List  ]  [     Chat     ]       │
└─────────────────────────────────────┘
```

---

## Edit Sheet (Both Desktop & Mobile)

Triggered when user clicks **[Edit ✏]** on a draft card in chat, or taps a pending draft row.

```
┌─────────────────────────────────────────────┐
│  Edit Item                              [×]  │
│  ─────────────────────────────────────────   │
│                                             │
│  ▼ Info                                     │
│  ┌─────────────────────────────────────┐    │
│  │ Name          [Corona Extra       ] │    │
│  │ Category      [Beer          ▼   ] │    │
│  │ Subcategory   [Lager              ] │    │
│  │ Producer      [Anheuser-Busch     ] │    │
│  │ Country       [Mexico             ] │    │
│  │ Style         [Pale Lager         ] │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  ▼ Details                                  │
│  ┌─────────────────────────────────────┐    │
│  │ Description   [textarea...        ] │    │
│  │ Notes         [textarea...        ] │    │
│  │ Featured      [○ toggle          ] │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  ▼ Image                                    │
│  ┌─────────────────────────────────────┐    │
│  │  [📷 Upload]   [✨ Generate AI]     │    │
│  │  (preview if image set)             │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  ─────────────────────────────────────────  │
│  [Cancel]                    [Publish ✓]    │
└─────────────────────────────────────────────┘
```

---

## Component Map

| Component | Location | Purpose |
|-----------|----------|---------|
| `BeerLiquorIngestList` | `src/components/ingest/` | Left panel — list + pending drafts |
| `BeerLiquorEditor` | `src/components/ingest/editor/` | Accordion editor inside Edit Sheet |
| `BeerLiquorPreviewCard` | `DraftPreviewCard.tsx` (sub) | Inline draft card in chat message |
| `ChatIngestionPanel` | existing — no changes | Right panel (same as recipes) |
| `MobileModeTabs` | modified — add `modes` prop | 2-tab (List/Chat) for beer/liquor |

---

## Data Flow

```
[User types in chat]
      ↓
ChatIngestionPanel → useIngestChat('beer_liquor_list')
      ↓
ingest edge function → returns BeerLiquorDraft[]
      ↓
draftPreview attached to assistant message
      ↓
DraftPreviewCard (BeerLiquorPreviewCard) renders inline in chat
      ↓
  ┌──────────────────────────────────────┐
  │  [Edit ✏]         [Publish ✓]       │
  └──────┬──────────────────┬───────────┘
         │                  │
         ▼                  ▼
  BeerLiquorEditor     publishItem() →
  Sheet opens          item added to
  (IngestDraftContext) published list
                       (left panel reloads)
```

---

## What This Is NOT

- ❌ Not a batch-table extractor (that was `BeerLiquorBatchIngest` — deprecated)
- ❌ Not visible in `/beer-liquor` main viewer (admin-only, `/admin/ingest` only)
- ❌ Does not replace the standard card/list viewer for end users
