# Phase 4: AI Integration

## Overview

Add AI-powered action buttons to the Steps of Service viewer. Unlike product viewers (flat button rows), SOS uses **grouped dropdown buttons**: 3 visible buttons (Questions, Practice, Listen) where Practice and Listen expand to show sub-actions. Also: create 9 AI prompts in the database, update the edge function for SOS context, and wire everything to the existing AI panel infrastructure.

**Key layout decision**: AI buttons live in the **top toolbar** (not in the content area) to preserve reading space on the continuous scroll view.

---

## Button Placement Strategy

### Problem

The SOS viewer is a continuous scroll reader. Placing AI buttons below the content or between sections wastes vertical space and interrupts the reading flow — unlike product viewers where each item has a natural "action area."

### Solution: Top Toolbar

Buttons go in a **persistent toolbar row** at the top of the main content column, between the header and the scroll area. This keeps them always accessible without eating into reading space.

```
DESKTOP / IPAD (lg+)
┌──────────────┬──────────────────────────────────────────┐
│  TOC Sidebar │  ┌ Toolbar ──────────────────────────┐   │
│              │  │ [Questions?] [Practice ▾] [Listen ▾]│  │
│  · Chapter 1 │  └───────────────────────────────────────┘│
│    1 Welcome │                                          │
│    2 Primary │  ┌ Scrollable Content ────────────────┐   │
│  · Chapter 2 │  │  ── FOUNDATIONS ──                 │   │
│    ...       │  │  [1] Welcome & Mission             │   │
│              │  │  [2] Primary Responsibilities      │   │
│              │  │  ...                               │   │
│              │  └────────────────────────────────────┘   │
└──────────────┴──────────────────────────────────────────┘

MOBILE (< lg)
┌────────────────────────────────────┐
│ ← Mesero  Steps of Service  3/29  │  ← existing mobile header
│ ▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░  │  ← progress bar
├────────────────────────────────────┤
│ [Questions?] [Practice ▾] [Listen]│  ← toolbar row (compact)
├────────────────────────────────────┤
│                                    │
│ ── FOUNDATIONS ──                   │
│ [1] Welcome & Mission              │
│ ...                                │
└────────────────────────────────────┘
```

### Responsive Behavior

| Viewport | Placement | Size | Notes |
|----------|-----------|------|-------|
| Desktop (lg+) | Sticky row at top of main content, below sidebar back button level | `h-8 text-xs` | Full labels: "Questions?", "Practice ▾", "Listen ▾" |
| iPad / Tablet (md-lg) | Same sticky row, full width | `h-8 text-xs` | Same as desktop |
| Mobile (< md) | Compact row below mobile header + progress bar | `h-7 text-[11px]` | Shorter labels or icon+label. Stays visible while scrolling. |

### Implementation in SOSScrollView

The toolbar row gets inserted as a new `<div>` between the header and the `<main>` scroll area:

```tsx
{/* AI Toolbar — always visible */}
<div className="shrink-0 border-b border-border px-4 py-2 flex items-center gap-2">
  <SOSActionButtons
    activeAction={activeAction}
    onActionChange={onActionChange}
    language={language}
  />
</div>

{/* Scrollable content area */}
<main ref={scrollRef} className="flex-1 overflow-y-auto ...">
```

This keeps it **outside the scroll container** so it's always visible.

---

## New UI Pattern: Grouped Dropdown Buttons

This is a **new component** — existing product viewers use flat button rows, not dropdowns.

### Visual Design

```
┌────────────────────────────────────────────────────┐
│  [Questions?]  [Practice ▾]  [Listen ▾]           │
│                 ┌──────────────────┐               │
│                 │ 1st Approach     │               │
│                 │ 2nd Approach     │               │
│                 │ Dessert          │               │
│                 │ The Check        │               │
│                 └──────────────────┘               │
└────────────────────────────────────────────────────┘
```

### Behavior

- **Questions?**: Single button (no dropdown). Click → opens AI panel in conversation mode.
- **Practice ▾**: Click → toggles dropdown showing 4 sub-actions. Clicking a sub-action → opens AI panel.
- **Listen ▾**: Same as Practice but with voice-tts mode actions.
- Only one dropdown open at a time (clicking Practice closes Listen and vice versa).
- Clicking outside or pressing Escape closes any open dropdown.

