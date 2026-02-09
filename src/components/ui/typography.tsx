import * as React from "react";
import { cn } from "@/lib/utils";

/* =============================================================================
   TYPOGRAPHY COMPONENTS
   Based on: docs/design-specs.md
   
   Uses semantic Tailwind classes from tailwind.config.ts fontSize scale.
============================================================================= */

/**
 * PageTitle - H1 (22px, semibold, tight tracking, line-height 1.2)
 * Use for top-level page headers
 */
export const PageTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h1
    ref={ref}
    className={cn("text-page-title text-foreground", className)}
    {...props}
  />
));
PageTitle.displayName = "PageTitle";

/**
 * SectionTitle - H2 (18px, semibold, line-height 1.3)
 * Use for major sections within a page
 */
export const SectionTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h2
    ref={ref}
    className={cn("text-section-title text-foreground", className)}
    {...props}
  />
));
SectionTitle.displayName = "SectionTitle";

/**
 * Subsection - H3 (16px, semibold, line-height 1.35)
 * Use for subsections or card titles
 */
export const Subsection = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("text-subsection text-foreground", className)}
    {...props}
  />
));
Subsection.displayName = "Subsection";

/**
 * BodyText - Body (15px, regular, line-height 1.6)
 * Primary body text for content
 */
export const BodyText = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-body text-foreground", className)}
    {...props}
  />
));
BodyText.displayName = "BodyText";

/**
 * BodyTextRelaxed - Body (15px, regular, line-height 1.65)
 * Use for Spanish text or content needing more breathing room
 */
export const BodyTextRelaxed = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-body-relaxed text-foreground", className)}
    {...props}
  />
));
BodyTextRelaxed.displayName = "BodyTextRelaxed";

/**
 * MetaText - Caption (14px, muted-foreground)
 * Use for secondary information, timestamps, labels
 */
export const MetaText = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-caption text-muted-foreground", className)}
    {...props}
  />
));
MetaText.displayName = "MetaText";

/**
 * SmallText - Small (13px, muted-foreground)
 * Use for metadata, fine print, timestamps
 */
export const SmallText = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-small text-muted-foreground", className)}
    {...props}
  />
));
SmallText.displayName = "SmallText";

/**
 * TertiaryText - Hint text (tertiary-foreground)
 * Use for placeholder text, disabled states, low-priority hints
 */
export const TertiaryText = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-small text-tertiary", className)}
    {...props}
  />
));
TertiaryText.displayName = "TertiaryText";

/**
 * MonoText - Monospace text for SOP codes, temps, timers
 */
export const MonoText = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement>
>(({ className, ...props }, ref) => (
  <span
    ref={ref}
    className={cn("font-mono text-body", className)}
    {...props}
  />
));
MonoText.displayName = "MonoText";
