// =============================================================================
// Icon Resolution — shared emoji icon system for form builder
// =============================================================================

export interface EmojiOption {
  emoji: string;
  label: string;
}

export const FORM_EMOJI_OPTIONS: EmojiOption[] = [
  // Documents
  { emoji: '\u{1F4CB}', label: 'Clipboard' },
  { emoji: '\u{1F4C4}', label: 'Document' },
  { emoji: '\u{1F4DD}', label: 'Memo' },
  { emoji: '\u{1F4C1}', label: 'Folder' },
  { emoji: '\u{1F4E6}', label: 'Package' },
  // Safety & alerts
  { emoji: '\u26A0\uFE0F', label: 'Warning' },
  { emoji: '\u{1F6E1}\uFE0F', label: 'Shield' },
  { emoji: '\u2705', label: 'Checkmark' },
  { emoji: '\u{1F6A8}', label: 'Emergency' },
  // Medical & health
  { emoji: '\u{1FA7A}', label: 'Stethoscope' },
  { emoji: '\u{1F9EA}', label: 'Test tube' },
  { emoji: '\u2764\uFE0F', label: 'Heart' },
  { emoji: '\u{1F321}\uFE0F', label: 'Thermometer' },
  // Food & restaurant
  { emoji: '\u{1F374}', label: 'Utensils' },
  { emoji: '\u{1F525}', label: 'Fire' },
  { emoji: '\u2B50', label: 'Star' },
  { emoji: '\u{1F370}', label: 'Cake' },
  { emoji: '\u{1F37D}\uFE0F', label: 'Plate' },
  // People & communication
  { emoji: '\u{1F465}', label: 'People' },
  { emoji: '\u{1F4E2}', label: 'Megaphone' },
  { emoji: '\u{1F4DE}', label: 'Phone' },
  { emoji: '\u{1F3C6}', label: 'Trophy' },
  { emoji: '\u{1F393}', label: 'Graduation cap' },
  // Tools & logistics
  { emoji: '\u{1F527}', label: 'Wrench' },
  { emoji: '\u{1F3E2}', label: 'Building' },
  { emoji: '\u{1F69A}', label: 'Truck' },
  { emoji: '\u{1F4C5}', label: 'Calendar' },
  { emoji: '\u23F0', label: 'Clock' },
  { emoji: '\u2696\uFE0F', label: 'Scale' },
  { emoji: '\u{1F4D6}', label: 'Book' },
];

export const ICON_COLORS: Record<string, { bg: string; darkBg: string }> = {
  blue:    { bg: 'bg-blue-100',    darkBg: 'dark:bg-blue-900/30' },
  red:     { bg: 'bg-red-100',     darkBg: 'dark:bg-red-900/30' },
  orange:  { bg: 'bg-orange-100',  darkBg: 'dark:bg-orange-900/30' },
  amber:   { bg: 'bg-amber-100',   darkBg: 'dark:bg-amber-900/30' },
  green:   { bg: 'bg-green-100',   darkBg: 'dark:bg-green-900/30' },
  emerald: { bg: 'bg-emerald-100', darkBg: 'dark:bg-emerald-900/30' },
  purple:  { bg: 'bg-purple-100',  darkBg: 'dark:bg-purple-900/30' },
  pink:    { bg: 'bg-pink-100',    darkBg: 'dark:bg-pink-900/30' },
  slate:   { bg: 'bg-slate-100',   darkBg: 'dark:bg-slate-900/30' },
  gray:    { bg: 'bg-gray-100',    darkBg: 'dark:bg-gray-900/30' },
};

export const LEGACY_ICON_MAP: Record<string, { emoji: string; color: string }> = {
  ClipboardList:    { emoji: '\u{1F4CB}', color: 'blue' },
  FileText:         { emoji: '\u{1F4C4}', color: 'blue' },
  AlertTriangle:    { emoji: '\u26A0\uFE0F', color: 'amber' },
  Thermometer:      { emoji: '\u{1F321}\uFE0F', color: 'red' },
  ShieldCheck:      { emoji: '\u{1F6E1}\uFE0F', color: 'green' },
  Users:            { emoji: '\u{1F465}', color: 'purple' },
  UtensilsCrossed:  { emoji: '\u{1F374}', color: 'orange' },
  Stethoscope:      { emoji: '\u{1FA7A}', color: 'red' },
  Scale:            { emoji: '\u2696\uFE0F', color: 'slate' },
  Truck:            { emoji: '\u{1F69A}', color: 'blue' },
  Clock:            { emoji: '\u23F0', color: 'amber' },
  Star:             { emoji: '\u2B50', color: 'amber' },
  Heart:            { emoji: '\u2764\uFE0F', color: 'pink' },
  Flame:            { emoji: '\u{1F525}', color: 'orange' },
  BookOpen:         { emoji: '\u{1F4D6}', color: 'emerald' },
  Megaphone:        { emoji: '\u{1F4E2}', color: 'orange' },
  BadgeCheck:       { emoji: '\u2705', color: 'green' },
  Wrench:           { emoji: '\u{1F527}', color: 'gray' },
  Building:         { emoji: '\u{1F3E2}', color: 'slate' },
  Phone:            { emoji: '\u{1F4DE}', color: 'blue' },
  Calendar:         { emoji: '\u{1F4C5}', color: 'purple' },
  CheckSquare:      { emoji: '\u2705', color: 'green' },
  Package:          { emoji: '\u{1F4E6}', color: 'amber' },
  Award:            { emoji: '\u{1F3C6}', color: 'amber' },
  FileWarning:      { emoji: '\u26A0\uFE0F', color: 'red' },
  HeartPulse:       { emoji: '\u2764\uFE0F', color: 'pink' },
};

const DEFAULT_ICON = { emoji: '\u{1F4CB}', bg: 'bg-blue-100', darkBg: 'dark:bg-blue-900/30' };

export function resolveIcon(
  icon: string,
  iconColor?: string | null,
): { emoji: string; bg: string; darkBg: string } {
  if (!icon) return DEFAULT_ICON;

  if (icon in LEGACY_ICON_MAP) {
    const legacy = LEGACY_ICON_MAP[icon];
    const colorKey = iconColor ?? legacy.color;
    const colors = ICON_COLORS[colorKey] ?? ICON_COLORS.blue;
    return { emoji: legacy.emoji, bg: colors.bg, darkBg: colors.darkBg };
  }

  const colors = ICON_COLORS[iconColor ?? 'blue'] ?? ICON_COLORS.blue;
  return { emoji: icon, bg: colors.bg, darkBg: colors.darkBg };
}
