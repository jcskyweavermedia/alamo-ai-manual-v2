// src/lib/flavor-utils.ts
// ═══════════════════════════════════════════════════════════════════════════
// Pure utility functions for the Flavor Index / Review Intelligence system.
// Pattern: src/lib/form-utils.ts — no hooks, no side effects.
// ═══════════════════════════════════════════════════════════════════════════

import {
  FLAVOR_ZONES,
  FLAVOR_CATEGORIES,
  type FlavorZoneConfig,
  type FlavorCategoryConfig,
  type CompetitorData,
} from '@/types/reviews';

// ─── Zone Lookup ───────────────────────────────────────────────────────────

/** Find the zone config for a given score (-100 to +100) */
export function getFlavorZone(score: number): FlavorZoneConfig {
  const clamped = Math.max(-100, Math.min(100, score));
  const zone = FLAVOR_ZONES.find(
    (z) => clamped >= z.minScore && clamped <= z.maxScore
  );
  // Fallback to 'needs-improvement' (last zone covers -100 to -1)
  return zone ?? FLAVOR_ZONES[FLAVOR_ZONES.length - 1];
}

/** Returns `hsl(var(--flavor-*))` CSS value for a given score */
export function getFlavorZoneColor(score: number): string {
  const zone = getFlavorZone(score);
  return `hsl(var(${zone.cssVar}))`;
}

/** Returns hex color for Recharts (can't use CSS vars in SVG) */
export function getFlavorZoneHex(score: number): string {
  return getFlavorZone(score).hex;
}

/** Returns bilingual label for a score's zone */
export function getFlavorZoneLabel(score: number, isEs: boolean): string {
  const zone = getFlavorZone(score);
  return isEs ? zone.label.es : zone.label.en;
}

// ─── Formatting ────────────────────────────────────────────────────────────

/** Format a flavor score with sign: "+75.3", "-5.0", "0.0" */
export function formatFlavorScore(score: number): string {
  const fixed = Math.abs(score).toFixed(1);
  if (score > 0) return `+${fixed}`;
  if (score < 0) return `-${fixed}`;
  return fixed;
}

/** Format a delta value for display */
export function formatDelta(delta: number | null): {
  text: string;
  isPositive: boolean;
  isNeutral: boolean;
} {
  if (delta === null || delta === undefined) {
    return { text: '---', isPositive: false, isNeutral: true };
  }
  const fixed = Math.abs(delta).toFixed(1);
  if (delta > 0) return { text: `+${fixed}`, isPositive: true, isNeutral: false };
  if (delta < 0) return { text: `-${fixed}`, isPositive: false, isNeutral: false };
  return { text: '0.0', isPositive: false, isNeutral: true };
}

/** Format a 0-1 value as percentage: 0.82 → "82%" */
export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

// ─── Category Lookup ───────────────────────────────────────────────────────

/** Get the NPS-style category config for a star rating (1-5) */
export function getFlavorCategory(starRating: number): FlavorCategoryConfig {
  const cat = FLAVOR_CATEGORIES.find((c) =>
    c.starRatings.includes(starRating)
  );
  // Fallback to 'not-feeling' for unexpected values
  return cat ?? FLAVOR_CATEGORIES[FLAVOR_CATEGORIES.length - 1];
}

// ─── Distribution Helpers ──────────────────────────────────────────────────

/**
 * Convert star distribution counts to percentages.
 * Input: [5star, 4star, 3star, 2star, 1star]
 * Output: [percent5, percent4, percent3, percent2, percent1] (0-100)
 */
export function getStarDistributionPercents(distribution: number[]): number[] {
  const total = distribution.reduce((sum, n) => sum + n, 0);
  if (total === 0) return distribution.map(() => 0);
  return distribution.map((count) => (count / total) * 100);
}

// ─── Ranking ───────────────────────────────────────────────────────────────

/**
 * Determine rank of own restaurant among competitors.
 * Returns { rank, total } — rank is 1-indexed.
 */
export function getLocalRank(
  ownScore: number,
  competitors: CompetitorData[]
): { rank: number; total: number } {
  const allScores = competitors.map((c) => c.score);
  const betterCount = allScores.filter((s) => s > ownScore).length;
  return { rank: betterCount + 1, total: allScores.length };
}
