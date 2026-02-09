/**
 * BookmarkButton
 * 
 * Toggle bookmark state for a section with filled/outline icon states.
 * 
 * States:
 * - Not bookmarked: outline bookmark icon
 * - Bookmarked: filled bookmark icon
 * - Hover: scale(1.05)
 */

import { Button } from '@/components/ui/button';
import { Bookmark } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BookmarkButtonProps {
  /** Whether the section is bookmarked */
  isBookmarked: boolean;
  /** Toggle bookmark callback */
  onToggle: () => void;
  /** Accessibility label */
  label?: string;
  /** Additional class names */
  className?: string;
}

export function BookmarkButton({
  isBookmarked,
  onToggle,
  label,
  className,
}: BookmarkButtonProps) {
  const defaultLabel = isBookmarked ? 'Remove bookmark' : 'Add bookmark';

  return (
    <Button
      variant={isBookmarked ? "default" : "outline"}
      size="icon"
      onClick={onToggle}
      className={cn(
        "h-10 w-10 transition-transform hover:scale-105",
        className
      )}
      aria-label={label || defaultLabel}
    >
      <Bookmark 
        className={cn(
          "h-4 w-4 transition-all",
          isBookmarked && "fill-current"
        )} 
      />
    </Button>
  );
}
