import * as React from "react";
import { cn } from "@/lib/utils";

/* =============================================================================
   LANGUAGE TOGGLE COMPONENT
   Per docs/design-specs.md:
   - EN/ES switcher, persistent, consistent across app
   - Pill style with clear active state
============================================================================= */

export type Language = "en" | "es";

export interface LanguageToggleProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  value: Language;
  onChange: (language: Language) => void;
  size?: "sm" | "default";
}

const LanguageToggle = React.forwardRef<HTMLDivElement, LanguageToggleProps>(
  ({ className, value, onChange, size = "default", ...props }, ref) => {
    const isSmall = size === "sm";

    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex items-center rounded-full bg-muted p-0.5",
          className
        )}
        role="radiogroup"
        aria-label="Language selection"
        {...props}
      >
        <button
          type="button"
          role="radio"
          aria-checked={value === "en"}
          onClick={() => onChange("en")}
          className={cn(
            "rounded-full font-medium transition-all duration-micro",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            // 44px min touch target per design-specs.md
            isSmall ? "min-h-[36px] min-w-[36px] px-sm text-small" : "min-h-[44px] min-w-[44px] px-md text-body",
            value === "en"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          EN
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={value === "es"}
          onClick={() => onChange("es")}
          className={cn(
            "rounded-full font-medium transition-all duration-micro",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            // 44px min touch target per design-specs.md
            isSmall ? "min-h-[36px] min-w-[36px] px-sm text-small" : "min-h-[44px] min-w-[44px] px-md text-body",
            value === "es"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          ES
        </button>
      </div>
    );
  }
);
LanguageToggle.displayName = "LanguageToggle";

export { LanguageToggle };
