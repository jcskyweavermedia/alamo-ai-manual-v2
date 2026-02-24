/**
 * TranslationSheet
 *
 * Bottom sheet for batch translation review. Shows all translatable fields for
 * a product, allows AI-powered translation and manual editing, and saves
 * results to the product_translations table.
 *
 * Phase 6: Translation System
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Globe, Loader2, AlertTriangle, Check, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

import {
  extractTranslatableTexts,
  getFieldValue,
  type TranslatableText,
} from '@/lib/translatable-fields';
import {
  useProductTranslations,
  isTranslationStale,
} from '@/hooks/use-product-translations';
import { useTranslateProduct } from '@/hooks/use-translate-product';

// =============================================================================
// TYPES
// =============================================================================

interface TranslationSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productTable: string;
  productId: string | null;
  productData: Record<string, unknown>;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Group an array of TranslatableText items by their `label` prefix.
 * Items whose label includes " - " are grouped by the part before the dash;
 * items without a dash form their own group keyed by the full label.
 */
function groupByLabel(items: TranslatableText[]): Map<string, TranslatableText[]> {
  const groups = new Map<string, TranslatableText[]>();

  for (const item of items) {
    // Use the label directly as the group key.
    // Procedure steps share a base label like "Procedure Steps - Group 1, Step 2"
    // so we group by the portion before " - " if it exists.
    const dashIdx = item.label.indexOf(' - ');
    const groupKey = dashIdx !== -1 ? item.label.slice(0, dashIdx) : item.label;

    const list = groups.get(groupKey) ?? [];
    list.push(item);
    groups.set(groupKey, list);
  }

  return groups;
}

/** Truncate text to a max length, appending an ellipsis if needed. */
function truncateText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).trimEnd() + '...';
}

// =============================================================================
// STATUS BADGE (internal)
// =============================================================================

type FieldStatus = 'new' | 'approved' | 'stale';

function FieldStatusIndicator({ status }: { status: FieldStatus }) {
  if (status === 'stale') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-medium text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
        <AlertTriangle className="h-3 w-3" />
        Stale
      </span>
    );
  }

  if (status === 'approved') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
        <Check className="h-3 w-3" />
        Approved
      </span>
    );
  }

  // new
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
      New
    </span>
  );
}

// =============================================================================
// COMPONENT
// =============================================================================

