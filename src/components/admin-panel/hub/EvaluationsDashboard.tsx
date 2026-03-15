// =============================================================================
// EvaluationsDashboard -- Scrollable list of recent AI evaluation results
// =============================================================================

import { MessageSquare, RefreshCw } from 'lucide-react';
import { useEvaluationsDashboard } from '@/hooks/use-evaluations-dashboard';
import { EvaluationCard } from './EvaluationCard';
import { ADMIN_STRINGS } from '../strings';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface EvaluationsDashboardProps {
  language: 'en' | 'es';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EvaluationsDashboard({ language }: EvaluationsDashboardProps) {
  const t = ADMIN_STRINGS[language];
  const { evaluations, isLoading, error, refetch } = useEvaluationsDashboard();

  return (
    <div className="bg-card rounded-2xl border border-black/[0.04] dark:border-white/[0.06] p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-orange-500" />
          <h3 className="text-sm font-semibold text-foreground">{t.aiFeedback}</h3>
        </div>
        {!isLoading && evaluations.length > 0 && (
          <button
            onClick={refetch}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-6">
          <p className="text-sm text-destructive mb-2">{error}</p>
          <button
            onClick={refetch}
            className="text-xs text-orange-500 hover:text-orange-600 font-medium"
          >
            {t.retry}
          </button>
        </div>
      ) : evaluations.length === 0 ? (
        <div className="text-center py-6">
          <MessageSquare className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">{t.noEvaluations}</p>
          <p className="text-xs text-muted-foreground/70 mt-1">{t.noEvaluationsHint}</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {evaluations.map(ev => (
            <EvaluationCard key={ev.id} evaluation={ev} />
          ))}
        </div>
      )}
    </div>
  );
}
