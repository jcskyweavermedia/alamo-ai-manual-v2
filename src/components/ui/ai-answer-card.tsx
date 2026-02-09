import * as React from "react";
import { ChevronDown, ChevronUp, ThumbsUp, ThumbsDown, Copy, Check, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SourceChip } from "@/components/ui/source-chip";
import { CardFloating } from "@/components/ui/card";

/* =============================================================================
   AI ANSWER CARD COMPONENT
   Per docs/design-specs.md:
   - Not bubbles; answer card with source chips, expand action
   - Floating card style for prominence
============================================================================= */

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
  onFeedback?: (type: "positive" | "negative") => void;
  onCopy?: () => void;
  onExpand?: () => void; // Request expanded answer from AI
  isExpanding?: boolean; // Loading state for expand
  truncateAt?: number;
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
      onFeedback,
      onCopy,
      onExpand,
      isExpanding = false,
      truncateAt = 300,
      isLoading = false,
      ...props
    },
    ref
  ) => {
    const [isTextExpanded, setIsTextExpanded] = React.useState(false);
    const [copied, setCopied] = React.useState(false);
    const [feedback, setFeedback] = React.useState<"positive" | "negative" | null>(null);

    const shouldTruncate = answer.length > truncateAt;
    const displayedAnswer = shouldTruncate && !isTextExpanded
      ? answer.slice(0, truncateAt) + "..."
      : answer;

    const handleCopy = async () => {
      await navigator.clipboard.writeText(answer);
      setCopied(true);
      onCopy?.();
      setTimeout(() => setCopied(false), 2000);
    };

    const handleFeedback = (type: "positive" | "negative") => {
      setFeedback(type);
      onFeedback?.(type);
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
              <div className="text-body text-foreground whitespace-pre-wrap">
                {displayedAnswer}
              </div>

              {shouldTruncate && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsTextExpanded(!isTextExpanded)}
                  className="text-primary"
                >
                  {isTextExpanded ? (
                    <>
                      <ChevronUp className="w-4 h-4 mr-xs" />
                      Show less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-4 h-4 mr-xs" />
                      Show more
                    </>
                  )}
                </Button>
              )}

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
                    sectionId={source.sectionId}
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
              
              <div className="flex-1" />
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleFeedback("positive")}
                className={cn(
                  "text-muted-foreground hover:text-foreground",
                  feedback === "positive" && "text-success"
                )}
              >
                <ThumbsUp className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleFeedback("negative")}
                className={cn(
                  "text-muted-foreground hover:text-foreground",
                  feedback === "negative" && "text-destructive"
                )}
              >
                <ThumbsDown className="w-4 h-4" />
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
