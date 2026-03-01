// =============================================================================
// useFormBuilder Hook — Form Template CRUD Operations
//
// Handles: create, update (with optimistic concurrency), publish, unpublish,
// delete, duplicate, and loadTemplate for the Form Builder Admin.
//
// Uses the Supabase client directly (no edge function needed) — RLS enforces
// admin/manager access on form_templates.
// =============================================================================

import { useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { generateSlug } from '@/lib/form-builder/builder-utils';
import { transformTemplateRow } from '@/lib/form-utils';
import type { FormTemplate, FormFieldDefinition, FormTemplateStatus } from '@/types/forms';
import type { BuilderState, ValidationError } from '@/types/form-builder';
import { validateForPublish } from '@/lib/form-builder/publish-validation';

// =============================================================================
// TYPES
// =============================================================================

/** Minimal draft input for creating a new template. */
export interface FormTemplateDraft {
  titleEn: string;
  titleEs?: string;
  descriptionEn?: string;
  descriptionEs?: string;
  icon?: string;
  iconColor?: string;
  fields?: FormFieldDefinition[];
  instructionsEn?: string;
  instructionsEs?: string;
  aiTools?: string[];
  headerImage?: string | null;
}

/** Result from updateTemplate with optimistic concurrency. */
export interface UpdateResult {
  success: boolean;
  serverUpdatedAt: string | null;
  conflict: boolean;
}

/** Result from publishTemplate. */
export interface PublishResult {
  success: boolean;
  templateVersion: number;
  publishedAt: string | null;
  serverUpdatedAt: string | null;
  validationErrors: ValidationError[];
}

/** Loaded template data for the builder. */
export interface LoadedTemplate {
  template: FormTemplate;
  serverUpdatedAt: string;
}

export interface UseFormBuilderReturn {
  createTemplate: (draft: FormTemplateDraft) => Promise<string>;
  updateTemplate: (
    templateId: string,
    updates: Partial<FormTemplateDraft>,
    expectedUpdatedAt: string | null,
  ) => Promise<UpdateResult>;
  publishTemplate: (templateId: string, state: BuilderState) => Promise<PublishResult>;
  unpublishTemplate: (templateId: string) => Promise<{ success: boolean; serverUpdatedAt: string | null }>;
  deleteTemplate: (templateId: string) => Promise<{ success: boolean; error?: string }>;
  duplicateTemplate: (templateId: string) => Promise<string>;
  loadTemplate: (templateId: string) => Promise<LoadedTemplate>;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Generate a slug with collision handling.
 * Tries the base slug, then -2, -3, etc. up to -10.
 */
async function generateUniqueSlug(
  baseTitle: string,
  excludeId?: string,
): Promise<string> {
  const base = generateSlug(baseTitle);
  let candidate = base;
  let suffix = 2;

  while (suffix <= 10) {
    const query = supabase
      .from('form_templates')
      .select('id', { count: 'exact', head: true })
      .eq('slug', candidate);

    if (excludeId) {
      query.neq('id', excludeId);
    }

    const { count } = await query;

    if (count === 0) return candidate;

    candidate = `${base}-${suffix}`;
    suffix++;
  }

  // Fallback: append timestamp fragment
  return `${base}-${Date.now().toString(36).slice(-4)}`;
}

// =============================================================================
// HOOK
// =============================================================================

export function useFormBuilder(): UseFormBuilderReturn {
  const { user, permissions } = useAuth();

  // Get the user's group ID from their first membership
  const groupId = permissions?.memberships?.[0]?.groupId ?? null;
  const userId = user?.id ?? null;

  // Guard: prevent concurrent create calls
  const isCreatingRef = useRef(false);

  // ---------------------------------------------------------------------------
  // CREATE
  // ---------------------------------------------------------------------------

  const createTemplate = useCallback(
    async (draft: FormTemplateDraft): Promise<string> => {
      if (!userId || !groupId) {
        throw new Error('User must be authenticated with a group membership');
      }
      if (isCreatingRef.current) {
        throw new Error('A template creation is already in progress');
      }

      isCreatingRef.current = true;

      try {
        const slug = await generateUniqueSlug(draft.titleEn);

        const { data, error } = await supabase
          .from('form_templates')
          .insert({
            group_id: groupId,
            slug,
            title_en: draft.titleEn,
            title_es: draft.titleEs || null,
            description_en: draft.descriptionEn || null,
            description_es: draft.descriptionEs || null,
            icon: draft.icon || '📋',
            icon_color: draft.iconColor || 'blue',
            fields: (draft.fields || []) as unknown as Record<string, unknown>[],
            instructions_en: draft.instructionsEn || null,
            instructions_es: draft.instructionsEs || null,
            ai_tools: draft.aiTools || [],
            status: 'draft' as FormTemplateStatus,
            created_by: userId,
          })
          .select('id')
          .single();

        if (error) throw error;
        if (!data) throw new Error('No data returned from insert');

        return data.id as string;
      } finally {
        isCreatingRef.current = false;
      }
    },
    [userId, groupId],
  );

  // ---------------------------------------------------------------------------
  // UPDATE (with optimistic concurrency via updated_at — R20 mitigation)
  // ---------------------------------------------------------------------------

  const updateTemplate = useCallback(
    async (
      templateId: string,
      updates: Partial<FormTemplateDraft>,
      expectedUpdatedAt: string | null,
    ): Promise<UpdateResult> => {
      // Build the partial update payload — only include changed fields
      const payload: Record<string, unknown> = {};

      if (updates.titleEn !== undefined) payload.title_en = updates.titleEn;
      if (updates.titleEs !== undefined) payload.title_es = updates.titleEs || null;
      if (updates.descriptionEn !== undefined) payload.description_en = updates.descriptionEn || null;
      if (updates.descriptionEs !== undefined) payload.description_es = updates.descriptionEs || null;
      if (updates.icon !== undefined) payload.icon = updates.icon;
      if (updates.iconColor !== undefined) payload.icon_color = updates.iconColor;
      if (updates.fields !== undefined) payload.fields = updates.fields as unknown as Record<string, unknown>[];
      if (updates.instructionsEn !== undefined) payload.instructions_en = updates.instructionsEn || null;
      if (updates.instructionsEs !== undefined) payload.instructions_es = updates.instructionsEs || null;
      if (updates.aiTools !== undefined) payload.ai_tools = updates.aiTools;
      if (updates.headerImage !== undefined) payload.header_image = updates.headerImage;

      if (Object.keys(payload).length === 0) {
        return { success: true, serverUpdatedAt: expectedUpdatedAt, conflict: false };
      }

      // Build the query with optimistic concurrency guard
      let query = supabase
        .from('form_templates')
        .update(payload)
        .eq('id', templateId);

      // Concurrency guard: only update if updated_at matches what we expect
      if (expectedUpdatedAt) {
        query = query.eq('updated_at', expectedUpdatedAt);
      }

      const { data, error } = await query.select('id, updated_at').maybeSingle();

      if (error) throw error;

      // If no row returned, another user updated the template (conflict)
      if (!data) {
        return { success: false, serverUpdatedAt: null, conflict: true };
      }

      return {
        success: true,
        serverUpdatedAt: data.updated_at as string,
        conflict: false,
      };
    },
    [],
  );

  // ---------------------------------------------------------------------------
  // PUBLISH (with client-side validation)
  // ---------------------------------------------------------------------------

  const publishTemplate = useCallback(
    async (templateId: string, state: BuilderState): Promise<PublishResult> => {
      // Pre-publish validation (publish-validation.ts returns { valid, errors })
      const { valid, errors: validationErrors } = validateForPublish(state);
      const hasBlockingErrors = !valid;

      if (hasBlockingErrors) {
        return {
          success: false,
          templateVersion: state.templateVersion,
          publishedAt: state.publishedAt,
          serverUpdatedAt: state.serverUpdatedAt,
          validationErrors,
        };
      }

      // Publish — the DB trigger (handle_form_template_publish) handles:
      //   1. template_version bump (on re-publish)
      //   2. published_at = now()
      //   3. builder_state = NULL (cleared)
      //   4. ai_refinement_log = [] (cleared)
      const { data, error } = await supabase
        .from('form_templates')
        .update({ status: 'published' as FormTemplateStatus })
        .eq('id', templateId)
        .select('id, template_version, published_at, updated_at')
        .single();

      if (error) throw error;
      if (!data) throw new Error('Publish returned no data');

      return {
        success: true,
        templateVersion: data.template_version as number,
        publishedAt: data.published_at as string | null,
        serverUpdatedAt: data.updated_at as string,
        validationErrors,
      };
    },
    [],
  );

  // ---------------------------------------------------------------------------
  // UNPUBLISH
  // ---------------------------------------------------------------------------

  const unpublishTemplate = useCallback(
    async (templateId: string): Promise<{ success: boolean; serverUpdatedAt: string | null }> => {
      const { data, error } = await supabase
        .from('form_templates')
        .update({ status: 'draft' as FormTemplateStatus })
        .eq('id', templateId)
        .select('updated_at')
        .single();

      if (error) throw error;

      return {
        success: true,
        serverUpdatedAt: (data?.updated_at as string) ?? null,
      };
    },
    [],
  );

  // ---------------------------------------------------------------------------
  // DELETE (with FK constraint handling)
  // ---------------------------------------------------------------------------

  const deleteTemplate = useCallback(
    async (templateId: string): Promise<{ success: boolean; error?: string }> => {
      const { error } = await supabase
        .from('form_templates')
        .delete()
        .eq('id', templateId);

      if (error) {
        // Check for FK constraint violation (submissions exist)
        if (
          error.code === '23503' ||
          error.message?.toLowerCase().includes('violates foreign key constraint') ||
          error.message?.toLowerCase().includes('referenced from table')
        ) {
          return {
            success: false,
            error:
              'This template cannot be deleted because it has existing submissions. ' +
              'Consider archiving it instead.',
          };
        }
        throw error;
      }

      return { success: true };
    },
    [],
  );

  // ---------------------------------------------------------------------------
  // DUPLICATE
  // ---------------------------------------------------------------------------

  const duplicateTemplate = useCallback(
    async (templateId: string): Promise<string> => {
      if (!userId || !groupId) {
        throw new Error('User must be authenticated with a group membership');
      }

      // Fetch the original template
      const { data: original, error: fetchError } = await supabase
        .from('form_templates')
        .select('*')
        .eq('id', templateId)
        .single();

      if (fetchError) throw fetchError;
      if (!original) throw new Error('Template not found');

      // Generate a unique slug for the copy
      const originalTitle = (original.title_en as string) || 'Untitled';
      const copyTitle = `${originalTitle} (Copy)`;
      const slug = await generateUniqueSlug(copyTitle);

      // Deep copy fields (they are JSONB, so structuredClone-safe)
      const fieldsCopy = JSON.parse(JSON.stringify(original.fields));

      const { data: newRow, error: insertError } = await supabase
        .from('form_templates')
        .insert({
          group_id: groupId,
          slug,
          title_en: copyTitle,
          title_es: original.title_es ? `${original.title_es} (Copia)` : null,
          description_en: original.description_en,
          description_es: original.description_es,
          icon: original.icon,
          icon_color: original.icon_color,
          header_image: original.header_image,
          fields: fieldsCopy,
          instructions_en: original.instructions_en,
          instructions_es: original.instructions_es,
          ai_tools: original.ai_tools,
          status: 'draft' as FormTemplateStatus,
          created_by: userId,
          // Reset: version=1, no published_at, no builder_state, no refinement log
        })
        .select('id')
        .single();

      if (insertError) throw insertError;
      if (!newRow) throw new Error('No data returned from insert');

      return newRow.id as string;
    },
    [userId, groupId],
  );

  // ---------------------------------------------------------------------------
  // LOAD TEMPLATE
  // ---------------------------------------------------------------------------

  const loadTemplate = useCallback(
    async (templateId: string): Promise<LoadedTemplate> => {
      const { data, error } = await supabase
        .from('form_templates')
        .select('*')
        .eq('id', templateId)
        .single();

      if (error) throw error;
      if (!data) throw new Error('Template not found');

      const template = transformTemplateRow(data);

      return {
        template,
        serverUpdatedAt: data.updated_at as string,
      };
    },
    [],
  );

  // ---------------------------------------------------------------------------
  // RETURN
  // ---------------------------------------------------------------------------

  return {
    createTemplate,
    updateTemplate,
    publishTemplate,
    unpublishTemplate,
    deleteTemplate,
    duplicateTemplate,
    loadTemplate,
  };
}
