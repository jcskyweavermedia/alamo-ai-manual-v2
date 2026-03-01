// =============================================================================
// OptionsEditor — Sub-component for editing select/radio/checkbox options
// Supports inline editing, drag reorder, bulk add, and common presets (R33)
// =============================================================================

import { useState, useRef, useCallback, type KeyboardEvent } from 'react';
import {
  GripVertical,
  X,
  Plus,
  ListPlus,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import type { OptionsEditorProps } from '@/types/form-builder';

// =============================================================================
// PRESETS
// =============================================================================

interface OptionPreset {
  label: string;
  values: string[];
}

const OPTION_PRESETS: OptionPreset[] = [
  { label: 'Yes / No', values: ['Yes', 'No'] },
  { label: 'Yes / No / N/A', values: ['Yes', 'No', 'N/A'] },
  { label: 'Departments', values: ['FOH', 'BOH', 'Bar', 'Mgmt'] },
  { label: 'Severity Levels', values: ['Minor', 'Moderate', 'Major', 'Critical'] },
];

const MAX_OPTIONS = 50;

// =============================================================================
// COMPONENT
// =============================================================================

export function OptionsEditor({ options, onChange, language, fieldType }: OptionsEditorProps) {
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [showPresets, setShowPresets] = useState(false);
  const inputRefs = useRef<Map<number, HTMLInputElement>>(new Map());

  const isEn = language === 'en';
  const atLimit = options.length >= MAX_OPTIONS;

  // --- Single option operations ---

  const handleOptionChange = useCallback(
    (index: number, value: string) => {
      const updated = [...options];
      updated[index] = value;
      onChange(updated);
    },
    [options, onChange],
  );

  const handleAddOption = useCallback(() => {
    if (atLimit) return;
    const updated = [...options, ''];
    onChange(updated);
    // Focus the new input after render
    requestAnimationFrame(() => {
      const ref = inputRefs.current.get(updated.length - 1);
      ref?.focus();
    });
  }, [options, onChange, atLimit]);

  const handleRemoveOption = useCallback(
    (index: number) => {
      const updated = options.filter((_, i) => i !== index);
      onChange(updated);
    },
    [options, onChange],
  );

  const handleKeyDown = useCallback(
    (index: number, e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (index === options.length - 1 && !atLimit) {
          handleAddOption();
        } else {
          const nextRef = inputRefs.current.get(index + 1);
          nextRef?.focus();
        }
      }
      if (e.key === 'Backspace' && options[index] === '' && options.length > 1) {
        e.preventDefault();
        handleRemoveOption(index);
        requestAnimationFrame(() => {
          const prevRef = inputRefs.current.get(Math.max(0, index - 1));
          prevRef?.focus();
        });
      }
    },
    [options, atLimit, handleAddOption, handleRemoveOption],
  );

  // --- Paste support (R33: parse comma or newline separated values) ---

  const handlePaste = useCallback(
    (index: number, e: React.ClipboardEvent<HTMLInputElement>) => {
      const text = e.clipboardData.getData('text/plain');
      // Only intercept if the pasted text contains newlines or commas (multi-value paste)
      if (!text.includes('\n') && !text.includes(',')) return;

      e.preventDefault();
      const parsed = text
        .split(/[\n,]/)
        .map(v => v.trim())
        .filter(v => v.length > 0);

      if (parsed.length === 0) return;

      // Replace the current option with the first parsed value, append the rest
      const updated = [...options];
      updated[index] = parsed[0];
      const remaining = parsed.slice(1);
      const insertAfter = index + 1;
      updated.splice(insertAfter, 0, ...remaining);

      // Cap at MAX_OPTIONS
      onChange(updated.slice(0, MAX_OPTIONS));
    },
    [options, onChange],
  );

  // --- Move up/down ---

  const handleMoveOption = useCallback(
    (index: number, direction: 'up' | 'down') => {
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= options.length) return;
      const updated = [...options];
      const temp = updated[index];
      updated[index] = updated[targetIndex];
      updated[targetIndex] = temp;
      onChange(updated);
    },
    [options, onChange],
  );

  // --- Bulk add ---

  const handleBulkAdd = useCallback(() => {
    const newOptions = bulkText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    if (newOptions.length === 0) return;

    const totalAfter = options.length + newOptions.length;
    const allowed = newOptions.slice(0, MAX_OPTIONS - options.length);

    if (allowed.length > 0) {
      onChange([...options, ...allowed]);
    }
    setBulkText('');
    setBulkMode(false);

    if (totalAfter > MAX_OPTIONS) {
      // Silently cap -- the user will see the count warning
    }
  }, [bulkText, options, onChange]);

  // --- Presets ---

  const handleApplyPreset = useCallback(
    (preset: OptionPreset) => {
      onChange(preset.values);
      setShowPresets(false);
    },
    [onChange],
  );

  // --- Bulk mode view ---

  if (bulkMode) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-bold uppercase tracking-wider text-muted-foreground">
            {isEn ? 'Bulk Add Options' : 'Agregar opciones en lote'}
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setBulkMode(false)}
            className="h-8 text-xs"
          >
            {isEn ? 'Cancel' : 'Cancelar'}
          </Button>
        </div>
        <Textarea
          value={bulkText}
          onChange={e => setBulkText(e.target.value)}
          placeholder={
            isEn
              ? 'Type one option per line...\nOption 1\nOption 2\nOption 3'
              : 'Escriba una opcion por linea...\nOpcion 1\nOpcion 2\nOpcion 3'
          }
          className="min-h-[120px] text-sm"
        />
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {bulkText
              .split('\n')
              .filter(l => l.trim().length > 0).length}{' '}
            {isEn ? 'options' : 'opciones'}
          </p>
          <Button size="sm" onClick={handleBulkAdd} className="h-8">
            <Plus className="h-3.5 w-3.5 mr-1" />
            {isEn ? 'Add All' : 'Agregar todas'}
          </Button>
        </div>
      </div>
    );
  }

  // --- Normal mode view ---

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-bold uppercase tracking-wider text-muted-foreground">
          {isEn ? 'Options' : 'Opciones'}
        </p>
        <span className="text-xs text-muted-foreground">
          {options.length} / {MAX_OPTIONS}
        </span>
      </div>

      {/* Option list */}
      <div className="space-y-1.5">
        {options.map((option, index) => (
          <div key={index} className="flex items-center gap-1.5 group">
            {/* Move up/down */}
            <div className="flex flex-col shrink-0">
              <button
                type="button"
                onClick={() => handleMoveOption(index, 'up')}
                disabled={index === 0}
                className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label={isEn ? 'Move up' : 'Mover arriba'}
              >
                <ChevronUp className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => handleMoveOption(index, 'down')}
                disabled={index === options.length - 1}
                className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label={isEn ? 'Move down' : 'Mover abajo'}
              >
                <ChevronDown className="h-3 w-3" />
              </button>
            </div>

            {/* Index label */}
            <span className="text-xs text-muted-foreground w-5 text-right shrink-0">
              {index + 1}.
            </span>

            {/* Option input */}
            <Input
              ref={el => {
                if (el) {
                  inputRefs.current.set(index, el);
                } else {
                  inputRefs.current.delete(index);
                }
              }}
              value={option}
              onChange={e => handleOptionChange(index, e.target.value)}
              onKeyDown={e => handleKeyDown(index, e)}
              onPaste={e => handlePaste(index, e)}
              placeholder={isEn ? `Option ${index + 1}` : `Opcion ${index + 1}`}
              className="h-9 text-sm flex-1"
            />

            {/* Delete button */}
            <button
              type="button"
              onClick={() => handleRemoveOption(index)}
              className="p-1.5 text-muted-foreground hover:text-destructive shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
              aria-label={isEn ? `Remove option ${index + 1}` : `Eliminar opcion ${index + 1}`}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Limit warning */}
      {atLimit && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          {isEn ? 'Maximum 50 options reached.' : 'Se alcanzo el maximo de 50 opciones.'}
        </p>
      )}

      {/* 15+ option warning for radio/checkbox (m3) */}
      {!atLimit && options.length >= 15 && (fieldType === 'radio' || fieldType === 'checkbox') && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          {isEn
            ? `${options.length} options is a lot for ${fieldType}. Consider converting to a searchable select.`
            : `${options.length} opciones es mucho para ${fieldType}. Considera convertir a un select con busqueda.`}
        </p>
      )}

      {/* Action row */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          onClick={handleAddOption}
          disabled={atLimit}
          className="h-8 text-xs"
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          {isEn ? 'Add Option' : 'Agregar'}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setBulkMode(true)}
          disabled={atLimit}
          className="h-8 text-xs"
        >
          <ListPlus className="h-3.5 w-3.5 mr-1" />
          {isEn ? 'Bulk Add' : 'Lote'}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowPresets(!showPresets)}
          className="h-8 text-xs"
        >
          {isEn ? 'Presets' : 'Plantillas'}
        </Button>
      </div>

      {/* Presets dropdown */}
      {showPresets && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {OPTION_PRESETS.map(preset => (
            <Badge
              key={preset.label}
              variant="outline"
              className="cursor-pointer hover:bg-primary/10 transition-colors text-xs px-2 py-1"
              onClick={() => handleApplyPreset(preset)}
            >
              {preset.label}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
