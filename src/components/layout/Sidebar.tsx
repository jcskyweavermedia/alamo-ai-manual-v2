import { NavLink, useLocation } from 'react-router-dom';
import { BookOpen, Search, Sparkles, User, Settings, ChefHat, Utensils, Wine, Martini, Beer } from 'lucide-react';
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
} as const;

interface SidebarProps {
  isAdmin?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  className?: string;
}

export function Sidebar({ 
  isAdmin = false, 
  collapsed = false,
  onToggleCollapse,
  className 
}: SidebarProps) {
  const location = useLocation();
  
  const navItems = isAdmin
    ? [
        { path: '/manual', label: 'Manual', icon: 'BookOpen' },
        { path: '/search', label: 'Search', icon: 'Search' },
        { path: '/recipes', label: 'Recipes', icon: 'ChefHat' },
        { path: '/dish-guide', label: 'Dish Guide', icon: 'Utensils' },
        { path: '/wines', label: 'Wines', icon: 'Wine' },
        { path: '/cocktails', label: 'Cocktails', icon: 'Martini' },
        { path: '/beer-liquor', label: 'Beer & Liquor', icon: 'Beer' },
        { path: '/ask', label: 'Ask AI', icon: 'Sparkles' },
        { path: '/admin', label: 'Admin', icon: 'Settings' },
      ]
    : STAFF_NAV_ITEMS;

  // Group items: main navigation vs profile/admin
  const mainItems = navItems.filter(item => 
    !['/profile', '/admin'].includes(item.path)
  );
  const secondaryItems = navItems.filter(item => 
    ['/profile', '/admin'].includes(item.path)
  );

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col",
        "h-screen sticky top-0",
        "bg-card border-r border-border",
        "transition-all duration-230",
        collapsed ? "w-16" : "w-60",
        className
      )}
    >
      {/* Logo/Brand */}
      <div className={cn(
        "flex items-center h-14 px-4 border-b border-border overflow-hidden",
        collapsed ? "justify-center" : "justify-start"
      )}>
        {/* Full name - fades out when collapsing */}
        <span 
          className={cn(
            "text-lg font-semibold text-foreground whitespace-nowrap transition-all duration-300",
            collapsed 
              ? "opacity-0 w-0 scale-95" 
              : "opacity-100 w-auto scale-100"
          )}
        >
          Alamo Prime
        </span>
        
        {/* Abbreviation - fades in when collapsed */}
        <span 
          className={cn(
            "text-lg font-bold text-primary absolute transition-all duration-300",
            collapsed 
              ? "opacity-100 scale-100" 
              : "opacity-0 scale-95"
          )}
        >
          AP
        </span>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 py-4 px-2 space-y-1">
        {mainItems.map((item) => {
          const Icon = iconMap[item.icon as keyof typeof iconMap];
          const isActive = location.pathname === item.path || 
            (item.path !== '/' && location.pathname.startsWith(item.path));
          
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3",
                "min-h-[44px] px-3 rounded-lg",
                "transition-colors duration-150",
                "active:scale-[0.98]",
                collapsed && "justify-center px-0",
                isActive 
                  ? "bg-primary/10 text-primary font-medium" 
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon className={cn(
                "h-5 w-5 shrink-0",
                isActive && "stroke-[2.5px]"
              )} />
              {!collapsed && (
                <span className="text-sm">{item.label}</span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Divider */}
      <div className="mx-4 border-t border-border" />

      {/* Secondary Navigation (Profile/Admin) */}
      <nav className="py-4 px-2 space-y-1">
        {secondaryItems.map((item) => {
          const Icon = iconMap[item.icon as keyof typeof iconMap];
          const isActive = location.pathname === item.path;
          
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3",
                "min-h-[44px] px-3 rounded-lg",
                "transition-colors duration-150",
                "active:scale-[0.98]",
                collapsed && "justify-center px-0",
                isActive 
                  ? "bg-primary/10 text-primary font-medium" 
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon className={cn(
                "h-5 w-5 shrink-0",
                isActive && "stroke-[2.5px]"
              )} />
              {!collapsed && (
                <span className="text-sm">{item.label}</span>
              )}
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}
