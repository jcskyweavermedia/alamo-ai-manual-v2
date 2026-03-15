// =============================================================================
// SectionTOCSheet — Mobile bottom drawer for section navigation (TOC).
//
// Shows all course sections with progress indicators:
//   - Completed: green CheckCircle2 icon
//   - Active: orange dot + semibold title + subtle highlight
//   - Future: gray dot + normal title
//
// Uses Vaul Drawer for native-feeling mobile sheet behavior.
// =============================================================================

import { CheckCircle2 } from 'lucide-react';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';

// =============================================================================
// BILINGUAL STRINGS
// =============================================================================

const STRINGS = {
  en: { title: 'Sections' },
  es: { title: 'Secciones' },
} as const;

// =============================================================================
// TYPES
// =============================================================================

interface SectionTOCSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sections: Array<{
    id: string;
    title_en: string;
    title_es: string;
    sort_order: number;
  }>;
  activeSectionIndex: number;
  sectionProgressMap: Map<string, { status: string }>;
  language: 'en' | 'es';
  onSelectSection: (index: number) => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function SectionTOCSheet({
  open,
  onOpenChange,
  sections,
  activeSectionIndex,
  sectionProgressMap,
  language,
  onSelectSection,
}: SectionTOCSheetProps) {
  const t = STRINGS[language];

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader>
          <DrawerTitle>{t.title}</DrawerTitle>
          <DrawerDescription className="sr-only">Navigate between course sections</DrawerDescription>
        </DrawerHeader>

        <div className="overflow-y-auto px-2 pb-6">
          {sections.map((section, index) => {
            const progress = sectionProgressMap.get(section.id);
            const isCompleted = progress?.status === 'completed';
            const isActive = index === activeSectionIndex;
            const title =
              language === 'es' && section.title_es
                ? section.title_es
                : section.title_en;

            return (
              <button
                key={section.id}
                type="button"
                onClick={() => {
                  onSelectSection(index);
                  onOpenChange(false);
                }}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-xl transition-colors
                  w-full text-left
                  ${isActive ? 'bg-primary/5' : 'hover:bg-muted/60'}
                `}
              >
                {/* Status indicator */}
                {isCompleted ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-green-500" />
                ) : isActive ? (
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500 shrink-0" />
                ) : (
                  <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/30 shrink-0" />
                )}

                {/* Section title */}
                <span
                  className={`
                    text-sm leading-snug
                    ${isActive ? 'font-semibold text-foreground' : 'font-normal text-foreground/80'}
                    ${isCompleted ? 'text-foreground/70' : ''}
                  `}
                >
                  {title}
                </span>
              </button>
            );
          })}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
