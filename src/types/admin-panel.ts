// =============================================================================
// Admin Panel — TypeScript interfaces
// 3-view admin panel: People, Courses, AI Hub
// =============================================================================

// ---------------------------------------------------------------------------
// Shared enums / primitives
// ---------------------------------------------------------------------------

/** Restaurant position (role on the floor / kitchen, NOT access level) */
export type EmployeePosition =
  | 'Server'
  | 'Host'
  | 'Busser'
  | 'Runner'
  | 'Line Cook'
  | 'Bartender'
  | 'Sous Chef'
  | 'Manager';

/** High-level department bucket */
export type Department = 'FOH' | 'BOH' | 'Management';

// ---------------------------------------------------------------------------
// People View
// ---------------------------------------------------------------------------

export interface AdminEmployee {
  id: string;
  name: string;
  initials: string;
  position: EmployeePosition;
  department: Department;
  avatarColor: string;            // Tailwind bg- class, e.g. "bg-blue-600"
  hireDate: string;               // ISO 8601 date
  tenureLabel: string;            // "Week 2", "14 months", etc.
  isNewHire: boolean;             // true if < 30 days tenure
  needsAttention: boolean;
  attentionReason?: 'Failed Quiz' | 'Overdue' | 'Stalled';
  attentionDetail?: string;       // human-readable reason, e.g. "Failed Wine Quiz (2x)"
  currentCourse?: string;         // name of course currently in progress
  courseProgress?: string;        // "5 of 7 modules"
  overallProgress: number;        // 0-100
  grade?: string;                 // letter grade: A, B, C, D
  coursesDone?: string;           // "2/3"
  avgScore?: number;              // 0-100
  learnSpeed?: string;           // multiplier label, e.g. "1.6x"
  leaderboardRank?: number;
  leaderboardPoints?: number;

  /** Full course data — populated for overlay / detail view */
  courses: AdminEmployeeCourse[];

  /** AI-generated analysis — populated for overlay */
  aiAnalysis?: EmployeeAIAnalysis;
}

export interface AdminEmployeeCourse {
  courseId: string;
  courseName: string;
  courseIcon: string;             // Lucide icon name
  status: 'completed' | 'in_progress' | 'not_started' | 'locked';
  score?: number;                 // 0-100
  grade?: string;                 // letter grade
  progressPercent: number;        // 0-100
  modulesCompleted: number;
  modulesTotal: number;
  completedDate?: string;         // ISO date
  estFinish?: string;             // human label, e.g. "~Apr 10"
  modules: AdminModuleResult[];
  aiSummary?: string;             // AI-generated prose summary for the course
  vsCohort?: { label: string; score: number; cohortAvg: number }[];
}

export interface AdminModuleResult {
  id: string;
  name: string;
  status: 'completed' | 'warning' | 'in_progress' | 'locked';
  score?: number;                 // 0-100
  attempts?: number;
  attemptHistory?: number[];      // score per attempt, e.g. [55, 72, 88]
  completedDate?: string;         // ISO date
  duration?: string;              // "12 min", "1h 20m"
  struggleAreas?: string[];       // topics the employee struggled with
  progressPercent?: number;       // 0-100 (for in_progress modules)
}

export interface EmployeeAIAnalysis {
  snapshot: { label: string; value: string }[];
  strengths: string[];
  areasToImprove: { title: string; detail: string }[];
  growthTrajectory: { week: string; actual: number; expected: number; aheadLabel?: string }[];
  whatsNext: { label: string; isActive: boolean; items: { icon?: string; text: string; detail?: string }[] }[];
  prediction: {
    riskLevel: string;
    riskDetail: string;
    potential: string;
    potentialDetail: string;
    summary: string;
  };
}

// ---------------------------------------------------------------------------
// Courses View
// ---------------------------------------------------------------------------

export type CourseColorTheme = 'blue' | 'amber' | 'green' | 'purple' | 'red' | 'teal';
export type CourseCategory = 'New Hire' | 'FOH' | 'BOH';

export interface AdminCourse {
  id: string;
  name: string;
  nameEs?: string;
  icon: string;                   // Lucide icon name
  colorTheme: CourseColorTheme;
  category: CourseCategory;
  department: Department;
  modulesCount: number;
  enrolledCount: number;
  completedCount: number;
  avgScore: number | null;
  completionPercent: number;      // 0-100
  description?: string;
  descriptionEs?: string;
  status: 'published' | 'draft';
  enrolledEmployees: AdminCourseEmployee[];
}

export interface AdminCourseEmployee {
  employeeId: string;
  name: string;
  initials: string;
  avatarColor: string;
  position: EmployeePosition;
  status: 'completed' | 'in_progress' | 'not_started' | 'overdue' | 'stuck';
  grade?: string;
  score?: number;
  progressPercent: number;
  modulesCompleted: number;
  modulesTotal: number;
  lastActivity?: string;         // ISO date or relative label
}

// ---------------------------------------------------------------------------
// AI Hub View
// ---------------------------------------------------------------------------

export interface AISuggestion {
  id: string;
  type: 'assign_course' | 'launch_contest' | 'nudge';
  icon: string;                   // Lucide icon name
  iconBg: string;                 // Tailwind bg- class
  iconColor: string;              // Tailwind text- class
  title: string;
  description: string;
  avatarStack?: { initials: string; color: string }[];
  metaItems?: { icon: string; text: string }[];
  actions: { label: string; variant: 'primary' | 'secondary' | 'ghost' }[];
  borderColor?: string;           // Tailwind border- class
}

export interface AdminContest {
  id: string;
  name: string;
  dateRange: string;
  participants: number;
  prize: string;
  prizeIcon?: string;             // Lucide icon name
  progressPercent: number;        // 0-100
  status: 'live' | 'upcoming' | 'ended';
  leader?: string;
  leaderScore?: number;
  daysLeft: number;
}

export interface GrowthTier {
  id: string;
  range: string;                  // e.g. "0-30 Days"
  label: string;                  // e.g. "Foundation"
  colorTheme: 'blue' | 'purple' | 'green' | 'amber';
  courses: { icon: string; name: string; iconColor: string }[];
  employeeCount: number;
}

export interface TimelineItem {
  label: string;
  isActive: boolean;
  items: string[];
}

export interface RewardBankItem {
  name: string;
  used: number;
  total: number;
}

// ---------------------------------------------------------------------------
// Hero Banner
// ---------------------------------------------------------------------------

export interface HeroBannerStat {
  value: string | number;
  label: string;
  highlighted?: boolean;
}

// ---------------------------------------------------------------------------
// Weekly Update
// ---------------------------------------------------------------------------

export interface WeeklyUpdateSection {
  title: string;
  paragraphs: string[];
}
