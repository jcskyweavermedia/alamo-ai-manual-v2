// =============================================================================
// Course Builder Types
// Defines all TypeScript interfaces for the Course Builder feature.
// Element-based architecture with nested sections[].elements[].
// =============================================================================

// =============================================================================
// ELEMENT TYPES
// =============================================================================

export type ElementType = 'content' | 'feature' | 'media' | 'product_viewer';
export type ElementStatus = 'outline' | 'generated' | 'reviewed';
export type FeatureVariant = 'tip' | 'best_practice' | 'caution' | 'warning' | 'did_you_know' | 'key_point';
export type MediaType = 'image' | 'video' | 'youtube';
export type ImageSource = 'upload' | 'ai_generated' | 'product_image' | 'external';
export type ProductTable = 'foh_plate_specs' | 'wines' | 'cocktails' | 'prep_recipes' | 'beer_liquor_list';

export interface SourceRef {
  table: string;       // 'manual_sections' | 'foh_plate_specs' | 'wines' | etc.
  id: string;          // UUID
  content_hash: string; // MD5 at build time
}

// --- Base Element (shared fields) ---
interface BaseElement {
  key: string;
  ai_instructions: string;
  source_refs: SourceRef[];
  sort_order: number;
  status: ElementStatus;
}

// --- Content Element ---
export interface ContentElement extends BaseElement {
  type: 'content';
  title_en?: string;
  title_es?: string;
  body_en: string;
  body_es: string;
}

// --- Feature Element ---
export interface FeatureElement extends BaseElement {
  type: 'feature';
  variant: FeatureVariant;
  title_en?: string;
  title_es?: string;
  body_en: string;
  body_es: string;
  icon?: string;
}

// --- Media Element ---
export interface MediaElement extends BaseElement {
  type: 'media';
  media_type: MediaType;
  image_url?: string;
  image_source?: ImageSource;
  ai_image_prompt?: string;
  video_url?: string;
  caption_en?: string;
  caption_es?: string;
  alt_text_en?: string;
  alt_text_es?: string;
}

// --- Product Viewer Element ---
export interface ProductViewerElement extends BaseElement {
  type: 'product_viewer';
  products: Array<{
    table: ProductTable;
    id: string;
    name_en: string;
    name_es: string;
  }>;
}

// --- Union ---
export type CourseElement = ContentElement | FeatureElement | MediaElement | ProductViewerElement;

// --- Type Guards ---
export function isProductViewerElement(el: CourseElement): el is ProductViewerElement {
  return el.type === 'product_viewer';
}

// =============================================================================
// QUIZ CONFIGURATION
// =============================================================================

export type QuizMode = 'multiple_choice' | 'voice_response' | 'interactive_ai' | 'mixed';
export type TeacherLevel = 'friendly' | 'professional' | 'strict' | 'expert';

export interface QuizConfig {
  quiz_mode: QuizMode;
  question_count: number;
  question_pool_size: number;
  passing_score: number;
  max_attempts: number | null;
  cooldown_minutes: number;
  shuffle_questions: boolean;
  shuffle_options: boolean;
  show_feedback_immediately: boolean;
}

// =============================================================================
// COURSE / SECTION (DB shape, camelCase)
// =============================================================================

export type CourseType = 'menu_rollout' | 'sop_review' | 'steps_of_service' | 'line_cook' | 'custom' | 'blank';
export type CourseStatus = 'draft' | 'outline' | 'generating' | 'review' | 'published' | 'archived';

