# Phase 6: Testing & Polish

## Overview

End-to-end testing of the complete Steps of Service viewer, including frontend navigation, AI actions, search relevance, mobile responsiveness, and regression testing of existing viewers.

---

## Test Matrix

### 1. TypeScript Compilation

```bash
npx tsc --noEmit
```

- [ ] 0 errors
- [ ] 0 warnings related to new SOS code

---

### 2. Navigation & Routing

| Test | Steps | Expected |
|------|-------|----------|
| Nav entry visible | Open app → check side nav | "Steps of Service" appears between Beer & Liquor and Ask AI |
| Nav icon | Check icon next to label | ClipboardList icon renders |
| Route loads | Click nav entry or go to `/steps-of-service` | Page loads without errors |
| Direct URL | Paste `/steps-of-service` in browser | Page loads (ProtectedRoute enforced) |
| Not authenticated | Go to `/steps-of-service` while logged out | Redirected to sign-in |

---

### 3. Position Selector

| Test | Steps | Expected |
|------|-------|----------|
| Cards render | Load page | 4 position cards displayed in grid |
| Server active | Check Server card | Clickable, shows "29 sections" count |
| Others disabled | Check Bartender/Busser/Barback | Show "Coming Soon", not clickable, dimmed |
| Select Server | Click Server card | Transitions to detail view |

---

### 4. Detail View — Section Navigation

| Test | Steps | Expected |
|------|-------|----------|
| Auto-select first | Select Server position | First section (Welcome) auto-selected |
| Sidebar shows all | Check section sidebar | All 29 sections listed |
| Child indentation | Check first-approach children | 4 child sections indented under parent |
| Active highlight | Click a section | Highlighted in sidebar |
| Content renders | Select any section | Markdown content renders correctly |
| Heading styles | Check section with `###` headings | Sub-headings styled properly |
| Callouts | Check sections with `> **Best Practice**` | Callout blocks render with emphasis |
| Tables | Check `taking-the-order` (steak temps), `phrases` | GFM tables render |
| Dialogue | Check `first-approach-intro` | Conversation examples render in blockquotes |
| Glossary | Check `glossary` | Definition terms in bold with descriptions |
| Back button | Click back | Returns to position selector |
| Prev/Next | Use prev/next buttons | Navigate through sections in order |

---

### 5. AI Actions — Questions

| Test | Steps | Expected |
|------|-------|----------|
| Button visible | Select a section | "Questions?" button visible |
| Click opens AI | Click Questions | AI panel opens (mobile: drawer, desktop: docked) |
| AI responds | Type a question | AI answers about the current SOS section |
| Context correct | Ask "what should I cover?" | AI references the specific section content |

---

### 6. AI Actions — Practice (Conversation Mode)

| Test | Steps | Expected |
|------|-------|----------|
| Dropdown opens | Click "Practice ▾" | Shows 4 sub-actions |
| 1st Approach | Click 1st Approach | AI panel opens, AI plays guest being seated |
| AI in character | Interact | AI responds as a guest, prompts if steps missed |
| 2nd Approach | Click 2nd Approach | AI plays guest after drinks, tests entrée skills |
| Dessert | Click Dessert | AI plays post-entrée guest, tests dessert upsell |
| The Check | Click The Check | AI plays departing guest, tests check/farewell |
| Mic active | Check browser | Microphone permission requested (conversation mode) |
| Dropdown closes | Click outside dropdown | Dropdown closes |

---

### 7. AI Actions — Listen (Voice-TTS Mode)

| Test | Steps | Expected |
|------|-------|----------|
| Dropdown opens | Click "Listen ▾" | Shows 4 sub-actions |
| 1st Approach | Click 1st Approach | AI speaks a sample greeting (30-45 seconds) |
| Auto-disconnect | After AI finishes | Session auto-disconnects, "Listen again" shown |
| No mic prompt | Check browser | NO microphone permission requested |
| 2nd Approach | Click 2nd Approach | AI speaks sample entrée presentation |
| Dessert | Click Dessert | AI speaks sample dessert recommendation |
| The Check | Click The Check | AI speaks sample check/farewell |
| Listen again | Click "Listen again" | Reconnects and plays again |

