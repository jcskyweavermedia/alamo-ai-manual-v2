# Training System — Master Implementation Plan

> Based on the approved [Course System Overview](./course-system-overview.md) and [UX Mockups](./ux-mockups.md)

---

## How This Plan Is Organized

**4 Phases, 16 Steps.** Each step is independently committable and testable.
Phases build on each other — Phase 2 requires Phase 1, etc.

| Phase | Focus | Steps | New Files | DB Tables |
|-------|-------|-------|-----------|-----------|
| **1: Foundation** | Database + navigation + static UI | 1.1–1.5 | ~18 | 12 |
| **2: Learning** | AI teacher + persistent chat | 2.1–2.4 | ~12 | 0 (uses Phase 1 tables) |
| **3: Assessment** | Quizzes + evaluation + scoring | 3.1–3.4 | ~10 | 0 (uses Phase 1 tables) |
| **4: Management** | Manager dashboard + rollouts | 4.1–4.3 | ~8 | 0 (uses Phase 1 tables) |

---

## Phase 1: Foundation

> Database schema, course seed data, basic pages, navigation wiring.
> **Goal**: Staff can browse courses and sections, see what they need to learn.

---

### Step 1.1 — Database: Create 12 Training Tables

**Migration**: `supabase/migrations/YYYYMMDD_create_training_tables.sql`

#### Table Definitions

```sql
-- 1. courses
CREATE TABLE public.courses (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id),
  slug TEXT NOT NULL,
  title_en TEXT NOT NULL,
  title_es TEXT,
  description_en TEXT,
  description_es TEXT,
  icon TEXT,                          -- Lucide icon name
  sort_order INT NOT NULL DEFAULT 0,
  estimated_minutes INT NOT NULL DEFAULT 20,
  passing_score INT NOT NULL DEFAULT 70,
  status TEXT NOT NULL DEFAULT 'published'
    CHECK (status IN ('published','draft','archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(group_id, slug)
);

-- 2. course_sections
CREATE TABLE public.course_sections (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.groups(id),
  slug TEXT NOT NULL,
  title_en TEXT NOT NULL,
  title_es TEXT,
  description_en TEXT,
  description_es TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  -- Content source: which existing table/row feeds this section
  content_source TEXT NOT NULL
    CHECK (content_source IN (
      'manual_sections','foh_plate_specs','plate_specs',
      'prep_recipes','wines','cocktails','beer_liquor_list',
      'custom'
    )),
  content_ids UUID[] NOT NULL DEFAULT '{}',  -- IDs from source table
  content_filter JSONB,                       -- Optional filter (e.g. {"plate_type":"entree"})
  section_type TEXT NOT NULL DEFAULT 'learn'
    CHECK (section_type IN ('learn','practice','overview')),
  estimated_minutes INT NOT NULL DEFAULT 5,
  status TEXT NOT NULL DEFAULT 'published'
    CHECK (status IN ('published','draft')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(course_id, slug)
);

-- 3. course_enrollments
CREATE TABLE public.course_enrollments (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  course_id UUID NOT NULL REFERENCES public.courses(id),
  group_id UUID NOT NULL REFERENCES public.groups(id),
  status TEXT NOT NULL DEFAULT 'enrolled'
    CHECK (status IN ('enrolled','in_progress','completed')),
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  overall_score NUMERIC(5,2),          -- Weighted average of section scores
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, course_id)
);

-- 4. section_progress
CREATE TABLE public.section_progress (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  section_id UUID NOT NULL REFERENCES public.course_sections(id),
  course_id UUID NOT NULL REFERENCES public.courses(id),
  group_id UUID NOT NULL REFERENCES public.groups(id),
  status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started','in_progress','completed')),
  topics_covered INT NOT NULL DEFAULT 0,
  topics_total INT NOT NULL DEFAULT 0,
  quiz_score NUMERIC(5,2),
  quiz_passed BOOLEAN DEFAULT false,
  time_spent_seconds INT NOT NULL DEFAULT 0,
  content_hash_at_completion TEXT,      -- MD5 of source content when completed
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, section_id)
);

-- 5. course_conversations
CREATE TABLE public.course_conversations (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  section_id UUID NOT NULL REFERENCES public.course_sections(id),
  group_id UUID NOT NULL REFERENCES public.groups(id),
  messages JSONB NOT NULL DEFAULT '[]',  -- Array of {role, content, timestamp}
  session_summary TEXT,                   -- AI-generated summary at session end
  topics_discussed TEXT[] DEFAULT '{}',   -- Topic tracking for progress strip
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '90 days'),
  is_flagged BOOLEAN DEFAULT false,       -- Manager-flagged = keep indefinitely
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- One active conversation per user per section; new session = new row
CREATE INDEX idx_conversations_user_section
  ON public.course_conversations(user_id, section_id);

-- 6. quiz_questions
CREATE TABLE public.quiz_questions (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES public.course_sections(id),
  group_id UUID NOT NULL REFERENCES public.groups(id),
  question_type TEXT NOT NULL
    CHECK (question_type IN ('multiple_choice','voice')),
  question_en TEXT NOT NULL,
  question_es TEXT,
  -- MC fields (null for voice)
  options JSONB,                         -- [{label, text_en, text_es, is_correct}]
  explanation_en TEXT,
  explanation_es TEXT,
  -- Voice fields (null for MC)
  rubric JSONB,                          -- {criteria: [{name, weight, description}]}
  -- Metadata
  source TEXT NOT NULL DEFAULT 'ai'
    CHECK (source IN ('ai','manual')),
  difficulty TEXT DEFAULT 'medium'
    CHECK (difficulty IN ('easy','medium','hard')),
  is_active BOOLEAN DEFAULT true,
  times_shown INT DEFAULT 0,
  times_correct INT DEFAULT 0,           -- For auto-flagging low-performing questions
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. quiz_attempts
CREATE TABLE public.quiz_attempts (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  section_id UUID NOT NULL REFERENCES public.course_sections(id),
  group_id UUID NOT NULL REFERENCES public.groups(id),
  attempt_number INT NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress','completed','abandoned')),
  score NUMERIC(5,2),
  passed BOOLEAN,
  total_questions INT,
  correct_answers INT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. quiz_attempt_answers
CREATE TABLE public.quiz_attempt_answers (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES public.quiz_attempts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.quiz_questions(id),
  -- MC answer
  selected_option TEXT,                   -- 'A','B','C','D'
  is_correct BOOLEAN,
  -- Voice answer
  transcription TEXT,                     -- Whisper transcript (90-day retention)
  voice_score NUMERIC(5,2),
  voice_feedback_en TEXT,                 -- AI evaluation of voice answer
  voice_feedback_es TEXT,
  transcription_expires_at TIMESTAMPTZ,   -- 90-day auto-expiry
  -- Timing
  time_spent_seconds INT,
  answered_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. evaluations
CREATE TABLE public.evaluations (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  section_id UUID REFERENCES public.course_sections(id),
  course_id UUID REFERENCES public.courses(id),
  group_id UUID NOT NULL REFERENCES public.groups(id),
  eval_type TEXT NOT NULL
    CHECK (eval_type IN ('session','quiz','course_final')),
  -- Dual feedback
  student_feedback JSONB NOT NULL,        -- {summary, strengths[], next_steps[]}
  manager_feedback JSONB NOT NULL,        -- {score, competency, strengths[], gaps[], recommendation}
  manager_notes TEXT,                      -- Private notes (never shown to student)
  competency_level TEXT
    CHECK (competency_level IN ('novice','competent','proficient','expert')),
  score NUMERIC(5,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. rollouts
CREATE TABLE public.rollouts (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id),
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  title TEXT NOT NULL,
  description TEXT,
  -- Content selection
  course_ids UUID[] NOT NULL DEFAULT '{}',
  section_ids UUID[] DEFAULT '{}',        -- Empty = all sections in selected courses
  -- Timing
  deadline TIMESTAMPTZ,                    -- "Complete by" date
  expires_at TIMESTAMPTZ,                  -- Auto-archive date
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('draft','active','completed','expired','archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. rollout_assignments
CREATE TABLE public.rollout_assignments (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  rollout_id UUID NOT NULL REFERENCES public.rollouts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  group_id UUID NOT NULL REFERENCES public.groups(id),
  status TEXT NOT NULL DEFAULT 'assigned'
    CHECK (status IN ('assigned','in_progress','completed','overdue')),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  UNIQUE(rollout_id, user_id)
);

-- 12. content_change_log
CREATE TABLE public.content_change_log (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id),
  source_table TEXT NOT NULL,
  source_id UUID NOT NULL,
  content_hash TEXT NOT NULL,              -- MD5 of content at scan time
  previous_hash TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  acknowledged_by UUID REFERENCES public.profiles(id),
  acknowledged_at TIMESTAMPTZ
);
```

