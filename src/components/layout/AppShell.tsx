import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { MobileTabBar } from './MobileTabBar';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { ContentArea } from './ContentArea';

interface AppShellProps {
  children: React.ReactNode;
  /** Show search in header */
  showSearch?: boolean;
  /** Constrain content to reading width */
  constrainContentWidth?: boolean;
  /** 
   * Control content area overflow behavior
   * - 'auto': scrollable (default)
   * - 'hidden': delegate scroll to children (for fixed sidebar layouts)
   */
  overflow?: 'auto' | 'hidden';
  /**
   * When true, render children directly without ContentArea wrapper.
   * Use for pages that manage their own layout (e.g., Manual with fixed columns).
   */
  rawContent?: boolean;
  /** User is admin (shows admin nav) */
  isAdmin?: boolean;
  /** Current language */
  language?: 'en' | 'es';
  /** Language change handler */
  onLanguageChange?: (lang: 'en' | 'es') => void;
  /** Search handler */
  onSearch?: (query: string) => void;
  /** Show Ask AI button in header */
  showAskAI?: boolean;
  /** Ask AI button click handler */
  onAskAIClick?: () => void;
  /** Optional AI panel content (desktop only) */
  aiPanel?: React.ReactNode;
  className?: string;
}

export function AppShell({
  children,
  showSearch = true,
  constrainContentWidth = true,
  overflow = 'auto',
  rawContent = false,
  isAdmin = false,
  language = 'en',
  onLanguageChange,
  onSearch,
  showAskAI = false,
  onAskAIClick,
  aiPanel,
  className,
}: AppShellProps) {
  const isMobile = useIsMobile();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleToggleSidebar = useCallback(() => {
    setSidebarCollapsed(prev => !prev);
  }, []);

  return (
    <div className={cn("h-screen flex w-full bg-background overflow-hidden", className)}>
      {/* Desktop/Tablet Sidebar */}
      <Sidebar
        isAdmin={isAdmin}
        collapsed={sidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
      />

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <Header
          showSearch={showSearch}
          language={language}
          onLanguageChange={onLanguageChange}
          onSearch={onSearch}
          showAskAI={showAskAI}
          onAskAIClick={onAskAIClick}
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={handleToggleSidebar}
        />

        {/* Content + optional AI panel wrapper */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Main content - either raw or wrapped in ContentArea */}
          {rawContent ? (
            <div className="flex-1 min-w-0 h-full overflow-hidden">
              {children}
            </div>
          ) : (
            <ContentArea constrainWidth={constrainContentWidth} overflow={overflow} className={overflow === 'hidden' ? 'h-full' : ''}>
              {children}
            </ContentArea>
          )}

          {/* AI Panel (desktop only, when provided) */}
          {aiPanel && !isMobile && (
            <aside className={cn(
              "hidden lg:flex flex-col",
              "w-80 xl:w-96",
              "border-l border-border",
              "bg-card"
            )}>
              {aiPanel}
            </aside>
          )}
        </div>
      </div>

      {/* Mobile Tab Bar */}
      <MobileTabBar isAdmin={isAdmin} />
    </div>
  );
}
