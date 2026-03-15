// =============================================================================
// AIHubView -- Full layout for the AI Hub tab
// =============================================================================

import { useState, useMemo } from 'react';
import { Sparkles } from 'lucide-react';
import { ADMIN_STRINGS } from '../strings';
import {
  MOCK_CONTESTS,
  MOCK_GROWTH_TIERS,
  MOCK_TIMELINE,
  MOCK_REWARDS,
} from '@/data/mock-admin-panel';
import { useHubHeroStats } from '@/hooks/use-admin-hero-stats';
import type { AISuggestion } from '@/types/admin-panel';
import { HeroBanner } from '../HeroBanner';
import { WeeklyUpdateCard } from './WeeklyUpdateCard';
import { AISuggestionsCard } from './AISuggestionsCard';
import { ActiveContestsCard } from './ActiveContestsCard';
import { GrowthPathsCard } from './GrowthPathsCard';
import { WhatsNextTimeline } from './WhatsNextTimeline';
import { RewardBankCard } from './RewardBankCard';
import { AIAskBar } from './AIAskBar';
import { ManagerAIChat } from './ManagerAIChat';
import { EvaluationsDashboard } from './EvaluationsDashboard';
import { WeeklyUpdateOverlay } from '../overlays/WeeklyUpdateOverlay';
import { useAskTrainingManager } from '@/hooks/use-ask-training-manager';
import { useTrainingActions } from '@/hooks/use-training-actions';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AIHubViewProps {
  language: 'en' | 'es';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Defaults for mapping TrainingAction → AISuggestion visual properties
// ---------------------------------------------------------------------------

const ACTION_TYPE_DEFAULTS: Record<
  string,
  { icon: string; iconBg: string; iconColor: string; borderColor: string }
> = {
  assign_course: {
    icon: 'Wine',
    iconBg: 'bg-purple-100',
    iconColor: 'text-purple-600',
    borderColor: 'border-purple-200',
  },
  launch_contest: {
    icon: 'Trophy',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    borderColor: 'border-amber-200',
  },
  nudge: {
    icon: 'Bell',
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
    borderColor: 'border-red-200',
  },
};

const DEFAULT_VISUALS = {
  icon: 'BookOpen',
  iconBg: 'bg-blue-100',
  iconColor: 'text-blue-600',
  borderColor: 'border-black/[0.04] dark:border-white/[0.06]',
};

export function AIHubView({ language }: AIHubViewProps) {
  const t = ADMIN_STRINGS[language];
  const [isWeeklyOpen, setIsWeeklyOpen] = useState(false);
  const { stats: hubHeroStats } = useHubHeroStats(language);
  const { messages, isLoading, sendMessage } = useAskTrainingManager();
  const { actions, isLoading: actionsLoading, resolveAction } = useTrainingActions();

  // Map TrainingAction[] → AISuggestion[] for the card component
  const suggestions: AISuggestion[] = useMemo(
    () =>
      actions.map((a) => {
        const visuals = ACTION_TYPE_DEFAULTS[a.action_type] ?? DEFAULT_VISUALS;
        const rawActions = a.display_data?.actions ?? ['Approve', 'Skip'];
        return {
          id: a.id,
          type: (a.action_type as AISuggestion['type']) || 'nudge',
          icon: visuals.icon,
          iconBg: visuals.iconBg,
          iconColor: visuals.iconColor,
          borderColor: visuals.borderColor,
          title: a.display_data?.title || 'Training Action',
          description: a.display_data?.description || '',
          actions: rawActions.map((label, i) => ({
            label,
            variant: (i === 0 ? 'primary' : i === rawActions.length - 1 ? 'ghost' : 'secondary') as
              | 'primary'
              | 'secondary'
              | 'ghost',
          })),
        };
      }),
    [actions],
  );

  // Handle action button clicks from SuggestionItem
  const handleSuggestionAction = (suggestionId: string, actionLabel: string) => {
    const approveLabels = ['Approve', 'Aprobar', 'Send Nudge', 'Enviar Recordatorio', 'Nudge'];
    const skipLabels = ['Skip', 'Omitir'];

    if (approveLabels.includes(actionLabel)) {
      resolveAction(suggestionId, 'approved');
    } else if (skipLabels.includes(actionLabel)) {
      resolveAction(suggestionId, 'skipped');
    }
    // Other actions (Edit, Adjust Reward, etc.) are not resolved -- future feature
  };

  return (
    <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      {/* Hero banner */}
      <HeroBanner
        icon={Sparkles}
        title={t.aiTrainingManager}
        subtitle={t.aiHubSubtitle}
        stats={hubHeroStats}
      />

      {/* Weekly update card */}
      <WeeklyUpdateCard
        onClick={() => setIsWeeklyOpen(true)}
        language={language}
      />

      {/* Two-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left column */}
        <div className="space-y-5">
          <AISuggestionsCard
            suggestions={suggestions}
            language={language}
            isLoading={actionsLoading}
            onAction={handleSuggestionAction}
          />
          <ActiveContestsCard
            contests={MOCK_CONTESTS}
            language={language}
          />
        </div>

        {/* Right column */}
        <div className="space-y-5">
          <GrowthPathsCard
            tiers={MOCK_GROWTH_TIERS}
            language={language}
          />
          <WhatsNextTimeline
            items={MOCK_TIMELINE}
            language={language}
          />
          <RewardBankCard
            rewards={MOCK_REWARDS}
            language={language}
          />
        </div>
      </div>

      {/* Manager AI Chat */}
      <ManagerAIChat
        messages={messages}
        isLoading={isLoading}
        language={language}
      />

      {/* AI Ask Bar (wired to training manager) */}
      <AIAskBar
        language={language}
        onSubmit={sendMessage}
        isLoading={isLoading}
      />

      {/* Evaluations Dashboard */}
      <EvaluationsDashboard language={language} />

      {/* Weekly Update Overlay */}
      <WeeklyUpdateOverlay
        isOpen={isWeeklyOpen}
        onClose={() => setIsWeeklyOpen(false)}
        language={language}
      />
    </div>
  );
}
