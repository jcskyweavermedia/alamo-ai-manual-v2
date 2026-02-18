import { useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import * as Collapsible from '@radix-ui/react-collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { SectionTitle } from '@/components/ui/typography';
import { cn } from '@/lib/utils';
import type { SOSChapterGroup } from '@/hooks/use-sos-scroll-viewer';

interface SOSTableOfContentsProps {
  chapterGroups: SOSChapterGroup[];
  activeSectionKey: string;
  scrollProgress: number;
  onSelectSection: (key: string) => void;
  language: 'en' | 'es';
}

export function SOSTableOfContents({
  chapterGroups,
  activeSectionKey,
  scrollProgress,
  onSelectSection,
  language,
}: SOSTableOfContentsProps) {
  const isEs = language === 'es';

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
    <div className="flex flex-col h-full">
      <div className="shrink-0 px-1 mb-md">
        <SectionTitle>
          {isEs ? 'Contenido' : 'Contents'}
        </SectionTitle>
      </div>

      {/* Progress bar */}
      <div className="shrink-0 mb-md px-1">
        <Progress value={scrollProgress * 100} className="h-1" />
      </div>

      {/* Chapter-grouped section list */}
      <ScrollArea className="flex-1">
        <nav className="py-1 pr-2 space-y-1">
          {chapterGroups.map((cg) => {
            const { chapter, sectionGroups } = cg;
            const Icon = chapter.icon;
            const chapterLabel = isEs ? chapter.labelEs : chapter.labelEn;
            const isOpen = chapter.id === activeChapterId;

            return (
              <Collapsible.Root key={chapter.id} open={isOpen}>
                <Collapsible.Trigger asChild>
                  <button
                    onClick={() => onSelectSection(`chapter-${chapter.id}`)}
                    className="w-full text-left flex items-center gap-1.5 px-2 py-1.5 rounded-md text-small font-medium transition-colors hover:bg-accent"
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <span className="min-w-0 flex-1">{chapterLabel}</span>
                    <ChevronDown className={cn(
                      'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200',
                      isOpen && 'rotate-180'
                    )} />
                  </button>
                </Collapsible.Trigger>

                <Collapsible.Content className="overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
                  <div className="ml-1 pl-2 border-l border-border">
                    {sectionGroups.map((group, idx) => {
                      const { parent, children } = group;
                      const sectionNum = idx + 1;
                      const parentTitle = isEs && parent.titleEs ? parent.titleEs : parent.titleEn;
                      const isParentActive = activeSectionKey === parent.sectionKey;
                      const hasActiveChild = children.some(c => c.sectionKey === activeSectionKey);
                      const isExpanded = isParentActive || hasActiveChild;

                      return (
                        <div key={parent.sectionKey}>
                          <button
                            onClick={() => onSelectSection(parent.sectionKey)}
                            className={cn(
                              'w-full text-left flex items-start gap-1.5 px-2 py-1.5 rounded-md text-small transition-colors hover:bg-accent',
                              isParentActive && 'bg-accent text-primary font-medium'
                            )}
                          >
                            <span className="w-5 shrink-0 text-right tabular-nums text-muted-foreground">
                              {sectionNum}
                            </span>
                            <span className="min-w-0">{parentTitle}</span>
                          </button>

                          {children.length > 0 && isExpanded && (
                            <div className="ml-5 border-l border-border pl-2">
                              {children.map((child, childIdx) => {
                                const childTitle = isEs && child.titleEs ? child.titleEs : child.titleEn;
                                const isChildActive = activeSectionKey === child.sectionKey;
                                const letter = String.fromCharCode(65 + childIdx);

                                return (
                                  <button
                                    key={child.sectionKey}
                                    onClick={() => onSelectSection(child.sectionKey)}
                                    className={cn(
                                      'w-full text-left flex items-start gap-1.5 px-2 py-1 rounded-md text-small transition-colors hover:bg-accent',
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
    </div>
  );
}
