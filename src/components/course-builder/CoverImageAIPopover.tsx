import { useState } from 'react';
import { Sparkles, Loader2, X } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

const STRINGS = {
  en: {
    headerTitle: 'Generate Cover Image',
    courseLabel: 'Course',
    untitledCourse: 'Untitled Course',
    quickStyles: 'Quick Styles',
    stylePhoto: 'Photo',
    styleIllustration: 'Illustration',
    styleAbstract: 'Abstract',
    styleMinimal: 'Minimal',
    customInstructions: 'Custom Instructions',
    placeholder: 'Describe the style you want...',
    cancel: 'Cancel',
    generating: 'Generating...',
    generate: 'Generate',
    close: 'Close',
  },
  es: {
    headerTitle: 'Generar Imagen de Portada',
    courseLabel: 'Curso',
    untitledCourse: 'Curso sin t\u00edtulo',
    quickStyles: 'Estilos R\u00e1pidos',
    stylePhoto: 'Foto',
    styleIllustration: 'Ilustraci\u00f3n',
    styleAbstract: 'Abstracto',
    styleMinimal: 'Minimalista',
    customInstructions: 'Instrucciones Personalizadas',
    placeholder: 'Describe el estilo que deseas...',
    cancel: 'Cancelar',
    generating: 'Generando...',
    generate: 'Generar',
    close: 'Cerrar',
  },
};

const QUICK_STYLES = [
  { key: 'stylePhoto' as const, instruction: 'Professional food photography style, dramatic lighting' },
  { key: 'styleIllustration' as const, instruction: 'Clean, modern illustration style with flat design elements' },
  { key: 'styleAbstract' as const, instruction: 'Abstract geometric shapes and gradients suggesting learning and growth' },
  { key: 'styleMinimal' as const, instruction: 'Minimal, clean design with a single iconic element on a clean background' },
];

interface CoverImageAIPopoverProps {
  courseTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate: (instruction?: string) => void;
  isGenerating: boolean;
  language: 'en' | 'es';
  children: React.ReactNode;
}

export function CoverImageAIPopover({
  courseTitle,
  open,
  onOpenChange,
  onGenerate,
  isGenerating,
  language,
  children,
}: CoverImageAIPopoverProps) {
  const [instruction, setInstruction] = useState('');
  const t = STRINGS[language];

  // L-2: Clear instruction when popover closes externally
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) setInstruction('');
    onOpenChange(nextOpen);
  };

  const handleGenerate = () => {
    onGenerate(instruction.trim() || undefined);
    setInstruction('');
  };

  const handleQuickStyle = (styleInstruction: string) => {
    onGenerate(styleInstruction);
    setInstruction('');
    onOpenChange(false);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-4"
        side="bottom"
        align="center"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-sm font-medium">
              <Sparkles className="h-4 w-4 text-orange-500" />
              {t.headerTitle}
            </div>
            <button
              onClick={() => handleOpenChange(false)}
              aria-label={t.close}
              className="h-6 w-6 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Course context */}
          <div className="rounded-md bg-muted/50 px-3 py-2">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">{t.courseLabel}</p>
            <p className="text-xs text-foreground line-clamp-1">{courseTitle || t.untitledCourse}</p>
          </div>

          {/* Quick styles */}
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">{t.quickStyles}</p>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_STYLES.map((style) => (
                <button
                  key={style.key}
                  onClick={() => handleQuickStyle(style.instruction)}
                  disabled={isGenerating}
                  className="rounded-full border px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors disabled:opacity-50"
                >
                  {t[style.key]}
                </button>
              ))}
            </div>
          </div>

          {/* Custom instruction */}
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">{t.customInstructions}</p>
            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder={t.placeholder}
              className="w-full h-16 text-xs rounded-md border border-border bg-background px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-primary/30"
              disabled={isGenerating}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={() => onOpenChange(false)}
              className="h-7 px-3 text-xs font-medium text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-colors"
            >
              {t.cancel}
            </button>
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="h-7 px-3 text-xs font-medium bg-orange-500 text-white rounded-md hover:bg-orange-600 transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {isGenerating ? (
                <><Loader2 className="h-3 w-3 animate-spin" /> {t.generating}</>
              ) : (
                <><Sparkles className="h-3 w-3" /> {t.generate}</>
              )}
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
