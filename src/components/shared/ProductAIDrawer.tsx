/**
 * ProductAIDrawer
 *
 * Mobile-only bottom Drawer for product AI.
 * Desktop uses DockedProductAIPanel (docked aside via AppShell aiPanel prop).
 */

import { Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from '@/components/ui/drawer';
import { AskAboutContent } from '@/components/manual/AskAboutContent';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';
import type { AIActionConfig } from '@/data/ai-action-config';

interface ProductAIDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actionConfig: AIActionConfig | null;
  domain: string;
  itemName: string;
  itemContext: Record<string, unknown>;
}

export function ProductAIDrawer({
  open,
  onOpenChange,
  actionConfig,
  domain,
  itemName,
  itemContext,
}: ProductAIDrawerProps) {
  const { language } = useLanguage();
  const { permissions } = useAuth();

  const primaryGroup = permissions?.memberships?.[0] ?? null;
  const voiceEnabled = primaryGroup?.policy?.voiceEnabled ?? false;
  const groupId = primaryGroup?.groupId ?? '';

  const actionLabel = actionConfig
    ? (language === 'es' ? actionConfig.labelEs : actionConfig.label)
    : '';

  const displayTitle = `${actionLabel} — ${itemName}`;
  const closeLabel = language === 'es' ? 'Cerrar' : 'Close';

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh] flex flex-col">
        <DrawerHeader className="flex flex-row items-center justify-between border-b pb-4 shrink-0">
          <div className="flex items-center gap-sm min-w-0">
            <Sparkles className="h-5 w-5 text-primary shrink-0" />
            <DrawerTitle className="text-base font-semibold truncate">
              {displayTitle}
            </DrawerTitle>
          </div>
          <DrawerClose asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
              <X className="h-4 w-4" />
              <span className="sr-only">{closeLabel}</span>
            </Button>
          </DrawerClose>
        </DrawerHeader>

        {actionConfig && (
          <AskAboutContent
            key={actionConfig.key}
            domain={domain}
            action={actionConfig.key}
            itemContext={itemContext}
            itemName={itemName}
            actionConfig={actionConfig}
            language={language}
            voiceEnabled={voiceEnabled}
            groupId={groupId}
            className="flex-1 min-h-0 overflow-hidden"
          />
        )}
      </DrawerContent>
    </Drawer>
  );
}
