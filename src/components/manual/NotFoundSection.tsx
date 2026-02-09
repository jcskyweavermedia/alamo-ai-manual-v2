/**
 * NotFoundSection
 * 
 * Displayed when a section ID doesn't exist in the manual.
 * Provides helpful navigation back to valid content.
 */

import { FileQuestion, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SectionTitle, BodyText } from '@/components/ui/typography';

interface NotFoundSectionProps {
  /** The section ID that was not found */
  sectionId?: string;
  /** Navigate to a valid section */
  onNavigate: (sectionId: string) => void;
  /** Current language */
  language: 'en' | 'es';
}

export function NotFoundSection({ sectionId, onNavigate, language }: NotFoundSectionProps) {
  const labels = {
    title: language === 'es' ? 'Sección no encontrada' : 'Section not found',
    description: language === 'es' 
      ? 'La sección que buscas no existe o ha sido movida.'
      : 'The section you\'re looking for doesn\'t exist or has been moved.',
    sectionId: language === 'es' ? 'ID de sección' : 'Section ID',
    backToManual: language === 'es' ? 'Volver al manual' : 'Back to manual',
  };

  return (
    <Card className="max-w-lg mx-auto mt-xl">
      <CardContent className="text-center space-y-lg py-xl">
        <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center">
          <FileQuestion className="w-8 h-8 text-muted-foreground" />
        </div>
        
        <div className="space-y-sm">
          <SectionTitle>{labels.title}</SectionTitle>
          <BodyText className="text-muted-foreground">
            {labels.description}
          </BodyText>
          {sectionId && (
            <code className="text-small text-muted-foreground bg-muted px-2 py-1 rounded">
              {labels.sectionId}: {sectionId}
            </code>
          )}
        </div>
        
        <Button
          variant="default"
          onClick={() => onNavigate('temperature-monitoring')}
          className="gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          {labels.backToManual}
        </Button>
      </CardContent>
    </Card>
  );
}
