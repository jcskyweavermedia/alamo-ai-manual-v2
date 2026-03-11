import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { AppShell } from '@/components/layout/AppShell';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/integrations/supabase/client';
import { useIngestionSession, type IngestionSession } from '@/hooks/use-ingestion-session';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Input } from '@/components/ui/input';
import { Plus, Package, Pencil, Trash2, CheckSquare, X, RotateCcw, Search, Loader2 } from 'lucide-react';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Map DB table names → human-readable labels */
const TABLE_LABEL_MAP: Record<string, string> = {
  prep_recipes: 'Prep Recipe',
  plate_specs: 'Plate Spec',
  foh_plate_specs: 'Dish Guide',
  wines: 'Wine',
  cocktails: 'Cocktail',
  beer_liquor_list: 'Beer/Liquor',
};

/** Map DB table names → emoji */
const TABLE_EMOJI_MAP: Record<string, string> = {
  prep_recipes: '👨‍🍳',
  plate_specs: '📦',
  foh_plate_specs: '🍽️',
  wines: '🍷',
  cocktails: '🍸',
  beer_liquor_list: '🍺',
};

/** Map ingestion method → display text */
const METHOD_LABEL_MAP: Record<string, string> = {
  chat: 'Chat',
  file_upload: 'File Upload',
  image_upload: 'Image Upload',
  edit: 'Edit',
};

type StatusFilter = 'all' | 'drafting' | 'review' | 'published' | 'abandoned';

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'drafting', label: 'Drafting' },
  { key: 'review', label: 'Review' },
  { key: 'published', label: 'Published' },
  { key: 'abandoned', label: 'Abandoned' },
];

type CategoryFilter = 'all' | string; // 'all' or a DB table name

const CATEGORY_FILTERS: { key: CategoryFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'prep_recipes', label: 'Prep Recipe' },
  { key: 'wines', label: 'Wine' },
  { key: 'cocktails', label: 'Cocktail' },
  { key: 'foh_plate_specs', label: 'Dish Guide' },
  { key: 'plate_specs', label: 'Plate Spec' },
  { key: 'beer_liquor_list', label: 'Beer/Liquor' },
];

// =============================================================================
// HELPERS
// =============================================================================

/** Return a color class string for each session status */
function statusBadgeClass(status: string): string {
  switch (status) {
    case 'drafting':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'review':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'publishing':
      return 'bg-indigo-100 text-indigo-800 border-indigo-200';
    case 'published':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'failed':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'abandoned':
      return 'bg-gray-100 text-gray-600 border-gray-200';
    default:
      return 'bg-gray-100 text-gray-600 border-gray-200';
  }
}

/** Format a date string as a simple relative time */
function formatRelativeTime(dateString: string): string {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diffMs = now - then;

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return 'Just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;

  const years = Math.floor(months / 12);
  return `${years}y ago`;
}

// =============================================================================
// HELPERS — selectability
// =============================================================================

/** A session can be removed if it's not already abandoned or deleted.
 *  Published sessions may be orphaned (product deleted elsewhere) so they're included. */
const DISCARDABLE_STATUSES = new Set(['drafting', 'review', 'failed', 'published']);

function isDiscardable(session: IngestionSession): boolean {
  return DISCARDABLE_STATUSES.has(session.status);
}

// =============================================================================
// BEER/LIQUOR HUB CARD
// =============================================================================

interface BeerLiquorHubCardProps {
  itemCount: number;
  onClick: () => void;
  isLoading?: boolean;
}

function BeerLiquorHubCard({ itemCount, onClick, isLoading }: BeerLiquorHubCardProps) {
  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      className={cn(
        'w-full text-left rounded-xl border bg-card p-4 transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        isLoading ? 'opacity-60 cursor-default' : 'border-border hover:bg-accent/50'
      )}
    >
      <div className="flex items-start gap-3">
        <span className="text-[22px] leading-none mt-0.5 shrink-0">🍺</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Beer/Liquor
            </span>
            <span className={cn(
              'inline-flex items-center rounded-full px-1.5 py-0 text-[10px] font-semibold leading-4 border',
              'bg-green-100 text-green-800 border-green-200'
            )}>
              {itemCount} item{itemCount !== 1 ? 's' : ''}
            </span>
          </div>
          <h3 className="text-sm font-semibold text-foreground">Beer &amp; Liquor List</h3>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-xs text-muted-foreground">View &amp; manage all bar items</span>
          </div>
        </div>
        {isLoading
          ? <Loader2 className="h-4 w-4 text-muted-foreground shrink-0 mt-1 animate-spin" />
          : <Package className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
        }
      </div>
    </button>
  );
}

