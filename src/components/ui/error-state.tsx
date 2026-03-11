import * as React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/* =============================================================================
   ERROR STATE COMPONENT
   Per docs/design-specs.md:
   - Clear error + recovery action
============================================================================= */

const STRINGS = {
  en: {
    title: "Something went wrong",
    description: "We couldn't load this content. Please try again.",
    retry: "Try again",
  },
  es: {
    title: "Algo salió mal",
    description: "No pudimos cargar este contenido. Intenta de nuevo.",
    retry: "Intentar de nuevo",
  },
} as const;

interface ErrorStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
  /** Language for default strings (default: 'en') */
  language?: 'en' | 'es';
}

const ErrorState = React.forwardRef<HTMLDivElement, ErrorStateProps>(
  (
    {
      className,
      title,
      description,
      onRetry,
      retryLabel,
      language = 'en',
      ...props
    },
    ref
  ) => {
    const t = STRINGS[language];
    const resolvedTitle = title ?? t.title;
    const resolvedDescription = description ?? t.description;
    const resolvedRetryLabel = retryLabel ?? t.retry;

    return (
    <div
      ref={ref}
      className={cn(
        "flex flex-col items-center justify-center text-center py-2xl px-lg",
        className
      )}
      {...props}
    >
      <div className="w-12 h-12 rounded-full bg-destructive/12 flex items-center justify-center mb-lg">
        <AlertCircle className="w-6 h-6 text-destructive" />
      </div>
      <h3 className="text-subsection text-foreground mb-xs">{resolvedTitle}</h3>
      <p className="text-body text-muted-foreground max-w-reading-sm mb-lg">
        {resolvedDescription}
      </p>
      {onRetry && (
        <Button onClick={onRetry} variant="secondary">
          <RefreshCw className="w-4 h-4 mr-sm" />
          {resolvedRetryLabel}
        </Button>
      )}
    </div>
    );
  }
);
ErrorState.displayName = "ErrorState";

export { ErrorState };
