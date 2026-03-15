// =============================================================================
// PeopleView -- Full layout for the People tab
// =============================================================================

import { Users } from 'lucide-react';
import { ADMIN_STRINGS } from '@/components/admin-panel/strings';
import { MOCK_LEADERBOARD, MOCK_CONTESTS } from '@/data/mock-admin-panel';
import { useAdminEmployees } from '@/hooks/use-admin-employees';
import { usePeopleHeroStats } from '@/hooks/use-admin-hero-stats';
import { HeroBanner } from '@/components/admin-panel/HeroBanner';
import { NewHiresCard } from '@/components/admin-panel/people/NewHiresCard';
import { NeedsAttentionCard } from '@/components/admin-panel/people/NeedsAttentionCard';
import { AllStaffCard } from '@/components/admin-panel/people/AllStaffCard';
import { LeaderboardCard } from '@/components/admin-panel/people/LeaderboardCard';
import { ActiveContestCard } from '@/components/admin-panel/people/ActiveContestCard';
import { AIQuickInsightCard } from '@/components/admin-panel/people/AIQuickInsightCard';

interface PeopleViewProps {
  language: 'en' | 'es';
  onEmployeeClick?: (employeeId: string) => void;
}

export function PeopleView({ language, onEmployeeClick }: PeopleViewProps) {
  const t = ADMIN_STRINGS[language];
  const { employees, isLoading: employeesLoading } = useAdminEmployees();
  const { stats: heroStats, isLoading: statsLoading } = usePeopleHeroStats(language);

  if (employeesLoading) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="h-32 bg-muted rounded-2xl" />
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-5">
          <div className="space-y-5">
            <div className="h-48 bg-muted rounded-2xl" />
            <div className="h-48 bg-muted rounded-2xl" />
          </div>
          <div className="h-64 bg-muted rounded-2xl" />
        </div>
      </div>
    );
  }

  if (employees.length === 0 && !employeesLoading) {
    return (
      <div className="space-y-5">
        <HeroBanner icon={Users} title={t.heroTitle} subtitle={t.heroSubtitle} stats={heroStats} />
        <div className="flex flex-col items-center justify-center min-h-[200px] bg-card rounded-2xl border border-black/[0.04] dark:border-white/[0.06]">
          <Users className="h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">
            {language === 'en' ? 'No employees found' : 'No se encontraron empleados'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Hero banner */}
      <HeroBanner
        icon={Users}
        title={t.heroTitle}
        subtitle={t.heroSubtitle}
        stats={heroStats}
      />

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-5">
        {/* Left column */}
        <div className="space-y-5">
          <NewHiresCard
            employees={employees}
            language={language}
            onEmployeeClick={onEmployeeClick}
          />
          <NeedsAttentionCard
            employees={employees}
            language={language}
            onEmployeeClick={onEmployeeClick}
          />
          <AllStaffCard
            employees={employees}
            language={language}
            onEmployeeClick={onEmployeeClick}
          />
        </div>

        {/* Right column */}
        <div className="space-y-5">
          <LeaderboardCard employees={MOCK_LEADERBOARD} language={language} />
          {MOCK_CONTESTS[0] && (
            <ActiveContestCard contest={MOCK_CONTESTS[0]} language={language} />
          )}
          <AIQuickInsightCard language={language} />
        </div>
      </div>
    </div>
  );
}
