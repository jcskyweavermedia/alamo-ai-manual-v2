import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ChevronRight, ChevronDown } from 'lucide-react';
import * as Collapsible from '@radix-ui/react-collapsible';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { type NavGroup, getLabel } from '@/lib/nav-config';
import type { Language } from '@/hooks/use-language';

interface SidebarNavGroupProps {
  group: NavGroup;
  language: Language;
  // Expanded (w-60) sidebar: section collapse state
  expanded: boolean;
  onToggle: () => void;
  sidebarCollapsed: boolean;
  // Collapsed (w-16) sidebar: whether multi-child group shows all icons or compact button
  iconExpanded: boolean;
  onToggleIcon: () => void;
}

export function SidebarNavGroup({
  group,
  language,
  expanded,
  onToggle,
  sidebarCollapsed,
  iconExpanded,
  onToggleIcon,
}: SidebarNavGroupProps) {
  const location = useLocation();
  const isSingle = group.children.length === 1;

  const isChildActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + '/');

  const anyChildActive = group.children.some(c => isChildActive(c.path));

  // ── COLLAPSED sidebar (w-16) ──────────────────────────────────────────────
  if (sidebarCollapsed) {
    // Single-child: always show tiny label + icon (nothing to compact)
    if (isSingle) {
      const child = group.children[0];
      const ChildIcon = child.icon;
      const isActive = isChildActive(child.path);
      return (
        <>
          <div className="flex items-center justify-center pt-3 pb-0.5">
            <span className="text-[8px] font-bold uppercase tracking-[0.1em] text-muted-foreground/50 select-none">
              {getLabel(group, language)}
            </span>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <NavLink
                to={child.path}
                className={cn(
                  'flex items-center justify-center min-h-[44px] rounded-lg',
                  'transition-colors duration-150 active:scale-[0.98]',
                  isActive
                    ? 'text-[#2aa962]'
                    : 'text-slate-400 dark:text-slate-500 hover:text-foreground',
                )}
              >
                <span className={cn(
                  'flex items-center justify-center shrink-0 rounded-md w-9 h-9 transition-colors duration-150',
                  isActive && 'bg-[#2aa962] text-white',
                )}>
                  <ChildIcon className="h-5 w-5" />
                </span>
              </NavLink>
            </TooltipTrigger>
            <TooltipContent side="right">{getLabel(child, language)}</TooltipContent>
          </Tooltip>
        </>
      );
    }

    // Multi-child COMPACT: single button that shows group label + chevron
    if (!iconExpanded) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onToggleIcon}
              className={cn(
                'flex items-center justify-center gap-1 w-full min-h-[40px] rounded-lg px-1',
                'transition-colors duration-150 active:scale-[0.98]',
                anyChildActive
                  ? 'text-[#2aa962]'
                  : 'text-slate-400 dark:text-slate-500 hover:text-foreground hover:bg-accent/50',
              )}
            >
              <span className="text-[8px] font-bold uppercase tracking-[0.1em] select-none">
                {getLabel(group, language)}
              </span>
              <ChevronRight className="h-2.5 w-2.5 shrink-0" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {language === 'es' ? 'Expandir' : 'Expand'} {getLabel(group, language)}
          </TooltipContent>
        </Tooltip>
      );
    }

    // Multi-child EXPANDED: tiny label (with collapse chevron) + all icons
    return (
      <>
        <button
          type="button"
          onClick={onToggleIcon}
          className={cn(
            'flex items-center justify-center gap-1 w-full pt-3 pb-0.5',
            'group transition-colors duration-150',
          )}
        >
          <span className="text-[8px] font-bold uppercase tracking-[0.1em] text-muted-foreground/50 select-none group-hover:text-muted-foreground/80 transition-colors">
            {getLabel(group, language)}
          </span>
          <ChevronDown className="h-2.5 w-2.5 shrink-0 text-muted-foreground/40 group-hover:text-muted-foreground/70 transition-colors" />
        </button>
        {group.children.map(child => {
          const ChildIcon = child.icon;
          const isActive = isChildActive(child.path);
          return (
            <Tooltip key={child.path}>
              <TooltipTrigger asChild>
                <NavLink
                  to={child.path}
                  className={cn(
                    'flex items-center justify-center min-h-[44px] rounded-lg',
                    'transition-colors duration-150 active:scale-[0.98]',
                    isActive
                      ? 'text-[#2aa962]'
                      : 'text-slate-400 dark:text-slate-500 hover:text-foreground',
                  )}
                >
                  <span className={cn(
                    'flex items-center justify-center shrink-0 rounded-md w-9 h-9 transition-colors duration-150',
                    isActive && 'bg-[#2aa962] text-white',
                  )}>
                    <ChildIcon className="h-5 w-5" />
                  </span>
                </NavLink>
              </TooltipTrigger>
              <TooltipContent side="right">{getLabel(child, language)}</TooltipContent>
            </Tooltip>
          );
        })}
      </>
    );
  }

  // ── EXPANDED sidebar (w-60) ───────────────────────────────────────────────

  // Single-child: section label (no chevron) + the one item
  if (isSingle) {
    const child = group.children[0];
    const ChildIcon = child.icon;
    const isActive = isChildActive(child.path);
    return (
      <>
        <div className="flex items-center gap-2 px-3 pt-4 pb-1 select-none">
          <span className="font-bold uppercase text-[10px] tracking-[0.12em] text-muted-foreground/60 shrink-0">
            {getLabel(group, language)}
          </span>
          <div className="flex-1 border-t border-border/40 ml-0.5" />
        </div>
        <NavLink
          to={child.path}
          className={cn(
            'flex items-center gap-3 min-h-[44px] px-3 rounded-lg',
            'text-sm transition-colors duration-150 active:scale-[0.98]',
            isActive
              ? 'text-[#2aa962] font-medium'
              : 'text-slate-400 dark:text-slate-500 hover:text-foreground',
          )}
        >
          <span className={cn(
            'flex items-center justify-center shrink-0 rounded-md w-9 h-9 transition-colors duration-150',
            isActive && 'bg-[#2aa962] text-white',
          )}>
            <ChildIcon className="h-5 w-5" />
          </span>
          {getLabel(child, language)}
        </NavLink>
      </>
    );
  }

  // Multi-child: collapsible section divider + children
  return (
    <Collapsible.Root open={expanded} onOpenChange={onToggle}>
      <Collapsible.Trigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 w-full px-3 pt-4 pb-1 group select-none"
        >
          <span className="font-bold uppercase text-[10px] tracking-[0.12em] text-muted-foreground/60 shrink-0 group-hover:text-muted-foreground/80 transition-colors">
            {getLabel(group, language)}
          </span>
          <ChevronRight className={cn(
            'h-3 w-3 text-muted-foreground/50 shrink-0 transition-transform duration-200',
            'group-hover:text-muted-foreground/80',
            expanded && 'rotate-90',
          )} />
          <div className="flex-1 border-t border-border/40 ml-0.5" />
        </button>
      </Collapsible.Trigger>

      <Collapsible.Content className="overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
        <div className="space-y-0.5 pb-1">
          {group.children.map(child => {
            const ChildIcon = child.icon;
            const isActive = isChildActive(child.path);
            return (
              <NavLink
                key={child.path}
                to={child.path}
                className={cn(
                  'flex items-center gap-3 min-h-[44px] px-3 rounded-lg',
                  'text-sm transition-colors duration-150 active:scale-[0.98]',
                  isActive
                    ? 'text-[#2aa962] font-medium'
                    : 'text-slate-400 dark:text-slate-500 hover:text-foreground',
                )}
              >
                <span className={cn(
                  'flex items-center justify-center shrink-0 rounded-md w-9 h-9 transition-colors duration-150',
                  isActive && 'bg-[#2aa962] text-white',
                )}>
                  <ChildIcon className="h-5 w-5" />
                </span>
                {getLabel(child, language)}
              </NavLink>
            );
          })}
        </div>
      </Collapsible.Content>
    </Collapsible.Root>
  );
}
