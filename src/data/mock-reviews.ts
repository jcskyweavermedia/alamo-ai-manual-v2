// src/data/mock-reviews.ts
// ═══════════════════════════════════════════════════════════════════════════
// Mock data for the Review Dashboard — 5 tabs.
// Pattern: src/data/mock-wines.ts — typed const arrays.
// Values sourced from seed data (Phase 1 DB Foundation).
// ═══════════════════════════════════════════════════════════════════════════

import type {
  ReviewDashboardData,
  FlavorSummary,
  CategorySentiment,
  CompetitorData,
  TrendDataPoint,
  ItemMention,
  StaffMention,
  SeverityAlert,
  FlavorMonthlyScore,
  RestaurantItemComparison,
  CategoryStat,
  StrengthItem,
  CompanyLocation,
  CategoryTrendDataPoint,
  CategoryCompetitor,
  SubCategoryItem,
  CompanyScorecard,
  CompanyTrendDataPoint,
} from '@/types/reviews';

// ─── Deterministic Restaurant IDs (match seed migration UUIDs) ─────────────

export const RESTAURANT_IDS = {
  ALAMO_PRIME: 'a1a2a3a4-b1b2-c1c2-d1d2-e1e2e3e4e5e6',
  LONGHORN:    'b1b2b3b4-c1c2-d1d2-e1e2-f1f2f3f4f5f6',
  SALT_SEAR:   'c1c2c3c4-d1d2-e1e2-f1f2-a1a2a3a4a5a6',
  MESQUITE:    'd1d2d3d4-e1e2-f1f2-a1a2-b1b2b3b4b5b6',
} as const;

// ─── Flavor Summary (Hero Card) ───────────────────────────────────────────

export const MOCK_SUMMARY: FlavorSummary = {
  score: 75.33,
  zone: 'world-class',
  delta: 4.2,
  avgRating: 4.71,
  totalReviews: 150,
  starDistribution: [123, 17, 5, 3, 2],  // [5★, 4★, 3★, 2★, 1★]
  sparklineData: [68, 70, 71, 73, 72, 74, 75, 75.33],
};

// ─── Category Sentiment ───────────────────────────────────────────────────

export const MOCK_CATEGORIES: CategorySentiment[] = [
  {
    category: 'loving',
    label: { en: 'Loving the Flavor', es: 'Amando el Sabor' },
    score: 0.82,
    delta: 0.03,
  },
  {
    category: 'fence',
    label: { en: 'On the Fence', es: 'Indecisos' },
    score: 0.113,
    delta: -0.01,
  },
  {
    category: 'not-feeling',
    label: { en: 'Not Feeling It', es: 'Sin Sabor' },
    score: 0.067,
    delta: -0.02,
  },
];

// ─── Competitors ──────────────────────────────────────────────────────────

export const MOCK_COMPETITORS: CompetitorData[] = [
  {
    restaurantId: RESTAURANT_IDS.ALAMO_PRIME,
    name: 'Alamo Prime',
    isOwn: true,
    score: 75.33,
    delta: 4.2,
    avgRating: 4.71,
    totalReviews: 150,
  },
  {
    restaurantId: RESTAURANT_IDS.LONGHORN,
    name: 'Longhorn Steakhouse',
    isOwn: false,
    score: 48.0,
    delta: 2.1,
    avgRating: 4.33,
    totalReviews: 100,
  },
  {
    restaurantId: RESTAURANT_IDS.SALT_SEAR,
    name: 'Salt & Sear',
    isOwn: false,
    score: 25.0,
    delta: -3.5,
    avgRating: 4.04,
    totalReviews: 80,
  },
  {
    restaurantId: RESTAURANT_IDS.MESQUITE,
    name: 'Mesquite Grill',
    isOwn: false,
    score: -5.0,
    delta: -1.8,
    avgRating: 3.55,
    totalReviews: 60,
  },
];

// ─── Trend Data (last 8 weeks) ───────────────────────────────────────────

