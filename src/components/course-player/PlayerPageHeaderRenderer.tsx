// =============================================================================
// PlayerPageHeaderRenderer — Course hero block with badge, title, tagline, icon tile.
// Only one per page. AI generates it as the first element.
// =============================================================================

import type { PageHeaderElement } from '@/types/course-builder';

interface Props {
  element: PageHeaderElement;
  language: 'en' | 'es';
}

export function PlayerPageHeaderRenderer({ element, language }: Props) {
  const badge = language === 'es' ? (element.badge_es || element.badge_en) : element.badge_en;
  const rawTitle = language === 'es' ? (element.title_es || element.title_en) : element.title_en;
  const tagline = language === 'es' ? (element.tagline_es || element.tagline_en) : element.tagline_en;
  const iconLabel = language === 'es' ? (element.icon_label_es || element.icon_label_en) : element.icon_label_en;

  // Split title on "|" into light + bold parts
  const titleParts = rawTitle ? rawTitle.split('|') : [''];
  const lightPart = titleParts.length > 1 ? titleParts[0].trim() : null;
  const boldPart = titleParts.length > 1 ? titleParts[1].trim() : titleParts[0].trim();

  return (
    <header className="pt-14 pb-6">
      {badge && (
        <span className="inline-flex items-center gap-1.5 bg-orange-50 text-orange-600 text-xs font-semibold px-3.5 py-1.5 rounded-full mb-5">
          {element.badge_icon && <span>{element.badge_icon}</span>}
          {badge}
        </span>
      )}
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-[clamp(1.85rem,6vw,2.5rem)] leading-[1.15] tracking-tight">
            {lightPart && <span className="block font-light">{lightPart}</span>}
            <span className="block font-black">{boldPart}</span>
          </h1>
          {tagline && (
            <p className="text-[15px] text-muted-foreground mt-2 max-w-[50ch]">{tagline}</p>
          )}
        </div>
        {element.icon && (
          <div className="shrink-0 text-center">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-[28px]"
              style={{ background: 'linear-gradient(135deg, #FFF7ED, #FFEDD5)', boxShadow: '0 2px 8px rgb(249 115 22 / 0.12)' }}
            >
              {element.icon}
            </div>
            {iconLabel && (
              <div className="text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground mt-2">
                {iconLabel}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
