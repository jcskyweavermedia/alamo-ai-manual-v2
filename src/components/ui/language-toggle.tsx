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
  size?: "xs" | "sm" | "default";
}

const sizeClasses = {
  xs: "min-h-[28px] min-w-[28px] px-1.5 text-[11px]",
  sm: "min-h-[36px] min-w-[36px] px-sm text-small",
  default: "min-h-[44px] min-w-[44px] px-md text-body",
} as const;

const LanguageToggle = React.forwardRef<HTMLDivElement, LanguageToggleProps>(
  ({ className, value, onChange, size = "default", ...props }, ref) => {
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
            sizeClasses[size],
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
            sizeClasses[size],
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
