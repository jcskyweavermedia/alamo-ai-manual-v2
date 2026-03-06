// =============================================================================
// useBuildCourse — Orchestrates AI course building via edge functions
// Calls build-course (outline, content, chat_edit) and build-course-element.
// =============================================================================

import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCourseBuilder } from '@/contexts/CourseBuilderContext';
import type { CourseSection, CourseElement } from '@/types/course-builder';

interface BuildProgress {
  completed: number;
  total: number;
}

export function useBuildCourse() {
  const { state, dispatch } = useCourseBuilder();
  const [isBuilding, setIsBuilding] = useState(false);
  const [progress, setProgress] = useState<BuildProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  // Generate course outline from wizard config
  const generateOutline = useCallback(async (courseId: string): Promise<boolean> => {
    setIsBuilding(true);
    setError(null);
    dispatch({ type: 'AI_GENERATE_OUTLINE_START' });

    try {
      const { data, error: fnError } = await supabase.functions.invoke('build-course', {
        body: {
          course_id: courseId,
          step: 'outline',
        },
      });

      if (fnError) throw new Error(fnError.message || 'Failed to generate outline');
      if (data?.error) throw new Error(data.error);

      const sections = (data?.sections || []) as CourseSection[];
      dispatch({ type: 'AI_GENERATE_OUTLINE_SUCCESS', payload: { sections } });
      return true;
    } catch (err) {
      console.error('[useBuildCourse] generateOutline error:', err);
      const message = err instanceof Error ? err.message : 'Failed to generate outline';
      setError(message);
      dispatch({ type: 'AI_GENERATE_OUTLINE_ERROR' });
      return false;
    } finally {
      setIsBuilding(false);
    }
  }, [dispatch]);

  // Build all content for all elements across all sections
  const buildAllContent = useCallback(async (courseId: string, language: 'en' | 'es' = 'en'): Promise<boolean> => {
    cancelledRef.current = false;
    setIsBuilding(true);
    setError(null);

    // Collect all elements across all sections
    const allElements: Array<{ sectionId: string; element: CourseElement }> = [];
    for (const section of state.sections) {
      for (const element of section.elements) {
        if (element.status === 'outline') {
          allElements.push({ sectionId: section.id, element });
        }
      }
    }

    if (allElements.length === 0) {
      setIsBuilding(false);
      return true;
    }

    const total = allElements.length;
    dispatch({ type: 'AI_BUILD_ALL_START', payload: { total } });
    setProgress({ completed: 0, total });

    let completed = 0;

    try {
      for (const { sectionId, element } of allElements) {
        if (cancelledRef.current) break;

        dispatch({ type: 'AI_BUILD_ELEMENT_START', payload: { key: element.key } });

        try {
          const { data, error: fnError } = await supabase.functions.invoke('build-course-element', {
            body: {
              courseId,
              sectionId,
              elementKey: element.key,
              language,
            },
          });

          if (fnError) throw new Error(fnError.message);
          if (data?.error) throw new Error(data.error);

          const updates = (data?.element || {}) as Partial<CourseElement>;
          dispatch({
            type: 'AI_BUILD_ELEMENT_SUCCESS',
            payload: { sectionId, key: element.key, updates },
          });
        } catch (elementErr) {
          console.error(`[useBuildCourse] buildElement error (${element.key}):`, elementErr);
          dispatch({ type: 'AI_BUILD_ELEMENT_ERROR', payload: { key: element.key } });
        }

        completed++;
        setProgress({ completed, total });
        dispatch({ type: 'AI_PROGRESS_UPDATE', payload: { completed, total } });
      }

      dispatch({ type: 'AI_BUILD_ALL_COMPLETE' });
      return true;
    } catch (err) {
      console.error('[useBuildCourse] buildAllContent error:', err);
      const message = err instanceof Error ? err.message : 'Failed to build content';
      setError(message);
      dispatch({ type: 'AI_BUILD_ALL_COMPLETE' });
      return false;
    } finally {
      setIsBuilding(false);
      setProgress(null);
    }
  }, [state.sections, dispatch]);

  // Build a single element
  const buildElement = useCallback(async (
    courseId: string,
    sectionId: string,
    elementKey: string,
    instruction?: string,
    language: 'en' | 'es' = 'en',
  ): Promise<boolean> => {
    setIsBuilding(true);
    setError(null);
    dispatch({ type: 'AI_BUILD_ELEMENT_START', payload: { key: elementKey } });

    try {
      const { data, error: fnError } = await supabase.functions.invoke('build-course-element', {
        body: {
          courseId,
          sectionId,
          elementKey,
          instruction,
          language,
        },
      });

      if (fnError) throw new Error(fnError.message || 'Failed to build element');
      if (data?.error) throw new Error(data.error);

      const updates = (data?.element || {}) as Partial<CourseElement>;
      dispatch({
        type: 'AI_BUILD_ELEMENT_SUCCESS',
        payload: { sectionId, key: elementKey, updates },
      });
      return true;
    } catch (err) {
      console.error('[useBuildCourse] buildElement error:', err);
      const message = err instanceof Error ? err.message : 'Failed to build element';
      setError(message);
      dispatch({ type: 'AI_BUILD_ELEMENT_ERROR', payload: { key: elementKey } });
      return false;
    } finally {
      setIsBuilding(false);
    }
  }, [dispatch]);

  // Cancel ongoing build
  const cancelBuild = useCallback(() => {
    cancelledRef.current = true;
  }, []);

  return {
    generateOutline,
    buildAllContent,
    buildElement,
    cancelBuild,
    isBuilding,
    progress,
    error,
  };
}
