// =============================================================================
// Form Builder Admin Types — Phase 5
// =============================================================================

import type { FormFieldDefinition, FormFieldType, FormTemplateStatus } from './forms';

// =============================================================================
// UI STATE TYPES
// =============================================================================

export type BuilderTab = 'fields' | 'instructions' | 'ai-tools' | 'settings' | 'preview';
export type RightPanelMode = 'preview' | 'field-properties' | 'ai-refine';
export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';
export type CreationMode = 'blank' | 'ai-text' | 'ai-image' | 'ai-file' | 'clone';
export type PreviewMode = 'mobile' | 'desktop';

// =============================================================================
// FORM AI TOOLS (matches form_ai_tools DB row, camelCase)
// =============================================================================

/**
 * Matches the form_ai_tools DB row exactly (camelCase mapping).
 * DB columns: id (TEXT PK), label_en, label_es, description_en, description_es,
 *             search_function, icon, status, sort_order, created_at
 */
export interface FormAITool {
  id: string;
  labelEn: string;
  labelEs: string;
  descriptionEn: string;
  descriptionEs: string;
  searchFunction: string | null;
  icon: string | null;
  status: 'active' | 'deprecated';
  sortOrder: number;
  createdAt: string;
}

/** @deprecated Use FormAITool instead — kept as alias for backward compatibility */
export type AIToolDefinition = FormAITool;

// =============================================================================
// UNDO/REDO
// =============================================================================

export interface BuilderSnapshot {
  fields: FormFieldDefinition[];
  instructionsEn: string;
  instructionsEs: string;
  aiSystemPromptEn: string;
  aiSystemPromptEs: string;
  titleEn: string;
  titleEs: string;
  descriptionEn: string;
  descriptionEs: string;
  icon: string;
  iconColor: string;
  slug: string;
  aiTools: string[];
}

// =============================================================================
// AI REFINEMENT
// =============================================================================

export interface RefinementMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  refinedInstructions?: string;
  explanation?: string;
  suggestions?: string[];
  action?: 'accepted' | 'rejected';
  recommendedTools?: string[];
  instructionsEs?: string;
  suggestedSystemPrompt?: string;
}

// =============================================================================
// TOOL RECOMMENDATIONS (client-side keyword matching)
// =============================================================================

export interface ToolRecommendation {
  toolId: string;
  reason: string;
}

// =============================================================================
// BUILDER STATE
// =============================================================================

export interface BuilderState {
  // Template identity
  templateId: string | null;
  slug: string;
  titleEn: string;
  titleEs: string;
  descriptionEn: string;
  descriptionEs: string;
  icon: string;
  iconColor: string;
  status: FormTemplateStatus;
  templateVersion: number;
  publishedAt: string | null;

  // Fields
  fields: FormFieldDefinition[];
  selectedFieldKey: string | null;

  // Tabs & panels
  activeTab: BuilderTab;
  rightPanelMode: RightPanelMode;

  // Instructions
  instructionsEn: string;
  instructionsEs: string;
  instructionLanguage: 'en' | 'es';

  // AI Tools
  aiTools: string[];

  // Save state
  isDirty: boolean;
  saveStatus: SaveStatus;
  isSaving: boolean;
  serverUpdatedAt: string | null;
  hasUnpublishedChanges: boolean;

  // Undo/redo
  past: BuilderSnapshot[];
  future: BuilderSnapshot[];
  maxHistory: number;

  // Preview
  previewMode: PreviewMode;

  // AI refinement
  refinementHistory: RefinementMessage[];

  // AI system prompt (hidden instructions for fill-time AI)
  aiSystemPromptEn: string;
  aiSystemPromptEs: string;
  instructionsRefined: boolean;

  // Creation mode
  creationMode: CreationMode | null;
  aiGenerating: boolean;

  // AI Builder chat
  builderChatMessages: BuilderChatMessage[];
  builderChatLoading: boolean;
}

// =============================================================================
// BUILDER ACTIONS
// =============================================================================

