/**
 * useDirectImageUpload Hook
 *
 * Uploads images directly to Supabase Storage (product-assets bucket)
 * without AI analysis. Used by the Images editor section.
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';

const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export function useDirectImageUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const { user } = useAuth();

  const uploadToStorage = useCallback(async (
    file: File,
    sessionId?: string,
  ): Promise<string | null> => {
    if (!user) {
      toast.error('Please sign in to upload images');
      return null;
    }

    if (!ACCEPTED_TYPES.has(file.type)) {
      toast.error('Only JPEG, PNG, WebP, and GIF images are supported');
      return null;
    }

    if (file.size > MAX_SIZE) {
      toast.error('Image exceeds the 10MB size limit');
      return null;
    }

    setIsUploading(true);

    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `uploads/${sessionId || 'direct'}/${Date.now()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from('product-assets')
        .upload(path, file, { contentType: file.type, upsert: false });

      if (uploadError) throw new Error(uploadError.message);

      const { data: { publicUrl } } = supabase.storage
        .from('product-assets')
        .getPublicUrl(path);

      return publicUrl;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to upload image';
      toast.error(msg);
      return null;
    } finally {
      setIsUploading(false);
    }
  }, [user]);

  return { uploadToStorage, isUploading };
}
