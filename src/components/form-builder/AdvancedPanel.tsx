// =============================================================================
// AdvancedPanel — Right-side panel for advanced field settings
// Opens when gear icon is clicked on a canvas field
// Desktop: fixed panel in right column
// Contains collapsible sections: Labels, Appearance, AI, Validation,
// Conditions, Danger (Delete)
// =============================================================================

import { useState, useCallback, useEffect } from 'react';
import {
  ChevronDown,
  ChevronRight,
  X,
  Trash2,
  Settings2,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useBuilder } from '@/contexts/BuilderContext';
import { generateFieldKey } from '@/lib/form-builder/builder-utils';
import { OptionsEditor } from './OptionsEditor';
import { cn } from '@/lib/utils';
import type { FormFieldCondition, FormFieldDefinition } from '@/types/forms';

// =============================================================================
// CONSTANTS
// =============================================================================

const LAYOUT_TYPES = ['header', 'instructions'] as const;
const CHOICE_TYPES = ['select', 'radio', 'checkbox', 'yes_no'] as const;

function isLayoutType(type: string): boolean {
  return (LAYOUT_TYPES as readonly string[]).includes(type);
}
function isChoiceType(type: string): boolean {
  return (CHOICE_TYPES as readonly string[]).includes(type);
}

const CONTACT_CATEGORIES = [
  { value: 'emergency', labelEn: 'Emergency', labelEs: 'Emergencia' },
  { value: 'medical', labelEn: 'Medical', labelEs: 'Medico' },
  { value: 'management', labelEn: 'Management', labelEs: 'Gerencia' },
  { value: 'vendor', labelEn: 'Vendor', labelEs: 'Proveedor' },
] as const;

const CONDITION_OPERATORS = [
  { value: 'eq', labelEn: 'Equals', labelEs: 'Es igual a' },
  { value: 'neq', labelEn: 'Not Equals', labelEs: 'No es igual a' },
  { value: 'in', labelEn: 'Is one of', labelEs: 'Es uno de' },
  { value: 'exists', labelEn: 'Has a value', labelEs: 'Tiene un valor' },
] as const;

// =============================================================================
// COLLAPSIBLE SECTION
// =============================================================================

