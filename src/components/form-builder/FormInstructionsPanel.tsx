// =============================================================================
// FormInstructionsPanel — Unified right-column panel for form instructions
//
// Three stacked sections:
//   A: Form Instructions (required, bilingual textarea + refine button)
//   B: AI Search Tools (toggle chips)
//   C: Special AI Instructions (collapsible hidden system prompt)
// =============================================================================

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Loader2,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBuilder } from '@/contexts/BuilderContext';
import { AIToolsSelector } from './AIToolsSelector';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

// =============================================================================
// STRINGS
// =============================================================================

const STRINGS = {
  en: {
    sectionA: 'Form Instructions',
    helperA:
      'These instructions serve two purposes: they guide employees on how to fill out the form correctly, and they are also read by the AI to assist users via voice, chat, or manual entry. The clearer and more detailed your instructions, the better the AI can help employees complete forms quickly and accurately.',
    placeholder: 'e.g. Walk the employee through each section. Look up contacts when asked...',
    generateBtn: 'Generate with AI',
    refineBtn: 'Refine with AI',
    generating: 'Generating...',
    refining: 'Refining...',
    refined: 'Refined',
    needsRefinement: 'Needs refinement',
    sectionB: 'AI Search Tools',
    autoNote: 'Auto-selected by AI during refinement. Tap to adjust.',
    sectionC: 'Special AI Instructions',
    helperC:
      'Hidden instructions only the AI sees at fill time. Use for business rules and edge cases.',
    placeholderC: 'e.g. Always ask for manager approval before marking "resolved"...',
    english: 'EN',
    spanish: 'ES',
  },
  es: {
    sectionA: 'Instrucciones del Formulario',
    helperA:
      'Estas instrucciones tienen dos propositos: guian a los empleados sobre como llenar el formulario correctamente, y tambien son leidas por la IA para asistir a los usuarios por voz, chat o entrada manual. Mientras mas claras y detalladas sean, mejor podra la IA ayudar a completar formularios de forma rapida y precisa.',
    placeholder: 'ej. Guia al empleado por cada seccion. Busca contactos cuando se pida...',
    generateBtn: 'Generar con IA',
    refineBtn: 'Refinar con IA',
    generating: 'Generando...',
    refining: 'Refinando...',
    refined: 'Refinado',
    needsRefinement: 'Necesita refinamiento',
    sectionB: 'Herramientas de Busqueda IA',
    autoNote: 'Auto-seleccionadas por la IA durante el refinamiento. Toca para ajustar.',
    sectionC: 'Instrucciones Especiales de IA',
    helperC:
      'Instrucciones ocultas que solo la IA ve al momento de llenar. Usa para reglas de negocio y casos especiales.',
    placeholderC: 'ej. Siempre pedir aprobacion del gerente antes de marcar "resuelto"...',
    english: 'EN',
    spanish: 'ES',
  },
} as const;

// =============================================================================
// PROPS
// =============================================================================