export type BuilderAction =
  // Hydrate from DB
  | { type: 'HYDRATE'; payload: Partial<BuilderState>; preserveUIState?: boolean }
  | { type: 'RESET' }

  // Template metadata
  | { type: 'SET_TITLE_EN'; payload: string }
  | { type: 'SET_TITLE_ES'; payload: string }
  | { type: 'SET_DESCRIPTION_EN'; payload: string }
  | { type: 'SET_DESCRIPTION_ES'; payload: string }
  | { type: 'SET_SLUG'; payload: string }
  | { type: 'SET_ICON'; payload: string }
  | { type: 'SET_ICON_COLOR'; payload: string }
  | { type: 'SET_STATUS'; payload: FormTemplateStatus }

  // UI navigation
  | { type: 'SET_ACTIVE_TAB'; payload: BuilderTab }
  | { type: 'SET_RIGHT_PANEL_MODE'; payload: RightPanelMode }
  | { type: 'SET_SELECTED_FIELD'; payload: string | null }
  | { type: 'SET_PREVIEW_MODE'; payload: PreviewMode }
  | { type: 'SET_CREATION_MODE'; payload: CreationMode | null }

  // Field operations (undoable)
  | { type: 'ADD_FIELD'; payload: { field: FormFieldDefinition } }
  | { type: 'ADD_FIELD_AT_INDEX'; payload: { field: FormFieldDefinition; index: number } }
  | { type: 'UPDATE_FIELD'; payload: { key: string; updates: Partial<FormFieldDefinition> } }
  | { type: 'REMOVE_FIELD'; payload: { key: string } }
  | { type: 'REORDER_FIELDS'; payload: FormFieldDefinition[] }

  // Instructions (undoable)
  | { type: 'SET_INSTRUCTIONS_EN'; payload: string }
  | { type: 'SET_INSTRUCTIONS_ES'; payload: string }
  | { type: 'SET_INSTRUCTION_LANGUAGE'; payload: 'en' | 'es' }

  // AI tools
  | { type: 'SET_AI_TOOLS'; payload: string[] }
  | { type: 'TOGGLE_TOOL'; payload: string }

  // Save lifecycle
  | { type: 'SAVE_START' }
  | { type: 'SAVE_SUCCESS'; payload: { updatedAt: string } }
  | { type: 'SAVE_ERROR'; payload: { error: string } }

  // Publish
  | { type: 'PUBLISH_CHANGES'; payload: { templateVersion: number; publishedAt: string } }

  // AI generation
  | { type: 'AI_GENERATE_START' }
  | { type: 'AI_GENERATE_SUCCESS'; payload: Partial<BuilderState> }
  | { type: 'AI_GENERATE_ERROR' }

  // AI Builder chat
  | { type: 'BUILDER_CHAT_ADD_MESSAGE'; payload: BuilderChatMessage }
  | { type: 'BUILDER_CHAT_SET_LOADING'; payload: boolean }
  | { type: 'BUILDER_CHAT_CLEAR' }
  | { type: 'APPLY_CHAT_FORM_UPDATES'; payload: FormBuilderChatUpdates }

  // AI refinement
  | { type: 'ADD_REFINEMENT_MESSAGE'; payload: RefinementMessage }
  | { type: 'CLEAR_REFINEMENT_HISTORY' }
  | { type: 'ACCEPT_REFINED_INSTRUCTIONS'; payload: { language: 'en' | 'es'; instructions: string } }
  | { type: 'ACCEPT_REFINEMENT_RESULT'; payload: {
      instructionsEn: string;
      instructionsEs: string;
      aiTools: string[];
      aiSystemPromptEn: string;
      titleEn?: string;
      titleEs?: string;
      descriptionEn?: string;
      descriptionEs?: string;
      icon?: string;
      iconColor?: string;
      fieldCorrections?: Array<{ key: string; label: string; label_es: string }>;
    } }

  // AI system prompt
  | { type: 'SET_AI_SYSTEM_PROMPT_EN'; payload: string }
  | { type: 'SET_AI_SYSTEM_PROMPT_ES'; payload: string }
  | { type: 'SET_INSTRUCTIONS_REFINED'; payload: boolean }

  // Undo/redo
  | { type: 'UNDO' }
  | { type: 'REDO' };

// =============================================================================
// VALIDATION
// =============================================================================

export interface ValidationError {
  fieldKey?: string;
  message: string;
  severity: 'error' | 'warning';
}

// =============================================================================
// AI FILLABILITY SCORE
// =============================================================================

export interface AIFillabilityResult {
  score: number;
  issues: string[];
}

// =============================================================================
// GENERATE RESPONSE (raw from edge function, snake_case)
// =============================================================================

export interface GenerateResponse {
  title_en: string;
  title_es: string;
  description_en: string;
  description_es: string;
  icon: string;
  icon_color: string;
  instructions_en: string;
  instructions_es: string;
  ai_tools: string[];
  fields: Array<{
    key: string;
    label: string;
    label_es: string;
    type: FormFieldType;
    required: boolean;
    placeholder?: string | null;
    section?: string | null;
    section_es?: string | null;
    hint?: string | null;
    hint_es?: string | null;
    ai_hint?: string | null;
    options?: string[] | null;
    order: number;
    width: 'full' | 'half';
  }>;
}

// =============================================================================
// GENERATE TEMPLATE RESULT (processed, camelCase — for consumers)
// =============================================================================

export interface GenerateTemplateResult {
  draft: {
    titleEn: string;
    titleEs: string;
    descriptionEn: string;
    descriptionEs: string;
    icon: string;
    iconColor: string;
    fields: FormFieldDefinition[];
    instructionsEn: string;
    instructionsEs: string;
    aiTools: string[];
  };
  confidence: number;
  missingFields: string[];
  aiMessage: string;
  toolRecommendations: Array<{
    tool: string;
    reason: string;
  }>;
}

// =============================================================================
// REFINE INSTRUCTIONS RESULT (from refine-form-instructions edge function)
// =============================================================================

