import { Bookmark } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavbarBookmarkProps {
  pinned: boolean;
  onToggle: () => void;
}

/**
 * Centered navbar bookmark icon — shown in the Header toolbar slot
 * when viewing a single product item.
 */
export function NavbarBookmark({ pinned, onToggle }: NavbarBookmarkProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={pinned ? 'Remove bookmark' : 'Bookmark item'}
      className={cn(
        'flex items-center justify-center shrink-0',
        'h-8 w-8 rounded-full',
        'transition-all duration-150',
        pinned
          ? 'bg-orange-500 text-white shadow-sm'
          : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
      )}
    >
      <Bookmark className="h-4 w-4 fill-current" />
    </button>
  );
}
