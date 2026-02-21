import * as React from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/* =============================================================================
   MANUAL OUTLINE COMPONENT
   Per docs/design-specs.md:
   - Section tree for navigation
   - Collapsible sections
   - Active state indication
   - Emoji icons in colored square tiles
============================================================================= */

// Emoji map: icon name → { emoji, bg (light), darkBg }
const emojiMap: Record<string, { emoji: string; bg: string; darkBg: string }> = {
  // Top-level sections
  Sparkles:       { emoji: '✨', bg: 'bg-amber-100',  darkBg: 'dark:bg-amber-900/30' },
  Building2:      { emoji: '🏢', bg: 'bg-slate-100',  darkBg: 'dark:bg-slate-800' },
  Heart:          { emoji: '❤️', bg: 'bg-red-100',    darkBg: 'dark:bg-red-900/30' },
  Star:           { emoji: '⭐', bg: 'bg-yellow-100', darkBg: 'dark:bg-yellow-900/30' },
  Clock:          { emoji: '🕐', bg: 'bg-blue-100',   darkBg: 'dark:bg-blue-900/30' },
  Palette:        { emoji: '🎨', bg: 'bg-purple-100', darkBg: 'dark:bg-purple-900/30' },

  // Categories
  Users:          { emoji: '👥', bg: 'bg-indigo-100', darkBg: 'dark:bg-indigo-900/30' },
  ClipboardCheck: { emoji: '📋', bg: 'bg-green-100',  darkBg: 'dark:bg-green-900/30' },
  HandHeart:      { emoji: '🤝', bg: 'bg-pink-100',   darkBg: 'dark:bg-pink-900/30' },
  BookOpen:       { emoji: '📖', bg: 'bg-cyan-100',   darkBg: 'dark:bg-cyan-900/30' },

  // Team Roles children
  UserCheck:      { emoji: '✅', bg: 'bg-green-100',  darkBg: 'dark:bg-green-900/30' },
  ConciergeBell:  { emoji: '🛎️', bg: 'bg-amber-100',  darkBg: 'dark:bg-amber-900/30' },
  Briefcase:      { emoji: '💼', bg: 'bg-slate-100',  darkBg: 'dark:bg-slate-800' },
  ChefHat:        { emoji: '👨‍🍳', bg: 'bg-orange-100', darkBg: 'dark:bg-orange-900/30' },
  Utensils:       { emoji: '🍴', bg: 'bg-red-100',    darkBg: 'dark:bg-red-900/30' },
  Waves:          { emoji: '🧽', bg: 'bg-blue-100',   darkBg: 'dark:bg-blue-900/30' },
  Wine:           { emoji: '🍷', bg: 'bg-rose-100',   darkBg: 'dark:bg-rose-900/30' },
  Shield:         { emoji: '🛡️', bg: 'bg-slate-100',  darkBg: 'dark:bg-slate-800' },

  // Operational Procedures children
  ClipboardList:  { emoji: '📝', bg: 'bg-emerald-100', darkBg: 'dark:bg-emerald-900/30' },
  Sunrise:        { emoji: '🌅', bg: 'bg-orange-100', darkBg: 'dark:bg-orange-900/30' },
  Activity:       { emoji: '📊', bg: 'bg-blue-100',   darkBg: 'dark:bg-blue-900/30' },
  Moon:           { emoji: '🌙', bg: 'bg-indigo-100', darkBg: 'dark:bg-indigo-900/30' },
  Leaf:           { emoji: '🌿', bg: 'bg-green-100',  darkBg: 'dark:bg-green-900/30' },

  // Guest Services children
  HeartHandshake: { emoji: '💛', bg: 'bg-yellow-100', darkBg: 'dark:bg-yellow-900/30' },
  Phone:          { emoji: '📞', bg: 'bg-teal-100',   darkBg: 'dark:bg-teal-900/30' },
  CalendarCheck:  { emoji: '📅', bg: 'bg-violet-100', darkBg: 'dark:bg-violet-900/30' },

  // Appendix children
  LifeBuoy:       { emoji: '🆘', bg: 'bg-red-100',    darkBg: 'dark:bg-red-900/30' },
  HelpCircle:     { emoji: '❓', bg: 'bg-amber-100',  darkBg: 'dark:bg-amber-900/30' },
  BookMarked:     { emoji: '📚', bg: 'bg-cyan-100',   darkBg: 'dark:bg-cyan-900/30' },
  Languages:      { emoji: '🌐', bg: 'bg-blue-100',   darkBg: 'dark:bg-blue-900/30' },
  CheckSquare:    { emoji: '☑️', bg: 'bg-green-100',  darkBg: 'dark:bg-green-900/30' },
  Contact:        { emoji: '📇', bg: 'bg-slate-100',  darkBg: 'dark:bg-slate-800' },
  FileText:       { emoji: '📄', bg: 'bg-slate-100',  darkBg: 'dark:bg-slate-800' },
};

