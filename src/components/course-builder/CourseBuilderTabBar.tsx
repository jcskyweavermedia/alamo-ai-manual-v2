// =============================================================================
// CourseBuilderTabBar — Horizontal tab bar for the course builder center column.
//
// 3 tabs: Elements, Settings, Quiz
// Dispatches SET_ACTIVE_TAB on click. Active tab gets primary highlight.
// Compact design: small icons, text-xs labels, minimal padding.
// Pattern: mirrors form-builder/BuilderTabBar.tsx.
// =============================================================================

import { useCallback } from 'react';
import {
  LayoutGrid,
  Settings,
  HelpCircle,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCourseBuilder } from '@/contexts/CourseBuilderContext';
import type { CourseBuilderTab } from '@/types/course-builder';

// =============================================================================
// TYPES
// =============================================================================

interface CourseBuilderTabBarProps {
  language: 'en' | 'es';
}

interface TabDef {
  key: CourseBuilderTab;
  labelEn: string;
  labelEs: string;
  icon: LucideIcon;
}

// =============================================================================
// TAB DEFINITIONS
// =============================================================================

const TABS: TabDef[] = [
  { key: 'elements', labelEn: 'Elements', labelEs: 'Elementos', icon: LayoutGrid },
  { key: 'settings', labelEn: 'Settings', labelEs: 'Configuraci\u00f3n', icon: Settings },
  { key: 'quiz', labelEn: 'Quiz', labelEs: 'Quiz', icon: HelpCircle },
];

// =============================================================================
// COMPONENT
// =============================================================================

export function CourseBuilderTabBar({ language }: CourseBuilderTabBarProps) {
  const { state, dispatch } = useCourseBuilder();

  const handleTabChange = useCallback(
    (tab: CourseBuilderTab) => {
      dispatch({ type: 'SET_ACTIVE_TAB', payload: tab });
    },
    [dispatch],
  );

  return (
    <nav
      className={cn(
        'flex items-center gap-1',
        'border-b border-black/[0.04] dark:border-white/[0.06]',
        'bg-muted/20',
        'px-3',
      )}
      role="tablist"
      aria-label={language === 'en' ? 'Builder tabs' : 'Pestanas del constructor'}
    >
      {TABS.map((tab) => {
        const isActive = state.activeTab === tab.key;
        const Icon = tab.icon;
        const label = language === 'es' ? tab.labelEs : tab.labelEn;

        return (
          <button
            key={tab.key}
            role="tab"
            aria-selected={isActive}
            onClick={() => handleTabChange(tab.key)}
            className={cn(
              'flex items-center gap-1',
              'px-2.5 py-1.5',
              'text-xs font-medium',
              'rounded-md transition-colors duration-150',
              isActive
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/40',
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        );
      })}
    </nav>
  );
}
