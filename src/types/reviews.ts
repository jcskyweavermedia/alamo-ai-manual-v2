// src/types/reviews.ts
// ═══════════════════════════════════════════════════════════════════════════
// Core Review Intelligence Types
// Monochromatic orange palette (NOT green from seed prep doc)
// ═══════════════════════════════════════════════════════════════════════════

import type { LucideIcon } from 'lucide-react';

// ─── Section 1: Union Types ────────────────────────────────────────────────

/** Flavor Index Score Zones — maps to CSS vars --flavor-{zone} */
export type FlavorScoreZone =
  | 'world-class'       // +71 to +100
  | 'excellent'         // +51 to +70
  | 'great'             // +31 to +50
  | 'good'              // 0 to +30
  | 'needs-improvement' // -100 to -1

/** NPS-Style Categories (star distribution bar) */
export type FlavorCategory =
  | 'loving'       // 5-star reviews
  | 'fence'        // 4-star reviews
  | 'not-feeling'  // 1-3 star reviews

/** Review Platforms */
export type ReviewPlatform = 'google' | 'opentable' | 'tripadvisor';

/** Analysis Pipeline Status */
export type AnalysisStatus = 'pending' | 'processing' | 'completed' | 'failed';

/** AI-Extracted Emotion */
export type Emotion = 'delighted' | 'satisfied' | 'neutral' | 'frustrated' | 'angry';

/** Time Period Selector */
export type TimePeriod =
  | { type: 'trailing_days'; value: number }    // 30, 90
  | { type: 'month'; value: string }            // '2026-02'
  | { type: 'quarter'; value: string }          // '2026-Q1'
  | { type: 'ytd'; value: '' }
  | { type: 'custom'; value: string };          // '2026-01-01:2026-03-31'

/** Restaurant Types */
export type RestaurantType = 'own' | 'competitor';

/** Scraping Configuration */
export type ScrapingFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly';

/** Restaurant Status */
export type RestaurantStatus = 'active' | 'paused' | 'archived';

/** Scrape Run Status */
export type ScrapeRunStatus = 'received' | 'processing' | 'completed' | 'failed';

/** AI-Extracted Return Intent */
export type ReturnIntent = 'likely' | 'unlikely' | 'unclear';

/** Overall Sentiment */
export type Sentiment = 'positive' | 'neutral' | 'negative';

// ─── Section 2: Config Interfaces + Constants ──────────────────────────────

/** Maps each zone to its label (EN/ES), color variable, and score range */
export interface FlavorZoneConfig {
  zone: FlavorScoreZone;
  label: { en: string; es: string };
  cssVar: string;           // CSS custom property name (e.g., '--flavor-world-class')
  hex: string;              // Hex fallback for non-CSS contexts (Recharts)
  minScore: number;         // Inclusive lower bound
  maxScore: number;         // Inclusive upper bound
}

/** Pre-defined zone configurations — monochromatic orange */
export const FLAVOR_ZONES: FlavorZoneConfig[] = [
  {
    zone: 'world-class',
    label: { en: 'World-Class', es: 'Clase Mundial' },
    cssVar: '--flavor-world-class',
    hex: '#F97316',    // orange-500 — matches mockup zone color
    minScore: 71,
    maxScore: 100,
  },
  {
    zone: 'excellent',
    label: { en: 'Excellent', es: 'Excelente' },
    cssVar: '--flavor-excellent',
    hex: '#FB923C',    // orange-400
    minScore: 51,
    maxScore: 70,
  },
  {
    zone: 'great',
    label: { en: 'Great', es: 'Muy Bueno' },
    cssVar: '--flavor-great',
    hex: '#FDBA74',    // orange-300
    minScore: 31,
    maxScore: 50,
  },
  {
    zone: 'good',
    label: { en: 'Good', es: 'Bueno' },
    cssVar: '--flavor-good',
    hex: '#FED7AA',    // orange-200
    minScore: 0,
    maxScore: 30,
  },
  {
    zone: 'needs-improvement',
    label: { en: 'Needs Improvement', es: 'Necesita Mejorar' },
    cssVar: '--flavor-needs-improvement',
    hex: '#FFEDD5',    // orange-50
    minScore: -100,
    maxScore: -1,
  },
];

/** NPS Category Configuration */
export interface FlavorCategoryConfig {
  category: FlavorCategory;
  label: { en: string; es: string };
  cssVar: string;
  hex: string;
  starRatings: number[];    // Which star ratings map to this category
}

/** Pre-defined category configurations — monochromatic orange */
export const FLAVOR_CATEGORIES: FlavorCategoryConfig[] = [
  {
    category: 'loving',
    label: { en: 'Loving the Flavor', es: 'Amando el Sabor' },
    cssVar: '--flavor-loving',
    hex: '#F97316',    // orange-500
    starRatings: [5],
  },
  {
    category: 'fence',
    label: { en: 'On the Fence', es: 'Indecisos' },
    cssVar: '--flavor-fence',
    hex: '#FB923C',    // orange-400
    starRatings: [4],
  },
  {
    category: 'not-feeling',
    label: { en: 'Not Feeling It', es: 'Sin Sabor' },
    cssVar: '--flavor-not-feeling',
    hex: '#FED7AA',    // orange-200
    starRatings: [1, 2, 3],
  },
];

// ─── Section 3: Dashboard Frontend Interfaces ──────────────────────────────

/** Hero card data */
export interface FlavorSummary {
  score: number;
  zone: FlavorScoreZone;
  delta: number | null;           // vs. prior period, null = no prior data
  avgRating: number;
  totalReviews: number;
  starDistribution: number[];     // [5-star, 4-star, 3-star, 2-star, 1-star]
  sparklineData: number[];        // last N data points for trend sparkline
}

