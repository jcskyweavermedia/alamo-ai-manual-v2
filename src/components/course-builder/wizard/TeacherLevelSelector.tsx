// =============================================================================
// TeacherLevelSelector — 4 radio cards for teacher personality level
// =============================================================================

import { Smile, Briefcase, ShieldCheck, GraduationCap } from 'lucide-react';
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
    professionalDesc: 'Claro y equilibrado. El estilo de ensenanza predeterminado.',
    strict: 'Estricto',
    strictDesc: 'Exigente y preciso. Espera conocimiento detallado.',
    expert: 'Experto',
    expertDesc: 'Profundo y matizado. Para formacion avanzada.',
  },
};

const LEVELS: Array<{
  value: TeacherLevel;
  icon: typeof Smile;
  color: string;
}> = [
  { value: 'friendly', icon: Smile, color: 'text-green-600 bg-green-50 dark:bg-green-950/30' },
  { value: 'professional', icon: Briefcase, color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/30' },
  { value: 'strict', icon: ShieldCheck, color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/30' },
  { value: 'expert', icon: GraduationCap, color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/30' },
];

interface TeacherLevelSelectorProps {
  value: TeacherLevel;
  onChange: (level: TeacherLevel) => void;
  language?: 'en' | 'es';
}

export function TeacherLevelSelector({ value, onChange, language = 'en' }: TeacherLevelSelectorProps) {
  const t = STRINGS[language];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {LEVELS.map((level) => {
        const Icon = level.icon;
        const isSelected = value === level.value;
        return (
          <button
            key={level.value}
            type="button"
            onClick={() => onChange(level.value)}
            className={cn(
              'flex items-start gap-3 p-3 rounded-xl border text-left transition-all',
              isSelected
                ? 'ring-2 ring-primary border-primary bg-primary/5'
                : 'border-border hover:border-primary/40 hover:shadow-sm',
            )}
          >
            <div className={cn('flex items-center justify-center h-9 w-9 rounded-lg shrink-0', level.color)}>
              <Icon className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{t[level.value]}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t[`${level.value}Desc` as keyof typeof t]}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