#### RLS Policies (4 per table = 48 policies)

Pattern (same as existing product tables):

```sql
-- SELECT: authenticated users can read their group's data
-- INSERT: authenticated users can insert for their group
-- UPDATE: authenticated users can update their group's data (managers+ for admin tables)
-- DELETE: admin only on management tables
```

Key RLS rules:
- `course_conversations`: Users can only see **their own** conversations
- `evaluations`: Users see only their own student_feedback; managers see all in their group
- `manager_notes` on evaluations: Only visible to manager/admin role
- `rollouts` / `rollout_assignments`: Managers+ can create; staff can read their own assignments

#### Indexes

```sql
-- Lookup indexes
CREATE INDEX idx_course_sections_course ON course_sections(course_id);
CREATE INDEX idx_enrollments_user ON course_enrollments(user_id);
CREATE INDEX idx_enrollments_course ON course_enrollments(course_id);
CREATE INDEX idx_section_progress_user ON section_progress(user_id);
CREATE INDEX idx_section_progress_section ON section_progress(section_id);
CREATE INDEX idx_quiz_questions_section ON quiz_questions(section_id);
CREATE INDEX idx_quiz_attempts_user_section ON quiz_attempts(user_id, section_id);
CREATE INDEX idx_evaluations_user ON evaluations(user_id);
CREATE INDEX idx_rollout_assignments_user ON rollout_assignments(user_id);
CREATE INDEX idx_rollout_assignments_rollout ON rollout_assignments(rollout_id);

-- Retention cleanup
CREATE INDEX idx_conversations_expires ON course_conversations(expires_at)
  WHERE expires_at IS NOT NULL AND is_flagged = false;
CREATE INDEX idx_attempt_answers_transcription_expires
  ON quiz_attempt_answers(transcription_expires_at)
  WHERE transcription_expires_at IS NOT NULL;
```

#### Deliverables
- [ ] Migration file applied via `npx supabase db push`
- [ ] All 12 tables visible in Supabase dashboard
- [ ] RLS policies verified (staff can't see other staff's conversations/evaluations)
- [ ] Security advisors clean (no missing RLS, search_path set on any triggers)

---

### Step 1.2 — Database: Seed Server 101 Courses & Sections

**Migration**: `supabase/migrations/YYYYMMDD_seed_training_courses.sql`

Seeds the 7 courses and ~35 sections that map to existing content.

#### Course Seed Data

```sql
-- Get the Alamo Prime group_id
WITH g AS (SELECT id FROM groups WHERE slug = 'alamo-prime')

INSERT INTO courses (group_id, slug, title_en, title_es, icon, sort_order, estimated_minutes, passing_score) VALUES
(g.id, 'culture-standards',     'Culture & Standards',       'Cultura y Estándares',       'Landmark',      1, 20, 70),
(g.id, 'entrees-steaks',        'Entrees & Steaks',          'Platos Fuertes y Carnes',    'Beef',          2, 30, 70),
(g.id, 'appetizers-sides',      'Appetizers & Sides',        'Aperitivos y Acompañamientos','UtensilsCrossed',3, 20, 70),
(g.id, 'wine-program',          'Wine Program',              'Programa de Vinos',          'Wine',          4, 25, 70),
(g.id, 'cocktails-bar',         'Cocktails & Bar',           'Cocteles y Bar',             'Martini',       5, 20, 70),
(g.id, 'beer-liquor',           'Beer & Liquor',             'Cerveza y Licores',          'Beer',          6, 15, 70),
(g.id, 'desserts-after-dinner', 'Desserts & After-Dinner',   'Postres y Sobremesa',        'CakeSlice',     7, 10, 70);
```

#### Section Mapping Strategy

Each section points to existing content via `content_source` + `content_ids`:

| Course | Section | content_source | content_ids | section_type |
|--------|---------|---------------|-------------|-------------|
| Culture & Standards | Welcome & Philosophy | manual_sections | [welcome-philosophy UUID] | learn |
| Culture & Standards | Service Standards | manual_sections | [service-standards UUID] | learn |
| Culture & Standards | Guest Experience | manual_sections | [guest-experience UUID] | learn |
| Culture & Standards | Team Culture | manual_sections | [team-culture UUID] | learn |
| Culture & Standards | Describe Our Vision | custom | [] | practice |
| Entrees & Steaks | Entree Overview | manual_sections | [entrees-overview UUID] | overview |
| Entrees & Steaks | 12oz Ribeye | foh_plate_specs | [ribeye UUID] | learn |
| Entrees & Steaks | NY Strip | foh_plate_specs | [ny-strip UUID] | learn |
| Entrees & Steaks | Filet Mignon | foh_plate_specs | [filet UUID] | learn |
| Entrees & Steaks | Bone-In Cowboy | foh_plate_specs | [cowboy UUID] | learn |
| Entrees & Steaks | Mods & Allergens | custom | [] | learn |
| Entrees & Steaks | Describe to Guest | custom | [] | practice |
| Wine Program | Wine Intro | manual_sections | [wine-intro UUID] | overview |
| Wine Program | Cabernet Sauvignon | wines | [cabernet UUID] | learn |
| Wine Program | Merlot | wines | [merlot UUID] | learn |
| Wine Program | Pinot Noir | wines | [pinot UUID] | learn |
| Wine Program | Chardonnay | wines | [chardonnay UUID] | learn |
| Wine Program | Sauvignon Blanc | wines | [sauv-blanc UUID] | learn |
| Cocktails & Bar | Old Fashioned | cocktails | [old-fashioned UUID] | learn |
| Cocktails & Bar | Margarita | cocktails | [margarita UUID] | learn |
| ... | ... | ... | ... | ... |

