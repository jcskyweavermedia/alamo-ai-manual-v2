/**
 * LanguagePreference
 * 
 * Language selection component that syncs with useLanguage hook
 * and persists to the database via useProfile.
 */

import { Globe } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useLanguage } from '@/hooks/use-language';
import { useProfile } from '@/hooks/use-profile';
import { cn } from '@/lib/utils';

interface LanguagePreferenceProps {
  className?: string;
}

export function LanguagePreference({ className }: LanguagePreferenceProps) {
  const { language } = useLanguage();
  const { updateLanguage, isLoading } = useProfile();

  const handleLanguageChange = (value: string) => {
    if (value === 'en' || value === 'es') {
      updateLanguage(value);
    }
  };

  return (
    <div className={cn('flex items-center justify-between', className)}>
      <div className="flex items-center gap-md">
        <Globe className="h-5 w-5 text-muted-foreground" />
        <Label>Language</Label>
      </div>
      <ToggleGroup
        type="single"
        value={language}
        onValueChange={handleLanguageChange}
        disabled={isLoading}
        className="gap-0"
      >
        <ToggleGroupItem
          value="en"
          aria-label="English"
          className="rounded-r-none border border-r-0 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
        >
          EN
        </ToggleGroupItem>
        <ToggleGroupItem
          value="es"
          aria-label="Español"
          className="rounded-l-none border data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
        >
          ES
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}
