// =============================================================================
// WeeklyUpdateOverlay -- Full-screen overlay with the weekly AI report
// =============================================================================

import { ArrowLeft, Calendar, X } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { ADMIN_STRINGS } from '../strings';
import { MOCK_WEEKLY_UPDATE } from '@/data/mock-admin-panel';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface WeeklyUpdateOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  language: 'en' | 'es';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WeeklyUpdateOverlay({ isOpen, onClose, language }: WeeklyUpdateOverlayProps) {
  const t = ADMIN_STRINGS[language];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="fixed inset-[3%] max-w-none rounded-[20px] p-0 overflow-y-auto bg-background translate-x-0 translate-y-0 left-0 top-0"
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        {/* Accessible title (hidden) */}
        <VisuallyHidden>
          <DialogTitle>{t.weeklyUpdate}</DialogTitle>
        </VisuallyHidden>

        {/* Sticky top bar */}
        <div className="sticky top-0 z-50 border-b border-border bg-background rounded-t-[20px]">
          <div className="max-w-screen-xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
            {/* Left: back button */}
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-lg flex items-center justify-center text-white shrink-0 transition-all bg-orange-500 hover:bg-orange-600 active:scale-[0.96]"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-medium text-muted-foreground">
                {t.backToAiHub}
              </span>
            </div>

            {/* Right: date badge + close */}
            <div className="flex items-center gap-2">
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                style={{ background: 'linear-gradient(135deg, #F97316, #EA580C)' }}
              >
                <Calendar className="h-3 w-3" />
                {t.weekOf} Mar 10, 2026
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center border border-border text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="max-w-screen-lg mx-auto px-8 py-8">
          <article>
            {/* Title block */}
            <div className="mb-8 border-b border-border pb-6">
              <h1 className="text-2xl font-bold mb-1">
                {t.weeklyUpdate} — Mar 12, 2026
              </h1>
              <p className="text-muted-foreground" style={{ fontSize: 15 }}>
                {language === 'es'
                  ? 'Esto es lo que tenemos esta semana. Seré breve.'
                  : "Here's where we stand this week. I'll keep it short."}
              </p>
            </div>

            {/* Sections */}
            {MOCK_WEEKLY_UPDATE.map((section, idx) => (
              <div key={idx}>
                <h2 className="text-lg font-bold mb-3">{section.title}</h2>
                {section.paragraphs.map((para, pIdx) => (
                  <p
                    key={pIdx}
                    className="text-muted-foreground mb-4"
                    style={{ fontSize: 15, lineHeight: 1.85 }}
                    dangerouslySetInnerHTML={{
                      __html: para
                        .replace(
                          /\*\*(.*?)\*\*/g,
                          '<strong class="text-foreground font-semibold">$1</strong>',
                        ),
                    }}
                  />
                ))}
                {idx < MOCK_WEEKLY_UPDATE.length - 1 && (
                  <hr className="my-7 border-border" />
                )}
              </div>
            ))}

            {/* Footer */}
            <p className="mt-6 text-[13px] text-muted-foreground">
              — {t.aiTrainingManager} · Generated Mar 12, 2026 at 9:00 AM
            </p>
          </article>
        </div>
      </DialogContent>
    </Dialog>
  );
}
