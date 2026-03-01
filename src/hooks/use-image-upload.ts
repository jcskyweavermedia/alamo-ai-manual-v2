/**
 * useImageUpload Hook
 *
 * Handles uploading image files to the ingest-vision edge function
 * and receiving structured recipe responses. Also manages a local
 * preview URL for the selected image.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';
import { toast } from 'sonner';
import type { PrepRecipeDraft, WineDraft, CocktailDraft } from '@/types/ingestion';

// =============================================================================
// TYPES
// =============================================================================

export interface ImageUploadResult {
  sessionId: string;
  message: string;
  draft: PrepRecipeDraft | WineDraft | CocktailDraft | null;
  confidence?: number;
  missingFields?: string[];
  fileName: string;
  imageUrl?: string;
}

export interface UseImageUploadReturn {
  /** Upload an image file to the ingest-vision edge function */
  uploadImage: (file: File, sessionId?: string) => Promise<ImageUploadResult | null>;
  /** Whether an upload is in progress */
  isUploading: boolean;
  /** Object URL for local image preview */
  preview: string | null;
  /** Set or clear the preview URL (component controls this) */
  setPreview: (url: string | null) => void;
  /** Error message from the last upload */
  error: string | null;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const ACCEPTED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// =============================================================================
// HOOK
// =============================================================================

export function useImageUpload(productTable: string = 'prep_recipes', department?: string): UseImageUploadReturn {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreviewState] = useState<string | null>(null);

  const { user } = useAuth();
  const { language } = useLanguage();

  // Track the current preview URL so we can revoke it on cleanup
  const previewRef = useRef<string | null>(null);

  // ---------------------------------------------------------------------------
  // setPreview -- exposed for the component to set/clear the preview
  // ---------------------------------------------------------------------------
  const setPreview = useCallback((url: string | null) => {
    // Revoke the previous object URL if one exists
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current);
    }
    previewRef.current = url;
    setPreviewState(url);
  }, []);

  // Cleanup: revoke object URL on unmount
  useEffect(() => {
    return () => {
      if (previewRef.current) {
        URL.revokeObjectURL(previewRef.current);
        previewRef.current = null;
      }
    };
  }, []);

  // ---------------------------------------------------------------------------
  // uploadImage -- send an image to the ingest-vision edge function
  // ---------------------------------------------------------------------------
  const uploadImage = useCallback(
    async (file: File, sessionId?: string): Promise<ImageUploadResult | null> => {
      if (!user) {
        toast.error(
          language === 'es'
            ? 'Por favor inicia sesion para subir imagenes'
            : 'Please sign in to upload images',
        );
        return null;
      }

      // Validate image type
      if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
        const message =
          language === 'es'
            ? 'Solo se admiten imagenes JPEG, PNG, WebP y GIF'
            : 'Only JPEG, PNG, WebP, and GIF images are supported';
        toast.error(message);
        setError(message);
        return null;
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        const message =
          language === 'es'
            ? 'La imagen excede el limite de 10MB'
            : 'Image exceeds the 10MB size limit';
        toast.error(message);
        setError(message);
        return null;
      }

      setIsUploading(true);
      setError(null);

      try {
        // Get auth token
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          throw new Error(
            language === 'es'
              ? 'Sesion expirada, por favor inicia sesion de nuevo'
              : 'Session expired, please sign in again',
          );
        }

        // Build FormData
        const formData = new FormData();
        formData.append('file', file);
        formData.append('productTable', productTable);
        formData.append('language', language);

        if (sessionId) {
          formData.append('sessionId', sessionId);
        }

        if (department) {
          formData.append('department', department);
        }

        // Call edge function via raw fetch (supabase.functions.invoke
        // does not support multipart/form-data)
        const response = await fetch(
          `${SUPABASE_URL}/functions/v1/ingest-vision`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              apikey: ANON_KEY,
            },
            // Do NOT set Content-Type -- browser auto-sets multipart boundary
            body: formData,
          },
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data?.message || data?.error || `Upload failed (${response.status})`,
          );
        }

        if (data?.error) {
          throw new Error(data.message || data.error);
        }

        return {
          sessionId: data.sessionId as string,
          message: data.message as string,
          draft: (data.draft as PrepRecipeDraft | WineDraft | CocktailDraft) ?? null,
          confidence: data.confidence as number | undefined,
          missingFields: data.missingFields as string[] | undefined,
          fileName: file.name,
          imageUrl: data.imageUrl as string | undefined,
        };
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : language === 'es'
              ? 'Error al subir imagen'
              : 'Failed to upload image';
        setError(message);
        toast.error(message);
        return null;
      } finally {
        setIsUploading(false);
      }
    },
    [user, language, productTable, department],
  );

  return {
    uploadImage,
    isUploading,
    preview,
    setPreview,
    error,
  };
}
