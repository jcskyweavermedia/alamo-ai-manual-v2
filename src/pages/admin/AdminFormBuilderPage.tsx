// =============================================================================
// AdminFormBuilderPage — Main form builder page
// Desktop: two-column layout (editor left, preview/properties right)
// Mobile: single column with tab switching (Fields/Settings/Preview)
// Loads existing template for edit mode, creates new for new mode
// =============================================================================

import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { FileText, Settings as SettingsIcon, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { BuilderProvider, useBuilder } from '@/contexts/BuilderContext';
import { useAuth } from '@/components/auth';
import { useRefineInstructions, summarizeFields } from '@/hooks/useRefineInstructions';
import { BuilderTopBar } from '@/components/form-builder/BuilderTopBar';
import { FieldBlockList } from '@/components/form-builder/FieldBlockList';
import { BuilderCanvas } from '@/components/form-builder/BuilderCanvas';
import { FieldPalette, PALETTE_DRAG_PREFIX } from '@/components/form-builder/FieldPalette';
import { InstructionsEditor } from '@/components/form-builder/InstructionsEditor';
import { SettingsTab } from '@/components/form-builder/SettingsTab';
import { AdvancedPanel } from '@/components/form-builder/AdvancedPanel';
import { FormInstructionsPanel } from '@/components/form-builder/FormInstructionsPanel';
import { AIBuilderPanel } from '@/components/form-builder/AIBuilderPanel';
import { useGroupId } from '@/hooks/useGroupId';
import { generateSlug } from '@/lib/form-builder/builder-utils';
import { transformTemplateRow } from '@/lib/form-utils';
import type { FormFieldType } from '@/types/forms';
import type { BuilderState } from '@/types/form-builder';

// =============================================================================
// STRINGS
// =============================================================================

const STRINGS = {
  en: {
    loading: 'Loading...',
    fields: 'Fields',
    settings: 'Settings',
    preview: 'Preview',
    instructions: 'Form Instructions',
    aiBuilder: 'AI Builder',
  },
  es: {
    loading: 'Cargando...',
    fields: 'Campos',
    settings: 'Ajustes',
    preview: 'Vista Previa',
    instructions: 'Instrucciones del Formulario',
    aiBuilder: 'Constructor IA',
  },
};

// Mobile tab type (distinct from BuilderTab which has more tabs)
type MobileView = 'fields' | 'settings' | 'preview';

// Desktop right panel tab (when no field selected)
type RightTab = 'instructions' | 'ai-builder' | 'settings';

// =============================================================================
// PAGE WRAPPER — provides BuilderProvider
// =============================================================================

export default function AdminFormBuilderPage() {
  return (
    <BuilderProvider>
      <BuilderPageContent />
    </BuilderProvider>
  );
}

// =============================================================================
// PAGE CONTENT — inside BuilderProvider
// =============================================================================

function BuilderPageContent() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { language = 'en', user } = useAuth();
  const lang = (language === 'es' ? 'es' : 'en') as 'en' | 'es';
  const t = STRINGS[lang];
  const { state, dispatch, addField, addFieldAtIndex, moveField, saveDraft } = useBuilder();
  const groupId = useGroupId();
  const [initialLoading, setInitialLoading] = useState(!!id);
  const [mobileView, setMobileView] = useState<MobileView>('fields');
  const openAIBuilder = (location.state as { openAIBuilder?: boolean } | null)?.openAIBuilder;
  const [rightTab, setRightTab] = useState<RightTab>(openAIBuilder ? 'ai-builder' : 'instructions');

  // AI refinement
  const { refine, isRefining, error: refineError } = useRefineInstructions();
  const [refineExplanation, setRefineExplanation] = useState<string | null>(null);

  // --- Page-level DnD sensors (shared by palette + field list) ---
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // --- Page-level DnD drag end handler ---
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over) return;

      const activeId = String(active.id);

      // Palette → canvas: insert new field
      if (activeId.startsWith(PALETTE_DRAG_PREFIX)) {
        const fieldType = activeId.replace(PALETTE_DRAG_PREFIX, '') as FormFieldType;
        const overId = String(over.id);
        // If dropped on an existing field, insert at that field's index
        const overIndex = state.fields.findIndex(f => f.key === overId);
        if (overIndex !== -1) {
          addFieldAtIndex(fieldType, overIndex);
        } else {
          // Dropped on the list container or empty area — append
          addField(fieldType);
        }
        return;
      }

      // Canvas → canvas: reorder existing field
      if (active.id !== over.id) {
        moveField(activeId, String(over.id));
      }
    },
    [state.fields, addField, addFieldAtIndex, moveField],
  );

  // Load existing template on mount (edit mode)
  useEffect(() => {
    if (!id) return;

    async function loadTemplate() {
      const { data, error } = await supabase
        .from('form_templates')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) {
        console.error('[Builder] Load error:', error);
        navigate('/admin/forms');
        return;
      }

      const tmpl = transformTemplateRow(data);
      dispatch({
        type: 'HYDRATE',
        payload: {
          templateId: tmpl.id,
          slug: tmpl.slug,
          titleEn: tmpl.titleEn,
          titleEs: tmpl.titleEs || '',
          descriptionEn: tmpl.descriptionEn || '',
          descriptionEs: tmpl.descriptionEs || '',
          icon: tmpl.icon,
          iconColor: tmpl.iconColor,
          status: tmpl.status,
          templateVersion: tmpl.templateVersion,
          publishedAt: tmpl.publishedAt || null,
          fields: tmpl.fields,
          instructionsEn: tmpl.instructionsEn || '',
          instructionsEs: tmpl.instructionsEs || '',
          aiTools: tmpl.aiTools,
          aiSystemPromptEn: tmpl.aiSystemPromptEn || '',
          aiSystemPromptEs: tmpl.aiSystemPromptEs || '',
          instructionsRefined: tmpl.instructionsRefined,
          serverUpdatedAt: tmpl.updatedAt,
        },
      });
      setInitialLoading(false);
    }

    loadTemplate();
  }, [id, dispatch, navigate]);

  // Create new template on mount (new mode)
  // If location.state.aiDraft exists, apply the AI-generated draft after creation
  useEffect(() => {
    if (id || state.templateId) return;

    // Extract AI draft from location state (if navigated from FormCreationDialog)
    const aiDraft = (location.state as { aiDraft?: Partial<BuilderState> } | null)?.aiDraft;

    async function createTemplate() {
      if (!groupId) return;

      const titleFromDraft = aiDraft?.titleEn;
      const shortId = Math.random().toString(36).slice(2, 7);
      const slug = `${generateSlug(titleFromDraft || state.titleEn || 'untitled-form')}-${shortId}`;
      const { data, error } = await supabase
        .from('form_templates')
        .insert({
          group_id: groupId,
          slug,
          title_en: titleFromDraft || state.titleEn || 'Untitled Form',
          icon: aiDraft?.icon || '📋',
          icon_color: aiDraft?.iconColor || 'blue',
          fields: (aiDraft?.fields ?? []) as unknown as Record<string, unknown>[],
          ai_tools: aiDraft?.aiTools ?? [],
          status: 'draft',
          template_version: 1,
          created_by: user?.id,
        })
        .select('id, slug, updated_at')
        .single();

      if (error) {
        console.error('[Builder] Create error:', error);
        return;
      }

      // Hydrate with template identity
      dispatch({
        type: 'HYDRATE',
        payload: {
          templateId: data.id,
          slug: data.slug,
          serverUpdatedAt: data.updated_at,
        },
        preserveUIState: true,
      });

      // Apply AI-generated draft if present
      if (aiDraft) {
        dispatch({
          type: 'AI_GENERATE_SUCCESS',
          payload: {
            ...aiDraft,
            instructionsRefined: true,
          },
        });
      }

      // Update URL without full navigation and clear location state
      window.history.replaceState(null, '', `/admin/forms/${data.id}/edit`);
    }

    createTemplate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, state.templateId, user?.id, dispatch, groupId]);

  // Refinement handler
  const handleRefine = useCallback(async () => {
    if (!state.instructionsEn.trim() || isRefining || !groupId) return;
    setRefineExplanation(null);

    const result = await refine({
      rawInstructions: state.instructionsEn,
      templateContext: {
        title: state.titleEn || 'Untitled Form',
        titleEs: state.titleEs,
        descriptionEn: state.descriptionEn,
        descriptionEs: state.descriptionEs,
        fields: summarizeFields(state.fields),
        enabledTools: state.aiTools,
      },
      language: 'en',
      groupId,
    });

    if (result) {
      dispatch({
        type: 'ACCEPT_REFINEMENT_RESULT',
        payload: {
          instructionsEn: result.refinedInstructions,
          instructionsEs: result.refinedInstructionsEs || state.instructionsEs,
          aiTools: result.recommendedTools.length > 0 ? result.recommendedTools : state.aiTools,
          aiSystemPromptEn: result.suggestedSystemPrompt || state.aiSystemPromptEn,
          titleEn: result.suggestedTitleEn,
          titleEs: result.suggestedTitleEs,
          descriptionEn: result.suggestedDescriptionEn,
          descriptionEs: result.suggestedDescriptionEs,
          icon: result.suggestedIcon,
          iconColor: result.suggestedIconColor,
          fieldCorrections: result.suggestedFieldCorrections,
        },
      });
      setRefineExplanation(result.explanation || null);
    }
  }, [state.instructionsEn, state.titleEn, state.titleEs, state.descriptionEn, state.descriptionEs, state.fields, state.aiTools, state.instructionsEs, state.aiSystemPromptEn, isRefining, refine, dispatch, groupId]);

  // Manual save with auto-refinement
  const handleManualSave = useCallback(async () => {
    if (state.instructionsEn.trim() && !state.instructionsRefined) {
      await handleRefine();
    }
    await saveDraft();
  }, [state.instructionsEn, state.instructionsRefined, handleRefine, saveDraft]);

  // Loading state
  if (initialLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">{t.loading}</span>
        </div>
      </div>
    );
  }

  // Mobile tab bar segments
  const mobileTabs: { key: MobileView; label: string }[] = [
    { key: 'fields', label: t.fields },
    { key: 'settings', label: t.settings },
    { key: 'preview', label: t.preview },
  ];

  // Right panel: field properties only when gear icon was clicked, otherwise Instructions/Settings tabs
  const showAdvancedPanel = state.rightPanelMode === 'field-properties' && !!state.selectedFieldKey;
  const rightPanelContent =
    showAdvancedPanel ? (
      <AdvancedPanel language={lang} />
    ) : rightTab === 'ai-builder' ? (
      <AIBuilderPanel language={lang} groupId={groupId} />
    ) : rightTab === 'instructions' ? (
      <FormInstructionsPanel
        language={lang}
        onRefine={handleRefine}
        isRefining={isRefining}
        refineError={refineError}
        explanation={refineExplanation}
      />
    ) : (
      <SettingsTab language={lang} />
    );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      modifiers={[restrictToVerticalAxis]}
    >
      <div className="h-dvh bg-background flex flex-col overflow-hidden">
        {/* Top bar with title, save, undo/redo */}
        <BuilderTopBar language={lang} onSave={handleManualSave} />

        {/* Desktop layout: palette + canvas + right panel */}
        <div className="flex-1 flex flex-col lg:flex-row min-h-0">
          {/* ============================================= */}
          {/* LEFT SIDEBAR — Field Palette (desktop only)   */}
          {/* ============================================= */}
          <div className="hidden lg:flex lg:flex-col min-h-0">
            <FieldPalette language={lang} onClickAdd={addField} />
          </div>

          {/* ============================================= */}
          {/* CENTER COLUMN — Canvas (desktop + mobile)     */}
          {/* ============================================= */}
          <div className="flex-1 flex flex-col min-h-0 min-w-0 lg:border-r lg:basis-1/2">
            {/* Mobile: segmented tab bar (Fields/Settings/Preview) */}
            <div className="lg:hidden border-b shrink-0">
              <div className="flex gap-0 px-4 py-1">
                {mobileTabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setMobileView(tab.key)}
                    className={cn(
                      'flex-1 py-2 text-sm font-medium text-center rounded-lg transition-colors',
                      mobileView === tab.key
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Desktop: canvas always visible */}
            <div className="hidden lg:block flex-1 overflow-y-auto min-h-0 p-4">
              <BuilderCanvas language={lang} />
            </div>

            {/* Mobile: content based on mobileView */}
            <div className={cn(
              'lg:hidden flex-1 min-h-0',
              state.activeTab === 'ai-tools' ? '' : 'overflow-y-auto p-4',
            )}>
              {mobileView === 'fields' && (
                <>
                  {/* On mobile, show the BuilderTabBar-style sub-tabs for fields/instructions/ai-tools */}
                  <div className="flex gap-1 mb-4 -mt-1">
                    {([
                      { key: 'fields' as const, label: lang === 'es' ? 'Campos' : 'Fields' },
                      { key: 'instructions' as const, label: lang === 'es' ? 'Instrucciones' : 'Instructions' },
                      { key: 'ai-tools' as const, label: lang === 'es' ? 'Constructor IA' : 'AI Builder' },
                    ]).map((sub) => (
                      <button
                        key={sub.key}
                        onClick={() => dispatch({ type: 'SET_ACTIVE_TAB', payload: sub.key })}
                        className={cn(
                          'px-2.5 py-1 text-xs font-medium rounded-full transition-colors',
                          state.activeTab === sub.key
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {sub.label}
                      </button>
                    ))}
                  </div>
                  {state.activeTab === 'fields' && <FieldBlockList language={lang} />}
                  {state.activeTab === 'instructions' && <InstructionsEditor language={lang} />}
                  {state.activeTab === 'ai-tools' && <AIBuilderPanel language={lang} groupId={groupId} />}
                </>
              )}
              {mobileView === 'settings' && <SettingsTab language={lang} />}
            </div>
          </div>

          {/* ============================================= */}
          {/* RIGHT COLUMN — Instructions / Settings / Props (desktop) */}
          {/* ============================================= */}
          <div
            className={cn(
              'hidden lg:flex lg:flex-col',
              'lg:basis-[40%] shrink-0',
              'min-h-0',
              'bg-muted/30',
            )}
          >
            {/* Mini tab bar (only when no field selected) */}
            {!showAdvancedPanel && (
              <div className="flex border-b border-black/[0.04] dark:border-white/[0.06] px-4 shrink-0">
                {([
                  { key: 'instructions' as const, label: t.instructions, Icon: FileText },
                  { key: 'ai-builder' as const, label: t.aiBuilder, Icon: Sparkles },
                  { key: 'settings' as const, label: t.settings, Icon: SettingsIcon },
                ] as const).map(({ key, label, Icon }) => (
                  <button
                    key={key}
                    onClick={() => setRightTab(key)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium',
                      'border-b-2 transition-colors',
                      rightTab === key
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                ))}
              </div>
            )}
            <div className={cn(
              "flex-1 min-h-0",
              rightTab === 'ai-builder' && !showAdvancedPanel
                ? ''
                : 'overflow-y-auto p-4'
            )}>
              {rightPanelContent}
            </div>
          </div>
        </div>
      </div>
    </DndContext>
  );
}
