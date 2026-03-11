// =============================================================================
// DevicePreviewFrame — Constrains preview content to device widths with bezel
// Desktop: max-w-2xl (no bezel), Tablet: 768px, Phone: 375px
// =============================================================================

import { cn } from '@/lib/utils';
import type { PreviewDevice } from '@/types/course-builder';

interface DevicePreviewFrameProps {
  device: PreviewDevice;
  children: React.ReactNode;
}

export function DevicePreviewFrame({ device, children }: DevicePreviewFrameProps) {
  if (device === 'desktop') {
    return (
      <div className="max-w-2xl mx-auto py-4">
        {children}
      </div>
    );
  }

  const isTabletLandscape = device === 'tablet-landscape';
  const isTablet = device === 'tablet' || isTabletLandscape;

  return (
    <div className="flex justify-center py-6">
      <div
        className={cn(
          'relative bg-background overflow-hidden',
          device === 'phone' && 'w-[375px] rounded-[2rem] border-2 border-gray-300 shadow-lg',
          device === 'tablet' && 'w-[768px] rounded-xl border border-gray-200 shadow-md',
          isTabletLandscape && 'w-[1024px] rounded-xl border border-gray-200 shadow-md',
        )}
      >
        {/* Top notch / camera area */}
        {device === 'phone' && (
          <div className="flex justify-center pt-2 pb-1">
            <div className="w-20 h-1.5 rounded-full bg-gray-200" />
          </div>
        )}

        {/* Content area */}
        <div
          className={cn(
            'overflow-y-auto',
            device === 'phone' && 'px-3 pb-4 max-h-[680px]',
            device === 'tablet' && 'px-4 py-4 max-h-[800px]',
            isTabletLandscape && 'px-6 py-4 max-h-[600px]',
          )}
        >
          {children}
        </div>

        {/* Bottom home indicator (phone only) */}
        {device === 'phone' && (
          <div className="flex justify-center pb-2 pt-1">
            <div className="w-28 h-1 rounded-full bg-gray-300" />
          </div>
        )}
      </div>
    </div>
  );
}
