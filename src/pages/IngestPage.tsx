import { useState, useCallback, useEffect } from 'react';
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
import { IngestPreview } from '@/components/ingest/IngestPreview';
import { WineIngestPreview } from '@/components/ingest/WineIngestPreview';
import { CocktailIngestPreview } from '@/components/ingest/CocktailIngestPreview';
import { IngestDraftProvider, useIngestDraft } from '@/contexts/IngestDraftContext';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Save, Send, Trash2, Loader2, AlertTriangle, Sparkles } from 'lucide-react';
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
import { generateSlug, isPrepRecipeDraft, isWineDraft, isCocktailDraft } from '@/types/ingestion';
import type {
  ProductType,
  MobileMode,
  ChatMessage,
  PrepRecipeDraft,
  WineDraft,
  CocktailDraft,
  QueuedAttachment,
} from '@/types/ingestion';
import type { CocktailProcedureStep } from '@/types/products';

// =============================================================================
// Constants
// =============================================================================

/** Map activeType to Supabase table name */
const ACTIVE_TYPE_TABLE: Record<string, string> = {
  prep_recipe: 'prep_recipes',
  wine: 'wines',
  cocktail: 'cocktails',
};

/** Map activeType to cache query key */
const ACTIVE_TYPE_CACHE_KEY: Record<string, string> = {
  prep_recipe: 'recipes',
  wine: 'wines',
  cocktail: 'cocktails',
};

/** Map activeType to product label */
const ACTIVE_TYPE_LABEL: Record<string, string> = {
  prep_recipe: 'Recipe',
  wine: 'Wine',
  cocktail: 'Cocktail',
};

/** Map table name back to activeType */
const TABLE_TO_ACTIVE_TYPE: Record<string, ProductType> = {
  prep_recipes: 'prep_recipe',
  wines: 'wine',
  cocktails: 'cocktail',
};

