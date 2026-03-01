// src/lib/review-transforms.ts
// Pure transform utilities for the useReviewDashboard hook.
// No hooks, no side effects — only data mapping.

import type { StaffMention, ItemMention } from '@/types/reviews';

/** Format a Date as 'YYYY-MM-DD' for Supabase RPC params */
export function formatDateParam(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Compute previous period of same duration */
export function getPreviousPeriod(
  from: Date,
  to: Date
): { from: Date; to: Date } {
  const duration = to.getTime() - from.getTime();
  const prevTo = new Date(from.getTime() - 86_400_000); // day before start
  const prevFrom = new Date(prevTo.getTime() - duration);
  return { from: prevFrom, to: prevTo };
}

/** Map sentiment (-1 to +1) → score (0 to 1) for display */
export function sentimentToScore(s: number | null): number {
  if (s === null || s === undefined) return 0.5;
  return Math.max(0, Math.min(1, (s + 1) / 2));
}

/** Map raw aggregate_staff_mentions() JSONB → StaffMention[] */
export function mapStaffMentions(raw: any[]): StaffMention[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((r) => ({
    name: r.name ?? 'Unknown',
    role: r.role ?? '',
    mentions: Number(r.mentions) || 0,
    positivePercent:
      Number(r.mentions) > 0
        ? Number(r.positive) / Number(r.mentions)
        : 0,
  }));
}

/** Map raw aggregate_item_mentions() JSONB → ItemMention[] */
export function mapItemMentions(raw: any[]): ItemMention[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((r) => ({
    name: r.name ?? 'Unknown',
    type: r.item_type === 'beverage' || r.item_type === 'drink' ? 'drink' : 'food',
    mentions: Number(r.mentions) || 0,
    positivePercent:
      Number(r.mentions) > 0
        ? Number(r.positive) / Number(r.mentions)
        : 0,
    avgIntensity: Number(r.avg_intensity) || 0,
  }));
}

/** Compute Flavor Index from star counts: %5★ - %(1+2+3)★ */
export function computeFlavorIndex(
  five: number, four: number, three: number, two: number, one: number
): number {
  const total = five + four + three + two + one;
  if (total === 0) return 0;
  return Number(((five / total) * 100 - ((three + two + one) / total) * 100).toFixed(2));
}

/** '2026-01-13' → 'Jan 13' (en) or 'ene 13' (es) */
export function getWeekLabel(dateStr: string, locale: string = 'en-US'): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
}

/** '2026-01-01' → 'Jan 26' (en) or 'ene 26' (es) — includes short year for multi-year disambiguation */
export function getMonthLabel(dateStr: string, locale: string = 'en-US'): string {
  const d = new Date(dateStr + 'T00:00:00');
  const month = d.toLocaleDateString(locale, { month: 'short' });
  const year = String(d.getFullYear()).slice(-2);
  return `${month} ${year}`;
}

/** EN→ES bilingual label map for AI-extracted categories */
export const CATEGORY_LABEL_MAP: Record<string, { en: string; es: string }> = {
  'Food Quality':           { en: 'Food Quality',           es: 'Calidad de Comida' },
  'Presentation':           { en: 'Presentation',           es: 'Presentación' },
  'Service Attitude':       { en: 'Service Attitude',       es: 'Actitud de Servicio' },
  'Service Speed':          { en: 'Service Speed',          es: 'Velocidad de Servicio' },
  'Wait Time':              { en: 'Wait Time',              es: 'Tiempo de Espera' },
  'Reservation Experience': { en: 'Reservation Exp.',       es: 'Exp. de Reservación' },
  'Management':             { en: 'Management',             es: 'Gerencia' },
  'Ambience':               { en: 'Ambience',               es: 'Ambiente' },
  'Cleanliness':            { en: 'Cleanliness',            es: 'Limpieza' },
  'Value':                  { en: 'Value',                  es: 'Valor' },
  'Other':                  { en: 'Other',                  es: 'Otro' },
};

/** Map a bucket name to bilingual label */
export const BUCKET_LABEL_MAP: Record<string, { en: string; es: string }> = {
  food:     { en: 'Food Quality', es: 'Calidad de Comida' },
  service:  { en: 'Service',      es: 'Servicio' },
  ambience: { en: 'Ambience',     es: 'Ambiente' },
  value:    { en: 'Value',        es: 'Valor' },
};

/** Orange palette for competitor coloring (5 colors for up to 5 restaurants) */
export const COMP_COLORS = ['#F97316', '#FB923C', '#FDBA74', '#FED7AA', '#EA580C'];
