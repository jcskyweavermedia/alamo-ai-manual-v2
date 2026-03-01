# Phase 7: Conversational AI Builder Tab

## Context

The Form Builder supports one-shot AI generation via `FormCreationDialog` (describe → generate).
Admins need a **conversational AI builder** — like the prep recipe ingestion system
(`ChatIngestionPanel`) — where they can iteratively talk to AI, send images/text/files, and
have it progressively add, remove, and modify form fields. This lives as a third tab in the
right panel: **Instructions / AI Builder / Settings**.

Most admins will use this as their primary workflow — 10x faster than manual field creation.

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                        AdminFormBuilderPage                       │
│  ┌──────────┐  ┌──────────────────┐  ┌─────────────────────────┐│
│  │ Palette   │  │ BuilderCanvas    │  │ [Instr] [AI] [Settings] ││
│  │ (desktop) │  │ (live updates)   │  │                         ││
│  │           │  │                  │  │  AIBuilderPanel          ││
│  │           │  │                  │  │  ┌──────────────────┐   ││
│  │           │  │                  │  │  │ Chat messages    │   ││
│  │           │  │                  │  │  │ + change cards   │   ││
│  │           │  │                  │  │  │                  │   ││
│  │           │  │                  │  │  ├──────────────────┤   ││
│  │           │  │                  │  │  │ [📎][🎤] Type.. [▶]│ ││
│  │           │  │                  │  │  └──────────────────┘   ││
│  └──────────┘  └──────────────────┘  └─────────────────────────┘│
└──────────────────────────────────────────────────────────────────┘
```

---

## What Already Exists (Reuse)

| Component/Hook | File | Reuse |
|---|---|---|
| `useVoiceRecording` | `src/hooks/use-voice-recording.ts` | Direct — mic + transcription |
| `ChatIngestionPanel` | `src/components/ingest/ChatIngestionPanel.tsx` | UI pattern — chat, voice, attachments |
| `BuilderContext` reducers | `src/contexts/BuilderContext.tsx` | `AI_GENERATE_SUCCESS`, `ACCEPT_REFINEMENT_RESULT`, `pushUndo` |
| `generate-form-template` | `supabase/functions/generate-form-template/` | Reuse field type defs + system prompt sections |
| `refine-form-instructions` | `supabase/functions/refine-form-instructions/` | Auth/usage/structured output pattern |
| `ask-form` | `supabase/functions/ask-form/index.ts` | Multimodal handling (images, files, vision) |
| `template-mapper` | `src/lib/form-builder/template-mapper.ts` | Field sanitization (needs export) |
| `summarizeFields` | `src/hooks/useRefineInstructions.ts` | Build field context string |
| `_shared/cors.ts`, `auth.ts`, `usage.ts` | `supabase/functions/_shared/` | CORS, JWT auth, usage tracking |

---

## Implementation Steps

### Step 1: Extract `useGroupId` Hook

**File:** `src/hooks/useGroupId.ts` (NEW, ~20 lines)

Currently `group_memberships` is queried in 3 separate places (AdminFormsListPage, AdminFormBuilderPage createTemplate, handleRefine). Extract to a shared hook:

```typescript
export function useGroupId(): string | null {
  const { user } = useAuth();
  const [groupId, setGroupId] = useState<string | null>(null);
  useEffect(() => {
    if (!user?.id) return;
    supabase.from('group_memberships').select('group_id')
      .eq('user_id', user.id).limit(1).single()
      .then(({ data }) => { if (data) setGroupId(data.group_id); });
  }, [user?.id]);
  return groupId;
}
```

Replace all 3 duplicate queries with this hook.

---

### Step 2: Export Field Sanitization

**File:** `src/lib/form-builder/template-mapper.ts` (EDIT)

The private `sanitizeGeneratedFields()` function needs to be exported and enhanced:

```typescript
// Export a reusable version that accepts existing keys for dedup
export function sanitizeFields(
  rawFields: Array<{ key: string; label: string; label_es: string; type: string; ... }>,
  existingKeys?: Set<string>,
): FormFieldDefinition[] {
  const seenKeys = new Set<string>(existingKeys || []);
  // ... existing sanitization logic (width default, order, key dedup)
}
```

This prevents duplicate keys when AI adds fields to an existing form.

---

### Step 3: New Edge Function — `form-builder-chat`

**File:** `supabase/functions/form-builder-chat/index.ts` (NEW, ~400 lines)

#### Input

```typescript
{
  message: string;                          // Max 10,000 chars
  currentForm: {                            // Snapshot of current builder state
    titleEn: string; titleEs: string;
    descriptionEn: string; descriptionEs: string;
    icon: string;
    fields: Array<{ key, label, label_es, type, section, required, options?, order }>;
    instructionsEn: string; instructionsEs: string;
    aiTools: string[];
  };
  conversationHistory: Array<{              // Max 10, each content max 2,000 chars
    role: 'user' | 'assistant';
    content: string;                        // Assistant: only the `message` text, NOT full JSON
  }>;
  imageBase64?: string;                     // data:image/...;base64,... (vision)
  fileContent?: string;                     // Pre-extracted text, max 50,000 chars
  fileName?: string;
  language: 'en' | 'es';
  groupId: string;
}
```

#### Output (OpenAI Structured JSON Schema, `strict: true`)

**Critical**: All properties in `required`, nullable via `["string", "null"]` / `anyOf` with `null`.

```typescript
{
  message: string;                          // Conversational response
  formUpdates: {                            // ALL fields required, nullable when no change
    titleEn: string | null;
    titleEs: string | null;
    descriptionEn: string | null;
    descriptionEs: string | null;
    icon: string | null;
    instructionsEn: string | null;
    instructionsEs: string | null;
    aiTools: string[] | null;
    fieldsToAdd: FieldDef[] | null;         // Full field objects (same schema as generate-form-template)
    fieldsToRemove: string[] | null;        // Existing field keys
    fieldsToModify: Array<{                 // Each property nullable
      key: string;
      label: string | null;
      label_es: string | null;
      type: string | null;
      required: boolean | null;
      placeholder: string | null;
      section: string | null;
      hint: string | null;
      ai_hint: string | null;
      options: string[] | null;
    }> | null;
    reorderedFieldKeys: string[] | null;
  };
  changeSummary: string[];                  // Always present (empty array if no changes)
  confidence: number;
}
```

Every nested object has `additionalProperties: false`. This satisfies OpenAI strict mode.

#### Server-Side Validation (before returning response)

```typescript
const existingKeys = new Set(currentForm.fields.map(f => f.key));

