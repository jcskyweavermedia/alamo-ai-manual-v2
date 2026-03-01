// =============================================================================
// FieldPalette — Left sidebar with 11 draggable field type tiles
// Two groups: Fields (8) and Special (3)
// Each tile is useDraggable() for DnD and also clickable to append
// Desktop only (hidden on mobile — mobile uses "+" bottom sheet)
// =============================================================================

import { useDraggable } from '@dnd-kit/core';
import {
  Type,
  AlignLeft,
  Hash,
  Calendar,
  Clock,
  List,
  CheckSquare,
  ToggleRight,
  Pen,
  Camera,
  PanelTop,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FormFieldType } from '@/types/forms';
import type { ReactNode } from 'react';

// =============================================================================
// PALETTE CONFIGURATION — 11 types in 2 groups
// =============================================================================

interface PaletteTile {
  type: FormFieldType;
  labelEn: string;
  labelEs: string;
  icon: ReactNode;
}

interface PaletteGroup {
  labelEn: string;
  labelEs: string;
  tiles: PaletteTile[];
}

const PALETTE_GROUPS: PaletteGroup[] = [
  {
    labelEn: 'Fields',
    labelEs: 'Campos',
    tiles: [
      { type: 'text', labelEn: 'Short Text', labelEs: 'Texto corto', icon: <Type className="h-4 w-4" /> },
      { type: 'textarea', labelEn: 'Long Text', labelEs: 'Texto largo', icon: <AlignLeft className="h-4 w-4" /> },
      { type: 'number', labelEn: 'Number', labelEs: 'Numero', icon: <Hash className="h-4 w-4" /> },
      { type: 'date', labelEn: 'Date', labelEs: 'Fecha', icon: <Calendar className="h-4 w-4" /> },
      { type: 'time', labelEn: 'Time', labelEs: 'Hora', icon: <Clock className="h-4 w-4" /> },
      { type: 'select', labelEn: 'Dropdown', labelEs: 'Desplegable', icon: <List className="h-4 w-4" /> },
      { type: 'checkbox', labelEn: 'Checkboxes', labelEs: 'Casillas', icon: <CheckSquare className="h-4 w-4" /> },
      { type: 'yes_no', labelEn: 'Yes / No', labelEs: 'Si / No', icon: <ToggleRight className="h-4 w-4" /> },
    ],
  },
  {
    labelEn: 'Special',
    labelEs: 'Especial',
    tiles: [
      { type: 'signature', labelEn: 'Signature', labelEs: 'Firma', icon: <Pen className="h-4 w-4" /> },
      { type: 'image', labelEn: 'Photo', labelEs: 'Foto', icon: <Camera className="h-4 w-4" /> },
      { type: 'header', labelEn: 'Section', labelEs: 'Seccion', icon: <PanelTop className="h-4 w-4" /> },
    ],
  },
];

// Unique prefix to identify palette drag sources vs sortable items
export const PALETTE_DRAG_PREFIX = 'palette::';

// =============================================================================
// DRAGGABLE TILE
// =============================================================================

function PaletteDraggableTile({
  tile,
  language,
  onClickAdd,
}: {
  tile: PaletteTile;
  language: 'en' | 'es';
  onClickAdd: (type: FormFieldType) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    isDragging,
  } = useDraggable({
    id: `${PALETTE_DRAG_PREFIX}${tile.type}`,
    data: { type: tile.type, source: 'palette' },
  });

  const isEn = language === 'en';

  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={() => onClickAdd(tile.type)}
      className={cn(
        'flex items-center gap-2 w-full px-2.5 py-2',
        'text-left text-xs font-medium',
        'rounded-lg border border-transparent',
        'hover:bg-accent hover:border-border',
        'transition-colors cursor-grab active:cursor-grabbing',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isDragging && 'opacity-50',
      )}
      {...attributes}
      {...listeners}
    >
      <span className="text-muted-foreground shrink-0">{tile.icon}</span>
      <span className="truncate">{isEn ? tile.labelEn : tile.labelEs}</span>
    </button>
  );
}

// =============================================================================
// PALETTE COMPONENT
// =============================================================================

interface FieldPaletteProps {
  language: 'en' | 'es';
  onClickAdd: (type: FormFieldType) => void;
}

export function FieldPalette({ language, onClickAdd }: FieldPaletteProps) {
  const isEn = language === 'en';

  return (
    <div className="w-44 shrink-0 border-r bg-muted/20 overflow-y-auto h-full p-3 space-y-4">
      {PALETTE_GROUPS.map((group) => (
        <div key={group.labelEn}>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 px-1">
            {isEn ? group.labelEn : group.labelEs}
          </p>
          <div className="space-y-0.5">
            {group.tiles.map((tile) => (
              <PaletteDraggableTile
                key={tile.type}
                tile={tile}
                language={language}
                onClickAdd={onClickAdd}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
