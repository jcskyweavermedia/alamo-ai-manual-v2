// =============================================================================
// ElementPalette — Left panel: draggable element types
// Drag to canvas for insert, click to append.
// =============================================================================

import { useDraggable } from '@dnd-kit/core';
import {
  FileText,
  Lightbulb,
  CheckCircle,
  AlertTriangle,
  ShieldAlert,
  Sparkles,
  Star,
  Image as ImageIcon,
  Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ElementType, FeatureVariant } from '@/types/course-builder';

export const COURSE_PALETTE_DRAG_PREFIX = 'course-palette::';

// =============================================================================
// STRINGS
// =============================================================================

const STRINGS = {
  en: {
    elements: 'Elements',
    content: 'Content',
    tip: 'Tip',
    bestPractice: 'Best Practice',
    caution: 'Caution',
    warning: 'Warning',
    didYouKnow: 'Did You Know?',
    keyPoint: 'Key Point',
    media: 'Media',
    product: 'Product',
  },
  es: {
    elements: 'Elementos',
    content: 'Contenido',
    tip: 'Consejo',
    bestPractice: 'Mejor Practica',
    caution: 'Precaucion',
    warning: 'Advertencia',
    didYouKnow: 'Sabias Que?',
    keyPoint: 'Punto Clave',
    media: 'Multimedia',
    product: 'Producto',
  },
};

interface PaletteItem {
  id: string; // matches drag id suffix
  type: ElementType;
  variant?: FeatureVariant;
  labelKey: keyof (typeof STRINGS)['en'];
  icon: React.ComponentType<{ className?: string }>;
  colorClass: string;
}

const PALETTE_ITEMS: PaletteItem[] = [
  { id: 'content', type: 'content', labelKey: 'content', icon: FileText, colorClass: 'text-slate-600' },
  { id: 'feature:tip', type: 'feature', variant: 'tip', labelKey: 'tip', icon: Lightbulb, colorClass: 'text-blue-500' },
  { id: 'feature:best_practice', type: 'feature', variant: 'best_practice', labelKey: 'bestPractice', icon: CheckCircle, colorClass: 'text-green-500' },
  { id: 'feature:caution', type: 'feature', variant: 'caution', labelKey: 'caution', icon: AlertTriangle, colorClass: 'text-amber-500' },
  { id: 'feature:warning', type: 'feature', variant: 'warning', labelKey: 'warning', icon: ShieldAlert, colorClass: 'text-red-500' },
  { id: 'feature:did_you_know', type: 'feature', variant: 'did_you_know', labelKey: 'didYouKnow', icon: Sparkles, colorClass: 'text-purple-500' },
  { id: 'feature:key_point', type: 'feature', variant: 'key_point', labelKey: 'keyPoint', icon: Star, colorClass: 'text-indigo-500' },
  { id: 'media', type: 'media', labelKey: 'media', icon: ImageIcon, colorClass: 'text-slate-600' },
];

const EMBED_ITEMS: PaletteItem[] = [
  { id: 'product_viewer', type: 'product_viewer', labelKey: 'product', icon: Eye, colorClass: 'text-teal-500' },
];

// =============================================================================
// PALETTE TILE (draggable)
// =============================================================================

function PaletteTile({
  item,
  language,
  onClick,
}: {
  item: PaletteItem;
  language: 'en' | 'es';
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${COURSE_PALETTE_DRAG_PREFIX}${item.id}`,
  });

  const t = STRINGS[language];
  const Icon = item.icon;

  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 w-full px-3 py-2 rounded-lg text-left',
        'text-sm font-medium transition-colors',
        'hover:bg-muted/80 active:bg-muted',
        'cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-50',
      )}
    >
      <Icon className={cn('h-4 w-4 shrink-0', item.colorClass)} />
      <span className="truncate text-foreground/80">{t[item.labelKey]}</span>
    </button>
  );
}

// =============================================================================
// PALETTE COMPONENT
// =============================================================================

interface ElementPaletteProps {
  language: 'en' | 'es';
  onClickAdd: (type: ElementType, variant?: FeatureVariant) => void;
}

export function ElementPalette({ language, onClickAdd }: ElementPaletteProps) {
  const t = STRINGS[language];

  return (
    <div className="p-3 space-y-1">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-2">
        {t.elements}
      </h3>
      {PALETTE_ITEMS.map((item) => (
        <PaletteTile
          key={item.id}
          item={item}
          language={language}
          onClick={() => onClickAdd(item.type, item.variant)}
        />
      ))}
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mt-3 mb-2">
        {language === 'es' ? 'Referencia' : 'Embed'}
      </h3>
      {EMBED_ITEMS.map((item) => (
        <PaletteTile
          key={item.id}
          item={item}
          language={language}
          onClick={() => onClickAdd(item.type, item.variant)}
        />
      ))}
    </div>
  );
}
