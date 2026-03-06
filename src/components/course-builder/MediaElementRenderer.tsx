// =============================================================================
// MediaElementRenderer — Renders media elements
// Supports image (placeholder + upload), video, and YouTube embed
// Outline state: media_type selector + ai_instructions
// Generated state: renders media with caption
// =============================================================================

import { useState } from 'react';
import { Image as ImageIcon, Video, Youtube, Upload, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useCourseBuilder } from '@/contexts/CourseBuilderContext';
import { getYouTubeEmbedUrl } from '@/lib/course-builder/builder-utils';
import type { MediaElement, MediaType } from '@/types/course-builder';

const MEDIA_TYPE_OPTIONS: { value: MediaType; labelEn: string; labelEs: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'image', labelEn: 'Image', labelEs: 'Imagen', icon: ImageIcon },
  { value: 'video', labelEn: 'Video', labelEs: 'Video', icon: Video },
  { value: 'youtube', labelEn: 'YouTube', labelEs: 'YouTube', icon: Youtube },
];

interface MediaElementRendererProps {
  element: MediaElement;
  language: 'en' | 'es';
}

export function MediaElementRenderer({ element, language }: MediaElementRendererProps) {
  const { updateElement } = useCourseBuilder();
  const [isEditing, setIsEditing] = useState(false);

  const caption = language === 'es' ? (element.caption_es || element.caption_en) : element.caption_en;
  const altText = language === 'es' ? (element.alt_text_es || element.alt_text_en) : element.alt_text_en;

  // --- Outline state ---
  if (element.status === 'outline') {
    return (
      <div className="space-y-2">
        {/* Media type selector */}
        <div className="flex gap-1">
          {MEDIA_TYPE_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => updateElement(element.key, { media_type: opt.value })}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                  element.media_type === opt.value
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {language === 'es' ? opt.labelEs : opt.labelEn}
              </button>
            );
          })}
        </div>

        <Textarea
          value={element.ai_instructions}
          onChange={(e) => updateElement(element.key, { ai_instructions: e.target.value })}
          placeholder={language === 'es'
            ? 'Instrucciones para IA: Describe la imagen o video deseado...'
            : 'AI instructions: Describe the desired image or video...'}
          className="min-h-[40px] text-sm border-dashed resize-none"
        />

        {element.media_type === 'youtube' && (
          <Input
            value={element.video_url || ''}
            onChange={(e) => updateElement(element.key, { video_url: e.target.value })}
            placeholder={language === 'es' ? 'URL de YouTube...' : 'YouTube URL...'}
            className="h-8 text-sm border-dashed"
          />
        )}
      </div>
    );
  }

  // --- Edit mode ---
  if (isEditing) {
    return (
      <div className="space-y-2">
        {/* Media type selector */}
        <div className="flex gap-1">
          {MEDIA_TYPE_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => updateElement(element.key, { media_type: opt.value })}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                  element.media_type === opt.value
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {language === 'es' ? opt.labelEs : opt.labelEn}
              </button>
            );
          })}
        </div>

        {/* Type-specific fields */}
        {element.media_type === 'image' && (
          <div className="space-y-2">
            <Input
              value={element.image_url || ''}
              onChange={(e) => updateElement(element.key, { image_url: e.target.value })}
              placeholder={language === 'es' ? 'URL de imagen...' : 'Image URL...'}
              className="h-8 text-sm"
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => { /* Upload — Phase 4 */ }}
              >
                <Upload className="h-3 w-3 mr-1" />
                {language === 'es' ? 'Subir' : 'Upload'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => { /* AI Generate — Phase 4 */ }}
              >
                <Sparkles className="h-3 w-3 mr-1" />
                {language === 'es' ? 'Generar con IA' : 'AI Generate'}
              </Button>
            </div>
            <Input
              value={element.ai_image_prompt || ''}
              onChange={(e) => updateElement(element.key, { ai_image_prompt: e.target.value })}
              placeholder={language === 'es' ? 'Prompt para generar imagen...' : 'Image generation prompt...'}
              className="h-8 text-sm"
            />
          </div>
        )}

        {(element.media_type === 'video' || element.media_type === 'youtube') && (
          <Input
            value={element.video_url || ''}
            onChange={(e) => updateElement(element.key, { video_url: e.target.value })}
            placeholder={element.media_type === 'youtube'
              ? (language === 'es' ? 'URL de YouTube...' : 'YouTube URL...')
              : (language === 'es' ? 'URL de video...' : 'Video URL...')}
            className="h-8 text-sm"
          />
        )}

        {/* Caption + alt text */}
        <Input
          value={language === 'es' ? (element.caption_es || '') : (element.caption_en || '')}
          onChange={(e) => {
            const key = language === 'es' ? 'caption_es' : 'caption_en';
            updateElement(element.key, { [key]: e.target.value });
          }}
          placeholder={language === 'es' ? 'Leyenda (opcional)...' : 'Caption (optional)...'}
          className="h-7 text-sm"
        />
        <Input
          value={language === 'es' ? (element.alt_text_es || '') : (element.alt_text_en || '')}
          onChange={(e) => {
            const key = language === 'es' ? 'alt_text_es' : 'alt_text_en';
            updateElement(element.key, { [key]: e.target.value });
          }}
          placeholder={language === 'es' ? 'Texto alternativo...' : 'Alt text...'}
          className="h-7 text-sm"
        />

        <button
          type="button"
          onClick={() => setIsEditing(false)}
          className="text-xs text-primary hover:underline"
        >
          {language === 'es' ? 'Ver vista previa' : 'Preview'}
        </button>
      </div>
    );
  }

  // --- Preview / Generated state ---
  const hasMedia = (element.media_type === 'image' && element.image_url) ||
    ((element.media_type === 'video' || element.media_type === 'youtube') && element.video_url);

  return (
    <div
      className="space-y-2 cursor-text"
      onDoubleClick={() => setIsEditing(true)}
    >
      {/* Image with URL */}
      {element.media_type === 'image' && element.image_url && (
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
      )}

      {/* Video with URL */}
      {element.media_type === 'video' && element.video_url && (
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
      )}

      {/* YouTube with URL */}
      {element.media_type === 'youtube' && element.video_url && (
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
      )}

      {/* No media yet — show rich placeholder with AI instructions + caption */}
      {!hasMedia && (
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
                {element.media_type === 'youtube' ? 'YouTube Video' : element.media_type === 'video' ? 'Video' : (language === 'es' ? 'Imagen' : 'Image')}
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

          {/* Action buttons */}
          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
            >
              <Upload className="h-3 w-3 mr-1" />
              {element.media_type === 'youtube'
                ? (language === 'es' ? 'Agregar URL' : 'Add URL')
                : (language === 'es' ? 'Subir' : 'Upload')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

