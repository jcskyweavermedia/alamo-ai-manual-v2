import { BookOpen, UtensilsCrossed, Shield, GraduationCap, type LucideIcon } from 'lucide-react';

export interface SOSChapter {
  id: string;
  labelEn: string;
  labelEs: string;
  icon: LucideIcon;
  color: 'primary' | 'muted';
}

export const SOS_CHAPTERS: SOSChapter[] = [
  { id: 'foundations',   labelEn: 'Foundations',             labelEs: 'Fundamentos',             icon: BookOpen,        color: 'primary' },
  { id: 'service-flow', labelEn: 'Steps of Service',        labelEs: 'Pasos de Servicio',        icon: UtensilsCrossed, color: 'primary' },
  { id: 'standards',    labelEn: 'Professional Standards',  labelEs: 'Estándares Profesionales', icon: Shield,          color: 'primary' },
  { id: 'reference',    labelEn: 'Reference & Review',      labelEs: 'Referencia y Repaso',      icon: GraduationCap,   color: 'muted'   },
];

/** Map chapter id → metadata for quick lookup */
export const SOS_CHAPTER_MAP = Object.fromEntries(
  SOS_CHAPTERS.map(c => [c.id, c])
) as Record<string, SOSChapter>;
