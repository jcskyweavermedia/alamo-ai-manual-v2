/**
 * useGenerateImage Hook
 *
 * Calls the generate-image edge function to create an AI-generated
 * placeholder image via DALL-E.
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';

interface GenerateImageParams {
  productTable: string;
  name: string;
  prepType: string;
  description?: string;
  sessionId?: string;
}

interface GenerateImageResult {
  imageUrl: string;
  prompt: string;
}

export function useGenerateImage() {
  const [isGenerating, setIsGenerating] = useState(false);
  const { user } = useAuth();

  const generateImage = useCallback(async (
    params: GenerateImageParams,
  ): Promise<GenerateImageResult | null> => {
    if (!user) {
      toast.error('Please sign in to generate images');
      return null;
    }

    setIsGenerating(true);

    try {
      const { data, error } = await supabase.functions.invoke('generate-image', {
        body: params,
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.message || data.error);

      return {
        imageUrl: data.imageUrl as string,
        prompt: data.prompt as string,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to generate image';
      toast.error(msg);
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, [user]);

  return { generateImage, isGenerating };
}
