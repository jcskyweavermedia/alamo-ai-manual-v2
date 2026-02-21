# Phase 3D: Multi-Image Processing + Session Restore Fixes

**Plan Date:** 2026-02-20
**Status:** Not Started
**Depends On:** Phase 3C (complete)

---

## Two Issues to Fix

### Issue A: Multi-image attachments only process the last image
### Issue B: Loading an existing session doesn't restore chat or draft

---

## Issue A: Multi-Image Processing

### Root Cause

Every layer treats each image as a standalone, independent extraction:
1. **Edge functions** (`ingest-vision`, `ingest-file`) don't load the existing draft when a `sessionId` is provided
2. **GPT call** has no context from previous extractions
3. **Database save** fully replaces the draft (not a merge)
4. **Frontend** only shows the last image's AI response

### Fix Strategy

**The right approach:** When a session already has a draft, the edge function should load it, include it as context in the GPT prompt, and ask the AI to **merge** the new extraction with the existing draft. This way each image builds on the previous one.

### Fix A1: Edge function `ingest-vision` — Load existing draft + merge context

**File:** `supabase/functions/ingest-vision/index.ts`

**Change in section 8 (CREATE OR LOAD INGESTION SESSION):**

When `sessionId` is provided, also select `draft_data`:

```typescript
// BEFORE (line 456):
.select("id, status, created_by")

// AFTER:
.select("id, status, created_by, draft_data")
```

Store the existing draft for later use:

```typescript
let existingDraft: PrepRecipeDraft | null = null;
if (sessionId) {
  // ... existing validation ...
  existingDraft = existingSession.draft_data as PrepRecipeDraft | null;
  activeSessionId = existingSession.id;
}
```

**Change in section 11 (CALL OPENAI):**

When an existing draft exists, modify the user prompt to include it:

```typescript
const userTextContent = existingDraft && existingDraft.name
  ? `This is an additional image for an existing recipe draft. Here is the current draft:\n\n${JSON.stringify(existingDraft, null, 2)}\n\nMerge any new information from this image into the existing draft. Keep all existing data and add/update fields from the new image. If the image contains shelf life, yield, or other metadata not in the current draft, add it.`
  : "Extract and structure the recipe from this image. If the image shows a recipe card, menu item, handwritten notes, or any food preparation instructions, extract all details. If the image shows a finished dish, describe the likely preparation method, ingredients, and technique.";
```

Use `userTextContent` in the messages array instead of the hardcoded string.

**Change in section 12 (PARSE + ADD SLUG & IMAGES):**

Accumulate images instead of replacing:

```typescript
// BEFORE:
(draft as any).images = imageUrl ? [imageUrl] : [];

// AFTER:
const existingImages = existingDraft?.images || [];
(draft as any).images = imageUrl
  ? [...existingImages, imageUrl]
  : existingImages;
```

### Fix A2: Edge function `ingest-file` — Same pattern

**File:** `supabase/functions/ingest-file/index.ts`

Apply the same 3 changes:
1. Select `draft_data` when loading existing session
2. Include existing draft in GPT prompt for merging
3. Accumulate images array

### Fix A3: Frontend `IngestPage.tsx` — Show all AI responses

**File:** `src/pages/IngestPage.tsx`

**Change in `handleSendMessage` attachment loop:**

Instead of only keeping `lastMessage`/`lastDraft`, show an AI response for EACH attachment:

```typescript
if (hasAttachments) {
  for (const att of attachments) {
    setUploadingFileName(att.file.name);

    const result = att.type === 'image'
      ? await uploadImage(att.file, currentSessionId || undefined)
      : await uploadFile(att.file, currentSessionId || undefined);

    if (result) {
      if (!currentSessionId) {
        currentSessionId = result.sessionId;
        dispatch({ type: 'SET_SESSION_ID', payload: result.sessionId });
      }

      // Show AI response for THIS attachment
      const aiMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: result.message,
        draftPreview: result.draft || undefined,
        createdAt: new Date().toISOString(),
      };
      dispatch({ type: 'ADD_MESSAGE', payload: aiMsg });

      // Update draft progressively
      if (result.draft) {
        dispatch({ type: 'SET_DRAFT', payload: result.draft });
      }
    }
  }
  setUploadingFileName(null);
}
```

This way:
- Each image gets its own AI response bubble in the chat
- The draft updates progressively (each image builds on the previous via the backend merge)
- The user sees what was extracted from each image

---

## Issue B: Session Restore

### Root Cause

1. `loadSession` only queries `ingestion_sessions`, never `ingestion_messages`
2. Only `SET_SESSION_ID` is dispatched after loading — draft and messages aren't restored
3. No `SET_MESSAGES` action exists in the reducer
4. `loadSession` returns `void` — caller can't access loaded data

### Fix B1: Add `SET_MESSAGES` action to reducer

**File:** `src/contexts/IngestDraftContext.tsx`

Add to the action union type:

```typescript
| { type: 'SET_MESSAGES'; payload: ChatMessage[] }
```

Add to the reducer:

```typescript
case 'SET_MESSAGES':
  return { ...state, messages: action.payload };
```

### Fix B2: Update `loadSession` to also fetch messages and return data

**File:** `src/hooks/use-ingestion-session.ts`

**Change return type:**

```typescript
// BEFORE:
loadSession: (sessionId: string) => Promise<void>;

// AFTER:
loadSession: (sessionId: string) => Promise<{
  session: IngestionSession;
  messages: ChatMessage[];
} | null>;
```

