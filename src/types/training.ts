/**
 * Training System Types
 *
 * TypeScript interfaces for courses, sections, enrollments, progress, and quizzes.
 * Raw types (snake_case) → transform functions → Frontend types (camelCase)
 */

// =============================================================================
// ENUMS / UNIONS
// =============================================================================

export type ProgramStatus = 'published' | 'draft' | 'archived' | 'coming_soon';
export type ProgramCategory = 'fundamentals' | 'advanced' | 'specialty';
export type CourseStatus = 'published' | 'draft' | 'archived';
export type EnrollmentStatus = 'enrolled' | 'in_progress' | 'completed' | 'expired';
export type ProgramEnrollmentStatus = 'enrolled' | 'in_progress' | 'completed';
export type SectionProgressStatus = 'not_started' | 'in_progress' | 'completed';
export type SectionType = 'learn' | 'practice' | 'quiz' | 'overview';

export type ContentSource =
  | 'manual_sections'
  | 'foh_plate_specs'
  | 'plate_specs'
  | 'prep_recipes'
  | 'wines'
  | 'cocktails'
  | 'beer_liquor_list'
  | 'custom';

// =============================================================================
// TRAINING PROGRAMS
// =============================================================================

export interface TrainingProgramRaw {
  id: string;
  group_id: string;
  slug: string;
  title_en: string;
  title_es: string | null;
  description_en: string | null;
  description_es: string | null;
  cover_image: string | null;
  category: ProgramCategory;
  icon: string | null;
  sort_order: number;
  estimated_minutes: number;
  passing_score: number;
  status: ProgramStatus;
  created_at: string;
  updated_at: string;
}