The migration will use subqueries to look up existing UUIDs by slug:

```sql
INSERT INTO course_sections (course_id, group_id, slug, title_en, content_source, content_ids, sort_order)
SELECT
  c.id, c.group_id, 'ribeye-12oz', '12oz Ribeye',
  'foh_plate_specs',
  ARRAY[(SELECT id FROM foh_plate_specs WHERE slug = 'ribeye-12oz')],
  2
FROM courses c WHERE c.slug = 'entrees-steaks';
```

#### Deliverables
- [ ] 7 courses seeded
- [ ] ~35 sections seeded with correct content_source links
- [ ] All content_ids resolve to existing rows
- [ ] Verify via: `SELECT c.title_en, count(cs.*) FROM courses c JOIN course_sections cs ON cs.course_id = c.id GROUP BY c.title_en`

---

### Step 1.3 — TypeScript Types + Data Hooks

**New files:**

| File | Purpose |
|------|---------|
| `src/types/training.ts` | All training-related TypeScript types |
| `src/hooks/use-courses.ts` | Fetch courses with enrollment status for current user |
| `src/hooks/use-course-sections.ts` | Fetch sections for a course with progress |
| `src/hooks/use-section-progress.ts` | Read/update per-section progress |
| `src/hooks/use-enrollment.ts` | Enroll/unenroll, track enrollment status |

#### Types (`src/types/training.ts`)

```typescript
// -- Course --
export interface Course {
  id: string;
  groupId: string;
  slug: string;
  titleEn: string;
  titleEs: string | null;
  descriptionEn: string | null;
  descriptionEs: string | null;
  icon: string | null;
  sortOrder: number;
  estimatedMinutes: number;
  passingScore: number;
  status: 'published' | 'draft' | 'archived';
}

export interface CourseWithProgress extends Course {
  enrollment: CourseEnrollment | null;
  sectionsTotal: number;
  sectionsCompleted: number;
  progressPercent: number;
}

// -- Course Section --
export type ContentSource =
  | 'manual_sections' | 'foh_plate_specs' | 'plate_specs'
  | 'prep_recipes' | 'wines' | 'cocktails' | 'beer_liquor_list'
  | 'custom';

export type SectionType = 'learn' | 'practice' | 'overview';

export interface CourseSection {
  id: string;
  courseId: string;
  slug: string;
  titleEn: string;
  titleEs: string | null;
  descriptionEn: string | null;
  descriptionEs: string | null;
  sortOrder: number;
  contentSource: ContentSource;
  contentIds: string[];
  contentFilter: Record<string, unknown> | null;
  sectionType: SectionType;
  estimatedMinutes: number;
}

export interface SectionWithProgress extends CourseSection {
  progress: SectionProgress | null;
}

// -- Enrollment --
export type EnrollmentStatus = 'enrolled' | 'in_progress' | 'completed';

export interface CourseEnrollment {
  id: string;
  userId: string;
  courseId: string;
  status: EnrollmentStatus;
  enrolledAt: string;
  startedAt: string | null;
  completedAt: string | null;
  overallScore: number | null;
}

// -- Section Progress --
export type ProgressStatus = 'not_started' | 'in_progress' | 'completed';

export interface SectionProgress {
  id: string;
  userId: string;
  sectionId: string;
  status: ProgressStatus;
  topicsCovered: number;
  topicsTotal: number;
  quizScore: number | null;
  quizPassed: boolean;
  timeSpentSeconds: number;
  startedAt: string | null;
  completedAt: string | null;
}

// -- Conversation --
export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface CourseConversation {
  id: string;
  userId: string;
  sectionId: string;
  messages: ConversationMessage[];
  sessionSummary: string | null;
  topicsDiscussed: string[];
  startedAt: string;
  lastActiveAt: string;
}

// -- Quiz --
export type QuestionType = 'multiple_choice' | 'voice';

export interface QuizOption {
  label: string;       // 'A','B','C','D'
  textEn: string;
  textEs: string | null;
  isCorrect: boolean;
}

export interface QuizQuestion {
  id: string;
  sectionId: string;
  questionType: QuestionType;
  questionEn: string;
  questionEs: string | null;
  options: QuizOption[] | null;
  explanationEn: string | null;
  explanationEs: string | null;
  rubric: Record<string, unknown> | null;
  source: 'ai' | 'manual';
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface QuizAttempt {
  id: string;
  userId: string;
  sectionId: string;
  attemptNumber: number;
  status: 'in_progress' | 'completed' | 'abandoned';
  score: number | null;
  passed: boolean | null;
  totalQuestions: number | null;
  correctAnswers: number | null;
  startedAt: string;
  completedAt: string | null;
}

export interface QuizAttemptAnswer {
  id: string;
  attemptId: string;
  questionId: string;
  selectedOption: string | null;
  isCorrect: boolean | null;
  transcription: string | null;
  voiceScore: number | null;
  voiceFeedbackEn: string | null;
  voiceFeedbackEs: string | null;
  timeSpentSeconds: number | null;
}

// -- Evaluation --
export type CompetencyLevel = 'novice' | 'competent' | 'proficient' | 'expert';

export interface StudentFeedback {
  summary: string;
  strengths: string[];
  nextSteps: string[];
}

export interface ManagerFeedback {
  score: number;
  competency: CompetencyLevel;
  strengths: string[];
  gaps: string[];
  recommendation: string;
}

export interface Evaluation {
  id: string;
  userId: string;
  sectionId: string | null;
  courseId: string | null;
  evalType: 'session' | 'quiz' | 'course_final';
  studentFeedback: StudentFeedback;
  managerFeedback: ManagerFeedback;
  managerNotes: string | null;
  competencyLevel: CompetencyLevel | null;
  score: number | null;
  createdAt: string;
}

// -- Rollout --
export interface Rollout {
  id: string;
  groupId: string;
  createdBy: string;
  title: string;
  description: string | null;
  courseIds: string[];
  sectionIds: string[];
  deadline: string | null;
  expiresAt: string | null;
  status: 'draft' | 'active' | 'completed' | 'expired' | 'archived';
}

export interface RolloutAssignment {
  id: string;
  rolloutId: string;
  userId: string;
  status: 'assigned' | 'in_progress' | 'completed' | 'overdue';
  assignedAt: string;
  completedAt: string | null;
}
```

#### Hook: `use-courses.ts`

```typescript
// Fetches all published courses for the user's group
// Joins with course_enrollments and section_progress to compute progressPercent
// Returns: { courses: CourseWithProgress[], isLoading, error, enroll(courseId) }
```

#### Hook: `use-course-sections.ts`

```typescript
// Fetches all sections for a given courseSlug
// Joins with section_progress for current user
// Returns: { course, sections: SectionWithProgress[], isLoading, error }
```

#### Hook: `use-section-progress.ts`

```typescript
// CRUD for section_progress
// Returns: { progress, updateTopics(covered, total), markComplete(), isLoading }
```

#### Hook: `use-enrollment.ts`

```typescript
// Handles enrollment lifecycle
// Returns: { enrollment, enroll(), startCourse(), isLoading }
```

#### Deliverables
- [ ] `src/types/training.ts` with all interfaces
- [ ] 4 hooks with Supabase queries
- [ ] 0 TypeScript errors
- [ ] Hooks tested manually via console / simple test component

