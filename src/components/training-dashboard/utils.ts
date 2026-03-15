// =============================================================================
// Training Dashboard — Shared Utilities
// =============================================================================

/**
 * Extract initials from a full name (e.g. "John Smith" -> "JS")
 */
export function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/**
 * Grade label from a numeric score: A (90+), B (80-89), C (70-79), D (<70)
 */
export function getGradeLabel(score: number | null | undefined): string {
  if (score == null) return '-';
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  return 'D';
}

/**
 * Tailwind class for a grade letter
 */
export function getGradeColor(grade: string): string {
  switch (grade) {
    case 'A': return 'text-green-600 dark:text-green-400';
    case 'B': return 'text-blue-500 dark:text-blue-400';
    case 'C': return 'text-yellow-600 dark:text-yellow-400';
    case 'D': return 'text-red-500 dark:text-red-400';
    default:  return 'text-muted-foreground';
  }
}

/**
 * Tailwind bg class for a grade letter
 */
export function getGradeBgColor(grade: string): string {
  switch (grade) {
    case 'A': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    case 'B': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    case 'C': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
    case 'D': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    default:  return 'bg-muted text-muted-foreground';
  }
}

/**
 * Format a date string into a relative time string
 */
export function formatRelativeTime(
  dateStr: string | null | undefined,
  lang: 'en' | 'es',
): string {
  if (!dateStr) return lang === 'es' ? 'N/D' : 'N/A';
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  if (isNaN(then)) return lang === 'es' ? 'N/D' : 'N/A';
  const diffMs = now - then;
  const seconds = Math.floor(diffMs / 1000);

  if (seconds < 60) return lang === 'es' ? 'Ahora' : 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return lang === 'es' ? `hace ${minutes}m` : `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return lang === 'es' ? `hace ${hours}h` : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return lang === 'es' ? 'Ayer' : 'Yesterday';
  if (days < 30) return lang === 'es' ? `hace ${days}d` : `${days} days ago`;
  const months = Math.floor(days / 30);
  return lang === 'es' ? `hace ${months}mo` : `${months}mo ago`;
}

/**
 * Format a date string into a short date (e.g. "Mar 4")
 */
export function formatShortDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Deterministic avatar color from a string (user ID or name)
 */
const AVATAR_COLORS = [
  'bg-orange-500',
  'bg-blue-500',
  'bg-green-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-cyan-500',
  'bg-amber-500',
  'bg-indigo-500',
  'bg-rose-500',
  'bg-teal-500',
  'bg-red-500',
  'bg-sky-500',
];

export function getAvatarColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
