// =============================================================================
// PlayerElementDispatcher — Routes a CourseElement to the correct player renderer.
// Simple switch dispatcher, no wrapper styling. Receives all data via props.
// =============================================================================

import { PlayerContentRenderer } from './PlayerContentRenderer';
import { PlayerFeatureRenderer } from './PlayerFeatureRenderer';
import { PlayerMediaRenderer } from './PlayerMediaRenderer';
import { PlayerProductRenderer } from './PlayerProductRenderer';
import { PlayerPageHeaderRenderer } from './PlayerPageHeaderRenderer';
import { PlayerSectionHeaderRenderer } from './PlayerSectionHeaderRenderer';
import { PlayerCardGridRenderer } from './PlayerCardGridRenderer';
import { PlayerComparisonRenderer } from './PlayerComparisonRenderer';
import { PlayerScriptBlockRenderer } from './PlayerScriptBlockRenderer';
import type { CourseElement } from '@/types/course-builder';

interface Props {
  element: CourseElement;
  language: 'en' | 'es';
  isFirstElement?: boolean;
}

export function PlayerElementDispatcher({ element, language, isFirstElement }: Props) {
  switch (element.type) {
    case 'content':
      return <PlayerContentRenderer element={element} language={language} />;
    case 'feature':
      return <PlayerFeatureRenderer element={element} language={language} />;
    case 'media':
      return <PlayerMediaRenderer element={element} language={language} />;
    case 'product_viewer':
      return <PlayerProductRenderer element={element} language={language} />;
    case 'page_header':
      return <PlayerPageHeaderRenderer element={element} language={language} />;
    case 'section_header':
      return <PlayerSectionHeaderRenderer element={element} language={language} isFirst={isFirstElement} />;
    case 'card_grid':
      return <PlayerCardGridRenderer element={element} language={language} />;
    case 'comparison':
      return <PlayerComparisonRenderer element={element} language={language} />;
    case 'script_block':
      return <PlayerScriptBlockRenderer element={element} language={language} />;
    default:
      return null;
  }
}
