// =============================================================================
// TeacherLevelSelector — 4 radio cards for teacher personality level
// =============================================================================

import { cn } from '@/lib/utils';
import type { TeacherLevel } from '@/types/course-builder';

const STRINGS = {
  en: {
    friendly: 'Friendly',
    friendlyDesc: 'Encouraging and supportive. Great for new team members.',
    professional: 'Professional',
    professionalDesc: 'Clear and balanced. The default teaching style.',
    strict: 'Strict',
    strictDesc: 'Demanding and precise. Expects detailed knowledge.',
    expert: 'Expert',
    expertDesc: 'Deep and nuanced. For advanced training.',
  },
  es: {
    friendly: 'Amigable',
    friendlyDesc: 'Alentador y solidario. Ideal para nuevos miembros del equipo.',
    professional: 'Profesional',
    professionalDesc: 'Claro y equilibrado. El estilo de enseñanza predeterminado.',
    strict: 'Estricto',
    strictDesc: 'Exigente y preciso. Espera conocimiento detallado.',
    expert: 'Experto',
    expertDesc: 'Profundo y matizado. Para formación avanzada.',
  },
};

const LEVELS: Array<{
  value: TeacherLevel;
  emoji: string;
}> = [
  { value: 'friendly', emoji: '😊' },
  { value: 'professional', emoji: '👔' },
  { value: 'strict', emoji: '📋' },
  { value: 'expert', emoji: '🎓' },
];

interface TeacherLevelSelectorProps {
  value: TeacherLevel;
  onChange: (level: TeacherLevel) => void;
  language?: 'en' | 'es';
}

export function TeacherLevelSelector({ value, onChange, language = 'en' }: TeacherLevelSelectorProps) {
  const t = STRINGS[language];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-label={language === 'es' ? 'Estilo de enseñanza' : 'Teaching style'}>
      {LEVELS.map((level) => {
        const isSelected = value === level.value;
        return (
          <div
            key={level.value}
            role="radio"
            aria-checked={isSelected}
            tabIndex={0}
            onClick={() => onChange(level.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChange(level.value); } }}
            className={cn(
              'bg-card rounded-[20px] border shadow-sm p-5 text-left transition-all hover:shadow-md cursor-pointer',
              isSelected
                ? 'ring-2 ring-orange-500 border-orange-200'
                : 'border-black/[0.04] dark:border-white/[0.06]',
            )}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl" role="img">{level.emoji}</span>
              <div className="min-w-0 flex-1">
                <span className="text-sm font-bold text-foreground">{t[level.value]}</span>
                <p className="text-[13px] text-muted-foreground mt-0.5 leading-[1.4]">
                  {t[`${level.value}Desc` as keyof typeof t]}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
