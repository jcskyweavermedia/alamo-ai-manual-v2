/**
 * ToolResultChip
 *
 * Small chip showing a tool call result from the AI.
 * Icon + tool name + result count. Compact, muted colors.
 */

import { Search, BookOpen, Utensils, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ToolResultChipProps {
  tool: string;
  query: string;
  resultCount: number;
  topResult?: string;
}

const TOOL_ICONS: Record<string, React.ElementType> = {
  search_contacts: Users,
  search_manual: BookOpen,
  search_products: Utensils,
};

const TOOL_LABELS: Record<string, string> = {
  search_contacts: 'Contacts',
  search_manual: 'Manual',
  search_products: 'Products',
};

export function ToolResultChip({ tool, query, resultCount, topResult }: ToolResultChipProps) {
  const Icon = TOOL_ICONS[tool] ?? Search;
  const label = TOOL_LABELS[tool] ?? tool;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5',
        'px-2 py-1 rounded-full',
        'bg-muted/60 dark:bg-muted/40',
        'text-[11px] text-muted-foreground',
      )}
      title={topResult ? `"${query}" -> ${topResult}` : `"${query}" -> ${resultCount} results`}
    >
      <Icon className="h-3 w-3 shrink-0" />
      <span className="font-medium">{label}</span>
      <span className="text-muted-foreground/70">{resultCount}</span>
    </div>
  );
}
