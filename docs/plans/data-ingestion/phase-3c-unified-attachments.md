# Phase 3C: Unified Attachments with Queue & Batch Processing

**Plan Date:** 2026-02-20
**Status:** Not Started
**Depends On:** Phase 3B (complete)

---

## Goal

Merge "Upload File" and "Add Image" into a single attachment flow. Files are queued with thumbnail previews in the input bar — the user can add multiple files/images before sending. When the user hits Send, all attachments are processed together and the AI responds once.

---

## Current Flow (Phase 3B)

```
User clicks "+" → picks "Upload File" OR "Add Image"
→ file picker opens (filtered by type)
→ file selected → immediately sent to edge function
→ AI response appears in chat
```

**Problems:**
- Two separate menu options for conceptually the same action (attaching a file)
- Files process immediately — no chance to add more before AI responds
- No visual preview of what's being sent

## New Flow

```
User clicks 📎 (attachment button) → unified file picker opens
→ file(s) selected → queued as attachment chips/thumbnails above input bar
→ user can add more files, type a message, or remove attachments
→ user hits Send → all attachments processed (routed by type) → AI responds
```

---

## Architecture Decisions

### 1. Single attachment button, auto-routing by MIME type

The frontend accepts ALL file types via one `<input>` with combined accept filter. The MIME type determines which edge function to call:

- `image/*` → `/functions/v1/ingest-vision`
- `text/plain`, `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document` → `/functions/v1/ingest-file`

**Backend stays separate** — different processing pipelines (text extraction vs GPT vision). Only the frontend merges.

### 2. Attachment queue with previews

Attachments are stored in local state as an array:

```typescript
interface QueuedAttachment {
  id: string;           // crypto.randomUUID()
  file: File;           // the actual File object
  preview: string | null; // object URL for images, null for documents
  type: 'image' | 'document';
}
```

- Images get a thumbnail preview via `URL.createObjectURL(file)`
- Documents get an icon + filename display (PDF icon, DOC icon, TXT icon)
- Each attachment has an "x" button to remove it from the queue
- Queue renders as a horizontal strip above the text input

### 3. Batch send on user action

When the user clicks Send (with attachments queued):
1. Process all attachments sequentially (not in parallel — avoids race conditions with session creation)
2. First attachment creates the session (if none exists)
3. Subsequent attachments use the same sessionId
4. Each attachment returns its own AI response/draft
5. After all are processed, show a combined AI message summarizing what was extracted
6. The final draft is the result of the last processing call (each builds on the previous via the session)

If the user also typed a text message, it's sent as a follow-up chat message after all attachments are processed.

---

## What Needs Changing

### 1. ChatIngestionPanel — Unified Attachment UX

**File:** `src/components/ingest/ChatIngestionPanel.tsx`

**Changes:**

**a) Replace "+" Popover with a single attachment button:**

Remove the Popover entirely. Replace with a simple `Button` that triggers a single hidden `<input>`:

```tsx
<Button
  variant="ghost"
  size="icon"
  className="shrink-0 h-9 w-9"
  disabled={isProcessing || isUploading}
  onClick={() => attachInputRef.current?.click()}
  aria-label="Add attachment"
>
  <Paperclip className="h-5 w-5" />
</Button>
```

**b) Single hidden file input accepting all types:**

Replace both hidden inputs with one:

```tsx
<input
  ref={attachInputRef}
  type="file"
  accept="image/*,.pdf,.docx,.doc,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
  multiple
  className="hidden"
  onChange={handleFilesSelected}
/>
```

**c) Attachment queue state + handlers:**

```typescript
const [attachments, setAttachments] = useState<QueuedAttachment[]>([]);

const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
  const files = e.target.files;
  if (!files) return;

  const newAttachments: QueuedAttachment[] = Array.from(files).map((file) => ({
    id: crypto.randomUUID(),
    file,
    preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
    type: file.type.startsWith('image/') ? 'image' as const : 'document' as const,
  }));

  setAttachments((prev) => [...prev, ...newAttachments]);
  e.target.value = '';
};

const removeAttachment = (id: string) => {
  setAttachments((prev) => {
    const removed = prev.find((a) => a.id === id);
    if (removed?.preview) URL.revokeObjectURL(removed.preview);
    return prev.filter((a) => a.id !== id);
  });
};
```

**d) Attachment preview strip (above input bar):**

Renders when `attachments.length > 0`, between the messages area and the input bar:

