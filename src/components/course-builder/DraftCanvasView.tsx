// =============================================================================
// DraftCanvasView — Full-canvas view of all sections' raw Pass 2 prose output
// Shows draft_content JSONB for every section in a scrollable document.
// Listens for 'course-builder-scroll-to-section' custom events (SectionNavigator).
// =============================================================================

import { useEffect, useRef, useCallback, useState } from 'react';
import { FileText, BookOpen, Lightbulb, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCourseBuilder } from '@/contexts/CourseBuilderContext';
import type { CourseSection } from '@/types/course-builder';

const STRINGS = {
  en: {
    title: 'Source Content',
    totalWords: 'Total words',
    noSections: 'No sections yet',
    noDraft: 'No source content — build course first',
    words: 'words',
    briefLabel: 'Writing Brief',
    notesLabel: 'Teaching Notes',
    hintsLabel: 'Source Hints',
  },
  es: {
    title: 'Contenido Fuente',
    totalWords: 'Total de palabras',
    noSections: 'Sin secciones',
    noDraft: 'Sin contenido fuente — construya el curso primero',
    words: 'palabras',
    briefLabel: 'Instrucciones de Escritura',
    notesLabel: 'Notas de Enseñanza',
    hintsLabel: 'Pistas de Fuente',
  },
};

const STATUS_COLORS: Record<string, string> = {
  empty: 'bg-gray-100 text-gray-600',
  outline: 'bg-blue-100 text-blue-700',
  planned: 'bg-indigo-100 text-indigo-700',
  prose_ready: 'bg-violet-100 text-violet-700',
  generating: 'bg-amber-100 text-amber-700',
  generated: 'bg-emerald-100 text-emerald-700',
  translated: 'bg-teal-100 text-teal-700',
  reviewed: 'bg-green-100 text-green-700',
  incomplete: 'bg-red-100 text-red-700',
  prose_error: 'bg-red-100 text-red-700',
};

interface DraftCanvasViewProps {
  language: 'en' | 'es';
}

