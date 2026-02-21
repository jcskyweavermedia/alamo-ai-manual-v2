import { cn } from '@/lib/utils';
import type { PrepRecipeDraft, WineDraft, CocktailDraft } from '@/types/ingestion';
import { isPrepRecipeDraft, isCocktailDraft } from '@/types/ingestion';

interface DraftPreviewCardProps {
  draft: PrepRecipeDraft | WineDraft | CocktailDraft;
}

export function DraftPreviewCard({ draft }: DraftPreviewCardProps) {
  if (isCocktailDraft(draft)) {
    return <CocktailPreviewCard draft={draft} />;
  }
  if (isPrepRecipeDraft(draft)) {
    return <PrepRecipePreviewCard draft={draft} />;
  }
  return <WinePreviewCard draft={draft} />;
}

function PrepRecipePreviewCard({ draft }: { draft: PrepRecipeDraft }) {
  const ingredientCount = draft.ingredients.reduce(
    (sum, group) => sum + group.items.length,
    0
  );
  const stepCount = draft.procedure.reduce(
    (sum, group) => sum + group.steps.length,
    0
  );

  return (
    <div className={cn(
      'rounded-xl border border-border bg-card p-4 space-y-3',
      'shadow-sm'
    )}>
      <div className="flex items-start gap-3">
        <span className="text-[24px] leading-none shrink-0">👨‍🍳</span>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-foreground truncate">
            {draft.name || 'Untitled Recipe'}
          </h4>
          <p className="text-xs text-muted-foreground capitalize">
            {draft.prepType || 'prep recipe'}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="text-[14px] leading-none">📦</span>
          <span>
            {draft.yieldQty > 0 ? `${draft.yieldQty} ${draft.yieldUnit}` : 'No yield set'}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="text-[14px] leading-none">🕐</span>
          <span>
            {draft.shelfLifeValue > 0
              ? `${draft.shelfLifeValue} ${draft.shelfLifeUnit}`
              : 'No shelf life'}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="text-[14px] leading-none">🥬</span>
          <span>{ingredientCount} ingredient{ingredientCount !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="text-[14px] leading-none">📋</span>
          <span>{stepCount} step{stepCount !== 1 ? 's' : ''}</span>
        </div>
      </div>
    </div>
  );
}

function WinePreviewCard({ draft }: { draft: WineDraft }) {
  return (
    <div className={cn(
      'rounded-xl border border-border bg-card p-4 space-y-3',
      'shadow-sm'
    )}>
      <div className="flex items-start gap-3">
        <span className="text-[24px] leading-none shrink-0">🍷</span>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-foreground truncate">
            {draft.name || 'Untitled Wine'}
          </h4>
          <p className="text-xs text-muted-foreground capitalize">
            {draft.style || 'wine'} {draft.body ? `· ${draft.body} body` : ''}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="text-[14px] leading-none">🍇</span>
          <span>{draft.varietal || 'No varietal'}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="text-[14px] leading-none">📍</span>
          <span>{draft.region || 'No region'}</span>
        </div>
      </div>
    </div>
  );
}

function CocktailPreviewCard({ draft }: { draft: CocktailDraft }) {
  const stepCount = draft.procedure.length;
  return (
    <div className={cn(
      'rounded-xl border border-border bg-card p-4 space-y-3',
      'shadow-sm'
    )}>
      <div className="flex items-start gap-3">
        <span className="text-[24px] leading-none shrink-0">🍸</span>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-foreground truncate">
            {draft.name || 'Untitled Cocktail'}
          </h4>
          <p className="text-xs text-muted-foreground capitalize">
            {draft.style || 'cocktail'} · {draft.glass || 'No glass'}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="text-[14px] leading-none">🧊</span>
          <span>{draft.keyIngredients || 'No key ingredients'}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="text-[14px] leading-none">📋</span>
          <span>{stepCount} step{stepCount !== 1 ? 's' : ''}</span>
        </div>
      </div>
    </div>
  );
}
