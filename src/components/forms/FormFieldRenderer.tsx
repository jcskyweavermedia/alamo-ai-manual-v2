// =============================================================================
// FormFieldRenderer — Maps FormFieldType to the correct input component
// Static Record<FormFieldType, ComponentType> map for O(1) lookup
// Wrapped in React.memo with custom comparator
// 'header' type NOT rendered here (handled at FormBody level)
// Each field wrapped in FormFieldWrapper
// =============================================================================

import React, { useCallback } from 'react';
import { FormFieldWrapper } from '@/components/forms/FormFieldWrapper';

// Field input components
import { TextFieldInput } from '@/components/forms/fields/TextFieldInput';
import { TextareaFieldInput } from '@/components/forms/fields/TextareaFieldInput';
import { DateFieldInput } from '@/components/forms/fields/DateFieldInput';
import { TimeFieldInput } from '@/components/forms/fields/TimeFieldInput';
import { DateTimeFieldInput } from '@/components/forms/fields/DateTimeFieldInput';
import { SelectFieldInput } from '@/components/forms/fields/SelectFieldInput';
import { RadioFieldInput } from '@/components/forms/fields/RadioFieldInput';
import { CheckboxFieldInput } from '@/components/forms/fields/CheckboxFieldInput';
import { NumberFieldInput } from '@/components/forms/fields/NumberFieldInput';
import { PhoneFieldInput } from '@/components/forms/fields/PhoneFieldInput';
import { EmailFieldInput } from '@/components/forms/fields/EmailFieldInput';
import { SignatureFieldInput } from '@/components/forms/fields/SignatureFieldInput';
import { ImageFieldInput } from '@/components/forms/fields/ImageFieldInput';
import { FileFieldInput } from '@/components/forms/fields/FileFieldInput';
import { InstructionsField } from '@/components/forms/fields/InstructionsField';
import { ContactLookupFieldInput } from '@/components/forms/fields/ContactLookupFieldInput';
import { YesNoFieldInput } from '@/components/forms/fields/YesNoFieldInput';

import type {
  FormFieldRendererProps,
  FormFieldType,
  FormFieldValue,
  SignatureValue,
  ImageValue,
  FileValue,
  ContactLookupValue,
} from '@/types/forms';

interface ExtendedFormFieldRendererProps extends FormFieldRendererProps {
  aiHighlighted?: boolean;
  aiMissing?: boolean;
  /** When true, hides the label in FormFieldWrapper (for canvas inline editing) */
  hideLabel?: boolean;
}

// =============================================================================
// RENDERER COMPONENT (inner, pre-memo)
// =============================================================================

function FormFieldRendererInner({
  field,
  value,
  error,
  language,
  onChange,
  aiHighlighted,
  aiMissing,
  hideLabel,
}: ExtendedFormFieldRendererProps) {
  // 'header' is not rendered here — handled at FormBody level
  if (field.type === 'header') {
    return null;
  }

  // 'instructions' has its own layout (no FormFieldWrapper needed)
  if (field.type === 'instructions') {
    return <InstructionsField field={field} language={language} />;
  }

  // Render the correct field input based on type
  const fieldInput = renderFieldInput(field.type, field, value, error, onChange, language);

  if (!fieldInput) {
    // Unknown field type fallback
    return (
      <FormFieldWrapper field={field} error={error} language={language} aiHighlighted={aiHighlighted} aiMissing={aiMissing} hideLabel={hideLabel}>
        <p className="text-sm text-muted-foreground italic">
          Unsupported field type: {field.type}
        </p>
      </FormFieldWrapper>
    );
  }

  return (
    <FormFieldWrapper field={field} error={error} language={language} aiHighlighted={aiHighlighted} aiMissing={aiMissing} hideLabel={hideLabel}>
      {fieldInput}
    </FormFieldWrapper>
  );
}

// =============================================================================
// FIELD INPUT DISPATCHER
// Using a function instead of a Record map to handle the different prop
// signatures (string vs string[] vs SignatureValue etc.) with type safety
// =============================================================================

