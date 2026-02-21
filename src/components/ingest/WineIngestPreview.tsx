import { useState } from 'react';
import { Pencil, Eye, Expand, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { WineStyleBadge } from '@/components/wines/WineStyleBadge';
import { BodyIndicator } from '@/components/wines/BodyIndicator';
import { TopSellerBadge } from '@/components/shared/TopSellerBadge';
import type { WineDraft } from '@/types/ingestion';
import type { WineStyle, WineBody } from '@/types/products';

interface WineIngestPreviewProps {
  draft: WineDraft;
  onSwitchToEdit: () => void;
}

export function WineIngestPreview({ draft, onSwitchToEdit }: WineIngestPreviewProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  if (!draft.name && !draft.producer) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
        <Eye className="h-10 w-10 mb-3 opacity-40" />
        <p className="text-sm font-medium">No wine to preview</p>
        <p className="text-xs mt-1">Build a wine entry in Chat first</p>
      </div>
    );
  }

  const vintageLabel = draft.vintage || 'NV';

  return (
    <div className="space-y-md relative">
      {/* Title + edit button */}
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <WineStyleBadge style={draft.style as WineStyle} variant="text" />
          <h1 className="text-page-title text-foreground truncate">
            {draft.name || 'Untitled Wine'}
          </h1>
        </div>
        <Button variant="outline" size="sm" onClick={onSwitchToEdit}>
          <Pencil className="h-3.5 w-3.5 mr-1.5" />
          Edit
        </Button>
      </div>

      {/* Top seller badge */}
      {draft.isTopSeller && <TopSellerBadge size="md" />}

      {/* Sub-meta row */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
        {draft.producer && <span>{draft.producer}</span>}
        {draft.region && (
          <>
            <span className="text-border">·</span>
            <span>{draft.region}{draft.country ? `, ${draft.country}` : ''}</span>
          </>
        )}
        <span className="text-border">·</span>
        <span>{vintageLabel}</span>
      </div>

      {/* Grape + body row */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {draft.varietal && <span className="text-sm text-foreground">{draft.varietal}</span>}
        {draft.varietal && <span className="text-border">·</span>}
        <BodyIndicator body={draft.body as WineBody} />
      </div>

      <div className="border-t border-border" />

      {/* Two-column layout */}
      <div className="flex flex-col md:flex-row gap-4 md:gap-6">
        {/* Left column — bottle image */}
        <div className="md:w-[35%] lg:w-[30%] md:shrink-0">
          {draft.image ? (
            <button
              type="button"
              onClick={() => setLightboxOpen(true)}
              className="relative group w-full rounded-lg overflow-hidden cursor-pointer bg-muted"
            >
              <div className="aspect-[2/3] max-h-48 md:max-h-none">
                <img
                  src={draft.image}
                  alt={draft.name || 'Wine image'}
                  className="w-full h-full object-contain"
                  loading="lazy"
                />
              </div>
              <span
                className={cn(
                  'absolute bottom-2 right-2',
                  'flex items-center justify-center',
                  'h-7 w-7 rounded-md',
                  'bg-black/50 text-white',
                  'opacity-70 group-hover:opacity-100 transition-opacity'
                )}
              >
                <Expand className="h-3.5 w-3.5" />
              </span>
            </button>
          ) : (
            <div className="aspect-[2/3] max-h-48 md:max-h-none rounded-lg bg-muted flex items-center justify-center">
              <span className="text-xs text-muted-foreground">No image</span>
            </div>
          )}
        </div>

        {/* Right column — info sections */}
        <div className="flex-1 min-w-0 space-y-3">
          {draft.tastingNotes && (
            <section>
              <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1">
                Tasting Notes
              </h2>
              <p className="text-sm leading-snug text-foreground whitespace-pre-wrap">
                {draft.tastingNotes}
              </p>
            </section>
          )}
          {draft.producerNotes && (
            <section>
              <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1">
                Producer Notes
              </h2>
              <p className="text-sm leading-snug text-foreground whitespace-pre-wrap">
                {draft.producerNotes}
              </p>
            </section>
          )}
          {draft.notes && (
            <section>
              <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1">
                Notes
              </h2>
              <p className="text-sm leading-snug text-foreground whitespace-pre-wrap">
                {draft.notes}
              </p>
            </section>
          )}
          {!draft.tastingNotes && !draft.producerNotes && !draft.notes && (
            <p className="text-xs text-muted-foreground text-center py-8">
              No tasting or service notes yet
            </p>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightboxOpen && draft.image && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            className={cn(
              'absolute top-4 right-4',
              'flex items-center justify-center',
              'h-10 w-10 rounded-full',
              'bg-white/20 text-white',
              'hover:bg-white/30 transition-colors'
            )}
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={draft.image}
            alt={draft.name || 'Wine image'}
            className="max-w-[90%] max-h-[85vh] rounded-xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