```tsx
{attachments.length > 0 && (
  <div className="border-t border-border pt-2 pb-1 px-1">
    <div className="flex gap-2 overflow-x-auto">
      {attachments.map((att) => (
        <div key={att.id} className="relative shrink-0 group">
          {att.type === 'image' ? (
            <img
              src={att.preview!}
              alt={att.file.name}
              className="h-16 w-16 rounded-md object-cover border border-border"
            />
          ) : (
            <div className="h-16 w-16 rounded-md border border-border bg-muted flex flex-col items-center justify-center">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <span className="text-[9px] text-muted-foreground mt-0.5 truncate max-w-[56px] px-1">
                {att.file.name.split('.').pop()?.toUpperCase()}
              </span>
            </div>
          )}
          {/* Remove button */}
          <button
            type="button"
            onClick={() => removeAttachment(att.id)}
            className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  </div>
)}
```

**e) Updated Send logic:**

The Send button should be enabled when there are attachments OR text (not just text):

```tsx
disabled={(!input.trim() && attachments.length === 0) || isProcessing || isUploading}
```

The `handleSubmit` needs to pass both text and attachments to the parent:

```typescript
const handleSubmit = () => {
  const trimmed = input.trim();
  if (!trimmed && attachments.length === 0) return;

  // Clean up previews
  attachments.forEach((a) => { if (a.preview) URL.revokeObjectURL(a.preview); });

  // Pass everything to parent
  onSendMessage(trimmed, attachments.length > 0 ? attachments : undefined);

  setInput('');
  setAttachments([]);
};
```

**f) Updated onPaste handler:**

Instead of immediately calling `onImageSelected`, add pasted images to the queue:

```typescript
const handlePaste = useCallback((e: React.ClipboardEvent) => {
  const items = e.clipboardData?.items;
  if (!items) return;

  for (const item of Array.from(items)) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) {
        e.preventDefault();
        const newAtt: QueuedAttachment = {
          id: crypto.randomUUID(),
          file,
          preview: URL.createObjectURL(file),
          type: 'image',
        };
        setAttachments((prev) => [...prev, newAtt]);
        return;
      }
    }
  }
}, []);
```

**g) Updated props interface:**

```typescript
interface ChatIngestionPanelProps {
  messages: ChatMessage[];
  onSendMessage: (content: string, attachments?: QueuedAttachment[]) => void;  // CHANGED
  onEditDraft: (draft: PrepRecipeDraft) => void;
  onConfirmDraft: (draft: PrepRecipeDraft) => void;
  isProcessing?: boolean;
  className?: string;
  isUploading?: boolean;
  uploadingFileName?: string;
}
```

Remove `onFileSelected` and `onImageSelected` props — no longer needed (attachments are handled in batch on Send).

**h) Empty state update:**

Merge the two separate cards ("Upload a file" and "Add an image") into one:

```
  ┌──────────────────────────────────┐
  │ 💬  Describe your recipe         │
  │  Type ingredients, steps...      │
  └──────────────────────────────────┘
  ┌──────────────────────────────────┐
  │ 📎  Add files or images          │
  │  PDF, Word, text, or photos      │
  └──────────────────────────────────┘
```

Two cards instead of three. The attachment card triggers the unified file input.

**i) Cleanup — remove these:**
- `Popover`, `PopoverContent`, `PopoverTrigger` imports
- `popoverOpen` state
- `onFileSelected`, `onImageSelected` props
- Both separate hidden inputs (`fileInputRef`, `imageInputRef`)
- `Plus`, `Upload`, `Camera` icons → replace with `Paperclip`, `FileText`, `X`

### 2. Export `QueuedAttachment` type

**File:** `src/types/ingestion.ts`

Add the `QueuedAttachment` interface:

```typescript
export interface QueuedAttachment {
  id: string;
  file: File;
  preview: string | null;
  type: 'image' | 'document';
}
```

### 3. IngestPage — Batch Processing Handler

**File:** `src/pages/IngestPage.tsx`

**Changes:**

**a) Update `handleSendMessage` signature to accept attachments:**

