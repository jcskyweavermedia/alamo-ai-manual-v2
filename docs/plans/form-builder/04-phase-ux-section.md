# Phase 4: Main AI Chat Integration — UX/UI Design Specification

> **Status:** Planning
> **Date:** 2026-02-24
> **Estimated effort:** ~1 session
> **Dependencies:** Phase 1 (DB Foundation, complete), Phase 2 (Form Viewer, complete), Phase 3 (AI Form Filling, complete)
> **Author:** Senior UX/UI Expert (Opus)
> **Scope:** Every visual element, interaction pattern, component structure, and Tailwind class needed to integrate form navigation into the main `/ask` chat and wire `FormDetail` to accept pre-fill context from that navigation.

---

## Table of Contents

1. [Design Principles](#iv1-design-principles)
2. [FormNavigationCard Component](#iv2-formnavigationcard-component)
3. [Chat-to-Form Navigation Flow](#iv3-chat-to-form-navigation-flow)
4. [FormDetail Pre-fill Integration](#iv4-formdetail-pre-fill-integration)
5. [Ask Page Modifications](#iv5-ask-page-modifications)
6. [Mobile vs Desktop Flow](#iv6-mobile-vs-desktop-flow)
7. [Edge Cases](#iv7-edge-cases)
8. [Component File Map](#iv8-component-file-map)
9. [ASCII Mockups](#iv9-ascii-mockups)
10. [Accessibility Checklist](#iv10-accessibility-checklist)
11. [Design Decision Log](#iv11-design-decision-log)
12. [Verification Plan](#iv12-verification-plan)

---
---

## IV.1. Design Principles

| Principle | Application |
|-----------|-------------|
| **Continuity over interruption** | The transition from `/ask` chat to `/forms/:slug` should feel like a natural continuation of the conversation, not a jarring page change. The AI is "handing you off" to a specialized form assistant. |
| **Show, then confirm** | When the AI detects form intent, it shows the matching form(s) as visual cards *inside the chat*. The user explicitly confirms before any navigation occurs. No auto-redirects. |
| **Context travels with you** | Whatever the user described in the chat travels to the form page. "John cut his hand on the slicer at 3pm" becomes the AI assistant's first message on the form page, so the user does not repeat themselves. |
| **Reuse existing patterns** | `FormCard` already exists with icon emoji tiles, title, and description. `FormNavigationCard` inherits this visual language. `AIAnswerCard` already renders in the chat stream -- `FormNavigationCard` renders in the same position. |
| **Reversible** | The user can dismiss the suggestion, go back from the form page, or ignore the pre-fill context. Nothing is forced. |
| **Mobile-first, desktop-enhanced** | On mobile, chat is full-screen; navigation replaces the view. On desktop, the chat lives in the `AppShell.aiPanel`; navigation opens the form in the main content area. Both paths lead to the same `FormDetail` page with the same pre-fill logic. |

---

## IV.2. FormNavigationCard Component

### IV.2.1 Purpose

A new component rendered **inside the chat conversation** when the AI's response includes `mode: "form_navigation"`. It presents one or more matching form templates as selectable cards, with a clear call-to-action to navigate to the form.

### IV.2.2 Props Interface

```typescript
// src/components/chat/FormNavigationCard.tsx

export interface FormNavigationOption {
  slug: string;
  title: string;
  description: string | null;
  icon: string;       // Lucide icon name (maps to emoji via ICON_EMOJI_MAP)
  confidence: number; // 0-1, from search score -- used to highlight top match
}

export interface FormNavigationCardProps {
  /** The AI's message accompanying the form suggestion */
  message: string;
  /** Array of matching forms (1-3 typically) */
  forms: FormNavigationOption[];
  /** Called when user clicks "Fill this form" on a specific option */
  onSelect: (slug: string) => void;
  /** Called when user dismisses the suggestion */
  onDismiss: () => void;
  /** Current language */
  language: 'en' | 'es';
  /** Whether any form is currently being navigated to */
  isNavigating?: boolean;
}
```

### IV.2.3 Visual Design

The card is a left-aligned "assistant" card in the chat stream (same position as `AIAnswerCard`). It contains:

1. **AI message** -- the conversational text ("I found this form that matches your request:")
2. **Form option card(s)** -- each with icon tile, title, description, and "Fill this form" button
3. **Top match highlight** -- the highest-confidence form gets a subtle primary border
4. **Dismiss link** -- "Not what I need" text link below the cards

### IV.2.4 TSX Implementation

```tsx
import { cn } from '@/lib/utils';
import { FileText, ArrowRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CardFloating } from '@/components/ui/card';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Reuse the same icon map from FormCard.tsx
const ICON_EMOJI_MAP: Record<string, { emoji: string; bg: string; darkBg: string }> = {
  ClipboardList:   { emoji: '\u{1F4CB}', bg: 'bg-blue-100',   darkBg: 'dark:bg-blue-900/30' },
  AlertTriangle:   { emoji: '\u{26A0}\u{FE0F}',  bg: 'bg-red-100',    darkBg: 'dark:bg-red-900/30' },
  FileWarning:     { emoji: '\u{26A0}\u{FE0F}',  bg: 'bg-red-100',    darkBg: 'dark:bg-red-900/30' },
  ShieldAlert:     { emoji: '\u{1F6E1}\u{FE0F}', bg: 'bg-orange-100', darkBg: 'dark:bg-orange-900/30' },
  UserX:           { emoji: '\u{1F464}', bg: 'bg-amber-100',  darkBg: 'dark:bg-amber-900/30' },
  FileText:        { emoji: '\u{1F4C4}', bg: 'bg-slate-100',  darkBg: 'dark:bg-slate-800' },
  Stethoscope:     { emoji: '\u{1FA7A}', bg: 'bg-green-100',  darkBg: 'dark:bg-green-900/30' },
  Wrench:          { emoji: '\u{1F527}', bg: 'bg-gray-100',   darkBg: 'dark:bg-gray-800' },
  CheckSquare:     { emoji: '\u{2705}', bg: 'bg-emerald-100', darkBg: 'dark:bg-emerald-900/30' },
  Calendar:        { emoji: '\u{1F4C5}', bg: 'bg-purple-100', darkBg: 'dark:bg-purple-900/30' },
};

const DEFAULT_ICON = { emoji: '\u{1F4CB}', bg: 'bg-blue-100', darkBg: 'dark:bg-blue-900/30' };

const STRINGS = {
  en: {
    fillForm: 'Fill this form',
    notNeeded: 'Not what I need',
    navigating: 'Opening form...',
    bestMatch: 'Best match',
  },
  es: {
    fillForm: 'Llenar formulario',
    notNeeded: 'No es lo que necesito',
    navigating: 'Abriendo formulario...',
    bestMatch: 'Mejor resultado',
  },
} as const;

export function FormNavigationCard({
  message,
  forms,
  onSelect,
  onDismiss,
  language,
  isNavigating = false,
}: FormNavigationCardProps) {
  const t = STRINGS[language];

  // Determine which form has the highest confidence
  const topSlug = forms.length > 0
    ? forms.reduce((best, f) => f.confidence > best.confidence ? f : best, forms[0]).slug
    : null;

  return (
    <CardFloating className="p-4">
      {/* AI message */}
      <div className="text-body text-foreground mb-3">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {message}
        </ReactMarkdown>
      </div>

      {/* Form option cards */}
      <div className="space-y-2">
        {forms.map((form) => {
          const iconConfig = ICON_EMOJI_MAP[form.icon] ?? DEFAULT_ICON;
          const isTopMatch = form.slug === topSlug && forms.length > 1;

          return (
            <div
              key={form.slug}
              className={cn(
                'flex items-start gap-3 p-3',
                'rounded-xl',
                'border transition-all duration-150',
                isTopMatch
                  ? 'border-primary/40 bg-primary/5 dark:bg-primary/10'
                  : 'border-border/60 bg-muted/20 dark:bg-muted/10',
              )}
            >
              {/* Icon tile -- 40x40 */}
              <div
                className={cn(
                  'flex items-center justify-center shrink-0',
                  'w-10 h-10 rounded-[10px]',
                  iconConfig.bg,
                  iconConfig.darkBg,
                )}
              >
                <span className="text-[20px] h-[20px] leading-[20px]">
                  {iconConfig.emoji}
                </span>
              </div>

              {/* Title + description + button */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold text-foreground leading-tight line-clamp-1">
                      {form.title}
                    </h4>
                    {form.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                        {form.description}
                      </p>
                    )}
                    {isTopMatch && (
                      <span
                        className={cn(
                          'inline-flex items-center mt-1',
                          'px-1.5 py-0.5 rounded-full',
                          'bg-primary/10 dark:bg-primary/15',
                          'text-[10px] font-semibold text-primary',
                        )}
                      >
                        {t.bestMatch}
                      </span>
                    )}
                  </div>
                </div>

                {/* Fill button */}
                <Button
                  size="sm"
                  onClick={() => onSelect(form.slug)}
                  disabled={isNavigating}
                  className={cn(
                    'mt-2 h-8 px-3 text-xs font-semibold',
                    'rounded-full',
                    isTopMatch
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                      : 'bg-muted text-foreground hover:bg-muted/80',
                  )}
                >
                  {isNavigating ? (
                    t.navigating
                  ) : (
                    <>
                      {t.fillForm}
                      <ArrowRight className="h-3.5 w-3.5 ml-1" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Dismiss link */}
      <button
        type="button"
        onClick={onDismiss}
        className={cn(
          'flex items-center gap-1 mt-3',
          'text-xs text-muted-foreground',
          'hover:text-foreground',
          'transition-colors duration-100',
        )}
      >
        <X className="h-3 w-3" />
        {t.notNeeded}
      </button>
    </CardFloating>
  );
}
```

### IV.2.5 Key Design Choices

| Choice | Rationale |
|--------|-----------|
| `CardFloating` wrapper | Matches `AIAnswerCard` -- same elevation and rounded style in the chat. |
| Emoji icon tiles | Reuses `ICON_EMOJI_MAP` from `FormCard.tsx` for visual consistency between the Forms page and the chat suggestion. |
| Pill button per card | Each form option gets its own action button -- no ambiguity about which form you are selecting. |
| Top match badge | When multiple forms match, the highest-confidence one gets a primary border + "Best match" badge so the user knows which to choose. |
| "Not what I need" dismissal | Allows the user to stay in the chat and refine their question. Does not navigate away. |
| Markdown message | The AI's message can include formatting (bold, lists) for clarity. |

---

## IV.3. Chat-to-Form Navigation Flow

### IV.3.1 Step-by-Step User Journey

```
Step 1: User types in /ask chat
   "I need to fill out an injury report for John who cut his hand at 3pm"

Step 2: Frontend sends question to /ask edge function
   The enhanced /ask function detects form-filling intent via keywords
   ("fill out", "injury report", "write-up", "document", "report", "form")
   and calls the `search_forms` tool.

Step 3: Edge function returns form_navigation response
   {
     answer: "I found an injury report form that matches. Would you like to fill it out?",
     mode: "form_navigation",
     forms: [
       { slug: "employee-injury-report", title: "Employee Injury Report",
         description: "...", icon: "AlertTriangle", confidence: 0.92 }
     ],
     extractedContext: "John cut his hand at 3pm",
     citations: []
   }

Step 4: Chat displays FormNavigationCard
   - The AI message renders as text above the card
   - The form option card(s) appear with icon, title, description
   - "Fill this form" button highlighted on the top match

Step 5: User clicks "Fill this form"
   - Navigation handler called with the form slug
   - Pre-fill context stored in navigation state

Step 6: App navigates to /forms/:slug
   navigate(`/forms/${slug}`, {
     state: {
       prefillContext: "John cut his hand at 3pm",
       fromChat: true,
     }
   });

Step 7: FormDetail detects pre-fill context
   - Reads location.state on mount
   - Detects { prefillContext, fromChat: true }

Step 8: AI panel auto-opens
   - setAiPanelOpen(true) triggered by pre-fill context detection
   - Panel slides in (desktop) or drawer opens (mobile)

Step 9: Pre-fill context auto-sent as first message
   - useAskForm.askForm(prefillContext) called automatically
   - AI extracts fields from the context
   - Fields auto-apply to the form (existing auto-apply behavior in FormAIContent)
   - User sees the AI response and can follow up

Step 10: Context cleared
   - location.state is consumed and cleared from React state
   - Subsequent visits to the same URL will not re-trigger pre-fill
```

### IV.3.2 Context Passing Mechanism: React Router `navigate` State

**Chosen approach:** React Router's `navigate(path, { state })`.

| Mechanism | Pros | Cons | Verdict |
|-----------|------|------|---------|
| `navigate(path, { state })` | Built-in to react-router-dom. Persists across page transitions. No URL pollution. Cleared on refresh (desired). | Lost if user manually types the URL. Cannot deep-link with context. | **Selected** -- best fit for chat-to-form handoff. |
| URL search params | Bookmarkable. Survives refresh. | Context is long text -- ugly URL. Encoding issues. Security (visible in URL). | Rejected. |
| sessionStorage | Survives refresh. | Manual cleanup needed. Race conditions on multiple tabs. | Backup option -- not needed. |
| React Context provider | In-memory. Fast. | Lost on page refresh. Requires wrapping in provider. No built-in lifecycle. | Rejected. |

**Why `navigate` state is ideal:**

1. The pre-fill context is ephemeral by nature -- it should only fire once when coming from the chat.
2. If the user refreshes, the form loads normally without pre-fill -- this is correct behavior.
3. No URL pollution -- `/forms/employee-injury-report` is a clean URL.
4. No global state management needed -- `useLocation().state` is local to the page component.
5. The codebase does not currently use `navigate` with state (confirmed by grep), making this a clean introduction of the pattern.

### IV.3.3 Navigation State Interface

```typescript
// src/types/forms.ts (add to existing file)

export interface FormPrefillState {
  /** The user's original description from the /ask chat */
  prefillContext: string;
  /** Flag indicating this navigation came from the main AI chat */
  fromChat: true;
}
```

---

## IV.4. FormDetail Pre-fill Integration

### IV.4.1 How FormDetail Detects Pre-fill Context

```typescript
// In FormDetail.tsx, add at the top of the component:

import { useLocation } from 'react-router-dom';
import type { FormPrefillState } from '@/types/forms';

// Inside the FormDetail component:
const location = useLocation();
const prefillState = location.state as FormPrefillState | null;

// Ref to track whether we have already consumed the pre-fill context
const prefillConsumedRef = useRef(false);
```

### IV.4.2 Auto-Opening AI Panel and Sending Context

```typescript
// After template loads and submission is ready, check for pre-fill:
useEffect(() => {
  // Guard: only fire once, only when we have pre-fill context
  if (prefillConsumedRef.current) return;
  if (!prefillState?.fromChat || !prefillState.prefillContext) return;
  if (!template || !hasAiTools) return;
  if (isCreating) return; // Wait for draft creation to finish

  prefillConsumedRef.current = true;

  // Open the AI panel
  setAiPanelOpen(true);

  // Send the pre-fill context as the first AI message (after a brief delay
  // for the panel to mount and animation to start)
  const timer = setTimeout(() => {
    aiWithCurrentValues.askForm(prefillState.prefillContext);
  }, 300);

  // Clear the location state so a back-then-forward does not re-trigger
  window.history.replaceState({}, document.title);

  return () => clearTimeout(timer);
}, [
  template, hasAiTools, isCreating,
  prefillState, aiWithCurrentValues.askForm,
]);
```

### IV.4.3 Key Behaviors

| Behavior | Implementation |
|----------|---------------|
| AI panel auto-opens | `setAiPanelOpen(true)` on pre-fill detection. Works for both desktop (docked panel) and mobile (drawer). |
| First message auto-sent | `askForm(prefillContext)` called after 300ms delay (allows panel to mount and animate in). |
| Fields auto-applied | The existing `FormAIContent` auto-apply effect handles this. When the AI response arrives with `fieldUpdates`, they are automatically applied to the form (no user toggle needed -- this is the existing Phase 3 behavior). |
| Context consumed once | `prefillConsumedRef` prevents re-firing on re-renders. `window.history.replaceState({}, document.title)` clears the location state entirely. |
| Refresh-safe | After `replaceState`, refreshing the page loads the form normally without pre-fill. |
| No AI tools fallback | If the form has no `ai_tools`, the pre-fill context is silently ignored and the form loads normally. |

### IV.4.4 FormDetail Modifications Summary

```diff
// src/pages/FormDetail.tsx

+ import { useLocation } from 'react-router-dom';
+ import type { FormPrefillState } from '@/types/forms';

  const FormDetail = () => {
    const { slug } = useParams<{ slug: string }>();
    const navigate = useNavigate();
+   const location = useLocation();
+   const prefillState = location.state as FormPrefillState | null;
+   const prefillConsumedRef = useRef(false);

    // ... existing hooks ...

+   // Pre-fill from /ask chat integration
+   useEffect(() => {
+     if (prefillConsumedRef.current) return;
+     if (!prefillState?.fromChat || !prefillState.prefillContext) return;
+     if (!template || !hasAiTools || isCreating) return;
+
+     prefillConsumedRef.current = true;
+     setAiPanelOpen(true);
+
+     const timer = setTimeout(() => {
+       aiWithCurrentValues.askForm(prefillState.prefillContext);
+     }, 300);
+
+     window.history.replaceState({}, document.title);
+     return () => clearTimeout(timer);
+   }, [template, hasAiTools, isCreating, prefillState, aiWithCurrentValues.askForm]);

    // ... rest of component unchanged ...
  };
```

---

## IV.5. Ask Page Modifications

### IV.5.1 Response Type Extension

The `/ask` edge function will return an extended response when it detects form intent. The frontend needs to handle this new `mode`.

```typescript
// Extended response type for form navigation
// (add to use-ask-ai.ts or a shared types file)

export interface FormNavigationForm {
  slug: string;
  title: string;
  description: string | null;
  icon: string;
  confidence: number;
}

export interface AskResultWithFormNav extends AskResult {
  mode: 'form_navigation';
  forms: FormNavigationForm[];
  extractedContext: string; // The user's original input, possibly refined
}
```

### IV.5.2 Ask Page State Changes

```typescript
// In Ask.tsx, add state for form navigation:

const [formNavResult, setFormNavResult] = useState<{
  message: string;
  forms: FormNavigationForm[];
  extractedContext: string;
} | null>(null);
const [isFormNavigating, setIsFormNavigating] = useState(false);
```

### IV.5.3 Modified handleAsk

```typescript
const handleAsk = async () => {
  if (!question.trim() || isLoading || isAtLimit) return;

  const askedQuestion = question;
  setQuestion("");
  setFormNavResult(null); // Clear any previous form nav suggestion

  setCurrentAnswer({
    question: askedQuestion,
    answer: "",
    citations: [],
    isLoading: true,
    isExpanding: false,
  });

  const result = await ask(askedQuestion);

  if (result) {
    incrementUsageOptimistically();

    // Check if this is a form navigation response
    if (result.mode === 'form_navigation' && (result as any).forms?.length > 0) {
      const navResult = result as AskResultWithFormNav;
      setCurrentAnswer(null); // Clear the loading card
      setFormNavResult({
        message: navResult.answer,
        forms: navResult.forms,
        extractedContext: navResult.extractedContext || askedQuestion,
      });
    } else {
      setCurrentAnswer({
        question: askedQuestion,
        answer: result.answer,
        citations: result.citations,
        isLoading: false,
        isExpanding: false,
      });
    }
  } else {
    setCurrentAnswer(null);
  }
};
```

### IV.5.4 Form Navigation Handlers

```typescript
const handleFormSelect = useCallback((slug: string) => {
  if (!formNavResult) return;
  setIsFormNavigating(true);

  // Navigate to the form with pre-fill context
  navigate(`/forms/${slug}`, {
    state: {
      prefillContext: formNavResult.extractedContext,
      fromChat: true,
    } as FormPrefillState,
  });
}, [navigate, formNavResult]);

const handleFormDismiss = useCallback(() => {
  setFormNavResult(null);
  // The user stays in the chat. They can ask another question.
}, []);
```

### IV.5.5 Rendering FormNavigationCard in the Chat Stream

The `FormNavigationCard` renders in the same positions as `AIAnswerCard` -- both in the mobile content area and the desktop AI panel.

```tsx
// In the desktop aiPanel variable:
const aiPanel = (
  <div className="flex flex-col h-full">
    {/* ... header with Sparkles + usage meter ... */}
    <div className="flex-1 overflow-y-auto p-4">
      {isVoiceActive ? (
        <VoiceTranscript ... />
      ) : formNavResult ? (
        <FormNavigationCard
          message={formNavResult.message}
          forms={formNavResult.forms}
          onSelect={handleFormSelect}
          onDismiss={handleFormDismiss}
          language={language}
          isNavigating={isFormNavigating}
        />
      ) : currentAnswer ? (
        <AIAnswerCard ... />
      ) : null}
    </div>
  </div>
);

// In the mobile content area (lg:hidden):
{!isVoiceActive && (
  <div className="lg:hidden">
    {formNavResult ? (
      <FormNavigationCard
        message={formNavResult.message}
        forms={formNavResult.forms}
        onSelect={handleFormSelect}
        onDismiss={handleFormDismiss}
        language={language}
        isNavigating={isFormNavigating}
      />
    ) : currentAnswer ? (
      <AIAnswerCard ... />
    ) : null}
  </div>
)}
```

### IV.5.6 Import Additions to Ask.tsx

```typescript
import { FormNavigationCard } from '@/components/chat/FormNavigationCard';
import type { FormPrefillState } from '@/types/forms';
```

---

## IV.6. Mobile vs Desktop Flow

### IV.6.1 Mobile Flow (< 1024px)

```
/ask page (full screen)
  User types "fill out an injury report for John"
  AI response: FormNavigationCard in mobile content area
  User taps "Fill this form"

Page transition (full page navigation)
  navigate('/forms/employee-injury-report', { state: { ... } })

/forms/employee-injury-report (full screen)
  FormDetail loads
  Pre-fill context detected
  FormAIDrawer auto-opens (bottom sheet, 85vh)
  askForm("John cut his hand at 3pm") fires
  AI extracts fields -> auto-applied to form
  Drawer shows conversation
  User reviews extracted fields in the form
  User can follow up or dismiss drawer
```

**Key mobile considerations:**

- The `FormNavigationCard` renders in the main content scroll area (not inside a drawer or panel).
- Navigation is a standard page transition -- `navigate()` replaces the view.
- The AI drawer auto-opens over the form, consistent with the Phase 3 drawer behavior.
- After applying fields, the drawer can be dismissed so the user reviews the form.
- The back button in `FormHeader` returns to `/forms` (not to `/ask`). This is intentional -- the user is now in "form mode". To get back to chat, they use the tab bar.

### IV.6.2 Desktop Flow (>= 1024px)

```
/ask page with aiPanel
  Chat is in the right-side aiPanel (320/384px)
  Question input is in main content area
  AI response: FormNavigationCard appears in aiPanel

User clicks "Fill this form"
  navigate('/forms/employee-injury-report', { state: { ... } })

/forms/employee-injury-report with aiPanel
  FormDetail loads in main content area
  Pre-fill context detected
  DockedFormAIPanel auto-opens in aiPanel slot
  askForm("John cut his hand at 3pm") fires
  AI extracts fields -> auto-applied to form
  Form and AI panel visible side by side
```

**Key desktop considerations:**

- The `FormNavigationCard` renders inside the `aiPanel` `<aside>`, which is the same slot used by `AIAnswerCard`.
- After navigation, `FormDetail` takes over the entire `AppShell` -- the AI panel is now the `DockedFormAIPanel`, not the `/ask` panel.
- The layout stays consistent: main content on the left, AI panel on the right.

### IV.6.3 Transition Smoothness

There is no way to avoid a full page transition between `/ask` and `/forms/:slug` -- they are different routes. To make it feel smooth:

1. **No flash of empty content:** The pre-fill `useEffect` fires immediately after template loads, so the AI panel opens and the first message sends before the user can notice a "blank form" state.
2. **Loading skeleton:** `FormSkeleton` shows during template fetch, providing visual continuity.
3. **Panel animation:** `DockedFormAIPanel` slides in from the right (existing `slide-in-from-right-4` animation), giving a sense of progression.

---

## IV.7. Edge Cases

### IV.7.1 User Says "No" to the Suggested Form

**Scenario:** AI suggests "Employee Injury Report" but the user clicks "Not what I need."

**Behavior:**
- `formNavResult` is cleared via `handleFormDismiss`.
- The chat returns to the input state.
- A soft prompt appears: the dismiss handler could optionally set a follow-up message like "I can search for other forms. What kind of form are you looking for?"
- For Phase 4, the minimal behavior is simply clearing the suggestion and letting the user type again.

### IV.7.2 No Matching Forms Found

**Scenario:** User says "I need a tax filing form" -- nothing in the system matches.

**Behavior:**
- The `/ask` edge function's `search_forms` tool returns 0 results.
- The AI responds with a normal text answer: "I couldn't find a form matching your request. The available forms are: Employee Injury Report, Employee Write-Up. Would you like to fill one of these?"
- This renders as a normal `AIAnswerCard` (mode is `'search'`, not `'form_navigation'`).
- No `FormNavigationCard` is shown.

### IV.7.3 User Navigates Back to Chat After Going to Form

**Scenario:** User navigated from `/ask` to `/forms/employee-injury-report`, then clicks the "Ask" tab in the tab bar.

**Behavior:**
- The `/ask` page re-mounts.
- `formNavResult` state is reset (component re-initializes).
- The previous chat context is lost (consistent with current `/ask` behavior -- it is not a persisted conversation).
- The user can start a new question.

**Future improvement (Phase 8+):** Persist chat history in `chat_sessions` so the user can resume.

### IV.7.4 Pre-fill Context from Complex Multi-Sentence Input

**Scenario:** "John Smith, one of our line cooks, was working the grill station when he slipped on a wet floor near the dishwashing area around 3:15 PM today. He fell and hit his left knee and right wrist on the edge of the prep table. We administered first aid -- ice pack and bandage. He did not need to go to the hospital."

**Behavior:**
- The full text is passed as `extractedContext` in navigation state.
- On the form page, `askForm(fullText)` sends it all to the edge function.
- The AI extracts multiple fields in a single pass: employee name, position, location, time, date, body parts, injury type, first aid description, hospital transport status.
- This is the ideal case -- the more context the user provides, the better the extraction.

### IV.7.5 Ambiguous Query Matches Multiple Forms

**Scenario:** "I need to write something up" -- could be Employee Write-Up or Employee Injury Report.

**Behavior:**
- `search_forms` returns both forms with different scores.
- `FormNavigationCard` renders both options.
- The higher-scoring form gets the "Best match" badge.
- The user picks the correct one.
- The extracted context ("I need to write something up") is minimal, so the AI will ask follow-up questions on the form page.

### IV.7.6 Pre-fill Context on a Form Without AI Tools

**Scenario:** Navigation state arrives at a form that has `ai_tools: []` (empty).

**Behavior:**
- The `hasAiTools` check in the pre-fill `useEffect` prevents the AI panel from opening.
- The form loads normally in manual-fill mode.
- The pre-fill context is silently discarded.
- No error shown -- the user simply fills the form manually.

### IV.7.7 User Refreshes the Form Page After Pre-fill

**Scenario:** User navigates from chat, AI panel opens, fields are extracted. Then the user refreshes.

**Behavior:**
- `window.history.replaceState({}, document.title)` already cleared the location state.
- On refresh, `prefillState` is `null`.
- The form loads with whatever was auto-saved (draft persistence).
- AI panel does not auto-open.
- The user can manually open AI Fill if they want to continue.

---

## IV.8. Component File Map

### IV.8.1 New Files

| File | Type | Description |
|------|------|-------------|
| `src/components/chat/FormNavigationCard.tsx` | Component | Form suggestion card rendered in the `/ask` chat stream. |

### IV.8.2 Modified Files

| File | Changes |
|------|---------|
| `src/pages/Ask.tsx` | Add `formNavResult` state, `handleFormSelect`, `handleFormDismiss`. Render `FormNavigationCard` in both mobile content area and desktop `aiPanel`. Import `FormNavigationCard` and `FormPrefillState`. |
| `src/pages/FormDetail.tsx` | Add `useLocation()`, `FormPrefillState` detection, pre-fill `useEffect` that auto-opens AI panel and sends context as first message. Import `useLocation` and `FormPrefillState`. |
| `src/types/forms.ts` | Add `FormPrefillState` interface. |
| `src/hooks/use-ask-ai.ts` | Add `FormNavigationForm` and `AskResultWithFormNav` types (or add `forms` and `extractedContext` to existing `AskResult`). |
| `supabase/functions/ask/index.ts` | Add `search_forms` tool definition, form intent detection, `form_navigation` mode handling. (Backend -- not UX scope, but listed for completeness.) |

### IV.8.3 Reused Files (Not Modified)

| File | Reuse |
|------|-------|
| `src/components/ui/card.tsx` | `CardFloating` used in `FormNavigationCard`. |
| `src/components/forms/FormCard.tsx` | `ICON_EMOJI_MAP` pattern reused (copy, not import -- to avoid coupling). |
| `src/components/forms/DockedFormAIPanel.tsx` | Auto-opened by pre-fill, no changes needed. |
| `src/components/forms/FormAIDrawer.tsx` | Auto-opened by pre-fill, no changes needed. |
| `src/components/forms/FormAIContent.tsx` | Existing auto-apply behavior handles pre-fill fields. No changes needed. |
| `src/hooks/use-ask-form.ts` | `askForm()` called with pre-fill context. No changes needed. |
| `src/components/layout/AppShell.tsx` | `aiPanel` prop used by both Ask page and FormDetail page. No changes needed. |

---

## IV.9. ASCII Mockups

### IV.9.1 Desktop -- Chat with Form Suggestion (>= 1024px)

```
+----------+------------------------------------------+--------------------+
| Sidebar  |  Ask AI                                  |  AI Panel (320px)  |
|          |  Get instant answers from your manual     |                    |
|  Forms   +------------------------------------------+  [sparkle] AI      |
|  Manual  |                                          |  Assistant         |
|  Ask     |  [Ask a question about procedures...   ] +--------------------+
|  ...     |  [voice]                                 |  Usage: 88/100     |
|          +------------------------------------------+--------------------+
|          |                                          |                    |
|          |  Try asking:                              |  I found a form    |
|          |  [What temperature...] [How often...]    |  that matches your |
|          |                                          |  request:          |
|          |                                          |                    |
|          |                                          | +----------------+ |
|          |                                          | | [!!] Employee  | |
|          |                                          | | Injury Report  | |
|          |                                          | | Document and   | |
|          |                                          | | track employee | |
|          |                                          | | injuries...    | |
|          |                                          | | [Best match]   | |
|          |                                          | | [Fill this ->] | |
|          |                                          | +----------------+ |
|          |                                          |                    |
|          |                                          | x Not what I need  |
|          |                                          |                    |
+----------+------------------------------------------+--------------------+
```

### IV.9.2 Mobile -- Chat with Form Suggestion (< 1024px)

```
+--------------------------------------+
|  [=] Ask AI              [EN] [user] |
+--------------------------------------+
|                                      |
|  Ask AI                              |
|  Get instant answers from your       |
|  operations manual                   |
|                                      |
|  +----------------------------------+|
|  |[Ask a question...       ] [send] ||
|  +----------------------------------+|
|                                      |
|  +----------------------------------+|
|  |  I found a form that matches     ||
|  |  your request:                    ||
|  |                                   ||
|  | +------------------------------+ ||
|  | | [!!] Employee Injury Report  | ||
|  | | Document and track employee  | ||
|  | | injuries in the workplace... | ||
|  | | [Best match]                 | ||
|  | | [    Fill this form ->     ] | ||
|  | +------------------------------+ ||
|  |                                   ||
|  |  x Not what I need               ||
|  +----------------------------------+|
|                                      |
|  Try asking:                         |
|  [What temperature...] [How often...] |
|                                      |
+--------------------------------------+
|  [home] [manual] [ask] [profile]     |
+--------------------------------------+
```

### IV.9.3 Desktop -- FormDetail with Pre-fill AI Panel Open

```
+----------+------------------------------------------+--------------------+
| Sidebar  |  FormHeader                               |                    |
|          |  [<--] Employee Injury Report [*AI] Saved |                    |
|          +------------------------------------------+  AI PANEL (320px)  |
|  Forms   |  Progress: 35%             8/23           |                    |
|  Manual  +------------------------------------------+  [sparkle] AI      |
|  ...     |                                          |  Assistant    [X]  |
|          |  Section: Employee Info                   +--------------------+
|          |  +--------------------------------------+ |  Usage: 87/100     |
|          |  | Employee Name: [John Smith      ]  * | +--------------------+
|          |  | Position:      [________________ ]    | |                    |
|          |  +--------------------------------------+ |  You said:         |
|          |                                          | |  "fill out injury  |
|          |  Section: Incident Details                | |   report for John  |
|          |  +--------------------------------------+ | |   who cut his hand |
|          |  | Date of Injury: [2026-02-24  ]    * | | |   at 3pm"         |
|          |  | Time of Injury: [15:00       ]    * | |                    |
|          |  | Description:    [Employee cut...]  * | | --- AI Response ---+
|          |  +--------------------------------------+ |  5 fields found    |
|          |                                          | |  [v] Employee Name |
|          |  [Save Draft]  [Submit]                   | |  [v] Date: 02-24  |
|          |                                          | |  [v] Time: 15:00  |
|          |                                          | |  [v] Body: Hand   |
|          |                                          | |  [v] Description   |
|          |                                          | |                    |
|          |                                          | | ! 3 required fields|
|          |                                          | |   still needed     |
|          |                                          | |                    |
|          |                                          | | "What is the       |
|          |                                          | |  employee's        |
|          |                                          | |  position?"        |
|          |                                          | +--------------------+
|          |                                          | |  [input...] [+][o]|
+----------+------------------------------------------+--------------------+
```

### IV.9.4 Mobile -- FormDetail After Pre-fill Navigation

```
+--------------------------------------+
| [<-] Employee Injury Repo... [AI] OK |  <- Still visible (15vh)
+--------------------------------------+
| 35%                          8/23    |
+======================================+  <- Drawer starts here
|          --- drag handle ---         |
| [sparkle] AI Assistant          [X]  |
+--------------------------------------+
|  You said: "fill out injury report   |
|  for John who cut his hand at 3pm"   |
|  +---------------------------------+ |
|  | [sparkle] 5 fields extracted    | |
|  | [v] Employee Name: John         | |
|  | [v] Time of Injury: 15:00      | |
|  | [v] Date of Injury: 2026-02-24 | |
|  | [v] Body Parts: Hand           | |
|  | [v] Description: cut his hand  | |
|  | ! 3 fields still needed        | |
|  +---------------------------------+ |
|  [sparkle] "What is John's position  |
|  and last name?"                     |
+--------------------------------------+
| [Describe...         ] [+] [mic] [>]|
+--------------------------------------+
```

---

## IV.10. Accessibility Checklist

| Element | Requirement | Implementation |
|---------|-------------|----------------|
| FormNavigationCard | Semantic structure | Uses `<button>` for interactive elements, heading for form title. |
| Form option cards | Keyboard operable | Native `<button>` wrapping each option. Enter/Space triggers `onSelect`. |
| "Fill this form" button | Accessible name | Visually labeled. Screen reader sees "Fill this form" text content. |
| "Not what I need" dismiss | Keyboard operable | Native `<button>`. Focus ring visible. |
| "Best match" badge | Screen reader | Text content is read naturally as part of the card. |
| Top match highlight | Color not sole indicator | Badge text "Best match" provides non-color indicator alongside the primary border. |
| Navigation transition | Focus management | When form page loads, focus moves to the `FormHeader` (existing behavior). If AI panel auto-opens, focus moves to the panel (existing `DockedFormAIPanel` focus behavior). |
| Pre-fill loading state | Screen reader notification | `aria-live="polite"` region on the FormAIContent conversation area announces "Thinking..." when loading. |
| Color contrast | WCAG 2.1 AA | All text meets 4.5:1 contrast ratio. Primary pill buttons meet 3:1 for large text. |
| Reduced motion | `prefers-reduced-motion` | `FormNavigationCard` uses no animations. Panel slide-in respects existing reduced-motion handling. |
| Language toggle | Bilingual labels | All strings in `STRINGS` object with `en`/`es` variants. |

---

## IV.11. Design Decision Log

| Decision | Chosen | Rejected | Rationale |
|----------|--------|----------|-----------|
| Context passing mechanism | `navigate(path, { state })` | URL params, sessionStorage, React Context | Ephemeral by nature (one-time use), no URL pollution, no cleanup needed. |
| Where FormNavigationCard renders | Inside chat stream (same slot as AIAnswerCard) | As a modal/dialog, as a toast notification | Consistent with the chat paradigm. The AI "says" something and shows a card. |
| Multiple forms display | Vertical list with "Best match" badge | Horizontal carousel, tabs, dropdown | Vertical list is mobile-friendly and scannable. Badge resolves ambiguity visually. |
| Pre-fill trigger timing | After template loads + draft created (300ms delay) | Immediately on mount, on user click | Need template for AI tools check. Need draft for auto-save. Delay for panel animation. |
| Pre-fill context cleanup | `window.history.replaceState` | `navigate(pathname, { replace: true, state: null })`, manual ref | `replaceState` is the most direct -- clears state without triggering React re-render. |
| Back button from form | Goes to `/forms` (not `/ask`) | Goes back to `/ask` via `navigate(-1)` | The form page's back button says "Back to Forms" -- consistent with existing behavior. Changing it based on navigation source would add complexity. |
| Auto-apply vs review-then-apply | Auto-apply (same as Phase 3 existing behavior) | Show toggles for pre-fill context | The pre-fill context is the user's own words -- they just said it. Auto-apply is appropriate. The undo toast is still available. |
| Dismiss form suggestion | Clear `formNavResult`, stay in chat | Navigate back, show different view | Simplest UX. User can type a new question. |

---

## IV.12. Verification Plan

### IV.12.1 Frontend Tests

| # | Test | Action | Expected |
|---|------|--------|----------|
| 1 | Form intent detected | Type "I need to fill out an injury report" in `/ask` | `FormNavigationCard` appears with Employee Injury Report |
| 2 | Single form match | Type "injury report" | Card shows one form with "Fill this form" button |
| 3 | Multiple form match | Type "write something up" | Card shows 2+ forms with "Best match" badge on highest score |
| 4 | No form match | Type "tax filing form" | Normal `AIAnswerCard` response, no `FormNavigationCard` |
| 5 | Navigate to form | Click "Fill this form" | Page transitions to `/forms/employee-injury-report` |
| 6 | Pre-fill context arrives | After navigation | AI panel auto-opens with pre-fill context as first message |
| 7 | Fields auto-extracted | After AI responds | Fields populated in the form with green highlight glow |
| 8 | Follow-up question | After initial extraction | AI asks about missing fields in the panel |
| 9 | Dismiss suggestion | Click "Not what I need" | Card clears, user can type new question |
| 10 | Mobile flow | Tap "Fill this form" (< 1024px) | Page navigates, FormAIDrawer auto-opens |
| 11 | Desktop flow | Click "Fill this form" (>= 1024px) | Page navigates, DockedFormAIPanel auto-opens |
| 12 | Refresh after pre-fill | Navigate from chat, then refresh page | Form loads normally, no auto-open, draft preserved |
| 13 | Back button | Click back arrow in FormHeader | Navigates to `/forms`, not `/ask` |
| 14 | No AI tools form | Navigate with pre-fill to form with empty ai_tools | Form loads normally, no AI panel, no error |
| 15 | Spanish language | Set language to ES, type "llenar reporte de lesion" | Spanish form suggestion card, Spanish form page |
| 16 | Keyboard navigation | Tab through FormNavigationCard | Focus moves through cards and buttons, Enter/Space activates |

### IV.12.2 Integration Scenarios

| # | Scenario | Steps | Expected |
|---|----------|-------|----------|
| 1 | Full injury report from chat | 1. Go to `/ask`. 2. Type "John Smith cut his hand on slicer at 3pm". 3. Click "Fill this form" on Employee Injury Report. 4. Review auto-filled fields. 5. Answer follow-up. 6. Submit. | Form submitted with AI-extracted fields + manual completions. |
| 2 | Write-up from chat | 1. Go to `/ask`. 2. Type "Write up John for being late 3 times". 3. Navigate to Employee Write-Up. 4. Review fields. | Employee name, violation type, and description extracted. |
| 3 | Ambiguous then specific | 1. Type "I need a form". 2. Dismiss suggestion. 3. Type "injury report". 4. Navigate. | First attempt shows options, dismiss works, second attempt succeeds. |

---

*This is the UX/UI Design Specification for Phase 4: Main AI Chat Integration. It covers the full user journey from typing a form-related question in the `/ask` chat to landing on a form page with AI-extracted fields pre-filled. All modifications are minimal and leverage existing patterns from the Phase 3 form AI system, the `FormCard` visual design, and the `AppShell` layout infrastructure.*
