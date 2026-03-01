import { useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  UtensilsCrossed,
  Users,
  Layers,
  Building2,
} from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import { AppShell } from '@/components/layout/AppShell';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLanguage } from '@/hooks/use-language';
import { REVIEW_TABS, type ReviewDashboardData } from '@/types/reviews';
import { useReviewDashboard } from '@/hooks/use-review-dashboard';
import { COMP_COLORS } from '@/lib/review-transforms';
import { ExportButton } from '@/components/reviews/ExportButton';
import { AIChatButton } from '@/components/reviews/AIChatButton';
import { DateRangeSelector } from '@/components/reviews/DateRangeSelector';
import { RankingsCard } from '@/components/reviews/RankingsCard';
import { TrendSummaryCard } from '@/components/reviews/TrendSummaryCard';
import { FlavorIndexChart } from '@/components/reviews/FlavorIndexChart';
import { RestaurantRankList } from '@/components/reviews/RestaurantRankList';
import { StrengthsOpportunities } from '@/components/reviews/StrengthsOpportunities';
import { TopItemsGrid } from '@/components/reviews/TopItemsGrid';
import { StaffLeaderboard } from '@/components/reviews/StaffLeaderboard';
import { TimePillBar } from '@/components/reviews/TimePillBar';
import { CategoryTrendChart } from '@/components/reviews/CategoryTrendChart';
import { CategoryComparisonList } from '@/components/reviews/CategoryComparisonList';
import { SubCategoryBreakdown } from '@/components/reviews/SubCategoryBreakdown';
import { RestaurantScorecard } from '@/components/reviews/RestaurantScorecard';
import { CompanyTrendChart } from '@/components/reviews/CompanyTrendChart';
import { ReviewDashboardSkeleton } from '@/components/reviews/ReviewDashboardSkeleton';

// Icon map for tab pills
const tabIconMap = {
  BarChart3,
  UtensilsCrossed,
  Users,
  Layers,
  Building2,
} as const;

// ─── Food & Drink Tab Sub-Component ─────────────────────────────────────

const FOOD_FILTER_EN = [
  { value: 'all', label: 'All' },
  { value: 'food', label: 'Food' },
  { value: 'drinks', label: 'Drinks' },
];
const FOOD_FILTER_ES = [
  { value: 'all', label: 'Todos' },
  { value: 'food', label: 'Comida' },
  { value: 'drinks', label: 'Bebidas' },
];
const FOOD_TIME_EN = [
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'year', label: 'Year' },
];
const FOOD_TIME_ES = [
  { value: 'month', label: 'Mes' },
  { value: 'quarter', label: 'Trimestre' },
  { value: 'year', label: 'Año' },
];

function FoodTabContent({ data, isEs }: { data: ReviewDashboardData; isEs: boolean }) {
  const [foodFilter, setFoodFilter] = useState('all');
  const [foodTime, setFoodTime] = useState('month');

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <TimePillBar
          options={isEs ? FOOD_FILTER_ES : FOOD_FILTER_EN}
          value={foodFilter}
          onChange={setFoodFilter}
        />
        <div className="ml-auto">
          <TimePillBar
            options={isEs ? FOOD_TIME_ES : FOOD_TIME_EN}
            value={foodTime}
            onChange={setFoodTime}
          />
        </div>
      </div>
      <TopItemsGrid
        title={isEs ? 'Más Mencionados' : 'Top Mentioned'}
        subtitle={isEs ? 'artículos más elogiados por restaurante' : 'most praised items by restaurant'}
        restaurants={data.restaurantItems}
        itemKey="topItems"
        accentColor="#F97316"
        isEs={isEs}
      />
      <TopItemsGrid
        title={isEs ? 'Peor Mencionados' : 'Worst Mentioned'}
        subtitle={isEs ? 'artículos más criticados por restaurante' : 'most criticized items by restaurant'}
        restaurants={data.restaurantItems}
        itemKey="worstItems"
        accentColor="#EA580C"
        isEs={isEs}
      />
    </>
  );
}

