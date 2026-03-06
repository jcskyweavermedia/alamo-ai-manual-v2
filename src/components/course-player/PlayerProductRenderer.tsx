// =============================================================================
// PlayerProductRenderer — Read-only product viewer for the course player.
// Displays a simplified product card with product name and domain badge.
// No combobox picker, no add/remove — pure display.
// =============================================================================

import { Eye } from 'lucide-react';
import { PRODUCT_TABLE_META } from '@/lib/course-builder/builder-utils';
import type { ProductViewerElement, ProductTable } from '@/types/course-builder';

interface Props {
  element: ProductViewerElement;
  language: 'en' | 'es';
}

export function PlayerProductRenderer({ element, language }: Props) {
  if (element.products.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed border-teal-300/40 dark:border-teal-700/40 p-6 flex flex-col items-center gap-3">
        <Eye className="h-8 w-8 text-teal-400/40" />
        <p className="text-sm text-muted-foreground">
          {language === 'es' ? 'Producto no disponible' : 'Product unavailable'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {element.products.map((product) => {
        const meta = PRODUCT_TABLE_META[product.table as ProductTable];
        const displayName = language === 'es'
          ? (product.name_es || product.name_en)
          : product.name_en;
        const domainLabel = meta
          ? (language === 'es' ? meta.labelEs : meta.labelEn)
          : product.table;

        return (
          <div
            key={`${product.table}:${product.id}`}
            className="rounded-lg p-3 bg-teal-50/50 dark:bg-teal-950/20 border border-teal-200/50 dark:border-teal-800/30"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-md bg-teal-100 dark:bg-teal-900/40 flex items-center justify-center shrink-0">
                <Eye className="h-5 w-5 text-teal-600 dark:text-teal-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">
                  {displayName || (language === 'es' ? 'Producto sin nombre' : 'Unnamed Product')}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {domainLabel} <span className="mx-1">&middot;</span> {product.table}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
