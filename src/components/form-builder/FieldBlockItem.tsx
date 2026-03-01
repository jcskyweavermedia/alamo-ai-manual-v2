// =============================================================================
// FieldBlockItem — Individual field row in the builder list
// Collapsed (default): drag handle, type icon, label, type badge, required, chevron
// Expanded: shows FieldPropertyPanel inline below the collapsed row
// Uses @dnd-kit/sortable for drag-and-drop reordering
// Drag handle is the ONLY drag target (R19 mitigation)
// =============================================================================

import { memo, useState, useCallback } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical,
  ChevronDown,
  ChevronUp,
  ArrowUp,
  ArrowDown,
  Type,
  AlignLeft,
  Hash,
  Phone,
  Mail,
  Calendar,
  Clock,
  CalendarClock,
  List,
  CircleDot,
  CheckSquare,
  Pen,
  Camera,
  FileUp,
  Heading,
  Info,
  BookUser,
  Asterisk,
  ToggleRight,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FieldPropertyPanel } from './FieldPropertyPanel';
import type { FormFieldType, FormFieldDefinition } from '@/types/forms';
import type { ReactNode } from 'react';

// =============================================================================
// TYPE ICON MAP
// =============================================================================

const FIELD_TYPE_ICONS: Record<FormFieldType, ReactNode> = {
  text: <Type className="h-4 w-4" />,
  textarea: <AlignLeft className="h-4 w-4" />,
  number: <Hash className="h-4 w-4" />,
  phone: <Phone className="h-4 w-4" />,
  email: <Mail className="h-4 w-4" />,
  date: <Calendar className="h-4 w-4" />,
  time: <Clock className="h-4 w-4" />,
  datetime: <CalendarClock className="h-4 w-4" />,
  select: <List className="h-4 w-4" />,
  radio: <CircleDot className="h-4 w-4" />,
  checkbox: <CheckSquare className="h-4 w-4" />,
  signature: <Pen className="h-4 w-4" />,
  image: <Camera className="h-4 w-4" />,
  file: <FileUp className="h-4 w-4" />,
  header: <Heading className="h-4 w-4" />,
  instructions: <Info className="h-4 w-4" />,
  contact_lookup: <BookUser className="h-4 w-4" />,
  yes_no: <ToggleRight className="h-4 w-4" />,
};

// Short labels for the type badge pill
const FIELD_TYPE_LABELS: Record<FormFieldType, string> = {
  text: 'text',
  textarea: 'textarea',
  number: 'number',
  phone: 'phone',
  email: 'email',
  date: 'date',
  time: 'time',
  datetime: 'datetime',
  select: 'select',
  radio: 'radio',
  checkbox: 'checkbox',
  signature: 'signature',
  image: 'image',
  file: 'file',
  header: 'header',
  instructions: 'inst.',
  contact_lookup: 'contact',
  yes_no: 'yes/no',
};

// AI fillability indicator dot color
function getAIIndicator(field: FormFieldDefinition): 'green' | 'amber' | null {
  const NON_FILLABLE: FormFieldType[] = ['header', 'instructions', 'signature', 'image', 'file'];
  if (NON_FILLABLE.includes(field.type)) return null;
  if (field.ai_hint?.trim()) return 'green';
  return 'amber';
}

// =============================================================================
// PROPS
// =============================================================================

