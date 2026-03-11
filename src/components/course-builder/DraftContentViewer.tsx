// =============================================================================
// DraftContentViewer — Read-only viewer for raw Pass 2 prose output
// Shows draft_content JSONB (brief, raw prose, teaching notes, source hints)
// Used to diagnose whether Pass 2 over-generates or Pass 3 over-converts
// =============================================================================

import { useState } from 'react';
import { X, BookOpen, Lightbulb, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useCourseBuilder } from '@/contexts/CourseBuilderContext';

const STRINGS = {
  en: {
    title: 'Draft Content',
    noSection: 'No section selected',
    noDraft: 'No draft content — build course first',
    wordCount: 'words',
    briefLabel: 'Writing Brief',
    proseLabel: 'Raw Prose (Pass 2 Output)',
    notesLabel: 'Teaching Notes',
    hintsLabel: 'Source Hints',
    close: 'Close',
  },
  es: {
    title: 'Contenido Borrador',
    noSection: 'Ninguna sección seleccionada',
    noDraft: 'Sin contenido borrador — construya el curso primero',
    wordCount: 'palabras',
    briefLabel: 'Instrucciones de Escritura',
    proseLabel: 'Prosa Original (Salida Paso 2)',
    notesLabel: 'Notas de Enseñanza',
    hintsLabel: 'Pistas de Fuente',
    close: 'Cerrar',
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

interface DraftContentViewerProps {
  language: 'en' | 'es';
}

export function DraftContentViewer({ language }: DraftContentViewerProps) {
  const t = STRINGS[language];
  const { state, dispatch } = useCourseBuilder();

  const activeSection = state.sections.find(s => s.id === state.activeSectionId) ?? null;

  const handleClose = () => {
    dispatch({ type: 'SET_RIGHT_PANEL_MODE', payload: 'ai-chat' });
  };

  // No section selected
  if (!activeSection) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2 p-4">
        <FileText className="h-8 w-8 opacity-40" />
        <p className="text-sm">{t.noSection}</p>
      </div>
    );
  }

  const draft = activeSection.draftContent as Record<string, unknown> | null | undefined;

  // No draft content
  if (!draft || (!draft.content_en && !draft.brief_en)) {
    return (
      <div className="flex flex-col h-full">
        <Header title={t.title} onClose={handleClose} closeLabel={t.close} />
        <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground gap-2 p-4">
          <FileText className="h-8 w-8 opacity-40" />
          <p className="text-sm text-center">{t.noDraft}</p>
        </div>
      </div>
    );
  }

  const contentEn = (draft.content_en as string) || '';
  const briefEn = (draft.brief_en as string) || '';
  const teachingNotes = (draft.teaching_notes as string) || '';
  const sourceHints = (draft.source_hints as string[]) || [];
  const wordCount = contentEn ? contentEn.split(/\s+/).filter(Boolean).length : 0;

  return (
    <div className="flex flex-col h-full">
      <Header title={t.title} onClose={handleClose} closeLabel={t.close} />

      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        {/* Section title + status badge */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold leading-tight">{activeSection.titleEn}</h3>
          <span className={cn(
            'text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 uppercase tracking-wide',
            STATUS_COLORS[activeSection.generationStatus] || 'bg-gray-100 text-gray-600',
          )}>
            {activeSection.generationStatus}
          </span>
        </div>

        {/* Word count — key diagnostic */}
        {contentEn && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/60 border">
            <span className="text-2xl font-bold tabular-nums">{wordCount}</span>
            <span className="text-xs text-muted-foreground">{t.wordCount}</span>
          </div>
        )}

        {/* Writing Brief */}
        {briefEn && (
          <CollapsibleBlock icon={BookOpen} label={t.briefLabel} defaultOpen={false}>
            <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">{briefEn}</p>
          </CollapsibleBlock>
        )}

        {/* Raw Prose — main block */}
        {contentEn && (
          <div className="space-y-1.5">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t.proseLabel}</h4>
            <div className="text-sm whitespace-pre-wrap leading-relaxed border rounded-md p-3 bg-muted/30 max-h-[50vh] overflow-y-auto">
              {contentEn}
            </div>
          </div>
        )}

        {/* Teaching Notes */}
        {teachingNotes && (
          <CollapsibleBlock icon={Lightbulb} label={t.notesLabel} defaultOpen={false}>
            <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">{teachingNotes}</p>
          </CollapsibleBlock>
        )}

        {/* Source Hints */}
        {sourceHints.length > 0 && (
          <div className="space-y-1.5">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t.hintsLabel}</h4>
            <div className="flex flex-wrap gap-1.5">
              {sourceHints.map((hint, i) => (
                <span key={i} className="text-[11px] font-mono px-2 py-0.5 rounded bg-muted border">
                  {hint}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Header({ title, onClose, closeLabel }: { title: string; onClose: () => void; closeLabel: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-2 border-b shrink-0">
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose} aria-label={closeLabel}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

function CollapsibleBlock({
  icon: Icon,
  label,
  defaultOpen,
  children,
}: {
  icon: typeof BookOpen;
  label: string;
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="space-y-1.5">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors"
      >
        <Icon className="h-3.5 w-3.5" />
        {label}
        <span className="text-[10px]">{open ? '▾' : '▸'}</span>
      </button>
      {open && children}
    </div>
  );
}
