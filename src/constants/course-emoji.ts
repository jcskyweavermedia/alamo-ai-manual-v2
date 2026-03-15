// Shared emoji config for course cards (used by AdminCourseListPage and CourseCardPreview)

export const COURSE_EMOJI: Record<string, { emoji: string; bg: string; darkBg: string }> = {
  Landmark:        { emoji: '🏛️', bg: 'bg-slate-100',  darkBg: 'dark:bg-slate-800' },
  Beef:            { emoji: '🥩', bg: 'bg-red-100',    darkBg: 'dark:bg-red-900/30' },
  UtensilsCrossed: { emoji: '🍽️', bg: 'bg-amber-100',  darkBg: 'dark:bg-amber-900/30' },
  Wine:            { emoji: '🍷', bg: 'bg-rose-100',   darkBg: 'dark:bg-rose-900/30' },
  Martini:         { emoji: '🍸', bg: 'bg-sky-100',    darkBg: 'dark:bg-sky-900/30' },
  Beer:            { emoji: '🍺', bg: 'bg-amber-100',  darkBg: 'dark:bg-amber-900/30' },
  CakeSlice:       { emoji: '🍰', bg: 'bg-pink-100',   darkBg: 'dark:bg-pink-900/30' },
  GraduationCap:   { emoji: '🎓', bg: 'bg-blue-100',   darkBg: 'dark:bg-blue-900/30' },
  ChefHat:         { emoji: '👨‍🍳', bg: 'bg-orange-100', darkBg: 'dark:bg-orange-900/30' },
  Users:           { emoji: '👥', bg: 'bg-indigo-100',  darkBg: 'dark:bg-indigo-900/30' },
  BookOpen:        { emoji: '📖', bg: 'bg-cyan-100',   darkBg: 'dark:bg-cyan-900/30' },
  ClipboardList:   { emoji: '📋', bg: 'bg-green-100',  darkBg: 'dark:bg-green-900/30' },
  Utensils:        { emoji: '🍴', bg: 'bg-red-100',    darkBg: 'dark:bg-red-900/30' },
  Sparkles:        { emoji: '✨', bg: 'bg-amber-100',  darkBg: 'dark:bg-amber-900/30' },
  Star:            { emoji: '⭐', bg: 'bg-yellow-100', darkBg: 'dark:bg-yellow-900/30' },
  Shield:          { emoji: '🛡️', bg: 'bg-slate-100',  darkBg: 'dark:bg-slate-800' },
  Heart:           { emoji: '❤️', bg: 'bg-red-100',    darkBg: 'dark:bg-red-900/30' },
  Flame:           { emoji: '🔥', bg: 'bg-orange-100', darkBg: 'dark:bg-orange-900/30' },
  Award:           { emoji: '🏆', bg: 'bg-amber-100',  darkBg: 'dark:bg-amber-900/30' },
};

export const defaultEmoji = { emoji: '📚', bg: 'bg-slate-100', darkBg: 'dark:bg-slate-800' };
