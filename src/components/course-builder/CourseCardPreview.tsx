// =============================================================================
// CourseCardPreview — Card view mode for the course builder.
// Renders a live mock of the CourseCard as it appears on /admin/courses.
// Includes cover image management (upload/AI/remove) and inline description editing.
// =============================================================================

import { useState, useRef, useCallback, useEffect } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useCourseBuilder } from '@/contexts/CourseBuilderContext';
import { useCoverImage } from '@/hooks/use-cover-image';
import { useCoverImageUrl } from '@/hooks/use-cover-image-url';
import { COURSE_EMOJI, defaultEmoji } from '@/constants/course-emoji';
import { statusBadgeStyles } from '@/constants/course-status';
import { CoverImageOverlay } from './CoverImageOverlay';
import { CoverImageAIPopover } from './CoverImageAIPopover';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Bilingual strings
const STRINGS = {
  en: {
    cardPreview: 'Card Preview',
    untitledCourse: 'Untitled Course',
    addDescription: 'Click to add description...',
    generateDesc: 'Generate description with AI',
    section: 'section',
    sections: 'sections',
    justNow: 'Just now',
    uploadCoverImage: 'Upload cover image',
  },
  es: {
    cardPreview: 'Vista previa de tarjeta',
    untitledCourse: 'Sin t\u00edtulo',
    addDescription: 'Haz clic para agregar descripci\u00f3n...',
    generateDesc: 'Generar descripci\u00f3n con IA',
    section: 'secci\u00f3n',
    sections: 'secciones',
    justNow: 'Ahora',
    uploadCoverImage: 'Subir imagen de portada',
  },
};

interface CourseCardPreviewProps {
  language: 'en' | 'es';
}