function Section({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-border/50 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full py-2.5 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
      >
        {title}
        {open ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
      </button>
      {open && <div className="pb-3 space-y-3">{children}</div>}
    </div>
  );
}

// =============================================================================
// FORM FIELD WRAPPER (reusable)
// =============================================================================

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
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function AdvancedPanel({ language }: { language: 'en' | 'es' }) {
  const { state, updateField, removeField, selectField } = useBuilder();

  const field = state.fields.find(f => f.key === state.selectedFieldKey);
  const allFieldKeys = state.fields.map(f => f.key);
  const isEn = language === 'en';

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showAdvancedKey, setShowAdvancedKey] = useState(false);
  const [localKey, setLocalKey] = useState(field?.key || '');

  // Sync localKey when selected field changes
  useEffect(() => {
    if (field && localKey !== field.key && !showAdvancedKey) {
      setLocalKey(field.key);
    }
  }, [field?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!field) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-sm">
          {isEn ? 'Select a field to edit settings.' : 'Selecciona un campo para editar ajustes.'}
        </p>
      </div>
    );
  }

  const isLayout = isLayoutType(field.type);
  const isChoice = isChoiceType(field.type);
  const isNumber = field.type === 'number';
  const isContactLookup = field.type === 'contact_lookup';

  const otherKeys = allFieldKeys.filter(k => k !== field.key);
  const keyCollision = otherKeys.includes(localKey) && localKey !== field.key;

  const handleUpdate = (updates: Partial<FormFieldDefinition>) => {
    updateField(field.key, updates);
  };

  const handleClose = () => {
    selectField(null);
  };

  const handleDelete = () => {
    if (confirmDelete) {
      removeField(field.key);
      setConfirmDelete(false);
    } else {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  };

  const handleKeyChange = (value: string) => {
    const sanitized = value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 50);
    setLocalKey(sanitized);
  };

  const handleKeyBlur = () => {
    if (!keyCollision && localKey.length > 0 && localKey !== field.key) {
      updateField(field.key, { key: localKey });
    } else if (localKey.length === 0) {
      setLocalKey(field.key);
    }
  };

  const conditionFieldOptions = otherKeys;

  const handleConditionChange = (condition: FormFieldCondition | null) => {
    updateField(field.key, { condition });
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b">
        <h3 className="text-sm font-semibold truncate">
          {field.label || (isEn ? 'Untitled' : 'Sin titulo')}
        </h3>
        <button
          type="button"
          onClick={handleClose}
          className="w-7 h-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {/* ================================================================ */}
        {/* LABELS SECTION */}
        {/* ================================================================ */}
        <Section title={isEn ? 'Labels' : 'Etiquetas'} defaultOpen>
          <FormField label={isEn ? 'Label (ES)' : 'Etiqueta (ES)'}>
            <Input
              value={field.label_es || ''}
              onChange={e => handleUpdate({ label_es: e.target.value || undefined })}
              placeholder={isEn ? 'Spanish label' : 'Etiqueta en espanol'}
              className="h-8 text-sm"
            />
          </FormField>

          <FormField
            label={isEn ? 'Key' : 'Clave'}
            trailing={
              <button
                type="button"
                onClick={() => setShowAdvancedKey(!showAdvancedKey)}
                className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
              >
                <Settings2 className="h-3 w-3" />
                {showAdvancedKey ? (isEn ? 'Lock' : 'Bloquear') : (isEn ? 'Edit' : 'Editar')}
              </button>
            }
          >
            {showAdvancedKey ? (
              <div className="space-y-1">
                <Input
                  value={localKey}
                  onChange={e => handleKeyChange(e.target.value)}
                  onBlur={handleKeyBlur}
                  className={cn(
                    'h-8 text-sm font-mono',
                    keyCollision && 'border-destructive focus-visible:ring-destructive',
                  )}
                />
                {keyCollision && (
                  <p className="text-[11px] text-destructive">
                    {isEn ? `Key "${localKey}" already used.` : `Clave "${localKey}" ya en uso.`}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs font-mono text-muted-foreground bg-muted/50 px-2.5 py-1.5 rounded-md">
                {field.key}
              </p>
            )}
          </FormField>
        </Section>

        {/* ================================================================ */}
        {/* APPEARANCE SECTION (non-layout fields) */}
        {/* ================================================================ */}
        {!isLayout && (
          <Section title={isEn ? 'Appearance' : 'Apariencia'}>
            <FormField label={isEn ? 'Placeholder' : 'Texto de ejemplo'}>
              <Input
                value={field.placeholder || ''}
                onChange={e => handleUpdate({ placeholder: e.target.value || undefined })}
                placeholder={isEn ? 'Shown when empty' : 'Se muestra cuando esta vacio'}
                className="h-8 text-sm"
              />
            </FormField>

            <FormField label={isEn ? 'Hint' : 'Pista'}>
              <Input
                value={field.hint || ''}
                onChange={e => handleUpdate({ hint: e.target.value || undefined })}
                placeholder={isEn ? 'Helper text below field' : 'Texto de ayuda'}
                className="h-8 text-sm"
              />
            </FormField>

            {/* Width */}
            <div className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground">
                {isEn ? 'Width' : 'Ancho'}
              </Label>
              <div className="flex gap-2">
                {(['full', 'half'] as const).map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => handleUpdate({ width: w })}
                    className={cn(
                      'flex-1 py-1 text-xs font-medium rounded-md border transition-colors',
                      (field.width || 'full') === w
                        ? 'bg-primary/10 border-primary text-primary'
                        : 'border-input text-muted-foreground hover:border-primary/30',
                    )}
                  >
                    {w === 'full' ? (isEn ? 'Full' : 'Completo') : (isEn ? 'Half' : 'Mitad')}
                  </button>
                ))}
              </div>
            </div>
          </Section>
        )}

        {/* ================================================================ */}
        {/* AI SECTION (non-layout fields) */}
        {/* ================================================================ */}
        {!isLayout && (
          <Section title={isEn ? 'AI Hint (Advanced)' : 'Pista para IA (Avanzado)'}>
            <p className="text-xs text-muted-foreground mb-2">
              {isEn
                ? 'Optional. The AI already reads the field name, type, and your form instructions. Only add a hint if this field is ambiguous or needs special handling.'
                : 'Opcional. La IA ya lee el nombre del campo, tipo y tus instrucciones. Solo agrega una pista si el campo es ambiguo o necesita manejo especial.'}
            </p>
            <Textarea
              value={field.ai_hint || ''}
              onChange={e => handleUpdate({ ai_hint: e.target.value || undefined })}
              placeholder={
                isEn
                  ? 'e.g. "This is the dollar amount, not quantity"'
                  : 'ej. "Este es el monto en dolares, no la cantidad"'
              }
              className="min-h-[60px] text-sm"
            />
          </Section>
        )}

        {/* ================================================================ */}
        {/* VALIDATION SECTION (type-specific) */}
        {/* ================================================================ */}
        {(isChoice || isNumber || field.type === 'phone' || field.type === 'email' || field.type === 'image' || isContactLookup) && (
          <Section title={isEn ? 'Validation' : 'Validacion'}>
            {/* Options (select/radio/checkbox/yes_no) */}
            {isChoice && (
              <OptionsEditor
                options={field.options || []}
                onChange={options => handleUpdate({ options })}
                language={language}
                fieldType={field.type}
              />
            )}

            {/* Number: Min/Max */}
            {isNumber && (
              <div className="grid grid-cols-2 gap-2">
                <FormField label={isEn ? 'Min' : 'Minimo'}>
                  <Input
                    type="number"
                    value={field.validation?.min ?? ''}
                    onChange={e => {
                      const val = e.target.value === '' ? undefined : Number(e.target.value);
                      handleUpdate({ validation: { ...field.validation, min: val } });
                    }}
                    placeholder="0"
                    className="h-8 text-sm"
                  />
                </FormField>
                <FormField label={isEn ? 'Max' : 'Maximo'}>
                  <Input
                    type="number"
                    value={field.validation?.max ?? ''}
                    onChange={e => {
                      const val = e.target.value === '' ? undefined : Number(e.target.value);
                      handleUpdate({ validation: { ...field.validation, max: val } });
                    }}
                    placeholder="100"
                    className="h-8 text-sm"
                  />
                </FormField>
              </div>
            )}

            {/* Phone/Email pattern */}
            {(field.type === 'phone' || field.type === 'email') && (
              <FormField
                label={isEn ? 'Pattern (regex)' : 'Patron (regex)'}
                hint={isEn ? 'Optional validation pattern' : 'Patron de validacion opcional'}
              >
                <Input
                  value={field.validation?.pattern || ''}
                  onChange={e => handleUpdate({ validation: { ...field.validation, pattern: e.target.value || undefined } })}
                  placeholder="^..."
                  className="h-8 text-sm font-mono"
                />
              </FormField>
            )}

            {/* Image max photos */}
            {field.type === 'image' && (
              <FormField
                label={isEn ? 'Max Photos' : 'Max fotos'}
                hint={isEn ? '1-5' : '1-5'}
              >
                <Input
                  type="number"
                  min={1}
                  max={5}
                  value={field.validation?.max_photos ?? 5}
                  onChange={e => {
                    const val = Math.min(5, Math.max(1, Number(e.target.value) || 1));
                    handleUpdate({ validation: { ...field.validation, max_photos: val } });
                  }}
                  className="h-8 text-sm w-20"
                />
              </FormField>
            )}

            {/* Contact Lookup: Category */}
            {isContactLookup && (
              <FormField label={isEn ? 'Contact Category' : 'Categoria'}>
                <select
                  value={field.validation?.contact_category || ''}
                  onChange={e => handleUpdate({ validation: { ...field.validation, contact_category: e.target.value || undefined } })}
                  className="flex h-8 w-full rounded-md border border-input bg-background px-2.5 py-1 text-sm"
                >
                  <option value="">{isEn ? 'All' : 'Todas'}</option>
                  {CONTACT_CATEGORIES.map(cat => (
                    <option key={cat.value} value={cat.value}>
                      {isEn ? cat.labelEn : cat.labelEs}
                    </option>
                  ))}
                </select>
              </FormField>
            )}
          </Section>
        )}

        {/* ================================================================ */}
        {/* CONDITIONS SECTION */}
        {/* ================================================================ */}
        {!isLayout && (
          <Section title={isEn ? 'Conditions' : 'Condiciones'}>
            <ConditionEditor
              condition={field.condition || null}
              availableFieldKeys={conditionFieldOptions}
              onChange={handleConditionChange}
              language={language}
            />
          </Section>
        )}

        {/* ================================================================ */}
        {/* DANGER SECTION */}
        {/* ================================================================ */}
        <Section title={isEn ? 'Danger Zone' : 'Zona de peligro'}>
          <Button
            variant={confirmDelete ? 'destructive' : 'outline'}
            size="sm"
            onClick={handleDelete}
            className="w-full h-8 text-sm"
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            {confirmDelete
              ? (isEn ? 'Confirm Delete' : 'Confirmar')
              : (isEn ? 'Delete Field' : 'Eliminar campo')}
          </Button>
        </Section>
      </div>
    </div>
  );
}

