import * as React from "react";

import { cn } from "@/lib/utils";

/* =============================================================================
   TEXTAREA COMPONENT
   Extended per docs/design-specs.md:
   - 44px min height equivalent, 14px radius
============================================================================= */

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[88px] w-full rounded-lg border border-input bg-background",
        "px-md py-sm text-body",
        "ring-offset-background transition-colors duration-micro",
        "placeholder:text-muted-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
