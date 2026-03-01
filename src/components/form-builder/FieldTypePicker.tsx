// =============================================================================
// FieldTypePicker — Field type selector (Popover on desktop, Sheet on mobile)
// Grid of tiles organized by category. On select: addField(type) + close.
// =============================================================================

import { useCallback } from 'react';
import {
  Type,
  AlignLeft,
  Hash,
  Calendar,
  Clock,
  List,
  CheckSquare,
  Pen,
  Camera,
  Heading,
  ToggleRight,
} from 'lucide-react';
import type { FormFieldType } from '@/types/forms';
import type { FieldTypePickerProps } from '@/types/form-builder';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import type { ReactNode } from 'react';

// =============================================================================
// FIELD TYPE CONFIGURATION
// =============================================================================

interface FieldTypeTile {
  type: FormFieldType;
  labelEn: string;
  labelEs: string;
  icon: ReactNode;
}

interface FieldCategory {
  labelEn: string;
  labelEs: string;
  types: FieldTypeTile[];
}

/**
 * Simplified field categories (11 types in 2 groups).
 * Deprecated types (datetime, radio, phone, email, file, instructions, contact_lookup)
 * still render/edit fine — they just can't be added to new forms.
 */
const FIELD_CATEGORIES: FieldCategory[] = [
  {
    labelEn: 'Fields',
    labelEs: 'Campos',
    types: [
      { type: 'text', labelEn: 'Short Text', labelEs: 'Texto corto', icon: <Type className="h-5 w-5" /> },
      { type: 'textarea', labelEn: 'Long Text', labelEs: 'Texto largo', icon: <AlignLeft className="h-5 w-5" /> },
      { type: 'number', labelEn: 'Number', labelEs: 'Numero', icon: <Hash className="h-5 w-5" /> },
      { type: 'date', labelEn: 'Date', labelEs: 'Fecha', icon: <Calendar className="h-5 w-5" /> },
      { type: 'time', labelEn: 'Time', labelEs: 'Hora', icon: <Clock className="h-5 w-5" /> },
      { type: 'select', labelEn: 'Dropdown', labelEs: 'Desplegable', icon: <List className="h-5 w-5" /> },
      { type: 'checkbox', labelEn: 'Checkboxes', labelEs: 'Casillas', icon: <CheckSquare className="h-5 w-5" /> },
      { type: 'yes_no', labelEn: 'Yes / No', labelEs: 'Si / No', icon: <ToggleRight className="h-5 w-5" /> },
    ],
  },
  {
    labelEn: 'Special',
    labelEs: 'Especial',
    types: [
      { type: 'signature', labelEn: 'Signature', labelEs: 'Firma', icon: <Pen className="h-5 w-5" /> },
      { type: 'image', labelEn: 'Photo', labelEs: 'Foto', icon: <Camera className="h-5 w-5" /> },
      { type: 'header', labelEn: 'Section', labelEs: 'Seccion', icon: <Heading className="h-5 w-5" /> },
    ],
  },
];

// =============================================================================
// TILE GRID (shared between desktop popover and mobile sheet)
// =============================================================================

function TileGrid({
  onSelect,
  language,
}: {
  onSelect: (type: FormFieldType) => void;
  language: 'en' | 'es';
}) {
  const isEn = language === 'en';

  return (
    <div className="space-y-4">
      {FIELD_CATEGORIES.map(category => (
        <div key={category.labelEn}>
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
            {isEn ? category.labelEn : category.labelEs}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {category.types.map(tile => (
              <button
                key={tile.type}
                type="button"
                onClick={() => onSelect(tile.type)}
                className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-[12px] border border-black/[0.04] dark:border-white/[0.06] bg-card hover:bg-primary/5 hover:border-primary/20 transition-colors cursor-pointer min-h-[68px]"
              >
                <span className="text-muted-foreground">{tile.icon}</span>
                <span className="text-[11px] font-medium text-foreground leading-tight text-center">
                  {isEn ? tile.labelEn : tile.labelEs}
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// POPOVER WRAPPER (Desktop: anchored popover. Needs trigger externally.)
// =============================================================================

export function FieldTypePickerPopover({
  open,
  onOpenChange,
  trigger,
  onSelect,
  language,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactNode;
  onSelect: (type: FormFieldType) => void;
  language: 'en' | 'es';
}) {
  const isEn = language === 'en';

  const handleSelect = useCallback(
    (type: FormFieldType) => {
      onSelect(type);
      onOpenChange(false);
    },
    [onSelect, onOpenChange],
  );

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        className="w-[340px] p-4 max-h-[70vh] overflow-y-auto"
        align="start"
        sideOffset={8}
      >
        <p className="text-sm font-semibold mb-3">
          {isEn ? 'Add Field' : 'Agregar campo'}
        </p>
        <TileGrid onSelect={handleSelect} language={language} />
      </PopoverContent>
    </Popover>
  );
}

// =============================================================================
// SHEET WRAPPER (Mobile: bottom sheet)
// =============================================================================

export function FieldTypePickerSheet({
  open,
  onOpenChange,
  onSelect,
  language,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (type: FormFieldType) => void;
  language: 'en' | 'es';
}) {
  const isEn = language === 'en';

  const handleSelect = useCallback(
    (type: FormFieldType) => {
      onSelect(type);
      onOpenChange(false);
    },
    [onSelect, onOpenChange],
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto rounded-t-[20px] pb-8">
        <SheetHeader className="pb-2">
          <SheetTitle className="text-left">
            {isEn ? 'Add Field' : 'Agregar campo'}
          </SheetTitle>
        </SheetHeader>
        <TileGrid onSelect={handleSelect} language={language} />
      </SheetContent>
    </Sheet>
  );
}

// =============================================================================
// COMBINED PICKER (auto-selects popover vs sheet based on viewport)
// =============================================================================

export function FieldTypePicker({
  onSelect,
  onClose,
  language,
}: FieldTypePickerProps) {
  // This component is a convenience wrapper.
  // In practice, FieldBlockList uses the Popover/Sheet variants directly
  // because they need separate trigger/open state management.
  // This standalone version renders the tile grid directly.
  const handleSelect = useCallback(
    (type: FormFieldType) => {
      onSelect(type);
      onClose();
    },
    [onSelect, onClose],
  );

  const isEn = language === 'en';

  return (
    <div className="p-4">
      <p className="text-sm font-semibold mb-3">
        {isEn ? 'Add Field' : 'Agregar campo'}
      </p>
      <TileGrid onSelect={handleSelect} language={language} />
    </div>
  );
}