// 1. Filter fieldsToRemove to only existing keys
const validRemovals = (parsed.fieldsToRemove || []).filter(k => existingKeys.has(k));

// 2. Filter fieldsToModify to only existing keys
const validMods = (parsed.fieldsToModify || []).filter(m => existingKeys.has(m.key));

// 3. Filter fieldsToAdd — reject keys that already exist
const validAdds = (parsed.fieldsToAdd || []).filter(f => !existingKeys.has(f.key));

// 4. Validate reorderedFieldKeys is a valid permutation (after removals + additions)
// If invalid, drop reorder
```

#### System Prompt

Reuse field type definitions from `generate-form-template` system prompt, plus:
- Current form state injected (title, fields with keys/labels/types, instructions, tools)
- "You are modifying an EXISTING form. Make ONLY the changes the user requests."
- "If form is empty and user describes a full form, generate everything."
- "Always return changeSummary with human-readable bullet points."
- "Field keys you reference in fieldsToModify/fieldsToRemove MUST exist in the current form."
- Language instruction (EN/ES) from `LANGUAGE_INSTRUCTIONS` map.

#### Conversation History

- Max 10 messages, each trimmed to 2,000 chars
- **Only include `message` text from assistant turns** — NOT the full JSON with formUpdates.
  The full form state is passed fresh as `currentForm` each turn, so repeating field operations
  in history wastes tokens and risks JSON truncation confusion.
- Filter to `role === 'user' || role === 'assistant'` only

#### Configuration

- Model: `gpt-4o-mini` (structured output, vision-capable)
- `max_tokens: 4000` (matching generate-form-template)
- `OPENAI_TIMEOUT_MS: 45_000`
- Image detail: `"auto"` (let OpenAI choose, saves tokens vs `"high"`)

#### Auth & Usage

Same pattern as all other functions:
- `authenticateWithClaims()` (read-only, no network roundtrip)
- Admin/manager check via `group_memberships`
- `checkUsage()` / `incrementUsage()` with try/catch

#### Error Handling

Full coverage matching existing functions:
- CORS preflight (`OPTIONS` → `"ok"`)
- `AuthError` → 401
- Admin check fail → 403
- Missing fields / validation → 400
- `UsageError` → 500
- Usage limit → 429
- `OPENAI_API_KEY` missing → 500
- OpenAI HTTP error → 500 `ai_error`
- `finish_reason: "length"` → 500 `ai_malformed`
- JSON parse fail → 500 `ai_malformed`
- `AbortError` (timeout) → 504
- Generic catch → 500

---

### Step 4: Types

**File:** `src/types/form-builder.ts` (EDIT, +50 lines)

```typescript
// ── AI Builder Chat ──

