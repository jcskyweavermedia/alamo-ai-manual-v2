import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function useCoverImage(courseId: string | null) {
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const generatingRef = useRef(false);
  const uploadingRef = useRef(false);

  const deleteOldCoverImage = useCallback(async (oldPath: string) => {
    if (!oldPath || oldPath.startsWith('http')) return;
    try {
      await supabase.storage.from('course-media').remove([oldPath]);
    } catch {
      // Non-fatal
    }
  }, []);

  const uploadCoverImage = useCallback(async (file: File, currentCoverImage: string | null): Promise<string | null> => {
    if (uploadingRef.current) return null;
    if (!courseId) {
      toast.error('Please save the course first');
      return null;
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('Please upload a JPEG, PNG, or WebP image');
      return null;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error('Image must be under 10MB');
      return null;
    }

    uploadingRef.current = true;
    setIsUploading(true);
    try {
      // Delete old image
      if (currentCoverImage) await deleteOldCoverImage(currentCoverImage);

      const ext = file.name.split('.').pop() || 'png';
      const storagePath = `courses/${courseId}/cover/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('course-media')
        .upload(storagePath, file, { contentType: file.type, upsert: false });

      if (uploadError) {
        console.error('[useCoverImage] Upload failed:', uploadError.message);
        toast.error('Failed to upload image');
        return null;
      }

      // Update DB
      const { error: dbError } = await supabase.from('courses')
        .update({ cover_image: storagePath }).eq('id', courseId);
      if (dbError) {
        await supabase.storage.from('course-media').remove([storagePath]);
        toast.error('Failed to save cover image');
        return null;
      }

      toast.success('Cover image uploaded');
      return storagePath;
    } catch (err) {
      console.error('[useCoverImage] Upload error:', err);
      toast.error('Failed to upload image');
      return null;
    } finally {
      uploadingRef.current = false;
      setIsUploading(false);
    }
  }, [courseId, deleteOldCoverImage]);

  const generateCoverImage = useCallback(async (
    title: string,
    courseType: string,
    sectionTitles: string[],
    description?: string,
    instruction?: string,
  ): Promise<string | null> => {
    if (generatingRef.current) return null;
    if (!courseId) {
      toast.error('Please save the course first');
      return null;
    }

    generatingRef.current = true;
    setIsGenerating(true);
    try {
      // Old image cleanup is handled server-side by the generate-image edge function

      const { data, error } = await supabase.functions.invoke('generate-image', {
        body: {
          mode: 'cover',
          courseId,
          courseTitle: title,
          courseType,
          sectionTitles,
          description,
          instruction,
        },
      });

      if (error) {
        console.error('[useCoverImage] Generate error:', error);
        toast.error('Failed to generate cover image');
        return null;
      }

      if (data?.storagePath) {
        toast.success('Cover image generated');
        return data.storagePath;
      }

      toast.error('No image returned');
      return null;
    } catch (err) {
      console.error('[useCoverImage] Generate error:', err);
      toast.error('Failed to generate cover image');
      return null;
    } finally {
      generatingRef.current = false;
      setIsGenerating(false);
    }
  }, [courseId]);

  const removeCoverImage = useCallback(async (currentCoverImage: string | null): Promise<void> => {
    if (!courseId) {
      toast.error('Please save the course first');
      return;
    }
    try {
      if (currentCoverImage) await deleteOldCoverImage(currentCoverImage);
      const { error: dbError } = await supabase.from('courses')
        .update({ cover_image: null }).eq('id', courseId);
      if (dbError) {
        console.error('[useCoverImage] DB update failed on remove:', dbError);
        toast.error('Failed to update course record');
        return;
      }
      toast.success('Cover image removed');
    } catch (err) {
      console.error('[useCoverImage] Remove error:', err);
      toast.error('Failed to remove cover image');
    }
  }, [courseId, deleteOldCoverImage]);

  return { uploadCoverImage, generateCoverImage, removeCoverImage, isUploading, isGenerating };
}
