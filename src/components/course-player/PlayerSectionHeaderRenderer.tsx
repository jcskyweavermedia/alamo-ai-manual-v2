// =============================================================================
// PlayerSectionHeaderRenderer — Sub-section divider with number label,
// light/bold title split, and subtitle. Auto-inserts divider above.
// =============================================================================

import type { SectionHeaderElement } from '@/types/course-builder';

interface Props {
  element: SectionHeaderElement;
  language: 'en' | 'es';
  isFirst?: boolean;
}

export function PlayerSectionHeaderRenderer({ element, language, isFirst }: Props) {
  const rawTitle = language === 'es' ? (element.title_es || element.title_en) : element.title_en;
  const subtitle = language === 'es' ? (element.subtitle_es || element.subtitle_en) : element.subtitle_en;

  // Split title on "|" into light + bold parts
  const titleParts = rawTitle ? rawTitle.split('|') : [''];
  const lightPart = titleParts.length > 1 ? titleParts[0].trim() : null;
  const boldPart = titleParts.length > 1 ? titleParts[1].trim() : titleParts[0].trim();

  return (
    <div
      className={
        isFirst
          ? 'mb-5'
          : 'mt-10 pt-8 border-t border-border mb-5'
      }
    >
      {element.number_label && (
        <div className="text-[0.7rem] font-bold text-orange-500 uppercase tracking-[0.06em] mb-1">
          {element.number_label}
        </div>
      )}
      <h2 className="text-[clamp(1.5rem,4vw,1.75rem)] font-black leading-[1.15] tracking-[-0.02em] text-foreground">
        {lightPart && <span className="block font-light">{lightPart}</span>}
        {boldPart}
      </h2>
      {subtitle && (
        <p className="text-sm text-muted-foreground mt-1 leading-[1.5]">{subtitle}</p>
      )}
    </div>
  );
}
