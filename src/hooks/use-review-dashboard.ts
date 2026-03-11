// src/hooks/use-review-dashboard.ts
// Fetches all data for the Review Dashboard from Supabase.
// Pattern: use-courses.ts — single useQuery with phased internal queries.

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { getFlavorZone } from '@/lib/flavor-utils';
import {
  formatDateParam,
  getPreviousPeriod,
  sentimentToScore,
  mapStaffMentions,
  mapItemMentions,
  getWeekLabel,
  getMonthLabel,
  CATEGORY_LABEL_MAP,
  BUCKET_LABEL_MAP,
  COMP_COLORS,
} from '@/lib/review-transforms';
import type {
  ReviewDashboardData,
  FlavorSummary,
  CategorySentiment,
  CompetitorData,
  TrendDataPoint,
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
  FlavorScoreZone,
} from '@/types/reviews';

interface TrackedRestaurant {
  id: string;
  name: string;
  restaurant_type: 'own' | 'competitor';
  parent_unit_id: string | null;
  city: string | null;
  state: string | null;
}

/** Safely parse a JSONB scalar return from .rpc() into an array.
 *  aggregate_staff_mentions/aggregate_item_mentions return JSONB (not TABLE),
 *  so PostgREST may return it as a direct array or wrapped in a single-element array. */
function parseJsonbArray(data: unknown): any[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') return [data];
  return [];
}

