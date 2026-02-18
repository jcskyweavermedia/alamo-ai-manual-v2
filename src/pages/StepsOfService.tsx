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

const POSITION_LABELS: Record<string, string> = {
  server: 'Server',
  bartender: 'Bartender',
  busser: 'Busser',
  barback: 'Barback',
};

const StepsOfService = () => {
  const { language, setLanguage } = useLanguage();
  const isMobile = useIsMobile();
  const [activeAction, setActiveAction] = useState<string | null>(null);

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
      itemName={`SOS — ${POSITION_LABELS[selectedPosition] ?? selectedPosition}`}
      itemContext={{ position: selectedPosition }}
    />
  ) : undefined;

  return (
    <AppShell
      language={language}
      onLanguageChange={setLanguage}
      showSearch={false}
      rawContent={true}
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
          <p className="text-sm text-muted-foreground">
            {language === 'es' ? 'Error al cargar los pasos de servicio' : 'Failed to load steps of service'}
          </p>
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
              itemName={`SOS — ${POSITION_LABELS[selectedPosition] ?? selectedPosition}`}
              itemContext={{ position: selectedPosition }}
            />
          )}
        </>
      ) : (
        <SOSPositionSelector
          onSelectPosition={selectPosition}
          language={language}
        />
      )}
    </AppShell>
  );
};

export default StepsOfService;
