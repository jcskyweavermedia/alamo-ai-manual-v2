import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { MarkdownRenderer } from '@/components/manual/MarkdownRenderer';
import { DishCardView } from '@/components/dishes/DishCardView';
import { WineCardView } from '@/components/wines/WineCardView';
import { CocktailCardView } from '@/components/cocktails/CocktailCardView';
import { BeerLiquorCardView } from '@/components/beer-liquor/BeerLiquorCardView';
import { RecipeCardView } from '@/components/recipes/RecipeCardView';
import type { ContentSource, CourseSection } from '@/types/training';
import type {
  Dish,
  Wine,
  Cocktail,
  BeerLiquorItem,
  Recipe,
} from '@/types/products';

const noop = () => {};
const noopAction = (_: string | null) => {};

interface ContentPanelProps {
  section: CourseSection;
  contentSource: ContentSource;
  contentItems: any[];
  currentItem: any;
  itemIndex: number;
  totalItems: number;
  onItemChange: (index: number) => void;
  language: 'en' | 'es';
  className?: string;
}

export function ContentPanel({
  section,
  contentSource,
  contentItems,
  currentItem,
  itemIndex,
  totalItems,
  onItemChange,
  language,
  className,
}: ContentPanelProps) {
  const showItemNav = totalItems > 1;

  const renderItemNav = () => {
    if (!showItemNav) return null;
    return (
      <div className="flex items-center justify-between px-4 py-2 border-b shrink-0">
        <Button
          variant="ghost"
          size="sm"
          disabled={itemIndex <= 0}
          onClick={() => onItemChange(itemIndex - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-xs text-muted-foreground font-medium">
          {language === 'es'
            ? `Elemento ${itemIndex + 1} de ${totalItems}`
            : `Item ${itemIndex + 1} of ${totalItems}`}
        </span>
        <Button
          variant="ghost"
          size="sm"
          disabled={itemIndex >= totalItems - 1}
          onClick={() => onItemChange(itemIndex + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    );
  };

  // Manual section content → MarkdownRenderer
  if (contentSource === 'manual_sections') {
    const manualItem = currentItem as {
      content_en: string | null;
      content_es: string | null;
    } | null;
    const content = manualItem
      ? language === 'es' && manualItem.content_es
        ? manualItem.content_es
        : (manualItem.content_en ?? '')
      : '';
    return (
      <div className={cn('flex flex-col h-full', className)}>
        {renderItemNav()}
        <div className="flex-1 overflow-y-auto p-4">
          <MarkdownRenderer content={content} />
        </div>
      </div>
    );
  }

  // Custom content → AI-only view
  if (contentSource === 'custom') {
    const desc =
      language === 'es' && section.descriptionEs
        ? section.descriptionEs
        : section.descriptionEn;
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center h-full text-center gap-3 p-6',
          className
        )}
      >
        <p className="text-sm text-muted-foreground">{desc}</p>
        <p className="text-xs text-muted-foreground/60">
          {language === 'es'
            ? 'Usa el chat del maestro IA para esta lección.'
            : 'Use the AI teacher chat for this lesson.'}
        </p>
      </div>
    );
  }

  // No content loaded yet
  if (!currentItem) {
    return (
      <div
        className={cn(
          'flex items-center justify-center h-full',
          className
        )}
      >
        <p className="text-sm text-muted-foreground">
          {language === 'es' ? 'Cargando contenido...' : 'Loading content...'}
        </p>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {renderItemNav()}
      <div className="flex-1 overflow-y-auto">
        {contentSource === 'foh_plate_specs' && (
          <DishCardView
            dish={currentItem as Dish}
            onBack={noop}
            activeAction={null}
            onActionChange={noopAction}
          />
        )}
        {contentSource === 'wines' && (
          <WineCardView
            wine={currentItem as Wine}
            onBack={noop}
            activeAction={null}
            onActionChange={noopAction}
          />
        )}
        {contentSource === 'cocktails' && (
          <CocktailCardView
            cocktail={currentItem as Cocktail}
            onBack={noop}
            activeAction={null}
            onActionChange={noopAction}
          />
        )}
        {contentSource === 'beer_liquor_list' && (
          <BeerLiquorCardView
            item={currentItem as BeerLiquorItem}
            onBack={noop}
            activeAction={null}
            onActionChange={noopAction}
          />
        )}
        {(contentSource === 'prep_recipes' ||
          contentSource === 'plate_specs') && (
          <RecipeCardView
            recipe={currentItem as Recipe}
            batchMultiplier={1}
            onBatchChange={noop}
            onBack={noop}
            activeAction={null}
            onActionChange={noopAction}
          />
        )}
      </div>
    </div>
  );
}
