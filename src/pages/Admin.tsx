import { AppShell } from "@/components/layout/AppShell";
import { PageTitle, SectionTitle, MetaText } from "@/components/ui/typography";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
// Icons replaced with emojis
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/hooks/use-language";
import { useSearchNavigation } from "@/hooks/use-search-navigation";

const Admin = () => {
  const { language, setLanguage } = useLanguage();
  const handleSearch = useSearchNavigation();
  const navigate = useNavigate();
  const isEs = language === 'es';

  const stats = [
    { label: "Active Users", value: "24", emoji: "👥" },
    { label: "Documents", value: "156", emoji: "📄" },
    { label: "AI Queries Today", value: "89", emoji: "🤖" },
  ];

  return (
    <AppShell
      language={language}
      onLanguageChange={setLanguage}
      showSearch={true}
      onSearch={handleSearch}
      isAdmin={true}
    >
      <div className="space-y-xl">
        <div className="flex items-center justify-between">
          <PageTitle>Admin Dashboard</PageTitle>
          <StatusBadge variant="info">Admin</StatusBadge>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-md">
          {stats.map((stat) => (
            <Card key={stat.label}>
              <CardContent>
                <div className="flex items-center gap-md">
                  <span className="text-[28px] leading-none">{stat.emoji}</span>
                  <div>
                    <MetaText>{stat.label}</MetaText>
                    <SectionTitle>{stat.value}</SectionTitle>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Training Dashboard Card */}
        <Card
          className="cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => navigate('/admin/training')}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="text-[20px] leading-none">🎓</span>
              {isEs ? 'Dashboard de Entrenamiento' : 'Training Dashboard'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MetaText>
              {isEs
                ? 'Ver progreso del equipo, gestionar rollouts y detectar cambios de contenido.'
                : 'View team progress, manage rollouts, and detect content changes.'}
            </MetaText>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="text-[20px] leading-none">⚙️</span>
              {isEs ? 'Acciones Rapidas' : 'Quick Actions'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-sm">
            <MetaText>
              {isEs
                ? 'Gestionar usuarios, documentos y configuracion del sistema.'
                : 'Manage users, documents, and system settings.'}
            </MetaText>
            <MetaText className="text-warning-foreground">
              {isEs
                ? 'Funcionalidad completa en Fase 5.'
                : 'Full admin functionality coming in Phase 5.'}
            </MetaText>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
};

export default Admin;