---

### Step 1.4 — Pages: Training Home + Course Detail

**New files:**

| File | Purpose |
|------|---------|
| `src/pages/TrainingHome.tsx` | Course listing grid (Screen 1 from UX mockups) |
| `src/pages/CourseDetail.tsx` | Section list within a course (Screen 2) |
| `src/components/training/CourseCard.tsx` | Card with progress ring + status badge |
| `src/components/training/ProgressRing.tsx` | Circular SVG progress indicator |
| `src/components/training/SectionListItem.tsx` | Section row with status icon |

**Modified files:**

| File | Change |
|------|--------|
| `src/lib/constants.ts` | Add Training nav item to STAFF_NAV_ITEMS and ADMIN_NAV_ITEMS |
| `src/App.tsx` | Add `/training` and `/training/:courseSlug` routes |

#### `constants.ts` Changes

```typescript
// Add to STAFF_NAV_ITEMS after "Steps of Service" (position 8):
{ path: '/training', label: 'Training', icon: 'GraduationCap' },

// Add to ADMIN_NAV_ITEMS in same position
```

#### `App.tsx` Changes

```typescript
// Add inside ProtectedRoute block:
<Route path="/training" element={<ProtectedRoute><TrainingHome /></ProtectedRoute>} />
<Route path="/training/:courseSlug" element={<ProtectedRoute><CourseDetail /></ProtectedRoute>} />
```

#### Component: `ProgressRing`

```
Props: { percent: number, size?: number, strokeWidth?: number, className?: string }
- SVG circle with animated stroke-dashoffset
- Green when >= passingScore, amber when in progress, gray when 0
- Number displayed in center
```

#### Component: `CourseCard`

```
Props: { course: CourseWithProgress, language: 'en'|'es', onClick: () => void }
- Shows icon, title, progress ring
- Section count + estimated time
- Status badge: "Not Started" | "In Progress" | "Completed"
- Rollout deadline badge (amber countdown) if applicable
- Completed state: green border + checkmark overlay
```

#### Page: `TrainingHome`

```
- Uses AppShell with standard layout
- Header: "Training" title + language toggle
- useCourses() hook for data
- Grid: 3-col iPad / 2-col phone (CSS grid with responsive breakpoints)
- Auto-enroll on first visit (or enroll on card tap)
- Empty state if no courses published
```

#### Page: `CourseDetail`

```
Props: courseSlug from URL params
- Uses AppShell with back arrow → /training
- Header: course title + language toggle
- useCourseSections(courseSlug) hook
- Top card: ProgressRing (large) + "X of Y sections complete" + [Challenge Test]
- Section grid: 2-col iPad / 1-col phone
- Each section: SectionListItem with ✅/🔵/○ status
- Bottom card: Quiz info + [Start Quiz] button (disabled until all sections done, unless challenge test)
```

#### Deliverables
- [ ] Training nav item appears in sidebar
- [ ] `/training` shows course cards with 0% progress
- [ ] Tapping a card navigates to `/training/:courseSlug`
- [ ] Course detail shows all sections with correct content source labels
- [ ] iPad layout: 3-col courses, 2-col sections
- [ ] Phone layout: 2-col courses, 1-col sections
- [ ] 0 TypeScript errors

---

### Step 1.5 — Voice Consent Dialog

**New file:**

| File | Purpose |
|------|---------|
| `src/components/training/VoiceConsentDialog.tsx` | One-time consent for voice transcription storage |

**Database change (add column to profiles):**

```sql
ALTER TABLE public.profiles
  ADD COLUMN voice_consent_at TIMESTAMPTZ,
  ADD COLUMN voice_consent_version INT DEFAULT 0;
```

#### Component: `VoiceConsentDialog`

```
- Triggered before first voice interaction in training
- Explains: voice will be transcribed, stored 90 days, never raw audio
- Text mode always available as alternative
- [I Consent] → updates profile.voice_consent_at + version
- [Use Text Only] → dismisses, no voice features shown
- Consent is per-user, persisted, timestamped
```

#### Deliverables
- [ ] Dialog appears on first voice action if no consent
- [ ] Consent stored in profiles table
- [ ] Voice features hidden if consent not given
- [ ] Text mode always accessible regardless

---

## Phase 2: Learning

> AI teacher panel, persistent conversations, content viewer integration.
> **Goal**: Staff can have AI-guided learning sessions alongside existing content viewers.

---

### Step 2.1 — TrainingChatPanel Component

**New files:**

| File | Purpose |
|------|---------|
| `src/components/training/TrainingChatPanel.tsx` | Main AI teacher panel (~300 lines) |
| `src/components/training/ChatBubble.tsx` | Styled message bubble (AI left, user right) |
| `src/components/training/SuggestedReplyChips.tsx` | Tappable quick-response chips |
| `src/components/training/ProgressStrip.tsx` | Topic coverage bar |
| `src/hooks/use-training-chat.ts` | Chat state + Supabase persistence + AI calls |

#### Component: `TrainingChatPanel`

Structure (from UX mockups):
```
┌─────────────────────────────┐
│ 🎓 AI Teacher               │  ← header
│ Course · Section            │  ← context label
├─────────────────────────────┤
│ (scrollable message area)   │
│  ChatBubble (AI, left)      │
│  ChatBubble (user, right)   │
│  SuggestedReplyChips        │
├─────────────────────────────┤
│ ProgressStrip (topics)      │
├─────────────────────────────┤
│ [🎤] Type here...       [→] │  ← reuses VoiceChatInput
└─────────────────────────────┘
```

Props:
```typescript
interface TrainingChatPanelProps {
  courseSlug: string;
  sectionSlug: string;
  section: CourseSection;
  contentContext: string;         // Serialized content from the source table
  language: 'en' | 'es';
  onTopicsUpdate: (covered: number, total: number) => void;
  onQuizReady: () => void;        // When AI suggests taking the quiz
  className?: string;
}
```

#### Hook: `use-training-chat.ts`

```typescript
// Core state management for training conversations
// Returns:
// {
//   messages: ConversationMessage[],
//   isLoading: boolean,
//   sendMessage: (text: string) => Promise<void>,
//   suggestedReplies: string[],
//   topicsCovered: number,
//   topicsTotal: number,
//   sessionSummary: string | null,
//   previousSessions: CourseConversation[],  // For "show previous" UI
//   resumeSession: () => void,
//   startNewSession: () => void,
// }

// Behavior:
// 1. On mount: load latest conversation for this user+section from Supabase
// 2. If previous conversation exists: show resume UI
// 3. On sendMessage: append to messages, call /ask edge function with training context
// 4. AI response includes: reply text + suggested_replies[] + topics_update
// 5. After each message pair: save to course_conversations table
// 6. On unmount / navigation: generate session summary (edge function call)
```

#### Component: `SuggestedReplyChips`

```typescript
interface SuggestedReplyChipsProps {
  chips: string[];
  onSelect: (chip: string) => void;
  disabled?: boolean;
}
// Renders a flex-wrap row of rounded chip buttons
// Chips come from the AI response (dynamic per context)
// Fixed chips added contextually:
//   After teaching: [Tell me more] [Quiz me on this] [Next topic]
//   After question: [I'm not sure] [Give me a hint]
//   After incorrect: [Explain again] [Show me the answer]
//   All topics done: [Take the quiz] [Review topics] [Practice pitch 🎤]
//   Session resume: [Continue where I left off] [Start over] [Take quiz]
```

