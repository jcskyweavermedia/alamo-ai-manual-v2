import { useState, useCallback, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useSupabaseBeerLiquor } from '@/hooks/use-supabase-beer-liquor';
import { useDirectImageUpload } from '@/hooks/use-direct-image-upload';
import { useGenerateImage } from '@/hooks/use-generate-image';
import { deriveBeerLiquorCategory } from '@/lib/image-category-helpers';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Loader2,
  AlertCircle,
  Trash2,
  ChevronDown,
  Pencil,
  Send,
  Beer,
  Sparkles,
  Upload,
  Camera,
  Search,
  Copy,
} from 'lucide-react';
import type { BeerLiquorDraft } from '@/types/ingestion';
import type { BeerLiquorItem } from '@/types/products';

export type CategoryFilter = 'all' | 'Beer' | 'Liquor';
export type SortBy = 'az' | 'recent';

// =============================================================================
// Types
// =============================================================================

interface BeerLiquorIngestListProps {
  pendingDrafts: BeerLiquorDraft[];
  onPublish: (draft: BeerLiquorDraft) => void;
  onEdit: (draft: BeerLiquorDraft) => void;
  onRemovePending: (tempId: string) => void;
  isPublishing?: boolean;
  publishingTempId?: string | null;
  // Filter/sort — controlled from the header toolbar
  search: string;
  categoryFilter: CategoryFilter;
  sortBy: SortBy;
  // Name of the most recently published item — auto-expands its row + scrolls to top
  lastPublishedName?: string | null;
  onPublishAll: () => void;
  onClearPending: () => void;
  isPublishingAll?: boolean;
  isSelectMode?: boolean;
  selectedPublishedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
}

// =============================================================================
// Helpers
// =============================================================================

