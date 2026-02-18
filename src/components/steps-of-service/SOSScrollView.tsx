import { useRef, useMemo } from 'react';
import { ArrowLeft, ArrowUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useActiveSectionObserver } from '@/hooks/use-active-section-observer';
import { SOSSectionCard } from './SOSSectionCard';
import { SOSChapterDivider } from './SOSChapterDivider';
import { SOSTableOfContents } from './SOSTableOfContents';
import { SOSMobileTOC } from './SOSMobileTOC';
import type { SOSChapterGroup, SOSPosition } from '@/hooks/use-sos-scroll-viewer';

const POSITION_LABELS: Record<SOSPosition, { en: string; es: string }> = {
  server: { en: 'Server', es: 'Mesero' },
  bartender: { en: 'Bartender', es: 'Bartender' },
  busser: { en: 'Busser', es: 'Busser' },
  barback: { en: 'Barback', es: 'Barback' },
};

interface SOSScrollViewProps {
  position: SOSPosition;
  chapterGroups: SOSChapterGroup[];
  orderedSectionKeys: string[];
  totalSections: number;
  onBack: () => void;
  language: 'en' | 'es';
}

export function SOSScrollView({
  position,
  chapterGroups,
  orderedSectionKeys,
  totalSections,
  onBack,
  language,
}: SOSScrollViewProps) {
  const isEs = language === 'es';
  const positionLabel = isEs ? POSITION_LABELS[position].es : POSITION_LABELS[position].en;
  const scrollRef = useRef<HTMLElement>(null);

  const { activeSectionKey, scrollProgress, scrollToSection } = useActiveSectionObserver({
    sectionKeys: orderedSectionKeys,
    scrollContainerRef: scrollRef,
    enabled: chapterGroups.length > 0,
  });

  // Current active section index (1-based) for counter display
  const activeIndex = useMemo(() => {
    const idx = orderedSectionKeys.indexOf(activeSectionKey);
    return idx >= 0 ? idx + 1 : 1;
  }, [orderedSectionKeys, activeSectionKey]);

  const progressPercent = Math.round(scrollProgress * 100);

  const scrollToTop = () => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="flex h-full w-full">
      {/* Desktop TOC sidebar */}
      <aside className="hidden lg:flex flex-col w-56 shrink-0 h-full pt-lg px-2 border-r border-border">
        {/* Back button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="justify-start mb-md -ml-1"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          {positionLabel}
        </Button>

        <SOSTableOfContents
          chapterGroups={chapterGroups}
          activeSectionKey={activeSectionKey}
          scrollProgress={scrollProgress}
          onSelectSection={scrollToSection}
          language={language}
        />
      </aside>

      {/* Main scrollable content */}
      <div className="flex-1 min-w-0 flex flex-col h-full">
        {/* Mobile header */}
        <div className="lg:hidden shrink-0 border-b border-border">
          <div className="flex items-center gap-2 px-4 py-3">
            <button
              onClick={onBack}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">{positionLabel}</span>
            </button>
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-medium truncate">
                {isEs ? 'Pasos de Servicio' : 'Steps of Service'}
              </h2>
            </div>
            <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
              {activeIndex}/{totalSections}
            </span>
          </div>
          {/* Mobile progress bar */}
          <Progress value={progressPercent} className="h-0.5 rounded-none" />
        </div>

        {/* Scrollable content area */}
        <main
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 md:px-6 lg:px-8 py-lg pb-24 md:pb-6"
        >
          <div className="max-w-reading mx-auto space-y-lg">
            {chapterGroups.map((cg) => (
              <div key={cg.chapter.id} className="space-y-lg">
                <SOSChapterDivider
                  chapter={cg.chapter}
                  sectionCount={cg.sectionGroups.length}
                  language={language}
                />
                {cg.sectionGroups.map((group, idx) => (
                  <SOSSectionCard
                    key={group.parent.sectionKey}
                    group={group}
                    sectionNumber={idx + 1}
                    language={language}
                  />
                ))}
              </div>
            ))}

            {/* End-of-content */}
            {chapterGroups.length > 0 && (
              <div className="text-center py-xl space-y-md">
                <p className="text-sm text-muted-foreground">
                  {isEs
                    ? `Has completado los ${totalSections} pasos de servicio`
                    : `You have completed all ${totalSections} steps of service`}
                </p>
                <Button variant="ghost" size="sm" onClick={scrollToTop}>
                  <ArrowUp className="h-4 w-4 mr-1" />
                  {isEs ? 'Volver arriba' : 'Back to top'}
                </Button>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Mobile FAB + Drawer */}
      <SOSMobileTOC
        chapterGroups={chapterGroups}
        activeSectionKey={activeSectionKey}
        scrollProgress={scrollProgress}
        onSelectSection={scrollToSection}
        language={language}
      />
    </div>
  );
}
