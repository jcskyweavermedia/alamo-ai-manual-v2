import { Check, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PlateSpecIngestPreview } from './PlateSpecIngestPreview';
import { DishGuideIngestPreview } from './DishGuideIngestPreview';
import type { PlateSpecDraft } from '@/types/ingestion';

interface PlateSpecDualPreviewProps {
  draft: PlateSpecDraft;
  onSwitchToEdit: () => void;
  productId?: string | null;
}

export function PlateSpecDualPreview({ draft, onSwitchToEdit, productId }: PlateSpecDualPreviewProps) {
  const hasDishGuide = draft.dishGuide != null;
  const hasPlateSpecContent = draft.name !== '' || draft.components.length > 0;
  const isStale = draft.dishGuideStale === true;

  return (
    <Tabs defaultValue="plate-spec" className="w-full">
      <TabsList className="w-full">
        <TabsTrigger value="plate-spec" className="flex-1 gap-1.5">
          BOH Plate Spec
          {hasPlateSpecContent && (
            <Check className={cn('h-3.5 w-3.5 text-emerald-500')} />
          )}
        </TabsTrigger>
        <TabsTrigger
          value="dish-guide"
          className="flex-1 gap-1.5"
          disabled={!hasDishGuide}
        >
          <span className={cn(!hasDishGuide && 'opacity-50')}>
            FOH Plate Spec
          </span>
          {hasDishGuide && isStale && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-600">
              <AlertTriangle className="h-3 w-3" />
              Needs Update
            </span>
          )}
          {hasDishGuide && !isStale && (
            <Check className={cn('h-3.5 w-3.5 text-emerald-500')} />
          )}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="plate-spec">
        <PlateSpecIngestPreview
          draft={draft}
          onSwitchToEdit={onSwitchToEdit}
          productId={productId}
        />
      </TabsContent>

      <TabsContent value="dish-guide">
        {hasDishGuide && (
          <DishGuideIngestPreview
            draft={draft.dishGuide!}
            onSwitchToEdit={onSwitchToEdit}
            productId={productId}
          />
        )}
      </TabsContent>
    </Tabs>
  );
}
