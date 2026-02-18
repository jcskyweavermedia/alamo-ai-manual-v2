import * as React from "react";
import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";

/* =============================================================================
   SOURCE CHIP COMPONENT
   Per docs/design-specs.md:
   - Tappable source reference (fully rounded pill)
   - Used for AI citations and document references
============================================================================= */

export interface SourceChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  sectionId?: string;
  icon?: React.ReactNode;
  external?: boolean;
}

const SourceChip = React.forwardRef<HTMLButtonElement, SourceChipProps>(
  ({ className, label, icon, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      className={cn(
        "inline-flex items-center gap-1.5",
        "px-2.5 py-1 rounded-full",
        "bg-primary/12 text-primary hover:bg-primary/20",
        "text-xs font-medium",
        "transition-colors duration-micro",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className
      )}
      {...props}
    >
      {icon || <FileText className="w-3.5 h-3.5 shrink-0" />}
      <span className="truncate">{label}</span>
    </button>
  )
);
SourceChip.displayName = "SourceChip";

export { SourceChip };
