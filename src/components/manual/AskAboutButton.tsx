/**
 * AskAboutButton
 * 
 * "Ask AI about this section" button for contextual AI assistance.
 * Opens the AskAboutSheet when clicked.
 * 
 * UI:
 * - Button with sparkle icon
 * - Text: "Ask AI" or "Preguntar IA"
 */

import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';

interface AskAboutButtonProps {
  /** Section ID for context (future use) */
  sectionId?: string;
  /** Section title for context (future use) */
  sectionTitle?: string;
  /** Current language */
  language?: 'en' | 'es';
  /** Whether button is disabled */
  disabled?: boolean;
  /** Click handler (future use) */
  onClick?: () => void;
}

export function AskAboutButton({
  language = 'en',
  disabled = false,
  onClick,
}: AskAboutButtonProps) {
  const labels = {
    buttonText: language === 'es' ? 'Preguntar IA' : 'Ask AI',
  };

  return (
    <Button 
      variant="outline" 
      size="sm" 
      disabled={disabled} 
      onClick={onClick}
      className="gap-2"
    >
      <Sparkles className="h-4 w-4" />
      {labels.buttonText}
    </Button>
  );
}
