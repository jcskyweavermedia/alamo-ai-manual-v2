/**
 * useFileUpload Hook
 *
 * Handles uploading document files (PDF, DOCX, TXT) to the ingest-file
 * edge function and receiving structured recipe responses.
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';
import { toast } from 'sonner';
import type { PrepRecipeDraft, WineDraft, CocktailDraft } from '@/types/ingestion';

// =============================================================================
// TYPES
// =============================================================================

export interface FileUploadResult {
  sessionId: string;
  message: string;
  draft: PrepRecipeDraft | WineDraft | CocktailDraft | null;
  confidence?: number;
  missingFields?: string[];
  fileName: string;
  extractedLength?: number;
}

export interface UseFileUploadReturn {
  /** Upload a document file to the ingest-file edge function */
  uploadFile: (file: File, sessionId?: string) => Promise<FileUploadResult | null>;
  /** Whether an upload is in progress */
  isUploading: boolean;
  /** Error message from the last upload */
  error: string | null;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const ACCEPTED_FILE_TYPES = new Set([
  'text/plain',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// =============================================================================
// HOOK
// =============================================================================

export function useFileUpload(productTable: string = 'prep_recipes', department?: string): UseFileUploadReturn {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { user } = useAuth();
  const { language } = useLanguage();

  // ---------------------------------------------------------------------------
  // uploadFile -- send a document file to ingest-file edge function
  // ---------------------------------------------------------------------------
  const uploadFile = useCallback(
    async (file: File, sessionId?: string): Promise<FileUploadResult | null> => {
      if (!user) {
        toast.error(
          language === 'es'
            ? 'Por favor inicia sesion para subir archivos'
            : 'Please sign in to upload files',
        );
        return null;
      }

      // Validate file type
      if (!ACCEPTED_FILE_TYPES.has(file.type)) {
        const message =
          language === 'es'
            ? 'Solo se admiten archivos PDF, Word y TXT'
            : 'Only PDF, Word, and TXT files are supported';
        toast.error(message);
        setError(message);
        return null;
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        const message =
          language === 'es'
            ? 'El archivo excede el limite de 10MB'
            : 'File exceeds the 10MB size limit';
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
          `${SUPABASE_URL}/functions/v1/ingest-file`,
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
          extractedLength: data.extractedLength as number | undefined,
        };
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : language === 'es'
              ? 'Error al subir archivo'
              : 'Failed to upload file';
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
    uploadFile,
    isUploading,
    error,
  };
}