#### Component: `ProgressStrip`

```typescript
interface ProgressStripProps {
  covered: number;
  total: number;
  className?: string;
}
// Thin horizontal bar showing topic coverage
// Green filled portion, gray remainder
// Label: "3/5 topics"
```

#### Deliverables
- [ ] TrainingChatPanel renders with header, message area, input
- [ ] Messages persist to `course_conversations` table
- [ ] Session resume shows previous messages collapsed
- [ ] Suggested reply chips appear after AI messages
- [ ] Progress strip updates as topics are covered
- [ ] Voice input works via reused VoiceChatInput
- [ ] 0 TypeScript errors

---

### Step 2.2 — Learning Session Page

**New files:**

| File | Purpose |
|------|---------|
| `src/pages/LearningSession.tsx` | Split-view page (Screen 3 from mockups) |
| `src/hooks/use-learning-session.ts` | Orchestrates content loading + viewer + chat state |
| `src/components/training/ContentPanel.tsx` | Renders the correct existing viewer based on content_source |

**Modified files:**

| File | Change |
|------|--------|
| `src/App.tsx` | Add `/training/:courseSlug/:sectionSlug` route |

#### Page: `LearningSession`

Layout (iPad — primary):
```
┌────┬──────────────────────────────────┬───────────────────────────┐
│ SB │ ← Course Title      [<] [3] [>] │                     EN|ES │
│    ├──────────────────────────────────┼───────────────────────────┤
│    │                                  │                           │
│    │  ContentPanel (55%)              │  TrainingChatPanel (45%)  │
│    │  (existing card view OR          │                           │
│    │   manual section content)        │                           │
│    │                                  │                           │
│    │  ── Progress Strip ──           │                           │
│    │                                  │                           │
└────┴──────────────────────────────────┴───────────────────────────┘
```

Layout (Phone):
```
┌─────────────────────────────────┐
│ ← Section Title        [<] [>] │
├─────────────────────────────────┤
│  [📖 Content]  [🎓 Teacher]    │  ← tab toggle
├─────────────────────────────────┤
│  (active tab content)           │
└─────────────────────────────────┘
```

```typescript
// Uses AppShell with:
//   - aiPanel={<TrainingChatPanel />} for desktop/iPad
//   - Phone: custom tabbed layout (no aiPanel prop)
//   - itemNav for [<] [>] between section items
//   - Back arrow → /training/:courseSlug
```

#### Component: `ContentPanel`

```typescript
interface ContentPanelProps {
  section: CourseSection;
  contentData: any;          // Typed per content_source
  language: 'en' | 'es';
  itemNav?: ItemNav;         // prev/next within section items
}

// Renders the correct EXISTING viewer based on section.contentSource:
//   'foh_plate_specs' → <DishCardView dish={contentData} />
//   'wines'           → <WineCardView wine={contentData} />
//   'cocktails'       → <CocktailCardView cocktail={contentData} />
//   'beer_liquor_list'→ <BeerLiquorCardView item={contentData} />
//   'prep_recipes'    → <RecipeCardView recipe={contentData} />
//   'plate_specs'     → <RecipeCardView recipe={contentData} />
//   'manual_sections' → <ManualContent section={contentData} />
//   'custom'          → AI teacher only (no content panel)
```

#### Hook: `use-learning-session.ts`

```typescript
// Orchestrates:
// 1. Fetch course + section by slugs
// 2. Fetch content from the source table using content_ids
// 3. If multiple content_ids: support prev/next (itemNav)
// 4. Serialize content into text for AI context
// 5. Track section progress (topics covered)
// 6. Handle enrollment auto-start
//
// Returns: {
//   course, section, contentData, contentItems,
//   currentItemIndex, goToItem, hasPrev, hasNext,
//   progress, isLoading, error
// }
```

#### Deliverables
- [ ] Split-view renders on iPad (55/45)
- [ ] Tabbed view on phone
- [ ] Existing card views render correctly inside ContentPanel
- [ ] Prev/next cycles through items (e.g., Ribeye → Strip → Filet)
- [ ] AI teacher conversation persists across navigation
- [ ] Route: `/training/entrees-steaks/ribeye-12oz` works
- [ ] 0 TypeScript errors

---

### Step 2.3 — AI Teacher Edge Function

**Modified file:** `supabase/functions/ask/index.ts`

**New AI prompt migration:** `supabase/migrations/YYYYMMDD_training_ai_prompts.sql`

#### Changes to `/ask` Edge Function

Add a new domain: `training`

```typescript
// New request fields:
{
  domain: 'training',
  section_id: string,          // course_section ID
  content_context: string,     // Serialized content from source table
  conversation_history: ConversationMessage[],
  session_summary?: string,    // Previous session summary if resuming
  topics_covered: string[],
  topics_total: string[],
  language: 'en' | 'es'
}

// New response fields:
{
  reply: string,
  suggested_replies: string[],
  topics_update: { covered: string[], total: string[] },
  should_suggest_quiz: boolean
}
```

#### AI Teacher System Prompt (stored in `ai_prompts` table)

```
slug: 'training-teacher'
category: 'system'
domain: 'training'

prompt_en: |
  You are an AI training teacher for Alamo Prime steakhouse.
  Your role is to help restaurant staff learn about menu items,
  procedures, and service standards through conversation.

  TEACHING METHOD:
  - Lead the conversation using the Socratic method
  - Ask probing questions to check understanding
  - Build on what the student already knows
  - Be encouraging but honest about gaps
  - Never invent information — only teach from the provided content

  CONTENT CONTEXT:
  {content_context}

  STUDENT HISTORY:
  {session_summary}
  Topics covered so far: {topics_covered}

  RULES:
  1. Respond in the same language the student uses
  2. Keep responses concise (2-4 sentences)
  3. End each response with either a question or a suggested next step
  4. Track which topics you've covered
  5. After covering all topics, suggest taking the quiz
  6. Include suggested_replies in your response metadata
  7. Never contradict information in the content context
  8. For allergen questions, always reference the exact allergen list
```

#### Deliverables
- [ ] `/ask` handles `domain: 'training'` requests
- [ ] AI responds in Socratic teaching style
- [ ] AI tracks topics and suggests quiz when done
- [ ] `suggested_replies` included in response
- [ ] Bilingual: responds in user's language
- [ ] Grounded: only references provided content (no hallucination)

---

### Step 2.4 — Voice Integration for Training

**Modified file:** `supabase/functions/realtime-session/index.ts`

#### Changes to `/realtime-session`

Add training context support:

```typescript
// New request fields:
{
  mode: 'training',              // New mode alongside existing modes
  section_id: string,
  content_context: string,
  conversation_history: string,  // Serialized recent messages
  language: 'en' | 'es'
}

// When mode=training:
// - Use training-teacher system prompt
// - Include content_context in instructions
// - Enable search tools for the section's content domain
// - Default to PTT (push-to-talk) mode
```

#### Frontend Changes

