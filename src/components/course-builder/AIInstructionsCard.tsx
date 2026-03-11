// =============================================================================
// AIInstructionsCard — Toggleable card below each builder element for
// editing AI instructions and triggering AI generation.
// =============================================================================

import { Bot, Sparkles, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useCourseBuilder } from '@/contexts/CourseBuilderContext';
import { useBuildCourse } from '@/hooks/use-build-course';

const STRINGS = {
  en: {
    label: 'AI Instructions',
    placeholder: 'Tell the AI what to generate for this element...',
    generate: 'Generate',
    generating: 'Generating...',
  },
  es: {
    label: 'Instrucciones IA',
    placeholder: 'Dile a la IA qué generar para este elemento...',
    generate: 'Generar',
    generating: 'Generando...',
  },
};

interface AIInstructionsCardProps {
  elementKey: string;
  aiInstructions: string;
  sectionId: string;
  language: 'en' | 'es';
  isGenerating?: boolean;
}

export function AIInstructionsCard({
  elementKey,
  aiInstructions,
  sectionId,
  language,
  isGenerating = false,
}: AIInstructionsCardProps) {
  const t = STRINGS[language];
  const { state, updateElementSilent, updateElement } = useCourseBuilder();
  const { buildElement } = useBuildCourse();

  const handleGenerate = async () => {
    if (!state.courseId) return;
    await buildElement(state.courseId, sectionId, elementKey, aiInstructions.trim() || undefined, language);
  };

  return (
    <div
      className="rounded-xl border border-dashed border-primary/20 bg-primary/[0.02] p-3 mt-3 space-y-2"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Bot className="h-3.5 w-3.5 text-primary/50" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-primary/60">
            {t.label}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-[10px] px-2"
          onClick={handleGenerate}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              {t.generating}
            </>
          ) : (
            <>
              <Sparkles className="h-3 w-3 mr-1" />
              {t.generate}
            </>
          )}
        </Button>
      </div>

      {/* Textarea */}
      <textarea
        value={aiInstructions}
        onChange={(e) => updateElementSilent(elementKey, { ai_instructions: e.target.value })}
        onBlur={() => updateElement(elementKey, { ai_instructions: aiInstructions })}
        placeholder={t.placeholder}
        disabled={isGenerating}
        rows={1}
        style={{ fieldSizing: 'content' } as React.CSSProperties}
        className={cn(
          'w-full text-sm bg-transparent border-0 shadow-none outline-none ring-0 focus-visible:ring-0 p-0 resize-none',
          'placeholder:text-muted-foreground/40 placeholder:italic',
          'min-h-[40px]',
          'focus:ring-1 focus:ring-primary/20 focus:rounded-sm',
          isGenerating && 'opacity-50 cursor-not-allowed',
        )}
        data-inline-editable="true"
      />
    </div>
  );
}
