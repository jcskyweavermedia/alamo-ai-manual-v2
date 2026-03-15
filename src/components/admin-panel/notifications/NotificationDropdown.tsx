// =============================================================================
// NotificationDropdown -- Scrollable list of notifications with empty/loading
// =============================================================================

import { Bell } from 'lucide-react';
import { ADMIN_STRINGS } from '../strings';
import { NotificationItem } from './NotificationItem';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface NotificationDropdownProps {
  notifications: Array<{
    id: string;
    type: string;
    title: string;
    body: string | null;
    read: boolean;
    created_at: string;
  }>;
  onMarkRead: (id: string) => void;
  isLoading: boolean;
  language?: 'en' | 'es';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NotificationDropdown({
  notifications,
  onMarkRead,
  isLoading,
  language = 'en',
}: NotificationDropdownProps) {
  const t = ADMIN_STRINGS[language];

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 pb-2 border-b border-border">
        <Bell className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">{t.notifications}</h3>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-2 p-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-8">
          <Bell className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">{t.noNotifications}</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            {t.noNotificationsHint}
          </p>
        </div>
      ) : (
        <div className="max-h-80 overflow-y-auto p-1 space-y-0.5">
          {notifications.map((n) => (
            <NotificationItem
              key={n.id}
              notification={n}
              onMarkRead={onMarkRead}
              language={language}
            />
          ))}
        </div>
      )}
    </div>
  );
}
