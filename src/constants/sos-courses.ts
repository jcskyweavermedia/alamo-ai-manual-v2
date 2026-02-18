import type { SOSPosition } from '@/hooks/use-sos-scroll-viewer';

export interface SOSCourse {
  slug: string;
  labelEn: string;
  labelEs: string;
  descriptionEn: string;
  descriptionEs: string;
  imagePath: string;
  position: SOSPosition | null;
  isAvailable: boolean;
  level: '101' | '201';
}

export const SOS_COURSES: SOSCourse[] = [
  {
    slug: 'server-101',
    labelEn: 'Server 101',
    labelEs: 'Mesero 101',
    descriptionEn: 'Front-of-house service from greeting to goodbye',
    descriptionEs: 'Servicio en sala desde la bienvenida hasta la despedida',
    imagePath: '/images/courses/server-101.webp',
    position: 'server',
    isAvailable: true,
    level: '101',
  },
  {
    slug: 'bartender-101',
    labelEn: 'Bartender 101',
    labelEs: 'Bartender 101',
    descriptionEn: 'Bar service procedures and drink crafting',
    descriptionEs: 'Procedimientos de barra y preparación de bebidas',
    imagePath: '/images/courses/bartender-101.webp',
    position: 'bartender',
    isAvailable: false,
    level: '101',
  },
  {
    slug: 'busser-101',
    labelEn: 'Busser 101',
    labelEs: 'Busser 101',
    descriptionEn: 'Table maintenance, turnover and team support',
    descriptionEs: 'Mantenimiento de mesa, rotación y apoyo al equipo',
    imagePath: '/images/courses/busser-101.webp',
    position: 'busser',
    isAvailable: false,
    level: '101',
  },
  {
    slug: 'barback-101',
    labelEn: 'Barback 101',
    labelEs: 'Barback 101',
    descriptionEn: 'Bar support, stocking and prep routines',
    descriptionEs: 'Apoyo de barra, reabastecimiento y rutinas de preparación',
    imagePath: '/images/courses/barback-101.webp',
    position: 'barback',
    isAvailable: false,
    level: '101',
  },
  {
    slug: 'wine-201',
    labelEn: 'Wine 201',
    labelEs: 'Vino 201',
    descriptionEn: 'Sommelier-level wine knowledge and service',
    descriptionEs: 'Conocimiento y servicio de vino a nivel sommelier',
    imagePath: '/images/courses/wine-201.webp',
    position: null,
    isAvailable: false,
    level: '201',
  },
  {
    slug: 'food-201',
    labelEn: 'Food 201',
    labelEs: 'Gastronomía 201',
    descriptionEn: 'Advanced plating, ingredients and kitchen coordination',
    descriptionEs: 'Emplatado avanzado, ingredientes y coordinación de cocina',
    imagePath: '/images/courses/food-201.webp',
    position: null,
    isAvailable: false,
    level: '201',
  },
];