export const MOCK_TREND_DATA: TrendDataPoint[] = [
  { date: '2026-01-05', [RESTAURANT_IDS.ALAMO_PRIME]: 68, [RESTAURANT_IDS.LONGHORN]: 44, [RESTAURANT_IDS.SALT_SEAR]: 30, [RESTAURANT_IDS.MESQUITE]: -2 },
  { date: '2026-01-12', [RESTAURANT_IDS.ALAMO_PRIME]: 70, [RESTAURANT_IDS.LONGHORN]: 45, [RESTAURANT_IDS.SALT_SEAR]: 28, [RESTAURANT_IDS.MESQUITE]: -3 },
  { date: '2026-01-19', [RESTAURANT_IDS.ALAMO_PRIME]: 71, [RESTAURANT_IDS.LONGHORN]: 44, [RESTAURANT_IDS.SALT_SEAR]: 27, [RESTAURANT_IDS.MESQUITE]: -4 },
  { date: '2026-01-26', [RESTAURANT_IDS.ALAMO_PRIME]: 73, [RESTAURANT_IDS.LONGHORN]: 46, [RESTAURANT_IDS.SALT_SEAR]: 26, [RESTAURANT_IDS.MESQUITE]: -4 },
  { date: '2026-02-02', [RESTAURANT_IDS.ALAMO_PRIME]: 72, [RESTAURANT_IDS.LONGHORN]: 47, [RESTAURANT_IDS.SALT_SEAR]: 25, [RESTAURANT_IDS.MESQUITE]: -5 },
  { date: '2026-02-09', [RESTAURANT_IDS.ALAMO_PRIME]: 74, [RESTAURANT_IDS.LONGHORN]: 47, [RESTAURANT_IDS.SALT_SEAR]: 26, [RESTAURANT_IDS.MESQUITE]: -5 },
  { date: '2026-02-16', [RESTAURANT_IDS.ALAMO_PRIME]: 75, [RESTAURANT_IDS.LONGHORN]: 48, [RESTAURANT_IDS.SALT_SEAR]: 25, [RESTAURANT_IDS.MESQUITE]: -5 },
  { date: '2026-02-23', [RESTAURANT_IDS.ALAMO_PRIME]: 75.33, [RESTAURANT_IDS.LONGHORN]: 48, [RESTAURANT_IDS.SALT_SEAR]: 25, [RESTAURANT_IDS.MESQUITE]: -5 },
];

// ─── Item Mentions (Food & Drink tab) ────────────────────────────────────

export const MOCK_ITEMS: ItemMention[] = [
  { name: 'Bone-In Ribeye',   type: 'food',  mentions: 28, positivePercent: 0.92, avgIntensity: 4.5 },
  { name: 'Truffle Mac',      type: 'food',  mentions: 15, positivePercent: 0.93, avgIntensity: 4.2 },
  { name: 'Classic Margarita', type: 'drink', mentions: 12, positivePercent: 0.83, avgIntensity: 3.8 },
  { name: 'Grilled Caesar',   type: 'food',  mentions: 10, positivePercent: 0.80, avgIntensity: 3.5 },
  { name: 'Creme Brulee',     type: 'food',  mentions: 8,  positivePercent: 0.88, avgIntensity: 4.0 },
];

// ─── Staff Mentions ──────────────────────────────────────────────────────

export const MOCK_STAFF: StaffMention[] = [
  { name: 'Maria Garcia',    role: 'Server',    mentions: 14, positivePercent: 0.93 },
  { name: 'Carlos Reyes',    role: 'Server',    mentions: 10, positivePercent: 0.90 },
  { name: 'Jake Thompson',   role: 'Bartender', mentions: 7,  positivePercent: 0.86 },
  { name: 'Sofia Martinez',  role: 'Host',      mentions: 5,  positivePercent: 1.00 },
  { name: 'David Chen',      role: 'Server',    mentions: 4,  positivePercent: 0.75 },
];

// ─── Severity Alerts ─────────────────────────────────────────────────────

export const MOCK_ALERTS: SeverityAlert[] = [
  {
    id: 'alert-1',
    type: 'quality',
    summary: {
      en: '3 reviews mention overcooked steak this week',
      es: '3 reseñas mencionan bistec sobrecocido esta semana',
    },
    date: '2026-02-24',
    restaurantName: 'Alamo Prime',
  },
  {
    id: 'alert-2',
    type: 'wait_time',
    summary: {
      en: '2 reviews report 30+ minute wait for entrees',
      es: '2 reseñas reportan más de 30 minutos de espera para platos principales',
    },
    date: '2026-02-23',
    restaurantName: 'Alamo Prime',
  },
];

// ─── Monthly Scores (12-month chart) ────────────────────────────────────

