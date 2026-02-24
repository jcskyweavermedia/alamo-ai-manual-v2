// =============================================================================
// ContactLookupFieldInput — Searchable contact picker
// Popover + Command (cmdk). Search input queries contacts.
// Results show name, category, phone. Selected state shows contact card
// with clear button. Value: ContactLookupValue | null
// Uses useFormContacts hook internally.
// =============================================================================

import { useState, useCallback, useEffect, useRef } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { Search, X, User, Phone, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFormContacts } from '@/hooks/use-form-contacts';
import type {
  FormFieldDefinition,
  ContactLookupValue,
  ContactSearchResult,
} from '@/types/forms';

interface ContactLookupFieldInputProps {
  field: FormFieldDefinition;
  value: ContactLookupValue | null;
  onChange: (value: ContactLookupValue | null) => void;
  disabled?: boolean;
  error?: string;
  language: 'en' | 'es';
}

export function ContactLookupFieldInput({
  field,
  value,
  onChange,
  disabled,
  error,
  language,
}: ContactLookupFieldInputProps) {
  const fieldId = `field-${field.key}`;
  const hintId = field.hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<ContactSearchResult[]>([]);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const category = field.validation?.contact_category;
  const {
    contacts: allContacts,
    searchContacts,
    isSearching,
  } = useFormContacts({ category });

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!searchQuery.trim()) {
      // Show initial contacts (all from cache) when no query
      setResults(
        allContacts.map((c) => ({
          id: c.id,
          name: c.name,
          category: c.category,
          subcategory: c.subcategory,
          phone: c.phone,
          contactPerson: c.contactPerson,
          address: c.address,
          isDemoData: c.isDemoData,
          score: 0,
        }))
      );
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      const data = await searchContacts(searchQuery, 10);
      setResults(data);
    }, 200);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, searchContacts, allContacts]);

  const handleSelect = useCallback(
    (contact: ContactSearchResult) => {
      onChange({
        contact_id: contact.id,
        name: contact.name,
        phone: contact.phone,
        contact_person: contact.contactPerson,
      });
      setOpen(false);
      setSearchQuery('');
    },
    [onChange]
  );

  const handleClear = useCallback(() => {
    onChange(null);
  }, [onChange]);

  // If a contact is selected, show the contact card
  if (value) {
    return (
      <div
        className={cn(
          'flex items-center gap-3 h-auto min-h-[44px] p-3 rounded-lg border bg-muted/50',
          error && 'border-destructive'
        )}
      >
        <div className="flex-1 min-w-0 space-y-0.5">
          <p className="text-sm font-medium truncate">{value.name}</p>
          {value.contact_person && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <User className="h-3 w-3" />
              {value.contact_person}
            </p>
          )}
          {value.phone && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {value.phone}
            </p>
          )}
        </div>
        {!disabled && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleClear}
            className="h-8 w-8 shrink-0"
            aria-label={language === 'es' ? 'Borrar contacto' : 'Clear contact'}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    );
  }

  // Show search popover trigger
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={fieldId}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-required={field.required || undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          disabled={disabled}
          className={cn(
            'w-full h-11 justify-start text-muted-foreground font-normal',
            error && 'border-destructive focus:ring-destructive'
          )}
        >
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          {language === 'es' ? 'Buscar contacto...' : 'Search contact...'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={
              language === 'es'
                ? 'Escribir nombre...'
                : 'Type a name...'
            }
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            <CommandEmpty>
              {isSearching
                ? language === 'es'
                  ? 'Buscando...'
                  : 'Searching...'
                : language === 'es'
                  ? 'No se encontraron contactos.'
                  : 'No contacts found.'}
            </CommandEmpty>
            <CommandGroup>
              {results.map((contact) => (
                <CommandItem
                  key={contact.id}
                  value={contact.id}
                  onSelect={() => handleSelect(contact)}
                  className="flex flex-col items-start gap-0.5 py-2"
                >
                  <div className="flex items-center gap-2 w-full">
                    <span className="text-sm font-medium truncate">
                      {contact.name}
                    </span>
                    <span className="text-xs text-muted-foreground ml-auto shrink-0 flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      {contact.category}
                    </span>
                  </div>
                  {contact.phone && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {contact.phone}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
