import { useState, useCallback } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useLanguage } from '@/hooks/use-language';
import { useIsMobile } from '@/hooks/use-mobile';
import { useSOSScrollViewer } from '@/hooks/use-sos-scroll-viewer';
import { SOSPositionSelector } from '@/components/steps-of-service/SOSPositionSelector';
import { SOSScrollView } from '@/components/steps-of-service/SOSScrollView';
import { SOSActionButtons } from '@/components/steps-of-service/SOSActionButtons';
import { DockedProductAIPanel } from '@/components/shared/DockedProductAIPanel';
import { ProductAIDrawer } from '@/components/shared/ProductAIDrawer';
import { getActionConfig } from '@/data/ai-action-config';
import { usePinnedCourses } from '@/hooks/use-pinned-courses';
import type { Language } from '@/hooks/use-language';

const STRINGS = {
  en: {
    heroLine1: 'Hospitality,',
    heroLine2: 'Perfected',
    subtitle: 'Step-by-step service manuals for every front-of-house role.',
    failedToLoad: 'Failed to load steps of service',
  },
  es: {
    heroLine1: 'Hospitalidad,',
    heroLine2: 'Perfeccionada',
    subtitle: 'Manuales de servicio paso a paso para cada rol en sala.',
    failedToLoad: 'Error al cargar los pasos de servicio',
  },
} as const;

const POSITION_LABELS: Record<Language, Record<string, string>> = {
  en: {
    server: 'Server',
    bartender: 'Bartender',
    busser: 'Busser',
    barback: 'Barback',
  },
  es: {
    server: 'Mesero',
    bartender: 'Bartender',
    busser: 'Busser',
    barback: 'Barback',
  },
};

const StepsOfService = () => {
  const { language, setLanguage } = useLanguage();
  const t = STRINGS[language];
  const positionLabels = POSITION_LABELS[language];
  const isMobile = useIsMobile();
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const { togglePin, isPinned, sortPinnedFirst } = usePinnedCourses();

  const {
    chapterGroups,
    orderedSectionKeys,
    totalSections,
    selectedPosition,
    selectPosition,
    clearPosition,
    isLoading,
    error,
  } = useSOSScrollViewer();

  // Clear action when going back to position selector
  const handleClearPosition = useCallback(() => {
    setActiveAction(null);
    clearPosition();
  }, [clearPosition]);

  // Only show AI buttons when a position is selected (detail view)
  const headerToolbar = selectedPosition ? (
    <SOSActionButtons
      activeAction={activeAction}
      onActionChange={setActiveAction}
      language={language}
    />
  ) : undefined;

  // Desktop docked AI panel (only when position selected and action active)
  const aiPanel = selectedPosition && activeAction ? (
    <DockedProductAIPanel
      isOpen={activeAction !== null}
      onClose={() => setActiveAction(null)}
      actionConfig={getActionConfig('steps_of_service', activeAction) ?? null}
      domain="steps_of_service"
      itemName={`SOS — ${positionLabels[selectedPosition] ?? selectedPosition}`}
      itemContext={{ position: selectedPosition }}
    />
  ) : undefined;

  return (
    <AppShell
      language={language}
      onLanguageChange={setLanguage}
      showSearch={false}
      headerToolbar={headerToolbar}
      aiPanel={aiPanel}
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 gap-2">
          <AlertCircle className="h-6 w-6 text-destructive" />
          <p className="text-sm text-muted-foreground">{t.failedToLoad}</p>
        </div>
      ) : selectedPosition ? (
        <>
          <SOSScrollView
            position={selectedPosition}
            chapterGroups={chapterGroups}
            orderedSectionKeys={orderedSectionKeys}
            totalSections={totalSections}
            onBack={handleClearPosition}
            language={language}
          />
          {/* Mobile: bottom drawer for AI actions */}
          {isMobile && (
            <ProductAIDrawer
              open={activeAction !== null}
              onOpenChange={(open) => { if (!open) setActiveAction(null); }}
              actionConfig={activeAction ? getActionConfig('steps_of_service', activeAction) ?? null : null}
              domain="steps_of_service"
              itemName={`SOS — ${positionLabels[selectedPosition] ?? selectedPosition}`}
              itemContext={{ position: selectedPosition }}
            />
          )}
        </>
      ) : (
        <>
          <div className="py-6">
            <p className="text-2xl sm:text-3xl text-foreground leading-tight font-extralight">
              {t.heroLine1}
              <br />
              <span className="font-bold">{t.heroLine2}</span> ✨
            </p>
            <p className="text-sm text-muted-foreground mt-2">{t.subtitle}</p>
          </div>
          <SOSPositionSelector
            onSelectPosition={selectPosition}
            language={language}
            isPinned={isPinned}
            onTogglePin={togglePin}
            sortPinnedFirst={sortPinnedFirst}
          />
        </>
      )}
    </AppShell>
  );
};

export default StepsOfService;
