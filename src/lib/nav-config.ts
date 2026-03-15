import {
  BookOpen,
  ChefHat,
  Utensils,
  Wine,
  Martini,
  Beer,
  ConciergeBell,
  GraduationCap,
  ClipboardList,
  Settings,
  User,
  Plus,
  BarChart3,
  Star,
  type LucideIcon,
} from 'lucide-react';
import type { Language } from '@/hooks/use-language';

export type NavGroupId = 'boh' | 'foh' | 'learn' | 'forms' | 'admin';

export interface NavChild {
  path: string;
  labelEn: string;
  labelEs: string;
  icon: LucideIcon;
}

export interface NavGroup {
  id: NavGroupId;
  labelEn: string;
  labelEs: string;
  icon: LucideIcon;
  children: NavChild[];
  adminOnly?: boolean;
  departments?: string[];  // If set, only visible to users in these departments
}

export interface NavStandalone {
  path: string;
  labelEn: string;
  labelEs: string;
  icon: LucideIcon;
}

/** Get the label for the current language */
export function getLabel(item: { labelEn: string; labelEs: string }, language: Language): string {
  return language === 'es' ? item.labelEs : item.labelEn;
}

// ── Standalone items ───────────────────────────────────────────────────────
export const NAV_STANDALONE_TOP: NavStandalone = {
  path: '/manual',
  labelEn: 'Manual',
  labelEs: 'Manual',
  icon: BookOpen,
};

export const NAV_STANDALONE_BOTTOM: NavStandalone = {
  path: '/profile',
  labelEn: 'Profile',
  labelEs: 'Perfil',
  icon: User,
};

// ── Groups ─────────────────────────────────────────────────────────────────
// Single-child groups render as a plain nav link (no expand step needed).
// Multi-child groups render as a collapsible section.
export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'boh',
    labelEn: 'BOH',
    labelEs: 'BOH',
    icon: ChefHat,
    departments: ['BOH'],
    children: [
      { path: '/recipes', labelEn: 'Recipes', labelEs: 'Recetas', icon: ChefHat },
    ],
  },
  {
    id: 'foh',
    labelEn: 'FOH',
    labelEs: 'FOH',
    icon: Utensils,
    departments: ['FOH'],
    children: [
      { path: '/dish-guide',  labelEn: 'Dish Guide',   labelEs: 'Guía de Platos',  icon: Utensils     },
      { path: '/wines',       labelEn: 'Wines',         labelEs: 'Vinos',            icon: Wine         },
      { path: '/cocktails',   labelEn: 'Cocktails',     labelEs: 'Cócteles',         icon: Martini      },
      { path: '/beer-liquor', labelEn: 'Beer & Liquor', labelEs: 'Cerveza y Licores', icon: Beer        },
      { path: '/foh-manuals', labelEn: 'FOH Manuals',   labelEs: 'Manuales FOH',     icon: ConciergeBell },
    ],
  },
  {
    id: 'learn',
    labelEn: 'Learn',
    labelEs: 'Aprender',
    icon: GraduationCap,
    children: [
      { path: '/courses', labelEn: 'Courses', labelEs: 'Cursos', icon: GraduationCap },
    ],
  },
  {
    id: 'forms',
    labelEn: 'Forms',
    labelEs: 'Formularios',
    icon: ClipboardList,
    children: [
      { path: '/forms', labelEn: 'Forms', labelEs: 'Formularios', icon: ClipboardList },
    ],
  },
  {
    id: 'admin',
    labelEn: 'Admin',
    labelEs: 'Admin',
    icon: Settings,
    adminOnly: true,
    children: [
      { path: '/admin/ingest',    labelEn: 'Ingest',             labelEs: 'Ingestión',              icon: Plus     },
      { path: '/admin/courses',  labelEn: 'Course Builder',     labelEs: 'Constructor de Cursos',  icon: GraduationCap },
      { path: '/admin/reviews',   labelEn: 'Review Insights',    labelEs: 'Análisis de Reseñas',    icon: Star     },
      { path: '/admin',           labelEn: 'Admin Settings',     labelEs: 'Config. Admin',          icon: Settings },
    ],
  },
];

/** Filter groups by admin status, manager status, and department */
export function getVisibleGroups(
  groups: NavGroup[],
  isAdmin: boolean,
  isManager?: boolean,
  department?: string | null,
): NavGroup[] {
  return groups.filter(g => {
    // Admin-only groups: only admins can see
    if (g.adminOnly && !isAdmin) return false;
    // Managers and admins see all department groups
    if (isAdmin || isManager) return true;
    // If group has no department restriction, everyone sees it
    if (!g.departments) return true;
    // If user has no department (no employee record), show everything as fallback
    if (!department) return true;
    // Check if user's department matches (case-insensitive)
    return g.departments.some(d => d.toUpperCase() === department.toUpperCase());
  });
}

/** FOH and Admin expanded by default — smart collapse handles overflow */
export function getDefaultExpandedState(): Record<NavGroupId, boolean> {
  return { boh: false, foh: true, learn: false, forms: false, admin: true };
}
