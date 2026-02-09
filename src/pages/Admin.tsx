import { AppShell } from "@/components/layout/AppShell";
import { PageTitle, SectionTitle, MetaText } from "@/components/ui/typography";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Users, FileText, BarChart3, Settings } from "lucide-react";
import { useLanguage } from "@/hooks/use-language";
import { useSearchNavigation } from "@/hooks/use-search-navigation";

const Admin = () => {
  const { language, setLanguage } = useLanguage();
  const handleSearch = useSearchNavigation();

  const stats = [
    { label: "Active Users", value: "24", icon: Users },
    { label: "Documents", value: "156", icon: FileText },
    { label: "AI Queries Today", value: "89", icon: BarChart3 },
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
                  <div className="p-md rounded-lg bg-primary/10">
                    <stat.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <MetaText>{stat.label}</MetaText>
                    <SectionTitle>{stat.value}</SectionTitle>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-sm">
            <MetaText>Manage users, documents, and system settings.</MetaText>
            <MetaText className="text-warning-foreground">
              Full admin functionality coming in Phase 5.
            </MetaText>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
};

export default Admin;
