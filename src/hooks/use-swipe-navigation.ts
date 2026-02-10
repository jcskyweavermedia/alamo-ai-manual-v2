import { useRef, useEffect, useCallback } from 'react';

interface UseSwipeNavigationOptions {
  onSwipeLeft?: () => void;   // → next item
  onSwipeRight?: () => void;  // → prev item
  enabled?: boolean;
}

const SWIPE_THRESHOLD = 50; // minimum horizontal px

export function useSwipeNavigation<T extends HTMLElement = HTMLDivElement>({
  onSwipeLeft,
  onSwipeRight,
  enabled = true,
}: UseSwipeNavigationOptions) {
  const ref = useRef<T>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const touch = e.touches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (!touchStart.current) return;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - touchStart.current.x;
      const dy = touch.clientY - touchStart.current.y;
      touchStart.current = null;

      // Horizontal must exceed threshold and be greater than vertical (avoid scroll false triggers)
      if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy)) return;

      if (dx < 0) {
        onSwipeLeft?.();
      } else {
        onSwipeRight?.();
      }
    },
    [onSwipeLeft, onSwipeRight]
  );

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [enabled, handleTouchStart, handleTouchEnd]);

  return { ref };
}
