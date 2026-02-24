/**
 * useFormAttachments Hook
 *
 * Handles uploading files and signatures to the private 'form-attachments'
 * storage bucket. Returns upload functions with loading/error state.
 *
 * Storage path pattern: {submissionId}/{fieldKey}/{timestamp}-{sanitizedName}
 * Signature path:       {submissionId}/signatures/{fieldKey}-{timestamp}.png
 *
 * IMPORTANT: Store the storage PATH (not signed URL) in field_values.
 * Signed URLs expire — regenerate on each form load via useSignedUrl.
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// =============================================================================
// CONSTANTS
// =============================================================================

const BUCKET = 'form-attachments';

const ACCEPTED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const ACCEPTED_FILE_TYPES = new Set([
  ...ACCEPTED_IMAGE_TYPES,
  'application/pdf',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB (before compression)

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Sanitize a filename for safe storage path usage.
 * Removes special characters, keeps extension.
 */
function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .slice(0, 100); // Cap length
}

// =============================================================================
// HOOK
// =============================================================================

export interface UploadResult {
  /** The storage path (not a signed URL). Store this in field_values. */
  path: string;
  /** A temporary signed URL for immediate preview (1-hour expiry). */
  signedUrl: string;
}

export function useFormAttachments() {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // uploadFile — upload a file (image, pdf, etc.) to the storage bucket
  // ---------------------------------------------------------------------------
  const uploadFile = useCallback(
    async (
      file: File,
      submissionId: string,
      fieldKey: string,
    ): Promise<UploadResult | null> => {
      // Validate file type
      if (!ACCEPTED_FILE_TYPES.has(file.type)) {
        const message = 'Unsupported file type. Please use images, PDF, Word, Excel, or text files.';
        toast.error(message);
        setError(message);
        return null;
      }

      // Validate file size
      const maxSize = ACCEPTED_IMAGE_TYPES.has(file.type) ? MAX_IMAGE_SIZE : MAX_FILE_SIZE;
      if (file.size > maxSize) {
        const limitMB = Math.round(maxSize / (1024 * 1024));
        const message = `File exceeds the ${limitMB}MB size limit.`;
        toast.error(message);
        setError(message);
        return null;
      }

      setIsUploading(true);
      setError(null);

      try {
        let uploadFile = file;

        // Compress images if browser-image-compression is available
        if (ACCEPTED_IMAGE_TYPES.has(file.type) && file.size > 500 * 1024) {
          try {
            const imageCompression = (await import('browser-image-compression')).default;
            uploadFile = await imageCompression(file, {
              maxSizeMB: 1,
              maxWidthOrHeight: 2048,
              useWebWorker: true,
            });
          } catch {
            // Compression failed — upload original
            console.warn('Image compression failed, uploading original');
          }
        }

        const safeName = sanitizeFilename(file.name);
        const path = `${submissionId}/${fieldKey}/${Date.now()}-${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(path, uploadFile, {
            contentType: file.type,
            upsert: false,
          });

        if (uploadError) throw uploadError;

        // Generate signed URL for immediate preview
        const { data: signedUrlData, error: signedUrlError } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(path, 3600); // 1 hour

        if (signedUrlError) throw signedUrlError;

        return {
          path,
          signedUrl: signedUrlData.signedUrl,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Upload failed';
        console.error('File upload failed:', err);
        toast.error(message);
        setError(message);
        return null;
      } finally {
        setIsUploading(false);
      }
    },
    [],
  );

  // ---------------------------------------------------------------------------
  // uploadSignature — upload a signature canvas blob as PNG
  // ---------------------------------------------------------------------------
  const uploadSignature = useCallback(
    async (
      blob: Blob,
      submissionId: string,
      fieldKey: string,
    ): Promise<UploadResult | null> => {
      setIsUploading(true);
      setError(null);

      try {
        const path = `${submissionId}/signatures/${fieldKey}-${Date.now()}.png`;

        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(path, blob, {
            contentType: 'image/png',
            upsert: false,
          });

        if (uploadError) throw uploadError;

        // Generate signed URL for immediate preview
        const { data: signedUrlData, error: signedUrlError } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(path, 3600);

        if (signedUrlError) throw signedUrlError;

        return {
          path,
          signedUrl: signedUrlData.signedUrl,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Signature upload failed';
        console.error('Signature upload failed:', err);
        toast.error(message);
        setError(message);
        return null;
      } finally {
        setIsUploading(false);
      }
    },
    [],
  );

  // ---------------------------------------------------------------------------
  // removeFile — delete a file from the storage bucket
  // ---------------------------------------------------------------------------
  const removeFile = useCallback(async (path: string): Promise<boolean> => {
    try {
      const { error } = await supabase.storage.from(BUCKET).remove([path]);
      if (error) throw error;
      return true;
    } catch (err) {
      console.error('File removal failed:', err);
      toast.error('Failed to remove file.');
      return false;
    }
  }, []);

  return {
    uploadFile,
    uploadSignature,
    removeFile,
    isUploading,
    error,
  };
}
