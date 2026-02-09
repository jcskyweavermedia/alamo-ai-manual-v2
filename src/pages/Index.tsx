import { useNavigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { PageTitle, SectionTitle, BodyText, MetaText } from "@/components/ui/typography";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { BookOpen, Search, Sparkles, ArrowRight } from "lucide-react";
import { useLanguage } from "@/hooks/use-language";
import { useSearchNavigation } from "@/hooks/use-search-navigation";

const Index = () => {
  const navigate = useNavigate();
  const { language, setLanguage } = useLanguage();
  const handleSearch = useSearchNavigation();

  const quickLinks = [
    { 
      title: "Operations Manual", 
      description: "Access SOPs, food safety guidelines, and equipment procedures",
      icon: BookOpen,
      path: "/manual" 
    },
    { 
      title: "Search", 
      description: "Find specific procedures, temperatures, or protocols",
      icon: Search,
      path: "/search" 
    },
    { 
      title: "Ask AI", 
      description: "Get instant answers from the AI assistant",
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
          <PageTitle>Welcome to Alamo Prime</PageTitle>
          <BodyText className="text-muted-foreground">
            Your AI-powered restaurant operations assistant
          </BodyText>
        </div>

        {/* Quick Links */}
        <section className="space-y-lg">
          <SectionTitle>Quick Access</SectionTitle>
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
          <SectionTitle>System Status</SectionTitle>
          <Card>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <BodyText>All systems operational</BodyText>
                  <MetaText>Last synced: Just now</MetaText>
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
