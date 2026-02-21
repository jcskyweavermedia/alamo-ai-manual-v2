import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import type { PrepRecipeDraft } from '@/types/ingestion';
import { generateSlug } from '@/types/ingestion';

const PREP_TYPES = ['sauce', 'marinade', 'brine', 'stock', 'dressing', 'garnish', 'protein', 'starch', 'vegetable', 'dessert', 'other'];
const YIELD_UNITS = ['qt', 'gal', 'cups', 'oz', 'lb', 'kg', 'L', 'ea', 'portions'];
const SHELF_LIFE_UNITS = ['days', 'hours', 'weeks'];

interface MetadataFieldsProps {
  draft: PrepRecipeDraft;
  onNameChange: (name: string) => void;
  onPrepTypeChange: (type: string) => void;
  onYieldChange: (qty: number, unit: string) => void;
  onShelfLifeChange: (value: number, unit: string) => void;
}

export function MetadataFields({
  draft,
  onNameChange,
  onPrepTypeChange,
  onYieldChange,
  onShelfLifeChange,
}: MetadataFieldsProps) {
  return (
    <div className="space-y-4">
      {/* Recipe Name */}
      <div className="space-y-1.5">
        <Label htmlFor="recipe-name">Recipe Name</Label>
        <Input
          id="recipe-name"
          value={draft.name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="e.g. Chimichurri Sauce"
        />
        {draft.name && (
          <p className="text-xs text-muted-foreground">
            Slug: <code className="bg-muted px-1 rounded">{generateSlug(draft.name)}</code>
          </p>
        )}
      </div>

      {/* Prep Type */}
      <div className="space-y-1.5">
        <Label>Prep Type</Label>
        <Select value={draft.prepType} onValueChange={onPrepTypeChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            {PREP_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Yield */}
      <div className="space-y-1.5">
        <Label>Yield</Label>
        <div className="flex gap-2">
          <Input
            type="number"
            min={0}
            step="any"
            value={draft.yieldQty || ''}
            onChange={(e) => onYieldChange(parseFloat(e.target.value) || 0, draft.yieldUnit)}
            placeholder="Qty"
            className="w-24"
          />
          <Select value={draft.yieldUnit} onValueChange={(u) => onYieldChange(draft.yieldQty, u)}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YIELD_UNITS.map((u) => (
                <SelectItem key={u} value={u}>{u}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Shelf Life */}
      <div className="space-y-1.5">
        <Label>Shelf Life</Label>
        <div className="flex gap-2">
          <Input
            type="number"
            min={0}
            value={draft.shelfLifeValue || ''}
            onChange={(e) => onShelfLifeChange(parseInt(e.target.value) || 0, draft.shelfLifeUnit)}
            placeholder="Value"
            className="w-24"
          />
          <Select value={draft.shelfLifeUnit} onValueChange={(u) => onShelfLifeChange(draft.shelfLifeValue, u)}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SHELF_LIFE_UNITS.map((u) => (
                <SelectItem key={u} value={u}>{u}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
