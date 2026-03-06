// =============================================================================
// SourceMaterialPicker — Searchable multi-select picker for source materials
// Tabs by domain, checkbox selection, search input, selected count badge.
// =============================================================================

import { useState, useEffect } from 'react';
import { Search, Check, Loader2, UtensilsCrossed, Wine, GlassWater, ChefHat, Beer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  useSourceMaterialSearch,
  ALL_DOMAINS,
  type SourceMaterialResult,
} from '@/hooks/use-source-material-search';
import type { SourceRef } from '@/types/course-builder';

const STRINGS = {
  en: {
    search: 'Search items...',
    selected: 'selected',
    noResults: 'No items found',
    all: 'All',
    dishes: 'Dishes',
    wines: 'Wines',
    cocktails: 'Cocktails',
    recipes: 'Recipes',
    beer_liquor: 'Beer & Liquor',
  },
  es: {
    search: 'Buscar items...',
    selected: 'seleccionados',
    noResults: 'No se encontraron items',
    all: 'Todos',
    dishes: 'Platos',
    wines: 'Vinos',
    cocktails: 'Cocteles',
    recipes: 'Recetas',
    beer_liquor: 'Cerveza y Licor',
  },
};

type DomainTab = 'all' | 'dishes' | 'wines' | 'cocktails' | 'recipes' | 'beer_liquor';

const TABS: Array<{ key: DomainTab; icon: typeof UtensilsCrossed }> = [
  { key: 'all', icon: Search },
  { key: 'dishes', icon: UtensilsCrossed },
  { key: 'wines', icon: Wine },
  { key: 'cocktails', icon: GlassWater },
  { key: 'recipes', icon: ChefHat },
  { key: 'beer_liquor', icon: Beer },
];

interface SourceMaterialPickerProps {
  selectedItems: SourceRef[];
  onSelectionChange: (items: SourceRef[]) => void;
  domains?: string[];
  language?: 'en' | 'es';
}

export function SourceMaterialPicker({
  selectedItems,
  onSelectionChange,
  language = 'en',
}: SourceMaterialPickerProps) {
  const t = STRINGS[language];
  const { results, isSearching, search } = useSourceMaterialSearch();
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<DomainTab>('all');

  // Selected IDs set for fast lookup
  const selectedIds = new Set(selectedItems.map((r) => r.id));

  // Search on mount and when query/tab changes
  useEffect(() => {
    const domains = activeTab === 'all' ? ALL_DOMAINS : [activeTab];
    search(query, domains);
  }, [query, activeTab, search]);

  const toggleItem = (result: SourceMaterialResult) => {
    if (selectedIds.has(result.ref.id)) {
      onSelectionChange(selectedItems.filter((r) => r.id !== result.ref.id));
    } else {
      onSelectionChange([...selectedItems, result.ref]);
    }
  };

  return (
    <div className="space-y-3">
      {/* Search input + selection count */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.search}
            className="pl-9 h-9 rounded-lg"
          />
        </div>
        {selectedItems.length > 0 && (
          <Badge variant="secondary" className="text-xs shrink-0">
            {selectedItems.length} {t.selected}
          </Badge>
        )}
      </div>

      {/* Domain tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors',
                activeTab === tab.key
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {t[tab.key as keyof typeof t] || tab.key}
            </button>
          );
        })}
      </div>

      {/* Results list */}
      <div className="border rounded-xl max-h-[320px] overflow-y-auto">
        {isSearching ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            <span className="text-sm">Loading...</span>
          </div>
        ) : results.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            {t.noResults}
          </div>
        ) : (
          <div className="divide-y">
            {results.map((result) => {
              const isChecked = selectedIds.has(result.ref.id);
              return (
                <button
                  key={`${result.ref.table}-${result.ref.id}`}
                  type="button"
                  onClick={() => toggleItem(result)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors',
                    isChecked ? 'bg-primary/5' : 'hover:bg-muted/50',
                  )}
                >
                  <Checkbox
                    checked={isChecked}
                    className="shrink-0"
                    tabIndex={-1}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {language === 'es' && result.nameEs ? result.nameEs : result.nameEn}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-muted-foreground">{result.domain}</span>
                      {result.category && (
                        <>
                          <span className="text-[10px] text-muted-foreground">/</span>
                          <span className="text-[10px] text-muted-foreground">{result.category}</span>
                        </>
                      )}
                    </div>
                  </div>
                  {isChecked && (
                    <Check className="h-4 w-4 text-primary shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
