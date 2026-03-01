// =============================================================================
// CanvasFieldWrapper — Wraps each field in the WYSIWYG canvas with:
//   - Drag handle (hover)
//   - Selection border (click)
//   - Gear icon (opens advanced panel)
//   - Delete X button
//   - Required toggle
// Uses @dnd-kit/sortable for reordering within the canvas
// =============================================================================

import { memo, useCallback } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical,
  Settings,
  X,
  Asterisk,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FormFieldDefinition } from '@/types/forms';

// =============================================================================
// PROPS
// =============================================================================

interface CanvasFieldWrapperProps {
  field: FormFieldDefinition;
  isSelected: boolean;
  language: 'en' | 'es';
  onSelect: (key: string) => void;
  onOpenAdvanced: (key: string) => void;
  onDelete: (key: string) => void;
  onToggleRequired: (key: string) => void;
  children: React.ReactNode;
}

// =============================================================================
// COMPONENT
// =============================================================================

export const CanvasFieldWrapper = memo(function CanvasFieldWrapper({
  field,
  isSelected,
  language,
  onSelect,
  onOpenAdvanced,
  onDelete,
  onToggleRequired,
  children,
}: CanvasFieldWrapperProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.key });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  const isLayoutField = field.type === 'header' || field.type === 'instructions';

  const handleClick = useCallback((e: React.MouseEvent) => {
    // Don't select if clicking an action button
    if ((e.target as HTMLElement).closest('[data-canvas-action]')) return;
    onSelect(field.key);
  }, [field.key, onSelect]);

  const handleGear = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onOpenAdvanced(field.key);
  }, [field.key, onOpenAdvanced]);

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(field.key);
  }, [field.key, onDelete]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={handleClick}
      className={cn(
        'group relative rounded-lg border-2 transition-all cursor-pointer',
        isDragging && 'opacity-60 shadow-lg',
        isSelected
          ? 'border-primary bg-primary/[0.02]'
          : 'border-transparent hover:border-muted-foreground/20',
        isLayoutField && 'bg-muted/30',
      )}
    >
      {/* Drag handle — appears on hover, left side */}
      <button
        ref={setActivatorNodeRef}
        type="button"
        className={cn(
          'absolute -left-8 top-1/2 -translate-y-1/2 w-6 h-8',
          'flex items-center justify-center rounded',
          'text-muted-foreground/50 hover:text-muted-foreground',
          'opacity-0 group-hover:opacity-100 transition-opacity',
          'cursor-grab active:cursor-grabbing',
        )}
        {...attributes}
        {...listeners}
        data-canvas-action
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Action buttons — top-right, appear on hover or when selected */}
      <div
        className={cn(
          'absolute -top-3 right-1 flex items-center gap-0.5 z-10',
          'bg-background border rounded-md shadow-sm px-1 py-0.5',
          isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
          'transition-opacity',
        )}
      >
        {/* Required toggle */}
        {!isLayoutField && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleRequired(field.key); }}
            className={cn(
              'w-6 h-6 flex items-center justify-center rounded',
              'hover:bg-muted transition-colors',
              field.required ? 'text-destructive' : 'text-muted-foreground/40',
            )}
            title={language === 'en' ? 'Toggle required' : 'Alternar requerido'}
            data-canvas-action
          >
            <Asterisk className="h-3 w-3" />
          </button>
        )}

        {/* Gear icon — open advanced panel */}
        <button
          type="button"
          onClick={handleGear}
          className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          title={language === 'en' ? 'Advanced settings' : 'Configuracion avanzada'}
          data-canvas-action
        >
          <Settings className="h-3 w-3" />
        </button>

        {/* Delete X */}
        <button
          type="button"
          onClick={handleDelete}
          className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          title={language === 'en' ? 'Delete field' : 'Eliminar campo'}
          data-canvas-action
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {/* Field content */}
      <div className="px-3 py-3">
        {children}
      </div>
    </div>
  );
});
