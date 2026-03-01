# Floating Mic Bar, Header Cleanup, Drawer Removal & Back Button Move

## Problem

After the Hero Mic Button implementation, there are two redundant orange mic buttons:
1. **Header mic** (top-right of form) — prominent but blocks the user's view of the form when recording
2. **Empty-state mic** (inside the AI panel) — only visible when panel is open and has no history

On mobile, the AI drawer pops up from below covering the form — the opposite of what we want. The user should be able to **see the form while speaking**.

The back button is also redundant — it's inside `FormHeader` (the content area) when it should live in the **top navigation bar** like other detail pages (DishGuide, Recipes) that use `AppShell`'s `headerLeft` prop.

## Solution

### 1. Move back button from `FormHeader` to `AppShell`'s top nav bar (via `headerLeft`)
### 2. Remove header mic, add "Clear Form" button in `FormHeader`
### 3. Add a floating bar at the bottom of the form area with the orange mic button
### 4. Remove the mobile AI drawer entirely

On mobile, AI results are applied silently — fields highlight + toast with undo. No drawer, no chat UI. Just: speak → fields fill. The docked panel on desktop (>= 1024px) stays as-is for full chat/text/attachment workflows.

---

## Visual Layout

### Desktop (>= 1024px)

```
 ┌─[<]────────────────────────────────────────────────── EN ES ────┐
 │  AppShell top nav bar (back button in headerLeft)               │
 ├────────────────────────────────────────────┬────────────────────┤
 │  Employee Injury Report    [Clear]  Saved  │  AI Assistant   X  │
 │  ════════════════════ 83% ════════════════  │                    │
 │                                            │  (conversation)    │
 │  INJURED EMPLOYEE                          │                    │
 │  [Employee Name]  [Position]               │                    │
 │                                            │                    │
 │  INCIDENT DETAILS                          │                    │
 │  [Date]  [Time]                            │                    │
 │  ...                                       │  ┌──────────────┐  │
 │                                            │  │ input bar     │  │
 │  ┌─────────────────────────────────────┐   │  └──────────────┘  │
 │  │  "Tap to speak"    [timer]  ( mic ) │   │                    │
 │  └─────────────────────────────────────┘   │                    │
 │  [Save Draft]  [Submit]                    │                    │
 └────────────────────────────────────────────┴────────────────────┘
```

### Mobile (< 1024px) — NO drawer, just floating mic + form

```
 ┌──────────────────────────────────┐
 │  [<]                      EN ES  │  ← AppShell top nav (back in headerLeft)
 ├──────────────────────────────────┤
 │  Employee Injury Report          │  ← FormHeader (title + clear + save)
 │      [Clear] Saved               │
 │  ═══════════ 83% ════════════    │
 │                                  │
 │  INJURED EMPLOYEE                │
 │  ├ Employee Name ─── Pedro ✨ ──│  ← field highlights after AI fill
 │  ├ Position ──────── Line Cook ──│
 │  ...                             │
 │                                  │
 │  ┌────────────────────────────┐  │
 │  │ "Tap to speak" [tmr] (mic)│  │  ← floating bar (always visible)
 │  └────────────────────────────┘  │
 │  ┌────────────────────────────┐  │
 │  │ [Save Draft]   [Submit]    │  │  ← sticky footer
 │  └────────────────────────────┘  │
 └──────────────────────────────────┘
```

Mobile flow: tap mic → speak while viewing form → stop → fields fill with highlight animation + "3 fields filled (Undo)" toast. Done.

---

## Data Flow

```
FormDetail.tsx (owns useVoiceRecording + heroRecordingRef)
  │
  ├── AppShell (headerLeft = back button)
  │
  ├── FormHeader (title + clear + save — NO back button, NO mic)
  │
  ├── FormFloatingMicBar ← taps startHeroRecording()
  │
  ├── Auto-apply useEffect  ← LIFTED from FormAIContent (runs always)
  │
  └── Desktop only: DockedFormAIPanel
        └── FormAIContent
              ├── Empty state: large mic ← taps startHeroRecording()
              └── Input bar: small mic   ← taps startInputBarRecording()

onTranscription callback:
  heroRef=true  → askForm(text), only open panel on desktop
  heroRef=false → inject text into textarea (desktop panel only)
```

