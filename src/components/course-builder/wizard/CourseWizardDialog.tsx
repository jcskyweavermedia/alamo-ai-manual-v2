// =============================================================================
// CourseWizardDialog — Full-screen dialog showing 6 wizard type cards
// Only Menu Rollout is active; others show "Coming Soon".
// =============================================================================

import {
  UtensilsCrossed,
  ClipboardList,
  Footprints,
  ChefHat,
  Wrench,
  FileText,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { CourseType } from '@/types/course-builder';

const STRINGS = {
  en: {
    title: 'Choose Course Type',
    description: 'Select a template to get started with your new course.',
    comingSoon: 'Coming Soon',
    cancel: 'Cancel',
    menu_rollout: 'Menu Rollout',
    menu_rolloutDesc: 'Train your team on new menu items, specials, or seasonal changes.',
    sop_review: 'SOP Review',
    sop_reviewDesc: 'Standard operating procedures refresher or update training.',
    steps_of_service: 'Steps of Service',
    steps_of_serviceDesc: 'Guest experience training from greeting to farewell.',
    line_cook: 'Line Cook',
    line_cookDesc: 'Kitchen station training with prep recipes and plate specs.',
    custom: 'Custom Course',
    customDesc: 'Build a fully custom course from scratch with AI assistance.',
    blank: 'Start Blank',
    blankDesc: 'Empty canvas. Add your own sections and elements manually.',
  },
  es: {
    title: 'Elegir Tipo de Curso',
    description: 'Selecciona una plantilla para comenzar con tu nuevo curso.',
    comingSoon: 'Proximamente',
    cancel: 'Cancelar',
    menu_rollout: 'Lanzamiento de Menu',
    menu_rolloutDesc: 'Entrena a tu equipo en nuevos platos, especiales o cambios de temporada.',
    sop_review: 'Revision de SOPs',
    sop_reviewDesc: 'Capacitacion de actualizacion de procedimientos operativos estandar.',
    steps_of_service: 'Pasos de Servicio',
    steps_of_serviceDesc: 'Capacitacion en experiencia del huesped desde el saludo hasta la despedida.',
    line_cook: 'Cocinero de Linea',
    line_cookDesc: 'Entrenamiento de estacion de cocina con recetas de preparacion.',
    custom: 'Curso Personalizado',
    customDesc: 'Construye un curso completamente personalizado con asistencia de IA.',
    blank: 'Empezar en Blanco',
    blankDesc: 'Lienzo vacio. Agrega tus propias secciones y elementos manualmente.',
  },
};

const WIZARD_TYPES: Array<{
  type: CourseType;
  icon: typeof UtensilsCrossed;
  enabled: boolean;
  color: string;
}> = [
  { type: 'menu_rollout', icon: UtensilsCrossed, enabled: true, color: 'text-orange-600 bg-orange-50 dark:bg-orange-950/30' },
  { type: 'sop_review', icon: ClipboardList, enabled: false, color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/30' },
  { type: 'steps_of_service', icon: Footprints, enabled: false, color: 'text-green-600 bg-green-50 dark:bg-green-950/30' },
  { type: 'line_cook', icon: ChefHat, enabled: false, color: 'text-red-600 bg-red-50 dark:bg-red-950/30' },
  { type: 'custom', icon: Wrench, enabled: false, color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/30' },
  { type: 'blank', icon: FileText, enabled: false, color: 'text-gray-600 bg-gray-50 dark:bg-gray-950/30' },
];

interface CourseWizardDialogProps {
  open: boolean;
  onClose: () => void;
  onSelectType: (type: CourseType) => void;
  language?: 'en' | 'es';
}

export function CourseWizardDialog({ open, onClose, onSelectType, language = 'en' }: CourseWizardDialogProps) {
  const t = STRINGS[language];

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl">{t.title}</DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 -mr-2"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">{t.description}</p>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          {WIZARD_TYPES.map((wt) => {
            const Icon = wt.icon;
            return (
              <button
                key={wt.type}
                type="button"
                disabled={!wt.enabled}
                onClick={() => wt.enabled && onSelectType(wt.type)}
                className={cn(
                  'relative flex items-start gap-3 p-4 rounded-xl border text-left transition-all',
                  !wt.enabled && 'opacity-50 cursor-not-allowed',
                  wt.enabled && 'hover:border-primary/40 hover:shadow-md cursor-pointer',
                  'border-border',
                )}
              >
                <div className={cn('flex items-center justify-center h-11 w-11 rounded-xl shrink-0', wt.color)}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">{t[wt.type]}</p>
                    {!wt.enabled && (
                      <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4">
                        {t.comingSoon}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {t[`${wt.type}Desc` as keyof typeof t]}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            {t.cancel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
