import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { AppShell } from '@/components/layout/AppShell';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import type { CategoryFilter, SortBy } from '@/components/ingest/BeerLiquorIngestList';
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
import { BeerLiquorIngestList } from '@/components/ingest/BeerLiquorIngestList';
import { BeerLiquorEditor } from '@/components/ingest/editor/BeerLiquorEditor';
import { useBatchIngest } from '@/hooks/use-batch-ingest';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Save, Send, Trash2, Loader2, AlertTriangle, Sparkles, Globe, Search, X, Check } from 'lucide-react';
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
import { derivePlateCategory, detectCocktailMood } from '@/lib/image-category-helpers';
import { useTranslateProduct } from '@/hooks/use-translate-product';
import { useTranslationPreferences } from '@/hooks/use-translation-preferences';
import { useProductTranslations, isTranslationStale } from '@/hooks/use-product-translations';
import { extractTranslatableTexts, getFieldValue } from '@/lib/translatable-fields';
import { generateSlug, isPrepRecipeDraft, isWineDraft, isCocktailDraft, isPlateSpecDraft, isBeerLiquorDraft, createEmptyPlateSpecDraft, createEmptyBeerLiquorDraft } from '@/types/ingestion';
import { validateSubRecipeRefs, validatePlateSpecComponentRefs } from '@/utils/validate-sub-recipe-refs';
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
  BeerLiquorDraft,
} from '@/types/ingestion';
import type { CocktailProcedureStep, PlateSpec, RecipeIngredientGroup } from '@/types/products';

// =============================================================================
// Constants
// =============================================================================

/** Map activeType to Supabase table name */
const ACTIVE_TYPE_TABLE: Record<string, string> = {
  prep_recipe: 'prep_recipes',
  bar_prep: 'prep_recipes',
  plate_spec: 'plate_specs',
  wine: 'wines',
  cocktail: 'cocktails',
  beer_liquor: 'beer_liquor_list',
};

/** Map activeType to cache query key */
const ACTIVE_TYPE_CACHE_KEY: Record<string, string> = {
  prep_recipe: 'recipes',
  bar_prep: 'bar-recipes',
  plate_spec: 'plate_specs',
  wine: 'wines',
  cocktail: 'cocktails',
  beer_liquor: 'beer-liquor',
};

/** Map activeType to product label */
const ACTIVE_TYPE_LABEL: Record<string, string> = {
  prep_recipe: 'Recipe',
  bar_prep: 'Bar Prep',
  plate_spec: 'Plate Spec',
  wine: 'Wine',
  cocktail: 'Cocktail',
  beer_liquor: 'Beer & Liquor',
};

/** Map table name back to activeType */
const TABLE_TO_ACTIVE_TYPE: Record<string, ProductType> = {
  prep_recipes: 'prep_recipe',
  plate_specs: 'plate_spec',
  wines: 'wine',
  cocktails: 'cocktail',
  beer_liquor_list: 'beer_liquor',
};

