import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/* =============================================================================
   BUTTON COMPONENT
   Extended per docs/design-specs.md:
   - 44px min touch target
   - 14px radius (rounded-lg)
   - scale(0.98) press state
   - Variants: primary, secondary, tertiary (ghost), outline, destructive
============================================================================= */

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "text-body font-medium",
    "rounded-lg",                                    // 14px radius
    "min-h-[44px] px-lg",                           // 44px touch target
    "ring-offset-background",
    "transition-all duration-micro",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-50",
    "active:scale-[0.98]",                          // Press state feedback
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary-hover",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        tertiary: "text-primary hover:text-primary-hover hover:bg-primary-subtle",
        link: "text-primary underline-offset-4 hover:underline min-h-0 px-0",
      },
      size: {
        default: "h-11 px-lg py-sm",               // 44px
        sm: "h-10 rounded-lg px-md text-small",    // 40px for compact areas
        lg: "h-12 rounded-lg px-xl",               // 48px for prominent CTAs
        icon: "h-11 w-11",                         // 44px square
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
