// =============================================================================
// MenuRolloutWizard — 6-step wizard for creating a Menu Rollout course
// Steps: Details, Items, Course Depth, Assessment, Teacher, Review & Build
// On build: creates/updates course in DB, navigates to builder.
// =============================================================================

import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { WizardRichInput } from '@/components/ui/wizard-rich-input';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth';
import { useGroupId } from '@/hooks/useGroupId';
import { generateCourseSlug, getDefaultQuizConfig } from '@/lib/course-builder/builder-utils';
import { WizardStepLayout } from './WizardStepLayout';
import { SourceMaterialPicker } from './SourceMaterialPicker';
import { QuizModeSelector } from './QuizModeSelector';
import { TeacherLevelSelector } from './TeacherLevelSelector';
import { DepthSelector } from './DepthSelector';
import type { AttachmentData } from '@/components/forms/ai/AttachmentChip';
import type {
  SourceRef,
  QuizConfig,
  TeacherLevel,
  WizardConfig,
  CourseDepth,
  DepthPreviewResponse,
} from '@/types/course-builder';

const STRINGS = {
  en: {
    // Step 1 - Details
    step1Title: 'Course Details',
    step1Desc: 'Name and describe your new menu rollout course.',
    titleEn: 'Course Title (English)',
    titleEnPlaceholder: 'e.g., Spring Menu 2026 Launch',
    rolloutDetails: 'Rollout Details',
    rolloutDetailsPlaceholder: 'Describe this rollout — what\'s new, any focus areas, special instructions for the AI...',
    // Step 2 - Items
    step2Title: 'Select Menu Items',
    step2Desc: 'Choose the dishes, wines, cocktails, and more to include in this course.',
    // Step 3 - Course Depth
    step3Title: 'Course Depth',
    step3Desc: 'Choose how comprehensive the AI-generated course should be.',
    // Step 4 - Assessment
    step4Title: 'Assessment',
    step4Desc: 'Configure the quiz for this course.',
    // Step 5 - Audience Level
    step5Title: 'Audience Level',
    step5Desc: 'Who is this course designed for?',
    // Step 6 - Review
    step6Title: 'Review & Build',
    step6Desc: 'Review your selections and build the course.',
    reviewTitle: 'Title',
    reviewItems: 'Items',
    reviewDepth: 'Depth',
    reviewQuiz: 'Quiz',
    reviewTeacher: 'Audience',
    reviewQuestions: 'questions',
    reviewPassing: 'passing score',
    noItems: 'No items selected',
    depthQuick: 'Quick Briefing (1\u20133 sections)',
    depthStandard: 'Standard Training (3\u20136 sections)',
    depthDeep: 'Deep Dive (5\u20139 sections)',
    depthCustom: 'Custom',
    reviewAttachments: 'Attachments',
    buildSuccess: 'Course created!',
    buildError: 'Failed to create course',
  },
  es: {
    step1Title: 'Detalles del Curso',
    step1Desc: 'Nombra y describe tu nuevo curso de lanzamiento de menu.',
    titleEn: 'Titulo del Curso (Ingles)',
    titleEnPlaceholder: 'ej., Lanzamiento Menu Primavera 2026',
    rolloutDetails: 'Detalles del Lanzamiento',
    rolloutDetailsPlaceholder: 'Describe este lanzamiento — que hay de nuevo, areas de enfoque, instrucciones especiales para la IA...',
    step2Title: 'Seleccionar Items del Menu',
    step2Desc: 'Elige los platos, vinos, cocteles y mas para incluir en este curso.',
    step3Title: 'Profundidad del Curso',
    step3Desc: 'Elige que tan completo debe ser el curso generado por IA.',
    step4Title: 'Evaluacion',
    step4Desc: 'Configura el cuestionario para este curso.',
    step5Title: 'Nivel de Audiencia',
    step5Desc: '¿Para quién está diseñado este curso?',
    step6Title: 'Revisar y Crear',
    step6Desc: 'Revisa tus selecciones y crea el curso.',
    reviewTitle: 'Titulo',
    reviewItems: 'Items',
    reviewDepth: 'Profundidad',
    reviewQuiz: 'Cuestionario',
    reviewTeacher: 'Audiencia',
    reviewQuestions: 'preguntas',
    reviewPassing: 'puntaje de aprobacion',
    noItems: 'No hay items seleccionados',
    depthQuick: 'Resumen R\u00e1pido (1\u20133 secciones)',
    depthStandard: 'Entrenamiento Est\u00e1ndar (3\u20136 secciones)',
    depthDeep: 'Profundizaci\u00f3n (5\u20139 secciones)',
    depthCustom: 'Personalizado',
    reviewAttachments: 'Archivos adjuntos',
    buildSuccess: '¡Curso creado!',
    buildError: 'Error al crear el curso',
  },
};