export interface TrainingProgram {
  id: string;
  groupId: string;
  slug: string;
  titleEn: string;
  titleEs: string | null;
  descriptionEn: string | null;
  descriptionEs: string | null;
  coverImage: string | null;
  category: ProgramCategory;
  icon: string | null;
  sortOrder: number;
  estimatedMinutes: number;
  passingScore: number;
  status: ProgramStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ProgramWithProgress extends TrainingProgram {
  totalCourses: number;
  completedCourses: number;
  progressPercent: number;
  enrollmentStatus: ProgramEnrollmentStatus | null;
}

export function transformTrainingProgram(raw: TrainingProgramRaw): TrainingProgram {
  return {
    id: raw.id,
    groupId: raw.group_id,
    slug: raw.slug,
    titleEn: raw.title_en,
    titleEs: raw.title_es,
    descriptionEn: raw.description_en,
    descriptionEs: raw.description_es,
    coverImage: raw.cover_image,
    category: raw.category,
    icon: raw.icon,
    sortOrder: raw.sort_order,
    estimatedMinutes: raw.estimated_minutes,
    passingScore: raw.passing_score,
    status: raw.status,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

// =============================================================================
// PROGRAM ENROLLMENT
// =============================================================================

export interface ProgramEnrollmentRaw {
  id: string;
  user_id: string;
  program_id: string;
  group_id: string;
  status: ProgramEnrollmentStatus;
  started_at: string | null;
  completed_at: string | null;
  total_courses: number;
  completed_courses: number;
  overall_score: number | null;
  created_at: string;
  updated_at: string;
}

export interface ProgramEnrollment {
  id: string;
  userId: string;
  programId: string;
  groupId: string;
  status: ProgramEnrollmentStatus;
  startedAt: string | null;
  completedAt: string | null;
  totalCourses: number;
  completedCourses: number;
  overallScore: number | null;
  createdAt: string;
  updatedAt: string;
}

export function transformProgramEnrollment(raw: ProgramEnrollmentRaw): ProgramEnrollment {
  return {
    id: raw.id,
    userId: raw.user_id,
    programId: raw.program_id,
    groupId: raw.group_id,
    status: raw.status,
    startedAt: raw.started_at,
    completedAt: raw.completed_at,
    totalCourses: raw.total_courses,
    completedCourses: raw.completed_courses,
    overallScore: raw.overall_score,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

// =============================================================================
// COURSES
// =============================================================================

export interface CourseRaw {
  id: string;
  group_id: string;
  program_id: string | null;
  slug: string;
  title_en: string;
  title_es: string | null;
  description_en: string | null;
  description_es: string | null;
  icon: string | null;
  sort_order: number;
  estimated_minutes: number;
  passing_score: number;
  status: CourseStatus;
  created_at: string;
  updated_at: string;
}

export interface Course {
  id: string;
  groupId: string;
  programId: string | null;
  slug: string;
  titleEn: string;
  titleEs: string | null;
  descriptionEn: string | null;
  descriptionEs: string | null;
  icon: string | null;
  sortOrder: number;
  estimatedMinutes: number;
  passingScore: number;
  status: CourseStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CourseWithProgress extends Course {
  totalSections: number;
  completedSections: number;
  progressPercent: number;
  enrollmentStatus: EnrollmentStatus | null;
}

export function transformCourse(raw: CourseRaw): Course {
  return {
    id: raw.id,
    groupId: raw.group_id,
    programId: raw.program_id,
    slug: raw.slug,
    titleEn: raw.title_en,
    titleEs: raw.title_es,
    descriptionEn: raw.description_en,
    descriptionEs: raw.description_es,
    icon: raw.icon,
    sortOrder: raw.sort_order,
    estimatedMinutes: raw.estimated_minutes,
    passingScore: raw.passing_score,
    status: raw.status,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

// =============================================================================
// COURSE SECTIONS
// =============================================================================

export interface CourseSectionRaw {
  id: string;
  course_id: string;
  group_id: string;
  slug: string;
  title_en: string;
  title_es: string | null;
  description_en: string;
  description_es: string | null;
  sort_order: number;
  estimated_minutes: number;
  status: 'published' | 'draft';
  content_source: ContentSource;
  content_ids: string[];
  content_filter: Record<string, unknown> | null;
  section_type: SectionType;
  ai_prompt_en: string | null;
  ai_prompt_es: string | null;
  quiz_enabled: boolean;
  quiz_question_count: number | null;
  quiz_passing_score: number | null;
  quiz_mode: 'classic' | 'conversation';
  created_at: string;
  updated_at: string;
}

export interface CourseSection {
  id: string;
  courseId: string;
  groupId: string;
  slug: string;
  titleEn: string;
  titleEs: string | null;
  descriptionEn: string;
  descriptionEs: string | null;
  sortOrder: number;
  estimatedMinutes: number;
  status: 'published' | 'draft';
  contentSource: ContentSource;
  contentIds: string[];
  contentFilter: Record<string, unknown> | null;
  sectionType: SectionType;
  aiPromptEn: string | null;
  aiPromptEs: string | null;
  quizEnabled: boolean;
  quizQuestionCount: number | null;
  quizPassingScore: number | null;
  quizMode: 'classic' | 'conversation';
  createdAt: string;
  updatedAt: string;
}

export interface SectionWithProgress extends CourseSection {
  progressStatus: SectionProgressStatus;
  topicsCovered: number;
  topicsTotal: number;
  quizScore: number | null;
  quizPassed: boolean | null;
}

export function transformCourseSection(raw: CourseSectionRaw): CourseSection {
  return {
    id: raw.id,
    courseId: raw.course_id,
    groupId: raw.group_id,
    slug: raw.slug,
    titleEn: raw.title_en,
    titleEs: raw.title_es,
    descriptionEn: raw.description_en,
    descriptionEs: raw.description_es,
    sortOrder: raw.sort_order,
    estimatedMinutes: raw.estimated_minutes,
    status: raw.status,
    contentSource: raw.content_source,
    contentIds: raw.content_ids,
    contentFilter: raw.content_filter,
    sectionType: raw.section_type,
    aiPromptEn: raw.ai_prompt_en,
    aiPromptEs: raw.ai_prompt_es,
    quizEnabled: raw.quiz_enabled,
    quizQuestionCount: raw.quiz_question_count,
    quizPassingScore: raw.quiz_passing_score,
    quizMode: raw.quiz_mode ?? 'classic',
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

// =============================================================================
// COURSE ENROLLMENT
// =============================================================================

export interface CourseEnrollmentRaw {
  id: string;
  user_id: string;
  course_id: string;
  group_id: string;
  status: EnrollmentStatus;
  started_at: string | null;
  completed_at: string | null;
  expires_at: string | null;
  total_sections: number;
  completed_sections: number;
  final_score: number | null;
  final_passed: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface CourseEnrollment {
  id: string;
  userId: string;
  courseId: string;
  groupId: string;
  status: EnrollmentStatus;
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

export function transformEnrollment(raw: CourseEnrollmentRaw): CourseEnrollment {
  return {
    id: raw.id,
    userId: raw.user_id,
    courseId: raw.course_id,
    groupId: raw.group_id,
    status: raw.status,
    startedAt: raw.started_at,
    completedAt: raw.completed_at,
    expiresAt: raw.expires_at,
    totalSections: raw.total_sections,
    completedSections: raw.completed_sections,
    finalScore: raw.final_score,
    finalPassed: raw.final_passed,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

// =============================================================================
// SECTION PROGRESS
// =============================================================================

export interface SectionProgressRaw {
  id: string;
  user_id: string;
  section_id: string;
  enrollment_id: string;
  course_id: string;
  status: SectionProgressStatus;
  topics_covered: number;
  topics_total: number;
  quiz_score: number | null;
  quiz_passed: boolean | null;
  quiz_attempts: number;
  time_spent_seconds: number;
  content_hash_at_completion: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SectionProgress {
  id: string;
  userId: string;
  sectionId: string;
  enrollmentId: string;
  courseId: string;
  status: SectionProgressStatus;
  topicsCovered: number;
  topicsTotal: number;
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

export function transformSectionProgress(raw: SectionProgressRaw): SectionProgress {
  return {
    id: raw.id,
    userId: raw.user_id,
    sectionId: raw.section_id,
    enrollmentId: raw.enrollment_id,
    courseId: raw.course_id,
    status: raw.status,
    topicsCovered: raw.topics_covered,
    topicsTotal: raw.topics_total,
    quizScore: raw.quiz_score,
    quizPassed: raw.quiz_passed,
    quizAttempts: raw.quiz_attempts,
    timeSpentSeconds: raw.time_spent_seconds,
    contentHashAtCompletion: raw.content_hash_at_completion,
    startedAt: raw.started_at,
    completedAt: raw.completed_at,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

// =============================================================================
// CONVERSATION (for Phase 2 chat)
// =============================================================================

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

// =============================================================================
// QUIZ TYPES (Phase 3)
// =============================================================================

export interface QuizQuestionOption {
  id: string;
  text: string;
}

/** Client-safe question (no correct answer for MC) */
export interface QuizQuestionClient {
  id: string;
  question_type: 'multiple_choice' | 'voice';
  question: string;
  options?: QuizQuestionOption[];
  rubric_summary?: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface QuizAttemptClient {
  attemptId: string;
  questions: QuizQuestionClient[];
  totalQuestions: number;
  passingScore: number;
}

export interface MCAnswerResult {
  questionId: string;
  type: 'mc';
  isCorrect: boolean;
  correctOptionId: string;
  correctOptionText: string;
  explanation: string | null;
}

export interface VoiceAnswerResult {
  questionId: string;
  type: 'voice';
  voiceScore: number;
  criteriaScores: Array<{
    criterion: string;
    pointsEarned: number;
    pointsPossible: number;
    met: boolean;
  }>;
  feedback: string;
  passed: boolean;
}

export type AnswerResult = MCAnswerResult | VoiceAnswerResult;

export interface QuizResults {
  score: number;
  passed: boolean;
  competencyLevel: 'novice' | 'competent' | 'proficient' | 'expert';
  studentFeedback: {
    strengths: string[];
    areasForImprovement: string[];
    encouragement: string;
  };
}

export type QuizState =
  | 'loading'
  | 'ready'
  | 'in_progress'
  | 'grading_voice'
  | 'completing'
  | 'results';

// =============================================================================
// MODULE TEST TYPES (Certification Test)
// =============================================================================

export interface ModuleTestAttemptClient {
  attemptId: string;
  questions: QuizQuestionClient[];
  totalQuestions: number;
  passingScore: number;
  sectionMap: Record<string, string>; // questionId → sectionId
}

export interface SectionScore {
  sectionId: string;
  sectionTitle: string;
  score: number;
  questionsCount: number;
}

export interface ModuleTestResults {
  score: number;
  passed: boolean;
  sectionScores: SectionScore[];
  competencyLevel: 'novice' | 'competent' | 'proficient' | 'expert';
  studentFeedback: { strengths: string[]; areasForImprovement: string[]; encouragement: string };
}

export type ModuleTestState = 'loading' | 'ready' | 'in_progress' | 'grading_voice' | 'completing' | 'results';

// =============================================================================
// TUTOR TYPES (Practice with Tutor)
// =============================================================================

export interface TutorMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
  readinessScore?: number;
}

// =============================================================================
// ASSESSMENT STATUS TYPES (CourseDetail cards)
// =============================================================================

export type ModuleTestStatus = 'not_started' | 'in_progress' | 'passed' | 'failed';
export type TutorStatus = 'not_started' | 'in_progress' | 'ready';
