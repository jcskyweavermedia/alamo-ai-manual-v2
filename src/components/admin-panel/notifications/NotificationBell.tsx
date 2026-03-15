// =============================================================================
// NotificationBell -- Bell icon with unread badge + popover dropdown
// =============================================================================

import { Bell } from 'lucide-react';
import { useNotifications } from '@/hooks/use-notifications';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { NotificationDropdown } from './NotificationDropdown';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface NotificationBellProps {
  language?: 'en' | 'es';
}

export function NotificationBell({ language = 'en' }: NotificationBellProps) {
  const { notifications, unreadCount, isLoading, markRead } = useNotifications();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative p-2 rounded-lg hover:bg-muted transition-colors"
          aria-label={
            unreadCount > 0
              ? `Notifications (${unreadCount} unread)`
              : 'Notifications'
          }
        >
          <Bell className="h-5 w-5 text-muted-foreground" />

          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-80 p-2"
      >
        <NotificationDropdown
          notifications={notifications}
          onMarkRead={markRead}
          isLoading={isLoading}
          language={language}
        />
      </PopoverContent>
    </Popover>
  );
}
