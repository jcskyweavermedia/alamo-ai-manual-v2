# Step 6: Contextual AI Sheet on Manual Pages

> **Goal**: Add an inline AI assistant sheet that opens when users click "Ask AI" on a manual section, allowing them to ask questions without leaving the reading context.

---

## Design Audit Summary

### Key Design Spec Requirements (from design-specs.md)

1. **"System-native familiarity"** — Sheets feel iOS-like (lines 19-21)
2. **"AI assistant appears as right-side panel OR floating card"** on tablet (line 221-222)
3. **"AI docked on the right"** on desktop (line 233)
4. **"Contextual 'Ask about this' inside manual reading pages"** (line 283)
5. **"Answer cards, not noisy bubbles"** with source chips (lines 449-452)
6. **"Expand action is always visible when applicable"** (line 453)
7. **"Skeleton loaders for AI answer card"** during loading (line 489)
8. **Sheet motion: 260-320ms** slide animation (line 188)
9. **Progressive disclosure**: concise by default, expand on demand (lines 343-359)

### Existing Pattern Analysis

| Pattern | Where Used | What to Reuse |
|---------|------------|---------------|
| `Drawer` (bottom sheet) | `MobileOutlineSheet` | Same component, max-height 85vh, drag handle |
| `Sheet` (side panel) | `sheet.tsx` | Right side variant, 400px width |
| `aiPanel` prop | `AppShell` | Pattern for persistent AI panel (w-80 xl:w-96) |
| Header pattern | `MobileOutlineSheet` | Icon + title + close button layout |
| `AIAnswerCard` | `Ask.tsx` | Full reuse including expand, copy, feedback |
| `UsageMeter` | `Ask.tsx` | Reuse in sheet header |

### Gap Analysis — What the Current Plan Was Missing

| Issue | Resolution |
|-------|------------|
| ❌ Plan uses generic Sheet/Drawer decision | ✅ Use `Drawer` for ALL viewports (matches iOS pattern from design-specs) |
| ❌ Desktop uses right Sheet | ✅ Keep right Sheet for desktop to match "AI docked on right" spec |
| ❌ No skeleton loader specified | ✅ Add skeleton state matching AIAnswerCard's existing loader |
| ❌ Missing empty state | ✅ Add welcoming empty state with sparkles + sample questions |
| ❌ No stage-based loading text | ✅ Add "Searching manual..." → "Writing answer..." per spec |
| ❌ No "New question" reset | ✅ Add clear/reset action after answer |
| ❌ Missing focus trap | ✅ Built into Radix Sheet/Drawer primitives |
| ❌ Header didn't match existing pattern | ✅ Follow MobileOutlineSheet header layout exactly |

---

## Revised Viewport Strategy

Per design-specs.md line 469-470: "Sheets: slide up (mobile) / centered modal (desktop)"

However, line 233 says "AI docked on the right" for desktop. The contextual sheet should:

| Viewport | Component | Behavior | Rationale |
|----------|-----------|----------|-----------|
| **Mobile** (< 768px) | `Drawer` | Bottom sheet, 85vh max, drag handle | Matches `MobileOutlineSheet` |
| **Tablet** (768-1023px) | `Drawer` | Bottom sheet, 70vh max | Keep consistency, thumb-friendly |
| **Desktop** (≥ 1024px) | `Sheet` | Right side, 400px width | Matches "AI docked on right" |

This differs from original plan which used 640px breakpoint. Using 768px (`md:`) aligns with existing Tailwind breakpoints.

---

## Success Criteria

### Functional
- [ ] "Ask AI" button is enabled on all manual sections
- [ ] Clicking button opens contextual sheet (no page navigation)
- [ ] Sheet header shows: sparkles icon + "Ask about: {section title}"
- [ ] Usage meter visible in header
- [ ] Input + send button for questions
- [ ] Stage-based loading: "Searching manual..." → "Writing answer..."
- [ ] Answer displays in `AIAnswerCard` component (full reuse)
- [ ] Citations link back to manual sections (close sheet + navigate)
- [ ] "Get detailed answer" expand works
- [ ] Copy, thumbs up/down feedback works
- [ ] "New question" clears answer and resets input

### Design Integration
- [ ] Uses same `Drawer` styling as `MobileOutlineSheet`
- [ ] Header matches existing pattern (icon + title + X button)
- [ ] Motion timing: 260-320ms per design-specs
- [ ] Empty state has sparkles icon + sample questions
- [ ] Skeleton loader matches `AIAnswerCard` existing pattern
- [ ] Dark mode fully supported
- [ ] Touch targets 44px minimum

