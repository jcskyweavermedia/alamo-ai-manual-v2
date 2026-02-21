import { cn } from '@/lib/utils';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { PRODUCT_TYPES, type ProductType } from '@/types/ingestion';

interface ProductTypeNavbarProps {
  activeType: ProductType;
  onTypeChange: (type: ProductType) => void;
  /** Product types that have unsaved drafts */
  dirtyTypes?: Set<ProductType>;
}

export function ProductTypeNavbar({
  activeType,
  onTypeChange,
  dirtyTypes,
}: ProductTypeNavbarProps) {
  return (
    <div className="flex gap-1 rounded-lg bg-muted p-1 overflow-x-auto scrollbar-none">
      {PRODUCT_TYPES.map((pt) => {
        const isActive = activeType === pt.key;
        const hasDraft = dirtyTypes?.has(pt.key);

        const pill = (
          <button
            key={pt.key}
            type="button"
            onClick={() => pt.enabled && onTypeChange(pt.key)}
            disabled={!pt.enabled}
            className={cn(
              'relative min-h-[36px] px-3 rounded-md text-xs font-semibold whitespace-nowrap',
              'transition-colors duration-150',
              pt.enabled
                ? isActive
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
                : 'text-muted-foreground/50 cursor-not-allowed'
            )}
          >
            {pt.label}
            {hasDraft && !isActive && (
              <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-primary" />
            )}
          </button>
        );

        if (!pt.enabled) {
          return (
            <Tooltip key={pt.key}>
              <TooltipTrigger asChild>{pill}</TooltipTrigger>
              <TooltipContent>Coming Soon</TooltipContent>
            </Tooltip>
          );
        }

        return pill;
      })}
    </div>
  );
}