/** Category breakdown row */
export interface CategorySentiment {
  category: FlavorCategory;
  label: { en: string; es: string };
  score: number;                  // 0 to 1
  delta: number | null;           // vs. prior period
}

/** Competitor comparison card */
export interface CompetitorData {
  restaurantId: string;
  name: string;
  isOwn: boolean;
  score: number;
  delta: number | null;
  avgRating: number;
  totalReviews: number;
}

/** Trend chart data point */
export interface TrendDataPoint {
  date: string;                   // ISO date
  [restaurantId: string]: number | string;  // score per restaurant + date key
}

/** Food/drink item mention */
export interface ItemMention {
  name: string;
  type: 'food' | 'drink';
  mentions: number;
  positivePercent: number;        // 0 to 1
  avgIntensity: number;           // 1 to 5
}

/** Staff mention */
export interface StaffMention {
  name: string;
  role: string;
  mentions: number;
  positivePercent: number;        // 0 to 1
}

/** Severity alert / flag */
export interface SeverityAlert {
  id: string;
  type: 'quality' | 'service' | 'hygiene' | 'wait_time';
  summary: { en: string; es: string };
  date: string;
  restaurantName: string;
}

// ─── Section 4: Dashboard Extended Interfaces ────────────────────────────

/** 12-month chart data point */
export interface FlavorMonthlyScore {
  month: string;
  score: number;
}

/** Per-restaurant item comparison (Food tab 5-column grid) */
export interface RestaurantItemComparison {
  restaurantId: string;
  name: string;
  isOwn: boolean;
  topItems: { item: string; count: number }[];
  worstItems: { item: string; count: number }[];
}

/** Category stat (Food Quality, Service, Ambience, Value) */
export interface CategoryStat {
  name: { en: string; es: string };
  score: number;      // 0-1 scale
  percent: number;    // distribution %
  color: string;      // hex
}

/** Strength or opportunity item */
export interface StrengthItem {
  name: { en: string; es: string };
  score: number;      // x/5
  color: string;      // hex
}

/** Company location for company ranking */
export interface CompanyLocation {
  name: string;
  score: number | null;  // null = no data
}

/** Category trend data point (multi-line chart, one point per week per restaurant) */
export interface CategoryTrendDataPoint {
  week: string;                   // 'Dec 2', 'Dec 16', etc.
  [restaurantName: string]: number | string;  // score per restaurant + week key
}

/** Category competitor bar (comparison list) */
export interface CategoryCompetitor {
  name: string;
  score: number;                  // 0-1 scale
  color: string;                  // hex
  isOwn?: boolean;
}

/** Sub-category detail item */
export interface SubCategoryItem {
  name: { en: string; es: string };
  intensity: number;              // x/5
  mentions: number;
  trend: string;                  // '+5', '-1', '0'
}

/** Company scorecard for a single restaurant/location */
export interface CompanyScorecard {
  name: string;
  location: string;
  score: number | null;           // null = no data
  delta: number | null;
  zone: FlavorScoreZone | null;
  totalReviews: number;
  avgRating: number;
  isPrimary: boolean;
}

/** Company trend data point (one per month per location) */
export interface CompanyTrendDataPoint {
  month: string;                  // 'Sep', 'Oct', etc.
  [locationName: string]: number | string;
}

/** Combined dashboard data shape */
export interface ReviewDashboardData {
  summary: FlavorSummary;
  categories: CategorySentiment[];
  competitors: CompetitorData[];
  trendData: TrendDataPoint[];
  items: ItemMention[];
  staff: StaffMention[];
  alerts: SeverityAlert[];
  monthlyScores: FlavorMonthlyScore[];
  restaurantItems: RestaurantItemComparison[];
  staffYear: StaffMention[];
  categoryStats: CategoryStat[];
  strengths: StrengthItem[];
  opportunities: StrengthItem[];
  companyLocations: CompanyLocation[];
  categoryTrend: Record<string, CategoryTrendDataPoint[]>;       // keyed by 'food' | 'service' | 'ambience' | 'value'
  categoryCompetitors: Record<string, CategoryCompetitor[]>;     // keyed by 'food' | 'service' | 'ambience' | 'value'
  subCategoriesFood: SubCategoryItem[];
  subCategoriesService: SubCategoryItem[];
  subCategoriesAmbience: SubCategoryItem[];
  subCategoriesValue: SubCategoryItem[];
  companyCards: CompanyScorecard[];
  companyTrend: CompanyTrendDataPoint[];
  lowRatingPercent: number;       // % of 1-3 star reviews (current period)
  lowRatingTotal: number;         // count of 1-3 star reviews
  previousLowPercent: number;     // % of 1-3 star reviews (previous period)
}

/** Tab identifiers */
export type ReviewTabId = 'overview' | 'food' | 'staff' | 'categories' | 'company';

/** Tab configuration with bilingual labels and icon name */
export interface ReviewTabConfig {
  id: ReviewTabId;
  label: { en: string; es: string };
  icon: string;   // lucide-react icon name
}

/** Configuration for all 5 tabs */
export const REVIEW_TABS: ReviewTabConfig[] = [
  { id: 'overview',   label: { en: 'Overview',   es: 'Resumen' },      icon: 'BarChart3' },
  { id: 'food',       label: { en: 'Food & Drinks', es: 'Comida y Bebidas' }, icon: 'UtensilsCrossed' },
  { id: 'staff',      label: { en: 'Staff Shoutouts', es: 'Reconocimiento' }, icon: 'Users' },
  { id: 'categories', label: { en: 'Categories', es: 'Categorías' },   icon: 'Layers' },
  { id: 'company',    label: { en: 'Company',    es: 'Compañía' },    icon: 'Building2' },
];
