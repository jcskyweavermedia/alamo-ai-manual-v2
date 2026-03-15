// =============================================================================
// GrowthPathsCard -- 4-tier growth path visualization
// =============================================================================

import {
  Route,
  Utensils,
  DoorOpen,
  ShieldAlert,
  Wine,
  Beef,
  Flame,
  Star,
  Award,
  GraduationCap,
  BookOpen,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GrowthTier } from '@/types/admin-panel';
import { ADMIN_STRINGS } from '../strings';

// ---------------------------------------------------------------------------
// Icon map
// ---------------------------------------------------------------------------

const ICON_MAP: Record<string, LucideIcon> = {
  Utensils,
  DoorOpen,
  ShieldAlert,
  Wine,
  Beef,
  Flame,
  Star,
  Award,
  GraduationCap,
  BookOpen,
};

// ---------------------------------------------------------------------------
// Color theme config
// ---------------------------------------------------------------------------

const THEME_STYLES: Record<
  GrowthTier['colorTheme'],
  {
    border: string;
    bg: string;
    badgeBg: string;
    labelColor: string;
    courseBg: string;
  }
> = {
  blue: {
    border: 'border-blue-300 dark:border-blue-500/30',
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    badgeBg: 'bg-blue-500',
    labelColor: 'text-blue-600 dark:text-blue-400',
    courseBg: 'bg-white dark:bg-blue-950/50',
  },
  purple: {
    border: 'border-purple-300 dark:border-purple-500/30',
    bg: 'bg-purple-50 dark:bg-purple-950/30',
    badgeBg: 'bg-purple-500',
    labelColor: 'text-purple-600 dark:text-purple-400',
    courseBg: 'bg-white dark:bg-purple-950/50',
  },
  green: {
    border: 'border-green-300 dark:border-green-500/30',
    bg: 'bg-green-50 dark:bg-green-950/30',
    badgeBg: 'bg-green-600',
    labelColor: 'text-green-600 dark:text-green-400',
    courseBg: 'bg-white dark:bg-green-950/50',
  },
  amber: {
    border: 'border-amber-300 dark:border-amber-500/30',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    badgeBg: 'bg-amber-500',
    labelColor: 'text-amber-600 dark:text-amber-400',
    courseBg: 'bg-white dark:bg-amber-950/50',
  },
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface GrowthPathsCardProps {
  tiers: GrowthTier[];
  language: 'en' | 'es';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GrowthPathsCard({ tiers, language }: GrowthPathsCardProps) {
  const t = ADMIN_STRINGS[language];

  return (
    <div className="bg-card rounded-2xl border border-black/[0.04] dark:border-white/[0.06] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div className="flex items-center gap-2">
          <Route className="h-4 w-4 text-blue-500" />
          <h3 className="font-semibold text-sm">{t.growthPaths}</h3>
        </div>
        <span className="text-xs text-muted-foreground">{t.aiManagedProgression}</span>
      </div>

      {/* Tier cards */}
      <div className="px-4 pb-4 space-y-3">
        {tiers.map((tier) => {
          const style = THEME_STYLES[tier.colorTheme];

          return (
            <div
              key={tier.id}
              className={cn(
                'p-4 rounded-2xl border',
                style.border,
                style.bg,
              )}
            >
              {/* Range badge + label */}
              <div className="flex items-center gap-2 mb-2">
                <span
                  className={cn(
                    'text-xs font-bold px-2 py-0.5 rounded-full text-white',
                    style.badgeBg,
                  )}
                >
                  {tier.range}
                </span>
                <span className={cn('text-xs font-semibold', style.labelColor)}>
                  {tier.label}
                </span>
              </div>

              {/* 2-column course grid */}
              <div className="grid grid-cols-2 gap-1.5 mb-2">
                {tier.courses.map((course, i) => {
                  const CourseIcon = ICON_MAP[course.icon] ?? BookOpen;
                  return (
                    <div
                      key={i}
                      className={cn(
                        'flex items-center gap-1.5 text-xs p-1.5 rounded-lg',
                        style.courseBg,
                      )}
                    >
                      <CourseIcon className={cn('h-3 w-3', course.iconColor)} />
                      {course.name}
                    </div>
                  );
                })}
              </div>

              {/* Employee count */}
              <div className="text-xs text-muted-foreground">
                <strong className="text-foreground">{tier.employeeCount} {t.employees}</strong>{' '}
                {t.currentlyInTier}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
