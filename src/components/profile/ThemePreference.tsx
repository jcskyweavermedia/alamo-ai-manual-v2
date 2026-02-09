/**
 * ThemePreference
 * 
 * Theme selection component with Light/Dark/System options.
 * Syncs with use-theme hook.
 */

import { Moon, Sun, Monitor } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useTheme, type Theme } from '@/hooks/use-theme';
import { cn } from '@/lib/utils';

interface ThemePreferenceProps {
  className?: string;
}

export function ThemePreference({ className }: ThemePreferenceProps) {
  const { theme, setTheme } = useTheme();

  const handleThemeChange = (value: string) => {
    if (value === 'light' || value === 'dark' || value === 'system') {
      setTheme(value as Theme);
    }
  };

  return (
    <div className={cn('flex items-center justify-between', className)}>
      <div className="flex items-center gap-md">
        {theme === 'dark' ? (
          <Moon className="h-5 w-5 text-muted-foreground" />
        ) : theme === 'light' ? (
          <Sun className="h-5 w-5 text-muted-foreground" />
        ) : (
          <Monitor className="h-5 w-5 text-muted-foreground" />
        )}
        <Label>Theme</Label>
      </div>
      <ToggleGroup
        type="single"
        value={theme}
        onValueChange={handleThemeChange}
        className="gap-0"
      >
        <ToggleGroupItem
          value="light"
          aria-label="Light theme"
          className="rounded-r-none border border-r-0 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
        >
          <Sun className="h-4 w-4" />
        </ToggleGroupItem>
        <ToggleGroupItem
          value="system"
          aria-label="System theme"
          className="rounded-none border-y data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
        >
          <Monitor className="h-4 w-4" />
        </ToggleGroupItem>
        <ToggleGroupItem
          value="dark"
          aria-label="Dark theme"
          className="rounded-l-none border border-l-0 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
        >
          <Moon className="h-4 w-4" />
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}