export function CourseCardPreview({ language }: CourseCardPreviewProps) {
  const { state, dispatch, setCoverImage } = useCourseBuilder();
  const { uploadCoverImage, generateCoverImage, removeCoverImage, isUploading, isGenerating } = useCoverImage(state.courseId);
  const { url: coverImageUrl, isLoading: isCoverLoading } = useCoverImageUrl(state.coverImage);

  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [editedDesc, setEditedDesc] = useState('');
  const [showAIPopover, setShowAIPopover] = useState(false);
  const [isGeneratingDesc, setIsGeneratingDesc] = useState(false);
  const [heroTapped, setHeroTapped] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const generatingDescRef = useRef(false);

  const t = STRINGS[language];
  const emojiConfig = COURSE_EMOJI[state.icon] ?? defaultEmoji;
  const title = language === 'es' ? (state.titleEs || state.titleEn) : state.titleEn;
  const description = language === 'es' ? (state.descriptionEs || state.descriptionEn) : state.descriptionEn;
  const sectionCount = state.sections.length;

  // H-4: Dismiss hero overlay on outside click (touch devices)
  useEffect(() => {
    if (!heroTapped) return;
    function handleClickOutside(e: MouseEvent) {
      if (heroRef.current && !heroRef.current.contains(e.target as Node)) {
        setHeroTapped(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [heroTapped]);

  // --- Image handlers ---
  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const path = await uploadCoverImage(file, state.coverImage);
    if (path) setCoverImage(path);
    // Reset file input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [uploadCoverImage, state.coverImage, setCoverImage]);

  const handleGenerate = useCallback(async (instruction?: string) => {
    const sectionTitles = state.sections.map(s => s.titleEn);
    const path = await generateCoverImage(
      state.titleEn,
      state.courseType,
      sectionTitles,
      state.descriptionEn,
      instruction,
    );
    if (path) {
      setCoverImage(path);
      setShowAIPopover(false);
    }
  }, [generateCoverImage, state.titleEn, state.courseType, state.sections, state.descriptionEn, setCoverImage]);

  const handleRemove = useCallback(async () => {
    await removeCoverImage(state.coverImage);
    setCoverImage(null);
  }, [removeCoverImage, state.coverImage, setCoverImage]);

  // --- Description handlers ---
  const startEditingDesc = useCallback(() => {
    setEditedDesc(description || '');
    setIsEditingDesc(true);
  }, [description]);

  const commitDesc = useCallback(() => {
    setIsEditingDesc(false);
    if (editedDesc !== description) {
      if (language === 'es') {
        dispatch({ type: 'SET_DESCRIPTION_ES', payload: editedDesc });
      } else {
        dispatch({ type: 'SET_DESCRIPTION_EN', payload: editedDesc });
      }
    }
  }, [editedDesc, description, language, dispatch]);

  // M-6 / L-3: Ctrl/Cmd+Enter to commit description
  const handleDescKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsEditingDesc(false);
    }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      commitDesc();
    }
  }, [commitDesc]);

  // Auto-focus textarea
  useEffect(() => {
    if (isEditingDesc && descRef.current) {
      descRef.current.focus();
      descRef.current.selectionStart = descRef.current.value.length;
    }
  }, [isEditingDesc]);

  // --- AI Description (M-9: double-click guard) ---
  const handleAIDescription = useCallback(async () => {
    if (!state.courseId) return;
    if (generatingDescRef.current) return;
    generatingDescRef.current = true;
    setIsGeneratingDesc(true);
    try {
      const { data, error } = await supabase.functions.invoke('build-course', {
        body: {
          step: 'generate_card_meta',
          course_id: state.courseId,
        },
      });

      if (error) {
        console.error('[CourseCardPreview] AI description error:', error);
        toast.error('Failed to generate description');
        return;
      }

      if (data?.description_en) {
        dispatch({ type: 'SET_DESCRIPTION_EN', payload: data.description_en });
        if (data.description_es) {
          dispatch({ type: 'SET_DESCRIPTION_ES', payload: data.description_es });
        }
        toast.success('Description generated');
      }
    } catch (err) {
      console.error('[CourseCardPreview] AI description error:', err);
      toast.error('Failed to generate description');
    } finally {
      setIsGeneratingDesc(false);
      generatingDescRef.current = false;
    }
  }, [state.courseId, dispatch]);

  return (
    <div className={cn(
      'flex-1 flex items-start justify-center overflow-y-auto py-8 px-4',
      'bg-muted/30',
      'lg:[background-image:radial-gradient(circle,_rgba(0,0,0,0.06)_1px,_transparent_1px)]',
      'lg:[background-size:20px_20px]',
      'dark:lg:[background-image:radial-gradient(circle,_rgba(255,255,255,0.04)_1px,_transparent_1px)]',
    )}>
      <div className="w-[300px] max-w-full">
        {/* Label */}
        <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider text-center mb-4">
          {t.cardPreview}
        </p>

        {/* Card container — M-5: match shadow-card from list page */}
        <div className={cn(
          'flex flex-col',
          'p-5',
          'bg-card rounded-[20px]',
          'border border-black/[0.04] dark:border-white/[0.06]',
          'shadow-card',
        )}>
          {/* Hero tile wrapped in AI popover for proper anchor positioning */}
          <CoverImageAIPopover
            courseTitle={state.titleEn}
            open={showAIPopover}
            onOpenChange={setShowAIPopover}
            onGenerate={handleGenerate}
            isGenerating={isGenerating}
            language={language}
          >
            {/* H-4: Hero tile — click toggles overlay on touch devices */}
            <div
              ref={heroRef}
              className={cn(
                'relative w-full aspect-[16/9] rounded-[14px] overflow-hidden mb-3 group/hero',
                'shadow-[3px_8px_12px_-3px_rgba(0,0,0,0.08),2px_4px_8px_-2px_rgba(0,0,0,0.05)]',
                'dark:shadow-[3px_8px_12px_-3px_rgba(0,0,0,0.3),2px_4px_8px_-2px_rgba(0,0,0,0.2)]',
              )}
              onClick={() => setHeroTapped(prev => !prev)}
            >
              {coverImageUrl ? (
                <img
                  src={coverImageUrl}
                  alt={title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className={cn(
                  'w-full h-full flex items-center justify-center',
                  emojiConfig.bg, emojiConfig.darkBg,
                  // Show shimmer when cover image path exists but URL hasn't resolved yet
                  isCoverLoading && state.coverImage && 'animate-pulse',
                )}>
                  <span className="text-[48px] h-[48px] leading-[48px]">
                    {emojiConfig.emoji}
                  </span>
                </div>
              )}

              {/* Hover overlay — H-4: also visible when tapped */}
              <CoverImageOverlay
                hasImage={!!coverImageUrl}
                isUploading={isUploading}
                isGenerating={isGenerating}
                onUploadClick={handleUploadClick}
                onGenerateClick={() => setShowAIPopover(true)}
                onRemoveClick={handleRemove}
                language={language}
                isVisible={heroTapped}
              />

              {/* Hidden file input — H-5: aria-label */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleFileChange}
                aria-label={t.uploadCoverImage}
              />
            </div>
          </CoverImageAIPopover>

          {/* Status badges */}
          <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
            <Badge
              variant="secondary"
              className={cn(
                'text-[10px] font-bold px-2 py-0 border-0',
                statusBadgeStyles[state.status] || statusBadgeStyles.draft,
              )}
            >
              {state.status.toUpperCase()}
            </Badge>
            {state.courseType === 'menu_rollout' && (
              <Badge
                variant="secondary"
                className="text-[10px] font-bold px-2 py-0 border-0 bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
              >
                {String.fromCodePoint(0x1F37D)} ROLLOUT
              </Badge>
            )}
          </div>

          {/* Title (read-only) */}
          <h3 className="text-base font-semibold text-foreground leading-tight line-clamp-1 mb-1.5">
            {title || t.untitledCourse}
          </h3>

          {/* Description (editable) */}
          <div className="relative group/desc mt-0.5">
            {isEditingDesc ? (
              <textarea
                ref={descRef}
                value={editedDesc}
                onChange={(e) => setEditedDesc(e.target.value)}
                onBlur={commitDesc}
                onKeyDown={handleDescKeyDown}
                className={cn(
                  'w-full text-xs text-muted-foreground leading-relaxed',
                  'bg-transparent border-0 p-0 resize-none',
                  'ring-1 ring-primary/20 rounded-sm px-1 py-0.5',
                  'focus:outline-none focus:ring-1 focus:ring-primary/40',
                  'min-h-[40px]',
                )}
                rows={3}
              />
            ) : (
              <p
                className={cn(
                  'text-xs text-muted-foreground leading-relaxed',
                  'line-clamp-3 cursor-text',
                  'hover:ring-1 hover:ring-primary/10 rounded-sm px-1 py-0.5 -mx-1',
                  'transition-all duration-150',
                  !description && 'italic text-muted-foreground/50',
                )}
                onClick={startEditingDesc}
              >
                {description || t.addDescription}
              </p>
            )}

            {/* AI sparkle button — always visible (small enough), H-5: aria-label */}
            {!isEditingDesc && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleAIDescription();
                }}
                disabled={isGeneratingDesc}
                className={cn(
                  'absolute -right-1 -top-1 z-10',
                  'flex items-center justify-center h-6 w-6 rounded-full',
                  'bg-white/90 dark:bg-gray-900/90 shadow-md backdrop-blur-sm',
                  'text-muted-foreground hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20',
                  'opacity-70 hover:opacity-100 transition-opacity duration-150',
                  'disabled:opacity-50',
                )}
                title={t.generateDesc}
                aria-label={t.generateDesc}
              >
                {isGeneratingDesc ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Sparkles className="h-3 w-3" />
                )}
              </button>
            )}
          </div>

          {/* Meta footer */}
          <div className="flex items-center gap-3 mt-auto pt-3 text-[13px] leading-none text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="text-[14px] h-[14px] leading-[14px] shrink-0">&#x1F4D6;</span>
              <span>{sectionCount} {sectionCount === 1 ? t.section : t.sections}</span>
            </span>
            <span className="text-black/10 dark:text-white/10">&middot;</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="text-[14px] h-[14px] leading-[14px] shrink-0">&#x1F550;</span>
              <span>{t.justNow}</span>
            </span>
            {state.version > 1 && (
              <>
                <span className="text-black/10 dark:text-white/10">&middot;</span>
                <span className="tabular-nums">v{state.version}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