const TEACHER_LABELS = {
  en: { new_hire: 'New Hire', developing: 'Developing', experienced: 'Experienced', veteran: 'Veteran' },
  es: { new_hire: 'Nuevo Ingreso', developing: 'En Desarrollo', experienced: 'Experimentado', veteran: 'Veterano' },
};

const TOTAL_STEPS = 6;

interface MenuRolloutWizardProps {
  open: boolean;
  onClose: () => void;
  language?: 'en' | 'es';
}

export function MenuRolloutWizard({ open, onClose, language = 'en' }: MenuRolloutWizardProps) {
  const t = STRINGS[language];
  const navigate = useNavigate();
  const { user } = useAuth();
  const groupId = useGroupId();

  // Wizard local state
  const isCreatingRef = useRef(false);
  const isBuildingRef = useRef(false);
  const [step, setStep] = useState(0);
  const [titleEn, setTitleEn] = useState('');
  const [descriptionEn, setDescriptionEn] = useState('');
  const [selectedItems, setSelectedItems] = useState<SourceRef[]>([]);
  const [depth, setDepth] = useState<CourseDepth>('quick');
  const [depthNotes, setDepthNotes] = useState('');
  const [depthCustomPrompt, setDepthCustomPrompt] = useState('');
  const [depthPreview, setDepthPreview] = useState<DepthPreviewResponse | null>(null);
  const [courseId, setCourseId] = useState<string | null>(null);
  const [quizConfig, setQuizConfig] = useState<QuizConfig>(getDefaultQuizConfig());
  const [teacherLevel, setTeacherLevel] = useState<TeacherLevel>('developing');
  const [isBuilding, setIsBuilding] = useState(false);
  const [wizardAttachments, setWizardAttachments] = useState<AttachmentData[]>([]);

  // Invalidate depth preview when selected items change
  useEffect(() => {
    setDepthPreview(null);
  }, [selectedItems]);

  // Step validation
  const canGoNext = (() => {
    switch (step) {
      case 0: return titleEn.trim().length >= 3;
      case 1: return true; // items are optional, user might build a manual course
      case 2: return depth === 'custom' ? depthCustomPrompt.trim().length >= 10 : true;
      case 3: return true; // quiz defaults are fine
      case 4: return true; // teacher defaults are fine
      case 5: return true; // review step, ready to build
      default: return false;
    }
  })();

  const handleNext = async () => {
    // Create course on first forward step if not created yet
    if (step === 0 && !courseId && !isCreatingRef.current && groupId && user?.id) {
      isCreatingRef.current = true;
      try {
        const shortId = Math.random().toString(36).slice(2, 7);
        const slug = `${generateCourseSlug(titleEn)}-${shortId}`;
        const { data, error } = await supabase
          .from('courses')
          .insert({
            group_id: groupId,
            slug,
            title_en: titleEn.trim(),
            title_es: null,
            description_en: descriptionEn.trim() || null,
            description_es: null,
            icon: 'UtensilsCrossed',
            course_type: 'menu_rollout',
            status: 'draft',
            version: 1,
            teacher_level: teacherLevel,
            quiz_config: quizConfig as unknown as Record<string, unknown>,
            wizard_config: {} as unknown as Record<string, unknown>,
            created_by: user.id,
          })
          .select('id')
          .single();
        if (!error && data) {
          setCourseId(data.id);
        }
      } catch (err) {
        console.error('[MenuRolloutWizard] Early course create error:', err);
      } finally {
        isCreatingRef.current = false;
      }
    }

    // Update wizard_config with selected items when moving from step 1 to step 2
    if (step === 1 && courseId) {
      const sourceProductsMap = new Map<string, string[]>();
      for (const ref of selectedItems) {
        const ids = sourceProductsMap.get(ref.table) || [];
        ids.push(ref.id);
        sourceProductsMap.set(ref.table, ids);
      }
      const sourceProducts = Array.from(sourceProductsMap.entries()).map(
        ([table, ids]) => ({ table, ids }),
      );
      await supabase.from('courses').update({
        description_en: descriptionEn.trim() || null,
        wizard_config: {
          courseType: 'menu_rollout',
          title: titleEn.trim(),
          description: descriptionEn.trim(),
          ai_instructions: descriptionEn.trim(),
          source_sections: [],
          source_products: sourceProducts,
          selectedSourceIds: selectedItems,
        } as unknown as Record<string, unknown>,
      }).eq('id', courseId);
    }

    if (step < TOTAL_STEPS - 1) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const resetWizardState = useCallback(() => {
    setStep(0);
    setTitleEn('');
    setDescriptionEn('');
    setSelectedItems([]);
    setDepth('quick');
    setDepthNotes('');
    setDepthCustomPrompt('');
    setDepthPreview(null);
    setCourseId(null);
    setQuizConfig(getDefaultQuizConfig());
    setTeacherLevel('developing');
    // Revoke object URLs before clearing attachments
    wizardAttachments.forEach((att) => {
      if (att.previewUrl) URL.revokeObjectURL(att.previewUrl);
    });
    setWizardAttachments([]);
    onClose();
  }, [onClose, wizardAttachments]);

  const handleCancel = async () => {
    if (courseId) {
      try {
        // Clean up uploaded attachment files from storage
        const attPaths = wizardAttachments
          .filter((a) => a.storagePath)
          .map((a) => a.storagePath!);
        if (attPaths.length > 0) {
          await supabase.storage.from('course-media').remove(attPaths);
        }
        await supabase.from('courses').delete().eq('id', courseId).eq('group_id', groupId);
      } catch (err) {
        console.error('[MenuRolloutWizard] Failed to clean up draft course:', err);
      }
    }
    resetWizardState();
  };

  const handleBuild = useCallback(async () => {
    if (isBuildingRef.current) return;
    if (!groupId || !user?.id) {
      console.error('[MenuRolloutWizard] Missing groupId or user:', { groupId, userId: user?.id });
      toast.error('Unable to create course — group not loaded. Please try again.');
      return;
    }
    isBuildingRef.current = true;
    setIsBuilding(true);

    try {
      // Group selected items by table for edge function compatibility
      const sourceProductsMap = new Map<string, string[]>();
      for (const ref of selectedItems) {
        const ids = sourceProductsMap.get(ref.table) || [];
        ids.push(ref.id);
        sourceProductsMap.set(ref.table, ids);
      }
      const sourceProducts = Array.from(sourceProductsMap.entries()).map(
        ([table, ids]) => ({ table, ids }),
      );

      // ── Upload attachment files to course-media bucket ──────────────
      const effectiveCourseId = courseId || crypto.randomUUID();
      const uploadedPaths: string[] = [];
      const failedUploads: string[] = [];
      const filesToUpload = wizardAttachments.filter((a) => a.file);

      for (const att of filesToUpload) {
        const ext = att.name.split('.').pop() || 'bin';
        const storagePath = `${effectiveCourseId}/attachments/${att.id}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('course-media')
          .upload(storagePath, att.file!, { contentType: att.file!.type, upsert: true });
        if (uploadErr) {
          console.error(`[MenuRolloutWizard] Upload failed for ${att.name}:`, uploadErr.message);
          failedUploads.push(att.name);
        } else {
          uploadedPaths.push(storagePath);
          att.storagePath = storagePath;
        }
      }

      // Warn user about failed uploads
      if (failedUploads.length > 0) {
        const msg = failedUploads.length === filesToUpload.length
          ? (language === 'es' ? 'No se pudieron subir los archivos' : 'All file uploads failed')
          : (language === 'es'
            ? `${failedUploads.length} archivo(s) no se pudieron subir`
            : `${failedUploads.length} file(s) failed to upload`);
        toast.warning(msg);
      }

      const wizardConfig: WizardConfig = {
        courseType: 'menu_rollout',
        title: titleEn.trim(),
        description: descriptionEn.trim(),
        selectedSourceIds: selectedItems,
        teacherLevel,
        teacherId: null,
        quizConfig,
        additionalInstructions: descriptionEn.trim(),
        assignTo: { mode: 'all_staff' },
        deadline: null,
        expiresAt: null,
        depth,
        depth_notes: depthNotes.trim(),
        depth_custom_prompt: depth === 'custom' ? depthCustomPrompt.trim() : '',
        depth_preview: depthPreview,
        // Edge-function-compatible fields (handleOutline reads these)
        ai_instructions: descriptionEn.trim(),
        source_sections: [] as string[],
        source_products: sourceProducts,
        // Uploaded attachment storage paths
        ...(uploadedPaths.length > 0 ? { attachments: uploadedPaths } : {}),
      };

      if (courseId) {
        // ── Update existing course (created early in wizard) ──────────────
        const { error } = await supabase
          .from('courses')
          .update({
            title_en: titleEn.trim(),
            title_es: null,
            description_en: descriptionEn.trim() || null,
            description_es: null,
            teacher_level: teacherLevel,
            quiz_config: quizConfig as unknown as Record<string, unknown>,
            wizard_config: wizardConfig as unknown as Record<string, unknown>,
          })
          .eq('id', courseId);
        if (error) throw error;

        console.log('[MenuRolloutWizard] Course updated:', courseId);
        toast.success(language === 'es'
          ? '¡Curso creado! Generando contenido...'
          : 'Course created! Building your course...');

        navigate(`/admin/courses/${courseId}/edit`, { state: { autoBuild: true } });
      } else {
        // ── Fallback: create new (shouldn't happen normally) ─────────────
        const shortId = Math.random().toString(36).slice(2, 7);
        const slug = `${generateCourseSlug(titleEn)}-${shortId}`;

        const { data, error } = await supabase
          .from('courses')
          .insert({
            group_id: groupId,
            slug,
            title_en: titleEn.trim(),
            title_es: null,
            description_en: descriptionEn.trim() || null,
            description_es: null,
            icon: 'UtensilsCrossed',
            course_type: 'menu_rollout',
            status: 'draft',
            version: 1,
            teacher_level: teacherLevel,
            quiz_config: quizConfig as unknown as Record<string, unknown>,
            wizard_config: wizardConfig as unknown as Record<string, unknown>,
            created_by: user.id,
          })
          .select('id, updated_at')
          .single();

        if (error) throw error;

        console.log('[MenuRolloutWizard] Course created:', data.id);
        toast.success(language === 'es'
          ? '¡Curso creado! Generando contenido...'
          : 'Course created! Building your course...');

        navigate(`/admin/courses/${data.id}/edit`, { state: { autoBuild: true } });
      }

      resetWizardState();
    } catch (err) {
      console.error('[MenuRolloutWizard] Build error:', err);
      toast.error(t.buildError);
      // Clean up uploaded files on build failure
      if (uploadedPaths.length > 0) {
        supabase.storage.from('course-media').remove(uploadedPaths).catch(() => {});
      }
    } finally {
      isBuildingRef.current = false;
      setIsBuilding(false);
    }
  }, [
    groupId, user?.id, titleEn, descriptionEn,
    selectedItems, depth, depthNotes, depthCustomPrompt, depthPreview,
    courseId, quizConfig, teacherLevel, navigate, t, resetWizardState, language,
    wizardAttachments,
  ]);

  // Step titles/descriptions
  const stepConfig = [
    { title: t.step1Title, description: t.step1Desc },
    { title: t.step2Title, description: t.step2Desc },
    { title: t.step3Title, description: t.step3Desc },
    { title: t.step4Title, description: t.step4Desc },
    { title: t.step5Title, description: t.step5Desc },
    { title: t.step6Title, description: t.step6Desc },
  ];

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleCancel(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[90dvh] p-0 gap-0 overflow-hidden">
        <WizardStepLayout
          currentStep={step}
          totalSteps={TOTAL_STEPS}
          title={stepConfig[step].title}
          description={stepConfig[step].description}
          onBack={handleBack}
          onNext={handleNext}
          onCancel={handleCancel}
          canGoNext={canGoNext}
          isLastStep={step === TOTAL_STEPS - 1}
          onBuild={handleBuild}
          isBuilding={isBuilding}
          language={language}
        >
          {/* Step 1: Course Details */}
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">{t.titleEn}</Label>
                <Input
                  value={titleEn}
                  onChange={(e) => setTitleEn(e.target.value)}
                  placeholder={t.titleEnPlaceholder}
                  className="mt-1"
                  autoFocus
                />
              </div>
              <WizardRichInput
                label={t.rolloutDetails}
                value={descriptionEn}
                onChange={setDescriptionEn}
                placeholder={t.rolloutDetailsPlaceholder}
                textareaClassName="min-h-[140px]"
                enableVoice
                enableAttachments
                enableCamera
                language={language}
                attachments={wizardAttachments}
                onAttachmentsChange={setWizardAttachments}
              />
            </div>
          )}

          {/* Step 2: Item Selection */}
          {step === 1 && (
            <SourceMaterialPicker
              selectedItems={selectedItems}
              onSelectionChange={setSelectedItems}
              language={language}
            />
          )}

          {/* Step 3: Course Depth */}
          {step === 2 && (
            <DepthSelector
              courseId={courseId}
              depth={depth}
              onDepthChange={setDepth}
              depthNotes={depthNotes}
              onDepthNotesChange={setDepthNotes}
              depthCustomPrompt={depthCustomPrompt}
              onDepthCustomPromptChange={setDepthCustomPrompt}
              depthPreview={depthPreview}
              onDepthPreviewLoaded={setDepthPreview}
              language={language}
            />
          )}

          {/* Step 4: Assessment */}
          {step === 3 && (
            <QuizModeSelector
              quizConfig={quizConfig}
              onChange={(partial) => setQuizConfig((prev) => ({ ...prev, ...partial }))}
              language={language}
            />
          )}

          {/* Step 5: Teacher Level */}
          {step === 4 && (
            <TeacherLevelSelector
              value={teacherLevel}
              onChange={setTeacherLevel}
              language={language}
            />
          )}

          {/* Step 6: Review & Build */}
          {step === 5 && (
            <div className="space-y-4">
              <ReviewRow label={t.reviewTitle} value={titleEn || '---'} />
              <ReviewRow
                label={t.reviewItems}
                value={
                  selectedItems.length > 0
                    ? `${selectedItems.length} items`
                    : t.noItems
                }
              />
              <ReviewRow
                label={t.reviewDepth}
                value={
                  depth === 'custom' ? t.depthCustom :
                  depth === 'quick' ? t.depthQuick :
                  depth === 'standard' ? t.depthStandard :
                  t.depthDeep
                }
              />
              <ReviewRow
                label={t.reviewQuiz}
                value={`${quizConfig.question_count} ${t.reviewQuestions}, ${quizConfig.passing_score}% ${t.reviewPassing}`}
              />
              <ReviewRow
                label={t.reviewTeacher}
                value={TEACHER_LABELS[language][teacherLevel]}
              />
              {wizardAttachments.length > 0 && (
                <ReviewRow
                  label={t.reviewAttachments}
                  value={`${wizardAttachments.length} ${wizardAttachments.length === 1 ? 'file' : 'files'}`}
                />
              )}
            </div>
          )}
        </WizardStepLayout>
      </DialogContent>
    </Dialog>
  );
}

// --- Helper: Review row ---
function ReviewRow({ label, value, truncate }: { label: string; value: string; truncate?: boolean }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
      <div className="shrink-0 flex items-center justify-center h-6 w-6 rounded-full bg-orange-500/10">
        <Check className="h-3.5 w-3.5 text-orange-500" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase text-muted-foreground tracking-wider">{label}</p>
        <p className={cn('text-sm font-medium mt-0.5', truncate && 'line-clamp-2')}>{value}</p>
      </div>
    </div>
  );
}
