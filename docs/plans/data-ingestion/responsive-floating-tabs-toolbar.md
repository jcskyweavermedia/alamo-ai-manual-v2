# Responsive Fixes: Floating Tabs Jump & Toolbar Crowding

**Date**: 2026-02-24
**Status**: Plan
**Scope**: All ingest routes (prep recipes, plate specs, wines, cocktails) — single `IngestPage.tsx`

---

## Context

Two responsive issues affect the shared `IngestPage.tsx` component:

1. **Floating tabs 73px jump** — The Chat/Preview/Edit sticky tabs use `bottom-[76px] md:bottom-3`. At the `md` breakpoint (768px), the MobileTabBar disappears and the tabs jump 73px downward. ContentArea padding also shifts (`pb-24` → `pb-6`) compounding the effect.

2. **Toolbar overflow** — The header toolbar renders up to 5 buttons (Delete/Discard, Regenerate FOH, Save Draft, Publish) in a flat `flex gap-2` row with no responsive text hiding. Combined with Mic + Language toggle on the right, narrow viewports overflow.

### Layout Chain
```
AppShell → Header (h-14, toolbar in center)
         → ContentArea (<main>, overflow-y-auto, pb-24 md:pb-6)
           → max-w-reading mx-auto
             → IngestPage children (space-y-4)
               → mobile content + sticky floating tabs
         → MobileTabBar (fixed bottom-0, h-[72px], md:hidden)
```

### Breakpoint Map
| Range | MobileTabBar | Chat aside | Layout |
|-------|-------------|-----------|--------|
| < 768px | Visible (72px) | Hidden | Mobile |
| 768–1023px | Hidden | Hidden | Mobile (no chat) |
| ≥ 1024px | Hidden | Visible | Desktop |

---

## Part 1: Fix Floating Tabs Jump

### Root Cause
`sticky bottom-[76px] md:bottom-3` on the floating tabs creates a 73px positional jump at 768px when MobileTabBar toggles visibility.

### Fix
Use **`bottom-3` at all breakpoints**. Increase mobile ContentArea padding to `pb-[120px]` so scrollable content clears the stacked MobileTabBar + floating tabs.

**Files:**
- `src/pages/IngestPage.tsx` (~line 2354): `bottom-[76px] md:bottom-3` → `bottom-3`
- `src/components/layout/ContentArea.tsx` (~line 56): `pb-24` → `pb-[120px]`

**Why it works:** The tabs are always 12px from the bottom of `<main>`'s scroll viewport. On mobile the extra `pb-[120px]` ensures content isn't hidden behind the fixed MobileTabBar. At `md+` the padding drops to `pb-6` (no MobileTabBar). The breakpoint change happens in the invisible scroll-end padding, not the tab position.

---

## Part 2: Fix Toolbar Crowding

### Root Cause
All toolbar buttons show full text labels at every viewport width. No `flex-wrap` safety net.

### Fix
Progressive icon-only collapse:

| Viewport | Delete/Discard | Regen FOH | Save Draft | Publish |
|----------|---------------|-----------|------------|---------|
| < 640px | icon only | icon only | icon only | icon only |
| 640–767px | icon + label | icon only | icon + label | icon + label |
| ≥ 768px | icon + label | icon + label | icon + label | icon + label |

**Implementation pattern** (same for each button):
```tsx
<Icon className="h-3.5 w-3.5 sm:mr-1.5" />
<span className="hidden sm:inline">Label</span>
```

For "Regenerate FOH Plate Spec" (longest label), use `md:inline` instead of `sm:inline`.

**Container**: Add `flex-wrap justify-center gap-1.5 sm:gap-2` to toolbar div.

**File:** `src/pages/IngestPage.tsx` (~lines 2185–2309)

---

## Files Modified

| File | Change |
|------|--------|
| `src/pages/IngestPage.tsx` | Floating tabs: constant `bottom-3` |
| `src/pages/IngestPage.tsx` | Toolbar: responsive icon-only labels + flex-wrap |
| `src/components/layout/ContentArea.tsx` | Mobile padding: `pb-24` → `pb-[120px]` |

---

## Verification

1. Resize browser across 768px — floating tabs must NOT jump vertically
2. Shrink to <640px — all toolbar buttons icon-only, no overflow
3. 640–768px — most buttons show labels, Regenerate FOH is icon-only
4. Scroll to bottom on mobile — content visible above MobileTabBar + floating tabs
5. Test all product types (prep recipe, plate spec with Regenerate button, wine, cocktail)
6. Desktop ≥1024px — no floating tabs, full toolbar labels
