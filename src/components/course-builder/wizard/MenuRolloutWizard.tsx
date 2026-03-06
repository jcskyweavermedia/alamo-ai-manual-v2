// =============================================================================
// MenuRolloutWizard — 6-step wizard for creating a Menu Rollout course
// Steps: Details, Items, AI Instructions, Assessment, Teacher, Review & Build
// On build: creates course in DB, generates outline via edge function.
// =============================================================================

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import type {
  SourceRef,
  QuizConfig,
  TeacherLevel,
  WizardConfig,
} from '@/types/course-builder';

const STRINGS = {
  en: {
    // Step 1 - Details
    step1Title: 'Course Details',
    step1Desc: 'Name and describe your new menu rollout course.',
    titleEn: 'Course Title (English)',
    titleEnPlaceholder: 'e.g., Spring Menu 2026 Launch',
    titleEs: 'Course Title (Spanish)',
    titleEsPlaceholder: 'e.g., Lanzamiento Menu Primavera 2026',
    descriptionEn: 'Description (English)',
    descriptionEnPlaceholder: 'Brief description of the course...',
    descriptionEs: 'Description (Spanish)',
    descriptionEsPlaceholder: 'Breve descripcion del curso...',
    // Step 2 - Items
    step2Title: 'Select Menu Items',
    step2Desc: 'Choose the dishes, wines, cocktails, and more to include in this course.',
    // Step 3 - AI Instructions
    step3Title: 'AI Instructions',
    step3Desc: 'Optional instructions to guide how the AI generates course content.',
    instructionsPlaceholder: 'e.g., Focus on allergen warnings, include pairing suggestions for each dish, emphasize presentation standards...',
    // Step 4 - Assessment
    step4Title: 'Assessment',
    step4Desc: 'Configure the quiz for this course.',
    // Step 5 - Teacher
    step5Title: 'Teaching Style',
    step5Desc: 'Choose the AI teacher personality for this course.',
    // Step 6 - Review
    step6Title: 'Review & Build',
    step6Desc: 'Review your selections and build the course.',
    reviewTitle: 'Title',
    reviewItems: 'Items',
    reviewInstructions: 'AI Instructions',
    reviewQuiz: 'Quiz',
    reviewTeacher: 'Teacher',
    reviewQuestions: 'questions',
    reviewPassing: 'passing score',
    noItems: 'No items selected',
    noInstructions: 'None',
    buildSuccess: 'Course created!',
    buildError: 'Failed to create course',
  },
  es: {
    step1Title: 'Detalles del Curso',
    step1Desc: 'Nombra y describe tu nuevo curso de lanzamiento de menu.',
    titleEn: 'Titulo del Curso (Ingles)',
    titleEnPlaceholder: 'ej., Lanzamiento Menu Primavera 2026',
    titleEs: 'Titulo del Curso (Espanol)',
    titleEsPlaceholder: 'ej., Lanzamiento Menu Primavera 2026',
    descriptionEn: 'Descripcion (Ingles)',
    descriptionEnPlaceholder: 'Breve descripcion del curso...',
    descriptionEs: 'Descripcion (Espanol)',
    descriptionEsPlaceholder: 'Breve descripcion del curso...',
    step2Title: 'Seleccionar Items del Menu',
    step2Desc: 'Elige los platos, vinos, cocteles y mas para incluir en este curso.',
    step3Title: 'Instrucciones para IA',
    step3Desc: 'Instrucciones opcionales para guiar la generacion de contenido.',
    instructionsPlaceholder: 'ej., Enfocarse en alertas de alergenos, incluir sugerencias de maridaje para cada plato...',
    step4Title: 'Evaluacion',
    step4Desc: 'Configura el cuestionario para este curso.',
    step5Title: 'Estilo de Ensenanza',
    step5Desc: 'Elige la personalidad del profesor IA para este curso.',
    step6Title: 'Revisar y Crear',
    step6Desc: 'Revisa tus selecciones y crea el curso.',
    reviewTitle: 'Titulo',
    reviewItems: 'Items',
    reviewInstructions: 'Instrucciones IA',
    reviewQuiz: 'Cuestionario',
    reviewTeacher: 'Profesor',
    reviewQuestions: 'preguntas',
    reviewPassing: 'puntaje de aprobacion',
    noItems: 'No hay items seleccionados',
    noInstructions: 'Ninguna',
    buildSuccess: '¡Curso creado!',
    buildError: 'Error al crear el curso',
  },
};

