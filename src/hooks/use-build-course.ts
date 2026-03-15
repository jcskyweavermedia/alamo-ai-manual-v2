// =============================================================================
// useBuildCourse — Orchestrates AI course building via edge functions
// Calls build-course (outline, content, chat_edit) and build-course-element.
// =============================================================================

import { useState, useCallback, useRef, useEffect } from 'react';
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
  const isBuildingRef = useRef(false); // Ref for build lock (avoids stale closure)

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
    // If multiphase pipeline is active, cancel it
    if (state.multiphaseState.isActive) {
      dispatch({ type: 'AI_MULTIPHASE_CANCEL' });
    }
  }, [state.multiphaseState.isActive, dispatch]);

  // Helper: sleep with backoff
  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Helper: client-side validation for structure plan
  // Edge function returns page_header_data (not page_header)
  const validateStructurePlanClient = (data: any): string[] => {
    const issues: string[] = [];
    if (!data) { issues.push('No data returned'); return issues; }
    if (!data.page_header_data) issues.push('Missing page_header_data');
    else {
      if (!data.page_header_data.title_en) issues.push('page_header_data missing title_en');
    }
    if (!data.sections || !Array.isArray(data.sections) || data.sections.length === 0) {
      issues.push('No sections returned');
    }
    return issues;
  };

  // Helper: client-side validation for content write
  const validateContentWriteClient = (data: any): string[] => {
    const issues: string[] = [];
    if (!data) { issues.push('No data returned'); return issues; }
    if (!data.content_en || typeof data.content_en !== 'string' || data.content_en.length < 50) {
      issues.push(`content_en too short or missing (${data.content_en?.length || 0} chars, need 50+)`);
    }
    if (!data.teaching_notes || typeof data.teaching_notes !== 'string') {
      issues.push('teaching_notes missing');
    }
    return issues;
  };

  // Helper: client-side validation for layout
  const validateLayoutClient = (data: any): string[] => {
    const issues: string[] = [];
    if (!data) { issues.push('No data returned'); return issues; }
    if (!data.elements || !Array.isArray(data.elements) || data.elements.length === 0) {
      issues.push('No elements returned');
      return issues;
    }
    for (let i = 0; i < data.elements.length; i++) {
      const el = data.elements[i];
      if (!el.type) issues.push(`Element ${i}: missing type`);
      if (!el.key) issues.push(`Element ${i}: missing key`);

      // Per-type validation
      switch (el.type) {
        case 'content':
          if (!el.body_en || typeof el.body_en !== 'string')
            issues.push(`Element ${i} (content): missing body_en`);
          break;
        case 'feature':
          if (!el.variant) issues.push(`Element ${i} (feature): missing variant`);
          if (!el.body_en || typeof el.body_en !== 'string')
            issues.push(`Element ${i} (feature): missing body_en`);
          break;
        case 'section_header':
          if (!el.title_en) issues.push(`Element ${i} (section_header): missing title_en`);
          break;
        case 'media':
          if (!el.media_type) issues.push(`Element ${i} (media): missing media_type`);
          break;
      }

      if (el.type === 'card_grid' && (!Array.isArray(el.cards) || el.cards.length === 0)) {
        issues.push(`Element ${i} (card_grid): empty cards`);
      }
      if (el.type === 'comparison') {
        if (!el.variant) issues.push(`Element ${i} (comparison): missing variant`);
        else if (el.variant === 'miss_fix' && (!Array.isArray(el.pairs) || el.pairs.length === 0))
          issues.push(`Element ${i} (comparison/miss_fix): empty pairs`);
        else if (el.variant !== 'miss_fix' && (!el.positive || !el.negative))
          issues.push(`Element ${i} (comparison): missing positive or negative`);
      }
      if (el.type === 'script_block' && (!Array.isArray(el.lines) || el.lines.length === 0)) {
        issues.push(`Element ${i} (script_block): empty lines`);
      }
    }
    return issues;
  };

  // 3-pass pipeline orchestrator
  const buildCourse3Pass = useCallback(async (courseId: string, language: 'en' | 'es' = 'en'): Promise<boolean> => {
    // Build lock using ref (avoids stale closure with React state)
    if (isBuildingRef.current) return false;
    isBuildingRef.current = true;

    cancelledRef.current = false;
    setIsBuilding(true);
    setError(null);

    const estimatedSeconds = 140; // ~120 for structure+content+layout + ~20 for card polish

    dispatch({
      type: 'AI_MULTIPHASE_START',
      payload: {
        phases: [
          { id: 'structure', label: 'Structure Planner', status: 'waiting' },
          { id: 'content', label: 'Content Writer', status: 'waiting' },
          { id: 'layout', label: 'Layout & Assembly', status: 'waiting' },
          { id: 'card', label: 'Card Polish', status: 'waiting' as const },
        ],
        estimatedSeconds,
      },
    });

    let currentPhase = 'structure';
    let pageHeaderData: Record<string, unknown> | null = null;
    let pass1Sections: Array<{ section_id: string; title_en: string; title_es: string; sort_order: number }> = [];

    try {
      // ── Phase 1: Structure Planner (1 call, with retry) ──────────────
      dispatch({ type: 'AI_PHASE_START', payload: { phaseId: 'structure' } });

      let structureData: any = null;
      let structureSuccess = false;

      for (let attempt = 1; attempt <= 3; attempt++) {
        if (cancelledRef.current) break;

        try {
          const { data, error: fnError } = await supabase.functions.invoke('build-course', {
            body: { step: 'structure_plan', course_id: courseId, language },
          });

          if (fnError) {
            // Extract the real error message from the response body
            const errorDetail = data?.error || data?.message || fnError.message || 'Structure plan failed';
            console.error(`[buildCourse3Pass] structure_plan edge fn error:`, errorDetail, data);
            throw new Error(typeof errorDetail === 'string' ? errorDetail : JSON.stringify(errorDetail));
          }
          if (data?.error) throw new Error(data.error);

          const issues = validateStructurePlanClient(data);
          if (issues.length === 0) {
            structureData = data;
            structureSuccess = true;
            break;
          }

          console.warn(`[buildCourse3Pass] structure_plan attempt ${attempt} incomplete:`, issues);
          if (attempt < 3) {
            await sleep(1000 * Math.pow(2, attempt)); // 2s, 4s
          }
        } catch (err) {
          console.error(`[buildCourse3Pass] structure_plan attempt ${attempt} error:`, err);
          if (attempt < 3) {
            await sleep(1000 * Math.pow(2, attempt));
          }
        }
      }

      if (!structureSuccess || !structureData) {
        throw new Error('Structure planning failed after 3 attempts');
      }

      if (cancelledRef.current) {
        dispatch({ type: 'AI_MULTIPHASE_CANCEL' });
        return false; // finally block handles lock release
      }

      // Store page_header_data and sections
      pageHeaderData = structureData.page_header_data || null;
      pass1Sections = structureData.sections || [];

      // Hydrate sections into state
      dispatch({
        type: 'AI_HYDRATE_SECTIONS',
        payload: {
          sections: pass1Sections.map((s) => ({
            id: s.section_id,
            titleEn: s.title_en,
            titleEs: s.title_es,
            sortOrder: s.sort_order,
            elements: [],
            generationStatus: 'planned' as const,
          })),
        },
      });

      dispatch({ type: 'AI_PHASE_COMPLETE', payload: { phaseId: 'structure' } });

      // Recalculate ETA based on actual section count
      // Per-section cost: ~20s for content_write + ~15s for layout = ~35s per section
      // Plus ~10s overhead for post-processing
      const sectionCount = pass1Sections.length;
      const perSectionSeconds = 35;
      const overheadSeconds = 10;
      const cardPhaseSeconds = 20; // cover image + description generation
      const updatedEstimate = (sectionCount * perSectionSeconds) + overheadSeconds + cardPhaseSeconds;
      dispatch({
        type: 'AI_UPDATE_ESTIMATE',
        payload: { estimatedSeconds: updatedEstimate },
      });

      // ── Phase 2: Content Writer (per-section, with retry) ────────────
      currentPhase = 'content';
      dispatch({ type: 'AI_PHASE_START', payload: { phaseId: 'content' } });

      const totalSections = pass1Sections.length;
      // Track which sections succeeded prose writing (by section_id)
      const proseSuccessIds = new Set<string>();

      for (let i = 0; i < totalSections; i++) {
        if (cancelledRef.current) break;

        const sec = pass1Sections[i];
        let sectionSuccess = false;

        for (let attempt = 1; attempt <= 3; attempt++) {
          if (cancelledRef.current) break;

          try {
            const { data: cwData, error: cwError } = await supabase.functions.invoke('build-course', {
              body: { step: 'content_write', course_id: courseId, section_id: sec.section_id, language },
            });

            if (cwError) {
              const errorDetail = cwData?.error || cwData?.message || cwError.message || 'Content write failed';
              throw new Error(typeof errorDetail === 'string' ? errorDetail : JSON.stringify(errorDetail));
            }
            if (cwData?.error) throw new Error(cwData.error);

            const issues = validateContentWriteClient(cwData);
            if (issues.length === 0) {
              dispatch({
                type: 'AI_HYDRATE_SECTIONS',
                payload: {
                  sections: [{
                    id: sec.section_id,
                    generationStatus: 'prose_ready' as const,
                  }],
                },
              });
              sectionSuccess = true;
              proseSuccessIds.add(sec.section_id);
              break;
            }

            console.warn(`[buildCourse3Pass] content_write ${sec.section_id} attempt ${attempt} incomplete:`, issues);
            if (attempt < 3) await sleep(1000 * Math.pow(2, attempt));
          } catch (err) {
            console.error(`[buildCourse3Pass] content_write ${sec.section_id} attempt ${attempt} error:`, err);
            if (attempt < 3) await sleep(1000 * Math.pow(2, attempt));
          }
        }

        if (!sectionSuccess) {
          console.error(`[buildCourse3Pass] content_write FAILED for section ${sec.section_id} after 3 attempts`);
          dispatch({
            type: 'AI_HYDRATE_SECTIONS',
            payload: {
              sections: [{
                id: sec.section_id,
                generationStatus: 'prose_error' as const,
              }],
            },
          });
        }

        dispatch({
          type: 'AI_PHASE_PROGRESS',
          payload: { phaseId: 'content', completed: i + 1, total: totalSections },
        });
      }

      // Update course-level status to prose_ready (if any sections succeeded)
      if (proseSuccessIds.size > 0) {
        await supabase.from('courses').update({ status: 'prose_ready' }).eq('id', courseId);
        // Sync serverUpdatedAt so auto-save concurrency check doesn't 406
        const { data: freshAfterProse } = await supabase
          .from('courses')
          .select('updated_at')
          .eq('id', courseId)
          .single();
        if (freshAfterProse) {
          dispatch({ type: 'SAVE_SUCCESS', payload: { updatedAt: freshAfterProse.updated_at } });
        }
      }

      dispatch({ type: 'AI_PHASE_COMPLETE', payload: { phaseId: 'content' } });

      // ── Phase 3: Layout Architect (per-section, with retry) ──────────
      currentPhase = 'layout';
      dispatch({ type: 'AI_PHASE_START', payload: { phaseId: 'layout' } });

      // Only process sections that have prose_ready (skip prose_error)
      const layoutSections = pass1Sections.filter((sec) => proseSuccessIds.has(sec.section_id));
      const layoutSuccessIds = new Set<string>();

      for (let i = 0; i < layoutSections.length; i++) {
        if (cancelledRef.current) break;

        const sec = layoutSections[i];
        let sectionSuccess = false;

        for (let attempt = 1; attempt <= 3; attempt++) {
          if (cancelledRef.current) break;

          try {
            const { data: p3Data, error: p3Error } = await supabase.functions.invoke('build-course', {
              body: { step: 'pass3', course_id: courseId, section_id: sec.section_id, language },
            });

            if (p3Error) {
              const errorDetail = p3Data?.error || p3Data?.message || p3Error.message || 'Layout failed';
              throw new Error(typeof errorDetail === 'string' ? errorDetail : JSON.stringify(errorDetail));
            }
            if (p3Data?.error) {
              // If section has no prose (prose_error), skip it
              if (p3Data.error.includes('no draft_content') || p3Data.error.includes('prose_error')) {
                console.warn(`[buildCourse3Pass] pass3 skipping ${sec.section_id}: no prose`);
                break;
              }
              throw new Error(p3Data.error);
            }

            const issues = validateLayoutClient(p3Data);
            if (issues.length === 0 && p3Data.elements) {
              // Elements already include deterministic page_header from edge function
              const elements = p3Data.elements as CourseElement[];

              dispatch({
                type: 'AI_HYDRATE_SECTIONS',
                payload: {
                  sections: [{
                    id: sec.section_id,
                    elements,
                    generationStatus: 'generated' as const,
                  }],
                },
              });
              sectionSuccess = true;
              layoutSuccessIds.add(sec.section_id);
              break;
            }

            console.warn(`[buildCourse3Pass] pass3 ${sec.section_id} attempt ${attempt} incomplete:`, issues);
            if (attempt < 3) await sleep(1000 * Math.pow(2, attempt));
          } catch (err) {
            console.error(`[buildCourse3Pass] pass3 ${sec.section_id} attempt ${attempt} error:`, err);
            if (attempt < 3) await sleep(1000 * Math.pow(2, attempt));
          }
        }

        if (!sectionSuccess) {
          dispatch({
            type: 'AI_HYDRATE_SECTIONS',
            payload: {
              sections: [{
                id: sec.section_id,
                generationStatus: 'incomplete' as const,
              }],
            },
          });
        }

        dispatch({
          type: 'AI_PHASE_PROGRESS',
          payload: { phaseId: 'layout', completed: i + 1, total: layoutSections.length },
        });
      }

      dispatch({ type: 'AI_PHASE_COMPLETE', payload: { phaseId: 'layout' } });

      // ── Post-Phase 3: Global section_header renumbering ──────────────
      // Re-fetch all sections with elements to renumber section_headers globally
      try {
        const { data: allSections } = await supabase
          .from('course_sections')
          .select('id, sort_order, elements')
          .eq('course_id', courseId)
          .order('sort_order');

        if (allSections && allSections.length > 0) {
          let globalCounter = 0;
          const changedSections: Array<{ id: string; elements: any[] }> = [];

          for (const sec of allSections) {
            if (!sec.elements || !Array.isArray(sec.elements)) continue;
            let changed = false;
            for (const el of sec.elements) {
              if (el.type === 'section_header') {
                globalCounter++;
                const titleParts = (el.title_en || '').split('|');
                const theme = titleParts.length > 1 ? titleParts[titleParts.length - 1].trim() : titleParts[0].trim();
                const newLabel = `${globalCounter} — ${theme}`;
                if (el.number_label !== newLabel) {
                  el.number_label = newLabel;
                  changed = true;
                }
              }
            }
            if (changed) {
              await supabase.from('course_sections').update({ elements: sec.elements }).eq('id', sec.id);
              changedSections.push({ id: sec.id, elements: sec.elements });
            }
          }

          // Sync renumbered elements back to frontend state
          if (changedSections.length > 0) {
            dispatch({
              type: 'AI_HYDRATE_SECTIONS',
              payload: {
                sections: changedSections.map((sec) => ({
                  id: sec.id,
                  elements: sec.elements as CourseElement[],
                })),
              },
            });
          }
        }
      } catch (renumberErr) {
        console.warn('[buildCourse3Pass] renumbering error (non-fatal):', renumberErr);
      }

      // Update course-level status: review if any sections generated, else leave as prose_ready
      if (layoutSuccessIds.size > 0) {
        await supabase.from('courses').update({ status: 'review' }).eq('id', courseId);
      }

      // ── Phase 4: Card Polish (cover image + description) ───────────────
      // Non-blocking — failures do not affect the course
      if (!cancelledRef.current && layoutSuccessIds.size > 0) {
        dispatch({ type: 'AI_PHASE_START', payload: { phaseId: 'card' } });

        // Helper for Phase 4 retries (simpler than Phase 1-3 since non-fatal)
        async function invokeWithRetry(
          fnName: string,
          body: Record<string, unknown>,
          maxAttempts = 2,
          delayMs = 3000,
        ): Promise<{ data: any; error: any }> {
          for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            const { data, error: fnError } = await supabase.functions.invoke(fnName, { body });
            if (!fnError) return { data, error: null };
            console.warn(`[buildCourse3Pass] ${fnName} attempt ${attempt}/${maxAttempts} failed:`, fnError.message);
            if (attempt < maxAttempts) {
              await new Promise(r => setTimeout(r, delayMs));
            }
          }
          return { data: null, error: new Error(`${fnName} failed after ${maxAttempts} attempts`) };
        }

        try {
          // Fetch latest course state from DB (React state may be stale in this long-running callback)
          const { data: freshCourse } = await supabase
            .from('courses')
            .select('title_en, course_type, description_en, cover_image')
            .eq('id', courseId)
            .single();

          // 4a. Generate description (only if empty or generic)
          const currentDesc = freshCourse?.description_en || '';
          let descForCover = currentDesc;
          if (!currentDesc || currentDesc.length < 20) {
            try {
              const { data: descData, error: descError } = await invokeWithRetry('build-course', {
                step: 'generate_card_meta', course_id: courseId,
              });
              if (descError) {
                console.warn('[buildCourse3Pass] generate_card_meta failed:', descError.message);
              }

              if (descData?.description_en) {
                descForCover = descData.description_en;
                dispatch({ type: 'SET_DESCRIPTION_EN', payload: descData.description_en });
                if (descData.description_es) {
                  dispatch({ type: 'SET_DESCRIPTION_ES', payload: descData.description_es });
                }
                // Also update DB directly since auto-save is suppressed during build
                await supabase.from('courses').update({
                  description_en: descData.description_en,
                  ...(descData.description_es ? { description_es: descData.description_es } : {}),
                }).eq('id', courseId);
              }
            } catch (descErr) {
              console.warn('[buildCourse3Pass] description generation failed (non-fatal):', descErr);
            }
          }

          // 4b. Generate cover image (only if not already set)
          if (!freshCourse?.cover_image) {
            try {
              const sectionTitles = pass1Sections.map((s) => s.title_en);
              const { data: imgData, error: imgError } = await invokeWithRetry('generate-image', {
                mode: 'cover',
                courseId,
                courseTitle: freshCourse?.title_en || 'Untitled',
                courseType: freshCourse?.course_type || 'custom',
                sectionTitles,
                description: descForCover || '',
              });
              if (imgError) {
                console.warn('[buildCourse3Pass] cover image generation failed:', imgError.message);
              }

              if (imgData?.storagePath) {
                dispatch({ type: 'SET_COVER_IMAGE', payload: imgData.storagePath });
                // DB already updated by the edge function
              }
            } catch (imgErr) {
              console.warn('[buildCourse3Pass] cover image generation failed (non-fatal):', imgErr);
            }
          }
        } catch (phase4Err) {
          console.warn('[buildCourse3Pass] Phase 4 failed (non-fatal):', phase4Err);
        }

        dispatch({ type: 'AI_PHASE_COMPLETE', payload: { phaseId: 'card' } });
      }

      // Sync serverUpdatedAt after all DB writes so auto-save doesn't 406
      const { data: freshAfterBuild } = await supabase
        .from('courses')
        .select('updated_at')
        .eq('id', courseId)
        .single();
      if (freshAfterBuild) {
        dispatch({ type: 'SAVE_SUCCESS', payload: { updatedAt: freshAfterBuild.updated_at } });
      }

      dispatch({ type: 'AI_MULTIPHASE_COMPLETE' });
      return true;
    } catch (err) {
      console.error('[buildCourse3Pass] pipeline error:', err);
      const message = err instanceof Error ? err.message : 'Pipeline failed';
      setError(message);
      try {
        dispatch({
          type: 'AI_PHASE_ERROR',
          payload: { phaseId: currentPhase, error: message },
        });
      } catch {
        // Swallow dispatch errors to ensure finally block runs
      }
      return false;
    } finally {
      setIsBuilding(false);
      isBuildingRef.current = false;
    }
  }, [dispatch]);

  // Cleanup on unmount — cancel any in-progress pipeline
  useEffect(() => {
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  return {
    generateOutline,
    buildAllContent,
    buildElement,
    buildCourse3Pass,
    cancelBuild,
    isBuilding,
    progress,
    error,
  };
}