export function useReviewDashboard(dateRange: { from: Date; to: Date }, locale: string = 'en-US') {
  const { user, permissions } = useAuth();
  const groupId = permissions?.memberships?.[0]?.groupId ?? null;

  const { data, isLoading, error } = useQuery({
    queryKey: [
      'review-dashboard',
      groupId,
      dateRange.from.toISOString(),
      dateRange.to.toISOString(),
      locale,
    ],
    queryFn: async (): Promise<ReviewDashboardData> => {
      if (!groupId) throw new Error('No group ID available');

      const from = formatDateParam(dateRange.from);
      const to = formatDateParam(dateRange.to);
      const prev = getPreviousPeriod(dateRange.from, dateRange.to);
      const prevFrom = formatDateParam(prev.from);
      const prevTo = formatDateParam(prev.to);

      // ── Phase A: Foundation ───────────────────────────────────────────
      const { data: restaurants, error: restError } = await supabase
        .from('tracked_restaurants')
        .select('id, name, restaurant_type, parent_unit_id, city, state')
        .eq('group_id', groupId)
        .eq('status', 'active')
        .order('name');

      if (restError) throw restError;
      const allRestaurants = (restaurants ?? []) as TrackedRestaurant[];

      const ownRestaurants = allRestaurants.filter((r) => r.restaurant_type === 'own');
      const primaryOwn = ownRestaurants[0];
      if (!primaryOwn) throw new Error('No own restaurant found for this group');

      const allIds = allRestaurants.map((r) => r.id);

      // ── Phase B: Parallel queries ─────────────────────────────────────

      const [
        competitorsResult,
        fiCurrentResult,
        fiPreviousResult,
        riMonthOwnResult,
        riMonthAllResult,
        riWeekAllResult,
        staffMonthResult,
        staffYearResult,
        alertsResult,
        subFoodResult,
        subServiceResult,
        subAmbienceResult,
        subValueResult,
        catTrendFoodResult,
        catTrendServiceResult,
        catTrendAmbienceResult,
        catTrendValueResult,
      ] = await Promise.all([
        // 1. Competitors batch
        supabase.rpc('get_dashboard_competitors', {
          p_unit_id: primaryOwn.id,
          p_start_date: from,
          p_end_date: to,
        }),

        // 2. FI current period (own)
        supabase.rpc('compute_flavor_index_range', {
          p_restaurant_id: primaryOwn.id,
          p_start_date: from,
          p_end_date: to,
        }),

        // 3. FI previous period (own)
        supabase.rpc('compute_flavor_index_range', {
          p_restaurant_id: primaryOwn.id,
          p_start_date: prevFrom,
          p_end_date: prevTo,
        }),

        // 4. review_intelligence: latest month for own restaurant
        supabase
          .from('review_intelligence')
          .select('*')
          .eq('restaurant_id', primaryOwn.id)
          .eq('period_type', 'month')
          .order('period_start', { ascending: false })
          .limit(1),

        // 5. review_intelligence: last 12 months per restaurant (monthly scores chart)
        supabase
          .from('review_intelligence')
          .select('period_start, flavor_index, food_sentiment, service_sentiment, ambience_sentiment, value_sentiment, restaurant_id')
          .in('restaurant_id', allIds)
          .eq('period_type', 'month')
          .order('period_start', { ascending: false })
          .limit(100),

        // 6. review_intelligence: weekly for all restaurants (trend data + sparkline)
        supabase
          .from('review_intelligence')
          .select('period_start, flavor_index, restaurant_id')
          .in('restaurant_id', allIds)
          .eq('period_type', 'week')
          .gte('period_start', from)
          .lte('period_start', to)
          .order('period_start', { ascending: true }),

        // 7. Staff mentions — month range
        supabase.rpc('aggregate_staff_mentions', {
          p_restaurant_id: primaryOwn.id,
          p_start_date: from,
          p_end_date: to,
          p_limit: 10,
        }),

        // 8. Staff mentions — year range
        supabase.rpc('aggregate_staff_mentions', {
          p_restaurant_id: primaryOwn.id,
          p_start_date: `${dateRange.from.getFullYear()}-01-01`,
          p_end_date: to,
          p_limit: 10,
        }),

        // 9. Severity alerts
        supabase.rpc('get_severity_alerts', {
          p_restaurant_ids: allIds,
          p_start_date: from,
          p_end_date: to,
          p_limit: 20,
        }),

        // 10. Sub-category: food
        supabase.rpc('get_subcategory_breakdown', {
          p_restaurant_id: primaryOwn.id,
          p_start_date: from,
          p_end_date: to,
          p_bucket: 'food',
          p_limit: 10,
        }),

        // 11. Sub-category: service
        supabase.rpc('get_subcategory_breakdown', {
          p_restaurant_id: primaryOwn.id,
          p_start_date: from,
          p_end_date: to,
          p_bucket: 'service',
          p_limit: 10,
        }),

        // 12. Sub-category: ambience
        supabase.rpc('get_subcategory_breakdown', {
          p_restaurant_id: primaryOwn.id,
          p_start_date: from,
          p_end_date: to,
          p_bucket: 'ambience',
          p_limit: 10,
        }),

        // 13. Sub-category: value
        supabase.rpc('get_subcategory_breakdown', {
          p_restaurant_id: primaryOwn.id,
          p_start_date: from,
          p_end_date: to,
          p_bucket: 'value',
          p_limit: 10,
        }),

        // 14-17. Category trend: all 4 categories
        supabase.rpc('get_category_trend_weekly', {
          p_restaurant_ids: allIds,
          p_category: 'food',
          p_start_date: from,
          p_end_date: to,
        }),
        supabase.rpc('get_category_trend_weekly', {
          p_restaurant_ids: allIds,
          p_category: 'service',
          p_start_date: from,
          p_end_date: to,
        }),
        supabase.rpc('get_category_trend_weekly', {
          p_restaurant_ids: allIds,
          p_category: 'ambience',
          p_start_date: from,
          p_end_date: to,
        }),
        supabase.rpc('get_category_trend_weekly', {
          p_restaurant_ids: allIds,
          p_category: 'value',
          p_start_date: from,
          p_end_date: to,
        }),
      ]);

      // Throw on critical errors
      if (competitorsResult.error) throw competitorsResult.error;
      if (fiCurrentResult.error) throw fiCurrentResult.error;

      // Warn on non-critical errors (dashboard still renders with partial data)
      if (fiPreviousResult.error) console.warn('[ReviewDashboard] Previous period FI:', fiPreviousResult.error.message);
      if (riMonthOwnResult.error) console.warn('[ReviewDashboard] Monthly RI (own):', riMonthOwnResult.error.message);
      if (riMonthAllResult.error) console.warn('[ReviewDashboard] Monthly RI (all):', riMonthAllResult.error.message);
      if (riWeekAllResult.error) console.warn('[ReviewDashboard] Weekly RI:', riWeekAllResult.error.message);
      if (staffMonthResult.error) console.warn('[ReviewDashboard] Staff (month):', staffMonthResult.error.message);
      if (staffYearResult.error) console.warn('[ReviewDashboard] Staff (year):', staffYearResult.error.message);
      if (alertsResult.error) console.warn('[ReviewDashboard] Alerts:', alertsResult.error.message);
      if (subFoodResult.error) console.warn('[ReviewDashboard] SubCat food:', subFoodResult.error.message);
      if (subServiceResult.error) console.warn('[ReviewDashboard] SubCat service:', subServiceResult.error.message);
      if (subAmbienceResult.error) console.warn('[ReviewDashboard] SubCat ambience:', subAmbienceResult.error.message);
      if (subValueResult.error) console.warn('[ReviewDashboard] SubCat value:', subValueResult.error.message);
      if (catTrendFoodResult.error) console.warn('[ReviewDashboard] CatTrend food:', catTrendFoodResult.error.message);
      if (catTrendServiceResult.error) console.warn('[ReviewDashboard] CatTrend service:', catTrendServiceResult.error.message);
      if (catTrendAmbienceResult.error) console.warn('[ReviewDashboard] CatTrend ambience:', catTrendAmbienceResult.error.message);
      if (catTrendValueResult.error) console.warn('[ReviewDashboard] CatTrend value:', catTrendValueResult.error.message);

      // ── Phase C: Transform ─────────────────────────────────────────────

      const fiCurrent = Array.isArray(fiCurrentResult.data)
        ? fiCurrentResult.data[0]
        : fiCurrentResult.data;
      const fiPrevious = Array.isArray(fiPreviousResult.data)
        ? fiPreviousResult.data?.[0]
        : fiPreviousResult.data;
      const riMonthOwn = riMonthOwnResult.data?.[0] ?? null;
      const competitorsRaw = competitorsResult.data ?? [];

      // Build name lookup
      const nameMap = new Map<string, string>();
      for (const r of allRestaurants) nameMap.set(r.id, r.name);

      // --- summary ---
      const fiveStarCount = Number(fiCurrent?.five_star ?? 0);
      const fourStarCount = Number(fiCurrent?.four_star ?? 0);
      const lowStarCount = Number(fiCurrent?.low_star ?? 0);
      const totalReviews = Number(fiCurrent?.total_reviews ?? 0);
      const currentFI = Number(fiCurrent?.flavor_index ?? 0);
      const prevFI = fiPrevious?.total_reviews > 0 ? Number(fiPrevious.flavor_index) : null;
      const delta = prevFI !== null ? Number((currentFI - prevFI).toFixed(2)) : null;

      // Star distribution: [5★, 4★, 3★, 2★, 1★]
      // compute_flavor_index_range returns low_star (combined 1+2+3)
      // We need to split — estimate from proportions or use daily data
      // For now: put low_star as 3★ bucket (best approximation without separate counts)
      const starDistribution = [
        fiveStarCount,
        fourStarCount,
        lowStarCount, // 3-star (approximation: all low combined)
        0,            // 2-star (included in low_star above)
        0,            // 1-star (included in low_star above)
      ];

      // Sparkline from weekly FI data
      const weeklyOwnRows = (riWeekAllResult.data ?? []).filter(
        (r: any) => r.restaurant_id === primaryOwn.id
      );
      const sparklineData = weeklyOwnRows.map((r: any) => Number(r.flavor_index ?? 0));

      const summary: FlavorSummary = {
        score: currentFI,
        zone: getFlavorZone(currentFI).zone,
        delta,
        avgRating: Number(fiCurrent?.avg_rating ?? 0),
        totalReviews,
        starDistribution,
        sparklineData,
      };

      // --- lowRating fields ---
      const lowRatingTotal = lowStarCount;
      const lowRatingPercent = totalReviews > 0
        ? Number(((lowStarCount / totalReviews) * 100).toFixed(1))
        : 0;
      const prevTotal = Number(fiPrevious?.total_reviews ?? 0);
      const prevLowStar = Number(fiPrevious?.low_star ?? 0);
      const previousLowPercent = prevTotal > 0
        ? Number(((prevLowStar / prevTotal) * 100).toFixed(1))
        : 0;

      // --- categories (NPS-style) ---
      const categories: CategorySentiment[] = [
        {
          category: 'loving',
          label: { en: 'Loving the Flavor', es: 'Amando el Sabor' },
          score: totalReviews > 0 ? fiveStarCount / totalReviews : 0,
          delta: null,
        },
        {
          category: 'fence',
          label: { en: 'On the Fence', es: 'Indecisos' },
          score: totalReviews > 0 ? fourStarCount / totalReviews : 0,
          delta: null,
        },
        {
          category: 'not-feeling',
          label: { en: 'Not Feeling It', es: 'Sin Sabor' },
          score: totalReviews > 0 ? lowStarCount / totalReviews : 0,
          delta: null,
        },
      ];

      // --- competitors ---
      const competitors: CompetitorData[] = competitorsRaw.map((c: any) => ({
        restaurantId: c.restaurant_id,
        name: c.name ?? nameMap.get(c.restaurant_id) ?? 'Unknown',
        isOwn: c.is_own ?? false,
        score: Number(c.flavor_index ?? 0),
        delta: c.delta !== null ? Number(c.delta) : null,
        avgRating: Number(c.avg_rating ?? 0),
        totalReviews: Number(c.total_reviews ?? 0),
      }));
      // Sort by score descending
      competitors.sort((a, b) => b.score - a.score);

      // --- trendData (weekly, all restaurants) ---
      const weeklyRows = riWeekAllResult.data ?? [];
      const trendMap = new Map<string, TrendDataPoint>();
      for (const row of weeklyRows as any[]) {
        const weekKey = row.period_start;
        if (!trendMap.has(weekKey)) {
          trendMap.set(weekKey, { date: weekKey });
        }
        const point = trendMap.get(weekKey)!;
        point[row.restaurant_id] = Number(row.flavor_index ?? 0);
      }
      const trendData: TrendDataPoint[] = Array.from(trendMap.values()).sort(
        (a, b) => String(a.date).localeCompare(String(b.date))
      );

      // --- items (from own restaurant) ---
      // Use review_intelligence top_positive_items if available
      const riItems = riMonthOwn?.top_positive_items;
      const items = riItems && Array.isArray(riItems) && riItems.length > 0
        ? mapItemMentions(riItems)
        : [];

      // --- staff ---
      const staff = mapStaffMentions(parseJsonbArray(staffMonthResult.data));

      // --- staffYear ---
      const staffYear = mapStaffMentions(parseJsonbArray(staffYearResult.data));

      // --- alerts ---
      const alertsRaw = alertsResult.data ?? [];
      const alerts: SeverityAlert[] = (alertsRaw as any[]).map((a) => ({
        id: a.alert_id ?? a.id ?? '',
        type: (a.alert_type ?? 'quality') as SeverityAlert['type'],
        summary: {
          en: a.summary ?? '',
          es: a.summary ?? '', // alerts stored in original language
        },
        date: a.review_date ?? '',
        restaurantName: a.restaurant_name ?? '',
      }));

      // --- monthlyScores (per-restaurant, last 12 months, with category sentiments) ---
      const monthlyRows = riMonthAllResult.data ?? [];
      const monthlyByRest: Record<string, FlavorMonthlyScore[]> = {};
      for (const r of monthlyRows as any[]) {
        const rid = r.restaurant_id;
        if (!monthlyByRest[rid]) monthlyByRest[rid] = [];
        monthlyByRest[rid].push({
          month: getMonthLabel(r.period_start, locale),
          score: Number(r.flavor_index ?? 0),
          food: r.food_sentiment != null ? Math.round(sentimentToScore(Number(r.food_sentiment)) * 100) : null,
          service: r.service_sentiment != null ? Math.round(sentimentToScore(Number(r.service_sentiment)) * 100) : null,
          ambience: r.ambience_sentiment != null ? Math.round(sentimentToScore(Number(r.ambience_sentiment)) * 100) : null,
          value: r.value_sentiment != null ? Math.round(sentimentToScore(Number(r.value_sentiment)) * 100) : null,
        });
      }
      // Data arrived DESC — reverse each to chronological order, take latest 12
      for (const rid of Object.keys(monthlyByRest)) {
        monthlyByRest[rid] = monthlyByRest[rid].reverse().slice(-12);
      }
      const monthlyScores = monthlyByRest[primaryOwn.id] ?? [];
      const monthlyScoresByRestaurant = monthlyByRest;

      // --- restaurantItems (per-restaurant top/worst from review_intelligence) ---
      // Fetch latest monthly review_intelligence for each restaurant (parallel)
      const restaurantItemResults = await Promise.all(
        competitors.map((comp) =>
          supabase
            .from('review_intelligence')
            .select('top_positive_items, top_complaints')
            .eq('restaurant_id', comp.restaurantId)
            .eq('period_type', 'month')
            .order('period_start', { ascending: false })
            .limit(1)
        )
      );
      const restaurantItems: RestaurantItemComparison[] = competitors.map((comp, idx) => {
        const ri = restaurantItemResults[idx].data?.[0];
        const topItems = (ri?.top_positive_items as any[] ?? []).slice(0, 5).map((i: any) => ({
          item: i.name ?? i.item ?? 'Unknown',
          count: Number(i.mentions ?? 0),
        }));
        const worstItems = (ri?.top_complaints as any[] ?? []).slice(0, 5).map((i: any) => ({
          item: i.name ?? i.item ?? 'Unknown',
          count: Number(i.mentions ?? 0),
        }));
        return {
          restaurantId: comp.restaurantId,
          name: comp.name,
          isOwn: comp.isOwn,
          topItems,
          worstItems,
        };
      });

      // --- categoryStats (compute distribution % from subcategory mention totals) ---
      const foodMentions = (subFoodResult.data as any[] ?? []).reduce((s: number, r: any) => s + Number(r.mentions ?? 0), 0);
      const serviceMentions = (subServiceResult.data as any[] ?? []).reduce((s: number, r: any) => s + Number(r.mentions ?? 0), 0);
      const ambienceMentions = (subAmbienceResult.data as any[] ?? []).reduce((s: number, r: any) => s + Number(r.mentions ?? 0), 0);
      const valueMentions = (subValueResult.data as any[] ?? []).reduce((s: number, r: any) => s + Number(r.mentions ?? 0), 0);
      const totalMentions = foodMentions + serviceMentions + ambienceMentions + valueMentions;
      const pct = (n: number) => totalMentions > 0 ? Math.round((n / totalMentions) * 100) : 25;

      const categoryStats: CategoryStat[] = [
        {
          name: BUCKET_LABEL_MAP.food,
          score: sentimentToScore(riMonthOwn?.food_sentiment ?? null),
          percent: pct(foodMentions),
          color: '#EA580C',
        },
        {
          name: BUCKET_LABEL_MAP.service,
          score: sentimentToScore(riMonthOwn?.service_sentiment ?? null),
          percent: pct(serviceMentions),
          color: '#FB923C',
        },
        {
          name: BUCKET_LABEL_MAP.ambience,
          score: sentimentToScore(riMonthOwn?.ambience_sentiment ?? null),
          percent: pct(ambienceMentions),
          color: '#FB923C',
        },
        {
          name: BUCKET_LABEL_MAP.value,
          score: sentimentToScore(riMonthOwn?.value_sentiment ?? null),
          percent: pct(valueMentions),
          color: '#FDBA74',
        },
      ];

      // --- strengths & opportunities ---
      const riStrengths = (riMonthOwn?.top_strengths as any[]) ?? [];
      const strengths: StrengthItem[] = riStrengths.slice(0, 3).map((s: any, i: number) => ({
        name: CATEGORY_LABEL_MAP[s.category] ?? { en: s.category, es: s.category },
        score: Number(s.avg_intensity ?? 0),
        color: i === 0 ? '#EA580C' : '#FB923C',
      }));

      const riOpps = (riMonthOwn?.top_opportunities as any[]) ?? [];
      const opportunities: StrengthItem[] = riOpps.slice(0, 3).map((o: any, i: number) => ({
        name: CATEGORY_LABEL_MAP[o.category] ?? { en: o.category, es: o.category },
        score: Number(o.avg_intensity ?? 0),
        color: i === 0 ? '#EA580C' : '#FB923C',
      }));

      // --- companyLocations ---
      const companyLocations: CompanyLocation[] = ownRestaurants.map((r) => {
        const comp = competitors.find((c) => c.restaurantId === r.id);
        return {
          name: r.name,
          score: comp?.score ?? null,
        };
      });

      // --- categoryTrend (per-category, weekly sentiment across restaurants) ---
      const CATEGORIES = ['food', 'service', 'ambience', 'value'] as const;
      const catTrendResults = [catTrendFoodResult, catTrendServiceResult, catTrendAmbienceResult, catTrendValueResult];
      const categoryTrend: Record<string, CategoryTrendDataPoint[]> = {};
      for (let ci = 0; ci < CATEGORIES.length; ci++) {
        const raw = catTrendResults[ci].data ?? [];
        const map = new Map<string, CategoryTrendDataPoint>();
        for (const row of raw as any[]) {
          const weekLabel = getWeekLabel(row.week_start, locale);
          if (!map.has(weekLabel)) map.set(weekLabel, { week: weekLabel });
          const point = map.get(weekLabel)!;
          const rName = nameMap.get(row.restaurant_id) ?? row.restaurant_id;
          point[rName] = sentimentToScore(Number(row.sentiment ?? 0));
        }
        categoryTrend[CATEGORIES[ci]] = Array.from(map.values());
      }

      // --- categoryCompetitors (per-category sentiment comparison) ---
      const SENTIMENT_COLS = ['food_sentiment', 'service_sentiment', 'ambience_sentiment', 'value_sentiment'] as const;
      const catCompResults = await Promise.all(
        competitors.map((comp) =>
          supabase
            .from('review_intelligence')
            .select('food_sentiment, service_sentiment, ambience_sentiment, value_sentiment')
            .eq('restaurant_id', comp.restaurantId)
            .eq('period_type', 'month')
            .order('period_start', { ascending: false })
            .limit(1)
        )
      );
      const categoryCompetitors: Record<string, CategoryCompetitor[]> = {};
      for (let ci = 0; ci < CATEGORIES.length; ci++) {
        const col = SENTIMENT_COLS[ci];
        categoryCompetitors[CATEGORIES[ci]] = competitors
          .map((c, i) => ({
            name: c.name,
            score: catCompResults[i].data?.[0]?.[col] != null
              ? sentimentToScore(Number(catCompResults[i].data![0][col]))
              : sentimentToScore(null),
            color: COMP_COLORS[i % COMP_COLORS.length],
            isOwn: c.isOwn,
          }))
          .sort((a, b) => b.score - a.score);
      }

      // --- subCategoriesFood ---
      const subFoodRaw = subFoodResult.data ?? [];
      const subCategoriesFood: SubCategoryItem[] = (subFoodRaw as any[]).map((r) => ({
        name: CATEGORY_LABEL_MAP[r.category] ?? { en: r.category, es: r.category },
        intensity: Number(r.avg_intensity ?? 0),
        mentions: Number(r.mentions ?? 0),
        trend: formatTrendDelta(Number(r.trend_delta ?? 0)),
      }));

      // --- subCategoriesService ---
      const subServiceRaw = subServiceResult.data ?? [];
      const subCategoriesService: SubCategoryItem[] = (subServiceRaw as any[]).map((r) => ({
        name: CATEGORY_LABEL_MAP[r.category] ?? { en: r.category, es: r.category },
        intensity: Number(r.avg_intensity ?? 0),
        mentions: Number(r.mentions ?? 0),
        trend: formatTrendDelta(Number(r.trend_delta ?? 0)),
      }));

      // --- subCategoriesAmbience ---
      const subAmbienceRaw = subAmbienceResult.data ?? [];
      const subCategoriesAmbience: SubCategoryItem[] = (subAmbienceRaw as any[]).map((r) => ({
        name: CATEGORY_LABEL_MAP[r.category] ?? { en: r.category, es: r.category },
        intensity: Number(r.avg_intensity ?? 0),
        mentions: Number(r.mentions ?? 0),
        trend: formatTrendDelta(Number(r.trend_delta ?? 0)),
      }));

      // --- subCategoriesValue ---
      const subValueRaw = subValueResult.data ?? [];
      const subCategoriesValue: SubCategoryItem[] = (subValueRaw as any[]).map((r) => ({
        name: CATEGORY_LABEL_MAP[r.category] ?? { en: r.category, es: r.category },
        intensity: Number(r.avg_intensity ?? 0),
        mentions: Number(r.mentions ?? 0),
        trend: formatTrendDelta(Number(r.trend_delta ?? 0)),
      }));

      // --- companyCards (own restaurants scorecards) ---
      // get_dashboard_competitors only returns primaryOwn + its competitors.
      // Secondary own restaurants (e.g. Pisco y Nazca) need independent FI queries.
      const secondaryOwnIds = ownRestaurants
        .filter((r) => !competitors.some((c) => c.restaurantId === r.id))
        .map((r) => r.id);

      const secondaryFiResults = await Promise.all(
        secondaryOwnIds.map((id) =>
          supabase.rpc('compute_flavor_index_range', {
            p_restaurant_id: id,
            p_start_date: from,
            p_end_date: to,
          })
        )
      );

      // Build a lookup for secondary own FI data
      const secondaryFiMap = new Map<string, any>();
      secondaryOwnIds.forEach((id, idx) => {
        const result = secondaryFiResults[idx];
        if (!result.error && result.data) {
          const fi = Array.isArray(result.data) ? result.data[0] : result.data;
          secondaryFiMap.set(id, fi);
        }
      });

      const companyCards: CompanyScorecard[] = [];
      for (let i = 0; i < ownRestaurants.length; i++) {
        const own = ownRestaurants[i];
        const comp = competitors.find((c) => c.restaurantId === own.id);
        const secFi = secondaryFiMap.get(own.id);

        const score = comp?.score ?? (secFi ? Number(secFi.flavor_index ?? 0) : null);
        const totalReviews = comp?.totalReviews ?? Number(secFi?.total_reviews ?? 0);
        const avgRating = comp?.avgRating ?? Number(secFi?.avg_rating ?? 0);

        companyCards.push({
          name: own.name,
          location: [own.city, own.state].filter(Boolean).join(', ') || 'Location TBD',
          score: totalReviews > 0 ? score : null,
          delta: comp?.delta ?? null,
          zone: (totalReviews > 0 && score !== null) ? getFlavorZone(score).zone as FlavorScoreZone : null,
          totalReviews,
          avgRating,
          isPrimary: i === 0,
        });
      }

      // --- companyTrend (monthly FI for own restaurants) ---
      const companyTrend: CompanyTrendDataPoint[] = [];
      // Fetch monthly RI for all own restaurants
      const ownIds = ownRestaurants.map((r) => r.id);
      const { data: ownMonthlyRows } = await supabase
        .from('review_intelligence')
        .select('period_start, flavor_index, restaurant_id')
        .in('restaurant_id', ownIds)
        .eq('period_type', 'month')
        .order('period_start', { ascending: true })
        .limit(24);

      // Build trend key lookup from companyCards (matches dashboard page's location name format)
      const trendKeyMap = new Map<string, string>();
      for (const card of companyCards) {
        const own = ownRestaurants.find((r) => r.name === card.name);
        if (own) {
          const key = card.name.replace('Steakhouse', '').trim() + ' — ' + card.location.split(',')[0];
          trendKeyMap.set(own.id, key);
        }
      }

      const companyTrendMap = new Map<string, CompanyTrendDataPoint>();
      for (const row of (ownMonthlyRows ?? []) as any[]) {
        const monthLabel = getMonthLabel(row.period_start);
        if (!companyTrendMap.has(monthLabel)) {
          companyTrendMap.set(monthLabel, { month: monthLabel });
        }
        const point = companyTrendMap.get(monthLabel)!;
        const trendKey = trendKeyMap.get(row.restaurant_id) ?? nameMap.get(row.restaurant_id) ?? row.restaurant_id;
        point[trendKey] = Number(row.flavor_index ?? 0);
      }
      companyTrend.push(...Array.from(companyTrendMap.values()));

      return {
        summary,
        categories,
        competitors,
        trendData,
        items,
        staff,
        alerts,
        monthlyScores,
        monthlyScoresByRestaurant,
        restaurantItems,
        staffYear: staffYear,
        categoryStats,
        strengths,
        opportunities,
        companyLocations,
        categoryTrend,
        categoryCompetitors,
        subCategoriesFood,
        subCategoriesService,
        subCategoriesAmbience,
        subCategoriesValue,
        companyCards,
        companyTrend,
        lowRatingPercent,
        lowRatingTotal,
        previousLowPercent,
      };
    },
    enabled: !!groupId && !!user?.id,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
  });

  return {
    data: data ?? null,
    isLoading,
    error: error ? (error as Error).message ?? 'Failed to load dashboard' : null,
  };
}

/** Format a trend delta number to string: +5, -1, 0 */
function formatTrendDelta(n: number): string {
  if (n > 0) return `+${n}`;
  if (n < 0) return `${n}`;
  return '0';
}
