import * as React from "react";

import { cn } from "@/lib/utils";

/* =============================================================================
   INPUT COMPONENT
   Extended per docs/design-specs.md:
   - 44px min height (touch target)
   - 14px radius (rounded-lg)
============================================================================= */

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-lg border border-input bg-background",
          "px-md py-sm text-body",
          "ring-offset-background transition-colors duration-micro",
          "file:border-0 file:bg-transparent file:text-small file:font-medium file:text-foreground",
          "placeholder:text-muted-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
