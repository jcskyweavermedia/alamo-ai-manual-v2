import { cn } from '@/lib/utils';
import type { SOSChapter } from '@/constants/sos-chapters';

interface SOSChapterDividerProps {
  chapter: SOSChapter;
  sectionCount: number;
  language: 'en' | 'es';
}

export function SOSChapterDivider({ chapter, sectionCount, language }: SOSChapterDividerProps) {
  const isEs = language === 'es';
  const label = isEs ? chapter.labelEs : chapter.labelEn;
  const Icon = chapter.icon;
  const isMuted = chapter.color === 'muted';

  return (
    <div
      data-section-key={`chapter-${chapter.id}`}
      className="scroll-mt-20"
    >
      {/* Horizontal rule with centered pill */}
      <div className="relative flex items-center py-4">
        {/* Left line */}
        <div className={cn(
          'flex-1 h-px',
          isMuted ? 'bg-border' : 'bg-primary/25'
        )} />

        {/* Center pill */}
        <div className={cn(
          'flex items-center gap-2.5 px-5 py-2.5 rounded-full mx-4 shadow-sm border',
          isMuted
            ? 'bg-muted border-border'
            : 'bg-primary/10 border-primary/20'
        )}>
          <Icon className={cn(
            'h-5 w-5 shrink-0',
            isMuted ? 'text-muted-foreground' : 'text-primary'
          )} />
          <div className="flex items-baseline gap-2">
            <h2 className={cn(
              'text-sm font-bold tracking-wide uppercase whitespace-nowrap',
              isMuted ? 'text-muted-foreground' : 'text-primary'
            )}>
              {label}
            </h2>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {sectionCount} {isEs ? 'secciones' : 'sections'}
            </span>
          </div>
        </div>

        {/* Right line */}
        <div className={cn(
          'flex-1 h-px',
          isMuted ? 'bg-border' : 'bg-primary/25'
        )} />
      </div>
    </div>
  );
}
