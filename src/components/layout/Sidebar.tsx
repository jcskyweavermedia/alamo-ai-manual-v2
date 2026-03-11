import React, { useRef, useCallback, useEffect, useState, useReducer } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { PanelLeft, PanelLeftClose } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { SidebarNavGroup } from './SidebarNavGroup';
import {
  NAV_STANDALONE_TOP,
  NAV_STANDALONE_BOTTOM,
  NAV_GROUPS,
  getVisibleGroups,
  getLabel,
  type NavGroupId,
  type NavStandalone,
} from '@/lib/nav-config';
import { useLanguage } from '@/hooks/use-language';

const ANIMATION_MS = 220;

interface SidebarProps {
  isAdmin?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  isGroupExpanded: (id: NavGroupId) => boolean;
  onToggleGroup: (id: NavGroupId) => void;
  getOldestOpenGroup: (excludeId?: NavGroupId) => NavGroupId | null;
  className?: string;
}

export function Sidebar({
  isAdmin = false,
  collapsed = false,
  onToggleCollapse,
  isGroupExpanded,
  onToggleGroup,
  getOldestOpenGroup,
  className,
}: SidebarProps) {
  const location = useLocation();
  const { language } = useLanguage();
  const visibleGroups = getVisibleGroups(NAV_GROUPS, isAdmin);
  const navRef = useRef<HTMLDivElement>(null);
  const collapseTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const isAutoCollapsingRef = useRef(false);

  // ── Icon-group state for w-16 collapsed mode (purely responsive, not persisted) ──
  // When a multi-child group's icons won't fit, it collapses to a single compact button.
  // `undefined` / missing = expanded (default); `false` = compacted.
  const [iconGroupsExpanded, setIconGroupsExpanded] = useState<Partial<Record<NavGroupId, boolean>>>({});
  // Counter incremented by ResizeObserver to trigger the overflow effect without
  // touching iconGroupsExpanded (prevents the nudge-loop).
  const [resizeTick, bumpResizeTick] = useReducer((n: number) => n + 1, 0);

  const isIconGroupExpanded = useCallback(
    (id: NavGroupId) => iconGroupsExpanded[id] !== false,
    [iconGroupsExpanded],
  );

  const toggleIconGroup = useCallback((id: NavGroupId) => {
    setIconGroupsExpanded(prev => ({ ...prev, [id]: prev[id] === false }));
  }, []);

  // Reset icon groups to fully expanded whenever the user re-enters collapsed mode
  useEffect(() => {
    if (!collapsed) setIconGroupsExpanded({});
  }, [collapsed]);

  // ── Overflow detection for w-16 mode ──────────────────────────────────────
  // Compact-only: never auto-expand (expanding would immediately overflow again → flicker).
  // Runs when entering collapsed mode, on window resize (resizeTick), or after the user
  // manually expands a compact button (iconGroupsExpanded changes to a more-expanded state).
  // Uses one-shot compaction of ALL overflowing multi-child groups so no cascade is needed.
  useEffect(() => {
    if (!collapsed) return;
    const timer = setTimeout(() => {
      const nav = navRef.current;
      if (!nav || nav.scrollHeight <= nav.clientHeight) return;

      setIconGroupsExpanded(prev => {
        const next = { ...prev };
        let changed = false;
        // Compact all still-expanded multi-child groups in largest-first order until fits.
        // We do all in one pass so no cascading re-renders are needed.
        visibleGroups
          .filter(g => g.children.length > 1 && prev[g.id] !== false)
          .sort((a, b) => b.children.length - a.children.length)
          .forEach(g => { next[g.id] = false; changed = true; });
        return changed ? next : prev;
      });
    }, 16);

    return () => clearTimeout(timer);
  // resizeTick: incremented by ResizeObserver (safe, doesn't create a reference loop).
  // iconGroupsExpanded: re-check after user manually expands a compact group.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collapsed, resizeTick, iconGroupsExpanded, visibleGroups]);

  // ── Overflow detection for w-60 expanded mode (section collapse) ──────────
  const collapseIfOverflow = useCallback(
    (excludeId?: NavGroupId) => {
      const nav = navRef.current;
      if (!nav || isAutoCollapsingRef.current) return;
      if (nav.scrollHeight <= nav.clientHeight) return;

      const oldest = getOldestOpenGroup(excludeId);
      if (!oldest) return;

      isAutoCollapsingRef.current = true;
      onToggleGroup(oldest);
      setTimeout(() => { isAutoCollapsingRef.current = false; }, ANIMATION_MS + 50);
    },
    [getOldestOpenGroup, onToggleGroup],
  );

  const handleToggleGroup = useCallback(
    (id: NavGroupId) => {
      const isExpanding = !isGroupExpanded(id);
      onToggleGroup(id);
      if (isExpanding) {
        clearTimeout(collapseTimerRef.current);
        collapseTimerRef.current = setTimeout(() => collapseIfOverflow(id), ANIMATION_MS);
      }
    },
    [isGroupExpanded, onToggleGroup, collapseIfOverflow],
  );

  // ResizeObserver: handles window resize for BOTH modes
  const collapsedRef = useRef(collapsed);
  useEffect(() => { collapsedRef.current = collapsed; }, [collapsed]);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    const observer = new ResizeObserver(() => {
      if (collapsedRef.current) {
        // Increment the resize counter — triggers the overflow effect without
        // touching iconGroupsExpanded (the nudge pattern caused the flicker).
        bumpResizeTick();
      } else {
        collapseIfOverflow();
      }
    });

    observer.observe(nav);
    return () => observer.disconnect();
  }, [collapseIfOverflow]);

  useEffect(() => () => clearTimeout(collapseTimerRef.current), []);

  // ── Standalone nav item (Manual, Profile) ────────────────────────────────
  const renderStandalone = (item: NavStandalone) => {
    const Icon = item.icon;
    const isActive =
      location.pathname === item.path ||
      (item.path !== '/' && location.pathname.startsWith(item.path));

    const link = (
      <NavLink
        key={item.path}
        to={item.path}
        className={cn(
          'flex items-center gap-3 min-h-[44px] px-3 rounded-lg',
          'transition-colors duration-150 active:scale-[0.98]',
          collapsed && 'justify-center px-0',
          isActive
            ? 'text-[#2aa962] font-medium'
            : 'text-slate-400 dark:text-slate-500 hover:text-foreground',
        )}
      >
        <span className={cn(
          'flex items-center justify-center shrink-0 rounded-md w-9 h-9 transition-colors duration-150',
          isActive && 'bg-[#2aa962] text-white',
        )}>
          <Icon className="h-5 w-5" />
        </span>
        {!collapsed && <span className="text-sm">{getLabel(item, language)}</span>}
      </NavLink>
    );

    if (collapsed) {
      return (
        <Tooltip key={item.path}>
          <TooltipTrigger asChild>{link}</TooltipTrigger>
          <TooltipContent side="right">{getLabel(item, language)}</TooltipContent>
        </Tooltip>
      );
    }

    return link;
  };

  return (
    <aside className={cn(
      'hidden md:flex flex-col',
      'h-screen sticky top-0',
      'bg-card border-r border-border',
      'transition-all duration-230',
      collapsed ? 'w-16' : 'w-60',
      className,
    )}>
      {/* Brand */}
      <div className={cn(
        'flex items-center h-14 px-4 overflow-hidden shrink-0',
        collapsed ? 'justify-center' : 'justify-start gap-2.5',
      )}>
        <img src="/images/tastly-isotope.svg" alt="Tastly" className="w-7 h-7 shrink-0" />
        <span className={cn(
          "font-bold text-foreground whitespace-nowrap transition-all duration-300",
          "font-['Inter',sans-serif] text-lg",
          collapsed ? 'opacity-0 w-0 scale-95' : 'opacity-100 w-auto scale-100',
        )}>
          Tastly AI
        </span>
      </div>

      {/* Collapse / Expand toggle */}
      <div className="px-2 pt-2 pb-1 shrink-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onToggleCollapse}
              className={cn(
                'flex items-center w-full min-h-[40px] rounded-lg',
                'text-slate-400 dark:text-slate-500 hover:text-foreground hover:bg-accent/50',
                'transition-colors duration-150 active:scale-[0.98]',
                collapsed ? 'justify-center px-0' : 'gap-3 px-3',
              )}
            >
              <span className="flex items-center justify-center shrink-0 w-9 h-9">
                {collapsed ? <PanelLeft className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
              </span>
              {!collapsed && <span className="text-sm">{language === 'es' ? 'Contraer' : 'Collapse'}</span>}
            </button>
          </TooltipTrigger>
          {collapsed && <TooltipContent side="right">{language === 'es' ? 'Expandir barra lateral' : 'Expand sidebar'}</TooltipContent>}
        </Tooltip>
      </div>

      {/* Main navigation — measured for overflow */}
      <div ref={navRef} className="flex-1 min-h-0 overflow-hidden py-2 px-2">
        <nav className="space-y-0.5">
          {renderStandalone(NAV_STANDALONE_TOP)}

          {visibleGroups.map(group => (
            <SidebarNavGroup
              key={group.id}
              group={group}
              language={language}
              expanded={isGroupExpanded(group.id)}
              onToggle={() => handleToggleGroup(group.id)}
              sidebarCollapsed={collapsed}
              iconExpanded={isIconGroupExpanded(group.id)}
              onToggleIcon={() => toggleIconGroup(group.id)}
            />
          ))}
        </nav>
      </div>

      {/* Profile — pinned to bottom */}
      <nav className="py-2 px-2 shrink-0">
        {renderStandalone(NAV_STANDALONE_BOTTOM)}
      </nav>
    </aside>
  );
}
