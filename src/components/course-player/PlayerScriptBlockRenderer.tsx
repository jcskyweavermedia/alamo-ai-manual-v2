// =============================================================================
// PlayerScriptBlockRenderer — Card with colored header + bilingual script lines.
// =============================================================================

import type { ScriptBlockElement } from '@/types/course-builder';

interface Props {
  element: ScriptBlockElement;
  language: 'en' | 'es';
}

export function PlayerScriptBlockRenderer({ element, language }: Props) {
  const header = language === 'es' ? (element.header_es || element.header_en) : element.header_en;

  return (
    <div className="bg-card rounded-[20px] border border-black/[0.04] shadow-sm overflow-hidden mt-5">
      {/* Header bar */}
      <div className="px-6 py-3 bg-orange-50 border-b border-orange-100 text-[0.7rem] font-bold uppercase tracking-[0.06em] text-orange-600 flex items-center gap-1.5">
        {element.header_icon && <span>{element.header_icon}</span>}
        {header}
      </div>
      {/* Lines */}
      {(element.lines || []).map((line, i) => {
        const enText = line.text_en;
        const esText = line.text_es;

        return (
          <div
            key={i}
            className="px-6 py-4 border-b border-black/[0.04] last:border-b-0"
          >
            {language === 'es' && esText ? (
              <>
                <div className="text-[15px] font-medium text-foreground leading-[1.55]">{esText}</div>
                {enText && (
                  <div className="text-[13px] text-muted-foreground/70 italic leading-[1.55] mt-1">{enText}</div>
                )}
              </>
            ) : (
              <>
                <div className="text-[15px] font-medium text-foreground leading-[1.55]">{enText}</div>
                {esText && (
                  <div className="text-[13px] text-muted-foreground/70 italic leading-[1.55] mt-1">{esText}</div>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
