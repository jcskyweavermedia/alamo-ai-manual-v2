// =============================================================================
// AssignmentPicker — Target selector stub (actual assignment is Phase 8)
// All Staff is active; By Role and Individual are disabled "Coming Soon".
// =============================================================================

import { Users, UserCog, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { AssignmentTarget } from '@/types/course-builder';

const STRINGS = {
  en: {
    all_staff: 'All Staff',
    all_staffDesc: 'Assign this course to every team member.',
    by_role: 'By Role',
    by_roleDesc: 'Assign to specific roles (e.g., servers, bartenders).',
    individual: 'Individual',
    individualDesc: 'Assign to specific team members.',
    comingSoon: 'Coming Soon',
  },
  es: {
    all_staff: 'Todo el Personal',
    all_staffDesc: 'Asignar este curso a cada miembro del equipo.',
    by_role: 'Por Rol',
    by_roleDesc: 'Asignar a roles especificos (ej., meseros, bartenders).',
    individual: 'Individual',
    individualDesc: 'Asignar a miembros especificos del equipo.',
    comingSoon: 'Proximamente',
  },
};

const MODES: Array<{
  value: AssignmentTarget['mode'];
  icon: typeof Users;
  enabled: boolean;
}> = [
  { value: 'all_staff', icon: Users, enabled: true },
  { value: 'by_role', icon: UserCog, enabled: false },
  { value: 'individual', icon: User, enabled: false },
];

interface AssignmentPickerProps {
  value: AssignmentTarget;
  onChange: (target: AssignmentTarget) => void;
  language?: 'en' | 'es';
}

export function AssignmentPicker({ value, onChange, language = 'en' }: AssignmentPickerProps) {
  const t = STRINGS[language];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {MODES.map((mode) => {
        const Icon = mode.icon;
        const isSelected = value.mode === mode.value;
        return (
          <button
            key={mode.value}
            type="button"
            disabled={!mode.enabled}
            onClick={() => mode.enabled && onChange({ mode: mode.value })}
            className={cn(
              'relative flex flex-col items-center gap-2 p-4 rounded-xl border text-center transition-all',
              !mode.enabled && 'opacity-50 cursor-not-allowed',
              isSelected
                ? 'ring-2 ring-primary border-primary bg-primary/5'
                : mode.enabled
                  ? 'border-border hover:border-primary/40 hover:shadow-sm'
                  : 'border-border',
            )}
          >
            <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-muted text-muted-foreground">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center justify-center gap-1.5">
                <p className="text-sm font-medium">{t[mode.value]}</p>
                {!mode.enabled && (
                  <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4">
                    {t.comingSoon}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {t[`${mode.value}Desc` as keyof typeof t]}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
