/**
 * Management Dashboard Types
 *
 * TypeScript interfaces for team progress, rollouts, content changes, and evaluations.
 * Raw types (snake_case) -> transform functions -> Frontend types (camelCase)
 */

// =============================================================================
// TEAM MEMBER PROGRESS
// =============================================================================

export type TeamMemberStatus = 'on_track' | 'behind' | 'inactive';

export interface TeamMemberProgress {
  userId: string;
  fullName: string | null;
  email: string;
  role: 'staff' | 'manager' | 'admin';
  avatarUrl: string | null;
  coursesCompleted: number;
  coursesTotal: number;
  overallProgressPercent: number;
  averageQuizScore: number | null;
  competencyLevel: 'novice' | 'competent' | 'proficient' | 'expert' | null;
  lastActiveAt: string | null;
  failedSections: string[];
  status: TeamMemberStatus;
}

// =============================================================================
// COURSE STATS
// =============================================================================

export interface CourseStats {
  courseId: string;
  courseTitle: string;
  enrolledCount: number;
  completedCount: number;
  averageScore: number | null;
  completionPercent: number;
}

// =============================================================================
// DASHBOARD SUMMARY
// =============================================================================

export interface DashboardSummary {
  totalStaff: number;
  activeStaff: number;
  teamAverage: number;
  coursesPublished: number;
  overdueTasks: number;
}

// =============================================================================
// ROLLOUT TYPES
// =============================================================================

export type RolloutStatus = 'draft' | 'active' | 'completed' | 'expired' | 'archived';
export type AssignmentStatus = 'assigned' | 'in_progress' | 'completed' | 'overdue';

export interface RolloutRaw {
  id: string;
  group_id: string;
  name: string;
  description: string | null;
  course_ids: string[];
  section_ids: string[];
  starts_at: string;
  deadline: string | null;
  expires_at: string | null;
  status: RolloutStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Rollout {
  id: string;
  groupId: string;
  name: string;
  description: string | null;
  courseIds: string[];
  sectionIds: string[];
  startsAt: string;
  deadline: string | null;
  expiresAt: string | null;
  status: RolloutStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface RolloutWithProgress extends Rollout {
  totalAssignees: number;
  completedAssignees: number;
  overdueAssignees: number;
  progressPercent: number;
}

export interface RolloutAssignmentRaw {
  id: string;
  rollout_id: string;
  user_id: string;
  status: AssignmentStatus;
  started_at: string | null;
  completed_at: string | null;
  total_courses: number;
  completed_courses: number;
  created_at: string;
  updated_at: string;
}

export interface RolloutAssignment {
  id: string;
  rolloutId: string;
  userId: string;
  status: AssignmentStatus;
  startedAt: string | null;
  completedAt: string | null;
  totalCourses: number;
  completedCourses: number;
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// CONTENT CHANGE TYPES
// =============================================================================

export interface ContentChangeRow {
  section_id: string;
  section_title: string;
  source_table: string;
  source_id: string;
  old_hash: string;
  new_hash: string;
}

export interface ContentChangeWithContext {
  sectionId: string;
  sectionTitle: string;
  sourceTable: string;
  sourceId: string;
  oldHash: string;
  newHash: string;
  affectedStudents: number;
}

// =============================================================================
// EVALUATION MANAGER VIEW
// =============================================================================

export interface EvaluationManagerView {
  id: string;
  userId: string;
  userName: string;
  sectionTitle: string;
  evalType: 'session' | 'quiz' | 'course_final';
  competencyLevel: string | null;
  managerFeedback: {
    competencyGaps: string[];
    recommendedActions: string[];
    riskLevel: string;
  } | null;
  managerNotes: string | null;
  createdAt: string;
}

// =============================================================================
// TRANSFORM FUNCTIONS
// =============================================================================

export function transformRollout(raw: RolloutRaw): Rollout {
  return {
    id: raw.id,
    groupId: raw.group_id,
    name: raw.name,
    description: raw.description,
    courseIds: raw.course_ids,
    sectionIds: raw.section_ids,
    startsAt: raw.starts_at,
    deadline: raw.deadline,
    expiresAt: raw.expires_at,
    status: raw.status,
    createdBy: raw.created_by,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

export function transformAssignment(raw: RolloutAssignmentRaw): RolloutAssignment {
  return {
    id: raw.id,
    rolloutId: raw.rollout_id,
    userId: raw.user_id,
    status: raw.status,
    startedAt: raw.started_at,
    completedAt: raw.completed_at,
    totalCourses: raw.total_courses,
    completedCourses: raw.completed_courses,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}
