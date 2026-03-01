import { useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useIngestDraft } from '@/contexts/IngestDraftContext';
import type { PlateSpecDraft, FohPlateSpecDraft } from '@/types/ingestion';

// =============================================================================
// Chip Editor — reusable inline chip input for string arrays
// =============================================================================

interface ChipEditorProps {
  label: string;
  chips: string[];
  onChange: (chips: string[]) => void;
  placeholder?: string;
}

function ChipEditor({ label, chips, onChange, placeholder }: ChipEditorProps) {
  const [input, setInput] = useState('');

  const addChip = (value: string) => {
    const trimmed = value.trim();
    if (trimmed && !chips.includes(trimmed)) {
      onChange([...chips, trimmed]);
    }
    setInput('');
  };

  const removeChip = (chip: string) => {
    onChange(chips.filter((c) => c !== chip));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addChip(input);
    }
    if (e.key === 'Backspace' && !input && chips.length > 0) {
      removeChip(chips[chips.length - 1]);
    }
  };

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className={cn(
        'flex flex-wrap gap-1.5 p-2 min-h-[44px] rounded-md border border-input bg-background',
        'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2'
      )}>
        {chips.map((chip) => (
          <span
            key={chip}
            className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full',
              'text-xs font-medium bg-primary/10 text-primary'
            )}
          >
            {chip}
            <button
              type="button"
              onClick={() => removeChip(chip)}
              className="h-3.5 w-3.5 rounded-full flex items-center justify-center hover:bg-primary/20"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => input && addChip(input)}
          placeholder={chips.length === 0 ? (placeholder ?? 'Type + Enter to add') : ''}
          className="flex-1 min-w-[100px] border-0 p-0 h-6 focus-visible:ring-0 focus-visible:ring-offset-0"
        />
      </div>
    </div>
  );
}

// =============================================================================
// DishGuideEditor
// =============================================================================

export function DishGuideEditor() {
  const { state, dispatch } = useIngestDraft();
  const draft = state.draft as PlateSpecDraft;
  const dg = draft.dishGuide;

  if (!dg) {
    return (
      <p className="text-xs text-muted-foreground text-center py-4">
        No dish guide generated yet. Use the "Generate Dish Guide" button to create one.
      </p>
    );
  }

  const updateField = <K extends keyof FohPlateSpecDraft>(field: K, value: FohPlateSpecDraft[K]) => {
    dispatch({ type: 'UPDATE_DISH_GUIDE_FIELD', payload: { field, value } });
  };

  return (
    <div className="space-y-4">
      <div className={cn(
        "flex items-center justify-between rounded-lg border px-4 py-3 transition-colors",
        dg.isFeatured
          ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-800/40 dark:bg-emerald-950/20"
          : "bg-muted/30"
      )}>
        <span className="text-sm font-medium">Featured</span>
        <Switch
          id="dg-featured"
          checked={dg.isFeatured}
          onCheckedChange={(checked) => updateField('isFeatured', checked)}
        />
      </div>

      <Accordion type="multiple" defaultValue={['identity', 'descriptions', 'details', 'options']}>
        {/* Identity */}
        <AccordionItem value="identity">
          <AccordionTrigger className="text-base font-semibold tracking-tight">Dish Identity</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="dg-menu-name">Menu Name</Label>
                <Input
                  id="dg-menu-name"
                  value={dg.menuName}
                  onChange={(e) => updateField('menuName', e.target.value)}
                  placeholder="e.g. Prime Ribeye"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dg-short-desc">Short Description</Label>
                <Textarea
                  id="dg-short-desc"
                  value={dg.shortDescription}
                  onChange={(e) => updateField('shortDescription', e.target.value)}
                  placeholder="1-2 sentence appetizing menu copy..."
                  rows={2}
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Descriptions */}
        <AccordionItem value="descriptions">
          <AccordionTrigger className="text-base font-semibold tracking-tight">Descriptions</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="dg-detailed-desc">Detailed Description</Label>
                <Textarea
                  id="dg-detailed-desc"
                  value={dg.detailedDescription}
                  onChange={(e) => updateField('detailedDescription', e.target.value)}
                  placeholder="3-4 sentence server training description..."
                  rows={5}
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Details */}
        <AccordionItem value="details">
          <AccordionTrigger className="text-base font-semibold tracking-tight">Details</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4 pt-2">
              <ChipEditor
                label="Key Ingredients"
                chips={dg.keyIngredients}
                onChange={(v) => updateField('keyIngredients', v)}
                placeholder="e.g. ribeye, garlic butter..."
              />
              <ChipEditor
                label="Flavor Profile"
                chips={dg.flavorProfile}
                onChange={(v) => updateField('flavorProfile', v)}
                placeholder="e.g. smoky, rich, savory..."
              />
              <ChipEditor
                label="Allergens"
                chips={dg.allergens}
                onChange={(v) => updateField('allergens', v)}
                placeholder="e.g. dairy, gluten..."
              />
              <div className="space-y-1.5">
                <Label htmlFor="dg-allergy-notes">Allergy Notes</Label>
                <Textarea
                  id="dg-allergy-notes"
                  value={dg.allergyNotes}
                  onChange={(e) => updateField('allergyNotes', e.target.value)}
                  placeholder="Server allergy guidance..."
                  rows={2}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dg-upsell-notes">Upsell Notes</Label>
                <Textarea
                  id="dg-upsell-notes"
                  value={dg.upsellNotes}
                  onChange={(e) => updateField('upsellNotes', e.target.value)}
                  placeholder="Selling points, pairing suggestions..."
                  rows={2}
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Options */}
        <AccordionItem value="options">
          <AccordionTrigger className="text-base font-semibold tracking-tight">Options</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-3">
                <Switch
                  id="dg-top-seller"
                  checked={dg.isTopSeller}
                  onCheckedChange={(checked) => updateField('isTopSeller', checked)}
                />
                <Label htmlFor="dg-top-seller">Top Seller</Label>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dg-notes">Notes</Label>
                <Textarea
                  id="dg-notes"
                  value={dg.notes}
                  onChange={(e) => updateField('notes', e.target.value)}
                  placeholder="Additional notes..."
                  rows={2}
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
