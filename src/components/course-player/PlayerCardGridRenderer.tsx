// =============================================================================
// PlayerCardGridRenderer — Multi-card grid with 3 variants:
// icon_tile, menu_item, bilingual.
// =============================================================================

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import { ICON_BG_GRADIENTS } from '@/lib/course-builder/builder-utils';
import { courseMdComponents } from '@/lib/chat-markdown';
import type { CardGridElement, CardGridItem } from '@/types/course-builder';

interface Props {
  element: CardGridElement;
  language: 'en' | 'es';
}

export function PlayerCardGridRenderer({ element, language }: Props) {
  const cols = element.columns === 2
    ? '@sm:grid-cols-2'
    : '@sm:grid-cols-2 @lg:grid-cols-3';

  return (
    <div className="@container mt-5">
      <div className={cn('grid grid-cols-1 gap-3', cols)}>
        {(element.cards || []).map((card, i) => (
          <CardItem
            key={i}
            card={card}
            variant={element.variant}
            language={language}
          />
        ))}
      </div>
    </div>
  );
}

function CardItem({
  card,
  variant,
  language,
}: {
  card: CardGridItem;
  variant: CardGridElement['variant'];
  language: 'en' | 'es';
}) {
  const title = language === 'es' ? (card.title_es || card.title_en) : card.title_en;
  const body = language === 'es' ? (card.body_es || card.body_en) : card.body_en;
  const gradientBg = ICON_BG_GRADIENTS[card.icon_bg || 'orange'] || ICON_BG_GRADIENTS.orange;

  if (variant === 'bilingual') {
    return (
      <div className="bg-card rounded-[20px] border border-black/[0.04] shadow-sm p-5">
        <div className="text-[0.6rem] font-bold uppercase tracking-[0.08em] text-muted-foreground/60 mb-1.5">
          {language === 'es' ? 'Español' : 'English'}
        </div>
        <div className="text-[13px] text-muted-foreground leading-[1.5] [&_p]:m-0">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={courseMdComponents}>{body}</ReactMarkdown>
        </div>
      </div>
    );
  }

  if (variant === 'menu_item') {
    return (
      <div className="bg-card rounded-[20px] border border-black/[0.04] shadow-sm p-5 relative overflow-hidden">
        {/* Orange top bar */}
        <div
          className="absolute top-0 left-0 right-0 h-[3px]"
          style={{ background: 'linear-gradient(90deg, #F97316, #FDBA74)', borderRadius: '20px 20px 0 0' }}
        />
        {card.icon && <span className="text-[2rem] mb-2.5 block">{card.icon}</span>}
        <h4 className="text-[15px] font-bold text-foreground mb-1 leading-[1.3]">{title}</h4>
        <div className="text-[13px] text-muted-foreground leading-[1.5] [&_p]:m-0">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={courseMdComponents}>{body}</ReactMarkdown>
        </div>
      </div>
    );
  }

  // icon_tile (default)
  return (
    <div className="bg-card rounded-[20px] border border-black/[0.04] shadow-sm p-5">
      {card.icon && (
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center text-[22px] mb-3"
          style={{ background: gradientBg }}
        >
          {card.icon}
        </div>
      )}
      <h4 className="text-sm font-bold text-foreground mb-1 leading-[1.3]">{title}</h4>
      <div className="text-[13px] text-muted-foreground leading-[1.5] [&_p]:m-0">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={courseMdComponents}>{body}</ReactMarkdown>
      </div>
    </div>
  );
}
