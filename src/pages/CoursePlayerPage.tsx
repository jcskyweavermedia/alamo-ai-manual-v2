// =============================================================================
// CoursePlayerPage — Main course player for staff learning.
//
// Route: /courses/:slug
// Mobile-first continuous scroll reader with section navigation.
//
// Features:
//   - Renders all sections in a continuous scroll using PlayerElementDispatcher
//   - Thin orange progress bar at the top of content
//   - Floating TOC button (mobile) opens SectionTOCSheet drawer
//   - PlayerBottomToolbar for prev/next section navigation
//   - Smooth scroll-to-section on navigation
//   - AppShell with back button + course title in header
// =============================================================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, List, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/hooks/use-language';
import { useCoursePlayer } from '@/hooks/use-course-player';
import { PlayerElementDispatcher } from '@/components/course-player/PlayerElementDispatcher';
import { SectionTOCSheet } from '@/components/course-player/SectionTOCSheet';
import { PlayerBottomToolbar } from '@/components/course-player/PlayerBottomToolbar';
import { QuizStep } from '@/components/course-player/QuizStep';
import type { CourseSection } from '@/types/course-builder';

// =============================================================================
// BILINGUAL STRINGS
// =============================================================================

const STRINGS = {
  en: {
    loading: 'Loading course...',
    unavailable: 'Course unavailable',
    unavailableSub: 'This course may have been unpublished or does not exist.',
    goBack: 'Back to Courses',
    sectionOf: (current: number, total: number) =>
      `Section ${current} of ${total}`,
  },
  es: {
    loading: 'Cargando curso...',
    unavailable: 'Curso no disponible',
    unavailableSub: 'Este curso puede haber sido despublicado o no existe.',
    goBack: 'Volver a Cursos',
    sectionOf: (current: number, total: number) =>
      `Secci\u00f3n ${current} de ${total}`,
  },
} as const;

// =============================================================================
// COMPONENT
// =============================================================================