export interface BuilderChatMessage {
  id: string;                       // crypto.randomUUID() generated by caller
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  // User message extras
  attachments?: Array<{ type: 'image' | 'file'; name: string; preview?: string }>;
  // Assistant message extras
  changeSummary?: string[];
  confidence?: number;
}

export interface FormBuilderChatUpdates {
  titleEn?: string;
  titleEs?: string;
  descriptionEn?: string;
  descriptionEs?: string;
  icon?: string;
  instructionsEn?: string;
  instructionsEs?: string;
  aiTools?: string[];
  fieldsToAdd?: Array<{
    key: string; label: string; label_es: string;
    type: FormFieldType; section: string; section_es?: string;
    required: boolean; placeholder?: string; hint?: string;
    hint_es?: string; ai_hint?: string; options?: string[];
    order: number; width?: 'full' | 'half';
  }>;
  fieldsToRemove?: string[];
  fieldsToModify?: Array<{ key: string; updates: Partial<FormFieldDefinition> }>;
  reorderedFieldKeys?: string[];
}

export interface FormBuilderChatResponse {
  message: string;
  formUpdates: FormBuilderChatUpdates;
  changeSummary: string[];
  confidence: number;
}
```

Add to `BuilderState`:
```typescript
builderChatMessages: BuilderChatMessage[];
builderChatLoading: boolean;
```

Add to `BuilderAction`:
```typescript
| { type: 'BUILDER_CHAT_ADD_MESSAGE'; payload: BuilderChatMessage }
| { type: 'BUILDER_CHAT_SET_LOADING'; payload: boolean }
| { type: 'BUILDER_CHAT_CLEAR' }
| { type: 'APPLY_CHAT_FORM_UPDATES'; payload: FormBuilderChatUpdates }
```

**Note**: `fieldsToModify.updates` uses `Partial<FormFieldDefinition>` (not `Record<string, unknown>`)
for full type safety. The hook validates/casts at the boundary.

---

### Step 5: Reducer — Chat Actions + APPLY_CHAT_FORM_UPDATES

**File:** `src/contexts/BuilderContext.tsx` (EDIT, +70 lines)

Add to `createInitialState()`:
```typescript
builderChatMessages: [],
builderChatLoading: false,
```

New cases:

```typescript
case 'BUILDER_CHAT_ADD_MESSAGE':
  return { ...state, builderChatMessages: [...state.builderChatMessages, action.payload] };

case 'BUILDER_CHAT_SET_LOADING':
  return { ...state, builderChatLoading: action.payload };

case 'BUILDER_CHAT_CLEAR':
  return { ...state, builderChatMessages: [] };

