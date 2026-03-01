// =============================================================================
// FieldPropertyPanel — Inline field property editor (shown when expanded)
// Handles all 17 field types with type-specific sections.
// All changes dispatch UPDATE_FIELD via useBuilder().updateField().
// Key uniqueness validated in real-time (R10 mitigation).
// =============================================================================

import { useState, useMemo, useCallback } from 'react';
import { Trash2, ChevronDown, Settings2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { useBuilder } from '@/contexts/BuilderContext';
import { generateFieldKey } from '@/lib/form-builder/builder-utils';
import { OptionsEditor } from './OptionsEditor';
import type { FieldPropertyPanelProps } from '@/types/form-builder';
import type { FormFieldCondition, FormFieldDefinition } from '@/types/forms';

// =============================================================================
// HELPERS
// =============================================================================

const LAYOUT_TYPES = ['header', 'instructions'] as const;
const CHOICE_TYPES = ['select', 'radio', 'checkbox'] as const;

function isLayoutType(type: string): boolean {
  return (LAYOUT_TYPES as readonly string[]).includes(type);
}

function isChoiceType(type: string): boolean {
  return (CHOICE_TYPES as readonly string[]).includes(type);
}

/** Contact lookup categories */
const CONTACT_CATEGORIES = [
  { value: 'emergency', labelEn: 'Emergency', labelEs: 'Emergencia' },
  { value: 'medical', labelEn: 'Medical', labelEs: 'Medico' },
  { value: 'management', labelEn: 'Management', labelEs: 'Gerencia' },
  { value: 'vendor', labelEn: 'Vendor', labelEs: 'Proveedor' },
] as const;

/** Condition operators */
const CONDITION_OPERATORS = [
  { value: 'eq', labelEn: 'Equals', labelEs: 'Es igual a' },
  { value: 'neq', labelEn: 'Not Equals', labelEs: 'No es igual a' },
  { value: 'in', labelEn: 'Is one of', labelEs: 'Es uno de' },
  { value: 'exists', labelEn: 'Has a value', labelEs: 'Tiene un valor' },
] as const;

// =============================================================================
// COMPONENT
// =============================================================================

export function FieldPropertyPanel({ field, allFieldKeys, language }: FieldPropertyPanelProps) {
  const { updateField, removeField } = useBuilder();
  const [showAdvancedKey, setShowAdvancedKey] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isEn = language === 'en';
  const isLayout = isLayoutType(field.type);
  const isChoice = isChoiceType(field.type);
  const isHeader = field.type === 'header';
  const isInstructions = field.type === 'instructions';
  const isContactLookup = field.type === 'contact_lookup';
  const isNumber = field.type === 'number';

  // --- Key uniqueness validation (R10) ---
  const otherKeys = useMemo(
    () => allFieldKeys.filter(k => k !== field.key),
    [allFieldKeys, field.key],
  );

  const [localKey, setLocalKey] = useState(field.key);
  const keyCollision = otherKeys.includes(localKey) && localKey !== field.key;

  const handleKeyChange = useCallback(
    (value: string) => {
      const sanitized = value
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '')
        .slice(0, 50);
      setLocalKey(sanitized);
    },
    [],
  );

  const handleKeyBlur = useCallback(() => {
    if (!keyCollision && localKey.length > 0 && localKey !== field.key) {
      updateField(field.key, { key: localKey });
    } else if (localKey.length === 0) {
      setLocalKey(field.key);
    }
  }, [keyCollision, localKey, field.key, updateField]);

  // --- Update helpers ---
  const handleUpdate = useCallback(
    (updates: Partial<FormFieldDefinition>) => {
      updateField(field.key, updates);
    },
    [field.key, updateField],
  );

  const handleConditionChange = useCallback(
    (condition: FormFieldCondition | null) => {
      updateField(field.key, { condition });
    },
    [field.key, updateField],
  );

  const handleDelete = useCallback(() => {
    if (confirmDelete) {
      removeField(field.key);
      setConfirmDelete(false);
    } else {
      setConfirmDelete(true);
      // Auto-reset after 3 seconds
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  }, [confirmDelete, field.key, removeField]);

  // --- Available fields for conditions (excluding self) ---
  const conditionFieldOptions = useMemo(() => {
    return otherKeys;
  }, [otherKeys]);

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <div
      className="px-4 pb-4 pt-2 space-y-4 border-t border-black/[0.04] dark:border-white/[0.06]"
      onClick={e => e.stopPropagation()}
    >
      {/* ================================================================== */}
      {/* HEADER TYPE: Only label EN/ES */}
      {/* ================================================================== */}
      {isHeader && (
        <>
          <FormField
            label={isEn ? 'Header Text (EN)' : 'Texto del encabezado (EN)'}
          >
            <Input
              value={field.label}
              onChange={e => handleUpdate({ label: e.target.value })}
              placeholder={isEn ? 'Section title' : 'Titulo de seccion'}
              className="h-9 text-sm"
            />
          </FormField>

          <FormField
            label={isEn ? 'Header Text (ES)' : 'Texto del encabezado (ES)'}
          >
            <Input
              value={field.label_es || ''}
              onChange={e => handleUpdate({ label_es: e.target.value || undefined })}
              placeholder={isEn ? 'Spanish section title' : 'Titulo de seccion en espanol'}
              className="h-9 text-sm"
            />
          </FormField>

          <p className="text-xs text-muted-foreground">
            {isEn ? 'Width is always full for headers.' : 'El ancho es siempre completo para encabezados.'}
          </p>
        </>
      )}

      {/* ================================================================== */}
      {/* INSTRUCTIONS TYPE: Content EN/ES (maps to hint/hint_es) + width */}
      {/* ================================================================== */}
      {isInstructions && (
        <>
          <FormField
            label={isEn ? 'Content (EN)' : 'Contenido (EN)'}
          >
            <Textarea
              value={field.hint || ''}
              onChange={e => handleUpdate({ hint: e.target.value || undefined })}
              placeholder={
                isEn
                  ? 'Instructions text shown to form filler...'
                  : 'Texto de instrucciones mostrado al usuario...'
              }
              className="min-h-[80px] text-sm"
            />
          </FormField>

          <FormField
            label={isEn ? 'Content (ES)' : 'Contenido (ES)'}
          >
            <Textarea
              value={field.hint_es || ''}
              onChange={e => handleUpdate({ hint_es: e.target.value || undefined })}
              placeholder={
                isEn
                  ? 'Spanish instructions text...'
                  : 'Texto de instrucciones en espanol...'
              }
              className="min-h-[80px] text-sm"
            />
          </FormField>

          <WidthSelector
            value={field.width || 'full'}
            onChange={width => handleUpdate({ width })}
            language={language}
          />
        </>
      )}

      {/* ================================================================== */}
      {/* ALL OTHER TYPES: Full property panel */}
      {/* ================================================================== */}
      {!isLayout && (
        <>
          {/* Label EN */}
          <FormField label={isEn ? 'Label (EN)' : 'Etiqueta (EN)'}>
            <Input
              value={field.label}
              onChange={e => handleUpdate({ label: e.target.value })}
              placeholder={isEn ? 'Field label' : 'Etiqueta del campo'}
              className="h-9 text-sm"
            />
          </FormField>

          {/* Label ES */}
          <FormField label={isEn ? 'Label (ES)' : 'Etiqueta (ES)'}>
            <Input
              value={field.label_es || ''}
              onChange={e => handleUpdate({ label_es: e.target.value || undefined })}
              placeholder={isEn ? 'Spanish label' : 'Etiqueta en espanol'}
              className="h-9 text-sm"
            />
          </FormField>

          {/* Key (auto-generated, advanced toggle to edit) */}
          <FormField
            label={isEn ? 'Key' : 'Clave'}
            trailing={
              <button
                type="button"
                onClick={() => setShowAdvancedKey(!showAdvancedKey)}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
              >
                <Settings2 className="h-3 w-3" />
                {showAdvancedKey
                  ? (isEn ? 'Lock' : 'Bloquear')
                  : (isEn ? 'Edit' : 'Editar')}
              </button>
            }
          >
            {showAdvancedKey ? (
              <div className="space-y-1">
                <Input
                  value={localKey}
                  onChange={e => handleKeyChange(e.target.value)}
                  onBlur={handleKeyBlur}
                  className={`h-9 text-sm font-mono ${
                    keyCollision ? 'border-destructive focus-visible:ring-destructive' : ''
                  }`}
                />
                {keyCollision && (
                  <p className="text-xs text-destructive">
                    {isEn
                      ? `Key "${localKey}" is already used by another field.`
                      : `La clave "${localKey}" ya esta en uso.`}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm font-mono text-muted-foreground bg-muted/50 px-3 py-2 rounded-lg">
                {field.key}
              </p>
            )}
          </FormField>

          {/* Required toggle */}
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">
              {isEn ? 'Required' : 'Requerido'}
            </Label>
            <Switch
              checked={field.required || false}
              onCheckedChange={checked => handleUpdate({ required: checked })}
            />
          </div>

          {/* Placeholder */}
          <FormField label={isEn ? 'Placeholder' : 'Texto de ejemplo'}>
            <Input
              value={field.placeholder || ''}
              onChange={e => handleUpdate({ placeholder: e.target.value || undefined })}
              placeholder={isEn ? 'Shown when field is empty' : 'Se muestra cuando el campo esta vacio'}
              className="h-9 text-sm"
            />
          </FormField>

          {/* Hint */}
          <FormField label={isEn ? 'Hint' : 'Pista'}>
            <Input
              value={field.hint || ''}
              onChange={e => handleUpdate({ hint: e.target.value || undefined })}
              placeholder={isEn ? 'Helper text below the field' : 'Texto de ayuda debajo del campo'}
              className="h-9 text-sm"
            />
          </FormField>

          {/* AI Hint */}
          <FormField
            label={isEn ? 'AI Hint' : 'Pista para IA'}
            hint={
              isEn
                ? 'Guides the AI when auto-filling this field'
                : 'Guia al IA cuando llena este campo automaticamente'
            }
          >
            <Textarea
              value={field.ai_hint || ''}
              onChange={e => handleUpdate({ ai_hint: e.target.value || undefined })}
              placeholder={
                isEn
                  ? 'e.g. "Extract the employee\'s full legal name"'
                  : 'ej. "Extraer el nombre legal completo del empleado"'
              }
              className="min-h-[60px] text-sm"
            />
          </FormField>

          {/* Width */}
          <WidthSelector
            value={field.width || 'full'}
            onChange={width => handleUpdate({ width })}
            language={language}
          />

          {/* Section name */}
          <FormField label={isEn ? 'Section' : 'Seccion'}>
            <Input
              value={field.section || ''}
              onChange={e => handleUpdate({ section: e.target.value || undefined })}
              placeholder={isEn ? 'Optional section grouping' : 'Agrupacion de seccion opcional'}
              className="h-9 text-sm"
            />
          </FormField>

          {/* ============================================================ */}
          {/* TYPE-SPECIFIC SECTIONS */}
          {/* ============================================================ */}

          {/* Options (select/radio/checkbox) */}
          {isChoice && (
            <div className="pt-2 border-t border-black/[0.04] dark:border-white/[0.06]">
              <OptionsEditor
                options={field.options || []}
                onChange={options => handleUpdate({ options })}
                language={language}
                fieldType={field.type}
              />
            </div>
          )}

          {/* Number: Min/Max */}
          {isNumber && (
            <div className="pt-2 border-t border-black/[0.04] dark:border-white/[0.06]">
              <p className="text-[13px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                {isEn ? 'Number Validation' : 'Validacion numerica'}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <FormField label={isEn ? 'Min' : 'Minimo'}>
                  <Input
                    type="number"
                    value={field.validation?.min ?? ''}
                    onChange={e => {
                      const val = e.target.value === '' ? undefined : Number(e.target.value);
                      handleUpdate({
                        validation: { ...field.validation, min: val },
                      });
                    }}
                    placeholder="0"
                    className="h-9 text-sm"
                  />
                </FormField>
                <FormField label={isEn ? 'Max' : 'Maximo'}>
                  <Input
                    type="number"
                    value={field.validation?.max ?? ''}
                    onChange={e => {
                      const val = e.target.value === '' ? undefined : Number(e.target.value);
                      handleUpdate({
                        validation: { ...field.validation, max: val },
                      });
                    }}
                    placeholder="100"
                    className="h-9 text-sm"
                  />
                </FormField>
              </div>
            </div>
          )}

          {/* Phone/Email: Pattern validation */}
          {(field.type === 'phone' || field.type === 'email') && (
            <div className="pt-2 border-t border-black/[0.04] dark:border-white/[0.06]">
              <FormField
                label={isEn ? 'Validation Pattern (regex)' : 'Patron de validacion (regex)'}
                hint={
                  field.type === 'phone'
                    ? (isEn ? 'e.g. ^\\+?[1-9]\\d{7,14}$ for international phone' : 'ej. ^\\+?[1-9]\\d{7,14}$ para telefono internacional')
                    : (isEn ? 'e.g. ^[^@]+@[^@]+\\.[^@]+$ for basic email' : 'ej. ^[^@]+@[^@]+\\.[^@]+$ para email basico')
                }
              >
                <Input
                  value={field.validation?.pattern || ''}
                  onChange={e => {
                    handleUpdate({
                      validation: { ...field.validation, pattern: e.target.value || undefined },
                    });
                  }}
                  placeholder={
                    field.type === 'phone'
                      ? (isEn ? 'Optional regex pattern' : 'Patron regex opcional')
                      : (isEn ? 'Optional regex pattern' : 'Patron regex opcional')
                  }
                  className="h-9 text-sm font-mono"
                />
              </FormField>
            </div>
          )}

          {/* Image: Max photos */}
          {field.type === 'image' && (
            <div className="pt-2 border-t border-black/[0.04] dark:border-white/[0.06]">
              <FormField
                label={isEn ? 'Max Photos' : 'Maximo de fotos'}
                hint={isEn ? 'Maximum number of photos allowed (1-5)' : 'Numero maximo de fotos permitidas (1-5)'}
              >
                <Input
                  type="number"
                  min={1}
                  max={5}
                  value={field.validation?.max_photos ?? 5}
                  onChange={e => {
                    const val = Math.min(5, Math.max(1, Number(e.target.value) || 1));
                    handleUpdate({
                      validation: { ...field.validation, max_photos: val },
                    });
                  }}
                  className="h-9 text-sm w-20"
                />
              </FormField>
            </div>
          )}

          {/* Contact Lookup: Category */}
          {isContactLookup && (
            <div className="pt-2 border-t border-black/[0.04] dark:border-white/[0.06]">
              <FormField label={isEn ? 'Contact Category' : 'Categoria de contacto'}>
                <select
                  value={field.validation?.contact_category || ''}
                  onChange={e => {
                    const val = e.target.value || undefined;
                    handleUpdate({
                      validation: { ...field.validation, contact_category: val },
                    });
                  }}
                  className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="">
                    {isEn ? 'All categories' : 'Todas las categorias'}
                  </option>
                  {CONTACT_CATEGORIES.map(cat => (
                    <option key={cat.value} value={cat.value}>
                      {isEn ? cat.labelEn : cat.labelEs}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>
          )}

          {/* ============================================================ */}
          {/* CONDITION EDITOR */}
          {/* ============================================================ */}
          <div className="pt-2 border-t border-black/[0.04] dark:border-white/[0.06]">
            <ConditionEditor
              condition={field.condition || null}
              availableFieldKeys={conditionFieldOptions}
              onChange={handleConditionChange}
              language={language}
            />
          </div>
        </>
      )}

      {/* ================================================================== */}
      {/* DELETE FIELD */}
      {/* ================================================================== */}
      <div className="pt-2 border-t border-black/[0.04] dark:border-white/[0.06]">
        <Button
          variant={confirmDelete ? 'destructive' : 'outline'}
          size="sm"
          onClick={handleDelete}
          className="w-full h-9 text-sm"
        >
          <Trash2 className="h-3.5 w-3.5 mr-1.5" />
          {confirmDelete
            ? (isEn ? 'Confirm Delete' : 'Confirmar eliminacion')
            : (isEn ? 'Delete Field' : 'Eliminar campo')}
        </Button>
      </div>
    </div>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

/** Reusable form field wrapper with label */
function FormField({
  label,
  hint,
  trailing,
  children,
}: {
  label: string;
  hint?: string;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
        {trailing}
      </div>
      {children}
      {hint && (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

/** Width selector: full or half */
function WidthSelector({
  value,
  onChange,
  language,
}: {
  value: 'full' | 'half';
  onChange: (value: 'full' | 'half') => void;
  language: 'en' | 'es';
}) {
  const isEn = language === 'en';

  return (
    <div className="space-y-1">
      <Label className="text-xs font-medium text-muted-foreground">
        {isEn ? 'Width' : 'Ancho'}
      </Label>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange('full')}
          className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
            value === 'full'
              ? 'bg-primary/10 border-primary text-primary'
              : 'border-input text-muted-foreground hover:border-primary/30'
          }`}
        >
          {isEn ? 'Full' : 'Completo'}
        </button>
        <button
          type="button"
          onClick={() => onChange('half')}
          className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
            value === 'half'
              ? 'bg-primary/10 border-primary text-primary'
              : 'border-input text-muted-foreground hover:border-primary/30'
          }`}
        >
          {isEn ? 'Half' : 'Mitad'}
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// STANDALONE WRAPPER — backward-compatible with AdminFormBuilderPage
// Used when the right panel shows the selected field's properties on desktop.
// The inline FieldPropertyPanel (used inside FieldBlockItem) receives explicit
// field + allFieldKeys props. This wrapper reads them from useBuilder().
// =============================================================================

export function StandaloneFieldPropertyPanel({ language }: { language: 'en' | 'es' }) {
  const { state } = useBuilder();
  const field = state.fields.find(f => f.key === state.selectedFieldKey);
  const allFieldKeys = state.fields.map(f => f.key);

  if (!field) {
    const isEn = language === 'en';
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-sm">
          {isEn ? 'Select a field to edit its properties.' : 'Selecciona un campo para editar sus propiedades.'}
        </p>
      </div>
    );
  }

  return (
    <FieldPropertyPanel
      field={field}
      allFieldKeys={allFieldKeys}
      language={language}
    />
  );
}

/** Condition editor: field dropdown + operator + value */
function ConditionEditor({
  condition,
  availableFieldKeys,
  onChange,
  language,
}: {
  condition: FormFieldCondition | null;
  availableFieldKeys: string[];
  onChange: (condition: FormFieldCondition | null) => void;
  language: 'en' | 'es';
}) {
  const isEn = language === 'en';
  const hasCondition = condition !== null && condition.field !== '';

  const handleToggle = useCallback(() => {
    if (hasCondition) {
      onChange(null);
    } else {
      onChange({
        field: availableFieldKeys[0] || '',
        operator: 'eq',
        value: '',
      });
    }
  }, [hasCondition, availableFieldKeys, onChange]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium text-muted-foreground">
          {isEn ? 'Conditional Visibility' : 'Visibilidad condicional'}
        </Label>
        <Switch
          checked={hasCondition}
          onCheckedChange={handleToggle}
        />
      </div>

      {hasCondition && condition && (
        <div className="space-y-2 pl-0">
          {/* Field selector */}
          <select
            value={condition.field}
            onChange={e =>
              onChange({ ...condition, field: e.target.value })
            }
            className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm"
          >
            <option value="" disabled>
              {isEn ? 'Select field...' : 'Seleccionar campo...'}
            </option>
            {availableFieldKeys.map(key => (
              <option key={key} value={key}>
                {key}
              </option>
            ))}
          </select>

          {/* Operator selector */}
          <select
            value={condition.operator}
            onChange={e =>
              onChange({
                ...condition,
                operator: e.target.value as FormFieldCondition['operator'],
              })
            }
            className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm"
          >
            {CONDITION_OPERATORS.map(op => (
              <option key={op.value} value={op.value}>
                {isEn ? op.labelEn : op.labelEs}
              </option>
            ))}
          </select>

          {/* Value input (hidden for 'exists' operator) */}
          {condition.operator !== 'exists' && condition.operator === 'in' ? (
            <Input
              value={
                Array.isArray(condition.value)
                  ? condition.value.join(', ')
                  : typeof condition.value === 'string'
                    ? condition.value
                    : ''
              }
              onChange={e =>
                onChange({
                  ...condition,
                  value: e.target.value.split(',').map(v => v.trim()).filter(Boolean),
                })
              }
              placeholder={isEn ? 'Value1, Value2, Value3' : 'Valor1, Valor2, Valor3'}
              className="h-9 text-sm"
            />
          ) : condition.operator !== 'exists' ? (
            <Input
              value={typeof condition.value === 'string' ? condition.value : ''}
              onChange={e =>
                onChange({ ...condition, value: e.target.value })
              }
              placeholder={isEn ? 'Value' : 'Valor'}
              className="h-9 text-sm"
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