The `TrainingChatPanel` already reuses `VoiceChatInput` and `VoiceModeButton`.
Need to pass the training context when initiating voice:

```typescript
// In use-training-chat.ts, when voice mode activates:
const webrtc = useRealtimeWebRTC({
  mode: 'training',
  sectionId: section.id,
  contentContext: serializedContent,
  conversationHistory: messages.slice(-10),  // Last 10 messages for context
});
```

#### Deliverables
- [ ] Voice works in training sessions
- [ ] PTT is default mode (not voice-activity detection)
- [ ] AI teacher persona maintained in voice
- [ ] Voice consent checked before first use
- [ ] Text fallback always visible
- [ ] 0 TypeScript errors

---

## Phase 3: Assessment

> Quiz system, AI evaluation, dual feedback, scoring.
> **Goal**: Staff can take quizzes (MC + voice), get scored, see feedback.

---

### Step 3.1 — Quiz Question Generation Edge Function

**New file:** `supabase/functions/course-quiz-generate/index.ts`

#### Edge Function: `course-quiz-generate`

```typescript
// POST /course-quiz-generate
// Headers: Authorization (service role or authenticated user with manager+ role)
//
// Request:
// {
//   section_id: string,
//   content_context: string,    // Serialized source content
//   question_count: number,     // Default 8 (6 MC + 2 voice)
//   language: 'en' | 'es',
//   difficulty_mix: { easy: 2, medium: 4, hard: 2 }
// }
//
// Behavior:
// 1. Call OpenAI gpt-4o-mini with quiz generation prompt
// 2. Generate MC questions with 4 options each
// 3. Generate voice evaluation questions with rubrics
// 4. Insert into quiz_questions table
// 5. Return generated questions
//
// Response:
// {
//   questions: QuizQuestion[],
//   mc_count: number,
//   voice_count: number
// }
```

#### AI Prompt for Quiz Generation (stored in `ai_prompts`)

```
slug: 'training-quiz-generate'
category: 'system'
domain: 'training'

prompt_en: |
  Generate quiz questions for restaurant staff training.
  Content: {content_context}

  RULES:
  1. Questions must be answerable ONLY from the provided content
  2. Distractors should be plausible but clearly wrong based on the content
  3. For allergen questions, be extra precise — lives depend on it
  4. Voice questions should test ability to describe/sell to a guest
  5. Include explanations for each MC answer
  6. Vary difficulty as requested
  7. Output in both EN and ES

  OUTPUT FORMAT:
  Return JSON array of questions matching the QuizQuestion schema
```

#### Deliverables
- [ ] Edge function deployed
- [ ] Generates correct MC questions from content
- [ ] Generates voice questions with rubrics
- [ ] Questions saved to `quiz_questions` table
- [ ] Questions marked `source: 'ai'`, `is_active: true`
- [ ] Bilingual output (EN + ES)

---

### Step 3.2 — Quiz Pages (MC + Voice)

**New files:**

| File | Purpose |
|------|---------|
| `src/pages/QuizPage.tsx` | Quiz flow controller (Screens 4-6) |
| `src/components/training/QuizMCQuestion.tsx` | Multiple choice question card |
| `src/components/training/QuizVoiceQuestion.tsx` | Voice question with PTT |
| `src/components/training/QuizResults.tsx` | Results screen with score + feedback |
| `src/hooks/use-quiz.ts` | Quiz state machine + answer submission |

**Modified files:**

| File | Change |
|------|--------|
| `src/App.tsx` | Add `/training/:courseSlug/:sectionSlug/quiz` route |

#### Hook: `use-quiz.ts`

```typescript
// State machine: loading → ready → in_progress → submitting → results
//
// Returns: {
//   questions: QuizQuestion[],
//   currentIndex: number,
//   currentQuestion: QuizQuestion,
//   answers: Map<string, QuizAttemptAnswer>,
//   status: QuizStatus,
//   timeElapsed: number,
//   // Actions
//   startQuiz: () => void,
//   answerMC: (questionId: string, option: string) => void,
//   answerVoice: (questionId: string, transcription: string) => Promise<void>,
//   nextQuestion: () => void,
//   prevQuestion: () => void,
//   submitQuiz: () => Promise<QuizResults>,
//   // Results
//   results: QuizResults | null,
// }
//
// Behavior:
// 1. Fetch quiz_questions for section (randomized order)
// 2. Create quiz_attempt record
// 3. Auto-save each answer to quiz_attempt_answers
// 4. On submit: score MC, call evaluation for voice, compute total
// 5. Update section_progress with quiz score
// 6. Generate evaluation (dual feedback)
```

#### Component: `QuizMCQuestion`

```typescript
interface QuizMCQuestionProps {
  question: QuizQuestion;
  selectedOption: string | null;
  onSelect: (option: string) => void;
  language: 'en' | 'es';
  showFeedback: boolean;       // After quiz submission
}
// Centered card layout (max-w-640 on iPad/desktop)
// Full-width touch targets (h-14 / 56px)
// Selected: primary border + light fill
// After submission: green/red indicators + explanation
```

#### Component: `QuizVoiceQuestion`

```typescript
interface QuizVoiceQuestionProps {
  question: QuizQuestion;
  onSubmit: (transcription: string) => void;
  language: 'en' | 'es';
}
// Large PTT button (80px)
// Live transcript streams below
// [Submit Answer] [Re-record] after release
// [Type answer instead] always visible
// Reuses VoiceChatInput + use-voice-recording hook
```

#### Component: `QuizResults`

```typescript
interface QuizResultsProps {
  attempt: QuizAttempt;
  answers: QuizAttemptAnswer[];
  questions: QuizQuestion[];
  evaluation: Evaluation;
  passingScore: number;
  language: 'en' | 'es';
  onContinue: () => void;
  onRetry: () => void;
}
// Large score ring (passed=green, failed=red)
// Student feedback card (from evaluation.studentFeedback)
// 2-col question breakdown (iPad) / 1-col (phone)
// Each question: ✅/❌ + answer + explanation
// Voice questions: inline AI feedback
// Failed: [Review Material] + [Retry in 30 min] with countdown
// Passed: [Continue to Next Course →]
```

#### Deliverables
- [ ] Quiz loads with randomized questions
- [ ] MC questions work with tap selection
- [ ] Voice questions work with PTT + transcript review
- [ ] Text fallback works for voice questions
- [ ] Auto-save on each answer (resume on connection drop)
- [ ] Results screen shows score + dual feedback
- [ ] Failed quiz: 30-min retry cooldown
- [ ] Section progress updated on pass
- [ ] 0 TypeScript errors

---

### Step 3.3 — Evaluation Edge Function

**New file:** `supabase/functions/course-evaluate/index.ts`

#### Edge Function: `course-evaluate`

```typescript
// POST /course-evaluate
//
// Request:
// {
//   eval_type: 'session' | 'quiz' | 'course_final',
//   user_id: string,
//   section_id?: string,
//   course_id?: string,
//   // For session eval:
//   conversation_messages?: ConversationMessage[],
//   topics_covered?: string[],
//   // For quiz eval:
//   quiz_attempt_id?: string,
//   answers?: QuizAttemptAnswer[],
//   // For voice answer eval:
//   voice_transcription?: string,
//   rubric?: object,
//   // Context
//   content_context: string,
//   language: 'en' | 'es'
// }
//
// Response:
// {
//   student_feedback: StudentFeedback,
//   manager_feedback: ManagerFeedback,
//   competency_level: CompetencyLevel,
//   score: number,
//   // For voice:
//   voice_score?: number,
//   voice_feedback?: string
// }
```

