import { useState, useEffect, useCallback, useRef, type RefObject } from 'react';

interface UseActiveSectionObserverOptions {
  sectionKeys: string[];
  scrollContainerRef: RefObject<HTMLElement | null>;
  enabled?: boolean;
}

export function useActiveSectionObserver({
  sectionKeys,
  scrollContainerRef,
  enabled = true,
}: UseActiveSectionObserverOptions) {
  const [activeSectionKey, setActiveSectionKey] = useState('');
  const [scrollProgress, setScrollProgress] = useState(0);
  const isScrollingToRef = useRef(false);

  // IntersectionObserver: watches data-section-key elements
  useEffect(() => {
    if (!enabled || sectionKeys.length === 0) return;

    const container = scrollContainerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (isScrollingToRef.current) return;

        // Find all currently intersecting entries
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        if (visible.length > 0) {
          const key = visible[0].target.getAttribute('data-section-key');
          if (key) setActiveSectionKey(key);
        }
      },
      {
        root: container,
        // Top 40% of viewport determines "active"
        rootMargin: '-80px 0px -60% 0px',
        threshold: 0,
      }
    );

    // Observe all section elements
    const elements = container.querySelectorAll('[data-section-key]');
    elements.forEach(el => observer.observe(el));

    return () => observer.disconnect();
  }, [sectionKeys, scrollContainerRef, enabled]);

  // Scroll progress listener
  useEffect(() => {
    if (!enabled) return;

    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const maxScroll = scrollHeight - clientHeight;
      const progress = maxScroll > 0 ? Math.min(scrollTop / maxScroll, 1) : 0;
      setScrollProgress(progress);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [scrollContainerRef, enabled]);

  // Smooth scroll to a section
  const scrollToSection = useCallback((key: string) => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const target = container.querySelector(`[data-section-key="${key}"]`);
    if (!target) return;

    isScrollingToRef.current = true;
    setActiveSectionKey(key);

    target.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Release lock after scroll animation completes
    setTimeout(() => {
      isScrollingToRef.current = false;
    }, 600);
  }, [scrollContainerRef]);

  return { activeSectionKey, scrollProgress, scrollToSection };
}