// ─── Staff Tab Sub-Component ────────────────────────────────────────────

const STAFF_TIME_EN = [
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'year', label: 'Year' },
  { value: 'all', label: 'All Time' },
];
const STAFF_TIME_ES = [
  { value: 'month', label: 'Mes' },
  { value: 'quarter', label: 'Trimestre' },
  { value: 'year', label: 'Año' },
  { value: 'all', label: 'Histórico' },
];

function StaffTabContent({ data, isEs }: { data: ReviewDashboardData; isEs: boolean }) {
  const [staffTime, setStaffTime] = useState('month');

  return (
    <>
      <div className="flex items-center gap-3">
        <TimePillBar
          options={isEs ? STAFF_TIME_ES : STAFF_TIME_EN}
          value={staffTime}
          onChange={setStaffTime}
        />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <StaffLeaderboard
          title={isEs ? 'Top 10 Personal — Este Mes' : 'Top 10 Staff — This Month'}
          staff={data.staff}
          icon="more"
          showViewAll
          isEs={isEs}
        />
        <StaffLeaderboard
          title={isEs ? 'Tabla del Año' : 'Year Leaderboard'}
          staff={data.staffYear}
          icon="trophy"
          isEs={isEs}
        />
      </div>
    </>
  );
}

// ─── Categories Tab Sub-Component ───────────────────────────────────────

const CAT_SELECTOR_EN = [
  { value: 'food', label: 'Food Quality' },
  { value: 'service', label: 'Service' },
  { value: 'ambience', label: 'Ambience' },
  { value: 'value', label: 'Value' },
];
const CAT_SELECTOR_ES = [
  { value: 'food', label: 'Calidad de Comida' },
  { value: 'service', label: 'Servicio' },
  { value: 'ambience', label: 'Ambiente' },
  { value: 'value', label: 'Valor' },
];
const CAT_TIME_EN = [
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'year', label: 'Year' },
];
const CAT_TIME_ES = [
  { value: 'month', label: 'Mes' },
  { value: 'quarter', label: 'Trimestre' },
  { value: 'year', label: 'Año' },
];

function CategoriesTabContent({ data, isEs }: { data: ReviewDashboardData; isEs: boolean }) {
  const [catView, setCatView] = useState('food');
  const [catTime, setCatTime] = useState('month');

  const subItemsMap: Record<string, typeof data.subCategoriesFood> = {
    food: data.subCategoriesFood,
    service: data.subCategoriesService,
    ambience: data.subCategoriesAmbience,
    value: data.subCategoriesValue,
  };
  const subItems = subItemsMap[catView] ?? data.subCategoriesFood;
  const catLabel = isEs
    ? (CAT_SELECTOR_ES.find((c) => c.value === catView)?.label ?? 'Categoría')
    : (CAT_SELECTOR_EN.find((c) => c.value === catView)?.label ?? 'Category');

  const catRestaurants = [...data.competitors]
    .sort((a, b) => b.score - a.score)
    .map((c, i) => ({
      name: c.name,
      color: COMP_COLORS[i % COMP_COLORS.length],
      isOwn: c.isOwn,
    }));

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <TimePillBar
          options={isEs ? CAT_SELECTOR_ES : CAT_SELECTOR_EN}
          value={catView}
          onChange={setCatView}
        />
        <div className="ml-auto">
          <TimePillBar
            options={isEs ? CAT_TIME_ES : CAT_TIME_EN}
            value={catTime}
            onChange={setCatTime}
          />
        </div>
      </div>
      <CategoryTrendChart
        title={isEs ? `${catLabel} — Puntuación en el Tiempo` : `${catLabel} — Score Over Time`}
        data={data.categoryTrend[catView] ?? []}
        restaurants={catRestaurants}
        isEs={isEs}
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CategoryComparisonList
          title={isEs ? `${catLabel} — Comparación` : `${catLabel} — Competitor Comparison`}
          competitors={data.categoryCompetitors[catView] ?? []}
          isEs={isEs}
        />
        <SubCategoryBreakdown
          title={isEs ? 'Sub-Categorías' : 'Sub-Categories'}
          items={subItems}
          mentionsLabel={isEs ? 'menciones' : 'mentions'}
          isEs={isEs}
        />
      </div>
    </>
  );
}

