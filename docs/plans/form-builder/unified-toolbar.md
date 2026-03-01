# Unified Floating Toolbar & Clear Button Fix

## Problems

### 1. Clear button doesn't work
`clearDisabled={!isDirty}` is the wrong check. After AI fills fields, auto-save fires (3s debounce), which sets `isDirty=false`. The clear button becomes disabled even though the form has content. Fix: check whether any field has a value, not whether the form is "dirty".

### 2. Floating bar is too minimal
The current `FormFloatingMicBar` only shows "Tap to speak" + mic. Meanwhile `FormFooter` is a separate sticky bar. Two bars stacked at the bottom is cluttered and wastes space.

### 3. No Form/Chat toggle on mobile
With the drawer removed, there's no way for mobile users to see the AI conversation or type to the AI. Need a mode toggle.

## Solution

Merge `FormFloatingMicBar` + `FormFooter` into one **unified floating toolbar**:

```
┌──────────────────────────────────────────────────────────┐
│  ( MIC )   [ Form ▪ Chat ]     💾    [ Submit ]         │
└──────────────────────────────────────────────────────────┘
```

- **MIC**: Orange circle, starts hero recording. Shows red + stop icon when recording.
- **Form / Chat**: Segmented toggle. "Form" shows the form fields (default). "Chat" shows the AI conversation inline (replaces the form body, no drawer).
- **Save icon**: Small icon button (disk icon). Saves draft. Shows spinner when saving, check when saved.
- **Submit**: Primary button. Opens confirmation dialog.

On desktop (>= 1024px), the docked AI panel still exists so the Chat toggle just opens/closes it. On mobile, it swaps the visible content between form fields and an inline AI chat view.

---

## Visual Layout

### Desktop

```
 ┌───────────────────────────────────────────┬───────────────────┐
 │  Employee Injury Report      [Clear] Saved│  AI Assistant  X  │
 │  ═══════════ 83% ════════════             │                   │
 │                                           │  (conversation)   │
 │  INJURED EMPLOYEE                         │                   │
 │  [Name]  [Position]                       │                   │
 │  ...                                      │  ┌─────────────┐  │
 │                                           │  │ input bar    │  │
 │ ┌───────────────────────────────────────┐ │  └─────────────┘  │
 │ │ (mic)  [Form ▪ Chat]    💾  [Submit] │ │                   │
 │ └───────────────────────────────────────┘ │                   │
 └───────────────────────────────────────────┴───────────────────┘
```

Desktop: Form/Chat toggle opens/closes the docked panel. "Form" = panel closed, "Chat" = panel open.

### Mobile

**Form mode (default):**
```
 ┌──────────────────────────────────┐
 │  [<]                      EN ES  │
 ├──────────────────────────────────┤
 │  Employee Injury Report          │
 │      [Clear] Saved               │
 │  ═══════════ 83% ════════════    │
 │                                  │
 │  INJURED EMPLOYEE                │
 │  [Name]  [Position]              │
 │  ...                             │
 │                                  │
 │ ┌──────────────────────────────┐ │
 │ │(mic) [Form ▪ Chat]  💾 [Sub]│ │  ← unified toolbar
 │ └──────────────────────────────┘ │
 └──────────────────────────────────┘
```

**Chat mode (tapped "Chat"):**
```
 ┌──────────────────────────────────┐
 │  [<]                      EN ES  │
 ├──────────────────────────────────┤
 │  Employee Injury Report          │
 │      [Clear] Saved               │
 │                                  │
 │  (AI conversation)               │
 │  ┌─────────────────────────┐     │
 │  │ Extracted fields card   │     │
 │  └─────────────────────────┘     │
 │  ┌─────────────────────────┐     │
 │  │ input bar (text/attach) │     │
 │  └─────────────────────────┘     │
 │                                  │
 │ ┌──────────────────────────────┐ │
 │ │(mic) [Form ▪ Chat]  💾 [Sub]│ │
 │ └──────────────────────────────┘ │
 └──────────────────────────────────┘
```

---

## Data Flow

```
FormDetail.tsx
  │
  ├── AppShell (headerLeft = back button)
  │
  ├── FormHeader (title + clear + save indicator)
  │
  ├── viewMode state: 'form' | 'chat'
  │     form → FormBody (fields)
  │     chat → FormAIContent (inline, full-height, replaces body)
  │
  ├── FormToolbar (NEW — unified floating bar)
  │     ├── MIC button (hero recording)
  │     ├── Form/Chat toggle
  │     ├── Save icon
  │     └── Submit button
  │
  └── Desktop: DockedFormAIPanel (unchanged, controlled by viewMode toggle)
```