---

## Execution Order

Phase 4 is split into two sub-phases for clarity:

### Phase 4A: Button UI & Placement (~0.5 session)

1. Create `SOSActionButtons` component (dropdown buttons)
2. Add toolbar row to `SOSScrollView` (both desktop and mobile)
3. Add `activeAction` state to `StepsOfService.tsx`
4. Verify buttons render and dropdowns work (UI only — no AI backend yet)

### Phase 4B: AI Backend Wiring (~1 session)

5. Add `steps_of_service` domain to `ai-action-config.ts` with 9 actions
6. Create migration: 10 AI prompt rows (1 domain + 5 action + 4 voice-action)
7. Wire buttons to `ProductAIDrawer` (mobile) and `DockedProductAIPanel` (desktop)
8. Update `realtime-session/index.ts` for SOS domain (context serializer, tool defs)
9. Update `realtime-search` edge function for `search_steps_of_service` tool

### Phase 5: Embeddings & Search (~0.5 session) — runs after 4A, parallel to 4B

10. Generate embeddings for all 29 sections
11. Verify hybrid search returns relevant results

### Updated Dependency Graph

```
Phase 4A (Button UI) ─────────► Phase 4B (AI Wiring) ─► Phase 6 (Test)
                      ╲                               ╱
                       ► Phase 5 (Embeddings) ────────
```

Phase 4A is pure frontend — no backend dependency.
Phase 4B and Phase 5 can run in parallel.
Phase 6 requires both 4B and 5.

---

## Files to Create

| File | Type | Purpose |
|------|------|---------|
| `src/components/steps-of-service/SOSActionButtons.tsx` | Component | Grouped dropdown action buttons |

## Files to Modify

| File | Change | Phase |
|------|--------|-------|
| `src/components/steps-of-service/SOSScrollView.tsx` | Add toolbar row with `SOSActionButtons` above scroll area | 4A |
| `src/pages/StepsOfService.tsx` | Add `activeAction` state, pass to SOSScrollView | 4A |
| `src/data/ai-action-config.ts` | Add `steps_of_service` domain with 9 actions + grouped config | 4B |
| `src/pages/StepsOfService.tsx` | Wire `ProductAIDrawer` + `DockedProductAIPanel` | 4B |
| `supabase/functions/realtime-session/index.ts` | Add SOS domain support (context serializer, tool defs, search tool) | 4B |
| `supabase/functions/realtime-search/index.ts` | Handle `search_steps_of_service` tool calls | 4B |

## Migration to Create

| File | Purpose | Phase |
|------|---------|-------|
| `TIMESTAMP_seed_sos_ai_prompts.sql` | 9 AI prompt rows + domain prompt | 4B |

---

## 1. AI Action Config

### New Types

```typescript
// Add to AIActionConfig
export interface AIActionGroup {
  key: string;
  label: string;
  labelEs: string;
  icon: string;
  children: AIActionConfig[];
}

export type AIActionItem = AIActionConfig | AIActionGroup;
```

### SOS Actions