export function DraftCanvasView({ language }: DraftCanvasViewProps) {
  const t = STRINGS[language];
  const { state, dispatch } = useCourseBuilder();
  const sectionRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const isScrollingRef = useRef(false);

  // --- Scroll-to-section listener (same pattern as CourseBuilderCanvas) ---
  useEffect(() => {
    function handleScrollTo(e: Event) {
      const sectionId = (e as CustomEvent<string>).detail;
      const el = sectionRefs.current.get(sectionId);
      if (el) {
        isScrollingRef.current = true;
        dispatch({ type: 'SET_ACTIVE_SECTION', payload: sectionId });
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setTimeout(() => { isScrollingRef.current = false; }, 800);
      }
    }
    window.addEventListener('course-builder-scroll-to-section', handleScrollTo);
    return () => window.removeEventListener('course-builder-scroll-to-section', handleScrollTo);
  }, [dispatch]);

  // --- IntersectionObserver: track which section is most visible ---
  useEffect(() => {
    if (state.sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (isScrollingRef.current) return;
        let bestEntry: IntersectionObserverEntry | null = null;
        for (const entry of entries) {
          if (entry.isIntersecting) {
            if (!bestEntry || entry.intersectionRatio > bestEntry.intersectionRatio) {
              bestEntry = entry;
            }
          }
        }
        if (bestEntry) {
          const sectionId = bestEntry.target.getAttribute('data-section-id');
          if (sectionId && sectionId !== state.activeSectionId) {
            dispatch({ type: 'SET_ACTIVE_SECTION', payload: sectionId });
          }
        }
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] },
    );

    for (const [, el] of sectionRefs.current) {
      observer.observe(el);
    }

    return () => observer.disconnect();
  }, [state.sections, state.activeSectionId, dispatch]);

  const setSectionRef = useCallback((sectionId: string, el: HTMLDivElement | null) => {
    if (el) sectionRefs.current.set(sectionId, el);
    else sectionRefs.current.delete(sectionId);
  }, []);

  // Compute total word count across all sections
  const totalWordCount = state.sections.reduce((sum, section) => {
    const draft = section.draftContent as Record<string, unknown> | null;
    const content = (draft?.content_en as string) || '';
    return sum + (content ? content.split(/\s+/).filter(Boolean).length : 0);
  }, 0);

  // Empty state: no sections
  if (state.sections.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center px-4">
        <FileText className="h-10 w-10 text-muted-foreground/30 mb-3" />
        <p className="text-sm text-muted-foreground">{t.noSections}</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      {/* Total word count header */}
      <div className="flex items-center gap-3 px-1 py-2 border-b">
        <FileText className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-sm font-semibold">{t.title}</h2>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xl font-bold tabular-nums">{totalWordCount}</span>
          <span className="text-xs text-muted-foreground">{t.totalWords}</span>
        </div>
      </div>

      {/* Per-section draft blocks */}
      {state.sections.map((section, index) => (
        <DraftSectionBlock
          key={section.id}
          section={section}
          index={index}
          language={language}
          strings={t}
          isActive={state.activeSectionId === section.id}
          setSectionRef={setSectionRef}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-section block
// ---------------------------------------------------------------------------

interface DraftSectionBlockProps {
  section: CourseSection;
  index: number;
  language: 'en' | 'es';
  strings: (typeof STRINGS)['en'];
  isActive: boolean;
  setSectionRef: (id: string, el: HTMLDivElement | null) => void;
}

function DraftSectionBlock({ section, index, language, strings: t, isActive, setSectionRef }: DraftSectionBlockProps) {
  const [showBrief, setShowBrief] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [showHints, setShowHints] = useState(false);

  const draft = section.draftContent as Record<string, unknown> | null;
  const contentEn = (draft?.content_en as string) || '';
  const briefEn = (draft?.brief_en as string) || '';
  const teachingNotes = (draft?.teaching_notes as string) || '';
  const sourceHints = (draft?.source_hints as string[]) || [];
  const wordCount = contentEn ? contentEn.split(/\s+/).filter(Boolean).length : 0;
  const hasDraft = !!(contentEn || briefEn);

  const title = language === 'es' && section.titleEs ? section.titleEs : section.titleEn;

  return (
    <div
      ref={(el) => setSectionRef(section.id, el)}
      data-section-id={section.id}
      className={cn(
        'rounded-xl border p-5 transition-colors',
        isActive ? 'bg-primary/5 border-primary/30' : 'border-border',
      )}
    >
      {/* Section header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-mono text-muted-foreground/60">{String(index + 1).padStart(2, '0')}</span>
          <h3 className="text-base font-semibold leading-tight">{title}</h3>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={cn(
            'text-[10px] font-medium px-1.5 py-0.5 rounded-full uppercase tracking-wide',
            STATUS_COLORS[section.generationStatus] || STATUS_COLORS.empty,
          )}>
            {section.generationStatus}
          </span>
          {wordCount > 0 && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {wordCount} {t.words}
            </span>
          )}
        </div>
      </div>

      {!hasDraft ? (
        <div className="flex items-center gap-2 text-muted-foreground py-4">
          <FileText className="h-4 w-4 opacity-40" />
          <p className="text-sm">{t.noDraft}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Writing Brief (collapsible) */}
          {briefEn && (
            <CollapsibleBlock icon={BookOpen} label={t.briefLabel} open={showBrief} onToggle={() => setShowBrief(!showBrief)}>
              <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">{briefEn}</p>
            </CollapsibleBlock>
          )}

          {/* Raw Prose — main content, always visible */}
          {contentEn && (
            <div className="text-sm whitespace-pre-wrap leading-relaxed border rounded-md p-4 bg-muted/20">
              {contentEn}
            </div>
          )}

          {/* Teaching Notes (collapsible) */}
          {teachingNotes && (
            <CollapsibleBlock icon={Lightbulb} label={t.notesLabel} open={showNotes} onToggle={() => setShowNotes(!showNotes)}>
              <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">{teachingNotes}</p>
            </CollapsibleBlock>
          )}

          {/* Source Hints (collapsible) */}
          {sourceHints.length > 0 && (
            <CollapsibleBlock icon={Tag} label={t.hintsLabel} open={showHints} onToggle={() => setShowHints(!showHints)}>
              <div className="flex flex-wrap gap-1.5">
                {sourceHints.map((hint, i) => (
                  <span key={i} className="text-[11px] font-mono px-2 py-0.5 rounded bg-muted border">{hint}</span>
                ))}
              </div>
            </CollapsibleBlock>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Collapsible block
// ---------------------------------------------------------------------------

function CollapsibleBlock({
  icon: Icon,
  label,
  open,
  onToggle,
  children,
}: {
  icon: typeof BookOpen;
  label: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <button
        onClick={onToggle}
        className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors"
      >
        <Icon className="h-3.5 w-3.5" />
        {label}
        <span className="text-[10px]">{open ? '\u25BE' : '\u25B8'}</span>
      </button>
      {open && children}
    </div>
  );
}