```typescript
const handleSendMessage = useCallback(async (
  content: string,
  attachments?: QueuedAttachment[]
) => {
  // Show user message immediately (with attachment count if any)
  const userContent = attachments?.length
    ? `${content || ''}\n\n📎 ${attachments.length} attachment(s)`.trim()
    : content;

  const userMsg: ChatMessage = { ... content: userContent ... };
  dispatch({ type: 'ADD_MESSAGE', payload: userMsg });

  // 1. Process attachments first (sequentially)
  let currentSessionId = state.sessionId;
  let lastResult: (FileUploadResult | ImageUploadResult) | null = null;

  if (attachments?.length) {
    for (const att of attachments) {
      setUploadingFileName(att.file.name);

      if (att.type === 'image') {
        const result = await uploadImage(att.file, currentSessionId || undefined);
        if (result) {
          if (!currentSessionId) {
            currentSessionId = result.sessionId;
            dispatch({ type: 'SET_SESSION_ID', payload: result.sessionId });
          }
          lastResult = result;
        }
      } else {
        const result = await uploadFile(att.file, currentSessionId || undefined);
        if (result) {
          if (!currentSessionId) {
            currentSessionId = result.sessionId;
            dispatch({ type: 'SET_SESSION_ID', payload: result.sessionId });
          }
          lastResult = result;
        }
      }
    }
    setUploadingFileName(null);

    // Show AI response from attachment processing
    if (lastResult) {
      const aiMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: lastResult.message,
        draftPreview: lastResult.draft || undefined,
        createdAt: new Date().toISOString(),
      };
      dispatch({ type: 'ADD_MESSAGE', payload: aiMsg });
      if (lastResult.draft) {
        dispatch({ type: 'SET_DRAFT', payload: lastResult.draft });
      }
    }
  }

  // 2. If user also typed text, send it as a follow-up chat message
  if (content) {
    const chatResult = currentSessionId
      ? await sendMessage(content, currentSessionId)
      : await structureText(content);

    if (chatResult) {
      if (!currentSessionId && chatResult.sessionId) {
        dispatch({ type: 'SET_SESSION_ID', payload: chatResult.sessionId });
      }
      const aiMsg: ChatMessage = { ... };
      dispatch({ type: 'ADD_MESSAGE', payload: aiMsg });
      if (chatResult.draft) {
        dispatch({ type: 'SET_DRAFT', payload: chatResult.draft });
      }
    }
  }
}, [dispatch, sendMessage, structureText, uploadFile, uploadImage, state.sessionId]);
```

**b) Remove old handlers:**
- Remove `handleFileSelected` and `handleImageSelected` callbacks (no longer needed)
- Remove `handleFileProcessed` and `handleImageProcessed` callbacks (logic moved into handleSendMessage)
- Remove `onFileSelected`, `onImageSelected` props from both ChatIngestionPanel renders

**c) Simplify ChatIngestionPanel props:**

```tsx
<ChatIngestionPanel
  messages={state.messages}
  onSendMessage={handleSendMessage}
  onEditDraft={handleEditDraft}
  onConfirmDraft={handleConfirmDraft}
  isProcessing={isProcessing}
  isUploading={isUploading}
  uploadingFileName={uploadingFileName || undefined}
  className="..."
/>
```

**d) Cleanup imports:**
- Remove `FileUploadResult` type import (logic inlined)
- Remove `ImageUploadResult` type import (logic inlined)
- Add `QueuedAttachment` to the ingestion types import

---

## Files Changed Summary

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `src/components/ingest/ChatIngestionPanel.tsx` | Unified attachment button, queue with previews, batch send |
| MODIFY | `src/pages/IngestPage.tsx` | Batch processing handler, remove old file/image handlers |
| MODIFY | `src/types/ingestion.ts` | Add `QueuedAttachment` interface |

**Total: 0 new files, 3 modified files**

---

## Visual Mockup

### Empty state (2 cards instead of 3):
```
        🤖  AI Recipe Builder
   Create a recipe by chatting or
      adding files and images

  ┌──────────────────────────────┐
  │ 💬  Describe your recipe     │
  │  Type ingredients and steps  │
  └──────────────────────────────┘
  ┌──────────────────────────────┐
  │ 📎  Add files or images      │
  │  PDF, Word, text, or photos  │
  └──────────────────────────────┘
```

### Attachments queued (before sending):
```
  ┌─────────────────────────────────────┐
  │  [IMG1] [IMG2] [PDF]   ← previews  │
  ├─────────────────────────────────────┤
  │ [📎] [Here's my chimichurri...] [→] │
  └─────────────────────────────────────┘
```

### Processing (after Send):
```
  ┌─────────────────────────────────────┐
  │ ⏳ Processing recipe-card.jpg...    │
  ├─────────────────────────────────────┤
  │ [📎] [                        ] [→] │
  └─────────────────────────────────────┘
```

---

## Testing Plan

1. Click 📎 → file picker shows → select a PDF → appears as document chip with extension badge
2. Click 📎 again → select 2 images → both appear as thumbnails alongside the PDF
3. Hover over any chip → "x" appears → click to remove
4. Paste an image from clipboard → appears as thumbnail in queue
5. Type "Here's my chimichurri recipe" + have 2 attachments → click Send
6. Verify: user message shows text + "📎 2 attachment(s)"
7. Verify: "Processing filename..." shows for each file sequentially
8. Verify: AI response appears after all attachments processed
9. Verify: draft updates in editor
10. Send with attachments only (no text) → verify it works
11. Send with text only (no attachments) → verify existing chat flow still works
12. Mobile: verify attachment chips scroll horizontally if many
