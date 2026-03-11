import { NavLink, useLocation } from 'react-router-dom';
import { BookOpen, Search, Sparkles, User, Settings, ChefHat, Utensils, Wine, Martini, Beer, ConciergeBell, GraduationCap, ClipboardList, Pipette, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { STAFF_NAV_ITEMS } from '@/lib/constants';
import { useLanguage } from '@/hooks/use-language';

const iconMap = {
  BookOpen,
  Search,
  Sparkles,
  User,
  Settings,
  ChefHat,
  Utensils,
  Wine,
  Martini,
  Beer,
  ConciergeBell,
  GraduationCap,
  ClipboardList,
  Pipette,
  Star,
} as const;

interface MobileTabBarProps {
  isAdmin?: boolean;
  className?: string;
}

export function MobileTabBar({ isAdmin = false, className }: MobileTabBarProps) {
  const location = useLocation();
  const { language } = useLanguage();

  // Use admin nav if admin, otherwise staff nav
  const adminItems = [
    { path: '/manual', labelEn: 'Manual', labelEs: 'Manual', icon: 'BookOpen' },
    { path: '/search', labelEn: 'Search', labelEs: 'Buscar', icon: 'Search' },
    { path: '/recipes', labelEn: 'Recipes', labelEs: 'Recetas', icon: 'ChefHat' },
    { path: '/dish-guide', labelEn: 'Dish Guide', labelEs: 'Guía de Platos', icon: 'Utensils' },
    { path: '/wines', labelEn: 'Wines', labelEs: 'Vinos', icon: 'Wine' },
    { path: '/cocktails', labelEn: 'Cocktails', labelEs: 'Cócteles', icon: 'Martini' },
    { path: '/beer-liquor', labelEn: 'Beer & Liquor', labelEs: 'Cerveza y Licores', icon: 'Beer' },
    { path: '/forms', labelEn: 'Forms', labelEs: 'Formularios', icon: 'ClipboardList' },
    { path: '/ask', labelEn: 'Ask AI', labelEs: 'Preguntar IA', icon: 'Sparkles' },
    { path: '/admin/reviews', labelEn: 'Reviews', labelEs: 'Reseñas', icon: 'Star' },
    { path: '/admin', labelEn: 'Admin', labelEs: 'Admin', icon: 'Settings' },
  ] as const;

  const navItems = isAdmin ? adminItems : STAFF_NAV_ITEMS;

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50",
        "flex items-center justify-around",
        "h-[72px] pb-safe",
        "bg-background/95 backdrop-blur-md",
        "border-t border-border",
        "md:hidden", // Hide on tablet+
        className
      )}
      role="navigation"
      aria-label={language === 'es' ? 'Navegación principal' : 'Main navigation'}
    >
      {navItems.map((item) => {
        const Icon = iconMap[item.icon as keyof typeof iconMap];
        const isActive = location.pathname === item.path ||
          (item.path !== '/' && location.pathname.startsWith(item.path));
        const label = language === 'es' ? item.labelEs : item.labelEn;

        return (
          <NavLink
            key={item.path}
            to={item.path}
            className={cn(
              "flex flex-col items-center justify-center",
              "min-h-[44px] min-w-[64px] px-3 py-2",
              "rounded-lg transition-colors duration-150",
              "active:scale-[0.98]",
              isActive
                ? "text-[#2aa962]"
                : "text-slate-400 dark:text-slate-500 hover:text-foreground"
            )}
          >
            <span className={cn(
              "flex items-center justify-center rounded-md mb-1 transition-colors duration-150",
              isActive
                ? "w-9 h-9 bg-[#2aa962] text-white"
                : "w-9 h-9"
            )}>
              <Icon className="h-5 w-5" />
            </span>
            <span
              className={cn(
                "text-[11px] font-medium leading-tight",
                isActive && "font-semibold"
              )}
            >
              {label}
            </span>
          </NavLink>
        );
      })}
    </nav>
  );
}