interface FieldBlockItemProps {
  field: FormFieldDefinition;
  isSelected: boolean;
  isExpanded: boolean;
  isFirst: boolean;
  isLast: boolean;
  allFieldKeys: string[];
  language: 'en' | 'es';
  onToggleExpand: (key: string) => void;
  onMoveUp: (key: string) => void;
  onMoveDown: (key: string) => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

function areFieldBlockItemPropsEqual(
  prev: FieldBlockItemProps,
  next: FieldBlockItemProps,
): boolean {
  return (
    prev.field === next.field &&
    prev.isSelected === next.isSelected &&
    prev.isExpanded === next.isExpanded &&
    prev.isFirst === next.isFirst &&
    prev.isLast === next.isLast &&
    prev.allFieldKeys === next.allFieldKeys &&
    prev.language === next.language
    // Callbacks are stable (useCallback in parent), skip comparison
  );
}

export const FieldBlockItem = memo(function FieldBlockItem({
  field,
  isSelected,
  isExpanded,
  isFirst,
  isLast,
  allFieldKeys,
  language,
  onToggleExpand,
  onMoveUp,
  onMoveDown,
}: FieldBlockItemProps) {
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
    position: 'relative' as const,
  };

  const isEn = language === 'en';
  const aiIndicator = getAIIndicator(field);
  const displayLabel =
    language === 'es' && field.label_es ? field.label_es : field.label;

  const handleRowClick = useCallback(() => {
    onToggleExpand(field.key);
  }, [field.key, onToggleExpand]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-[12px] border transition-colors ${
        isDragging
          ? 'border-primary bg-primary/5 shadow-lg opacity-90'
          : isSelected
            ? 'border-primary/30 bg-primary/[0.04]'
            : 'border-black/[0.04] dark:border-white/[0.06] bg-card'
      }`}
    >
      {/* ================================================================ */}
      {/* COLLAPSED ROW */}
      {/* ================================================================ */}
      <div
        className="flex items-center gap-2 px-2 cursor-pointer select-none"
        onClick={handleRowClick}
        role="button"
        tabIndex={0}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleRowClick();
          }
        }}
        aria-expanded={isExpanded}
      >
        {/* Drag handle — 44x44 touch target, ONLY drag activator */}
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          className="flex items-center justify-center shrink-0 w-[44px] h-[44px] text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
          style={{ touchAction: 'manipulation' }}
          aria-label={isEn ? 'Drag to reorder' : 'Arrastrar para reordenar'}
          onClick={e => e.stopPropagation()}
        >
          <GripVertical className="h-5 w-5" />
        </button>

        {/* Type icon */}
        <div className="flex items-center justify-center shrink-0 w-7 h-7 rounded-[8px] bg-muted/60 text-muted-foreground">
          {FIELD_TYPE_ICONS[field.type]}
        </div>

        {/* Label */}
        <span className="flex-1 min-w-0 text-sm font-medium truncate">
          {displayLabel || (
            <span className="italic text-muted-foreground">
              {isEn ? 'Untitled' : 'Sin titulo'}
            </span>
          )}
        </span>

        {/* AI fillability dot */}
        {aiIndicator && (
          <span
            className={`shrink-0 w-1.5 h-1.5 rounded-full ${
              aiIndicator === 'green' ? 'bg-green-500' : 'bg-amber-500'
            }`}
            title={
              aiIndicator === 'green'
                ? (isEn ? 'AI hint set' : 'Pista IA configurada')
                : (isEn ? 'Missing AI hint' : 'Falta pista IA')
            }
          />
        )}

        {/* Type badge pill */}
        <Badge
          variant="secondary"
          className="shrink-0 text-[10px] px-1.5 py-0 h-5 font-normal"
        >
          {FIELD_TYPE_LABELS[field.type]}
        </Badge>

        {/* Required asterisk */}
        {field.required && (
          <Asterisk className="h-3.5 w-3.5 text-destructive shrink-0" />
        )}

        {/* Expand/collapse chevron */}
        <div className="shrink-0 w-6 h-6 flex items-center justify-center text-muted-foreground">
          {isExpanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </div>
      </div>

      {/* Mobile move up/down buttons (R19 fallback) */}
      {isExpanded && (
        <div className="flex items-center gap-1 px-3 pb-1 sm:hidden">
          <Button
            variant="ghost"
            size="sm"
            disabled={isFirst}
            onClick={e => {
              e.stopPropagation();
              onMoveUp(field.key);
            }}
            className="h-11 min-h-[44px] text-xs px-3"
          >
            <ArrowUp className="h-3.5 w-3.5 mr-1" />
            {isEn ? 'Move Up' : 'Subir'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={isLast}
            onClick={e => {
              e.stopPropagation();
              onMoveDown(field.key);
            }}
            className="h-11 min-h-[44px] text-xs px-3"
          >
            <ArrowDown className="h-3 w-3 mr-1" />
            {isEn ? 'Move Down' : 'Bajar'}
          </Button>
        </div>
      )}

      {/* ================================================================ */}
      {/* EXPANDED: PROPERTY PANEL */}
      {/* ================================================================ */}
      {isExpanded && (
        <FieldPropertyPanel
          field={field}
          allFieldKeys={allFieldKeys}
          language={language}
        />
      )}
    </div>
  );
}, areFieldBlockItemPropsEqual);