// =============================================================================
// CONDITION EDITOR (extracted sub-component)
// =============================================================================

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
          {isEn ? 'Show conditionally' : 'Mostrar condicionalmente'}
        </Label>
        <Switch checked={hasCondition} onCheckedChange={handleToggle} />
      </div>

      {hasCondition && condition && (
        <div className="space-y-2">
          <select
            value={condition.field}
            onChange={e => onChange({ ...condition, field: e.target.value })}
            className="flex h-8 w-full rounded-md border border-input bg-background px-2.5 py-1 text-sm"
          >
            <option value="" disabled>{isEn ? 'Select field...' : 'Campo...'}</option>
            {availableFieldKeys.map(key => (
              <option key={key} value={key}>{key}</option>
            ))}
          </select>

          <select
            value={condition.operator}
            onChange={e => onChange({ ...condition, operator: e.target.value as FormFieldCondition['operator'] })}
            className="flex h-8 w-full rounded-md border border-input bg-background px-2.5 py-1 text-sm"
          >
            {CONDITION_OPERATORS.map(op => (
              <option key={op.value} value={op.value}>
                {isEn ? op.labelEn : op.labelEs}
              </option>
            ))}
          </select>

          {condition.operator !== 'exists' && (
            <Input
              value={
                condition.operator === 'in'
                  ? (Array.isArray(condition.value) ? condition.value.join(', ') : String(condition.value || ''))
                  : String(condition.value || '')
              }
              onChange={e => {
                const val = condition.operator === 'in'
                  ? e.target.value.split(',').map(v => v.trim()).filter(Boolean)
                  : e.target.value;
                onChange({ ...condition, value: val });
              }}
              placeholder={condition.operator === 'in' ? 'Value1, Value2' : (isEn ? 'Value' : 'Valor')}
              className="h-8 text-sm"
            />
          )}
        </div>
      )}
    </div>
  );
}