function renderFieldInput(
  type: FormFieldType,
  field: FormFieldRendererProps['field'],
  value: FormFieldValue,
  error: string | undefined,
  onChange: (value: FormFieldValue) => void,
  language: 'en' | 'es'
): React.ReactNode {
  // Helper to cast onChange for string fields
  const onStringChange = onChange as (v: string) => void;

  switch (type) {
    case 'text':
      return (
        <TextFieldInput
          field={field}
          value={(value as string) ?? ''}
          onChange={onStringChange}
          error={error}
        />
      );

    case 'textarea':
      return (
        <TextareaFieldInput
          field={field}
          value={(value as string) ?? ''}
          onChange={onStringChange}
          error={error}
        />
      );

    case 'date':
      return (
        <DateFieldInput
          field={field}
          value={(value as string) ?? ''}
          onChange={onStringChange}
          error={error}
        />
      );

    case 'time':
      return (
        <TimeFieldInput
          field={field}
          value={(value as string) ?? ''}
          onChange={onStringChange}
          error={error}
        />
      );

    case 'datetime':
      return (
        <DateTimeFieldInput
          field={field}
          value={(value as string) ?? ''}
          onChange={onStringChange}
          error={error}
        />
      );

    case 'number':
      return (
        <NumberFieldInput
          field={field}
          value={value != null ? String(value) : ''}
          onChange={onStringChange}
          error={error}
        />
      );

    case 'phone':
      return (
        <PhoneFieldInput
          field={field}
          value={(value as string) ?? ''}
          onChange={onStringChange}
          error={error}
        />
      );

    case 'email':
      return (
        <EmailFieldInput
          field={field}
          value={(value as string) ?? ''}
          onChange={onStringChange}
          error={error}
        />
      );

    case 'select':
      return (
        <SelectFieldInput
          field={field}
          value={(value as string) ?? ''}
          onChange={onStringChange}
          error={error}
        />
      );

    case 'radio':
      return (
        <RadioFieldInput
          field={field}
          value={(value as string) ?? ''}
          onChange={onStringChange}
          error={error}
        />
      );

    case 'checkbox':
      return (
        <CheckboxFieldInput
          field={field}
          value={(value as string[]) ?? []}
          onChange={onChange as (v: string[]) => void}
          error={error}
        />
      );

    case 'signature':
      return (
        <SignatureFieldInput
          field={field}
          value={(value as SignatureValue) ?? null}
          onChange={onChange as (v: SignatureValue | null) => void}
          error={error}
        />
      );

    case 'image':
      return (
        <ImageFieldInput
          field={field}
          value={(value as ImageValue[]) ?? []}
          onChange={onChange as (v: ImageValue[]) => void}
          error={error}
        />
      );

    case 'file':
      return (
        <FileFieldInput
          field={field}
          value={(value as FileValue[]) ?? []}
          onChange={onChange as (v: FileValue[]) => void}
          error={error}
        />
      );

    case 'contact_lookup':
      return (
        <ContactLookupFieldInput
          field={field}
          value={(value as ContactLookupValue) ?? null}
          onChange={onChange as (v: ContactLookupValue | null) => void}
          error={error}
          language={language}
        />
      );

    case 'yes_no':
      return (
        <YesNoFieldInput
          field={field}
          value={(value as string) ?? ''}
          onChange={onStringChange}
          error={error}
        />
      );

    // 'header' and 'instructions' are handled above
    default:
      return null;
  }
}

// =============================================================================
// MEMOIZED EXPORT — custom comparator on value, error, language, field.key
// =============================================================================

export const FormFieldRenderer = React.memo(FormFieldRendererInner, (prev: ExtendedFormFieldRendererProps, next: ExtendedFormFieldRendererProps) => {
  // Return true if props are EQUAL (skip re-render)
  if (prev.field.key !== next.field.key) return false;
  if (prev.language !== next.language) return false;
  if (prev.error !== next.error) return false;
  if (prev.aiHighlighted !== next.aiHighlighted) return false;
  if (prev.aiMissing !== next.aiMissing) return false;
  if (prev.hideLabel !== next.hideLabel) return false;

  // Deep compare value — handle arrays and objects
  if (prev.value === next.value) return true;

  // Both null/undefined
  if (prev.value == null && next.value == null) return true;

  // One null, other not
  if (prev.value == null || next.value == null) return false;

  // Arrays: shallow compare
  if (Array.isArray(prev.value) && Array.isArray(next.value)) {
    if (prev.value.length !== next.value.length) return false;
    return prev.value.every((v, i) => v === next.value![i as keyof typeof next.value]);
  }

  // Objects: JSON compare for complex values (SignatureValue, ContactLookupValue)
  if (typeof prev.value === 'object' && typeof next.value === 'object') {
    return JSON.stringify(prev.value) === JSON.stringify(next.value);
  }

  // Primitives
  return prev.value === next.value;
});

FormFieldRenderer.displayName = 'FormFieldRenderer';
