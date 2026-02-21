# Phase 3: File Upload + Image Upload — Implementation Plan

**Plan Date:** 2026-02-19
**Status:** Not Started
**Depends On:** Phase 1 (complete), Phase 2 (complete), OpenAI API key, product-assets bucket (exists)

---

## What's Already Built

| Requirement | Status | Location |
|-------------|--------|----------|
| Storage bucket `product-assets` | DONE | Migration `20260220000000_phase1_ingestion_foundation.sql` (10MB, MIME whitelist) |
| Multipart/form-data pattern | DONE | `supabase/functions/transcribe/index.ts` (audio file upload) |
| Shared utilities (auth, CORS, OpenAI) | DONE | `supabase/functions/_shared/` (auth.ts, cors.ts, openai.ts, supabase.ts) |
| Structuring schema + prompt | DONE | `PREP_RECIPE_DRAFT_SCHEMA` in `ingest/index.ts`, prompt slug `ingest-prep-recipe` |
| `IngestionMethod` type includes `file_upload` / `image_upload` | DONE | `src/types/ingestion.ts` |
| IngestWizard with disabled file/image cards | DONE | `src/pages/IngestWizard.tsx` ("Coming in Phase 3") |
| MethodTabs with placeholder content | DONE | `src/components/ingest/MethodTabs.tsx` |
| `ingestion_sessions.source_file_name/type` columns | DONE | Migration `20260219170000_create_ingestion_tables.sql` |
| Edge function calling pattern (hooks) | DONE | `src/hooks/use-ingest-chat.ts` |

---

## What Needs Building

### 1. Edge Function: `ingest-file` (File Upload + Text Extraction + Structuring)

**File:** `supabase/functions/ingest-file/index.ts`

**Flow:**
1. Parse `multipart/form-data` (native Deno `req.formData()`)
2. Validate file type + size (max 10MB)
3. Extract text based on MIME type:
   - `text/plain` → direct `file.text()`
   - `application/pdf` → `unpdf` library (`extractText + getDocumentProxy`)
   - `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` → SheetJS (`XLSX.read` + `sheet_to_json`)
   - `application/vnd.openxmlformats-officedocument.wordprocessingml.document` → mammoth (`extractRawText`)
4. Upload original file to `product-assets` storage: `uploads/{sessionId}/{timestamp}-{filename}`
5. Create ingestion session with `ingestion_method: 'file_upload'`, `source_file_name`, `source_file_type`
6. Save user message: `"File uploaded: {filename}\n\nExtracted content:\n{text}"`
7. Call OpenAI GPT-5.2 with structured output (same as `handleStructure` in `/ingest`)
8. Parse draft, generate slug, save to session
9. Return `{ sessionId, message, draft, confidence, missingFields, fileName }`

**Auth:** Same as `/ingest` — `verify_jwt: false`, manual `getClaims()`, admin check via `group_memberships`

**Deno imports:**
```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { extractText, getDocumentProxy } from "https://esm.sh/unpdf@1.4.0";
import mammoth from "https://esm.sh/mammoth@1.11.0";
// @deno-types="https://cdn.sheetjs.com/xlsx-0.20.3/package/types/index.d.ts"
import * as XLSX from "https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs";
```

**Request format:** `multipart/form-data` with fields:
- `file` — the uploaded file (File object)
- `productTable` — target table (text field)
- `language` — "en" or "es" (text field)
- `sessionId` — optional, to attach to existing session (text field)

**Response format:**
```json
{
  "sessionId": "uuid",
  "message": "AI explanation of what was extracted",
  "draft": { /* PrepRecipeDraft */ },
  "confidence": 0.85,
  "missingFields": ["shelfLifeValue"],
  "fileName": "chimichurri-recipe.pdf",
  "extractedLength": 1250
}
```

### 2. Edge Function: `ingest-vision` (Image Upload + GPT Vision + Structuring)

**File:** `supabase/functions/ingest-vision/index.ts`