export interface RefineInstructionsResult {
  refinedInstructions: string;
  refinedInstructionsEs: string;
  recommendedTools: string[];
  suggestedSystemPrompt: string;
  explanation: string;
  suggestions: string[];
  suggestedTitleEn?: string;
  suggestedTitleEs?: string;
  suggestedDescriptionEn?: string;
  suggestedDescriptionEs?: string;
  suggestedIcon?: string;
  suggestedIconColor?: string;
  suggestedFieldCorrections?: Array<{ key: string; label: string; label_es: string }>;
  usage: {
    dailyUsed: number;
    dailyLimit: number;
    monthlyUsed: number;
    monthlyLimit: number;
  };
}

// =============================================================================
// AI BUILDER CHAT
// =============================================================================

export interface BuilderChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  attachments?: Array<{ type: 'image' | 'file'; name: string; preview?: string }>;
  changeSummary?: string[];
  confidence?: number;
}

export interface FormBuilderChatUpdates {
  titleEn?: string;
  titleEs?: string;
  descriptionEn?: string;
  descriptionEs?: string;
  icon?: string;
  iconColor?: string;
  instructionsEn?: string;
  instructionsEs?: string;
  aiTools?: string[];
  fieldsToAdd?: Array<{
    key: string;
    label: string;
    label_es: string;
    type: FormFieldType;
    section: string;
    section_es?: string;
    required: boolean;
    placeholder?: string;
    hint?: string;
    hint_es?: string;
    ai_hint?: string;
    options?: string[];
    order: number;
    width?: 'full' | 'half';
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

// =============================================================================
// CONTEXT API
// =============================================================================

export interface BuilderContextValue {
  state: BuilderState;
  dispatch: React.Dispatch<BuilderAction>;

  // Derived values
  canUndo: boolean;
  canRedo: boolean;
  fillableFieldCount: number;

  // Convenience actions
  addField: (type: FormFieldType) => void;
  addFieldAtIndex: (type: FormFieldType, index: number) => void;
  removeField: (key: string) => void;
  updateField: (key: string, updates: Partial<FormFieldDefinition>) => void;
  moveField: (activeKey: string, overKey: string) => void;
  selectField: (key: string | null) => void;
  toggleTool: (toolId: string) => void;
  undo: () => void;
  redo: () => void;

  // Title with auto-slug (DRY helper used by BuilderTopBar + SettingsTab)
  setTitleEn: (value: string) => void;

  // Save operations
  saveDraft: () => Promise<void>;
}

// =============================================================================
// COMPONENT PROPS
// =============================================================================

export interface AdminFormsHeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  statusFilter: FormTemplateStatus | 'all';
  onStatusFilterChange: (status: FormTemplateStatus | 'all') => void;
  onCreateNew: () => void;
  language: 'en' | 'es';
}

export interface BuilderTopBarProps {
  language: 'en' | 'es';
  /** Optional override for Save Draft button. If provided, calls this instead of saveDraft(). */
  onSave?: () => void | Promise<void>;
}

export interface BuilderTabBarProps {
  language: 'en' | 'es';
}

export interface FieldBlockItemProps {
  field: FormFieldDefinition;
  isSelected: boolean;
  isExpanded: boolean;
  isFirst: boolean;
  isLast: boolean;
  allFieldKeys: string[];
  language: 'en' | 'es';
  onToggleExpand: (key: string) => void;
  onMoveUp: (key: string) => void;
  onMoveDown: (key: string) => void;
}

export interface FieldTypePickerProps {
  onSelect: (type: FormFieldType) => void;
  onClose: () => void;
  language: 'en' | 'es';
}

export interface FieldPropertyPanelProps {
  field: FormFieldDefinition;
  allFieldKeys: string[];
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
  language: 'en' | 'es';
}

export interface AIFillabilityIndicatorProps {
  score: number;
  issues: string[];
  language: 'en' | 'es';
}

export interface FieldConditionEditorProps {
  condition: import('./forms').FormFieldCondition | null;
  availableFieldKeys: string[];
  fieldMap: Map<string, FormFieldDefinition>;
  onChange: (condition: import('./forms').FormFieldCondition | null) => void;
  language: 'en' | 'es';
}

export interface OptionsEditorProps {
  options: string[];
  onChange: (options: string[]) => void;
  language: 'en' | 'es';
  /** Field type — used to show warnings for radio/checkbox with too many options */
  fieldType?: import('./forms').FormFieldType;
}

// =============================================================================
// HOOK RETURN TYPES
// =============================================================================

export interface UseAdminFormTemplatesReturn {
  templates: import('./forms').FormTemplate[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export interface UseFormAIToolsReturn {
  tools: FormAITool[];
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

export interface UseRefineInstructionsReturn {
  refine: (rawInstructions: string, history?: RefinementMessage[]) => Promise<RefineInstructionsResult | null>;
  isRefining: boolean;
  error: string | null;
}

export interface UseGenerateTemplateReturn {
  generate: (params: {
    description: string;
    language?: 'en' | 'es';
    groupId: string;
    existingTemplateContext?: string;
  }) => Promise<Partial<BuilderState> | null>;
  isGenerating: boolean;
  error: string | null;
}
