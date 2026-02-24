import { useState } from 'react';
import { ChevronUp, ChevronDown, Trash2, Plus, X, Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SubRecipeLinker } from './SubRecipeLinker';
import type { PlateComponentGroup, PlateComponent } from '@/types/products';

// =============================================================================
// Constants
// =============================================================================

const COMPONENT_UNITS = ['oz', 'pc', 'ptn', 'sprig', 'tbsp', 'tsp', 'cup', 'lb', 'ea', 'g', 'ml', ''];

// =============================================================================
// Component Item Row
// =============================================================================

interface ComponentItemRowProps {
  item: PlateComponent;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  onUpdate: (item: PlateComponent) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

function ComponentItemRow({
  item,
  index,
  isFirst,
  isLast,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
}: ComponentItemRowProps) {
  const isLinked = item.type === 'prep_recipe' && !!item.prep_recipe_ref;

  const handleLink = (slug: string, name: string) => {
    const currentName = item.name.trim();
    if (currentName && currentName !== name) {
      const confirmed = window.confirm(
        `Replace "${currentName}" with sub-recipe "${name}"?`
      );
      if (!confirmed) return;
    }
    onUpdate({
      ...item,
      type: 'prep_recipe',
      name,
      prep_recipe_ref: slug,
    });
  };

  const handleUnlink = () => {
    onUpdate({ ...item, type: 'raw', prep_recipe_ref: undefined });
  };

  return (
    <div className={cn('flex items-center gap-1.5 py-1 group', 'min-h-[44px]')}>
      {/* Reorder arrows */}
      <div className="flex items-center gap-0.5 shrink-0">
        <button
          type="button"
          disabled={isFirst}
          onClick={onMoveUp}
          aria-label="Move item up"
          className={cn(
            'flex items-center justify-center h-6 w-6 rounded-full transition-colors',
            isFirst
              ? 'text-muted-foreground/30 cursor-not-allowed'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          disabled={isLast}
          onClick={onMoveDown}
          aria-label="Move item down"
          className={cn(
            'flex items-center justify-center h-6 w-6 rounded-full transition-colors',
            isLast
              ? 'text-muted-foreground/30 cursor-not-allowed'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Type select */}
      <Select
        value={item.type}
        onValueChange={(v) => onUpdate({
          ...item,
          type: v as 'raw' | 'prep_recipe',
          // Clear prep_recipe_ref when switching to raw
          ...(v === 'raw' ? { prep_recipe_ref: undefined } : {}),
        })}
      >
        <SelectTrigger className="w-[88px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="raw">Raw</SelectItem>
          <SelectItem value="prep_recipe">Prep</SelectItem>
        </SelectContent>
      </Select>

      {/* Quantity */}
      <Input
        type="number"
        min={0}
        step="any"
        value={item.quantity || ''}
        onChange={(e) => onUpdate({ ...item, quantity: parseFloat(e.target.value) || 0 })}
        placeholder="Qty"
        className="w-16 text-xs"
      />

      {/* Unit */}
      <Select
        value={item.unit}
        onValueChange={(u) => onUpdate({ ...item, unit: u })}
      >
        <SelectTrigger className="w-20 text-xs">
          <SelectValue placeholder="Unit" />
        </SelectTrigger>
        <SelectContent>
          {COMPONENT_UNITS.map((u) => (
            <SelectItem key={u || '__empty'} value={u || ' '}>
              {u || '(none)'}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Name — non-editable display when linked, regular input when not */}
      {isLinked ? (
        <div className={cn(
          'flex items-center gap-1.5 flex-1 px-3 py-2 rounded-md text-xs',
          'border border-emerald-500/60 bg-emerald-50 dark:bg-emerald-950/30',
          'text-emerald-800 dark:text-emerald-200'
        )}>
          <Link2 className="h-3 w-3 text-emerald-600 shrink-0" />
          <span className="truncate font-medium">{item.name}</span>
        </div>
      ) : (
        <Input
          value={item.name}
          onChange={(e) => onUpdate({ ...item, name: e.target.value })}
          placeholder="Component name"
          className="flex-1 text-xs"
        />
      )}

      {/* Sub-recipe linker (for prep_recipe type items) */}
      {item.type === 'prep_recipe' && (
        <SubRecipeLinker
          currentRef={item.prep_recipe_ref}
          currentRefName={isLinked ? item.name : undefined}
          onLink={handleLink}
          onUnlink={handleUnlink}
        />
      )}

      {/* Delete */}
      <Button
        variant="ghost"
        size="icon"
        aria-label="Remove item"
        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
        onClick={onRemove}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

// =============================================================================
// Component Group Card
// =============================================================================

interface ComponentGroupCardProps {
  group: PlateComponentGroup;
  groupIndex: number;
  isFirst: boolean;
  isLast: boolean;
  onRename: (name: string) => void;
  onRemoveGroup: () => void;
  onMoveGroupUp: () => void;
  onMoveGroupDown: () => void;
  onAddItem: () => void;
  onUpdateItem: (itemIndex: number, item: PlateComponent) => void;
  onRemoveItem: (itemIndex: number) => void;
  onMoveItemUp: (itemIndex: number) => void;
  onMoveItemDown: (itemIndex: number) => void;
}

function ComponentGroupCard({
  group,
  groupIndex,
  isFirst,
  isLast,
  onRename,
  onRemoveGroup,
  onMoveGroupUp,
  onMoveGroupDown,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
  onMoveItemUp,
  onMoveItemDown,
}: ComponentGroupCardProps) {
  const [isEditingName, setIsEditingName] = useState(false);

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      {/* Group header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b border-border/40">
        <span className={cn(
          'flex items-center justify-center shrink-0',
          'w-6 h-6 rounded-full text-[11px] font-bold',
          'bg-amber-500 text-white'
        )}>
          {groupIndex + 1}
        </span>

        {isEditingName ? (
          <Input
            value={group.group_name}
            onChange={(e) => onRename(e.target.value)}
            onBlur={() => setIsEditingName(false)}
            onKeyDown={(e) => e.key === 'Enter' && setIsEditingName(false)}
            autoFocus
            className="h-7 text-xs font-semibold flex-1"
          />
        ) : (
          <button
            type="button"
            onClick={() => setIsEditingName(true)}
            className="text-xs font-semibold text-foreground flex-1 text-left hover:underline"
          >
            {group.group_name}
          </button>
        )}

        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            disabled={isFirst}
            onClick={onMoveGroupUp}
            className={cn(
              'flex items-center justify-center h-7 w-7 rounded-full transition-colors',
              isFirst
                ? 'text-muted-foreground/30 cursor-not-allowed'
                : 'text-muted-foreground hover:bg-background hover:text-foreground'
            )}
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled={isLast}
            onClick={onMoveGroupDown}
            className={cn(
              'flex items-center justify-center h-7 w-7 rounded-full transition-colors',
              isLast
                ? 'text-muted-foreground/30 cursor-not-allowed'
                : 'text-muted-foreground hover:bg-background hover:text-foreground'
            )}
          >
            <ChevronDown className="h-4 w-4" />
          </button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={onRemoveGroup}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Items */}
      <div className="px-3 py-2">
        {group.items.length === 0 && (
          <p className="text-xs text-muted-foreground py-2 text-center">
            No components yet
          </p>
        )}

        {group.items.map((item, ii) => (
          <ComponentItemRow
            key={ii}
            item={item}
            index={ii}
            isFirst={ii === 0}
            isLast={ii === group.items.length - 1}
            onUpdate={(updated) => onUpdateItem(ii, updated)}
            onRemove={() => onRemoveItem(ii)}
            onMoveUp={() => onMoveItemUp(ii)}
            onMoveDown={() => onMoveItemDown(ii)}
          />
        ))}

        <Button
          variant="ghost"
          size="sm"
          className="mt-1 text-xs text-muted-foreground"
          onClick={onAddItem}
        >
          <Plus className="h-3 w-3 mr-1" />
          Add Component
        </Button>
      </div>
    </div>
  );
}

// =============================================================================
// PlateComponentEditor
// =============================================================================

interface PlateComponentEditorProps {
  groups: PlateComponentGroup[];
  onAddGroup: (group: PlateComponentGroup) => void;
  onUpdateGroup: (index: number, group: PlateComponentGroup) => void;
  onRemoveGroup: (index: number) => void;
  onReorderGroups: (groups: PlateComponentGroup[]) => void;
}

export function PlateComponentEditor({
  groups,
  onAddGroup,
  onUpdateGroup,
  onRemoveGroup,
  onReorderGroups,
}: PlateComponentEditorProps) {

  const handleAddGroup = () => {
    const newGroup: PlateComponentGroup = {
      group_name: `Group ${groups.length + 1}`,
      order: groups.length + 1,
      items: [],
    };
    onAddGroup(newGroup);
  };

  const handleRenameGroup = (gi: number, name: string) => {
    const updated = { ...groups[gi], group_name: name };
    onUpdateGroup(gi, updated);
  };

  const handleMoveGroupUp = (gi: number) => {
    if (gi <= 0) return;
    const reordered = [...groups];
    [reordered[gi - 1], reordered[gi]] = [reordered[gi], reordered[gi - 1]];
    onReorderGroups(reordered.map((g, i) => ({ ...g, order: i + 1 })));
  };

  const handleMoveGroupDown = (gi: number) => {
    if (gi >= groups.length - 1) return;
    const reordered = [...groups];
    [reordered[gi], reordered[gi + 1]] = [reordered[gi + 1], reordered[gi]];
    onReorderGroups(reordered.map((g, i) => ({ ...g, order: i + 1 })));
  };

  const handleAddItem = (gi: number) => {
    const group = groups[gi];
    const newItem: PlateComponent = {
      type: 'raw',
      name: '',
      quantity: 0,
      unit: 'oz',
      order: group.items.length + 1,
    };
    onUpdateGroup(gi, { ...group, items: [...group.items, newItem] });
  };

  const handleUpdateItem = (gi: number, ii: number, item: PlateComponent) => {
    const group = groups[gi];
    const items = [...group.items];
    items[ii] = item;
    onUpdateGroup(gi, { ...group, items });
  };

  const handleRemoveItem = (gi: number, ii: number) => {
    const group = groups[gi];
    const items = group.items.filter((_, i) => i !== ii).map((item, i) => ({ ...item, order: i + 1 }));
    onUpdateGroup(gi, { ...group, items });
  };

  const handleMoveItemUp = (gi: number, ii: number) => {
    if (ii <= 0) return;
    const group = groups[gi];
    const items = [...group.items];
    [items[ii - 1], items[ii]] = [items[ii], items[ii - 1]];
    onUpdateGroup(gi, { ...group, items: items.map((item, i) => ({ ...item, order: i + 1 })) });
  };

  const handleMoveItemDown = (gi: number, ii: number) => {
    const group = groups[gi];
    if (ii >= group.items.length - 1) return;
    const items = [...group.items];
    [items[ii], items[ii + 1]] = [items[ii + 1], items[ii]];
    onUpdateGroup(gi, { ...group, items: items.map((item, i) => ({ ...item, order: i + 1 })) });
  };

  return (
    <div className="space-y-3">
      {groups.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-4">
          No component groups yet. Add one to get started.
        </p>
      )}

      {groups.map((group, gi) => (
        <ComponentGroupCard
          key={gi}
          group={group}
          groupIndex={gi}
          isFirst={gi === 0}
          isLast={gi === groups.length - 1}
          onRename={(name) => handleRenameGroup(gi, name)}
          onRemoveGroup={() => onRemoveGroup(gi)}
          onMoveGroupUp={() => handleMoveGroupUp(gi)}
          onMoveGroupDown={() => handleMoveGroupDown(gi)}
          onAddItem={() => handleAddItem(gi)}
          onUpdateItem={(ii, item) => handleUpdateItem(gi, ii, item)}
          onRemoveItem={(ii) => handleRemoveItem(gi, ii)}
          onMoveItemUp={(ii) => handleMoveItemUp(gi, ii)}
          onMoveItemDown={(ii) => handleMoveItemDown(gi, ii)}
        />
      ))}

      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={handleAddGroup}
      >
        <Plus className="h-3.5 w-3.5 mr-1.5" />
        Add Component Group
      </Button>
    </div>
  );
}