```typescript
export const SOS_AI_ACTIONS: AIActionItem[] = [
  // Standalone button
  {
    key: 'questions',
    label: 'Questions?',
    labelEs: 'Preguntas?',
    icon: 'help-circle',
    mode: 'conversation',
    autoTrigger: true,
  },
  // Dropdown group: Practice
  {
    key: 'practice',
    label: 'Practice',
    labelEs: 'Practicar',
    icon: 'mic',
    children: [
      { key: 'practice1stApproach', label: '1st Approach', labelEs: '1er Acercamiento', icon: 'mic', mode: 'conversation', autoTrigger: true },
      { key: 'practice2ndApproach', label: '2nd Approach', labelEs: '2do Acercamiento', icon: 'mic', mode: 'conversation', autoTrigger: true },
      { key: 'practiceDessert', label: 'Dessert', labelEs: 'Postre', icon: 'mic', mode: 'conversation', autoTrigger: true },
      { key: 'practiceCheck', label: 'The Check', labelEs: 'La Cuenta', icon: 'mic', mode: 'conversation', autoTrigger: true },
    ],
  },
  // Dropdown group: Listen
  {
    key: 'listen',
    label: 'Listen',
    labelEs: 'Escuchar',
    icon: 'play',
    children: [
      { key: 'listen1stApproach', label: '1st Approach', labelEs: '1er Acercamiento', icon: 'play', mode: 'voice-tts', autoTrigger: true },
      { key: 'listen2ndApproach', label: '2nd Approach', labelEs: '2do Acercamiento', icon: 'play', mode: 'voice-tts', autoTrigger: true },
      { key: 'listenDessert', label: 'Dessert', labelEs: 'Postre', icon: 'play', mode: 'voice-tts', autoTrigger: true },
      { key: 'listenCheck', label: 'The Check', labelEs: 'La Cuenta', icon: 'play', mode: 'voice-tts', autoTrigger: true },
    ],
  },
];
```

### Helper Update

```typescript
// Update getActionConfig to also search SOS_AI_ACTIONS
export function getActionConfig(domain: string, key: string): AIActionConfig | undefined {
  if (domain === 'steps_of_service') {
    for (const item of SOS_AI_ACTIONS) {
      if ('children' in item) {
        const found = item.children.find(c => c.key === key);
        if (found) return found;
      } else if (item.key === key) {
        return item;
      }
    }
    return undefined;
  }
  return PRODUCT_AI_ACTIONS[domain]?.find(a => a.key === key);
}
```

---

## 2. SOSActionButtons Component

### Props

```typescript
interface SOSActionButtonsProps {
  activeAction: string | null;
  onActionChange: (action: string | null) => void;
  language: 'en' | 'es';
}
```

### Implementation Notes

- Uses `useState` for `openDropdown: 'practice' | 'listen' | null`
- Renders 3 top-level buttons in a flex row
- Practice and Listen buttons toggle their respective dropdown
- Dropdown is a `div` positioned absolutely below the button
- Click outside: `useEffect` with `mousedown` listener on `document`
- Selecting a sub-action: calls `onActionChange(key)` and closes dropdown
- Active state: if `activeAction` matches a child key, the parent button shows as active

### Styling

- Same button sizing as product AI buttons: `h-8 px-2 text-[11px]`
- Dropdown: `absolute top-full mt-1 z-10 bg-popover border rounded-lg shadow-lg p-1`
- Sub-action items: `w-full text-left px-3 py-2 text-sm hover:bg-muted rounded-md`
- Chevron icon (ChevronDown) on dropdown buttons

---

## 3. AI Prompts — Database Seed

### Migration: `TIMESTAMP_seed_sos_ai_prompts.sql`

#### Domain Prompt (1)

```sql
INSERT INTO public.ai_prompts (id, slug, category, domain, prompt_en, prompt_es, sort_order, is_active)
VALUES (
  extensions.gen_random_uuid(),
  'domain-steps_of_service', 'domain', 'steps_of_service',
  'The user is studying the Steps of Service for their position at Alamo Prime. Focus on service procedures, guest interaction techniques, timing, and professional standards. Use the search_steps_of_service tool to find specific SOS content. Cross-reference dishes, wines, and cocktails when relevant to service scenarios.',
  'El usuario está estudiando los Pasos de Servicio para su puesto en Alamo Prime. Enfócate en procedimientos de servicio, técnicas de interacción con el comensal, tiempos y estándares profesionales. Usa la herramienta search_steps_of_service para encontrar contenido específico de SOS. Haz referencias cruzadas con platillos, vinos y cocteles cuando sea relevante para escenarios de servicio.',
  10, true
)
ON CONFLICT (slug) DO NOTHING;
```

#### Action Prompts (5 — conversation mode)

