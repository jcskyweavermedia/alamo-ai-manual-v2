// Route paths
export const ROUTES = {
  HOME: '/',
  MANUAL: '/manual',
  MANUAL_SECTION: '/manual/:sectionId',
  SEARCH: '/search',
  ASK: '/ask',
  RECIPES: '/recipes',
  DISH_GUIDE: '/dish-guide',
  WINES: '/wines',
  COCKTAILS: '/cocktails',
  BEER_LIQUOR: '/beer-liquor',
  FOH_MANUALS: '/foh-manuals',
  COURSES: '/courses',
  COURSES_PROGRAM: '/courses/:programSlug',
  COURSES_COURSE: '/courses/:programSlug/:courseSlug',
  COURSES_SECTION: '/courses/:programSlug/:courseSlug/:sectionSlug',
  COURSES_QUIZ: '/courses/:programSlug/:courseSlug/:sectionSlug/quiz',
  FORMS: '/forms',
  FORMS_DETAIL: '/forms/:slug',
  PROFILE: '/profile',
  ADMIN: '/admin',
  ADMIN_TRAINING: '/admin/training',
} as const;

// Breakpoints (matches Tailwind defaults)
export const BREAKPOINTS = {
  MOBILE: 768,
  TABLET: 1024,
} as const;

// Animation durations (from design-specs.md)
export const ANIMATION = {
  MICRO: 150, // 120-160ms - button press, toggle, haptic
  TRANSITION: 230, // 200-260ms - navigation, fade + slide
  SHEET: 290, // 260-320ms - slide up modal
} as const;

// Navigation items for staff
export const STAFF_NAV_ITEMS = [
  { path: '/manual', label: 'Restaurant Standards', icon: 'BookOpen' },
  { path: '/search', label: 'Search', icon: 'Search' },
  { path: '/recipes', label: 'Recipes', icon: 'ChefHat' },
  { path: '/dish-guide', label: 'Dish Guide', icon: 'Utensils' },
  { path: '/wines', label: 'Wines', icon: 'Wine' },
  { path: '/cocktails', label: 'Cocktails', icon: 'Martini' },
  { path: '/beer-liquor', label: 'Beer & Liquor', icon: 'Beer' },
  { path: '/foh-manuals', label: 'FOH Manuals', icon: 'ConciergeBell' },
  { path: '/courses', label: 'Courses', icon: 'GraduationCap' },
  { path: '/forms', label: 'Forms', icon: 'ClipboardList' },
  { path: '/ask', label: 'Ask AI', icon: 'Sparkles' },
  { path: '/profile', label: 'Profile', icon: 'User' },
] as const;

// Navigation items for admin (includes admin panel)
export const ADMIN_NAV_ITEMS = [
  { path: '/manual', label: 'Restaurant Standards', icon: 'BookOpen' },
  { path: '/search', label: 'Search', icon: 'Search' },
  { path: '/recipes', label: 'Recipes', icon: 'ChefHat' },
  { path: '/dish-guide', label: 'Dish Guide', icon: 'Utensils' },
  { path: '/wines', label: 'Wines', icon: 'Wine' },
  { path: '/cocktails', label: 'Cocktails', icon: 'Martini' },
  { path: '/beer-liquor', label: 'Beer & Liquor', icon: 'Beer' },
  { path: '/foh-manuals', label: 'FOH Manuals', icon: 'ConciergeBell' },
  { path: '/courses', label: 'Courses', icon: 'GraduationCap' },
  { path: '/forms', label: 'Forms', icon: 'ClipboardList' },
  { path: '/ask', label: 'Ask AI', icon: 'Sparkles' },
  { path: '/admin', label: 'Admin', icon: 'Settings' },
] as const;