---

### 8. Search Relevance

| Query | Top 1-2 Results | Passes? |
|-------|----------------|---------|
| "how to greet a guest" | `warm-welcome`, `first-approach-intro` | [ ] |
| "steak temperature" | `taking-the-order` | [ ] |
| "food is late" | `situations` | [ ] |
| "appetizer suggestions" | `first-approach-appetizer` | [ ] |
| "clearing plates" | `prebussing` | [ ] |
| "professional behavior" | `professionalism` | [ ] |
| "bourbon suggestion" | `first-approach-beverage` | [ ] |
| "coursing" | `coursing` | [ ] |

---

### 9. Mobile Responsiveness

| Test | Screen | Expected |
|------|--------|----------|
| Position selector | 375px width | Cards stack or 2-column, readable |
| Section sidebar | 375px width | Collapses to dropdown selector |
| Content width | 375px width | Markdown content full-width |
| AI buttons | 375px width | Scrollable row, styled scrollbar |
| Swipe nav | Touch device | Swipe left/right navigates sections |
| AI drawer | 375px width | Bottom drawer opens for AI actions |
| Dropdowns | 375px width | Practice/Listen dropdowns don't overflow screen |

---

### 10. Dark Mode

| Test | Expected |
|------|----------|
| Position cards | Proper dark backgrounds, readable text |
| Section sidebar | Dark background, visible active highlight |
| Markdown content | All elements readable (headings, callouts, tables) |
| AI buttons | Proper contrast in both states (active/inactive) |
| Dropdowns | Dark background, visible hover states |

---

### 11. Regression Testing

Verify existing features are not broken:

| Viewer | Test | Expected |
|--------|------|----------|
| Dish Guide | Open → select a dish → AI buttons work | No regressions |
| Wines | Open → select a wine → AI buttons work | No regressions |
| Cocktails | Open → select a cocktail → AI buttons work | No regressions |
| Beer & Liquor | Open → select an item → AI buttons work | No regressions |
| Recipes | Open → select a recipe → AI buttons work | No regressions |
| Manual | Open → navigate sections → AI ask works | No regressions |
| Search | Search for "steak" → results include dishes | No regressions |

---

### 12. Edge Cases

| Scenario | Expected |
|----------|----------|
| Empty position (Bartender) | Shows "Coming Soon" state, not an error |
| Network error loading SOS data | Error state with retry message |
| Very long section content | Scrollable, no overflow |
| Rapid section switching | No stale content, smooth transitions |
| Switching sections while AI panel is open | AI panel closes or updates context |
| Browser back button from detail view | Returns to position selector |

---

## Performance Checks

- [ ] Initial page load: < 2s (position selector)
- [ ] Section switch: < 100ms (data already loaded)
- [ ] AI panel open: < 500ms
- [ ] Search query: < 1s response time
- [ ] No unnecessary re-renders (React DevTools profiler)

---

## Security Checks

- [ ] Run `get_advisors(type: 'security')` — no new warnings for SOS table
- [ ] RLS: Non-authenticated users cannot access SOS data
- [ ] Service role key not exposed in client code
- [ ] Trigger function has `SET search_path = 'public'`
- [ ] Search function has `SET search_path = 'public'`

---

## Final Cleanup

- [ ] Remove any TODO comments from code
- [ ] Verify all console.log statements removed (or appropriate)
- [ ] Check no hardcoded IDs in seed migration
- [ ] Update MEMORY.md with new state (SOS viewer, migration count, etc.)

---

## Dependencies

- **Requires**: All previous phases (1-5) complete
- **Blocks**: Final commit and push to GitHub