Key changes:
- Back button moves to AppShell navbar (consistent with DishGuide/Recipes)
- Auto-apply logic moves to `FormDetail` so it works without panel mounted
- No drawer on mobile

---

## Implementation Steps

### Step 1: Create `FormFloatingMicBar.tsx`

**New file**: `src/components/forms/FormFloatingMicBar.tsx`

A frosted-glass pill that floats at the bottom of the form scroll area (above the footer). Contains a label on the left and the `FormHeroMicButton` on the right.

**Props:**
```ts
interface FormFloatingMicBarProps {
  language: 'en' | 'es';
  isRecording: boolean;
  isTranscribing: boolean;
  audioLevel: number;
  elapsedSeconds: number;
  isWarning: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  hasHistory: boolean;
  disabled?: boolean;
}
```

**Visual states:**
- **Idle**: Pill with "Tap to speak" / "Toca para hablar" label + orange mic `h-10 w-10` on right
- **Recording**: Label changes to "Recording..." / "Grabando...", timer badge appears, mic turns red with audio-level ring, stop icon
- **Transcribing**: Label changes to "Transcribing..." / "Transcribiendo...", mic shows spinner

**Styling** (matches ingest `MobileModeTabs` pattern):
```
sticky bottom-[140px] md:bottom-4 z-[25]
mx-auto w-fit
px-4 py-2
bg-muted/90 backdrop-blur-md
rounded-2xl
shadow-[0_2px_16px_rgba(0,0,0,0.15)]
```

Mobile `bottom-[140px]` positions it above the fixed footer (`bottom-[72px]` + footer height ~68px). Desktop uses `md:bottom-4` since footer is relative.

**Reuses** `FormHeroMicButton` component (already built) — renders it inside the pill alongside the label text.

### Step 2: Move back button to AppShell navbar

**Pattern**: Same as `DishGuide.tsx` and `Recipes.tsx` — pass an orange `ArrowLeft` button via AppShell's `headerLeft` prop.

**In `FormDetail.tsx`:**
```tsx
const headerLeft = (
  <button
    onClick={handleBack}
    className="flex items-center justify-center shrink-0 h-9 w-9 rounded-lg bg-orange-500 text-white hover:bg-orange-600 active:scale-[0.96] shadow-sm transition-all duration-150"
    title={language === 'es' ? 'Volver a formularios' : 'Back to forms'}
  >
    <ArrowLeft className="h-4 w-4" />
  </button>
);

<AppShell
  language={language}
  onLanguageChange={setLanguage}
  showSearch={false}
  aiPanel={desktopAIPanel}
  headerLeft={headerLeft}    // ← NEW
>
```

This places the back button in the top-left of the global nav bar, consistent with every other detail page.

### Step 3: Update `FormHeader.tsx` — Remove back button & mic, add Clear Form

**Remove:**
- `ArrowLeft` import
- `onBack` prop and the back button element
- All mic-related props (`showMic`, `isRecording`, `isTranscribing`, `audioLevel`, `elapsedSeconds`, `isWarning`, `onStartRecording`, `onStopRecording`, `hasHistory`)
- `FormHeroMicButton` import

**Add:**
- `RotateCcw` import from lucide
- `onClear?: () => void` prop
- `clearDisabled?: boolean` prop

**New props interface:**
```ts
interface FormHeaderProps {
  template: FormTemplate;
  language: 'en' | 'es';
  isSaving: boolean;
  lastSavedAt: Date | null;
  onClear?: () => void;
  clearDisabled?: boolean;
}
```

