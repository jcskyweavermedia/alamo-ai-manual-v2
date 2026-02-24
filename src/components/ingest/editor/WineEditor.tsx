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
import { WineImageEditor } from './WineImageEditor';
import { TranslationSheet } from './TranslationSheet';
import { TranslationBadge } from '../TranslationBadge';
import { useIngestDraft } from '@/contexts/IngestDraftContext';
import type { WineDraft } from '@/types/ingestion';

export function WineEditor() {
  const { state, dispatch } = useIngestDraft();
  const draft = state.draft as WineDraft;
  const productId = state.editingProductId;
  const [translateOpen, setTranslateOpen] = useState(false);

  const draftAsDbFormat = useMemo(() => ({
    tasting_notes: draft.tastingNotes,
    producer_notes: draft.producerNotes,
    notes: draft.notes,
  }), [draft.tastingNotes, draft.producerNotes, draft.notes]);

  return (
    <div className="space-y-4">
      <Accordion type="multiple" defaultValue={['identity', 'classification', 'notes', 'image', 'options', 'translation']}>
        {/* Wine Identity */}
        <AccordionItem value="identity">
          <AccordionTrigger className="text-base font-semibold tracking-tight">Wine Identity</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="wine-name">Name</Label>
                <Input
                  id="wine-name"
                  value={draft.name}
                  onChange={(e) => dispatch({ type: 'SET_NAME', payload: e.target.value })}
                  placeholder="e.g. Château Margaux"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wine-producer">Producer</Label>
                <Input
                  id="wine-producer"
                  value={draft.producer}
                  onChange={(e) => dispatch({ type: 'SET_WINE_PRODUCER', payload: e.target.value })}
                  placeholder="e.g. Château Margaux"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="wine-vintage">Vintage</Label>
                  <Input
                    id="wine-vintage"
                    value={draft.vintage ?? ''}
                    onChange={(e) => dispatch({
                      type: 'SET_WINE_VINTAGE',
                      payload: e.target.value.trim() || null,
                    })}
                    placeholder="NV for non-vintage"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="wine-varietal">Varietal</Label>
                  <Input
                    id="wine-varietal"
                    value={draft.varietal}
                    onChange={(e) => dispatch({ type: 'SET_WINE_VARIETAL', payload: e.target.value })}
                    placeholder="e.g. Cabernet Sauvignon"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  id="wine-blend"
                  checked={draft.blend}
                  onCheckedChange={(checked) => dispatch({ type: 'SET_WINE_BLEND', payload: checked })}
                />
                <Label htmlFor="wine-blend">Blend</Label>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Classification */}
        <AccordionItem value="classification">
          <AccordionTrigger className="text-base font-semibold tracking-tight">Classification</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="wine-style">Style</Label>
                  <Select
                    value={draft.style}
                    onValueChange={(v) => dispatch({ type: 'SET_WINE_STYLE', payload: v })}
                  >
                    <SelectTrigger id="wine-style">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="red">Red</SelectItem>
                      <SelectItem value="white">White</SelectItem>
                      <SelectItem value="rosé">Rosé</SelectItem>
                      <SelectItem value="sparkling">Sparkling</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="wine-body">Body</Label>
                  <Select
                    value={draft.body}
                    onValueChange={(v) => dispatch({ type: 'SET_WINE_BODY', payload: v })}
                  >
                    <SelectTrigger id="wine-body">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="full">Full</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wine-region">Region</Label>
                <Input
                  id="wine-region"
                  value={draft.region}
                  onChange={(e) => dispatch({ type: 'SET_WINE_REGION', payload: e.target.value })}
                  placeholder="e.g. Margaux, Bordeaux"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wine-country">Country</Label>
                <Input
                  id="wine-country"
                  value={draft.country}
                  onChange={(e) => dispatch({ type: 'SET_WINE_COUNTRY', payload: e.target.value })}
                  placeholder="e.g. France"
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Tasting & Notes */}
        <AccordionItem value="notes">
          <AccordionTrigger className="text-base font-semibold tracking-tight">Tasting & Notes</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="wine-tasting-notes">Tasting Notes</Label>
                <Textarea
                  id="wine-tasting-notes"
                  value={draft.tastingNotes}
                  onChange={(e) => dispatch({ type: 'SET_WINE_TASTING_NOTES', payload: e.target.value })}
                  placeholder="Aromas, palate, finish..."
                  rows={4}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wine-producer-notes">Producer Notes</Label>
                <Textarea
                  id="wine-producer-notes"
                  value={draft.producerNotes}
                  onChange={(e) => dispatch({ type: 'SET_WINE_PRODUCER_NOTES', payload: e.target.value })}
                  placeholder="Winemaking process, terroir..."
                  rows={3}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wine-notes">Service Notes</Label>
                <Textarea
                  id="wine-notes"
                  value={draft.notes}
                  onChange={(e) => dispatch({ type: 'SET_WINE_NOTES', payload: e.target.value })}
                  placeholder="Food pairings, serving temperature..."
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
            <WineImageEditor />
          </AccordionContent>
        </AccordionItem>

        {/* Options */}
        <AccordionItem value="options">
          <AccordionTrigger className="text-base font-semibold tracking-tight">Options</AccordionTrigger>
          <AccordionContent>
            <div className="flex items-center gap-3 pt-2">
              <Switch
                id="wine-top-seller"
                checked={draft.isTopSeller}
                onCheckedChange={(checked) => dispatch({ type: 'SET_WINE_TOP_SELLER', payload: checked })}
              />
              <Label htmlFor="wine-top-seller">Top Seller</Label>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Translation */}
        <AccordionItem value="translation">
          <AccordionTrigger className="text-base font-semibold tracking-tight">
            <span className="flex items-center gap-2">
              Translation
              <TranslationBadge
                productTable="wines"
                productId={productId}
                productData={draftAsDbFormat}
              />
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3 pt-2">
              <p className="text-sm text-muted-foreground">
                Translate tasting notes, producer notes, and service notes to Spanish using AI.
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
        productTable="wines"
        productId={productId}
        productData={draftAsDbFormat}
      />
    </div>
  );
}