/** Map table name to navigate path after publish */
const TABLE_NAVIGATE: Record<string, string> = {
  prep_recipes: '/recipes',
  wines: '/wines',
  cocktails: '/cocktails',
};

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
  const productTable = ACTIVE_TYPE_TABLE[state.activeType] || 'prep_recipes';
  const productLabel = ACTIVE_TYPE_LABEL[state.activeType] || 'Recipe';
  const cacheKey = ACTIVE_TYPE_CACHE_KEY[state.activeType] || 'recipes';

  const { sendMessage, isProcessing, error: chatError } = useIngestChat(productTable);
  const { session, createSession, loadSession, saveDraft } = useIngestionSession();

  const { sessionId, table, productId } = useParams<{ sessionId?: string; table?: string; productId?: string }>();

  const [isPublishing, setIsPublishing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showNoImageWarning, setShowNoImageWarning] = useState(false);
  const { generateImage, isGenerating } = useGenerateImage();

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
  // Save Draft
  // ---------------------------------------------------------------------------
  const handleSaveDraft = useCallback(async () => {
    if (!user) return;

    dispatch({ type: 'SET_IS_SAVING', payload: true });

    try {
      // Create session if none exists
      let currentSessionId = state.sessionId;
      if (!currentSessionId) {
        const newId = await createSession(productTable);
        if (!newId) {
          toast({ title: 'Error', description: 'Failed to create session' });
          return;
        }
        currentSessionId = newId;
        dispatch({ type: 'SET_SESSION_ID', payload: newId });
      }

      const ok = await saveDraft(state.draft, state.draftVersion);
      if (ok) {
        dispatch({ type: 'SET_DRAFT_VERSION', payload: state.draftVersion + 1 });
        dispatch({ type: 'SET_DIRTY', payload: false });
        toast({ title: 'Saved', description: 'Draft saved successfully' });
      }
    } catch (err) {
      console.error('Save draft error:', err);
      toast({ title: 'Error', description: 'Failed to save draft' });
    } finally {
      dispatch({ type: 'SET_IS_SAVING', payload: false });
    }
  }, [user, state.sessionId, state.draft, state.draftVersion, productTable, createSession, saveDraft, dispatch, toast]);

  // ---------------------------------------------------------------------------
  // Publish
  // ---------------------------------------------------------------------------
  const handlePublish = useCallback(async (skipImageWarning = false) => {
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

        // Update ingestion session
        if (state.sessionId) {
          await supabase
            .from('ingestion_sessions')
            .update({ status: 'published', product_id: newRowId, updated_at: new Date().toISOString() })
            .eq('id', state.sessionId);
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

        // Update ingestion session
        if (state.sessionId) {
          await supabase
            .from('ingestion_sessions')
            .update({ status: 'published', product_id: newRowId, updated_at: new Date().toISOString() })
            .eq('id', state.sessionId);
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

        // Update ingestion session status if one exists
        if (state.sessionId) {
          await supabase
            .from('ingestion_sessions')
            .update({ status: 'published', product_id: newRowId, updated_at: new Date().toISOString() })
            .eq('id', state.sessionId);
        }

        // Fire-and-forget: generate embedding
        supabase.functions.invoke('embed-products', {
          body: { table: 'prep_recipes', rowId: newRowId },
        }).catch(() => {});

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
  }, [user, state, productId, isWineType, isCocktailType, dispatch, toast, navigate, queryClient]);

  // Load session from URL params on mount
  useEffect(() => {
    if (sessionId && !state.sessionId) {
      loadSession(sessionId).then((result) => {
        if (result) {
          dispatch({ type: 'SET_SESSION_ID', payload: sessionId });

          // Set active type based on session's product table
          const activeType = TABLE_TO_ACTIVE_TYPE[result.session.productTable];
          if (activeType) {
            dispatch({ type: 'SET_ACTIVE_TYPE', payload: activeType });
          }

          // Restore draft from session
          if (result.session.draftData && result.session.draftData.name) {
            dispatch({ type: 'SET_DRAFT', payload: result.session.draftData });
            dispatch({ type: 'SET_DRAFT_VERSION', payload: result.session.draftVersion });
          }

          // Restore chat messages
          if (result.messages.length > 0) {
            dispatch({ type: 'SET_MESSAGES', payload: result.messages });
          }
        }
      });
    }
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Edit mode: load existing product and create edit session
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

          // Look for the original session that published this product
          // so we can load its conversation history
          const { data: origSession } = await supabase
            .from('ingestion_sessions')
            .select('id')
            .eq('product_id', productId)
            .eq('status', 'published')
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          // Load original conversation messages if found
          let historyMessages: ChatMessage[] = [];
          if (origSession) {
            const { data: msgRows } = await supabase
              .from('ingestion_messages')
              .select('id, role, content, draft_updates, created_at')
              .eq('session_id', origSession.id)
              .order('created_at', { ascending: true });

            historyMessages = (msgRows || [])
              .filter((m: any) => m.role === 'user' || m.role === 'assistant')
              .map((m: any) => ({
                id: m.id as string,
                role: m.role as 'user' | 'assistant',
                content: m.content as string,
                draftPreview: m.draft_updates || undefined,
                createdAt: m.created_at as string,
              }));
          }

          // Create an edit session
          const newSessionId = await createSession(table);
          if (newSessionId) {
            dispatch({ type: 'SET_SESSION_ID', payload: newSessionId });

            // Link edit session to the product being edited
            await supabase
              .from('ingestion_sessions')
              .update({ editing_product_id: productId })
              .eq('id', newSessionId);

            let draft: PrepRecipeDraft | WineDraft | CocktailDraft | null = null;

            if (table === 'prep_recipes' && data) {
              draft = {
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
            } else if (table === 'wines' && data) {
              draft = {
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
            } else if (table === 'cocktails' && data) {
              draft = {
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

            if (draft) {
              dispatch({ type: 'SET_DRAFT', payload: draft });

              // Sync draft to DB so the edge function can read it
              await supabase
                .from('ingestion_sessions')
                .update({
                  draft_data: draft as unknown,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', newSessionId);
            }

            // Load historical messages into chat panel
            if (historyMessages.length > 0) {
              dispatch({ type: 'SET_MESSAGES', payload: historyMessages });
              setHistoryMessageCount(historyMessages.length);
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

    let currentSessionId = state.sessionId;

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
        }
      }
    }
  }, [dispatch, sendMessage, uploadFile, uploadImage, state.sessionId]);

  // Determine if we have a draft worth showing
  const hasDraft = isCocktailType
    ? (state.draft as CocktailDraft).name !== ''
    : isWineType
      ? (state.draft as WineDraft).name !== ''
      : (state.draft as PrepRecipeDraft).name !== '' || (state.draft as PrepRecipeDraft).ingredients.length > 0;

  const isUploading = isFileUploading || isImageUploading;

  // Editor component based on active type
  const editorComponent = isCocktailType
    ? <CocktailEditor />
    : isWineType
      ? <WineEditor />
      : <PrepRecipeEditor />;

  // Preview component based on active type
  const previewComponent = (onSwitchToEdit: () => void) =>
    isCocktailType ? (
      <CocktailIngestPreview draft={state.draft as CocktailDraft} onSwitchToEdit={onSwitchToEdit} />
    ) : isWineType ? (
      <WineIngestPreview draft={state.draft as WineDraft} onSwitchToEdit={onSwitchToEdit} />
    ) : (
      <IngestPreview draft={state.draft as PrepRecipeDraft} onSwitchToEdit={onSwitchToEdit} />
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

  // Center toolbar: Save Draft + Publish (+ Delete in edit mode)
  const headerToolbar = hasDraft ? (
    <div className="flex items-center gap-2">
      {isEditMode && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              disabled={isDeleting || state.isSaving || isPublishing}
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
      <Button
        variant="outline"
        size="sm"
        onClick={handleSaveDraft}
        disabled={state.isSaving || isPublishing || !state.isDirty}
      >
        {state.isSaving
          ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          : <Save className="h-3.5 w-3.5 mr-1.5" />}
        Save Draft
      </Button>
      <Button
        size="sm"
        onClick={handlePublish}
        disabled={state.isSaving || isPublishing}
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
                const genParams = isCocktailType
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
              handlePublish(true);
            }}>
              Publish Anyway
            </AlertDialogAction>
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
