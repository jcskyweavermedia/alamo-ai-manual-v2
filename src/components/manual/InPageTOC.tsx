/**
 * InPageTOC (Table of Contents)
 * 
 * Displays H2/H3 headings extracted from Markdown content.
 * Features scroll spy to highlight current section and smooth scroll navigation.
 * Only shown when there are 3+ headings.
 * 
 * Supports custom scroll container for proper IntersectionObserver behavior
 * when the TOC is in a fixed sidebar and content scrolls in a separate container.
 */

import { useEffect, useState, useMemo, type RefObject } from "react";
import { cn } from "@/lib/utils";

export interface TOCHeading {
  id: string;
  text: string;
  level: 2 | 3;
}

export interface InPageTOCProps {
  /** Raw markdown content to extract headings from */
  markdown: string;
  /** 
   * Reference to the scroll container element.
   * If provided, IntersectionObserver uses this as root instead of viewport.
   * Required when TOC is in a fixed sidebar and content scrolls separately.
   */
  scrollContainerRef?: RefObject<HTMLElement>;
  /** Additional class names */
  className?: string;
}

/**
 * Extract H2 and H3 headings from markdown content
 */
function extractHeadings(markdown: string): TOCHeading[] {
  const headings: TOCHeading[] = [];
  const lines = markdown.split('\n');
  
  for (const line of lines) {
    // Match ## and ### headings
    const h2Match = line.match(/^## (.+)$/);
    const h3Match = line.match(/^### (.+)$/);
    
    if (h2Match) {
      const text = h2Match[1].trim();
      const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      headings.push({ id, text, level: 2 });
    } else if (h3Match) {
      const text = h3Match[1].trim();
      const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      headings.push({ id, text, level: 3 });
    }
  }
  
  return headings;
}

export function InPageTOC({ markdown, scrollContainerRef, className }: InPageTOCProps) {
  const [activeId, setActiveId] = useState<string>('');
  
  const headings = useMemo(() => extractHeadings(markdown), [markdown]);
  
  const hasEnoughHeadings = headings.length >= 3;

  // Scroll spy effect
  useEffect(() => {
    if (!hasEnoughHeadings) return;
    
    // Use the scroll container as root if provided, otherwise use viewport
    const root = scrollContainerRef?.current ?? null;
    
    const observer = new IntersectionObserver(
      (entries) => {
        // Find the first visible heading
        const visible = entries.filter(e => e.isIntersecting);
        if (visible.length > 0) {
          // Sort by position and take the topmost
          visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
          setActiveId(visible[0].target.id || '');
        }
      },
      {
        root,
        rootMargin: '-80px 0px -70% 0px',
        threshold: 0,
      }
    );

    // Observe all heading elements
    headings.forEach((heading) => {
      const element = document.getElementById(heading.id);
      if (element) {
        observer.observe(element);
      }
    });

    return () => observer.disconnect();
  }, [headings, hasEnoughHeadings, scrollContainerRef]);

  // Don't render if fewer than 3 headings
  if (!hasEnoughHeadings) {
    return null;
  }

  const handleClick = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      // If we have a scroll container, scroll within it
      if (scrollContainerRef?.current) {
        const container = scrollContainerRef.current;
        const elementTop = element.offsetTop;
        container.scrollTo({ 
          top: elementTop - 80, // Account for some padding
          behavior: 'smooth' 
        });
      } else {
        // Fallback to native scrollIntoView
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      setActiveId(id);
    }
  };

  return (
    <nav
      className={cn("space-y-sm", className)}
      aria-label="On this page"
    >
      <h4 className="text-caption font-semibold text-muted-foreground uppercase tracking-wide">
        On This Page
      </h4>
      
      <ul className="space-y-xs text-small">
        {headings.map((heading) => (
          <li key={heading.id}>
            <button
              onClick={() => handleClick(heading.id)}
              className={cn(
                "text-left w-full py-1 transition-colors duration-micro",
                "hover:text-foreground",
                "focus-visible:outline-none focus-visible:text-foreground",
                heading.level === 3 && "pl-3",
                activeId === heading.id
                  ? "text-primary font-medium"
                  : "text-muted-foreground"
              )}
            >
              {heading.text}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
