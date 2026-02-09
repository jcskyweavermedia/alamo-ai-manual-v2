// Route paths
export const ROUTES = {
  HOME: '/',
  MANUAL: '/manual',
  MANUAL_SECTION: '/manual/:sectionId',
  SEARCH: '/search',
  ASK: '/ask',
  PROFILE: '/profile',
  ADMIN: '/admin',
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
  { path: '/manual', label: 'Manual', icon: 'BookOpen' },
  { path: '/search', label: 'Search', icon: 'Search' },
  { path: '/ask', label: 'Ask AI', icon: 'Sparkles' },
  { path: '/profile', label: 'Profile', icon: 'User' },
] as const;

// Navigation items for admin (includes admin panel)
export const ADMIN_NAV_ITEMS = [
  { path: '/manual', label: 'Manual', icon: 'BookOpen' },
  { path: '/search', label: 'Search', icon: 'Search' },
  { path: '/ask', label: 'Ask AI', icon: 'Sparkles' },
  { path: '/admin', label: 'Admin', icon: 'Settings' },
] as const;
