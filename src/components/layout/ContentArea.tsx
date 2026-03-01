import { cn } from '@/lib/utils';
import { PageTransition } from './PageTransition';

interface ContentAreaProps {
  children: React.ReactNode;
  /** Constrain to reading width (640-760px) */
  constrainWidth?: boolean;
  /** Center content horizontally */
  centered?: boolean;
  /** Apply page enter animation */
  animate?: boolean;
  /** 
   * Control overflow behavior
   * - 'auto': scrollable (default, includes mobile tab bar padding)
   * - 'hidden': delegate scroll to children (no padding applied)
   * - 'visible': no scroll constraints
   */
  overflow?: 'auto' | 'hidden' | 'visible';
  className?: string;
}

export function ContentArea({
  children,
  constrainWidth = true,
  centered = true,
  animate = true,
  overflow = 'auto',
  className,
}: ContentAreaProps) {
  const content = (
    <div
      className={cn(
        "w-full",
        // When overflow is hidden, pass through height for fixed column layouts
        overflow === 'hidden' && "h-full",
        constrainWidth && "max-w-reading",
        constrainWidth && centered && "mx-auto"
      )}
    >
      {children}
    </div>
  );

  return (
    <main
      className={cn(
        "flex-1 min-h-0", // min-h-0 prevents flex item from overflowing
        // Height constraint for fixed layouts
        overflow === 'hidden' && "h-full",
        // Overflow handling
        overflow === 'auto' && "overflow-y-auto",
        overflow === 'hidden' && "overflow-hidden",
        overflow === 'visible' && "overflow-visible",
        // Padding (only when this component handles scrolling)
        overflow === 'auto' && "px-4 py-4 md:px-6 md:py-6 lg:px-8",
        overflow === 'auto' && "pb-24 md:pb-6", // Mobile tab bar padding
        // When overflow is hidden, children handle their own padding
        overflow === 'hidden' && "p-0",
        className
      )}
    >
      {animate ? (
        <PageTransition className={overflow === 'hidden' ? 'h-full' : undefined}>
          {content}
        </PageTransition>
      ) : content}
    </main>
  );
}