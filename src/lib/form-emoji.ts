// =============================================================================
// Form Emoji Auto-Assignment
// Analyzes slug + title to return a contextually appropriate emoji.
// Used by FormCard and Form Builder preview.
// =============================================================================

const FORM_EMOJI_RULES: { keywords: string[]; emoji: string }[] = [
  // Disciplinary / HR
  { keywords: ['write-up', 'writeup', 'write_up', 'disciplinary', 'corrective', 'warning'],  emoji: '📝' },
  { keywords: ['termination', 'terminate', 'separation', 'dismissal'],                        emoji: '🚫' },

  // Injury / Medical
  { keywords: ['injury', 'injuries', 'hurt', 'wound', 'medical', 'first-aid', 'first_aid'],  emoji: '🩹' },
  { keywords: ['incident', 'accident', 'slip', 'fall', 'burn'],                                emoji: '⚠️' },

  // Safety / Compliance
  { keywords: ['safety', 'hazard', 'osha', 'compliance'],                                      emoji: '🛡️' },
  { keywords: ['inspection', 'audit', 'health-inspection', 'walkthrough'],                     emoji: '🔍' },
  { keywords: ['fire', 'extinguisher', 'evacuation', 'emergency'],                             emoji: '🔥' },

  // Checklists / Opening-Closing
  { keywords: ['checklist', 'check-list', 'check_list'],                                       emoji: '✅' },
  { keywords: ['opening', 'open-shift', 'pre-shift', 'preshift'],                             emoji: '🔓' },
  { keywords: ['closing', 'close-shift', 'end-of-day', 'eod'],                                emoji: '🔒' },

  // Inventory / Receiving
  { keywords: ['inventory', 'stock', 'count', 'par-level'],                                    emoji: '📦' },
  { keywords: ['receiving', 'delivery', 'shipment', 'vendor', 'supplier'],                     emoji: '🚚' },
  { keywords: ['waste', 'spoilage', 'discard', 'loss'],                                        emoji: '🗑️' },

  // Schedule / Time
  { keywords: ['schedule', 'scheduling', 'shift', 'roster', 'availability'],                   emoji: '📅' },
  { keywords: ['time-off', 'time_off', 'pto', 'vacation', 'leave', 'absence'],                emoji: '🏖️' },

  // Training
  { keywords: ['training', 'onboarding', 'orientation', 'certification', 'quiz'],              emoji: '🎓' },

  // Complaints / Guest
  { keywords: ['complaint', 'guest-complaint', 'feedback', 'customer'],                        emoji: '💬' },
  { keywords: ['comp', 'comped', 'void', 'refund', 'discount'],                               emoji: '💳' },

  // Maintenance / Equipment
  { keywords: ['maintenance', 'repair', 'equipment', 'broken', 'work-order'],                 emoji: '🔧' },
  { keywords: ['cleaning', 'sanitiz', 'deep-clean', 'janitorial'],                            emoji: '🧹' },
  { keywords: ['temperature', 'temp-log', 'cooler', 'freezer'],                               emoji: '🌡️' },

  // Cash / Financial
  { keywords: ['cash', 'register', 'drawer', 'deposit', 'tip', 'tipout'],                     emoji: '💰' },
  { keywords: ['sales', 'revenue', 'daily-report'],                                            emoji: '📊' },

  // Contact / Communication
  { keywords: ['contact', 'directory', 'phone'],                                               emoji: '📇' },
  { keywords: ['meeting', 'minutes', 'huddle'],                                               emoji: '🤝' },

  // Menu / Recipe
  { keywords: ['menu', 'special', 'daily-special', '86'],                                     emoji: '🍽️' },
  { keywords: ['recipe', 'prep', 'batch'],                                                     emoji: '👨‍🍳' },

  // Catering / Events
  { keywords: ['catering', 'event', 'banquet', 'reservation', 'private-dining'],              emoji: '🎉' },

  // General
  { keywords: ['application', 'apply', 'hire', 'hiring'],                                     emoji: '📋' },
  { keywords: ['request', 'requisition'],                                                       emoji: '📨' },
  { keywords: ['report', 'log', 'record'],                                                     emoji: '📄' },
];

const FALLBACK_EMOJI = '📋';

/**
 * Determines the best emoji for a form template based on its slug and title.
 * Priority: slug match > title match > fallback.
 */
export function getFormEmoji(slug: string, title: string): string {
  const slugLower = slug.toLowerCase();
  const titleLower = title.toLowerCase();

  // Check slug first (canonical identifier)
  for (const rule of FORM_EMOJI_RULES) {
    if (rule.keywords.some((kw) => slugLower.includes(kw))) {
      return rule.emoji;
    }
  }

  // Fall back to title matching
  for (const rule of FORM_EMOJI_RULES) {
    if (rule.keywords.some((kw) => titleLower.includes(kw))) {
      return rule.emoji;
    }
  }

  return FALLBACK_EMOJI;
}