const defaultEmoji = { emoji: '📄', bg: 'bg-slate-100', darkBg: 'dark:bg-slate-800' };

/**
 * Parse icon string - extracts just the icon name (ignores color suffix)
 * Format: "IconName" or "IconName:color"
 */
function getEmoji(iconStr?: string) {
  if (!iconStr) return defaultEmoji;
  const iconName = iconStr.split(":")[0];
  return emojiMap[iconName] || defaultEmoji;
}

export interface ManualSection {
  id: string;
  title: string;
  icon?: string;
  children?: ManualSection[];
}

export interface ManualOutlineProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onSelect"> {
  sections: ManualSection[];
  activeId?: string;
  onSelect?: (sectionId: string) => void;
  defaultExpanded?: string[];
}

const ManualOutline = React.forwardRef<HTMLDivElement, ManualOutlineProps>(
  ({ className, sections, activeId, onSelect, defaultExpanded = [], ...props }, ref) => {
    const [expanded, setExpanded] = React.useState<Set<string>>(
      new Set(defaultExpanded)
    );

    // Update expanded when defaultExpanded changes
    React.useEffect(() => {
      if (defaultExpanded.length > 0) {
        setExpanded(prev => {
          const next = new Set(prev);
          defaultExpanded.forEach(id => next.add(id));
          return next;
        });
      }
    }, [defaultExpanded.join(',')]);

    const toggleExpand = (id: string) => {
      setExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
    };

    const renderSection = (section: ManualSection, depth: number = 0) => {
      const hasChildren = section.children && section.children.length > 0;
      const isExpanded = expanded.has(section.id);
      const isActive = activeId === section.id;

      // Get emoji config for this section
      const emojiConfig = getEmoji(section.icon);

      // Keyboard navigation handler
      const handleKeyDown = (e: React.KeyboardEvent, section: ManualSection) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (hasChildren) {
            toggleExpand(section.id);
          }
          onSelect?.(section.id);
        }
        if (e.key === 'ArrowRight' && hasChildren && !isExpanded) {
          e.preventDefault();
          toggleExpand(section.id);
        }
        if (e.key === 'ArrowLeft' && hasChildren && isExpanded) {
          e.preventDefault();
          toggleExpand(section.id);
        }
      };

      return (
        <div key={section.id} role="treeitem" aria-expanded={hasChildren ? isExpanded : undefined}>
          <button
            type="button"
            onClick={() => {
              if (hasChildren) {
                toggleExpand(section.id);
              }
              onSelect?.(section.id);
            }}
            onKeyDown={(e) => handleKeyDown(e, section)}
            className={cn(
              "flex items-center gap-sm w-full min-h-[44px] px-sm py-xs rounded-lg",
              "text-body text-left transition-colors duration-micro",
              "hover:bg-accent/50",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              isActive && "bg-accent text-primary font-medium",
              !isActive && "text-foreground"
            )}
            style={{ paddingLeft: `${depth * 16 + 8}px` }}
            aria-current={isActive ? 'page' : undefined}
          >
            {/* Chevron for expandable items, or spacer for leaf nodes */}
            {hasChildren ? (
              <span
                className="w-5 h-5 flex items-center justify-center text-muted-foreground shrink-0"
                aria-hidden="true"
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </span>
            ) : (
              <span className="w-5 h-5 flex items-center justify-center shrink-0" aria-hidden="true" />
            )}

            {/* Emoji icon in colored square tile */}
            <span
              className={cn(
                'flex items-center justify-center shrink-0',
                'w-7 h-7 rounded-[8px]',
                emojiConfig.bg,
                emojiConfig.darkBg
              )}
              aria-hidden="true"
            >
              <span className="text-[15px] h-[15px] leading-[15px]">{emojiConfig.emoji}</span>
            </span>

            <span className="flex-1 line-clamp-2 leading-snug">{section.title}</span>
          </button>

          {hasChildren && isExpanded && (
            <div className="mt-xs" role="group">
              {section.children!.map((child) => renderSection(child, depth + 1))}
            </div>
          )}
        </div>
      );
    };

    return (
      <nav
        ref={ref}
        className={cn("space-y-xs", className)}
        aria-label="Manual sections"
        role="tree"
        {...props}
      >
        {sections.map((section) => renderSection(section))}
      </nav>
    );
  }
);
ManualOutline.displayName = "ManualOutline";

export { ManualOutline };
