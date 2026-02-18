import { useState, useMemo } from 'react';
import { List, X, ChevronDown } from 'lucide-react';
import * as Collapsible from '@radix-ui/react-collapsible';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import { cn } from '@/lib/utils';
import type { SOSChapterGroup } from '@/hooks/use-sos-scroll-viewer';

interface SOSMobileTOCProps {
  chapterGroups: SOSChapterGroup[];
  activeSectionKey: string;
  scrollProgress: number;
  onSelectSection: (key: string) => void;
  language: 'en' | 'es';
}

export function SOSMobileTOC({
  chapterGroups,
  activeSectionKey,
  scrollProgress,
  onSelectSection,
  language,
}: SOSMobileTOCProps) {
  const [open, setOpen] = useState(false);
  const isEs = language === 'es';
  const progressPercent = Math.round(scrollProgress * 100);

  const handleSelect = (key: string) => {
    onSelectSection(key);
    setOpen(false);
  };

  // Determine which chapter the active section belongs to
  const activeChapterId = useMemo(() => {
    if (activeSectionKey.startsWith('chapter-')) {
      return activeSectionKey.replace('chapter-', '');
    }
    for (const cg of chapterGroups) {
      for (const sg of cg.sectionGroups) {
        if (sg.parent.sectionKey === activeSectionKey) return cg.chapter.id;
        if (sg.children.some(c => c.sectionKey === activeSectionKey)) return cg.chapter.id;
      }
    }
    return chapterGroups[0]?.chapter.id ?? '';
  }, [activeSectionKey, chapterGroups]);

  return (
    <>
      {/* FAB */}
      <Button
        onClick={() => setOpen(true)}
        size="icon"
        className="fixed bottom-[88px] right-4 z-40 h-12 w-12 rounded-full shadow-floating lg:hidden"
        aria-label={isEs ? 'Tabla de contenido' : 'Table of contents'}
      >
        <List className="h-5 w-5" />
      </Button>

      {/* Drawer */}
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="flex items-center justify-between pb-2">
            <div>
              <DrawerTitle>
                {isEs ? 'Contenido' : 'Contents'}
              </DrawerTitle>
              <DrawerDescription>
                {progressPercent}% {isEs ? 'completado' : 'complete'}
              </DrawerDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setOpen(false)}
              className="h-9 w-9 shrink-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </DrawerHeader>

          <ScrollArea className="flex-1 px-4 pb-6">
            <nav className="space-y-1">
              {chapterGroups.map((cg) => {
                const { chapter, sectionGroups } = cg;
                const Icon = chapter.icon;
                const chapterLabel = isEs ? chapter.labelEs : chapter.labelEn;
                const isChapterOpen = chapter.id === activeChapterId;

                return (
                  <Collapsible.Root key={chapter.id} open={isChapterOpen}>
                    <Collapsible.Trigger asChild>
                      <button
                        onClick={() => handleSelect(`chapter-${chapter.id}`)}
                        className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors hover:bg-accent"
                      >
                        <Icon className="h-4 w-4 shrink-0 text-primary" />
                        <span className="min-w-0 flex-1">{chapterLabel}</span>
                        <ChevronDown className={cn(
                          'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
                          isChapterOpen && 'rotate-180'
                        )} />
                      </button>
                    </Collapsible.Trigger>

                    <Collapsible.Content className="overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
                      <div className="ml-2 pl-2 border-l border-border">
                        {sectionGroups.map((group, idx) => {
                          const { parent, children } = group;
                          const sectionNum = idx + 1;
                          const parentTitle = isEs && parent.titleEs ? parent.titleEs : parent.titleEn;
                          const isParentActive = activeSectionKey === parent.sectionKey;

                          return (
                            <div key={parent.sectionKey}>
                              <button
                                onClick={() => handleSelect(parent.sectionKey)}
                                className={cn(
                                  'w-full text-left flex items-start gap-2 px-3 py-2 rounded-md text-sm transition-colors hover:bg-accent',
                                  isParentActive && 'bg-accent text-primary font-medium'
                                )}
                              >
                                <span className="w-5 shrink-0 text-right tabular-nums text-muted-foreground">
                                  {sectionNum}
                                </span>
                                <span className="min-w-0">{parentTitle}</span>
                              </button>

                              {children.length > 0 && (
                                <div className="ml-5 border-l border-border pl-2">
                                  {children.map((child, childIdx) => {
                                    const childTitle = isEs && child.titleEs ? child.titleEs : child.titleEn;
                                    const isChildActive = activeSectionKey === child.sectionKey;
                                    const letter = String.fromCharCode(65 + childIdx);

                                    return (
                                      <button
                                        key={child.sectionKey}
                                        onClick={() => handleSelect(child.sectionKey)}
                                        className={cn(
                                          'w-full text-left flex items-start gap-2 px-3 py-1.5 rounded-md text-small transition-colors hover:bg-accent',
                                          isChildActive && 'bg-accent text-primary font-medium'
                                        )}
                                      >
                                        <span className="w-5 shrink-0 text-right tabular-nums text-muted-foreground">
                                          {letter}
                                        </span>
                                        <span className="min-w-0">{childTitle}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </Collapsible.Content>
                  </Collapsible.Root>
                );
              })}
            </nav>
          </ScrollArea>
        </DrawerContent>
      </Drawer>
    </>
  );
}