#### Dual Feedback Generation

The edge function calls OpenAI with two sequential prompts:

**Manager feedback first** (ground truth):
```
Evaluate this student's performance objectively.
Score on: accuracy, completeness, confidence, hospitality tone.
Output: {score, competency, strengths[], gaps[], recommendation}
```

**Student feedback second** (derived from manager feedback):
```
Based on this evaluation: {manager_feedback}
Generate encouraging, growth-oriented feedback for the student.
CRITICAL: Must be directionally consistent with the manager assessment.
Never contradict the manager feedback — just frame it positively.
Output: {summary, strengths[], nextSteps[]}
```

#### Deliverables
- [ ] Edge function deployed
- [ ] Generates dual feedback (student + manager views)
- [ ] Student feedback never contradicts manager feedback
- [ ] Voice answers scored on rubric criteria
- [ ] Evaluation saved to `evaluations` table
- [ ] Competency level correctly assigned (novice/competent/proficient/expert)

---

### Step 3.4 — Auto-Generate Quiz Questions on Course Setup

**New hook:** `src/hooks/use-quiz-questions.ts`

#### Behavior

```typescript
// When a section is first accessed for quiz:
// 1. Check if quiz_questions exist for this section
// 2. If none: call /course-quiz-generate to create them
// 3. Questions go live immediately (auto-live decision)
// 4. Questions cached in state after first load
//
// Manager can later edit/disable via manager dashboard (Phase 4)
```

#### Auto-Flagging Low-Performing Questions

```sql
-- Add a database function to flag questions with high miss rates
CREATE OR REPLACE FUNCTION flag_low_performing_questions(p_group_id UUID)
RETURNS TABLE(question_id UUID, miss_rate NUMERIC) AS $$
  SELECT
    q.id,
    1.0 - (q.times_correct::numeric / NULLIF(q.times_shown, 0)) as miss_rate
  FROM quiz_questions q
  WHERE q.group_id = p_group_id
    AND q.times_shown >= 10
    AND (1.0 - (q.times_correct::numeric / NULLIF(q.times_shown, 0))) > 0.7
  ORDER BY miss_rate DESC;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;
```

#### Deliverables
- [ ] Quiz questions auto-generated on first access
- [ ] No blocking wait for manager approval
- [ ] `times_shown` / `times_correct` updated on each quiz
- [ ] Low-performing questions flagged (>70% miss rate)
- [ ] 0 TypeScript errors

---

## Phase 4: Management

> Manager dashboard, rollout system, team insights.
> **Goal**: Managers can see team progress, create training rollouts, get AI insights.

---

### Step 4.1 — Manager Training Dashboard

**New files:**

| File | Purpose |
|------|---------|
| `src/pages/ManagerTrainingDashboard.tsx` | Team training overview (Screen 7) |
| `src/components/training/TeamProgressTable.tsx` | Sortable team member list |
| `src/components/training/ServerDetailPanel.tsx` | Individual server drill-down |
| `src/components/training/CompetencyBadge.tsx` | Colored competency level badge |
| `src/hooks/use-team-training.ts` | Fetch team-wide training data |

**Modified files:**

| File | Change |
|------|--------|
| `src/App.tsx` | Add `/admin/training` route (admin-only) |

#### Hook: `use-team-training.ts`

```typescript
// Fetches aggregated training data for all team members in the group
// Returns: {
//   teamMembers: TeamMemberProgress[],
//   courseStats: CourseStats[],
//   teamAverage: number,
//   isLoading, error
// }
//
// TeamMemberProgress: {
//   userId, fullName, email, role,
//   coursesCompleted, coursesTotal,
//   overallScore, lastActiveAt,
//   failedSections: string[],
//   status: 'on_track' | 'behind' | 'inactive'
// }
```

#### Page: `ManagerTrainingDashboard`

```
iPad layout (split):
├── Left (40%): TeamProgressTable
│   - Sorted by "needs attention" (lowest progress first)
│   - Color: green (>75%), amber (25-75%), red (<25%)
│   - Tap → selects member
└── Right (60%): ServerDetailPanel
    - Name, overall %, last active
    - Section-by-section breakdown with scores
    - Failed sections highlighted
    - AI Insight card (generated on demand, cached 24h)
    - Manager can add private notes
    - View conversation history link

Phone: single column, tap → full-screen detail
```

#### Tabs

```
[Overview] — team-wide stats + progress bar
[By Server] — individual drill-down (split view)
[Rollouts] — active/completed rollouts (Step 4.2)
```

#### AI Insight Generation

```typescript
// When manager selects a server:
// Call /course-evaluate with eval_type='course_final'
// Pass all section_progress + quiz scores + conversation summaries
// Returns: manager_feedback with actionable recommendation
// Cache in evaluations table for 24 hours
```

#### Deliverables
- [ ] Dashboard accessible at `/admin/training` (admin/manager only)
- [ ] Team list shows all enrolled members with progress
- [ ] Tap member → detail panel with section breakdown
- [ ] AI insights generate on demand
- [ ] Manager can add private notes
- [ ] Color coding: green/amber/red
- [ ] iPad split view works (40/60)
- [ ] Phone: single column with tap-to-detail
- [ ] 0 TypeScript errors

---

### Step 4.2 — Rollout System

**New files:**

| File | Purpose |
|------|---------|
| `src/components/training/RolloutWizard.tsx` | Multi-step rollout creation |
| `src/components/training/RolloutCard.tsx` | Rollout summary card |
| `src/hooks/use-rollouts.ts` | CRUD for rollouts + assignments |

**Modified files:**

| File | Change |
|------|--------|
| `src/App.tsx` | Add `/admin/training/rollout` and `/admin/training/rollout/new` routes |

#### Hook: `use-rollouts.ts`

```typescript
// Returns: {
//   rollouts: Rollout[],
//   activeRollouts: Rollout[],
//   createRollout: (data) => Promise<Rollout>,
//   assignUsers: (rolloutId, userIds) => Promise<void>,
//   archiveRollout: (rolloutId) => Promise<void>,
//   getRolloutProgress: (rolloutId) => RolloutProgress,
//   isLoading, error
// }
```

#### Component: `RolloutWizard`

```
Multi-step form:
1. Name & Description
2. Select Courses/Sections (checkbox tree)
3. Set Deadline + Expiry Date
4. Assign Users (by role, individual, or "all staff")
5. Review & Create

- Uses shadcn/ui Dialog or full-page wizard
- Calendar date pickers for deadline/expiry
- User selector with role-based quick picks
```

#### Staff-Facing Rollout UX

On the `TrainingHome` page:
```
- Active rollout shows banner at top: "Complete by March 15 (3 days left)"
- Relevant course cards show amber deadline badge
- Countdown timer on cards
- Completed rollout courses show green checkmark
```

#### Rollout Expiry

