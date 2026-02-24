import { useMemo, useCallback } from 'react';
import { groupFieldsIntoSections } from '@/lib/form-utils';
import { FormSection } from './FormSection';
import { FormFieldRenderer } from './FormFieldRenderer';
import type {
  FormFieldDefinition,
  FormFieldValue,
  FormBodyProps,
} from '@/types/forms';

/**
 * Main body of a form: groups fields into sections and renders them.
 *
 * - Groups fields by "header" type fields using groupFieldsIntoSections()
 * - Evaluates conditional visibility at the FormSection level
 * - Delegates individual field rendering to FormFieldRenderer
 */
export function FormBody({
  fields,
  values,
  errors,
  language,
  onFieldChange,
}: FormBodyProps) {
  // Derive sections from the template fields (header fields become dividers)
  const sections = useMemo(() => groupFieldsIntoSections(fields), [fields]);

  // Build a lookup map for field definitions by key
  const fieldMap = useMemo(() => {
    const map = new Map<string, FormFieldDefinition>();
    for (const f of fields) {
      map.set(f.key, f);
    }
    return map;
  }, [fields]);

  // Stable render function for fields — passed down to FormSection
  const renderField = useCallback(
    (
      fieldKey: string,
      value: FormFieldValue,
      error: string | undefined,
      onChange: (value: FormFieldValue) => void,
    ) => {
      const field = fieldMap.get(fieldKey);
      if (!field) return null;

      return (
        <FormFieldRenderer
          field={field}
          value={value}
          error={error}
          language={language}
          onChange={onChange}
        />
      );
    },
    [fieldMap, language],
  );

  return (
    <div className="space-y-7 pb-6">
      {sections.map((section) => (
        <FormSection
          key={section.headerKey}
          section={section}
          values={values}
          errors={errors}
          language={language}
          onFieldChange={onFieldChange}
          renderField={renderField}
        />
      ))}
    </div>
  );
}
