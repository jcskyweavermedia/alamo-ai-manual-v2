// =============================================================================
// Form Builder Types — Frontend interfaces matching DB schema (camelCase)
// Phase 2: Form Viewer (Read + Fill)
// =============================================================================

// =============================================================================
// FIELD TYPES (18 types — 17 original + yes_no)
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
  | 'contact_lookup'
  | 'yes_no';

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
  hint_es?: string;
  ai_hint?: string;
  options?: string[];
  validation?: FormFieldValidation;
  default?: unknown;
  order: number;
  condition?: FormFieldCondition | null;
  /** Layout width: 'half' = share row with next half-width field on tablet+. Default 'full'. */
  width?: 'full' | 'half';
  /** Display variant: 'button' renders radio/select as a horizontal toggle group. */
  variant?: 'button';
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
  iconColor: string;
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
  // Phase 5: Form Builder Admin
  publishedAt: string | null;
  builderState: Record<string, unknown> | null;
  aiRefinementLog: Array<{ role: string; content: string; timestamp: string }>;
  aiSystemPromptEn: string | null;
  aiSystemPromptEs: string | null;
  instructionsRefined: boolean;
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
  iconColor?: string;
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

// =============================================================================
// COMPONENT PROPS
// =============================================================================

export interface FormCardProps {
  template: FormTemplate;
  language: 'en' | 'es';
  isPinned: boolean;
  onTogglePin: (slug: string) => void;
  onSelect: (slug: string) => void;
}

export interface FormHeaderProps {
  template: FormTemplate;
  language: 'en' | 'es';
  isSaving: boolean;
  lastSavedAt: Date | null;
  onBack: () => void;
}

export interface FormBodyProps {
  fields: FormFieldDefinition[];
  values: FormFieldValues;
  errors: Record<string, string>;
  language: 'en' | 'es';
  onFieldChange: (key: string, value: FormFieldValue) => void;
  /** Set of field keys currently highlighted by AI fill */
  aiHighlightedFields?: Set<string>;
  /** Set of field keys identified as missing by AI */
  aiMissingFields?: Set<string>;
}

export interface FormSectionProps {
  section: FormSectionGroup;
  values: FormFieldValues;
  errors: Record<string, string>;
  language: 'en' | 'es';
  onFieldChange: (key: string, value: FormFieldValue) => void;
  renderField: (
    fieldKey: string,
    value: FormFieldValue,
    error: string | undefined,
    onChange: (value: FormFieldValue) => void,
  ) => React.ReactNode;
}

export interface FormFieldRendererProps {
  field: FormFieldDefinition;
  value: FormFieldValue;
  error: string | undefined;
  language: 'en' | 'es';
  onChange: (value: FormFieldValue) => void;
}

export interface FormFieldWrapperProps {
  field: FormFieldDefinition;
  error: string | undefined;
  language: 'en' | 'es';
  children: React.ReactNode;
}

export interface SignatureFieldInputProps {
  field: FormFieldDefinition;
  value: SignatureValue | null;
  onChange: (value: SignatureValue | null) => void;
  submissionId: string | null;
}

export interface ContactLookupFieldInputProps {
  field: FormFieldDefinition;
  value: ContactLookupValue | null;
  onChange: (value: ContactLookupValue | null) => void;
  language: 'en' | 'es';
}

export interface ImageFieldInputProps {
  field: FormFieldDefinition;
  value: ImageValue[] | null;
  onChange: (value: ImageValue[]) => void;
  submissionId: string | null;
}

export interface FileFieldInputProps {
  field: FormFieldDefinition;
  value: FileValue[] | null;
  onChange: (value: FileValue[]) => void;
  submissionId: string | null;
}

// =============================================================================
// FORM SUGGESTION (from main AI chat → form navigation)
// =============================================================================

export interface FormSuggestion {
  id?: string;
  slug: string;
  title: string;
  description: string | null;
  icon: string;
  iconColor?: string;
}

export interface FormPrefillState {
  prefillContext: string;
  fromChat: boolean;
  formSuggestions?: FormSuggestion[];
}

// =============================================================================
// HOOK RETURN TYPES
// =============================================================================

export interface UseFormTemplatesReturn {
  templates: FormTemplate[];
  isLoading: boolean;
  error: Error | null;
}

export interface UsePinnedFormsReturn {
  pinned: string[];
  togglePin: (slug: string) => void;
  isPinned: (slug: string) => boolean;
  sortPinnedFirst: <T extends { slug: string }>(items: T[]) => T[];
}

export interface UseFormViewerReturn {
  // Data
  templates: FormTemplate[];
  pinnedTemplates: FormTemplate[];
  unpinnedTemplates: FormTemplate[];
  selectedTemplate: FormTemplate | undefined;
  // State
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedSlug: string | null;
  // Actions
  selectTemplate: (slug: string) => void;
  clearSelection: () => void;
  togglePin: (slug: string) => void;
  isPinned: (slug: string) => boolean;
  // Navigation
  hasPrev: boolean;
  hasNext: boolean;
  goToPrev: () => void;
  goToNext: () => void;
  // Status
  isLoading: boolean;
  error: Error | null;
}

export interface UseFormSubmissionReturn {
  // State
  submissionId: string | null;
  fieldValues: FormFieldValues;
  status: FormSubmissionStatus | 'idle';
  isDirty: boolean;
  isSaving: boolean;
  isSubmitting: boolean;
  errors: Record<string, string>;
  lastSavedAt: Date | null;
  templateVersion: number | null;
  // Actions
  createDraft: (template: FormTemplate) => Promise<void>;
  updateField: (key: string, value: FormFieldValue) => void;
  updateFields: (updates: FormFieldValues) => void;
  saveDraft: () => Promise<void>;
  submit: (template: FormTemplate) => Promise<boolean>;
  validate: (template: FormTemplate) => Record<string, string>;
  loadExistingDraft: (id: string) => Promise<void>;
}

export interface UseFormAttachmentUploadReturn {
  uploadFile: (file: File, submissionId: string, fieldKey: string) => Promise<string>;
  uploadSignature: (blob: Blob, submissionId: string, fieldKey: string) => Promise<string>;
  isUploading: boolean;
  error: Error | null;
}

export interface UseSignedUrlReturn {
  url: string | null;
  isLoading: boolean;
  error: Error | null;
}

export interface UseFormSubmissionsReturn {
  submissions: FormSubmission[];
  totalCount: number;
  isLoading: boolean;
  page: number;
  setPage: (page: number) => void;
  statusFilter: FormSubmissionStatus | 'all';
  setStatusFilter: (filter: FormSubmissionStatus | 'all') => void;
}
