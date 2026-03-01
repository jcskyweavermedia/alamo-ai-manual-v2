# Phase 5: Form Builder Admin -- Frontend Architecture

> **Status:** Planning
> **Date:** 2026-02-25
> **Dependencies:** Phase 1 (DB Foundation), Phase 2 (Form Viewer), Phase 3 (AI Form Filling), Phase 5 DB Plan, Phase 5 Backend Plan
> **Estimated effort:** ~3 sessions (frontend only)
> **Author:** Senior Technical Architect (Opus)

---

## Table of Contents

1. [Route Structure](#1-route-structure)
2. [Component Tree](#2-component-tree)
3. [State Management](#3-state-management)
4. [Key TypeScript Interfaces](#4-key-typescript-interfaces)
5. [Data Flow Diagrams](#5-data-flow-diagrams)
6. [Reuse Strategy](#6-reuse-strategy)
7. [File Organization](#7-file-organization)
8. [Performance Considerations](#8-performance-considerations)

---

## 1. Route Structure

Three new routes, all admin-protected:

```
/admin/forms              AdminFormsListPage    Template list (draft/published/archived)
/admin/forms/new          AdminFormBuilderPage   New template wizard (blank, AI, clone)
/admin/forms/:id/edit     AdminFormBuilderPage   Edit existing template in builder
```

### Route Registration in `App.tsx`

```tsx
// New imports
import AdminFormsList from "./pages/AdminFormsList";
import AdminFormBuilder from "./pages/AdminFormBuilder";

// New routes (inside <Routes>, before the catch-all)
<Route path="/admin/forms" element={
  <ProtectedRoute requiredRole="manager">
    <AdminFormsList />
  </ProtectedRoute>
} />
<Route path="/admin/forms/new" element={
  <ProtectedRoute requiredRole="manager">
    <AdminFormBuilder />
  </ProtectedRoute>
} />
<Route path="/admin/forms/:id/edit" element={
  <ProtectedRoute requiredRole="manager">
    <AdminFormBuilder />
  </ProtectedRoute>
} />
```

**Access control:** `requiredRole="manager"` allows both `manager` and `admin` roles (matching the existing RLS policies on `form_templates` for INSERT/UPDATE).

---

## 2. Component Tree

### 2.1 Full Hierarchy

```
App.tsx
  BrowserRouter
    Routes
      /admin/forms .............. AdminFormsListPage
      |  AppShell
      |    AdminFormsHeader            (title, create button, search)
      |    AdminFormsTable             (sortable table of all templates)
      |      AdminFormRow              (single row: title, status, version, actions)
      |        StatusBadge             (draft/published/archived pill)
      |        TemplateActionMenu      (edit, duplicate, publish/unpublish, archive, delete)
      |    EmptyFormsState             (no templates yet CTA)
      |
      /admin/forms/new ......... AdminFormBuilderPage
      /admin/forms/:id/edit .... AdminFormBuilderPage
         BuilderProvider               (React Context wrapping entire page)
           AppShell
             BuilderTopBar             (back, title input, save, publish buttons)
             BuilderLayout             (split-pane: sidebar + main)
               BuilderSidebar          (desktop: left column, mobile: bottom sheet)
                 BuilderTabs           (Fields | Instructions | AI Tools | Settings)
                   FieldsTab
                     FieldBlockList    (drag-and-drop sortable list via @dnd-kit)
                       FieldBlockItem  (single field block: icon, label, type, grip)
                     AddFieldButton    (opens FieldTypePicker)
                     FieldTypePicker   (grid of 17 field type tiles)
                   InstructionsTab
                     InstructionsEditor (textarea for EN/ES instructions)
                     AIRefineChat       (chat interface for AI refinement)
                   AIToolsTab
                     AIToolsPicker      (toggle cards loaded from form_ai_tools)
                     ToolRecommendations (smart keyword-based suggestions)
                   SettingsTab
                     TemplateMetaForm   (slug, icon, description, header image)
                     DangerZone         (archive, delete)
               BuilderMainArea         (right column / full mobile)
                 FieldPropertyPanel     (when a field is selected: edit properties)
                   FieldBasicProperties (key, label EN/ES, required, placeholder)
                   FieldTypeProperties  (type-specific: options, validation, hint)
                   FieldConditionEditor (conditional visibility setup)
                   FieldAIHintEditor    (ai_hint textarea)
                 LivePreview            (rendered form using FormBody + FormSection)
                   PreviewToggle        (edit/preview mode switch)
                   FormBody             (REUSED from viewer)
                     FormSection        (REUSED from viewer)
                       FormFieldRenderer (REUSED from viewer)
               AIFillabilityIndicator   (score ring: red/yellow/green)
             BuilderMobileNav          (bottom tabs for mobile: Fields/Preview/Settings)
```

### 2.2 AdminFormsListPage -- Detail

```
AdminFormsListPage
  AppShell (language, headerLeft=back button)
    AdminFormsHeader
      Page title: "Form Templates"
      Search input (local filter)
      Create button -> navigates to /admin/forms/new
      Status filter tabs: All | Draft | Published | Archived
    AdminFormsTable
      Table columns: Title | Status | Version | Fields | Updated | Actions
      AdminFormRow (per template)
        Title cell: icon + title_en
        StatusBadge: draft (gray), published (green), archived (amber)
        Version cell: "v3"
        Fields cell: "24 fields"
        Updated cell: relative time ("2 hours ago")
        TemplateActionMenu (dropdown)
          Edit -> /admin/forms/:id/edit
          Duplicate -> calls cloneTemplate()
          Publish/Unpublish toggle
          Archive
          Delete (only if no submissions)
      EmptyFormsState (when filtered list is empty)
```

### 2.3 AdminFormBuilderPage -- Detail

```
AdminFormBuilderPage
  BuilderProvider (wraps entire page in context)
    AppShell (aiPanel=null, headerLeft=back button)
      BuilderTopBar
        Back button -> /admin/forms (with unsaved changes warning)
        Title input (inline editable, binds to title_en)
        Save status indicator: "Saved" / "Saving..." / "Unsaved changes"
        [Save Draft] button (manual save)
        [Publish] button (validation -> version bump -> status change)
      BuilderLayout (flex row on desktop, stacked on mobile)
        BuilderSidebar (w-72 on desktop, bottom sheet on mobile)
          BuilderTabs (shadcn/ui Tabs)
            TabsTrigger: Fields | Instructions | AI Tools | Settings

            --- FieldsTab ---
            FieldBlockList (@dnd-kit/sortable)
              DndContext + SortableContext
                FieldBlockItem (per field, sorted by order)
                  Grip handle (drag)
                  Field type icon
                  Field label (truncated)
                  Field type badge
                  Required indicator
                  Click -> selects field, opens FieldPropertyPanel
                  Delete button (with confirmation for required fields)
            AddFieldButton
              Click -> opens FieldTypePicker (popover or sheet)
            FieldTypePicker
              Grid of 17 field type tiles
              Each tile: icon + label + description
              Click -> creates new field at end, selects it

            --- InstructionsTab ---
            InstructionsEditor
              Language toggle: EN | ES
              Textarea (instructions_en or instructions_es)
              Character count
              [AI Refine] button -> opens AIRefineChat
            AIRefineChat
              Reuses FormAIContent pattern (conversation + input bar)
              Calls refine-form-instructions edge function
              Shows refined instructions + explanation + suggestions
              [Accept] / [Edit More] / [Reject] actions

            --- AIToolsTab ---
            AIToolsPicker
              Fetches from form_ai_tools table (useFormAITools hook)
              Toggle card per tool:
                Icon + label (bilingual)
                Description text
                Switch toggle (on/off)
                Active state styling
            ToolRecommendations
              Keyword-based suggestions (client-side, no API call)
              "Based on your form title and fields, we recommend:"
              Clickable suggestion -> toggles the tool on

            --- SettingsTab ---
            TemplateMetaForm
              Slug input (auto-generated from title, editable, availability check)
              Icon picker (Lucide icon grid, reuses existing pattern)
              Description EN/ES textareas
              Header image upload (to form-attachments bucket)
              Language selector (en/es/both)
            DangerZone
              [Archive Template] (if published)
              [Delete Template] (if no submissions, with confirmation)

        BuilderMainArea (flex-1)
          When a field is selected:
            FieldPropertyPanel
              FieldBasicProperties
                Key input (auto-generated from label, snake_case, read-only after save)
                Label EN input
                Label ES input
                Required toggle
                Placeholder input
                Section name input
                Width selector (full / half)
              FieldTypeProperties (type-specific panel)
                For select/radio/checkbox:
                  OptionsEditor (add/remove/reorder options list)
                For number:
                  Min/Max inputs
                For text/phone/email:
                  Pattern input (regex validation)
                For contact_lookup:
                  Category filter selector
                For image:
                  Max photos selector (1-5)
              FieldConditionEditor
                Enable/disable conditional visibility
                Field selector (dropdown of available field keys -- all fields except current)
                Operator selector (eq/neq/in/exists)
                Value input (depends on referenced field type)
              FieldAIHintEditor
                AI hint textarea
                Tooltip: "Tell the AI how to extract this field from user input"
          When no field is selected:
            LivePreview
              PreviewToggle (builder view / user preview)
              FormBody (REUSED from viewer -- read-only mode)
                FormSection (REUSED)
                  FormFieldRenderer (REUSED -- disabled inputs)
```

---

## 3. State Management

### 3.1 Architecture: React Context + useReducer + Undo Middleware

The builder uses a dedicated `BuilderProvider` context with a `useReducer` for deterministic state transitions. This matches the existing `IngestDraftContext` pattern but adds undo/redo support.

**Why not just hooks?** The builder has deeply interconnected state (field list, selected field, dirty tracking, undo stack, auto-save timer) that multiple components at different tree depths need to read and write. A context with a reducer centralizes all mutations and makes undo/redo trivial.

**Why not Zustand/Jotai?** The project has zero external state management libraries. `IngestDraftContext` already established the Context + useReducer pattern. Adding a new dependency for one feature is unjustified.

### 3.2 BuilderState Interface

```typescript
// src/contexts/BuilderContext.tsx

export interface BuilderState {
  // ---- Template data (mirrors DB columns) ----
  templateId: string | null;           // null for new templates
  slug: string;
  titleEn: string;
  titleEs: string;
  descriptionEn: string;
  descriptionEs: string;
  icon: string;
  headerImage: string | null;
  fields: FormFieldDefinition[];
  instructionsEn: string;
  instructionsEs: string;
  aiTools: string[];
  status: FormTemplateStatus;
  templateVersion: number;
  createdBy: string | null;

  // ---- UI state ----
  selectedFieldKey: string | null;     // Which field is selected for editing
  activeTab: BuilderTab;               // 'fields' | 'instructions' | 'ai-tools' | 'settings'
  previewMode: boolean;                // true = show live preview, false = show property panel
  instructionLanguage: 'en' | 'es';    // Which language tab is active in InstructionsEditor

  // ---- Dirty tracking ----
  isDirty: boolean;
  isSaving: boolean;
  lastSavedAt: Date | null;
  serverUpdatedAt: string | null;      // For optimistic concurrency (compare before save)
  hasUnpublishedChanges: boolean;      // true when published template has been edited since last publish

  // ---- Undo/Redo ----
  undoStack: BuilderSnapshot[];        // Past states (max 30)
  redoStack: BuilderSnapshot[];        // Future states after undo

  // ---- AI refinement ----
  refinementHistory: RefinementMessage[];

  // ---- Creation mode ----
  creationMode: CreationMode | null;   // 'blank' | 'ai-text' | 'ai-image' | 'ai-file' | 'clone'
  aiGenerating: boolean;               // true while generate-form-template is running
}

export type BuilderTab = 'fields' | 'instructions' | 'ai-tools' | 'settings';
export type CreationMode = 'blank' | 'ai-text' | 'ai-image' | 'ai-file' | 'clone';

export interface BuilderSnapshot {
  fields: FormFieldDefinition[];
  instructionsEn: string;
  instructionsEs: string;
  aiTools: string[];
  titleEn: string;
  descriptionEn: string;
}

export interface RefinementMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  refinedInstructions?: string;
  explanation?: string;
  suggestions?: string[];
  action?: 'accepted' | 'rejected';
}
```

### 3.3 BuilderAction Union Type

```typescript
export type BuilderAction =
  // ---- Template metadata ----
  | { type: 'SET_TEMPLATE_META'; payload: Partial<Pick<BuilderState,
      'titleEn' | 'titleEs' | 'descriptionEn' | 'descriptionEs' |
      'icon' | 'headerImage' | 'slug'>> }
  | { type: 'SET_STATUS'; payload: FormTemplateStatus }

  // ---- Field operations ----
  | { type: 'ADD_FIELD'; payload: FormFieldDefinition }
  | { type: 'REMOVE_FIELD'; payload: string }              // field key
  | { type: 'UPDATE_FIELD'; payload: { key: string; updates: Partial<FormFieldDefinition> } }
  | { type: 'MOVE_FIELD'; payload: { activeKey: string; overKey: string } }
  | { type: 'REPLACE_ALL_FIELDS'; payload: FormFieldDefinition[] }

  // ---- Field selection ----
  | { type: 'SELECT_FIELD'; payload: string | null }       // field key or null to deselect

  // ---- Instructions ----
  | { type: 'UPDATE_INSTRUCTIONS'; payload: { language: 'en' | 'es'; value: string } }

  // ---- AI Tools ----
  | { type: 'TOGGLE_TOOL'; payload: string }               // tool id to toggle
  | { type: 'SET_TOOLS'; payload: string[] }                // replace all tools

  // ---- UI state ----
  | { type: 'SET_ACTIVE_TAB'; payload: BuilderTab }
  | { type: 'SET_PREVIEW_MODE'; payload: boolean }
  | { type: 'SET_INSTRUCTION_LANGUAGE'; payload: 'en' | 'es' }
  | { type: 'SET_CREATION_MODE'; payload: CreationMode | null }

  // ---- Undo / Redo ----
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'PUSH_UNDO_SNAPSHOT' }                         // manually push current state to undo stack

  // ---- Save lifecycle ----
  | { type: 'SAVE_START' }
  | { type: 'SAVE_SUCCESS'; payload: { updatedAt: string; templateId?: string } }
  | { type: 'SAVE_ERROR' }
  | { type: 'MARK_DIRTY' }
  | { type: 'MARK_CLEAN' }

  // ---- Publish lifecycle ----
  | { type: 'PUBLISH_CHANGES' }        // For re-publishing an already-published template (bumps version, resets hasUnpublishedChanges)

  // ---- AI generation ----
  | { type: 'AI_GENERATE_START' }
  | { type: 'AI_GENERATE_SUCCESS'; payload: GenerateTemplateResult }
  | { type: 'AI_GENERATE_ERROR' }

  // ---- AI refinement ----
  | { type: 'ADD_REFINEMENT_MESSAGE'; payload: RefinementMessage }
  | { type: 'CLEAR_REFINEMENT_HISTORY' }
  | { type: 'ACCEPT_REFINED_INSTRUCTIONS'; payload: { language: 'en' | 'es'; instructions: string } }

  // ---- Hydration (load from DB) ----
  | { type: 'HYDRATE'; payload: FormTemplate }
  | { type: 'RESET' };
```

### 3.4 Reducer with Undo Middleware

The reducer wraps mutating actions (field ops, instruction changes, tool changes, metadata changes) with automatic undo snapshot pushes:

```typescript
const UNDOABLE_ACTIONS = new Set<BuilderAction['type']>([
  'ADD_FIELD', 'REMOVE_FIELD', 'UPDATE_FIELD', 'MOVE_FIELD',
  'REPLACE_ALL_FIELDS', 'UPDATE_INSTRUCTIONS', 'TOGGLE_TOOL',
  'SET_TOOLS', 'SET_TEMPLATE_META',
]);

const MAX_UNDO_STACK = 30;

function takeSnapshot(state: BuilderState): BuilderSnapshot {
  return {
    fields: structuredClone(state.fields),
    instructionsEn: state.instructionsEn,
    instructionsEs: state.instructionsEs,
    aiTools: [...state.aiTools],
    titleEn: state.titleEn,
    descriptionEn: state.descriptionEn,
  };
}

function builderReducer(state: BuilderState, action: BuilderAction): BuilderState {
  // Auto-push undo snapshot for undoable actions
  let nextState = state;
  if (UNDOABLE_ACTIONS.has(action.type)) {
    const snapshot = takeSnapshot(state);
    nextState = {
      ...state,
      undoStack: [...state.undoStack.slice(-MAX_UNDO_STACK + 1), snapshot],
      redoStack: [],   // Clear redo on new mutation
      isDirty: true,
    };
  }

  switch (action.type) {
    // --- UNDO / REDO ---
    case 'UNDO': {
      if (state.undoStack.length === 0) return state;
      const snapshot = state.undoStack[state.undoStack.length - 1];
      const currentSnapshot = takeSnapshot(state);
      return {
        ...state,
        fields: snapshot.fields,
        instructionsEn: snapshot.instructionsEn,
        instructionsEs: snapshot.instructionsEs,
        aiTools: snapshot.aiTools,
        titleEn: snapshot.titleEn,
        descriptionEn: snapshot.descriptionEn,
        undoStack: state.undoStack.slice(0, -1),
        redoStack: [...state.redoStack, currentSnapshot],
        isDirty: true,
        selectedFieldKey: null,
      };
    }
    case 'REDO': {
      if (state.redoStack.length === 0) return state;
      const snapshot = state.redoStack[state.redoStack.length - 1];
      const currentSnapshot = takeSnapshot(state);
      return {
        ...state,
        fields: snapshot.fields,
        instructionsEn: snapshot.instructionsEn,
        instructionsEs: snapshot.instructionsEs,
        aiTools: snapshot.aiTools,
        titleEn: snapshot.titleEn,
        descriptionEn: snapshot.descriptionEn,
        undoStack: [...state.undoStack, currentSnapshot],
        redoStack: state.redoStack.slice(0, -1),
        isDirty: true,
      };
    }

    // --- FIELD OPERATIONS ---
    case 'ADD_FIELD': {
      const maxOrder = nextState.fields.reduce((max, f) => Math.max(max, f.order), 0);
      const newField = { ...action.payload, order: maxOrder + 1 };
      return {
        ...nextState,
        fields: [...nextState.fields, newField],
        selectedFieldKey: newField.key,
        activeTab: 'fields',
      };
    }
    case 'REMOVE_FIELD':
      return {
        ...nextState,
        fields: nextState.fields.filter(f => f.key !== action.payload),
        selectedFieldKey: nextState.selectedFieldKey === action.payload
          ? null
          : nextState.selectedFieldKey,
      };
    case 'UPDATE_FIELD':
      return {
        ...nextState,
        fields: nextState.fields.map(f =>
          f.key === action.payload.key
            ? { ...f, ...action.payload.updates }
            : f
        ),
      };
    case 'MOVE_FIELD': {
      const { activeKey, overKey } = action.payload;
      const oldIndex = nextState.fields.findIndex(f => f.key === activeKey);
      const newIndex = nextState.fields.findIndex(f => f.key === overKey);
      if (oldIndex === -1 || newIndex === -1) return nextState;
      const reordered = [...nextState.fields];
      const [moved] = reordered.splice(oldIndex, 1);
      reordered.splice(newIndex, 0, moved);
      // Reassign order values sequentially
      const withOrder = reordered.map((f, i) => ({ ...f, order: i + 1 }));
      return { ...nextState, fields: withOrder };
    }
    case 'REPLACE_ALL_FIELDS':
      return { ...nextState, fields: action.payload, selectedFieldKey: null };

    // ... remaining cases follow the same pattern
    // (SET_TEMPLATE_META, UPDATE_INSTRUCTIONS, TOGGLE_TOOL, etc.)

    case 'HYDRATE': {
      const t = action.payload;
      return {
        ...createInitialState(),
        templateId: t.id,
        slug: t.slug,
        titleEn: t.titleEn,
        titleEs: t.titleEs ?? '',
        descriptionEn: t.descriptionEn ?? '',
        descriptionEs: t.descriptionEs ?? '',
        icon: t.icon,
        headerImage: t.headerImage,
        fields: t.fields,
        instructionsEn: t.instructionsEn ?? '',
        instructionsEs: t.instructionsEs ?? '',
        aiTools: t.aiTools,
        status: t.status,
        templateVersion: t.templateVersion,
        createdBy: t.createdBy,
        serverUpdatedAt: t.updatedAt,
        isDirty: false,
      };
    }

    case 'RESET':
      return createInitialState();

    default:
      return state;
  }
}
```

### 3.5 BuilderProvider

```typescript
interface BuilderContextValue {
  state: BuilderState;
  dispatch: Dispatch<BuilderAction>;

  // Derived values (memoized)
  canUndo: boolean;
  canRedo: boolean;
  fillableFieldCount: number;
  aiFillabilityScore: { score: number; issues: string[] };

  // Convenience actions (wrapped dispatch calls)
  addField: (type: FormFieldType) => void;
  removeField: (key: string) => void;
  updateField: (key: string, updates: Partial<FormFieldDefinition>) => void;
  moveField: (activeKey: string, overKey: string) => void;
  selectField: (key: string | null) => void;
  toggleTool: (toolId: string) => void;
  undo: () => void;
  redo: () => void;

  // Save operations
  saveDraft: () => Promise<void>;
  publish: () => Promise<boolean>;

  // AI operations
  generateFromDescription: (description: string) => Promise<void>;
  generateFromImage: (imageBase64: string) => Promise<void>;
  generateFromFile: (content: string, fileName: string) => Promise<void>;
  refineInstructions: (rawInstructions: string) => Promise<void>;
}

const BuilderContext = createContext<BuilderContextValue | null>(null);

export function BuilderProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(builderReducer, createInitialState());
  // ... memoized derived values, convenience actions, save/AI operations
  return (
    <BuilderContext.Provider value={contextValue}>
      {children}
    </BuilderContext.Provider>
  );
}

export function useBuilder(): BuilderContextValue {
  const ctx = useContext(BuilderContext);
  if (!ctx) throw new Error('useBuilder must be used within BuilderProvider');
  return ctx;
}
```

### 3.6 Optimistic Concurrency

The builder tracks `serverUpdatedAt` (the `updated_at` timestamp from the last successful save or load). On save, the hook sends this value as a condition:

```typescript
async function saveDraft(): Promise<void> {
  dispatch({ type: 'SAVE_START' });

  const payload = buildSavePayload(state);

  // Optimistic concurrency: only update if no one else has saved since we loaded
  const { data, error } = await supabase
    .from('form_templates')
    .update(payload)
    .eq('id', state.templateId)
    .eq('updated_at', state.serverUpdatedAt)    // <-- concurrency guard
    .select('id, updated_at')
    .single();

  if (error || !data) {
    dispatch({ type: 'SAVE_ERROR' });
    // Show toast: "This template was modified by another user. Please reload."
    return;
  }

  dispatch({
    type: 'SAVE_SUCCESS',
    payload: { updatedAt: data.updated_at, templateId: data.id },
  });
}
```

If `RETURNING` returns 0 rows (the `eq('updated_at', ...)` filter excluded the row because another admin saved in between), the builder shows a conflict warning and prompts the admin to reload.

---

## 4. Key TypeScript Interfaces

### 4.1 AIToolDefinition (from `form_ai_tools` table)

```typescript
// src/types/builder.ts

/** Matches the form_ai_tools DB row (camelCase). */
export interface AIToolDefinition {
  id: string;                    // e.g., "search_contacts"
  labelEn: string;
  labelEs: string;
  descriptionEn: string;
  descriptionEs: string;
  searchFunction: string | null; // e.g., "search_contacts"
  icon: string | null;           // Lucide icon name
  status: 'active' | 'deprecated';
  sortOrder: number;
  createdAt: string;
}
```

### 4.2 GenerateTemplateResult (from `generate-form-template` edge function)

```typescript
export interface GenerateTemplateResult {
  draft: {
    titleEn: string;
    titleEs: string;
    descriptionEn: string;
    descriptionEs: string;
    icon: string;
    fields: FormFieldDefinition[];
    instructionsEn: string;
    instructionsEs: string;
    aiTools: string[];
  };
  confidence: number;           // 0-1
  missingFields: string[];
  aiMessage: string;
  toolRecommendations: Array<{
    tool: string;
    reason: string;
  }>;
}
```

### 4.2.1 mapGeneratedTemplate() -- snake_case / camelCase Mapping Utility (C5)

The `generate-form-template` edge function returns its top-level draft properties in
snake_case (matching the DB JSONB structure). The Supabase client auto-transforms DB
**column** names to camelCase, but it does NOT transform nested JSONB content returned
from edge functions. A dedicated mapper is required.

```typescript
// src/lib/form-builder/template-mapper.ts

/**
 * Maps the raw snake_case response from the generate-form-template edge function
 * to the camelCase Partial<BuilderState> expected by the builder reducer.
 *
 * Note: fields array items stay in snake_case because FormFieldDefinition uses
 * snake_case property names (ai_hint, label_es, etc.) -- they map directly to the
 * JSONB structure. Only top-level template properties need camelCase mapping.
 */
export function mapGeneratedTemplate(raw: GenerateResponse): Partial<BuilderState> {
  return {
    titleEn: raw.title_en,
    titleEs: raw.title_es,
    descriptionEn: raw.description_en,
    descriptionEs: raw.description_es,
    icon: raw.icon,
    instructionsEn: raw.instructions_en,
    instructionsEs: raw.instructions_es,
    fields: raw.fields.map((f, i) => ({
      ...f,
      order: i + 1,
      // fields JSONB keys stay snake_case (matches FormFieldDefinition)
    })),
    aiTools: raw.ai_tools ?? [],
  };
}

/** The raw shape returned by the generate-form-template edge function draft object. */
interface GenerateResponse {
  title_en: string;
  title_es: string;
  description_en: string;
  description_es: string;
  icon: string;
  instructions_en: string;
  instructions_es: string;
  fields: FormFieldDefinition[];   // already snake_case — no sub-mapping needed
  ai_tools: string[];
}
```

**Where it is called:** Inside `useGenerateTemplate`, after receiving the API response
and before dispatching `AI_GENERATE_SUCCESS`:

```typescript
const mapped = mapGeneratedTemplate(result.draft);
dispatch({ type: 'AI_GENERATE_SUCCESS', payload: mapped });
```

The `AI_GENERATE_SUCCESS` reducer case then spreads `mapped` directly onto `BuilderState`.

---

### 4.3 RefineInstructionsResult (from `refine-form-instructions` edge function)

```typescript
export interface RefineInstructionsResult {
  refinedInstructions: string;
  explanation: string;
  suggestions: string[];
  usage: {
    dailyUsed: number;
    dailyLimit: number;
    monthlyUsed: number;
    monthlyLimit: number;
  };
}
```

### 4.4 Component Props Interfaces

```typescript
// ---------------------------------------------------------------------------
// AdminFormsListPage components
// ---------------------------------------------------------------------------

export interface AdminFormsHeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  statusFilter: FormTemplateStatus | 'all';
  onStatusFilterChange: (status: FormTemplateStatus | 'all') => void;
  onCreateNew: () => void;
  language: 'en' | 'es';
}

export interface AdminFormRowProps {
  template: FormTemplate;
  language: 'en' | 'es';
  onEdit: (id: string) => void;
  onDuplicate: (id: string) => void;
  onTogglePublish: (id: string, publish: boolean) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
}

// ---------------------------------------------------------------------------
// Builder components
// ---------------------------------------------------------------------------

export interface BuilderTopBarProps {
  language: 'en' | 'es';
}

export interface BuilderSidebarProps {
  language: 'en' | 'es';
}

export interface BuilderTabsProps {
  activeTab: BuilderTab;
  onTabChange: (tab: BuilderTab) => void;
  language: 'en' | 'es';
}

export interface FieldBlockItemProps {
  field: FormFieldDefinition;
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  language: 'en' | 'es';
}

export interface FieldTypePickerProps {
  onSelect: (type: FormFieldType) => void;
  onClose: () => void;
  language: 'en' | 'es';
}

export interface FieldPropertyPanelProps {
  field: FormFieldDefinition;
  allFieldKeys: string[];        // For condition editor dropdown
  language: 'en' | 'es';
}

export interface OptionsEditorProps {
  options: string[];
  onChange: (options: string[]) => void;
  language: 'en' | 'es';
}

export interface InstructionsEditorProps {
  instructionsEn: string;
  instructionsEs: string;
  activeLanguage: 'en' | 'es';
  onLanguageChange: (lang: 'en' | 'es') => void;
  onChange: (language: 'en' | 'es', value: string) => void;
  onRefine: () => void;
  language: 'en' | 'es';
}

export interface AIRefineChatProps {
  templateTitle: string;
  fields: FormFieldDefinition[];
  enabledTools: string[];
  language: 'en' | 'es';
  onAccept: (language: 'en' | 'es', instructions: string) => void;
}

export interface AIToolsPickerProps {
  enabledTools: string[];
  onToggle: (toolId: string) => void;
  language: 'en' | 'es';
}

export interface ToolRecommendationsProps {
  templateTitle: string;
  fields: FormFieldDefinition[];
  enabledTools: string[];
  onEnable: (toolId: string) => void;
  language: 'en' | 'es';
}

export interface LivePreviewProps {
  fields: FormFieldDefinition[];
  language: 'en' | 'es';
}

export interface AIFillabilityIndicatorProps {
  score: number;                 // 0-100
  issues: string[];
  language: 'en' | 'es';
}

export interface FieldConditionEditorProps {
  condition: FormFieldCondition | null;
  availableFieldKeys: string[];  // All field keys except the current field (ordering constraint relaxed -- conditions can reference ANY field)
  fieldMap: Map<string, FormFieldDefinition>;
  onChange: (condition: FormFieldCondition | null) => void;
  language: 'en' | 'es';
}
```

### 4.5 Hook Return Types

```typescript
// ---------------------------------------------------------------------------
// useFormBuilder -- orchestrates save, publish, clone, generate
// ---------------------------------------------------------------------------

export interface UseFormBuilderReturn {
  // Save
  saveDraft: () => Promise<void>;
  isSaving: boolean;
  lastSavedAt: Date | null;

  // Publish
  publish: () => Promise<boolean>;
  unpublish: () => Promise<void>;
  isPublishing: boolean;

  // Create
  createTemplate: (draft: Partial<BuilderState>) => Promise<string>;
  cloneTemplate: (sourceId: string) => Promise<string>;

  // Delete / Archive
  deleteTemplate: (id: string) => Promise<void>;
  archiveTemplate: (id: string) => Promise<void>;

  // Slug availability
  checkSlugAvailable: (slug: string, excludeId?: string) => Promise<boolean>;
}

// ---------------------------------------------------------------------------
// useFormAITools -- fetches the form_ai_tools registry
// ---------------------------------------------------------------------------

export interface UseFormAIToolsReturn {
  tools: AIToolDefinition[];
  isLoading: boolean;
  error: Error | null;
}

// ---------------------------------------------------------------------------
// useRefineInstructions -- calls the refine-form-instructions edge function
// ---------------------------------------------------------------------------

export interface UseRefineInstructionsReturn {
  refine: (rawInstructions: string, history?: RefinementMessage[]) => Promise<RefineInstructionsResult | null>;
  isRefining: boolean;
  error: string | null;
}

// ---------------------------------------------------------------------------
// useGenerateTemplate -- calls the generate-form-template edge function
// ---------------------------------------------------------------------------

export interface UseGenerateTemplateReturn {
  generateFromText: (description: string) => Promise<GenerateTemplateResult | null>;
  generateFromImage: (imageBase64: string) => Promise<GenerateTemplateResult | null>;
  generateFromFile: (content: string, fileName: string) => Promise<GenerateTemplateResult | null>;
  isGenerating: boolean;
  error: string | null;
}

// ---------------------------------------------------------------------------
// useAdminFormTemplates -- fetches ALL templates (draft/published/archived)
// ---------------------------------------------------------------------------

export interface UseAdminFormTemplatesReturn {
  templates: FormTemplate[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}
```

### 4.6 FormTemplate Type Extension for Builder Columns (G14)

Phase 5 migrations add three new columns to the `form_templates` table that are not yet
in the existing `FormTemplate` interface. **Update `src/types/forms.ts`** to add these
properties:

```typescript
// src/types/forms.ts  (additions to the existing FormTemplate interface)

// Added by Phase 5: Form Builder Admin
publishedAt: string | null;
builderState: Record<string, unknown> | null;
aiRefinementLog: Array<{ role: string; content: string; timestamp: string }>;
```

**Clarifying the `builderState` column vs. the `BuilderState` context interface:**

| | `FormTemplate.builderState` | `BuilderState` (context) |
|---|---|---|
| **Location** | DB column (`builder_state`) | In-memory React context |
| **What it stores** | Persisted UI state snapshot (collapsed sections, selected field key, active tab) | Full working state: template data + UI state + undo/redo history |
| **Scope** | Narrow JSON blob -- only the UI state worth persisting across sessions | Superset that includes all template data + transient state |
| **Lifecycle** | Written to DB on save; cleared to `NULL` on publish (DB trigger) | Lives only in memory; discarded on page unload |

**Hydration and serialization flow:**

- **On load:** `BuilderState` is hydrated FROM the `FormTemplate` row (including the
  `builderState` column if non-null) -- the saved UI preferences (active tab, selected
  field, collapsed sections) are restored.
- **On save:** The relevant UI state from `BuilderState` is serialized INTO
  `FormTemplate.builderState` (written alongside `fields`, `instructions_en`, etc.).
- **On publish:** The DB trigger `handle_form_template_publish()` sets
  `builder_state = NULL` and `ai_refinement_log = []`, clearing ephemeral builder UI
  from the published record.

**`FieldConditionEditor` prop rename (G14 follow-up):**

The `precedingFieldKeys` prop on `FieldConditionEditorProps` has been renamed to
`availableFieldKeys`. The ordering constraint has been relaxed: conditions can now
reference **any** field in the template, not only fields that appear before the current
one. Populate `availableFieldKeys` with all field keys except the current field's own
key:

```typescript
// In FieldPropertyPanel, when rendering FieldConditionEditor:
const availableFieldKeys = state.fields
  .filter(f => f.key !== selectedField.key)
  .map(f => f.key);
```

---

## 5. Data Flow Diagrams

### 5.1 Load Existing Template

```
User navigates to /admin/forms/:id/edit
         |
         v
AdminFormBuilderPage mounts
         |
         v
useParams() extracts :id
         |
         v
useFormTemplate(id) fetches from Supabase
  supabase.from('form_templates')
    .select('*')
    .eq('id', id)
    .single()
         |
         v
transformTemplateRow(row) -> FormTemplate
         |
         v
dispatch({ type: 'HYDRATE', payload: template })
         |
         v
BuilderState populated:
  - fields[], instructions, aiTools, metadata
  - isDirty = false
  - serverUpdatedAt = template.updatedAt
  - undoStack = [], redoStack = []
         |
         v
UI renders with template data
  - FieldBlockList shows fields in order
  - InstructionsEditor shows instructions
  - AIToolsPicker shows enabled tools
  - SettingsTab shows metadata
```

### 5.2 Create New Template

```
User clicks [Create New Form] on /admin/forms
         |
         v
Navigate to /admin/forms/new
         |
         v
AdminFormBuilderPage mounts, no :id param
         |
         v
dispatch({ type: 'RESET' }) -> empty BuilderState
         |
         v
Show creation mode selector:
  +--------------------------------------------------+
  | How do you want to create this form?              |
  |                                                   |
  | [Blank Form]  [Describe It]  [Upload Image]      |
  |                                                   |
  | [Upload File]  [Clone Existing]                   |
  +--------------------------------------------------+
         |
         +--- "Blank Form" -----> dispatch({ type: 'SET_CREATION_MODE', payload: 'blank' })
         |                         Empty builder opens, admin adds fields manually
         |
         +--- "Describe It" ----> dispatch({ type: 'SET_CREATION_MODE', payload: 'ai-text' })
         |                         |
         |                         v
         |                     Show text input dialog
         |                     Admin types: "A daily kitchen temperature log"
         |                         |
         |                         v
         |                     dispatch({ type: 'AI_GENERATE_START' })
         |                     Call generate-form-template edge function
         |                     POST /functions/v1/generate-form-template
         |                       { description: "...", language: "en" }
         |                         |
         |                         v
         |                     Response: GenerateTemplateResult
         |                         |
         |                         v
         |                     dispatch({ type: 'AI_GENERATE_SUCCESS', payload: result })
         |                       - fields = result.draft.fields
         |                       - instructionsEn = result.draft.instructions_en
         |                       - aiTools = result.draft.ai_tools
         |                       - Show confidence indicator + AI message
         |                         |
         |                         v
         |                     Admin reviews and edits the generated template
         |
         +--- "Upload Image" --> dispatch({ type: 'SET_CREATION_MODE', payload: 'ai-image' })
         |                         |
         |                         v
         |                     Show image upload (native file input, accept="image/*")
         |                     Compress -> base64 data URL
         |                     Call generate-form-template with imageBase64
         |                     Same flow as "Describe It" after API response
         |
         +--- "Upload File" ---> Same pattern with fileContent extraction
         |
         +--- "Clone Existing" -> Show template picker (list of existing templates)
                                   |
                                   v
                                 supabase.from('form_templates')
                                   .select('*')
                                   .eq('id', sourceId)
                                   .single()
                                   |
                                   v
                                 dispatch({ type: 'HYDRATE', payload: {
                                   ...sourceTemplate,
                                   id: null,              // New template
                                   slug: slug + '-copy',
                                   status: 'draft',
                                   templateVersion: 1,
                                 }})
```

### 5.3 Save Draft (Auto-Save + Manual)

```
Admin makes a change (add field, edit label, toggle tool, etc.)
         |
         v
dispatch(action) fires through reducer
  -> isDirty = true
  -> undoStack updated (for undoable actions)
         |
         v
Auto-save timer fires (debounced, 3000ms after last change)
         |
         v
        OR
         |
Admin clicks [Save Draft] button
         |
         v
saveDraft() called
         |
         v
dispatch({ type: 'SAVE_START' })
  -> isSaving = true
         |
         v
Is this a new template (templateId === null)?
         |
    +----+----+
    |         |
   YES        NO
    |         |
    v         v
INSERT       UPDATE with optimistic concurrency
supabase     supabase
  .from(...)   .from('form_templates')
  .insert({    .update({
    group_id,    title_en: state.titleEn,
    slug,        fields: state.fields,
    title_en,    instructions_en: state.instructionsEn,
    fields,      ...
    status:    })
      'draft', .eq('id', state.templateId)
    ...        .eq('updated_at', state.serverUpdatedAt)  // concurrency guard
  })           .select('id, updated_at')
  .select()    .single()
  .single()
    |                |
    v                v
  data?            data?
    |                |
    +-------+--------+
            |
            v
         SUCCESS?
           |
      +----+----+
      |         |
     YES        NO (conflict or error)
      |         |
      v         v
dispatch({    dispatch({ type: 'SAVE_ERROR' })
  type:       Show toast: "Save failed. Template may have
  'SAVE_      been modified by another user."
  SUCCESS',
  payload: {
    updatedAt: data.updated_at,
    templateId: data.id,
  }
})
  -> isDirty = false
  -> isSaving = false
  -> lastSavedAt = now
  -> serverUpdatedAt = data.updated_at
  -> Save builder_state to DB (collapsed sections, selected field)
  -> If template status = 'published': set hasUnpublishedChanges = true
     (editing a published template keeps status = 'published'; changes auto-save normally)
     An explicit "Publish Changes" action (PUBLISH_CHANGES) bumps the version and
     resets hasUnpublishedChanges = false.
```

> **Edit-published flow decision (G12):** When an admin edits a template that is already
> `status = 'published'`, the status remains `'published'` throughout. Changes auto-save
> normally via `saveDraft()`. `hasUnpublishedChanges` is set to `true` to signal that
> the live version has been modified since the last explicit publish. The admin must click
> "Publish Changes" to bump `template_version` and reset `hasUnpublishedChanges`. On
> load: compare the loaded `fields` hash with a stored `publishedFieldsHash` to detect
> whether changes exist before the session started.

### 5.4 Publish Flow

```
Admin clicks [Publish] button
         |
         v
Client-side validation runs:
  1. title_en is non-empty
  2. slug is non-empty and valid
  3. At least 1 fillable field exists
  4. All select/radio/checkbox fields have options
  5. No duplicate field keys
  6. All field keys match ^[a-z][a-z0-9_]{0,63}$
  7. All condition references point to existing fields (any field, ordering constraint relaxed)
  8. Field count <= 50
         |
    +----+----+
    |         |
  PASS       FAIL
    |         |
    v         v
Continue    Show validation errors inline
            Scroll to first error
            Return (do not publish)
         |
         v
Save current draft first (to ensure latest changes are persisted)
  -> await saveDraft()
         |
         v
supabase.from('form_templates')
  .update({ status: 'published' })
  .eq('id', state.templateId)
  .select('id, template_version, updated_at, published_at')
  .single()
         |
         v
  DB trigger fires: handle_form_template_publish()
    1. template_version += 1 (if transitioning from non-published)
    2. published_at = now()
    3. builder_state = NULL (cleared)
    4. ai_refinement_log = [] (cleared)
         |
         v
  Response returns new version, updated_at
         |
         v
dispatch({
  type: 'SAVE_SUCCESS',
  payload: { updatedAt, templateId }
})
dispatch({ type: 'SET_STATUS', payload: 'published' })
         |
         v
Show success toast: "Template published (v3)"
Navigate to /admin/forms
```

### 5.5 AI Instruction Refinement

```
Admin opens Instructions tab
  -> Writes raw instructions in textarea
  -> Clicks [AI Refine] button
         |
         v
AIRefineChat component opens (inline or sheet)
  Shows chat interface (reuses FormAIContent pattern)
         |
         v
Admin's raw instructions sent as first message:
  dispatch({ type: 'ADD_REFINEMENT_MESSAGE', payload: {
    role: 'user', content: rawInstructions
  }})
         |
         v
useRefineInstructions().refine(rawInstructions, history)
         |
         v
POST /functions/v1/refine-form-instructions
  {
    rawInstructions: "Check handbook for rules broken",
    templateContext: {
      title: state.titleEn,
      fields: state.fields.map(f => ({
        key: f.key, type: f.type, label: f.label,
        required: f.required, options: f.options
      })),
      enabledTools: state.aiTools,
    },
    language: state.instructionLanguage,
    conversationHistory: refinementHistory,
    groupId: userGroupId,
  }
         |
         v
Response: RefineInstructionsResult
  {
    refinedInstructions: "1. Identify the employee... use search_manual...",
    explanation: "I referenced specific field keys and tool names...",
    suggestions: ["Consider enabling search_contacts..."]
  }
         |
         v
dispatch({ type: 'ADD_REFINEMENT_MESSAGE', payload: {
  role: 'assistant',
  content: result.explanation,
  refinedInstructions: result.refinedInstructions,
  suggestions: result.suggestions,
}})
         |
         v
UI shows:
  +---------------------------------------------+
  | Refined Instructions:                        |
  | 1. Identify the employee and extract         |
  |    employee_name field...                     |
  | 2. Use search_manual tool to find...         |
  |                                               |
  | Why I changed it:                             |
  | "I referenced specific field keys..."         |
  |                                               |
  | Suggestions:                                  |
  | - Consider enabling search_contacts           |
  |                                               |
  | [Accept]  [Edit More]  [Reject]               |
  +---------------------------------------------+
         |
         +--- "Accept" -----> dispatch({
         |                      type: 'ACCEPT_REFINED_INSTRUCTIONS',
         |                      payload: {
         |                        language: instructionLanguage,
         |                        instructions: refinedInstructions
         |                      }
         |                    })
         |                    -> UPDATE_INSTRUCTIONS dispatched internally
         |                    -> Close AIRefineChat
         |
         +--- "Edit More" --> Admin types follow-up in chat
         |                    conversationHistory grows
         |                    Next refine() call includes history
         |
         +--- "Reject" ----> Close AIRefineChat, keep original instructions
```

### 5.6 AI Template Generation

```
Admin selects "Describe It" creation mode
         |
         v
Show description input (dialog or inline)
Admin types: "A food safety temperature log for the kitchen"
         |
         v
dispatch({ type: 'AI_GENERATE_START' })
  -> aiGenerating = true
         |
         v
useGenerateTemplate().generateFromText(description)
         |
         v
POST /functions/v1/generate-form-template
  {
    description: "A food safety temperature log...",
    language: "en",
    groupId: userGroupId,
  }
         |
         v
Response: GenerateTemplateResult
  {
    draft: {
      title_en: "Kitchen Temperature Log",
      title_es: "Registro de Temperatura de Cocina",
      fields: [
        { key: "date", type: "date", label: "Date", order: 1, ... },
        { key: "station", type: "select", label: "Station",
          options: ["Grill", "Walk-in", "Prep", "Line"], order: 2, ... },
        { key: "temperature", type: "number", label: "Temperature (F)",
          order: 3, ... },
        ...
      ],
      instructions_en: "1. Record the date...",
      ai_tools: ["search_manual"],
    },
    confidence: 0.85,
    aiMessage: "I created a temperature log with 8 fields...",
    toolRecommendations: [
      { tool: "search_manual", reason: "Food safety standards reference" }
    ],
  }
         |
         v
dispatch({ type: 'AI_GENERATE_SUCCESS', payload: result })
  -> fields = result.draft.fields
  -> titleEn = result.draft.title_en
  -> titleEs = result.draft.title_es
  -> instructionsEn = result.draft.instructions_en
  -> instructionsEs = result.draft.instructions_es
  -> aiTools = result.draft.ai_tools
  -> aiGenerating = false
         |
         v
UI transitions to builder view with pre-populated fields
  Confidence badge: "85% confident"
  AI message banner: "I created a temperature log..."
  Tool recommendations: "Recommended: Search Manual (food safety)"
  Admin can now edit, add, remove fields before publishing
```

---

## 6. Reuse Strategy

### 6.1 Components Reused Directly

| Existing Component | Used In | How |
|-------------------|---------|-----|
| `FormBody` | `LivePreview` | Renders the form as users see it (read-only mode with all inputs disabled) |
| `FormSection` | `LivePreview` via `FormBody` | Groups fields into sections with header dividers |
| `FormFieldRenderer` | `LivePreview` via `FormBody` | Renders each field type with the correct input component |
| `FormFieldWrapper` | `LivePreview` via `FormFieldRenderer` | Provides label, hint, error display wrapper |
| All 16 field input components (`TextFieldInput`, `SelectFieldInput`, etc.) | `LivePreview` via `FormFieldRenderer` | Each field type renders in preview mode |
| `AppShell` | Both pages | Layout wrapper (sidebar, header, content area) |
| `FormCard` | Template picker in clone flow | Shows template card in selection list |
| `FormAIContent` pattern | `AIRefineChat` | Conversation area + input bar pattern (adapted, not imported directly) |
| `FormHeroMicButton` pattern | `AIRefineChat` voice input | Large tappable mic for voice instruction dictation |
| `AttachmentMenu` + `AttachmentChip` | AI template generation from image/file | File selection UI |

### 6.2 Hooks Reused

| Existing Hook | Used In | Purpose |
|--------------|---------|---------|
| `useLanguage` | Both pages | Bilingual label selection |
| `useAuth` | Both pages | Admin role check, userId, groupId |
| `useFormTemplate` | `AdminFormBuilderPage` | Load existing template by ID |
| `useFormTemplates` (modified) | `AdminFormsListPage` | List all templates (not just published) |
| `useVoiceRecording` | `AIRefineChat` | Voice input for instruction dictation |

### 6.3 Utilities Reused

| Existing Utility | Used In | Purpose |
|-----------------|---------|---------|
| `groupFieldsIntoSections()` | `LivePreview` via `FormBody` | Derive section groups from header fields |
| `evaluateCondition()` | `LivePreview` | Show/hide conditional fields in preview |
| `getFieldLabel()` | `FieldBlockItem`, `FieldPropertyPanel` | Bilingual label display |
| `countFillableFields()` | `AIFillabilityIndicator` | Count non-display fields |
| `transformTemplateRow()` | `useAdminFormTemplates` | DB row to FormTemplate conversion |

### 6.4 Patterns Adapted (Not Directly Imported)

| Existing Pattern | Adapted For | What Changes |
|-----------------|------------|--------------|
| `IngestDraftContext` (Context + useReducer) | `BuilderContext` | Same architecture; adds undo/redo middleware, different action types for form fields instead of recipe ingredients |
| `ChatIngestionPanel` (voice/image/file -> AI -> draft) | Template creation wizard | Same multi-modal input concept; output is a FormTemplate draft instead of a product draft |
| `DockedFormAIPanel` (docked side panel) | `AIRefineChat` could use same layout | Adapted for instruction refinement instead of form filling |
| `usePinnedRecipes` (localStorage persistence) | N/A (not needed for admin list) | Admin list uses server-side status filtering instead |
| `useFormAutosave` (debounced auto-save) | Builder auto-save | Same debounce pattern (3s); targets `form_templates` UPDATE instead of `form_submissions` |

### 6.5 New Dependencies

| Package | Purpose | Size | Already Installed? |
|---------|---------|------|-------------------|
| `@dnd-kit/core` | Drag-and-drop field reordering | ~13 kB gzipped | No -- new install |
| `@dnd-kit/sortable` | Sortable list for FieldBlockList | ~4 kB gzipped | No -- new install |
| `@dnd-kit/utilities` | CSS transform utilities | ~1 kB gzipped | No -- new install |

**Why @dnd-kit?** The most popular React DnD library with accessibility support, touch/pointer events, keyboard sorting, and excellent TypeScript types. It is the de facto standard for sortable lists in React. The alternative (`react-beautiful-dnd`) is deprecated.

**Install:**
```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

---

## 7. File Organization

### 7.1 New Files (~25 files)

```
src/
  pages/
    AdminFormsList.tsx                    # Template list page
    AdminFormBuilder.tsx                  # Builder page (new + edit)

  contexts/
    BuilderContext.tsx                    # BuilderProvider, useBuilder, reducer, actions

  hooks/
    use-admin-form-templates.ts          # Fetches ALL templates (draft/published/archived)
    use-form-builder.ts                  # Save, publish, clone, delete, slug check
    use-form-ai-tools.ts                 # Fetches form_ai_tools registry table
    use-refine-instructions.ts           # Calls refine-form-instructions edge function
    use-generate-template.ts             # Calls generate-form-template edge function

  components/
    forms/
      builder/
        BuilderTopBar.tsx                # Header: back, title, save, publish
        BuilderLayout.tsx                # Split pane layout (sidebar + main)
        BuilderSidebar.tsx               # Left column with tabs
        BuilderTabs.tsx                  # Tab navigation (Fields/Instructions/AI Tools/Settings)
        BuilderMobileNav.tsx             # Bottom tab bar for mobile

        FieldBlockList.tsx               # Drag-and-drop sortable field list (@dnd-kit)
        FieldBlockItem.tsx               # Single field in the list (draggable)
        FieldTypePicker.tsx              # Grid of 17 field type tiles
        FieldPropertyPanel.tsx           # Field property editor (right column)
        FieldBasicProperties.tsx         # Key, label, required, placeholder
        FieldTypeProperties.tsx          # Type-specific: options, validation, ranges
        FieldConditionEditor.tsx         # Conditional visibility setup
        FieldAIHintEditor.tsx            # AI hint textarea
        OptionsEditor.tsx                # Add/remove/reorder option strings

        InstructionsEditor.tsx           # EN/ES textarea with AI Refine button
        AIRefineChat.tsx                 # Chat panel for instruction refinement

        AIToolsPicker.tsx                # Toggle cards for each tool
        ToolRecommendations.tsx          # Keyword-based smart suggestions

        LivePreview.tsx                  # Rendered form preview (reuses FormBody)
        PreviewToggle.tsx                # Switch between edit view and preview

        TemplateMetaForm.tsx             # Slug, icon, description, header image
        AIFillabilityIndicator.tsx       # Score ring (red/yellow/green)
        CreationModeSelector.tsx         # New template: blank/describe/image/file/clone

      admin/
        AdminFormsHeader.tsx             # Search, filter, create button
        AdminFormsTable.tsx              # Table of all templates
        AdminFormRow.tsx                 # Single table row
        StatusBadge.tsx                  # Status pill (draft/published/archived)
        TemplateActionMenu.tsx           # Dropdown: edit, clone, publish, archive, delete

  types/
    builder.ts                           # AIToolDefinition, BuilderState, GenerateTemplateResult, etc.

  lib/
    builder-utils.ts                     # generateSlug, computeAiFillabilityScore, defaultFieldForType
```

### 7.2 Modified Files (~5 files)

```
src/App.tsx                              # Add 3 new routes
src/types/forms.ts                       # Add FormTemplate.publishedAt, builderState, aiRefinementLog
src/hooks/use-form-templates.ts          # Add option to include drafts (for admin list)
src/components/layout/Sidebar.tsx        # Add "Form Builder" link in admin section
src/lib/form-utils.ts                    # Add transformAIToolRow() utility
```

### 7.3 Directory Tree Visualization

```
src/
  components/
    forms/
      admin/                             <-- NEW directory
        AdminFormsHeader.tsx
        AdminFormsTable.tsx
        AdminFormRow.tsx
        StatusBadge.tsx
        TemplateActionMenu.tsx
      builder/                           <-- NEW directory
        AIFillabilityIndicator.tsx
        AIRefineChat.tsx
        AIToolsPicker.tsx
        BuilderLayout.tsx
        BuilderMobileNav.tsx
        BuilderSidebar.tsx
        BuilderTabs.tsx
        BuilderTopBar.tsx
        CreationModeSelector.tsx
        FieldAIHintEditor.tsx
        FieldBasicProperties.tsx
        FieldBlockItem.tsx
        FieldBlockList.tsx
        FieldConditionEditor.tsx
        FieldPropertyPanel.tsx
        FieldTypePicker.tsx
        FieldTypeProperties.tsx
        InstructionsEditor.tsx
        LivePreview.tsx
        OptionsEditor.tsx
        PreviewToggle.tsx
        TemplateMetaForm.tsx
        ToolRecommendations.tsx
      ai/                                (existing -- no changes)
      fields/                            (existing -- no changes)
      DockedFormAIPanel.tsx               (existing -- no changes)
      FormAIContent.tsx                   (existing -- no changes)
      FormBody.tsx                        (existing -- REUSED by LivePreview)
      ...
  contexts/
    BuilderContext.tsx                    <-- NEW
    IngestDraftContext.tsx                (existing -- pattern reference)
  hooks/
    use-admin-form-templates.ts          <-- NEW
    use-form-ai-tools.ts                 <-- NEW
    use-form-builder.ts                  <-- NEW
    use-generate-template.ts             <-- NEW
    use-refine-instructions.ts           <-- NEW
    use-form-template.ts                 (existing -- reused)
    use-form-templates.ts                (existing -- modified)
    ...
  lib/
    builder-utils.ts                     <-- NEW
    form-utils.ts                        (existing -- minor addition)
  pages/
    AdminFormBuilder.tsx                  <-- NEW
    AdminFormsList.tsx                    <-- NEW
    FormDetail.tsx                        (existing -- no changes)
    Forms.tsx                            (existing -- no changes)
  types/
    builder.ts                           <-- NEW
    forms.ts                             (existing -- minor additions)
```

---

## 8. Performance Considerations

### 8.1 Debounced Auto-Save

The builder auto-saves to the database after the admin stops making changes for 3 seconds. This prevents excessive writes while ensuring no work is lost.

```typescript
// Inside BuilderProvider

const AUTOSAVE_DELAY_MS = 3000;

useEffect(() => {
  if (!state.isDirty || !state.templateId) return;

  const timer = setTimeout(() => {
    saveDraft();
  }, AUTOSAVE_DELAY_MS);

  return () => clearTimeout(timer);
}, [state.isDirty, state.templateId, state.fields, state.instructionsEn,
    state.instructionsEs, state.aiTools, state.titleEn]);
```

**Why 3 seconds?** Fast enough that the admin does not lose work on browser crash, slow enough that rapid field edits (typing a label character by character) do not generate individual saves. This matches the `useFormAutosave` pattern used in the form viewer (which uses 2 seconds for field values).

### 8.2 Memoized Live Preview

The `LivePreview` component receives the `fields` array and renders a full form. Since `fields` is a new array reference on every reducer dispatch, we memoize the preview rendering:

```typescript
// LivePreview.tsx

export const LivePreview = memo(function LivePreview({
  fields,
  language,
}: LivePreviewProps) {
  // Use a stable empty values object for preview (no actual data)
  const emptyValues = useMemo(() => {
    const vals: FormFieldValues = {};
    for (const f of fields) {
      vals[f.key] = getDefaultValueForType(f.type);
    }
    return vals;
  }, [fields]);

  const emptyErrors = useMemo(() => ({}), []);
  const noop = useCallback(() => {}, []);

  return (
    <div className="pointer-events-none opacity-80">
      <FormBody
        fields={fields}
        values={emptyValues}
        errors={emptyErrors}
        language={language}
        onFieldChange={noop}
      />
    </div>
  );
});
```

**`pointer-events-none`** prevents the admin from accidentally interacting with the preview inputs. **`opacity-80`** visually distinguishes preview from the real form.

### 8.3 Virtualized Field List (Large Forms)

For templates with more than 20 fields, the `FieldBlockList` sidebar can become sluggish during drag-and-drop if all items render simultaneously. The solution is conditional virtualization:

```typescript
// FieldBlockList.tsx

const VIRTUALIZATION_THRESHOLD = 25;

export function FieldBlockList({ fields, ... }: FieldBlockListProps) {
  const shouldVirtualize = fields.length > VIRTUALIZATION_THRESHOLD;

  if (shouldVirtualize) {
    // Use a simple windowed list: only render items within viewport + 5 buffer
    return <VirtualizedFieldList fields={fields} ... />;
  }

  // Standard DnD list for small forms
  return (
    <DndContext ...>
      <SortableContext items={fields.map(f => f.key)} ...>
        {fields.map(field => (
          <SortableFieldBlockItem key={field.key} field={field} ... />
        ))}
      </SortableContext>
    </DndContext>
  );
}
```

**Why 25?** The hard limit is 50 fields (DB trigger). 25 is the threshold where the sidebar starts needing scroll, and DnD performance with 25+ fully rendered items can degrade on low-end devices.

**Note:** @dnd-kit supports virtualized lists natively via its `MeasuringStrategy`. No additional virtualization library is needed.

### 8.4 Structural Equality Checks for Fields

The reducer creates new `fields` array references on every mutation. To prevent unnecessary re-renders in components that only care about specific field properties, use selector-style access:

```typescript
// In FieldBlockItem, only re-render when this specific field changes
const field = useBuilder().state.fields.find(f => f.key === fieldKey);

// Better: derive a stable value
const fieldLabel = useMemo(
  () => state.fields.find(f => f.key === fieldKey)?.label ?? '',
  [state.fields, fieldKey]
);
```

For the `FieldPropertyPanel`, which edits a single field's properties, the selected field is extracted with `useMemo` to avoid re-rendering on unrelated field changes:

```typescript
const selectedField = useMemo(
  () => state.fields.find(f => f.key === state.selectedFieldKey) ?? null,
  [state.fields, state.selectedFieldKey]
);
```

### 8.5 Lazy Loading of Builder Components

The builder is an admin-only feature. It should not be included in the main bundle for regular users:

```typescript
// App.tsx
const AdminFormsList = lazy(() => import('./pages/AdminFormsList'));
const AdminFormBuilder = lazy(() => import('./pages/AdminFormBuilder'));

// Routes
<Route path="/admin/forms" element={
  <ProtectedRoute requiredRole="manager">
    <Suspense fallback={<PageSkeleton />}>
      <AdminFormsList />
    </Suspense>
  </ProtectedRoute>
} />
```

This ensures the ~50 KB of builder-specific code (DnD library, property panels, AI tools picker) is only loaded when an admin navigates to the builder routes.

### 8.6 Debounced Slug Availability Check

When the admin types a slug, the UI checks availability against the database. This is debounced to avoid one query per keystroke:

```typescript
// useFormBuilder.ts

const checkSlugAvailable = useDebouncedCallback(
  async (slug: string, excludeId?: string) => {
    const query = supabase
      .from('form_templates')
      .select('id', { count: 'exact', head: true })
      .eq('slug', slug);

    if (excludeId) {
      query.neq('id', excludeId);
    }

    const { count } = await query;
    return count === 0;
  },
  500  // 500ms debounce
);
```

### 8.7 Undo Stack Memory Bound

The undo stack stores deep clones of `fields` arrays. At 50 fields per snapshot and 30 snapshots max, worst-case memory is approximately:

```
50 fields * ~500 bytes/field * 30 snapshots = ~750 KB
```

This is well within acceptable limits. The `structuredClone()` call for snapshots is O(n) but fast for small objects. The stack is cleared on `HYDRATE` and `RESET`.

---

## Appendix A: Keyboard Shortcuts

The builder supports keyboard shortcuts for power users:

| Shortcut | Action |
|----------|--------|
| `Ctrl+Z` / `Cmd+Z` | Undo |
| `Ctrl+Shift+Z` / `Cmd+Shift+Z` | Redo |
| `Ctrl+S` / `Cmd+S` | Save draft (prevent browser save dialog) |
| `Delete` / `Backspace` | Remove selected field (with confirmation) |
| `Escape` | Deselect field / close popover |
| `Tab` | Move to next field in sidebar list |

```typescript
// BuilderKeyboardHandler.tsx (included in AdminFormBuilderPage)

useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    const mod = e.metaKey || e.ctrlKey;

    if (mod && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      dispatch({ type: 'UNDO' });
    }
    if (mod && e.key === 'z' && e.shiftKey) {
      e.preventDefault();
      dispatch({ type: 'REDO' });
    }
    if (mod && e.key === 's') {
      e.preventDefault();
      saveDraft();
    }
    if (e.key === 'Escape') {
      dispatch({ type: 'SELECT_FIELD', payload: null });
    }
  };

  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}, [dispatch, saveDraft]);
```

---

## Appendix B: Mobile Considerations

### B.1 Layout Differences

| Aspect | Desktop (>= 1024px) | Mobile (< 1024px) |
|--------|---------------------|-------------------|
| Layout | Side-by-side: sidebar (w-72) + main area | Stacked: bottom tabs switch between views |
| Field list | Always visible in sidebar | Visible when "Fields" tab active |
| Property panel | Right column, always visible when field selected | Full-screen sheet on field tap |
| Live preview | Full-width main area when no field selected | Separate "Preview" tab |
| AI Refine | Inline in Instructions tab | Bottom sheet |
| Settings | Sidebar tab | Separate "Settings" tab |
| DnD | Mouse drag on grip handle | Long-press + touch drag |

### B.2 Mobile Navigation

```
+---------------------------------------------------+
| < Back    Employee Write-Up      [Save] [Publish]  |
+---------------------------------------------------+
|                                                    |
|  [Current view content based on active tab]        |
|                                                    |
+---------------------------------------------------+
| [Fields]  [Preview]  [Settings]                    |
+---------------------------------------------------+
```

The bottom tab bar (`BuilderMobileNav`) replaces the sidebar tabs on mobile. Tapping a field in the Fields view opens `FieldPropertyPanel` as a full-screen sheet (using shadcn/ui `Sheet` component).

---

## Appendix C: Validation Rules Summary

Validation runs at two levels:

### Client-Side (before publish)

| Rule | Error Message |
|------|---------------|
| Title is required | "Form title is required" |
| Slug is required and valid | "Slug must be lowercase with hyphens" |
| Slug is available | "This slug is already in use" |
| At least 1 fillable field | "Form must have at least one fillable field" |
| No duplicate field keys | "Duplicate field key: {key}" |
| Field keys are valid snake_case | "Field key must be lowercase with underscores" |
| Select/radio/checkbox have options | "Field {label} requires at least one option" |
| Condition references are valid | "Field {label} references non-existent field" (can reference ANY other field, not just preceding ones) |
| Max 50 fields | "Maximum 50 fields per template" |

### Server-Side (DB trigger, enforced always)

All rules from the enhanced `validate_form_template_fields()` trigger (see Phase 5 DB plan Section 2.2). These are the authoritative guardrails. Client-side validation is a courtesy to show inline errors before the save round-trip.

---

## Appendix D: Integration with Existing Admin Section

The existing `/admin` page (`Admin.tsx`) serves as the admin hub. The Form Builder should be accessible from there:

1. **Sidebar link:** Add "Form Builder" to the admin section of `Sidebar.tsx` (below "Data Ingestion", above "Training Dashboard").

2. **Admin page card:** Add a "Form Templates" card to the `/admin` page grid, linking to `/admin/forms`.

3. **Forms list page link:** On the user-facing `/forms` page, show an "Edit" link on each template card for admin users (already planned in Phase 2 overview).

---

*This document is the comprehensive frontend architecture for Phase 5: Form Builder Admin. It is paired with `05-phase-db-section.md` (database schema) and `05-phase-form-builder-admin-backend.md` (edge functions and backend logic). Together, these three documents provide the complete blueprint for implementation.*
