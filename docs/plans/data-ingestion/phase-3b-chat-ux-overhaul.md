# Phase 3B: Chat UX Overhaul — Inline File/Image Upload

**Plan Date:** 2026-02-19
**Status:** Not Started
**Depends On:** Phase 3 (complete)

---

## Goal

Remove the separate method-selection wizard step and integrate file/image upload directly into the chat input bar via a "+" button with a popover submenu (GPT/Claude pattern). This makes the chat the single entry point for all ingestion methods.

---

## What's Changing

### 1. IngestWizard — Remove Step 2 (Method Selection)

**File:** `src/pages/IngestWizard.tsx`

**Current flow:** Step 1 (pick product type) → Step 2 (pick method: Chat / Upload File / Take Photo) → create session → navigate to IngestPage

**New flow:** Step 1 (pick product type) → click "Start" → create session → navigate to IngestPage

**Changes:**
- Remove `step` state entirely (no more `useState<1 | 2>(1)`)
- Remove `selectedMethod` state
- Remove `handleNext`, `handleBack` functions
- Remove the entire Step 2 JSX block (lines 237–334)
- Change `handleCreateSession` to no longer require `selectedMethod` — always creates a `'chat'` session
- Rename the "Next" button to "Start" and wire it directly to `handleCreateSession`
- Remove unused imports: `ArrowRight`, `ArrowLeft`, `Loader2`, `MessageSquare`, `Upload`, `Camera`
- Remove `MethodCard` interface and `METHOD_CARDS` constant
- Remove `IngestionMethod` import (no longer needed here)
- Keep `isCreating` state for the loading spinner on the "Start" button

**Button change:**
```tsx
// BEFORE: "Next" → goes to Step 2
<Button onClick={handleNext} disabled={!selectedType}>
  Next <ArrowRight />
</Button>

// AFTER: "Start" → creates session directly
<Button onClick={handleCreateSession} disabled={!selectedType || isCreating}>
  {isCreating ? <><Loader2 className="animate-spin" /> Creating...</> : 'Start'}
</Button>
```

### 2. ChatIngestionPanel — Redesigned Empty State

**File:** `src/components/ingest/ChatIngestionPanel.tsx`

**Current empty state (lines 194–201):** Plain Bot icon + "Describe your recipe" + generic text

**New empty state:** Three visually distinct suggestion cards that clearly communicate all three input methods:

```
┌──────────────────────────────────────┐
│                                      │
│           🤖 (Bot icon)              │
│     AI Recipe Builder                │
│                                      │
│  ┌──────────────────────────────┐    │
│  │ 💬  Describe your recipe     │    │
│  │  Type ingredients, steps...  │    │
│  └──────────────────────────────┘    │
│  ┌──────────────────────────────┐    │
│  │ 📎  Upload a file            │    │
│  │  PDF, Word, or text file     │    │
│  └──────────────────────────────┘    │
│  ┌──────────────────────────────┐    │
│  │ 📷  Take a photo             │    │
│  │  Snap a recipe card or menu  │    │
│  └──────────────────────────────┘    │
│                                      │
└──────────────────────────────────────┘
```

- Each card is a clickable `button` element
- "Describe your recipe" card → focuses the text input
- "Upload a file" card → triggers the hidden file input (same as "+" > Upload)
- "Take a photo" card → triggers the hidden image input (same as "+" > Photo)
- Cards use muted colors, subtle borders, and hover states to feel intentional (not an afterthought)

**New props needed on ChatIngestionPanel:**
```typescript
interface ChatIngestionPanelProps {
  messages: ChatMessage[];
  onSendMessage: (content: string) => void;
  onEditDraft: (draft: PrepRecipeDraft) => void;
  onConfirmDraft: (draft: PrepRecipeDraft) => void;
  isProcessing?: boolean;
  className?: string;
  // NEW — for inline file/image upload
  onFileSelected?: (file: File) => void;
  onImageSelected?: (file: File) => void;
  isUploading?: boolean;
}
```

### 3. ChatIngestionPanel — "+" Button with Popover Submenu

**File:** `src/components/ingest/ChatIngestionPanel.tsx`

**Current input bar:** `[Input] [Send]`

**New input bar:** `[+] [Input] [Send]`

The "+" button opens a `Popover` (from shadcn/ui) with two options:
- **Upload File** — icon: `Upload` — triggers a hidden `<input type="file" accept=".pdf,.docx,.txt">`
- **Take Photo** — icon: `Camera` — triggers a hidden `<input type="file" accept="image/*" capture="environment">`

**Layout:**
```
┌─────────────────────────────────────────┐
│ [+]  [ Describe your recipe...  ] [→]  │
└─────────────────────────────────────────┘
       ↑
  ┌────────────────────┐
  │ 📎 Upload File     │
  │ 📷 Take Photo      │
  └────────────────────┘
```

**Implementation details:**
- The "+" button is a `Button` with `variant="ghost"` and `size="icon"` containing a `Plus` icon (from lucide-react)
- It wraps a `PopoverTrigger` inside a `Popover`
- Each menu item is a `button` with an icon + label
- Clicking a menu item closes the popover and triggers the corresponding hidden `<input>`
- Two hidden `<input>` elements live inside the component:
  - `fileInputRef` — `<input type="file" accept=".pdf,.docx,.doc,.txt" />`
  - `imageInputRef` — `<input type="file" accept="image/*" capture="environment" />`
