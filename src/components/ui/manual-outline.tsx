import * as React from "react";
import { 
  ChevronRight, 
  ChevronDown, 
  FileText,
  // Top-level category icons
  Sparkles,
  Building2,
  Heart,
  Star,
  Clock,
  Users,
  ClipboardCheck,
  HandHeart,
  Palette,
  BookOpen,
  // Child section icons
  UserCheck,
  ConciergeBell,
  Briefcase,
  ChefHat,
  Utensils,
  Waves,
  Wine,
  Shield,
  ClipboardList,
  Sunrise,
  Activity,
  Moon,
  Leaf,
  HeartHandshake,
  Phone,
  CalendarCheck,
  LifeBuoy,
  HelpCircle,
  BookMarked,
  Languages,
  CheckSquare,
  Contact,
  type LucideIcon
} from "lucide-react";
import { cn } from "@/lib/utils";

/* =============================================================================
   MANUAL OUTLINE COMPONENT
   Per docs/design-specs.md:
   - Section tree for navigation
   - Collapsible sections
   - Active state indication
   - Icon rendering for all sections (single accent color per design system)
============================================================================= */

// Icon map for all section icons
const iconMap: Record<string, LucideIcon> = {
  // Top-level
  Sparkles,
  Building2,
  Heart,
  Star,
  Clock,
  Users,
  ClipboardCheck,
  HandHeart,
  Palette,
  BookOpen,
  FileText,
  // Child sections
  UserCheck,
  ConciergeBell,
  Briefcase,
  ChefHat,
  Utensils,
  Waves,
  Wine,
  Shield,
  ClipboardList,
  Sunrise,
  Activity,
  Moon,
  Leaf,
  HeartHandshake,
  Phone,
  CalendarCheck,
  LifeBuoy,
  HelpCircle,
  BookMarked,
  Languages,
  CheckSquare,
  Contact,
};

/**
 * Parse icon string - extracts just the icon name (ignores color suffix for now)
 * Format: "IconName" or "IconName:color" (color is ignored, using design system)
 */
function getIcon(iconStr?: string): LucideIcon | null {
  if (!iconStr) return null;
  const iconName = iconStr.split(":")[0];
  return iconMap[iconName] || null;
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
      
      // Get icon component for any section with an icon defined
      const IconComponent = getIcon(section.icon);

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
              "flex items-start gap-sm w-full min-h-[44px] px-sm py-xs rounded-lg",
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
                className="w-5 h-5 mt-0.5 flex items-center justify-center text-muted-foreground shrink-0"
                aria-hidden="true"
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </span>
            ) : (
              <span className="w-5 h-5 mt-0.5 flex items-center justify-center shrink-0" aria-hidden="true">
                {/* Empty spacer for alignment when section has its own icon */}
              </span>
            )}

            {/* Section icon - uses primary accent color */}
            {IconComponent ? (
              <IconComponent
                className="w-4 h-4 mt-0.5 shrink-0 text-primary"
                aria-hidden="true"
              />
            ) : (
              /* Fallback to FileText for sections without icons */
              <FileText
                className={cn(
                  "w-4 h-4 mt-0.5 shrink-0",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
                aria-hidden="true"
              />
            )}
            
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