// =============================================================================
// SESSION CARD
// =============================================================================

interface SessionCardProps {
  session: IngestionSession;
  onClick: () => void;
  onDiscard?: (sessionId: string) => void;
  isSelectMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (sessionId: string) => void;
}

function SessionCard({ session, onClick, onDiscard, isSelectMode, isSelected, onToggleSelect }: SessionCardProps) {
  const productLabel = TABLE_LABEL_MAP[session.productTable] || session.productTable;
  const productEmoji = TABLE_EMOJI_MAP[session.productTable] || '📄';
  const draftName = session.draftData?.name || 'Untitled';
  const methodLabel = METHOD_LABEL_MAP[session.ingestionMethod] || session.ingestionMethod;
  const isEditing = Boolean(session.editingProductId) && (session.status === 'drafting' || session.status === 'review');
  const canDiscard = isDiscardable(session);

  const handleCardClick = () => {
    if (isSelectMode && canDiscard && onToggleSelect) {
      onToggleSelect(session.id);
    } else if (!isSelectMode) {
      onClick();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCardClick(); } }}
      className={cn(
        'w-full text-left rounded-xl border bg-card p-4 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-pointer',
        isSelectMode && isSelected
          ? 'border-destructive/50 bg-destructive/5'
          : 'border-border hover:bg-accent/50',
        isSelectMode && !canDiscard && 'opacity-50 cursor-default',
      )}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox in select mode */}
        {isSelectMode && (
          <div className="mt-1 shrink-0">
            <Checkbox
              checked={isSelected}
              disabled={!canDiscard}
              onCheckedChange={() => canDiscard && onToggleSelect?.(session.id)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}

        <span className="text-[22px] leading-none mt-0.5 shrink-0">{productEmoji}</span>
        <div className="flex-1 min-w-0">
          {/* Product type + status */}
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {productLabel}
            </span>
            <Badge
              className={`text-[10px] px-1.5 py-0 leading-4 ${statusBadgeClass(session.status)}`}
            >
              {session.status}
            </Badge>
            {isEditing && (
              <Badge className="text-[10px] px-1.5 py-0 leading-4 bg-orange-100 text-orange-800 border-orange-200">
                <Pencil className="h-2.5 w-2.5 mr-0.5" />
                Editing
              </Badge>
            )}
          </div>
          <h3 className="text-sm font-semibold text-foreground truncate">
            {draftName}
          </h3>

          {/* Method + time */}
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-xs text-muted-foreground">{methodLabel}</span>
            <span className="text-xs text-muted-foreground/60">·</span>
            <span className="text-xs text-muted-foreground">
              {formatRelativeTime(session.updatedAt)}
            </span>
          </div>
        </div>

        {/* Trash icon (non-select mode, discardable sessions only) */}
        {!isSelectMode && canDiscard && onDiscard && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              const msg = session.status === 'published'
                ? `Delete "${draftName}"? This will permanently remove both the session record and the published product. This cannot be undone.`
                : `Discard "${draftName}"? This cannot be undone.`;
              if (window.confirm(msg)) {
                onDiscard(session.id);
              }
            }}
            className="shrink-0 mt-1 p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            title={session.status === 'published' ? 'Remove session record' : 'Discard draft'}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// LOADING SKELETON
// =============================================================================

function SessionListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-lg border border-border p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-4 w-14 rounded-full" />
          </div>
          <Skeleton className="h-4 w-48" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// EMPTY STATE
// =============================================================================

interface EmptyStateProps {
  onCreateNew: () => void;
}

function EmptyState({ onCreateNew }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <span className="text-[40px] leading-none mb-4">📭</span>
      <p className="text-sm font-medium text-foreground mb-1">
        No ingestion sessions yet
      </p>
      <p className="text-xs text-muted-foreground mb-4">
        Start adding products to your restaurant database
      </p>
      <Button onClick={onCreateNew} className="bg-orange-500 hover:bg-orange-600 text-white">
        <Plus className="w-4 h-4" />
        Create your first product
      </Button>
    </div>
  );
}

