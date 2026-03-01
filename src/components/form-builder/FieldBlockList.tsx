// =============================================================================
// FieldBlockList — Main field list with drag-and-drop reordering
// Uses @dnd-kit/sortable with vertical list strategy
// Drag handle activation constraint: 8px distance (R19 mitigation)
// Add Field opens FieldTypePicker (Popover on desktop, Sheet on mobile)
// restrictToVerticalAxis modifier constrains movement
// =============================================================================

import { useState, useCallback, useMemo } from 'react';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Plus, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBuilder } from '@/contexts/BuilderContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { FieldBlockItem } from './FieldBlockItem';
import { FieldTypePickerPopover, FieldTypePickerSheet } from './FieldTypePicker';
import type { FormFieldType } from '@/types/forms';

// =============================================================================
// COMPONENT
// =============================================================================

export function FieldBlockList({ language }: { language: 'en' | 'es' }) {
  const { state, addField, moveField } = useBuilder();
  const isMobile = useIsMobile();

  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const isEn = language === 'en';
  const { fields } = state;

  // --- Field keys for SortableContext and FieldPropertyPanel key uniqueness ---
  const fieldKeys = useMemo(() => fields.map(f => f.key), [fields]);

  // --- Toggle expand ---
  const handleToggleExpand = useCallback(
    (key: string) => {
      setExpandedKey(prev => (prev === key ? null : key));
    },
    [],
  );

  // --- Mobile move up/down (R19 fallback) ---
  const handleMoveUp = useCallback(
    (key: string) => {
      const index = fields.findIndex(f => f.key === key);
      if (index <= 0) return;
      moveField(key, fields[index - 1].key);
    },
    [fields, moveField],
  );

  const handleMoveDown = useCallback(
    (key: string) => {
      const index = fields.findIndex(f => f.key === key);
      if (index === -1 || index >= fields.length - 1) return;
      moveField(key, fields[index + 1].key);
    },
    [fields, moveField],
  );

  // --- Add field handler ---
  const handleAddField = useCallback(
    (type: FormFieldType) => {
      addField(type);
      // Reset expandedKey so the newly selected field auto-expands
      // via the fallback: (selectedKey === field.key && expandedKey === null)
      setExpandedKey(null);
    },
    [addField],
  );

  // Auto-expand newly selected field
  const selectedKey = state.selectedFieldKey;

  // --- Empty state ---
  if (fields.length === 0) {
    return (
      <div className="space-y-4">
        {/* Empty state message */}
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex items-center justify-center w-14 h-14 rounded-[16px] bg-muted/60 mb-4">
            <Layers className="h-7 w-7 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground mb-1">
            {isEn ? 'No fields yet' : 'Sin campos aun'}
          </p>
          <p className="text-xs text-muted-foreground max-w-[240px]">
            {isEn
              ? 'Add your first field to start building the form.'
              : 'Agrega tu primer campo para empezar a construir el formulario.'}
          </p>
        </div>

        {/* Add Field button */}
        <AddFieldButton
          language={language}
          isMobile={isMobile}
          onAddField={handleAddField}
        />
      </div>
    );
  }

  // --- Main list ---
  return (
    <div className="space-y-3">
      {/* Field count + Add button header */}
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-bold uppercase tracking-wider text-muted-foreground">
          {isEn ? 'Fields' : 'Campos'}{' '}
          <span className="font-normal">({fields.length})</span>
        </p>

        <AddFieldButton
          language={language}
          isMobile={isMobile}
          onAddField={handleAddField}
          compact
        />
      </div>

      {/* Sortable list (DndContext is provided at page level) */}
      <SortableContext items={fieldKeys} strategy={verticalListSortingStrategy}>
        <div className="space-y-2" style={{ touchAction: 'pan-y' }}>
          {fields.map((field, index) => (
            <FieldBlockItem
              key={field.key}
              field={field}
              isSelected={selectedKey === field.key}
              isExpanded={expandedKey === field.key || (selectedKey === field.key && expandedKey === null)}
              isFirst={index === 0}
              isLast={index === fields.length - 1}
              allFieldKeys={fieldKeys}
              language={language}
              onToggleExpand={handleToggleExpand}
              onMoveUp={handleMoveUp}
              onMoveDown={handleMoveDown}
            />
          ))}
        </div>
      </SortableContext>

      {/* Bottom Add Field button */}
      <AddFieldButton
        language={language}
        isMobile={isMobile}
        onAddField={handleAddField}
      />

      {/* Field limit warning */}
      {fields.length >= 30 && fields.length < 50 && (
        <p className="text-xs text-amber-600 dark:text-amber-400 text-center">
          {isEn
            ? `${fields.length}/50 fields. Forms with 30+ fields may slow down the builder on mobile.`
            : `${fields.length}/50 campos. Formularios con 30+ campos pueden ralentizar el constructor en movil.`}
        </p>
      )}
      {fields.length >= 50 && (
        <p className="text-xs text-destructive text-center">
          {isEn
            ? 'Maximum 50 fields reached.'
            : 'Se alcanzo el maximo de 50 campos.'}
        </p>
      )}
    </div>
  );
}

// =============================================================================
// ADD FIELD BUTTON (handles desktop popover vs mobile sheet)
// Each instance manages its own open state to avoid conflicts when
// multiple AddFieldButton instances are rendered simultaneously.
// =============================================================================

function AddFieldButton({
  language,
  isMobile,
  onAddField,
  compact = false,
}: {
  language: 'en' | 'es';
  isMobile: boolean;
  onAddField: (type: FormFieldType) => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const isEn = language === 'en';

  const triggerButton = (
    <Button
      variant={compact ? 'ghost' : 'outline'}
      size={compact ? 'sm' : 'default'}
      className={compact ? 'h-8 text-xs' : 'w-full'}
      disabled={false}
    >
      <Plus className={compact ? 'h-3.5 w-3.5 mr-1' : 'h-4 w-4 mr-2'} />
      {isEn ? 'Add Field' : 'Agregar campo'}
    </Button>
  );

  if (isMobile) {
    return (
      <>
        <div onClick={() => setOpen(true)}>{triggerButton}</div>
        <FieldTypePickerSheet
          open={open}
          onOpenChange={setOpen}
          onSelect={onAddField}
          language={language}
        />
      </>
    );
  }

  return (
    <FieldTypePickerPopover
      open={open}
      onOpenChange={setOpen}
      trigger={triggerButton}
      onSelect={onAddField}
      language={language}
    />
  );
}