// ─── Company Tab Sub-Component ──────────────────────────────────────────

const COMPANY_METRIC_EN = [
  { value: 'flavor', label: 'Flavor Index' },
  { value: 'food', label: 'Food' },
  { value: 'service', label: 'Service' },
  { value: 'ambience', label: 'Ambience' },
  { value: 'value', label: 'Value' },
];
const COMPANY_METRIC_ES = [
  { value: 'flavor', label: 'Índice de Sabor' },
  { value: 'food', label: 'Comida' },
  { value: 'service', label: 'Servicio' },
  { value: 'ambience', label: 'Ambiente' },
  { value: 'value', label: 'Valor' },
];
const COMPANY_TIME_EN = [
  { value: 'quarter', label: 'Quarter' },
  { value: 'year', label: 'Year' },
  { value: 'last-year', label: 'Last Year' },
];
const COMPANY_TIME_ES = [
  { value: 'quarter', label: 'Trimestre' },
  { value: 'year', label: 'Año' },
  { value: 'last-year', label: 'Año Pasado' },
];

function CompanyTabContent({ data, isEs }: { data: ReviewDashboardData; isEs: boolean }) {
  const [metric, setMetric] = useState('flavor');
  const [companyTime, setCompanyTime] = useState('quarter');

  const locations = data.companyCards
    .filter((c) => c.score !== null)
    .map((c) => ({ name: c.name.replace('Steakhouse', '').trim() + ' — ' + c.location.split(',')[0], color: '#F97316' }));

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <TimePillBar
          options={isEs ? COMPANY_METRIC_ES : COMPANY_METRIC_EN}
          value={metric}
          onChange={setMetric}
        />
        <div className="ml-auto">
          <TimePillBar
            options={isEs ? COMPANY_TIME_ES : COMPANY_TIME_EN}
            value={companyTime}
            onChange={setCompanyTime}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.companyCards.map((card) => (
          <RestaurantScorecard key={card.name} card={card} isEs={isEs} />
        ))}
      </div>
      <CompanyTrendChart
        title={isEs ? 'Tendencia — Restaurantes Propios' : 'Company Trend — Own Restaurants'}
        data={data.companyTrend}
        locations={locations}
        isEs={isEs}
      />
    </>
  );
}

// ─── Main Dashboard Component ───────────────────────────────────────────

