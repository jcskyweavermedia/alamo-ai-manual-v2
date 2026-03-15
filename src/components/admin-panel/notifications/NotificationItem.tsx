// =============================================================================
// NotificationItem -- Single notification row with icon, unread dot, and time
// =============================================================================

import { Bell, MessageCircle, Clock, Megaphone } from 'lucide-react';
import { ADMIN_STRINGS } from '../strings';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface NotificationItemProps {
  notification: {
    id: string;
    type: string;
    title: string;
    body: string | null;
    read: boolean;
    created_at: string;
  };
  onMarkRead: (id: string) => void;
  language?: 'en' | 'es';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function getTypeIcon(type: string) {
  switch (type) {
    case 'assignment':
      return <Bell className="h-4 w-4 text-blue-500 shrink-0" />;
    case 'nudge':
      return <MessageCircle className="h-4 w-4 text-orange-500 shrink-0" />;
    case 'reminder':
      return <Clock className="h-4 w-4 text-amber-500 shrink-0" />;
    case 'announcement':
      return <Megaphone className="h-4 w-4 text-purple-500 shrink-0" />;
    default:
      return <Bell className="h-4 w-4 text-muted-foreground shrink-0" />;
  }
}

function getTypeLabel(type: string, t: typeof ADMIN_STRINGS['en']): string {
  switch (type) {
    case 'assignment': return t.notificationAssignment;
    case 'nudge': return t.notificationNudge;
    case 'reminder': return t.notificationReminder;
    case 'announcement': return t.notificationAnnouncement;
    default: return '';
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NotificationItem({ notification, onMarkRead, language = 'en' }: NotificationItemProps) {
  const n = notification;

  const handleClick = () => {
    if (!n.read) {
      onMarkRead(n.id);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`
        w-full text-left flex items-start gap-2.5 p-2.5 rounded-lg transition-colors
        ${n.read
          ? 'hover:bg-muted/50'
          : 'bg-blue-50/60 dark:bg-blue-950/20 hover:bg-blue-50 dark:hover:bg-blue-950/30'
        }
      `}
    >
      {/* Unread dot */}
      <div className="pt-1 shrink-0 w-2">
        {!n.read && (
          <div className="h-2 w-2 rounded-full bg-blue-500" />
        )}
      </div>

      {/* Type icon */}
      <div className="pt-0.5">
        {getTypeIcon(n.type)}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        {(() => {
          const typeLabel = getTypeLabel(n.type, ADMIN_STRINGS[language]);
          return typeLabel ? (
            <p className="text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wide mb-0.5">
              {typeLabel}
            </p>
          ) : null;
        })()}
        <p className={`text-sm leading-snug ${n.read ? 'text-foreground' : 'font-medium text-foreground'}`}>
          {n.title}
        </p>
        {n.body && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
            {n.body}
          </p>
        )}
        <p className="text-[10px] text-muted-foreground/70 mt-1">
          {timeAgo(n.created_at)}
        </p>
      </div>
    </button>
  );
}
