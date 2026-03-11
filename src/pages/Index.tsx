import { useNavigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { PageTitle, SectionTitle, BodyText, MetaText } from "@/components/ui/typography";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { BookOpen, Search, Sparkles, ArrowRight } from "lucide-react";
import { useLanguage } from "@/hooks/use-language";
import { useSearchNavigation } from "@/hooks/use-search-navigation";

const STRINGS = {
  en: {
    heroTitle: 'Welcome to Alamo Prime',
    heroSubtitle: 'Your AI-powered restaurant operations assistant',
    quickAccess: 'Quick Access',
    manualTitle: 'Operations Manual',
    manualDesc: 'Access SOPs, food safety guidelines, and equipment procedures',
    searchTitle: 'Search',
    searchDesc: 'Find specific procedures, temperatures, or protocols',
    askAiTitle: 'Ask AI',
    askAiDesc: 'Get instant answers from the AI assistant',
    systemStatus: 'System Status',
    allOperational: 'All systems operational',
    lastSynced: 'Last synced: Just now',
  },
  es: {
    heroTitle: 'Bienvenido a Alamo Prime',
    heroSubtitle: 'Tu asistente de operaciones de restaurante con IA',
    quickAccess: 'Acceso R\u00e1pido',
    manualTitle: 'Manual de Operaciones',
    manualDesc: 'Accede a procedimientos, normas de seguridad alimentaria y uso de equipos',
    searchTitle: 'Buscar',
    searchDesc: 'Encuentra procedimientos, temperaturas o protocolos espec\u00edficos',
    askAiTitle: 'Preguntar a la IA',
    askAiDesc: 'Obt\u00e9n respuestas al instante del asistente de IA',
    systemStatus: 'Estado del Sistema',
    allOperational: 'Todos los sistemas funcionando',
    lastSynced: '\u00daltima sincronizaci\u00f3n: Ahora mismo',
  },
} as const;

const Index = () => {
  const navigate = useNavigate();
  const { language, setLanguage } = useLanguage();
  const handleSearch = useSearchNavigation();
  const t = STRINGS[language];

  const quickLinks = [
    {
      title: t.manualTitle,
      description: t.manualDesc,
      icon: BookOpen,
      path: "/manual"
    },
    {
      title: t.searchTitle,
      description: t.searchDesc,
      icon: Search,
      path: "/search"
    },
    {
      title: t.askAiTitle,
      description: t.askAiDesc,
      icon: Sparkles,
      path: "/ask"
    },
  ];

  return (
    <AppShell
      language={language}
      onLanguageChange={setLanguage}
      showSearch={true}
      onSearch={handleSearch}
      constrainContentWidth={true}
    >
      <div className="space-y-xl">
        <div className="space-y-sm">
          <PageTitle>{t.heroTitle}</PageTitle>
          <BodyText className="text-muted-foreground">
            {t.heroSubtitle}
          </BodyText>
        </div>

        {/* Quick Links */}
        <section className="space-y-lg">
          <SectionTitle>{t.quickAccess}</SectionTitle>
          <div className="grid gap-md">
            {quickLinks.map((link) => (
              <Card
                key={link.path}
                className="group cursor-pointer hover:shadow-elevated transition-shadow duration-transition"
                onClick={() => navigate(link.path)}
              >
                <CardContent className="flex items-center gap-lg">
                  <div className="p-md rounded-lg bg-primary/10 text-primary">
                    <link.icon className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base">{link.title}</CardTitle>
                    <MetaText>{link.description}</MetaText>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Status */}
        <section className="space-y-md">
          <SectionTitle>{t.systemStatus}</SectionTitle>
          <Card>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <BodyText>{t.allOperational}</BodyText>
                  <MetaText>{t.lastSynced}</MetaText>
                </div>
                <div className="h-3 w-3 rounded-full bg-success animate-pulse-subtle" />
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </AppShell>
  );
};

export default Index;