function groupByCategory(items: BeerLiquorItem[]): Map<string, BeerLiquorItem[]> {
  const map = new Map<string, BeerLiquorItem[]>();
  for (const item of items) {
    const key = item.category || 'Other';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return map;
}

const CATEGORY_EMOJI: Record<string, string> = {
  Beer: '🍺',
  Liquor: '🥃',
  Other: '🍶',
};

// =============================================================================
// Info card (mirrors BeerLiquorCardView style)
// =============================================================================

function InfoCard({
  emoji,
  label,
  value,
  emojiBg,
}: {
  emoji: string;
  label: string;
  value: string;
  emojiBg: string;
}) {
  return (
    <div className="relative rounded-xl bg-card shadow-sm p-4 pt-5 pr-16">
      <span className={cn(
        'absolute top-3 right-3 flex items-center justify-center',
        'w-9 h-9 rounded-full',
        emojiBg,
      )}>
        <span className="text-[18px] leading-[18px]">{emoji}</span>
      </span>
      <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1">
        {label}
      </h2>
      <p className="text-sm leading-relaxed text-foreground">{value}</p>
    </div>
  );
}

// =============================================================================
// Row — Published Item
// =============================================================================

function PublishedRow({
  item,
  onDelete,
  isDeleting,
  onImageSaved,
  defaultExpanded = false,
  isSelectMode = false,
  isSelected = false,
  onToggleSelect,
}: {
  item: BeerLiquorItem;
  onDelete: (id: string) => void;
  isDeleting: boolean;
  onImageSaved: () => void;
  defaultExpanded?: boolean;
  isSelectMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [localImage, setLocalImage] = useState<string | null>(item.image);
  const rowRef = useRef<HTMLDivElement>(null);

  // Scroll this specific row into view on first mount when it's the newly published item
  useEffect(() => {
    if (defaultExpanded) {
      rowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — only runs on mount

  const { uploadToStorage, isUploading } = useDirectImageUpload();
  const { generateImage, isGenerating } = useGenerateImage();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isBusy = isUploading || isGenerating;

  async function saveImageToDb(url: string) {
    const { error } = await supabase
      .from('beer_liquor_list')
      .update({ image: url })
      .eq('id', item.id);
    if (error) {
      toast({ title: 'Error', description: 'Could not save image', variant: 'destructive' });
      setLocalImage(item.image);
    } else {
      onImageSaved();
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const url = await uploadToStorage(file);
    if (url) {
      setLocalImage(url);
      await saveImageToDb(url);
    }
  }

  async function handleGenerateImage() {
    const result = await generateImage({
      productTable: 'beer_liquor_list',
      name: item.name,
      prepType: item.subcategory || item.category,
      description: item.description,
      category: deriveBeerLiquorCategory(item.category || '', item.subcategory || ''),
    });
    if (result?.imageUrl) {
      setLocalImage(result.imageUrl);
      await saveImageToDb(result.imageUrl);
    }
  }

  return (
    <div ref={rowRef} className={cn(isSelectMode && isSelected && 'bg-primary/5')}>
      {/* ── Collapsed header row ───────────────────────────────── */}
      <div
        className={cn(
          'flex items-center gap-2 py-3 px-3',
          isSelectMode && 'cursor-pointer select-none',
        )}
        onClick={isSelectMode ? () => onToggleSelect?.(item.id) : undefined}
        role={isSelectMode ? 'checkbox' : undefined}
        aria-checked={isSelectMode ? isSelected : undefined}
        aria-label={isSelectMode ? (isSelected ? `Deselect ${item.name}` : `Select ${item.name}`) : undefined}
      >
        {isSelectMode ? (
          /* Passive visual — clicks handled by the parent div */
          <span className="shrink-0 p-1 flex items-center justify-center pointer-events-none">
            <Checkbox
              checked={isSelected}
              aria-hidden="true"
              tabIndex={-1}
              className="pointer-events-none"
            />
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="shrink-0 p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            <ChevronDown className={cn('h-4 w-4 transition-transform duration-200', expanded && 'rotate-180')} />
          </button>
        )}

        {isSelectMode ? (
          /* Plain div — the outer div is the click target */
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate leading-snug">{item.name}</p>
            <p className="text-xs text-muted-foreground truncate">
              {item.subcategory || item.category}
              {item.producer ? ` · ${item.producer}` : ''}
              {item.country ? ` · ${item.country}` : ''}
            </p>
          </div>
        ) : (
          <button
            type="button"
            className="flex-1 min-w-0 text-left"
            onClick={() => setExpanded((v) => !v)}
          >
            <p className="text-sm font-semibold truncate leading-snug">{item.name}</p>
            <p className="text-xs text-muted-foreground truncate">
              {item.subcategory || item.category}
              {item.producer ? ` · ${item.producer}` : ''}
              {item.country ? ` · ${item.country}` : ''}
            </p>
          </button>
        )}

        {!isSelectMode && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                type="button"
                disabled={isDeleting}
                className="shrink-0 p-2.5 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                aria-label={`Delete ${item.name}`}
              >
                {isDeleting
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Trash2 className="h-4 w-4" />}
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete "{item.name}"?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently remove it from the list. You can always re-add it via the AI chat.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onDelete(item.id)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {/* ── Expanded card preview — suppressed in select mode ─── */}
      {!isSelectMode && expanded && (
        <div className="px-3 pb-4 pt-1 space-y-3 border-t border-border/50">

          {/* Badges */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className={cn(
              'inline-flex items-center rounded-full px-2.5 py-0.5',
              'text-[11px] font-bold uppercase tracking-wide',
              item.category === 'Beer'
                ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                : 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300'
            )}>
              {item.category}
            </span>
            {item.subcategory && (
              <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide bg-muted text-muted-foreground">
                {item.subcategory}
              </span>
            )}
          </div>

          {/* Producer · Country */}
          {(item.producer || item.country) && (
            <div className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
              {item.producer && <span>{item.producer}</span>}
              {item.producer && item.country && <span className="text-border">·</span>}
              {item.country && <span>{item.country}</span>}
            </div>
          )}

          <div className="border-t border-border" />

          {/* Row 1: Image + Description side-by-side */}
          <div className="flex gap-4 items-start">

            {/* Image — small portrait, action buttons overlaid */}
            <div className="shrink-0 w-[110px]">
              {localImage ? (
                <div className="relative rounded-[16px] overflow-hidden bg-muted shadow-[4px_10px_18px_-4px_rgba(0,0,0,0.35)] aspect-[2/3]">
                  <img
                    src={localImage}
                    alt={item.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute bottom-0 inset-x-0 flex">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => fileInputRef.current?.click()}
                      className={cn(
                        'flex-1 flex items-center justify-center gap-1 py-2',
                        'bg-black/55 hover:bg-black/70 text-white transition-colors',
                        'text-[10px] font-medium',
                        isBusy && 'opacity-50 cursor-not-allowed'
                      )}
                      aria-label="Upload image"
                    >
                      {isUploading
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <Upload className="h-3 w-3" />}
                    </button>
                    <div className="w-px bg-white/20" />
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={handleGenerateImage}
                      className={cn(
                        'flex-1 flex items-center justify-center gap-1 py-2',
                        'bg-black/55 hover:bg-black/70 text-white transition-colors',
                        'text-[10px] font-medium',
                        isBusy && 'opacity-50 cursor-not-allowed'
                      )}
                      aria-label="Generate AI image"
                    >
                      {isGenerating
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <Sparkles className="h-3 w-3" />}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="relative rounded-[16px] overflow-hidden border-2 border-dashed border-border bg-muted/30 aspect-[2/3] flex flex-col items-center justify-center gap-1">
                  <Camera className="h-5 w-5 text-muted-foreground/40" />
                  <span className="text-[10px] text-muted-foreground/60 text-center leading-tight px-1">
                    No image
                  </span>
                  <div className="absolute bottom-0 inset-x-0 flex">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => fileInputRef.current?.click()}
                      className={cn(
                        'flex-1 flex items-center justify-center py-2',
                        'bg-black/40 hover:bg-black/60 text-white transition-colors',
                        isBusy && 'opacity-50 cursor-not-allowed'
                      )}
                      aria-label="Upload image"
                    >
                      {isUploading
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <Upload className="h-3 w-3" />}
                    </button>
                    <div className="w-px bg-white/20" />
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={handleGenerateImage}
                      className={cn(
                        'flex-1 flex items-center justify-center py-2',
                        'bg-black/40 hover:bg-black/60 text-white transition-colors',
                        isBusy && 'opacity-50 cursor-not-allowed'
                      )}
                      aria-label="Generate AI image"
                    >
                      {isGenerating
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <Sparkles className="h-3 w-3" />}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Description — fills remaining width in row 1 */}
            {item.description && (
              <div className="flex-1 min-w-0">
                <InfoCard
                  emoji="📋"
                  label="Description"
                  value={item.description}
                  emojiBg="bg-blue-100 dark:bg-blue-900/30"
                />
              </div>
            )}
          </div>

          {/* Row 2: Style + Service Notes — 50/50 */}
          {(item.style || item.notes) && (
            <div className={cn(
              'grid gap-2',
              item.style && item.notes ? 'grid-cols-2' : 'grid-cols-1'
            )}>
              {item.style && (
                <InfoCard
                  emoji={CATEGORY_EMOJI[item.category] ?? '🍶'}
                  label="Style"
                  value={item.style}
                  emojiBg="bg-amber-100 dark:bg-amber-900/30"
                />
              )}
              {item.notes && (
                <InfoCard
                  emoji="📝"
                  label="Service Notes"
                  value={item.notes}
                  emojiBg="bg-green-100 dark:bg-green-900/30"
                />
              )}
            </div>
          )}

          {/* Hidden file input — camera + library on iPad/iPhone */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Row — Pending Draft
// =============================================================================

function PendingRow({
  draft,
  onPublish,
  onEdit,
  onRemove,
  isPublishing,
  disabled = false,
}: {
  draft: BeerLiquorDraft;
  onPublish: () => void;
  onEdit: () => void;
  onRemove: () => void;
  isPublishing: boolean;
  disabled?: boolean;
}) {
  const isDuplicate = draft.rowStatus === 'duplicate_skipped';

  return (
    <div className={cn(
      "flex items-center gap-2 py-3 px-3 border rounded-xl",
      isDuplicate
        ? "bg-amber-50/50 border-amber-200 dark:bg-amber-900/10 dark:border-amber-800"
        : "bg-muted/30 border-border"
    )}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <p className="text-sm font-medium truncate">{draft.name || 'Untitled'}</p>
          {isDuplicate && (
            <span className="shrink-0 inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
              <Copy className="h-2.5 w-2.5" />
              Duplicate
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">
          {draft.category}{draft.subcategory ? ` · ${draft.subcategory}` : ''}
          {draft.country ? ` · ${draft.country}` : ''}
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <Button
          size="sm"
          variant="ghost"
          className="h-8 px-3 text-xs gap-1"
          disabled={disabled || isPublishing}
          onClick={onEdit}
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </Button>
        <Button
          size="sm"
          className="h-8 px-3 text-xs gap-1 bg-orange-500 hover:bg-orange-600 text-white"
          disabled={disabled || isPublishing}
          onClick={onPublish}
        >
          {isPublishing
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <Send className="h-3.5 w-3.5" />}
          Publish
        </Button>
        <button
          type="button"
          disabled={disabled || isPublishing}
          onClick={onRemove}
          className="p-2.5 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
          aria-label="Remove draft"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function BeerLiquorIngestList({
  pendingDrafts,
  onPublish,
  onEdit,
  onRemovePending,
  isPublishing = false,
  publishingTempId = null,
  search,
  categoryFilter,
  sortBy,
  lastPublishedName = null,
  onPublishAll,
  onClearPending,
  isPublishingAll = false,
  isSelectMode = false,
  selectedPublishedIds = new Set<string>(),
  onToggleSelect,
}: BeerLiquorIngestListProps) {
  const { items, isLoading, error } = useSupabaseBeerLiquor();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingOpen, setPendingOpen] = useState(true);
  const pendingRef = useRef<HTMLDivElement>(null);
  const prevPendingLengthRef = useRef(pendingDrafts.length);

  // Scroll to pending section whenever a new draft is added
  useEffect(() => {
    if (pendingDrafts.length > prevPendingLengthRef.current) {
      pendingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    prevPendingLengthRef.current = pendingDrafts.length;
  }, [pendingDrafts.length]);

  // Filter + sort
  const filteredItems = items
    .filter((item) => {
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          item.name?.toLowerCase().includes(q) ||
          item.subcategory?.toLowerCase().includes(q) ||
          item.producer?.toLowerCase().includes(q) ||
          item.country?.toLowerCase().includes(q) ||
          item.style?.toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) =>
      sortBy === 'az'
        ? a.name.localeCompare(b.name)
        : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

  // When category is filtered, no need to group — flat list; otherwise group
  const grouped = categoryFilter === 'all'
    ? groupByCategory(filteredItems)
    : new Map([[categoryFilter, filteredItems]]);

  const handleDelete = useCallback(async (id: string) => {
    setDeletingId(id);
    try {
      const { error: deleteErr } = await supabase
        .from('beer_liquor_list')
        .delete()
        .eq('id', id);
      if (deleteErr) throw new Error(deleteErr.message);
      queryClient.invalidateQueries({ queryKey: ['beer-liquor'] });
      toast({ title: 'Deleted', description: 'Item removed from the list' });
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to delete item',
        variant: 'destructive',
      });
    } finally {
      setDeletingId(null);
    }
  }, [queryClient, toast]);

  const handleImageSaved = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['beer-liquor'] });
  }, [queryClient]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
        <AlertCircle className="h-5 w-5 text-destructive" />
        <p className="text-sm text-muted-foreground">Failed to load items</p>
      </div>
    );
  }

  const hasPublished = items.length > 0;
  const hasResults = filteredItems.length > 0;
  const hasPending = pendingDrafts.length > 0;

  return (
    <div className="space-y-4">

      {/* Pending Drafts — always on top */}
      <div ref={pendingRef}>
        {hasPending && (
          <Collapsible open={pendingOpen} onOpenChange={setPendingOpen}>
            <div className="flex items-center gap-1.5">
              {/* Trigger covers left portion only */}
              <CollapsibleTrigger className="flex items-center gap-1.5 flex-1 min-w-0">
                <Sparkles className="h-4 w-4 text-orange-500 shrink-0" />
                <span className="text-sm font-semibold">Pending Drafts</span>
                <span className="text-xs text-muted-foreground shrink-0">({pendingDrafts.length})</span>
                <ChevronDown className={cn(
                  'h-4 w-4 text-muted-foreground ml-auto transition-transform duration-200',
                  pendingOpen && 'rotate-180'
                )} />
              </CollapsibleTrigger>

              {/* Publish All */}
              <button
                type="button"
                onClick={onPublishAll}
                disabled={isPublishingAll}
                className="shrink-0 flex items-center gap-1 h-7 px-2.5 rounded-lg text-[11px] font-semibold bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-50 transition-colors"
              >
                {isPublishingAll
                  ? <Loader2 className="h-3 w-3 animate-spin" />
                  : <Send className="h-3 w-3" />}
                Publish All
              </button>

              {/* Delete All Pending — icon-only with confirmation */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    type="button"
                    disabled={isPublishingAll}
                    className="shrink-0 h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-50 transition-colors"
                    aria-label="Delete all pending drafts"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete all pending drafts?</AlertDialogTitle>
                    <AlertDialogDescription>
                      You'll lose all {pendingDrafts.length} unpublished
                      {pendingDrafts.length !== 1 ? ' drafts' : ' draft'}.
                      They can be recreated via the AI chat.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={onClearPending}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete All
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
            <CollapsibleContent>
              <div className="mt-2 space-y-2">
                {pendingDrafts.map((draft) => (
                  <PendingRow
                    key={draft._tempId}
                    draft={draft}
                    onPublish={() => onPublish(draft)}
                    onEdit={() => onEdit(draft)}
                    onRemove={() => onRemovePending(draft._tempId)}
                    isPublishing={isPublishing && publishingTempId === draft._tempId}
                    disabled={isPublishingAll}
                  />
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>

      {/* Published groups */}
      {hasPublished ? (
        hasResults ? (
          <>
            {Array.from(grouped.entries()).map(([category, categoryItems]) => (
              <div key={category}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-base leading-none">
                    {CATEGORY_EMOJI[category] ?? '🍶'}
                  </span>
                  <h3 className="text-sm font-semibold text-foreground">{category}</h3>
                  <span className="text-xs text-muted-foreground">({categoryItems.length})</span>
                </div>
                <div className="rounded-xl border border-border overflow-hidden">
                  {categoryItems.map((item, idx) => (
                    <div key={item.id} className={cn(idx > 0 && 'border-t border-border')}>
                      <PublishedRow
                        item={item}
                        onDelete={handleDelete}
                        isDeleting={deletingId === item.id}
                        onImageSaved={handleImageSaved}
                        defaultExpanded={item.name === lastPublishedName}
                        isSelectMode={isSelectMode}
                        isSelected={selectedPublishedIds.has(item.id)}
                        onToggleSelect={onToggleSelect}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
            <Search className="h-6 w-6 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No results for "{search}"</p>
            <p className="text-xs text-muted-foreground">Try a different search or filter</p>
          </div>
        )
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
          <Beer className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">No items yet</p>
          <p className="text-xs text-muted-foreground max-w-[200px]">
            Use the AI chat to describe a beer or spirit and publish it here.
          </p>
        </div>
      )}

    </div>
  );
}
