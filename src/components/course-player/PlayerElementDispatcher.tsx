// =============================================================================
// PlayerElementDispatcher — Routes a CourseElement to the correct player renderer.
// Simple switch dispatcher, no wrapper styling. Receives all data via props.
// =============================================================================

import { PlayerContentRenderer } from './PlayerContentRenderer';
import { PlayerFeatureRenderer } from './PlayerFeatureRenderer';
import { PlayerMediaRenderer } from './PlayerMediaRenderer';
import { PlayerProductRenderer } from './PlayerProductRenderer';
import type { CourseElement } from '@/types/course-builder';

interface Props {
  element: CourseElement;
  language: 'en' | 'es';
}

export function PlayerElementDispatcher({ element, language }: Props) {
  switch (element.type) {
    case 'content':
      return <PlayerContentRenderer element={element} language={language} />;
    case 'feature':
      return <PlayerFeatureRenderer element={element} language={language} />;
    case 'media':
      return <PlayerMediaRenderer element={element} language={language} />;
    case 'product_viewer':
      return <PlayerProductRenderer element={element} language={language} />;
    default:
      return null;
  }
}