export default function CoursePlayerPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { language, setLanguage } = useLanguage();
  const t = STRINGS[language];

  // ---------------------------------------------------------------------------
  // Player hook — fetches course + sections + enrollment/progress
  // ---------------------------------------------------------------------------

  const {
    course,
    sections,
    isLoading,
    courseUnavailable,
    activeSectionIndex,
    setActiveSectionIndex,
    enrollment,
    sectionProgressMap,
    markSectionComplete,
    completeCourse,
  } = useCoursePlayer(slug ?? '');

  // ---------------------------------------------------------------------------
  // TOC drawer state
  // ---------------------------------------------------------------------------

  const [tocOpen, setTocOpen] = useState(false);

  // ---------------------------------------------------------------------------
  // Quiz gating state — tracks whether active section quiz has been passed
  // ---------------------------------------------------------------------------

  const [quizPassed, setQuizPassed] = useState<boolean | null>(null);

  // Reset quiz state when active section changes — restore from DB if available
  useEffect(() => {
    const activeSection = sections[activeSectionIndex];
    if (activeSection) {
      const progress = sectionProgressMap.get(activeSection.id);
      // Restore from persisted section_progress if quiz was already passed
      setQuizPassed(progress?.quizPassed === true ? true : null);
    } else {
      setQuizPassed(null);
    }
  }, [activeSectionIndex, sections, sectionProgressMap]);

  const handleQuizStateChange = useCallback((passed: boolean | null) => {
    setQuizPassed(passed);
  }, []);

  // ---------------------------------------------------------------------------
  // Scroll to active section on index change
  // ---------------------------------------------------------------------------

  const isScrollingRef = useRef(false);

  const scrollToSection = useCallback((index: number) => {
    const el = document.getElementById(`section-${index}`);
    if (el) {
      isScrollingRef.current = true;
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Allow IntersectionObserver-like logic to settle
      setTimeout(() => {
        isScrollingRef.current = false;
      }, 800);
    }
  }, []);

  // Scroll when activeSectionIndex changes (from toolbar or TOC)
  const prevIndexRef = useRef(activeSectionIndex);
  useEffect(() => {
    if (prevIndexRef.current !== activeSectionIndex) {
      scrollToSection(activeSectionIndex);
      prevIndexRef.current = activeSectionIndex;
    }
  }, [activeSectionIndex, scrollToSection]);

  // ---------------------------------------------------------------------------
  // Navigation handlers
  // ---------------------------------------------------------------------------

  const handlePrev = useCallback(() => {
    if (activeSectionIndex > 0) {
      setActiveSectionIndex(activeSectionIndex - 1);
    }
  }, [activeSectionIndex, setActiveSectionIndex]);

  const handleNext = useCallback(() => {
    // Mark current section as viewed/complete before advancing
    if (sections[activeSectionIndex] && enrollment) {
      markSectionComplete(sections[activeSectionIndex].id, enrollment.id);
    }
    if (activeSectionIndex < sections.length - 1) {
      setActiveSectionIndex(activeSectionIndex + 1);
    }
  }, [activeSectionIndex, sections, setActiveSectionIndex, markSectionComplete, enrollment]);

  const handleComplete = useCallback(async () => {
    // Mark last section complete, then complete course
    if (sections[activeSectionIndex] && enrollment) {
      await markSectionComplete(sections[activeSectionIndex].id, enrollment.id);
    }
    await completeCourse();
  }, [activeSectionIndex, sections, markSectionComplete, completeCourse, enrollment]);

  const handleSelectSection = useCallback(
    (index: number) => {
      setActiveSectionIndex(index);
    },
    [setActiveSectionIndex],
  );

  // ---------------------------------------------------------------------------
  // Derived values
  // ---------------------------------------------------------------------------

  const totalSections = sections.length;
  const isLastSection = activeSectionIndex === totalSections - 1;

  // Derive completed count from enrollment record (kept in sync by the hook)
  const completedSectionsCount = enrollment?.completedSections ?? 0;
  const progressPercent =
    totalSections > 0
      ? Math.round((completedSectionsCount / totalSections) * 100)
      : 0;

  const courseTitle =
    language === 'es' && course?.titleEs
      ? course.titleEs
      : course?.titleEn ?? '';

  // TOC section list (camelCase -> snake_case adapter for SectionTOCSheet)
  const tocSections = sections.map((s) => ({
    id: s.id,
    title_en: s.titleEn,
    title_es: s.titleEs,
    sort_order: s.sortOrder,
  }));

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        <p className="text-sm text-muted-foreground">{t.loading}</p>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Course unavailable state
  // ---------------------------------------------------------------------------

  if (courseUnavailable) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 px-6 text-center">
        <AlertCircle className="h-12 w-12 text-muted-foreground/40" />
        <div>
          <h2 className="text-lg font-semibold text-foreground">{t.unavailable}</h2>
          <p className="text-sm text-muted-foreground mt-1">{t.unavailableSub}</p>
        </div>
        <Button variant="outline" onClick={() => navigate('/courses')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t.goBack}
        </Button>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Main player layout
  // ---------------------------------------------------------------------------

  return (
    <AppShell
      language={language}
      onLanguageChange={setLanguage}
      showSearch={false}
      headerLeft={
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/courses')}
          className="h-9 w-9"
          aria-label={language === 'es' ? 'Volver a cursos' : 'Back to courses'}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
      }
      headerToolbar={
        <span className="text-sm font-medium line-clamp-1">{courseTitle}</span>
      }
    >
      {/* ---- PROGRESS BAR ---- */}
      <div className="px-4 pt-3 pb-1">
        <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-orange-500 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1.5 tabular-nums">
          {t.sectionOf(activeSectionIndex + 1, totalSections)}
        </p>
      </div>

      {/* ---- CONTENT: CONTINUOUS SCROLL ---- */}
      <div className="space-y-1 pb-40">
        {sections.map((section: CourseSection, sectionIndex: number) => (
          <div key={section.id} id={`section-${sectionIndex}`}>
            {(section.elements || [])
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((element, elIndex) => (
                <PlayerElementDispatcher
                  key={element.key || elIndex}
                  element={element}
                  language={language}
                  isFirstElement={sectionIndex === 0 && elIndex === 0}
                />
              ))}

            {/* Quiz step — renders after section content for the active section */}
            {sectionIndex === activeSectionIndex && enrollment && course && (
              <QuizStep
                sectionId={section.id}
                courseId={course.id}
                enrollmentId={enrollment.id}
                language={language}
                onQuizStateChange={handleQuizStateChange}
              />
            )}
          </div>
        ))}
      </div>

      {/* ---- FLOATING TOC BUTTON (mobile) ---- */}
      <button
        type="button"
        onClick={() => setTocOpen(true)}
        className={cn(
          'fixed bottom-[140px] right-4 z-30 lg:hidden',
          'h-11 w-11 rounded-full',
          'bg-orange-500 text-white shadow-lg',
          'flex items-center justify-center',
          'hover:bg-orange-600 active:scale-95 transition-all',
        )}
        aria-label={language === 'es' ? 'Secciones' : 'Sections'}
      >
        <List className="h-5 w-5" />
      </button>

      {/* ---- SECTION TOC SHEET ---- */}
      <SectionTOCSheet
        open={tocOpen}
        onOpenChange={setTocOpen}
        sections={tocSections}
        activeSectionIndex={activeSectionIndex}
        sectionProgressMap={sectionProgressMap}
        language={language}
        onSelectSection={handleSelectSection}
      />

      {/* ---- BOTTOM TOOLBAR ---- */}
      <PlayerBottomToolbar
        activeSectionIndex={activeSectionIndex}
        totalSections={totalSections}
        onPrev={handlePrev}
        onNext={handleNext}
        onComplete={handleComplete}
        isLastSection={isLastSection}
        language={language}
        quizRequired
        quizPassed={quizPassed === true}
      />
    </AppShell>
  );
}