---

## Implementation Steps

### Step 1: Fix clear button — `FormDetail.tsx`

Change `clearDisabled` from `!isDirty` to a content check:

```tsx
// Helper: true if any field has a non-empty value
const hasFieldContent = Object.values(fieldValues).some(
  (v) => v !== undefined && v !== null && v !== '',
);

<FormHeader
  ...
  clearDisabled={!hasFieldContent}
/>
```

Also fix the typo in `handleConfirmClear` — it currently calls `setShowConfirmDialog(false)` instead of `setShowClearDialog(false)`. (Bug from copy-paste of the submit dialog handler.)

### Step 2: Create `FormToolbar.tsx`

**New file**: `src/components/forms/FormToolbar.tsx`

Replaces both `FormFloatingMicBar` and `FormFooter`.

**Props:**
```ts
interface FormToolbarProps {
  language: 'en' | 'es';
  // Voice
  isRecording: boolean;
  isTranscribing: boolean;
  audioLevel: number;
  elapsedSeconds: number;
  isWarning: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  // Mode toggle
  viewMode: 'form' | 'chat';
  onViewModeChange: (mode: 'form' | 'chat') => void;
  // Save/Submit
  isDirty: boolean;
  isSaving: boolean;
  isSubmitting: boolean;
  canSubmit: boolean;
  onSaveDraft: () => void;
  onSubmit: () => void;
}
```

**Layout:**
```
┌─────────────────────────────────────────────────┐
│  (mic)   [ Form | Chat ]          💾   [Submit] │
└─────────────────────────────────────────────────┘
```

- **Container**: Same frosted-glass as current footer positioning.
  - Mobile: `fixed bottom-[72px] left-0 right-0 z-20` (above MobileTabBar)
  - Desktop: `sticky bottom-4 z-[25]` (inside scroll area)
  - Shared: `bg-muted/90 backdrop-blur-md rounded-2xl shadow-[0_2px_16px_rgba(0,0,0,0.15)]`
  - `mx-3 md:mx-0` for mobile edge padding
  - `flex items-center gap-2 px-3 py-2`

- **MIC button**: Reuse `FormHeroMicButton` but always use the smaller size (`h-10 w-10`). Pass `hasHistory={true}` to force compact. When recording, shows red + stop + audio ring. Timer badge appears next to it.

- **Form/Chat toggle**: Segmented control, 2 buttons in a `rounded-lg bg-background/60` pill.
  - Each button: `px-3 py-1.5 text-xs font-semibold rounded-md`
  - Active: `bg-orange-500 text-white shadow-sm`
  - Inactive: `text-muted-foreground hover:text-foreground`
  - Labels: "Form" / "Chat" (EN), "Form" / "Chat" (ES — same words work)

- **Save icon**: Small ghost button (`h-9 w-9 rounded-lg`)
  - Idle + dirty: `Save` (lucide) icon, `text-muted-foreground hover:text-foreground`
  - Saving: `Loader2` spinner
  - Saved (not dirty): `Check` icon, `text-green-500`
  - Disabled when `!isDirty || isSaving || isSubmitting`

- **Submit button**: Compact primary button
  - `h-9 px-4 rounded-lg bg-primary text-primary-foreground font-semibold text-sm`
  - Label: "Submit" / "Enviar"
  - Shows `Loader2` spinner when `isSubmitting`
  - Disabled when `!canSubmit || isSaving || isSubmitting`

### Step 3: Add `viewMode` state to `FormDetail.tsx`

```ts
const [viewMode, setViewMode] = useState<'form' | 'chat'>('form');
```

**Desktop behavior**: Toggle controls `aiPanelOpen`.
```ts
const handleViewModeChange = useCallback((mode: 'form' | 'chat') => {
  setViewMode(mode);
  if (isDesktop) {
    setAiPanelOpen(mode === 'chat');
  }
}, [isDesktop]);

// Sync: when desktop panel is closed via X button, switch back to 'form'
useEffect(() => {
  if (isDesktop && !aiPanelOpen && viewMode === 'chat') {
    setViewMode('form');
  }
}, [isDesktop, aiPanelOpen, viewMode]);
```

