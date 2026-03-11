import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { FilingCabinetSearchBar } from './FilingCabinetSearchBar';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';

// =============================================================================
// STRINGS
// =============================================================================

const STRINGS = {
  en: {
    allForms: 'All Forms',
    recent: 'Recent',
    all: 'All',
    submitted: 'Submitted',
    completed: 'Completed',
    archived: 'Archived',
  },
  es: {
    allForms: 'Todos',
    recent: 'Recientes',
    all: 'Todos',
    submitted: 'Enviado',
    completed: 'Completado',
    archived: 'Archivado',
  },
} as const;

// =============================================================================
// TYPES
// =============================================================================

interface FilingCabinetFilterBarProps {
  // Search
  query: string;
  setQuery: (q: string) => void;
  isLoading: boolean;
  // Template filter
  templates: Array<{
    id: string;
    slug: string;
    titleEn: string;
    titleEs: string;
    icon: string;
    iconColor: string;
  }>;
  templateFilter: string | null;
  setTemplateFilter: (slug: string | null) => void;
  // Status filter
  statusFilter: string;
  setStatusFilter: (status: string) => void;
  language: 'en' | 'es';
}

// =============================================================================
// STATUS TABS — order: Recent (default), All, Submitted, Completed, Archived
// =============================================================================

const STATUS_TABS = ['recent', 'all', 'submitted', 'completed', 'archived'] as const;

// =============================================================================
// COMPONENT
// =============================================================================

export function FilingCabinetFilterBar({
  query,
  setQuery,
  isLoading,
  templates,
  templateFilter,
  setTemplateFilter,
  statusFilter,
  setStatusFilter,
  language,
}: FilingCabinetFilterBarProps) {
  const t = STRINGS[language];
  const isMobile = useIsMobile();

  return (
    <div className="px-5 py-2.5 border-b border-border/50">
      <div className="flex items-center gap-2 flex-wrap">
        {/* Search input — flexible width */}
        <div className="flex-1 min-w-[140px]">
          <FilingCabinetSearchBar
            query={query}
            setQuery={setQuery}
            isLoading={isLoading}
            language={language}
          />
        </div>

        {/* Template dropdown */}
        <Select
          value={templateFilter ?? '__all__'}
          onValueChange={(v) => setTemplateFilter(v === '__all__' ? null : v)}
        >
          <SelectTrigger className="h-8 w-auto min-w-[100px] text-xs rounded-lg">
            <SelectValue placeholder={t.allForms} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t.allForms}</SelectItem>
            {templates.map((tpl) => {
              const label =
                language === 'es' && tpl.titleEs ? tpl.titleEs : tpl.titleEn;
              return (
                <SelectItem key={tpl.slug} value={tpl.slug}>
                  {label}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>

        {/* Status — pills on desktop, dropdown on mobile */}
        {isMobile ? (
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-auto min-w-[100px] text-xs rounded-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_TABS.map((tab) => (
                <SelectItem key={tab} value={tab}>
                  {t[tab]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div
            className="flex gap-1 overflow-x-auto"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {STATUS_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setStatusFilter(tab)}
                className={cn(
                  'px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors cursor-pointer',
                  statusFilter === tab
                    ? 'bg-orange-500 text-white'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80',
                )}
              >
                {t[tab]}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
