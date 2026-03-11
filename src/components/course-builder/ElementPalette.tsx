// =============================================================================
// ElementPalette — Left panel: draggable element types
// 3 groups: Elements, Callouts, Media & Embed
// Drag to canvas for insert, click to append.
// =============================================================================

import { useDraggable } from '@dnd-kit/core';
import {
  FileText,
  Heading2,
  LayoutGrid,
  ArrowLeftRight,
  MessageSquareQuote,
  CaseSensitive,
  Lightbulb,
  CheckCircle,
  AlertTriangle,
  ShieldAlert,
  Sparkles,
  Star,
  Megaphone,
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
    callouts: 'Callouts',
    mediaEmbed: 'Media & Embed',
    pageHeader: 'Page Header',
    content: 'Content',
    sectionHeader: 'Section Header',
    cardGrid: 'Card Grid',
    comparison: 'Comparison',
    scriptBlock: 'Script Block',
    tip: 'Tip',
    bestPractice: 'Best Practice',
    caution: 'Caution',
    warning: 'Warning',
    didYouKnow: 'Did You Know?',
    keyPoint: 'Key Point',
    standout: 'Standout',
    media: 'Media',
    product: 'Product',
  },
  es: {
    elements: 'Elementos',
    callouts: 'Destacados',
    mediaEmbed: 'Media y Ref.',
    pageHeader: 'Encabezado',
    content: 'Contenido',
    sectionHeader: 'Sub-Sección',
    cardGrid: 'Tarjetas',
    comparison: 'Comparación',
    scriptBlock: 'Script',
    tip: 'Consejo',
    bestPractice: 'Mejor Práctica',
    caution: 'Precaución',
    warning: 'Advertencia',
    didYouKnow: '¿Sabías Que?',
    keyPoint: 'Punto Clave',
    standout: 'Destacado',
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

// --- Elements group ---
const ELEMENT_ITEMS: PaletteItem[] = [
  { id: 'page_header', type: 'page_header', labelKey: 'pageHeader', icon: CaseSensitive, colorClass: 'text-orange-500' },
  { id: 'content', type: 'content', labelKey: 'content', icon: FileText, colorClass: 'text-slate-600' },
  { id: 'section_header', type: 'section_header', labelKey: 'sectionHeader', icon: Heading2, colorClass: 'text-slate-600' },
  { id: 'card_grid', type: 'card_grid', labelKey: 'cardGrid', icon: LayoutGrid, colorClass: 'text-green-500' },
  { id: 'comparison', type: 'comparison', labelKey: 'comparison', icon: ArrowLeftRight, colorClass: 'text-amber-500' },
  { id: 'script_block', type: 'script_block', labelKey: 'scriptBlock', icon: MessageSquareQuote, colorClass: 'text-blue-500' },
];

// --- Callouts group (feature variants) ---
const CALLOUT_ITEMS: PaletteItem[] = [
  { id: 'feature:tip', type: 'feature', variant: 'tip', labelKey: 'tip', icon: Lightbulb, colorClass: 'text-blue-500' },
  { id: 'feature:best_practice', type: 'feature', variant: 'best_practice', labelKey: 'bestPractice', icon: CheckCircle, colorClass: 'text-green-500' },
  { id: 'feature:caution', type: 'feature', variant: 'caution', labelKey: 'caution', icon: AlertTriangle, colorClass: 'text-amber-500' },
  { id: 'feature:warning', type: 'feature', variant: 'warning', labelKey: 'warning', icon: ShieldAlert, colorClass: 'text-red-500' },
  { id: 'feature:did_you_know', type: 'feature', variant: 'did_you_know', labelKey: 'didYouKnow', icon: Sparkles, colorClass: 'text-orange-500' },
  { id: 'feature:key_point', type: 'feature', variant: 'key_point', labelKey: 'keyPoint', icon: Star, colorClass: 'text-indigo-500' },
  { id: 'feature:standout', type: 'feature', variant: 'standout', labelKey: 'standout', icon: Megaphone, colorClass: 'text-orange-500' },
];

// --- Media & Embed group ---
const MEDIA_ITEMS: PaletteItem[] = [
  { id: 'media', type: 'media', labelKey: 'media', icon: ImageIcon, colorClass: 'text-slate-600' },
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
      {/* Elements group */}
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-2">
        {t.elements}
      </h3>
      {ELEMENT_ITEMS.map((item) => (
        <PaletteTile
          key={item.id}
          item={item}
          language={language}
          onClick={() => onClickAdd(item.type, item.variant)}
        />
      ))}

      {/* Callouts group */}
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mt-3 mb-2">
        {t.callouts}
      </h3>
      {CALLOUT_ITEMS.map((item) => (
        <PaletteTile
          key={item.id}
          item={item}
          language={language}
          onClick={() => onClickAdd(item.type, item.variant)}
        />
      ))}

      {/* Media & Embed group */}
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mt-3 mb-2">
        {t.mediaEmbed}
      </h3>
      {MEDIA_ITEMS.map((item) => (
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
