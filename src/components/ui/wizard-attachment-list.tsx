/**
 * WizardAttachmentList
 *
 * Horizontal scrollable row of AttachmentChip components.
 * Shown inside WizardRichInput when attachments exist.
 */

import { AttachmentChip } from '@/components/forms/ai/AttachmentChip';
import type { AttachmentData } from '@/components/forms/ai/AttachmentChip';

interface WizardAttachmentListProps {
  attachments: AttachmentData[];
  onRemove: (id: string) => void;
}

export function WizardAttachmentList({ attachments, onRemove }: WizardAttachmentListProps) {
  if (attachments.length === 0) return null;

  return (
    <div className="flex gap-1.5 px-3 py-2 overflow-x-auto border-t border-border/50">
      {attachments.map((att) => (
        <AttachmentChip key={att.id} attachment={att} onRemove={onRemove} />
      ))}
    </div>
  );
}
