import { Pin, PinOff, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProgressRing } from '@/components/ui/progress-ring';
import { COURSE_EMOJI, defaultEmoji } from '@/constants/course-emoji';
import type { CourseListItem } from '@/types/course-player';

interface CoursePlayerCardProps {
  course: CourseListItem;
  language: 'en' | 'es';
  coverImageUrl?: string;
  isPinned: boolean;
  onTogglePin: (slug: string) => void;
  onSelect: (slug: string) => void;
}

/**
 * Card component for a course in the grid.
 * Design: cover image / emoji fallback tile, title, description, progress or "Start" chip, duration.
 * Matches existing card patterns (rounded-[20px], shadow-card, active:scale-[0.99]).
 */
export function CoursePlayerCard({
  course,
  language,
  coverImageUrl,
  isPinned,
  onTogglePin,
  onSelect,
}: CoursePlayerCardProps) {
  const title = language === 'es' && course.titleEs ? course.titleEs : course.titleEn;
  const description =
    language === 'es' && course.descriptionEs
      ? course.descriptionEs
      : course.descriptionEn;

  const emojiConfig = COURSE_EMOJI[course.icon] ?? defaultEmoji;

  const isEnrolled =
    course.enrollmentStatus === 'enrolled' ||
    course.enrollmentStatus === 'in_progress' ||
    course.enrollmentStatus === 'completed';

  return (
    <button
      type="button"
      onClick={() => onSelect(course.slug)}
      className={cn(
        'group relative flex flex-col',
        'bg-card rounded-[20px]',
        'border border-black/[0.04] dark:border-white/[0.06]',
        'shadow-card',
        'hover:bg-muted/20 dark:hover:bg-muted/10',
        'active:scale-[0.99]',
        'transition-all duration-150',
        'text-left overflow-hidden',
      )}
    >
      {/* Top: cover image or emoji fallback tile */}
      <div className="relative">
        {coverImageUrl ? (
          <img
            src={coverImageUrl}
            alt={title}
            className="w-full aspect-video object-cover rounded-t-[20px] rounded-b-none"
          />
        ) : (
          <div
            className={cn(
              'w-full aspect-video flex items-center justify-center',
              emojiConfig.bg,
              emojiConfig.darkBg,
            )}
          >
            <span className="text-[48px] h-[48px] leading-[48px]">
              {emojiConfig.emoji}
            </span>
          </div>
        )}

        {/* Pin button in top-right corner */}
        <span
          role="button"
          tabIndex={0}
          aria-label={isPinned ? 'Unpin course' : 'Pin course'}
          onClick={(e) => {
            e.stopPropagation();
            onTogglePin(course.slug);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.stopPropagation();
              onTogglePin(course.slug);
            }
          }}
          className={cn(
            'absolute top-2.5 right-2.5',
            'flex items-center justify-center',
            'h-8 w-8 rounded-full',
            'transition-all duration-150',
            isPinned
              ? 'bg-orange-500 text-white shadow-sm'
              : 'bg-black/30 text-white/80 hover:bg-black/50 hover:text-white',
          )}
        >
          {isPinned ? (
            <PinOff className="h-4 w-4" />
          ) : (
            <Pin className="h-4 w-4" />
          )}
        </span>
      </div>

      {/* Middle: title + description */}
      <div className="flex flex-col gap-1 px-5 pt-4">
        <h3 className="text-base font-semibold text-foreground leading-tight line-clamp-2">
          {title}
        </h3>
        {description && (
          <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
            {description}
          </p>
        )}
      </div>

      {/* Bottom row: progress/start chip + duration */}
      <div className="flex items-center justify-between px-5 pt-3 pb-4 mt-auto">
        <div className="flex items-center gap-2">
          {isEnrolled ? (
            <>
              <ProgressRing
                percent={course.progressPercent}
                size={36}
                strokeWidth={3}
              />
              <span className="text-xs text-muted-foreground">
                {course.completedSections} / {course.totalSections}{' '}
                {language === 'es' ? 'secciones' : 'sections'}
              </span>
            </>
          ) : (
            <span className="text-xs font-medium bg-orange-500/10 text-orange-600 dark:text-orange-400 px-2 py-0.5 rounded-full">
              {language === 'es' ? 'Iniciar' : 'Start'}
            </span>
          )}
        </div>

        {course.estimatedMinutes > 0 && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
            <Clock className="h-3.5 w-3.5" />
            <span>{course.estimatedMinutes} min</span>
          </div>
        )}
      </div>
    </button>
  );
}
