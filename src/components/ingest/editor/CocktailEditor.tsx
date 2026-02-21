import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CocktailImageEditor } from './CocktailImageEditor';
import { CocktailProcedureEditor } from './CocktailProcedureEditor';
import { useIngestDraft } from '@/contexts/IngestDraftContext';
import type { CocktailDraft } from '@/types/ingestion';

export function CocktailEditor() {
  const { state, dispatch } = useIngestDraft();
  const draft = state.draft as CocktailDraft;

  return (
    <div className="space-y-4">
      <Accordion type="multiple" defaultValue={['info', 'ingredients', 'method', 'tasting', 'image', 'options']}>
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

        {/* Ingredients */}
        <AccordionItem value="ingredients">
          <AccordionTrigger className="text-base font-semibold tracking-tight">Ingredients</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="cocktail-ingredients">Ingredients</Label>
                <Textarea
                  id="cocktail-ingredients"
                  value={draft.ingredients}
                  onChange={(e) => dispatch({ type: 'SET_COCKTAIL_INGREDIENTS', payload: e.target.value })}
                  placeholder={"List all ingredients with measurements, one per line\ne.g., 2 oz Bourbon\n0.5 oz Demerara syrup\n2 dashes Angostura bitters"}
                  rows={5}
                />
              </div>
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
            <div className="flex items-center gap-3 pt-2">
              <Switch
                id="cocktail-top-seller"
                checked={draft.isTopSeller}
                onCheckedChange={(checked) => dispatch({ type: 'SET_COCKTAIL_TOP_SELLER', payload: checked })}
              />
              <Label htmlFor="cocktail-top-seller">Top Seller</Label>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