export const MOCK_MONTHLY_SCORES: FlavorMonthlyScore[] = [
  { month: 'Mar', score: 62 },
  { month: 'Apr', score: 58 },
  { month: 'May', score: 65 },
  { month: 'Jun', score: 68 },
  { month: 'Jul', score: 70 },
  { month: 'Aug', score: 72 },
  { month: 'Sep', score: 71 },
  { month: 'Oct', score: 73 },
  { month: 'Nov', score: 74 },
  { month: 'Dec', score: 72 },
  { month: 'Jan', score: 75 },
  { month: 'Feb', score: 75.3 },
];

// ─── Restaurant Item Comparisons (Food tab) ─────────────────────────────

export const MOCK_RESTAURANT_ITEMS: RestaurantItemComparison[] = [
  {
    restaurantId: RESTAURANT_IDS.ALAMO_PRIME,
    name: 'Alamo Prime',
    isOwn: true,
    topItems: [
      { item: 'Bone-In Ribeye', count: 28 },
      { item: 'Truffle Mac', count: 15 },
      { item: 'Creme Brulee', count: 8 },
      { item: 'Wagyu Slider', count: 6 },
      { item: 'Caesar Salad', count: 5 },
    ],
    worstItems: [
      { item: 'House Wine', count: 6 },
      { item: 'Bread Basket', count: 4 },
      { item: 'Fish Tacos', count: 3 },
      { item: 'Onion Rings', count: 2 },
      { item: 'Draft Beer', count: 1 },
    ],
  },
  {
    restaurantId: RESTAURANT_IDS.LONGHORN,
    name: 'Longhorn & Ember',
    isOwn: false,
    topItems: [
      { item: 'Porterhouse', count: 22 },
      { item: 'Onion Soup', count: 18 },
      { item: 'Old Fashioned', count: 15 },
      { item: 'Wedge Salad', count: 12 },
      { item: 'Cheesecake', count: 9 },
    ],
    worstItems: [
      { item: 'Chicken Wings', count: 5 },
      { item: 'House Salad', count: 4 },
      { item: 'Mashed Potato', count: 3 },
      { item: 'Iced Tea', count: 2 },
      { item: 'Brownie', count: 1 },
    ],
  },
  {
    restaurantId: RESTAURANT_IDS.SALT_SEAR,
    name: 'Salt & Sear',
    isOwn: false,
    topItems: [
      { item: 'Tomahawk', count: 18 },
      { item: 'Lobster Tail', count: 14 },
      { item: 'Espresso Martini', count: 10 },
      { item: 'Crispy Brussels', count: 8 },
      { item: 'Key Lime Pie', count: 6 },
    ],
    worstItems: [
      { item: 'Grilled Salmon', count: 5 },
      { item: 'Bread Service', count: 4 },
      { item: 'House Red', count: 3 },
      { item: 'Shrimp App', count: 2 },
      { item: 'Fries', count: 1 },
    ],
  },
  {
    restaurantId: RESTAURANT_IDS.MESQUITE,
    name: 'Mesquite Flame',
    isOwn: false,
    topItems: [
      { item: 'Brisket', count: 20 },
      { item: 'Smoked Ribs', count: 16 },
      { item: 'Jalapeño Marg', count: 11 },
      { item: 'Cornbread', count: 9 },
      { item: 'Pecan Pie', count: 7 },
    ],
    worstItems: [
      { item: 'Pulled Pork', count: 6 },
      { item: 'Coleslaw', count: 4 },
      { item: 'Sweet Tea', count: 3 },
      { item: 'Mac & Cheese', count: 2 },
      { item: 'Bean Soup', count: 1 },
    ],
  },
  {
    restaurantId: 'e1e2e3e4-f1f2-a1a2-b1b2-c1c2c3c4c5c6',
    name: 'Pisco y Nazca',
    isOwn: false,
    topItems: [
      { item: 'Lomo Saltado', count: 24 },
      { item: 'Ceviche', count: 19 },
      { item: 'Pisco Sour', count: 14 },
      { item: 'Anticuchos', count: 10 },
      { item: 'Tres Leches', count: 8 },
    ],
    worstItems: [
      { item: 'Aji de Gallina', count: 4 },
      { item: 'Causa', count: 3 },
      { item: 'Chicha Morada', count: 2 },
      { item: 'Papa Rellena', count: 2 },
      { item: 'Arroz con Leche', count: 1 },
    ],
  },
];