**New layout** (no back button — it's in the navbar now):
```
[Title (flex-1)]  [Clear icon button]  [Save indicator]
```

**Clear button design:**
- Ghost variant, icon-only button (`h-8 w-8`)
- `RotateCcw` icon, `h-4 w-4`
- aria-label: "Clear Form" / "Limpiar Formulario"
- Only shown when `onClear` is provided
- Disabled when `clearDisabled` is true (nothing to clear)

### Step 4: Lift auto-apply logic to `FormDetail.tsx`

Currently, `FormAIContent` has a `useEffect` that watches `conversationHistory` and calls `onApplyFields` for each new assistant turn with field updates. This must run even when no AI panel is mounted (i.e., on mobile).

**Move to `FormDetail`:**
```ts
// Track how many conversation turns we have already auto-applied
const appliedCountRef = useRef(0);

// Auto-apply extracted fields as soon as a new assistant turn arrives
useEffect(() => {
  const history = aiWithCurrentValues.conversationHistory;
  const total = history.length;
  if (total <= appliedCountRef.current) return;

  for (let i = appliedCountRef.current; i < total; i++) {
    const turn = history[i];
    if (
      turn.role === 'assistant' &&
      turn.result &&
      Object.keys(turn.result.fieldUpdates).length > 0
    ) {
      handleApplyAIUpdates(turn.result.fieldUpdates);
    }
  }
  appliedCountRef.current = total;
}, [aiWithCurrentValues.conversationHistory, handleApplyAIUpdates]);

// Reset applied count when conversation is cleared
useEffect(() => {
  if (aiWithCurrentValues.conversationHistory.length === 0) {
    appliedCountRef.current = 0;
  }
}, [aiWithCurrentValues.conversationHistory.length]);
```

**Remove from `FormAIContent`:** Delete the `appliedCountRef`, the auto-apply `useEffect`, and the reset `useEffect`. Remove the `onApplyFields` prop entirely.

**Update `DockedFormAIPanel` props** — remove `onApplyFields` and stop forwarding it.

### Step 5: Remove `FormAIDrawer` and all mobile drawer wiring

**A. Delete file:**
```
src/components/forms/FormAIDrawer.tsx → DELETE
```

**B. In `FormDetail.tsx`, remove:**
- `import { FormAIDrawer }` line
- The entire `{!isDesktop && <FormAIDrawer ... />}` block
- `aiPanelOpen` state stays (desktop still uses it), but no auto-open on mobile

**C. Update `onTranscription` callback** — don't open panel on mobile:
```ts
onTranscription: (text) => {
  if (heroRecordingRef.current) {
    heroRecordingRef.current = false;
    // Only open panel on desktop (mobile has no panel to open)
    if (isDesktopRef.current) {
      setAiPanelOpen(true);
    }
    aiWithCurrentValues.askForm(text);
  } else {
    inputBarTranscriptionRef.current?.(text);
  }
},
```

Add a ref to avoid stale closure:
```ts
const isDesktopRef = useRef(isDesktop);
isDesktopRef.current = isDesktop;
```

### Step 6: Wire up Clear Form in `FormDetail.tsx`

**A. Destructure `reset` from `useFormSubmission`:**
```ts
const { ..., reset } = useFormSubmission({ template, aiSessionId: aiSessionIdRef.current });
```

**B. Create `handleClearForm` with confirmation:**
```ts
const [showClearDialog, setShowClearDialog] = useState(false);

const handleClearForm = useCallback(() => {
  setShowClearDialog(true);
}, []);

const handleConfirmClear = useCallback(() => {
  setShowClearDialog(false);
  reset();
  aiWithCurrentValues.clearConversation();
  appliedCountRef.current = 0;
}, [reset, aiWithCurrentValues]);
```

**C. Update FormHeader render:**
```tsx
<FormHeader
  template={template}
  language={language}
  isSaving={isSaving}
  lastSavedAt={lastSavedAt}
  onClear={handleClearForm}
  clearDisabled={!isDirty}
/>
```

**D. Add `FormFloatingMicBar` to the render** (after FormBody, before FormFooter):
```tsx
{hasAiTools && !aiDisabled && (
  <FormFloatingMicBar
    language={language}
    isRecording={voiceRecording.isRecording}
    isTranscribing={voiceRecording.isTranscribing}
    audioLevel={voiceRecording.audioLevel}
    elapsedSeconds={voiceRecording.elapsedSeconds}
    isWarning={voiceRecording.isWarning}
    onStartRecording={startHeroRecording}
    onStopRecording={stopRecording}
    hasHistory={aiWithCurrentValues.conversationHistory.length > 0}
  />
)}
```

**E. Add Clear Form confirmation dialog** (reuse existing AlertDialog pattern):
```tsx
<AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>{t.clearConfirmTitle}</AlertDialogTitle>
      <AlertDialogDescription>{t.clearConfirmDescription}</AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>{t.clearConfirmCancel}</AlertDialogCancel>
      <AlertDialogAction onClick={handleConfirmClear} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
        {t.clearConfirmClear}
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

**F. Add bilingual strings:**
```ts
// EN:
clearConfirmTitle: 'Clear Form?',
clearConfirmDescription: 'This will erase all fields and AI conversation. This cannot be undone.',
clearConfirmCancel: 'Cancel',
clearConfirmClear: 'Clear',
// ES:
clearConfirmTitle: 'Limpiar Formulario?',
clearConfirmDescription: 'Esto borrara todos los campos y la conversacion de IA. No se puede deshacer.',
clearConfirmCancel: 'Cancelar',
clearConfirmClear: 'Limpiar',
```

### Step 7: Clean up `FormAIContent` and `DockedFormAIPanel`

**FormAIContent:**
- Remove `onApplyFields` from props interface and destructuring
- Remove `appliedCountRef`, auto-apply `useEffect`, and reset `useEffect`

**DockedFormAIPanel:**
- Remove `onApplyFields` from props interface and destructuring
- Remove `onApplyFields={onApplyFields}` from `<FormAIContent>` render

### Step 8: Verify

```bash
npx tsc --noEmit
```

**Manual tests:**
- **Back button**: Visible in AppShell top nav bar (top-left), same style as DishGuide/Recipes. Navigates to `/forms`.
- **Mobile**: Floating mic bar visible above footer. Tap → record → stop → fields fill with highlight + toast. No drawer appears. Form stays visible throughout.
- **Desktop**: Floating mic bar visible above footer. Docked AI panel still works with text input, attachments, input-bar mic.
- **Clear button**: FormHeader shows RotateCcw icon → tap → confirmation dialog → fields + conversation reset.
- **Escape**: Cancels recording (from desktop panel escape handler).
- **Auto-apply**: Works on both desktop and mobile since logic is now in FormDetail.

---

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `src/components/forms/FormFloatingMicBar.tsx` | **CREATE** | Frosted-glass pill with label + FormHeroMicButton |
| `src/components/forms/FormHeader.tsx` | **MODIFY** | Remove back button + mic props, add Clear Form button |
| `src/pages/FormDetail.tsx` | **MODIFY** | Move back button to headerLeft, lift auto-apply, wire clear, add floating bar, remove drawer, add dialog |
| `src/components/forms/FormAIContent.tsx` | **MODIFY** | Remove auto-apply logic + onApplyFields prop |
| `src/components/forms/DockedFormAIPanel.tsx` | **MODIFY** | Remove onApplyFields prop |
| `src/components/forms/FormAIDrawer.tsx` | **DELETE** | No longer needed |

## What Gets Reused (no changes)

- `FormHeroMicButton.tsx` — rendered inside the floating bar (as-is)
- `AppShell.tsx` — `headerLeft` prop already exists, no changes needed
- `Header.tsx` — `leftContent` slot already exists, no changes needed
- `useVoiceRecording` hook — used as-is from FormDetail
- `useFormSubmission.reset()` — already exists, just needs wiring
- `showAIFillToast` — already handles the highlight + undo toast on mobile

## What Gets Removed

- `FormAIDrawer.tsx` — deleted entirely
- `FormHeader` back button (moved to AppShell navbar)
- `FormHeader` mic-related props (10 props removed)
- `FormAIContent` auto-apply logic (moved to FormDetail)
- `onApplyFields` prop from FormAIContent and DockedFormAIPanel
