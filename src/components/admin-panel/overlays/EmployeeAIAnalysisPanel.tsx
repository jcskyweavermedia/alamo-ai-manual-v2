// =============================================================================
// EmployeeAIAnalysisPanel -- Full AI Analysis tab content
// Two-column: snapshot + strengths + areas (left), trajectory + timeline + prediction (right)
// =============================================================================

import {
  Scan,
  ThumbsUp,
  Target,
  Check,
  AlertTriangle,
  TrendingUp,
  Compass,
  Calendar,
  BookPlus,
  MessageSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AdminEmployee } from '@/types/admin-panel';
import { ProgressBar } from '../shared/ProgressBar';
import { AIGlowCard } from '../shared/AIGlowCard';
import { ADMIN_STRINGS } from '../strings';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface EmployeeAIAnalysisPanelProps {
  employee: AdminEmployee;
  language: 'en' | 'es';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EmployeeAIAnalysisPanel({ employee, language }: EmployeeAIAnalysisPanelProps) {
  const t = ADMIN_STRINGS[language];
  const ai = employee.aiAnalysis;

  if (!ai) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-sm text-muted-foreground">
          {language === 'es'
            ? 'Análisis de IA aún no disponible.'
            : 'No AI analysis available yet.'}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* ================================================================ */}
      {/* LEFT COLUMN */}
      {/* ================================================================ */}
      <div className="space-y-4">
        {/* Snapshot -- 2x3 grid */}
        <div className="rounded-2xl border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Scan className="h-4 w-4 text-orange-500" />
            <h3 className="font-semibold text-sm">{t.snapshot}</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {ai.snapshot.map((item) => (
              <div key={item.label} className="p-3 rounded-xl bg-muted">
                <div className="text-xs text-muted-foreground">{item.label}</div>
                <div className="text-sm font-semibold mt-0.5">{item.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Strengths -- green left border */}
        <div className="p-5 rounded-2xl bg-green-50/80 dark:bg-green-950/20 border border-green-200 dark:border-green-800 border-l-[3px] border-l-green-600">
          <div className="flex items-center gap-2 mb-3">
            <ThumbsUp className="h-4 w-4 text-green-600" />
            <span className="font-semibold text-sm text-green-600">{t.strengths}</span>
          </div>
          <div className="space-y-2">
            {ai.strengths.map((item, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-green-800 dark:text-green-300">
                <Check className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                <div>{item}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Areas to Develop -- amber left border */}
        <div className="p-5 rounded-2xl bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 border-l-[3px] border-l-amber-600">
          <div className="flex items-center gap-2 mb-3">
            <Target className="h-4 w-4 text-amber-600" />
            <span className="font-semibold text-sm text-amber-600">{t.areasToDevelop}</span>
          </div>
          <div className="space-y-3">
            {ai.areasToImprove.map((item, i) => (
              <div key={i}>
                <div className="flex items-start gap-2 text-sm text-amber-900 dark:text-amber-300">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                  <div>
                    <div>{item.title}</div>
                    <div className="text-xs mt-1 text-muted-foreground">{item.detail}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ================================================================ */}
      {/* RIGHT COLUMN */}
      {/* ================================================================ */}
      <div className="space-y-4">
        {/* Growth Trajectory */}
        <div className="rounded-2xl border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-blue-500" />
            <h3 className="font-semibold text-sm">{t.growthTrajectory}</h3>
          </div>
          <div className="text-xs font-semibold mb-3 text-muted-foreground uppercase tracking-wider">
            {employee.name} {language === 'es' ? 'vs. Ritmo Esperado' : 'vs. Expected Pace'}
          </div>
          <div className="space-y-3">
            {ai.growthTrajectory.map((item) => {
              const isProjected = item.actual === 0;
              return (
                <div key={item.week}>
                  <div className="flex justify-between text-xs mb-1">
                    <span>{item.week}</span>
                    {item.aheadLabel && (
                      <span className="font-semibold text-green-600">{item.aheadLabel}</span>
                    )}
                    {isProjected && (
                      <span className="text-muted-foreground">
                        {language === 'es' ? 'Proyectado' : 'Projected'}
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    {isProjected ? (
                      <div className="bg-muted rounded-full overflow-hidden" style={{ height: 6 }}>
                        <div
                          className="rounded-full border border-dashed border-blue-400 bg-blue-400/20"
                          style={{ width: `${item.expected}%`, height: '100%' }}
                        />
                      </div>
                    ) : (
                      <>
                        <ProgressBar value={item.actual} height={6} colorClass="bg-blue-500" />
                        {/* Expected pace marker */}
                        <div
                          className="absolute top-0 h-full w-0.5 bg-muted-foreground/30"
                          style={{ left: `${item.expected}%` }}
                        />
                      </>
                    )}
                  </div>
                  <div className="flex justify-between text-xs mt-1 text-muted-foreground">
                    <span>
                      {employee.name.split(' ')[0]}:{' '}
                      <span className="tabular-nums">{isProjected ? '--' : `${item.actual}%`}</span>
                    </span>
                    <span>
                      Expected: <span className="tabular-nums">~{item.expected}%</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* What's Next Timeline */}
        <div className="rounded-2xl border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Compass className="h-4 w-4 text-orange-500" />
            <h3 className="font-semibold text-sm">{t.whatsNext}</h3>
          </div>
          <div className="relative pl-6 space-y-4">
            {/* Vertical line */}
            <div className="absolute left-[11px] top-1 bottom-1 w-px bg-border" />

            {ai.whatsNext.map((step, stepIdx) => (
              <div key={stepIdx} className="relative">
                {/* Dot */}
                <div
                  className={cn(
                    'absolute -left-6 top-0.5 w-5 h-5 rounded-full flex items-center justify-center',
                    step.isActive ? 'bg-orange-500' : 'bg-muted',
                  )}
                >
                  <div
                    className={cn(
                      'w-2.5 h-2.5 rounded-full',
                      step.isActive ? 'bg-white' : 'bg-muted-foreground',
                    )}
                  />
                  {step.isActive && (
                    <div className="absolute inset-0 rounded-full bg-orange-500 animate-ping opacity-30" />
                  )}
                </div>
                <div
                  className={cn(
                    'text-xs font-bold mb-1',
                    step.isActive ? 'text-orange-500' : 'text-foreground',
                  )}
                >
                  {step.label}
                </div>
                <div className="space-y-1.5">
                  {step.items.map((item, itemIdx) => (
                    <div key={itemIdx} className="text-sm text-foreground">
                      {item.text}
                      {item.detail && (
                        <div className="text-xs text-muted-foreground">{item.detail}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AI Prediction */}
        <AIGlowCard title={t.aiPrediction}>
          <p className="text-sm leading-relaxed text-muted-foreground mb-3">
            {ai.prediction.summary}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-card/50">
              <div className="text-xs text-muted-foreground">{t.riskLevel}</div>
              <div
                className={cn(
                  'text-sm font-semibold mt-0.5',
                  ai.prediction.riskLevel === 'Low'
                    ? 'text-green-600'
                    : ai.prediction.riskLevel === 'Medium'
                      ? 'text-amber-600'
                      : 'text-red-600',
                )}
              >
                {ai.prediction.riskLevel}
              </div>
              <div className="text-xs text-muted-foreground">{ai.prediction.riskDetail}</div>
            </div>
            <div className="p-3 rounded-xl bg-card/50">
              <div className="text-xs text-muted-foreground">{t.potential}</div>
              <div className="text-sm font-semibold mt-0.5 text-orange-500">
                {ai.prediction.potential}
              </div>
              <div className="text-xs text-muted-foreground">{ai.prediction.potentialDetail}</div>
            </div>
          </div>
        </AIGlowCard>

        {/* Actions -- 3-column grid */}
        <div className="rounded-2xl border bg-card p-4">
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => {}}
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl text-xs font-medium border border-border text-muted-foreground transition-colors hover:bg-muted/50"
            >
              <Calendar className="h-4 w-4" />
              {t.schedule1on1}
            </button>
            <button
              type="button"
              onClick={() => {}}
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl text-xs font-medium border border-border text-muted-foreground transition-colors hover:bg-muted/50"
            >
              <BookPlus className="h-4 w-4" />
              {t.assignCourse}
            </button>
            <button
              type="button"
              onClick={() => {}}
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl text-xs font-medium border border-border text-muted-foreground transition-colors hover:bg-muted/50"
            >
              <MessageSquare className="h-4 w-4" />
              {t.addNote}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
