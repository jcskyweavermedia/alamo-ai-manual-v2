import { useState, useRef, useEffect, ChangeEvent } from 'react';
import { Menu, Sparkles, PanelLeftClose, PanelLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SearchInput } from '@/components/ui/search-input';
import { LanguageToggle } from '@/components/ui/language-toggle';
import { Button } from '@/components/ui/button';

interface HeaderProps {
  showSearch?: boolean;
  showMenuButton?: boolean;
  onMenuClick?: () => void;
  onSearch?: (query: string) => void;
  language?: 'en' | 'es';
  onLanguageChange?: (lang: 'en' | 'es') => void;
  /** Show Ask AI button */
  showAskAI?: boolean;
  /** Called when Ask AI button is clicked */
  onAskAIClick?: () => void;
  /** Whether sidebar is collapsed (desktop) */
  sidebarCollapsed?: boolean;
  /** Called to toggle sidebar collapse (desktop) */
  onToggleSidebar?: () => void;
  className?: string;
}

export function Header({
  showSearch = true,
  showMenuButton = false,
  onMenuClick,
  onSearch,
  language = 'en',
  onLanguageChange,
  showAskAI = false,
  onAskAIClick,
  sidebarCollapsed = false,
  onToggleSidebar,
  className,
}: HeaderProps) {
  const askLabel = language === 'es' ? 'Preguntar IA' : 'Ask AI';
  const [searchValue, setSearchValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
    setSearchValue(e.target.value);
  };

  const handleSearchSubmit = () => {
    if (onSearch) {
      onSearch(searchValue);
      setSearchValue(''); // Clear input after navigation
    }
  };

  const handleClear = () => {
    setSearchValue('');
  };

  // Global keyboard shortcut: Cmd/Ctrl+K to focus header search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <header
      className={cn(
        "z-40 flex-shrink-0",
        "flex items-center justify-between gap-3",
        "h-14 px-4 md:px-6",
        "bg-background",
        "border-b border-border",
        className
      )}
    >
      {/* Left section: Sidebar toggle + Menu button + Search */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Sidebar collapse toggle (desktop only) */}
        {onToggleSidebar && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleSidebar}
            className="hidden md:flex h-9 w-9 shrink-0"
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? (
              <PanelLeft className="h-5 w-5" />
            ) : (
              <PanelLeftClose className="h-5 w-5" />
            )}
          </Button>
        )}

        {/* Menu button for mobile (when sidebar is hidden) */}
        {showMenuButton && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuClick}
            className="md:hidden h-10 w-10 shrink-0"
          >
            <Menu className="h-5 w-5" />
          </Button>
        )}

        {/* Search bar */}
        {showSearch && (
          <div className="flex-1 max-w-md relative">
            <SearchInput
              ref={inputRef}
              value={searchValue}
              onChange={handleSearchChange}
              onClear={handleClear}
              onKeyDown={(e) => e.key === 'Enter' && handleSearchSubmit()}
              placeholder={language === 'es' ? 'Buscar manuales...' : 'Search manuals...'}
              className="w-full"
            />
            {/* Keyboard shortcut hint (desktop only, when empty) */}
            {!searchValue && (
              <kbd className="hidden sm:flex absolute right-12 top-1/2 -translate-y-1/2 h-6 px-2 items-center rounded bg-muted text-xs text-muted-foreground font-mono pointer-events-none">
                ⌘K
              </kbd>
            )}
          </div>
        )}
      </div>

      {/* Right section: Actions */}
      <div className="flex items-center gap-2">
        {/* Ask AI button */}
        {showAskAI && (
          <Button
            variant="outline"
            size="sm"
            onClick={onAskAIClick}
            className="gap-2"
          >
            <Sparkles className="h-4 w-4" />
            <span className="hidden sm:inline">{askLabel}</span>
          </Button>
        )}

        {/* Language toggle */}
        <LanguageToggle
          value={language}
          onChange={onLanguageChange || (() => {})}
        />
      </div>
    </header>
  );
}