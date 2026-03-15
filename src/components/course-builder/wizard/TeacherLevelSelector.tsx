// =============================================================================
// TeacherLevelSelector — 4 radio cards for audience experience level
// =============================================================================

import { cn } from '@/lib/utils';
import type { TeacherLevel } from '@/types/course-builder';

const STRINGS = {
  en: {
    new_hire: 'New Hire',
    new_hireDesc: 'First 90 days on the job. The AI will explain every concept from scratch — no jargon, no shortcuts. Uses analogies, real examples, and a friendly encouraging tone. Perfect for onboarding.',
    developing: 'Developing',
    developingDesc: '3–12 months. Knows the basics but still building confidence. The AI reinforces fundamentals, introduces best practices, and uses a clear, structured voice. The default for most training.',
    experienced: 'Experienced',
    experiencedDesc: '1–2 years. Ready for the "why" behind the rules. The AI skips the basics, dives into edge cases, advanced pairings, and guest scenarios. Direct and efficient.',
    veteran: 'Veteran',
    veteranDesc: '2+ years. Seasoned pros who want depth, not hand-holding. The AI uses insider language, covers leadership angles, and assumes mastery of fundamentals. Concise and high-level.',
  },
  es: {
    new_hire: 'Nuevo Ingreso',
    new_hireDesc: 'Primeros 90 días en el trabajo. La IA explicará cada concepto desde cero — sin jerga, sin atajos. Usa analogías, ejemplos reales y un tono amigable. Ideal para onboarding.',
    developing: 'En Desarrollo',
    developingDesc: '3–12 meses. Conoce lo básico pero aún gana confianza. La IA refuerza fundamentos, introduce buenas prácticas y usa una voz clara y estructurada. El predeterminado para la mayoría.',
    experienced: 'Experimentado',
    experiencedDesc: '1–2 años. Listo para el "por qué" detrás de las reglas. La IA omite lo básico, profundiza en casos especiales, maridajes avanzados y escenarios con invitados. Directo y eficiente.',
    veteran: 'Veterano',
    veteranDesc: '2+ años. Profesionales que quieren profundidad, no guía paso a paso. La IA usa lenguaje de la industria, cubre liderazgo y asume dominio de los fundamentos. Conciso y de alto nivel.',
  },
};

const LEVELS: Array<{
  value: TeacherLevel;
  emoji: string;
}> = [
  { value: 'new_hire', emoji: '🌱' },
  { value: 'developing', emoji: '📈' },
  { value: 'experienced', emoji: '⭐' },
  { value: 'veteran', emoji: '🏆' },
];

interface TeacherLevelSelectorProps {
  value: TeacherLevel;
  onChange: (level: TeacherLevel) => void;
  language?: 'en' | 'es';
}

export function TeacherLevelSelector({ value, onChange, language = 'en' }: TeacherLevelSelectorProps) {
  const t = STRINGS[language];

  const hint = language === 'es'
    ? 'La IA adaptará el tono, la profundidad y el vocabulario del curso según el nivel que elijas.'
    : 'The AI will adapt the course tone, depth, and vocabulary based on the level you choose.';

  return (
    <div className="space-y-3">
      <p className="text-[13px] text-muted-foreground text-center leading-[1.5]">{hint}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-label={language === 'es' ? 'Nivel de audiencia' : 'Audience level'}>
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
            <div className="flex items-start gap-3">
              <span className="text-2xl mt-0.5" role="img">{level.emoji}</span>
              <div className="min-w-0 flex-1">
                <span className="text-sm font-bold text-foreground">{t[level.value]}</span>
                <p className="text-[12px] text-muted-foreground mt-1 leading-[1.5]">
                  {t[`${level.value}Desc` as keyof typeof t]}
                </p>
              </div>
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
}