- When a file is selected via either input, call `onFileSelected(file)` or `onImageSelected(file)`
- The "+" button is disabled while `isProcessing` or `isUploading`
- When `isUploading` is true, show a small uploading indicator in the input bar area

**Upload in-progress state:**
When a file/image is being processed (`isUploading === true`), show a small inline banner above the input bar:
```
┌─────────────────────────────────────────┐
│ ⏳ Processing chimichurri.pdf...        │
├─────────────────────────────────────────┤
│ [+]  [ Describe your recipe...  ] [→]  │
└─────────────────────────────────────────┘
```
This uses a new optional prop `uploadingFileName?: string` to display the file name.

### 4. IngestPage — Wire Upload Handlers to ChatIngestionPanel

**File:** `src/pages/IngestPage.tsx`

**Changes:**
- Import and instantiate `useFileUpload` and `useImageUpload` hooks
- Create `handleFileSelected` callback:
  - Calls `uploadFile(file, state.sessionId)` from the hook
  - On success, calls the existing `handleFileProcessed` with the result
- Create `handleImageSelected` callback:
  - Calls `uploadImage(file, state.sessionId)` from the hook
  - On success, calls the existing `handleImageProcessed` with the result
- Pass new props to both `ChatIngestionPanel` instances (mobile chatContent + desktop aiPanel):
  - `onFileSelected={handleFileSelected}`
  - `onImageSelected={handleImageSelected}`
  - `isUploading={fileUpload.isUploading || imageUpload.isUploading}`

**The existing `handleFileProcessed` and `handleImageProcessed` callbacks already handle:**
- Setting session ID
- Adding AI response message to chat
- Updating draft

So we reuse them as-is.

### 5. Cleanup — MethodTabs (Mobile) Simplification

**File:** `src/pages/IngestPage.tsx`

**Current mobile layout** uses `MethodTabs` which wraps chat + file upload zone + image upload zone in tabs. Since file/image upload is now inline in the chat, the mobile layout should use `ChatIngestionPanel` directly (same as desktop).

**Change in IngestPage mobile layout:**
```tsx
// BEFORE:
{state.mobileMode === 'chat' && (
  <MethodTabs
    activeMethod={activeMethod}
    onMethodChange={setActiveMethod}
    chatContent={chatContent}
    onFileProcessed={handleFileProcessed}
    onImageProcessed={handleImageProcessed}
    sessionId={state.sessionId || undefined}
  />
)}

// AFTER:
{state.mobileMode === 'chat' && chatContent}
```

This means:
- Remove `MethodTabs` import from IngestPage
- Remove `activeMethod` state
- The `chatContent` variable already renders `ChatIngestionPanel` with all the upload props

**Note:** `MethodTabs.tsx`, `FileUploadZone.tsx`, and `ImageUploadZone.tsx` become unused after this change. We can leave them in the codebase for now (they may be useful for a standalone upload page later) but they're no longer imported anywhere.

---

## Files Changed / Created Summary

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `src/pages/IngestWizard.tsx` | Remove Step 2, go direct from product type to session creation |
| MODIFY | `src/components/ingest/ChatIngestionPanel.tsx` | New empty state with 3 suggestion cards, "+" button with popover, upload indicator |
| MODIFY | `src/pages/IngestPage.tsx` | Wire useFileUpload + useImageUpload hooks, pass to ChatIngestionPanel, remove MethodTabs |

**Total: 0 new files, 3 modified files**

---

## Implementation Tasks

### Task 1: Modify IngestWizard — Remove Step 2
**File:** `src/pages/IngestWizard.tsx`
**Scope:** Remove Step 2 JSX, state, handlers, and unused imports. Wire "Start" button to create session directly.

### Task 2: Modify ChatIngestionPanel — Empty State + "+" Button
**File:** `src/components/ingest/ChatIngestionPanel.tsx`
**Scope:** Add new props (`onFileSelected`, `onImageSelected`, `isUploading`). Redesign empty state with 3 suggestion cards. Add "+" button with Popover submenu. Add hidden file inputs. Add upload-in-progress indicator.

### Task 3: Modify IngestPage — Wire Upload Hooks
**File:** `src/pages/IngestPage.tsx`
**Scope:** Import & use `useFileUpload` + `useImageUpload`, create handler callbacks, pass new props to ChatIngestionPanel, remove MethodTabs usage in mobile layout.

---

## Testing Plan

1. Navigate to `/admin/ingest/new` → see only Step 1 (product type selection)
2. Select "Prep Recipe" → click "Start" → lands on IngestPage with chat
3. Verify empty state shows 3 suggestion cards (chat, file, photo)
4. Click "Describe your recipe" card → focus moves to text input
5. Click "Upload a file" card → file picker opens (accepts PDF/DOCX/TXT)
6. Click "Take a photo" card → camera/image picker opens
7. Click "+" button in input bar → popover shows "Upload File" and "Take Photo"
8. Select a file via "+" → "Upload File" → verify upload processes and AI response appears in chat
9. Select an image via "+" → "Take Photo" → verify upload processes and AI response appears in chat
10. While upload is processing → verify "Processing filename..." indicator shows
11. After file/image processed → verify draft appears in editor/preview
12. Mobile: verify chat mode shows ChatIngestionPanel directly (no MethodTabs)
13. Desktop: verify AI panel on right has the "+" button and works the same way