**Change implementation:**

```typescript
const loadSession = useCallback(
  async (sessionId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch session
      const { data: sessionData, error: sessionError } = await supabase
        .from('ingestion_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (sessionError) throw new Error(sessionError.message);

      const mapped = mapRow(sessionData as Record<string, unknown>);
      setSession(mapped);

      // Fetch messages
      const { data: messagesData, error: messagesError } = await supabase
        .from('ingestion_messages')
        .select('id, role, content, draft_updates, created_at')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (messagesError) {
        console.error('Failed to load messages:', messagesError.message);
      }

      // Map DB messages to ChatMessage format
      const messages: ChatMessage[] = (messagesData || [])
        .filter((m: any) => m.role === 'user' || m.role === 'assistant')
        .map((m: any) => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: m.content,
          draftPreview: m.draft_updates || undefined,
          createdAt: m.created_at,
        }));

      return { session: mapped, messages };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load session';
      setError(message);
      toast.error(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  },
  [],
);
```

**Also add `ChatMessage` import:**

```typescript
import type { PrepRecipeDraft, ChatMessage } from '@/types/ingestion';
```

### Fix B3: Update `IngestPage.tsx` — Restore draft and messages on load

**File:** `src/pages/IngestPage.tsx`

**Change the session-loading `useEffect`:**

```typescript
// BEFORE:
useEffect(() => {
  if (sessionId && !state.sessionId) {
    loadSession(sessionId).then(() => {
      dispatch({ type: 'SET_SESSION_ID', payload: sessionId });
    });
  }
}, [sessionId]);

// AFTER:
useEffect(() => {
  if (sessionId && !state.sessionId) {
    loadSession(sessionId).then((result) => {
      if (result) {
        dispatch({ type: 'SET_SESSION_ID', payload: sessionId });

        // Restore draft from session
        if (result.session.draftData && result.session.draftData.name) {
          dispatch({ type: 'SET_DRAFT', payload: result.session.draftData });
          dispatch({ type: 'SET_DRAFT_VERSION', payload: result.session.draftVersion });
        }

        // Restore chat messages
        if (result.messages.length > 0) {
          dispatch({ type: 'SET_MESSAGES', payload: result.messages });
        }
      }
    });
  }
}, [sessionId]);
```

### Fix B4: Update `UseIngestionSessionReturn` interface

**File:** `src/hooks/use-ingestion-session.ts`

```typescript
// BEFORE:
loadSession: (sessionId: string) => Promise<void>;

// AFTER:
loadSession: (sessionId: string) => Promise<{
  session: IngestionSession;
  messages: ChatMessage[];
} | null>;
```

---

## Files Changed Summary

| Action | File | Issue | Description |
|--------|------|-------|-------------|
| MODIFY | `supabase/functions/ingest-vision/index.ts` | A | Load existing draft, merge context in GPT prompt, accumulate images |
| MODIFY | `supabase/functions/ingest-file/index.ts` | A | Same: load draft, merge context, accumulate images |
| MODIFY | `src/pages/IngestPage.tsx` | A + B | Show per-attachment AI responses; restore draft+messages on load |
| MODIFY | `src/contexts/IngestDraftContext.tsx` | B | Add `SET_MESSAGES` action |
| MODIFY | `src/hooks/use-ingestion-session.ts` | B | Fetch messages, return data from `loadSession` |

**Total: 5 files modified, 0 new files**

---

## Implementation Tasks

### Task 1: Fix `ingest-vision` edge function (Issue A)
**File:** `supabase/functions/ingest-vision/index.ts`
**Changes:** Load `draft_data` on existing session, include in GPT prompt, accumulate images array

### Task 2: Fix `ingest-file` edge function (Issue A)
**File:** `supabase/functions/ingest-file/index.ts`
**Changes:** Same pattern as Task 1

### Task 3: Add `SET_MESSAGES` to context (Issue B)
**File:** `src/contexts/IngestDraftContext.tsx`
**Changes:** Add action type + reducer case

### Task 4: Update `loadSession` to fetch messages (Issue B)
**File:** `src/hooks/use-ingestion-session.ts`
**Changes:** Query `ingestion_messages`, return data, update return type

### Task 5: Fix `IngestPage.tsx` (Issues A + B)
**File:** `src/pages/IngestPage.tsx`
**Changes:** Per-attachment AI responses in loop; restore draft+messages in useEffect

---

## Testing Plan

### Multi-Image (Issue A)
1. Attach 2 images of a recipe card (front + back) → Send
2. Verify: "Processing image1.jpg..." then "Processing image2.jpg..." shown sequentially
3. Verify: TWO AI response bubbles appear in chat (one per image)
4. Verify: The second AI response references data from the first (e.g., "I've added the shelf life from this image to the existing draft")
5. Verify: Draft in editor contains merged data from both images
6. Verify: `images` array in draft contains both image URLs

### Session Restore (Issue B)
7. Create a session, chat, build a draft → note the session ID
8. Navigate away (go to dashboard)
9. Click the session card to re-open it
10. Verify: Chat history is restored (all messages visible)
11. Verify: Draft is restored in the editor
12. Verify: Can continue chatting (send new messages that build on history)
13. Verify: AI has context from prior messages (server loads last 20)

### Mixed (Both Issues)
14. Create a session with 1 image → navigate away → come back → attach 1 more image → verify merge works with restored session