/** Map table name to navigate path after publish */
const TABLE_NAVIGATE: Record<string, string> = {
  prep_recipes: '/recipes',
  plate_specs: '/recipes',
  wines: '/wines',
  cocktails: '/cocktails',
  beer_liquor_list: '/beer-liquor',
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
      isFeatured: data.is_featured ?? false,
      images: row.images ?? [],
      dishGuide: null,         // loaded separately from foh_plate_specs
      dishGuideStale: false,
    } as PlateSpecDraft;
  }
  if (table === 'prep_recipes') {
    return {
      name: data.name || '',
      slug: data.slug || '',
      department: data.department || 'kitchen',
      prepType: data.prep_type || '',
      tags: data.tags || [],
      yieldQty: data.yield_qty || 0,
      yieldUnit: data.yield_unit || '',
      shelfLifeValue: data.shelf_life_value || 0,
      shelfLifeUnit: data.shelf_life_unit || '',
      ingredients: data.ingredients || [],
      procedure: data.procedure || [],
      batchScaling: data.batch_scaling || {},
      isFeatured: data.is_featured ?? false,
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
      isFeatured: data.is_featured ?? false,
    } as WineDraft;
  } else if (table === 'cocktails') {
    return {
      name: data.name || '',
      slug: data.slug || '',
      style: data.style || 'classic',
      glass: data.glass || '',
      ingredients: (data.ingredients as RecipeIngredientGroup[]) || [],
      keyIngredients: data.key_ingredients || '',
      procedure: (data.procedure as CocktailProcedureStep[]) || [],
      tastingNotes: data.tasting_notes || '',
      description: data.description || '',
      notes: data.notes || '',
      image: data.image || null,
      isTopSeller: data.is_top_seller ?? false,
      isFeatured: data.is_featured ?? false,
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
  // Chat panel is hidden below lg (1024px) via AppShell's `hidden lg:flex`.
  // Show mobile layout + floating tabs whenever the chat panel isn't visible.
  const [isBelowLg, setIsBelowLg] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 1023px)');
    const onChange = () => setIsBelowLg(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { state, dispatch } = useIngestDraft();

  // Derive product table from active type
  const isWineType = state.activeType === 'wine';
  const isCocktailType = state.activeType === 'cocktail';
  const isPlateSpecType = state.activeType === 'plate_spec';
  const isBarPrepType = state.activeType === 'bar_prep';
  const isPrepType = state.activeType === 'prep_recipe' || isBarPrepType;
  const isBeerLiquorType = state.activeType === 'beer_liquor';

  // Beer/Liquor — pending drafts (managed locally, outside IngestDraftContext)
  const [pendingBeerLiquorDrafts, setPendingBeerLiquorDrafts] = useState<BeerLiquorDraft[]>([]);
  const [editingBeerLiquorDraft, setEditingBeerLiquorDraft] = useState<BeerLiquorDraft | null>(null);
  const [publishingBeerLiquorTempId, setPublishingBeerLiquorTempId] = useState<string | null>(null);
  const [isPublishingAllDrafts, setIsPublishingAllDrafts] = useState(false);
  // Beer/Liquor — filter/sort state (controlled here, rendered in header toolbar)
  const [beerSearch, setBeerSearch] = useState('');
  const [beerCategoryFilter, setBeerCategoryFilter] = useState<CategoryFilter>('all');
  const [beerSortBy, setBeerSortBy] = useState<SortBy>('az');
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedPublishedIds, setSelectedPublishedIds] = useState<Set<string>>(new Set());
  // Tracks the most recently published item so the list can auto-expand + scroll it into view.
  // Clears itself after 1.5 s (after scroll animation) via a cleanup-safe useEffect.
  const [lastPublishedName, setLastPublishedName] = useState<string | null>(null);
  useEffect(() => {
    if (!lastPublishedName) return;
    const timer = setTimeout(() => setLastPublishedName(null), 1500);
    return () => clearTimeout(timer);
  }, [lastPublishedName]);
  const { publishItems } = useBatchIngest();
  const productTable = ACTIVE_TYPE_TABLE[state.activeType] || 'prep_recipes';
  const productLabel = ACTIVE_TYPE_LABEL[state.activeType] || 'Recipe';
  const cacheKey = ACTIVE_TYPE_CACHE_KEY[state.activeType] || 'recipes';
  const department = isBarPrepType ? 'bar' : undefined;

  const { sendMessage, isProcessing, error: chatError } = useIngestChat(productTable, department);
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
      // For plate_specs: delete the linked foh_plate_specs row BEFORE deleting
      // the plate_specs row. The FK cascade (or SET NULL) fires the moment
      // plate_specs is deleted, so the lookup by plate_spec_id must come first.
      if (table === 'plate_specs') {
        await supabase.from('foh_plate_specs').delete().eq('plate_spec_id', productId);
        queryClient.invalidateQueries({ queryKey: ['dishes'] });
      }

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
  // Beer/Liquor — Publish single pending draft
  // ---------------------------------------------------------------------------
  const handlePublishBeerLiquorDraft = useCallback(async (draft: BeerLiquorDraft) => {
    setPublishingBeerLiquorTempId(draft._tempId);
    await publishItems([draft], null, (tempId, status) => {
      if (status === 'published') {
        setPendingBeerLiquorDrafts((prev) => prev.filter((d) => d._tempId !== tempId));
        setLastPublishedName(draft.name);   // triggers auto-expand + scroll in the list
        setBeerSortBy('recent');            // newest item lands at top
        toast({ title: 'Published', description: `"${draft.name}" added to the list` });
      } else {
        toast({ title: 'Error', description: `Failed to publish "${draft.name}"`, variant: 'destructive' });
      }
    });
    setPublishingBeerLiquorTempId(null);
  }, [publishItems, toast]);

  // ---------------------------------------------------------------------------
  // Beer/Liquor — Publish ALL pending drafts
  // ---------------------------------------------------------------------------
  const handlePublishAllBeerLiquorDrafts = useCallback(async () => {
    if (!pendingBeerLiquorDrafts.length) return;
    const count = pendingBeerLiquorDrafts.length;
    setIsPublishingAllDrafts(true);
    await publishItems(pendingBeerLiquorDrafts, null, (tempId, status) => {
      if (status === 'published') {
        setPendingBeerLiquorDrafts((prev) => prev.filter((d) => d._tempId !== tempId));
      }
    });
    setIsPublishingAllDrafts(false);
    setBeerSortBy('recent');
    toast({
      title: 'Published',
      description: `${count} item${count !== 1 ? 's' : ''} added to the list`,
    });
  }, [pendingBeerLiquorDrafts, publishItems, toast]);

  // ---------------------------------------------------------------------------
  // Beer/Liquor — Bulk delete SELECTED published items
  // ---------------------------------------------------------------------------
  const handleBulkDeleteSelected = useCallback(async () => {
    const ids = Array.from(selectedPublishedIds);
    if (ids.length === 0) return;
    try {
      const { error } = await supabase
        .from('beer_liquor_list')
        .delete()
        .in('id', ids);
      if (error) throw error;
      await queryClient.refetchQueries({ queryKey: ['beer-liquor'] });
      setSelectedPublishedIds(new Set());
      setIsSelectMode(false);
      toast({
        title: 'Deleted',
        description: `${ids.length} item${ids.length !== 1 ? 's' : ''} removed from the list`,
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to delete items',
        variant: 'destructive',
      });
    }
  }, [selectedPublishedIds, queryClient, toast]);

  const handleToggleSelectPublished = useCallback((id: string) => {
    setSelectedPublishedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleExitSelectMode = useCallback(() => {
    setIsSelectMode(false);
    setSelectedPublishedIds(new Set());
  }, []);

  // ---------------------------------------------------------------------------
  // Save Draft
  // ---------------------------------------------------------------------------
  // Guard: prevents two concurrent saves racing each other (→ PGRST116 conflicts)
  const isSavingInProgressRef = useRef(false);
  // Guard: prevents double-publish race condition — useRef is synchronous unlike useState
  const publishLockRef = useRef(false);
  // Debounce timer for auto-save
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSaveDraft = useCallback(async (draftOverride?: PrepRecipeDraft | WineDraft | CocktailDraft | PlateSpecDraft) => {
    if (!user) return;
    if (isSavingInProgressRef.current) return; // skip if a save is already in-flight

    isSavingInProgressRef.current = true;
    dispatch({ type: 'SET_IS_SAVING', payload: true });

    try {
      // Create session if none exists (use URL sessionId as fallback)
      let currentSessionId = state.sessionId || sessionId || null;
      if (!currentSessionId) {
        // In edit mode the edit-mode useEffect is still initializing the session.
        // Return early to avoid creating an orphan session — the useEffect will
        // dispatch SET_SESSION_ID and the next auto-save will succeed.
        if (table && productId) return;

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
      // Always trust DB version — the edge function may have reset it during extraction.
      let version = state.draftVersion;
      if (!session || session.id !== currentSessionId) {
        const loaded = await loadSession(currentSessionId);
        if (loaded) {
          version = loaded.session.draftVersion;
        }
      }

      const ok = await saveDraft(draftOverride ?? state.draft, version);
      if (ok) {
        dispatch({ type: 'SET_DRAFT_VERSION', payload: version + 1 });
        dispatch({ type: 'SET_DIRTY', payload: false });
        // No success toast — auto-save is silent by design
      } else {
        // saveDraft returned false (PGRST116 conflict or error).
        // Re-load session to get DB's authoritative version and sync the reducer,
        // so the next auto-save uses the correct version without another conflict toast.
        const fresh = await loadSession(currentSessionId);
        if (fresh) {
          dispatch({ type: 'SET_DRAFT_VERSION', payload: fresh.session.draftVersion });
        }
      }
    } catch (err) {
      console.error('Save draft error:', err);
      toast({ title: 'Error', description: 'Failed to save draft' });
    } finally {
      isSavingInProgressRef.current = false;
      dispatch({ type: 'SET_IS_SAVING', payload: false });
    }
  }, [user, state.sessionId, sessionId, table, productId, state.draft, state.draftVersion, session, productTable, createSession, loadSession, saveDraft, dispatch, toast]);

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
  // Auto-save — debounced 1.5 s after the last draft change.
  // Fires once the user pauses, never mid-keystroke.
  // Paused while AI pipeline is processing to avoid version conflicts.
  // The concurrent-save guard in handleSaveDraft prevents any overlapping saves.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);

    if (!state.isDirty || isPublishing || isProcessing) return;

    autoSaveTimerRef.current = setTimeout(() => {
      handleSaveDraft();
    }, 1_500);

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [state.draft, state.isDirty, isPublishing, isProcessing, handleSaveDraft]);

  // ---------------------------------------------------------------------------
  // Warn user before leaving with unsaved changes
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const hasPending = pendingBeerLiquorDrafts.length > 0;
    if (!state.isDirty && !hasPending) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [state.isDirty, pendingBeerLiquorDrafts]);

  // ---------------------------------------------------------------------------
  // Keyboard shortcuts: Ctrl/Cmd+S → save draft, Escape → back to chat (mobile)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl+S / Cmd+S → save draft
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (state.isDirty && state.sessionId && !isPublishing && !isProcessing) {
          handleSaveDraft();
        }
      }
      // Escape → return to chat mode on mobile, close any open dialog
      if (e.key === 'Escape') {
        if (state.mobileMode !== 'chat') {
          dispatch({ type: 'SET_MOBILE_MODE', payload: 'chat' });
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [state.isDirty, state.sessionId, state.mobileMode, isPublishing, isProcessing, handleSaveDraft, dispatch]);

  // ---------------------------------------------------------------------------
  // Publish
  // ---------------------------------------------------------------------------
  const handlePublish = useCallback(async (skipImageWarning = false, skipStaleWarning = false) => {
    if (!user) return;
    // Synchronous guard — React setState is async so isPublishing state alone cannot prevent
    // a second click from entering the handler before the first re-render completes.
    if (publishLockRef.current) return;
    publishLockRef.current = true;
    try {

    // Use context editingProductId (set when loading a session) with URL param fallback
    const effectiveProductId = state.editingProductId || productId;

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

      // Staleness gate: check if existing translations are stale (edit mode only)
      if (effectiveProductId && !skipStaleWarning) {
        const dbData = {
          tasting_notes: wd.tastingNotes,
          producer_notes: wd.producerNotes,
          notes: wd.notes,
        };
        const { data: existingTranslations } = await supabase
          .from('product_translations')
          .select('field_path, source_text')
          .eq('product_table', 'wines')
          .eq('product_id', effectiveProductId);

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

          if (!existing || (effectiveProductId && existing.id === effectiveProductId)) {
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
          is_featured: wd.isFeatured,
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

        if (effectiveProductId) {
          const { data: existingRow } = await supabase
            .from('wines')
            .select('version')
            .eq('id', effectiveProductId)
            .single();

          const { data: updated, error: updateErr } = await supabase
            .from('wines')
            .update({ ...row, version: (existingRow?.version ?? 0) + 1 })
            .eq('id', effectiveProductId)
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

        // Fire-and-forget: auto-translate on first publish (new wine, no existing translations)
        if (!effectiveProductId) {
          const wineDbData = {
            tasting_notes: wd.tastingNotes,
            producer_notes: wd.producerNotes,
            notes: wd.notes,
          };
          const texts = extractTranslatableTexts('wines', wineDbData);
          if (texts.length > 0) {
            translateFields(
              'wines',
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
                saveTranslations('wines', newRowId, merged).catch(() => {});
              }
            }).catch(() => {});
          }
        }

        await queryClient.refetchQueries({ queryKey: ['wines'] });
        dispatch({ type: 'RESET_DRAFT' });

        toast({
          title: effectiveProductId ? 'Updated' : 'Published',
          description: `"${wd.name}" has been ${effectiveProductId ? 'updated' : 'published'} successfully`,
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
      if (!cd.ingredients.length || !cd.ingredients.some(g => g.items.length > 0)) {
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

      // Staleness gate: check if existing translations are stale (edit mode only)
      if (effectiveProductId && !skipStaleWarning) {
        const dbData = {
          procedure: cd.procedure,
          tasting_notes: cd.tastingNotes,
          description: cd.description,
          notes: cd.notes,
        };
        const { data: existingTranslations } = await supabase
          .from('product_translations')
          .select('field_path, source_text')
          .eq('product_table', 'cocktails')
          .eq('product_id', effectiveProductId);

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

          if (!existing || (effectiveProductId && existing.id === effectiveProductId)) {
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
          is_featured: cd.isFeatured,
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

        if (effectiveProductId) {
          const { data: existingRow } = await supabase
            .from('cocktails')
            .select('version')
            .eq('id', effectiveProductId)
            .single();

          const { data: updated, error: updateErr } = await supabase
            .from('cocktails')
            .update({ ...row, version: (existingRow?.version ?? 0) + 1 })
            .eq('id', effectiveProductId)
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
        const pubSessionId = state.sessionId || sessionId;
        if (pubSessionId) {
          const { error: sessErr } = await supabase
            .from('ingestion_sessions')
            .update({
              status: 'published',
              product_id: newRowId,
              editing_product_id: null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', pubSessionId);

          if (sessErr) console.error('Failed to mark session published:', sessErr);

          // Backlink: set source_session_id on product row
          await supabase
            .from('cocktails')
            .update({ source_session_id: pubSessionId })
            .eq('id', newRowId);
        } else {
          console.warn('No sessionId at cocktail publish time — session will remain as drafting');
        }

        // Fire-and-forget: generate embedding
        supabase.functions.invoke('embed-products', {
          body: { table: 'cocktails', rowId: newRowId },
        }).catch(() => {});

        // Fire-and-forget: auto-translate on first publish (new cocktail, no existing translations)
        if (!effectiveProductId) {
          const cocktailDbData = {
            procedure: cd.procedure,
            tasting_notes: cd.tastingNotes,
            description: cd.description,
            notes: cd.notes,
          };
          const texts = extractTranslatableTexts('cocktails', cocktailDbData);
          if (texts.length > 0) {
            translateFields(
              'cocktails',
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
                saveTranslations('cocktails', newRowId, merged).catch(() => {});
              }
            }).catch(() => {});
          }
        }

        await queryClient.refetchQueries({ queryKey: ['cocktails'] });
        dispatch({ type: 'RESET_DRAFT' });

        toast({
          title: effectiveProductId ? 'Updated' : 'Published',
          description: `"${cd.name}" has been ${effectiveProductId ? 'updated' : 'published'} successfully`,
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
      if (effectiveProductId && !skipStaleWarning) {
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
          .eq('product_id', effectiveProductId);

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
          if (!existing || (effectiveProductId && existing.id === effectiveProductId)) {
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
          department: rd.department,
          prep_type: rd.prepType,
          is_featured: rd.isFeatured,
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

        if (effectiveProductId) {
          const { data: existingRow } = await supabase
            .from('prep_recipes')
            .select('version')
            .eq('id', effectiveProductId)
            .single();

          const { data: updated, error: updateErr } = await supabase
            .from('prep_recipes')
            .update({ ...row, version: (existingRow?.version ?? 0) + 1 })
            .eq('id', effectiveProductId)
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
        if (!effectiveProductId) {
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

        // Refetch cache so /recipes page picks up new row before navigation
        await queryClient.refetchQueries({ queryKey: [cacheKey] });

        dispatch({ type: 'RESET_DRAFT' });

        toast({
          title: effectiveProductId ? 'Updated' : 'Published',
          description: `"${rd.name}" has been ${effectiveProductId ? 'updated' : 'published'} successfully`,
        });

        navigate(isBarPrepType ? '/cocktails?tab=bar-prep' : '/recipes');
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

    } finally {
      publishLockRef.current = false;
    }
  }, [user, state, productId, isWineType, isCocktailType, cacheKey, dispatch, toast, navigate, queryClient, getActiveCategories, translateFields, saveTranslations]);

  // ---------------------------------------------------------------------------
  // Publish: Plate Spec (+ optional Dish Guide)
  // ---------------------------------------------------------------------------
  const handlePublishPlateSpec = useCallback(async (skipImageWarning = false, skipStaleWarning = false) => {
    console.log('[publish] handlePublishPlateSpec called', { skipImageWarning, skipStaleWarning, hasUser: !!user });
    if (!user) return;
    // Synchronous guard — React setState is async so isPublishing state alone cannot prevent
    // a second click from entering the handler before the first re-render completes.
    if (publishLockRef.current) return;
    publishLockRef.current = true;
    try {

    // Use context editingProductId (set when loading a session) with URL param fallback
    const effectiveProductId = state.editingProductId || productId;

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

    // --- Validate component prep_recipe_ref slugs ---
    const compRefResult = await validatePlateSpecComponentRefs(
      ps.components,
      ps.slug || undefined,
    );
    if (!compRefResult.valid) {
      toast({
        title: 'Invalid sub-recipe references',
        description: `These component refs don't match any published recipe: ${compRefResult.danglingRefs.join(', ')}`,
      });
      setIsPublishing(false);
      return;
    }

    // --- FOH Plate Spec guards ---
    if (!ps.dishGuide) {
      // No FOH exists — auto-generate
      console.log('[publish] No dish guide — attempting auto-generation…');
      const fohResult = await generateDishGuide(ps, state.sessionId);
      if (fohResult) {
        // Copy BOH first image as FOH thumbnail
        if (!fohResult.image && ps.images.length > 0) {
          fohResult.image = ps.images[0].url;
        }
        dispatch({ type: 'SET_DISH_GUIDE', payload: fohResult });
        toast({
          title: 'FOH Plate Spec generated',
          description: 'Please review the FOH Plate Spec before publishing.',
        });
        return; // Pause so user can review the generated guide
      }
      // Generation failed — continue publishing without dish guide
      console.warn('[publish] Dish guide generation failed — publishing plate spec without FOH guide');
    }

    if (ps.dishGuide && ps.dishGuideStale) {
      toast({
        title: 'FOH Plate Spec needs update',
        description: 'The BOH Plate Spec has changed. Regenerate the FOH Plate Spec before publishing.',
      });
      return;
    }

    // --- FOH Plate Spec field validation ---
    if (ps.dishGuide) {
      const dg = ps.dishGuide;
      if (!dg.menuName?.trim()) {
        toast({ title: 'Missing field', description: 'Dish guide menu name is required' });
        return;
      }
      if (!dg.shortDescription?.trim()) {
        toast({ title: 'Missing field', description: 'Dish guide short description is required' });
        return;
      }
      if (!dg.detailedDescription?.trim()) {
        toast({ title: 'Missing field', description: 'Dish guide detailed description is required' });
        return;
      }
    }

    // Staleness gate: check if existing translations are stale (edit mode only)
    if (effectiveProductId && !skipStaleWarning) {
      let hasStale = false;

      // Check BOH plate_specs translations
      const bohDbData = {
        assembly_procedure: ps.assemblyProcedure,
        notes: ps.notes,
      };
      const { data: bohTranslations } = await supabase
        .from('product_translations')
        .select('field_path, source_text')
        .eq('product_table', 'plate_specs')
        .eq('product_id', effectiveProductId);

      if (bohTranslations && bohTranslations.length > 0) {
        hasStale = bohTranslations.some((t) => {
          const currentText = getFieldValue(bohDbData, t.field_path);
          return currentText !== null && t.source_text !== currentText;
        });
      }

      // Check FOH foh_plate_specs translations (if dish guide exists)
      if (!hasStale && ps.dishGuide) {
        const { data: existingDg } = await supabase
          .from('foh_plate_specs')
          .select('id')
          .eq('plate_spec_id', effectiveProductId)
          .maybeSingle();

        if (existingDg) {
          const fohDbData = {
            short_description: ps.dishGuide.shortDescription,
            detailed_description: ps.dishGuide.detailedDescription,
            notes: ps.dishGuide.notes,
          };
          const { data: fohTranslations } = await supabase
            .from('product_translations')
            .select('field_path, source_text')
            .eq('product_table', 'foh_plate_specs')
            .eq('product_id', existingDg.id);

          if (fohTranslations && fohTranslations.length > 0) {
            hasStale = fohTranslations.some((t) => {
              const currentText = getFieldValue(fohDbData, t.field_path);
              return currentText !== null && t.source_text !== currentText;
            });
          }
        }
      }

      if (hasStale) {
        setShowStaleWarning(true);
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

        if (!existing || (effectiveProductId && existing.id === effectiveProductId)) {
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
        is_featured: ps.isFeatured,
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
      if (effectiveProductId) {
        const { data: existingRow } = await supabase
          .from('plate_specs')
          .select('version')
          .eq('id', effectiveProductId)
          .single();

        const { data: updated, error: updateErr } = await supabase
          .from('plate_specs')
          .update({ ...plateSpecRow, version: (existingRow?.version ?? 0) + 1 })
          .eq('id', effectiveProductId)
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

          const dgSlug = generateSlug(dg.menuName || ps.name);

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
              is_featured: dg.isFeatured,
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

            // Step 1: Check by plate_spec_id (edit mode)
            let existingDg: { id: string; version: number | null } | null = null;
            if (effectiveProductId) {
              const { data } = await supabase
                .from('foh_plate_specs')
                .select('id, version')
                .eq('plate_spec_id', effectiveProductId)
                .maybeSingle();
              existingDg = data;
            }

            // Step 2: If not found by plate_spec_id, check by menu_name (catches re-ingestions)
            if (!existingDg) {
              const { data } = await supabase
                .from('foh_plate_specs')
                .select('id, version')
                .eq('menu_name', dg.menuName)
                .eq('status', 'published')
                .maybeSingle();
              existingDg = data;
            }

            if (existingDg) {
              // UPDATE existing dish guide (increment version)
              const { data: updatedDg, error: updateDgErr } = await supabase
                .from('foh_plate_specs')
                .update({ ...dishGuideRow, version: (existingDg.version ?? 0) + 1 })
                .eq('id', existingDg.id)
                .select('id')
                .single();

              if (updateDgErr) throw new Error(updateDgErr.message);
              if (updatedDg) dishGuideId = updatedDg.id;
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

      // --- Fire-and-forget: auto-translate on first publish ---
      if (!effectiveProductId) {
        // BOH plate_specs translation
        const bohDbData = {
          assembly_procedure: ps.assemblyProcedure,
          notes: ps.notes,
        };
        const bohTexts = extractTranslatableTexts('plate_specs', bohDbData);
        if (bohTexts.length > 0) {
          translateFields(
            'plate_specs',
            plateSpecId,
            bohTexts.map((t) => ({ fieldPath: t.fieldPath, sourceText: t.sourceText })),
          ).then((results) => {
            if (results.length > 0) {
              const merged = results.map((r) => {
                const source = bohTexts.find((t) => t.fieldPath === r.fieldPath);
                return {
                  fieldPath: r.fieldPath,
                  sourceText: source?.sourceText ?? '',
                  translatedText: r.translatedText,
                };
              });
              saveTranslations('plate_specs', plateSpecId, merged).catch(() => {});
            }
          }).catch(() => {});
        }

        // FOH foh_plate_specs translation
        if (dishGuideId && ps.dishGuide) {
          const fohDbData = {
            short_description: ps.dishGuide.shortDescription,
            detailed_description: ps.dishGuide.detailedDescription,
            notes: ps.dishGuide.notes,
          };
          const fohTexts = extractTranslatableTexts('foh_plate_specs', fohDbData);
          if (fohTexts.length > 0) {
            translateFields(
              'foh_plate_specs',
              dishGuideId,
              fohTexts.map((t) => ({ fieldPath: t.fieldPath, sourceText: t.sourceText })),
            ).then((results) => {
              if (results.length > 0) {
                const merged = results.map((r) => {
                  const source = fohTexts.find((t) => t.fieldPath === r.fieldPath);
                  return {
                    fieldPath: r.fieldPath,
                    sourceText: source?.sourceText ?? '',
                    translatedText: r.translatedText,
                  };
                });
                saveTranslations('foh_plate_specs', dishGuideId!, merged).catch(() => {});
              }
            }).catch(() => {});
          }
        }
      }

      // --- Refetch caches before navigation ---
      await queryClient.refetchQueries({ queryKey: ['plate_specs'] });
      await queryClient.refetchQueries({ queryKey: ['recipes'] });
      if (dishGuideId) {
        await queryClient.refetchQueries({ queryKey: ['dishes'] });
      }

      dispatch({ type: 'RESET_DRAFT' });

      toast({
        title: effectiveProductId ? 'Updated' : 'Published',
        description: `"${ps.name}" has been ${effectiveProductId ? 'updated' : 'published'} successfully${dishGuideId ? ' (with dish guide)' : ''}`,
      });

      navigate(isBarPrepType ? '/cocktails?tab=bar-prep' : '/recipes');
    } catch (err) {
      console.error('Publish error:', err);
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to publish plate spec',
      });
    } finally {
      setIsPublishing(false);
    }

    } finally {
      publishLockRef.current = false;
    }
  }, [user, state, productId, dispatch, toast, navigate, queryClient, generateDishGuide, handleSaveDraft, translateFields, saveTranslations]);

  // ---------------------------------------------------------------------------
  // Re-translate stale fields and then publish
  // ---------------------------------------------------------------------------
  const handleRetranslateAndPublish = useCallback(async () => {
    const effectiveProductId = state.editingProductId || productId;
    if (!effectiveProductId || isPublishing) return;

    // 1. Close the stale warning dialog immediately
    setShowStaleWarning(false);

    try {
      if (isPlateSpecType) {
        const ps = state.draft as PlateSpecDraft;

        // --- BOH plate_specs re-translation ---
        const bohDbData = {
          assembly_procedure: ps.assemblyProcedure,
          notes: ps.notes,
        };
        const bohTexts = extractTranslatableTexts('plate_specs', bohDbData);
        if (bohTexts.length > 0) {
          const bohResults = await translateFields(
            'plate_specs',
            effectiveProductId,
            bohTexts.map((t) => ({ fieldPath: t.fieldPath, sourceText: t.sourceText })),
          );
          if (bohResults.length > 0) {
            const bohMerged = bohResults.map((r) => {
              const source = bohTexts.find((t) => t.fieldPath === r.fieldPath);
              return {
                fieldPath: r.fieldPath,
                sourceText: source?.sourceText ?? '',
                translatedText: r.translatedText,
              };
            });
            await saveTranslations('plate_specs', effectiveProductId, bohMerged);
          }
        }

        // --- FOH foh_plate_specs re-translation (if dish guide exists) ---
        if (ps.dishGuide) {
          const { data: existingDg } = await supabase
            .from('foh_plate_specs')
            .select('id')
            .eq('plate_spec_id', effectiveProductId)
            .maybeSingle();

          if (existingDg) {
            const fohDbData = {
              short_description: ps.dishGuide.shortDescription,
              detailed_description: ps.dishGuide.detailedDescription,
              notes: ps.dishGuide.notes,
            };
            const fohTexts = extractTranslatableTexts('foh_plate_specs', fohDbData);
            if (fohTexts.length > 0) {
              const fohResults = await translateFields(
                'foh_plate_specs',
                existingDg.id,
                fohTexts.map((t) => ({ fieldPath: t.fieldPath, sourceText: t.sourceText })),
              );
              if (fohResults.length > 0) {
                const fohMerged = fohResults.map((r) => {
                  const source = fohTexts.find((t) => t.fieldPath === r.fieldPath);
                  return {
                    fieldPath: r.fieldPath,
                    sourceText: source?.sourceText ?? '',
                    translatedText: r.translatedText,
                  };
                });
                await saveTranslations('foh_plate_specs', existingDg.id, fohMerged);
              }
            }
          }
        }

        // 3. Publish with skipStaleWarning to avoid re-triggering
        await handlePublishPlateSpec(false, true);
      } else if (isWineType) {
        const wd = state.draft as WineDraft;
        const dbData = {
          tasting_notes: wd.tastingNotes,
          producer_notes: wd.producerNotes,
          notes: wd.notes,
        };
        const texts = extractTranslatableTexts('wines', dbData);
        if (texts.length > 0) {
          const results = await translateFields(
            'wines',
            effectiveProductId,
            texts.map((t) => ({ fieldPath: t.fieldPath, sourceText: t.sourceText })),
          );
          if (results.length > 0) {
            const merged = results.map((r) => {
              const source = texts.find((t) => t.fieldPath === r.fieldPath);
              return {
                fieldPath: r.fieldPath,
                sourceText: source?.sourceText ?? '',
                translatedText: r.translatedText,
              };
            });
            await saveTranslations('wines', effectiveProductId, merged);
          }
        }

        await handlePublish(false, true);
      } else if (isCocktailType) {
        const cd = state.draft as CocktailDraft;
        const dbData = {
          procedure: cd.procedure,
          tasting_notes: cd.tastingNotes,
          description: cd.description,
          notes: cd.notes,
        };
        const texts = extractTranslatableTexts('cocktails', dbData);
        if (texts.length > 0) {
          const results = await translateFields(
            'cocktails',
            effectiveProductId,
            texts.map((t) => ({ fieldPath: t.fieldPath, sourceText: t.sourceText })),
          );
          if (results.length > 0) {
            const merged = results.map((r) => {
              const source = texts.find((t) => t.fieldPath === r.fieldPath);
              return {
                fieldPath: r.fieldPath,
                sourceText: source?.sourceText ?? '',
                translatedText: r.translatedText,
              };
            });
            await saveTranslations('cocktails', effectiveProductId, merged);
          }
        }

        await handlePublish(false, true);
      } else {
        // Prep recipe — respect category preferences (same as first-publish path)
        const rd = state.draft as PrepRecipeDraft;
        const dbData = {
          name: rd.name,
          ingredients: rd.ingredients,
          procedure: rd.procedure,
          training_notes: rd.trainingNotes,
        };
        const categories = getActiveCategories('prep_recipes');
        const texts = categories.size > 0
          ? extractTranslatableTexts('prep_recipes', dbData, categories)
          : extractTranslatableTexts('prep_recipes', dbData);
        if (texts.length > 0) {
          const results = await translateFields(
            'prep_recipes',
            effectiveProductId,
            texts.map((t) => ({ fieldPath: t.fieldPath, sourceText: t.sourceText })),
          );
          if (results.length > 0) {
            const merged = results.map((r) => {
              const source = texts.find((t) => t.fieldPath === r.fieldPath);
              return {
                fieldPath: r.fieldPath,
                sourceText: source?.sourceText ?? '',
                translatedText: r.translatedText,
              };
            });
            await saveTranslations('prep_recipes', effectiveProductId, merged);
          }
        }

        await handlePublish(false, true);
      }
    } catch (err) {
      console.error('Re-translate error:', err);
      toast({
        title: 'Translation failed',
        description: err instanceof Error ? err.message : 'Failed to re-translate. You can still use "Publish Anyway" to skip translation.',
      });
    }
  }, [user, state, productId, isPublishing, isWineType, isCocktailType, isPlateSpecType, translateFields, saveTranslations, getActiveCategories, toast, handlePublish, handlePublishPlateSpec]);

  // Load session from URL params on mount
  useEffect(() => {
    if (sessionId && !state.sessionId) {
      loadSession(sessionId).then(async (result) => {
        if (result) {
          dispatch({ type: 'SET_SESSION_ID', payload: sessionId });

          // Set active type based on session's product table
          // For prep_recipes, check department in draft data to distinguish bar_prep vs prep_recipe
          let activeType = TABLE_TO_ACTIVE_TYPE[result.session.productTable];
          if (result.session.productTable === 'prep_recipes' && result.session.draftData) {
            const dept = (result.session.draftData as any).department;
            if (dept === 'bar') activeType = 'bar_prep';
          }
          if (activeType) {
            dispatch({ type: 'SET_ACTIVE_TYPE', payload: activeType });
          }
          // SET_ACTIVE_TYPE resets sessionId to null — restore it immediately after
          dispatch({ type: 'SET_SESSION_ID', payload: sessionId });

          // Restore editing product ID if present on session
          const restoredProductId = result.session.editingProductId || result.session.productId;
          if (restoredProductId) {
            dispatch({ type: 'SET_EDITING_PRODUCT_ID', payload: restoredProductId });
          }

          // Restore draft from session
          if (result.session.draftData && result.session.draftData.name) {
            dispatch({ type: 'SET_DRAFT_VERSION', payload: result.session.draftVersion });
            dispatch({ type: 'SET_DRAFT', payload: result.session.draftData });
            dispatch({ type: 'SET_DIRTY', payload: false });

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
                  isFeatured: dishGuideRow.is_featured ?? false,
                };
                dispatch({ type: 'SET_DISH_GUIDE', payload: foh });
                dispatch({ type: 'SET_DIRTY', payload: false }); // SET_DISH_GUIDE sets isDirty — clear it after restore
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
          // For prep_recipes, check department to distinguish bar_prep vs prep_recipe
          let activeType = TABLE_TO_ACTIVE_TYPE[table];
          if (table === 'prep_recipes') {
            const dept = (data as any).department || 'kitchen';
            if (dept === 'bar') activeType = 'bar_prep';
          }
          if (activeType) {
            dispatch({ type: 'SET_ACTIVE_TYPE', payload: activeType });
          }

          const draft = buildDraftFromProduct(table, data);

          // Try to find an existing session for this product
          const existingSession = await findSessionForProduct(productId, table);

          let resolvedSessionId: string;
          let editDraftVersion = 1;

          if (existingSession) {
            // Load session's chat history
            const loadResult = await loadSession(existingSession.id);
            editDraftVersion = loadResult?.session.draftVersion ?? 1;

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
            dispatch({ type: 'SET_DRAFT_VERSION', payload: editDraftVersion });
            dispatch({ type: 'SET_DRAFT', payload: draft });
            dispatch({ type: 'SET_DIRTY', payload: false });
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
                isFeatured: dishGuideRow.is_featured ?? false,
              };
              dispatch({ type: 'SET_DISH_GUIDE', payload: foh });
              dispatch({ type: 'SET_DIRTY', payload: false }); // SET_DISH_GUIDE sets isDirty — clear it after restore
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

  const { uploadFile, isUploading: isFileUploading, error: fileError } = useFileUpload(productTable, department);
  const { uploadImage, isUploading: isImageUploading, error: imageError } = useImageUpload(productTable, department);

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
            if (isBeerLiquorType) {
              // Add or update pending card by name — prevents duplicate cards on follow-ups
              const aiDraft = result.draft as BeerLiquorDraft & { isDuplicate?: boolean };
              if (aiDraft.name?.trim()) {
                setPendingBeerLiquorDrafts((prev) => {
                  const existingIdx = prev.findIndex(
                    d => d.name.toLowerCase().trim() === aiDraft.name.toLowerCase().trim()
                  );
                  if (existingIdx >= 0) {
                    const updated = [...prev];
                    updated[existingIdx] = { ...prev[existingIdx], ...aiDraft, _tempId: prev[existingIdx]._tempId };
                    return updated;
                  }
                  return [...prev, {
                    ...createEmptyBeerLiquorDraft(),
                    ...aiDraft,
                    _tempId: crypto.randomUUID(),
                    rowStatus: aiDraft.isDuplicate ? 'duplicate_skipped' : 'pending',
                  }];
                });
              }
            } else {
              dispatch({ type: 'SET_DRAFT', payload: result.draft as PrepRecipeDraft | WineDraft | CocktailDraft | PlateSpecDraft });
            }

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

        // Sync draftVersion from server to prevent auto-save version conflicts
        if (chatResult.draftVersion != null) {
          dispatch({ type: 'SET_DRAFT_VERSION', payload: chatResult.draftVersion });
        }

        if (chatResult.draft) {
          // Beer/liquor drafts are managed locally — do NOT store in IngestDraftContext
          if (isBeerLiquorType) {
            // Add or update pending card by name — prevents duplicate cards on follow-ups
            const aiDraft = chatResult.draft as BeerLiquorDraft & { isDuplicate?: boolean };
            if (aiDraft.name?.trim()) {
              setPendingBeerLiquorDrafts((prev) => {
                const existingIdx = prev.findIndex(
                  d => d.name.toLowerCase().trim() === aiDraft.name.toLowerCase().trim()
                );
                if (existingIdx >= 0) {
                  const updated = [...prev];
                  updated[existingIdx] = { ...prev[existingIdx], ...aiDraft, _tempId: prev[existingIdx]._tempId };
                  return updated;
                }
                return [...prev, {
                  ...createEmptyBeerLiquorDraft(),
                  ...aiDraft,
                  _tempId: crypto.randomUUID(),
                  rowStatus: aiDraft.isDuplicate ? 'duplicate_skipped' : 'pending',
                }];
              });
            }
          } else {
            dispatch({ type: 'SET_DRAFT', payload: chatResult.draft as PrepRecipeDraft | WineDraft | CocktailDraft | PlateSpecDraft });
          }

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
  }, [dispatch, sendMessage, uploadFile, uploadImage, state.sessionId, sessionId, isPlateSpecType, isBeerLiquorType, generateDishGuide]);

  // Determine if we have a draft worth showing
  // Beer/liquor is always false — it uses its own pending cards UI, not the shared draft/editor
  const hasDraft = isBeerLiquorType
    ? false
    : isPlateSpecType
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

  // Desktop AI panel (chat docked on right — only when lg+ viewport)
  const aiPanel = !isBelowLg ? (
    <div className="flex flex-col h-full p-4">
      <div className="shrink-0 mb-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <img src="/images/tastly-isotope.svg" alt="Tastly" className="w-5 h-5 shrink-0 rounded-[4px]" />
          {isBarPrepType ? 'AI Bar Prep Builder' : `AI ${productLabel} Builder`}
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
  // Plate spec dish guide state
  const plateSpecDraft = isPlateSpecType ? (state.draft as PlateSpecDraft) : null;
  const canGenerateDishGuide = isPlateSpecType && plateSpecDraft
    && plateSpecDraft.name !== ''
    && (plateSpecDraft.components ?? []).length > 0
    && (plateSpecDraft.components ?? []).some(g => g.items && g.items.length > 0);
  const hasDishGuide = isPlateSpecType && plateSpecDraft?.dishGuide != null;
  const dishGuideStale = isPlateSpecType && plateSpecDraft?.dishGuideStale === true;

  // Left header: back button only
  const headerLeft = (
    <button
      type="button"
      onClick={handleExit}
      className={cn(
        'flex items-center justify-center shrink-0',
        'h-8 w-8 rounded-lg',
        'bg-orange-500 text-white',
        'hover:bg-orange-600 active:scale-[0.96]',
        'shadow-sm transition-all duration-150'
      )}
      title="Back to Ingestion Dashboard"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
    </button>
  );

  // Center toolbar: action buttons (when draft active) or beer/liquor filter bar
  const headerToolbar = isBeerLiquorType ? (
    <div className="flex items-center gap-1.5">
      {/* Category: All / Beer / Liquor */}
      <div className="inline-flex gap-0.5 rounded-lg bg-muted p-0.5">
        {(['all', 'Beer', 'Liquor'] as CategoryFilter[]).map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setBeerCategoryFilter(cat)}
            className={cn(
              'px-3 h-7 rounded-md text-xs font-semibold transition-colors',
              beerCategoryFilter === cat
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {cat === 'all' ? 'All' : cat}
          </button>
        ))}
      </div>
      {/* Sort: A–Z / Recent */}
      <div className="inline-flex gap-0.5 rounded-lg bg-muted p-0.5">
        {([['az', 'A–Z'], ['recent', 'Recent']] as [SortBy, string][]).map(([val, label]) => (
          <button
            key={val}
            type="button"
            onClick={() => setBeerSortBy(val)}
            className={cn(
              'px-3 h-7 rounded-md text-xs font-semibold transition-colors',
              beerSortBy === val
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <Input
          value={beerSearch}
          onChange={(e) => setBeerSearch(e.target.value)}
          placeholder="Search…"
          className="pl-8 pr-7 h-8 w-44 text-xs"
        />
        {beerSearch && (
          <button
            type="button"
            onClick={() => setBeerSearch('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      {/* Divider + Select Mode Controls */}
      <div className="h-5 border-l border-border/60" />

      {!isSelectMode ? (
        <div className="inline-flex rounded-lg bg-muted p-0.5">
          <button
            type="button"
            onClick={() => setIsSelectMode(true)}
            className="flex items-center gap-1.5 px-3 h-7 rounded-md text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Bulk Delete"
          >
            <Trash2 className="h-3.5 w-3.5 shrink-0" />
            <span className="whitespace-nowrap">Bulk Delete</span>
          </button>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={handleExitSelectMode}
            className="flex items-center gap-1 h-8 px-2.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Exit selection mode"
          >
            <X className="h-3.5 w-3.5" />
            Cancel
          </button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                type="button"
                disabled={selectedPublishedIds.size === 0}
                className="flex items-center gap-1 h-8 px-2.5 rounded-lg text-xs font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label={`Delete ${selectedPublishedIds.size} selected items`}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete ({selectedPublishedIds.size})
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Delete {selectedPublishedIds.size} item{selectedPublishedIds.size !== 1 ? 's' : ''}?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently removes the selected {selectedPublishedIds.size === 1 ? 'item' : 'items'} from the list. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleBulkDeleteSelected}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete {selectedPublishedIds.size === 1 ? 'Item' : 'Items'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  ) : hasDraft ? (
    /* Action buttons — centered in the header when a draft is active */
    <div className="flex items-center gap-1.5">
      {/* Delete (edit mode) */}
      {isEditMode && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              type="button"
              disabled={isDeleting || state.isSaving || isPublishing || isGeneratingDishGuide}
              className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-medium border border-border text-destructive hover:bg-destructive/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">Delete</span>
            </button>
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
      {/* Discard (new draft mode) */}
      {!isEditMode && state.sessionId && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              type="button"
              disabled={isDiscarding || state.isSaving || isPublishing || isGeneratingDishGuide}
              className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-medium border border-border text-destructive hover:bg-destructive/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {isDiscarding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">Discard</span>
            </button>
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
      {/* Generate FOH Plate Spec */}
      {isPlateSpecType && canGenerateDishGuide && (
        <button
          type="button"
          onClick={async () => {
            if (!plateSpecDraft) return;
            const result = await generateDishGuide(plateSpecDraft, state.sessionId);
            if (result) {
              if (!result.image && plateSpecDraft.images.length > 0) {
                result.image = plateSpecDraft.images[0].url;
              }
              dispatch({ type: 'SET_DISH_GUIDE', payload: result });
            }
          }}
          disabled={isGeneratingDishGuide || isPublishing || state.isSaving}
          className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-medium border border-border text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {isGeneratingDishGuide
            ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /><span className="hidden md:inline ml-1">Generating…</span></>
            : <><Sparkles className="h-3.5 w-3.5" /><span className="hidden md:inline ml-1">{hasDishGuide ? 'Regenerate' : 'Generate'} FOH</span></>
          }
        </button>
      )}
      {/* Save — three states: saving / dirty / clean */}
      <button
        type="button"
        onClick={handleSaveDraft}
        disabled={state.isSaving || isPublishing || isProcessing || !state.isDirty || isGeneratingDishGuide}
        className={cn(
          'flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-medium transition-colors',
          state.isSaving
            ? 'border border-border text-muted-foreground cursor-not-allowed'
            : state.isDirty
              ? 'border border-border text-foreground hover:bg-muted'
              : 'border border-transparent text-muted-foreground/60 cursor-default'
        )}
      >
        {state.isSaving
          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
          : !state.isDirty
            ? <Check className="h-3.5 w-3.5" />
            : <Save className="h-3.5 w-3.5" />
        }
        <span className="hidden sm:inline">
          {state.isSaving ? 'Saving…' : !state.isDirty ? 'Saved' : 'Save'}
        </span>
      </button>
      {/* Publish */}
      <button
        type="button"
        onClick={() => {
          if (isPlateSpecType) handlePublishPlateSpec();
          else handlePublish();
        }}
        disabled={state.isSaving || isPublishing || isGeneratingDishGuide}
        className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-medium bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {isPublishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
        <span className="hidden sm:inline">Publish</span>
      </button>
    </div>
  ) : undefined;

  return (
    <AppShell
      language={language}
      onLanguageChange={setLanguage}
      isAdmin={isAdmin}
      showSearch={false}
      aiPanel={aiPanel}
      constrainContentWidth
      overflow="auto"
      headerToolbar={headerToolbar}
      headerLeft={headerLeft}
    >
      <div className="space-y-4">
        {/* Beer/Liquor — list + chat layout */}
        {isBeerLiquorType ? (
          isBelowLg ? (
            <>
              {state.mobileMode === 'list' && (
                <BeerLiquorIngestList
                  pendingDrafts={pendingBeerLiquorDrafts}
                  onPublish={handlePublishBeerLiquorDraft}
                  onEdit={(draft) => setEditingBeerLiquorDraft(draft)}
                  onRemovePending={(tempId) =>
                    setPendingBeerLiquorDrafts((prev) => prev.filter((d) => d._tempId !== tempId))
                  }
                  isPublishing={publishingBeerLiquorTempId !== null}
                  publishingTempId={publishingBeerLiquorTempId}
                  search={beerSearch}
                  categoryFilter={beerCategoryFilter}
                  sortBy={beerSortBy}
                  lastPublishedName={lastPublishedName}
                  onPublishAll={handlePublishAllBeerLiquorDrafts}
                  onClearPending={() => setPendingBeerLiquorDrafts([])}
                  isPublishingAll={isPublishingAllDrafts}
                  isSelectMode={isSelectMode}
                  selectedPublishedIds={selectedPublishedIds}
                  onToggleSelect={handleToggleSelectPublished}
                />
              )}
              {state.mobileMode === 'chat' && chatContent}

              {/* Spacer */}
              <div className="h-14" aria-hidden="true" />

              {/* Floating 2-tab bar: List | Chat */}
              <div className="fixed bottom-[76px] md:bottom-3 inset-x-0 md:left-16 z-[60] flex justify-center px-4 md:px-6 pointer-events-none">
                <div className="w-full max-w-reading px-1 py-1 bg-muted/90 backdrop-blur-md rounded-2xl shadow-[0_2px_16px_rgba(0,0,0,0.15)] pointer-events-auto">
                  <MobileModeTabs
                    activeMode={state.mobileMode === 'list' || state.mobileMode === 'chat' ? state.mobileMode : 'list'}
                    onModeChange={(mode) => dispatch({ type: 'SET_MOBILE_MODE', payload: mode })}
                    modes={['list', 'chat']}
                  />
                </div>
              </div>
            </>
          ) : (
            /* Desktop: list in main area, chat in aiPanel (right rail via AppShell) */
            <BeerLiquorIngestList
              pendingDrafts={pendingBeerLiquorDrafts}
              onPublish={handlePublishBeerLiquorDraft}
              onEdit={(draft) => setEditingBeerLiquorDraft(draft)}
              onRemovePending={(tempId) =>
                setPendingBeerLiquorDrafts((prev) => prev.filter((d) => d._tempId !== tempId))
              }
              isPublishing={publishingBeerLiquorTempId !== null}
              publishingTempId={publishingBeerLiquorTempId}
              search={beerSearch}
              categoryFilter={beerCategoryFilter}
              sortBy={beerSortBy}
              lastPublishedName={lastPublishedName}
              onPublishAll={handlePublishAllBeerLiquorDrafts}
              onClearPending={() => setPendingBeerLiquorDrafts([])}
              isPublishingAll={isPublishingAllDrafts}
              isSelectMode={isSelectMode}
              selectedPublishedIds={selectedPublishedIds}
              onToggleSelect={handleToggleSelectPublished}
            />
          )
        ) : isBelowLg ? (
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

            {/* Spacer so content isn't hidden behind fixed floating tabs */}
            <div className="h-14" aria-hidden="true" />

            {/* Floating Mode Tabs — fixed above MobileTabBar on mobile, near bottom on md+ */}
            <div className="fixed bottom-[76px] md:bottom-3 inset-x-0 md:left-16 z-[60] flex justify-center px-4 md:px-6 pointer-events-none">
              <div className="w-full max-w-reading px-1 py-1 bg-muted/90 backdrop-blur-md rounded-2xl shadow-[0_2px_16px_rgba(0,0,0,0.15)] pointer-events-auto">
                <MobileModeTabs
                  activeMode={state.mobileMode}
                  onModeChange={(mode) => dispatch({ type: 'SET_MOBILE_MODE', payload: mode })}
                />
              </div>
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
          <AlertDialogFooter className="flex-col sm:flex-row sm:flex-wrap gap-2">
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
                      category: derivePlateCategory((state.draft as PlateSpecDraft).plateType, state.draft.name),
                      sessionId: state.sessionId || undefined,
                    }
                  : isCocktailType
                    ? {
                        productTable: 'cocktails',
                        name: state.draft.name,
                        prepType: (state.draft as CocktailDraft).style,
                        description: (state.draft as CocktailDraft).keyIngredients,
                        category: detectCocktailMood((state.draft as CocktailDraft).keyIngredients || ''),
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
          <AlertDialogFooter className="flex-col sm:flex-row sm:flex-wrap gap-2">
            <AlertDialogCancel disabled={isAutoTranslating}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isAutoTranslating}
              onClick={() => {
                setShowStaleWarning(false);
                if (isPlateSpecType) {
                  handlePublishPlateSpec(false, true);
                } else {
                  handlePublish(false, true);
                }
              }}
            >
              Publish Anyway
            </AlertDialogAction>
            <Button
              onClick={handleRetranslateAndPublish}
              disabled={isAutoTranslating || isPublishing}
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

      {/* Beer/Liquor Edit Sheet */}
      <Sheet open={editingBeerLiquorDraft !== null} onOpenChange={(open) => { if (!open) setEditingBeerLiquorDraft(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit Item</SheetTitle>
          </SheetHeader>
          {editingBeerLiquorDraft && (
            <div className="mt-4 space-y-4">
              <BeerLiquorEditor
                draft={editingBeerLiquorDraft}
                onChange={(updated) => {
                  setEditingBeerLiquorDraft(updated);
                  setPendingBeerLiquorDrafts((prev) =>
                    prev.map((d) => d._tempId === updated._tempId ? updated : d)
                  );
                }}
              />
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setEditingBeerLiquorDraft(null)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
                  disabled={publishingBeerLiquorTempId === editingBeerLiquorDraft._tempId}
                  onClick={async () => {
                    await handlePublishBeerLiquorDraft(editingBeerLiquorDraft);
                    setEditingBeerLiquorDraft(null);
                  }}
                >
                  {publishingBeerLiquorTempId === editingBeerLiquorDraft._tempId
                    ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    : <Send className="h-4 w-4 mr-2" />}
                  Publish
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
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
