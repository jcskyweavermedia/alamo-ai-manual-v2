// =============================================================================
// ElementPropertiesPanel — Right panel when an element is selected
// Shows type-specific properties: title, ai_instructions, source_refs, status,
// variant selector (feature), media fields, etc.
// "Close" button returns right panel to AI chat mode.
// =============================================================================

import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useCourseBuilder } from '@/contexts/CourseBuilderContext';
import { FEATURE_VARIANTS } from '@/lib/course-builder/builder-utils';
import { PRODUCT_TABLE_META } from '@/lib/course-builder/builder-utils';
import type {
  CourseElement,
  ContentElement,
  FeatureElement,
  MediaElement,
  ProductViewerElement,
  ProductTable,
  FeatureVariant,
  ElementStatus,
  MediaType,
} from '@/types/course-builder';

const STRINGS = {
  en: {
    properties: 'Element Properties',
    close: 'Close',
    type: 'Type',
    status: 'Status',
    elementKey: 'Key',
    aiInstructions: 'AI Instructions',
    aiInstructionsPlaceholder: 'Instructions for AI generation...',
    sourceRefs: 'Source References',
    noSources: 'No sources linked',
    titleEn: 'Title (EN)',
    titleEs: 'Title (ES)',
    bodyEn: 'Body (EN)',
    bodyEs: 'Body (ES)',
    variant: 'Variant',
    icon: 'Icon',
    mediaType: 'Media Type',
    imageUrl: 'Image URL',
    videoUrl: 'Video URL',
    captionEn: 'Caption (EN)',
    captionEs: 'Caption (ES)',
    altTextEn: 'Alt Text (EN)',
    altTextEs: 'Alt Text (ES)',
    aiImagePrompt: 'AI Image Prompt',
    content: 'Content',
    feature: 'Feature',
    media: 'Media',
    product_viewer: 'Product Viewer',
    image: 'Image',
    video: 'Video',
    youtube: 'YouTube',
    linkedProduct: 'Linked Product',
    changeProduct: 'Change Product',
    selectProduct: 'Select Product',
    noProduct: 'No product selected',
    productId: 'Product ID',
    productTable: 'Table',
  },
  es: {
    properties: 'Propiedades del Elemento',
    close: 'Cerrar',
    type: 'Tipo',
    status: 'Estado',
    elementKey: 'Clave',
    aiInstructions: 'Instrucciones para IA',
    aiInstructionsPlaceholder: 'Instrucciones para generacion con IA...',
    sourceRefs: 'Referencias de Origen',
    noSources: 'Sin referencias',
    titleEn: 'Titulo (EN)',
    titleEs: 'Titulo (ES)',
    bodyEn: 'Cuerpo (EN)',
    bodyEs: 'Cuerpo (ES)',
    variant: 'Variante',
    icon: 'Icono',
    mediaType: 'Tipo de Medio',
    imageUrl: 'URL de Imagen',
    videoUrl: 'URL de Video',
    captionEn: 'Leyenda (EN)',
    captionEs: 'Leyenda (ES)',
    altTextEn: 'Texto Alt (EN)',
    altTextEs: 'Texto Alt (ES)',
    aiImagePrompt: 'Prompt de Imagen IA',
    content: 'Contenido',
    feature: 'Destacado',
    media: 'Multimedia',
    product_viewer: 'Visor de Producto',
    image: 'Imagen',
    video: 'Video',
    youtube: 'YouTube',
    linkedProduct: 'Producto Vinculado',
    changeProduct: 'Cambiar Producto',
    selectProduct: 'Seleccionar Producto',
    noProduct: 'Sin producto seleccionado',
    productId: 'ID del Producto',
    productTable: 'Tabla',
  },
};

const statusBadgeStyles: Record<ElementStatus, string> = {
  outline: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  generated: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  reviewed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
};

const statusOptions: ElementStatus[] = ['outline', 'generated', 'reviewed'];

