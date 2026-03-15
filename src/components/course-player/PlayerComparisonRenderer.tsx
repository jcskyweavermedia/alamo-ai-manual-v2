// =============================================================================
// PlayerComparisonRenderer — Side-by-side or stacked comparison panels.
// correct_incorrect: 2-col dark/light cards
// miss_fix: vertical stack of paired rows with colored tags
// =============================================================================

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import type { ComparisonElement, ComparisonSide } from '@/types/course-builder';

interface Props {
  element: ComparisonElement;
  language: 'en' | 'es';
}

export function PlayerComparisonRenderer({ element, language }: Props) {
  if (element.variant === 'miss_fix') {
    return <MissFixLayout element={element} language={language} />;
  }
  return <CorrectIncorrectLayout element={element} language={language} />;
}

// --- Correct / Incorrect: side-by-side ---
function CorrectIncorrectLayout({ element, language }: Props) {
  const empty: ComparisonSide = { tag_en: '', tag_es: '', title_en: '', title_es: '', items_en: [], items_es: [] };
  const pos = element.positive || empty;
  const neg = element.negative || empty;
  const posTag = language === 'es' ? (pos.tag_es || pos.tag_en) : pos.tag_en;
  const negTag = language === 'es' ? (neg.tag_es || neg.tag_en) : neg.tag_en;
  const posTitle = language === 'es' ? (pos.title_es || pos.title_en) : pos.title_en;
  const negTitle = language === 'es' ? (neg.title_es || neg.title_en) : neg.title_en;
  const posItems = language === 'es' ? ((pos.items_es || []).length ? pos.items_es : (pos.items_en || [])) : (pos.items_en || []);
  const negItems = language === 'es' ? ((neg.items_es || []).length ? neg.items_es : (neg.items_en || [])) : (neg.items_en || []);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
      {/* Positive (dark) */}
      <div className="bg-foreground text-white rounded-[20px] p-6">
        <span className="inline-block text-[10px] font-bold uppercase tracking-[0.08em] bg-orange-500/20 text-orange-400 px-2.5 py-1 rounded-full mb-2.5">
          {posTag}
        </span>
        {posTitle && <h4 className="text-base font-extrabold mb-2.5 leading-[1.2]">{posTitle}</h4>}
        <ul className="text-[13px] leading-[1.9]">
          {posItems.map((item, i) => (
            <li key={i} className="flex gap-1.5">
              <span className="text-orange-400 font-bold shrink-0">+</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
      {/* Negative (light) */}
      <div className="bg-card rounded-[20px] border border-black/[0.04] shadow-sm p-6">
        <span className="inline-block text-[10px] font-bold uppercase tracking-[0.08em] bg-black/5 text-muted-foreground px-2.5 py-1 rounded-full mb-2.5">
          {negTag}
        </span>
        {negTitle && <h4 className="text-base font-extrabold mb-2.5 leading-[1.2] text-foreground">{negTitle}</h4>}
        <ul className="text-[13px] text-muted-foreground leading-[1.9]">
          {negItems.map((item, i) => (
            <li key={i} className="flex gap-1.5">
              <span className="text-muted-foreground/40 font-bold shrink-0">&minus;</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// --- Miss / Fix: stacked pairs ---
function MissFixLayout({ element, language }: Props) {
  return (
    <div className="flex flex-col gap-2 mt-5">
      {(element.pairs || []).map((pair, i) => (
        <MissFixPair key={i} pair={pair} language={language} index={i} />
      ))}
    </div>
  );
}

function MissFixPair({
  pair,
  language,
  index,
}: {
  pair: ComparisonSide;
  language: 'en' | 'es';
  index: number;
}) {
  // For miss_fix, each pair has items_en[0] as miss text and items_en[1] as fix text
  // Or tag_en contains "Miss" and the pair is {miss row, fix row}
  const missItems = language === 'es' ? ((pair.items_es || []).length ? pair.items_es : (pair.items_en || [])) : (pair.items_en || []);
  const missText = missItems[0] || '';
  const fixText = missItems[1] || '';
  const missLabel = language === 'es' ? 'Error' : 'Miss';
  const fixLabel = language === 'es' ? 'Solución' : 'Fix';

  return (
    <div className="bg-card rounded-[20px] border border-black/[0.04] shadow-sm overflow-hidden">
      <div className="flex items-start gap-3 px-5 py-3.5">
        <span className="text-[0.6rem] font-bold uppercase tracking-[0.06em] bg-red-50 text-red-600 px-2.5 py-0.5 rounded-full shrink-0 mt-0.5">
          {missLabel}
        </span>
        <span className="text-[13px] text-muted-foreground leading-[1.55] [&_p]:m-0 [&_p]:inline">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ p: ({ children }) => <span>{children}</span> }}>{missText}</ReactMarkdown>
        </span>
      </div>
      <div className="flex items-start gap-3 px-5 py-3.5 border-t border-black/[0.04]">
        <span className="text-[0.6rem] font-bold uppercase tracking-[0.06em] bg-green-50 text-green-600 px-2.5 py-0.5 rounded-full shrink-0 mt-0.5">
          {fixLabel}
        </span>
        <span className="text-[13px] text-muted-foreground leading-[1.55] [&_p]:m-0 [&_p]:inline">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ p: ({ children }) => <span>{children}</span> }}>{fixText}</ReactMarkdown>
        </span>
      </div>
    </div>
  );
}
