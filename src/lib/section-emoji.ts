// =============================================================================
// Section Emoji — Auto-assigns contextual emojis to form section headers
// Keyword-based matching against section key and label (case-insensitive)
// =============================================================================

/**
 * Emoji rule: array of keywords to match against, plus the emoji + background colors.
 * Rules are evaluated in order — first match wins.
 */
interface SectionEmojiRule {
  keywords: string[];
  emoji: string;
  bg: string;
  darkBg: string;
}

/**
 * 20 categories covering common restaurant operations form sections.
 * Ordered from most specific to most generic to avoid false positives.
 */
const SECTION_EMOJI_RULES: SectionEmojiRule[] = [
  // --- Signature / Acknowledgment ---
  {
    keywords: ['signature', 'acknowledge', 'acknowledgment', 'acknowledgement', 'sign-off', 'signoff', 'firma', 'reconocimiento'],
    emoji: '\u270D\uFE0F',  // ✍️
    bg: 'bg-violet-100',
    darkBg: 'dark:bg-violet-900/30',
  },
  // --- Disciplinary / Write-up ---
  {
    keywords: ['write-up', 'writeup', 'write_up', 'disciplin', 'violation', 'infraction', 'corrective', 'sancion', 'disciplinari'],
    emoji: '\uD83D\uDCDD',  // 📝
    bg: 'bg-red-50',
    darkBg: 'dark:bg-red-900/20',
  },
  // --- Incident / Accident ---
  {
    keywords: ['incident', 'accident', 'injury', 'hazard', 'emergency', 'incidente', 'accidente', 'lesion'],
    emoji: '\u26A0\uFE0F',  // ⚠️
    bg: 'bg-amber-100',
    darkBg: 'dark:bg-amber-900/30',
  },
  // --- Safety / Compliance ---
  {
    keywords: ['safety', 'compliance', 'inspection', 'audit', 'haccp', 'health', 'seguridad', 'cumplimiento', 'inspeccion'],
    emoji: '\uD83D\uDEE1\uFE0F',  // 🛡️
    bg: 'bg-emerald-100',
    darkBg: 'dark:bg-emerald-900/30',
  },
  // --- Training / Certification ---
  {
    keywords: ['training', 'certification', 'certif', 'course', 'learning', 'onboard', 'capacitacion', 'certificacion', 'curso'],
    emoji: '\uD83C\uDF93',  // 🎓
    bg: 'bg-indigo-100',
    darkBg: 'dark:bg-indigo-900/30',
  },
  // --- Schedule / Time / Shift ---
  {
    keywords: ['schedule', 'shift', 'time', 'clock', 'hours', 'attendance', 'horario', 'turno', 'asistencia'],
    emoji: '\uD83D\uDCC5',  // 📅
    bg: 'bg-purple-100',
    darkBg: 'dark:bg-purple-900/30',
  },
  // --- Inventory / Stock ---
  {
    keywords: ['inventory', 'stock', 'supply', 'supplies', 'order', 'receiving', 'inventario', 'existencia', 'suministro'],
    emoji: '\uD83D\uDCE6',  // 📦
    bg: 'bg-orange-100',
    darkBg: 'dark:bg-orange-900/30',
  },
  // --- Equipment / Maintenance ---
  {
    keywords: ['equipment', 'maintenance', 'repair', 'machine', 'tool', 'equipo', 'mantenimiento', 'reparacion'],
    emoji: '\uD83D\uDD27',  // 🔧
    bg: 'bg-gray-100',
    darkBg: 'dark:bg-gray-800',
  },
  // --- Financial / Payment ---
  {
    keywords: ['financial', 'payment', 'cost', 'expense', 'budget', 'tip', 'cash', 'financiero', 'pago', 'costo', 'gasto'],
    emoji: '\uD83D\uDCB0',  // 💰
    bg: 'bg-green-100',
    darkBg: 'dark:bg-green-900/30',
  },
  // --- Contact info ---
  {
    keywords: ['contact', 'phone', 'address', 'email', 'contacto', 'telefono', 'direccion', 'correo'],
    emoji: '\uD83D\uDCC7',  // 📇
    bg: 'bg-cyan-100',
    darkBg: 'dark:bg-cyan-900/30',
  },
  // --- Attachments / Documents ---
  {
    keywords: ['attachment', 'document', 'upload', 'file', 'photo', 'evidence', 'adjunto', 'documento', 'archivo', 'foto', 'evidencia'],
    emoji: '\uD83D\uDCCE',  // 📎
    bg: 'bg-slate-100',
    darkBg: 'dark:bg-slate-800',
  },
  // --- Notes / Comments ---
  {
    keywords: ['note', 'comment', 'remark', 'feedback', 'observation', 'nota', 'comentario', 'observacion'],
    emoji: '\uD83D\uDCAC',  // 💬
    bg: 'bg-sky-100',
    darkBg: 'dark:bg-sky-900/30',
  },
  // --- Food / Menu / Recipe ---
  {
    keywords: ['food', 'menu', 'recipe', 'dish', 'ingredient', 'prep', 'kitchen', 'comida', 'receta', 'plato', 'ingrediente', 'cocina'],
    emoji: '\uD83C\uDF7D\uFE0F',  // 🍽️
    bg: 'bg-rose-100',
    darkBg: 'dark:bg-rose-900/30',
  },
  // --- Beverage / Bar ---
  {
    keywords: ['beverage', 'drink', 'bar', 'wine', 'cocktail', 'beer', 'liquor', 'bebida', 'vino', 'cerveza'],
    emoji: '\uD83C\uDF78',  // 🍸
    bg: 'bg-fuchsia-100',
    darkBg: 'dark:bg-fuchsia-900/30',
  },
  // --- Guest / Customer ---
  {
    keywords: ['guest', 'customer', 'patron', 'complaint', 'feedback', 'satisfaction', 'cliente', 'invitado', 'queja', 'satisfaccion'],
    emoji: '\u2B50',  // ⭐
    bg: 'bg-yellow-100',
    darkBg: 'dark:bg-yellow-900/30',
  },
  // --- Cleaning / Sanitation ---
  {
    keywords: ['clean', 'sanit', 'hygiene', 'wash', 'disinfect', 'limpieza', 'higiene', 'desinfect'],
    emoji: '\u2728',  // ✨
    bg: 'bg-teal-100',
    darkBg: 'dark:bg-teal-900/30',
  },
  // --- Performance / Review ---
  {
    keywords: ['performance', 'review', 'evaluation', 'assess', 'rating', 'goal', 'desempeno', 'evaluacion', 'calificacion'],
    emoji: '\uD83D\uDCCA',  // 📊
    bg: 'bg-blue-100',
    darkBg: 'dark:bg-blue-900/30',
  },
  // --- Approval / Authorization ---
  {
    keywords: ['approval', 'authorize', 'authoriz', 'manager', 'supervisor', 'aprobacion', 'autorizar', 'gerente', 'supervisor'],
    emoji: '\u2705',  // ✅
    bg: 'bg-emerald-50',
    darkBg: 'dark:bg-emerald-900/20',
  },
  // --- Employee / Personal info (broad — keep near end) ---
  {
    keywords: ['employee', 'staff', 'personal', 'position', 'role', 'department', 'hire', 'empleado', 'personal', 'puesto', 'departamento'],
    emoji: '\uD83D\uDC64',  // 👤
    bg: 'bg-blue-100',
    darkBg: 'dark:bg-blue-900/30',
  },
  // --- Details / General info (broadest — last) ---
  {
    keywords: ['detail', 'info', 'general', 'overview', 'summary', 'description', 'detalle', 'informacion', 'resumen', 'descripcion'],
    emoji: '\uD83D\uDCCB',  // 📋
    bg: 'bg-slate-100',
    darkBg: 'dark:bg-slate-800',
  },
];

/** Fallback when no keyword matches */
const DEFAULT_SECTION_EMOJI = {
  emoji: '\uD83D\uDCC4',  // 📄
  bg: 'bg-gray-100',
  darkBg: 'dark:bg-gray-800',
};

export interface SectionEmojiResult {
  emoji: string;
  bg: string;
  darkBg: string;
}

/**
 * Auto-assign a contextual emoji to a form section header.
 *
 * Matches the section's key and label (lowercased) against keyword rules.
 * First match wins. Returns a fallback if nothing matches.
 *
 * @param sectionKey - The header field key (e.g. "employee_info_header")
 * @param sectionLabel - The display label (e.g. "Employee Information")
 */
export function getSectionEmoji(
  sectionKey: string,
  sectionLabel: string,
): SectionEmojiResult {
  const haystack = `${sectionKey} ${sectionLabel}`.toLowerCase();

  for (const rule of SECTION_EMOJI_RULES) {
    for (const keyword of rule.keywords) {
      if (haystack.includes(keyword)) {
        return { emoji: rule.emoji, bg: rule.bg, darkBg: rule.darkBg };
      }
    }
  }

  return { ...DEFAULT_SECTION_EMOJI };
}
