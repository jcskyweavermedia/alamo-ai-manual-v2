// =============================================================================
// Course Player Types
// Player / enrollment / progress / quiz types for the staff learning UI.
// Rebuilt from scratch for the new element-based course architecture.
// =============================================================================

// =============================================================================
// PLAYER / ENROLLMENT / PROGRESS TYPES
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
  elementsViewed: string[];
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

// =============================================================================
// QUIZ PLAYER TYPES (Phase 3 — Student Quiz UI)
// =============================================================================

export type QuizPlayerState = 'idle' | 'loading' | 'ready' | 'answering' | 'grading' | 'results';

/** Client-safe question (no correct answer exposed) */
export interface QuizQuestionClient {
  id: string;
  question: string;          // Already localized by edge function
  options: Array<{
    id: string;
    text: string;             // Already localized
  }>;
  difficulty: 'easy' | 'medium' | 'hard';
  questionType: 'multiple_choice';
}

export interface QuizAttemptClient {
  attemptId: string;
  questions: QuizQuestionClient[];
  totalQuestions: number;
  passingScore: number;
}

export interface MCAnswerResult {
  questionId: string;
  isCorrect: boolean;
  correctOptionId: string;
  correctOptionText: string;
  explanation: string | null;
}

export interface StudentFeedback {
  strengths: string[];
  areasForImprovement: string[];
  encouragement: string;
}

export interface QuizEvaluationResult {
  score: number;
  passed: boolean;
  competencyLevel: string;
  studentFeedback: StudentFeedback;
}

export interface CourseEvaluationResult {
  score: number;
  passed: boolean;
  competencyLevel: string;
  studentFeedback: StudentFeedback;
}
