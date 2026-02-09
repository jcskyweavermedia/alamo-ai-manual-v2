import { AppShell } from "@/components/layout/AppShell";
import { PageTitle } from "@/components/ui/typography";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Bell } from "lucide-react";
import { useLanguage } from "@/hooks/use-language";
import { 
  ProfileHeader, 
  LanguagePreference, 
  ThemePreference,
  SignOutButton 
} from "@/components/profile";

const Profile = () => {
  const { language, setLanguage } = useLanguage();

  return (
    <AppShell
      language={language}
      onLanguageChange={setLanguage}
      showSearch={false}
    >
      <div className="space-y-xl">
        <PageTitle>Profile</PageTitle>

        {/* User Info */}
        <ProfileHeader />

        {/* Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-lg">
            {/* Language Preference - syncs to database */}
            <LanguagePreference />
            
            {/* Theme Preference - Light/Dark/System */}
            <ThemePreference />
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-md">
                <Bell className="h-5 w-5 text-muted-foreground" />
                <Label htmlFor="notifications">Notifications</Label>
              </div>
              <Switch
                id="notifications"
                defaultChecked
              />
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <Card>
          <CardContent>
            <SignOutButton />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
};

export default Profile;
