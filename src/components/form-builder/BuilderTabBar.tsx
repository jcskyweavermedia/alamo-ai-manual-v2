// =============================================================================
// BuilderTabBar — Tab navigation for the builder's main panel
//
// Desktop (>= 1024px): 4 tabs — Fields, Instructions, AI Tools, Settings
// Mobile (< 1024px):   3 tabs — Fields, Settings, Preview
//
// Dispatches SET_ACTIVE_TAB on tab change.
// Active tab highlighted with primary color underline (desktop)
// or segmented control highlight (mobile).
// =============================================================================

import { useCallback } from 'react';
import {
  ListPlus,
  FileText,
  Sparkles,
  Settings,
  Eye,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBuilder } from '@/contexts/BuilderContext';
import type { BuilderTab, BuilderTabBarProps } from '@/types/form-builder';

// =============================================================================
// TAB DEFINITIONS
// =============================================================================

interface TabDef {
  key: BuilderTab;
  labelEn: string;
  labelEs: string;
  icon: LucideIcon;
}

/** Desktop tabs: all 4 builder tabs */
const DESKTOP_TABS: TabDef[] = [
  { key: 'fields', labelEn: 'Fields', labelEs: 'Campos', icon: ListPlus },
  { key: 'instructions', labelEn: 'Instructions', labelEs: 'Instrucciones', icon: FileText },
  { key: 'ai-tools', labelEn: 'AI Tools', labelEs: 'Herramientas IA', icon: Sparkles },
  { key: 'settings', labelEn: 'Settings', labelEs: 'Ajustes', icon: Settings },
];

/** Mobile tabs: simplified 3-tab view (instructions & ai-tools fold into settings) */
const MOBILE_TABS: TabDef[] = [
  { key: 'fields', labelEn: 'Fields', labelEs: 'Campos', icon: ListPlus },
  { key: 'settings', labelEn: 'Settings', labelEs: 'Ajustes', icon: Settings },
  { key: 'preview', labelEn: 'Preview', labelEs: 'Vista previa', icon: Eye },
];

// =============================================================================
// COMPONENT
// =============================================================================

export function BuilderTabBar({ language }: BuilderTabBarProps) {
  const { state, dispatch } = useBuilder();

  const handleTabChange = useCallback(
    (tab: BuilderTab) => {
      dispatch({ type: 'SET_ACTIVE_TAB', payload: tab });
    },
    [dispatch],
  );

  return (
    <>
      {/* ---- DESKTOP: Underline tabs (>= 1024px) ---- */}
      <nav
        className={cn(
          'hidden lg:flex',
          'border-b border-black/[0.04] dark:border-white/[0.06]',
          'bg-muted/20',
          'px-4',
        )}
        role="tablist"
        aria-label={language === 'en' ? 'Builder sections' : 'Secciones del constructor'}
      >
        {DESKTOP_TABS.map(tab => {
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
                'flex items-center gap-1.5',
                'px-3 py-2.5',
                'text-sm font-medium',
                'border-b-2 transition-colors duration-150',
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30',
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          );
        })}
      </nav>

      {/* ---- MOBILE: Segmented control (< 1024px) ---- */}
      <div
        className={cn(
          'lg:hidden',
          'flex rounded-lg bg-muted/50 p-0.5 mx-3 mt-3 mb-2',
        )}
        role="tablist"
        aria-label={language === 'en' ? 'Builder sections' : 'Secciones del constructor'}
      >
        {MOBILE_TABS.map(tab => {
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
                'flex-1 flex items-center justify-center gap-1.5',
                'px-3 py-2 text-xs font-semibold',
                'rounded-md transition-colors duration-150',
                isActive
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          );
        })}
      </div>
    </>
  );
}
