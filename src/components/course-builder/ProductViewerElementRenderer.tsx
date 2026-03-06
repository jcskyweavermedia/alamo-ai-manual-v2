// =============================================================================
// ProductViewerElementRenderer — Builder-side compact product preview card
// Shows a searchable combobox to pick a product, then displays a mini-card.
// Full CardView is reserved for the learner player (future phase).
// =============================================================================

import { useState, useEffect } from 'react';
import { Eye, ArrowLeftRight, Search, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCourseBuilder } from '@/contexts/CourseBuilderContext';
import { useSourceMaterialSearch, type SourceMaterialResult } from '@/hooks/use-source-material-search';
import { PRODUCT_TABLE_META } from '@/lib/course-builder/builder-utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import type { ProductViewerElement, ProductTable } from '@/types/course-builder';

const STRINGS = {
  en: {
    selectProduct: 'Select a product',
    searchPlaceholder: 'Search products...',
    noResults: 'No products found',
    swap: 'Change product',
  },
  es: {
    selectProduct: 'Seleccionar un producto',
    searchPlaceholder: 'Buscar productos...',
    noResults: 'No se encontraron productos',
    swap: 'Cambiar producto',
  },
};

interface ProductViewerElementRendererProps {
  element: ProductViewerElement;
  language: 'en' | 'es';
}

export function ProductViewerElementRenderer({ element, language }: ProductViewerElementRendererProps) {
  const t = STRINGS[language];
  const { updateElement } = useCourseBuilder();
  const { results, isSearching, search } = useSourceMaterialSearch();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const hasProduct = element.products.length > 0;
  const product = hasProduct ? element.products[0] : null;

  // Load all products when combobox opens
  useEffect(() => {
    if (open) {
      search(query);
    }
  }, [open, query, search]);

  const handleSelect = (result: SourceMaterialResult) => {
    updateElement(element.key, {
      products: [{
        table: result.ref.table as ProductTable,
        id: result.ref.id,
        name_en: result.nameEn,
        name_es: result.nameEs,
      }],
    } as Partial<ProductViewerElement>);
    setOpen(false);
    setQuery('');
  };

  // Group results by domain
  const grouped = results.reduce<Record<string, SourceMaterialResult[]>>((acc, r) => {
    (acc[r.domain] ??= []).push(r);
    return acc;
  }, {});

  const combobox = (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setOpen(true); }}
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors',
            'border border-teal-300/50 dark:border-teal-700/50',
            'hover:bg-teal-50 dark:hover:bg-teal-950/30',
            'text-teal-700 dark:text-teal-300',
          )}
        >
          {hasProduct ? (
            <>
              <ArrowLeftRight className="h-3.5 w-3.5" />
              {t.swap}
            </>
          ) : (
            <>
              <Search className="h-3.5 w-3.5" />
              {t.selectProduct}
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={t.searchPlaceholder}
            value={query}
            onValueChange={(v) => setQuery(v)}
          />
          <CommandList className="max-h-[240px]">
            {isSearching ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : Object.keys(grouped).length === 0 ? (
              <CommandEmpty>{t.noResults}</CommandEmpty>
            ) : (
              Object.entries(grouped).map(([domain, items]) => (
                <CommandGroup key={domain} heading={domain}>
                  {items.map((r) => (
                    <CommandItem
                      key={`${r.ref.table}:${r.ref.id}`}
                      value={`${r.ref.table}:${r.ref.id}`}
                      onSelect={() => handleSelect(r)}
                      className="cursor-pointer"
                    >
                      <span className="truncate">{r.nameEn}</span>
                      {r.category && (
                        <span className="ml-auto text-[10px] text-muted-foreground">{r.category}</span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );

  // ── No product selected ─────────────────────────────────────────────────
  if (!hasProduct) {
    return (
      <div className="rounded-lg border-2 border-dashed border-teal-300/40 dark:border-teal-700/40 p-6 flex flex-col items-center gap-3">
        <Eye className="h-8 w-8 text-teal-400/40" />
        <p className="text-sm text-muted-foreground">{t.selectProduct}</p>
        {combobox}
      </div>
    );
  }

  // ── Product selected — compact mini-card ────────────────────────────────
  const meta = product && PRODUCT_TABLE_META[product.table as ProductTable];
  const displayName = language === 'es' ? (product!.name_es || product!.name_en) : product!.name_en;
  const domainLabel = meta ? (language === 'es' ? meta.labelEs : meta.labelEn) : product!.table;

  return (
    <div className="rounded-lg p-3 bg-teal-50/50 dark:bg-teal-950/20 border border-teal-200/50 dark:border-teal-800/30">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-md bg-teal-100 dark:bg-teal-900/40 flex items-center justify-center shrink-0">
          <Eye className="h-5 w-5 text-teal-600 dark:text-teal-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{displayName || 'Unnamed Product'}</p>
          <p className="text-[10px] text-muted-foreground">
            {domainLabel} <span className="mx-1">·</span> {product!.table}
          </p>
        </div>
        {combobox}
      </div>
    </div>
  );
}
