# Course Builder — Frontend Phases

> Comprehensive phased frontend plan for the Course Builder and Course Player.
> Reference pattern: Form Builder (`BuilderContext`, `AdminFormBuilderPage`, `AIBuilderPanel`).
> All paths relative to `src/` within `alamo-ai-manual-v2/`.

---

## ⚠️ Master Plan Alignment (Updated 2026-03-05)

> This sub-plan was written BEFORE the owner's design decisions were finalized. The **master-implementation-plan.md** is the authoritative document. The following alignment notes indicate where this sub-plan diverges and what takes precedence at build time.

### Phase Mapping (Frontend phases → Master Plan phases)

| Frontend Phase | Maps to Master Plan | Key Difference |
|----------------|-------------------|----------------|
| Phase 1a: HTML Mockup | **Phase 1** | Same content. |
| Phase 1b: Teardown | **Phase 2** | Teardown runs with DB teardown, not in parallel with mockup. |
| Phase 2: Types/State/Shell | **Phase 3** | Same content. |
| Phase 3: Element System | **Phase 3** | Same content. |
| Phase 4: Wizard System | **Phase 4** (Menu Rollout ONLY) | **CRITICAL**: Master plan builds ONE wizard at a time. Phase 4 = Menu Rollout only. Other wizards: SOP Review + Steps of Service → Phase 8. Line Cook + Custom + Start Blank → Phase 9. |
| Phase 5: AI Integration | **Phase 4** | AI pipeline and image gen are in master plan Phase 4, not separate. |
| Phase 6: Quiz Builder | **Phase 5** | Same content. |
| Phase 7: Course Player | **Phase 5** | Course Player is part of master plan Phase 5 (Quiz + Player MVP). |
| Phase 8: Manager Dashboard | **Phase 8** | Dashboard comes with rollouts in Phase 8, not right after player. |
| Phase 9: Polish | **Phase 9** | Same content. |

### Key Design Changes (Owner Decisions)

1. **Arrow-based element reordering, NOT drag-and-drop** — Up/down arrow buttons on the left side of element cards. DnD is ONLY for adding new elements from the palette to the canvas. Update all references to "drag handle" → "move arrows", `SortableContext` canvas reorder → arrow button click handlers.

2. **One wizard at a time, battle-test each** — `CourseWizardDialog.tsx` shows 6 wizard cards, but only "Menu Rollout" is active in Phase 4. Others show "Coming Soon" and unlock in later phases.

3. **Image generation in Phase 4 (not deferred)** — `MediaElementEditor.tsx` has "Generate Image" button active from day one. DALL-E 3 for educational illustrations (NOT dish photos — those come from product DB).

4. **Element-level rebuild UI in Phase 6** — New components: `ContentChangeAlertBanner.tsx` (full-width alert with per-element stale list), `ElementRebuildLogPage.tsx` (rebuild audit trail). Admin-triggered only.

5. **Phase 5 = Quiz + Player MVP** — Both quiz builder AND course player are in master plan Phase 5. The stub page from Phase 2 is replaced, training goes live.

---

## Table of Contents