**Flow:**
1. Parse `multipart/form-data`
2. Validate image type (jpeg, png, webp, gif) + size (max 10MB)
3. Convert image to base64 string
4. Upload original image to `product-assets` storage: `uploads/{sessionId}/{timestamp}-{filename}`
5. Create ingestion session with `ingestion_method: 'image_upload'`, `source_file_name`, `source_file_type`
6. Save user message: `"Image uploaded: {filename}"`
7. Call OpenAI GPT-5.2 with vision + structured output:
   ```json
   {
     "model": "gpt-5.2",
     "messages": [
       { "role": "system", "content": "structuring prompt" },
       {
         "role": "user",
         "content": [
           { "type": "text", "text": "Extract the recipe from this image..." },
           {
             "type": "image_url",
             "image_url": {
               "url": "data:image/{ext};base64,{BASE64}",
               "detail": "high"
             }
           }
         ]
       }
     ],
     "response_format": { "type": "json_schema", "json_schema": PREP_RECIPE_DRAFT_SCHEMA },
     "reasoning_effort": "medium",
     "max_completion_tokens": 4000
   }
   ```
8. Parse draft, generate slug, save to session
9. Return `{ sessionId, message, draft, confidence, missingFields, fileName, imageUrl }`

**Note on `response_format` + vision:** GPT-5.2 supports both vision and structured JSON output in the same call. The image is in the `content` array alongside text, and `response_format: { type: "json_schema" }` ensures structured output.

### 3. Frontend Hook: `use-file-upload`

**File:** `src/hooks/use-file-upload.ts`

**Interface:**
```typescript
export interface UseFileUploadReturn {
  uploadFile: (file: File, sessionId?: string) => Promise<UploadResult | null>;
  isUploading: boolean;
  progress: number; // 0-100 (estimated based on file size)
  error: string | null;
}

interface UploadResult {
  sessionId: string;
  message: string;
  draft: PrepRecipeDraft | null;
  confidence?: number;
  missingFields?: string[];
  fileName: string;
}
```

**Implementation notes:**
- Cannot use `supabase.functions.invoke()` for multipart — use raw `fetch()` with `FormData`
- Get auth token via `supabase.auth.getSession()` for Authorization header
- Validate file type/size client-side before upload
- Accepted types: `.pdf`, `.xlsx`, `.docx`, `.txt`
- Max size: 10MB

**Calling pattern:**
```typescript
const formData = new FormData();
formData.append('file', file);
formData.append('productTable', 'prep_recipes');
formData.append('language', language);

const { data: { session } } = await supabase.auth.getSession();
const response = await fetch(
  `${SUPABASE_URL}/functions/v1/ingest-file`,
  {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session?.access_token}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: formData, // No Content-Type header — browser sets multipart boundary
  }
);
```

### 4. Frontend Hook: `use-image-upload`

**File:** `src/hooks/use-image-upload.ts`

**Interface:**
```typescript
export interface UseImageUploadReturn {
  uploadImage: (file: File, sessionId?: string) => Promise<ImageResult | null>;
  captureFromCamera: () => Promise<File | null>;
  isUploading: boolean;
  preview: string | null; // data:URL for local preview
  error: string | null;
}

interface ImageResult {
  sessionId: string;
  message: string;
  draft: PrepRecipeDraft | null;
  confidence?: number;
  missingFields?: string[];
  fileName: string;
  imageUrl: string;
}
```

**Implementation notes:**
- Same `fetch()` + `FormData` pattern as file upload
- `captureFromCamera()`: triggers `<input type="file" accept="image/*" capture="environment">` programmatically
- `preview`: create object URL from selected file for instant preview before upload
- Accepted types: `.jpg`, `.jpeg`, `.png`, `.webp`
- Max size: 10MB

### 5. Component: `FileUploadZone`

**File:** `src/components/ingest/FileUploadZone.tsx`

