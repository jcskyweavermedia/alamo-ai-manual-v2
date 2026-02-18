import { HelpCircle, Mic, Play, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { SOS_AI_ACTIONS, isActionGroup, type AIActionConfig, type AIActionGroup } from '@/data/ai-action-config';

const ICON_MAP: Record<string, typeof Mic> = {
  'help-circle': HelpCircle,
  'mic': Mic,
  'play': Play,
};

interface SOSActionButtonsProps {
  activeAction: string | null;
  onActionChange: (action: string | null) => void;
  language: 'en' | 'es';
}

export function SOSActionButtons({
  activeAction,
  onActionChange,
  language,
}: SOSActionButtonsProps) {
  const isEs = language === 'es';

  return (
    <div className="flex items-center gap-1.5">
      {SOS_AI_ACTIONS.map((item) => {
        if (isActionGroup(item)) {
          return (
            <GroupDropdownButton
              key={item.key}
              group={item}
              activeAction={activeAction}
              onActionChange={onActionChange}
              isEs={isEs}
            />
          );
        }

        // Standalone button (Questions?)
        const action = item as AIActionConfig;
        const Icon = ICON_MAP[action.icon];
        const isActive = activeAction === action.key;
        const label = isEs ? action.labelEs : action.label;

        return (
          <Button
            key={action.key}
            variant={isActive ? 'default' : 'outline'}
            size="sm"
            className="shrink-0 h-8 px-2.5 text-[11px] min-h-0"
            onClick={() => onActionChange(isActive ? null : action.key)}
          >
            {Icon && <Icon className={cn('h-3.5 w-3.5', !isActive && 'text-primary')} />}
            {label}
          </Button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dropdown group button (Practice ▾, Listen ▾)
// ---------------------------------------------------------------------------

function GroupDropdownButton({
  group,
  activeAction,
  onActionChange,
  isEs,
}: {
  group: AIActionGroup;
  activeAction: string | null;
  onActionChange: (action: string | null) => void;
  isEs: boolean;
}) {
  const Icon = ICON_MAP[group.icon];
  const label = isEs ? group.labelEs : group.label;

  // Button shows as active if any child is active
  const isActive = group.children.some(c => c.key === activeAction);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={isActive ? 'default' : 'outline'}
          size="sm"
          className="shrink-0 h-8 px-2.5 text-[11px] min-h-0 gap-1"
        >
          {Icon && <Icon className={cn('h-3.5 w-3.5', !isActive && 'text-primary')} />}
          {label}
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[160px]">
        {group.children.map((child) => {
          const ChildIcon = ICON_MAP[child.icon];
          const childLabel = isEs ? child.labelEs : child.label;
          const isChildActive = activeAction === child.key;

          return (
            <DropdownMenuItem
              key={child.key}
              className={cn(
                'gap-2 cursor-pointer',
                isChildActive && 'bg-accent'
              )}
              onSelect={() => onActionChange(isChildActive ? null : child.key)}
            >
              {ChildIcon && <ChildIcon className="h-3.5 w-3.5 text-primary" />}
              {childLabel}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