// =============================================================================
// MAIN PAGE
// =============================================================================

function IngestDashboard() {
  const { language, setLanguage } = useLanguage();
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { listSessions, createSession, discardSession, discardSessions, isLoading } = useIngestionSession();

  const [isCreatingBeerLiquor, setIsCreatingBeerLiquor] = useState(false);

  const handleBeerLiquorHubClick = useCallback(async () => {
    if (isCreatingBeerLiquor) return;
    setIsCreatingBeerLiquor(true);
    try {
      const sessionId = await createSession('beer_liquor_list');
      if (sessionId) navigate(`/admin/ingest/${sessionId}`);
    } finally {
      setIsCreatingBeerLiquor(false);
    }
  }, [isCreatingBeerLiquor, createSession, navigate]);

  const [sessions, setSessions] = useState<IngestionSession[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [activeFilter, setActiveFilter] = useState<StatusFilter>('all');
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<CategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [beerLiquorCount, setBeerLiquorCount] = useState<number>(0);

  // Bulk selection mode
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Whether any non-default filter is active
  const hasActiveFilters = activeFilter !== 'all' || activeCategoryFilter !== 'all' || searchQuery !== '';

  // Fetch beer/liquor item count once on mount
  useEffect(() => {
    supabase
      .from('beer_liquor_list')
      .select('id', { count: 'exact', head: true })
      .then(({ count }) => {
        setBeerLiquorCount(count ?? 0);
      });
  }, []);

  // Apply category + search filters client-side; beer_liquor_list sessions are always excluded
  // (they are represented by the single BeerLiquorHubCard instead)
  const filteredSessions = useMemo(() => {
    let result = sessions.filter((s) => s.productTable !== 'beer_liquor_list');
    if (activeCategoryFilter !== 'all') {
      result = result.filter((s) => s.productTable === activeCategoryFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((s) => {
        const name = (s.draftData?.name || '').toLowerCase();
        const label = (TABLE_LABEL_MAP[s.productTable] || '').toLowerCase();
        return name.includes(q) || label.includes(q);
      });
    }
    return result;
  }, [sessions, activeCategoryFilter, searchQuery]);

  // Whether to show the Beer/Liquor hub card (only when not filtering to another type)
  const showBeerLiquorHub =
    beerLiquorCount > 0 &&
    (activeCategoryFilter === 'all' || activeCategoryFilter === 'beer_liquor_list');

  // Exit select mode and clear selection when filters change (prevent discarding invisible sessions)
  useEffect(() => {
    setIsSelectMode(false);
    setSelectedIds(new Set());
  }, [activeFilter, activeCategoryFilter, searchQuery]);

  // Fetch sessions on mount and when filter changes
  const fetchSessions = useCallback(async () => {
    const statusParam = activeFilter === 'all' ? undefined : activeFilter;
    const result = await listSessions(statusParam);
    // "All" view excludes abandoned and deleted sessions
    const filtered = activeFilter === 'all'
      ? result.filter((s) => s.status !== 'abandoned' && s.status !== 'deleted')
      : result;
    setSessions(filtered);
    setHasLoaded(true);
  }, [listSessions, activeFilter]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleNavigateNew = () => navigate('/admin/ingest/new');
  const handleNavigateSession = (session: IngestionSession) => {
    // Published sessions with a product should open in edit mode (which reuses the session)
    if (session.status === 'published' && session.productId) {
      navigate(`/admin/ingest/edit/${session.productTable}/${session.productId}`);
    } else if (session.editingProductId) {
      // Drafting/review sessions with an editing product should also use edit route
      navigate(`/admin/ingest/edit/${session.productTable}/${session.editingProductId}`);
    } else {
      navigate(`/admin/ingest/${session.id}`);
    }
  };

  // Map product table → React Query cache key so we can bust the right cache
  const TABLE_CACHE_KEY: Record<string, string> = {
    prep_recipes: 'recipes',
    plate_specs: 'plate_specs',
    foh_plate_specs: 'dishes',
    wines: 'wines',
    cocktails: 'cocktails',
    beer_liquor_list: 'beer-liquor',
  };

  // Delete the product row(s) linked to a session.
  // Uses TWO strategies so either gap is covered:
  //   1. Delete by productId   — fast path when session.product_id was set correctly
  //   2. Delete by source_session_id — catches cases where product_id was never written
  //      back to the session row (e.g. sessionId was null during publish)
  // For plate_specs sessions, the linked foh_plate_specs row is deleted FIRST
  // (before the plate_specs row) so the FK cascade doesn't beat us to it and
  // the dishes cache is properly invalidated.
  const deleteLinkedProduct = useCallback(async (session: IngestionSession) => {
    if (!session.productTable) return;
    const table = session.productTable as any;

    // For plate_specs: cascade-delete the linked FOH dish guide BEFORE deleting
    // the BOH row. Deleting plate_specs first would immediately SET NULL on
    // foh_plate_specs.plate_spec_id (old behaviour) or cascade-delete it (new
    // behaviour after migration), so the explicit lookup must happen first.
    if (session.productTable === 'plate_specs') {
      if (session.productId) {
        await supabase.from('foh_plate_specs').delete().eq('plate_spec_id', session.productId);
      }
      // Belt-and-suspenders: catch dish guides linked via session backlink
      await supabase.from('foh_plate_specs').delete().eq('source_session_id', session.id);
      queryClient.invalidateQueries({ queryKey: ['dishes'] });
    }

    if (session.productId) {
      await supabase.from(table).delete().eq('id', session.productId);
    }
    // Belt-and-suspenders: remove any product whose source_session_id points here
    await supabase.from(table).delete().eq('source_session_id', session.id);

    const cacheKey = TABLE_CACHE_KEY[session.productTable];
    if (cacheKey) queryClient.invalidateQueries({ queryKey: [cacheKey] });
  }, [queryClient]);

  // Single discard from card — deletes linked product then marks session abandoned
  const handleDiscardSession = useCallback(async (sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId);
    if (session) await deleteLinkedProduct(session);
    const ok = await discardSession(sessionId);
    if (ok) {
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    }
  }, [sessions, deleteLinkedProduct, discardSession]);

  // Bulk discard — deletes linked products then marks all selected sessions abandoned
  const handleBulkDiscard = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    // Delete products for every selected session that has a product table.
    // Group by table (productId path) + run source_session_id sweep per table.
    const selectedSessions = sessions.filter((s) => selectedIds.has(s.id) && s.productTable);
    const byTable = new Map<string, { productIds: string[]; sessionIds: string[] }>();
    for (const s of selectedSessions) {
      if (!byTable.has(s.productTable)) byTable.set(s.productTable, { productIds: [], sessionIds: [] });
      const entry = byTable.get(s.productTable)!;
      if (s.productId) entry.productIds.push(s.productId);
      entry.sessionIds.push(s.id);
    }
    for (const [table, { productIds, sessionIds }] of byTable.entries()) {
      // For plate_specs: delete linked foh_plate_specs BEFORE deleting plate_specs rows
      // so the explicit lookup finds them before any FK cascade runs.
      if (table === 'plate_specs') {
        if (productIds.length) {
          await supabase.from('foh_plate_specs').delete().in('plate_spec_id', productIds);
        }
        await supabase.from('foh_plate_specs').delete().in('source_session_id', sessionIds);
        queryClient.invalidateQueries({ queryKey: ['dishes'] });
      }
      if (productIds.length) await supabase.from(table as any).delete().in('id', productIds);
      await supabase.from(table as any).delete().in('source_session_id', sessionIds);
      const cacheKey = TABLE_CACHE_KEY[table];
      if (cacheKey) queryClient.invalidateQueries({ queryKey: [cacheKey] });
    }

    const ok = await discardSessions(ids);
    if (ok) {
      setSessions((prev) => prev.filter((s) => !selectedIds.has(s.id)));
      setSelectedIds(new Set());
      setIsSelectMode(false);
    }
  }, [selectedIds, sessions, queryClient, discardSessions]);

  // Toggle selection of a session
  const handleToggleSelect = useCallback((sessionId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
      }
      return next;
    });
  }, []);

  // Select / deselect all discardable sessions (respects current filters)
  const discardableIds = filteredSessions.filter(isDiscardable).map((s) => s.id);
  const allSelected = discardableIds.length > 0 && discardableIds.every((id) => selectedIds.has(id));

  const handleSelectAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(discardableIds));
    }
  }, [allSelected, discardableIds]);

  // Exit select mode
  const handleExitSelectMode = useCallback(() => {
    setIsSelectMode(false);
    setSelectedIds(new Set());
  }, []);

  // Reset all filters
  const handleResetFilters = useCallback(() => {
    setActiveFilter('all');
    setActiveCategoryFilter('all');
    setSearchQuery('');
  }, []);

  return (
    <AppShell
      language={language}
      onLanguageChange={setLanguage}
      isAdmin={isAdmin}
      showSearch={false}
      constrainContentWidth={true}
    >
      <div className="space-y-4">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-foreground">
            {language === 'es' ? 'Ingesta de Datos' : 'Data Ingestion'}
          </h1>
          <div className="flex items-center gap-2">
            {isSelectMode ? (
              <>
                <Button variant="ghost" size="sm" onClick={handleExitSelectMode}>
                  <X className="w-4 h-4 mr-1" />
                  Cancel
                </Button>
                <Button variant="outline" size="sm" onClick={handleSelectAll}>
                  {allSelected ? 'Deselect All' : 'Select All'}
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      disabled={selectedIds.size === 0}
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Delete Selected ({selectedIds.size})
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remove {selectedIds.size} session{selectedIds.size !== 1 ? 's' : ''}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Drafts will be discarded. Published sessions will also permanently delete the linked
                        product (wine, recipe, etc.). This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleBulkDiscard}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Discard
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            ) : (
              <>
                {hasLoaded && filteredSessions.some(isDiscardable) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsSelectMode(true)}
                    className="bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"
                  >
                    <Trash2 className="w-4 h-4 mr-1.5" />
                    Bulk Delete
                  </Button>
                )}
                <Button onClick={handleNavigateNew} className="bg-orange-500 hover:bg-orange-600 text-white">
                  <Plus className="w-4 h-4" />
                  {language === 'es' ? 'Nuevo Producto' : 'New Product'}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Search + Filter bars */}
        <div className="space-y-2">
          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder="Search by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide w-12 shrink-0">Status</span>
            <div className="flex gap-0.5 rounded-lg bg-muted p-0.5 w-fit overflow-x-auto">
              {STATUS_FILTERS.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => setActiveFilter(filter.key)}
                  className={cn(
                    'min-h-[28px] px-3 rounded-md text-[11px] font-semibold shrink-0',
                    'transition-colors duration-150',
                    activeFilter === filter.key
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          {/* Category filter */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide w-12 shrink-0">Type</span>
            <div className="flex gap-0.5 rounded-lg bg-muted p-0.5 w-fit overflow-x-auto">
              {CATEGORY_FILTERS.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => setActiveCategoryFilter(filter.key)}
                  className={cn(
                    'min-h-[28px] px-3 rounded-md text-[11px] font-semibold shrink-0',
                    'transition-colors duration-150',
                    activeCategoryFilter === filter.key
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            {/* Reset button */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="ml-1 flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                title="Reset all filters"
              >
                <RotateCcw className="h-3 w-3" />
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Content: loading / empty / session list */}
        {isLoading && !hasLoaded ? (
          <SessionListSkeleton />
        ) : hasLoaded && filteredSessions.length === 0 && !showBeerLiquorHub ? (
          sessions.length === 0 && beerLiquorCount === 0 ? (
            <EmptyState onCreateNew={handleNavigateNew} />
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-sm text-muted-foreground">No sessions match the current filters</p>
              <button
                type="button"
                onClick={handleResetFilters}
                className="mt-2 text-sm font-medium text-orange-500 hover:text-orange-600"
              >
                Reset filters
              </button>
            </div>
          )
        ) : (
          <div className="space-y-3">
            {showBeerLiquorHub && (
              <BeerLiquorHubCard
                itemCount={beerLiquorCount}
                onClick={handleBeerLiquorHubClick}
                isLoading={isCreatingBeerLiquor}
              />
            )}
            {filteredSessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                onClick={() => handleNavigateSession(session)}
                onDiscard={handleDiscardSession}
                isSelectMode={isSelectMode}
                isSelected={selectedIds.has(session.id)}
                onToggleSelect={handleToggleSelect}
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default IngestDashboard;