const ReviewDashboard = () => {
  const { language, setLanguage } = useLanguage();
  const isEs = language === 'es';

  // Date range state (default: last 30 days)
  const [dateRange, setDateRange] = useState<DateRange>({
    from: new Date(2026, 0, 8),   // Jan 08
    to: new Date(2026, 1, 8),     // Feb 08
  });

  // Live data from Supabase (safe: defaults always set, but guard anyway)
  const safeFrom = dateRange.from ?? new Date(2026, 0, 8);
  const safeTo = dateRange.to ?? new Date(2026, 1, 8);
  const { data, isLoading, error } = useReviewDashboard(
    { from: safeFrom, to: safeTo },
    isEs ? 'es-ES' : 'en-US',
  );

  return (
    <AppShell
      language={language}
      onLanguageChange={setLanguage}
      showSearch={false}
      isAdmin={true}
      constrainContentWidth={false}
      headerLeft={
        <h1 className="text-xl font-bold tracking-tight whitespace-nowrap">
          {isEs ? 'Perspectivas de Reseñas' : 'Review Insights'}
        </h1>
      }
    >
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8 space-y-4" role="main" aria-label={isEs ? 'Panel de reseñas' : 'Review dashboard'}>
        {/* ─── Content ──────────────────────────────────────── */}
        {isLoading ? (
          <ReviewDashboardSkeleton />
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2" role="alert">
            <AlertCircle className="h-6 w-6 text-destructive" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">
              {isEs ? 'Error al cargar datos' : 'Failed to load data'}
            </p>
          </div>
        ) : !data ? (
          <ReviewDashboardSkeleton />
        ) : (
          <Tabs defaultValue="overview">
            {/* ─── Tab Pills + Date + Export — single row ──── */}
            <div className="flex items-center gap-3 flex-wrap">
              <TabsList className="inline-flex h-auto items-center gap-1 rounded-full bg-muted p-1 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {REVIEW_TABS.map((tab) => {
                  const Icon = tabIconMap[tab.icon as keyof typeof tabIconMap];
                  return (
                    <TabsTrigger
                      key={tab.id}
                      value={tab.id}
                      aria-label={isEs ? tab.label.es : tab.label.en}
                      className="rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap transition-all data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:font-semibold data-[state=active]:shadow-sm hover:text-foreground hover:bg-muted"
                    >
                      <Icon className="h-4 w-4 sm:hidden" aria-hidden="true" />
                      <span className="hidden sm:inline">
                        {isEs ? tab.label.es : tab.label.en}
                      </span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>
              <div className="flex items-center gap-2 ml-auto shrink-0">
                <DateRangeSelector
                  isEs={isEs}
                  dateRange={dateRange}
                  onDateRangeChange={setDateRange}
                />
                <ExportButton isEs={isEs} />
              </div>
            </div>

            {/* ─── Tab Content: Overview ─────────────────────── */}
            <TabsContent value="overview" className="mt-4 space-y-4">
              {/* Row 1: Rankings + Trend + Chart */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4">
                <div className="lg:col-span-3">
                  <RankingsCard
                    competitors={data.competitors}
                    companyLocations={data.companyLocations}
                    isEs={isEs}
                  />
                </div>
                <div className="lg:col-span-3">
                  <TrendSummaryCard
                    delta={data.summary.delta ?? 0}
                    currentScore={data.summary.score}
                    previousScore={data.summary.delta !== null ? data.summary.score - data.summary.delta : null}
                    lowRatingPercent={data.lowRatingPercent}
                    lowRatingTotal={data.lowRatingTotal}
                    previousLowPercent={data.previousLowPercent > 0 ? data.previousLowPercent : null}
                    isEs={isEs}
                  />
                </div>
                <div className="lg:col-span-6">
                  <FlavorIndexChart
                    monthlyScores={data.monthlyScores}
                    competitors={data.competitors}
                    isEs={isEs}
                  />
                </div>
              </div>
              {/* Row 2: Restaurant Rank + Strengths */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <RestaurantRankList
                  competitors={data.competitors}
                  isEs={isEs}
                />
                <StrengthsOpportunities
                  score={data.summary.score}
                  categoryStats={data.categoryStats}
                  strengths={data.strengths}
                  opportunities={data.opportunities}
                  isEs={isEs}
                />
              </div>
            </TabsContent>

            {/* ─── Tab Content: Food & Drink ──────────────────── */}
            <TabsContent value="food" className="mt-4 space-y-4">
              <FoodTabContent data={data} isEs={isEs} />
            </TabsContent>

            {/* ─── Tab Content: Staff ─────────────────────────── */}
            <TabsContent value="staff" className="mt-4 space-y-4">
              <StaffTabContent data={data} isEs={isEs} />
            </TabsContent>

            {/* ─── Tab Content: Categories ────────────────────── */}
            <TabsContent value="categories" className="mt-4 space-y-4">
              <CategoriesTabContent data={data} isEs={isEs} />
            </TabsContent>

            {/* ─── Tab Content: Compete ───────────────────────── */}
            <TabsContent value="company" className="mt-4 space-y-4">
              <CompanyTabContent data={data} isEs={isEs} />
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* ─── AI FAB (outside content flow) ─────────────── */}
      <AIChatButton isEs={isEs} />
    </AppShell>
  );
};

export default ReviewDashboard;
