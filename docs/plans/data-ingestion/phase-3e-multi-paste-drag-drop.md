# Phase 3E: Multi-Image Paste + Drag & Drop

**Plan Date:** 2026-02-20
**Status:** Not Started
**Depends On:** Phase 3D (complete)

---

## Two Issues to Fix

### Issue 1: Pasting multiple images only queues the first one
### Issue 2: No drag-and-drop support for the chatbox

---

## Issue 1: Multi-Image Paste

### Root Cause

In `ChatIngestionPanel.tsx` line 246, the `handlePaste` function has a `return` statement inside the loop that exits after processing the first image:

```typescript
for (const item of Array.from(items)) {
  if (item.type.startsWith('image/')) {
    const file = item.getAsFile();
    if (file) {
      e.preventDefault();
      setAttachments((prev) => [...prev, { ... }]);
      return; // <-- BUG: exits after first image
    }
  }
}
```

### Fix

1. Remove the `return` statement
2. Collect all images from the clipboard in one pass
3. Call `e.preventDefault()` once (before the loop) if any images are found
4. Add all images to the queue in a single `setAttachments` call (cleaner than N individual state updates)

### Fixed Code

```typescript
const handlePaste = useCallback((e: React.ClipboardEvent) => {
  const items = e.clipboardData?.items;
  if (!items) return;

  const imageFiles: File[] = [];
  for (const item of Array.from(items)) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) imageFiles.push(file);
    }
  }

  if (imageFiles.length > 0) {
    e.preventDefault();
    const newAttachments: QueuedAttachment[] = imageFiles.map((file) => ({
      id: crypto.randomUUID(),
      file,
      preview: URL.createObjectURL(file),
      type: 'image' as const,
    }));
    setAttachments((prev) => [...prev, ...newAttachments]);
  }
}, []);
```

---

## Issue 2: Drag & Drop

### Current State

The outer `<div>` at line 253 only has `onPaste`. No drag event handlers exist.

### Fix Strategy

Add drag-and-drop support with visual feedback:

1. Add `isDragging` state to show a drop zone overlay
2. Add `onDragOver`, `onDragEnter`, `onDragLeave`, `onDrop` handlers to the outer div
3. Show a visual drop zone overlay when dragging files over the chat
4. On drop, extract files from `e.dataTransfer.files` and add to attachments queue (same logic as `handleFilesSelected`)
5. Filter to accepted file types only

### New Handlers

```typescript
const [isDragging, setIsDragging] = useState(false);
const dragCounterRef = useRef(0);

const handleDragEnter = useCallback((e: React.DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
  dragCounterRef.current++;
  if (e.dataTransfer.types.includes('Files')) {
    setIsDragging(true);
  }
}, []);

const handleDragLeave = useCallback((e: React.DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
  dragCounterRef.current--;
  if (dragCounterRef.current === 0) {
    setIsDragging(false);
  }
}, []);

const handleDragOver = useCallback((e: React.DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
}, []);

const handleDrop = useCallback((e: React.DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
  setIsDragging(false);
  dragCounterRef.current = 0;

  const files = e.dataTransfer.files;
  if (!files || files.length === 0) return;

  // Filter to accepted types
  const accepted = Array.from(files).filter((f) =>
    f.type.startsWith('image/') ||
    f.type === 'application/pdf' ||
    f.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    f.type === 'text/plain'
  );

  if (accepted.length === 0) return;

  const newAttachments: QueuedAttachment[] = accepted.map((file) => ({
    id: crypto.randomUUID(),
    file,
    preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
    type: file.type.startsWith('image/') ? 'image' as const : 'document' as const,
  }));

  setAttachments((prev) => [...prev, ...newAttachments]);
}, []);
```

### Visual Drop Zone Overlay

Add inside the outer `<div>`, right before the messages area:

```tsx
{isDragging && (
  <div className="absolute inset-0 z-20 flex items-center justify-center rounded-lg border-2 border-dashed border-primary bg-primary/5 backdrop-blur-sm">
    <div className="text-center">
      <Paperclip className="h-8 w-8 mx-auto mb-2 text-primary" />
      <p className="text-sm font-medium text-primary">Drop files here</p>
      <p className="text-xs text-muted-foreground mt-0.5">Images, PDF, Word, or text files</p>
    </div>
  </div>
)}
```

### Outer Div Changes

```tsx
// BEFORE:
<div className={cn('flex flex-col h-full', className)} onPaste={handlePaste}>

// AFTER:
<div
  className={cn('flex flex-col h-full relative', className)}
  onPaste={handlePaste}
  onDragEnter={handleDragEnter}
  onDragLeave={handleDragLeave}
  onDragOver={handleDragOver}
  onDrop={handleDrop}
>
```

Note: `relative` added for the absolute-positioned overlay.

---

## Files Changed Summary

| Action | File | Issue | Description |
|--------|------|-------|-------------|
| MODIFY | `src/components/ingest/ChatIngestionPanel.tsx` | 1 + 2 | Fix multi-paste, add drag-and-drop with overlay |

**Total: 1 file modified, 0 new files**

---

## Implementation Tasks

### Task 1: Fix `handlePaste` for multi-image (Issue 1)
Collect all images first, then batch-add to queue. Remove the `return` statement.

### Task 2: Add drag-and-drop handlers + overlay (Issue 2)
Add `isDragging` state, `dragCounterRef`, 4 event handlers, drop zone overlay, update outer div.

Both tasks are in the same file and can be done in one edit pass.

---

## Testing Plan

### Multi-Paste (Issue 1)
1. Copy 2+ images to clipboard (e.g., select multiple in file explorer → Copy)
2. Paste into chatbox → Verify ALL images appear as thumbnails in the queue
3. Paste again → Verify new images are ADDED to existing queue (not replacing)
4. Send → Verify all images are processed by AI

### Drag & Drop (Issue 2)
5. Drag an image from desktop/file explorer over the chatbox
6. Verify: Blue dashed border overlay appears with "Drop files here"
7. Drop the file → Verify: Overlay disappears, image appears as thumbnail in queue
8. Drag multiple files at once → Verify: All accepted files are queued
9. Drag an unsupported file (e.g., .exe) → Verify: Nothing is queued
10. Drag files over then drag away without dropping → Verify: Overlay disappears

### Combined
11. Paste 1 image + drag 1 image + click 📎 to add 1 more → Send → Verify all 3 processed
