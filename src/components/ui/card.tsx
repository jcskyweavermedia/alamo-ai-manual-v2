import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/* =============================================================================
   CARD COMPONENT
   Extended per docs/design-specs.md:
   - 16px radius (rounded-card)
   - Light mode: white + shadow-card
   - Dark mode: surface + subtle 1px border
   - Variants: default, elevated (sheets/modals), floating (mobile AI)
============================================================================= */

const cardVariants = cva(
  [
    "rounded-card bg-card text-card-foreground",
    "transition-shadow duration-micro",
  ].join(" "),
  {
    variants: {
      elevation: {
        default: "shadow-card dark:border dark:border-border/50",
        elevated: "shadow-elevated dark:border dark:border-border/50",
        floating: "shadow-floating dark:border dark:border-border/50",
        none: "dark:border dark:border-border/50",
      },
    },
    defaultVariants: {
      elevation: "default",
    },
  }
);

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, elevation, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(cardVariants({ elevation, className }))}
      {...props}
    />
  )
);
Card.displayName = "Card";

/**
 * CardElevated - Pre-configured elevated card for sheets/modals
 */
const CardElevated = React.forwardRef<HTMLDivElement, Omit<CardProps, "elevation">>(
  ({ className, ...props }, ref) => (
    <Card ref={ref} elevation="elevated" className={className} {...props} />
  )
);
CardElevated.displayName = "CardElevated";

/**
 * CardFloating - Pre-configured floating card for mobile AI assistant
 */
const CardFloating = React.forwardRef<HTMLDivElement, Omit<CardProps, "elevation">>(
  ({ className, ...props }, ref) => (
    <Card ref={ref} elevation="floating" className={className} {...props} />
  )
);
CardFloating.displayName = "CardFloating";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-xs p-lg pb-0", className)} {...props} />
  ),
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("text-subsection text-foreground", className)} {...props} />
  ),
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-small text-muted-foreground", className)} {...props} />
  ),
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("p-lg", className)} {...props} />,
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center p-lg pt-0", className)} {...props} />
  ),
);
CardFooter.displayName = "CardFooter";

export { Card, CardElevated, CardFloating, CardHeader, CardFooter, CardTitle, CardDescription, CardContent, cardVariants };