export interface FormInstructionsPanelProps {
  language: 'en' | 'es';
  onRefine: () => void;
  isRefining: boolean;
  refineError: string | null;
  /** AI explanation of what changed during refinement. */
  explanation?: string | null;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function FormInstructionsPanel({
  language,
  onRefine,
  isRefining,
  refineError,
  explanation,
}: FormInstructionsPanelProps) {
  const { state, dispatch } = useBuilder();
  const t = STRINGS[language];

  // Local language toggle for bilingual textarea
  const [instrLang, setInstrLang] = useState<'en' | 'es'>('en');
  const [systemPromptOpen, setSystemPromptOpen] = useState(false);

  const currentInstructions = instrLang === 'en' ? state.instructionsEn : state.instructionsEs;
  const isInstructionsEmpty = !state.instructionsEn.trim();
  const isGenerate = !state.instructionsRefined && isInstructionsEmpty === false;

  // Auto-growing textarea ref
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const autoGrow = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(160, el.scrollHeight)}px`;
  }, []);

  // Re-measure whenever content changes (including AI updates)
  useEffect(() => {
    autoGrow();
  }, [currentInstructions, autoGrow]);

  return (
    <div className="space-y-6">
      {/* ================================================================= */}
      {/* Section A: Form Instructions                                      */}
      {/* ================================================================= */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">{t.sectionA}</h3>
          {/* Refinement status badge */}
          {!isInstructionsEmpty && (
            state.instructionsRefined ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {t.refined}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                <AlertCircle className="h-3.5 w-3.5" />
                {t.needsRefinement}
              </span>
            )
          )}
        </div>

        <p className="text-xs text-muted-foreground">{t.helperA}</p>

        {/* Bilingual toggle */}
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setInstrLang('en')}
            className={cn(
              'px-2.5 py-1 text-xs font-medium rounded-full transition-colors',
              instrLang === 'en'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground',
            )}
          >
            {t.english}
          </button>
          <button
            type="button"
            onClick={() => setInstrLang('es')}
            className={cn(
              'px-2.5 py-1 text-xs font-medium rounded-full transition-colors',
              instrLang === 'es'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground',
            )}
          >
            {t.spanish}
          </button>
        </div>

        {/* Textarea (auto-growing) */}
        <textarea
          ref={textareaRef}
          value={currentInstructions}
          onChange={(e) => {
            dispatch({
              type: instrLang === 'en' ? 'SET_INSTRUCTIONS_EN' : 'SET_INSTRUCTIONS_ES',
              payload: e.target.value,
            });
          }}
          placeholder={t.placeholder}
          readOnly={isRefining}
          className={cn(
            'w-full min-h-[160px] p-3 text-sm rounded-lg border bg-background',
            'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary',
            'overflow-hidden resize-none',
            isRefining && 'opacity-60 cursor-not-allowed',
          )}
        />

        {/* Generate / Refine button + error */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onRefine}
            disabled={isInstructionsEmpty || isRefining}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
              'bg-primary text-primary-foreground hover:bg-primary/90',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            {isRefining ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {isGenerate ? t.generating : t.refining}
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                {isGenerate ? t.generateBtn : t.refineBtn}
              </>
            )}
          </button>
        </div>

        {refineError && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive">
            {refineError}
          </div>
        )}

        {/* Explanation banner — shown after successful refinement, dismissed on next edit */}
        {explanation && !refineError && !isRefining && state.instructionsRefined && (
          <div className="rounded-lg bg-primary/5 border border-primary/15 px-3 py-2 flex gap-2 items-start">
            <Info className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground leading-relaxed">{explanation}</p>
          </div>
        )}
      </div>

      {/* ================================================================= */}
      {/* Section B: AI Search Tools                                        */}
      {/* ================================================================= */}
      <div className="space-y-2 pt-2 border-t">
        <h3 className="text-sm font-semibold">{t.sectionB}</h3>
        <p className="text-xs text-muted-foreground">{t.autoNote}</p>
        <AIToolsSelector language={language} />
      </div>

      {/* ================================================================= */}
      {/* Section C: Special AI Instructions (collapsible)                  */}
      {/* ================================================================= */}
      <Collapsible open={systemPromptOpen} onOpenChange={setSystemPromptOpen}>
        <div className="pt-2 border-t">
          <CollapsibleTrigger className="flex items-center justify-between w-full text-left">
            <h3 className="text-sm font-semibold">{t.sectionC}</h3>
            <ChevronDown
              className={cn(
                'h-4 w-4 text-muted-foreground transition-transform',
                systemPromptOpen && 'rotate-180',
              )}
            />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3 space-y-2">
            <p className="text-xs text-muted-foreground">{t.helperC}</p>
            <textarea
              value={state.aiSystemPromptEn}
              onChange={(e) =>
                dispatch({ type: 'SET_AI_SYSTEM_PROMPT_EN', payload: e.target.value })
              }
              placeholder={t.placeholderC}
              className="w-full min-h-[100px] p-3 text-sm rounded-lg border bg-background resize-y focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </CollapsibleContent>
        </div>
      </Collapsible>
    </div>
  );
}