interface ElementPropertiesPanelProps {
  element: CourseElement;
  language: 'en' | 'es';
}

export function ElementPropertiesPanel({ element, language }: ElementPropertiesPanelProps) {
  const t = STRINGS[language];
  const { updateElement, selectElement, dispatch } = useCourseBuilder();

  const handleClose = () => {
    selectElement(null);
    dispatch({ type: 'SET_RIGHT_PANEL_MODE', payload: 'ai-chat' });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{t.properties}</h3>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handleClose}
          aria-label={t.close}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Type + Status */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-[10px] uppercase text-muted-foreground">{t.type}</Label>
          <p className="text-sm font-medium capitalize mt-0.5">{t[element.type]}</p>
        </div>
        <div>
          <Label className="text-[10px] uppercase text-muted-foreground">{t.status}</Label>
          <select
            value={element.status}
            onChange={(e) => updateElement(element.key, { status: e.target.value as ElementStatus })}
            className="mt-0.5 w-full text-sm bg-transparent border rounded px-1.5 py-0.5"
          >
            {statusOptions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Element key (read-only) */}
      <div>
        <Label className="text-[10px] uppercase text-muted-foreground">{t.elementKey}</Label>
        <p className="text-xs text-muted-foreground font-mono mt-0.5">{element.key}</p>
      </div>

      {/* AI Instructions (all element types) */}
      <div>
        <Label className="text-[10px] uppercase text-muted-foreground">{t.aiInstructions}</Label>
        <Textarea
          value={element.ai_instructions}
          onChange={(e) => updateElement(element.key, { ai_instructions: e.target.value })}
          placeholder={t.aiInstructionsPlaceholder}
          className="mt-1 min-h-[60px] text-sm resize-none"
        />
      </div>

      {/* Source Refs */}
      <div>
        <Label className="text-[10px] uppercase text-muted-foreground">{t.sourceRefs}</Label>
        {element.source_refs.length === 0 ? (
          <p className="text-xs text-muted-foreground mt-1">{t.noSources}</p>
        ) : (
          <div className="mt-1 space-y-1">
            {element.source_refs.map((ref, i) => (
              <Badge
                key={i}
                variant="secondary"
                className="text-[10px] font-mono mr-1"
              >
                {ref.table}:{ref.id.slice(0, 8)}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <hr className="border-muted" />

      {/* Type-specific fields */}
      {element.type === 'content' && (
        <ContentProperties element={element} language={language} />
      )}
      {element.type === 'feature' && (
        <FeatureProperties element={element} language={language} />
      )}
      {element.type === 'media' && (
        <MediaProperties element={element} language={language} />
      )}
      {element.type === 'product_viewer' && (
        <ProductViewerProperties element={element as ProductViewerElement} language={language} />
      )}
    </div>
  );
}

// =============================================================================
// CONTENT PROPERTIES
// =============================================================================

function ContentProperties({ element, language }: { element: ContentElement; language: 'en' | 'es' }) {
  const t = STRINGS[language];
  const { updateElement } = useCourseBuilder();

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-[10px] uppercase text-muted-foreground">{t.titleEn}</Label>
        <Input
          value={element.title_en || ''}
          onChange={(e) => updateElement(element.key, { title_en: e.target.value })}
          className="h-8 text-sm mt-1"
        />
      </div>
      <div>
        <Label className="text-[10px] uppercase text-muted-foreground">{t.titleEs}</Label>
        <Input
          value={element.title_es || ''}
          onChange={(e) => updateElement(element.key, { title_es: e.target.value })}
          className="h-8 text-sm mt-1"
        />
      </div>
      <div>
        <Label className="text-[10px] uppercase text-muted-foreground">{t.bodyEn}</Label>
        <Textarea
          value={element.body_en}
          onChange={(e) => updateElement(element.key, { body_en: e.target.value })}
          className="min-h-[80px] text-sm resize-none mt-1 font-mono"
        />
      </div>
      <div>
        <Label className="text-[10px] uppercase text-muted-foreground">{t.bodyEs}</Label>
        <Textarea
          value={element.body_es}
          onChange={(e) => updateElement(element.key, { body_es: e.target.value })}
          className="min-h-[80px] text-sm resize-none mt-1 font-mono"
        />
      </div>
    </div>
  );
}

// =============================================================================
// FEATURE PROPERTIES
// =============================================================================

function FeatureProperties({ element, language }: { element: FeatureElement; language: 'en' | 'es' }) {
  const t = STRINGS[language];
  const { updateElement } = useCourseBuilder();

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-[10px] uppercase text-muted-foreground">{t.variant}</Label>
        <select
          value={element.variant}
          onChange={(e) => {
            const newVariant = e.target.value as FeatureVariant;
            const newConfig = FEATURE_VARIANTS[newVariant];
            updateElement(element.key, { variant: newVariant, icon: newConfig.icon });
          }}
          className="mt-1 w-full text-sm bg-transparent border rounded px-2 py-1"
        >
          {(Object.entries(FEATURE_VARIANTS) as [FeatureVariant, (typeof FEATURE_VARIANTS)[FeatureVariant]][]).map(([v, c]) => (
            <option key={v} value={v}>{language === 'es' ? c.labelEs : c.labelEn}</option>
          ))}
        </select>
      </div>
      <div>
        <Label className="text-[10px] uppercase text-muted-foreground">{t.icon}</Label>
        <Input
          value={element.icon || ''}
          onChange={(e) => updateElement(element.key, { icon: e.target.value })}
          placeholder="Lucide icon name"
          className="h-8 text-sm mt-1 font-mono"
        />
      </div>
      <div>
        <Label className="text-[10px] uppercase text-muted-foreground">{t.titleEn}</Label>
        <Input
          value={element.title_en || ''}
          onChange={(e) => updateElement(element.key, { title_en: e.target.value })}
          className="h-8 text-sm mt-1"
        />
      </div>
      <div>
        <Label className="text-[10px] uppercase text-muted-foreground">{t.titleEs}</Label>
        <Input
          value={element.title_es || ''}
          onChange={(e) => updateElement(element.key, { title_es: e.target.value })}
          className="h-8 text-sm mt-1"
        />
      </div>
      <div>
        <Label className="text-[10px] uppercase text-muted-foreground">{t.bodyEn}</Label>
        <Textarea
          value={element.body_en}
          onChange={(e) => updateElement(element.key, { body_en: e.target.value })}
          className="min-h-[60px] text-sm resize-none mt-1"
        />
      </div>
      <div>
        <Label className="text-[10px] uppercase text-muted-foreground">{t.bodyEs}</Label>
        <Textarea
          value={element.body_es}
          onChange={(e) => updateElement(element.key, { body_es: e.target.value })}
          className="min-h-[60px] text-sm resize-none mt-1"
        />
      </div>
    </div>
  );
}

// =============================================================================
// MEDIA PROPERTIES
// =============================================================================

function MediaProperties({ element, language }: { element: MediaElement; language: 'en' | 'es' }) {
  const t = STRINGS[language];
  const { updateElement } = useCourseBuilder();

  const mediaTypeOptions: { value: MediaType; label: string }[] = [
    { value: 'image', label: t.image },
    { value: 'video', label: t.video },
    { value: 'youtube', label: t.youtube },
  ];

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-[10px] uppercase text-muted-foreground">{t.mediaType}</Label>
        <select
          value={element.media_type}
          onChange={(e) => updateElement(element.key, { media_type: e.target.value as MediaType })}
          className="mt-1 w-full text-sm bg-transparent border rounded px-2 py-1"
        >
          {mediaTypeOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {element.media_type === 'image' && (
        <>
          <div>
            <Label className="text-[10px] uppercase text-muted-foreground">{t.imageUrl}</Label>
            <Input
              value={element.image_url || ''}
              onChange={(e) => updateElement(element.key, { image_url: e.target.value })}
              className="h-8 text-sm mt-1"
            />
          </div>
          <div>
            <Label className="text-[10px] uppercase text-muted-foreground">{t.aiImagePrompt}</Label>
            <Textarea
              value={element.ai_image_prompt || ''}
              onChange={(e) => updateElement(element.key, { ai_image_prompt: e.target.value })}
              className="min-h-[40px] text-sm resize-none mt-1"
            />
          </div>
        </>
      )}

      {(element.media_type === 'video' || element.media_type === 'youtube') && (
        <div>
          <Label className="text-[10px] uppercase text-muted-foreground">{t.videoUrl}</Label>
          <Input
            value={element.video_url || ''}
            onChange={(e) => updateElement(element.key, { video_url: e.target.value })}
            className="h-8 text-sm mt-1"
          />
        </div>
      )}

      <div>
        <Label className="text-[10px] uppercase text-muted-foreground">{t.captionEn}</Label>
        <Input
          value={element.caption_en || ''}
          onChange={(e) => updateElement(element.key, { caption_en: e.target.value })}
          className="h-8 text-sm mt-1"
        />
      </div>
      <div>
        <Label className="text-[10px] uppercase text-muted-foreground">{t.captionEs}</Label>
        <Input
          value={element.caption_es || ''}
          onChange={(e) => updateElement(element.key, { caption_es: e.target.value })}
          className="h-8 text-sm mt-1"
        />
      </div>
      <div>
        <Label className="text-[10px] uppercase text-muted-foreground">{t.altTextEn}</Label>
        <Input
          value={element.alt_text_en || ''}
          onChange={(e) => updateElement(element.key, { alt_text_en: e.target.value })}
          className="h-8 text-sm mt-1"
        />
      </div>
      <div>
        <Label className="text-[10px] uppercase text-muted-foreground">{t.altTextEs}</Label>
        <Input
          value={element.alt_text_es || ''}
          onChange={(e) => updateElement(element.key, { alt_text_es: e.target.value })}
          className="h-8 text-sm mt-1"
        />
      </div>
    </div>
  );
}

// =============================================================================
// PRODUCT VIEWER PROPERTIES
// =============================================================================

function ProductViewerProperties({ element, language }: { element: ProductViewerElement; language: 'en' | 'es' }) {
  const t = STRINGS[language];
  const hasProduct = element.products.length > 0;
  const product = hasProduct ? element.products[0] : null;

  if (!hasProduct) {
    return (
      <div className="space-y-3">
        <div>
          <Label className="text-[10px] uppercase text-muted-foreground">{t.linkedProduct}</Label>
          <p className="text-xs text-muted-foreground mt-1">{t.noProduct}</p>
          <p className="text-[10px] text-muted-foreground mt-1 italic">
            {language === 'es'
              ? 'Usa el selector en la tarjeta del canvas para elegir un producto.'
              : 'Use the picker on the canvas card to select a product.'}
          </p>
        </div>
      </div>
    );
  }

  const meta = PRODUCT_TABLE_META[product!.table as ProductTable];
  const domainLabel = meta ? (language === 'es' ? meta.labelEs : meta.labelEn) : product!.table;
  const displayName = language === 'es' ? (product!.name_es || product!.name_en) : product!.name_en;

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-[10px] uppercase text-muted-foreground">{t.linkedProduct}</Label>
        <p className="text-sm font-medium mt-0.5">{displayName || 'Unnamed'}</p>
      </div>
      <div>
        <Label className="text-[10px] uppercase text-muted-foreground">{t.productTable}</Label>
        <Badge variant="secondary" className="text-[10px] font-mono mt-0.5">
          {domainLabel} ({product!.table})
        </Badge>
      </div>
      <div>
        <Label className="text-[10px] uppercase text-muted-foreground">{t.productId}</Label>
        <p className="text-[10px] text-muted-foreground font-mono mt-0.5 truncate">{product!.id}</p>
      </div>
    </div>
  );
}
