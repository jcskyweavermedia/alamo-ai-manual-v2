// =============================================================================
// PlayerMediaRenderer — Read-only media renderer for the course player.
// Supports image, video, and YouTube embed. Shows placeholder when no media URL.
// =============================================================================

import { Image as ImageIcon, Video, Youtube } from 'lucide-react';
import { getYouTubeEmbedUrl } from '@/lib/course-builder/builder-utils';
import type { MediaElement } from '@/types/course-builder';

interface Props {
  element: MediaElement;
  language: 'en' | 'es';
}

export function PlayerMediaRenderer({ element, language }: Props) {
  const caption = language === 'es' ? (element.caption_es || element.caption_en) : element.caption_en;
  const altText = language === 'es' ? (element.alt_text_es || element.alt_text_en) : element.alt_text_en;

  // Image with URL
  if (element.media_type === 'image' && element.image_url) {
    return (
      <div className="space-y-1">
        <img
          src={element.image_url}
          alt={altText || ''}
          className="w-full max-h-64 object-cover rounded-md"
        />
        {caption && (
          <p className="text-xs text-muted-foreground text-center italic">{caption}</p>
        )}
      </div>
    );
  }

  // Video with URL
  if (element.media_type === 'video' && element.video_url) {
    return (
      <div className="space-y-1">
        <video
          src={element.video_url}
          controls
          className="w-full max-h-64 rounded-md"
        />
        {caption && (
          <p className="text-xs text-muted-foreground text-center italic">{caption}</p>
        )}
      </div>
    );
  }

  // YouTube with URL
  if (element.media_type === 'youtube' && element.video_url) {
    return (
      <div className="space-y-1">
        <div className="relative w-full pb-[56.25%] rounded-md overflow-hidden bg-black">
          <iframe
            src={getYouTubeEmbedUrl(element.video_url)}
            title={caption || 'YouTube video'}
            className="absolute inset-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
        {caption && (
          <p className="text-xs text-muted-foreground text-center italic">{caption}</p>
        )}
      </div>
    );
  }

  // No media — show a placeholder with AI instructions text
  return (
    <div className="rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/20 p-4 space-y-3">
      {/* Header with icon */}
      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center h-8 w-8 rounded-md bg-muted/60">
          {element.media_type === 'youtube' ? (
            <Youtube className="h-4 w-4 text-muted-foreground" />
          ) : element.media_type === 'video' ? (
            <Video className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        <div>
          <p className="text-sm font-medium text-foreground/80">
            {element.media_type === 'youtube'
              ? 'YouTube Video'
              : element.media_type === 'video'
                ? 'Video'
                : (language === 'es' ? 'Imagen' : 'Image')}
          </p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
            {language === 'es' ? 'Multimedia pendiente' : 'Media pending'}
          </p>
        </div>
      </div>

      {/* AI Instructions */}
      {element.ai_instructions && (
        <div className="rounded-md bg-background/60 border border-border/40 p-3">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
            {language === 'es' ? 'Instrucciones' : 'Instructions'}
          </p>
          <p className="text-sm text-foreground/70 leading-relaxed">
            {element.ai_instructions}
          </p>
        </div>
      )}

      {/* Caption (if AI-generated) */}
      {caption && (
        <div className="pt-1 border-t border-border/30">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            {language === 'es' ? 'Leyenda' : 'Caption'}
          </p>
          <p className="text-sm italic text-foreground/60">{caption}</p>
        </div>
      )}
    </div>
  );
}