// ─── Staff Year Leaderboard ─────────────────────────────────────────────

export const MOCK_STAFF_YEAR: StaffMention[] = [
  { name: 'Maria Garcia',    role: 'Server',    mentions: 48, positivePercent: 0.94 },
  { name: 'Carlos Reyes',    role: 'Bartender', mentions: 35, positivePercent: 0.91 },
  { name: 'Jake Thompson',   role: 'Server',    mentions: 28, positivePercent: 0.85 },
  { name: 'Sofia Martinez',  role: 'Host',      mentions: 22, positivePercent: 1.00 },
  { name: 'David Chen',      role: 'Manager',   mentions: 15, positivePercent: 0.73 },
];

// ─── Category Stats (Strengths & Opportunities) ────────────────────────

export const MOCK_CATEGORY_STATS: CategoryStat[] = [
  { name: { en: 'Food Quality', es: 'Calidad de Comida' }, score: 0.85, percent: 39, color: '#EA580C' },
  { name: { en: 'Service',      es: 'Servicio' },          score: 0.70, percent: 32, color: '#FB923C' },
  { name: { en: 'Ambience',     es: 'Ambiente' },          score: 0.73, percent: 19, color: '#FB923C' },
  { name: { en: 'Value',        es: 'Valor' },             score: 0.51, percent: 10, color: '#FDBA74' },
];

export const MOCK_STRENGTHS: StrengthItem[] = [
  { name: { en: 'Food Quality',  es: 'Calidad de Comida' }, score: 4.6, color: '#EA580C' },
  { name: { en: 'Presentation',  es: 'Presentación' },      score: 4.3, color: '#FB923C' },
  { name: { en: 'Ambience',      es: 'Ambiente' },          score: 4.1, color: '#FB923C' },
];

export const MOCK_OPPORTUNITIES: StrengthItem[] = [
  { name: { en: 'Wait Time',        es: 'Tiempo de Espera' },        score: 3.1, color: '#EA580C' },
  { name: { en: 'Value',            es: 'Valor' },                   score: 2.8, color: '#FB923C' },
  { name: { en: 'Reservation Exp.', es: 'Exp. de Reservación' },     score: 2.5, color: '#FB923C' },
];

// ─── Company Locations ──────────────────────────────────────────────────

export const MOCK_COMPANY_LOCATIONS: CompanyLocation[] = [
  { name: 'Austin — Main', score: 75.3 },
  { name: 'Westside',      score: null },
];

// ─── Category Trend (Categories tab — multi-line chart) ─────────────────

export const MOCK_CATEGORY_TREND: CategoryTrendDataPoint[] = [
  { week: 'Dec 2',  'Alamo Prime': 0.80, 'Longhorn & Ember': 0.72, 'Salt & Sear': 0.58, 'Mesquite Flame': 0.35 },
  { week: 'Dec 16', 'Alamo Prime': 0.82, 'Longhorn & Ember': 0.74, 'Salt & Sear': 0.56, 'Mesquite Flame': 0.33 },
  { week: 'Dec 30', 'Alamo Prime': 0.84, 'Longhorn & Ember': 0.76, 'Salt & Sear': 0.55, 'Mesquite Flame': 0.32 },
  { week: 'Jan 13', 'Alamo Prime': 0.83, 'Longhorn & Ember': 0.75, 'Salt & Sear': 0.54, 'Mesquite Flame': 0.30 },
  { week: 'Jan 27', 'Alamo Prime': 0.85, 'Longhorn & Ember': 0.77, 'Salt & Sear': 0.56, 'Mesquite Flame': 0.31 },
  { week: 'Feb 10', 'Alamo Prime': 0.86, 'Longhorn & Ember': 0.78, 'Salt & Sear': 0.55, 'Mesquite Flame': 0.32 },
  { week: 'Feb 24', 'Alamo Prime': 0.85, 'Longhorn & Ember': 0.78, 'Salt & Sear': 0.55, 'Mesquite Flame': 0.32 },
];

// ─── Category Competitors ───────────────────────────────────────────────

export const MOCK_CATEGORY_COMPETITORS: CategoryCompetitor[] = [
  { name: 'Alamo Prime',      score: 0.85, color: '#F97316', isOwn: true },
  { name: 'Longhorn & Ember', score: 0.78, color: '#FB923C' },
  { name: 'Salt & Sear',      score: 0.55, color: '#FDBA74' },
  { name: 'Mesquite Flame',   score: 0.32, color: '#FED7AA' },
];

