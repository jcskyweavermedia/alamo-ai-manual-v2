import { cn } from '@/lib/utils';

interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Wrapper component for page content that applies enter animation
 * Per design-specs.md: fade + slide, 200-260ms
 */
export function PageTransition({ children, className }: PageTransitionProps) {
  return (
    <div 
      className={cn(
        "animate-page-enter",
        className
      )}
    >
      {children}
    </div>
  );
}