```sql
-- Database function to auto-expire rollouts
CREATE OR REPLACE FUNCTION expire_rollouts()
RETURNS void AS $$
  UPDATE rollouts
  SET status = 'expired'
  WHERE status = 'active'
    AND expires_at IS NOT NULL
    AND expires_at < now();

  UPDATE rollout_assignments ra
  SET status = 'overdue'
  FROM rollouts r
  WHERE ra.rollout_id = r.id
    AND r.status IN ('active','expired')
    AND r.deadline IS NOT NULL
    AND r.deadline < now()
    AND ra.status IN ('assigned','in_progress');
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;
```

#### Deliverables
- [ ] Rollout wizard creates rollouts with course/section selection
- [ ] Users assigned individually or by role
- [ ] Staff see rollout deadlines on Training Home
- [ ] Manager sees rollout progress in dashboard
- [ ] Expired rollouts auto-archived
- [ ] Overdue assignments marked
- [ ] 0 TypeScript errors

---

### Step 4.3 — Content Change Detection

**New file:** `src/hooks/use-content-changes.ts`

**New migration:** `supabase/migrations/YYYYMMDD_content_change_detection.sql`

#### Database Function

```sql
-- Scans all content source tables and compares MD5 hashes
CREATE OR REPLACE FUNCTION detect_content_changes(p_group_id UUID)
RETURNS TABLE(
  section_id UUID,
  section_title TEXT,
  source_table TEXT,
  source_id UUID,
  old_hash TEXT,
  new_hash TEXT
) AS $$
  -- For each course_section, compute MD5 of current source content
  -- Compare with content_change_log.content_hash
  -- Return rows where hash differs
  ...
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
```

#### Manager Dashboard Integration

```
- "Content Updated" badge appears on affected sections
- Manager sees: "Wine list updated — 2 course sections may need review"
- Actions: [Acknowledge] [Create Refresh Rollout] [Update Quiz Questions]
- Acknowledging clears the badge and logs the action
- Never auto-resets student completions (per design decision 7.4)
```

#### Deliverables
- [ ] Content change detection runs on dashboard load
- [ ] Changed sections flagged in manager view
- [ ] Manager can acknowledge or create refresh rollout
- [ ] Student completions never auto-reset
- [ ] content_hash_at_completion stored for audit trail
- [ ] 0 TypeScript errors

---

## Cross-Phase: Data Retention

### 90-Day Cleanup

**Migration:** `supabase/migrations/YYYYMMDD_data_retention_policies.sql`

```sql
-- Scheduled function (call via pg_cron or Supabase edge function cron)
CREATE OR REPLACE FUNCTION cleanup_expired_training_data()
RETURNS void AS $$
BEGIN
  -- 1. Delete expired conversations (keep flagged ones)
  DELETE FROM course_conversations
  WHERE expires_at < now()
    AND is_flagged = false;

  -- 2. Null out expired voice transcriptions
  UPDATE quiz_attempt_answers
  SET transcription = NULL
  WHERE transcription_expires_at IS NOT NULL
    AND transcription_expires_at < now();

  -- 3. Expire old rollouts
  PERFORM expire_rollouts();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
```

Deploy as a Supabase cron job (daily at 3 AM):

```sql
SELECT cron.schedule(
  'cleanup-training-data',
  '0 3 * * *',
  'SELECT cleanup_expired_training_data()'
);
```

---

## Implementation Order Summary

```
PHASE 1: Foundation
  1.1  Create 12 training tables (migration)
  1.2  Seed Server 101 courses & sections (migration)
  1.3  TypeScript types + 4 data hooks
  1.4  TrainingHome + CourseDetail pages + navigation
  1.5  Voice consent dialog
       ↓ TESTABLE: Browse courses and sections

PHASE 2: Learning
  2.1  TrainingChatPanel component + use-training-chat hook
  2.2  LearningSession page + ContentPanel
  2.3  AI teacher prompt + /ask training domain
  2.4  Voice integration for training
       ↓ TESTABLE: AI-guided learning sessions with voice

PHASE 3: Assessment
  3.1  Quiz generation edge function
  3.2  QuizPage + MC/Voice components + QuizResults
  3.3  Evaluation edge function (dual feedback)
  3.4  Auto-generate quiz questions + low-performing flags
       ↓ TESTABLE: Full quiz flow with scoring and feedback

PHASE 4: Management
  4.1  Manager dashboard + team progress
  4.2  Rollout wizard + assignment system
  4.3  Content change detection
       ↓ TESTABLE: Full manager experience
```

---

## New File Inventory

### Phase 1 (18 files)
```
supabase/migrations/YYYYMMDD_create_training_tables.sql
supabase/migrations/YYYYMMDD_seed_training_courses.sql
supabase/migrations/YYYYMMDD_voice_consent_column.sql
src/types/training.ts
src/hooks/use-courses.ts
src/hooks/use-course-sections.ts
src/hooks/use-section-progress.ts
src/hooks/use-enrollment.ts
src/pages/TrainingHome.tsx
src/pages/CourseDetail.tsx
src/components/training/CourseCard.tsx
src/components/training/ProgressRing.tsx
src/components/training/SectionListItem.tsx
src/components/training/VoiceConsentDialog.tsx
```

### Phase 2 (12 files)
```
supabase/migrations/YYYYMMDD_training_ai_prompts.sql
src/pages/LearningSession.tsx
src/hooks/use-training-chat.ts
src/hooks/use-learning-session.ts
src/components/training/TrainingChatPanel.tsx
src/components/training/ChatBubble.tsx
src/components/training/SuggestedReplyChips.tsx
src/components/training/ProgressStrip.tsx
src/components/training/ContentPanel.tsx
```

### Phase 3 (10 files)
```
supabase/functions/course-quiz-generate/index.ts
supabase/functions/course-evaluate/index.ts
supabase/migrations/YYYYMMDD_quiz_flagging_function.sql
src/pages/QuizPage.tsx
src/hooks/use-quiz.ts
src/hooks/use-quiz-questions.ts
src/components/training/QuizMCQuestion.tsx
src/components/training/QuizVoiceQuestion.tsx
src/components/training/QuizResults.tsx
```

### Phase 4 (8 files)
```
supabase/migrations/YYYYMMDD_content_change_detection.sql
supabase/migrations/YYYYMMDD_data_retention_policies.sql
src/pages/ManagerTrainingDashboard.tsx
src/hooks/use-team-training.ts
src/hooks/use-rollouts.ts
src/hooks/use-content-changes.ts
src/components/training/TeamProgressTable.tsx
src/components/training/ServerDetailPanel.tsx
src/components/training/CompetencyBadge.tsx
src/components/training/RolloutWizard.tsx
src/components/training/RolloutCard.tsx
```

### Modified Files (across all phases)
```
src/lib/constants.ts              — Add Training nav item
src/App.tsx                       — Add ~6 routes
supabase/functions/ask/index.ts   — Add training domain
supabase/functions/realtime-session/index.ts — Add training mode
```

---

## Total Counts

| Category | Count |
|----------|-------|
| New migrations | 7 |
| New edge functions | 2 |
| New pages | 5 |
| New components | 15 |
| New hooks | 10 |
| New type file | 1 |
| Modified files | 4 |
| **Total new files** | **~48** |
| New DB tables | 12 |
| New RLS policies | ~48 |
| New indexes | ~12 |
