import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { AppShell } from '@/components/layout/AppShell';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';
import { useIngestionSession, type IngestionSession } from '@/hooks/use-ingestion-session';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Package } from 'lucide-react';

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
// SESSION CARD
// =============================================================================

interface SessionCardProps {
  session: IngestionSession;
  onClick: () => void;
}

function SessionCard({ session, onClick }: SessionCardProps) {
  const productLabel = TABLE_LABEL_MAP[session.productTable] || session.productTable;
  const productEmoji = TABLE_EMOJI_MAP[session.productTable] || '📄';
  const draftName = session.draftData?.name || 'Untitled';
  const methodLabel = METHOD_LABEL_MAP[session.ingestionMethod] || session.ingestionMethod;

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl border border-border bg-card p-4 hover:bg-accent/50 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <div className="flex items-start gap-3">
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
      <Button onClick={onCreateNew}>
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
  const { listSessions, isLoading } = useIngestionSession();

  const [sessions, setSessions] = useState<IngestionSession[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [activeFilter, setActiveFilter] = useState<StatusFilter>('all');

  // Fetch sessions on mount and when filter changes
  const fetchSessions = useCallback(async () => {
    const statusParam = activeFilter === 'all' ? undefined : activeFilter;
    const result = await listSessions(statusParam);
    setSessions(result);
    setHasLoaded(true);
  }, [listSessions, activeFilter]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleNavigateNew = () => navigate('/admin/ingest/new');
  const handleNavigateSession = (id: string) => navigate(`/admin/ingest/${id}`);

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
          <Button onClick={handleNavigateNew} className="bg-orange-500 hover:bg-orange-600 text-white">
            <Plus className="w-4 h-4" />
            {language === 'es' ? 'Nuevo Producto' : 'New Product'}
          </Button>
        </div>

        {/* Filter bar */}
        <div className="flex gap-0.5 rounded-lg bg-muted p-0.5 w-fit">
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

        {/* Content: loading / empty / session list */}
        {isLoading && !hasLoaded ? (
          <SessionListSkeleton />
        ) : hasLoaded && sessions.length === 0 ? (
          <EmptyState onCreateNew={handleNavigateNew} />
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                onClick={() => handleNavigateSession(session.id)}
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default IngestDashboard;