**Features:**
- Drag-and-drop zone with dashed border (HTML5 drag events, no library needed)
- Click to browse files
- File type badges: PDF, Excel, Word, TXT
- File size display
- Upload progress indicator (spinner or progress bar)
- Error state with retry button
- After upload: shows extracted text summary + draft preview card

**Props:**
```typescript
interface FileUploadZoneProps {
  onFileProcessed: (result: UploadResult) => void;
  productTable: string;
  sessionId?: string;
  className?: string;
}
```

**UI states:**
1. **Empty** — drop zone with icon, "Drop a file here or click to browse", type badges
2. **File selected** — file name + size, "Upload & Process" button
3. **Uploading** — progress spinner, "Processing {filename}..."
4. **Complete** — success message + draft preview card
5. **Error** — error message + retry button

### 6. Component: `ImageUploadZone`

**File:** `src/components/ingest/ImageUploadZone.tsx`

**Features:**
- Image drop zone OR click to browse
- Camera button for mobile (`capture="environment"`)
- Image preview thumbnail before upload
- Upload progress indicator
- After upload: shows AI extraction summary + draft preview card

**Props:**
```typescript
interface ImageUploadZoneProps {
  onImageProcessed: (result: ImageResult) => void;
  productTable: string;
  sessionId?: string;
  className?: string;
}
```

**UI states:**
1. **Empty** — camera icon + upload icon, "Take a photo or upload an image"
2. **Preview** — image thumbnail, "Analyze with AI" button
3. **Uploading** — progress spinner over dimmed preview
4. **Complete** — success message + draft preview card
5. **Error** — error message + retry button

### 7. Update `MethodTabs.tsx`

Replace the placeholder divs for `file_upload` and `image_upload` tabs with the real components:

```tsx
<TabsContent value="file_upload" className="mt-3">
  <FileUploadZone
    onFileProcessed={onFileProcessed}
    productTable={productTable}
    sessionId={sessionId}
  />
</TabsContent>

<TabsContent value="image_upload" className="mt-3">
  <ImageUploadZone
    onImageProcessed={onImageProcessed}
    productTable={productTable}
    sessionId={sessionId}
  />
</TabsContent>
```

**New props needed on MethodTabs:**
- `onFileProcessed: (result: UploadResult) => void`
- `onImageProcessed: (result: ImageResult) => void`
- `productTable: string`
- `sessionId?: string`

### 8. Update `IngestWizard.tsx`

Enable the file and image methods:
```typescript
// BEFORE:
{ key: 'file_upload', enabled: false, disabledLabel: 'Coming in Phase 3' },
{ key: 'image_upload', enabled: false, disabledLabel: 'Coming in Phase 3' },

// AFTER:
{ key: 'file_upload', enabled: true },
{ key: 'image_upload', enabled: true },
```

### 9. Update `IngestPage.tsx`

Wire up handlers for file/image upload results:
- `handleFileProcessed` — receives result, sets draft + session, adds system message to chat
- `handleImageProcessed` — same pattern, additionally stores image URL

### 10. Update `supabase/config.toml`

Add new functions:
```toml
[functions.ingest-file]
verify_jwt = false

[functions.ingest-vision]
verify_jwt = false
```

### 11. Update `use-ingestion-session.ts`

Modify `createSession` to accept `ingestionMethod` parameter (currently hardcoded to `'chat'`):
```typescript
// BEFORE:
const createSession = async (productTable: string) => {
  // ...
  ingestion_method: 'chat',

// AFTER:
const createSession = async (productTable: string, method: IngestionMethod = 'chat') => {
  // ...
  ingestion_method: method,
```

---

## Implementation Tasks

### Task 1: Build `ingest-file` edge function
**File:** `supabase/functions/ingest-file/index.ts`
**Estimated lines:** ~300
**Dependencies:** unpdf, SheetJS, mammoth (esm.sh imports)

### Task 2: Build `ingest-vision` edge function
**File:** `supabase/functions/ingest-vision/index.ts`
**Estimated lines:** ~250
**Dependencies:** None (native fetch to OpenAI)

