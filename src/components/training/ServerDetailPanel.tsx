import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { CompetencyBadge } from './CompetencyBadge';
import { CheckCircle2, XCircle, Circle, Loader2, Sparkles, AlertTriangle, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TeamMemberProgress } from '@/types/dashboard';

interface ServerDetailPanelProps {
  member: TeamMemberProgress | null;
  language: 'en' | 'es';
}

export function ServerDetailPanel({ member, language }: ServerDetailPanelProps) {
  const { permissions } = useAuth();
  const groupId = permissions?.memberships?.[0]?.groupId ?? null;
  const queryClient = useQueryClient();
  const isEs = language === 'es';

  const [managerNotes, setManagerNotes] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [isGeneratingInsight, setIsGeneratingInsight] = useState(false);
  const [insightResult, setInsightResult] = useState<Record<string, unknown> | null>(null);

  // Fetch section-level detail for selected member
  const { data: detail, isLoading } = useQuery({
    queryKey: ['member-detail', member?.userId, groupId],
    queryFn: async () => {
      if (!member?.userId || !groupId) return null;

      const [progressRes, evalsRes, convoRes] = await Promise.all([
        supabase
          .from('section_progress')
          .select('*, course_sections(title_en, title_es, course_id)')
          .eq('user_id', member.userId),
        supabase
          .from('evaluations')
          .select('id, section_id, competency_level, manager_feedback, manager_notes, eval_type, created_at')
          .eq('user_id', member.userId)
          .order('created_at', { ascending: false }),
        supabase
          .from('course_conversations')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', member.userId),
      ]);

      // Get latest course_final evaluation
      const courseFinal = (evalsRes.data ?? []).find(
        (e: Record<string, unknown>) => e.eval_type === 'course_final'
      );

      // Load manager notes from latest evaluation
      const latestNotes = courseFinal?.manager_notes || '';

      return {
        sections: progressRes.data ?? [],
        evaluations: evalsRes.data ?? [],
        conversationCount: convoRes.count ?? 0,
        courseFinal,
        existingNotes: latestNotes as string,
      };
    },
    enabled: !!member?.userId && !!groupId,
    staleTime: 2 * 60 * 1000,
  });

  // Initialize notes from DB
  const notesValue = managerNotes || detail?.existingNotes || '';

  if (!member) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground p-8">
        {isEs
          ? 'Selecciona un miembro del equipo'
          : 'Select a team member to view details'}
      </div>
    );
  }

  const handleSaveNotes = async () => {
    if (!detail?.courseFinal?.id) return;
    setIsSavingNotes(true);
    try {
      await supabase
        .from('evaluations')
        .update({ manager_notes: notesValue })
        .eq('id', detail.courseFinal.id);
      queryClient.invalidateQueries({ queryKey: ['member-detail'] });
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleGenerateInsight = async () => {
    if (!groupId) return;
    setIsGeneratingInsight(true);
    setInsightResult(null);
    try {
      const { data, error } = await supabase.functions.invoke(
        'course-evaluate',
        {
          body: {
            action: 'course_final',
            target_user_id: member.userId,
            language,
            groupId,
          },
        }
      );
      if (error) throw error;
      if (data?.error) throw new Error(data.message || data.error);
      setInsightResult(data);
      queryClient.invalidateQueries({ queryKey: ['member-detail'] });
    } catch (err) {
      console.error('[ServerDetailPanel] Generate insight error:', err);
    } finally {
      setIsGeneratingInsight(false);
    }
  };

  const sections = detail?.sections ?? [];
  const failedSections = member.failedSections ?? [];

  return (
    <div className="space-y-5 p-1">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold">
          {member.fullName || member.email}
        </h3>
        <p className="text-xs text-muted-foreground">
          {member.role} &middot;{' '}
          {member.lastActiveAt
            ? `${isEs ? 'Activo' : 'Active'}: ${new Date(member.lastActiveAt).toLocaleDateString()}`
            : isEs
              ? 'Sin actividad'
              : 'No activity'}
        </p>
        <div className="flex items-center gap-3 mt-2">
          <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${member.overallProgressPercent}%` }}
            />
          </div>
          <span className="text-sm font-medium">
            {member.overallProgressPercent}%
          </span>
          {member.averageQuizScore != null && (
            <span className="text-xs text-muted-foreground">
              Quiz: {member.averageQuizScore}%
            </span>
          )}
        </div>
      </div>

      {/* Section Progress */}
      {isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div>
            <h4 className="text-sm font-medium mb-2">
              {isEs ? 'Progreso por Seccion' : 'Section Progress'}
            </h4>
            <div className="space-y-1">
              {sections.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  {isEs ? 'Sin progreso aun' : 'No progress yet'}
                </p>
              )}
              {sections.map((sp: Record<string, unknown>) => {
                const cs = sp.course_sections as Record<string, unknown> | null;
                const title = isEs && cs?.title_es
                  ? (cs.title_es as string)
                  : (cs?.title_en as string) || 'Unknown';
                const status = sp.status as string;
                const quizScore = sp.quiz_score as number | null;

                return (
                  <div
                    key={sp.id as string}
                    className="flex items-center gap-2 py-1.5 text-sm"
                  >
                    {status === 'completed' ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                    ) : status === 'in_progress' ? (
                      <Circle className="h-4 w-4 text-blue-500 shrink-0" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground/30 shrink-0" />
                    )}
                    <span className="flex-1 truncate">{title}</span>
                    {quizScore != null && (
                      <span
                        className={cn(
                          'text-xs',
                          sp.quiz_passed
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-500'
                        )}
                      >
                        {quizScore}%
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Failed Sections */}
          {failedSections.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                {isEs ? 'Secciones Reprobadas' : 'Failed Sections'}
              </h4>
              <div className="space-y-1">
                {failedSections.map((title, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 py-1 text-sm"
                  >
                    <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                    <span className="text-muted-foreground">{title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Conversations */}
          <div className="flex items-center gap-2 text-sm">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <span>
              {detail?.conversationCount ?? 0}{' '}
              {isEs ? 'sesiones de aprendizaje' : 'learning sessions'}
            </span>
          </div>

          {/* Manager Notes */}
          <div>
            <h4 className="text-sm font-medium mb-2">
              {isEs ? 'Notas del Manager' : 'Manager Notes'}
            </h4>
            <Textarea
              value={notesValue}
              onChange={(e) => setManagerNotes(e.target.value)}
              placeholder={isEs ? 'Agregar notas...' : 'Add notes...'}
              rows={3}
              className="text-sm"
            />
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              disabled={isSavingNotes || !detail?.courseFinal?.id}
              onClick={handleSaveNotes}
            >
              {isSavingNotes ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
              ) : null}
              {isEs ? 'Guardar Notas' : 'Save Notes'}
            </Button>
          </div>

          {/* Generate AI Insight */}
          <div>
            <Button
              onClick={handleGenerateInsight}
              disabled={isGeneratingInsight}
              className="w-full"
            >
              {isGeneratingInsight ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              {isEs ? 'Generar Evaluacion AI' : 'Generate AI Insight'}
            </Button>

            {insightResult && (
              <div className="mt-3 rounded-lg border p-3 space-y-2 text-sm animate-in fade-in slide-in-from-bottom-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    {isEs ? 'Nivel' : 'Level'}:
                  </span>
                  <CompetencyBadge
                    level={insightResult.competency_level as 'novice' | 'competent' | 'proficient' | 'expert'}
                    language={language}
                  />
                  {insightResult.cached && (
                    <span className="text-[10px] text-muted-foreground">
                      ({isEs ? 'en cache' : 'cached'})
                    </span>
                  )}
                </div>

                {insightResult.manager_feedback && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">
                      {isEs ? 'Brechas' : 'Gaps'}:
                    </p>
                    <ul className="text-xs space-y-0.5 pl-3">
                      {((insightResult.manager_feedback as Record<string, unknown>)
                        .competency_gaps as string[] || []).map((gap, i) => (
                        <li key={i} className="list-disc">{gap}</li>
                      ))}
                    </ul>
                    <p className="text-xs font-medium text-muted-foreground mt-1">
                      {isEs ? 'Acciones' : 'Actions'}:
                    </p>
                    <ul className="text-xs space-y-0.5 pl-3">
                      {((insightResult.manager_feedback as Record<string, unknown>)
                        .recommended_actions as string[] || []).map((action, i) => (
                        <li key={i} className="list-disc">{action}</li>
                      ))}
                    </ul>
                    <p className="text-xs mt-1">
                      <span className="font-medium text-muted-foreground">
                        {isEs ? 'Riesgo' : 'Risk'}:
                      </span>{' '}
                      {(insightResult.manager_feedback as Record<string, unknown>).risk_level as string}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