**Mobile behavior**: Toggle swaps visible content.
```tsx
{/* Content area — form fields or AI chat based on viewMode */}
{(isDesktop || viewMode === 'form') && (
  <>
    <div className="pt-4 pb-2">
      <FormProgressBar ... />
    </div>
    <div className="pt-2">
      <FormBody ... />
    </div>
  </>
)}

{!isDesktop && viewMode === 'chat' && (
  <FormAIContent
    askForm={aiWithCurrentValues.askForm}
    conversationHistory={aiWithCurrentValues.conversationHistory}
    isLoading={aiWithCurrentValues.isLoading}
    error={aiWithCurrentValues.error}
    onClear={aiWithCurrentValues.clearConversation}
    language={language}
    template={template}
    className="flex-1 min-h-[400px]"
    voiceState={voiceRecording}
    onStartHeroRecording={startHeroRecording}
    onStartInputBarRecording={startInputBarRecording}
    onStopRecording={stopRecording}
    onCancelRecording={cancelRecording}
    onRegisterTranscriptionCallback={registerInputBarTranscription}
  />
)}
```

### Step 4: Replace `FormFooter` + `FormFloatingMicBar` with `FormToolbar`

In `FormDetail.tsx`:
- Remove `import { FormFooter }`
- Remove `import { FormFloatingMicBar }`
- Remove `<FormFooter ... />` render
- Remove `<FormFloatingMicBar ... />` render
- Add `import { FormToolbar }`
- Render `<FormToolbar>` after the content area (form body / chat):

```tsx
<FormToolbar
  language={language}
  isRecording={voiceRecording.isRecording}
  isTranscribing={voiceRecording.isTranscribing}
  audioLevel={voiceRecording.audioLevel}
  elapsedSeconds={voiceRecording.elapsedSeconds}
  isWarning={voiceRecording.isWarning}
  onStartRecording={startHeroRecording}
  onStopRecording={stopRecording}
  viewMode={viewMode}
  onViewModeChange={handleViewModeChange}
  isDirty={isDirty}
  isSaving={isSaving}
  isSubmitting={isSubmitting}
  canSubmit={canSubmit}
  onSaveDraft={handleSaveDraft}
  onSubmit={handleSubmitRequest}
/>
```

### Step 5: Auto-switch to Chat on hero mic transcription (mobile)

When the hero mic finishes and AI responds, automatically flip to Chat so the user sees the result:

```ts
onTranscription: (text) => {
  if (heroRecordingRef.current) {
    heroRecordingRef.current = false;
    if (isDesktopRef.current) {
      setAiPanelOpen(true);
    }
    // On mobile, switch to chat view to show AI response
    setViewMode('chat');
    aiWithCurrentValues.askForm(text);
  } else {
    inputBarTranscriptionRef.current?.(text);
  }
},
```

### Step 6: Clean up

- Delete `FormFloatingMicBar.tsx` (replaced by FormToolbar)
- Delete `FormFooter.tsx` (replaced by FormToolbar)
- Remove `FormFooterProps` from `src/types/forms.ts` (if only used by FormFooter)
- Remove the `h-32 md:h-0` bottom spacer div (no longer needed with the new fixed toolbar)

### Step 7: Verify

```bash
npx tsc --noEmit
```

**Manual tests:**
- Clear button works even after auto-save
- Mic → record → stop → auto-switches to Chat → AI fills fields
- Tap "Form" → see filled fields with highlights
- Save icon shows check/spinner/idle states correctly
- Submit opens confirmation dialog
- Desktop: "Chat" opens docked panel, "Form" closes it
- Mobile: "Chat" shows inline AI conversation, "Form" shows fields

---

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `src/components/forms/FormToolbar.tsx` | **CREATE** | Unified toolbar: mic + mode toggle + save + submit |
| `src/pages/FormDetail.tsx` | **MODIFY** | Fix clear, add viewMode, replace footer+micbar with toolbar, mobile chat view |
| `src/components/forms/FormFloatingMicBar.tsx` | **DELETE** | Replaced by FormToolbar |
| `src/components/forms/FormFooter.tsx` | **DELETE** | Replaced by FormToolbar |
| `src/types/forms.ts` | **MODIFY** | Remove FormFooterProps (if unused elsewhere) |

## What Gets Reused

- `FormHeroMicButton.tsx` — rendered inside toolbar (compact size)
- `FormAIContent.tsx` — rendered inline on mobile when viewMode='chat'
- `DockedFormAIPanel.tsx` — desktop panel, toggled by viewMode
- `FormHeader.tsx` — unchanged (just fix clearDisabled in parent)