### Task 3: Build `use-file-upload` hook
**File:** `src/hooks/use-file-upload.ts`

### Task 4: Build `use-image-upload` hook
**File:** `src/hooks/use-image-upload.ts`

### Task 5: Build `FileUploadZone` component
**File:** `src/components/ingest/FileUploadZone.tsx`

### Task 6: Build `ImageUploadZone` component
**File:** `src/components/ingest/ImageUploadZone.tsx`

### Task 7: Wire up frontend (MethodTabs, IngestWizard, IngestPage, use-ingestion-session)
**Files:** 4 modified files

### Task 8: Config + Deploy
- Add to `config.toml`
- Deploy both functions
- Test end-to-end

---

## Files Changed / Created Summary

| Action | File | Description |
|--------|------|-------------|
| CREATE | `supabase/functions/ingest-file/index.ts` | File upload + extraction + structuring |
| CREATE | `supabase/functions/ingest-vision/index.ts` | Image upload + vision + structuring |
| CREATE | `src/hooks/use-file-upload.ts` | File upload hook |
| CREATE | `src/hooks/use-image-upload.ts` | Image upload hook |
| CREATE | `src/components/ingest/FileUploadZone.tsx` | Drag-and-drop file upload UI |
| CREATE | `src/components/ingest/ImageUploadZone.tsx` | Image upload + camera UI |
| MODIFY | `src/components/ingest/MethodTabs.tsx` | Replace placeholders with real components |
| MODIFY | `src/pages/IngestWizard.tsx` | Enable file + image methods |
| MODIFY | `src/pages/IngestPage.tsx` | Wire file/image handlers |
| MODIFY | `src/hooks/use-ingestion-session.ts` | Accept ingestionMethod parameter |
| MODIFY | `supabase/config.toml` | Add ingest-file + ingest-vision configs |

**Total: 6 new files, 5 modified files**

---

## Testing Plan

### Edge Function Tests

**ingest-file (PDF):**
```bash
curl -X POST https://nxeorbwqsovybfttemrw.supabase.co/functions/v1/ingest-file \
  -H "Authorization: Bearer <admin_token>" \
  -H "apikey: <anon_key>" \
  -F "file=@test-recipe.pdf" \
  -F "productTable=prep_recipes" \
  -F "language=en"
```
**Expected:** JSON with sessionId, draft (structured recipe), confidence, fileName

**ingest-file (TXT):**
```bash
curl -X POST https://nxeorbwqsovybfttemrw.supabase.co/functions/v1/ingest-file \
  -H "Authorization: Bearer <admin_token>" \
  -H "apikey: <anon_key>" \
  -F "file=@recipe.txt" \
  -F "productTable=prep_recipes" \
  -F "language=en"
```

**ingest-vision (image):**
```bash
curl -X POST https://nxeorbwqsovybfttemrw.supabase.co/functions/v1/ingest-vision \
  -H "Authorization: Bearer <admin_token>" \
  -H "apikey: <anon_key>" \
  -F "file=@recipe-card.jpg" \
  -F "productTable=prep_recipes" \
  -F "language=en"
```
**Expected:** JSON with sessionId, draft, confidence, imageUrl

### Frontend Smoke Tests

1. Navigate to `/admin/ingest/new` → select Prep Recipe → select "Upload File"
2. Drop a PDF file → verify upload starts, progress shows, draft appears
3. Navigate to `/admin/ingest/new` → select Prep Recipe → select "Take Photo"
4. Upload a recipe card image → verify preview shows, then draft appears
5. After file/image processing → verify session created in database with correct `ingestion_method`
6. After processing → verify draft appears in editor and can be modified
7. Switch to Chat tab → verify can send follow-up messages to refine the draft

### Error Cases
- Upload a file > 10MB → verify client-side rejection
- Upload an unsupported file type (.mp3) → verify client-side rejection
- Upload a PDF with no text (scanned image) → verify AI returns low confidence
- Upload a blurry image → verify AI returns low confidence with helpful message
