/**
 * ManualContent
 * 
 * Wrapper for manual content area with loading skeleton and optional In-Page TOC.
 * Handles the layout of content + TOC sidebar on larger screens.
 */

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { MarkdownRenderer } from './MarkdownRenderer';
import { InPageTOC } from './InPageTOC';

interface ManualContentProps {
  /** Markdown content to render */
  markdown: string | null;
  /** Whether to show the in-page TOC */
  showTOC?: boolean;
}

export function ManualContent({ markdown, showTOC = true }: ManualContentProps) {
  return (
    <div className="flex gap-lg xl:gap-xl">
      {/* Main content area - wider card */}
      <div className="flex-1 min-w-0">
        {markdown ? (
          <Card className="w-full">
            <CardContent className="max-w-none">
              <div className="max-w-prose">
                <MarkdownRenderer content={markdown} />
              </div>
            </CardContent>
          </Card>
        ) : (
          <ManualContentSkeleton />
        )}
      </div>
      
      {/* In-Page TOC (desktop only, XL screens) */}
      {showTOC && markdown && (
        <aside className="hidden xl:block w-44 shrink-0">
          <div className="sticky top-20">
            <InPageTOC markdown={markdown} />
          </div>
        </aside>
      )}
    </div>
  );
}

/**
 * Loading skeleton for manual content
 */
function ManualContentSkeleton() {
  return (
    <Card>
      <CardContent className="space-y-md">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </CardContent>
    </Card>
  );
}
