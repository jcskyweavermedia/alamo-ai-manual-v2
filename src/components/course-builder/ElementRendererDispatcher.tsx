// =============================================================================
// ElementRendererDispatcher — Routes to type-specific builder renderers
// Extracted to break circular dependency between Canvas and PreviewElementWrapper
// =============================================================================

import { ContentElementRenderer } from './ContentElementRenderer';
import { FeatureElementRenderer } from './FeatureElementRenderer';
import { MediaElementRenderer } from './MediaElementRenderer';
import { ProductViewerElementRenderer } from './ProductViewerElementRenderer';
import { PageHeaderElementRenderer } from './PageHeaderElementRenderer';
import { SectionHeaderElementRenderer } from './SectionHeaderElementRenderer';
import { CardGridElementRenderer } from './CardGridElementRenderer';
import { ComparisonElementRenderer } from './ComparisonElementRenderer';
import { ScriptBlockElementRenderer } from './ScriptBlockElementRenderer';
import type {
  CourseElement,
  ProductViewerElement, PageHeaderElement, SectionHeaderElement,
  CardGridElement, ComparisonElement, ScriptBlockElement,
} from '@/types/course-builder';

export function ElementRendererDispatcher({
  element,
  language,
}: {
  element: CourseElement;
  language: 'en' | 'es';
}) {
  switch (element.type) {
    case 'content':
      return <ContentElementRenderer element={element} language={language} />;
    case 'feature':
      return <FeatureElementRenderer element={element} language={language} />;
    case 'media':
      return <MediaElementRenderer element={element} language={language} />;
    case 'product_viewer':
      return <ProductViewerElementRenderer element={element as ProductViewerElement} language={language} />;
    case 'page_header':
      return <PageHeaderElementRenderer element={element as PageHeaderElement} language={language} />;
    case 'section_header':
      return <SectionHeaderElementRenderer element={element as SectionHeaderElement} language={language} />;
    case 'card_grid':
      return <CardGridElementRenderer element={element as CardGridElement} language={language} />;
    case 'comparison':
      return <ComparisonElementRenderer element={element as ComparisonElement} language={language} />;
    case 'script_block':
      return <ScriptBlockElementRenderer element={element as ScriptBlockElement} language={language} />;
    default:
      return null;
  }
}