export function TranslationSheet({
  open,
  onOpenChange,
  productTable,
  productId,
  productData,
}: TranslationSheetProps) {
  // ---------------------------------------------------------------------------
  // Hooks
  // ---------------------------------------------------------------------------
  const { translations, loading, refetch } = useProductTranslations(
    productTable,
    productId,
  );
  const { translateFields, saveTranslations, translating, saving } =
    useTranslateProduct();

  // ---------------------------------------------------------------------------
  // Translatable fields extraction
  // ---------------------------------------------------------------------------
  const translatableTexts = useMemo(
    () => extractTranslatableTexts(productTable, productData),
    [productTable, productData],
  );

  const groupedFields = useMemo(
    () => groupByLabel(translatableTexts),
    [translatableTexts],
  );

  // ---------------------------------------------------------------------------
  // Local draft state: Map<fieldPath, translatedText>
  // ---------------------------------------------------------------------------
  const [drafts, setDrafts] = useState<Map<string, string>>(new Map());

  // Expanded state for long English source texts
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());

  // Reset local drafts when the sheet opens or translations change
  useEffect(() => {
    if (!open) return;

    const initial = new Map<string, string>();
    for (const field of translatableTexts) {
      const existing = translations.get(field.fieldPath);
      if (existing) {
        initial.set(field.fieldPath, existing.translatedText);
      }
    }
    setDrafts(initial);
    setExpandedPaths(new Set());
  }, [open, translations, translatableTexts]);

  // ---------------------------------------------------------------------------
  // Status resolver
  // ---------------------------------------------------------------------------
  const getStatus = useCallback(
    (fieldPath: string): FieldStatus => {
      const row = translations.get(fieldPath);
      if (!row) return 'new';

      const currentText = getFieldValue(productData, fieldPath);
      if (currentText !== null && isTranslationStale(row, currentText)) {
        return 'stale';
      }
      return row.isApproved ? 'approved' : 'new';
    },
    [translations, productData],
  );

  // ---------------------------------------------------------------------------
  // Translate All
  // ---------------------------------------------------------------------------
  const handleTranslateAll = async () => {
    if (!productId) return;

    // Identify fields that are empty or stale
    const fieldsToTranslate = translatableTexts.filter((f) => {
      const draft = drafts.get(f.fieldPath);
      const status = getStatus(f.fieldPath);
      return !draft?.trim() || status === 'stale';
    });

    if (fieldsToTranslate.length === 0) {
      toast.info('All fields already have up-to-date translations');
      return;
    }

    const results = await translateFields(
      productTable,
      productId,
      fieldsToTranslate.map((f) => ({
        fieldPath: f.fieldPath,
        sourceText: f.sourceText,
      })),
    );

    if (results.length > 0) {
      setDrafts((prev) => {
        const next = new Map(prev);
        for (const r of results) {
          next.set(r.fieldPath, r.translatedText);
        }
        return next;
      });
      toast.success(`${results.length} field(s) translated`);
    }
  };

  // ---------------------------------------------------------------------------
  // Save All
  // ---------------------------------------------------------------------------
  const handleSaveAll = async () => {
    if (!productId) return;

    const toSave: Array<{
      fieldPath: string;
      sourceText: string;
      translatedText: string;
    }> = [];

    for (const field of translatableTexts) {
      const translated = drafts.get(field.fieldPath);
      if (translated && translated.trim()) {
        toSave.push({
          fieldPath: field.fieldPath,
          sourceText: field.sourceText,
          translatedText: translated,
        });
      }
    }

    if (toSave.length === 0) {
      toast.info('No translations to save');
      return;
    }

    const success = await saveTranslations(productTable, productId, toSave);
    if (success) {
      await refetch();
    }
  };

  // ---------------------------------------------------------------------------
  // Draft update
  // ---------------------------------------------------------------------------
  const updateDraft = (fieldPath: string, value: string) => {
    setDrafts((prev) => {
      const next = new Map(prev);
      next.set(fieldPath, value);
      return next;
    });
  };

  // ---------------------------------------------------------------------------
  // Toggle expand for source text
  // ---------------------------------------------------------------------------
  const toggleExpand = (fieldPath: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(fieldPath)) {
        next.delete(fieldPath);
      } else {
        next.add(fieldPath);
      }
      return next;
    });
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  const isDisabled = !productId;
  const isBusy = translating || saving;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[85vh] flex flex-col rounded-t-xl p-0"
      >
        {/* Header */}
        <SheetHeader className="flex flex-row items-center justify-between px-4 pt-4 pb-2 border-b border-border shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Globe className="h-5 w-5 text-primary shrink-0" />
            <SheetTitle className="text-base font-semibold">
              Translate to Spanish
            </SheetTitle>
          </div>
          <SheetDescription className="sr-only">
            Review and edit Spanish translations for each field
          </SheetDescription>
        </SheetHeader>

        {/* Unsaved product message */}
        {isDisabled && (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            Save the product first to enable translations.
          </div>
        )}

        {/* Loading state */}
        {!isDisabled && loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Main content */}
        {!isDisabled && !loading && (
          <>
            {/* Action buttons */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleTranslateAll}
                disabled={isBusy || translatableTexts.length === 0}
              >
                {translating ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                )}
                Translate All
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleSaveAll}
                disabled={isBusy}
              >
                {saving ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="mr-1.5 h-3.5 w-3.5" />
                )}
                Save All
              </Button>
            </div>

            {/* Scrollable field list */}
            <ScrollArea className="flex-1 min-h-0">
              <div className="px-4 py-3 space-y-6">
                {translatableTexts.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No translatable fields found for this product type.
                  </p>
                )}

                {Array.from(groupedFields.entries()).map(([groupLabel, fields]) => (
                  <div key={groupLabel} className="space-y-3">
                    {/* Group heading */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {groupLabel}
                      </span>
                      <div className="flex-1 h-px bg-border" />
                    </div>

                    {/* Field rows */}
                    {fields.map((field) => {
                      const status = getStatus(field.fieldPath);
                      const draftValue = drafts.get(field.fieldPath) ?? '';
                      const isExpanded = expandedPaths.has(field.fieldPath);
                      const SOURCE_TRUNCATE_LEN = 120;
                      const isLong = field.sourceText.length > SOURCE_TRUNCATE_LEN;

                      // Sub-label (the part after " - ", if present)
                      const dashIdx = field.label.indexOf(' - ');
                      const subLabel = dashIdx !== -1 ? field.label.slice(dashIdx + 3) : null;

                      return (
                        <div
                          key={field.fieldPath}
                          className="space-y-1.5 rounded-lg border border-border bg-muted/30 p-3"
                        >
                          {/* Sub-label if present */}
                          {subLabel && (
                            <p className="text-[11px] font-medium text-muted-foreground">
                              {subLabel}
                            </p>
                          )}

                          {/* English source (read-only) */}
                          <div className="text-sm text-foreground/80 leading-relaxed">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mr-1.5">
                              EN:
                            </span>
                            {isLong && !isExpanded
                              ? truncateText(field.sourceText, SOURCE_TRUNCATE_LEN)
                              : field.sourceText}
                            {isLong && (
                              <button
                                type="button"
                                onClick={() => toggleExpand(field.fieldPath)}
                                className="ml-1 text-[11px] text-primary hover:underline"
                              >
                                {isExpanded ? 'Show less' : 'Show more'}
                              </button>
                            )}
                          </div>

                          {/* Spanish translation textarea */}
                          <Textarea
                            value={draftValue}
                            onChange={(e) =>
                              updateDraft(field.fieldPath, e.target.value)
                            }
                            placeholder="Spanish translation..."
                            className={cn(
                              'text-sm min-h-[60px] resize-y',
                              status === 'stale' && draftValue && 'border-orange-400',
                            )}
                            disabled={isBusy}
                          />

                          {/* Status indicator */}
                          <div className="flex items-center">
                            <FieldStatusIndicator status={status} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Footer */}
            <SheetFooter className="flex flex-row items-center justify-end gap-2 px-4 py-3 border-t border-border shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={isBusy}
              >
                Cancel
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleSaveAll}
                disabled={isBusy}
              >
                {saving ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="mr-1.5 h-3.5 w-3.5" />
                )}
                Save Translations
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
