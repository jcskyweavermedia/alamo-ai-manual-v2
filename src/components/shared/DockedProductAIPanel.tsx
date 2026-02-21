/**
 * DockedProductAIPanel
 *
 * Desktop-only docked AI panel for product items.
 * Pushes content left rather than overlaying (no opacity/backdrop).
 * Mirrors DockedAIPanel from the manual — same sizing, animation, escape key.
 */

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { AskAboutContent } from '@/components/manual/AskAboutContent';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';
import type { AIActionConfig } from '@/data/ai-action-config';

interface DockedProductAIPanelProps {
  /** Whether the panel is open */
  isOpen: boolean;
  /** Called when panel should close */
  onClose: () => void;
  /** Current action config */
  actionConfig: AIActionConfig | null;
  /** Product domain */
  domain: string;
  /** Item display name */
  itemName: string;
  /** Full item data for product context */
  itemContext: Record<string, unknown>;
}

export function DockedProductAIPanel({
  isOpen,
  onClose,
  actionConfig,
  domain,
  itemName,
  itemContext,
}: DockedProductAIPanelProps) {
  const panelRef = useRef<HTMLElement>(null);

  const { language } = useLanguage();
  const { permissions } = useAuth();

  const primaryGroup = permissions?.memberships?.[0] ?? null;
  const voiceEnabled = primaryGroup?.policy?.voiceEnabled ?? false;
  const groupId = primaryGroup?.groupId ?? '';

  const actionLabel = actionConfig
    ? (language === 'es' ? actionConfig.labelEs : actionConfig.label)
    : '';

  const displayTitle = itemName.length > 20
    ? itemName.slice(0, 20) + '...'
    : itemName;

  const closeLabel = language === 'es' ? 'Cerrar' : 'Close';

  // Escape key handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Focus panel on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      panelRef.current?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  if (!isOpen) return null;

  return (
    <aside
      ref={panelRef}
      tabIndex={-1}
      className={cn(
        'w-80 xl:w-96 shrink-0 h-full',
        'flex flex-col',
        'border-l border-border bg-background/95 backdrop-blur-sm shadow-xl',
        'animate-in slide-in-from-right-4 fade-in-0 duration-500 ease-out'
      )}
      role="complementary"
      aria-label={`${actionLabel} — ${itemName}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-sm min-w-0">
          <span className="flex items-center justify-center w-8 h-8 rounded-[10px] bg-slate-100 dark:bg-slate-800 text-lg leading-none shrink-0">🤖</span>
          <span className="text-base font-semibold truncate">
            {actionLabel} — {displayTitle}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-8 w-8 shrink-0"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">{closeLabel}</span>
        </Button>
      </div>

      {/* Content */}
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
          className="flex-1 min-h-0"
        />
      )}
    </aside>
  );
}