// ─── Sub-Categories ─────────────────────────────────────────────────────

export const MOCK_SUB_CATEGORIES_FOOD: SubCategoryItem[] = [
  { name: { en: 'Food Quality',  es: 'Calidad de Comida' }, intensity: 4.6, mentions: 42, trend: '+5' },
  { name: { en: 'Presentation',  es: 'Presentación' },      intensity: 4.3, mentions: 18, trend: '+2' },
];

export const MOCK_SUB_CATEGORIES_SERVICE: SubCategoryItem[] = [
  { name: { en: 'Service Attitude', es: 'Actitud de Servicio' }, intensity: 4.1, mentions: 30, trend: '+3' },
  { name: { en: 'Service Speed',    es: 'Velocidad de Servicio' }, intensity: 3.4, mentions: 22, trend: '-1' },
  { name: { en: 'Wait Time',        es: 'Tiempo de Espera' },     intensity: 3.1, mentions: 15, trend: '-4' },
  { name: { en: 'Reservation Exp.', es: 'Exp. de Reservación' },  intensity: 2.5, mentions: 8,  trend: '0' },
  { name: { en: 'Management',       es: 'Gerencia' },             intensity: 3.8, mentions: 6,  trend: '+1' },
];

// ─── Company Scorecards ─────────────────────────────────────────────────

export const MOCK_COMPANY_CARDS: CompanyScorecard[] = [
  {
    name: 'Alamo Prime Steakhouse',
    location: 'Austin, TX',
    score: 75.3,
    delta: 4.2,
    zone: 'world-class',
    totalReviews: 150,
    avgRating: 4.71,
    isPrimary: true,
  },
  {
    name: 'Alamo Prime — Westside',
    location: 'Austin, TX',
    score: null,
    delta: null,
    zone: null,
    totalReviews: 0,
    avgRating: 0,
    isPrimary: false,
  },
];

// ─── Company Trend ──────────────────────────────────────────────────────

export const MOCK_COMPANY_TREND: CompanyTrendDataPoint[] = [
  { month: 'Sep', 'Alamo Prime — Austin': 68 },
  { month: 'Oct', 'Alamo Prime — Austin': 70 },
  { month: 'Nov', 'Alamo Prime — Austin': 72 },
  { month: 'Dec', 'Alamo Prime — Austin': 73 },
  { month: 'Jan', 'Alamo Prime — Austin': 74 },
  { month: 'Feb', 'Alamo Prime — Austin': 75.3 },
];

// ─── Combined Dashboard Data ─────────────────────────────────────────────

export const MOCK_DASHBOARD_DATA: ReviewDashboardData = {
  summary: MOCK_SUMMARY,
  categories: MOCK_CATEGORIES,
  competitors: MOCK_COMPETITORS,
  trendData: MOCK_TREND_DATA,
  items: MOCK_ITEMS,
  staff: MOCK_STAFF,
  alerts: MOCK_ALERTS,
  monthlyScores: MOCK_MONTHLY_SCORES,
  restaurantItems: MOCK_RESTAURANT_ITEMS,
  staffYear: MOCK_STAFF_YEAR,
  categoryStats: MOCK_CATEGORY_STATS,
  strengths: MOCK_STRENGTHS,
  opportunities: MOCK_OPPORTUNITIES,
  companyLocations: MOCK_COMPANY_LOCATIONS,
  categoryTrend: { food: MOCK_CATEGORY_TREND, service: MOCK_CATEGORY_TREND, ambience: MOCK_CATEGORY_TREND, value: MOCK_CATEGORY_TREND },
  categoryCompetitors: { food: MOCK_CATEGORY_COMPETITORS, service: MOCK_CATEGORY_COMPETITORS, ambience: MOCK_CATEGORY_COMPETITORS, value: MOCK_CATEGORY_COMPETITORS },
  subCategoriesFood: MOCK_SUB_CATEGORIES_FOOD,
  subCategoriesService: MOCK_SUB_CATEGORIES_SERVICE,
  subCategoriesAmbience: [],
  subCategoriesValue: [],
  companyCards: MOCK_COMPANY_CARDS,
  companyTrend: MOCK_COMPANY_TREND,
  lowRatingPercent: 6.7,
  lowRatingTotal: 10,
  previousLowPercent: 8.2,
};
