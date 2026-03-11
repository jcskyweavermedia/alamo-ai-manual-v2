/**
 * useWizardAttachments Hook
 *
 * Manages File[] state with preview URLs for wizard rich inputs.
 * Handles add/remove/clear with automatic URL lifecycle (revoke on unmount).
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import type { AttachmentData } from '@/components/forms/ai/AttachmentChip';

// ── Shared validation constants (exported for external-mode callers) ─────────
export const MAX_ATTACHMENTS = 5;
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'text/plain',
]);

/**
 * Validate a single file against attachment constraints.
 * Returns `true` if valid, shows toast and returns `false` otherwise.
 */
export function validateAttachmentFile(file: File, currentCount: number): boolean {
  if (currentCount >= MAX_ATTACHMENTS) {
    toast.error(`Maximum ${MAX_ATTACHMENTS} files allowed`);
    return false;
  }
  if (file.size > MAX_FILE_SIZE) {
    toast.error(`"${file.name}" is too large (max 10 MB)`);
    return false;
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    toast.error(`"${file.name}" — unsupported type. Use JPG, PNG, PDF, or TXT.`);
    return false;
  }
  return true;
}

interface UseWizardAttachmentsReturn {
  attachments: AttachmentData[];
  addFiles: (files: FileList) => void;
  removeAttachment: (id: string) => void;
  clearAll: () => void;
}

let nextId = 0;

export function useWizardAttachments(): UseWizardAttachmentsReturn {
  const [attachments, setAttachments] = useState<AttachmentData[]>([]);
  const urlsRef = useRef<string[]>([]);

  // Revoke all object URLs on unmount
  useEffect(() => {
    return () => {
      urlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      urlsRef.current = [];
    };
  }, []);

  const addFiles = useCallback((files: FileList) => {
    setAttachments((prev) => {
      const newAttachments: AttachmentData[] = [];
      let currentCount = prev.length;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!validateAttachmentFile(file, currentCount)) {
          if (currentCount >= MAX_ATTACHMENTS) break; // hard stop on count limit
          continue;
        }

        const isImage = file.type.startsWith('image/');
        const previewUrl = isImage ? URL.createObjectURL(file) : undefined;
        if (previewUrl) urlsRef.current.push(previewUrl);

        newAttachments.push({
          id: `wz-${++nextId}`,
          name: file.name,
          type: file.type,
          previewUrl,
          file,
        });
        currentCount++;
      }
      return [...prev, ...newAttachments];
    });
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => {
      const item = prev.find((a) => a.id === id);
      if (item?.previewUrl) {
        // Side effects moved outside the updater scope — revokeObjectURL and
        // ref mutation are safe here because they are idempotent
        URL.revokeObjectURL(item.previewUrl);
        urlsRef.current = urlsRef.current.filter((u) => u !== item.previewUrl);
      }
      return prev.filter((a) => a.id !== id);
    });
  }, []);

  const clearAll = useCallback(() => {
    // Revoke URLs before clearing state
    urlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    urlsRef.current = [];
    setAttachments([]);
  }, []);

  return { attachments, addFiles, removeAttachment, clearAll };
}