### Accessibility
- [ ] Focus trapped when open (Radix built-in)
- [ ] Escape closes sheet
- [ ] Enter submits question
- [ ] Screen reader announces content
- [ ] Aria labels on all buttons

---

## Component Architecture

```
src/components/manual/
├── AskAboutButton.tsx        # UPDATE: Enable + onClick handler
├── AskAboutSheet.tsx         # NEW: Responsive wrapper (Drawer/Sheet)
├── AskAboutContent.tsx       # NEW: Shared content
└── index.ts                  # UPDATE: Export new components
```

### AskAboutSheet.tsx — Responsive Container

```tsx
interface AskAboutSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectionId: string;
  sectionTitle: string;
  language: 'en' | 'es';
  onNavigateToSection: (slug: string) => void;
}
```

**Responsive Logic:**
```tsx
const isDesktop = useMediaQuery('(min-width: 1024px)');

if (isDesktop) {
  return <Sheet side="right">...</Sheet>;
} else {
  return <Drawer>...</Drawer>;
}
```

### AskAboutContent.tsx — Shared UI

**Layout Structure:**
```
┌─────────────────────────────────────────────┐
│ HEADER                                      │
│ ✨ Ask about: Temperature Monitoring    [X] │
│ ░░░░░░░░░░░░░░░░░░░░░  15/20 remaining      │
├─────────────────────────────────────────────┤
│ INPUT AREA                                  │
│ ┌─────────────────────────────────────────┐ │
│ │ [Your question here...              ] 📤│ │
│ └─────────────────────────────────────────┘ │
├─────────────────────────────────────────────┤
│ CONTENT AREA (scrollable)                   │
│                                             │
│ [Empty State / Loading / Answer]            │
│                                             │
└─────────────────────────────────────────────┘
```

**State Machine:**
```
EMPTY → (submit) → LOADING → (response) → ANSWER
                      ↓                      ↓
                   (error)               (clear)
                      ↓                      ↓
                   EMPTY ←←←←←←←←←←←←←←←← EMPTY
```

---

## Detailed Component Specifications

### Empty State
```tsx
<div className="flex flex-col items-center justify-center py-xl text-center">
  <Sparkles className="h-12 w-12 text-primary/30 mb-md" />
  <p className="text-body text-muted-foreground mb-lg">
    {language === 'es' 
      ? '¿Qué quieres saber sobre esta sección?' 
      : 'What would you like to know about this section?'}
  </p>
  <div className="flex flex-wrap gap-sm justify-center">
    {sampleQuestions.map(q => (
      <Button variant="outline" size="sm" onClick={() => setQuestion(q)}>
        {q}
      </Button>
    ))}
  </div>
</div>
```

### Loading State (Stage-Based)
```tsx
const stages = [
  { key: 'searching', en: 'Searching manual...', es: 'Buscando en el manual...' },
  { key: 'writing', en: 'Writing answer...', es: 'Escribiendo respuesta...' },
];

// Show "Searching manual..." immediately
// After 1.5s, switch to "Writing answer..."
```

### Answer State
Full reuse of `AIAnswerCard` with:
- `question` prop
- `answer` prop
- `sources` mapped from citations
- `onSourceClick` → close sheet + navigate
- `onExpand` → call `ask()` with `expand: true`
- `onFeedback` → log feedback

### Header Pattern (Match MobileOutlineSheet)
```tsx
<DrawerHeader className="flex flex-row items-center justify-between border-b pb-4">
  <div className="flex items-center gap-sm">
    <Sparkles className="h-5 w-5 text-primary" />
    <DrawerTitle className="text-section-title">
      {language === 'es' ? 'Preguntar sobre:' : 'Ask about:'} {sectionTitle}
    </DrawerTitle>
  </div>
  <DrawerClose asChild>
    <Button variant="ghost" size="icon" className="h-8 w-8">
      <X className="h-4 w-4" />
      <span className="sr-only">Close</span>
    </Button>
  </DrawerClose>
</DrawerHeader>
```

---

## Sample Questions Logic

Generate 2-3 contextual sample questions based on section content category:

```typescript
const sampleQuestionsMap: Record<string, { en: string[]; es: string[] }> = {
  'food-safety': {
    en: ['What are the safe temperatures?', 'How often should I check?'],
    es: ['¿Cuáles son las temperaturas seguras?', '¿Con qué frecuencia debo verificar?'],
  },
  'cleaning': {
    en: ['What products should I use?', 'How long does it take?'],
    es: ['¿Qué productos debo usar?', '¿Cuánto tiempo toma?'],
  },
  // ... fallback generic questions
  'default': {
    en: ['How do I do this?', 'What are the steps?'],
    es: ['¿Cómo hago esto?', '¿Cuáles son los pasos?'],
  },
};
```

