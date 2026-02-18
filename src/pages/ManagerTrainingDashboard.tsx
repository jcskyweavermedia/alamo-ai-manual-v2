import { useState } from 'react';
import { Loader2, AlertCircle, AlertTriangle } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/hooks/use-language';
import { useSearchNavigation } from '@/hooks/use-search-navigation';
import { useTeamTraining } from '@/hooks/use-team-training';
import { useRollouts } from '@/hooks/use-rollouts';
import { useContentChanges } from '@/hooks/use-content-changes';
import { DashboardStats } from '@/components/training/DashboardStats';
import { TeamProgressTable } from '@/components/training/TeamProgressTable';
import { ServerDetailPanel } from '@/components/training/ServerDetailPanel';
import { RolloutCard } from '@/components/training/RolloutCard';
import { RolloutWizard } from '@/components/training/RolloutWizard';
import { Button } from '@/components/ui/button';

const ManagerTrainingDashboard = () => {
  const { language, setLanguage } = useLanguage();
  const handleSearch = useSearchNavigation();
  const { members, courseStats, summary, isLoading, error } = useTeamTraining();
  const { rollouts } = useRollouts();
  const { changes, acknowledge } = useContentChanges();
  const isEs = language === 'es';

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [showWizard, setShowWizard] = useState(false);

  const selectedMember =
    members.find((m) => m.userId === selectedUserId) ?? null;

  return (
    <AppShell
      language={language}
      onLanguageChange={setLanguage}
      showSearch={true}
      onSearch={handleSearch}
      isAdmin={true}
    >
      <div className="space-y-4">
        <h1 className="text-xl font-bold">
          {isEs ? 'Dashboard de Entrenamiento' : 'Training Dashboard'}
        </h1>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2">
            <AlertCircle className="h-6 w-6 text-destructive" />
            <p className="text-sm text-muted-foreground">
              {isEs ? 'Error al cargar datos' : 'Failed to load data'}
            </p>
          </div>
        ) : (
          <Tabs defaultValue="overview">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">
                {isEs ? 'Resumen' : 'Overview'}
              </TabsTrigger>
              <TabsTrigger value="by-server">
                {isEs ? 'Por Servidor' : 'By Server'}
              </TabsTrigger>
              <TabsTrigger value="rollouts">
                Rollouts
              </TabsTrigger>
            </TabsList>

            {/* ─── OVERVIEW TAB ─────────────────────────────────── */}
            <TabsContent value="overview" className="space-y-4 mt-4">
              <DashboardStats summary={summary} language={language} />

              {/* Content changes alert */}
              {changes.length > 0 && (
                <Card className="border-amber-200 dark:border-amber-800">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300">
                      <AlertTriangle className="h-4 w-4" />
                      {isEs ? 'Contenido Actualizado' : 'Content Updated'}
                      <Badge variant="secondary">{changes.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {changes.map((change) => (
                      <div
                        key={`${change.sourceTable}-${change.sourceId}`}
                        className="flex justify-between items-center py-2 border-b last:border-0"
                      >
                        <div>
                          <p className="text-sm font-medium">{change.sectionTitle}</p>
                          <p className="text-xs text-muted-foreground">
                            {change.affectedStudents}{' '}
                            {isEs
                              ? 'completaron con version anterior'
                              : 'completed with old version'}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            acknowledge(
                              change.sourceTable,
                              change.sourceId,
                              change.newHash
                            )
                          }
                        >
                          {isEs ? 'Reconocer' : 'Acknowledge'}
                        </Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Course completion overview */}
              {courseStats.length > 0 && (
                <div className="border rounded-lg p-4">
                  <h3 className="text-sm font-medium mb-3">
                    {isEs ? 'Cursos' : 'Course Completion'}
                  </h3>
                  <div className="space-y-3">
                    {courseStats.map((cs) => (
                      <div key={cs.courseId} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="truncate">{cs.courseTitle}</span>
                          <span className="text-muted-foreground shrink-0 ml-2">
                            {cs.completedCount}/{cs.enrolledCount}{' '}
                            ({cs.completionPercent}%)
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${cs.completionPercent}%` }}
                          />
                        </div>
                        {cs.averageScore != null && (
                          <p className="text-[11px] text-muted-foreground">
                            {isEs ? 'Promedio' : 'Avg score'}: {cs.averageScore}%
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* ─── BY SERVER TAB ────────────────────────────────── */}
            <TabsContent value="by-server" className="mt-4">
              {/* iPad: split view */}
              <div className="hidden md:grid md:grid-cols-[2fr_3fr] md:gap-4">
                <TeamProgressTable
                  members={members}
                  selectedUserId={selectedUserId}
                  onSelectUser={setSelectedUserId}
                  language={language}
                />
                <div className="border rounded-lg p-4 min-h-[400px]">
                  <ServerDetailPanel
                    member={selectedMember}
                    language={language}
                  />
                </div>
              </div>

              {/* Phone: table + sheet */}
              <div className="md:hidden">
                <TeamProgressTable
                  members={members}
                  selectedUserId={null}
                  onSelectUser={(id) => {
                    setSelectedUserId(id);
                    setSheetOpen(true);
                  }}
                  language={language}
                />
                <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                  <SheetContent side="bottom" className="h-[85vh] overflow-y-auto">
                    <ServerDetailPanel
                      member={selectedMember}
                      language={language}
                    />
                  </SheetContent>
                </Sheet>
              </div>
            </TabsContent>

            {/* ─── ROLLOUTS TAB ─────────────────────────────────── */}
            <TabsContent value="rollouts" className="mt-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">
                  {isEs ? 'Rollouts de Entrenamiento' : 'Training Rollouts'}
                </h2>
                <Button size="sm" onClick={() => setShowWizard(true)}>
                  {isEs ? 'Nuevo Rollout' : 'New Rollout'}
                </Button>
              </div>

              {rollouts.length === 0 ? (
                <div className="text-center py-12 text-sm text-muted-foreground">
                  {isEs ? 'No hay rollouts aun' : 'No rollouts yet'}
                </div>
              ) : (
                <div className="space-y-3">
                  {rollouts.map((r) => (
                    <RolloutCard
                      key={r.id}
                      rollout={r}
                      onClick={() => {}}
                      language={language}
                    />
                  ))}
                </div>
              )}

              <RolloutWizard
                open={showWizard}
                onClose={() => setShowWizard(false)}
              />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AppShell>
  );
};

export default ManagerTrainingDashboard;
