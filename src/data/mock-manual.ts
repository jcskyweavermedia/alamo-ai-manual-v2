/**
 * Mock Manual Data
 * 
 * Mirrors future Supabase schema from docs/plans/step-2-manual-reader-mvp.md
 * Will be replaced with real database queries in Step 3.
 */

export interface ManualSection {
  id: string;
  parentId: string | null;
  slug: string;
  titleEn: string;
  titleEs: string;
  icon?: string;
  sortOrder: number;
  isCategory: boolean;
}

export interface ManualDocument {
  id: string;
  sectionId: string;
  language: 'en' | 'es';
  markdown: string;
  version: number;
  updatedAt: string;
}

// =============================================================================
// MOCK SECTIONS (Hierarchical Structure)
// =============================================================================

export const mockSections: ManualSection[] = [
  // ─────────────────────────────────────────────────────────────────────────────
  // TOP-LEVEL CATEGORIES
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: 'food-safety',
    parentId: null,
    slug: 'food-safety',
    titleEn: 'Food Safety',
    titleEs: 'Seguridad Alimentaria',
    icon: 'ShieldCheck',
    sortOrder: 1,
    isCategory: true,
  },
  {
    id: 'equipment',
    parentId: null,
    slug: 'equipment',
    titleEn: 'Equipment Operation',
    titleEs: 'Operación de Equipos',
    icon: 'Settings',
    sortOrder: 2,
    isCategory: true,
  },
  {
    id: 'opening-closing',
    parentId: null,
    slug: 'opening-closing',
    titleEn: 'Opening & Closing',
    titleEs: 'Apertura y Cierre',
    icon: 'Clock',
    sortOrder: 3,
    isCategory: true,
  },
  {
    id: 'customer-service',
    parentId: null,
    slug: 'customer-service',
    titleEn: 'Customer Service',
    titleEs: 'Servicio al Cliente',
    icon: 'Users',
    sortOrder: 4,
    isCategory: true,
  },
  {
    id: 'emergency',
    parentId: null,
    slug: 'emergency',
    titleEn: 'Emergency Procedures',
    titleEs: 'Procedimientos de Emergencia',
    icon: 'AlertTriangle',
    sortOrder: 5,
    isCategory: true,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // FOOD SAFETY SECTIONS
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: 'temperature-monitoring',
    parentId: 'food-safety',
    slug: 'temperature-monitoring',
    titleEn: 'Temperature Monitoring',
    titleEs: 'Monitoreo de Temperatura',
    sortOrder: 1,
    isCategory: false,
  },
  {
    id: 'hand-washing',
    parentId: 'food-safety',
    slug: 'hand-washing',
    titleEn: 'Hand Washing Protocol',
    titleEs: 'Protocolo de Lavado de Manos',
    sortOrder: 2,
    isCategory: false,
  },
  {
    id: 'cross-contamination',
    parentId: 'food-safety',
    slug: 'cross-contamination',
    titleEn: 'Cross-Contamination Prevention',
    titleEs: 'Prevención de Contaminación Cruzada',
    sortOrder: 3,
    isCategory: false,
  },
  {
    id: 'allergen-handling',
    parentId: 'food-safety',
    slug: 'allergen-handling',
    titleEn: 'Allergen Handling',
    titleEs: 'Manejo de Alérgenos',
    sortOrder: 4,
    isCategory: false,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // EQUIPMENT SECTIONS
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: 'fryer-operation',
    parentId: 'equipment',
    slug: 'fryer-operation',
    titleEn: 'Fryer Operation',
    titleEs: 'Operación de Freidora',
    sortOrder: 1,
    isCategory: false,
  },
  {
    id: 'grill-procedures',
    parentId: 'equipment',
    slug: 'grill-procedures',
    titleEn: 'Grill Procedures',
    titleEs: 'Procedimientos de Parrilla',
    sortOrder: 2,
    isCategory: false,
  },
  {
    id: 'oven-guidelines',
    parentId: 'equipment',
    slug: 'oven-guidelines',
    titleEn: 'Oven Guidelines',
    titleEs: 'Guías del Horno',
    sortOrder: 3,
    isCategory: false,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // OPENING & CLOSING SECTIONS
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: 'opening-checklist',
    parentId: 'opening-closing',
    slug: 'opening-checklist',
    titleEn: 'Opening Checklist',
    titleEs: 'Lista de Apertura',
    sortOrder: 1,
    isCategory: false,
  },
  {
    id: 'closing-checklist',
    parentId: 'opening-closing',
    slug: 'closing-checklist',
    titleEn: 'Closing Checklist',
    titleEs: 'Lista de Cierre',
    sortOrder: 2,
    isCategory: false,
  },
  {
    id: 'shift-handoff',
    parentId: 'opening-closing',
    slug: 'shift-handoff',
    titleEn: 'Shift Handoff',
    titleEs: 'Entrega de Turno',
    sortOrder: 3,
    isCategory: false,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // CUSTOMER SERVICE SECTIONS
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: 'greeting-guests',
    parentId: 'customer-service',
    slug: 'greeting-guests',
    titleEn: 'Greeting Guests',
    titleEs: 'Recibiendo Invitados',
    sortOrder: 1,
    isCategory: false,
  },
  {
    id: 'handling-complaints',
    parentId: 'customer-service',
    slug: 'handling-complaints',
    titleEn: 'Handling Complaints',
    titleEs: 'Manejo de Quejas',
    sortOrder: 2,
    isCategory: false,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // EMERGENCY SECTIONS
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: 'fire-safety',
    parentId: 'emergency',
    slug: 'fire-safety',
    titleEn: 'Fire Safety',
    titleEs: 'Seguridad contra Incendios',
    sortOrder: 1,
    isCategory: false,
  },
  {
    id: 'medical-emergency',
    parentId: 'emergency',
    slug: 'medical-emergency',
    titleEn: 'Medical Emergency',
    titleEs: 'Emergencia Médica',
    sortOrder: 2,
    isCategory: false,
  },
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get all top-level categories
 */
export function getCategories(): ManualSection[] {
  return mockSections
    .filter((s) => s.parentId === null && s.isCategory)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * Get children of a section
 */
export function getChildren(parentId: string): ManualSection[] {
  return mockSections
    .filter((s) => s.parentId === parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * Get a section by ID
 */
export function getSectionById(id: string): ManualSection | undefined {
  return mockSections.find((s) => s.id === id);
}

/**
 * Get a section by slug
 */
export function getSectionBySlug(slug: string): ManualSection | undefined {
  return mockSections.find((s) => s.slug === slug);
}

/**
 * Get ancestors of a section (for breadcrumbs)
 */
export function getAncestors(id: string): ManualSection[] {
  const ancestors: ManualSection[] = [];
  let current = getSectionById(id);
  
  while (current?.parentId) {
    const parent = getSectionById(current.parentId);
    if (parent) {
      ancestors.unshift(parent);
      current = parent;
    } else {
      break;
    }
  }
  
  return ancestors;
}

/**
 * Get sibling sections (for "Related Sections")
 */
export function getSiblings(id: string): ManualSection[] {
  const section = getSectionById(id);
  if (!section) return [];
  
  return mockSections
    .filter((s) => s.parentId === section.parentId && s.id !== id)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * Build full section tree
 */
export interface SectionTreeNode extends ManualSection {
  children: SectionTreeNode[];
}

export function buildSectionTree(): SectionTreeNode[] {
  const buildNode = (section: ManualSection): SectionTreeNode => ({
    ...section,
    children: getChildren(section.id).map(buildNode),
  });
  
  return getCategories().map(buildNode);
}