| Slug | Action | Prompt Focus |
|------|--------|-------------|
| `action-steps_of_service-questions` | Questions? | Open Q&A about SOS for this position |
| `action-steps_of_service-practice1stApproach` | 1st Approach | AI plays guest being seated; user practices greeting |
| `action-steps_of_service-practice2ndApproach` | 2nd Approach | AI plays guest after drinks; user practices entrée presentation |
| `action-steps_of_service-practiceDessert` | Dessert | AI plays guest finishing entrées; user practices dessert upsell |
| `action-steps_of_service-practiceCheck` | The Check | AI plays guest ready to leave; user practices check & farewell |

#### Voice Action Prompts (4 — voice-tts mode)

| Slug | Action | Prompt Focus |
|------|--------|-------------|
| `voice-action-steps_of_service-listen1stApproach` | Listen 1st Approach | AI speaks a polished sample 1st approach greeting |
| `voice-action-steps_of_service-listen2ndApproach` | Listen 2nd Approach | AI speaks a sample entrée presentation |
| `voice-action-steps_of_service-listenDessert` | Listen Dessert | AI speaks a sample dessert recommendation |
| `voice-action-steps_of_service-listenCheck` | Listen Check | AI speaks a sample check presentation |

#### Prompt Style for Practice Actions

Practice prompts instruct the AI to roleplay as a guest:

```
You are playing the role of a guest at Alamo Prime steakhouse. The server is practicing their 1st approach greeting.

SCENARIO: You have just been seated at a table. This is your first time at the restaurant. You are celebrating your wife's birthday.

BEHAVIOR:
- Respond naturally as a real guest would
- Start by acknowledging the server's greeting
- Answer their questions about first-time visit, occasion, etc.
- When they offer beverages, show interest in bourbon
- Give realistic responses — sometimes brief, sometimes chatty
- If the server misses a step, gently prompt by asking (e.g., "Do you have a water menu?")
- After 4-5 exchanges, wrap up with something like "I think we're ready to look at the menu"

Keep responses to 1-2 sentences. Be warm and friendly. Never break character.
```

#### Prompt Style for Listen Actions

Listen prompts instruct the AI to speak a sample script:

```
You are a senior server at Alamo Prime demonstrating a perfect 1st approach greeting. Speak as if you are at the table with a guest named Mr. Johnson who is here for his first time, celebrating his wife's birthday.

Cover all required steps:
1. Name & introduction
2. First-time guest acknowledgment (explain prime steakhouse, coursed dining, bourbon program)
3. Beverage suggestion (2 specific cocktail recommendations)
4. Water preference
5. Appetizer mention with 2 specific suggestions

Speak naturally and confidently — 30-45 seconds total. No follow-up questions.
```

---

## 4. Edge Function Updates

### `realtime-session/index.ts`

#### 4a. Add SOS tool definition

```typescript
const PRODUCT_SEARCH_TOOL_DEFS: Record<string, { name: string; description: string }> = {
  // ...existing...
  steps_of_service: {
    name: 'search_steps_of_service',
    description: 'Search the Steps of Service manual for service procedures, guest interaction techniques, and professional standards.'
  },
};
```

#### 4b. Add SOS context serializer

```typescript
case 'steps_of_service':
  parts.push(`Position: ${item.position}`);
  if (item.section_key) parts.push(`Section: ${item.section_key}`);
  if (item.title_en) parts.push(`Topic: ${item.title_en}`);
  if (item.content_en) parts.push(`Content: ${(item.content_en as string).substring(0, 500)}`);
  break;
```

#### 4c. SOS listen-only actions need tools

SOS listen actions reference the SOS content, but the prompts are self-contained scripts — they don't need `search_steps_of_service` at runtime. Listen prompts tell the AI exactly what to say.

Practice actions (conversation mode) may benefit from `search_steps_of_service` but conversation mode already provides tools by default.

**Decision**: No special LISTEN_ACTIONS handling needed for SOS. The pairing pattern (PAIRING_ACTIONS) is specific to food pairings needing `search_dishes`.

#### 4d. Add to `realtime-search` edge function

The `realtime-search` function needs to handle `search_steps_of_service` tool calls from WebRTC sessions:

```typescript
case 'search_steps_of_service':
  // Call the search_steps_of_service RPC
  const { data, error } = await supabase.rpc('search_steps_of_service', {
    search_query: args.query,
    query_embedding: await getEmbedding(args.query),
    p_group_id: groupId,
    p_position: args.position || null,
    search_language: language,
  });
  break;
```

