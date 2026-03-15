import { Check, ChevronsUpDown, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useActiveUnit } from '@/hooks/useActiveUnit';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';

interface UnitSwitcherProps {
  collapsed?: boolean;
}

export function UnitSwitcher({ collapsed = false }: UnitSwitcherProps) {
  const { activeGroupId, allMemberships, switchUnit, isLoading } =
    useActiveUnit();

  // Single-unit users (most common) -- render nothing
  if (allMemberships.length <= 1) {
    return null;
  }

  const activeGroup = allMemberships.find(
    (m) => m.groupId === activeGroupId,
  );
  const activeLabel = activeGroup?.groupName ?? 'Select unit';

  const trigger = (
    <DropdownMenuTrigger asChild>
      <button
        type="button"
        disabled={isLoading}
        className={cn(
          'flex items-center w-full min-h-[40px] rounded-lg',
          'text-muted-foreground hover:text-foreground hover:bg-accent/50',
          'transition-colors duration-150 active:scale-[0.98]',
          'disabled:opacity-50 disabled:pointer-events-none',
          collapsed ? 'justify-center px-0' : 'gap-2 px-3',
        )}
      >
        <span className="flex items-center justify-center shrink-0 w-9 h-9">
          <Building2 className="h-4 w-4" />
        </span>
        {!collapsed && (
          <>
            <span className="flex-1 truncate text-left text-sm">
              {activeLabel}
            </span>
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
          </>
        )}
      </button>
    </DropdownMenuTrigger>
  );

  return (
    <div className="px-2 pb-1 shrink-0">
      <DropdownMenu>
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>{trigger}</TooltipTrigger>
            <TooltipContent side="right">{activeLabel}</TooltipContent>
          </Tooltip>
        ) : (
          trigger
        )}

        <DropdownMenuContent
          side={collapsed ? 'right' : 'bottom'}
          align="start"
          className="min-w-[180px]"
        >
          {allMemberships.map((membership) => {
            const isActive = membership.groupId === activeGroupId;

            return (
              <DropdownMenuItem
                key={membership.groupId}
                onClick={() => {
                  if (!isActive) {
                    switchUnit(membership.groupId);
                  }
                }}
                className="cursor-pointer"
              >
                <Check
                  className={cn(
                    'mr-2 h-4 w-4 shrink-0',
                    isActive ? 'opacity-100' : 'opacity-0',
                  )}
                />
                <span className="truncate text-sm">{membership.groupName}</span>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
