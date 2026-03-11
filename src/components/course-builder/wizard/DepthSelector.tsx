// =============================================================================
// DepthSelector — AI-powered depth tier picker for course wizard.
// Shows 3 AI-generated previews + a custom option in a 2x2 grid.
// =============================================================================

import { useEffect, useState } from 'react';
import { Loader2, Zap, BookOpen, GraduationCap, Pencil, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { WizardRichInput } from '@/components/ui/wizard-rich-input';
import { supabase } from '@/integrations/supabase/client';
import type { CourseDepth, DepthPreviewResponse, DepthTierPreview } from '@/types/course-builder';

const STRINGS = {
  en: {
    loading: 'Generating depth options...',
    error: 'Failed to generate previews',
    retry: 'Retry',
    sections: 'sections',
    quickLabel: 'Quick Briefing',
    standardLabel: 'Standard Training',
    deepLabel: 'Deep Dive',
    customLabel: 'Custom',
    customDesc: 'Tell the AI exactly what you want — topics, section count, depth.',
    customPlaceholder: 'e.g., "I want 4 sections: one for each dish, plus a final quiz review. Keep it concise — just key prep steps and one pairing per dish."',
    addNotes: 'Add notes...',
    notesPlaceholder: 'Optional refinement notes for this tier...',
  },
  es: {
    loading: 'Generando opciones de profundidad...',
    error: 'Error al generar previsualizaciones',
    retry: 'Reintentar',
    sections: 'secciones',
    quickLabel: 'Resumen R\u00e1pido',
    standardLabel: 'Entrenamiento Est\u00e1ndar',
    deepLabel: 'Profundizaci\u00f3n',
    customLabel: 'Personalizado',
    customDesc: 'Dile a la IA exactamente lo que quieres — temas, cantidad de secciones, profundidad.',
    customPlaceholder: 'ej., "Quiero 4 secciones: una por cada plato, mas una revision final. Mantenlo conciso."',
    addNotes: 'Agregar notas...',
    notesPlaceholder: 'Notas opcionales de refinamiento...',
  },
};

const TIER_META: Record<Exclude<CourseDepth, 'custom'>, { icon: typeof Zap; range: string }> = {
  quick:    { icon: Zap,            range: '1-3' },
  standard: { icon: BookOpen,       range: '3-6' },
  deep:     { icon: GraduationCap,  range: '5-9' },
};

interface DepthSelectorProps {
  courseId: string | null;
  depth: CourseDepth;
  onDepthChange: (d: CourseDepth) => void;
  depthNotes: string;
  onDepthNotesChange: (n: string) => void;
  depthCustomPrompt: string;
  onDepthCustomPromptChange: (p: string) => void;
  depthPreview: DepthPreviewResponse | null;
  onDepthPreviewLoaded: (p: DepthPreviewResponse) => void;
  language: 'en' | 'es';
}

export function DepthSelector({
  courseId,
  depth,
  onDepthChange,
  depthNotes,
  onDepthNotesChange,
  depthCustomPrompt,
  onDepthCustomPromptChange,
  depthPreview,
  onDepthPreviewLoaded,
  language,
}: DepthSelectorProps) {
  const t = STRINGS[language];
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedNotes, setExpandedNotes] = useState<CourseDepth | null>(null);

  // Fetch depth preview on mount if not cached
  useEffect(() => {
    if (depthPreview || !courseId) return;
    fetchPreview();
  }, [courseId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchPreview() {
    if (!courseId) return;
    setIsLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await supabase.functions.invoke('build-course', {
        body: { step: 'depth_preview', course_id: courseId, language },
        headers: session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : undefined,
      });
      if (resp.error) throw resp.error;
      const result = resp.data as { ok: boolean; data: DepthPreviewResponse };
      if (result.ok && result.data) {
        onDepthPreviewLoaded(result.data);
      } else {
        throw new Error('Invalid response');
      }
    } catch (err) {
      console.error('[DepthSelector] Preview fetch error:', err);
      setError(t.error);
    } finally {
      setIsLoading(false);
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        <p className="text-sm text-muted-foreground">{t.loading}</p>
      </div>
    );
  }

  const tiers: Array<{ key: Exclude<CourseDepth, 'custom'>; preview: DepthTierPreview | null }> = [
    { key: 'quick', preview: depthPreview?.quick || null },
    { key: 'standard', preview: depthPreview?.standard || null },
    { key: 'deep', preview: depthPreview?.deep || null },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-label={language === 'es' ? 'Profundidad del curso' : 'Course depth'}>
      {error && !depthPreview && (
        <div className="sm:col-span-2 flex items-center justify-center gap-2 p-3 rounded-lg bg-destructive/10 text-sm">
          <span className="text-destructive">{error}</span>
          <button type="button" onClick={fetchPreview} className="font-medium text-orange-500 hover:text-orange-600 underline">
            {t.retry}
          </button>
        </div>
      )}
      {tiers.map(({ key, preview }) => {
        const meta = TIER_META[key];
        const Icon = meta.icon;
        const isSelected = depth === key;
        const label = t[`${key}Label` as keyof typeof t] as string;

        return (
          <div
            key={key}
            role="radio"
            aria-checked={isSelected}
            tabIndex={0}
            onClick={() => onDepthChange(key)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onDepthChange(key); } }}
            className={cn(
              'bg-card rounded-[20px] border shadow-sm p-5 text-left transition-all hover:shadow-md cursor-pointer',
              isSelected
                ? 'ring-2 ring-orange-500 border-orange-200'
                : 'border-black/[0.04] dark:border-white/[0.06]',
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Icon className={cn('h-5 w-5', isSelected ? 'text-orange-500' : 'text-muted-foreground')} />
                <span className="text-sm font-bold text-foreground">{label}</span>
              </div>
              {preview && (
                <span className="text-[10px] font-semibold bg-orange-100 text-orange-700 rounded-full px-2.5 py-0.5">
                  {preview.section_count} {t.sections}
                </span>
              )}
            </div>

            {preview && (
              <>
                <p className="text-[13px] text-muted-foreground leading-[1.5] mb-2">
                  {preview.summary}
                </p>
                <ul className="space-y-0.5">
                  {preview.topics.map((topic, i) => (
                    <li key={i} className="text-[12px] text-muted-foreground/80 flex items-start gap-1.5">
                      <span className="text-orange-400 mt-0.5">•</span>
                      <span>{topic}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {!preview && (
              <p className="text-[13px] text-muted-foreground italic">
                {meta.range} {t.sections}
              </p>
            )}

            {/* Expandable notes area */}
            {isSelected && (
              <div className="mt-3 pt-3 border-t border-border/50" onClick={(e) => e.stopPropagation()}>
                {expandedNotes === key ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground">{t.addNotes}</span>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setExpandedNotes(null); }}
                        className="text-muted-foreground hover:text-foreground p-0.5"
                      >
                        <ChevronUp className="h-3 w-3" />
                      </button>
                    </div>
                    <WizardRichInput
                      value={depthNotes}
                      onChange={onDepthNotesChange}
                      placeholder={t.notesPlaceholder}
                      textareaClassName="min-h-[60px] resize-none text-[12px]"
                      enableVoice
                      enableAttachments={false}
                      enableCamera={false}
                      language={language}
                      autoFocus
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setExpandedNotes(key); }}
                    className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ChevronDown className="h-3 w-3" />
                    {depthNotes ? depthNotes.slice(0, 50) + (depthNotes.length > 50 ? '...' : '') : t.addNotes}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Custom card */}
      <div
        role="radio"
        aria-checked={depth === 'custom'}
        tabIndex={0}
        onClick={() => onDepthChange('custom')}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onDepthChange('custom'); } }}
        className={cn(
          'bg-card rounded-[20px] border shadow-sm p-5 text-left transition-all hover:shadow-md cursor-pointer',
          depth === 'custom'
            ? 'ring-2 ring-orange-500 border-orange-200'
            : 'border-black/[0.04] dark:border-white/[0.06]',
        )}
      >
        <div className="flex items-center gap-2 mb-2">
          <Pencil className={cn('h-5 w-5', depth === 'custom' ? 'text-orange-500' : 'text-muted-foreground')} />
          <span className="text-sm font-bold text-foreground">{t.customLabel}</span>
        </div>
        <p className="text-[13px] text-muted-foreground leading-[1.5] mb-3">
          {t.customDesc}
        </p>
        {depth === 'custom' && (
          <div onClick={(e) => e.stopPropagation()}>
            <Textarea
              value={depthCustomPrompt}
              onChange={(e) => onDepthCustomPromptChange(e.target.value)}
              placeholder={t.customPlaceholder}
              className="min-h-[100px] resize-none text-[12px]"
              autoFocus
            />
            <p className={cn(
              'text-[10px] mt-1 text-right',
              depthCustomPrompt.trim().length >= 10 ? 'text-muted-foreground' : 'text-orange-500'
            )}>
              {depthCustomPrompt.trim().length}/10 min
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
