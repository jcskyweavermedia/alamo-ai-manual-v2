import { NavLink, useLocation } from 'react-router-dom';
import { BookOpen, Search, Sparkles, User, Settings, ChefHat, Utensils, Wine, Martini, Beer, ConciergeBell, GraduationCap, ClipboardList } from 'lucide-react';
import { cn } from '@/lib/utils';
import { STAFF_NAV_ITEMS } from '@/lib/constants';

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
} as const;

interface MobileTabBarProps {
  isAdmin?: boolean;
  className?: string;
}

export function MobileTabBar({ isAdmin = false, className }: MobileTabBarProps) {
  const location = useLocation();
  
  // Use admin nav if admin, otherwise staff nav
  const navItems = isAdmin
    ? [
        { path: '/manual', label: 'Manual', icon: 'BookOpen' },
        { path: '/search', label: 'Search', icon: 'Search' },
        { path: '/recipes', label: 'Recipes', icon: 'ChefHat' },
        { path: '/dish-guide', label: 'Dish Guide', icon: 'Utensils' },
        { path: '/wines', label: 'Wines', icon: 'Wine' },
        { path: '/cocktails', label: 'Cocktails', icon: 'Martini' },
        { path: '/beer-liquor', label: 'Beer & Liquor', icon: 'Beer' },
        { path: '/forms', label: 'Forms', icon: 'ClipboardList' },
        { path: '/ask', label: 'Ask AI', icon: 'Sparkles' },
        { path: '/admin', label: 'Admin', icon: 'Settings' },
      ]
    : STAFF_NAV_ITEMS;

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
      aria-label="Main navigation"
    >
      {navItems.map((item) => {
        const Icon = iconMap[item.icon as keyof typeof iconMap];
        const isActive = location.pathname === item.path || 
          (item.path !== '/' && location.pathname.startsWith(item.path));
        
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
              {item.label}
            </span>
          </NavLink>
        );
      })}
    </nav>
  );
}
