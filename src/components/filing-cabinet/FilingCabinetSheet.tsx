import { Archive } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { useFilingCabinet } from '@/hooks/use-filing-cabinet';
import { FilingCabinetFilterBar } from './FilingCabinetFilterBar';
import { FilingCabinetResults } from './FilingCabinetResults';
import { FilingCabinetViewer } from './FilingCabinetViewer';

// =============================================================================
// STRINGS
// =============================================================================

const STRINGS = {
  en: { title: 'Filing Cabinet', description: 'Search submitted forms' },
  es: { title: 'Archivero', description: 'Buscar formularios enviados' },
} as const;

// =============================================================================
// TYPES
// =============================================================================

interface FilingCabinetSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  language: 'en' | 'es';
}

// =============================================================================
// COMPONENT
// =============================================================================

export function FilingCabinetSheet({
  open,
  onOpenChange,
  language,
}: FilingCabinetSheetProps) {
  const t = STRINGS[language];
  const isMobile = useIsMobile();

  const {
    query,
    setQuery,
    searchResults,
    templateFilter,
    setTemplateFilter,
    statusFilter,
    setStatusFilter,
    selectedId,
    setSelectedId,
    totalCount,
    isLoading,
    hasSearched,
    hasMore,
    loadMore,
    templates,
    reset,
  } = useFilingCabinet();

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) reset();
    onOpenChange(nextOpen);
  };

  const clearSelection = () => setSelectedId(null);

  const hasViewer = !!selectedId;

  // -------------------------------------------------------------------------
  // Results panel — reused in both normal and split layouts
  // -------------------------------------------------------------------------

  const resultsPanel = (
    <>
      <FilingCabinetFilterBar
        query={query}
        setQuery={setQuery}
        isLoading={isLoading}
        templates={templates}
        templateFilter={templateFilter}
        setTemplateFilter={setTemplateFilter}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        language={language}
      />
      <FilingCabinetResults
        results={searchResults}
        totalCount={totalCount}
        isLoading={isLoading}
        hasMore={hasMore}
        loadMore={loadMore}
        hasSearched={hasSearched}
        selectedId={selectedId}
        onSelect={setSelectedId}
        language={language}
      />
    </>
  );

  // -------------------------------------------------------------------------
  // RENDER
  // -------------------------------------------------------------------------

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          'p-0 flex flex-col',
          hasViewer && !isMobile
            ? 'w-full sm:w-[90vw] sm:max-w-[960px]'
            : 'w-full sm:w-[480px] sm:max-w-[480px]',
        )}
      >
        {/* Header — hidden on mobile when viewer is open */}
        {!(hasViewer && isMobile) && (
          <SheetHeader className="px-5 pt-5 pb-3 border-b border-border/50">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-orange-500/10">
                <Archive className="h-4 w-4 text-orange-500" />
              </div>
              <div>
                <SheetTitle className="text-base font-semibold">
                  {t.title}
                </SheetTitle>
                <SheetDescription className="text-xs">
                  {t.description}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>
        )}

        {/* Body */}
        {hasViewer ? (
          isMobile ? (
            /* Mobile: viewer only (full width), back button returns to list */
            <FilingCabinetViewer
              submissionId={selectedId}
              language={language}
              onBack={clearSelection}
            />
          ) : (
            /* Desktop: split — viewer left | results right */
            <div className="flex flex-1 min-h-0">
              <div className="flex-1 flex flex-col min-w-0 border-r border-border/50">
                <FilingCabinetViewer
                  submissionId={selectedId}
                  language={language}
                  onBack={clearSelection}
                />
              </div>
              <div className="w-[380px] shrink-0 flex flex-col min-h-0 filing-cabinet-results-panel">
                {resultsPanel}
              </div>
            </div>
          )
        ) : (
          /* No selection: normal single-column layout */
          resultsPanel
        )}
      </SheetContent>
    </Sheet>
  );
}
