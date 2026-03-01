// =============================================================================
// BuilderCanvas — WYSIWYG center area for the form builder
// Renders fields as they'll appear in the final form, with interactive overlays
// Uses FormFieldRenderer for actual field rendering
// Wraps each field in CanvasFieldWrapper for drag handles, gear, delete, etc.
// =============================================================================

import { useCallback, useMemo, useState } from 'react';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { Layers, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBuilder } from '@/contexts/BuilderContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { FormFieldRenderer } from '@/components/forms/FormFieldRenderer';
import { EditableLabel } from './EditableLabel';
import { CanvasFieldWrapper } from './CanvasFieldWrapper';
import { FieldTypePickerSheet } from './FieldTypePicker';
import { generateFieldKey } from '@/lib/form-builder/builder-utils';
import type { FormFieldType, FormFieldValue } from '@/types/forms';

// =============================================================================
// HEADER RENDERER (for 'header' type fields on the canvas)
// =============================================================================

function CanvasHeaderField({
  label,
  hint,
  onLabelChange,
}: {
  label: string;
  hint?: string;
  onLabelChange: (value: string) => void;
}) {
  return (
    <div className="border-b pb-2">
      <EditableLabel
        value={label}
        placeholder="Section Header"
        onChange={onLabelChange}
        className="text-base font-semibold"
      />
      {hint && (
        <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>
      )}
    </div>
  );
}

// =============================================================================
// COMPONENT
// =============================================================================

interface BuilderCanvasProps {
  language: 'en' | 'es';
}

export function BuilderCanvas({ language }: BuilderCanvasProps) {
  const { state, dispatch, selectField, removeField, updateField, addField } = useBuilder();
  const isMobile = useIsMobile();
  const [mobilePickerOpen, setMobilePickerOpen] = useState(false);

  const isEn = language === 'en';
  const { fields, selectedFieldKey } = state;

  const fieldKeys = useMemo(() => fields.map(f => f.key), [fields]);

  // Make the canvas a droppable area for palette items when empty
  const { setNodeRef: setDropRef } = useDroppable({ id: 'canvas-droppable' });

  // --- Handlers ---
  const handleSelect = useCallback((key: string) => {
    selectField(key);
  }, [selectField]);

  const handleOpenAdvanced = useCallback((key: string) => {
    selectField(key);
    dispatch({ type: 'SET_RIGHT_PANEL_MODE', payload: 'field-properties' });
  }, [selectField, dispatch]);

  const handleDelete = useCallback((key: string) => {
    removeField(key);
  }, [removeField]);

  const handleToggleRequired = useCallback((key: string) => {
    const field = fields.find(f => f.key === key);
    if (field) {
      updateField(key, { required: !field.required });
    }
  }, [fields, updateField]);

  const handleLabelChange = useCallback((key: string, label: string, lang: 'en' | 'es') => {
    const field = fields.find(f => f.key === key);
    if (!field) return;

    // Write to the correct language field
    if (lang === 'es') {
      updateField(key, { label_es: label });
      return;
    }

    // EN label: also auto-generate key if it still matches the auto-generated pattern
    const updates: Record<string, unknown> = { label };
    const otherKeys = fields.filter(f => f.key !== key).map(f => f.key);
    const currentAutoKey = generateFieldKey(field.label, otherKeys);
    if (field.key === currentAutoKey || field.key === generateFieldKey(field.label, [])) {
      const newKey = generateFieldKey(label, otherKeys);
      if (newKey !== key) {
        updates.key = newKey;
      }
    }

    updateField(key, updates);
  }, [fields, updateField]);

  // No-op onChange for preview (fields are display-only in the canvas)
  const noopChange = useCallback((_v: FormFieldValue) => {}, []);

  const handleMobileAdd = useCallback((type: FormFieldType) => {
    addField(type);
    setMobilePickerOpen(false);
  }, [addField]);

  // --- Empty state ---
  if (fields.length === 0) {
    return (
      <div ref={setDropRef} className="flex-1 min-h-[300px]">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-muted/60 mb-4">
            <Layers className="h-7 w-7 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground mb-1">
            {isEn ? 'No fields yet' : 'Sin campos aun'}
          </p>
          <p className="text-xs text-muted-foreground max-w-[280px] mb-4">
            {isEn
              ? 'Drag fields from the palette or click to add them here.'
              : 'Arrastra campos desde la paleta o haz clic para agregarlos.'}
          </p>
          {/* Mobile: show add button since no palette */}
          <div className="lg:hidden">
            <Button variant="outline" onClick={() => setMobilePickerOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              {isEn ? 'Add Field' : 'Agregar campo'}
            </Button>
            <FieldTypePickerSheet
              open={mobilePickerOpen}
              onOpenChange={setMobilePickerOpen}
              onSelect={handleMobileAdd}
              language={language}
            />
          </div>
        </div>
      </div>
    );
  }

  // --- Canvas with fields ---
  return (
    <div ref={setDropRef} className="space-y-1 pl-8 pr-2 py-2 min-h-[200px]">
      <SortableContext items={fieldKeys} strategy={verticalListSortingStrategy}>
        {fields.map((field) => (
          <CanvasFieldWrapper
            key={field.key}
            field={field}
            isSelected={selectedFieldKey === field.key}
            language={language}
            onSelect={handleSelect}
            onOpenAdvanced={handleOpenAdvanced}
            onDelete={handleDelete}
            onToggleRequired={handleToggleRequired}
          >
            {field.type === 'header' ? (
              <CanvasHeaderField
                label={language === 'es' && field.label_es ? field.label_es : field.label}
                hint={field.hint}
                onLabelChange={(value) => handleLabelChange(field.key, value, language)}
              />
            ) : (
              <div className="space-y-2">
                <EditableLabel
                  value={language === 'es' && field.label_es ? field.label_es : field.label}
                  required={field.required}
                  placeholder={language === 'en' ? 'Field label' : 'Etiqueta'}
                  onChange={(value) => handleLabelChange(field.key, value, language)}
                />
                <FormFieldRenderer
                  field={field}
                  value={null}
                  error={undefined}
                  language={language}
                  onChange={noopChange}
                  hideLabel
                />
              </div>
            )}
          </CanvasFieldWrapper>
        ))}
      </SortableContext>

      {/* Mobile: bottom add button */}
      <div className="lg:hidden pt-3">
        <Button
          variant="outline"
          className="w-full"
          onClick={() => setMobilePickerOpen(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          {isEn ? 'Add Field' : 'Agregar campo'}
        </Button>
        <FieldTypePickerSheet
          open={mobilePickerOpen}
          onOpenChange={setMobilePickerOpen}
          onSelect={handleMobileAdd}
          language={language}
        />
      </div>

      {/* Field limit warnings */}
      {fields.length >= 30 && fields.length < 50 && (
        <p className="text-xs text-amber-600 dark:text-amber-400 text-center pt-2">
          {isEn
            ? `${fields.length}/50 fields.`
            : `${fields.length}/50 campos.`}
        </p>
      )}
      {fields.length >= 50 && (
        <p className="text-xs text-destructive text-center pt-2">
          {isEn ? 'Maximum 50 fields reached.' : 'Se alcanzo el maximo de 50 campos.'}
        </p>
      )}
    </div>
  );
}
