/**
 * DockedAIPanel
 * 
 * Desktop-only docked AI panel that pushes content rather than overlaying.
 * Allows users to reference manual content while asking questions.
 * 
 * Features:
 * - Fixed height column with independent scroll
 * - Slide-in animation
 * - Escape key to close
 * - Focus management
 */

import { useEffect, useRef, useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { AskAboutContent } from './AskAboutContent';

interface DockedAIPanelProps {
  /** Section slug for context */
  sectionId: string;
  /** Section title for display */
  sectionTitle: string;
  /** Current language */
  language: 'en' | 'es';
  /** Whether the panel is open */
  isOpen: boolean;
  /** Called when panel should close */
  onClose: () => void;
  /** Called when user clicks a citation to navigate */
  onNavigateToSection: (slug: string) => void;
  /** Whether voice feature is enabled for user */
  voiceEnabled?: boolean;
  /** Group ID for voice mode */
  groupId?: string;
}

export function DockedAIPanel({
  sectionId,
  sectionTitle,
  language,
  isOpen,
  onClose,
  onNavigateToSection,
  voiceEnabled = false,
  groupId = '',
}: DockedAIPanelProps) {
  const panelRef = useRef<HTMLElement>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [shouldRender, setShouldRender] = useState(isOpen);

  // Truncate long titles
  const displayTitle = sectionTitle.length > 25 
    ? sectionTitle.slice(0, 25) + '...' 
    : sectionTitle;

  const labels = {
    title: language === 'es' ? 'Preguntar sobre:' : 'Ask about:',
    close: language === 'es' ? 'Cerrar' : 'Close',
  };

  // Handle open/close transitions
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setIsClosing(false);
    } else if (shouldRender) {
      // Start closing animation
      setIsClosing(true);
      const timer = setTimeout(() => {
        setShouldRender(false);
        setIsClosing(false);
      }, 500); // Match animation duration (duration-500)
      return () => clearTimeout(timer);
    }
  }, [isOpen, shouldRender]);

  // Escape key handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Focus the panel on mount for accessibility
  useEffect(() => {
    if (isOpen && !isClosing) {
      // Small delay to let animation start
      const timer = setTimeout(() => {
        panelRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, isClosing]);

  // Don't render if not needed
  if (!shouldRender) return null;

  return (
    <aside 
      ref={panelRef}
      tabIndex={-1}
      className={cn(
        // Sizing
        "w-80 xl:w-96 shrink-0 h-full",
        // Layout
        "flex flex-col",
        // Styling
        "border-l border-border bg-background/95 backdrop-blur-sm shadow-xl",
        // Animation
        isClosing
          ? "animate-out slide-out-to-right-4 fade-out-0 duration-500 ease-in"
          : "animate-in slide-in-from-right-4 fade-in-0 duration-500 ease-out"
      )}
      role="complementary"
      aria-label={`${labels.title} ${sectionTitle}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-sm min-w-0">
          <Sparkles className="h-5 w-5 text-primary shrink-0" />
          <span className="text-base font-semibold truncate">
            {labels.title} {displayTitle}
          </span>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onClose}
          className="h-8 w-8 shrink-0"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">{labels.close}</span>
        </Button>
      </div>
      
      {/* Voice mode is now integrated into AskAboutContent */}
      
      {/* Content - scrollable */}
      <AskAboutContent
        sectionId={sectionId}
        sectionTitle={sectionTitle}
        language={language}
        onNavigateToSection={onNavigateToSection}
        isClosing={isClosing}
        voiceEnabled={voiceEnabled}
        groupId={groupId}
        className="flex-1 min-h-0"
      />
    </aside>
  );
}
