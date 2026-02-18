import * as React from "react";
import { Copy, Check, Maximize2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SourceChip } from "@/components/ui/source-chip";
import { CardFloating } from "@/components/ui/card";
import type { Components } from "react-markdown";

/* =============================================================================
   AI ANSWER CARD COMPONENT
   Per docs/design-specs.md:
   - Not bubbles; answer card with source chips, expand action
   - Floating card style for prominence
============================================================================= */

/** Compact markdown components sized for AI answer cards (not full manual pages) */
const mdComponents: Components = {
  h1: ({ children, ...props }) => (
    <h1 className="text-base font-bold mt-3 mb-1 text-foreground" {...props}>{children}</h1>
  ),
  h2: ({ children, ...props }) => (
    <h2 className="text-base font-bold mt-3 mb-1 text-foreground" {...props}>{children}</h2>
  ),
  h3: ({ children, ...props }) => (
    <h3 className="text-sm font-semibold mt-2 mb-1 text-foreground" {...props}>{children}</h3>
  ),
  h4: ({ children, ...props }) => (
    <h4 className="text-sm font-semibold mt-2 mb-1 text-muted-foreground" {...props}>{children}</h4>
  ),
  p: ({ children, ...props }) => (
    <p className="text-body leading-relaxed mb-2 last:mb-0" {...props}>{children}</p>
  ),
  ul: ({ children, ...props }) => (
    <ul className="list-disc pl-5 mb-2 space-y-0.5 text-body text-foreground marker:text-primary/40" {...props}>{children}</ul>
  ),
  ol: ({ children, ...props }) => (
    <ol className="list-decimal pl-5 mb-2 space-y-0.5 text-body text-foreground marker:text-primary/40" {...props}>{children}</ol>
  ),
  li: ({ children, ...props }) => (
    <li className="text-body leading-relaxed" {...props}>{children}</li>
  ),
  strong: ({ children, ...props }) => (
    <strong className="font-bold text-foreground" {...props}>{children}</strong>
  ),
  em: ({ children, ...props }) => (
    <em className="italic" {...props}>{children}</em>
  ),
  a: ({ children, href, ...props }) => (
    <a
      href={href}
      className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
      target={href?.startsWith("http") ? "_blank" : undefined}
      rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}
      {...props}
    >{children}</a>
  ),
  blockquote: ({ children, ...props }) => (
    <blockquote className="border-l-2 border-primary/30 pl-3 my-2 text-muted-foreground italic" {...props}>{children}</blockquote>
  ),
  code: ({ children, className, ...props }) => {
    const isBlock = className?.includes("language-");
    if (isBlock) {
      return (
        <pre className="bg-muted rounded-md p-3 overflow-x-auto my-2">
          <code className={cn("text-xs font-mono text-foreground", className)} {...props}>{children}</code>
        </pre>
      );
    }
    return (
      <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono text-foreground" {...props}>{children}</code>
    );
  },
  pre: ({ children }) => <>{children}</>,
  table: ({ children, ...props }) => (
    <div className="overflow-x-auto my-2 -mx-1 px-1">
      <table className="min-w-full text-sm border-collapse" {...props}>{children}</table>
    </div>
  ),
  thead: ({ children, ...props }) => (
    <thead className="border-b border-border" {...props}>{children}</thead>
  ),
  th: ({ children, ...props }) => (
    <th className="text-left font-semibold px-2 py-1 text-xs" {...props}>{children}</th>
  ),
  td: ({ children, ...props }) => (
    <td className="px-2 py-1 text-xs border-t border-border/50" {...props}>{children}</td>
  ),
  hr: () => <hr className="my-3 border-border/50" />,
};

export interface AISource {
  id: string;
  label: string;
  sectionId?: string;
}

export interface AIAnswerCardProps extends React.HTMLAttributes<HTMLDivElement> {
  question?: string;
  answer: string;
  sources?: AISource[];
  onSourceClick?: (source: AISource) => void;
  onCopy?: () => void;
  onExpand?: () => void; // Request expanded answer from AI
  isExpanding?: boolean; // Loading state for expand
  isLoading?: boolean;
}

const AIAnswerCard = React.forwardRef<HTMLDivElement, AIAnswerCardProps>(
  (
    {
      className,
      question,
      answer,
      sources = [],
      onSourceClick,
      onCopy,
      onExpand,
      isExpanding = false,
      isLoading = false,
      ...props
    },
    ref
  ) => {
    const [copied, setCopied] = React.useState(false);

    const handleCopy = async () => {
      await navigator.clipboard.writeText(answer);
      setCopied(true);
      onCopy?.();
      setTimeout(() => setCopied(false), 2000);
    };

    return (
      <CardFloating
        ref={ref}
        className={cn("p-lg", className)}
        {...props}
      >
        {/* Question */}
        {question && (
          <div className="mb-md pb-md border-b border-border/50">
            <p className="text-small text-muted-foreground mb-xs">You asked:</p>
            <p className="text-body font-medium text-foreground">{question}</p>
          </div>
        )}

        {/* Answer */}
        <div className="space-y-md">
          {isLoading ? (
            <div className="space-y-sm animate-pulse">
              <div className="h-4 bg-muted rounded w-full" />
              <div className="h-4 bg-muted rounded w-full" />
              <div className="h-4 bg-muted rounded w-3/4" />
            </div>
          ) : (
            <>
              <div className="text-body text-foreground">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                  {answer}
                </ReactMarkdown>
              </div>

              {/* Expand Answer button - requests detailed answer from AI */}
              {onExpand && !isExpanding && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onExpand}
                  className="text-primary"
                >
                  <Maximize2 className="w-4 h-4 mr-xs" />
                  Get detailed answer
                </Button>
              )}
              {isExpanding && (
                <div className="flex items-center gap-sm text-small text-muted-foreground">
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  Expanding...
                </div>
              )}
            </>
          )}

          {/* Sources / Citations */}
          {sources.length > 0 && (
            <div className="pt-md border-t border-border/50">
              <p className="text-small text-muted-foreground mb-sm">
                {sources.length === 1 ? 'Source:' : 'Sources:'}
              </p>
              <div className="flex flex-wrap gap-sm">
                {sources.map((source) => (
                  <SourceChip
                    key={source.id}
                    label={source.label}
                    onClick={() => onSourceClick?.(source)}
                    className="cursor-pointer hover:bg-accent"
                  />
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          {!isLoading && (
            <div className="flex items-center gap-sm pt-md border-t border-border/50">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="text-muted-foreground hover:text-foreground"
              >
                {copied ? (
                  <Check className="w-4 h-4 mr-xs text-success" />
                ) : (
                  <Copy className="w-4 h-4 mr-xs" />
                )}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          )}
        </div>
      </CardFloating>
    );
  }
);
AIAnswerCard.displayName = "AIAnswerCard";

export { AIAnswerCard };