case 'APPLY_CHAT_FORM_UPDATES': {
  const s = pushUndo(state);
  const p = action.payload;

  // 1. Metadata updates (only if non-null)
  const metadata: Partial<BuilderState> = {};
  if (p.titleEn != null) metadata.titleEn = p.titleEn;
  if (p.titleEs != null) metadata.titleEs = p.titleEs;
  if (p.descriptionEn != null) metadata.descriptionEn = p.descriptionEn;
  if (p.descriptionEs != null) metadata.descriptionEs = p.descriptionEs;
  if (p.icon != null) metadata.icon = p.icon;
  if (p.instructionsEn != null) metadata.instructionsEn = p.instructionsEn;
  if (p.instructionsEs != null) metadata.instructionsEs = p.instructionsEs;
  if (p.aiTools != null) metadata.aiTools = p.aiTools;

  // 2. Slug auto-update (same pattern as ACCEPT_REFINEMENT_RESULT)
  if (p.titleEn) {
    const isSlugLocked = s.status === 'published' || !!s.publishedAt;
    const slugWasAuto = !s.slug || s.slug === generateSlug(s.titleEn);
    if (!isSlugLocked && slugWasAuto) {
      metadata.slug = generateSlug(p.titleEn);
    }
  }

  // 3. Field operations (order: remove → add → modify → reorder)
  let fields = [...s.fields];

  // Remove
  if (p.fieldsToRemove?.length) {
    const removeSet = new Set(p.fieldsToRemove);
    fields = fields.filter(f => !removeSet.has(f.key));
  }

  // Add (using exported sanitizeFields with existing key dedup)
  if (p.fieldsToAdd?.length) {
    const existingKeys = new Set(fields.map(f => f.key));
    const sanitized = sanitizeFields(p.fieldsToAdd, existingKeys);
    // Assign order values starting after existing fields
    const startOrder = fields.length + 1;
    sanitized.forEach((f, i) => { f.order = startOrder + i; });
    fields = [...fields, ...sanitized];
  }

  // Modify
  if (p.fieldsToModify?.length) {
    const removeSet = new Set(p.fieldsToRemove || []);
    fields = fields.map(f => {
      const mod = p.fieldsToModify!.find(m => m.key === f.key && !removeSet.has(m.key));
      return mod ? { ...f, ...mod.updates } : f;
    });
  }

  // Reorder (only if valid permutation)
  if (p.reorderedFieldKeys?.length) {
    const currentKeys = new Set(fields.map(f => f.key));
    const reorderKeys = new Set(p.reorderedFieldKeys);
    const isValid = currentKeys.size === reorderKeys.size &&
      [...currentKeys].every(k => reorderKeys.has(k));
    if (isValid) {
      const keyToField = new Map(fields.map(f => [f.key, f]));
      fields = p.reorderedFieldKeys
        .filter(k => keyToField.has(k))
        .map((k, i) => ({ ...keyToField.get(k)!, order: i + 1 }));
    }
  }

  return {
    ...s,
    ...metadata,
    fields,
    isDirty: true,
    saveStatus: 'unsaved' as const,
    instructionsRefined: p.instructionsEn != null ? true : s.instructionsRefined,
  };
}
```

**Note**: `builderChatMessages` is NOT in `BuilderSnapshot` — undo reverts form changes, not chat history.

---

### Step 6: Hook — `useFormBuilderChat`

**File:** `src/hooks/useFormBuilderChat.ts` (NEW, ~90 lines)

```typescript
export function useFormBuilderChat() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(async (params: {
    message: string;
    currentForm: { titleEn, titleEs, descriptionEn, descriptionEs, icon, fields, instructionsEn, instructionsEs, aiTools };
    conversationHistory: BuilderChatMessage[];
    imageBase64?: string;
    fileContent?: string;
    fileName?: string;
    language: 'en' | 'es';
    groupId: string;
  }): Promise<FormBuilderChatResponse | null> => {
    setError(null);
    setIsLoading(true);
    try {
      // Strip assistant messages to just their text content (not full JSON)
      const history = params.conversationHistory.slice(-10).map(m => ({
        role: m.role,
        content: m.content.slice(0, 2000),
      }));

      const { data, error: fnError } = await supabase.functions.invoke('form-builder-chat', {
        body: {
          message: params.message,
          currentForm: params.currentForm,
          conversationHistory: history,
          imageBase64: params.imageBase64 || undefined,
          fileContent: params.fileContent || undefined,
          fileName: params.fileName || undefined,
          language: params.language,
          groupId: params.groupId,
        },
      });

      if (fnError) throw new Error(fnError.message || 'Request failed');
      if (data?.error) throw new Error(data.message || data.error);

      // Validate + cast fieldsToModify.updates to Partial<FormFieldDefinition>
      const response: FormBuilderChatResponse = {
        message: data.message || '',
        formUpdates: castFormUpdates(data.formUpdates || {}),
        changeSummary: data.changeSummary || [],
        confidence: data.confidence ?? 0.5,
      };
      return response;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'An error occurred';
      setError(msg);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { sendMessage, isLoading, error };
}
```

The `castFormUpdates()` helper strips nulls and validates `fieldsToModify` updates against known
`FormFieldDefinition` property names.

---

### Step 7: Component — `AIBuilderPanel`

**File:** `src/components/form-builder/AIBuilderPanel.tsx` (NEW, ~350 lines)

Modeled after `ChatIngestionPanel`. Internal layout:

```
┌─────────────────────────────┐
│  Quick-start chips           │  ← Empty state only
│  "Employee write-up"         │
│  "Injury report"             │
│  "Daily checklist"           │
├─────────────────────────────┤
│  Chat messages (scrollable)  │
│                             │
│  👤 User message             │
│  🤖 AI response              │
│  ┌─ BuilderChangeCard ──┐   │
│  │ + employee_name       │   │
│  │ + date_of_incident    │   │
│  │ ~ updated title       │   │
│  └───────────────────────┘   │
│                             │
├─────────────────────────────┤
│  Attachment preview strip    │  ← When files/images queued
├─────────────────────────────┤
│ [📎] [🎤] Type a message.. [▶] │
└─────────────────────────────┘
```

**Props:**
```typescript
interface AIBuilderPanelProps {
  language: 'en' | 'es';
  groupId: string | null;
}
```

**Features:**
- Text input — auto-growing textarea (same pattern as ChatIngestionPanel)
- Voice — `useVoiceRecording` with mic button, audio level ring, silence auto-stop
- File/image attachments — file picker accepts `image/*, .pdf, .docx, .txt`
- Image paste — clipboard paste handler
- Quick-start chips — shown only when `builderChatMessages` is empty, pre-fills input text
- `BuilderChangeCard` — inline component under assistant messages showing `changeSummary[]`
- Thinking indicator — pulsing dots while `builderChatLoading` is true
- Auto-scroll — `scrollIntoView` on new messages
- Bilingual strings (EN/ES)

**File Handling (Phase 1):**
- Images: Read as base64 data URL, send as `imageBase64` to edge function
- PDF/DOCX/TXT: Client-side text extraction not needed. Send raw file content as base64. The edge function extracts text server-side (same as `ask-form` pattern).
- Alternatively, for simplicity in Phase 1: only support images and text. Defer file upload to Phase 2.

**Message Send Flow:**
1. Build user `BuilderChatMessage` with `crypto.randomUUID()` id
2. Dispatch `BUILDER_CHAT_ADD_MESSAGE` (user message)
3. Dispatch `BUILDER_CHAT_SET_LOADING(true)`
4. Call `sendMessage()` with current form snapshot from `state`
5. On success:
   - Dispatch `BUILDER_CHAT_ADD_MESSAGE` (assistant message with changeSummary)
   - Dispatch `APPLY_CHAT_FORM_UPDATES` with `formUpdates` — canvas updates live
6. Dispatch `BUILDER_CHAT_SET_LOADING(false)`
7. On error: show error inline, let user retry

---

### Step 8: Wire into AdminFormBuilderPage

**File:** `src/pages/admin/AdminFormBuilderPage.tsx` (EDIT, +40 lines)

#### Desktop (right panel)

Change `RightTab`:
```typescript
type RightTab = 'instructions' | 'ai-builder' | 'settings';
```

Add tab button (between Instructions and Settings):
```typescript
{ key: 'ai-builder' as const, label: t.aiBuilder, Icon: Sparkles },
```

Add strings:
```typescript
aiBuilder: 'AI Builder',  // en
aiBuilder: 'Constructor IA',  // es
```

Conditional CSS on wrapper (remove padding/overflow for AI Builder):
```tsx
<div className={cn(
  "flex-1 min-h-0",
  rightTab === 'ai-builder' && !showAdvancedPanel
    ? ''  // AI Builder manages its own scroll + padding
    : 'overflow-y-auto p-4'
)}>
```

Render:
```tsx
rightTab === 'ai-builder' ? (
  <AIBuilderPanel language={lang} groupId={groupId} />
) : rightTab === 'instructions' ? (
  <FormInstructionsPanel ... />
) : (
  <SettingsTab language={lang} />
)
```

Default to `'ai-builder'` when navigated from "Build with AI":
```typescript
const initialTab = location.state?.openAIBuilder ? 'ai-builder' : 'instructions';
const [rightTab, setRightTab] = useState<RightTab>(initialTab);
```

#### Mobile

Replace the "AI" sub-tab (`state.activeTab === 'ai-tools'` → AIToolsPicker) with "AI Builder":
```typescript
{ key: 'ai-tools' as const, label: lang === 'es' ? 'Constructor IA' : 'AI Builder' },
```
Render `<AIBuilderPanel>` instead of `<AIToolsPicker>` when `state.activeTab === 'ai-tools'`.

(AIToolsPicker is a stub; the real tool toggles live inside FormInstructionsPanel Section B.)

#### GroupId

Use the new `useGroupId()` hook:
```typescript
const groupId = useGroupId();
```
Remove duplicate `group_memberships` queries from `createTemplate` and `handleRefine`.

---

### Step 9: Simplify FormCreationDialog

**File:** `src/components/form-builder/FormCreationDialog.tsx` (EDIT, -40 lines)

Remove the `ai-input` step, `useGenerateTemplate` import, textarea, and generate logic.

Two simple buttons:
- **Blank Form** → `onBlank()` → navigates to `/admin/forms/new`
- **Build with AI** → `onAIBuilder()` → navigates to `/admin/forms/new` with `{ state: { openAIBuilder: true } }`

The AI Builder tab handles the full conversational experience.

---

## Files Summary

| # | File | Action | ~Lines Changed |
|---|------|--------|----------------|
| 1 | `src/hooks/useGroupId.ts` | NEW | ~20 |
| 2 | `src/lib/form-builder/template-mapper.ts` | EDIT (export sanitizeFields) | +15 |
| 3 | `supabase/functions/form-builder-chat/index.ts` | NEW | ~400 |
| 4 | `src/types/form-builder.ts` | EDIT | +50 |
| 5 | `src/contexts/BuilderContext.tsx` | EDIT | +70 |
| 6 | `src/hooks/useFormBuilderChat.ts` | NEW | ~90 |
| 7 | `src/components/form-builder/AIBuilderPanel.tsx` | NEW | ~350 |
| 8 | `src/pages/admin/AdminFormBuilderPage.tsx` | EDIT | +40 |
| 9 | `src/components/form-builder/FormCreationDialog.tsx` | EDIT | -40 |
| 10 | `src/pages/admin/AdminFormsListPage.tsx` | EDIT (use useGroupId) | -10 |

**Total: 4 new files, 6 edits. ~1,000 new lines.**

---

## Audit Findings Addressed

| Finding | Severity | Resolution |
|---------|----------|------------|
| OpenAI strict schema — all props required, nullable via `["type","null"]` | HIGH | Schema uses nullable types, all in `required` array |
| Server-side field key validation | HIGH | Filter removes/modifies against `currentForm.fields` keys |
| `Record<string,unknown>` type unsafety | MED | Changed to `Partial<FormFieldDefinition>` |
| `sanitizeGeneratedFields` not exported | MED | Export new `sanitizeFields()` with existing-key dedup |
| Slug auto-update missing | HIGH | Added to `APPLY_CHAT_FORM_UPDATES` (same pattern as `ACCEPT_REFINEMENT_RESULT`) |
| Chat lost on tab switch | HIGH | `builderChatMessages` stored in `BuilderState` (survives tab/field switches) |
| Chat NOT in undo snapshots | GOOD | `BuilderSnapshot` unchanged — undo reverts form, not chat |
| Assistant history bloat | MED | Only `message` text in history, not full JSON |
| GroupId 3x duplication | MED | Extracted `useGroupId()` hook |
| Parent CSS overflow conflict | LOW | Conditional `overflow-y-auto p-4` removal for AI Builder |
| Operation order edge cases | MED | Remove before modify, add with key dedup, reorder validated |
| `aiTools` not in undo snapshot | LOW | Pre-existing gap — noted, not blocking |
| Full error handling coverage | MED | All 12 error cases from existing functions covered |

---

## Verification

1. **TypeScript**: `npx tsc --noEmit` — zero errors
2. **Deploy**: `npx supabase functions deploy form-builder-chat --no-verify-jwt`
3. **Test: Full generation from empty form**
   - Forms List → New Form → "Build with AI" → Builder opens with AI Builder tab active
   - Type "Employee write-up form with name, date, incident description, rule broken, corrective action, and manager signature"
   - Fields appear in canvas, instructions populated, settings filled
   - Change card shows all added fields
4. **Test: Iterative modification**
   - Same chat: "Add a checkbox for rule categories: Attendance, Dress Code, Insubordination, Safety"
   - Single new field appears in canvas
   - Change card shows "+ rule_category (checkbox)"
5. **Test: Field removal**
   - "Remove the date_of_incident field" → field disappears, change card confirms
6. **Test: Voice input**
   - Click mic, say "Add a witness name field" → transcription appears, AI adds field
7. **Test: Image input**
   - Attach photo of a paper form → AI extracts structure and adds all fields
8. **Test: Undo/Redo**
   - Ctrl+Z after any AI change → all changes from that message revert atomically
   - Ctrl+Shift+Z → changes re-apply
9. **Test: Tab switching preserves chat**
   - Chat has 5 messages → click Instructions tab → click AI Builder tab → all 5 messages still there
   - Click field gear icon → AdvancedPanel appears → close it → chat still there
10. **Test: Mobile**
    - Open builder on mobile → Fields sub-tabs show "AI Builder" → full chat works