1. [Phase 1a: Static HTML Mockup](#phase-1a-static-html-mockup)
2. [Phase 1b: Teardown (Remove Old Training UI)](#phase-1b-teardown)
3. [Phase 2: Types, State, and Shell](#phase-2-types-state-and-shell)
4. [Phase 3: Element System (Palette + Canvas + Renderers)](#phase-3-element-system)
5. [Phase 4: Wizard System](#phase-4-wizard-system)
6. [Phase 5: AI Integration (Chat Panel + Per-Element AI + Build Pipeline)](#phase-5-ai-integration)
7. [Phase 6: Quiz Configuration Builder](#phase-6-quiz-configuration-builder)
8. [Phase 7: Course Player (Staff Learning UI)](#phase-7-course-player)
9. [Phase 8: Manager Dashboard + Change Tracking](#phase-8-manager-dashboard)
10. [Phase 9: Polish, Mobile, Accessibility](#phase-9-polish)

---

## Dependency Map

```
Phase 1a (Mockup)           ─── no deps, can start immediately
Phase 1b (Teardown)         ─── no deps, can run parallel with 1a
Phase 2  (Types/State/Shell) ── depends on 1b (routes cleared)
Phase 3  (Elements)          ── depends on 2 (types + context exist)
Phase 4  (Wizards)           ── depends on 2 (types), needs DB tables from DB Phase
Phase 5  (AI Integration)    ── depends on 3 (canvas), needs edge functions
Phase 6  (Quiz Builder)      ── depends on 3 (canvas), needs DB quiz tables
Phase 7  (Course Player)     ── depends on 3 (element renderers), needs DB enrollment tables
Phase 8  (Dashboard)         ── depends on 7 (enrollment data flowing), needs DB rollout tables
Phase 9  (Polish)            ── depends on 3-8 all existing
```

**Key insight**: Phases 1a, 1b, and 2 are frontend-only. Phase 3 needs the new `courses` + `course_sections` tables. Phase 4+ needs wizard-related DB tables and edge functions. The frontend plan assumes the DB migration agent delivers tables in sync.

---

## Phase 1a: Static HTML Mockup

**Goal**: Clickable HTML/CSS prototype validating the layout, element rendering, wizard flows, and mobile responsiveness. No React, no backend.

### Deliverables

| File | Content |
|------|---------|
| `mockup/index.html` | Course Builder editor (3-column desktop, tabbed mobile) |
| `mockup/wizard.html` | Menu Rollout + SOP Review wizard screens |
| `mockup/player.html` | Course Player learning UI |
| `mockup/dashboard.html` | Manager Training Dashboard |
| `mockup/alert-banner.html` | Full-width content-change notification banner |

### What Gets Validated

1. Three-column layout: palette (176px) | canvas (flex) | AI panel (40%)
2. Element cards in outline state vs. generated state
3. Content element with rendered Markdown (tables, lists, headers)
4. Feature element variants (6 color/icon combos)
5. Media element (image placeholder, YouTube embed placeholder)
6. Per-element controls: up/down move arrows (left side), AI button, edit, delete
7. Wizard step indicators and form layouts
8. Quiz configuration panel
9. Teacher level selector
10. Source material picker with search
11. iPad breakpoint (3-column preserved)
12. Phone breakpoint (tab switching: Canvas | Elements | AI)
13. Full-width alert banner for content changes

**No backend dependencies. Can start immediately.**

---

## Phase 1b: Teardown

**Goal**: Remove all existing training UI, hooks, components, types, and routes. Clean slate for the rebuild.

### Files to Delete

#### Pages (7 files)
```
pages/TrainingHome.tsx
pages/ProgramDetail.tsx
pages/CourseDetail.tsx
pages/LearningSession.tsx
pages/QuizPage.tsx
pages/ModuleTestPage.tsx
pages/PracticeTutorPage.tsx
pages/ManagerTrainingDashboard.tsx
```

#### Components (27 files)
```
components/training/AssessmentCard.tsx
components/training/AssessmentChatPanel.tsx
components/training/ChatBubble.tsx
components/training/CompetencyBadge.tsx
components/training/ContentPanel.tsx
components/training/CourseCard.tsx
components/training/DashboardStats.tsx
components/training/LiveTrainerFloatingButton.tsx
components/training/ModuleTestResultsView.tsx
components/training/ProgramCard.tsx
components/training/ProgressRing.tsx
components/training/ProgressStrip.tsx
components/training/QuizMCQuestion.tsx
components/training/QuizProgressBar.tsx
components/training/QuizResults.tsx
components/training/QuizVoiceQuestion.tsx
components/training/RolloutCard.tsx
components/training/RolloutWizard.tsx
components/training/SectionListItem.tsx
components/training/ServerDetailPanel.tsx
components/training/SuggestedReplyChips.tsx
components/training/TeamProgressTable.tsx
components/training/TopicProgressBar.tsx
components/training/TrainingChatPanel.tsx
components/training/TutorChatPanel.tsx
components/training/TutorModeCard.tsx
components/training/VoiceConsentDialog.tsx
```

#### Hooks (16 files)
```
hooks/use-assessment-chat.ts
hooks/use-course-assessment.ts
hooks/use-courses.ts
hooks/use-course-sections.ts
hooks/use-enrollment.ts
hooks/use-learning-session.ts
hooks/use-module-test.ts
hooks/use-my-rollouts.ts
hooks/use-pinned-courses.ts
hooks/use-practice-tutor.ts
hooks/use-program-enrollment.ts
hooks/use-programs.ts
hooks/use-quiz-session.ts
hooks/use-rollouts.ts
hooks/use-section-progress.ts
hooks/use-team-training.ts
hooks/use-training-chat.ts
hooks/use-content-changes.ts
```

#### Types (1 file — rewritten in Phase 2)
```
types/training.ts
```

### Routes to Remove (from `App.tsx`)

```
/courses                                    → TrainingHome
/courses/:programSlug                       → ProgramDetail
/courses/:programSlug/:courseSlug           → CourseDetail
/courses/:programSlug/:courseSlug/test      → ModuleTestPage
/courses/:programSlug/:courseSlug/practice  → PracticeTutorPage
/courses/:programSlug/:courseSlug/:sectionSlug      → LearningSession
/courses/:programSlug/:courseSlug/:sectionSlug/quiz → QuizPage
/admin/training                             → ManagerTrainingDashboard
```

### Navigation Changes

- Remove "Training" / "Courses" link from sidebar navigation (will be re-added in Phase 7)
- Remove any pinned-courses references from the home page / filing cabinet

**No backend dependencies. Can run in parallel with Phase 1a.**

---

## Phase 2: Types, State, and Shell

**Goal**: Define all TypeScript interfaces, build `CourseBuilderContext` (reducer + provider), create the page shell with three-column layout, and register routes.

### 2.1 Types — `types/course-builder.ts` (NEW)

```typescript
// =============================================================================
// ELEMENT TYPES
// =============================================================================

export type ElementType = 'content' | 'feature' | 'media';
export type ElementStatus = 'outline' | 'generated' | 'reviewed';
export type FeatureVariant = 'tip' | 'best_practice' | 'caution' | 'warning' | 'did_you_know' | 'key_point';
export type MediaType = 'image' | 'video' | 'youtube';
export type ImageSource = 'upload' | 'ai_generated' | 'product_image' | 'external';

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

// --- Union ---
export type CourseElement = ContentElement | FeatureElement | MediaElement;

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
export type CourseStatus = 'draft' | 'published' | 'archived';

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
  teacherPersonaId: string | null;
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
  generationStatus: 'pending' | 'outline' | 'generated' | 'reviewed';
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
  teacherPersonaId: string | null;
  quizConfig: QuizConfig;
  additionalInstructions: string;
  assignTo: AssignmentTarget;
  deadline: string | null;
  expiresAt: string | null;
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
  teacherPersonaId: string | null;

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
  moveElement: (activeKey: string, overKey: string) => void;
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
```

### 2.2 Types — `types/course-player.ts` (NEW)

```typescript
// =============================================================================
// PLAYER / ENROLLMENT / PROGRESS TYPES (rebuilt from scratch)
// =============================================================================

export type EnrollmentStatus = 'enrolled' | 'in_progress' | 'completed' | 'expired';
export type SectionProgressStatus = 'not_started' | 'in_progress' | 'completed';
export type QuizAttemptStatus = 'in_progress' | 'completed' | 'abandoned';

export interface CourseEnrollment {
  id: string;
  userId: string;
  courseId: string;
  groupId: string;
  status: EnrollmentStatus;
  courseVersion: number;
  startedAt: string | null;
  completedAt: string | null;
  expiresAt: string | null;
  totalSections: number;
  completedSections: number;
  finalScore: number | null;
  finalPassed: boolean | null;
  createdAt: string;
  updatedAt: string;
}

export interface SectionProgress {
  id: string;
  userId: string;
  sectionId: string;
  enrollmentId: string;
  courseId: string;
  status: SectionProgressStatus;
  elementsViewed: number;
  elementsTotal: number;
  quizScore: number | null;
  quizPassed: boolean | null;
  quizAttempts: number;
  timeSpentSeconds: number;
  contentHashAtCompletion: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface QuizQuestion {
  id: string;
  questionType: 'multiple_choice' | 'voice_response' | 'interactive_ai';
  questionEn: string;
  questionEs: string;
  options?: Array<{ id: string; textEn: string; textEs: string }>;
  rubricSummary?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  timesShown: number;
  timesCorrect: number;
}

export interface QuizAttempt {
  id: string;
  enrollmentId: string;
  sectionId: string;
  attemptNumber: number;
  status: QuizAttemptStatus;
  score: number | null;
  passed: boolean | null;
  startedAt: string;
  completedAt: string | null;
}

// AI Teacher conversation
export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  source?: 'text' | 'voice';
}

// Course browse card (list view)
export interface CourseListItem {
  id: string;
  slug: string;
  titleEn: string;
  titleEs: string;
  descriptionEn: string;
  descriptionEs: string;
  icon: string;
  courseType: string;
  teacherLevel: string;
  estimatedMinutes: number;
  status: string;
  enrollmentStatus: EnrollmentStatus | null;
  progressPercent: number;
  totalSections: number;
  completedSections: number;
}
```

### 2.3 Context — `contexts/CourseBuilderContext.tsx` (NEW)

Follows the exact same pattern as `BuilderContext.tsx`:

```
CourseBuilderProvider
  ├── useReducer(courseBuilderReducer, initialState)
  ├── Auto-save (3s debounce when isDirty)
  ├── Keyboard shortcuts (Ctrl+Z, Ctrl+Shift+Z, Ctrl+S, Escape)
  ├── Undo/Redo (snapshot-based, 30 max history)
  ├── saveDraftInternal() with optimistic concurrency
  └── CourseBuilderContext.Provider → value: CourseBuilderContextValue
```

**Key differences from Form Builder**:
- Elements live inside `sections[].elements[]` (nested), not flat `fields[]`
- `activeSectionId` controls which section's elements are visible
- AI generation has multi-step progress tracking (`AI_BUILD_ALL_START` -> per-element -> `AI_BUILD_ALL_COMPLETE`)
- Wizard config is transient state cleared after outline generation

### 2.4 Page Shell — `pages/admin/AdminCourseBuilderPage.tsx` (NEW)

```tsx
// Wraps in CourseBuilderProvider, same DndContext pattern as AdminFormBuilderPage
export default function AdminCourseBuilderPage() {
  return (
    <CourseBuilderProvider>
      <CourseBuilderPageContent />
    </CourseBuilderProvider>
  );
}
```

Desktop layout:
```
┌──────────────────────────────────────────────────────────────────┐
│  CourseBuilderTopBar (← Back, title, save status, undo/redo, publish)
├──────────┬───────────────────────────────────────┬───────────────┤
│ Element  │         CourseBuilderCanvas            │   Right Panel │
│ Palette  │         (element cards)                │   (AI/Props)  │
│ +Section │                                        │               │
│ Nav      │                                        │               │
├──────────┴───────────────────────────────────────┴───────────────┤
│  Bottom tabs: Settings | Outline | Content | Quiz | Preview      │
└──────────────────────────────────────────────────────────────────┘
```

Mobile layout:
```
┌─────────────────────────────┐
│ ← Back   Course Title       │
├─────────────────────────────┤
│ [Canvas] [Elements] [AI]    │
├─────────────────────────────┤
│  (active tab content)       │
└─────────────────────────────┘
```

### 2.5 Routes (added to `App.tsx`)

```
/admin/courses                        → AdminCourseListPage (list all courses)
/admin/courses/new                    → AdminCourseBuilderPage (wizard → builder)
/admin/courses/:id/edit               → AdminCourseBuilderPage (load existing)
/admin/courses/changelog              → CourseChangeLogPage
/admin/training                       → ManagerTrainingDashboard (rebuilt)
```

Staff routes (re-registered in Phase 7):
```
/courses                              → CourseHomePage (browse courses)
/courses/:courseSlug                   → CoursePlayerPage (learn)
/courses/:courseSlug/:sectionSlug      → CourseSectionPlayer
/courses/:courseSlug/:sectionSlug/quiz → CourseQuizPage
```

### 2.6 Component Tree (Phase 2 shell)

```
AdminCourseBuilderPage
├── CourseBuilderProvider
│   └── CourseBuilderPageContent
│       ├── DndContext
│       │   ├── CourseBuilderTopBar
│       │   ├── ElementPalette (stub)
│       │   ├── CourseBuilderCanvas (empty state only)
│       │   └── RightPanel (stub)
│       └── MobileTabBar
└── AdminCourseListPage (simple list with create button)
```

**Depends on**: Phase 1b (routes cleared). No DB dependency yet.

---

## Phase 3: Element System

**Goal**: Build the element palette, canvas with drag-and-drop, and all three element renderers (content, feature, media). This is the core editing experience.

### 3.1 New Components

#### `components/course-builder/ElementPalette.tsx`

```typescript
interface ElementPaletteProps {
  language: 'en' | 'es';
  onClickAdd: (type: ElementType, variant?: FeatureVariant) => void;
}
```

Three groups:
- **Elements**: Content, Feature (with sub-menu for 6 variants), Media
- **Sections**: Section navigator (Overview, Lesson 1, Lesson 2, ..., Quiz Settings)
- Each tile is `useDraggable()` (same pattern as `FieldPalette`)

Drag prefix: `course-palette::`

#### `components/course-builder/CourseBuilderCanvas.tsx`

```typescript
interface CourseBuilderCanvasProps {
  language: 'en' | 'es';
}
```

- Reads `activeSection` from context
- Renders `SortableContext` with section's `elements[]`
- Each element wrapped in `ElementCardWrapper`
- Empty state with "Drag elements from the palette" message
- "Add Element" button for mobile

#### `components/course-builder/ElementCardWrapper.tsx`

```typescript
interface ElementCardWrapperProps {
  element: CourseElement;
  isSelected: boolean;
  language: 'en' | 'es';
  onSelect: (key: string) => void;
  onOpenProperties: (key: string) => void;
  onDelete: (key: string) => void;
  onAIGenerate: (key: string) => void;
  children: ReactNode;
}
```

Controls per element:
- `[drag-handle]` — `useSortable()` from dnd-kit
- `[AI]` button — opens inline AI prompt or triggers AI generation
- `[Edit]` button — toggles inline editing mode
- `[Delete]` button — removes with undo support
- Status badge: outline / generated / reviewed

#### `components/course-builder/renderers/ContentElementRenderer.tsx`

```typescript
interface ContentElementRendererProps {
  element: ContentElement;
  language: 'en' | 'es';
  isEditing: boolean;
  onUpdate: (updates: Partial<ContentElement>) => void;
}
```

- **Outline state**: Shows title + `ai_instructions` as editable prompt text
- **Generated state**: Renders Markdown via `ReactMarkdown` + `remarkGfm`
- **Edit mode**: Switches to raw Markdown textarea with live preview toggle
- Bilingual toggle (EN/ES) in the card header

#### `components/course-builder/renderers/FeatureElementRenderer.tsx`

```typescript
interface FeatureElementRendererProps {
  element: FeatureElement;
  language: 'en' | 'es';
  isEditing: boolean;
  onUpdate: (updates: Partial<FeatureElement>) => void;
}
```

Visual treatment per variant:
| Variant | BG Color | Border | Icon |
|---------|----------|--------|------|
| `tip` | `bg-blue-50` | `border-l-4 border-blue-500` | Lightbulb |
| `best_practice` | `bg-green-50` | `border-l-4 border-green-500` | CheckCircle |
| `caution` | `bg-amber-50` | `border-l-4 border-amber-500` | AlertTriangle |
| `warning` | `bg-red-50` | `border-l-4 border-red-500` | ShieldAlert |
| `did_you_know` | `bg-purple-50` | `border-l-4 border-purple-500` | Sparkles |
| `key_point` | `bg-indigo-50` | `border-l-4 border-indigo-500` | Star |

- Variant selector dropdown in edit mode
- Body rendered as Markdown or editable textarea

#### `components/course-builder/renderers/MediaElementRenderer.tsx`

```typescript
interface MediaElementRendererProps {
  element: MediaElement;
  language: 'en' | 'es';
  isEditing: boolean;
  onUpdate: (updates: Partial<MediaElement>) => void;
}
```

Renders based on `media_type`:
- **image**: `<img>` with caption, or placeholder with upload button
- **video**: Supabase storage video player, or placeholder
- **youtube**: YouTube iframe embed with URL input field

Edit mode:
- Media type selector (Image / Video / YouTube)
- Image: upload button, or "Use product image" search, or "AI generate" button
- Video: URL input (YouTube/Loom), or file upload for short clips
- Caption + alt text fields (EN/ES)

#### `components/course-builder/SectionNavigator.tsx`

```typescript
interface SectionNavigatorProps {
  sections: CourseSection[];
  activeSectionId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onReorder: (sections: CourseSection[]) => void;
  language: 'en' | 'es';
}
```

- Lives below the element palette (left panel)
- Shows: Overview, Lesson 1, Lesson 2, ..., Quiz Settings
- Each item shows: title, element count, generation status badge
- Click to switch `activeSectionId`
- Drag to reorder sections
- "+" button to add a new section

#### `components/course-builder/CourseBuilderTopBar.tsx`

```typescript
interface CourseBuilderTopBarProps {
  language: 'en' | 'es';
  onSave?: () => void | Promise<void>;
}
```

- Back arrow (navigate to `/admin/courses`)
- Editable course title (inline)
- Save status indicator (saved / saving / unsaved / error)
- Undo / Redo buttons
- [Save Draft] button
- [Publish] button (with confirmation)

#### `components/course-builder/ElementPropertiesPanel.tsx`

```typescript
interface ElementPropertiesPanelProps {
  element: CourseElement;
  language: 'en' | 'es';
}
```

- Shows when an element is selected and right panel is in `element-properties` mode
- Fields depend on element type:
  - Content: title, ai_instructions, source_refs, status
  - Feature: variant selector, icon override, title, ai_instructions, status
  - Media: media_type, image_source, URLs, caption, alt_text, ai_instructions, status
- "Close" button returns panel to AI chat mode

### 3.2 Lib Utilities — `lib/course-builder/builder-utils.ts` (NEW)

```typescript
export function generateElementKey(type: ElementType, existingKeys: string[]): string;
export function generateCourseSlug(title: string): string;
export function getDefaultElement(type: ElementType, variant?: FeatureVariant): CourseElement;
export function getDefaultQuizConfig(): QuizConfig;
export function getDefaultSection(title: string): CourseSection;

// Feature variant metadata
export const FEATURE_VARIANTS: Record<FeatureVariant, {
  labelEn: string;
  labelEs: string;
  color: string;
  bgClass: string;
  borderClass: string;
  icon: string; // Lucide icon name
}>;
```

### 3.3 Hooks

#### `hooks/use-course-builder-dnd.ts`

Handles DnD logic for the page-level `DndContext`:
- Palette -> canvas: insert new element at drop position
- Canvas -> canvas: reorder elements within active section

### 3.4 What This Phase Delivers

A fully functional three-column editor where you can:
- Add content/feature/media elements from the palette (click or drag)
- Reorder elements via drag-and-drop
- Navigate between sections
- Edit element content inline
- See feature variants with proper color coding
- Undo/redo all operations
- Auto-save drafts to database

**Depends on**: Phase 2 (types + context). Needs `courses` + `course_sections` DB tables.

---

## Phase 4: Wizard System

**Goal**: Build the 6 course creation wizards that guide the user from intent to AI-generated outline.

### 4.1 New Components

#### `components/course-builder/wizards/CourseWizardDialog.tsx`

```typescript
interface CourseWizardDialogProps {
  open: boolean;
  onClose: () => void;
  onComplete: (config: WizardConfig) => void;
  language: 'en' | 'es';
}
```

- Full-screen dialog (like Form Builder's `FormCreationDialog`)
- Step 1: Choose wizard type (6 cards: Menu Rollout, SOP Review, Steps of Service, Line Cook, Custom, Start Blank)
- Clicking a card either opens the wizard flow or drops straight into the editor (Start Blank)

#### `components/course-builder/wizards/WizardStepLayout.tsx`

```typescript
interface WizardStepLayoutProps {
  currentStep: number;
  totalSteps: number;
  stepTitle: string;
  onBack: () => void;
  onNext: () => void;
  onCancel: () => void;
  canProceed: boolean;
  isLastStep?: boolean;
  children: ReactNode;
  language: 'en' | 'es';
}
```

- Step indicator (numbered circles with connecting lines)
- Content area (children)
- Back / Next / Cancel buttons
- "Build Course" on the last step

#### `components/course-builder/wizards/MenuRolloutWizard.tsx`

6 steps:
1. Course Details (title, description, why, effective date, urgency)
2. Item Selection (SourceMaterialPicker — multi-domain search)
3. Assessment Type (QuizModeSelector)
4. Assignment (AssignmentPicker)
5. Longevity (deadline, expiry, recurring toggle)
6. Review & Build (summary card → "Build Course" button)

#### `components/course-builder/wizards/SOPReviewWizard.tsx`

6 steps:
1. Topic Selection (dual path: browse manual sections OR describe topic for AI search)
2. Course Details
3. AI Instructions (additional context textarea)
4. Assessment Type
5. Assignment & Longevity
6. Review & Build

#### `components/course-builder/wizards/StepsOfServiceWizard.tsx`

6 steps:
1. Role Selection (Server, Busser, Bartender, Barback, Host)
2. Step Selection (checkboxes for role's service steps)
3. Course Details
4. Assessment Type (defaults to Interactive AI with credit warning)
5. Assignment & Longevity
6. Review & Build

#### `components/course-builder/wizards/LineCookWizard.tsx`

6 steps:
1. Training Focus (dual: Operational Standards from manual + Dish Training from products)
2. Portion Detail Level toggle (Basic / Detailed)
3. Course Details
4. Assessment Type (defaults to Multiple Choice)
5. Assignment & Longevity
6. Review & Build

#### `components/course-builder/wizards/CustomCourseWizard.tsx`

6 steps:
1. Course Description (free-text)
2. Source Material (3 paths: search everything, pick sources, upload new)
3. AI Instructions
4. Assessment Type
5. Assignment & Longevity
6. Review & Build

### 4.2 Shared Wizard Sub-Components

#### `components/course-builder/wizards/shared/SourceMaterialPicker.tsx`

```typescript
interface SourceMaterialPickerProps {
  selectedSources: SourceRef[];
  onChange: (sources: SourceRef[]) => void;
  allowedTables?: string[];  // Filter which DB tables to search
  language: 'en' | 'es';
}
```

- Searchable list with domain filters (Manual Sections, Dishes, Wines, Cocktails, Recipes, Beer & Liquor)
- Each result shows: title, table source icon, preview snippet
- Click to toggle selection
- Selected items shown as chips at top
- Uses existing search functions: `search_manual_v2`, `search_dishes`, `search_wines`, `search_cocktails`, `search_recipes`, `search_beer_liquor`

#### `components/course-builder/wizards/shared/QuizModeSelector.tsx`

```typescript
interface QuizModeSelectorProps {
  value: QuizConfig;
  onChange: (config: Partial<QuizConfig>) => void;
  language: 'en' | 'es';
}
```

- 4 radio cards (MC, Voice, Interactive AI, Mixed)
- Interactive AI shows credit warning dialog when selected
- Sub-options: question count, pool size, passing score, max attempts, cooldown, shuffle toggles

#### `components/course-builder/wizards/shared/TeacherLevelSelector.tsx`

```typescript
interface TeacherLevelSelectorProps {
  value: TeacherLevel;
  onChange: (level: TeacherLevel) => void;
  language: 'en' | 'es';
}
```

- 4 radio cards with description text (Friendly, Professional, Strict, Expert)
- "Professional" shown as recommended

#### `components/course-builder/wizards/shared/AssignmentPicker.tsx`

```typescript
interface AssignmentPickerProps {
  value: AssignmentTarget;
  onChange: (target: AssignmentTarget) => void;
  language: 'en' | 'es';
}
```

- Mode selector: All Staff / By Role / Individual
- By Role: multi-select role checkboxes
- Individual: user search + select

#### `components/course-builder/wizards/shared/CreditWarningDialog.tsx`

```typescript
interface CreditWarningDialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  language: 'en' | 'es';
}
```

- Warns about realtime API credit cost for Interactive AI mode
- "Use Interactive AI" / "Switch to Voice Response" buttons

### 4.3 Hooks

#### `hooks/use-source-material-search.ts`

```typescript
function useSourceMaterialSearch(options: {
  tables?: string[];
  language: 'en' | 'es';
  groupId: string;
}) => {
  search: (query: string) => Promise<SourceSearchResult[]>;
  results: SourceSearchResult[];
  isSearching: boolean;
}
```

Calls all relevant search RPCs in parallel, merges and ranks results.

### 4.4 What This Phase Delivers

Six complete wizard flows that collect all inputs needed to generate a course outline. The "Build Course" button transitions from the wizard to the editor (Phase 3) with the wizard config stored in state. The actual AI call happens in Phase 5.

**Depends on**: Phase 2 (types). Needs DB source tables already populated (manual_sections, products). Does NOT need the new course tables (wizard config is client-side state).

---

## Phase 5: AI Integration

**Goal**: Wire the AI panel, per-element AI button, outline generation, and content build pipeline.

### 5.1 New Components

#### `components/course-builder/CourseAIBuilderPanel.tsx`

```typescript
interface CourseAIBuilderPanelProps {
  language: 'en' | 'es';
  groupId: string | null;
}
```

Same pattern as `AIBuilderPanel.tsx`:
- Chat message list (scrollable)
- Input bar (text + voice recording)
- Empty state with quick-start chips ("Add a tip about allergens", "Make all callouts shorter", "Translate to Spanish")
- Change cards under assistant messages showing what was modified
- Voice recording via `useVoiceRecording` hook

Differences from Form Builder:
- Quick-start chips are course-specific
- Updates target elements within sections (not flat fields)
- Can trigger "Build All" or "Build This Element" from the panel

#### `components/course-builder/AIProgressOverlay.tsx`

```typescript
interface AIProgressOverlayProps {
  progress: { completed: number; total: number } | null;
  currentElementTitle: string;
  language: 'en' | 'es';
}
```

- Semi-transparent overlay on the canvas during "Build All"
- Progress bar: "Building element 3 of 12..."
- Current element title shown
- Cancel button

#### `components/course-builder/InlineAIPrompt.tsx`

```typescript
interface InlineAIPromptProps {
  elementKey: string;
  currentInstructions: string;
  onSubmit: (instructions: string) => void;
  onCancel: () => void;
  language: 'en' | 'es';
}
```

- Small inline popover/dialog that appears when clicking the AI button on an element
- Shows current `ai_instructions`
- Text input: "What should I change?"
- Submit triggers element regeneration
- Examples: "make this shorter", "add a table", "focus on allergens"

### 5.2 Hooks

#### `hooks/use-course-builder-chat.ts`

```typescript
function useCourseBuilderChat() => {
  sendMessage: (params: CourseBuilderChatParams) => Promise<CourseBuilderChatResponse | null>;
  isLoading: boolean;
  error: string | null;
}
```

Calls the `build-course` edge function with the current course state + chat message. Returns structured updates that get applied via `APPLY_CHAT_COURSE_UPDATES`.

#### `hooks/use-build-course.ts`

```typescript
function useBuildCourse() => {
  // Generate outline from wizard config
  generateOutline: (config: WizardConfig) => Promise<CourseSection[]>;

  // Build all elements in a section (or all sections)
  buildAll: (sectionId?: string) => Promise<void>;

  // Build a single element
  buildElement: (sectionId: string, elementKey: string, instructions?: string) => Promise<void>;

  // Generate images for media elements
  generateImages: (sectionId?: string) => Promise<void>;

  isBuilding: boolean;
  progress: { completed: number; total: number } | null;
  error: string | null;
}
```

Orchestrates AI generation:
1. `generateOutline` → calls `build-course` edge function → returns element array with status `outline`
2. `buildAll` → iterates elements, calls `build-course-element` for each → updates status to `generated`
3. `buildElement` → calls `build-course-element` for a single element
4. `generateImages` → calls `generate-course-image` for media elements that need AI images

#### `hooks/use-course-media-upload.ts`

```typescript
function useCourseMediaUpload() => {
  upload: (file: File) => Promise<{ url: string }>;
  isUploading: boolean;
  error: string | null;
}
```

Uploads to `course-media` Supabase bucket with appropriate MIME validation.

### 5.3 Integration Points

- **Wizard complete** -> `generateOutline(wizardConfig)` -> dispatches `AI_GENERATE_OUTLINE_SUCCESS` -> canvas shows outline elements
- **"Build All" button** -> `buildAll()` -> dispatches per-element updates with progress -> all elements become `generated`
- **Per-element AI button** -> `InlineAIPrompt` -> `buildElement(sectionId, key, instructions)` -> single element updated
- **AI chat panel** -> `useCourseBuilderChat.sendMessage()` -> `APPLY_CHAT_COURSE_UPDATES` -> multiple elements may be modified

### 5.4 What This Phase Delivers

Full AI-powered course authoring:
- Wizard completes -> AI generates course outline in ~5-10 seconds
- User reviews outline, reorders, edits instructions
- "Build All" generates full content with progress tracking (~30-60 seconds)
- Per-element AI button for targeted regeneration
- AI chat panel for conversational editing ("add a tip about allergens after each dish section")
- Image generation for educational content

**Depends on**: Phase 3 (canvas + renderers), Phase 4 (wizards). Needs `build-course`, `build-course-element`, `generate-course-image` edge functions.

---

## Phase 6: Quiz Configuration Builder

**Goal**: Build the quiz configuration panel within the Course Builder, and the quiz question pool management.

### 6.1 New Components

#### `components/course-builder/quiz/QuizConfigPanel.tsx`

```typescript
interface QuizConfigPanelProps {
  config: QuizConfig;
  onChange: (updates: Partial<QuizConfig>) => void;
  language: 'en' | 'es';
}
```

- Mode selector (4 radio cards)
- Question count slider
- Pool size slider
- Passing score slider (with visual bar)
- Max attempts input (number or "unlimited" toggle)
- Cooldown input
- Shuffle toggles (questions, options)
- Feedback timing toggle (immediately vs. at end)
- Credit warning for Interactive AI mode

#### `components/course-builder/quiz/QuestionPoolPreview.tsx`

```typescript
interface QuestionPoolPreviewProps {
  courseId: string;
  language: 'en' | 'es';
}
```

- Shows generated question pool after "Generate Quiz" is clicked
- List of questions with: type badge, difficulty badge, question text
- Click to expand: answer options (for MC), rubric (for voice), scenario (for interactive)
- Quality indicators: times_shown, times_correct, miss rate
- "Regenerate" button per question
- "Add Question" manual entry

#### `components/course-builder/quiz/GenerateQuizButton.tsx`

```typescript
interface GenerateQuizButtonProps {
  courseId: string;
  quizConfig: QuizConfig;
  onGenerated: () => void;
  language: 'en' | 'es';
}
```

- Calls `generate-quiz-pool` edge function
- Shows progress ("Generating 30 questions...")
- On complete, dispatches to refresh the question pool preview

### 6.2 Hooks

#### `hooks/use-quiz-pool.ts`

```typescript
function useQuizPool(courseId: string | null) => {
  questions: QuizQuestion[];
  isLoading: boolean;
  error: string | null;
  regenerateQuestion: (questionId: string) => Promise<void>;
  regenerateAll: () => Promise<void>;
  refetch: () => void;
}
```

### 6.3 What This Phase Delivers

Quiz configuration integrated into the Course Builder's right panel (quiz tab). Admins can configure quiz mode, question counts, passing scores, and generate question pools from course content.

**Depends on**: Phase 3 (canvas exists). Needs `quiz_questions` DB table, `generate-quiz-pool` edge function.

---

## Phase 7: Course Player (Staff Learning UI)

**Goal**: Build the staff-facing course browsing, learning, and quiz-taking experience from scratch.

### 7.1 New Pages

#### `pages/CourseHomePage.tsx`

- Course catalog: grid of course cards (filterable by category/status)
- "My Courses" tab (enrolled + in-progress)
- "All Courses" tab (available to enroll)
- Search bar
- Mobile-optimized card grid

#### `pages/CoursePlayerPage.tsx`

- Course overview: title, description, section list with progress
- "Continue Learning" hero button
- Section cards showing: title, element count, completion status, quiz status
- Teacher persona avatar + level indicator

#### `pages/CourseSectionPlayerPage.tsx`

- Full-screen section player
- Renders elements sequentially using read-only renderers
- Progress tracking: marks elements as viewed
- "Next Section" / "Take Quiz" at the bottom
- AI teacher chat available (side panel on desktop, sheet on mobile)

#### `pages/CourseQuizPlayerPage.tsx`

- Quiz experience rebuilt from scratch
- Mode-aware rendering:
  - MC: standard question -> options -> feedback flow
  - Voice: question -> record -> transcribe -> AI evaluate
  - Interactive AI: realtime voice conversation (reuses `use-realtime-webrtc`)
  - Mixed: routes to appropriate renderer per question
- Progress bar
- Results screen with score, competency level, feedback

### 7.2 New Components

#### `components/course-player/CourseCard.tsx`

```typescript
interface CourseCardProps {
  course: CourseListItem;
  language: 'en' | 'es';
  onEnroll?: () => void;
}
```

- Card with icon, title, description, progress bar, estimated time
- Status badge (enrolled / in-progress / completed)
- CTA button: "Start" / "Continue" / "Review"

#### `components/course-player/SectionPlayerCard.tsx`

```typescript
interface SectionPlayerCardProps {
  section: CourseSection;
  progress: SectionProgress | null;
  language: 'en' | 'es';
}
```

- Shows section title, element count, status
- Progress indicator (elements viewed / total)
- Quiz status if applicable

#### `components/course-player/renderers/PlayerContentRenderer.tsx`

Read-only version of `ContentElementRenderer`:
- Renders Markdown body
- No edit controls
- Bilingual toggle

#### `components/course-player/renderers/PlayerFeatureRenderer.tsx`

Read-only version of `FeatureElementRenderer`:
- Full variant styling (color, icon, border)
- No edit controls

#### `components/course-player/renderers/PlayerMediaRenderer.tsx`

Read-only version of `MediaElementRenderer`:
- Image display with caption
- YouTube iframe embed
- Video player for stored clips

#### `components/course-player/TeacherChatPanel.tsx`

```typescript
interface TeacherChatPanelProps {
  courseId: string;
  sectionId: string;
  teacherLevel: TeacherLevel;
  teacherPersonaId: string | null;
  language: 'en' | 'es';
}
```

- Persistent chat with AI teacher
- Teacher persona avatar and name
- Context-aware (knows the current section content)
- Voice input supported
- Saved to `course_conversations` table

#### `components/course-player/quiz/MCQuestionCard.tsx`
#### `components/course-player/quiz/VoiceQuestionCard.tsx`
#### `components/course-player/quiz/InteractiveAISession.tsx`
#### `components/course-player/quiz/QuizResultsCard.tsx`
#### `components/course-player/quiz/QuizProgressBar.tsx`

All rebuilt from scratch to match the new quiz_questions schema.

### 7.3 Hooks

#### `hooks/use-course-catalog.ts`

```typescript
function useCourseCatalog(groupId: string) => {
  courses: CourseListItem[];
  myCourses: CourseListItem[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}
```

#### `hooks/use-course-enrollment.ts`

```typescript
function useCourseEnrollment(courseId: string) => {
  enrollment: CourseEnrollment | null;
  isLoading: boolean;
  enroll: () => Promise<void>;
  isEnrolling: boolean;
}
```

#### `hooks/use-section-player.ts`

```typescript
function useSectionPlayer(sectionId: string, enrollmentId: string) => {
  section: CourseSection | null;
  progress: SectionProgress | null;
  markElementViewed: (elementKey: string) => void;
  completeSection: () => Promise<void>;
  isLoading: boolean;
}
```

#### `hooks/use-course-quiz.ts`

```typescript
function useCourseQuiz(sectionId: string, enrollmentId: string) => {
  startAttempt: () => Promise<QuizAttempt & { questions: QuizQuestion[] }>;
  submitAnswer: (questionId: string, answer: MCAnswer | VoiceAnswer) => Promise<AnswerResult>;
  completeAttempt: () => Promise<QuizResults>;
  currentAttempt: QuizAttempt | null;
  isLoading: boolean;
}
```

#### `hooks/use-teacher-chat.ts`

```typescript
function useTeacherChat(courseId: string, sectionId: string) => {
  messages: ConversationMessage[];
  sendMessage: (text: string) => Promise<void>;
  isLoading: boolean;
}
```

### 7.4 Routes Registered

```
/courses                              → CourseHomePage
/courses/:courseSlug                   → CoursePlayerPage
/courses/:courseSlug/:sectionSlug      → CourseSectionPlayerPage
/courses/:courseSlug/:sectionSlug/quiz → CourseQuizPlayerPage
```

### 7.5 Navigation

- "Training" link re-added to sidebar navigation
- Points to `/courses`

### 7.6 What This Phase Delivers

Complete staff learning experience: browse courses, enroll, learn through AI-guided sections, take quizzes (MC + voice + interactive AI), track progress. Fully rebuilt from scratch with element-based content rendering.

**Depends on**: Phase 3 (element renderers shared between builder and player). Needs all enrollment/progress/quiz DB tables.

---

## Phase 8: Manager Dashboard + Change Tracking

**Goal**: Build the admin dashboard for monitoring team training progress, managing rollouts, and reviewing automatic course rebuilds.

### 8.1 New Pages

#### `pages/admin/ManagerTrainingDashboard.tsx` (REBUILT)

- Overview stats: total courses, active enrollments, completion rate, average score
- Team progress table (filterable by course, role, date range)
- Upcoming deadlines widget
- Rollout management section
- Link to Course Change Log

#### `pages/admin/CourseChangeLogPage.tsx` (NEW)

- Table: Date | Course | Trigger | Elements Rebuilt | Questions Regenerated | Status
- Click to expand: diff view of old vs. new content
- Filter by: course, date range, reviewed/pending
- "Mark as Reviewed" action

### 8.2 New Components

#### `components/admin/training/DashboardStatsCards.tsx`

```typescript
interface DashboardStatsCardsProps {
  stats: {
    totalCourses: number;
    activeEnrollments: number;
    completionRate: number;
    averageScore: number;
  };
  language: 'en' | 'es';
}
```

#### `components/admin/training/TeamProgressTable.tsx`

```typescript
interface TeamProgressTableProps {
  groupId: string;
  courseFilter: string | null;
  language: 'en' | 'es';
}
```

- Columns: Name, Course, Progress %, Score, Status, Last Activity
- Sortable, searchable
- Click row to see individual detail

#### `components/admin/training/RolloutManager.tsx`

```typescript
interface RolloutManagerProps {
  groupId: string;
  language: 'en' | 'es';
}
```

- Active rollouts list
- Create new rollout: pick course, pick audience, set deadline
- Rollout progress tracking

#### `components/admin/training/ContentChangeAlertBanner.tsx`

```typescript
interface ContentChangeAlertBannerProps {
  changes: ContentChangeNotification[];
  onReview: (changeId: string) => void;
  onDismiss: (changeId: string) => void;
  language: 'en' | 'es';
}
```

**CRITICAL**: This is a **full-width alert banner** at the top of the admin interface.
- Persists until dismissed or reviewed
- Shows: course name, what changed, what was rebuilt, how many quiz questions regenerated
- [Review Changes] / [View Course] / [Dismiss] buttons
- Rendered at the layout level (above all admin page content)

#### `components/admin/training/ChangeLogEntry.tsx`

```typescript
interface ChangeLogEntryProps {
  entry: CourseChangeLogEntry;
  language: 'en' | 'es';
  onMarkReviewed: () => void;
}
```

- Expandable card
- Shows source material that changed
- Shows which elements were rebuilt (old vs. new diff)
- Shows quiz questions regenerated count

### 8.3 Hooks

#### `hooks/use-training-dashboard.ts`

```typescript
function useTrainingDashboard(groupId: string) => {
  stats: DashboardStats;
  teamProgress: TeamProgressEntry[];
  activeRollouts: Rollout[];
  isLoading: boolean;
  refetch: () => void;
}
```

#### `hooks/use-course-change-log.ts`

```typescript
function useCourseChangeLog(groupId: string, filters?: ChangeLogFilters) => {
  entries: CourseChangeLogEntry[];
  isLoading: boolean;
  markReviewed: (id: string) => Promise<void>;
  refetch: () => void;
}
```

#### `hooks/use-content-change-notifications.ts`

```typescript
function useContentChangeNotifications(groupId: string) => {
  notifications: ContentChangeNotification[];
  isLoading: boolean;
  dismiss: (id: string) => Promise<void>;
  dismissAll: () => Promise<void>;
}
```

### 8.4 What This Phase Delivers

Admin/manager visibility into training operations: team progress monitoring, rollout management, content change notifications, and the Course Change Log with full audit trail.

**Depends on**: Phase 7 (enrollment data flowing). Needs `rollouts`, `rollout_assignments`, `course_change_log`, `content_change_log` DB tables.

---

## Phase 9: Polish, Mobile, Accessibility

**Goal**: Final pass on responsive design, accessibility, animations, and edge cases.

### 9.1 Mobile Responsiveness

#### Course Builder (Admin)
- **iPad** (768-1024px): Three-column layout preserved, palette collapses to icons-only
- **Phone** (<768px): Three tabs: Canvas | Elements | AI
  - Canvas tab: full-width element cards
  - Elements tab: element palette + section navigator
  - AI tab: full-screen chat panel

#### Course Player (Staff)
- **iPad**: Content renders full-width with teacher chat as slide-over
- **Phone**: Content full-width, teacher chat as bottom sheet
- Quiz: full-screen experience on all sizes

### 9.2 Accessibility

- All interactive elements have proper `aria-label` attributes
- Focus management: element selection via keyboard (Tab/Shift+Tab/Escape)
- Screen reader announcements for: save status, AI generation progress, quiz results
- Color contrast: feature variant colors meet WCAG AA
- Reduced motion: respect `prefers-reduced-motion` for AI progress animations

### 9.3 Animations

- Element add: slide-in from left
- Element remove: fade-out with height collapse
- AI generation: skeleton pulse on individual elements during build
- "Build All" progress: sequential highlight of each element as it's built
- Section navigation: cross-fade between sections

### 9.4 Performance

- Virtualization for courses with 50+ elements per section (unlikely but handle it)
- Debounced Markdown rendering during inline editing
- Lazy-load YouTube iframes (intersection observer)
- Image optimization: thumbnails in canvas, full-res in player

### 9.5 Error Handling

- AI generation failure: per-element error state with retry button
- Network error during save: persistent error banner with manual retry
- Stale data: re-fetch on window focus
- Rate limit: queue AI requests, show user-friendly cooldown message

---

## Full Component Tree (All Phases)

```
src/
├── types/
│   ├── course-builder.ts          (Phase 2 — NEW)
│   └── course-player.ts           (Phase 2 — NEW)
│
├── contexts/
│   └── CourseBuilderContext.tsx     (Phase 2 — NEW)
│
├── lib/
│   └── course-builder/
│       └── builder-utils.ts        (Phase 3 — NEW)
│
├── hooks/
│   ├── use-build-course.ts         (Phase 5 — NEW)
│   ├── use-course-builder-chat.ts  (Phase 5 — NEW)
│   ├── use-course-builder-dnd.ts   (Phase 3 — NEW)
│   ├── use-course-catalog.ts       (Phase 7 — NEW)
│   ├── use-course-change-log.ts    (Phase 8 — NEW)
│   ├── use-course-enrollment.ts    (Phase 7 — NEW)
│   ├── use-course-media-upload.ts  (Phase 5 — NEW)
│   ├── use-course-quiz.ts          (Phase 7 — NEW)
│   ├── use-content-change-notifications.ts (Phase 8 — NEW)
│   ├── use-quiz-pool.ts            (Phase 6 — NEW)
│   ├── use-section-player.ts       (Phase 7 — NEW)
│   ├── use-source-material-search.ts (Phase 4 — NEW)
│   ├── use-teacher-chat.ts         (Phase 7 — NEW)
│   └── use-training-dashboard.ts   (Phase 8 — NEW)
│
├── pages/
│   ├── admin/
│   │   ├── AdminCourseBuilderPage.tsx   (Phase 2 — NEW)
│   │   ├── AdminCourseListPage.tsx      (Phase 2 — NEW)
│   │   ├── CourseChangeLogPage.tsx       (Phase 8 — NEW)
│   │   └── ManagerTrainingDashboard.tsx  (Phase 8 — REBUILT)
│   │
│   ├── CourseHomePage.tsx               (Phase 7 — NEW)
│   ├── CoursePlayerPage.tsx             (Phase 7 — NEW)
│   ├── CourseSectionPlayerPage.tsx      (Phase 7 — NEW)
│   └── CourseQuizPlayerPage.tsx         (Phase 7 — NEW)
│
├── components/
│   ├── course-builder/                  (Phase 3-6)
│   │   ├── CourseBuilderTopBar.tsx
│   │   ├── CourseBuilderCanvas.tsx
│   │   ├── ElementPalette.tsx
│   │   ├── ElementCardWrapper.tsx
│   │   ├── ElementPropertiesPanel.tsx
│   │   ├── SectionNavigator.tsx
│   │   ├── CourseAIBuilderPanel.tsx
│   │   ├── AIProgressOverlay.tsx
│   │   ├── InlineAIPrompt.tsx
│   │   │
│   │   ├── renderers/
│   │   │   ├── ContentElementRenderer.tsx
│   │   │   ├── FeatureElementRenderer.tsx
│   │   │   └── MediaElementRenderer.tsx
│   │   │
│   │   ├── wizards/
│   │   │   ├── CourseWizardDialog.tsx
│   │   │   ├── WizardStepLayout.tsx
│   │   │   ├── MenuRolloutWizard.tsx
│   │   │   ├── SOPReviewWizard.tsx
│   │   │   ├── StepsOfServiceWizard.tsx
│   │   │   ├── LineCookWizard.tsx
│   │   │   ├── CustomCourseWizard.tsx
│   │   │   │
│   │   │   └── shared/
│   │   │       ├── SourceMaterialPicker.tsx
│   │   │       ├── QuizModeSelector.tsx
│   │   │       ├── TeacherLevelSelector.tsx
│   │   │       ├── AssignmentPicker.tsx
│   │   │       └── CreditWarningDialog.tsx
│   │   │
│   │   └── quiz/
│   │       ├── QuizConfigPanel.tsx
│   │       ├── QuestionPoolPreview.tsx
│   │       └── GenerateQuizButton.tsx
│   │
│   ├── course-player/                   (Phase 7)
│   │   ├── CourseCard.tsx
│   │   ├── SectionPlayerCard.tsx
│   │   ├── TeacherChatPanel.tsx
│   │   │
│   │   ├── renderers/
│   │   │   ├── PlayerContentRenderer.tsx
│   │   │   ├── PlayerFeatureRenderer.tsx
│   │   │   └── PlayerMediaRenderer.tsx
│   │   │
│   │   └── quiz/
│   │       ├── MCQuestionCard.tsx
│   │       ├── VoiceQuestionCard.tsx
│   │       ├── InteractiveAISession.tsx
│   │       ├── QuizResultsCard.tsx
│   │       └── QuizProgressBar.tsx
│   │
│   └── admin/
│       └── training/                    (Phase 8)
│           ├── DashboardStatsCards.tsx
│           ├── TeamProgressTable.tsx
│           ├── RolloutManager.tsx
│           ├── ContentChangeAlertBanner.tsx
│           └── ChangeLogEntry.tsx
```

---

## Full Route Table

| Route | Page | Auth | Phase |
|-------|------|------|-------|
| `/admin/courses` | AdminCourseListPage | admin | 2 |
| `/admin/courses/new` | AdminCourseBuilderPage | admin | 2 |
| `/admin/courses/:id/edit` | AdminCourseBuilderPage | admin | 2 |
| `/admin/courses/changelog` | CourseChangeLogPage | admin | 8 |
| `/admin/training` | ManagerTrainingDashboard | manager | 8 |
| `/courses` | CourseHomePage | auth | 7 |
| `/courses/:courseSlug` | CoursePlayerPage | auth | 7 |
| `/courses/:courseSlug/:sectionSlug` | CourseSectionPlayerPage | auth | 7 |
| `/courses/:courseSlug/:sectionSlug/quiz` | CourseQuizPlayerPage | auth | 7 |

---

## Phase Summary

| Phase | Files Added | Files Removed | DB Dependency | Edge Fn Dependency |
|-------|-------------|---------------|---------------|-------------------|
| **1a** | ~5 HTML mockups | 0 | None | None |
| **1b** | 0 | ~52 files | None | None |
| **2** | ~5 (types, context, page shell) | 1 (types/training.ts) | None | None |
| **3** | ~12 (palette, canvas, renderers, wrappers) | 0 | courses, course_sections | None |
| **4** | ~12 (wizards, shared pickers) | 0 | Source tables (existing) | None |
| **5** | ~5 (AI panel, hooks, overlay) | 0 | Same as Phase 3 | build-course, build-course-element, generate-course-image |
| **6** | ~4 (quiz config panel, pool preview) | 0 | quiz_questions | generate-quiz-pool |
| **7** | ~16 (player pages, renderers, quiz) | 0 | All enrollment/progress tables | None (reuses existing AI) |
| **8** | ~8 (dashboard, change log, banner) | 0 | rollouts, course_change_log, content_change_log | None |
| **9** | ~0 (modifications to existing) | 0 | None | None |
| **Total** | ~67 new files | ~52 removed | | |

---

## Build Order Recommendation

1. **Start immediately** (no deps): Phase 1a (mockup) + Phase 1b (teardown) in parallel
2. **After teardown**: Phase 2 (types + context + shell) -- pure frontend
3. **Needs first DB migration**: Phase 3 (elements) -- needs `courses` + `course_sections` tables
4. **Can overlap with Phase 3**: Phase 4 (wizards) -- mostly UI, uses existing search functions
5. **Needs edge functions**: Phase 5 (AI) -- needs `build-course` + `build-course-element` deployed
6. **Needs quiz tables**: Phase 6 (quiz builder) -- needs `quiz_questions` table + `generate-quiz-pool` function
7. **Needs enrollment tables**: Phase 7 (player) -- needs all enrollment/progress/conversation tables
8. **After player works**: Phase 8 (dashboard) -- needs enrollment data flowing to show stats
9. **Last**: Phase 9 (polish) -- refinements across everything
