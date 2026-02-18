import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MarkdownRenderer } from '@/components/manual/MarkdownRenderer';
import type { SOSSectionGroup } from '@/hooks/use-sos-scroll-viewer';

interface SOSSectionCardProps {
  group: SOSSectionGroup;
  sectionNumber: number;
  language: 'en' | 'es';
}

export function SOSSectionCard({ group, sectionNumber, language }: SOSSectionCardProps) {
  const isEs = language === 'es';
  const { parent, children } = group;

  const parentTitle = isEs && parent.titleEs ? parent.titleEs : parent.titleEn;
  const parentContent = isEs && parent.contentEs ? parent.contentEs : parent.contentEn;

  return (
    <div className="space-y-md">
      {/* Parent section */}
      <article
        data-section-key={parent.sectionKey}
        className="scroll-mt-20"
      >
        <Card elevation="default">
          <CardHeader className="bg-muted/40 dark:bg-muted/20 rounded-t-lg">
            <div className="flex items-center gap-md">
              <Badge variant="default" className="shrink-0 tabular-nums">
                {sectionNumber}
              </Badge>
              <CardTitle className="text-section-title">{parentTitle}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <MarkdownRenderer content={parentContent} />
          </CardContent>
        </Card>
      </article>

      {/* Child sections */}
      {children.map((child, idx) => {
        const childTitle = isEs && child.titleEs ? child.titleEs : child.titleEn;
        const childContent = isEs && child.contentEs ? child.contentEs : child.contentEn;
        const letter = String.fromCharCode(65 + idx); // A, B, C…

        return (
          <article
            key={child.sectionKey}
            data-section-key={child.sectionKey}
            className="scroll-mt-20 ml-4 lg:ml-6"
          >
            <Card elevation="none" className="border-l-4 border-l-primary/40">
              <CardHeader>
                <div className="flex items-center gap-md">
                  <Badge variant="outline" className="shrink-0 tabular-nums">
                    {letter}
                  </Badge>
                  <CardTitle className="text-subsection">{childTitle}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <MarkdownRenderer content={childContent} />
              </CardContent>
            </Card>
          </article>
        );
      })}
    </div>
  );
}
