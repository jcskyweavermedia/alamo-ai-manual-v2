import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { SectionTitle } from "@/components/ui/typography";
import { ManualOutline } from "@/components/ui/manual-outline";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import {
  ManualBreadcrumb,
  MobileOutlineSheet,
  ManualContent,
  NotFoundSection,
  TranslationBanner,
  AskAboutSheet,
  InPageTOC,
  DockedAIPanel,
} from "@/components/manual";
import { useLanguage } from "@/hooks/use-language";
import { useManualSections, type SectionTreeNode } from "@/hooks/use-manual-sections";
import { useManualDocument } from "@/hooks/use-manual-document";
import { useLastOpenedSection } from "@/hooks/use-last-opened-section";
import { useSearchNavigation } from "@/hooks/use-search-navigation";
import { useAuth } from "@/hooks/use-auth";
/**
 * Convert SectionTreeNode[] to the format ManualOutline expects
 */
function convertToOutlineFormat(
  nodes: SectionTreeNode[],
  language: 'en' | 'es',
  getTitle: (section: SectionTreeNode, lang: 'en' | 'es') => string
): Array<{ id: string; title: string; icon?: string; children?: Array<{ id: string; title: string; icon?: string; children?: any[] }> }> {
  return nodes.map(node => ({
    id: node.id,
    title: getTitle(node, language),
    icon: node.icon,
    children: node.children.length > 0 
      ? convertToOutlineFormat(node.children, language, getTitle)
      : undefined
  }));
}

