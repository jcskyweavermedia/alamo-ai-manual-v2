// =============================================================================
// SectionNavigator — Section list below the element palette
// Click to switch activeSectionId. "+" button to add new section.
// =============================================================================

import { useState } from 'react';
import { Plus, Trash2, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCourseBuilder } from '@/contexts/CourseBuilderContext';

const STRINGS = {
  en: {
    sections: 'Sections',
    addSection: 'Add Section',
    newSectionPlaceholder: 'Section title...',
    noSections: 'No sections yet',
    elements: 'elements',
  },
  es: {
    sections: 'Secciones',
    addSection: 'Agregar Seccion',
    newSectionPlaceholder: 'Titulo de seccion...',
    noSections: 'Sin secciones',
    elements: 'elementos',
  },
};

const statusColors: Record<string, string> = {
  empty: 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  outline: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  generating: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
  generated: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  reviewed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
};

interface SectionNavigatorProps {
  language: 'en' | 'es';
}

export function SectionNavigator({ language }: SectionNavigatorProps) {
  const t = STRINGS[language];
  const { state, addSection, removeSection, setActiveSection } = useCourseBuilder();
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const handleAdd = () => {
    if (!newTitle.trim()) return;
    addSection(newTitle.trim());
    setNewTitle('');
    setIsAdding(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAdd();
    if (e.key === 'Escape') { setIsAdding(false); setNewTitle(''); }
  };

  return (
    <div className="p-3 space-y-1 border-t">
      <div className="flex items-center justify-between px-3 mb-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {t.sections}
        </h3>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => setIsAdding(true)}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {state.sections.length === 0 && !isAdding && (
        <p className="text-xs text-muted-foreground px-3 py-2">{t.noSections}</p>
      )}

      {state.sections.map((section) => (
        <button
          key={section.id}
          type="button"
          onClick={() => setActiveSection(section.id)}
          className={cn(
            'flex items-center gap-2 w-full px-3 py-2 rounded-lg text-left',
            'text-sm transition-colors group',
            state.activeSectionId === section.id
              ? 'bg-primary/10 text-primary font-medium'
              : 'hover:bg-muted/80 text-foreground/80',
          )}
        >
          <ChevronRight className={cn(
            'h-3.5 w-3.5 shrink-0 transition-transform',
            state.activeSectionId === section.id && 'rotate-90',
          )} />
          <div className="flex-1 min-w-0">
            <p className="line-clamp-2 text-sm">
              {language === 'es' && section.titleEs ? section.titleEs : section.titleEn}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Badge
                variant="secondary"
                className={cn(
                  'text-[9px] font-semibold px-1 py-0 h-[14px] border-0',
                  statusColors[section.generationStatus] || statusColors.empty,
                )}
              >
                {section.generationStatus}
              </Badge>
              <span className="text-[9px] text-muted-foreground tabular-nums">
                {section.elements.length} {t.elements}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); removeSection(section.id); }}
            className="hidden group-hover:flex items-center justify-center h-5 w-5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </button>
      ))}

      {/* Inline add section */}
      {isAdding && (
        <div className="px-3 py-1">
          <Input
            autoFocus
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => { if (!newTitle.trim()) setIsAdding(false); }}
            placeholder={t.newSectionPlaceholder}
            className="h-8 text-sm"
          />
        </div>
      )}

      {!isAdding && state.sections.length > 0 && (
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          {t.addSection}
        </button>
      )}
    </div>
  );
}
