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
  FORMS: '/forms',
  FORMS_DETAIL: '/forms/:slug',
  PROFILE: '/profile',
  ADMIN: '/admin',
  ADMIN_COURSES: '/admin/courses',
  ADMIN_COURSES_NEW: '/admin/courses/new',
  ADMIN_COURSES_EDIT: '/admin/courses/:id/edit',
  ADMIN_REVIEWS: '/admin/reviews',
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
// @deprecated for sidebar use — sidebar now uses NAV_GROUPS from nav-config.ts.
// Kept for MobileTabBar.
export const STAFF_NAV_ITEMS = [
  { path: '/manual', labelEn: 'Restaurant Standards', labelEs: 'Estándares', icon: 'BookOpen' },
  { path: '/search', labelEn: 'Search', labelEs: 'Buscar', icon: 'Search' },
  { path: '/recipes', labelEn: 'Recipes', labelEs: 'Recetas', icon: 'ChefHat' },
  { path: '/dish-guide', labelEn: 'Dish Guide', labelEs: 'Guía de Platos', icon: 'Utensils' },
  { path: '/wines', labelEn: 'Wines', labelEs: 'Vinos', icon: 'Wine' },
  { path: '/cocktails', labelEn: 'Cocktails', labelEs: 'Cócteles', icon: 'Martini' },
  { path: '/beer-liquor', labelEn: 'Beer & Liquor', labelEs: 'Cerveza y Licores', icon: 'Beer' },
  { path: '/foh-manuals', labelEn: 'FOH Manuals', labelEs: 'Manuales FOH', icon: 'ConciergeBell' },
  { path: '/courses', labelEn: 'Courses', labelEs: 'Cursos', icon: 'GraduationCap' },
  { path: '/forms', labelEn: 'Forms', labelEs: 'Formularios', icon: 'ClipboardList' },
  { path: '/ask', labelEn: 'Ask AI', labelEs: 'Preguntar IA', icon: 'Sparkles' },
  { path: '/profile', labelEn: 'Profile', labelEs: 'Perfil', icon: 'User' },
] as const;

// Navigation items for admin (includes admin panel)
export const ADMIN_NAV_ITEMS = [
  { path: '/manual', labelEn: 'Restaurant Standards', labelEs: 'Estándares', icon: 'BookOpen' },
  { path: '/search', labelEn: 'Search', labelEs: 'Buscar', icon: 'Search' },
  { path: '/recipes', labelEn: 'Recipes', labelEs: 'Recetas', icon: 'ChefHat' },
  { path: '/dish-guide', labelEn: 'Dish Guide', labelEs: 'Guía de Platos', icon: 'Utensils' },
  { path: '/wines', labelEn: 'Wines', labelEs: 'Vinos', icon: 'Wine' },
  { path: '/cocktails', labelEn: 'Cocktails', labelEs: 'Cócteles', icon: 'Martini' },
  { path: '/beer-liquor', labelEn: 'Beer & Liquor', labelEs: 'Cerveza y Licores', icon: 'Beer' },
  { path: '/foh-manuals', labelEn: 'FOH Manuals', labelEs: 'Manuales FOH', icon: 'ConciergeBell' },
  { path: '/courses', labelEn: 'Courses', labelEs: 'Cursos', icon: 'GraduationCap' },
  { path: '/forms', labelEn: 'Forms', labelEs: 'Formularios', icon: 'ClipboardList' },
  { path: '/ask', labelEn: 'Ask AI', labelEs: 'Preguntar IA', icon: 'Sparkles' },
  { path: '/admin', labelEn: 'Admin', labelEs: 'Admin', icon: 'Settings' },
] as const;