const Manual = () => {
  const { language, setLanguage } = useLanguage();
  const { sectionId } = useParams<{ sectionId?: string }>();
  const navigate = useNavigate();
  const handleSearch = useSearchNavigation();
  const { permissions } = useAuth();
  
  // Data hooks
  const { sections, tree, getSectionById, getSectionBySlug, getAncestors, getTitle, isLoading } = useManualSections();
  const { lastSectionId, setLastSection } = useLastOpenedSection();
  
  // Check voice permissions from first membership
  const voiceEnabled = permissions?.memberships?.[0]?.policy?.voiceEnabled ?? false;
  const groupId = permissions?.memberships?.[0]?.groupId ?? '';
  
  // Debug voice permissions (dev only)
  if (import.meta.env.DEV) {
    console.log('[Manual] Voice permissions:', { voiceEnabled, groupId, hasPermissions: !!permissions });
  }
  
  // Mobile sheet state
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  
  // Ask AI panel state
  const [askPanelOpen, setAskPanelOpen] = useState(false);
  
  // Desktop detection for panel vs drawer
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    setIsDesktop(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);
  
  // Find first content section for default
  const defaultSection = useMemo(() => {
    const firstContent = sections.find(s => !s.isCategory && s.hasContent);
    return firstContent?.slug ?? 'welcome-philosophy';
  }, [sections]);
  
  // Active section state - use URL param, then last opened, then first available content
  const [activeSection, setActiveSection] = useState<string>(() => {
    if (sectionId) return sectionId;
    if (lastSectionId) return lastSectionId;
    return defaultSection;
  });
  
  // Update active section when URL changes
  useEffect(() => {
    if (sectionId && sectionId !== activeSection) {
      setActiveSection(sectionId);
    }
  }, [sectionId]);
  
  // Update default when sections load if no section selected
  useEffect(() => {
    if (!sectionId && !lastSectionId && sections.length > 0) {
      setActiveSection(defaultSection);
    }
  }, [sections, defaultSection, sectionId, lastSectionId]);
  
  // Get current section info - try by slug first (preferred), then by ID (legacy URLs)
  const currentSection = getSectionBySlug(activeSection) ?? getSectionById(activeSection);
  
  // Always use slug for document fetching (RPC expects slug, not UUID)
  const sectionSlug = currentSection?.slug ?? activeSection;
  
  // Save last opened section (use slug for consistency)
  useEffect(() => {
    if (currentSection?.slug) {
      setLastSection(currentSection.slug);
    }
  }, [currentSection?.slug, setLastSection]);
  
  // Fetch document content - MUST use slug, not UUID
  const { markdown, updatedAt, isRequestedLanguage, isLoading: docLoading } = useManualDocument(
    sectionSlug,
    language
  );
  
  const ancestors = getAncestors(currentSection?.id ?? activeSection);
  
  // Handle section selection - memoized to prevent re-renders
  // Uses slug for navigation since that's what the Supabase data uses
  const handleSectionSelect = useCallback((id: string) => {
    const section = getSectionById(id);
    if (section && !section.isCategory) {
      // Navigate using slug for cleaner URLs
      setActiveSection(section.slug);
      navigate(`/manual/${section.slug}`);
      setMobileSheetOpen(false); // Close mobile sheet on selection
    }
  }, [getSectionById, navigate]);
  
  // Handle Ask AI panel toggle
  const handleToggleAskPanel = useCallback(() => {
    setAskPanelOpen(prev => !prev);
  }, []);
  
  // Handle navigation from Ask AI citations
  const handleAskNavigate = useCallback((slug: string) => {
    // On mobile, close the sheet before navigating
    if (!isDesktop) {
      setAskPanelOpen(false);
    }
    navigate(`/manual/${slug}`);
  }, [navigate, isDesktop]);
  
  // Convert tree to outline format - memoized
  const outlineSections = useMemo(() => 
    convertToOutlineFormat(tree, language, getTitle),
    [tree, language, getTitle]
  );
  
  // Get default expanded sections (all parent categories of active section)
  const defaultExpanded = useMemo(() => {
    const expanded = ancestors.map(a => a.id);
    if (currentSection?.parentId) {
      expanded.push(currentSection.parentId);
    }
    return expanded;
  }, [ancestors, currentSection?.parentId]);

  // Check if section exists - only show 404 after loading and if URL param doesn't match
  const sectionNotFound = !isLoading && activeSection && !currentSection && sections.length > 0;

  // Ref for main content scroll container (needed for InPageTOC scroll spy)
  const mainContentRef = useRef<HTMLDivElement>(null);

  return (
    <AppShell
      language={language}
      onLanguageChange={setLanguage}
      showSearch={true}
      onSearch={handleSearch}
      showAskAI={true}
      onAskAIClick={handleToggleAskPanel}
      rawContent={true}
    >
      <div className="flex h-full gap-lg xl:gap-xl w-full px-4 md:px-6 lg:px-8">
        {/* Left: Contents sidebar - fixed height, independent scroll */}
        <aside className="hidden lg:flex flex-col w-56 shrink-0 h-full pt-lg">
          <SectionTitle className="shrink-0 px-1 mb-md">
            {language === 'es' ? 'Contenido' : 'Contents'}
          </SectionTitle>
          <ScrollArea className="flex-1">
            <ManualOutline
              sections={outlineSections}
              activeId={activeSection}
              onSelect={handleSectionSelect}
              defaultExpanded={defaultExpanded}
            />
          </ScrollArea>
        </aside>

        {/* Center: Main content - PRIMARY scroll area */}
        <main 
          ref={mainContentRef}
          className="flex-1 min-w-0 overflow-y-auto h-full py-lg px-4 md:px-6 lg:px-0 pb-24 md:pb-6 space-y-lg transition-all duration-500 ease-out" 
          id="main-content"
        >
          {/* Skip link target */}
          <a id="main" className="sr-only focus:not-sr-only focus:absolute focus:top-20 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-lg" href="#main">
            {language === 'es' ? 'Ir al contenido principal' : 'Skip to main content'}
          </a>
          
          {isLoading ? (
            <div className="flex items-center justify-center py-xl">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : sectionNotFound ? (
            <NotFoundSection
              sectionId={sectionId}
              onNavigate={handleSectionSelect}
              language={language}
            />
          ) : (
            <>
              {/* Breadcrumb with actions */}
              <div className="flex items-center justify-between">
                <ManualBreadcrumb
                  ancestors={ancestors.map(a => ({ id: a.id, title: getTitle(a, language) }))}
                  onNavigate={handleSectionSelect}
                />
                <div className="flex items-center gap-sm shrink-0">
                  {/* Mobile menu button */}
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setMobileSheetOpen(true)}
                    className="lg:hidden h-10 w-10"
                    aria-label={language === 'es' ? 'Abrir navegación' : 'Open navigation'}
                  >
                    <Menu className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Translation fallback banner - shown when Spanish requested but English displayed */}
              <TranslationBanner language={language} isRequestedLanguage={isRequestedLanguage} />

              {/* Content (TOC is now separate) */}
              <ManualContent markdown={markdown} showTOC={false} />
            </>
          )}
        </main>

        {/* Right: In-Page TOC - fixed height, independent scroll (hidden when AI panel open) */}
        {markdown && !sectionNotFound && !isLoading && !askPanelOpen && (
          <aside className="hidden xl:flex flex-col w-44 shrink-0 h-full pt-lg transition-all duration-500 ease-out">
            <ScrollArea className="flex-1">
              <InPageTOC 
                markdown={markdown} 
                scrollContainerRef={mainContentRef}
              />
            </ScrollArea>
          </aside>
        )}

        {/* Docked AI Panel - desktop only */}
        {isDesktop && (
          <DockedAIPanel
            sectionId={currentSection?.slug ?? activeSection}
            sectionTitle={currentSection ? getTitle(currentSection, language) : 'Operations Manual'}
            language={language}
            isOpen={askPanelOpen}
            onClose={() => setAskPanelOpen(false)}
            onNavigateToSection={handleAskNavigate}
            voiceEnabled={voiceEnabled}
            groupId={groupId}
          />
        )}
      </div>
      
      {/* Mobile Navigation Sheet */}
      <MobileOutlineSheet
        open={mobileSheetOpen}
        onOpenChange={setMobileSheetOpen}
        sections={outlineSections}
        activeId={activeSection}
        onSelect={handleSectionSelect}
        defaultExpanded={defaultExpanded}
      />
      
      {/* Ask AI Drawer - mobile only */}
      {!isDesktop && (
        <AskAboutSheet
          open={askPanelOpen}
          onOpenChange={setAskPanelOpen}
          sectionId={currentSection?.slug ?? activeSection}
          sectionTitle={currentSection ? getTitle(currentSection, language) : 'Operations Manual'}
          language={language}
          onNavigateToSection={handleAskNavigate}
          voiceEnabled={voiceEnabled}
          groupId={groupId}
        />
      )}
    </AppShell>
  );
};

export default Manual;