const TEACHER_LABELS = {
  en: { friendly: 'Friendly', professional: 'Professional', strict: 'Strict', expert: 'Expert' },
  es: { friendly: 'Amigable', professional: 'Profesional', strict: 'Estricto', expert: 'Experto' },
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
  const [step, setStep] = useState(0);
  const [titleEn, setTitleEn] = useState('');
  const [titleEs, setTitleEs] = useState('');
  const [descriptionEn, setDescriptionEn] = useState('');
  const [descriptionEs, setDescriptionEs] = useState('');
  const [selectedItems, setSelectedItems] = useState<SourceRef[]>([]);
  const [instructions, setInstructions] = useState('');
  const [quizConfig, setQuizConfig] = useState<QuizConfig>(getDefaultQuizConfig());
  const [teacherLevel, setTeacherLevel] = useState<TeacherLevel>('professional');
  const [isBuilding, setIsBuilding] = useState(false);

  // Step validation
  const canGoNext = (() => {
    switch (step) {
      case 0: return titleEn.trim().length >= 3;
      case 1: return true; // items are optional, user might build a manual course
      case 2: return true; // instructions are optional
      case 3: return true; // quiz defaults are fine
      case 4: return true; // teacher defaults are fine
      case 5: return true; // review step, ready to build
      default: return false;
    }
  })();

  const handleNext = () => {
    if (step < TOTAL_STEPS - 1) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleCancel = () => {
    setStep(0);
    setTitleEn('');
    setTitleEs('');
    setDescriptionEn('');
    setDescriptionEs('');
    setSelectedItems([]);
    setInstructions('');
    setQuizConfig(getDefaultQuizConfig());
    setTeacherLevel('professional');
    onClose();
  };

  const handleBuild = useCallback(async () => {
    if (!groupId || !user?.id) {
      console.error('[MenuRolloutWizard] Missing groupId or user:', { groupId, userId: user?.id });
      toast.error('Unable to create course — group not loaded. Please try again.');
      return;
    }
    setIsBuilding(true);

    try {
      const shortId = Math.random().toString(36).slice(2, 7);
      const slug = `${generateCourseSlug(titleEn)}-${shortId}`;

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

      const wizardConfig: WizardConfig = {
        courseType: 'menu_rollout',
        title: titleEn.trim(),
        titleEs: titleEs.trim(),
        description: descriptionEn.trim(),
        descriptionEs: descriptionEs.trim(),
        selectedSourceIds: selectedItems,
        teacherLevel,
        teacherId: null,
        quizConfig,
        additionalInstructions: instructions.trim(),
        assignTo: { mode: 'all_staff' },
        deadline: null,
        expiresAt: null,
        // Edge-function-compatible fields (handleOutline reads these)
        ai_instructions: instructions.trim(),
        source_sections: [] as string[],
        source_products: sourceProducts,
      };

      // ── 1. Create course in DB ─────────────────────────────────────────
      const { data, error } = await supabase
        .from('courses')
        .insert({
          group_id: groupId,
          slug,
          title_en: titleEn.trim(),
          title_es: titleEs.trim() || null,
          description_en: descriptionEn.trim() || null,
          description_es: descriptionEs.trim() || null,
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
      toast.info(language === 'es' ? 'Generando esquema del curso...' : 'Generating course outline...');

      // ── 2. Call AI outline generation ──────────────────────────────────
      const { data: outlineData, error: outlineError } = await supabase.functions.invoke(
        'build-course',
        { body: { course_id: data.id, step: 'outline' } },
      );

      if (outlineError) {
        console.error('[MenuRolloutWizard] Outline error:', outlineError);
        // Course was created but outline failed — still navigate to builder
        toast.warning(language === 'es'
          ? 'Curso creado, pero el esquema falló. Intenta "Generar Esquema" en el editor.'
          : 'Course created, but outline failed. Try "Generate Outline" in the editor.');
      } else if (outlineData?.error) {
        console.error('[MenuRolloutWizard] Outline API error:', outlineData.error);
        toast.warning(language === 'es'
          ? 'Curso creado, pero el esquema falló. Intenta "Generar Esquema" en el editor.'
          : 'Course created, but outline failed. Try "Generate Outline" in the editor.');
      } else {
        const sectionCount = outlineData?.sections?.length || 0;
        toast.success(language === 'es'
          ? `¡Curso creado con ${sectionCount} secciones!`
          : `Course created with ${sectionCount} sections!`);
      }

      // ── 3. Navigate to builder ─────────────────────────────────────────
      navigate(`/admin/courses/${data.id}/edit`);
      handleCancel();
    } catch (err) {
      console.error('[MenuRolloutWizard] Build error:', err);
      toast.error(t.buildError);
    } finally {
      setIsBuilding(false);
    }
  }, [
    groupId, user?.id, titleEn, titleEs, descriptionEn, descriptionEs,
    selectedItems, instructions, quizConfig, teacherLevel, navigate, t, handleCancel, language,
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
              <div>
                <Label className="text-sm font-medium">{t.titleEs}</Label>
                <Input
                  value={titleEs}
                  onChange={(e) => setTitleEs(e.target.value)}
                  placeholder={t.titleEsPlaceholder}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-sm font-medium">{t.descriptionEn}</Label>
                <Textarea
                  value={descriptionEn}
                  onChange={(e) => setDescriptionEn(e.target.value)}
                  placeholder={t.descriptionEnPlaceholder}
                  className="mt-1 min-h-[80px] resize-none"
                />
              </div>
              <div>
                <Label className="text-sm font-medium">{t.descriptionEs}</Label>
                <Textarea
                  value={descriptionEs}
                  onChange={(e) => setDescriptionEs(e.target.value)}
                  placeholder={t.descriptionEsPlaceholder}
                  className="mt-1 min-h-[80px] resize-none"
                />
              </div>
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

          {/* Step 3: AI Instructions */}
          {step === 2 && (
            <div>
              <Textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder={t.instructionsPlaceholder}
                className="min-h-[200px] resize-none"
                autoFocus
              />
            </div>
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
                label={t.reviewInstructions}
                value={instructions.trim() || t.noInstructions}
                truncate
              />
              <ReviewRow
                label={t.reviewQuiz}
                value={`${quizConfig.question_count} ${t.reviewQuestions}, ${quizConfig.passing_score}% ${t.reviewPassing}`}
              />
              <ReviewRow
                label={t.reviewTeacher}
                value={TEACHER_LABELS[language][teacherLevel]}
              />
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
      <div className="shrink-0 flex items-center justify-center h-6 w-6 rounded-full bg-primary/10">
        <Check className="h-3.5 w-3.5 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase text-muted-foreground tracking-wider">{label}</p>
        <p className={cn('text-sm font-medium mt-0.5', truncate && 'line-clamp-2')}>{value}</p>
      </div>
    </div>
  );
}
