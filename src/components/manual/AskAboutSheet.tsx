/**
 * AskAboutSheet
 * 
 * Responsive container for the contextual AI assistant.
 * 
 * Viewport Behavior:
 * - Mobile/Tablet (< 1024px): Bottom Drawer with drag handle
 * - Desktop (≥ 1024px): Right-side Sheet
 * 
 * Follows existing patterns from MobileOutlineSheet for consistency.
 */

import { useState, useEffect } from 'react';
import { Sparkles, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from '@/components/ui/drawer';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from '@/components/ui/sheet';
import { AskAboutContent } from './AskAboutContent';

// =============================================================================
// TYPES
// =============================================================================

interface AskAboutSheetProps {
  /** Whether the sheet is open */
  open: boolean;
  /** Called when the sheet should close */
  onOpenChange: (open: boolean) => void;
  /** Section slug for context */
  sectionId: string;
  /** Section title for display */
  sectionTitle: string;
  /** Current language */
  language: 'en' | 'es';
  /** Called when user clicks a citation to navigate */
  onNavigateToSection: (slug: string) => void;
  /** Whether voice mode is enabled for user */
  voiceEnabled?: boolean;
  /** Group ID for voice mode */
  groupId?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function AskAboutSheet({
  open,
  onOpenChange,
  sectionId,
  sectionTitle,
  language,
  onNavigateToSection,
  voiceEnabled = false,
  groupId = '',
}: AskAboutSheetProps) {
  // Use media query for desktop detection (1024px = lg breakpoint)
  // This properly handles SSR and window resizes
  const [isDesktop, setIsDesktop] = useState(false);
  
  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    setIsDesktop(mediaQuery.matches);
    
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  const labels = {
    title: language === 'es' ? 'Preguntar sobre:' : 'Ask about:',
    close: language === 'es' ? 'Cerrar' : 'Close',
  };

  // Truncate long titles
  const displayTitle = sectionTitle.length > 30 
    ? sectionTitle.slice(0, 30) + '...' 
    : sectionTitle;

  // Handle navigation (close sheet first)
  const handleNavigate = (slug: string) => {
    onOpenChange(false);
    // Small delay to let sheet animation complete
    setTimeout(() => {
      onNavigateToSection(slug);
    }, 150);
  };

  // Desktop: Right-side Sheet
  if (isDesktop) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent 
          side="right" 
          className="w-[400px] p-0 flex flex-col"
        >
          <SheetHeader className="flex flex-row items-center justify-between px-4 py-4 border-b border-border shrink-0">
            <div className="flex items-center gap-sm min-w-0">
              <Sparkles className="h-5 w-5 text-primary shrink-0" />
              <SheetTitle className="text-base font-semibold truncate">
                {labels.title} {displayTitle}
              </SheetTitle>
            </div>
            {/* Close button is built into SheetContent */}
          </SheetHeader>
          
          <AskAboutContent
            sectionId={sectionId}
            sectionTitle={sectionTitle}
            language={language}
            onNavigateToSection={handleNavigate}
            voiceEnabled={voiceEnabled}
            groupId={groupId}
            className="flex-1 min-h-0"
          />
        </SheetContent>
      </Sheet>
    );
  }

  // Mobile/Tablet: Bottom Drawer
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh] flex flex-col">
        <DrawerHeader className="flex flex-row items-center justify-between border-b pb-4 shrink-0">
          <div className="flex items-center gap-sm min-w-0">
            <Sparkles className="h-5 w-5 text-primary shrink-0" />
            <DrawerTitle className="text-base font-semibold truncate">
              {labels.title} {displayTitle}
            </DrawerTitle>
          </div>
          <DrawerClose asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
              <X className="h-4 w-4" />
              <span className="sr-only">{labels.close}</span>
            </Button>
          </DrawerClose>
        </DrawerHeader>
        
        <AskAboutContent
          sectionId={sectionId}
          sectionTitle={sectionTitle}
          language={language}
          onNavigateToSection={handleNavigate}
          voiceEnabled={voiceEnabled}
          groupId={groupId}
          className="flex-1 min-h-0 overflow-hidden"
        />
      </DrawerContent>
    </Drawer>
  );
}
