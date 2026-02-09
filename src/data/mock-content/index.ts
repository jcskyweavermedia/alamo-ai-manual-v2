/**
 * Mock Content Index
 * 
 * Aggregates all Markdown content for the mock data layer.
 * In production, this will be replaced with Supabase queries.
 */

// Import all markdown files as raw strings
import temperatureMonitoringEn from './temperature-monitoring.en.md?raw';
import temperatureMonitoringEs from './temperature-monitoring.es.md?raw';
import handWashingEn from './hand-washing.en.md?raw';
import handWashingEs from './hand-washing.es.md?raw';
import crossContaminationEn from './cross-contamination.en.md?raw';
import crossContaminationEs from './cross-contamination.es.md?raw';
import fryerOperationEn from './fryer-operation.en.md?raw';
import fryerOperationEs from './fryer-operation.es.md?raw';
import openingChecklistEn from './opening-checklist.en.md?raw';
import openingChecklistEs from './opening-checklist.es.md?raw';

import type { ManualDocument } from '../mock-manual';

// =============================================================================
// CONTENT REGISTRY
// =============================================================================

type ContentMap = Record<string, { en: string; es: string }>;

const contentMap: ContentMap = {
  'temperature-monitoring': {
    en: temperatureMonitoringEn,
    es: temperatureMonitoringEs,
  },
  'hand-washing': {
    en: handWashingEn,
    es: handWashingEs,
  },
  'cross-contamination': {
    en: crossContaminationEn,
    es: crossContaminationEs,
  },
  'fryer-operation': {
    en: fryerOperationEn,
    es: fryerOperationEs,
  },
  'opening-checklist': {
    en: openingChecklistEn,
    es: openingChecklistEs,
  },
};

// =============================================================================
// DOCUMENT RETRIEVAL
// =============================================================================

/**
 * Get document content by section ID and language
 */
export function getDocumentContent(
  sectionId: string,
  language: 'en' | 'es'
): ManualDocument | null {
  const content = contentMap[sectionId];
  
  if (!content) {
    return null;
  }

  // Fall back to English if Spanish not available
  const markdown = content[language] || content.en;
  
  if (!markdown) {
    return null;
  }

  return {
    id: `${sectionId}-${language}`,
    sectionId,
    language,
    markdown,
    version: 1,
    updatedAt: '2024-01-15T00:00:00Z',
  };
}

/**
 * Check if a section has content available
 */
export function hasContent(sectionId: string): boolean {
  return sectionId in contentMap;
}

/**
 * Get all available section IDs with content
 */
export function getAvailableContentIds(): string[] {
  return Object.keys(contentMap);
}

/**
 * Check if Spanish translation is available
 */
export function hasSpanishTranslation(sectionId: string): boolean {
  const content = contentMap[sectionId];
  return !!content?.es;
}
