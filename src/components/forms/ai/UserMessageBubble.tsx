/**
 * UserMessageBubble
 *
 * User message bubble in the conversation. Right-aligned.
 * Primary color background. Shows attachment names if any.
 */

import { Paperclip } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UserMessageBubbleProps {
  message: string;
  attachments?: Array<{ name: string; type: string; previewUrl?: string }>;
  className?: string;
}

export function UserMessageBubble({ message, attachments, className }: UserMessageBubbleProps) {
  const imageAttachments = attachments?.filter((a) => a.previewUrl) ?? [];
  const fileAttachments = attachments?.filter((a) => !a.previewUrl) ?? [];

  return (
    <div className={cn('flex justify-end', className)}>
      <div className="max-w-[85%] space-y-1.5">
        {/* Image thumbnails */}
        {imageAttachments.length > 0 && (
          <div className="flex flex-wrap justify-end gap-1.5">
            {imageAttachments.map((att, i) => (
              <img
                key={`img-${i}`}
                src={att.previewUrl}
                alt={att.name}
                className="h-16 w-16 rounded-lg object-cover border border-primary/20"
              />
            ))}
          </div>
        )}

        {/* File attachment indicators */}
        {fileAttachments.length > 0 && (
          <div className="flex flex-wrap justify-end gap-1">
            {fileAttachments.map((att, i) => (
              <span
                key={`file-${i}`}
                className={cn(
                  'inline-flex items-center gap-1',
                  'px-2 py-0.5 rounded-full',
                  'bg-primary/20 text-primary-foreground/80',
                  'text-[10px] font-medium',
                )}
              >
                <Paperclip className="h-2.5 w-2.5" />
                {att.name}
              </span>
            ))}
          </div>
        )}

        {/* Message bubble */}
        <div
          className={cn(
            'px-3 py-2 rounded-2xl rounded-tr-sm',
            'bg-primary text-primary-foreground',
            'text-sm leading-relaxed',
          )}
        >
          {message}
        </div>
      </div>
    </div>
  );
}
