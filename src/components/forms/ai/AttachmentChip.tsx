/**
 * AttachmentChip
 *
 * Preview chip for attached files shown above the input bar.
 * Thumbnail (for images) + filename + remove button.
 */

import { X, ImageIcon, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AttachmentData {
  id: string;
  name: string;
  type: string;
  previewUrl?: string;
}

interface AttachmentChipProps {
  attachment: AttachmentData;
  onRemove: (id: string) => void;
}

export function AttachmentChip({ attachment, onRemove }: AttachmentChipProps) {
  const isImage = attachment.type.startsWith('image/');
  const Icon = isImage ? ImageIcon : FileText;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5',
        'pl-1.5 pr-1 py-1 rounded-lg',
        'bg-muted/70 dark:bg-muted/50',
        'border border-border/50',
        'text-xs text-foreground',
        'max-w-[140px]',
      )}
    >
      {/* Thumbnail or icon */}
      {isImage && attachment.previewUrl ? (
        <img
          src={attachment.previewUrl}
          alt=""
          className="w-5 h-5 rounded object-cover shrink-0"
        />
      ) : (
        <Icon className="w-4 h-4 shrink-0 text-muted-foreground" />
      )}

      {/* Filename */}
      <span className="truncate text-[11px]">{attachment.name}</span>

      {/* Remove button */}
      <button
        type="button"
        onClick={() => onRemove(attachment.id)}
        className={cn(
          'flex items-center justify-center shrink-0',
          'w-4 h-4 rounded-full',
          'hover:bg-muted-foreground/20',
          'transition-colors duration-100',
        )}
        aria-label={`Remove ${attachment.name}`}
      >
        <X className="h-3 w-3 text-muted-foreground" />
      </button>
    </div>
  );
}