---

## 5. Wire to StepsOfService Page

### Page Updates

```typescript
// Add state
const [activeAction, setActiveAction] = useState<string | null>(null);

// Clear action when going back to position selector
const handleClearPosition = useCallback(() => {
  setActiveAction(null);
  viewer.clearPosition();
}, [viewer.clearPosition]);
```

### SOSScrollView Updates

Pass `activeAction` and `onActionChange` as props. The toolbar row is rendered **above** the scroll container:

```tsx
{/* AI Toolbar — persistent, outside scroll */}
<div className="shrink-0 border-b border-border px-4 md:px-6 lg:px-8 py-2">
  <div className="max-w-reading mx-auto">
    <SOSActionButtons
      activeAction={activeAction}
      onActionChange={onActionChange}
      language={language}
    />
  </div>
</div>

{/* Scrollable content area */}
<main ref={scrollRef} className="flex-1 overflow-y-auto ...">
```

### AI Panel Wiring

```tsx
const aiPanel = activeAction ? (
  <DockedProductAIPanel
    isOpen={activeAction !== null}
    onClose={() => setActiveAction(null)}
    actionConfig={getActionConfig('steps_of_service', activeAction) ?? null}
    domain="steps_of_service"
    itemName={`SOS — ${selectedPosition}`}
    itemContext={{
      position: selectedPosition,
      // No single section — AI gets context from search tool
    }}
  />
) : undefined;
```

Note: Unlike product viewers where `itemContext` has a specific item, SOS AI uses the `search_steps_of_service` tool to find relevant content dynamically. The context just passes the position.

---

## 6. Item Context for SOS

For product viewers, `itemContext` contains the product data (wine name, tasting notes, etc.). For SOS, the context is **position-level** since the user is reading a continuous scroll:

```typescript
{
  position: 'server',
  // AI uses search_steps_of_service tool to find specific content
}
```

The AI prompts instruct it to search for relevant SOS content when answering questions.

---

## Verification Checklist

After implementation:

- [ ] Questions button: Click → AI panel opens in conversation mode, AI asks how it can help
- [ ] Practice dropdown: Click → shows 4 sub-actions
- [ ] Practice 1st Approach: Click → AI plays a guest, user practices greeting
- [ ] Practice 2nd Approach: Click → AI plays guest after drinks, user practices entrée presentation
- [ ] Practice Dessert: Click → AI plays guest post-entrée, user practices dessert upsell
- [ ] Practice Check: Click → AI plays guest ready to leave, user practices farewell
- [ ] Listen dropdown: Click → shows 4 sub-actions
- [ ] Listen 1st Approach: Click → AI speaks a sample 1st approach greeting
- [ ] Listen 2nd Approach: Click → AI speaks a sample entrée presentation
- [ ] Listen Dessert: Click → AI speaks a sample dessert recommendation
- [ ] Listen Check: Click → AI speaks a sample check/farewell
- [ ] **Toolbar stays visible while scrolling** (not in scroll container)
- [ ] **Desktop**: buttons in toolbar row at top of content column
- [ ] **Mobile**: compact buttons below mobile header + progress bar
- [ ] Dropdown closes when clicking outside
- [ ] Only one dropdown open at a time
- [ ] AI prompts in DB: 10 rows (1 domain + 5 action + 4 voice-action)
- [ ] Mobile: `ProductAIDrawer` opens for all actions
- [ ] Desktop: `DockedProductAIPanel` opens
- [ ] TypeScript: `npx tsc --noEmit` passes (0 errors)

---

## Dependencies

- **Requires**: Phase 3 (viewer UI to attach buttons to) ✅ Complete
- **Requires**: Phase 1 (ai_prompts CHECK constraint updated) ✅ Complete
- **Requires**: `realtime-session` edge function (already deployed) ✅ Complete
- **Phase 4A** → pure frontend, no backend dependency
- **Phase 4B** → needs Phase 5 (embeddings) for search to return results
- **Blocks**: Phase 6 (testing)
