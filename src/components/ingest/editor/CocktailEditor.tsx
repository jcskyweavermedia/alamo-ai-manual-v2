import { useState, useMemo } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CocktailImageEditor } from './CocktailImageEditor';
import { CocktailProcedureEditor } from './CocktailProcedureEditor';
import { IngredientsEditor } from './IngredientsEditor';
import { TranslationSheet } from './TranslationSheet';
import { TranslationBadge } from '../TranslationBadge';
import { useIngestDraft } from '@/contexts/IngestDraftContext';
import type { CocktailDraft } from '@/types/ingestion';

export function CocktailEditor() {
  const { state, dispatch } = useIngestDraft();
  const draft = state.draft as CocktailDraft;
  const productId = state.editingProductId;
  const [translateOpen, setTranslateOpen] = useState(false);

  const draftAsDbFormat = useMemo(() => ({
    procedure: draft.procedure,
    tasting_notes: draft.tastingNotes,
    description: draft.description,
    notes: draft.notes,
  }), [draft.procedure, draft.tastingNotes, draft.description, draft.notes]);

  return (
    <div className="space-y-4">
      <div className={cn(
        "flex items-center justify-between rounded-lg border px-4 py-3 transition-colors",
        draft.isFeatured
          ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-800/40 dark:bg-emerald-950/20"
          : "bg-muted/30"
      )}>
        <span className="text-sm font-medium">Featured</span>
        <Switch
          id="cocktail-featured"
          checked={draft.isFeatured}
          onCheckedChange={(checked) => dispatch({ type: 'SET_COCKTAIL_FEATURED', payload: checked })}
        />
      </div>

      <Accordion type="multiple" defaultValue={['info', 'ingredients', 'method', 'tasting', 'image', 'options', 'translation']}>
        {/* Cocktail Info */}
        <AccordionItem value="info">
          <AccordionTrigger className="text-base font-semibold tracking-tight">Cocktail Info</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="cocktail-name">Name</Label>
                <Input
                  id="cocktail-name"
                  value={draft.name}
                  onChange={(e) => dispatch({ type: 'SET_NAME', payload: e.target.value })}
                  placeholder="e.g., Old Fashioned"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="cocktail-style">Style</Label>
                  <Select
                    value={draft.style}
                    onValueChange={(v) => dispatch({ type: 'SET_COCKTAIL_STYLE', payload: v as CocktailDraft['style'] })}
                  >
                    <SelectTrigger id="cocktail-style">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="classic">Classic</SelectItem>
                      <SelectItem value="modern">Modern</SelectItem>
                      <SelectItem value="tiki">Tiki</SelectItem>
                      <SelectItem value="refresher">Refresher</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cocktail-glass">Glass</Label>
                  <Input
                    id="cocktail-glass"
                    value={draft.glass}
                    onChange={(e) => dispatch({ type: 'SET_COCKTAIL_GLASS', payload: e.target.value })}
                    placeholder="e.g., Rocks, Coupe, Highball"
                  />
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Ingredients — structured JSONB editor (same as prep recipes) */}
        <AccordionItem value="ingredients">
          <AccordionTrigger className="text-base font-semibold tracking-tight">Ingredients</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4 pt-2">
              <IngredientsEditor
                groups={draft.ingredients}
                department="bar"
                onAddGroup={(name) => dispatch({ type: 'ADD_INGREDIENT_GROUP', payload: name })}
                onRemoveGroup={(i) => dispatch({ type: 'REMOVE_INGREDIENT_GROUP', payload: i })}
                onRenameGroup={(i, name) => dispatch({ type: 'RENAME_INGREDIENT_GROUP', payload: { index: i, name } })}
                onMoveGroupUp={(i) => dispatch({ type: 'MOVE_GROUP_UP', payload: i })}
                onMoveGroupDown={(i) => dispatch({ type: 'MOVE_GROUP_DOWN', payload: i })}
                onAddIngredient={(gi) => dispatch({ type: 'ADD_INGREDIENT', payload: { groupIndex: gi } })}
                onUpdateIngredient={(gi, ii, item) => dispatch({ type: 'UPDATE_INGREDIENT', payload: { groupIndex: gi, itemIndex: ii, item } })}
                onRemoveIngredient={(gi, ii) => dispatch({ type: 'REMOVE_INGREDIENT', payload: { groupIndex: gi, itemIndex: ii } })}
                onMoveIngredientUp={(gi, ii) => dispatch({ type: 'MOVE_INGREDIENT_UP', payload: { groupIndex: gi, itemIndex: ii } })}
                onMoveIngredientDown={(gi, ii) => dispatch({ type: 'MOVE_INGREDIENT_DOWN', payload: { groupIndex: gi, itemIndex: ii } })}
              />
              <div className="space-y-1.5">
                <Label htmlFor="cocktail-key-ingredients">Key Ingredients</Label>
                <Input
                  id="cocktail-key-ingredients"
                  value={draft.keyIngredients}
                  onChange={(e) => dispatch({ type: 'SET_COCKTAIL_KEY_INGREDIENTS', payload: e.target.value })}
                  placeholder="Primary spirits/mixers, e.g., Bourbon, Angostura bitters"
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Method */}
        <AccordionItem value="method">
          <AccordionTrigger className="text-base font-semibold tracking-tight">Method</AccordionTrigger>
          <AccordionContent>
            <CocktailProcedureEditor
              steps={draft.procedure}
              onChange={(steps) => dispatch({ type: 'SET_COCKTAIL_PROCEDURE', payload: steps })}
            />
          </AccordionContent>
        </AccordionItem>

        {/* Tasting & Description */}
        <AccordionItem value="tasting">
          <AccordionTrigger className="text-base font-semibold tracking-tight">Tasting & Description</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="cocktail-tasting-notes">Tasting Notes</Label>
                <Textarea
                  id="cocktail-tasting-notes"
                  value={draft.tastingNotes}
                  onChange={(e) => dispatch({ type: 'SET_COCKTAIL_TASTING_NOTES', payload: e.target.value })}
                  placeholder="Flavor profile, aromas, finish..."
                  rows={3}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cocktail-description">Description</Label>
                <Textarea
                  id="cocktail-description"
                  value={draft.description}
                  onChange={(e) => dispatch({ type: 'SET_COCKTAIL_DESCRIPTION', payload: e.target.value })}
                  placeholder="Cocktail history, story, or context"
                  rows={3}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cocktail-notes">Notes</Label>
                <Textarea
                  id="cocktail-notes"
                  value={draft.notes}
                  onChange={(e) => dispatch({ type: 'SET_COCKTAIL_NOTES', payload: e.target.value })}
                  placeholder="Service notes, garnish details, technique tips..."
                  rows={3}
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Image */}
        <AccordionItem value="image">
          <AccordionTrigger className="text-base font-semibold tracking-tight">
            Image
            {draft.image && (
              <span className="ml-2 text-xs text-muted-foreground font-normal">(1 photo)</span>
            )}
          </AccordionTrigger>
          <AccordionContent>
            <CocktailImageEditor />
          </AccordionContent>
        </AccordionItem>

        {/* Options */}
        <AccordionItem value="options">
          <AccordionTrigger className="text-base font-semibold tracking-tight">Options</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-3">
                <Switch
                  id="cocktail-top-seller"
                  checked={draft.isTopSeller}
                  onCheckedChange={(checked) => dispatch({ type: 'SET_COCKTAIL_TOP_SELLER', payload: checked })}
                />
                <Label htmlFor="cocktail-top-seller">Top Seller</Label>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Translation */}
        <AccordionItem value="translation">
          <AccordionTrigger className="text-base font-semibold tracking-tight">
            <span className="flex items-center gap-2">
              Translation
              <TranslationBadge
                productTable="cocktails"
                productId={productId}
                productData={draftAsDbFormat}
              />
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3 pt-2">
              <p className="text-sm text-muted-foreground">
                Translate procedure, tasting notes, description, and notes to Spanish using AI.
              </p>
              <Button
                variant="outline"
                onClick={() => setTranslateOpen(true)}
                className="w-full"
              >
                <Globe className="h-4 w-4 mr-2" />
                Open Translation Panel
              </Button>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <TranslationSheet
        open={translateOpen}
        onOpenChange={setTranslateOpen}
        productTable="cocktails"
        productId={productId}
        productData={draftAsDbFormat}
      />
    </div>
  );
}
