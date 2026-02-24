import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { AppShell } from '@/components/layout/AppShell';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';
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
import { Plus, Package, Pencil, Trash2, CheckSquare, X, RotateCcw, Search } from 'lucide-react';

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

/** A session is discardable if it's not published, abandoned, or deleted */
const DISCARDABLE_STATUSES = new Set(['drafting', 'review', 'failed']);

function isDiscardable(session: IngestionSession): boolean {
  return DISCARDABLE_STATUSES.has(session.status);
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
    <button
      onClick={handleCardClick}
      className={cn(
        'w-full text-left rounded-xl border bg-card p-4 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
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
              if (window.confirm(`Discard "${draftName}"? This cannot be undone.`)) {
                onDiscard(session.id);
              }
            }}
            className="shrink-0 mt-1 p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            title="Discard draft"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </button>
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
  const navigate = useNavigate();
  const { listSessions, discardSession, discardSessions, isLoading } = useIngestionSession();

  const [sessions, setSessions] = useState<IngestionSession[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [activeFilter, setActiveFilter] = useState<StatusFilter>('all');
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<CategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Bulk selection mode
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Whether any non-default filter is active
  const hasActiveFilters = activeFilter !== 'all' || activeCategoryFilter !== 'all' || searchQuery !== '';

  // Apply category + search filters client-side on top of the status-filtered sessions
  const filteredSessions = useMemo(() => {
    let result = sessions;
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

  // Single discard from card
  const handleDiscardSession = useCallback(async (sessionId: string) => {
    const ok = await discardSession(sessionId);
    if (ok) {
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    }
  }, [discardSession]);

  // Bulk discard
  const handleBulkDiscard = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    const ok = await discardSessions(ids);
    if (ok) {
      setSessions((prev) => prev.filter((s) => !selectedIds.has(s.id)));
      setSelectedIds(new Set());
      setIsSelectMode(false);
    }
  }, [selectedIds, discardSessions]);

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
                      Discard Selected ({selectedIds.size})
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Discard {selectedIds.size} draft(s)?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This cannot be undone. The selected drafts and their chat history will be discarded.
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
                    variant="outline"
                    size="sm"
                    onClick={() => setIsSelectMode(true)}
                  >
                    <CheckSquare className="w-4 h-4 mr-1" />
                    Select
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
        ) : hasLoaded && filteredSessions.length === 0 ? (
          sessions.length === 0 ? (
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
