import { useState, useRef, useEffect, ChangeEvent } from 'react';
import { Menu, Sparkles, ChevronLeft, ChevronRight, Mic } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SearchInput } from '@/components/ui/search-input';
import { LanguageToggle } from '@/components/ui/language-toggle';
import { Button } from '@/components/ui/button';

export interface ItemNav {
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}

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
  /** Prev/next item navigation (shown when viewing an item) */
  itemNav?: ItemNav;
  /** Optional toolbar content rendered between left and right sections (e.g. SOS AI buttons) */
  toolbar?: React.ReactNode;
  /** Optional content injected into the left section (before search) */
  leftContent?: React.ReactNode;
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
  itemNav,
  toolbar,
  leftContent,
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
        "",
        className
      )}
    >
      {/* Left section: Menu button + left content */}
      <div className="flex items-center gap-3 shrink-0">
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

        {leftContent}
      </div>

      {/* Center section: toolbar or manual search */}
      <div className="flex-1 flex items-center justify-center min-w-0">
        {toolbar ? (
          toolbar
        ) : showSearch ? (
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
        ) : null}
      </div>

      {/* Right section: Actions */}
      <div className="flex items-center gap-1.5 shrink-0">
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

        {/* Item prev/next navigation */}
        {itemNav && (
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={itemNav.onPrev}
              disabled={!itemNav.hasPrev}
              className={cn(
                'flex items-center justify-center',
                'h-7 w-7 rounded-md',
                'bg-muted text-foreground',
                'hover:bg-muted/80 active:scale-[0.96]',
                'transition-all duration-150',
                !itemNav.hasPrev && 'opacity-30 pointer-events-none'
              )}
              title="Previous item"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={itemNav.onNext}
              disabled={!itemNav.hasNext}
              className={cn(
                'flex items-center justify-center',
                'h-7 w-7 rounded-md',
                'bg-muted text-foreground',
                'hover:bg-muted/80 active:scale-[0.96]',
                'transition-all duration-150',
                !itemNav.hasNext && 'opacity-30 pointer-events-none'
              )}
              title="Next item"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Mic button (unconnected) */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          aria-label="Voice input"
        >
          <Mic className="h-4 w-4" />
        </Button>

        {/* Language toggle */}
        <LanguageToggle
          value={language}
          onChange={onLanguageChange || (() => {})}
          size="xs"
        />
      </div>
    </header>
  );
}