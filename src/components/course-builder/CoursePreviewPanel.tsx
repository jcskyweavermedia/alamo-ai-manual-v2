// =============================================================================
// CoursePreviewPanel — Full preview of course content within the builder.
//
// Renders when activeTab === 'preview'. Shows section selector at top,
// language toggle, and renders all elements of the active section through
// PlayerElementDispatcher (clean player mode, no card wrappers).
// =============================================================================

import { useState, useCallback } from 'react';
import { FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCourseBuilder } from '@/contexts/CourseBuilderContext';
import { PlayerElementDispatcher } from '@/components/course-player/PlayerElementDispatcher';

// =============================================================================
// TYPES
// =============================================================================

interface CoursePreviewPanelProps {
  language: 'en' | 'es';
}

// =============================================================================
// STRINGS
// =============================================================================

const STRINGS = {
  en: {
    sectionLabel: 'Section',
    noElements: 'No elements in this section',
    noSections: 'No sections yet. Add sections in the Elements tab.',
    selectSection: 'Select a section',
  },
  es: {
    sectionLabel: 'Secci\u00f3n',
    noElements: 'No hay elementos en esta secci\u00f3n',
    noSections: 'A\u00fan no hay secciones. Agrega secciones en la pesta\u00f1a Elementos.',
    selectSection: 'Selecciona una secci\u00f3n',
  },
};

// =============================================================================
// COMPONENT
// =============================================================================

export function CoursePreviewPanel({ language: appLanguage }: CoursePreviewPanelProps) {
  const { state, dispatch } = useCourseBuilder();
  const { sections, activeSectionId } = state;

  // Local language toggle for preview (independent of app language)
  const [previewLang, setPreviewLang] = useState<'en' | 'es'>(appLanguage);
  const t = STRINGS[previewLang];

  const activeSection = sections.find((s) => s.id === activeSectionId) ?? null;

  const handleSectionChange = useCallback(
    (sectionId: string) => {
      dispatch({ type: 'SET_ACTIVE_SECTION', payload: sectionId });
    },
    [dispatch],
  );

  // No sections state
  if (sections.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <FileText className="h-10 w-10 text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">{t.noSections}</p>
      </div>
    );
  }

  // Get section title based on preview language
  const sectionTitle = activeSection
    ? (previewLang === 'es' && activeSection.titleEs
        ? activeSection.titleEs
        : activeSection.titleEn)
    : '';

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* ---- Top controls: section selector + language toggle ---- */}
      <div className="flex items-center gap-2 px-4 py-2 border-b shrink-0">
        {/* Section selector */}
        <label className="text-xs font-medium text-muted-foreground shrink-0">
          {t.sectionLabel}:
        </label>
        <select
          value={activeSectionId ?? ''}
          onChange={(e) => handleSectionChange(e.target.value)}
          className={cn(
            'flex-1 min-w-0 truncate',
            'text-sm bg-transparent',
            'border border-border rounded-md',
            'px-2 py-1',
            'focus:outline-none focus:ring-1 focus:ring-primary',
          )}
        >
          {sections.map((section) => {
            const label =
              previewLang === 'es' && section.titleEs
                ? section.titleEs
                : section.titleEn;
            return (
              <option key={section.id} value={section.id}>
                {label}
              </option>
            );
          })}
        </select>

        {/* Language toggle */}
        <div className="flex items-center rounded-md border border-border overflow-hidden shrink-0">
          <button
            onClick={() => setPreviewLang('en')}
            className={cn(
              'px-2 py-1 text-xs font-semibold transition-colors',
              previewLang === 'en'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            EN
          </button>
          <button
            onClick={() => setPreviewLang('es')}
            className={cn(
              'px-2 py-1 text-xs font-semibold transition-colors',
              previewLang === 'es'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            ES
          </button>
        </div>
      </div>

      {/* ---- Section content area ---- */}
      <div className="flex-1 overflow-y-auto min-h-0 p-4">
        <div className="max-w-2xl mx-auto">
          {/* Section heading */}
          {sectionTitle && (
            <h2 className="text-xl font-bold mb-6">{sectionTitle}</h2>
          )}

          {/* Elements */}
          {activeSection && activeSection.elements.length > 0 ? (
            <div className="space-y-6">
              {activeSection.elements
                .slice()
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((element) => (
                  <PlayerElementDispatcher
                    key={element.key}
                    element={element}
                    language={previewLang}
                  />
                ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FileText className="h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">{t.noElements}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
