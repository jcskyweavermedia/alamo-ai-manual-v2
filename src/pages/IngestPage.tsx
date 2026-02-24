import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { AppShell } from '@/components/layout/AppShell';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';
import { useIsMobile } from '@/hooks/use-mobile';
import { useToast } from '@/hooks/use-toast';
import { ProductTypeNavbar } from '@/components/ingest/ProductTypeNavbar';
import { MobileModeTabs } from '@/components/ingest/MobileModeTabs';
import { ChatIngestionPanel } from '@/components/ingest/ChatIngestionPanel';
import { useIngestChat } from '@/hooks/use-ingest-chat';
import { useIngestionSession } from '@/hooks/use-ingestion-session';
import { PrepRecipeEditor } from '@/components/ingest/editor/PrepRecipeEditor';
import { WineEditor } from '@/components/ingest/editor/WineEditor';
import { CocktailEditor } from '@/components/ingest/editor/CocktailEditor';
import { PlateSpecEditor } from '@/components/ingest/editor/PlateSpecEditor';
import { IngestPreview } from '@/components/ingest/IngestPreview';
import { WineIngestPreview } from '@/components/ingest/WineIngestPreview';
import { CocktailIngestPreview } from '@/components/ingest/CocktailIngestPreview';
import { PlateSpecDualPreview } from '@/components/ingest/PlateSpecDualPreview';
import { useGenerateDishGuide } from '@/hooks/use-generate-dish-guide';
import { IngestDraftProvider, useIngestDraft } from '@/contexts/IngestDraftContext';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Save, Send, Trash2, Loader2, AlertTriangle, Sparkles, Globe } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useFileUpload } from '@/hooks/use-file-upload';
import { useImageUpload } from '@/hooks/use-image-upload';
import { useGenerateImage } from '@/hooks/use-generate-image';
import { useTranslateProduct } from '@/hooks/use-translate-product';
import { useTranslationPreferences } from '@/hooks/use-translation-preferences';
import { useProductTranslations, isTranslationStale } from '@/hooks/use-product-translations';
import { extractTranslatableTexts, getFieldValue } from '@/lib/translatable-fields';
import { generateSlug, isPrepRecipeDraft, isWineDraft, isCocktailDraft, isPlateSpecDraft, createEmptyPlateSpecDraft } from '@/types/ingestion';
import { validateSubRecipeRefs } from '@/utils/validate-sub-recipe-refs';
import type {
  ProductType,
  MobileMode,
  ChatMessage,
  PrepRecipeDraft,
  WineDraft,
  CocktailDraft,
  PlateSpecDraft,
  FohPlateSpecDraft,
  QueuedAttachment,
} from '@/types/ingestion';
import type { CocktailProcedureStep, PlateSpec } from '@/types/products';

// =============================================================================
// Constants
// =============================================================================

/** Map activeType to Supabase table name */
const ACTIVE_TYPE_TABLE: Record<string, string> = {
  prep_recipe: 'prep_recipes',
  plate_spec: 'plate_specs',
  wine: 'wines',
  cocktail: 'cocktails',
};

/** Map activeType to cache query key */
const ACTIVE_TYPE_CACHE_KEY: Record<string, string> = {
  prep_recipe: 'recipes',
  plate_spec: 'plate_specs',
  wine: 'wines',
  cocktail: 'cocktails',
};

/** Map activeType to product label */
const ACTIVE_TYPE_LABEL: Record<string, string> = {
  prep_recipe: 'Recipe',
  plate_spec: 'Plate Spec',
  wine: 'Wine',
  cocktail: 'Cocktail',
};

/** Map table name back to activeType */
const TABLE_TO_ACTIVE_TYPE: Record<string, ProductType> = {
  prep_recipes: 'prep_recipe',
  plate_specs: 'plate_spec',
  wines: 'wine',
  cocktails: 'cocktail',
};

/** Map table name to navigate path after publish */
const TABLE_NAVIGATE: Record<string, string> = {
  prep_recipes: '/recipes',
  plate_specs: '/recipes',
  wines: '/wines',
  cocktails: '/cocktails',
};

// =============================================================================
// HELPERS
// =============================================================================

/** Build a typed draft from raw DB product data */
function buildDraftFromProduct(
  table: string,
  data: Record<string, any>,
): PrepRecipeDraft | WineDraft | CocktailDraft | PlateSpecDraft | null {
  if (table === 'plate_specs') {
    const row = data as PlateSpec;
    return {
      name: row.name ?? '',
      slug: row.slug ?? '',
      plateType: row.plateType ?? '',
      menuCategory: row.menuCategory ?? '',
      tags: row.tags ?? [],
      allergens: row.allergens ?? [],
      components: row.components ?? [],
      assemblyProcedure: row.assemblyProcedure ?? [],
      notes: row.notes ?? '',
      images: row.images ?? [],
      dishGuide: null,         // loaded separately from foh_plate_specs
      dishGuideStale: false,
    } as PlateSpecDraft;
  }
  if (table === 'prep_recipes') {
    return {
      name: data.name || '',
      slug: data.slug || '',
      prepType: data.prep_type || '',
      tags: data.tags || [],
      yieldQty: data.yield_qty || 0,
      yieldUnit: data.yield_unit || '',
      shelfLifeValue: data.shelf_life_value || 0,
      shelfLifeUnit: data.shelf_life_unit || '',
      ingredients: data.ingredients || [],
      procedure: data.procedure || [],
      batchScaling: data.batch_scaling || {},
      trainingNotes: data.training_notes || {},
      images: data.images || [],
    } as PrepRecipeDraft;
  } else if (table === 'wines') {
    return {
      name: data.name || '',
      slug: data.slug || '',
      producer: data.producer || '',
      region: data.region || '',
      country: data.country || '',
      vintage: data.vintage ?? null,
      varietal: data.varietal || '',
      blend: data.blend ?? false,
      style: data.style || 'red',
      body: data.body || 'medium',
      tastingNotes: data.tasting_notes || '',
      producerNotes: data.producer_notes || '',
      notes: data.notes || '',
      image: data.image || null,
      isTopSeller: data.is_top_seller ?? false,
    } as WineDraft;
  } else if (table === 'cocktails') {
    return {
      name: data.name || '',
      slug: data.slug || '',
      style: data.style || 'classic',
      glass: data.glass || '',
      ingredients: data.ingredients || '',
      keyIngredients: data.key_ingredients || '',
      procedure: (data.procedure as CocktailProcedureStep[]) || [],
      tastingNotes: data.tasting_notes || '',
      description: data.description || '',
      notes: data.notes || '',
      image: data.image || null,
      isTopSeller: data.is_top_seller ?? false,
    } as CocktailDraft;
  }
  return null;
}

// =============================================================================
// Inner component (uses context)
// =============================================================================

