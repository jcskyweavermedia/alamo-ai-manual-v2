/**
 * ManualHeader
 * 
 * Section title with actions: bookmark, language toggle, and Ask AI button.
 * 
 * Layout:
 * ┌──────────────────────────────────────────────────┐
 * │ Temperature Monitoring            [🔖] [Menu]   │
 * │ Last updated: January 2024        [Ask AI ✨]    │
 * └──────────────────────────────────────────────────┘
 */

import { PageTitle, MetaText } from '@/components/ui/typography';
import { Button } from '@/components/ui/button';
import { Menu, Mic } from 'lucide-react';
import { BookmarkButton } from './BookmarkButton';

interface ManualHeaderProps {
  /** Section title */
  title: string;
  /** Last updated date */
  updatedAt?: Date | null;
  /** Current language for date formatting */
  language: 'en' | 'es';
  /** Whether section is bookmarked */
  isBookmarked: boolean;
  /** Toggle bookmark callback */
  onBookmarkToggle: () => void;
  /** Open mobile menu callback */
  onMobileMenuOpen: () => void;
  /** Show mobile menu button */
  showMobileMenu?: boolean;
  /** Whether voice feature is enabled for user */
  voiceEnabled?: boolean;
  /** Voice button click handler */
  onVoiceClick?: () => void;
}

export function ManualHeader({
  title,
  updatedAt,
  language,
  isBookmarked,
  onBookmarkToggle,
  onMobileMenuOpen,
  showMobileMenu = true,
  voiceEnabled = false,
  onVoiceClick,
}: ManualHeaderProps) {
  const labels = {
    lastUpdated: language === 'es' ? 'Última actualización' : 'Last updated',
    bookmark: isBookmarked 
      ? (language === 'es' ? 'Quitar marcador' : 'Remove bookmark')
      : (language === 'es' ? 'Agregar marcador' : 'Add bookmark'),
    openNav: language === 'es' ? 'Abrir navegación' : 'Open navigation',
    voice: language === 'es' ? 'Asistente de voz' : 'Voice assistant',
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-md">
      {/* Title and metadata */}
      <div className="space-y-xs">
        <PageTitle>{title}</PageTitle>
        {updatedAt && (
          <MetaText>
            {labels.lastUpdated}: {' '}
            {updatedAt.toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', {
              month: 'long',
              year: 'numeric'
            })}
          </MetaText>
        )}
      </div>
      
      {/* Actions */}
      <div className="flex items-center gap-sm">
        {/* Voice button */}
        {voiceEnabled && onVoiceClick && (
          <Button
            variant="outline"
            size="icon"
            onClick={onVoiceClick}
            className="h-10 w-10"
            aria-label={labels.voice}
          >
            <Mic className="h-4 w-4" />
          </Button>
        )}
        
        {/* Mobile menu button */}
        {showMobileMenu && (
          <Button
            variant="outline"
            size="icon"
            onClick={onMobileMenuOpen}
            className="lg:hidden h-10 w-10"
            aria-label={labels.openNav}
          >
            <Menu className="h-4 w-4" />
          </Button>
        )}
        
        {/* Bookmark button */}
        <BookmarkButton
          isBookmarked={isBookmarked}
          onToggle={onBookmarkToggle}
          label={labels.bookmark}
        />
      </div>
    </div>
  );
}
