# Phase 2 — Form Viewer (Read + Fill): Detailed Plan

> **Generated:** 2026-02-23
> **Team:** Database Expert, Backend Developer, Technical Architect, UX/UI Expert, Devil's Advocate (all Opus)
> **Phase 1 Status:** ✅ Complete (8 migrations pushed, 2 templates seeded, 15 contacts seeded, storage bucket created)
> **Scope:** Frontend-only — no edge functions, no AI. Users can browse forms, open a form, fill it out manually (all field types working), save drafts, and submit.

---

## Table of Contents

1. [Database & Query Patterns](#1-database--query-patterns) (Database Expert)
2. [Hook Implementation & State Management](#2-hook-implementation--state-management) (Backend Developer)
3. [Component Architecture & TypeScript Contracts](#3-component-architecture--typescript-contracts) (Technical Architect)
4. [UX/UI Design & Mobile-First Implementation](#4-uxui-design--mobile-first-implementation) (UX/UI Expert)
5. [Critical Review & Risk Assessment](#5-critical-review--risk-assessment) (Devil's Advocate)

---

## 1. Database & Query Patterns

### 1.1 TypeScript Interfaces

Create a single shared types file at `src/types/forms.ts`. Follow the same export-all-from-one-file pattern used by `src/types/products.ts` and `src/types/auth.ts`.

**Important convention:** The Phase 1 plan defined interfaces using snake_case to mirror DB columns. For Phase 2, the frontend types must use **camelCase** to match the existing codebase convention (see how `PrepRecipe` has `prepType` not `prep_type`, and `Dish` has `menuName` not `menu_name`). The data hooks will handle the snake_case-to-camelCase mapping, just as `use-supabase-recipes.ts` and `use-supabase-dishes.ts` do today.

```typescript
// src/types/forms.ts

// =============================================================================
// FIELD TYPES (17 types from the overview)
// =============================================================================

export type FormFieldType =
  | 'text'
  | 'textarea'
  | 'date'
  | 'time'
  | 'datetime'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'number'
  | 'phone'
  | 'email'
  | 'signature'
  | 'image'
  | 'file'
  | 'header'
  | 'instructions'
  | 'contact_lookup';

// =============================================================================
// FIELD CONDITION (conditional visibility)
// =============================================================================

export interface FormFieldCondition {
  field: string;                          // Key of the controlling field
  operator: 'eq' | 'neq' | 'in' | 'exists';
  value: unknown;
}

// =============================================================================
// FIELD VALIDATION
// =============================================================================

export interface FormFieldValidation {
  contact_category?: string;              // For contact_lookup: restrict to category
  min?: number;                           // For number fields
  max?: number;                           // For number fields
  pattern?: string;                       // For text/phone/email regex
  [key: string]: unknown;                 // Extensible for future validation rules
}

// =============================================================================
// FORM FIELD DEFINITION (single field in the template JSONB array)
// =============================================================================

export interface FormFieldDefinition {
  key: string;
  label: string;
  label_es?: string;
  type: FormFieldType;
  required?: boolean;
  placeholder?: string;
  section?: string;
  section_es?: string;
  hint?: string;
  ai_hint?: string;
  options?: string[];
  validation?: FormFieldValidation;
  default?: unknown;
  order: number;
  condition?: FormFieldCondition | null;
}

// =============================================================================
// FORM TEMPLATE (matches form_templates DB row, camelCase)
// =============================================================================

export type FormTemplateStatus = 'draft' | 'published' | 'archived';

export interface FormTemplate {
  id: string;
  groupId: string;
  slug: string;
  titleEn: string;
  titleEs: string | null;
  descriptionEn: string | null;
  descriptionEs: string | null;
  icon: string;
  headerImage: string | null;
  fields: FormFieldDefinition[];
  instructionsEn: string | null;
  instructionsEs: string | null;
  aiTools: string[];
  status: FormTemplateStatus;
  sortOrder: number;
  templateVersion: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// FORM FIELD VALUES (the field_values JSONB in form_submissions)
// =============================================================================

export interface SignatureValue {
  url: string;
  signed_at: string;
  signed_by: string;
}

export interface ImageValue {
  url: string;
  caption?: string;
  uploaded_at: string;
}

export interface FileValue {
  url: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  uploaded_at: string;
}

export interface ContactLookupValue {
  contact_id: string;
  name: string;
  phone: string | null;
  contact_person: string | null;
}

export type FormFieldValue =
  | string
  | string[]
  | number
  | boolean
  | SignatureValue
  | ImageValue[]
  | FileValue[]
  | ContactLookupValue
  | null;

export type FormFieldValues = Record<string, FormFieldValue>;

// =============================================================================
// FORM SUBMISSION (matches form_submissions DB row, camelCase)
// =============================================================================

export type FormSubmissionStatus = 'draft' | 'completed' | 'submitted' | 'archived';

export interface FormSubmission {
  id: string;
  templateId: string;
  groupId: string;
  templateVersion: number;
  fieldsSnapshot: FormFieldDefinition[] | null;
  fieldValues: FormFieldValues;
  status: FormSubmissionStatus;
  filledBy: string;
  submittedBy: string | null;
  subjectUserId: string | null;
  submittedAt: string | null;
  attachments: FormAttachment[];
  aiSessionId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FormAttachment {
  type: 'signature' | 'photo' | 'file';
  url: string;
  fieldKey: string;
  caption?: string;
  uploadedAt: string;
}

// =============================================================================
// CONTACT (matches contacts DB row, camelCase)
// =============================================================================

export interface Contact {
  id: string;
  groupId: string;
  category: string;
  subcategory: string | null;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  phoneAlt: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  isPriority: boolean;
  isDemoData: boolean;
  sortOrder: number;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// SEARCH RESULT TYPES (RPC function return shapes)
// =============================================================================

export interface FormSearchResult {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  icon: string;
  score: number;
}

export interface ContactSearchResult {
  id: string;
  name: string;
  category: string;
  subcategory: string | null;
  phone: string | null;
  contactPerson: string | null;
  address: string | null;
  isDemoData: boolean;
  score: number;
}

// =============================================================================
// SECTION GROUPING — derived from header fields for rendering
// =============================================================================

export interface FormSectionGroup {
  headerKey: string;
  label: string;
  labelEs?: string;
  fields: FormFieldDefinition[];
}
```

### 1.2 Supabase Query Patterns

Every query uses `supabase` from `@/integrations/supabase/client`. RLS policies handle group scoping automatically -- the frontend never sends `group_id` as a filter for SELECT queries because `get_user_group_id()` is evaluated server-side. INSERT queries must include `group_id` because the RLS `WITH CHECK` validates it matches the user's group.

#### Fetch Published Templates

```typescript
// queryKey: ['form-templates']
const { data, error } = await supabase
  .from('form_templates')
  .select('id, slug, title_en, title_es, description_en, description_es, icon, header_image, fields, instructions_en, instructions_es, ai_tools, status, sort_order, template_version, created_by, created_at, updated_at')
  .eq('status', 'published')
  .order('sort_order')
  .order('title_en');
```

Do NOT select `search_vector`. The RLS policy filters to `group_id = get_user_group_id() AND status IN ('published', 'archived')` automatically. The `fields` column returns as raw JSON — cast once: `(row.fields as unknown as FormFieldDefinition[]) ?? []`.

#### Fetch Single Template by Slug

```typescript
// queryKey: ['form-template', slug]
const { data, error } = await supabase
  .from('form_templates')
  .select(/* same columns */)
  .eq('slug', slug)
  .single();
```

#### Create a Draft Submission

```typescript
const { data: { user } } = await supabase.auth.getUser();
const { data, error } = await supabase
  .from('form_submissions')
  .insert({
    template_id: templateId,
    group_id: groupId,
    template_version: templateVersion,
    field_values: {},
    status: 'draft',
    filled_by: user.id,     // MUST match auth.uid()
  })
  .select()
  .single();
```

**Critical RLS note:** The INSERT policy requires `filled_by = auth.uid()` AND `group_id = get_user_group_id()`.

#### Update Submission Field Values (Draft Save)

```typescript
const { error } = await supabase
  .from('form_submissions')
  .update({ field_values: updatedFieldValues })
  .eq('id', submissionId);
```

Full replacement (not partial merge). Safe because only one user edits a submission at a time.

#### Submit a Form

```typescript
const { error } = await supabase
  .from('form_submissions')
  .update({
    status: 'submitted',
    fields_snapshot: templateFields,
    submitted_by: user.id,
    submitted_at: new Date().toISOString(),
    field_values: finalFieldValues,
  })
  .eq('id', submissionId)
  .eq('status', 'draft');  // Guard against double-submit
```

#### Check for Existing Draft (Resume)

```typescript
const { data: existingDraft } = await supabase
  .from('form_submissions')
  .select('id, template_id, template_version, field_values, status, created_at, updated_at')
  .eq('template_id', templateId)
  .eq('filled_by', user.id)
  .eq('status', 'draft')
  .order('updated_at', { ascending: false })
  .limit(1)
  .maybeSingle();
```

#### Storage Upload (Private Bucket)

```typescript
// Upload
const path = `${submissionId}/${fieldKey}/${Date.now()}-${safeName}`;
const { error } = await supabase.storage
  .from('form-attachments')
  .upload(path, file, { contentType: file.type, upsert: false });

// Generate signed URL for display (1-hour expiry)
const { data } = await supabase.storage
  .from('form-attachments')
  .createSignedUrl(path, 3600);
```

**Important:** Store the storage **path** (not the signed URL) in `field_values` — signed URLs expire. Regenerate on each form load.

### 1.3 RLS Implications for Frontend

| Table | User Role | Can See | Can Modify |
|-------|-----------|---------|------------|
| `form_templates` | staff | Published + archived in group | Nothing |
| `form_templates` | manager/admin | All statuses in group | Insert, update (admin: delete) |
| `form_submissions` | staff | Own (`filled_by`) + about them (`subject_user_id`) | Own only |
| `form_submissions` | manager/admin | All in group | All in group |
| `storage (form-attachments)` | all auth | Upload + read (signed URLs) | Update own; delete admin only |

### 1.4 React Query Caching Strategy

The codebase uses TanStack React Query v5. Existing hooks use `useQuery` for reads. Mutations are done with raw `supabase` calls + manual `queryClient.invalidateQueries()`.

| Hook | Query Key | Stale Time | Notes |
|------|-----------|------------|-------|
| `useFormTemplates()` | `['form-templates']` | 5 min | Templates rarely change |
| `useFormSubmission(templateId)` | `['form-submission', templateId, userId]` | 0 (always stale) | Drafts change frequently |
| `useFormSubmissions(templateId)` | `['form-submissions', templateId]` | 30 sec | Admin list |

**After submitting:** invalidate `['form-submission', ...]`, `['form-submissions', ...]`, and `['my-form-submissions']`.

### 1.5 Template Version Handling

- **Draft creation:** Store `template_version` from the current template.
- **Submit:** Copy `fields` into `fields_snapshot` via `JSON.parse(JSON.stringify(template.fields))`.
- **Viewing old submissions:** Use `fieldsSnapshot ?? currentTemplate.fields` for rendering.
- **Stale draft detection:** Compare `submission.templateVersion` vs `template.templateVersion`. If different, show warning and use current template fields (map existing values by key).

### 1.6 Performance Considerations

- **JSONB parsing:** Parse `fields` once in the hook mapping function, not per render.
- **Image compression:** Use `browser-image-compression` with Web Worker (non-blocking).
- **Signature upload:** Convert canvas `toDataURL('image/png')` → `fetch(dataUrl)` → `blob` → upload. No compression needed (5-20 KB).
- **Auto-save:** Debounce 2-3 seconds. Track last-saved hash to skip redundant saves. Flush on unmount.
- **Signed URL caching:** Generate batch on load, cache in `useRef<Map>`. Refresh before 1-hour expiry.
- **Conditional field evaluation:** Single `useMemo` pass, O(n) where n ≤ 40.

---

## 2. Hook Implementation & State Management

### 2.1 Hook Inventory

| Hook | File | Params | Dependencies | Side Effects |
|------|------|--------|--------------|--------------|
| `useFormTemplates()` | `use-form-templates.ts` | none | React Query, supabase | Supabase SELECT |
| `usePinnedForms()` | `use-pinned-forms.ts` | none | none | localStorage R/W |
| `useFormViewer()` | `use-form-viewer.ts` | none | useFormTemplates, usePinnedForms | none (pure derivation) |
| `useFormSubmission(templateId)` | `use-form-submission.ts` | `templateId: string` | supabase, useAuth | Supabase INSERT/UPDATE, debounced timer |
| `useFormSubmissions(templateId)` | `use-form-submissions.ts` | `templateId, options?` | React Query, supabase | Supabase SELECT |
| `useFormAttachmentUpload()` | `use-form-attachment-upload.ts` | none | supabase | Storage upload |
| `useSignedUrl(path)` | `use-signed-url.ts` | `path: string \| null` | React Query, supabase | Storage createSignedUrl |

### 2.2 `useFormTemplates()`

Mirrors `useSupabaseRecipes` pattern. TanStack Query `useQuery` with 5-min stale time.

```
queryKey: ['form-templates']
queryFn: SELECT from form_templates WHERE status IN ('published','archived')
staleTime: 5 min
Return: { templates: FormTemplate[], isLoading, error }
```

Maps snake_case DB rows to camelCase `FormTemplate` objects. Parses `fields` JSONB once in the mapping function.

### 2.3 `usePinnedForms()`

Exact clone of `usePinnedRecipes` / `usePinnedCourses` pattern.

- **localStorage key:** `'alamo-pinned-forms'`
- **Schema:** `string[]` (array of template slugs)
- **Interface:** `{ pinned, togglePin(slug), isPinned(slug), sortPinnedFirst(items) }`
- Lazy initializer reads localStorage once on mount
- `togglePin` uses functional setState updater + `localStorage.setItem`

### 2.4 `useFormViewer()`

Mirrors `useRecipeViewer` / `useDishViewer`. Composes data hook + search state + pin state + selection/navigation.

**Composition:**
- `useFormTemplates()` → templates, loading, error
- `usePinnedForms()` → togglePin, isPinned
- Local state: `searchQuery`, `selectedSlug`

**Client-side search** (≤50 templates):
```
filteredTemplates = templates.filter(t =>
  t.titleEn.toLowerCase().includes(q) ||
  t.titleEs?.toLowerCase().includes(q) ||
  t.descriptionEn?.toLowerCase().includes(q)
);
```

**Pinned split:**
```
pinnedTemplates = filteredTemplates.filter(t => isPinned(t.slug))
unpinnedTemplates = filteredTemplates.filter(t => !isPinned(t.slug))
```

**Selection + prev/next navigation:** identical pattern from existing viewer hooks.

### 2.5 `useFormSubmission(templateId)` — The Core Hook

Most complex hook. Manages the full lifecycle: creation, field editing, auto-save, validation, submit.

**Internal state (useReducer):**
```typescript
interface SubmissionState {
  submissionId: string | null;
  fieldValues: Record<string, unknown>;
  attachments: AttachmentMeta[];
  status: 'idle' | 'draft' | 'completed' | 'submitted';
  templateVersion: number;
  fieldsSnapshot: FormFieldDefinition[] | null;
  notes: string;
}
```

**Companion state:** `isDirty`, `isSaving`, `errors: Record<string, string>`, `lastSavedAt`

**Key actions:**

| Action | Behavior |
|--------|----------|
| `createDraft()` | INSERT into form_submissions. Check for existing draft first — if found, resume it. |
| `updateField(key, value)` | Dispatch SET_FIELD, setIsDirty(true), clear field error |
| `updateFields(updates)` | Bulk update (for AI fill in Phase 3) |
| `saveDraft()` | UPDATE field_values on server. Skip if !isDirty. |
| `submit()` | validate() → saveDraft() → copy fields_snapshot → UPDATE status='submitted' |
| `loadExistingDraft(id)` | SELECT by id, dispatch SET_ALL |
| `validate()` | Check required fields (skip hidden conditional ones), return errors map |

**Auto-save:** 3-second debounce after last field change. Uses `useDebounce` on `fieldValues`. Flushes on unmount/navigation. Tracks last-saved hash to skip redundant saves.

**Validation:** Runs on submit only (not on blur). Required field check skips fields whose `condition` evaluates to false. Type-specific: date must be ISO string, number must not be NaN, signature must be non-empty string.

### 2.6 `useFormSubmissions(templateId)`

Admin-only list hook. TanStack Query with pagination.

```
queryKey: ['form-submissions', templateId, statusFilter, page]
staleTime: 2 min
Pagination: offset-based (.range()), 20 per page
Filter: optional statusFilter ('all' | 'draft' | 'submitted' | ...)
Return: { submissions, totalCount, isLoading, page, setPage, statusFilter, setStatusFilter }
```

### 2.7 Storage Upload Hooks

**`useFormAttachmentUpload()`:**
- `uploadFile(file, submissionId, fieldKey)` → validates type/size, compresses images, uploads to `form-attachments/{submissionId}/{fieldKey}/{timestamp}-{name}`
- `uploadSignature(blob, submissionId, fieldKey)` → converts canvas blob to File, uploads to `form-attachments/{submissionId}/signatures/{fieldKey}-{timestamp}.png`
- Returns `{ uploadFile, uploadSignature, isUploading, error }`

**`useSignedUrl(path)`:**
- TanStack Query: `['signed-url', path]`, staleTime 50 min (refresh before 60-min expiry)
- Returns `{ url, isLoading, error }`

### 2.8 State Flow Diagram

```
SUPABASE (Cloud)
  form_templates ──SELECT──> useFormTemplates (TanStack Query cache)
  form_submissions ──INSERT/UPDATE──> useFormSubmission (useReducer)
  form-attachments ──upload/signedUrl──> useFormAttachmentUpload

useFormTemplates + usePinnedForms ──compose──> useFormViewer
                                                    |
                                                    v
                                              REACT COMPONENTS
                                              FormsPage
                                                |-- FormCard[] (grid)
                                              FormDetailPage
                                                |-- FormFieldRenderer[]
                                                |     |-- TextInput, Select, etc.
                                                |     |-- SignatureCanvas → uploadSignature
                                                |     |-- ImageCapture → uploadFile
                                                |     |-- ContactLookup → supabase.rpc('search_contacts')
                                                |-- FormFooter (Save Draft / Submit)
```

**Form fill lifecycle:**
1. User opens FormsPage → `useFormViewer` loads templates
2. User taps FormCard → `selectTemplate(slug)` → navigate to `/forms/:slug`
3. `useFormSubmission(templateId)` initializes → checks for existing draft → creates or resumes
4. User fills fields → `updateField(key, value)` per change → isDirty=true
5. 3s idle → auto-save fires → Supabase UPDATE
6. User taps Submit → `validate()` → `saveDraft()` → copy `fields_snapshot` → UPDATE status='submitted'

---

## 3. Component Architecture & TypeScript Contracts

### 3.1 Component Tree

```
App.tsx
├── /forms → FormsPage
│   ├── FormsPageHeader (hero text + tagline)
│   ├── FormsSearchBar (search input)
│   ├── PinnedFormsSection
│   │   └── FormCard[]
│   ├── AllFormsSection
│   │   └── FormCard[]
│   └── FormsEmptyState
│
└── /forms/:slug → FormDetailPage
    ├── FormHeader (back button, icon, title, save indicator)
    ├── FormProgressBar (filled fields / total)
    ├── FormBody
    │   └── FormSection[] (grouped by header fields)
    │       ├── FormSectionHeader
    │       └── FormFieldRenderer[]
    │           ├── FormFieldWrapper (label, required *, hint, error)
    │           └── [specific field component]
    └── FormFooter (Save Draft, Submit — sticky on mobile)
```

### 3.2 File Structure

```
src/
├── types/
│   └── forms.ts                          # All interfaces (NEW)
├── pages/
│   ├── Forms.tsx                         # /forms list page (NEW)
│   └── FormDetail.tsx                    # /forms/:slug fill page (NEW)
├── components/
│   └── forms/                            # NEW directory
│       ├── FormCard.tsx
│       ├── FormHeader.tsx
│       ├── FormBody.tsx
│       ├── FormSection.tsx
│       ├── FormFieldRenderer.tsx         # Switch/map for 17 types
│       ├── FormFieldWrapper.tsx          # Label + hint + error wrapper
│       ├── FormFooter.tsx
│       ├── FormProgressBar.tsx
│       ├── FormSkeleton.tsx
│       ├── FormsGridSkeleton.tsx
│       └── fields/
│           ├── TextFieldInput.tsx
│           ├── TextareaFieldInput.tsx
│           ├── DateFieldInput.tsx
│           ├── TimeFieldInput.tsx
│           ├── DateTimeFieldInput.tsx
│           ├── SelectFieldInput.tsx
│           ├── RadioFieldInput.tsx
│           ├── CheckboxFieldInput.tsx
│           ├── NumberFieldInput.tsx
│           ├── PhoneFieldInput.tsx
│           ├── EmailFieldInput.tsx
│           ├── SignatureFieldInput.tsx
│           ├── ImageFieldInput.tsx
│           ├── FileFieldInput.tsx
│           ├── InstructionsField.tsx
│           └── ContactLookupFieldInput.tsx
├── hooks/
│   ├── use-form-templates.ts             # NEW
│   ├── use-form-template.ts              # NEW (single by slug)
│   ├── use-form-submission.ts            # NEW
│   ├── use-form-submissions.ts           # NEW
│   ├── use-form-contacts.ts              # NEW
│   ├── use-form-attachments.ts           # NEW
│   ├── use-pinned-forms.ts               # NEW
│   ├── use-form-validation.ts            # NEW
│   ├── use-form-autosave.ts              # NEW
│   └── use-signed-url.ts                 # NEW
└── lib/
    └── form-utils.ts                     # NEW
        # groupFieldsIntoSections(), evaluateCondition(),
        # getFieldLabel(), validateFieldValue()
```

**Total new files: ~35** (1 types, 2 pages, ~13 components, ~16 field components, ~10 hooks, 1 utility)

### 3.3 FormFieldRenderer Architecture

Uses a static `Record<FormFieldType, ComponentType>` map for O(1) lookup:

```typescript
const FIELD_COMPONENT_MAP: Record<FormFieldType, React.ComponentType<FieldInputProps>> = {
  text: TextFieldInput,
  textarea: TextareaFieldInput,
  date: DateFieldInput,
  // ... all 17 types
};
// 'header' handled at FormBody level, not rendered by FormFieldRenderer
```

**Common wrapper:** `FormFieldWrapper` provides consistent label + required asterisk + hint + error for every field.

**Conditional visibility:** Evaluated at `FormBody` level before rendering. Hidden fields are not rendered but values are preserved in state.

**Performance:** `FormFieldRenderer` wrapped in `React.memo` with custom comparator on `value`, `error`, `language`, `field.key`. Single stable `onChange` callback passed down via `useCallback`.

### 3.4 Routing Integration

Add to `App.tsx`:
```typescript
<Route path="/forms" element={<ProtectedRoute><Forms /></ProtectedRoute>} />
<Route path="/forms/:slug" element={<ProtectedRoute><FormDetail /></ProtectedRoute>} />
```

Add "Forms" to nav sidebar + MobileTabBar with `ClipboardList` icon. Position: after LEARN section, before Ask AI.

### 3.5 UI Component Reuse

| Field Type | shadcn/ui Component |
|------------|-------------------|
| text, phone, email, number | `<Input>` with appropriate `type` and `inputMode` |
| textarea | `<Textarea>` (auto-expanding) |
| date | `<Popover>` + `<Calendar>` (mobile: native `<input type="date">`) |
| time | Native `<input type="time">` |
| select | `<Select>` + `<SelectContent>` |
| radio | `<RadioGroup>` + `<RadioGroupItem>` |
| checkbox | `<Checkbox>` (one per option) |
| signature | `signature_pad` with `useRef<HTMLCanvasElement>` |
| image | Native `<input type="file" accept="image/*">` + preview grid |
| contact_lookup | `<Popover>` + `<Command>` (cmdk) search |
| header | `<Separator>` + `<h3>` |
| instructions | `<div>` with info styling |

### 3.6 New Dependencies

```bash
npm install react-signature-canvas browser-image-compression
npm install -D @types/react-signature-canvas
```

**Alternative (recommended by Devil's Advocate):** Use `signature_pad` directly instead of `react-signature-canvas` to avoid the stale React wrapper and `findDOMNode` deprecation warning.

---

## 4. UX/UI Design & Mobile-First Implementation

### 4.1 Design System Alignment

All Form Builder UI inherits the existing Alamo Prime design system:
- Card radius: 16px (`rounded-[20px]` with shadow-card)
- Touch targets: 44px minimum (`h-11`)
- Spacing: 8pt grid
- Primary: Indigo (focus rings, CTAs)
- Destructive: Red (errors, required indicators)

### 4.2 Forms List Page — Mobile (375px)

```
+---------------------------------------+
|  [=] Header            [lang] [search]|
+---------------------------------------+
|                                       |
|  Forms                                |
|  Find and fill out forms              |
|                                       |
|  +-----------------------------------+|
|  | [Q] Search forms...           [x] ||
|  +-----------------------------------+|
|                                       |
|  PINNED                               |
|  +-----------------------------------+|
|  | +------+                          ||
|  | |[icon]|  Employee Write-Up    [*]||
|  | |  !!  |  Document employee       ||
|  | +------+  performance issues...   ||
|  +-----------------------------------+|
|                                       |
|  ALL FORMS                            |
|  +-----------------------------------+|
|  | +------+                          ||
|  | |[icon]|  Employee Injury      [o]||
|  | | [+]  |  Report                  ||
|  | +------+  Document workplace...   ||
|  +-----------------------------------+|
+---------------------------------------+
| [Manual] [Search] [Recipes] [Profile] |
+---------------------------------------+
```

- **Grid:** `grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4`
- **Card design:** Icon tile (48x48), title, 2-line description, pin button
- **Pinned section:** Only shown if ≥1 form pinned; "PINNED" label in uppercase muted text
- **Search:** Client-side filter on title + description, 200ms debounce
- **Empty state:** Magnifying glass icon + "No forms found" + Clear Search button
- **Loading:** Spinner (Loader2) or skeleton cards

### 4.3 Form Detail / Fill Page — Mobile

```
+---------------------------------------+
| [<-] Employee Injury Report    [Save] |  ← Sticky header
+---------------------------------------+
|  [===========---------]  18/34       |  ← Progress bar
+---------------------------------------+
|                                       |
|  --- Injured Employee ----------     |  ← Section header
|                                       |
|  Employee Full Name *                 |
|  +-----------------------------------+|
|  | John Smith                        ||
|  +-----------------------------------+|
|  Full legal name as it appears       |  ← Hint text
|                                       |
|  Department *                         |
|  +-----------------------------------+|
|  | Select department...          [v] ||
|  +-----------------------------------+|
|                                       |
|  ...continues scrolling...            |
|                                       |
|  --- Signatures -----------------    |
|                                       |
|  Manager Signature *                  |
|  +-----------------------------------+|
|  |         [Draw here]               ||
|  +-----------------------------------+|
|  [Clear]                    [Confirm] |
|                                       |
+---------------------------------------+
|  [Save Draft]       [Submit Report]   |  ← Sticky footer
+---------------------------------------+
| [Manual] [Search] [Recipes] [Profile] |
+---------------------------------------+
```

**Key design decisions:**
- **Sticky header:** Back button (orange pill), truncated title, save indicator
- **Progress bar:** Thin (h-1.5), counts filled / total fillable fields
- **Section headers:** `border-t` + section title, provides breathing room
- **Field spacing:** 20px between fields, label above input (not beside)
- **Required indicator:** Red asterisk ` *` after label
- **Hint text:** Below input, `text-xs text-muted-foreground`
- **Error state:** Red border + error text replaces hint, `role="alert"`
- **Sticky footer:** Above MobileTabBar (`bottom-[72px]`), backdrop-blur

### 4.4 Field Type UX Specifications

| Type | Spec |
|------|------|
| **text/phone/email/number** | `<Input>` h-11, appropriate `inputMode` for mobile keyboard |
| **textarea** | Auto-expanding, min-h-[88px], max-h-[240px] then scroll |
| **date/time/datetime** | Native `<input>` on mobile (best UX). Calendar popover on desktop for date. |
| **select** | Radix Select, 44px trigger, portal dropdown |
| **radio** | Vertical stack, 44px rows. Yes/No renders horizontal. |
| **checkbox** | 44px rows, 2-column grid for >6 options |
| **signature** | Full-width canvas (160px height), `touch-action: none`, Clear/Undo/Confirm buttons, preview after confirm |
| **image** | Dashed dropzone, `<input accept="image/*">`, 80x80 thumbnail grid, max 5 per field |
| **file** | Dashed dropzone, file list with name/size/remove |
| **contact_lookup** | Searchable popover with live RPC query, shows name + phone + address, stores ContactLookupValue |
| **header** | Section divider (border-t + h3 title) |
| **instructions** | Info callout card with `bg-info/5` |

### 4.5 Form Submission Flow

1. **Auto-save:** Triggers after 5s idle, on field blur, on "Save Draft" tap, on beforeunload. Shows "Saving..." → "Saved at 3:42 PM" → fades out.
2. **Validation on submit only:** Not on blur (less frustrating for 34-field forms). Scrolls to first error with `scrollIntoView({ behavior: 'smooth' })`.
3. **Submit confirmation:** AlertDialog: "Submit Employee Injury Report?" with Cancel/Submit buttons.
4. **Success state:** Full-page checkmark animation (subtle, not confetti — these are serious forms). "View Submission" and "Back to Forms" buttons.
5. **Unsaved changes warning:** AlertDialog on back/navigation if isDirty. Auto-save flush on "Leave".

### 4.6 Progress & Section Navigation

- **Progress bar:** Thin in sticky header, "18 of 34" label
- **Section jump** (5+ sections): Floating pill button → expands to bottom drawer with section list + completion counts

### 4.7 Accessibility

- All inputs have `<label htmlFor={key}>` associations
- Required: `aria-required="true"`, asterisk is `aria-hidden="true"` with `sr-only` "(required)"
- Errors: `aria-invalid="true"`, `aria-describedby` linking to error message, `role="alert"`
- Focus management: no auto-focus on load; focus moves to first invalid field on submit
- Keyboard: Radix components handle arrow keys, Tab order follows DOM order

### 4.8 Dark Mode

- Form cards: `bg-card` with semantic tokens
- Inputs: `bg-background` + `border-input` tokens
- Signature canvas: `bg-card` with `text-foreground` stroke color (inverts naturally)
- Conditional fields: `bg-muted/50` container tint when appearing

### 4.9 Animations

- Card tap: `active:scale-[0.99]` (150ms)
- Conditional field show/hide: `animate-accordion-down` / `animate-accordion-up` (200ms)
- Save indicator: fade-in → cross-fade → fade-out (3s delay)
- Submit success: scale-in checkmark (200ms)
- Error scroll: field border pulse (single, 300ms)

### 4.10 Bilingual (EN/ES)

- Field labels: `language === 'es' && field.label_es ? field.label_es : field.label`
- Section headers: same pattern with `section_es`
- Fixed UI strings: "Forms"/"Formularios", "Save Draft"/"Guardar Borrador", "Submit"/"Enviar"
- Field options: English-only in Phase 2 (options_es deferred)

---

## 5. Critical Review & Risk Assessment

> **Reviewer:** Devil's Advocate Agent
> **Date:** 2026-02-23

### 5.1 Architecture Risks

| ID | Risk | Severity | Mitigation |
|----|------|----------|------------|
| R1 | **17 field components** — 7 are trivial `<Input type={x}>` wrappers | Low | Consider merging text/phone/email/number/date/time/datetime into a single `InputField.tsx` with type prop. Reduces 7 files to 1. |
| R2 | **State management complexity** — 34 fields + conditions + auto-save + validation in one hook | Medium | Use `useReducer` for field values. Keep auto-save, validation, and upload logic as separate hooks that compose. |
| R3 | **Re-render performance** — single `useState` object causes all 34 fields to re-render on every keystroke | Medium | Wrap `FormFieldRenderer` in `React.memo`. Use stable `useCallback` for onChange. Consider `react-hook-form` for uncontrolled inputs. |
| R4 | **Bundle size** — +44KB gzipped from new dependencies | Low | Dynamic import both `react-signature-canvas` and `browser-image-compression` via `React.lazy`. |

### 5.2 Edge Cases to Test

| ID | Edge Case | Risk | Mitigation |
|----|-----------|------|------------|
| E1 | Empty template (0 fields) | Low | Render EmptyState, hide Submit button |
| E2 | All fields optional — blank submission | Low | Allow with confirmation dialog |
| E3 | Circular conditional dependencies | Low (no seed data has cycles) | Add cycle detection on template load, treat circular fields as always-visible |
| E4 | Very long textarea (100K+ chars) | Medium | Add `maxLength: 10000` default, show character counter |
| E5 | Multiple signature canvases (both forms have 2) | Medium | Manage independently per field. Lazy-mount via IntersectionObserver |
| E6 | 10MB image on slow 3G | Medium | Show 3-phase indicator: "Compressing..." → "Uploading..." → "Done". Catch OOM errors. |
| E7 | Offline/poor connectivity | Medium | Persist to localStorage on each auto-save. On load, check for newer localStorage state. |
| E8 | Browser back with unsaved changes | High | `useBlocker()` (React Router v6.4+) + `beforeunload` listener when isDirty |
| E9 | Session timeout during long form | Medium | `useSessionWatchdog()` — check session every 5 min, show re-auth modal |
| E10 | Camera app restarts browser on Android | High | Aggressive auto-save before camera intent. Persist to localStorage as backup. |
| E11 | Language switch mid-form | Low | Values are language-agnostic. Labels switch, data persists. |

### 5.3 Security Concerns

| ID | Concern | Severity | Mitigation |
|----|---------|----------|------------|
| S1 | Managers can see all draft submissions (privacy for write-ups about other managers) | Low | Acceptable for Phase 2. Consider draft-only visibility restriction in a future phase. |
| S2 | Storage upload path not ownership-scoped | Medium | Use `{submissionId}/{fieldKey}/...` path structure. Verify submission belongs to user before upload. |
| S3 | MIME type spoofing on uploads | Low | Client-side validation + server bucket restriction. Acceptable for trusted employees. |
| S4 | Signature PNG reuse across submissions | Low | Document limitation. Not a concern for restaurant operational forms. |

### 5.4 Mobile-Specific Risks

| ID | Risk | Mitigation |
|----|------|------------|
| M1 | Signature pad touch handling (iOS pull-to-refresh) | `touch-action: none` CSS + `event.preventDefault()` in touch handlers |
| M2 | Keyboard pushes field off-screen | Use `scrollIntoView()` on focus. Avoid nested scroll containers. |
| M3 | Firefox Android: no native date picker | Use `react-day-picker` Calendar for date fields, native for time |
| M4 | Camera permission failures (silent) | Show helper text if file input returns empty |
| M5 | Large PDF upload (>10MB) | Client-side size check with clear error message before upload attempt |

### 5.5 Missing Requirements / Gaps

| ID | Gap | Priority | Recommendation |
|----|-----|----------|----------------|
| G1 | **No "My Submissions" view** — user cannot find their saved drafts | High | Add draft resume flow: on `/forms/:slug`, check for existing draft and auto-resume. Show "My Drafts" picker if multiple exist. |
| G2 | **Status workflow undefined** — when is `completed` vs `submitted` used? | Medium | Phase 2: only use `draft` → `submitted`. `completed` and `archived` are Phase 3+ transitions. |
| G3 | **Can users delete drafts?** | Medium | No (RLS restricts DELETE to admin). Users can only abandon drafts. Acceptable for Phase 2. |
| G4 | **Edit after submit** | Medium | UI should lock submitted/archived forms as read-only even though RLS allows update. |
| G5 | **Print before Phase 7** | Medium | Add `@media print` stylesheet (hide nav, expand sections). Lightweight, immediate value. |
| G6 | **Resume draft flow** | High | On navigate to `/forms/:slug`: check for existing draft. If 1 exists, auto-resume. If multiple, show picker. If 0, create new. |
| G7 | **`contact_lookup` data shape** | Medium | Store as `{ contact_id, name, phone, address }` — denormalized so submission is self-contained. |
| G8 | **`fields_snapshot` timing** | Medium | Capture at submit time (not draft creation). This preserves the form structure the user actually submitted against. |

### 5.6 Dependency Recommendations

| Package | Recommendation |
|---------|---------------|
| `react-signature-canvas` | **Consider using `signature_pad` directly** (v5.0.4, actively maintained) with `useRef<HTMLCanvasElement>`. The React wrapper is stale (last updated 2021), uses deprecated `findDOMNode`. |
| `browser-image-compression` | Good choice. Ensure `useWebWorker: true`. Test that CSP headers don't block blob workers. |
| `react-hook-form` | Already installed but not required for Phase 2. Dynamic forms with runtime JSONB fields work better with custom `useReducer` state. Consider for Phase 5 (Form Builder) which has static admin form fields. |

### 5.7 Performance Budget

| Concern | Target | Approach |
|---------|--------|----------|
| Re-renders per keystroke | 0-1 per field | `React.memo` on FormFieldRenderer |
| 34-field form on budget Android | <16ms frame time | `content-visibility: auto` on below-fold sections |
| Image compression | Non-blocking | `useWebWorker: true` with main-thread fallback |
| Storage upload | Progress feedback | Show spinner overlay on field during upload |

---

## Appendix: Verification Checklist

After Phase 2 implementation, verify:

- [ ] Forms grid renders with 2 seed forms
- [ ] Pin/unpin persists across page reloads
- [ ] Search filters forms by title (EN and ES)
- [ ] Each of the 17 field types renders correctly
- [ ] Signature pad: draw → clear → undo → confirm → uploads to storage
- [ ] Image field: take photo / select → preview → compress → upload
- [ ] Contact lookup: search → select → value stored
- [ ] Conditional fields: show/hide based on controlling field value
- [ ] Required field validation prevents submission when empty
- [ ] Draft save persists and reloads on return
- [ ] Auto-save fires after idle period
- [ ] Submit changes status and shows success state
- [ ] Unsaved changes warning on back navigation
- [ ] Mobile responsive: form fills well on 375px screen
- [ ] Dark mode: all elements respect theme tokens
- [ ] Bilingual: labels switch on language toggle
- [ ] Print: `Ctrl+P` produces readable output
- [ ] Performance: no visible jank on 34-field form
