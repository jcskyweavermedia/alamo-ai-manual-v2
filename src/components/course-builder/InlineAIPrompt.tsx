// =============================================================================
// InlineAIPrompt — Small popover for the AI sparkle button on an element
// Shows current ai_instructions, text input for new instructions, regenerate.
// =============================================================================

import { useState } from 'react';
import { Sparkles, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useCourseBuilder } from '@/contexts/CourseBuilderContext';
import { useBuildCourse } from '@/hooks/use-build-course';

const STRINGS = {
  en: {
    title: 'AI Generate',
    instructions: 'Instructions',
    instructionsPlaceholder: 'Tell the AI what to generate for this element...',
    currentInstructions: 'Current instructions',
    regenerate: 'Generate',
    cancel: 'Cancel',
    generating: 'Generating...',
  },
  es: {
    title: 'Generar con IA',
    instructions: 'Instrucciones',
    instructionsPlaceholder: 'Dile a la IA que generar para este elemento...',
    currentInstructions: 'Instrucciones actuales',
    regenerate: 'Generar',
    cancel: 'Cancelar',
    generating: 'Generando...',
  },
};

interface InlineAIPromptProps {
  elementKey: string;
  currentInstructions: string;
  sectionId: string;
  language?: 'en' | 'es';
  children: React.ReactNode;
}

export function InlineAIPrompt({
  elementKey,
  currentInstructions,
  sectionId,
  language = 'en',
  children,
}: InlineAIPromptProps) {
  const t = STRINGS[language];
  const { state } = useCourseBuilder();
  const { buildElement, isBuilding } = useBuildCourse();
  const [open, setOpen] = useState(false);
  const [instruction, setInstruction] = useState(currentInstructions);

  const handleGenerate = async () => {
    if (!state.courseId) return;
    const success = await buildElement(state.courseId, sectionId, elementKey, instruction.trim() || undefined, language);
    if (success) {
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-4"
        side="left"
        align="start"
        sideOffset={8}
      >
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">{t.title}</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setOpen(false)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Current instructions (if any) */}
          {currentInstructions && (
            <div>
              <Label className="text-[10px] uppercase text-muted-foreground">{t.currentInstructions}</Label>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-3">{currentInstructions}</p>
            </div>
          )}

          {/* Instruction input */}
          <div>
            <Label className="text-[10px] uppercase text-muted-foreground">{t.instructions}</Label>
            <Textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder={t.instructionsPlaceholder}
              className="mt-1 min-h-[80px] text-sm resize-none"
              autoFocus
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={isBuilding}
            >
              {t.cancel}
            </Button>
            <Button
              size="sm"
              onClick={handleGenerate}
              disabled={isBuilding}
            >
              {isBuilding ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  {t.generating}
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                  {t.regenerate}
                </>
              )}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