---

## Integration Points

### Manual.tsx Changes

```tsx
// Add state
const [askSheetOpen, setAskSheetOpen] = useState(false);

// Add handler
const handleOpenAskSheet = useCallback(() => {
  setAskSheetOpen(true);
}, []);

// Navigation handler for citations
const handleAskNavigate = useCallback((slug: string) => {
  setAskSheetOpen(false);
  navigate(`/manual/${slug}`);
}, [navigate]);

// Render sheet
<AskAboutSheet
  open={askSheetOpen}
  onOpenChange={setAskSheetOpen}
  sectionId={currentSection?.slug ?? ''}
  sectionTitle={currentSection ? getTitle(currentSection, language) : ''}
  language={language}
  onNavigateToSection={handleAskNavigate}
/>
```

### ManualHeader.tsx Changes

```tsx
// Add prop
onAskAboutClick?: () => void;

// Wire to button
<AskAboutButton
  sectionId={sectionId}
  sectionTitle={title}
  language={language}
  disabled={false}  // Enable the button
  onClick={onAskAboutClick}
/>
```

### AskAboutButton.tsx Changes

```tsx
// Change default disabled from true to false
disabled = false,

// Remove "Coming soon" tooltip, add usage limit tooltip if needed
```

---

## File Changes Summary

| File | Action | Key Changes |
|------|--------|-------------|
| `src/components/manual/AskAboutContent.tsx` | CREATE | Empty state, input, loading, answer display |
| `src/components/manual/AskAboutSheet.tsx` | CREATE | Responsive Drawer/Sheet wrapper |
| `src/components/manual/AskAboutButton.tsx` | UPDATE | Enable button, remove tooltip |
| `src/components/manual/ManualHeader.tsx` | UPDATE | Add `onAskAboutClick` prop |
| `src/components/manual/index.ts` | UPDATE | Export new components |
| `src/pages/Manual.tsx` | UPDATE | Add sheet state, handlers, render sheet |

---

## Motion & Animation Spec

Per design-specs.md:
- Sheet duration: **260-320ms**
- Ease: `ease-in-out` (default in Radix)
- Overlay: fade in/out with sheet

The existing Sheet/Drawer components already have these animations built-in:
```css
data-[state=open]:animate-in data-[state=closed]:animate-out
data-[state=closed]:duration-300 data-[state=open]:duration-500
```

Consider adjusting to 300ms for consistency.

---

## Testing Checklist

### Functional Tests
- [ ] Button click opens sheet
- [ ] Question submission triggers API call
- [ ] Stage-based loading displays correctly
- [ ] Answer appears with citations
- [ ] Citation click closes sheet and navigates
- [ ] Expand answer works
- [ ] Copy works
- [ ] Feedback works
- [ ] Usage meter updates after query
- [ ] Limit enforcement shows message
- [ ] Off-topic detection shows message
- [ ] "New question" / clear works

### Viewport Tests
- [ ] Mobile (375px): Bottom drawer, full width, 85vh
- [ ] Tablet (768px): Bottom drawer, full width, 70vh
- [ ] Desktop (1024px): Right sheet, 400px width
- [ ] Drawer has drag handle
- [ ] Sheet has X button

### Design Integration Tests
- [ ] Header matches `MobileOutlineSheet` style exactly
- [ ] Empty state sparkles icon at 30% opacity
- [ ] Sample question buttons use `variant="outline" size="sm"`
- [ ] Answer card matches `/ask` page exactly
- [ ] Dark mode colors correct
- [ ] Spacing uses design tokens (gap-sm, gap-md, p-lg, etc.)

### Accessibility Tests
- [ ] Focus moves to sheet content on open
- [ ] Escape key closes sheet
- [ ] Enter key submits question
- [ ] Tab navigation works within sheet
- [ ] Screen reader announces "Ask about: [title]"
- [ ] Close button has sr-only label

---

## Implementation Order

### Phase 1: Core Components (1-2 prompts)
1. Create `AskAboutContent.tsx` with full state machine
2. Create `AskAboutSheet.tsx` with responsive logic
3. Export from `index.ts`

### Phase 2: Integration (1 prompt)
1. Update `AskAboutButton.tsx` to enable
2. Update `ManualHeader.tsx` with click handler
3. Update `Manual.tsx` with sheet state and rendering

### Phase 3: Polish (1 prompt)
1. Add sample questions logic
2. Verify dark mode
3. Test all viewports
4. Fix any edge cases

**Total: 3-4 prompts**

---

## Future Enhancements (Out of Scope)

- Conversation history persistence
- Voice input in sheet
- Suggested follow-up questions
- Share answer link
- Pin/save answers