export interface Course {
  id: string;
  groupId: string;
  slug: string;
  titleEn: string;
  titleEs: string;
  descriptionEn: string;
  descriptionEs: string;
  icon: string;
  courseType: CourseType;
  teacherLevel: TeacherLevel;
  teacherId: string | null;
  quizConfig: QuizConfig;
  status: CourseStatus;
  version: number;
  estimatedMinutes: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

export interface CourseSection {
  id: string;
  courseId: string;
  groupId: string;
  slug: string;
  titleEn: string;
  titleEs: string;
  elements: CourseElement[];
  sourceRefs: SourceRef[];
  generationStatus: 'empty' | 'outline' | 'generating' | 'generated' | 'reviewed';
  sortOrder: number;
  estimatedMinutes: number;
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// WIZARD CONFIGURATION
// =============================================================================

export interface WizardConfig {
  courseType: CourseType;
  title: string;
  titleEs: string;
  description: string;
  descriptionEs: string;
  selectedSourceIds: SourceRef[];     // Items / sections picked in the wizard
  teacherLevel: TeacherLevel;
  teacherId: string | null;
  quizConfig: QuizConfig;
  additionalInstructions: string;
  assignTo: AssignmentTarget;
  deadline: string | null;
  expiresAt: string | null;
  // Edge-function-compatible fields (read by build-course handleOutline)
  ai_instructions?: string;
  source_sections?: string[];
  source_products?: Array<{ table: string; ids: string[] }>;
}

export interface AssignmentTarget {
  mode: 'all_staff' | 'by_role' | 'individual';
  roleIds?: string[];
  userIds?: string[];
}

// =============================================================================
// BUILDER STATE
// =============================================================================

export type CourseBuilderTab = 'elements' | 'settings' | 'quiz' | 'preview';
export type CourseRightPanelMode = 'ai-chat' | 'element-properties' | 'quiz-config' | 'settings';
export type CourseSaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

export interface CourseBuilderSnapshot {
  sections: CourseSection[];
  titleEn: string;
  titleEs: string;
  descriptionEn: string;
  descriptionEs: string;
  icon: string;
  teacherLevel: TeacherLevel;
  quizConfig: QuizConfig;
}

export interface CourseBuilderState {
  // Course identity
  courseId: string | null;
  groupId: string;
  slug: string;
  titleEn: string;
  titleEs: string;
  descriptionEn: string;
  descriptionEs: string;
  icon: string;
  courseType: CourseType;
  status: CourseStatus;
  version: number;
  publishedAt: string | null;

  // Teacher
  teacherLevel: TeacherLevel;
  teacherId: string | null;

  // Quiz
  quizConfig: QuizConfig;

  // Sections & Elements
  sections: CourseSection[];
  activeSectionId: string | null;   // Which section is visible in the canvas
  selectedElementKey: string | null; // Which element is selected (for properties panel)

  // UI Navigation
  activeTab: CourseBuilderTab;
  rightPanelMode: CourseRightPanelMode;

  // Save lifecycle
  isDirty: boolean;
  saveStatus: CourseSaveStatus;
  isSaving: boolean;
  serverUpdatedAt: string | null;
  hasUnpublishedChanges: boolean;

  // Undo/Redo
  past: CourseBuilderSnapshot[];
  future: CourseBuilderSnapshot[];
  maxHistory: 30;

  // AI generation state
  aiGenerating: boolean;
  aiGeneratingElementKey: string | null; // Which element is being generated (null = bulk)
  aiProgress: { completed: number; total: number } | null;

  // AI Chat
  builderChatMessages: CourseBuilderChatMessage[];
  builderChatLoading: boolean;

  // Wizard state (null after wizard completes)
  wizardConfig: WizardConfig | null;
}

// =============================================================================
// BUILDER ACTIONS (reducer discriminated union)
// =============================================================================

export type CourseBuilderAction =
  // Hydrate / Reset
  | { type: 'HYDRATE'; payload: Partial<CourseBuilderState>; preserveUIState?: boolean }
  | { type: 'RESET' }

  // Course metadata
  | { type: 'SET_TITLE_EN'; payload: string }
  | { type: 'SET_TITLE_ES'; payload: string }
  | { type: 'SET_DESCRIPTION_EN'; payload: string }
  | { type: 'SET_DESCRIPTION_ES'; payload: string }
  | { type: 'SET_SLUG'; payload: string }
  | { type: 'SET_ICON'; payload: string }
  | { type: 'SET_COURSE_TYPE'; payload: CourseType }
  | { type: 'SET_STATUS'; payload: CourseStatus }
  | { type: 'SET_TEACHER_LEVEL'; payload: TeacherLevel }
  | { type: 'SET_TEACHER_PERSONA'; payload: string | null }
  | { type: 'SET_QUIZ_CONFIG'; payload: Partial<QuizConfig> }

  // UI Navigation
  | { type: 'SET_ACTIVE_TAB'; payload: CourseBuilderTab }
  | { type: 'SET_RIGHT_PANEL_MODE'; payload: CourseRightPanelMode }
  | { type: 'SET_ACTIVE_SECTION'; payload: string | null }
  | { type: 'SET_SELECTED_ELEMENT'; payload: string | null }

  // Section operations (undoable)
  | { type: 'ADD_SECTION'; payload: { section: CourseSection } }
  | { type: 'UPDATE_SECTION'; payload: { id: string; updates: Partial<CourseSection> } }
  | { type: 'REMOVE_SECTION'; payload: { id: string } }
  | { type: 'REORDER_SECTIONS'; payload: CourseSection[] }