function IngestPageInner() {
  const { language, setLanguage } = useLanguage();
  const { isAdmin, user } = useAuth();
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { state, dispatch } = useIngestDraft();

  // Derive product table from active type
  const isWineType = state.activeType === 'wine';
  const isCocktailType = state.activeType === 'cocktail';
  const isPlateSpecType = state.activeType === 'plate_spec';
  const productTable = ACTIVE_TYPE_TABLE[state.activeType] || 'prep_recipes';
  const productLabel = ACTIVE_TYPE_LABEL[state.activeType] || 'Recipe';
  const cacheKey = ACTIVE_TYPE_CACHE_KEY[state.activeType] || 'recipes';

  const { sendMessage, isProcessing, error: chatError } = useIngestChat(productTable);
  const { session, createSession, loadSession, saveDraft, findSessionForProduct, reuseSessionForEdit, discardSession } = useIngestionSession();

  const { sessionId, table, productId } = useParams<{ sessionId?: string; table?: string; productId?: string }>();

  const [isPublishing, setIsPublishing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDiscarding, setIsDiscarding] = useState(false);
  const [showNoImageWarning, setShowNoImageWarning] = useState(false);
  const [showStaleWarning, setShowStaleWarning] = useState(false);
  const { generateImage, isGenerating } = useGenerateImage();
  const { translateFields, saveTranslations, translating: isAutoTranslating } = useTranslateProduct();
  const { getActiveCategories } = useTranslationPreferences();
  const { generate: generateDishGuide, isGenerating: isGeneratingDishGuide } = useGenerateDishGuide();

  // Are we editing an existing product?
  const isEditMode = Boolean(table && productId);

  // ---------------------------------------------------------------------------
  // Exit (go back)
  // ---------------------------------------------------------------------------
  const handleExit = useCallback(() => {
    navigate('/admin/ingest');
  }, [navigate]);

  // ---------------------------------------------------------------------------
  // Delete (edit mode only)
  // ---------------------------------------------------------------------------
  const handleDelete = useCallback(async () => {
    if (!productId || !table) return;

    setIsDeleting(true);

    try {
      const { error: deleteErr } = await supabase
        .from(table as any)
        .delete()
        .eq('id', productId);

      if (deleteErr) throw new Error(deleteErr.message);

      // Clean up ingestion session if one exists
      if (state.sessionId) {
        await supabase
          .from('ingestion_sessions')
          .update({ status: 'deleted', updated_at: new Date().toISOString() })
          .eq('id', state.sessionId);
      }

      const deleteCache = TABLE_TO_ACTIVE_TYPE[table]
        ? ACTIVE_TYPE_CACHE_KEY[TABLE_TO_ACTIVE_TYPE[table]] || 'recipes'
        : 'recipes';
      queryClient.invalidateQueries({ queryKey: [deleteCache] });
      dispatch({ type: 'RESET_DRAFT' });

      toast({ title: 'Deleted', description: `${productLabel} deleted successfully` });
      navigate('/admin/ingest');
    } catch (err) {
      console.error('Delete error:', err);
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : `Failed to delete ${productLabel.toLowerCase()}`,
      });
    } finally {
      setIsDeleting(false);
    }
  }, [productId, table, state.sessionId, dispatch, toast, navigate, queryClient, productLabel]);

  // ---------------------------------------------------------------------------
  // Discard Draft (new drafts only — not edit mode)
  // ---------------------------------------------------------------------------
  const handleDiscardDraft = useCallback(async () => {
    if (!state.sessionId) return;

    setIsDiscarding(true);
    const ok = await discardSession(state.sessionId);
    setIsDiscarding(false);

    if (ok) {
      dispatch({ type: 'RESET_DRAFT' });
      toast({ title: 'Discarded', description: 'Draft discarded successfully' });
      navigate('/admin/ingest');
    }
    // If !ok, discardSession already toasted the error
  }, [state.sessionId, discardSession, dispatch, toast, navigate]);

  // ---------------------------------------------------------------------------
  // Save Draft
  // ---------------------------------------------------------------------------
  const handleSaveDraft = useCallback(async (draftOverride?: PrepRecipeDraft | WineDraft | CocktailDraft | PlateSpecDraft) => {
    if (!user) return;

    dispatch({ type: 'SET_IS_SAVING', payload: true });

    try {
      // Create session if none exists (use URL sessionId as fallback)
      let currentSessionId = state.sessionId || sessionId || null;
      if (!currentSessionId) {
        const newId = await createSession(productTable);
        if (!newId) {
          toast({ title: 'Error', description: 'Failed to create session' });
          return;
        }
        currentSessionId = newId;
        dispatch({ type: 'SET_SESSION_ID', payload: newId });
      }

      // Sync session hook if edge function created/updated session externally.
      // This ensures saveDraft has a valid `session` and the correct `draft_version`.
      let version = state.draftVersion;
      if (!session || session.id !== currentSessionId) {
        const loaded = await loadSession(currentSessionId);
        if (loaded) {
          version = loaded.session.draftVersion;
        }
      } else if (session.draftVersion > version) {
        version = session.draftVersion;
      }

      const ok = await saveDraft(draftOverride ?? state.draft, version);
      if (ok) {
        dispatch({ type: 'SET_DRAFT_VERSION', payload: version + 1 });
        dispatch({ type: 'SET_DIRTY', payload: false });
        toast({ title: 'Saved', description: 'Draft saved successfully' });
      }
    } catch (err) {
      console.error('Save draft error:', err);
      toast({ title: 'Error', description: 'Failed to save draft' });
    } finally {
      dispatch({ type: 'SET_IS_SAVING', payload: false });
    }
  }, [user, state.sessionId, sessionId, state.draft, state.draftVersion, session, productTable, createSession, loadSession, saveDraft, dispatch, toast]);

  // ---------------------------------------------------------------------------
  // Auto-save after FOH dish guide generation.
  // This runs after React state is settled, avoiding stale-closure issues that
  // plague calling handleSaveDraft from within handleSendMessage.
  // ---------------------------------------------------------------------------
  const prevDishGuideRef = useRef<FohPlateSpecDraft | null>(null);
  useEffect(() => {
    if (!isPlateSpecType || !state.sessionId) return;
    const ps = state.draft as PlateSpecDraft;
    // Only trigger when dishGuide transitions from null/different to a new value
    if (ps.dishGuide && ps.dishGuide !== prevDishGuideRef.current) {
      prevDishGuideRef.current = ps.dishGuide;
      handleSaveDraft();
    }
  }, [isPlateSpecType, state.sessionId, state.draft, handleSaveDraft]);

  // ---------------------------------------------------------------------------
  // Auto-save after image upload/generation.
  // Tracks images array length so new uploads trigger a draft save.
  // ---------------------------------------------------------------------------
  const prevImageCountRef = useRef<number>(-1);
  useEffect(() => {
    if (!state.sessionId) return;
    // Get current image count based on draft type
    let currentCount = 0;
    if (isPlateSpecType) {
      currentCount = (state.draft as PlateSpecDraft).images?.length ?? 0;
    } else if (!isWineType && !isCocktailType) {
      currentCount = (state.draft as PrepRecipeDraft).images?.length ?? 0;
    } else {
      // Wine/cocktail use single `image` field — not tracked here
      return;
    }

    // Skip the first render (initialization) — set baseline without saving
    if (prevImageCountRef.current === -1) {
      prevImageCountRef.current = currentCount;
      return;
    }

    // Only save when images are added (count increases)
    if (currentCount > prevImageCountRef.current) {
      prevImageCountRef.current = currentCount;
      handleSaveDraft();
    } else {
      prevImageCountRef.current = currentCount;
    }
  }, [state.sessionId, state.draft, isPlateSpecType, isWineType, isCocktailType, handleSaveDraft]);

  // ---------------------------------------------------------------------------
  // Publish
  // ---------------------------------------------------------------------------
  const handlePublish = useCallback(async (skipImageWarning = false, skipStaleWarning = false) => {
    if (!user) return;

    const { draft } = state;

    if (isWineType) {
      // Wine validation
      const wd = draft as WineDraft;
      if (!wd.name.trim()) {
        toast({ title: 'Missing field', description: 'Wine name is required' });
        return;
      }
      if (!wd.producer.trim()) {
        toast({ title: 'Missing field', description: 'Producer is required' });
        return;
      }
      if (!wd.region.trim()) {
        toast({ title: 'Missing field', description: 'Region is required' });
        return;
      }
      if (!wd.country.trim()) {
        toast({ title: 'Missing field', description: 'Country is required' });
        return;
      }
      if (!wd.varietal.trim()) {
        toast({ title: 'Missing field', description: 'Varietal is required' });
        return;
      }
      if (!wd.tastingNotes.trim()) {
        toast({ title: 'Missing field', description: 'Tasting notes are required' });
        return;
      }

      // Warn if no image
      if (!wd.image && !skipImageWarning) {
        setShowNoImageWarning(true);
        return;
      }

      setIsPublishing(true);

      try {
        // Generate unique slug
        let slug = generateSlug(wd.name);
        let slugOk = false;
        for (let attempt = 0; attempt < 5; attempt++) {
          const candidate = attempt === 0 ? slug : `${slug}-${attempt + 1}`;
          const { data: existing } = await supabase
            .from('wines')
            .select('id')
            .eq('slug', candidate)
            .maybeSingle();

          if (!existing || (productId && existing.id === productId)) {
            slug = candidate;
            slugOk = true;
            break;
          }
        }

        if (!slugOk) {
          toast({ title: 'Error', description: 'Could not generate a unique slug. Try a different name.' });
          return;
        }

        const row = {
          slug,
          name: wd.name,
          producer: wd.producer,
          region: wd.region,
          country: wd.country,
          vintage: wd.vintage || null,
          varietal: wd.varietal,
          blend: wd.blend,
          style: wd.style,
          body: wd.body,
          tasting_notes: wd.tastingNotes,
          producer_notes: wd.producerNotes,
          notes: wd.notes,
          image: wd.image,
          is_top_seller: wd.isTopSeller,
          status: 'published' as const,
          version: 1,
          ai_ingestion_meta: {
            source_type: 'ai_ingestion',
            confidence_score: 0.9,
            missing_fields: [] as string[],
            last_ai_generated_at: new Date().toISOString(),
          },
          created_by: user.id,
        };

        let newRowId: string;

        if (productId) {
          const { data: existingRow } = await supabase
            .from('wines')
            .select('version')
            .eq('id', productId)
            .single();

          const { data: updated, error: updateErr } = await supabase
            .from('wines')
            .update({ ...row, version: (existingRow?.version ?? 0) + 1 })
            .eq('id', productId)
            .select('id')
            .single();

          if (updateErr) throw new Error(updateErr.message);
          if (!updated) throw new Error('Failed to update wine — check permissions');
          newRowId = updated.id;
        } else {
          const { data: inserted, error: insertErr } = await supabase
            .from('wines')
            .insert(row)
            .select('id')
            .single();

          if (insertErr) throw new Error(insertErr.message);
          if (!inserted) throw new Error('Failed to create wine — check permissions');
          newRowId = inserted.id;
        }

        // Update ingestion session: mark published, clear editing flag
        if (state.sessionId) {
          await supabase
            .from('ingestion_sessions')
            .update({
              status: 'published',
              product_id: newRowId,
              editing_product_id: null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', state.sessionId);

          // Backlink: set source_session_id on product row
          await supabase
            .from('wines')
            .update({ source_session_id: state.sessionId })
            .eq('id', newRowId);
        }

        // Fire-and-forget: generate embedding
        supabase.functions.invoke('embed-products', {
          body: { table: 'wines', rowId: newRowId },
        }).catch(() => {});

        queryClient.invalidateQueries({ queryKey: ['wines'] });
        dispatch({ type: 'RESET_DRAFT' });

        toast({
          title: productId ? 'Updated' : 'Published',
          description: `"${wd.name}" has been ${productId ? 'updated' : 'published'} successfully`,
        });

        navigate('/wines');
      } catch (err) {
        console.error('Publish error:', err);
        toast({
          title: 'Error',
          description: err instanceof Error ? err.message : 'Failed to publish wine',
        });
      } finally {
        setIsPublishing(false);
      }
    } else if (isCocktailType) {
      // Cocktail validation
      const cd = draft as CocktailDraft;
      if (!cd.name.trim()) {
        toast({ title: 'Missing field', description: 'Cocktail name is required' });
        return;
      }
      if (!cd.style.trim()) {
        toast({ title: 'Missing field', description: 'Style is required' });
        return;
      }
      if (!cd.glass.trim()) {
        toast({ title: 'Missing field', description: 'Glass type is required' });
        return;
      }
      if (!cd.ingredients.trim()) {
        toast({ title: 'Missing field', description: 'Ingredients are required' });
        return;
      }
      if (!cd.keyIngredients.trim()) {
        toast({ title: 'Missing field', description: 'Key ingredients are required' });
        return;
      }
      if (cd.procedure.length === 0) {
        toast({ title: 'Missing field', description: 'At least one procedure step is required' });
        return;
      }

      // Warn if no image
      if (!cd.image && !skipImageWarning) {
        setShowNoImageWarning(true);
        return;
      }

      setIsPublishing(true);

      try {
        // Generate unique slug
        let slug = generateSlug(cd.name);
        let slugOk = false;
        for (let attempt = 0; attempt < 5; attempt++) {
          const candidate = attempt === 0 ? slug : `${slug}-${attempt + 1}`;
          const { data: existing } = await supabase
            .from('cocktails')
            .select('id')
            .eq('slug', candidate)
            .maybeSingle();

          if (!existing || (productId && existing.id === productId)) {
            slug = candidate;
            slugOk = true;
            break;
          }
        }

        if (!slugOk) {
          toast({ title: 'Error', description: 'Could not generate a unique slug. Try a different name.' });
          return;
        }

        const row = {
          slug,
          name: cd.name,
          style: cd.style,
          glass: cd.glass,
          ingredients: cd.ingredients,
          key_ingredients: cd.keyIngredients,
          procedure: cd.procedure,
          tasting_notes: cd.tastingNotes,
          description: cd.description,
          notes: cd.notes,
          image: cd.image,
          is_top_seller: cd.isTopSeller,
          status: 'published' as const,
          version: 1,
          ai_ingestion_meta: {
            source_type: 'ai_ingestion',
            confidence_score: 0.9,
            missing_fields: [] as string[],
            last_ai_generated_at: new Date().toISOString(),
          },
          created_by: user.id,
        };

        let newRowId: string;

        if (productId) {
          const { data: existingRow } = await supabase
            .from('cocktails')
            .select('version')
            .eq('id', productId)
            .single();

          const { data: updated, error: updateErr } = await supabase
            .from('cocktails')
            .update({ ...row, version: (existingRow?.version ?? 0) + 1 })
            .eq('id', productId)
            .select('id')
            .single();

          if (updateErr) throw new Error(updateErr.message);
          if (!updated) throw new Error('Failed to update cocktail — check permissions');
          newRowId = updated.id;
        } else {
          const { data: inserted, error: insertErr } = await supabase
            .from('cocktails')
            .insert(row)
            .select('id')
            .single();

          if (insertErr) throw new Error(insertErr.message);
          if (!inserted) throw new Error('Failed to create cocktail — check permissions');
          newRowId = inserted.id;
        }

        // Update ingestion session: mark published, clear editing flag
        if (state.sessionId) {
          await supabase
            .from('ingestion_sessions')
            .update({
              status: 'published',
              product_id: newRowId,
              editing_product_id: null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', state.sessionId);

          // Backlink: set source_session_id on product row
          await supabase
            .from('cocktails')
            .update({ source_session_id: state.sessionId })
            .eq('id', newRowId);
        }

        // Fire-and-forget: generate embedding
        supabase.functions.invoke('embed-products', {
          body: { table: 'cocktails', rowId: newRowId },
        }).catch(() => {});

        queryClient.invalidateQueries({ queryKey: ['cocktails'] });
        dispatch({ type: 'RESET_DRAFT' });

        toast({
          title: productId ? 'Updated' : 'Published',
          description: `"${cd.name}" has been ${productId ? 'updated' : 'published'} successfully`,
        });

        navigate('/cocktails');
      } catch (err) {
        console.error('Publish error:', err);
        toast({
          title: 'Error',
          description: err instanceof Error ? err.message : 'Failed to publish cocktail',
        });
      } finally {
        setIsPublishing(false);
      }
    } else {
      // Prep recipe validation & publish (original logic)
      const rd = draft as PrepRecipeDraft;

      if (!rd.name.trim()) {
        toast({ title: 'Missing field', description: 'Recipe name is required' });
        return;
      }
      if (!rd.prepType.trim()) {
        toast({ title: 'Missing field', description: 'Prep type is required' });
        return;
      }
      if (rd.ingredients.length === 0) {
        toast({ title: 'Missing field', description: 'At least one ingredient group is required' });
        return;
      }
      if (rd.procedure.length === 0) {
        toast({ title: 'Missing field', description: 'At least one procedure group is required' });
        return;
      }
      if (rd.yieldQty <= 0 || !rd.yieldUnit.trim()) {
        toast({ title: 'Missing field', description: 'Yield quantity and unit are required' });
        return;
      }
      if (rd.shelfLifeValue <= 0 || !rd.shelfLifeUnit.trim()) {
        toast({ title: 'Missing field', description: 'Shelf life value and unit are required' });
        return;
      }

      // Validate sub-recipe references before publishing
      {
        const refResult = await validateSubRecipeRefs(rd.ingredients, rd.slug || undefined);
        if (!refResult.valid) {
          toast({
            title: 'Invalid sub-recipe references',
            description: `The following sub-recipe refs do not match any published recipe: ${refResult.danglingRefs.join(', ')}. Fix them in the Ingredients editor before publishing.`,
          });
          return;
        }
      }

      // Staleness gate: check if existing translations are stale (edit mode only)
      if (productId && !skipStaleWarning) {
        const dbData = {
          name: rd.name,
          ingredients: rd.ingredients,
          procedure: rd.procedure,
          training_notes: rd.trainingNotes,
        };
        const { data: existingTranslations } = await supabase
          .from('product_translations')
          .select('field_path, source_text')
          .eq('product_table', 'prep_recipes')
          .eq('product_id', productId);

        if (existingTranslations && existingTranslations.length > 0) {
          const hasStale = existingTranslations.some((t) => {
            const currentText = getFieldValue(dbData, t.field_path);
            return currentText !== null && t.source_text !== currentText;
          });
          if (hasStale) {
            setShowStaleWarning(true);
            return;
          }
        }
      }

      // Warn if no images attached
      if (rd.images.length === 0 && !skipImageWarning) {
        setShowNoImageWarning(true);
        return;
      }

      setIsPublishing(true);

      try {
        // Generate unique slug
        let slug = generateSlug(rd.name);
        let slugOk = false;
        for (let attempt = 0; attempt < 5; attempt++) {
          const candidate = attempt === 0 ? slug : `${slug}-${attempt + 1}`;
          const { data: existing } = await supabase
            .from('prep_recipes')
            .select('id')
            .eq('slug', candidate)
            .maybeSingle();

          // In edit mode, allow the same slug if it belongs to the product being edited
          if (!existing || (productId && existing.id === productId)) {
            slug = candidate;
            slugOk = true;
            break;
          }
        }

        if (!slugOk) {
          toast({ title: 'Error', description: 'Could not generate a unique slug. Try a different name.' });
          return;
        }

        const row = {
          slug,
          name: rd.name,
          prep_type: rd.prepType,
          status: 'published' as const,
          version: 1,
          yield_qty: rd.yieldQty,
          yield_unit: rd.yieldUnit,
          shelf_life_value: rd.shelfLifeValue,
          shelf_life_unit: rd.shelfLifeUnit,
          tags: rd.tags,
          images: rd.images,
          ingredients: rd.ingredients,
          procedure: rd.procedure,
          batch_scaling: rd.batchScaling || {},
          training_notes: rd.trainingNotes || {},
          ai_ingestion_meta: {
            source_type: 'ai_ingestion',
            confidence_score: 0.9,
            missing_fields: [] as string[],
            last_ai_generated_at: new Date().toISOString(),
          },
          created_by: user.id,
        };

        let newRowId: string;

        if (productId) {
          const { data: existingRow } = await supabase
            .from('prep_recipes')
            .select('version')
            .eq('id', productId)
            .single();

          const { data: updated, error: updateErr } = await supabase
            .from('prep_recipes')
            .update({ ...row, version: (existingRow?.version ?? 0) + 1 })
            .eq('id', productId)
            .select('id')
            .single();

          if (updateErr) throw new Error(updateErr.message);
          if (!updated) throw new Error('Failed to update recipe — check permissions');
          newRowId = updated.id;
        } else {
          const { data: inserted, error: insertErr } = await supabase
            .from('prep_recipes')
            .insert(row)
            .select('id')
            .single();

          if (insertErr) throw new Error(insertErr.message);
          if (!inserted) throw new Error('Failed to create recipe — check permissions');
          newRowId = inserted.id;
        }

        // Update ingestion session: mark published, clear editing flag
        if (state.sessionId) {
          await supabase
            .from('ingestion_sessions')
            .update({
              status: 'published',
              product_id: newRowId,
              editing_product_id: null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', state.sessionId);

          // Backlink: set source_session_id on product row
          await supabase
            .from('prep_recipes')
            .update({ source_session_id: state.sessionId })
            .eq('id', newRowId);
        }

        // Fire-and-forget: generate embedding
        supabase.functions.invoke('embed-products', {
          body: { table: 'prep_recipes', rowId: newRowId },
        }).catch(() => {});

        // Fire-and-forget: auto-translate on first publish (new recipe, no existing translations)
        if (!productId) {
          const categories = getActiveCategories('prep_recipes');
          if (categories.size > 0) {
            const dbData = {
              name: rd.name,
              ingredients: rd.ingredients,
              procedure: rd.procedure,
              training_notes: rd.trainingNotes,
            };
            const texts = extractTranslatableTexts('prep_recipes', dbData, categories);
            if (texts.length > 0) {
              translateFields(
                'prep_recipes',
                newRowId,
                texts.map((t) => ({ fieldPath: t.fieldPath, sourceText: t.sourceText })),
              ).then((results) => {
                if (results.length > 0) {
                  const merged = results.map((r) => {
                    const source = texts.find((t) => t.fieldPath === r.fieldPath);
                    return {
                      fieldPath: r.fieldPath,
                      sourceText: source?.sourceText ?? '',
                      translatedText: r.translatedText,
                    };
                  });
                  saveTranslations('prep_recipes', newRowId, merged).catch(() => {});
                }
              }).catch(() => {});
            }
          }
        }

        // Invalidate cache so /recipes page picks up new row
        queryClient.invalidateQueries({ queryKey: ['recipes'] });

        dispatch({ type: 'RESET_DRAFT' });

        toast({
          title: productId ? 'Updated' : 'Published',
          description: `"${rd.name}" has been ${productId ? 'updated' : 'published'} successfully`,
        });

        navigate('/recipes');
      } catch (err) {
        console.error('Publish error:', err);
        toast({
          title: 'Error',
          description: err instanceof Error ? err.message : 'Failed to publish recipe',
        });
      } finally {
        setIsPublishing(false);
      }
    }
  }, [user, state, productId, isWineType, isCocktailType, dispatch, toast, navigate, queryClient, getActiveCategories, translateFields, saveTranslations]);

  // ---------------------------------------------------------------------------
  // Re-translate & Publish (staleness gate action)
  // ---------------------------------------------------------------------------
  const handleRetranslateAndPublish = useCallback(async () => {
    if (!productId) return;
    setShowStaleWarning(false);

    const rd = state.draft as PrepRecipeDraft;
    const dbData = {
      name: rd.name,
      ingredients: rd.ingredients,
      procedure: rd.procedure,
      training_notes: rd.trainingNotes,
    };

    // Get stale fields
    const { data: existingTranslations } = await supabase
      .from('product_translations')
      .select('field_path, source_text')
      .eq('product_table', 'prep_recipes')
      .eq('product_id', productId);

    if (existingTranslations && existingTranslations.length > 0) {
      const staleFields = existingTranslations
        .filter((t) => {
          const currentText = getFieldValue(dbData, t.field_path);
          return currentText !== null && t.source_text !== currentText;
        })
        .map((t) => {
          const currentText = getFieldValue(dbData, t.field_path) ?? '';
          return { fieldPath: t.field_path, sourceText: currentText };
        });

      if (staleFields.length > 0) {
        const results = await translateFields('prep_recipes', productId, staleFields);
        if (results.length > 0) {
          const merged = results.map((r) => {
            const source = staleFields.find((s) => s.fieldPath === r.fieldPath);
            return {
              fieldPath: r.fieldPath,
              sourceText: source?.sourceText ?? '',
              translatedText: r.translatedText,
            };
          });
          await saveTranslations('prep_recipes', productId, merged);
        }
      }
    }

    // Now publish with both warnings skipped
    handlePublish(true, true);
  }, [productId, state.draft, translateFields, saveTranslations, handlePublish]);

  // ---------------------------------------------------------------------------
  // Publish: Plate Spec (+ optional Dish Guide)
  // ---------------------------------------------------------------------------
  const handlePublishPlateSpec = useCallback(async (skipImageWarning = false) => {
    if (!user) return;

    const ps = state.draft as PlateSpecDraft;

    // --- Plate spec validation ---
    if (!ps.name.trim()) {
      toast({ title: 'Missing field', description: 'Plate spec name is required' });
      return;
    }
    if (!ps.plateType.trim()) {
      toast({ title: 'Missing field', description: 'Plate type is required' });
      return;
    }
    if (!ps.menuCategory.trim()) {
      toast({ title: 'Missing field', description: 'Menu category is required' });
      return;
    }
    if (ps.components.length === 0 || !ps.components.some(g => g.items && g.items.length > 0)) {
      toast({ title: 'Missing field', description: 'At least one component group with items is required' });
      return;
    }
    if (ps.assemblyProcedure.length === 0 || !ps.assemblyProcedure.some(g => g.steps && g.steps.length > 0)) {
      toast({ title: 'Missing field', description: 'At least one assembly group with steps is required' });
      return;
    }

    // --- FOH Plate Spec guards ---
    if (!ps.dishGuide) {
      // No FOH exists — auto-generate and return so user can review
      const fohResult = await generateDishGuide(ps, state.sessionId);
      if (fohResult) {
        // Copy BOH first image as FOH thumbnail
        if (!fohResult.image && ps.images.length > 0) {
          fohResult.image = ps.images[0].url;
        }
        dispatch({ type: 'SET_DISH_GUIDE', payload: fohResult });
        // Auto-save happens via dishGuideSaveEffect
      }
      toast({
        title: 'FOH Plate Spec generated',
        description: 'Please review the FOH Plate Spec before publishing.',
      });
      return;
    }

    if (ps.dishGuideStale) {
      toast({
        title: 'FOH Plate Spec needs update',
        description: 'The BOH Plate Spec has changed. Regenerate the FOH Plate Spec before publishing.',
      });
      return;
    }

    // --- FOH Plate Spec field validation ---
    if (ps.dishGuide) {
      const dg = ps.dishGuide;
      if (!dg.menuName.trim()) {
        toast({ title: 'Missing field', description: 'Dish guide menu name is required' });
        return;
      }
      if (!dg.shortDescription.trim()) {
        toast({ title: 'Missing field', description: 'Dish guide short description is required' });
        return;
      }
      if (!dg.detailedDescription.trim()) {
        toast({ title: 'Missing field', description: 'Dish guide detailed description is required' });
        return;
      }
    }

    // Warn if no images
    if (ps.images.length === 0 && !skipImageWarning) {
      setShowNoImageWarning(true);
      return;
    }

    setIsPublishing(true);

    try {
      // --- Generate unique plate spec slug ---
      let slug = generateSlug(ps.name);
      let slugOk = false;
      for (let attempt = 0; attempt < 5; attempt++) {
        const candidate = attempt === 0 ? slug : `${slug}-${attempt + 1}`;
        const { data: existing } = await supabase
          .from('plate_specs')
          .select('id')
          .eq('slug', candidate)
          .maybeSingle();

        if (!existing || (productId && existing.id === productId)) {
          slug = candidate;
          slugOk = true;
          break;
        }
      }

      if (!slugOk) {
        toast({ title: 'Error', description: 'Could not generate a unique slug. Try a different name.' });
        return;
      }

      // --- Build plate spec DB row ---
      const plateSpecRow = {
        slug,
        name: ps.name,
        plate_type: ps.plateType,
        menu_category: ps.menuCategory,
        tags: ps.tags,
        allergens: ps.allergens,
        components: ps.components,
        assembly_procedure: ps.assemblyProcedure,
        notes: ps.notes,
        images: ps.images,
        status: 'published' as const,
        version: 1,
        ai_ingestion_meta: {
          source_type: 'ingestion',
          confidence_score: 1.0,
          missing_fields: [] as string[],
          last_ai_generated_at: new Date().toISOString(),
        },
        created_by: user.id,
        source_session_id: state.sessionId || null,
      };

      let plateSpecId: string;

      // --- INSERT or UPDATE plate spec ---
      if (productId) {
        const { data: existingRow } = await supabase
          .from('plate_specs')
          .select('version')
          .eq('id', productId)
          .single();

        const { data: updated, error: updateErr } = await supabase
          .from('plate_specs')
          .update({ ...plateSpecRow, version: (existingRow?.version ?? 0) + 1 })
          .eq('id', productId)
          .select('id')
          .single();

        if (updateErr) throw new Error(updateErr.message);
        if (!updated) throw new Error('Failed to update plate spec -- check permissions');
        plateSpecId = updated.id;
      } else {
        const { data: inserted, error: insertErr } = await supabase
          .from('plate_specs')
          .insert(plateSpecRow)
          .select('id')
          .single();

        if (insertErr) throw new Error(insertErr.message);
        if (!inserted) throw new Error('Failed to create plate spec -- check permissions');
        plateSpecId = inserted.id;
      }

      // --- Publish dish guide (if exists) ---
      let dishGuideId: string | null = null;

      if (ps.dishGuide) {
        try {
          const dg = ps.dishGuide;

          // Generate unique dish guide slug
          let dgSlug = generateSlug(dg.menuName || ps.name);
          let dgSlugOk = false;
          for (let attempt = 0; attempt < 5; attempt++) {
            const candidate = attempt === 0 ? dgSlug : `${dgSlug}-${attempt + 1}`;
            const { data: existing } = await supabase
              .from('foh_plate_specs')
              .select('id')
              .eq('slug', candidate)
              .maybeSingle();

            // In edit mode, check if there's an existing linked dish guide
            const isOwnSlug = existing && productId
              ? (await supabase.from('foh_plate_specs').select('plate_spec_id').eq('id', existing.id).single())?.data?.plate_spec_id === productId
              : false;

            if (!existing || isOwnSlug) {
              dgSlug = candidate;
              dgSlugOk = true;
              break;
            }
          }

          if (!dgSlugOk) {
            toast({ title: 'Warning', description: 'Could not generate a unique dish guide slug. Dish guide was not saved.' });
          } else {
            const dishGuideRow = {
              slug: dgSlug,
              menu_name: dg.menuName,
              plate_type: dg.plateType || ps.plateType,
              plate_spec_id: plateSpecId,
              short_description: dg.shortDescription,
              detailed_description: dg.detailedDescription,
              ingredients: dg.ingredients,
              key_ingredients: dg.keyIngredients,
              flavor_profile: dg.flavorProfile,
              allergens: dg.allergens,
              allergy_notes: dg.allergyNotes,
              upsell_notes: dg.upsellNotes,
              notes: dg.notes,
              image: dg.image,
              is_top_seller: dg.isTopSeller,
              status: 'published' as const,
              version: 1,
              ai_ingestion_meta: {
                source_type: 'ingestion',
                confidence_score: 1.0,
                missing_fields: [] as string[],
                last_ai_generated_at: new Date().toISOString(),
              },
              created_by: user.id,
              source_session_id: state.sessionId || null,
            };

            // Check for existing linked dish guide (edit mode)
            if (productId) {
              const { data: existingDg } = await supabase
                .from('foh_plate_specs')
                .select('id, version')
                .eq('plate_spec_id', productId)
                .maybeSingle();

              if (existingDg) {
                // UPDATE existing dish guide
                const { data: updatedDg, error: updateDgErr } = await supabase
                  .from('foh_plate_specs')
                  .update({ ...dishGuideRow, version: (existingDg.version ?? 0) + 1 })
                  .eq('id', existingDg.id)
                  .select('id')
                  .single();

                if (updateDgErr) throw new Error(updateDgErr.message);
                if (updatedDg) dishGuideId = updatedDg.id;
              } else {
                // INSERT new dish guide for existing plate spec
                const { data: insertedDg, error: insertDgErr } = await supabase
                  .from('foh_plate_specs')
                  .insert(dishGuideRow)
                  .select('id')
                  .single();

                if (insertDgErr) throw new Error(insertDgErr.message);
                if (insertedDg) dishGuideId = insertedDg.id;
              }
            } else {
              // INSERT new dish guide
              const { data: insertedDg, error: insertDgErr } = await supabase
                .from('foh_plate_specs')
                .insert(dishGuideRow)
                .select('id')
                .single();

              if (insertDgErr) throw new Error(insertDgErr.message);
              if (insertedDg) dishGuideId = insertedDg.id;
            }
          }
        } catch (dgErr) {
          console.error('Dish guide publish error:', dgErr);
          toast({
            title: 'Partial Success',
            description: 'Plate spec saved but dish guide failed -- you can retry from the edit screen.',
          });
        }
      }

      // --- Update ingestion session ---
      if (state.sessionId) {
        await supabase
          .from('ingestion_sessions')
          .update({
            status: 'published',
            product_id: plateSpecId,
            editing_product_id: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', state.sessionId);

        // Backlink: set source_session_id on product row
        await supabase
          .from('plate_specs')
          .update({ source_session_id: state.sessionId })
          .eq('id', plateSpecId);
      }

      // --- Fire-and-forget: generate embeddings ---
      supabase.functions.invoke('embed-products', {
        body: { table: 'plate_specs', rowId: plateSpecId },
      }).catch(() => {});

      if (dishGuideId) {
        supabase.functions.invoke('embed-products', {
          body: { table: 'foh_plate_specs', rowId: dishGuideId },
        }).catch(() => {});
      }

      // --- Invalidate caches ---
      queryClient.invalidateQueries({ queryKey: ['plate_specs'] });
      if (dishGuideId) {
        queryClient.invalidateQueries({ queryKey: ['dishes'] });
      }

      dispatch({ type: 'RESET_DRAFT' });

      toast({
        title: productId ? 'Updated' : 'Published',
        description: `"${ps.name}" has been ${productId ? 'updated' : 'published'} successfully${dishGuideId ? ' (with dish guide)' : ''}`,
      });

      navigate('/recipes');
    } catch (err) {
      console.error('Publish error:', err);
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to publish plate spec',
      });
    } finally {
      setIsPublishing(false);
    }
  }, [user, state, productId, dispatch, toast, navigate, queryClient, generateDishGuide, handleSaveDraft]);

  // Load session from URL params on mount
  useEffect(() => {
    if (sessionId && !state.sessionId) {
      loadSession(sessionId).then(async (result) => {
        if (result) {
          dispatch({ type: 'SET_SESSION_ID', payload: sessionId });

          // Set active type based on session's product table
          const activeType = TABLE_TO_ACTIVE_TYPE[result.session.productTable];
          if (activeType) {
            dispatch({ type: 'SET_ACTIVE_TYPE', payload: activeType });
          }

          // Restore editing product ID if present on session
          const restoredProductId = result.session.editingProductId || result.session.productId;
          if (restoredProductId) {
            dispatch({ type: 'SET_EDITING_PRODUCT_ID', payload: restoredProductId });
          }

          // Restore draft from session
          if (result.session.draftData && result.session.draftData.name) {
            dispatch({ type: 'SET_DRAFT', payload: result.session.draftData });
            dispatch({ type: 'SET_DRAFT_VERSION', payload: result.session.draftVersion });

            // Initialize refs so auto-save effects don't spuriously fire
            const restoredDraft = result.session.draftData as PlateSpecDraft;
            if (restoredDraft.dishGuide) {
              prevDishGuideRef.current = restoredDraft.dishGuide;
            }
            // Initialize image count ref from restored draft
            const restoredImages = (result.session.draftData as any).images;
            if (Array.isArray(restoredImages)) {
              prevImageCountRef.current = restoredImages.length;
            }
          }

          // Restore chat messages
          if (result.messages.length > 0) {
            dispatch({ type: 'SET_MESSAGES', payload: result.messages });
          }

          // For plate spec sessions, fetch linked FOH if draft doesn't have one
          if (result.session.productTable === 'plate_specs') {
            const draftData = result.session.draftData as PlateSpecDraft | null;
            const linkedProductId = restoredProductId;
            if (linkedProductId && (!draftData?.dishGuide)) {
              const { data: dishGuideRow } = await supabase
                .from('foh_plate_specs')
                .select('*')
                .eq('plate_spec_id', linkedProductId)
                .maybeSingle();

              if (dishGuideRow) {
                const foh: FohPlateSpecDraft = {
                  menuName: dishGuideRow.menu_name ?? '',
                  slug: dishGuideRow.slug ?? '',
                  plateType: dishGuideRow.plate_type ?? '',
                  plateSpecId: dishGuideRow.plate_spec_id ?? null,
                  shortDescription: dishGuideRow.short_description ?? '',
                  detailedDescription: dishGuideRow.detailed_description ?? '',
                  ingredients: dishGuideRow.ingredients ?? [],
                  keyIngredients: dishGuideRow.key_ingredients ?? [],
                  flavorProfile: dishGuideRow.flavor_profile ?? [],
                  allergens: dishGuideRow.allergens ?? [],
                  allergyNotes: dishGuideRow.allergy_notes ?? '',
                  upsellNotes: dishGuideRow.upsell_notes ?? '',
                  notes: dishGuideRow.notes ?? '',
                  image: dishGuideRow.image ?? null,
                  isTopSeller: dishGuideRow.is_top_seller ?? false,
                };
                dispatch({ type: 'SET_DISH_GUIDE', payload: foh });
                prevDishGuideRef.current = foh;
              }
            }
          }
        }
      });
    }
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Edit mode: load existing product and REUSE its session (1:1 relationship)
  useEffect(() => {
    if (table && productId && !state.sessionId) {
      (async () => {
        try {
          // Fetch existing product
          const { data, error: fetchError } = await supabase
            .from(table as any)
            .select('*')
            .eq('id', productId)
            .single();

          if (fetchError || !data) {
            toast({ title: 'Error', description: 'Product not found' });
            return;
          }

          // Set active type based on table
          const activeType = TABLE_TO_ACTIVE_TYPE[table];
          if (activeType) {
            dispatch({ type: 'SET_ACTIVE_TYPE', payload: activeType });
          }

          const draft = buildDraftFromProduct(table, data);

          // Try to find an existing session for this product
          const existingSession = await findSessionForProduct(productId, table);

          let resolvedSessionId: string;

          if (existingSession) {
            // Load session's chat history
            const loadResult = await loadSession(existingSession.id);

            if (existingSession.status === 'published' && draft) {
              // Transition published session back to drafting
              await reuseSessionForEdit(existingSession.id, productId, draft);
            } else if (existingSession.status === 'drafting' || existingSession.status === 'review') {
              // Already in-progress edit — just update draft_data with latest product data
              if (draft) {
                await supabase
                  .from('ingestion_sessions')
                  .update({
                    draft_data: draft as unknown,
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', existingSession.id);
              }
            }

            resolvedSessionId = existingSession.id;

            // Restore chat messages from loaded session
            if (loadResult && loadResult.messages.length > 0) {
              dispatch({ type: 'SET_MESSAGES', payload: loadResult.messages });
              setHistoryMessageCount(loadResult.messages.length);
            }
          } else {
            // No session exists for this product (e.g., seeded data) — create one
            const newId = await createSession(table, 'edit');
            if (!newId) {
              toast({ title: 'Error', description: 'Failed to create session' });
              return;
            }

            // Link edit session to the product being edited
            await supabase
              .from('ingestion_sessions')
              .update({
                editing_product_id: productId,
                draft_data: (draft || {}) as unknown,
                updated_at: new Date().toISOString(),
              })
              .eq('id', newId);

            resolvedSessionId = newId;
          }

          dispatch({ type: 'SET_SESSION_ID', payload: resolvedSessionId });
          dispatch({ type: 'SET_EDITING_PRODUCT_ID', payload: productId });

          if (draft) {
            dispatch({ type: 'SET_DRAFT', payload: draft });
            // Initialize image count ref from loaded product data
            const draftImages = (draft as any).images;
            if (Array.isArray(draftImages)) {
              prevImageCountRef.current = draftImages.length;
            }
          }

          // After setting the plate spec draft, check for linked dish guide
          if (table === 'plate_specs' && productId) {
            const { data: dishGuideRow } = await supabase
              .from('foh_plate_specs')
              .select('*')
              .eq('plate_spec_id', productId)
              .maybeSingle();

            if (dishGuideRow) {
              const foh: FohPlateSpecDraft = {
                menuName: dishGuideRow.menu_name ?? '',
                slug: dishGuideRow.slug ?? '',
                plateType: dishGuideRow.plate_type ?? '',
                plateSpecId: dishGuideRow.plate_spec_id ?? null,
                shortDescription: dishGuideRow.short_description ?? '',
                detailedDescription: dishGuideRow.detailed_description ?? '',
                ingredients: dishGuideRow.ingredients ?? [],
                keyIngredients: dishGuideRow.key_ingredients ?? [],
                flavorProfile: dishGuideRow.flavor_profile ?? [],
                allergens: dishGuideRow.allergens ?? [],
                allergyNotes: dishGuideRow.allergy_notes ?? '',
                upsellNotes: dishGuideRow.upsell_notes ?? '',
                notes: dishGuideRow.notes ?? '',
                image: dishGuideRow.image ?? null,
                isTopSeller: dishGuideRow.is_top_seller ?? false,
              };
              dispatch({ type: 'SET_DISH_GUIDE', payload: foh });
              // Initialize ref so dishGuideSaveEffect doesn't spuriously fire
              prevDishGuideRef.current = foh;
            }
          }
        } catch (err) {
          console.error('Failed to load product for editing:', err);
          toast({ title: 'Error', description: 'Failed to load product' });
        }
      })();
    }
  }, [table, productId]); // eslint-disable-line react-hooks/exhaustive-deps

  const { uploadFile, isUploading: isFileUploading, error: fileError } = useFileUpload(productTable);
  const { uploadImage, isUploading: isImageUploading, error: imageError } = useImageUpload(productTable);

  // Local UI state
  const [desktopView, setDesktopView] = useState<'preview' | 'edit'>('edit');
  const [uploadingFileName, setUploadingFileName] = useState<string | null>(null);
  const [historyMessageCount, setHistoryMessageCount] = useState(0);

  // Handle sending a chat message (with optional batch attachments)
  const handleSendMessage = useCallback(async (
    content: string,
    attachments?: QueuedAttachment[],
  ) => {
    // Build user message content (show attachment count if any)
    const hasAttachments = attachments && attachments.length > 0;
    const displayContent = hasAttachments
      ? content
        ? `${content}\n\n📎 ${attachments.length} file(s) attached`
        : `📎 ${attachments.length} file(s) attached`
      : content;

    // Add user message immediately
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: displayContent,
      createdAt: new Date().toISOString(),
    };
    dispatch({ type: 'ADD_MESSAGE', payload: userMsg });

    // Use URL sessionId as fallback to prevent race condition where the
    // useEffect hasn't finished loading the session into state yet
    let currentSessionId = state.sessionId || sessionId || null;

    // Local guard to prevent double FOH generation within a single handleSendMessage call.
    // `isGeneratingDishGuide` is a stale closure value within this callback, so we track
    // generation locally to prevent double-fire in multi-attachment batches.
    let dishGuideGenerated = false;

    // 1. Process attachments sequentially
    if (hasAttachments) {
      for (const att of attachments) {
        setUploadingFileName(att.file.name);

        const result = att.type === 'image'
          ? await uploadImage(att.file, currentSessionId || undefined)
          : await uploadFile(att.file, currentSessionId || undefined);

        if (result) {
          // Track session ID from first successful upload
          if (!currentSessionId) {
            currentSessionId = result.sessionId;
            dispatch({ type: 'SET_SESSION_ID', payload: result.sessionId });
          }

          // Show AI response for THIS attachment
          const aiMsg: ChatMessage = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: result.message,
            draftPreview: result.draft || undefined,
            createdAt: new Date().toISOString(),
          };
          dispatch({ type: 'ADD_MESSAGE', payload: aiMsg });

          // Update draft progressively (each builds on previous via backend merge)
          if (result.draft) {
            dispatch({ type: 'SET_DRAFT', payload: result.draft });

            // Auto-generate FOH Plate Spec on first valid plate spec extraction
            if (isPlateSpecType && !dishGuideGenerated) {
              const psDraft = result.draft as PlateSpecDraft;
              if (
                psDraft.name !== '' &&
                (psDraft.components ?? []).some(g => g.items && g.items.length > 0) &&
                psDraft.dishGuide == null
              ) {
                dishGuideGenerated = true;
                const fohResult = await generateDishGuide(psDraft, currentSessionId);
                if (fohResult) {
                  // Copy BOH first image as FOH thumbnail
                  if (!fohResult.image && psDraft.images.length > 0) {
                    fohResult.image = psDraft.images[0].url;
                  }
                  dispatch({ type: 'SET_DISH_GUIDE', payload: fohResult });
                  // Auto-save happens via dishGuideSaveEffect (avoids stale closures)
                }
              }
            }
          }
        }
      }
      setUploadingFileName(null);
    }

    // 2. If user also typed text, send through the pipeline
    if (content) {
      const chatResult = await sendMessage(content, currentSessionId || undefined);

      if (chatResult) {
        if (!currentSessionId && chatResult.sessionId) {
          currentSessionId = chatResult.sessionId;
          dispatch({ type: 'SET_SESSION_ID', payload: chatResult.sessionId });
        }

        const aiMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: chatResult.message,
          draftPreview: chatResult.draft || undefined,
          createdAt: new Date().toISOString(),
        };
        dispatch({ type: 'ADD_MESSAGE', payload: aiMsg });

        if (chatResult.draft) {
          dispatch({ type: 'SET_DRAFT', payload: chatResult.draft });

          // Auto-generate FOH Plate Spec on first valid plate spec extraction
          if (isPlateSpecType && !dishGuideGenerated) {
            const psDraft = chatResult.draft as PlateSpecDraft;
            if (
              psDraft.name !== '' &&
              (psDraft.components ?? []).some(g => g.items && g.items.length > 0) &&
              psDraft.dishGuide == null
            ) {
              dishGuideGenerated = true;
              const fohResult = await generateDishGuide(psDraft, currentSessionId);
              if (fohResult) {
                // Copy BOH first image as FOH thumbnail
                if (!fohResult.image && psDraft.images.length > 0) {
                  fohResult.image = psDraft.images[0].url;
                }
                dispatch({ type: 'SET_DISH_GUIDE', payload: fohResult });
                // Auto-save happens via dishGuideSaveEffect (avoids stale closures)
              }
            }
          }
        }
      }
    }
  }, [dispatch, sendMessage, uploadFile, uploadImage, state.sessionId, sessionId, isPlateSpecType, generateDishGuide]);

  // Determine if we have a draft worth showing
  const hasDraft = isPlateSpecType
    ? (state.draft as PlateSpecDraft).name !== '' || ((state.draft as PlateSpecDraft).components ?? []).length > 0
    : isCocktailType
      ? (state.draft as CocktailDraft).name !== ''
      : isWineType
        ? (state.draft as WineDraft).name !== ''
        : (state.draft as PrepRecipeDraft).name !== '' || (state.draft as PrepRecipeDraft).ingredients.length > 0;

  const isUploading = isFileUploading || isImageUploading;

  // Editor component based on active type
  const editorComponent = isPlateSpecType
    ? <PlateSpecEditor />
    : isCocktailType
      ? <CocktailEditor />
      : isWineType
        ? <WineEditor />
        : <PrepRecipeEditor />;

  // Preview component based on active type
  const previewComponent = (onSwitchToEdit: () => void) =>
    isPlateSpecType ? (
      <PlateSpecDualPreview
        draft={state.draft as PlateSpecDraft}
        onSwitchToEdit={onSwitchToEdit}
        productId={state.editingProductId}
      />
    ) : isCocktailType ? (
      <CocktailIngestPreview draft={state.draft as CocktailDraft} onSwitchToEdit={onSwitchToEdit} />
    ) : isWineType ? (
      <WineIngestPreview draft={state.draft as WineDraft} onSwitchToEdit={onSwitchToEdit} />
    ) : (
      <IngestPreview draft={state.draft as PrepRecipeDraft} onSwitchToEdit={onSwitchToEdit} productId={state.editingProductId} />
    );

  // Chat content for mobile layout
  const chatContent = (
    <ChatIngestionPanel
      messages={state.messages}
      onSendMessage={handleSendMessage}
      isProcessing={isProcessing}
      className="min-h-[400px] lg:min-h-[500px]"
      isUploading={isUploading}
      uploadingFileName={uploadingFileName || undefined}
      productLabel={productLabel}
      historyMessageCount={historyMessageCount}
    />
  );

  // Desktop AI panel (chat docked on right)
  const aiPanel = !isMobile ? (
    <div className="flex flex-col h-full p-4">
      <div className="shrink-0 mb-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <span className="text-[16px] leading-none">🤖</span>
          AI {productLabel} Builder
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Describe your {productLabel.toLowerCase()} and I'll structure it
        </p>
      </div>
      <ChatIngestionPanel
        messages={state.messages}
        onSendMessage={handleSendMessage}
        isProcessing={isProcessing}
        className="flex-1 min-h-0"
        isUploading={isUploading}
        uploadingFileName={uploadingFileName || undefined}
        historyMessageCount={historyMessageCount}
        productLabel={productLabel}
      />
    </div>
  ) : undefined;

  // Back button (injected into Header left section)
  const headerLeft = (
    <button
      type="button"
      onClick={handleExit}
      className={cn(
        'flex items-center justify-center shrink-0',
        'h-9 w-9 rounded-lg',
        'bg-orange-500 text-white',
        'hover:bg-orange-600 active:scale-[0.96]',
        'shadow-sm transition-all duration-150'
      )}
      title="Back to Ingestion Dashboard"
    >
      <ArrowLeft className="h-4 w-4" />
    </button>
  );

  // Plate spec dish guide state for toolbar
  const plateSpecDraft = isPlateSpecType ? (state.draft as PlateSpecDraft) : null;
  const canGenerateDishGuide = isPlateSpecType && plateSpecDraft
    && plateSpecDraft.name !== ''
    && (plateSpecDraft.components ?? []).length > 0
    && (plateSpecDraft.components ?? []).some(g => g.items && g.items.length > 0);
  const hasDishGuide = isPlateSpecType && plateSpecDraft?.dishGuide != null;
  const dishGuideStale = isPlateSpecType && plateSpecDraft?.dishGuideStale === true;

  // Center toolbar: Save Draft + Publish (+ Delete in edit mode, + Discard in new draft mode)
  const headerToolbar = hasDraft ? (
    <div className="flex items-center gap-2">
      {isEditMode && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              disabled={isDeleting || state.isSaving || isPublishing || isGeneratingDishGuide}
            >
              {isDeleting
                ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                : <Trash2 className="h-3.5 w-3.5 mr-1.5" />}
              Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {productLabel.toLowerCase()}?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete "{state.draft.name || `this ${productLabel.toLowerCase()}`}". This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
      {!isEditMode && state.sessionId && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              disabled={isDiscarding || state.isSaving || isPublishing || isGeneratingDishGuide}
            >
              {isDiscarding
                ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                : <Trash2 className="h-3.5 w-3.5 mr-1.5" />}
              Discard
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Discard this draft?</AlertDialogTitle>
              <AlertDialogDescription>
                This cannot be undone. Your draft and chat history will be discarded.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDiscardDraft}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Discard
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
      {isPlateSpecType && canGenerateDishGuide && (
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            if (!plateSpecDraft) return;
            const result = await generateDishGuide(plateSpecDraft, state.sessionId);
            if (result) {
              // Copy BOH first image as FOH thumbnail
              if (!result.image && plateSpecDraft.images.length > 0) {
                result.image = plateSpecDraft.images[0].url;
              }
              dispatch({ type: 'SET_DISH_GUIDE', payload: result });
              // Auto-save happens via dishGuideSaveEffect
            }
          }}
          disabled={isGeneratingDishGuide || isPublishing || state.isSaving}
          className="gap-1.5"
        >
          {isGeneratingDishGuide ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
          ) : (
            <><Sparkles className="h-4 w-4" /> {hasDishGuide ? 'Regenerate' : 'Generate'} FOH Plate Spec</>
          )}
        </Button>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={handleSaveDraft}
        disabled={state.isSaving || isPublishing || !state.isDirty || isGeneratingDishGuide}
      >
        {state.isSaving
          ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          : <Save className="h-3.5 w-3.5 mr-1.5" />}
        Save Draft
      </Button>
      <Button
        size="sm"
        onClick={() => {
          if (isPlateSpecType) {
            handlePublishPlateSpec();
          } else {
            handlePublish();
          }
        }}
        disabled={state.isSaving || isPublishing || isGeneratingDishGuide}
        className="bg-orange-500 text-white hover:bg-orange-600"
      >
        {isPublishing
          ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          : <Send className="h-3.5 w-3.5 mr-1.5" />}
        Publish
      </Button>
    </div>
  ) : undefined;

  return (
    <AppShell
      language={language}
      onLanguageChange={setLanguage}
      isAdmin={isAdmin}
      showSearch={false}
      aiPanel={aiPanel}
      constrainContentWidth={true}
      headerToolbar={headerToolbar}
      headerLeft={headerLeft}
    >
      <div className="space-y-4">
        {/* Product Type Navbar — hidden once a session is active or in edit mode */}
        {!isEditMode && !state.sessionId && state.messages.length === 0 && (
          <ProductTypeNavbar
            activeType={state.activeType}
            onTypeChange={(type) => dispatch({ type: 'SET_ACTIVE_TYPE', payload: type })}
            dirtyTypes={state.isDirty ? new Set([state.activeType]) : undefined}
          />
        )}

        {/* Mobile Layout */}
        {isMobile ? (
          <>
            {state.mobileMode === 'chat' && chatContent}

            {state.mobileMode === 'preview' && previewComponent(
              () => dispatch({ type: 'SET_MOBILE_MODE', payload: 'edit' })
            )}

            {state.mobileMode === 'edit' && (
              hasDraft ? (
                editorComponent
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                  <p className="text-sm font-medium">No {productLabel.toLowerCase()} to edit</p>
                  <p className="text-xs mt-1">Build a {productLabel.toLowerCase()} in Chat first</p>
                </div>
              )
            )}

            {/* Mobile Mode Segment Control */}
            <div className="fixed bottom-16 left-0 right-0 px-4 pb-2 bg-background/95 backdrop-blur-sm border-t border-border pt-2 z-10">
              <MobileModeTabs
                activeMode={state.mobileMode}
                onModeChange={(mode) => dispatch({ type: 'SET_MOBILE_MODE', payload: mode })}
              />
            </div>
          </>
        ) : (
          /* Desktop Layout: Preview/Edit in main area, chat in right panel */
          <div>
            {/* Desktop view toggle */}
            {hasDraft && (
              <div className="mb-4">
                <Tabs value={desktopView} onValueChange={(v) => setDesktopView(v as 'preview' | 'edit')}>
                  <TabsList>
                    <TabsTrigger value="edit">Edit</TabsTrigger>
                    <TabsTrigger value="preview">Preview</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            )}

            {hasDraft ? (
              desktopView === 'edit' ? (
                editorComponent
              ) : (
                previewComponent(() => setDesktopView('edit'))
              )
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                <span className="text-[32px] leading-none mb-3">✏️</span>
                <p className="text-sm font-medium">Start building a {productLabel.toLowerCase()}</p>
                <p className="text-xs mt-1">
                  Use the AI chat panel on the right to describe your {productLabel.toLowerCase()}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* No-image publish warning */}
      <AlertDialog open={showNoImageWarning} onOpenChange={setShowNoImageWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              No image attached
            </AlertDialogTitle>
            <AlertDialogDescription>
              Your {productLabel.toLowerCase()} has no image. Products with photos get more engagement from your team.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              variant="outline"
              disabled={isGenerating}
              onClick={async () => {
                const genParams = isPlateSpecType
                  ? {
                      productTable: 'plate_specs',
                      name: state.draft.name,
                      prepType: (state.draft as PlateSpecDraft).plateType,
                      description: (state.draft as PlateSpecDraft).menuCategory,
                      sessionId: state.sessionId || undefined,
                    }
                  : isCocktailType
                    ? {
                        productTable: 'cocktails',
                        name: state.draft.name,
                        prepType: (state.draft as CocktailDraft).style,
                        description: (state.draft as CocktailDraft).keyIngredients,
                        sessionId: state.sessionId || undefined,
                      }
                    : isWineType
                      ? {
                          productTable: 'wines',
                          name: state.draft.name,
                          prepType: (state.draft as WineDraft).style,
                          description: `${(state.draft as WineDraft).varietal} wine from ${(state.draft as WineDraft).region}`,
                          sessionId: state.sessionId || undefined,
                        }
                      : {
                          productTable: 'prep_recipes',
                          name: state.draft.name,
                          prepType: (state.draft as PrepRecipeDraft).prepType,
                          description: (state.draft as PrepRecipeDraft).tags.join(', '),
                          sessionId: state.sessionId || undefined,
                        };

                const result = await generateImage(genParams);
                if (result) {
                  if (isCocktailType) {
                    dispatch({ type: 'SET_COCKTAIL_IMAGE', payload: result.imageUrl });
                  } else if (isWineType) {
                    dispatch({ type: 'SET_WINE_IMAGE', payload: result.imageUrl });
                  } else {
                    // Both prep_recipe and plate_spec use images array via ADD_IMAGE
                    dispatch({
                      type: 'ADD_IMAGE',
                      payload: {
                        url: result.imageUrl,
                        alt: `AI-generated: ${state.draft.name}`,
                        caption: 'AI-generated placeholder',
                      },
                    });
                  }
                  toast({ title: 'AI image generated', description: 'Review the image before publishing' });
                  setShowNoImageWarning(false);
                }
              }}
            >
              {isGenerating
                ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                : <Sparkles className="h-4 w-4 mr-1.5" />}
              {isGenerating ? 'Generating...' : 'Generate AI Image'}
            </Button>
            <AlertDialogAction onClick={() => {
              setShowNoImageWarning(false);
              if (isPlateSpecType) {
                handlePublishPlateSpec(true);
              } else {
                handlePublish(true);
              }
            }}>
              Publish Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Stale translations publish warning */}
      <AlertDialog open={showStaleWarning} onOpenChange={setShowStaleWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Translations outdated
            </AlertDialogTitle>
            <AlertDialogDescription>
              Some Spanish translations are out of date because the English source text has changed. You can re-translate the stale fields before publishing.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowStaleWarning(false);
                handlePublish(false, true);
              }}
            >
              Publish Anyway
            </AlertDialogAction>
            <Button
              onClick={handleRetranslateAndPublish}
              disabled={isAutoTranslating}
              className="bg-orange-500 text-white hover:bg-orange-600"
            >
              {isAutoTranslating
                ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                : <Globe className="h-4 w-4 mr-1.5" />}
              {isAutoTranslating ? 'Translating...' : 'Re-translate & Publish'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

// =============================================================================
// Wrapped with provider
// =============================================================================

const IngestPage = () => (
  <IngestDraftProvider>
    <IngestPageInner />
  </IngestDraftProvider>
);

export default IngestPage;