  // Element operations (undoable, scoped to activeSectionId)
  | { type: 'ADD_ELEMENT'; payload: { sectionId: string; element: CourseElement } }
  | { type: 'ADD_ELEMENT_AT_INDEX'; payload: { sectionId: string; element: CourseElement; index: number } }
  | { type: 'UPDATE_ELEMENT'; payload: { sectionId: string; key: string; updates: Partial<CourseElement> } }
  | { type: 'REMOVE_ELEMENT'; payload: { sectionId: string; key: string } }
  | { type: 'REORDER_ELEMENTS'; payload: { sectionId: string; elements: CourseElement[] } }

  // Save lifecycle
  | { type: 'SAVE_START' }
  | { type: 'SAVE_SUCCESS'; payload: { updatedAt: string } }
  | { type: 'SAVE_ERROR'; payload: { error: string } }

  // Publish
  | { type: 'PUBLISH'; payload: { version: number; publishedAt: string } }

  // AI generation
  | { type: 'AI_GENERATE_OUTLINE_START' }
  | { type: 'AI_GENERATE_OUTLINE_SUCCESS'; payload: { sections: CourseSection[] } }
  | { type: 'AI_GENERATE_OUTLINE_ERROR' }
  | { type: 'AI_BUILD_ALL_START'; payload: { total: number } }
  | { type: 'AI_BUILD_ELEMENT_START'; payload: { key: string } }
  | { type: 'AI_BUILD_ELEMENT_SUCCESS'; payload: { sectionId: string; key: string; updates: Partial<CourseElement> } }
  | { type: 'AI_BUILD_ELEMENT_ERROR'; payload: { key: string } }
  | { type: 'AI_BUILD_ALL_COMPLETE' }
  | { type: 'AI_PROGRESS_UPDATE'; payload: { completed: number; total: number } }

  // AI Chat
  | { type: 'BUILDER_CHAT_ADD_MESSAGE'; payload: CourseBuilderChatMessage }
  | { type: 'BUILDER_CHAT_SET_LOADING'; payload: boolean }
  | { type: 'BUILDER_CHAT_CLEAR' }
  | { type: 'APPLY_CHAT_COURSE_UPDATES'; payload: CourseBuilderChatUpdates }

  // Wizard
  | { type: 'SET_WIZARD_CONFIG'; payload: WizardConfig | null }

  // Undo / Redo
  | { type: 'UNDO' }
  | { type: 'REDO' };

// =============================================================================
// AI CHAT TYPES
// =============================================================================

export interface CourseBuilderChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  changeSummary?: string[];
  confidence?: number;
}

export interface CourseBuilderChatUpdates {
  titleEn?: string;
  titleEs?: string;
  descriptionEn?: string;
  descriptionEs?: string;
  icon?: string;
  teacherLevel?: TeacherLevel;
  quizConfig?: Partial<QuizConfig>;
  elementsToAdd?: Array<{ sectionId: string; element: CourseElement }>;
  elementsToRemove?: Array<{ sectionId: string; key: string }>;
  elementsToModify?: Array<{ sectionId: string; key: string; updates: Partial<CourseElement> }>;
  reorderedElementKeys?: Array<{ sectionId: string; keys: string[] }>;
}

// =============================================================================
// CONTEXT API
// =============================================================================

export interface CourseBuilderContextValue {
  state: CourseBuilderState;
  dispatch: React.Dispatch<CourseBuilderAction>;

  // Derived
  canUndo: boolean;
  canRedo: boolean;
  activeSection: CourseSection | null;
  elementCount: number;

  // Convenience actions
  addElement: (type: ElementType, variant?: FeatureVariant) => void;
  addElementAtIndex: (type: ElementType, index: number, variant?: FeatureVariant) => void;
  removeElement: (key: string) => void;
  updateElement: (key: string, updates: Partial<CourseElement>) => void;
  moveElementUp: (key: string) => void;
  moveElementDown: (key: string) => void;
  selectElement: (key: string | null) => void;
  addSection: (title: string) => void;
  removeSection: (id: string) => void;
  setActiveSection: (id: string) => void;

  // Title with auto-slug
  setTitleEn: (value: string) => void;

  // Save + publish
  saveDraft: () => Promise<void>;
  publish: () => Promise<void>;

  // Undo / redo
  undo: () => void;
  redo: () => void;
}
